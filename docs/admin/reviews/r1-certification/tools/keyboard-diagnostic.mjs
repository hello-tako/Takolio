import { chromium } from '@playwright/test';  // resolves from the repository root node_modules
const base = 'http://127.0.0.1:8795';
const browser = await chromium.launch();
const out = [];
for (let run = 0; run < 5; run += 1) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/admin/login`);
  await page.getByTestId('admin-login-email').fill('super@fixture.takosan.test');
  await page.getByTestId('admin-login-password').fill('Local-Fixture-Only-2026!');
  await page.getByTestId('admin-login-submit').click();
  await page.waitForURL((u) => !u.pathname.includes('/login'));
  await page.goto(`${base}/admin/settings`);
  await page.waitForLoadState('networkidle');
  const region = page.getByRole('region', { name: 'Ma trận quyền theo vai trò' });
  await region.scrollIntoViewIfNeeded();
  await region.focus();
  const behavior = await region.evaluate((el) => getComputedStyle(el).scrollBehavior + '/' + getComputedStyle(document.documentElement).scrollBehavior);
  const samples = [];
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  for (const ms of [0, 50, 150, 400, 1000]) { if (ms) await page.waitForTimeout(ms === 50 ? 50 : ms - [0, 50, 150, 400][[50, 150, 400, 1000].indexOf(ms)]); samples.push([ms, await region.evaluate((el) => el.scrollLeft)]); }
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  out.push({ run, behavior, focused, samples });
  await page.close();
  await page.context().close().catch(() => {});
  await fetch(`${base}/__admin-preview/reset`, { method: 'POST' });
}
console.log(JSON.stringify(out));
await browser.close();
