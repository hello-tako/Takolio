import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MealPlan } from '../../packages/domain/src';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { weekRoutes } from '../../src/worker/routes/week';
import type { AuthContext, Env } from '../../src/worker/types';
import { SESSION_COOKIE, sha256Hex } from '../../src/worker/utils/session';
import { backfillLegacyInventory } from '../../packages/db/src/inventory-truth';
import { executeInventoryAdoption } from '../../packages/db/src/inventory-adoption-executor';
import { serializeMealPlanSnapshot } from '../../src/worker/services/week-read';
import { createBarrier, SqliteD1 } from '../helpers/sqlite-d1';

const ORIGIN = 'https://swap-replay.example.test';
const HOUSE = 'swap-house';
const USER = 'swap-owner';
const PLAN = 'swap-plan';
const A = 'tomato-egg-stir-fry';
const B = 'oyakodon';
const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/', weekRoutes);
let db: SqliteD1;
let env: Env;
let cookie: string;
let plan: MealPlan;
let meal: string;
const puts: string[] = [];

async function request(path: string, body?: unknown, key?: string) {
  const response = await app.fetch(new Request(`${ORIGIN}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Cookie: cookie, Origin: ORIGIN, 'Content-Type': 'application/json',
      ...(key === undefined ? {} : { 'Idempotency-Key': key }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env);
  return { status: response.status, json: await response.json() as { plan: MealPlan; idempotentReplay?: boolean; code?: string; alternatives?: unknown[] } };
}
function swap(recipeId: string, key?: string) {
  return request(`/week/plans/${PLAN}/meals/${meal}/swap`, { recipeId, ...(key ? { commandId: key } : {}) }, key);
}
function state() {
  return Object.fromEntries(['meal_plans', 'meal_plan_days', 'meal_plan_slots', 'meal_plan_shopping_items',
    'meal_plan_days_v2', 'meal_plan_slots_v2', 'meal_plan_shopping_items_v2']
    .map((table) => [table, db.query(`SELECT * FROM ${table} ORDER BY id`)]));
}
function recipe(current: MealPlan) {
  return current.days.flatMap((day) => day.slots).find((slot) => slot.id === meal)?.recipe?.slug;
}
beforeEach(async () => {
  db = new SqliteD1();
  db.seed(`INSERT INTO users(id) VALUES ('${USER}'), ('swap-other');
    INSERT INTO households(id,name,created_by) VALUES ('${HOUSE}','Swap','${USER}'), ('swap-foreign','Other','swap-other');
    INSERT INTO household_members(id,household_id,user_id,role) VALUES
      ('swap-member','${HOUSE}','${USER}','owner'), ('swap-other-member','swap-foreign','swap-other','owner');
    INSERT INTO inventory_items(id,household_id,ingredient_id,name,quantity,unit,version)
      VALUES ('swap-eggs','${HOUSE}','CHICKEN_EGG','Eggs',6,'piece',1);`);
  const token = 'synthetic-week-swap-session';
  db.execute(`INSERT INTO sessions_v2(id,user_id,household_id,token_hash,expires_at)
    VALUES ('swap-session',?,?,?,'2099-01-01T00:00:00Z')`, [USER, HOUSE, await sha256Hex(token)]);
  cookie = `${SESSION_COOKIE}=${token}`;
  puts.length = 0;
  const values = new Map<string, string>();
  env = { DB: db, APP_URL: ORIGIN, ENVIRONMENT: 'test', WEEK_SCHEMA_MODE: 'legacy', CACHE: {
    get: async (key: string) => values.get(key) ?? null,
    put: async (key: string, value: string) => { puts.push(key); values.set(key, value); },
    delete: async (key: string) => { values.delete(key); },
  } as unknown as NonNullable<Env['CACHE']> };
  const created = await request('/week/plans', { planId: PLAN, startDate: '2030-01-02', householdSize: 2,
    mealSlotsPreset: 'dinner_only', priorities: ['use_fridge'], shoppingFrequency: 'once' });
  expect(created.status).toBe(201);
  plan = created.json.plan;
  meal = plan.days.flatMap((day) => day.slots).find((slot) => slot.recipe)!.id;
});
afterEach(() => db.close());

describe('WKD02 actual Hono + SQLite keyed swap replay', () => {
  it('replays A after B as current B without relational or plan-cache writes', async () => {
    expect((await swap(A, 'swap-key-A')).status).toBe(200);
    expect((await swap(B, 'swap-key-B')).status).toBe(200);
    const before = state();
    const receipts = db.query('SELECT * FROM week_swap_receipts');
    puts.length = 0;
    const replay = await swap(A, 'swap-key-A');
    expect(replay.status).toBe(200);
    expect(recipe(replay.json.plan)).toBe(B);
    expect(replay.json.idempotentReplay).toBe(true);
    expect(state()).toEqual(before);
    expect(db.query('SELECT * FROM week_swap_receipts')).toEqual(receipts);
    expect(puts.filter((key) => !key.startsWith('rl_swap:') && !key.startsWith('rl_week_w:'))).toEqual([]);
  });
  it('reads current state after receipt lookup when another swap commits between ownership and receipt reads', async () => {
    expect((await swap(A, 'swap-key-A')).status).toBe(200);
    let afterB: ReturnType<typeof state> | undefined;
    db.hooks.beforeStatement = async ({ sql }) => {
      if (!sql.includes('SELECT fingerprint FROM week_swap_receipts')) return;
      db.hooks = {};
      expect((await swap(B, 'swap-key-B')).status).toBe(200);
      afterB = state();
      puts.length = 0;
    };
    const replay = await swap(A, 'swap-key-A');
    expect(replay).toMatchObject({ status: 200, json: { idempotentReplay: true } });
    expect(recipe(replay.json.plan)).toBe(B);
    expect(state()).toEqual(afterB);
    expect(puts.every((key) => key.startsWith('rl_swap:') || key.startsWith('rl_week_w:'))).toBe(true);
  });

  it('rejects a conflicting receipt before hydrating legacy rows or consulting the catalog', async () => {
    expect((await swap(A, 'swap-key-A')).status).toBe(200);
    db.execute('UPDATE meal_plans SET snapshot_json = NULL WHERE id = ?', [PLAN]);
    db.execute('UPDATE meal_plan_slots SET snapshot_json = NULL WHERE plan_id = ?', [PLAN]);
    env.RECIPE_CATALOG_MODE = 'invalid-after-acceptance';
    const queries: string[] = [];
    db.hooks.beforeStatement = ({ sql }) => { queries.push(sql); };
    puts.length = 0;
    expect(await swap(B, 'swap-key-A')).toMatchObject({ status: 409, json: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(queries.some((sql) => /FROM (?:recipes|recipe_|inventory_|meal_plan_(?:days|slots|shopping_items))/i.test(sql))).toBe(false);
    expect(puts.every((key) => key.startsWith('rl_swap:') || key.startsWith('rl_week_w:'))).toBe(true);
  });

  it.each([
    [{ recipeId: B, commandId: 'swap-key-A', idempotencyKey: 'swap-key-B' }, 'swap-key-A', 409],
    [{ recipeId: B, commandId: 'swap-key-A', idempotencyKey: 'swap-key-A' }, 'swap-key-B', 409],
    [{ recipeId: B, commandId: 'short' }, undefined, 400],
    [{ recipeId: B }, 'short', 409],
    [{ recipeId: B }, '', 409],
  ])('rejects invalid/mismatched supplied keys without writes (%j)', async (body, key, status) => {
    const before = state();
    puts.length = 0;
    const response = await request(`/week/plans/${PLAN}/meals/${meal}/swap`, body, key);
    expect(response.status).toBe(status);
    expect(state()).toEqual(before);
    expect(db.query('SELECT * FROM week_swap_receipts')).toEqual([]);
    expect(puts.every((key) => key.startsWith('rl_swap:') || key.startsWith('rl_week_w:'))).toBe(true);
  });

  it('rejects changed recipe tokens for the exact tuple and accepts equal normalized keys', async () => {
    const accepted = await request(`/week/plans/${PLAN}/meals/${meal}/swap`,
      { recipeId: ` ${A} `, commandId: ' swap-key-A ', idempotencyKey: 'swap-key-A' }, 'swap-key-A');
    expect(accepted.status).toBe(200);
    const before = state();
    const receipts = db.query('SELECT * FROM week_swap_receipts');
    puts.length = 0;
    expect(await swap(B, 'swap-key-A')).toMatchObject({ status: 409, json: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(state()).toEqual(before);
    expect(db.query('SELECT * FROM week_swap_receipts')).toEqual(receipts);
    expect(puts.every((key) => key.startsWith('rl_swap:') || key.startsWith('rl_week_w:'))).toBe(true);
  });

  it('retains keyless writes and receipt-free alternatives; scope includes each meal', async () => {
    expect((await swap(A)).status).toBe(200);
    expect((await request(`/week/plans/${PLAN}/meals/${meal}/swap`, {})).json.alternatives).toBeInstanceOf(Array);
    expect(db.query('SELECT * FROM week_swap_receipts')).toEqual([]);
    expect((await swap(B, 'swap-key-A')).status).toBe(200);
    const another = plan.days.flatMap((day) => day.slots).find((slot) => slot.id !== meal)!.id;
    expect((await request(`/week/plans/${PLAN}/meals/${another}/swap`, { recipeId: A }, 'swap-key-A')).status).toBe(200);
    expect(db.query('SELECT * FROM week_swap_receipts')).toHaveLength(2);
  });

  it('replays retired recipe and replaced slot without catalog/inventory reads or writes', async () => {
    expect((await swap(A, 'swap-key-A')).status).toBe(200);
    const accepted = (await request(`/week/plans/${PLAN}`)).json.plan;
    const replacement = structuredClone(accepted);
    for (const day of replacement.days) for (const slot of day.slots) if (slot.id === meal) slot.id = 'replacement-slot';
    db.execute('UPDATE meal_plan_slots SET id = ? WHERE id = ?', ['replacement-slot', meal]);
    db.execute('UPDATE meal_plans SET snapshot_json = ? WHERE id = ?', [serializeMealPlanSnapshot(replacement), PLAN]);
    db.execute("UPDATE recipes SET verification_state = 'rejected' WHERE slug = ?", [A]);
    env.RECIPE_CATALOG_MODE = 'invalid-after-retirement';
    const queries: string[] = [];
    db.hooks.beforeStatement = ({ sql }) => { queries.push(sql); };
    const before = state();
    puts.length = 0;
    const replay = await swap(A, 'swap-key-A');
    expect(replay).toMatchObject({ status: 200, json: { plan: replacement, idempotentReplay: true } });
    expect(state()).toEqual(before);
    expect(await swap(B, 'swap-key-A')).toMatchObject({ status: 409, json: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(queries.filter((sql) => /FROM (?:recipes|recipe_|inventory_)/i.test(sql))).toEqual([]);
    expect(puts.every((key) => key.startsWith('rl_swap:') || key.startsWith('rl_week_w:'))).toBe(true);
  });

  it('does not resurrect deleted plans or expose receipts to another household or removed member', async () => {
    expect((await swap(A, 'swap-key-A')).status).toBe(200);
    const receipt = db.query('SELECT * FROM week_swap_receipts');
    db.execute('UPDATE sessions_v2 SET household_id = ?, user_id = ? WHERE id = ?', ['swap-foreign', 'swap-other', 'swap-session']);
    expect((await swap(A, 'swap-key-A')).status).toBe(404);
    expect(db.query('SELECT * FROM week_swap_receipts')).toEqual(receipt);
    db.execute('UPDATE sessions_v2 SET household_id = ?, user_id = ? WHERE id = ?', [HOUSE, USER, 'swap-session']);
    db.execute('DELETE FROM household_members WHERE household_id = ? AND user_id = ?', [HOUSE, USER]);
    expect((await swap(A, 'swap-key-A')).status).toBe(403);
    db.seed(`INSERT INTO household_members(id,household_id,user_id,role) VALUES ('swap-member','${HOUSE}','${USER}','owner')`);
    db.execute('DELETE FROM meal_plans WHERE id = ?', [PLAN]);
    expect((await swap(A, 'swap-key-A')).status).toBe(404);
    expect(db.query('SELECT * FROM week_swap_receipts')).toEqual(receipt);
    expect(db.query('SELECT * FROM meal_plans WHERE id = ?', PLAN)).toEqual([]);
  });

  it.each([['legacy', 'receipt'], ['legacy', 'children'], ['dual', 'receipt'], ['dual', 'children']] as const)('rolls back receipt and all %s plan rows on %s-stage batch failure', async (week, stage) => {
    env.WEEK_SCHEMA_MODE = week;
    const before = state();
    db.seed(stage === 'receipt'
      ? `CREATE TRIGGER fail_swap AFTER INSERT ON week_swap_receipts BEGIN SELECT RAISE(ABORT, 'fixture after receipt'); END`
      : `CREATE TRIGGER fail_swap AFTER DELETE ON meal_plan_slots BEGIN SELECT RAISE(ABORT, 'fixture after children'); END`);
    puts.length = 0;
    expect((await swap(A, 'swap-key-A')).status).toBe(503);
    expect(state()).toEqual(before);
    expect(db.query('SELECT * FROM week_swap_receipts')).toEqual([]);
    expect(puts.every((key) => key.startsWith('rl_swap:') || key.startsWith('rl_week_w:'))).toBe(true);
  });

  it.each([['legacy', false], ['legacy', true], ['dual', false], ['dual', true]] as const)('commits one atomic winner for deterministic %s twins (different=%s)', async (week, different) => {
    env.WEEK_SCHEMA_MODE = week;
    const barrier = createBarrier(2);
    const batches: string[][] = [];
    let committed = 0;
    db.hooks = {
      beforeBatch: async (statements) => {
        if (statements.some(({ sql }) => sql.includes('INSERT INTO week_swap_receipts'))) {
          batches.push(statements.map(({ sql }) => sql));
          await barrier.wait();
        }
      },
      afterBatch: () => { committed += 1; },
    };
    puts.length = 0;
    const results = await Promise.all([swap(A, 'swap-key-A'), swap(different ? B : A, 'swap-key-A')]);
    expect(barrier.arrivals).toBe(2);
    expect(committed).toBe(1);
    expect(batches).toHaveLength(2);
    expect(batches.every((sql) => sql[0].includes('INSERT INTO week_swap_receipts'))).toBe(true);
    expect(results.map((result) => result.status).sort()).toEqual(different ? [200, 409] : [200, 200]);
    expect(results.filter((result) => result.json.idempotentReplay)).toHaveLength(different ? 0 : 1);
    const receipt = db.query<{ fingerprint: string }>('SELECT * FROM week_swap_receipts');
    expect(receipt).toHaveLength(1);
    expect(puts.filter((key) => key.startsWith('plan_'))).toEqual([`plan_active_${HOUSE}`, `plan_${PLAN}`]);
    const current = (await request(`/week/plans/${PLAN}`)).json.plan;
    expect(recipe(current)).toBe(receipt[0].fingerprint);
    expect(puts.filter((key) => key === `plan_active_${HOUSE}`)).toHaveLength(1);
    // The GET above publishes its read cache; only the winning command publishes active state.
  });

  it('recovers committed acceptance after batch response loss and plan KV failure', async () => {
    env.CACHE = { get: async () => null, put: async (key: string) => { if (key.startsWith('plan_')) throw new Error('Synthetic KV outage'); },
      delete: async () => {} } as unknown as NonNullable<Env['CACHE']>;
    db.hooks.afterBatch = () => { throw new Error('Synthetic response loss after commit'); };
    const accepted = await swap(A, 'swap-key-A');
    expect(accepted).toMatchObject({ status: 200, json: { idempotentReplay: true } });
    db.hooks = {};
    expect(db.query('SELECT * FROM week_swap_receipts')).toHaveLength(1);
    const before = state();
    expect(await swap(A, 'swap-key-A')).toMatchObject({ status: 200, json: { idempotentReplay: true } });
    expect(state()).toEqual(before);
  });

  it('retains successful acceptance when post-commit plan cache publication fails', async () => {
    const attempts: string[] = [];
    env.CACHE = { get: async () => null, put: async (key: string) => {
      attempts.push(key);
      if (key.startsWith('plan_')) throw new Error('Synthetic publication outage');
    }, delete: async () => {} } as unknown as NonNullable<Env['CACHE']>;
    const accepted = await swap(A, 'swap-key-A');
    expect(accepted.status).toBe(200);
    expect(accepted.json.idempotentReplay).toBeUndefined();
    expect(recipe(accepted.json.plan)).toBe(A);
    expect(attempts.filter((key) => key.startsWith('plan_'))).toEqual([`plan_active_${HOUSE}`]);
    const rows = state();
    const receipts = db.query('SELECT * FROM week_swap_receipts');
    attempts.length = 0;
    expect(await swap(A, 'swap-key-A')).toMatchObject({ status: 200, json: { idempotentReplay: true } });
    expect(state()).toEqual(rows);
    expect(db.query('SELECT * FROM week_swap_receipts')).toEqual(receipts);
    expect(attempts.every((key) => key.startsWith('rl_swap:') || key.startsWith('rl_week_w:'))).toBe(true);
  });

  it.each([
    ['legacy', 'legacy'], ['dual', 'legacy'], ['legacy', 'native'], ['dual', 'native'],
  ] as const)('preserves every inventory byte through generate/read/swaps in %s Week / %s inventory', async (week, inventoryMode) => {
    env.WEEK_SCHEMA_MODE = week;
    if (inventoryMode === 'native') {
      await backfillLegacyInventory(db, HOUSE);
      await executeInventoryAdoption(db, { householdId: HOUSE, actorId: USER }, {});
    }
    const inventory = () => Object.fromEntries(['households', 'inventory_items', 'inventory_lots', 'inventory_commands',
      'inventory_events', 'inventory_adoption_receipts', 'storage_locations'].map((table) => [table, db.query(`SELECT * FROM ${table} ORDER BY id`)]));
    const before = inventory();
    const created = await request('/week/plans', { planId: `matrix-${week}-${inventoryMode}`, startDate: '2030-01-02',
      householdSize: 2, mealSlotsPreset: 'dinner_only', priorities: ['use_fridge'], shoppingFrequency: 'once' });
    expect(created.status).toBe(201);
    plan = created.json.plan;
    const target = plan.days.flatMap((day) => day.slots).find((slot) => slot.recipe)!.id;
    const route = `/week/plans/${plan.id}/meals/${target}/swap`;
    expect((await request(route, { recipeId: A }, 'matrix-key-A')).status).toBe(200);
    expect((await request(route, { recipeId: B }, 'matrix-key-B')).status).toBe(200);
    const rows = state();
    expect((await request(route, { recipeId: A }, 'matrix-key-A')).json.idempotentReplay).toBe(true);
    expect((await request(`/week/plans/${plan.id}`)).status).toBe(200);
    expect(state()).toEqual(rows);
    expect(inventory()).toEqual(before);
    expect(db.query('SELECT * FROM meal_plan_slots_v2 WHERE plan_id = ?', plan.id).length > 0).toBe(week === 'dual');
  });
});
