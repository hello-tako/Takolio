import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CATALOG_RELEASE_MANIFEST } from './d1-migration-check.mjs';
import { verifyWorkerD1Binding, verifyStableWorkerDeployment, verifyRecipeAuthorityEvidence } from './release-check.mjs';

const plain = (version, name) => version?.resources?.bindings?.find((binding) => binding?.type === 'plain_text' && binding.name === name)?.text;
const ASSET_PATH = /^\/assets\/[A-Za-z0-9_-]+\.js$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_HTML_BYTES = 1024 * 1024;
const MAX_MODULE_BYTES = 8 * 1024 * 1024;
const MAX_MODULES = 8;

export function needsRecovery(manifest) {
  return manifest?.environment === 'production' && manifest?.schema?.version === '0043_shopping_demand_review.sql';
}

export function verifyRecoveryBuild(record) {
  if (record?.VITE_MEAL_PLANNER_ENABLED !== 'false' || record?.VITE_MEAL_COMPOSITION_V2_ENABLED !== 'false') {
    throw new Error('Family recovery UI must compile both flags disabled');
  }
  return { planner: false, composition: false };
}

function assetFingerprint(assetPath, bytes, limit) {
  if (bytes.length === 0 || bytes.length > limit) throw new Error('Family recovery asset size is outside the verified limit');
  return { path: assetPath, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

// Same-SHA on/off builds need byte evidence: the service worker SHA alone cannot distinguish them.
export function captureRecoveryBuild(record, directory = 'dist/client') {
  verifyRecoveryBuild(record);
  const html = readFileSync(path.join(directory, 'index.html'));
  const modules = [...html.toString('utf8').matchAll(/<script\b([^>]*)>/gi)]
    .map((match) => match[1])
    .filter((attributes) => /\btype\s*=\s*["']module["']/i.test(attributes))
    .map((attributes) => /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1]);
  if (modules.length === 0 || modules.length > MAX_MODULES || new Set(modules).size !== modules.length ||
      modules.some((module) => !ASSET_PATH.test(module ?? ''))) {
    throw new Error('Family recovery HTML must reference unique local module assets');
  }
  return { ...record, assets: {
    html: assetFingerprint('/', html, MAX_HTML_BYTES),
    modules: modules.map((module) => assetFingerprint(module, readFileSync(path.join(directory, module.slice(1))), MAX_MODULE_BYTES)),
  } };
}

function verifyAssetRecord(record) {
  verifyRecoveryBuild(record);
  const html = record.assets?.html;
  const modules = record.assets?.modules;
  const valid = (asset, limit) => SHA256.test(asset?.sha256 ?? '') && Number.isSafeInteger(asset?.bytes) && asset.bytes > 0 && asset.bytes <= limit;
  if (html?.path !== '/' || !valid(html, MAX_HTML_BYTES) || !Array.isArray(modules) ||
      modules.length === 0 || modules.length > MAX_MODULES || new Set(modules.map((module) => module?.path)).size !== modules.length ||
      modules.some((module) => !ASSET_PATH.test(module?.path ?? '') || !valid(module, MAX_MODULE_BYTES))) {
    throw new Error('Family recovery asset evidence is missing or malformed');
  }
  return { html, modules };
}

export async function verifyServedRecoveryAssets(record, { url, fetch: fetchImpl = globalThis.fetch } = {}) {
  const origin = new URL(url);
  if (origin.protocol !== 'https:' || origin.origin !== url) throw new Error('Family recovery URL must be an exact HTTPS origin');
  const { html, modules } = verifyAssetRecord(record);
  const signal = AbortSignal.timeout(15_000);
  const verify = async (asset, limit, types) => {
    const response = await fetchImpl(new URL(asset.path, origin), {
      method: 'GET', signal, redirect: 'error', cache: 'no-store',
      headers: { Accept: types.join(', '), 'Cache-Control': 'no-cache' },
    });
    if (response.status !== 200 || !types.includes((response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()) || !response.body) {
      throw new Error(`Family recovery asset response is invalid: ${asset.path}`);
    }
    const reader = response.body.getReader();
    const digest = createHash('sha256');
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > limit || bytes > asset.bytes) {
          void reader.cancel().catch(() => {});
          throw new Error(`Family recovery asset exceeds its recorded size: ${asset.path}`);
        }
        digest.update(value);
      }
    } finally { reader.releaseLock(); }
    if (bytes !== asset.bytes || digest.digest('hex') !== asset.sha256) {
      throw new Error(`Family recovery serves different compiled assets: ${asset.path}`);
    }
    return { path: asset.path, sha256: asset.sha256, bytes, httpStatus: 200 };
  };
  const servedHtml = await verify(html, MAX_HTML_BYTES, ['text/html']);
  const servedModules = await Promise.all(modules.map((module) => verify(module, MAX_MODULE_BYTES, ['text/javascript', 'application/javascript'])));
  return { result: 'exact-flags-off-assets', html: servedHtml, modules: servedModules, checkedAt: new Date().toISOString() };
}

export function verifyRecoveryVersion(manifest, version, record) {
  if (!needsRecovery(manifest) || !/^[a-f0-9]{40}$/.test(manifest.sha ?? '')) {
    throw new Error('Family recovery requires the production 0043 candidate');
  }
  const build = verifyRecoveryBuild(record);
  const binding = verifyWorkerD1Binding(version);
  if (binding.databaseId !== manifest.cloudflare?.databaseId || plain(version, 'GIT_COMMIT') !== manifest.sha) {
    throw new Error('Family recovery must use the exact candidate and certified D1');
  }
  const expected = {
    ENVIRONMENT: 'production', STRICT_OTP_FAIL_CLOSED: 'false',
    MEAL_PLANNER_ENABLED: 'false', MEAL_COMPOSITION_V2_ENABLED: 'false',
    RECIPE_CATALOG_MODE: manifest.recipeCatalogMode,
    RECIPE_CATALOG_D1_CANARY_PERCENT: String(manifest.recipeCatalogCanaryPercent),
    RECIPE_CATALOG_CUTOVER_ENABLED: String(manifest.recipeCatalogCutoverEnabled),
  };
  for (const [name, value] of Object.entries(expected)) {
    if (plain(version, name) !== value) throw new Error(`Family recovery flag mismatch: ${name}`);
  }
  return { versionId: binding.versionId, commit: manifest.sha, binding, build, kind: 'FAMILY_MEAL_FLAGS_OFF', checkedAt: new Date().toISOString() };
}

export function verifyRecoveryDeployment(manifest, deployment, version, mutation, authority, record) {
  const active = verifyStableWorkerDeployment(deployment);
  const proof = verifyRecoveryVersion(manifest, version, record);
  if (proof.versionId !== manifest.familyMealRecovery?.versionId || active.versionId !== proof.versionId ||
      active.deploymentId === manifest.previousDeployment?.deploymentId || mutation?.versionId !== proof.versionId ||
      (mutation.deploymentId !== null && mutation.deploymentId !== active.deploymentId)) {
    throw new Error('Family recovery deployment/mutation does not match the verified named version');
  }
  verifyRecipeAuthorityEvidence(manifest, authority, JSON.parse(readFileSync(CATALOG_RELEASE_MANIFEST, 'utf8')));
  return { result: 'restored-family-meal-flags-off', ...active, binding: proof.binding, build: proof.build, checkedAt: new Date().toISOString() };
}

async function main() {
  const [command, file = 'release-manifest.json', ...args] = process.argv.slice(2);
  const read = (name) => JSON.parse(readFileSync(name, 'utf8'));
  if (command === 'build-proof') {
    writeFileSync(args[0], JSON.stringify(captureRecoveryBuild(read(file), args[1]), null, 2) + '\n');
    return;
  }
  const manifest = read(file);
  if (command === 'needed') process.stdout.write(needsRecovery(manifest) && !manifest.strictOtpRecovery ? 'true' : 'false');
  else if (command === 'certify') {
    const record = read(args[1]);
    verifyAssetRecord(record);
    manifest.familyMealRecovery = { ...verifyRecoveryVersion(manifest, read(args[0]), record), assets: record.assets };
    writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  } else if (command === 'deployed') {
    const record = read(args[4]);
    if (JSON.stringify(record.assets) !== JSON.stringify(manifest.familyMealRecovery?.assets)) {
      throw new Error('Family recovery assets differ from the certified version evidence');
    }
    const rollback = verifyRecoveryDeployment(manifest, read(args[0]), read(args[1]), read(args[2]), read(args[3]), record);
    const assets = await verifyServedRecoveryAssets(record, { url: process.env.APP_SMOKE_URL });
    manifest.rollback = { ...rollback, assets };
    writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  } else throw new Error('Unknown family meal release command');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Family recovery verification failed');
    process.exitCode = 1;
  });
}
