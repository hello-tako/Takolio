import {
  convertCulinaryQuantity,
  formatHumanCulinaryEquivalentVi,
  isPantryStapleIngredient,
  normalizeIngredientText,
} from '@takolio/domain';
import type { Recipe } from '../types';
import { enrichRecipeToV4 } from './enricher';
import { scaleRecipeV4 } from './scaling';
import type {
  ConsolidatedMamComIngredient,
  EquipmentItemV4,
  MamComColorSlot,
  ParallelCookingDishSummary,
  ParallelCookingPlan,
  ParallelTimelineStep,
  RecipeStepV4,
  RecipeV4,
  ScaledRecipeV4,
  StepCookwareV4,
} from './types';

const COLOR_SLOTS: readonly MamComColorSlot[] = ['terracotta', 'jade', 'amber', 'cobalt'];

function inferDishRoleVi(recipe: Recipe): string {
  const cat = recipe.category?.toLowerCase() ?? '';
  const titleNorm = normalizeIngredientText(recipe.title);
  if (cat === 'mon_kho' || /\b(kho|rim)\b/.test(titleNorm)) return 'Món mặn (Kho / Rim)';
  if (cat === 'mon_canh' || /\b(canh|sup)\b/.test(titleNorm)) return 'Món canh thanh mát';
  if (cat === 'mon_xao' || /\b(xao)\b/.test(titleNorm)) return 'Món xào lửa lớn';
  if (cat === 'mon_chien' || /\b(chien|ran)\b/.test(titleNorm)) return 'Món chiên giòn';
  if (cat === 'mon_hap_luoc' || /\b(hap|luoc)\b/.test(titleNorm)) return 'Món hấp / luộc';
  if (cat === 'mon_cuon_nom' || /\b(goi|cuon|nom)\b/.test(titleNorm)) return 'Món gỏi / cuốn';
  if (cat === 'mon_chay') return 'Món chay thanh đạm';
  if (/\b(com)\b/.test(titleNorm)) return 'Cơm & tinh bột';
  return 'Món chính';
}

function isQuickStirFryDish(recipe: RecipeV4 | ScaledRecipeV4): boolean {
  const titleNorm = normalizeIngredientText(recipe.title);
  return (
    recipe.category === 'mon_xao' ||
    (/\b(xao)\b/.test(titleNorm) && recipe.passiveSimmerMinutes === 0)
  );
}

function dishHasLongPassiveWindow(recipe: RecipeV4 | ScaledRecipeV4): boolean {
  return (
    recipe.passiveSimmerMinutes >= 8 ||
    recipe.steps.some(
      (s) =>
        s.technique === 'braise' ||
        (s.technique === 'simmer' && s.estimatedDurationMinutes >= 8) ||
        s.phase === 'marinate',
    )
  );
}

/**
 * Assigns a scheduling wave priority to a step while respecting intra-dish order.
 * Lower bucket = scheduled earlier in the Mâm Cơm workflow.
 */
function computeStepWaveBucket(
  dish: ParallelCookingDishSummary,
  step: RecipeStepV4,
  stepIdx: number,
): number {
  const enriched = dish.enrichedRecipe;
  const quickStirFry = isQuickStirFryDish(enriched);
  const longSimmer = dishHasLongPassiveWindow(enriched);

  // Final plating always lands at the end so all dishes hit the table piping hot together
  if (step.phase === 'plate') {
    return quickStirFry ? 49 : 50;
  }

  // Mise en place & marinades come first; slow-braise/marinate dishes prep before quick greens
  if (step.phase === 'mise_en_place' || step.phase === 'marinate') {
    if (step.phase === 'marinate') return 12;
    return longSimmer ? 8 : quickStirFry ? 18 : 14;
  }

  // Quick stir-fry active cooking waits until just before plating!
  if (quickStirFry && step.phase === 'active_cook') {
    return 40 + stepIdx;
  }

  // Long braise/simmer dishes launch early onto the stove so their passive simmer overlaps other work
  if (longSimmer) {
    // Steps leading up to or launching the passive simmer get priority 20..24
    const firstPassiveIdx = enriched.steps.findIndex((s) => s.isPassiveWait && s.phase === 'active_cook');
    if (firstPassiveIdx >= 0 && stepIdx <= firstPassiveIdx) {
      return 20 + stepIdx;
    }
    return 32 + stepIdx;
  }

  // Soups & medium dishes cook in the middle window (overlapping passive braises!)
  return 28 + stepIdx;
}

