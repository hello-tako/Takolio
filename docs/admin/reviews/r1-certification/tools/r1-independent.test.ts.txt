// Independent R1 certification tests (reviewer-authored; not part of the repository).
// Each FINDING test asserts the observed weakness (pass = reproduced); each CONTROL test asserts a security property.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { accessOptions, resetAccessJwksCache } from '../../../src/worker/routes/admin/access';
import { assertReadOnlySql } from '../../../src/worker/routes/admin/readonly-db';
import { buildBootstrapAdminSql } from '../../../scripts/admin-local-lib.mjs';
import {
  ACCESS_AUD, ACCESS_TEAM, call, closeDatabases, count, createDatabases, CUSTOMER_URL, fx, localEnv, login, PASSWORD, productionEnv,
  setLocalAuthBuild, type Databases, type Session,
} from '../../../tests/helpers/admin-harness';

let dbs: Databases;
let env: any;
let keys: CryptoKeyPair;
let foreign: CryptoKeyPair;
let jwk: JsonWebKey;
const rsa = () => crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as Promise<CryptoKeyPair>;
beforeAll(async () => { keys = await rsa(); foreign = await rsa(); jwk = await crypto.subtle.exportKey('jwk', keys.publicKey); });
beforeEach(() => { setLocalAuthBuild(true); dbs = createDatabases(); env = localEnv(dbs); });
afterEach(() => { dbs.admin.hooks = {}; dbs.main.hooks = {}; closeDatabases(dbs); delete accessOptions.fetcher; resetAccessJwksCache(); });
afterAll(() => setLocalAuthBuild(false));

const b64 = (v: object | Uint8Array) => Buffer.from(v instanceof Uint8Array ? v : JSON.stringify(v)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);
async function sign(payload: Record<string, unknown>, key = keys.privateKey) {
  const head = b64({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
  const body = b64(payload);
  return `${head}.${body}.${b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`))))}`;
}
const claims = (o: Record<string, unknown> = {}) => ({ aud: [ACCESS_AUD], iss: `https://${ACCESS_TEAM}`, exp: now() + 300, nbf: now() - 5, email: fx('super'), ...o });
function production() {
  accessOptions.fetcher = async () => Response.json({ keys: [{ ...jwk, kid: 'k1' }] });
  dbs.admin.seed("DELETE FROM admin_config_metadata WHERE key = 'fixture_dataset'");
  return productionEnv(dbs);
}
const activeSupers = () => count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_role_assignments WHERE role = 'SUPER_ADMIN' AND status = 'active'");
const addSuper = (key: string) => dbs.admin.seed(`INSERT INTO admin_role_assignments (id, user_id, role, grant_source, granted_by) VALUES ('ara_r1c_${key}_super', 'fx_admin_${key}', 'SUPER_ADMIN', 'approval', 'fx_admin_super')`);
const revokeDirect = (id: string) => dbs.admin.seed(`UPDATE admin_role_assignments SET status = 'revoked', revoked_at = '2026-10-14T00:00:00.000Z', revoked_by = 'fx_admin_super' WHERE id = '${id}'`);

