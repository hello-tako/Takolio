#!/usr/bin/env node
// Local wrangler D1 (Miniflare) lifecycle for Admin Console development.
//   pnpm admin:local:reset -- --yes   delete local D1 state, re-apply migrations, seed fixture
//   pnpm admin:local:seed             apply migrations + synthetic fixture (idempotent marker check)
// Only `--local` wrangler commands are issued.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertLocalProvisioningAllowed, buildAdminFixtureSql, FIXTURE_DATASET } from './admin-local-lib.mjs';

const [command, ...rest] = process.argv.slice(2);
const persistIndex = rest.indexOf('--persist-to');
const persistTo = persistIndex === -1 ? undefined : rest[persistIndex + 1];

function wrangler(args) {
  const full = ['exec', 'wrangler', 'd1', ...args, '--local', ...(persistTo ? ['--persist-to', persistTo] : [])];
  if (full.includes('--remote')) throw new Error('Refusing remote wrangler invocation');
  const result = spawnSync('pnpm', full, { encoding: 'utf8', env: { ...process.env, CLOUDFLARE_API_TOKEN: '', CI: 'true' } });
  if (result.status !== 0) throw new Error(`wrangler ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

function seed() {
  wrangler(['migrations', 'apply', 'frigo-db']);
  const marker = wrangler(['execute', 'frigo-db', '--json', '--command', "SELECT value FROM admin_config_metadata WHERE key = 'fixture_dataset'"]);
  if (marker.includes(FIXTURE_DATASET)) {
    console.log(`Fixture ${FIXTURE_DATASET} already present; nothing to do (use reset to rebuild).`);
    return;
  }
  const dir = mkdtempSync(path.join(tmpdir(), 'takosan-admin-fixture-'));
  try {
    const file = path.join(dir, 'fixture.sql');
    writeFileSync(file, buildAdminFixtureSql());
    wrangler(['execute', 'frigo-db', '--file', file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`Seeded synthetic fixture ${FIXTURE_DATASET} into local D1.`);
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
  process.exit(1);
}
