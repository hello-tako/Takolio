import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

export async function runBuiltPwaCompatibility({ root, browser, sourceHashes }) {
  const { expect } = await import('@playwright/test');
  const builtRoot = resolve(root, 'dist/client');
  const sw = await readFile(resolve(builtRoot, 'sw.js'), 'utf8');
  const sourceSw = await readFile(resolve(root, 'public/sw.js'), 'utf8');
  const buildId = sw.match(/^const BUILD_ID = '([^']+)';$/m)?.[1];
  assert(buildId && !sw.includes('__TAKOSAN_BUILD_ID__'));
  assert.equal(sourceSw.replaceAll('__TAKOSAN_BUILD_ID__', buildId), sw);
  const buildRecord = JSON.parse(await readFile(resolve(root, 'dist/composition-flags.json'), 'utf8'));
  const { verifyCompositionRelease, verifyPlannerPrerequisite } = await import(resolve(root, 'scripts/composition-flags.mjs'));
  const checks = [{ case: 'built_custom_SW_token_substitution', status: 'PASS', observedBuildId: buildId,
    immutableReleaseShaQualified: /^[a-f0-9]{40}$/.test(buildId) }];
  if (!['true', 'false'].includes(buildRecord.VITE_MEAL_COMPOSITION_V2_ENABLED)) {
    assert.throws(() => verifyCompositionRelease({ server: 'false', ui: 'false', manifest: { mealCompositionV2Enabled: false }, buildRecord }), /Built UI compiled/);
    checks.push({ case: 'missing_actual_build_flag_rejected_by_release_guard', status: 'PASS', buildRecord, releaseReadiness: 'REJECTED' });
  } else {
    const value = buildRecord.VITE_MEAL_COMPOSITION_V2_ENABLED;
    assert.equal(verifyCompositionRelease({ server: value, ui: value, manifest: { mealCompositionV2Enabled: value === 'true' }, buildRecord }), value);
    assert.throws(() => verifyCompositionRelease({ server: value, ui: value === 'true' ? 'false' : 'true', manifest: { mealCompositionV2Enabled: value === 'true' }, buildRecord }), /Composition flag mismatch/);
    if (value === 'true') verifyPlannerPrerequisite({ composition: value, server: 'true', buildRecord });
    checks.push({ case: 'actual_build_flag_pair_and_mismatch_guard', status: 'PASS', buildRecord });
  }
  const precacheMatch = sourceSw.match(/const STATIC_PRECACHE = \[([\s\S]*?)\];/);
  assert(precacheMatch);
  const precachePaths = [...precacheMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.equal(precachePaths.length, 13);
  const requests = [], externalAttempts = [], pwaErrors = [], syntheticAuthRequestShapes = [];
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    requests.push({ pathname, method: request.method });
    if (pathname === '/api/v1/config') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ turnstileSiteKey: 'synthetic-local-site-key', googleClientId: null })); return;
    }
    if (request.method === 'POST' && ['/api/v1/auth/register', '/api/v1/auth/resend-otp'].includes(pathname)) {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      syntheticAuthRequestShapes.push({ endpoint: pathname.endsWith('/register') ? 'register' : 'resend-otp', hasTurnstileToken: Object.hasOwn(body, 'turnstileToken') });
      const registration = pathname.endsWith('/register');
      response.writeHead(registration ? 503 : 200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(registration ? { error: 'Synthetic delivery unavailable', code: 'OTP_DELIVERY_UNAVAILABLE', accountCreated: true }
        : { success: true, message: 'Synthetic resend', expiresInMinutes: 10 })); return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
    if (pathname.startsWith('/api/')) { response.writeHead(503, { 'content-type': 'application/json' }); response.end('{"error":"Offline shell proof has no API"}'); return; }
    if (pathname === '/manifest.json') {
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(await readFile(resolve(builtRoot, 'manifest.json'))); return;
    }
    let file = resolve(builtRoot, '.' + decodeURIComponent(pathname));
    const local = relative(builtRoot, file);
    if (local.startsWith('..') || isAbsolute(local)) { response.writeHead(400); response.end(); return; }
    if (pathname === '/' || !pathname.split('/').at(-1).includes('.')) file = resolve(builtRoot, 'index.html');
    try {
      const bytes = await readFile(file); const suffix = '.' + file.split('.').at(-1);
      response.writeHead(200, { 'content-type': types[suffix] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(bytes);
    } catch {
      response.writeHead(404); response.end();
    }
  });
  await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const stopServer = async () => {
    if (!server.listening) return;
    await new Promise((resolveClose) => { server.close(resolveClose); server.closeAllConnections(); });
  };
  const context = await browser.newContext({ serviceWorkers: 'allow', reducedMotion: 'reduce' });
  await context.route((url) => url.origin !== base, (route) => { externalAttempts.push(new URL(route.request().url()).origin); return route.abort(); });
  await context.addInitScript(() => {
    window.__b08Turnstile = { renderCount: 0 };
    window.turnstile = { render(_element, options) {
      const count = ++window.__b08Turnstile.renderCount;
      queueMicrotask(() => options.callback(`synthetic-local-token-${count}`)); return `synthetic-widget-${count}`;
    }, remove() {}, reset() {} };
  });
  const page = await context.newPage(); page.on('pageerror', (error) => pwaErrors.push(error.message));
  try {
    await page.goto(base);
    await expect(page.locator('h1')).toHaveCount(1);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise((resolveController) => navigator.serviceWorker.addEventListener('controllerchange', resolveController, { once: true }));
      if (!registration.active) throw new Error('No active custom service worker');
    });
    const installed = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const names = await caches.keys();
      const entries = await Promise.all(names.map(async (name) => ({ name, paths: (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname).sort() })));
      return { scope: new URL(registration.scope).pathname, scriptPath: new URL(registration.active.scriptURL).pathname,
        scriptBuildId: new URL(registration.active.scriptURL).searchParams.get('v'), entries };
    });
    assert.equal(installed.scope, '/'); assert.equal(installed.scriptPath, '/sw.js'); assert.equal(installed.scriptBuildId, buildId);
    const releaseCache = installed.entries.find((entry) => entry.name === `takosan-pwa-${buildId}`);
    assert(releaseCache); for (const path of precachePaths) assert(releaseCache.paths.includes(path), path);
    checks.push({ case: 'actual_built_custom_SW_install_and_precache', status: 'PASS', cacheName: releaseCache.name,
      requiredPrecacheCount: precachePaths.length, allPrecachePresent: true, controllerActive: true });
    await page.goto(`${base}/auth?mode=register`);
    await page.waitForFunction(() => window.__b08Turnstile.renderCount === 1);
    await page.getByLabel('H\u1ecd v\u00e0 t\u00ean', { exact: true }).fill('Synthetic Production Router Probe');
    await page.getByLabel('Email', { exact: true }).fill('production-router-probe@example.test');
    await page.getByLabel('M\u1eadt kh\u1ea9u (t\u1ed1i thi\u1ec3u 6 k\u00fd t\u1ef1)', { exact: true }).fill('synthetic-local-only-password');
    await page.locator('form button[type="submit"]').click(); await page.waitForURL(`${base}/auth/verify`);
    const resend = page.getByRole('button', { name: 'G\u1eedi l\u1ea1i m\u00e3 OTP', exact: true });
    await expect(resend).toBeEnabled(); await resend.click();
    await expect(page.locator('main')).toContainText('Synthetic resend');
    assert.equal(await page.evaluate(() => window.__b08Turnstile.renderCount), 1);
    assert.deepEqual(syntheticAuthRequestShapes, [{ endpoint: 'register', hasTurnstileToken: true }, { endpoint: 'resend-otp', hasTurnstileToken: false }]);
    checks.push({ case: 'actual_built_app_auth_verify_transition_single_synthetic_Turnstile_render', status: 'PASS',
      providerWidgetRenderCount: 1, syntheticAuthRequestShapes, actualMailOrRegistrationRequestCount: 0 });
    await page.goto(`${base}/auth`); await expect(page.locator('h1')).toHaveText('\u0110\u0103ng nh\u1eadp v\u00e0o Takosan');
    const assets = await page.evaluate(() => [...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')]
      .map((element) => new URL(element.src || element.href).pathname).filter((path) => path.startsWith('/assets/')));
    await page.waitForFunction(async (paths) => {
      for (const path of paths) if (!await caches.match(path)) return false;
      return true;
    }, assets);
    await page.waitForLoadState('networkidle');
    await context.setOffline(true);
    await stopServer();
    const beforeOffline = requests.length;
    await page.goto(`${base}/auth`); await expect(page.locator('h1')).toHaveText('\u0110\u0103ng nh\u1eadp v\u00e0o Takosan');
    await page.reload(); await expect(page.locator('h1')).toHaveText('\u0110\u0103ng nh\u1eadp v\u00e0o Takosan');
    const offline = await page.evaluate(async () => {
      const favicon = await fetch('/takosan/rebuild/app-icons/favicon.svg');
      const manifest = await fetch('/manifest.json');
      return { controlled: Boolean(navigator.serviceWorker.controller), online: navigator.onLine,
        faviconStatus: favicon.status, faviconContainsSvg: (await favicon.text()).includes('<svg'),
        manifestStatus: manifest.status, manifestContainsIcons: Array.isArray((await manifest.json()).icons) };
    });
    assert.deepEqual(offline, { controlled: true, online: false, faviconStatus: 200, faviconContainsSvg: true, manifestStatus: 200, manifestContainsIcons: true });
    assert.equal(requests.length, beforeOffline);
    assert.deepEqual(pwaErrors, []);
    checks.push({ case: 'actual_built_offline_shell_reload_deeplink_and_precached_assets', status: 'PASS', offlinePath: '/auth',
      observedServerRequestsWhileOffline: 0, staticServerStoppedBeforeOfflineNavigation: true, metadata: offline, cachedEntryAssetCount: assets.length });
    return { checks, buildRecord, observedBuildId: buildId, precachePaths, externalOriginRequestsAborted: externalAttempts.length,
      sourceHashes: await sourceHashes(['public/sw.js', 'src/web/main.tsx', 'dist/client/sw.js', 'dist/client/index.html', 'dist/composition-flags.json', 'scripts/composition-flags.mjs']),
      limits: ['Local built app only; a local build ID and missing build flags remain rejected for release.',
        'Auth API and Turnstile responses are synthetic local fixtures; no real registration or email. Offline authenticated data and queued writes are separate scope.',
        'Built HTML external font/script references are blocked by the loopback browser policy.'] };
  } finally {
    await context.close(); await stopServer();
  }
}
