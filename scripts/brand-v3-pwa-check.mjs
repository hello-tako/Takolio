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
  await expect(page.getByRole('heading', { name: 'Bữa ngon, nhẹ đầu.' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => [...document.images].every((im) => im.complete && im.naturalWidth > 0))).toBe(true);
  const cache = await page.evaluate(async () => {
    const keys = await caches.keys();
    const current = keys.find((key) => key.startsWith('takosan-pwa-'));
    return { keys, paths: (await (await caches.open(current)).keys()).map((r) => new URL(r.url).pathname) };
  });
  assert(!cache.keys.includes('takosan-pwa-v3-before'));
  for (const path of ['/takosan/v3/app-icons/icon-maskable-512.png', '/takosan/v3/logo/horizontal-primary.svg', '/takosan/v3/fonts/nunito-vietnamese-wght-normal.woff2']) assert(cache.paths.includes(path), path);
  result.checks.push({ kind: 'activation-cleans-old-release-and-precaches-V3', ...cache });
  const manifest = await (await context.request.get(base + '/manifest.json')).json();
  assert.equal(manifest.short_name, 'Takosan');
  assert.equal(manifest.start_url, '/');
  for (const icon of manifest.icons) {
    const r = await context.request.get(base + icon.src);
    assert.equal(r.status(), 200);
    assert.equal(r.headers()['content-type'], 'image/png');
  }
  result.checks.push({ kind: 'manifest-and-icon-content-types', manifest });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bữa ngon, nhẹ đầu.' })).toBeVisible();
  await expect(page.getByTestId('landing-logo')).toBeVisible();
  assert(await page.getByTestId('landing-logo').evaluate((im) => im.naturalWidth > 0));
  await page.screenshot({ path: resolve(out, 'offline-landing-390.png'), fullPage: true });
  result.checks.push({ kind: 'offline-cached-public-shell-logo-and-font', route: new URL(page.url()).pathname });
  assert.deepEqual(result.errors, []);
} finally {
  await writeFile(resolve(out, 'observations.json'), JSON.stringify(result, null, 2) + '\n');
  await browser.close();
}
console.log(`PWA: ${result.checks.length} checks PASS`);
