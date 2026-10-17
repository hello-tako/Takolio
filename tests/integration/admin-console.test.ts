import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_PERMISSION_MATRIX, type AdminPermission, type AdminRole } from '../../src/shared/admin';
import { sha256Hex } from '../../src/worker/utils/session';
import {
  call, closeDatabases, count, createDatabases, fx, localEnv, login, PASSWORD, setLocalAuthBuild, type Databases,
} from '../helpers/admin-harness';
import { createCustomerReadFacade } from '../../src/worker/facade/customer-read-service';
import type { AdminEnv } from '../../src/worker/routes/admin/env';

let dbs: Databases;
let env: AdminEnv;

beforeAll(() => setLocalAuthBuild(true));
afterAll(() => setLocalAuthBuild(false));
beforeEach(() => { dbs = createDatabases(); env = localEnv(dbs); });
afterEach(() => closeDatabases(dbs));

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
  it('denies anonymous access to every read endpoint with no-store', async () => {
    for (const [path] of READS) {
      const result = await call(path, { env });
      expect(result.status, path).toBe(401);
      expect(result.json.code).toBe('ADMIN_UNAUTHENTICATED');
      expect(result.headers.get('Cache-Control')).toBe('no-store');
    }
  });

  it('refuses regular users, household owners, unverified, revoked and unknown accounts with one generic error', async () => {
    for (const email of [fx('customer001'), fx('owner'), fx('customer009'), fx('revoked'), fx('nobody')]) {
      const result = await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email, password: PASSWORD } });
      expect(result.status, email).toBe(401);
      expect(result.json).toEqual({ error: 'Thông tin đăng nhập không hợp lệ hoặc tài khoản không có quyền quản trị.', code: 'ADMIN_INVALID_CREDENTIALS' });
      expect(result.headers.getSetCookie()).toEqual([]);
    }
    expect((await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email: fx('super'), password: 'wrong-password' } })).json.code).toBe('ADMIN_INVALID_CREDENTIALS');
    expect(count(dbs.admin, 'SELECT COUNT(*) AS n FROM admin_sessions')).toBe(0);
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_audit_events WHERE action = 'admin.login' AND reason_code = 'no_admin_role' AND actor_user_id = 'fx_owner'")).toBe(1);
    expect(dbs.admin.query<{ m: string | null }>('SELECT group_concat(metadata_json) AS m FROM admin_audit_events')[0].m ?? '').not.toContain('fixture.takosan');
  });

  it('issues one host-only HttpOnly Strict session cookie, no CSRF cookie, and a session-derived CSRF token', async () => {
    const result = await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email: fx('super'), password: PASSWORD } });
    const cookies = result.headers.getSetCookie();
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(/^__Host-takosan_admin_session=[0-9a-f]{64}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800$/);
    expect(cookies[0]).not.toMatch(/Domain=/i);
    const token = /=([0-9a-f]{64})/.exec(cookies[0])![1];
    expect(result.json.csrfToken).toBe(await sha256Hex(`takosan-admin-csrf:v1:${token}`));
    expect(result.json.data.csrfToken).toBe(result.json.csrfToken);
    const row = dbs.admin.query<{ token_hash: string; credential_fingerprint: string }>('SELECT token_hash, credential_fingerprint FROM admin_sessions')[0];
    expect(row.token_hash).toBe(await sha256Hex(token));
    expect(row.credential_fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(dbs.admin.query('SELECT * FROM admin_sessions'))).not.toContain(token);
  });

  it('logout revokes the session and the old cookie is refused', async () => {
    const session = await login(env, fx('super'));
    const out = await call('/api/v1/admin/auth/logout', { env, method: 'POST', session });
    expect(out.status).toBe(200);
    expect(out.headers.getSetCookie()[0]).toContain('Max-Age=0');
    const after = await call('/api/v1/admin/me', { env, session });
    expect(after.json.code).toBe('ADMIN_SESSION_REVOKED');
  });

  it('expires sessions on absolute and idle deadlines', async () => {
    const absolute = await login(env, fx('super'));
    dbs.admin.seed(`UPDATE admin_sessions SET expires_at = '2020-01-01T00:00:00.000Z' WHERE token_hash = '${await sha256Hex(absolute.token)}'`);
    expect((await call('/api/v1/admin/me', { env, session: absolute })).json.code).toBe('ADMIN_SESSION_EXPIRED');
    const idle = await login(env, fx('super'));
    dbs.admin.seed(`UPDATE admin_sessions SET idle_expires_at = '2020-01-01T00:00:00.000Z' WHERE token_hash = '${await sha256Hex(idle.token)}'`);
    expect((await call('/api/v1/admin/me', { env, session: idle })).json.code).toBe('ADMIN_SESSION_EXPIRED');
  });

  it('a revoked role loses access on the next request and its sessions are revoked', async () => {
    const ops = await login(env, fx('ops'));
    expect((await call('/api/v1/admin/billing/summary', { env, session: ops })).status).toBe(200);
    const sup = await login(env, fx('super'));
    expect((await call('/api/v1/admin/roles/fx_ara_ops', { env, method: 'DELETE', session: sup })).status).toBe(200);
    const after = await call('/api/v1/admin/billing/summary', { env, session: ops });
    expect(after.status).toBe(401);
    expect(after.json.code).toBe('ADMIN_SESSION_REVOKED');
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_sessions WHERE user_id = 'fx_admin_ops' AND revoked_reason = 'role_changed'")).toBe(1);
  });

  it('ignores forged identity headers, bearer tokens and customer session cookies', async () => {
    const forged = { 'x-admin-role': 'SUPER_ADMIN', 'x-user-id': 'fx_admin_super', 'X-Frigo-Expected-User-Id': 'fx_admin_super',
      Authorization: 'Bearer forged.jwt.token', 'Cf-Access-Jwt-Assertion': 'forged.jwt.sig', 'X-Forwarded-Host': 'admin.takosan.test' };
    expect((await call('/api/v1/admin/me', { env, headers: forged })).json.code).toBe('ADMIN_UNAUTHENTICATED');
    const customerToken = 'a'.repeat(64);
    dbs.main.seed(`INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at) VALUES ('cust_sess', 'fx_admin_super', 'hh_fx_admin_super', '${await sha256Hex(customerToken)}', '2099-01-01T00:00:00.000Z')`);
    expect((await call('/api/v1/admin/me', { env, headers: { Cookie: `__Host-frigo_session=${customerToken}` } })).json.code).toBe('ADMIN_UNAUTHENTICATED');
    const content = await login(env, fx('content'));
    const escalated = await call('/api/v1/admin/billing/summary', { env, session: content, headers: forged });
    expect(escalated.status).toBe(403);
    expect(escalated.json.code).toBe('ADMIN_FORBIDDEN');
  });
});

