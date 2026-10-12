import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { requireCanonicalStagingDispatch, schemaQuery, verifyStrictOtpSchema } from '../../scripts/staging-otp-migration-check.mjs';

describe('0040 hosted staging schema certification', () => {
  const dispatch = { GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'hello-tako/Tako-san', GITHUB_REPOSITORY_ID: '1385308553' };
  it('accepts the transferred repository with its immutable identity', () => {
    expect(() => requireCanonicalStagingDispatch(dispatch)).not.toThrow();
  });
  it('rejects a different repository or an unreviewed repository name', () => {
    expect(() => requireCanonicalStagingDispatch({ ...dispatch, GITHUB_REPOSITORY_ID: '1' })).toThrow(/identity/);
    expect(() => requireCanonicalStagingDispatch({ ...dispatch, GITHUB_REPOSITORY: 'vn-tak/Tako-san' })).toThrow(/identity/);
  });
  it('rejects dispatch outside main', () => {
    expect(() => requireCanonicalStagingDispatch({ ...dispatch, GITHUB_REF: 'refs/heads/candidate' })).toThrow(/main/);
  });
  it('accepts the actual migration and rejects omitted or weakened schema objects', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(readFileSync('migrations/0040_strict_otp_foundation.sql', 'utf8'));
      const rows = db.prepare(schemaQuery()).all();
      expect(rows.filter((row) => row.type === 'index')).toHaveLength(2);
      const result = [{ success: true, results: rows }];
      expect(verifyStrictOtpSchema(result)).toMatchObject({ constraints: 'PASS' });
      expect(() => verifyStrictOtpSchema([{ success: true, results: rows.slice(1) }])).toThrow(/differ/);
      const weakened = rows.map((row) => ({ ...row, sql: row.sql.replace('CHECK (ok = 1)', 'CHECK (ok >= 0)') }));
      expect(() => verifyStrictOtpSchema([{ success: true, results: weakened }])).toThrow(/differ/);
      expect(() => verifyStrictOtpSchema([{ success: false, results: rows }])).toThrow(/successful/);
    } finally { db.close(); }
  });
  it('uses the staging environment, exact-main gates, bookmark, plan and final ledger fences', () => {
    const workflow = readFileSync('.github/workflows/staging-otp-migrate.yml', 'utf8');
    expect(workflow).toContain('environment: staging');
    expect(workflow).toContain('git fetch origin main');
    expect(workflow).toContain('time-travel info frigo-db-staging-v3');
    expect(workflow).toContain('scripts/staging-otp-migration-check.mjs plan');
    expect(workflow).toContain('confirm_staging_migration == true');
    expect(workflow).toContain('frigo-db-staging-v3 --remote --config wrangler.staging.jsonc');
    expect(workflow).not.toContain('environment: production');
    expect(workflow).not.toContain('migrations apply frigo-db --remote');
  });
});
