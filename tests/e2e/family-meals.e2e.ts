import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { z } from 'zod';
import { ShoppingUnknownDemandSchema } from '../../packages/domain/src/shopping-plan-api';
import { FamilyMealPlanDtoSchema } from '../../packages/domain/src/family-meal-planning-api';

const folder = '.wrangler/family-meals';
test('family plan, saved dishes, scoped shopping and editable purchases survive reload', async ({
  page,
}) => {
  await page.goto('/__preview');
  await page.getByRole('button', { name: 'Đặt lại dữ liệu thử nghiệm và đăng nhập' }).click();
  await page.waitForURL('**/planner');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('vi');
  await page.goto('/planner/new');
  await expect(page.getByRole('button', { name: 'Tạo thực đơn', exact: true })).toBeVisible();
  if (page.viewportSize()!.width === 390) {
    await page.screenshot({ path: `${folder}/setup-390.png`, fullPage: true });
    await page.goto('/onboarding/preferences');
    await expect(
      page.getByRole('heading', { name: 'Nhà mình thường nấu thế nào?', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Miền Nam', exact: true })).toBeVisible();
    await page.screenshot({ path: `${folder}/onboarding-390.png`, fullPage: true });
    await page.goto('/planner/new');
    await expect(page.getByRole('button', { name: 'Tạo thực đơn', exact: true })).toBeVisible();
  }
  await page.getByLabel('Ngày bắt đầu', { exact: true }).fill('2030-01-07');
  await page.getByLabel('Số ngày', { exact: true }).fill('7');
  const generatedResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v2/meal-planning/plans') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Tạo thực đơn', exact: true }).click();
  const generated = await generatedResponse;
  expect(generated.status()).toBe(200);
  await page.waitForURL(/\/planner\/[a-f0-9-]+$/);
  await expect(page.getByTestId('planned-meal')).toHaveCount(7);
  await expect(page.locator('.planning-board-summary')).toContainText('Đã xếp đủ nhóm món');
  await expect(page.locator('.planning-board-summary')).toContainText('7/7 bữa đủ nhóm món');
  let family = FamilyMealPlanDtoSchema.parse(
    await page.evaluate(async () => {
      const response = await fetch('/api/v2/meal-planning/plans/current', {
        credentials: 'include',
      });
      const result = await response.json();
      return (result as { plan: unknown }).plan;
    }),
  );
  expect(family.diagnostics.completeMealCount).toBe(7);
  expect(
    family.compositions.compositions.every((meal) =>
      ['main', 'vegetable', 'soup', 'staple'].every((role) =>
        meal.components.some((component) => component.role === role),
      ),
    ),
  ).toBe(true);
  await expect(page.getByTestId('planned-meal')).toHaveCount(7);
  await expect(page.locator('.planning-board-summary')).toContainText('Đã xếp đủ nhóm món');
  await expect(page.locator('.planning-board-summary')).toContainText('7/7 bữa đủ nhóm món');
  await expect(page.getByTestId('planned-meal').first().locator('.planning-dish-row')).toHaveCount(
    4,
  );
  await expect(page.locator('.planning-meal-time-note').first()).toHaveText(
    'Chưa đủ dữ liệu để ước tính thời gian chuẩn bị và nấu cả bữa.',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page
      .locator('.kitchen-skip-link')
      .evaluate((element) => element !== document.activeElement),
  ).toBe(true);
  await page.screenshot({ path: `${folder}/board-viewport-${page.viewportSize()!.width}.png` });
  await page.screenshot({
    path: `${folder}/board-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
  const boardAudit = await new AxeBuilder({ page }).include('.planning-workspace').analyze();
  expect(
    boardAudit.violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  expect(family.policy.internationalGeneratedMainCount).toBe(0);
  const first = family.compositions.compositions[0];
  const main = first.components.find((component) => component.role === 'main')!;
  const favoriteResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/recipe-favorites/') && response.request().method() === 'PUT',
  );
  await page
    .getByRole('button', { name: `Lưu ${main.title}`, exact: true })
    .first()
    .click();
  expect((await favoriteResponse).status()).toBe(200);
  await page.goto('/recipes?view=saved');
  await expect(page.getByRole('heading', { name: main.title, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: main.title, exact: true })).toBeVisible();
  await page.screenshot({
    path: `${folder}/favorites-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
  const favoritesAudit = await new AxeBuilder({ page }).include('.family-favorites').analyze();
  expect(
    favoritesAudit.violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  await page.goto('/settings/planning');
  await page.getByRole('checkbox', { name: 'Miền Nam', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Tự nấu Chủ nhật', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Tự nấu Thứ 7', exact: true }).uncheck();
  await page
    .getByRole('combobox', { name: 'Thời gian muốn dành cho bữa ăn', exact: true })
    .selectOption('30');
  await page.getByRole('button', { name: 'Lưu thói quen', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu thói quen');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Miền Nam', exact: true })).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: 'Tự nấu Chủ nhật', exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole('combobox', { name: 'Thời gian muốn dành cho bữa ăn', exact: true }),
  ).toHaveValue('30');
  await page.goto('/planner/new');
  await page.getByLabel('Ngày bắt đầu', { exact: true }).fill('2030-01-07');
  await page.getByLabel('Số ngày', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Tạo thực đơn', exact: true }).click();
  await page.waitForURL(/\/planner\/[a-f0-9-]+$/);
  await expect(page.getByTestId('planned-meal')).toHaveCount(5);
  await expect(page.locator('.planning-board-summary')).toContainText('Đã xếp đủ nhóm món');
  await expect(page.locator('.planning-board-summary')).toContainText('5/5 bữa đủ nhóm món');
  family = FamilyMealPlanDtoSchema.parse(
    await page.evaluate(async () => {
      const response = await fetch('/api/v2/meal-planning/plans/current', {
        credentials: 'include',
      });
      return ((await response.json()) as { plan: unknown }).plan;
    }),
  );
  expect(family.policy.preferredRegions).toEqual(['nam']);
  expect(
    family.plan.intent.slots.every(
      (slot) => ![0, 6].includes(new Date(`${slot.date}T12:00:00Z`).getUTCDay()),
    ),
  ).toBe(true);
  await expect(page.locator('.planning-meal-time-note').first()).toBeVisible();
  expect(
    family.compositions.compositions.some((meal) => meal.warnings.includes('MEAL_TIME_UNKNOWN')),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `${folder}/board-time30-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
  await page.goto(
    `/planner/${family.plan.id}/meal/${encodeURIComponent(family.compositions.compositions[0].slotId)}`,
  );
  await expect(page.locator('.planning-composer .planning-meal-time-note')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `${folder}/composer-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
  const composerAudit = await new AxeBuilder({ page }).include('.planning-composer').analyze();
  expect(
    composerAudit.violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  const currentMain = family.compositions.compositions[0].components.find(
    (component) => component.role === 'main',
  )!;
  await page.goto(`/planner/${family.plan.id}`);
  await page
    .getByRole('button', { name: `Đổi món: ${currentMain.title}`, exact: true })
    .first()
    .click();
  const picker = page.getByRole('dialog', { name: 'Chọn món', exact: true });
  await expect(picker.getByRole('combobox', { name: 'Vai trò', exact: true })).toBeDisabled();
  await picker.getByRole('button', { name: 'Món đã lưu', exact: true }).click();
  await expect(
    picker.getByRole('button', { name: `Chọn: ${main.title}`, exact: true }),
  ).toBeVisible();
  await picker.getByRole('button', { name: `Chọn: ${main.title}`, exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: `Mở khoá món: ${main.title}`, exact: true }).first(),
  ).toBeVisible();
  await page.goto(`/planner/${family.plan.id}/shopping`);
  await page.getByRole('combobox', { name: 'Khoảng đi chợ', exact: true }).selectOption('3');
  const shared = page.waitForResponse(
    (response) =>
      response.url().endsWith('/shopping-list/from-plan') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Tạo danh sách dùng chung', exact: true }).click();
  expect((await shared).status()).toBe(200);
  await page.getByRole('link', { name: 'Mở danh sách và chỉnh lượng', exact: true }).click();
  await expect(page.locator('.shopping-saved-row').first()).toBeVisible();
  const row = page.locator('.shopping-saved-row').first();
  const itemName = await row.locator('strong').textContent();
  await row.getByRole('button', { name: `Sửa số lượng: ${itemName}`, exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Chỉnh món cần mua', exact: true });
  await edit.getByLabel('Số lượng', { exact: true }).fill('777.5');
  await edit.getByRole('button', { name: 'Lưu lượng cần mua', exact: true }).click();
  await expect(edit).toHaveCount(0);
  await page.reload();
  const edited = page
    .locator('.shopping-saved-row')
    .filter({ has: page.locator('strong', { hasText: itemName! }) })
    .first();
  await expect(edited).toContainText('777,5');
  await expect(edited).toContainText('lượng đã chỉnh');
  await edited.getByRole('checkbox').click();
  await expect(page.locator('.shopping-bought')).toContainText('1 dòng');
  await page.reload();
  await page.locator('.shopping-bought > summary').click();
  await expect(page.locator('.shopping-bought').getByRole('checkbox')).toBeChecked();
  const unavailable = page
    .locator('.shopping-item-list')
    .first()
    .locator('.shopping-saved-row')
    .first();
  const unavailableName = await unavailable.locator('strong').textContent();
  await unavailable.getByRole('button', { name: 'Chưa mua được', exact: true }).click();
  await expect(unavailable).toContainText('Chưa mua được ·');
  await page.reload();
  await expect(
    page
      .locator('.shopping-saved-row')
      .filter({ has: page.locator('strong', { hasText: unavailableName! }) })
      .first(),
  ).toContainText('Chưa mua được ·');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${folder}/shopping-viewport-${page.viewportSize()!.width}.png` });
  await page.screenshot({
    path: `${folder}/shopping-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
  const audit = await new AxeBuilder({ page }).include('.shopping-workspace').analyze();
  expect(
    audit.violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  const lastUnavailable = page
    .locator('.shopping-saved-row')
    .filter({ has: page.locator('strong', { hasText: unavailableName! }) })
    .first();
  await lastUnavailable.getByRole('checkbox').click();
  await expect(page.locator('.shopping-bought > summary')).toContainText('2 dòng');
  await page.reload();
  await page.locator('.shopping-bought > summary').click();
  const purchased = page
    .locator('.shopping-bought .shopping-saved-row')
    .filter({ has: page.locator('strong', { hasText: unavailableName! }) })
    .first();
  await expect(purchased.getByRole('checkbox')).toBeChecked();
  await expect(purchased).not.toContainText('Chưa mua được ·');
});

test('unknown shopping demand supports chosen amounts, skip, reopen and changed-trip review', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/__preview');
  await page.getByRole('button', { name: 'Đặt lại dữ liệu thử nghiệm và đăng nhập' }).click();
  await page.waitForURL('**/planner');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('vi');
  await page.goto('/planner/new');
  await page.getByLabel('Ngày bắt đầu', { exact: true }).fill('2030-01-07');
  await page.getByLabel('Số ngày', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Tạo thực đơn', exact: true }).click();
  await page.waitForURL(/\/planner\/[a-f0-9-]+$/);
  const planId = new URL(page.url()).pathname.split('/').at(-1)!;
  const stockBefore = await page.evaluate(async () => (await fetch('/api/v1/inventory')).json());
  await page.goto(`/planner/${planId}/shopping`);
  await page.getByRole('combobox', { name: 'Khoảng đi chợ', exact: true }).selectOption('3');
  await page.getByRole('button', { name: 'Tạo danh sách dùng chung', exact: true }).click();
  await page.getByRole('link', { name: 'Mở danh sách và chỉnh lượng', exact: true }).click();
  const pending = page.locator('.shopping-unresolved');
  await expect(
    pending.getByRole('button', { name: 'Chọn lượng mua', exact: true }).first(),
  ).toBeVisible();
  const initial = z
    .object({ unresolvedItems: z.array(ShoppingUnknownDemandSchema) })
    .parse(await page.evaluate(async () => (await fetch('/api/v1/shopping-list')).json()));
  expect(
    initial.unresolvedItems.filter((row: { reviewState: string }) => row.reviewState === 'pending')
      .length,
  ).toBeGreaterThan(0);
  const firstName = await pending
    .locator('li')
    .filter({ has: page.getByRole('button', { name: 'Chọn lượng mua', exact: true }) })
    .first()
    .locator('strong')
    .first()
    .textContent();
  await pending.getByRole('button', { name: 'Chọn lượng mua', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: `Chọn lượng mua: ${firstName}`, exact: true });
  await expect(dialog.getByLabel('Lượng muốn mua', { exact: true })).toHaveValue('');
  await dialog.getByLabel('Lượng muốn mua', { exact: true }).fill('0.5');
  await expect(dialog.locator('#shopping-review-unit')).toHaveAccessibleName('Đơn vị mua');
  await dialog.locator('#shopping-review-unit').selectOption('pack');
  const auditDialog = await new AxeBuilder({ page }).include('.family-dialog').analyze();
  expect(auditDialog.violations.map((item) => item.id)).toEqual([]);
  await page.screenshot({
    path: `${folder}/review-dialog-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
  const selected = page.waitForResponse(
    (response) =>
      response.url().endsWith('/shopping-list/demand-review') &&
      response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Thêm lượng này vào danh sách', exact: true }).click();
  expect((await selected).status()).toBe(200);
  await expect(dialog).toHaveCount(0);
  await page.reload();
  const purchase = page
    .locator('.shopping-saved-row')
    .filter({ has: page.locator('strong', { hasText: firstName! }) });
  await expect(purchase).toContainText('1/2 gói');
  await expect(purchase).toContainText('Lượng bạn chọn');
  await expect(purchase).toContainText('Tổng lượng theo thực đơn chưa xác định');
  const after = z
    .object({
      items: z.array(z.object({ id: z.string() })),
      unresolvedItems: z.array(ShoppingUnknownDemandSchema),
    })
    .parse(await page.evaluate(async () => (await fetch('/api/v1/shopping-list')).json()));
  expect(
    after.items.filter(
      (item: { id: string }) =>
        item.id === after.unresolvedItems.find((row) => row.name === firstName)!.purchaseItemId,
    ),
  ).toHaveLength(1);
  await purchase.getByRole('checkbox').click();
  await expect(page.locator('.shopping-bought > summary')).toContainText('1 dòng');
  await page.locator('.shopping-bought > summary').click();
  await expect(purchase.getByRole('checkbox')).toBeChecked();
  await expect(purchase.getByRole('checkbox')).toBeEnabled();
  await page.locator('.shopping-demand-chosen > summary').click();
  await page
    .locator('.shopping-demand-chosen .shopping-demand-card')
    .filter({ has: page.locator('strong', { hasText: firstName! }) })
    .getByRole('button', { name: 'Xem lại', exact: true })
    .click();
  const reviewedDemand = pending
    .locator('.shopping-demand-card')
    .filter({ has: page.locator('strong', { hasText: firstName! }) });
  await expect(reviewedDemand).toContainText('đã mua');
  await reviewedDemand.getByRole('button', { name: 'Tạm bỏ qua', exact: true }).click();
  await expect(page.locator('.shopping-skipped > summary')).toContainText('1');
  await expect(purchase.getByRole('checkbox')).toBeChecked();
  await page.reload();
  await page.locator('.shopping-skipped > summary').click();
  await page
    .locator('.shopping-skipped')
    .getByRole('button', { name: 'Xem lại', exact: true })
    .click();
  await expect(page.locator('.shopping-skipped')).toHaveCount(0);
  await page.goto(`/planner/${planId}/shopping`);
  await page.getByRole('combobox', { name: 'Khoảng đi chợ', exact: true }).selectOption('7');
  await page.getByRole('button', { name: 'Tạo danh sách dùng chung', exact: true }).click();
  await page.getByRole('link', { name: 'Mở danh sách và chỉnh lượng', exact: true }).click();
  await expect(pending).toContainText(firstName!);
  await expect(purchase).toContainText('1/2 gói');
  await page.locator('.shopping-bought > summary').click();
  await expect(purchase.getByRole('checkbox')).toBeChecked();
  const stockAfter = await page.evaluate(async () => (await fetch('/api/v1/inventory')).json());
  expect(stockAfter).toEqual(stockBefore);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const audit = await new AxeBuilder({ page }).include('.shopping-workspace').analyze();
  expect(audit.violations.map((item) => item.id)).toEqual([]);
  await page.screenshot({
    path: `${folder}/review-shopping-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
});
