import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, reset, getJson } from '../t13b/fixtures';

const viewports = [[320, 568, 1], [320, 420, 2], [320, 568, 2], [360, 800, 1], [390, 844, 1], [430, 932, 1], [768, 1024, 1], [1024, 768, 1], [1440, 900, 1]] as const;
const compact = [viewports[1], viewports[4], viewports[8]];

async function inspect(page: Page, info: TestInfo, state: string, configs: readonly (readonly [number, number, number])[] = viewports, modal = false) {
  const observations = [];
  for (const [width, height, scale] of configs) {
    await page.setViewportSize({ width, height });
    await page.evaluate((value) => { document.documentElement.style.fontSize = `${value * 100}%`; }, scale);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const metrics = await page.evaluate(() => ({
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      brokenImages: [...document.images].filter((image) => image.complete && !image.naturalWidth).map((image) => new URL(image.src).pathname),
      links: [...document.querySelectorAll<HTMLAnchorElement>('.account-nav-link')].map((link) => ({
        href: link.getAttribute('href'),
        clientWidth: link.clientWidth,
        scrollWidth: link.scrollWidth,
      })),
    }));
    expect.soft(metrics.innerWidth, `${state}-${width}: viewport`).toBe(width);
    expect.soft(metrics.scrollWidth, `${state}-${width}: document overflow`).toBeLessThanOrEqual(width);
    expect.soft(metrics.brokenImages, `${state}-${width}: broken images`).toEqual([]);
    for (const link of metrics.links) expect.soft(link.scrollWidth, `${state}-${width}: clipped link`).toBeLessThanOrEqual(link.clientWidth + 1);
    const controls = [];
    for (const link of await page.locator(modal ? '[role=alertdialog] button' : '.account-nav-link').all()) {
      await link.scrollIntoViewIfNeeded();
      const box = await link.boundingBox();
      expect.soft(box, `${state}-${width}: link geometry`).not.toBeNull();
      if (box) {
        expect.soft(box.height, `${state}-${width}: control height`).toBeGreaterThanOrEqual(48);
        expect.soft(box.x, `${state}-${width}: link left`).toBeGreaterThanOrEqual(-1);
        expect.soft(box.x + box.width, `${state}-${width}: link right`).toBeLessThanOrEqual(width + 1);
      }
      await link.click({ trial: true });
      controls.push({ box, actionable: true });
      await link.focus();
      expect.soft(await link.evaluate((element) => document.activeElement === element), `${state}-${width}: link focus`).toBe(true);
    }
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect.soft(axe.violations.map(({ id }) => id), `${state}-${width}: axe`).toEqual([]);
    await writeFile(info.outputPath(`axe-${state}-${width}x${height}-text${scale}.json`), JSON.stringify({
      state, viewport: { width, height }, textScale: scale, violations: axe.violations,
      incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })), metrics,
    }, null, 2));
    if (!modal) await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath(`${state}-${width}x${height}-text${scale}.png`), fullPage: true, animations: 'disabled' });
    observations.push({ state, viewport: { width, height }, textScale: scale, metrics, controls });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
  return observations;
}

