import { BASE, EMAIL, PASSWORD, resetDb, launch, newContext, instrument, writeResult, login, pageApi } from './lib.mjs';

const ALL = ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'CONTENT_EDITOR', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'];
// Copied from src/shared/admin.ts ADMIN_PERMISSION_MATRIX (commit 3e865d0).
const MATRIX = {
  'admin.self.read': ALL, 'overview.read': ALL,
  'users.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'],
  'users.pii.reveal': ['SUPER_ADMIN', 'SUPPORT_AGENT'],
  'households.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'],
  'billing.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'READ_ONLY_AUDITOR'],
  'ai.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'READ_ONLY_AUDITOR'],
  'recipes.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'CONTENT_EDITOR', 'READ_ONLY_AUDITOR'],
  'recipes.review': ['SUPER_ADMIN', 'CONTENT_EDITOR'],
  'system.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'READ_ONLY_AUDITOR'],
  'audit.read': ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'READ_ONLY_AUDITOR'],
  'admin.roles.read': ['SUPER_ADMIN', 'READ_ONLY_AUDITOR'],
  'admin.roles.manage': ['SUPER_ADMIN'], 'admin.approvals.decide': ['SUPER_ADMIN'],
  'admin.sessions.revoke': ['SUPER_ADMIN'], 'admin.preferences.write': ALL,
};
const ROLES = [
  { key: 'super', role: 'SUPER_ADMIN' }, { key: 'ops', role: 'OPERATIONS_ADMIN' }, { key: 'content', role: 'CONTENT_EDITOR' },
  { key: 'support', role: 'SUPPORT_AGENT' }, { key: 'auditor', role: 'READ_ONLY_AUDITOR' }, { key: 'super2', role: 'SUPER_ADMIN' },
];
const allowed = (role, perm) => MATRIX[perm].includes(role);
const NAV = { overview: ['overview.read'], users: ['users.read', 'households.read'], billing: ['billing.read'], ai: ['ai.read'],
  recipes: ['recipes.read'], system: ['system.read'], audit: ['audit.read'], settings: ['admin.self.read'] };
const ROUTES = [
  { path: '/admin/', perm: 'overview.read', marker: '[data-testid^="admin-metric-"]' },
  { path: '/admin/users', perm: 'users.read', marker: '[data-testid="admin-user-row"]' },
  { path: '/admin/users/fx_user_001', perm: 'users.read', marker: '[data-testid="admin-user-detail"]' },
  { path: '/admin/households', perm: 'households.read', marker: '[data-testid="admin-household-row"]' },
  { path: '/admin/billing', perm: 'billing.read', marker: '[data-testid="admin-transaction-row"]' },
  { path: '/admin/ai', perm: 'ai.read', marker: '[data-testid="admin-ai-usage-row"]' },
  { path: '/admin/recipes', perm: 'recipes.read', marker: '[data-testid="admin-recipe-row"]' },
  { path: '/admin/recipes/imp-c6e706b483805e44', perm: 'recipes.read', marker: '[data-testid="admin-recipe-detail"]' },
  { path: '/admin/system', perm: 'system.read', marker: 'h1[data-testid="admin-page-title"]' },
  { path: '/admin/audit', perm: 'audit.read', marker: '[data-testid="admin-audit-row"]' },
  { path: '/admin/settings', perm: 'admin.self.read', marker: '[data-testid="admin-preferences-form"]' },
];
const API = [
  ['GET', '/api/v1/admin/me', 'admin.self.read'], ['GET', '/api/v1/admin/overview?range=30d', 'overview.read'],
  ['GET', '/api/v1/admin/users?pageSize=5', 'users.read'], ['GET', '/api/v1/admin/users/fx_user_001?reveal=email', 'users.pii.reveal'],
  ['GET', '/api/v1/admin/households?pageSize=5', 'households.read'], ['GET', '/api/v1/admin/billing/summary?range=30d', 'billing.read'],
  ['GET', '/api/v1/admin/billing/transactions?pageSize=5', 'billing.read'], ['GET', '/api/v1/admin/ai/summary?range=30d', 'ai.read'],
  ['GET', '/api/v1/admin/ai/usage?pageSize=5', 'ai.read'], ['GET', '/api/v1/admin/recipes?pageSize=5', 'recipes.read'],
  ['GET', '/api/v1/admin/system/status', 'system.read'], ['GET', '/api/v1/admin/audit?pageSize=5', 'audit.read'],
  ['GET', '/api/v1/admin/settings', 'admin.self.read'], ['GET', '/api/v1/admin/sessions', 'admin.sessions.revoke'],
  ['POST', '/api/v1/admin/recipes/imp-c6e706b483805e44/reviews', 'recipes.review', { state: 'in_review', note: 'role-matrix probe', recipeVersion: 1 }],
  ['POST', '/api/v1/admin/roles', 'admin.roles.manage', { userId: 'no-such-user-x', role: 'CONTENT_EDITOR' }],
  ['DELETE', '/api/v1/admin/roles/no-such-assignment', 'admin.roles.manage'],
  ['POST', '/api/v1/admin/approvals/no-such-approval/approve', 'admin.approvals.decide'],
  ['POST', '/api/v1/admin/sessions/no-such-session/revoke', 'admin.sessions.revoke'],
  ['PUT', '/api/v1/admin/preferences', 'admin.preferences.write', { density: 'comfortable' }],
];

