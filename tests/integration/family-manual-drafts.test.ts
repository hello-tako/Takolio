import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyMealPlanDtoSchema } from '../../packages/domain/src/family-meal-planning-api';
import { MealPlanDtoSchema } from '../../packages/domain/src/meal-planning-api';
import { fetchWorker } from '../helpers/worker-fetch.mjs';
import { AssistProposalDtoSchema, SlotCompositionDtoSchema } from '../../packages/domain/src/meal-composition-api';
import { quietLogs, T20Harness, T20_ORIGIN } from '../helpers/t20-composition-harness';

vi.mock('../../src/worker/services/email', () => ({ sendEmail: vi.fn(), buildOtpEmail: vi.fn() }));
const HOUSE = 'draft-house';
const OTHER = 'draft-other';
const intent = { startDate: '2030-01-02', horizonDays: 7, defaultServings: 4, mode: 'shopping_allowed',
  slots: [{ date: '2030-01-02', mealType: 'dinner' }, { date: '2030-01-03', mealType: 'lunch', servings: 2 }] };
let h: T20Harness;
beforeEach(async () => {
  h = new T20Harness(); h.mode = 'static';
  await h.seedHousehold(HOUSE); await h.seedHousehold(OTHER); quietLogs();
});
afterEach(() => { h.close(); vi.restoreAllMocks(); });
async function create(body: unknown = intent, key = crypto.randomUUID(), path = 'drafts', extra = {}) {
  const response = await fetchWorker(new Request(`${T20_ORIGIN}/api/v2/meal-planning/${path}`, {
    method: 'POST', headers: { Cookie: h.cookies[HOUSE], Origin: T20_ORIGIN,
      'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body),
  }), h.env(extra));
  return { status: response.status, json: await response.json() as Record<string, unknown> };
}

describe('manual family calendar creation', () => {
  it('starts with intentional empty slots, correct servings and zero search without changing stock', async () => {
    const stock = h.db.query('SELECT id, quantity, version FROM inventory_items ORDER BY id');
    const events = h.db.query('SELECT id FROM inventory_events ORDER BY id');
    const created = await create();
    expect(created.status, JSON.stringify(created.json)).toBe(200);
    const dto = FamilyMealPlanDtoSchema.parse(created.json);
    expect(dto.compositions.compositions.map(slot => [slot.mode, slot.servings, slot.components.length]))
      .toEqual([['manual', 4, 0], ['manual', 2, 0]]);
    expect(dto.compositions.compositions.every(slot => slot.missingRoles.join(',') === 'main,vegetable,soup,staple')).toBe(true);
    expect(dto.plan.result.meals).toEqual([]);
    expect(dto.plan.result.unplannedSlots.every(slot => slot.reasons.includes('MANUAL_SELECTION_PENDING'))).toBe(true);
    expect(dto.plan.result.search.truncated).toBe(false);
    expect(dto.diagnostics).toMatchObject({ completeMealCount: 0, partialMealCount: 0, unplannedMealCount: 2, searchLimited: false });
    const stored = JSON.parse(h.db.query<{ result_json: string }>('SELECT result_json FROM generated_meal_plans')[0].result_json);
    expect(stored.data.shoppingPlan.search).toMatchObject({ statesExplored: 0, generationCalls: 0, candidatesEvaluated: 0 });
    expect(h.db.query('SELECT id, quantity, version FROM inventory_items ORDER BY id')).toEqual(stock);
    expect(h.db.query('SELECT id FROM inventory_events ORDER BY id')).toEqual(events);
    const legacy = await h.call(HOUSE, 'GET', `/meal-planning/plans/${dto.plan.id}`);
    expect(legacy.status).toBe(200);
    expect(MealPlanDtoSchema.parse(legacy.json).intent.defaultServings).toBe(4);
    expect((await h.call(OTHER, 'GET', `/meal-planning/plans/${dto.plan.id}/compositions`)).status).toBe(404);
  });

  it('replays a draft and rejects reusing its key for automatic generation or different dates', async () => {
    const key = crypto.randomUUID();
    const [a, b] = await Promise.all([create(intent, key), create(intent, key)]);
    expect(a.status, JSON.stringify(a.json)).toBe(200);
    expect(b.status, JSON.stringify(b.json)).toBe(200);
    expect(FamilyMealPlanDtoSchema.parse(a.json).plan.id).toBe(FamilyMealPlanDtoSchema.parse(b.json).plan.id);
    expect((await create(intent, key, 'plans')).status).toBe(409);
    expect((await create({ ...intent, defaultServings: 2 }, key)).status).toBe(409);
    expect(h.db.query('SELECT id FROM generated_meal_plans')).toHaveLength(1);
    expect(h.db.query('SELECT mode FROM generated_meal_plan_compositions')).toEqual([{ mode: 'manual' }, { mode: 'manual' }]);
  });

  it('allows selecting a locked main first, then completing the remaining roles without replacing it', async () => {
    const created = FamilyMealPlanDtoSchema.parse((await create()).json);
    const slot = created.compositions.compositions[0];
    const selected = await h.call(HOUSE, 'POST', `/meal-planning/plans/${created.plan.id}/slots/${encodeURIComponent(slot.slotId)}/components`, {
      revision: 1, target: { kind: 'recipe', recipeId: 'vn-kho-01' }, role: 'main', locked: true,
    });
    expect(selected.status, JSON.stringify(selected.json)).toBe(200);
    const manualMain = selected.json.composition.components[0];
    expect(manualMain).toMatchObject({ recipeId: 'vn-kho-01', locked: true, provenance: 'manual' });
    const regenerated = await create({ revision: 2 }, crypto.randomUUID(), `plans/${created.plan.id}/regenerate`);
    expect(regenerated.status, JSON.stringify(regenerated.json)).toBe(200);
    const dto = FamilyMealPlanDtoSchema.parse(regenerated.json);
    expect(dto.compositions.compositions[0].components).toHaveLength(4);
    expect(dto.compositions.compositions[0].components.find(component => component.id === manualMain.id))
      .toMatchObject({ recipeId: 'vn-kho-01', locked: true, provenance: 'manual' });
  }, 30000);

  it('validates the calendar and feature flags even though no recipes are generated', async () => {
    expect((await create({ ...intent, slots: [intent.slots[0], intent.slots[0]] })).status).toBe(422);
    expect((await create({ ...intent, slots: [{ date: '2030-01-20', mealType: 'dinner' }] })).status).toBe(422);
    expect((await create(intent, crypto.randomUUID(), 'drafts', { MEAL_COMPOSITION_V2_ENABLED: 'false' })).status).toBe(404);
    expect((await create(intent, crypto.randomUUID(), 'drafts', { MEAL_PLANNER_ENABLED: 'false' })).status).toBe(404);
    expect(h.db.query('SELECT id FROM generated_meal_plans')).toEqual([]);
  });

  it('rolls all draft rows back when the inventory witness changes before commit', async () => {
    let armed = true;
    h.db.hooks.beforeBatch = (statements) => {
      if (armed && statements.some(statement => statement.sql.includes('INSERT INTO generated_meal_plans'))) {
        armed = false;
        h.db.execute('UPDATE inventory_items SET quantity = quantity + 1, version = version + 1 WHERE household_id = ?', [HOUSE]);
      }
    };
    const rejected = await create();
    expect(rejected.status, JSON.stringify(rejected.json)).toBe(409);
    expect(rejected.json.code).toBe('PLAN_REVALIDATION_REQUIRED');
    expect(h.db.query('SELECT id FROM generated_meal_plans')).toEqual([]);
    expect(h.db.query('SELECT plan_id FROM generated_meal_plan_compositions')).toEqual([]);
    expect(h.db.query('SELECT plan_id FROM generated_family_meal_plans')).toEqual([]);
  });
});

async function readFamily(planId: string) {
  const response = await fetchWorker(new Request(`${T20_ORIGIN}/api/v2/meal-planning/plans/${planId}`, {
    headers: { Cookie: h.cookies[HOUSE], Origin: T20_ORIGIN },
  }), h.env());
  const json = await response.json();
  expect(response.status, JSON.stringify(json)).toBe(200);
  return FamilyMealPlanDtoSchema.parse(json);
}

const slotPath = (planId: string, slotId: string) => `/meal-planning/plans/${planId}/slots/${encodeURIComponent(slotId)}`;

describe('manual one-dish meals within the family calendar', () => {
  it('keeps a selected noodle dinner complete through assist, regeneration and reload while another dinner fills four roles', async () => {
    const calendar = { ...intent, slots: intent.slots.map(slot => ({ ...slot, mealType: 'dinner' })) };
    const stockBefore = h.db.query('SELECT id, quantity, version FROM inventory_items ORDER BY id');
    const created = FamilyMealPlanDtoSchema.parse((await create(calendar)).json);
    const slot = created.compositions.compositions[0];
    const path = slotPath(created.plan.id, slot.slotId);
    const selected = await h.call(HOUSE, 'POST', `${path}/components`, {
      revision: 1, target: { kind: 'recipe', recipeId: 'vn-bun-01' }, role: 'main', locked: true,
    });
    expect(selected.status, JSON.stringify(selected.json)).toBe(200);
    const selection = SlotCompositionDtoSchema.parse(selected.json);
    const main = selection.composition.components[0];
    expect(selection.composition.missingRoles).toEqual([]);
    expect(selection.composition.warnings).toContain('MANUAL_ONE_DISH_MEAL');
    const beforeAssist = await readFamily(created.plan.id);
    expect(beforeAssist.diagnostics).toMatchObject({ completeMealCount: 1, partialMealCount: 0, unplannedMealCount: 1 });
    expect(beforeAssist.compositions.compositions[0].missingRoles).toEqual([]);
    expect(beforeAssist.policy.mealStyle).toBe('family');
    const demand = await h.call(HOUSE, 'POST', '/shopping-list/from-plan', {
      planId: created.plan.id, expectedRevision: 2, startDate: slot.date, endDate: slot.date,
    });
    expect(demand.status, JSON.stringify(demand.json)).toBe(200);
    const demands = h.db.query<{ ingredient_id: string; quantity: number; contributions_json: string }>(
      'SELECT ingredient_id, quantity, contributions_json FROM shopping_plan_demands');
    expect(demands.find(row => row.ingredient_id === 'NOODLE')?.quantity).toBe(500);
    const contributions = demands.flatMap(row => JSON.parse(row.contributions_json) as Array<{ componentId: string }>);
    expect(new Set(contributions.map(row => row.componentId))).toEqual(new Set([main.id]));
    const suggested = await h.call(HOUSE, 'POST', `${path}/assist`, { revision: 2, action: 'complete' });
    expect(suggested.status, JSON.stringify(suggested.json)).toBe(200);
    const proposal = AssistProposalDtoSchema.parse(suggested.json).proposal!;
    expect(proposal.components).toHaveLength(1);
    expect(proposal.components[0].existingComponentId).toBe(main.id);
    const accepted = await h.call(HOUSE, 'POST', `${path}/assist/apply`, {
      revision: 2, action: 'complete', proposalId: proposal.optionId,
    });
    expect(accepted.status, JSON.stringify(accepted.json)).toBe(200);
    expect(SlotCompositionDtoSchema.parse(accepted.json).composition.missingRoles).toEqual([]);
    expect((await readFamily(created.plan.id)).diagnostics.completeMealCount).toBe(1);
    const regenerated = await create({ revision: 3 }, crypto.randomUUID(), `plans/${created.plan.id}/regenerate`);
    expect(regenerated.status, JSON.stringify(regenerated.json)).toBe(200);
    const current = FamilyMealPlanDtoSchema.parse(regenerated.json);
    expect(current.compositions.compositions[0].components).toEqual([main]);
    expect(current.compositions.compositions[1].components.map(component => component.role)).toEqual(['main', 'vegetable', 'soup', 'staple']);
    expect(current.compositions.compositions.every(composition => composition.missingRoles.length === 0)).toBe(true);
    expect(current.diagnostics).toMatchObject({ completeMealCount: 2, partialMealCount: 0, unplannedMealCount: 0 });
    expect(current.policy.mealStyle).toBe('family');
    const reloaded = await readFamily(created.plan.id);
    expect(reloaded.compositions).toEqual(current.compositions);
    expect(reloaded.diagnostics.completeMealCount).toBe(2);
    const ordinary = await h.call(HOUSE, 'POST', `${path}/components/${encodeURIComponent(main.id)}/swap`, {
      revision: 4, target: { kind: 'recipe', recipeId: 'vn-kho-01' },
    });
    expect(ordinary.status, JSON.stringify(ordinary.json)).toBe(200);
    const changed = SlotCompositionDtoSchema.parse(ordinary.json).composition;
    expect(changed.missingRoles).toEqual(['vegetable', 'soup', 'staple']);
    expect(changed.warnings).not.toContain('MANUAL_ONE_DISH_MEAL');
    const afterSwap = await readFamily(created.plan.id);
    expect(afterSwap.diagnostics).toMatchObject({ completeMealCount: 1, partialMealCount: 1, unplannedMealCount: 0 });
    const fill = await h.call(HOUSE, 'POST', `${path}/assist`, { revision: 5, action: 'complete' });
    expect(fill.status, JSON.stringify(fill.json)).toBe(200);
    const fillProposal = AssistProposalDtoSchema.parse(fill.json).proposal!;
    expect(fillProposal.components.map(component => component.role)).toEqual(['main', 'vegetable', 'soup', 'staple']);
    const filled = await h.call(HOUSE, 'POST', `${path}/assist/apply`, { revision: 5, action: 'complete', proposalId: fillProposal.optionId });
    expect(filled.status, JSON.stringify(filled.json)).toBe(200);
    expect((await readFamily(created.plan.id)).diagnostics.completeMealCount).toBe(2);
    expect(h.db.query('SELECT id, quantity, version FROM inventory_items ORDER BY id')).toEqual(stockBefore);
  }, 30000);

  it.each(['restriction', 'time'] as const)('still marks a locked noodle meal partial after a hard %s change', async change => {
    const created = FamilyMealPlanDtoSchema.parse((await create({ ...intent, slots: intent.slots.slice(0, 1) })).json);
    const slot = created.compositions.compositions[0];
    const selected = await h.call(HOUSE, 'POST', `${slotPath(created.plan.id, slot.slotId)}/components`, {
      revision: 1, target: { kind: 'recipe', recipeId: 'vn-bun-01' }, role: 'main', locked: true,
    });
    expect(selected.status, JSON.stringify(selected.json)).toBe(200);
    const values = change === 'restriction' ? { forbiddenIngredientIds: ['BEEF_SIRLOIN'] } : { hardMaxTimeMinutes: 1 };
    await h.db.prepare('INSERT INTO member_ranking_preferences(household_id,user_id,values_json,updated_at) VALUES(?,?,?,?)')
      .bind(HOUSE, h.users[HOUSE], JSON.stringify({ version: 1, values }), '2030-01-01T00:00:00.000Z').run();
    const reloaded = await readFamily(created.plan.id);
    expect(reloaded.compositions.compositions[0].missingRoles).toEqual([]);
    expect(reloaded.compositions.compositions[0].warnings).toContain('MANUAL_ONE_DISH_MEAL');
    expect(reloaded.compositions.compositions[0].warnings).toContain(change === 'restriction'
      ? 'LOCKED_COMPONENT_REQUIRES_REVALIDATION' : 'MEAL_TIME_REQUIRES_REVALIDATION');
    expect(reloaded.diagnostics).toMatchObject({ completeMealCount: 0, partialMealCount: 1, unplannedMealCount: 0 });
    expect(reloaded.plan.freshness.status).toBe('requires_revalidation');
    if (change === 'restriction') expect(reloaded.familyPreferenceFreshness).toBe('requires_revalidation');
    const fresh = FamilyMealPlanDtoSchema.parse((await create({ ...intent, slots: intent.slots.slice(0, 1) })).json);
    const rejected = await h.call(HOUSE, 'POST', `${slotPath(fresh.plan.id, fresh.compositions.compositions[0].slotId)}/components`, {
      revision: 1, target: { kind: 'recipe', recipeId: 'vn-bun-01' }, role: 'main', locked: true,
    });
    expect(rejected.status, JSON.stringify(rejected.json)).toBe(422);
    expect(rejected.json.code).toBe('HARD_CONSTRAINT_CONFLICT');
    expect((await readFamily(fresh.plan.id)).compositions.compositions[0].components).toEqual([]);
  }, 30000);

  it('keeps a manually added companion through completion and regeneration, then restores required roles after main removal', async () => {
    const created = FamilyMealPlanDtoSchema.parse((await create({ ...intent, slots: intent.slots.slice(0, 1) })).json);
    const slot = created.compositions.compositions[0];
    const path = slotPath(created.plan.id, slot.slotId);
    const selected = await h.call(HOUSE, 'POST', `${path}/components`, {
      revision: 1, target: { kind: 'recipe', recipeId: 'vn-bun-01' }, role: 'main', locked: true,
    });
    expect(selected.status, JSON.stringify(selected.json)).toBe(200);
    const added = await h.call(HOUSE, 'POST', `${path}/components`, {
      revision: 2, target: { kind: 'simple_food', simpleFoodId: 'sf-steamed-broccoli' }, role: 'vegetable', locked: true,
    });
    expect(added.status, JSON.stringify(added.json)).toBe(200);
    const components = SlotCompositionDtoSchema.parse(added.json).composition.components;
    const assisted = await h.call(HOUSE, 'POST', `${path}/assist`, { revision: 3, action: 'complete' });
    expect(assisted.status, JSON.stringify(assisted.json)).toBe(200);
    const proposal = AssistProposalDtoSchema.parse(assisted.json).proposal!;
    expect(proposal.components.map(component => component.existingComponentId)).toEqual(components.map(component => component.id));
    const accepted = await h.call(HOUSE, 'POST', `${path}/assist/apply`, { revision: 3, action: 'complete', proposalId: proposal.optionId });
    expect(accepted.status, JSON.stringify(accepted.json)).toBe(200);
    const regenerated = await create({ revision: 4 }, crypto.randomUUID(), `plans/${created.plan.id}/regenerate`);
    expect(regenerated.status, JSON.stringify(regenerated.json)).toBe(200);
    const current = FamilyMealPlanDtoSchema.parse(regenerated.json);
    expect(current.compositions.compositions[0].components).toEqual(components);
    expect(current.compositions.compositions[0].missingRoles).toEqual([]);
    expect(current.diagnostics.completeMealCount).toBe(1);
    expect((await readFamily(created.plan.id)).compositions.compositions[0].components).toEqual(components);
    const removed = await h.call(HOUSE, 'DELETE', `${path}/components/${encodeURIComponent(components[0].id)}?revision=5`);
    expect(removed.status, JSON.stringify(removed.json)).toBe(200);
    const composition = SlotCompositionDtoSchema.parse(removed.json).composition;
    expect(composition.components).toEqual([{ ...components[1], ordinal: 0 }]);
    expect(composition.missingRoles).toEqual(['main', 'soup', 'staple']);
    expect(composition.warnings).not.toContain('MANUAL_ONE_DISH_MEAL');
    expect((await readFamily(created.plan.id)).diagnostics).toMatchObject({ completeMealCount: 0, partialMealCount: 1 });
  }, 30000);
});
