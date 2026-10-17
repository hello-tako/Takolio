import { BASE, OUT, EMAIL, PASSWORD, resetDb, launch, newContext, instrument, writeResult, login, pageApi } from './lib.mjs';
const out = {};
const settle = (page) => page.waitForLoadState('networkidle').catch(() => {}).then(() => page.waitForTimeout(300));
const json = (status, code, error = 'Lỗi giả lập (fixture)') => ({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ error, code }) });
const focusTestId = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName);
await resetDb();
const browser = await launch();
const ctx = await newContext(browser);
const page = await ctx.newPage();
const rec = instrument(page);
await login(page, EMAIL('super'));
await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });

// A. Email reveal dialog
await page.goto(`${BASE}/admin/users/fx_user_001`); await settle(page);
const revealBtn = page.getByTestId('admin-reveal-email');
const dialog = page.getByRole('dialog');
const emailMasked = await page.getByTestId('admin-user-email').textContent();
await revealBtn.click(); await page.waitForTimeout(200);
const a1 = { open: await dialog.count(), focusInside: await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), title: await dialog.locator('h2').textContent().catch(() => null) };
await dialog.getByRole('button', { name: 'Hủy' }).click(); await page.waitForTimeout(200);
a1.afterCancel = { open: await dialog.count(), email: await page.getByTestId('admin-user-email').textContent(), focusReturnedTo: await focusTestId(page) };
await revealBtn.click(); await page.waitForTimeout(200); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
a1.afterEsc = { open: await dialog.count(), focusReturnedTo: await focusTestId(page) };
await revealBtn.click(); await page.waitForTimeout(200);
const trap = [];
for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); trap.push(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))); }
a1.tabTrapInside = trap.every(Boolean);
const mark = page.waitForResponse((r) => r.url().includes('reveal=email'));
await dialog.getByTestId('admin-reveal-confirm').click();
const revealResp = await mark;
await page.waitForTimeout(400);
a1.afterConfirm = { open: await dialog.count(), email: await page.getByTestId('admin-user-email').textContent(), revealStatus: revealResp.status(), notice: await page.locator('.form-success, [role="status"]').first().textContent().catch(() => null), focusReturnedTo: await focusTestId(page), emailMaskedBefore: emailMasked };
a1.auditRevealEvents = (await pageApi(page, '/api/v1/admin/audit?action=users.pii.reveal&pageSize=5')).data?.total ?? null;
out.reveal = a1;
await page.screenshot({ path: `${OUT}/screens/flow-reveal-revealed.png`, fullPage: true });

// B. Recipe review: success, then simulated 409 conflict and 500
await page.goto(`${BASE}/admin/recipes/imp-c6e706b483805e44`); await settle(page);
const form = page.getByTestId('admin-recipe-review-form');
await form.locator('select').first().selectOption('approved');
await form.locator('textarea').first().fill('E2E review note (fixture)');
const [okResp] = await Promise.all([
  page.waitForResponse((r) => /\/reviews$/.test(r.url()) && r.request().method() === 'POST'),
  page.getByTestId('admin-recipe-review-submit').click(),
]);
await page.waitForTimeout(400);
const okBody = await okResp.request().postDataJSON();
out.reviewSuccess = { status: okResp.status(), requestBody: okBody, message: await page.locator('.form-success').first().textContent().catch(() => null) };
await page.route(/\/reviews$/, (route) => route.fulfill(json(409, 'ADMIN_CONFLICT', 'Phiên bản công thức đã thay đổi (fixture)')));
await form.locator('textarea').first().fill('conflict probe');
await page.getByTestId('admin-recipe-review-submit').click(); await page.waitForTimeout(600);
out.review409 = { formText: (await form.innerText()).replace(/\n+/g, ' | ').slice(0, 400), reloadButton: await form.getByRole('button').count() };
await page.screenshot({ path: `${OUT}/screens/flow-review-409.png`, fullPage: true });
await page.unroute(/\/reviews$/);
await page.route(/\/reviews$/, (route) => route.fulfill(json(500, 'INTERNAL_SERVER_ERROR')));
await page.getByTestId('admin-recipe-review-submit').click(); await page.waitForTimeout(600);
out.review500 = { formText: (await form.innerText()).replace(/\n+/g, ' | ').slice(0, 300) };
await page.unroute(/\/reviews$/);

