import {
  findCulinaryIngredientV4,
  formatHumanCulinaryEquivalentVi,
} from '@takolio/domain';
import type { Recipe, RecipeIngredient } from '../types';
import { enrichRecipeToV4 } from './enricher';
import type { RecipeV4, ScaledIngredientV4, ScaledRecipeV4 } from './types';

function isRecipeV4(recipe: RecipeV4 | Recipe): recipe is RecipeV4 {
  return 'v4SchemaVersion' in recipe && recipe.v4SchemaVersion === 4;
}

function isSubLinearSeasoning(ing: RecipeIngredient): boolean {
  const profile = findCulinaryIngredientV4(ing.ingredientId, ing.name);
  if (!profile) {
    return ['COOKING_OIL', 'FISH_SAUCE', 'SOY_SAUCE', 'CHILI', 'GARLIC', 'GINGER'].includes(
      ing.ingredientId.toUpperCase(),
    );
  }
  return (
    profile.parentFamily === 'cooking_fat' ||
    profile.parentFamily === 'condiment_sauce' ||
    profile.parentFamily === 'dry_spice_seasoning' ||
    profile.parentFamily === 'allium_aromatic'
  );
}

function isEggIngredient(ing: RecipeIngredient): boolean {
  const profile = findCulinaryIngredientV4(ing.ingredientId, ing.name);
  return (
    profile?.parentFamily === 'egg' ||
    ing.ingredientId.toUpperCase().includes('EGG')
  );
}

function roundScaledQuantity(raw: number, ing: RecipeIngredient): {
  quantity: number;
  mode: ScaledIngredientV4['scalingMode'];
  subLinear: boolean;
} {
  const subLinear = isSubLinearSeasoning(ing);

  if (isEggIngredient(ing) && ing.unit === 'piece') {
    return {
      quantity: Math.max(1, Math.round(raw)),
      mode: 'countable_rounded',
      subLinear,
    };
  }

  if (ing.unit === 'piece') {
    const halfRounded = Math.max(0.5, Math.round(raw * 2) / 2);
    return {
      quantity: halfRounded,
      mode: subLinear ? 'sublinear_seasoning' : 'countable_rounded',
      subLinear,
    };
  }

  if (ing.unit === 'bunch' || ing.unit === 'pack' || ing.unit === 'slice') {
    const clean = Math.max(0.5, Math.round(raw * 2) / 2);
    return {
      quantity: clean,
      mode: subLinear ? 'sublinear_seasoning' : 'linear',
      subLinear,
    };
  }

  if (ing.unit === 'g' || ing.unit === 'ml') {
    const clean =
      raw >= 100
        ? Math.round(raw / 5) * 5
        : raw >= 15
          ? Math.round(raw)
          : Math.max(1, Math.round(raw * 2) / 2);
    return {
      quantity: clean,
      mode: subLinear ? 'sublinear_seasoning' : 'linear',
      subLinear,
    };
  }

  // kg / l
  const cleanMetric = Number(Math.max(0.01, raw).toFixed(3));
  return {
    quantity: cleanMetric,
    mode: subLinear ? 'sublinear_seasoning' : 'linear',
    subLinear,
  };
}

/**
 * Precision Non-Linear Culinary Scaling for Takolio V4.
 * - Proteins, vegetables & starches scale 1.0x linearly.
 * - Frying oil, braising liquids & pungent spices scale sub-linearly (`ratio ** 0.78`).
 * - Whole countable items (`piece`, `egg`) round cleanly to `0.5` or `1`.
 * - Emits `panCrowdingWarningVi` when `targetServings / baseServings >= 2`.
 */
