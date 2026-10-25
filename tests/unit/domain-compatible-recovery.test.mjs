import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareConfig } from '../../scripts/domain/prepare.mjs';
import { configHash } from '../../scripts/domain/release-config.mjs';
import { sanitizeRuntime } from '../../scripts/domain/audit-cloud.mjs';
import { addStagingEmail, hydrateStagingReceipt, serializeStagingReceipt } from '../../scripts/domain/staging-email-policy.mjs';
import {
  compatibleRecoveryPlan, compatibleRecoveryVersionId, compatibleRecoveryAction, verifyCompatibleRecoveryVersion,
} from '../../scripts/domain/compatible-recovery.mjs';

const fake = vi.hoisted(() => ({ files: new Map(), versions: new Map(), events: [], context: null, flags: null,
  active: null, failRecoveryUpload: false, alterRecoveryBuild: false, deploymentCount: 0, reactivationFailure: null }));
const sha = 'a'.repeat(40);
const candidateId = '22222222-2222-4222-8222-222222222222';
const recoveryId = '33333333-3333-4333-8333-333333333333';
const activationId = '44444444-4444-4444-8444-444444444444';
const rollbackId = '55555555-5555-4555-8555-555555555555';
const html = '<script type="module" src="/assets/recovery.js"></script>';
const moduleBytes = 'export const recovery = true;';
const digest = (value) => createHash('sha256').update(value).digest('hex');
const offBuild = () => ({ VITE_MEAL_PLANNER_ENABLED: 'false', VITE_MEAL_COMPOSITION_V2_ENABLED: 'false',
  assets: { html: { path: '/', bytes: Buffer.byteLength(html), sha256: digest(html) },
    modules: [{ path: '/assets/recovery.js', bytes: Buffer.byteLength(moduleBytes), sha256: digest(moduleBytes) }] } });