describe('Gate B - data isolation', () => {
  it('R1C-B1 CONTROL: every admin mutation and read leaves all customer tables unwritten (write-capture triggers)', async () => {
    const tables = dbs.main.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").map((r) => r.name);
    dbs.main.seed('CREATE TABLE r1_write_log (tbl TEXT, op TEXT)');
    const skipped: string[] = [];
    for (const t of tables) {
      for (const op of ['INSERT', 'UPDATE', 'DELETE']) {
        try { dbs.main.seed(`CREATE TRIGGER "r1_${t}_${op}" AFTER ${op} ON "${t}" BEGIN INSERT INTO r1_write_log VALUES ('${t}', '${op}'); END`); } catch { skipped.push(`${t}:${op}`); }
      }
    }
    expect(skipped).toEqual([]);
    addSuper('support');
    const s1 = await login(env, fx('super'));
    const s2 = await login(env, fx('super2'));
    const s3 = await login(env, fx('support'));
    const recipe = dbs.main.query<{ id: string; version: number }>('SELECT id, version FROM recipes LIMIT 1')[0];
    const statuses: Array<[string, number]> = [];
    const m = async (s: Session, method: string, path: string, body?: unknown) => { const r = await call(path, { env, method, session: s, body }); statuses.push([`${method} ${path}`, r.status]); return r; };
    await m(s1, 'PUT', '/api/v1/admin/preferences', { density: 'compact' });
    await m(s1, 'POST', `/api/v1/admin/recipes/${recipe.id}/reviews`, { state: 'approved', note: 'r1c', recipeVersion: recipe.version });
    const g = await m(s1, 'POST', '/api/v1/admin/roles', { userId: 'fx_user_001', role: 'SUPPORT_AGENT' });
    await m(s1, 'DELETE', `/api/v1/admin/roles/${g.json.data.assignment.id}`);
    const req = await m(s1, 'POST', '/api/v1/admin/roles', { userId: 'fx_admin_ops', role: 'SUPER_ADMIN' });
    await m(s2, 'POST', `/api/v1/admin/approvals/${req.json.data.approval.id}/approve`);
    const rev = await m(s1, 'DELETE', '/api/v1/admin/roles/fx_ara_super2');
    expect(dbs.admin.query("SELECT status FROM admin_role_assignments WHERE id = 'fx_ara_super2'")).toEqual([{ status: 'active' }]);
    await m(s3, 'POST', `/api/v1/admin/approvals/${rev.json.data.approval.id}/approve`);
    const req2 = await m(s1, 'POST', '/api/v1/admin/roles', { userId: 'fx_user_002', role: 'SUPER_ADMIN' });
    await m(s3, 'POST', `/api/v1/admin/approvals/${req2.json.data.approval.id}/reject`);
    const other = await login(env, fx('auditor'));
    await m(s1, 'POST', `/api/v1/admin/sessions/${other.sessionId}/revoke`);
    for (const path of ['/api/v1/admin/me', '/api/v1/admin/overview?range=90d', '/api/v1/admin/users?q=Linh', '/api/v1/admin/users/fx_user_001?reveal=email',
      '/api/v1/admin/households', '/api/v1/admin/billing/summary', '/api/v1/admin/billing/transactions', '/api/v1/admin/ai/summary', '/api/v1/admin/ai/usage',
      '/api/v1/admin/recipes', '/api/v1/admin/recipes/summary', `/api/v1/admin/recipes/${recipe.id}`, '/api/v1/admin/system/status', '/api/v1/admin/audit',
      '/api/v1/admin/settings', '/api/v1/admin/sessions']) {
      statuses.push([`GET ${path}`, (await call(path, { env, session: s1 })).status]);
    }
    await m(s1, 'POST', '/api/v1/admin/auth/logout');
    expect(statuses.map(([, s]) => s)).toEqual([200, 201, 201, 200, 201, 200, 201, 200, 201, 200, 200, ...Array(16).fill(200), 200]);
    expect(dbs.main.query('SELECT tbl, op FROM r1_write_log')).toEqual([]);
  });

  it('R1C-B2 CONTROL: the SELECT-only guard rejects write and multi-statement shapes; read-only table functions and credential columns stay readable (informational)', () => {
    for (const sql of ['DELETE FROM users', 'select 1; delete from users', 'WITH x AS (SELECT 1) UPDATE users SET email = NULL', 'INSERT INTO users SELECT * FROM users',
      ' /*c*/ DELETE FROM users', 'SELECT 1 FROM users /* ; */', 'EXPLAIN DELETE FROM users', 'VALUES(1)', 'REPLACE INTO users(id) VALUES (1)', 'WITH x AS (SELECT 1) SELECT * FROM x; DROP TABLE users']) {
      expect(() => assertReadOnlySql(sql), sql).toThrow();
    }
    expect(() => assertReadOnlySql("SELECT name FROM pragma_table_info('auth_accounts')")).not.toThrow();
    expect(() => assertReadOnlySql('SELECT password_hash, salt FROM auth_accounts')).not.toThrow();
  });

  it('R1C-B3 FINDING (P1 data minimisation): in Access mode every authenticated request reads password_hash and salt from the customer DB', async () => {
    const prod = production();
    const assertion = await sign(claims());
    const s = await login(prod, fx('super'), PASSWORD, { headers: { 'Cf-Access-Jwt-Assertion': assertion } });
    const seen: string[] = [];
    dbs.main.hooks = { beforeStatement: (e: { sql: string }) => { seen.push(e.sql); } };
    expect((await call('/api/v1/admin/me', { env: prod, session: s, headers: { 'Cf-Access-Jwt-Assertion': assertion } })).status).toBe(200);
    expect(seen.filter((q) => q.includes('a.password_hash') && q.includes('a.salt')).length).toBeGreaterThanOrEqual(1);
  });

  it('R1C-B4 CONTROL (latent-FK PoCs): the admin DB has no foreign keys; deleting a customer user leaves admin history intact', () => {
    const tables = dbs.admin.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'admin_%'").map((r) => r.name);
    expect(tables.length).toBe(7);
    for (const t of tables) expect(dbs.admin.query(`SELECT * FROM pragma_foreign_key_list('${t}')`), t).toEqual([]);
    const before = count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_role_assignments WHERE granted_by = 'fx_admin_super'");
    expect(() => dbs.main.seed("DELETE FROM users WHERE id = 'fx_admin_super'")).toThrow(/FOREIGN KEY/);
    dbs.main.seed("DELETE FROM household_members WHERE household_id = 'hh_fx_admin_super'; DELETE FROM households WHERE id = 'hh_fx_admin_super'; DELETE FROM users WHERE id = 'fx_admin_super';");
    expect(count(dbs.main, "SELECT COUNT(*) AS n FROM users WHERE id = 'fx_admin_super'")).toBe(0);
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_role_assignments WHERE granted_by = 'fx_admin_super'")).toBe(before);
  });
});

