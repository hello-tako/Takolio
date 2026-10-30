import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MealPlanDtoSchema, PlannedMealDtoSchema, PlanResultDtoSchema } from '../../packages/domain/src/meal-planning-api';
import { SlotCompositionDtoSchema } from '../../packages/domain/src/meal-composition-api';
import { fingerprintRecipes } from '../../packages/recipes/src/catalog-fingerprint';
import { resolveRecipeAuthority } from '../../src/worker/services/recipe-authority';
import { captureRecipeContentVersion, grantRecipeContentAccess, readHouseholdRecipeContentVersion } from '../../src/worker/services/recipe-content-versions';
import { quietLogs, T20Harness, T20_INTENT } from '../helpers/t20-composition-harness';

vi.mock('../../src/worker/services/email', () => ({ sendEmail: vi.fn(), buildOtpEmail: vi.fn() }));
const house = 'saved-v1-house';
const other = 'saved-v1-other';
const capability = { Accept: 'application/json; recipe-content=1' };
const legacyPlan = MealPlanDtoSchema.extend({ result: PlanResultDtoSchema.extend({
  meals: PlannedMealDtoSchema.omit({ contentFingerprint: true }).strict().array(),
}) });
let h: T20Harness;
beforeEach(async () => {
  h = new T20Harness();
  await h.seedHousehold(house);
  await h.seedHousehold(other);
  quietLogs();
});
afterEach(() => { h.close(); vi.restoreAllMocks(); });
const call = (...args: Parameters<T20Harness['call']>) => {
  const [household, method, path, body, extra, headers] = args;
  return h.call(household, method, path, body, extra, { ...headers, ...capability });
};
async function generate() {
  const response = await call(house, 'POST', '/meal-planning/plans', T20_INTENT);
  expect(response.status, JSON.stringify(response.json)).toBe(200);
  const plan = MealPlanDtoSchema.parse(response.json);
  expect(plan.result.meals.length).toBeGreaterThan(0);
  return plan;
}
function stored(id: string) {
  return JSON.parse(h.db.query<{ result_json: string }>('SELECT result_json FROM generated_meal_plans WHERE id = ?', id)[0].result_json);
}
function save(id: string, result: ReturnType<typeof stored>) {
  h.db.execute('UPDATE generated_meal_plans SET result_json = ? WHERE id = ?', [JSON.stringify(result), id]);
}

it.each(['static', 'd1'] as const)('captures unscaled %s content, household access and exact projection', async (mode) => {
  h.mode = mode;
  const before = h.db.query('SELECT id, quantity, version FROM inventory_items ORDER BY id');
  const events = h.db.query('SELECT id FROM inventory_events ORDER BY id');
  const plan = await generate();
  const authority = (await resolveRecipeAuthority(h.env(), { tenantKey: house })).snapshot;
  for (const meal of plan.result.meals) {
    expect(meal.source.kind).toBe('recipe');
    const recipe = authority.findById(meal.source.id)!;
    expect(meal.contentFingerprint).toBe(await fingerprintRecipes([recipe]));
    expect(await readHouseholdRecipeContentVersion(h.db, house, meal.contentFingerprint!)).toEqual(recipe);
    expect(await readHouseholdRecipeContentVersion(h.db, other, meal.contentFingerprint!)).toBeNull();
    const response = await call(house, 'GET', `/meal-planning/plans/${plan.id}/slots/${encodeURIComponent(meal.slotId)}/composition`);
    const component = SlotCompositionDtoSchema.parse(response.json).composition.components[0];
    expect(component).toMatchObject({ recipeId: recipe.id, contentFingerprint: meal.contentFingerprint, title: recipe.title, cookable: true });
    const legacy = await h.call(house, 'GET', `/meal-planning/plans/${plan.id}/slots/${encodeURIComponent(meal.slotId)}/composition`);
    expect(legacy.status).toBe(200);
    expect(legacy.json.composition.components[0]).toMatchObject({ recipeId: recipe.id, cookable: false });
    expect(legacy.json.composition.components[0]).not.toHaveProperty('contentFingerprint');
  }
  expect(h.db.query('SELECT id, quantity, version FROM inventory_items ORDER BY id')).toEqual(before);
  expect(h.db.query('SELECT id FROM inventory_events ORDER BY id')).toEqual(events);
}, 30_000);

