import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const base = process.env.BRAND_URL ?? 'http://127.0.0.1:5235';
assert.equal(new URL(base).hostname, '127.0.0.1');
const out = resolve(process.env.BRAND_OUT ?? '.artifacts/brand-v3/states');
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'vi-VN', serviceWorkers: 'block', reducedMotion: 'reduce' });
await context.route((url) => url.origin !== base, (r) => r.abort());
const page = await context.newPage();
const result = { checks: [], journeys: [], errors: [], localSyntheticData: true };
page.on('pageerror', (e) => result.errors.push(e.message));
async function bootstrap() {
  const r = await context.request.post(base + '/__preview/reset', { headers: { Origin: base, Accept: 'application/json' } });
  assert.equal(r.status(), 200);
  const c = r.headers()['set-cookie'].split(';')[0];
  await context.addCookies([{ name: c.slice(0, c.indexOf('=')), value: c.slice(c.indexOf('=') + 1), domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
  await page.goto(base + '/landing');
  await page.evaluate(async () => {
    const { user } = await (await fetch('/api/v1/me')).json();
    localStorage.clear(); sessionStorage.clear();
    for (const [key, value] of Object.entries({ frigo_user_id: user.id, frigo_household_id: user.household.id, frigo_email: user.email, frigo_is_guest: 'false' })) localStorage.setItem(key, value);
    const r = await fetch('/api/v1/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Frigo-Expected-User-Id': user.id, 'X-Frigo-Expected-Household-Id': user.household.id }, body: JSON.stringify({ completeOnboarding: true, householdSize: 2, spicyLevel: 'medium', favoriteCuisines: [], dietaryRestrictions: [] }) });
    if (!r.ok) throw new Error('Fixture onboarding failed');
  });
}
async function capture(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => { for (const im of document.images) im.loading = 'eager'; return [...document.images].every((im) => im.complete && im.naturalWidth > 0); });
  const layout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, route: location.pathname }));
  const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }));
  await page.screenshot({ path: resolve(out, name + '.png'), fullPage: true });
  result.checks.push({ name, ...layout, violations });
  assert.equal(layout.scrollWidth, layout.width, name);
  assert.deepEqual(violations, [], name);
  console.log(name + ': PASS');
}
try {
  await bootstrap();
  if (process.env.BRAND_FLAG_OFF === 'true') {
    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const [name, path] of [['week-empty', '/week'], ['week-setup', '/week/setup']]) {
        await page.goto(base + path); await page.waitForLoadState('networkidle');
        await capture(name + '-' + width);
      }
    }
  } else {
    for (const [width, height, doubleText] of [[320, 844, true], [768, 1000, true], [390, 420, false]]) {
      await page.setViewportSize({ width, height });
      for (const [name, path] of [['home', '/'], ['fridge', '/fridge'], ['recipes', '/recipes'], ['settings', '/settings/app']]) {
        await page.goto(base + path); await page.waitForLoadState('networkidle');
        if (doubleText) await page.evaluate(() => {
          const els = [...document.querySelectorAll('.takosan-rebuild *')];
          const sizes = els.map((el) => parseFloat(getComputedStyle(el).fontSize));
          els.forEach((el, i) => { el.style.fontSize = sizes[i] * 2 + 'px'; });
        });
        await capture(`${name}-${width}-${height}${doubleText ? '-text2' : ''}`);
      }
    }
    await page.setViewportSize({ width: 320, height: 844 });
    await page.route('**/api/v1/inventory', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic unavailable', code: 'PREVIEW_READ_FAILURE' }) }));
    await page.goto(base + '/fridge');
    await expect(page.getByRole('button', { name: /Thử lại/ })).toBeVisible();
    await capture('inventory-error-320');
    await page.unroute('**/api/v1/inventory');
    await page.route('**/api/v1/inventory', async (r) => {
      const response = await r.fetch();
      await new Promise((ok) => setTimeout(ok, 5000));
      await r.fulfill({ response });
    });
    await page.goto(base + '/fridge');
    await expect(page.getByRole('status').filter({ hasText: /Đang tải/i })).toBeVisible();
    await page.screenshot({ path: resolve(out, 'inventory-loading-320.png'), fullPage: true });
    result.journeys.push('actual-delayed-inventory-loading-state');
    await page.waitForLoadState('networkidle');
    await page.unroute('**/api/v1/inventory');
    await page.goto(base + '/recipes/canh-chua-ca-loc-nam-bo');
    await page.getByRole('button', { name: /Bắt đầu nấu/ }).click();
    await expect(page.getByRole('button', { name: 'Bước tiếp theo' })).toBeVisible();
    while (await page.getByRole('button', { name: 'Bước tiếp theo' }).count()) await page.getByRole('button', { name: 'Bước tiếp theo' }).click();
    await page.getByRole('button', { name: 'Hoàn thành nấu' }).click();
    await expect(page.getByRole('heading', { name: 'Món ăn hoàn tất' })).toBeVisible();
    await capture('cooking-review-320');
    await page.getByRole('button', { name: /Xác nhận.*Cập nhật/ }).click();
    await expect(page.getByRole('heading', { name: 'Đã cập nhật tủ lạnh' })).toBeVisible();
    await capture('cooking-success-320');
    result.journeys.push('real-local-cooking-completion-and-inventory-confirmation');
  }
  assert.deepEqual(result.errors, []);
} catch (error) {
  console.error('State failure at', page.url(), (await page.locator('body').innerText()).slice(0, 1500));
  await page.screenshot({ path: resolve(out, 'failure.png'), fullPage: true });
  throw error;
} finally {
  await writeFile(resolve(out, 'observations.json'), JSON.stringify(result, null, 2) + '\n');
  await browser.close();
}
