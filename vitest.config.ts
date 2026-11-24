import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    // Use 2 workers on hosted 2-vCPU CI runners so full suites stay well below the 50m Admin CI timeout without saturating CPU.
    maxWorkers: process.env.CI ? 2 : undefined,
  },
}));
