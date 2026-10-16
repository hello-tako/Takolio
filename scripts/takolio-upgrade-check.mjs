import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.BRAND_URL ?? 'http://127.0.0.1:5230';
assert.equal(new URL(base).hostname, '127.0.0.1');
const out = resolve(process.env.BRAND_OUT ?? '.artifacts/takolio-v1/upgrade/stress');
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  locale: 'vi-VN',
  reducedMotion: 'reduce',
  serviceWorkers: 'block',
  bypassCSP: true,
});
await context.route(
  (url) => url.origin !== base,
  (route) => route.abort(),
);
const page = await context.newPage();
const receipt = {
  syntheticLocalOnly: true,
  syntheticFontInjectionBypassesCsp: true,
  browser: browser.version(),
  checks: [],
  pageErrors: [],
};
page.on('pageerror', (error) => receipt.pageErrors.push(error.message));
try {
  const reset = await context.request.post(base + '/__preview/reset', {
    headers: { Accept: 'application/json', Origin: base },
  });
  assert.equal(reset.status(), 200);
  const cookie = reset.headers()['set-cookie'].split(';')[0];
  await context.addCookies([
    {
      name: cookie.slice(0, cookie.indexOf('=')),
      value: cookie.slice(cookie.indexOf('=') + 1),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto(base + '/landing');
  await page.evaluate(async () => {
    const { user } = await (await fetch('/api/v1/me')).json();
    for (const [key, value] of Object.entries({
      frigo_user_id: user.id,
      frigo_household_id: user.household.id,
      frigo_email: user.email,
      frigo_display_name: user.displayName,
      frigo_is_guest: 'false',
      frigo_onboarded: 'true',
    }))
      localStorage.setItem(key, value);
  });
  await page.goto(base + '/onboarding/household');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu với Takolio', exact: true }).click();
  await page.waitForURL(base + '/');
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.route('**/api/v1/inventory', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[]}' }),
    );
    await page.goto(base + '/fridge');
    await expect(page.getByRole('heading', { name: 'Tủ lạnh đang trống' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    const action = page.getByRole('button', { name: 'Chụp tủ lạnh ngay', exact: true });
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeVisible();
    await action.click({ trial: true });
    const add = page.getByRole('button', { name: 'Thêm nguyên liệu', exact: true });
    await add.scrollIntoViewIfNeeded();
    await add.click({ trial: true });
    await add.focus();
    await expect(add).toBeFocused();
    const scanBox = await action.boundingBox(),
      addBox = await add.boundingBox();
    assert(scanBox.y + scanBox.height <= addBox.y, 'empty actions must not overlap');
    await page.screenshot({ path: resolve(out, `fridge-empty-${width}.png`), fullPage: true });
    receipt.checks.push({
      route: '/fridge',
      width,
      kind: 'empty-actions-contact',
      scanBox,
      addBox,
    });
    await page.unroute('**/api/v1/inventory');
    await page.goto(base + '/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.recipe-media-missing').first()).toBeVisible();
    const media = await page
      .locator('.family-recipe-main > .recipe-media[data-recipe-media=missing]')
      .evaluateAll((tiles) =>
        tiles.map((tile) => ({
          width: tile.clientWidth,
          label: tile.querySelector('[role=img]').getAttribute('aria-label'),
          display: getComputedStyle(tile.querySelector('span')).display,
        })),
      );
    for (const tile of media) {
      assert.equal(tile.label, 'Chưa có ảnh món ăn');
      if (tile.width <= 110)
        assert.equal(
          tile.display,
          'none',
          'narrow media retains accessible label without narrow wrapping',
        );
    }
    const navIndicator = await page
      .locator('.kitchen-nav-items a[aria-current="page"]')
      .evaluateAll((links) =>
        links
          .filter((link) => link.getBoundingClientRect().width > 0)
          .map((link) => {
            const style = getComputedStyle(link);
            const stroke = style.boxShadow.match(/rgba?\([^)]+\)/)?.[0];
            const color = (text) =>
              text
                .match(/[\d.]+/g)
                .slice(0, 3)
                .map(Number);
            const luminance = (rgb) =>
              rgb
                .map((v) => v / 255)
                .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
                .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
            const a = luminance(color(stroke));
            const b = luminance(color(style.backgroundColor));
            return {
              stroke,
              background: style.backgroundColor,
              ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
            };
          }),
      );
    assert(navIndicator.length > 0);
    for (const indicator of navIndicator)
      assert(indicator.ratio >= 3, 'current navigation indicator must meet 3:1');
    receipt.checks.push({ route: '/', width, kind: 'compact-missing-media', media, navIndicator });

    await page.screenshot({ path: resolve(out, `home-${width}.png`), fullPage: true });
    for (const height of [420, 844]) {
      await page.setViewportSize({ width, height });
      await page.goto(base + '/settings/app');
      await expect(page.locator('h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      const baselineFont = await page
        .locator('.kitchen-page-heading > .min-w-0 > .text-sm')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      await page.evaluate(
        ({ descriptionFont, headingFont, eyebrowFont }) => {
          const description = document.querySelector('.kitchen-page-heading > .min-w-0 > .text-sm');
          const heading = document.querySelector('.kitchen-page-heading h1');
          const eyebrow = document.querySelector('.kitchen-page-heading .kitchen-eyebrow');
          for (const [element, size] of [
            [description, descriptionFont],
            [heading, headingFont],
            [eyebrow, eyebrowFont],
          ]) {
            if (element) element.style.setProperty('font-size', `${size}px`, 'important');
          }
        },
        { descriptionFont: baselineFont * 2, headingFont: 44, eyebrowFont: 24 },
      );
      await expect(page.locator('.kitchen-page-heading > .min-w-0 > .text-sm')).toHaveCSS(
        'font-size',
        `${baselineFont * 2}px`,
      );
      const layout = await page
        .locator('.kitchen-page-heading > .min-w-0 > .text-sm')
        .evaluate((el) => ({
          font: parseFloat(getComputedStyle(el).fontSize),
          line: parseFloat(getComputedStyle(el).lineHeight),
          scrollWidth: document.documentElement.scrollWidth,
          width: innerWidth,
        }));
      assert(layout.font >= baselineFont * 2, 'synthetic font scaling must actually apply');
      assert(
        layout.line >= layout.font * 1.5,
        'description lines must not overlap at synthetic 200% font size',
      );
      assert.equal(layout.scrollWidth, layout.width);
      const occlusion = await page
        .locator('.kitchen-page-heading > .min-w-0 > .text-sm')
        .evaluate((el) => {
          const nav = document.querySelector('.kitchen-bottom-nav');
          if (!nav) return { overlaps: false, navPosition: 'missing' };
          const a = el.getBoundingClientRect();
          const b = nav.getBoundingClientRect();
          return {
            overlaps: a.bottom > b.top && a.top < b.bottom,
            navPosition: getComputedStyle(nav).position,
            descriptionBottom: a.bottom,
            navTop: b.top,
          };
        });
      assert.equal(
        occlusion.overlaps,
        false,
        'short viewport bottom navigation must not cover description',
      );
      const axe = (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations;
      assert.deepEqual(
        axe.map((v) => v.id),
        [],
      );
      await page.screenshot({
        path: resolve(out, `settings-${width}-${height}-text2.png`),
        fullPage: true,
      });
      receipt.checks.push({
        route: '/settings/app',
        width,
        height,
        kind: 'synthetic-font-200-percent',
        baselineFont,
        ...layout,
        occlusion,
        axe: [],
      });
    }
    console.log('upgrade stress ' + width + ' PASS');
  }
  assert.deepEqual(receipt.pageErrors, []);
} finally {
  await writeFile(resolve(out, 'observations.json'), JSON.stringify(receipt, null, 2) + '\n');
  await browser.close();
}
console.log('upgrade stress: ' + receipt.checks.length + ' checks PASS');
