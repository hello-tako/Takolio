import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../../src/worker/services/email';
import type { Env } from '../../src/worker/types';

const params = { to: 'private@example.com', subject: 'OTP 654321', html: '<p>654321 private message</p>' };
const resendEnv = { RESEND_API_KEY: 'test-only-secret' } as Env;
function nativeEnv(send: () => Promise<unknown>) {
  return { SEND_EMAIL: { send }, RESEND_API_KEY: 'test-only-secret' } as unknown as Env;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => {
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/private@example.com|654321|private message|test-only-secret/);
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

describe('conservative native provider routing', () => {
  it('does not send again through Resend when native acceptance is ambiguous', async () => {
    const resend = vi.fn(async () => Response.json({ id: 'resend-message-123' }));
    vi.stubGlobal('fetch', resend);
    const native = vi.fn(async () => { throw new Error('accepted before connection dropped'); });
    const result = await sendEmail(nativeEnv(native), params);
    expect(result).toEqual({ sent: false, provider: 'workers-email', state: 'delivery_unknown', evidence: 'provider_exception', error: 'provider_unavailable' });
    expect(native).toHaveBeenCalledOnce();
    expect(resend).not.toHaveBeenCalled();
  });

  it.each([
    ['E_RECIPIENT_SUPPRESSED', 'recipient_not_allowed'],
    ['E_RECIPIENT_NOT_ALLOWED', 'recipient_not_allowed'],
    ['E_RATE_LIMIT_EXCEEDED', 'rate_limited'],
    ['E_DAILY_LIMIT_EXCEEDED', 'daily_limit'],
  ])('does not route around native policy %s', async (code, error) => {
    const resend = vi.fn();
    vi.stubGlobal('fetch', resend);
    const result = await sendEmail(nativeEnv(async () => { throw { code, message: params.html }; }), params);
    expect(result).toEqual({ sent: false, provider: 'workers-email', state: 'rejected', evidence: 'native_rejection_code', error });
    expect(resend).not.toHaveBeenCalled();
  });

  it.each(['E_SENDER_NOT_VERIFIED', 'E_SENDER_DOMAIN_NOT_AVAILABLE'])('allows fallback only after native sender code %s', async (code) => {
    const resend = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', resend);
    const result = await sendEmail(nativeEnv(async () => { throw { code }; }), params);
    expect(result).toEqual({ sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' });
    expect(resend).toHaveBeenCalledOnce();
  });

  it.each([
    { code: 'UNKNOWN_CODE' },
    { code: { toString: () => 'E_SENDER_NOT_VERIFIED' } },
    new Error('email sending not authorized for subdomain private.example.com'),
    Object.defineProperty({}, 'code', { get() { throw new Error('private getter'); } }),
  ])('does not infer non-send from untrusted error fields %#', async (error) => {
    const resend = vi.fn();
    vi.stubGlobal('fetch', resend);
    const result = await sendEmail(nativeEnv(async () => { throw error; }), params);
    expect(result).toMatchObject({ sent: false, provider: 'workers-email', state: 'delivery_unknown', evidence: 'provider_exception' });
    expect(resend).not.toHaveBeenCalled();
  });

  it('handles synchronous native throws conservatively', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const result = await sendEmail(nativeEnv(() => { throw new Error(params.to); }), params);
    expect(result.state).toBe('delivery_unknown');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)('fences a late native %s after an unabortable deadline', async (completion) => {
    vi.useFakeTimers();
    const pending = deferred<{ messageId: string }>();
    const resend = vi.fn();
    vi.stubGlobal('fetch', resend);
    let settled = false;
    const sending = sendEmail(nativeEnv(() => pending.promise), params).then((result) => { settled = true; return result; });
    await vi.advanceTimersByTimeAsync(7999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const result = await sending;
    const snapshot = JSON.stringify(result);
    expect(result).toEqual({ sent: false, provider: 'workers-email', state: 'delivery_unknown', evidence: 'deadline', error: 'provider_unavailable' });
    const logs = vi.mocked(console.error).mock.calls.length;
    if (completion === 'resolve') pending.resolve({ messageId: 'late-message-123' });
    else pending.reject(new Error('654321 private@example.com late rejection'));
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.stringify(result)).toBe(snapshot);
    expect(vi.mocked(console.error).mock.calls).toHaveLength(logs);
    expect(resend).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses a fresh bounded fallback deadline after a definitive native rejection', async () => {
    vi.useFakeTimers();
    const native = deferred<unknown>();
    const resend = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', resend);
    let settled = false;
    const sending = sendEmail(nativeEnv(() => native.promise), params).then((result) => { settled = true; return result; });
    await vi.advanceTimersByTimeAsync(7999);
    native.reject({ code: 'E_SENDER_NOT_VERIFIED' });
    await vi.advanceTimersByTimeAsync(0);
    expect(resend).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(7999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await sending).toEqual({ sent: false, provider: 'resend', state: 'delivery_unknown', evidence: 'deadline', error: 'provider_unavailable' });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('bounded HTTP dispatch and metadata', () => {
  it('returns unknown at the deadline even when fetch ignores abort, and cancels a late body', async () => {
    vi.useFakeTimers();
    const pending = deferred<Response>();
    const resend = vi.fn(() => pending.promise);
    vi.stubGlobal('fetch', resend);
    const sending = sendEmail(resendEnv, params);
    await vi.advanceTimersByTimeAsync(8000);
    const result = await sending;
    expect(result).toEqual({ sent: false, provider: 'resend', state: 'delivery_unknown', evidence: 'deadline', error: 'provider_unavailable' });
    const options = resend.mock.calls[0] as unknown as [string, RequestInit];
    expect(options[1].signal?.aborted).toBe(true);
    expect(options[1].redirect).toBe('error');
    const cancel = vi.fn();
    pending.resolve(new Response(new ReadableStream({ cancel })));
    await vi.advanceTimersByTimeAsync(0);
    expect(cancel).toHaveBeenCalledOnce();
    expect(resend).toHaveBeenCalledOnce();
    expect(vi.mocked(console.error)).toHaveBeenCalledOnce();
  });

  it.each([
    [200, 'accepted', undefined],
    [403, 'rejected', 'provider_unavailable'],
    [429, 'rejected', 'rate_limited'],
    [503, 'delivery_unknown', 'provider_unavailable'],
  ] as const)('retains HTTP %s evidence when the body and cancellation stall', async (status, state, error) => {
    vi.useFakeTimers();
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const response = new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"id":"unfinished')); }, cancel }), { status });
    const resend = vi.fn(async () => response);
    vi.stubGlobal('fetch', resend);
    const sending = sendEmail(resendEnv, params);
    await vi.advanceTimersByTimeAsync(8000);
    const result = await sending;
    expect(result).toEqual({ sent: state === 'accepted', provider: 'resend', state, evidence: 'http_response', ...(error ? { error } : {}) });
    expect(cancel).toHaveBeenCalledOnce();
    expect(resend).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handles late HTTP rejection after timeout without a second send or diagnostic', async () => {
    vi.useFakeTimers();
    const pending = deferred<Response>();
    const resend = vi.fn(() => pending.promise);
    vi.stubGlobal('fetch', resend);
    const sending = sendEmail(resendEnv, params);
    await vi.advanceTimersByTimeAsync(8000);
    const result = await sending;
    pending.reject(new Error('private@example.com late rejection'));
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toMatchObject({ state: 'delivery_unknown', evidence: 'deadline' });
    expect(resend).toHaveBeenCalledOnce();
    expect(vi.mocked(console.error)).toHaveBeenCalledOnce();
  });

  it('shares one deadline between HTTP dispatch and reading the response body', async () => {
    vi.useFakeTimers();
    const pending = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn(() => pending.promise));
    let settled = false;
    const sending = sendEmail(resendEnv, params).then((result) => { settled = true; return result; });
    await vi.advanceTimersByTimeAsync(3000);
    pending.resolve(new Response(new ReadableStream(), { status: 202 }));
    await vi.advanceTimersByTimeAsync(4999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await sending).toEqual({ sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' });
  });

  it.each([400, 403, 422, 429, 408, 500, 503, 302])('does not treat HTTP %s as acceptance', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('malformed private body', { status })));
    const result = await sendEmail(resendEnv, params);
    expect(result).toMatchObject({ sent: false, provider: 'resend', state: status >= 400 && status < 500 && status !== 408 ? 'rejected' : 'delivery_unknown', evidence: 'http_response' });
  });

  it('bounds oversized response metadata and cancels without waiting', async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({
      start(c) { c.enqueue(new Uint8Array(4097)); }, cancel,
    }))));
    expect(await sendEmail(resendEnv, params)).toEqual({ sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('bounds repeated empty chunks without starving the deadline', async () => {
    let reads = 0;
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({
      pull(c) { reads++; c.enqueue(new Uint8Array()); }, cancel,
    }))));
    expect(await sendEmail(resendEnv, params)).toEqual({ sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' });
    expect(reads).toBeLessThanOrEqual(65);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([null, '{bad JSON', '[123]', '{}'])('keeps HTTP acceptance when optional metadata is absent or malformed %#', async (body) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body)));
    expect(await sendEmail(resendEnv, params)).toEqual({ sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' });
  });

  it.each([200, 429])('preserves HTTP %s evidence when its body is already locked', async (status) => {
    const response = new Response('private provider body', { status });
    const reader = response.body!.getReader();
    vi.stubGlobal('fetch', vi.fn(async () => response));
    try {
      expect(await sendEmail(resendEnv, params)).toEqual({
        sent: status === 200, provider: 'resend', state: status === 200 ? 'accepted' : 'rejected', evidence: 'http_response',
        ...(status === 429 ? { error: 'rate_limited' } : {}),
      });
    } finally { reader.releaseLock(); }
  });

  it('preserves acceptance when reading the response body throws', async () => {
    const response = new Response(new ReadableStream({ start(c) { c.error(new Error(params.to)); } }));
    vi.stubGlobal('fetch', vi.fn(async () => response));
    expect(await sendEmail(resendEnv, params)).toEqual({ sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' });
  });

  it('clears provider timers after an early successful send', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null)));
    await sendEmail(resendEnv, params);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('private provider metadata', () => {
  it.each([undefined, null, 123, {}, '', '654321', '12345678', 'private@example.com', 'raw\nprivate', 'a'.repeat(129)])('omits unsafe IDs %# for both providers', async (id) => {
    const native = await sendEmail(nativeEnv(async () => ({ messageId: id })), params);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id })));
    const http = await sendEmail(resendEnv, params);
    expect(native).toEqual({ sent: true, provider: 'workers-email', state: 'accepted', evidence: 'native_resolved' });
    expect(http).toEqual({ sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' });
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each(['workers-email', 'resend'] as const)('keeps %s acceptance when optional hash computation stalls', async (provider) => {
    vi.useFakeTimers();
    const hash = deferred<ArrayBuffer>();
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(() => hash.promise);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'message-123' })));
    const env = provider === 'workers-email' ? nativeEnv(async () => ({ messageId: 'message-123' })) : resendEnv;
    const sending = sendEmail(env, params);
    await vi.advanceTimersByTimeAsync(8000);
    const result = await sending;
    expect(result).toEqual({ sent: true, provider, state: 'accepted', evidence: provider === 'workers-email' ? 'native_resolved' : 'http_response' });
    hash.resolve(new ArrayBuffer(32));
    await vi.advanceTimersByTimeAsync(0);
    expect(result).not.toHaveProperty('messageIdHash');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps acceptance if the native ID getter throws', async () => {
    const value = Object.defineProperty({}, 'messageId', { get() { throw new Error(params.to); } });
    expect(await sendEmail(nativeEnv(async () => value), params)).toEqual({ sent: true, provider: 'workers-email', state: 'accepted', evidence: 'native_resolved' });
  });

  it('exposes only an opaque ID hash, with no raw message ID or private data in logs', async () => {
    const id = 'private-provider-message-123';
    const result = await sendEmail(nativeEnv(async () => ({ messageId: id })), params);
    expect(result).toMatchObject({ sent: true, state: 'accepted', messageIdHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(JSON.stringify(result)).not.toContain(id);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/654321|private@example.com|test-only-secret|private-provider-message/);
  });
});