export function scaleRecipeV4(
  inputRecipe: RecipeV4 | Recipe,
  targetServings: number,
): ScaledRecipeV4 {
  if (!Number.isFinite(targetServings) || targetServings < 1 || targetServings > 24) {
    throw new RangeError('Target servings must be between 1 and 24');
  }
  const cleanTarget = Math.round(targetServings);
  const v4: RecipeV4 = isRecipeV4(inputRecipe) ? inputRecipe : enrichRecipeToV4(inputRecipe);
  const baseServings = Math.max(1, v4.baseServings || v4.servings || 2);
  const linearRatio = cleanTarget / baseServings;
  const subLinearRatio = linearRatio === 1 ? 1 : Math.pow(linearRatio, 0.78);

  const scaledByIngredientIndex = new Map<string, number>();

  const scaledIngredients: ScaledIngredientV4[] = v4.ingredients.map((ing, idx) => {
    if (cleanTarget === baseServings) {
      scaledByIngredientIndex.set(`${ing.ingredientId}:${idx}`, ing.requiredQuantity);
      return {
        ...ing,
        baseQuantity: ing.requiredQuantity,
        scalingMode: isSubLinearSeasoning(ing) ? 'sublinear_seasoning' : 'linear',
        appliedFactor: 1,
        formattedAmountVi: formatHumanCulinaryEquivalentVi(
          ing.requiredQuantity,
          ing.unit,
          ing.ingredientId,
          ing.name,
        ),
      };
    }

    const factor = isSubLinearSeasoning(ing) ? subLinearRatio : linearRatio;
    const raw = ing.requiredQuantity * factor;
    const { quantity, mode } = roundScaledQuantity(raw, ing);
    scaledByIngredientIndex.set(`${ing.ingredientId}:${idx}`, quantity);

    return {
      ...ing,
      baseQuantity: ing.requiredQuantity,
      requiredQuantity: quantity,
      scalingMode: mode,
      appliedFactor: ing.requiredQuantity > 0 ? Number((quantity / ing.requiredQuantity).toFixed(3)) : factor,
      formattedAmountVi: formatHumanCulinaryEquivalentVi(
        quantity,
        ing.unit,
        ing.ingredientId,
        ing.name,
      ),
    };
  });

  // Update per-step ingredient allocations cleanly
  const scaledTotalById = new Map<string, number>();
  for (const line of scaledIngredients) {
    scaledTotalById.set(line.ingredientId, line.requiredQuantity);
  }

  const scaledSteps = v4.steps.map((step) => ({
    ...step,
    stepIngredients: step.stepIngredients.map((alloc) => {
      const newTotal = scaledTotalById.get(alloc.ingredientId) ?? alloc.totalRecipeQuantity;
      const rawAlloc =
        alloc.usageKind === 'prep_whole' ||
        alloc.usageKind === 'use_prepped' ||
        alloc.usageKind === 'full_addition'
          ? newTotal
          : newTotal * alloc.allocationRatio;
      const cleanAlloc =
        alloc.unit === 'g' || alloc.unit === 'ml'
          ? rawAlloc >= 15
            ? Math.round(rawAlloc)
            : Number(Math.max(0.5, Math.round(rawAlloc * 2) / 2).toFixed(1))
          : Number((Math.round(rawAlloc * 2) / 2).toFixed(2));
      return {
        ...alloc,
        allocatedQuantity: cleanAlloc,
        totalRecipeQuantity: newTotal,
        formattedAmountVi: formatHumanCulinaryEquivalentVi(
          cleanAlloc,
          alloc.unit,
          alloc.ingredientId,
          alloc.name,
        ),
      };
    }),
  }));

  const ratioFormatted = Number.isInteger(linearRatio)
    ? String(linearRatio)
    : linearRatio.toFixed(1).replace('.', ',');

  const panCrowdingWarningVi =
    linearRatio >= 2
      ? `Khẩu phần tăng gấp ${ratioFormatted} lần (${cleanTarget} người): Nên chia làm 2 mẻ khi xào/chiên áp chảo hoặc dùng nồi/chảo đáy rộng để nhiệt truyền đều, tránh làm nguyên liệu bị ra nước.`
      : null;

  return {
    ...v4,
    servings: cleanTarget,
    targetServings: cleanTarget,
    scalingFactor: Number(linearRatio.toFixed(3)),
    subLinearFactor: Number(subLinearRatio.toFixed(3)),
    panCrowdingWarningVi,
    ingredients: scaledIngredients,
    steps: scaledSteps,
  };
}
