import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect, reset, getJson } from '../t13b/fixtures';

const configs = [[390, 844, 1], [320, 420, 2], [1440, 900, 1]] as const;
const ownerKey = 'frigo_notify_prefs_planner-preview-user';

async function colors(control: Locator, placeholder = false) {
  return control.evaluate((element, placeholder) => {
    const rgba = (value: string) => {
      const numbers = value.match(/[\d.]+/g)?.map(Number);
      if (!numbers || numbers.length < 3) throw new Error(`Unsupported color: ${value}`);
      return [numbers[0], numbers[1], numbers[2], numbers[3] ?? 1];
    };
    const over = (foreground: number[], background: number[]) => foreground.slice(0, 3).map((value, i) => value * foreground[3] + background[i] * (1 - foreground[3]));
    const luminance = (color: number[]) => color.slice(0, 3).map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const ratio = (a: number[], b: number[]) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
    const ancestors: Element[] = [];
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      ancestors.unshift(parent);
      if (rgba(getComputedStyle(parent).backgroundColor)[3] === 1) break;
    }
    let parentColor = [255, 255, 255];
    for (const parent of ancestors) {
      const style = getComputedStyle(parent);
      if (style.backgroundImage !== 'none') throw new Error('Unbounded ancestor background');
      if (Number(style.opacity) !== 1) throw new Error('Unbounded ancestor opacity');
      parentColor = over(rgba(style.backgroundColor), parentColor);
    }
    const style = getComputedStyle(element);
    if (style.backgroundImage !== 'none') throw new Error('Unbounded control background');
    const background = over(rgba(style.backgroundColor), parentColor);
    const content = getComputedStyle(element, placeholder ? '::placeholder' : undefined);
    const foreground = rgba(content.color);
    foreground[3] *= Number(content.opacity);
    const thumb = element.querySelector(':scope > span');
    const thumbColor = thumb ? rgba(getComputedStyle(thumb).backgroundColor) : null;
    const box = element.getBoundingClientRect();
    return { color: content.color, opacity: content.opacity, backgroundColor: style.backgroundColor, background, parentColor,
      textRatio: ratio(over(foreground, background), background), boundaryRatio: ratio(background, parentColor),
      thumbRatio: thumbColor ? ratio(over(thumbColor, background), background) : null,
      outline: { style: style.outlineStyle, width: parseFloat(style.outlineWidth), color: style.outlineColor,
        ratio: ratio(over(rgba(style.outlineColor), parentColor), parentColor) },
      focusVisible: element.matches(':focus-visible'), disabled: element.matches(':disabled'),
      rect: { x: box.x, y: box.y, width: box.width, height: box.height },
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  }, placeholder);
}

async function capture(page: Page, info: TestInfo, control: Locator, id: string, placeholder: boolean) {
  await control.scrollIntoViewIfNeeded();
  const states = [];
  for (const state of ['normal', 'focus', 'hover']) {
    if (state === 'normal') { await page.mouse.move(0, 0); await control.evaluate(element => (element as HTMLElement).blur()); }
    if (state === 'focus') { await page.keyboard.press('Tab'); await control.focus(); }
    if (state === 'hover') { await control.evaluate(element => (element as HTMLElement).blur()); await control.hover(); }
    await page.waitForTimeout(350);
    const observation = await colors(control, placeholder);
    states.push({ id, state, ...observation });
    expect.soft(observation.scrollWidth, `${id}/${state}: document fits`).toBeLessThanOrEqual(observation.width);
    expect.soft(observation.rect.x, `${id}/${state}: left bound`).toBeGreaterThanOrEqual(-1);
    expect.soft(observation.rect.x + observation.rect.width, `${id}/${state}: right bound`).toBeLessThanOrEqual(observation.width + 1);
    expect.soft(observation.rect.height, `${id}/${state}: target height`).toBeGreaterThanOrEqual(44);
    if (placeholder) expect.soft(observation.textRatio, `${id}/${state}: placeholder contrast`).toBeGreaterThanOrEqual(4.5);
    else {
      expect.soft(observation.boundaryRatio, `${id}/${state}: track contrast`).toBeGreaterThanOrEqual(3);
      expect.soft(observation.thumbRatio, `${id}/${state}: thumb contrast`).toBeGreaterThanOrEqual(3);
    }
    if (state === 'focus') {
      expect.soft(observation.focusVisible, `${id}: keyboard focus`).toBe(true);
      expect.soft(observation.outline.style, `${id}: solid focus`).toBe('solid');
      expect.soft(observation.outline.width, `${id}: focus width`).toBeGreaterThanOrEqual(2);
      expect.soft(observation.outline.ratio, `${id}: focus contrast`).toBeGreaterThanOrEqual(3);
      await page.screenshot({ path: info.outputPath(`${id}-focus.png`) });
    }
  }
  return states;
}

