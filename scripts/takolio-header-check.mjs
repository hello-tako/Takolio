import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.BRAND_URL ?? 'http://127.0.0.1:5230';
assert.equal(new URL(base).hostname, '127.0.0.1');
const stage = process.env.BRAND_STAGE ?? 'after';
const out = resolve(process.env.BRAND_OUT ?? `.artifacts/takolio-v1/header-${stage}`);
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'vi-VN', reducedMotion: 'reduce', serviceWorkers: 'block' });
await context.route((url) => url.origin !== base, (route) => route.abort());
const page = await context.newPage();
const receipt = { stage, browser: browser.version(), syntheticLocalOnly: true, checks: [], pageErrors: [] };
page.on('pageerror', (error) => receipt.pageErrors.push(error.message));
try {
  const reset = await context.request.post(base + '/__preview/reset', { headers: { Accept: 'application/json', Origin: base } });
  assert.equal(reset.status(), 200);
  const cookie = reset.headers()['set-cookie'].split(';')[0];
  await context.addCookies([{ name: cookie.slice(0, cookie.indexOf('=')), value: cookie.slice(cookie.indexOf('=') + 1), domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
  await page.goto(base + '/landing');
  await page.evaluate(async () => {
    const { user } = await (await fetch('/api/v1/me')).json();
    localStorage.clear(); sessionStorage.clear();
    const values = { frigo_user_id: user.id, frigo_household_id: user.household.id, frigo_email: user.email, frigo_display_name: user.displayName, frigo_is_guest: 'false' };
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  });
  await page.goto(base + '/onboarding/household');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu với Takolio', exact: true }).click();
  await page.waitForURL(base + '/');
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    for (const [name, route] of [['home', '/'], ['recipes', '/recipes'], ['planner-setup', '/planner/new'], ['shopping', '/shopping'], ['recipe-detail', '/recipes/canh-chua-ca-loc-nam-bo'], ['plus-shared-shell', '/plus']]) {
      await page.goto(base + route);
      await expect(page.locator('h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      await page.evaluate(async () => {
        for (const img of document.images) img.loading = 'eager';
        await document.fonts.ready;
      });
      await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
      await expect(page.locator('.kitchen-header')).toBeVisible();
      await expect(page.locator('.kitchen-brand-link img')).toHaveCount(1);
      await page.waitForFunction(() => [...document.querySelectorAll('.kitchen-header img, .kitchen-sidebar img')].every((img) => img.complete && img.naturalWidth > 0));
      const metrics = await page.evaluate(() => {
        const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const visible = (el) => !!(el.getBoundingClientRect().width && el.getBoundingClientRect().height);
        const brand = [...document.querySelectorAll('.kitchen-brand-link img, .kitchen-sidebar-logo')].filter(visible).map((img) => ({ src: new URL(img.currentSrc).pathname, ...rect(img) }));
        const actions = [...document.querySelectorAll('.kitchen-header a')].filter(visible).map((a) => ({ name: a.getAttribute('aria-label') ?? a.textContent.trim(), ...rect(a) }));
        return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, brand, actions, header: rect(document.querySelector('.kitchen-header')), broken: [...document.images].filter((img) => visible(img) && (!img.complete || !img.naturalWidth)).map((img) => img.src) };
      });
      const axe = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
      assert.equal(metrics.scrollWidth, width, name + ' overflow');
      assert.deepEqual(metrics.broken, []);
      assert.deepEqual(axe, []);
      for (const action of metrics.actions) assert(action.width >= 44 && action.height >= 44, JSON.stringify(action));
      for (let i = 0; i < metrics.actions.length; i++) for (let j = i + 1; j < metrics.actions.length; j++) {
        const a = metrics.actions[i], b = metrics.actions[j];
        assert(a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5 || a.y + a.height <= b.y + 0.5 || b.y + b.height <= a.y + 0.5, 'Header actions overlap');
      }
      if (stage !== 'before') {
        assert.equal(metrics.brand.length, 1, name + ' needs one visible named logo');
        const expected = width >= 1024 || (width < 375 && metrics.actions.some((a) => /Quay lại/.test(a.name))) ? 'wordmark-primary.svg' : 'horizontal-primary.svg';
        assert(metrics.brand[0].src.endsWith(expected), JSON.stringify(metrics.brand));
        assert(metrics.brand[0].width >= (expected.startsWith('wordmark') ? 120 : 180));
      }
      const file = `${name}-${width}.png`;
      await page.screenshot({ path: resolve(out, file), fullPage: true });
      await page.locator('.kitchen-header').screenshot({ path: resolve(out, `${name}-${width}-header.png`) });
      receipt.checks.push({ name, route, screenshot: file, ...metrics, axe });
      console.log(`${stage} ${name}/${width} PASS`);
    }
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(base + '/shopping');
  const home = page.locator('.kitchen-header').getByRole('link', { name: 'Takolio — Trang chủ', exact: true });
  await home.focus();
  const focus = await home.evaluate((el) => ({ style: getComputedStyle(el).outlineStyle, width: parseFloat(getComputedStyle(el).outlineWidth) }));
  assert(focus.style !== 'none' && focus.width >= 2);
  await page.keyboard.press('Enter');
  await page.waitForURL(base + '/');
  receipt.keyboardHome = { result: 'PASS', focus };
  assert.deepEqual(receipt.pageErrors, []);
} finally {
  await writeFile(resolve(out, 'observations.json'), JSON.stringify(receipt, null, 2) + '\n');
  await browser.close();
}
console.log(`${stage}: ${receipt.checks.length} screens PASS`);
