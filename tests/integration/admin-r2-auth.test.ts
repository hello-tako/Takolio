import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { accessOptions, resetAccessJwksCache, verifyAccessAssertion } from '../../src/worker/routes/admin/access';
import { ACCESS_AUD, ACCESS_TEAM, call, closeDatabases, createDatabases, fx, localEnv, login, PASSWORD, setLocalAuthBuild, type Databases } from '../helpers/admin-harness';

let dbs: Databases | undefined;
beforeAll(() => setLocalAuthBuild(true));
afterEach(() => { closeDatabases(dbs); dbs = undefined; delete accessOptions.fetcher; resetAccessJwksCache(); });
afterAll(() => setLocalAuthBuild(false));

describe('R2 authentication regressions', () => {
  it('F6: failed attempts do not spend a valid login budget, while the eleventh failure is limited', async () => {
    dbs = createDatabases();
    const env = localEnv(dbs);
    for (let i = 0; i < 10; i += 1) expect((await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email: fx('super'), password: 'wrong-password' } })).status).toBe(401);
    expect((await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email: fx('super'), password: 'wrong-password' } })).status).toBe(429);
    expect((await call('/api/v1/admin/auth/login', { env, method: 'POST', body: { email: fx('super'), password: PASSWORD } })).status).toBe(200);
  });

  it('F11: the JWT needs a human subject and returns the exact issuer and subject', async () => {
    const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
    accessOptions.fetcher = async () => Response.json({ keys: [{ ...jwk, kid: 'r2' }] });
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const verify = async (extra: Record<string, unknown>) => {
      const data = `${encode({ alg: 'RS256', kid: 'r2' })}.${encode({ aud: [ACCESS_AUD], iss: `https://${ACCESS_TEAM}`, exp: Math.floor(Date.now() / 1000) + 60, email: fx('super'), ...extra })}`;
      const signature = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(data))).toString('base64url');
      return verifyAccessAssertion(`${data}.${signature}`, { ADMIN_ACCESS_TEAM_DOMAIN: ACCESS_TEAM, ADMIN_ACCESS_AUD: ACCESS_AUD }, accessOptions);
    };
    for (const sub of [undefined, '', null, 42, 'a'.repeat(129)]) expect((await verify({ sub })).ok).toBe(false);
    expect((await verify({ sub: 'human', common_name: 'service-token' })).ok).toBe(false);
    expect(await verify({ sub: 'human' })).toEqual({ ok: true, email: fx('super'), iss: `https://${ACCESS_TEAM}`, sub: 'human' });
  });

  it('F4: twenty decider-revocation races all refuse a grant inside the transaction', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = createDatabases();
      try {
        current.admin.seed("INSERT INTO admin_role_assignments (id,user_id,role,grant_source,granted_by) VALUES ('ara_r2_support','fx_admin_support','SUPER_ADMIN','approval','fx_admin_super'), ('ara_r2_ops','fx_admin_ops','SUPER_ADMIN','approval','fx_admin_super')");
        const env = localEnv(current);
        const requester = await login(env, fx('super'));
        const decider = await login(env, fx('super2'));
        const request = await call('/api/v1/admin/roles', { env, method: 'POST', session: requester, body: { userId: 'fx_user_003', role: 'SUPER_ADMIN' } });
        expect(request.status).toBe(201);
        let fired = false;
        current.admin.hooks = { beforeBatch: (statements) => {
          if (!fired && statements.some((statement) => statement.sql.includes('UPDATE admin_action_approvals SET status = ?, decided_by'))) {
            fired = true;
            current.admin.seed("UPDATE admin_role_assignments SET status='revoked',revoked_at='r2-race',revoked_by='fx_admin_super' WHERE id='fx_ara_super2'");
          }
        } };
        const result = await call(`/api/v1/admin/approvals/${request.json.data.approval.id}/approve`, { env, method: 'POST', session: decider });
        expect(fired).toBe(true);
        expect(result.status).toBe(409);
        expect(current.admin.query("SELECT id FROM admin_role_assignments WHERE user_id='fx_user_003' AND role='SUPER_ADMIN'")).toEqual([]);
      } finally { current.admin.hooks = {}; closeDatabases(current); }
    }
  }, 60000);
});
