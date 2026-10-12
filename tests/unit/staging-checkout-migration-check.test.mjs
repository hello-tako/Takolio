import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { schemaQuery, verifyCheckoutSchema } from '../../scripts/staging-checkout-migration-check.mjs';

describe('0041 staging schema certification', () => {
  it('verifies all actual constraints and rejects absent, failed or weakened schema', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(readFileSync('migrations/0041_checkout_admission.sql', 'utf8'));
      const rows = db.prepare(schemaQuery()).all();
      expect(rows).toHaveLength(3);
      expect(verifyCheckoutSchema([{ success: true, results: rows }]).constraints).toBe('PASS');
      expect(() => verifyCheckoutSchema([{ success: false, results: rows }])).toThrow(/successful/);
      expect(() => verifyCheckoutSchema([{ success: true, results: rows.slice(1) }])).toThrow(/differs/);
      const weak = rows.map((row) => ({ ...row, sql: row.sql.replace('BETWEEN 16 AND 128', 'BETWEEN 1 AND 128') }));
      expect(() => verifyCheckoutSchema([{ success: true, results: weak }])).toThrow(/differs/);
    } finally { db.close(); }
  });
  it('keeps staging identity, approval, exact ledger, bookmark and final schema gates', () => {
    const source = readFileSync('.github/workflows/staging-checkout-migrate.yml', 'utf8');
    expect(source).toContain('environment: staging');
    expect(source).toContain('confirm_staging_migration == true');
    expect(source).toContain('time-travel info frigo-db-staging-v3');
    expect(source).toContain('git fetch origin main');
    expect(source).toContain('scripts/staging-checkout-migration-check.mjs plan');
    expect(source).toContain('frigo-db-staging-v3 --remote --config wrangler.staging.jsonc');
    expect(source).not.toContain('environment: production');
    expect(source).not.toContain('migrations apply frigo-db --remote');
  });
});
