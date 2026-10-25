import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MealPlan } from '../../packages/domain/src';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { authRoutes } from '../../src/worker/routes/auth';
import { inventoryRoutes } from '../../src/worker/routes/inventory';
import { shoppingRoutes } from '../../src/worker/routes/shopping';
import { weekRoutes } from '../../src/worker/routes/week';
import type { AuthContext, Env } from '../../src/worker/types';
import { SESSION_COOKIE, sha256Hex } from '../../src/worker/utils/session';
import { SqliteD1 } from '../helpers/sqlite-d1';

vi.mock('cloudflare:email', () => ({ EmailMessage: class {} }));

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const scope = { userId: 'week-loss-owner', householdId: 'week-loss-home' };
const origin = 'https://week-loss.example.test';
const token = 'synthetic-week-loss-cookie';
const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/api/v1', authRoutes);
app.route('/api/v1', inventoryRoutes);
app.route('/api/v1', shoppingRoutes);
app.route('/api/v1', weekRoutes);
const OUTBOX = 'frigo_sync_outbox_v1';
const CACHE = `frigo_cache_v2:${scope.userId}:${scope.householdId}:active_meal_plan`;
const A = 'tomato-egg-stir-fry', B = 'oyakodon';
async function loadClient() {
  const { api } = await import('../../src/web/services/api');
  const sync = await import('../../src/web/lib/sync');
  const { queryClient } = await import('../../src/web/lib/query-client');
  queryClient.setDefaultOptions({ queries: { retry: false, gcTime: Infinity, networkMode: 'always' } });
  return { api, sync, queryClient };
}
let client: Awaited<ReturnType<typeof loadClient>>;
let db: SqliteD1;
let env: Env;
let plan: MealPlan;
let mealId: string;
let path: string;
const puts: string[] = [];
const facts = () => Object.fromEntries(['meal_plans', 'meal_plan_days', 'meal_plan_slots', 'meal_plan_shopping_items',
  'meal_plan_days_v2', 'meal_plan_slots_v2', 'meal_plan_shopping_items_v2', 'week_swap_receipts',
  'inventory_items', 'inventory_lots', 'inventory_commands', 'inventory_events']
  .map((table) => [table, db.query(`SELECT * FROM ${table} ORDER BY id`)]));
