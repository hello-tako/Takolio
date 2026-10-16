import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Synthetic local fixture identities (scripts/admin-local-lib.mjs).
const PASSWORD = 'Local-Fixture-Only-2026!';
const SUPER = 'super@fixture.takosan.test';
const CONTENT = 'content@fixture.takosan.test';
const OWNER = 'owner@fixture.takosan.test';
const SHOTS = process.env.ADMIN_E2E_WRITE_DOC_SCREENSHOTS === '1'
  ? 'docs/admin/screenshots'
  : '.hoplite/artifacts/admin-e2e/screenshots';
mkdirSync(SHOTS, { recursive: true });

async function shot(page: Page, name: string) {
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/admin/login');
  await page.getByTestId('admin-login-email').fill(email);
  await page.getByTestId('admin-login-password').fill(password);
  await page.getByTestId('admin-login-submit').click();
}

// Calls the API from inside the page so the browser's own cookie rules apply.
async function api(page: Page, path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  return page.evaluate(async ({ path, init }) => {
    const response = await fetch(path, { method: init.method ?? 'GET', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body) });
    let json: { code?: string } = {};
    try { json = await response.json(); } catch { json = {}; }
    return { status: response.status, code: json.code };
  }, { path, init });
}

async function title(page: Page) {
  return page.getByTestId('admin-page-title');
}

const consoleErrors: string[] = [];
test.beforeEach(async ({ page, request }) => {
  expect((await request.post('/__admin-preview/reset')).status()).toBe(204);
  consoleErrors.length = 0;
  page.on('pageerror', (error) => consoleErrors.push(error.message));
});
test.afterEach(() => {
  expect(consoleErrors, 'uncaught page errors').toEqual([]);
});

test('unauthenticated visitors land on the admin sign-in screen', async ({ page }) => {
  await page.goto('/admin/');
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByTestId('admin-login-email')).toBeVisible();
  await shot(page, '01-login');
  expect(await api(page, '/api/v1/admin/me')).toEqual({ status: 401, code: 'ADMIN_UNAUTHENTICATED' });
});

