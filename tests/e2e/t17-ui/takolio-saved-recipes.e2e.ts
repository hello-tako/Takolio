import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, reset, getJson, layout } from '../t13b/fixtures';
import { DiscoveryPageSchema } from '../../../packages/recipes/src/discovery-contract';
import {
  RecipeFavoriteStateSchema,
  RecipeFavoritesDtoSchema,
} from '../../../packages/domain/src/recipe-favorites-api';

async function saveFirstRecipe(page: Page) {
  await page.goto('/recipes?servings=4');
  const discovery = DiscoveryPageSchema.parse(
    await getJson(page, '/api/v1/recipe-discovery?servings=4'),
  );
  const recipe = discovery.items[0].recipe;
  const card = page
    .locator('.kitchen-recipe-card')
    .filter({ has: page.getByRole('heading', { name: recipe.title, exact: true }) });
  await card.getByRole('button', { name: `Lưu ${recipe.title}`, exact: true }).click();
  await expect(
    card.getByRole('button', { name: `Bỏ lưu ${recipe.title}`, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  return recipe;
}

async function favoriteState(page: Page, id: string) {
  return RecipeFavoriteStateSchema.parse(
    await getJson(page, `/api/v1/recipe-favorites/${encodeURIComponent(id)}`),
  );
}

test('saved recipes persist, search, remove and resave through the local API', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const stock = await getJson(page, '/api/v1/inventory');
  const recipe = await saveFirstRecipe(page);
  const saved = await favoriteState(page, recipe.id);
  expect(saved.isSaved).toBe(true);
  await page.getByRole('link', { name: 'Món đã lưu', exact: true }).click();
  const card = page.locator('.family-favorite-card');
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('heading', { name: recipe.title, exact: true })).toBeVisible();
  await page.reload();
  await expect(card).toHaveCount(1);
  const search = page.getByRole('searchbox', { name: 'Tìm món đã lưu', exact: true });
  await search.fill('món không tồn tại xyz');
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Không có món khớp', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xem tất cả món đã lưu', exact: true }).click();
  await expect(search).toHaveValue('');
  await search.fill(recipe.title.toLocaleUpperCase('vi'));
  await expect(card).toHaveCount(1);
  await search.fill('');
  await layout(page);
  await page.screenshot({
    path: info.outputPath('saved-persisted.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await card.getByRole('button', { name: `Bỏ lưu ${recipe.title}`, exact: true }).click();
  await expect(card).toHaveCount(0);
  const removed = await favoriteState(page, recipe.id);
  expect(removed.isSaved).toBe(false);
  expect(removed.revision).toBeGreaterThan(saved.revision);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Bắt đầu từ món quen của nhà mình', exact: true }),
  ).toBeVisible();
  expect(
    RecipeFavoritesDtoSchema.parse(await getJson(page, '/api/v1/recipe-favorites')).entries,
  ).toEqual([]);
  await page.getByRole('link', { name: 'Tìm món để lưu', exact: true }).click();
  await expect(page.getByTestId('recipe-discovery-grid')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('servings')).toBe('4');
  await page.getByRole('button', { name: `Lưu ${recipe.title}`, exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Bỏ lưu ${recipe.title}`, exact: true }),
  ).toBeVisible();
  const resaved = await favoriteState(page, recipe.id);
  expect(resaved.isSaved).toBe(true);
  expect(resaved.revision).toBeGreaterThan(removed.revision);
  await page.getByRole('link', { name: 'Món đã lưu', exact: true }).click();
  await page.reload();
  await expect(card).toHaveCount(1);
  expect(await getJson(page, '/api/v1/inventory')).toEqual(stock);
  await writeFile(
    info.outputPath('persistence-summary.json'),
    JSON.stringify(
      {
        recipeId: recipe.id,
        saved,
        removed,
        resaved,
        inventoryUnchanged: true,
        localSyntheticApi: true,
      },
      null,
      2,
    ),
  );
});

test('recipe library tabs retain the chosen servings', async ({ page }, info) => {
  await reset(page);
  await page.goto('/recipes?servings=4');
  await expect(page.getByRole('combobox', { name: /^Nấu cho bao nhiêu người/ })).toHaveValue('4');
  await page.getByRole('link', { name: 'Món đã lưu', exact: true }).click();
  await page.screenshot({
    path: info.outputPath('saved-tab.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect.soft(new URL(page.url()).searchParams.get('servings')).toBe('4');
  await expect
    .soft(page.getByText('Đang tính định lượng theo khẩu phần 4 người', { exact: true }))
    .toBeVisible();
  await page.getByRole('link', { name: 'Tìm món', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /^Nấu cho bao nhiêu người/ })).toHaveValue('4');
});

test('saved recipe detail and empty-calendar handoff retain the chosen servings', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const stock = await getJson(page, '/api/v1/inventory');
  const recipe = await saveFirstRecipe(page);
  await page.goto('/recipes?view=saved&servings=4');
  await page.reload();
  const card = page.locator('.family-favorite-card');
  const detail = card.getByRole('link', { name: 'Xem công thức', exact: true });
  await expect
    .soft(detail)
    .toHaveAttribute('href', `/recipes/id/${encodeURIComponent(recipe.id)}?servings=4`);
  await card.getByRole('button', { name: 'Thêm vào bữa', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Đặt ${recipe.title} vào bữa`, exact: true });
  const handoff = dialog.getByRole('link', { name: 'Tạo lịch trống để chọn món', exact: true });
  await expect(handoff).toBeVisible();
  const handoffHref = await handoff.getAttribute('href');
  await expect
    .soft(handoff)
    .toHaveAttribute('href', `/planner/new?recipe=${encodeURIComponent(recipe.id)}&servings=4`);
  await layout(page, dialog.getByRole('link'));
  await page.screenshot({
    path: info.outputPath('saved-handoff.png'),
    fullPage: true,
    animations: 'disabled',
  });
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  await writeFile(
    info.outputPath('axe-handoff.json'),
    JSON.stringify({ violations: axe.violations }, null, 2),
  );
  expect(axe.violations).toEqual([]);
  await handoff.click();
  await expect(page.getByRole('radio', { name: /^Tự chọn món cho từng bữa/ })).toBeChecked();
  await expect
    .soft(page.getByRole('spinbutton', { name: 'Số người ăn', exact: true }))
    .toHaveValue('4');
  await page.goto('/recipes?view=saved&servings=4');
  await detail.click();
  await expect(
    page.getByRole('heading', { name: recipe.title, exact: true }).first(),
  ).toBeVisible();
  expect.soft(new URL(page.url()).searchParams.get('servings')).toBe('4');
  await expect
    .soft(page.getByRole('combobox', { name: /^Nấu cho bao nhiêu người/ }))
    .toHaveValue('4');
  expect(await getJson(page, '/api/v1/inventory')).toEqual(stock);
  await writeFile(
    info.outputPath('handoff-summary.json'),
    JSON.stringify(
      {
        recipeId: recipe.id,
        handoffHref,
        detailQuery: new URL(page.url()).search,
        inventoryUnchanged: true,
        localSyntheticApi: true,
      },
      null,
      2,
    ),
  );
});

test('saved collection and meal handoff remain usable across viewports', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const recipe = await saveFirstRecipe(page);
  await page.goto('/recipes?view=saved&servings=4');
  const card = page.locator('.family-favorite-card');
  const add = card.getByRole('button', { name: 'Thêm vào bữa', exact: true });
  const dialog = page.getByRole('dialog', { name: `Đặt ${recipe.title} vào bữa`, exact: true });
  const close = dialog.getByRole('button', { name: 'Đóng', exact: true });
  const handoff = dialog.getByRole('link', { name: 'Tạo lịch trống để chọn món', exact: true });
  await expect(card).toHaveCount(1);
  for (const [width, height, scale] of [
    [320, 568, 1],
    [320, 420, 2],
    [360, 800, 1],
    [390, 844, 1],
    [430, 932, 1],
    [768, 1024, 1],
    [1024, 768, 1],
    [1440, 900, 1],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate((scale) => {
      document.documentElement.style.fontSize = `${scale * 100}%`;
    }, scale);
    await page.evaluate(() => document.fonts.ready);
    await layout(page, card.getByRole('button').or(card.getByRole('link')));
    for (const button of await card.getByRole('button').all()) {
      const bounds = await button.evaluate((element) => {
        const control = element.getBoundingClientRect();
        const text = document.createRange();
        text.selectNodeContents(element);
        const content = text.getBoundingClientRect();
        return {
          height: control.height,
          contentFits: content.top >= control.top - 1 && content.bottom <= control.bottom + 1,
        };
      });
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.contentFits).toBe(true);
    }
    for (const state of ['collection', 'handoff']) {
      if (state === 'handoff') {
        await add.press('Enter');
        await expect(handoff).toBeVisible();
        await expect(close).toBeFocused();
        const closeIcon = await close.locator('svg').boundingBox();
        expect(closeIcon!.width).toBeGreaterThanOrEqual(20);
        expect(closeIcon!.height).toBeGreaterThanOrEqual(20);
        await page.keyboard.press('Shift+Tab');
        await expect(handoff).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(close).toBeFocused();
        await layout(page, handoff.or(close));
      }
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      await writeFile(
        info.outputPath(`axe-${state}-${width}x${height}-text${scale}.json`),
        JSON.stringify(
          {
            viewport: { width, height },
            textScale: scale,
            state,
            violations: axe.violations,
            incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })),
          },
          null,
          2,
        ),
      );
      expect(axe.violations).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: info.outputPath(`${state}-${width}x${height}-text${scale}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(add).toBeFocused();
  }
});
