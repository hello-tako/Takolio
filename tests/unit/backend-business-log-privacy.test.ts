import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudflareAIProvider } from '../../packages/ai/src/providers/cloudflare';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { inventoryTruthRoutes } from '../../src/worker/routes/inventory-truth';
import { inventoryRoutes } from '../../src/worker/routes/inventory';
import { preferencesRoutes } from '../../src/worker/routes/preferences';
import { recipeRoutes } from '../../src/worker/routes/recipes';
import { scanRoutes } from '../../src/worker/routes/scans';
import { shoppingRoutes } from '../../src/worker/routes/shopping';
import { weekRoutes } from '../../src/worker/routes/week';
import type { AuthContext, Env } from '../../src/worker/types';
import { SqliteD1 } from '../helpers/sqlite-d1';

const scope: AuthContext = { userId: 'demo_user_01', householdId: 'demo_household_01', isGuest: false };
const recipe = ALL_RECIPES[0];
const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', async (c, next) => { c.set('auth', scope); await next(); });
app.route('/', shoppingRoutes);
app.route('/', preferencesRoutes);
app.route('/', inventoryTruthRoutes);
app.route('/', inventoryRoutes);
app.route('/', scanRoutes);
app.route('/', weekRoutes);
app.route('/', recipeRoutes);

const privateMarker = 'PRIVATE_LOG_PAYLOAD_user@example.test_otp-654321_receipt-content';
const defaultPreferences = { householdSize: 2, spicyLevel: 'medium', favoriteCuisines: ['vietnamese'], dietaryRestrictions: [], language: 'vi' };
const unavailable = { error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' };
const cases = [
  { name: 'shopping list', path: '/shopping-list', table: 'FROM shopping_lists', status: 503, body: unavailable,
    messages: ['D1 GET shopping list failed:'] },
  { name: 'preferences fallback', path: '/preferences', table: 'FROM user_preferences', status: 200, body: { preferences: defaultPreferences },
    messages: ['Failed querying user_preferences from D1:'] },
  { name: 'legacy inventory', path: '/inventory', table: 'FROM inventory_items', status: 503, body: unavailable,
    messages: ['Failed fetching inventory from D1:', 'GET inventory unavailable:'] },
  { name: 'scan read', path: '/scans/privacy-scan', table: 'FROM scans', status: 500,
    body: { error: 'L\u1ed7i truy v\u1ea5n b\u1ea3n qu\u00e9t', code: 'DATABASE_ERROR' }, messages: ['D1 GET_SCAN failed:'] },
  { name: 'Week preferences', path: '/week/preferences', table: 'FROM weekly_planner_preferences', status: 503, body: unavailable,
    messages: ['Failed querying weekly preferences:'] },
  { name: 'inventory truth', path: '/inventory/summary', table: 'FROM inventory_lots', status: 500,
    body: { error: 'Kh\u00f4ng th\u1ec3 \u0111\u1ecdc kho theo l\u00f4', code: 'DATABASE_ERROR' }, messages: ['T13 inventory truth read failed:'] },
  { name: 'cooking transaction', path: `/recipes/${recipe.id}/cook/complete`, table: 'FROM cooked_meals', status: 500,
    body: { error: 'L\u1ed7i ho\u00e0n t\u1ea5t n\u1ea5u m\u00f3n trong c\u01a1 s\u1edf d\u1eef li\u1ec7u', code: 'DATABASE_ERROR' },
    messages: ['D1 complete cooking transaction failed:'], method: 'POST', request: { deductions: [], servings: 2 } },
] as const;
let db: SqliteD1;
let errorLog: ReturnType<typeof vi.spyOn>;
let warnLog: ReturnType<typeof vi.spyOn>;
let infoLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  db = new SqliteD1();
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnLog = vi.spyOn(console, 'warn').mockImplementation(() => {});
  infoLog = vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); db.close(); });

function facts() {
  return Object.fromEntries(['inventory_items', 'inventory_events', 'inventory_commands', 'cooked_meals',
    'scans', 'shopping_items', 'user_preferences', 'weekly_planner_preferences'].map((table) =>
    [table, db.query(`SELECT * FROM ${table} ORDER BY rowid`)]));
}

async function request(path: string, method = 'GET', body?: object) {
  const response = await app.fetch(new Request(`https://business-log.example.test${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), { DB: db, ENVIRONMENT: 'test', WEEK_SCHEMA_MODE: 'legacy', RECIPE_CATALOG_MODE: 'static' } as Env);
  return { status: response.status, body: await response.json() };
}

function assertPrivatePayloadAbsent() {
  const calls = [...errorLog.mock.calls, ...warnLog.mock.calls, ...infoLog.mock.calls];
  for (const args of calls) {
    expect(args.every((arg: unknown) => typeof arg === 'string')).toBe(true);
    expect(args.join(' ')).not.toContain(privateMarker);
  }
}

describe('business route failure logs preserve HTTP and data contracts', () => {
  for (const spec of cases) {
    it.each(['error', 'object'] as const)(`${spec.name} keeps %s payloads out of the diagnostic sink`, async (kind) => {
      const coercion = vi.fn(() => { throw new Error('Failure values must never be stringified'); });
      const hostile = kind === 'error'
        ? Object.assign(new Error(privateMarker), { name: privateMarker, stack: privateMarker, body: privateMarker, cause: { raw: privateMarker } })
        : { message: privateMarker, body: privateMarker, response: { raw: privateMarker }, toString: coercion, toJSON: coercion };
      const before = facts();
      let failures = 0;
      db.hooks.beforeStatement = ({ sql }) => {
        if (sql.includes(spec.table)) { failures += 1; throw hostile; }
      };

      const result = await request(spec.path, 'method' in spec ? spec.method : 'GET', 'request' in spec ? spec.request : undefined);

      expect(result).toEqual({ status: spec.status, body: spec.body });
      expect(failures).toBeGreaterThan(0);
      expect(errorLog.mock.calls).toEqual(spec.messages.map((message) => [message]));
      assertPrivatePayloadAbsent();
      expect(coercion).not.toHaveBeenCalled();
      expect(facts()).toEqual(before);
    });
  }

  it('does not log private persisted preferences when native JSON parsing fails', async () => {
    db.execute('UPDATE user_preferences SET dietary_restrictions=? WHERE user_id=?', [privateMarker, scope.userId]);
    const before = facts();

    expect(await request('/preferences')).toEqual({ status: 200, body: { preferences: defaultPreferences } });
    expect(errorLog.mock.calls).toEqual([['Failed querying user_preferences from D1:']]);
    assertPrivatePayloadAbsent();
    expect(facts()).toEqual(before);
  });
});

describe('legacy Cloudflare image decoding diagnostic', () => {
  it('rejects a malformed image before provider invocation without logging decoder error fields', async () => {
    const run = vi.fn();
    const provider = new CloudflareAIProvider({ run });
    const hostile = Object.assign(new Error(privateMarker), { stack: privateMarker, cause: { image: privateMarker } });
    vi.stubGlobal('atob', vi.fn(() => { throw hostile; }));

    await expect(provider.vision({ imageBase64OrUrl: `invalid-${privateMarker}`, mimeType: 'image/png' }))
      .rejects.toThrow('Invalid or empty image byte data for vision scan');

    expect(run).not.toHaveBeenCalled();
    expect(errorLog.mock.calls).toEqual([['Failed to parse base64 image into byte array:']]);
    assertPrivatePayloadAbsent();
  });
});
