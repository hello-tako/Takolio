import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { FamilyMealPlanDtoSchema } from '../../../packages/domain/src/family-meal-planning-api';
import { FamilyPreferencesDtoSchema } from '../../../packages/domain/src/family-preferences-api';
import { test, expect, reset, navigate, getJson } from '../t13b/fixtures';

const composition = process.env.PREVIEW_MEAL_COMPOSITION_V2 === 'true';
const settingsPath = '/settings/planning';
const familyPath = '/api/v1/family-preferences';
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

async function writeJson(page: Page, path: string, method: string, body: unknown) {
  return page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { path, method, body });
}
async function family(page: Page) { return FamilyPreferencesDtoSchema.parse(await getJson(page, familyPath)); }
function monitor(page: Page) {
  const writes: Array<{ method: string; path: string; body: unknown }> = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push({ method: request.method(), path, body: request.postDataJSON() });
    }
  });
  return writes;
}
async function keyboardClick(page: Page, role: 'button' | 'link', name: string) {
  await page.getByRole(role, { name, exact: true }).focus();
  await page.keyboard.press('Enter');
}
async function openSafety(page: Page) {
  await page.locator('details.family-safety > summary').click();
  await expect(page.getByRole('checkbox', { name: 'Đậu phộng', exact: true })).toBeVisible();
}

