import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import type { MealPlan } from '@frigo/domain';
import { test, expect, getJson } from '../t13b/fixtures';

const configs = [[320, 568, 1], [320, 420, 2], [390, 844, 1], [1440, 900, 1]] as const;

async function boundary(page: Page) {
  return {
    inventory: await getJson(page, '/api/v1/inventory'),
    shopping: await getJson(page, '/api/v1/shopping-list'),
    family: await getJson(page, '/api/v1/family-preferences'),
  };
}

async function capture(page: Page, info: TestInfo, state: string) {
  const observations = [];
  for (const [width, height, scale] of configs) {
    await page.setViewportSize({ width, height });
    await page.evaluate(value => { document.documentElement.style.fontSize = `${value * 100}%`; }, scale);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const metrics = await page.evaluate(() => {
      const root = document.querySelector('.week-dialog') || document.querySelector('.week-body')!;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textOutsideViewport: string[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        if ([...range.getClientRects()].some(rect => rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1))) {
          textOutsideViewport.push(node.textContent.trim());
        }
      }
      return { innerWidth, scrollWidth: document.documentElement.scrollWidth, textOutsideViewport,
        brokenImages: [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => new URL(image.src).pathname) };
    });
    expect.soft(metrics.innerWidth, `${state}: requested width`).toBe(width);
    expect.soft(metrics.scrollWidth, `${state}: document overflow`).toBeLessThanOrEqual(width);
    expect.soft(metrics.textOutsideViewport, `${state}: readable text`).toEqual([]);
    expect.soft(metrics.brokenImages, `${state}: assets`).toEqual([]);
    const controls = page.locator('.week-dialog button, .week-body .week-button, .week-body .week-choice');
    const targets = [];
    for (const control of await controls.all()) {
      if (!await control.isVisible()) continue;
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox();
      const fits = !!box && box.width >= 44 && box.height >= 44 && box.x >= -1 && box.x + box.width <= width + 1;
      expect.soft(fits, `${state}: control target`).toBe(true);
      if (await control.isEnabled() && !await page.getByRole('dialog').count()) await control.click({ trial: true });
      targets.push({ text: (await control.innerText()).trim(), box, fits });
    }
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect.soft(axe.violations.map(({ id }) => id), `${state}: axe`).toEqual([]);
    const observation = { state, viewport: { width, height }, textScale: scale, metrics, targets };
    await writeFile(info.outputPath(`axe-${state}-${width}x${height}-text${scale}.json`), JSON.stringify({
      ...observation, violations: axe.violations, incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })),
    }, null, 2));
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: info.outputPath(`${state}-${width}x${height}-text${scale}.png`), fullPage: true, animations: 'disabled' });
    observations.push(observation);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
  return observations;
}

