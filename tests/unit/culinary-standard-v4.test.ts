import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_INGREDIENTS,
  GLOBAL_EXTENDED_INGREDIENTS,
  normalizeIngredientText,
} from '../../packages/domain/src';
import {
  findOperationalIngredient,
  getAllOperationalIngredients,
  getOperationalAllergensV4,
  getOperationalNutritionV4,
} from '../../packages/domain/src/culinary-ingredients-v4';
import {
  FORBIDDEN_CITATION_RE,
  StandardRecipeV4Schema,
  VIETNAMESE_DIACRITIC_RE,
  assertNutritionPlausibilityV4,
  compileStandardRecipeV4ToRuntime,
  computeStandardNutritionV4,
  deriveAllergenTagsV4,
} from '../../packages/recipes/src/standard-v4';
import { StandardV4RecipeAuthority, isStandardV4CatalogReady } from '../../packages/recipes/src/standard-v4/authority';
import { fingerprintRecipes } from '../../packages/recipes/src/catalog-fingerprint';
import {
  resolveRecipeAuthorityV4,
  type RecipeAuthorityV4Env,
} from '../../src/worker/services/recipe-authority-v4';

const root = process.cwd();
const releaseManifest = JSON.parse(
  readFileSync(path.join(root, 'packages/recipes/src/import/catalog-release.current.json'), 'utf8'),
) as { orderedRecipeIds: string[] };
const v4Manifest = JSON.parse(
  readFileSync(path.join(root, 'data/recipe-standard/v4/manifest.json'), 'utf8'),
) as {
  recipeCount: number;
  orderedRecipeIds: string[];
  runtimeFingerprint: string;
  summary: {
    nutritionCertifiedCount: number;
    runtimeExcludedIngredientCount: number;
    provisionalIngEnrCount: number;
  };
};
const compiledRuntime = JSON.parse(
  readFileSync(path.join(root, 'data/recipe-standard/v4/compiled-runtime-500.json'), 'utf8'),
) as { schemaVersion: number; recipeCount: number; fingerprint: string; recipes: unknown[] };

describe('Takolio Culinary Standard V4 — 500-recipe catalog & operational dictionary', () => {
  it('keeps V1 (45) & Global (31) immutable while providing 100% nutrition & collision-free V4 aliases', () => {
    expect(CANONICAL_INGREDIENTS).toHaveLength(45);
    expect(GLOBAL_EXTENDED_INGREDIENTS).toHaveLength(31);
    const all = getAllOperationalIngredients();
    expect(all.length).toBeGreaterThanOrEqual(240);

    const seenIds = new Set<string>();
    const v4Aliases = new Map<string, string>();
    const baseAliases = new Map<string, string>();
    for (const ing of [...CANONICAL_INGREDIENTS, ...GLOBAL_EXTENDED_INGREDIENTS]) {
      for (const label of [ing.nameVi, ing.nameEn, ...ing.aliases]) {
        const k = normalizeIngredientText(label);
        if (k) baseAliases.set(k, ing.id);
      }
    }

    for (const ing of all) {
      expect(ing.id).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(ing.id.startsWith('ING_ENR_')).toBe(false);
      expect(seenIds.has(ing.id)).toBe(false);
      seenIds.add(ing.id);
      expect(getOperationalNutritionV4(ing.id)).toBeDefined();
      expect(Array.isArray(getOperationalAllergensV4(ing.id))).toBe(true);

      if (!CANONICAL_INGREDIENTS.includes(ing) && !GLOBAL_EXTENDED_INGREDIENTS.includes(ing)) {
        for (const label of [ing.nameVi, ing.nameEn, ...ing.aliases]) {
          const k = normalizeIngredientText(label);
          expect(k.length).toBeGreaterThan(0);
          expect(baseAliases.get(k)).toBeUndefined();
          expect(v4Aliases.get(k) ?? ing.id).toBe(ing.id);
          v4Aliases.set(k, ing.id);
        }
      }
    }
    expect(findOperationalIngredient('muối ăn')?.id).toBe('SALT');
    expect(findOperationalIngredient('dầu hào')?.id).toBe('OYSTER_SAUCE');
  });

  it('validates all 500 V4 recipes for schema, ID/order parity, diacritics, zero citations, nutrition, and runtime compilation', async () => {
    expect(v4Manifest.recipeCount).toBe(500);
    expect(v4Manifest.orderedRecipeIds).toEqual(releaseManifest.orderedRecipeIds);
    expect(v4Manifest.summary.nutritionCertifiedCount).toBe(500);
    expect(v4Manifest.summary.runtimeExcludedIngredientCount).toBe(0);
    expect(v4Manifest.summary.provisionalIngEnrCount).toBe(0);
    expect(compiledRuntime.recipeCount).toBe(500);

    const compiledList = [];
    for (const id of releaseManifest.orderedRecipeIds) {
      const raw = JSON.parse(
        readFileSync(path.join(root, 'data/recipe-standard/v4/recipes', `${id}.json`), 'utf8'),
      );
      const parsed = StandardRecipeV4Schema.parse(raw);
      expect(parsed.identity.id).toBe(id);
      expect(VIETNAMESE_DIACRITIC_RE.test(parsed.identity.title)).toBe(true);
      const { media: _media, ...nonMedia } = parsed;
      expect(FORBIDDEN_CITATION_RE.test(JSON.stringify(nonMedia))).toBe(false);
      expect(parsed.classification.allergenTags).toEqual(deriveAllergenTagsV4(parsed.ingredients));

      const expectedNutrition = computeStandardNutritionV4(parsed.ingredients, parsed.classification.servings);
      expect(parsed.nutrition).toEqual(expectedNutrition);
      expect(assertNutritionPlausibilityV4(parsed.nutrition)).toEqual({ ok: true });

      const runtime = compileStandardRecipeV4ToRuntime(parsed);
      expect(runtime.ingredients.length).toBeGreaterThanOrEqual(6);
      expect(runtime.steps.length).toBeGreaterThanOrEqual(6);
      expect(runtime.nutrition).toBeDefined();
      compiledList.push(runtime);
    }

    expect(compiledRuntime.recipes).toEqual(compiledList);
    expect(await fingerprintRecipes(compiledList)).toBe(v4Manifest.runtimeFingerprint);
    expect(compiledRuntime.fingerprint).toBe(v4Manifest.runtimeFingerprint);
  });

  it('supports opt-in RECIPE_CATALOG_V4_STANDARD_ENABLED authority without altering default V1 static authority', async () => {
    expect(isStandardV4CatalogReady()).toBe(true);
    const v4Snapshot = await new StandardV4RecipeAuthority().load();
    expect(v4Snapshot.size).toBe(500);
    expect(v4Snapshot.fingerprint).toBe(v4Manifest.runtimeFingerprint);

    const staticEnv = (overrides: Partial<RecipeAuthorityV4Env> = {}): RecipeAuthorityV4Env =>
      ({ DB: undefined, RECIPE_CATALOG_MODE: 'static', ...overrides }) as unknown as RecipeAuthorityV4Env;

    const defaultRes = await resolveRecipeAuthorityV4(staticEnv());
    expect(defaultRes.actualSource).toBe('static');
    expect(defaultRes.snapshot.size).toBe(71);

    const optInRes = await resolveRecipeAuthorityV4(
      staticEnv({
        RECIPE_CATALOG_V4_STANDARD_ENABLED: 'true',
      }),
    );
    expect(optInRes.actualSource).toBe('static');
    expect(optInRes.snapshot.size).toBe(500);
    expect(optInRes.snapshot.fingerprint).toBe(v4Manifest.runtimeFingerprint);
  });
});
