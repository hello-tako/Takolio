import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve('eslint/package.json'))('js-yaml');
import { captureRecoveryBuild, needsRecovery, verifyRecoveryBuild, verifyRecoveryDeployment, verifyRecoveryVersion, verifyServedRecoveryAssets } from '../../scripts/family-meal-release.mjs';
import { PRODUCTION_D1 } from '../../scripts/d1-migration-check.mjs';
const release = JSON.parse(readFileSync('packages/recipes/src/import/catalog-release.current.json', 'utf8'));
const manifest = {
  environment: 'production', sha: 'a'.repeat(40), schema: { version: '0043_shopping_demand_review.sql' },
  cloudflare: { databaseId: PRODUCTION_D1.id }, recipeCatalogMode: 'd1',
  recipeCatalogCanaryPercent: 0, recipeCatalogCutoverEnabled: true,
  previousDeployment: { deploymentId: 'old-deployment' }, familyMealRecovery: { versionId: 'family-version' },
};
const build = { VITE_MEAL_PLANNER_ENABLED: 'false', VITE_MEAL_COMPOSITION_V2_ENABLED: 'false' };
const version = () => ({ id: 'family-version', resources: { bindings: [
  { type: 'd1', name: 'DB', id: PRODUCTION_D1.id },
  ...Object.entries({ GIT_COMMIT: manifest.sha, ENVIRONMENT: 'production', STRICT_OTP_FAIL_CLOSED: 'false',
    MEAL_PLANNER_ENABLED: 'false', MEAL_COMPOSITION_V2_ENABLED: 'false', RECIPE_CATALOG_MODE: 'd1',
    RECIPE_CATALOG_D1_CANARY_PERCENT: '0', RECIPE_CATALOG_CUTOVER_ENABLED: 'true',
  }).map(([name, text]) => ({ type: 'plain_text', name, text })),
] } });
const deployment = { id: 'new-deployment', versions: [{ version_id: 'family-version', percentage: 100 }] };
const authority = {
  schemaVersion: 1, environment: 'production', commit: manifest.sha, configuredMode: 'd1',
  cutoverEnabled: true, canaryPercent: 0, globalSource: 'd1', selectedSource: 'd1', actualSource: 'd1',
  releaseId: release.releaseId, expectedRecipeCount: 500, servedRecipeCount: 500,
  servedFingerprint: release.expectedRuntimeFingerprint, expectedRuntimeFingerprint: release.expectedRuntimeFingerprint,
  fingerprintMatchesRelease: true, d1Readiness: 'ready', d1ReadinessCode: null, fallbackReason: null,
};
const mutation = { versionId: 'family-version', deploymentId: 'new-deployment' };

