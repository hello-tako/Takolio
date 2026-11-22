import { getAllOperationalIngredients } from '../../../domain/src/culinary-ingredients-v4';
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
const round4 = (value: number): number => Math.round((value + Number.EPSILON) * 10000) / 10000;

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

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function weightedEdibleYield(recipe: StandardRecipeV4): number {
  let gross = 0;
  let edible = 0;
  for (const ing of recipe.ingredients) {
    if (ing.ingredientId === 'COOKING_WATER') continue;
    gross += ing.grossGrams;
    edible += ing.edibleGrams;
  }
  if (gross <= 0 || edible <= 0) return 1;
  return Math.min(1, Math.max(0.01, round4(edible / gross)));
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
    '-- Proposed Migration 0052: Takolio Culinary Standard V4 (500 Standardized Recipes)',
    '-- Prerequisite: canonical migration ordering through 0051_privacy_erasure_portability_and_consent_ledger.sql.',
    '-- Updates all 500 catalog recipes with complete operational ingredients, chef-grade cooking steps,',
    '-- deterministic USDA/MEXT/NIN nutrition profiles, and statutory allergen/method classifications.',
    '',
  ];

  // 1. Seed all operational ingredients & aliases (V1 + Global Extended + V4 Culinary Standard)
  const operationalIngredients = getAllOperationalIngredients();
  lines.push(
    '-- 1. Seed all operational canonical ingredients and aliases (INSERT OR IGNORE)',
    ...renderChunkedInsert(
      'INSERT OR IGNORE INTO ingredients (id, name_vi, name_en, category, default_unit, default_shelf_life_days, icon) VALUES',
      operationalIngredients.map(
        (ing) =>
          `(${sqlText(ing.id)}, ${sqlText(ing.nameVi)}, ${sqlText(ing.nameEn)}, ${sqlText(ing.category)}, ${sqlText(ing.defaultUnit)}, ${sqlNumber(ing.defaultShelfLifeDays)}, ${sqlTextOrNull(ing.icon ?? null)})`,
      ),
    ),
    '',
  );

  const aliasRows: string[] = [];
  for (const ing of operationalIngredients) {
    ing.aliases.forEach((alias, index) => {
      aliasRows.push(
        `(${sqlText(`v4_alias_${ing.id}_${index + 1}`)}, ${sqlText(ing.id)}, ${sqlText(alias)})`,
      );
    });
  }
  if (aliasRows.length > 0) {
    lines.push(
      ...renderChunkedInsert(
        'INSERT OR IGNORE INTO ingredient_aliases (id, ingredient_id, alias) VALUES',
        aliasRows,
      ),
      '',
    );
  }

  // 2. Upsert nutrition_profiles for all 500 recipes
  lines.push('-- 2. Upsert V4 per-serving nutrition profiles (with EU Big 7 & edible yield)');
  for (const chunk of chunkArray(sorted, 150)) {
    const rows = chunk.map((recipe) => {
      const n = recipe.nutrition;
      const profileId = `${recipe.identity.id}_nutrition_v4`;
      const refText = `Takolio Culinary Standard V4 (${n.sourceReferences.slice(0, 3).join('; ')})`.slice(0, 290);
      return `(${sqlText(profileId)}, 1, 'serving', 'calculated', ${sqlText(refText)}, ${sqlNumber(n.energyKcal)}, ${sqlNumber(n.proteinG)}, ${sqlNumber(n.carbG)}, ${sqlNumber(n.fatG)}, ${sqlNumber(n.fiberG)}, ${sqlNumber(n.sugarG)}, ${sqlNumber(n.sodiumMg)}, ${sqlNumber(n.energyKj)}, ${sqlNumber(n.saturatedFatG)}, ${sqlNumber(n.saltG)}, ${sqlNumber(weightedEdibleYield(recipe))})`;
    });
    lines.push(
      `INSERT INTO nutrition_profiles (id, basis_quantity, basis_unit, source_type, source_reference, energy_kcal, protein_g, carbohydrate_g, fat_g, fiber_g, sugar_g, sodium_mg, energy_kj, saturated_fat_g, salt_g, edible_yield_ratio) VALUES\n${rows.join(',\n')}\nON CONFLICT(id) DO UPDATE SET\n  source_type = excluded.source_type,\n  source_reference = excluded.source_reference,\n  energy_kcal = excluded.energy_kcal,\n  protein_g = excluded.protein_g,\n  carbohydrate_g = excluded.carbohydrate_g,\n  fat_g = excluded.fat_g,\n  fiber_g = excluded.fiber_g,\n  sugar_g = excluded.sugar_g,\n  sodium_mg = excluded.sodium_mg,\n  energy_kj = excluded.energy_kj,\n  saturated_fat_g = excluded.saturated_fat_g,\n  salt_g = excluded.salt_g,\n  edible_yield_ratio = excluded.edible_yield_ratio;`,
      '',
    );
  }

  // 3. Upsert 500 recipes rows (version = 4, curated & reviewed)
  lines.push('-- 3. Upsert 500 standardized recipes rows');
  for (const chunk of chunkArray(sorted, 100)) {
    const rows = chunk.map((recipe) => {
      const c = recipe.classification;
      return `(${sqlText(recipe.identity.id)}, ${sqlText(recipe.identity.slug)}, ${sqlText(recipe.identity.title)}, ${sqlText(recipe.overview.description)}, ${sqlText(c.cuisine)}, ${sqlNumber(c.cookTimeMinutes)}, ${sqlNumber(c.servings)}, ${sqlText(c.difficulty)}, ${sqlText(recipe.media.legacyRuntimeImageUrl)}, ${sqlText(JSON.stringify(c.tags))}, ${sqlNumber(c.prepTimeMinutes)}, 'curated', 'Takolio Culinary Standard V4', 'reviewed', 4)`;
    });
    lines.push(
      `INSERT INTO recipes (id, slug, title, description, cuisine, cook_time_minutes, servings, difficulty, image_url, tags, prep_time_minutes, source_type, source_reference, verification_state, version) VALUES\n${rows.join(',\n')}\nON CONFLICT(id) DO UPDATE SET\n  slug = excluded.slug,\n  title = excluded.title,\n  description = excluded.description,\n  cuisine = excluded.cuisine,\n  cook_time_minutes = excluded.cook_time_minutes,\n  servings = excluded.servings,\n  difficulty = excluded.difficulty,\n  image_url = excluded.image_url,\n  tags = excluded.tags,\n  prep_time_minutes = excluded.prep_time_minutes,\n  source_type = excluded.source_type,\n  source_reference = excluded.source_reference,\n  verification_state = excluded.verification_state,\n  version = excluded.version;`,
      '',
    );
  }

  // 4. Link recipe_nutrition for version 4
  lines.push(
    '-- 4. Link recipe_nutrition for version 4',
    ...renderChunkedInsert(
      'INSERT OR IGNORE INTO recipe_nutrition (recipe_id, recipe_version, nutrition_profile_id) VALUES',
      sorted.map(
        (recipe) =>
          `(${sqlText(recipe.identity.id)}, 4, ${sqlText(`${recipe.identity.id}_nutrition_v4`)})`,
      ),
    ),
    '',
  );

  // 5. Replace recipe_ingredients, recipe_runtime_ingredient_order, recipe_steps, recipe_classifications for the 500 IDs
  lines.push('-- 5. Replace child recipe_ingredients, recipe_steps, and recipe_classifications for 500 recipes');
  for (const idChunk of chunkArray(
    sorted.map((r) => sqlText(r.identity.id)),
    200,
  )) {
    const inClause = idChunk.join(', ');
    lines.push(`DELETE FROM recipe_runtime_ingredient_order WHERE recipe_id IN (${inClause});`);
    lines.push(`DELETE FROM recipe_ingredients WHERE recipe_id IN (${inClause});`);
    lines.push(`DELETE FROM recipe_steps WHERE recipe_id IN (${inClause});`);
    lines.push(`DELETE FROM recipe_classifications WHERE recipe_id IN (${inClause});`);
  }
  lines.push('');

  const ingredientRows: string[] = [];
  const orderRows: string[] = [];
  const stepRows: string[] = [];
  const classificationRows: string[] = [];

  for (const recipe of sorted) {
    const runtime = compileStandardRecipeV4ToRuntime(recipe);
    runtime.ingredients.forEach((ing, idx) => {
      const ingRowId = `${runtime.id}_v4_ing_${idx + 1}`;
      ingredientRows.push(
        `(${sqlText(ingRowId)}, ${sqlText(runtime.id)}, ${sqlText(ing.ingredientId)}, ${sqlText(ing.name)}, ${sqlNumber(ing.requiredQuantity)}, ${sqlText(ing.unit)}, ${ing.isOptional ? 1 : 0})`,
      );
      orderRows.push(`(${sqlText(ingRowId)}, ${sqlText(runtime.id)}, ${sqlNumber(idx)})`);
    });

    for (const step of runtime.steps) {
      stepRows.push(
        `(${sqlText(`${runtime.id}_v4_step_${step.stepNumber}`)}, ${sqlText(runtime.id)}, ${sqlNumber(step.stepNumber)}, ${sqlText(step.instruction)}, ${sqlTextOrNull(step.tip ?? null)}, ${sqlNumberOrNull(step.timerMinutes ?? null)})`,
      );
    }

    for (const mealType of recipe.classification.mealTypes) {
      classificationRows.push(`(${sqlText(runtime.id)}, 'meal_type', ${sqlText(mealType)})`);
    }
    for (const method of recipe.classification.methods) {
      classificationRows.push(`(${sqlText(runtime.id)}, 'method', ${sqlText(method)})`);
    }
    for (const allergen of recipe.classification.allergenTags) {
      classificationRows.push(`(${sqlText(runtime.id)}, 'allergen', ${sqlText(allergen)})`);
    }
  }

  lines.push(
    ...renderChunkedInsert(
      'INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, name, required_quantity, unit, is_optional) VALUES',
      ingredientRows,
    ),
    '',
    ...renderChunkedInsert(
      'INSERT INTO recipe_runtime_ingredient_order (recipe_ingredient_id, recipe_id, position) VALUES',
      orderRows,
    ),
    '',
    ...renderChunkedInsert(
      'INSERT INTO recipe_steps (id, recipe_id, step_number, instruction, tip, timer_minutes) VALUES',
      stepRows,
    ),
    '',
    ...renderChunkedInsert(
      'INSERT OR IGNORE INTO recipe_classifications (recipe_id, kind, tag) VALUES',
      classificationRows,
    ),
    '',
  );

  // 6. Update recipe_runtime_fields preserving canonical runtime_order (0..499)
  lines.push('-- 6. Update recipe_runtime_fields with standardized category, region, and V4 macros');
  for (const chunk of chunkArray(sorted, 150)) {
    const rows = chunk.map((recipe, idx) => {
      const runtimeOrder = orderMap.get(recipe.identity.id) ?? idx;
      const n = recipe.nutrition;
      return `(${sqlText(recipe.identity.id)}, ${sqlNumber(runtimeOrder)}, ${sqlText(recipe.classification.category)}, ${sqlTextOrNull(recipe.classification.region ?? null)}, ${sqlNumber(Math.round(n.energyKcal))}, ${sqlNumber(round1(n.proteinG))}, ${sqlNumber(round1(n.fatG))}, ${sqlNumber(round1(n.carbG))})`;
    });
    lines.push(
      `INSERT INTO recipe_runtime_fields (recipe_id, runtime_order, category, region, legacy_calories, legacy_protein_g, legacy_fat_g, legacy_carb_g) VALUES\n${rows.join(',\n')}\nON CONFLICT(recipe_id) DO UPDATE SET\n  runtime_order = excluded.runtime_order,\n  category = excluded.category,\n  region = excluded.region,\n  legacy_calories = excluded.legacy_calories,\n  legacy_protein_g = excluded.legacy_protein_g,\n  legacy_fat_g = excluded.legacy_fat_g,\n  legacy_carb_g = excluded.legacy_carb_g;`,
      '',
    );
  }

  return `${lines.join('\n')}\n`;
}
