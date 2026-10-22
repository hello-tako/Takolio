import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, reset, control, layout, adopt } from '../t13b/fixtures';

type Page = import('@playwright/test').Page;
type TestInfo = import('@playwright/test').TestInfo;

const surfaces = [
  ['home', '/'], ['inventory', '/fridge'], ['scan', '/scan'],
  ['scan-review', '/scan/t13b-preview-fridge/review'],
  ['receipt-review', '/scan/receipt-review?scanId=t13b-preview-receipt'],
  ['recipes', '/recipes'], ['recipe-detail', '/recipes/canh-chua-ca-loc-nam-bo'],
  ['cook', '/cook/canh-chua-ca-loc-nam-bo'], ['planner', '/planner'],
  ['shopping', '/shopping'], ['notifications', '/notifications'], ['profile', '/me'],
  ['preferences', '/me/preferences'], ['household', '/me/household'],
  ['planning-settings', '/settings/planning'], ['notification-preferences', '/settings/notifications'],
  ['privacy', '/settings/privacy'], ['app-settings', '/settings/app'], ['plus', '/plus'],
] as const;

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator('main, [role="main"], h1').first().waitFor({ state: 'visible' });
  await expect(page.getByText('Đang tải thông báo…', { exact: true })).toHaveCount(0);
  await page.waitForTimeout(450);
  await page.evaluate(() => Promise.all(Array.from(document.images).filter(img => !img.complete).map(img => new Promise<void>(resolve => {
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
    setTimeout(resolve, 1500);
  }))));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
  await writeFile(info.outputPath(`${name}.json`), JSON.stringify({
    route: new URL(page.url()).pathname, viewport: page.viewportSize(),
    h1: await page.locator('h1').allTextContents(),
  }, null, 2));
}