describe('Gate C - identity', () => {
  it('R1C-C1 FINDING (P2): the per-account login budget is spent before authentication, so 10 bad attempts lock the real admin out for 15 minutes', async () => {
    for (let i = 0; i < 10; i += 1) expect((await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email: fx('super'), password: 'wrong-password' } })).status).toBe(401);
    const real = await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email: fx('super'), password: PASSWORD } });
    expect(real.status).toBe(429);
    expect(Number(real.headers.get('Retry-After'))).toBeGreaterThan(800);
  });

  it('R1C-C2 CONTROL: Access replay of another identity, expiry, foreign signature, revoked role, unverified account and password bodies are refused', async () => {
    const prod = production();
    const good = await sign(claims());
    const s = await login(prod, fx('super'), PASSWORD, { headers: { 'Cf-Access-Jwt-Assertion': good } });
    expect((await call('/api/v1/admin/me', { env: prod, session: s, headers: { 'Cf-Access-Jwt-Assertion': good } })).status).toBe(200);
    const asOps = await sign(claims({ email: fx('ops') }));
    expect((await call('/api/v1/admin/me', { env: prod, session: s, headers: { 'Cf-Access-Jwt-Assertion': asOps } })).json.code).toBe('ADMIN_ACCESS_DENIED');
    expect((await call('/api/v1/admin/me', { env: prod, session: s, headers: { 'Cf-Access-Jwt-Assertion': await sign(claims({ exp: now() - 5 })) } })).json.code).toBe('ADMIN_ACCESS_DENIED');
    expect((await call('/api/v1/admin/me', { env: prod, session: s, headers: { 'Cf-Access-Jwt-Assertion': await sign(claims(), foreign.privateKey) } })).json.code).toBe('ADMIN_ACCESS_DENIED');
    expect((await call('/api/v1/admin/auth/login', { env: prod, method: 'POST', headers: { 'Cf-Access-Jwt-Assertion': await sign(claims({ email: fx('revoked') })) } })).json.code).toBe('ADMIN_INVALID_CREDENTIALS');
    expect((await call('/api/v1/admin/auth/login', { env: prod, method: 'POST', body: { email: fx('super'), password: PASSWORD } })).json.code).toBe('ADMIN_ACCESS_DENIED');
    dbs.main.seed("UPDATE auth_accounts SET is_verified = 0 WHERE user_id = 'fx_admin_ops'");
    expect((await call('/api/v1/admin/auth/login', { env: prod, method: 'POST', headers: { 'Cf-Access-Jwt-Assertion': asOps } })).json.code).toBe('ADMIN_INVALID_CREDENTIALS');
    dbs.main.seed("UPDATE auth_accounts SET is_verified = 0 WHERE user_id = 'fx_admin_super'");
    expect((await call('/api/v1/admin/me', { env: prod, session: s, headers: { 'Cf-Access-Jwt-Assertion': good } })).json.code).toBe('ADMIN_SESSION_REVOKED');
  });

  it('R1C-C3 CONTROL: production without an Access AUD is fail-closed (mode unavailable; login and session APIs 503)', async () => {
    const prod = { ...production(), ADMIN_ACCESS_AUD: '' };
    expect((await call('/api/v1/admin/auth/config', { env: prod })).json).toEqual({ data: { mode: 'unavailable' } });
    const l = await call('/api/v1/admin/auth/login', { env: prod, method: 'POST', headers: { 'Cf-Access-Jwt-Assertion': await sign(claims()) } });
    expect([l.status, l.json.code]).toEqual([503, 'ADMIN_AUTH_NOT_CONFIGURED']);
    expect((await call('/api/v1/admin/me', { env: prod })).json.code).toBe('ADMIN_AUTH_NOT_CONFIGURED');
  });

  it('R1C-C4 CONTROL: non-canonical or hostile Origin values and non-same-origin fetch metadata are refused', async () => {
    for (const origin of ['http://127.0.0.1:8790/', 'HTTP://127.0.0.1:8790', 'http://127.0.0.1:8790.evil.example', 'null', 'http://127.0.0.1:87900', 'http://localhost:8790']) {
      expect((await call('/api/v1/admin/auth/login', { env, method: 'POST', origin, body: { email: fx('super'), password: PASSWORD } })).status, origin).toBe(403);
    }
    const s = await login(env, fx('super'));
    for (const site of ['same-site', 'cross-site', 'none']) {
      expect((await call('/api/v1/admin/preferences', { env, method: 'PUT', session: s, body: { density: 'compact' }, headers: { 'Sec-Fetch-Site': site } })).status, site).toBe(403);
    }
    expect((await call('/api/v1/admin/preferences', { env, method: 'PUT', session: s, body: { density: 'compact' } })).status).toBe(200);
  });

  it('R1C-C5 CONTROL (S3 under a valid production split host): the customer origin cannot log in or mutate even with valid Access, session and CSRF; no CORS', async () => {
    const prod = production();
    const assertion = await sign(claims());
    expect((await call('/api/v1/admin/auth/login', { env: prod, method: 'POST', origin: CUSTOMER_URL, headers: { 'Cf-Access-Jwt-Assertion': assertion } })).status).toBe(403);
    const s = await login(prod, fx('super'), PASSWORD, { headers: { 'Cf-Access-Jwt-Assertion': assertion } });
    const denied = await call('/api/v1/admin/preferences', { env: prod, method: 'PUT', session: s, origin: CUSTOMER_URL, body: { density: 'compact' }, headers: { 'Cf-Access-Jwt-Assertion': assertion } });
    expect([denied.status, denied.json.code]).toEqual([403, 'ADMIN_CSRF_FAILED']);
    expect([...denied.headers.keys()].filter((k) => k.startsWith('access-control-'))).toEqual([]);
    expect((await call('/api/v1/admin/preferences', { env: prod, method: 'PUT', session: s, body: { density: 'compact' }, headers: { 'Cf-Access-Jwt-Assertion': assertion } })).status).toBe(200);
    expect((await call('/api/v1/admin/me', { env: prod, base: CUSTOMER_URL, session: s, headers: { 'Cf-Access-Jwt-Assertion': assertion } })).status).toBe(404);
  });

  it('R1C-C6 CONTROL (H9a): the 11th wrong password for one account from an 11th IP is refused with 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) statuses.push((await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email: fx('ops'), password: 'nope-nope' } })).status);
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(statuses[10]).toBe(429);
  });
});

