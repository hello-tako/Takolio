import { readLocalizedRecipeContent, type D1DatabaseBinding } from '@frigo/db';
import type { SupportedLocale } from '@frigo/domain';
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

/**
 * Reads a household-pinned recipe content version, verifies its SHA-256 fingerprint
 * against the canonical base record, and overlays per-locale translation (`recipe_content_localizations`)
 * when available — keeping the pinned `fingerprint` 100% invariant across UI language changes!
 */
export async function readLocalizedHouseholdRecipeContentVersion(
  db: D1DatabaseBinding,
  householdId: string,
  fingerprint: string,
  locale: SupportedLocale,
): Promise<(Recipe & { contentFingerprint: string; resolvedLocale: SupportedLocale; localizedSlug: string }) | null> {
  const base = await readHouseholdRecipeContentVersion(db, householdId, fingerprint);
  if (!base) return null;
  try {
    const localized = await readLocalizedRecipeContent(db, fingerprint, locale);
    if (!localized) {
      return {
        ...base,
        contentFingerprint: fingerprint,
        resolvedLocale: 'vi',
        localizedSlug: base.slug,
      };
    }
    return {
      ...base,
      title: localized.title,
      description: localized.description || base.description,
      steps: localized.steps,
      ingredients: base.ingredients.map((ing) => ({
        ...ing,
        name: localized.ingredientNamesById[ing.ingredientId] ?? ing.name,
      })),
      contentFingerprint: fingerprint,
      resolvedLocale: localized.resolvedLocale,
      localizedSlug: localized.localizedSlug,
    };
  } catch {
    return {
      ...base,
      contentFingerprint: fingerprint,
      resolvedLocale: 'vi',
      localizedSlug: base.slug,
    };
  }
}

/**
 * Batch-captures immutable recipe content versions and household access grants in a single D1 batch,
 * collapsing O(3 * N) sequential network round-trips down to O(1).
 */
export async function captureAndGrantRecipeContentBatch(
  db: D1DatabaseBinding,
  householdId: string,
  inputs: readonly Recipe[],
): Promise<Map<string, string>> {
  const byId = new Map<string, Recipe>();
  for (const input of inputs) {
    if (!byId.has(input.id)) {
      byId.set(input.id, RuntimeRecipeSchema.parse(input));
    }
  }
  const entries = await Promise.all(
    [...byId.values()].map(async (recipe) => ({
      recipe,
      fingerprint: await fingerprintRecipes([recipe]),
      json: stableRuntimeJson(recipe),
    })),
  );
  if (entries.length === 0) return new Map();

  const statements = [
    ...entries.map((e) =>
      db
        .prepare(
          `INSERT INTO recipe_content_versions (fingerprint, recipe_id, slug, content_json)
           SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM recipe_content_versions WHERE fingerprint = ?)`,
        )
        .bind(e.fingerprint, e.recipe.id, e.recipe.slug, e.json, e.fingerprint),
    ),
    ...entries.map((e) =>
      db
        .prepare('INSERT OR IGNORE INTO recipe_content_access (household_id, fingerprint) VALUES (?, ?)')
        .bind(householdId, e.fingerprint),
    ),
  ];
  const results = await db.batch(statements);
  if (results.some((r) => r.success === false)) {
    throw new Error('Recipe content batch capture failed');
  }

  const verified = await readHouseholdRecipeContentVersionsBatch(
    db,
    householdId,
    entries.map((e) => e.fingerprint),
  );
  const pins = new Map<string, string>();
  for (const e of entries) {
    const stored = verified.get(e.fingerprint);
    if (!stored || stored.id !== e.recipe.id) {
      throw new Error('Recipe content version is unavailable');
    }
    pins.set(e.recipe.id, e.fingerprint);
  }
  return pins;
}

/**
 * Batch-reads household-authorized recipe content versions in a single SQL query
 * instead of O(2 * N) sequential queries during meal plan hydration.
 */
export async function readHouseholdRecipeContentVersionsBatch(
  db: D1DatabaseBinding,
  householdId: string,
  fingerprints: readonly string[],
): Promise<Map<string, Recipe>> {
  const unique = [...new Set(fingerprints.filter((fp) => CONTENT_FINGERPRINT.test(fp)))];
  if (unique.length === 0) return new Map();
  const placeholders = unique.map(() => '?').join(', ');
  const rows = await db
    .prepare(
      `SELECT v.fingerprint, v.recipe_id, v.slug, v.content_json
         FROM recipe_content_versions v
         JOIN recipe_content_access a
           ON a.fingerprint = v.fingerprint
        WHERE a.household_id = ?
          AND v.fingerprint IN (${placeholders})`,
    )
    .bind(householdId, ...unique)
    .all<{ fingerprint: string; recipe_id: string; slug: string; content_json: string }>();
  if (!rows.success) {
    throw new Error('Batch recipe content version read failed');
  }
  const map = new Map<string, Recipe>();
  for (const row of rows.results) {
    const recipe = RuntimeRecipeSchema.parse(JSON.parse(row.content_json));
    if (
      recipe.id !== row.recipe_id ||
      recipe.slug !== row.slug ||
      (await fingerprintRecipes([recipe])) !== row.fingerprint
    ) {
      throw new Error('Recipe content version failed integrity validation');
    }
    map.set(row.fingerprint, recipe);
  }
  return map;
}

// Only for interpreting receipts written against the fixed V1 static baseline.
export function findLegacyCookingRecipe(idOrSlug: string): Recipe | undefined {
  return ALL_RECIPES.find(recipe => recipe.id === idOrSlug || recipe.slug === idOrSlug);
}
