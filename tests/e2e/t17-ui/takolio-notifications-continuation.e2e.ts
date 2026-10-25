import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, reset, getJson, adopt } from '../t13b/fixtures';
import type { AppNotification } from '../../../src/web/services/notifications';

const apiPath = '/api/v1/notifications';
const matrix = [[320, 568, 1], [320, 420, 2], [320, 568, 2], [360, 800, 1], [390, 844, 1], [430, 932, 1], [768, 1024, 1], [1024, 768, 1], [1440, 900, 1]];
const compact = [matrix[1], matrix[4], matrix[8]];
const emptyCopy = 'Không có thông báo để hiển thị. Khi mất mạng, hộp này có thể chưa phản ánh dữ liệu mới nhất.';

async function capture(page: Page, info: TestInfo, state: string, configs = compact) {
  const observations = [];
  for (const [width, height, scale] of configs) {
    await page.setViewportSize({ width, height });
    await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%`; }, scale);
    await page.evaluate(() => document.fonts.ready);
    const immediate = await page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    // Let the existing ResizeObserver shell update after crossing a navigation breakpoint.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const metrics = await page.evaluate(() => ({
      innerWidth, scrollWidth: document.documentElement.scrollWidth,
      brokenImages: [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => new URL(image.src).pathname),
      text: [...document.querySelectorAll('.account-notification h2, .account-notification p')].map(node => ({
        tag: node.tagName, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
      })),
    }));
    const name = `${state}-${width}x${height}-text${scale}`;
    expect.soft(metrics.innerWidth, name).toBe(width);
    expect.soft(metrics.scrollWidth, `${name}: document overflow`).toBeLessThanOrEqual(width);
    expect.soft(metrics.brokenImages, name).toEqual([]);
    for (const text of metrics.text) expect.soft(text.scrollWidth, `${name}: clipped ${text.tag}`).toBeLessThanOrEqual(text.clientWidth + 1);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    await writeFile(info.outputPath(`axe-${name}.json`), JSON.stringify({ state, viewport: { width, height }, textScale: scale,
      violations: axe.violations, incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })),
    }, null, 2));
    expect.soft(axe.violations.map(({ id }) => id), `${name}: axe`).toEqual([]);
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
    const link = page.getByRole('link', { name: 'Tùy chỉnh nhắc nhở', exact: true });
    const reachability = [];
    if (await link.count()) {
      await link.scrollIntoViewIfNeeded();
      let actionable = false;
      try { await link.click({ trial: true, timeout: 1500 }); actionable = true; } catch { /* Retain failed reachability with the baseline capture. */ }
      const box = (await link.boundingBox())!;
      const fits = box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1;
      expect.soft(fits && actionable, `${name}: preferences link reachable`).toBe(true);
      reachability.push({ label: 'Tùy chỉnh nhắc nhở', fits, actionable, box });
    }
    observations.push({ state, viewport: { width, height }, scale, immediate, metrics, reachability });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
  return observations;
}

async function assertCards(page: Page, notifications: AppNotification[]) {
  await expect(page.locator('.account-notification')).toHaveCount(notifications.length);
  for (const [index, notification] of notifications.entries()) {
    const card = page.locator('.account-notification').nth(index);
    await expect(card.getByRole('heading', { level: 2 })).toHaveText(notification.title);
    await expect(card.locator('p')).toHaveText(notification.message);
    await expect(card.locator('time')).toHaveAttribute('datetime', notification.createdAt);
  }
}

test('real household notifications reflect stock and shopping without writes; keyboard preferences stay device-local', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  expect((await adopt(page)).code).toBe(0);
  await page.goto('/shopping');
  const add = page.locator('.shopping-add-panel');
  if (!await add.evaluate(node => (node as HTMLDetailsElement).open)) await add.locator('summary').click();
  const form = page.locator('.shopping-add-form');
  await form.getByLabel('Tên nguyên liệu', { exact: true }).fill('Gạo cho bữa tối');
  await form.getByLabel('Số lượng', { exact: true }).fill('0.5');
  await form.getByRole('combobox', { name: 'Đơn vị', exact: true }).selectOption('kg');
  await form.getByRole('button', { name: 'Thêm vào danh sách', exact: true }).click();
  await expect(page.locator('.shopping-saved-row')).toHaveCount(1);
  const before = { inventory: await getJson(page, '/api/v1/inventory'), shopping: await getJson(page, '/api/v1/shopping-list') };
  const writes: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${path}`);
  });
  const response = page.waitForResponse(res => new URL(res.url()).pathname === apiPath);
  await page.goto('/notifications');
  const notificationResponse = await response;
  expect(notificationResponse.status()).toBe(200);
  const { notifications } = await notificationResponse.json() as { notifications: AppNotification[] };
  expect(notifications.some(item => item.type === 'expiring_soon')).toBe(true);
  expect(notifications.find(item => item.type === 'shopping_reminder')?.message).toBe('Bạn còn 1 món chưa mua trong danh sách đi chợ.');
  await assertCards(page, notifications);
  const observations = await capture(page, info, 'real-native-household', matrix);
  const preferenceLink = page.getByRole('link', { name: 'Tùy chỉnh nhắc nhở', exact: true });
  await preferenceLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/settings\/notifications$/);
  await expect(page.getByText(/Các lựa chọn này chỉ ghi nhớ mong muốn trên thiết bị/)).toBeVisible();
  const shoppingSwitch = page.getByRole('switch', { name: 'Nhắc đi chợ', exact: true });
  await expect(shoppingSwitch).toHaveAttribute('aria-checked', 'true');
  await shoppingSwitch.focus();
  await page.keyboard.press('Space');
  await expect(shoppingSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('status')).toHaveText('Đã ghi nhớ lựa chọn trên thiết bị này.');
  await page.reload();
  await expect(shoppingSwitch).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('frigo_notify_prefs_planner-preview-user')!).remindShopping)).toBe(false);
  await page.goto('/notifications');
  await expect(page.getByText('Bạn còn 1 món chưa mua trong danh sách đi chợ.', { exact: true })).toBeVisible();
  const back = page.getByRole('link', { name: 'Quay lại', exact: true });
  await expect(back).toHaveAttribute('href', '/');
  await back.focus();
  await page.keyboard.press('Enter');
  // The fixture has not completed onboarding; the existing home guard remains authoritative.
  await expect(page).toHaveURL(/\/onboarding\/household$/);
  expect({ inventory: await getJson(page, '/api/v1/inventory'), shopping: await getJson(page, '/api/v1/shopping-list') }).toEqual(before);
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('real-summary.json'), JSON.stringify({ authority: 'native', localSyntheticApi: true,
    notificationTypes: notifications.map(item => item.type), shoppingReminderCount: 1, writes, inventoryAndShoppingUnchanged: true,
    keyboardPreferenceLinkAndBack: true, homeGuardForUnonboardedFixture: '/onboarding/household', deviceLocalSwitchReload: true, disabledIntentDoesNotFilterInbox: true, observations,
  }, null, 2));
});

