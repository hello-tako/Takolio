import { execFileSync, spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { digest } from '../../scripts/admin-release-adapter.mjs';
import { canonical } from '../../scripts/admin-recovery.mjs';

const directories = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

function fixture(approved = true) {
  const directory = mkdtempSync(path.join(tmpdir(), 'takolio-admin-cli-'));
  directories.push(directory);
  for (const name of ['scripts', 'admin', 'migrations-admin']) mkdirSync(path.join(directory, name));
  for (const name of ['admin-release-adapter.mjs', 'admin-release-provider.mjs', 'admin-recovery.mjs', 'admin-local-lib.mjs']) {
    copyFileSync(`scripts/${name}`, path.join(directory, 'scripts', name));
  }
  for (const name of ['wrangler.admin.jsonc', 'wrangler.admin-facade.jsonc']) copyFileSync(name, path.join(directory, name));
  writeFileSync(path.join(directory, '.gitignore'), '.artifacts/\n');
  writeFileSync(path.join(directory, 'migrations-admin/0001_fixture.sql'), '-- offline synthetic migration\n');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const policy = JSON.parse(readFileSync('admin/release-policy.json', 'utf8'));
  for (const target of Object.values(policy.environments)) {
    target.custodians = [{ operatorId: 'synthetic-owner', publicKey: publicKey.export({ format: 'pem', type: 'spki' }), approvalRef: 'synthetic-review' }];
  }
  writeFileSync(path.join(directory, 'admin/release-policy.json'), JSON.stringify(policy));
  // Preload a closed HTTP boundary so the real CLI can never reach either provider.
  writeFileSync(path.join(directory, 'offline-fetch.mjs'), `
const sha = process.env.GITHUB_SHA;
const id = 1422954151;
const responses = new Map([
  ['', { id, full_name: 'hello-tako/Takolio', default_branch: 'main' }],
  ['/branches/main', { protected: true, commit: { sha } }],
  ['/branches/main/protection', { enforce_admins: { enabled: true }, required_pull_request_reviews: { required_approving_review_count: 1, dismiss_stale_reviews: true }, required_status_checks: { strict: true, contexts: ['validate-admin'] } }],
  ['/environments/admin-staging', { id: 123, can_admins_bypass: false, protection_rules: [{ type: 'required_reviewers', prevent_self_review: true, reviewers: [{ type: 'User' }] }], deployment_branch_policy: { protected_branches: true, custom_branch_policies: false } }],
  ['/actions/runs/42', { id: 42, run_attempt: 1, event: 'workflow_dispatch', head_sha: sha, head_branch: 'main', path: '.github/workflows/admin-staging-deploy.yml', actor: { id: 1, type: 'User' }, triggering_actor: { id: 1 }, repository: { id } }],
  ['/actions/workflows/admin-ci.yml/runs', { workflow_runs: [{ head_sha: sha, path: '.github/workflows/admin-ci.yml', status: 'completed', conclusion: 'success', event: 'push', repository: { id } }] }],
  ['/actions/runs/42/approvals', ${approved ? "[{ state: 'approved', user: { id: 2, type: 'User' }, environments: [{ id: 123 }] }]" : '[]'}],
  ['/actions/runs/42/artifacts', { artifacts: [] }],
]);
globalThis.fetch = async (input, init) => {
  const url = new URL(input);
  const route = url.pathname.slice('/repos/hello-tako/Takolio'.length);
  if (url.origin !== 'https://api.github.com' || !url.pathname.startsWith('/repos/hello-tako/Takolio') ||
      (init.method ?? 'GET') !== 'GET' || !responses.has(route)) throw new Error('Unexpected offline CLI request');
  return Response.json(responses.get(route));
};
`);
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } }).trim();
  git('init', '--quiet');
  git('add', '.');
  git('-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.test', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'offline CLI fixture');
  const sourceSha = git('rev-parse', 'HEAD');
  const migrationDigest = digest([{ name: '0001_fixture.sql', sha256: digest(readFileSync(path.join(directory, 'migrations-admin/0001_fixture.sql'))) }]);
  const now = Date.now();
  const manifest = { version: 1, id: 'synthetic-release-42', sourceSha, environment: 'staging', operation: 'initialize-disabled', runId: '42',
    policyDigest: digest(policy), migrationDigest, issuedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60000).toISOString(), payload: {} };
  const bundle = { manifest, approvals: [{ operatorId: 'synthetic-owner', signature: sign(null, Buffer.from(canonical(manifest)), privateKey).toString('base64url') }] };
  return { directory, sourceSha, bundle };
}

function authorize({ directory, sourceSha, bundle }) {
  return spawnSync(process.execPath, ['--import', path.join(directory, 'offline-fetch.mjs'), 'scripts/admin-release-adapter.mjs', 'authorize', 'staging', 'initialize-disabled'], {
    cwd: directory, encoding: 'utf8', timeout: 10000,
    env: { PATH: process.env.PATH, GITHUB_ACTIONS: 'true', ADMIN_RELEASE_EXECUTION_ENABLED: 'true', GITHUB_REF: 'refs/heads/main',
      GITHUB_SHA: sourceSha, GITHUB_WORKFLOW_SHA: sourceSha, GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1',
      GH_TOKEN: 'synthetic-offline-only', ADMIN_RELEASE_AUTHORIZATION: JSON.stringify(bundle) },
  });
}

describe('Admin release Node CLI authorization', () => {
  it('loads the provider and writes pre-action evidence with the real Node entrypoint', () => {
    const f = fixture();
    const result = authorize(f);
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    const audit = JSON.parse(readFileSync(path.join(f.directory, '.artifacts/admin-release/pre-action.json'), 'utf8'));
    expect(audit).toMatchObject({ sourceSha: f.sourceSha, runId: '42', environment: 'staging', operation: 'initialize-disabled' });
    expect(audit.authorizationDigest).toBe(digest(f.bundle));
    expect(JSON.parse(result.stdout)).toMatchObject({ phase: 'authorize', ...audit });
    expect(result.stdout).not.toContain('signature');
    expect(existsSync(path.join(f.directory, '.artifacts/admin-release/receipt.json'))).toBe(false);
  });

  it('still rejects missing independent approval before writing pre-action evidence', () => {
    const f = fixture(false);
    const result = authorize(f);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Independent environment approval required');
    expect(existsSync(path.join(f.directory, '.artifacts/admin-release/pre-action.json'))).toBe(false);
  });
});
