import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, reset, getJson } from '../t13b/fixtures';

const viewports = [[320, 568, 1], [320, 420, 2], [390, 844, 1], [1440, 900, 1]] as const;

async function inspectFamily(page: Page, info: TestInfo, state: string) {
  const observations = [];
  for (const [width, height, scale] of viewports) {
    await page.setViewportSize({ width, height });
    await page.evaluate((value) => {
      document.documentElement.style.fontSize = `${value * 100}%`;
    }, scale);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

    const metrics = await page.evaluate(() => {
      const membership = document.querySelector<HTMLElement>('.family-membership-copy');
      const householdId = document.querySelector<HTMLElement>('.family-household-id');
      return {
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        brokenImages: [...document.images]
          .filter((image) => image.complete && !image.naturalWidth)
          .map((image) => new URL(image.src).pathname),
        membership: membership
          ? {
              clientWidth: membership.clientWidth,
              scrollWidth: membership.scrollWidth,
              text: membership.textContent,
            }
          : null,
        householdId: householdId
          ? {
              clientWidth: householdId.clientWidth,
              scrollWidth: householdId.scrollWidth,
              text: householdId.textContent,
            }
          : null,
        bodyLinks: [...document.querySelectorAll('.account-body a')].length,
        bodyButtons: [...document.querySelectorAll('.account-body button')].length,
      };
    });

    expect.soft(metrics.innerWidth, `${state}-${width}: viewport`).toBe(width);
    expect.soft(metrics.scrollWidth, `${state}-${width}: document overflow`).toBeLessThanOrEqual(width);
    expect.soft(metrics.brokenImages, `${state}-${width}: broken images`).toEqual([]);
    expect.soft(metrics.membership, `${state}-${width}: membership copy exists`).not.toBeNull();
    expect.soft(metrics.householdId, `${state}-${width}: household id exists`).not.toBeNull();
    if (metrics.membership) {
      expect.soft(metrics.membership.scrollWidth, `${state}-${width}: membership copy overflow`)
        .toBeLessThanOrEqual(metrics.membership.clientWidth + 1);
    }
    if (metrics.householdId) {
      expect.soft(metrics.householdId.scrollWidth, `${state}-${width}: household id overflow`)
        .toBeLessThanOrEqual(metrics.householdId.clientWidth + 1);
    }
    expect.soft(metrics.bodyLinks, `${state}-${width}: no fabricated body links`).toBe(0);
    expect.soft(metrics.bodyButtons, `${state}-${width}: no fabricated body buttons`).toBe(0);

    const notes = await page.locator('.account-body [role="note"]').count();
    expect.soft(notes, `${state}-${width}: three honest unavailable notes`).toBe(3);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect.soft(axe.violations.map(({ id }) => id), `${state}-${width}: axe`).toEqual([]);
    await writeFile(
      info.outputPath(`axe-${state}-${width}x${height}-text${scale}.json`),
      JSON.stringify({
        state,
        viewport: { width, height },
        textScale: scale,
        violations: axe.violations,
        incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })),
        metrics,
      }, null, 2),
    );
    await page.screenshot({
      path: info.outputPath(`${state}-${width}x${height}-text${scale}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    observations.push({ viewport: { width, height }, textScale: scale, metrics });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '100%';
  });
  return observations;
}

async function assertFamilySurface(page: Page, expectedHouseholdId: string) {
  await expect(page).toHaveURL(/\/me\/household$/);
  await expect(page.getByRole('heading', { name: 'Hộ gia đình & chia sẻ', exact: true })).toBeVisible();
  await expect(page.getByText(`Mã hộ: ${expectedHouseholdId}`, { exact: true })).toBeVisible();
  await expect(page.getByText('Hộ của bạn', { exact: true })).toBeVisible();
  await expect(page.locator('.account-body [role="note"]')).toHaveCount(3);
  for (const title of [
    'Mời thành viên — chưa hỗ trợ',
    'Tham gia hộ khác — chưa hỗ trợ',
    'Danh sách thành viên — chưa hỗ trợ',
  ]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /Mời|Tham gia|Thành viên/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Mời|Tham gia|Thành viên/ })).toHaveCount(0);
}

test('registered household surface stays server-scoped and honestly unavailable', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const me = await getJson<{ user: { id: string; household: { id: string } } }>(page, '/api/v1/me');
  const cachedHouseholdId = await page.evaluate(() => localStorage.getItem('frigo_household_id'));
  expect(cachedHouseholdId).toBe(me.user.household.id);
  const before = {
    inventory: await getJson(page, '/api/v1/inventory'),
    shopping: await getJson(page, '/api/v1/shopping-list'),
  };
  const writes: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(`${request.method()} ${path}`);
    }
  });

  await page.goto('/family');
  await assertFamilySurface(page, me.user.household.id);
  const observations = await inspectFamily(page, info, 'registered-real');

  const back = page.getByRole('link', { name: 'Quay lại', exact: true });
  await back.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole('heading', { name: 'Hồ sơ', exact: true })).toBeVisible();
  await page.goBack();
  await assertFamilySurface(page, me.user.household.id);
  expect({ inventory: await getJson(page, '/api/v1/inventory'), shopping: await getJson(page, '/api/v1/shopping-list') }).toEqual(before);
  expect(writes).toEqual([]);

  await writeFile(
    info.outputPath('registered-summary.json'),
    JSON.stringify({
      routeAlias: '/family -> /me/household',
      serverHouseholdId: me.user.household.id,
      cachedHouseholdId,
      honestUnavailableNotes: 3,
      fabricatedInviteJoinMemberControls: false,
      keyboardBackAndReturn: true,
      inventoryAndShoppingUnchanged: true,
      writes,
      observations,
    }, null, 2),
  );
});

test('long cached household identity wraps without changing server authority', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const me = await getJson<{ user: { household: { id: string } } }>(page, '/api/v1/me');
  const longName = 'TênThànhViênĐượcLưuCụcBộ'.repeat(12);
  await page.evaluate((value) => localStorage.setItem('frigo_display_name', value), longName);
  await page.goto('/me/household');
  await assertFamilySurface(page, me.user.household.id);
  await expect(page.getByText(longName, { exact: false })).toBeVisible();
  const observations = await inspectFamily(page, info, 'long-cached-display-name');
  const inventory = await getJson(page, '/api/v1/inventory');
  const shopping = await getJson(page, '/api/v1/shopping-list');
  expect(await page.evaluate(() => localStorage.getItem('frigo_household_id'))).toBe(me.user.household.id);
  await writeFile(
    info.outputPath('long-name-summary.json'),
    JSON.stringify({
      cachedDisplayNameShaped: true,
      serverHouseholdId: me.user.household.id,
      localHouseholdIdRemainedServerScoped: true,
      inventoryAndShoppingReadAfter: { inventory, shopping },
      observations,
    }, null, 2),
  );
});

test('guest household surface keeps the same server-authorized boundary', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/landing');
  await page.getByRole('button', { name: 'Dùng thử Takolio ngay', exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/household$/);
  const writes: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(`${request.method()} ${path}`);
    }
  });
  const me = await getJson<{ user: { isGuest: boolean; household: { id: string } } }>(page, '/api/v1/me');
  expect(me.user.isGuest).toBe(true);
  await page.goto('/me/household');
  await assertFamilySurface(page, me.user.household.id);
  const observations = await inspectFamily(page, info, 'guest-real');
  expect(await page.evaluate(() => localStorage.getItem('frigo_household_id'))).toBe(me.user.household.id);
  expect(writes).toEqual([]);
  await writeFile(
    info.outputPath('guest-summary.json'),
    JSON.stringify({
      realGuestSession: true,
      serverHouseholdId: me.user.household.id,
      honestUnavailableNotes: 3,
      writes,
      observations,
    }, null, 2),
  );
});