describe('Gate D - SUPER_ADMIN governance', () => {
  it('R1C-D1 FINDING (P2): a decider whose SUPER_ADMIN role is revoked after the session check still completes the decision', async () => {
    addSuper('support');
    addSuper('ops');
    const s1 = await login(env, fx('super'));
    const s2 = await login(env, fx('super2'));
    const req = await call('/api/v1/admin/roles', { env, method: 'POST', session: s1, body: { userId: 'fx_user_003', role: 'SUPER_ADMIN' } });
    expect(req.status).toBe(201);
    let fired = false;
    dbs.admin.hooks = { beforeBatch: (statements: ReadonlyArray<{ sql: string }>) => {
      if (!fired && statements.some((s) => s.sql.includes('UPDATE admin_action_approvals SET status = ?, decided_by'))) { fired = true; revokeDirect('fx_ara_super2'); }
    } };
    const res = await call(`/api/v1/admin/approvals/${req.json.data.approval.id}/approve`, { env, method: 'POST', session: s2 });
    expect(fired).toBe(true);
    expect(res.status).toBe(200);
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_role_assignments WHERE user_id = 'fx_user_003' AND role = 'SUPER_ADMIN' AND status = 'active'")).toBe(1);
    expect(dbs.admin.query("SELECT status FROM admin_role_assignments WHERE id = 'fx_ara_super2'")).toEqual([{ status: 'revoked' }]);
  });

  it('R1C-D2 FINDING (P1): with exactly two SUPER_ADMINs, losing one leaves no in-product path to add or remove a SUPER_ADMIN', async () => {
    const s1 = await login(env, fx('super'));
    dbs.main.seed("UPDATE auth_accounts SET is_verified = 0 WHERE user_id = 'fx_admin_super2'");
    expect((await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email: fx('super2'), password: PASSWORD } })).status).toBe(401);
    const grant = await call('/api/v1/admin/roles', { env, method: 'POST', session: s1, body: { userId: 'fx_admin_ops', role: 'SUPER_ADMIN' } });
    expect(grant.status).toBe(201);
    expect((await call(`/api/v1/admin/approvals/${grant.json.data.approval.id}/approve`, { env, method: 'POST', session: s1 })).status).toBe(403);
    expect((await call('/api/v1/admin/roles/fx_ara_super2', { env, method: 'DELETE', session: s1 })).status).toBe(409);
    expect(activeSupers()).toBe(2);
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_role_assignments WHERE role = 'SUPER_ADMIN' AND status = 'active' AND user_id <> 'fx_admin_super2' AND user_id <> 'fx_admin_super'")).toBe(0);
  });

  it('R1C-D3 FINDING (P2): an interrupted bootstrap (grants written, marker and audit not) still accepts further operator_bootstrap grants and leaves no audit trail', () => {
    const fresh = createDatabases({ seed: false });
    try {
      const statements = buildBootstrapAdminSql({ userIds: ['op_a', 'op_b'], assignmentIds: ['ara_00000000000000a1', 'ara_00000000000000b2'] }).split(';\n');
      fresh.admin.seed(`${statements[0]};`);
      fresh.admin.seed("INSERT INTO admin_role_assignments (id, user_id, role, grant_source) VALUES ('ara_00000000000000c3', 'op_c', 'SUPER_ADMIN', 'operator_bootstrap')");
      expect(count(fresh.admin, "SELECT COUNT(*) AS n FROM admin_role_assignments WHERE grant_source = 'operator_bootstrap'")).toBe(3);
      expect(count(fresh.admin, 'SELECT COUNT(*) AS n FROM admin_audit_events')).toBe(0);
      expect(count(fresh.admin, "SELECT COUNT(*) AS n FROM admin_config_metadata WHERE key = 'bootstrap_completed_at'")).toBe(0);
    } finally {
      closeDatabases(fresh);
    }
  });

  it('R1C-D4 CONTROL: two SUPER_ADMINs deciding the same request concurrently produce exactly one grant', async () => {
    addSuper('support');
    const s1 = await login(env, fx('super'));
    const s2 = await login(env, fx('super2'));
    const s3 = await login(env, fx('support'));
    const req = await call('/api/v1/admin/roles', { env, method: 'POST', session: s1, body: { userId: 'fx_user_004', role: 'SUPER_ADMIN' } });
    const results = await Promise.all([s2, s3].map((s) => call(`/api/v1/admin/approvals/${req.json.data.approval.id}/approve`, { env, method: 'POST', session: s })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_role_assignments WHERE user_id = 'fx_user_004' AND role = 'SUPER_ADMIN'")).toBe(1);
  });

  it('R1C-D5 CONTROL: concurrent approvals of two SUPER_ADMIN revocations never drop below two active SUPER_ADMINs', async () => {
    addSuper('support');
    const s1 = await login(env, fx('super'));
    const s2 = await login(env, fx('super2'));
    const s3 = await login(env, fx('support'));
    const a = await call('/api/v1/admin/roles/fx_ara_super2', { env, method: 'DELETE', session: s1 });
    const b = await call('/api/v1/admin/roles/ara_r1c_support_super', { env, method: 'DELETE', session: s1 });
    expect([a.status, b.status]).toEqual([201, 201]);
    const [ra, rb] = await Promise.all([
      call(`/api/v1/admin/approvals/${a.json.data.approval.id}/approve`, { env, method: 'POST', session: s3 }),
      call(`/api/v1/admin/approvals/${b.json.data.approval.id}/approve`, { env, method: 'POST', session: s2 }),
    ]);
    expect([ra.status, rb.status].filter((s) => s === 200)).toHaveLength(1);
    expect([ra.status, rb.status].every((s) => [200, 401, 409].includes(s))).toBe(true);
    expect(activeSupers()).toBe(2);
  });

  it('R1C-D6 CONTROL (H7): an approval whose requester is no longer SUPER_ADMIN is cancelled, not applied', async () => {
    addSuper('support');
    addSuper('ops');
    const s2 = await login(env, fx('super2'));
    const s3 = await login(env, fx('support'));
    const req = await call('/api/v1/admin/roles', { env, method: 'POST', session: s3, body: { userId: 'fx_user_005', role: 'SUPER_ADMIN' } });
    expect(req.status).toBe(201);
    revokeDirect('ara_r1c_support_super');
    const r = await call(`/api/v1/admin/approvals/${req.json.data.approval.id}/approve`, { env, method: 'POST', session: s2 });
    expect(r.status).toBe(409);
    expect(dbs.admin.query('SELECT status FROM admin_action_approvals WHERE id = ?', req.json.data.approval.id)).toEqual([{ status: 'cancelled' }]);
    expect(count(dbs.admin, "SELECT COUNT(*) AS n FROM admin_role_assignments WHERE user_id = 'fx_user_005' AND role = 'SUPER_ADMIN'")).toBe(0);
  });

  it('R1C-D7 CONTROL (H3/H4): a single-SUPER_ADMIN state cannot be created; unilateral SUPER_ADMIN revocation is impossible', async () => {
    expect(() => revokeDirect('fx_ara_super2')).toThrow(/at least two/);
    expect(() => buildBootstrapAdminSql({ userIds: ['only_one'], assignmentIds: ['ara_00000000000000a1'] })).toThrow();
    const s1 = await login(env, fx('super'));
    expect((await call('/api/v1/admin/roles/fx_ara_super2', { env, method: 'DELETE', session: s1 })).status).toBe(409);
    addSuper('support');
    const r = await call('/api/v1/admin/roles/fx_ara_super2', { env, method: 'DELETE', session: s1 });
    expect(r.status).toBe(201);
    expect(dbs.admin.query("SELECT status FROM admin_role_assignments WHERE id = 'fx_ara_super2'")).toEqual([{ status: 'active' }]);
    expect(activeSupers()).toBe(3);
  });
});

describe('Gate A - routing (Node harness; workerd covered by workerd-probe.mjs)', () => {
  it('R1C-A1 FINDING (P2 functional): deep links whose id contains "." or ":" (allowed by the API schema) are 404 on reload', async () => {
    const withAssets = { ...env, ASSETS: { fetch: async () => new Response('<div id="admin-root"></div>') } as never };
    expect((await call('/admin/users/usr_abc', { env: withAssets })).status).toBe(200);
    expect((await call('/admin/users/usr.abc', { env: withAssets })).status).toBe(404);
    expect((await call('/admin/users/usr:abc', { env: withAssets })).status).toBe(404);
  });
});
