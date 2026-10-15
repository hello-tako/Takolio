import { BASE, OUT, EMAIL, resetDb, launch, newContext, instrument, writeResult, login, VIEWPORTS, AxeBuilder } from './lib.mjs';
const out = { axe: {}, keyboard: {}, drawer: {}, overflow: {}, banner: {} };
const settle = (page) => page.waitForLoadState('networkidle').catch(() => {}).then(() => page.waitForTimeout(300));
await resetDb();
const browser = await launch();
const SCREENS = [['overview', '/admin/', '[data-testid^="admin-metric-"]'], ['users', '/admin/users', '[data-testid="admin-user-row"]'], ['user-detail', '/admin/users/fx_user_001', '[data-testid="admin-user-detail"]'],
  ['households', '/admin/households', '[data-testid="admin-household-row"]'], ['billing', '/admin/billing', '[data-testid="admin-transaction-row"]'], ['ai', '/admin/ai', '[data-testid="admin-ai-usage-row"]'],
  ['recipes', '/admin/recipes', '[data-testid="admin-recipe-row"]'], ['recipe-detail', '/admin/recipes/imp-c6e706b483805e44', '[data-testid="admin-recipe-detail"]'],
  ['system', '/admin/system', 'h1[data-testid="admin-page-title"]'], ['audit', '/admin/audit', '[data-testid="admin-audit-row"]'], ['settings', '/admin/settings', '[data-testid="admin-preferences-form"]']];
const summarize = (res) => {
  const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const rules = res.violations.map((v) => { byImpact[v.impact] = (byImpact[v.impact] ?? 0) + 1; return { id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }; });
  return { violationRules: rules.length, byImpact, rules, passes: res.passes.length, incomplete: res.incomplete.length };
};

// A) axe on every screen (desktop 1440x900)
{
  const anon = await newContext(browser, VIEWPORTS['1440x900']);
  const lp = await anon.newPage();
  await lp.goto(`${BASE}/admin/login`); await lp.getByTestId('admin-login-submit').waitFor(); await settle(lp);
  out.axe.login = summarize(await new AxeBuilder({ page: lp }).analyze());
  await anon.close();
}
const ctx = await newContext(browser, VIEWPORTS['1440x900']);
const page = await ctx.newPage();
await login(page, EMAIL('super')); await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
for (const [id, path, marker] of SCREENS) {
  await page.goto(`${BASE}${path}`);
  await page.waitForSelector(marker, { timeout: 15000 }).catch(() => {});
  await settle(page);
  out.axe[id] = summarize(await new AxeBuilder({ page }).analyze());
}

// B) Keyboard: skip link, tab order, visible focus, dialog Esc + focus return
await page.goto(`${BASE}/admin/users`); await settle(page);
const focusInfo = () => page.evaluate(() => {
  const e = document.activeElement; if (!e || e === document.body) return { tag: 'BODY' };
  const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
  return { tag: e.tagName, testid: e.getAttribute('data-testid'), id: e.id || null, text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 50), href: e.getAttribute('href'), outline: `${cs.outlineStyle} ${cs.outlineWidth}`, boxShadow: cs.boxShadow !== 'none', rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
});
await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.press('Tab');
out.keyboard.firstTab = await focusInfo();
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
out.keyboard.afterSkipEnter = await page.evaluate(() => ({ active: document.activeElement?.id || document.activeElement?.tagName, mainFocused: document.activeElement === document.getElementById('admin-main') }));
const seq = [];
await page.evaluate(() => document.activeElement?.blur());
for (let i = 0; i < 30; i++) { await page.keyboard.press('Tab'); const f = await focusInfo(); seq.push(`${f.testid ?? f.id ?? f.tag}:${f.text ?? ''}`.slice(0, 70)); }
out.keyboard.tabSequence = seq;
out.keyboard.reachesNavLinks = seq.filter((s) => s.startsWith('admin-nav-')).length;
out.keyboard.reachesSearch = seq.some((s) => s.startsWith('admin-users-search'));
// Focus style on a nav link and a primary button
await page.getByTestId('admin-nav-billing').focus();
out.keyboard.focusStyleNav = await focusInfo();
await page.getByTestId('admin-users-search').focus();
out.keyboard.focusStyleInput = await focusInfo();
// Revoke dialog on settings: Esc closes and returns focus to the trigger
await page.goto(`${BASE}/admin/settings`); await settle(page);
const revokeBtn = page.locator('[data-testid="admin-role-assignment-row"]').first().getByRole('button', { name: 'Thu hồi' });
await revokeBtn.click(); await page.waitForTimeout(200);
out.keyboard.revokeDialogOpenFocus = await page.evaluate(() => ({ inDialog: !!document.activeElement?.closest('[role="dialog"]'), tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.slice(0, 30) }));
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
out.keyboard.revokeDialogEsc = { closed: (await page.getByTestId('admin-revoke-dialog').count()) === 0, focusReturnedToRevokeBtn: await page.evaluate(() => document.activeElement?.textContent?.includes('Thu hồi') ?? false) };

