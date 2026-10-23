import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, reset, getJson } from '../t13b/fixtures';

const privacyPath = '/settings/privacy';
const configs = [[320, 568, 1], [320, 420, 2], [390, 844, 1], [1440, 900, 1]] as const;
const heading = 'Quyền riêng tư & dữ liệu';
type ProbeWindow = Window & { __privacyPermissionRequests: number };

function monitor(page: Page) {
  const writes: string[] = [];
  const downloads: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${path}`);
  });
  page.on('download', download => downloads.push(download.suggestedFilename()));
  return { writes, downloads };
}
async function boundary(page: Page) {
  const me = await getJson<{ user: { onboardingCompleted: boolean } }>(page, '/api/v1/me');
  return { inventory: await getJson(page, '/api/v1/inventory'), shopping: await getJson(page, '/api/v1/shopping-list'),
    family: await getJson(page, '/api/v1/family-preferences'), current: await getJson(page, '/api/v1/meal-planning/plans/current'),
    onboardingCompleted: me.user.onboardingCompleted };
}
async function disclosures(page: Page) {
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await expect(page.getByText(/Ảnh có thể chứa thông tin cá nhân/)).toBeVisible();
  await expect(page.getByText(/Kết quả nhận diện cần được bạn kiểm tra/)).toBeVisible();
  await expect(page.getByText(/các hộ khác không nhìn thấy tủ hoặc thực đơn của bạn/)).toBeVisible();
  await expect(page.getByText('Xuất dữ liệu — chưa hỗ trợ', { exact: true })).toBeVisible();
  await expect(page.getByText('Xóa tài khoản — chưa hỗ trợ', { exact: true })).toBeVisible();
  await expect(page.getByText(/Đăng xuất chỉ kết thúc phiên trên thiết bị, không xóa tài khoản/)).toBeVisible();
  await expect(page.locator('.account-body').locator('button, input, select, textarea, a, [role="button"]')).toHaveCount(0);
}
async function keyboardLink(page: Page, label: string, path: string, exact = true) {
  const link = page.getByRole('link', { name: label, exact });
  await expect(link).toHaveAttribute('href', path);
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}
async function capture(page: Page, info: TestInfo, state: string) {
  const observations = [];
  for (const [width, height, scale] of configs) {
    await page.setViewportSize({ width, height });
    await page.evaluate(value => { document.documentElement.style.fontSize = `${value * 100}%`; }, scale);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const metrics = await page.evaluate(() => {
      const body = document.querySelector('.account-body')!;
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      const textOutsideViewport: string[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        if ([...range.getClientRects()].some(rect => rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1))) {
          textOutsideViewport.push(node.textContent.trim());
        }
      }
      return { innerWidth, scrollWidth: document.documentElement.scrollWidth, textOutsideViewport,
        brokenImages: [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => new URL(image.src).pathname) };
    });
    expect.soft(metrics.innerWidth, `${state}: requested width`).toBe(width);
    expect.soft(metrics.scrollWidth, `${state}-${width}-text${scale}: overflow`).toBeLessThanOrEqual(width);
    expect.soft(metrics.textOutsideViewport, `${state}: readable text`).toEqual([]);
    expect.soft(metrics.brokenImages, `${state}: assets`).toEqual([]);
    const back = page.getByRole('link', { name: 'Quay lại', exact: true });
    await back.scrollIntoViewIfNeeded();
    await back.click({ trial: true });
    const box = await back.boundingBox();
    const backFits = !!box && box.width >= 44 && box.height >= 44 && box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1;
    expect.soft(backFits, `${state}: actionable back target`).toBe(true);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect.soft(axe.violations.map(({ id }) => id), `${state}: axe`).toEqual([]);
    const observation = { state, viewport: { width, height }, textScale: scale, metrics, backTarget: { box, fits: backFits } };
    await writeFile(info.outputPath(`axe-${state}-${width}x${height}-text${scale}.json`), JSON.stringify({
      ...observation, violations: axe.violations, incomplete: axe.incomplete.map(({ id, impact }) => ({ id, impact })),
    }, null, 2));
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: info.outputPath(`${state}-${width}x${height}-text${scale}.png`), fullPage: true, animations: 'disabled' });
    observations.push(observation);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
  return observations;
}

test('privacy entry and keyboard return disclose real limits without changing household data', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const before = await boundary(page);
  const activity = monitor(page);
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: 'Hồ sơ', exact: true })).toBeVisible();
  await keyboardLink(page, 'Quyền riêng tư & dữ liệu Dữ liệu đã lưu, AI và quyền trình duyệt', privacyPath);
  await disclosures(page);
  const nativePermission = await page.evaluate(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const observations = await capture(page, info, 'native');
  await keyboardLink(page, 'Quay lại', '/me');
  await expect(page.getByRole('heading', { name: 'Hồ sơ', exact: true })).toBeVisible();
  await page.goto('/settings/app');
  await keyboardLink(page, 'Xem quyền riêng tư & dữ liệu', privacyPath);
  await disclosures(page);
  await page.reload();
  await disclosures(page);
  await keyboardLink(page, 'Quay lại', '/me');
  await expect(page.getByRole('heading', { name: 'Hồ sơ', exact: true })).toBeVisible();
  expect(await boundary(page)).toEqual(before);
  expect(activity).toEqual({ writes: [], downloads: [] });
  await writeFile(info.outputPath('entry-summary.json'), JSON.stringify({ profileKeyboardEntry: true, settingsKeyboardEntry: true,
    keyboardReturn: true, realReload: true, nativePermission, noFakeExportOrDeleteControls: true, serverBoundariesUnchanged: true, ...activity, observations }, null, 2));
});

test('browser permission states remain descriptive and never request permission or export/delete', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  const before = await boundary(page);
  const activity = monitor(page);
  const states = [
    ['granted', 'đã cho phép'], ['denied', 'đã chặn'], ['default', 'chưa được yêu cầu'],
    ['unsupported', 'trình duyệt không hỗ trợ'], ['unexpected', 'không xác định'],
  ] as const;
  await page.addInitScript(() => {
    const permission = sessionStorage.getItem('__privacy_test_permission');
    const probe = window as unknown as ProbeWindow;
    probe.__privacyPermissionRequests = 0;
    Object.defineProperty(window, 'Notification', { configurable: true, value: permission === 'unsupported' ? undefined : {
      permission, requestPermission: () => { probe.__privacyPermissionRequests += 1; throw new Error('Unexpected notification permission request'); },
    } });
  });
  const observations = [];
  for (const [permission, label] of states) {
    await page.evaluate(value => sessionStorage.setItem('__privacy_test_permission', value), permission);
    await page.goto(privacyPath);
    await disclosures(page);
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByText(/Takolio không thể tự bật/)).toBeVisible();
    observations.push(...await capture(page, info, `permission-${permission}`));
    expect(await page.evaluate(() => (window as unknown as ProbeWindow).__privacyPermissionRequests)).toBe(0);
  }
  expect(await boundary(page)).toEqual(before);
  expect(activity).toEqual({ writes: [], downloads: [] });
  await writeFile(info.outputPath('permission-summary.json'), JSON.stringify({ simulatedPermissions: states.map(([state]) => state),
    descriptiveOnly: true, noPermissionRequest: true, noFakeExportOrDeleteControls: true, serverBoundariesUnchanged: true, ...activity, observations }, null, 2));
});
