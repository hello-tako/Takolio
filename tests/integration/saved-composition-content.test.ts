import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MealPlanDtoSchema } from '../../packages/domain/src/meal-planning-api';
import { MealComponentDtoSchema, MealCompositionDtoSchema, PlanCompositionsDtoSchema, SlotCompositionDtoSchema } from '../../packages/domain/src/meal-composition-api';
import { captureRecipeContentVersion, grantRecipeContentAccess, readRecipeContentVersion } from '../../src/worker/services/recipe-content-versions';
import { quietLogs, T20Harness, T20_INTENT } from '../helpers/t20-composition-harness';

vi.mock('../../src/worker/services/email', () => ({ sendEmail: vi.fn(), buildOtpEmail: vi.fn() }));
const house = 'saved-composition-house';
const other = 'saved-composition-other';
const recipeId = 'imp-26a36c69306143bc';
let h: T20Harness;
beforeEach(async () => {
  h = new T20Harness();
  await h.seedHousehold(house);
  await h.seedHousehold(other);
  quietLogs();
});
afterEach(() => { h.close(); vi.restoreAllMocks(); });
const contentCall = (...args: Parameters<T20Harness['call']>) => {
  const [household, method, path, body, extra, headers] = args;
  return h.call(household, method, path, body, extra, { ...headers, Accept: 'application/json; recipe-content=1' });
};

const legacyComponent = MealComponentDtoSchema.omit({ contentFingerprint: true }).strict();
const legacyComposition = MealCompositionDtoSchema.extend({ components: legacyComponent.array() });
const legacySlot = SlotCompositionDtoSchema.extend({ composition: legacyComposition });
const legacyPlan = PlanCompositionsDtoSchema.extend({ compositions: legacyComposition.array() });

