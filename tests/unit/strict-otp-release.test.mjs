import { readFileSync } from 'node:fs';
import { CATALOG_RELEASE_MANIFEST } from '../../scripts/d1-migration-check.mjs';
import { describe, expect, it } from 'vitest';
import { needsRecovery, verifyRecoveryVersion, verifyRecoveryDeployment } from '../../scripts/strict-otp-release.mjs';

const sha = 'a'.repeat(40);
const manifest = { sha, environment: 'production', cloudflare: { databaseId: 'f975ec39-b2c8-4a2a-80e1-0366054599d3' },
  recipeCatalogMode: 'd1', recipeCatalogCanaryPercent: 0, recipeCatalogCutoverEnabled: true,
  mealCompositionV2Enabled: true };
const version = () => ({ id: 'recovery-version', resources: { bindings: [
  { type: 'd1', name: 'DB', id: manifest.cloudflare.databaseId },
  ...Object.entries({ GIT_COMMIT: sha, STRICT_OTP_FAIL_CLOSED: 'true', ENVIRONMENT: 'production',
    RECIPE_CATALOG_MODE: 'd1', RECIPE_CATALOG_D1_CANARY_PERCENT: '0', RECIPE_CATALOG_CUTOVER_ENABLED: 'true',
    MEAL_PLANNER_ENABLED: 'true', MEAL_COMPOSITION_V2_ENABLED: 'true' }).map(([name, text]) => ({ type: 'plain_text', name, text })),
] } });

describe('strict OTP named recovery source and binding proof', () => {
  it('identifies legacy comparison using the observed Worker commit source', () => {
    expect(needsRecovery(version(), () => 'legacyVerification')).toBe(true);
    expect(needsRecovery(version(), () => 'issueStrictOtp')).toBe(false);
    expect(() => needsRecovery({ resources: { bindings: [] } })).toThrow(/commit/);
  });
  it('certifies only the exact source, D1 and paired flags with explicit maintenance', () => {
    expect(verifyRecoveryVersion(manifest, version())).toMatchObject({ kind: 'STRICT_OTP_FAIL_CLOSED', commit: sha });
    for (const name of ['GIT_COMMIT', 'STRICT_OTP_FAIL_CLOSED', 'MEAL_COMPOSITION_V2_ENABLED', 'RECIPE_CATALOG_MODE']) {
      const wrong = version(); wrong.resources.bindings.find((b) => b.name === name).text = 'wrong';
      expect(() => verifyRecoveryVersion(manifest, wrong)).toThrow();
    }
  });
});


describe('strict OTP recovery proves active deployment and catalog authority', () => {
  const release = JSON.parse(readFileSync(CATALOG_RELEASE_MANIFEST, 'utf8'));
  const active = { id: 'new-deployment', versions: [{ version_id: 'recovery-version', percentage: 100 }] };
  const target = { ...manifest, strictOtpRecovery: { versionId: 'recovery-version' }, previousDeployment: { deploymentId: 'previous-deployment' } };
  const mutation = { versionId: 'recovery-version', deploymentId: 'new-deployment' };
  const authority = { schemaVersion: 1, environment: 'production', commit: sha, configuredMode: 'd1',
    cutoverEnabled: true, canaryPercent: 0, releaseId: release.releaseId,
    expectedRecipeCount: release.expectedRecipeCount, expectedRuntimeFingerprint: release.expectedRuntimeFingerprint,
    selectedSource: 'd1', actualSource: 'd1', fallbackReason: null, d1Readiness: 'ready', d1ReadinessCode: null,
    servedRecipeCount: release.expectedRecipeCount, servedFingerprint: release.expectedRuntimeFingerprint,
    fingerprintMatchesRelease: true, globalSource: 'd1' };
  it('accepts only the named new 100-percent deployment with matching mutation and catalog', () => {
    expect(verifyRecoveryDeployment(target, active, version(), authority, mutation)).toMatchObject({ result: 'restored-fail-closed' });
    expect(() => verifyRecoveryDeployment(target, { ...active, id: 'previous-deployment' }, version(), authority, mutation)).toThrow();
    expect(() => verifyRecoveryDeployment(target, { ...active, versions: [{ version_id: 'recovery-version', percentage: 50 }] }, version(), authority, mutation)).toThrow();
    expect(() => verifyRecoveryDeployment(target, active, version(), authority, { ...mutation, versionId: 'wrong' })).toThrow();
    expect(() => verifyRecoveryDeployment(target, active, version(), authority, { ...mutation, deploymentId: 'wrong' })).toThrow();
    expect(() => verifyRecoveryDeployment(target, active, version(), { ...authority, commit: 'b'.repeat(40) }, mutation)).toThrow();
    expect(() => verifyRecoveryDeployment(target, active, version(), { ...authority, fallbackReason: 'unavailable' }, mutation)).toThrow();
  });
});
