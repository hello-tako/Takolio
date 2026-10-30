#!/usr/bin/env node
// Local Wrangler D1 matrix for immutable R1 regressions, current-main customer
// migrations, and the separate Admin D1 upgrade. No remote commands.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAdminFixtureSql, localWranglerEnv } from './admin-local-lib.mjs';
import { CUSTOMER_BASELINE, V2_RELEASE_BASELINE, V3_RELEASE_BASELINE, selectGuardedCustomerBaseline } from './admin-customer-baseline.mjs';
import { migrationManifest, verifyMigrationLedger } from './release-check.mjs';
import { renderSchemaGateCommand } from './d1-schema-gate.mjs';

const argv = process.argv.slice(2);
const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
const root = process.cwd();
const env = localWranglerEnv();
const work = mkdtempSync(path.join(tmpdir(), 'takosan-migration-matrix-'));
const PRE_ADMIN = '186a9cf05de7c91ed3289e13130feb3b38a264ac';
const ORIGINAL_ADMIN = '3e865d009ee62a92ed1d9c8d225a36893035670b';
const R1 = '25140baa99ef0aecc5e8d0e53206132e01e0f765';
const MAIN_BASELINE = CUSTOMER_BASELINE;
const runEvidence = {
  head: null, tree: null, mergeBase: null, customerBaseline: null, dirtyScopedPaths: null,
  adminManifest: null, workerVersion: null, workerSourceSha256: null,
};

function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('git ' + args.join(' ') + ': ' + result.stderr);
  return result.stdout.trimEnd();
}
function wrangler(config, args) {
  const full = ['exec', 'wrangler', 'd1', ...args, '--local', '-c', config];
  if (full.includes('--remote')) throw new Error('Refusing remote wrangler invocation');
  const result = spawnSync('pnpm', full, { cwd: root, env: { ...env, CI: 'true' }, encoding: 'utf8', maxBuffer: 1 << 26 });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}
function json(result, label) {
  if (result.status !== 0) throw new Error(label + ' failed: ' + (result.stderr || result.stdout).slice(-500));
  try { return JSON.parse(result.stdout); }
  catch { throw new Error(label + ' returned invalid JSON: ' + result.stdout.slice(-500)); }
}
function filesAt(sha, directory) {
  return git('ls-tree', '-r', '--name-only', sha, '--', directory).split('\n').filter((f) => f.endsWith('.sql'))
    .map((file) => ({ name: file.slice(directory.length + 1), content: git('show', sha + ':' + file) }));
}
function filesOnDisk(directory) {
  return readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()
    .map((name) => ({ name, content: readFileSync(path.join(directory, name), 'utf8') }));
}
function manifest(files) {
  const migrations = [...files].sort((a, b) => a.name.localeCompare(b.name)).map(({ name, content }, index) => {
    if (!/^\d{4}_[A-Za-z0-9_-]+\.sql$/.test(name) || Number(name.slice(0, 4)) !== index + 1)
      throw new Error('Migration sequence malformed, duplicated, or gapped at ' + name);
    return { name, sha256: hash(content) };
  });
  if (!migrations.length) throw new Error('No migrations found');
  return { version: migrations.at(-1).name, count: migrations.length, sha256: hash(JSON.stringify(migrations)), migrations };
}
function workerVersion(source, label) {
  const match = source.match(/ADMIN_SCHEMA_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!match) throw new Error('Cannot read ADMIN_SCHEMA_VERSION from ' + label);
  return match[1];
}
function writeFiles(directory, files) {
  mkdirSync(directory, { recursive: true });
  for (const file of files) writeFileSync(path.join(directory, file.name), file.content);
}
function database(name, files, admin = false) {
  const dir = path.join(work, name);
  const migrationDirectory = path.join(dir, admin ? 'migrations-admin' : 'migrations');
  writeFiles(migrationDirectory, files);
  const config = path.join(dir, 'wrangler.json');
  const databaseName = admin ? 'takosan-admin-db' : 'frigo-db';
  writeFileSync(config, JSON.stringify({
    name: 'matrix-' + name,
    main: path.join(root, admin ? 'src/worker/admin-worker.ts' : 'src/worker/index.ts'),
    compatibility_date: '2024-11-01',
    d1_databases: [{
      binding: admin ? 'ADMIN_DB' : 'DB', database_name: databaseName,
      database_id: admin ? '00000000-0000-4000-8000-0000000000bb' : '00000000-0000-4000-8000-0000000000aa',
      migrations_dir: migrationDirectory,
    }],
  }));
  return { dir, migrationDirectory, config, persist: path.join(dir, 'state'), database: databaseName };
}
function apply(db) {
  return wrangler(db.config, ['migrations', 'apply', db.database, '--persist-to', db.persist]);
}
function sql(db, statement) {
  return wrangler(db.config, ['execute', db.database, '--persist-to', db.persist, '--json', '--yes', '--command', statement]);
}
function query(db, statement) {
  return json(sql(db, statement), 'D1 query: ' + statement).flatMap((entry) => entry.results ?? []);
}
function ledger(db) { return json(sql(db, 'SELECT name FROM d1_migrations ORDER BY name'), 'D1 migration ledger'); }
const manifests = new Map();
function releaseGate(sha, statements) {
  try {
    if (!manifests.has(sha)) manifests.set(sha, migrationManifest(root, sha));
    return { pass: true, manifest: verifyMigrationLedger(manifests.get(sha), statements) };
  } catch (error) {
    return { pass: false, error: error instanceof Error ? error.message : String(error) };
  }
}
function adminGate(schema, statements) {
  try { return { pass: true, manifest: verifyMigrationLedger(schema, statements) }; }
  catch (error) { return { pass: false, error: error instanceof Error ? error.message : String(error) }; }
}
function schemaGate(db, migrationsDirectory, template) {
  const result = sql(db, renderSchemaGateCommand({ template, migrationsDirectory }));
  if (result.status !== 0) return { pass: false, error: (result.stderr || result.stdout).slice(-500) };
  const issues = json(result, 'D1 schema gate').flatMap((statement) => statement.results ?? []);
  return { pass: issues.length === 0, issues };
}
function adminState(db) {
  return query(db, "SELECT (SELECT COUNT(*) FROM d1_migrations) AS ledger, (SELECT value FROM admin_config_metadata WHERE key = 'schema_version') AS schema_version, (SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_admin_%') AS triggers")[0];
}
function schemaObjects(db) {
  return query(db, "SELECT type, name, tbl_name, COALESCE(sql, '') AS sql FROM sqlite_master WHERE type IN ('table','index','trigger','view') AND name <> 'd1_migrations' AND name NOT LIKE 'sqlite_%' ORDER BY type, name");
}
function compareObjects(before, after) {
  const indexed = new Map(after.map((object) => [object.type + ':' + object.name, object]));
  const missing = [], changed = [];
  for (const object of before) {
    const next = indexed.get(object.type + ':' + object.name);
    if (!next) missing.push(object.type + ':' + object.name);
    else if (JSON.stringify(next) !== JSON.stringify(object)) changed.push(object.type + ':' + object.name);
  }
  return { pass: !missing.length && !changed.length, count: before.length, missing, changed };
}
const rows = [];
function row(scenario, expectation, observed, pass) {
  rows.push({ scenario, expectation, observed, pass });
  console.log((pass ? 'PASS ' : 'FAIL ') + scenario + ' — ' + expectation);
}

