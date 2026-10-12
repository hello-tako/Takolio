import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/production-d1-migrate.yml', 'utf8');

describe('production D1 migration runtime proof', () => {
  it('requires exact-main rechecks and actual 0041 constraint certification without disabling approval', () => {
    expect(workflow).toContain('environment: production');
    expect(workflow).toContain('confirm_production_migration == true');
    expect(workflow).toContain('"0041_checkout_admission.sql"].includes(manifest.migration)');
    expect(workflow).toContain("inputs.migration) && steps.pre_ledger.outputs.mode == 'apply'");
    expect(workflow).toContain('manifest.checkoutSchema = verifyCheckoutSchema(');
  });
  it('uses the guarded read-only SELECT runner after migration apply', () => {
    expect(workflow).toContain('node scripts/d1-migration-check.mjs runtime-catalog-query > runtime-catalog.sql');
    expect(workflow).toContain('node scripts/d1-readonly-query.mjs runtime-catalog');
    expect(workflow).toContain('node scripts/d1-migration-check.mjs runtime-catalog migration-manifest.json runtime-catalog.json');
    expect(workflow).not.toContain('--file runtime-catalog.sql');
  });
});
