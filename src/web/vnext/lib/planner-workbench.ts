import type { QueryClient } from '@tanstack/react-query';
import type {
  PlanCompositionsDto,
  SlotCompositionDto,
} from '../../../../packages/domain/src/meal-composition-api';
import type {
  MealPlanDto,
  MealPlanningIntent,
} from '../../../../packages/domain/src/meal-planning-api';
import { queryKeys } from '../../lib/queryKeys';
import { shoppingApi } from '../../services/shopping';
import { localDate } from '../../features/planner/intent';
import { plannerLocalDate } from '../../features/planner/schedule';

const VI_UNIT_LABELS: Record<string, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'lít',
  piece: 'phần',
  bunch: 'bó',
  pack: 'gói',
  slice: 'lát',
};

/**
 * Formats culinary quantities cleanly for family cooking & shopping without
 * raw floating-point noise like `66,6666666667 g`.
 */
export function formatKitchenAmount(
  quantity: number | null | undefined,
  unit: string,
): string {
  if (quantity === null || quantity === undefined || !Number.isFinite(quantity)) {
    return 'Tuỳ chỉnh';
  }
  const unitLabel = VI_UNIT_LABELS[unit] ?? unit;
  let displayVal: number;
  if (unit === 'g' || unit === 'ml') {
    if (Math.abs(quantity - Math.round(quantity)) < 0.01) {
      displayVal = Math.round(quantity);
    } else if (quantity >= 25) {
      displayVal = Math.round(quantity / 5) * 5;
    } else {
      displayVal = Math.round(quantity * 10) / 10;
    }
  } else if (unit === 'kg' || unit === 'l') {
    displayVal = Math.round(quantity * 100) / 100;
  } else {
    displayVal = Math.round(quantity * 2) / 2 || Math.round(quantity * 10) / 10;
  }

  const isApprox = Math.abs(displayVal - quantity) > 0.02;
  const formatted = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(displayVal);

  return `${isApprox ? '~' : ''}${formatted} ${unitLabel}`;
}

/**
 * Same-day friendly editability check: allows editing any meal on today's date
 * or future dates (unlike legacy `isPlannerSlotElapsed` which locked tonight's
 * dinner at 18:01 sharp). Only strictly past calendar dates are locked.
 */
export function isSlotEditableTodayOrFuture(
  plan: MealPlanDto,
  slotDate: string,
): boolean {
  const refToday = plannerLocalDate(plan) ?? localDate(new Date());
  return slotDate >= refToday;
}

/**
 * Applies a `SlotCompositionDto` mutation response directly into TanStack Query
 * caches at `dto.planRevision` so the UI updates instantaneously with zero screen
 * unmount/remount, then refreshes full cross-slot assessment in the background.
 */
export function acceptSlotCompositionMutation(
  queryClient: QueryClient,
  currentPlan: MealPlanDto,
  previousCompositions: PlanCompositionsDto | null | undefined,
  dto: SlotCompositionDto,
): MealPlanDto {
  const nextPlan: MealPlanDto = {
    ...currentPlan,
    revision: dto.planRevision,
    updatedAt: new Date().toISOString(),
  };

  queryClient.setQueryData(queryKeys.mealPlanningPlan(nextPlan.id), nextPlan);
  queryClient.setQueryData(queryKeys.currentMealPlanningPlan(), nextPlan);

  if (previousCompositions && previousCompositions.planId === nextPlan.id) {
    const exists = previousCompositions.compositions.some(
      (c) => c.slotId === dto.composition.slotId,
    );
    const nextCompositions: PlanCompositionsDto = {
      ...previousCompositions,
      planRevision: dto.planRevision,
      compositions: exists
        ? previousCompositions.compositions.map((c) =>
            c.slotId === dto.composition.slotId ? dto.composition : c,
          )
        : [...previousCompositions.compositions, dto.composition],
    };
    queryClient.setQueryData(
      queryKeys.mealPlanningCompositions(nextPlan.id, dto.planRevision),
      nextCompositions,
    );
  }

  // Refresh full week FEFO projection in background without tearing down UI
  void queryClient.invalidateQueries({
    queryKey: queryKeys.mealPlanningCompositions(nextPlan.id, dto.planRevision),
    exact: true,
  });

  return nextPlan;
}

