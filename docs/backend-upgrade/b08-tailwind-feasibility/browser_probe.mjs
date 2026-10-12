import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';

const root = process.cwd();
const artifacts = resolve(root, '.artifacts/backend-b08-tailwind-feasibility');
const suffix = process.argv[2];
assert(suffix && /^[a-z0-9-]+$/.test(suffix));
const out = resolve(artifacts, suffix);
await mkdir(out);
const candidate = JSON.parse(await readFile(resolve(artifacts, 'candidate-private.json'), 'utf8')).directory;
const base = 'http://127.0.0.1:5248';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function css(directory) {
  const assets = resolve(directory, 'dist/client/assets');
  const names = (await readdir(assets)).filter((name) => name.endsWith('.css'));
  assert.equal(names.length, 1);
  return readFile(resolve(assets, names[0]), 'utf8');
}
const baselineCss = await css(root), candidateCss = await css(candidate);
const properties = ['display', 'position', 'box-sizing', 'font-family', 'font-size', 'font-weight',
  'line-height', 'letter-spacing', 'color', 'background-color', 'border-top-color', 'border-top-width',
  'border-radius', 'box-shadow', 'outline-style', 'outline-width', 'outline-color', 'cursor',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-bottom',
  'gap', 'align-items', 'justify-content', 'opacity', 'overflow-x', 'overflow-y'];
const browser = await chromium.launch();
const checks = [], errors = [], blocked = [], forbiddenWrites = [];
const routeCases = process.argv[3] === 'states' ? [
  { path: '/auth', id: 'auth-focus', state: 'focus', authenticated: false },
  { path: '/auth', id: 'auth-focus-forced-colors', state: 'forced-focus', authenticated: false },
  { path: '/auth', id: 'auth-hover', state: 'hover', authenticated: false },
] : [
  { path: '/auth', authenticated: false }, { path: '/auth?mode=register', id: 'auth-register', authenticated: false },
  { path: '/auth/verify', authenticated: false }, { path: '/onboarding/household', authenticated: true },
  { path: '/fridge', authenticated: true }, { path: '/recipes', authenticated: true },
  { path: '/planner', authenticated: true }, { path: '/planner/new', authenticated: true },
  { path: '/scan', authenticated: true }, { path: '/me', authenticated: true },
];
function compare(before, after) {
  const changes = [];
  if (before.length !== after.length) changes.push({ kind: 'visibleElementCount', before: before.length, after: after.length });
  // Compare by full DOM path from a second snapshot in each stylesheet, avoiding
  // mismatched visible arrays when a changed style hides or reveals an element.
  const index = new Map(after.map((node) => [node.domPath, node]));
  for (const node of before) {
    const next = index.get(node.domPath);
    if (!next) { changes.push({ kind: 'visibility', domPath: node.domPath, classes: node.classes }); continue; }
    if (JSON.stringify(node.geometry) !== JSON.stringify(next.geometry))
      changes.push({ kind: 'geometry', domPath: node.domPath, classes: node.classes, before: node.geometry, after: next.geometry });
    for (const property of properties) if (node.styles[property] !== next.styles[property])
      changes.push({ kind: 'style', domPath: node.domPath, classes: node.classes,
        property, before: node.styles[property], after: next.styles[property] });
  }
  return changes;
}
async function stableSnapshot(page) {
  return page.evaluate((properties) => {
    function path(node) {
      const parts = [];
      while (node && node !== document.body) {
        const parent = node.parentElement;
        parts.push(`${node.tagName}:${parent ? [...parent.children].indexOf(node) : 0}`);
        node = parent;
      }
      return ['BODY', ...parts.reverse()].join('/');
    }
    return [...document.querySelectorAll('body, #root, #root *')].filter((node) => {
      const r = node.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    }).map((node) => {
      const style = getComputedStyle(node), r = node.getBoundingClientRect();
      return { domPath: path(node), tag: node.tagName, classes: node.getAttribute('class') ?? '',
        geometry: [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 100) / 100),
        styles: Object.fromEntries(properties.map((p) => [p, style.getPropertyValue(p)])) };
    });
  }, properties);
}
async function installCss(page, text) {
  await page.evaluate((cssText) => {
    document.querySelectorAll('style[data-vite-dev-id]').forEach((node) => node.remove());
    let style = document.getElementById('bounded-tw-css');
    if (!style) { style = document.createElement('style'); style.id = 'bounded-tw-css'; document.head.append(style); }
    style.textContent = cssText;
    let neutral = document.getElementById('bounded-tw-neutral-motion');
    if (!neutral) { neutral = document.createElement('style'); neutral.id = 'bounded-tw-neutral-motion'; document.head.append(neutral); }
    neutral.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
  }, text);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}
