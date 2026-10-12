#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, basename } from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const input = resolve(process.argv[2] || '.artifacts/scan-synthetic-v3');
const output = resolve(process.argv[3] || '.artifacts/scan-preprocessing-comparison');
const preparedBytes = await readFile(join(input, 'prepared.json'));
const prepared = JSON.parse(preparedBytes);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const policies = ['jpeg82', 'jpeg95', 'png', 'small_original'];
const cap = 2000;
let browser, server;
try {
  if (prepared.classification !== 'TEST_ONLY') throw new Error('TEST_ONLY_REQUIRED');
  await mkdir(output, { recursive: true, mode: 0o700 });
  server = await createServer({ configFile: false, appType: 'custom', logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, plugins: [{ name: 'scan-codec-comparison',
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          if (request.url !== '/') return next();
          response.setHeader('Content-Type', 'text/html');
          response.end('<!doctype html><html lang="en"><title>Synthetic preprocessing comparison</title><h1>SYNTHETIC TEST ONLY</h1></html>');
        });
      } }] });
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('LOCAL_ADDRESS_INVALID');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(`http://127.0.0.1:${address.port}/`);
  const report = { classification: 'TEST_ONLY', seed: prepared.seed, browser: browser.version(),
    sourcePreparedSha256: hash(preparedBytes), maximumDimension: cap, policies: [] };
  for (const policy of policies) {
    const directory = join(output, policy);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const manifest = { ...prepared, cases: [] };
    const measurements = [];
    for (const image of prepared.cases) {
      if (basename(image.file) !== image.file) throw new Error('IMAGE_PATH_INVALID');
      const original = await readFile(join(input, image.file));
      if (hash(original) !== image.sha256) throw new Error('SOURCE_IMAGE_HASH_MISMATCH');
      if (image.expectedFailure) {
        await writeFile(join(directory, image.file), original, { mode: 0o600 });
        manifest.cases.push(image);
        continue;
      }
      const data = await page.evaluate(async ({ encoded, mime, policy, cap }) => {
        const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
        const blob = new Blob([bytes], { type: mime });
        const bitmap = await createImageBitmap(blob);
        try {
          const scale = Math.min(1, cap / Math.max(bitmap.width, bitmap.height));
          const width = Math.max(1, Math.round(bitmap.width * scale));
          const height = Math.max(1, Math.round(bitmap.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
          let result;
          if (policy === 'small_original' && scale === 1) result = blob;
          else result = await new Promise((done) => canvas.toBlob(done,
            policy === 'png' ? 'image/png' : 'image/jpeg', policy === 'jpeg95' ? .95 : .82));
          if (!result) throw new Error('ENCODER_FAILED');
          if (policy === 'jpeg82' && scale === 1 && result.size >= blob.size) result = blob;
          return await new Promise((done, reject) => {
            const reader = new FileReader(); reader.onerror = reject; reader.onload = () => done(reader.result);
            reader.readAsDataURL(result);
          });
        } finally { bitmap.close(); }
      }, { encoded: original.toString('base64'), mime: image.format === 'png' ? 'image/png' : 'image/jpeg', policy, cap });
      const processed = Buffer.from(data.split(',')[1], 'base64');
      const meta = await sharp(processed).metadata();
      if (Math.max(meta.width, meta.height) > cap) throw new Error('DIMENSION_CAP_EXCEEDED');
      const file = `${image.case}.${meta.format === 'png' ? 'png' : 'jpg'}`;
      await writeFile(join(directory, file), processed, { mode: 0o600 });
      manifest.cases.push({ ...image, file, width: meta.width, height: meta.height,
        bytes: processed.length, sha256: hash(processed), format: meta.format });
      measurements.push({ caseId: image.case, inputBytes: original.length, outputBytes: processed.length,
        sourceSha256: image.sha256, outputSha256: hash(processed), format: meta.format,
        width: meta.width, height: meta.height });
    }
    await writeFile(join(directory, 'prepared.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    report.policies.push({ policy, measurements });
  }
  if (requests.some((url) => !url.startsWith(`http://127.0.0.1:${address.port}/`))) throw new Error('EXTERNAL_REQUEST');
  report.externalRequests = 0;
  await writeFile(join(output, 'comparison.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ policies, validImagesPerPolicy: prepared.cases.filter((image) => !image.expectedFailure).length, browser: report.browser, externalRequests: 0 })}\n`);
} finally { await browser?.close(); await server?.close(); }
