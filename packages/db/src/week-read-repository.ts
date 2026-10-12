import type { MealPlan, MealSlotItem } from '../../domain/src';
import type { D1DatabaseBinding } from './index';

export interface WeekPlanRow {
  id: string; household_id: string; snapshot_json: unknown;
  start_date: string; end_date: string; status: MealPlan['status'];
  shopping_frequency: MealPlan['shoppingFrequency'];
  budget_target: unknown; budget_min: unknown; budget_max: unknown;
  fridge_utilization: unknown; waste_risk: unknown; ai_explanation: unknown;
  created_at: string | null; updated_at: string | null;
}
interface WeekDayRow { id: string; date: string; day_of_week: unknown; day_type: unknown }
interface WeekSlotRow {
  id: string; day_id: string; recipe_id: string | null; slot_type: MealSlotItem['slotType'];
  status: MealSlotItem['status']; servings: unknown; notes: string | null; snapshot_json: unknown;
}
interface WeekShoppingRow {
  id: string; ingredient_id: string | null; name: string; quantity: unknown;
  unit: MealPlan['shoppingItems'][number]['unit']; checked: unknown; cannot_buy: unknown; snapshot_json: unknown;
}

/** Keeps the legacy Week SQL/query shape independent of the HTTP adapter. */
export class WeekReadRepository {
  constructor(private readonly db: D1DatabaseBinding) {}
  findCurrentId(householdId: string) {
    return this.db.prepare('SELECT id FROM meal_plans WHERE household_id = ? AND status != ? ORDER BY created_at DESC LIMIT 1')
      .bind(householdId, 'ARCHIVED').first<{ id: string }>();
  }
  findPlan(planId: string, householdId: string) {
    return this.db.prepare('SELECT * FROM meal_plans WHERE id = ? AND household_id = ?')
      .bind(planId, householdId).first<WeekPlanRow>();
  }
  findDays(planId: string) {
    return this.db.prepare('SELECT * FROM meal_plan_days WHERE plan_id = ? ORDER BY date ASC')
      .bind(planId).all<WeekDayRow>();
  }
  findSlots(planId: string) {
    return this.db.prepare('SELECT * FROM meal_plan_slots WHERE plan_id = ?')
      .bind(planId).all<WeekSlotRow>();
  }
  findShopping(planId: string) {
    return this.db.prepare('SELECT * FROM meal_plan_shopping_items WHERE plan_id = ?')
      .bind(planId).all<WeekShoppingRow>();
  }
}
