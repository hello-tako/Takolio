import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { ACCOUNT, ZONE, REPOSITORY, REPOSITORY_ID, audit, cloudflareRead } from './audit-cloud.mjs';
import { prepareReleaseConfig, configHash } from './release-config.mjs';
import { stagingFetch, stagingCurlExecute } from './access-http.mjs';
import { planHosts, attachHosts, detachCreatedHosts, validateDomains, isDomainId } from './hosts.mjs';
import { STAGING_GOOGLE_CLIENT_ID, unchangedAudit, verifyUploadedVersion, releaseStaging, recoveryAction, validateRecoveryContext } from './staging-release.mjs';
import { capturedCommand } from '../cloudflare-deploy-retry.mjs';
import { validateReleaseSource, migrationManifest, hostedCi, requireCurrentHostedMain,
  fetchRecipeAuthorityEvidence, verifyPreviousRecipeAuthority, verifyRecipeAuthorityEvidence,
  CATALOG_RELEASE_MANIFEST_PATH, verifyStableWorkerDeployment } from '../release-check.mjs';
import { waitForDeployedRelease } from '../wait-for-deployed-release.mjs';
import { waitForServiceWorkerRelease, fetchServiceWorkerWithCurl } from '../wait-for-service-worker-release.mjs';
import profiles from '../../config/domain-profiles.json' with { type: 'json' };

const worker = 'frigo-staging';
const base = `/accounts/${ACCOUNT}`;
const script = `${base}/workers/scripts/${worker}`;
const output = resolve('.artifacts/domain/staging-release');
const configFile = resolve(output, 'wrangler.json');
const uploadFile = resolve(output, 'upload.jsonl');
const env = process.env;
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const persist = (context) => writeFileSync(resolve(output, 'receipt.json'), `${JSON.stringify(context, null, 2)}\n`);
const read = (path, sql) => cloudflareRead(path, env.CLOUDFLARE_API_TOKEN, { sql });
const baseline = () => readJson('docs/domain-integration/evidence/live-runtime.json');
const capture = (schema) => audit('staging', { read, schema, baseline: baseline() });
const domainList = async () => validateDomains(await read(`${base}/workers/domains?per_page=100`));
const inventory = async () => ({ dns: await read(`/zones/${ZONE}/dns_records?per_page=100`),
  routes: await read(`/zones/${ZONE}/workers/routes`) });

async function gate(sha) {
  if (env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_REPOSITORY !== REPOSITORY ||
      env.GITHUB_REPOSITORY_ID !== REPOSITORY_ID || env.GITHUB_SHA !== sha ||
      env.GITHUB_WORKFLOW_SHA !== sha || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.CONFIRM_STAGING !== 'true' || env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT ||
      !env.CLOUDFLARE_API_TOKEN || !env.RELEASE_VERIFY_TOKEN) throw new Error('Protected canonical staging release context required');
  if (execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== sha) throw new Error('Release checkout changed');
  validateReleaseSource({ ref: sha, hardenedSha: env.HARDENED_SHA });
  await requireCurrentHostedMain({ sha, repository: REPOSITORY });
  const ci = await hostedCi(sha, REPOSITORY);
  const query = new URLSearchParams({ event: 'push', branch: 'main', head_sha: sha, per_page: '100' });
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/actions/workflows/admin-ci.yml/runs?${query}`, {
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
    redirect: 'error', signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Admin CI lookup failed: HTTP ${response.status}`);
  const runs = (await response.json()).workflow_runs;
  const adminRuns = runs.filter((run) => run.head_sha === sha && run.head_branch === 'main' &&
    run.event === 'push' && run.path === '.github/workflows/admin-ci.yml' &&
    run.repository?.full_name === REPOSITORY && run.head_repository?.full_name === REPOSITORY);
  const adminCi = adminRuns.sort((a, b) =>
    (Date.parse(b.updated_at || b.run_started_at || b.created_at) || 0) -
    (Date.parse(a.updated_at || a.run_started_at || a.created_at) || 0) || b.id - a.id || b.run_attempt - a.run_attempt)[0];
  if (!adminCi || adminCi.status !== 'completed' || adminCi.conclusion !== 'success') {
    throw new Error('Latest exact-SHA Admin CI push run on main must be completed and successful');
  }
  return { ci, adminCi: { id: adminCi.id, attempt: adminCi.run_attempt, url: adminCi.html_url,
    headSha: adminCi.head_sha, checkedAt: new Date().toISOString() } };
}

