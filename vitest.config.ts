import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    // Crypto and local Wrangler tests share the hosted runner's CPU budget.
    maxWorkers: process.env.CI ? 1 : undefined,
  },
}));
