#!/usr/bin/env node
// Local Wrangler D1 (Miniflare) lifecycle for the Admin Console: both the
// customer database (frigo-db) and the admin database (takosan-admin-db).
//   pnpm admin:local:reset -- --yes   delete local D1 state, re-apply migrations, seed the fixture
//   pnpm admin:local:seed             apply migrations + synthetic fixture (skips if already present)
// Only `--local` wrangler commands are issued, with telemetry off and no reachable OAuth login.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertLocalProvisioningAllowed, buildAdminFixtureSql, FIXTURE_DATASET, localWranglerEnv } from './admin-local-lib.mjs';

const CONFIG = 'wrangler.admin-local.jsonc';
const [command, ...rest] = process.argv.slice(2);
const persistIndex = rest.indexOf('--persist-to');
const persistTo = persistIndex === -1 ? undefined : rest[persistIndex + 1];
const env = localWranglerEnv();

function wrangler(args) {
  const full = ['exec', 'wrangler', 'd1', ...args, '--local', '-c', args.includes('frigo-db') ? 'wrangler.admin-facade-local.jsonc' : CONFIG, ...(persistTo ? ['--persist-to', persistTo] : [])];
  if (full.includes('--remote')) throw new Error('Refusing remote wrangler invocation');
  const result = spawnSync('pnpm', full, { encoding: 'utf8', env: { ...env, CI: 'true' } });
  if (result.status !== 0) throw new Error(`wrangler ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

function seed() {
  wrangler(['migrations', 'apply', 'frigo-db']);
  wrangler(['migrations', 'apply', 'takosan-admin-db']);
  const marker = wrangler(['execute', 'takosan-admin-db', '--json', '--command', "SELECT value FROM admin_config_metadata WHERE key = 'fixture_dataset'"]);
  if (marker.includes(FIXTURE_DATASET)) {
    console.log(`Fixture ${FIXTURE_DATASET} already present; nothing to do (use reset to rebuild).`);
    return;
  }
  const dir = mkdtempSync(path.join(tmpdir(), 'takosan-admin-fixture-'));
  try {
    const fixture = buildAdminFixtureSql();
    writeFileSync(path.join(dir, 'main.sql'), fixture.main);
    writeFileSync(path.join(dir, 'admin.sql'), fixture.admin);
    wrangler(['execute', 'frigo-db', '--file', path.join(dir, 'main.sql')]);
    wrangler(['execute', 'takosan-admin-db', '--file', path.join(dir, 'admin.sql')]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`Seeded synthetic fixture ${FIXTURE_DATASET} into local D1 (frigo-db + takosan-admin-db).`);
}

try {
  assertLocalProvisioningAllowed({ argv: ['--local', ...rest.filter((arg) => arg !== '--yes')] });
  if (command === 'seed') {
    seed();
  } else if (command === 'reset') {
    if (!rest.includes('--yes')) throw new Error('reset deletes local D1 state; re-run with --yes');
    const state = path.resolve(persistTo ?? '.wrangler/state', 'v3', 'd1');
    rmSync(state, { recursive: true, force: true });
    console.log(`Deleted ${state}`);
    seed();
  } else {
    throw new Error('Usage: admin-local-d1.mjs <seed|reset> [--yes] [--persist-to DIR]');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  rmSync(env.XDG_CONFIG_HOME, { recursive: true, force: true });
}
