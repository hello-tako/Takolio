import { mutationResponse } from './mutation-response.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { confirmDeploymentMutation } from './deployments.mjs';
import { ACCOUNT, ZONE, REPOSITORY, REPOSITORY_ID, audit, cloudflareRead, sanitizeRuntime } from './audit-cloud.mjs';
import { prepareReleaseConfig, configHash } from './release-config.mjs';
import { privateDomainReceipt, restorePrivateDomains, hasPrivateDomains } from './receipt-privacy.mjs';
import { planHosts, attachHosts, detachCreatedHosts, validateDomains } from './hosts.mjs';
import { unchangedAudit, verifyUploadedVersion } from './staging-release.mjs';
import { compatibleRecoveryPlan, compatibleRecoveryVersionId, verifyCompatibleRecoveryVersion, compatibleRecoveryAction } from './compatible-recovery.mjs';
import { captureRecoveryBuild, verifyServedRecoveryAssets } from '../family-meal-release.mjs';
import { verifyEvidenceRun, verifyStagingAcceptance, verifyProductionCertification,
  isProductionMutation, validateProductionRecovery, observeProduction, productionUploadVersion, productionRecoveryIdentity } from './production-release.mjs';
import { capturedCommand } from '../cloudflare-deploy-retry.mjs';
import { verifyCompositionRelease, verifyPlannerPrerequisite } from '../composition-flags.mjs';
import { validateReleaseSource, migrationManifest, hostedCi, requireCurrentHostedMain,
  fetchRecipeAuthorityEvidence, verifyPreviousRecipeAuthority, verifyRecipeAuthorityEvidence,
  verifyD1CatalogContinuity, CATALOG_RELEASE_MANIFEST_PATH, verifyStableWorkerDeployment } from '../release-check.mjs';
import { waitForDeployedRelease } from '../wait-for-deployed-release.mjs';
import { waitForServiceWorkerRelease } from '../wait-for-service-worker-release.mjs';
import profiles from '../../config/domain-profiles.json' with { type: 'json' };

const env = process.env;
const base = `/accounts/${ACCOUNT}`;
const script = `${base}/workers/scripts/frigo`;
const output = resolve('.artifacts/domain/production-release');
const configFile = resolve(output, 'wrangler.json');
const uploadFile = resolve(output, 'upload.jsonl');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const credentialNames = ['GH_TOKEN', 'CLOUDFLARE_API_TOKEN', 'RELEASE_VERIFY_TOKEN'];
function redact(text) {
  for (const name of credentialNames) if (env[name]) text = text.replaceAll(env[name], '[redacted]');
  return text;
}
const persist = (context) => writeFileSync(resolve(output, 'receipt.json'), redact(`${JSON.stringify(privateDomainReceipt(context), null, 2)}\n`));
const read = (path, sql) => cloudflareRead(path, env.CLOUDFLARE_API_TOKEN, { sql });
const baseline = () => readJson('docs/domain-integration/evidence/live-runtime.json');
const capture = (schema) => audit('production', { read, schema, baseline: baseline() });
const domainList = async () => validateDomains(await read(`${base}/workers/domains?per_page=100`));
const inventory = async () => ({ dns: await read(`/zones/${ZONE}/dns_records?per_page=100`), routes: await read(`/zones/${ZONE}/workers/routes`) });

