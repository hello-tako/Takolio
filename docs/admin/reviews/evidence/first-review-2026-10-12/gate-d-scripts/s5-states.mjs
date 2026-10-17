import { BASE, OUT, EMAIL, PASSWORD, resetDb, launch, newContext, instrument, writeResult, login, pageApi } from './lib.mjs';
const out = { loading: [], error: [], session: {}, rate: {}, notConfigured: {}, loginConfig: {} };
const settle = (page) => page.waitForLoadState('networkidle').catch(() => {}).then(() => page.waitForTimeout(300));
const json = (status, code, error = 'Lỗi giả lập (fixture)') => ({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ error, code }) });
const pathOf = (u) => new URL(u).pathname;

await resetDb();
const browser = await launch();
const ctx = await newContext(browser);
const page = await ctx.newPage();
const rec = instrument(page);
await login(page, EMAIL('super'));
await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
await settle(page);

// 1) Loading skeletons: delay every admin data call 3s (not /me), screenshot during the delay.
const LOAD = [
  ['overview', '/admin/', '[data-testid^="admin-metric-"]'], ['users', '/admin/users', '[data-testid="admin-user-row"]'],
  ['billing', '/admin/billing', '[data-testid="admin-transaction-row"]'], ['recipe-detail', '/admin/recipes/imp-c6e706b483805e44', '[data-testid="admin-recipe-detail"]'],
  ['settings', '/admin/settings', '[data-testid="admin-preferences-form"]'],
];
await page.route(/\/api\/v1\/admin\//, async (route) => {
  if (pathOf(route.request().url()).endsWith('/me')) return route.continue();
  await new Promise((r) => setTimeout(r, 3000));
  return route.continue();
});
for (const [id, path, marker] of LOAD) {
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(900);
  const skeleton = await page.locator('.state-loading, [aria-busy="true"]').count();
  const shellVisible = await page.getByTestId('admin-nav-overview').count();
  await page.screenshot({ path: `${OUT}/screens/state-loading-${id}.png`, fullPage: true });
  const loadedAfter = await page.waitForSelector(marker, { timeout: 15000 }).then(() => true).catch(() => false);
  out.loading.push({ id, skeletonDuringDelay: skeleton, shellVisibleDuringDelay: shellVisible > 0, loadedAfterDelay: loadedAfter });
}
await page.unroute(/\/api\/v1\/admin\//);

// 1b) /me pending (before the shell exists)
await page.route(/\/api\/v1\/admin\/me$/, async (route) => { await new Promise((r) => setTimeout(r, 3000)); return route.continue(); });
await page.goto(`${BASE}/admin/audit`); await page.waitForTimeout(900);
out.loading.push({ id: 'me-pending(pre-shell)', skeletonDuringDelay: await page.locator('.state-loading').count(), shellVisibleDuringDelay: (await page.getByTestId('admin-nav-overview').count()) > 0, banner: await page.getByTestId('admin-fixture-banner').count() });
await page.screenshot({ path: `${OUT}/screens/state-loading-me-pending.png`, fullPage: true });
await page.waitForTimeout(3500);
await page.unroute(/\/api\/v1\/admin\/me$/);
await settle(page);

// 2) Error 500 per screen, time to error state, retry after release
const ERR = [
  ['overview', '/admin/', /\/api\/v1\/admin\/overview/, '[data-testid^="admin-metric-"]'],
  ['users', '/admin/users', /\/api\/v1\/admin\/users\?/, '[data-testid="admin-user-row"]'],
  ['user-detail', '/admin/users/fx_user_001', /\/api\/v1\/admin\/users\/fx_user_001/, '[data-testid="admin-user-detail"]'],
  ['households', '/admin/households', /\/api\/v1\/admin\/households/, '[data-testid="admin-household-row"]'],
  ['billing', '/admin/billing', /\/api\/v1\/admin\/billing\//, '[data-testid="admin-transaction-row"]'],
  ['ai', '/admin/ai', /\/api\/v1\/admin\/ai\//, '[data-testid="admin-ai-usage-row"]'],
  ['recipes', '/admin/recipes', /\/api\/v1\/admin\/recipes\?/, '[data-testid="admin-recipe-row"]'],
  ['recipe-detail', '/admin/recipes/imp-c6e706b483805e44', /\/api\/v1\/admin\/recipes\/imp-c6e706b483805e44/, '[data-testid="admin-recipe-detail"]'],
  ['system', '/admin/system', /\/api\/v1\/admin\/system\/status/, null],
  ['audit', '/admin/audit', /\/api\/v1\/admin\/audit/, '[data-testid="admin-audit-row"]'],
  ['settings', '/admin/settings', /\/api\/v1\/admin\/settings/, '[data-testid="admin-preferences-form"]'],
];
for (const [id, path, pattern, marker] of ERR) {
  const hits = { n: 0 };
  await page.route(pattern, (route) => { hits.n += 1; return route.fulfill(json(500, 'INTERNAL_SERVER_ERROR')); });
  const t0 = Date.now();
  await page.goto(`${BASE}${path}`);
  const errorShown = await page.getByTestId('admin-error-state').first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
  const tErrorMs = Date.now() - t0;
  const errorText = errorShown ? (await page.getByTestId('admin-error-state').first().innerText()).replace(/\n+/g, ' | ') : null;
  const retryButtons = await page.getByRole('button', { name: 'Thử lại' }).count();
  const fulfilledCalls = hits.n;
  await page.screenshot({ path: `${OUT}/screens/state-error-${id}.png`, fullPage: true });
  await page.unroute(pattern);
  let recovered = null;
  if (retryButtons > 0) {
    await page.getByRole('button', { name: 'Thử lại' }).first().click();
    recovered = marker
      ? await page.locator(marker).first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false)
      : await page.getByTestId('admin-error-state').count().then((c) => c === 0);
  }
  out.error.push({ id, errorShown, tErrorMs, errorText, retryButtons, fulfilled500: fulfilledCalls, recoveredAfterRetry: recovered });
}

// 2b) /me 500 on a protected deep link -> error + retry (shell not shown)
await page.route(/\/api\/v1\/admin\/me$/, (route) => route.fulfill(json(500, 'INTERNAL_SERVER_ERROR')));
await page.goto(`${BASE}/admin/users`);
const meErr = await page.getByTestId('admin-error-state').first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
out.error.push({ id: 'me-500(pre-shell)', errorShown: meErr, banner: await page.getByTestId('admin-fixture-banner').count(), sidebar: await page.getByTestId('admin-nav-overview').count() });
await page.unroute(/\/api\/v1\/admin\/me$/);
await page.getByRole('button', { name: 'Thử lại' }).first().click();
out.error[out.error.length - 1].recoveredAfterRetry = await page.getByTestId('admin-nav-overview').waitFor({ timeout: 15000 }).then(() => true).catch(() => false);

// 3) 429 read rate limit (simulated) on users list
await page.route(/\/api\/v1\/admin\/users\?/, (route) => route.fulfill(json(429, 'RATE_LIMIT_EXCEEDED', 'Quá nhiều yêu cầu (fixture)')));
const t429 = Date.now();
await page.goto(`${BASE}/admin/users`);
const err429 = await page.getByTestId('admin-error-state').first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
out.rate.readSimulated429 = { errorShown: err429, tMs: Date.now() - t429, text: err429 ? (await page.getByTestId('admin-error-state').first().innerText()).replace(/\n+/g, ' | ') : null };
await page.screenshot({ path: `${OUT}/screens/state-429-users.png`, fullPage: true });
await page.unroute(/\/api\/v1\/admin\/users\?/);
await page.getByRole('button', { name: 'Thử lại' }).first().click();
out.rate.readSimulated429.recovered = await page.locator('[data-testid="admin-user-row"]').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);

// 4) 503 ADMIN_AUTH_NOT_CONFIGURED on /me -> not-configured screen (no retry loop)
await page.route(/\/api\/v1\/admin\/me$/, (route) => route.fulfill(json(503, 'ADMIN_AUTH_NOT_CONFIGURED', 'Chưa cấu hình (fixture)')));
const tNc = Date.now();
await page.goto(`${BASE}/admin/users`);
const ncShown = await page.getByTestId('admin-auth-not-configured').waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
out.notConfigured.me503 = { shown: ncShown, tMs: Date.now() - tNc, text: ncShown ? (await page.getByTestId('admin-auth-not-configured').innerText()).replace(/\n+/g, ' | ') : null, banner: await page.getByTestId('admin-fixture-banner').count() };
await page.screenshot({ path: `${OUT}/screens/state-503-not-configured.png`, fullPage: true });
await page.unroute(/\/api\/v1\/admin\/me$/);

// 5) Login page: 503 on /auth/config, 404 (console disabled), login POST 503
await page.route(/\/api\/v1\/admin\/auth\/config/, (route) => route.fulfill(json(503, 'ADMIN_AUTH_NOT_CONFIGURED', 'Cấu hình lỗi (fixture)')));
await page.goto(`${BASE}/admin/login`); await page.waitForTimeout(1200);
out.loginConfig.config503 = { errorState: await page.getByTestId('admin-error-state').count(), text: (await page.locator('main').innerText()).replace(/\n+/g, ' | ').slice(0, 300) };
await page.screenshot({ path: `${OUT}/screens/state-503-login-config.png`, fullPage: true });
await page.unroute(/\/api\/v1\/admin\/auth\/config/);
await page.route(/\/api\/v1\/admin\/auth\/config/, (route) => route.fulfill(json(404, 'ADMIN_NOT_FOUND', 'Không tìm thấy')));
await page.goto(`${BASE}/admin/login`); await page.waitForTimeout(1200);
out.loginConfig.config404 = { unavailableNotice: await page.getByTestId('admin-login-unavailable').count() };
await page.unroute(/\/api\/v1\/admin\/auth\/config/);
await page.goto(`${BASE}/admin/login`);
await page.route(/\/api\/v1\/admin\/auth\/login/, (route) => route.fulfill(json(503, 'ADMIN_AUTH_NOT_CONFIGURED', 'Chưa cấu hình (fixture)')));
await page.getByTestId('admin-login-email').fill(EMAIL('super')); await page.getByTestId('admin-login-password').fill(PASSWORD);
await page.getByTestId('admin-login-submit').click(); await page.waitForTimeout(800);
out.loginConfig.login503 = { error: await page.getByTestId('admin-login-error').textContent().catch(() => null) };
await page.unroute(/\/api\/v1\/admin\/auth\/login/);
await page.close();

// 6) Session expiry mid-session (fixture reset invalidates the session cookie)
await resetDb();
const p6 = await ctx.newPage(); const rec6 = instrument(p6);
await login(p6, EMAIL('super')); await p6.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
await p6.goto(`${BASE}/admin/users`); await p6.waitForSelector('[data-testid="admin-user-row"]');
await resetDb();
await p6.getByTestId('admin-nav-billing').click();
await p6.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
await p6.waitForTimeout(500);
out.session.resetInvalidates = { url: pathOf(p6.url()) + p6.url().split('?')[1] ? '?' + p6.url().split('?')[1] : pathOf(p6.url()), loginForm: await p6.getByTestId('admin-login-email').count(), banner: await p6.getByTestId('admin-fixture-banner').count() };
await p6.screenshot({ path: `${OUT}/screens/state-401-redirect.png`, fullPage: true });
await p6.goBack(); await p6.waitForTimeout(800);
out.session.backAfterExpiry = { url: p6.url().replace(BASE, ''), rowsShown: await p6.getByTestId('admin-user-row').count(), billingRows: await p6.getByTestId('admin-transaction-row').count(), loginForm: await p6.getByTestId('admin-login-email').count() };
await p6.close();

// 7) Session revoked remotely by another SUPER admin -> /login?reason=revoked
await resetDb();
const pA = await ctx.newPage(); await login(pA, EMAIL('super')); await pA.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
await pA.goto(`${BASE}/admin/users`); await pA.waitForSelector('[data-testid="admin-user-row"]');
const meA = await pageApi(pA, '/api/v1/admin/me');
const ctxB = await newContext(browser); const pB = await ctxB.newPage();
await login(pB, EMAIL('super2')); await pB.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
const revoke = await pageApi(pB, `/api/v1/admin/sessions/${meA.data.session.id}/revoke`, { method: 'POST', body: {} });
await pA.getByTestId('admin-nav-audit').click();
await pA.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
await pA.waitForTimeout(500);
out.session.remoteRevoke = { revokeStatus: revoke.status, revokeCode: revoke.code, url: pA.url().replace(BASE, ''), reasonText: await pA.locator('.notice, [role="status"]').first().textContent().catch(() => null), loginForm: await pA.getByTestId('admin-login-email').count() };
await pA.screenshot({ path: `${OUT}/screens/state-revoked-redirect.png`, fullPage: true });
await ctxB.close();

// 8) Real rate limit on login (not simulated): 6 bad password attempts from one IP
await resetDb();
const pC = await ctx.newPage();
await pC.goto(`${BASE}/admin/login`);
const statuses = [];
for (let i = 0; i < 6; i++) {
  statuses.push(await pC.evaluate(async () => {
    const r = await fetch('/api/v1/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'super@fixture.takosan.test', password: 'wrong-pass-123' }) });
    const j = await r.json().catch(() => ({}));
    return `${r.status}/${j.code ?? ''}`;
  }));
}
out.rate.realLoginAttempts = statuses;
await pC.getByTestId('admin-login-email').fill(EMAIL('super')); await pC.getByTestId('admin-login-password').fill(PASSWORD);
await pC.getByTestId('admin-login-submit').click(); await pC.waitForTimeout(800);
out.rate.realLoginUiMessage = await pC.getByTestId('admin-login-error').textContent().catch(() => null);
await pC.screenshot({ path: `${OUT}/screens/state-429-login.png`, fullPage: true });

await browser.close();
writeResult('s5-states', out);
console.log(JSON.stringify(out, null, 1));
console.log('console errors (page, first 10):', JSON.stringify(rec.consoleErrors.slice(0, 10)));
console.log('pageErrors:', JSON.stringify(rec.pageErrors));
