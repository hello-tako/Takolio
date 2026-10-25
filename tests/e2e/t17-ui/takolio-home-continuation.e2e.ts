import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { FamilyMealPlanDtoSchema } from '../../../packages/domain/src/family-meal-planning-api';
import { test, expect, reset, getJson } from '../t13b/fixtures';

const configs = [[320, 420, 2], [390, 420, 1], [768, 420, 1], [390, 844, 1], [1440, 900, 1]] as const;
const planApi = '/api/v2/meal-planning/plans';

async function settle(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function contrast(page: Page) {
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
    const walker = document.createTreeWalker(document.querySelector('[data-kitchen-navigation="persistent"]') ?? document.body, NodeFilter.SHOW_TEXT);
    const rows = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const element = node.parentElement;
      if (!text || !element || element.closest('svg, script, style, .sr-only, [inert], [aria-hidden="true"]')) continue;
      const style = getComputedStyle(element);
      const range = document.createRange();
      range.selectNodeContents(node);
      if (style.visibility !== 'visible' || ![...range.getClientRects()].some(r => r.width > 1 && r.height > 1)) continue;
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
      const effectiveForeground = foreground && !uniqueReasons.length ? over(foreground, background) : null;
      const lum = effectiveForeground ? [luminance(effectiveForeground), luminance(background)] : null;
      const ratio = lum ? (Math.max(...lum) + 0.05) / (Math.min(...lum) + 0.05) : null;
      rows.push({ selector: selector(element), text, foreground: style.color, background, effectiveForeground,
        fontSize, fontWeight, minimum, ratio, disabled, reasons: uniqueReasons, chain,
        status: disabled ? 'disabled-exempt' : ratio === null ? 'manual-review' : ratio >= minimum ? 'pass' : 'fail' });
    }
    return rows;
  });
}

async function shell(page: Page) {
  const metrics = await page.evaluate(() => {
    const rect = (element: Element) => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const visible = (e: Element) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
    const header = document.querySelector('.kitchen-header')!;
    const nav = [...document.querySelectorAll('nav[aria-label="Điều hướng chính"]')].find(visible)!;
    const roots = [...nav.querySelectorAll('.kitchen-nav-items a')];
    const links = [...header.querySelectorAll('a'), ...nav.querySelectorAll('a')].filter(visible);
    const overlap = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
    const overlappingLinks = links.flatMap((a, i) => links.slice(i + 1).filter(b => overlap(rect(a), rect(b))).map(b => [a.getAttribute('href'), b.getAttribute('href')]));
    const headerBox = rect(header);
    const navBox = rect(nav);
    const navTop = navBox.width > innerWidth / 2 && navBox.y > 0 ? navBox.y : innerHeight;
    return { viewport: { width: innerWidth, height: innerHeight }, scrollWidth: document.documentElement.scrollWidth,
      header: { ...headerBox, position: getComputedStyle(header).position }, nav: { ...navBox, position: getComputedStyle(nav).position },
      main: rect(document.querySelector('#kitchen-main')!), body: rect(document.querySelector('.kitchen-page-body')!),
      initialReadingHeight: Math.max(0, Math.min(innerHeight, navTop) - Math.max(0, headerBox.bottom)),
      overlappingLinks, roots: roots.map(a => ({ href: a.getAttribute('href'), text: a.textContent?.trim(), current: a.getAttribute('aria-current'), box: rect(a),
        label: rect(a.querySelector('.kitchen-nav-label')!), labelScrollWidth: a.querySelector('.kitchen-nav-label')!.scrollWidth,
        labelClientWidth: a.querySelector('.kitchen-nav-label')!.clientWidth })),
      scan: links.filter(a => a.getAttribute('href') === '/scan').map(a => ({ name: a.textContent?.trim(), box: rect(a) })),
    };
  });
  const nav = page.locator('nav[aria-label="Điều hướng chính"]:visible');
  const roots = nav.locator('.kitchen-nav-items a');
  const keyboard = [];
  await roots.first().scrollIntoViewIfNeeded();
  await roots.first().focus();
  for (let i = 0; i < await roots.count(); i += 1) {
    const link = roots.nth(i);
    if (i) await page.keyboard.press('Tab');
    await settle(page);
    const focused = await link.evaluate(e => e === document.activeElement);
    const box = await link.boundingBox();
    keyboard.push({ href: await link.getAttribute('href'), focused, box });
    expect.soft(focused, 'native Tab reaches each root').toBe(true);
    expect.soft(box && box.y >= -1 && box.y + box.height <= page.viewportSize()!.height + 1, 'focused root visible vertically').toBe(true);
  }
  const scan = page.locator('a[href="/scan"]:visible').first();
  await scan.scrollIntoViewIfNeeded();
  await scan.focus();
  await expect(scan).toBeFocused();
  await scan.click({ trial: true });
  return { ...metrics, keyboard, scanFocusAndActionability: true };
}

