import {
  getOperationalAllergensV4,
  getOperationalNutritionV4,
} from '../../../domain/src/culinary-ingredients-v4';
import type {
  StandardRecipeIngredientV4,
  StandardRecipeNutritionV4,
} from './schema';

const round1 = (value: number): number => Math.round((value + Number.EPSILON) * 10) / 10;
const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export function computeEdibleGramsV4(
  grossGrams: number,
  edibleRetentionRatio: number,
): number {
  return round2(grossGrams * edibleRetentionRatio);
}

export function deriveAllergenTagsV4(
  ingredients: readonly Pick<StandardRecipeIngredientV4, 'ingredientId'>[],
): string[] {
  const tags = new Set<string>();
  for (const ing of ingredients) {
    for (const tag of getOperationalAllergensV4(ing.ingredientId)) {
      tags.add(tag);
    }
  }
  return [...tags].sort();
}

export function computeStandardNutritionV4(
  ingredients: readonly Pick<
    StandardRecipeIngredientV4,
    'ingredientId' | 'grossGrams' | 'edibleRetentionRatio'
  >[],
  servings: number,
): StandardRecipeNutritionV4 {
  if (!Number.isInteger(servings) || servings < 1 || servings > 12) {
    throw new Error(`Invalid servings count for nutrition calculation: ${servings}`);
  }

  let totalKcal = 0;
  let totalKj = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalSatFat = 0;
  let totalCarb = 0;
  let totalFiber = 0;
  let totalSugar = 0;
  let totalSodiumMg = 0;
  let totalSaltG = 0;
  const refs = new Set<string>();

  for (const ing of ingredients) {
    const profile = getOperationalNutritionV4(ing.ingredientId);
    if (!profile) {
      throw new Error(`Missing operational nutrition profile for ${ing.ingredientId}`);
    }
    const edibleGrams = computeEdibleGramsV4(ing.grossGrams, ing.edibleRetentionRatio);
    const factor = edibleGrams / 100;
    totalKcal += profile.energyKcal * factor;
    totalKj += profile.energyKj * factor;
    totalProtein += profile.proteinG * factor;
    totalFat += profile.fatG * factor;
    totalSatFat += profile.saturatedFatG * factor;
    totalCarb += profile.carbohydrateG * factor;
    totalFiber += profile.fiberG * factor;
    totalSugar += profile.sugarG * factor;
    totalSodiumMg += profile.sodiumMg * factor;
    totalSaltG += profile.saltG * factor;
    if (edibleGrams > 0) {
      refs.add(profile.sourceReference);
    }
  }

  if (refs.size === 0) {
    refs.add('USDA FoodData Central / MEXT / NIN VN Reference');
  }

  const energyKcal = round1(totalKcal / servings);
  const calories = Math.max(1, Math.round(energyKcal));
  return {
    basis: 'per_serving',
    servings,
    calories,
    energyKcal: energyKcal > 0 ? energyKcal : calories,
    energyKj: Math.max(1, Math.round(totalKj / servings)),
    proteinG: round1(totalProtein / servings),
    fatG: round1(totalFat / servings),
    saturatedFatG: round1(totalSatFat / servings),
    carbG: round1(totalCarb / servings),
    fiberG: round1(totalFiber / servings),
    sugarG: round1(totalSugar / servings),
    sodiumMg: Math.round(totalSodiumMg / servings),
    saltG: round2(totalSaltG / servings),
    methodology: 'deterministic-edible-yield-v4',
    sourceReferences: [...refs].sort(),
  };
}

export function assertNutritionPlausibilityV4(
  nutrition: StandardRecipeNutritionV4,
): { ok: true } | { ok: false; reason: string } {
  if (nutrition.energyKcal < 60 || nutrition.energyKcal > 1400) {
    return {
      ok: false,
      reason: `Per-serving energy ${nutrition.energyKcal} kcal outside realistic range [60..1400]`,
    };
  }
  const atwater = 4 * nutrition.proteinG + 4 * nutrition.carbG + 9 * nutrition.fatG;
  const tolerance = Math.max(35, 0.2 * nutrition.energyKcal);
  if (Math.abs(atwater - nutrition.energyKcal) > tolerance) {
    return {
      ok: false,
      reason: `Atwater energy (${atwater.toFixed(1)}) diverges from energyKcal (${nutrition.energyKcal}) beyond tolerance (${tolerance.toFixed(1)})`,
    };
  }
  return { ok: true };
}
