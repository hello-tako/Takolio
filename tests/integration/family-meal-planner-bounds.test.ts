import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadMealPlanningSnapshot } from '../../packages/db/src/meal-planning-snapshot';
import { FamilyPreferencesSchema } from '../../packages/domain/src/family-preferences-api';
import { planFamilyMeals, FAMILY_SEARCH_LIMITS } from '../../packages/recipes/src/composition/family-planner';
import { createPlanningContext } from '../../packages/recipes/src/planner-context';
import { resolveRecipeAuthority, resetRecipeAuthorityCacheForTests } from '../../src/worker/services/recipe-authority';
import { roleIndexFor } from '../../src/worker/services/meal-composition';
import { readRoleAssignments } from '../../packages/db/src/meal-composition';
import { T20Harness, quietLogs } from '../helpers/t20-composition-harness';

let h: T20Harness;
beforeEach(async () => { h = new T20Harness(); await h.seedHousehold('family-bounds'); resetRecipeAuthorityCacheForTests(); quietLogs(); });
afterEach(() => { h.close(); vi.restoreAllMocks(); });
describe('family search at supported input bounds', () => {
  it.each([7, 14, 42])('%i slots use one D1 authority and remain within the evaluation cap', async (count) => {
    const scope = { householdId: 'family-bounds', userId: h.users['family-bounds'] };
    const authority = (await resolveRecipeAuthority(h.env(), { tenantKey: scope.householdId })).snapshot;
    const now = '2030-01-01T00:00:00Z';
    const snapshot = await loadMealPlanningSnapshot(h.db, scope, now, authority);
    const context = createPlanningContext(() => ({ snapshotId: 'bounds-' + count, referenceInstant: now, catalog: snapshot.catalog,
      inventory: snapshot.inventory, rankingContext: snapshot.rankingContext, evidenceProvider: snapshot.evidenceProvider }));
    const roles = roleIndexFor(authority, await readRoleAssignments(h.db, snapshot.visibleRecipeIds));
    const types = ['breakfast', 'lunch', 'dinner'] as const;
    const slots = Array.from({ length: count }, (_, index) => ({ date: new Date(Date.parse('2030-01-02')
      + (count === 42 ? Math.floor(index / 3) : index) * 86400000).toISOString().slice(0, 10),
      mealType: count === 42 ? types[index % 3] : 'dinner' as const }));
    const started = performance.now();
    const result = planFamilyMeals({ context, request: { startDate: '2030-01-02', horizonDays: count === 7 ? 7 : 14,
      defaultServings: 2, mode: 'shopping_allowed', slots }, preferences: FamilyPreferencesSchema.parse({}), roles,
      runtimeRecipes: authority.list(), revision: 1 });
    expect(result.meals).toHaveLength(count); expect(result.evaluations).toBeLessThanOrEqual(FAMILY_SEARCH_LIMITS.evaluations);
    expect(result.internationalGeneratedMainCount).toBe(0);
    expect(result.poolBuilds).toBeLessThanOrEqual(FAMILY_SEARCH_LIMITS.poolBuilds);
    expect(result.finalInventory.every((row) => row.quantity >= 0)).toBe(true);
    const summary = { count, milliseconds: Math.round(performance.now() - started), evaluations: result.evaluations, poolBuilds: result.poolBuilds,
      complete: result.meals.filter((meal) => !meal.missingRoles.length).length, searchLimited: result.searchLimited };
    process.stdout.write('FAMILY_BOUNDS ' + JSON.stringify(summary) + '\n');
  }, 30000);
});
