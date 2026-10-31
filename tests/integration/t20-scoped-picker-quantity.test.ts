import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MealPlanDtoSchema } from '../../packages/domain/src/meal-planning-api';
import { MealComponentDtoSchema, PickerPageDtoSchema, SlotCompositionDtoSchema } from '../../packages/domain/src/meal-composition-api';
import { FamilyMealPlanDtoSchema } from '../../packages/domain/src/family-meal-planning-api';
import { createPlanningContext } from '../../packages/recipes/src/planner-context';
import { MealPlanningApplicationService } from '../../src/worker/services/meal-planning';
import { resetRoleIndexMemoForTests } from '../../src/worker/services/meal-composition';
import { fetchWorker } from '../helpers/worker-fetch.mjs';
import { quietLogs, T20Harness, T20_INTENT, T20_ORIGIN } from '../helpers/t20-composition-harness';

vi.mock('../../src/worker/services/email', () => ({ sendEmail: vi.fn(), buildOtpEmail: vi.fn() }));
// Each functional case replays the D1 catalog and exercises several Worker requests.
const CASE_TIMEOUT = 30_000;
const HOUSE = 'picker-quantity'; const OTHER = 'picker-other';
const DISHES = ['imp-26a36c69306143bc', 'vn-kho-01', 'vn-kho-02'];
const path = (planId: string, slotId: string) => `/meal-planning/plans/${planId}/slots/${encodeURIComponent(slotId)}`;
let h: T20Harness;
beforeEach(async () => {
  h = new T20Harness(); await h.seedHousehold(HOUSE); await h.seedHousehold(OTHER); quietLogs(); resetRoleIndexMemoForTests();
});
afterEach(() => { h.close(); vi.restoreAllMocks(); vi.useRealTimers(); });
async function generate(overrides: Record<string, unknown> = {}) {
  const result = await h.call(HOUSE, 'POST', '/meal-planning/plans', { ...T20_INTENT, slots: T20_INTENT.slots.slice(0, 1), ...overrides });
  expect(result.status, JSON.stringify(result.json)).toBe(200); return MealPlanDtoSchema.parse(result.json);
}
function exactProteinRequirements(quantity = 300, unit: 'g' | 'kg' = 'g', optional = false) {
  h.db.execute('UPDATE inventory_items SET quantity=500, version=version+1 WHERE household_id=? AND ingredient_id=?', [HOUSE, 'PORK_BELLY']);
  vi.spyOn(MealPlanningApplicationService.prototype, 'planningContext').mockImplementation((snapshot, referenceInstant, rankingContext) =>
    createPlanningContext(() => ({ snapshotId: 'quantity-fixture', referenceInstant, inventory: snapshot.inventory,
      catalog: { ...snapshot.catalog, recipes: snapshot.catalog.recipes.map((recipe) => DISHES.includes(recipe.id)
        ? { ...recipe, servings: 2, ingredients: [{ ingredientId: 'PORK_BELLY', name: 'Pork', requiredQuantity: quantity, unit, isOptional: optional }] }
        : recipe) }, rankingContext: rankingContext ?? snapshot.rankingContext, evidenceProvider: snapshot.evidenceProvider })));
}
async function replace(planId: string, slotId: string, revision: number, ids: string[]) {
  const response = await h.call(HOUSE, 'PUT', `${path(planId, slotId)}/composition`, { revision,
    components: ids.map((id) => ({ target: { kind: 'recipe', recipeId: id }, role: 'main', locked: true })) });
  expect(response.status, JSON.stringify(response.json)).toBe(200); return SlotCompositionDtoSchema.parse(response.json);
}
async function picker(planId: string, slotId: string, revision: number, fields: Record<string, string> = {}, house = HOUSE) {
  return h.call(house, 'GET', `/meal-planning/compositions/picker?${new URLSearchParams({ planId, slotId, revision: String(revision), ...fields })}`);
}
function parsedPage(response: Awaited<ReturnType<typeof picker>>) {
  expect(response.status, JSON.stringify(response.json)).toBe(200); return PickerPageDtoSchema.parse(response.json);
}

