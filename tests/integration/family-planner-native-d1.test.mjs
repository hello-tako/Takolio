import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { startLocalD1Worker } from '../helpers/local-d1-worker.mjs';

let worker;
const token = randomUUID();
const userId = 'native-family-user';
const householdId = 'native-family-household';
const session = randomUUID();
const origin = 'http://localhost';
const stockSql = 'SELECT id, quantity, unit, version FROM inventory_items ORDER BY id';

async function batch(statements) {
  const response = await worker.fetch(origin, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-token': token },
    body: JSON.stringify({ statements: statements.map(statement => typeof statement === 'string' ? { sql: statement } : statement) }),
  });
  expect(response.status).toBe(200);
  return (await response.json()).results.map(result => result.results);
}
async function call(method, path, body, key = randomUUID()) {
  const response = await worker.fetch(origin + path, {
    method, headers: {
      'Content-Type': 'application/json', Origin: origin,
      Cookie: `__Host-frigo_session=${session}`,
      'X-Frigo-Expected-User-Id': userId, 'X-Frigo-Expected-Household-Id': householdId,
      'Idempotency-Key': key,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  expect(response.status, JSON.stringify(result).slice(0, 300)).toBe(200);
  return result;
}
beforeAll(async () => {
  worker = await startLocalD1Worker({
    name: 'family-planner', token, script: 'tests/helpers/family-planner-d1-worker.mjs',
    databaseName: 'family-planner-isolated-test', databaseId: '00000000-0000-0000-0000-000000000044',
  });
  await worker.replayMigrations(expect);
  await batch([
    { sql: 'INSERT INTO users(id,email) VALUES (?,?)', values: [userId, 'native-family@example.invalid'] },
    { sql: 'INSERT INTO households(id,name,created_by) VALUES (?,?,?)', values: [householdId, 'Synthetic family', userId] },
    { sql: "INSERT INTO household_members(id,household_id,user_id,role) VALUES (?,?,?,'owner')", values: ['native-family-member', householdId, userId] },
    { sql: "INSERT INTO sessions_v2(id,user_id,household_id,token_hash,expires_at) VALUES (?,?,?,?,'2099-01-01')", values: ['native-family-session', userId, householdId, createHash('sha256').update(session).digest('hex')] },
    { sql: "INSERT INTO inventory_items(id,household_id,ingredient_id,name,quantity,unit,category,storage,version) VALUES (?,?,'RICE','Gạo',5000,'g','grain','pantry',1)", values: ['native-family-rice', householdId] },
  ]);
}, 120_000);
afterAll(async () => { await worker?.stop(); });

it('creates a full Vietnamese lunch/dinner week with native workerd/D1 and safely retrieves a lost response', async () => {
  expect((await batch(['SELECT count(*) AS count FROM recipes']))[0]).toEqual([{ count: 500 }]);
  const before = await batch([stockSql, 'SELECT id FROM inventory_events ORDER BY id']);
  const intent = {
    startDate: '2030-01-07', horizonDays: 7, defaultServings: 4, mode: 'shopping_allowed',
    slots: Array.from({ length: 14 }, (_, index) => ({
      date: new Date(Date.parse('2030-01-07') + Math.floor(index / 2) * 86_400_000).toISOString().slice(0, 10),
      mealType: index % 2 ? 'dinner' : 'lunch',
    })),
  };
  const key = randomUUID();
  const started = performance.now();
  const created = await call('POST', '/api/v2/meal-planning/plans', intent, key);
  const elapsed = performance.now() - started;
  expect(created.diagnostics).toMatchObject({ completeMealCount: 14, unplannedMealCount: 0, partialMealCount: 0, searchLimited: false });
  expect(created.policy.internationalGeneratedMainCount).toBe(0);
  expect(created.compositions.compositions).toHaveLength(14);
  for (const meal of created.compositions.compositions) {
    expect(meal.components.map(component => component.role)).toEqual(['main', 'vegetable', 'soup', 'staple']);
    expect(meal.missingRoles).toEqual([]);
  }
  const replay = await call('POST', '/api/v2/meal-planning/plans', intent, key);
  expect(replay.plan.id).toBe(created.plan.id);
  expect(replay.compositions).toEqual(created.compositions);
  const reloaded = await call('GET', `/api/v2/meal-planning/plans/${created.plan.id}`);
  expect(reloaded.compositions).toEqual(created.compositions);
  expect((await call('GET', '/api/v2/meal-planning/plans/current')).plan.plan.id).toBe(created.plan.id);
  expect((await batch(['SELECT count(*) AS count FROM generated_meal_plans']))[0]).toEqual([{ count: 1 }]);
  expect(await batch([stockSql, 'SELECT id FROM inventory_events ORDER BY id'])).toEqual(before);
  // A response budget, not a hosted latency claim. The pre-fix path exceeded it locally.
  expect(elapsed).toBeLessThan(8_000);
  process.stdout.write(`NATIVE_FAMILY_WEEK ${JSON.stringify({ slots: 14, milliseconds: Math.round(elapsed), catalog: 500, replay: true, stockUnchanged: true })}\n`);
}, 30_000);
