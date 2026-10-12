import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fetchWorker } from '../helpers/worker-fetch.mjs';
import type { Env } from '../../src/worker/types';
import { ADMIN_PERMISSION_MATRIX, type AdminPermission, type AdminRole } from '../../src/shared/admin';
import { accessOptions, resetAccessJwksCache, verifyAccessAssertion } from '../../src/worker/routes/admin/access';
import { sha256Hex } from '../../src/worker/utils/session';
import { buildAdminFixtureSql, FIXTURE_PASSWORD } from '../../scripts/admin-local-lib.mjs';
import { SqliteD1 } from '../helpers/sqlite-d1';

const DEV_ORIGIN = 'http://127.0.0.1:8790';
const PROD_ORIGIN = 'https://admin.takosan.test';
const SECRET = 'admin-integration-test-secret-0123456789';

// Minimal KV stand-in so limiter counters reset with each test database.
function createPreviewCache() {
  const entries = new Map<string, string>();
  return {
    async get(key: string, type?: string) { const value = entries.get(key); return value === undefined ? null : type === 'json' ? JSON.parse(value) : value; },
    async put(key: string, value: string) { entries.set(key, value); },
    async delete(key: string) { entries.delete(key); },
  };
}

let fixtureSql: string;
let db: SqliteD1;
let env: Env;
let ipCounter = 0;

beforeAll(() => { fixtureSql = buildAdminFixtureSql(); });
beforeEach(() => {
  db = new SqliteD1();
  db.seed(fixtureSql);
  env = devEnv();
});
afterEach(() => { db.close(); delete accessOptions.fetcher; delete accessOptions.now; resetAccessJwksCache(); });

function devEnv(overrides: Partial<Env> = {}): Env {
  return { DB: db, CACHE: createPreviewCache() as never, ENVIRONMENT: 'development', APP_URL: DEV_ORIGIN, JWT_SECRET: SECRET, ...overrides };
}
function prodEnv(overrides: Partial<Env> = {}): Env {
  return { DB: db, CACHE: createPreviewCache() as never, ENVIRONMENT: 'production', APP_URL: PROD_ORIGIN, JWT_SECRET: SECRET,
    OTP_HASH_SECRET: SECRET, QWEN_API_KEY: 'test-only-placeholder', TURNSTILE_SITE_KEY: 'test-site', TURNSTILE_SECRET_KEY: 'test-secret',
    // Placeholders satisfy the existing production config gate; no provider is called.
    SCAN_QUEUE: { send: async () => {}, sendBatch: async () => {} } as never, ...overrides };
}

interface CallOptions { method?: string; session?: Session | null; csrf?: string | null; origin?: string | null; headers?: Record<string, string>; body?: unknown; env?: Env; ip?: string }
interface Session { cookie: string; csrf: string; token: string }

async function call(path: string, options: CallOptions = {}) {
  const runtimeEnv = options.env ?? env;
  const base = runtimeEnv.ENVIRONMENT === 'production' ? PROD_ORIGIN : DEV_ORIGIN;
  const headers = new Headers(options.headers);
  headers.set('CF-Connecting-IP', options.ip ?? `198.51.100.${(ipCounter += 1) % 250}`);
  if (options.origin !== null) headers.set('Origin', options.origin ?? base);
  if (options.session) headers.append('Cookie', options.session.cookie);
  const csrf = options.csrf === undefined ? options.session?.csrf : options.csrf;
  if (csrf) headers.set('X-Admin-CSRF', csrf);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetchWorker(new Request(`${base}${path}`, { method: options.method ?? 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body) }), runtimeEnv);
  const text = await response.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: response.status, json, text, headers: response.headers };
}

async function login(email: string, password = FIXTURE_PASSWORD, options: CallOptions = {}): Promise<Session> {
  const result = await call('/api/v1/admin/auth/login', { method: 'POST', body: { email, password }, ...options });
  expect(result.status, result.text).toBe(200);
  const cookies = result.headers.getSetCookie();
  const token = /__Host-takosan_admin_session=([0-9a-f]{64})/.exec(cookies.join('\n'))![1];
  const csrf = /__Host-takosan_admin_csrf=([0-9a-f]{64})/.exec(cookies.join('\n'))![1];
  expect(result.json.csrfToken).toBe(csrf);
  return { cookie: `__Host-takosan_admin_session=${token}; __Host-takosan_admin_csrf=${csrf}`, csrf, token };
}
const fx = (key: string) => `${key}@fixture.takosan.test`;
const count = (sql: string, ...binds: unknown[]) => db.query<{ n: number }>(sql, ...binds)[0].n;

