#!/usr/bin/env node
// Real workerd evidence (wrangler dev --local) for the Admin Console surface and
// customer-Worker isolation. Local only: telemetry off, no API token, throwaway
// config home (no stored OAuth login), every wrangler command is --local or --dry-run.
//
//   node scripts/admin-workerd-check.mjs [--out FILE]                         current tree
//   node scripts/admin-workerd-check.mjs --mode baseline --root DIR [--out]   pre-remediation reproduction
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { localWranglerEnv } from './admin-local-lib.mjs';

const argv = process.argv.slice(2);
const option = (name, fallback) => { const index = argv.indexOf(name); return index === -1 ? fallback : argv[index + 1]; };
const root = path.resolve(option('--root', process.cwd()));
const mode = option('--mode', 'current');
const out = option('--out', null);
const env = localWranglerEnv();
const work = mkdtempSync(path.join(tmpdir(), 'takosan-workerd-check-'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const jsonc = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8').split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n'));
let nextPort = 8811;

function writeConfig(name, config) {
  const file = path.join(work, `${name}.json`);
  writeFileSync(file, JSON.stringify(config, null, 2));
  return file;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { cwd: root, env, encoding: 'utf8', maxBuffer: 1 << 26, ...options });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

async function startWorker(configFile, persist) {
  const cfg = JSON.parse(readFileSync(configFile, 'utf8'));
  const service = cfg.services?.find((s) => s.binding === 'CUSTOMER_READ');
  const facade = service ? jsonc(service.service.endsWith('-local') ? 'wrangler.admin-facade-local.jsonc' : 'wrangler.admin-facade.jsonc') : null;
  const auxiliary = facade ? writeConfig(`facade-${nextPort}`, { ...facade, main: path.join(root, facade.main), d1_databases: facade.d1_databases.map((db) => ({...db, migrations_dir: path.join(root, db.migrations_dir)})) }) : null;
  const port = nextPort++;
  const child = spawn('pnpm', ['exec', 'wrangler', 'dev', '-c', configFile, ...(auxiliary ? ['-c', auxiliary] : []), '--local', '--ip', '127.0.0.1', '--port', String(port), '--persist-to', persist,
    '--show-interactive-dev-session=false'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = '';
  child.stdout.on('data', (chunk) => { log += chunk; });
  child.stderr.on('data', (chunk) => { log += chunk; });
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (child.exitCode !== null) break;
    try {
      await probe(`http://127.0.0.1:${port}`, '/__workerd_check_ready', { navigate: false });
      return { port, base: `http://127.0.0.1:${port}`, stop: () => stop(child), log: () => log };
    } catch {
      await sleep(500);
    }
  }
  stop(child);
  throw new Error(`wrangler dev did not start for ${configFile}:\n${log.slice(-4000)}`);
}

function stop(child) {
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
}

/** node:http so Host and Sec-Fetch-* headers are sent exactly as given. */
function probe(base, pathname, { navigate = true, headers = {}, method = 'GET', body } = {}) {
  const url = new URL(base);
  const finalHeaders = { ...(navigate ? { 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document', Accept: 'text/html' } : { Accept: '*/*' }), ...headers };
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: url.hostname, port: url.port, method, path: pathname, headers: finalHeaders, timeout: 15000 }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const csp = String(res.headers['content-security-policy'] ?? '');
        let json = null;
        try { json = JSON.parse(text); } catch { json = null; }
        resolve({
          method, path: pathname, navigate, status: res.statusCode, location: res.headers.location ?? null,
          body: text.includes('id="admin-root"') ? 'ADMIN_SHELL' : text.includes('id="root"') ? 'CUSTOMER_SHELL' : text.slice(0, 80).replace(/\s+/g, ' '),
          contentType: res.headers['content-type'] ?? null,
          csp: csp.includes('accounts.google.com') ? 'customer' : csp.includes("script-src 'self'") ? 'admin' : csp ? 'other' : 'none',
          cacheControl: res.headers['cache-control'] ?? null,
          disabledMarker: res.headers['x-admin-disabled'] ?? null,
          setCookie: [].concat(res.headers['set-cookie'] ?? []),
          cors: Object.keys(res.headers).filter((key) => key.startsWith('access-control-')),
          json,
        });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

const scenarios = [];
function record(name, checks) {
  const pass = checks.every((check) => check.pass);
  scenarios.push({ name, pass, checks });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name} (${checks.filter((c) => c.pass).length}/${checks.length})`);
  for (const check of checks.filter((c) => !c.pass)) console.log(`   ✗ ${check.label}: ${JSON.stringify(check.observed)}`);
}
const check = (label, pass, observed) => ({ label, pass: Boolean(pass), observed });

function adminFiles() {
  const dir = path.join(root, 'dist', 'admin', 'admin', 'assets');
  if (!existsSync(dir)) throw new Error('dist/admin is missing; run pnpm build first');
  const js = readdirSync(dir).filter((name) => name.endsWith('.js')).sort();
  return { js: js.find((name) => name.startsWith('admin-')) ?? js[0] };
}

function customerConfig(name, vars) {
  const customer = jsonc('wrangler.jsonc');
  // Bindings irrelevant to routing (AI, email, queues) are dropped so nothing can reach remote services.
  return writeConfig(name, { name: `review-${name}`, main: path.join(root, customer.main), compatibility_date: customer.compatibility_date,
    compatibility_flags: customer.compatibility_flags, assets: { ...customer.assets, directory: path.join(root, 'dist', 'client') },
    d1_databases: customer.d1_databases.map((db) => ({ ...db, migrations_dir: path.join(root, db.migrations_dir) })),
    kv_namespaces: customer.kv_namespaces, r2_buckets: customer.r2_buckets,
    vars: { ...customer.vars, ENVIRONMENT: 'development', APP_URL: 'http://127.0.0.1:8787', AI_ENABLED: 'false', AI_MOCK_MODE: 'true', SCAN_QUEUE_MODE: 'sync',
      JWT_SECRET: 'workerd-check-local-only-secret-0123456789abcdef', ...vars } });
}

function adminConfig(name, source, vars, { define } = {}) {
  const config = jsonc(source);
  const result = { ...config, name: `review-${name}`, main: path.join(root, config.main),
    assets: { ...config.assets, directory: path.join(root, 'dist', 'admin') },
    d1_databases: config.d1_databases.map((db) => ({ ...db, migrations_dir: path.join(root, db.migrations_dir) })), vars };
  delete result.$schema;
  delete result.observability;
  result.define = define ?? {__ADMIN_LOCAL_AUTH__:'false'};
  return writeConfig(name, result);
}

const ADMIN_PATHS = ['/', '/admin', '/admin/', '/admin/index.html', '/admin/users', '/admin/users/fx_user_001', '/admin/favicon.svg', '/%61dmin/', '/admin%2F', '//admin/',
  '/ADMIN/', '/api/v1/admin/auth/config', '/api/v1/admin/me'];

async function surfaceClosed(name, configFile, persist) {
  const worker = await startWorker(configFile, persist);
  try {
    const { js } = adminFiles();
    const checks = [];
    for (const pathname of [...ADMIN_PATHS, `/admin/assets/${js}`]) {
      for (const navigate of [true, false]) {
        const result = await probe(worker.base, pathname, { navigate });
        checks.push(check(`${navigate ? 'navigate' : 'fetch'} ${pathname} → 404, no admin content`, result.status === 404 && result.body !== 'ADMIN_SHELL' && !String(result.contentType).includes('javascript'), result));
      }
    }
    record(name, checks);
  } finally {
    worker.stop();
  }
}

async function main() {
  const head = run('git', ['rev-parse', 'HEAD']).stdout.trim();
  const wranglerVersion = run('pnpm', ['exec', 'wrangler', '--version']).stdout.trim().split('\n').at(-1);
  if (mode === 'baseline') {
    const persist = path.join(work, 'baseline-d1');
    const worker = await startWorker(customerConfig('baseline-customer-admin-disabled', { ADMIN_CONSOLE_ENABLED: 'false' }), persist);
    try {
      const nav = await probe(worker.base, '/admin/');
      const deep = await probe(worker.base, '/admin/users');
      const api = await probe(worker.base, '/api/v1/admin/auth/config', { navigate: false });
      record('baseline customer Worker with ADMIN_CONSOLE_ENABLED=false (expected to REPRODUCE S2)', [
        check('navigate /admin/ is answered by the asset layer with the admin shell (bypass reproduced)', nav.status === 200 && nav.body === 'ADMIN_SHELL', nav),
        check('the bypassed response carries the customer CSP, not the admin CSP', nav.csp === 'customer', nav),
        check('deep link reaches the Worker and is 404', deep.status === 404, deep),
        check('API is 404', api.status === 404, api),
      ]);
    } finally {
      worker.stop();
    }
  } else {
    const shutdownFile = writeConfig('shutdown', { name: 'review-admin-shutdown',
      main: path.join(root, 'src/worker/admin-shutdown-worker.mjs'), compatibility_date: '2026-10-01', workers_dev: false, preview_urls: false });
    const shutdown = await startWorker(shutdownFile, path.join(work, 'shutdown-no-d1'));
    try {
      const checks = [];
      const { js } = adminFiles();
      for (const method of ['GET', 'POST', 'OPTIONS']) for (const route of [...ADMIN_PATHS, `/admin/assets/${js}`]) {
        const response = await probe(shutdown.base, route, { method, navigate: false });
        checks.push(check(`${method} ${route} closed without bindings`, response.status === 404 && response.body === 'Not Found' &&
          response.disabledMarker === 'true' && response.cacheControl === 'no-store', response));
      }
      record('emergency shutdown has no D1, facade, secret, asset or auth dependencies', checks);
    } finally { shutdown.stop(); }
    const prodTemplate = jsonc('wrangler.admin.jsonc').vars;
    const localVars = jsonc('wrangler.admin-local.jsonc').vars;

    await surfaceClosed('admin Worker, production template (ADMIN_CONSOLE_ENABLED=false)', adminConfig('admin-disabled', 'wrangler.admin.jsonc', prodTemplate), path.join(work, 'd1-a'));
    const { ENVIRONMENT: _drop, ...noEnvironment } = localVars;
    await surfaceClosed('admin Worker, ENVIRONMENT missing (local build, console flag true)', adminConfig('admin-no-env', 'wrangler.admin-local.jsonc', noEnvironment, { define: { __ADMIN_LOCAL_AUTH__: 'true' } }), path.join(work, 'd1-b'));
    await surfaceClosed('admin Worker, ENVIRONMENT=development on a public origin', adminConfig('admin-dev-public', 'wrangler.admin-local.jsonc', { ...localVars, ADMIN_ORIGIN: 'https://admin.takosan.test' }, { define: { __ADMIN_LOCAL_AUTH__: 'true' } }), path.join(work, 'd1-c'));

    // Enabled local console against seeded local D1 (customer + admin databases).
    const persist = path.join(work, 'd1-enabled');
    const seeded = run(process.execPath, ['scripts/admin-local-d1.mjs', 'reset', '--yes', '--persist-to', persist]);
    if (seeded.status !== 0) throw new Error(`seeding failed: ${seeded.stderr || seeded.stdout}`);
    const port = nextPort;
    const enabledFile = adminConfig('admin-enabled', 'wrangler.admin-local.jsonc', { ...localVars, ADMIN_ORIGIN: `http://127.0.0.1:${port}` }, { define: { __ADMIN_LOCAL_AUTH__: 'true' } });
    const worker = await startWorker(enabledFile, persist);
    try {
      const origin = worker.base;
      const { js } = adminFiles();
      const shell = await probe(origin, '/admin/');
      const deep = await probe(origin, '/admin/users/fx_user_001');
      const index = await probe(origin, '/admin/index.html');
      const asset = await probe(origin, `/admin/assets/${js}`, { navigate: false });
      const customerAssetPath = await probe(origin, `/assets/${js}`, { navigate: false });
      const encoded = await probe(origin, `/admin/%61ssets/${js}`, { navigate: false });
      const traversal = await probe(origin, '/admin/assets/..%2F..%2Fadmin%2Findex.html', { navigate: false });
      const config = await probe(origin, '/api/v1/admin/auth/config', { navigate: false });
      const customerLogin = await probe(origin, '/api/v1/admin/auth/login', { navigate: false, method: 'POST', headers: { Origin: 'http://127.0.0.1:8787' }, body: { email: 'super@fixture.takosan.test', password: 'Local-Fixture-Only-2026!' } });
      const forgedHost = await probe(origin, '/admin/', { headers: { Host: `localhost:${port}` } });
      const login = await probe(origin, '/api/v1/admin/auth/login', { navigate: false, method: 'POST', headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin' }, body: { email: 'super@fixture.takosan.test', password: 'Local-Fixture-Only-2026!' } });
      const cookie = String(login.setCookie[0] ?? '').split(';')[0];
      const me = await probe(origin, '/api/v1/admin/me', { navigate: false, headers: { Cookie: cookie } });
      const csrf = me.json?.data?.csrfToken;
      const noCsrf = await probe(origin, '/api/v1/admin/preferences', { navigate: false, method: 'PUT', headers: { Cookie: cookie, Origin: origin }, body: { density: 'compact' } });
      const withCsrf = await probe(origin, '/api/v1/admin/preferences', { navigate: false, method: 'PUT', headers: { Cookie: cookie, Origin: origin, 'X-Admin-CSRF': csrf ?? '' }, body: { density: 'compact' } });
      const crossOriginMe = await probe(origin, '/api/v1/admin/me', { navigate: false, method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:8787', 'Access-Control-Request-Method': 'GET' } });
      record('admin Worker enabled on loopback (real workerd, run_worker_first)', [
        check('/admin/ → 200 admin shell with admin CSP and no-store', shell.status === 200 && shell.body === 'ADMIN_SHELL' && shell.csp === 'admin' && shell.cacheControl === 'no-store', shell),
        check('deep link → 200 admin shell with admin CSP', deep.status === 200 && deep.body === 'ADMIN_SHELL' && deep.csp === 'admin', deep),
        check('/admin/index.html → redirect to /admin/', [301, 302, 307, 308].includes(index.status) && String(index.location).endsWith('/admin/'), index),
        check('admin asset served through the Worker with no-store', asset.status === 200 && String(asset.contentType).includes('javascript') && asset.cacheControl === 'no-store', { ...asset, body: '[js]' }),
        check('customer-style /assets path is 404', customerAssetPath.status === 404, customerAssetPath),
        check('percent-encoded asset path is 404', encoded.status === 404, encoded),
        check('encoded traversal is 404', traversal.status === 404, traversal),
        check('auth config discloses only the mode', JSON.stringify(config.json) === JSON.stringify({ data: { mode: 'password' } }), config.json),
        check('login from the customer origin → 403', customerLogin.status === 403, customerLogin),
        check('forged Host header → 404', forgedHost.status === 404, forgedHost),
        check('same-origin login → 200 with one HttpOnly SameSite=Strict __Host- cookie', login.status === 200 && login.setCookie.length === 1 && /^__Host-takosan_admin_session=[0-9a-f]{64}; Path=\/; HttpOnly; Secure; SameSite=Strict/.test(login.setCookie[0]), { status: login.status, setCookie: login.setCookie.map((c) => c.replace(/=[0-9a-f]{64}/, '=<redacted>')) }),
        check('GET /me → 200 with a session-derived CSRF token', me.status === 200 && /^[0-9a-f]{64}$/.test(String(csrf)), { status: me.status }),
        check('mutation without CSRF → 403', noCsrf.status === 403 && noCsrf.json?.code === 'ADMIN_CSRF_FAILED', noCsrf.json),
        check('mutation with CSRF + exact Origin → 200', withCsrf.status === 200, { status: withCsrf.status }),
        check('no CORS headers for a cross-origin preflight', crossOriginMe.cors.length === 0, crossOriginMe.cors),
      ]);
      const { chromium } = await import('@playwright/test');
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.goto(`${origin}/admin/login`);
        await page.getByTestId('admin-login-email').fill('super@fixture.takosan.test');
        await page.getByTestId('admin-login-password').fill('Local-Fixture-Only-2026!');
        await page.getByTestId('admin-login-submit').click();
        await page.waitForURL((url) => !url.pathname.includes('/login'));
        const checks = [];
        for (const route of ['', 'users', 'users/fx_user_001', 'households', 'billing', 'ai', 'recipes', 'system', 'audit', 'settings']) {
          await page.goto(`${origin}/admin/${route}`);
          await page.getByTestId('admin-page-title').first().waitFor();
          await page.waitForLoadState('networkidle');
          checks.push(check(`browser ${route || 'overview'} has no error panel`, await page.getByTestId('admin-error-state').count() === 0, null));
        }
        if (out) await page.screenshot({ path: `${out}.png`, fullPage: true });
        record('real browser on multi-Worker workerd (synthetic fixture)', checks);
      } finally { await browser.close(); }
    } finally {
      worker.stop();
    }

    // Customer Worker built from the same tree: no admin routes, assets or bundle.
    const customer = await startWorker(customerConfig('customer-current', {}), path.join(work, 'd1-customer'));
    try {
      const { js } = adminFiles();
      const nav = await probe(customer.base, '/admin/');
      const deep = await probe(customer.base, '/admin/users');
      const api = await probe(customer.base, '/api/v1/admin/auth/config', { navigate: false });
      const asset = await probe(customer.base, `/admin/assets/${js}`, { navigate: false });
      const clientFiles = run('bash', ['-c', 'find dist/client -iname "*admin*" | head -5']).stdout.trim();
      record('customer Worker from the current tree has no admin surface', [
        check('navigate /admin/ → customer SPA shell, never the admin shell', nav.body !== 'ADMIN_SHELL', nav),
        check('navigate /admin/users → not the admin shell', deep.body !== 'ADMIN_SHELL', deep),
        check('/api/v1/admin/auth/config is not answered by admin code', !api.json?.data?.mode, api),
        check('admin bundle file is not served', !String(asset.contentType).includes('javascript'), { status: asset.status, contentType: asset.contentType }),
        check('dist/client contains no admin files', clientFiles === '', clientFiles),
      ]);
    } finally {
      customer.stop();
    }

    // Same-candidate flags-OFF recovery keeps the additive 0043 schema and its strict ledger.
    const recoveryToken = 'synthetic-local-recovery-token';
    const recoveryHash = createHash('sha256').update(recoveryToken).digest('hex');
    const recoverySql = `INSERT INTO sessions_v2(id,user_id,household_id,token_hash,expires_at)
      SELECT 'r2-recovery-session',u.id,hm.household_id,'${recoveryHash}','2099-01-01T00:00:00.000Z'
      FROM users u JOIN household_members hm ON hm.user_id=u.id WHERE u.id='fx_user_001' LIMIT 1;`;
    const sessionSeed = run('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'frigo-db', '--local', '-c', 'wrangler.admin-facade-local.jsonc', '--persist-to', persist, '--command', recoverySql], { env: { ...env, CI: 'true' } });
    if (sessionSeed.status !== 0) throw new Error('Local recovery session seed failed');
    const recovery = await startWorker(customerConfig('customer-flags-off', { MEAL_PLANNER_ENABLED: 'false', MEAL_COMPOSITION_V2_ENABLED: 'false' }), persist);
    try {
      const checks = [];
      for (const route of ['/api/v1/me', '/api/v1/inventory', '/api/v1/week/current']) {
        const response = await probe(recovery.base, route, { navigate: false, headers: { Cookie: `__Host-frigo_session=${recoveryToken}` } });
        checks.push(check(`flags-OFF recovery on additive 0043: ${route}`, response.status === 200, { status: response.status }));
      }
      record('current-main compatible application recovery with additive schema', checks);
    } finally { recovery.stop(); }

    const facadeCfg = jsonc('wrangler.admin-facade-local.jsonc');
    const facadeFile = writeConfig('facade-public-probe', { ...facadeCfg, main: path.join(root, facadeCfg.main), d1_databases: facadeCfg.d1_databases.map((db) => ({...db, migrations_dir: path.join(root, db.migrations_dir)})) });
    const publicFacade = await startWorker(facadeFile, persist);
    try {
      const checks = [];
      for (const method of ['GET', 'POST']) for (const route of ['/', '/rpc', '/api/v1/admin/users']) {
        const response = await probe(publicFacade.base, route, { method, navigate: false, body: method === 'POST' ? { op: 'healthCheck', input: {} } : undefined });
        checks.push(check(`${method} default facade ${route} refuses HTTP`, response.status === 404, { status: response.status }));
      }
      record('facade default entrypoint exposes no HTTP API', checks);
    } finally { publicFacade.stop(); }

    // Production artifact: the bundle built from the production template has no local-auth define.
    const bundles = {};
    for (const [label, file] of [['production', 'wrangler.admin.jsonc'], ['local', 'wrangler.admin-local.jsonc']]) {
      const outdir = path.join(work, `bundle-${label}`);
      const result = run('pnpm', ['exec', 'wrangler', 'deploy', '--dry-run', '--outdir', outdir, '-c', file]);
      const bundleFile = existsSync(outdir) ? readdirSync(outdir).find((name) => name.endsWith('.js')) : undefined;
      const source = bundleFile ? readFileSync(path.join(outdir, bundleFile), 'utf8') : '';
      bundles[label] = { exit: result.status, bundleFile: bundleFile ?? null, bytes: source.length,
        typeofGuardUnreplaced: source.includes('typeof __ADMIN_LOCAL_AUTH__'), identifierPresent: source.includes('__ADMIN_LOCAL_AUTH__'),
        containsFixturePassword: source.includes('Local-Fixture-Only-2026!'), containsLocalAuthority: source.includes('FROM admin_local_credentials'), log: (result.stderr || result.stdout).split('\n').filter((line) => /error|warn/i.test(line)).slice(0, 5) };
    }
    record('production admin bundle never compiles the local password login (wrangler deploy --dry-run, no upload)', [
      check('production dry-run bundle built', bundles.production.exit === 0 && bundles.production.bytes > 0, bundles.production),
      check('production bundle excludes the local password authority module', !bundles.production.containsLocalAuthority && !bundles.production.identifierPresent, bundles.production),
      check('local bundle has the define substituted', bundles.local.exit === 0 && !bundles.local.identifierPresent, bundles.local),
      check('no fixture credential in either bundle', !bundles.production.containsFixturePassword && !bundles.local.containsFixturePassword, null),
    ]);
  }
  const report = { generatedAt: new Date().toISOString(), mode, root, head, wranglerVersion,
    boundary: { WRANGLER_SEND_METRICS: env.WRANGLER_SEND_METRICS, cloudflareApiToken: env.CLOUDFLARE_API_TOKEN ? 'set' : 'empty', xdgConfigHome: 'throwaway temp dir (no OAuth login)', commands: 'wrangler dev --local, wrangler d1 --local, wrangler deploy --dry-run' },
    pass: scenarios.every((scenario) => scenario.pass), scenarios };
  if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`workerd-check ${mode}: ${report.pass ? 'PASS' : 'FAIL'} (${scenarios.filter((s) => s.pass).length}/${scenarios.length} scenarios)`);
  if (!report.pass && mode !== 'baseline') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => {
  rmSync(work, { recursive: true, force: true });
  rmSync(env.XDG_CONFIG_HOME, { recursive: true, force: true });
});
