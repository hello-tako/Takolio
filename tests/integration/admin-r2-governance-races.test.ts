import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  call, closeDatabases, createDatabases, fx, localEnv, login, seedFixtureSuper,
  setLocalAuthBuild, type Databases,
} from '../helpers/admin-harness';

let dbs: Databases | undefined;
beforeAll(() => setLocalAuthBuild(true));
afterAll(() => setLocalAuthBuild(false));
afterEach(() => { closeDatabases(dbs); dbs = undefined; });

const roster = () => dbs!.admin.query("SELECT COUNT(*) AS n FROM admin_role_assignments WHERE role='SUPER_ADMIN' AND status='active'")[0].n;

describe('R2 reviewed governance races', () => {
  it('denies a three-to-two revocation in the API and database', async () => {
    dbs = createDatabases();
    const env = localEnv(dbs);
    const requester = await login(env, fx('super'));
    const result = await call('/api/v1/admin/roles/fx_ceremony_001_2', { env, method: 'DELETE', session: requester });
    expect(result.status).toBe(409);
    expect(() => dbs!.admin.seed("UPDATE admin_role_assignments SET status='revoked',revoked_at='now' WHERE id='fx_ceremony_001_2'")).toThrow(/three/);
    expect(roster()).toBe(3);
    expect((await call('/api/v1/admin/me', { env, session: requester })).status).toBe(200);
    await expect(login(env, fx('super2'))).resolves.toHaveProperty('sessionId');
  });

  it.each(['binding', 'operator', 'issuer'])('counts eligible same-issuer operators when a fourth role has a different %s state', async (kind) => {
    dbs = createDatabases();
    seedFixtureSuper(dbs, 'ops', 'ara_fourth_operator');
    if (kind === 'binding') dbs.admin.seed("UPDATE operator_identity_bindings SET status='revoked' WHERE user_id='fx_admin_ops'");
    if (kind === 'operator') dbs.admin.seed("UPDATE approved_human_operators SET status='revoked' WHERE operator_id='operator_ops'");
    if (kind === 'issuer') {
      dbs.admin.seed("INSERT INTO approved_human_operators VALUES('operator_other_issuer','synthetic-review','now','active',NULL,NULL)");
      dbs.admin.seed("INSERT INTO operator_identity_bindings(user_id,operator_id,access_iss,access_sub,approved_at,approval_ref,email,display_name) VALUES('other_issuer_user','operator_other_issuer','https://other.cloudflareaccess.com','different-sub','now','synthetic-review','other@example.test','Other')");
      // Replace the extra eligible role with a role in another issuer cohort.
      dbs.admin.seed("INSERT INTO admin_role_assignments(id,user_id,role,grant_source,granted_by) VALUES('ara_other_issuer','other_issuer_user','SUPER_ADMIN','approval','fx_admin_super')");
      dbs.admin.seed("UPDATE admin_role_assignments SET status='revoked',revoked_at='now' WHERE id='ara_fourth_operator'");
    }
    const env = localEnv(dbs);
    const requester = await login(env, fx('super'));
    expect((await call('/api/v1/admin/roles/fx_ceremony_001_2', { env, method: 'DELETE', session: requester })).status).toBe(409);
    expect(() => dbs!.admin.seed("UPDATE admin_role_assignments SET status='revoked',revoked_at='now' WHERE id='fx_ceremony_001_2'")).toThrow(/three/);
    expect(roster()).toBe(4);
  });

  it.each(['binding', 'operator'])('allows audited offboarding of an already-ineligible fourth %s while three eligible operators remain', async (kind) => {
    dbs = createDatabases();
    seedFixtureSuper(dbs, 'ops', 'ara_fourth_operator');
    dbs.admin.seed(kind === 'binding'
      ? "UPDATE operator_identity_bindings SET status='revoked' WHERE user_id='fx_admin_ops'"
      : "UPDATE approved_human_operators SET status='revoked' WHERE operator_id='operator_ops'");
    const env = localEnv(dbs);
    const requester = await login(env, fx('super'));
    const decider = await login(env, fx('super2'));
    const request = await call('/api/v1/admin/roles/ara_fourth_operator', { env, method: 'DELETE', session: requester });
    expect(request.status).toBe(201);
    expect((await call(`/api/v1/admin/approvals/${request.json.data.approval.id}/approve`, { env, method: 'POST', session: decider })).status).toBe(200);
    expect(roster()).toBe(3);
    expect((await call('/api/v1/admin/me', { env, session: requester })).status).toBe(200);
    expect(dbs.admin.query("SELECT COUNT(*) AS n FROM admin_audit_events WHERE action='admin.approval.approve'")[0].n).toBe(1);
  });

  it('rechecks the roster inside the approval batch after another revocation', async () => {
    dbs = createDatabases();
    seedFixtureSuper(dbs, 'ops', 'ara_fourth_operator');
    const env = localEnv(dbs);
    const requester = await login(env, fx('super'));
    const decider = await login(env, fx('super2'));
    const request = await call('/api/v1/admin/roles/fx_ceremony_001_2', { env, method: 'DELETE', session: requester });
    expect(request.status).toBe(201);
    let fired = false;
    dbs.admin.hooks.beforeBatch = (statements) => {
      if (!fired && statements.some(s => s.sql.includes('UPDATE admin_action_approvals SET status = ?, decided_by'))) {
        fired = true;
        dbs!.admin.seed("UPDATE admin_role_assignments SET status='revoked',revoked_at='now' WHERE id='ara_fourth_operator'");
      }
    };
    expect((await call(`/api/v1/admin/approvals/${request.json.data.approval.id}/approve`, { env, method: 'POST', session: decider })).status).toBe(409);
    expect(fired).toBe(true);
    expect(roster()).toBe(3);
    expect(dbs.admin.query('SELECT status FROM admin_action_approvals WHERE id=?', request.json.data.approval.id)).toEqual([{ status: 'pending' }]);
    expect(dbs.admin.query("SELECT id FROM admin_audit_events WHERE action='admin.approval.approve'")).toEqual([]);
  });

  it.each(['binding', 'operator'])('refuses a SUPER_ADMIN decision when target %s enrollment is revoked just before the batch', async (kind) => {
    dbs = createDatabases();
    const env = localEnv(dbs);
    const requester = await login(env, fx('super'));
    const decider = await login(env, fx('super2'));
    const request = await call('/api/v1/admin/roles', { env, method: 'POST', session: requester, body: { userId: 'fx_user_003', role: 'SUPER_ADMIN' } });
    expect(request.status).toBe(201);
    let fired = false;
    dbs.admin.hooks.beforeBatch = (statements) => {
      if (!fired && statements.some(s => s.sql.includes('UPDATE admin_action_approvals SET status = ?, decided_by'))) {
        fired = true;
        dbs!.admin.seed(kind === 'binding'
          ? "UPDATE operator_identity_bindings SET status='revoked' WHERE user_id='fx_user_003'"
          : "UPDATE approved_human_operators SET status='revoked' WHERE operator_id='operator_user_003'");
      }
    };
    expect((await call(`/api/v1/admin/approvals/${request.json.data.approval.id}/approve`, { env, method: 'POST', session: decider })).status).toBe(409);
    expect(fired).toBe(true);
    expect(dbs.admin.query("SELECT id FROM admin_role_assignments WHERE user_id='fx_user_003'")).toEqual([]);
    expect(dbs.admin.query('SELECT status FROM admin_action_approvals WHERE id=?', request.json.data.approval.id)).toEqual([{ status: 'pending' }]);
    expect(dbs.admin.query("SELECT id FROM admin_audit_events WHERE action='admin.approval.approve'")).toEqual([]);
  });

  it.each(['binding', 'operator'])('refuses an ordinary role grant when target %s enrollment is revoked just before the batch', async (kind) => {
    dbs = createDatabases();
    const env = localEnv(dbs);
    const requester = await login(env, fx('super'));
    let fired = false;
    dbs.admin.hooks.beforeBatch = (statements) => {
      if (!fired && statements.some(s => s.sql.includes("VALUES (?, ?, ?, 'admin_grant'"))) {
        fired = true;
        dbs!.admin.seed(kind === 'binding'
          ? "UPDATE operator_identity_bindings SET status='revoked' WHERE user_id='fx_user_003'"
          : "UPDATE approved_human_operators SET status='revoked' WHERE operator_id='operator_user_003'");
      }
    };
    expect((await call('/api/v1/admin/roles', { env, method: 'POST', session: requester, body: { userId: 'fx_user_003', role: 'SUPPORT_AGENT' } })).status).toBe(409);
    expect(fired).toBe(true);
    expect(dbs.admin.query("SELECT id FROM admin_role_assignments WHERE user_id='fx_user_003'")).toEqual([]);
    expect(dbs.admin.query("SELECT id FROM admin_audit_events WHERE action='admin.role.grant' AND target_id='fx_user_003'")).toEqual([]);
  });
});
