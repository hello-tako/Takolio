import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { executeStagingTestIdentity } from './admin-staging-test-identities.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import { digest, renderConfigs, validateGitHub } from './admin-release-adapter.mjs';

const jsonc = file => JSON.parse(readFileSync(file, 'utf8').split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n'));
const versionIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

// HTTP origins and executable/arguments are fixed here; signed inputs never
// become SQL, command fragments, file paths, or network destinations.
export function createProvider(authorized, context, env = process.env, fetcher = fetch, command = execFileSync, wait = delay) {
  const { target } = authorized;
  const output = '.artifacts/admin-release';
  const request = async (origin, route, token, options = {}) => {
    if (!token) throw new Error('Required API credential is unavailable');
    let response;
    try {
      response = await fetcher(`${origin}${route}`, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers } });
    } catch {
      throw new Error(`${origin.includes('cloudflare') ? 'Cloudflare' : 'GitHub'} provider transport failed`);
    }
    if (!response.ok) throw new Error(`Release provider HTTP ${response.status}`);
    const value = await response.json();
    if (origin.includes('cloudflare') && value.success !== true) throw new Error('Cloudflare operation failed');
    return origin.includes('cloudflare') ? (options.pagination ? value : value.result) : value;
  };
  const publicSmoke = async route => {
    const transient = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT']);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fetcher(`https://${target.hostname}${route}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      } catch (error) {
        const code = error?.cause?.code ?? error?.code;
        if (!transient.has(code) || attempt === 2) {
          throw new Error(`Public Admin smoke transport failed (${transient.has(code) ? code : 'NON_RETRYABLE'})`);
        }
        await wait(attempt === 0 ? 1000 : 3000);
      }
    }
  };
  const gh = route => request('https://api.github.com', `/repos/hello-tako/Takolio${route}`, env.GH_TOKEN, { headers: { 'X-GitHub-Api-Version': '2022-11-28' } });
  const cf = (route, options) => request('https://api.cloudflare.com', `/client/v4/accounts/${target.accountId}${route}`, env.CLOUDFLARE_API_TOKEN, options);
  const cfList = async (route, singlePage = false) => {
    const rows = [];
    for (let page = 1; page <= 1000; page++) {
      const value = await request('https://api.cloudflare.com', `/client/v4${route}${singlePage ? '' : `${route.includes('?') ? '&' : '?'}per_page=50&page=${page}`}`,
        env.CLOUDFLARE_API_TOKEN, { pagination: true });
      if (!Array.isArray(value.result)) throw new Error('Incomplete provider inventory');
      rows.push(...value.result);
      const info = value.result_info;
      if (singlePage) {
        if (info?.total_pages > 1 || info?.total_count > rows.length) throw new Error('Truncated provider inventory');
        return rows;
      }
      if (info?.page !== undefined && info.page !== page) throw new Error('Invalid provider pagination');
      if (info?.total_pages !== undefined ? Number.isInteger(info.total_pages) && page >= info.total_pages : value.result.length < 50) return rows;
    }
    throw new Error('Provider inventory limit exceeded');
  };
  const query = async (sql, params = []) => {
    const result = await cf(`/d1/database/${target.adminDatabaseId}/query`, { method: 'POST', body: JSON.stringify({ sql, params }) });
    if (!Array.isArray(result) || result.length !== 1 || result[0].success !== true || !Array.isArray(result[0].results)) throw new Error('Invalid D1 result');
    return result[0].results;
  };
  const shutdown = {
    name: target.adminWorker, account_id: target.accountId, main: 'src/worker/admin-shutdown-worker.mjs', compatibility_date: '2026-10-01',
    workers_dev: false, preview_urls: false, routes: [{ pattern: target.hostname, custom_domain: true }],
    vars: { ENVIRONMENT: context.environment, ADMIN_CONSOLE_ENABLED: 'false', ADMIN_AUTH_MODE: 'cloudflare_access', GIT_COMMIT: context.sourceSha, ADMIN_SHUTDOWN: 'true' },
  };
  const configs = { shutdown, ...(context.operation === 'disable' ? {} : renderConfigs(target, context.environment, context.sourceSha, {
    admin: jsonc('wrangler.admin.jsonc'), facade: jsonc('wrangler.admin-facade.jsonc'),
  })) };
  for (const config of Object.values(configs)) {
    config.main = path.resolve(config.main);
    if (config.assets) config.assets.directory = path.resolve(config.assets.directory);
    for (const db of config.d1_databases ?? []) if (db.migrations_dir) db.migrations_dir = path.resolve(db.migrations_dir);
  }
  const configPath = worker => `${output}/${worker}.json`;
  const wrangler = (worker, args) => {
    mkdirSync(output, { recursive: true });
    writeFileSync(configPath(worker), JSON.stringify(configs[worker], null, 2) + '\n', { mode: 0o600 });
    // Never forward process output to a public receipt; provider metadata may be sensitive.
    try { return command('pnpm', ['exec', 'wrangler', ...args, '--config', configPath(worker)], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
      timeout: 600000, env: { ...env, CLOUDFLARE_ACCOUNT_ID: target.accountId, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { throw new Error('Fixed Wrangler operation failed; no provider output is published'); }
  };
  const binding = (s, n, type) => s.bindings?.find(b => b.name === n && b.type === type);
  // Cloudflare can leave /settings describing a newer upload after a version
  // rollback. Verify the version receiving 100% traffic and confirm its
  // deployment identity before inspecting bindings.
  const activeSettings = async worker => {
    const readDeployment = async () => {
      const result = await cf(`/workers/scripts/${worker}/deployments`);
      const deployments = result?.deployments;
      if (!Array.isArray(deployments) || deployments.length < 1) throw new Error('Active Worker deployment unavailable');
      const deployment = deployments[0];
      const versions = deployment.versions;
      if (!versionIdPattern.test(deployment.id ?? '') || !Array.isArray(versions) || versions.length !== 1 ||
          versions[0].percentage !== 100 || !versionIdPattern.test(versions[0].version_id ?? '')) {
        throw new Error('Active Worker traffic is ambiguous');
      }
      return { deploymentId: deployment.id, versionId: versions[0].version_id };
    };
    const selected = await readDeployment();
    const version = await cf(`/workers/scripts/${worker}/versions/${selected.versionId}`);
    if (version?.id !== selected.versionId || !Array.isArray(version.resources?.bindings)) throw new Error('Active Worker version metadata mismatch');
    const names = version.resources.bindings.map(b => b?.name);
    if (names.some(n => typeof n !== 'string' || !n) || new Set(names).size !== names.length) throw new Error('Active Worker bindings are ambiguous');
    const confirmed = await readDeployment();
    if (confirmed.deploymentId !== selected.deploymentId || confirmed.versionId !== selected.versionId) throw new Error('Active Worker deployment changed during verification');
    return { ...version.resources, versionId: version.id };
  };
  const verifySecretWriteTarget = async worker => {
    const active = await activeSettings(worker);
    const uploaded = await cf(`/workers/scripts/${worker}/settings`);
    // The secrets API updates the latest upload. Do not let a stale upload
    // replace a different serving configuration while provisioning secrets.
    const normalized = bindings => {
      if (!Array.isArray(bindings)) throw new Error('Secret write target metadata unavailable');
      return bindings.map(({ database_id: _databaseId, ...b }) => b).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    };
    if (digest(normalized(active.bindings)) !== digest(normalized(uploaded?.bindings))) throw new Error('Latest upload differs from active secret write target');
  };
  const verifyVersion = async (worker, versionId, previousSha, isAdmin) => {
    const v = await cf(`/workers/scripts/${worker}/versions/${versionId}`);
    const bindings = { bindings: v.resources?.bindings };
    const text = n => binding(bindings, n, 'plain_text')?.text;
    if (v.id !== versionId || text('ENVIRONMENT') !== context.environment || text('GIT_COMMIT') !== previousSha || text('ADMIN_SCHEMA_VERSION') !== '5' ||
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
    async verifyStagingArtifact(certificate) {
      const artifact = await gh(`/actions/artifacts/${certificate.artifactId}`);
      if (artifact.expired || artifact.digest !== `sha256:${certificate.artifactDigest}` || artifact.workflow_run?.head_sha !== context.sourceSha ||
          !artifact.name?.startsWith('admin-staging-certification-')) throw new Error('Staging evidence artifact mismatch');
      const run = await gh(`/actions/runs/${artifact.workflow_run.id}`);
      if (artifact.name !== `admin-staging-certification-${run.id}` || run.path !== '.github/workflows/admin-staging-deploy.yml' ||
          run.event !== 'workflow_dispatch' || run.run_attempt !== 1 || run.head_branch !== 'main' || run.status !== 'completed' ||
          run.head_sha !== context.sourceSha || run.conclusion !== 'success' || run.repository?.id !== 1422954151) throw new Error('Staging evidence run mismatch');
    },
    async verifyShutdownTarget(t) {
      const [domains, zone, s] = await Promise.all([
        cfList(`/accounts/${t.accountId}/workers/domains`, true),
        request('https://api.cloudflare.com', `/client/v4/zones/${t.zoneId}`, env.CLOUDFLARE_API_TOKEN), activeSettings(t.adminWorker),
      ]);
      if (zone.id !== t.zoneId || zone.account?.id !== t.accountId || !(t.hostname === zone.name || t.hostname.endsWith(`.${zone.name}`)) ||
          !domains.some(d => d.hostname === t.hostname && d.service === t.adminWorker && d.zone_id === t.zoneId) ||
          binding(s, 'ENVIRONMENT', 'plain_text')?.text !== context.environment) throw new Error('Exact shutdown target mapping required');
    },
    async shutdown() { await checkWrite(); wrangler('shutdown', ['deploy']); },
    async verifyResourceTargets(t) {
      const [adminDb, customerDb, kv, app, domains, zones] = await Promise.all([
        cf(`/d1/database/${t.adminDatabaseId}`), cf(`/d1/database/${t.customerDatabaseId}`),
        cfList(`/accounts/${t.accountId}/storage/kv/namespaces`), cf(`/access/apps/${t.accessApplicationId}`),
        cfList(`/accounts/${t.accountId}/workers/domains`, true), cfList(`/zones?account.id=${t.accountId}`),
      ]);
      if (adminDb.uuid !== t.adminDatabaseId || adminDb.name !== t.adminDatabaseName || customerDb.uuid !== t.customerDatabaseId ||
          customerDb.name !== t.customerDatabaseName || !kv.some(n => n.id === t.kvId) || app.id !== t.accessApplicationId || app.domain !== t.hostname ||
          app.aud !== t.audience || app.type !== 'self_hosted' || domains.some(d => d.service === t.facadeWorker || (d.service === t.adminWorker && d.hostname !== t.hostname)) ||
          !zones.some(z => z.id === t.zoneId) || zones.some(z => z.account?.id !== t.accountId)) throw new Error('Live target identity mismatch');
      for (const zone of zones) {
        const routes = await cfList(`/zones/${zone.id}/workers/routes`, true);
        if (routes.some(r => [t.facadeWorker, t.adminWorker].includes(r.script))) throw new Error('Admin or facade public route outside the dedicated custom-domain contract');
      }
      const account = await cf('/access/organizations');
      if (`https://${account.auth_domain}` !== t.issuer) throw new Error('Access issuer mismatch');
    },
    async verifyInitialTargets(t) {
      await provider.verifyResourceTargets(t);
      const workers = await cfList(`/accounts/${t.accountId}/workers/scripts`, true);
      const domains = await cfList(`/accounts/${t.accountId}/workers/domains`, true);
      const dns = await cfList(`/zones/${t.zoneId}/dns_records?name=${t.hostname}`);
      if (dns.length) throw new Error('Initialization requires an unused DNS hostname');
      if (workers.some(w => [t.adminWorker, t.facadeWorker].includes(w.id)) || domains.some(d => d.hostname === t.hostname)) {
        throw new Error('Initialization requires absent Admin Workers and an unused hostname');
      }
    },
    async verifyInitialRecoveryTargets(t) {
      if (context.operation !== 'restore-initial-disabled') throw new Error('Dedicated initial restoration operation required');
      await provider.verifyTargets(t, context.environment, true);
      await provider.verifyConsoleDisabled(t);
      const [a, f, subdomain] = await Promise.all([activeSettings(t.adminWorker), activeSettings(t.facadeWorker),
        cf(`/workers/scripts/${t.adminWorker}/subdomain`)]);
      const text = (s, n) => binding(s, n, 'plain_text')?.text;
      const containedSha = text(a, 'GIT_COMMIT');
      if (text(a, 'ADMIN_SHUTDOWN') !== 'true' || a.bindings?.some(b => b.type !== 'plain_text') ||
          f.bindings?.some(b => !['plain_text', 'd1'].includes(b.type)) || subdomain.enabled !== false || subdomain.previews_enabled !== false ||
          !/^[a-f0-9]{40}$/.test(containedSha ?? '') || ![containedSha, context.sourceSha].includes(text(f, 'GIT_COMMIT')) ||
          text(f, 'ADMIN_SCHEMA_VERSION') !== '5' || text(f, 'ENVIRONMENT') !== context.environment) {
        throw new Error('Unused exact-source initial containment required');
      }
      try { command('git', ['merge-base', '--is-ancestor', containedSha, context.sourceSha], { stdio: 'ignore' }); }
      catch { throw new Error('Initial containment source is outside reviewed ancestry'); }
      const runs = await gh(`/actions/workflows/admin-ci.yml/runs?head_sha=${containedSha}&status=success&per_page=100`);
      if (!runs.workflow_runs?.some(r => r.head_sha === containedSha && r.path === '.github/workflows/admin-ci.yml' &&
          r.event === 'push' && r.status === 'completed' && r.conclusion === 'success' && r.repository?.id === 1422954151)) {
        throw new Error('Initial containment source lacks exact-SHA CI');
      }
      const objects = await query("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT IN ('_cf_METADATA','sqlite_sequence')");
      const cloudflareKvSql = 'CREATETABLE_cf_KV(keyTEXTPRIMARYKEY,valueBLOB)WITHOUTROWID';
      if (objects.some(object => object.type !== 'table' || object.name !== '_cf_KV' || object.tbl_name !== '_cf_KV' ||
          typeof object.sql !== 'string' || object.sql.replace(/\s+/g, '') !== cloudflareKvSql)) {
        throw new Error('Initial restoration requires an unmigrated empty Admin database');
      }
    },
    async verifyTargets(t, _environment, allowShutdown = false) {
      await provider.verifyResourceTargets(t);
      await provider.verifyShutdownTarget(t);
      const facadeSubdomain = await cf(`/workers/scripts/${t.facadeWorker}/subdomain`);
      if (facadeSubdomain.enabled || facadeSubdomain.previews_enabled) throw new Error('Facade public subdomain enabled');
      // Existing binding identities must agree before a release can replace them.
      const [a, f] = await Promise.all([activeSettings(t.adminWorker), activeSettings(t.facadeWorker)]);
      const shutdown = allowShutdown && binding(a, 'ADMIN_SHUTDOWN', 'plain_text')?.text === 'true' &&
        binding(a, 'ADMIN_CONSOLE_ENABLED', 'plain_text')?.text === 'false' &&
        !a.bindings?.some(b => !['plain_text', 'secret_text'].includes(b.type));
      if ((!shutdown && (binding(a, 'ADMIN_DB', 'd1')?.id !== t.adminDatabaseId ||
          binding(a, 'CACHE', 'kv_namespace')?.namespace_id !== t.kvId ||
          binding(a, 'CUSTOMER_READ', 'service')?.service !== t.facadeWorker ||
          binding(a, 'CUSTOMER_READ', 'service')?.entrypoint !== 'AdminCustomerReadFacade' ||
          a.bindings?.filter(b => b.type === 'd1').length !== 1)) || binding(f, 'DB', 'd1')?.id !== t.customerDatabaseId || f.bindings?.filter(b => b.type === 'd1').length !== 1) throw new Error('Existing Worker binding mismatch');
    },
    async verifyLedger(t, migrations, complete) {
      for (const m of migrations) if (digest(readFileSync(`migrations-admin/${m.name}`)) !== m.sha256) throw new Error('Migration file changed');
      const exists = await query("SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'");
      const applied = exists.length ? await query('SELECT name FROM d1_migrations ORDER BY id') : [];
      const names = applied.map(row => row.name);
      if (names.some((n, i) => migrations[i]?.name !== n) || (complete && names.length !== migrations.length)) throw new Error('Admin migration ledger mismatch');
      if (complete) {
        const schema = await query("SELECT value FROM admin_config_metadata WHERE key='schema_version'");
        if (schema.length !== 1 || schema[0].value !== '5') throw new Error('Admin schema version mismatch');
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
      const s = await activeSettings(t.adminWorker);
      if (binding(s, 'ADMIN_CONSOLE_ENABLED', 'plain_text')?.text !== 'false' ||
          binding(s, 'ENVIRONMENT', 'plain_text')?.text !== context.environment ||
          binding(s, 'ADMIN_AUTH_MODE', 'plain_text')?.text !== 'cloudflare_access') throw new Error('Disabled Access-only console required');
    },
    async verifySecrets(t) {
      for (const worker of [t.adminWorker, t.facadeWorker]) {
        const s = await activeSettings(worker);
        if (!binding(s, 'ADMIN_FACADE_HMAC_SECRET', 'secret_text') || (worker === t.adminWorker && !binding(s, 'ADMIN_AUDIT_HMAC_SECRET', 'secret_text'))) throw new Error('Operator-provisioned secrets missing');
      }
    },
    async provisionHmac() {
      if (context.operation !== 'provision-hmac') throw new Error('Dedicated HMAC provisioning operation required');
      const assertUnused = async () => {
        const rows = await query(`SELECT
          (SELECT COUNT(*) FROM approved_human_operators) +
          (SELECT COUNT(*) FROM operator_identity_bindings) +
          (SELECT COUNT(*) FROM admin_owner_enrollments) +
          (SELECT COUNT(*) FROM admin_role_assignments) +
          (SELECT COUNT(*) FROM admin_local_credentials) +
          (SELECT COUNT(*) FROM admin_sessions) +
          (SELECT COUNT(*) FROM admin_audit_events) +
          (SELECT COUNT(*) FROM admin_bootstrap_ceremonies) +
          (SELECT COUNT(*) FROM admin_recovery_operations) +
          (SELECT COUNT(*) FROM admin_action_approvals) +
          (SELECT COUNT(*) FROM admin_config_metadata WHERE key IN ('bootstrap_completed_at','fixture_dataset')) AS n`);
        if (rows.length !== 1 || rows[0].n !== 0) throw new Error('HMAC provisioning requires unused Admin authority');
      };
      await provider.verifyTargets(target, context.environment);
      await provider.verifyConsoleDisabled(target);
      await assertUnused();
      // A fresh signed retry can replace partial initial provisioning, only
      // before authority/session/audit history exists. No values enter files/logs.
      const facade = randomBytes(32).toString('base64url');
      const audit = randomBytes(32).toString('base64url');
      for (const [worker, name, text] of [
        [target.facadeWorker, 'ADMIN_FACADE_HMAC_SECRET', facade],
        [target.adminWorker, 'ADMIN_FACADE_HMAC_SECRET', facade],
        [target.adminWorker, 'ADMIN_AUDIT_HMAC_SECRET', audit],
      ]) {
        await checkWrite();
        await provider.verifyTargets(target, context.environment);
        await provider.verifyConsoleDisabled(target);
        await assertUnused();
        await verifySecretWriteTarget(worker);
        const stored = await cf(`/workers/scripts/${worker}/secrets`, {
          method: 'PUT', body: JSON.stringify({ name, type: 'secret_text', text }),
        });
        if (stored?.name !== name || stored.type !== 'secret_text') throw new Error('HMAC secret metadata mismatch');
      }
    },
    async enrollOwner(manifest, signer) {
      if (!signer || !target.custodians.some(c => c.operatorId === signer.operatorId && c.publicKey === signer.publicKey)) throw new Error('Trusted owner signer required');
      const p = manifest.payload;
      await checkWrite();
      await query('INSERT INTO admin_owner_enrollments(id,user_id,operator_id,access_iss,access_sub,email,display_name,public_key,approval_ref,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
        [manifest.id, p.userId, signer.operatorId, target.issuer, p.subject, p.email, p.displayName, signer.publicKey, p.approvalRef, new Date().toISOString()]);
    },
    async stagingTestIdentity(manifest, signer) {
      await executeStagingTestIdentity({ manifest, signer, target, environment: context.environment, checkWrite, query, digest });
    },
    async verifyOwnerReady(t) {
      const rows = await query(`SELECT COUNT(*) AS n FROM admin_active_super_operators WHERE access_iss=?`, [t.issuer]);
      const marker = await query("SELECT value FROM admin_config_metadata WHERE key='bootstrap_completed_at'");
      if (Number(rows[0]?.n) < 1 || marker.length !== 1) throw new Error('Enrolled owner bootstrap required before enablement');
    },
    async enable() {
      await checkWrite();
      configs.admin.vars.ADMIN_CONSOLE_ENABLED = 'true';
      wrangler('admin', ['deploy']);
    },
    async verifyEnabled(t, expectedSha) {
      await provider.verifyOwnerReady(t);
      const [s, f] = await Promise.all([activeSettings(t.adminWorker), activeSettings(t.facadeWorker)]);
      if (binding(f, 'GIT_COMMIT', 'plain_text')?.text !== expectedSha || binding(f, 'ADMIN_SCHEMA_VERSION', 'plain_text')?.text !== '5' ||
          binding(s, 'ADMIN_SCHEMA_VERSION', 'plain_text')?.text !== '5' || binding(s, 'ADMIN_CONSOLE_ENABLED', 'plain_text')?.text !== 'true' ||
          binding(s, 'ADMIN_AUTH_MODE', 'plain_text')?.text !== 'cloudflare_access' ||
          binding(s, 'GIT_COMMIT', 'plain_text')?.text !== expectedSha) throw new Error('Enabled release metadata mismatch');
      for (const route of ['/admin/', '/api/v1/admin/me', '/admin/favicon.svg']) {
        const response = await publicSmoke(route);
        try {
          const location = response.headers.get('location');
          const access = location ? new URL(location, `https://${t.hostname}`) : null;
          if (response.status !== 302 || access?.origin !== t.issuer ||
              !(access.pathname === '/cdn-cgi/access/login' || access.pathname.startsWith('/cdn-cgi/access/login/'))) {
            throw new Error('Enabled Admin must still deny anonymous traffic through Access');
          }
        } finally { await response.body?.cancel(); }
      }
    },
    async deploy(worker) {
      if (context.operation === 'restore-initial-disabled') await provider.verifyInitialRecoveryTargets(target);
      await checkWrite();
      wrangler(worker, ['deploy']);
    },
    async verifyDisabled(t, expectedSha, shutdown = false) {
      await provider.verifyShutdownTarget(t);
      const s = await activeSettings(t.adminWorker);
      const text = n => binding(s, n, 'plain_text')?.text;
      if (text('ADMIN_CONSOLE_ENABLED') !== 'false' || text('GIT_COMMIT') !== expectedSha || text('ENVIRONMENT') !== context.environment ||
          (shutdown && (text('ADMIN_SHUTDOWN') !== 'true' || s.bindings?.some(b => !['plain_text', 'secret_text'].includes(b.type))))) throw new Error('Disabled release metadata mismatch');
      const routes = ['/admin', '/admin/login', '/api/v1/admin/me', '/admin/favicon.svg'];
      if (!shutdown) {
        const html = readFileSync('dist/admin/admin/index.html', 'utf8');
        const asset = /src="(\/admin\/assets\/[A-Za-z0-9_-]+\.js)"/.exec(html)?.[1];
        if (!asset) throw new Error('Protected built asset missing');
        routes.push(asset);
      }
      for (const route of routes) {
        const response = await publicSmoke(route);
        try {
          const location = response.headers.get('location');
          const access = location ? new URL(location, `https://${t.hostname}`) : null;
          const tenantDenied = response.status === 302 && access?.origin === t.issuer && (access.pathname === '/cdn-cgi/access/login' || access.pathname.startsWith('/cdn-cgi/access/login/'));
          const disabled = response.status === 404 && response.headers.get('x-admin-disabled') === 'true' &&
            response.headers.get('cache-control') === 'no-store' && await response.text() === 'Not Found';
          if (!disabled && !tenantDenied) throw new Error('Disabled/auth smoke failed');
        } finally { if (!response.bodyUsed) await response.body?.cancel(); }
      }
    },
    async captureRollback() {
      const s = await activeSettings(target.adminWorker);
      if (binding(s, 'ADMIN_SHUTDOWN', 'plain_text')?.text === 'true') {
        const sourceSha = binding(s, 'GIT_COMMIT', 'plain_text')?.text;
        await provider.verifyDisabled(target, sourceSha, true);
        return { shutdown: true };
      }
      const versions = await provider.deploymentVersions();
      const previousSha = binding(s, 'GIT_COMMIT', 'plain_text')?.text;
      if (!/^[a-f0-9]{40}$/.test(previousSha ?? '')) throw new Error('Reviewed disabled rollback baseline required');
      const baseline = { adminVersion: versions[target.adminWorker], facadeVersion: versions[target.facadeWorker], previousSha };
      await provider.verifyRollback(target, baseline);
      return baseline;
    },
    async restoreRollback(baseline) {
      if (baseline.shutdown) {
        await provider.shutdown();
        await provider.verifyDisabled(target, context.sourceSha, true);
        return;
      }
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
      if (!runs.workflow_runs?.some(r => r.head_sha === payload.previousSha && r.path === '.github/workflows/admin-ci.yml' && r.event === 'push' && r.status === 'completed' && r.conclusion === 'success' && r.repository?.id === 1422954151)) throw new Error('Rollback source lacks exact-SHA CI');
      await verifyVersion(t.adminWorker, payload.adminVersion, payload.previousSha, true);
      await verifyVersion(t.facadeWorker, payload.facadeVersion, payload.previousSha, false);
    },
    async rollback(worker, versionId) { await checkWrite(); wrangler(worker, ['versions', 'deploy', `${versionId}@100%`, '--yes']); },
    async verifyBootstrapRoster(_t, userIds, issuer) {
      const rows = await query("SELECT b.user_id,b.operator_id,b.access_iss FROM operator_identity_bindings b JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active' WHERE b.status='active' AND b.user_id IN (SELECT value FROM json_each(?))", [JSON.stringify(userIds)]);
      if (rows.length !== userIds.length || new Set(rows.map(r => r.operator_id)).size !== userIds.length || rows.some(r => r.access_iss !== issuer)) throw new Error('Verified owner enrollment required');
    },
    async bootstrap(sql) { await checkWrite(); await query(sql); },
    async recoveryRoster() { return query("SELECT operator_id,status,recovery_key_algorithm,recovery_public_key FROM approved_human_operators WHERE status='active' AND recovery_key_algorithm='Ed25519' LIMIT 100"); },
    async recover(sql) { await checkWrite(); await query(sql); },
    async deploymentVersions(workers = [target.adminWorker, target.facadeWorker]) {
      const versions = {};
      for (const worker of workers) {
        versions[worker] = (await activeSettings(worker)).versionId;
      }
      return versions;
    },
  };
  return provider;
}
