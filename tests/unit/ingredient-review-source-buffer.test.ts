import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { buildIngredientReviewSourceProof } from '../../packages/recipes/src/ingredient-review-manifest';
import { RefreshRecipeSchema } from '../../packages/recipes/src/refresh/schema';
import { fingerprintRefreshArtifact } from '../../packages/recipes/src/refresh/artifact';

it('snapshots caller buffers before the first hash await so later mutation cannot change proof', async () => {
  const manifest = JSON.parse(readFileSync('data/recipe-refresh/v2/manifest.json', 'utf8'));
  const recipeId = manifest.orderedRecipeIds[0];
  const original = readFileSync(`data/recipe-refresh/v2/recipes/${recipeId}.json`, 'utf8');
  const recipe = RefreshRecipeSchema.parse(JSON.parse(original));
  const originalCount = recipe.ingredients.length;
  expect(originalCount).toBeGreaterThan(1);
  const bytes = new TextEncoder().encode(original);
  const fileHashes = [{ path: `recipes/${recipeId}.json`, sha256: createHash('sha256').update(bytes).digest('hex') }];
  const sourceSha = await fingerprintRefreshArtifact(fileHashes);
  const release = { schemaVersion: 1, releaseId: 'rel-0123456789abcdef', legacyBaselineCount: 1,
    legacyBaselineFingerprint: 'a'.repeat(64), expectedRecipeCount: 1, orderedRecipeIds: ['TEST_ONLY-base'],
    expectedRuntimeFingerprint: 'a'.repeat(64), approvedImportBatches: [] };
  const pending = buildIngredientReviewSourceProof({ classification: 'TEST_ONLY',
    sourceManifest: { classification: 'TEST_ONLY', baseReleaseId: release.releaseId, canonicalArtifactSha256: sourceSha,
      orderedRecipeIds: [recipeId], fileHashes }, expectedCanonicalSourceSha256: sourceSha, certifiedBaseRelease: release,
    certifiedExistingIngredientIds: new Set(recipe.ingredients.flatMap((r) => r.reconciliation === 'existing_canonical_id' && r.canonicalIngredientId !== null ? [r.canonicalIngredientId] : [])),
    files: [{ path: `recipes/${recipeId}.json`, bytes }] });
  recipe.ingredients = recipe.ingredients.slice(0, 1);
  const altered = new TextEncoder().encode(JSON.stringify(recipe));
  expect(altered.byteLength).toBeLessThan(bytes.byteLength);
  bytes.fill(32);
  bytes.set(altered);
  const proof = await pending;
  expect(proof.canonicalSourceSha256).toBe(sourceSha);
  expect(proof.coverage.sourceLines).toBe(originalCount);
});
