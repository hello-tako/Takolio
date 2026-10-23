import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { z } from 'zod';
import { ReviewShoppingDemandDtoSchema, ShoppingUnknownDemandSchema } from '../../../packages/domain/src/shopping-plan-api';
import { test, expect, reset, getJson } from '../t13b/fixtures';

const listApi = '/api/v1/shopping-list';
const configs = [[320, 568, 1], [320, 420, 2], [320, 568, 2], [390, 844, 1], [768, 1024, 1], [1024, 768, 1], [1440, 900, 1]];
const compact = [configs[1], configs[3], configs[6]];
const snapshotSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string(), quantity: z.number(), unit: z.string(), isChecked: z.boolean() })),
  unresolvedItems: z.array(ShoppingUnknownDemandSchema),
});
async function snapshot(page: Page) {
  return snapshotSchema.parse(await getJson(page, listApi));
}
async function capture(page: Page, info: TestInfo, state: string, dialog?: Locator, matrix = compact) {
  const observations = [];
  for (const [width, height, scale] of matrix) {
    await page.setViewportSize({ width, height });
    await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%`; }, scale);
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(() => ({
      innerWidth, scrollWidth: document.documentElement.scrollWidth,
      brokenImages: [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => new URL(image.src).pathname),
    }));
    const name = `${state}-${width}x${height}-text${scale}`;
    expect.soft(metrics.innerWidth, name).toBe(width);
    expect.soft(metrics.scrollWidth, `${name}: overflow`).toBeLessThanOrEqual(width);
    expect.soft(metrics.brokenImages, name).toEqual([]);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    await writeFile(info.outputPath(`axe-${name}.json`), JSON.stringify({ state, viewport: { width, height }, textScale: scale,
      violations: axe.violations, incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })),
    }, null, 2));
    expect.soft(axe.violations.map(({ id }) => id), `${name}: axe`).toEqual([]);
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
    const reachability = [];
    if (dialog) {
      for (const control of await dialog.locator('button, input, select').all()) {
        await control.scrollIntoViewIfNeeded();
        const enabled = await control.isEnabled();
        let actionable: boolean | null = null;
        if (enabled) {
          try { await control.click({ trial: true, timeout: 1500 }); actionable = true; } catch { actionable = false; }
        }
        const box = await control.boundingBox();
        const fits = !!box && box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1;
        reachability.push({ label: await control.getAttribute('aria-label') ?? await control.getAttribute('name') ?? await control.textContent(), box, enabled, actionable, fits });
        expect.soft((!enabled || actionable) && fits, `${name}: ${reachability.at(-1)!.label}`).toBe(true);
      }
    }
    observations.push({ state, viewport: { width, height }, scale, metrics, reachability });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
  return observations;
}
async function localCommand(page: Page, path: string, input: unknown) {
  return page.evaluate(async ({ path, input }) => {
    const response = await fetch(path, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(),
      'X-Frigo-Expected-User-Id': localStorage.getItem('frigo_user_id')!,
      'X-Frigo-Expected-Household-Id': localStorage.getItem('frigo_household_id')!,
    }, body: JSON.stringify(input) });
    return response.status;
  }, { path, input });
}

test('saved shopping validates fractions, pending, edit/delete keyboard and durable offline projection', async ({ page }, info) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(10_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const stock = await getJson(page, '/api/v1/inventory');
  await page.goto('/shopping');
  await expect(page.locator('.shopping-empty')).toBeVisible();
  if (!await page.locator('.shopping-add-panel').evaluate(node => (node as HTMLDetailsElement).open)) {
    await page.locator('.shopping-add-panel > summary').click();
  }
  const form = page.locator('.shopping-add-form');
  const ingredient = 'Gạo cho bữa cơm gia đình và những ngày cùng nhau nấu món ngon tại nhà';
  await form.getByLabel('Tên nguyên liệu', { exact: true }).fill(ingredient);
  const quantity = form.getByLabel('Số lượng', { exact: true });
  const posted: string[] = [];
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const addUrl = new URL(`${listApi}/items`, page.url()).href;
  await page.route(addUrl, async route => {
    if (route.request().method() === 'POST') {
      posted.push(route.request().postData()!);
      await gate;
    }
    await route.continue();
  });
  for (const invalid of ['', '0', '-1']) {
    await quantity.fill(invalid);
    await form.getByRole('button', { name: 'Thêm vào danh sách', exact: true }).click();
    expect(await quantity.evaluate(node => (node as HTMLInputElement).checkValidity())).toBe(false);
    expect(posted).toHaveLength(0);
  }
  await quantity.fill('0.125');
  expect(await quantity.evaluate(node => ({ value: (node as HTMLInputElement).value, valid: (node as HTMLInputElement).checkValidity(), error: (node as HTMLInputElement).validationMessage }))).toEqual({ value: '0.125', valid: true, error: '' });
  await form.getByRole('combobox', { name: 'Đơn vị', exact: true }).selectOption('kg');
  try {
    await form.getByRole('button', { name: 'Thêm vào danh sách', exact: true }).click();
    await expect.poll(() => posted.length).toBe(1);
    await expect(quantity).toBeDisabled();
    await expect(form.locator('button[type=submit]')).toBeDisabled();
  } finally { release(); }
  await expect(page.locator('.shopping-saved-row')).toHaveCount(1);
  await page.unroute(addUrl);
  const row = page.locator('.shopping-saved-row').filter({ has: page.getByText(ingredient, { exact: true }) });
  await expect(row).toContainText('0,125 kg');
  await page.reload();
  expect((await snapshot(page)).items).toMatchObject([{ name: ingredient, quantity: 0.125, unit: 'kg' }]);
  const observations = await capture(page, info, 'saved', undefined, configs);
  const edit = row.getByRole('button', { name: `Sửa số lượng: ${ingredient}`, exact: true });
  await edit.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Chỉnh món cần mua', exact: true });
  expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  observations.push(...await capture(page, info, 'edit', dialog, configs));
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(edit).toBeFocused();
  await edit.click();
  await dialog.getByLabel('Số lượng', { exact: true }).fill('0.5');
  await dialog.getByRole('combobox', { name: 'Đơn vị', exact: true }).selectOption('pack');
  await dialog.getByRole('button', { name: 'Lưu lượng cần mua', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  expect((await snapshot(page)).items).toMatchObject([{ name: ingredient, quantity: 0.5, unit: 'pack' }]);
  await row.getByRole('checkbox').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.shopping-bought > summary')).toContainText('1 dòng');
  await page.locator('.shopping-bought > summary').click();
  await expect(row.getByRole('checkbox')).toBeChecked();
  observations.push(...await capture(page, info, 'checked', undefined, configs));
  const remove = row.getByRole('button', { name: `Xóa khỏi danh sách: ${ingredient}`, exact: true });
  await remove.click();
  const confirm = page.getByRole('alertdialog', { name: 'Xóa khỏi danh sách?', exact: true });
  await expect(confirm.getByRole('button', { name: 'Giữ lại', exact: true })).toBeFocused();
  observations.push(...await capture(page, info, 'delete', confirm, configs));
  await page.keyboard.press('Escape');
  await expect(confirm).toBeHidden();
  await expect(remove).toBeFocused();
  expect((await snapshot(page)).items).toHaveLength(1);
  await remove.click();
  await confirm.getByRole('button', { name: 'Xóa món', exact: true }).click();
  await expect(page.locator('.shopping-saved-row')).toHaveCount(0);
  await page.locator('.shopping-add-panel > summary').click();
  const matcher = (url: URL) => url.pathname.startsWith(listApi);
  await page.route(matcher, route => route.abort('internetdisconnected'));
  await form.getByLabel('Tên nguyên liệu', { exact: true }).fill('Nấm chờ đồng bộ');
  await quantity.fill('125.5');
  await form.getByRole('combobox', { name: 'Đơn vị', exact: true }).selectOption('g');
  await form.getByRole('button', { name: 'Thêm vào danh sách', exact: true }).click();
  await expect(page.locator('.shopping-pending-label')).toHaveText('Chờ đồng bộ');
  await expect(page.getByRole('status').filter({ hasText: /^Đang xem bản lưu trên thiết bị/ })).toBeVisible();
  observations.push(...await capture(page, info, 'offline'));
  const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('frigo_sync_outbox_v1') ?? '[]') as { method: string; path: string; body: string }[]);
  expect(queued.some(op => op.method === 'POST' && op.path === '/shopping-list/items' && JSON.parse(op.body).quantity === 125.5)).toBe(true);
  await page.unroute(matcher);
  await page.route(matcher, route => route.request().method() === 'GET' ? route.continue() : route.abort('internetdisconnected'));
  await page.reload();
  await expect(page.locator('.shopping-pending-label')).toBeVisible();
  await expect(page.locator('.shopping-saved-row')).toContainText('125,5 g');
  expect((await snapshot(page)).items).toHaveLength(0);
  expect(await getJson(page, '/api/v1/inventory')).toEqual(stock);
  await writeFile(info.outputPath('saved-summary.json'), JSON.stringify({ invalidBlocked: ['', '0', '-1'], addRequests: posted.length,
    persistedFractions: [0.125, 0.5], pendingDisabled: true, keyboardEditAndDeleteCancel: true, confirmedDelete: true,
    offlineQuantity: 125.5, offlineOverlaySurvivedServerReadAndReload: true, inventoryUnchanged: true, localSyntheticApi: true, observations,
  }, null, 2));
});

test('unknown buying intent keeps retry identity and requires explicit reload after real stale conflict', async ({ page }, info) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(10_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const stock = await getJson(page, '/api/v1/inventory');
  await page.goto('/planner/new');
  await page.getByLabel('Ngày bắt đầu', { exact: true }).fill('2030-01-07');
  await page.getByLabel('Số ngày', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Tạo thực đơn', exact: true }).click();
  await expect(page).toHaveURL(/\/planner\/(?!new$)[^/]+$/);
  const board = new URL(page.url()).pathname;
  await page.goto(`${board}/shopping`);
  await page.getByRole('combobox', { name: /^Khoảng đi chợ/ }).selectOption('3');
  await page.getByRole('button', { name: 'Tạo danh sách dùng chung', exact: true }).click();
  await page.getByRole('link', { name: 'Mở danh sách và chỉnh lượng', exact: true }).click();
  const initial = await snapshot(page);
  const demand = initial.unresolvedItems.find(item => item.reviewState === 'pending')!;
  expect(demand).toBeDefined();
  expect(Object.hasOwn(demand, 'quantity')).toBe(false);
  expect(demand.contributions.length).toBeGreaterThan(0);
  const open = page.locator('.shopping-unresolved .shopping-demand-card').filter({ has: page.getByText(demand.name, { exact: true }) }).getByRole('button', { name: 'Chọn lượng mua', exact: true });
  await open.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: `Chọn lượng mua: ${demand.name}`, exact: true });
  await expect(dialog.getByRole('heading', { name: `Chọn lượng mua: ${demand.name}`, exact: true })).toBeFocused();
  const quantity = dialog.getByLabel('Lượng muốn mua', { exact: true });
  await expect(quantity).toHaveValue('');
  const observations = await capture(page, info, 'review', dialog, configs);
  await page.keyboard.press('Escape');
  await expect(open).toBeFocused();
  await open.click();
  const attempts: { body: string; key: string | undefined; status: number; replay: boolean }[] = [];
  const reviewUrl = new URL(`${listApi}/demand-review`, page.url()).href;
  // Commit the actual first request, then lose its response. Retry reaches the real receipt replay.
  await page.route(reviewUrl, async route => {
    const response = await route.fetch();
    const receipt = ReviewShoppingDemandDtoSchema.parse(await response.json());
    attempts.push({ body: route.request().postData()!, key: route.request().headers()['idempotency-key'], status: response.status(), replay: receipt.idempotentReplay });
    if (attempts.length === 1) await route.abort('connectionfailed');
    else await route.fulfill({ response });
  });
  for (const invalid of ['', '0', '-1']) {
    await quantity.fill(invalid);
    await dialog.getByRole('button', { name: 'Thêm lượng này vào danh sách', exact: true }).click();
    expect(attempts).toHaveLength(0);
  }
  await quantity.fill('0.5');
  await dialog.getByRole('combobox', { name: 'Đơn vị mua', exact: true }).selectOption('pack');
  await dialog.getByRole('button', { name: 'Thêm lượng này vào danh sách', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Thử lại lượng vừa gửi', exact: true })).toBeVisible();
  await expect(quantity).toBeDisabled();
  expect((await snapshot(page)).items.filter(item => item.name === demand.name)).toHaveLength(1);
  observations.push(...await capture(page, info, 'uncertain'));
  await dialog.getByRole('button', { name: 'Thử lại lượng vừa gửi', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).toBeTruthy();
  expect(attempts[1]).toEqual({ ...attempts[0], replay: true });
  expect(attempts[0].replay).toBe(false);
  await page.unroute(reviewUrl);
  await page.reload();
  let current = await snapshot(page);
  expect(current.items.filter(item => item.name === demand.name)).toMatchObject([{ quantity: 0.5, unit: 'pack' }]);
  const reviewed = current.unresolvedItems.find(item => item.demandKey === demand.demandKey)!;
  expect(reviewed).toMatchObject({ reviewState: 'purchased', contributions: demand.contributions });
  expect(Object.hasOwn(reviewed, 'quantity')).toBe(false);
  await page.locator('.shopping-demand-chosen > summary').click();
  await page.locator('.shopping-demand-chosen .shopping-demand-card').filter({ has: page.getByText(demand.name, { exact: true }) }).getByRole('button', { name: 'Xem lại', exact: true }).click();
  await expect(open).toBeEnabled();
  current = await snapshot(page);
  const latest = current.unresolvedItems.find(item => item.demandKey === demand.demandKey)!;
  await open.click();
  // Another household action changes the real revision while this dialog retains its snapshot.
  expect(await localCommand(page, `${listApi}/demand-review`, { sourceId: latest.sourceId, demandKey: latest.demandKey,
    snapshot: latest.snapshot, reviewRevision: latest.reviewRevision, action: 'skip' })).toBe(200);
  await quantity.fill('1');
  const conflict = page.waitForResponse(res => res.url() === reviewUrl && res.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Thêm lượng này vào danh sách', exact: true }).click();
  expect((await conflict).status()).toBe(409);
  await expect(dialog.getByText(/^Danh sách vừa thay đổi/)).toBeVisible();
  await expect(quantity).toBeDisabled();
  observations.push(...await capture(page, info, 'stale'));
  await dialog.getByRole('button', { name: 'Tải lại danh sách', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect((await snapshot(page)).unresolvedItems.find(item => item.demandKey === demand.demandKey)).toMatchObject({ reviewState: 'skipped' });
  expect(await getJson(page, '/api/v1/inventory')).toEqual(stock);
  await writeFile(info.outputPath('review-summary.json'), JSON.stringify({ blankInitial: true, invalidBlocked: ['', '0', '-1'],
    samePayloadAndKey: true, replayFlags: attempts.map(item => item.replay), statuses: attempts.map(item => item.status), purchaseRowsAfterReplay: 1, purchaseQuantity: 0.5,
    underlyingDemandStillUnknown: true, actualStaleStatus: 409, explicitReload: true, inventoryUnchanged: true, localSyntheticApi: true, observations,
  }, null, 2));
});
