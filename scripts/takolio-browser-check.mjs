import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.BRAND_URL ?? 'http://127.0.0.1:5230';
assert.equal(new URL(base).hostname, '127.0.0.1');
const stage = process.env.BRAND_STAGE ?? 'after';
const out = resolve(process.env.BRAND_OUT ?? `.artifacts/brand-v3/${stage}`);
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'vi-VN', reducedMotion: 'reduce', serviceWorkers: 'block' });
await context.route((url) => url.origin !== base, (route) => route.abort());
const page = await context.newPage();
page.setDefaultTimeout(30000);
const result = { stage, productionBuild: true, browser: browser.version(), syntheticData: true, providerBlocked: true, checks: [], journeys: [], pageErrors: [], failures: [] };
page.on('pageerror', (error) => result.pageErrors.push(error.message));
async function shot(name, route, prepare) {
  if (process.env.BRAND_SCREEN && name !== process.env.BRAND_SCREEN) return;
  await page.goto(base + route);
  if (prepare) await prepare();
  await page.locator('h1').first().waitFor();
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !document.querySelector('.t17-skeleton'), null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(async () => {
    for (const im of document.images) im.loading = 'eager';
    await document.fonts.ready;
    await Promise.race([new Promise((ok) => setTimeout(ok, 1000)), Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {})))]);
  });
  await page.waitForFunction(() => {
    for (const im of document.images) im.loading = 'eager';
    return [...document.images].every((im) => im.complete && im.naturalWidth > 0) && !document.querySelector('[data-recipe-media=loading]');
  }, null, { timeout: 30000 });
  if (name === 'scan-review') await expect(page.getByRole('button', { name: /Xác nhận nguyên liệu/ })).toBeEnabled();
  await expect(page.locator('h1')).toHaveCount(1);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForLoadState('networkidle');
  const layout = await page.evaluate(() => {
    const visible = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    const logos = [...document.images].filter((im) => visible(im) && /(?:lockup|horizontal|wordmark|symbol).*\.svg$/.test(im.src));
    return {
      width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
      heading: document.querySelector('h1')?.textContent, h1Count: document.querySelectorAll('h1').length,
      font: getComputedStyle(document.querySelector('.takosan-rebuild') ?? document.body).fontFamily,
      broken: [...document.images].filter((im) => !im.naturalWidth).map((im) => im.getAttribute('src')),
      logos: logos.map((im) => ({ src: im.getAttribute('src'), width: im.getBoundingClientRect().width, height: im.getBoundingClientRect().height, naturalRatio: im.naturalWidth / im.naturalHeight })),
      clippedNavigation: [...document.querySelectorAll('.kitchen-nav-label')].filter(visible).filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map((el) => el.textContent),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  });
  // Motion's JS-driven fades are not listed in document.getAnimations().
  // Inspect final appearance only after those visible non-disabled nodes settle.
  await page.waitForFunction(() => ![...document.querySelectorAll('[style*=opacity]')].some((node) => {
    const r = node.getBoundingClientRect(), opacity = Number.parseFloat(node.style.opacity);
    return r.width > 0 && r.height > 0 && opacity > 0 && opacity < 1 && !node.matches(':disabled, [aria-disabled=true]');
  }));
  const axe = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map((n) => ({ target: n.target, summary: n.failureSummary })) }));
  const bodyText = await page.locator('body').innerText();
  // This exact synthetic account name is persisted user data, not product copy.
  const fixtureNameOccurrences = bodyText.split('Frigo Preview').length - 1;
  const legacyBrand = /Takosan|Tako-san|Frigo/i.test(bodyText.replaceAll('Frigo Preview', '[fixture-account]'));
  if (stage !== 'before' && legacyBrand && name !== 'plus') result.failures.push({ name, width: layout.width, kind: 'legacy-visible-brand' });
  const file = `${name}-${layout.width}.png`;
  await page.screenshot({ path: resolve(out, file), fullPage: true });
  const failures = [];
  if (layout.scrollWidth > layout.width) failures.push('horizontal-overflow');
  if (layout.broken.length) failures.push('broken-images');
  if (layout.clippedNavigation.length) failures.push('clipped-navigation');
  if (layout.h1Count !== 1) failures.push('heading-count');
  if (axe.length) failures.push('axe');
  const check = { name, requestedRoute: route, renderedRoute: new URL(page.url()).pathname, screenshot: file, fixtureNameOccurrences, legacyBrand, protectedLegacyDeferred: name === 'plus' && legacyBrand, ...layout, violations: axe, failures };
  result.checks.push(check);
  result.failures.push(...failures.map((kind) => ({ name, width: layout.width, kind })));
  console.log(`${stage} ${name}/${layout.width}: ${failures.join(', ') || 'PASS'}`);
  await writeFile(resolve(out, 'observations.json'), JSON.stringify(result, null, 2) + '\n');
}
async function reset() {
  const response = await context.request.post(base + '/__preview/reset', { headers: { Accept: 'application/json', Origin: base } });
  assert.equal(response.status(), 200);
  const cookie = response.headers()['set-cookie'].split(';')[0];
  await context.addCookies([{ name: cookie.slice(0, cookie.indexOf('=')), value: cookie.slice(cookie.indexOf('=') + 1), domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
  await page.goto(base + '/landing');
  const { user } = await page.evaluate(async () => { const me = await fetch('/api/v1/me'); if (!me.ok) throw new Error('Fixture session failed'); return me.json(); });
  await page.evaluate((user) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('frigo_user_id', user.id);
    localStorage.setItem('frigo_household_id', user.household.id);
    localStorage.setItem('frigo_email', user.email);
    localStorage.setItem('frigo_display_name', user.displayName);
    localStorage.setItem('frigo_is_guest', 'false');
  }, user);
}
async function onboard() {
  await page.goto(base + '/onboarding/household');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu với Takolio', exact: true }).click();
  await page.waitForURL(base + '/');
}
try {
  const widths = process.env.BRAND_WIDTH ? [Number(process.env.BRAND_WIDTH)] : [320, 375, 390, 768, 1024, 1440];
  assert(widths.every((width) => [320, 375, 390, 768, 1024, 1440].includes(width)));
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await context.clearCookies();
    await page.goto(base + '/landing');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    for (const [name, route] of [['landing', '/landing'], ['login', '/auth'], ['register', '/auth?mode=register'], ['verify-missing', '/auth/verify']]) await shot(name, route);
    await reset();
    for (const step of ['household', 'preferences', 'goals']) await shot(`onboarding-${step}`, `/onboarding/${step}`);
    await onboard();
    await page.evaluate(async () => { const r = await fetch('/__preview/t13-scans', { method: 'POST' }); if (!r.ok) throw new Error('Scan fixture setup failed'); });
    const routes = [
      ['home', '/'], ['fridge', '/fridge'], ['scan', '/scan'],
      ['scan-review', '/scan/t13b-preview-fridge/review'],
      ['receipt-review', '/scan/receipt-review?scanId=t13b-preview-receipt'],
      ['recipes', '/recipes'], ['recipe-detail', '/recipes/canh-chua-ca-loc-nam-bo'],
      ['planner', '/planner'], ['planner-setup', '/planner/new'], ['shopping', '/shopping'],
      ['profile', '/me'], ['preferences', '/me/preferences'], ['household', '/me/household'],
      ['settings', '/settings/app'], ['planning-settings', '/settings/planning'],
      ['notification-settings', '/settings/notifications'], ['privacy', '/settings/privacy'],
      ['notifications', '/notifications'], ['plus', '/plus'],
    ];
    for (const [name, route] of routes) await shot(name, route);
    await page.goto(base + '/recipes/canh-chua-ca-loc-nam-bo');
    await page.getByRole('button', { name: /Bắt đầu nấu/ }).click();
    await page.waitForURL(/\/cook\//);
    await shot('cooking', new URL(page.url()).pathname);
    await shot('nutrition', '/recipes/canh-chua-ca-loc-nam-bo', async () => {
      await page.getByRole('tab', { name: 'Dinh dưỡng' }).click();
      await expect(page.getByRole('tabpanel', { name: 'Dinh dưỡng' })).toBeVisible();
    });
    await shot('ingredient-detail', '/fridge/preview-stock-chicken');
    const plan = await page.evaluate(async () => {
      const startDate = new Date().toISOString().slice(0, 10);
      const slots = Array.from({ length: 7 }, (_, i) => ({ date: new Date(Date.parse(startDate) + i * 86400000).toISOString().slice(0, 10), mealType: 'dinner' }));
      const response = await fetch('/api/v1/meal-planning/plans', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ startDate, horizonDays: 7, defaultServings: 2, mode: 'shopping_allowed', slots }) });
      if (!response.ok) throw new Error('Local plan generation failed: ' + response.status);
      return response.json();
    });
    await shot('saved-weekly-plan', `/planner/${plan.id}`);
    await shot('daily-planned-home', '/');
    const slot = plan.result.meals[0].slotId;
    await shot('planned-meal', `/planner/${plan.id}/meal/${encodeURIComponent(slot)}`);
    await shot('plan-shopping-budget', `/planner/${plan.id}/shopping`);

  }
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(base + '/me');
  await page.getByRole('button', { name: /Đăng xuất khỏi tài khoản/ }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: resolve(out, 'logout-dialog-320.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /Đăng xuất khỏi tài khoản/ })).toBeFocused();
  result.journeys.push('logout-dialog-Escape-and-restored-focus');
  const home = page.getByRole('link', { name: 'Takolio — Trang chủ', exact: true });
  await home.focus();
  const focus = await home.evaluate((el) => ({ style: getComputedStyle(el).outlineStyle, width: parseFloat(getComputedStyle(el).outlineWidth) }));
  assert(focus.style !== 'none' && focus.width >= 2);
  await page.keyboard.press('Enter');
  await page.waitForURL(base + '/');
  result.journeys.push({ kind: 'keyboard-branded-home-link', focus });
} finally {
  await writeFile(resolve(out, 'observations.json'), JSON.stringify(result, null, 2) + '\n');
  await browser.close();
}
assert.deepEqual(result.pageErrors, []);
if (stage !== 'before') assert.deepEqual(result.failures, [], 'See observations.json for actual failures');
console.log(`${stage}: ${result.checks.length} screens, ${result.failures.length} findings, ${result.journeys.length} journeys`);