const READS: Array<[string, AdminPermission]> = [
  ['/api/v1/admin/me', 'admin.self.read'],
  ['/api/v1/admin/overview?range=7d', 'overview.read'],
  ['/api/v1/admin/users', 'users.read'],
  ['/api/v1/admin/users/fx_user_001', 'users.read'],
  ['/api/v1/admin/households', 'households.read'],
  ['/api/v1/admin/billing/summary', 'billing.read'],
  ['/api/v1/admin/billing/transactions', 'billing.read'],
  ['/api/v1/admin/ai/summary', 'ai.read'],
  ['/api/v1/admin/ai/usage', 'ai.read'],
  ['/api/v1/admin/recipes', 'recipes.read'],
  ['/api/v1/admin/recipes/summary', 'recipes.read'],
  ['/api/v1/admin/system/status', 'system.read'],
  ['/api/v1/admin/audit', 'audit.read'],
  ['/api/v1/admin/settings', 'admin.self.read'],
  ['/api/v1/admin/sessions', 'admin.sessions.revoke'],
];
const ROLE_ACCOUNTS: Array<[AdminRole, string]> = [
  ['SUPER_ADMIN', 'super'], ['OPERATIONS_ADMIN', 'ops'], ['CONTENT_EDITOR', 'content'], ['SUPPORT_AGENT', 'support'], ['READ_ONLY_AUDITOR', 'auditor'],
];

