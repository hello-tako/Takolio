import type { MealPlan, MealSlotItem } from '../../../packages/domain/src';
import type { RecipeAuthoritySnapshot } from '../../../packages/recipes/src/recipe-authority';
import { WeekReadRepository, type WeekPlanRow } from '../../../packages/db/src/week-read-repository';

export interface WeekReadCache {
  put(key: string, value: string, options: { expirationTtl: number }): Promise<unknown>;
}

export class WeekDatabaseError extends Error {
  readonly code = 'DATABASE_UNAVAILABLE';
  constructor(message = 'Week database unavailable') {
    super(message);
    this.name = 'WeekDatabaseError';
  }
}


const WEEK_DAY_NAMES_VI = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const WEEK_DAY_TYPES = new Set(['cooking', 'eat_out', 'away', 'leftover', 'flexible']);


type StoredMealPlanSnapshot = {
  version: 1;
  plan: MealPlan;
};

export function serializeMealPlanSnapshot(plan: MealPlan): string {
  const snapshot: StoredMealPlanSnapshot = { version: 1, plan };
  return JSON.stringify(snapshot);
}

export function parseMealPlanSnapshot(raw: unknown, planRow: Pick<WeekPlanRow, 'id' | 'household_id'>): MealPlan | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredMealPlanSnapshot>;
    const plan = parsed?.version === 1 ? parsed.plan : undefined;
    if (
      !plan ||
      typeof plan !== 'object' ||
      plan.id !== planRow.id ||
      plan.householdId !== planRow.household_id ||
      !Array.isArray(plan.days) ||
      !Array.isArray(plan.shoppingItems)
    ) {
      return null;
    }
    return plan as MealPlan;
  } catch {
    return null;
  }
}

function parseJsonRecord(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function normalizeWeekDayOfWeek(value: unknown, date: string): number {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 7) return numeric;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    const names: Record<string, number> = {
      sunday: 7,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      'chủ nhật': 7,
      'chu nhat': 7,
      'thứ 2': 1,
      'thu 2': 1,
      'thứ 3': 2,
      'thu 3': 2,
      'thứ 4': 3,
      'thu 4': 3,
      'thứ 5': 4,
      'thu 5': 4,
      'thứ 6': 5,
      'thu 6': 5,
      'thứ 7': 6,
      'thu 7': 6,
    };
    if (names[normalized]) return names[normalized];
  }

  const parsedDate = new Date(`${date}T00:00:00Z`);
  const jsDay = parsedDate.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function normalizeWeekDayType(value: unknown): MealPlan['days'][number]['dayType'] {
  return typeof value === 'string' && WEEK_DAY_TYPES.has(value)
    ? (value as MealPlan['days'][number]['dayType'])
    : 'cooking';
}

function deriveBudgetStatus(target: number | null, min: number, max: number): MealPlan['budget']['status'] {
  if (target === null || !Number.isFinite(target)) return 'UNDER';
  if (min > target) return 'OVER';
  if (max <= target) return 'UNDER';
  return 'NEAR';
}

