import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { AdminEnv } from '../../src/worker/routes/admin/env';
import { resolveAdminPolicy } from '../../src/worker/routes/admin/policy';
import { assertReadOnlySql, readOnlyDatabase } from '../../src/worker/routes/admin/readonly-db';
import { accessOptions, resetAccessJwksCache, verifyAccessAssertion } from '../../src/worker/routes/admin/access';
import { buildBootstrapAdminSql } from '../../scripts/admin-local-lib.mjs';
import { fetchWorker } from '../helpers/worker-fetch.mjs';
import {
  ACCESS_AUD, ACCESS_TEAM, call, closeDatabases, count, createDatabases, CUSTOMER_URL, fx, LOCAL_ORIGIN, localEnv, login, PASSWORD,
  PROD_ORIGIN, productionEnv, setLocalAuthBuild, type Databases, type Session,
} from '../helpers/admin-harness';

let dbs: Databases;
let env: AdminEnv;
beforeAll(() => setLocalAuthBuild(true));
afterAll(() => setLocalAuthBuild(false));
beforeEach(() => { setLocalAuthBuild(true); dbs = createDatabases(); env = localEnv(dbs); });
afterEach(() => { closeDatabases(dbs); delete accessOptions.fetcher; delete accessOptions.now; resetAccessJwksCache(); });

