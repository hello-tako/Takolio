import { BASE, VIEWPORTS, OUT, EMAIL, resetDb, launch, newContext, instrument, writeResult, login } from './lib.mjs';

const SCREENS = [
  { id: 'overview', path: '/admin/', marker: '[data-testid^="admin-metric-"]', min: 5 },
  { id: 'users', path: '/admin/users', marker: '[data-testid="admin-user-row"]', min: 1 },
  { id: 'user-detail', path: '/admin/users/fx_user_001', marker: '[data-testid="admin-user-detail"]', min: 1 },
  { id: 'households', path: '/admin/households', marker: '[data-testid="admin-household-row"]', min: 1 },
  { id: 'billing', path: '/admin/billing', marker: '[data-testid="admin-transaction-row"]', min: 1 },
  { id: 'ai', path: '/admin/ai', marker: '[data-testid="admin-ai-usage-row"]', min: 1 },
  { id: 'recipes', path: '/admin/recipes', marker: '[data-testid="admin-recipe-row"]', min: 1 },
  { id: 'recipe-detail', path: '/admin/recipes/imp-c6e706b483805e44', marker: '[data-testid="admin-recipe-detail"]', min: 1 },
  { id: 'system', path: '/admin/system', marker: 'h1[data-testid="admin-page-title"]', min: 1 },
  { id: 'audit', path: '/admin/audit', marker: '[data-testid="admin-audit-row"]', min: 1 },
  { id: 'settings', path: '/admin/settings', marker: '[data-testid="admin-preferences-form"]', min: 1 },
];

async function visit(page, rec, screen, vpName) {
  const a = rec.api.length, c = rec.consoleErrors.length, p = rec.pageErrors.length;
  await page.goto(screen.path);
  let markerCount = -1, note = '';
  try {
    await page.waitForSelector(screen.marker, { timeout: 15000 });
    markerCount = await page.locator(screen.marker).count();
  } catch (e) {
    note = `marker timeout: ${e.message.split('\n')[0]}`;
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);
  const title = await page.getByTestId('admin-page-title').first().textContent().catch(() => null);
  const banner = await page.getByTestId('admin-fixture-banner').count();
  const errorState = await page.getByTestId('admin-error-state').count();
  const denied = await page.getByTestId('admin-permission-denied').count();
  const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  await page.screenshot({ path: `${OUT}/screens/${vpName}-${screen.id}.png`, fullPage: true });
  const api = rec.api.slice(a);
  return {
    screen: screen.id, path: screen.path, loaded: markerCount >= (screen.min ?? 1) && !errorState && !denied, markerCount, title,
    banner: banner > 0, errorState, denied, overflow, note,
    apiNon2xx: api.filter((x) => x.status >= 300), apiCount: api.length,
    consoleErrors: rec.consoleErrors.slice(c), pageErrors: rec.pageErrors.slice(p),
  };
}

await resetDb();
const browser = await launch();
const summary = [];
for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  const ctx = await newContext(browser, vp);
  const page = await ctx.newPage();
  const rec = instrument(page);
  const results = [];
  // Login screen (anonymous)
  const la = rec.api.length, lc = rec.consoleErrors.length, lp = rec.pageErrors.length;
  await page.goto('/admin/login');
  await page.getByTestId('admin-login-submit').waitFor();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({ path: `${OUT}/screens/${vpName}-login.png`, fullPage: true });
  results.push({ screen: 'login', loaded: true, banner: (await page.getByTestId('admin-fixture-banner').count()) > 0,
    overflow: await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })),
    apiNon2xx: rec.api.slice(la).filter((x) => x.status >= 300), consoleErrors: rec.consoleErrors.slice(lc), pageErrors: rec.pageErrors.slice(lp) });
  await login(page, EMAIL('super'));
  await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
  for (const screen of SCREENS) results.push(await visit(page, rec, screen, vpName));
  writeResult(`s1-${vpName}`, results);
  for (const r of results) summary.push({ vp: vpName, screen: r.screen, loaded: r.loaded, markers: r.markerCount, banner: r.banner, non2xx: (r.apiNon2xx ?? []).length, api: r.apiCount, consoleErr: (r.consoleErrors ?? []).length, pageErr: (r.pageErrors ?? []).length, overflowPx: r.overflow ? r.overflow.scrollWidth - r.overflow.innerWidth : null, note: r.note ?? '' });
  await ctx.close();
}
await browser.close();
console.table(summary);