export async function readWeekPlan(
  repository: WeekReadRepository,
  planId: string,
  householdId: string,
  authority: () => Promise<RecipeAuthoritySnapshot>,
  cache?: WeekReadCache,
): Promise<MealPlan | null> {
  try {
    // D1 is authoritative. KV is populated only after a successful write and
    // is never allowed to resurrect a deleted or partially persisted plan.
    const planRow = await repository.findPlan(planId, householdId);

    if (!planRow) return null;

    // New writes persist the exact domain response. Returning this snapshot
    // avoids recalculating inventory-dependent fields after the stock changes.
    const storedPlan = parseMealPlanSnapshot(planRow.snapshot_json, planRow);
    if (storedPlan) {
      if (cache) {
        await cache.put(`plan_${planId}`, JSON.stringify(storedPlan), { expirationTtl: 604800 }).catch(() => {});
      }
      return storedPlan;
    }

    const daysRes = await repository.findDays(planId);

    const slotsRes = await repository.findSlots(planId);

    const shoppingRes = await repository.findShopping(planId);

    // Legacy relational rows (pre-snapshot) need the live catalog for slots without an embedded recipe.
    const needsCatalog = (slotsRes.results || []).some((s) => !parseJsonRecord(s.snapshot_json)?.recipe);
    const catalog = needsCatalog ? await authority() : null;
    const days = (daysRes.results || []).map((d) => {
      const dayOfWeek = normalizeWeekDayOfWeek(d.day_of_week, d.date);
      const dayType = normalizeWeekDayType(d.day_type);
      const slots = (slotsRes.results || [])
        .filter((s) => s.day_id === d.id)
        .map((s) => {
          const storedSlot = parseJsonRecord(s.snapshot_json);
          const recipe = (storedSlot?.recipe as MealSlotItem['recipe']) || catalog?.findByIdOrSlug(String(s.recipe_id ?? '')) || undefined;
          const availability = Number(storedSlot?.availabilityPercent);
          const incrementalCost = Number(storedSlot?.incrementalCostVnd);
          const slotIngredients = Array.isArray(storedSlot?.ingredients) ? storedSlot.ingredients as MealSlotItem['ingredients'] : [];
          const badges = Array.isArray(storedSlot?.badges) ? storedSlot.badges : [];
          const rescued = Array.isArray(storedSlot?.rescuedExpiringIngredients)
            ? storedSlot.rescuedExpiringIngredients
            : [];

          return {
            id: typeof storedSlot?.id === 'string' ? storedSlot.id : s.id,
            dayId: typeof storedSlot?.dayId === 'string' ? storedSlot.dayId : d.id,
            planId: typeof storedSlot?.planId === 'string' ? storedSlot.planId : planRow.id,
            slotType: storedSlot?.slotType || s.slot_type,
            status: storedSlot?.status || s.status,
            date: typeof storedSlot?.date === 'string' ? storedSlot.date : d.date,
            dayOfWeek: normalizeWeekDayOfWeek(storedSlot?.dayOfWeek, d.date) || dayOfWeek,
            servings: Number.isFinite(Number(storedSlot?.servings)) ? Number(storedSlot?.servings) : Number(s.servings || 2),
            notes: typeof storedSlot?.notes === 'string' ? storedSlot.notes : s.notes || undefined,
            recipe,
            source: storedSlot?.source === 'USER' ? 'USER' : 'AUTO',
            isLocked: storedSlot?.isLocked === true,
            leftoverSourceSlotId:
              typeof storedSlot?.leftoverSourceSlotId === 'string' ? storedSlot.leftoverSourceSlotId : undefined,
            isLeftover: storedSlot?.isLeftover === true,
            availabilityPercent: Number.isFinite(availability) ? Math.min(100, Math.max(0, availability)) : 0,
            incrementalCostVnd: Number.isFinite(incrementalCost) ? Math.max(0, incrementalCost) : 0,
            rescuedExpiringIngredients: rescued.filter((value: unknown): value is string => typeof value === 'string'),
            badges: badges.filter((value: unknown): value is string => typeof value === 'string'),
            ingredients: slotIngredients,
          } as MealSlotItem;
        });

        return {
        id: d.id,
        planId: planRow.id,
        date: d.date,
        dayOfWeek,
        dayNameVi: WEEK_DAY_NAMES_VI[dayOfWeek === 7 ? 0 : dayOfWeek] || `Thứ ${dayOfWeek}`,
        dayType,
        slots,
      };
    });

    const shoppingItems = (shoppingRes.results || []).map((it) => {
      const storedItem = parseJsonRecord(it.snapshot_json);
      const quantity = Number(it.quantity);
      const fallbackQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
      const numberOrFallback = (value: unknown, fallback: number): number => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
      };

      return {
        id: typeof storedItem?.id === 'string' ? storedItem.id : it.id,
        ingredientId:
          typeof storedItem?.ingredientId === 'string' ? storedItem.ingredientId : it.ingredient_id || '',
        name: typeof storedItem?.name === 'string' ? storedItem.name : it.name,
        missingQuantity: numberOrFallback(storedItem?.missingQuantity, fallbackQuantity),
        requiredQuantity: numberOrFallback(storedItem?.requiredQuantity, fallbackQuantity),
        existingInventoryQuantity: numberOrFallback(storedItem?.existingInventoryQuantity, 0),
        recommendedPurchaseQuantity: numberOrFallback(storedItem?.recommendedPurchaseQuantity, fallbackQuantity),
        unit: (storedItem?.unit as MealPlan['shoppingItems'][number]['unit']) || it.unit,
        estimatedPriceMin: numberOrFallback(storedItem?.estimatedPriceMin, 0),
        estimatedPriceMax: numberOrFallback(storedItem?.estimatedPriceMax, 0),
        checked: typeof storedItem?.checked === 'boolean' ? storedItem.checked : Boolean(it.checked),
        cannotBuy: typeof storedItem?.cannotBuy === 'boolean' ? storedItem.cannotBuy : Boolean(it.cannot_buy),
        category: (storedItem?.category as MealPlan['shoppingItems'][number]['category']) || 'other',
        sourceRecipes: Array.isArray(storedItem?.sourceRecipes) ? storedItem.sourceRecipes as MealPlan['shoppingItems'][number]['sourceRecipes'] : [],
      };
    });

    const targetVnd = planRow.budget_target === null || planRow.budget_target === undefined
      ? null
      : Number(planRow.budget_target);
    const estimatedMinVnd = Number.isFinite(Number(planRow.budget_min)) ? Number(planRow.budget_min) : 0;
    const estimatedMaxVnd = Number.isFinite(Number(planRow.budget_max)) ? Number(planRow.budget_max) : estimatedMinVnd;
    const wasteRiskLevel = String(planRow.waste_risk || 'LOW').toUpperCase();
    const wasteRisk = wasteRiskLevel === 'HIGH' ? 'HIGH' : wasteRiskLevel === 'MEDIUM' ? 'MEDIUM' : 'LOW';

    const plan: MealPlan = {
      id: planRow.id,
      householdId: planRow.household_id,
      startDate: planRow.start_date,
      endDate: planRow.end_date,
      status: planRow.status,
      shoppingFrequency: planRow.shopping_frequency,
      priorities: ['use_fridge'],
      budget: {
        targetVnd: Number.isFinite(targetVnd) ? targetVnd : null,
        estimatedMinVnd,
        estimatedMaxVnd,
        status: deriveBudgetStatus(Number.isFinite(targetVnd) ? targetVnd : null, estimatedMinVnd, estimatedMaxVnd),
        displayText: `~${estimatedMinVnd.toLocaleString('vi-VN')} - ${estimatedMaxVnd.toLocaleString('vi-VN')}đ`,
      },
      utilization: {
        utilizationPercent: Number.isFinite(Number(planRow.fridge_utilization)) ? Number(planRow.fridge_utilization) : 0,
        plannedItemsCount: 0,
        totalUsableItemsCount: 0,
        highPriorityUsedCount: 0,
      },
      wasteRisk: {
        level: wasteRisk,
        expiringItemsCount: 0,
        rescuedItemsCount: 0,
        displayText: wasteRisk === 'HIGH' ? 'Nguy cơ cao' : wasteRisk === 'MEDIUM' ? 'Nguy cơ trung bình' : 'Nguy cơ thấp',
      },
      days,
      shoppingItems,
      createdAt: planRow.created_at || new Date().toISOString(),
      updatedAt: planRow.updated_at || new Date().toISOString(),
      aiExplanation: typeof planRow.ai_explanation === 'string' ? planRow.ai_explanation : undefined,
    };

    // Populate KV cache for future non-authoritative reads after D1 succeeds.
    if (cache) {
      await cache.put(`plan_${planId}`, JSON.stringify(plan), { expirationTtl: 604800 }).catch(() => {});
    }

    return plan;
  } catch {
    console.error(JSON.stringify({ event: 'week_plan_read_failed' }));
    throw new WeekDatabaseError('Failed reading relational meal plan');
  }
}
