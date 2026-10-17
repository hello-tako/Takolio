import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { beforeAll, afterAll, expect, it } from 'vitest';

const runtimeRequire = createRequire(realpathSync(resolve('node_modules/wrangler/package.json')));
const { Miniflare, convertV4MiniflareOptions } = runtimeRequire('miniflare');
const buildRequire = createRequire(realpathSync(resolve('node_modules/vite/package.json')));
const { build } = buildRequire('esbuild');
let directory;
const runtimes = {};

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'takolio-domain-assets-'));
  writeFileSync(join(directory, 'index.html'), readFileSync('index.html'));
  writeFileSync(join(directory, 'manifest.json'), readFileSync('public/manifest.json'));
  mkdirSync(join(directory, 'api/v1'), { recursive: true });
  writeFileSync(join(directory, 'api/v1/health'), 'must not bypass Worker');
  const result = await build({ stdin: { contents: `
    import worker from './src/worker/index.ts';
    export default { fetch(request, env, ctx) {
      return worker.fetch(request, { ...env, DB: {}, CACHE: {}, AI: {}, SCAN_QUEUE: {} }, ctx);
    } };`, resolveDir: process.cwd(), loader: 'js' },
    bundle: true, format: 'esm', platform: 'browser', write: false, logLevel: 'silent' });
  for (const environment of ['production', 'staging']) {
    runtimes[environment] = new Miniflare(convertV4MiniflareOptions({ modules: true, script: result.outputFiles[0].text,
      compatibilityDate: '2024-11-01', compatibilityFlags: ['nodejs_compat'],
      assets: { directory, binding: 'ASSETS', run_worker_first: true, routerConfig: { has_user_worker: true },
        assetConfig: { html_handling: 'auto-trailing-slash', not_found_handling: 'single-page-application' } },
      bindings: { ENVIRONMENT: environment, APP_URL: environment === 'production' ? 'https://takolio.app' : 'https://staging.takolio.app',
        PUBLIC_DOMAIN_ROUTING: 'true', QWEN_API_KEY: 'fixture-only', JWT_SECRET: 'fixture-only', OTP_HASH_SECRET: 'fixture-only',
        TURNSTILE_SITE_KEY: 'fixture', TURNSTILE_SECRET_KEY: 'fixture' },
      outboundService: () => { throw new Error('External provider calls forbidden'); },
    }));
  }
});
afterAll(async () => {
  await Promise.all(Object.values(runtimes).map((runtime) => runtime.dispose()));
  if (directory) rmSync(directory, { recursive: true });
});

it('runs the real Worker before Static Assets for WWW, API and association boundaries', async () => {
  const runtime = runtimes.production;
  const www = await runtime.dispatchFetch('https://www.takolio.app/recipes/fixture?q=1', { redirect: 'manual' });
  expect(www.status).toBe(308);
  expect(www.headers.get('Location')).toBe('https://takolio.app/recipes/fixture?q=1');
  const health = await runtime.dispatchFetch('https://api.takolio.app/api/v1/health');
  expect(health.status).toBe(200);
  expect(health.headers.get('Content-Type')).toContain('application/json');
  for (const url of ['https://api.takolio.app/', 'https://admin.takolio.app/', 'https://takolio.app/.well-known/assetlinks.json']) {
    const response = await runtime.dispatchFetch(url);
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).not.toContain('text/html');
  }
});

it('rewrites actual Static Assets SPA responses without stale validators', async () => {
  const root = await runtimes.production.dispatchFetch('https://takolio.app/');
  expect(root.status).toBe(200);
  expect(root.headers.get('ETag')).toBeNull();
  expect(root.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  expect(await root.text()).toContain('rel="canonical" href="https://takolio.app/"');
  const nested = await runtimes.production.dispatchFetch('https://takolio.app/recipes/fixture');
  expect(nested.status).toBe(200);
  expect(nested.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
});

it('applies staging noindex to real manifest assets as well as nested SPA responses', async () => {
  for (const path of ['/manifest.json', '/recipes/fixture']) {
    const response = await runtimes.staging.dispatchFetch(`https://staging.takolio.app${path}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  }
});
