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
export const CONTENT_TIP = '0046_recipe_content_versions.sql';
export const SAVED_CONTENT_TIP = '0047_saved_recipe_content.sql';
function migration(tip = TIP) {
  if (tip === TIP) return { preTip: PRE_TIP, chain: CHAIN,
    tables: ['inventory_lots', 'inventory_commands', 'inventory_events', 'inventory_adoption_receipts', 'week_swap_receipts'],
    status: 'STAGING_0045_V2_CERTIFIED' };
  if (tip === CONTENT_TIP) return { preTip: TIP, chain: [CONTENT_TIP],
    tables: ['recipe_content_versions', 'recipe_content_access', 'cooked_meals'],
    status: 'STAGING_0046_CONTENT_CERTIFIED' };
  if (tip === SAVED_CONTENT_TIP) return { preTip: CONTENT_TIP, chain: [SAVED_CONTENT_TIP],
    tables: ['recipe_content_versions', 'recipe_content_access', 'cooked_meals', 'generated_meal_plan_components'],
    status: 'STAGING_0047_SAVED_CONTENT_CERTIFIED' };
  throw new Error('Only reviewed staging migration 0045, 0046 or 0047 is authorized');
}
export const schemaQuery = (tip = TIP) => `SELECT type, name, sql FROM sqlite_master WHERE tbl_name IN (${migration(tip).tables.map(name => `'${name}'`).join(', ')}) ORDER BY name`;

function databaseAt(tip) {
  const database = new DatabaseSync(':memory:');
  try {
    for (const name of listMigrations().filter(name => name <= tip)) {
      database.exec(readFileSync(`migrations/${name}`, 'utf8'));
    }
    return database;
  } catch (error) { database.close(); throw error; }
}

const baselineTables = new Map();
export function baselineQuery(tip = TIP) {
  const { preTip } = migration(tip);
  if (!baselineTables.has(preTip)) {
    const database = databaseAt(preTip);
    try {
      baselineTables.set(preTip, database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name));
    } finally { database.close(); }
  }
  const counts = baselineTables.get(preTip).filter(name => name !== 'recipes').map(name => `(SELECT COUNT(*) FROM ${name}) AS ${name}`);
  return `SELECT ${counts.join(', ')}, (SELECT COUNT(*) FROM recipes WHERE id LIKE 'vn-%') AS recipes_vn, (SELECT COUNT(*) FROM recipes WHERE id LIKE 'gl-%') AS recipes_global; ${catalogQuery().split(';')[0]}`;
}

function fieldGroups(tip) {
  return baselineQuery(tip).split(';').map(query => [...query.matchAll(/\bAS ([a-z0-9_]+)\b/g)].map(match => match[1]).sort());
}
function aggregateRow(row, fields) {
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(fields) ||
      Object.values(row).some(value => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error('V2 migration baseline is incomplete or contains invalid aggregates');
  }
  return row;
}
export function verifyBaseline(statements, tip = TIP) {
  const groups = fieldGroups(tip);
  if (!Array.isArray(statements) || statements.length !== groups.length || statements.some(statement =>
    statement?.success !== true || !Array.isArray(statement.results) || statement.results.length !== 1)) {
    throw new Error('Expected two successful V2 migration aggregate results');
  }
  const row = Object.assign({}, ...statements.map((statement, index) => aggregateRow(statement.results[0], groups[index])));
  if (row.recipes !== 500) throw new Error('V2 staging requires the reviewed 500 recipes');
  return row;
}
export function verifyBaselinePreserved(pre, post, tip = TIP) {
  if (!Array.isArray(pre) || pre.length !== 1 || pre[0]?.success !== true || pre[0]?.results?.length !== 1) {
    throw new Error('Expected one normalized saved V2 migration baseline');
  }
  const before = aggregateRow(pre[0].results[0], fieldGroups(tip).flat().sort());
  const after = verifyBaseline(post, tip);
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

const reviewedSchemas = new Map();
export function verifySchema(statements, tip = TIP) {
  if (!Array.isArray(statements) || statements.length !== 1 || statements[0]?.success !== true || !Array.isArray(statements[0].results)) {
    throw new Error('Expected one successful V2 migration schema result');
  }
  if (!reviewedSchemas.has(tip)) {
    const database = databaseAt(tip);
    try { reviewedSchemas.set(tip, database.prepare(schemaQuery(tip)).all()); }
    finally { database.close(); }
  }
  const expected = reviewedSchemas.get(tip);
  const normalize = rows => rows.map(({ type, name, sql }) => ({ type, name, sql: normalizeSchemaSql(sql) }));
  if (JSON.stringify(normalize(statements[0].results)) !== JSON.stringify(normalize(expected))) {
    throw new Error(`V2 migration schema differs from reviewed ${tip}`);
  }
  return { objects: expected.map(row => row.name), constraints: 'PASS' };
}

export function requireDispatch(env = process.env, ref = env.MIGRATION_REF) {
  if (env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
      env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_REPOSITORY_ID !== REPOSITORY_ID ||
      !/^[a-f0-9]{40}$/.test(ref ?? '') || env.GITHUB_SHA !== ref || env.GITHUB_WORKFLOW_SHA !== ref) {
    throw new Error('Canonical current-main staging V2 dispatch required');
  }
}
export function verifyCandidateChain(candidate, tip = TIP) {
  const { chain } = migration(tip);
  if (candidate.sha !== candidate.mainSha || candidate.schema?.version !== tip || JSON.stringify(candidate.chain) !== JSON.stringify(chain)) {
    throw new Error(`Only current-main reviewed chain to ${tip} is authorized`);
  }
  return candidate;
}
export async function gate(ref, tip = process.env.MIGRATION_TIP ?? TIP) {
  requireDispatch(process.env, ref);
  const { preTip } = migration(tip);
  const candidate = verifyCandidateChain(validateMigrationCandidate({ ref, expectedPreTip: preTip, migration: tip }), tip);
  const ci = await hostedCi(candidate.sha, REPOSITORY);
  const liveMain = await requireCurrentHostedMain({ sha: candidate.sha, repository: REPOSITORY });
  return { sha: candidate.sha, schema: candidate.schema, chain: candidate.chain,
    database: familyStagingConfig(), ci, liveMain, checkedAt: new Date().toISOString() };
}
export async function run(command, file, args = []) {
  const receiptFile = command === 'query' ? args[0] : command === 'gate' ? undefined : file;
  const receipt = receiptFile ? JSON.parse(readFileSync(receiptFile, 'utf8')) : undefined;
  // After dispatch, the saved receipt selects the reviewed contract, never mutable input.
  const tip = receipt ? receipt.schema?.version : command === 'gate' ? process.env.MIGRATION_TIP ?? TIP : TIP;
  const spec = migration(tip);
  if (receipt) verifyCandidateChain({ ...receipt, mainSha: receipt.sha }, tip);
  return runStaging(command, file, args, { preTip: spec.preTip, tip, gate: ref => gate(ref, tip),
    stagingConfig: familyStagingConfig, baselineQuery: () => baselineQuery(tip),
    verifyBaseline: statements => verifyBaseline(statements, tip),
    verifyBaselinePreserved: (pre, post) => verifyBaselinePreserved(pre, post, tip),
    schemaQuery: () => schemaQuery(tip), verifySchema: statements => verifySchema(statements, tip), status: spec.status });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, file, ...args] = process.argv.slice(2);
  run(command, file, args).then(value => {
    if (command === 'query') process.stdout.write(value);
    else console.log(`Staging V2 migration ${command}: ${value.status ?? 'PASS'}`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
