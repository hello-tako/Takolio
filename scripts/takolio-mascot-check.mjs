import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.BRAND_URL ?? 'http://127.0.0.1:5230';
assert.equal(new URL(base).hostname, '127.0.0.1');
const stage = process.env.BRAND_STAGE ?? 'after';
const out = resolve(process.env.BRAND_OUT ?? `.artifacts/takolio-v1/mascot-3d/${stage}`);
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'vi-VN', reducedMotion: 'reduce', serviceWorkers: 'block' });
await context.route((url) => url.origin !== base, (route) => route.abort());
const page = await context.newPage();
const receipt = { stage, syntheticLocalOnly: true, browser: browser.version(), checks: [], errors: [], fallback: null };
page.on('pageerror', (error) => receipt.errors.push(error.message));
async function bootstrap() {
  const reset = await context.request.post(base + '/__preview/reset', { headers: { Accept: 'application/json', Origin: base } });
  assert.equal(reset.status(), 200);
  const cookie = reset.headers()['set-cookie'].split(';')[0];
  await context.addCookies([{ name: cookie.slice(0, cookie.indexOf('=')), value: cookie.slice(cookie.indexOf('=') + 1), domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
  await page.goto(base + '/landing');
  await page.evaluate(async () => {
    const { user } = await (await fetch('/api/v1/me')).json();
    localStorage.clear(); sessionStorage.clear();
    for (const [key, value] of Object.entries({ frigo_user_id: user.id, frigo_household_id: user.household.id, frigo_email: user.email, frigo_display_name: user.displayName, frigo_is_guest: 'false' })) localStorage.setItem(key, value);
  });
}
async function capture(name, route, expectedPose) {
  await page.goto(base + route);
  await expect(page.locator('h1')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => { for (const img of document.images) img.loading = 'eager'; await document.fonts.ready; });
  await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
  const layout = await page.evaluate(() => ({
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    images: [...document.querySelectorAll('[data-takolio-mascot] img')].map((img) => ({
      src: new URL(img.currentSrc).pathname, width: img.width, height: img.height, alt: img.alt,
      naturalWidth: img.naturalWidth, pose: img.closest('[data-takolio-mascot]').getAttribute('data-takolio-mascot'),
    })),
  }));
  const axe = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
  assert.equal(layout.scrollWidth, layout.width, name + ' overflow');
  assert.deepEqual(axe, [], name + ' accessibility');
  if (stage === 'after' && expectedPose) {
    assert(layout.images.some((img) => img.pose === expectedPose && img.src.includes('/mascot/3d/') && img.alt === ''), name + ' missing rendered mascot');
  }
  const file = name + '-' + layout.width + '.png';
  await page.screenshot({ path: resolve(out, file), fullPage: true });
  receipt.checks.push({ name, route, screenshot: file, ...layout, axe });
  console.log(stage + ' ' + name + '/' + layout.width + ' PASS');
}
try {
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await context.clearCookies();
    await page.goto(base + '/landing');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await capture('landing', '/landing', 'wave');
    await capture('login', '/auth', 'wave');
    await capture('register', '/auth?mode=register', 'wave');
    await bootstrap();
    for (const [step, pose] of [['household', 'wave'], ['preferences', 'cooking'], ['goals', 'celebrate']]) await capture('onboarding-' + step, '/onboarding/' + step, pose);
    await page.goto(base + '/onboarding/household');
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await page.getByRole('button', { name: 'Bắt đầu với Takolio', exact: true }).click();
    await page.waitForURL(base + '/');
    await capture('home-empty', '/', 'calendar');
    await page.route('**/api/v1/inventory', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }));
    await capture('fridge-empty', '/fridge', 'fridge');
    await page.unroute('**/api/v1/inventory');
    await capture('recipes', '/recipes');
    await capture('planner-setup', '/planner/new');
    await capture('shopping', '/shopping');
    await capture('plus-protected', '/plus');
  }
  if (stage === 'after') {
    await context.clearCookies();
    await page.goto(base + '/landing');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.route('**/takolio/v1/mascot/3d/**', (route) => route.abort());
    await page.goto(base + '/landing');
    const fallback = page.locator('[data-takolio-mascot] img');
    await expect(fallback).toHaveAttribute('src', '/takolio/v1/mascot/tako-welcome.svg');
    await expect.poll(() => fallback.evaluate((img) => img.complete && img.naturalWidth > 0 && img.currentSrc.endsWith('.svg'))).toBe(true);
    receipt.fallback = { result: 'PASS', src: await fallback.getAttribute('src') };
    await page.screenshot({ path: resolve(out, 'network-fallback-1440.png'), fullPage: true });
  }
  assert.deepEqual(receipt.errors, []);
} finally {
  await writeFile(resolve(out, 'observations.json'), JSON.stringify(receipt, null, 2) + '\n');
  await browser.close();
}
console.log(stage + ': ' + receipt.checks.length + ' screens PASS');
