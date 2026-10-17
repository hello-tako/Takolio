#!/usr/bin/env node
// Independent R1 certification probes under real workerd (wrangler dev --local).
// Run from the 0331cc9 worktree root after `pnpm build`:
//   node .hoplite/artifacts/r1-cert/workerd-probe.mjs <pre-admin-worktree> <out.json>
// Every negative scenario has a positive control that differs only in the variable under test.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const preRoot = process.argv[2];
const out = process.argv[3];
const work = mkdtempSync(path.join(tmpdir(), 'r1cert-workerd-'));
const xdg = path.join(work, 'xdg');
mkdirSync(xdg);
const wenv = { ...process.env, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_ACCOUNT_ID: '', XDG_CONFIG_HOME: xdg };
delete wenv.CI;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jsonc = (file) => JSON.parse(readFileSync(file, 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n'));
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
let port = 8841;
const results = [];
const scenarios = [];
let current = '';
const check = (label, pass, observed) => {
  results.push({ scenario: current, label, pass: Boolean(pass), observed });
  if (!pass) console.log(`  ✗ [${current}] ${label}: ${JSON.stringify(observed).slice(0, 400)}`);
};

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, env: wenv, encoding: 'utf8', maxBuffer: 1 << 26, ...opts });
  return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}
function writeCfg(name, cfg) {
  // Wrangler requires lowercase worker names.
  const safe = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const f = path.join(work, `${safe}.json`);
  writeFileSync(f, JSON.stringify({ ...cfg, name: `r1c-${safe}` }));
  return f;
}
function adminCfg(name, vars, extra = {}) {
  const b = jsonc(path.join(root, 'wrangler.admin.jsonc'));
  return writeCfg(name, { name: `r1c-${name}`, main: path.join(root, b.main), compatibility_date: b.compatibility_date, compatibility_flags: b.compatibility_flags,
    workers_dev: false, assets: { ...b.assets, directory: path.join(root, 'dist/admin') },
    d1_databases: b.d1_databases.map((d) => ({ ...d, migrations_dir: path.join(root, d.migrations_dir) })), kv_namespaces: b.kv_namespaces, vars, ...extra });
}
function customerCfg(name, wt) {
  const c = jsonc(path.join(wt, 'wrangler.jsonc'));
  return writeCfg(name, { name: `r1c-${name}`, main: path.join(wt, c.main), compatibility_date: c.compatibility_date, compatibility_flags: c.compatibility_flags,
    assets: { ...c.assets, directory: path.join(wt, 'dist/client') }, d1_databases: c.d1_databases.map((d) => ({ ...d, migrations_dir: path.join(wt, d.migrations_dir) })),
    kv_namespaces: c.kv_namespaces, r2_buckets: c.r2_buckets,
    vars: { ...c.vars, ENVIRONMENT: 'development', APP_URL: 'http://127.0.0.1:8787', AI_ENABLED: 'false', AI_MOCK_MODE: 'true', SCAN_QUEUE_MODE: 'sync', JWT_SECRET: 'r1cert-local-only-secret-0123456789abcdefgh' } });
}

