import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FamilyMealPlanDtoSchema } from '../../packages/domain/src/family-meal-planning-api';

const folder = '.wrangler/family-meals';
test('recipe servings flow into an empty calendar, exact manual dishes and trip shopping', async ({ page }) => {
  await page.goto('/__preview');
  await page.getByRole('button', { name: 'Đặt lại dữ liệu thử nghiệm và đăng nhập' }).click();
  await page.waitForURL('**/planner');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('vi');
  await page.goto('/inventory');
  await page.getByRole('button', { name: 'Thêm nguyên liệu', exact: true }).click();
  await page.getByLabel('Tên nguyên liệu', { exact: true }).fill('Thịt ba chỉ');
  await page.getByLabel('Số lượng', { exact: true }).fill('0.5');
  await page.getByLabel('Đơn vị', { exact: true }).selectOption('kg');
  await page.getByRole('button', { name: 'Chưa rõ', exact: true }).click();
  const addedStock = page.waitForResponse(response => response.url().endsWith('/api/v1/inventory')
    && response.request().method() === 'POST').then(async response => ({ status: response.status(), body: await response.json() }));
  await page.getByRole('button', { name: 'Lưu vào tủ lạnh', exact: true }).click();
  const added = await addedStock;
  expect(added.status).toBe(201);
  await page.goto(`/ingredients/${added.body.item.id}`);
  await page.getByRole('button', { name: 'Sửa thông tin nguyên liệu', exact: true }).click();
  await page.getByLabel('Lượng còn thực tế', { exact: true }).fill('0.35');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sửa thông tin nguyên liệu', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.stock-quantity')).toContainText('0.35 kg');
  await page.getByRole('button', { name: 'Sửa thông tin nguyên liệu', exact: true }).click();
  await page.getByLabel('Đơn vị', { exact: true }).selectOption('g');
  await expect(page.getByLabel('Lượng còn thực tế', { exact: true })).toHaveValue('350');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sửa thông tin nguyên liệu', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.stock-quantity')).toContainText('350 g');
  await page.getByRole('button', { name: 'Sửa thông tin nguyên liệu', exact: true }).click();
  await page.getByLabel('Đơn vị', { exact: true }).selectOption('kg');
  await expect(page.getByLabel('Lượng còn thực tế', { exact: true })).toHaveValue('0.35');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sửa thông tin nguyên liệu', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.stock-quantity')).toContainText('0.35 kg');
  const stockBefore = await page.evaluate(async () => (await fetch('/api/v1/inventory')).json());
  await page.goto('/recipes/id/vn-kho-01?servings=4');
  await expect(page.getByRole('combobox', { name: 'Nấu cho bao nhiêu người?' })).toHaveValue('4');
  const title = await page.locator('.recipe-intro h1').textContent();
  await page.getByRole('button', { name: 'Xếp món vào bữa', exact: true }).click();
  const destination = page.getByRole('dialog', { name: `Đặt ${title} vào bữa`, exact: true });
  await destination.getByRole('link', { name: 'Tạo lịch trống để chọn món', exact: true }).click();
  await expect(page).toHaveURL(/\/planner\/new\?recipe=vn-kho-01&servings=4$/);
  await expect(page.locator('input[value="manual"]')).toBeChecked();
  await page.getByLabel('Ngày bắt đầu', { exact: true }).fill('2030-01-07');
  await page.getByLabel('Số ngày', { exact: true }).fill('7');
  if (page.viewportSize()!.width === 390) {
    await page.screenshot({ path: `${folder}/manual-setup-390.png`, fullPage: true });
  }
  const draftResponse = page.waitForResponse(response => response.url().endsWith('/api/v2/meal-planning/drafts')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Tạo lịch trống để tự chọn món', exact: true }).click();
  const response = await draftResponse;
  expect(response.status(), await response.text()).toBe(200);
  const draft = FamilyMealPlanDtoSchema.parse(await response.json());
  expect(draft.compositions.compositions).toHaveLength(7);
  expect(draft.compositions.compositions.every(meal => meal.mode === 'manual' && meal.servings === 4 && !meal.components.length)).toBe(true);
  const first = draft.compositions.compositions[0];
  await page.waitForURL(/\/meal\/.+\?recipe=vn-kho-01$/);
  let picker = page.getByRole('dialog', { name: 'Chọn món', exact: true });
  await expect(picker.locator('.planning-picker-context')).toContainText('2030-01-07 · Bữa tối · 4 người');
  await expect(picker.locator('input[type="search"]')).toHaveValue('');
  await expect(picker).toContainText('Món bạn vừa chọn');
  await picker.getByText('Xem lượng nguyên liệu').first().click();
  await expect(picker.getByText('Từ tủ', { exact: true }).first()).toBeVisible();
  await expect(picker.getByText('Cần mua', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${folder}/quantity-picker-${page.viewportSize()!.width}.png`, fullPage: true });
  const pickerAudit = await new AxeBuilder({ page }).include('.planning-picker-panel').analyze();
  expect(pickerAudit.violations.map(item => item.id)).toEqual([]);
  await picker.getByRole('button', { name: `Chọn: ${title}`, exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(page.locator('.planning-component-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Thêm món: Cơm / tinh bột', exact: true }).click();
  picker = page.getByRole('dialog', { name: 'Chọn món', exact: true });
  await expect(picker.getByRole('button', { name: 'Chọn: Cơm trắng', exact: true })).toBeVisible();
  const rice = picker.locator('.planning-picker-item').filter({ hasText: 'Cơm trắng' });
  await rice.getByText('Xem lượng nguyên liệu').click();
  await expect(rice).toContainText('320 g');
  await picker.getByRole('button', { name: 'Chọn: Cơm trắng', exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(page.locator('.planning-component-row')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.planning-component-row')).toHaveCount(2);
  await expect(page.getByRole('button', { name: `Mở khoá món: ${title}`, exact: true })).toBeVisible();
  await page.goto(`/planner/${draft.plan.id}`);
  await expect(page.locator('.planning-manual-empty')).toHaveCount(6);
  await expect(page.locator('.planning-board-summary')).toContainText('Còn bữa cần hoàn thiện');
  await page.screenshot({ path: `${folder}/manual-board-${page.viewportSize()!.width}.png`, fullPage: true });

  await page.goto('/recipes/id/vn-kho-01?servings=2');
  await page.getByRole('button', { name: 'Xếp món vào bữa', exact: true }).click();
  const currentDestination = page.getByRole('dialog', { name: `Đặt ${title} vào bữa`, exact: true });
  await expect(currentDestination.getByRole('combobox', { name: 'Bữa', exact: true })).toContainText('4 người');
  await expect(currentDestination.getByRole('radio', { name: 'Thêm món này', exact: true })).toBeChecked();
  await currentDestination.getByRole('radio', { name: 'Thay món cùng nhóm', exact: true }).check();
  await expect(currentDestination).toContainText(`Món này sẽ thay “${title}”`);
  await expect(currentDestination.getByRole('button', { name: 'Thay món trong bữa', exact: true })).toBeEnabled();
  await page.screenshot({ path: `${folder}/manual-replace-${page.viewportSize()!.width}.png`, fullPage: true });
  await currentDestination.getByRole('button', { name: 'Thay món trong bữa', exact: true }).click();
  await currentDestination.getByRole('link', { name: 'Xem bữa vừa chọn', exact: true }).click();
  await expect(page.locator('.planning-component-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Hoàn thiện bữa này', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dùng gợi ý này', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dùng gợi ý này', exact: true }).click();
  await expect(page.locator('.planning-component-row')).toHaveCount(4);
  const family = FamilyMealPlanDtoSchema.parse(await page.evaluate(async () =>
    ((await (await fetch('/api/v2/meal-planning/plans/current')).json()) as { plan: unknown }).plan));
  const composed = family.compositions.compositions.find(meal => meal.slotId === first.slotId)!;
  expect(composed.components.find(component => component.recipeId === 'vn-kho-01')).toMatchObject({ locked: true, provenance: 'manual' });
  expect(composed.components.find(component => component.simpleFoodId === 'sf-steamed-rice')).toMatchObject({ locked: true });
  await page.screenshot({ path: `${folder}/manual-completed-${page.viewportSize()!.width}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const composerAudit = await new AxeBuilder({ page }).include('.planning-composer').analyze();
  expect(composerAudit.violations.map(item => item.id)).toEqual([]);
  const bowlSlot = draft.compositions.compositions[1];
  await page.goto(`/planner/${draft.plan.id}/meal/${encodeURIComponent(bowlSlot.slotId)}?recipe=vn-bun-03`);
  const bowlPicker = page.getByRole('dialog', { name: 'Chọn món', exact: true });
  await expect(bowlPicker.getByRole('button', { name: /^Chọn:/ })).toHaveCount(1);
  await bowlPicker.getByRole('button', { name: /^Chọn:/ }).click();
  await expect(bowlPicker).toHaveCount(0);
  await expect(page.locator('.planning-composer-state')).toHaveText('Đã xếp món cho bữa gọn');
  await expect(page.locator('.planning-component-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Hoàn thiện bữa này', exact: true }).click();
  await page.getByRole('button', { name: 'Dùng gợi ý này', exact: true }).click();
  await page.reload();
  await expect(page.locator('.planning-component-row')).toHaveCount(1);
  await expect(page.locator('.planning-meal-style-note')).toContainText('Bữa gọn');
  await page.screenshot({ path: `${folder}/manual-one-dish-${page.viewportSize()!.width}.png`, fullPage: true });
  const mixed = FamilyMealPlanDtoSchema.parse(await page.evaluate(async () =>
    ((await (await fetch('/api/v2/meal-planning/plans/current')).json()) as { plan: unknown }).plan));
  expect(mixed.compositions.compositions.find(meal => meal.slotId === bowlSlot.slotId)?.missingRoles).toEqual([]);
  expect(mixed.compositions.compositions.find(meal => meal.slotId === first.slotId)?.components).toHaveLength(4);
  await page.goto(`/planner/${draft.plan.id}/shopping`);
  await page.getByRole('combobox', { name: 'Khoảng đi chợ', exact: true }).selectOption('3');
  const shared = page.waitForResponse(result => result.url().endsWith('/shopping-list/from-plan') && result.request().method() === 'POST');
  await page.getByRole('button', { name: 'Tạo danh sách dùng chung', exact: true }).click();
  expect((await shared).status()).toBe(200);
  const tripKeys: string[] = [];
  for (const days of ['7', '3']) {
    await page.getByRole('combobox', { name: 'Khoảng đi chợ', exact: true }).selectOption(days);
    const update = page.waitForResponse(result => result.url().endsWith('/shopping-list/from-plan')
      && result.request().method() === 'POST').then(async result => ({ status: result.status(), body: await result.json(),
        key: result.request().headers()['idempotency-key'], input: result.request().postDataJSON() }));
    await page.getByRole('button', { name: 'Tạo danh sách dùng chung', exact: true }).click();
    const receipt = await update;
    expect(receipt.status).toBe(200); expect(receipt.body.idempotentReplay).toBe(false);
    expect(receipt.input.endDate).toBe(days === '7' ? '2030-01-13' : '2030-01-09');
    tripKeys.push(receipt.key);
  }
  expect(new Set(tripKeys).size).toBe(2);
  await page.getByRole('link', { name: 'Mở danh sách và chỉnh lượng', exact: true }).click();
  await expect(page.locator('.shopping-workspace')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const stockAfter = await page.evaluate(async () => (await fetch('/api/v1/inventory')).json());
  expect(stockAfter).toEqual(stockBefore);

  // Real household stock can change during a week; sharing reprojects it without discarding chosen meals.
  const stockChange = await page.evaluate(async () => {
    const result = await fetch('/__preview/stale-inventory', { method: 'POST' });
    return result.status;
  });
  expect(stockChange).toBe(200);
  const currentStock = await page.evaluate(async () => (await fetch('/api/v1/inventory')).json());
  expect(currentStock).not.toEqual(stockBefore);
  await page.goto(`/planner/${draft.plan.id}/shopping`);
  await expect(page.locator('.planning-stale')).toContainText('Tiếp tục chuẩn bị những bữa sắp tới');
  const currentFamily = FamilyMealPlanDtoSchema.parse(await page.evaluate(async () =>
    ((await (await fetch('/api/v2/meal-planning/plans/current')).json()) as { plan: unknown }).plan));
  expect(currentFamily.plan.freshness.reasons).toContain('stale_inventory');
  await expect(page.getByRole('button', { name: 'Tạo danh sách dùng chung', exact: true })).toBeEnabled();
  const refreshedShopping = page.waitForResponse(result => result.url().endsWith('/shopping-list/from-plan')
    && result.request().method() === 'POST');
  await page.getByRole('button', { name: 'Tạo danh sách dùng chung', exact: true }).click();
  expect((await refreshedShopping).status()).toBe(200);
  expect(await page.evaluate(async () => (await fetch('/api/v1/inventory')).json())).toEqual(currentStock);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const continuingAudit = await new AxeBuilder({ page }).include('.planning-workspace').analyze();
  expect(continuingAudit.violations.map(item => item.id)).toEqual([]);
  await page.screenshot({ path: `${folder}/continuing-shopping-${page.viewportSize()!.width}.png`, fullPage: true });
});
