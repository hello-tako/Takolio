import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import type { AggregatedShoppingItem, InventoryItem, MealPlan, MealSwapAlternative } from '@frigo/domain';
import { test, expect, control, getJson } from '../t13b/fixtures';

const configurations = [[320, 420, 2], [390, 844, 1], [1440, 900, 1]] as const;

async function boundary(page: Page) {
  return {
    inventory: await getJson<{ items: InventoryItem[] }>(page, '/api/v1/inventory'),
    shopping: await getJson(page, '/api/v1/shopping-list'),
    family: await getJson(page, '/api/v1/family-preferences'),
  };
}

async function capture(page: Page, info: TestInfo, state: string) {
  const observations = [];
  for (const [width, height, scale] of configurations) {
    await page.setViewportSize({ width, height });
    await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%`; }, scale);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      brokenImages: [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => new URL(image.src).pathname),
      dialogContainsFocus: document.querySelector('[role="dialog"]')?.contains(document.activeElement) ?? null,
    }));
    expect.soft(metrics.scrollWidth, `${state}: horizontal overflow`).toBeLessThanOrEqual(width);
    expect.soft(metrics.brokenImages, `${state}: assets`).toEqual([]);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect.soft(axe.violations.map(({ id }) => id), `${state}: axe`).toEqual([]);
    const observation = { state, viewport: { width, height }, rootTextScale: scale, metrics,
      violations: axe.violations, incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })) };
    await writeFile(info.outputPath(`${state}-${width}x${height}-text${scale}.json`), JSON.stringify(observation, null, 2));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath(`${state}-${width}x${height}-text${scale}.png`), fullPage: true, animations: 'disabled' });
    observations.push(observation);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
  return observations;
}

test('real Week OFF swaps and imports selected stock; clipboard success and synthetic errors stay truthful', async ({ page, context }, info) => {
  test.skip(process.env.PREVIEW_MEAL_PLANNER_ENABLED !== 'false' || process.env.PREVIEW_MEAL_COMPOSITION_V2 !== 'false',
    'Requires both actual preview flags OFF; no feature-module interception.');
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/__preview');
  await page.getByRole('button', { name: 'Đặt lại dữ liệu thử nghiệm và đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Chưa có thực đơn tuần', exact: true })).toBeVisible();
  const before = await boundary(page);
  const fixtureBefore = await control<{ inventoryEventCount: number }>(page, 'state');
  await page.getByRole('link', { name: 'Lên thực đơn tuần', exact: true }).press('Enter');
  for (let stage = 0; stage < 3; stage++) await page.getByRole('button', { name: 'Tiếp tục', exact: true }).press('Enter');
  const generated = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/week/plans' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Tạo thực đơn tuần', exact: true }).press('Enter');
  const generation = await generated;
  expect(generation.status()).toBe(201);
  const { plan } = await generation.json() as { plan: MealPlan };
  await expect(page).toHaveURL(new RegExp(`/week/${plan.id}$`));
  expect(await boundary(page)).toEqual(before);
  const observations = [];

  const share = page.getByRole('button', { name: 'Chia sẻ thực đơn', exact: true });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin });
  await share.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Chia sẻ thực đơn tuần', exact: true });
  await expect(dialog.getByRole('button', { name: 'Đóng chia sẻ', exact: true })).toBeFocused();
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await dialog.getByRole('button', { name: 'Sao chép thực đơn', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Đã sao chép thực đơn.');
  const nativeClipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(nativeClipboard).toContain(`THỰC ĐƠN TUẦN NÀY (${plan.days.reduce((count, day) => count + day.slots.length, 0)} bữa)`);
  for (const day of plan.days) {
    expect(nativeClipboard).toContain(day.dayNameVi);
    for (const slot of day.slots) if (slot.recipe) expect(nativeClipboard).toContain(slot.recipe.title);
  }
  observations.push(...await capture(page, info, 'clipboard-native-success'));
  await page.keyboard.press('Escape');
  await expect(share).toBeFocused();

  for (const failure of ['rejected', 'unsupported'] as const) {
    await page.evaluate(failure => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: failure === 'unsupported'
        ? undefined : { writeText: async () => { throw new DOMException('Synthetic clipboard denial', 'NotAllowedError'); } } });
    }, failure);
    await share.press('Enter');
    await dialog.getByRole('button', { name: 'Sao chép thực đơn', exact: true }).click();
    const error = dialog.getByRole('alert');
    await expect(error).toHaveText('Chưa sao chép được. Hãy kiểm tra quyền sao chép của trình duyệt rồi thử lại.');
    await expect(error).toBeFocused();
    await expect(dialog).not.toContainText('Đã sao chép');
    observations.push(...await capture(page, info, `clipboard-${failure}-synthetic`));
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(share).toBeFocused();
    await page.evaluate(() => { Reflect.deleteProperty(navigator, 'clipboard'); });
  }
  expect(await boundary(page)).toEqual(before);

  const mealLink = page.locator(`a[href^="/week/${plan.id}/meal/"]`).first();
  const mealId = (await mealLink.getAttribute('href'))!.split('/').at(-1)!;
  const originalSlot = plan.days.flatMap(day => day.slots).find(slot => slot.id === mealId)!;
  await mealLink.press('Enter');
  const swapPath = `/api/v1/week/plans/${plan.id}/meals/${mealId}/swap`;
  const alternativesRead = page.waitForResponse(response => new URL(response.url()).pathname === swapPath);
  await page.getByRole('button', { name: 'Đổi món', exact: true }).press('Enter');
  const alternativesResponse = await alternativesRead;
  expect(alternativesResponse.status()).toBe(200);
  expect(alternativesResponse.request().postDataJSON()).not.toHaveProperty('recipeId');
  const { alternatives } = await alternativesResponse.json() as { alternatives: MealSwapAlternative[] };
  const alternative = alternatives.find(candidate => candidate.recipe.id !== originalSlot.recipe?.id)!;
  expect(alternative).toBeDefined();
  expect(await boundary(page)).toEqual(before);
  const swappedResponse = page.waitForResponse(response => new URL(response.url()).pathname === swapPath && Boolean(response.request().postDataJSON().recipeId));
  await page.getByRole('dialog').getByRole('button', { name: `Chọn món ${alternative.recipe.title}`, exact: true }).press('Enter');
  const swapped = await swappedResponse;
  expect(swapped.status()).toBe(200);
  const swapBody = swapped.request().postDataJSON() as { recipeId: string; commandId: string };
  expect(swapBody.recipeId).toBe(alternative.recipe.id);
  expect(swapBody.commandId).toBeTruthy();
  expect(swapped.request().headers()['idempotency-key']).toBe(swapBody.commandId);
  const swappedReceipt = await swapped.json() as { plan: MealPlan };
  expect(swappedReceipt.plan.days.flatMap(day => day.slots).find(slot => slot.id === mealId)?.recipe?.id).toBe(alternative.recipe.id);
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('heading', { name: alternative.recipe.title, exact: true })).toBeVisible();
  expect(await getJson(page, `/api/v1/week/plans/${plan.id}`)).toEqual(swappedReceipt);
  await page.reload();
  await expect(page.getByRole('heading', { name: alternative.recipe.title, exact: true })).toBeVisible();
  expect(await getJson(page, `/api/v1/week/plans/${plan.id}`)).toEqual(swappedReceipt);
  expect(await boundary(page)).toEqual(before);
  observations.push(...await capture(page, info, 'swap-accepted-readback'));

  const item = swappedReceipt.plan.shoppingItems.find(candidate => !candidate.cannotBuy && !candidate.checked &&
    candidate.recommendedPurchaseQuantity > 0 && !before.inventory.items.some(stock =>
      stock.ingredientId === candidate.ingredientId || stock.name.trim().toLowerCase() === candidate.name.trim().toLowerCase()))!;
  expect(item, 'A buyable, unstocked plan item is required for exact import evidence').toBeDefined();
  expect(swappedReceipt.plan.shoppingItems.filter(candidate => !candidate.checked).length).toBeGreaterThan(1);
  await page.goto(`/week/${plan.id}/shopping`);
  await page.getByRole('button', { name: 'Bắt đầu đi chợ', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Nhập 0 nguyên liệu đã chọn vào tủ', exact: true })).toBeDisabled();
  const itemButton = page.locator('.week-shopping-item').filter({ has: page.getByText(item.name, { exact: true }) });
  const toggleResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/week/plans/${plan.id}/shopping/items/${item.ingredientId}` && response.request().method() === 'PATCH');
  await itemButton.press('Enter');
  expect((await toggleResponse).status()).toBe(200);
  await expect(itemButton).toHaveAttribute('aria-pressed', 'true');
  const checkedPlan = await getJson<{ plan: MealPlan }>(page, `/api/v1/week/plans/${plan.id}`);
  expect(checkedPlan.plan.shoppingItems.filter(candidate => candidate.checked).map(candidate => candidate.ingredientId)).toEqual([item.ingredientId]);
  expect(await boundary(page)).toEqual(before);
  observations.push(...await capture(page, info, 'import-one-selected'));
  const completePath = `/api/v1/week/plans/${plan.id}/shopping/complete`;
  const completedResponse = page.waitForResponse(response => new URL(response.url()).pathname === completePath && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Nhập 1 nguyên liệu đã chọn vào tủ', exact: true }).press('Enter');
  const completed = await completedResponse;
  expect(completed.status()).toBe(200);
  const importBody = completed.request().postDataJSON() as { items: AggregatedShoppingItem[]; commandId: string };
  const importKey = completed.request().headers()['idempotency-key'];
  expect(importBody.items).toEqual(checkedPlan.plan.shoppingItems.filter(candidate => candidate.checked));
  expect(importKey).toBe(importBody.commandId);
  const importReceipt = await completed.json() as { success: boolean; importedItemsCount: number; pendingSync?: boolean };
  expect(importReceipt).toMatchObject({ success: true, importedItemsCount: 1 });
  expect(importReceipt.pendingSync).not.toBe(true);
  await expect(page.getByRole('heading', { name: 'Đã nhập nguyên liệu vào tủ.', exact: true })).toBeVisible();
  await expect(page.locator('.week-completion')).toBeFocused();
  await expect(page.locator('.week-completion-list li')).toHaveCount(1);
  await expect(page.locator('.week-completion-list')).toContainText(item.name);
  const afterImport = await boundary(page);
  expect(afterImport.shopping).toEqual(before.shopping);
  expect(afterImport.family).toEqual(before.family);
  expect(afterImport.inventory.items).toHaveLength(before.inventory.items.length + 1);
  const added = afterImport.inventory.items.filter(stock => !before.inventory.items.some(previous => previous.id === stock.id));
  expect(added).toHaveLength(1);
  expect(added[0]).toMatchObject({ ingredientId: item.ingredientId, name: item.name,
    quantity: item.recommendedPurchaseQuantity, unit: item.unit, dataSource: 'shopping' });
  for (const stock of before.inventory.items) expect(afterImport.inventory.items.find(candidate => candidate.id === stock.id)).toEqual(stock);
  const fixtureAfter = await control<{ inventoryEventCount: number }>(page, 'state');
  expect(fixtureAfter.inventoryEventCount).toBe(fixtureBefore.inventoryEventCount + 1);
  observations.push(...await capture(page, info, 'import-complete'));

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mua thêm vừa đủ cho tuần.', exact: true })).toBeVisible();
  expect(await boundary(page)).toEqual(afterImport);
  const replay = await page.evaluate(async ({ path, body, key }) => {
    const response = await fetch(path, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'Idempotency-Key': key!,
      'X-Frigo-Expected-User-Id': localStorage.getItem('frigo_user_id')!,
      'X-Frigo-Expected-Household-Id': localStorage.getItem('frigo_household_id')!,
    }, body: JSON.stringify(body) });
    return { status: response.status, receipt: await response.json() };
  }, { path: completePath, body: importBody, key: importKey });
  expect(replay).toMatchObject({ status: 200, receipt: { success: true, importedItemsCount: 1, idempotentReplay: true } });
  expect(await boundary(page)).toEqual(afterImport);
  expect((await control<{ inventoryEventCount: number }>(page, 'state')).inventoryEventCount).toBe(fixtureAfter.inventoryEventCount);
  await page.goto('/fridge');
  await expect(page.getByRole('heading', { name: 'Tủ lạnh của tôi', exact: true })).toBeVisible();
  await expect(page.getByText(item.name, { exact: true })).toBeVisible();
  observations.push(...await capture(page, info, 'stock-readback-after-replay'));
  await writeFile(info.outputPath('week-commands-summary.json'), JSON.stringify({
    localOnly: true, actualPreviewFlags: { mealPlanner: false, mealCompositionV2: false },
    generation: { status: generation.status(), planId: plan.id, stockUnchanged: true },
    clipboard: { success: 'Native Chromium clipboard write/read with granted local-origin permissions',
      copiedText: nativeClipboard, failures: ['rejected', 'unsupported'], failureMechanism: 'Synthetic navigator.clipboard replacement; no device permission denial claim',
      focusedSafeErrors: true, dialogTabContainmentEscapeAndReturn: true },
    swap: { status: swapped.status(), mealId, originalRecipeId: originalSlot.recipe?.id,
      body: swapBody, receipt: swappedReceipt, reloadReadback: true, inventoryShoppingFamilyUnchanged: true,
      idempotencyLimit: 'Header/body identity observed only; Week swap does not expose a durable command receipt. No replay/idempotency claim.' },
    import: { status: completed.status(), selected: item, body: importBody, idempotencyKey: importKey,
      receipt: importReceipt, added, existingRowsUnchanged: true, unselectedNotImported: true,
      reloadReadback: true, replay, stockUnchangedByReplay: true, inventoryEvents: [fixtureBefore.inventoryEventCount, fixtureAfter.inventoryEventCount] },
    before, afterImport, observations,
    limitations: ['Synthetic registered household on the real local Worker/in-memory SQLite', 'Root-font scaling and reduced motion simulations',
      'Chromium only; no physical device, Safari, native zoom or screen-reader certification', 'Axe incomplete results retained; no full accessibility certification',
      'No offline durability, swap replay, production or remote mutation evidence'],
  }, null, 2));
});

