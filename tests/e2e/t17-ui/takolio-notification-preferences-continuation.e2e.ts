import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, reset, navigate, getJson } from '../t13b/fixtures';

const settingsPath = '/settings/notifications';
const ownerKey = 'frigo_notify_prefs_planner-preview-user';
const otherKey = 'frigo_notify_prefs_synthetic-other-owner';
const names = ['Nhắc lập thực đơn tuần', 'Nhắc nguyên liệu sắp hết', 'Nhắc đi chợ', 'Nhắc bữa ăn hôm nay', 'Khuyến mãi & cập nhật'];
const defaults = { remindWeekPlan: true, remindExpiring: true, remindShopping: true, remindTodayMeal: true, promoUpdates: false };
const configs = [[320, 568, 1], [320, 420, 2], [390, 844, 1], [1440, 900, 1]] as const;

async function capture(page: Page, info: TestInfo, state: string) {
  const observations = [];
  for (const [width, height, scale] of configs) {
    await page.setViewportSize({ width, height });
    await page.evaluate(value => { document.documentElement.style.fontSize = `${value * 100}%`; }, scale);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const metrics = await page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth,
      brokenImages: [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => new URL(image.src).pathname),
    }));
    expect.soft(metrics.innerWidth, `${state}: requested width`).toBe(width);
    expect.soft(metrics.scrollWidth, `${state}-${width}-text${scale}: overflow`).toBeLessThanOrEqual(width);
    expect.soft(metrics.brokenImages, `${state}: assets`).toEqual([]);
    const switches = [];
    for (const switchControl of await page.getByRole('switch').all()) {
      const { track, thumb } = await switchControl.evaluate(control => {
        const rect = (element: Element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        };
        const thumb = control.querySelector(':scope > span');
        return { track: rect(control), thumb: thumb ? rect(thumb) : null };
      });
      const fits = !!track && !!thumb && thumb.x >= track.x - 1 && thumb.y >= track.y - 1 && thumb.x + thumb.width <= track.x + track.width + 1 && thumb.y + thumb.height <= track.y + track.height + 1;
      switches.push({ track, thumb, fits });
      expect.soft(fits, `${state}-${width}-text${scale}: switch thumb fits track`).toBe(true);
    }
    const controls = [];
    for (const control of await page.locator('.account-body').locator('button, input, select, summary, a').all()) {
      if (!await control.isVisible()) continue;
      await control.scrollIntoViewIfNeeded();
      const enabled = await control.isEnabled();
      let actionable: boolean | null = null;
      if (enabled) {
        try { await control.click({ trial: true, timeout: 1500 }); actionable = true; }
        catch { actionable = false; }
      }
      const box = await control.boundingBox();
      const fits = !!box && box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1;
      const label = await control.getAttribute('aria-label') ?? await control.getAttribute('type') ?? await control.textContent();
      controls.push({ label, enabled, actionable, fits });
      expect.soft((!enabled || actionable) && fits, `${state}-${width}-text${scale}: ${label}`).toBe(true);
    }
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect.soft(axe.violations.map(({ id }) => id), `${state}: axe`).toEqual([]);
    const observation = { state, viewport: { width, height }, textScale: scale, metrics, switches, controls };
    await writeFile(info.outputPath(`axe-${state}-${width}x${height}-text${scale}.json`), JSON.stringify({
      ...observation, violations: axe.violations, incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })),
    }, null, 2));
    await page.screenshot({ path: info.outputPath(`${state}-${width}x${height}-text${scale}.png`), fullPage: true, animations: 'disabled' });
    observations.push(observation);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
  return observations;
}

