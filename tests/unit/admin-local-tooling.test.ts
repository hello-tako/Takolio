import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  assertLocalProvisioningAllowed,
  buildAdminFixtureSql,
  buildBootstrapSql,
  buildLocalAccountSql,
  FIXTURE_DATASET,
  FIXTURE_DOMAIN,
} from '../../scripts/admin-local-lib.mjs';
import { SqliteD1 } from '../helpers/sqlite-d1';

const DEV = { ENVIRONMENT: 'development' };

describe('admin local provisioning guard', () => {
  it('requires an explicit --local flag', () => {
    expect(() => assertLocalProvisioningAllowed({ argv: [], env: DEV })).toThrow(/--local/);
  });
  it.each(['--remote', '--env=production', '--env', '--preview', '--production'])('refuses %s', (flag) => {
    expect(() => assertLocalProvisioningAllowed({ argv: ['--local', flag], env: DEV })).toThrow(/Refusing/);
  });
  it.each(['production', 'staging'])('refuses ENVIRONMENT=%s', (environment) => {
    expect(() => assertLocalProvisioningAllowed({ argv: ['--local'], env: { ENVIRONMENT: environment } })).toThrow(/development/);
  });
  it('refuses CI and reachable Cloudflare credentials', () => {
    expect(() => assertLocalProvisioningAllowed({ argv: ['--local'], env: { ...DEV, CI: 'true' } })).toThrow(/CI/);
    expect(() => assertLocalProvisioningAllowed({ argv: ['--local'], env: { ...DEV, GITHUB_ACTIONS: 'true' } })).toThrow(/CI/);
    expect(() => assertLocalProvisioningAllowed({ argv: ['--local'], env: { ...DEV, CLOUDFLARE_API_TOKEN: 'x' } })).toThrow(/CLOUDFLARE_API_TOKEN/);
  });
  it('allows local development', () => {
    expect(() => assertLocalProvisioningAllowed({ argv: ['--local'], env: DEV })).not.toThrow();
  });
  it('the CLI exits non-zero for a remote request without touching wrangler', () => {
    const result = spawnSync(process.execPath, ['scripts/admin-provision.mjs', '--remote', '--email', 'a@b.test'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Refusing/);
  });
  it('the CLI refuses production even with --local', () => {
    const result = spawnSync(process.execPath, ['scripts/admin-provision.mjs', '--local', '--email', 'a@b.test'], { encoding: 'utf8', env: { PATH: process.env.PATH, ENVIRONMENT: 'production' } });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/ENVIRONMENT=production/);
  });
});

describe('admin bootstrap SQL', () => {
  function grant(db: SqliteD1, email: string, suffix: string) {
    const statements = buildBootstrapSql({ email, assignmentId: `ara_${suffix.padEnd(16, '0')}` }).split(';\n').filter(Boolean);
    for (const statement of statements.slice(0, -1)) db.seed(`${statement};`);
    return db.query<{ granted: number }>(statements.at(-1)!)[0].granted;
  }

  it('grants SUPER_ADMIN once to a verified account and is a no-op afterwards', () => {
    const db = new SqliteD1();
    try {
      db.seed(buildLocalAccountSql({ email: 'First@Example.test', password: 'long-local-password', name: 'First' }));
      db.seed(buildLocalAccountSql({ email: 'second@example.test', password: 'long-local-password', name: 'Second' }));
      expect(grant(db, 'first@example.test', 'a1')).toBe(1);
      expect(grant(db, 'second@example.test', 'b2')).toBe(0);
      expect(db.query('SELECT role, grant_source, granted_by FROM admin_role_assignments')).toEqual([
        { role: 'SUPER_ADMIN', grant_source: 'local_bootstrap', granted_by: null },
      ]);
      expect(db.query("SELECT action, outcome FROM admin_audit_events")).toEqual([{ action: 'admin.bootstrap.local', outcome: 'success' }]);
    } finally {
      db.close();
    }
  });

  it('does not grant to unknown, unverified or guest users', () => {
    const db = new SqliteD1();
    try {
      db.seed(buildLocalAccountSql({ email: 'pending@example.test', password: 'long-local-password', name: 'Pending' }));
      db.seed("UPDATE auth_accounts SET is_verified = 0 WHERE email = 'pending@example.test'");
      expect(grant(db, 'nobody@example.test', 'c3')).toBe(0);
      expect(grant(db, 'pending@example.test', 'd4')).toBe(0);
    } finally {
      db.close();
    }
  });

  it('rejects malformed input before building SQL', () => {
    expect(() => buildBootstrapSql({ email: "x'@y.test", assignmentId: 'ara_0000000000000000' })).toThrow();
    expect(() => buildBootstrapSql({ email: 'ok@y.test', assignmentId: 'bad' })).toThrow();
    expect(() => buildLocalAccountSql({ email: 'ok@y.test', password: 'short', name: 'x' })).toThrow();
  });
});

describe('admin synthetic fixture', () => {
  it('is deterministic, labelled, uses only the reserved .test domain and applies on the full ledger', () => {
    const sql = buildAdminFixtureSql();
    expect(buildAdminFixtureSql()).toBe(sql);
    const emails = [...sql.matchAll(/'([^'\s]+@[^'\s]+)'/g)].map((match) => match[1]);
    expect(emails.length).toBeGreaterThan(50);
    expect(emails.every((email) => email.endsWith(`@${FIXTURE_DOMAIN}`))).toBe(true);
    const db = new SqliteD1();
    try {
      db.seed(sql);
      expect(db.query("SELECT value FROM admin_config_metadata WHERE key = 'fixture_dataset'")).toEqual([{ value: FIXTURE_DATASET }]);
      expect(db.query('SELECT COUNT(*) AS n FROM pragma_foreign_key_check')).toEqual([{ n: 0 }]);
      expect(db.query("SELECT COUNT(*) AS n FROM admin_role_assignments WHERE status = 'active' AND role = 'SUPER_ADMIN'")).toEqual([{ n: 2 }]);
    } finally {
      db.close();
    }
  });
});
