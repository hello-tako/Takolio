#!/usr/bin/env node
// Local-only one-time Admin Console bootstrap against the *local* wrangler D1
// (Miniflare state). There is no HTTP endpoint for this; it fails closed outside
// development, in CI, with remote flags, or when a Cloudflare API token is set.
//
//   pnpm admin:provision -- --local --email you@example.com
//   pnpm admin:provision -- --local --email dev@example.test --create-account --password '...' --name 'Dev'
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertLocalProvisioningAllowed, buildBootstrapSql, buildLocalAccountSql } from './admin-local-lib.mjs';

const argv = process.argv.slice(2);
function option(name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function wranglerLocal(file, persistTo) {
  const args = ['exec', 'wrangler', 'd1', 'execute', 'frigo-db', '--local', '--json', '--file', file];
  if (persistTo) args.push('--persist-to', persistTo);
  // Defense in depth: this command line must never contain a remote target.
  if (args.includes('--remote')) throw new Error('Refusing remote wrangler invocation');
  const result = spawnSync('pnpm', args, { encoding: 'utf8', env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } });
  if (result.status !== 0) throw new Error(`wrangler --local failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

try {
  assertLocalProvisioningAllowed({ argv });
  const email = option('--email');
  const persistTo = option('--persist-to');
  const dir = mkdtempSync(path.join(tmpdir(), 'takosan-admin-provision-'));
  try {
    if (argv.includes('--create-account')) {
      const accountFile = path.join(dir, 'account.sql');
      writeFileSync(accountFile, buildLocalAccountSql({ email, password: option('--password'), name: option('--name') }));
      wranglerLocal(accountFile, persistTo);
    }
    const assignmentId = `ara_${randomBytes(12).toString('hex')}`;
    const file = path.join(dir, 'bootstrap.sql');
    writeFileSync(file, buildBootstrapSql({ email, assignmentId }));
    const output = wranglerLocal(file, persistTo);
    const granted = /"granted":\s*1\b/.test(output);
    if (!granted) {
      console.error('No SUPER_ADMIN was granted: the account must exist and be verified, and bootstrap is one-time (an active SUPER_ADMIN already exists). Grant further roles from the console.');
      process.exit(2);
    }
    console.log(`Granted local SUPER_ADMIN to ${email.trim().toLowerCase()} (assignment ${assignmentId}).`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
