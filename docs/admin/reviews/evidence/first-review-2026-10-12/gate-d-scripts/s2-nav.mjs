import { BASE, EMAIL, resetDb, launch, newContext, instrument, writeResult, login } from './lib.mjs';
const checks = [];
const record = (area, name, pass, extra = {}) => checks.push({ area, name, pass, ...extra });
const settle = (page) => page.waitForLoadState('networkidle').catch(() => {}).then(() => page.waitForTimeout(300));
const titleOf = (page) => page.getByTestId('admin-page-title').first().textContent().catch(() => null);

await resetDb();
const browser = await launch();
const ctx = await newContext(browser);
const page = await ctx.newPage();
const rec = instrument(page);
await login(page, EMAIL('super'));
await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
await settle(page);

const navs = [['overview', '/admin/'], ['users', '/admin/users'], ['billing', '/admin/billing'], ['ai', '/admin/ai'],
  ['recipes', '/admin/recipes'], ['system', '/admin/system'], ['audit', '/admin/audit'], ['settings', '/admin/settings']];
for (const [id, expectPath] of navs) {
  const link = page.getByTestId(`admin-nav-${id}`);
  const href = await link.getAttribute('href');
  await link.click();
  await settle(page);
  const path = new URL(page.url()).pathname;
  const title = await titleOf(page);
  const notFound = await page.getByTestId('admin-not-found').count();
  const current = await link.getAttribute('aria-current');
  record('nav', `sidebar ${id}`, path === expectPath && notFound === 0 && !!title && current === 'page', { href, path, title, ariaCurrent: current });
}

// Users <-> households tabs
await page.goto(`${BASE}/admin/users`); await settle(page);
await page.getByTestId('admin-households-tab').click(); await settle(page);
record('nav', 'users tab -> households tab', new URL(page.url()).pathname === '/admin/households' && (await page.getByTestId('admin-household-row').count()) > 0, { path: new URL(page.url()).pathname });
await page.getByTestId('admin-users-tab').click(); await settle(page);
record('nav', 'households tab -> users tab', new URL(page.url()).pathname === '/admin/users' && (await page.getByTestId('admin-user-row').count()) > 0, { path: new URL(page.url()).pathname });

// Unknown route
await page.goto(`${BASE}/admin/does-not-exist`); await settle(page);
const nf = await page.getByTestId('admin-not-found').count();
const nfBanner = await page.getByTestId('admin-fixture-banner').count();
const nfSidebar = await page.getByTestId('admin-nav-overview').count();
await page.locator('.state-empty a', { hasText: 'Về tổng quan' }).click(); await settle(page);
record('nav', '404 unknown route', nf === 1 && nfBanner === 1 && nfSidebar === 1, { notFoundShown: nf, bannerVisible: nfBanner, shellSidebar: nfSidebar, backLinkPath: new URL(page.url()).pathname });

// Browser history
await page.goto(`${BASE}/admin/`); await settle(page);
await page.getByTestId('admin-nav-users').click(); await settle(page);
await page.getByTestId('admin-nav-billing').click(); await settle(page);
await page.goBack(); await settle(page);
const backPath = new URL(page.url()).pathname;
await page.goBack(); await settle(page);
const back2Path = new URL(page.url()).pathname;
await page.goForward(); await settle(page);
const fwdPath = new URL(page.url()).pathname;
record('nav', 'history back/forward', backPath === '/admin/users' && back2Path === '/admin/' && fwdPath === '/admin/users' && (await page.getByTestId('admin-user-row').count()) > 0, { backPath, back2Path, fwdPath });

// Deep links and reload
for (const [path, marker] of [['/admin/users/fx_user_001', 'admin-user-detail'], ['/admin/recipes/imp-c6e706b483805e44', 'admin-recipe-detail'], ['/admin/recipes/nope-missing', 'admin-error-state']]) {
  await page.goto(`${BASE}${path}`); await settle(page);
  await page.reload(); await settle(page);
  const count = await page.getByTestId(marker).count();
  const notFound = await page.getByTestId('admin-not-found').count();
  const errTxt = (await page.getByTestId('admin-error-state').textContent().catch(() => '')) ?? '';
  record('deeplink', `reload ${path}`, count >= 1, { marker, count, notFound, errorText: errTxt.slice(0, 160), finalPath: new URL(page.url()).pathname });
}
// Users detail back link
await page.goto(`${BASE}/admin/users/fx_user_001`); await settle(page);
await page.locator('a', { hasText: 'Về danh sách người dùng' }).first().click(); await settle(page);
record('nav', 'user detail back link', new URL(page.url()).pathname === '/admin/users', { path: new URL(page.url()).pathname });

// Sidebar collapse toggle
await page.goto(`${BASE}/admin/`); await settle(page);
const toggle = page.getByTestId('admin-sidebar-toggle');
const e0 = await toggle.getAttribute('aria-expanded');
await toggle.click(); await page.waitForTimeout(300);
const e1 = await toggle.getAttribute('aria-expanded');
await toggle.click(); await page.waitForTimeout(300);
const e2 = await toggle.getAttribute('aria-expanded');
record('nav', 'sidebar collapse toggle', e0 === 'true' && e1 === 'false' && e2 === 'true', { e0, e1, e2 });

// Crawl internal links on every authenticated screen, then visit each unique target
const screens = ['/admin/', '/admin/users', '/admin/users/fx_user_001', '/admin/households', '/admin/billing', '/admin/ai', '/admin/recipes', '/admin/recipes/imp-c6e706b483805e44', '/admin/system', '/admin/audit', '/admin/settings'];
const hrefs = new Set();
for (const s of screens) {
  await page.goto(`${BASE}${s}`); await settle(page);
  const list = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
  list.forEach((h) => hrefs.add(h));
}
const internal = [...hrefs].filter((h) => h && h.startsWith('/admin'));
const external = [...hrefs].filter((h) => h && !h.startsWith('/admin') && !h.startsWith('#'));
const deadLinks = [];
for (const h of internal) {
  await page.goto(`${BASE}${h}`); await settle(page);
  const nfc = await page.getByTestId('admin-not-found').count();
  if (nfc > 0) deadLinks.push(h);
}
record('nav', 'no dead internal links', deadLinks.length === 0, { internalCount: internal.length, internal, deadLinks, externalOrOther: external });

await browser.close();
writeResult('s2-nav', { checks, consoleErrors: rec.consoleErrors, pageErrors: rec.pageErrors, non2xx: rec.api.filter((x) => x.status >= 300) });
console.log(JSON.stringify(checks.map(({ area, name, pass, ...rest }) => ({ area, name, pass, ...rest })), null, 1));
console.log('console errors:', rec.consoleErrors.length, 'page errors:', rec.pageErrors.length, 'non2xx:', rec.api.filter((x) => x.status >= 300).length);