await resetDb();
const browser = await launch();
const out = { roles: {}, login: {} };

// Login negatives
for (const [label, email, password] of [
  ['revoked', EMAIL('revoked'), PASSWORD], ['owner-no-platform-role', EMAIL('owner'), PASSWORD],
  ['customer-no-admin-role', 'customer001@fixture.takosan.test', PASSWORD], ['unknown-user', 'nobody@fixture.takosan.test', PASSWORD],
  ['super-wrong-password', EMAIL('super'), 'wrong-password-123'],
]) {
  await resetDb();
  const ctx = await newContext(browser);
  const page = await ctx.newPage();
  const rec = instrument(page);
  let loginResp = null;
  page.on('response', async (r) => { if (r.url().endsWith('/api/v1/admin/auth/login')) { loginResp = { status: r.status(), body: await r.json().catch(() => null) }; } });
  await login(page, email, password);
  await page.getByTestId('admin-login-error').waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
  const errorText = await page.getByTestId('admin-login-error').textContent().catch(() => null);
  const me = await pageApi(page, '/api/v1/admin/me');
  out.login[label] = { url: new URL(page.url()).pathname, errorText, loginStatus: loginResp?.status, loginCode: loginResp?.body?.code, loginError: loginResp?.body?.error, meAfter: me.status, meCode: me.code, pageErrors: rec.pageErrors };
  if (label === 'revoked' || label === 'owner-no-platform-role') await page.screenshot({ path: `/tmp/review/gate-d/screens/login-denied-${label}.png`, fullPage: true });
  await ctx.close();
}