describe('admin authentication', () => {
  it('denies anonymous access to every read endpoint', async () => {
    for (const [path] of READS) {
      const result = await call(path);
      expect(result.status, path).toBe(401);
      expect(result.json.code).toBe('ADMIN_UNAUTHENTICATED');
      expect(result.headers.get('Cache-Control')).toBe('no-store');
    }
  });

  it('refuses regular users, household owners, unverified, guest and revoked admins with one generic error', async () => {
    for (const email of [fx('customer001'), fx('owner'), fx('customer009'), fx('revoked'), fx('nobody')]) {
      const result = await call('/api/v1/admin/auth/login', { method: 'POST', body: { email, password: FIXTURE_PASSWORD } });
      expect(result.status, email).toBe(401);
      expect(result.json).toEqual({ error: 'Thông tin đăng nhập không hợp lệ hoặc tài khoản không có quyền quản trị.', code: 'ADMIN_INVALID_CREDENTIALS' });
      expect(result.headers.getSetCookie()).toEqual([]);
    }
    const wrong = await call('/api/v1/admin/auth/login', { method: 'POST', body: { email: fx('super'), password: 'wrong-password' } });
    expect(wrong.json.code).toBe('ADMIN_INVALID_CREDENTIALS');
    expect(count("SELECT COUNT(*) AS n FROM admin_sessions")).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM admin_audit_events WHERE action = 'admin.login' AND outcome = 'failure' AND actor_user_id IS NULL")).toBeGreaterThanOrEqual(4);
    expect(count("SELECT COUNT(*) AS n FROM admin_audit_events WHERE action = 'admin.login' AND reason_code = 'no_admin_role' AND actor_user_id = 'fx_owner'")).toBe(1);
    expect(db.query<{ m: string | null }>("SELECT group_concat(metadata_json) AS m FROM admin_audit_events")[0].m ?? '').not.toContain('fixture.takosan');
  });

  it('household ownership never grants platform admin', async () => {
    expect(count("SELECT COUNT(*) AS n FROM household_members WHERE user_id = 'fx_owner' AND role = 'owner'")).toBe(1);
    expect((await call('/api/v1/admin/auth/login', { method: 'POST', body: { email: fx('owner'), password: FIXTURE_PASSWORD } })).status).toBe(401);
  });

  it('issues hashed, HttpOnly/Strict session cookies and a readable CSRF cookie', async () => {
    const result = await call('/api/v1/admin/auth/login', { method: 'POST', body: { email: fx('super'), password: FIXTURE_PASSWORD } });
    const [session, csrf] = result.headers.getSetCookie();
    expect(session).toMatch(/^__Host-takosan_admin_session=[0-9a-f]{64}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800$/);
    expect(csrf).toMatch(/^__Host-takosan_admin_csrf=[0-9a-f]{64}; Path=\/; Secure; SameSite=Strict; Max-Age=28800$/);
    const token = /=([0-9a-f]{64})/.exec(session)![1];
    const row = db.query<{ token_hash: string; auth_method: string }>('SELECT token_hash, auth_method FROM admin_sessions')[0];
    expect(row).toEqual({ token_hash: await sha256Hex(token), auth_method: 'password' });
    expect(JSON.stringify(db.query('SELECT * FROM admin_sessions'))).not.toContain(token);
  });

  it('rejects login from an untrusted origin', async () => {
    const result = await call('/api/v1/admin/auth/login', { method: 'POST', origin: 'https://evil.example', body: { email: fx('super'), password: FIXTURE_PASSWORD } });
    expect(result.status).toBe(403);
    expect(result.json.code).toBe('ADMIN_CSRF_FAILED');
  });

  it('rate limits login attempts per IP', async () => {
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await call('/api/v1/admin/auth/login', { method: 'POST', ip: '203.0.113.9', body: { email: fx('super'), password: 'nope-nope' } })).status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it('logout revokes the session; the old cookie is refused', async () => {
    const session = await login(fx('super'));
    const out = await call('/api/v1/admin/auth/logout', { method: 'POST', session });
    expect(out.status).toBe(200);
    expect(out.headers.getSetCookie().every((c) => c.includes('Max-Age=0'))).toBe(true);
    const after = await call('/api/v1/admin/me', { session });
    expect(after.status).toBe(401);
    expect(after.json.code).toBe('ADMIN_SESSION_REVOKED');
  });

  it('expires sessions on absolute and idle deadlines', async () => {
    const absolute = await login(fx('super'));
    db.seed(`UPDATE admin_sessions SET expires_at = '2020-01-01T00:00:00.000Z' WHERE token_hash = '${await sha256Hex(absolute.token)}'`);
    expect((await call('/api/v1/admin/me', { session: absolute })).json.code).toBe('ADMIN_SESSION_EXPIRED');
    const idle = await login(fx('super'));
    db.seed(`UPDATE admin_sessions SET idle_expires_at = '2020-01-01T00:00:00.000Z' WHERE token_hash = '${await sha256Hex(idle.token)}'`);
    const result = await call('/api/v1/admin/me', { session: idle });
    expect(result.status).toBe(401);
    expect(result.json.code).toBe('ADMIN_SESSION_EXPIRED');
  });

  it('a revoked role loses access on the next request and its sessions are revoked', async () => {
    const ops = await login(fx('ops'));
    expect((await call('/api/v1/admin/billing/summary', { session: ops })).status).toBe(200);
    const sup = await login(fx('super'));
    expect((await call('/api/v1/admin/roles/fx_ara_ops', { method: 'DELETE', session: sup })).status).toBe(200);
    const after = await call('/api/v1/admin/billing/summary', { session: ops });
    expect(after.status).toBe(401);
    expect(after.json.code).toBe('ADMIN_SESSION_REVOKED');
    expect(count("SELECT COUNT(*) AS n FROM admin_sessions WHERE user_id = 'fx_admin_ops' AND revoked_reason = 'role_revoked'")).toBe(1);
  });

  it('ignores forged identity headers, bearer tokens and customer session cookies', async () => {
    const forged = { 'x-admin-role': 'SUPER_ADMIN', 'x-user-id': 'fx_admin_super', 'X-Frigo-Expected-User-Id': 'fx_admin_super',
      'X-Frigo-Expected-Household-Id': 'hh_fx_admin_super', Authorization: 'Bearer forged.jwt.token', 'Cf-Access-Jwt-Assertion': 'forged.jwt.sig' };
    expect((await call('/api/v1/admin/me', { headers: forged })).json.code).toBe('ADMIN_UNAUTHENTICATED');
    // A valid customer session for a super admin's own user still is not an admin session.
    const customerToken = 'a'.repeat(64);
    db.seed(`INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at) VALUES ('cust_sess', 'fx_admin_super', 'hh_fx_admin_super', '${await sha256Hex(customerToken)}', '2099-01-01T00:00:00.000Z')`);
    const customer = await call('/api/v1/admin/me', { headers: { Cookie: `__Host-frigo_session=${customerToken}` } });
    expect(customer.status).toBe(401);
    expect(customer.json.code).toBe('ADMIN_UNAUTHENTICATED');
    // With a real content-editor session, role headers cannot escalate.
    const content = await login(fx('content'));
    const escalated = await call('/api/v1/admin/billing/summary', { session: content, headers: forged });
    expect(escalated.status).toBe(403);
    expect(escalated.json.code).toBe('ADMIN_FORBIDDEN');
  });
});

describe('server-side RBAC', () => {
  it('every role × read endpoint matches ADMIN_PERMISSION_MATRIX', async () => {
    for (const [role, key] of ROLE_ACCOUNTS) {
      const session = await login(fx(key));
      for (const [path, permission] of READS) {
        const result = await call(path, { session });
        const allowed = ADMIN_PERMISSION_MATRIX[permission].includes(role);
        expect(result.status, `${role} ${path}`).toBe(allowed ? 200 : 403);
        if (!allowed) expect(result.json.code).toBe('ADMIN_FORBIDDEN');
      }
    }
    expect(count("SELECT COUNT(*) AS n FROM admin_audit_events WHERE action = 'admin.permission.denied' AND outcome = 'denied'")).toBeGreaterThan(10);
  });

  it('settings omits assignments for roles without admin.roles.read', async () => {
    const content = await login(fx('content'));
    const result = await call('/api/v1/admin/settings', { session: content });
    expect(result.json.data.assignments).toEqual([]);
    expect(result.json.data.matrix.length).toBeGreaterThan(10);
  });

  it('unauthorized mutations are rejected without writing', async () => {
    const auditor = await login(fx('auditor'));
    const grant = await call('/api/v1/admin/roles', { method: 'POST', session: auditor, body: { userId: 'fx_user_001', role: 'SUPPORT_AGENT' } });
    expect(grant.status).toBe(403);
    expect(count("SELECT COUNT(*) AS n FROM admin_role_assignments WHERE user_id = 'fx_user_001'")).toBe(0);
    const support = await login(fx('support'));
    const recipe = db.query<{ id: string; version: number }>('SELECT id, version FROM recipes ORDER BY id LIMIT 1')[0];
    const review = await call(`/api/v1/admin/recipes/${recipe.id}/reviews`, { method: 'POST', session: support, body: { state: 'approved', note: 'x', recipeVersion: recipe.version } });
    expect(review.status).toBe(403);
    expect(count('SELECT COUNT(*) AS n FROM admin_recipe_editorial_reviews')).toBe(0);
  });

  it('CSRF: missing, wrong, or cross-origin mutations are rejected and audited', async () => {
    const session = await login(fx('super'));
    for (const variant of [{ csrf: null }, { csrf: 'f'.repeat(64) }, { origin: 'https://evil.example' }, { origin: null }] as CallOptions[]) {
      const result = await call('/api/v1/admin/preferences', { method: 'PUT', session, body: { density: 'compact' }, ...variant });
      expect(result.status, JSON.stringify(variant)).toBe(403);
      expect(result.json.code).toBe('ADMIN_CSRF_FAILED');
    }
    expect(count('SELECT COUNT(*) AS n FROM admin_user_preferences')).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM admin_audit_events WHERE action = 'admin.csrf.denied'")).toBe(4);
    const okResult = await call('/api/v1/admin/preferences', { method: 'PUT', session, body: { density: 'compact' } });
    expect(okResult.status).toBe(200);
    expect(okResult.json.data).toEqual({ locale: 'vi', density: 'compact', sidebarCollapsed: false });
  });

  it('prevents self-grant and requires four-eyes approval for SUPER_ADMIN', async () => {
    const sup = await login(fx('super'));
    const self = await call('/api/v1/admin/roles', { method: 'POST', session: sup, body: { userId: 'fx_admin_super', role: 'SUPPORT_AGENT' } });
    expect(self.status).toBe(403);
    const ops = await login(fx('ops'));
    expect((await call('/api/v1/admin/roles', { method: 'POST', session: ops, body: { userId: 'fx_admin_ops', role: 'SUPER_ADMIN' } })).status).toBe(403);

    const request = await call('/api/v1/admin/roles', { method: 'POST', session: sup, body: { userId: 'fx_admin_ops', role: 'SUPER_ADMIN' } });
    expect(request.status).toBe(201);
    const approvalId = request.json.data.approval.id;
    expect(count("SELECT COUNT(*) AS n FROM admin_role_assignments WHERE user_id = 'fx_admin_ops' AND role = 'SUPER_ADMIN'")).toBe(0);
    expect((await call(`/api/v1/admin/approvals/${approvalId}/approve`, { method: 'POST', session: sup })).status).toBe(403);
    expect((await call(`/api/v1/admin/approvals/${approvalId}/approve`, { method: 'POST', session: ops })).status).toBe(403);
    const sup2 = await login(fx('super2'));
    const approved = await call(`/api/v1/admin/approvals/${approvalId}/approve`, { method: 'POST', session: sup2 });
    expect(approved.status).toBe(200);
    expect(db.query("SELECT grant_source, granted_by FROM admin_role_assignments WHERE user_id = 'fx_admin_ops' AND role = 'SUPER_ADMIN'"))
      .toEqual([{ grant_source: 'approval', granted_by: 'fx_admin_super2' }]);
    expect((await call(`/api/v1/admin/approvals/${approvalId}/approve`, { method: 'POST', session: sup2 })).status).toBe(409);
  });

  it('grants and revokes non-super roles with audit rows; never self-revokes', async () => {
    const sup = await login(fx('super'));
    const grant = await call('/api/v1/admin/roles', { method: 'POST', session: sup, body: { userId: 'fx_user_001', role: 'SUPPORT_AGENT' } });
    expect(grant.status).toBe(201);
    expect((await call('/api/v1/admin/roles', { method: 'POST', session: sup, body: { userId: 'fx_user_001', role: 'SUPPORT_AGENT' } })).status).toBe(409);
    expect((await call('/api/v1/admin/roles', { method: 'POST', session: sup, body: { userId: 'fx_guest_1', role: 'SUPPORT_AGENT' } })).status).toBe(404);
    expect((await call('/api/v1/admin/roles/fx_ara_super', { method: 'DELETE', session: sup })).status).toBe(403);
    expect((await call(`/api/v1/admin/roles/${grant.json.data.assignment.id}`, { method: 'DELETE', session: sup })).status).toBe(200);
    expect(db.query("SELECT action, outcome FROM admin_audit_events WHERE action LIKE 'admin.role.%' AND actor_user_id = 'fx_admin_super' AND id NOT LIKE 'fx_%' ORDER BY occurred_at, rowid"))
      .toEqual([
        { action: 'admin.role.grant', outcome: 'success' },
        { action: 'admin.role.revoke', outcome: 'denied' },
        { action: 'admin.role.revoke', outcome: 'success' },
      ]);
  });

  it('the database refuses a grant without a granting admin outside bootstrap', () => {
    expect(() => db.seed("INSERT INTO admin_role_assignments (id, user_id, role, grant_source) VALUES ('ara_bad_0001', 'fx_user_002', 'SUPER_ADMIN', 'admin_grant')")).toThrow();
    expect(() => db.seed("INSERT INTO admin_role_assignments (id, user_id, role, grant_source, granted_by) VALUES ('ara_bad_0002', 'fx_user_002', 'SUPPORT_AGENT', 'admin_grant', 'fx_user_002')")).toThrow();
  });
});

describe('data exposure and validation', () => {
  it('redacts sensitive data by default and audits explicit reveal', async () => {
    const sup = await login(fx('super'));
    const bodies = [];
    for (const path of ['/api/v1/admin/users?pageSize=100', '/api/v1/admin/users/fx_user_001', '/api/v1/admin/billing/transactions?pageSize=100',
      '/api/v1/admin/settings', '/api/v1/admin/sessions', '/api/v1/admin/audit?pageSize=100', '/api/v1/admin/households?pageSize=100']) {
      bodies.push((await call(path, { session: sup })).text);
    }
    const all = bodies.join('\n');
    for (const forbidden of ['password_hash', 'passwordHash', '"salt"', 'token_hash', 'csrf_hash', 'provider_reference', 'instructions', 'google_id', 'image_key', sup.token, '900007919']) {
      expect(all, forbidden).not.toContain(forbidden);
    }
    expect(all).not.toMatch(/customer\d{3}@/);

    const support = await login(fx('support'));
    const revealed = await call('/api/v1/admin/users/fx_user_001?reveal=email', { session: support });
    expect(revealed.json.data).toMatchObject({ email: 'customer001@fixture.takosan.test', emailRevealed: true });
    expect(count("SELECT COUNT(*) AS n FROM admin_audit_events WHERE action = 'users.pii.reveal' AND actor_user_id = 'fx_admin_support' AND target_id = 'fx_user_001'")).toBe(1);
    const ops = await login(fx('ops'));
    const denied = await call('/api/v1/admin/users/fx_user_001?reveal=email', { session: ops });
    expect(denied.status).toBe(403);
    expect(count("SELECT COUNT(*) AS n FROM admin_audit_events WHERE action = 'admin.permission.denied' AND actor_user_id = 'fx_admin_ops'")).toBe(1);
  });

  it('rejects pagination abuse and malformed input', async () => {
    const sup = await login(fx('super'));
    for (const path of ['/api/v1/admin/users?pageSize=101', '/api/v1/admin/users?page=0', '/api/v1/admin/users?page=abc', '/api/v1/admin/users?page=1001',
      `/api/v1/admin/users?q=${'x'.repeat(101)}`, '/api/v1/admin/users?unknown=1', '/api/v1/admin/overview?range=365d', '/api/v1/admin/audit?from=not-a-date',
      '/api/v1/admin/billing/transactions?status=stolen', "/api/v1/admin/users/bad'id"]) {
      const result = await call(path, { session: sup });
      expect(result.status, path).toBe(400);
      expect(result.json.code).toBe('ADMIN_VALIDATION_FAILED');
    }
    const wildcard = await call('/api/v1/admin/users?q=%25', { session: sup });
    expect(wildcard.status).toBe(200);
    expect(wildcard.json.data.total).toBe(0);
    const page = await call('/api/v1/admin/users?page=2&pageSize=10', { session: sup });
    expect(page.json.data).toMatchObject({ page: 2, pageSize: 10, total: 56 });
    expect(page.json.data.items).toHaveLength(10);
  });

  it('labels synthetic data and reports metric sources', async () => {
    const sup = await login(fx('super'));
    const overview = await call('/api/v1/admin/overview?range=30d', { session: sup });
    expect(overview.json.context).toMatchObject({ environment: 'development', fixtureDataset: 'synthetic-admin-v1' });
    for (const metric of overview.json.data.metrics) {
      expect(metric.source).toMatch(/^D1:|^none$/);
      expect(metric.definition.length).toBeGreaterThan(5);
    }
    expect(overview.json.data.series[0].points).toHaveLength(30);
    const ai = await call('/api/v1/admin/ai/summary', { session: sup });
    expect(ai.json.data.instrumentation.aiRequestsWriter).toBe('not_wired');
    expect(ai.json.data.metrics.find((m: { key: string }) => m.key === 'ai_retries')).toMatchObject({ value: null, status: 'unavailable' });
  });

  it('recipe reviews write only the editorial ledger and reject stale versions', async () => {
    const editor = await login(fx('content'));
    const recipe = db.query<Record<string, unknown>>('SELECT * FROM recipes ORDER BY id LIMIT 1')[0];
    const stale = await call(`/api/v1/admin/recipes/${recipe.id}/reviews`, { method: 'POST', session: editor, body: { state: 'in_review', note: 'cũ', recipeVersion: Number(recipe.version) + 1 } });
    expect(stale.status).toBe(409);
    const created = await call(`/api/v1/admin/recipes/${recipe.id}/reviews`, { method: 'POST', session: editor, body: { state: 'approved', note: 'Đã kiểm tra.', recipeVersion: recipe.version } });
    expect(created.status).toBe(201);
    expect(db.query('SELECT * FROM recipes WHERE id = ?', recipe.id)[0]).toEqual(recipe);
    expect(count("SELECT COUNT(*) AS n FROM admin_audit_events WHERE action = 'recipes.review.create' AND actor_user_id = 'fx_admin_content'")).toBe(1);
    const detail = await call(`/api/v1/admin/recipes/${recipe.id}`, { session: editor });
    expect(detail.json.data.editorialReviews[0]).toMatchObject({ state: 'approved', note: 'Đã kiểm tra.' });
    expect(detail.json.data.publication.canPublish).toBe(false);
  });

  it('audit history is append-only at the database layer', async () => {
    await login(fx('super'));
    expect(() => db.seed("UPDATE admin_audit_events SET outcome = 'denied'")).toThrow(/append-only/);
    expect(() => db.seed('DELETE FROM admin_audit_events')).toThrow(/append-only/);
  });

  it('sanitizes internal errors without stack traces', async () => {
    const sup = await login(fx('super'));
    const failing = new Proxy(db, { get(target, prop, receiver) {
      if (prop === 'prepare') return (sql: string) => { if (sql.includes('FROM ai_requests')) throw new Error('secret internal detail'); return target.prepare(sql); };
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    const result = await call('/api/v1/admin/ai/summary', { session: sup, env: devEnv({ DB: failing as never }) });
    expect(result.status).toBe(500);
    expect(result.json).toEqual({ error: 'Đã xảy ra lỗi máy chủ nội bộ', code: 'INTERNAL_SERVER_ERROR' });
  });
});

describe('routing isolation and production fail-closed', () => {
  it('has no bootstrap/provisioning endpoint and never falls through to customer routes', async () => {
    const sup = await login(fx('super'));
    for (const path of ['/api/v1/admin/bootstrap', '/api/v1/admin/provision', '/api/v1/admin/setup']) {
      const result = await call(path, { method: 'POST', session: sup, body: { email: fx('customer001') } });
      expect(result.status, path).toBe(404);
      expect(result.json.code).toBe('ADMIN_NOT_FOUND');
    }
    const anon = await call('/api/v1/admin/bootstrap', { method: 'POST', body: {} });
    expect(anon.json.code).toMatch(/^ADMIN_/);
    // Customer API behavior is unchanged.
    const customer = await call('/api/v1/me');
    expect(customer.status).toBe(401);
    expect(customer.json.code).toBe('UNAUTHORIZED');
  });

  it('production without ADMIN_CONSOLE_ENABLED serves nothing', async () => {
    const env = prodEnv();
    expect((await call('/api/v1/admin/auth/config', { env })).status).toBe(404);
    expect((await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email: fx('super'), password: FIXTURE_PASSWORD } })).status).toBe(404);
    expect((await call('/admin/', { env })).status).toBe(404);
  });

  it('production with the console enabled but no Access configuration fails closed, even with password login requested', async () => {
    const env = prodEnv({ ADMIN_CONSOLE_ENABLED: 'true', ADMIN_PASSWORD_LOGIN_ENABLED: 'true' });
    expect((await call('/api/v1/admin/auth/config', { env })).json.data.mode).toBe('unavailable');
    const loginResult = await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email: fx('super'), password: FIXTURE_PASSWORD } });
    expect(loginResult.status).toBe(503);
    expect(loginResult.json.code).toBe('ADMIN_AUTH_NOT_CONFIGURED');
    expect((await call('/api/v1/admin/me', { env })).json.code).toBe('ADMIN_AUTH_NOT_CONFIGURED');
    // A session minted in development is not usable in production.
    const dev = await login(fx('super'));
    expect((await call('/api/v1/admin/me', { env, session: dev })).status).toBe(503);
  });

  it('ADMIN_HOSTNAME pins both API and documents to the admin host', async () => {
    const pinned = devEnv({ ADMIN_HOSTNAME: 'admin.localhost', ASSETS: fakeAssets() as never });
    expect((await call('/api/v1/admin/auth/config', { env: pinned })).status).toBe(404);
    expect((await call('/admin/users', { env: pinned })).status).toBe(404);
  });

  it('serves the admin document with its own CSP and never caches it', async () => {
    const withAssets = devEnv({ ASSETS: fakeAssets() as never });
    const redirect = await call('/admin', { env: withAssets });
    expect(redirect.status).toBe(302);
    const page = await call('/admin/users/fx_user_001', { env: withAssets });
    expect(page.status).toBe(200);
    expect(page.text).toBe('ADMIN_SHELL');
    expect(page.headers.get('Cache-Control')).toBe('no-store');
    expect(page.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(page.headers.get('Content-Security-Policy')).toContain("script-src 'self';");
    expect(page.headers.get('Content-Security-Policy')).not.toContain('accounts.google.com');
    const customer = await call('/', { env: withAssets });
    expect(customer.headers.get('Content-Security-Policy')).toContain('accounts.google.com');
  });
});

