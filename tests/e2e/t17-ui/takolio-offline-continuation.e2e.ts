import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, reset, getJson } from '../t13b/fixtures';

const listApi = '/api/v1/shopping-list';
const configs = [[320, 568, 1], [320, 420, 2], [390, 844, 1], [1440, 900, 1]] as const;
const bannerSelector = '.kitchen-banner-slot > div';
type Queued = { id: string; operationId: string; userId: string; householdId: string; path: string; method: string; body: string };
async function queue(page: Page): Promise<Queued[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('frigo_sync_outbox_v1') ?? '[]'));
}
async function boundary(page: Page) {
  const me = await getJson<{ user: { onboardingCompleted: boolean } }>(page, '/api/v1/me');
  return { inventory: await getJson(page, '/api/v1/inventory'), family: await getJson(page, '/api/v1/family-preferences'),
    current: await getJson(page, '/api/v1/meal-planning/plans/current'), onboardingCompleted: me.user.onboardingCompleted };
}
async function connectivity(page: Page, online: boolean) {
  // API requests are independently aborted below; navigator/events are explicitly shaped.
  await page.evaluate(value => {
    sessionStorage.setItem('__offline_test', String(!value));
    dispatchEvent(new Event(value ? 'online' : 'offline'));
  }, online);
}
async function capture(page: Page, info: TestInfo, state: string, retryLabel?: string) {
  const observations = [];
  for (const [width, height, scale] of configs) {
    await page.setViewportSize({ width, height });
    await page.evaluate(value => { document.documentElement.style.fontSize = `${value * 100}%`; }, scale);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => {
      const root = document.querySelector('[data-kitchen-navigation]')!;
      const banner = root.querySelector('.kitchen-banner-slot > div');
      return Math.abs((banner?.getBoundingClientRect().height ?? 0) - parseFloat(getComputedStyle(root).getPropertyValue('--kitchen-banner-height')));
    })).toBeLessThan(1);
    const metrics = await page.evaluate(() => {
      const banner = document.querySelector('.kitchen-banner-slot > div');
      const header = document.querySelector('.kitchen-header');
      const texts: string[] = [];
      const overlaps: string[] = [];
      const buttonBox = banner?.querySelector('button')?.getBoundingClientRect();
      for (const root of [banner, document.querySelector('.account-body')]) {
        if (!root) continue;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim()) continue;
          const range = document.createRange(); range.selectNodeContents(node);
          const rects = [...range.getClientRects()].filter(r => r.width > 0);
          if (rects.some(r => r.left < -1 || r.right > innerWidth + 1)) texts.push(node.textContent.trim());
          if (root === banner && buttonBox && !node.parentElement?.closest('button') && rects.some(r =>
            r.left < buttonBox.right - 1 && r.right > buttonBox.left + 1 && r.top < buttonBox.bottom - 1 && r.bottom > buttonBox.top + 1)) overlaps.push(node.textContent.trim());
        }
      }
      const bannerBox = banner?.getBoundingClientRect(); const headerBox = header?.getBoundingClientRect();
      return { innerWidth, scrollWidth: document.documentElement.scrollWidth, textOutsideViewport: texts, textOverlappingRetry: overlaps,
        bannerHeight: bannerBox?.height ?? 0, headerTop: headerBox?.top ?? null, bannerBottom: bannerBox?.bottom ?? null,
        measuredBannerHeight: parseFloat(getComputedStyle(document.querySelector('[data-kitchen-navigation]')!).getPropertyValue('--kitchen-banner-height')),
        liveStatus: !!banner?.querySelector('[role="status"][aria-live="polite"][aria-atomic="true"]'),
        brokenImages: [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => new URL(image.src).pathname) };
    });
    const name = `${state}-${width}x${height}-text${scale}`;
    expect.soft(metrics.scrollWidth, `${name}: document width`).toBeLessThanOrEqual(width);
    expect.soft(metrics.textOutsideViewport, `${name}: text`).toEqual([]);
    expect.soft(metrics.textOverlappingRetry, `${name}: text clear of retry`).toEqual([]);
    expect.soft(metrics.brokenImages, `${name}: assets`).toEqual([]);
    if (metrics.bannerHeight) {
      expect.soft(metrics.liveStatus, `${name}: status semantics`).toBe(true);
      expect.soft(Math.abs(metrics.measuredBannerHeight - metrics.bannerHeight), `${name}: measured banner`).toBeLessThan(1);
      if (metrics.headerTop !== null && metrics.bannerBottom !== null) expect.soft(metrics.headerTop, `${name}: unobscured header`).toBeGreaterThanOrEqual(metrics.bannerBottom - 1);
    }
    let retryTarget = null;
    if (retryLabel) {
      const retry = page.getByRole('button', { name: retryLabel, exact: true });
      await retry.scrollIntoViewIfNeeded();
      const box = await retry.boundingBox();
      const enabled = await retry.isEnabled();
      if (enabled) await retry.click({ trial: true });
      const fits = !!box && box.width >= 44 && box.height >= 44 && box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1;
      expect.soft(fits, `${name}: 44px reachable retry`).toBe(true);
      retryTarget = { box, enabled, fits };
    }
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect.soft(axe.violations.map(({ id }) => id), `${name}: axe`).toEqual([]);
    const observation = { state, viewport: { width, height }, textScale: scale, metrics, retryTarget };
    await writeFile(info.outputPath(`axe-${name}.json`), JSON.stringify({ ...observation,
      violations: axe.violations, incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })) }, null, 2));
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
    observations.push(observation);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
  return observations;
}

