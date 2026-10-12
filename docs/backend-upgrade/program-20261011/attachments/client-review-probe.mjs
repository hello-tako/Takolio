import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const base = '1963c469e2e3bd4819cda6bb9ef8162101ad523a';
const artifact = '.artifacts/backend-program-20261011';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const fileHash = (path) => hash(readFileSync(path));
const currentHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceFreeze = JSON.parse(readFileSync(`${artifact}/source-freeze-final.json`, 'utf8'));
const sourceHashes = [...sourceFreeze.source, ...sourceFreeze.candidateSource];
for (const item of sourceHashes) assert.equal(fileHash(item.path), item.sha256, `freeze drift: ${item.path}`);
const compile = (source, extra = {}) => {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require, TextEncoder, console: { ...console, error: () => {} }, ...extra });
  return exports;
};
const oldSource = execFileSync('git', ['show', `${base}:src/worker/routes/week.ts`], { encoding: 'utf8' });
const ast = ts.createSourceFile('baseline-week.ts', oldSource, ts.ScriptTarget.Latest, true);
const names = new Set(['WeekDatabaseError', 'parseMealPlanSnapshot', 'parseJsonRecord', 'normalizeWeekDayOfWeek', 'normalizeWeekDayType', 'deriveBudgetStatus', 'getMealPlan']);
const selected = ast.statements.filter((node) => names.has(node.name?.text) || (ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => ['WEEK_DAY_NAMES_VI', 'WEEK_DAY_TYPES'].includes(d.name.getText(ast))))).map((node) => node.getText(ast)).join('\n');
const old = compile(selected + '\nexports.getMealPlan = getMealPlan; exports.normalizeWeekDayOfWeek = normalizeWeekDayOfWeek;', { weekRecipeAuthority: (ctx) => ctx.authority() });
const repositoryPath = 'packages/db/src/week-read-repository.ts';
const servicePath = 'src/worker/services/week-read.ts';
const repository = compile(readFileSync(repositoryPath, 'utf8'));
const current = compile(readFileSync(servicePath, 'utf8'), { require: (id) => id.includes('week-read-repository') ? repository : require(id) });
const planRow = { id: 'fixture-plan', household_id: 'fixture-home', snapshot_json: null, start_date: '2030-01-02', end_date: '2030-01-08', status: 'READY', shopping_frequency: 'once', budget_target: '300', budget_min: '250', budget_max: '350', fridge_utilization: '42', waste_risk: 'medium', ai_explanation: null, created_at: '2030-01-01T00:00:00.000Z', updated_at: '2030-01-01T00:00:00.000Z' };
const stored = { id: planRow.id, householdId: planRow.household_id, days: [], shoppingItems: [], retainedSyntheticField: true };
const fixtureRecipe = { id: 'fixture-recipe', name: 'Synthetic recipe' };
const fixtures = [
  { name: 'missing', missing: true },
  { name: 'legacy-catalog' },
  { name: 'embedded-recipe', embedded: true },
  { name: 'snapshot', snapshot: true },
  { name: 'cache-failure', snapshot: true, cacheFailure: true },
  { name: 'd1-failure', d1Failure: true },
];
function fixture(options) {
  const events = []; const caches = []; let authorityReads = 0;
  const db = { prepare(sql) { return { bind(...bindings) { return { async first() {
    events.push({ sql, bindings, method: 'first' });
    if (options.d1Failure) throw new Error('synthetic failure');
    return options.missing ? null : { ...planRow, snapshot_json: options.snapshot ? JSON.stringify({ version: 1, plan: stored }) : null };
  }, async all() {
    events.push({ sql, bindings, method: 'all' });
    if (sql.includes('meal_plan_days')) return { results: [{ id: 'fixture-day', date: '2030-01-02', day_of_week: 'thu 4', day_type: 'unknown' }] };
    if (sql.includes('meal_plan_slots')) return { results: [{ id: 'fixture-slot', day_id: 'fixture-day', recipe_id: fixtureRecipe.id, slot_type: 'DINNER', status: 'PLANNED', servings: '3', notes: null, snapshot_json: options.embedded ? JSON.stringify({ recipe: fixtureRecipe, availabilityPercent: 120, badges: [1, 'safe'] }) : null }] };
    return { results: [{ id: 'fixture-item', ingredient_id: null, name: 'Synthetic', quantity: '-1', unit: 'piece', checked: 1, cannot_buy: 0, snapshot_json: null }] };
  } }; } }; } };
  const cache = { async put(...args) { caches.push(args); if (options.cacheFailure) throw new Error('synthetic cache outage'); } };
  const authority = async () => { authorityReads++; return { findByIdOrSlug: (id) => { events.push({ catalogId: id }); return fixtureRecipe; } }; };
  return { db, cache, authority, facts: () => ({ events, caches, authorityReads }) };
}
const weekCases = [];
for (const options of fixtures) {
  const left = fixture(options); const right = fixture(options);
  const run = async (operation) => { try { return { body: JSON.stringify(await operation()) }; } catch (error) { return { error: { name: error.name, code: error.code, message: error.message } }; } };
  const before = await run(() => old.getMealPlan({ env: { DB: left.db, CACHE: left.cache }, authority: left.authority }, planRow.id, planRow.household_id));
  const after = await run(() => current.readWeekPlan(new repository.WeekReadRepository(right.db), planRow.id, planRow.household_id, right.authority, right.cache));
  assert.deepEqual(after, before, `body/error parity: ${options.name}`);
  assert.equal(JSON.stringify(right.facts()), JSON.stringify(left.facts()), `SQL/cache/catalog parity: ${options.name}`);
  weekCases.push({ case: options.name, status: 'PASS', readQueries: right.facts().events.filter((x) => x.sql).length, lazyCatalogReads: right.facts().authorityReads });
}
const normalizations = [1, 7, 0, -1, 8, 'monday', ' thu 4 ', 'sunday', null, 'unknown'];
for (const value of normalizations) assert.equal(current.normalizeWeekDayOfWeek(value, '2030-01-02'), old.normalizeWeekDayOfWeek(value, '2030-01-02'));
const latestFixture = fixture({});
await new repository.WeekReadRepository(latestFixture.db).findCurrentId('fixture-home');
const latestSql = 'SELECT id FROM meal_plans WHERE household_id = ? AND status != ? ORDER BY created_at DESC LIMIT 1';
assert.ok(oldSource.includes(latestSql));
assert.deepEqual(latestFixture.facts().events[0], { sql: latestSql, bindings: ['fixture-home', 'ARCHIVED'], method: 'first' });
const weekReceipt = { schemaVersion: 1, status: 'PASS', evidenceKind: 'RERUN_EXECUTED_IN_MEMORY_BASELINE_COMPARISON', reviewedHead: currentHead, baseSha: base, baselineFile: 'src/worker/routes/week.ts', baselineContentSha256: hash(oldSource), comparedSource: { [repositoryPath]: fileHash(repositoryPath), [servicePath]: fileHash(servicePath) }, cases: weekCases, normalizationInputsCompared: 10, latestQueryParity: true, checks: ['exact-serialized-bodies', 'error-name-code-message', 'SQL-bindings-query-order', 'cache-key-payload-TTL', 'lazy-recipe-authority'], intentionalDifference: 'Bounded error telemetry; raw diagnostic logs are excluded from response/SQL/cache parity.', earlierExecutionAttribution: 'Earlier equivalent session-only comparison had no persisted receipt; this record is a fresh execution, not a reconstructed historical result.' };
writeFileSync(`${artifact}/client-review-b07-parity.json`, JSON.stringify(weekReceipt, null, 2) + '\n', { mode: 0o600 });
const budgetPath = 'packages/db/src/scan-ai-budget.ts';
const budget = compile(readFileSync(budgetPath, 'utf8'), { crypto: globalThis.crypto });
const helper = compile(readFileSync('tests/helpers/sqlite-d1.ts', 'utf8'), { process });
const db = new helper.SqliteD1();
try {
  db.seed(readFileSync('docs/backend-upgrade/b04b/schema.candidate.sql', 'utf8'));
  db.seed(`INSERT INTO users(id) VALUES ('review-user'); INSERT INTO households(id,name,created_by) VALUES ('review-home','Synthetic','review-user'); INSERT INTO household_members(id,household_id,user_id,role) VALUES ('review-member','review-home','review-user','owner'); INSERT INTO scans(id,user_id,household_id,status) VALUES ('review-scan','review-user','review-home','processing'); INSERT INTO scan_queue_jobs(id,scan_id,household_id,user_id,idempotency_key,status,attempts,claim_attempt,claim_token,locked_at) VALUES ('review-job','review-scan','review-home','review-user','review-queue','processing',1,1,'review-lease',datetime('now'));`);
  const scope = { jobId: 'review-job', scanId: 'review-scan', householdId: 'review-home', userId: 'review-user' };
  const sourcePolicy = { ...scope, lane: 'main', policyReference: 'synthetic-reviewed-policy', limits: { maxCalls: 1, maxTokens: 2, maxMicroUsd: 2 } };
  const a = 'a'.repeat(64);
  const evidence = { providerId: 'synthetic-provider', physicalModel: 'synthetic-model', task: 'receipt_ocr', kind: 'primary', requestSha256: a,
    input: { tokenBound: 1, scope: 'COMPLETE_PROVIDER_INPUT', method: 'CERTIFIED_UPPER_BOUND', requestSha256: a, evidenceReference: 'synthetic-input', evidenceSha256: 'b'.repeat(64) },
    output: { tokenBound: 1, enforcement: 'PROVIDER_ENFORCED_MAX_TOKENS', requestSha256: a, evidenceReference: 'synthetic-output', evidenceSha256: 'c'.repeat(64) },
    pricing: { verification: 'VERIFIED', currency: 'USD', scope: 'COMPLETE_CALL_CHARGES', providerId: 'synthetic-provider', physicalModel: 'synthetic-model', inputMicroUsdPerMillionTokens: 1, outputMicroUsdPerMillionTokens: 1, fixedCallMicroUsd: 0, version: 'synthetic-v1', sourceReference: 'synthetic-pricing', sourceSha256: 'd'.repeat(64), validFrom: '2020-01-01T00:00:00.000Z', validUntil: '2099-01-01T00:00:00.000Z' } };
  const policyPending = budget.createScanAIBudgetPolicy(() => sourcePolicy);
  const proofPending = budget.createScanAICallProof(() => evidence);
  sourcePolicy.limits.maxCalls = 99;
  evidence.input.tokenBound = 0; evidence.pricing.inputMicroUsdPerMillionTokens = 0;
  const policy = await policyPending; const proof = await proofPending;
  const lease = { ...scope, claimToken: 'review-lease', claimAttempt: 1 };
  const input = { policy, proof, lease, callKey: 'original-key' };
  const admissionPending = budget.reserveScanAICall(db, input);
  lease.claimToken = 'mutated-after-admission'; input.callKey = 'mutated-after-admission';
  const first = await admissionPending;
  assert.equal(first.ok, true); assert.equal(first.acquired, true);
  assert.equal(first.reservation.reservedMicroUsd, 2); assert.equal(first.reservation.reservedTokens, 2);
  assert.equal(first.reservation.callKey, 'original-key');
  const replay = await budget.reserveScanAICall(db, { policy, proof, lease: { ...scope, claimToken: 'review-lease', claimAttempt: 1 }, callKey: 'original-key' });
  assert.equal(replay.ok, true); assert.equal(replay.acquired, false); assert.equal(replay.reason, 'replay');
  const denied = await budget.reserveScanAICall(db, { policy, proof, lease: { ...scope, claimToken: 'review-lease', claimAttempt: 1 }, callKey: 'second-key' });
  assert.equal(denied.ok, false); assert.equal(denied.reason, 'BUDGET_EXCEEDED');
  assert.equal(db.query('SELECT max_calls FROM scan_ai_job_budgets')[0].max_calls, 1);
  assert.equal(db.query('SELECT claim_token FROM scan_ai_call_reservations')[0].claim_token, 'review-lease');
  assert.equal(JSON.stringify(db.query('PRAGMA foreign_key_check')), '[]');
  const budgetReceipt = { schemaVersion: 1, status: 'PASS', evidenceKind: 'INDEPENDENT_IN_MEMORY_SQLITE_PROBE_AND_SOURCE_REVIEW', reviewedHead: currentHead, sourceSha256: fileHash(budgetPath), schemaSha256: fileHash('docs/backend-upgrade/b04b/schema.candidate.sql'), checks: ['policy-and-proof-deep-snapshot-before-first-await', 'lease-and-call-key-snapshot-before-descriptor-await', 'independent-ceil-input-output-equals-two-microUSD', 'maxCalls-remains-one-after-source-mutation', 'same-key-replay-never-acquires-network-permission', 'second-key-denied-by-cumulative-budget', 'foreign-key-check-empty'], localCodeBlockers: [], productionBlockers: ['trusted-complete-input-output-bounds-and-complete-pricing-providers-do-not-exist', 'not-wired-to-provider-boundary-or-applied-as-migration', 'cancellation-network-interval-and-fenced-publication-require-integration', 'retention-RESTRICT-immutability-conflicts-with-existing-cleanup-until-reviewed'], realProviderCalls: 0, persistentDatabaseChanged: false, earlierExecutionAttribution: 'Earlier equivalent session-only rehearsal had no persisted receipt; this receipt records a fresh bounded rerun.' };
  writeFileSync(`${artifact}/client-review-b04b-probe.json`, JSON.stringify(budgetReceipt, null, 2) + '\n', { mode: 0o600 });
} finally { db.close(); }
console.log(JSON.stringify({ status: 'PASS', head: currentHead, sourceFreezeFilesChecked: sourceHashes.length, B07Cases: 6, B07NormalizationInputs: 10, B04bProbe: 'PASS', realProviderCalls: 0 }));