function probe(base, pathname, { navigate = true, method = 'GET', headers = {}, body } = {}) {
  const u = new URL(base);
  const h = { ...(navigate ? { 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document', Accept: 'text/html' } : { Accept: '*/*' }), ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: u.hostname, port: u.port, method, path: pathname, headers: h, timeout: 20000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { json = null; }
        const ct = String(res.headers['content-type'] ?? '');
        const csp = String(res.headers['content-security-policy'] ?? '');
        resolve({ method, path: pathname, status: res.statusCode, ct, adminShell: text.includes('id="admin-root"'), customerShell: text.includes('id="root"'),
          adminBytes: text.includes('id="admin-root"') || /javascript|text\/css|font\/|image\/svg/.test(ct), bodyHash: sha(buf),
          csp: csp.includes('accounts.google.com') ? 'customer' : csp.includes("script-src 'self'") ? 'admin' : csp ? 'other' : 'none', cspRaw: csp,
          hsts: res.headers['strict-transport-security'] ?? null, cache: res.headers['cache-control'] ?? null, location: res.headers.location ?? null,
          setCookie: [].concat(res.headers['set-cookie'] ?? []), cors: Object.keys(res.headers).filter((k) => k.startsWith('access-control-')), json, text: text.slice(0, 100) });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

async function start(cfg, persist, extraArgs = [], cwd = root, attempt = 0) {
  try {
    return await startOnce(cfg, persist, extraArgs, cwd);
  } catch (error) {
    if (attempt >= 1) throw error;
    await sleep(2000);
    return start(cfg, persist, extraArgs, cwd, attempt + 1);
  }
}

async function startOnce(cfg, persist, extraArgs = [], cwd = root) {
  const p = port++;
  const child = spawn('pnpm', ['exec', 'wrangler', 'dev', '-c', cfg, '--local', '--ip', '127.0.0.1', '--port', String(p), '--persist-to', persist,
    '--show-interactive-dev-session=false', '--inspector-port', String(p + 1000), ...extraArgs], { cwd, env: wenv, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 240; i += 1) {
    if (child.exitCode !== null) break;
    try {
      await probe(`http://127.0.0.1:${p}`, '/__r1c_ready', { navigate: false });
      return { base: `http://127.0.0.1:${p}`, port: p, stop: async () => { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ } await sleep(800); }, log: () => log };
    } catch {
      await sleep(500);
    }
  }
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ }
  throw new Error(`wrangler dev failed (${cfg}): ${log.slice(-2500)}`);
}

function migrate(cfg, persist) {
  for (const db of ['frigo-db', 'takosan-admin-db']) {
    const r = run('pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', db, '--local', '--persist-to', persist, '-c', cfg], { env: { ...wenv, CI: 'true' } });
    if (r.status !== 0) throw new Error(`migrate ${db}: ${r.out.slice(-1500)}`);
  }
}
function execSql(cfg, persist, db, sql) {
  const r = run('pnpm', ['exec', 'wrangler', 'd1', 'execute', db, '--local', '--persist-to', persist, '-c', cfg, '--command', sql], { env: { ...wenv, CI: 'true' } });
  if (r.status !== 0) throw new Error(`exec: ${r.out.slice(-800)}`);
}

const assetsDir = path.join(root, 'dist/admin/admin/assets');
const assetFiles = readdirSync(assetsDir);
const js = assetFiles.find((f) => f.endsWith('.js'));
const css = assetFiles.find((f) => f.endsWith('.css'));
const CORPUS = ['/', '/admin', '/admin/', '/admin/index.html', '/admin/users', '/admin/users/fx_user_001', '/admin/settings/', '/admin/favicon.svg', '/admin/fonts/OFL.txt',
  `/admin/assets/${js}`, `/admin/assets/${js}?v=1`, `/admin/assets/${css}`, '/admin/./', '/admin/%2e/', '/%61dmin/', '/admin%2Findex.html', '//admin/', '/ADMIN/',
  '/admin/assets/..%2findex.html', '/api/v1/admin/auth/config', '/api/v1/admin/me', '/sw.js', '/index.html'];

async function expectClosed() {
  for (const p of CORPUS) {
    for (const mode of ['navigate', 'fetch', 'HEAD', 'OPTIONS']) {
      const r = await probe(base, p, { navigate: mode === 'navigate', method: mode === 'HEAD' ? 'HEAD' : mode === 'OPTIONS' ? 'OPTIONS' : 'GET',
        headers: mode === 'OPTIONS' ? { Origin: 'https://app.takosan.test', 'Access-Control-Request-Method': 'GET' } : {} });
      check(`${mode} ${p} → 404, no admin bytes, no CORS`, r.status === 404 && !r.adminBytes && r.cors.length === 0, { status: r.status, ct: r.ct, cors: r.cors });
    }
  }
  const login = await probe(base, '/api/v1/admin/auth/login', { navigate: false, method: 'POST', headers: { Origin: 'https://admin.takosan.test' }, body: { email: 'super@fixture.takosan.test', password: 'x' } });
  check('POST login → 404', login.status === 404, { status: login.status });
}

let base = '';
async function scenario(name, cfg, persist, args, body) {
  current = name;
  const before = results.length;
  const w = await start(cfg, persist, args);
  base = w.base;
  try { await body(w); } finally { await w.stop(); }
  const mine = results.slice(before);
  scenarios.push({ name, checks: mine.length, failed: mine.filter((r) => !r.pass).length });
  console.log(`${mine.every((r) => r.pass) ? 'PASS' : 'FAIL'} ${name} (${mine.filter((r) => r.pass).length}/${mine.length})`);
}

const PROD = { ENVIRONMENT: 'production', ADMIN_CONSOLE_ENABLED: 'true', ADMIN_AUTH_MODE: 'cloudflare_access', ADMIN_ORIGIN: 'https://admin.takosan.test',
  CUSTOMER_APP_URL: 'https://app.takosan.test', ADMIN_ACCESS_TEAM_DOMAIN: 'takosan.cloudflareaccess.com', ADMIN_ACCESS_AUD: 'a'.repeat(32) };
const UPSTREAM = ['--local-upstream', 'admin.takosan.test', '--upstream-protocol', 'https'];
const ADMIN = 'https://admin.takosan.test';

try {
  const prodPersist = path.join(work, 'd1-prod');
  migrate(adminCfg('migrate', PROD), prodPersist);

  await scenario('POSITIVE production split host, Access configured (local-upstream https://admin.takosan.test)', adminCfg('prod-valid', PROD), prodPersist, UPSTREAM, async () => {
    const shell = await probe(base, '/admin/');
    check('/admin/ → 200 admin shell, admin CSP with upgrade-insecure-requests, HSTS, no-store', shell.status === 200 && shell.adminShell && shell.csp === 'admin'
      && shell.cspRaw.includes('upgrade-insecure-requests') && Boolean(shell.hsts) && shell.cache === 'no-store', shell);
    const deep = await probe(base, '/admin/users/fx_user_001');
    check('deep link → 200 admin shell', deep.status === 200 && deep.adminShell, { status: deep.status });
    const asset = await probe(base, `/admin/assets/${js}`, { navigate: false });
    check('admin asset → 200 javascript, no-store', asset.status === 200 && /javascript/.test(asset.ct) && asset.cache === 'no-store', { status: asset.status, ct: asset.ct, cache: asset.cache });
    const cfg = await probe(base, '/api/v1/admin/auth/config', { navigate: false });
    check('auth config → {mode: cloudflare_access} only', JSON.stringify(cfg.json) === JSON.stringify({ data: { mode: 'cloudflare_access' } }), cfg.json);
    const noAssertion = await probe(base, '/api/v1/admin/auth/login', { navigate: false, method: 'POST', headers: { Origin: ADMIN } });
    check('same-origin login without Access assertion → 401 ADMIN_ACCESS_DENIED', noAssertion.status === 401 && noAssertion.json?.code === 'ADMIN_ACCESS_DENIED', noAssertion.json);
    const customer = await probe(base, '/api/v1/admin/auth/login', { navigate: false, method: 'POST', headers: { Origin: 'https://app.takosan.test' } });
    check('login from the customer origin → 403', customer.status === 403, customer.json);
    const me = await probe(base, '/api/v1/admin/me', { navigate: false });
    check('/me without session → 401', me.status === 401, me.json);
    const pre = await probe(base, '/api/v1/admin/me', { navigate: false, method: 'OPTIONS', headers: { Origin: 'https://app.takosan.test', 'Access-Control-Request-Method': 'PUT' } });
    check('credentialed cross-origin preflight → no Access-Control-* headers', pre.cors.length === 0, pre.cors);
    check('no Set-Cookie on unauthenticated responses', [shell, cfg, noAssertion, me].every((r) => r.setCookie.length === 0), null);
    execSql(adminCfg('fixture', PROD), prodPersist, 'takosan-admin-db', "INSERT INTO admin_config_metadata (key, value) VALUES ('fixture_dataset', 'synthetic-admin-v1')");
    const fixture = await probe(base, '/api/v1/admin/auth/config', { navigate: false });
    check('fixture-marked ADMIN_DB in production → 503 ADMIN_FIXTURE_DATA_REJECTED', fixture.status === 503 && fixture.json?.code === 'ADMIN_FIXTURE_DATA_REJECTED', fixture.json);
    execSql(adminCfg('fixture2', PROD), prodPersist, 'takosan-admin-db', "DELETE FROM admin_config_metadata WHERE key = 'fixture_dataset'");
    const again = await probe(base, '/api/v1/admin/auth/config', { navigate: false });
    check('marker removed → 200 again', again.status === 200, again.json);
  });

  await scenario('NEGATIVE production, ADMIN_ACCESS_AUD empty', adminCfg('prod-no-aud', { ...PROD, ADMIN_ACCESS_AUD: '' }), prodPersist, UPSTREAM, async () => {
    const shell = await probe(base, '/admin/');
    check('surface stays on (shell 200) but auth is unavailable', shell.status === 200 && shell.adminShell, { status: shell.status });
    const cfg = await probe(base, '/api/v1/admin/auth/config', { navigate: false });
    check('auth config → {mode: unavailable}', JSON.stringify(cfg.json) === JSON.stringify({ data: { mode: 'unavailable' } }), cfg.json);
    const login = await probe(base, '/api/v1/admin/auth/login', { navigate: false, method: 'POST', headers: { Origin: ADMIN } });
    check('login → 503 ADMIN_AUTH_NOT_CONFIGURED', login.status === 503 && login.json?.code === 'ADMIN_AUTH_NOT_CONFIGURED', login.json);
    const me = await probe(base, '/api/v1/admin/me', { navigate: false });
    check('/me → 503 ADMIN_AUTH_NOT_CONFIGURED', me.status === 503 && me.json?.code === 'ADMIN_AUTH_NOT_CONFIGURED', me.json);
  });

  for (const [label, value] of [['"Production"', 'Production'], ['"prod"', 'prod'], ['" production"', ' production'], ['"PRODUCTION"', 'PRODUCTION'], ['empty string', ''], ['missing', null]]) {
    const vars = { ...PROD, ENVIRONMENT: value };
    if (value === null) delete vars.ENVIRONMENT;
    await scenario(`NEGATIVE ENVIRONMENT ${label} (otherwise identical to POSITIVE)`, adminCfg(`env-${sha(label)}`, vars), prodPersist, UPSTREAM, expectClosed);
  }
  for (const value of ['false', 'TRUE', '1']) {
    await scenario(`NEGATIVE ADMIN_CONSOLE_ENABLED="${value}" (otherwise identical to POSITIVE)`, adminCfg(`flag-${value}`, { ...PROD, ADMIN_CONSOLE_ENABLED: value }), prodPersist, UPSTREAM, expectClosed);
  }
  await scenario('NEGATIVE admin host equals customer host', adminCfg('shared-host', { ...PROD, CUSTOMER_APP_URL: ADMIN }), prodPersist, UPSTREAM, expectClosed);
  await scenario('NEGATIVE literal wrangler.admin.jsonc template vars', adminCfg('template', jsonc(path.join(root, 'wrangler.admin.jsonc')).vars), prodPersist, UPSTREAM, expectClosed);
  await scenario('NEGATIVE request for a different host than ADMIN_ORIGIN (no upstream rewrite)', adminCfg('foreign-host', PROD), prodPersist, [], expectClosed);

  // Local enabled console + real browser session under workerd.
  const localPersist = path.join(work, 'd1-local');
  const seeded = run(process.execPath, ['scripts/admin-local-d1.mjs', 'reset', '--yes', '--persist-to', localPersist]);
  if (seeded.status !== 0) throw new Error(`seed failed: ${seeded.out.slice(-1500)}`);
  const localVars = jsonc(path.join(root, 'wrangler.admin-local.jsonc')).vars;
  const p = port;
  port = p;
  await scenario('POSITIVE local console in a real browser (workerd, password, fixture)', adminCfg('local', { ...localVars, ADMIN_ORIGIN: `http://127.0.0.1:${p}` }, { define: { __ADMIN_LOCAL_AUTH__: 'true' } }), localPersist, [], async () => {
    const { chromium } = await import(path.join(root, 'node_modules/@playwright/test/index.mjs'));
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      const page = await context.newPage();
      const errors = [];
      const serverErrors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !/401 \(Unauthorized\)/.test(m.text())) errors.push(m.text()); });
      page.on('response', (r) => { if (r.url().includes('/api/v1/admin/') && r.status() >= 500) serverErrors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
      await page.goto(`${base}/admin/login`);
      await page.getByTestId('admin-login-email').fill('super@fixture.takosan.test');
      await page.getByTestId('admin-login-password').fill('Local-Fixture-Only-2026!');
      await page.getByTestId('admin-login-submit').click();
      await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
      for (const [name, route] of [['overview', '/admin/'], ['users', '/admin/users'], ['user-detail', '/admin/users/fx_user_001'], ['households', '/admin/households'],
        ['billing', '/admin/billing'], ['ai', '/admin/ai'], ['recipes', '/admin/recipes'], ['system', '/admin/system'], ['audit', '/admin/audit'], ['settings', '/admin/settings']]) {
        await page.goto(`${base}${route}`);
        await page.getByTestId('admin-page-title').first().waitFor({ timeout: 15000 });
        await page.waitForLoadState('networkidle');
        check(`${name} renders under workerd with the synthetic-data banner`, (await page.getByTestId('admin-fixture-banner').count()) > 0 && !(await page.getByTestId('admin-error-state').count()), null);
      }
      const cookies = await context.cookies();
      const adminCookies = cookies.filter((c) => c.name.includes('takosan_admin'));
      check('exactly one admin cookie: __Host- HttpOnly Secure SameSite=Strict, host-only', adminCookies.length === 1 && adminCookies[0].name === '__Host-takosan_admin_session'
        && adminCookies[0].httpOnly && adminCookies[0].secure && adminCookies[0].sameSite === 'Strict' && !adminCookies[0].domain.startsWith('.'), adminCookies.map((c) => ({ ...c, value: '<redacted>' })));
      check('document.cookie exposes no admin cookie', !(await page.evaluate(() => document.cookie)).includes('takosan_admin'), null);
      const userMenu = page.getByTestId('admin-user-menu');
      if (await userMenu.isVisible()) await userMenu.click();
      await page.getByTestId('admin-logout').click();
      await page.waitForURL(/\/admin\/login/, { timeout: 15000 });
      check('after logout /api/v1/admin/me → 401', (await page.request.get(`${base}/api/v1/admin/me`)).status() === 401, null);
      check('no uncaught page errors or console errors', errors.length === 0, errors.slice(0, 5));
      check('no 5xx from the admin API', serverErrors.length === 0, serverErrors);
    } finally {
      await browser.close();
    }
  });

  // Customer Worker: R1 tree vs pre-admin baseline, same config, same requests.
  if (preRoot) {
    const corpus = ['/', '/admin/', '/admin/users', '/admin/assets/x.js', '/api/v1/health', '/api/v1/admin/me', '/api/v1/admin/auth/config', '/api/v1/me', '/sw.js', '/manifest.json', '/index.html'];
    const snapshot = async () => {
      const rows = [];
      for (const pth of corpus) {
        for (const navigate of [true, false]) {
          const r = await probe(base, pth, { navigate });
          rows.push({ key: `${navigate ? 'nav' : 'fetch'} ${pth}`, status: r.status, ct: r.ct, csp: r.cspRaw, cache: r.cache, adminShell: r.adminShell,
            body: pth === '/api/v1/health' ? Object.keys(r.json ?? {}).join(',') : r.bodyHash });
        }
      }
      return rows;
    };
    let srcRows = [];
    let preRows = [];
    await scenario('CUSTOMER worker, R1 tree', customerCfg('cust-src', root), path.join(work, 'd1-cust-src'), [], async () => { srcRows = await snapshot(); });
    current = 'CUSTOMER worker, pre-admin 186a9cf';
    const wPre = await start(customerCfg('cust-pre', preRoot), path.join(work, 'd1-cust-pre'), [], preRoot);
    base = wPre.base;
    try { preRows = await snapshot(); } finally { await wPre.stop(); }
    current = 'CUSTOMER comparison';
    const before = results.length;
    for (let i = 0; i < srcRows.length; i += 1) {
      check(`${srcRows[i].key}: identical status/content-type/CSP/cache/body`, JSON.stringify(srcRows[i]) === JSON.stringify(preRows[i]), { src: srcRows[i], pre: preRows[i] });
    }
    check('customer worker never serves the admin shell', srcRows.every((r) => !r.adminShell), null);
    const mine = results.slice(before);
    scenarios.push({ name: current, checks: mine.length, failed: mine.filter((r) => !r.pass).length });
    console.log(`${mine.every((r) => r.pass) ? 'PASS' : 'FAIL'} ${current} (${mine.filter((r) => r.pass).length}/${mine.length})`);
  }
} catch (error) {
  results.push({ scenario: current, label: 'execution', pass: false, observed: String(error).slice(0, 2000) });
  console.log(`ERROR in ${current}: ${String(error).slice(0, 2000)}`);
} finally {
  const summary = { generatedAt: new Date().toISOString(), head: run('git', ['rev-parse', 'HEAD']).out.trim(), wrangler: run('pnpm', ['exec', 'wrangler', '--version']).out.trim().split('\n').at(-1),
    boundary: { WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_API_TOKEN: 'empty', XDG_CONFIG_HOME: 'throwaway', network: 'local workerd only; upstream rewrite only (no outbound fetch)' },
    totals: { checks: results.length, failed: results.filter((r) => !r.pass).length }, scenarios, results };
  if (out) writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`workerd-probe: ${summary.totals.failed === 0 ? 'PASS' : 'FAIL'} ${summary.totals.checks - summary.totals.failed}/${summary.totals.checks}`);
  rmSync(work, { recursive: true, force: true });
  if (summary.totals.failed) process.exitCode = 1;
}
