import {
  getAllOperationalIngredients,
  getOperationalAllergensV4,
  getOperationalNutritionV4,
} from '../../../domain/src/culinary-ingredients-v4';
import {
  renderChunkedInsert,
  sqlNumber,
  sqlNumberOrNull,
  sqlText,
  sqlTextOrNull,
} from '../import/sql-render';
import { RuntimeRecipeSchema, type RuntimeRecipe } from '../runtime-recipe';
import type { StandardRecipeV4 } from './schema';

const round1 = (value: number): number => Math.round((value + Number.EPSILON) * 10) / 10;

export function compileStandardRecipeV4ToRuntime(recipe: StandardRecipeV4): RuntimeRecipe {
  const runtimeIngredients = recipe.ingredients
    .filter((ing) => ing.includeInShopping)
    .map((ing) => ({
      ingredientId: ing.ingredientId,
      name: ing.name,
      requiredQuantity: ing.requiredQuantity,
      unit: ing.unit,
      ...(ing.isOptional ? { isOptional: true } : {}),
    }));

  const runtimeSteps = recipe.steps.map((step) => ({
    stepNumber: step.stepNumber,
    instruction: `${step.title}: ${step.instruction}`,
    ...(step.tip !== undefined ? { tip: step.tip } : {}),
    ...(step.timerMinutes !== undefined ? { timerMinutes: step.timerMinutes } : {}),
  }));

  const candidate: RuntimeRecipe = {
    id: recipe.identity.id,
    slug: recipe.identity.slug,
    title: recipe.identity.title,
    description: recipe.overview.description,
    cuisine: recipe.classification.cuisine,
    category: recipe.classification.category,
    ...(recipe.classification.region !== undefined ? { region: recipe.classification.region } : {}),
    cookTimeMinutes: recipe.classification.cookTimeMinutes,
    servings: recipe.classification.servings,
    difficulty: recipe.classification.difficulty,
    imageUrl: recipe.media.legacyRuntimeImageUrl,
    nutrition: {
      calories: Math.round(recipe.nutrition.energyKcal),
      proteinG: round1(recipe.nutrition.proteinG),
      fatG: round1(recipe.nutrition.fatG),
      carbG: round1(recipe.nutrition.carbG),
    },
    ingredients: runtimeIngredients,
    steps: runtimeSteps,
    tags: [...recipe.classification.tags],
  };

  return RuntimeRecipeSchema.parse(candidate);
}