describe('scoped dish picker quantity and mutation agreement', { timeout: CASE_TIMEOUT }, () => {
  it('subtracts kept dishes, exposes exact required/covered/missing amounts, and noBuy filters the full meal', async () => {
    const plan = await generate(); const slotId = plan.result.meals[0].slotId; exactProteinRequirements();
    const current = await replace(plan.id, slotId, plan.revision, [DISHES[0]]);
    const page = parsedPage(await picker(plan.id, slotId, current.planRevision, { q: DISHES[1] }));
    expect(page.scope).toMatchObject({ planId: plan.id, slotId, servings: 2, mode: 'shopping_allowed', excludeComponentId: null });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].assessment).toMatchObject({ selectable: true, status: 'needs_shopping', missingCount: 1,
      requirements: [{ ingredientId: 'PORK_BELLY', name: 'Pork', unit: 'g', requiredQuantity: 300, coveredQuantity: 200, missingQuantity: 100 }] });
    expect(parsedPage(await picker(plan.id, slotId, current.planRevision, { q: DISHES[1], noBuy: 'true' })).items).toEqual([]);
    const added = await h.call(HOUSE, 'POST', `${path(plan.id, slotId)}/components`,
      { revision: current.planRevision, target: { kind: 'recipe', recipeId: DISHES[1] }, role: 'main' });
    expect(added.status, JSON.stringify(added.json)).toBe(200);
    expect(h.db.query('SELECT quantity FROM inventory_items WHERE ingredient_id=? AND household_id=?', 'PORK_BELLY', HOUSE)).toEqual([{ quantity: 500 }]);
  });

  it('a swap frees only its own demand and retains the replaced ordinal and companion demand', async () => {
    const plan = await generate(); const slotId = plan.result.meals[0].slotId; exactProteinRequirements();
    const current = await replace(plan.id, slotId, plan.revision, [DISHES[0], DISHES[1]]);
    const secondId = current.composition.components[1].id;
    const second = parsedPage(await picker(plan.id, slotId, current.planRevision, { q: DISHES[2], excludeComponentId: secondId }));
    expect(second.items[0].assessment?.requirements[0]).toMatchObject({ requiredQuantity: 300, coveredQuantity: 200, missingQuantity: 100 });
    const first = parsedPage(await picker(plan.id, slotId, current.planRevision,
      { q: DISHES[2], excludeComponentId: current.composition.components[0].id }));
    expect(first.items[0].assessment?.status).toBe('covered');
    expect(parsedPage(await picker(plan.id, slotId, current.planRevision,
      { q: DISHES[2], excludeComponentId: current.composition.components[0].id, noBuy: 'true' })).items).toEqual([]);
    const swapped = await h.call(HOUSE, 'POST', `${path(plan.id, slotId)}/components/${secondId}/swap`,
      { revision: current.planRevision, target: { kind: 'recipe', recipeId: DISHES[2] } });
    expect(swapped.status, JSON.stringify(swapped.json)).toBe(200);
    expect(swapped.json.composition.components.map((component: { recipeId: string }) => component.recipeId)).toEqual([DISHES[0], DISHES[2]]);
  });

  it('reserves earlier meals and scales requested servings with exact unit conversion', async () => {
    const plan = await generate({ defaultServings: 4, slots: T20_INTENT.slots.slice(0, 2) }); exactProteinRequirements(0.15, 'kg');
    const firstId = plan.result.meals[0].slotId; const secondId = plan.result.meals[1].slotId;
    let current = await replace(plan.id, firstId, 1, [DISHES[0]]);
    current = await replace(plan.id, secondId, current.planRevision, []);
    const page = parsedPage(await picker(plan.id, secondId, current.planRevision, { q: DISHES[1] }));
    expect(page.scope?.servings).toBe(4);
    expect(page.items[0].assessment?.requirements[0]).toMatchObject({ unit: 'kg', requiredQuantity: 0.3, coveredQuantity: 0.2, missingQuantity: 0.1 });
  });

  it('reserves same-time meals by numeric sequence consistently in picker and component quantities', async () => {
    const date = T20_INTENT.startDate;
    const plan = await generate({ slots: [
      { date, mealType: 'lunch', sequence: 10, time: '12:00' },
      { date, mealType: 'lunch', sequence: 2, time: '12:00' },
    ] });
    exactProteinRequirements();
    const earlier = `${date}:lunch:2`; const later = `${date}:lunch:10`;
    let current = await replace(plan.id, earlier, plan.revision, [DISHES[0]]);
    current = await replace(plan.id, later, current.planRevision, [DISHES[1]]);
    const response = await h.call(HOUSE, 'GET', `/meal-planning/plans/${plan.id}/compositions?includeAssessment=true`);
    expect(response.status, JSON.stringify(response.json)).toBe(200);
    expect(response.json.compositions.map((slot: { slotId: string }) => slot.slotId)).toEqual([earlier, later]);
    expect(response.json.compositions.map((slot: { components: Array<{ assessment: { requirements: unknown[] } }> }) =>
      slot.components[0].assessment.requirements[0])).toMatchObject([
      { requiredQuantity: 300, coveredQuantity: 300, missingQuantity: 0 },
      { requiredQuantity: 300, coveredQuantity: 200, missingQuantity: 100 },
    ]);
    const first = parsedPage(await picker(plan.id, earlier, current.planRevision,
      { q: DISHES[2], excludeComponentId: response.json.compositions[0].components[0].id }));
    expect(first.items[0].assessment?.requirements[0]).toMatchObject({ coveredQuantity: 300, missingQuantity: 0 });
    const second = parsedPage(await picker(plan.id, later, current.planRevision,
      { q: DISHES[2], excludeComponentId: response.json.compositions[1].components[0].id }));
    expect(second.items[0].assessment?.requirements[0]).toMatchObject({ coveredQuantity: 200, missingQuantity: 100 });
    expect(h.db.query('SELECT quantity FROM inventory_items WHERE ingredient_id=? AND household_id=?', 'PORK_BELLY', HOUSE))
      .toEqual([{ quantity: 500 }]);
  });

  it('a covered earlier same-time choice cannot take stock reserved by its numeric-sequence successor in cook_now', async () => {
    exactProteinRequirements();
    const date = T20_INTENT.startDate;
    const plan = await generate({ mode: 'cook_now', slots: [
      { date, mealType: 'lunch', sequence: 10, time: '12:00' },
      { date, mealType: 'lunch', sequence: 2, time: '12:00' },
    ] });
    const earlier = `${date}:lunch:2`; const later = `${date}:lunch:10`;
    let current = await replace(plan.id, earlier, plan.revision, []);
    current = await replace(plan.id, later, current.planRevision, [DISHES[1]]);
    const offered = parsedPage(await picker(plan.id, earlier, current.planRevision, { q: DISHES[0] }));
    expect(offered.items[0].assessment).toMatchObject({ status: 'covered', selectable: false,
      blockingReasons: ['INVENTORY_NEEDS_SHOPPING'], requirements: [{ coveredQuantity: 300, missingQuantity: 0 }] });
    const attempted = await h.call(HOUSE, 'POST', `${path(plan.id, earlier)}/components`, {
      revision: current.planRevision, target: { kind: 'recipe', recipeId: DISHES[0] }, role: 'main',
    });
    expect(attempted.status, JSON.stringify(attempted.json)).toBe(422);
    expect(attempted.json.code).toBe('INSUFFICIENT_INVENTORY');
    expect(h.db.query('SELECT revision FROM generated_meal_plans WHERE id=?', plan.id)).toEqual([{ revision: current.planRevision }]);
    expect(h.db.query('SELECT quantity FROM inventory_items WHERE ingredient_id=? AND household_id=?', 'PORK_BELLY', HOUSE))
      .toEqual([{ quantity: 500 }]);
  });

  it('rejects a cook_now swap with shortages and agrees with the disabled scoped candidate', async () => {
    const plan = await generate({ mode: 'cook_now' }); const slotId = plan.result.meals[0].slotId;
    const current = SlotCompositionDtoSchema.parse((await h.call(HOUSE, 'GET', `${path(plan.id, slotId)}/composition`)).json);
    const page = parsedPage(await picker(plan.id, slotId, plan.revision,
      { q: 'vn-bun-03', excludeComponentId: current.composition.components[0].id }));
    expect(page.items).toHaveLength(1); expect(page.items[0].assessment?.selectable).toBe(false);
    expect(page.items[0].assessment?.blockingReasons.some((reason) => reason.startsWith('INVENTORY_'))).toBe(true);
    const swapped = await h.call(HOUSE, 'POST', `${path(plan.id, slotId)}/components/${current.composition.components[0].id}/swap`,
      { revision: plan.revision, target: { kind: 'recipe', recipeId: 'vn-bun-03' } });
    expect(swapped.status, JSON.stringify(swapped.json)).toBe(422); expect(swapped.json.code).toBe('INSUFFICIENT_INVENTORY');
    expect(MealPlanDtoSchema.parse((await h.call(HOUSE, 'GET', `/meal-planning/plans/${plan.id}`)).json).revision).toBe(1);
  });

  it('marks a duplicate dish disabled instead of crashing and permits a swap to itself', async () => {
    const plan = await generate(); const slotId = plan.result.meals[0].slotId; exactProteinRequirements();
    const current = await replace(plan.id, slotId, 1, [DISHES[0]]);
    const duplicate = parsedPage(await picker(plan.id, slotId, current.planRevision, { q: DISHES[0] }));
    expect(duplicate.items[0].assessment).toMatchObject({ selectable: false, blockingReasons: ['DUPLICATE_COMPONENT'] });
    const self = parsedPage(await picker(plan.id, slotId, current.planRevision,
      { q: DISHES[0], excludeComponentId: current.composition.components[0].id }));
    expect(self.items[0].assessment).toMatchObject({ selectable: true, status: 'covered' });
  });

  it('excludes untracked and unresolved demands from noBuy without fabricating quantities', async () => {
    const plan = await generate(); const slotId = plan.result.meals[0].slotId;
    const current = await replace(plan.id, slotId, 1, []);
    h.db.execute('UPDATE inventory_items SET unit=?, quantity=?, version=version+1 WHERE ingredient_id=? AND household_id=?', ['piece', 10, 'RICE', HOUSE]);
    const rice = parsedPage(await picker(plan.id, slotId, current.planRevision, { q: 'sf-steamed-rice' }));
    expect(rice.items[0].assessment?.requirements[0]).toMatchObject({ requiredQuantity: 160, missingQuantity: null, status: 'unresolved' });
    expect(parsedPage(await picker(plan.id, slotId, current.planRevision, { kind: 'simple_food', noBuy: 'true' })).items
      .every((item) => item.assessment?.status === 'covered' && item.assessment.selectable)).toBe(true);
  });

  it('optional shortages stay visible and do not exclude a fully covered required meal', async () => {
    const plan = await generate(); const slotId = plan.result.meals[0].slotId; exactProteinRequirements(600, 'g', true);
    const current = await replace(plan.id, slotId, 1, []);
    const page = parsedPage(await picker(plan.id, slotId, current.planRevision, { q: DISHES[0], noBuy: 'true' }));
    expect(page.items[0].assessment).toMatchObject({ selectable: true, status: 'covered', missingCount: 0,
      requirements: [{ isOptional: true, requiredQuantity: 600, coveredQuantity: 500, missingQuantity: 100 }] });
  });
});