describe('S1 environment decision matrix (fail closed)', () => {
  const local = { ENVIRONMENT: 'development', ADMIN_CONSOLE_ENABLED: 'true', ADMIN_ORIGIN: LOCAL_ORIGIN, ADMIN_AUTH_MODE: 'password' };
  const prod = { ENVIRONMENT: 'production', ADMIN_CONSOLE_ENABLED: 'true', ADMIN_ORIGIN: PROD_ORIGIN, CUSTOMER_APP_URL: CUSTOMER_URL,
    ADMIN_AUTH_MODE: 'cloudflare_access', ADMIN_ACCESS_TEAM_DOMAIN: ACCESS_TEAM, ADMIN_ACCESS_AUD: ACCESS_AUD };
  const cases: Array<[string, Partial<AdminEnv>, boolean, { enabled: boolean; reason: string; authMode: string }]> = [
    ['ENVIRONMENT missing', { ...local, ENVIRONMENT: undefined }, true, { enabled: false, reason: 'environment_invalid', authMode: 'unavailable' }],
    ['ENVIRONMENT empty', { ...local, ENVIRONMENT: '' }, true, { enabled: false, reason: 'environment_invalid', authMode: 'unavailable' }],
    ['ENVIRONMENT wrong case', { ...prod, ENVIRONMENT: 'Production' }, true, { enabled: false, reason: 'environment_invalid', authMode: 'unavailable' }],
    ['ENVIRONMENT padded', { ...prod, ENVIRONMENT: ' production' }, true, { enabled: false, reason: 'environment_invalid', authMode: 'unavailable' }],
    ['ENVIRONMENT unknown', { ...local, ENVIRONMENT: 'dev' }, true, { enabled: false, reason: 'environment_invalid', authMode: 'unavailable' }],
    ['console flag missing', { ...local, ADMIN_CONSOLE_ENABLED: undefined }, true, { enabled: false, reason: 'console_disabled', authMode: 'unavailable' }],
    ['console flag TRUE', { ...local, ADMIN_CONSOLE_ENABLED: 'TRUE' }, true, { enabled: false, reason: 'console_disabled', authMode: 'unavailable' }],
    ['console flag 1', { ...prod, ADMIN_CONSOLE_ENABLED: '1' }, true, { enabled: false, reason: 'console_disabled', authMode: 'unavailable' }],
    ['production flag OFF', { ...prod, ADMIN_CONSOLE_ENABLED: 'false' }, true, { enabled: false, reason: 'console_disabled', authMode: 'unavailable' }],
    ['origin missing', { ...local, ADMIN_ORIGIN: undefined }, true, { enabled: false, reason: 'origin_invalid', authMode: 'unavailable' }],
    ['origin trailing slash', { ...local, ADMIN_ORIGIN: `${LOCAL_ORIGIN}/` }, true, { enabled: false, reason: 'origin_invalid', authMode: 'unavailable' }],
    ['origin wildcard', { ...prod, ADMIN_ORIGIN: 'https://*.takosan.test' }, true, { enabled: false, reason: 'origin_invalid', authMode: 'unavailable' }],
    ['origin with credentials', { ...local, ADMIN_ORIGIN: 'http://u:p@127.0.0.1:8790' }, true, { enabled: false, reason: 'origin_invalid', authMode: 'unavailable' }],
    ['development on a public host', { ...local, ADMIN_ORIGIN: 'https://admin.example.com' }, true, { enabled: false, reason: 'origin_not_local', authMode: 'unavailable' }],
    ['development loopback, local build', local, true, { enabled: true, reason: 'ok', authMode: 'password' }],
    ['development loopback, production build', local, false, { enabled: true, reason: 'auth_unavailable', authMode: 'unavailable' }],
    ['test loopback, local build', { ...local, ENVIRONMENT: 'test' }, true, { enabled: true, reason: 'ok', authMode: 'password' }],
    ['staging password even in a local build', { ...prod, ENVIRONMENT: 'staging', ADMIN_AUTH_MODE: 'password' }, true, { enabled: true, reason: 'auth_unavailable', authMode: 'unavailable' }],
    ['production password', { ...prod, ADMIN_AUTH_MODE: 'password' }, true, { enabled: true, reason: 'auth_unavailable', authMode: 'unavailable' }],
    ['staging over http', { ...prod, ENVIRONMENT: 'staging', ADMIN_ORIGIN: 'http://admin.takosan.test' }, true, { enabled: false, reason: 'origin_not_public_https', authMode: 'unavailable' }],
    ['production on loopback', { ...prod, ADMIN_ORIGIN: 'https://localhost' }, true, { enabled: false, reason: 'origin_not_public_https', authMode: 'unavailable' }],
    ['production without customer URL', { ...prod, CUSTOMER_APP_URL: undefined }, true, { enabled: false, reason: 'customer_origin_missing', authMode: 'unavailable' }],
    ['production sharing the customer host', { ...prod, ADMIN_ORIGIN: CUSTOMER_URL }, true, { enabled: false, reason: 'origin_shared_with_customer', authMode: 'unavailable' }],
    ['production Access configured', prod, false, { enabled: true, reason: 'ok', authMode: 'cloudflare_access' }],
    ['production Access bad team domain', { ...prod, ADMIN_ACCESS_TEAM_DOMAIN: 'evil.example.com' }, false, { enabled: true, reason: 'auth_unavailable', authMode: 'unavailable' }],
    ['production auth mode missing', { ...prod, ADMIN_AUTH_MODE: undefined }, false, { enabled: true, reason: 'auth_unavailable', authMode: 'unavailable' }],
  ];
  it.each(cases)('%s', (_name, config, localBuild, expected) => {
    setLocalAuthBuild(localBuild);
    expect(resolveAdminPolicy(config as AdminEnv)).toMatchObject(expected);
  });

  it('missing, empty or wrong-case ENVIRONMENT exposes nothing over HTTP, whatever the request says', async () => {
    for (const ENVIRONMENT of [undefined, '', 'Development', 'staging ']) {
      const misconfigured = localEnv(dbs, { ENVIRONMENT });
      for (const path of ['/admin/', '/api/v1/admin/auth/config?environment=development', '/api/v1/admin/me']) {
        const result = await call(path, { env: misconfigured, headers: { 'X-Environment': 'development', 'X-Admin-Mode': 'password' } });
        expect(result.status, `${ENVIRONMENT} ${path}`).toBe(404);
        expect(result.text).toBe('Not Found');
      }
      expect((await call('/api/v1/admin/auth/login', { env: misconfigured, method: 'POST', body: { email: fx('super'), password: PASSWORD } })).status).toBe(404);
    }
  });

  it('a production build (no local define) never offers password login, even with ENVIRONMENT=development', async () => {
    setLocalAuthBuild(false);
    expect((await call('/api/v1/admin/auth/config', { env })).json).toEqual({ data: { mode: 'unavailable' } });
    const result = await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email: fx('super'), password: PASSWORD } });
    expect(result.status).toBe(503);
    expect(result.json.code).toBe('ADMIN_AUTH_NOT_CONFIGURED');
  });

  it('the public auth config discloses only the mode', async () => {
    expect((await call('/api/v1/admin/auth/config', { env })).json).toEqual({ data: { mode: 'password' } });
  });
});

