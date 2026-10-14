import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  assertLocalProvisioningAllowed,
  buildAdminFixtureSql,
  buildBootstrapAccountLookupSql,
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

describe('two-person bootstrap SQL', () => {
  it('requires exactly two different, valid emails', () => {
    expect(() => buildBootstrapAccountLookupSql(['a@example.test'])).toThrow(/two/);
    expect(() => buildBootstrapAccountLookupSql(['a@example.test', 'A@Example.test'])).toThrow(/different/);
    expect(() => buildBootstrapAccountLookupSql(["x'@y.test", 'b@example.test'])).toThrow();
    expect(buildBootstrapAccountLookupSql(['B@example.test', 'a@example.test'])).toContain("'b@example.test'");
  });

  it('resolves only verified non-guest accounts, then grants both SUPER_ADMINs once', () => {
    const main = new SqliteD1();
    const admin = new SqliteD1({ migrate: false });
    applyMigrations(admin, path.resolve('migrations-admin'));
    try {
      main.seed(buildLocalAccountSql({ email: 'first@example.test', password: 'long-local-password', name: 'First' }));
      main.seed(buildLocalAccountSql({ email: 'second@example.test', password: 'long-local-password', name: 'Second' }));
      main.seed(buildLocalAccountSql({ email: 'pending@example.test', password: 'long-local-password', name: 'Pending' }));
      main.seed("UPDATE auth_accounts SET is_verified = 0 WHERE email = 'pending@example.test'");
      expect(main.query(buildBootstrapAccountLookupSql(['first@example.test', 'pending@example.test']))).toHaveLength(1);
      const accounts = main.query<{ user_id: string }>(buildBootstrapAccountLookupSql(['first@example.test', 'second@example.test']));
      expect(accounts).toHaveLength(2);
      const statements = buildBootstrapAdminSql({ userIds: accounts.map((row) => row.user_id), assignmentIds: ['ara_00000000000000a1', 'ara_00000000000000b2'] }).split(';\n');
      for (const statement of statements.slice(0, -1)) admin.seed(`${statement};`);
      expect(admin.query(statements.at(-1)!)).toEqual([{ granted: 2 }]);
      expect(admin.query("SELECT role, grant_source, granted_by FROM admin_role_assignments ORDER BY id")).toEqual([
        { role: 'SUPER_ADMIN', grant_source: 'operator_bootstrap', granted_by: null },
        { role: 'SUPER_ADMIN', grant_source: 'operator_bootstrap', granted_by: null },
      ]);
      expect(() => admin.seed("INSERT INTO admin_role_assignments (id, user_id, role, grant_source) VALUES ('ara_00000000000000c3', 'x', 'SUPER_ADMIN', 'operator_bootstrap')")).toThrow(/already been completed/);
    } finally {
      main.close();
      admin.close();
    }
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
      expect(admin.query("SELECT COUNT(*) AS n FROM admin_role_assignments WHERE status = 'active' AND role = 'SUPER_ADMIN'")).toEqual([{ n: 2 }]);
    } finally {
      main.close();
      admin.close();
    }
  });
});