// C. Preferences save
await page.goto(`${BASE}/admin/settings`); await settle(page);
await page.locator('#admin-pref-density').selectOption('compact');
const [prefResp] = await Promise.all([
  page.waitForResponse((r) => r.url().includes('/preferences') && r.request().method() === 'PUT'),
  page.getByTestId('admin-preferences-form').locator('button[type="submit"]').click(),
]);
await page.waitForTimeout(400);
out.preferences = { status: prefResp.status(), success: await page.locator('.form-success').first().textContent().catch(() => null) };
await page.goto(`${BASE}/admin/settings`); await settle(page);
out.preferences.persistedDensity = await page.locator('#admin-pref-density').inputValue();
await page.locator('#admin-pref-density').selectOption('comfortable');
await page.getByTestId('admin-preferences-form').locator('button[type="submit"]').click(); await page.waitForTimeout(400);

// D. Grant SUPPORT_AGENT to fx_user_002, then revoke with confirm dialog
await page.goto(`${BASE}/admin/settings`); await settle(page);
const rowsBefore = await page.getByTestId('admin-role-assignment-row').allTextContents();
await page.getByTestId('admin-grant-user-id').fill('fx_user_002');
await page.getByTestId('admin-grant-role').selectOption('SUPPORT_AGENT');
const [grantResp] = await Promise.all([
  page.waitForResponse((r) => r.url().endsWith('/api/v1/admin/roles') && r.request().method() === 'POST'),
  page.getByTestId('admin-grant-form').locator('button[type="submit"]').click(),
]);
await page.waitForTimeout(500);
const rowsAfter = await page.getByTestId('admin-role-assignment-row').allTextContents();
const newIdx = rowsAfter.findIndex((t) => !rowsBefore.includes(t));
out.grant = { status: grantResp.status(), newRow: newIdx >= 0 ? rowsAfter[newIdx] : null, rowCount: [rowsBefore.length, rowsAfter.length], message: await page.locator('.form-success').first().textContent().catch(() => null) };
if (newIdx >= 0) {
  const row = page.getByTestId('admin-role-assignment-row').nth(newIdx);
  await row.getByRole('button', { name: 'Thu hồi' }).click(); await page.waitForTimeout(200);
  const rd = page.getByTestId('admin-revoke-dialog');
  out.revoke = { dialogOpen: await rd.count(), titleText: await page.getByRole('dialog').locator('h2').first().textContent().catch(() => null) };
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy' }).click(); await page.waitForTimeout(200);
  out.revoke.afterCancelRowStillActive = (await page.getByTestId('admin-role-assignment-row').nth(newIdx).textContent()).includes('Đang hiệu lực');
  await page.getByTestId('admin-role-assignment-row').nth(newIdx).getByRole('button', { name: 'Thu hồi' }).click(); await page.waitForTimeout(200);
  const [revokeResp] = await Promise.all([
    page.waitForResponse((r) => /\/api\/v1\/admin\/roles\//.test(r.url()) && r.request().method() === 'DELETE'),
    page.getByTestId('admin-revoke-confirm').click(),
  ]);
  await page.waitForTimeout(500);
  out.revoke.status = revokeResp.status();
  out.revoke.rowAfter = (await page.getByTestId('admin-role-assignment-row').nth(newIdx).textContent()).slice(0, 200);
}
// E. Request SUPER_ADMIN for fx_admin_ops (approval required)
await page.goto(`${BASE}/admin/settings`); await settle(page);
await page.getByTestId('admin-grant-user-id').fill('fx_admin_ops');
await page.getByTestId('admin-grant-role').selectOption('SUPER_ADMIN');
const [reqResp] = await Promise.all([
  page.waitForResponse((r) => r.url().endsWith('/api/v1/admin/roles') && r.request().method() === 'POST'),
  page.getByTestId('admin-grant-form').locator('button[type="submit"]').click(),
]);
await page.waitForTimeout(500);
out.superRequest = { status: reqResp.status(), body: (await reqResp.text()).slice(0, 200), message: await page.locator('.form-success').first().textContent().catch(() => null) };
await page.reload(); await settle(page);
const approvalRows = await page.getByTestId('admin-approval-row').allTextContents();
out.approvalsAsRequester = { rows: approvalRows.map((t) => t.slice(0, 160)), approveButtonsInRows: await page.locator('[data-testid="admin-approval-row"] button').count() };
await page.screenshot({ path: `${OUT}/screens/flow-approval-requester.png`, fullPage: true });
const settingsNow = await pageApi(page, '/api/v1/admin/settings');
const pending = (settingsNow.data?.approvals ?? []).filter((a) => a.status === 'pending');
out.approvalsApi = { pendingCount: pending.length, sample: pending[0] ? { id: pending[0].id, requestedBy: pending[0].requestedBy, targetUserId: pending[0].targetUserId ?? pending[0].userId } : null };
const pendingId = pending[0]?.id;
if (pendingId) {
  out.requesterApproveApi = await pageApi(page, `/api/v1/admin/approvals/${pendingId}/approve`, { method: 'POST', body: {} });
}

// F. super2 approves the pending request (not the requester)
const ctxB = await newContext(browser);
const pB = await ctxB.newPage(); const recB = instrument(pB);
await login(pB, EMAIL('super2')); await pB.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
await pB.goto(`${BASE}/admin/settings`); await settle(pB);
const pendRow = pB.getByTestId('admin-approval-row').filter({ hasText: 'Chờ phê duyệt' }).first();
out.super2ApprovalView = { pendingRows: await pB.getByTestId('admin-approval-row').count(), approveVisible: await pendRow.getByRole('button', { name: 'Phê duyệt' }).count() };
const [decResp] = await Promise.all([
  pB.waitForResponse((r) => /\/approvals\/.+\/approve$/.test(r.url()) && r.request().method() === 'POST'),
  pendRow.getByRole('button', { name: 'Phê duyệt' }).click(),
]);
await pB.waitForTimeout(500);
out.super2Approve = { status: decResp.status(), message: await pB.locator('.form-success').first().textContent().catch(() => null), rowAfter: (await pB.getByTestId('admin-approval-row').first().textContent().catch(() => '')).slice(0, 160) };
const settingsAfter = await pageApi(pB, '/api/v1/admin/settings');
out.afterApprove = { fxAdminOpsRoles: (settingsAfter.data?.assignments ?? []).filter((a) => a.userId === 'fx_admin_ops' && a.status === 'active').map((a) => a.role) };
await pB.screenshot({ path: `${OUT}/screens/flow-approval-approved.png`, fullPage: true });
await ctxB.close();

// G. Logout terminates the session
await page.goto(`${BASE}/admin/users`); await settle(page);
await page.getByTestId('admin-logout').click();
await page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(400);
const cookies = (await ctx.cookies()).map((c) => c.name);
const meAfter = await pageApi(page, '/api/v1/admin/me');
await page.goBack(); await settle(page); await page.waitForTimeout(500);
out.logout = { url: new URL(page.url()).pathname, cookiesLeft: cookies.filter((c) => c.includes('takosan')), meAfter: { status: meAfter.status, code: meAfter.code }, rowsAfterBack: await page.getByTestId('admin-user-row').count(), loginFormAfterBack: await page.getByTestId('admin-login-email').count() };
await browser.close();
writeResult('s6-flows', { out, consoleErrors: rec.consoleErrors.filter((c) => !/Failed to load resource/.test(c.text)), pageErrors: rec.pageErrors, b: { consoleErrors: recB.consoleErrors.filter((c) => !/Failed to load resource/.test(c.text)), pageErrors: recB.pageErrors } });
console.log(JSON.stringify(out, null, 1));
console.log('unexpected console errors:', JSON.stringify(rec.consoleErrors.filter((c) => !/Failed to load resource/.test(c.text))), 'pageErrors:', JSON.stringify(rec.pageErrors));
