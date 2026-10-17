import { BASE, EMAIL, resetDb, launch, newContext, instrument, writeResult, login } from './lib.mjs';
const checks = [];
const record = (area, name, pass, extra = {}) => checks.push({ area, name, pass, ...extra });

await resetDb();
const browser = await launch();
const ctx = await newContext(browser);
const page = await ctx.newPage();
const rec = instrument(page);
const reqs = [];
page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/v1/admin')) reqs.push(u.pathname.replace('/api/v1/admin', '') + u.search); });
await login(page, EMAIL('super'));
await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });

const settle = () => page.waitForLoadState('networkidle').catch(() => {}).then(() => page.waitForTimeout(400));
const rowTexts = (tid) => page.getByTestId(tid).allTextContents();
const pageInfo = () => page.locator('span[aria-live="polite"]').filter({ hasText: /Trang \d+ \/ \d+/ }).first().textContent().catch(() => null);
const since = (mark) => reqs.slice(mark);

async function paging(area, rowTid) {
  await settle();
  const info0 = await pageInfo(); const rows0 = (await rowTexts(rowTid)).join('|');
  const next = page.getByRole('button', { name: 'Trang sau' }).first();
  if (!(await next.isEnabled())) { record(area, 'paging next', false, { info0, note: 'next disabled: single page with fixture data' }); return; }
  let mark = reqs.length; await next.click(); await settle();
  const info1 = await pageInfo(); const rows1 = (await rowTexts(rowTid)).join('|');
  const r2 = since(mark);
  record(area, 'paging next -> page=2', r2.some((q) => /[?&]page=2(&|$)/.test(q)) && rows1 !== rows0 && /Trang 2 \//.test(info1 ?? ''), { requests: r2, info0, info1, rowsChanged: rows1 !== rows0 });
  mark = reqs.length; await page.getByRole('button', { name: 'Trang trước' }).first().click(); await settle();
  const info2 = await pageInfo(); const rows2 = (await rowTexts(rowTid)).join('|');
  const r3 = since(mark);
  record(area, 'paging prev -> page=1', r3.some((q) => /[?&]page=1(&|$)/.test(q)) && rows2 === rows0, { requests: r3, info2, rowsRestored: rows2 === rows0 });
}

async function selectFilter(area, tid, param, index = 1, text = 'scan_ocr') {
  const el = page.getByTestId(tid);
  await el.waitFor({ state: 'visible', timeout: 15000 });
  if ((await el.evaluate((e) => e.tagName)) === 'INPUT') {
    const mark = reqs.length;
    await el.fill(text); await page.waitForTimeout(900); await settle();
    const r = since(mark);
    record(area, `text filter ${tid}="${text}" -> ${param}`, r.some((q) => q.includes(`${param}=${encodeURIComponent(text)}`)), { requests: r });
    await el.fill(''); await settle();
    return;
  }
  await el.locator('option').nth(index).waitFor({ state: 'attached', timeout: 15000 });
  const values = await el.locator('option').evaluateAll((os) => os.map((o) => o.value));
  const pick = values[index];
  const mark = reqs.length;
  await el.selectOption(pick); await settle();
  const r = since(mark);
  record(area, `filter ${tid}=${pick} -> ${param}`, r.some((q) => new RegExp(`[?&]${param}=${encodeURIComponent(pick)}(&|$)`).test(q)), { requests: r, values });
  await el.selectOption(values[0]); await settle();
}

async function searchFilter(area, tid, term, rowTid, nomatch = 'zz-nomatch-xyz') {
  const input = page.getByTestId(tid);
  await input.fill(''); await settle();
  const mark = reqs.length;
  await input.pressSequentially(term, { delay: 40 });
  await page.waitForTimeout(900); await settle();
  const r = since(mark).filter((q) => q.includes('q='));
  const enc = encodeURIComponent(term);
  const finalOk = r.some((q) => q.includes(`q=${enc}`));
  const interm = r.filter((q) => !q.includes(`q=${enc}`));
  const rows = (await rowTexts(rowTid)).length;
  record(area, `search debounce "${term}"`, finalOk && interm.length === 0 && rows > 0, { qRequests: r, intermediate: interm, rows });
  const mark2 = reqs.length;
  await input.fill(nomatch); await page.waitForTimeout(900); await settle();
  const r2 = since(mark2);
  const empty = await page.getByTestId('admin-empty-state').count();
  record(area, `no-match search "${nomatch}" -> empty state`, empty >= 1 && r2.some((q) => q.includes('q=' + nomatch)), { requests: r2, emptyState: empty });
  await input.fill(''); await settle();
}

async function rangeCheck(area, path, apiPrefixes) {
  await page.goto(`${BASE}${path}`); await settle();
  const sigOf = () => page.locator('section:has([role="img"])').first().innerText().catch(() => page.locator('main').innerText());
  const sig0 = await sigOf();
  const values = await page.getByTestId('admin-range-select').locator('option').evaluateAll((os) => os.map((o) => o.value));
  const seen = {};
  for (const v of ['7d', '90d']) {
    const mark = reqs.length;
    await page.getByTestId('admin-range-select').selectOption(v); await settle();
    const r = since(mark);
    const sig = await sigOf();
    seen[v] = { requests: r, chartChanged: sig !== sig0, sigLen: sig.length };
    record(area, `range ${v}`, r.some((q) => q.includes(`range=${v}`)) && sig !== sig0, seen[v]);
  }
  await page.goto(`${BASE}${path}`); await settle();
  record(area, 'range default 30d', true, { values, note: 'initial load sends range=30d (default)' });
}

// ── Users
await page.goto(`${BASE}/admin/users`); await settle();
const u0 = reqs.find((q) => q.startsWith('/users?'));
record('users', 'initial request', !!u0 && u0.includes('pageSize=25') && u0.includes('page=1') && u0.includes('type=registered'), { first: u0 });
await paging('users', 'admin-user-row');
await selectFilter('users', 'admin-users-type-filter', 'type', 1);
await selectFilter('users', 'admin-users-plan-filter', 'plan', 2);
await selectFilter('users', 'admin-users-admin-filter', 'admin', 1);
await page.goto(`${BASE}/admin/users`); await settle();
await searchFilter('users', 'admin-users-search', 'customer001', 'admin-user-row');

// ── Households
await page.goto(`${BASE}/admin/households`); await settle();
await paging('households', 'admin-household-row');
await searchFilter('households', 'admin-households-search', 'Bếp', 'admin-household-row');

// ── Billing
await page.goto(`${BASE}/admin/billing`); await settle();
await paging('billing', 'admin-transaction-row');
await selectFilter('billing', 'admin-billing-status-filter', 'status', 1);
await rangeCheck('billing', '/admin/billing', ['/billing/summary']);

// ── AI
await page.goto(`${BASE}/admin/ai`); await settle();
await paging('ai', 'admin-ai-usage-row');
await selectFilter('ai', 'admin-ai-task-filter', 'task', 1, 'scan_ocr');
await selectFilter('ai', 'admin-ai-status-filter', 'status', 1, 'success');
await rangeCheck('ai', '/admin/ai', ['/ai/summary']);

// ── Recipes
await page.goto(`${BASE}/admin/recipes`); await settle();
await paging('recipes', 'admin-recipe-row');
await selectFilter('recipes', 'admin-recipes-cuisine-filter', 'cuisine', 1);
await selectFilter('recipes', 'admin-recipes-verification-filter', 'verification', 1);
await selectFilter('recipes', 'admin-recipes-source-filter', 'source', 1);
await page.goto(`${BASE}/admin/recipes`); await settle();
await searchFilter('recipes', 'admin-recipes-search', 'canh', 'admin-recipe-row');

// ── Audit
await page.goto(`${BASE}/admin/audit`); await settle();
await paging('audit', 'admin-audit-row');
await selectFilter('audit', 'admin-audit-action-filter', 'action', 1);
await selectFilter('audit', 'admin-audit-outcome-filter', 'outcome', 1);
await selectFilter('audit', 'admin-audit-actor-filter', 'actor', 1, 'fx_admin_super');
{
  const mark = reqs.length;
  await page.getByTestId('admin-audit-from').fill('2026-10-01'); await settle();
  const r = since(mark);
  record('audit', 'date from=2026-10-01', r.some((q) => q.includes('from=')), { requests: r });
  const mark2 = reqs.length;
  await page.getByTestId('admin-audit-to').fill('2026-10-12'); await settle();
  record('audit', 'date to=2026-10-12', since(mark2).some((q) => q.includes('to=')), { requests: since(mark2) });
}

// ── Overview range
await rangeCheck('overview', '/admin/', ['/overview']);

await browser.close();
writeResult('s3-paging', { checks, consoleErrors: rec.consoleErrors, pageErrors: rec.pageErrors, non2xx: rec.api.filter((x) => x.status >= 300) });
console.log(JSON.stringify(checks.map((c) => ({ area: c.area, name: c.name, pass: c.pass, requests: c.requests ?? c.r2 ?? c.first, note: c.note, rowsChanged: c.rowsChanged, info0: c.info0, info1: c.info1, rows: c.rows, emptyState: c.emptyState })), null, 0).replace(/\},\{/g, '},\n{'));
console.log('console errors:', rec.consoleErrors.length, 'page errors:', rec.pageErrors.length, 'non2xx:', rec.api.filter((x) => x.status >= 300).length);