test('inbox preserves loading, error retry, empty/offline honesty and long content reflow', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const before = { inventory: await getJson(page, '/api/v1/inventory'), shopping: await getJson(page, '/api/v1/shopping-list') };
  const url = new URL(apiPath, page.url()).href;
  const writes: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${path}`);
  });
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(url, async route => { await gate; await route.continue(); });
  const observations = [];
  try {
    await page.goto('/notifications');
    await expect(page.getByRole('status')).toContainText('Đang tải thông báo…');
    await expect(page.getByText(emptyCopy, { exact: true })).toHaveCount(0);
    observations.push(...await capture(page, info, 'loading'));
  } finally { release(); }
  await expect(page.locator('.account-notification').first()).toBeVisible();
  await page.unroute(url);
  let errors = 0;
  await page.route(url, async route => { errors++; await route.fulfill({ status: 500, json: { error: 'synthetic-unavailable' } }); });
  await page.reload();
  await expect(page.getByRole('alert')).toHaveText('Không tải được dữ liệu. Vui lòng thử lại.');
  expect(errors).toBe(3);
  await expect(page.getByText(emptyCopy, { exact: true })).toHaveCount(0);
  observations.push(...await capture(page, info, 'server-error'));
  await page.unroute(url);
  const retry = page.getByRole('button', { name: 'Thử lại', exact: true });
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.account-notification').first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const longName = 'Raumuốnghữucơtươingon'.repeat(7);
  const notifications: AppNotification[] = [{ id: 'long-content', title: `${longName} cần dùng sớm!`,
    message: `Nguyên liệu dành cho bữa cơm gia đình: ${longName}. Hãy kiểm tra trước khi chế biến.`,
    type: 'future-compatible-type', isRead: false, createdAt: '2026-10-01T00:00:00.000Z' }];
  await page.route(url, route => route.fulfill({ json: { notifications } }));
  await page.reload();
  await assertCards(page, notifications);
  observations.push(...await capture(page, info, 'long-content', matrix));
  await page.unroute(url);
  await page.route(url, route => route.fulfill({ json: { notifications: [] } }));
  await page.reload();
  await expect(page.getByText(emptyCopy, { exact: true })).toBeVisible();
  await expect(page.locator('.account-notification')).toHaveCount(0);
  observations.push(...await capture(page, info, 'explicit-empty'));
  await page.unroute(url);
  await page.route(url, route => route.abort('internetdisconnected'));
  await page.reload();
  await expect(page.getByText(emptyCopy, { exact: true })).toBeVisible();
  await expect(page.locator('.account-notification')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  observations.push(...await capture(page, info, 'network-unavailable'));
  await page.unroute(url);
  expect({ inventory: await getJson(page, '/api/v1/inventory'), shopping: await getJson(page, '/api/v1/shopping-list') }).toEqual(before);
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('states-summary.json'), JSON.stringify({ syntheticNotificationResponsesOnly: true,
    heldRealLoading: true, server500Attempts: errors, keyboardRetryRecoveredRealApi: true, unknownTypeFallback: true,
    explicitEmptyAndNetworkUnavailableHonest: true, writes, inventoryAndShoppingUnchanged: true, observations,
  }, null, 2));
});
