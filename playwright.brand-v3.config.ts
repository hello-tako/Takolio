import { defineConfig } from '@playwright/test';

// Run the existing journeys against the actual V3 production build and local Worker.
const port = Number(process.env.BRAND_PORT ?? 5232);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port');
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['t13b-*.e2e.ts', 't13r-a-*.e2e.ts', 't13r-b-*.e2e.ts', 't20-composition.e2e.ts', 't17-ui/payment-authority.e2e.ts', 't17-ui/t18a-auth-expiry.e2e.ts'],
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60000,
  expect: { timeout: 10000 },
  outputDir: '.artifacts/brand-v3/e2e',
  reporter: [['./scripts/playwright-private-reporter.mjs'], ['list']],
  use: { baseURL, browserName: 'chromium', locale: 'vi-VN', timezoneId: 'UTC', serviceWorkers: 'block', screenshot: 'only-on-failure', trace: 'off' },
  projects: [
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'node scripts/brand-v3-preview.mjs',
    url: `${baseURL}/__preview/ready`,
    env: { BRAND_PORT: String(port), BRAND_COMPOSITION: 'true', BRAND_PLANNER: 'true', BRAND_CATALOG_D1: 'true' },
    reuseExistingServer: false,
    timeout: 60000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
