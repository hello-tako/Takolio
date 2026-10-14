import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { catalogQuery, validateMigrationCandidate } from './d1-migration-check.mjs';
import { listMigrations } from './d1-schema-gate.mjs';
import { hostedCi, requireCurrentHostedMain } from './release-check.mjs';
import { run as runStaging, stagingConfig } from './staging-d1-migration-check.mjs';
import { requireCanonicalStagingDispatch } from './staging-otp-migration-check.mjs';

export const PRE_TIP = '0041_checkout_admission.sql';
export const CHAIN = Object.freeze([
  '0042_family_meals_preferences_saved_shopping.sql', '0043_shopping_demand_review.sql',
]);
export const TIP = CHAIN.at(-1);
export const STAGING_D1 = Object.freeze({
  name: 'frigo-db-staging-v3', id: '7854298a-20f5-46aa-9cbf-917079c2a3dd',
});
const TABLES = [
  'family_meal_preferences', 'saved_recipe_entries', 'generated_family_meal_plans',
  'shopping_plan_sources', 'shopping_plan_demands', 'shopping_generated_item_state',
  'shopping_plan_commands', 'shopping_item_metadata', 'shopping_plan_item_dismissals',
  'shopping_demand_reviews', 'shopping_demand_review_commands',
];
export const schemaQuery = () => `SELECT type, name, sql FROM sqlite_master WHERE tbl_name IN (${TABLES
  .map((name) => `'${name}'`).join(', ')}) ORDER BY name`;

let legacyTables;
export function baselineQuery() {
  if (!legacyTables) {
    const database = new DatabaseSync(':memory:');
    try {
      for (const migration of listMigrations().filter((name) => name <= PRE_TIP)) {
        database.exec(readFileSync(`migrations/${migration}`, 'utf8'));
      }
      legacyTables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all().map(({ name }) => name);
    } finally { database.close(); }
  }
  // Only aggregates leave D1; include every reviewed legacy table and media diagnostics.
  const counts = legacyTables.filter((table) => table !== 'recipes')
    .map((table) => `(SELECT COUNT(*) FROM ${table}) AS ${table}`);
  return `SELECT ${counts.join(', ')}, (SELECT COUNT(*) FROM recipes WHERE id LIKE 'vn-%') AS recipes_vn, (SELECT COUNT(*) FROM recipes WHERE id LIKE 'gl-%') AS recipes_global, ${catalogQuery().split(';')[0].slice('SELECT '.length)}`;
}

function baselineFields() {
  return [...baselineQuery().matchAll(/\bAS ([a-z0-9_]+)\b/g)].map((match) => match[1]).sort();
}

export function verifyBaseline(statements) {
  const actual = statements?.[0]?.results;
  if (!Array.isArray(statements) || statements.length !== 1 || statements[0]?.success !== true ||
      !Array.isArray(actual) || actual.length !== 1 || !actual[0] || typeof actual[0] !== 'object' ||
      Array.isArray(actual[0])) throw new Error('Expected one successful family migration aggregate baseline');
  const row = actual[0];
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(baselineFields()) ||
      Object.values(row).some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error('Family migration baseline is incomplete or contains invalid aggregates');
  }
  if (row.recipes !== 500) throw new Error('Staging D1 does not contain the reviewed 500 recipes');
  return row;
}

export function verifyBaselinePreserved(pre, post) {
  const before = verifyBaseline(pre);
  const after = verifyBaseline(post);
  const changed = Object.keys(before).filter((key) => before[key] !== after[key]);
  if (changed.length) throw new Error(`Family migration aggregate drift detected in ${changed.join(', ')}`);
  return { drift: 'none', aggregates: Object.keys(before).length, media: 'unchanged' };
}

export function verifyFamilySchema(statements) {
  const actual = statements?.[0]?.results;
  if (!Array.isArray(statements) || statements.length !== 1 || statements[0]?.success !== true || !Array.isArray(actual)) {
    throw new Error('Expected one successful family migration schema result');
  }
  const database = new DatabaseSync(':memory:');
  try {
    for (const migration of CHAIN) database.exec(readFileSync(`migrations/${migration}`, 'utf8'));
    const expected = database.prepare(schemaQuery()).all();
    const normalize = (rows) => rows.map(({ type, name, sql }) => ({ type, name,
      sql: typeof sql === 'string' ? sql.replace(/\s+/g, ' ').trim() : sql,
    }));
    if (JSON.stringify(normalize(actual)) !== JSON.stringify(normalize(expected))) {
      throw new Error('Family meal tables, indexes, triggers or constraints differ from reviewed migrations 0042/0043');
    }
    return { objects: expected.map((row) => row.name), constraints: 'PASS' };
  } finally { database.close(); }
}

export function familyStagingConfig(text) {
  const database = stagingConfig(text);
  if (database.name !== STAGING_D1.name || database.id !== STAGING_D1.id) {
    throw new Error('Family migration requires the pinned staging database identity');
  }
  return database;
}

export function verifyCandidateChain(candidate) {
  if (candidate.sha !== candidate.mainSha) throw new Error('Migration ref must equal current main');
  if (candidate.schema?.version !== TIP || JSON.stringify(candidate.chain) !== JSON.stringify(CHAIN)) {
    throw new Error('Only the exact reviewed 0041->0042->0043 migration chain is authorized');
  }
  return candidate;
}

export async function gate(ref) {
  requireCanonicalStagingDispatch();
  const candidate = verifyCandidateChain(validateMigrationCandidate({ ref, expectedPreTip: PRE_TIP, migration: TIP }));
  const ci = await hostedCi(candidate.sha, process.env.GITHUB_REPOSITORY);
  const liveMain = await requireCurrentHostedMain({ sha: candidate.sha, repository: process.env.GITHUB_REPOSITORY });
  return { sha: candidate.sha, schema: candidate.schema, chain: candidate.chain,
    database: familyStagingConfig(), ci, liveMain, checkedAt: new Date().toISOString() };
}

export function run(command, file, args = [], options = {}) {
  return runStaging(command, file, args, { preTip: PRE_TIP, tip: TIP, gate,
    stagingConfig: familyStagingConfig, baselineQuery, verifyBaseline, verifyBaselinePreserved,
    schemaQuery, verifySchema: verifyFamilySchema, status: 'STAGING_0043_FAMILY_MEALS_CERTIFIED', ...options });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, file, ...args] = process.argv.slice(2);
  run(command, file, args).then((value) => {
    if (command === 'query') process.stdout.write(value);
    else console.log(`Staging family meals ${command}: ${value.status ?? 'PASS'}`);
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