describe('server-side RBAC', () => {
  it('every role × read endpoint matches ADMIN_PERMISSION_MATRIX', async () => {
    for (const [role, key] of ROLE_ACCOUNTS) {
      const session = await login(env, fx(key));
      for (const [path, permission] of READS) {
        const result = await call(path, { env, session });
        const allowed = ADMIN_PERMISSION_MATRIX[permission].includes(role);
        expect(result.status, `${role} ${path}`).toBe(allowed ? 200 : 403);
        if (!allowed) expect(result.json.code).toBe('ADMIN_FORBIDDEN');
      }
    }
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_audit_events WHERE action = 'admin.permission.denied'")).toBeGreaterThan(10);
  });

  it('settings omits role assignments for roles without admin.roles.read', async () => {
    const result = await call('/api/v1/admin/settings', { env, session: await login(env, fx('content')) });
    expect(result.json.data.assignments).toEqual([]);
    expect(result.json.data.approvals).toEqual([]);
  });

  it('unauthorized mutations are rejected without writing', async () => {
    const auditor = await login(env, fx('auditor'));
    expect((await call('/api/v1/admin/roles', { env, method: 'POST', session: auditor, body: { userId: 'fx_user_001', role: 'SUPPORT_AGENT' } })).status).toBe(403);
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_role_assignments WHERE user_id = 'fx_user_001'")).toBe(0);
    const support = await login(env, fx('support'));
    const recipe = dbs.main.query<{ id: string; version: number }>('SELECT id, version FROM recipes ORDER BY id LIMIT 1')[0];
    expect((await call(`/api/v1/admin/recipes/${recipe.id}/reviews`, { env, method: 'POST', session: support, body: { state: 'approved', note: 'x', recipeVersion: recipe.version } })).status).toBe(403);
    expect(count(dbs.admin, 'SELECT COUNT(*) AS n FROM admin_recipe_editorial_reviews')).toBe(0);
  });
});

