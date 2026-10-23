import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect, reset, navigate, getJson } from '../t13b/fixtures';

const viewports = [[320, 568, 1], [320, 420, 2], [390, 844, 1], [1440, 900, 1]] as const;
const settingsPath = '/settings/app';
const outboxKey = 'frigo_sync_outbox_v1';

type SettingsObservation = {
  viewport: { width: number; height: number };
  textScale: number;
  metrics: {
    innerWidth: number;
    scrollWidth: number;
    brokenImages: string[];
    buttons: number;
    links: number;
    summaries: number;
  };
  controls: Array<{ label: string | null; enabled: boolean; actionable: boolean | null; fits: boolean }>;
};

async function inspectSettings(page: Page, info: TestInfo, state: string, dialog?: Locator) {
  const observations: SettingsObservation[] = [];
  for (const [width, height, scale] of viewports) {
    await page.setViewportSize({ width, height });
    await page.evaluate((value) => {
      document.documentElement.style.fontSize = `${value * 100}%`;
    }, scale);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const metrics = await page.evaluate(() => ({
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      brokenImages: [...document.images]
        .filter((image) => image.complete && !image.naturalWidth)
        .map((image) => new URL(image.src).pathname),
      buttons: document.querySelectorAll('.account-body button').length,
      links: document.querySelectorAll('.account-body a').length,
      summaries: document.querySelectorAll('.account-body summary').length,
    }));
    expect.soft(metrics.innerWidth, `${state}-${width}x${height}-text${scale}: viewport`).toBe(width);
    expect.soft(metrics.scrollWidth, `${state}-${width}x${height}-text${scale}: document overflow`).toBeLessThanOrEqual(width);
    expect.soft(metrics.brokenImages, `${state}-${width}x${height}-text${scale}: broken images`).toEqual([]);

    const controls: SettingsObservation['controls'] = [];
    const candidates = dialog
      ? dialog.locator('button')
      : page.locator('.account-body button, .account-body a, .account-body summary');
    for (const control of await candidates.all()) {
      await control.scrollIntoViewIfNeeded();
      const enabled = await control.isEnabled().catch(() => true);
      let actionable: boolean | null = null;
      if (enabled) {
        try {
          await control.click({ trial: true, timeout: 1500 });
          actionable = true;
        } catch {
          actionable = false;
        }
      }
      const box = await control.boundingBox();
      const fits = !!box && box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1;
      const label = await control.getAttribute('aria-label') ?? await control.getAttribute('name') ?? await control.textContent();
      controls.push({ label, enabled, actionable, fits });
      expect.soft((!enabled || actionable) && fits, `${state}-${width}x${height}-text${scale}: ${label}`).toBe(true);
    }

    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect.soft(axe.violations.map(({ id }) => id), `${state}-${width}x${height}-text${scale}: axe`).toEqual([]);
    await writeFile(
      info.outputPath(`axe-${state}-${width}x${height}-text${scale}.json`),
      JSON.stringify({ state, viewport: { width, height }, textScale: scale, violations: axe.violations,
        incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })), metrics, controls }, null, 2),
    );
    await page.screenshot({
      path: info.outputPath(`${state}-${width}x${height}-text${scale}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    observations.push({ viewport: { width, height }, textScale: scale, metrics, controls });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
  return observations;
}

async function seedOfflineShoppingItem(page: Page) {
  await page.goto('/shopping');
  const panel = page.locator('.shopping-add-panel');
  if (!await panel.evaluate((node) => (node as HTMLDetailsElement).open)) await panel.locator('summary').click();
  const form = page.locator('.shopping-add-form');
  const addUrl = new URL('/api/v1/shopping-list/items', page.url()).href;
  await page.route(addUrl, (route) => route.abort('internetdisconnected'));
  await form.getByLabel('Tên nguyên liệu', { exact: true }).fill('Cài đặt giữ hàng chờ đồng bộ');
  await form.getByLabel('Số lượng', { exact: true }).fill('2');
  await form.getByRole('combobox', { name: 'Đơn vị', exact: true }).selectOption('g');
  await form.getByRole('button', { name: 'Thêm vào danh sách', exact: true }).click();
  await expect(page.locator('.shopping-pending-label')).toHaveText('Chờ đồng bộ');
  await expect.poll(async () => page.evaluate((key) => {
    const rows = JSON.parse(localStorage.getItem(key) ?? '[]') as Array<{ method: string; path: string; body?: string }>;
    return rows.some((row) => row.method === 'POST' && row.path === '/shopping-list/items' && row.body?.includes('Cài đặt giữ hàng chờ đồng bộ'));
  }, outboxKey)).toBe(true);
  // Retain the genuine queued write across settings navigation and load-triggered sync.
}

async function seedCacheStorage(page: Page) {
  await page.evaluate(async () => {
    const cache = await caches.open('settings-continuation-proof');
    await cache.put(new Request('/settings-continuation-proof'), new Response('proof'));
  });
  await expect.poll(() => page.evaluate(async () => caches.keys())).toContain('settings-continuation-proof');
}

test('settings preserves offline data while clearing CacheStorage and keeps route copy honest', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  await seedOfflineShoppingItem(page);
  await seedCacheStorage(page);
  const serverBefore = {
    inventory: await getJson(page, '/api/v1/inventory'),
    shopping: await getJson(page, '/api/v1/shopping-list'),
  };
  const readPrivateData = () => page.evaluate(() => Object.fromEntries(
    Object.entries(localStorage).filter(([key]) => key === 'frigo_sync_outbox_v1' || key.startsWith('frigo_cache_v2:')),
  ));
  const privateBefore = await readPrivateData();
  const pendingBefore = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), outboxKey);
  expect(pendingBefore).toHaveLength(1);
  const requests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) requests.push(`${request.method()} ${path}`);
  });

  await navigate(page, settingsPath);
  await expect(page).toHaveURL(/\/settings\/app$/);
  await expect(page.getByRole('heading', { name: 'Cài đặt ứng dụng', exact: true })).toBeVisible();
  await expect(page.getByText('Xóa tài nguyên ứng dụng đã lưu trên trình duyệt.', { exact: false })).toBeVisible();
  await expect(page.getByText('Thao tác này không xóa dữ liệu ngoại tuyến hoặc thay đổi chưa đồng bộ của bạn.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem quyền riêng tư & dữ liệu', exact: true })).toHaveAttribute('href', '/settings/privacy');

  const observationsBefore = await inspectSettings(page, info, 'before-clear');
  // Hold the actual CacheStorage deletion to inspect the pending action, then release it.
  await page.evaluate(() => {
    const state = window as Window & { __takolioReleaseCache?: () => void };
    const original = caches.delete.bind(caches);
    const gate = new Promise<void>((resolve) => { state.__takolioReleaseCache = resolve; });
    caches.delete = async (key) => { await gate; return original(key); };
  });
  await page.getByRole('button', { name: 'Xóa bộ nhớ đệm ứng dụng', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đang xử lý...', exact: true })).toBeDisabled();
  const pendingObservations = await inspectSettings(page, info, 'clearing-cache');
  await page.evaluate(() => (window as Window & { __takolioReleaseCache?: () => void }).__takolioReleaseCache?.());
  await expect(page.getByRole('status')).toContainText('Đã xóa bộ nhớ đệm ứng dụng.');
  expect(await page.evaluate(async () => caches.keys())).toEqual([]);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), outboxKey)).toEqual(pendingBefore);
  await expect(page.getByRole('button', { name: 'Xóa bộ nhớ đệm ứng dụng', exact: true })).toBeEnabled();
  const observationsAfter = await inspectSettings(page, info, 'after-clear');
  expect(await readPrivateData()).toEqual(privateBefore);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Cài đặt ứng dụng', exact: true })).toBeVisible();
  expect(await readPrivateData()).toEqual(privateBefore);
  await navigate(page, '/shopping');
  await expect(page.locator('.shopping-pending-label')).toHaveText('Chờ đồng bộ');
  await expect(page.locator('.shopping-saved-row')).toContainText('Cài đặt giữ hàng chờ đồng bộ');
  const serverAfter = {
    inventory: await getJson(page, '/api/v1/inventory'),
    shopping: await getJson(page, '/api/v1/shopping-list'),
  };
  expect(serverAfter).toEqual(serverBefore);
  // Automatic load-time retry can attempt the queued operation; it stays aborted and queued.
  expect(requests.every((request) => request === 'POST /api/v1/shopping-list/items')).toBe(true);
  await navigate(page, settingsPath);
  await seedCacheStorage(page);
  await page.evaluate(() => { caches.delete = async () => { throw new Error('synthetic storage denial'); }; });
  await page.getByRole('button', { name: 'Xóa bộ nhớ đệm ứng dụng', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Chưa xóa được bộ nhớ đệm. Hãy kiểm tra quyền lưu trữ của trình duyệt rồi thử lại.');
  await expect(page.getByText('Đã xóa bộ nhớ đệm ứng dụng.', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(async () => caches.keys())).toContain('settings-continuation-proof');
  expect(await readPrivateData()).toEqual(privateBefore);
  const errorObservations = await inspectSettings(page, info, 'cache-error');

  await page.goto('/settings');
  await expect(page).toHaveURL(/\/settings\/app$/);
  await writeFile(info.outputPath('settings-summary.json'), JSON.stringify({
    cacheStorageCleared: true,
    offlineOutboxRetained: true,
    privateDataUnchangedAfterClearAndReload: true,
    pendingShoppingProjectionSurvivedReload: true,
    serverInventoryAndShoppingUnchanged: true,
    cacheFailureShownWithoutSuccess: true,
    failureCacheEntryRetained: true,
    cacheFailureProviderShaped: true,
    attemptedRequests: requests,
    pendingBefore,
    pendingAfter: await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), outboxKey),
    routeRedirect: '/settings -> /settings/app',
    privacyLink: '/settings/privacy',
    observationsBefore,
    pendingObservations,
    observationsAfter,
    errorObservations,
  }, null, 2));
});

test('settings uses manual install guidance when no native prompt is available', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  await page.goto(settingsPath);
  const install = page.getByRole('button', { name: 'Cài đặt lên màn hình chính', exact: true });
  await expect(install).toBeVisible();
  await install.focus();
  await install.click();
  const dialog = page.getByRole('alertdialog', { name: 'Cài đặt Takolio lên màn hình chính', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('iPhone (Safari)');
  await expect(dialog).toContainText('Android (Chrome)');
  await expect(dialog.getByRole('button', { name: 'Đóng', exact: true })).toBeFocused();
  const observations = await inspectSettings(page, info, 'manual-help', dialog);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(install).toBeFocused();
  await writeFile(info.outputPath('manual-install-summary.json'), JSON.stringify({
    nativePromptAvailable: false,
    manualHelpShown: true,
    escapeClosesAndRestoresFocus: true,
    observations,
  }, null, 2));
});

test('settings consumes a browser install prompt and identifies standalone mode', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  await page.goto(settingsPath);
  const outcomes = [];
  const install = page.getByRole('button', { name: 'Cài đặt lên màn hình chính', exact: true });
  await expect(install).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const promptObservations = [];
  for (const outcome of ['accepted', 'dismissed', 'rejected'] as const) {
    await page.evaluate((outcome) => {
      const state = window as Window & { __takolioPromptCalls?: number; __takolioPromptPrevented?: boolean; __takolioReleasePrompt?: () => void };
      state.__takolioPromptCalls = 0;
      const choice = new Promise<{ outcome: string }>((resolve) => {
        state.__takolioReleasePrompt = () => resolve({ outcome });
      });
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.defineProperties(event, {
        prompt: { value: async () => {
          state.__takolioPromptCalls = (state.__takolioPromptCalls ?? 0) + 1;
          if (outcome === 'rejected') throw new Error('synthetic prompt rejection');
        } },
        userChoice: { value: choice },
      });
      window.dispatchEvent(event);
      state.__takolioPromptPrevented = event.defaultPrevented;
    }, outcome);
    await install.click();
    await expect.poll(() => page.evaluate(() => (window as Window & { __takolioPromptCalls?: number }).__takolioPromptCalls)).toBe(1);
    expect(await page.evaluate(() => (window as Window & { __takolioPromptPrevented?: boolean }).__takolioPromptPrevented)).toBe(true);
    let blockedDuplicate = true;
    if (outcome !== 'rejected') {
      const busy = page.getByRole('button', { name: 'Đang xử lý...', exact: true });
      blockedDuplicate = await busy.count() === 1 && await busy.isDisabled();
      expect.soft(blockedDuplicate, `${outcome}: install pending action disables repeated activation`).toBe(true);
      if (!blockedDuplicate) await install.click();
      if (outcome === 'accepted') promptObservations.push(...await inspectSettings(page, info, 'install-pending'));
      await page.evaluate(() => (window as Window & { __takolioReleasePrompt?: () => void }).__takolioReleasePrompt?.());
    } else {
      await expect(page.getByRole('alert')).toHaveText('Chưa mở được cửa sổ cài đặt. Hãy thử hướng dẫn cài thủ công.');
      promptObservations.push(...await inspectSettings(page, info, 'install-error'));
    }
    await expect(install).toBeEnabled();
    const promptCalls = await page.evaluate(() => (window as Window & { __takolioPromptCalls?: number }).__takolioPromptCalls);
    expect.soft(promptCalls, `${outcome}: one prompt invocation`).toBe(1);
    await install.click();
    const dialog = page.getByRole('alertdialog', { name: 'Cài đặt Takolio lên màn hình chính', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Đã hiểu', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(install).toBeFocused();
    outcomes.push({ outcome, blockedDuplicate, promptCalls, consumedPromptUsesManualHelp: true });
  }

  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (query === '(display-mode: standalone)') {
        return { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } } as MediaQueryList;
      }
      return original(query);
    };
  });
  await page.reload();
  await expect(page.getByText('Bạn đang mở Takolio từ ứng dụng đã cài trên màn hình chính.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cài đặt lên màn hình chính', exact: true })).toHaveCount(0);
  const standaloneObservations = await inspectSettings(page, info, 'standalone');
  await writeFile(info.outputPath('pwa-summary.json'), JSON.stringify({
    syntheticProviderOnly: true,
    beforeInstallPromptPrevented: true,
    outcomes,
    standaloneMessage: true,
    installActionHiddenInStandalone: true,
    promptObservations,
    standaloneObservations,
  }, null, 2));
});
