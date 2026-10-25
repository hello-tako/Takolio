import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, reset, navigate, getJson } from '../t13b/fixtures';

const viewports = [[320, 568, 1], [320, 420, 2], [390, 844, 1], [1440, 900, 1]] as const;
const path = '/me/preferences';
const initial = {
  householdSize: 7, spicyLevel: 'hot', favoriteCuisines: ['italian'],
  dietaryRestrictions: ['vegetarian'], language: 'en',
};

async function inspectFood(page: Page, info: TestInfo, state: string) {
  const observations = [];
  for (const [width, height, scale] of viewports) {
    await page.setViewportSize({ width, height });
    await page.evaluate(value => { document.documentElement.style.fontSize = `${value * 100}%`; }, scale);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const metrics = await page.evaluate(() => ({
      innerWidth, scrollWidth: document.documentElement.scrollWidth,
      brokenImages: [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => new URL(image.src).pathname),
    }));
    expect.soft(metrics.innerWidth, `${state}: requested viewport`).toBe(width);
    expect.soft(metrics.scrollWidth, `${state}-${width}-text${scale}: overflow`).toBeLessThanOrEqual(width);
    expect.soft(metrics.brokenImages, `${state}: images`).toEqual([]);
    const controls = [];
    for (const control of await page.locator('.account-body button').all()) {
      await control.scrollIntoViewIfNeeded();
      const enabled = await control.isEnabled();
      let actionable: boolean | null = null;
      if (enabled) {
        try { await control.click({ trial: true, timeout: 1500 }); actionable = true; }
        catch { actionable = false; }
      }
      const box = await control.boundingBox();
      const fits = !!box && box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1;
      const label = await control.textContent();
      controls.push({ label, enabled, actionable, fits });
      expect.soft((!enabled || actionable) && fits, `${state}-${width}-text${scale}: ${label}`).toBe(true);
    }
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect.soft(axe.violations.map(({ id }) => id), `${state}: axe`).toEqual([]);
    const observation = { state, viewport: { width, height }, textScale: scale, metrics, controls };
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

async function writeJson(page: Page, endpoint: string, method: string, body: unknown) {
  return page.evaluate(async ({ endpoint, method, body }) => {
    const response = await fetch(`/api/v1${endpoint}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { endpoint, method, body });
}

function writesDuring(page: Page) {
  const writes: Array<{ method: string; path: string; body: unknown }> = [];
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push({ method: request.method(), path: pathname, body: request.postDataJSON() });
    }
  });
  return writes;
}

async function keyboardClick(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).focus();
  await page.keyboard.press('Space');
}

test('food preferences retain unknown values, pending draft, failed retry and separate hard safety data', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  expect((await writeJson(page, '/preferences', 'PATCH', initial)).status).toBe(200);
  expect((await writeJson(page, '/family-preferences', 'PUT', { expectedRevision: 0,
    preferences: { allergens: ['peanut'], forbiddenIngredientIds: ['BEEF'], preferredRegions: ['nam'] },
  })).status).toBe(200);
  const before = {
    inventory: await getJson(page, '/api/v1/inventory'), shopping: await getJson(page, '/api/v1/shopping-list'),
    family: await getJson(page, '/api/v1/family-preferences'), me: await getJson<{ user: { onboardingCompleted: boolean } }>(page, '/api/v1/me'),
  };
  const writes = writesDuring(page);
  await page.goto(path);
  await expect(page.getByRole('button', { name: '5+', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Rất cay', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Giới hạn này giúp lọc gợi ý, không thay thế tư vấn y tế.', { exact: true })).toBeVisible();
  const observations = await inspectFood(page, info, 'server-values');
  await keyboardClick(page, 'Thái Lan');
  await keyboardClick(page, 'Hải sản');
  await keyboardClick(page, 'Ít cay');
  const expected = { householdSize: 7, spicyLevel: 'mild', favoriteCuisines: ['italian', 'thai'], dietaryRestrictions: ['vegetarian', 'seafood'] };
  const url = new URL('/api/v1/preferences', page.url()).href;
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(url, async route => {
    if (route.request().method() === 'PATCH') await gate;
    await route.continue();
  });
  try {
    await keyboardClick(page, 'Lưu sở thích');
    await expect(page.getByRole('button', { name: 'Đang xử lý...', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Ít cay', exact: true })).toBeDisabled();
    expect(writes).toEqual([{ method: 'PATCH', path: '/api/v1/preferences', body: expected }]);
    expect((await getJson<{ preferences: typeof initial }>(page, '/api/v1/preferences')).preferences).toEqual(initial);
    observations.push(...await inspectFood(page, info, 'saving'));
  } finally { release(); }
  await expect(page.getByRole('status')).toHaveText('Đã lưu sở thích.');
  await page.unroute(url);
  expect((await getJson<{ preferences: typeof initial }>(page, '/api/v1/preferences')).preferences).toEqual({ ...expected, language: 'en' });
  await page.reload();
  await expect(page.getByRole('button', { name: '5+', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Thái Lan', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Hải sản', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Ít cay', exact: true })).toHaveAttribute('aria-pressed', 'true');
  observations.push(...await inspectFood(page, info, 'saved-reload'));
  await keyboardClick(page, 'Không cay');
  await page.route(url, route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 500, json: { error: 'synthetic-save-unavailable' } }) : route.continue());
  await keyboardClick(page, 'Lưu sở thích');
  const error = page.getByRole('alert').filter({ hasText: 'Chưa thể lưu sở thích.' });
  await expect(error).toBeFocused();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Không cay', exact: true })).toHaveAttribute('aria-pressed', 'true');
  observations.push(...await inspectFood(page, info, 'save-error'));
  expect((await getJson<{ preferences: typeof initial }>(page, '/api/v1/preferences')).preferences).toEqual({ ...expected, language: 'en' });
  await page.unroute(url);
  await keyboardClick(page, 'Lưu sở thích');
  await expect(page.getByRole('status')).toHaveText('Đã lưu sở thích.');
  expect(writes).toEqual([
    { method: 'PATCH', path: '/api/v1/preferences', body: expected },
    { method: 'PATCH', path: '/api/v1/preferences', body: { ...expected, spicyLevel: 'none' } },
    { method: 'PATCH', path: '/api/v1/preferences', body: { ...expected, spicyLevel: 'none' } },
  ]);
  await keyboardClick(page, 'Nhật Bản');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Nhật Bản', exact: true })).toHaveAttribute('aria-pressed', 'false');
  const finalPreferences = (await getJson<{ preferences: typeof initial }>(page, '/api/v1/preferences')).preferences;
  expect(finalPreferences).toEqual({ ...expected, spicyLevel: 'none', language: 'en' });
  expect(await getJson(page, '/api/v1/family-preferences')).toEqual(before.family);
  expect(await getJson(page, '/api/v1/inventory')).toEqual(before.inventory);
  expect(await getJson(page, '/api/v1/shopping-list')).toEqual(before.shopping);
  expect((await getJson<{ user: { onboardingCompleted: boolean } }>(page, '/api/v1/me')).user.onboardingCompleted).toBe(before.me.user.onboardingCompleted);
  await writeFile(info.outputPath('roundtrip-summary.json'), JSON.stringify({ initial, finalPreferences,
    unknownVocabularyRetained: true, householdSevenRetained: true, languageRetained: true, pendingDraftLocked: true,
    failedWriteShaped: true, failureFocusedWithoutSuccess: true, retrySavedRealApi: true, unsavedEditNotPersisted: true,
    familySafetyInventoryShoppingAndOnboardingUnchanged: true, writes, observations,
  }, null, 2));
});

test('food preferences wait for actual GET and recover shaped read failures', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const writes = writesDuring(page);
  const url = new URL('/api/v1/preferences', page.url()).href;
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(url, async route => { await gate; await route.continue(); });
  const observations = [];
  try {
    await page.goto(path);
    await expect(page.getByRole('status')).toHaveText('Đang tải sở thích…');
    await expect(page.getByRole('button', { name: 'Lưu sở thích', exact: true })).toHaveCount(0);
    observations.push(...await inspectFood(page, info, 'loading'));
  } finally { release(); }
  await expect(page.getByRole('button', { name: 'Lưu sở thích', exact: true })).toBeEnabled();
  await page.unroute(url);
  await page.route(url, route => route.fulfill({ status: 500, json: { error: 'synthetic-read-unavailable' } }));
  await page.reload();
  await expect(page.getByRole('alert')).toHaveText('Không tải được dữ liệu. Vui lòng thử lại.');
  await expect(page.locator('.account-editor')).toHaveCount(0);
  observations.push(...await inspectFood(page, info, 'read-error'));
  await page.unroute(url);
  await keyboardClick(page, 'Thử lại');
  await expect(page.getByRole('button', { name: 'Lưu sở thích', exact: true })).toBeEnabled();
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('read-summary.json'), JSON.stringify({ heldActualGET: true, shaped500: true,
    draftHiddenDuringLoadingAndError: true, keyboardRetryRecoveredRealApi: true, writes, observations,
  }, null, 2));
});

test('offline guest taste choices disclose their session lifetime without server saves', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.route('**/api/**', route => route.abort('internetdisconnected'));
  await page.goto('/landing');
  await page.getByRole('button', { name: 'Dùng thử Takolio ngay', exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/household$/);
  expect(await page.evaluate(() => localStorage.getItem('frigo_guest_offline'))).toBe('true');
  const writes = writesDuring(page);
  await navigate(page, path);
  await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await keyboardClick(page, '3');
  await keyboardClick(page, 'Rất cay');
  await keyboardClick(page, 'Thái Lan');
  await keyboardClick(page, 'Thịt bò');
  await keyboardClick(page, 'Lưu sở thích');
  const statusBeforeReload = await page.getByRole('status').textContent();
  const noteBeforeReload = await page.locator('.account-body > p').textContent();
  expect.soft(statusBeforeReload, 'offline success must disclose session-only application').toBe('Đã áp dụng sở thích cho phiên dùng thử này.');
  expect.soft(noteBeforeReload, 'offline note must disclose loss on reload').toContain('sẽ mất khi tải lại ứng dụng');
  const observations = await inspectFood(page, info, 'offline-applied');
  await navigate(page, '/settings/app');
  await expect(page.getByRole('heading', { name: 'Cài đặt ứng dụng', exact: true })).toBeVisible();
  await navigate(page, path);
  for (const name of ['3', 'Rất cay', 'Thái Lan', 'Thịt bò']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await page.reload();
  await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const name of ['3', 'Rất cay', 'Thái Lan', 'Thịt bò']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'false');
  }
  observations.push(...await inspectFood(page, info, 'offline-reload'));
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('offline-summary.json'), JSON.stringify({ actualOfflineGuestFallback: true,
    allApiRequestsAborted: true, noPreferenceWrites: true, choicesSurviveRouteNavigation: true,
    choicesResetOnReload: true, statusBeforeReload, noteBeforeReload, writes, observations,
  }, null, 2));
});
