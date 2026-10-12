import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { CATALOG_RELEASE_MANIFEST } from './d1-migration-check.mjs';
import { pathToFileURL } from 'node:url';
import { verifyWorkerD1Binding, verifyStableWorkerDeployment, verifyRecipeAuthorityEvidence } from './release-check.mjs';

const VAR = 'STRICT_OTP_FAIL_CLOSED';
const SHA = /^[a-f0-9]{40}$/;
const plain = (version, name) => version?.resources?.bindings?.find((b) => b.type === 'plain_text' && b.name === name)?.text;

export function needsRecovery(version, readSource = (sha) => execFileSync('git', ['show', `${sha}:src/worker/routes/auth.ts`], { encoding: 'utf8' })) {
  const commit = plain(version, 'GIT_COMMIT');
  if (!SHA.test(commit ?? '')) throw new Error('Previous Worker source commit missing');
  return !readSource(commit).includes('issueStrictOtp');
}

export function verifyRecoveryVersion(manifest, version) {
  const binding = verifyWorkerD1Binding(version);
  if (binding.databaseId !== manifest.cloudflare?.databaseId || plain(version, 'GIT_COMMIT') !== manifest.sha || plain(version, VAR) !== 'true')
    throw new Error('Recovery must use the exact candidate, certified D1 and fail-closed OTP');
  const expected = {
    ENVIRONMENT: 'production', RECIPE_CATALOG_MODE: manifest.recipeCatalogMode,
    RECIPE_CATALOG_D1_CANARY_PERCENT: String(manifest.recipeCatalogCanaryPercent),
    RECIPE_CATALOG_CUTOVER_ENABLED: String(manifest.recipeCatalogCutoverEnabled),
    MEAL_PLANNER_ENABLED: String(manifest.mealCompositionV2Enabled),
    MEAL_COMPOSITION_V2_ENABLED: String(manifest.mealCompositionV2Enabled),
  };
  for (const [key, value] of Object.entries(expected)) if (plain(version, key) !== value) throw new Error(`Recovery flag mismatch: ${key}`);
  return { versionId: binding.versionId, commit: manifest.sha, binding, kind: 'STRICT_OTP_FAIL_CLOSED', checkedAt: new Date().toISOString() };
}

export function verifyRecoveryDeployment(manifest, deployment, version, authority, mutation) {
  const active = verifyStableWorkerDeployment(deployment);
  const proof = verifyRecoveryVersion(manifest, version);
  if (proof.versionId !== manifest.strictOtpRecovery?.versionId || active.versionId !== proof.versionId || active.deploymentId === manifest.previousDeployment?.deploymentId || mutation?.versionId !== proof.versionId || (mutation.deploymentId !== null && mutation.deploymentId !== active.deploymentId))
    throw new Error('Recovery deployment/mutation does not match the verified named version');
  verifyRecipeAuthorityEvidence(manifest, authority, JSON.parse(readFileSync(CATALOG_RELEASE_MANIFEST, 'utf8')));
  return { result: 'restored-fail-closed', ...active, binding: proof.binding, checkedAt: new Date().toISOString() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, file = 'release-manifest.json', ...args] = process.argv.slice(2);
  const read = (name) => JSON.parse(readFileSync(name, 'utf8'));
  const manifest = read(file);
  if (command === 'needed') process.stdout.write(needsRecovery(read(args[0])) ? 'true' : 'false');
  else if (command === 'version-id') {
    const records = readFileSync(args[0], 'utf8').trim().split('\n').map((line) => JSON.parse(line)).filter((r) => r.type === 'version-upload');
    if (records.length !== 1 || !/^[a-f0-9-]{36}$/.test(records[0].version_id ?? '')) throw new Error('Expected one uploaded recovery version');
    process.stdout.write(records[0].version_id);
  } else if (command === 'certify') {
    manifest.strictOtpRecovery = verifyRecoveryVersion(manifest, read(args[0]));
    writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  } else if (command === 'deployed') {
    manifest.rollback = verifyRecoveryDeployment(manifest, read(args[0]), read(args[1]), read(args[2]), read(args[3]));
    writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  } else throw new Error('Unknown strict OTP release command');
}
