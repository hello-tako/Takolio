import { BASE, OUT, EMAIL, resetDb, launch, newContext, login, VIEWPORTS } from './lib.mjs';
const settle = (page) => page.waitForLoadState('networkidle').catch(() => {}).then(() => page.waitForTimeout(300));
await resetDb();
const browser = await launch();
const res = {};
for (const [label, vp, route] of [['390 settings', VIEWPORTS['390x844'], '/admin/settings'], ['820 settings', VIEWPORTS['820x1180'], '/admin/settings'], ['390 overview', VIEWPORTS['390x844'], '/admin/'], ['390 billing', VIEWPORTS['390x844'], '/admin/billing']]) {
  const c = await newContext(browser, vp);
  const p = await c.newPage();
  await login(p, EMAIL('super')); await p.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
  await p.goto(`${BASE}${route}`); await settle(p);
  res[label] = await p.evaluate(async () => {
    const before = { x: window.scrollX, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
    window.scrollTo(2000, 0); await new Promise((r) => setTimeout(r, 100));
    const after = window.scrollX; window.scrollTo(0, 0);
    const wraps = Array.from(document.querySelectorAll('.table-wrap')).map((w) => ({ sw: w.scrollWidth, cw: w.clientWidth }));
    return { ...before, scrollXAfterScrollTo: after, tableWraps: wraps };
  });
  await c.close();
}
await browser.close();
console.log(JSON.stringify(res, null, 1));
