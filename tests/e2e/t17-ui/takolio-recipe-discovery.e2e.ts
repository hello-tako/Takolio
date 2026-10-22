import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, reset, layout, getJson } from '../t13b/fixtures';
import { DiscoveryPageSchema } from '../../../packages/recipes/src/discovery-contract';

async function assertResultsMatchApi(page: Page) {
  const current = new URL(page.url()).searchParams;
  const request = new URLSearchParams();
  for (const key of ['q', 'cuisine', 'category', 'region', 'maxTime', 'noBuy', 'servings', 'page', 'cursor']) {
    if (current.has(key)) request.set(key, current.get(key)!);
  }
  const result = DiscoveryPageSchema.parse(await getJson(page, `/api/v1/recipe-discovery?${request}`));
  await expect(page.locator('.kitchen-recipe-card h3')).toHaveText(result.items.map(item => item.recipe.title));
  if (result.total) {
    await expect(page.getByRole('status').filter({ hasText: new RegExp(`^${result.total} món$`) })).toBeVisible();
  } else {
    await expect(page.getByRole('heading', { name: 'Không tìm thấy món phù hợp', exact: true })).toBeVisible();
  }
  return result;
}

test('recipe filters search pagination and individual removal retain real discovery semantics', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  await page.goto('/recipes?servings=4&origin=continuation');
  const first = await assertResultsMatchApi(page);
  expect(first.pages).toBeGreaterThan(1);
  await page.getByRole('link', { name: 'Tiếp', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  const second = await assertResultsMatchApi(page);
  expect(second.page).toBe(2);
  expect(second.items.map(item => item.recipe.id)).not.toEqual(first.items.map(item => item.recipe.id));
  const heading = page.locator('#recipes-results-heading');
  await expect(heading).toBeFocused();

  const summary = page.locator('.discovery-filter-panel summary');
  await summary.click();
  await page.getByRole('combobox', { name: 'Ẩm thực', exact: true }).selectOption('vietnamese');
  expect(new URL(page.url()).searchParams.has('cursor')).toBe(false);
  expect(new URL(page.url()).searchParams.has('page')).toBe(false);
  await page.getByRole('combobox', { name: 'Cách nấu', exact: true }).selectOption('mon_canh');
  await page.getByRole('combobox', { name: 'Vùng miền', exact: true }).selectOption('nam');
  await page.getByRole('button', { name: 'Tối đa 20 phút', exact: true }).click();
  const filtered = await assertResultsMatchApi(page);
  expect(filtered.total).toBeGreaterThan(0);
  expect(filtered.items.every(item => item.recipe.cuisine === 'vietnamese' && item.recipe.cookTimeMinutes <= 20)).toBe(true);
  await summary.click();
  const selected = page.getByRole('list', { name: 'Điều kiện đang dùng', exact: true });
  await expect(selected.getByRole('button')).toHaveCount(4);
  await page.screenshot({ path: info.outputPath('filters-collapsed.png'), fullPage: true, animations: 'disabled' });
  const removeRegion = selected.getByRole('button', { name: 'Bỏ Miền Nam', exact: true });
  await removeRegion.focus();
  await page.keyboard.press('Enter');
  await expect(heading).toBeFocused();
  const afterRegion = await assertResultsMatchApi(page);
  expect(afterRegion.total).toBeGreaterThan(0);
  const after = new URL(page.url()).searchParams;
  expect(after.has('region')).toBe(false);
  expect(after.get('cuisine')).toBe('vietnamese');
  expect(after.get('category')).toBe('mon_canh');
  expect(after.get('maxTime')).toBe('20');
  expect(after.get('servings')).toBe('4');
  expect(after.get('origin')).toBe('continuation');
  await page.reload();
  await assertResultsMatchApi(page);
  await expect(selected.getByRole('button')).toHaveCount(3);

  await summary.click();
  const noBuy = page.getByRole('button', { name: 'Không mua thêm', exact: true });
  await noBuy.press('Space');
  await expect(noBuy).toHaveAttribute('aria-pressed', 'true');
  const ready = await assertResultsMatchApi(page);
  // The seeded household lacks the soup ingredients: no-buy must exclude it.
  expect(ready.total).toBe(0);
  await selected.getByRole('button', { name: 'Bỏ Không mua thêm', exact: true }).press('Enter');
  await expect(heading).toBeFocused();
  expect((await assertResultsMatchApi(page)).total).toBe(afterRegion.total);
  await noBuy.press('Space');
  await expect(noBuy).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Tìm món hoặc nguyên liệu', { exact: true }).fill('khong-co-mon-xyz-123');
  const empty = await assertResultsMatchApi(page);
  expect(empty.total).toBe(0);
  await page.screenshot({ path: info.outputPath('filters-empty.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await expect(page.getByLabel('Tìm món hoặc nguyên liệu', { exact: true })).toBeFocused();
  await expect(selected).toHaveCount(0);
  expect(new URL(page.url()).searchParams.toString()).toBe('servings=4&origin=continuation');
  const resetResult = await assertResultsMatchApi(page);
  expect(resetResult.items.map(item => item.recipe.id)).toEqual(first.items.map(item => item.recipe.id));
  const search = page.getByLabel('Tìm món hoặc nguyên liệu', { exact: true });
  await search.fill('canh chua');
  const searched = await assertResultsMatchApi(page);
  expect(searched.total).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Bỏ Tìm: “canh chua”', exact: true }).press('Enter');
  await expect(heading).toBeFocused();
  await assertResultsMatchApi(page);
  await writeFile(info.outputPath('behavior-summary.json'), JSON.stringify({
    first: first.total, filtered: filtered.total, noBuy: ready.total, empty: empty.total,
    search: searched.total, secondPage: second.page, finalQuery: new URL(page.url()).search,
    localSyntheticApi: true,
  }, null, 2));
});

test('recipe discovery selected conditions remain readable across viewports', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  await page.goto('/recipes?cuisine=vietnamese&category=mon_canh&region=nam&maxTime=20&servings=4');
  await expect(page.getByTestId('recipe-discovery-grid')).toBeVisible();
  const selected = page.getByRole('list', { name: 'Điều kiện đang dùng', exact: true });
  await expect(selected.getByRole('button')).toHaveCount(4);
  for (const [width, height, scale] of [[320,568,1],[320,420,2],[360,800,1],[390,844,1],[430,932,1],[768,1024,1],[1024,768,1],[1440,900,1]]) {
    await page.setViewportSize({ width, height });
    await page.addStyleTag({ content: `html { font-size: ${scale * 100}% !important; }` });
    await page.evaluate(() => document.fonts.ready);
    await layout(page, selected.getByRole('button'));
    for (const button of await selected.getByRole('button').all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await button.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBe(14 * scale);
    }
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    await writeFile(info.outputPath(`axe-${width}x${height}-text${scale}.json`), JSON.stringify({
      viewport: { width, height }, textScale: scale,
      violations: audit.violations, incomplete: audit.incomplete.map(({ id, impact }) => ({ id, impact })),
    }, null, 2));
    expect(audit.violations).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath(`filters-${width}x${height}-text${scale}.png`), fullPage: true, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 320, height: 420 });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.getByLabel('Tìm món hoặc nguyên liệu', { exact: true }).fill('Nguyên liệu rất dài '.repeat(8));
  const longSearch = selected.getByRole('button', { name: /^Bỏ Tìm:/ });
  await expect(longSearch).toBeVisible();
  await layout(page, selected.getByRole('button'));
  await longSearch.focus();
  await expect(longSearch).toBeFocused();
  expect(await longSearch.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
  await page.screenshot({ path: info.outputPath('filters-long-search-text2.png'), fullPage: true, animations: 'disabled' });
  await longSearch.press('Enter');
  await expect(page.locator('#recipes-results-heading')).toBeFocused();
  await expect(selected.getByRole('button')).toHaveCount(4);
});