async function github(path) {
  if (!path.startsWith(`/repos/${REPOSITORY}/actions/`)) throw new Error('Unapproved release evidence target');
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
    redirect: 'error', signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Release evidence lookup failed: HTTP ${response.status}`);
  return response.json();
}

async function run(command, args, extraEnv = {}) {
  const result = await capturedCommand(command, args, { timeoutMs: 600000,
    env: { ...env, ...extraEnv, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG: 'error' } });
  if (result.exitCode !== 0 || result.incomplete || result.signal) throw new Error('Production preparation/upload command failed; output withheld');
}

async function gate(sha) {
  if (env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_REPOSITORY !== REPOSITORY ||
      env.GITHUB_REPOSITORY_ID !== REPOSITORY_ID || env.GITHUB_SHA !== sha || env.GITHUB_WORKFLOW_SHA !== sha ||
      env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.CONFIRM_PRODUCTION !== 'true' ||
      env.CONFIRM_STAGING_ACCEPTANCE !== 'true' || env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT ||
      !env.CLOUDFLARE_API_TOKEN || !env.GH_TOKEN || !env.RELEASE_VERIFY_TOKEN || env.RELEASE_VERIFY_TOKEN.length < 32) {
    throw new Error('Protected canonical production release context and explicit acceptance required');
  }
  if (execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== sha) throw new Error('Production checkout changed');
  validateReleaseSource({ ref: sha, hardenedSha: env.HARDENED_SHA });
  await requireCurrentHostedMain({ sha, repository: REPOSITORY });
  const ci = await hostedCi(sha, REPOSITORY);
  const query = new URLSearchParams({ event: 'push', branch: 'main', head_sha: sha, per_page: '100' });
  const response = await github(`/repos/${REPOSITORY}/actions/workflows/admin-ci.yml/runs?${query}`);
  const admin = response.workflow_runs.filter((entry) => entry.head_sha === sha && entry.head_branch === 'main' &&
    entry.event === 'push' && entry.path === '.github/workflows/admin-ci.yml' &&
    entry.repository?.full_name === REPOSITORY && entry.head_repository?.full_name === REPOSITORY)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || b.id - a.id || b.run_attempt - a.run_attempt)[0];
  if (!admin || admin.status !== 'completed' || admin.conclusion !== 'success') throw new Error('Latest exact-main Admin CI must pass');
  return { ci, adminCi: { id: admin.id, attempt: admin.run_attempt, headSha: sha, url: admin.html_url } };
}

async function evidence(idText, sha, workflow, prefix, file) {
  if (!/^[1-9][0-9]*$/.test(idText ?? '') || !Number.isSafeInteger(Number(idText))) throw new Error('Canonical evidence run ID required');
  const id = Number(idText);
  const runInfo = await github(`/repos/${REPOSITORY}/actions/runs/${id}`);
  const proof = verifyEvidenceRun(runInfo, { id, sha, path: `.github/workflows/${workflow}` });
  const result = await github(`/repos/${REPOSITORY}/actions/runs/${id}/artifacts?per_page=100`);
  const name = `${prefix}-${id}-${proof.attempt}`;
  if (!Array.isArray(result.artifacts) || result.total_count !== result.artifacts.length) throw new Error('Incomplete evidence artifact inventory');
  const matches = result.artifacts.filter((artifact) => artifact.name === name && artifact.expired === false);
  if (matches.length !== 1) throw new Error('Unique current-attempt evidence artifact required');
  const directory = resolve(output, `evidence-${id}`);
  await run('gh', ['run', 'download', String(id), '--repo', REPOSITORY, '--name', name, '--dir', directory]);
  return { proof: { ...proof, artifactId: matches[0].id, artifactDigest: matches[0].digest }, receipt: readJson(resolve(directory, file)) };
}

async function mutate(path, method, body) {
  if (!isProductionMutation(path, method)) throw new Error('Unapproved production mutation');
  let response;
  try {
    response = await fetch(`https://api.cloudflare.com/client/v4${path}`, { method,
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(30000) });
  } catch { throw new Error('Production mutation outcome is uncertain; reconcile the retained receipt'); }
  return mutationResponse(response, { environment: 'production', method });
}

