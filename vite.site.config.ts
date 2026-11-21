import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Vite build configuration for `https://takolio.com` (Public Satellite, SEO & GEO Site).
 * Outputs to `dist/site`, followed by `scripts/site-prerender.mjs` which emits pre-rendered
 * HTML + Schema.org JSON-LD + GEO discovery files (`llms.txt`, `llms-full.txt`, `robots.txt`, `sitemap.xml`).
 */
export default defineConfig({
  root: __dirname,
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/web'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@packages': path.resolve(__dirname, './packages'),
      '@frigo/domain': path.resolve(__dirname, './packages/domain/src/index.ts'),
      '@frigo/recipes': path.resolve(__dirname, './packages/recipes/src/index.ts'),
      '@frigo/ai': path.resolve(__dirname, './packages/ai/src/index.ts'),
      '@frigo/db': path.resolve(__dirname, './packages/db/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist/site',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      input: {
        site: path.resolve(__dirname, 'site/index.html'),
      },
    },
  },
});