function consolidateIngredients(
  dishes: ParallelCookingDishSummary[],
): ConsolidatedMamComIngredient[] {
  const byKey = new Map<
    string,
    {
      ingredientId: string;
      name: string;
      totalQuantity: number;
      unit: Recipe['ingredients'][number]['unit'];
      usedInRecipes: Set<string>;
      isPantryStaple: boolean;
    }
  >();

  for (const dish of dishes) {
    for (const line of dish.enrichedRecipe.ingredients) {
      const idKey = line.ingredientId.toUpperCase();
      const existing = byKey.get(idKey);
      if (!existing) {
        byKey.set(idKey, {
          ingredientId: line.ingredientId,
          name: line.name,
          totalQuantity: line.requiredQuantity,
          unit: line.unit,
          usedInRecipes: new Set([dish.title]),
          isPantryStaple: isPantryStapleIngredient(line.ingredientId, line.name),
        });
        continue;
      }

      existing.usedInRecipes.add(dish.title);
      if (existing.unit === line.unit) {
        existing.totalQuantity = Number((existing.totalQuantity + line.requiredQuantity).toFixed(3));
      } else {
        const bridged = convertCulinaryQuantity({
          quantity: line.requiredQuantity,
          fromUnit: line.unit,
          toUnit: existing.unit,
          ingredientId: line.ingredientId,
          ingredientName: line.name,
        });
        if (bridged) {
          existing.totalQuantity = Number(
            (existing.totalQuantity + bridged.convertedQuantity).toFixed(3),
          );
        } else {
          // Separate line if units are genuinely unbridgeable
          const altKey = `${idKey}:${line.unit}`;
          const altExisting = byKey.get(altKey);
          if (altExisting) {
            altExisting.totalQuantity = Number(
              (altExisting.totalQuantity + line.requiredQuantity).toFixed(3),
            );
            altExisting.usedInRecipes.add(dish.title);
          } else {
            byKey.set(altKey, {
              ingredientId: line.ingredientId,
              name: line.name,
              totalQuantity: line.requiredQuantity,
              unit: line.unit,
              usedInRecipes: new Set([dish.title]),
              isPantryStaple: isPantryStapleIngredient(line.ingredientId, line.name),
            });
          }
        }
      }
    }
  }

  return [...byKey.values()]
    .sort((a, b) => Number(a.isPantryStaple) - Number(b.isPantryStaple))
    .map((entry) => ({
      ingredientId: entry.ingredientId,
      name: entry.name,
      totalQuantity: entry.totalQuantity,
      unit: entry.unit,
      formattedAmountVi: formatHumanCulinaryEquivalentVi(
        entry.totalQuantity,
        entry.unit,
        entry.ingredientId,
        entry.name,
      ),
      usedInRecipes: [...entry.usedInRecipes],
      isPantryStaple: entry.isPantryStaple,
    }));
}

/**
 * Mâm Cơm Conductor: Builds a unified, interleaved parallel cooking DAG timeline across 1..4 dishes.
 * - Groups Mise-en-place & Marinades early
 * - Starts passive braises/simmers first
 * - Overlaps soup & quick-dish prep inside passive simmer windows
 * - Schedules high-heat stir-fried greens right before synchronized plating
 */
