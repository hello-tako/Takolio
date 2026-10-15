import { BASE, OUT, EMAIL, PASSWORD, resetDb, launch, newContext, instrument, writeResult, login, pageApi } from './lib.mjs';
const out = {};
const settle = (page) => page.waitForLoadState('networkidle').catch(() => {}).then(() => page.waitForTimeout(300));
const json = (status, code, error = 'Lỗi giả lập (fixture)') => ({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ error, code }) });
await resetDb();
const browser = await launch();
const ctx = await newContext(browser);
// A) /auth/config 503 on login: observe over 30s how many times it is requested and what is displayed
const pl = await ctx.newPage();
const cfgHits = [];
pl.on('response', (r) => { if (r.url().includes('/auth/config')) cfgHits.push({ t: Date.now(), status: r.status() }); });
await pl.route(/\/api\/v1\/admin\/auth\/config/, (route) => route.fulfill(json(503, 'ADMIN_AUTH_NOT_CONFIGURED', 'Cấu hình lỗi (fixture)')));
const start = Date.now();
await pl.goto(`${BASE}/admin/login`);
const snaps = [];
for (const s of [5, 10, 20, 30]) {
  await pl.waitForTimeout(Math.max(0, start + s * 1000 - Date.now()));
  snaps.push({ atS: s, requests: cfgHits.length, errorState: await pl.getByTestId('admin-error-state').count(), loading: await pl.locator('.state-loading').count(), text: (await pl.locator('main').innerText()).replace(/\n+/g, ' | ').slice(0, 120) });
}
await pl.screenshot({ path: `${OUT}/screens/state-503-login-config-30s.png`, fullPage: true });
out.authConfig503 = { snaps, gapsMs: cfgHits.map((h, i) => (i ? h.t - cfgHits[i - 1].t : 0)) };
await pl.unroute(/\/api\/v1\/admin\/auth\/config/);
await pl.close();
// B) Preferences save: is the success notice ever rendered after the PUT response?
await resetDb();
const page = await ctx.newPage(); const rec = instrument(page);
await login(page, EMAIL('super')); await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
await page.goto(`${BASE}/admin/settings`); await settle(page);
await page.locator('#admin-pref-density').selectOption('compact');
const [putResp] = await Promise.all([
  page.waitForResponse((r) => r.url().includes('/preferences') && r.request().method() === 'PUT'),
  page.getByTestId('admin-preferences-form').locator('button[type="submit"]').click(),
]);
const immediate = await page.evaluate(() => ({ notice: document.querySelector('.form-success')?.textContent ?? null }));
const mounts = await page.evaluate(() => new Promise((resolve) => {
  let seenSuccess = false; const found = [];
  const obs = new MutationObserver(() => { const el = document.querySelector('.form-success'); if (el && !seenSuccess) { seenSuccess = true; found.push(el.textContent); } });
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => { obs.disconnect(); resolve(found); }, 1500);
}));
out.preferences = { putStatus: putResp.status(), noticeRightAfterPut: immediate.notice, noticeEverRenderedInWindow: mounts };
await page.getByTestId('admin-preferences-form').screenshot({ path: `${OUT}/screens/flow-preferences-after-save.png` }).catch(() => {});
// C) Grant then revoke: is the revoked row shown as "Đã thu hồi" by content?
await page.goto(`${BASE}/admin/settings`); await settle(page);
await page.getByTestId('admin-grant-user-id').fill('fx_user_002');
await page.getByTestId('admin-grant-role').selectOption('SUPPORT_AGENT');
await Promise.all([page.waitForResponse((r) => r.url().endsWith('/api/v1/admin/roles') && r.request().method() === 'POST'), page.getByTestId('admin-grant-form').locator('button[type="submit"]').click()]);
await page.waitForTimeout(500);
const granted = await pageApi(page, '/api/v1/admin/settings');
const newA = (granted.data.assignments ?? []).find((a) => a.userId === 'fx_user_002' && a.status === 'active');
out.grantedAssignment = newA ? { id: newA.id, role: newA.role, status: newA.status } : null;
await page.goto(`${BASE}/admin/settings`); await settle(page);
const rowFor = page.getByTestId('admin-role-assignment-row').filter({ hasText: 'Lê Vy' }).first();
out.rowBeforeRevoke = (await rowFor.textContent().catch(() => '')).slice(0, 120);
await rowFor.getByRole('button', { name: 'Thu hồi' }).click();
await page.getByTestId('admin-revoke-confirm').click();
await page.waitForTimeout(700);
const rowAfter = page.getByTestId('admin-role-assignment-row').filter({ hasText: 'Lê Vy' }).first();
out.rowAfterRevoke = (await rowAfter.textContent().catch(() => '')).slice(0, 160);
const after = await pageApi(page, '/api/v1/admin/settings');
out.revokedInApi = (after.data.assignments ?? []).filter((a) => a.id === out.grantedAssignment?.id).map((a) => ({ status: a.status, revokedAt: a.revokedAt }));
await browser.close();
writeResult('s5d-recheck', out);
console.log(JSON.stringify(out, null, 1));
console.log('unexpected console errors:', JSON.stringify(rec.consoleErrors.filter((c) => !/Failed to load resource/.test(c.text))), 'pageErrors:', JSON.stringify(rec.pageErrors));