test('profile preserves account identity, protected Plus target and account navigation', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const before = { inventory: await getJson(page, '/api/v1/inventory'), shopping: await getJson(page, '/api/v1/shopping-list') };
  const writes: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${path}`);
  });
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/me$/);
  const { user } = await getJson<{ user: { displayName: string; email: string } }>(page, '/api/v1/me');
  await expect(page.locator('.account-profile h2')).toHaveText(user.displayName);
  await expect(page.locator('.account-email')).toHaveText(user.email);
  const observations = await inspect(page, info, 'registered-real', compact);
  await page.evaluate(() => {
    localStorage.setItem('frigo_display_name', 'Người dùng có tên rất dài cần được xuống dòng đúng cách '.repeat(4));
    localStorage.setItem('frigo_email', 'very.long.account+profile-check@example.test');
  });
  await page.reload();
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: 'Hồ sơ', level: 1 })).toBeVisible();
  await expect(page.getByText(/Người dùng có tên rất dài cần được/)).toBeVisible();
  await expect(page.getByText('very.long.account+profile-check@example.test', { exact: true })).toBeVisible();
  const plus = page.getByRole('link', { name: 'Nâng cấp', exact: true });
  await expect(plus).toHaveAttribute('href', '/plus');
  await plus.focus();
  await plus.click({ trial: true });
  observations.push(...await inspect(page, info, 'registered-long-identity'));
  for (const [path, heading] of [
    ['/me/preferences', 'Sở thích & hạn chế'], ['/me/household', 'Hộ gia đình & chia sẻ'],
    ['/settings/planning', 'Thói quen bữa nhà'], ['/settings/notifications', 'Tùy chỉnh thông báo'],
    ['/settings/app', 'Cài đặt ứng dụng'], ['/settings/privacy', 'Quyền riêng tư & dữ liệu'],
  ]) {
    const link = page.locator(`.account-nav-link[href="${path}"]`);
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: heading, exact: true, level: 1 })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Hồ sơ', exact: true, level: 1 })).toBeVisible();
  }
  const signOut = page.getByRole('button', { name: 'Đăng xuất khỏi tài khoản', exact: true });
  await signOut.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Đăng xuất tài khoản?' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Hủy', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Hủy', exact: true })).toBeFocused();
  observations.push(...await inspect(page, info, 'logout-dialog', compact, true));
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(signOut).toBeFocused();
  expect({ inventory: await getJson(page, '/api/v1/inventory'), shopping: await getJson(page, '/api/v1/shopping-list') }).toEqual(before);
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('profile-summary.json'), JSON.stringify({
    source: 'registered-isolated-local-session', plusHref: await plus.getAttribute('href'),
    paymentActionInvoked: false, cachedLongIdentityShaping: true, logoutCancelAndEscapeFocus: true, sixKeyboardDestinations: true,
    inventoryAndShoppingUnchanged: true, writes,
    observations,
  }, null, 2));
});

test('real guest profile retains upgrade return and logout cancellation without writes', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/landing');
  await page.getByRole('button', { name: 'Dùng thử Takolio ngay', exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/household$/);
  const writes: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${path}`);
  });
  await page.goto('/me');
  await expect(page.getByText('Phiên dùng thử', { exact: true })).toBeVisible();
  await expect(page.getByText('Chưa liên kết email', { exact: true })).toBeVisible();
  const plus = page.getByRole('link', { name: 'Đăng nhập để nâng cấp', exact: true });
  await expect(plus).toHaveAttribute('href', '/auth?mode=login&returnTo=%2Fplus');
  const observations = await inspect(page, info, 'guest-real', compact);
  const trigger = page.getByRole('button', { name: 'Đăng xuất khỏi tài khoản', exact: true });
  await trigger.focus();
  await page.keyboard.press('Space');
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: 'Hủy', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('guest-summary.json'), JSON.stringify({ realGuestSession: true,
    guestLabel: true, emailFallback: true, plusHref: await plus.getAttribute('href'),
    paymentActionInvoked: false, logoutCancelledWithKeyboard: true, writes, observations,
  }, null, 2));
});

test('profile waits for actual session verification and retries a failed check', async ({ page }, info) => {
  test.setTimeout(120_000);
  await reset(page);
  const url = new URL('/api/v1/me', page.url()).href;
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(url, async route => { await gate; await route.continue(); });
  const observations = [];
  try {
    await page.goto('/me');
    await expect(page.getByRole('heading', { name: 'Đang kiểm tra phiên…', exact: true })).toBeVisible();
    await expect(page.locator('.account-profile')).toHaveCount(0);
    observations.push(...await inspect(page, info, 'session-loading', compact));
  } finally { release(); }
  await expect(page.getByRole('heading', { name: 'Hồ sơ', exact: true })).toBeVisible();
  await page.unroute(url);
  await page.route(url, route => route.fulfill({ status: 500, json: { error: 'synthetic-unavailable' } }));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Chưa xác minh được phiên', exact: true })).toBeVisible();
  await expect(page.locator('.account-profile')).toHaveCount(0);
  observations.push(...await inspect(page, info, 'session-error', compact));
  await page.unroute(url);
  await page.getByRole('button', { name: 'Thử lại', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Hồ sơ', exact: true })).toBeVisible();
  await writeFile(info.outputPath('session-summary.json'), JSON.stringify({ heldRealSessionCheck: true,
    synthetic500OnSessionRead: true, privateProfileHiddenBeforeVerification: true, keyboardRetryRecoveredRealApi: true, observations,
  }, null, 2));
});