describe('family-meal recovery uses compatible code and paired flags-off assets', () => {
  it('requires named recovery at the production 0043 schema tip', () => {
    expect(needsRecovery(manifest)).toBe(true);
    expect(needsRecovery({ ...manifest, environment: 'staging' })).toBe(false);
    expect(needsRecovery({ ...manifest, schema: { version: '0041_checkout_admission.sql' } })).toBe(false);
  });
  it('certifies exact candidate, D1 and disabled UI and server flags', () => {
    expect(verifyRecoveryVersion(manifest, version(), build)).toMatchObject({ versionId: 'family-version', kind: 'FAMILY_MEAL_FLAGS_OFF' });
    expect(() => verifyRecoveryBuild({ ...build, VITE_MEAL_PLANNER_ENABLED: 'true' })).toThrow();
  });
  it.each(['GIT_COMMIT','ENVIRONMENT','MEAL_PLANNER_ENABLED','MEAL_COMPOSITION_V2_ENABLED','STRICT_OTP_FAIL_CLOSED','RECIPE_CATALOG_MODE','RECIPE_CATALOG_D1_CANARY_PERCENT','RECIPE_CATALOG_CUTOVER_ENABLED'])('rejects drift in %s', (name) => {
    const wrong = version();
    wrong.resources.bindings = wrong.resources.bindings.map((binding) => binding.name === name ? { ...binding, text: 'wrong' } : binding);
    expect(() => verifyRecoveryVersion(manifest, wrong, build)).toThrow();
  });
  it('rejects incomplete candidate identity and a different certified D1', () => {
    expect(() => verifyRecoveryVersion({ ...manifest, sha: 'short' }, version(), build)).toThrow('production 0043 candidate');
    expect(() => verifyRecoveryVersion({ ...manifest, environment: 'staging' }, version(), build)).toThrow('production 0043 candidate');
    expect(() => verifyRecoveryVersion({ ...manifest, cloudflare: { databaseId: 'other' } }, version(), build)).toThrow('exact candidate and certified D1');
    const wrong = version();
    wrong.resources.bindings[0].id = 'other';
    expect(() => verifyRecoveryVersion(manifest, wrong, build)).toThrow('pinned production database');
  });
  it('requires named 100-percent deployment, matching mutation and healthy catalog', () => {
    expect(verifyRecoveryDeployment(manifest, deployment, version(), mutation, authority, build)).toMatchObject({ result: 'restored-family-meal-flags-off' });
    expect(() => verifyRecoveryDeployment(manifest, { ...deployment, versions: [{ version_id: 'family-version', percentage: 50 }] }, version(), mutation, authority, build)).toThrow();
    expect(() => verifyRecoveryDeployment(manifest, deployment, version(), { ...mutation, versionId: 'old' }, authority, build)).toThrow();
    expect(() => verifyRecoveryDeployment(manifest, deployment, version(), mutation, { ...authority, fallbackReason: 'bad' }, build)).toThrow();
  });
  it('prepares recovery before upload and rebuilds the approved active flags afterwards', () => {
    const steps = load(readFileSync('.github/workflows/deploy.yml', 'utf8')).jobs.production.steps;
    const prepare = steps.findIndex((step) => step.name === 'Prepare compatible family-meal recovery before serving traffic');
    const upload = steps.findIndex((step) => step.id === 'deploy');
    expect(prepare).toBeGreaterThan(0);
    expect(prepare).toBeLessThan(upload);
    expect(steps[prepare].run).toContain('VITE_MEAL_PLANNER_ENABLED=false VITE_MEAL_COMPOSITION_V2_ENABLED=false pnpm build');
    expect(steps[prepare].run).toContain('node scripts/family-meal-release.mjs build-proof dist/composition-flags.json family-recovery-build.json dist/client');
    expect(steps[prepare].run).toContain('VITE_MEAL_PLANNER_ENABLED="${COMPOSITION_ENABLED}"');
    expect(steps[prepare].run).toContain('node scripts/composition-flags.mjs verify');
    const rollback = steps.find((step) => step.name === 'Restore exact previous Worker after any failed deployment or proof');
    expect(rollback.run.indexOf('familyMealRecovery')).toBeLessThan(rollback.run.indexOf('strictOtpRecovery'));
  });
});


