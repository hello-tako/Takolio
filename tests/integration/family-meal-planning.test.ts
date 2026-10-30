import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyMealPlanDtoSchema } from '../../packages/domain/src/family-meal-planning-api';
import { MealComponentDtoSchema, MealCompositionDtoSchema, PlanCompositionsDtoSchema } from '../../packages/domain/src/meal-composition-api';
import { MealPlanDtoSchema, PlannedMealDtoSchema, PlanResultDtoSchema } from '../../packages/domain/src/meal-planning-api';
import { FamilyPreferencesSchema } from '../../packages/domain/src/family-preferences-api';
import { saveFamilyPreferences } from '../../packages/db/src/family-preferences';
import { resolveRecipeAuthority } from '../../src/worker/services/recipe-authority';
import { captureRecipeContentVersion, grantRecipeContentAccess, readRecipeContentVersion } from '../../src/worker/services/recipe-content-versions';
import { buildRoleIndex } from '../../packages/recipes/src/composition/roles';
import { fetchWorker } from '../helpers/worker-fetch.mjs';
import { quietLogs, T20Harness, T20_ORIGIN } from '../helpers/t20-composition-harness';

vi.mock('../../src/worker/services/email', () => ({ sendEmail: vi.fn(), buildOtpEmail: vi.fn() }));
const HOUSE = 'family-house'; const OTHER = 'family-other';
const intent = { startDate: '2030-01-02', horizonDays: 7, defaultServings: 2, mode: 'shopping_allowed',
  slots: [{ date: '2030-01-02', mealType: 'dinner' }, { date: '2030-01-03', mealType: 'lunch' }] };