vi.mock('node:fs', async (original) => {
  const fs = await original();
  return { ...fs, mkdirSync: (file, ...args) => String(file).includes('/.artifacts/domain/') ? undefined : fs.mkdirSync(file, ...args),
    writeFileSync: (file, value, ...args) => String(file).includes('/.artifacts/domain/')
      ? fake.files.set(String(file), String(value)) : fs.writeFileSync(file, value, ...args),
    readFileSync: (file, ...args) => file === 'dist/composition-flags.json' ? JSON.stringify(fake.flags)
      : fake.files.has(String(file)) ? fake.files.get(String(file)) : fs.readFileSync(file, ...args) };
});
vi.mock('node:child_process', async (original) => ({ ...await original(), execFileSync: () => 'a'.repeat(40) }));
vi.mock('../../scripts/release-check.mjs', async (original) => ({ ...await original(),
  validateReleaseSource: vi.fn(), requireCurrentHostedMain: vi.fn(), hostedCi: async () => ({ headSha: 'a'.repeat(40) }),
  fetchRecipeAuthorityEvidence: async () => ({ commit: 'a'.repeat(40) }), verifyRecipeAuthorityEvidence: (manifest, proof) => {
    if (manifest.sha !== proof.commit) throw new Error('Wrong recovery authority');
    return proof;
  },
}));
vi.mock('../../scripts/wait-for-deployed-release.mjs', () => ({ waitForDeployedRelease: async (manifest) => ({ sha: manifest.sha }) }));
vi.mock('../../scripts/wait-for-service-worker-release.mjs', () => ({
  waitForServiceWorkerRelease: async (_origin, value) => ({ sha: value }), fetchServiceWorkerWithCurl: vi.fn(),
}));
vi.mock('../../scripts/domain/access-http.mjs', () => ({ stagingFetch: (...args) => fetch(...args), stagingCurlExecute: vi.fn() }));
vi.mock('../../scripts/family-meal-release.mjs', async (original) => ({ ...await original(), captureRecoveryBuild: (flags) => {
  const record = { ...offBuild(), ...flags };
  if (fake.alterRecoveryBuild) record.assets.html.sha256 = '0'.repeat(64);
  return record;
} }));
vi.mock('../../scripts/domain/audit-cloud.mjs', async (original) => {
  const actual = await original();
  return { ...actual, audit: async () => {
    const audit = structuredClone(fake.context.audit);
    if (fake.active?.versionId && fake.versions.has(fake.active.versionId)) {
      audit.worker = { name: audit.worker.name, ...actual.sanitizeRuntime(fake.versions.get(fake.active.versionId), {
        id: fake.active.deploymentId, strategy: 'percentage', versions: [{ version_id: fake.active.versionId, percentage: 100 }],
      }) };
    }
    return audit;
  }, cloudflareRead: async (path) => {
    if (path.endsWith('/deployments?per_page=100')) return [{ id: fake.active.deploymentId, strategy: 'percentage',
      versions: [{ version_id: fake.active.versionId, percentage: 100 }] }];
    if (path.includes('/deployments/')) return { id: fake.active.deploymentId, strategy: 'percentage',
      versions: [{ version_id: fake.active.versionId, percentage: 100 }] };
    if (path.includes('/versions/')) return fake.versions.get(path.split('/').at(-1));
    throw new Error(`Unexpected Cloudflare read: ${path}`);
  } };
});
vi.mock('../../scripts/cloudflare-deploy-retry.mjs', () => ({ capturedCommand: async (_command, args, options) => {
  if (args[0] === 'build') {
    fake.flags = { VITE_MEAL_PLANNER_ENABLED: options.env.VITE_MEAL_PLANNER_ENABLED,
      VITE_MEAL_COMPOSITION_V2_ENABLED: options.env.VITE_MEAL_COMPOSITION_V2_ENABLED };
    fake.events.push(`build:${fake.flags.VITE_MEAL_PLANNER_ENABLED}`);
  } else if (args.includes('upload')) {
    const recovery = args[args.indexOf('--config') + 1].endsWith('recovery-wrangler.json');
    fake.events.push(recovery ? 'upload:recovery' : 'upload:candidate');
    if (recovery && fake.failRecoveryUpload) return { exitCode: 1 };
    const id = recovery ? '33333333-3333-4333-8333-333333333333' : '22222222-2222-4222-8222-222222222222';
    const plan = recovery ? fake.context.compatibleRecovery.plan : fake.context.plan;
    fake.versions.set(id, versionFor(fake.context, plan, id));
    fake.files.set(options.env.WRANGLER_OUTPUT_FILE_PATH, JSON.stringify({ type: 'version-upload', version: 1,
      worker_name: plan.config.name, version_id: id }));
  } else if (args[0] !== 'scripts/composition-flags.mjs') throw new Error('Unexpected subprocess');
  return { exitCode: 0 };
} }));

const baseline = JSON.parse(readFileSync('docs/domain-integration/evidence/live-runtime.json', 'utf8'));
const { productionProvider, releaseProduction } = await import('../../scripts/domain/production-provider.mjs');
const { provider: stagingProvider } = await import('../../scripts/domain/staging-provider.mjs');
const { releaseStaging } = await import('../../scripts/domain/staging-release.mjs');

