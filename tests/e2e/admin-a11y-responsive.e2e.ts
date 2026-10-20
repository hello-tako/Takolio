import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

// Accessibility and responsive regression for every admin screen (synthetic local fixture).
const PASSWORD = 'Local-Fixture-Only-2026!';
const OUT = '.hoplite/artifacts/admin-e2e/a11y';
mkdirSync(`${OUT}/screens`, { recursive: true });

const SCREENS: Array<[string, string]> = [
  ['overview', '/admin/'], ['users', '/admin/users'], ['user-detail', '/admin/users/fx_user_001'], ['households', '/admin/households'],
  ['billing', '/admin/billing'], ['ai', '/admin/ai'], ['recipes', '/admin/recipes'], ['system', '/admin/system'], ['audit', '/admin/audit'], ['settings', '/admin/settings'],
];
const VIEWPORTS = [{ name: '1440', width: 1440, height: 900 }, { name: '820', width: 820, height: 1180 }, { name: '390', width: 390, height: 844 }, { name: '320', width: 320, height: 844 }];

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByTestId('admin-login-email').fill('super@fixture.takosan.test');
  await page.getByTestId('admin-login-password').fill(PASSWORD);
  await page.getByTestId('admin-login-submit').click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('admin-page-title').first()).toBeVisible();
  await expect(page.locator('.skeleton, [aria-busy="true"]')).toHaveCount(0);
}

test.beforeEach(async ({ request }) => {
  expect((await request.post('/__admin-preview/reset')).status()).toBe(204);
});

test('no serious or critical axe violations on the sign-in screen and every admin screen', async ({ page }) => {
  const report: Record<string, unknown> = {};
  await page.goto('/admin/login');
  await expect(page.getByTestId('admin-login-email')).toBeVisible();
  const loginScan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  report.login = loginScan.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  await login(page);
  const blocking: string[] = [];
  for (const [name, path] of SCREENS) {
    await page.goto(path);
    await settle(page);
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    report[name] = scan.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    for (const v of scan.violations) if (v.impact === 'serious' || v.impact === 'critical') blocking.push(`${name}: ${v.id} (${v.nodes.length})`);
  }
  for (const v of loginScan.violations) if (v.impact === 'serious' || v.impact === 'critical') blocking.push(`login: ${v.id}`);
  writeFileSync(`${OUT}/axe-report.json`, `${JSON.stringify(report, null, 2)}\n`);
  expect(blocking).toEqual([]);
});

for (const viewport of VIEWPORTS) {
  test(`no horizontal page overflow at ${viewport.name}px on any screen`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await login(page);
    const overflow: Record<string, number> = {};
    const accessibility: Record<string, string[]> = {};
    for (const [name, path] of SCREENS) {
      await page.goto(path);
      await settle(page);
      overflow[name] = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      accessibility[name] = scan.violations.map((violation) => violation.id);
      await page.screenshot({ path: `${OUT}/screens/${viewport.name}-${name}.png`, fullPage: true });
    }
    writeFileSync(`${OUT}/overflow-${viewport.name}.json`, `${JSON.stringify(overflow, null, 2)}\n`);
    writeFileSync(`${OUT}/axe-${viewport.name}.json`, `${JSON.stringify(accessibility, null, 2)}\n`);
    expect(Object.entries(overflow).filter(([, px]) => px > 0)).toEqual([]);
    expect(Object.entries(accessibility).filter(([, violations]) => violations.length > 0)).toEqual([]);
  });
}

test('scrollable tables are reachable and scrollable with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/admin/settings');
  await settle(page);
  const region = page.getByRole('region', { name: 'Ma trận quyền theo vai trò' });
  await expect(region).toHaveAttribute('tabindex', '0');
  await region.scrollIntoViewIfNeeded();
  await region.focus();
  await expect(region).toBeFocused();
  expect(await region.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const before = await region.evaluate((el) => el.scrollLeft);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before);
});
