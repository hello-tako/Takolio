import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const app = process.env.TAKOLIO_SW_APP_URL ?? 'http://127.0.0.1:3334';
const api = process.env.TAKOLIO_SW_API_URL ?? 'http://127.0.0.1:8934';
for (const origin of [app, api]) {
  const url = new URL(origin);
  assert.equal(url.protocol, 'http:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.origin, origin, 'Only exact local preview origins are allowed');
}
const sha = process.env.TAKOLIO_SW_EXPECTED_SHA;
assert.match(sha ?? '', /^[a-f0-9]{40}$/, 'Set TAKOLIO_SW_EXPECTED_SHA to the production build commit');
const out = resolve(process.env.TAKOLIO_SW_OUT ?? '.artifacts/recipe-v3/cooking-pwa');
await mkdir(out, { recursive: true });
const result = { status: 'FAIL', sha, localSyntheticApi: true, serviceWorkers: 'allow',
  hostedRecoveryCertified: false, checks: [], errors: [] };
const browser = await chromium.launch();
const context = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.on('pageerror', error => result.errors.push(error.message));
const queue = () => page.evaluate(() => JSON.parse(localStorage.getItem('frigo_sync_outbox_v1') ?? '[]'));
const control = async path => {
  const response = await context.request.post(`${api}/__preview/${path}`, {
    headers: { Origin: api, Accept: 'application/json' },
  });
  assert.equal(response.status(), 200);
  return response.json();
};
try {
  assert.equal((await control('reset')).fixture, 't19-planner-v2');
  await context.route(url => ![new URL(app).origin, new URL(api).origin].includes(url.origin), route => route.abort());
  await page.goto(app);
  // Mirror the existing preview bootstrap, using only the cookie-verified identity.
  const user = await page.evaluate(async () => {
    const response = await fetch('/api/v1/me', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Preview session verification failed: ${response.status}`);
    return (await response.json()).user;
  });
  assert.equal(user.isGuest, false);
  assert.equal(user.id, 'planner-preview-user');
  assert.equal(user.household.id, 'planner-preview-household');
  await page.evaluate(user => {
    for (const [key, value] of Object.entries({ frigo_user_id: user.id, frigo_household_id: user.household.id,
      frigo_email: user.email, frigo_display_name: user.displayName, frigo_is_guest: 'false',
      frigo_onboarded: String(user.onboardingCompleted) })) localStorage.setItem(key, value);
  }, user);
  const slug = 'tomato-egg-stir-fry';
  await page.goto(`${app}/cook/${slug}?servings=4`);
  await expect(page.locator('.cooking-stage')).toBeVisible();
  const pin = await page.evaluate(async slug => {
    const response = await fetch(`/api/v1/recipes/${slug}`);
    if (!response.ok) throw new Error(`Recipe selection failed: ${response.status}`);
    return (await response.json()).contentFingerprint;
  }, slug);
  assert.match(pin, /^[a-f0-9]{64}$/);
  const target = `${app}/cook/${slug}?servings=4&contentFingerprint=${pin}`;
  await page.goto(target);
  await expect(page.locator('.cooking-header-sub')).toContainText('4 người');
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(`${app}/sw.js?v=${sha}`);
  const before = await control('state');
  const next = page.getByRole('button', { name: 'Bước tiếp theo', exact: true });
  while (await next.isVisible()) await next.click();
  await page.getByRole('button', { name: 'Hoàn thành nấu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Món ăn hoàn tất', exact: true })).toBeVisible();
  for (const input of await page.locator('.cooking-use-controls input').all()) await input.fill('0');
  await page.getByRole('spinbutton', { name: 'Lượng đã dùng: Trứng gà', exact: true }).fill('1');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Xác nhận & Cập nhật tủ lạnh', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đã lưu trên thiết bị', exact: true })).toBeVisible();
  const original = await queue();
  assert.equal(original.length, 1);
  assert.equal(original[0].userId, user.id);
  assert.equal(original[0].householdId, user.household.id);
  const command = JSON.parse(original[0].body);
  assert.equal(command.contentFingerprint, pin);
  assert.equal(command.servings, 4);
  assert.equal(original[0].headers['Idempotency-Key'], command.commandId);
  assert.deepEqual(await control('state'), before);
  result.checks.push('offline cooking persists the exact owned pin, servings, deductions and command key');
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Chưa xác minh được phiên', exact: true })).toBeVisible();
  assert.equal(page.url(), target);
  assert.deepEqual(await queue(), original);
  await expect(page.locator('.cooking-stage')).toHaveCount(0);
  const cached = await page.evaluate(async () => {
    const keys = (await caches.keys()).filter(key => key.startsWith('takosan-pwa-'));
    return Promise.all(keys.map(async name => ({ name,
      paths: (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname) })));
  });
  assert.deepEqual(cached.map(cache => cache.name), [`takosan-pwa-${sha}`]);
  assert(cached[0].paths.some(path => path.startsWith('/assets/') && path.endsWith('.js')));
  assert(!cached[0].paths.some(path => path.startsWith('/api/')), 'Private API responses must not enter the service-worker cache');
  result.checks.push('real offline navigation and reload retain the URL and outbox behind session verification');
  result.checks.push('release cache contains compiled assets and no private API responses');
  await page.screenshot({ path: resolve(out, 'offline-session-boundary.png'), fullPage: true });
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.locator('.cooking-header-sub')).toContainText('4 người');
  assert.equal(page.url(), target);
  await expect.poll(queue).toEqual([]);
  const after = await control('state');
  assert.equal(after.cookedMealCount, before.cookedMealCount + 1);
  assert.equal(after.inventoryEventCount, before.inventoryEventCount + 1);
  assert.deepEqual(after.inventory, before.inventory.map(lot => lot.id === 'preview-stock-egg'
    ? { ...lot, quantity: lot.quantity - 1, version: lot.version + 1 } : lot));
  const replay = await page.evaluate(async operation => {
    const response = await fetch(`/api/v1${operation.path}`, { method: operation.method, body: operation.body,
      headers: { 'Content-Type': 'application/json', ...operation.headers,
        'X-Frigo-Expected-User-Id': operation.userId, 'X-Frigo-Expected-Household-Id': operation.householdId } });
    return { status: response.status, body: await response.json() };
  }, original[0]);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.idempotentReplay, true);
  assert.deepEqual(await control('state'), after);
  result.checks.push('reconnection and exact duplicate replay debit one egg and create one cooking receipt');
  await page.screenshot({ path: resolve(out, 'reconnected-pinned-cooking.png'), fullPage: true });
  await page.goto(`${app}/cook/${slug}?servings=4&contentFingerprint=${'0'.repeat(64)}`);
  await expect(page.locator('.cooking-empty [role="alert"]')).toBeVisible();
  await expect(page.locator('.cooking-stage')).toHaveCount(0);
  assert.deepEqual(await control('state'), after);
  result.checks.push('an unavailable content pin does not substitute the current recipe');
  assert.deepEqual(result.errors, []);
  result.status = 'PASS';
} catch (error) {
  result.failure = String(error);
  await page.screenshot({ path: resolve(out, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await writeFile(resolve(out, 'observations.json'), `${JSON.stringify(result, null, 2)}\n`);
  await browser.close();
}
console.log(`Recipe V3 PWA: ${result.checks.length} checks PASS (local synthetic API; hosted recovery not certified)`);