async function completeOnboarding(page: Page, info?: TestInfo) {
  await page.goto('/onboarding/household');
  await expect(page.getByLabel('Bước 1 trên 3')).toBeVisible();
  if (info) await capture(page, info, 'onboarding-household');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/preferences$/);
  if (info) await capture(page, info, 'onboarding-preferences');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/goals$/);
  if (info) await capture(page, info, 'onboarding-goals');
  await page.getByRole('button', { name: /Bắt đầu với Takolio/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Hôm nay ăn gì?', level: 1 })).toBeVisible();
}

// Hold only a local POST; release it to the real isolated API after capturing pending UI.
async function holdLocalPost(page: Page, path: string) {
  const origin = new URL(page.url()).origin;
  let release = () => {};
  let arrived = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const pending = new Promise<void>(resolve => { arrived = resolve; });
  await page.route(url => url.origin === origin && url.pathname === path, async route => {
    if (route.request().method() === 'POST') {
      arrived();
      await gate;
    }
    await route.continue();
  });
  return { pending, release };
}

async function generatePlan(page: Page, info?: TestInfo) {
  await page.goto('/planner/new');
  if (info) await capture(page, info, 'planner-setup');
  const held = info ? await holdLocalPost(page, '/api/v1/meal-planning/plans') : null;
  try {
    await page.getByRole('button', { name: 'Tạo thực đơn', exact: true }).click();
    if (held && info) {
      await expect(page.getByRole('status').filter({ hasText: 'Takolio đang lập kế hoạch từ dữ liệu của bạn…' })).toBeVisible();
      await held.pending;
      await capture(page, info, 'planner-generating');
    }
  } finally {
    held?.release();
  }
  await expect(page).toHaveURL(/\/planner\/(?!new$)[^/]+$/);
  await expect(page.getByTestId('plan-revision')).toHaveText(/^[1-9]\d*$/);
  await expect(page.locator('a[href*="/meal/"]').first()).toBeVisible();
  const planPath = new URL(page.url()).pathname;
  expect(planPath).toMatch(/^\/planner\/[^/]+$/);
  return planPath;
}

test('takeover current surfaces evidence', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/landing');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await capture(page, info, 'landing');
  await page.goto('/auth');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await capture(page, info, 'auth');
  await page.evaluate(() => sessionStorage.setItem('frigo_auth_verify_context', JSON.stringify({ email: 'takeover@example.test', resendAvailableAt: Date.now() + 60_000, expiresAt: Date.now() + 600_000, delivered: true, owner: { userId: '', householdId: '' } })));
  await page.goto('/auth/verify');
  await expect(page.locator('input[inputmode="numeric"]')).toHaveCount(6);
  await capture(page, info, 'otp');
  await reset(page);
  expect((await adopt(page)).code).toBe(0);
  await completeOnboarding(page, info);
  await expect(page.locator('#home-plan-heading')).toContainText('Chưa có thực đơn');
  await capture(page, info, 'home-empty');
  await control(page, 't13-scans');
  const planPath = await generatePlan(page, info);
  const meal = page.locator('a[href*="/meal/"]').first();
  await expect(meal).toBeVisible();
  const mealPath = (await meal.getAttribute('href'))!;
  for (const [name, path] of surfaces) {
    await page.goto(path);
    await expect.poll(() => new URL(page.url()).pathname).toBe(new URL(path, 'http://localhost').pathname);
    await expect(page.getByRole('heading', { level: 1 }), `${name}: h1`).toBeVisible();
    if (name === 'home') await expect(page.locator('.home-plan-summary')).toBeVisible();
    await capture(page, info, name);
    if (['home', 'recipes', 'recipe-detail', 'cook'].includes(name)) await layout(page);
    if (name === 'recipe-detail') {
      await page.getByRole('tab', { name: 'Cách nấu', exact: true }).click();
      await capture(page, info, 'recipe-steps');
    }
    if (name === 'recipes') {
      await page.locator('summary').filter({ hasText: 'Bộ lọc' }).click();
      await expect(page.getByRole('combobox', { name: /^Ẩm thực/ })).toBeVisible();
      await capture(page, info, 'recipe-filters');
    }
  }
  for (const [name, path] of [
    ['ingredient-detail', '/ingredients/preview-stock-egg'],
    ['recipes-saved', '/recipes?view=saved'],
    ['meal-detail', mealPath], ['planner-shopping', `${planPath}/shopping`],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await capture(page, info, name);
  }
  await page.goto('/fridge');
  await page.getByRole('button', { name: 'Thêm nguyên liệu', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Thêm nguyên liệu vào tủ' })).toBeVisible();
  await capture(page, info, 'ingredient-add');
  await page.keyboard.press('Escape');
  await page.goto('/settings/planning');
  await expect(page.getByRole('heading', { name: /^(Thói quen bữa nhà|Cài đặt lập thực đơn)$/, level: 1 })).toBeVisible();
  await page.context().setOffline(true);
  await expect(page.getByText(/chế độ Ngoại tuyến/i)).toBeVisible();
  await capture(page, info, 'offline-banner');
  await page.context().setOffline(false);
});

test('takeover Home narrow viewport text scale and keyboard', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  await completeOnboarding(page);
  await generatePlan(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hôm nay ăn gì?', level: 1 })).toBeVisible();
  await expect(page.locator('.home-plan-summary')).toBeVisible();
  for (const [width, height, textScale] of [[320,568,1],[320,420,2],[360,800,1],[390,844,1],[430,932,1],[768,1024,1],[1024,768,1],[1440,900,1]]) {
    await page.setViewportSize({ width, height });
    await page.addStyleTag({ content: `html { font-size: ${textScale * 100}% !important; }` });
    await capture(page, info, `home-${width}x${height}-text${textScale}`);
    await layout(page);
    const findings = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    expect(findings.violations.map(v => ({ id: v.id, impact: v.impact })), `${width}x${height} text${textScale}: axe`).toEqual([]);
  }
  const action = page.getByRole('link', { name: 'Xem lịch', exact: true });
  await action.focus();
  await expect(action).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(action).toBeFocused();
  const href = await action.getAttribute('href');
  await page.keyboard.press('Enter');
  await expect.poll(() => new URL(page.url()).pathname).toBe(href);
});

test('recipe metadata icons keep their intended size beside recipe media', async ({ page }, info) => {
  await reset(page);
  await page.goto('/recipes');
  await expect(page.getByRole('heading', { name: 'Hôm nay nhà mình nấu gì?', level: 1 })).toBeVisible();
  const icons = page.locator('.kitchen-recipe-card [data-takosan-icon]');
  await expect(icons.first()).toBeVisible();
  await capture(page, info, 'recipe-icon-sizing');
  const sizes = await icons.evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { name: element.getAttribute('data-takosan-icon'), width: rect.width, height: rect.height };
  }));
  await writeFile(info.outputPath('icon-sizes.json'), JSON.stringify(sizes, null, 2));
  for (const size of sizes) {
    expect(size.width, `${size.name}: metadata icon width`).toBeLessThanOrEqual(24);
    expect(size.height, `${size.name}: metadata icon height`).toBeLessThanOrEqual(24);
    expect(size.width, `${size.name}: metadata icon visible`).toBeGreaterThan(0);
  }
});

test('scan upload pending evidence releases to the real isolated API', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset(page);
  await page.goto('/scan');
  await expect(page.getByRole('heading', { name: 'Chụp ảnh, rồi kiểm tra', level: 1 })).toBeVisible();
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 160;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#edf5eb';
    context.fillRect(0, 0, 240, 160);
    context.fillStyle = '#203e2b';
    context.font = '16px sans-serif';
    context.fillText('Synthetic scan fixture', 24, 80);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const held = await holdLocalPost(page, '/api/v1/scans/fridge');
  const response = page.waitForResponse(res => new URL(res.url()).pathname === '/api/v1/scans/fridge' && res.request().method() === 'POST');
  try {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'synthetic-scan.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64'),
    });
    const processing = page.getByTestId('scan-processing-state');
    await expect(processing).toBeVisible();
    await expect(processing.getByRole('status')).toHaveText('Đang gửi ảnh.');
    await expect(page.getByRole('button', { name: 'Chọn ảnh khác', exact: true })).toBeDisabled();
    await held.pending;
    await capture(page, info, 'scan-processing');
    await layout(page);
  } finally {
    held.release();
  }
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/scan\/[^/]+\/review$/);
  await expect(page.getByTestId('scan-processing-state')).toHaveCount(0);
  await capture(page, info, 'scan-after-upload');
});