async function checked(page: Page, values: boolean[]) {
  for (const [index, name] of names.entries()) {
    await expect(page.getByRole('switch', { name, exact: true })).toHaveAttribute('aria-checked', String(values[index]));
  }
}
async function toggleWithKey(page: Page, name: string, key: 'Space' | 'Enter') {
  await page.getByRole('switch', { name, exact: true }).focus();
  await page.keyboard.press(key);
}
function monitor(page: Page) {
  const writes: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${path}`);
  });
  return writes;
}
async function boundary(page: Page) {
  const me = await getJson<{ user: { onboardingCompleted: boolean } }>(page, '/api/v1/me');
  return { inventory: await getJson(page, '/api/v1/inventory'), shopping: await getJson(page, '/api/v1/shopping-list'),
    family: await getJson(page, '/api/v1/family-preferences'), current: await getJson(page, '/api/v1/meal-planning/plans/current'),
    onboardingCompleted: me.user.onboardingCompleted };
}

test('all reminder choices persist only in the active local owner key without server writes', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  await page.evaluate(otherKey => localStorage.setItem(otherKey, 'other-owner-retained'), otherKey);
  const before = await boundary(page);
  const writes = monitor(page);
  await page.goto(settingsPath);
  await checked(page, [true, true, true, true, false]);
  await expect(page.getByText(/Các lựa chọn này chỉ ghi nhớ mong muốn trên thiết bị/)).toBeVisible();
  await expect(page.getByText(/chưa lọc hộp/)).toBeVisible();
  await expect(page.getByText(/Hiện chúng chưa/)).toBeVisible();
  const observations = await capture(page, info, 'local-defaults');
  for (const [index, name] of names.entries()) await toggleWithKey(page, name, index % 2 ? 'Enter' : 'Space');
  await checked(page, [false, false, false, false, true]);
  await expect(page.getByRole('status')).toHaveText('Đã ghi nhớ lựa chọn trên thiết bị này.');
  const expected = { remindWeekPlan: false, remindExpiring: false, remindShopping: false, remindTodayMeal: false, promoUpdates: true };
  expect(await page.evaluate(ownerKey => JSON.parse(localStorage.getItem(ownerKey)!), ownerKey)).toEqual(expected);
  await navigate(page, '/me');
  await expect(page.getByRole('heading', { name: 'Hồ sơ', exact: true })).toBeVisible();
  await navigate(page, settingsPath);
  await checked(page, [false, false, false, false, true]);
  await page.reload();
  await checked(page, [false, false, false, false, true]);
  await expect(page.getByRole('status')).toHaveCount(0);
  observations.push(...await capture(page, info, 'local-reload'));
  expect(await page.evaluate(otherKey => localStorage.getItem(otherKey), otherKey)).toBe('other-owner-retained');
  expect(await boundary(page)).toEqual(before);
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('local-summary.json'), JSON.stringify({ allFiveKeyboardChoices: true, realLocalStorageReload: true,
    routeRemountRetainsChoices: true, otherOwnerKeyUnchanged: true, serverBoundariesUnchanged: true, writes, preferences: expected, observations }, null, 2));
});

test('stored invalid values fall back safely and browser capability remains descriptive', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  await page.addInitScript(() => Object.defineProperty(window, 'Notification', { configurable: true,
    value: { permission: 'denied', requestPermission: () => { throw new Error('Unexpected notification permission request'); } } }));
  await page.evaluate(ownerKey => localStorage.setItem(ownerKey, JSON.stringify({ remindWeekPlan: 'false', remindExpiring: false,
    remindShopping: 0, promoUpdates: true, unknown: true })), ownerKey);
  const writes = monitor(page);
  await page.goto(settingsPath);
  await checked(page, [true, false, true, true, true]);
  await expect(page.getByText('đã chặn', { exact: true })).toBeVisible();
  await expect(page.getByText(/không có nghĩa là nhắc nhở đang được gửi/)).toBeVisible();
  const observations = await capture(page, info, 'validated-storage');
  await page.evaluate(ownerKey => localStorage.setItem(ownerKey, '{corrupt-json'), ownerKey);
  await page.reload();
  await checked(page, [true, true, true, true, false]);
  await toggleWithKey(page, names[0], 'Enter');
  const recovered = { ...defaults, remindWeekPlan: false };
  expect(await page.evaluate(ownerKey => JSON.parse(localStorage.getItem(ownerKey)!), ownerKey)).toEqual(recovered);
  await page.reload();
  await checked(page, [false, true, true, true, false]);
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('storage-summary.json'), JSON.stringify({ onlyStoredBooleansAccepted: true, corruptJsonDefaults: true,
    corruptionRecoveredAndReloaded: true, simulatedDeniedPermissionOnly: true, noPermissionRequest: true, writes, observations }, null, 2));
});

test('failed local storage is disclosed and draft choices disappear after remount until a real retry saves', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  await page.addInitScript(ownerKey => {
    const original = Storage.prototype.setItem;
    let failing = true;
    Object.defineProperty(window, '__allowReminderStorage', { value: () => { failing = false; } });
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === ownerKey && failing) throw new DOMException('Synthetic storage quota', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  }, ownerKey);
  const before = await boundary(page);
  const writes = monitor(page);
  await page.goto(settingsPath);
  await toggleWithKey(page, names[2], 'Space');
  await checked(page, [true, true, false, true, false]);
  await expect(page.getByRole('status')).toHaveText('Chưa lưu được trên thiết bị. Lựa chọn chỉ giữ khi trang này đang mở.');
  expect(await page.evaluate(ownerKey => localStorage.getItem(ownerKey), ownerKey)).toBeNull();
  const observations = await capture(page, info, 'storage-unavailable');
  await navigate(page, '/me');
  await expect(page.getByRole('heading', { name: 'Hồ sơ', exact: true })).toBeVisible();
  await navigate(page, settingsPath);
  await checked(page, [true, true, true, true, false]);
  await page.evaluate(() => { (window as unknown as { __allowReminderStorage: () => void }).__allowReminderStorage(); });
  await toggleWithKey(page, names[2], 'Enter');
  await expect(page.getByRole('status')).toHaveText('Đã ghi nhớ lựa chọn trên thiết bị này.');
  await page.reload();
  await checked(page, [true, true, false, true, false]);
  expect(await boundary(page)).toEqual(before);
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('failure-summary.json'), JSON.stringify({ shapedStorageFailure: true, honestTemporaryDraftStatus: true,
    failedDraftLostOnRouteRemount: true, realRetrySavedAndReloaded: true, serverBoundariesUnchanged: true, writes, observations }, null, 2));
});