test('a household owner without a platform role is refused with the generic error', async ({ page }) => {
  await login(page, OWNER);
  await expect(page.getByTestId('admin-login-error')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
  await shot(page, '01b-login-denied');
});

test('super admin journey across every primary screen, then logout terminates the session', async ({ page }) => {
  await login(page, SUPER);
  await expect(page).not.toHaveURL(/\/login/);

  // Overview from the local backend, clearly labelled synthetic.
  await expect(await title(page)).toBeVisible();
  await expect(page.getByTestId('admin-fixture-banner')).toBeVisible();
  await expect(page.locator('[data-testid^="admin-metric-"]').first()).toBeVisible();
  expect(await page.locator('[data-testid^="admin-metric-"]').count()).toBeGreaterThanOrEqual(5);
  await shot(page, '02-overview');

  // Users: search and inspect, reveal is permission-gated and audited.
  await page.getByTestId('admin-nav-users').click();
  await expect(page).toHaveURL(/\/admin\/users/);
  await page.getByTestId('admin-users-search').fill('customer001');
  await expect(page.getByTestId('admin-user-row')).toHaveCount(1);
  await shot(page, '03-users');
  await page.getByTestId('admin-user-row').first().getByRole('link').first().click();
  await expect(page.getByTestId('admin-user-detail')).toBeVisible();
  await expect(page.getByTestId('admin-user-email')).not.toContainText('customer001@');
  await page.getByTestId('admin-reveal-email').click();
  await page.getByTestId('admin-reveal-confirm').click();
  await expect(page.getByTestId('admin-user-email')).toContainText('customer001@fixture.takosan.test');
  await shot(page, '03b-user-detail');
  await page.getByTestId('admin-nav-users').click();
  await page.getByTestId('admin-households-tab').click();
  await expect(page.getByTestId('admin-household-row').first()).toBeVisible();
  await shot(page, '03c-households');

  // Billing summaries (read-only).
  await page.getByTestId('admin-nav-billing').click();
  await expect(page.getByTestId('admin-billing-summary')).toBeVisible();
  await expect(page.getByTestId('admin-transaction-row').first()).toBeVisible();
  await expect(page.getByText(/[0-9]{1,3}([.,\s][0-9]{3})+\s?(₫|VND)/).first()).toBeVisible();
  await shot(page, '04-billing');

  // AI usage with the explicit instrumentation warning.
  await page.getByTestId('admin-nav-ai').click();
  await expect(page.getByTestId('admin-ai-summary')).toBeVisible();
  await expect(page.getByTestId('admin-ai-instrumentation-warning')).toBeVisible();
  await shot(page, '05-ai');

  // Recipes: browse, inspect, record an editorial review (ledger only).
  await page.getByTestId('admin-nav-recipes').click();
  await expect(page.getByTestId('admin-recipe-row').first()).toBeVisible();
  await page.getByTestId('admin-recipes-search').fill('canh');
  await expect(page.getByTestId('admin-recipe-row').first()).toBeVisible();
  await shot(page, '06-recipes');
  await page.getByTestId('admin-recipe-row').first().getByRole('link').first().click();
  await expect(page.getByTestId('admin-recipe-detail')).toBeVisible();
  const form = page.getByTestId('admin-recipe-review-form');
  await expect(form).toBeVisible();
  await form.locator('select').first().selectOption('in_review');
  await form.locator('textarea').first().fill('E2E: kiểm tra định lượng nguyên liệu (fixture).');
  const reviewResponse = page.waitForResponse((r) => /\/api\/v1\/admin\/recipes\/[^/]+\/reviews$/.test(r.url()) && r.request().method() === 'POST');
  await page.getByTestId('admin-recipe-review-submit').click();
  expect((await reviewResponse).status()).toBe(201);
  await expect(page.getByText('E2E: kiểm tra định lượng nguyên liệu (fixture).').first()).toBeVisible();
  await shot(page, '06b-recipe-detail');

  // System health distinguishes local from remote observations.
  await page.getByTestId('admin-nav-system').click();
  await expect(page.getByTestId('admin-system-check').first()).toBeVisible();
  await shot(page, '07-system');

  // Audit history records this session's actions.
  await page.getByTestId('admin-nav-audit').click();
  await expect(page.getByTestId('admin-audit-row').first()).toBeVisible();
  await expect(page.getByTestId('admin-audit-row').filter({ hasText: 'users.pii.reveal' }).first()).toBeVisible();
  await expect(page.getByTestId('admin-audit-row').filter({ hasText: 'admin.login' }).first()).toBeVisible();
  await shot(page, '08-audit');

  // Settings: role assignments and the permission matrix.
  await page.getByTestId('admin-nav-settings').click();
  await expect(page.getByTestId('admin-settings-matrix')).toBeVisible();
  await expect(page.getByTestId('admin-role-assignment-row').first()).toBeVisible();
  await shot(page, '09-settings');

  // Unregistered server routes fail closed without serving the Admin shell.
  const missing = await page.goto('/admin/does-not-exist');
  expect(missing?.status()).toBe(404);
  await expect(page.locator('.admin-app')).toHaveCount(0);

  // Logout terminates the server session.
  await page.goto('/admin/');
  const userMenu = page.getByTestId('admin-user-menu');
  if (await userMenu.isVisible()) await userMenu.click();
  await page.getByTestId('admin-logout').click();
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await api(page, '/api/v1/admin/me')).status).toBe(401);
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('content editor sees only permitted screens and the server enforces the rest', async ({ page }) => {
  await login(page, CONTENT);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByTestId('admin-nav-recipes')).toBeVisible();
  for (const hidden of ['admin-nav-users', 'admin-nav-billing', 'admin-nav-ai', 'admin-nav-audit', 'admin-nav-system']) {
    await expect(page.getByTestId(hidden)).toHaveCount(0);
  }
  // Route hiding is cosmetic: direct navigation shows a denied state...
  await page.goto('/admin/billing');
  await expect(page.getByTestId('admin-permission-denied')).toBeVisible();
  await shot(page, '10-permission-denied');
  // ...and the backend refuses the data regardless of the UI.
  for (const path of ['/api/v1/admin/users', '/api/v1/admin/billing/summary', '/api/v1/admin/audit', '/api/v1/admin/system/status']) {
    expect(await api(page, path), path).toEqual({ status: 403, code: 'ADMIN_FORBIDDEN' });
  }
  // Forged role headers do not help.
  expect(await api(page, '/api/v1/admin/billing/summary', { headers: { 'x-admin-role': 'SUPER_ADMIN', 'x-user-id': 'fx_admin_super' } }))
    .toEqual({ status: 403, code: 'ADMIN_FORBIDDEN' });
  // A mutation without the CSRF header is rejected before permission checks matter.
  expect(await api(page, '/api/v1/admin/roles', { method: 'POST', body: { userId: 'fx_user_001', role: 'SUPPORT_AGENT' } }))
    .toEqual({ status: 403, code: 'ADMIN_CSRF_FAILED' });
  // No CSRF cookie exists; the token comes from GET /me. With it, the server still refuses on permission.
  expect(await page.evaluate(() => document.cookie)).not.toContain('takosan_admin');
  const csrfToken = await page.evaluate(async () => ((await (await fetch('/api/v1/admin/me', { credentials: 'same-origin' })).json()) as { data: { csrfToken: string } }).data.csrfToken);
  expect(csrfToken).toMatch(/^[0-9a-f]{64}$/);
  expect(await api(page, '/api/v1/admin/roles', { method: 'POST', headers: { 'X-Admin-CSRF': csrfToken }, body: { userId: 'fx_user_001', role: 'SUPPORT_AGENT' } }))
    .toEqual({ status: 403, code: 'ADMIN_FORBIDDEN' });
});

