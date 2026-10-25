#!/usr/bin/env node
// Read-only release planning. No deploy, remote D1, secret mutation or approval API.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CUSTOMER_BASELINE, REVIEWED_DOMAIN_BASELINE, V2_RELEASE_BASELINE, selectGuardedCustomerBaseline } from './admin-customer-baseline.mjs';

const args = process.argv.slice(2);
const get = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const git = (...values) => execFileSync('git', values, { encoding: 'utf8' }).trim();
const sha = get('--sha', git('rev-parse', 'HEAD'));
const operation = get('--operation', 'validate');
if (!/^[a-f0-9]{40}$/.test(sha) || !['validate', 'staging', 'production', 'migrate', 'breakglass'].includes(operation)) {
  throw new Error('Exact SHA and enumerated operation required');
}
if (git('rev-parse', 'HEAD') !== sha) throw new Error('Checkout does not match requested source SHA');
const dirtyPaths = git('status', '--porcelain').split('\n').filter(Boolean);
if (operation !== 'validate' && dirtyPaths.length) throw new Error('Release planning requires a clean exact-SHA checkout');
const jsonc = file => JSON.parse(readFileSync(file, 'utf8').split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n'));
const admin = jsonc('wrangler.admin.jsonc'), facade = jsonc('wrangler.admin-facade.jsonc'), customer = jsonc('wrangler.jsonc');
if (admin.d1_databases.length !== 1 || admin.d1_databases[0].binding !== 'ADMIN_DB' ||
    admin.d1_databases[0].database_id === customer.d1_databases[0].database_id) throw new Error('Admin customer-D1 isolation violated');
if (admin.define?.__ADMIN_LOCAL_AUTH__ !== 'false' || admin.vars.ADMIN_AUTH_MODE !== 'cloudflare_access' ||
    admin.assets.run_worker_first !== true || admin.vars.ADMIN_CONSOLE_ENABLED !== 'false' || admin.workers_dev !== false) {
  throw new Error('Unsafe Admin template');
}
if (facade.workers_dev !== false || facade.preview_urls !== false || facade.routes?.length ||
    facade.d1_databases.length !== 1 || facade.d1_databases[0].binding !== 'DB') throw new Error('Unsafe facade exposure');
if (admin.services?.length !== 1 || admin.services[0].binding !== 'CUSTOMER_READ' ||
    admin.services[0].service !== facade.name || admin.services[0].entrypoint !== 'AdminCustomerReadFacade') throw new Error('Facade service binding mismatch');
const hash = value => createHash('sha256').update(value).digest('hex');
const migrations = readdirSync('migrations-admin').filter(file => /^[0-9]{4}_[a-z0-9_]+\.sql$/.test(file)).sort()
  .map(name => ({ name, sha256: hash(readFileSync(path.join('migrations-admin', name))) }));
const protectedPaths = ['migrations', 'src/worker/index.ts', 'src/worker/types.ts', 'wrangler.jsonc', 'wrangler.staging.jsonc',
  '.github/workflows/ci.yml', '.github/workflows/deploy.yml', '.github/workflows/production-d1-migrate.yml'];
const { baseline: customerBaseline } = selectGuardedCustomerBaseline({
  git, originalBaseline: CUSTOMER_BASELINE, reviewedBaseline: REVIEWED_DOMAIN_BASELINE,
  releaseBaseline: V2_RELEASE_BASELINE, guardedPaths: protectedPaths,
});
const changed = git('diff', '--name-only', customerBaseline, '--', ...protectedPaths);
if (changed) throw new Error('Customer release surface changed: ' + changed);
const paths = git('ls-files', '--cached', '--others', '--exclude-standard').split('\n').filter(Boolean)
  .filter(file => /^(?:src\/(?:admin|worker\/(?:facade|routes\/admin))\/|src\/worker\/admin-|migrations-admin\/|scripts\/admin-|tests\/(?:unit|integration|e2e)\/admin-|\.github\/workflows\/admin-|wrangler\.admin|vite\.admin|playwright\.admin|admin\/)/.test(file)).sort();
const sourceManifest = paths.map(file => ({ path: file, sha256: hash(readFileSync(file)) }));
const blockers = ['independent security/workflow review on exact SHA', 'default-disabled live adapter requires authorized staging API/rollback validation and operator activation',
  'real staging operator authorization and resource identities', 'verified owner Access identity and enrolled recovery key',
  'protected environment self-review prevention and required checks', 'staging identity, rollback and browser certification'];
const result = { schemaVersion: 2, generatedAt: new Date().toISOString(), sourceSha: sha, sourceTree: git('rev-parse', 'HEAD^{tree}'),
  cleanCheckout: dirtyPaths.length === 0, dirtyPaths, operation, mode: 'offline-plan-only', remoteExecuted: false, productionDeployed: false,
  customerBaseline, sourceManifest, sourceManifestSha256: hash(JSON.stringify(sourceManifest)), migrations, migrationManifestSha256: hash(JSON.stringify(migrations)),
  targets: { admin: admin.name, facade: facade.name, adminDb: admin.d1_databases[0].database_id, customerDb: facade.d1_databases[0].database_id },
  readyForDeployment: false, blockers };
mkdirSync('.artifacts/admin-r2', { recursive: true });
writeFileSync('.artifacts/admin-r2/release-plan.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ sourceSha: sha, cleanCheckout: result.cleanCheckout, sourceManifestSha256: result.sourceManifestSha256,
  operation, customerBaseline, configurationValidation: 'PASS', readyForDeployment: false, remoteExecuted: false }));
