import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  D1_CATALOG_CONTINUITY_PATHS,
  validateRecipeCatalogTransition,
  verifyD1CatalogContinuity,
} from '../../scripts/release-check.mjs';

const previousSha = 'a'.repeat(40), candidateSha = 'b'.repeat(40);
const release = {
  releaseId: 'rel-test', expectedRecipeCount: 500, expectedRuntimeFingerprint: 'b'.repeat(64),
  legacyBaselineCount: 71, legacyBaselineFingerprint: 'a'.repeat(64),
};
const databaseId = 'f975ec39-b2c8-4a2a-80e1-0366054599d3';
const manifest = (changes = {}) => ({
  sha: candidateSha, environment: 'production', recipeCatalogMode: 'd1',
  recipeCatalogCanaryPercent: 0, recipeCatalogCutoverEnabled: true, mealCompositionV2Enabled: true,
  cloudflare: { databaseId, databaseName: 'frigo-db' },
  previousDeployment: { versionId: 'previous-version', deploymentId: 'previous-deployment' },
  ...changes,
});
const evidence = (changes = {}) => ({
  schemaVersion: 1, environment: 'production', commit: previousSha,
  configuredMode: 'd1', canaryPercent: 0, cutoverEnabled: true, globalSource: 'd1',
  releaseId: release.releaseId, expectedRecipeCount: 500, selectedSource: 'd1', actualSource: 'd1',
  servedRecipeCount: 500, servedFingerprint: release.expectedRuntimeFingerprint,
  expectedRuntimeFingerprint: release.expectedRuntimeFingerprint, fingerprintMatchesRelease: true,
  d1Readiness: 'ready', d1ReadinessCode: null, fallbackReason: null, ...changes,
});
const version = (changes = {}) => ({
  id: 'previous-version', resources: { bindings: [
    { type: 'd1', name: 'DB', id: databaseId },
    ...Object.entries({ GIT_COMMIT: previousSha, ENVIRONMENT: 'production',
      RECIPE_CATALOG_MODE: 'd1', RECIPE_CATALOG_D1_CANARY_PERCENT: '0',
      RECIPE_CATALOG_CUTOVER_ENABLED: 'true', MEAL_PLANNER_ENABLED: 'true',
      MEAL_COMPOSITION_V2_ENABLED: 'true', ...changes }).map(([name, text]) => ({ type: 'plain_text', name, text })),
  ] },
});
const options = (changes = {}) => ({
  isAncestor: (before, after) => before === previousSha && after === candidateSha,
  readRelease: () => release, readBlob: () => 'c'.repeat(40),
  readDependency: () => ({ dependency: '^3.24.2', version: '3.25.76', integrity: 'sha512-fixture' }),
  ...changes,
});