const selected = (current: MealPlan) => current.days.flatMap((day) => day.slots).find((slot) => slot.id === mealId)?.recipe?.slug;
async function server(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cookie', `${SESSION_COOKIE}=${token}`);
  headers.set('Origin', origin);
  return app.fetch(new Request(new URL(input, origin), { ...init, headers }), env);
}
async function post(route: string, body: unknown, key?: string) {
  return server(`/api/v1${route}`, { method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) } });
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  vi.stubGlobal('window', new EventTarget());
  localStorage.setItem('frigo_user_id', scope.userId);
  localStorage.setItem('frigo_household_id', scope.householdId);
  db = new SqliteD1();
  db.execute('INSERT INTO users(id) VALUES (?)', [scope.userId]);
  db.execute('INSERT INTO households(id,name,created_by) VALUES (?,?,?)', [scope.householdId, 'Response loss', scope.userId]);
  db.execute('INSERT INTO household_members(id,household_id,user_id,role) VALUES (?,?,?,?)',
    ['week-loss-member', scope.householdId, scope.userId, 'owner']);
  db.execute('INSERT INTO sessions_v2(id,user_id,household_id,token_hash,expires_at) VALUES (?,?,?,?,?)',
    ['week-loss-session', scope.userId, scope.householdId, await sha256Hex(token), '2099-01-01T00:00:00Z']);
  db.execute('INSERT INTO shopping_lists(id,household_id,name) VALUES (?,?,?)', ['week-loss-list', scope.householdId, 'List']);
  db.execute('INSERT INTO inventory_items(id,household_id,ingredient_id,name,quantity,unit) VALUES (?,?,?,?,?,?)',
    ['week-loss-eggs', scope.householdId, 'CHICKEN_EGG', 'Eggs', 6, 'piece']);
  puts.length = 0;
  env = { DB: db, APP_URL: origin, ENVIRONMENT: 'test', WEEK_SCHEMA_MODE: 'legacy', CACHE: {
    get: async () => null, delete: async () => {}, put: async (key: string) => { puts.push(key); },
  } as unknown as NonNullable<Env['CACHE']> };
  client = await loadClient();
});
afterEach(() => {
  client.queryClient.clear();
  db.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('WKD02 service + real authenticated HTTP + SQLite response loss', () => {
  it.each(['legacy', 'dual'].flatMap((mode) => ['fetch', 'TypeError', 'AbortError'].map((failure) => ({ mode, failure }))))(
    '$mode survives committed $failure, reload, later B and repeated replay of exact A', async ({ mode, failure }) => {
      env.WEEK_SCHEMA_MODE = mode as 'legacy' | 'dual';
      const created = await post('/week/plans', { planId: 'week-loss-plan', startDate: '2030-01-02', householdSize: 2,
        mealSlotsPreset: 'dinner_only', priorities: ['use_fridge'], shoppingFrequency: 'once' });
      expect(created.status).toBe(201);
      plan = (await created.json() as { plan: MealPlan }).plan;
      mealId = plan.days.flatMap((day) => day.slots).find((slot) => slot.recipe)!.id;
      path = `/week/plans/${plan.id}/meals/${mealId}/swap`;
      localStorage.setItem(CACHE, JSON.stringify(plan));
      const received: Array<{ path: string; body: string; key: string | null; user: string | null; household: string | null }> = [];
      const replies: Array<{ plan: MealPlan; idempotentReplay?: boolean }> = [];
      let losses = 1;
      vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit = {}) => {
        const response = await server(input, init);
        if (input !== `/api/v1${path}`) return response;
        expect(response.status).toBe(200);
        const headers = new Headers(init.headers);
        received.push({ path: input, body: String(init.body), key: headers.get('Idempotency-Key'),
          user: headers.get('X-Frigo-Expected-User-Id'), household: headers.get('X-Frigo-Expected-Household-Id') });
        replies.push(await response.clone().json() as { plan: MealPlan; idempotentReplay?: boolean });
        if (losses-- <= 0) return response;
        if (failure === 'fetch') throw new TypeError('response lost after commit');
        return new Response(new ReadableStream<Uint8Array>({ start(controller) {
          controller.error(failure === 'TypeError' ? new TypeError('successful body lost') : new DOMException('successful body lost', 'AbortError'));
        } }), { status: response.status, headers: response.headers });
      }));
      expect(await client.api.swapMeal(plan.id, mealId, A)).toMatchObject({ pendingSync: true });
      expect(selected(replies[0].plan)).toBe(A);
      const queued = client.sync.getPendingOps();
      expect(queued).toHaveLength(1);
      const op = queued[0];
      expect(op).toMatchObject({ path, method: 'POST', body: received[0].body, ...scope });
      expect(op.headers?.['Idempotency-Key']).toBe(received[0].key);
      expect(JSON.parse(op.body!).commandId).toBe(received[0].key);
      const raw = localStorage.getItem(OUTBOX);
      client.queryClient.clear();
      vi.resetModules();
      client = await loadClient();
      expect(client.sync.getPendingOps()).toEqual(queued);
      expect(localStorage.getItem(OUTBOX)).toBe(raw);
      const later = await post(path, { recipeId: B, commandId: 'week-loss-later-B' }, 'week-loss-later-B');
      expect(later.status).toBe(200);
      const current = (await later.json() as { plan: MealPlan }).plan;
      expect(selected(current)).toBe(B);
      const committed = facts();
      puts.length = 0;
      expect(await client.api.retryPendingWrites()).toEqual({ attempted: 1, remaining: 0 });
      expect(client.sync.getPendingOps()).toEqual([]);
      expect(facts()).toEqual(committed);
      expect(selected(JSON.parse(localStorage.getItem(CACHE)!))).toBe(B);
      expect(replies[1].idempotentReplay).toBe(true);
      expect(selected(replies[1].plan)).toBe(B);
      // Reconciliation GETs may publish current B; isolate the direct replay's zero-write contract.
      puts.length = 0;
      const repeated = await server(`/api/v1${path}`, { method: op.method, body: op.body, headers: op.headers });
      expect(repeated.status).toBe(200);
      const replayed = await repeated.json() as { plan: MealPlan; idempotentReplay: boolean };
      expect(replayed.idempotentReplay).toBe(true);
      expect(selected(replayed.plan)).toBe(B);
      expect(facts()).toEqual(committed);
      expect(puts.filter((key) => !key.startsWith('rl_swap:') && !key.startsWith('rl_week_w:'))).toEqual([]);
      expect(await client.api.retryPendingWrites()).toEqual({ attempted: 0, remaining: 0 });
      expect(received).toEqual(Array.from({ length: 2 }, () => ({ path: `/api/v1${path}`, body: op.body,
        key: received[0].key, user: scope.userId, household: scope.householdId })));
    },
  );
});