function context(environment = 'production') {
  const worker = structuredClone(baseline.workers[environment]);
  const plan = prepareConfig(environment, baseline, sha);
  plan.config.vars.STRICT_OTP_FAIL_CLOSED = 'true';
  plan.bytes = `${JSON.stringify(plan.config, null, 2)}\n`;
  plan.sha256 = configHash(plan.bytes);
  return { manifest: { repository: 'hello-tako/Takolio', environment, sha, mealCompositionV2Enabled: true }, plan, state: 'prepared', mutationAttempted: false,
    audit: { worker, operational: { consumers: [], workers_dev: environment === 'staging', crons: [] },
      ledger: { names: ['0044_inventory_command_category.sql', '0045_week_swap_receipts.sql'], version: '0045_week_swap_receipts.sql' },
      customDomains: [], dns: [], routes: [] } };
}
function ready(environment = 'production') {
  const c = context(environment);
  c.compatibleRecovery = { sha, versionId: recoveryId, plan: compatibleRecoveryPlan(c), build: offBuild() };
  c.compatibleRecovery.buildSha256 = configHash(JSON.stringify(c.compatibleRecovery.build));
  c.uploadedVersionId = candidateId;
  return c;
}
function versionFor(c, plan, id = recoveryId) {
  const previous = c.audit.worker;
  return { id, resources: { bindings: [...structuredClone(plan.expectedTypedBindings ?? previous.typedBindings),
    ...Object.entries(plan.config.vars).map(([name, text]) => ({ name, type: 'plain_text', text })),
    ...previous.secretNames.map((name) => ({ name, type: 'secret_text' }))],
    script_runtime: { ...structuredClone(previous.runtime), assets: { ...structuredClone(previous.runtime.assets), raw_run_worker_first: true } } } };
}

