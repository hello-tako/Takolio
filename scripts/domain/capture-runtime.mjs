import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { captureBindings } from './bindings.mjs';

const accountId = 'ef250a88911fd24073cb73d1c07e0218';
const targets = [
  ['production', 'frigo', '35dd189e-7e3c-4782-b69b-237da7dadd62'],
  ['staging', 'frigo-staging', 'b97b11fe-9151-41ac-9130-52532c045c8e'],
];
const snapshot = { observedAt: new Date().toISOString(), accountId, zoneId: '9284fb2186987f14f810818583acaa46', workers: {} };
for (const [environment, name, expectedVersion] of targets) {
  const args = (values) => execFileSync('pnpm', ['exec', 'wrangler', ...values], { env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const deployments = JSON.parse(args(['deployments', 'list', '--name', name, '--json']));
  const current = deployments.at(-1);
  if (current.versions.length !== 1 || current.versions[0].percentage !== 100 || current.versions[0].version_id !== expectedVersion) throw new Error('Deployment changed; re-audit before capturing');
  const version = JSON.parse(args(['versions', 'view', expectedVersion, '--name', name, '--json']));
  const runtime = version.resources.script_runtime;
  snapshot.workers[environment] = {
    name, deploymentId: current.id, versionId: version.id, createdOn: version.metadata.created_on,
    ...captureBindings(version.resources.bindings), handlers: version.resources.script.handlers,
    runtime: {
      compatibility_date: runtime.compatibility_date, compatibility_flags: runtime.compatibility_flags,
      usage_model: runtime.usage_model,
      assets: { html_handling: runtime.assets.html_handling, not_found_handling: runtime.assets.not_found_handling,
        run_worker_first: runtime.assets.raw_run_worker_first, base_path: runtime.assets.base_path },
    },
    operationalSettingsVerified: false,
    operationalBlockers: ['Live routes, workers.dev, cron schedules, queue consumers and observability must be captured and compared immediately before deployment'],
  };
}
writeFileSync('docs/domain-integration/evidence/live-runtime.json', `${JSON.stringify(snapshot, null, 2)}\n`);
process.stdout.write('Saved complete supported binding inventory, public vars and secret names only. No remote writes. Operational settings still require audit.\n');