function fakeAssets() {
  return { fetch: async (request: Request) => new Response(new URL(request.url).pathname === '/admin/' ? 'ADMIN_SHELL' : 'CUSTOMER_SHELL', { headers: { 'Content-Type': 'text/html' } }) };
}

describe('Cloudflare Access adapter', () => {
  const TEAM = 'takosan.cloudflareaccess.com';
  const AUD = 'a'.repeat(32);
  let keys: CryptoKeyPair;
  let jwk: JsonWebKey;

  beforeAll(async () => {
    keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
  });
  const b64 = (value: object | Uint8Array) => Buffer.from(value instanceof Uint8Array ? value : JSON.stringify(value)).toString('base64url');
  async function sign(payload: Record<string, unknown>, key: CryptoKey = keys.privateKey) {
    const head = b64({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
    const body = b64(payload);
    const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`)));
    return `${head}.${body}.${b64(signature)}`;
  }
  const now = () => Math.floor(Date.now() / 1000);
  const claims = (overrides: Record<string, unknown> = {}) => ({ aud: [AUD], iss: `https://${TEAM}`, exp: now() + 300, nbf: now() - 10, email: fx('super'), ...overrides });
  const config = { ADMIN_ACCESS_TEAM_DOMAIN: TEAM, ADMIN_ACCESS_AUD: AUD };
  function installJwks() {
    accessOptions.fetcher = async (url: string) => {
      expect(url).toBe(`https://${TEAM}/cdn-cgi/access/certs`);
      return Response.json({ keys: [{ ...jwk, kid: 'k1' }] });
    };
  }

  it('verifies signature, audience, issuer and expiry', async () => {
    installJwks();
    const options = { fetcher: accessOptions.fetcher };
    expect(await verifyAccessAssertion(await sign(claims()), config, options)).toEqual({ ok: true, email: fx('super') });
    expect(await verifyAccessAssertion(await sign(claims({ aud: ['other-audience-value-000000'] })), config, options)).toEqual({ ok: false, reason: 'wrong_audience' });
    expect(await verifyAccessAssertion(await sign(claims({ iss: 'https://evil.cloudflareaccess.com' })), config, options)).toEqual({ ok: false, reason: 'wrong_issuer' });
    expect(await verifyAccessAssertion(await sign(claims({ exp: now() - 1 })), config, options)).toEqual({ ok: false, reason: 'expired' });
    const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    expect(await verifyAccessAssertion(await sign(claims(), other.privateKey), config, options)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(await verifyAccessAssertion(undefined, config, options)).toEqual({ ok: false, reason: 'missing_assertion' });
    expect(await verifyAccessAssertion(await sign(claims()), { ADMIN_ACCESS_TEAM_DOMAIN: TEAM }, options)).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('production Access mode requires a valid assertion on login and on every request', async () => {
    installJwks();
    const env = prodEnv({ ADMIN_CONSOLE_ENABLED: 'true', ADMIN_AUTH_MODE: 'cloudflare_access', ...config });
    expect((await call('/api/v1/admin/auth/config', { env })).json.data.mode).toBe('cloudflare_access');
    const missing = await call('/api/v1/admin/auth/login', { env, method: 'POST' });
    expect(missing.status).toBe(401);
    expect(missing.json.code).toBe('ADMIN_ACCESS_DENIED');
    const assertion = await sign(claims());
    const session = await login(fx('super'), FIXTURE_PASSWORD, { env, headers: { 'Cf-Access-Jwt-Assertion': assertion } });
    expect((await call('/api/v1/admin/me', { env, session })).json.code).toBe('ADMIN_ACCESS_DENIED');
    expect((await call('/api/v1/admin/me', { env, session, headers: { 'Cf-Access-Jwt-Assertion': assertion } })).status).toBe(200);
    const otherIdentity = await sign(claims({ email: fx('ops') }));
    expect((await call('/api/v1/admin/me', { env, session, headers: { 'Cf-Access-Jwt-Assertion': otherIdentity } })).json.code).toBe('ADMIN_ACCESS_DENIED');
    // Access identity without a platform role is refused.
    const owner = await sign(claims({ email: fx('owner') }));
    expect((await call('/api/v1/admin/auth/login', { env, method: 'POST', headers: { 'Cf-Access-Jwt-Assertion': owner } })).json.code).toBe('ADMIN_INVALID_CREDENTIALS');
  });
});