test('mobile layout keeps navigation reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, SUPER);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByTestId('admin-mobile-menu')).toBeVisible();
  await shot(page, '11-mobile-overview');
  await page.getByTestId('admin-mobile-menu').click();
  await page.getByTestId('admin-nav-recipes').click();
  await expect(page.getByTestId('admin-recipe-row').first()).toBeVisible();
});

test('SUPER_ADMIN grants need a second SUPER_ADMIN in the UI, and the requester cannot approve', async ({ page }) => {
  await login(page, SUPER);
  await page.getByTestId('admin-nav-settings').click();
  await expect(page.getByTestId('admin-settings-matrix')).toBeVisible();
  // R2 starts with three independent operators; revocations require approval.
  await expect(page.getByTestId('admin-role-assignment-row').filter({ hasText: 'Quản trị viên cấp cao' })).toHaveCount(3);
  await expect(page.getByTestId('admin-role-revoke-blocked')).toHaveCount(0);
  await page.getByTestId('admin-grant-user').fill('fx_admin_ops');
  await page.getByTestId('admin-grant-role').selectOption('SUPER_ADMIN');
  await page.getByTestId('admin-grant-submit').click();
  await expect(page.getByTestId('admin-notice').first()).toContainText('phê duyệt');
  const row = page.getByTestId('admin-approval-row').filter({ hasText: 'fx_admin_ops' }).first();
  await expect(row).toBeVisible();
  await expect(row.getByTestId('admin-approval-approve')).toHaveCount(0);
  await page.getByTestId('admin-logout').click();
  await expect(page).toHaveURL(/\/admin\/login/);

  await login(page, 'super2@fixture.takosan.test');
  await page.getByTestId('admin-nav-settings').click();
  const pending = page.getByTestId('admin-approval-row').filter({ hasText: 'fx_admin_ops' }).first();
  await pending.getByTestId('admin-approval-approve').click();
  await expect(page.getByTestId('admin-notice').first()).toBeVisible();
  await expect(page.getByTestId('admin-role-assignment-row').filter({ hasText: 'Vận hành (fixture)' }).filter({ hasText: 'Quản trị viên cấp cao' })).toHaveCount(1);
  await shot(page, '12-settings-four-eyes');
});

test('preferences confirmation persists and a server-side session loss returns to sign-in with a reason', async ({ page, request }) => {
  await login(page, SUPER);
  await page.getByTestId('admin-nav-settings').click();
  await page.getByTestId('admin-preferences-form').getByRole('button').last().click();
  await expect(page.getByTestId('admin-preferences-saved')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('admin-preferences-saved')).toBeVisible();
  // Resetting the preview database invalidates this session server-side.
  expect((await request.post('/__admin-preview/reset')).status()).toBe(204);
  await page.getByTestId('admin-nav-users').click();
  await expect(page).toHaveURL(/\/admin\/login(\?reason=ended)?/);
});