it('negotiates generate, replay, read, current, swap and regeneration for strict old clients', async () => {
  const headers = { 'Idempotency-Key': 'saved-v1-negotiation' };
  const created = await h.call(house, 'POST', '/meal-planning/plans', T20_INTENT, {}, headers);
  expect(created.status, JSON.stringify(created.json)).toBe(200);
  const plan = legacyPlan.parse(created.json);
  expect(plan.result.meals.length).toBeGreaterThan(0);
  const replay = await call(house, 'POST', '/meal-planning/plans', T20_INTENT, {}, headers);
  expect(replay.json.id).toBe(plan.id);
  expect(replay.json.result.meals.every((meal: { contentFingerprint: string }) => /^[a-f0-9]{64}$/.test(meal.contentFingerprint))).toBe(true);
  legacyPlan.parse((await h.call(house, 'POST', '/meal-planning/plans', T20_INTENT, {}, headers)).json);
  legacyPlan.parse((await h.call(house, 'GET', `/meal-planning/plans/${plan.id}`)).json);
  legacyPlan.parse((await h.call(house, 'GET', '/meal-planning/plans/current')).json.plan);
  const off = await call(house, 'GET', `/meal-planning/plans/${plan.id}`, undefined, { MEAL_COMPOSITION_V2_ENABLED: 'false' });
  expect(MealPlanDtoSchema.parse(off.json).result.meals[0].contentFingerprint).toBe(replay.json.result.meals[0].contentFingerprint);
  const meal = plan.result.meals[0];
  const swapped = await h.call(house, 'POST', `/meal-planning/plans/${plan.id}/swap`, {
    revision: 1, slotId: meal.slotId, replacement: { kind: 'recipe', id: meal.source.id },
  });
  expect(swapped.status, JSON.stringify(swapped.json)).toBe(200);
  legacyPlan.parse(swapped.json);
  const regenerated = await h.call(house, 'POST', `/meal-planning/plans/${plan.id}/regenerate`, { revision: 2 });
  expect(regenerated.status, JSON.stringify(regenerated.json)).toBe(200);
  legacyPlan.parse(regenerated.json);
}, 30_000);

it('preserves unknown legacy pins in unchanged swap selections and captures explicit reselection', async () => {
  const plan = await generate();
  const payload = stored(plan.id);
  for (const meal of payload.data.result.meals) delete meal.contentFingerprint;
  save(plan.id, payload);
  const first = plan.result.meals[0];
  const swapped = await call(house, 'POST', `/meal-planning/plans/${plan.id}/swap`, {
    revision: 1, slotId: first.slotId, replacement: { kind: 'recipe', id: first.source.id },
  });
  expect(swapped.status, JSON.stringify(swapped.json)).toBe(200);
  const next = MealPlanDtoSchema.parse(swapped.json);
  expect(next.result.meals.find(meal => meal.slotId === first.slotId)?.contentFingerprint).toBe(first.contentFingerprint);
  expect(next.result.meals.filter(meal => meal.slotId !== first.slotId).every(meal => meal.contentFingerprint === null)).toBe(true);
  const read = await call(house, 'GET', `/meal-planning/plans/${plan.id}`);
  expect(read.json.result.meals).toEqual(next.result.meals);
}, 30_000);

it('keeps legacy unversioned V1 selections cookable without inferring content history', async () => {
  const plan = await generate();
  const payload = stored(plan.id);
  for (const meal of payload.data.result.meals) delete meal.contentFingerprint;
  save(plan.id, payload);
  const path = `/meal-planning/plans/${plan.id}/slots/${encodeURIComponent(plan.result.meals[0].slotId)}/composition`;
  const modern = await call(house, 'GET', path);
  expect(modern.status, JSON.stringify(modern.json)).toBe(200);
  expect(SlotCompositionDtoSchema.parse(modern.json).composition.components[0]).toMatchObject({ contentFingerprint: null, cookable: true });
  const old = await h.call(house, 'GET', path);
  expect(old.status).toBe(200);
  expect(old.json.composition.components[0].cookable).toBe(true);
  expect(old.json.composition.components[0]).not.toHaveProperty('contentFingerprint');
  expect(stored(plan.id)).toEqual(payload);
}, 30_000);

it('displays archived V1 content, refuses current assessment and keeps the stored snapshot', async () => {
  const plan = await generate();
  const meal = plan.result.meals[0];
  const recipe = (await readHouseholdRecipeContentVersion(h.db, house, meal.contentFingerprint!))!;
  const historical = { ...recipe, title: 'Synthetic historical V1 title' };
  const pin = await captureRecipeContentVersion(h.db, historical);
  await grantRecipeContentAccess(h.db, house, pin);
  const payload = stored(plan.id);
  payload.data.result.meals[0].contentFingerprint = pin;
  payload.data.result.meals[0].title = historical.title;
  save(plan.id, payload);
  const path = `/meal-planning/plans/${plan.id}/slots/${encodeURIComponent(meal.slotId)}/composition?includeAssessment=true`;
  const response = await call(house, 'GET', path);
  expect(response.status, JSON.stringify(response.json)).toBe(200);
  const slot = SlotCompositionDtoSchema.parse(response.json);
  expect(slot.composition.components[0]).toMatchObject({ contentFingerprint: pin, title: historical.title, projection: null });
  expect(slot.composition.components[0]).not.toHaveProperty('assessment');
  expect(slot.composition.warnings).toContain('SAVED_CONTENT_REQUIRES_REVALIDATION');
  expect((await call(house, 'GET', `/meal-planning/plans/${plan.id}`)).json.result.meals[0]).toMatchObject({ title: historical.title, contentFingerprint: pin });
  expect((await call(other, 'GET', `/meal-planning/plans/${plan.id}`)).status).toBe(404);
  expect(stored(plan.id)).toEqual(payload);
}, 30_000);