async function boundary(page: Page) {
  return { inventory: await getJson(page, '/api/v1/inventory'), shopping: await getJson(page, '/api/v1/shopping-list'),
    family: await getJson(page, '/api/v1/family-preferences'), current: await getJson(page, '/api/v1/meal-planning/plans/current'),
    me: await getJson(page, '/api/v1/me') };
}

test('search placeholders and notification switch remain readable with keyboard, hover and enlarged text', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const before = await boundary(page);
  const writes: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${path}`);
  });
  const observations = [];
  const accessibility = [];
  const disabled = [];
  for (const [width, height, scale] of configs) {
    await page.setViewportSize({ width, height });
    const suffix = `${width}x${height}-text${scale}`;
    for (const [path, selectors] of [
      ['/recipes', [['discovery', '#recipe-search']]],
      ['/recipes?view=saved', [['saved', '.family-collection-heading input']]],
      ['/settings/planning', [['dislikes', '.family-ingredient-field input[type="search"] >> nth=0'], ['excluded', '.family-ingredient-field input[type="search"] >> nth=1']]],
      ['/shopping', [['shopping', '.shopping-add-form input[name="shopping-name"]']]],
    ] as const) {
      await page.goto(path);
      await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%`; }, scale);
      await page.evaluate(() => document.fonts.ready);
      if (path === '/settings/planning') {
        await page.getByText('Khẩu vị & món quốc tế muốn thử', { exact: true }).click();
        await page.getByText('Dị ứng & nguyên liệu bắt buộc tránh', { exact: true }).click();
      }
      if (path === '/shopping') {
        const panel = page.locator('.shopping-add-panel');
        await expect(panel.locator('summary')).toBeVisible();
        if (await panel.getAttribute('open') === null) await panel.locator('summary').click();
        await expect(panel).toHaveAttribute('open', '');
      }
      for (const [id, selector] of selectors) {
        const control = page.locator(selector);
        await expect(control).toBeVisible();
        await expect(control).toHaveValue('');
        observations.push(...await capture(page, info, control, `${id}-${suffix}`, true));
      }
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      accessibility.push({ path, suffix, violations: axe.violations, incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })) });
      expect.soft(axe.violations.map(({ id }) => id), `${path}/${suffix}: axe`).toEqual([]);
    }
    await page.evaluate(ownerKey => localStorage.removeItem(ownerKey), ownerKey);
    await page.goto('/settings/notifications');
    await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%`; }, scale);
    const toggle = page.getByRole('switch', { name: 'Khuyến mãi & cập nhật', exact: true });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    observations.push(...await capture(page, info, toggle, `switch-off-${suffix}`, false));
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    observations.push(...await capture(page, info, toggle, `switch-on-${suffix}`, false));
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(await page.evaluate(ownerKey => JSON.parse(localStorage.getItem(ownerKey)!).promoUpdates, ownerKey)).toBe(false);
    await toggle.evaluate(element => element.setAttribute('disabled', ''));
    await page.waitForTimeout(350);
    const shapedDisabled = await colors(toggle);
    disabled.push({ suffix, shapedDisabled, syntheticAttributeOnly: true });
    expect(shapedDisabled.backgroundColor).toBe('rgb(201, 194, 182)');
    expect(shapedDisabled.disabled).toBe(true);
    await toggle.evaluate(element => element.removeAttribute('disabled'));
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    accessibility.push({ path: '/settings/notifications', suffix, violations: axe.violations, incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })) });
    expect.soft(axe.violations.map(({ id }) => id), `${suffix}: switches axe`).toEqual([]);
  }
  expect(await boundary(page)).toEqual(before);
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('control-contrast-summary.json'), JSON.stringify({ observations, accessibility, disabled,
    keyboardSpaceEnterAndRealReload: true, domainSnapshotsEqual: true, writes,
    limitations: ['Chromium only; root font200 is synthetic, not native zoom.', 'Targeted keyboard focus and activation, not complete Tab traversal or screenreader certification.', 'Disabled attribute is shaped only; no new disabled product state.', 'Incomplete axe checks remain manual review.'] }, null, 2));
});

const c13Configs = [
  { id: '320x568', width: 320, height: 568, text: 1 },
  { id: '320x420-text200', width: 320, height: 420, text: 2 },
  { id: '390x844', width: 390, height: 844, text: 1 },
  { id: '1440x1000', width: 1440, height: 1000, text: 1 },
] as const;

const c13Definitions = {
  discovery: [
    ['search', '#recipe-search', 0],
    ['servings', '.discovery-select-label select', 0],
    ['filter', '.discovery-filter-panel summary', 0],
  ],
  detail: [['servings', '.discovery-select-label select', 0]],
  shopping: [
    ['name', '.shopping-add-form input[name="shopping-name"]', 0],
    ['quantity', '.shopping-add-form input[name="shopping-quantity"]', 0],
    ['unit', '.shopping-add-form select[name="shopping-unit"]', 0],
  ],
  planner: [
    ['locale', '.planning-locale select', 0],
    ['date', '.planning-setup-form input[type="date"]', 0],
    ['days', '.planning-setup-form input[type="number"]', 0],
    ['servings', '.planning-setup-form input[type="number"]', 1],
  ],
} as const;

type C13Route = keyof typeof c13Definitions;

async function c13Observation(control: Locator) {
  return control.evaluate(element => {
    const rgba = (value: string) => {
      const numbers = value.match(/[\d.]+/g)?.map(Number);
      if (!numbers || numbers.length < 3) throw new Error(`Unsupported color: ${value}`);
      return [numbers[0], numbers[1], numbers[2], numbers[3] ?? 1];
    };
    const over = (foreground: number[], background: number[]) => foreground.slice(0, 3)
      .map((value, index) => value * foreground[3] + background[index] * (1 - foreground[3]));
    const luminance = (color: number[]) => color.slice(0, 3).map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const ratio = (a: number[], b: number[]) => (Math.max(luminance(a), luminance(b)) + .05)
      / (Math.min(luminance(a), luminance(b)) + .05);
    const ancestors: Element[] = [];
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      ancestors.unshift(parent);
      if (rgba(getComputedStyle(parent).backgroundColor)[3] === 1) break;
    }
    let parentColor = [255, 255, 255];
    for (const parent of ancestors) {
      const style = getComputedStyle(parent);
      if (style.backgroundImage !== 'none') throw new Error('Unbounded ancestor background');
      if (Number(style.opacity) !== 1) throw new Error('Unbounded ancestor opacity');
      parentColor = over(rgba(style.backgroundColor), parentColor);
    }
    const style = getComputedStyle(element);
    if (style.backgroundImage !== 'none') throw new Error('Unbounded control background');
    const background = over(rgba(style.backgroundColor), parentColor);
    const boxShadow = style.boxShadow;
    const shadowColor = boxShadow.match(/rgba?\([^)]*\)/)?.[0];
    const stroke = shadowColor ? rgba(shadowColor) : null;
    const rect = element.getBoundingClientRect();
    const inlineStyle = element.getAttribute('style');
    element.style.setProperty('box-shadow', 'none', 'important');
    const baselineRect = element.getBoundingClientRect();
    if (inlineStyle === null) element.removeAttribute('style');
    else element.setAttribute('style', inlineStyle);
    const restoredRect = element.getBoundingClientRect();
    const geometryEqual = ['x', 'y', 'width', 'height'].every(key => {
      const dimension = key as 'x' | 'y' | 'width' | 'height';
      return Math.abs(rect[dimension] - baselineRect[dimension]) < .01
        && Math.abs(restoredRect[dimension] - baselineRect[dimension]) < .01;
    });
    return {
      boxShadow,
      insetStroke1px: shadowColor ? boxShadow.replace(shadowColor, '').trim() === '0px 0px 0px 1px inset' : false,
      strokeColor: shadowColor,
      strokeRatioFill: stroke ? ratio(over(stroke, background), background) : null,
      strokeRatioParent: stroke ? ratio(over(stroke, parentColor), parentColor) : null,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      baselineRect: { x: baselineRect.x, y: baselineRect.y, width: baselineRect.width, height: baselineRect.height },
      geometryEqual,
      focusVisible: element.matches(':focus-visible'),
      outline: {
        style: style.outlineStyle,
        width: parseFloat(style.outlineWidth),
        ratio: ratio(over(rgba(style.outlineColor), parentColor), parentColor),
      },
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}

async function c13Capture(page: Page, info: TestInfo, control: Locator, id: string) {
  await control.scrollIntoViewIfNeeded();
  await control.click({ trial: true });
  const observations = [];
  for (const state of ['normal', 'focus', 'hover'] as const) {
    if (state === 'normal') {
      await page.mouse.move(0, 0);
      await control.evaluate(element => (element as HTMLElement).blur());
    }
    if (state === 'focus') {
      await page.keyboard.press('Tab');
      await control.focus();
    }
    if (state === 'hover') {
      await control.evaluate(element => (element as HTMLElement).blur());
      await control.hover();
    }
    await page.waitForTimeout(350);
    const observation = await c13Observation(control);
    observations.push({ id, state, ...observation });
    expect.soft(observation.insetStroke1px, `${id}/${state}: 1px inset stroke`).toBe(true);
    expect.soft(observation.strokeRatioFill, `${id}/${state}: stroke/fill contrast`).toBeGreaterThanOrEqual(3);
    expect.soft(observation.strokeRatioParent, `${id}/${state}: stroke/parent contrast`).toBeGreaterThanOrEqual(3);
    expect.soft(observation.geometryEqual, `${id}/${state}: shadow preserves geometry`).toBe(true);
    expect.soft(observation.scrollWidth, `${id}/${state}: document fits`).toBeLessThanOrEqual(observation.width);
    expect.soft(observation.rect.x, `${id}/${state}: left bound`).toBeGreaterThanOrEqual(-1);
    expect.soft(observation.rect.x + observation.rect.width, `${id}/${state}: right bound`)
      .toBeLessThanOrEqual(observation.width + 1);
    expect.soft(observation.rect.width, `${id}/${state}: target width`).toBeGreaterThanOrEqual(44);
    expect.soft(observation.rect.height, `${id}/${state}: target height`).toBeGreaterThanOrEqual(44);
    if (state === 'focus') {
      expect.soft(observation.focusVisible, `${id}: keyboard focus`).toBe(true);
      expect.soft(observation.outline.style, `${id}: solid focus`).toBe('solid');
      expect.soft(observation.outline.width, `${id}: focus width`).toBeGreaterThanOrEqual(2);
      expect.soft(observation.outline.ratio, `${id}: focus contrast`).toBeGreaterThanOrEqual(3);
      await page.screenshot({ path: info.outputPath(`${id}-focus.png`) });
    }
  }
  return observations;
}

test('C13: 44 measured controls retain contrast, reachability and geometry across four configurations', async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const before = await boundary(page);
  const writes: string[] = [];
  const pageErrors: string[] = [];
  const externalRequests: string[] = [];
  const origin = new URL(page.url()).origin;
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== origin) externalRequests.push(`${request.method()} ${url.origin}${url.pathname}`);
    if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(`${request.method()} ${url.pathname}`);
    }
  });
  page.on('pageerror', error => pageErrors.push(error.message));

  const observations = [];
  for (const config of c13Configs) {
    await page.setViewportSize({ width: config.width, height: config.height });
    const suffix = `${config.id}-text${config.text}`;
    const routes: Array<[C13Route, string]> = [['discovery', '/recipes']];
    await page.goto('/recipes');
    await expect(page.locator('a[href^="/recipes/"]').first()).toBeVisible();
    const detailHref = await page.locator('a[href^="/recipes/"]').first().getAttribute('href');
    if (!detailHref) throw new Error('Missing recipe detail route');
    routes.push(['detail', detailHref]);
    routes.push(['shopping', '/shopping'], ['planner', '/planner/new']);

    for (const [routeId, path] of routes) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.evaluate(scale => {
        document.documentElement.style.fontSize = `${scale * 100}%`;
      }, config.text);
      await page.evaluate(() => document.fonts.ready);
      if (routeId === 'shopping') {
        const panel = page.locator('.shopping-add-panel');
        await expect(panel.locator('summary')).toBeVisible();
        if (await panel.getAttribute('open') === null) await panel.locator('summary').click();
        await expect(panel).toHaveAttribute('open', '');
      }
      for (const [id, selector, index] of c13Definitions[routeId]) {
        const control = page.locator(selector).nth(index);
        await expect(control, `${routeId}/${id}: present`).toHaveCount(1);
        await expect(control, `${routeId}/${id}: visible`).toBeVisible();
        observations.push(...await c13Capture(page, info, control, `${routeId}-${id}-${suffix}`));
      }
    }
  }

  const after = await boundary(page);
  expect(after).toEqual(before);
  expect(writes).toEqual([]);
  expect(externalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(observations).toHaveLength(132);
  await writeFile(info.outputPath('c13-control-contrast-summary.json'), JSON.stringify({
    observations,
    controlCount: 44,
    configurations: c13Configs,
    states: ['normal', 'focus', 'hover'],
    domainSnapshotsEqual: true,
    writes,
    externalRequests,
    pageErrors,
    geometryBaseline: 'Per-control computed rect with box-shadow disabled inline, then restored.',
    limitations: [
      'Chromium only; root font 200% is synthetic, not native zoom.',
      'Targeted keyboard focus, not complete Tab traversal or screenreader certification.',
      'No domain action submitted; fixture checks remain authoritative for external network.',
    ],
  }, null, 2));
});