describe('S2/S3 surface gate, origin, CSRF and cookies', () => {
  function assets() {
    return { fetch: async (request: Request) => new URL(request.url).pathname === '/admin/' ? new Response('<div id="admin-root"></div>') : new Response('<svg/>') };
  }

  it('ADMIN_CONSOLE_ENABLED=false makes every admin path 404 (documents, deep links, assets, API)', async () => {
    const off = localEnv(dbs, { ADMIN_CONSOLE_ENABLED: 'false', ASSETS: assets() as never });
    for (const path of ['/', '/admin', '/admin/', '/admin/index.html', '/admin/users', '/admin/assets/admin-abc.js', '/admin/favicon.svg',
      '/%61dmin/', '/api/v1/admin/auth/config', '/api/v1/admin/me']) {
      for (const navigate of [true, false]) {
        const result = await call(path, { env: off, headers: navigate ? { 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' } : {} });
        expect(result.status, path).toBe(404);
        expect(result.text).not.toContain('admin-root');
        expect(result.headers.get('Cache-Control')).toBe('no-store');
      }
    }
  });

  it('a request for any other host (forged Host or forwarding headers) is 404', async () => {
    const enabled = localEnv(dbs, { ASSETS: assets() as never });
    for (const base of ['http://localhost:8790', 'http://127.0.0.1:8791', 'https://127.0.0.1:8790', CUSTOMER_URL]) {
      expect((await call('/admin/', { env: enabled, base, headers: { 'X-Forwarded-Host': '127.0.0.1:8790', Host: '127.0.0.1:8790' } })).status, base).toBe(404);
    }
    expect((await call('/admin/', { env: enabled })).status).toBe(200);
  });

  it('the customer origin, a third-party origin or a missing Origin cannot log in', async () => {
    for (const origin of [CUSTOMER_URL, 'http://127.0.0.1:8787', 'https://evil.example', 'null', null]) {
      const result = await call('/api/v1/admin/auth/login', { env, method: 'POST', origin, body: { email: fx('super'), password: PASSWORD } });
      expect(result.status, String(origin)).toBe(403);
      expect(result.json.code).toBe('ADMIN_CSRF_FAILED');
    }
    expect((await call('/api/v1/admin/auth/login', { env, method: 'POST', headers: { 'Sec-Fetch-Site': 'cross-site' }, body: { email: fx('super'), password: PASSWORD } })).status).toBe(403);
  });

  it('mutations need the exact admin Origin, same-origin fetch metadata and the session-derived token', async () => {
    const session = await login(env, fx('super'));
    const variants: Array<[string, Partial<Parameters<typeof call>[1]>]> = [
      ['missing token', { csrf: null }],
      ['malformed token', { csrf: 'not-hex' }],
      ['wrong token', { csrf: 'f'.repeat(64) }],
      ['token of another session', { csrf: (await login(env, fx('super2'))).csrf }],
      ['customer origin', { origin: CUSTOMER_URL }],
      ['third-party origin', { origin: 'https://evil.example' }],
      ['missing Origin', { origin: null }],
      ['cross-site fetch metadata', { headers: { 'Sec-Fetch-Site': 'cross-site' } }],
    ];
    for (const [name, variant] of variants) {
      const result = await call('/api/v1/admin/preferences', { env, method: 'PUT', session, body: { density: 'compact' }, ...variant });
      expect(result.status, name).toBe(403);
      expect(result.json.code).toBe('ADMIN_CSRF_FAILED');
    }
    expect(count(dbs.admin, 'SELECT COUNT(*) AS n FROM admin_user_preferences')).toBe(0);
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_audit_events WHERE action = 'admin.csrf.denied'")).toBe(variants.length);
    const me = await call('/api/v1/admin/me', { env, session });
    expect(me.json.data.csrfToken).toBe(session.csrf);
    expect((await call('/api/v1/admin/preferences', { env, method: 'PUT', session, body: { density: 'compact' }, headers: { 'Sec-Fetch-Site': 'same-origin' } })).status).toBe(200);
  });

  it('sends no CORS headers, even for a credentialed cross-origin preflight', async () => {
    const session = await login(env, fx('super'));
    for (const method of ['OPTIONS', 'GET']) {
      const result = await call('/api/v1/admin/me', { env, method, session, origin: CUSTOMER_URL,
        headers: { 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'x-admin-csrf' } });
      expect([...result.headers.keys()].filter((key) => key.startsWith('access-control-'))).toEqual([]);
    }
  });
});

describe('Super Admin governance', () => {
  async function supers(n: 2 | 3) {
    const result: Record<string, Session> = { super: await login(env, fx('super')), super2: await login(env, fx('super2')) };
    if (n === 3) {
      dbs.admin.seed("INSERT INTO admin_role_assignments (id, user_id, role, grant_source, granted_by) VALUES ('ara_third_super', 'fx_admin_ops', 'SUPER_ADMIN', 'approval', 'fx_admin_super2')");
      result.ops = await login(env, fx('ops'));
    }
    return result;
  }
  const activeSupers = () => count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_role_assignments WHERE role = 'SUPER_ADMIN' AND status = 'active'");

  it('operator bootstrap is two-person and one-time', () => {
    const fresh = createDatabases({ seed: false });
    try {
      const statements = buildBootstrapAdminSql({ userIds: ['u_a', 'u_b'], assignmentIds: ['ara_00000000000000a1', 'ara_00000000000000b2'] }).split(';\n');
      for (const statement of statements.slice(0, -1)) fresh.admin.seed(`${statement};`);
      expect(fresh.admin.query(statements.at(-1)!)).toEqual([{ granted: 2 }]);
      expect(count(fresh.admin, "SELECT COUNT(*) AS n FROM admin_config_metadata WHERE key = 'bootstrap_completed_at'")).toBe(1);
      expect(count(fresh.admin, "SELECT COUNT(*) AS n FROM admin_audit_events WHERE action = 'admin.bootstrap.operator'")).toBe(2);
      const again = buildBootstrapAdminSql({ userIds: ['u_c', 'u_d'], assignmentIds: ['ara_00000000000000c3', 'ara_00000000000000d4'] }).split(';\n');
      fresh.admin.seed(`${again[0]};`);
      expect(count(fresh.admin, 'SELECT COUNT(*) AS n FROM admin_role_assignments')).toBe(2);
      expect(() => fresh.admin.seed("INSERT INTO admin_role_assignments (id, user_id, role, grant_source) VALUES ('ara_00000000000000e5', 'u_e', 'SUPER_ADMIN', 'operator_bootstrap')")).toThrow(/already been completed/);
      expect(() => buildBootstrapAdminSql({ userIds: ['u_a', 'u_a'], assignmentIds: ['ara_00000000000000a1', 'ara_00000000000000b2'] })).toThrow(/two distinct/);
    } finally {
      closeDatabases(fresh);
    }
  });

  it('a SUPER_ADMIN grant needs a second, distinct SUPER_ADMIN; requester and target cannot approve; replay is rejected', async () => {
    const s = await supers(2);
    const request = await call('/api/v1/admin/roles', { env, method: 'POST', session: s.super, body: { userId: 'fx_admin_ops', role: 'SUPER_ADMIN' } });
    expect(request.status).toBe(201);
    const approvalId = request.json.data.approval.id;
    expect((await call(`/api/v1/admin/approvals/${approvalId}/approve`, { env, method: 'POST', session: s.super })).status).toBe(403);
    const ops = await login(env, fx('ops'));
    expect((await call(`/api/v1/admin/approvals/${approvalId}/approve`, { env, method: 'POST', session: ops })).status).toBe(403);
    expect(activeSupers()).toBe(2);
    const approved = await call(`/api/v1/admin/approvals/${approvalId}/approve`, { env, method: 'POST', session: s.super2 });
    expect(approved.status).toBe(200);
    expect(approved.json.data.approval).toMatchObject({ status: 'approved', decidedBy: 'fx_admin_super2' });
    expect(activeSupers()).toBe(3);
    expect((await call(`/api/v1/admin/approvals/${approvalId}/approve`, { env, method: 'POST', session: s.super2 })).status).toBe(409);
    // The grant ended the target's existing sessions.
    expect((await call('/api/v1/admin/me', { env, session: ops })).json.code).toBe('ADMIN_SESSION_REVOKED');
  });

  it('an approval whose requester lost SUPER_ADMIN is cancelled instead of applied', async () => {
    const s = await supers(3);
    const request = await call('/api/v1/admin/roles', { env, method: 'POST', session: s.ops, body: { userId: 'fx_admin_support', role: 'SUPER_ADMIN' } });
    expect(request.status).toBe(201);
    dbs.admin.seed("UPDATE admin_role_assignments SET status = 'revoked', revoked_at = 'x', revoked_by = 'fx_admin_super' WHERE id = 'ara_third_super'");
    const result = await call(`/api/v1/admin/approvals/${request.json.data.approval.id}/approve`, { env, method: 'POST', session: s.super2 });
    expect(result.status).toBe(409);
    expect(dbs.admin.query('SELECT status FROM admin_action_approvals WHERE id = ?', request.json.data.approval.id)).toEqual([{ status: 'cancelled' }]);
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_role_assignments WHERE user_id = 'fx_admin_support' AND role = 'SUPER_ADMIN'")).toBe(0);
  });

  it('revoking a SUPER_ADMIN is a four-eyes request and can never drop below two', async () => {
    const s2 = await supers(2);
    const blocked = await call('/api/v1/admin/roles/fx_ara_super2', { env, method: 'DELETE', session: s2.super });
    expect(blocked.status).toBe(409);
    expect(activeSupers()).toBe(2);
    expect(() => dbs.admin.seed("UPDATE admin_role_assignments SET status = 'revoked', revoked_at = 'x' WHERE id = 'fx_ara_super2'")).toThrow(/at least two/);

    const s = await supers(3);
    const request = await call('/api/v1/admin/roles/fx_ara_super2', { env, method: 'DELETE', session: s.super });
    expect(request.status).toBe(201);
    expect(request.json.data.approval).toMatchObject({ action: 'role.revoke.super_admin', assignmentId: 'fx_ara_super2', status: 'pending' });
    expect(activeSupers()).toBe(3);
    // The target cannot approve its own revocation, nor can the requester.
    expect((await call(`/api/v1/admin/approvals/${request.json.data.approval.id}/approve`, { env, method: 'POST', session: s.super2 })).status).toBe(403);
    expect((await call(`/api/v1/admin/approvals/${request.json.data.approval.id}/approve`, { env, method: 'POST', session: s.super })).status).toBe(403);
    const approved = await call(`/api/v1/admin/approvals/${request.json.data.approval.id}/approve`, { env, method: 'POST', session: s.ops });
    expect(approved.status).toBe(200);
    expect(activeSupers()).toBe(2);
    expect((await call('/api/v1/admin/me', { env, session: s.super2 })).json.code).toBe('ADMIN_SESSION_REVOKED');
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_audit_events WHERE action = 'admin.approval.approve' AND actor_user_id = 'fx_admin_ops'")).toBe(1);
  });

  it('concurrent duplicate requests yield one approval and a 409, never a 500', async () => {
    const s = await supers(2);
    const results = await Promise.all([1, 2].map(() => call('/api/v1/admin/roles', { env, method: 'POST', session: s.super, body: { userId: 'fx_admin_support', role: 'SUPER_ADMIN' } })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_action_approvals WHERE status = 'pending'")).toBe(1);
  });

  it('non-SUPER grants and revocations still forbid self-service and end the target sessions', async () => {
    const sup = await login(env, fx('super'));
    expect((await call('/api/v1/admin/roles', { env, method: 'POST', session: sup, body: { userId: 'fx_admin_super', role: 'SUPPORT_AGENT' } })).status).toBe(403);
    expect((await call('/api/v1/admin/roles/fx_ara_super', { env, method: 'DELETE', session: sup })).status).toBe(403);
    const auditor = await login(env, fx('auditor'));
    expect((await call('/api/v1/admin/roles', { env, method: 'POST', session: sup, body: { userId: 'fx_admin_auditor', role: 'SUPPORT_AGENT' } })).status).toBe(201);
    expect((await call('/api/v1/admin/me', { env, session: auditor })).json.code).toBe('ADMIN_SESSION_REVOKED');
  });
});

describe('sessions follow account security state', () => {
  const mutations: Array<[string, string]> = [
    ['password change', "UPDATE auth_accounts SET password_hash = 'deadbeef', salt = 'new-salt' WHERE user_id = 'fx_admin_super'"],
    ['verification revoked', "UPDATE auth_accounts SET is_verified = 0 WHERE user_id = 'fx_admin_super'"],
    ['Google identity linked', "UPDATE auth_accounts SET google_id = 'google-123' WHERE user_id = 'fx_admin_super'"],
    ['email changed', "UPDATE auth_accounts SET email = 'new@fixture.takosan.test' WHERE user_id = 'fx_admin_super'"],
  ];
  it.each(mutations)('%s revokes admin sessions', async (_name, statement) => {
    const session = await login(env, fx('super'));
    expect((await call('/api/v1/admin/me', { env, session })).status).toBe(200);
    dbs.main.seed(statement);
    const result = await call('/api/v1/admin/me', { env, session });
    expect(result.status).toBe(401);
    expect(result.json.code).toBe('ADMIN_SESSION_REVOKED');
    expect(dbs.admin.query('SELECT revoked_reason FROM admin_sessions WHERE id = ?', session.sessionId)).toEqual([{ revoked_reason: 'credential_changed' }]);
  });

  it('a session minted under password mode is refused once the deployment switches modes', async () => {
    const session = await login(env, fx('super'));
    setLocalAuthBuild(false);
    expect((await call('/api/v1/admin/me', { env, session })).json.code).toBe('ADMIN_AUTH_NOT_CONFIGURED');
  });
});

describe('required audit records fail closed', () => {
  function withFailingAudit(base: AdminEnv): AdminEnv {
    const admin = dbs.admin;
    const failing = new Proxy(admin, { get(target, prop, receiver) {
      if (prop === 'prepare') return (query: string) => { if (query.includes('INSERT INTO admin_audit_events')) throw new Error('audit store unavailable'); return target.prepare(query); };
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    return { ...base, ADMIN_DB: failing as never };
  }

  it('PII is not disclosed when the reveal cannot be audited', async () => {
    const support = await login(env, fx('support'));
    const result = await call('/api/v1/admin/users/fx_user_001?reveal=email', { env: withFailingAudit(env), session: support });
    expect(result.status).toBe(503);
    expect(result.json.code).toBe('ADMIN_AUDIT_UNAVAILABLE');
    expect(result.text).not.toContain('customer001@');
  });

  it('mutations without an audit record have no side effects', async () => {
    const sup = await login(env, fx('super'));
    const result = await call('/api/v1/admin/roles', { env: withFailingAudit(env), method: 'POST', session: sup, body: { userId: 'fx_user_002', role: 'SUPPORT_AGENT' } });
    expect(result.status).toBeGreaterThanOrEqual(500);
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_role_assignments WHERE user_id = 'fx_user_002'")).toBe(0);
  });
});

describe('rate limits', () => {
  it('limits per account across many IPs and per IP across accounts', async () => {
    const perAccount = [];
    for (let i = 0; i < 11; i += 1) perAccount.push((await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email: fx('super'), password: 'wrong-password' } })).status);
    expect(perAccount.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(perAccount[10]).toBe(429);
    const perIp = [];
    for (let i = 0; i < 6; i += 1) perIp.push((await call('/api/v1/admin/auth/login', { env, method: 'POST', ip: '203.0.113.7', body: { email: fx(`customer00${i + 1}`), password: 'x' } })).status);
    expect(perIp).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it('ignores spoofable forwarding headers and fails closed without KV outside local environments', async () => {
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await call('/api/v1/admin/auth/login', { env, method: 'POST', ip: null, headers: { 'X-Forwarded-For': `10.0.0.${i}`, 'X-Real-IP': `10.0.1.${i}` },
        body: { email: fx(`customer01${i}`), password: 'x' } })).status);
    }
    expect(statuses.at(-1)).toBe(429);
    const noKvDbs = createDatabases();
    noKvDbs.admin.seed("DELETE FROM admin_config_metadata WHERE key = 'fixture_dataset'");
    const noKv = productionEnv(noKvDbs, { CACHE: undefined });
    const result = await call('/api/v1/admin/auth/login', { env: noKv, method: 'POST', body: {} });
    expect(result.status).toBe(503);
    expect(result.json.code).toBe('RATE_LIMIT_UNAVAILABLE');
    expect(result.headers.get('Retry-After')).toBe('30');
    closeDatabases(noKvDbs);
  });
});

describe('customer database is read-only for admin code', () => {
  it('rejects every non-SELECT statement shape', () => {
    for (const statement of ['INSERT INTO users (id) VALUES (1)', "UPDATE subscriptions SET plan = 'plus'", 'DELETE FROM payment_intents', 'PRAGMA writable_schema = 1',
      'SELECT 1; DELETE FROM users', 'WITH x AS (SELECT 1) INSERT INTO users SELECT * FROM x', 'REPLACE INTO users VALUES (1)', 'ATTACH DATABASE x AS y', 'CREATE TABLE z (a)']) {
      expect(() => assertReadOnlySql(statement), statement).toThrow(/read-only/);
    }
    expect(() => assertReadOnlySql("SELECT COUNT(*) FROM users WHERE updated_at > datetime('now')")).not.toThrow();
    const wrapped = readOnlyDatabase(dbs.main);
    expect(() => wrapped.prepare("UPDATE users SET email = 'x'")).toThrow(/read-only/);
    return Promise.all([expect(wrapped.batch([])).rejects.toThrow(/read-only/), expect(wrapped.exec('SELECT 1')).rejects.toThrow(/read-only/)]);
  });

  it('a full admin workflow leaves every customer table byte-identical', async () => {
    const tables = dbs.main.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map((row) => row.name);
    const snapshot = () => JSON.stringify(tables.map((name) => dbs.main.query(`SELECT * FROM "${name}" ORDER BY rowid`)));
    const before = snapshot();
    const sup = await login(env, fx('super'));
    const recipe = dbs.main.query<{ id: string; version: number }>('SELECT id, version FROM recipes LIMIT 1')[0];
    for (const path of ['/api/v1/admin/overview', '/api/v1/admin/users?q=Linh', '/api/v1/admin/users/fx_user_001?reveal=email', '/api/v1/admin/billing/summary',
      '/api/v1/admin/billing/transactions', '/api/v1/admin/ai/summary', '/api/v1/admin/recipes/summary', '/api/v1/admin/system/status', '/api/v1/admin/settings']) {
      expect((await call(path, { env, session: sup })).status, path).toBe(200);
    }
    expect((await call(`/api/v1/admin/recipes/${recipe.id}/reviews`, { env, method: 'POST', session: sup, body: { state: 'approved', note: 'ok', recipeVersion: recipe.version } })).status).toBe(201);
    expect((await call('/api/v1/admin/roles', { env, method: 'POST', session: sup, body: { userId: 'fx_user_001', role: 'SUPPORT_AGENT' } })).status).toBe(201);
    expect((await call('/api/v1/admin/preferences', { env, method: 'PUT', session: sup, body: { density: 'compact' } })).status).toBe(200);
    await call('/api/v1/admin/auth/logout', { env, method: 'POST', session: sup });
    expect(snapshot()).toBe(before);
  });
});

describe('admin schema and synthetic data gates', () => {
  it('refuses to serve against an unmigrated or newer admin schema', async () => {
    const unmigrated = createDatabases({ migrateAdmin: false });
    try {
      expect((await call('/api/v1/admin/auth/config', { env: localEnv(unmigrated) })).json.code).toBe('ADMIN_SCHEMA_MISMATCH');
    } finally {
      closeDatabases(unmigrated);
    }
    dbs.admin.seed("UPDATE admin_config_metadata SET value = '2' WHERE key = 'schema_version'");
    const result = await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email: fx('super'), password: PASSWORD } });
    expect(result.status).toBe(503);
    expect(result.json.code).toBe('ADMIN_SCHEMA_MISMATCH');
  });

  it('a synthetic-fixture database is rejected outside development/test', async () => {
    const result = await call('/api/v1/admin/auth/config', { env: productionEnv(dbs) });
    expect(result.status).toBe(503);
    expect(result.json.code).toBe('ADMIN_FIXTURE_DATA_REJECTED');
  });
});

describe('Cloudflare Access adapter (offline test keys only)', () => {
  let keys: CryptoKeyPair;
  let jwk: JsonWebKey;
  let fetches = 0;
  beforeAll(async () => {
    keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
  });
  const b64 = (value: object | Uint8Array) => Buffer.from(value instanceof Uint8Array ? value : JSON.stringify(value)).toString('base64url');
  async function sign(payload: Record<string, unknown>, key: CryptoKey = keys.privateKey, kid = 'k1') {
    const head = b64({ alg: 'RS256', kid, typ: 'JWT' });
    const body = b64(payload);
    return `${head}.${body}.${b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`))))}`;
  }
  const now = () => Math.floor(Date.now() / 1000);
  const claims = (overrides: Record<string, unknown> = {}) => ({ aud: [ACCESS_AUD], iss: `https://${ACCESS_TEAM}`, exp: now() + 300, nbf: now() - 10, email: fx('super'), ...overrides });
  const config = { ADMIN_ACCESS_TEAM_DOMAIN: ACCESS_TEAM, ADMIN_ACCESS_AUD: ACCESS_AUD };
  function installJwks() {
    fetches = 0;
    accessOptions.fetcher = async () => { fetches += 1; return Response.json({ keys: [{ ...jwk, kid: 'k1' }] }); };
  }

  it('verifies signature, audience, issuer and lifetime, and throttles unknown-kid refetches', async () => {
    installJwks();
    const options = { fetcher: accessOptions.fetcher };
    expect(await verifyAccessAssertion(await sign(claims()), config, options)).toEqual({ ok: true, email: fx('super') });
    expect(await verifyAccessAssertion(await sign(claims({ aud: ['another-audience-0000000000000'] })), config, options)).toEqual({ ok: false, reason: 'wrong_audience' });
    expect(await verifyAccessAssertion(await sign(claims({ iss: 'https://evil.cloudflareaccess.com' })), config, options)).toEqual({ ok: false, reason: 'wrong_issuer' });
    expect(await verifyAccessAssertion(await sign(claims({ exp: now() - 1 })), config, options)).toEqual({ ok: false, reason: 'expired' });
    expect(await verifyAccessAssertion(await sign(claims({ nbf: now() + 3600 })), config, options)).toEqual({ ok: false, reason: 'not_yet_valid' });
    const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    expect(await verifyAccessAssertion(await sign(claims(), other.privateKey), config, options)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(await verifyAccessAssertion(undefined, config, options)).toEqual({ ok: false, reason: 'missing_assertion' });
    const before = fetches;
    for (let i = 0; i < 5; i += 1) expect((await verifyAccessAssertion(await sign(claims(), keys.privateKey, `forged-${i}`), config, options)).ok).toBe(false);
    expect(fetches - before).toBeLessThanOrEqual(1);
  });

  it('production requires a valid assertion on login and every request, bound to the session account', async () => {
    installJwks();
    const prodDbs = createDatabases();
    prodDbs.admin.seed("DELETE FROM admin_config_metadata WHERE key = 'fixture_dataset'");
    try {
      const prod = productionEnv(prodDbs);
      expect((await call('/api/v1/admin/auth/config', { env: prod })).json).toEqual({ data: { mode: 'cloudflare_access' } });
      expect((await call('/api/v1/admin/auth/login', { env: prod, method: 'POST' })).json.code).toBe('ADMIN_ACCESS_DENIED');
      const assertion = await sign(claims());
      const session = await login(prod, fx('super'), PASSWORD, { headers: { 'Cf-Access-Jwt-Assertion': assertion } });
      expect((await call('/api/v1/admin/me', { env: prod, session })).json.code).toBe('ADMIN_ACCESS_DENIED');
      expect((await call('/api/v1/admin/me', { env: prod, session, headers: { 'Cf-Access-Jwt-Assertion': assertion } })).status).toBe(200);
      expect((await call('/api/v1/admin/me', { env: prod, session, headers: { 'Cf-Access-Jwt-Assertion': await sign(claims({ email: fx('ops') })) } })).json.code).toBe('ADMIN_ACCESS_DENIED');
      expect((await call('/api/v1/admin/auth/login', { env: prod, method: 'POST', headers: { 'Cf-Access-Jwt-Assertion': await sign(claims({ email: fx('owner') })) } })).json.code).toBe('ADMIN_INVALID_CREDENTIALS');
      const page = await call('/admin/', { env: { ...prod, ASSETS: { fetch: async () => new Response('<div id="admin-root"></div>') } as never } });
      expect(page.headers.get('Strict-Transport-Security')).toContain('max-age=');
      expect(page.headers.get('Content-Security-Policy')).toContain('upgrade-insecure-requests');
    } finally {
      closeDatabases(prodDbs);
    }
  });
});

describe('customer Worker has no admin surface', () => {
  it('does not route /api/v1/admin or serve admin assets and does not import admin code', async () => {
    const customerEnv = { DB: dbs.main, ENVIRONMENT: 'development', APP_URL: 'http://127.0.0.1:8787', JWT_SECRET: 'customer-test-secret-0123456789-abcdef',
      ASSETS: { fetch: async () => new Response('<div id="root"></div>', { headers: { 'Content-Type': 'text/html' } }) } };
    const api = await fetchWorker(new Request('http://127.0.0.1:8787/api/v1/admin/auth/config'), customerEnv as never);
    expect(await api.text()).not.toContain('"mode"');
    const doc = await fetchWorker(new Request('http://127.0.0.1:8787/admin/', { headers: { 'Sec-Fetch-Mode': 'navigate' } }), customerEnv as never);
    expect(await doc.text()).not.toContain('admin-root');
    const source = readFileSync('src/worker/index.ts', 'utf8');
    expect(source).not.toMatch(/routes\/admin|admin-worker|ADMIN_/);
  });
});