let h: T20Harness;
beforeEach(async () => { h = new T20Harness(); h.mode = 'static'; await h.seedHousehold(HOUSE); await h.seedHousehold(OTHER); quietLogs(); });
afterEach(() => { h.close(); vi.restoreAllMocks(); });
async function call(house: string, method: string, path: string, body?: unknown, key = crypto.randomUUID(), extra = {}, content = true) {
  const response = await fetchWorker(new Request(`${T20_ORIGIN}/api/v2/meal-planning${path}`, { method,
    headers: { ...(content ? { Accept: 'application/json; recipe-content=1' } : {}), Cookie: h.cookies[house], Origin: T20_ORIGIN, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: body === undefined ? undefined : JSON.stringify(body) }), h.env(extra));
  return { status: response.status, json: await response.json() as Record<string, unknown> };
}
async function generate() {
  const result = await call(HOUSE, 'POST', '/plans', intent);
  expect(result.status, JSON.stringify(result.json)).toBe(200);
  return FamilyMealPlanDtoSchema.parse(result.json);
}

describe('family meal V2 persistence and HTTP boundary', () => {
  it('negotiates pinned content while preserving strict legacy family responses', async () => {
    const legacyComponent = MealComponentDtoSchema.omit({ contentFingerprint: true }).strict();
    const legacyComposition = MealCompositionDtoSchema.extend({ components: legacyComponent.array() });
    const legacyFamily = FamilyMealPlanDtoSchema.safeExtend({ plan: MealPlanDtoSchema.extend({ result: PlanResultDtoSchema.extend({ meals: PlannedMealDtoSchema.omit({ contentFingerprint: true }).strict().array() }) }), compositions: PlanCompositionsDtoSchema.extend({ compositions: legacyComposition.array() }) });
    expect((await call(HOUSE, 'GET', '/plans/current', undefined, undefined, {}, false)).json).toEqual({ plan: null });
    const created = await call(HOUSE, 'POST', '/plans', intent, undefined, {}, false);
    expect(created.status, JSON.stringify(created.json)).toBe(200);
    const saved = legacyFamily.parse(created.json);
    const recipes = saved.compositions.compositions.flatMap(slot => slot.components.filter(component => component.kind === 'recipe'));
    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes.every(component => !component.cookable)).toBe(true);
    legacyFamily.parse((await call(HOUSE, 'GET', `/plans/${saved.plan.id}`, undefined, undefined, {}, false)).json);
    legacyFamily.parse((await call(HOUSE, 'GET', '/plans/current', undefined, undefined, {}, false)).json.plan);
    const modern = FamilyMealPlanDtoSchema.parse((await call(HOUSE, 'GET', `/plans/${saved.plan.id}`)).json);
    expect(modern.compositions.compositions.flatMap(slot => slot.components.filter(component => component.kind === 'recipe'))
      .every(component => component.cookable && /^[a-f0-9]{64}$/.test(component.contentFingerprint ?? ''))).toBe(true);
    const regenerated = await call(HOUSE, 'POST', `/plans/${saved.plan.id}/regenerate`, { revision: saved.plan.revision }, undefined, {}, false);
    expect(regenerated.status, JSON.stringify(regenerated.json)).toBe(200);
    expect(legacyFamily.parse(regenerated.json).plan.revision).toBe(saved.plan.revision + 1);
    const manual = await call(HOUSE, 'POST', '/drafts', intent, undefined, {}, false);
    expect(manual.status, JSON.stringify(manual.json)).toBe(200);
    legacyFamily.parse(manual.json);
  }, 30000);

  it('creates full lunch/dinner compositions atomically, replays same key and preserves strict V1 readers', async () => {
    const initialEvents = h.db.query('SELECT id FROM inventory_events ORDER BY id');
    const initialStock = h.db.query('SELECT id, quantity, version FROM inventory_items ORDER BY id');
    const key = crypto.randomUUID(); const created = await call(HOUSE, 'POST', '/plans', intent, key);
    expect(created.status, JSON.stringify(created.json)).toBe(200);
    const dto = FamilyMealPlanDtoSchema.parse(created.json);
    expect(dto.plan.revision).toBe(1);
    for (const meal of dto.plan.result.meals) expect(meal.contentFingerprint).toBe(
      dto.compositions.compositions.find(slot => slot.slotId === meal.slotId)?.components.find(component => component.recipeId === meal.source.id)?.contentFingerprint ?? null);
    expect(dto.compositions.compositions).toHaveLength(2);
    for (const composition of dto.compositions.compositions) {
      expect(composition.components.map((component) => component.role)).toEqual(['main', 'vegetable', 'soup', 'staple']);
      expect(composition.missingRoles).toEqual([]);
      expect(composition.components.filter((component) => component.kind === 'recipe').every((component) => /^[a-f0-9]{64}$/.test(component.contentFingerprint ?? ''))).toBe(true);
    }
    expect(dto.diagnostics).toMatchObject({ completeMealCount: 2, partialMealCount: 0, unplannedMealCount: 0 });
    expect(dto.policy.internationalGeneratedMainCount).toBe(0);
    const replay = await call(HOUSE, 'POST', '/plans', intent, key);
    expect(FamilyMealPlanDtoSchema.parse(replay.json).plan.id).toBe(dto.plan.id);
    expect(h.db.query('SELECT id FROM generated_meal_plans')).toHaveLength(1);
    expect(h.db.query('SELECT plan_id FROM generated_family_meal_plans')).toHaveLength(1);
    const legacy = await h.call(HOUSE, 'GET', `/meal-planning/plans/${dto.plan.id}`);
    expect(legacy.status).toBe(200); expect(MealPlanDtoSchema.parse(legacy.json).result.meals).toHaveLength(2);
    expect(h.db.query('SELECT id FROM inventory_events ORDER BY id')).toEqual(initialEvents);
    expect(h.db.query('SELECT id, quantity, version FROM inventory_items ORDER BY id')).toEqual(initialStock);
  }, 30000);
  it('keeps locked main and refills unlocked components on regeneration, rejecting stale revisions', async () => {
    const created = await generate(); const composition = created.compositions.compositions[0]; const main = composition.components[0];
    const path = `/meal-planning/plans/${created.plan.id}/slots/${encodeURIComponent(composition.slotId)}/components/${encodeURIComponent(main.id)}`;
    const locked = await h.call(HOUSE, 'PATCH', path, { revision: created.plan.revision, locked: true });
    expect(locked.status).toBe(200);
    const result = await call(HOUSE, 'POST', `/plans/${created.plan.id}/regenerate`, { revision: created.plan.revision + 1 });
    expect(result.status, JSON.stringify(result.json)).toBe(200);
    const dto = FamilyMealPlanDtoSchema.parse(result.json);
    const current = dto.compositions.compositions[0].components.find((component) => component.id === main.id)!;
    expect(dto.plan.result.meals.find(meal => meal.slotId === composition.slotId)?.contentFingerprint).toBe(current.contentFingerprint);
    expect(current).toMatchObject({ id: main.id, recipeId: main.recipeId, role: 'main', locked: true, createdRevision: 1, updatedRevision: 2, contentFingerprint: main.contentFingerprint });
    expect(dto.compositions.compositions.every((entry) => entry.components.length === 4)).toBe(true);
    const stale = await call(HOUSE, 'POST', `/plans/${created.plan.id}/regenerate`, { revision: 1 });
    expect(stale.status).toBe(409);
  }, 30000);
  it('rejects regeneration of locked historical content without changing the plan', async () => {
    const created = await generate();
    const composition = created.compositions.compositions[0];
    const main = composition.components.find((component) => component.kind === 'recipe')!;
    const path = `/meal-planning/plans/${created.plan.id}/slots/${encodeURIComponent(composition.slotId)}/components/${encodeURIComponent(main.id)}`;
    expect((await h.call(HOUSE, 'PATCH', path, { revision: 1, locked: true })).status).toBe(200);
    const recipe = await readRecipeContentVersion(h.db, main.contentFingerprint!);
    const historical = await captureRecipeContentVersion(h.db, { ...recipe!, title: 'Historical version' });
    await grantRecipeContentAccess(h.db, HOUSE, historical);
    await h.db.prepare('UPDATE generated_meal_plan_components SET recipe_content_fingerprint = ? WHERE plan_id = ? AND id = ?')
      .bind(historical, created.plan.id, main.id).run();
    const result = await call(HOUSE, 'POST', `/plans/${created.plan.id}/regenerate`, { revision: 2 });
    expect(result.status).toBe(409);
    expect(result.json.code).toBe('COMPOSITION_REVALIDATION_REQUIRED');
    const read = await call(HOUSE, 'GET', `/plans/${created.plan.id}`);
    const dto = FamilyMealPlanDtoSchema.parse(read.json);
    expect(dto.plan.revision).toBe(2);
    expect(dto.diagnostics.partialMealCount).toBeGreaterThan(0);
    expect(dto.compositions.compositions[0].warnings).toContain('SAVED_CONTENT_REQUIRES_REVALIDATION');
  }, 30000);
  it('reports profile changes after reload and recomputes completeness after a component removal', async () => {
    const created = await generate();
    await saveFamilyPreferences(h.db, { householdId: HOUSE, userId: h.users[HOUSE] }, { expectedRevision: 0,
      preferences: FamilyPreferencesSchema.parse({ preferredRegions: ['nam'] }) });
    const current = await call(HOUSE, 'GET', `/plans/${created.plan.id}`);
    expect(FamilyMealPlanDtoSchema.parse(current.json).familyPreferenceFreshness).toBe('requires_revalidation');
    const composition = created.compositions.compositions[0]; const soup = composition.components.find((component) => component.role === 'soup')!;
    const removed = await h.call(HOUSE, 'DELETE', `/meal-planning/plans/${created.plan.id}/slots/${encodeURIComponent(composition.slotId)}/components/${encodeURIComponent(soup.id)}?revision=1`);
    expect(removed.status, JSON.stringify(removed.json)).toBe(200);
    const reread = FamilyMealPlanDtoSchema.parse((await call(HOUSE, 'GET', `/plans/${created.plan.id}`)).json);
    expect(reread.compositions.compositions[0].missingRoles).toContain('soup');
    expect(reread.diagnostics.partialMealCount).toBe(1);
  }, 30000);
  it('keeps unknown whole-meal time visible after default and saved-profile reloads', async () => {
    const created = await generate();
    expect(created.compositions.compositions.every(slot => slot.warnings.includes('MEAL_TIME_UNKNOWN'))).toBe(true);
    const scope = { householdId: HOUSE, userId: h.users[HOUSE] };
    await saveFamilyPreferences(h.db, scope, { expectedRevision: 0, preferences: { preferredTimeMinutes: 30 } });
    const reread = await h.call(HOUSE, 'GET', `/meal-planning/plans/${created.plan.id}/compositions`);
    expect(reread.status, JSON.stringify(reread.json)).toBe(200);
    expect(reread.json.compositions.every((slot: { warnings: string[] }) =>
      slot.warnings.includes('MEAL_TIME_UNKNOWN') && !slot.warnings.includes('MEAL_TIME_ABOVE_PREFERENCE'))).toBe(true);
  }, 30000);

  it('recomputes whole-meal time warnings from current authoritative preparation metadata on reads', async () => {
    h.mode = 'd1';
    const response = await call(HOUSE, 'POST', '/plans', { ...intent, slots: intent.slots.slice(0, 1) });
    expect(response.status, JSON.stringify(response.json)).toBe(200);
    const created = FamilyMealPlanDtoSchema.parse(response.json);
    const recipeIds = created.compositions.compositions[0].components.flatMap(component => component.recipeId ? [component.recipeId] : []);
    for (const recipeId of recipeIds) h.db.execute('UPDATE recipes SET prep_time_minutes = 120 WHERE id = ?', [recipeId]);
    const path = `/meal-planning/plans/${created.plan.id}/compositions`;
    const slow = await h.call(HOUSE, 'GET', path);
    expect(slow.status, JSON.stringify(slow.json)).toBe(200);
    expect(slow.json.compositions[0].warnings).toContain('MEAL_TIME_ABOVE_PREFERENCE');
    expect(slow.json.compositions[0].warnings).not.toContain('MEAL_TIME_UNKNOWN');
    const slowFamily = FamilyMealPlanDtoSchema.parse((await call(HOUSE, 'GET', `/plans/${created.plan.id}`)).json);
    expect(slowFamily.diagnostics.reasons).toContain('MEAL_TIME_ABOVE_PREFERENCE');
    expect(slowFamily.diagnostics.reasons).not.toContain('MEAL_TIME_UNKNOWN');
    h.db.execute('UPDATE recipes SET prep_time_minutes = NULL WHERE id = ?', [recipeIds[0]]);
    const uncertain = await h.call(HOUSE, 'GET', path);
    expect(uncertain.status, JSON.stringify(uncertain.json)).toBe(200);
    expect(uncertain.json.compositions[0].warnings).toContain('MEAL_TIME_UNKNOWN');
    expect(uncertain.json.compositions[0].warnings).not.toContain('MEAL_TIME_ABOVE_PREFERENCE');
    for (const recipeId of recipeIds) h.db.execute('UPDATE recipes SET prep_time_minutes = 0 WHERE id = ?', [recipeId]);
    await saveFamilyPreferences(h.db, { householdId: HOUSE, userId: h.users[HOUSE] },
      { expectedRevision: 0, preferences: { preferredTimeMinutes: 180 } });
    const relaxed = await h.call(HOUSE, 'GET', path);
    expect(relaxed.status, JSON.stringify(relaxed.json)).toBe(200);
    expect(relaxed.json.compositions[0].warnings).not.toContain('MEAL_TIME_UNKNOWN');
    expect(relaxed.json.compositions[0].warnings).not.toContain('MEAL_TIME_ABOVE_PREFERENCE');
    const relaxedFamily = FamilyMealPlanDtoSchema.parse((await call(HOUSE, 'GET', `/plans/${created.plan.id}`)).json);
    expect(relaxedFamily.diagnostics.reasons.some(reason => reason.startsWith('MEAL_TIME'))).toBe(false);
    h.db.execute(`UPDATE member_ranking_preferences SET values_json = json_set(values_json,'$.values.hardMaxTimeMinutes',1)
      WHERE household_id = ? AND user_id = ?`, [HOUSE, h.users[HOUSE]]);
    const restricted = FamilyMealPlanDtoSchema.parse((await call(HOUSE, 'GET', `/plans/${created.plan.id}`)).json);
    expect(restricted.compositions.compositions[0].warnings).toContain('MEAL_TIME_REQUIRES_REVALIDATION');
    expect(restricted.diagnostics.completeMealCount).toBe(0);
    expect(restricted.diagnostics.partialMealCount).toBe(1);
  }, 30000);

  it('refuses flag-off V1 writers on a saved family plan without changing components, metadata or locks', async () => {
    const created = await generate(); const first = created.compositions.compositions[0]; const main = first.components[0];
    const locked = await h.call(HOUSE, 'PATCH', `/meal-planning/plans/${created.plan.id}/slots/${encodeURIComponent(first.slotId)}/components/${encodeURIComponent(main.id)}`,
      { revision: 1, locked: true });
    expect(locked.status).toBe(200);
    const before = h.db.query('SELECT * FROM generated_meal_plans WHERE id=?', created.plan.id);
    const components = h.db.query('SELECT * FROM generated_meal_plan_components WHERE plan_id=? ORDER BY id', created.plan.id);
    const metadata = h.db.query('SELECT * FROM generated_family_meal_plans WHERE plan_id=?', created.plan.id);
    const off = { MEAL_COMPOSITION_V2_ENABLED: 'false' };
    const regenerate = await h.call(HOUSE, 'POST', `/meal-planning/plans/${created.plan.id}/regenerate`,
      { revision: 2, intent: { ...intent, defaultServings: 4, slots: intent.slots.slice(0, 1) } }, off);
    expect(regenerate.status, JSON.stringify(regenerate.json)).toBe(409);
    expect(regenerate.json.code).toBe('MEAL_COMPOSITION_DISABLED');
    const swap = await h.call(HOUSE, 'POST', `/meal-planning/plans/${created.plan.id}/swap`,
      { revision: 2, slotId: first.slotId, replacement: { kind: 'recipe', id: 'vn-kho-01' } }, off);
    expect(swap.status, JSON.stringify(swap.json)).toBe(409);
    expect(swap.json.code).toBe('MEAL_COMPOSITION_DISABLED');
    const readable = await h.call(HOUSE, 'GET', `/meal-planning/plans/${created.plan.id}`, undefined, off);
    expect(readable.status).toBe(200);
    expect(MealPlanDtoSchema.parse(readable.json).revision).toBe(2);
    expect(h.db.query('SELECT * FROM generated_meal_plans WHERE id=?', created.plan.id)).toEqual(before);
    expect(h.db.query('SELECT * FROM generated_meal_plan_components WHERE plan_id=? ORDER BY id', created.plan.id)).toEqual(components);
    expect(h.db.query('SELECT * FROM generated_family_meal_plans WHERE plan_id=?', created.plan.id)).toEqual(metadata);
    const enabled = await h.call(HOUSE, 'POST', `/meal-planning/plans/${created.plan.id}/regenerate`, { revision: 2 });
    expect(enabled.status, JSON.stringify(enabled.json)).toBe(200);
    expect(MealPlanDtoSchema.parse(enabled.json).revision).toBe(3);
    const reread = FamilyMealPlanDtoSchema.parse((await call(HOUSE, 'GET', `/plans/${created.plan.id}`)).json);
    expect(reread.compositions.compositions.every(slot => slot.components.length === 4)).toBe(true);
    expect(reread.compositions.compositions[0].components.find(component => component.id === main.id))
      .toMatchObject({ recipeId: main.recipeId, locked: true });
  }, 30000);

  it('protects an all-unplanned family plan from flag-off V1 regeneration through its persisted policy marker', async () => {
    const response = await call(HOUSE, 'POST', '/plans', { ...intent,
      slots: intent.slots.map(slot => ({ ...slot, hardMaxTimeMinutes: 1, preferredTimeMinutes: 15 })) });
    expect(response.status, JSON.stringify(response.json)).toBe(200);
    const created = FamilyMealPlanDtoSchema.parse(response.json);
    expect(created.plan.result.meals).toEqual([]);
    const before = h.db.query('SELECT * FROM generated_meal_plans WHERE id=?', created.plan.id);
    const refused = await h.call(HOUSE, 'POST', `/meal-planning/plans/${created.plan.id}/regenerate`,
      { revision: 1, intent }, { MEAL_COMPOSITION_V2_ENABLED: 'false' });
    expect(refused.status, JSON.stringify(refused.json)).toBe(409);
    expect(refused.json.code).toBe('MEAL_COMPOSITION_DISABLED');
    expect(h.db.query('SELECT * FROM generated_meal_plans WHERE id=?', created.plan.id)).toEqual(before);
  }, 30000);

  it('rolls the entire create back if one component write fails', async () => {
    h.db.seed(`CREATE TRIGGER reject_family_component BEFORE INSERT ON generated_meal_plan_components
      WHEN NEW.role = 'soup' BEGIN SELECT RAISE(ABORT, 'synthetic component failure'); END;`);
    const result = await call(HOUSE, 'POST', '/plans', intent);
    expect(result.status).toBe(500);
    expect(h.db.query('SELECT id FROM generated_meal_plans')).toHaveLength(0);
    expect(h.db.query('SELECT plan_id FROM generated_family_meal_plans')).toHaveLength(0);
    expect(h.db.query('SELECT plan_id FROM generated_meal_plan_compositions')).toHaveLength(0);
    expect(h.db.query('SELECT id FROM generated_meal_plan_components')).toHaveLength(0);
  }, 30000);
  it('fences tenancy, feature flags and key collisions', async () => {
    const created = await generate();
    expect((await call(OTHER, 'GET', `/plans/${created.plan.id}`)).status).toBe(404);
    expect((await call(HOUSE, 'POST', '/plans', intent, crypto.randomUUID(), { MEAL_COMPOSITION_V2_ENABLED: undefined })).status).toBe(404);
    const key = crypto.randomUUID(); await call(HOUSE, 'POST', '/plans', intent, key);
    expect((await call(HOUSE, 'POST', '/plans', { ...intent, defaultServings: 3 }, key)).status).toBe(409);
  }, 30000);
  it('same-key concurrent creates produce one plan and stale concurrent regeneration cannot overwrite components', async () => {
    const key = crypto.randomUUID();
    const [first, second] = await Promise.all([call(HOUSE, 'POST', '/plans', intent, key), call(HOUSE, 'POST', '/plans', intent, key)]);
    expect(first.status, JSON.stringify(first.json)).toBe(200); expect(second.status, JSON.stringify(second.json)).toBe(200);
    const created = FamilyMealPlanDtoSchema.parse(first.json);
    expect(FamilyMealPlanDtoSchema.parse(second.json).plan.id).toBe(created.plan.id);
    expect(h.db.query('SELECT id FROM generated_meal_plans')).toHaveLength(1);
    expect(h.db.query('SELECT id FROM generated_meal_plan_components')).toHaveLength(8);
    const results = await Promise.all([call(HOUSE, 'POST', '/plans/' + created.plan.id + '/regenerate', { revision: 1 }),
      call(HOUSE, 'POST', '/plans/' + created.plan.id + '/regenerate', { revision: 1 })]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const current = FamilyMealPlanDtoSchema.parse((await call(HOUSE, 'GET', '/plans/' + created.plan.id)).json);
    expect(current.plan.revision).toBe(2); expect(current.compositions.compositions.every((slot) => slot.components.length === 4)).toBe(true);
  }, 30000);
  it('rejects invalid horizon and prevents serving changes of a locked component', async () => {
    expect((await call(HOUSE, 'POST', '/plans', { ...intent, slots: [intent.slots[0], intent.slots[0]] })).status).toBe(422);
    const created = await generate(); const slot = created.compositions.compositions[0];
    await h.call(HOUSE, 'PATCH', '/meal-planning/plans/' + created.plan.id + '/slots/' + encodeURIComponent(slot.slotId)
      + '/components/' + encodeURIComponent(slot.components[0].id), { revision: 1, locked: true });
    const changed = await call(HOUSE, 'POST', '/plans/' + created.plan.id + '/regenerate', { revision: 2, intent: { ...intent, defaultServings: 3 } });
    expect(changed.status).toBe(422); expect(changed.json.code).toBe('LOCKED_SERVINGS_CONFLICT');
  }, 30000);
  it('creates a seven-dinner composed week from the current D1 authority without international fallback', async () => {
    h.mode = 'd1';
    const slots = Array.from({ length: 7 }, (_, index) => ({ date: new Date(Date.parse('2030-01-02') + index * 86400000).toISOString().slice(0, 10), mealType: 'dinner' }));
    const created = await call(HOUSE, 'POST', '/plans', { ...intent, slots });
    expect(created.status, JSON.stringify(created.json)).toBe(200);
    const dto = FamilyMealPlanDtoSchema.parse(created.json);
    expect(dto.compositions.compositions).toHaveLength(7);
    expect(dto.compositions.compositions.every((slot) => slot.components.length === 4)).toBe(true);
    expect(dto.policy.internationalGeneratedMainCount).toBe(0);
    expect(dto.diagnostics.searchLimited).toBe(false);
  }, 30000);

  it('fences stock and profile changes immediately before atomic create and regeneration', async () => {
    let mutate = true;
    h.db.hooks.beforeBatch = (statements) => {
      if (mutate && statements.some((statement) => statement.sql.includes('INSERT INTO generated_meal_plans'))) {
        mutate = false; h.db.seed("UPDATE inventory_items SET quantity = quantity + 1, version = version + 1 WHERE household_id = 'family-house'");
      }
    };
    const rejected = await call(HOUSE, 'POST', '/plans', intent);
    expect(rejected.status, JSON.stringify(rejected.json)).toBe(409);
    expect(rejected.json.code).toBe('PLAN_REVALIDATION_REQUIRED');
    expect(h.db.query('SELECT id FROM generated_meal_plans')).toHaveLength(0);
    h.db.hooks.beforeBatch = undefined;
    const created = await generate(); const initial = h.db.query('SELECT id, recipe_id, role FROM generated_meal_plan_components ORDER BY id');
    mutate = true;
    h.db.hooks.beforeBatch = (statements) => {
      if (mutate && statements.some((statement) => statement.sql.includes('UPDATE generated_meal_plans'))) {
        mutate = false;
        h.db.seed("INSERT INTO family_meal_preferences(household_id,user_id,revision,preferences_json,updated_at) VALUES ('family-house','"
          + h.users[HOUSE] + "',1,'" + JSON.stringify(FamilyPreferencesSchema.parse({ preferredRegions: ['bac'] })) + "','2030-01-01T00:00:00Z')");
      }
    };
    const changed = await call(HOUSE, 'POST', '/plans/' + created.plan.id + '/regenerate', { revision: 1 });
    expect(changed.status, JSON.stringify(changed.json)).toBe(409);
    expect(h.db.query('SELECT revision FROM generated_meal_plans')[0].revision).toBe(1);
    expect(h.db.query('SELECT id, recipe_id, role FROM generated_meal_plan_components ORDER BY id')).toEqual(initial);
  }, 30000);
  it('fences D1 catalog changes and keeps the family template in per-slot Assisted preview/apply', async () => {
    h.mode = 'd1'; let mutate = true;
    h.db.hooks.beforeBatch = (statements) => {
      if (mutate && statements.some((statement) => statement.sql.includes('INSERT INTO generated_meal_plans'))) {
        mutate = false; h.db.seed("UPDATE recipes SET title = title || ' changed' WHERE id = (SELECT id FROM recipes ORDER BY id LIMIT 1)");
      }
    };
    const rejected = await call(HOUSE, 'POST', '/plans', intent);
    expect(rejected.status, JSON.stringify(rejected.json)).toBe(409); expect(h.db.query('SELECT id FROM generated_meal_plans')).toHaveLength(0);
    h.db.hooks.beforeBatch = undefined; h.mode = 'static';
    const created = await generate(); const slot = created.compositions.compositions[1];
    const path = '/meal-planning/plans/' + created.plan.id + '/slots/' + encodeURIComponent(slot.slotId);
    const preview = await h.call(HOUSE, 'POST', path + '/assist', { revision: 1, action: 'regenerate_unlocked', variant: 0 });
    expect(preview.status, JSON.stringify(preview.json)).toBe(200);
    const proposal = preview.json.proposal;
    expect(proposal.components.map((component: { role: string }) => component.role)).toEqual(['main', 'vegetable', 'soup', 'staple']);
    const applied = await h.call(HOUSE, 'POST', path + '/assist/apply', { revision: 1, action: 'regenerate_unlocked', variant: 0, proposalId: proposal.optionId });
    expect(applied.status, JSON.stringify(applied.json)).toBe(200);
    expect(applied.json.composition.components).toHaveLength(4);
  }, 30000);

  it('generates after a saved default profile and honors newly saved hard exclusions', async () => {
    const scope = { householdId: HOUSE, userId: h.users[HOUSE] };
    await saveFamilyPreferences(h.db, scope, { expectedRevision: 0, preferences: {} });
    const saved = await generate();
    expect(saved.familyPreferenceFreshness).toBe('fresh');
    const forbidden = ['CHICKEN_EGG', 'CHICKEN', 'PORK_BELLY', 'SHRIMP', 'TOFU', 'BEEF'];
    await saveFamilyPreferences(h.db, scope, { expectedRevision: 1, preferences: { forbiddenIngredientIds: forbidden } });
    const restricted = await generate();
    const selected = restricted.compositions.compositions.flatMap((slot) => slot.components).filter((component) => component.recipeId);
    for (const component of selected) {
      const lines = h.db.query<{ingredient_id:string}>("SELECT ingredient_id FROM recipe_ingredients WHERE recipe_id='" + component.recipeId + "'");
      expect(lines.some((line) => forbidden.includes(line.ingredient_id))).toBe(false);
    }
    const blocked = await h.call(HOUSE, 'POST', '/meal-planning/plans/' + restricted.plan.id + '/slots/'
      + encodeURIComponent(restricted.compositions.compositions[0].slotId) + '/components',
      { revision: 1, target: { kind: 'recipe', recipeId: saved.compositions.compositions[0].components[0].recipeId! }, role: 'main', locked: true });
    expect(blocked.status).toBe(422); expect(blocked.json.code).toBe('HARD_CONSTRAINT_CONFLICT');
  }, 30000);
  it("counts another slot's manual foreign main toward Auto allowance and warns when a newer cap is below the preserved choice", async () => {
    const scope = { householdId: HOUSE, userId: h.users[HOUSE] };
    await saveFamilyPreferences(h.db, scope, { expectedRevision: 0,
      preferences: { internationalMealsPerWeek: 1, preferredCuisines: ['vietnamese', 'thai'] } });
    const created = await generate(); const first = created.compositions.compositions[0];
    const swapped = await h.call(HOUSE, 'POST', `/meal-planning/plans/${created.plan.id}/slots/${encodeURIComponent(first.slotId)}/components/${encodeURIComponent(first.components[0].id)}/swap`,
      { revision: 1, target: { kind: 'recipe', recipeId: 'gl-06' }, locked: true });
    expect(swapped.status, JSON.stringify(swapped.json)).toBe(200);
    const authority = (await resolveRecipeAuthority(h.env(), { tenantKey: HOUSE })).snapshot;
    const index = buildRoleIndex(authority.list());
    const blocked = authority.list().filter(recipe => recipe.cuisine === 'vietnamese' && index.get(recipe.id)?.roles.includes('main')).map(recipe => recipe.id);
    h.db.execute(`UPDATE member_ranking_preferences SET values_json = json_set(values_json,'$.values.neverRecommendRecipeIds',json(?))
      WHERE household_id = ? AND user_id = ?`, [JSON.stringify(blocked), HOUSE, h.users[HOUSE]]);
    const second = created.compositions.compositions[1];
    const auto = await h.call(HOUSE, 'POST', `/meal-planning/plans/${created.plan.id}/slots/${encodeURIComponent(second.slotId)}/auto`, { revision: 2, variant: 0 });
    expect(auto.status, JSON.stringify(auto.json)).toBe(200);
    expect(auto.json.options.length).toBeGreaterThan(0);
    expect(auto.json.options.every((option: { components: Array<{ role: string }> }) =>
      option.components.every(component => component.role !== 'main'))).toBe(true);
    await saveFamilyPreferences(h.db, scope, { expectedRevision: 1,
      preferences: { internationalMealsPerWeek: 0, preferredCuisines: ['vietnamese', 'thai'] } });
    const reread = FamilyMealPlanDtoSchema.parse((await call(HOUSE, 'GET', `/plans/${created.plan.id}`)).json);
    expect(reread.policy).toMatchObject({ internationalGeneratedMainCount: 0, lockedInternationalMainCount: 1 });
    expect(reread.compositions.compositions[0].components[0]).toMatchObject({ recipeId: 'gl-06', locked: true });
    expect(reread.compositions.compositions[0].warnings).toContain('PRESERVED_INTERNATIONAL_CAP_EXCEEDED');
    expect(reread.diagnostics.reasons).toContain('PRESERVED_INTERNATIONAL_CAP_EXCEEDED');
  }, 30000);

  it('does not infer the international cap from another slot with historical content', async () => {
    const scope = { householdId: HOUSE, userId: h.users[HOUSE] };
    await saveFamilyPreferences(h.db, scope, { expectedRevision: 0,
      preferences: { internationalMealsPerWeek: 1, preferredCuisines: ['vietnamese', 'thai'] } });
    const created = await generate();
    const [first, second] = created.compositions.compositions;
    const swapped = await h.call(HOUSE, 'POST', `/meal-planning/plans/${created.plan.id}/slots/${encodeURIComponent(first.slotId)}/components/${encodeURIComponent(first.components[0].id)}/swap`,
      { revision: 1, target: { kind: 'recipe', recipeId: 'gl-06' }, locked: true }, {},
      { Accept: 'application/json; recipe-content=1' });
    expect(swapped.status, JSON.stringify(swapped.json)).toBe(200);
    const foreign = swapped.json.composition.components.find((component: { role: string }) => component.role === 'main');
    const recipe = await readRecipeContentVersion(h.db, foreign.contentFingerprint);
    expect(recipe?.cuisine).not.toBe('vietnamese');
    const historical = await captureRecipeContentVersion(h.db, { ...recipe!, cuisine: 'vietnamese' });
    await grantRecipeContentAccess(h.db, HOUSE, historical);
    const secondMain = second.components.find((component) => component.role === 'main')!;
    await h.db.prepare('UPDATE generated_meal_plan_components SET recipe_id = ?, recipe_content_fingerprint = ? WHERE plan_id = ? AND id = ?')
      .bind(foreign.recipeId, foreign.contentFingerprint, created.plan.id, secondMain.id).run();
    const path = `/meal-planning/plans/${created.plan.id}/compositions`;
    const compatible = await h.call(HOUSE, 'GET', path);
    expect(compatible.status).toBe(200);
    expect(compatible.json.compositions[0].warnings).toContain('PRESERVED_INTERNATIONAL_CAP_EXCEEDED');
    await h.db.prepare('UPDATE generated_meal_plan_components SET recipe_content_fingerprint = ? WHERE plan_id = ? AND id = ?')
      .bind(historical, created.plan.id, secondMain.id).run();
    const read = await h.call(HOUSE, 'GET', path);
    expect(read.status, JSON.stringify(read.json)).toBe(200);
    expect(read.json.compositions[0].warnings).not.toContain('PRESERVED_INTERNATIONAL_CAP_EXCEEDED');
    expect(read.json.compositions[0].warnings).toContain('MEAL_TIME_UNKNOWN');
    expect(read.json.compositions[1].warnings).toContain('SAVED_CONTENT_REQUIRES_REVALIDATION');
  }, 30000);

  it('Auto returns distinct family meals, variants change selection, and a per-slot stock race rolls back the write', async () => {
    const created = await generate(); const slot = created.compositions.compositions[0];
    const path = '/meal-planning/plans/' + created.plan.id + '/slots/' + encodeURIComponent(slot.slotId);
    const auto = await h.call(HOUSE, 'POST', path + '/auto', { revision: 1, variant: 0 });
    expect(auto.status, JSON.stringify(auto.json)).toBe(200);
    const keys = (option: {components:Array<{recipeId:string|null;simpleFoodId:string|null}>}) => option.components.map((component) => component.recipeId ?? component.simpleFoodId).join('|');
    expect(auto.json.options.length).toBeGreaterThan(1);
    expect(new Set(auto.json.options.map(keys)).size).toBe(auto.json.options.length);
    const alternative = await h.call(HOUSE, 'POST', path + '/auto', { revision: 1, variant: 1 });
    expect(alternative.status).toBe(200); expect(keys(alternative.json.options[0])).not.toBe(keys(auto.json.options[0]));
    const initial = h.db.query('SELECT id, recipe_id, role FROM generated_meal_plan_components ORDER BY id');
    let mutate = true;
    h.db.hooks.beforeBatch = (statements) => {
      if (mutate && statements.some((statement) => statement.sql.includes('UPDATE generated_meal_plans'))) {
        mutate = false; h.db.seed("UPDATE inventory_items SET freshness='use_soon' WHERE household_id='family-house'");
      }
    };
    const rejected = await h.call(HOUSE, 'POST', path + '/auto/apply', { revision: 1, variant: 0, optionId: auto.json.options[0].optionId });
    expect(rejected.status, JSON.stringify(rejected.json)).toBe(409);
    expect(rejected.json.code).toBe('PLAN_REVALIDATION_REQUIRED');
    expect(h.db.query('SELECT revision FROM generated_meal_plans')[0].revision).toBe(1);
    expect(h.db.query('SELECT id, recipe_id, role FROM generated_meal_plan_components ORDER BY id')).toEqual(initial);
  }, 30000);

  it('rejects a family suggestion when stock changes between proposal recomputation and the mutation reload', async () => {
    const created = await generate(); const slot = created.compositions.compositions[0];
    const path = '/meal-planning/plans/' + created.plan.id + '/slots/' + encodeURIComponent(slot.slotId);
    const preview = await h.call(HOUSE, 'POST', path + '/assist', { revision: 1, action: 'regenerate_unlocked', variant: 0 });
    expect(preview.status).toBe(200);
    let mutate = true;
    h.db.hooks.beforeBatch = (statements) => {
      if (mutate && statements.some((statement) => statement.sql.includes('FROM generated_meal_plan_compositions composition'))) {
        mutate = false; h.db.seed("UPDATE inventory_items SET freshness='use_soon' WHERE household_id='family-house'");
      }
    };
    const applied = await h.call(HOUSE, 'POST', path + '/assist/apply', { revision: 1, action: 'regenerate_unlocked',
      variant: 0, proposalId: preview.json.proposal.optionId });
    expect(mutate).toBe(false);
    expect(applied.status, JSON.stringify(applied.json)).toBe(409); expect(applied.json.code).toBe('PROPOSAL_STALE');
    expect(h.db.query('SELECT revision FROM generated_meal_plans')[0].revision).toBe(1);
  }, 30000);

});
