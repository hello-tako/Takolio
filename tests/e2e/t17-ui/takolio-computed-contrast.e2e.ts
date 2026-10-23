import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, getJson } from '../t13b/fixtures';

const configs = [[390, 844, 1], [320, 420, 2], [1440, 900, 1]] as const;

async function inspectContrast(page: Page) {
  return page.evaluate(() => {
    const color = (value: string) => {
      const match = /^rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)$/.exec(value);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4] ?? 1)] : null;
    };
    const over = (front: number[], back: number[]) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return [...front.slice(0, 3).map((v, i) => (v * front[3] + back[i] * back[3] * (1 - front[3])) / alpha), alpha];
    };
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map(v => v / 255)
      .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const selector = (element: Element): string => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      if (!element.parentElement) return element.localName;
      return `${selector(element.parentElement)} > ${element.localName}:nth-child(${[...element.parentElement.children].indexOf(element) + 1})`;
    };
    const root = document.querySelector('[role="dialog"]') ?? document.querySelector('.takosan-rebuild') ?? document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const rows = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const element = node.parentElement;
      if (!text || !element || element.closest('svg, script, style')) continue;
      const style = getComputedStyle(element);
      const range = document.createRange();
      range.selectNodeContents(node);
      if (style.visibility !== 'visible' || ![...range.getClientRects()].some(r => r.width > 1 && r.height > 1)
        || element.closest('.sr-only, [inert], [aria-hidden="true"]')) continue;
      const chain = [];
      const reasons: string[] = [];
      for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
        const css = getComputedStyle(ancestor);
        chain.push({ selector: selector(ancestor), color: css.backgroundColor, image: css.backgroundImage,
          opacity: css.opacity, filter: css.filter, backdropFilter: css.backdropFilter, blend: css.mixBlendMode });
        if (Number(css.opacity) !== 1) reasons.push('group-opacity');
        if (css.filter !== 'none' || css.backdropFilter !== 'none' || css.mixBlendMode !== 'normal') reasons.push('filter-or-blend');
        for (const pseudo of ['::before', '::after']) {
          const generated = getComputedStyle(ancestor, pseudo);
          if (!['none', 'normal'].includes(generated.content) && generated.display !== 'none'
            && (generated.backgroundImage !== 'none' || (color(generated.backgroundColor)?.[3] ?? 0) > 0)) reasons.push('generated-background');
        }
      }
      let background = [0, 0, 0, 0];
      for (const layer of chain) {
        if (layer.image !== 'none') { reasons.push('background-image-or-gradient'); break; }
        const rgba = color(layer.color);
        if (!rgba) { reasons.push('unsupported-background-color'); break; }
        if (rgba[3] > 0) background = background[3] > 0 ? over(background, rgba) : rgba;
        if (background[3] === 1) break;
      }
      if (background[3] !== 1) reasons.push('no-opaque-background');
      if (style.textShadow !== 'none') reasons.push('text-shadow');
      const foreground = color(style.color);
      if (!foreground) reasons.push('unsupported-text-color');
      const disabled = !!element.closest(':disabled, [aria-disabled="true"]');
      const fontSize = parseFloat(style.fontSize);
      const fontWeight = Number(style.fontWeight);
      const minimum = fontSize >= 24 || (fontSize >= 18.6666666667 && fontWeight >= 700) ? 3 : 4.5;
      const uniqueReasons = [...new Set(reasons)];
      const effectiveForeground = foreground && uniqueReasons.length === 0 ? over(foreground, background) : null;
      const lum = effectiveForeground ? [luminance(effectiveForeground), luminance(background)] : null;
      const ratio = lum ? (Math.max(...lum) + 0.05) / (Math.min(...lum) + 0.05) : null;
      rows.push({ selector: selector(element), text, foreground: style.color, background, effectiveForeground,
        fontSize, fontWeight, minimum, ratio, disabled, reasons: uniqueReasons, chain,
        status: disabled ? 'disabled-exempt' : ratio === null ? 'manual-review' : ratio >= minimum ? 'pass' : 'fail' });
    }
    return rows;
  });
}

