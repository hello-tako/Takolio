import { defineConfig } from '@playwright/test';

// Admin Console E2E: the real Worker serves the built admin frontend and API
// from one origin (scripts/admin-preview.mjs). Requires `pnpm build:web`.
const port = Number(process.env.ADMIN_PREVIEW_PORT ?? 8790);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('ADMIN_PREVIEW_PORT must be an unprivileged port');
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['admin-*.e2e.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: '.hoplite/artifacts/admin-playwright/results',
  reporter: [['list']],
  use: {
    baseURL,
    browserName: 'chromium',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: { mode: 'retain-on-failure', snapshots: false, sources: false, screenshots: true },
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'node scripts/admin-preview.mjs',
    url: `${baseURL}/__admin-preview/health`,
    env: { PORT: String(port), ENVIRONMENT: 'development' },
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
});