// This packet must run with both real preview flags OFF; no feature-module replacement.
test('real flag-off Week generates and reads without stock changes; settings stay in session', async ({ page }, info) => {
  test.skip(process.env.PREVIEW_MEAL_PLANNER_ENABLED !== 'false' || process.env.PREVIEW_MEAL_COMPOSITION_V2 !== 'false',
    'Requires both actual preview flags OFF; no module interception.');
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/__preview');
  await page.getByRole('button', { name: 'Đặt lại dữ liệu thử nghiệm và đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tuần này, mình ăn gì?' })).toBeVisible();
  await expect(page).toHaveURL(/\/week$/);
  const gates = await page.evaluate(async () => Promise.all([
    '/api/v1/meal-planning/plans/current', '/api/v2/meal-planning/plans/current',
  ].map(async path => { const response = await fetch(path, { cache: 'no-store' }); return { path, status: response.status, body: await response.json() }; })));
  expect(gates[0]).toMatchObject({ status: 404, body: { code: 'MEAL_PLANNER_DISABLED' } });
  expect(gates[1]).toMatchObject({ status: 404, body: { code: 'MEAL_COMPOSITION_DISABLED' } });
  expect(await getJson(page, '/api/v1/week/current')).toEqual({ plan: null });
  const before = await boundary(page);
  const writes: Array<{ method: string; path: string; body: string | null; idempotencyKey: string | undefined }> = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push({ method: request.method(), path, body: request.postData(), idempotencyKey: request.headers()['idempotency-key'] });
    }
  });
  const aliases = ['/planner', '/planner/new', '/planner/compat-plan', '/planner/compat-plan/meal/compat-meal', '/planner/compat-plan/shopping'];
  for (const alias of aliases) {
    await page.goto(alias);
    await expect(page).toHaveURL(/\/week$/);
    await expect(page.getByRole('heading', { name: 'Chưa có thực đơn tuần' })).toBeVisible();
  }
  const observations = [...await capture(page, info, 'empty')];
  await page.getByRole('link', { name: 'Lên thực đơn tuần', exact: true }).press('Enter');
  await expect(page).toHaveURL(/\/week\/setup$/);
  await expect(page.getByRole('list', { name: 'Các bước thiết lập' }).locator('li')).toHaveCount(4);
  await page.getByRole('radio', { name: /Sáng, trưa và tối/ }).press('Space');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).press('Enter');
  await page.getByRole('radio', { name: 'Không giới hạn ngân sách', exact: true }).press('Space');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).press('Enter');
  await page.getByRole('checkbox', { name: 'Tiết kiệm chi phí', exact: true }).press('Space');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).press('Enter');
  await page.getByRole('radio', { name: /2 lần/ }).press('Space');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Bước trước', exact: true }).press('Enter');
  await expect(page.getByRole('radio', { name: /Sáng, trưa và tối/ })).toBeChecked();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).press('Enter');
  await expect(page.getByRole('radio', { name: 'Không giới hạn ngân sách', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Tiết kiệm chi phí', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).press('Enter');
  await expect(page.getByRole('radio', { name: /2 lần/ })).toBeChecked();
  expect(writes).toEqual([]);
  observations.push(...await capture(page, info, 'setup-review'));

  let release = () => {};
  const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/week/plans', async route => {
    if (route.request().method() === 'POST') await hold;
    await route.continue();
  });
  const generated = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/week/plans' && response.request().method() === 'POST');
  try {
    await page.getByRole('button', { name: 'Tạo thực đơn tuần', exact: true }).press('Enter');
    await expect(page).toHaveURL(/\/week\/generating$/);
    await expect(page.getByRole('heading', { name: 'Đang lên thực đơn cho tuần của bạn…' })).toBeVisible();
    observations.push(...await capture(page, info, 'generating-held'));
  } finally { release(); }
  const response = await generated;
  expect(response.status()).toBe(201);
  const { plan } = await response.json() as { plan: MealPlan };
  await expect(page).toHaveURL(new RegExp(`/week/${plan.id}$`));
  await expect(page.getByRole('heading', { name: 'Tuần này, mình ăn gì?' })).toBeVisible();
  expect(plan.days).toHaveLength(7);
  expect(plan.days.flatMap(day => day.slots)).toHaveLength(21);
  const payload = JSON.parse(writes[0].body!);
  expect(payload).toMatchObject({ mealSlotsPreset: 'all', budgetTargetVnd: null, shoppingFrequency: 'twice', priorities: ['use_fridge', 'budget'], planId: plan.id });
  expect(writes).toHaveLength(1);
  expect(writes[0].idempotencyKey).toBe(payload.commandId);
  expect(await boundary(page)).toEqual(before);
  const committed = await getJson(page, `/api/v1/week/plans/${plan.id}`);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tuần này, mình ăn gì?' })).toBeVisible();
  expect(await getJson(page, `/api/v1/week/plans/${plan.id}`)).toEqual(committed);
  observations.push(...await capture(page, info, 'board'));
  const share = page.getByRole('button', { name: 'Chia sẻ thực đơn', exact: true });
  await share.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Chia sẻ thực đơn tuần' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(share).toBeFocused();

  await page.locator(`a[href^="/week/${plan.id}/meal/"]`).first().press('Enter');
  await expect(page.getByRole('group', { name: 'Nội dung công thức' })).toBeVisible();
  for (const tab of ['Cách nấu', 'Dinh dưỡng', 'Nguyên liệu']) {
    await page.getByRole('button', { name: tab, exact: true }).press('Enter');
    await expect(page.getByRole('button', { name: tab, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  observations.push(...await capture(page, info, 'meal'));
  const swap = page.getByRole('button', { name: 'Đổi món', exact: true });
  const alternatives = page.waitForResponse(response => /\/meals\/[^/]+\/swap$/.test(new URL(response.url()).pathname));
  await swap.press('Enter');
  expect((await alternatives).status()).toBe(200);
  await expect(page.getByRole('dialog', { name: /^Thay thế:/ })).toBeVisible();
  observations.push(...await capture(page, info, 'swap-read'));
  await page.keyboard.press('Escape');
  // Capturing deliberately blurs focus; reopen to verify the actual return contract.
  await swap.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(swap).toBeFocused();

  await page.goto(`/week/${plan.id}/shopping`);
  await expect(page.getByRole('heading', { name: 'Mua thêm vừa đủ cho tuần.' })).toBeVisible();
  observations.push(...await capture(page, info, 'shopping-list'));
  await page.getByRole('button', { name: 'Bắt đầu đi chợ', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: /Nhập 0 nguyên liệu đã chọn vào tủ/ })).toBeDisabled();
  observations.push(...await capture(page, info, 'shopping-active'));

  await page.goto(`/week/${plan.id}/settings`);
  await expect(page.getByRole('heading', { name: 'Chuẩn bị cho thực đơn tiếp theo.' })).toBeVisible();
  await page.locator('input[name="week-budget"][value="500000"]').press('Space');
  await page.getByRole('radio', { name: /2 lần/ }).press('Space');
  await page.getByRole('button', { name: 'Áp dụng vào bản nháp', exact: true }).press('Enter');
  await expect(page.getByRole('status')).toContainText('Đã áp dụng vào bản nháp');
  observations.push(...await capture(page, info, 'settings-session'));
  await page.getByRole('link', { name: 'Xem lại trước khi tạo mới', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).press('Enter');
  await expect(page.locator('input[name="week-budget"][value="500000"]')).toBeChecked();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).press('Enter');
  await expect(page.getByRole('radio', { name: /2 lần/ })).toBeChecked();
  await page.goto(`/week/${plan.id}/settings`);
  await expect(page.locator('input[name="week-budget"][value="750000"]')).toBeChecked();
  await expect(page.getByRole('radio', { name: /1 lần/ })).toBeChecked();
  expect(await getJson(page, `/api/v1/week/plans/${plan.id}`)).toEqual(committed);
  expect(await boundary(page)).toEqual(before);
  const mutations = writes.filter(row => !/\/meals\/[^/]+\/swap$/.test(row.path));
  expect(mutations).toHaveLength(1);
  expect(mutations[0]).toMatchObject({ method: 'POST', path: '/api/v1/week/plans' });
  for (const read of writes.filter(row => /\/meals\/[^/]+\/swap$/.test(row.path))) {
    expect(JSON.parse(read.body!)).not.toHaveProperty('recipeId');
  }
  await writeFile(info.outputPath('week-off-summary.json'), JSON.stringify({ gates, aliases, payload,
    generationCount: 1, idempotencyKeyMatches: true, slotCount: 21, reloadReadback: true,
    inventoryShoppingFamilyUnchanged: true, currentPlanUnchangedAfterReadsAndSettings: true,
    settingsDraftRetainsAcrossNavigationAndResetsOnReload: true, noShoppingImport: true,
    alternativesReadPosts: writes.length - mutations.length, mutationCount: mutations.length,
    observations, heldGeneration: 'Only transport is held for pending appearance; released to the actual local Worker, no response replacement.' }, null, 2));
});
