import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { executeInventoryLotCommand } from '../../packages/db/src/inventory-lot-commands';
import { backfillLegacyInventory } from '../../packages/db/src/inventory-truth';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { authRoutes } from '../../src/worker/routes/auth';
import { StrictOtpCoordinator } from '../../src/worker/services/auth-otp';
import { sendEmail } from '../../src/worker/services/email';
import type { AuthContext, Env } from '../../src/worker/types';
import { signJwt, verifyJwt } from '../../src/worker/utils/jwt';
import { verifyPassword } from '../../src/worker/utils/password';
import * as digests from '../../src/worker/utils/otp-digest';
import { SESSION_COOKIE, sha256Hex } from '../../src/worker/utils/session';
import { SqliteD1, type SqliteStatementEvent } from '../helpers/sqlite-d1';

// Node cannot load the Workers-only cloudflare:email module; delivery is mocked.
vi.mock('../../src/worker/services/email', () => ({
  sendEmail: vi.fn(async () => ({ sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' })),
  buildOtpEmail: (code: string) => ({ subject: 'Test OTP', html: code, text: code }),
}));

const ORIGIN = 'https://frigo.example.com';
const EMAIL = 'inventory-transfer@example.com';
const CODE = '123456';
const ACTIVATION_PASSWORD = 'mailbox-owner-chosen-password';
const OTP_SECRET = 'integration-only-otp-secret-at-least-32-bytes';
const JWT_SECRET = 'integration-only-jwt-secret-at-least-32-bytes';
const SOURCE = 'hh_guest_source';
const TARGET = 'hh_transferuser';
const FOREIGN = 'hh_guest_foreign';
const GUEST_TOKEN = 'inventory-transfer-guest-cookie';
const NOW = '2026-09-11T10:00:00Z';
const inventoryTables = [
  'households', 'household_members', 'inventory_items', 'inventory_lots',
  'inventory_events', 'inventory_commands', 'storage_locations', 'shopping_lists', 'shopping_items',
];
const authTables = ['users', 'profiles', 'auth_accounts', 'sessions_v2'];
const strictTables = ['auth_otp_scopes', 'auth_otp_requests', 'auth_otp_issuances', 'auth_otp_tickets', 'auth_otp_claims', 'auth_otp_assertions'];
const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/', authRoutes);
app.get('/private', (c) => c.json(c.get('auth')));

let db: SqliteD1;
let env: Env;
let cacheValues: Map<string, string>;
let cache: ReturnType<typeof createCache>;
let compare: MockInstance<typeof digests.verifyOtpDigest>;

function createCache() {
  return {
    get: vi.fn(async (key: string, type?: string) => {
      const value = cacheValues.get(key) ?? null;
      return value && type === 'json' ? JSON.parse(value) as unknown : value;
    }),
    put: vi.fn(async (key: string, value: string) => { cacheValues.set(key, value); }),
    delete: vi.fn(async (key: string) => { cacheValues.delete(key); }),
  };
}

function snapshot(tables = [...inventoryTables, ...authTables, 'auth_otps', ...strictTables]) {
  return JSON.stringify(Object.fromEntries(tables.map((table) => [table, db.query(`SELECT * FROM ${table} ORDER BY rowid`)])));
}

function businessCache() {
  return [...cacheValues].filter(([key]) => !key.startsWith('rl_auth:'));
}

async function seedOtp(purpose: 'register' | 'forgot_password' = 'register') {
  const coordinator = new StrictOtpCoordinator(db, OTP_SECRET);
  const result = await coordinator.reserveIssuance({ email: EMAIL, purpose,
    operation: purpose === 'register' ? 'issue_register' : 'issue_forgot', code: CODE });
  expect(result).toMatchObject({ kind: 'reserved', accountId: 'pending', userId: 'transferuser' });
  if (result.kind !== 'reserved') throw new Error('Strict issuance fixture was not admitted');
  expect(await coordinator.recordDelivery(result.issuanceId, 'accepted')).toBe(true);
  return result.issuanceId;
}

async function nativeStock(householdId: string, actorId: string) {
  await backfillLegacyInventory(db, householdId);
  const location = db.query<{ id: string }>(
    "SELECT id FROM storage_locations WHERE household_id = ? AND type = 'FRIDGE'", householdId,
  )[0];
  await executeInventoryLotCommand(db, { householdId, actorId }, 'fixture-create', {
    type: 'CREATE', lotId: `lot-${householdId}`, ingredientId: 'CHICKEN_EGG', rawName: `PRIVATE-${householdId}`,
    quantity: 5, unit: 'piece', storageLocationId: location.id, sourceType: 'MANUAL',
  }, NOW);
}

async function sourceStock(kind: 'legacy' | 'backfilled' | 'native' | 'empty') {
  if (kind === 'native') return nativeStock(SOURCE, 'guest-source');
  if (kind === 'empty') return;
  db.execute(`INSERT INTO inventory_items(id, household_id, ingredient_id, name, quantity, unit, storage)
    VALUES ('source-item', ?, 'CHICKEN_EGG', 'PRIVATE-source-eggs', 7, 'piece', 'fridge')`, [SOURCE]);
  db.execute(`INSERT INTO inventory_events(id, household_id, inventory_item_id, event_type, quantity_delta, unit, metadata)
    VALUES ('source-event', ?, 'source-item', 'ADD', 7, 'piece', '{"original":"legacy"}')`, [SOURCE]);
  if (kind === 'backfilled') await backfillLegacyInventory(db, SOURCE);
}

async function verify(extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return request('/auth/verify-otp', { email: EMAIL, code: CODE, purpose: 'register', newPassword: ACTIVATION_PASSWORD, ...extra }, headers);
}

async function request(path: string, body: unknown, extraHeaders: Record<string, string> = {}) {
  const response = await app.fetch(new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.221', ...extraHeaders },
    body: JSON.stringify(body),
  }), env);
  return { response, json: await response.json() as Record<string, unknown> };
}

async function expectCookiePrincipal(response: Response, userId: string, householdId: string) {
  const cookie = response.headers.get('Set-Cookie');
  expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=[a-f0-9]+;`));
  expect(cookie).toContain('; HttpOnly; Secure; SameSite=Lax;');
  const token = decodeURIComponent(cookie!.split(';')[0].slice(SESSION_COOKIE.length + 1));
  expect(db.query('SELECT user_id, household_id, revoked_at FROM sessions_v2 WHERE token_hash = ?', await sha256Hex(token)))
    .toEqual([{ user_id: userId, household_id: householdId, revoked_at: null }]);
  const privateResponse = await app.fetch(new Request(`${ORIGIN}/private`, { headers: { Cookie: cookie!.split(';')[0] } }), env);
  expect(privateResponse.status).toBe(200);
  expect(await privateResponse.json()).toMatchObject({ userId, householdId, isGuest: false });
}

beforeEach(async () => {
  db = new SqliteD1();
  vi.clearAllMocks();
  vi.mocked(sendEmail).mockResolvedValue({ sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' });
  compare = vi.spyOn(digests, 'verifyOtpDigest');
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true })));
  cacheValues = new Map();
  cache = createCache();
  env = { DB: db, CACHE: cache as unknown as Env['CACHE'], ENVIRONMENT: 'production', APP_URL: ORIGIN,
    OTP_HASH_SECRET: OTP_SECRET, JWT_SECRET, TURNSTILE_SITE_KEY: 'test-site', TURNSTILE_SECRET_KEY: 'test-secret' };
  db.seed(`INSERT INTO users(id, email, is_guest) VALUES
      ('transferuser', '${EMAIL}', 0), ('guest-source', NULL, 1), ('guest-foreign', NULL, 1);
    INSERT INTO auth_accounts(id, user_id, email, is_verified) VALUES ('pending', 'transferuser', '${EMAIL}', 0);
    INSERT INTO profiles(id, user_id, display_name) VALUES ('transfer-profile', 'transferuser', 'Transfer Test');
    INSERT INTO households(id, name, created_by) VALUES
      ('${SOURCE}', 'PRIVATE-source', 'guest-source'), ('${TARGET}', 'PRIVATE-target', 'transferuser'),
      ('${FOREIGN}', 'PRIVATE-foreign', 'guest-foreign');
    INSERT INTO household_members(id, household_id, user_id, role) VALUES
      ('source-member', '${SOURCE}', 'guest-source', 'owner'), ('target-member', '${TARGET}', 'transferuser', 'owner'),
      ('foreign-member', '${FOREIGN}', 'guest-foreign', 'owner');
    INSERT INTO auth_otps(id, email, purpose, code_digest, expires_at, used, attempt_count, used_at, created_at)
      VALUES ('retained-legacy', '${EMAIL}', 'register', '${'a'.repeat(64)}', datetime('now', '-90 days'), 1, 2, datetime('now', '-90 days'), datetime('now', '-90 days'));`);
  for (const householdId of [SOURCE, TARGET, FOREIGN]) {
    db.execute('INSERT INTO shopping_lists(id, household_id) VALUES (?, ?)', [`list-${householdId}`, householdId]);
    db.execute('INSERT INTO shopping_items(id, list_id, name) VALUES (?, ?, ?)',
      [`shopping-${householdId}`, `list-${householdId}`, `PRIVATE-shopping-${householdId}`]);
    for (const prefix of ['plan_active_', 'inv_']) cacheValues.set(`${prefix}${householdId}`, `PRIVATE-${prefix}${householdId}`);
  }
  await nativeStock(TARGET, 'transferuser');
  await nativeStock(FOREIGN, 'guest-foreign');
  db.execute(`INSERT INTO sessions_v2(id, user_id, household_id, token_hash, expires_at)
    VALUES ('guest-session', 'guest-source', ?, ?, ?)`,
  [SOURCE, await sha256Hex(GUEST_TOKEN), new Date(Date.now() + 3_600_000).toISOString()]);
  await seedOtp();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  db.close();
});

async function expectDeferred(householdId: string, headers: Record<string, string> = {}, extra: Record<string, unknown> = {}) {
  expect(db.query('SELECT is_verified FROM auth_accounts WHERE id = ?', 'pending')).toEqual([{ is_verified: 0 }]);
  expect(db.query('SELECT used, attempt_count FROM auth_otps WHERE id = ?', 'retained-legacy')).toEqual([{ used: 1, attempt_count: 2 }]);
  expect(db.query('SELECT * FROM sessions_v2 WHERE user_id = ?', 'transferuser')).toEqual([]);
  const before = snapshot();
  const cached = businessCache();
  const totalChanges = db.query('SELECT total_changes() AS count');
  const statements: SqliteStatementEvent[] = [];
  const batch = vi.fn();
  db.hooks = { beforeStatement: (event) => { statements.push(event); }, beforeBatch: batch };
  let first: Record<string, unknown> | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { response, json } = await verify({ ...extra, migrateFromHouseholdId: householdId }, headers);
    expect(response.status).toBe(409);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(json).toEqual({ code: 'INVENTORY_TRANSFER_DEFERRED', error: 'Chưa hỗ trợ chuyển dữ liệu hộ khách an toàn. Hãy giữ dữ liệu hộ khách và tài khoản mới riêng biệt.', otpKeyIssuedAtMs: expect.any(Number) });
    expect(Number.isSafeInteger(json.otpKeyIssuedAtMs)).toBe(true);
    for (const privateValue of [SOURCE, TARGET, FOREIGN, EMAIL, 'PRIVATE-', householdId]) {
      expect(JSON.stringify(json)).not.toContain(privateValue);
    }
    const publicBody = { ...json, otpKeyIssuedAtMs: undefined };
    if (first) expect(publicBody).toEqual(first);
    first = publicBody;
    expect(snapshot()).toBe(before);
    expect(businessCache()).toEqual(cached);
    expect(db.query('SELECT total_changes() AS count')).toEqual(totalChanges);
  }
  expect(statements).toHaveLength(2);
  for (const statement of statements) {
    expect(statement.method).toBe('first');
    expect(statement.sql).toBe('SELECT unixepoch() AS now_sec');
    expect(statement.bindings).toEqual([]);
  }
  expect(compare).not.toHaveBeenCalled();
  expect(batch).not.toHaveBeenCalled();
  expect(cache.delete).not.toHaveBeenCalled();
  for (const [key] of [...cache.get.mock.calls, ...cache.put.mock.calls]) expect(key).toMatch(/^rl_auth:/);
  expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
}

describe('T09F guest transfer safe deferral', () => {
  it.each(['legacy', 'backfilled', 'native', 'empty'] as const)(
    'preserves all %s guest data, strict challenge and pending account with a real guest cookie', async (kind) => {
      await sourceStock(kind);
      await expectDeferred(SOURCE, { Cookie: `${SESSION_COOKIE}=${GUEST_TOKEN}` });
    },
  );

  it.each(['legacy', 'backfilled', 'native', 'empty'] as const)(
    'defers %s stock with valid legacy guest JWT proof, without ownership lookups', async (kind) => {
      await sourceStock(kind);
      const jwt = await signJwt({ sub: 'guest-source', hid: SOURCE, typ: 'guest', isGuest: true,
        exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
      await expectDeferred(SOURCE, { Authorization: `Bearer ${jwt}` });
    },
  );

  it.each([
    ['foreign household with source cookie', FOREIGN, { Cookie: `${SESSION_COOKIE}=${GUEST_TOKEN}` }],
    ['nonexistent household with source cookie', 'hh_guest_missing', { Cookie: `${SESSION_COOKIE}=${GUEST_TOKEN}` }],
    ['forged bearer', FOREIGN, { Authorization: 'Bearer forged-guest-token' }],
    ['forged cookie', SOURCE, { Cookie: `${SESSION_COOKIE}=forged-cookie` }],
    ['no guest proof', SOURCE, {}],
  ] satisfies [string, string, Record<string, string>][])(
    'returns the same non-disclosing deferral for %s', async (_label, householdId, headers) => {
      await sourceStock('native');
      await expectDeferred(householdId, headers);
    },
  );

  it.each(['wrong', 'expired', 'used', 'locked', 'missing'] as const)(
    'defers transfer before admission or comparison for %s strict OTP', async (condition) => {
      await sourceStock('backfilled');
      if (condition === 'expired') db.execute("UPDATE auth_otp_issuances SET created_at = unixepoch() - 660, expires_at = unixepoch() - 60");
      if (condition === 'used') db.execute('UPDATE auth_otp_issuances SET used = 1');
      if (condition === 'locked') db.execute('UPDATE auth_otp_scopes SET locked_until = unixepoch() + 900');
      if (condition === 'missing') db.execute('DELETE FROM auth_otp_issuances');
      await expectDeferred(SOURCE, {}, { code: condition === 'wrong' ? '999999' : CODE });
    },
  );

  it.each(['', 'hh_other', 42, null])('retains schema rejection for malformed transfer ID %s', async (householdId) => {
    const before = snapshot();
    const { response, json } = await verify({ migrateFromHouseholdId: householdId });
    expect(response.status).toBe(400);
    expect(json.code).toBe('VALIDATION_ERROR');
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(snapshot()).toBe(before);
    expect(compare).not.toHaveBeenCalled();
  });

  it.each([false, true])('registers without migration, including an explicit retry after deferral=%s', async (retry) => {
    await sourceStock('native');
    const before = snapshot(inventoryTables);
    const legacy = snapshot(['auth_otps']);
    const headers = { Cookie: `${SESSION_COOKIE}=${GUEST_TOKEN}` };
    if (retry) await expectDeferred(SOURCE, headers);
    db.hooks = {};
    const { response, json } = await verify({}, headers);
    expect(response.status, JSON.stringify(json)).toBe(200);
    expect(json.success).toBe(true);
    expect(json).not.toHaveProperty('migratedFromHouseholdId');
    expect(json.user).toMatchObject({ id: 'transferuser', householdId: TARGET, isGuest: false });
    expect(db.query('SELECT is_verified FROM auth_accounts WHERE id = ?', 'pending')).toEqual([{ is_verified: 1 }]);
    expect(db.query('SELECT used FROM auth_otp_issuances')).toEqual([{ used: 1 }]);
    expect(db.query("SELECT state, weight FROM auth_otp_tickets WHERE operation='register_verify'")).toEqual([{ state: 'completed', weight: 1 }]);
    expect(compare).toHaveBeenCalledTimes(1);
    const account = db.query<{ salt: string; password_hash: string }>('SELECT salt, password_hash FROM auth_accounts WHERE id = ?', 'pending')[0];
    expect(await verifyPassword(ACTIVATION_PASSWORD, account.salt, account.password_hash)).toBe(true);
    expect(db.query('SELECT * FROM sessions_v2 WHERE user_id = ?', 'transferuser')).toHaveLength(1);
    expect(snapshot(inventoryTables)).toBe(before);
    expect(snapshot(['auth_otps'])).toBe(legacy);
    await expectCookiePrincipal(response, 'transferuser', TARGET);
    const replay = await verify();
    expect(replay.response.status).toBe(400);
    expect(replay.response.headers.get('Set-Cookie')).toBeNull();
    expect(compare).toHaveBeenCalledTimes(1);
    expect(db.query('SELECT * FROM sessions_v2 WHERE user_id = ?', 'transferuser')).toHaveLength(1);
  });

  it('D3 client contract: the issued production OTP survives transfer deferral and verifies with the chosen password', async () => {
    await sourceStock('legacy');
    const email = 'guest-conversion@example.com';
    const headers = { Cookie: `${SESSION_COOKIE}=${GUEST_TOKEN}` };
    const registered = await request('/auth/register', { name: 'Guest Conversion', email,
      password: 'original-pending-password', turnstileToken: 'test-token' }, headers);
    expect(registered.response.status, JSON.stringify(registered.json)).toBe(200);
    expect(registered.json).toMatchObject({ success: true, otpDelivered: true, deliveryState: 'accepted' });
    expect(registered.json).not.toHaveProperty('devOtp');
    const message = vi.mocked(sendEmail).mock.calls.at(-1)![1];
    expect(message.to).toBe(email);
    expect(message.text).toMatch(/^\d{6}$/);
    const account = db.query<{ id: string; user_id: string }>('SELECT id, user_id FROM auth_accounts WHERE email = ?', email);
    expect(account).toHaveLength(1);
    const userId = account[0].user_id;
    expect(account[0].id).not.toBe(userId);
    const otpBefore = db.query('SELECT i.id, i.used, i.state FROM auth_otp_issuances i JOIN auth_accounts a ON a.id=i.account_id WHERE a.email=?', email);
    expect(otpBefore).toEqual([{ id: expect.any(String), used: 0, state: 'accepted' }]);
    const before = snapshot();
    const inventoryBefore = snapshot(inventoryTables);
    const attempt = (extra: Record<string, unknown>) =>
      request('/auth/verify-otp', { email, code: message.text, purpose: 'register', newPassword: ACTIVATION_PASSWORD, ...extra }, headers);

    const deferred = await attempt({ migrateFromHouseholdId: SOURCE });
    expect(deferred.response.status).toBe(409);
    expect(deferred.json).toEqual({ error: expect.any(String), code: 'INVENTORY_TRANSFER_DEFERRED', otpKeyIssuedAtMs: expect.any(Number) });
    expect(deferred.response.headers.get('Set-Cookie')).toBeNull();
    expect(snapshot()).toBe(before);
    expect(compare).not.toHaveBeenCalled();

    const continued = await attempt({});
    expect(continued.response.status, JSON.stringify(continued.json)).toBe(200);
    expect(continued.json.success).toBe(true);
    expect(continued.json).not.toHaveProperty('migratedFromHouseholdId');
    expect(continued.json.user).toMatchObject({ id: userId, householdId: `hh_${userId}`, isGuest: false });
    expect(db.query('SELECT used FROM auth_otp_issuances WHERE id = ?', otpBefore[0].id)).toEqual([{ used: 1 }]);
    expect(db.query('SELECT is_verified FROM auth_accounts WHERE email = ?', email)).toEqual([{ is_verified: 1 }]);
    expect(db.query('SELECT * FROM sessions_v2 WHERE user_id = ?', userId)).toHaveLength(1);
    const password = db.query<{ salt: string; password_hash: string }>('SELECT salt, password_hash FROM auth_accounts WHERE email=?', email)[0];
    expect(await verifyPassword(ACTIVATION_PASSWORD, password.salt, password.password_hash)).toBe(true);
    expect(await verifyPassword('original-pending-password', password.salt, password.password_hash)).toBe(false);
    await expectCookiePrincipal(continued.response, userId, `hh_${userId}`);
    expect(snapshot(inventoryTables)).toBe(inventoryBefore);
    expect(db.query('SELECT household_id FROM inventory_items WHERE id = ?', 'source-item')).toEqual([{ household_id: SOURCE }]);
    expect(db.query('SELECT COUNT(*) AS count FROM inventory_items WHERE household_id = ?', `hh_${userId}`)).toEqual([{ count: 0 }]);
    expect((await attempt({})).response.status).toBe(400);
    const afterConsume = snapshot();
    expect((await attempt({ migrateFromHouseholdId: SOURCE })).response.status).toBe(409);
    expect(snapshot()).toBe(afterConsume);
    expect(compare).toHaveBeenCalledTimes(1);
    expect(db.query('SELECT * FROM sessions_v2 WHERE user_id = ?', userId)).toHaveLength(1);
  });

  it('keeps forgot preliminary proof separate from final reset even with a transfer field', async () => {
    await sourceStock('native');
    db.execute("UPDATE auth_accounts SET is_verified = 1 WHERE id = 'pending'");
    const issuanceId = await seedOtp('forgot_password');
    const before = snapshot([...inventoryTables, ...authTables, 'auth_otps']);
    const inventory = snapshot(inventoryTables);
    const { response, json } = await verify({ purpose: 'forgot_password', migrateFromHouseholdId: SOURCE });
    expect(response.status, JSON.stringify(json)).toBe(200);
    expect(json.success).toBe(true);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(json).not.toHaveProperty('migratedFromHouseholdId');
    expect(snapshot([...inventoryTables, ...authTables, 'auth_otps'])).toBe(before);
    expect(db.query('SELECT used FROM auth_otp_issuances WHERE id=?', issuanceId)).toEqual([{ used: 0 }]);
    expect(db.query("SELECT state, weight FROM auth_otp_tickets WHERE operation='reset_preliminary'")).toEqual([{ state: 'proof', weight: 1 }]);
    const resetJwt = await verifyJwt(String(json.resetToken), JWT_SECRET);
    expect(resetJwt.valid).toBe(true);
    expect(resetJwt.payload).toMatchObject({ sub: EMAIL, typ: 'reset', purpose: 'password_reset' });
    const newPassword = 'updated-password-strong';
    const reset = await request('/auth/reset-password', { email: EMAIL, code: CODE, newPassword });
    expect(reset.response.status, JSON.stringify(reset.json)).toBe(200);
    expect(reset.json.success).toBe(true);
    expect(db.query('SELECT used FROM auth_otp_issuances WHERE id=?', issuanceId)).toEqual([{ used: 1 }]);
    expect(db.query("SELECT state, weight FROM auth_otp_tickets WHERE operation='reset_final'")).toEqual([{ state: 'completed', weight: 1 }]);
    expect(compare).toHaveBeenCalledTimes(2);
    const account = db.query<{ salt: string; password_hash: string }>('SELECT salt, password_hash FROM auth_accounts WHERE id = ?', 'pending')[0];
    expect(await verifyPassword(newPassword, account.salt, account.password_hash)).toBe(true);
    await expectCookiePrincipal(reset.response, 'transferuser', TARGET);
    expect(snapshot(inventoryTables)).toBe(inventory);
  });
});
