import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../../src/worker/services/email';
import type { Env } from '../../src/worker/types';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const params = { to: 'private@example.com', subject: 'private OTP', html: '<p>private message</p>' };
const idHash = (id: string) => createHash('sha256').update(id).digest('hex');

describe('transactional email provider routing', () => {
  it('does not call Resend after Workers Email accepts', async () => {
    const send = vi.fn(async () => ({ messageId: 'workers-message-123' }));
    const resend = vi.fn();
    vi.stubGlobal('fetch', resend);
    await expect(sendEmail({ SEND_EMAIL: { send }, RESEND_API_KEY: 'test-only-secret' } as unknown as Env, params)).resolves.toEqual({
      sent: true, provider: 'workers-email', state: 'accepted', evidence: 'native_resolved', messageIdHash: idHash('workers-message-123'),
    });
    expect(resend).not.toHaveBeenCalled();
  });

  it('falls back to Resend after an explicit Workers Email sender rejection', async () => {
    const workerError = Object.assign(new Error('sender rejected'), { code: 'E_SENDER_NOT_VERIFIED' });
    const resend = vi.fn(async () => Response.json({ id: 'resend-message-123' }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', resend);
    await expect(sendEmail({ SEND_EMAIL: { send: async () => { throw workerError; } }, RESEND_API_KEY: 'test-only-secret' } as unknown as Env, params)).resolves.toEqual({
      sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response', messageIdHash: idHash('resend-message-123'),
    });
    expect(resend).toHaveBeenCalledOnce();
  });

  it('returns a sanitized explicit native rejection when no fallback is configured', async () => {
    const workerError = Object.assign(new Error('sender rejected'), { code: 'E_SENDER_NOT_VERIFIED' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(sendEmail({ SEND_EMAIL: { send: async () => { throw workerError; } } } as unknown as Env, params)).resolves.toEqual({
      sent: false, provider: 'workers-email', state: 'rejected', evidence: 'native_rejection_code', error: 'sender_not_verified',
    });
  });

  it('returns unknown without fallback after an ambiguous native exception', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const resend = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', resend);
    await expect(sendEmail({ SEND_EMAIL: { send: async () => { throw new Error('provider unavailable'); } }, RESEND_API_KEY: 'test-only-secret' } as unknown as Env, params)).resolves.toEqual({
      sent: false, provider: 'workers-email', state: 'delivery_unknown', evidence: 'provider_exception', error: 'provider_unavailable',
    });
    expect(resend).not.toHaveBeenCalled();
  });

  it('classifies Resend HTTP 429 as rate limited', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 429 })));
    await expect(sendEmail({ RESEND_API_KEY: 'test-only-secret' } as Env, params)).resolves.toEqual({
      sent: false, provider: 'resend', state: 'rejected', evidence: 'http_response', error: 'rate_limited',
    });
  });

  it('distinguishes a Resend daily quota rejection from request-rate limiting', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ name: 'daily_quota_exceeded', message: `${params.to} must stay private` }, { status: 429 })));
    await expect(sendEmail({ RESEND_API_KEY: 'test-only-secret' } as Env, params)).resolves.toEqual({
      sent: false, provider: 'resend', state: 'rejected', evidence: 'http_response', error: 'daily_limit',
    });
  });

  it('classifies Resend sender verification failures without exposing its response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ name: 'validation_error', message: `The ${params.to} domain is not verified` }, { status: 403 })));
    await expect(sendEmail({ RESEND_API_KEY: 'test-only-secret' } as Env, params)).resolves.toEqual({
      sent: false, provider: 'resend', state: 'rejected', evidence: 'http_response', error: 'sender_not_verified',
    });
  });

  it('classifies Resend transport failures as unknown acceptance', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); }));
    await expect(sendEmail({ RESEND_API_KEY: 'test-only-secret' } as Env, params)).resolves.toEqual({
      sent: false, provider: 'resend', state: 'delivery_unknown', evidence: 'provider_exception', error: 'provider_unavailable',
    });
  });

  it('reports not configured when neither provider is available', async () => {
    await expect(sendEmail({} as Env, params)).resolves.toEqual({
      sent: false, provider: 'none', state: 'not_configured', evidence: 'configuration', error: 'not_configured',
    });
  });

  it('logs only sanitized context when the final provider outcome is unknown', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`${params.to} ${params.subject} ${params.html}`, { status: 503 })));
    await sendEmail({ RESEND_API_KEY: 'test-only-secret', ENVIRONMENT: 'production' } as Env, { ...params, purpose: 'register' });
    expect(log).toHaveBeenCalledWith(JSON.stringify({
      event: 'email_delivery_failed', provider: 'resend', category: 'provider_unavailable', state: 'delivery_unknown', evidence: 'http_response', purpose: 'register', environment: 'production',
    }));
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private@example\.com|private OTP|private message|test-only-secret/);
  });
});

