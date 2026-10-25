import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { listMigrations, renderSchemaGateSql } from '../../scripts/d1-schema-gate.mjs';
import { STAGING_D1, familyStagingConfig } from '../../scripts/staging-family-migration-check.mjs';
import { REPOSITORY, REPOSITORY_ID } from '../../scripts/domain/audit-cloud.mjs';
import {
  baselineQuery, CHAIN, gate, PRE_TIP, requireDispatch, run, schemaQuery, TIP,
  normalizeSchemaSql, verifyBaseline, verifyBaselinePreserved, verifyCandidateChain, verifySchema,
} from '../../scripts/staging-v2-migration-check.mjs';

const { load } = createRequire(createRequire(import.meta.url).resolve('eslint/package.json'))('js-yaml');
const names = listMigrations().filter(name => name <= TIP);
const result = rows => [{ success: true, results: rows }];
const directories = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function databaseAt(tip) {
  const db = new DatabaseSync(':memory:');
  for (const name of names.filter(name => name <= tip)) db.exec(readFileSync(`migrations/${name}`, 'utf8'));
  return db;
}
function baseline(db) {
  return baselineQuery().split(';').map(query => ({ success: true, results: [db.prepare(query).get()] }));
}
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'v2-migration-'));
  directories.push(directory);
  const write = (name, value) => {
    const file = path.join(directory, name);
    writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
    return file;
  };
  const receipt = write('receipt.json', { sha: 'a'.repeat(40), schema: { version: TIP,
    migrations: names.map(name => ({ name })) }, chain: CHAIN, database: STAGING_D1 });
  return { receipt, write, read: () => JSON.parse(readFileSync(receipt, 'utf8')) };
}