for (const { key, role } of ROLES) {
  await resetDb();
  const ctx = await newContext(browser);
  const page = await ctx.newPage();
  const rec = instrument(page);
  await login(page, EMAIL(key));
  await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 }).catch(async () => { out.roles[key] = { loginFailed: true, url: page.url(), errorText: await page.getByTestId('admin-login-error').textContent().catch(() => null) }; console.log('LOGIN FAILED', key, out.roles[key]); await ctx.close(); });
  if (out.roles[key]?.loginFailed) continue;
  await page.waitForLoadState('networkidle').catch(() => {});
  const me = await pageApi(page, '/api/v1/admin/me');
  const roleRes = { role, meRoles: me.data?.roles, navExpected: {}, navObserved: {}, routes: [], actions: {}, serverCalls: [], consoleErrors: [], pageErrors: [] };
  for (const [id, perms] of Object.entries(NAV)) {
    roleRes.navExpected[id] = perms.some((p) => allowed(role, p));
    roleRes.navObserved[id] = (await page.getByTestId(`admin-nav-${id}`).count()) > 0;
  }
  for (const route of ROUTES) {
    const a = rec.api.length;
    await page.goto(`${BASE}${route.path}`);
    await Promise.race([
      page.getByTestId('admin-permission-denied').waitFor({ timeout: 12000 }),
      page.waitForSelector(route.marker, { timeout: 12000 }),
    ]).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(300);
    const denied = await page.getByTestId('admin-permission-denied').count();
    const marker = await page.locator(route.marker).count();
    const err = await page.getByTestId('admin-error-state').count();
    const api = rec.api.slice(a);
    const isAllowed = allowed(role, route.perm);
    const match = isAllowed ? (denied === 0 && marker > 0 && err === 0 && api.every((x) => x.status < 300)) : (denied === 1 && marker === 0 && api.length === 0);
    roleRes.routes.push({ path: route.path, perm: route.perm, expectedAllowed: isAllowed, denied, marker, errState: err, apiStatuses: api.map((x) => `${x.status} ${x.path}`), match });
  }
  // Action controls (UI) per screen
  await page.goto(`${BASE}/admin/users/fx_user_001`); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(300);
  roleRes.actions.revealEmailButton = { expected: allowed(role, 'users.pii.reveal'), observed: (await page.getByTestId('admin-reveal-email').count()) > 0 };
  await page.goto(`${BASE}/admin/recipes/imp-c6e706b483805e44`); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(300);
  roleRes.actions.recipeReviewForm = { expected: allowed(role, 'recipes.review'), observed: (await page.getByTestId('admin-recipe-review-form').count()) > 0 };
  await page.goto(`${BASE}/admin/settings`); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(500);
  roleRes.actions.grantForm = { expected: allowed(role, 'admin.roles.manage'), observed: (await page.getByTestId('admin-grant-form').count()) > 0 };
  roleRes.actions.roleRevokeButtons = { expected: allowed(role, 'admin.roles.manage'), observed: await page.locator('[data-testid="admin-role-assignment-row"] button').count() };
  roleRes.actions.approvalButtons = { expected: allowed(role, 'admin.approvals.decide'), observed: await page.locator('[data-testid="admin-approval-row"] button').count() };
  roleRes.actions.sessionRevokeButtons = { expected: allowed(role, 'admin.sessions.revoke'), observed: await page.locator('[data-testid="admin-session-row"] button').count() };
  roleRes.actions.preferencesForm = { expected: true, observed: (await page.getByTestId('admin-preferences-form').count()) > 0 };
  roleRes.actions.settingsMatrix = { expected: true, observed: (await page.getByTestId('admin-settings-matrix').count()) > 0 };
  // Server-side contract for each permission-gated endpoint
  for (const [method, path, perm, body] of API) {
    const r = await pageApi(page, path, { method, body });
    const denied = allowed(role, perm) ? false : true;
    const ok = denied ? r.status === 403 && r.code === 'ADMIN_FORBIDDEN' : r.status !== 403;
    roleRes.serverCalls.push({ method, path, perm, expectedDenied: denied, status: r.status, code: r.code, match: ok });
  }
  roleRes.consoleErrors = rec.consoleErrors.map((c) => c.text).slice(0, 20);
  roleRes.pageErrors = rec.pageErrors;
  out.roles[key] = roleRes;
  await ctx.close();
}
await browser.close();
writeResult('s4-roles', out);
// Compact printout
for (const [key, r] of Object.entries(out.roles)) {
  const navMis = Object.keys(r.navExpected).filter((k) => r.navExpected[k] !== r.navObserved[k]);
  const routeMis = r.routes.filter((x) => !x.match).map((x) => `${x.path}(allowed=${x.expectedAllowed},denied=${x.denied},marker=${x.marker},err=${x.errState},api=${x.apiStatuses.join('|')})`);
  const actMis = Object.entries(r.actions).filter(([, v]) => (typeof v.observed === 'boolean' ? v.observed !== v.expected : (v.expected ? false : v.observed > 0))).map(([k, v]) => `${k}:${JSON.stringify(v)}`);
  const srvMis = r.serverCalls.filter((c) => !c.match).map((c) => `${c.method} ${c.path} expDenied=${c.expectedDenied} got=${c.status}/${c.code}`);
  console.log(`[${key}] role=${r.role} meRoles=${r.meRoles} navMismatch=${JSON.stringify(navMis)} routeMismatch=${routeMis.length}`);
  routeMis.forEach((x) => console.log('   route-mismatch', x));
  actMis.forEach((x) => console.log('   action-mismatch', x));
  srvMis.forEach((x) => console.log('   server-mismatch', x));
  console.log('   actions:', JSON.stringify(Object.fromEntries(Object.entries(r.actions).map(([k, v]) => [k, v.observed]))), 'pageErrors', r.pageErrors.length, 'consoleErr', r.consoleErrors.length);
}
for (const [k, v] of Object.entries(out.login)) console.log('[login]', k, JSON.stringify(v));