try {
  const head = git('rev-parse', 'HEAD');
  const { mainBase: mergeBase, baseline: customerBaseline } = selectGuardedCustomerBaseline({
    git, originalBaseline: MAIN_BASELINE, releaseBaseline: V2_RELEASE_BASELINE, v3ReleaseBaseline: V3_RELEASE_BASELINE,
    guardedPaths: ['migrations', 'scripts/d1-schema-gate.sql'],
  });
  runEvidence.head = head;
  runEvidence.customerBaseline = customerBaseline;
  runEvidence.tree = git('rev-parse', head + '^{tree}');
  runEvidence.mergeBase = mergeBase;
  runEvidence.dirtyScopedPaths = git('status', '--porcelain', '--', 'scripts/admin-migration-matrix.mjs', 'scripts/admin-customer-baseline.mjs', 'migrations', 'migrations-admin', 'src/worker/routes/admin/auth.ts');
  const r1Files = filesAt(R1, 'migrations');
  const preFiles = filesAt(PRE_ADMIN, 'migrations');
  const originalFiles = filesAt(ORIGINAL_ADMIN, 'migrations');
  const mainFiles = filesAt(MAIN_BASELINE, 'migrations');
  const v2Files = filesAt(V2_RELEASE_BASELINE, 'migrations');
  const candidateFiles = filesAt(customerBaseline, 'migrations');
  const r1AdminFiles = filesAt(R1, 'migrations-admin');
  const currentAdminFiles = filesOnDisk(path.join(root, 'migrations-admin'));
  const r1Manifest = migrationManifest(root, R1);
  const preManifest = migrationManifest(root, PRE_ADMIN);
  const mainManifest = migrationManifest(root, MAIN_BASELINE);
  const v2Manifest = migrationManifest(root, V2_RELEASE_BASELINE);
  const candidateManifest = migrationManifest(root, customerBaseline);
  const headManifest = migrationManifest(root, head);
  const workingManifest = manifest(filesOnDisk(path.join(root, 'migrations')));
  const adminManifest = manifest(currentAdminFiles);
  runEvidence.adminManifest = {
    count: adminManifest.count,
    version: adminManifest.version,
    sha256: adminManifest.sha256,
    names: adminManifest.migrations.map((migration) => migration.name),
  };
  const r1Version = workerVersion(git('show', R1 + ':src/worker/routes/admin/auth.ts'), R1);
  const currentWorkerSource = readFileSync(path.join(root, 'src/worker/routes/admin/auth.ts'), 'utf8');
  const currentVersion = workerVersion(currentWorkerSource, 'working tree');
  runEvidence.workerVersion = currentVersion;
  runEvidence.workerSourceSha256 = hash(currentWorkerSource);
  const r1Template = path.join(work, 'r1-schema-gate.sql');
  const mainTemplate = path.join(work, 'main-schema-gate.sql');
  const mainMigrationDirectory = path.join(work, 'main-migrations');
  writeFiles(mainMigrationDirectory, mainFiles);
  writeFileSync(r1Template, git('show', R1 + ':scripts/d1-schema-gate.sql'));
  writeFileSync(mainTemplate, git('show', MAIN_BASELINE + ':scripts/d1-schema-gate.sql'));

  row('pinned current-main ancestry', 'fixed baseline is an ancestor; protected main migration/schema bytes remain unchanged',
    { head, mergeBase, pinnedBaseline: MAIN_BASELINE },
    git('merge-base', mergeBase, MAIN_BASELINE) === MAIN_BASELINE && git('merge-base', head, MAIN_BASELINE) === MAIN_BASELINE);

  // The original eleven R1 scenarios stay tied to the exact R1 and pre-admin commits.
  const r1MigrationDirectory = path.join(work, 'r1-migrations');
  writeFiles(r1MigrationDirectory, r1Files);
  row('customer ledger identity', 'R1 migrations equal pre-admin release (names + SHA-256)',
    { r1: r1Manifest.sha256, preAdmin: preManifest.sha256, count: r1Manifest.count },
    r1Manifest.sha256 === preManifest.sha256 && r1Manifest.count === 41);

  const db41 = database('r1-db41', r1Files);
  const apply41 = apply(db41), ledger41 = ledger(db41);
  row('DB 0041 + old application (pre-admin release)', 'pinned pre-admin deploy ledger gate passes',
    releaseGate(PRE_ADMIN, ledger41), apply41.status === 0 && releaseGate(PRE_ADMIN, ledger41).pass);
  const gate41 = schemaGate(db41, r1MigrationDirectory, r1Template);
  row('DB 0041 + new application (remediated HEAD)', 'pinned R1 ledger and 41-file schema gates pass',
    { ledger: releaseGate(R1, ledger41), schema: gate41 }, releaseGate(R1, ledger41).pass && gate41.pass);
  row('DB 0041 + new application schema gate', 'pinned R1 read-only schema gate reports no issue',
    gate41, gate41.pass);
  row('DB 0041 + ORIGINAL admin commit 3e865d0 (review finding)', 'original deploy gate fails before customer 0042 is applied',
    releaseGate(ORIGINAL_ADMIN, ledger41), !releaseGate(ORIGINAL_ADMIN, ledger41).pass);

  const db42 = database('r1-original-db42', originalFiles);
  const apply42 = apply(db42), ledger42 = ledger(db42);
  row('DB 0042 (original design) + old application rollback (review finding)', 'pinned pre-admin release rejects original 0042 ledger',
    releaseGate(PRE_ADMIN, ledger42), apply42.status === 0 && !releaseGate(PRE_ADMIN, ledger42).pass);
  row('DB 0042 (original design) + remediated HEAD', 'pinned R1 release rejects unexpected forward ledger',
    releaseGate(R1, ledger42), apply42.status === 0 && !releaseGate(R1, ledger42).pass);

  const drift = database('r1-unexpected-drift', [...r1Files, {
    name: '0042_unexpected_drift.sql', content: 'CREATE TABLE unexpected_drift (id TEXT PRIMARY KEY);\n',
  }]);
  const driftApply = apply(drift), driftLedger = ledger(drift);
  const driftGate = schemaGate(drift, r1MigrationDirectory, r1Template);
  row('Unexpected extra customer migration', 'pinned R1 deploy and schema gates reject extra 0042 drift',
    { ledger: releaseGate(R1, driftLedger), schema: driftGate },
    driftApply.status === 0 && !releaseGate(R1, driftLedger).pass && !driftGate.pass);

  const r1Admin = database('r1-admin', r1AdminFiles, true);
  const r1AdminApply = apply(r1Admin), r1AdminReapply = apply(r1Admin);
  const r1AdminState = adminState(r1Admin);
  const r1AdminGate = adminGate(manifest(r1AdminFiles), ledger(r1Admin));
  row('Admin DB fresh apply + re-apply', 'pinned R1 admin manifest applies at version 1 with nine triggers',
    { apply: r1AdminApply.status, reapply: r1AdminReapply.status, state: r1AdminState, ledger: r1AdminGate },
    r1AdminApply.status === 0 && r1AdminReapply.status === 0 && r1AdminGate.pass &&
      r1AdminState.ledger === manifest(r1AdminFiles).count && r1AdminState.schema_version === r1Version &&
      r1AdminState.triggers === 9);

  const r1Failure = database('r1-admin-failed', r1AdminFiles, true);
  sql(r1Failure, 'CREATE TABLE admin_audit_events (conflict INTEGER)');
  const r1FailedApply = apply(r1Failure);
  const r1FailedState = query(r1Failure, "SELECT (SELECT COUNT(*) FROM d1_migrations) AS ledger, (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name LIKE 'admin_%') AS admin_tables, (SELECT COUNT(*) FROM sqlite_master WHERE name = 'admin_config_metadata') AS metadata_table, (SELECT COUNT(*) FROM sqlite_master WHERE name = 'admin_audit_events') AS injected_collision")[0];
  row('Failed admin migration', 'R1 apply leaves no record or partial schema beyond injected conflict (SQL only; no Worker response asserted)',
    { exit: r1FailedApply.status, state: r1FailedState,
      error: (r1FailedApply.stderr || r1FailedApply.stdout).split('\n').find((line) => /already exists|error/i.test(line)) ?? null },
    r1FailedApply.status !== 0 && r1FailedState.ledger === 0 &&
      r1FailedState.metadata_table === 0 && r1FailedState.admin_tables === 1 &&
      r1FailedState.injected_collision === 1);
  row('Customer application rollback with admin schema present', 'pinned R1 customer gate remains valid; Admin schema is separate (SQL only)',
    { customerGate: releaseGate(R1, ledger41), adminPresent: r1AdminApply.status === 0, version: r1AdminState.schema_version },
    releaseGate(R1, ledger41).pass && r1AdminApply.status === 0 && r1AdminState.schema_version === r1Version);

  const mainIdentity = git('merge-base', mergeBase, MAIN_BASELINE) === MAIN_BASELINE &&
    git('merge-base', head, MAIN_BASELINE) === MAIN_BASELINE &&
    mainManifest.count === 43 &&
    mainFiles.some((file) => file.name === '0042_family_meals_preferences_saved_shopping.sql') &&
    mainFiles.some((file) => file.name === '0043_shopping_demand_review.sql') &&
    JSON.stringify(candidateManifest.migrations.slice(0, mainManifest.count)) === JSON.stringify(mainManifest.migrations);
  const v2Identity = v2Manifest.count === 45 &&
    JSON.stringify(candidateManifest.migrations.slice(0, v2Manifest.count)) === JSON.stringify(v2Manifest.migrations);
  const candidateIdentity = customerBaseline === V3_RELEASE_BASELINE && candidateManifest.count === 47 &&
    headManifest.sha256 === candidateManifest.sha256 && workingManifest.sha256 === candidateManifest.sha256 &&
    !git('diff', '--name-only', customerBaseline, '--', 'migrations', 'scripts/d1-schema-gate.sql');
  row('pinned 43-file customer ledger identity', 'all historical main migrations remain byte-identical in the candidate',
    { head, baseline: MAIN_BASELINE, currentMain: mainManifest.sha256, headManifest: headManifest.sha256,
      workingManifest: workingManifest.sha256, count: mainManifest.count,
      status: git('status', '--porcelain', '--', 'migrations') || 'clean' }, mainIdentity);
  row('pinned V2 customer release identity', 'all 45 immutable V2 migrations remain byte-identical in the candidate',
    { baseline: V2_RELEASE_BASELINE, count: v2Manifest.count, v2: v2Manifest.sha256,
      candidatePrefix: candidateManifest.migrations.slice(0, v2Manifest.count) }, v2Identity);
  row('pinned V3 customer release identity', 'HEAD and working migrations/schema match the immutable 47-file V3 checkpoint',
    { baseline: customerBaseline, count: candidateManifest.count, candidate: candidateManifest.sha256,
      head: headManifest.sha256, working: workingManifest.sha256 }, candidateIdentity);

  const fresh = database('main-fresh', mainFiles);
  const freshApply = apply(fresh), freshLedger = ledger(fresh);
  const freshGate = schemaGate(fresh, mainMigrationDirectory, mainTemplate);
  row('current-main 43-file fresh apply + strict gates', '43 migrations apply; pinned main ledger and schema gates pass',
    { apply: freshApply.status, ledger: releaseGate(MAIN_BASELINE, freshLedger), schema: freshGate },
    freshApply.status === 0 && releaseGate(MAIN_BASELINE, freshLedger).pass && freshGate.pass);

  const upgrade = database('main-upgrade-41-to-43', r1Files);
  const upgrade41Apply = apply(upgrade), upgrade41Ledger = ledger(upgrade);
  const additions = mainFiles.filter((file) => !r1Files.some((old) => old.name === file.name));
  writeFiles(upgrade.migrationDirectory, additions);
  const upgrade43Apply = apply(upgrade), upgrade43Ledger = ledger(upgrade);
  const upgradeGate = schemaGate(upgrade, upgrade.migrationDirectory, mainTemplate);
  row('current-main 0041 -> 0043 incremental upgrade', 'apply only 0042/0043 after R1 0041; both strict gates pass',
    { baselineApply: upgrade41Apply.status, baselineGate: releaseGate(R1, upgrade41Ledger),
      additions: additions.map((file) => file.name), apply: upgrade43Apply.status,
      ledger: releaseGate(MAIN_BASELINE, upgrade43Ledger), schema: upgradeGate },
    upgrade41Apply.status === 0 && additions.length === 2 &&
      additions.some((file) => file.name === '0042_family_meals_preferences_saved_shopping.sql') &&
      additions.some((file) => file.name === '0043_shopping_demand_review.sql') &&
      releaseGate(R1, upgrade41Ledger).pass && upgrade43Apply.status === 0 &&
      releaseGate(MAIN_BASELINE, upgrade43Ledger).pass && upgradeGate.pass);

  const missing = database('main-missing-0043', mainFiles);
  const missingApply = apply(missing);
  const missingDelete = sql(missing, "DELETE FROM d1_migrations WHERE name = '0043_shopping_demand_review.sql'");
  const missingLedger = ledger(missing), missingGate = schemaGate(missing, mainMigrationDirectory, mainTemplate);
  row('current-main missing migration drift', 'strict release and schema gates reject missing 0043',
    { apply: missingApply.status, delete: missingDelete.status,
      ledger: releaseGate(MAIN_BASELINE, missingLedger), schema: missingGate },
    missingApply.status === 0 && missingDelete.status === 0 &&
      !releaseGate(MAIN_BASELINE, missingLedger).pass && !missingGate.pass &&
      missingGate.issues.some((issue) => issue.issue === 'missing_migration' &&
        issue.detail === '0043_shopping_demand_review.sql'));

  const unknownName = '0044_unexpected_drift.sql';
  const unknown = database('main-unknown-0044', [...mainFiles, {
    name: unknownName, content: 'CREATE TABLE unexpected_drift (id TEXT PRIMARY KEY);\n',
  }]);
  const unknownApply = apply(unknown), unknownLedger = ledger(unknown);
  const unknownGate = schemaGate(unknown, mainMigrationDirectory, mainTemplate);
  row('current-main unknown 0044 drift', 'strict release and schema gates reject unexpected 0044',
    { apply: unknownApply.status, ledger: releaseGate(MAIN_BASELINE, unknownLedger), schema: unknownGate },
    unknownApply.status === 0 && !releaseGate(MAIN_BASELINE, unknownLedger).pass &&
      !unknownGate.pass && unknownGate.issues.some((issue) => issue.issue === 'unexpected_migration' &&
        issue.detail === unknownName));

  const oldSchemaGate = schemaGate(fresh, r1MigrationDirectory, r1Template);
  const oldReleaseGate = releaseGate(PRE_ADMIN, freshLedger);
  row('strict 41-file release gate refuses current-main 0043 ledger',
    'old release gates reject 43 applied migrations; binary rollback is not certified',
    { release: oldReleaseGate, schema: oldSchemaGate },
    !oldReleaseGate.pass && !oldSchemaGate.pass &&
      oldSchemaGate.issues.some((issue) => issue.issue === 'unexpected_migration' &&
        issue.detail === '0042_family_meals_preferences_saved_shopping.sql') &&
      oldSchemaGate.issues.some((issue) => issue.issue === 'unexpected_migration' &&
        issue.detail === '0043_shopping_demand_review.sql'));

  const r1Objects = schemaObjects(db41), mainObjects = schemaObjects(fresh);
  const additive = compareObjects(r1Objects, mainObjects);
  row('current-main additive legacy customer schema', 'all R1 table, index, trigger and view definitions remain unchanged',
    { comparison: additive, r1SchemaSha256: hash(JSON.stringify(r1Objects)),
      currentMainSchemaSha256: hash(JSON.stringify(mainObjects)) }, additive.pass);

  const candidateTemplate = path.join(work, 'v2-schema-gate.sql');
  const candidateMigrationDirectory = path.join(work, 'v2-migrations');
  writeFiles(candidateMigrationDirectory, v2Files);
  writeFileSync(candidateTemplate, git('show', V2_RELEASE_BASELINE + ':scripts/d1-schema-gate.sql'));
  const candidateFresh = database('v2-fresh', v2Files);
  const candidateApply = apply(candidateFresh), candidateLedger = ledger(candidateFresh);
  const candidateGate = schemaGate(candidateFresh, candidateMigrationDirectory, candidateTemplate);
  row('V2 45-file fresh apply + strict gates', 'all45 apply; exact candidate ledger and shared schema gate pass',
    { apply: candidateApply.status, ledger: releaseGate(V2_RELEASE_BASELINE, candidateLedger), schema: candidateGate },
    candidateApply.status === 0 && releaseGate(V2_RELEASE_BASELINE, candidateLedger).pass && candidateGate.pass);

  const v2Additions = v2Files.slice(mainFiles.length);
  writeFiles(upgrade.migrationDirectory, v2Additions);
  const candidateUpgrade = apply(upgrade), candidateReapply = apply(upgrade), upgrade45Ledger = ledger(upgrade);
  const upgrade45Gate = schemaGate(upgrade, upgrade.migrationDirectory, candidateTemplate);
  row('V2 0043 -> 0045 upgrade + re-apply', 'only44/45 apply after the historical upgrade; re-apply is idempotent',
    { additions: v2Additions.map(file => file.name), apply: candidateUpgrade.status, reapply: candidateReapply.status,
      ledger: releaseGate(V2_RELEASE_BASELINE, upgrade45Ledger), schema: upgrade45Gate },
    JSON.stringify(v2Additions.map(file => file.name)) === JSON.stringify([
      '0044_inventory_display_category.sql', '0045_week_swap_receipts.sql',
    ]) && candidateUpgrade.status === 0 && candidateReapply.status === 0 &&
      releaseGate(V2_RELEASE_BASELINE, upgrade45Ledger).pass && upgrade45Gate.pass);

  const candidateMissing = database('v2-missing-0045', v2Files);
  const candidateMissingApply = apply(candidateMissing);
  const candidateMissingDelete = sql(candidateMissing, "DELETE FROM d1_migrations WHERE name = '0045_week_swap_receipts.sql'");
  const candidateMissingLedger = ledger(candidateMissing);
  const candidateMissingGate = schemaGate(candidateMissing, candidateMigrationDirectory, candidateTemplate);
  row('V2 missing0045 drift', 'both candidate gates reject a missing0045 ledger entry',
    { ledger: releaseGate(V2_RELEASE_BASELINE, candidateMissingLedger), schema: candidateMissingGate },
    candidateMissingApply.status === 0 && candidateMissingDelete.status === 0 &&
      !releaseGate(V2_RELEASE_BASELINE, candidateMissingLedger).pass && !candidateMissingGate.pass &&
      candidateMissingGate.issues.some(issue => issue.issue === 'missing_migration' &&
        issue.detail === '0045_week_swap_receipts.sql'));

  const futureName = '0046_unexpected_drift.sql';
  const candidateUnknown = database('v2-unknown-0046', [...v2Files, {
    name: futureName, content: 'CREATE TABLE unexpected_v2_drift (id TEXT PRIMARY KEY);\n',
  }]);
  const candidateUnknownApply = apply(candidateUnknown), candidateUnknownLedger = ledger(candidateUnknown);
  const candidateUnknownGate = schemaGate(candidateUnknown, candidateMigrationDirectory, candidateTemplate);
  row('V2 unknown0046 drift', 'both candidate gates reject an unexpected future migration',
    { ledger: releaseGate(V2_RELEASE_BASELINE, candidateUnknownLedger), schema: candidateUnknownGate },
    candidateUnknownApply.status === 0 && !releaseGate(V2_RELEASE_BASELINE, candidateUnknownLedger).pass &&
      !candidateUnknownGate.pass && candidateUnknownGate.issues.some(issue =>
        issue.issue === 'unexpected_migration' && issue.detail === futureName));

  const rollback43Gate = schemaGate(candidateFresh, mainMigrationDirectory, mainTemplate);
  row('strict43 release rejects V2 ledger on binary rollback', 'old release requires separate recovery certification',
    { ledger: releaseGate(MAIN_BASELINE, candidateLedger), schema: rollback43Gate },
    !releaseGate(MAIN_BASELINE, candidateLedger).pass && !rollback43Gate.pass &&
      v2Additions.every(file => rollback43Gate.issues.some(issue =>
        issue.issue === 'unexpected_migration' && issue.detail === file.name)));

  const v3Template = path.join(work, 'v3-schema-gate.sql');
  const v3MigrationDirectory = path.join(work, 'v3-migrations');
  writeFiles(v3MigrationDirectory, candidateFiles);
  writeFileSync(v3Template, git('show', customerBaseline + ':scripts/d1-schema-gate.sql'));
  const v3Fresh = database('v3-fresh', candidateFiles);
  const v3Apply = apply(v3Fresh), v3Reapply = apply(v3Fresh), v3Ledger = ledger(v3Fresh);
  const v3Gate = schemaGate(v3Fresh, v3MigrationDirectory, v3Template);
  row('V3 47-file fresh apply + re-apply + strict gates', 'all47 apply once; exact candidate ledger and schema gate pass',
    { apply: v3Apply.status, reapply: v3Reapply.status, ledger: releaseGate(customerBaseline, v3Ledger), schema: v3Gate },
    v3Apply.status === 0 && v3Reapply.status === 0 && releaseGate(customerBaseline, v3Ledger).pass && v3Gate.pass);

  const v3Upgrade = database('v3-populated-45-to-47', v2Files);
  const v3BaseApply = apply(v3Upgrade);
  const populatedContentSeed = sql(v3Upgrade, `
    INSERT INTO users(id) VALUES ('matrix-content-user');
    INSERT INTO households(id,name,created_by) VALUES ('matrix-content-house','Synthetic content','matrix-content-user');
    INSERT INTO household_members(id,household_id,user_id,role)
      VALUES ('matrix-content-member','matrix-content-house','matrix-content-user','owner');
    INSERT INTO generated_meal_plans(id,household_id,creator_user_id,request_key,request_fingerprint,intent_json,result_json,source_json)
      VALUES ('matrix-content-plan','matrix-content-house','matrix-content-user','matrix-request','matrix-hash',
        '{"version":1,"data":{}}','{"version":1,"data":{}}','{"version":1,"data":{}}');
    INSERT INTO generated_meal_plan_compositions(plan_id,household_id,creator_user_id,slot_id,mode,created_revision,updated_revision)
      VALUES ('matrix-content-plan','matrix-content-house','matrix-content-user','matrix-slot','manual',1,1);
    INSERT INTO generated_meal_plan_components(plan_id,id,slot_id,ordinal,kind,role,recipe_id,locked,provenance,created_revision,updated_revision)
      VALUES ('matrix-content-plan','matrix-recipe','matrix-slot',0,'recipe','main','gl-03',1,'manual',1,1);
    INSERT INTO generated_meal_plan_components(plan_id,id,slot_id,ordinal,kind,role,simple_food_id,locked,provenance,created_revision,updated_revision)
      VALUES ('matrix-content-plan','matrix-food','matrix-slot',1,'simple_food','simple_food','sf-rice',1,'manual',1,1);
    INSERT INTO cooked_meals(id,household_id,user_id,recipe_id,servings_cooked,deductions_applied)
      VALUES ('matrix-legacy-cook','matrix-content-house','matrix-content-user','gl-03',2,'[]');`);
  const legacyTables = ['users', 'households', 'household_members', 'generated_meal_plans', 'generated_meal_plan_compositions'];
  const legacyRows = () => legacyTables.map(table => query(v3Upgrade, `SELECT * FROM ${table} ORDER BY id`.replace(
    'generated_meal_plan_compositions ORDER BY id', 'generated_meal_plan_compositions ORDER BY plan_id, slot_id')));
  const beforeLegacy = legacyRows();
  const beforeComponents = query(v3Upgrade, 'SELECT * FROM generated_meal_plan_components ORDER BY id');
  const beforeCooking = query(v3Upgrade, 'SELECT * FROM cooked_meals ORDER BY id');
  const v3Additions = candidateFiles.slice(v2Files.length);
  writeFiles(v3Upgrade.migrationDirectory, v3Additions.filter(file => file.name === '0046_recipe_content_versions.sql'));
  const apply46 = apply(v3Upgrade);
  const contentPin = 'a'.repeat(64);
  const archiveSeed = sql(v3Upgrade, `
    INSERT INTO recipe_content_versions(fingerprint,recipe_id,slug,content_json)
      VALUES ('${contentPin}','gl-03','synthetic-archived-egg','{"id":"gl-03","slug":"synthetic-archived-egg"}');
    INSERT INTO recipe_content_access(household_id,fingerprint) VALUES ('matrix-content-house','${contentPin}');
    INSERT INTO cooked_meals(id,household_id,user_id,recipe_id,servings_cooked,deductions_applied,recipe_content_fingerprint,request_fingerprint)
      VALUES ('matrix-pinned-cook','matrix-content-house','matrix-content-user','gl-03',2,'[]','${contentPin}','matrix-original-request');`);
  const preserved46Tables = ['recipe_content_versions', 'recipe_content_access', 'cooked_meals'];
  const histories46 = () => preserved46Tables.map(table => query(v3Upgrade,
    `SELECT * FROM ${table} ORDER BY ${table === 'recipe_content_versions' ? 'fingerprint' : table === 'recipe_content_access' ? 'household_id, fingerprint' : 'id'}`));
  const before46 = histories46();
  const before46Objects = schemaObjects(v3Upgrade);
  writeFiles(v3Upgrade.migrationDirectory, v3Additions);
  const apply47 = apply(v3Upgrade), reapply47 = apply(v3Upgrade), upgrade47Ledger = ledger(v3Upgrade);
  const upgrade47Gate = schemaGate(v3Upgrade, v3Upgrade.migrationDirectory, v3Template);
  const legacyPreserved = JSON.stringify(legacyRows()) === JSON.stringify(beforeLegacy);
  const componentsPreserved = JSON.stringify(query(v3Upgrade, 'SELECT * FROM generated_meal_plan_components ORDER BY id')) ===
    JSON.stringify(beforeComponents.map(component => ({ ...component, recipe_content_fingerprint: null })));
  const cookingPreserved = JSON.stringify(query(v3Upgrade, "SELECT * FROM cooked_meals WHERE id = 'matrix-legacy-cook'")) ===
    JSON.stringify(beforeCooking.map(cook => ({ ...cook, recipe_content_fingerprint: null, request_fingerprint: null })));
  const historiesPreserved46 = JSON.stringify(histories46()) === JSON.stringify(before46);
  const objects46Preserved = compareObjects(before46Objects.filter(object => object.tbl_name !== 'generated_meal_plan_components'), schemaObjects(v3Upgrade));
  const v3Integrity = query(v3Upgrade, 'PRAGMA quick_check'), v3ForeignKeys = query(v3Upgrade, 'PRAGMA foreign_key_check');
  row('V3 populated0045 -> 0046 -> 0047 upgrade + re-apply',
    'only46/47 apply once; legacy data stays exact with unknown pins, existing0046 archive/grants/receipts and objects survive',
    { baselineApply: v3BaseApply.status, seed: populatedContentSeed.status, additions: v3Additions.map(file => file.name),
      apply46: apply46.status, archiveSeed: archiveSeed.status, apply47: apply47.status, reapply: reapply47.status,
      legacyPreserved, componentsPreserved, cookingPreserved, historiesPreserved46, objects46Preserved,
      ledger: releaseGate(customerBaseline, upgrade47Ledger), schema: upgrade47Gate, integrity: v3Integrity, foreignKeys: v3ForeignKeys },
    v3BaseApply.status === 0 && populatedContentSeed.status === 0 && apply46.status === 0 && archiveSeed.status === 0 &&
      apply47.status === 0 && reapply47.status === 0 && JSON.stringify(v3Additions.map(file => file.name)) ===
      JSON.stringify(['0046_recipe_content_versions.sql', '0047_saved_recipe_content.sql']) &&
      legacyPreserved && componentsPreserved && cookingPreserved && historiesPreserved46 && objects46Preserved.pass &&
      releaseGate(customerBaseline, upgrade47Ledger).pass && upgrade47Gate.pass &&
      Object.values(v3Integrity[0] ?? {})[0] === 'ok' && v3ForeignKeys.length === 0);

  const matchingPin = sql(v3Upgrade, `UPDATE generated_meal_plan_components SET recipe_content_fingerprint = '${contentPin}' WHERE id = 'matrix-recipe'`);
  const matchingInsert = sql(v3Upgrade, `INSERT INTO generated_meal_plan_components
      (plan_id,id,slot_id,ordinal,kind,role,recipe_id,locked,provenance,created_revision,updated_revision,recipe_content_fingerprint)
    VALUES ('matrix-content-plan','matrix-new-recipe','matrix-slot',2,'recipe','side','gl-04',0,'manual',1,1,'${contentPin}')`);
  const mismatchedRecipe = sql(v3Upgrade, "UPDATE generated_meal_plan_components SET recipe_id = 'gl-04' WHERE id = 'matrix-recipe'");
  const missingPin = sql(v3Upgrade, `UPDATE generated_meal_plan_components SET recipe_content_fingerprint = '${'b'.repeat(64)}' WHERE id = 'matrix-recipe'`);
  const simpleFoodPin = sql(v3Upgrade, `UPDATE generated_meal_plan_components SET recipe_content_fingerprint = '${contentPin}' WHERE id = 'matrix-food'`);
  const archiveUpdate = sql(v3Upgrade, "UPDATE recipe_content_versions SET slug = 'changed'");
  const archiveDelete = sql(v3Upgrade, 'DELETE FROM recipe_content_versions');
  const archiveReplace = sql(v3Upgrade, `INSERT OR REPLACE INTO recipe_content_versions(fingerprint,recipe_id,slug,content_json)
    VALUES ('${contentPin}','gl-03','synthetic-archived-egg','{"id":"gl-03","slug":"synthetic-archived-egg"}')`);
  const receiptPin = sql(v3Upgrade, "UPDATE cooked_meals SET recipe_content_fingerprint = NULL WHERE id = 'matrix-pinned-cook'");
  const receiptRequest = sql(v3Upgrade, "UPDATE cooked_meals SET request_fingerprint = 'changed' WHERE id = 'matrix-pinned-cook'");
  const finalContentIntegrity = query(v3Upgrade, 'PRAGMA quick_check');
  const finalContentForeignKeys = query(v3Upgrade, 'PRAGMA foreign_key_check');
  row('V3 content identity and retained0046 guards',
    'matching saved pins pass; missing/mismatched/simple-food pins, archive replacement/deletion and receipt identity mutations fail',
    { matchingPin: matchingPin.status, mismatchedInsert: matchingInsert.status, mismatchedRecipe: mismatchedRecipe.status,
      missingPin: missingPin.status, simpleFoodPin: simpleFoodPin.status, archiveUpdate: archiveUpdate.status,
      archiveDelete: archiveDelete.status, archiveReplace: archiveReplace.status, receiptPin: receiptPin.status,
      receiptRequest: receiptRequest.status, integrity: finalContentIntegrity, foreignKeys: finalContentForeignKeys },
    matchingPin.status === 0 && [matchingInsert, mismatchedRecipe, missingPin, simpleFoodPin, archiveUpdate, archiveDelete,
      archiveReplace, receiptPin, receiptRequest].every(result => result.status !== 0) &&
      JSON.stringify(histories46()) === JSON.stringify(before46) && Object.values(finalContentIntegrity[0] ?? {})[0] === 'ok' &&
      finalContentForeignKeys.length === 0);

  for (const missingName of ['0046_recipe_content_versions.sql', '0047_saved_recipe_content.sql']) {
    const missingV3 = database('v3-missing-' + missingName.slice(0, 4), candidateFiles);
    const missingV3Apply = apply(missingV3);
    const missingV3Delete = sql(missingV3, `DELETE FROM d1_migrations WHERE name = '${missingName}'`);
    const missingV3Ledger = ledger(missingV3), missingV3Gate = schemaGate(missingV3, v3MigrationDirectory, v3Template);
    row('V3 missing' + missingName.slice(0, 4) + ' drift', 'both V3 gates reject the missing ledger entry',
      { apply: missingV3Apply.status, delete: missingV3Delete.status,
        ledger: releaseGate(customerBaseline, missingV3Ledger), schema: missingV3Gate },
      missingV3Apply.status === 0 && missingV3Delete.status === 0 && !releaseGate(customerBaseline, missingV3Ledger).pass &&
        !missingV3Gate.pass && missingV3Gate.issues.some(issue => issue.issue === 'missing_migration' && issue.detail === missingName));
  }
  const v3FutureName = '0048_unexpected_drift.sql';
  const v3Unknown = database('v3-unknown-0048', [...candidateFiles, {
    name: v3FutureName, content: 'CREATE TABLE unexpected_v3_drift (id TEXT PRIMARY KEY);\n',
  }]);
  const v3UnknownApply = apply(v3Unknown), v3UnknownLedger = ledger(v3Unknown);
  const v3UnknownGate = schemaGate(v3Unknown, v3MigrationDirectory, v3Template);
  row('V3 unknown0048 drift', 'both V3 gates reject an unexpected future migration',
    { apply: v3UnknownApply.status, ledger: releaseGate(customerBaseline, v3UnknownLedger), schema: v3UnknownGate },
    v3UnknownApply.status === 0 && !releaseGate(customerBaseline, v3UnknownLedger).pass && !v3UnknownGate.pass &&
      v3UnknownGate.issues.some(issue => issue.issue === 'unexpected_migration' && issue.detail === v3FutureName));
  const rollback45Gate = schemaGate(v3Fresh, candidateMigrationDirectory, candidateTemplate);
  row('strict45 release rejects V3 ledger on binary rollback', 'old V2 gates reject46/47; version-aware runtime recovery requires separate certification',
    { ledger: releaseGate(V2_RELEASE_BASELINE, v3Ledger), schema: rollback45Gate },
    !releaseGate(V2_RELEASE_BASELINE, v3Ledger).pass && !rollback45Gate.pass && v3Additions.every(file =>
      rollback45Gate.issues.some(issue => issue.issue === 'unexpected_migration' && issue.detail === file.name)));

  // SQL-only D1 evidence; this section does not infer Worker runtime or flags-OFF recovery.
  const r1AdminManifest = manifest(r1AdminFiles);
  const addedAdmin = currentAdminFiles.filter((file) => !r1AdminFiles.some((old) => old.name === file.name));
  const r1ToR2 = database('admin-r1-to-r2', r1AdminFiles, true);
  const adminBaseApply = apply(r1ToR2), adminBaseState = adminState(r1ToR2);
  row('R1 Admin DB version mismatches current Worker before upgrade',
    'R1 stored version differs from current Worker expectation; no Worker request is made',
    { stored: adminBaseState.schema_version, r1Worker: r1Version, currentWorker: currentVersion,
      runtimeGate: 'ADMIN_SCHEMA_MISMATCH response requires separate Workerd evidence' },
    adminBaseApply.status === 0 && adminBaseState.schema_version === r1Version && currentVersion !== r1Version);

  writeFiles(r1ToR2.migrationDirectory, currentAdminFiles);
  const r2Apply = apply(r1ToR2), r2Reapply = apply(r1ToR2);
  const r2Ledger = ledger(r1ToR2), r2State = adminState(r1ToR2);
  const r2Gate = adminGate(adminManifest, r2Ledger);
  row('Admin D1 local R1 -> R2 apply + re-apply',
    'actual Admin manifest applies once and records current Worker schema version',
    { baselineApply: adminBaseApply.status, baselineVersion: adminBaseState.schema_version,
      added: addedAdmin.map((file) => file.name), apply: r2Apply.status, reapply: r2Reapply.status,
      manifest: { count: adminManifest.count, version: adminManifest.version, sha256: adminManifest.sha256 },
      ledger: r2Gate, state: r2State, workerExpectedVersion: currentVersion },
    adminBaseApply.status === 0 && addedAdmin.length > 0 && r2Apply.status === 0 &&
      r2Reapply.status === 0 && r2Gate.pass && r2State.ledger === adminManifest.count &&
      r2State.schema_version === currentVersion);

  const adminFresh = database('admin-r2-fresh', currentAdminFiles, true);
  const adminFreshApply = apply(adminFresh), adminFreshReapply = apply(adminFresh);
  const adminFreshLedger = adminGate(adminManifest, ledger(adminFresh));
  const adminFreshState = adminState(adminFresh);
  row('current Admin D1 fresh apply + re-apply', 'actual Admin manifest applies once with exact ledger and Worker version',
    { apply: adminFreshApply.status, reapply: adminFreshReapply.status,
      manifest: { count: adminManifest.count, version: adminManifest.version, sha256: adminManifest.sha256 },
      ledger: adminFreshLedger, state: adminFreshState },
    adminFreshApply.status === 0 && adminFreshReapply.status === 0 && adminFreshLedger.pass &&
      adminFreshState.ledger === adminManifest.count && adminFreshState.schema_version === currentVersion);

  const schema3Files = currentAdminFiles.filter(file => Number(file.name.slice(0, 4)) <= 3);
  const populated3 = database('admin-populated-3-to-4', schema3Files, true);
  const populatedBaseApply = apply(populated3);
  const fixtureFile = path.join(populated3.dir, 'synthetic-admin.sql');
  writeFileSync(fixtureFile, buildAdminFixtureSql().admin + `
    INSERT INTO admin_action_approvals(id,action,target_user_id,requested_by,requested_at,expires_at,requester_access_iss,requester_access_sub)
    VALUES('pending_upgrade','role.grant.super_admin','fx_admin_ops','fx_admin_super','2026-10-17','2099-01-01','https://fixture.cloudflareaccess.com','fx-sub-super');`);
  const populatedSeed = wrangler(populated3.config, ['execute', populated3.database, '--persist-to', populated3.persist, '--file', fixtureFile, '--yes']);
  const historyTables = ['admin_bootstrap_ceremonies', 'admin_role_assignments', 'admin_action_approvals', 'admin_audit_events', 'admin_recovery_operations'];
  const histories = () => historyTables.map(table => query(populated3, `SELECT * FROM ${table} ORDER BY id`));
  const priorHistories = histories();
  writeFiles(populated3.migrationDirectory, currentAdminFiles);
  const ownerUpgrade = apply(populated3), ownerReapply = apply(populated3);
  const historiesPreserved = JSON.stringify(histories()) === JSON.stringify(priorHistories);
  const ownerState = adminState(populated3);
  const ownerConfirm = sql(populated3, "UPDATE admin_action_approvals SET status='approved',decided_by='fx_admin_super',decided_at='2026-10-18',decider_access_iss='https://fixture.cloudflareaccess.com',decider_access_sub='fx-sub-super' WHERE id='pending_upgrade'");
  const ownerIntegrity = query(populated3, 'PRAGMA quick_check');
  const ownerForeignKeys = query(populated3, 'PRAGMA foreign_key_check');
  row('populated Admin schema 3 -> 4 owner governance',
    'D1 preserves authority/audit histories, applies once, permits owner confirmation and passes integrity',
    { baselineApply: populatedBaseApply.status, seed: populatedSeed.status, upgrade: ownerUpgrade.status,
      reapply: ownerReapply.status, historiesPreserved, state: ownerState, confirm: ownerConfirm.status,
      integrity: ownerIntegrity, foreignKeys: ownerForeignKeys },
    populatedBaseApply.status === 0 && populatedSeed.status === 0 && ownerUpgrade.status === 0 && ownerReapply.status === 0 &&
      historiesPreserved && ownerState.schema_version === currentVersion && ownerConfirm.status === 0 &&
      Object.values(ownerIntegrity[0] ?? {})[0] === 'ok' && ownerForeignKeys.length === 0);

  const failedOwner = database('admin-owner-failed', schema3Files, true);
  const failedOwnerBase = apply(failedOwner);
  const ownerConflict = sql(failedOwner, 'CREATE TABLE admin_owner_enrollments (conflict TEXT)');
  writeFiles(failedOwner.migrationDirectory, currentAdminFiles);
  const failedOwnerApply = apply(failedOwner), failedOwnerState = adminState(failedOwner);
  const oldGuard = query(failedOwner, "SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_admin_roles_three_operators'");
  const rebuiltTables = query(failedOwner, "SELECT name FROM sqlite_master WHERE name LIKE '%_next'");
  row('failed Admin schema 4 restores schema-3 transaction guards',
    'late DDL conflict rolls back all earlier table rebuilds, trigger removals, version and ledger',
    { baselineApply: failedOwnerBase.status, injection: ownerConflict.status, failedApply: failedOwnerApply.status,
      state: failedOwnerState, priorGuardPresent: oldGuard.length === 1, temporaryTables: rebuiltTables },
    failedOwnerBase.status === 0 && ownerConflict.status === 0 && failedOwnerApply.status !== 0 &&
      failedOwnerState.schema_version === '3' && failedOwnerState.ledger === 3 && oldGuard.length === 1 && rebuiltTables.length === 0);

  const addedSql = addedAdmin.map((file) => file.content).join('\n');
  const columns = [...addedSql.matchAll(/ALTER\s+TABLE\s+admin_sessions\s+ADD\s+COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)/gi)]
    .map((match) => match[1]);
  if (columns.length < 2) throw new Error('R2 rollback injection needs two new admin_sessions columns');
  const failedR2 = database('admin-r2-failed', r1AdminFiles, true);
  const failedBaseApply = apply(failedR2), firstColumn = columns[0], injectedColumn = columns[1];
  const injection = sql(failedR2, 'ALTER TABLE admin_sessions ADD COLUMN ' + injectedColumn + ' TEXT');
  writeFiles(failedR2.migrationDirectory, currentAdminFiles);
  const failedApply = apply(failedR2);
  const failedState = query(failedR2, "SELECT (SELECT COUNT(*) FROM d1_migrations) AS ledger, (SELECT value FROM admin_config_metadata WHERE key = 'schema_version') AS schema_version, (SELECT COUNT(*) FROM pragma_table_info('admin_sessions') WHERE name = '" + firstColumn + "') AS first_added_column, (SELECT COUNT(*) FROM pragma_table_info('admin_sessions') WHERE name = '" + injectedColumn + "') AS injected_column")[0];
  row('R2 failed apply rolls back schema-version and prior DDL',
    'duplicate-column failure leaves R1 ledger/version intact and rolls back earlier R2 DDL (SQL-only)',
    { baselineApply: failedBaseApply.status, injection: injection.status, failedApply: failedApply.status,
      firstColumn, injectedColumn, state: failedState,
      error: (failedApply.stderr || failedApply.stdout).split('\n').find((line) => /already exists|duplicate column|error/i.test(line)) ?? null },
    failedBaseApply.status === 0 && injection.status === 0 && failedApply.status !== 0 &&
      failedState.ledger === r1AdminManifest.count && failedState.schema_version === r1Version &&
      failedState.first_added_column === 0 && failedState.injected_column === 1);
} catch (error) {
  row('matrix execution', 'completes', error instanceof Error ? error.message : String(error), false);
} finally {
  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      head: runEvidence.head,
      tree: runEvidence.tree,
      matrixScriptSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
      customerBaselineGuardSha256: hash(readFileSync(new URL('./admin-customer-baseline.mjs', import.meta.url))),
      historicalR1: R1,
      currentMainBaseline: MAIN_BASELINE,
      v2ReleaseBaseline: V2_RELEASE_BASELINE,
      v3ReleaseBaseline: runEvidence.customerBaseline,
      currentMainMergeBase: runEvidence.mergeBase,
      dirtyScopedPaths: runEvidence.dirtyScopedPaths,
    },
    adminSchema: {
      migrationManifest: runEvidence.adminManifest,
      workerExpectedVersion: runEvidence.workerVersion,
      workerSourceSha256: runEvidence.workerSourceSha256,
    },
    boundary: {
      WRANGLER_SEND_METRICS: env.WRANGLER_SEND_METRICS,
      remote: 'none (wrangler d1 --local only)',
      applicationRuntime: 'not tested by this SQL-only matrix; flags-OFF recovery and Worker responses require separate local Workerd/runtime evidence',
    },
    pass: rows.length > 0 && rows.every((entry) => entry.pass),
    rows,
  };
  if (out) writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log('migration-matrix: ' + (report.pass ? 'PASS' : 'FAIL') + ' (' +
    rows.filter((entry) => entry.pass).length + '/' + rows.length + ')');
  if (!report.pass) process.exitCode = 1;
  rmSync(work, { recursive: true, force: true });
  rmSync(env.XDG_CONFIG_HOME, { recursive: true, force: true });
}