it('retains pins when a concurrent revision rejects a standalone regeneration', async () => {
  const plan = await generate();
  const before = stored(plan.id);
  let raced = false;
  h.db.hooks.beforeStatement = ({ sql }) => {
    if (!raced && sql.startsWith('UPDATE generated_meal_plans')) {
      raced = true;
      h.db.execute('UPDATE generated_meal_plans SET revision = revision + 1 WHERE id = ?', [plan.id]);
    }
  };
  const result = await call(house, 'POST', `/meal-planning/plans/${plan.id}/regenerate`, { revision: 1 });
  expect(raced).toBe(true);
  expect(result.status, JSON.stringify(result.json)).toBe(409);
  expect(result.json.code).toBe('PLAN_REVISION_CONFLICT');
  expect(stored(plan.id)).toEqual(before);
}, 30_000);

it('drops a standalone lock when its known content changed without a recipe version change', async () => {
  const plan = await generate();
  const meal = plan.result.meals[0];
  const locked = await call(house, 'POST', `/meal-planning/plans/${plan.id}/swap`, {
    revision: 1, slotId: meal.slotId, replacement: { kind: 'recipe', id: meal.source.id },
  });
  expect(locked.status, JSON.stringify(locked.json)).toBe(200);
  const recipe = (await readHouseholdRecipeContentVersion(h.db, house, meal.contentFingerprint!))!;
  const historical = await captureRecipeContentVersion(h.db, { ...recipe, title: 'Older locked content' });
  await grantRecipeContentAccess(h.db, house, historical);
  const payload = stored(plan.id);
  payload.data.result.meals.find((entry: { slotId: string }) => entry.slotId === meal.slotId).contentFingerprint = historical;
  save(plan.id, payload);
  const result = await call(house, 'POST', `/meal-planning/plans/${plan.id}/regenerate`, { revision: 2 });
  expect(result.status, JSON.stringify(result.json)).toBe(200);
  const intent = JSON.parse(h.db.query<{ intent_json: string }>('SELECT intent_json FROM generated_meal_plans WHERE id = ?', plan.id)[0].intent_json);
  expect(intent.data.locks).toEqual([]);
  for (const selected of MealPlanDtoSchema.parse(result.json).result.meals) {
    const current = (await resolveRecipeAuthority(h.env(), { tenantKey: house })).snapshot.findById(selected.source.id)!;
    expect(selected.contentFingerprint).toBe(await fingerprintRecipes([current]));
  }
}, 30_000);

it.each([false, true])('inherits a locked composed anchor pin on V1 regeneration (legacy=%s)', async (legacy) => {
  const plan = await generate();
  const meal = plan.result.meals[0];
  const path = `/meal-planning/plans/${plan.id}/slots/${encodeURIComponent(meal.slotId)}`;
  const written = await call(house, 'PUT', `${path}/composition`, { revision: 1,
    components: [{ target: { kind: 'recipe', recipeId: meal.source.id }, role: 'main', locked: true }] });
  expect(written.status, JSON.stringify(written.json)).toBe(200);
  const component = SlotCompositionDtoSchema.parse(written.json).composition.components[0];
  if (legacy) await h.db.prepare('UPDATE generated_meal_plan_components SET recipe_content_fingerprint = NULL WHERE plan_id = ? AND id = ?')
    .bind(plan.id, component.id).run();
  const result = await call(house, 'POST', `/meal-planning/plans/${plan.id}/regenerate`, { revision: written.json.planRevision });
  expect(result.status, JSON.stringify(result.json)).toBe(200);
  const anchor = MealPlanDtoSchema.parse(result.json).result.meals.find(entry => entry.slotId === meal.slotId)!;
  expect(anchor.source.id).toBe(meal.source.id);
  expect(anchor.contentFingerprint).toBe(legacy ? null : component.contentFingerprint);
  const read = await call(house, 'GET', `${path}/composition`);
  expect(SlotCompositionDtoSchema.parse(read.json).composition.components[0].contentFingerprint).toBe(anchor.contentFingerprint);
}, 30_000);