test('family settings preserve safety, revision conflicts and existing plans; profile link describes its actual scope', async ({ page }, info) => {
  test.skip(!composition, 'Requires paired composition preview');
  test.setTimeout(300_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const seeded = await writeJson(page, familyPath, 'PUT', { expectedRevision: 0, preferences: {
    householdSize: 7, preferredRegions: ['nam'], allergens: ['peanut', 'stored-unknown-allergen'],
    forbiddenIngredientIds: ['BEEF'], dislikedIngredientIds: ['MUSHROOM'],
  } });
  expect(seeded.status).toBe(200);
  const initial = FamilyPreferencesDtoSchema.parse(seeded.body);
  const created = await writeJson(page, '/api/v2/meal-planning/plans', 'POST', {
    startDate: '2030-01-07', horizonDays: 1, defaultServings: 7, mode: 'shopping_allowed',
    slots: [{ date: '2030-01-07', mealType: 'dinner' }],
  });
  expect(created.status).toBe(200);
  const plan = FamilyMealPlanDtoSchema.parse(created.body);
  const planPath = `/api/v2/meal-planning/plans/${plan.plan.id}`;
  const before = { inventory: await getJson(page, '/api/v1/inventory'), shopping: await getJson(page, '/api/v1/shopping-list'),
    me: await getJson<{ user: { onboardingCompleted: boolean } }>(page, '/api/v1/me'),
  };
  const writes = monitor(page);
  await page.goto(settingsPath);
  await expect(page.getByRole('spinbutton', { name: 'Số người thường ăn', exact: true })).toHaveValue('7');
  await openSafety(page);
  await expect(page.getByRole('checkbox', { name: 'Đậu phộng', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'stored-unknown-allergen · hạn chế đã lưu', exact: true })).toBeChecked();
  const observations = await capture(page, info, 'family-values');
  await page.getByRole('spinbutton', { name: 'Số người thường ăn', exact: true }).fill('4');
  await page.getByRole('checkbox', { name: 'Miền Bắc', exact: true }).check();
  const expected = { ...initial.preferences, householdSize: 4, preferredRegions: ['nam', 'bac'] };
  const url = new URL(familyPath, page.url()).href;
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(url, async route => { if (route.request().method() === 'PUT') await gate; await route.continue(); });
  try {
    await keyboardClick(page, 'button', 'Lưu thói quen');
    await expect(page.getByRole('spinbutton', { name: 'Số người thường ăn', exact: true })).toBeDisabled();
    await expect(page.getByRole('checkbox', { name: 'Đậu phộng', exact: true })).toBeDisabled();
    await expect(page.locator('form button[type="submit"]')).toBeDisabled();
    expect(await family(page)).toEqual(initial);
    observations.push(...await capture(page, info, 'family-saving'));
  } finally { release(); }
  await expect(page.getByRole('status')).toHaveText('Đã lưu thói quen cho các thực đơn tới.');
  await page.unroute(url);
  expect(await family(page)).toEqual({ revision: 2, preferences: expected });
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Số người thường ăn', exact: true })).toHaveValue('4');
  await openSafety(page);
  await expect(page.getByRole('checkbox', { name: 'Đậu phộng', exact: true })).toBeChecked();
  await page.getByRole('spinbutton', { name: 'Số người thường ăn', exact: true }).fill('6');
  const remotePreferences = { ...expected, householdSize: 9, allergens: [...expected.allergens!, 'milk'] };
  expect((await writeJson(page, familyPath, 'PUT', { expectedRevision: 2, preferences: remotePreferences })).status).toBe(200);
  await keyboardClick(page, 'button', 'Lưu thói quen');
  await expect(page.getByRole('alert')).toContainText('Chưa lưu được thói quen.');
  await expect(page.getByRole('button', { name: 'Lưu thói quen', exact: true })).toBeDisabled();
  await expect(page.getByRole('spinbutton', { name: 'Số người thường ăn', exact: true })).toHaveValue('6');
  expect(await family(page)).toEqual({ revision: 3, preferences: remotePreferences });
  observations.push(...await capture(page, info, 'family-conflict'));
  await keyboardClick(page, 'button', 'Tải lại thói quen mới nhất');
  await expect(page.getByRole('spinbutton', { name: 'Số người thường ăn', exact: true })).toHaveValue('9');
  await expect(page.getByRole('checkbox', { name: 'Sữa', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Lưu thói quen', exact: true })).toBeEnabled();
  await page.getByRole('spinbutton', { name: 'Số người thường ăn', exact: true }).fill('5');
  await page.route(url, route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 500, json: { error: 'synthetic-save-unavailable' } }) : route.continue());
  await keyboardClick(page, 'button', 'Lưu thói quen');
  await expect(page.getByRole('alert')).toContainText('Chưa lưu được thói quen.');
  await expect(page.getByRole('button', { name: 'Lưu thói quen', exact: true })).toBeEnabled();
  await expect(page.getByRole('status')).toHaveCount(0);
  observations.push(...await capture(page, info, 'family-save-error'));
  await page.unroute(url);
  await keyboardClick(page, 'button', 'Lưu thói quen');
  await expect(page.getByRole('status')).toHaveText('Đã lưu thói quen cho các thực đơn tới.');
  const finalFamily = { revision: 4, preferences: { ...remotePreferences, householdSize: 5 } };
  expect(await family(page)).toEqual(finalFamily);
  const profileLink = page.locator('.account-body a[href="/me/preferences"]');
  const linkText = await profileLink.textContent();
  const linkContext = await page.locator('.account-body').textContent();
  expect.soft(linkText, 'legacy profile link describes tastes without claiming hard allergy safety').toBe('Gu món & độ cay trong hồ sơ');
  expect.soft(linkContext, 'settings explain where hard safety is edited').toContain('Sở thích trong hồ sơ không thay thế các ràng buộc này.');
  await profileLink.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Sở thích & hạn chế', exact: true })).toBeVisible();
  await keyboardClick(page, 'button', 'Hải sản');
  await keyboardClick(page, 'button', 'Lưu sở thích');
  await expect(page.getByRole('status')).toHaveText('Đã lưu sở thích.');
  observations.push(...await capture(page, info, 'legacy-profile'));
  expect(await family(page)).toEqual(finalFamily);
  await navigate(page, settingsPath);
  await expect(page.getByRole('spinbutton', { name: 'Số người thường ăn', exact: true })).toHaveValue('5');
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Số người thường ăn', exact: true })).toHaveValue('5');
  const finalPlan = FamilyMealPlanDtoSchema.parse(await getJson(page, planPath));
  expect(finalPlan).toEqual({ ...plan, familyPreferenceFreshness: 'requires_revalidation',
    plan: { ...plan.plan, freshness: { ...plan.plan.freshness, status: 'requires_revalidation',
      reasons: ['stale_preferences'], checkedAt: finalPlan.plan.freshness.checkedAt } },
  });
  expect(await getJson(page, '/api/v1/inventory')).toEqual(before.inventory);
  expect(await getJson(page, '/api/v1/shopping-list')).toEqual(before.shopping);
  expect((await getJson<{ user: { onboardingCompleted: boolean } }>(page, '/api/v1/me')).user.onboardingCompleted).toBe(before.me.user.onboardingCompleted);
  expect(writes.map(({ method, path }) => ({ method, path }))).toEqual([
    ...Array.from({ length: 5 }, () => ({ method: 'PUT', path: familyPath })),
    { method: 'PATCH', path: '/api/v1/preferences' },
  ]);
  expect(writes[0].body).toEqual({ expectedRevision: 1, preferences: expected });
  expect(writes[2].body).toEqual({ expectedRevision: 2, preferences: { ...expected, householdSize: 6 } });
  expect(writes[3].body).toEqual({ expectedRevision: 3, preferences: finalFamily.preferences });
  expect(writes[4].body).toEqual(writes[3].body);
  await writeFile(info.outputPath('family-summary.json'), JSON.stringify({ linkText, pendingLocked: true,
    realConflict: true, explicitReloadAdoptsRevisionAndSafety: true, shaped500Retry: true, unknownAllergenRetained: true,
    profileSaveDoesNotChangeFamilySafety: true, existingPlanPreservedExceptDerivedFreshness: true,
    stockShoppingOnboardingUnchanged: true, familyRevisions: [1, 2, 3, 4], writes, observations,
  }, null, 2));
});

test('family settings hide the form while loading and recover shaped read errors', async ({ page }, info) => {
  test.skip(!composition, 'Requires paired composition preview');
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const writes = monitor(page);
  const url = new URL(familyPath, page.url()).href;
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(url, async route => { await gate; await route.continue(); });
  const observations = [];
  try {
    await page.goto(settingsPath);
    await expect(page.getByRole('status')).toHaveText('Đang tải thói quen gia đình…');
    await expect(page.locator('.family-settings-form')).toHaveCount(0);
    observations.push(...await capture(page, info, 'family-loading'));
  } finally { release(); }
  await expect(page.getByRole('button', { name: 'Lưu thói quen', exact: true })).toBeEnabled();
  await page.unroute(url);
  await page.route(url, route => route.fulfill({ status: 500, json: { error: 'synthetic-read-unavailable' } }));
  await page.reload();
  await expect(page.getByRole('alert')).toHaveText('Không tải được dữ liệu. Vui lòng thử lại.');
  await expect(page.locator('.family-settings-form')).toHaveCount(0);
  observations.push(...await capture(page, info, 'family-read-error'));
  await page.unroute(url);
  await keyboardClick(page, 'button', 'Thử lại');
  await expect(page.getByRole('button', { name: 'Lưu thói quen', exact: true })).toBeEnabled();
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('read-summary.json'), JSON.stringify({ heldRealGET: true, shaped500: true, keyboardRetry: true, writes, observations }, null, 2));
});

test('offline guest planning settings require login without querying or saving family data', async ({ page }, info) => {
  test.skip(!composition, 'Requires paired composition preview');
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
  const familyRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname === familyPath) familyRequests.push(request.method()); });
  const writes = monitor(page);
  await navigate(page, settingsPath);
  await expect(page.getByText('Đăng nhập để lưu thói quen cho gia đình.', { exact: false })).toBeVisible();
  await expect(page.locator('.family-settings-form')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Đăng nhập', exact: true })).toHaveAttribute('href', '/auth?mode=login&returnTo=%2Fsettings%2Fplanning');
  const observations = await capture(page, info, 'offline-guest');
  expect(familyRequests).toEqual([]);
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('guest-summary.json'), JSON.stringify({ actualOfflineFallback: true, loginReturnPath: settingsPath, familyRequests, writes, observations }, null, 2));
});

