import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { listMigrations } from '../../scripts/d1-schema-gate.mjs';
import {
  baselineQuery, CHAIN, familyStagingConfig, gate, PRE_TIP, run, schemaQuery, STAGING_D1, TIP,
  verifyBaseline, verifyBaselinePreserved, verifyCandidateChain, verifyFamilySchema,
} from '../../scripts/staging-family-migration-check.mjs';

const { load } = createRequire(createRequire(import.meta.url).resolve('eslint/package.json'))('js-yaml');
const result = (rows) => [{ success: true, results: rows }];
const names = listMigrations();
const directories = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function legacyDatabase() {
  const database = new DatabaseSync(':memory:');
  for (const migration of names.filter((name) => name <= PRE_TIP)) {
    database.exec(readFileSync(`migrations/${migration}`, 'utf8'));
  }
  return database;
}
function schemaRows() {
  const database = new DatabaseSync(':memory:');
  try {
    for (const migration of CHAIN) database.exec(readFileSync(`migrations/${migration}`, 'utf8'));
    return database.prepare(schemaQuery()).all();
  } finally { database.close(); }
}
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'family-migration-'));
  directories.push(directory);
  const write = (name, data) => {
    const file = path.join(directory, name);
    writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
    return file;
  };
  const receipt = write('receipt.json', { sha: 'a'.repeat(40), schema: { version: TIP,
    migrations: names.map((name) => ({ name })) }, chain: CHAIN, database: STAGING_D1 });
  return { receipt, write, read: () => JSON.parse(readFileSync(receipt, 'utf8')) };
}

const workflowText = readFileSync('.github/workflows/staging-family-meals-migrate.yml', 'utf8');