describe('complete unchanged production D1 continuity', () => {
  it('reproduces the old fail-closed preflight without the previous version proof', () => {
    expect(() => validateRecipeCatalogTransition(manifest(), evidence(), release, options())).toThrow('restart');
  });
  it('retains complete D1 only after trusted source/version/content proof', () => {
    const result = validateRecipeCatalogTransition(manifest(), evidence(), release,
      options({ previousVersion: version() }));
    expect(result).toMatchObject({ from: 'd1', to: 'd1', kind: 'unchanged_d1_continuity' });
    expect(result.continuity.previousAuthorityProof).toMatchObject({ commit: previousSha, relation: 'ancestor' });
    expect(Object.keys(result.continuity.sourceBlobs)).toEqual(D1_CATALOG_CONTINUITY_PATHS);
  });
  it.each(D1_CATALOG_CONTINUITY_PATHS)('rejects changed catalog dependency %s', (changed) => {
    expect(() => verifyD1CatalogContinuity(manifest(), evidence(), release, version(), options({
      readBlob: (sha, file) => sha === candidateSha && file === changed ? 'd'.repeat(40) : 'c'.repeat(40),
    }))).toThrow('source changed');
  });
  it('rejects missing catalog source and changed schema dependency', () => {
    expect(() => verifyD1CatalogContinuity(manifest(), evidence(), release, version(),
      options({ readBlob: () => undefined }))).toThrow('source changed or unavailable');
    expect(() => verifyD1CatalogContinuity(manifest(), evidence(), release, version(), options({
      readDependency: (sha) => ({ dependency: 'zod', version: sha === candidateSha ? '4.0.0' : '3.25.76', integrity: 'fixture' }),
    }))).toThrow('dependency changed');
  });
  it.each([
    { servedFingerprint: 'f'.repeat(64) }, { fallbackReason: 'D1_READ_FAILED' },
    { d1Readiness: 'not_ready' }, { releaseId: 'rel-other' }, { servedRecipeCount: 499 },
  ])('rejects unhealthy or changed protected catalog evidence %j', (changes) => {
    expect(() => verifyD1CatalogContinuity(manifest(), evidence(changes), release, version(), options())).toThrow();
  });
  it.each(['GIT_COMMIT', 'ENVIRONMENT', 'RECIPE_CATALOG_MODE', 'RECIPE_CATALOG_D1_CANARY_PERCENT',
    'RECIPE_CATALOG_CUTOVER_ENABLED', 'MEAL_PLANNER_ENABLED', 'MEAL_COMPOSITION_V2_ENABLED'])(
    'joins active version and flags, rejecting %s drift', (flag) => {
      expect(() => verifyD1CatalogContinuity(manifest(), evidence(), release, version({ [flag]: 'wrong' }), options()))
        .toThrow('previous version mismatch');
    });
  it('rejects a different active version or D1 database', () => {
    expect(() => verifyD1CatalogContinuity(manifest({ previousDeployment: { versionId: 'other' } }),
      evidence(), release, version(), options())).toThrow('exact previous Worker');
    const wrong = version(); wrong.resources.bindings[0].id = 'other-db';
    expect(() => verifyD1CatalogContinuity(manifest(), evidence(), release, wrong, options())).toThrow('pinned production');
  });
  it('rejects non-ancestor, staging, canary and unavailable authority', () => {
    expect(() => verifyD1CatalogContinuity(manifest(), evidence(), release, version(),
      options({ isAncestor: () => false }))).toThrow('not an ancestor');
    for (const m of [manifest({ environment: 'staging' }), manifest({ recipeCatalogMode: 'canary' })])
      expect(() => verifyD1CatalogContinuity(m, evidence(), release, version(), options())).toThrow('complete D1');
    expect(() => validateRecipeCatalogTransition(manifest(), { unavailable: true }, release,
      options({ previousVersion: version() }))).toThrow('bootstrap');
  });

  it('proves CLI continuity against actual Git blobs and lock resolution, then rejects source drift', () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'takosan-continuity-'));
    const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '-b', 'main'); git('config', 'user.name', 'Continuity fixture');
    git('config', 'user.email', 'continuity@example.invalid'); git('config', 'commit.gpgsign', 'false');
    for (const file of D1_CATALOG_CONTINUITY_PATHS) {
      mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
      writeFileSync(path.join(cwd, file), file.endsWith('catalog-release.current.json') ? JSON.stringify(release) : '// fixed catalog fixture\n');
    }
    writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ dependencies: { zod: '^3.24.2' } }));
    writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), 'importers:\n  .:\n    dependencies:\n      zod:\n        specifier: ^3.24.2\n        version: 3.25.76\npackages:\n  zod@3.25.76:\n    resolution: {integrity: sha512-fixture}\nsnapshots:\n  zod@3.25.76: {}\n');
    git('add', '.'); git('commit', '-m', 'Catalog source'); const before = git('rev-parse', 'HEAD');
    git('commit', '--allow-empty', '-m', 'Application release'); const after = git('rev-parse', 'HEAD');
    const run = (candidate) => {
      writeFileSync(path.join(cwd, 'release.json'), JSON.stringify(manifest({ sha: candidate })));
      writeFileSync(path.join(cwd, 'authority.json'), JSON.stringify(evidence({ commit: before })));
      writeFileSync(path.join(cwd, 'version.json'), JSON.stringify(version({ GIT_COMMIT: before })));
      execFileSync(process.execPath, [fileURLToPath(new URL('../../scripts/release-check.mjs', import.meta.url)),
        'transition', 'release.json', 'authority.json', 'version.json'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      return JSON.parse(readFileSync(path.join(cwd, 'release.json'), 'utf8'));
    };
    expect(run(after).previousRecipeAuthorityProof.commit).toBe(before);
    writeFileSync(path.join(cwd, D1_CATALOG_CONTINUITY_PATHS[0]), '// changed authority\n');
    git('add', D1_CATALOG_CONTINUITY_PATHS[0]); git('commit', '-m', 'Changed authority');
    expect(() => run(git('rev-parse', 'HEAD'))).toThrow();
  });
});