export function buildParallelMamComTimeline(
  recipes: Recipe[],
  targetServings?: number,
): ParallelCookingPlan {
  const bounded = recipes.slice(0, 4);
  const resolvedServings =
    targetServings && Number.isFinite(targetServings) && targetServings >= 1
      ? Math.min(24, Math.round(targetServings))
      : bounded[0]?.servings ?? 4;

  if (bounded.length === 0) {
    return {
      planId: 'mam-com-empty',
      targetServings: resolvedServings,
      dishes: [],
      timelineSteps: [],
      consolidatedIngredients: [],
      equipmentSummary: [],
      sequentialTotalMinutes: 0,
      parallelTotalMinutes: 0,
      savedMinutes: 0,
      burnerConcurrencyPeak: 0,
      summaryHeadlineVi: 'Chưa chọn món trong mâm cơm.',
    };
  }

  const dishes: ParallelCookingDishSummary[] = bounded.map((recipe, index) => {
    const enriched =
      targetServings !== undefined
        ? scaleRecipeV4(recipe, resolvedServings)
        : enrichRecipeToV4(recipe);
    return {
      recipeId: recipe.id,
      slug: recipe.slug,
      title: recipe.title,
      dishRoleVi: inferDishRoleVi(recipe),
      dishColorSlot: COLOR_SLOTS[index % COLOR_SLOTS.length],
      enrichedRecipe: enriched,
    };
  });

  // Frontier scheduler: always picks the lowest-bucket available next step across dishes
  // so intra-dish topological order is 100% preserved while interleaving across dishes.
  const cursors = dishes.map(() => 0);
  const orderedNodes: Array<{
    dish: ParallelCookingDishSummary;
    step: RecipeStepV4;
    stepIdx: number;
    bucket: number;
  }> = [];

  const totalStepCount = dishes.reduce((sum, d) => sum + d.enrichedRecipe.steps.length, 0);

  for (let iter = 0; iter < totalStepCount; iter++) {
    let bestDishIdx = -1;
    let bestBucket = Infinity;

    for (let dIdx = 0; dIdx < dishes.length; dIdx++) {
      const sIdx = cursors[dIdx];
      const steps = dishes[dIdx].enrichedRecipe.steps;
      if (sIdx >= steps.length) continue;
      const candidateBucket = computeStepWaveBucket(dishes[dIdx], steps[sIdx], sIdx);
      if (candidateBucket < bestBucket) {
        bestBucket = candidateBucket;
        bestDishIdx = dIdx;
      }
    }

    if (bestDishIdx < 0) break;
    const chosenStepIdx = cursors[bestDishIdx];
    cursors[bestDishIdx]++;
    orderedNodes.push({
      dish: dishes[bestDishIdx],
      step: dishes[bestDishIdx].enrichedRecipe.steps[chosenStepIdx],
      stepIdx: chosenStepIdx,
      bucket: bestBucket,
    });
  }

  // Simulate chef hands-on clock + background passive simmer windows
  let chefClock = 0;
  const dishReadyAt = new Map<string, number>();
  const activePassiveWindows: Array<{
    recipeId: string;
    recipeTitle: string;
    endsAtMinute: number;
    usesBurner: boolean;
  }> = [];

  const timelineSteps: ParallelTimelineStep[] = orderedNodes.map((node, orderIndex) => {
    const { dish, step } = node;
    const prevDishReady = dishReadyAt.get(dish.recipeId) ?? 0;

    // A step on the same dish must wait if its own previous passive step hasn't finished yet
    const startMinute = Math.max(chefClock, prevDishReady);
    const duration = Math.max(1, step.estimatedDurationMinutes);
    const endMinute = startMinute + duration;

    // Prune expired passive windows
    const overlapping = activePassiveWindows.filter(
      (win) => win.recipeId !== dish.recipeId && win.endsAtMinute > startMinute,
    );
    const overlapsWithRecipeTitles = [...new Set(overlapping.map((w) => w.recipeTitle))];

    let parallelHintVi: string | null = null;
    if (step.isPassiveWait && dishes.length > 1) {
      parallelHintVi =
        step.phase === 'marinate'
          ? `Để ${dish.title} thấm gia vị, chuyển sang sơ chế món tiếp theo ngay.`
          : `Bật hẹn giờ ${duration} phút cho ${dish.title} rồi tranh thủ làm song song món bên cạnh.`;
    } else if (overlapsWithRecipeTitles.length > 0) {
      parallelHintVi = `Thực hiện tranh thủ trong lúc ${overlapsWithRecipeTitles.join(', ')} đang ninh/ướp nền.`;
    }

    if (step.isPassiveWait) {
      // Chef spends ~1.5-2 min setting up the pot/marinade, then moves immediately to next dish!
      const handsOnSetup = Math.min(2, duration);
      chefClock = startMinute + handsOnSetup;
      dishReadyAt.set(dish.recipeId, endMinute);
      activePassiveWindows.push({
        recipeId: dish.recipeId,
        recipeTitle: dish.title,
        endsAtMinute: endMinute,
        usesBurner: step.heatLevel !== 'off',
      });
    } else {
      chefClock = endMinute;
      dishReadyAt.set(dish.recipeId, endMinute);
    }

    return {
      timelineStepId: `${dish.recipeId}:step:${step.stepNumber}`,
      orderIndex,
      recipeId: dish.recipeId,
      recipeSlug: dish.slug,
      recipeTitle: dish.title,
      dishColorSlot: dish.dishColorSlot,
      dishRoleVi: dish.dishRoleVi,
      originalStepNumber: step.stepNumber,
      startMinuteOffset: Math.round(startMinute),
      endMinuteOffset: Math.round(endMinute),
      durationMinutes: duration,
      isPassiveBackground: step.isPassiveWait,
      overlapsWithRecipeTitles,
      parallelHintVi,
      step,
    };
  });

  // Compute burner concurrency peak across active stove steps
  let burnerConcurrencyPeak = 0;
  for (const tStep of timelineSteps) {
    if (tStep.step.heatLevel === 'off') continue;
    const mid = (tStep.startMinuteOffset + tStep.endMinuteOffset) / 2;
    const concurrentBurners = timelineSteps.filter(
      (other) =>
        other.step.heatLevel !== 'off' &&
        other.startMinuteOffset <= mid &&
        other.endMinuteOffset > mid,
    ).length;
    if (concurrentBurners > burnerConcurrencyPeak) {
      burnerConcurrencyPeak = concurrentBurners;
    }
  }
  burnerConcurrencyPeak = Math.min(2, Math.max(burnerConcurrencyPeak > 0 ? 1 : 0, burnerConcurrencyPeak));

  const sequentialTotalMinutes = dishes.reduce(
    (sum, d) => sum + d.enrichedRecipe.totalTimeMinutes,
    0,
  );
  const rawParallelEnd = timelineSteps.reduce(
    (maxEnd, s) => Math.max(maxEnd, s.endMinuteOffset),
    0,
  );
  const parallelTotalMinutes = Math.min(sequentialTotalMinutes, Math.max(1, rawParallelEnd));
  const savedMinutes = Math.max(0, sequentialTotalMinutes - parallelTotalMinutes);

  const equipmentMap = new Map<StepCookwareV4, EquipmentItemV4>();
  for (const dish of dishes) {
    for (const eq of dish.enrichedRecipe.equipmentList) {
      if (!equipmentMap.has(eq.id)) equipmentMap.set(eq.id, eq);
    }
  }

  const consolidatedIngredients = consolidateIngredients(dishes);
  const planId = `mam-com-${dishes.map((d) => d.recipeId).join('-')}-${resolvedServings}`;
  const summaryHeadlineVi =
    dishes.length === 1
      ? `${dishes[0].title} · Hoàn thành trong ${parallelTotalMinutes} phút`
      : savedMinutes > 0
        ? `Mâm cơm ${dishes.length} món nóng hổi cùng lúc trong ${parallelTotalMinutes} phút (tiết kiệm ${savedMinutes} phút chờ ninh/ướp)`
        : `Mâm cơm ${dishes.length} món phối hợp nhịp nhàng trong ${parallelTotalMinutes} phút`;

  return {
    planId,
    targetServings: resolvedServings,
    dishes,
    timelineSteps,
    consolidatedIngredients,
    equipmentSummary: [...equipmentMap.values()],
    sequentialTotalMinutes,
    parallelTotalMinutes,
    savedMinutes,
    burnerConcurrencyPeak,
    summaryHeadlineVi,
  };
}
