// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OtpRequestRetryClient } from '../../src/web/services/auth-otp-retry';
import { authApi } from '../../src/web/services/auth';
import { resetPrivateSession } from '../../src/web/lib/private-session';
import { otpPresentation } from '../../src/web/features/auth/auth-shared';

const SERVER_EPOCH = 1_792_000_000_000;
const EMAIL = 'retry@example.test';
const CODE = '481937';
const OWNER = 'guest:household';
const verifyBody = { email: EMAIL, purpose: 'register', code: CODE };

async function bootstrap(client: OtpRequestRetryClient) {
  const request = await client.begin('/auth/forgot-password', { email: EMAIL }, OWNER);
  client.finish(request, { otpKeyIssuedAtMs: SERVER_EPOCH, deliveryState: 'pending' }, true);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetPrivateSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('OTP transport retry receipts', () => {
  it('omits keys before trusted server metadata, including a no-key retry', async () => {
    const client = new OtpRequestRetryClient();
    expect((await client.begin('/auth/verify-otp', verifyBody, OWNER)).key).toBeUndefined();
    expect((await client.begin('/auth/verify-otp', verifyBody, OWNER)).key).toBeUndefined();
  });

  it('uses the server clock plus monotonic elapsed time despite a skewed wall clock', async () => {
    let monotonic = 50;
    const client = new OtpRequestRetryClient(() => monotonic);
    await bootstrap(client);
    vi.spyOn(Date, 'now').mockReturnValue(9_000_000_000_000);
    monotonic += 731;
    const request = await client.begin('/auth/verify-otp', verifyBody, OWNER);
    expect(request.key).toMatch(new RegExp(`^${SERVER_EPOCH + 731}:[0-9a-f]{32}$`));
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('keeps one key for concurrent same-body retries and ignores fresh Turnstile tokens', async () => {
    const client = new OtpRequestRetryClient();
    await bootstrap(client);
    const body = { name: ' Retry User ', email: ` ${EMAIL.toUpperCase()} `, password: 'secret-password', turnstileToken: 'first' };
    const first = await client.begin('/auth/register', body, OWNER);
    const retries = await Promise.all(Array.from({ length: 20 }, () => client.begin('/auth/register', {
      ...body, name: 'Retry User', email: EMAIL, turnstileToken: 'replacement',
    }, OWNER)));
    expect(retries.map((request) => request.key)).toEqual(Array(20).fill(first.key));
    expect(first.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(first)).not.toContain(body.password);
  });

  it('assigns fresh keys when candidate, password, purpose, endpoint or guest transfer changes', async () => {
    const client = new OtpRequestRetryClient();
    await bootstrap(client);
    const bodies = [verifyBody, { ...verifyBody, code: '111111' },
      { ...verifyBody, purpose: 'forgot_password' }, { ...verifyBody, migrateFromHouseholdId: 'hh_guest_123' }];
    const requests = [];
    for (const body of bodies) requests.push(await client.begin('/auth/verify-otp', body, OWNER));
    requests.push(await client.begin('/auth/reset-password', { email: EMAIL, code: CODE, newPassword: 'password-one' }, OWNER));
    requests.push(await client.begin('/auth/reset-password', { email: EMAIL, code: CODE, newPassword: 'password-two' }, OWNER));
    expect(new Set(requests.map((request) => request.key)).size).toBe(requests.length);
  });

  it('binds the activation password to its verification retry key', async () => {
    const client = new OtpRequestRetryClient();
    await bootstrap(client);
    const firstBody = { ...verifyBody, newPassword: 'first-owner-password' };
    const first = await client.begin('/auth/verify-otp', firstBody, OWNER);
    client.finish(first, { code: 'OTP_INVALID' }, false, 400);
    expect((await client.begin('/auth/verify-otp', firstBody, OWNER)).key).toBe(first.key);
    expect((await client.begin('/auth/verify-otp', { ...verifyBody, newPassword: 'different-owner-password' }, OWNER)).key).not.toBe(first.key);
  });

  it('retains an invalid or completed verification receipt for an unchanged candidate', async () => {
    const client = new OtpRequestRetryClient();
    await bootstrap(client);
    const request = await client.begin('/auth/verify-otp', verifyBody, OWNER);
    client.finish(request, { code: 'OTP_INVALID' }, false, 400);
    expect((await client.begin('/auth/verify-otp', verifyBody, OWNER)).key).toBe(request.key);
    client.finish(request, { success: true, sessionRequired: true, replayed: true }, false);
    expect((await client.begin('/auth/verify-otp', verifyBody, OWNER)).key).toBe(request.key);
  });

  it.each([
    [400, 'OTP_KEY_MALFORMED'], [400, 'OTP_REISSUE_REQUIRED'], [400, 'OTP_STALE'],
    [409, 'OTP_REQUEST_CONFLICT'], [410, 'OTP_KEY_EXPIRED'], [429, 'OTP_COOLDOWN'], [429, 'OTP_BUDGET_EXHAUSTED'],
  ])('starts a new candidate after terminal %s %s denial', async (status, code) => {
    const client = new OtpRequestRetryClient();
    await bootstrap(client);
    const request = await client.begin('/auth/verify-otp', verifyBody, OWNER);
    client.finish(request, { code }, false, status);
    expect((await client.begin('/auth/verify-otp', verifyBody, OWNER)).key).not.toBe(request.key);
  });

  it.each(['pending', 'delivery_unknown'])('retains issuance key while delivery is %s', async (deliveryState) => {
    const client = new OtpRequestRetryClient();
    await bootstrap(client);
    const request = await client.begin('/auth/resend-otp', { email: EMAIL, purpose: 'register' }, OWNER);
    client.finish(request, { deliveryState }, true, deliveryState === 'pending' ? undefined : 503);
    expect((await client.begin('/auth/resend-otp', { email: EMAIL, purpose: 'register' }, OWNER)).key).toBe(request.key);
  });

  it.each(['accepted', 'rejected'])('allows a later explicit issuance after definitive %s', async (deliveryState) => {
    const client = new OtpRequestRetryClient();
    await bootstrap(client);
    const body = { email: EMAIL, purpose: 'register' };
    const request = await client.begin('/auth/resend-otp', body, OWNER);
    client.finish(request, { deliveryState }, true, deliveryState === 'accepted' ? undefined : 503);
    expect((await client.begin('/auth/resend-otp', body, OWNER)).key).not.toBe(request.key);
  });

  it('invalidates old verify/reset receipts when a new challenge is accepted', async () => {
    const client = new OtpRequestRetryClient();
    await bootstrap(client);
    const verify = await client.begin('/auth/verify-otp', verifyBody, OWNER);
    const resetBody = { email: EMAIL, code: CODE, newPassword: 'new-password' };
    const reset = await client.begin('/auth/reset-password', resetBody, OWNER);
    const issue = await client.begin('/auth/resend-otp', { email: EMAIL, purpose: 'register' }, OWNER);
    client.finish(issue, { deliveryState: 'accepted' }, true);
    expect((await client.begin('/auth/verify-otp', verifyBody, OWNER)).key).not.toBe(verify.key);
    expect((await client.begin('/auth/reset-password', resetBody, OWNER)).key).not.toBe(reset.key);
  });

  it('treats each explicit generic forgot resend acknowledgement as a new issuance operation', async () => {
    const client = new OtpRequestRetryClient();
    await bootstrap(client);
    const body = { email: EMAIL, purpose: 'forgot_password' };
    const request = await client.begin('/auth/resend-otp', body, OWNER);
    const resetBody = { email: EMAIL, code: CODE, newPassword: 'new-password' };
    const reset = await client.begin('/auth/reset-password', resetBody, OWNER);
    client.finish(request, { success: true, deliveryState: 'pending', otpDelivered: false }, true);
    expect((await client.begin('/auth/resend-otp', body, OWNER)).key).not.toBe(request.key);
    expect((await client.begin('/auth/reset-password', resetBody, OWNER)).key).not.toBe(reset.key);
  });

  it('does not let a delayed stale response replace the current trusted epoch', async () => {
    let monotonic = 10;
    const client = new OtpRequestRetryClient(() => monotonic);
    await bootstrap(client);
    const old = await client.begin('/auth/verify-otp', verifyBody, OWNER);
    const body = { ...verifyBody, code: '222222' };
    const current = await client.begin('/auth/verify-otp', body, OWNER);
    client.finish(current, { otpKeyIssuedAtMs: SERVER_EPOCH + 10_000, code: 'OTP_INVALID' }, false, 400);
    monotonic += 50;
    client.finish(old, { otpKeyIssuedAtMs: SERVER_EPOCH - 10_000, code: 'OTP_KEY_EXPIRED' }, false, 410);
    const next = await client.begin('/auth/reset-password', { email: EMAIL, code: CODE, newPassword: 'password' }, OWNER);
    expect(next.key).toMatch(new RegExp(`^${SERVER_EPOCH + 10_050}:[0-9a-f]{32}$`));
  });

  it('does not let a delayed response discard a newer operation receipt', async () => {
    const client = new OtpRequestRetryClient();
    await bootstrap(client);
    const first = await client.begin('/auth/verify-otp', verifyBody, OWNER);
    const body = { ...verifyBody, code: '222222' };
    const second = await client.begin('/auth/verify-otp', body, OWNER);
    client.finish(first, { code: 'OTP_KEY_EXPIRED' }, false, 410);
    expect((await client.begin('/auth/verify-otp', body, OWNER)).key).toBe(second.key);
  });

  it('resets receipts when the private owner changes and resets the bootstrap on logout', async () => {
    const client = new OtpRequestRetryClient();
    await bootstrap(client);
    const request = await client.begin('/auth/verify-otp', verifyBody, OWNER);
    expect((await client.begin('/auth/verify-otp', verifyBody, 'replacement')).key).not.toBe(request.key);
    client.reset();
    expect((await client.begin('/auth/verify-otp', verifyBody, 'replacement')).key).toBeUndefined();
  });

  it('does not invent a key from malformed epoch metadata or a reset monotonic clock', async () => {
    let monotonic = 50;
    const client = new OtpRequestRetryClient(() => monotonic);
    const request = await client.begin('/auth/verify-otp', verifyBody, OWNER);
    client.finish(request, { otpKeyIssuedAtMs: '1792000000000' }, false);
    expect((await client.begin('/auth/verify-otp', verifyBody, OWNER)).key).toBeUndefined();
    await bootstrap(client);
    monotonic = 0;
    expect((await client.begin('/auth/reset-password', { email: EMAIL, code: CODE, newPassword: 'password' }, OWNER)).key).toBeUndefined();
  });
});

describe('auth API retry integration', () => {
  it('bootstraps without a key, reuses network/invalid retries and changes keys with the code', async () => {
    const requests: Array<{ path: string; key: string | null; body: unknown }> = [];
    let verifyCount = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      requests.push({ path, key: new Headers(init?.headers).get('Idempotency-Key'), body: JSON.parse(String(init?.body)) });
      if (path.endsWith('/forgot-password')) {
        return Response.json({ success: true, otpKeyIssuedAtMs: SERVER_EPOCH, otpDelivered: false, deliveryState: 'pending' });
      }
      verifyCount += 1;
      if (verifyCount === 1) throw new TypeError('connection lost');
      return Response.json({ error: 'Mã OTP không hợp lệ.', code: 'OTP_INVALID', otpKeyIssuedAtMs: SERVER_EPOCH }, { status: 400 });
    }));
    await authApi.forgotPassword(EMAIL);
    await expect(authApi.verifyOtp(EMAIL, CODE, 'register', null, 'mailbox-owner-password')).rejects.toMatchObject({ kind: 'offline' });
    await expect(authApi.verifyOtp(EMAIL, CODE, 'register', null, 'mailbox-owner-password')).rejects.toMatchObject({ code: 'OTP_INVALID' });
    await expect(authApi.verifyOtp(EMAIL, CODE, 'register', null, 'mailbox-owner-password')).rejects.toMatchObject({ code: 'OTP_INVALID' });
    await expect(authApi.verifyOtp(EMAIL, '222222', 'register', null, 'mailbox-owner-password')).rejects.toMatchObject({ code: 'OTP_INVALID' });
    expect(requests[0].key).toBeNull();
    expect(requests[1].key).toMatch(/^[1-9][0-9]{12}:[0-9a-f]{32}$/);
    expect(requests[2].key).toBe(requests[1].key);
    expect(requests[3].key).toBe(requests[1].key);
    expect(requests[4].key).not.toBe(requests[1].key);
    expect(requests[1].body).toEqual({ ...verifyBody, newPassword: 'mailbox-owner-password' });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe('OTP presentation metadata', () => {
  it('projects server expiry onto local presentation even when the wall clock is skewed', () => {
    vi.spyOn(Date, 'now').mockReturnValue(9_000_000_000_000);
    expect(otpPresentation({ otpKeyIssuedAtMs: SERVER_EPOCH, otpExpiresAtMs: SERVER_EPOCH + 500_000,
      otpDelivered: true, deliveryState: 'accepted', retryAfterSeconds: 17 })).toEqual({
      delivered: true, cooldown: 17, expiresAt: 9_000_000_500_000,
    });
  });

  it('keeps pending/unknown delivery honest and preserves a rejected issuance cooldown', () => {
    expect(otpPresentation({ otpDelivered: false, deliveryState: 'pending', retryAfterSeconds: 60 }).delivered).toBeNull();
    expect(otpPresentation({ otpDelivered: false, deliveryState: 'delivery_unknown', retryAfterSeconds: 60 }).delivered).toBeNull();
    expect(otpPresentation({ otpDelivered: false, deliveryState: 'rejected', retryAfterSeconds: 43 })).toEqual({
      delivered: false, cooldown: 43, expiresAt: null,
    });
    expect(otpPresentation({ success: true }).delivered).toBeNull();
  });
});
