#!/usr/bin/env node
// Local-only, one-time, two-person Admin Console bootstrap against local
// Wrangler D1 (Miniflare). No HTTP endpoint exists for this. Refuses outside
// development, in CI, with remote flags, or with a Cloudflare token present;
// child wrangler processes run with telemetry off and no reachable OAuth login.
//
//   pnpm admin:provision -- --local --email a@example.test --email b@example.test
//   pnpm admin:provision -- --local --create-accounts --password '<12+ chars>' --email a@example.test --email b@example.test
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertLocalProvisioningAllowed, buildBootstrapAccountLookupSql, buildBootstrapAdminSql, buildLocalAccountSql, localWranglerEnv,
} from './admin-local-lib.mjs';

const argv = process.argv.slice(2);
const CONFIG = 'wrangler.admin-local.jsonc';
function values(name) {
  const out = [];
  argv.forEach((arg, index) => {
    if (arg === name) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
      out.push(value);
    }
  });
  return out;
}

function wranglerLocal(database, args, persistTo, env) {
  const full = ['exec', 'wrangler', 'd1', 'execute', database, '--local', '--json', '-c', CONFIG, ...args];
  if (persistTo) full.push('--persist-to', persistTo);
  if (full.includes('--remote')) throw new Error('Refusing remote wrangler invocation');
  const result = spawnSync('pnpm', full, { encoding: 'utf8', env });
  if (result.status !== 0) throw new Error(`wrangler --local failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

try {
  assertLocalProvisioningAllowed({ argv });
  const emails = values('--email');
  const persistTo = values('--persist-to')[0];
  const env = localWranglerEnv();
  const dir = mkdtempSync(path.join(tmpdir(), 'takosan-admin-provision-'));
  try {
    if (argv.includes('--create-accounts')) {
      const password = values('--password')[0];
      for (const email of emails) {
        const file = path.join(dir, `account-${randomBytes(4).toString('hex')}.sql`);
        writeFileSync(file, buildLocalAccountSql({ email, password, name: email.split('@')[0] }));
        wranglerLocal('frigo-db', ['--file', file], persistTo, env);
      }
    }
    const lookup = JSON.parse(wranglerLocal('frigo-db', ['--command', buildBootstrapAccountLookupSql(emails).replace(/\s+/g, ' ')], persistTo, env));
    const accounts = lookup[0]?.results ?? [];
    if (accounts.length !== 2 || new Set(accounts.map((row) => row.user_id)).size !== 2) {
      console.error('Bootstrap needs two existing, verified, non-guest accounts with different users.');
      process.exit(2);
    }
    const assignmentIds = [`ara_${randomBytes(12).toString('hex')}`, `ara_${randomBytes(12).toString('hex')}`];
    const file = path.join(dir, 'bootstrap.sql');
    writeFileSync(file, buildBootstrapAdminSql({ userIds: accounts.map((row) => row.user_id), assignmentIds }));
    let output;
    try {
      output = wranglerLocal('takosan-admin-db', ['--file', file], persistTo, env);
    } catch (error) {
      if (/already been completed/.test(String(error))) output = '';
      else throw error;
    }
    if (!/"granted":\s*2\b/.test(output)) {
      console.error('No SUPER_ADMIN was granted: bootstrap is one-time and only runs on an admin database that has never had an assignment.');
      process.exit(2);
    }
    console.log(`Granted local SUPER_ADMIN to ${accounts.map((row) => row.email).join(' and ')} (two-person bootstrap).`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(env.XDG_CONFIG_HOME, { recursive: true, force: true });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
