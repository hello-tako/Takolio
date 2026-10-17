import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { captureBindings, configBindings } from './bindings.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const profiles = JSON.parse(readFileSync(resolve(root, 'config/domain-profiles.json'), 'utf8'));
const readConfig = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8').split('\n').filter((line) => !line.trim().startsWith('//')).join('\n'));

export function sourceIdentity(cwd) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  if (git('status', '--porcelain', '--untracked-files=all')) throw new Error('Commit all source changes before preparing an SHA-bound candidate');
  return git('rev-parse', 'HEAD');
}

export function prepareConfig(environment, snapshot, sha) {
  if (!['staging', 'production'].includes(environment) || !/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid environment or source SHA');
  if (snapshot.accountId !== 'ef250a88911fd24073cb73d1c07e0218' || snapshot.zoneId !== '9284fb2186987f14f810818583acaa46') throw new Error('Account/zone mismatch');
  const base = readConfig(environment === 'production' ? 'wrangler.jsonc' : 'wrangler.staging.jsonc');
  const live = snapshot.workers[environment];
  if (live.name !== base.name || !/^[a-f0-9-]{36}$/.test(live.versionId)) throw new Error('Worker identity mismatch');
  if (!Array.isArray(live.typedBindings)) throw new Error('Complete typed bindings are required');
  const captured = captureBindings(live.typedBindings);
  const expected = captureBindings(configBindings(base));
  if (!isDeepStrictEqual(captured, expected) || !isDeepStrictEqual(captured.bindings, live.bindings)) throw new Error('Binding drift requires a new audit');
  if (base.compatibility_date !== live.runtime?.compatibility_date || !isDeepStrictEqual(base.compatibility_flags, live.runtime?.compatibility_flags) ||
      base.assets.html_handling !== live.runtime?.assets.html_handling || base.assets.not_found_handling !== live.runtime?.assets.not_found_handling) throw new Error('Runtime compatibility drift requires a new audit');
  const prod = snapshot.workers.production.bindings;
  if (environment === 'staging' && Object.values(live.bindings).some((value) => Object.values(prod).includes(value))) throw new Error('Staging overlaps production storage or queue');
  const profile = profiles[environment];
  const routes = [...(base.routes || [])];
  for (const origin of [profile.app, profile.api, profile.www].filter(Boolean)) {
    const pattern = new URL(origin).hostname;
    if (!routes.some((route) => route.pattern === pattern && route.custom_domain === true)) routes.push({ pattern, custom_domain: true });
  }
  const config = {
    ...base, account_id: snapshot.accountId,
    main: resolve(root, base.main),
    assets: { ...base.assets, directory: resolve(root, base.assets.directory), run_worker_first: true },
    d1_databases: base.d1_databases.map((db) => ({ ...db, migrations_dir: resolve(root, db.migrations_dir) })),
    vars: { ...live.vars, APP_URL: profile.app, PUBLIC_DOMAIN_ROUTING: 'true', GIT_COMMIT: sha },
    routes,
  };
  if (routes.some((route) => /(^|\.)admin\.takolio\.app/.test(route.pattern))) throw new Error('Admin must stay reserved');
  return { config, buildEnvironment: {
    GIT_COMMIT: sha,
    VITE_MEAL_PLANNER_ENABLED: live.vars.MEAL_PLANNER_ENABLED || 'false',
    VITE_MEAL_COMPOSITION_V2_ENABLED: live.vars.MEAL_COMPOSITION_V2_ENABLED || 'false',
  }, capturedVersion: live.versionId, deployAuthorized: false, operationalSettingsVerified: live.operationalSettingsVerified === true,
  operationalBlockers: live.operationalBlockers || ['Operational settings were not independently verified'] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const environment = process.argv[2];
  if (process.argv.length !== 3 || !['staging', 'production'].includes(environment)) throw new Error('Usage: node scripts/domain/prepare.mjs staging|production (local preparation only; never deploys)');
  const sha = sourceIdentity(root);
  const snapshot = JSON.parse(readFileSync(resolve(root, 'docs/domain-integration/evidence/live-runtime.json'), 'utf8'));
  const plan = prepareConfig(environment, snapshot, sha);
  const out = resolve(root, '.artifacts/domain', environment);
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'wrangler.json'), `${JSON.stringify(plan.config, null, 2)}\n`);
  writeFileSync(resolve(out, 'plan.json'), `${JSON.stringify({ ...plan, config: undefined, snapshotObservedAt: snapshot.observedAt }, null, 2)}\n`);
  process.stdout.write(`Prepared local ${environment} candidate only. No Cloudflare mutation. Refresh snapshot and satisfy operational and release gates before use.\n`);
}