async function capture(page: Page, info: TestInfo, state: string) {
  for (const [width, height, scale] of configs) {
    await page.setViewportSize({ width, height });
    await page.evaluate(value => { document.documentElement.style.fontSize = `${value * 100}%`; window.scrollTo(0, 0); }, scale);
    await settle(page);
    await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].filter(image => !image.complete).map(image => new Promise<void>(resolve => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    }))]));
    await settle(page);
    const name = `${state}-${width}x${height}-text${scale}`;
    const geometry = await shell(page);
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
    const pairs = await contrast(page);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    await writeFile(info.outputPath(`${name}.json`), JSON.stringify({ state, textScale: scale, geometry, pairs,
      violations: axe.violations, incomplete: axe.incomplete, axeVersion: axe.testEngine.version,
      limits: 'Synthetic local API. CSS DOM text pairs include offscreen text; unsupported painting remains manual-review. Geometry is not usability approval. No pixel/occlusion, icon/border/focus/hover/placeholder/native zoom/device/Safari/screenreader/full-WCAG certification.' }, null, 2));
    await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled' });
    expect.soft(geometry.scrollWidth, `${name}: horizontal overflow`).toBeLessThanOrEqual(width);
    expect.soft(geometry.overlappingLinks, `${name}: shell control overlap`).toEqual([]);
    expect.soft(geometry.roots.map(r => r.text), `${name}: five full root labels`).toEqual(['Trang chủ', 'Tủ lạnh', 'Công thức', 'Thực đơn', 'Tôi']);
    expect.soft(geometry.roots.filter(r => r.labelScrollWidth > r.labelClientWidth + 1), `${name}: label clipping`).toEqual([]);
    expect.soft(geometry.scan.length, `${name}: visible Scan`).toBeGreaterThan(0);
    expect.soft(pairs.length, `${name}: text observed`).toBeGreaterThan(0);
    expect.soft(pairs.filter(row => row.status === 'fail'), `${name}: computed solid text contrast`).toEqual([]);
    expect.soft(axe.violations.map(({ id }) => id), `${name}: axe`).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; window.scrollTo(0, 0); });
  await settle(page);
}

async function motion(page: Page, info: TestInfo) {
  const observations = [];
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    await settle(page);
    await expect(page.locator('.home-plan-summary')).toBeVisible();
    const animations = await page.locator('.kitchen-page-body').evaluate(element => {
      const animations = element.getAnimations();
      for (const animation of animations) animation.pause();
      return animations.map(animation => ({ name: animation instanceof CSSAnimation ? animation.animationName : null,
        timing: animation.effect?.getComputedTiming(), keyframes: animation.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : [] }));
    });
    for (const ms of [0, 25, 50, 100, 200]) {
      const sample = await page.locator('.kitchen-page-body').evaluate((element, ms) => {
        for (const animation of element.getAnimations()) { animation.pause(); animation.currentTime = ms; }
        const css = getComputedStyle(element);
        let effectiveOpacity = 1;
        for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) effectiveOpacity *= Number(getComputedStyle(ancestor).opacity);
        return { ms, opacity: css.opacity, effectiveOpacity, transform: css.transform, animationName: css.animationName,
          animationDuration: css.animationDuration, activeAnimationCount: element.getAnimations().length };
      }, ms);
      observations.push({ reducedMotion, animations, ...sample });
      expect.soft(sample.effectiveOpacity, `${reducedMotion} ${ms}ms: readable Home body`).toBe(1);
      if (Number(sample.opacity) > 0) await page.screenshot({ path: info.outputPath(`motion-${reducedMotion}-${ms}ms.png`) });
    }
    await page.locator('.kitchen-page-body').evaluate(element => { for (const animation of element.getAnimations()) animation.finish(); });
  }
  await writeFile(info.outputPath('motion-samples.json'), JSON.stringify({ observations,
    limits: 'Deterministic Web Animations seek of body animations. Not natural frame timing, pixel contrast, performance or device/browser certification.' }, null, 2));
}

