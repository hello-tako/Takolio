#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const origin = 'http://127.0.0.1:3199';
const out = '.artifacts/nine-region-offline/browser';
await mkdir(out, { recursive: true, mode: 0o700 });
const payment = { id: 'pay_browser', orderCode: '123456789', plan: 'annual', amountVnd: 499000, currency: 'VND',
  description: 'TEST ONLY', expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), status: 'pending', instructions: {
    bankBin: '970422', accountNumber: '123456789', accountName: 'TEST ONLY', transferContent: 'TEST ONLY',
    qrImageUrl: `${origin}/takosan/v3/logo/stacked-primary.svg` } };
const records = [];
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const width of [320, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'vi-VN' });
      const page = await context.newPage();
      const errors = []; const external = []; const checkoutKeys = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let recovered = false;
      let fixtureCookie = '';
      const localHeaders = (request) => name === 'webkit' && new URL(request.url()).pathname.startsWith('/api/')
        ? { ...request.headers(), cookie: fixtureCookie } : request.headers();
      await context.route('**/*', async (route) => {
        const request = route.request(); const url = new URL(request.url());
        if (url.origin !== origin) { external.push(url.origin); return route.abort('blockedbyclient'); }
        if (url.pathname === '/api/v1/me') {
          const response = await route.fetch({ headers: localHeaders(request) });
          const body = await response.json();
          if (body.user) body.user.onboardingCompleted = true;
          return route.fulfill({ response, json: body });
        }
        if (url.pathname === '/api/v1/billing/plans') return route.fulfill({ json: { plans: [{ plan: 'annual', amountVnd: 499000, currency: 'VND' }] } });
        if (url.pathname === '/api/v1/billing/checkouts') return route.fulfill({ json: { checkouts: recovered ? [{ intentId: payment.id,
          plan: payment.plan, status: payment.status, state: 'ready', expiresAt: payment.expiresAt }] : [] } });
        if (url.pathname === '/api/v1/billing/payment-intents' && request.method() === 'POST') {
          checkoutKeys.push(request.headers()['idempotency-key']);
          if (checkoutKeys.length === 1) return route.abort('connectionreset');
          return route.fulfill({ status: 201, json: { success: true, payment } });
        }
        if (url.pathname === '/api/v1/billing/checkouts/pay_browser' || url.pathname === '/api/v1/billing/payment-intents/pay_browser') {
          return route.fulfill({ json: { success: true, payment } });
        }
        return route.continue({ headers: localHeaders(request) });
      });
      const login = await context.request.post(`${origin}/__preview/login`, {
        headers: { Accept: 'application/json', Origin: origin },
      });
      if (login.status() !== 200) throw new Error('SYNTHETIC_LOGIN_FAILED');
      // Explicit bootstrap matches the existing local multi-browser harness.
      // WebKit's HTTP loopback transport bridges this cookie in API interception.
      // This synthetic session is not evidence of a real authentication journey.
      const cookie = login.headers()['set-cookie']?.split(';')[0];
      if (!cookie?.startsWith('__Host-frigo_session=')) throw new Error('SYNTHETIC_COOKIE_MISSING');
      fixtureCookie = cookie;
      await context.addCookies([{ name: '__Host-frigo_session', value: cookie.slice(cookie.indexOf('=') + 1),
        domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
      await context.addInitScript(() => {
        localStorage.setItem('frigo_user_id', 'planner-preview-user');
        localStorage.setItem('frigo_household_id', 'planner-preview-household');
        localStorage.setItem('frigo_is_guest', 'false'); localStorage.setItem('frigo_onboarded', 'true');
      });
      await page.goto(`${origin}/plus`, { waitUntil: 'domcontentloaded' });
      const buy = page.getByRole('button', { name: /Nâng cấp ngay với/ });
      try { await buy.waitFor(); } catch (error) {
        await page.screenshot({ path: `${out}/${name}-${width}-failure.png`, fullPage: true });
        await writeFile(`${out}/${name}-${width}-failure.json`, JSON.stringify({ classification: 'HARNESS_FAILURE', engine: name, width, url: page.url(), text: await page.locator('body').innerText(), errors, external }, null, 2));
        throw error;
      }
      await buy.click();
      await page.getByText('Không thể tạo lệnh thanh toán. Vui lòng thử lại.', { exact: true }).waitFor();
      await buy.click();
      await page.getByRole('dialog').waitFor();
      if (checkoutKeys.length !== 2 || checkoutKeys[0] !== checkoutKeys[1] || !/^[a-f0-9-]{36}$/.test(checkoutKeys[0])) throw new Error('CHECKOUT_RETRY_IDENTITY_DRIFT');
      await page.screenshot({ path: `${out}/${name}-${width}-qr.png`, fullPage: true });
      recovered = true;
      await page.reload({ waitUntil: 'domcontentloaded' });
      const resume = page.getByRole('button', { name: 'Mở lệnh thanh toán cũ', exact: true });
      await resume.waitFor();
      if (await buy.isEnabled()) throw new Error('RELOAD_REPLACEMENT_NOT_BLOCKED');
      await resume.click(); await page.getByRole('dialog').waitFor();
      if (checkoutKeys.length !== 2) throw new Error('RESUME_DISPATCHED_NEW_ORDER');
      const geometry = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
        broken: [...document.images].filter((image) => image.complete && image.naturalWidth === 0).length }));
      await page.waitForFunction(() => [...document.querySelectorAll('.animate-fade-in')].every((node) => Number(getComputedStyle(node).opacity) === 1));
      const axe = await new AxeBuilder({ page }).analyze();
      await writeFile(`${out}/${name}-${width}-axe.json`, JSON.stringify(axe.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes })), null, 2));
      if (axe.violations.length) throw new Error(`AXE_VIOLATIONS ${JSON.stringify(axe.violations.map((item) => item.id))}`);
      if (geometry.overflow || geometry.broken || errors.length || external.length) throw new Error(`BROWSER_ACCEPTANCE_FAILED ${JSON.stringify({ geometry, errors, external })}`);
      await page.screenshot({ path: `${out}/${name}-${width}-resume.png`, fullPage: true });
      records.push({ engine: name, width, retryRequests: 2, keyStable: true, reloadBlockedReplacement: true,
        resumedWithoutDispatch: true, loopbackCookieBridge: name === 'webkit', geometry, axeViolations: axe.violations.length, pageErrors: errors.length, externalRequests: external.length });
      process.stdout.write(`${name}-${width}=PASS\n`);
      await context.close();
    }
  } finally { await browser.close(); }
}
await writeFile(`${out}/receipt.json`, `${JSON.stringify({ classification: 'LOCAL_BROWSER_MOCK', status: 'PASS',
  records, screenshots: records.length * 2, externalAcceptance: 'PENDING_EXTERNAL_EVIDENCE' }, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`browser-check=PASS; ${records.length} cases, ${records.length * 2} screenshots; no real provider/OTP\n`);