// C) Mobile drawer at 390x844 + overflow offenders
const mctx = await newContext(browser, VIEWPORTS['390x844']);
const mp = await mctx.newPage();
await login(mp, EMAIL('super')); await mp.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
await mp.goto(`${BASE}/admin/users`); await settle(mp);
const sidebarRect = () => mp.evaluate(() => { const r = document.getElementById('admin-sidebar').getBoundingClientRect(); return [Math.round(r.x), Math.round(r.right)]; });
out.drawer.closedRect = await sidebarRect();
await mp.getByTestId('admin-mobile-menu').click(); await mp.waitForTimeout(400);
out.drawer.open = { expanded: await mp.getByTestId('admin-mobile-menu').getAttribute('aria-expanded'), rect: await sidebarRect(), backdrop: await mp.locator('.drawer-backdrop').count(), sidebarOpenClass: await mp.evaluate(() => document.getElementById('admin-sidebar').className) };
await mp.locator('.drawer-backdrop').click({ position: { x: 370, y: 400 } }); await mp.waitForTimeout(400);
out.drawer.afterBackdrop = { expanded: await mp.getByTestId('admin-mobile-menu').getAttribute('aria-expanded'), rect: await sidebarRect() };
await mp.getByTestId('admin-mobile-menu').click(); await mp.waitForTimeout(300);
await mp.keyboard.press('Escape'); await mp.waitForTimeout(300);
out.drawer.afterEsc = { expanded: await mp.getByTestId('admin-mobile-menu').getAttribute('aria-expanded') };
await mp.getByTestId('admin-mobile-menu').click(); await mp.waitForTimeout(300);
await mp.getByTestId('admin-nav-billing').click(); await settle(mp); await mp.waitForTimeout(300);
out.drawer.afterNavClick = { path: new URL(mp.url()).pathname, expanded: await mp.getByTestId('admin-mobile-menu').getAttribute('aria-expanded') };
const offenders = async (route) => { await mp.goto(`${BASE}${route}`); await settle(mp); return mp.evaluate(() => {
  const iw = window.innerWidth;
  const clipped = (el) => { let p = el.parentElement; while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|hidden|scroll|clip)/.test(s.overflowX)) return true; p = p.parentElement; } return false; };
  const bad = Array.from(document.body.querySelectorAll('*')).filter((e) => e.getBoundingClientRect().right > iw + 1 && !clipped(e));
  return { scrollWidth: document.documentElement.scrollWidth, innerWidth: iw, offenders: bad.slice(0, 6).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}[${e.getAttribute('data-testid') ?? ''}] right=${Math.round(e.getBoundingClientRect().right)} text=${(e.textContent ?? '').trim().slice(0, 30)}`) }; }); };
for (const route of ['/admin/', '/admin/users', '/admin/households', '/admin/billing', '/admin/ai', '/admin/recipes', '/admin/recipes/imp-c6e706b483805e44', '/admin/system', '/admin/audit', '/admin/settings']) {
  out.overflow[`390 ${route}`] = await offenders(route);
}
// Denied state still shows the fixture banner (support role on recipes)
await mctx.close();
const sctx = await newContext(browser, VIEWPORTS['1440x900']);
const sp = await sctx.newPage();
await resetDb();
await login(sp, EMAIL('support')); await sp.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
await sp.goto(`${BASE}/admin/recipes`); await settle(sp);
out.banner.deniedRecipesAsSupport = { denied: await sp.getByTestId('admin-permission-denied').count(), banner: await sp.getByTestId('admin-fixture-banner').count(), bannerText: (await sp.getByTestId('admin-fixture-banner').textContent().catch(() => null)) };
await sp.screenshot({ path: `${OUT}/screens/state-denied-support-recipes.png`, fullPage: true });
await browser.close();
writeResult('s7-a11y', out);
console.log(JSON.stringify(out, null, 1));
