#!/usr/bin/env node
// Local Wrangler D1 matrix for immutable R1 regressions, current-main customer
// migrations, and the separate Admin D1 upgrade. No remote commands.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localWranglerEnv } from './admin-local-lib.mjs';
import { CUSTOMER_BASELINE, selectGuardedCustomerBaseline } from './admin-customer-baseline.mjs';
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
  head: null, tree: null, mergeBase: null, dirtyScopedPaths: null,
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
  return json(sql(db, statement), 'D1 query').flatMap((entry) => entry.results ?? []);
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
  const { mainBase: mergeBase } = selectGuardedCustomerBaseline({
    git, originalBaseline: MAIN_BASELINE, guardedPaths: ['migrations', 'scripts/d1-schema-gate.sql'],
  });
  runEvidence.head = head;
  runEvidence.tree = git('rev-parse', head + '^{tree}');
  runEvidence.mergeBase = mergeBase;
  runEvidence.dirtyScopedPaths = git('status', '--porcelain', '--', 'scripts/admin-migration-matrix.mjs', 'scripts/admin-customer-baseline.mjs', 'migrations', 'migrations-admin', 'src/worker/routes/admin/auth.ts');
  const r1Files = filesAt(R1, 'migrations');
  const preFiles = filesAt(PRE_ADMIN, 'migrations');
  const originalFiles = filesAt(ORIGINAL_ADMIN, 'migrations');
  const mainFiles = filesAt(MAIN_BASELINE, 'migrations');
  const r1AdminFiles = filesAt(R1, 'migrations-admin');
  const currentAdminFiles = filesOnDisk(path.join(root, 'migrations-admin'));
  const r1Manifest = migrationManifest(root, R1);
  const preManifest = migrationManifest(root, PRE_ADMIN);
  const mainManifest = migrationManifest(root, MAIN_BASELINE);
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
    headManifest.sha256 === mainManifest.sha256 && workingManifest.sha256 === mainManifest.sha256;
  row('current-main customer ledger identity', 'HEAD and working migrations match pinned 43-file current main (names + SHA-256)',
    { head, baseline: MAIN_BASELINE, currentMain: mainManifest.sha256, headManifest: headManifest.sha256,
      workingManifest: workingManifest.sha256, count: mainManifest.count,
      status: git('status', '--porcelain', '--', 'migrations') || 'clean' }, mainIdentity);

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
