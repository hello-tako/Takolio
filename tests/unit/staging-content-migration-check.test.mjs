import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { listMigrations, renderSchemaGateSql } from '../../scripts/d1-schema-gate.mjs';
import { STAGING_D1 } from '../../scripts/staging-family-migration-check.mjs';
import {
  baselineQuery, CONTENT_TIP, run, schemaQuery, TIP, verifyBaseline,
  verifyBaselinePreserved, verifyCandidateChain, verifySchema,
} from '../../scripts/staging-v2-migration-check.mjs';

const { load } = createRequire(createRequire(import.meta.url).resolve('eslint/package.json'))('js-yaml');
const names = listMigrations().filter(name => name <= CONTENT_TIP);
const result = results => [{ success: true, results }];
const baseline = db => baselineQuery(CONTENT_TIP).split(';').map(query => ({ success: true, results: [db.prepare(query).get()] }));
const directories = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function databaseAt(tip) {
  const db = new DatabaseSync(':memory:');
  for (const name of names.filter(name => name <= tip)) db.exec(readFileSync(`migrations/${name}`, 'utf8'));
  return db;
}
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'content-migration-'));
  directories.push(directory);
  const write = (name, value) => {
    const file = path.join(directory, name);
    writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
    return file;
  };
  const receipt = write('receipt.json', { sha: 'a'.repeat(40), schema: { version: CONTENT_TIP,
    migrations: names.map(name => ({ name })) }, chain: [CONTENT_TIP], database: STAGING_D1 });
  return { receipt, write, read: () => JSON.parse(readFileSync(receipt, 'utf8')) };
}

