import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { captureRecoveryBuild, verifyServedRecoveryAssets } from '../../scripts/family-meal-release.mjs';
import profiles from '../../config/domain-profiles.json' with { type: 'json' };

const runtimeRequire = createRequire(realpathSync(resolve('node_modules/wrangler/package.json')));
const { Miniflare, convertV4MiniflareOptions } = runtimeRequire('miniflare');
const buildRequire = createRequire(realpathSync(resolve('node_modules/vite/package.json')));
const { build } = buildRequire('esbuild');
let directory;
const runtimes = {};

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'takolio-domain-assets-'));
  writeFileSync(join(directory, 'index.html'), readFileSync('index.html', 'utf8').replace('/src/web/main.tsx', '/assets/recovery.js'));
  mkdirSync(join(directory, 'assets'));
  writeFileSync(join(directory, 'assets/recovery.js'), 'export const planner = false;');
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

for (const environment of ['staging', 'production']) {
  it(`proves exact OFF assets after real ${environment} domain middleware rewriting`, async () => {
    const flags = { VITE_MEAL_PLANNER_ENABLED: 'false', VITE_MEAL_COMPOSITION_V2_ENABLED: 'false' };
    const raw = captureRecoveryBuild(flags, directory);
    const record = captureRecoveryBuild(flags, directory, { appOrigin: profiles[environment].app });
    expect(record.assets.modules).toEqual(raw.assets.modules);
    expect(record.assets.html).not.toEqual(raw.assets.html);
    const origin = profiles[environment].legacy;
    const fetch = (url, options) => runtimes[environment].dispatchFetch(url, options);
    await expect(verifyServedRecoveryAssets(raw, { url: origin, fetch })).rejects.toThrow('recorded size');
    await expect(verifyServedRecoveryAssets(record, { url: origin, fetch })).resolves.toMatchObject({ result: 'exact-flags-off-assets' });
    for (const mutate of [
      (html) => html.replace('summary_large_image', 'summary_small_image'),
      (html) => html.replace('</body>', '<script src="https://unexpected.test/x.js"></script></body>'),
      (html) => html.replace('/assets/recovery.js', '/assets/other-on.js'),
    ]) {
      await expect(verifyServedRecoveryAssets(record, { url: origin, fetch: async (url, options) => {
        const response = await fetch(url, options);
        return url.pathname === '/' ? new Response(mutate(await response.text()), { headers: response.headers }) : response;
      } })).rejects.toThrow(/recorded size|different compiled assets/);
    }
    await expect(verifyServedRecoveryAssets(record, { url: origin, fetch: async (url, options) =>
      url.pathname === '/' ? fetch(url, options) : new Response('export const planner = true; ', { headers: { 'Content-Type': 'text/javascript' } }),
    })).rejects.toThrow(/recorded size|different compiled assets/);
  });
}
