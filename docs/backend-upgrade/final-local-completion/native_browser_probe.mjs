import assert from 'node:assert/strict';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const base = 'http://127.0.0.1:5248';
const out = resolve('.artifacts/backend-final-local-completion/native-browsers');
await mkdir(out, { recursive: true });
const checks = [];
for (const [engine, owner] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await owner.launch();
  try {
    for (const width of [320, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.route((url) => url.origin !== base, (route) => route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      for (const path of ['/landing', '/auth', '/auth?mode=register']) {
        await page.goto(base + path);
        await expect(page.locator('h1')).toHaveCount(1);
        await page.evaluate(() => document.fonts.ready);
        await expect.poll(() => page.evaluate(() => [...document.images].filter((im) => im.getBoundingClientRect().width > 0 && (!im.complete || !im.naturalWidth)).length)).toBe(0);
        const state = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
          badImages: [...document.images].filter((im) => im.getBoundingClientRect().width > 0 && (!im.complete || !im.naturalWidth)).length,
          font: getComputedStyle(document.body).fontFamily }));
        assert.equal(state.scrollWidth, state.width);
        assert.equal(state.badImages, 0);
        if (path.startsWith('/auth')) {
          const input = page.locator('input[type="email"]');
          await input.focus();
          const focus = await input.evaluate((node) => ({ outline: getComputedStyle(node).outlineStyle, shadow: getComputedStyle(node).boxShadow }));
          assert(focus.outline !== 'none' || focus.shadow !== 'none');
          await input.fill('synthetic@example.invalid');
          await expect(input).toHaveValue('synthetic@example.invalid');
        }
        const file = `${engine}-${width}-${path.replaceAll('/', '').replaceAll('?', '-').replaceAll('=', '-')}.png`;
        await page.screenshot({ path: resolve(out, file), fullPage: true });
        checks.push({ engine, version: browser.version(), width, path, state, screenshotSha256: createHash('sha256').update(await readFile(resolve(out, file))).digest('hex') });
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
}
await writeFile(resolve(out, 'receipt.json'), JSON.stringify({ checks, sourceSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'), classification: 'CURRENT_NATIVE_LOCAL_PRODUCTION_BUILD_SMOKE', limits: ['No old device or actual deployed provider/inbox certification.'] }, null, 2) + '\n');
console.log(JSON.stringify({ checks: checks.length, engines: 3, status: 'PASS' }));
