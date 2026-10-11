import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function runBrowserCompatibility({ root, out, packageVersion, sourceHashes }) {
  const { chromium, expect } = await import('@playwright/test');
  const baseUrl = new URL(process.env.UI_REBUILD_URL ?? 'http://127.0.0.1:5238');
  assert.equal(baseUrl.protocol, 'http:');
  assert(['127.0.0.1', 'localhost'].includes(baseUrl.hostname));
  assert.equal(baseUrl.pathname, '/'); assert(!baseUrl.username && !baseUrl.password && !baseUrl.search && !baseUrl.hash);
  const base = baseUrl.origin;
  const app = await readFile(resolve(root, 'src/web/App.tsx'), 'utf8');
  assert.match(app, /<BrowserRouter\s+useTransitions=\{false\}/);
  const browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {});
  const checks = [], pageErrors = [], forbiddenWrites = [], blockedExternal = [];
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.route((url) => url.origin !== base, async (route) => {
    blockedExternal.push({ origin: new URL(route.request().url()).origin, method: route.request().method() });
    await route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method()) && url.pathname.startsWith('/api/v1/')) {
      if (url.pathname !== '/api/v1/preferences') forbiddenWrites.push({ path: url.pathname, method: request.method() });
    }
  });
  const checkStep = async (path, step) => {
    await page.waitForURL(`${base}${path}`);
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(step));
    await expect(page.locator('h1')).toHaveCount(1);
  };
  try {
    await page.goto(`${base}/__preview`);
    await page.getByRole('button', { name: '\u0110\u1eb7t l\u1ea1i d\u1eef li\u1ec7u th\u1eed nghi\u1ec7m v\u00e0 \u0111\u0103ng nh\u1eadp', exact: true }).click();
    await page.waitForURL(`${base}/planner`);
    await page.goto(`${base}/onboarding/unrecognized/nested`);
    await checkStep('/onboarding/household', 1);
    checks.push({ case: 'actual_app_onboarding_splat_fallback', status: 'PASS', path: '/onboarding/household' });
    await page.getByRole('button', { name: 'Ti\u1ebfp t\u1ee5c', exact: true }).click();
    await checkStep('/onboarding/preferences', 2);
    await page.goBack(); await checkStep('/onboarding/household', 1);
    await page.goForward(); await checkStep('/onboarding/preferences', 2);
    checks.push({ case: 'actual_app_useNavigate_and_browser_back_forward', status: 'PASS' });
    await page.goto(`${base}/onboarding/goals`); await checkStep('/onboarding/goals', 3);
    await page.reload(); await checkStep('/onboarding/goals', 3);
    checks.push({ case: 'actual_app_onboarding_deeplink_and_reload', status: 'PASS' });
    await page.getByRole('button', { name: 'B\u1eaft \u0111\u1ea7u v\u1edbi Takosan', exact: true }).click();
    await page.waitForURL(`${base}/`);
    for (const [source, destination] of [
      ['/week', '/planner'], ['/week/setup', '/planner/new'], ['/week/generating', '/planner'],
      ['/week/plan-a', '/planner/plan-a'], ['/week/plan-a/meal/meal-a', '/planner/plan-a/meal/meal-a'],
      ['/week/plan-a/shopping', '/planner/plan-a/shopping'], ['/week/plan-a/settings', '/settings/planning'],
    ]) {
      await page.goto(`${base}${source}`); await page.waitForURL(`${base}${destination}`);
      await expect(page.locator('h1')).toHaveCount(1);
      checks.push({ case: 'actual_app_week_alias', source, destination, status: 'PASS' });
    }
    await page.goto(`${base}/fridge`); await expect(page.locator('h1')).toHaveCount(1);
    const me = page.locator('[data-kitchen-navigation="persistent"] a[href="/me"]:visible').first();
    await me.click(); await page.waitForURL(`${base}/me`); await expect(page.locator('h1')).toHaveCount(1);
    await page.goBack(); await page.waitForURL(`${base}/fridge`); await expect(page.locator('h1')).toHaveCount(1);
    checks.push({ case: 'actual_app_Link_and_back_to_deeplink', status: 'PASS' });
    assert.deepEqual(forbiddenWrites, []); assert.deepEqual(pageErrors, []);
    await page.screenshot({ path: resolve(out, 'actual-app-routing.png'), fullPage: true });

    const publicContext = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
    await publicContext.route((url) => url.origin !== base, (route) => route.abort());
    const publicPage = await publicContext.newPage();
    publicPage.on('pageerror', (error) => pageErrors.push(error.message));
    await publicPage.goto(`${base}/auth/verify`);
    await expect(publicPage.locator('h1')).toHaveCount(1);
    await expect(publicPage.locator('main')).toContainText('X\u00e1c th\u1ef1c');
    assert.equal(new URL(publicPage.url()).pathname, '/auth/verify');
    await publicPage.reload(); await expect(publicPage.locator('h1')).toHaveCount(1);
    assert.equal(new URL(publicPage.url()).pathname, '/auth/verify');
    await publicPage.goto(`${base}/auth`); await expect(publicPage.locator('input[type="email"]')).toHaveCount(1);
    await publicPage.goBack(); await publicPage.waitForURL(`${base}/auth/verify`);
    checks.push({ case: 'actual_app_public_verify_deeplink_reload_and_back', status: 'PASS', registrationOrOtpSent: false });
    const authRequestShapes = [];
    await publicContext.addInitScript(() => {
      window.__b08Turnstile = { renderCount: 0, removeCount: 0 };
      window.turnstile = {
        render(_element, options) {
          window.__b08Turnstile.renderCount++;
          const count = window.__b08Turnstile.renderCount;
          queueMicrotask(() => options.callback(`synthetic-local-token-${count}`));
          return `synthetic-widget-${count}`;
        },
        remove() { window.__b08Turnstile.removeCount++; }, reset() {},
      };
    });
    await publicContext.route('**/api/v1/config', (route) => route.fulfill({ contentType: 'application/json',
      body: JSON.stringify({ turnstileSiteKey: 'synthetic-local-site-key', googleClientId: null }) }));
    await publicContext.route('**/api/v1/auth/register', (route) => {
      const body = route.request().postDataJSON();
      authRequestShapes.push({ endpoint: 'register', hasTurnstileToken: typeof body.turnstileToken === 'string' });
      return route.fulfill({ status: 503, contentType: 'application/json',
        body: JSON.stringify({ error: 'Synthetic delivery unavailable', code: 'OTP_DELIVERY_UNAVAILABLE', accountCreated: true }) });
    });
    await publicContext.route('**/api/v1/auth/resend-otp', (route) => {
      const body = route.request().postDataJSON();
      authRequestShapes.push({ endpoint: 'resend-otp', hasTurnstileToken: Object.hasOwn(body, 'turnstileToken') });
      return route.fulfill({ contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Synthetic resend response', expiresInMinutes: 10 }) });
    });
    await publicPage.goto(`${base}/auth?mode=register`);
    await publicPage.waitForFunction(() => window.__b08Turnstile.renderCount >= 1);
    const initialWidgetCount = await publicPage.evaluate(() => window.__b08Turnstile.renderCount);
    assert([1, 2].includes(initialWidgetCount), 'Development StrictMode must have at most one replay');
    await publicPage.getByLabel('H\u1ecd v\u00e0 t\u00ean', { exact: true }).fill('Synthetic Router Probe');
    await publicPage.getByLabel('Email', { exact: true }).fill('router-probe@example.test');
    await publicPage.getByLabel('M\u1eadt kh\u1ea9u (t\u1ed1i thi\u1ec3u 6 k\u00fd t\u1ef1)', { exact: true }).fill('synthetic-local-only-password');
    await publicPage.locator('form button[type="submit"]').click();
    await publicPage.waitForURL(`${base}/auth/verify`);
    await expect(publicPage.locator('h1')).toHaveText('X\u00e1c th\u1ef1c m\u00e3 OTP');
    const resend = publicPage.getByRole('button', { name: 'G\u1eedi l\u1ea1i m\u00e3 OTP', exact: true });
    await expect(resend).toBeEnabled(); await resend.click();
    await expect(publicPage.locator('main')).toContainText('Synthetic resend response');
    assert.deepEqual(authRequestShapes, [{ endpoint: 'register', hasTurnstileToken: true }, { endpoint: 'resend-otp', hasTurnstileToken: false }]);
    assert.equal(await publicPage.evaluate(() => window.__b08Turnstile.renderCount), initialWidgetCount);
    checks.push({ case: 'actual_development_app_auth_verify_transition_no_extra_synthetic_Turnstile_render', status: 'PASS',
      initialStrictModeWidgetRenderCount: initialWidgetCount, addedRendersAcrossVerifyAndResend: 0, interceptedAuthRequestShapes: authRequestShapes, actualMailOrRegistrationRequestCount: 0 });
    await publicContext.close();

    await context.route('**/__b08_router_probe?router=*', (route) => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div><script type="module" src="/docs/backend-upgrade/b08-local-remediation/local_router_probe_client.mjs"></script></body></html>',
    }));
    for (const kind of ['browser', 'memory']) {
      await page.goto(`${base}/__b08_router_probe?router=${kind}`);
      await page.waitForFunction(() => window.__b08RouterProbe?.ready === true);
      const location = page.getByTestId('router-location');
      await expect(location).toHaveText(kind === 'memory' ? '/initial?deep=1#saved' : `/__b08_router_probe?router=${kind}`);
      await page.getByTestId('trusted-link').click(); await expect(location).toHaveText('/next?from=link#kept');
      await page.getByTestId('trusted-navigate').click(); await expect(location).toHaveText('/safe?from=navigate#kept');
      await page.getByTestId('router-back').click(); await expect(location).toHaveText('/next?from=link#kept');
      await page.getByTestId('router-forward').click(); await expect(location).toHaveText('/safe?from=navigate#kept');
      for (const id of ['protocol-relative', 'mixed-slash', 'script-scheme', 'data-scheme']) {
        await page.getByTestId(`unsafe-navigate-${id}`).click();
        await page.waitForFunction((id) => window.__b08RouterProbe.navigationResults.some((result) => result.id === id), id);
        const result = await page.evaluate((id) => window.__b08RouterProbe.navigationResults.find((result) => result.id === id), id);
        assert.equal(result.rejected, true); assert.match(result.error, /External navigation is not allowed/);
        await expect(location).toHaveText('/safe?from=navigate#kept');
      }
      await page.getByTestId('unsafe-object-link').click();
      await page.waitForFunction(() => window.__b08RouterProbe.errors.some((error) => error.includes('External navigation is not allowed')));
      await expect(location).toHaveText('/safe?from=navigate#kept');
      const fixtureState = await page.evaluate(() => window.__b08RouterProbe);
      assert.equal(fixtureState.codeExecuted, false);
      assert(fixtureState.errors.every((error) => error.includes('External navigation is not allowed')));
      assert.equal(await page.getByTestId('explicit-external-link').getAttribute('href'), 'https://attacker.invalid/explicit');
      assert.equal(new URL(page.url()).origin, base);
      checks.push({ case: 'installed_router_real_browser_fixture', router: fixtureState.kind, status: 'PASS',
        trustedLinkAndNavigate: true, backAndForward: true, rejectedUntrustedNavigateCount: fixtureState.navigationResults.length,
        rejectedObjectLink: true, scriptExecuted: false, explicitExternalLinkAllowedButNotClicked: true });
    }
    assert.deepEqual(forbiddenWrites, []);
    assert.deepEqual(pageErrors.filter((error) => !error.includes('External navigation is not allowed')), []);
    assert.deepEqual(blockedExternal, []);
    await writeFile(resolve(out, 'routing-checks.json'), JSON.stringify({ checks, forbiddenWrites, pageErrors, blockedExternal }, null, 2));
    const { runBuiltPwaCompatibility } = await import('./local_pwa_browser_probe.mjs');
    const builtPwa = await runBuiltPwaCompatibility({ root, browser, sourceHashes });
    checks.push(...builtPwa.checks);
    return { checks, builtPwa, reactRouterDomVersion: await packageVersion('react-router-dom'), playwrightVersion: await packageVersion('@playwright/test'),
      browserVersion: browser.version(), actualAppTransitionMode: 'useTransitions=false; prior Router 6 urgent navigation behavior',
      networkPolicy: 'Loopback only; external origins aborted and required attempted external request count zero',
      sourceHashes: await sourceHashes(['src/web/App.tsx', 'src/web/pages/OnboardingPage.tsx', 'scripts/security-preview.mjs',
        'scripts/ui10-planner-alias-check.mjs', 'docs/backend-upgrade/b08-local-remediation/local_router_probe_client.mjs',
        'docs/backend-upgrade/b08-local-remediation/local_router_browser_probe.mjs', 'docs/backend-upgrade/b08-local-remediation/local_pwa_browser_probe.mjs']),
      limits: ['Actual App routes exercised on the existing development security preview, not on production or the built static bundle.',
        'MemoryRouter/adversarial targets are a separate installed-library fixture; not an application-wide redirect-input certificate.',
        'Explicit external Link strings remain allowed by React Router; they are not clicked.',
        'No real registration, OTP, Turnstile provider, mail, payment, or external credential validation.'] };
  } finally {
    await writeFile(resolve(out, 'routing-checks-partial.json'), JSON.stringify({ checks, forbiddenWrites, pageErrors, blockedExternal }, null, 2));
    await browser.close();
  }
}
