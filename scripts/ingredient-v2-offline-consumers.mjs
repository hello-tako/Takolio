#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--output') throw new Error('Usage: ingredient-v2-offline-consumers.mjs --output FILE');
const root = 'data/recipe-refresh/v2';
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'));
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false },
  appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { RefreshRecipeSchema } = await vite.ssrLoadModule('/packages/recipes/src/refresh/schema.ts');
  const { ingredientV2FromRefresh, projectV1ShoppingRequirements, scaleIngredientV2 } = await vite.ssrLoadModule('/packages/recipes/src/runtime-ingredient-v2.ts');
  const { assessIngredientV2Consumers } = await vite.ssrLoadModule('/packages/recipes/src/ingredient-v2-consumers.ts');
  const rows = [];
  let sourceLines = 0;
  for (const id of manifest.orderedRecipeIds) {
    const path = `recipes/${id}.json`;
    const bytes = await readFile(`${root}/${path}`);
    const expected = manifest.fileHashes.find((row) => row.path === path)?.sha256;
    if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('SOURCE_HASH_DRIFT');
    const recipe = RefreshRecipeSchema.parse(JSON.parse(bytes));
    const lines = recipe.ingredients.map(ingredientV2FromRefresh);
    if (lines.length !== recipe.ingredients.length || new Set(lines.map((line) => line.sourcePosition)).size !== lines.length) throw new Error('LINE_COVERAGE_DRIFT');
    let requirements = null;
    let reasons = [];
    try { requirements = projectV1ShoppingRequirements(recipe.ingredients, lines); }
    catch (error) { reasons = error.reasons ?? [error.name]; }
    const servings = [1, 2, 4].map((factor) => {
      try { const scaled = lines.map((line) => scaleIngredientV2(line, factor));
        return { factor, status: 'SCHEMA_VALID', sourceLines: scaled.length };
      } catch { return { factor, status: 'BLOCKED_UNRESOLVED_SCALING', sourceLines: lines.length }; }
    });
    const restrictions = [...new Set(lines.map((line) => line.ingredientId).filter(Boolean))];
    for (const line of lines) if (line.ingredientId && !restrictions.includes(line.ingredientId)) throw new Error('RESTRICTION_IDENTITY_LOSS');
    sourceLines += lines.length;
    rows.push({ recipeId: id, sourceLines: lines.length, restrictionIdentityCount: restrictions.length,
      projectionStatus: requirements ? 'OFFLINE_PROJECTABLE' : 'BLOCKED', projectionReasons: reasons,
      consumerAssessment: assessIngredientV2Consumers(lines), servings, unknownConsumed: lines.filter((line) => line.consumed.kind === 'unknown').length,
      unresolvedShopping: lines.filter((line) => line.shopping.kind === 'unresolved').length,
      provisionalIdentities: lines.filter((line) => line.authority === 'provisional').length,
      nutritionCertification: recipe.nutrition.certification });
  }
  const report = { schemaVersion: 1, classification: 'CANONICAL_CANDIDATE_OFFLINE',
    status: 'OFFLINE_CONSUMER_AUDIT_COMPLETE', externalAcceptance: 'PENDING_EXTERNAL_EVIDENCE',
    canonicalSourceSha256: manifest.canonicalArtifactSha256, recipes: rows.length, sourceLines,
    runtimeAuthority: false, finalRuntimeFingerprint: null,
    projectableRecipes: rows.filter((row) => row.projectionStatus === 'OFFLINE_PROJECTABLE').length,
    blockedRecipes: rows.filter((row) => row.projectionStatus === 'BLOCKED').length,
    requiredReleaseBlockers: ['runtime_projection_loss', 'ingredient_reconciliation', 'source_verification', 'nutrition_evidence'], rows };
  await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ ...report, rows: undefined })}\n`);
} finally { await vite.close(); }
