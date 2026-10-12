import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MealPlan } from '../../packages/domain/src';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { weekRoutes } from '../../src/worker/routes/week';
import type { AuthContext, Env } from '../../src/worker/types';
import { SESSION_COOKIE, sha256Hex } from '../../src/worker/utils/session';
import { SqliteD1 } from '../helpers/sqlite-d1';

const origin = 'https://week-contract.example';
let db: SqliteD1;
let env: Env;
let cookie: string;
const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/api/v1', weekRoutes);
beforeEach(async () => {
  db = new SqliteD1();
  db.seed(`INSERT INTO users(id) VALUES ('contract-owner'), ('contract-foreign');
    INSERT INTO households(id,name,created_by) VALUES
      ('contract-home','Contract','contract-owner'), ('contract-other','Other','contract-foreign');
    INSERT INTO household_members(id,household_id,user_id,role) VALUES
      ('contract-member','contract-home','contract-owner','owner'),
      ('contract-other-member','contract-other','contract-foreign','owner');`);
  const token = 'private-synthetic-week-contract';
  db.execute(`INSERT INTO sessions_v2(id,user_id,household_id,token_hash,expires_at)
    VALUES ('contract-session','contract-owner','contract-home',?,'2099-01-01T00:00:00Z')`, [await sha256Hex(token)]);
  cookie = `${SESSION_COOKIE}=${token}`;
  env = { DB: db, APP_URL: origin, ENVIRONMENT: 'test', WEEK_SCHEMA_MODE: 'legacy' };
});
afterEach(() => db.close());
async function request(path: string, body?: unknown) {
  return app.fetch(new Request(`${origin}/api/v1${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) }), env);
}
async function create() {
  const response = await request('/week/plans', { planId: 'contract-plan', startDate: '2030-01-02',
    householdSize: 2, mealSlotsPreset: 'dinner_only', priorities: ['use_fridge'], shoppingFrequency: 'once' });
  expect(response.status).toBe(201);
  return (await response.json() as { plan: MealPlan }).plan;
}
describe('B07 legacy Week read contract before and after extraction', () => {
  it('keeps snapshot bodies exact after inventory changes with bounded D1 queries', async () => {
    const expected = await create();
    db.execute(`INSERT INTO inventory_items(id,household_id,name,quantity,unit,version)
      VALUES ('late-stock','contract-home','Late stock',99,'piece',1)`);
    const queries: string[] = [];
    db.hooks.beforeStatement = ({ sql }) => { if (sql.includes('FROM meal_plan')) queries.push(sql); };
    const byId = await request('/week/plans/contract-plan');
    expect(byId.status).toBe(200);
    expect(byId.headers.get('Cache-Control')).toBe('no-store');
    expect(await byId.json()).toEqual({ plan: expected });
    expect(queries).toHaveLength(1);
    queries.length = 0;
    const current = await request('/week/current');
    expect(current.status).toBe(200);
    expect(await current.json()).toEqual({ plan: expected });
    expect(queries).toHaveLength(2);
  });
  it('does not read cached missing or foreign plans', async () => {
    const cached = await create();
    db.execute("DELETE FROM meal_plans WHERE id = 'contract-plan'");
    db.execute(`INSERT INTO meal_plans(id,household_id,start_date,end_date,snapshot_json)
      VALUES ('contract-plan','contract-other','2030-01-02','2030-01-08',?)`,
      [JSON.stringify({ version: 1, plan: { ...cached, householdId: 'contract-other' } })]);
    let reads = 0;
    env.CACHE = { get: async () => { reads++; return JSON.stringify(cached); }, put: async () => {}, delete: async () => {} } as unknown as NonNullable<Env['CACHE']>;
    const response = await request('/week/plans/contract-plan');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
    expect(await (await request('/week/current')).json()).toEqual({ plan: null });
    expect(reads).toBe(0);
  });
  it('hydrates legacy child snapshots in four queries without per-slot reads', async () => {
    const expected = await create();
    db.execute("UPDATE meal_plans SET snapshot_json = NULL WHERE id = 'contract-plan'");
    const queries: string[] = [];
    db.hooks.beforeStatement = ({ sql }) => { if (sql.includes('FROM meal_plan')) queries.push(sql); };
    const response = await request('/week/plans/contract-plan');
    expect(response.status).toBe(200);
    const actual = (await response.json() as { plan: MealPlan }).plan;
    expect(actual.id).toBe(expected.id);
    expect(actual.days.map((day) => day.slots)).toEqual(expected.days.map((day) => day.slots.map((slot) => ({ ...slot, isLocked: false, isLeftover: false }))));
    expect(actual.shoppingItems).toEqual(expected.shoppingItems.map((item) => ({ ...item,
      id: `shop_contract-plan_${item.ingredientId}`, cannotBuy: false })));
    expect(queries).toHaveLength(4);
  });
  it('preserves successful reads when cache publication fails and fails closed for D1 errors', async () => {
    const expected = await create();
    env.CACHE = { get: async () => null, delete: async () => {}, put: async () => { throw new Error('Synthetic cache outage'); } } as unknown as NonNullable<Env['CACHE']>;
    expect(await (await request('/week/plans/contract-plan')).json()).toEqual({ plan: expected });
    db.hooks.beforeStatement = ({ sql }) => { if (sql.includes('FROM meal_plans')) throw new Error('Synthetic D1 outage'); };
    const failed = await request('/week/plans/contract-plan');
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' });
  });
});
