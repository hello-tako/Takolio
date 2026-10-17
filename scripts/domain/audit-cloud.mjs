import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { captureBindings } from './bindings.mjs';
import { hostedCi, migrationManifest, requireCurrentHostedMain, verifyMigrationLedger, verifyStableWorkerDeployment } from '../release-check.mjs';

export const ACCOUNT = 'ef250a88911fd24073cb73d1c07e0218';
export const ZONE = '9284fb2186987f14f810818583acaa46';
export const REPOSITORY = 'hello-tako/Takolio';
export const REPOSITORY_ID = '1422954151';
const targets = { production: 'frigo', staging: 'frigo-staging' };

// API failures expose only the endpoint, HTTP status and numeric error codes.
export async function cloudflareRead(path, token, { fetchImpl = fetch, sql } = {}) {
  if (!path.startsWith(`/accounts/${ACCOUNT}/`) && path !== `/zones/${ZONE}` && !path.startsWith(`/zones/${ZONE}/`)) throw new Error('Unapproved Cloudflare target');
  const query = sql !== undefined;
  if (query && (path !== `/accounts/${ACCOUNT}/d1/database/${sql.databaseId}/query` || sql.sql !== 'SELECT name FROM d1_migrations ORDER BY name')) throw new Error('Only the fixed migration-ledger query is allowed');
  const response = await fetchImpl(`https://api.cloudflare.com/client/v4${path}`, {
    method: query ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(query ? { 'Content-Type': 'application/json' } : {}) },
    ...(query ? { body: JSON.stringify({ sql: sql.sql }) } : {}),
    redirect: 'error', signal: AbortSignal.timeout(30000),
  });
  let body;
  try { body = await response.json(); } catch { throw new Error(`Cloudflare returned invalid JSON: ${response.status} ${path}`); }
  if (!response.ok || body.success !== true) {
    const codes = (body.errors || []).map((error) => error.code).filter(Number.isInteger);
    throw new Error(`Cloudflare read failed: HTTP ${response.status} ${path}; codes=${codes.join(',')}`);
  }
  if (body.result_info?.total_pages > 1 || body.result_info?.total_count > body.result?.length) throw new Error(`Paginated inventory requires explicit follow-up: ${path}`);
  return body.result;
}

export function sanitizeRuntime(version, deployment) {
  const stable = verifyStableWorkerDeployment(deployment);
  if (version.id !== stable.versionId) throw new Error('Deployment/version identity mismatch');
  const runtime = version.resources?.script_runtime;
  if (!runtime?.assets) throw new Error('Worker runtime/asset configuration is incomplete');
  return {
    deploymentId: stable.deploymentId, versionId: version.id,
    ...captureBindings(version.resources.bindings),
    runtime: { compatibility_date: runtime.compatibility_date, compatibility_flags: runtime.compatibility_flags,
      usage_model: runtime.usage_model, assets: { html_handling: runtime.assets.html_handling,
        not_found_handling: runtime.assets.not_found_handling, run_worker_first: runtime.assets.raw_run_worker_first,
        base_path: runtime.assets.base_path } },
  };
}