it('does not log native mail exception details or the recipient', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const env = { SEND_EMAIL: { send: async () => { throw new Error(`${params.to} ${params.subject}`); } } } as unknown as Env;
  expect((await sendEmail(env, params)).sent).toBe(false);
  expect(log).toHaveBeenCalledWith(JSON.stringify({ event: 'email_delivery_failed', provider: 'workers-email', category: 'provider_unavailable', state: 'delivery_unknown', evidence: 'provider_exception' }));
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private@example.com|private OTP/);
});

it('does not retain provider response bodies in delivery diagnostics', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(`${params.to} private-provider-response`, { status: 422 })));
  expect(await sendEmail({ RESEND_API_KEY: 'test-only-secret' } as Env, params)).toEqual({
    sent: false, provider: 'resend', state: 'rejected', evidence: 'http_response', error: 'provider_unavailable',
  });
});

it('does not retain network exception details in delivery diagnostics', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('test-only-secret private@example.com'); }));
  expect(await sendEmail({ RESEND_API_KEY: 'test-only-secret' } as Env, params)).toEqual({
    sent: false, provider: 'resend', state: 'delivery_unknown', evidence: 'provider_exception', error: 'provider_unavailable',
  });
});

it('uses the structured Cloudflare Email Service payload', async () => {
  const send = vi.fn(async () => ({ messageId: 'message-123' }));
  await expect(sendEmail({ SEND_EMAIL: { send } } as unknown as Env, { ...params, text: 'private text' })).resolves.toEqual({
    sent: true, provider: 'workers-email', state: 'accepted', evidence: 'native_resolved', messageIdHash: idHash('message-123'),
  });
  expect(send).toHaveBeenCalledWith({
    to: params.to, from: { email: 'no-reply@tungjpstore.net', name: 'Takosan' }, subject: params.subject, html: params.html, text: 'private text', headers: { 'X-Frigo-Kind': 'transactional' },
  });
});

it('maps Cloudflare onboarding errors without retaining provider text', async () => {
  const error = Object.assign(new Error(`${params.to} should stay private`), { code: 'E_SENDER_NOT_VERIFIED' });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = await sendEmail({ SEND_EMAIL: { send: async () => { throw error; } } } as unknown as Env, params);
  expect(result).toEqual({ sent: false, provider: 'workers-email', state: 'rejected', evidence: 'native_rejection_code', error: 'sender_not_verified' });
  expect(JSON.stringify(log.mock.calls)).not.toContain(params.to);
});

it('classifies message-only subdomain errors without claiming definitive rejection', async () => {
  const error = new Error("email sending not authorized for subdomain 'private.example.com'");
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = await sendEmail({ SEND_EMAIL: { send: async () => { throw error; } } } as unknown as Env, params);
  expect(result).toEqual({ sent: false, provider: 'workers-email', state: 'delivery_unknown', evidence: 'provider_exception', error: 'sender_not_verified' });
  expect(JSON.stringify(log.mock.calls)).not.toContain('private.example.com');
});
