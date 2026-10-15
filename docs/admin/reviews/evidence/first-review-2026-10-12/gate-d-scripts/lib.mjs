import { chromium, expect } from '/tmp/review/clone/node_modules/@playwright/test/index.mjs';
import * as axeNs from '/tmp/review/clone/node_modules/@axe-core/playwright/dist/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

export const AxeBuilder = axeNs.default ?? axeNs.AxeBuilder;
export { chromium, expect };
export const BASE = 'http://127.0.0.1:8791';
export const PASSWORD = 'Local-Fixture-Only-2026!';
export const OUT = '/tmp/review/gate-d';
export const RESULTS = `${OUT}/results`;
mkdirSync(RESULTS, { recursive: true });
mkdirSync(`${OUT}/screens`, { recursive: true });
export const EMAIL = (key) => `${key}@fixture.takosan.test`;
export const VIEWPORTS = {
  '1440x900': { width: 1440, height: 900 },
  '820x1180': { width: 820, height: 1180 },
  '390x844': { width: 390, height: 844 },
};

export async function resetDb() {
  const r = await fetch(`${BASE}/__admin-preview/reset`, { method: 'POST' });
  if (r.status !== 204) throw new Error(`reset failed ${r.status}`);
}
export const launch = () => chromium.launch({ headless: true });
export function newContext(browser, viewport = VIEWPORTS['1440x900'], extra = {}) {
  return browser.newContext({ baseURL: BASE, viewport, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', serviceWorkers: 'block', ...extra });
}
export function instrument(page, rec = {}) {
  rec.api = rec.api ?? [];
  rec.consoleErrors = rec.consoleErrors ?? [];
  rec.pageErrors = rec.pageErrors ?? [];
  rec.requestFailed = rec.requestFailed ?? [];
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/api/v1/admin')) rec.api.push({ status: r.status(), method: r.request().method(), path: u.pathname + u.search });
  });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') rec.consoleErrors.push({ type: m.type(), text: m.text().slice(0, 240), url: m.location()?.url ?? '' });
  });
  page.on('pageerror', (e) => rec.pageErrors.push(String(e.message).slice(0, 300)));
  page.on('requestfailed', (r) => rec.requestFailed.push({ url: r.url(), failure: r.failure()?.errorText }));
  return rec;
}
export function writeResult(name, obj) {
  writeFileSync(`${RESULTS}/${name}.json`, JSON.stringify(obj, null, 2));
}
export async function login(page, email, password = PASSWORD) {
  await page.goto('/admin/login');
  await page.getByTestId('admin-login-email').fill(email);
  await page.getByTestId('admin-login-password').fill(password);
  await page.getByTestId('admin-login-submit').click();
}
// Calls the API from inside the page so the browser's own cookie rules apply.
export async function pageApi(page, path, init = {}) {
  return page.evaluate(
    async ({ path, init }) => {
      const headers = { 'Content-Type': 'application/json', ...(init.headers ?? {}) };
      const csrf = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith('__Host-takosan_admin_csrf='));
      if (init.method && init.method !== 'GET' && csrf) headers['X-Admin-CSRF'] = decodeURIComponent(csrf.split('=')[1]);
      const response = await fetch(path, { method: init.method ?? 'GET', credentials: 'same-origin', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
      let json = {};
      try { json = await response.json(); } catch { json = {}; }
      return { status: response.status, code: json.code ?? null, data: json.data ?? null };
    },
    { path, init },
  );
}