test('composition-off settings retain legacy Week preferences and do not create a plan', async ({ page }, info) => {
  test.skip(composition, 'Requires actual composition-off preview');
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const before = { week: await getJson<{ preferences: Record<string, unknown> }>(page, '/api/v1/week/preferences'),
    family: await family(page), inventory: await getJson(page, '/api/v1/inventory'),
    shopping: await getJson(page, '/api/v1/shopping-list'), current: await getJson(page, '/api/v1/meal-planning/plans/current'),
  };
  const writes = monitor(page);
  await page.goto(settingsPath);
  await expect(page.getByRole('heading', { name: 'Cài đặt lập thực đơn', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu cài đặt', exact: true })).toBeEnabled();
  await keyboardClick(page, 'button', '1tr VND');
  await keyboardClick(page, 'button', '2 lần / tuần');
  await keyboardClick(page, 'button', 'Lưu cài đặt');
  await expect(page.getByRole('status')).toContainText('Đã lưu');
  await page.reload();
  await expect(page.getByRole('button', { name: '1tr VND', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '2 lần / tuần', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const preferences = await getJson(page, '/api/v1/week/preferences');
  const expected = { ...before.week.preferences, budgetTargetVnd: 1000000, shoppingFrequency: 'twice' };
  expect(preferences).toEqual({ preferences: expected });
  const observations = await capture(page, info, 'legacy-week-reload');
  expect(writes).toEqual([{ method: 'PATCH', path: '/api/v1/week/preferences', body: expected }]);
  expect(await family(page)).toEqual(before.family);
  expect(await getJson(page, '/api/v1/inventory')).toEqual(before.inventory);
  expect(await getJson(page, '/api/v1/shopping-list')).toEqual(before.shopping);
  expect(await getJson(page, '/api/v1/meal-planning/plans/current')).toEqual(before.current);
  await writeFile(info.outputPath('legacy-summary.json'), JSON.stringify({ actualCompositionOff: true, realWeekPATCHReload: true,
    familyStockShoppingCurrentPlanUnchanged: true, writes, preferences, observations,
  }, null, 2));
});