describe('bounded canonical staging 0045->0046 content archive certification', () => {
  it('pins the only reviewed content chain and rejects earlier or later migrations', async () => {
    const candidate = { sha: 'a'.repeat(40), mainSha: 'a'.repeat(40), schema: { version: CONTENT_TIP }, chain: [CONTENT_TIP] };
    expect(verifyCandidateChain(candidate, CONTENT_TIP)).toBe(candidate);
    for (const change of [{ mainSha: 'b'.repeat(40) }, { schema: { version: TIP } },
      { chain: [TIP, CONTENT_TIP] }, { chain: [] }, { chain: [CONTENT_TIP, '0047_future.sql'] }]) {
      expect(() => verifyCandidateChain({ ...candidate, ...change }, CONTENT_TIP)).toThrow(/Only current-main/);
    }
    expect(() => verifyCandidateChain(candidate, '0047_future.sql')).toThrow(/Only reviewed staging/);
    const { receipt, write, read } = fixture();
    const previous = process.env.MIGRATION_TIP;
    try {
      process.env.MIGRATION_TIP = '0047_future.sql';
      expect(await run('query', 'baseline', [receipt])).toBe(baselineQuery(CONTENT_TIP));
      expect(await run('query', 'schema', [receipt])).toBe(schemaQuery(CONTENT_TIP));
      const changed = read();
      changed.chain = [TIP, CONTENT_TIP];
      await expect(run('query', 'schema', [write('bad-receipt.json', changed)])).rejects.toThrow(/Only current-main/);
      changed.chain = [CONTENT_TIP];
      changed.schema.version = '0047_future.sql';
      await expect(run('query', 'schema', [write('bad-receipt.json', changed)])).rejects.toThrow(/Only reviewed staging/);
    } finally {
      if (previous === undefined) delete process.env.MIGRATION_TIP;
      else process.env.MIGRATION_TIP = previous;
    }
  });

  it('preserves all 0045 aggregates and stays within the actual D1 column limit', () => {
    const db = databaseAt(TIP);
    try {
      const before = baseline(db);
      const row = verifyBaseline(before, CONTENT_TIP);
      expect(row).toHaveProperty('week_swap_receipts', 0);
      db.exec(readFileSync(`migrations/${CONTENT_TIP}`, 'utf8'));
      expect(verifyBaselinePreserved(result([row]), baseline(db), CONTENT_TIP)).toEqual({ drift: 'none' });
      const drift = baseline(db);
      drift[0].results[0].week_swap_receipts += 1;
      expect(() => verifyBaselinePreserved(result([row]), drift, CONTENT_TIP)).toThrow(/aggregate drift/);
    } finally { db.close(); }
    for (const tip of [TIP, CONTENT_TIP]) {
      const completed = spawnSync('sqlite3', ['-json', ':memory:'], { encoding: 'utf8',
        input: `.bail on\n.limit column 100\n${names.filter(name => name <= tip)
          .map(name => readFileSync(`migrations/${name}`, 'utf8')).join('\n')}\n${baselineQuery(CONTENT_TIP)};\n` });
      expect(completed.error).toBeUndefined();
      expect(completed.status, completed.stderr).toBe(0);
      const rows = completed.stdout.replace(/^\s*column\s+100\r?\n/, '').trim().split(/\r?\n/).map(line => JSON.parse(line));
      expect(rows.every(group => Object.keys(group[0]).length <= 100)).toBe(true);
      expect(verifyBaseline(rows.map(results => ({ success: true, results })), CONTENT_TIP).recipes).toBe(500);
    }
  });

  it('certifies exact archive, household access and cooking schemas, including immutable references', () => {
    const db = databaseAt(CONTENT_TIP);
    try {
      const rows = db.prepare(schemaQuery(CONTENT_TIP)).all();
      expect(verifySchema(result(rows), CONTENT_TIP).constraints).toBe('PASS');
      for (const row of rows) {
        expect(() => verifySchema(result(rows.filter(candidate => candidate !== row)), CONTENT_TIP), row.name).toThrow(/differs/);
      }
      for (const [before, after] of [
        ['PRIMARY KEY (household_id, fingerprint)', 'PRIMARY KEY (fingerprint)'],
        ['REFERENCES households(id) ON DELETE CASCADE', 'REFERENCES households(id)'],
        ['REFERENCES recipe_content_versions(fingerprint)', 'REFERENCES recipes(id)'],
        ['request_fingerprint TEXT', 'request_fingerprint INTEGER'],
        ['recipe_content_fingerprint TEXT', 'recipe_content_fingerprint INTEGER'],
        ['length(fingerprint) = 64', 'length(fingerprint) > 0'],
        ["'$.slug') IS slug", "'$.slug') IS NOT NULL"],
        ['OR NEW.recipe_content_fingerprint IS NOT OLD.recipe_content_fingerprint', 'OR 0'],
        ['NEW.request_fingerprint IS NOT OLD.request_fingerprint', '0'],
        ['SELECT RAISE(ABORT', 'SELECT RAISE(IGNORE'],
      ]) {
        expect(rows.some(row => row.sql?.includes(before)), before).toBe(true);
        expect(() => verifySchema(result(rows.map(row => ({ ...row, sql: row.sql?.replaceAll(before, after) ?? null }))), CONTENT_TIP), before).toThrow(/differs/);
      }
      expect(() => verifySchema(result([...rows, { name: 'unexpected', type: 'trigger', sql: 'SELECT 1' }]), CONTENT_TIP)).toThrow(/differs/);
      expect(verifySchema(result(rows.map(row => ({ ...row, sql: row.sql?.replace('CREATE ', 'CREATE /* cosmetic */ ') ?? null }))), CONTENT_TIP).constraints).toBe('PASS');
    } finally { db.close(); }
  });

  it.each(['apply', 'certify'])('rehearses every protected receipt stage in %s mode', async mode => {
    const db = databaseAt(mode === 'apply' ? TIP : CONTENT_TIP);
    const { receipt, write, read } = fixture();
    try {
      await expect(run('pre-ledger', receipt, [write('ledger.json', result([]))])).rejects.toThrow(/identity/);
      await expect(run('bookmark', receipt)).rejects.toThrow(/ledger/);
      await expect(run('pre-health', receipt)).rejects.toThrow(/bookmark/);
      await expect(run('plan', receipt)).rejects.toThrow(/health/);
      await expect(run('post', receipt)).rejects.toThrow(/plan/);
      await run('identity', receipt, [write('list.json', [{ name: STAGING_D1.name, uuid: STAGING_D1.id }]),
        write('info.json', { name: STAGING_D1.name, uuid: STAGING_D1.id })]);
      for (const ledger of [names.slice(0, -2), [...names, '0047_future.sql'], names.slice(1)]) {
        await expect(run('pre-ledger', receipt, [write('bad-ledger.json', result(ledger.map(name => ({ name }))))])).rejects.toThrow(/ledger/);
      }
      const preNames = names.filter(name => name <= (mode === 'apply' ? TIP : CONTENT_TIP));
      await run('pre-ledger', receipt, [write('pre-ledger.json', result(preNames.map(name => ({ name }))))]);
      expect(read().preLedger.mode).toBe(mode);
      await run('bookmark', receipt, [write('bookmark.json', { bookmark: 'local-content-rehearsal' })]);
      const fk = write('fk.json', result([]));
      const quick = write('quick.json', result([{ quick_check: 'ok' }]));
      await run('pre-health', receipt, [fk, quick, write('before.json', baseline(db))]);
      await expect(run('plan', receipt, [write('wrong-plan.txt', [TIP, CONTENT_TIP].join('\n'))])).rejects.toThrow();
      await run('plan', receipt, [write('plan.txt', mode === 'apply' ? CONTENT_TIP : 'No migrations to apply')]);
      if (mode === 'apply') db.exec(readFileSync(`migrations/${CONTENT_TIP}`, 'utf8'));
      db.exec('CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT)');
      for (const name of names) db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').run(name);
      const post = [write('post-ledger.json', result(names.map(name => ({ name })))), fk, quick,
        write('after.json', baseline(db)), write('schema.json', result(db.prepare(schemaQuery(CONTENT_TIP)).all())),
        write('schema-gate.json', result(db.prepare(renderSchemaGateSql()).all()))];
      const drift = baseline(db);
      drift[0].results[0].week_swap_receipts += 1;
      await expect(run('post', receipt, [...post.slice(0, 3), write('drift.json', drift), ...post.slice(4)])).rejects.toThrow(/aggregate drift/);
      await expect(run('post', receipt, [...post.slice(0, 4), write('missing-schema.json', result([])), post[5]])).rejects.toThrow(/differs/);
      await expect(run('post', receipt, [...post.slice(0, 5), write('failed-gate.json', result([{ issue: 'missing_column' }]))])).rejects.toThrow(/schema gate found drift/);
      expect(read().status).toBeUndefined();
      expect(await run('post', receipt, post)).toMatchObject({ status: 'STAGING_0046_CONTENT_CERTIFIED',
        aggregateDrift: 'none', schemaGate: 'PASS', postLedger: { count: 46, tip: CONTENT_TIP }, schemaCheck: { constraints: 'PASS' } });
    } finally { db.close(); }
  });

  it('selects dispatch contract explicitly then binds every query and recheck to the receipt', () => {
    const workflow = load(readFileSync('.github/workflows/staging-v2-migrate.yml', 'utf8'));
    const input = workflow.on.workflow_dispatch.inputs.migration;
    expect(input).toMatchObject({ type: 'choice', required: true, default: CONTENT_TIP, options: [TIP, CONTENT_TIP] });
    const steps = workflow.jobs.certify.steps;
    const gates = steps.filter(step => step.env?.MIGRATION_TIP);
    expect(gates).toHaveLength(1);
    expect(gates[0].env.MIGRATION_TIP).toBe('${{ inputs.migration }}');
    expect(gates[0].run).toContain(' gate staging-migration-receipt.json');
    const queries = steps.flatMap(step => (step.run || '').split('\n')).filter(line => line.includes('staging-v2-migration-check.mjs query'));
    expect(queries).toHaveLength(3);
    for (const query of queries) expect(query).toMatch(/query (?:baseline|schema) staging-migration-receipt\.json/);
    expect(workflow.jobs.certify.environment).toBe('staging');
    expect(workflow.on.workflow_dispatch.inputs.confirm_staging_migration.default).toBe(false);
    const source = readFileSync('scripts/staging-v2-migration-check.mjs', 'utf8');
    expect(source).toContain('await hostedCi(candidate.sha, REPOSITORY)');
    expect(source).toContain('await requireCurrentHostedMain({ sha: candidate.sha, repository: REPOSITORY })');
    expect(source).toContain('gate: ref => gate(ref, tip)');
  });
});