export function isStagingMutation(path, method) {
  const domainPrefix = `${base}/workers/domains/`;
  return path === `${script}/deployments` && method === 'POST' ||
    path === `${base}/workers/domains` && method === 'PUT' ||
    typeof path === 'string' && path.startsWith(domainPrefix) &&
    isDomainId(path.slice(domainPrefix.length)) && method === 'DELETE';
}

async function mutate(path, method, body) {
  if (!isStagingMutation(path, method)) throw new Error('Unapproved staging mutation');
  let response;
  try {
    response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
      method, headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(30000),
    });
  } catch { throw new Error('Staging mutation outcome is uncertain; inspect receipt before reconciliation'); }
  let data;
  try { data = await response.json(); } catch { throw new Error('Staging mutation returned an uncertain response'); }
  if (!response.ok || data.success !== true) throw new Error(`Staging mutation failed: HTTP ${response.status}`);
  return data.result;
}

async function currentDeployment() {
  const result = await read(`${script}/deployments?per_page=100`);
  const entries = Array.isArray(result) ? result : result.deployments;
  return verifyStableWorkerDeployment([...entries].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0]);
}

async function run(command, args, extraEnv = {}) {
  const result = await capturedCommand(command, args, { timeoutMs: 600000,
    env: { ...env, ...extraEnv, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG: 'error' } });
  if (result.exitCode !== 0 || result.incomplete || result.signal) throw new Error('Staging build/upload command failed; output withheld to protect credentials');
}

async function authority(origin) {
  return fetchRecipeAuthorityEvidence(origin, env.RELEASE_VERIFY_TOKEN, { fetchImpl: stagingFetch });
}

async function prove(origin, context) {
  const deployed = await waitForDeployedRelease(context.manifest, { url: origin, fetch: stagingFetch, verifyAssets: true });
  const assets = await waitForServiceWorkerRelease(origin, context.manifest.sha, {
    fetch: (url, options) => fetchServiceWorkerWithCurl(url, options,
      (command, args, execution) => stagingCurlExecute(command, args, execution, url)),
  });
  const recipeAuthority = verifyRecipeAuthorityEvidence(context.manifest, await authority(origin), readJson(CATALOG_RELEASE_MANIFEST_PATH));
  return { deployed, assets, recipeAuthority };
}

async function fenced(context) {
  await gate(context.manifest.sha);
  if (!context.uploadedVersionId) throw new Error('Uploaded version identity is missing');
  const current = await currentDeployment();
  if (current.versionId !== context.uploadedVersionId || current.deploymentId !== context.activeDeploymentId) throw new Error('Staging traffic changed after activation');
  verifyUploadedVersion(await read(`${script}/versions/${current.versionId}`), context.plan, context.audit.worker);
  const after = await capture(context.manifest.schema);
  if (!isDeepStrictEqual(after.operational, context.audit.operational)) throw new Error('Staging operational settings changed');
}

async function verifyRestored(context, mutation) {
  const restored = await capture(context.manifest.schema);
  const expected = structuredClone(context.audit);
  expected.worker.deploymentId = restored.worker.deploymentId;
  unchangedAudit(expected, restored);
  const previous = await authority(profiles.staging.legacy);
  for (const key of ['commit', 'environment', 'configuredMode', 'servedFingerprint', 'servedRecipeCount', 'releaseId', 'fallbackReason']) {
    if (!isDeepStrictEqual(previous[key], context.manifest.previousRecipeAuthority[key])) throw new Error('Rollback authority differs from previous evidence');
  }
  context.recovery = { state: 'previous-version-restored', deploymentId: mutation.deploymentId, versionId: mutation.versionId };
  context.state = 'rolled-back'; persist(context);
}

