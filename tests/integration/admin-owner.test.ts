import path from 'node:path';
import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildAdminFixtureSql, buildBootstrapAdminSql } from '../../scripts/admin-local-lib.mjs';
import { checkAdminGovernanceReadiness } from '../../src/worker/routes/admin/governance';
import { SqliteD1 } from '../helpers/sqlite-d1';
import { call, closeDatabases, createDatabases, fx, localEnv, login, setLocalAuthBuild, type Databases } from '../helpers/admin-harness';

let dbs: Databases | undefined;
beforeAll(() => setLocalAuthBuild(true));
afterAll(() => setLocalAuthBuild(false));
afterEach(() => { closeDatabases(dbs); dbs = undefined; });

function retainOwner() {
  dbs!.admin.seed("UPDATE admin_role_assignments SET status='revoked',revoked_at='now',revoked_by='fx_admin_super' WHERE user_id IN ('fx_admin_super2','fx_admin_super3') AND role='SUPER_ADMIN'");
}

describe('single-owner Admin governance', () => {
  it('enrolls the first owner in one audited statement and refuses replay or audit failure', () => {
    dbs = createDatabases({ seed: false });
    const sql = `INSERT INTO admin_owner_enrollments(id,user_id,operator_id,access_iss,access_sub,email,display_name,public_key,approval_ref,created_at)
      VALUES('enroll_owner_01','owner','operator_owner','https://owner.cloudflareaccess.com','owner-sub','owner@example.test','Owner','synthetic-public-key','owner-approval','now')`;
    dbs.admin.seed("CREATE TRIGGER inject_failure BEFORE INSERT ON admin_audit_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
    expect(() => dbs!.admin.seed(sql)).toThrow('audit unavailable');
    expect(dbs.admin.query('SELECT operator_id FROM approved_human_operators')).toEqual([]);
    expect(dbs.admin.query('SELECT user_id FROM operator_identity_bindings')).toEqual([]);
    dbs.admin.seed('DROP TRIGGER inject_failure');
    dbs.admin.seed(sql);
    expect(dbs.admin.query('SELECT user_id FROM operator_identity_bindings')).toEqual([{ user_id: 'owner' }]);
    expect(dbs.admin.query('SELECT action FROM admin_audit_events')).toEqual([{ action: 'admin.owner.enroll' }]);
    expect(dbs.admin.query('SELECT id FROM admin_role_assignments')).toEqual([]);
    expect(() => dbs!.admin.seed(sql)).toThrow('empty authority');
    expect(() => dbs!.admin.seed("DELETE FROM admin_owner_enrollments")).toThrow('retained history');
  });

  it('accepts a single enrolled owner, with an atomic audit and one-time closure', async () => {
    dbs = createDatabases({ seed: false });
    dbs.admin.seed("INSERT INTO approved_human_operators(operator_id,approval_ref,approved_at) VALUES('operator_owner','owner-approval','now'); INSERT INTO operator_identity_bindings(user_id,operator_id,access_iss,access_sub,approved_at,approval_ref,email,display_name) VALUES('owner','operator_owner','https://owner.cloudflareaccess.com','owner-sub','now','owner-approval','owner@example.test','Owner')");
    const sql = buildBootstrapAdminSql({ userIds: ['owner'], ceremonyId: 'owner_bootstrap_01', independentApprovalRef: 'owner-approval' });
    dbs.admin.seed("CREATE TRIGGER inject_failure BEFORE INSERT ON admin_audit_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
    expect(() => dbs!.admin.seed(sql)).toThrow('audit unavailable');
    expect(dbs.admin.query('SELECT id FROM admin_role_assignments')).toEqual([]);
    expect(dbs.admin.query('SELECT id FROM admin_bootstrap_ceremonies')).toEqual([]);
    dbs.admin.seed('DROP TRIGGER inject_failure');
    dbs.admin.seed(sql);
    expect(await checkAdminGovernanceReadiness(dbs.admin, 'https://owner.cloudflareaccess.com')).toEqual({ ready: true, activeOperators: 1 });
    expect(await checkAdminGovernanceReadiness(dbs.admin, 'https://foreign.cloudflareaccess.com')).toEqual({ ready: false, activeOperators: 0 });
    expect(dbs.admin.query("SELECT action FROM admin_audit_events")).toEqual([{ action: 'admin.bootstrap' }]);
    expect(() => dbs!.admin.seed(sql)).toThrow();
  });

  it('lets the only owner request and confirm another enrolled administrator without a second person', async () => {
    dbs = createDatabases();
    retainOwner();
    const env = localEnv(dbs);
    const owner = await login(env, fx('super'));
    const target = await login(env, fx('ops'));
    const request = await call('/api/v1/admin/roles', { env, method: 'POST', session: owner, body: { userId: 'fx_admin_ops', role: 'SUPER_ADMIN' } });
    expect(request.status).toBe(201);
    const id = request.json.data.approval.id;
    expect((await call(`/api/v1/admin/approvals/${id}/approve`, { env, method: 'POST', session: target })).status).toBe(403);
    const responses = await Promise.all([1, 2, 3].map(() => call(`/api/v1/admin/approvals/${id}/approve`, { env, method: 'POST', session: owner })));
    expect(responses.map(r => r.status).sort()).toEqual([200, 409, 409]);
    expect((await call('/api/v1/admin/me', { env, session: target })).json.code).toBe('ADMIN_SESSION_REVOKED');
    expect(dbs.admin.query("SELECT actor_user_id FROM admin_audit_events WHERE action='admin.approval.approve'")).toEqual([{ actor_user_id: 'fx_admin_super' }]);
  });

  it.each([
    "UPDATE admin_role_assignments SET status='revoked',revoked_at='now' WHERE id='fx_ceremony_001_0'",
    "UPDATE operator_identity_bindings SET status='revoked' WHERE user_id='fx_admin_super'",
    "UPDATE approved_human_operators SET status='revoked' WHERE operator_id='operator_super'",
  ])('protects the last usable owner at the database boundary: %s', sql => {
    dbs = createDatabases();
    retainOwner();
    expect(() => dbs!.admin.seed(sql)).toThrow(/at least one/);
  });

  it('rolls back a self-confirmed grant if the mandatory audit cannot be stored', async () => {
    dbs = createDatabases();
    retainOwner();
    const env = localEnv(dbs);
    const owner = await login(env, fx('super'));
    const request = await call('/api/v1/admin/roles', { env, method: 'POST', session: owner, body: { userId: 'fx_admin_ops', role: 'SUPER_ADMIN' } });
    dbs.admin.seed("CREATE TRIGGER inject_failure BEFORE INSERT ON admin_audit_events WHEN NEW.action='admin.approval.approve' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
    expect((await call(`/api/v1/admin/approvals/${request.json.data.approval.id}/approve`, { env, method: 'POST', session: owner })).status).toBe(500);
    expect(dbs.admin.query("SELECT id FROM admin_role_assignments WHERE user_id='fx_admin_ops' AND role='SUPER_ADMIN'")).toEqual([]);
    expect(dbs.admin.query('SELECT status FROM admin_action_approvals WHERE id=?', request.json.data.approval.id)).toEqual([{ status: 'pending' }]);
  });

  it('preserves populated schema-3 histories and pending requests when upgrading to schema 4', () => {
    const db = new SqliteD1({ migrate: false });
    try {
      for (const file of ['0001_admin_console_foundation.sql', '0002_admin_identity_governance_r2.sql', '0003_admin_governance_transaction_guards.sql']) {
        db.seed(readFileSync(path.resolve('migrations-admin', file), 'utf8'));
      }
      db.seed(buildAdminFixtureSql().admin);
      db.seed("INSERT INTO admin_action_approvals(id,action,target_user_id,requested_by,requested_at,expires_at,requester_access_iss,requester_access_sub) VALUES('pending_upgrade','role.grant.super_admin','fx_admin_ops','fx_admin_super','2026-10-17','2099-01-01','https://fixture.cloudflareaccess.com','fx-sub-super')");
      const tables = ['admin_bootstrap_ceremonies', 'admin_role_assignments', 'admin_action_approvals', 'admin_audit_events', 'admin_recovery_operations'];
      const before = tables.map(table => db.query(`SELECT * FROM ${table} ORDER BY id`));
      db.seed(readFileSync(path.resolve('migrations-admin/0004_admin_single_owner_governance.sql'), 'utf8'));
      expect(tables.map(table => db.query(`SELECT * FROM ${table} ORDER BY id`))).toEqual(before);
      expect(db.query("SELECT value FROM admin_config_metadata WHERE key='schema_version'")).toEqual([{ value: '4' }]);
      expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
      expect(Object.values(db.query('PRAGMA integrity_check')[0])).toEqual(['ok']);
      db.seed("UPDATE admin_action_approvals SET status='approved',decided_by='fx_admin_super',decided_at='2026-10-18',decider_access_iss='https://fixture.cloudflareaccess.com',decider_access_sub='fx-sub-super' WHERE id='pending_upgrade'");
      expect(db.query("SELECT status FROM admin_action_approvals WHERE id='pending_upgrade'")).toEqual([{ status: 'approved' }]);
    } finally { db.close(); }
  });
});