export function renderStandardV4PromotionSql(
  recipes: readonly StandardRecipeV4[],
  orderedIds: readonly string[],
): string {
  const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
  const sorted = [...recipes].sort((a, b) => {
    const posA = orderMap.get(a.identity.id) ?? Number.MAX_SAFE_INTEGER;
    const posB = orderMap.get(b.identity.id) ?? Number.MAX_SAFE_INTEGER;
    return posA - posB;
  });

  const lines: string[] = [
    '-- Migration 0052: Takolio Culinary Standard V4 (500 Standardized Recipes)',
    '-- Prerequisite: canonical migration ordering through 0051_privacy_erasure_portability_and_consent_ledger.sql.',
    '-- Additive normalized V4 catalog tables leaving legacy 45-entry ingredients and V1 recipes untouched.',
    '',
    'CREATE TABLE culinary_standard_v4_ingredients (',
    "  id TEXT PRIMARY KEY NOT NULL CHECK (id GLOB '[A-Z][A-Z0-9_]*' AND length(id) <= 100),",
    '  name_vi TEXT NOT NULL CHECK (length(trim(name_vi)) > 0),',
    '  name_en TEXT NOT NULL CHECK (length(trim(name_en)) > 0),',
    '  category TEXT NOT NULL,',
    '  default_unit TEXT NOT NULL,',
    '  default_shelf_life_days INTEGER NOT NULL CHECK (default_shelf_life_days >= 1),',
    '  icon TEXT NOT NULL,',
    '  energy_kcal REAL NOT NULL CHECK (energy_kcal >= 0),',
    '  energy_kj REAL NOT NULL CHECK (energy_kj >= 0),',
    '  protein_g REAL NOT NULL CHECK (protein_g >= 0),',
    '  fat_g REAL NOT NULL CHECK (fat_g >= 0),',
    '  saturated_fat_g REAL NOT NULL CHECK (saturated_fat_g >= 0),',
    '  carb_g REAL NOT NULL CHECK (carb_g >= 0),',
    '  fiber_g REAL NOT NULL CHECK (fiber_g >= 0),',
    '  sugar_g REAL NOT NULL CHECK (sugar_g >= 0),',
    '  sodium_mg REAL NOT NULL CHECK (sodium_mg >= 0),',
    '  salt_g REAL NOT NULL CHECK (salt_g >= 0),',
    '  edible_yield_ratio REAL NOT NULL CHECK (edible_yield_ratio > 0 AND edible_yield_ratio <= 1),',
    "  allergen_tags_json TEXT NOT NULL CHECK (json_valid(allergen_tags_json) AND json_type(allergen_tags_json) = 'array'),",
    "  aliases_json TEXT NOT NULL CHECK (json_valid(aliases_json) AND json_type(aliases_json) = 'array'),",
    '  source_reference TEXT NOT NULL',
    ');',
    '',
    'CREATE TABLE recipe_standard_v4_catalog (',
    '  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),',
    '  slug TEXT NOT NULL UNIQUE CHECK (length(slug) > 0),',
    '  runtime_order INTEGER NOT NULL UNIQUE CHECK (runtime_order >= 0),',
    '  title TEXT NOT NULL CHECK (length(trim(title)) > 0),',
    '  subtitle TEXT NOT NULL,',
    '  description TEXT NOT NULL,',
    '  serving_suggestion TEXT NOT NULL,',
    '  storage_and_reheat TEXT NOT NULL,',
    '  cuisine TEXT NOT NULL,',
    '  category TEXT NOT NULL,',
    '  region TEXT,',
    "  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),",
    '  prep_time_minutes INTEGER NOT NULL CHECK (prep_time_minutes >= 1),',
    '  cook_time_minutes INTEGER NOT NULL CHECK (cook_time_minutes >= 1),',
    '  servings INTEGER NOT NULL CHECK (servings >= 1),',
    '  image_url TEXT NOT NULL,',
    "  tags_json TEXT NOT NULL CHECK (json_valid(tags_json) AND json_type(tags_json) = 'array'),",
    "  meal_types_json TEXT NOT NULL CHECK (json_valid(meal_types_json) AND json_type(meal_types_json) = 'array'),",
    "  methods_json TEXT NOT NULL CHECK (json_valid(methods_json) AND json_type(methods_json) = 'array'),",
    "  allergen_tags_json TEXT NOT NULL CHECK (json_valid(allergen_tags_json) AND json_type(allergen_tags_json) = 'array'),",
    '  calories INTEGER NOT NULL CHECK (calories >= 0),',
    '  energy_kcal REAL NOT NULL CHECK (energy_kcal >= 0),',
    '  energy_kj REAL NOT NULL CHECK (energy_kj >= 0),',
    '  protein_g REAL NOT NULL CHECK (protein_g >= 0),',
    '  fat_g REAL NOT NULL CHECK (fat_g >= 0),',
    '  saturated_fat_g REAL NOT NULL CHECK (saturated_fat_g >= 0),',
    '  carb_g REAL NOT NULL CHECK (carb_g >= 0),',
    '  fiber_g REAL NOT NULL CHECK (fiber_g >= 0),',
    '  sugar_g REAL NOT NULL CHECK (sugar_g >= 0),',
    '  sodium_mg REAL NOT NULL CHECK (sodium_mg >= 0),',
    '  salt_g REAL NOT NULL CHECK (salt_g >= 0),',
    "  source_references_json TEXT NOT NULL CHECK (json_valid(source_references_json) AND json_type(source_references_json) = 'array'),",
    '  v1_fingerprint TEXT NOT NULL,',
    '  v2_sha256 TEXT NOT NULL,',
    '  recipe_version INTEGER NOT NULL DEFAULT 4 CHECK (recipe_version = 4)',
    ');',
    '',
    'CREATE TABLE recipe_standard_v4_ingredients (',
    '  id TEXT PRIMARY KEY NOT NULL,',
    '  recipe_id TEXT NOT NULL REFERENCES recipe_standard_v4_catalog(id) ON DELETE CASCADE,',
    '  position INTEGER NOT NULL CHECK (position >= 0),',
    '  ingredient_id TEXT NOT NULL REFERENCES culinary_standard_v4_ingredients(id),',
    '  name TEXT NOT NULL CHECK (length(trim(name)) > 0),',
    '  culinary_measure TEXT NOT NULL,',
    '  prep_note TEXT,',
    '  component_group TEXT NOT NULL,',
    '  required_quantity REAL NOT NULL CHECK (required_quantity > 0),',
    '  unit TEXT NOT NULL,',
    '  gross_grams REAL NOT NULL CHECK (gross_grams > 0),',
    '  edible_retention_ratio REAL NOT NULL CHECK (edible_retention_ratio >= 0 AND edible_retention_ratio <= 1),',
    '  edible_grams REAL NOT NULL CHECK (edible_grams >= 0),',
    '  is_optional INTEGER NOT NULL CHECK (is_optional IN (0, 1)),',
    '  include_in_shopping INTEGER NOT NULL CHECK (include_in_shopping IN (0, 1)),',
    '  UNIQUE (recipe_id, position)',
    ');',
    'CREATE INDEX idx_recipe_standard_v4_ingredients_recipe ON recipe_standard_v4_ingredients(recipe_id, position);',
    '',
    'CREATE TABLE recipe_standard_v4_steps (',
    '  id TEXT PRIMARY KEY NOT NULL,',
    '  recipe_id TEXT NOT NULL REFERENCES recipe_standard_v4_catalog(id) ON DELETE CASCADE,',
    '  step_number INTEGER NOT NULL CHECK (step_number >= 1),',
    '  phase TEXT NOT NULL,',
    '  title TEXT NOT NULL,',
    '  instruction TEXT NOT NULL CHECK (length(trim(instruction)) > 0),',
    '  tip TEXT,',
    '  timer_minutes INTEGER,',
    '  UNIQUE (recipe_id, step_number)',
    ');',
    'CREATE INDEX idx_recipe_standard_v4_steps_recipe ON recipe_standard_v4_steps(recipe_id, step_number);',
    '',
  ];

  // 1. Seed all 249 operational canonical ingredients (V1 + Global Extended + V4 Culinary Standard)
  const operationalIngredients = getAllOperationalIngredients();
  const ingRows = operationalIngredients.map((ing) => {
    const nut = getOperationalNutritionV4(ing.id);
    if (!nut) {
      throw new Error(`Missing operational nutrition metadata for ${ing.id}`);
    }
    const allergens = [...getOperationalAllergensV4(ing.id)];
    return `(${sqlText(ing.id)}, ${sqlText(ing.nameVi)}, ${sqlText(ing.nameEn)}, ${sqlText(ing.category)}, ${sqlText(ing.defaultUnit)}, ${sqlNumber(ing.defaultShelfLifeDays)}, ${sqlText(ing.icon ?? '🍽️')}, ${sqlNumber(nut.energyKcal)}, ${sqlNumber(nut.energyKj)}, ${sqlNumber(nut.proteinG)}, ${sqlNumber(nut.fatG)}, ${sqlNumber(nut.saturatedFatG)}, ${sqlNumber(nut.carbohydrateG)}, ${sqlNumber(nut.fiberG)}, ${sqlNumber(nut.sugarG)}, ${sqlNumber(nut.sodiumMg)}, ${sqlNumber(nut.saltG)}, ${sqlNumber(nut.edibleYieldRatio)}, ${sqlText(JSON.stringify(allergens))}, ${sqlText(JSON.stringify(ing.aliases))}, ${sqlText(nut.sourceReference)})`;
  });

  lines.push(
    '-- 1. Seed 249 operational canonical ingredients',
    ...renderChunkedInsert(
      'INSERT INTO culinary_standard_v4_ingredients (id, name_vi, name_en, category, default_unit, default_shelf_life_days, icon, energy_kcal, energy_kj, protein_g, fat_g, saturated_fat_g, carb_g, fiber_g, sugar_g, sodium_mg, salt_g, edible_yield_ratio, allergen_tags_json, aliases_json, source_reference) VALUES',
      ingRows,
    ),
    '',
  );

  // 2. Insert all 500 standardized recipes into recipe_standard_v4_catalog
  const catalogRows = sorted.map((recipe, idx) => {
    const runtimeOrder = orderMap.get(recipe.identity.id) ?? idx;
    const c = recipe.classification;
    const n = recipe.nutrition;
    return `(${sqlText(recipe.identity.id)}, ${sqlText(recipe.identity.slug)}, ${sqlNumber(runtimeOrder)}, ${sqlText(recipe.identity.title)}, ${sqlText(recipe.identity.subtitle)}, ${sqlText(recipe.overview.description)}, ${sqlText(recipe.overview.servingSuggestion)}, ${sqlText(recipe.overview.storageAndReheat)}, ${sqlText(c.cuisine)}, ${sqlText(c.category)}, ${sqlTextOrNull(c.region ?? null)}, ${sqlText(c.difficulty)}, ${sqlNumber(c.prepTimeMinutes)}, ${sqlNumber(c.cookTimeMinutes)}, ${sqlNumber(c.servings)}, ${sqlText(recipe.media.legacyRuntimeImageUrl)}, ${sqlText(JSON.stringify(c.tags))}, ${sqlText(JSON.stringify(c.mealTypes))}, ${sqlText(JSON.stringify(c.methods))}, ${sqlText(JSON.stringify(c.allergenTags))}, ${sqlNumber(Math.round(n.energyKcal))}, ${sqlNumber(n.energyKcal)}, ${sqlNumber(n.energyKj)}, ${sqlNumber(round1(n.proteinG))}, ${sqlNumber(round1(n.fatG))}, ${sqlNumber(round1(n.saturatedFatG))}, ${sqlNumber(round1(n.carbG))}, ${sqlNumber(round1(n.fiberG))}, ${sqlNumber(round1(n.sugarG))}, ${sqlNumber(n.sodiumMg)}, ${sqlNumber(n.saltG)}, ${sqlText(JSON.stringify(n.sourceReferences))}, ${sqlText(recipe.provenance.researchedFromV1Fingerprint)}, ${sqlText(recipe.provenance.researchedFromV2Sha256)}, 4)`;
  });

  lines.push(
    '-- 2. Seed 500 standardized V4 catalog recipes',
    ...renderChunkedInsert(
      'INSERT INTO recipe_standard_v4_catalog (id, slug, runtime_order, title, subtitle, description, serving_suggestion, storage_and_reheat, cuisine, category, region, difficulty, prep_time_minutes, cook_time_minutes, servings, image_url, tags_json, meal_types_json, methods_json, allergen_tags_json, calories, energy_kcal, energy_kj, protein_g, fat_g, saturated_fat_g, carb_g, fiber_g, sugar_g, sodium_mg, salt_g, source_references_json, v1_fingerprint, v2_sha256, recipe_version) VALUES',
      catalogRows,
    ),
    '',
  );

  // 3. Insert all recipe_standard_v4_ingredients and recipe_standard_v4_steps
  const ingredientRows: string[] = [];
  const stepRows: string[] = [];

  for (const recipe of sorted) {
    const recipeId = recipe.identity.id;
    for (const ing of recipe.ingredients) {
      const ingRowId = `${recipeId}_v4_ing_${ing.position + 1}`;
      ingredientRows.push(
        `(${sqlText(ingRowId)}, ${sqlText(recipeId)}, ${sqlNumber(ing.position)}, ${sqlText(ing.ingredientId)}, ${sqlText(ing.name)}, ${sqlText(ing.culinaryMeasure)}, ${sqlTextOrNull(ing.prepNote ?? null)}, ${sqlText(ing.componentGroup)}, ${sqlNumber(ing.requiredQuantity)}, ${sqlText(ing.unit)}, ${sqlNumber(ing.grossGrams)}, ${sqlNumber(ing.edibleRetentionRatio)}, ${sqlNumber(ing.edibleGrams)}, ${ing.isOptional ? 1 : 0}, ${ing.includeInShopping ? 1 : 0})`,
      );
    }

    for (const step of recipe.steps) {
      stepRows.push(
        `(${sqlText(`${recipeId}_v4_step_${step.stepNumber}`)}, ${sqlText(recipeId)}, ${sqlNumber(step.stepNumber)}, ${sqlText(step.phase)}, ${sqlText(step.title)}, ${sqlText(step.instruction)}, ${sqlTextOrNull(step.tip ?? null)}, ${sqlNumberOrNull(step.timerMinutes ?? null)})`,
      );
    }
  }

  lines.push(
    '-- 3. Seed normalized V4 ingredients and cooking steps',
    ...renderChunkedInsert(
      'INSERT INTO recipe_standard_v4_ingredients (id, recipe_id, position, ingredient_id, name, culinary_measure, prep_note, component_group, required_quantity, unit, gross_grams, edible_retention_ratio, edible_grams, is_optional, include_in_shopping) VALUES',
      ingredientRows,
    ),
    '',
    ...renderChunkedInsert(
      'INSERT INTO recipe_standard_v4_steps (id, recipe_id, step_number, phase, title, instruction, tip, timer_minutes) VALUES',
      stepRows,
    ),
  );

  return `${lines.join('\n')}\n`;
}