test('offline write survives reload and failed retries before exact owned replay and recovery', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const before = await boundary(page);
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true,
    get: () => sessionStorage.getItem('__offline_test') !== 'true' }));
  await page.goto('/shopping');
  const banner = page.locator(bannerSelector);
  await expect(banner).toHaveCount(0);
  const attempts: { body: string | null; outcome: string }[] = [];
  let mode: 'abort' | 'server' | 'held' | 'success' = 'abort';
  let release = () => {};
  let gate = Promise.resolve();
  const addUrl = new URL(`${listApi}/items`, page.url()).href;
  await page.route(addUrl, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const outcome = mode;
    attempts.push({ body: route.request().postData(), outcome });
    if (outcome === 'abort') return route.abort('internetdisconnected');
    if (outcome === 'held') await gate;
    if (outcome === 'server' || outcome === 'held') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic local retry failure' }) });
    return route.continue();
  });
  await connectivity(page, false);
  await expect(banner).toContainText('Ngoại tuyến');
  const observations = await capture(page, info, 'offline');
  if (!await page.locator('.shopping-add-panel').evaluate(node => (node as HTMLDetailsElement).open)) await page.locator('.shopping-add-panel > summary').click();
  const form = page.locator('.shopping-add-form');
  await form.getByLabel('Tên nguyên liệu', { exact: true }).fill('Nấm đồng bộ kiểm thử');
  await form.getByLabel('Số lượng', { exact: true }).fill('125.5');
  await form.getByRole('combobox', { name: 'Đơn vị', exact: true }).selectOption('g');
  await form.getByRole('button', { name: 'Thêm vào danh sách', exact: true }).click();
  await expect(page.locator('.shopping-pending-label')).toHaveText('Chờ đồng bộ');
  const original = await queue(page);
  expect(original).toHaveLength(1);
  expect(original[0]).toMatchObject({ userId: 'planner-preview-user', householdId: 'planner-preview-household', method: 'POST', path: '/shopping-list/items' });
  expect(original[0].operationId).toBeTruthy();
  expect((await getJson<{ items: unknown[] }>(page, listApi)).items).toHaveLength(0);
  await page.reload();
  await expect(banner).toContainText('Ngoại tuyến');
  await expect(page.locator('.shopping-pending-label')).toHaveText('Chờ đồng bộ');
  expect(await queue(page)).toEqual(original);
  mode = 'server';
  await connectivity(page, true);
  await expect.poll(() => attempts.filter(a => a.outcome === 'server').length).toBe(1);
  const retry = banner.getByRole('button', { name: 'Đồng bộ ngay', exact: true });
  await expect(retry).toBeEnabled();
  expect(await queue(page)).toEqual(original);
  observations.push(...await capture(page, info, 'pending', 'Đồng bộ ngay'));
  mode = 'held'; gate = new Promise<void>(resolve => { release = resolve; });
  try {
    await retry.focus(); await page.keyboard.press('Enter');
    await expect.poll(() => attempts.filter(a => a.outcome === 'held').length).toBe(1);
    await expect(retry).toBeDisabled();
    await page.keyboard.press('Enter');
    expect(attempts.filter(a => a.outcome === 'held')).toHaveLength(1);
    observations.push(...await capture(page, info, 'syncing', 'Đồng bộ ngay'));
  } finally { release(); }
  await expect(retry).toBeEnabled();
  expect(await queue(page)).toEqual(original);
  expect((await getJson<{ items: unknown[] }>(page, listApi)).items).toHaveLength(0);
  mode = 'success';
  await retry.focus(); await page.keyboard.press('Enter');
  await expect(banner).toHaveCount(0);
  await expect.poll(() => queue(page)).toEqual([]);
  const saved = await getJson<{ items: { id: string; name: string; quantity: number; unit: string }[] }>(page, listApi);
  expect(saved.items).toMatchObject([{ id: JSON.parse(original[0].body).id, name: 'Nấm đồng bộ kiểm thử', quantity: 125.5, unit: 'g' }]);
  expect(saved.items).toHaveLength(1);
  expect(attempts.filter(a => a.outcome === 'success')).toHaveLength(1);
  expect(attempts.every(a => a.body === original[0].body)).toBe(true);
  await page.reload();
  await expect(banner).toHaveCount(0);
  await expect(page.locator('.shopping-pending-label')).toHaveCount(0);
  expect(await queue(page)).toEqual([]);
  expect(await getJson(page, listApi)).toEqual(saved);
  expect(await boundary(page)).toEqual(before);
  await writeFile(info.outputPath('recovery-summary.json'), JSON.stringify({ shapedNavigatorAndEvents: true, actualApiNetworkAbort: true,
    durableQueueReload: true, exactOwnedQueueRetainedAfter500: true, keyboardManualRetry: true, pendingDisabled: true,
    exactReplayBodyAndItemId: true, successfulReplayCount: 1, serverItemCount: saved.items.length, recoveredReload: true,
    otherDomainSnapshotsUnchanged: true, attempts: attempts.map(a => a.outcome), observations }, null, 2));
});

