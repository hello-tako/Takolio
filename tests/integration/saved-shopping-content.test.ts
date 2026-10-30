import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MealPlanDtoSchema } from '../../packages/domain/src/meal-planning-api';
import { ShoppingContributionSchema, type ShoppingContribution } from '../../packages/domain/src/shopping-plan-api';
import { captureRecipeContentVersion, grantRecipeContentAccess, readHouseholdRecipeContentVersion } from '../../src/worker/services/recipe-content-versions';
import { quietLogs, T20Harness, T20_INTENT } from '../helpers/t20-composition-harness';

const house = 'saved-shopping';
const capability = { Accept: 'application/json; recipe-content=1' };
const legacyContribution = ShoppingContributionSchema.omit({ contentFingerprint: true }).strict();
let h: T20Harness;
beforeEach(async () => {
  quietLogs(); h = new T20Harness();
  await h.seedHousehold(house, []);
});
afterEach(() => { h.close(); vi.restoreAllMocks(); });
async function generate() {
  const response = await h.call(house, 'POST', '/meal-planning/plans', T20_INTENT, {}, capability);
  expect(response.status, JSON.stringify(response.json)).toBe(200);
  return MealPlanDtoSchema.parse(response.json);
}
const trip = (plan: { id: string; revision: number }) => ({ planId: plan.id, expectedRevision: plan.revision,
  startDate: '2030-01-02', endDate: '2030-01-08' });
const share = (input: ReturnType<typeof trip>, key: string) => h.call(house, 'POST', '/shopping-list/from-plan', input, {}, { 'Idempotency-Key': key });
function persisted() {
  return h.db.query<{ contributions_json: string }>('SELECT contributions_json FROM shopping_plan_demands ORDER BY demand_key')
    .flatMap(row => ShoppingContributionSchema.array().parse(JSON.parse(row.contributions_json)));
}
function contributions(list: { items: { contributions: ShoppingContribution[] }[]; unresolvedItems: { contributions: ShoppingContribution[] }[] }) {
  return [...list.items, ...list.unresolvedItems].flatMap(row => row.contributions);
}
function facts() {
  return ['shopping_plan_demands', 'shopping_items', 'shopping_plan_commands', 'inventory_items', 'inventory_events']
    .map(table => h.db.query(`SELECT * FROM ${table} ORDER BY rowid`));
}

it.each(['static', 'd1'] as const)('retains exact %s pins through persistence and negotiated shopping reads', async mode => {
  h.mode = mode;
  const plan = await generate(); const before = facts().slice(3);
  expect((await share(trip(plan), 'saved-shopping-share')).status).toBe(200);
  const saved = persisted(); expect(saved.length).toBeGreaterThan(0);
  for (const contribution of saved) {
    const meal = plan.result.meals.find(row => row.slotId === contribution.slotId)!;
    expect(contribution.contentFingerprint).toBe(meal.contentFingerprint);
    expect((await readHouseholdRecipeContentVersion(h.db, house, contribution.contentFingerprint!))?.id).toBe(contribution.recipeId);
  }
  const modern = await h.call(house, 'GET', '/shopping-list', undefined, {}, capability);
  expect(modern.status, JSON.stringify(modern.json)).toBe(200);
  expect(contributions(modern.json)).toHaveLength(saved.length);
  expect(contributions(modern.json).every(row => /^[a-f0-9]{64}$/.test(row.contentFingerprint!))).toBe(true);
  const legacy = await h.call(house, 'GET', '/shopping-list');
  expect(legacy.status).toBe(200);
  expect(contributions(legacy.json)).toEqual(contributions(modern.json).map(({ contentFingerprint: _pin, ...row }) => legacyContribution.parse(row)));
  expect(facts().slice(3)).toEqual(before);
}, 30_000);

it('preserves a shared version after historical selection changes, rejects recalculation and replays its original receipt', async () => {
  const plan = await generate(); const input = trip(plan);
  const shared = await share(input, 'saved-share-replay'); expect(shared.status).toBe(200);
  const before = facts(); const original = persisted();
  const row = h.db.query<{ result_json: string }>('SELECT result_json FROM generated_meal_plans WHERE id=?', plan.id)[0];
  const stored = JSON.parse(row.result_json);
  const meal = stored.data.result.meals[0];
  const recipe = await readHouseholdRecipeContentVersion(h.db, house, meal.contentFingerprint);
  const pin = await captureRecipeContentVersion(h.db, { ...recipe!, title: 'Synthetic historical shopping content' });
  await grantRecipeContentAccess(h.db, house, pin);
  meal.contentFingerprint = pin;
  h.db.execute('UPDATE generated_meal_plans SET result_json=? WHERE id=?', [JSON.stringify(stored), plan.id]);
  const rejected = await share(input, 'saved-share-new-command');
  expect(rejected.status, JSON.stringify(rejected.json)).toBe(409);
  expect(rejected.json.code).toBe('COMPOSITION_REVALIDATION_REQUIRED');
  expect(facts()).toEqual(before);
  const read = await h.call(house, 'GET', '/shopping-list', undefined, {}, capability);
  expect(read.status).toBe(200);
  expect(contributions(read.json)).toHaveLength(original.length);
  expect(persisted()).toEqual(original);
  const replay = await share(input, 'saved-share-replay');
  expect(replay.status, JSON.stringify(replay.json)).toBe(200);
  expect(replay.json).toEqual({ ...shared.json, idempotentReplay: true });
  expect(facts()).toEqual(before);
}, 30_000);

it('retains unknown legacy contribution identity without inferring current history', async () => {
  const plan = await generate();
  const row = h.db.query<{ result_json: string }>('SELECT result_json FROM generated_meal_plans WHERE id=?', plan.id)[0];
  const stored = JSON.parse(row.result_json);
  for (const meal of stored.data.result.meals) delete meal.contentFingerprint;
  h.db.execute('UPDATE generated_meal_plans SET result_json=? WHERE id=?', [JSON.stringify(stored), plan.id]);
  expect((await share(trip(plan), 'saved-share-legacy')).status).toBe(200);
  expect(persisted().length).toBeGreaterThan(0);
  expect(persisted().every(row => row.contentFingerprint === null)).toBe(true);
  for (const row of h.db.query<{ source_id: string; demand_key: string; contributions_json: string }>('SELECT * FROM shopping_plan_demands')) {
    const entries = JSON.parse(row.contributions_json).map(({ contentFingerprint: _pin, ...entry }: ShoppingContribution) => entry);
    h.db.execute('UPDATE shopping_plan_demands SET contributions_json=? WHERE source_id=? AND demand_key=?', [JSON.stringify(entries), row.source_id, row.demand_key]);
  }
  const legacy = await h.call(house, 'GET', '/shopping-list', undefined, {}, capability);
  expect(legacy.status).toBe(200);
  expect(contributions(legacy.json).every(row => row.contentFingerprint === undefined)).toBe(true);
}, 30_000);