describe('scoped picker authority, compatibility and pagination witnesses', { timeout: CASE_TIMEOUT }, () => {
  it('rejects malformed scope, foreign plans, stale revisions and a foreign excluded component', async () => {
    const plan = await generate(); const slotId = plan.result.meals[0].slotId;
    expect((await h.call(HOUSE, 'GET', '/meal-planning/compositions/picker?noBuy=true')).status).toBe(422);
    expect((await h.call(HOUSE, 'GET', `/meal-planning/compositions/picker?planId=${plan.id}`)).status).toBe(422);
    expect((await picker(plan.id, slotId, 1, {}, OTHER)).status).toBe(404);
    expect((await picker(plan.id, slotId, 2)).json.code).toBe('PLAN_REVISION_CONFLICT');
    expect((await picker(plan.id, slotId, 1, { excludeComponentId: 'foreign-dish' })).json.code).toBe('COMPONENT_NOT_FOUND');
  });

  it('rejects a requested revision that only becomes current after the first plan read', async () => {
    const plan = await generate(); const slotId = plan.result.meals[0].slotId;
    const before = h.db.query('SELECT id, recipe_id, simple_food_id FROM generated_meal_plan_components WHERE plan_id=?', plan.id);
    let changed = false;
    h.db.hooks.afterStatement = ({ method, sql }) => {
      if (changed || method !== 'all' || !sql.includes('SELECT plan.*') || !sql.includes('FROM generated_meal_plans plan')) return;
      changed = true;
      h.db.execute('UPDATE generated_meal_plans SET revision=revision+1 WHERE id=?', [plan.id]);
    };
    const attempted = await h.call(HOUSE, 'POST', `${path(plan.id, slotId)}/components`, {
      revision: plan.revision + 1, target: { kind: 'simple_food', simpleFoodId: 'sf-steamed-rice' }, role: 'staple',
    });
    h.db.hooks.afterStatement = undefined;
    expect(changed).toBe(true);
    expect(attempted.status, JSON.stringify(attempted.json)).toBe(409);
    expect(attempted.json.code).toBe('PLAN_REVISION_CONFLICT');
    expect(h.db.query('SELECT revision FROM generated_meal_plans WHERE id=?', plan.id)).toEqual([{ revision: plan.revision + 1 }]);
    expect(h.db.query('SELECT id, recipe_id, simple_food_id FROM generated_meal_plan_components WHERE plan_id=?', plan.id)).toEqual(before);
  });

  it('binds subsequent pages to inventory and filter snapshots', async () => {
    const plan = await generate(); const slotId = plan.result.meals[0].slotId;
    const first = parsedPage(await picker(plan.id, slotId, 1, { limit: '1' })); expect(first.nextCursor).not.toBeNull();
    const next = parsedPage(await picker(plan.id, slotId, 1, { limit: '1', cursor: first.nextCursor!, snapshot: first.scope!.snapshotId }));
    expect(next.scope?.snapshotId).toBe(first.scope?.snapshotId);
    h.db.execute('UPDATE inventory_items SET quantity=quantity-1, version=version+1 WHERE household_id=? AND ingredient_id=?', [HOUSE, 'RICE']);
    const stale = await picker(plan.id, slotId, 1, { limit: '1', cursor: first.nextCursor!, snapshot: first.scope!.snapshotId });
    expect(stale.status).toBe(409); expect(stale.json.code).toBe('PICKER_SNAPSHOT_CHANGED');
  });

  it('rejects inventory changes during assessment and fences a raced cook_now write', async () => {
    const plan = await generate({ mode: 'cook_now' }); const slotId = plan.result.meals[0].slotId;
    let changed = false;
    h.db.hooks.afterBatch = (results) => {
      const capturedInventory = results.some((result) => result.results.some((row) => row && typeof row === 'object'
        && 'ingredient_id' in row && 'quantity' in row && 'household_id' in row && row.household_id === HOUSE));
      if (!changed && capturedInventory) {
        changed = true;
        h.db.execute('UPDATE inventory_items SET quantity=quantity-1,version=version+1 WHERE household_id=? AND ingredient_id=?', [HOUSE, 'RICE']);
      }
    };
    const stale = await picker(plan.id, slotId, 1, { q: 'sf-steamed-rice' });
    expect(changed).toBe(true); expect(stale.status).toBe(409); expect(stale.json.code).toBe('PICKER_SNAPSHOT_CHANGED');
    h.db.hooks.afterBatch = undefined;
    h.db.hooks.beforeBatch = (statements) => {
      if (statements.some((statement) => statement.sql.includes('UPDATE generated_meal_plans'))) {
        h.db.execute('UPDATE inventory_items SET quantity=0,version=version+1 WHERE household_id=? AND ingredient_id=?', [HOUSE, 'RICE']);
      }
    };
    const add = await h.call(HOUSE, 'POST', `${path(plan.id, slotId)}/components`,
      { revision: 1, target: { kind: 'simple_food', simpleFoodId: 'sf-steamed-rice' }, role: 'staple' });
    expect(add.status, JSON.stringify(add.json)).toBe(409); expect(add.json.code).toBe('PLAN_REVALIDATION_REQUIRED');
    h.db.hooks.beforeBatch = undefined;
    expect(MealPlanDtoSchema.parse((await h.call(HOUSE, 'GET', `/meal-planning/plans/${plan.id}`)).json).revision).toBe(1);
  });

  it('ranks covered scoped dishes before alphabetically earlier shortages, across pagination', async () => {
    const plan = await generate(); const slotId = plan.result.meals[0].slotId;
    const current = await replace(plan.id, slotId, 1, []);
    const first = parsedPage(await picker(plan.id, slotId, current.planRevision, { kind: 'simple_food', limit: '1' }));
    expect(first.items).toHaveLength(1); expect(first.items[0].assessment?.status).toBe('covered');
    expect(first.nextCursor).not.toBeNull();
    const second = parsedPage(await picker(plan.id, slotId, current.planRevision,
      { kind: 'simple_food', limit: '1', cursor: first.nextCursor!, snapshot: first.scope!.snapshotId }));
    expect(second.items[0].assessment?.status).toBe('covered');
    const all = parsedPage(await picker(plan.id, slotId, current.planRevision, { kind: 'simple_food', limit: '24' }));
    const covered = all.items.findIndex((item) => item.assessment?.status === 'covered');
    const unknown = all.items.findIndex((item) => item.assessment?.status === 'not_tracked');
    expect(covered).toBeLessThan(unknown);
  });

  it.each([0, 1])('keeps corrective removal %i possible when another companion is already unsafe', async (removedIndex) => {
    const plan = await generate(); const slotId = plan.result.meals[0].slotId; exactProteinRequirements();
    const current = await replace(plan.id, slotId, 1, [DISHES[0], DISHES[1]]);
    h.db.seed(`INSERT INTO household_ranking_preferences (household_id,values_json,updated_at)
      VALUES ('${HOUSE}','{"version":1,"values":{"forbiddenIngredientIds":["PORK_BELLY"]}}','2029-01-01T00:00:00.000Z')`);
    const removed = await h.call(HOUSE, 'DELETE', `${path(plan.id, slotId)}/components/${current.composition.components[removedIndex].id}?revision=${current.planRevision}`);
    expect(removed.status, JSON.stringify(removed.json)).toBe(200);
    expect(removed.json.composition.components).toHaveLength(1);
    expect(removed.json.composition.components[0].recipeId).toBe(DISHES[1 - removedIndex]);
  });

  it('preserves the exact unscoped picker and ordinary V1 component response shapes', async () => {
    const plan = await generate(); const unscoped = parsedPage(await h.call(HOUSE, 'GET', '/meal-planning/compositions/picker?limit=1'));
    expect(Object.keys(unscoped)).toEqual(['schemaVersion', 'items', 'nextCursor', 'total']);
    expect(Object.keys(unscoped.items[0])).toEqual(['kind', 'id', 'title', 'roles', 'cuisine', 'cookTimeMinutes', 'difficulty', 'constraintState']);
    const ordinary = SlotCompositionDtoSchema.parse((await h.call(HOUSE, 'GET', `${path(plan.id, plan.result.meals[0].slotId)}/composition`)).json);
    expect(ordinary.composition.components[0]).not.toHaveProperty('assessment');
  });

  it('exposes exact family component quantities and rejects the full-meal hard time conflict', async () => {
    const response = await fetchWorker(new Request(`${T20_ORIGIN}/api/v2/meal-planning/plans`, { method: 'POST',
      headers: { Cookie: h.cookies[HOUSE], Origin: T20_ORIGIN, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ ...T20_INTENT, slots: T20_INTENT.slots.slice(0, 1) }) }), h.env());
    const body = await response.json(); expect(response.status, JSON.stringify(body)).toBe(200);
    const created = FamilyMealPlanDtoSchema.parse(body); const slot = created.compositions.compositions[0];
    const legacyComponent = MealComponentDtoSchema.omit({ assessment: true }).strict();
    expect(slot.components.every((component) => legacyComponent.safeParse(component).success)).toBe(true);
    expect(slot.components.every((component) => component.assessment === undefined)).toBe(true);
    const assessed = SlotCompositionDtoSchema.parse((await h.call(HOUSE, 'GET', `${path(created.plan.id, slot.slotId)}/composition?includeAssessment=true`)).json);
    expect(assessed.composition.components.every((component) => component.assessment !== undefined)).toBe(true);
    const rice = assessed.composition.components.find((component) => component.simpleFoodId === 'sf-steamed-rice')!;
    expect(rice.assessment?.requirements[0]).toMatchObject({ requiredQuantity: 160, coveredQuantity: 160, missingQuantity: 0 });
    h.db.seed(`INSERT INTO household_ranking_preferences (household_id,values_json,updated_at)
      VALUES ('${HOUSE}','{"version":1,"values":{"hardMaxTimeMinutes":30}}','2029-01-01T00:00:00.000Z')`);
    const page = parsedPage(await picker(created.plan.id, slot.slotId, created.plan.revision, { q: 'sf-boiled-egg', role: 'side' }));
    expect(page.items[0].assessment?.selectable).toBe(false);
    expect(page.items[0].assessment?.blockingReasons.some((reason) => reason.startsWith('MEAL_TIME_'))).toBe(true);
    const add = await h.call(HOUSE, 'POST', `${path(created.plan.id, slot.slotId)}/components`,
      { revision: 1, target: { kind: 'simple_food', simpleFoodId: 'sf-boiled-egg' }, role: 'side' });
    expect(add.status).toBe(422); expect(add.json.code).toBe('HARD_CONSTRAINT_CONFLICT');
  }, 30000);
});