test('server read failure stays distinct from offline and keyboard retry returns real local data', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const before = await boundary(page); const shopping = await getJson(page, listApi);
  const writes: string[] = [];
  page.on('request', request => { const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${path}`); });
  const notificationsUrl = new URL('/api/v1/notifications', page.url()).href;
  await page.route(notificationsUrl, route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic local read failure' }) }));
  await page.goto('/notifications');
  await expect(page.getByRole('alert')).toHaveText('Không tải được dữ liệu. Vui lòng thử lại.');
  await expect(page.locator(bannerSelector)).toHaveCount(0);
  const observations = await capture(page, info, 'server-error', 'Thử lại');
  await page.unroute(notificationsUrl);
  const retry = page.getByRole('button', { name: 'Thử lại', exact: true });
  await retry.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveCount(0);
  const data = await getJson<{ notifications: { title: string }[] }>(page, '/api/v1/notifications');
  await expect(page.locator('.account-body article')).toHaveCount(data.notifications.length);
  for (const item of data.notifications) await expect(page.getByRole('heading', { name: item.title, exact: true })).toBeVisible();
  if (!data.notifications.length) await expect(page.getByText(/Không có thông báo để hiển thị/)).toBeVisible();
  expect(await queue(page)).toEqual([]);
  expect(await boundary(page)).toEqual(before); expect(await getJson(page, listApi)).toEqual(shopping); expect(writes).toEqual([]);
  await writeFile(info.outputPath('error-summary.json'), JSON.stringify({ shapedRead500: true, serverErrorDistinctFromOffline: true,
    keyboardRetry: true, realLocalReadRecovered: true, queueEmpty: true, domainSnapshotsUnchanged: true, writes, observations }, null, 2));
});
