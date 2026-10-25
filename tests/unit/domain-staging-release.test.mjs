import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { unchangedAudit, verifyUploadedVersion, releaseStaging } from '../../scripts/domain/staging-release.mjs';
import { provider } from '../../scripts/domain/staging-provider.mjs';

const baseline = JSON.parse(readFileSync('docs/domain-integration/evidence/live-runtime.json', 'utf8')).workers.staging;
function candidate() {
  const vars = { ...baseline.vars, APP_URL: 'https://staging.takolio.app', PUBLIC_DOMAIN_ROUTING: 'true', GIT_COMMIT: 'a'.repeat(40) };
  const config = { vars, compatibility_date: baseline.runtime.compatibility_date,
    compatibility_flags: baseline.runtime.compatibility_flags,
    assets: { html_handling: baseline.runtime.assets.html_handling, not_found_handling: baseline.runtime.assets.not_found_handling } };
  const version = { id: '22222222-2222-4222-8222-222222222222', resources: {
    bindings: [...structuredClone(baseline.typedBindings),
      ...Object.entries(vars).map(([name, text]) => ({ name, text, type: 'plain_text' })),
      ...baseline.secretNames.map((name) => ({ name, type: 'secret_text' }))],
    script_runtime: { ...structuredClone(baseline.runtime), assets: {
      ...structuredClone(baseline.runtime.assets), raw_run_worker_first: true } },
  } };
  return { version, plan: { config }, previous: structuredClone(baseline) };
}

describe('staging domain release fences', () => {
  it('certifies every public variable, typed binding, secret name and asset runtime before traffic', () => {
    const fixture = candidate();
    expect(verifyUploadedVersion(fixture.version, fixture.plan, fixture.previous)).toBe(fixture.version.id);
    for (const alter of [
      (f) => { f.version.resources.bindings.find((b) => b.name === 'DB').database_id = 'production-database'; },
      (f) => { f.version.resources.bindings.find((b) => b.name === 'JWT_SECRET').text = 'unexpected-secret-value'; },
      (f) => { f.version.resources.bindings = f.version.resources.bindings.filter((b) => b.name !== 'JWT_SECRET'); },
      (f) => { f.version.resources.bindings.find((b) => b.name === 'MEAL_PLANNER_ENABLED').text = 'false'; },
      (f) => { f.version.resources.script_runtime.assets.raw_run_worker_first = false; },
      (f) => { f.version.resources.script_runtime.compatibility_date = '2026-10-17'; },
      (f) => { f.version.resources.script_runtime.usage_model = 'different'; },
      (f) => { f.version.id = f.previous.versionId; },
    ]) {
      const changed = candidate(); alter(changed);
      expect(() => verifyUploadedVersion(changed.version, changed.plan, changed.previous)).toThrow();
    }
  });

  it('allows fresh ledger observation times while rejecting runtime and ledger drift', () => {
    const before = { worker: baseline, operational: { workers_dev: true }, customDomains: [], dns: [], routes: [],
      ledger: { version: '0043_final.sql', names: ['0043_final.sql'], checkedAt: 'earlier' } };
    const after = structuredClone(before); after.ledger.checkedAt = 'later';
    expect(() => unchangedAudit(before, after)).not.toThrow();
    after.ledger.names.push('0044_unknown.sql');
    expect(() => unchangedAudit(before, after)).toThrow('ledger drift');
    const changed = structuredClone(before); changed.operational.workers_dev = false;
    expect(() => unchangedAudit(before, changed)).toThrow('operational');
  });

  it('recovers a failed hostname proof without claiming a completed release', async () => {
    const context = { uploadedVersionId: 'owned-version' };
    const events = [];
    const fake = { prepare: async () => context };
    for (const step of ['prepareRecovery', 'build', 'upload', 'activate', 'proveLegacy', 'attach', 'finish', 'recover']) {
      fake[step] = vi.fn(async (value) => { expect(value).toBe(context); events.push(step); });
    }
    fake.proveHosts = async () => { events.push('proveHosts'); throw new Error('TLS failed'); };
    await expect(releaseStaging(fake)).rejects.toThrow('TLS failed');
    expect(events).toEqual(['prepareRecovery', 'build', 'upload', 'activate', 'proveLegacy', 'attach', 'proveHosts', 'recover']);
    expect(fake.finish).not.toHaveBeenCalled();
  });

  it('stops before upload, traffic and host operations when build fails', async () => {
    const fake = { prepare: async () => ({}), prepareRecovery: vi.fn(), build: async () => { throw new Error('build failed'); },
      upload: vi.fn(), activate: vi.fn(), attach: vi.fn(), recover: vi.fn() };
    await expect(releaseStaging(fake)).rejects.toThrow('build failed');
    expect(fake.upload).not.toHaveBeenCalled();
    expect(fake.activate).not.toHaveBeenCalled();
    expect(fake.attach).not.toHaveBeenCalled();
    expect(fake.recover).toHaveBeenCalledOnce();
  });

  it('rejects local or unapproved execution before reading any infrastructure', async () => {
    await expect(provider.prepare()).rejects.toThrow('Protected canonical staging release context required');
  });
});

it('uses trusted main and verifies the requested/workflow SHA before dependency installation', () => {
  const workflow = readFileSync('.github/workflows/domain-staging-release.yml', 'utf8');
  expect(workflow).toContain('ref: main');
  expect(workflow).not.toContain('ref: ${{ inputs.ref }}');
  expect(workflow.indexOf('test "$GITHUB_SHA" = "$RELEASE_SHA"')).toBeLessThan(workflow.indexOf('pnpm install --frozen-lockfile'));
  expect(workflow).toContain('environment: staging');
  expect(workflow).not.toContain('environment: production');
  expect(workflow).toContain('group: frigo-deploy-staging');
});

it('rejects a recovery receipt for production or another workflow source', async () => {
  const { validateRecoveryContext } = await import('../../scripts/domain/staging-release.mjs');
  const context = { manifest: { repository: 'hello-tako/Takolio', environment: 'staging', sha: 'a'.repeat(40) },
    audit: { worker: { name: 'frigo-staging' } }, plan: { config: { name: 'frigo-staging' } } };
  const env = { GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'hello-tako/Takolio', GITHUB_REPOSITORY_ID: '1422954151',
    CLOUDFLARE_ACCOUNT_ID: 'ef250a88911fd24073cb73d1c07e0218', GITHUB_SHA: context.manifest.sha, GITHUB_WORKFLOW_SHA: context.manifest.sha };
  expect(() => validateRecoveryContext(context, env)).not.toThrow();
  for (const alter of [
    (c) => { c.manifest.environment = 'production'; },
    (c) => { c.audit.worker.name = 'frigo'; },
    (c) => { c.hosts = { environment: 'production' }; },
  ]) {
    const changed = structuredClone(context); alter(changed);
    expect(() => validateRecoveryContext(changed, env)).toThrow('canonical staging');
  }
  expect(() => validateRecoveryContext(context, { ...env, GITHUB_SHA: 'b'.repeat(40) })).toThrow('canonical staging');
});