export const provider = {
  async prepare() {
    const sha = env.RELEASE_SHA;
    const checks = await gate(sha);
    mkdirSync(output, { recursive: true });
    const schema = migrationManifest(process.cwd(), sha);
    const snapshot = await capture(schema);
    const vars = snapshot.worker.vars;
    const manifest = { repository: REPOSITORY, sha, environment: 'staging', hardenedSha: env.HARDENED_SHA, schema,
      mealCompositionV2Enabled: vars.MEAL_COMPOSITION_V2_ENABLED === 'true', recipeCatalogMode: vars.RECIPE_CATALOG_MODE,
      recipeCatalogCanaryPercent: Number(vars.RECIPE_CATALOG_D1_CANARY_PERCENT), recipeCatalogCutoverEnabled: vars.RECIPE_CATALOG_CUTOVER_ENABLED === 'true' };
    const receipt = { repository: REPOSITORY, repositoryId: REPOSITORY_ID, sha, ...checks, ...snapshot };
    const plan = prepareReleaseConfig({ manifest, receipt, baseline: baseline() });
    plan.config.vars.GOOGLE_CLIENT_ID = STAGING_GOOGLE_CLIENT_ID;
    plan.bytes = `${JSON.stringify(plan.config, null, 2)}\n`;
    plan.sha256 = configHash(plan.bytes);
    // Validate account inventory and hostname conflicts before any code upload or traffic change.
    planHosts({ environment: 'staging', sha, versionId: snapshot.worker.versionId,
      domains: await domainList(), ...await inventory() });
    const anonymous = await fetch(`${profiles.staging.legacy}/api/v1/health`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const location = new URL(anonymous.headers.get('location') ?? 'https://invalid.example');
    if (anonymous.status !== 302 || location.protocol !== 'https:' || !location.hostname.endsWith('.cloudflareaccess.com')) {
      throw new Error('Unauthenticated staging must remain protected by Cloudflare Access');
    }
    const previous = await authority(profiles.staging.legacy);
    manifest.previousRecipeAuthorityProof = verifyPreviousRecipeAuthority(manifest, previous, { cwd: process.cwd() });
    manifest.previousRecipeAuthority = previous;
    const context = { manifest, audit: snapshot, checks, plan, state: 'prepared', mutationAttempted: false };
    writeFileSync(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(configFile, plan.bytes);
    writeFileSync(uploadFile, '');
    persist(context);
    return context;
  },
  async build(context) {
    await run('pnpm', ['build'], context.plan.buildEnvironment);
    await run('node', ['scripts/composition-flags.mjs', 'verify', resolve(output, 'manifest.json'), 'dist/composition-flags.json', configFile], { ...context.plan.buildEnvironment, MEAL_COMPOSITION_V2_ENABLED: String(context.manifest.mealCompositionV2Enabled) });
  },
  async upload(context) {
    await gate(context.manifest.sha);
    unchangedAudit(context.audit, await capture(context.manifest.schema));
    if (configHash(readFileSync(configFile)) !== context.plan.sha256) throw new Error('Prepared config bytes changed');
    context.state = 'upload-intent'; persist(context);
    await run('pnpm', ['exec', 'wrangler', 'versions', 'upload', '--config', configFile, '--strict'], { WRANGLER_OUTPUT_FILE_PATH: uploadFile });
    const records = readFileSync(uploadFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    if (records.length !== 1 || records[0].type !== 'version-upload' || records[0].worker_name !== worker ||
        !/^[a-f0-9-]{36}$/.test(records[0].version_id ?? '')) throw new Error('Upload response requires reconciliation');
    context.uploadedVersionId = verifyUploadedVersion(await read(`${script}/versions/${records[0].version_id}`), context.plan, context.audit.worker);
    context.state = 'uploaded'; persist(context);
  },
  async activate(context) {
    await gate(context.manifest.sha);
    unchangedAudit(context.audit, await capture(context.manifest.schema));
    context.state = 'activation-intent'; context.mutationAttempted = true; persist(context);
    const deployment = await mutate(`${script}/deployments`, 'POST', {
      strategy: 'percentage', versions: [{ version_id: context.uploadedVersionId, percentage: 100 }],
    });
    const active = verifyStableWorkerDeployment(deployment);
    if (active.versionId !== context.uploadedVersionId) throw new Error('Activation did not prove the uploaded version');
    context.activeDeploymentId = active.deploymentId;
    context.state = 'activated'; persist(context);
    await fenced(context);
  },
  async proveLegacy(context) {
    context.legacyProof = await prove(profiles.staging.legacy, context);
    context.state = 'legacy-proven'; persist(context);
  },
  async attach(context) {
    await fenced(context);
    const current = await inventory();
    context.hosts = planHosts({ environment: 'staging', sha: context.manifest.sha,
      versionId: context.uploadedVersionId, domains: await domainList(), ...current });
    persist(context);
    await attachHosts(context.hosts, { list: domainList, put: (body) => mutate(`${base}/workers/domains`, 'PUT', body),
      gate: () => fenced(context), inventory, persist: () => persist(context) });
    context.state = 'hosts-attached'; persist(context);
  },
  async proveHosts(context) {
    context.appProof = await prove(profiles.staging.app, context);
    const api = await stagingFetch(`${profiles.staging.api}/api/v1/health`, { signal: AbortSignal.timeout(15000) });
    if (api.status !== 200 || !(api.headers.get('content-type') ?? '').includes('application/json')) throw new Error('Staging API liveness failed');
    const spa = await stagingFetch(`${profiles.staging.api}/auth`, { signal: AbortSignal.timeout(15000) });
    if (spa.status !== 404) throw new Error('Staging API served a frontend route');
    const cors = await stagingFetch(`${profiles.staging.api}/api/v1/health`, { method: 'OPTIONS',
      headers: { Origin: profiles.staging.app, 'Access-Control-Request-Method': 'GET' }, signal: AbortSignal.timeout(15000) });
    if (cors.status !== 204 || cors.headers.get('access-control-allow-origin') !== profiles.staging.app ||
        cors.headers.get('access-control-allow-credentials') !== 'true') throw new Error('Staging API CORS proof failed');
    context.hostProof = { apiStatus: api.status, apiSpaStatus: spa.status, corsStatus: cors.status, httpsVerified: true };
    await fenced(context);
  },
  async finish(context) {
    context.state = 'infrastructure-verified';
    context.acceptance = 'Real browser Google/OTP/PayOS sandbox, user journeys and live rollback rehearsal remain pending';
    persist(context);
  },
  persist,
  async recover(context) {
    persist(context);
    if (!context.mutationAttempted) { context.recovery = 'No traffic or hostname mutation attempted'; persist(context); return; }
    validateRecoveryContext(context, env);
    const active = await currentDeployment();
    if (recoveryAction(context, active) === 'verify-previous') {
      await verifyRestored(context, active);
      return;
    }
    context.activeDeploymentId = active.deploymentId;
    const rollbackGate = async () => {
      const latest = await currentDeployment();
      if (latest.versionId !== context.uploadedVersionId || latest.deploymentId !== context.activeDeploymentId) throw new Error('Rollback traffic fence changed');
      const snapshot = await capture(context.manifest.schema);
      if (!isDeepStrictEqual(snapshot.operational, context.audit.operational)) throw new Error('Rollback operational fence changed');
    };
    if (context.hosts) await detachCreatedHosts(context.hosts, { list: domainList,
      remove: (id) => mutate(`${base}/workers/domains/${id}`, 'DELETE'), gate: rollbackGate, persist: () => persist(context) });
    await rollbackGate();
    context.state = 'rollback-intent'; persist(context);
    const mutation = verifyStableWorkerDeployment(await mutate(`${script}/deployments`, 'POST', {
      strategy: 'percentage', versions: [{ version_id: context.audit.worker.versionId, percentage: 100 }],
    }));
    if (mutation.versionId !== context.audit.worker.versionId) throw new Error('Rollback response version mismatch');
    await verifyRestored(context, mutation);
  },
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] ?? 'release';
  const execute = async () => {
    if (mode === 'release') return releaseStaging(provider);
    if (mode !== 'recover') throw new Error('Usage: staging-provider.mjs [release|recover]');
    const file = resolve(output, 'receipt.json');
    if (existsSync(file)) return provider.recover(readJson(file));
    console.log('No recorded staging activation intent; no recovery mutation attempted');
  };
  execute().catch((error) => {
    let message = error instanceof Error ? error.message : 'Staging release failed';
    for (const name of ['GH_TOKEN', 'CLOUDFLARE_API_TOKEN', 'RELEASE_VERIFY_TOKEN', 'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET']) {
      if (env[name]) message = message.replaceAll(env[name], '[redacted]');
    }
    mkdirSync(output, { recursive: true });
    const file = resolve(output, 'receipt.json');
    const receipt = existsSync(file) ? readJson(file) : { state: 'preflight-failed', mutationAttempted: false };
    receipt.commandFailure = message;
    persist(receipt);
    console.error(message);
    process.exitCode = 1;
  });
}
