#!/usr/bin/env node
// Offline migration / rollback matrix for the Admin Console, using the repository's
// own release gates (scripts/release-check.mjs verifyMigrationLedger + migrationManifest,
// scripts/d1-schema-gate.mjs) against local Wrangler D1 ledgers. No remote commands.
//
//   node scripts/admin-migration-matrix.mjs [--out FILE]
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { localWranglerEnv } from './admin-local-lib.mjs';
import { migrationManifest, verifyMigrationLedger } from './release-check.mjs';
import { renderSchemaGateCommand } from './d1-schema-gate.mjs';

const argv = process.argv.slice(2);
const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
const root = process.cwd();
const env = localWranglerEnv();
const work = mkdtempSync(path.join(tmpdir(), 'takosan-migration-matrix-'));
const PRE_ADMIN = '186a9cf05de7c91ed3289e13130feb3b38a264ac';
const ORIGINAL_ADMIN = '3e865d009ee62a92ed1d9c8d225a36893035670b';

function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
}

function wrangler(config, args) {
  const full = ['exec', 'wrangler', 'd1', ...args, '--local', '-c', config];
  if (full.includes('--remote')) throw new Error('Refusing remote wrangler invocation');
  const result = spawnSync('pnpm', full, { cwd: root, env: { ...env, CI: 'true' }, encoding: 'utf8', maxBuffer: 1 << 26 });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** A throwaway customer-D1 config whose migrations_dir holds `files` (from any commit). */
function customerDb(name, files) {
  const dir = path.join(work, name);
  mkdirSync(path.join(dir, 'migrations'), { recursive: true });
  for (const { name: file, content } of files) writeFileSync(path.join(dir, 'migrations', file), content);
  const config = path.join(dir, 'wrangler.json');
  writeFileSync(config, JSON.stringify({ name: `matrix-${name}`, main: path.join(root, 'src/worker/index.ts'), compatibility_date: '2024-11-01',
    d1_databases: [{ binding: 'DB', database_name: 'frigo-db', database_id: '00000000-0000-4000-8000-0000000000aa', migrations_dir: path.join(dir, 'migrations') }] }));
  return { dir, config, persist: path.join(dir, 'state') };
}

function filesAt(sha) {
  return git('ls-tree', '-r', '--name-only', sha, '--', 'migrations').split('\n').filter((f) => f.endsWith('.sql'))
    .map((file) => ({ name: file.replace(/^migrations\//, ''), content: git('show', `${sha}:${file}`) }));
}

function apply(db) {
  return wrangler(db.config, ['migrations', 'apply', 'frigo-db', '--persist-to', db.persist]);
}

function ledger(db) {
  const result = wrangler(db.config, ['execute', 'frigo-db', '--persist-to', db.persist, '--json', '--command', 'SELECT name FROM d1_migrations ORDER BY name']);
  return JSON.parse(result.stdout);
}

/** The repository's deploy-time ledger check for a release SHA. */
function releaseGate(sha, statements) {
  try {
    verifyMigrationLedger(migrationManifest(root, sha), statements);
    return { pass: true };
  } catch (error) {
    return { pass: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** The repository's read-only schema gate rendered for a given migrations directory. */
function schemaGate(db, migrationsDirectory) {
  const result = wrangler(db.config, ['execute', 'frigo-db', '--persist-to', db.persist, '--json', '--yes', '--command',
    renderSchemaGateCommand({ template: path.join(root, 'scripts/d1-schema-gate.sql'), migrationsDirectory })]);
  if (result.status !== 0) return { pass: false, error: (result.stderr || result.stdout).slice(-300) };
  const issues = JSON.parse(result.stdout).flatMap((statement) => statement.results ?? []);
  return { pass: issues.length === 0, issues: issues.slice(0, 5) };
}

const rows = [];
function row(scenario, expectation, observed, pass) {
  rows.push({ scenario, expectation, observed, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${scenario} — ${expectation}`);
}

try {
  const head = git('rev-parse', 'HEAD').trim();
  const headStatus = git('status', '--porcelain', '--', 'migrations', 'migrations-admin').trim();
  const pre = filesAt(PRE_ADMIN);
  const original = filesAt(ORIGINAL_ADMIN);
  const current = readdirSync(path.join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();

  // Customer schema identity: the remediated tree ships exactly the pre-admin migrations.
  const preManifest = migrationManifest(root, PRE_ADMIN);
  const headManifest = migrationManifest(root, head);
  row('customer ledger identity', 'HEAD migrations/ equals the pre-admin release (names + SHA-256)', { pre: preManifest.sha256, head: headManifest.sha256, headStatus: headStatus || 'clean', count: current.length },
    preManifest.sha256 === headManifest.sha256 && current.length === pre.length && !headStatus);

  // DB at 0041 (current production shape).
  const db41 = customerDb('db41', pre);
  const applied41 = apply(db41);
  const ledger41 = ledger(db41);
  row('DB 0041 + old application (pre-admin release)', 'deploy ledger gate passes', releaseGate(PRE_ADMIN, ledger41), releaseGate(PRE_ADMIN, ledger41).pass && applied41.status === 0);
  row('DB 0041 + new application (remediated HEAD)', 'deploy ledger gate passes; customer release train unchanged', releaseGate(head, ledger41), releaseGate(head, ledger41).pass);
  const gate41 = schemaGate(db41, path.join(root, 'migrations'));
  row('DB 0041 + new application schema gate', 'read-only schema gate (HEAD migrations) reports no issue', gate41, gate41.pass);
  row('DB 0041 + ORIGINAL admin commit 3e865d0 (review finding)', 'deploy gate fails before 0042 is applied (reproduces the release-train block)', releaseGate(ORIGINAL_ADMIN, ledger41), !releaseGate(ORIGINAL_ADMIN, ledger41).pass);

  // DB at 0042 under the ORIGINAL design (0042 in the customer ledger).
  const db42 = customerDb('db42', original);
  apply(db42);
  const ledger42 = ledger(db42);
  row('DB 0042 (original design) + old application rollback (review finding)', 'pre-admin release is rejected (reproduces the rollback defect)', releaseGate(PRE_ADMIN, ledger42), !releaseGate(PRE_ADMIN, ledger42).pass);
  row('DB 0042 (original design) + remediated HEAD', 'rejected as unexpected forward drift; remediation never needs 0042 in the customer DB', releaseGate(head, ledger42), !releaseGate(head, ledger42).pass);

  // Unexpected extra migration / drift in the customer DB is still refused by both gates.
  const drift = customerDb('drift', [...pre, { name: '0042_unexpected_drift.sql', content: 'CREATE TABLE unexpected_drift (id TEXT PRIMARY KEY);\n' }]);
  apply(drift);
  const ledgerDrift = ledger(drift);
  const gateDrift = schemaGate(drift, path.join(root, 'migrations'));
  row('Unexpected extra customer migration', 'deploy ledger gate and schema gate both reject', { ledger: releaseGate(head, ledgerDrift), schema: gateDrift }, !releaseGate(head, ledgerDrift).pass && !gateDrift.pass);

  // Admin database: fresh apply, idempotent re-apply, failed migration, version gate.
  const adminDir = path.join(work, 'admin');
  mkdirSync(path.join(adminDir, 'migrations-admin'), { recursive: true });
  for (const file of readdirSync(path.join(root, 'migrations-admin'))) copyFileSync(path.join(root, 'migrations-admin', file), path.join(adminDir, 'migrations-admin', file));
  const adminConfig = path.join(adminDir, 'wrangler.json');
  writeFileSync(adminConfig, JSON.stringify({ name: 'matrix-admin', main: path.join(root, 'src/worker/admin-worker.ts'), compatibility_date: '2024-11-01',
    d1_databases: [{ binding: 'ADMIN_DB', database_name: 'takosan-admin-db', database_id: '00000000-0000-4000-8000-0000000000bb', migrations_dir: path.join(adminDir, 'migrations-admin') }] }));
  const adminPersist = path.join(adminDir, 'state');
  const adminApply = wrangler(adminConfig, ['migrations', 'apply', 'takosan-admin-db', '--persist-to', adminPersist]);
  const adminReapply = wrangler(adminConfig, ['migrations', 'apply', 'takosan-admin-db', '--persist-to', adminPersist]);
  const adminState = JSON.parse(wrangler(adminConfig, ['execute', 'takosan-admin-db', '--persist-to', adminPersist, '--json', '--command',
    "SELECT (SELECT COUNT(*) FROM d1_migrations) AS ledger, (SELECT value FROM admin_config_metadata WHERE key = 'schema_version') AS schema_version, (SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_admin_%') AS triggers"]).stdout)[0].results[0];
  row('Admin DB fresh apply + re-apply', 'migrations-admin applies once (ledger 1, schema_version 1, 9 triggers); re-apply is a no-op',
    { apply: adminApply.status, reapply: adminReapply.status, state: adminState }, adminApply.status === 0 && adminReapply.status === 0 && adminState.ledger === 1 && adminState.schema_version === '1' && adminState.triggers === 9);

  const failedPersist = path.join(adminDir, 'failed-state');
  wrangler(adminConfig, ['execute', 'takosan-admin-db', '--persist-to', failedPersist, '--command', 'CREATE TABLE admin_audit_events (conflict INTEGER)']);
  const failed = wrangler(adminConfig, ['migrations', 'apply', 'takosan-admin-db', '--persist-to', failedPersist]);
  const failedState = JSON.parse(wrangler(adminConfig, ['execute', 'takosan-admin-db', '--persist-to', failedPersist, '--json', '--command',
    "SELECT (SELECT COUNT(*) FROM d1_migrations) AS ledger, (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name LIKE 'admin_%') AS admin_tables, (SELECT COUNT(*) FROM sqlite_master WHERE name = 'admin_config_metadata') AS metadata_table"]).stdout)[0].results[0];
  row('Failed admin migration', 'apply fails, the ledger does not record it, no partial admin schema remains (admin Worker stays 503 ADMIN_SCHEMA_MISMATCH)',
    { exit: failed.status, state: failedState, error: (failed.stderr || failed.stdout).split('\n').find((line) => /already exists|error/i.test(line)) ?? null },
    failed.status !== 0 && failedState.ledger === 0 && failedState.metadata_table === 0);
  row('Customer application rollback with admin schema present', 'admin schema is in a separate database; the customer ledger is untouched, so legacy release gates pass',
    { preAdminGate: releaseGate(PRE_ADMIN, ledger41).pass }, releaseGate(PRE_ADMIN, ledger41).pass);
} catch (error) {
  row('matrix execution', 'completes', error instanceof Error ? error.message : String(error), false);
} finally {
  const report = { generatedAt: new Date().toISOString(), boundary: { WRANGLER_SEND_METRICS: env.WRANGLER_SEND_METRICS, remote: 'none (wrangler d1 --local only)' },
    pass: rows.every((r) => r.pass), rows };
  if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`migration-matrix: ${report.pass ? 'PASS' : 'FAIL'} (${rows.filter((r) => r.pass).length}/${rows.length})`);
  if (!report.pass) process.exitCode = 1;
  rmSync(work, { recursive: true, force: true });
  rmSync(env.XDG_CONFIG_HOME, { recursive: true, force: true });
}