describe('bounded canonical staging 0043->0044->0045 certification', () => {
  it('requires canonical manual main dispatch and identical full checkout/workflow/requested SHA', async () => {
    const env = { GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_REPOSITORY: REPOSITORY, GITHUB_REPOSITORY_ID: REPOSITORY_ID,
      GITHUB_SHA: 'a'.repeat(40), GITHUB_WORKFLOW_SHA: 'a'.repeat(40), MIGRATION_REF: 'a'.repeat(40) };
    expect(() => requireDispatch(env)).not.toThrow();
    expect(() => requireDispatch({ ...env, MIGRATION_REF: undefined }, env.GITHUB_SHA)).not.toThrow();
    for (const [key, value] of [
      ['GITHUB_REF', 'refs/heads/candidate'], ['GITHUB_EVENT_NAME', 'pull_request'],
      ['GITHUB_REPOSITORY', 'hello-tako/Tako-san'], ['GITHUB_REPOSITORY_ID', '1385308553'],
      ['GITHUB_SHA', 'b'.repeat(40)], ['GITHUB_WORKFLOW_SHA', 'b'.repeat(40)], ['MIGRATION_REF', 'main'],
    ]) expect(() => requireDispatch({ ...env, [key]: value }), key).toThrow(/Canonical current-main/);
    const previous = process.env.GITHUB_REF;
    try {
      process.env.GITHUB_REF = 'refs/heads/candidate';
      await expect(gate(env.GITHUB_SHA)).rejects.toThrow(/Canonical current-main/);
    } finally {
      if (previous === undefined) delete process.env.GITHUB_REF;
      else process.env.GITHUB_REF = previous;
    }
    const candidate = { sha: env.GITHUB_SHA, mainSha: env.GITHUB_SHA, schema: { version: TIP }, chain: CHAIN };
    expect(verifyCandidateChain(candidate)).toBe(candidate);
    for (const change of [{ mainSha: 'b'.repeat(40) }, { chain: CHAIN.slice(1) },
      { chain: [...CHAIN].reverse() }, { chain: [...CHAIN, '0046_future.sql'] }, { schema: { version: PRE_TIP } }]) {
      expect(() => verifyCandidateChain({ ...candidate, ...change })).toThrow(/Only current-main/);
    }
    expect(familyStagingConfig()).toEqual(STAGING_D1);
  });

  it('preserves every pre-existing table count and rejects each changed or malformed aggregate', () => {
    const db = databaseAt(PRE_TIP);
    try {
      const before = baseline(db);
      const row = verifyBaseline(before);
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
      expect(tables).toHaveLength(94);
      expect(before.map(group => Object.keys(group.results[0]).length)).toEqual([95, 19]);
      expect(Object.keys(row)).toHaveLength(114);
      for (const { name } of tables) expect(row[name], name).toBe(db.prepare(`SELECT count(*) AS total FROM ${name}`).get().total);
      for (const name of CHAIN) db.exec(readFileSync(`migrations/${name}`, 'utf8'));
      const after = baseline(db);
      expect(verifyBaselinePreserved(result([row]), after)).toEqual({ drift: 'none' });
      for (const key of Object.keys(row)) {
        const drift = structuredClone(after);
        drift.find(group => Object.hasOwn(group.results[0], key)).results[0][key] += 1;
        expect(() => verifyBaselinePreserved(result([row]), drift), key).toThrow(/aggregate drift|500 recipes/);
      }
      for (const malformed of [null, [], result([row]), before.toReversed(), [before[0], before[0]],
        [{ ...before[0], success: false }, before[1]], [{ ...before[0], results: [] }, before[1]]]) {
        expect(() => verifyBaseline(malformed)).toThrow();
      }
      for (const [index, key] of [[0, 'inventory_lots'], [1, 'media_ready']]) {
        for (const value of [null, '0', -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
          const bad = structuredClone(before);
          bad[index].results[0][key] = value;
          expect(() => verifyBaseline(bad)).toThrow(/invalid/);
        }
        const missing = structuredClone(before);
        delete missing[index].results[0][key];
        expect(() => verifyBaseline(missing)).toThrow(/incomplete/);
        const extra = structuredClone(before);
        extra[index].results[0].unexpected = 0;
        expect(() => verifyBaseline(extra)).toThrow(/incomplete/);
      }
      expect(() => verifyBaselinePreserved(before, after)).toThrow(/normalized saved/);
      expect(baselineQuery()).not.toMatch(/SELECT\s+\*|SELECT\s+(?:email|token|response_json)\b/i);
    } finally { db.close(); }
  });

  it('executes both statements at both tips under the actual D1 100-column limit', () => {
    for (const tip of [PRE_TIP, TIP]) {
      const completed = spawnSync('sqlite3', ['-json', ':memory:'], { encoding: 'utf8',
        input: `.bail on\n.limit column 100\n${names.filter(name => name <= tip)
          .map(name => readFileSync(`migrations/${name}`, 'utf8')).join('\n')}\n${baselineQuery()};\n` });
      expect(completed.error).toBeUndefined();
      expect(completed.status, completed.stderr).toBe(0);
      const rows = completed.stdout.replace(/^\s*column\s+100\r?\n/, '').trim().split(/\r?\n/).map(line => JSON.parse(line));
      expect(rows.map(group => Object.keys(group[0]).length)).toEqual([95, 19]);
      expect(verifyBaseline(rows.map(results => ({ success: true, results }))).recipes).toBe(500);
    }
  });

  it.each(['table', 'index', 'trigger'])('rejects every omitted V2 %s', type => {
    const db = databaseAt(TIP);
    try {
      const rows = db.prepare(schemaQuery()).all();
      for (const row of rows.filter(row => row.type === type)) {
        expect(() => verifySchema(result(rows.filter(candidate => candidate !== row))), row.name).toThrow(/differs/);
      }
    } finally { db.close(); }
  });

  it('rejects added or weakened V2 schema and accepts cosmetic comments and spacing', () => {
    const db = databaseAt(TIP);
    try {
      const rows = db.prepare(schemaQuery()).all();
      expect(verifySchema(result(rows)).constraints).toBe('PASS');
      const historical = rows.map(row => ({ ...row, sql: row.sql?.replace(/--[^\r\n]*/g, '') ?? null }));
      expect(rows.find(row => row.name === 'inventory_events').sql).toContain('event_type TEXT NOT NULL, --');
      expect(verifySchema(result(historical)).constraints).toBe('PASS');
      expect(verifySchema(result(historical.map(row => ({ ...row, sql: row.sql?.replaceAll('\n', '  ') ?? null })))).constraints).toBe('PASS');
      expect(verifySchema(result(historical.map(row => ({ ...row, sql: row.sql?.replace('CREATE ', 'CREATE /* cosmetic -- note */ ') ?? null })))).constraints).toBe('PASS');
      expect(() => verifySchema(result([...rows, { name: 'unexpected', type: 'trigger', sql: 'SELECT 1' }]))).toThrow(/differs/);
      expect(() => verifySchema([{ success: false, results: rows }])).toThrow(/successful/);
      for (const [before, after] of [['ON DELETE CASCADE', 'ON DELETE SET NULL'],
        ['length(client_key) BETWEEN 8 AND 200', 'length(client_key) > 0'],
        ['SELECT RAISE(ABORT', 'SELECT RAISE(IGNORE'], ['length(display_category) <= 30', 'length(display_category) <= 300'],
        ["'Inventory display category is invalid'", "'Inventory  display category is invalid'"],
        ["'Week swap receipts are immutable'", "'Week swap receipts -- are immutable'"],
        ["'USE'", "'USE/* changed */'"]]) {
        expect(rows.some(row => row.sql?.includes(before)), before).toBe(true);
        expect(() => verifySchema(result(rows.map(row => ({ ...row, sql: row.sql?.replaceAll(before, after) ?? null }))))).toThrow(/differs/);
      }
    } finally { db.close(); }
  });

  it.each([
    ["  SELECT -- removed\n 'it''s  -- data /* retained */'  ", "SELECT 'it''s  -- data /* retained */'"],
    ['SELECT /* removed */ "a""--  b", `a``/*  b */`, [a--  b]', 'SELECT "a""--  b", `a``/*  b */`, [a--  b]'],
    ['SELECT\t/* one */ -- two\r\n/* three */ 1', 'SELECT 1'],
    ['SELECT 1 -- final comment', 'SELECT 1'],
    ['SELECT 1 -- carriage return\r stays comment\n', 'SELECT 1'],
    ['SELECT\u00a01', 'SELECT\u00a01'],
    [null, null],
  ])('normalizes only SQL comments and unquoted spacing: %j', (sql, expected) => {
    expect(normalizeSchemaSql(sql)).toBe(expected);
  });

  it.each(['apply', 'certify'])('rehearses all receipt stages in %s mode, rejects identity/ledger/plan/data/schema drift', async mode => {
    const db = databaseAt(mode === 'apply' ? PRE_TIP : TIP);
    const { receipt, write, read } = fixture();
    try {
      await expect(run('pre-ledger', receipt, [write('ledger.json', result([]))])).rejects.toThrow(/identity/);
      await expect(run('bookmark', receipt, [])).rejects.toThrow(/ledger/);
      await expect(run('pre-health', receipt, [])).rejects.toThrow(/bookmark/);
      await expect(run('plan', receipt, [])).rejects.toThrow(/health/);
      await expect(run('post', receipt, [])).rejects.toThrow(/plan/);
      await expect(run('identity', receipt, [write('wrong-list.json', [{ name: STAGING_D1.name, uuid: 'wrong' }]),
        write('wrong-info.json', { name: STAGING_D1.name, uuid: 'wrong' })])).rejects.toThrow();
      await run('identity', receipt, [write('list.json', [{ name: STAGING_D1.name, uuid: STAGING_D1.id }]),
        write('info.json', { name: STAGING_D1.name, uuid: STAGING_D1.id })]);
      for (const ledger of [names.slice(0, -1), [...names, '0046_future.sql'], names.slice(1)]) {
        await expect(run('pre-ledger', receipt, [write('bad-ledger.json', result(ledger.map(name => ({ name }))))])).rejects.toThrow(/ledger/);
      }
      const preNames = names.filter(name => name <= (mode === 'apply' ? PRE_TIP : TIP));
      await run('pre-ledger', receipt, [write('pre-ledger.json', result(preNames.map(name => ({ name }))))]);
      expect(read().preLedger.mode).toBe(mode);
      await run('bookmark', receipt, [write('bookmark.json', { bookmark: 'local-rehearsal' })]);
      const fk = write('fk.json', result([]));
      const quick = write('quick.json', result([{ quick_check: 'ok' }]));
      await run('pre-health', receipt, [fk, quick, write('before.json', baseline(db))]);
      await expect(run('plan', receipt, [write('wrong-plan.txt', [...CHAIN, '0046_future.sql'].join('\n'))])).rejects.toThrow();
      await run('plan', receipt, [write('plan.txt', mode === 'apply' ? CHAIN.join('\n') : 'No migrations to apply')]);
      if (mode === 'apply') for (const name of CHAIN) db.exec(readFileSync(`migrations/${name}`, 'utf8'));
      db.exec('CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT)');
      for (const name of names) db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').run(name);
      const post = [write('post-ledger.json', result(names.map(name => ({ name })))), fk, quick,
        write('after.json', baseline(db)), write('schema.json', result(db.prepare(schemaQuery()).all())),
        write('schema-gate.json', result(db.prepare(renderSchemaGateSql()).all()))];
      const drift = baseline(db);
      drift[0].results[0].users += 1;
      await expect(run('post', receipt, [...post.slice(0, 3), write('drift.json', drift), ...post.slice(4)])).rejects.toThrow(/aggregate drift/);
      await expect(run('post', receipt, [...post.slice(0, 4), write('missing-schema.json', result([])), post[5]])).rejects.toThrow(/differs/);
      expect(read().status).toBeUndefined();
      expect(await run('post', receipt, post)).toMatchObject({ status: 'STAGING_0045_V2_CERTIFIED',
        aggregateDrift: 'none', schemaGate: 'PASS', postLedger: { count: 45, tip: TIP }, schemaCheck: { constraints: 'PASS' } });
    } finally { db.close(); }
  });

  it('preserves protected dispatch, main/CI fences, fresh bookmark and explicit staging identity', () => {
    const source = readFileSync('.github/workflows/staging-v2-migrate.yml', 'utf8');
    const workflow = load(source);
    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
    expect(workflow.on.workflow_dispatch.inputs.confirm_staging_migration.default).toBe(false);
    expect(workflow.permissions).toEqual({ contents: 'read', actions: 'read' });
    expect(workflow.concurrency).toEqual({ group: 'frigo-deploy-staging', 'cancel-in-progress': false });
    const job = workflow.jobs.certify;
    expect(job.environment).toBe('staging');
    expect(job.if).toContain(`github.repository == '${REPOSITORY}'`);
    expect(job.if).toContain(`github.repository_id == '${REPOSITORY_ID}'`);
    expect(job.if).toContain("github.ref == 'refs/heads/main'");
    const steps = job.steps;
    expect(steps.filter(step => step.uses).every(step => /@[a-f0-9]{40}$/.test(step.uses))).toBe(true);
    expect(steps.find(step => /Match trusted/.test(step.name)).run).toContain('test "$GITHUB_SHA" = "$WORKFLOW_SHA"');
    const apply = steps.findIndex(step => /Apply only/.test(step.name));
    expect(steps[apply - 1].run).toContain('time-travel info');
    for (const command of ['git fetch origin main', 'recheck', 'pre-ledger', ' plan ']) expect(steps[apply - 2].run).toContain(command);
    for (const line of steps.flatMap(step => (step.run || '').split('\n')).filter(line => /wrangler d1 /.test(line))) {
      if (line.includes('d1 list --json')) continue;
      expect(line).toContain(STAGING_D1.name);
      expect(line).toContain('--config wrangler.staging.jsonc');
    }
    const artifact = steps.find(step => step.uses?.startsWith('actions/upload-artifact@'));
    expect(artifact.if).toBe('always()');
    expect(artifact.with.path).toBe('staging-migration-receipt.json');
    expect(source).not.toMatch(/environment: production|wrangler\.jsonc\b|time-travel restore/);
  });

  it('certifies exact V2 schema under production approval before uploading the receipt', () => {
    const workflow = load(readFileSync('.github/workflows/production-d1-migrate.yml', 'utf8'));
    const steps = workflow.jobs.migrate.steps;
    const step = steps.find(step => /Certify exact V2/.test(step.name));
    expect(workflow.jobs.migrate.environment).toBe('production');
    expect(step.if).toBe("inputs.migration == '0045_week_swap_receipts.sql'");
    expect(step.run).toContain('import { TIP, verifySchema } from "./scripts/staging-v2-migration-check.mjs"');
    expect(step.run).toContain('manifest.migration !== TIP || manifest.postLedger?.tip !== TIP || manifest.schema?.version !== TIP');
    expect(step.run).toContain('manifest.v2Schema = verifySchema(');
    expect(step.run).toContain('frigo-db --remote --yes --config wrangler.jsonc');
    expect(steps.indexOf(step)).toBeGreaterThan(steps.findIndex(step => /Production schema gate/.test(step.name)));
    expect(steps.indexOf(step)).toBeLessThan(steps.findIndex(step => /Save sanitized migration receipt/.test(step.name)));
    expect(step.run).not.toMatch(/migrations apply|wrangler deploy|time-travel restore/);
  });
});
