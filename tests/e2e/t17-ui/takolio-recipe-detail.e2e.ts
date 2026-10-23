import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { test, expect, reset, getJson, layout } from '../t13b/fixtures';

const slug = 'tomato-egg-stir-fry';
const title = 'Cà chua xào trứng Trung Hoa';
const servingsControl = (page: Page) => page.getByRole('combobox', { name: /^Nấu cho bao nhiêu người/ });
const eggRow = (page: Page) => page.locator('.ingredient-availability-row').filter({
  has: page.getByText('Trứng gà', { exact: true }),
});

async function renderedTextFits(control: Locator) {
  return control.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const content = range.getBoundingClientRect();
    const splitWords: string[] = [];
    const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = text.nextNode(); node; node = text.nextNode()) {
      for (const match of (node.textContent ?? '').matchAll(/\S+/g)) {
        range.setStart(node, match.index!);
        range.setEnd(node, match.index! + match[0].length);
        if ([...range.getClientRects()].filter(rect => rect.width > 0).length > 1)
          splitWords.push(match[0]);
      }
    }
    return {
      height: bounds.height,
      fits: content.top >= bounds.top - 1 && content.bottom <= bounds.bottom + 1,
      splitWords,
    };
  });
}

test('recipe detail scales exact quantities across servings and retains them after reload', async ({ page }, info) => {
  await reset(page);
  const inventory = await getJson(page, '/api/v1/inventory');
  await page.goto(`/recipes/${slug}?servings=1`);
  const observations = [];
  for (const [servings, required, shortfall, ready] of [
    [1, '1,5', null, 1], [2, '3', '1', 0], [4, '6', '4', 0], [20, '30', '28', 0],
  ] as const) {
    await servingsControl(page).selectOption(String(servings));
    await expect(eggRow(page)).toContainText(`Cần ${required} cái`);
    await expect(eggRow(page)).toContainText(shortfall === null ? 'Đủ lượng' : `Thiếu ${shortfall} cái`);
    await expect(page.locator('.recipe-readiness-caption')).toHaveText(`${ready}/4 nguyên liệu sẵn sàng trong tủ`);
    await expect(page.getByTestId('recipe-availability')).toContainText(`Lượng bên dưới dành cho ${servings} người`);
    expect(new URL(page.url()).searchParams.get('servings')).toBe(String(servings));
    observations.push({ servings, required, shortfall, ready });
  }
  await page.reload();
  await expect(servingsControl(page)).toHaveValue('20');
  await expect(eggRow(page)).toContainText('Thiếu 28 cái');
  await page.screenshot({ path: info.outputPath('detail-servings20.png'), fullPage: true, animations: 'disabled' });
  expect(await getJson(page, '/api/v1/inventory')).toEqual(inventory);
  await writeFile(info.outputPath('quantity-summary.json'), JSON.stringify({
    recipe: slug, observations, inventoryUnchanged: true, localSyntheticApi: true,
  }, null, 2));
});

