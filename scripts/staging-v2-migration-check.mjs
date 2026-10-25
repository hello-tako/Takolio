import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { catalogQuery, validateMigrationCandidate } from './d1-migration-check.mjs';
import { listMigrations } from './d1-schema-gate.mjs';
import { hostedCi, requireCurrentHostedMain } from './release-check.mjs';
import { run as runStaging } from './staging-d1-migration-check.mjs';
import { familyStagingConfig } from './staging-family-migration-check.mjs';
import { REPOSITORY, REPOSITORY_ID } from './domain/audit-cloud.mjs';

export const PRE_TIP = '0043_shopping_demand_review.sql';
export const CHAIN = Object.freeze(['0044_inventory_display_category.sql', '0045_week_swap_receipts.sql']);
export const TIP = CHAIN.at(-1);
const changedTables = ['inventory_lots', 'inventory_commands', 'inventory_events', 'inventory_adoption_receipts', 'week_swap_receipts'];
export const schemaQuery = () => `SELECT type, name, sql FROM sqlite_master WHERE tbl_name IN (${changedTables.map(name => `'${name}'`).join(', ')}) ORDER BY name`;

function databaseAt(tip) {
  const database = new DatabaseSync(':memory:');
  try {
    for (const migration of listMigrations().filter(name => name <= tip)) {
      database.exec(readFileSync(`migrations/${migration}`, 'utf8'));
    }
    return database;
  } catch (error) { database.close(); throw error; }
}

let baselineTables;
export function baselineQuery() {
  if (!baselineTables) {
    const database = databaseAt(PRE_TIP);
    try {
      baselineTables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
    } finally { database.close(); }
  }
  const counts = baselineTables.filter(name => name !== 'recipes').map(name => `(SELECT COUNT(*) FROM ${name}) AS ${name}`);
  return `SELECT ${counts.join(', ')}, (SELECT COUNT(*) FROM recipes WHERE id LIKE 'vn-%') AS recipes_vn, (SELECT COUNT(*) FROM recipes WHERE id LIKE 'gl-%') AS recipes_global; ${catalogQuery().split(';')[0]}`;
}

function fieldGroups() {
  return baselineQuery().split(';').map(query => [...query.matchAll(/\bAS ([a-z0-9_]+)\b/g)].map(match => match[1]).sort());
}
function aggregateRow(row, fields) {
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(fields) ||
      Object.values(row).some(value => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error('V2 migration baseline is incomplete or contains invalid aggregates');
  }
  return row;
}
export function verifyBaseline(statements) {
  const groups = fieldGroups();
  if (!Array.isArray(statements) || statements.length !== groups.length || statements.some(statement =>
    statement?.success !== true || !Array.isArray(statement.results) || statement.results.length !== 1)) {
    throw new Error('Expected two successful V2 migration aggregate results');
  }
  const row = Object.assign({}, ...statements.map((statement, index) => aggregateRow(statement.results[0], groups[index])));
  if (row.recipes !== 500) throw new Error('V2 staging requires the reviewed 500 recipes');
  return row;
}
export function verifyBaselinePreserved(pre, post) {
  if (!Array.isArray(pre) || pre.length !== 1 || pre[0]?.success !== true || pre[0]?.results?.length !== 1) {
    throw new Error('Expected one normalized saved V2 migration baseline');
  }
  const before = aggregateRow(pre[0].results[0], fieldGroups().flat().sort());
  const after = verifyBaseline(post);
  const changed = Object.keys(before).filter(key => before[key] !== after[key]);
  if (changed.length) throw new Error(`V2 migration aggregate drift in ${changed.join(', ')}`);
  return { drift: 'none' };
}

export function normalizeSchemaSql(sql) {
  if (typeof sql !== 'string') return sql;
  // Preserve quoted values/identifiers; only comments and unquoted spacing are cosmetic.
  return sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[[^\]]*\]|(?:[ \t\n\r\f]+|--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))+/g,
    token => ["'", '"', '`', '['].includes(token[0]) ? token : ' ').trim();
}

export function verifySchema(statements) {
  if (!Array.isArray(statements) || statements.length !== 1 || statements[0]?.success !== true || !Array.isArray(statements[0].results)) {
    throw new Error('Expected one successful V2 migration schema result');
  }
  const database = databaseAt(TIP);
  try {
    const expected = database.prepare(schemaQuery()).all();
    const normalize = rows => rows.map(({ type, name, sql }) => ({ type, name, sql: normalizeSchemaSql(sql) }));
    if (JSON.stringify(normalize(statements[0].results)) !== JSON.stringify(normalize(expected))) {
      throw new Error('V2 inventory and swap receipt schema differs from reviewed 0044/0045');
    }
    return { objects: expected.map(row => row.name), constraints: 'PASS' };
  } finally { database.close(); }
}

export function requireDispatch(env = process.env, ref = env.MIGRATION_REF) {
  if (env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
      env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_REPOSITORY_ID !== REPOSITORY_ID ||
      !/^[a-f0-9]{40}$/.test(ref ?? '') || env.GITHUB_SHA !== ref || env.GITHUB_WORKFLOW_SHA !== ref) {
    throw new Error('Canonical current-main staging V2 dispatch required');
  }
}
export function verifyCandidateChain(candidate) {
  if (candidate.sha !== candidate.mainSha || candidate.schema?.version !== TIP || JSON.stringify(candidate.chain) !== JSON.stringify(CHAIN)) {
    throw new Error('Only current-main reviewed 0043->0044->0045 is authorized');
  }
  return candidate;
}
export async function gate(ref) {
  requireDispatch(process.env, ref);
  const candidate = verifyCandidateChain(validateMigrationCandidate({ ref, expectedPreTip: PRE_TIP, migration: TIP }));
  const ci = await hostedCi(candidate.sha, REPOSITORY);
  const liveMain = await requireCurrentHostedMain({ sha: candidate.sha, repository: REPOSITORY });
  return { sha: candidate.sha, schema: candidate.schema, chain: candidate.chain,
    database: familyStagingConfig(), ci, liveMain, checkedAt: new Date().toISOString() };
}
export function run(command, file, args = []) {
  return runStaging(command, file, args, { preTip: PRE_TIP, tip: TIP, gate,
    stagingConfig: familyStagingConfig, baselineQuery, verifyBaseline, verifyBaselinePreserved,
    schemaQuery, verifySchema, status: 'STAGING_0045_V2_CERTIFIED' });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, file, ...args] = process.argv.slice(2);
  run(command, file, args).then(value => {
    if (command === 'query') process.stdout.write(value);
    else console.log(`Staging V2 migration ${command}: ${value.status ?? 'PASS'}`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