async function pixelDelta(a, b) {
  const x = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const y = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual(x.info, y.info);
  let changed = 0;
  for (let i = 0; i < x.data.length; i += 4)
    if (!x.data.subarray(i, i + 4).equals(y.data.subarray(i, i + 4))) changed++;
  return { changedPixels: changed, totalPixels: x.info.width * x.info.height };
}
try {
  for (const width of [390, 1280]) {
    for (const c of routeCases) {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: 844 },
        reducedMotion: 'reduce', locale: 'vi-VN', timezoneId: 'UTC' });
      await context.route((url) => url.origin !== base, async (route) => {
        blocked.push({ origin: new URL(route.request().url()).origin, method: route.request().method() });
        await route.abort();
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => {
        if (!['GET', 'HEAD'].includes(request.method()) && new URL(request.url()).pathname.startsWith('/api/'))
          forbiddenWrites.push({ method: request.method(), path: new URL(request.url()).pathname });
      });
      if (c.authenticated) {
        await page.goto(`${base}/__preview`);
        await page.getByRole('button', { name: '\u0110\u1eb7t l\u1ea1i d\u1eef li\u1ec7u th\u1eed nghi\u1ec7m v\u00e0 \u0111\u0103ng nh\u1eadp', exact: true }).click();
        await page.waitForURL(`${base}/planner`);
      }
      await page.goto(base + c.path);
      await expect(page.locator('h1')).toHaveCount(1);
      await page.waitForLoadState('networkidle');
      await page.mouse.move(-50, -50);
      await page.evaluate(() => Promise.all([...document.images].filter((image) => {
        const r = image.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0;
      }).map((image) => image.decode().catch(() => undefined))));
      const capturedPath = new URL(page.url()).pathname + new URL(page.url()).search;
      assert.equal(capturedPath, c.path, 'The requested screen must be the actual screen');
      if (c.id === 'auth-register') await expect(page.locator('input[type=\"email\"]')).toHaveCount(1);
      const id = `${width}-${c.id ?? c.path.slice(1).replaceAll('/', '-')}`;
      await installCss(page, baselineCss);
      if (c.state === 'forced-focus') await page.emulateMedia({ forcedColors: 'active' });
      if (c.state === 'focus' || c.state === 'forced-focus') await page.locator('input[type="email"]').focus();
      if (c.state === 'hover') await page.locator('button[class*="hover:"]').first().hover();
      const before = await stableSnapshot(page), baseline = await page.screenshot();
      await installCss(page, candidateCss);
      const after = await stableSnapshot(page), candidateImage = await page.screenshot();
      const changes = compare(before, after);
      await installCss(page, baselineCss);
      const recovered = await stableSnapshot(page), recovery = await page.screenshot();
      const drift = compare(before, recovered);
      const pixels = await pixelDelta(baseline, candidateImage), recoveryPixels = await pixelDelta(baseline, recovery);
      assert.deepEqual(drift, [], `${id}: baseline recovery drift`);
      // A nonzero self-control is retained as a pixel limitation, never waived.

      if (['390-auth-register', '390-fridge', '1280-planner-new'].includes(id)) {
        await writeFile(resolve(out, id + '-baseline.png'), baseline);
        await writeFile(resolve(out, id + '-candidate.png'), candidateImage);
      }
      const counts = {};
      for (const change of changes) { const key = change.property ?? change.kind; counts[key] = (counts[key] ?? 0) + 1; }
      checks.push({ case: id, requestedPath: c.path, capturedPath, width, baselineElements: before.length,
        candidateElements: after.length, changes: changes.length, changeCounts: counts, pixels,
        baselineRecovery: 'COMPUTED_EXACT', recoveryPixels, baselinePngSha256: hash(baseline), candidatePngSha256: hash(candidateImage),
        status: changes.length > 0 ? 'INCOMPATIBLE' : recoveryPixels.changedPixels > 0 ? 'PIXEL_CONTROL_DRIFT' : pixels.changedPixels === 0 ? 'PASS' : 'PIXEL_DIFFERENCE',
        examples: [...changes.filter((x) => x.property !== 'border-top-color'), ...changes.filter((x) => x.property === 'border-top-color')].slice(0, 24) });
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(forbiddenWrites, []);
  const receipt = { probeSourceSha256: hash(await readFile(new URL(import.meta.url))), classification: 'PAIRED_REAL_APP_CSS_ONLY_ISOLATED_PREVIEW', node: process.version,
    browserVersion: browser.version(), baselineCssSha256: hash(baselineCss), candidateCssSha256: hash(candidateCss),
    checks, pageErrors: errors.length, forbiddenApiWrites: forbiddenWrites.length, externalRequestsBlocked: blocked.length,
    compatibleCases: checks.filter((c) => c.status === 'PASS').length,
    incompatibleCases: checks.filter((c) => c.status === 'INCOMPATIBLE').length,
    limits: ['Chromium local CSS replacement, not deployed build/browser/device certification.',
      'Identical real application/fixture on each pair; animations neutralized equally.',
      'Only viewport pixels and listed computed properties compared; no private user data or external writes.'] };
  await writeFile(resolve(out, 'browser-comparison.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ cases: checks.length, compatible: receipt.compatibleCases,
    incompatible: receipt.incompatibleCases, baselineRecovery: 'COMPUTED_EXACT', pageErrors: errors.length, forbiddenApiWrites: forbiddenWrites.length }));
} finally { await browser.close(); }
