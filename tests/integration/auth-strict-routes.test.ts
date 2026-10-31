import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authRoutes } from '../../src/worker/routes/auth';
import { authMiddleware } from '../../src/worker/middleware/auth';
import type { AuthContext, Env } from '../../src/worker/types';
import { sendEmail } from '../../src/worker/services/email';
import * as digests from '../../src/worker/utils/otp-digest';
import { SESSION_COOKIE } from '../../src/worker/utils/session';
import { verifyPassword } from '../../src/worker/utils/password';
import { verifyJwt } from '../../src/worker/utils/jwt';
import { cleanupExpiredOtps, cleanupStrictOtps } from '../../src/worker/services/cleanup';
import { SqliteD1, createBarrier } from '../helpers/sqlite-d1';

vi.mock('../../src/worker/services/email', () => ({
  sendEmail: vi.fn(async () => ({ sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' })),
  buildOtpEmail: (code: string) => ({ subject: 'Test OTP', html: `<p>${code}</p>`, text: code }),
}));
const EMAIL = 'strict@example.test';
const PASSWORD = 'password-strong';
const SECRET = 'local-strict-otp-test-secret-32-bytes';
const ORIGIN = 'https://frigo.example.test';
const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/', authRoutes);
app.get('/private', (c) => c.json(c.get('auth')));
let db: SqliteD1;
let env: Env;
let scheduled: Promise<unknown>[];
let requestNumber = 0;
function key() { return `${db.query<{ now: number }>('SELECT unixepoch() * 1000 AS now')[0].now}:${crypto.randomUUID().replaceAll('-', '')}`; }
async function request(path: string, body: object, requestKey?: string, overrides: Partial<Env> = {}, origin = ORIGIN) {
  const headers = new Headers({ Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': `198.18.${Math.floor(++requestNumber / 200)}.${requestNumber % 200}` });
  if (requestKey !== undefined) headers.set('Idempotency-Key', requestKey);
  const response = await app.fetch(new Request(`${ORIGIN}${path}`, { method: 'POST', headers,
    body: JSON.stringify({ turnstileToken: 'test-token', ...body }) }), { ...env, ...overrides },
  { waitUntil: (task) => scheduled.push(task), passThroughOnException: () => {}, props: {} });
  return { status: response.status, response, json: await response.json() as any };
}
function latest(purpose = 'register') { return db.query<any>('SELECT * FROM auth_otp_issuances i JOIN auth_otp_scopes s ON s.scope_hash=i.scope_hash WHERE s.purpose=? ORDER BY i.rowid DESC LIMIT 1', purpose)[0]; }
function code() { return vi.mocked(sendEmail).mock.calls.at(-1)![1].text!; }
async function register(requestKey?: string) {
  const result = await request('/auth/register', { name: 'Strict Test', email: EMAIL, password: PASSWORD }, requestKey);
  expect(result.status, JSON.stringify(result.json)).toBe(200);
  return { ...result, code: code() };
}
async function verify(codeValue: string, requestKey?: string, purpose = 'register') { return request('/auth/verify-otp', { email: EMAIL, code: codeValue, purpose, ...(purpose === 'register' ? { newPassword: PASSWORD } : {}) }, requestKey); }
async function signup() { const reg = await register(); const result = await verify(reg.code); expect(result.status).toBe(200); return result; }
async function forgot(requestKey?: string) {
  const result = await request('/auth/forgot-password', { email: EMAIL }, requestKey);
  await Promise.all(scheduled);
  expect(result.status, JSON.stringify(result.json)).toBe(200);
  return { ...result, code: code() };
}
function sessionCount() { return db.query<{ count: number }>('SELECT COUNT(*) AS count FROM sessions_v2')[0].count; }

beforeEach(() => {
  db = new SqliteD1(); scheduled = []; vi.clearAllMocks();
  vi.mocked(sendEmail).mockResolvedValue({ sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' });
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true })));
  env = { DB: db, ENVIRONMENT: 'production', APP_URL: ORIGIN, OTP_HASH_SECRET: SECRET,
    JWT_SECRET: SECRET, TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret' };
});
afterEach(async () => { await Promise.all(scheduled); vi.restoreAllMocks(); vi.unstubAllGlobals(); db.close(); });

describe('strict OTP HTTP authority', () => {
  it.each([
    ['/auth/register', { name: 'X', email: EMAIL, password: PASSWORD }, 'Tên phải có ít nhất 2 ký tự'],
    ['/auth/login', { email: 'invalid', password: PASSWORD }, 'Địa chỉ email không hợp lệ'],
    ['/auth/verify-otp', { email: EMAIL, code: 'bad', purpose: 'login' }, 'Mã OTP phải gồm đúng 6 chữ số'],
    ['/auth/resend-otp', { email: 'invalid', purpose: 'login' }, 'Địa chỉ email không hợp lệ'],
    ['/auth/reset-password', { email: EMAIL, code: 'bad', newPassword: PASSWORD }, 'Mã OTP phải gồm đúng 6 chữ số'],
  ])('retains invalid-input HTTP 400 and custom message for %s', async (path, body, message) => {
    const result = await request(path as string, body as object);
    expect(result.status).toBe(400);
    expect(result.json.error).toBe(message);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.query('SELECT * FROM auth_accounts')).toEqual([]);
    expect(db.query('SELECT * FROM auth_otp_issuances')).toEqual([]);
  });
  it('persists only contextual digests and derives client time/expiry from D1', async () => {
    const result = await register();
    expect(result.json).toMatchObject({ otpDelivered: true, deliveryState: 'accepted', expiresInMinutes: 10 });
    expect(result.json.otpExpiresAtMs - result.json.otpKeyIssuedAtMs).toBe(600000);
    expect(result.json.retryAfterSeconds).toBe(60);
    expect(result.json).not.toHaveProperty('devOtp');
    expect(db.query('SELECT * FROM auth_otps')).toEqual([]);
    expect(latest().expected_digest).toBe(await digests.createOtpDigest(EMAIL, 'register', result.code, SECRET));
  });
  it('replays accepted issuance without a second send or changing its expiry', async () => {
    const requestKey = key(); const first = await register(requestKey);
    const replay = await request('/auth/register', { name: 'Strict Test', email: EMAIL, password: PASSWORD }, requestKey);
    expect(replay.status).toBe(200); expect(replay.json.replayed).toBe(true);
    expect(replay.json.otpExpiresAtMs).toBe(first.json.otpExpiresAtMs);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
  it('binds registration body and rejects a changed password under the same key', async () => {
    const requestKey = key(); await register(requestKey); const accounts = db.query('SELECT * FROM auth_accounts');
    const result = await request('/auth/register', { name: 'Strict Test', email: EMAIL, password: 'changed-password' }, requestKey);
    expect(result.status).toBe(409); expect(result.json.code).toBe('OTP_REQUEST_CONFLICT');
    expect(db.query('SELECT * FROM auth_accounts')).toEqual(accounts); expect(sendEmail).toHaveBeenCalledTimes(1);
  });
  it('shares cooldown across register retry, unverified password login and resend without mutating signup', async () => {
    await register(); const account = db.query('SELECT * FROM auth_accounts'); const profile = db.query('SELECT * FROM profiles');
    for (const [path, body] of [
      ['/auth/register', { name: 'Changed Name', email: EMAIL, password: 'different-password' }],
      ['/auth/login', { email: EMAIL, password: PASSWORD }],
      ['/auth/resend-otp', { email: EMAIL, purpose: 'register' }],
    ] as const) {
      const result = await request(path, body); expect(result.status).toBe(429);
      expect(result.json.code).toBe('OTP_COOLDOWN'); expect(result.json.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.response.headers.get('Retry-After')).toBe(String(result.json.retryAfterSeconds));
    }
    expect(db.query('SELECT * FROM auth_accounts')).toEqual(account); expect(db.query('SELECT * FROM profiles')).toEqual(profile);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
  it.each([20, 100])('allows at most five comparisons under %s distinct IP/key racers', async (racers) => {
    await register(); const compare = vi.spyOn(digests, 'verifyOtpDigest'); const barrier = createBarrier(racers);
    db.hooks.beforeBatch = (statements) => statements[0]?.sql.includes("'reserve'") ? barrier.wait() : undefined;
    const results = await Promise.all(Array.from({ length: racers }, () => verify('000000', key())));
    expect(compare).toHaveBeenCalledTimes(5); expect(results.filter((r) => r.status === 429)).toHaveLength(racers - 5);
    expect(db.query('SELECT * FROM auth_otp_tickets')).toHaveLength(5); expect(sessionCount()).toBe(0);
  });
  it('replays one wrong-code ticket under twenty same-key racers without another comparison', async () => {
    await register(); const compare = vi.spyOn(digests, 'verifyOtpDigest'); const requestKey = key();
    const results = await Promise.all(Array.from({ length: 20 }, () => verify('000000', requestKey)));
    expect(compare).toHaveBeenCalledTimes(1); expect(results.every((r) => [202, 400].includes(r.status))).toBe(true);
    const replay = await verify('000000', requestKey); expect(replay.status).toBe(400);
    expect(compare).toHaveBeenCalledTimes(1); expect(db.query('SELECT * FROM auth_otp_tickets')).toHaveLength(1);
  });
  it('lets the fifth correct admitted candidate commit despite the new-admission lock', async () => {
    const reg = await register(); for (let i = 0; i < 4; i++) expect((await verify('000000', key())).status).toBe(400);
    const fifth = await verify(reg.code, key()); expect(fifth.status).toBe(200); expect(fifth.response.headers.get('Set-Cookie')).toContain(SESSION_COOKIE);
    expect((await verify(reg.code, key())).status).toBe(429); expect(sessionCount()).toBe(1);
  });
  it('completion replay never returns another cookie or user and requires password login', async () => {
    const reg = await register(); const requestKey = key(); const first = await verify(reg.code, requestKey);
    expect(first.status).toBe(200); const replay = await verify(reg.code, requestKey);
    expect(replay.json).toMatchObject({ success: true, replayed: true, sessionRequired: true });
    expect(replay.json).not.toHaveProperty('user'); expect(replay.response.headers.get('Set-Cookie')).toBeNull(); expect(sessionCount()).toBe(1);
  });
  it('blocks changed candidate/purpose body reuse before another comparison', async () => {
    await register(); const compare = vi.spyOn(digests, 'verifyOtpDigest'); const requestKey = key();
    await verify('000000', requestKey);
    for (const [codeValue, purpose] of [['111111', 'register'], ['000000', 'forgot_password']]) {
      const result = await verify(codeValue, requestKey, purpose); expect(result.status).toBe(409);
    }
    expect(compare).toHaveBeenCalledTimes(1);
  });
  it('no-key retries are charged as new admissions and KV loss cannot bypass D1', async () => {
    await register(); const compare = vi.spyOn(digests, 'verifyOtpDigest');
    for (let i = 0; i < 6; i++) expect((await verify('000000')).status).toBe(i < 5 ? 400 : 429);
    expect(compare).toHaveBeenCalledTimes(5);
  });
  it.each(['bad-key', '1000000000000:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'])('rejects malformed/expired key %s before account or provider effects', async (requestKey) => {
    const result = await request('/auth/register', { name: 'Strict Test', email: EMAIL, password: PASSWORD }, requestKey);
    expect(result.status).toBe(requestKey === 'bad-key' ? 400 : 410); expect(sendEmail).not.toHaveBeenCalled();
    expect(db.query('SELECT * FROM auth_accounts')).toEqual([]); expect(db.query('SELECT * FROM auth_otp_scopes')).toEqual([]);
  });
  it('fails closed before all OTP effects when the secret is absent', async () => {
    const compare = vi.spyOn(digests, 'verifyOtpDigest'); const initialUsers = db.query('SELECT * FROM users');
    for (const [path, body] of [
      ['/auth/register', { name: 'Strict Test', email: EMAIL, password: PASSWORD }],
      ['/auth/forgot-password', { email: EMAIL }],
      ['/auth/resend-otp', { email: EMAIL, purpose: 'register' }],
      ['/auth/verify-otp', { email: EMAIL, code: '000000', purpose: 'register', newPassword: PASSWORD }],
      ['/auth/reset-password', { email: EMAIL, code: '000000', newPassword: PASSWORD }],
    ] as const) expect((await request(path, body, key(), { OTP_HASH_SECRET: undefined })).status).toBe(503);
    expect(compare).not.toHaveBeenCalled(); expect(sendEmail).not.toHaveBeenCalled(); expect(db.query('SELECT * FROM users')).toEqual(initialUsers);
  });
  it('preserves Origin/Turnstile and guest-transfer fences before strict admission', async () => {
    const denied = await request('/auth/register', { name: 'Strict Test', email: EMAIL, password: PASSWORD }, key(), {}, 'https://attacker.test');
    expect(denied.status).toBe(403); expect(db.query('SELECT * FROM auth_otp_requests')).toEqual([]);
    const reg = await register(); const compare = vi.spyOn(digests, 'verifyOtpDigest');
    const transfer = await request('/auth/verify-otp', { email: EMAIL, code: reg.code, purpose: 'register', migrateFromHouseholdId: 'hh_guest_example' }, key());
    expect(transfer.status).toBe(409); expect(transfer.json.code).toBe('INVENTORY_TRANSFER_DEFERRED');
    expect(compare).not.toHaveBeenCalled(); expect(latest().used).toBe(0); expect(sessionCount()).toBe(0);
  });
});

describe('strict email lifecycle, reset and cleanup', () => {
  it.each(['rejected', 'delivery_unknown'] as const)('keeps %s terminal without retry dispatch or cooldown refund', async (state) => {
    vi.mocked(sendEmail).mockResolvedValueOnce({ sent: false, provider: 'resend', state, evidence: 'http_response', error: 'provider_unavailable' });
    const requestKey = key(); const first = await request('/auth/register', { name: 'Strict Test', email: EMAIL, password: PASSWORD }, requestKey);
    expect(first.status).toBe(503); expect(first.json.deliveryState).toBe(state);
    const replay = await request('/auth/register', { name: 'Strict Test', email: EMAIL, password: PASSWORD }, requestKey);
    expect(replay.status).toBe(503); expect(sendEmail).toHaveBeenCalledTimes(1);
    expect((await request('/auth/resend-otp', { email: EMAIL, purpose: 'register' }, key())).status).toBe(429);
    const compare = vi.spyOn(digests, 'verifyOtpDigest'); await verify(code(), key()); expect(compare).not.toHaveBeenCalled();
  });
  it('keeps known and unknown forgot responses/account-wide policy identical while delivery is pending', async () => {
    await signup(); let release!: () => void; const pending = new Promise<void>((resolve) => { release = resolve; });
    vi.mocked(sendEmail).mockImplementationOnce(async () => { await pending; return { sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' }; });
    try {
      const known = await request('/auth/forgot-password', { email: EMAIL }, key());
      const unknown = await request('/auth/forgot-password', { email: 'unknown@example.test' }, key());
      const publicFields = ({ otpKeyIssuedAtMs: _clock, otpExpiresAtMs: _expiry, ...rest }: any) => rest;
      expect(publicFields(known.json)).toEqual(publicFields(unknown.json));
      for (const result of [known, unknown]) expect(result.json.otpExpiresAtMs - result.json.otpKeyIssuedAtMs).toBe(600000);
      expect(known.status).toBe(200); expect(known.json.otpDelivered).toBe(false);
      const compare = vi.spyOn(digests, 'verifyOtpDigest'); const blocked = await verify(code(), key(), 'forgot_password');
      expect(blocked.status).toBe(400); expect(blocked.json.code).toBe('OTP_INVALID'); expect(compare).not.toHaveBeenCalled();
    } finally { release(); }
  });
  it('final reset atomically changes password, revokes old sessions, creates one fresh session and preserves replay', async () => {
    await signup(); const reset = await forgot(); const requestKey = key();
    const result = await request('/auth/reset-password', { email: EMAIL, code: reset.code, newPassword: 'new-password' }, requestKey);
    expect(result.status).toBe(200); expect(sessionCount()).toBe(2);
    const account = db.query<any>('SELECT * FROM auth_accounts')[0]; expect(await verifyPassword('new-password', account.salt, account.password_hash)).toBe(true);
    expect(db.query('SELECT * FROM sessions_v2 WHERE revoked_at IS NULL')).toHaveLength(1);
    const replay = await request('/auth/reset-password', { email: EMAIL, code: reset.code, newPassword: 'new-password' }, requestKey);
    expect(replay.json.sessionRequired).toBe(true); expect(replay.response.headers.get('Set-Cookie')).toBeNull();
    const conflict = await request('/auth/reset-password', { email: EMAIL, code: reset.code, newPassword: 'other-password' }, requestKey);
    expect(conflict.status).toBe(409); expect(sessionCount()).toBe(2);
  });
  it('preliminary reset replay keeps its proof expiry and cannot authenticate a private route', async () => {
    await signup(); const reset = await forgot(); const requestKey = key(); const first = await verify(reset.code, requestKey, 'forgot_password');
    const replay = await verify(reset.code, requestKey, 'forgot_password');
    const a = await verifyJwt(first.json.resetToken, SECRET); const b = await verifyJwt(replay.json.resetToken, SECRET);
    expect(a.payload?.exp).toBe(b.payload?.exp); expect(a.payload?.typ).toBe('reset'); expect(latest('forgot_password').used).toBe(0);
    const response = await app.request('/private', { headers: { Authorization: `Bearer ${first.json.resetToken}` } }, { ...env, ENVIRONMENT: 'development' });
    expect(response.status).toBe(401); expect(sessionCount()).toBe(1);
  });
  it.each(['activate', 'session', 'password', 'revoke'] as const)('rolls back required %s failure with no cookie or partial success', async (effect) => {
    const reg = await register(); if (['password', 'revoke'].includes(effect)) { await verify(reg.code); await forgot(); }
    const beforeAccount = db.query('SELECT * FROM auth_accounts'); const beforeSessions = db.query('SELECT * FROM sessions_v2');
    const sql = effect === 'activate' ? "CREATE TRIGGER deny_effect BEFORE UPDATE OF is_verified ON auth_accounts BEGIN SELECT RAISE(IGNORE); END"
      : effect === 'session' ? "CREATE TRIGGER deny_effect BEFORE INSERT ON sessions_v2 BEGIN SELECT RAISE(IGNORE); END"
      : effect === 'password' ? "CREATE TRIGGER deny_effect BEFORE UPDATE OF password_hash ON auth_accounts BEGIN SELECT RAISE(IGNORE); END"
      : "CREATE TRIGGER deny_effect BEFORE UPDATE OF revoked_at ON sessions_v2 BEGIN SELECT RAISE(IGNORE); END";
    db.seed(sql);
    const result = ['password', 'revoke'].includes(effect)
      ? await request('/auth/reset-password', { email: EMAIL, code: code(), newPassword: 'replacement-password' }, key()) : await verify(reg.code, key());
    expect(result.status).toBe(503); expect(result.response.headers.get('Set-Cookie')).toBeNull();
    expect(db.query('SELECT * FROM auth_accounts')).toEqual(beforeAccount); expect(db.query('SELECT * FROM sessions_v2')).toEqual(beforeSessions);
    expect(latest(['password', 'revoke'].includes(effect) ? 'forgot_password' : 'register').used).toBe(0);
  });
  it('marks legacy challenges unprovable, keeps imported failures and never compares them', async () => {
    const legacyDigest = await digests.createOtpDigest(EMAIL, 'register', '123456', SECRET);
    await db.prepare("INSERT INTO auth_otps(id,email,code_digest,digest_version,purpose,expires_at,attempt_count) VALUES ('legacy',?,?,2,'register',datetime('now','+10 minutes'),3)").bind(EMAIL, legacyDigest).run();
    const compare = vi.spyOn(digests, 'verifyOtpDigest'); const result = await verify('123456', key());
    expect(result.status).toBe(400); expect(result.json.code).toBe('OTP_REISSUE_REQUIRED'); expect(compare).not.toHaveBeenCalled();
    expect(db.query('SELECT used FROM auth_otps')[0].used).toBe(1);
    expect(db.query('SELECT legacy_weight FROM auth_otp_scopes')[0].legacy_weight).toBe(3);
    expect(db.query('SELECT SUM(weight) AS count FROM auth_otp_tickets')[0].count).toBe(4);
  });
  it('prunes expired receipts after at least 24h while retaining scopes, imported accounting and current budget', async () => {
    await register(); await verify('000000', key()); const currentScope = db.query('SELECT * FROM auth_otp_scopes');
    expect(await cleanupStrictOtps(db, 0)).toBe(0); expect(db.query('SELECT * FROM auth_otp_scopes')).toEqual(currentScope);
    db.seed("UPDATE auth_otp_requests SET created_at=unixepoch()-172800, retained_until=unixepoch()-86400; UPDATE auth_otp_issuances SET created_at=unixepoch()-172800, expires_at=unixepoch()-86400; UPDATE auth_otp_tickets SET admitted_at=unixepoch()-172800, deadline=unixepoch()-86400");
    expect(await cleanupStrictOtps(db, 1)).toBe(4); expect(db.query('SELECT * FROM auth_otp_scopes')).toEqual(currentScope);
    expect(await cleanupStrictOtps(db, 1)).toBe(0);
  });
  it('expired keys remain rejected after their receipt is pruned', async () => {
    await register(); const requestKey = key(); await verify('000000', requestKey);
    db.seed("UPDATE auth_otp_requests SET created_at=unixepoch()-172800, retained_until=unixepoch()-86400; UPDATE auth_otp_issuances SET created_at=unixepoch()-172800, expires_at=unixepoch()-86400; UPDATE auth_otp_tickets SET admitted_at=unixepoch()-172800, deadline=unixepoch()-86400");
    await cleanupStrictOtps(db, 1); const oldKey = `${Number(requestKey.slice(0,13))-172800000}:${requestKey.slice(14)}`;
    const compare = vi.spyOn(digests, 'verifyOtpDigest'); const result = await verify('000000', oldKey);
    expect(result.status).toBe(410); expect(compare).not.toHaveBeenCalled();
  });
});


describe('strict recovery and retained authority regressions', () => {
  it('keeps forgot verification preliminary even when an extra newPassword field is submitted', async () => {
    await signup(); const before = db.query('SELECT * FROM auth_accounts'); const reset = await forgot(); const sessions = sessionCount();
    const result = await request('/auth/verify-otp', { email: EMAIL, code: reset.code, purpose: 'forgot_password', newPassword: 'ignored-extra-password' }, key());
    expect(result.status).toBe(200); expect(result.json.resetToken).toBeTruthy();
    expect(result.response.headers.has('Set-Cookie')).toBe(false); expect(sessionCount()).toBe(sessions);
    expect(db.query('SELECT * FROM auth_accounts')).toEqual(before); expect(latest('forgot_password').used).toBe(0);
  });

  function sameGeneric(known: any, unknown: any) {
    expect(known.status).toBe(200); expect(unknown.status).toBe(200);
    const withoutClock = ({ otpKeyIssuedAtMs: _clock, otpExpiresAtMs: _expiry, retryAfterSeconds: _cooldown, ...rest }: any) => rest;
    expect(withoutClock(known.json)).toEqual(withoutClock(unknown.json));
    expect(Object.keys(known.json).sort()).toEqual(Object.keys(unknown.json).sort());
    for (const result of [known, unknown]) {
      const { otpKeyIssuedAtMs, otpExpiresAtMs, retryAfterSeconds } = result.json;
      expect(retryAfterSeconds).toBe(Math.max(0, (otpExpiresAtMs - otpKeyIssuedAtMs) / 1000 - 540));
    }
    expect(known.json).toMatchObject({ success: true, otpDelivered: false, deliveryState: 'pending' });
    expect(Number.isSafeInteger(known.json.otpExpiresAtMs)).toBe(true);
    expect(Number.isSafeInteger(unknown.json.otpExpiresAtMs)).toBe(true);
  }
  it('binds activation to the password chosen by the mailbox owner after pre-registration', async () => {
    const reg = await register();
    const activation = await request('/auth/verify-otp', { email: EMAIL, code: reg.code, purpose: 'register', newPassword: 'mailbox-owner-password' }, key());
    expect(activation.status).toBe(200);
    const account = db.query<any>('SELECT * FROM auth_accounts')[0];
    expect(await verifyPassword('mailbox-owner-password', account.salt, account.password_hash)).toBe(true);
    expect(await verifyPassword(PASSWORD, account.salt, account.password_hash)).toBe(false);
    expect((await request('/auth/login', { email: EMAIL, password: PASSWORD })).status).toBe(401);
    expect((await request('/auth/login', { email: EMAIL, password: 'mailbox-owner-password' })).status).toBe(200);
  });
  it('rejects registration verification without a chosen password before admission', async () => {
    const reg = await register(); const compare = vi.spyOn(digests, 'verifyOtpDigest');
    const result = await request('/auth/verify-otp', { email: EMAIL, code: reg.code, purpose: 'register' }, key());
    expect(result.status).toBe(400); expect(result.json.code).toBe('VALIDATION_ERROR');
    expect(compare).not.toHaveBeenCalled(); expect(db.query('SELECT * FROM auth_otp_tickets')).toEqual([]);
  });
  it.each(['rejected', 'delivery_unknown'] as const)('hides forgot %s delivery and verification status while retaining budget', async (state) => {
    await signup(); vi.mocked(sendEmail).mockResolvedValueOnce({ sent: false, provider: 'resend', state, evidence: 'http_response', error: 'provider_unavailable' });
    const knownKey = key(); const unknownKey = key(); const unknownEmail = 'unknown@example.test';
    const known = await request('/auth/forgot-password', { email: EMAIL }, knownKey);
    const unknown = await request('/auth/forgot-password', { email: unknownEmail }, unknownKey); await Promise.all(scheduled);
    sameGeneric(known, unknown);
    sameGeneric(await request('/auth/forgot-password', { email: EMAIL }, knownKey), await request('/auth/forgot-password', { email: unknownEmail }, unknownKey));
    for (let i = 0; i < 6; i++) {
      const a = await verify('000000', key(), 'forgot_password');
      const b = await request('/auth/verify-otp', { email: unknownEmail, code: '000000', purpose: 'forgot_password' }, key());
      expect(a.status).toBe(i < 5 ? 400 : 429); expect(a.json.code).toBe(b.json.code); expect(a.status).toBe(b.status);
      expect(a.json.error).toBe(b.json.error); expect(Object.keys(a.json).sort()).toEqual(Object.keys(b.json).sort());
    }
  });
  it('keeps same-key forgot replay metadata identical while known delivery is still pending', async () => {
    await signup(); let release!: () => void; const pending = new Promise<void>((resolve) => { release = resolve; });
    vi.mocked(sendEmail).mockImplementationOnce(async () => { await pending; return { sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' }; });
    try {
      const aKey = key(); const bKey = key(); const unknownEmail = 'unknown@example.test';
      const firstA = await request('/auth/forgot-password', { email: EMAIL }, aKey);
      const firstB = await request('/auth/forgot-password', { email: unknownEmail }, bKey);
      const replayA = await request('/auth/forgot-password', { email: EMAIL }, aKey);
      const replayB = await request('/auth/forgot-password', { email: unknownEmail }, bKey);
      sameGeneric(replayA, replayB); expect(replayA.json.otpExpiresAtMs).toBe(firstA.json.otpExpiresAtMs);
      expect(replayB.json.otpExpiresAtMs).toBe(firstB.json.otpExpiresAtMs);
    } finally { release(); }
  });
  it.each(['consumed', 'expired', 'superseded', 'deleted'] as const)('keeps forgot issuance replay generic after known challenge is %s', async (transition) => {
    await signup(); const aKey = key(); const bKey = key(); const unknownEmail = 'unknown@example.test';
    const known = await forgot(aKey); const issuanceId = latest('forgot_password').id;
    const unknown = await request('/auth/forgot-password', { email: unknownEmail }, bKey); await Promise.all(scheduled);
    if (transition === 'consumed') expect((await request('/auth/reset-password', { email: EMAIL, code: known.code, newPassword: 'new-password' }, key())).status).toBe(200);
    if (transition === 'expired') db.seed("UPDATE auth_otp_issuances SET created_at=unixepoch()-601, expires_at=unixepoch()-1 WHERE scope_hash IN (SELECT scope_hash FROM auth_otp_scopes WHERE purpose='forgot_password')");
    if (transition === 'superseded') { db.seed("UPDATE auth_otp_scopes SET cooldown_until=0 WHERE purpose='forgot_password'"); await request('/auth/forgot-password', { email: EMAIL }, key()); }
    if (transition === 'deleted') await db.prepare('DELETE FROM auth_otp_issuances WHERE id=?').bind(issuanceId).run();
    const replayA = await request('/auth/forgot-password', { email: EMAIL }, aKey);
    const replayB = await request('/auth/forgot-password', { email: unknownEmail }, bKey);
    sameGeneric(replayA, replayB);
    if (transition !== 'expired') expect(replayA.json.otpExpiresAtMs).toBe(known.json.otpExpiresAtMs);
    if (transition !== 'expired') expect(replayB.json.otpExpiresAtMs).toBe(unknown.json.otpExpiresAtMs);
  });
  it.each(['throw', 'email_changed', 'membership_removed', 'session_revoked'] as const)('never emits a cookie after committed finalization when profile lookup is %s', async (fault) => {
    const reg = await register(); const requestKey = key(); let injected = false;
    db.hooks.beforeStatement = async (event) => {
      if (!injected && event.sql.includes('SELECT a.user_id, a.email, p.display_name')) {
        injected = true;
        if (fault === 'throw') throw new Error('profile unavailable');
        if (fault === 'email_changed') await db.prepare("UPDATE auth_accounts SET email='changed@example.test' WHERE email=?").bind(EMAIL).run();
        if (fault === 'membership_removed') await db.prepare("DELETE FROM household_members WHERE user_id IN (SELECT user_id FROM auth_accounts WHERE email=?)").bind(EMAIL).run();
        if (fault === 'session_revoked') db.seed("UPDATE sessions_v2 SET revoked_at=datetime('now')");
      }
    };
    const result = await verify(reg.code, requestKey); expect(result.status).toBe(503);
    expect(result.response.headers.has('Set-Cookie')).toBe(false); expect(sessionCount()).toBe(1);
    db.hooks = {};
    const replay = await verify(reg.code, requestKey);
    expect(replay.response.headers.has('Set-Cookie')).toBe(false); expect(sessionCount()).toBe(1);
    if (fault === 'email_changed') expect(replay.status).toBe(400);
    else expect(replay.json).toMatchObject({ success: true, sessionRequired: true });
  });
  it('retains expired legacy failure/lock evidence before lazy cutover import', async () => {
    const digest = await digests.createOtpDigest(EMAIL, 'register', '123456', SECRET);
    await db.prepare("INSERT INTO auth_otps(id,email,code_digest,digest_version,purpose,expires_at,attempt_count) VALUES ('failed',?,?,2,'register',datetime('now','-2 days'),3)").bind(EMAIL, digest).run();
    await db.prepare("INSERT INTO auth_otps(id,email,code_digest,digest_version,purpose,expires_at,attempt_count,locked_until) VALUES ('locked',?,?,2,'register',datetime('now','-2 days'),0,datetime('now','+10 minutes'))").bind(EMAIL, digest).run();
    await db.prepare("INSERT INTO auth_otps(id,email,code_digest,digest_version,purpose,expires_at,attempt_count) VALUES ('empty',?,?,2,'register',datetime('now','-2 days'),0)").bind(EMAIL, digest).run();
    expect(await cleanupExpiredOtps(db, 1)).toBe(1); expect(db.query('SELECT id FROM auth_otps ORDER BY id')).toEqual([{ id: 'failed' }, { id: 'locked' }]);
    const compare = vi.spyOn(digests, 'verifyOtpDigest'); expect((await verify('123456', key())).status).toBe(429);
    expect(compare).not.toHaveBeenCalled(); expect(db.query('SELECT legacy_weight FROM auth_otp_scopes')[0].legacy_weight).toBe(3);
    expect(db.query('SELECT weight FROM auth_otp_tickets WHERE request_id IS NULL')[0].weight).toBe(3);
  });
  it('retains active reset proof and imported tickets even when their receipt age exceeds retention', async () => {
    await signup(); const reset = await forgot(); expect((await verify(reset.code, key(), 'forgot_password')).status).toBe(200);
    db.seed("UPDATE auth_otp_requests SET created_at=unixepoch()-172800, retained_until=unixepoch()-86400; UPDATE auth_otp_issuances SET created_at=unixepoch()-172800, expires_at=unixepoch()-86400; UPDATE auth_otp_tickets SET admitted_at=unixepoch()-172800, deadline=unixepoch()-86400");
    const proof = db.query<any>("SELECT * FROM auth_otp_tickets WHERE state='proof'")[0];
    await cleanupStrictOtps(db, 1);
    expect(db.query('SELECT * FROM auth_otp_tickets WHERE id=?', proof.id)).toEqual([proof]);
    expect(db.query('SELECT id FROM auth_otp_requests WHERE id=?', proof.request_id)).toHaveLength(1);
    expect(db.query('SELECT id FROM auth_otp_issuances WHERE id=?', proof.issuance_id)).toHaveLength(1);
    expect(db.query('SELECT * FROM auth_otp_scopes')).toHaveLength(2);
  });
  it('rolls cleanup back as one batch if receipt pruning fails after ticket deletion', async () => {
    await register(); await verify('000000', key());
    db.seed("UPDATE auth_otp_requests SET created_at=unixepoch()-172800, retained_until=unixepoch()-86400; UPDATE auth_otp_issuances SET created_at=unixepoch()-172800, expires_at=unixepoch()-86400; UPDATE auth_otp_tickets SET admitted_at=unixepoch()-172800, deadline=unixepoch()-86400");
    const before = db.query('SELECT * FROM auth_otp_tickets');
    db.seed("CREATE TRIGGER fail_pruning BEFORE DELETE ON auth_otp_requests BEGIN SELECT RAISE(ABORT, 'pruning failed'); END");
    await expect(cleanupStrictOtps(db, 1)).rejects.toThrow('pruning failed');
    expect(db.query('SELECT * FROM auth_otp_tickets')).toEqual(before); expect(db.query('SELECT * FROM auth_otp_requests')).toHaveLength(2);
  });
});


describe('first strict-cutover fail-closed recovery', () => {
  it.each(['register', 'verify-otp', 'resend-otp', 'forgot-password', 'reset-password'])('refuses %s before mail or database work', async (path) => {
    const denied = new Hono<{ Bindings: Env }>();
    denied.route('/', authRoutes);
    const prepare = vi.fn(() => { throw new Error('Recovery must not access OTP state'); });
    const environment = { ENVIRONMENT: 'development', STRICT_OTP_FAIL_CLOSED: 'true', DB: { prepare } } as unknown as Env;
    const response = await denied.fetch(new Request(`http://localhost/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), environment);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'AUTH_OTP_MAINTENANCE' });
    expect(prepare).not.toHaveBeenCalled();
  });
});