describe('bounded staging 0041->0042->0043 family migration', () => {
  it('requires current main and exactly the reviewed ordered two-migration chain', () => {
    const candidate = { sha: 'a'.repeat(40), mainSha: 'a'.repeat(40), schema: { version: TIP }, chain: CHAIN };
    expect(verifyCandidateChain(candidate)).toBe(candidate);
    expect(() => verifyCandidateChain({ ...candidate, mainSha: 'b'.repeat(40) })).toThrow(/current main/);
    for (const chain of [[CHAIN[1]], [...CHAIN].reverse(), [...CHAIN, '0044_unreviewed.sql']]) {
      expect(() => verifyCandidateChain({ ...candidate, chain })).toThrow(/exact reviewed/);
    }
    expect(() => verifyCandidateChain({ ...candidate, schema: { version: '0044_unreviewed.sql' } }))
      .toThrow(/exact reviewed/);
  });

  it('rejects a branch dispatch before any hosted CI or D1 call', async () => {
    const previous = process.env.GITHUB_REF;
    try {
      process.env.GITHUB_REF = 'refs/heads/candidate';
      await expect(gate('a'.repeat(40))).rejects.toThrow(/main/);
    } finally {
      if (previous === undefined) delete process.env.GITHUB_REF;
      else process.env.GITHUB_REF = previous;
    }
  });

  it('pins the exact staging identity in addition to the generic staging config guard', () => {
    const text = readFileSync('wrangler.staging.jsonc', 'utf8');
    expect(familyStagingConfig(text)).toEqual(STAGING_D1);
    expect(() => familyStagingConfig(text.replace(STAGING_D1.id, 'b'.repeat(36)))).toThrow(/pinned staging/);
  });

  it('compares every new table, explicit and automatic index, trigger and constraint', () => {
    const rows = schemaRows();
    expect(rows.filter((row) => row.type === 'table')).toHaveLength(11);
    expect(rows.filter((row) => row.type === 'trigger')).toHaveLength(2);
    expect(rows.filter((row) => row.type === 'index' && row.sql !== null)).toHaveLength(2);
    expect(rows.some((row) => row.name.startsWith('sqlite_autoindex_'))).toBe(true);
    expect(verifyFamilySchema(result(rows))).toMatchObject({ constraints: 'PASS' });
    expect(() => verifyFamilySchema([{ success: false, results: rows }])).toThrow(/successful/);
    expect(() => verifyFamilySchema(result(rows.slice(1)))).toThrow(/differ/);
    const added = [...rows, { type: 'index', name: 'unreviewed', sql: 'CREATE INDEX unreviewed ON shopping_demand_reviews(decision)' }];
    expect(() => verifyFamilySchema(result(added))).toThrow(/differ/);
    expect(() => verifyFamilySchema(result(rows.filter((row) => row.type !== 'trigger')))).toThrow(/differ/);
    for (const [before, after] of [
      ['revision >= 1', 'revision >= 0'], ['json_valid(preferences_json)', '1'],
      ['ON DELETE CASCADE', 'ON DELETE SET NULL'], ['length(demand_fingerprint) = 64', 'length(demand_fingerprint) > 0'],
      ["'pending', 'purchased', 'skipped'", "'pending', 'purchased', 'skipped', 'unsafe'"],
      ['WHEN EXISTS', 'WHEN NOT EXISTS'], ['SELECT RAISE(ABORT', 'SELECT RAISE(IGNORE'],
    ]) {
      const weakened = rows.map((row) => ({ ...row, sql: row.sql?.replaceAll(before, after) ?? null }));
      expect(() => verifyFamilySchema(result(weakened)), before).toThrow(/differ/);
    }
    const whitespace = rows.map((row) => ({ ...row, sql: row.sql?.replaceAll('\n', '   ') ?? null }));
    expect(verifyFamilySchema(result(whitespace)).constraints).toBe('PASS');
  });

  it('captures only counts for all 83 legacy tables and media diagnostics and preserves them exactly', () => {
    const database = legacyDatabase();
    try {
      const sql = baselineQuery();
      const row = database.prepare(sql).get();
      expect(Object.keys(row)).toHaveLength(103);
      const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
      expect(tables).toHaveLength(83);
      for (const { name } of tables) expect(row[name], name).toBe(database.prepare(`SELECT COUNT(*) AS count FROM ${name}`).get().count);
      expect(row).toMatchObject({ recipes: 500, recipe_media: 500, media_total: 500, media_ready: 0,
        shopping_lists: 1, shopping_items: 0, generated_meal_plans: 0, inventory_lots: 0 });
      expect(verifyBaseline(result([row]))).toEqual(row);
      expect(verifyBaselinePreserved(result([row]), result([row]))).toMatchObject({ drift: 'none', media: 'unchanged' });
      for (const key of ['inventory_lots', 'shopping_items', 'recipe_media', 'media_ready', 'generated_meal_plan_components']) {
        expect(() => verifyBaselinePreserved(result([row]), result([{ ...row, [key]: row[key] + 1 }])))
          .toThrow(/aggregate drift/);
      }
      const missing = { ...row };
      delete missing.media_total;
      expect(() => verifyBaseline(result([missing]))).toThrow(/incomplete/);
      expect(() => verifyBaseline(result([{ ...row, unexpected: 0 }]))).toThrow(/incomplete/);
      expect(() => verifyBaseline(result([{ ...row, media_ready: null }]))).toThrow(/invalid/);
      expect(() => verifyBaseline(result([{ ...row, recipes: 499 }]))).toThrow(/500 recipes/);
      expect(() => verifyBaseline(result([row, row]))).toThrow(/one successful/);
      expect(sql).not.toMatch(/SELECT\s+\*|SELECT\s+(?:email|token|preferences_json|response_json)\b/i);
    } finally { database.close(); }
  });

  it('fails closed before each required receipt stage and rejects partial or unknown ledgers', async () => {
    const { receipt, write, read } = fixture();
    const pre = write('pre.json', result(names.filter((name) => name <= PRE_TIP).map((name) => ({ name }))));
    await expect(run('pre-ledger', receipt, [pre])).rejects.toThrow(/identity/);
    await expect(run('bookmark', receipt, [write('bookmark.json', { bookmark: 'test' })])).rejects.toThrow(/ledger/);
    await expect(run('pre-health', receipt, [])).rejects.toThrow(/bookmark/);
    await expect(run('plan', receipt, [])).rejects.toThrow(/health/);
    await expect(run('post', receipt, [])).rejects.toThrow(/plan/);
    await run('identity', receipt, [write('list.json', [{ name: STAGING_D1.name, uuid: STAGING_D1.id }]),
      write('info.json', { name: STAGING_D1.name, uuid: STAGING_D1.id })]);
    await expect(run('pre-ledger', receipt, [write('partial.json', result(names.slice(0, -1).map((name) => ({ name })) ))]))
      .rejects.toThrow(/ledger/);
    await expect(run('pre-ledger', receipt, [write('later.json', result([...names, '0044_unreviewed.sql'].map((name) => ({ name })) ))]))
      .rejects.toThrow(/ledger/);
    await run('pre-ledger', receipt, [pre]);
    expect(read().preLedger).toMatchObject({ mode: 'apply', tip: PRE_TIP, chain: CHAIN });
    await expect(run('bookmark', receipt, [write('empty-bookmark.json', {})])).rejects.toThrow(/bookmark/);
  });

  it('certifies the complete local rehearsal and rejects plan or post-migration data drift', async () => {
    const database = legacyDatabase();
    try {
      const { receipt, write, read } = fixture();
      const baseline = result([database.prepare(baselineQuery()).get()]);
      const fk = write('fk.json', result([]));
      const quick = write('quick.json', result([{ quick_check: 'ok' }]));
      await run('identity', receipt, [write('list.json', [{ name: STAGING_D1.name, uuid: STAGING_D1.id }]),
        write('info.json', { name: STAGING_D1.name, uuid: STAGING_D1.id })]);
      await run('pre-ledger', receipt, [write('pre-ledger.json', result(names.filter((name) => name <= PRE_TIP).map((name) => ({ name })) ))]);
      await run('bookmark', receipt, [write('bookmark.json', { bookmark: 'local-rehearsal' })]);
      await run('pre-health', receipt, [fk, quick, write('before.json', baseline)]);
      for (const plan of [CHAIN[0], [...CHAIN].reverse().join('\n'), `${CHAIN.join('\n')}\n0044_unreviewed.sql`]) {
        await expect(run('plan', receipt, [write('wrong-plan.txt', plan)])).rejects.toThrow(/exactly/);
      }
      await run('plan', receipt, [write('plan.txt', CHAIN.join('\n'))]);
      for (const migration of CHAIN) database.exec(readFileSync(`migrations/${migration}`, 'utf8'));
      const after = result([database.prepare(baselineQuery()).get()]);
      const postArgs = [write('post-ledger.json', result(names.map((name) => ({ name })))), fk, quick,
        write('after.json', after), write('schema.json', result(database.prepare(schemaQuery()).all())),
        write('schema-gate.json', result([]))];
      const drift = result([{ ...after[0].results[0], media_total: 501 }]);
      await expect(run('post', receipt, [...postArgs.slice(0, 3), write('drift.json', drift), ...postArgs.slice(4)]))
        .rejects.toThrow(/media_total/);
      expect(read().status).toBeUndefined();
      const completed = await run('post', receipt, postArgs);
      expect(completed).toMatchObject({ status: 'STAGING_0043_FAMILY_MEALS_CERTIFIED', aggregateDrift: 'none',
        postLedger: { count: 43, tip: TIP }, schemaCheck: { constraints: 'PASS' }, schemaGate: 'PASS' });
      expect(completed.timeTravel.bookmark).toBe('local-rehearsal');
      await run('pre-ledger', receipt, [postArgs[0]]);
      expect(read().preLedger).toMatchObject({ mode: 'certify', tip: TIP, chain: [] });
      await expect(run('plan', receipt, [write('nonempty-certify-plan.txt', CHAIN.join('\n'))]))
        .rejects.toThrow(/empty/);
      await run('plan', receipt, [write('certify-plan.txt', 'No migrations to apply')]);
    } finally { database.close(); }
  });

  it('refreshes exact-SHA CI during the final gate and rejects candidate schema or identity movement', async () => {
    const { receipt, read } = fixture();
    const initial = read();
    const candidateGate = async (ref) => {
      expect(ref).toBe(initial.sha);
      return { ...initial, ci: { sha: ref, url: 'https://example.invalid/ci' } };
    };
    await run('recheck', receipt, [], { gate: candidateGate });
    expect(read().ci.sha).toBe(initial.sha);
    await expect(run('recheck', receipt, [], { gate: async () => ({ ...initial,
      schema: { ...initial.schema, version: '0044_unreviewed.sql' } }) })).rejects.toThrow(/Candidate changed/);
    await expect(run('recheck', receipt, [], { gate: async () => ({ ...initial,
      database: { ...STAGING_D1, id: 'unexpected' } }) })).rejects.toThrow(/Candidate changed/);
  });

  it('certifies the same exact family schema on production 0043 before saving its receipt', () => {
    const source = readFileSync('.github/workflows/production-d1-migrate.yml', 'utf8');
    const steps = load(source).jobs.migrate.steps;
    const schema = steps.find((step) => step.name === 'Certify exact family meal tables, indexes and review triggers after 0043');
    expect(schema.if).toBe("inputs.migration == '0043_shopping_demand_review.sql'");
    expect(schema.env.CLOUDFLARE_API_TOKEN).toBe('${{ secrets.CLOUDFLARE_API_TOKEN }}');
    expect(schema.env.CLOUDFLARE_ACCOUNT_ID).toBe('${{ secrets.CLOUDFLARE_ACCOUNT_ID }}');
    expect(steps.indexOf(schema)).toBeGreaterThan(steps.findIndex((step) => step.name === 'Post-migration ledger'));
    expect(steps.indexOf(schema)).toBeGreaterThan(steps.findIndex((step) => step.name === 'Production schema gate (read-only)'));
    expect(steps.indexOf(schema)).toBeLessThan(steps.findIndex((step) => step.name === 'Save sanitized migration receipt (even on failure)'));
    expect(schema.run).toContain('node scripts/staging-family-migration-check.mjs query schema');
    expect(schema.run).toContain('pnpm wrangler d1 execute frigo-db --remote --yes --config wrangler.jsonc --json --command "$query" > family-meal-schema.json');
    expect(schema.run).toContain('import { TIP, verifyFamilySchema } from "./scripts/staging-family-migration-check.mjs"');
    expect(schema.run).toContain('manifest.migration !== TIP || manifest.postLedger?.tip !== TIP || manifest.schema?.version !== TIP');
    expect(schema.run).toContain('manifest.familyMealSchema = verifyFamilySchema(JSON.parse(readFileSync("family-meal-schema.json", "utf8")))');
    expect(schema.run).toContain('writeFileSync("migration-manifest.json"');
    expect(schema.run).not.toMatch(/migrations apply|wrangler deploy|time-travel restore|--file\s/);
    expect(schemaQuery()).toMatch(/^SELECT type, name, sql FROM sqlite_master WHERE tbl_name IN \(.+\) ORDER BY name$/);
  });

  it('uses manual staging approval, pinned actions, immediate main/CI/ledger/plan rechecks and sanitized receipt', () => {
    const workflow = load(workflowText);
    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
    expect(workflow.on.workflow_dispatch.inputs.confirm_staging_migration.default).toBe(false);
    expect(workflow.permissions).toEqual({ contents: 'read', actions: 'read' });
    expect(workflow.concurrency).toEqual({ group: 'frigo-deploy-staging', 'cancel-in-progress': false });
    const job = workflow.jobs.certify;
    expect(job.environment).toBe('staging');
    expect(job.if).toContain("github.ref == 'refs/heads/main'");
    expect(job.if).toContain("github.repository_id == '1385308553'");
    expect(job.if).toContain('inputs.confirm_staging_migration == true');
    const steps = job.steps;
    expect(steps.filter((step) => step.uses).every((step) => /@[a-f0-9]{40}$/.test(step.uses))).toBe(true);
    const apply = steps.findIndex((step) => /Apply only/.test(step.name));
    const before = steps.slice(0, apply).map((step) => step.run || '').join('\n');
    expect(before).toContain('time-travel info frigo-db-staging-v3');
    expect(before).not.toMatch(/wrangler d1 migrations apply|wrangler deploy|time-travel restore/);
    expect(steps[apply - 1].run).toContain('git fetch origin main');
    expect(steps[apply - 1].run).toContain('staging-family-migration-check.mjs recheck');
    expect(steps[apply - 1].run).toContain('staging-family-migration-check.mjs pre-ledger');
    expect(steps[apply - 1].run).toContain('staging-family-migration-check.mjs plan');
    for (const line of steps.flatMap((step) => (step.run || '').split('\n')).filter((line) => /wrangler d1 /.test(line))) {
      if (line.includes('d1 list --json')) continue;
      expect(line).toContain(STAGING_D1.name);
      expect(line).toContain('--config wrangler.staging.jsonc');
      expect(line).not.toContain('frigo-db --');
    }
    const artifact = steps.find((step) => step.uses?.startsWith('actions/upload-artifact@'));
    expect(artifact.with.path).toBe('staging-migration-receipt.json');
    expect(artifact.if).toBe('always()');
    expect(workflowText).toContain('scripts/d1-schema-gate.mjs render');
    expect(workflowText).not.toContain('environment: production');
    expect(workflowText).not.toMatch(/wrangler\.jsonc\b|time-travel restore/);
    const gateSource = readFileSync('scripts/staging-family-migration-check.mjs', 'utf8');
    expect(gateSource).toContain('await hostedCi(candidate.sha');
    expect(gateSource).toContain('await requireCurrentHostedMain({ sha: candidate.sha');
  });
});
