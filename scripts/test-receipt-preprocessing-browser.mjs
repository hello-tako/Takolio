#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const directory = resolve(process.argv[2] || '.artifacts/scan-preprocessing-runtime');
const preparedBytes = await readFile(join(directory, 'prepared.json'));
const prepared = JSON.parse(preparedBytes);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sources = ['src/web/lib/private-image.ts', 'src/web/lib/private-session.ts',
  'scripts/test-receipt-preprocessing-browser.mjs', 'pnpm-lock.yaml'];
const sourceHashes = await Promise.all(sources.map(async (path) => ({ path, sha256: hash(await readFile(path)) })));
let server, browser;
try {
  const oversized = await sharp(await readFile(join(directory, 'syn-vi-receipt-0-clean.png'))).resize({ height: 3200 }).png().toBuffer();
  const clean = await readFile(join(directory, 'syn-vi-receipt-0-clean.png'));
  const padded = Buffer.concat([clean, Buffer.alloc(512 * 1024 + 1)]);
  const webp = await sharp(clean).webp({ lossless: true }).toBuffer();
  const pixels = Buffer.alloc(1200 * 900 * 3);
  let seed = 1729;
  for (let index = 0; index < pixels.length; index++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels[index] = seed >>> 24; }
  const noisy = await sharp(pixels, { raw: { width: 1200, height: 900, channels: 3 } }).png().toBuffer();
  const extra = [
    { case: 'oversize-bytes-receipt', bytes: padded, format: 'png', expectedFormat: 'png', pixelExact: true },
    { case: 'unsupported-mime-receipt', bytes: webp, format: 'webp', expectedFormat: 'png', pixelExact: true },
    { case: 'noisy-receipt', bytes: noisy, format: 'png', expectedFormat: 'jpeg' },
  ];
  for (const image of extra) await writeFile(join(directory, `${image.case}.${image.format}`), image.bytes, { mode: 0o600 });
  const cases = [...extra.map((image) => ({ ...image, task: 'receipt_ocr', file: `${image.case}.${image.format}`, bytes: image.bytes.length, sha256: hash(image.bytes), extra: true })), ...prepared.cases.filter((entry) => !entry.expectedFailure), {
    case: 'oversized-receipt', file: 'oversized-receipt.png', bytes: oversized.length, sha256: hash(oversized), format: 'png', expectedFormat: 'png', extra: true,
  }];
  await writeFile(join(directory, 'oversized-receipt.png'), oversized, { mode: 0o600 });
  server = await createServer({ configFile: false, appType: 'custom', logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, plugins: [{ name: 'synthetic-image-harness',
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          if (request.url !== '/') return next();
          response.setHeader('Content-Type', 'text/html');
          response.end(`<!doctype html><html lang="en"><title>Synthetic image QA</title>
            <body><h1>SYNTHETIC TEST ONLY</h1><input type="file" accept="image/*" aria-label="Synthetic image">
            <script type="module">
            import { readPrivateImage } from '/src/web/lib/private-image.ts';
            import { resetPrivateSession } from '/src/web/lib/private-session.ts';
            localStorage.setItem('frigo_user_id', 'synthetic-browser-user');
            localStorage.setItem('frigo_household_id', 'synthetic-browser-household');
            window.qa = { readPrivateImage, resetPrivateSession, sequence: 0, data: null };
            document.querySelector('input').addEventListener('change', event => {
              const sequence = ++window.qa.sequence;
              window.qa.data = null;
              readPrivateImage(event.target.files[0], data => { if (sequence === window.qa.sequence) window.qa.data = data; }, window.qa.purpose || 'photo');
            });
            </script></body></html>`);
        });
      } }] });
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('BROWSER_HARNESS_ADDRESS_INVALID');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const network = [];
  page.on('request', (request) => network.push(request.url()));
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.waitForFunction(() => Boolean(window.qa));
  const measurements = [];
  const processedCases = [];
  await mkdir(join(directory, 'browser-images'), { recursive: true, mode: 0o700 });
  for (const image of cases) {
    const original = await readFile(join(directory, image.file));
    if (hash(original) !== image.sha256) throw new Error('BROWSER_SOURCE_HASH_MISMATCH');
    await page.evaluate((purpose) => { window.qa.purpose = purpose; }, image.task === 'receipt_ocr' || image.case === 'oversized-receipt' ? 'receipt' : 'photo');
    await page.locator('input').setInputFiles({ name: image.file,
      mimeType: `image/${image.format === 'jpeg' ? 'jpeg' : image.format}`, buffer: original });
    await page.waitForFunction(() => typeof window.qa.data === 'string');
    const data = await page.evaluate(() => window.qa.data);
    const match = data.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!match) throw new Error('BROWSER_DATA_URL_INVALID');
    const processed = Buffer.from(match[2], 'base64');
    const meta = await sharp(processed).metadata();
    if (Math.max(meta.width, meta.height) > 2000) throw new Error('BROWSER_DIMENSION_CAP_EXCEEDED');
    const sourceMeta = await sharp(original).metadata();
    if (image.expectedFormat && meta.format !== image.expectedFormat) throw new Error('NATIVE_CODEC_POLICY_MISMATCH');
    let pixelExact = null;
    if (image.pixelExact) {
      const sourcePixels = await sharp(original).ensureAlpha().raw().toBuffer();
      const outputPixels = await sharp(processed).ensureAlpha().raw().toBuffer();
      pixelExact = sourcePixels.equals(outputPixels);
      if (!pixelExact) throw new Error('LOSSLESS_DERIVATIVE_PIXELS_CHANGED');
    }
    if (image.task === 'receipt_ocr' && ['png', 'jpeg'].includes(image.format) && original.length <= 512 * 1024 && Math.max(sourceMeta.width, sourceMeta.height) <= 2000
      && hash(processed) !== image.sha256) throw new Error('SMALL_RECEIPT_ORIGINAL_NOT_PRESERVED');
    if (image.task !== 'receipt_ocr' && Math.max(sourceMeta.width, sourceMeta.height) <= 2000 && processed.length > original.length) throw new Error('BROWSER_GREW_SMALL_ORIGINAL');
    const file = `${image.case}.${meta.format === 'png' ? 'png' : 'jpg'}`;
    await writeFile(join(directory, 'browser-images', file), processed, { mode: 0o600 });
    if (!image.extra) processedCases.push({ ...image,
      file, width: meta.width, height: meta.height, bytes: processed.length, sha256: hash(processed), format: meta.format });
    let photoParity = null;
    if (image.task !== 'receipt_ocr' && !image.extra) {
      const control = JSON.parse(await readFile('.artifacts/scan-preprocessing-comparison/jpeg82/prepared.json'));
      const entry = control.cases.find((row) => row.case === image.case);
      photoParity = entry.sha256 === hash(processed);
      if (!photoParity) throw new Error('DEFAULT_PHOTO_BYTES_CHANGED');
    }
    if (meta.format === 'png' && image.extra && processed.length > 512 * 1024) throw new Error('PNG_ALLOWANCE_EXCEEDED');
    let nativeDerivativeExact = null;
    if (image.extra && meta.format === 'png') {
      const reference = await page.evaluate(async ({ encoded, mime }) => {
        const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
        try {
          const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(bitmap.width * scale));
          canvas.height = Math.max(1, Math.round(bitmap.height * scale));
          canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/png');
        } finally { bitmap.close(); }
      }, { encoded: original.toString('base64'), mime: `image/${image.format}` });
      nativeDerivativeExact = processed.equals(Buffer.from(reference.split(',')[1], 'base64'));
      if (!nativeDerivativeExact) throw new Error('NATIVE_LOSSLESS_DERIVATIVE_MISMATCH');
    }
    measurements.push({ pixelExact, nativeDerivativeExact, photoParity, caseId: image.case, sourceSha256: image.sha256, purpose: image.task === 'receipt_ocr' || image.case === 'oversized-receipt' ? 'receipt' : 'photo', inputBytes: original.length,
      outputBytes: processed.length, outputSha256: hash(processed), mimeType: match[1], width: meta.width, height: meta.height });
  }
  const sample = await readFile(join(directory, 'syn-fridge-0-clean.png'));
  const lifecycle = [];
  for (const action of ['cancel', 'identity_change', 'session_reset']) {
    const result = await page.evaluate(async ({ encoded, action }) => {
      const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'image/png' });
      let callbacks = 0;
      const cancel = window.qa.readPrivateImage(blob, () => { callbacks++; }, 'receipt');
      if (action === 'cancel') cancel();
      if (action === 'identity_change') localStorage.setItem('frigo_household_id', 'other-household');
      if (action === 'session_reset') window.qa.resetPrivateSession();
      // Wait for actual image decode plus two frames, then allow FileReader callbacks.
      const bitmap = await createImageBitmap(blob);
      bitmap.close();
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      await new Promise((done) => setTimeout(done, 100));
      localStorage.setItem('frigo_household_id', 'synthetic-browser-household');
      return callbacks;
    }, { encoded: sample.toString('base64'), action });
    if (result !== 0) throw new Error('BROWSER_STALE_IMAGE_CALLBACK');
    lifecycle.push({ action, staleCallbacks: result });
  }
  if (network.some((url) => !url.startsWith(`http://127.0.0.1:${address.port}/`))) throw new Error('BROWSER_EXTERNAL_REQUEST');
  const damagedImage = prepared.cases.find((image) => image.expectedFailure);
  const damagedBytes = await readFile(join(directory, damagedImage.file));
  await page.evaluate(() => { window.qa.purpose = 'receipt'; });
  await page.locator('input').setInputFiles({ name: damagedImage.file, mimeType: 'image/jpeg', buffer: damagedBytes });
  await page.waitForFunction(() => typeof window.qa.data === 'string');
  const fallback = await page.evaluate(() => window.qa.data);
  if (hash(Buffer.from(fallback.split(',')[1], 'base64')) !== damagedImage.sha256) throw new Error('BROWSER_DAMAGED_FALLBACK_CHANGED_BYTES');
  await writeFile(join(directory, 'browser-images', damagedImage.file), damagedBytes, { mode: 0o600 });
  processedCases.push(damagedImage);
  const processedManifest = { ...prepared, cases: processedCases };
  await writeFile(join(directory, 'browser-images', 'prepared.json'), `${JSON.stringify(processedManifest, null, 2)}\n`, { mode: 0o600 });
  const report = { version: 1, classification: 'TEST_ONLY', status: 'PASS', browser: browser.version(),
    preparedSha256: hash(preparedBytes), sourceHashes, cases: measurements, lifecycle,
    externalRequests: 0, damagedImageFallback: 'ORIGINAL_BYTES_RETAINED_FOR_SERVER_VALIDATION', productOcrCertified: false, semanticFridgeRecognitionMeasured: false };
  await writeFile(join(directory, 'browser-report.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ status: report.status, browser: report.browser, imageCases: measurements.length, lifecycle, externalRequests: 0 })}\n`);
} finally {
  await browser?.close();
  await server?.close();
}