beforeEach(() => {
  fake.files.clear(); fake.versions.clear(); fake.events.length = 0;
  fake.failRecoveryUpload = false; fake.alterRecoveryBuild = false; fake.deploymentCount = 0; fake.reactivationFailure = null;
  for (const [key, value] of Object.entries({ GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'hello-tako/Takolio',
    GITHUB_REPOSITORY_ID: '1422954151', GITHUB_SHA: sha, GITHUB_WORKFLOW_SHA: sha, GITHUB_EVENT_NAME: 'workflow_dispatch',
    CLOUDFLARE_ACCOUNT_ID: 'ef250a88911fd24073cb73d1c07e0218', CONFIRM_STAGING: 'true', CONFIRM_PRODUCTION: 'true',
    CONFIRM_STAGING_ACCEPTANCE: 'true', GH_TOKEN: 'test', CLOUDFLARE_API_TOKEN: 'test', RELEASE_VERIFY_TOKEN: 'test'.repeat(8) })) vi.stubEnv(key, value);
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (String(url).startsWith('https://api.github.com/')) return Response.json({ workflow_runs: [{ id: 1, run_attempt: 1,
      head_sha: sha, head_branch: 'main', event: 'push', path: '.github/workflows/admin-ci.yml',
      repository: { full_name: 'hello-tako/Takolio' }, head_repository: { full_name: 'hello-tako/Takolio' }, status: 'completed', conclusion: 'success' }] });
    if (String(url).startsWith('https://api.cloudflare.com/')) {
      const body = JSON.parse(options.body);
      const reactivating = body.versions[0].version_id === candidateId && fake.reactivationFailure;
      if (reactivating === 'before') throw new Error('Connection lost before activation');
      const deploymentId = `${String(++fake.deploymentCount + 4).padStart(8, '0')}-5555-4555-8555-555555555555`;
      fake.active = { versionId: body.versions[0].version_id, deploymentId };
      fake.events.push(`deploy:${fake.active.versionId}`);
      if (reactivating === 'after') throw new Error('Connection lost after activation');
      return Response.json({ success: true, result: { id: deploymentId, ...body } });
    }
    const root = new URL(url).pathname === '/';
    return new Response(root ? html : moduleBytes, { headers: { 'Content-Type': root ? 'text/html' : 'text/javascript' } });
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe.each(['staging', 'production'])('%s exact-source recovery', (environment) => {
  it('changes only the paired server/UI flags, preserving security, bindings, catalog and operations', () => {
    const c = context(environment), before = structuredClone(c);
    const plan = compatibleRecoveryPlan(c), expected = structuredClone(c.plan);
    expected.config.vars.MEAL_PLANNER_ENABLED = 'false'; expected.config.vars.MEAL_COMPOSITION_V2_ENABLED = 'false';
    expected.buildEnvironment.VITE_MEAL_PLANNER_ENABLED = 'false'; expected.buildEnvironment.VITE_MEAL_COMPOSITION_V2_ENABLED = 'false';
    expected.bytes = `${JSON.stringify(expected.config, null, 2)}\n`; expected.sha256 = configHash(expected.bytes);
    expect(plan).toEqual(expected); expect(c).toEqual(before);
    expect(plan.config.vars.STRICT_OTP_FAIL_CLOSED).toBe('true');
  });

  it('rejects changed source, configuration, version identity, UI flags and asset commitments', () => {
    for (const alter of [
      c => { c.manifest.sha = 'b'.repeat(40); }, c => { c.plan.bytes += ' '; }, c => { c.plan.config.vars.GIT_COMMIT = 'b'.repeat(40); },
      c => { c.plan.buildEnvironment.GIT_COMMIT = 'b'.repeat(40); }, c => { c.audit.worker.name = 'other'; },
      c => { c.compatibleRecovery.sha = 'b'.repeat(40); }, c => { c.compatibleRecovery.versionId = '../../settings'; },
      c => { c.compatibleRecovery.versionId = c.audit.worker.versionId; }, c => { c.compatibleRecovery.versionId = candidateId; },
      c => { c.compatibleRecovery.plan.config.vars.STRICT_OTP_FAIL_CLOSED = 'false'; },
      c => { c.compatibleRecovery.build.assets.html.bytes += 1; },
      c => { c.compatibleRecovery.build.VITE_MEAL_PLANNER_ENABLED = 'true'; c.compatibleRecovery.buildSha256 = configHash(JSON.stringify(c.compatibleRecovery.build)); },
      c => { c.compatibleRecovery.build.assets.modules = []; c.compatibleRecovery.buildSha256 = configHash(JSON.stringify(c.compatibleRecovery.build)); },
    ]) { const c = ready(environment); alter(c); expect(() => compatibleRecoveryVersionId(c)).toThrow(); }
  });

  it('verifies full uploaded metadata, including strict OTP and D1, before accepting the recovery ID', () => {
    const c = ready(environment), version = versionFor(c, c.compatibleRecovery.plan);
    expect(verifyCompatibleRecoveryVersion(c, version)).toBe(recoveryId);
    for (const alter of [
      v => { v.id = candidateId; }, v => { v.resources.bindings.find(b => b.name === 'DB').database_id = 'wrong'; },
      v => { v.resources.bindings.find(b => b.name === 'STRICT_OTP_FAIL_CLOSED').text = 'false'; },
      v => { v.resources.bindings = v.resources.bindings.filter(b => b.name !== 'JWT_SECRET'); },
      v => { v.resources.script_runtime.assets.raw_run_worker_first = false; },
    ]) { const changed = structuredClone(version); alter(changed); expect(() => verifyCompatibleRecoveryVersion(c, changed)).toThrow(); }
    expect(sanitizeRuntime(version, { id: rollbackId, versions: [{ version_id: recoveryId, percentage: 100 }] }).vars.MEAL_PLANNER_ENABLED).toBe('false');
  });

  it('reconciles interrupted activation only for owned candidate traffic; never selects the old binary', () => {
    const c = ready(environment); c.state = 'activation-intent';
    expect(compatibleRecoveryAction(c, { versionId: candidateId, deploymentId: activationId })).toBe('restore');
    for (const active of [{ versionId: c.audit.worker.versionId, deploymentId: activationId },
      { versionId: 'foreign', deploymentId: activationId }, { versionId: candidateId, deploymentId: 'invalid' }]) {
      expect(() => compatibleRecoveryAction(c, active)).toThrow('ownership');
    }
    c.activeDeploymentId = activationId;
    expect(() => compatibleRecoveryAction(c, { versionId: candidateId, deploymentId: rollbackId })).toThrow('ownership');
    c.state = 'rollback-intent';
    expect(() => compatibleRecoveryAction(c, { versionId: candidateId, deploymentId: activationId })).toThrow('uncertain');
    c.hosts = { state: 'detached', created: [] };
    expect(compatibleRecoveryAction(c, { versionId: recoveryId, deploymentId: rollbackId })).toBe('verify-recovery');
    c.rollbackDeploymentId = activationId;
    expect(() => compatibleRecoveryAction(c, { versionId: recoveryId, deploymentId: rollbackId })).toThrow('ownership');
    c.rollbackDeploymentId = rollbackId; c.hosts.state = 'attached';
    expect(() => compatibleRecoveryAction(c, { versionId: recoveryId, deploymentId: rollbackId })).toThrow('ownership');
  });

  it('prepares inactive OFF recovery, rebuilds the normal ON candidate, then recovers with exact OFF served bytes', async () => {
    const c = context(environment); fake.context = c; fake.active = { versionId: c.audit.worker.versionId, deploymentId: c.audit.worker.deploymentId };
    const provider = environment === 'production' ? productionProvider : stagingProvider;
    fake.files.set(`${process.cwd()}/.artifacts/domain/${environment}-release/wrangler.json`, c.plan.bytes);
    await provider.prepareRecovery(c);
    expect(fake.events).toEqual(['build:false', 'upload:recovery']);
    expect(fake.active.versionId).toBe(c.audit.worker.versionId);
    expect(compatibleRecoveryVersionId(c)).toBe(recoveryId);
    await provider.build(c); await provider.upload(c);
    expect(fake.events).toEqual(['build:false', 'upload:recovery', 'build:true', 'upload:candidate']);
    c.mutationAttempted = true; c.state = 'activation-intent';
    fake.active = { versionId: candidateId, deploymentId: activationId };
    await provider.recover(c);
    expect(fake.events.at(-1)).toBe(`deploy:${recoveryId}`);
    expect(c.state).toBe('rolled-back');
    expect(c.recovery.state).toBe('compatible-version-restored');
    expect(c.recovery.compiledAssets.result).toBe('exact-flags-off-assets');
    const mutations = fake.events.filter(event => event.startsWith('deploy:'));
    await provider.recover(c);
    expect(fake.events.filter(event => event.startsWith('deploy:'))).toEqual(mutations);
  });

  it('does not build/upload/activate the normal candidate if preparing inactive recovery fails', async () => {
    const c = context(environment); fake.context = c; fake.active = { versionId: c.audit.worker.versionId, deploymentId: c.audit.worker.deploymentId };
    fake.failRecoveryUpload = true;
    const provider = environment === 'production' ? productionProvider : stagingProvider;
    const release = environment === 'production' ? releaseProduction : releaseStaging;
    await expect(release({ ...provider, prepare: async () => c })).rejects.toThrow();
    expect(fake.events).toEqual(['build:false', 'upload:recovery']);
    expect(c.mutationAttempted).toBe(false);
    expect(c.recovery).toBe('No traffic or hostname mutation attempted');
  });
});

it('round trips private restricted email recovery without widening bindings or losing commitments', () => {
  const c = context('staging');
  addStagingEmail(c.plan, c.audit.worker, 'approved-inbox@example.test');
  c.plan.bytes = `${JSON.stringify(c.plan.config, null, 2)}\n`; c.plan.sha256 = configHash(c.plan.bytes);
  c.compatibleRecovery = { sha, versionId: recoveryId, plan: compatibleRecoveryPlan(c), build: offBuild() };
  c.compatibleRecovery.buildSha256 = configHash(JSON.stringify(c.compatibleRecovery.build));
  const text = serializeStagingReceipt(c, 'approved-inbox@example.test');
  expect(text).not.toContain('approved-inbox@example.test');
  const restored = hydrateStagingReceipt(text, 'approved-inbox@example.test');
  expect(verifyCompatibleRecoveryVersion(restored, versionFor(restored, restored.compatibleRecovery.plan))).toBe(recoveryId);
  expect(restored.compatibleRecovery.plan.config.send_email).toEqual([{ name: 'SEND_EMAIL', destination_address: 'approved-inbox@example.test' }]);
});

it('staging rehearses the real recovery path before restoring the same candidate and proving hosts again', async () => {
  const c = context('staging'); fake.context = c;
  fake.active = { versionId: c.audit.worker.versionId, deploymentId: c.audit.worker.deploymentId };
  fake.files.set(`${process.cwd()}/.artifacts/domain/staging-release/wrangler.json`, c.plan.bytes);
  await stagingProvider.prepareRecovery(c);
  await stagingProvider.build(c); await stagingProvider.upload(c);
  c.mutationAttempted = true; c.state = 'hosts-attached'; c.activeDeploymentId = activationId;
  fake.active = { versionId: candidateId, deploymentId: activationId };
  const calls = [];
  const provider = { ...stagingProvider,
    proveLegacy: async () => { calls.push('legacy'); }, attach: async () => { calls.push('attach'); },
    proveHosts: async () => { calls.push('hosts'); } };
  await provider.rehearseRecovery(c);
  expect(fake.events.filter(event => event.startsWith('deploy:'))).toEqual([`deploy:${recoveryId}`, `deploy:${candidateId}`]);
  expect(c.rollbackRehearsal).toMatchObject({ result: 'PASS', sha, candidateVersionId: candidateId,
    recovery: { state: 'compatible-version-restored', compiledAssets: { result: 'exact-flags-off-assets' } } });
  expect(fake.active.versionId).toBe(candidateId);
  expect(calls).toEqual(['legacy', 'attach', 'hosts']);
});

it('staging leaves verified recovery active when the post-rollback audit drifts', async () => {
  const c = ready('staging'); fake.context = c;
  fake.versions.set(recoveryId, versionFor(c, c.compatibleRecovery.plan));
  fake.versions.set(candidateId, versionFor(c, c.plan, candidateId));
  c.mutationAttempted = true; c.state = 'hosts-attached'; c.activeDeploymentId = activationId;
  fake.active = { versionId: candidateId, deploymentId: activationId };
  const provider = { ...stagingProvider, recover: async value => {
    const restored = await stagingProvider.recover(value);
    restored.ledger.names.push('unknown');
    return restored;
  } };
  await expect(provider.rehearseRecovery(c)).rejects.toThrow('ledger drift');
  expect(fake.events.filter(event => event.startsWith('deploy:'))).toEqual([`deploy:${recoveryId}`]);
  expect(fake.active.versionId).toBe(recoveryId);
  expect(c.rollbackRehearsal.result).toBeUndefined();
});

it.each(['before', 'after'])('reconciles lost staging reactivation response %s traffic changes', async (failure) => {
  const c = ready('staging'); fake.context = c;
  fake.versions.set(recoveryId, versionFor(c, c.compatibleRecovery.plan));
  fake.versions.set(candidateId, versionFor(c, c.plan, candidateId));
  c.mutationAttempted = true; c.state = 'hosts-attached'; c.activeDeploymentId = activationId;
  fake.active = { versionId: candidateId, deploymentId: activationId };
  fake.reactivationFailure = failure;
  await expect(stagingProvider.rehearseRecovery(c)).rejects.toThrow('outcome is uncertain');
  expect(c.state).toBe('reactivation-intent');
  expect(c.activeDeploymentId).toBeUndefined();
  expect(fake.active.versionId).toBe(failure === 'before' ? recoveryId : candidateId);
  expect(c.rollbackRehearsal.result).toBeUndefined();
  await stagingProvider.recover(c);
  expect(fake.active.versionId).toBe(recoveryId);
  expect(c.state).toBe('rolled-back');
  expect(c.recovery.compiledAssets.result).toBe('exact-flags-off-assets');
  expect(fake.events.filter(event => event.startsWith('deploy:'))).toHaveLength(failure === 'before' ? 1 : 3);
});