describe('data exposure and validation', () => {
  it('redacts sensitive data by default', async () => {
    const sup = await login(env, fx('super'));
    const bodies = [];
    for (const path of ['/api/v1/admin/users?pageSize=100', '/api/v1/admin/users/fx_user_001', '/api/v1/admin/billing/transactions?pageSize=100',
      '/api/v1/admin/settings', '/api/v1/admin/sessions', '/api/v1/admin/audit?pageSize=100', '/api/v1/admin/households?pageSize=100']) {
      bodies.push((await call(path, { env, session: sup })).text);
    }
    const all = bodies.join('\n');
    for (const forbidden of ['password_hash', 'passwordHash', '"salt"', 'token_hash', 'credential_fingerprint', 'provider_reference', 'instructions', 'google_id', 'image_key', sup.token, '900007919']) {
      expect(all, forbidden).not.toContain(forbidden);
    }
    expect(all).not.toMatch(/customer\d{3}@/);
  });

  it('email reveal needs users.pii.reveal, is audited before disclosure, and email search is PII-gated', async () => {
    const support = await login(env, fx('support'));
    const revealed = await call('/api/v1/admin/users/fx_user_001?reveal=email', { env, session: support });
    expect(revealed.json.data).toMatchObject({ email: 'customer001@fixture.takosan.test', emailRevealed: true });
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_audit_events WHERE action = 'users.pii.reveal' AND actor_user_id = 'fx_admin_support' AND target_id = 'fx_user_001'")).toBe(1);
    const ops = await login(env, fx('ops'));
    expect((await call('/api/v1/admin/users/fx_user_001?reveal=email', { env, session: ops })).status).toBe(403);
    // Without users.pii.reveal an exact email matches nothing (no existence oracle).
    const opsSearch = await call('/api/v1/admin/users?q=customer001%40fixture.takosan.test', { env, session: ops });
    expect(opsSearch.json.data.total).toBe(0);
    const supportSearch = await call('/api/v1/admin/users?q=customer001%40fixture.takosan.test', { env, session: support });
    expect(supportSearch.json.data.total).toBe(1);
    expect(supportSearch.text).not.toContain('customer001@');
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_audit_events WHERE action = 'users.search' AND actor_user_id = 'fx_admin_support'")).toBe(1);
  });

  it('rejects pagination abuse and malformed input', async () => {
    const sup = await login(env, fx('super'));
    for (const path of ['/api/v1/admin/users?pageSize=101', '/api/v1/admin/users?page=0', '/api/v1/admin/users?page=abc', '/api/v1/admin/users?page=1001',
      `/api/v1/admin/users?q=${'x'.repeat(101)}`, '/api/v1/admin/users?unknown=1', '/api/v1/admin/overview?range=365d', '/api/v1/admin/audit?from=not-a-date',
      '/api/v1/admin/billing/transactions?status=stolen', "/api/v1/admin/users/bad'id"]) {
      const result = await call(path, { env, session: sup });
      expect(result.status, path).toBe(400);
      expect(result.json.code).toBe('ADMIN_VALIDATION_FAILED');
    }
    expect((await call('/api/v1/admin/users?q=%25', { env, session: sup })).json.data.total).toBe(0);
    const page = await call('/api/v1/admin/users?page=2&pageSize=10', { env, session: sup });
    expect(page.json.data).toMatchObject({ page: 2, pageSize: 10, total: 57 });
    expect(page.json.data.items).toHaveLength(10);
  });

  it('labels synthetic data and reports metric sources', async () => {
    const sup = await login(env, fx('super'));
    const overview = await call('/api/v1/admin/overview?range=30d', { env, session: sup });
    expect(overview.json.context).toMatchObject({ environment: 'development', fixtureDataset: 'synthetic-admin-v1' });
    for (const metric of overview.json.data.metrics) expect(metric.source).toMatch(/^D1:|^none$/);
    expect(overview.json.data.series[0].points).toHaveLength(30);
    const ai = await call('/api/v1/admin/ai/summary', { env, session: sup });
    expect(ai.json.data.instrumentation.aiRequestsWriter).toBe('not_wired');
    expect(ai.json.data.metrics.find((m: { key: string }) => m.key === 'ai_retries')).toMatchObject({ value: null, status: 'unavailable' });
  });

  it('recipe reviews write only the admin ledger and reject stale versions', async () => {
    const editor = await login(env, fx('content'));
    const recipe = dbs.main.query<Record<string, unknown>>('SELECT * FROM recipes ORDER BY id LIMIT 1')[0];
    expect((await call(`/api/v1/admin/recipes/${recipe.id}/reviews`, { env, method: 'POST', session: editor, body: { state: 'in_review', note: 'cũ', recipeVersion: Number(recipe.version) + 1 } })).status).toBe(409);
    expect((await call(`/api/v1/admin/recipes/${recipe.id}/reviews`, { env, method: 'POST', session: editor, body: { state: 'approved', note: 'Đã kiểm tra.', recipeVersion: recipe.version } })).status).toBe(201);
    expect(dbs.main.query('SELECT * FROM recipes WHERE id = ?', recipe.id)[0]).toEqual(recipe);
    const detail = await call(`/api/v1/admin/recipes/${recipe.id}`, { env, session: editor });
    expect(detail.json.data.editorialReviews[0]).toMatchObject({ state: 'approved', note: 'Đã kiểm tra.' });
    expect(detail.json.data.latestEditorialState).toBe('approved');
    const list = await call(`/api/v1/admin/recipes?q=${encodeURIComponent(String(recipe.id))}`, { env, session: editor });
    expect(list.json.data.items[0].latestEditorialState).toBe('approved');
  });

  it('audit history is append-only at the database layer', async () => {
    await login(env, fx('super'));
    expect(() => dbs.admin.seed("UPDATE admin_audit_events SET outcome = 'denied'")).toThrow(/append-only/);
    expect(() => dbs.admin.seed('DELETE FROM admin_audit_events')).toThrow(/append-only/);
  });

  it('sanitizes internal errors without stack traces', async () => {
    const sup = await login(env, fx('super'));
    const failing = new Proxy(dbs.main, { get(target, prop, receiver) {
      if (prop === 'prepare') return (query: string) => { if (query.includes('FROM ai_requests')) throw new Error('secret internal detail'); return target.prepare(query); };
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    const result = await call('/api/v1/admin/ai/summary', { env: { ...env, CUSTOMER_READ: createCustomerReadFacade(failing, { secret: 'local-facade-fixture-secret-32-characters' }) }, session: sup });
    expect(result.status).toBe(500);
    expect(result.json).toEqual({ error: 'Đã xảy ra lỗi máy chủ nội bộ', code: 'INTERNAL_SERVER_ERROR' });
  });
});

describe('admin documents and routing', () => {
  function fakeAssets() {
    const files: Record<string, string> = { '/admin/': '<div id="admin-root"></div>', '/admin/assets/admin-abc123.js': 'console.log(1)', '/admin/favicon.svg': '<svg/>' };
    return { fetch: async (request: Request | string) => {
      const pathname = new URL(typeof request === 'string' ? request : request.url).pathname;
      return pathname in files ? new Response(files[pathname], { headers: { 'Content-Type': pathname.endsWith('.js') ? 'text/javascript' : 'text/html' } }) : new Response('nf', { status: 404 });
    } };
  }

  it('has no bootstrap/provisioning endpoint', async () => {
    const sup = await login(env, fx('super'));
    for (const path of ['/api/v1/admin/bootstrap', '/api/v1/admin/provision', '/api/v1/admin/setup']) {
      const result = await call(path, { env, method: 'POST', session: sup, body: { email: fx('customer001') } });
      expect(result.status, path).toBe(404);
    }
  });

  it('serves the shell for /admin routes with the admin CSP, allow-listed files only, and never caches', async () => {
    const withAssets = { ...env, ASSETS: fakeAssets() as never };
    expect((await call('/admin', { env: withAssets })).status).toBe(302);
    expect((await call('/', { env: withAssets })).status).toBe(302);
    expect((await call('/admin/index.html', { env: withAssets })).status).toBe(302);
    for (const path of ['/admin/', '/admin/users', '/admin/users/fx_user_001', '/admin/recipes/vn-canh-01/']) {
      const page = await call(path, { env: withAssets });
      expect(page.status, path).toBe(200);
      expect(page.text).toContain('admin-root');
      expect(page.headers.get('Cache-Control')).toBe('no-store');
      expect(page.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
      expect(page.headers.get('Content-Security-Policy')).toContain("script-src 'self';");
      expect(page.headers.get('Content-Security-Policy')).not.toMatch(/accounts\.google\.com|challenges\.cloudflare\.com/);
    }
    expect((await call('/admin/assets/admin-abc123.js', { env: withAssets })).status).toBe(200);
    for (const path of ['/admin/assets/missing.js', '/admin/assets/..%2F..%2Findex.html', '/admin/%61ssets/admin-abc123.js', '/admin/assets/admin-abc123.js.map',
      '/assets/admin-abc123.js', '/admin/../index.html', '/sw.js', '/manifest.json', '/api/v1/me']) {
      const result = await call(path, { env: withAssets });
      expect(result.status, path).toBe(404);
      expect(result.text).not.toContain('admin-root');
    }
  });
});
