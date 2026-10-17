import { BASE, OUT, EMAIL, resetDb, launch, newContext, instrument, writeResult, login, VIEWPORTS, AxeBuilder } from './lib.mjs';
const out = {};
const settle = (page) => page.waitForLoadState('networkidle').catch(() => {}).then(() => page.waitForTimeout(300));
await resetDb();
const browser = await launch();
// (a) axe node targets
const ctx = await newContext(browser, VIEWPORTS['1440x900']);
const page = await ctx.newPage();
await login(page, EMAIL('super')); await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
for (const [id, path, marker] of [['overview', '/admin/', '[data-testid^="admin-metric-"]'], ['settings', '/admin/settings', '[data-testid="admin-preferences-form"]']]) {
  await page.goto(`${BASE}${path}`); await page.waitForSelector(marker); await settle(page);
  const res = await new AxeBuilder({ page }).withRules(['heading-order', 'scrollable-region-focusable']).analyze();
  out[`axeTargets-${id}`] = res.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ target: n.target, html: n.html.slice(0, 160), summary: (n.failureSummary || '').slice(0, 160) })) }));
  out[`headings-${id}`] = await page.$$eval('h1,h2,h3,h4', (hs) => hs.map((h) => `${h.tagName}:${(h.textContent || '').trim().slice(0, 40)}`));
}
// (b) settings overflow source at 390 and 820
for (const [label, vp] of [['820', VIEWPORTS['820x1180']], ['390', VIEWPORTS['390x844']]]) {
  const c = await newContext(browser, vp);
  const p = await c.newPage();
  await login(p, EMAIL('super')); await p.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
  await p.goto(`${BASE}/admin/settings`); await settle(p);
  out[`settingsOverflow-${label}`] = await p.evaluate(() => {
    const iw = window.innerWidth;
    const chain = (el) => { const r = []; let p = el; while (p && p !== document.documentElement) { const s = getComputedStyle(p); r.push(`${p.tagName.toLowerCase()}.${String(p.className).slice(0, 30)}[ox=${s.overflowX},disp=${s.display},w=${Math.round(p.getBoundingClientRect().width)}]`); p = p.parentElement; } return r.slice(0, 6); };
    const wide = Array.from(document.querySelectorAll('body *')).map((e) => ({ e, right: e.getBoundingClientRect().right })).filter((x) => x.right > iw + 1).sort((a, b) => b.right - a.right);
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: iw, widestCount: wide.length, widest: wide.slice(0, 4).map((x) => ({ tag: x.e.tagName.toLowerCase(), cls: String(x.e.className).slice(0, 50), testid: x.e.getAttribute('data-testid'), right: Math.round(x.right), text: (x.e.textContent || '').trim().slice(0, 40), chain: chain(x.e.parentElement) })) };
  });
  await c.close();
}
// (c) login page with auth-config 503: DOM after 8s and console
const cl = await ctx.newPage(); const rl = instrument(cl);
await cl.route(/\/api\/v1\/admin\/auth\/config/, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'x', code: 'ADMIN_AUTH_NOT_CONFIGURED' }) }));
await cl.goto(`${BASE}/admin/login`); await cl.waitForTimeout(8000);
out.loginConfig503 = { mainHtml: (await cl.locator('main').innerHTML()).replace(/\s+/g, ' ').slice(0, 500), errorStates: await cl.getByTestId('admin-error-state').count(), configRequests: rl.api.filter((x) => x.path.includes('auth/config')).length, consoleErrors: rl.consoleErrors.map((c) => c.text), pageErrors: rl.pageErrors };
await cl.screenshot({ path: `${OUT}/screens/state-503-login-config-8s.png`, fullPage: true });
await cl.close();
// (d) how long is the preferences success notice in the DOM after save?
const sp = await ctx.newPage();
await sp.goto(`${BASE}/admin/settings`); await settle(sp);
await sp.evaluate(() => {
  window.__noticeLog = [];
  const t0 = performance.now();
  const obs = new MutationObserver(() => {
    const el = document.querySelector('.form-success');
    const last = window.__noticeLog[window.__noticeLog.length - 1];
    const present = !!el;
    if (present !== (last ? last.present : false)) window.__noticeLog.push({ present, atMs: Math.round(performance.now() - t0), text: el ? el.textContent : null });
  });
  obs.observe(document.body, { childList: true, subtree: true });
  window.__obs = obs;
});
const [putResp] = await Promise.all([
  sp.waitForResponse((r) => r.url().includes('/preferences') && r.request().method() === 'PUT'),
  (async () => { await sp.locator('#admin-pref-density').selectOption('compact'); await sp.getByTestId('admin-preferences-form').locator('button[type="submit"]').click(); })(),
]);
await sp.waitForTimeout(1500);
out.noticeLifetime = await sp.evaluate(() => window.__noticeLog);
out.noticePutStatus = putResp.status();
await sp.locator('#admin-pref-density').selectOption('comfortable');
await sp.getByTestId('admin-preferences-form').locator('button[type="submit"]').click(); await sp.waitForTimeout(500);
// (e) Tab order from a fresh load (no blur games)
await sp.goto(`${BASE}/admin/`); await settle(sp);
const tabs = [];
for (let i = 0; i < 12; i++) {
  await sp.keyboard.press('Tab');
  tabs.push(await sp.evaluate(() => { const e = document.activeElement; return `${e.getAttribute('data-testid') || e.id || e.tagName}:${(e.textContent || '').trim().slice(0, 25)}`; }));
}
out.tabFromTop = tabs;
await browser.close();
writeResult('s8-detail', out);
console.log(JSON.stringify(out, null, 1));