test('detail cooking handoff, reload and confirmed exit preserve selected servings without stock writes', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const inventory = await getJson(page, '/api/v1/inventory');
  const writes: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method()))
      writes.push(`${request.method()} ${path}`);
  });
  await page.goto(`/recipes/${slug}?servings=4`);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.locator('.kitchen-recipe-action').getByRole('button', { name: 'Bắt đầu nấu (10 phút)', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/cook/${slug}\\?servings=4$`));
  await expect(page.locator('.cooking-header-sub')).toContainText('4 người');
  await page.reload();
  await expect(page.locator('.cooking-header-sub')).toContainText('4 người');
  await page.locator('.cooking-ingredients-drawer summary').click();
  await expect(page.locator('.cooking-ingredients-mini-list')).toContainText('6 cái');
  await page.screenshot({ path: info.outputPath('cooking-servings4.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Thoát chế độ nấu', exact: true }).click();
  await page.screenshot({ path: info.outputPath('cooking-exit.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('alertdialog').getByRole('button', { name: 'Thoát', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('detail-after-exit.png'), fullPage: true, animations: 'disabled' });
  expect.soft(new URL(page.url()).searchParams.get('servings')).toBe('4');
  await expect.soft(servingsControl(page)).toHaveValue('4');
  await expect.soft(eggRow(page)).toContainText('Cần 6 cái');
  expect(await getJson(page, '/api/v1/inventory')).toEqual(inventory);
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('cooking-handoff-summary.json'), JSON.stringify({
    recipe: slug, selectedServings: 4, returnedQuery: new URL(page.url()).search,
    inventoryUnchanged: true, mutationRequests: writes, localSyntheticApi: true,
  }, null, 2));
});

test('recipe detail tabs and planner handoff remain usable across viewports', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const inventory = await getJson(page, '/api/v1/inventory');
  await page.goto(`/recipes/${slug}?servings=4`);
  await expect(servingsControl(page)).toHaveValue('4');
  const add = page.getByRole('button', { name: 'Xếp món vào bữa', exact: true });
  const measurements = [];
  for (const [width, height, scale] of [
    [320, 568, 1], [320, 420, 2], [360, 800, 1], [390, 844, 1],
    [430, 932, 1], [768, 1024, 1], [1024, 768, 1], [1440, 900, 1],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%`; }, scale);
    await page.evaluate(() => document.fonts.ready);
    for (const [state, tab] of [['ingredients', 'Nguyên liệu'], ['steps', 'Cách nấu'], ['nutrition', 'Dinh dưỡng']] as const) {
      const tabControl = page.getByRole('tab', { name: tab, exact: true });
      await tabControl.focus();
      await tabControl.press('Enter');
      await expect(tabControl).toHaveAttribute('aria-selected', 'true');
      await layout(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`${state}-${width}x${height}-text${scale}.png`), fullPage: true, animations: 'disabled' });
      for (const control of [add, page.locator('.kitchen-recipe-action button')]) {
        const bounds = await renderedTextFits(control);
        expect.soft(bounds.height).toBeGreaterThanOrEqual(44);
        expect.soft(bounds.fits, `${state}/${width}/text${scale}: action text fits`).toBe(true);
        expect.soft(bounds.splitWords, `${state}/${width}/text${scale}: action words stay whole`).toEqual([]);
        measurements.push({ state, viewport: { width, height }, scale, control: await control.innerText(), ...bounds });
      }
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      await writeFile(info.outputPath(`axe-${state}-${width}x${height}-text${scale}.json`), JSON.stringify({
        viewport: { width, height }, textScale: scale, state, violations: axe.violations,
        incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })),
      }, null, 2));
      expect.soft(axe.violations).toEqual([]);
    }
    await add.press('Enter');
    const dialog = page.getByRole('dialog');
    const handoff = dialog.getByRole('link', { name: 'Tạo lịch trống để chọn món', exact: true });
    await expect(handoff).toHaveAttribute('href', '/planner/new?recipe=gl-03&servings=4');
    await layout(page, handoff);
    await page.screenshot({ path: info.outputPath(`handoff-${width}x${height}-text${scale}.png`), fullPage: true, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(add).toBeFocused();
  }
  await writeFile(info.outputPath('layout-summary.json'), JSON.stringify({
    localSyntheticApi: true, measurements,
  }, null, 2));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
  const ingredients = page.getByRole('tab', { name: 'Nguyên liệu', exact: true });
  await ingredients.focus();
  await ingredients.press('Home');
  await expect(page.getByRole('tab', { name: 'Cách nấu', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Dinh dưỡng', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Cách nấu', exact: true })).toBeFocused();
  await add.press('Enter');
  await page.getByRole('link', { name: 'Tạo lịch trống để chọn món', exact: true }).click();
  await expect(page.getByRole('radio', { name: /^Tự chọn món cho từng bữa/ })).toBeChecked();
  await expect(page.getByRole('spinbutton', { name: 'Số người ăn', exact: true })).toHaveValue('4');
  expect(await getJson(page, '/api/v1/inventory')).toEqual(inventory);
});