async function capture(page: Page, info: TestInfo, state: string) {
  for (const [width, height, scale] of configs) {
    await page.setViewportSize({ width, height });
    await page.evaluate(value => { document.documentElement.style.fontSize = `${value * 100}%`; }, scale);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const pairs = await inspectContrast(page);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const data = { state, viewport: { width, height }, textScale: scale, pairs,
      violations: axe.violations, incomplete: axe.incomplete, axeVersion: axe.testEngine.version,
      scope: 'Rendered DOM text CSS pairs, including offscreen content. Gradients/images, group opacity, filters and generated backgrounds require manual review. No pixel/occlusion, icon, border or full accessibility certification.' };
    const name = `${state}-${width}x${height}-text${scale}`;
    await writeFile(info.outputPath(`${name}.json`), JSON.stringify(data, null, 2));
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled' });
    expect.soft(pairs.length, `${name}: text observed`).toBeGreaterThan(0);
    expect.soft(pairs.filter(row => row.status === 'fail'), `${name}: computed solid text contrast`).toEqual([]);
    expect.soft(axe.violations.map(({ id }) => id), `${name}: axe`).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
}

test('computed contrast composes alpha, respects large text and refuses unknown painting', async ({ page }) => {
  await page.setContent('<main style="background:white"><p style="color:black">black</p><p style="color:rgba(0,0,0,0.5)">alpha</p><p style="color:#888;font:700 24px sans-serif">large</p><p style="color:#888">low</p><p style="background:linear-gradient(white,black)">gradient</p><p style="opacity:0.5">opacity</p><button disabled>disabled</button></main>');
  const rows = await inspectContrast(page);
  const find = (text: string) => rows.find(row => row.text === text)!;
  expect(find('black').ratio).toBe(21);
  expect(find('alpha').ratio).toBeCloseTo(3.97665, 4);
  expect(find('large')).toMatchObject({ status: 'pass', minimum: 3 });
  expect(find('low').status).toBe('fail');
  expect(find('gradient')).toMatchObject({ status: 'manual-review', ratio: null });
  expect(find('opacity')).toMatchObject({ status: 'manual-review', ratio: null });
  expect(find('disabled').status).toBe('disabled-exempt');
});

test('real Week OFF and representative account computed text pairs', async ({ page }, info) => {
  test.skip(process.env.PREVIEW_MEAL_PLANNER_ENABLED !== 'false' || process.env.PREVIEW_MEAL_COMPOSITION_V2 !== 'false', 'Requires actual paired preview flags OFF.');
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/__preview');
  await page.getByRole('button', { name: 'Đặt lại dữ liệu thử nghiệm và đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Chưa có thực đơn tuần' })).toBeVisible();
  const before = await getJson(page, '/api/v1/inventory');
  await capture(page, info, 'week-empty');
  await page.getByRole('link', { name: 'Lên thực đơn tuần', exact: true }).press('Enter');
  for (const stage of ['meals', 'budget', 'priorities']) {
    await capture(page, info, `setup-${stage}`);
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).press('Enter');
  }
  await capture(page, info, 'setup-review');
  const generated = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/week/plans' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Tạo thực đơn tuần', exact: true }).press('Enter');
  const response = await generated;
  expect(response.status()).toBe(201);
  const { plan } = await response.json() as { plan: { id: string } };
  await expect(page).toHaveURL(new RegExp(`/week/${plan.id}$`));
  await capture(page, info, 'week-board');
  await page.getByRole('button', { name: 'Chia sẻ thực đơn', exact: true }).press('Enter');
  await expect(page.getByRole('dialog', { name: 'Chia sẻ thực đơn tuần' })).toBeVisible();
  await capture(page, info, 'week-share');
  await page.keyboard.press('Escape');
  await page.locator(`a[href^="/week/${plan.id}/meal/"]`).first().press('Enter');
  await expect(page.getByRole('group', { name: 'Nội dung công thức' })).toBeVisible();
  await capture(page, info, 'week-meal');
  const alternatives = page.waitForResponse(r => /\/meals\/[^/]+\/swap$/.test(new URL(r.url()).pathname));
  await page.getByRole('button', { name: 'Đổi món', exact: true }).press('Enter');
  expect((await alternatives).status()).toBe(200);
  await expect(page.getByRole('dialog', { name: /^Thay thế:/ })).toBeVisible();
  await capture(page, info, 'week-swap-read');
  await page.keyboard.press('Escape');
  await page.goto(`/week/${plan.id}/shopping`);
  await expect(page.getByRole('heading', { name: 'Mua thêm vừa đủ cho tuần.' })).toBeVisible();
  await capture(page, info, 'week-shopping');
  await page.getByRole('button', { name: 'Bắt đầu đi chợ', exact: true }).press('Enter');
  await capture(page, info, 'week-shopping-active');
  await page.goto(`/week/${plan.id}/settings`);
  await expect(page.getByRole('heading', { name: 'Chuẩn bị cho thực đơn tiếp theo.' })).toBeVisible();
  await capture(page, info, 'week-settings');
  for (const [path, heading, state] of [['/me', 'Hồ sơ', 'profile'], ['/settings/privacy', 'Quyền riêng tư & dữ liệu', 'privacy']] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await capture(page, info, state);
  }
  expect(await getJson(page, '/api/v1/inventory')).toEqual(before);
});