it('keeps legacy composition responses strict and disables cooking pinned recipes', async () => {
  const generated = await h.call(house, 'POST', '/meal-planning/plans', T20_INTENT);
  const plan = MealPlanDtoSchema.parse(generated.json);
  const slot = plan.result.meals[0].slotId;
  const path = `/meal-planning/plans/${plan.id}/slots/${encodeURIComponent(slot)}`;
  const added = await h.call(house, 'PUT', `${path}/composition`, { revision: plan.revision,
    components: [{ target: { kind: 'recipe', recipeId }, role: 'main', locked: false }] });
  expect(added.status, JSON.stringify(added.json)).toBe(200);
  const old = legacySlot.parse(added.json);
  expect(old.composition.components[0].cookable).toBe(false);
  const modern = await contentCall(house, 'GET', `${path}/composition`);
  const component = SlotCompositionDtoSchema.parse(modern.json).composition.components[0];
  expect(component.contentFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(component.cookable).toBe(true);
  legacyPlan.parse((await h.call(house, 'GET', `/meal-planning/plans/${plan.id}/compositions`)).json);
  const locked = await h.call(house, 'PATCH', `${path}/components/${component.id}`, { revision: old.planRevision, locked: true });
  expect(locked.status, JSON.stringify(locked.json)).toBe(200);
  legacySlot.parse(locked.json);
  const recipe = await readRecipeContentVersion(h.db, component.contentFingerprint!);
  const historical = await captureRecipeContentVersion(h.db, { ...recipe!, title: 'Historical version' });
  await grantRecipeContentAccess(h.db, house, historical);
  await h.db.prepare('UPDATE generated_meal_plan_components SET recipe_content_fingerprint = ? WHERE plan_id = ? AND id = ?')
    .bind(historical, plan.id, component.id).run();
  const read = legacySlot.parse((await h.call(house, 'GET', `${path}/composition`)).json);
  expect(read.composition.components[0]).toMatchObject({ title: 'Historical version', cookable: false, projection: null });
  expect(read.composition.warnings).toContain('SAVED_CONTENT_REQUIRES_REVALIDATION');
  const removed = await h.call(house, 'DELETE', `${path}/components/${component.id}?revision=${locked.json.planRevision}`);
  expect(removed.status, JSON.stringify(removed.json)).toBe(200);
  legacySlot.parse(removed.json);
}, 30_000);

it('pins new recipes, preserves pins on lock, displays authorized history and rejects current-fact reuse', async () => {
  const generated = await contentCall(house, 'POST', '/meal-planning/plans', T20_INTENT);
  expect(generated.status).toBe(200);
  const plan = MealPlanDtoSchema.parse(generated.json);
  const slot = plan.result.meals[0].slotId;
  const path = `/meal-planning/plans/${plan.id}/slots/${encodeURIComponent(slot)}`;
  const added = await contentCall(house, 'PUT', `${path}/composition`, { revision: plan.revision,
    components: [{ target: { kind: 'recipe', recipeId }, role: 'main', locked: false }] });
  expect(added.status, JSON.stringify(added.json)).toBe(200);
  const saved = SlotCompositionDtoSchema.parse(added.json);
  const component = saved.composition.components[0];
  expect(component.contentFingerprint).toMatch(/^[a-f0-9]{64}$/);
  const lockedResponse = await contentCall(house, 'PATCH', `${path}/components/${component.id}`, { revision: saved.planRevision, locked: true });
  expect(lockedResponse.status, JSON.stringify(lockedResponse.json)).toBe(200);
  const locked = SlotCompositionDtoSchema.parse(lockedResponse.json);
  expect(locked.composition.components[0].contentFingerprint).toBe(component.contentFingerprint);
  const original = await readRecipeContentVersion(h.db, component.contentFingerprint!);
  expect(original).not.toBeNull();
  const historical = { ...original!, title: 'Historical saved recipe' };
  const fingerprint = await captureRecipeContentVersion(h.db, historical);
  await grantRecipeContentAccess(h.db, house, fingerprint);
  await h.db.prepare('UPDATE generated_meal_plan_components SET recipe_content_fingerprint = ? WHERE plan_id = ? AND id = ?')
    .bind(fingerprint, plan.id, component.id).run();
  const read = await contentCall(house, 'GET', `${path}/composition`);
  expect(read.status, JSON.stringify(read.json)).toBe(200);
  expect(read.json.composition.components[0]).toMatchObject({ title: historical.title, contentFingerprint: fingerprint, projection: null });
  expect(read.json.composition.warnings).toContain('SAVED_CONTENT_REQUIRES_REVALIDATION');
  for (const endpoint of [`${path}/composition?includeAssessment=true`,
    `/meal-planning/plans/${plan.id}/compositions?includeAssessment=true`]) {
    const display = await contentCall(house, 'GET', endpoint);
    expect(display.status, JSON.stringify(display.json)).toBe(200);
    const compositions = display.json.compositions ?? [display.json.composition];
    expect(compositions.find((entry: { slotId: string }) => entry.slotId === slot).warnings)
      .toContain('SAVED_CONTENT_REQUIRES_REVALIDATION');
    for (const entry of compositions) for (const item of entry.components) {
      expect(item.projection).toBeNull();
      expect(item).not.toHaveProperty('assessment');
    }
  }
  const shopping = await contentCall(house, 'POST', `/meal-planning/plans/${plan.id}/shopping`, { revision: locked.planRevision, currency: 'VND' });
  expect(shopping.status).toBe(409);
  expect(shopping.json.code).toBe('COMPOSITION_REVALIDATION_REQUIRED');
  const shared = await contentCall(house, 'POST', '/shopping-list/from-plan', {
    planId: plan.id, expectedRevision: locked.planRevision, startDate: T20_INTENT.startDate, endDate: T20_INTENT.startDate,
  });
  expect(shared.status, JSON.stringify(shared.json)).toBe(409);
  expect(shared.json.code).toBe('COMPOSITION_REVALIDATION_REQUIRED');
  expect(h.db.query('SELECT source_id FROM shopping_plan_demands')).toEqual([]);
  const update = await contentCall(house, 'PATCH', `${path}/components/${component.id}`, { revision: locked.planRevision, locked: false });
  expect(update.status).toBe(409);
  expect(update.json.code).toBe('COMPOSITION_REVALIDATION_REQUIRED');
  const replaced = await contentCall(house, 'POST', `${path}/components/${component.id}/swap`, { revision: locked.planRevision,
    target: { kind: 'recipe', recipeId } });
  expect(replaced.status, JSON.stringify(replaced.json)).toBe(200);
  expect(replaced.json.composition.components[0].contentFingerprint).toBe(component.contentFingerprint);
  const otherRead = await contentCall(other, 'GET', `/recipes/${recipeId}?contentFingerprint=${fingerprint}`);
  expect(otherRead.status).toBe(404);
}, 30_000);

it('removes incompatible components one slot at a time without accepting stale or foreign writes', async () => {
  const generated = await contentCall(house, 'POST', '/meal-planning/plans', T20_INTENT);
  const plan = MealPlanDtoSchema.parse(generated.json);
  let revision = plan.revision;
  const selected: Array<{ path: string; id: string; fingerprint: string }> = [];
  for (const meal of plan.result.meals.slice(0, 2)) {
    const path = `/meal-planning/plans/${plan.id}/slots/${encodeURIComponent(meal.slotId)}`;
    const response = await contentCall(house, 'PUT', `${path}/composition`, { revision,
      components: [{ target: { kind: 'recipe', recipeId }, role: 'main', locked: false }] });
    expect(response.status, JSON.stringify(response.json)).toBe(200);
    const dto = SlotCompositionDtoSchema.parse(response.json);
    revision = dto.planRevision;
    selected.push({ path, id: dto.composition.components[0].id, fingerprint: dto.composition.components[0].contentFingerprint! });
  }
  const original = await readRecipeContentVersion(h.db, selected[0].fingerprint);
  const historical = await captureRecipeContentVersion(h.db, { ...original!, title: 'Older content' });
  await grantRecipeContentAccess(h.db, house, historical);
  for (const item of selected) {
    await h.db.prepare('UPDATE generated_meal_plan_components SET recipe_content_fingerprint = ? WHERE plan_id = ? AND id = ?')
      .bind(historical, plan.id, item.id).run();
  }
  const firstPath = `${selected[0].path}/components/${selected[0].id}`;
  expect((await contentCall(other, 'DELETE', `${firstPath}?revision=${revision}`)).status).toBe(404);
  expect((await contentCall(house, 'DELETE', `${firstPath}?revision=${revision - 1}`)).status).toBe(409);
  expect(h.db.query('SELECT id FROM generated_meal_plan_components WHERE plan_id = ?', plan.id)).toHaveLength(2);
  const first = await contentCall(house, 'DELETE', `${firstPath}?revision=${revision}`);
  expect(first.status, JSON.stringify(first.json)).toBe(200);
  revision += 1;
  const remaining = await contentCall(house, 'GET', `${selected[1].path}/composition`);
  expect(remaining.json.composition.components[0].contentFingerprint).toBe(historical);
  expect(remaining.json.composition.components[0].projection).toBeNull();
  const second = await contentCall(house, 'DELETE', `${selected[1].path}/components/${selected[1].id}?revision=${revision}`);
  expect(second.status, JSON.stringify(second.json)).toBe(200);
  expect(h.db.query('SELECT id FROM generated_meal_plan_components WHERE plan_id = ?', plan.id)).toHaveLength(0);
}, 30_000);

it('keeps authority-change recovery explicit and preserves pins on rejected swap and picker', async () => {
  const generated = await contentCall(house, 'POST', '/meal-planning/plans', T20_INTENT);
  const plan = MealPlanDtoSchema.parse(generated.json);
  const slot = plan.result.meals[0].slotId;
  const path = `/meal-planning/plans/${plan.id}/slots/${encodeURIComponent(slot)}`;
  const added = await contentCall(house, 'PUT', `${path}/composition`, { revision: plan.revision,
    components: [{ target: { kind: 'recipe', recipeId }, role: 'main', locked: true }] });
  const saved = SlotCompositionDtoSchema.parse(added.json);
  const component = saved.composition.components[0];
  h.db.execute('UPDATE recipes SET title = title || ? WHERE id = ?', [' changed', recipeId]);
  const swap = await contentCall(house, 'POST', `${path}/components/${component.id}/swap`, {
    revision: saved.planRevision, target: { kind: 'recipe', recipeId },
  });
  expect(swap.status, JSON.stringify(swap.json)).toBe(409);
  expect(swap.json.code).toBe('CATALOG_AUTHORITY_CHANGED');
  const picker = await contentCall(house, 'GET', `/meal-planning/compositions/picker?${new URLSearchParams({
    planId: plan.id, slotId: slot, revision: String(saved.planRevision), excludeComponentId: component.id,
  })}`);
  expect(picker.status).toBe(409);
  expect(picker.json.code).toBe('CATALOG_AUTHORITY_CHANGED');
  const display = await contentCall(house, 'GET', `${path}/composition?includeAssessment=true`);
  expect(display.status, JSON.stringify(display.json)).toBe(200);
  expect(display.json.planRevision).toBe(saved.planRevision);
  expect(display.json.composition.components[0]).toMatchObject({
    title: component.title, contentFingerprint: component.contentFingerprint, projection: null,
  });
  expect(display.json.composition.components[0]).not.toHaveProperty('assessment');
  expect((await contentCall(house, 'DELETE', `${path}/components/${component.id}?revision=${saved.planRevision - 1}`)).status).toBe(409);
  const removed = await contentCall(house, 'DELETE', `${path}/components/${component.id}?revision=${saved.planRevision}`);
  expect(removed.status, JSON.stringify(removed.json)).toBe(200);
  expect(removed.json.composition.components).toEqual([]);
}, 30_000);
