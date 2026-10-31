import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { MealPlanDtoSchema, PlanShoppingDtoSchema } from '../../packages/domain/src/meal-planning-api';
import { quietLogs, T20Harness, T20_INTENT, type Mode } from '../helpers/t20-composition-harness';
import { SqliteD1 } from '../helpers/sqlite-d1';

vi.mock('../../src/worker/services/email', () => ({ sendEmail: vi.fn(), buildOtpEmail: vi.fn() }));
let harness: T20Harness | undefined;
afterEach(() => { harness?.close(); vi.restoreAllMocks(); });

it.each(['static', 'd1'] as Mode[])('flag OFF keeps %s V1 planning/shopping/regenerate independent of unapplied 0039', async (mode) => {
  quietLogs();
  const h = harness = new T20Harness();
  h.db.close();
  h.db = new SqliteD1({ through: '0038_auth_onboarding_completion.sql' });
  // Content retention is required independently of the optional composition schema.
  h.db.seed(readFileSync('migrations/0046_recipe_content_versions.sql', 'utf8'));
  h.mode = mode;
  h.extraEnv = { MEAL_COMPOSITION_V2_ENABLED: 'false' };
  await h.seedHousehold('t20-no-schema');
  expect(h.db.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('generated_meal_plan_compositions', 'generated_meal_plan_components', 'recipe_role_assignments')")).toEqual([]);
  const statements: string[] = [];
  h.db.hooks.beforeStatement = (event) => { statements.push(event.sql); };
  h.db.hooks.beforeBatch = (batch) => { statements.push(...batch.map((event) => event.sql)); };
  const created = await h.call('t20-no-schema', 'POST', '/meal-planning/plans', T20_INTENT);
  expect(created.status, JSON.stringify(created.json)).toBe(200);
  const plan = MealPlanDtoSchema.parse(created.json);
  const get = await h.call('t20-no-schema', 'GET', `/meal-planning/plans/${plan.id}`);
  expect(MealPlanDtoSchema.parse(get.json).result).toEqual(plan.result);
  const shopping = await h.call('t20-no-schema', 'POST', `/meal-planning/plans/${plan.id}/shopping`, { revision: plan.revision, currency: 'VND' });
  expect(shopping.status, JSON.stringify(shopping.json)).toBe(200);
  expect(PlanShoppingDtoSchema.parse(shopping.json).planRevision).toBe(plan.revision);
  const regenerate = await h.call('t20-no-schema', 'POST', `/meal-planning/plans/${plan.id}/regenerate`, { revision: plan.revision });
  expect(regenerate.status, JSON.stringify(regenerate.json)).toBe(200);
  expect(MealPlanDtoSchema.parse(regenerate.json).revision).toBe(plan.revision + 1);
  const composition = await h.call('t20-no-schema', 'GET', `/meal-planning/plans/${plan.id}/compositions`);
  expect(composition.status).toBe(404);
  expect(statements.join('\n')).not.toMatch(/generated_meal_plan_compositions|generated_meal_plan_components|recipe_role_assignments/);
}, 30_000);

it.each(['static', 'd1'] as Mode[])('rejects %s V1 selection without required content storage and preserves user data', async (mode) => {
  quietLogs();
  const h = harness = new T20Harness();
  h.db.close();
  h.db = new SqliteD1({ through: '0038_auth_onboarding_completion.sql' });
  h.mode = mode;
  h.extraEnv = { MEAL_COMPOSITION_V2_ENABLED: 'false' };
  await h.seedHousehold('v1-missing-content');
  const stock = h.db.query('SELECT id, quantity, version FROM inventory_items ORDER BY id');
  const events = h.db.query('SELECT id FROM inventory_events ORDER BY id');
  const response = await h.call('v1-missing-content', 'POST', '/meal-planning/plans', T20_INTENT);
  expect(response.status).toBe(500);
  expect(response.json.code).toBe('MEAL_PLANNING_UNAVAILABLE');
  expect(h.db.query('SELECT id FROM generated_meal_plans')).toEqual([]);
  expect(h.db.query('SELECT id, quantity, version FROM inventory_items ORDER BY id')).toEqual(stock);
  expect(h.db.query('SELECT id FROM inventory_events ORDER BY id')).toEqual(events);
}, 30_000);
