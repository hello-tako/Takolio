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
for (const [id, path, pattern, marker] of [
  ['billing', '/admin/billing', /\/api\/v1\/admin\/billing\//, '[data-testid="admin-transaction-row"]'],
  ['ai', '/admin/ai', /\/api\/v1\/admin\/ai\//, '[data-testid="admin-ai-usage-row"]'],
]) {
  await page.route(pattern, (route) => route.fulfill(json(500, 'INTERNAL_SERVER_ERROR')));
  await page.goto(`${BASE}${path}`);
  await page.getByTestId('admin-error-state').first().waitFor({ timeout: 30000 }).catch(() => {});
  const blocks = await page.getByTestId('admin-error-state').count();
  await page.unroute(pattern);
  const steps = [];
  for (let i = 0; i < 4; i++) {
    const n = await page.getByTestId('admin-error-state').count();
    if (n === 0) break;
    const a = rec.api.length;
    await page.getByRole('button', { name: 'Thử lại' }).first().click();
    await page.waitForTimeout(1500); await settle(page);
    steps.push({ errorBlocksBefore: n, requestsAfterRetry: rec.api.slice(a).map((x) => `${x.status} ${x.path}`), errorBlocksAfter: await page.getByTestId('admin-error-state').count() });
  }
  out[`sequentialRetry-${id}`] = { initialErrorBlocks: blocks, steps, markerLoaded: await page.locator(marker).count(), remainingErrorText: (await page.getByTestId('admin-error-state').count()) ? (await page.getByTestId('admin-error-state').first().innerText()).replace(/\n+/g, ' | ') : null };
  await page.screenshot({ path: `${OUT}/screens/state-recovery-${id}.png`, fullPage: true });
}
// auth/config 503 on the login page itself (route must be on the page that navigates)
const pl = await ctx.newPage();
await pl.route(/\/api\/v1\/admin\/auth\/config/, (route) => route.fulfill(json(503, 'ADMIN_AUTH_NOT_CONFIGURED', 'Cấu hình lỗi (fixture)')));
await pl.goto(`${BASE}/admin/login`);
const t0 = Date.now();
const errShown = await pl.getByTestId('admin-error-state').first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
out.authConfig503 = { errorShown: errShown, tMs: Date.now() - t0, text: errShown ? (await pl.getByTestId('admin-error-state').first().innerText()).replace(/\n+/g, ' | ') : null, formShown: await pl.getByTestId('admin-login-email').count() };
await pl.screenshot({ path: `${OUT}/screens/state-503-login-config.png`, fullPage: true });
await pl.unroute(/\/api\/v1\/admin\/auth\/config/);
await pl.close();
// Preferences save: sample the success notice over time and count settings refetches
await page.goto(`${BASE}/admin/settings`); await settle(page);
const a = rec.api.length;
await page.locator('#admin-pref-density').selectOption('compact');
await page.getByTestId('admin-preferences-form').locator('button[type="submit"]').click();
const samples = [];
for (const ms of [50, 300, 800, 1500]) { await page.waitForTimeout(ms === 50 ? 50 : ms - (ms === 300 ? 50 : ms === 800 ? 300 : 800)); samples.push({ atMs: ms, notice: await page.locator('form[data-testid="admin-preferences-form"] ~ *, .form-success').count() + ':' + ((await page.locator('.form-success').first().textContent().catch(() => '')) || '') }); }
out.preferencesSave = { samples, apiAfterSave: rec.api.slice(a).map((x) => `${x.status} ${x.method} ${x.path}`) };
await page.getByTestId('admin-preferences-form').locator('button[type="submit"]').focus().catch(() => {});
await page.locator('#admin-pref-density').selectOption('comfortable');
await page.getByTestId('admin-preferences-form').locator('button[type="submit"]').click(); await page.waitForTimeout(600);
// Revoke row status (check by content, not index)
await page.goto(`${BASE}/admin/settings`); await settle(page);
const revokedRows = await page.getByTestId('admin-role-assignment-row').allTextContents();
out.revokedRowsSnapshot = revokedRows.filter((t) => t.includes('Lê Vy')).map((t) => t.slice(0, 140));
await browser.close();
writeResult('s5c-recheck', out);
console.log(JSON.stringify(out, null, 1));
console.log('unexpected console errors:', JSON.stringify(rec.consoleErrors.filter((c) => !/Failed to load resource/.test(c.text))), 'pageErrors:', JSON.stringify(rec.pageErrors));