export async function audit(environment, { read, schema, baseline } = {}) {
  const name = targets[environment];
  if (!name) throw new Error('Audit requires staging or production');
  const base = `/accounts/${ACCOUNT}`;
  const script = `${base}/workers/scripts/${name}`;
  const deployments = await read(`${script}/deployments`);
  const entries = Array.isArray(deployments) ? deployments : deployments.deployments;
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('No Worker deployments returned');
  const deployment = [...entries].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
  const stable = verifyStableWorkerDeployment(deployment);
  const version = await read(`${script}/versions/${stable.versionId}`);
  const runtime = sanitizeRuntime(version, deployment);
  const [subdomain, schedules, settings, zone, domains, dns, routes] = await Promise.all([
    read(`${script}/subdomain`), read(`${script}/schedules`), read(`${script}/settings`),
    read(`/zones/${ZONE}`), read(`${base}/workers/domains?zone_id=${ZONE}&per_page=100`),
    read(`/zones/${ZONE}/dns_records?per_page=100`), read(`/zones/${ZONE}/workers/routes`),
  ]);
  if (zone.id !== ZONE || zone.name !== 'takolio.app' || zone.account?.id !== ACCOUNT || zone.status !== 'active') throw new Error('Cloudflare zone/account is not the active verified target');
  const current = baseline.workers[environment];
  if (!current || !isDeepStrictEqual(runtime.bindings, current.bindings) ||
      !isDeepStrictEqual(runtime.typedBindings, current.typedBindings)) throw new Error('Worker binding drift');
  const queueName = runtime.bindings.SCAN_QUEUE;
  const queues = await read(`${base}/queues?name=${encodeURIComponent(queueName)}&per_page=100`);
  const queue = queues.find((entry) => entry.queue_name === queueName);
  if (!queue?.queue_id) throw new Error('Exact queue identity not found');
  const consumers = await read(`${base}/queues/${queue.queue_id}/consumers`);
  const ledger = await read(`${base}/d1/database/${runtime.bindings.DB}/query`, {
    databaseId: runtime.bindings.DB, sql: 'SELECT name FROM d1_migrations ORDER BY name',
  });
  const ledgerProof = verifyMigrationLedger(schema, ledger);
  return {
    observedAt: new Date().toISOString(), readOnly: true, accountId: ACCOUNT, zoneId: ZONE,
    environment, worker: { name, ...runtime }, ledger: ledgerProof,
    operational: {
      workers_dev: subdomain.enabled, preview_urls: subdomain.previews_enabled,
      crons: (Array.isArray(schedules) ? schedules : schedules.schedules).map((entry) => entry.cron),
      observability: settings.observability,
      consumers: consumers.map((entry) => ({ consumer_id: entry.consumer_id, type: entry.type,
        script: entry.script, service: entry.service, environment: entry.environment,
        settings: entry.settings, dead_letter_queue: entry.dead_letter_queue })),
    },
    zone: { name: zone.name, status: zone.status },
    customDomains: domains.map((entry) => ({ id: entry.id, hostname: entry.hostname, service: entry.service, zone_id: entry.zone_id })),
    dns: dns.map((entry) => ({ id: entry.id, type: entry.type, name: entry.name, proxied: entry.proxied })),
    routes: routes.map((entry) => ({ id: entry.id, pattern: entry.pattern, script: entry.script })),
    deploymentAuthorized: false,
  };
}

async function main() {
  const environment = process.argv[2];
  if (!Object.hasOwn(targets, environment) || process.argv.length !== 3) throw new Error('Usage: audit-cloud.mjs staging|production');
  const env = process.env;
  if (env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_REPOSITORY_ID !== REPOSITORY_ID) throw new Error('Read-only audit must run on canonical main');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (env.AUDIT_SHA !== sha || env.GITHUB_SHA !== sha) throw new Error('Audit SHA must equal dispatched main');
  if (!env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT) throw new Error('Environment credentials/account unavailable');
  const ci = await hostedCi(sha, REPOSITORY);
  await requireCurrentHostedMain({ sha, repository: REPOSITORY });
  const baseline = JSON.parse(readFileSync('docs/domain-integration/evidence/live-runtime.json', 'utf8'));
  const receipt = await audit(environment, { schema: migrationManifest(process.cwd(), sha), baseline,
    read: (path, sql) => cloudflareRead(path, env.CLOUDFLARE_API_TOKEN, { sql }) });
  await requireCurrentHostedMain({ sha, repository: REPOSITORY });
  const output = resolve('.artifacts/domain/audit');
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, `${environment}.json`), `${JSON.stringify({ repository: REPOSITORY, repositoryId: REPOSITORY_ID, sha, ci, ...receipt }, null, 2)}\n`);
  process.stdout.write(`Read-only ${environment} audit completed for ${sha}. No deployment, DNS or data mutation.\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Read-only audit failed'); process.exitCode = 1; });
}
