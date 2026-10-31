import type { D1DatabaseBinding } from '@frigo/db';
import { ALL_RECIPES, type Recipe } from '@frigo/recipes';
import { fingerprintRecipes } from '../../../packages/recipes/src/catalog-fingerprint';
import { RuntimeRecipeSchema, stableRuntimeJson } from '../../../packages/recipes/src/runtime-recipe';

export const CONTENT_FINGERPRINT = /^[0-9a-f]{64}$/;

export async function readRecipeContentVersion(
  db: D1DatabaseBinding,
  fingerprint: string,
): Promise<Recipe | null> {
  const row = await db.prepare(
    'SELECT recipe_id, slug, content_json FROM recipe_content_versions WHERE fingerprint = ? LIMIT 1',
  ).bind(fingerprint).first<{ recipe_id: string; slug: string; content_json: string }>();
  if (!row) return null;
  const recipe = RuntimeRecipeSchema.parse(JSON.parse(row.content_json));
  if (recipe.id !== row.recipe_id || recipe.slug !== row.slug ||
      await fingerprintRecipes([recipe]) !== fingerprint) {
    throw new Error('Recipe content version failed integrity validation');
  }
  return recipe;
}

export async function captureRecipeContentVersion(db: D1DatabaseBinding, input: Recipe): Promise<string> {
  const recipe = RuntimeRecipeSchema.parse(input);
  const fingerprint = await fingerprintRecipes([recipe]);
  const result = await db.prepare(`INSERT INTO recipe_content_versions (fingerprint, recipe_id, slug, content_json)
    SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM recipe_content_versions WHERE fingerprint = ?)`)
    .bind(fingerprint, recipe.id, recipe.slug, stableRuntimeJson(recipe), fingerprint).run();
  if (result.success === false) throw new Error('Recipe content version could not be captured');
  const stored = await readRecipeContentVersion(db, fingerprint);
  if (!stored) throw new Error('Recipe content version is unavailable');
  return fingerprint;
}

// Fixed compatibility boundary: never follow a future mutable release manifest.
export const UNVERSIONED_COOKING_CATALOGS = new Set([
  '9ae153e64d34b30d72bb985d4070d8e210201219c0e8f8998ce8f99057fc7c3f',
  'f8cf8c7ff59df9fe29e246b9e3c9aad0fd155fa8df35bf671ac4d03fa2b5ab37',
]);

export async function grantRecipeContentAccess(
  db: D1DatabaseBinding, householdId: string, fingerprint: string,
): Promise<void> {
  const result = await db.prepare(
    'INSERT OR IGNORE INTO recipe_content_access (household_id, fingerprint) VALUES (?, ?)',
  ).bind(householdId, fingerprint).run();
  if (result.success === false) throw new Error('Recipe content access could not be retained');
}

export async function readHouseholdRecipeContentVersion(
  db: D1DatabaseBinding, householdId: string, fingerprint: string,
): Promise<Recipe | null> {
  const grant = await db.prepare(
    'SELECT 1 AS allowed FROM recipe_content_access WHERE household_id = ? AND fingerprint = ?',
  ).bind(householdId, fingerprint).first();
  return grant ? readRecipeContentVersion(db, fingerprint) : null;
}

// Only for interpreting receipts written against the fixed V1 static baseline.
export function findLegacyCookingRecipe(idOrSlug: string): Recipe | undefined {
  return ALL_RECIPES.find(recipe => recipe.id === idOrSlug || recipe.slug === idOrSlug);
}
