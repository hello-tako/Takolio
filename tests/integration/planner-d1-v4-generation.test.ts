import { describe, expect, it } from 'vitest';
import { SqliteD1 } from '../helpers/sqlite-d1';
import { MealPlanningApplicationService } from '../../src/worker/services/meal-planning';
import {
  resolveRecipeAuthority,
  resetRecipeAuthorityCacheForTests,
} from '../../src/worker/services/recipe-authority';
import { sharePlanShopping } from '../../src/worker/services/shopping-plan';
import type { MealPlanningIntent } from '../../packages/domain/src/meal-planning-api';

describe('Planner D1 V4 Catalog Authority & Auto-Suggestion Integration', () => {
  it('generates feasible V1 and V2 meal plans + picker + shopping sync under D1 V4 500-recipe authority', async () => {
    const db = new SqliteD1();
    const householdId = 'house-d1-v4-1';
    const userId = 'user-d1-v4-1';
    await db.prepare(`INSERT INTO users (id) VALUES (?)`).bind(userId).run();
    await db
      .prepare(`INSERT INTO households (id, name, created_by) VALUES (?, ?, ?)`)
      .bind(householdId, 'V4 D1 House', userId)
      .run();
    await db
      .prepare(`INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, 'owner')`)
      .bind(householdId, userId)
      .run();

    const now = new Date('2026-11-23T14:00:00Z');
    const dates = ['2026-11-24', '2026-11-25', '2026-11-26'];
    const intent: MealPlanningIntent = {
      startDate: '2026-11-24',
      horizonDays: 3,
      defaultServings: 4,
      utcOffsetMinutes: 540,
      mode: 'shopping_allowed',
      slots: dates.flatMap((date) => [
        { date, mealType: 'breakfast' as const, sequence: 0, preferredTimeMinutes: 45 },
        { date, mealType: 'lunch' as const, sequence: 0, preferredTimeMinutes: 45 },
        { date, mealType: 'dinner' as const, sequence: 0, preferredTimeMinutes: 45 },
      ]),
    };

    resetRecipeAuthorityCacheForTests();
    const res = await resolveRecipeAuthority(
      {
        DB: db,
        RECIPE_CATALOG_MODE: 'd1',
        RECIPE_CATALOG_CUTOVER_ENABLED: 'true',
        RECIPE_CATALOG_V4_STANDARD_ENABLED: 'true',
      } as any,
      { tenantKey: householdId },
    );

    expect(res.actualSource).toBe('d1');
    expect(res.snapshot.size).toBe(500);

    const svc = new MealPlanningApplicationService(db, {
      now: () => now,
      recipeAuthority: async () => res.snapshot,
      compositionV2Enabled: true,
    });

    // V1 must generate 9/9 feasible meals (was 0/9 before planner-catalog-authority fix)
    const v1Plan = await svc.generate({ householdId, userId }, intent, 'd1-v4-v1-test');
    expect(v1Plan.result.status).toBe('feasible');
    expect(v1Plan.result.meals).toHaveLength(9);
    expect(v1Plan.result.unplannedSlots).toHaveLength(0);

    // V2 Family planner must generate 9/9 feasible composed meals
    const v2Plan = await svc.generateFamily({ householdId, userId }, intent, 'd1-v4-v2-test');
    expect(v2Plan.plan.result.status).toBe('feasible');
    expect(v2Plan.compositions.compositions).toHaveLength(9);
    expect(v2Plan.compositions.compositions.every((c) => c.components.length > 0)).toBe(true);
    expect(v2Plan.plan.result.unplannedSlots).toHaveLength(0);

    // Picker must return V4 dishes for swapping/adding
    const firstSlot = v2Plan.compositions.compositions[1]!;
    const picker = await svc.compositions('vi').picker(
      { householdId, userId },
      {
        planId: v2Plan.plan.id,
        slotId: firstSlot.slotId,
        revision: String(v2Plan.plan.revision),
        role: 'main',
      },
    );
    expect(picker.items.length).toBeGreaterThan(0);

    // Shopping sync must succeed cleanly from the V4 D1 plan
    const shopSync = await sharePlanShopping(
      db,
      { householdId, userId, locale: 'vi' },
      {
        planId: v2Plan.plan.id,
        expectedRevision: v2Plan.plan.revision,
        startDate: '2026-11-24',
        endDate: '2026-11-26',
      },
      'd1_v4_shop_sync_1',
      () => svc.compositions('vi').shoppingDemand({ householdId, userId }, v2Plan.plan.id, v2Plan.plan.revision),
    );
    expect(shopSync.success).toBe(true);
    expect(shopSync.itemCount).toBeGreaterThan(0);
  }, 60_000);
});