test('fridge identity and expiry labels reflow without clipped chips across short and tall screens', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/__preview');
  await page.getByRole('button', { name: 'Đặt lại dữ liệu thử nghiệm và đăng nhập' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('frigo_user_id'))).toBe('planner-preview-user');
  await page.waitForURL(url => url.pathname !== '/__preview');
  const before = await boundary(page);
  const writes: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${path}`);
  });
  await page.goto('/fridge');
  await expect(page.getByRole('heading', { name: 'Tủ lạnh của tôi', exact: true })).toBeVisible();
  const observations = [];
  for (const [width, height, scale] of [[320, 420, 2], [390, 420, 1], [768, 420, 1], [390, 844, 1], [1440, 900, 1]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%`; }, scale);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const geometry = await page.getByTestId('inventory-row').evaluateAll(rows => {
      const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, rows: rows.map(row => {
        const chip = row.querySelector('span.inline-flex')!;
        const heading = row.querySelector('h2')!;
        const title = heading.querySelector('button') ?? heading;
        const range = document.createRange();
        range.selectNodeContents(title);
        return { name: heading.textContent?.trim(), row: rect(row), chip: rect(chip), label: rect(chip.lastElementChild!),
          heading: rect(heading), titleLines: [...range.getClientRects()].map(r => ({ x: r.x, y: r.y, right: r.right, bottom: r.bottom })) };
      }) };
    });
    expect(geometry.width).toBe(width);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
    expect(geometry.rows).toHaveLength(before.inventory.items.length);
    for (const row of geometry.rows) {
      expect(row.label.x, `${row.name}: label starts inside chip`).toBeGreaterThanOrEqual(row.chip.x);
      expect(row.label.right, `${row.name}: full label fits chip`).toBeLessThanOrEqual(row.chip.right + 1);
      expect(row.label.y).toBeGreaterThanOrEqual(row.chip.y);
      expect(row.label.bottom).toBeLessThanOrEqual(row.chip.bottom + 1);
      expect(row.chip.x).toBeGreaterThanOrEqual(row.row.x);
      expect(row.chip.right).toBeLessThanOrEqual(row.row.right);
      for (const line of row.titleLines) {
        expect(line.x).toBeGreaterThanOrEqual(row.heading.x - 1);
        expect(line.right, `${row.name}: full title fits heading`).toBeLessThanOrEqual(row.heading.right + 1);
      }
      expect(row.chip.y >= row.heading.bottom - 1 || row.chip.x >= row.heading.right - 1, `${row.name}: title and status do not overlap`).toBe(true);
    }
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(axe.violations.map(({ id }) => id)).toEqual([]);
    const observation = { width, height, rootTextScale: scale, geometry, violations: axe.violations,
      incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })) };
    await writeFile(info.outputPath(`fridge-${width}x${height}-text${scale}.json`), JSON.stringify(observation, null, 2));
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath(`fridge-${width}x${height}-text${scale}.png`), fullPage: true, animations: 'disabled' });
    observations.push(observation);
  }
  expect(writes).toEqual([]);
  expect(await boundary(page)).toEqual(before);
  await writeFile(info.outputPath('fridge-reflow-summary.json'), JSON.stringify({ observations, writes, domainSnapshotsUnchanged: true,
    limitations: ['Isolated Chromium/local Worker/SQLite', 'Root-font scaling is synthetic, not native browser zoom', 'No physical device, Safari or screen-reader certification'] }, null, 2));
});
