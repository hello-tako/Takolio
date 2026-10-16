import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.BRAND_URL ?? 'http://127.0.0.1:5231';
assert.equal(new URL(base).hostname, '127.0.0.1');
const out = resolve(process.env.BRAND_OUT ?? '.artifacts/brand-v3/pwa');
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow', reducedMotion: 'reduce' });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setBlockedURLs', { urls: ['https://*'] });
const result = { localProductionBuild: true, offlineDataCertified: false, checks: [], errors: [] };
page.on('pageerror', (error) => result.errors.push(error.message));
try {
  await page.goto(base + '/__preview/measure');
  await page.evaluate(async () => { await caches.open('takosan-pwa-v3-before'); });
  await page.goto(base + '/landing');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; }).catch(() => {});
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)).catch(() => false)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Lên kế hoạch bữa ăn thông minh.' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => [...document.images].every((im) => im.complete && im.naturalWidth > 0))).toBe(true);
  const cache = await page.evaluate(async () => {
    const keys = await caches.keys();
    const current = keys.find((key) => key.startsWith('takosan-pwa-'));
    return { keys, paths: (await (await caches.open(current)).keys()).map((r) => new URL(r.url).pathname) };
  });
  assert(!cache.keys.includes('takosan-pwa-v3-before'));
  for (const path of ['/takolio/v1/app-icons/icon-maskable-512.png', '/takolio/v1/logo/horizontal-primary.svg', '/takosan/v3/fonts/nunito-vietnamese-wght-normal.woff2', '/takolio/v1/mascot/3d/tako-welcome-512.webp', '/takolio/v1/mascot/3d/tako-welcome-1024.webp', '/takolio/v1/mascot/tako-welcome.svg']) assert(cache.paths.includes(path), path);
  result.checks.push({ kind: 'activation-cleans-old-release-and-precaches-Takolio-and-retained-fonts', ...cache });
  const manifest = await (await context.request.get(base + '/manifest.json')).json();
  assert.equal(manifest.short_name, 'Takolio');
  assert.equal(manifest.start_url, '/');
  for (const icon of manifest.icons) {
    const r = await context.request.get(base + icon.src);
    assert.equal(r.status(), 200);
    assert.equal(r.headers()['content-type'], 'image/png');
  }
  result.checks.push({ kind: 'manifest-and-icon-content-types', manifest });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lên kế hoạch bữa ăn thông minh.' })).toBeVisible();
  await expect(page.getByTestId('landing-logo')).toBeVisible();
  assert(await page.getByTestId('landing-logo').evaluate((im) => im.naturalWidth > 0));
  const mascot = page.locator('[data-takolio-mascot="wave"] img');
  await expect.poll(() => mascot.evaluate((img) => img.complete && img.naturalWidth > 0 && img.currentSrc.includes('/mascot/3d/'))).toBe(true);
  const offlineMascot = await mascot.evaluate((img) => ({ src: new URL(img.currentSrc).pathname, width: img.width, height: img.height, naturalWidth: img.naturalWidth }));
  assert.equal(offlineMascot.width, 240);
  assert.equal(offlineMascot.height, 240);
  await page.screenshot({ path: resolve(out, 'offline-landing-390.png'), fullPage: true });
  result.checks.push({ kind: 'offline-cached-public-shell-logo-font-and-3d-mascot', route: new URL(page.url()).pathname, offlineMascot });
  assert.deepEqual(result.errors, []);
} finally {
  await writeFile(resolve(out, 'observations.json'), JSON.stringify(result, null, 2) + '\n');
  await browser.close();
}
console.log(`PWA: ${result.checks.length} checks PASS`);
