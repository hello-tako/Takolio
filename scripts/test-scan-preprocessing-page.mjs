#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const directory = resolve(process.argv[2] || '.artifacts/scan-preprocessing-runtime');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = ['src/web/lib/private-image.ts', 'src/web/lib/private-session.ts',
  'src/web/pages/ScanPage.tsx', 'src/web/services/scans.ts', 'src/web/services/http.ts',
  'scripts/test-scan-preprocessing-page.mjs', 'pnpm-lock.yaml'];
const sourceHashes = await Promise.all(sources.map(async (path) => ({ path, sha256: hash(await readFile(path)) })));
const prepared = JSON.parse(await readFile(join(directory, 'prepared.json')));
const controls = JSON.parse(await readFile('.artifacts/scan-preprocessing-comparison/jpeg82/prepared.json'));
let server, browser;
try {
  server = await createServer({ configFile: false, appType: 'custom', logLevel: 'error',
    esbuild: { jsx: 'automatic' },
    resolve: { alias: { '@frigo/domain': resolve('packages/domain/src/index.ts'),
      '@frigo/recipes': resolve('packages/recipes/src/index.ts'), '@frigo/ai': resolve('packages/ai/src/index.ts'),
      '@frigo/db': resolve('packages/db/src/index.ts') } },
    server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, ws: false },
    plugins: [{ name: 'local-scan-page', configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url !== '/') return next();
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(`<!doctype html><html lang="vi"><meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Synthetic ScanPage QA</title><div id="root" class="takosan-rebuild"></div><script type="module" src="/scan-page-qa.jsx"></script></html>`);
      });
    }, resolveId(id) { if (id === '/scan-page-qa.jsx') return '\0scan-page-qa.jsx'; },
    load(id) { if (id !== '\0scan-page-qa.jsx') return;
      return `import React from 'react'; import { createRoot } from 'react-dom/client';
        import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
        import { ScanPage } from '/src/web/pages/ScanPage.tsx';
        import { readPrivateImage } from '/src/web/lib/private-image.ts';
        import { getPendingOps } from '/src/web/lib/sync.ts';
        import '/src/web/styles/index.css';
        localStorage.setItem('frigo_user_id', 'synthetic-page-user');
        localStorage.setItem('frigo_household_id', 'synthetic-page-household');
        window.qa = { readPrivateImage, getPendingOps };
        function Location() { const loc = useLocation(); return React.createElement('output', { 'data-testid': 'qa-location' }, loc.pathname + loc.search); }
        createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter, { initialEntries: ['/scan'] },
          React.createElement(Location), React.createElement(Routes, null,
          React.createElement(Route, { path: '/scan', element: React.createElement(ScanPage) }),
          React.createElement(Route, { path: '*', element: React.createElement('p', { 'data-testid': 'qa-review' }, 'Review route reached; confirmation not submitted.') }))));`;
    } }] });
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('LOCAL_ADDRESS_INVALID');
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const network = [], errors = [], submissions = [], blocked = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => network.push(request.url()));
  await page.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { blocked.push(url.href); return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (request.method() === 'GET' && url.pathname === '/api/v1/me') {
      return route.fulfill({ json: { user: { id: 'synthetic-page-user', household: { id: 'synthetic-page-household' },
        subscription: { plan: 'free', limit: 5, used: 0, remaining: 5, resetAt: '2026-11-01T00:00:00Z' } } } });
    }
    if (request.method() === 'POST' && ['/api/v1/scans/receipt', '/api/v1/scans/fridge'].includes(url.pathname)) {
      const payload = request.postDataJSON();
      const data = payload.imageBase64;
      const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(data);
      if (!match) throw new Error('SCAN_REQUEST_DATA_INVALID');
      const bytes = Buffer.from(match[2], 'base64'), meta = await sharp(bytes).metadata();
      const headers = request.headers();
      submissions.push({ path: url.pathname, scanType: payload.scanType ?? 'receipt', imageSha256: hash(bytes),
        bytes: bytes.length, mimeType: match[1], width: meta.width, height: meta.height,
        commandId: headers['idempotency-key'], expectedUser: headers['x-frigo-expected-user-id'],
        expectedHousehold: headers['x-frigo-expected-household-id'] });
      return route.fulfill({ status: 202, json: { scan: { id: 'synthetic-scan-id', status: 'pending', items: [] } } });
    }
    blocked.push(url.pathname); return route.abort();
  });
  async function open(mode = 'receipt') {
    await page.goto(origin);
    await page.getByRole('heading', { name: 'Chụp ảnh, rồi kiểm tra' }).waitFor();
    await page.getByRole('button', { name: mode === 'receipt' ? 'Hóa đơn' : mode === 'food' ? 'Nguyên liệu' : 'Tủ lạnh', exact: true }).click();
  }
  const cases = [
    { mode: 'receipt', file: 'syn-vi-receipt-0-clean.png' },
    { mode: 'receipt', file: 'syn-vi-receipt-0-tilt.jpg' },
    { mode: 'receipt', file: 'oversize-bytes-receipt.png' },
    { mode: 'fridge', file: 'syn-fridge-0-clean.png' },
    { mode: 'food', file: prepared.cases.find((row) => row.task === 'label_ocr' && row.locale === 'vi' && row.variant === 'clean').file },
  ];
  const measurements = [];
  await mkdir(join(directory, 'page-screenshots'), { recursive: true, mode: 0o700 });
  for (const image of cases) {
    await open(image.mode);
    const input = await readFile(join(directory, image.file));
    const before = submissions.length;
    await page.locator('input[type=file]').setInputFiles({ name: image.file,
      mimeType: image.file.endsWith('.png') ? 'image/png' : 'image/jpeg', buffer: input });
    await page.getByTestId('qa-review').waitFor();
    if (submissions.length !== before + 1) throw new Error('SCAN_SUBMISSION_COUNT_INVALID');
    const request = submissions.at(-1);
    const entry = prepared.cases.find((row) => row.file === image.file);
    const expected = image.mode === 'receipt' ? image.file === 'oversize-bytes-receipt.png'
      ? JSON.parse(await readFile(join(directory, 'browser-report.json'))).cases.find((row) => row.caseId === 'oversize-bytes-receipt').outputSha256
      : hash(input) : controls.cases.find((row) => row.case === entry.case).sha256;
    if (request.imageSha256 !== expected || request.scanType !== image.mode
      || request.path !== `/api/v1/scans/${image.mode === 'receipt' ? 'receipt' : 'fridge'}`
      || !request.commandId || request.expectedUser !== 'synthetic-page-user'
      || request.expectedHousehold !== 'synthetic-page-household') throw new Error('SCAN_PAGE_POLICY_OR_AUTH_REGRESSION');
    const location = await page.getByTestId('qa-location').textContent();
    const expectedLocation = image.mode === 'receipt' ? '/scan/receipt-review?scanId=synthetic-scan-id' : '/scan/synthetic-scan-id/review';
    if (location !== expectedLocation || await page.evaluate(() => window.qa.getPendingOps().length) !== 0) throw new Error('SCAN_NAVIGATION_OR_OUTBOX_REGRESSION');
    measurements.push({ ...image, ...request, location, expectedImageSha256: expected, pendingOps: 0 });
  }
  // Keep native encoding but delay its callback while the user changes mode/unmounts.
  const races = [];
  for (const action of ['mode_change', 'unmount']) {
    await open();
    await page.evaluate(() => {
      const native = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(...args) {
        const [callback, ...rest] = args;
        return native.call(this, (blob) => { window.qa.release = () => callback(blob); }, ...rest);
      };
    });
    const before = submissions.length;
    await page.locator('input[type=file]').setInputFiles(join(directory, 'oversize-bytes-receipt.png'));
    await page.waitForFunction(() => typeof window.qa.release === 'function');
    if (action === 'mode_change') await page.getByRole('button', { name: 'Tủ lạnh', exact: true }).click();
    else await page.getByRole('button', { name: 'Quay lại tủ lạnh', exact: true }).click();
    await page.evaluate(() => window.qa.release());
    await page.waitForTimeout(150);
    if (submissions.length !== before || await page.evaluate(() => window.qa.getPendingOps().length) !== 0) throw new Error('STALE_SCAN_SUBMITTED');
    races.push({ action, staleSubmissions: 0, pendingOps: 0 });
  }
  const appearance = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport); await open();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw new Error('SCAN_PAGE_HORIZONTAL_OVERFLOW');
    const screenshot = `scan-${viewport.width}.png`;
    await page.screenshot({ path: join(directory, 'page-screenshots', screenshot), fullPage: true });
    appearance.push({ viewport, screenshot, horizontalOverflow: false });
  }
  if (errors.length || blocked.length || network.some((url) => new URL(url).origin !== origin)) throw new Error('PAGE_ERROR_OR_UNEXPECTED_REQUEST');
  const report = { classification: 'TEST_ONLY', status: 'PASS', browser: browser.version(),
    sourceHashes, measurements, races, appearance, pageErrors: errors, blockedRequests: blocked,
    providerCalls: 0, inventoryWrites: 0, confirmationCalls: 0, externalRequests: 0, productOcrCertified: false };
  await writeFile(join(directory, 'scan-page-report.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ status: 'PASS', submissions: submissions.length, races, appearance,
    providerCalls: 0, inventoryWrites: 0, confirmationCalls: 0, externalRequests: 0 })}\n`);
} finally { await browser?.close(); await server?.close(); }
