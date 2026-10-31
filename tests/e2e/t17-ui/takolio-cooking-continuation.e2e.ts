import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect, reset, getJson } from '../t13b/fixtures';

const slug = 'tomato-egg-stir-fry';
const timerSlug = 'canh-chua-ca-loc-nam-bo';
const viewports = [
  [320, 568, 1], [320, 420, 2], [360, 800, 1], [390, 844, 1],
  [430, 932, 1], [768, 1024, 1], [1024, 768, 1], [1440, 900, 1],
];
const next = (page: Page) => page.getByRole('button', { name: 'Bước tiếp theo', exact: true });
const exit = (page: Page) => page.getByRole('button', { name: 'Thoát chế độ nấu', exact: true });
const confirm = (page: Page) => page.getByRole('button', { name: 'Xác nhận & Cập nhật tủ lạnh', exact: true });
const pause = (page: Page) => page.getByRole('button', { name: 'Tạm dừng hẹn giờ', exact: true });
const countdown = (page: Page) => page.getByTestId('cooking-countdown');

async function openTimerStep(page: Page) {
  await page.goto(`/cook/${timerSlug}?servings=4`);
  await expect(page.locator('.cooking-stage')).toBeVisible();
  const total = await page.locator('.cooking-outline ol li').count();
  for (let step = 0; step < total; step++) {
    const start = page.getByRole('button', { name: /^Bật hẹn giờ/ });
    if (await start.isVisible()) return start;
    if (step < total - 1) await next(page).click();
  }
  throw new Error('The real local recipe must contain a timer step');
}

async function finishSteps(page: Page) {
  while (await next(page).isVisible()) await next(page).click();
  await page.getByRole('button', { name: 'Hoàn thành nấu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Món ăn hoàn tất', exact: true })).toBeVisible();
}

function recordWrites(page: Page) {
  const writes: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method()))
      writes.push(`${request.method()} ${path}`);
  });
  return writes;
}

async function textGeometry(control: Locator) {
  return control.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const range = document.createRange();
    const splitWords: string[] = [];
    const clippedWords: string[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const word of (node.textContent ?? '').matchAll(/\S+/g)) {
        range.setStart(node, word.index!);
        range.setEnd(node, word.index! + word[0].length);
        const rects = [...range.getClientRects()].filter(rect => rect.width > 0);
        if (new Set(rects.map(rect => Math.round(rect.top))).size > 1) splitWords.push(word[0]);
        if (rects.some(rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1 ||
          rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)) clippedWords.push(word[0]);
      }
    }
    return { width: bounds.width, height: bounds.height, splitWords, clippedWords };
  });
}

