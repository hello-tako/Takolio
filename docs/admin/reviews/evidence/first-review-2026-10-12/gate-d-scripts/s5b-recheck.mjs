import { BASE, OUT, EMAIL, PASSWORD, resetDb, launch, newContext, instrument, writeResult, login, pageApi } from './lib.mjs';
const out = {};
const settle = (page) => page.waitForLoadState('networkidle').catch(() => {}).then(() => page.waitForTimeout(300));
const json = (status, code, error = 'Lỗi giả lập (fixture)') => ({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ error, code }) });
await resetDb();
const browser = await launch();
const ctx = await newContext(browser);
const page = await ctx.newPage();
const rec = instrument(page);
await login(page, EMAIL('super'));
await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
// billing / ai: both sections fail, then release and retry each block
for (const [id, path, pattern, marker] of [
  ['billing', '/admin/billing', /\/api\/v1\/admin\/billing\//, '[data-testid="admin-transaction-row"]'],
  ['ai', '/admin/ai', /\/api\/v1\/admin\/ai\//, '[data-testid="admin-ai-usage-row"]'],
]) {
  await page.route(pattern, (route) => route.fulfill(json(500, 'INTERNAL_SERVER_ERROR')));
  await page.goto(`${BASE}${path}`);
  await page.getByTestId('admin-error-state').first().waitFor({ timeout: 30000 }).catch(() => {});
  const blocks = await page.getByTestId('admin-error-state').count();
  await page.unroute(pattern);
  const buttons = page.getByRole('button', { name: 'Thử lại' });
  for (let i = 0; i < (await buttons.count()); i++) { await buttons.nth(i).click(); await page.waitForTimeout(200); }
  const ok = await page.locator(marker).first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  out[`retryAll-${id}`] = { errorBlocks: blocks, retryClicked: 'all', markerAfter: ok, errorBlocksAfter: await page.getByTestId('admin-error-state').count() };
}
// system: wait for the error block to go away after retry
await page.route(/\/api\/v1\/admin\/system\/status/, (route) => route.fulfill(json(500, 'INTERNAL_SERVER_ERROR')));
await page.goto(`${BASE}/admin/system`);
await page.getByTestId('admin-error-state').first().waitFor({ timeout: 30000 }).catch(() => {});
await page.unroute(/\/api\/v1\/admin\/system\/status/);
await page.getByRole('button', { name: 'Thử lại' }).first().click();
await page.getByTestId('admin-error-state').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
out['retry-system'] = { errorAfter: await page.getByTestId('admin-error-state').count(), title: await page.getByTestId('admin-page-title').first().textContent() };
// auth/config 503 on login: wait out react-query retries
await page.route(/\/api\/v1\/admin\/auth\/config/, (route) => route.fulfill(json(503, 'ADMIN_AUTH_NOT_CONFIGURED', 'Cấu hình lỗi (fixture)')));
const pl = await ctx.newPage();
await pl.goto(`${BASE}/admin/login`);
const t0 = Date.now();
const errShown = await pl.getByTestId('admin-error-state').first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
out.authConfig503 = { errorShown: errShown, tMs: Date.now() - t0, text: errShown ? (await pl.getByTestId('admin-error-state').first().innerText()).replace(/\n+/g, ' | ') : (await pl.locator('main').innerText()).replace(/\n+/g, ' | ').slice(0, 200) };
await pl.screenshot({ path: `${OUT}/screens/state-503-login-config.png`, fullPage: true });
await pl.unroute(/\/api\/v1\/admin\/auth\/config/);
await pl.close();
// reset-based expiry: URL and reason on redirect
await resetDb();
const pe = await ctx.newPage();
await login(pe, EMAIL('super')); await pe.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
await pe.goto(`${BASE}/admin/users`); await pe.waitForSelector('[data-testid="admin-user-row"]');
await resetDb();
await pe.getByTestId('admin-nav-billing').click();
await pe.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
await pe.waitForTimeout(400);
out.resetExpiry = { path: new URL(pe.url()).pathname, search: new URL(pe.url()).search, reasonNotice: await pe.getByTestId('admin-login-reason').count(), loginForm: await pe.getByTestId('admin-login-email').count() };
await browser.close();
writeResult('s5b-recheck', out);
console.log(JSON.stringify(out, null, 1));
console.log('console errors:', rec.consoleErrors.filter((c) => !/500|404|403|401/.test(c.text)).length, 'pageErrors:', rec.pageErrors.length);