describe('remaining-week projection after scheduled meals elapse', { timeout: CASE_TIMEOUT }, () => {
  const date = T20_INTENT.startDate;
  const slots = [
    { date, mealType: 'lunch', time: '12:00', sequence: 0 },
    { date, mealType: 'dinner', time: '18:00', sequence: 0 },
  ];
  async function composed(family = false, customSlots = slots) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-01-02T02:00:00Z'));
    exactProteinRequirements();
    const intent = { ...T20_INTENT, utcOffsetMinutes: 420, slots: customSlots };
    let plan;
    if (family) {
      const response = await fetchWorker(new Request(`${T20_ORIGIN}/api/v2/meal-planning/plans`, { method: 'POST',
        headers: { Cookie: h.cookies[HOUSE], Origin: T20_ORIGIN, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(intent) }), h.env());
      const json = await response.json(); expect(response.status, JSON.stringify(json)).toBe(200);
      plan = FamilyMealPlanDtoSchema.parse(json).plan;
    } else plan = await generate(intent);
    const first = `${date}:${customSlots[0].mealType}:${customSlots[0].sequence}`;
    const future = `${date}:${customSlots[1].mealType}:${customSlots[1].sequence}`;
    let current = await replace(plan.id, first, plan.revision, [DISHES[0]]);
    current = await replace(plan.id, future, current.planRevision, [DISHES[1], DISHES[2]]);
    return { plan, revision: current.planRevision, first, future, composition: current.composition };
  }
  function afterLunch() { vi.setSystemTime(new Date('2030-01-02T06:00:00Z')); }
  async function share(planId: string, revision: number) {
    return h.call(HOUSE, 'POST', '/shopping-list/from-plan', {
      planId, expectedRevision: revision, startDate: date, endDate: date,
    });
  }

  it('releases elapsed same-day stock for the future picker and shares only remaining demand', async () => {
    const fixture = await composed(); afterLunch();
    const picked = parsedPage(await picker(fixture.plan.id, fixture.future, fixture.revision,
      { q: DISHES[0], excludeComponentId: fixture.composition.components[0].id }));
    expect(picked.items[0].assessment?.requirements[0]).toMatchObject({ requiredQuantity: 300, coveredQuantity: 300, missingQuantity: 0 });
    const assessed = await h.call(HOUSE, 'GET', `/meal-planning/plans/${fixture.plan.id}/compositions?includeAssessment=true`);
    expect(assessed.status, JSON.stringify(assessed.json)).toBe(200);
    expect(assessed.json.compositions[0].components[0].projection).toBeNull();
    expect(assessed.json.compositions[0].components[0]).not.toHaveProperty('assessment');
    const result = await share(fixture.plan.id, fixture.revision);
    expect(result.status, JSON.stringify(result.json)).toBe(200);
    const demand = h.db.query<{ quantity: number; contributions_json: string }>(
      'SELECT quantity, contributions_json FROM shopping_plan_demands WHERE ingredient_id=?', 'PORK_BELLY');
    expect(demand).toHaveLength(1); expect(demand[0].quantity).toBe(100);
    expect(JSON.parse(demand[0].contributions_json)).toEqual([
      expect.objectContaining({ slotId: fixture.future, quantity: 100 }),
    ]);
    expect((await h.call(HOUSE, 'POST', `/meal-planning/plans/${fixture.plan.id}/shopping`,
      { revision: fixture.revision, currency: 'VND' })).status).toBe(409);
    expect(h.db.query('SELECT quantity FROM inventory_items WHERE household_id=? AND ingredient_id=?', HOUSE, 'PORK_BELLY'))
      .toEqual([{ quantity: 500 }]);
  });

  it('recalculates a family remainder once against actual stock after cooking and keeps stored freshness truthful', async () => {
    const fixture = await composed(true); afterLunch();
    h.db.execute('UPDATE inventory_items SET quantity=200,version=version+1 WHERE household_id=? AND ingredient_id=?', [HOUSE, 'PORK_BELLY']);
    const feedback = await h.call(HOUSE, 'POST', `/meal-planning/plans/${fixture.plan.id}/feedback`,
      { revision: fixture.revision, slotId: fixture.first, type: 'liked' });
    expect(feedback.status, JSON.stringify(feedback.json)).toBe(200);
    const before = MealPlanDtoSchema.parse((await h.call(HOUSE, 'GET', `/meal-planning/plans/${fixture.plan.id}`)).json);
    expect(before.freshness).toMatchObject({ status: 'requires_revalidation',
      reasons: expect.arrayContaining(['planning_time_elapsed', 'stale_inventory', 'stale_history']) });
    const shared = await share(fixture.plan.id, fixture.revision);
    expect(shared.status, JSON.stringify(shared.json)).toBe(200);
    const demand = h.db.query<{ quantity: number; contributions_json: string }>(
      'SELECT quantity, contributions_json FROM shopping_plan_demands WHERE ingredient_id=?', 'PORK_BELLY');
    expect(demand[0].quantity).toBe(400);
    const contributions = JSON.parse(demand[0].contributions_json) as Array<{ slotId: string; quantity: number }>;
    expect(contributions.map(row => row.slotId)).toEqual([fixture.future, fixture.future]);
    expect(contributions.reduce((sum, row) => sum + row.quantity, 0)).toBe(400);
    const after = MealPlanDtoSchema.parse((await h.call(HOUSE, 'GET', `/meal-planning/plans/${fixture.plan.id}`)).json);
    expect(after.freshness).toEqual(before.freshness); expect(after.revision).toBe(fixture.revision);
    expect(h.db.query('SELECT quantity FROM inventory_items WHERE household_id=? AND ingredient_id=?', HOUSE, 'PORK_BELLY'))
      .toEqual([{ quantity: 200 }]);
  }, 30000);

  it('still rejects stale inventory for a non-family plan after lunch elapses', async () => {
    const fixture = await composed(); afterLunch();
    h.db.execute('UPDATE inventory_items SET quantity=200,version=version+1 WHERE household_id=? AND ingredient_id=?', [HOUSE, 'PORK_BELLY']);
    const result = await share(fixture.plan.id, fixture.revision);
    expect(result.status, JSON.stringify(result.json)).toBe(409); expect(result.json.code).toBe('PLAN_REVALIDATION_REQUIRED');
    expect(h.db.query('SELECT source_id FROM shopping_plan_demands')).toEqual([]);
  });

  it.each(['profile', 'hard_preferences', 'catalog'] as const)('does not bypass a stale family %s during weekly continuation', async change => {
    const fixture = await composed(true); afterLunch();
    h.db.execute('UPDATE inventory_items SET quantity=200,version=version+1 WHERE household_id=? AND ingredient_id=?', [HOUSE, 'PORK_BELLY']);
    if (change === 'profile') {
      const changed = await h.call(HOUSE, 'PUT', '/family-preferences', {
        expectedRevision: 0, preferences: { preferredRegions: ['nam'] },
      });
      expect(changed.status, JSON.stringify(changed.json)).toBe(200);
    } else if (change === 'hard_preferences') {
      await h.db.prepare(`INSERT INTO member_ranking_preferences(household_id,user_id,values_json,updated_at) VALUES(?,?,?,?)
        ON CONFLICT(household_id,user_id) DO UPDATE SET values_json=excluded.values_json,updated_at=excluded.updated_at`)
        .bind(HOUSE, h.users[HOUSE], JSON.stringify({ version: 1, values: { forbiddenIngredientIds: ['PORK_BELLY'] } }), '2030-01-02T06:00:00.000Z').run();
    } else h.db.execute('UPDATE recipes SET title=title || ? WHERE id=?', [' changed', DISHES[1]]);
    const result = await share(fixture.plan.id, fixture.revision);
    expect(result.status, JSON.stringify(result.json)).toBe(409); expect(result.json.code).toBe('PLAN_REVALIDATION_REQUIRED');
    expect(h.db.query('SELECT source_id FROM shopping_plan_demands')).toEqual([]);
  }, 30000);

  it('aborts family shopping when actual inventory changes again before the atomic batch', async () => {
    const fixture = await composed(true); afterLunch();
    h.db.execute('UPDATE inventory_items SET quantity=200,version=version+1 WHERE household_id=? AND ingredient_id=?', [HOUSE, 'PORK_BELLY']);
    let raced = false;
    h.db.hooks.beforeBatch = statements => {
      if (raced || !statements.some(statement => statement.sql.includes('INSERT INTO shopping_plan_commands'))) return;
      raced = true;
      h.db.execute('UPDATE inventory_items SET quantity=199,version=version+1 WHERE household_id=? AND ingredient_id=?', [HOUSE, 'PORK_BELLY']);
    };
    const result = await share(fixture.plan.id, fixture.revision);
    h.db.hooks.beforeBatch = undefined;
    expect(raced).toBe(true); expect(result.status, JSON.stringify(result.json)).toBe(409);
    expect(result.json.code).toBe('SHOPPING_SNAPSHOT_CHANGED');
    expect(h.db.query('SELECT source_id FROM shopping_plan_demands')).toEqual([]);
    expect(h.db.query('SELECT request_key FROM shopping_plan_commands')).toEqual([]);
  }, 30000);

  it('keeps picker pages stable within a time boundary and invalidates them when an earlier meal releases stock', async () => {
    const fixture = await composed();
    vi.setSystemTime(new Date('2030-01-02T04:59:00Z'));
    const fields = { kind: 'simple_food', limit: '1' };
    const first = parsedPage(await picker(fixture.plan.id, fixture.future, fixture.revision, fields));
    expect(first.nextCursor).not.toBeNull();
    vi.setSystemTime(new Date('2030-01-02T04:59:30Z'));
    const continued = parsedPage(await picker(fixture.plan.id, fixture.future, fixture.revision,
      { ...fields, cursor: first.nextCursor!, snapshot: first.scope!.snapshotId }));
    expect(continued.scope!.snapshotId).toBe(first.scope!.snapshotId);
    afterLunch();
    const expired = await picker(fixture.plan.id, fixture.future, fixture.revision,
      { ...fields, cursor: first.nextCursor!, snapshot: first.scope!.snapshotId });
    expect(expired.status).toBe(409); expect(expired.json.code).toBe('PICKER_SNAPSHOT_CHANGED');
    const refreshed = parsedPage(await picker(fixture.plan.id, fixture.future, fixture.revision, fields));
    expect(refreshed.scope!.snapshotId).not.toBe(first.scope!.snapshotId);
  });

  it('rejects an assessment that crosses a same-day elapsed boundary between its snapshot reads', async () => {
    const fixture = await composed();
    vi.setSystemTime(new Date('2030-01-02T04:59:59Z'));
    const now = vi.spyOn(MealPlanningApplicationService.prototype, 'nowIso')
      .mockReturnValueOnce('2030-01-02T04:59:59.000Z').mockReturnValue('2030-01-02T05:00:01.000Z');
    const result = await h.call(HOUSE, 'GET', `/meal-planning/plans/${fixture.plan.id}/compositions?includeAssessment=true`);
    now.mockRestore();
    expect(result.status, JSON.stringify(result.json)).toBe(409); expect(result.json.code).toBe('PICKER_SNAPSHOT_CHANGED');
  });

  it('assists the correct custom-time sequence after the earlier same-type slot elapsed', async () => {
    const fixture = await composed(true, [
      { date, mealType: 'lunch', time: '12:00', sequence: 0 },
      { date, mealType: 'lunch', time: '18:00', sequence: 1 },
    ]);
    const empty = await replace(fixture.plan.id, fixture.future, fixture.revision, []);
    afterLunch();
    const result = await h.call(HOUSE, 'POST', `${path(fixture.plan.id, fixture.future)}/assist`,
      { revision: empty.planRevision, action: 'complete' });
    expect(result.status, JSON.stringify(result.json)).toBe(200);
    expect(result.json.proposal).not.toBeNull(); expect(result.json.slotId).toBe(fixture.future);
  }, 30000);
});

it('reuses the trusted catalog across slot policies while retaining picker time restrictions', async () => {
  const plan = await generate({ slots: [{ ...T20_INTENT.slots[0], preferredTimeMinutes: 20, hardMaxTimeMinutes: 60 }] });
  const slotId = plan.intent.slots.map(slot => `${slot.date}:${slot.mealType}:${slot.sequence}`)[0];
  const current = await replace(plan.id, slotId, plan.revision, []);
  const contexts = vi.spyOn(MealPlanningApplicationService.prototype, 'planningContext');
  const started = performance.now();
  const page = parsedPage(await picker(plan.id, slotId, current.planRevision, { role: 'main' }));
  process.stdout.write(JSON.stringify({ pickerMs: Math.round(performance.now() - started), catalogPreparations: contexts.mock.calls.length }) + '\n');
  expect(page.total).toBeGreaterThan(20);
  expect(contexts).toHaveBeenCalledTimes(2);
  expect(page.items.every(item => item.assessment?.blockingReasons.includes('COOKING_TIME_UNKNOWN'))).toBe(true);
}, CASE_TIMEOUT);