async function currentDeployment() {
  const result = await read(`${script}/deployments?per_page=100`);
  const entries = Array.isArray(result) ? result : result.deployments;
  return verifyStableWorkerDeployment([...entries].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0]);
}
const authority = (origin) => fetchRecipeAuthorityEvidence(origin, env.RELEASE_VERIFY_TOKEN);
async function prove(origin, context) {
  const deployed = await waitForDeployedRelease(context.manifest, { url: origin, verifyAssets: true });
  const assets = await waitForServiceWorkerRelease(origin, context.manifest.sha);
  const recipeAuthority = verifyRecipeAuthorityEvidence(context.manifest, await authority(origin), readJson(CATALOG_RELEASE_MANIFEST_PATH));
  return { deployed, assets, recipeAuthority };
}
async function fenced(context) {
  await gate(context.manifest.sha);
  const active = await currentDeployment();
  if (active.versionId !== context.uploadedVersionId || active.deploymentId !== context.activeDeploymentId) throw new Error('Production traffic ownership changed');
  verifyUploadedVersion(await read(`${script}/versions/${active.versionId}`), context.plan, context.audit.worker);
  const current = await capture(context.manifest.schema);
  if (!isDeepStrictEqual(current.operational, context.audit.operational)) throw new Error('Production operational settings changed');
}
async function verifyRestored(context, mutation) {
  const versionId = compatibleRecoveryVersionId(context);
  const version = await read(`${script}/versions/${versionId}`);
  verifyCompatibleRecoveryVersion(context, version);
  const restored = await capture(context.manifest.schema);
  const expected = structuredClone(context.audit);
  expected.worker = { name: context.audit.worker.name, ...sanitizeRuntime(version, {
    id: mutation.deploymentId, strategy: 'percentage', versions: [{ version_id: versionId, percentage: 100 }],
  }) };
  unchangedAudit(expected, restored);
  const proof = await prove(profiles.production.legacy, context);
  const compiledAssets = await verifyServedRecoveryAssets(context.compatibleRecovery.build, { url: profiles.production.legacy });
  unchangedAudit(restored, await capture(context.manifest.schema));
  context.recovery = { state: 'compatible-version-restored', ...mutation, proof, compiledAssets };
  context.state = 'rolled-back'; persist(context);
}