export function resolvePlanShoppingWindow(
  plan: MealPlanDto,
  presetDays?: number,
): { startDate: string; endDate: string } {
  const todayIso = plannerLocalDate(plan) ?? localDate(new Date());
  const slotDates = plan.intent.slots.map((s) => s.date).sort();
  const minPlanDate = slotDates[0] ?? plan.intent.startDate;
  const maxPlanDate = slotDates[slotDates.length - 1] ?? minPlanDate;

  const startDate = minPlanDate > todayIso ? minPlanDate : todayIso <= maxPlanDate ? todayIso : minPlanDate;

  if (!presetDays) {
    return {
      startDate,
      endDate: maxPlanDate >= startDate ? maxPlanDate : startDate,
    };
  }

  const endObj = new Date(`${startDate}T12:00:00Z`);
  endObj.setUTCDate(endObj.getUTCDate() + Math.max(1, presetDays) - 1);
  const candidateEnd = endObj.toISOString().slice(0, 10);
  const clampedEnd = candidateEnd > maxPlanDate ? maxPlanDate : candidateEnd;
  return {
    startDate,
    endDate: clampedEnd >= startDate ? clampedEnd : startDate,
  };
}

export async function syncPlanToShoppingList(
  queryClient: QueryClient,
  plan: MealPlanDto,
  options?: { days?: number },
) {
  const { startDate, endDate } = resolvePlanShoppingWindow(plan, options?.days);
  const requestKey = `shop_${plan.id.slice(0, 8)}_r${plan.revision}_${startDate}_${endDate}`.replace(
    /[^A-Za-z0-9_-]/g,
    '_',
  );
  const res = await shoppingApi.sharePlanShopping(
    {
      planId: plan.id,
      expectedRevision: plan.revision,
      startDate,
      endDate,
    },
    requestKey,
  );
  await queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList() });
  return res;
}

function addIsoDays(baseIso: string, delta: number): string {
  const dt = new Date(`${baseIso}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/**
 * Builds a clean `shopping_allowed` regeneration intent from an existing plan so 1-tap
 * auto-suggestion recovery works on stale/past-date plans, manual empty drafts, or
 * overly strict `cook_now` plans without triggering `422 INVALID_PLANNING_HORIZON`.
 */
export function buildRecoveryIntentForPlan(
  plan: MealPlanDto,
  hasLockedComponents = false,
  now = new Date(),
): MealPlanningIntent {
  const todayIso = localDate(now);
  const tomorrowIso = addIsoDays(todayIso, 1);
  const uniqueDates = [...new Set(plan.intent.slots.map((s) => s.date))].sort();
  const hasElapsedDates = uniqueDates.some((d) => d <= todayIso);

  if (!hasElapsedDates || hasLockedComponents) {
    return {
      ...plan.intent,
      mode: 'shopping_allowed',
      slots: plan.intent.slots.map((slot) => {
        const { hardMaxTimeMinutes, ...rest } = slot;
        return {
          ...rest,
          ...(hardMaxTimeMinutes && !rest.preferredTimeMinutes
            ? { preferredTimeMinutes: hardMaxTimeMinutes }
            : {}),
        };
      }),
    };
  }

  // Shift stale calendar dates forward starting from tomorrow while preserving structure
  const dateMap = new Map<string, string>();
  uniqueDates.forEach((oldDate, idx) => {
    dateMap.set(oldDate, addIsoDays(tomorrowIso, idx));
  });

  const nextSlots = plan.intent.slots.map((slot) => {
    const { hardMaxTimeMinutes, time: _oldTime, ...rest } = slot;
    return {
      ...rest,
      date: dateMap.get(slot.date) ?? tomorrowIso,
      ...(hardMaxTimeMinutes && !rest.preferredTimeMinutes
        ? { preferredTimeMinutes: hardMaxTimeMinutes }
        : {}),
    };
  });

  return {
    ...plan.intent,
    startDate: tomorrowIso,
    horizonDays: Math.min(14, Math.max(1, uniqueDates.length)),
    utcOffsetMinutes: -now.getTimezoneOffset(),
    mode: 'shopping_allowed',
    slots: nextSlots.slice(0, 42),
  };
}
