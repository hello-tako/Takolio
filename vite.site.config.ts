import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Vite build configuration for `https://takolio.com` (Public Satellite, Multilingual SEO & GEO Hub).
 * Supports both client bundle (`dist/site`) and True React SSR entry (`dist/site-ssr/entry-server.js`).
 */
export default defineConfig(({ isSsrBuild }) => ({
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
  ssr: {
    noExternal: ['react-router-dom', 'react-router'],
  },
  build: isSsrBuild
    ? {
        outDir: 'dist/site-ssr',
        emptyOutDir: true,
        sourcemap: false,
        rollupOptions: {
          output: {
            format: 'es',
            entryFileNames: 'entry-server.js',
          },
        },
      }
    : {
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
}));