export const productionProvider = {
  async prepare() {
    const sha = env.RELEASE_SHA;
    const checks = await gate(sha);
    mkdirSync(output, { recursive: true });
    const staging = await evidence(env.STAGING_RUN_ID, sha, 'domain-staging-release.yml', 'domain-staging-release', 'receipt.json');
    let acceptance;
    try { acceptance = JSON.parse(env.STAGING_ACCEPTANCE_JSON); } catch { throw new Error('Structured public staging acceptance required'); }
    acceptance = verifyStagingAcceptance(acceptance, staging.receipt, { sha, runId: staging.proof.id });
    const certification = await evidence(env.CERTIFICATION_RUN_ID, sha, 'production-certify.yml', 'production-certification', 'release-manifest.json');
    const certified = verifyProductionCertification(certification.receipt, sha);
    const schema = migrationManifest(process.cwd(), sha);
    const snapshot = await capture(schema);
    if (snapshot.worker.versionId !== certified.versionId || snapshot.worker.vars.GIT_COMMIT !== certified.deployedSha) throw new Error('Production moved since read-only certification');
    const vars = snapshot.worker.vars;
    const manifest = { ...productionRecoveryIdentity(certification.receipt, snapshot),
      repository: REPOSITORY, sha, environment: 'production', hardenedSha: env.HARDENED_SHA, schema,
      mealCompositionV2Enabled: vars.MEAL_COMPOSITION_V2_ENABLED === 'true', recipeCatalogMode: vars.RECIPE_CATALOG_MODE,
      recipeCatalogCanaryPercent: Number(vars.RECIPE_CATALOG_D1_CANARY_PERCENT), recipeCatalogCutoverEnabled: vars.RECIPE_CATALOG_CUTOVER_ENABLED === 'true' };
    const plan = prepareReleaseConfig({ manifest, receipt: { repository: REPOSITORY, repositoryId: REPOSITORY_ID, sha, ...checks, ...snapshot }, baseline: baseline() });
    planHosts({ environment: 'production', sha, versionId: snapshot.worker.versionId, domains: await domainList(), ...await inventory() });
    const previous = await authority(profiles.production.legacy);
    manifest.previousRecipeAuthorityProof = verifyPreviousRecipeAuthority(manifest, previous, { cwd: process.cwd() });
    manifest.previousRecipeAuthority = previous;
    if (manifest.recipeCatalogMode === 'd1') {
      manifest.authorityContinuity = verifyD1CatalogContinuity(manifest, previous, readJson(CATALOG_RELEASE_MANIFEST_PATH), await read(`${script}/versions/${snapshot.worker.versionId}`));
    }
    const context = { manifest, audit: snapshot, checks, plan, acceptance, stagingEvidence: staging.proof,
      certificationEvidence: certification.proof, state: 'prepared', mutationAttempted: false };
    writeFileSync(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(configFile, plan.bytes); writeFileSync(uploadFile, ''); persist(context);
    return context;
  },
  async prepareRecovery(context) {
    await gate(context.manifest.sha);
    unchangedAudit(context.audit, await capture(context.manifest.schema));
    const plan = compatibleRecoveryPlan(context);
    await run('pnpm', ['build'], plan.buildEnvironment);
    const build = captureRecoveryBuild(readJson('dist/composition-flags.json'), 'dist/client', { appOrigin: profiles.production.app });
    context.compatibleRecovery = { sha: context.manifest.sha, plan, build, buildSha256: configHash(JSON.stringify(build)) };
    const recoveryConfig = resolve(output, 'recovery-wrangler.json');
    const recoveryUpload = resolve(output, 'recovery-upload.jsonl');
    writeFileSync(recoveryConfig, plan.bytes); writeFileSync(recoveryUpload, '');
    context.state = 'recovery-upload-intent'; persist(context);
    await gate(context.manifest.sha);
    unchangedAudit(context.audit, await capture(context.manifest.schema));
    if (configHash(readFileSync(recoveryConfig)) !== plan.sha256 ||
        !isDeepStrictEqual(captureRecoveryBuild(readJson('dist/composition-flags.json'), 'dist/client', { appOrigin: profiles.production.app }), build)) {
      throw new Error('Compatible recovery config or compiled assets changed before upload');
    }
    await run('pnpm', ['exec', 'wrangler', 'versions', 'upload', '--config', recoveryConfig, '--strict'], { WRANGLER_OUTPUT_FILE_PATH: recoveryUpload });
    const records = readFileSync(recoveryUpload, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    context.compatibleRecovery.versionId = productionUploadVersion(records);
    verifyCompatibleRecoveryVersion(context, await read(`${script}/versions/${context.compatibleRecovery.versionId}`));
    unchangedAudit(context.audit, await capture(context.manifest.schema));
    context.state = 'recovery-prepared'; persist(context);
  },
  async build(context) {
    await run('pnpm', ['build'], context.plan.buildEnvironment);
    const vars = context.plan.config.vars;
    if (context.manifest.environment !== 'production' || vars.ENVIRONMENT !== 'production') {
      throw new Error('Production build requires the audited production configuration');
    }
    const buildRecord = readJson('dist/composition-flags.json');
    const composition = verifyCompositionRelease({ server: vars.MEAL_COMPOSITION_V2_ENABLED,
      ui: context.plan.buildEnvironment.VITE_MEAL_COMPOSITION_V2_ENABLED,
      manifest: context.manifest, buildRecord });
    verifyPlannerPrerequisite({ composition, server: vars.MEAL_PLANNER_ENABLED, buildRecord });
  },
  async upload(context) {
    await gate(context.manifest.sha);
    const recoveryId = compatibleRecoveryVersionId(context);
    verifyCompatibleRecoveryVersion(context, await read(`${script}/versions/${recoveryId}`));
    unchangedAudit(context.audit, await capture(context.manifest.schema));
    if (configHash(readFileSync(configFile)) !== context.plan.sha256) throw new Error('Production candidate config changed');
    context.state = 'upload-intent'; persist(context);
    await run('pnpm', ['exec', 'wrangler', 'versions', 'upload', '--config', configFile, '--strict'], { WRANGLER_OUTPUT_FILE_PATH: uploadFile });
    const records = readFileSync(uploadFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    const versionId = productionUploadVersion(records);
    if (versionId === context.compatibleRecovery.versionId) throw new Error('Normal candidate and compatible recovery must be distinct versions');
    context.uploadedVersionId = verifyUploadedVersion(await read(`${script}/versions/${versionId}`), context.plan, context.audit.worker);
    context.state = 'uploaded'; persist(context);
  },
  async activate(context) {
    await gate(context.manifest.sha);
    const recoveryId = compatibleRecoveryVersionId(context);
    verifyCompatibleRecoveryVersion(context, await read(`${script}/versions/${recoveryId}`));
    unchangedAudit(context.audit, await capture(context.manifest.schema));
    context.state = 'activation-intent'; context.mutationAttempted = true; persist(context);
    const response = await mutate(`${script}/deployments`, 'POST', {
      strategy: 'percentage', versions: [{ version_id: context.uploadedVersionId, percentage: 100 }] });
    context.activationProof = await confirmDeploymentMutation(response, context.uploadedVersionId, {
      recordId: (id) => { context.activeDeploymentId = id; persist(context); },
      readDeployment: (id) => read(`${script}/deployments/${id}`), readCurrent: currentDeployment,
    });
    context.state = 'activated'; persist(context); await fenced(context);
  },
  async proveLegacy(context) { context.legacyProof = await prove(profiles.production.legacy, context); context.state = 'legacy-proven'; persist(context); },
  async attach(context) {
    await fenced(context);
    context.hosts = planHosts({ environment: 'production', sha: context.manifest.sha, versionId: context.uploadedVersionId,
      domains: await domainList(), ...await inventory() }); persist(context);
    await attachHosts(context.hosts, { list: domainList, put: (body) => mutate(`${base}/workers/domains`, 'PUT', body),
      gate: () => fenced(context), inventory, persist: () => persist(context) });
    context.state = 'hosts-attached'; persist(context);
  },
  async proveHosts(context) {
    context.appProof = await prove(profiles.production.app, context);
    const request = (url, init = {}) => fetch(url, { ...init, redirect: 'manual', credentials: 'omit', signal: AbortSignal.timeout(15000) });
    const api = await request(`${profiles.production.api}/api/v1/health`);
    const spa = await request(`${profiles.production.api}/auth`);
    const cors = await request(`${profiles.production.api}/api/v1/health`, { method: 'OPTIONS',
      headers: { Origin: profiles.production.app, 'Access-Control-Request-Method': 'GET' } });
    const redirect = await request(`${profiles.production.www}/recipes?domain_probe=1`);
    if (api.status !== 200 || !(api.headers.get('content-type') ?? '').includes('application/json') || spa.status !== 404 ||
        cors.status !== 204 || cors.headers.get('access-control-allow-origin') !== profiles.production.app ||
        cors.headers.get('access-control-allow-credentials') !== 'true' ||
        ![301, 308].includes(redirect.status) || redirect.headers.get('location') !== `${profiles.production.app}/recipes?domain_probe=1`) {
      throw new Error('Production hostname/API/CORS/WWW proof failed');
    }
    context.hostProof = { apiStatus: api.status, apiSpaStatus: spa.status, corsStatus: cors.status, wwwStatus: redirect.status, httpsVerified: true };
    await fenced(context); persist(context);
  },
  async finish(context) {
    context.state = 'observing'; persist(context);
    context.observation = await observeProduction(async () => {
      await fenced(context);
      const proof = await waitForDeployedRelease(context.manifest, { url: profiles.production.app, verifyAssets: true, requiredConsecutive: 1 });
      verifyRecipeAuthorityEvidence(context.manifest, await authority(profiles.production.app), readJson(CATALOG_RELEASE_MANIFEST_PATH));
      return { sha: proof.sha, environment: proof.environment, assetsSha: proof.assets.sha };
    }, async (observation) => { context.observation = observation; persist(context); });
    context.state = 'infrastructure-observed';
    context.acceptance = 'Production browser/provider checks and release-window error inspection must be recorded separately'; persist(context);
  },
  persist,
  async recover(context) {
    persist(context);
    if (!context.mutationAttempted) { context.recovery = 'No traffic or hostname mutation attempted'; persist(context); return; }
    validateProductionRecovery(context, env);
    const recoveryId = compatibleRecoveryVersionId(context);
    verifyCompatibleRecoveryVersion(context, await read(`${script}/versions/${recoveryId}`));
    if (hasPrivateDomains(context)) restorePrivateDomains(context, await domainList());
    const active = await currentDeployment();
    if (compatibleRecoveryAction(context, active) === 'verify-recovery') { await verifyRestored(context, active); return; }
    context.activeDeploymentId = active.deploymentId;
    const rollbackGate = async () => {
      const current = await currentDeployment();
      if (current.versionId !== context.uploadedVersionId || current.deploymentId !== context.activeDeploymentId) throw new Error('Production rollback traffic fence changed');
      verifyCompatibleRecoveryVersion(context, await read(`${script}/versions/${recoveryId}`));
      verifyUploadedVersion(await read(`${script}/versions/${current.versionId}`), context.plan, context.audit.worker);
      if (!isDeepStrictEqual((await capture(context.manifest.schema)).operational, context.audit.operational)) throw new Error('Production rollback operational fence changed');
    };
    if (context.hosts) await detachCreatedHosts(context.hosts, { list: domainList,
      remove: (id) => mutate(`${base}/workers/domains/${id}`, 'DELETE'), gate: rollbackGate, persist: () => persist(context) });
    await rollbackGate(); context.state = 'rollback-intent'; persist(context);
    const response = await mutate(`${script}/deployments`, 'POST', {
      strategy: 'percentage', versions: [{ version_id: recoveryId, percentage: 100 }] });
    const mutation = await confirmDeploymentMutation(response, recoveryId, {
      recordId: (id) => { context.rollbackDeploymentId = id; persist(context); },
      readDeployment: (id) => read(`${script}/deployments/${id}`), readCurrent: currentDeployment,
    });
    await verifyRestored(context, mutation);
  },
};

export async function releaseProduction(provider = productionProvider) {
  const context = await provider.prepare();
  try {
    for (const step of ['prepareRecovery', 'build', 'upload', 'activate', 'proveLegacy', 'attach', 'proveHosts', 'finish']) await provider[step](context);
    return context;
  } catch (error) {
    context.failure = error instanceof Error ? error.message : 'Production release failed';
    try { await provider.recover(context); }
    catch (recoveryError) {
      context.recoveryFailure = recoveryError instanceof Error ? recoveryError.message : 'Production recovery failed';
      await provider.persist(context);
      throw new Error('Production release and recovery failed; reconcile the retained receipt');
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const execute = async () => {
    const mode = process.argv[2] ?? 'release';
    if (mode === 'release') return releaseProduction();
    if (mode !== 'recover') throw new Error('Usage: production-provider.mjs [release|recover]');
    const file = resolve(output, 'receipt.json');
    if (existsSync(file)) {
      const context = readJson(file);
      if (context.plan && configHash(context.plan.bytes) !== context.plan.sha256) throw new Error('Production recovery config commitment changed');
      return productionProvider.recover(context);
    }
    console.log('No recorded production activation intent; no recovery mutation attempted');
  };
  execute().catch((error) => {
    const message = redact(error instanceof Error ? error.message : 'Production release failed');
    mkdirSync(output, { recursive: true });
    const file = resolve(output, 'receipt.json');
    const receipt = existsSync(file) ? readJson(file) : { state: 'preflight-failed', mutationAttempted: false };
    receipt.commandFailure = message; persist(receipt); console.error(message); process.exitCode = 1;
  });
}
