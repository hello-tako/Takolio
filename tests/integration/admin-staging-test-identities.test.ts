import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeStagingTestIdentity } from '../../scripts/admin-staging-test-identities.mjs';
import { buildBootstrapAdminSql } from '../../scripts/admin-local-lib.mjs';
import { closeDatabases, createDatabases, type Databases } from '../helpers/admin-harness';

let dbs: Databases | undefined;
afterEach(() => { closeDatabases(dbs); dbs = undefined; });
function fixture(environment = 'staging') {
  dbs = createDatabases({ seed: false });
  const db = dbs.admin;
  db.seed(`INSERT INTO admin_database_identity(id,identity,environment) VALUES('authority','staging-database-id','${environment}');
    INSERT INTO admin_owner_enrollments(id,user_id,operator_id,access_iss,access_sub,email,display_name,public_key,approval_ref,created_at)
    VALUES('owner_enrollment','owner','owner_operator','https://fixture.cloudflareaccess.com','owner-sub','owner@example.test','Owner','fixture-public-key','owner-approval','now');`);
  db.seed(buildBootstrapAdminSql({ userIds: ['owner'], ceremonyId: 'owner_bootstrap', independentApprovalRef: 'owner-approval' }));
  const query = async (sql: string, params: unknown[] = []) => {
    if (sql.trim().startsWith('SELECT')) return (await db.prepare(sql).bind(...params).all()).results;
    await db.prepare(sql).bind(...params).run();
    return [];
  };
  const signer = { operatorId: 'owner_operator', publicKey: 'fixture-public-key' };
  const manifest = { id: 'qa_enroll_01', operation: 'enroll-staging-test',
    payload: { userId: 'qa_subject01', operatorId: 'qa_operator01', subject: 'real-access-qa-sub',
      email: 'owner+takolio-qa-unprivileged@example.test', displayName: 'QA Unprivileged', approvalRef: 'owner-qa-request' },
    expiresAt: new Date(Date.now() + 3600_000).toISOString() };
  const call = (m = manifest, overrides: Record<string, unknown> = {}) => executeStagingTestIdentity({
    manifest: m, signer, target: { issuer: 'https://fixture.cloudflareaccess.com', custodians: [signer] },
    environment: 'staging', checkWrite: vi.fn(), query, digest: (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex'), ...overrides,
  });
  return { db, signer, manifest, call };
}

describe('staging test identity durable lifecycle', () => {
  it('enrolls after bootstrap with no role, password or recovery key and one matching audit', async () => {
    const f = fixture();
    await f.call();
    expect(f.db.query("SELECT user_id,status FROM operator_identity_bindings WHERE user_id='qa_subject01'"))
      .toEqual([{ user_id: 'qa_subject01', status: 'active' }]);
    expect(f.db.query("SELECT recovery_public_key,recovery_key_algorithm FROM approved_human_operators WHERE operator_id='qa_operator01'"))
      .toEqual([{ recovery_public_key: null, recovery_key_algorithm: null }]);
    expect(f.db.query("SELECT id FROM admin_role_assignments WHERE user_id='qa_subject01'")).toEqual([]);
    expect(f.db.query('SELECT user_id FROM admin_local_credentials')).toEqual([]);
    expect(f.db.query("SELECT action,outcome FROM admin_audit_events WHERE target_id='qa_subject01'"))
      .toEqual([{ action: 'admin.staging_test.enroll', outcome: 'success' }]);
  });

  it('revokes all QA roles and sessions atomically while keeping owner and history', async () => {
    const f = fixture();
    await f.call();
    f.db.seed(`INSERT INTO admin_role_assignments(id,user_id,role,grant_source,granted_by) VALUES('qa_assignment','qa_subject01','CONTENT_EDITOR','admin_grant','owner');
      INSERT INTO admin_sessions(id,user_id,account_id,token_hash,auth_method,credential_fingerprint,created_at,last_seen_at,expires_at,idle_expires_at)
      VALUES('qa_session','qa_subject01','qa_subject01','${'a'.repeat(64)}','cloudflare_access','${'b'.repeat(64)}','now','now','2099-01-01','2099-01-01');`);
    await f.call({ ...f.manifest, id: 'qa_revoke_01', operation: 'revoke-staging-test' });
    expect(f.db.query("SELECT status FROM admin_role_assignments WHERE id='qa_assignment'")).toEqual([{ status: 'revoked' }]);
    expect(f.db.query("SELECT status,security_epoch FROM operator_identity_bindings WHERE user_id='qa_subject01'"))
      .toEqual([{ status: 'revoked', security_epoch: 2 }]);
    expect(f.db.query("SELECT revoked_reason FROM admin_sessions WHERE id='qa_session'"))
      .toEqual([{ revoked_reason: 'credential_changed' }]);
    expect(f.db.query("SELECT user_id FROM admin_active_super_operators")).toEqual([{ user_id: 'owner' }]);
    expect(f.db.query("SELECT COUNT(*) AS n FROM admin_audit_events WHERE target_id='qa_subject01'"))
      .toEqual([{ n: 2 }]);
  });

  it('rolls back the ceremony, authority and bindings when mandatory audit fails', async () => {
    const f = fixture();
    f.db.seed("CREATE TRIGGER inject_qa_audit_failure BEFORE INSERT ON admin_audit_events WHEN NEW.action LIKE 'admin.staging_test.%' BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
    await expect(f.call()).rejects.toThrow('injected audit failure');
    for (const table of ['admin_staging_test_ceremonies', 'operator_identity_bindings', 'approved_human_operators']) {
      expect(f.db.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${table === 'admin_staging_test_ceremonies' ? 'user_id' : table === 'operator_identity_bindings' ? 'user_id' : 'operator_id'} LIKE 'qa_%'`)).toEqual([{ n: 0 }]);
    }
  });

  it('rolls back role and session revocation if cleanup audit fails', async () => {
    const f = fixture();
    await f.call();
    f.db.seed("INSERT INTO admin_role_assignments(id,user_id,role,grant_source,granted_by) VALUES('qa_assignment','qa_subject01','SUPPORT_AGENT','admin_grant','owner'); CREATE TRIGGER inject_qa_cleanup_failure BEFORE INSERT ON admin_audit_events WHEN NEW.action='admin.staging_test.revoke' BEGIN SELECT RAISE(ABORT,'cleanup audit failure'); END");
    await expect(f.call({ ...f.manifest, id: 'qa_revoke_01', operation: 'revoke-staging-test' })).rejects.toThrow('cleanup audit failure');
    expect(f.db.query("SELECT status FROM admin_role_assignments WHERE id='qa_assignment'")).toEqual([{ status: 'active' }]);
    expect(f.db.query("SELECT status FROM operator_identity_bindings WHERE user_id='qa_subject01'"))
      .toEqual([{ status: 'active' }]);
    expect(f.db.query("SELECT id FROM admin_staging_test_ceremonies WHERE operation='revoke'")).toEqual([]);
  });

  it('rejects replay and identity/email collisions without duplicating success audit', async () => {
    const f = fixture();
    await f.call();
    await expect(f.call()).rejects.toThrow();
    await expect(f.call({ ...f.manifest, id: 'qa_enroll_02' })).rejects.toThrow();
    expect(f.db.query("SELECT COUNT(*) AS n FROM admin_audit_events WHERE action='admin.staging_test.enroll'"))
      .toEqual([{ n: 1 }]);
  });

  it('enforces the staging database even when the caller claims staging', async () => {
    const f = fixture('production');
    await expect(f.call()).rejects.toThrow('staging QA requires');
    expect(f.db.query('SELECT id FROM admin_staging_test_ceremonies')).toEqual([]);
  });

  it.each(['other+takolio-qa-content@example.test', 'owner+takolio-qa-content@other.test'])('rejects an alias outside the enrolled owner mailbox: %s', async email => {
    const f = fixture();
    await expect(f.call({ ...f.manifest, payload: { ...f.manifest.payload, email } })).rejects.toThrow('exact owner-controlled alias');
  });

  it('rejects a new identity that reuses the real owner subject', async () => {
    const f = fixture();
    await expect(f.call({ ...f.manifest, payload: { ...f.manifest.payload, subject: 'owner-sub' } })).rejects.toThrow();
  });

  it('limits active QA identities to five', async () => {
    const f = fixture();
    for (let i = 0; i < 5; i++) await f.call({ ...f.manifest, id: `qa_enroll_0${i}`,
      payload: { ...f.manifest.payload, userId: `qa_user_0${i}`, operatorId: `qa_operator_0${i}`, subject: `qa-sub-${i}`, email: `owner+takolio-qa-${i}@example.test` } });
    await expect(f.call({ ...f.manifest, id: 'qa_enroll_06' })).rejects.toThrow('staging QA target');
  });

  it('QA SUPER_ADMIN cannot replace the durable owner for last-owner protection', async () => {
    const f = fixture();
    await f.call();
    f.db.seed(`INSERT INTO admin_action_approvals(id,action,target_user_id,requested_by,requested_at,expires_at,requester_access_iss,requester_access_sub)
      VALUES('qa_super_approval','role.grant.super_admin','qa_subject01','owner','now','2099-01-01','https://fixture.cloudflareaccess.com','owner-sub');
      UPDATE admin_action_approvals SET status='approved',decided_by='owner',decided_at='now',decider_access_iss='https://fixture.cloudflareaccess.com',decider_access_sub='owner-sub' WHERE id='qa_super_approval';
      INSERT INTO admin_role_assignments(id,user_id,role,grant_source,granted_by) VALUES('qa_super_role','qa_subject01','SUPER_ADMIN','approval','owner');`);
    expect(() => f.db.seed("UPDATE admin_role_assignments SET status='revoked',revoked_at='now' WHERE user_id='owner'"))
      .toThrow('at least one');
    expect(() => f.db.seed("UPDATE operator_identity_bindings SET status='revoked' WHERE user_id='owner'"))
      .toThrow('at least one');
    expect(() => f.db.seed("UPDATE approved_human_operators SET status='revoked' WHERE operator_id='owner_operator'"))
      .toThrow('at least one');
  });

  it('rejects lifecycle operations for an ordinary operator or a changed owner key', async () => {
    const f = fixture();
    const bad = { operatorId: 'owner_operator', publicKey: 'changed-public-key' };
    await expect(f.call(f.manifest, { signer: bad, target: { issuer: 'https://fixture.cloudflareaccess.com', custodians: [bad] } }))
      .rejects.toThrow('active enrolled owner');
    await expect(f.call(f.manifest, { signer: { operatorId: 'unknown', publicKey: 'untrusted' } }))
      .rejects.toThrow('Trusted owner');
  });
});