test('real onboarding unlocks Home; empty and paired-ON persisted meals preserve stock and expose shell evidence', async ({ page }, info) => {
  test.skip(process.env.PREVIEW_MEAL_PLANNER_ENABLED !== 'true' || process.env.PREVIEW_MEAL_COMPOSITION_V2 !== 'true', 'Requires actual paired preview flags ON.');
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const inventory = await getJson(page, '/api/v1/inventory');
  const meBefore = await getJson<{ user: { onboardingCompleted: boolean } }>(page, '/api/v1/me');
  expect(meBefore.user.onboardingCompleted).toBe(false);
  const writes: { method: string; path: string }[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push({ method: request.method(), path });
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding\/household$/);
  await expect(page.getByLabel('Bước 1 trên 3')).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/preferences$/);
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/goals$/);
  const familySave = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/family-preferences' && r.request().method() === 'PUT');
  const completion = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/preferences' && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Bắt đầu với Takolio', exact: true }).click();
  expect((await familySave).status()).toBe(200);
  const receipt = await completion;
  expect(receipt.status()).toBe(200);
  expect(await receipt.json()).toMatchObject({ success: true, onboardingCompleted: true });
  expect((await getJson<{ user: { onboardingCompleted: boolean } }>(page, '/api/v1/me')).user.onboardingCompleted).toBe(true);
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hôm nay ăn gì?', exact: true })).toBeVisible();
  await expect(page.locator('#home-plan-heading')).toHaveText('Chưa có thực đơn hiện tại');
  await capture(page, info, 'home-empty');
  await page.getByRole('link', { name: 'Lên thực đơn', exact: true }).press('Enter');
  await expect(page).toHaveURL(/\/planner\/new$/);
  await page.getByLabel('Ngày bắt đầu', { exact: true }).fill('2030-01-07');
  const generated = page.waitForResponse(r => new URL(r.url()).pathname === planApi && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Tạo thực đơn', exact: true }).click();
  const generatedReceipt = await generated;
  expect(generatedReceipt.status()).toBe(200);
  const family = FamilyMealPlanDtoSchema.parse(await generatedReceipt.json());
  await expect(page).toHaveURL(new RegExp(`/planner/${family.plan.id}$`));
  const canonical = await getJson<{ plan: { id: string; revision: number } }>(page, '/api/v1/meal-planning/plans/current');
  expect(canonical.plan).toMatchObject({ id: family.plan.id, revision: family.plan.revision });
  await page.goto('/');
  await expect(page.locator('.home-plan-card[data-meal-state="ready"]')).toBeVisible();
  await expect(page.locator('.home-plan-summary')).toBeVisible();
  const first = [...family.plan.intent.slots].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? ({ breakfast: '08:00', lunch: '12:00', dinner: '18:00' }[a.mealType])).localeCompare(b.time ?? ({ breakfast: '08:00', lunch: '12:00', dinner: '18:00' }[b.mealType])) || a.sequence - b.sequence)[0];
  const slotId = `${first.date}:${first.mealType}:${first.sequence}`;
  const dishes = family.compositions.compositions.find(c => c.slotId === slotId)!.components.map(c => c.title);
  expect(dishes.length).toBeGreaterThan(0);
  if (dishes.length > 1) expect(await page.getByRole('list', { name: 'Các món trong bữa', exact: true }).locator('li').allTextContents()).toEqual(dishes);
  else await expect(page.locator('#home-plan-heading')).toHaveText(dishes[0]);
  const mealPath = `/planner/${family.plan.id}/meal/${encodeURIComponent(slotId)}`;
  await expect(page.getByRole('link', { name: 'Xem bữa ăn', exact: true })).toHaveAttribute('href', mealPath);
  await expect(page.getByRole('link', { name: 'Xem lịch', exact: true })).toHaveAttribute('href', `/planner/${family.plan.id}`);
  await page.reload();
  await expect(page.locator('.home-plan-card[data-meal-state="ready"]')).toBeVisible();
  await capture(page, info, 'home-populated');
  await motion(page, info);
  const readsBegin = writes.length;
  await page.getByRole('link', { name: 'Xem lịch', exact: true }).press('Enter');
  await expect(page).toHaveURL(new RegExp(`/planner/${family.plan.id}$`));
  await page.goBack();
  await expect(page.locator('.home-plan-summary')).toBeVisible();
  await page.getByRole('link', { name: 'Xem bữa ăn', exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Các món trong bữa', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.locator('.home-plan-summary')).toBeVisible();
  await page.locator('a[href="/scan"]:visible').first().press('Enter');
  await expect(page).toHaveURL(/\/scan$/);
  await page.goBack();
  await expect(page.locator('.home-plan-summary')).toBeVisible();
  expect(writes.slice(readsBegin)).toEqual([]);
  expect(await getJson(page, '/api/v1/inventory')).toEqual(inventory);
  expect(writes).toEqual([{ method: 'PUT', path: '/api/v1/family-preferences' }, { method: 'PATCH', path: '/api/v1/preferences' }, { method: 'POST', path: planApi }]);
  await writeFile(info.outputPath('behavior-summary.json'), JSON.stringify({ syntheticLocalApi: true, actualPairedFlags: 'ON',
    onboardingGuardReproduced: true, actualOnboardingReceiptAndMeReadback: true, homeSurvivedReload: true,
    generatedPlan: { id: family.plan.id, revision: family.plan.revision, slotId, dishes },
    canonicalCurrentMatched: true, keyboardScheduleMealScanAndBack: true, readOnlyNavigationWrites: writes.slice(readsBegin), inventoryUnchanged: true, writes,
    limits: 'Home empty and populated only. No all-state, production, owner acceptance or full accessibility certification.' }, null, 2));
});