async function capture(page: Page, info: TestInfo, state: string, width: number, height: number, scale: number) {
  await page.setViewportSize({ width, height });
  await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%`; }, scale);
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.evaluate(() => ({
    innerWidth, scrollWidth: document.documentElement.scrollWidth,
    brokenImages: [...document.images].filter(image => image.complete && image.naturalWidth === 0).map(image => new URL(image.src).pathname),
  }));
  expect.soft(metrics.scrollWidth, `${state}/${width}/text${scale}: overflow`).toBeLessThanOrEqual(width);
  expect.soft(metrics.brokenImages).toEqual([]);
  const measurements = [];
  const controls = page.locator('.cooking-control, .cooking-primary, .cooking-outline summary, .cooking-use-controls button, .cooking-use-controls input, [role="alertdialog"] button');
  for (const control of await controls.all()) {
    if (!(await control.isVisible())) continue;
    const geometry = await textGeometry(control);
    const label = await control.getAttribute('aria-label') ?? await control.innerText();
    expect.soft(geometry.height, `${state}/${width}: ${label} touch height`).toBeGreaterThanOrEqual(44);
    expect.soft(geometry.splitWords, `${state}/${width}/text${scale}: ${label} whole words`).toEqual([]);
    expect.soft(geometry.clippedWords, `${state}/${width}/text${scale}: ${label} text bounds`).toEqual([]);
    measurements.push({ label, ...geometry });
  }
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const name = `${state}-${width}x${height}-text${scale}`;
  await writeFile(info.outputPath(`axe-${name}.json`), JSON.stringify({
    state, viewport: { width, height }, textScale: scale, violations: axe.violations,
    incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })),
  }, null, 2));
  expect.soft(axe.violations.map(({ id }) => id), `${name}: axe`).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
  return { state, viewport: { width, height }, scale, metrics, measurements };
}

test('wall-clock timer pauses, resumes, expires, resets and clears on step navigation; exit can be cancelled', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const inventory = await getJson(page, '/api/v1/inventory');
  const writes = recordWrites(page);
  const start = await openTimerStep(page);
  const minutes = Number((await start.innerText()).match(/\(([\d.]+) phút\)/)?.[1]);
  expect(minutes).toBeGreaterThan(0);
  const initial = minutes * 60;
  const display = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  await page.clock.install({ time: new Date('2026-10-23T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-23T00:00:01Z'));
  await start.click();
  await page.clock.runFor(2000);
  await expect(countdown(page)).toHaveText(display(initial - 2));
  await expect(pause(page)).toBeFocused();
  await pause(page).click();
  const paused = await countdown(page).innerText();
  await page.clock.fastForward(60_000);
  await expect(countdown(page)).toHaveText(paused);

  await exit(page).click();
  const dialog = page.getByRole('alertdialog', { name: 'Thoát chế độ nấu?' });
  const cancel = dialog.getByRole('button', { name: 'Hủy', exact: true });
  const leave = dialog.getByRole('button', { name: 'Thoát', exact: true });
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(leave).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(exit(page)).toBeFocused();
  await expect(countdown(page)).toHaveText(paused);
  await exit(page).click();
  await cancel.click();
  await expect(exit(page)).toBeFocused();

  await page.getByRole('button', { name: 'Tiếp tục hẹn giờ', exact: true }).click();
  await page.clock.fastForward((initial - 3) * 1000);
  await expect(countdown(page)).toHaveText('00:01');
  await page.clock.runFor(1000);
  await expect(countdown(page)).toHaveText('00:00');
  await expect(page.getByTestId('cooking-timer-status')).toHaveText('Hẹn giờ đã kết thúc.');
  const expired = page.getByRole('button', { name: 'Hẹn giờ đã kết thúc', exact: true });
  await expect(expired).toHaveAttribute('aria-disabled', 'true');
  await expired.focus();
  await expired.press('Enter');
  await page.clock.runFor(10_000);
  await expect(expired).toBeFocused();
  await expect(countdown(page)).toHaveText('00:00');
  await page.screenshot({ path: info.outputPath('timer-expired.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Đặt lại hẹn giờ', exact: true }).click();
  await expect(countdown(page)).toHaveText(display(initial));
  await expect(page.getByTestId('cooking-timer-status')).toHaveText('Đã đặt lại hẹn giờ.');
  const step = await page.locator('.cooking-header-sub').innerText();
  if (await next(page).isVisible()) {
    await next(page).click();
    await page.getByRole('button', { name: 'Bước trước', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Bước trước', exact: true }).click();
    await next(page).click();
  }
  await expect(page.locator('.cooking-header-sub')).toHaveText(step);
  await expect(countdown(page)).toHaveCount(0);
  await expect(start).toBeVisible();
  await exit(page).click();
  await leave.click();
  await expect(page).toHaveURL(new RegExp(`/recipes/${timerSlug}\\?servings=4$`));
  expect(await getJson(page, '/api/v1/inventory')).toEqual(inventory);
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('timer-summary.json'), JSON.stringify({
    initialSeconds: initial, elapsedSeconds: 2, pausedAcrossSeconds: 60, expiryReached: true,
    expiredControlFocusable: true, resetAndStepClear: true, exitKeyboardCancelAndConfirm: true,
    inventoryUnchanged: true, writes, localSyntheticApi: true,
  }, null, 2));
});

test('review return and reload retain four servings', async ({ page }, info) => {
  await reset(page);
  const inventory = await getJson(page, '/api/v1/inventory');
  const writes = recordWrites(page);
  await page.goto(`/cook/${slug}?servings=4`);
  await expect(page.locator('.cooking-header-sub')).toContainText('4 người');
  await finishSteps(page);
  const back = page.getByRole('link', { name: 'Quay lại bước nấu', exact: true });
  await back.click();
  await expect(page.locator('.cooking-header-sub')).toContainText('4 người');
  const returnedQuery = new URL(page.url()).search;
  await page.reload();
  const headerAfterReload = await page.locator('.cooking-header-sub').innerText();
  await page.locator('.cooking-ingredients-drawer summary').click();
  await page.screenshot({ path: info.outputPath('review-return-reloaded.png'), fullPage: true, animations: 'disabled' });
  await writeFile(info.outputPath('review-return-summary.json'), JSON.stringify({
    recipe: slug, selectedServings: 4, returnedQuery, headerAfterReload,
    inventoryUnchanged: JSON.stringify(await getJson(page, '/api/v1/inventory')) === JSON.stringify(inventory),
    writes, localSyntheticApi: true,
  }, null, 2));
  expect.soft(returnedQuery).toBe('?servings=4');
  await expect.soft(page.locator('.cooking-header-sub')).toContainText('4 người');
  await expect.soft(page.locator('.cooking-ingredients-mini-list')).toContainText('6 cái');
  expect(await getJson(page, '/api/v1/inventory')).toEqual(inventory);
  expect(writes).toEqual([]);
});

test('cooking, exit dialog, actual-use review and saved result fit eight viewport/text configurations', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const start = await openTimerStep(page);
  await start.click();
  await pause(page).click();
  const drawer = page.locator('.cooking-ingredients-drawer summary');
  await drawer.focus();
  await drawer.press('Enter');
  await expect(page.locator('.cooking-ingredients-mini-list')).toBeVisible();
  const captures = [];
  for (const [width, height, scale] of viewports) {
    captures.push(await capture(page, info, 'cooking', width, height, scale));
    await exit(page).click();
    captures.push(await capture(page, info, 'exit', width, height, scale));
    await page.keyboard.press('Escape');
    await expect(exit(page)).toBeFocused();
  }
  await finishSteps(page);
  for (const [width, height, scale] of viewports)
    captures.push(await capture(page, info, 'review', width, height, scale));
  for (const input of await page.locator('.cooking-use-controls input').all()) await input.fill('0');
  await confirm(page).click();
  const saved = page.getByRole('heading', { name: 'Đã cập nhật tủ lạnh', exact: true });
  await expect(saved).toBeFocused();
  for (const [width, height, scale] of viewports)
    captures.push(await capture(page, info, 'saved', width, height, scale));
  await writeFile(info.outputPath('layout-summary.json'), JSON.stringify({
    localSyntheticApi: true, rootFontScalingIsSynthetic: true, captures,
  }, null, 2));
});

test('actual-use guards precede explicit confirm; lost response retries the same committed command once', async ({ page }, info) => {
  await reset(page);
  const seed = await page.evaluate(async () => {
    const response = await fetch('/api/v1/inventory', {
      method: 'POST', credentials: 'include', headers: {
        'Content-Type': 'application/json',
        'X-Frigo-Expected-User-Id': localStorage.getItem('frigo_user_id') ?? '',
        'X-Frigo-Expected-Household-Id': localStorage.getItem('frigo_household_id') ?? '',
      },
      body: JSON.stringify({ id: 'cooking-continuation-tomato', name: 'Cà chua', quantity: 4, unit: 'piece', category: 'vegetable', storage: 'fridge' }),
    });
    return response.status;
  });
  expect(seed).toBe(201);
  const inventory = await getJson(page, '/api/v1/inventory');
  const writes = recordWrites(page);
  await page.goto(`/cook/${slug}?servings=4`);
  await expect(page.locator('.cooking-stage')).toBeVisible();
  await finishSteps(page);
  const egg = page.getByRole('spinbutton', { name: 'Lượng đã dùng: Trứng gà', exact: true });
  for (const value of ['', '-1', '100001', '3']) {
    await egg.fill(value);
    await expect(egg).toHaveAttribute('aria-invalid', 'true');
    await expect(confirm(page)).toBeDisabled();
  }
  await egg.fill('0');
  await expect(egg).toHaveAttribute('aria-invalid', 'false');
  const tomato = page.getByRole('spinbutton', { name: 'Lượng đã dùng: Cà chua', exact: true });
  await tomato.fill('5');
  await expect(tomato).toHaveAttribute('aria-invalid', 'true');
  await expect(confirm(page)).toBeDisabled();
  await tomato.fill('1.5');
  await expect(confirm(page)).toBeEnabled();
  expect(writes).toEqual([]);
  expect(await getJson(page, '/api/v1/inventory')).toEqual(inventory);
  const requests: Array<{ body: Record<string, unknown>; key: string | undefined; serverStatus: number; replay: boolean }> = [];
  await page.route('**/api/v1/recipes/*/cook/complete', async route => {
    const response = await route.fetch();
    const body = await response.json();
    requests.push({ body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key'], serverStatus: response.status(), replay: body.idempotentReplay === true });
    if (requests.length === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic response loss after local commit' }) });
    } else await route.fulfill({ response });
  });
  await confirm(page).click();
  const error = page.getByRole('alert').filter({ hasText: 'Chưa xác nhận được kết quả từ máy chủ' });
  await expect(error).toBeFocused();
  await expect(egg).toBeDisabled();
  await expect(tomato).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Quay lại bước nấu', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('completion-uncertain.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Thử lại cùng yêu cầu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đã cập nhật tủ lạnh', exact: true })).toBeFocused();
  expect(requests).toHaveLength(2);
  expect(requests[0].serverStatus).toBe(200);
  expect(requests[0].body.servings).toBe(4);
  const detail = await getJson<{ contentFingerprint: string }>(page, `/api/v1/recipes/${slug}`);
  expect(detail.contentFingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(requests[0].body.contentFingerprint).toBe(detail.contentFingerprint);
  expect(requests[1].body).toEqual(requests[0].body);
  expect(requests[1].key).toBe(requests[0].key);
  expect(requests[0].key).toBe(requests[0].body.commandId);
  expect(requests[1].serverStatus).toBe(200);
  expect(requests[1].replay).toBe(true);
  const after = await getJson<{ items: Array<{ id: string; quantity: number }> }>(page, '/api/v1/inventory');
  expect(after.items.find(item => item.id === 'cooking-continuation-tomato')?.quantity).toBe(2.5);
  await page.screenshot({ path: info.outputPath('completion-replayed-saved.png'), fullPage: true, animations: 'disabled' });
  await writeFile(info.outputPath('completion-summary.json'), JSON.stringify({
    guards: ['blank', 'negative', 'max', 'overstock', 'zero', 'fractional'], noWritesBeforeConfirm: true,
    requestCount: requests.length, servings: 4, sameBody: true, sameKey: true, replay: true,
    serverStatuses: requests.map(request => request.serverStatus), remainingTomato: 2.5,
    localSyntheticApi: true, firstResponseReplacedWith503AfterRealCommit: true,
  }, null, 2));
  await page.getByRole('link', { name: 'Xem Tủ lạnh', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tủ lạnh của tôi', exact: true })).toBeVisible();
});

test('direct completion without a run offers recovery without writes', async ({ page }, info) => {
  await reset(page);
  const writes = recordWrites(page);
  await page.goto('/cooking/complete');
  await expect(page.getByRole('heading', { name: 'Không có món ăn đang hoàn tất', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('completion-empty.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('link', { name: 'Xem công thức', exact: true }).click();
  await expect(page).toHaveURL(/\/recipes$/);
  expect(writes).toEqual([]);
});

test('offline cooking retains the content version across reload and replays a lost committed response', async ({ page }, info) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', {
    configurable: true, get: () => sessionStorage.getItem('__offline_test') !== 'true',
  }));
  await reset(page);
  await page.goto(`/recipes/${slug}?servings=4`);
  const detail = await getJson<{ contentFingerprint: string }>(page, `/api/v1/recipes/${slug}`);
  await page.getByRole('button', { name: /^Bắt đầu nấu \(/ }).click();
  await expect(page.locator('.cooking-header-sub')).toContainText('4 người');
  await finishSteps(page);
  for (const input of await page.locator('.cooking-use-controls input').all()) await input.fill('0');
  const inventory = await getJson(page, '/api/v1/inventory');
  const queue = () => page.evaluate(() => JSON.parse(localStorage.getItem('frigo_sync_outbox_v1') ?? '[]') as Array<{
    body: string; operationId: string; userId: string; householdId: string;
  }>);
  let mode: 'offline' | 'lose-response' | 'success' = 'offline';
  const requests: Array<{ body: unknown; key?: string; status: number; replay: boolean }> = [];
  await page.route('**/api/v1/recipes/*/cook/complete', async route => {
    if (mode === 'offline') return route.abort('internetdisconnected');
    const response = await route.fetch();
    const result = await response.json();
    requests.push({ body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key'],
      status: response.status(), replay: result.idempotentReplay === true });
    if (mode === 'lose-response') return route.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ error: 'Synthetic response loss after offline replay committed' }) });
    return route.fulfill({ response });
  });
  await page.evaluate(() => { sessionStorage.setItem('__offline_test', 'true'); dispatchEvent(new Event('offline')); });
  await confirm(page).click();
  await expect(page.getByRole('heading', { name: 'Đã lưu trên thiết bị', exact: true })).toBeVisible();
  const original = await queue();
  expect(original).toHaveLength(1);
  const body = JSON.parse(original[0].body);
  expect(body).toMatchObject({ contentFingerprint: detail.contentFingerprint, servings: 4 });
  expect(body.contentFingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(original[0]).toMatchObject({ userId: 'planner-preview-user', householdId: 'planner-preview-household' });
  expect(body.commandId).toBeTruthy();
  await page.screenshot({ path: info.outputPath('versioned-cooking-offline.png'), fullPage: true });
  await page.reload();
  expect(await queue()).toEqual(original);
  await page.goto('/recipes');
  await expect(page.getByRole('status').filter({ hasText: 'Đang ở chế độ Ngoại tuyến.' })).toBeVisible();
  mode = 'lose-response';
  await page.evaluate(() => { sessionStorage.setItem('__offline_test', 'false'); dispatchEvent(new Event('online')); });
  const retry = page.getByRole('button', { name: 'Đồng bộ ngay', exact: true });
  await expect.poll(() => requests.length).toBe(1);
  await expect(retry).toBeEnabled();
  expect(requests[0]).toMatchObject({ body, key: body.commandId, status: 200, replay: false });
  expect(await queue()).toEqual(original);
  mode = 'success';
  await retry.click();
  await expect.poll(queue).toEqual([]);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toMatchObject({ body, key: body.commandId, status: 200, replay: true });
  expect(await getJson(page, '/api/v1/inventory')).toEqual(inventory);
  await writeFile(info.outputPath('versioned-offline-summary.json'), JSON.stringify({
    localSyntheticApi: true, shapedNavigatorAndEvents: true, actualApiAbort: true, reloadRetainsQueue: true,
    contentVersionRetained: true, servings: body.servings, sameBodyAndCommand: true, successfulReplay: true,
    zeroDeductionsInventoryUnchanged: true,
  }, null, 2));
});