describe('family recovery live assets identify the flags-off build within the same SHA', () => {
  let directory;
  const origin = 'https://frigo.example';
  const html = '<!doctype html><html><script type="module" crossorigin src="/assets/index-off.js"></script></html>';
  const module = 'const plannerEnabled=false;const compositionEnabled=false;';
  const capture = (document = html) => {
    directory = mkdtempSync(path.join(tmpdir(), 'family-recovery-assets-'));
    mkdirSync(path.join(directory, 'assets'));
    writeFileSync(path.join(directory, 'index.html'), document);
    writeFileSync(path.join(directory, 'assets/index-off.js'), module);
    return captureRecoveryBuild(build, directory);
  };
  afterEach(() => {
    if (directory) rmSync(directory, { recursive: true });
    directory = undefined;
  });
  const response = (asset, overrides = {}) => new Response(asset === '/' ? html : module, {
    status: 200,
    headers: { 'Content-Type': asset === '/' ? 'text/html; charset=UTF-8' : 'application/javascript' },
    ...overrides,
  });
  it('captures the exact local entry HTML and compiled module bytes', () => {
    const record = capture();
    expect(record.assets.html).toMatchObject({ path: '/', bytes: Buffer.byteLength(html) });
    expect(record.assets.modules).toHaveLength(1);
    expect(record.assets.modules[0]).toMatchObject({ path: '/assets/index-off.js', bytes: Buffer.byteLength(module) });
    expect(record.assets.modules[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it.each(['http://example.test', 'https://example.test/', 'https://example.test/path', 'https://example.test?x=1'])('rejects unsafe domain metadata origin %s', (appOrigin) => {
    capture();
    expect(() => captureRecoveryBuild(build, directory, { appOrigin })).toThrow('exact HTTPS origin');
  });
  it('rejects domain HTML without a head instead of recording an untransformed shell', () => {
    capture();
    expect(() => captureRecoveryBuild(build, directory, { appOrigin: origin })).toThrow('must contain a head');
  });
  it('CLI captures and certifies the uploaded build evidence using the workflow arguments', () => {
    const record = capture();
    const flagsFile = path.join(directory, 'composition-flags.json');
    const proofFile = path.join(directory, 'family-recovery-build.json');
    const versionFile = path.join(directory, 'family-recovery-version.json');
    const manifestFile = path.join(directory, 'release-manifest.json');
    writeFileSync(flagsFile, JSON.stringify(build));
    writeFileSync(versionFile, JSON.stringify(version()));
    writeFileSync(manifestFile, JSON.stringify(manifest));
    execFileSync(process.execPath, ['scripts/family-meal-release.mjs', 'build-proof', flagsFile, proofFile, directory]);
    expect(JSON.parse(readFileSync(proofFile, 'utf8'))).toEqual(record);
    execFileSync(process.execPath, ['scripts/family-meal-release.mjs', 'certify', manifestFile, versionFile, proofFile]);
    expect(JSON.parse(readFileSync(manifestFile, 'utf8')).familyMealRecovery).toMatchObject({
      versionId: 'family-version', kind: 'FAMILY_MEAL_FLAGS_OFF', assets: record.assets,
    });
  });
  it('verifies every served byte with bounded public requests and no redirects', async () => {
    const record = capture();
    const requests = [];
    const result = await verifyServedRecoveryAssets(record, { url: origin, fetch: async (url, options) => {
      requests.push({ url: url.href, options });
      return response(url.pathname);
    } });
    expect(result).toMatchObject({ result: 'exact-flags-off-assets', modules: [{ path: '/assets/index-off.js' }] });
    expect(requests.map(({ url }) => url)).toEqual([origin + '/', origin + '/assets/index-off.js']);
    for (const { options } of requests) {
      expect(options).toMatchObject({ method: 'GET', redirect: 'error', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });
  it('rejects another flags-on build even when its deployment SHA is unchanged', async () => {
    const record = capture();
    await expect(verifyServedRecoveryAssets(record, { url: origin, fetch: async (url) =>
      url.pathname === '/' ? response('/') : new Response(module.replace('false', 'true'), { headers: { 'Content-Type': 'text/javascript' } }),
    })).rejects.toThrow('different compiled assets');
  });
  it.each([
    '<script type="module" src="https://other.example/assets/index.js"></script>',
    '<script type="module" src="/assets/../index.js"></script>',
    '<script type="module" src="/assets/index-off.js?secret=value"></script>',
    '<script type="module" src="/assets/index-off.js"></script><script type="module" src="/assets/index-off.js"></script>',
    '<html>No module</html>',
  ])('rejects unsupported local asset references %s', (document) => {
    expect(() => capture(document)).toThrow('unique local module assets');
  });
  it.each(['http://frigo.example', origin + '/path', origin + '/?token=value'])('rejects non-origin URLs %s before a fetch', async (url) => {
    let called = false;
    await expect(verifyServedRecoveryAssets(capture(), { url, fetch: async () => { called = true; return response('/'); } })).rejects.toThrow('exact HTTPS origin');
    expect(called).toBe(false);
  });
  it('rejects a record without byte evidence before a fetch', async () => {
    let called = false;
    await expect(verifyServedRecoveryAssets(build, { url: origin, fetch: async () => { called = true; return response('/'); } })).rejects.toThrow('asset evidence');
    expect(called).toBe(false);
  });
  it('rejects unsafe record URLs before a fetch', async () => {
    const record = capture();
    record.assets.modules[0].path = '//other.example/asset.js';
    await expect(verifyServedRecoveryAssets(record, { url: origin })).rejects.toThrow('asset evidence');
  });
  it.each([
    { status: 404 }, { status: 302, headers: { 'Content-Type': 'text/html', Location: '/login' } },
    { headers: { 'Content-Type': 'application/json' } },
  ])('rejects failed or unexpected asset responses %j', async (overrides) => {
    await expect(verifyServedRecoveryAssets(capture(), { url: origin, fetch: async () => response('/', overrides) })).rejects.toThrow('asset response');
  });
  it('rejects HTML larger than the exact recorded asset', async () => {
    await expect(verifyServedRecoveryAssets(capture(), { url: origin, fetch: async () => new Response(html + 'extra', { headers: { 'Content-Type': 'text/html' } }) })).rejects.toThrow('recorded size');
  });
  it('requires both UI flags off when capturing a build', () => {
    expect(() => captureRecoveryBuild({ ...build, VITE_MEAL_COMPOSITION_V2_ENABLED: 'true' })).toThrow('both flags disabled');
  });
});
