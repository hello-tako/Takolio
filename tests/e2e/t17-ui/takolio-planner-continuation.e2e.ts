import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { FamilyMealPlanDtoSchema, type FamilyMealPlanDto } from '../../../packages/domain/src/family-meal-planning-api';
import { test, expect, reset, getJson } from '../t13b/fixtures';

const configurations = [
  [320, 568, 1], [320, 420, 2], [360, 800, 1], [390, 844, 1],
  [320, 568, 2], [430, 932, 1], [768, 1024, 1], [1024, 768, 1], [1440, 900, 1],
];
const compactConfigurations = [configurations[1], configurations[3], configurations[configurations.length - 1]];
const planApi = '/api/v2/meal-planning/plans';

async function capture(page: Page, info: TestInfo, state: string, configs = compactConfigurations) {
  const observations = [];
  for (const [width, height, scale] of configs) {
    await page.setViewportSize({ width, height });
    await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%`; }, scale);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const metrics = await page.evaluate(() => ({
      innerWidth, scrollWidth: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll('main, section, article, div, ul, li, button, a, p, h1, h2, span')]
        .map(element => ({ element, box: element.getBoundingClientRect() }))
        .filter(({ box }) => box.width > 0 && (box.right > innerWidth + 1 || box.left < -1))
        .map(({ element, box }) => ({ tag: element.tagName, class: element.className,
          left: box.left, right: box.right, width: box.width })),
      brokenImages: [...document.images].filter(image => image.complete && image.naturalWidth === 0).map(image => new URL(image.src).pathname),
    }));
    const name = `${state}-${width}x${height}-text${scale}`;
    expect.soft(metrics.scrollWidth, `${name}: document overflow`).toBeLessThanOrEqual(width);
    expect.soft(metrics.brokenImages, `${name}: broken images`).toEqual([]);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    await writeFile(info.outputPath(`axe-${name}.json`), JSON.stringify({
      state, viewport: { width, height }, textScale: scale, violations: axe.violations,
      incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })),
    }, null, 2));
    expect.soft(axe.violations.map(({ id }) => id), `${name}: axe`).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
    const picker = page.getByRole('dialog', { name: 'Chọn món', exact: true });
    const reachability = [];
    if (await picker.isVisible()) {
      let index = 0;
      for (const control of [picker.getByRole('button', { name: 'Đóng', exact: true }),
        picker.getByRole('searchbox', { name: 'Tìm món', exact: true }),
        picker.getByRole('combobox', { name: 'Vai trò', exact: true }),
        picker.getByRole('button', { name: /^Chọn:/ }).first()]) {
        await control.scrollIntoViewIfNeeded();
        const label = await control.getAttribute('aria-label') ?? await control.getAttribute('name') ?? `control-${index}`;
        let actionable = true;
        try { await control.click({ trial: true, timeout: 2000 }); } catch { actionable = false; }
        // Actionability may scroll again; measure the final position it exposes.
        const box = await control.boundingBox();
        const fitsViewport = !!box && box.y >= -1 && box.x >= -1 && box.y + box.height <= height + 1 && box.x + box.width <= width + 1;
        reachability.push({ label, box, fitsViewport, actionable });
        expect.soft(actionable, `${name}: pointer reaches ${label}`).toBe(true);
        if (height === 420) await page.screenshot({ path: info.outputPath(`${name}-control-${index}.png`), animations: 'disabled' });
        index += 1;
        expect.soft(fitsViewport, `${name}: reachable ${label}`).toBe(true);
        await expect.soft(control, `${name}: actionable ${label}`).toBeVisible();
      }
    }
    observations.push({ state, viewport: { width, height }, scale, metrics, reachability });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
  return observations;
}

async function setup(page: Page, manual = false) {
  await page.goto('/planner/new');
  await expect(page.getByRole('radio', { name: /^Takolio gợi ý cả bữa/ })).toBeChecked();
  await page.getByLabel('Ngày bắt đầu', { exact: true }).fill('2030-01-07');
  if (manual) {
    await page.getByRole('radio', { name: /^Tự chọn món cho từng bữa/ }).check();
    await page.getByLabel('Số ngày', { exact: true }).fill('1');
  }
  const habits = page.locator('details.family-plan-habits').first();
  if (await habits.evaluate(node => (node as HTMLDetailsElement).open)) await habits.locator(':scope > summary').click();
}

function expectPersistedPlan(actual: FamilyMealPlanDto, expected: FamilyMealPlanDto) {
  // A read refreshes this diagnostic timestamp; all persisted fields must match.
  expect(actual).toEqual({ ...expected, plan: { ...expected.plan, freshness: {
    ...expected.plan.freshness, checkedAt: actual.plan.freshness.checkedAt,
  } } });
}

async function currentPlan(page: Page) {
  const id = new URL(page.url()).pathname.split('/')[2];
  return FamilyMealPlanDtoSchema.parse(await getJson(page, `${planApi}/${id}`));
}

test('family setup, pending, actual generated board, shopping share and reload preserve stock', async ({ page }, info) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(10_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const inventory = await getJson(page, '/api/v1/inventory');
  await setup(page);
  const observations = await capture(page, info, 'setup');
  const posts: string[] = [];
  const origin = new URL(page.url()).origin;
  let release = () => {};
  let arrived = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const pending = new Promise<void>(resolve => { arrived = resolve; });
  // Delay only the local request, then let the real Worker generate and persist it.
  await page.route(url => url.origin === origin && url.pathname === planApi, async route => {
    if (route.request().method() === 'POST') {
      posts.push(route.request().postData()!);
      arrived();
      await gate;
    }
    await route.continue();
  });
  const generate = page.getByRole('button', { name: 'Tạo thực đơn', exact: true });
  await page.getByLabel('Số ngày', { exact: true }).fill('');
  await generate.click();
  expect(posts).toHaveLength(0);
  await expect(page.getByLabel('Số ngày', { exact: true })).toBeFocused();
  await page.getByLabel('Số ngày', { exact: true }).fill('7');
  const response = page.waitForResponse(res => new URL(res.url()).pathname === planApi && res.request().method() === 'POST');
  try {
    await generate.click();
    await pending;
    await expect(page.getByRole('status').filter({ hasText: 'Takolio đang lập kế hoạch từ dữ liệu của bạn…' })).toBeVisible();
    await expect(page.getByLabel('Ngày bắt đầu', { exact: true })).toBeDisabled();
    await expect(page.locator('form button[type="submit"]')).toBeDisabled();
    observations.push(...await capture(page, info, 'pending'));
  } finally { release(); }
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/planner\/(?!new$)[^/]+$/);
  await expect(page.locator('.planning-day-board')).toBeVisible();
  const initial = await currentPlan(page);
  expect(initial.plan.intent.horizonDays).toBe(7);
  expect(initial.plan.intent.slots.length).toBeGreaterThanOrEqual(7);
  const boardPath = new URL(page.url()).pathname;
  const meal = page.locator('a[href*="/meal/"]').first();
  await expect(meal).toBeVisible();
  observations.push(...await capture(page, info, 'board'));
  await page.reload();
  await expect(page.locator('.planning-day-board')).toBeVisible();
  expectPersistedPlan(await currentPlan(page), initial);
  await meal.click();
  await expect(page.getByRole('heading', { name: 'Các món trong bữa', exact: true })).toBeVisible();
  observations.push(...await capture(page, info, 'meal'));
  await page.goto(`${boardPath}/shopping`);
  await expect(page.getByRole('heading', { name: 'Chuẩn bị lượt đi chợ', exact: true })).toBeVisible();
  const share = page.getByRole('button', { name: 'Tạo danh sách dùng chung', exact: true });
  await expect(share).toBeEnabled();
  await page.getByRole('combobox', { name: /^Khoảng đi chợ/ }).selectOption('3');
  observations.push(...await capture(page, info, 'shopping'));
  const shared = page.waitForResponse(res => new URL(res.url()).pathname === '/api/v1/shopping-list/from-plan' && res.request().method() === 'POST');
  await share.click();
  const receipt = await shared;
  expect(receipt.status()).toBe(200);
  const shareBody = receipt.request().postDataJSON();
  expect(shareBody).toMatchObject({ planId: initial.plan.id, expectedRevision: initial.plan.revision, startDate: '2030-01-07', endDate: '2030-01-09' });
  await expect(page.getByRole('status').filter({ hasText: /^Đã cập nhật nhu cầu cho/ })).toBeVisible();
  const saved = await getJson(page, '/api/v1/shopping-list');
  await page.getByRole('link', { name: 'Mở danh sách và chỉnh lượng', exact: true }).click();
  await page.reload();
  expect(await getJson(page, '/api/v1/shopping-list')).toEqual(saved);
  expect(await getJson(page, '/api/v1/inventory')).toEqual(inventory);
  await writeFile(info.outputPath('generated-summary.json'), JSON.stringify({
    intentSlots: initial.plan.intent.slots.length, revision: initial.plan.revision, createRequests: posts.length,
    pendingDisabled: true, invalidDaysBlocked: true, reloadPreservedPlan: true,
    shareRange: { startDate: shareBody.startDate, endDate: shareBody.endDate },
    sharedListSurvivedReload: true, inventoryUnchanged: true, observations, localSyntheticApi: true,
  }, null, 2));
});

test('manual calendar and keyboard picker stay reachable across viewport and text sizes', async ({ page }, info) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(10_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const inventory = await getJson(page, '/api/v1/inventory');
  await setup(page, true);
  await page.getByRole('button', { name: 'Tạo lịch trống để tự chọn món', exact: true }).click();
  await expect(page).toHaveURL(/\/planner\/(?!new$)[^/]+$/);
  const initial = await currentPlan(page);
  const chooseMeal = page.getByRole('link', { name: 'Chọn món cho bữa này', exact: true }).first();
  await expect(chooseMeal).toBeVisible();
  await chooseMeal.click();
  await expect(page.getByRole('heading', { name: 'Các món trong bữa', exact: true })).toBeVisible();
  const mealPath = new URL(page.url()).pathname;
  const trigger = page.getByRole('button', { name: 'Thêm món', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const picker = page.getByRole('dialog', { name: 'Chọn món', exact: true });
  await expect(picker.getByRole('searchbox', { name: 'Tìm món', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await picker.evaluate(node => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await picker.getByRole('combobox', { name: 'Vai trò', exact: true }).selectOption('main');
  await picker.getByRole('combobox', { name: 'Ẩm thực', exact: true }).selectOption('');
  const choose = picker.getByRole('button', { name: /^Chọn:/ }).first();
  await expect(choose).toBeEnabled();
  const observations = await capture(page, info, 'picker', configurations);
  await writeFile(info.outputPath('picker-layout-summary.json'), JSON.stringify({ observations, localSyntheticApi: true }, null, 2));
  const choice = await choose.getAttribute('aria-label');
  const added = page.waitForResponse(res => new URL(res.url()).pathname.endsWith('/components') && res.request().method() === 'POST');
  await choose.click();
  expect((await added).status()).toBe(200);
  await expect(picker).toBeHidden();
  const accepted = await currentPlan(page);
  expect(accepted.plan.revision).toBe(initial.plan.revision + 1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Các món trong bữa', exact: true })).toBeVisible();
  expectPersistedPlan(await currentPlan(page), accepted);
  expect(await getJson(page, '/api/v1/inventory')).toEqual(inventory);
  await writeFile(info.outputPath('manual-summary.json'), JSON.stringify({
    manualSlots: initial.plan.intent.slots.length, initialRevision: initial.plan.revision, acceptedRevision: accepted.plan.revision,
    choice, mealPath, keyboardFocusAndEscape: true, reloadPreservedPlan: true, inventoryUnchanged: true, localSyntheticApi: true,
  }, null, 2));
});

test('saved recipe warning remains readable without claiming current ingredient coverage', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  await setup(page, true);
  await page.getByRole('button', { name: 'Tạo lịch trống để tự chọn món', exact: true }).click();
  await expect(page).toHaveURL(/\/planner\/(?!new$)[^/]+$/);
  await page.getByRole('link', { name: 'Chọn món cho bữa này', exact: true }).first().click();
  await page.getByRole('button', { name: 'Thêm món', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Chọn món', exact: true });
  await picker.getByRole('combobox', { name: 'Vai trò', exact: true }).selectOption('main');
  await picker.getByRole('combobox', { name: 'Ẩm thực', exact: true }).selectOption('');
  const choose = picker.getByRole('button', { name: /^Chọn:/ }).first();
  await expect(choose).toBeEnabled();
  const added = page.waitForResponse(res => new URL(res.url()).pathname.endsWith('/components') && res.request().method() === 'POST');
  await choose.click();
  const addedResponse = await added;
  expect(addedResponse.status()).toBe(200);
  expect(addedResponse.request().postDataJSON()).toMatchObject({ target: { kind: 'recipe' }, role: 'main' });
  await expect(picker).toBeHidden();
  const plan = await currentPlan(page);
  const mealPath = new URL(page.url()).pathname;
  const boardPath = `/planner/${plan.plan.id}`;
  const inventory = await getJson(page, '/api/v1/inventory');
  const writes: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') writes.push(request.method());
  });
  // Synthetic historical DTO; API authorization and freshness are verified in integration tests.
  await page.route(url => url.pathname.endsWith('/compositions'), async route => {
    const response = await route.fetch();
    const body = await response.json();
    for (const composition of body.compositions) {
      if (composition.components.length) {
        composition.warnings.push('SAVED_CONTENT_REQUIRES_REVALIDATION');
        composition.missingRoles = [];
        composition.recommendedRoles = [];
      }
      for (const component of composition.components) {
        component.projection = null;
        delete component.assessment;
      }
    }
    await route.fulfill({ response, json: body });
  });
  const notice = page.getByRole('status').filter({ hasText: 'Bữa này giữ công thức đã chọn trước đây.' });
  await page.reload();
  await expect(notice).toBeVisible();
  await expect(page.locator('.planning-composer-state')).toHaveText('Cần kiểm tra lại bữa ăn: có món chưa đáp ứng điều kiện hiện tại.');
  await expect(page.locator('.ingredient-coverage')).toHaveCount(0);
  const observations = await capture(page, info, 'saved-recipe-meal');
  await page.goto(boardPath);
  await expect(notice).toBeVisible();
  await expect(page.getByText('Cần kiểm tra lại bữa ăn', { exact: true })).toBeVisible();
  observations.push(...await capture(page, info, 'saved-recipe-board'));
  expect(writes).toEqual([]);
  expect(await getJson(page, '/api/v1/inventory')).toEqual(inventory);
  expectPersistedPlan(await currentPlan(page), plan);
  await writeFile(info.outputPath('saved-warning-summary.json'), JSON.stringify({
    localSyntheticApi: true, historicalDtoIsSynthetic: true, writes,
    inventoryUnchanged: true, savedPlanUnchanged: true, mealPath, observations,
  }, null, 2));
});
