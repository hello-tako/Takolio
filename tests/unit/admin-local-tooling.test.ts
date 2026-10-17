import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  assertLocalProvisioningAllowed,
  assertLocalFixtureAllowed,
  buildAdminFixtureSql,
  buildBootstrapAccountLookupSql,
  buildBootstrapIdentityLookupSql,
  buildBootstrapAdminSql,
  buildLocalAccountSql,
  FIXTURE_DATASET,
  FIXTURE_DOMAIN,
  localWranglerEnv,
} from '../../scripts/admin-local-lib.mjs';
import { SqliteD1, applyMigrations } from '../helpers/sqlite-d1';

const DEV = { ENVIRONMENT: 'development' };

describe('admin local provisioning guard', () => {
  it('requires an explicit --local flag', () => {
    expect(() => assertLocalProvisioningAllowed({ argv: [], env: DEV })).toThrow(/--local/);
  });
  it.each(['--remote', '--env=production', '--env', '--preview', '--production'])('refuses %s', (flag) => {
    expect(() => assertLocalProvisioningAllowed({ argv: ['--local', flag], env: DEV })).toThrow(/Refusing/);
  });
  it.each(['production', 'staging', 'test'])('refuses ENVIRONMENT=%s', (environment) => {
    expect(() => assertLocalProvisioningAllowed({ argv: ['--local'], env: { ENVIRONMENT: environment } })).toThrow(/development/);
  });
  it('refuses CI and reachable Cloudflare credentials', () => {
    expect(() => assertLocalProvisioningAllowed({ argv: ['--local'], env: { ...DEV, CI: 'true' } })).toThrow(/CI/);
    expect(() => assertLocalProvisioningAllowed({ argv: ['--local'], env: { ...DEV, GITHUB_ACTIONS: 'true' } })).toThrow(/CI/);
    expect(() => assertLocalProvisioningAllowed({ argv: ['--local'], env: { ...DEV, CLOUDFLARE_API_TOKEN: 'x' } })).toThrow(/CLOUDFLARE_API_TOKEN/);
  });
  it('allows synthetic local fixtures in CI while keeping operator provisioning blocked', () => {
    for (const ci of [{ CI: 'true' }, { GITHUB_ACTIONS: 'true' }, { CI: 'true', GITHUB_ACTIONS: 'true' }]) {
      const env = { ...DEV, ...ci };
      expect(() => assertLocalFixtureAllowed({ argv: ['--local'], env })).not.toThrow();
      expect(() => assertLocalProvisioningAllowed({ argv: ['--local'], env })).toThrow(/CI/);
    }
  });
  it('keeps the remote, environment and credential boundary for CI fixtures', () => {
    const env = { ...DEV, CI: 'true', GITHUB_ACTIONS: 'true' };
    expect(() => assertLocalFixtureAllowed({ argv: [], env })).toThrow(/--local/);
    for (const flag of ['--remote', '--env=production', '--env', '--preview', '--production']) {
      expect(() => assertLocalFixtureAllowed({ argv: ['--local', flag], env })).toThrow(/Refusing/);
    }
    for (const environment of ['production', 'staging', 'test']) {
      expect(() => assertLocalFixtureAllowed({ argv: ['--local'], env: { ...env, ENVIRONMENT: environment } })).toThrow(/development/);
    }
    expect(() => assertLocalFixtureAllowed({ argv: ['--local'], env: { ...env, CLOUDFLARE_API_TOKEN: 'x' } })).toThrow(/CLOUDFLARE_API_TOKEN/);
  });
  it('child wrangler processes get no telemetry, no token and a throwaway config home (no stored OAuth login)', () => {
    const env = localWranglerEnv({ HOME: '/home/someone', CLOUDFLARE_API_TOKEN: 'secret', XDG_CONFIG_HOME: '/home/someone/.config' });
    expect(env.WRANGLER_SEND_METRICS).toBe('false');
    expect(env.CLOUDFLARE_API_TOKEN).toBe('');
    expect(env.XDG_CONFIG_HOME).not.toBe('/home/someone/.config');
    expect(path.basename(env.XDG_CONFIG_HOME)).toMatch(/^takosan-admin-wrangler-home-/);
  });
  it('the CLI exits non-zero for remote or production requests without invoking wrangler', () => {
    const remote = spawnSync(process.execPath, ['scripts/admin-provision.mjs', '--remote', '--email', 'a@b.test', '--email', 'c@d.test'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    expect(remote.status).toBe(1);
    expect(remote.stderr).toMatch(/Refusing/);
    const production = spawnSync(process.execPath, ['scripts/admin-provision.mjs', '--local', '--email', 'a@b.test', '--email', 'c@d.test'], { encoding: 'utf8', env: { PATH: process.env.PATH, ENVIRONMENT: 'production' } });
    expect(production.status).toBe(1);
    expect(production.stderr).toMatch(/ENVIRONMENT=production/);
  });
});

describe('Admin authority bootstrap SQL', () => {
  it('requires exactly two different, valid emails', () => {
    expect(() => buildBootstrapAccountLookupSql(['a@example.test'])).toThrow(/two/);
    expect(() => buildBootstrapAccountLookupSql(['a@example.test', 'A@Example.test'])).toThrow(/different/);
    expect(() => buildBootstrapAccountLookupSql(["x'@y.test", 'b@example.test'])).toThrow();
    expect(buildBootstrapAccountLookupSql(['B@example.test', 'a@example.test'])).toContain("'b@example.test'");
  });

  it('requires three independently enrolled operators before an atomic one-time grant', () => {
    const admin = new SqliteD1({ migrate: false });
    applyMigrations(admin, path.resolve('migrations-admin'));
    try {
      const ids = ['operator_a', 'operator_b', 'operator_c'];
      expect(admin.query(buildBootstrapIdentityLookupSql(ids))).toHaveLength(0);
      for (const id of ids) admin.seed(`INSERT INTO approved_human_operators(operator_id,approval_ref,approved_at) VALUES('${id}','synthetic-review','now');
        INSERT INTO operator_identity_bindings(user_id,operator_id,access_iss,access_sub,approved_at,approval_ref,email,display_name)
        VALUES('${id}','${id}','https://fixture.cloudflareaccess.com','${id}','now','synthetic-review','${id}@example.test','${id}');`);
      expect(admin.query(buildBootstrapIdentityLookupSql(ids))).toHaveLength(3);
      const sql = buildBootstrapAdminSql({userIds:ids, independentApprovalRef:'synthetic-review', ceremonyId:'ceremony_unit_01'});
      admin.seed(sql);
      expect(admin.query("SELECT COUNT(*) AS n FROM admin_role_assignments WHERE role='SUPER_ADMIN'")).toEqual([{n:3}]);
      expect(admin.query("SELECT COUNT(*) AS n FROM admin_audit_events WHERE action='admin.bootstrap'")).toEqual([{n:1}]);
      expect(() => admin.seed(sql)).toThrow();
      expect(() => admin.seed("INSERT INTO admin_role_assignments(id,user_id,role,grant_source) VALUES('extra_grant','other','SUPER_ADMIN','operator_bootstrap')")).toThrow();
    } finally { admin.close(); }
  });

  it('rejects malformed input before building SQL', () => {
    expect(() => buildBootstrapAdminSql({ userIds: ['a', "b'; DROP"], assignmentIds: ['ara_00000000000000a1', 'ara_00000000000000b2'] })).toThrow();
    expect(() => buildBootstrapAdminSql({ userIds: ['a', 'b'], assignmentIds: ['bad', 'ara_00000000000000b2'] })).toThrow();
    expect(() => buildLocalAccountSql({ email: 'ok@y.test', password: 'short', name: 'x' })).toThrow();
  });
});

describe('admin synthetic fixture', () => {
  it('is deterministic, uses only the reserved .test domain, and applies to both databases', () => {
    const fixture = buildAdminFixtureSql();
    expect(buildAdminFixtureSql()).toEqual(fixture);
    const emails = [...fixture.main.matchAll(/'([^'\s]+@[^'\s]+)'/g)].map((match) => match[1]);
    expect(emails.length).toBeGreaterThan(50);
    expect(emails.every((email) => email.endsWith(`@${FIXTURE_DOMAIN}`))).toBe(true);
    expect(fixture.main).not.toMatch(/INSERT INTO admin_/);
    const main = new SqliteD1();
    const admin = new SqliteD1({ migrate: false });
    applyMigrations(admin, path.resolve('migrations-admin'));
    try {
      main.seed(fixture.main);
      admin.seed(fixture.admin);
      expect(admin.query("SELECT value FROM admin_config_metadata WHERE key = 'fixture_dataset'")).toEqual([{ value: FIXTURE_DATASET }]);
      expect(main.query('SELECT COUNT(*) AS n FROM pragma_foreign_key_check')).toEqual([{ n: 0 }]);
      expect(admin.query("SELECT COUNT(*) AS n FROM admin_role_assignments WHERE status = 'active' AND role = 'SUPER_ADMIN'")).toEqual([{ n: 3 }]);
    } finally {
      main.close();
      admin.close();
    }
  });
});
