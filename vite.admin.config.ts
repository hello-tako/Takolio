import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';

// Admin Console bundle, built separately from the customer app into dist/admin and
// served only by the admin Worker (src/worker/admin-worker.ts) behind its gate.
// Everything lives under /admin/ so the admin Worker can allow-list its paths.
const STATIC_FILES: ReadonlyArray<[string, string]> = [
  ['public/takosan/v3/app-icons/favicon.svg', 'admin/favicon.svg'],
  ['public/takosan/v3/fonts/nunito-vietnamese-wght-normal.woff2', 'admin/fonts/nunito-vietnamese-wght-normal.woff2'],
  ['public/takosan/v3/fonts/nunito-latin-ext-wght-normal.woff2', 'admin/fonts/nunito-latin-ext-wght-normal.woff2'],
  ['public/takosan/v3/fonts/nunito-latin-wght-normal.woff2', 'admin/fonts/nunito-latin-wght-normal.woff2'],
  ['public/takosan/v3/fonts/OFL.txt', 'admin/fonts/OFL.txt'],
];

function adminStaticFiles(): Plugin {
  return {
    name: 'admin-static-files',
    apply: 'build',
    generateBundle() {
      for (const [from, to] of STATIC_FILES) {
        this.emitFile({ type: 'asset', fileName: to, source: readFileSync(path.resolve(__dirname, from)) });
      }
    },
  };
}

export default defineConfig({
  root: __dirname,
  // The customer public/ directory (service worker, _headers, manifest) must not leak into the admin bundle.
  publicDir: false,
  plugins: [react(), adminStaticFiles()],
  resolve: {
    alias: { '@shared': path.resolve(__dirname, './src/shared') },
  },
  build: {
    outDir: 'dist/admin',
    emptyOutDir: true,
    assetsDir: 'admin/assets',
    // No public source maps for the admin bundle.
    sourcemap: false,
    rollupOptions: {
      input: { admin: path.resolve(__dirname, 'admin/index.html') },
    },
  },
});
