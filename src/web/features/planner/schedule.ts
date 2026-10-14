import type { MealPlanDto } from '../../../../packages/domain/src/meal-planning-api';
import type { FamilyMealPlanDto } from '../../../../packages/domain/src/family-meal-planning-api';
import { slotInstant } from '../../../../packages/recipes/src/planner-context';

export const plannerDefaultTimes = {
  breakfast: '08:00',
  lunch: '12:00',
  dinner: '18:00',
} as const;

type PlannerSlot = MealPlanDto['intent']['slots'][number];

export function plannerSlotId(slot: PlannerSlot): string {
  return `${slot.date}:${slot.mealType}:${slot.sequence ?? 0}`;
}

export function plannerSlot(plan: MealPlanDto, slotId: string): PlannerSlot | undefined {
  return plan.intent.slots.find((slot) => plannerSlotId(slot) === slotId);
}

/** Resolve the same local meal time used by generation, including legacy result times. */
export function plannerSlotTime(plan: MealPlanDto, slotId: string): string | undefined {
  const slot = plannerSlot(plan, slotId);
  if (!slot) return undefined;
  return (
    slot.time ??
    plan.result.meals.find((meal) => meal.slotId === slotId)?.time ??
    plannerDefaultTimes[slot.mealType]
  );
}

export function plannerSlotInstant(plan: MealPlanDto, slotId: string): string | undefined {
  const slot = plannerSlot(plan, slotId);
  const time = plannerSlotTime(plan, slotId);
  const offset = plan.result.planningReference.utcOffsetMinutes;
  if (
    !slot ||
    !time ||
    !/^\d{4}-\d{2}-\d{2}$/.test(slot.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
    !Number.isInteger(offset) ||
    offset < -840 ||
    offset > 840
  )
    return undefined;
  try {
    if (new Date(`${slot.date}T00:00:00Z`).toISOString().slice(0, 10) !== slot.date)
      return undefined;
    return slotInstant(slot.date, time, plan.result.planningReference);
  } catch {
    return undefined;
  }
}

export function plannerNow(plan: MealPlanDto): number {
  const deviceNow = Date.now();
  const checkedAt = Date.parse(plan.freshness.checkedAt);
  return Number.isFinite(checkedAt) ? Math.max(deviceNow, checkedAt) : deviceNow;
}

/** Shopping dates follow the saved meal calendar, even on a device in another time zone. */
export function plannerLocalDate(plan: MealPlanDto, now = plannerNow(plan)): string | undefined {
  const offset = plan.result.planningReference.utcOffsetMinutes;
  if (!Number.isFinite(now) || !Number.isInteger(offset) || offset < -840 || offset > 840)
    return undefined;
  try {
    const isoDate = new Date(now + offset * 60_000).toISOString();
    return /^\d{4}-\d{2}-\d{2}T/.test(isoDate) ? isoDate.slice(0, 10) : undefined;
  } catch {
    return undefined;
  }
}

/** Missing or malformed schedule data fails closed so a meal cannot be edited accidentally. */
export function isPlannerSlotElapsed(
  plan: MealPlanDto,
  slotId: string,
  now = plannerNow(plan),
): boolean {
  const instant = plannerSlotInstant(plan, slotId);
  const parsed = instant === undefined ? Number.NaN : Date.parse(instant);
  return !Number.isFinite(parsed) || !Number.isFinite(now) || parsed < now;
}

export function hasFuturePlannerSlot(plan: MealPlanDto, now = plannerNow(plan)): boolean {
  return plan.intent.slots.some((slot) => !isPlannerSlotElapsed(plan, plannerSlotId(slot), now));
}

export function isTimeOnlyPlanningStale(plan: MealPlanDto): boolean {
  return (
    plan.freshness.reasons.length > 0 &&
    plan.freshness.reasons.every((reason) => reason === 'planning_time_elapsed')
  );
}

/** Sharing reprojects future demand; price optimization keeps its stricter freshness contract. */
export function canSharePlannerShopping(
  plan: MealPlanDto,
  familyPlan?: FamilyMealPlanDto,
  now = plannerNow(plan),
): boolean {
  if (!hasFuturePlannerSlot(plan, now)) return false;
  const sameFamily = familyPlan?.plan.id === plan.id;
  const currentFamily = sameFamily && familyPlan.plan.revision === plan.revision;
  if (sameFamily && !currentFamily) return false;
  if (currentFamily && familyPlan.familyPreferenceFreshness !== 'fresh') return false;
  if (plan.freshness.status === 'fresh') return true;
  if (!currentFamily) return isTimeOnlyPlanningStale(plan);
  return (
    plan.freshness.reasons.length > 0 &&
    plan.freshness.reasons.every((reason) =>
      ['planning_time_elapsed', 'stale_inventory', 'stale_history'].includes(reason),
    )
  );
}
