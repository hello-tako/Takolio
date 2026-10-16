import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { digest, renderConfigs, validateGitHub } from './admin-release-adapter.mjs';

const jsonc = file => JSON.parse(readFileSync(file, 'utf8').split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n'));

// HTTP origins and executable/arguments are fixed here; signed inputs never
// become SQL, command fragments, file paths, or network destinations.
export function createProvider(authorized, context, env = process.env, fetcher = fetch, command = execFileSync) {
  const { target } = authorized;
  const output = '.artifacts/admin-release';
  const request = async (origin, route, token, options = {}) => {
    if (!token) throw new Error('Required API credential is unavailable');
    const response = await fetcher(`${origin}${route}`, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers } });
    if (!response.ok) throw new Error(`Release provider HTTP ${response.status}`);
    const value = await response.json();
    if (origin.includes('cloudflare') && value.success !== true) throw new Error('Cloudflare operation failed');
    return origin.includes('cloudflare') ? value.result : value;
  };
  const gh = route => request('https://api.github.com', `/repos/lol-vn/Tako-san${route}`, env.GH_TOKEN, { headers: { 'X-GitHub-Api-Version': '2022-11-28' } });
  const cf = (route, options) => request('https://api.cloudflare.com', `/client/v4/accounts/${target.accountId}${route}`, env.CLOUDFLARE_API_TOKEN, options);
  const query = async (sql, params = []) => {
    const result = await cf(`/d1/database/${target.adminDatabaseId}/query`, { method: 'POST', body: JSON.stringify({ sql, params }) });
    if (!Array.isArray(result) || result.length !== 1 || result[0].success !== true || !Array.isArray(result[0].results)) throw new Error('Invalid D1 result');
    return result[0].results;
  };
  const configs = renderConfigs(target, context.environment, context.sourceSha, { admin: jsonc('wrangler.admin.jsonc'), facade: jsonc('wrangler.admin-facade.jsonc') });
  for (const config of Object.values(configs)) {
    config.main = path.resolve(config.main);
    if (config.assets) config.assets.directory = path.resolve(config.assets.directory);
    for (const db of config.d1_databases) if (db.migrations_dir) db.migrations_dir = path.resolve(db.migrations_dir);
  }
  const configPath = worker => `${output}/${worker}.json`;
  const wrangler = (worker, args) => {
    writeFileSync(configPath(worker), JSON.stringify(configs[worker], null, 2) + '\n', { mode: 0o600 });
    // Never forward process output to a public receipt; provider metadata may be sensitive.
    try { return command('pnpm', ['exec', 'wrangler', ...args, '--config', configPath(worker)], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
      timeout: 600000, env: { ...env, CLOUDFLARE_ACCOUNT_ID: target.accountId, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { throw new Error('Fixed Wrangler operation failed; no provider output is published'); }
  };
  const settings = worker => cf(`/workers/scripts/${worker}/settings`);
  const binding = (s, n, type) => s.bindings?.find(b => b.name === n && b.type === type);
  const verifyVersion = async (worker, versionId, previousSha, isAdmin) => {
    const v = await cf(`/workers/scripts/${worker}/versions/${versionId}`);
    const bindings = { bindings: v.resources?.bindings };
    const text = n => binding(bindings, n, 'plain_text')?.text;
    if (v.id !== versionId || text('ENVIRONMENT') !== context.environment || text('GIT_COMMIT') !== previousSha || text('ADMIN_SCHEMA_VERSION') !== '3' ||
        (isAdmin && (text('ADMIN_CONSOLE_ENABLED') !== 'false' || text('ADMIN_AUTH_MODE') !== 'cloudflare_access' ||
          binding(bindings, 'ADMIN_DB', 'd1')?.id !== target.adminDatabaseId ||
          binding(bindings, 'CUSTOMER_READ', 'service')?.service !== target.facadeWorker)) ||
        (!isAdmin && binding(bindings, 'DB', 'd1')?.id !== target.customerDatabaseId)) throw new Error('Unsafe rollback version');
  };
  const checkWrite = async () => {
    if (Date.parse(authorized.manifest.expiresAt) <= Date.now()) throw new Error('Release authorization expired');
    validateGitHub(await provider.githubFacts(), { ...context, requireAudit: true });
  };
  const expectedSchema = () => {
    const code = `import sqlite3,json,pathlib
c=sqlite3.connect(':memory:')
for p in sorted(pathlib.Path('migrations-admin').iterdir()):
 if p.name.endswith('.sql'): c.executescript(p.read_text())
q="SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name"
print(json.dumps([dict(zip(['type','name','tbl_name','sql'],r)) for r in c.execute(q)]))`;
    return JSON.parse(command('python3', ['-c', code], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
  };
  const provider = {
    async githubFacts() {
      const [repository, branch, protection, environment, run, ci, approvals, artifacts] = await Promise.all([
        gh(''), gh('/branches/main'), gh('/branches/main/protection'), gh(`/environments/admin-${context.environment}`),
        gh(`/actions/runs/${context.runId}`), gh(`/actions/workflows/admin-ci.yml/runs?head_sha=${context.sourceSha}&status=success&per_page=100`),
        gh(`/actions/runs/${context.runId}/approvals`), gh(`/actions/runs/${context.runId}/artifacts?per_page=100`),
      ]);
      return { repository, branch, protection, environment, run, ci: ci.workflow_runs ?? [], approvals,
        artifact: artifacts.artifacts?.find(a => a.name === `admin-pre-action-${context.runId}`) };
    },
    async verifyTargets(t) {
      const [adminDb, customerDb, kv, app, routes, domains, zone] = await Promise.all([
        cf(`/d1/database/${t.adminDatabaseId}`), cf(`/d1/database/${t.customerDatabaseId}`),
        cf('/storage/kv/namespaces?per_page=1000'), cf(`/access/apps/${t.accessApplicationId}`),
        request('https://api.cloudflare.com', `/client/v4/zones/${t.zoneId}/workers/routes`, env.CLOUDFLARE_API_TOKEN),
        cf('/workers/domains'),
        request('https://api.cloudflare.com', `/client/v4/zones/${t.zoneId}`, env.CLOUDFLARE_API_TOKEN),
      ]);
      if (adminDb.uuid !== t.adminDatabaseId || adminDb.name !== t.adminDatabaseName || customerDb.uuid !== t.customerDatabaseId ||
          customerDb.name !== t.customerDatabaseName || !Array.isArray(kv) || !kv.some(n => n.id === t.kvId) || app.id !== t.accessApplicationId || app.domain !== t.hostname ||
          app.aud !== t.audience || app.type !== 'self_hosted' || !Array.isArray(routes) || routes.some(r => r.script === t.facadeWorker)) throw new Error('Live target identity mismatch');
      if (zone.id !== t.zoneId || zone.account?.id !== t.accountId || !(t.hostname === zone.name || t.hostname.endsWith(`.${zone.name}`)) ||
          !Array.isArray(domains) || domains.some(d => d.service === t.facadeWorker) ||
          !domains.some(d => d.hostname === t.hostname && d.service === t.adminWorker && d.zone_id === t.zoneId)) throw new Error('Exact Admin custom-domain mapping required');
      const account = await cf('/access/organizations');
      if (`https://${account.auth_domain}` !== t.issuer) throw new Error('Access issuer mismatch');
      const facadeSubdomain = await cf(`/workers/scripts/${t.facadeWorker}/subdomain`);
      if (facadeSubdomain.enabled || facadeSubdomain.previews_enabled) throw new Error('Facade public subdomain enabled');
      // Existing binding identities must agree before a release can replace them.
      const [a, f] = await Promise.all([settings(t.adminWorker), settings(t.facadeWorker)]);
      if (binding(a, 'ADMIN_DB', 'd1')?.id !== t.adminDatabaseId || binding(f, 'DB', 'd1')?.id !== t.customerDatabaseId ||
          binding(a, 'CACHE', 'kv_namespace')?.namespace_id !== t.kvId ||
          binding(a, 'CUSTOMER_READ', 'service')?.service !== t.facadeWorker ||
          binding(a, 'CUSTOMER_READ', 'service')?.entrypoint !== 'AdminCustomerReadFacade' ||
          a.bindings?.filter(b => b.type === 'd1').length !== 1 || f.bindings?.filter(b => b.type === 'd1').length !== 1) throw new Error('Existing Worker binding mismatch');
    },
    async verifyLedger(t, migrations, complete) {
      for (const m of migrations) if (digest(readFileSync(`migrations-admin/${m.name}`)) !== m.sha256) throw new Error('Migration file changed');
      const exists = await query("SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'");
      const applied = exists.length ? await query('SELECT name FROM d1_migrations ORDER BY id') : [];
      const names = applied.map(row => row.name);
      if (names.some((n, i) => migrations[i]?.name !== n) || (complete && names.length !== migrations.length)) throw new Error('Admin migration ledger mismatch');
      if (complete) {
        const schema = await query("SELECT value FROM admin_config_metadata WHERE key='schema_version'");
        if (schema.length !== 1 || schema[0].value !== '3') throw new Error('Admin schema version mismatch');
        const actual = await query("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY type,name");
        if (digest(actual) !== digest(expectedSchema())) throw new Error('Actual Admin schema/trigger manifest mismatch');
        const health = await query('PRAGMA quick_check');
        const foreignKeys = await query('PRAGMA foreign_key_check');
        if (health.length !== 1 || Object.values(health[0])[0] !== 'ok' || foreignKeys.length) throw new Error('Admin integrity checks failed');
      }
    },
    async verifyExistingDatabaseIdentity(t, environment) {
      const exists = await query("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_database_identity'");
      if (exists.length) {
        const rows = await query("SELECT identity,environment FROM admin_database_identity WHERE id='authority'");
        if (rows.length && (rows[0].identity !== t.adminDatabaseId || rows[0].environment !== environment)) throw new Error('Existing Admin authority identity mismatch');
      }
    },
    async applyMigrations(t) {
      await checkWrite();
      wrangler('admin', ['d1', 'migrations', 'apply', t.adminDatabaseName, '--remote']);
    },
    async bindDatabaseIdentity(t, environment) {
      const existing = await query("SELECT identity,environment FROM admin_database_identity WHERE id='authority'");
      if (existing.length && (existing[0].identity !== t.adminDatabaseId || existing[0].environment !== environment)) throw new Error('Existing Admin authority identity mismatch');
      if (!existing.length) { await checkWrite(); await query("INSERT INTO admin_database_identity(id,identity,environment) VALUES('authority',?,?)", [t.adminDatabaseId, environment]); }
    },
    async verifyDatabaseIdentity(t, environment) {
      const rows = await query("SELECT identity,environment FROM admin_database_identity WHERE id='authority'");
      if (rows.length !== 1 || rows[0].identity !== t.adminDatabaseId || rows[0].environment !== environment) throw new Error('Admin authority identity mismatch');
    },
    async verifyConsoleDisabled(t) {
      const s = await settings(t.adminWorker);
      if (binding(s, 'ADMIN_CONSOLE_ENABLED', 'plain_text')?.text !== 'false' ||
          binding(s, 'ENVIRONMENT', 'plain_text')?.text !== context.environment ||
          binding(s, 'ADMIN_AUTH_MODE', 'plain_text')?.text !== 'cloudflare_access') throw new Error('Disabled Access-only console required');
    },
    async verifySecrets(t) {
      for (const worker of [t.adminWorker, t.facadeWorker]) {
        const s = await settings(worker);
        if (!binding(s, 'ADMIN_FACADE_HMAC_SECRET', 'secret_text') || (worker === t.adminWorker && !binding(s, 'ADMIN_AUDIT_HMAC_SECRET', 'secret_text'))) throw new Error('Operator-provisioned secrets missing');
      }
    },
    async deploy(worker) { await checkWrite(); wrangler(worker, ['deploy']); },
    async verifyDisabled(t, expectedSha) {
      const s = await settings(t.adminWorker);
      const text = n => binding(s, n, 'plain_text')?.text;
      if (text('ADMIN_CONSOLE_ENABLED') !== 'false' || text('GIT_COMMIT') !== expectedSha || text('ENVIRONMENT') !== context.environment) throw new Error('Disabled release metadata mismatch');
      for (const route of ['/admin', '/admin/login', '/api/admin/auth/me']) {
        const response = await fetcher(`https://${t.hostname}${route}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
        // Access may intercept before the disabled Worker; a redirect is only
        // accepted to the exact tenant's Access login path.
        const location = response.headers.get('location');
        const access = location ? new URL(location, `https://${t.hostname}`) : null;
        if (![401, 403, 404].includes(response.status) && !(response.status === 302 && access?.origin === t.issuer && access.pathname.startsWith('/cdn-cgi/access/login'))) throw new Error('Disabled/auth smoke failed');
        await response.body?.cancel();
      }
    },
    async captureRollback() {
      const versions = await provider.deploymentVersions();
      const s = await settings(target.adminWorker);
      const previousSha = binding(s, 'GIT_COMMIT', 'plain_text')?.text;
      if (!/^[a-f0-9]{40}$/.test(previousSha ?? '')) throw new Error('Reviewed disabled rollback baseline required');
      const baseline = { adminVersion: versions[target.adminWorker], facadeVersion: versions[target.facadeWorker], previousSha };
      await provider.verifyRollback(target, baseline);
      return baseline;
    },
    async restoreRollback(baseline) {
      await provider.verifyRollback(target, baseline);
      await provider.rollback('facade', baseline.facadeVersion);
      await provider.rollback('admin', baseline.adminVersion);
      await provider.verifyTargets(target);
      await provider.verifyDisabled(target, baseline.previousSha);
    },
    async verifyRollback(t, payload) {
      if (!/^[a-f0-9]{40}$/.test(payload.previousSha)) throw new Error('Exact rollback source required');
      try { command('git', ['merge-base', '--is-ancestor', payload.previousSha, context.sourceSha], { stdio: 'ignore' }); }
      catch { throw new Error('Rollback source is outside the reviewed ancestry'); }
      const runs = await gh(`/actions/workflows/admin-ci.yml/runs?head_sha=${payload.previousSha}&status=success&per_page=100`);
      if (!runs.workflow_runs?.some(r => r.head_sha === payload.previousSha && r.path === '.github/workflows/admin-ci.yml' && r.event === 'push' && r.status === 'completed' && r.conclusion === 'success' && r.repository?.id === 1385308553)) throw new Error('Rollback source lacks exact-SHA CI');
      await verifyVersion(t.adminWorker, payload.adminVersion, payload.previousSha, true);
      await verifyVersion(t.facadeWorker, payload.facadeVersion, payload.previousSha, false);
    },
    async rollback(worker, versionId) { await checkWrite(); wrangler(worker, ['versions', 'deploy', `${versionId}@100%`, '--yes']); },
    async verifyBootstrapRoster(_t, userIds, issuer) {
      const rows = await query("SELECT b.user_id,b.operator_id,b.access_iss FROM operator_identity_bindings b JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active' WHERE b.status='active' AND b.user_id IN (?,?,?)", userIds);
      if (rows.length !== 3 || new Set(rows.map(r => r.operator_id)).size !== 3 || rows.some(r => r.access_iss !== issuer)) throw new Error('Verified three-operator enrollment required');
    },
    async bootstrap(sql) { await checkWrite(); await query(sql); },
    async recoveryRoster() { return query("SELECT operator_id,status,recovery_key_algorithm,recovery_public_key FROM approved_human_operators WHERE status='active' AND recovery_key_algorithm='Ed25519' LIMIT 100"); },
    async recover(sql) { await checkWrite(); await query(sql); },
    async deploymentVersions() {
      const versions = {};
      for (const worker of [target.adminWorker, target.facadeWorker]) {
        const deployments = await cf(`/workers/scripts/${worker}/deployments`);
        const latest = deployments.deployments?.[0];
        if (!latest || latest.versions?.length !== 1 || latest.versions[0].percentage !== 100) throw new Error('Ambiguous deployed Worker version');
        versions[worker] = latest.versions[0].version_id;
      }
      return versions;
    },
  };
  return provider;
}
