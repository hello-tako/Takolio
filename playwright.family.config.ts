import { defineConfig } from '@playwright/test';
import base from './playwright.t20.config';
export default defineConfig({
  ...base,
  use: { ...base.use, reducedMotion: 'reduce' },
  testMatch: 'family-meals.e2e.ts',
  timeout: 60_000,
  outputDir: '.wrangler/family-meals/browser-results',
  reporter: [['list'], ['json', { outputFile: '.wrangler/family-meals/browser-report.json' }]],
  projects: [320, 390, 768, 1280].map((width) => ({
    name: `family-${width}`,
    use: { viewport: { width, height: 900 }, isMobile: width < 500, hasTouch: width < 500 },
  })),
});
