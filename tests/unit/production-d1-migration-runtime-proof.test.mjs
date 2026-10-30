import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/production-d1-migrate.yml', 'utf8');
const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve('eslint/package.json'))('js-yaml');
const policy = load(workflow);
const familyTips = ['0042_family_meals_preferences_saved_shopping.sql', '0043_shopping_demand_review.sql',
  '0044_inventory_display_category.sql', '0045_week_swap_receipts.sql', '0046_recipe_content_versions.sql', '0047_saved_recipe_content.sql'];

describe('production D1 migration runtime proof', () => {
  it('keeps production approval and actual 0041 constraint certification', () => {
    expect(policy.jobs.migrate.environment).toBe('production');
    expect(policy.jobs.gate.if).toBe("github.ref == 'refs/heads/main' && inputs.confirm_production_migration == true");
    expect(policy.on.workflow_dispatch.inputs.confirm_production_migration.default).toBe(false);
    expect(workflow).toContain('manifest.checkoutSchema = verifyCheckoutSchema(');
  });
  it.each(familyTips)('rechecks hosted current main and CI after approval and before applying %s', (tip) => {
    const steps = policy.jobs.migrate.steps;
    const initialFence = steps.find((step) => step.name === 'Recheck candidate after environment approval');
    const finalFence = steps.find((step) => step.name === 'Recheck current main and CI immediately before migration');
    const apply = steps.find((step) => step.name === 'Apply the pinned chain through the Wrangler ledger');
    const initialTips = JSON.parse(initialFence.run.match(/if \((\[[^\n]+\])\.includes\(manifest\.migration\)\)/)[1]);
    const finalTips = JSON.parse(finalFence.if.match(/fromJSON\('(\[[^']+\])'\)/)[1]);
    expect(initialTips).toContain(tip);
    expect(finalTips).toContain(tip);
    expect(finalTips).toEqual(initialTips);
    expect(finalFence.if).toContain("steps.pre_ledger.outputs.mode == 'apply'");
    expect(steps.indexOf(finalFence)).toBe(steps.indexOf(apply) - 1);
    expect(initialFence.run).toContain('migrationManifest(process.cwd(), manifest.sha).sha256 !== manifest.schema.sha256');
    for (const fence of [initialFence, finalFence]) {
      expect(fence.env.GH_TOKEN).toBe('${{ github.token }}');
      expect(fence.run).toContain('manifest.repository !== process.env.GITHUB_REPOSITORY');
      expect(fence.run).toContain('await hostedCi(manifest.sha, manifest.repository)');
      expect(fence.run).toContain('await requireCurrentHostedMain({ sha: manifest.sha, repository: manifest.repository })');
    }
    expect(apply.run).toContain('pnpm wrangler d1 migrations apply frigo-db --remote');
    expect(apply.run).toContain('node scripts/d1-migration-check.mjs applied migration-manifest.json');
  });
  it('certifies the exact 0046 archive, household grants and immutable cooking references before saving the receipt', () => {
    const steps = policy.jobs.migrate.steps;
    const certification = steps.find(step => step.name === 'Certify exact recipe content archive and cooking receipt schema after 0046');
    const schemaGate = steps.find(step => step.name === 'Production schema gate (read-only)');
    const receipt = steps.find(step => step.name === 'Save sanitized migration receipt (even on failure)');
    expect(certification.if).toBe("inputs.migration == '0046_recipe_content_versions.sql'");
    expect(certification.env.CLOUDFLARE_API_TOKEN).toBe('${{ secrets.CLOUDFLARE_API_TOKEN }}');
    expect(certification.run).toContain('process.stdout.write(schemaQuery(CONTENT_TIP))');
    expect(certification.run).toContain('pnpm wrangler d1 execute frigo-db --remote --yes --config wrangler.jsonc --json --command "$query" > content-schema.json');
    expect(certification.run).toContain('manifest.migration !== CONTENT_TIP || manifest.postLedger?.tip !== CONTENT_TIP || manifest.schema?.version !== CONTENT_TIP');
    expect(certification.run).toContain('manifest.contentSchema = verifySchema(JSON.parse(readFileSync("content-schema.json", "utf8")), CONTENT_TIP)');
    expect(steps.indexOf(certification)).toBeGreaterThan(steps.indexOf(schemaGate));
    expect(steps.indexOf(certification)).toBeLessThan(steps.indexOf(receipt));
  });
  it('uses the guarded read-only SELECT runner after migration apply', () => {
    expect(workflow).toContain('node scripts/d1-migration-check.mjs runtime-catalog-query > runtime-catalog.sql');
    expect(workflow).toContain('node scripts/d1-readonly-query.mjs runtime-catalog');
    expect(workflow).toContain('node scripts/d1-migration-check.mjs runtime-catalog migration-manifest.json runtime-catalog.json');
    expect(workflow).not.toContain('--file runtime-catalog.sql');
  });
});

it('certifies the exact 0047 composition, archive and cooking schema before saving the production receipt', () => {
  const steps = policy.jobs.migrate.steps;
  const certification = steps.find(step => step.name === 'Certify exact saved recipe content schema after 0047');
  expect(certification.if).toBe("inputs.migration == '0047_saved_recipe_content.sql'");
  expect(certification.run).toContain('process.stdout.write(schemaQuery(SAVED_CONTENT_TIP))');
  expect(certification.run).toContain('manifest.migration !== SAVED_CONTENT_TIP || manifest.postLedger?.tip !== SAVED_CONTENT_TIP || manifest.schema?.version !== SAVED_CONTENT_TIP');
  expect(certification.run).toContain('manifest.savedContentSchema = verifySchema(JSON.parse(readFileSync("saved-content-schema.json", "utf8")), SAVED_CONTENT_TIP)');
  expect(steps.indexOf(certification)).toBeGreaterThan(steps.indexOf(steps.find(step => step.name === 'Production schema gate (read-only)')));
  expect(steps.indexOf(certification)).toBeLessThan(steps.indexOf(steps.find(step => step.name === 'Save sanitized migration receipt (even on failure)')));
});
