import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeInventoryAdoption } from '../../packages/db/src/inventory-adoption-executor';
import { executeInventoryLotCommand } from '../../packages/db/src/inventory-lot-commands';
import { backfillLegacyInventory } from '../../packages/db/src/inventory-truth';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { authRoutes } from '../../src/worker/routes/auth';
import { inventoryRoutes } from '../../src/worker/routes/inventory';
import { notificationRoutes } from '../../src/worker/routes/notifications';
import { recipeRoutes } from '../../src/worker/routes/recipes';
import { weekRoutes } from '../../src/worker/routes/week';
import type { AuthContext, Env } from '../../src/worker/types';
import { signJwt } from '../../src/worker/utils/jwt';
import { generateSessionToken, SESSION_COOKIE, sha256Hex } from '../../src/worker/utils/session';
import { SqliteD1 } from '../helpers/sqlite-d1';

vi.mock('../../src/worker/services/email', () => ({
  sendEmail: vi.fn(async () => ({ sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' })),
  buildOtpEmail: (code: string) => ({ subject: 'B01c fixture', html: code, text: code }),
}));

const ORIGIN = 'https://b01c.example.test';
const USER_A = 'b01c-user-a';
const USER_B = 'b01c-user-b';
const GUEST = 'b01c-guest';
const HOUSE_A = `hh_${USER_A}`;
const HOUSE_B = `hh_${USER_B}`;
const HOUSE_G = 'hh_guest_b01c';
const RECIPE = ALL_RECIPES.find((recipe) => recipe.ingredients.some((ingredient) => ingredient.ingredientId === 'CHICKEN_EGG'))!;
const TABLES = ['users', 'profiles', 'sessions_v2', 'households', 'household_members', 'inventory_items', 'inventory_lots',
  'inventory_events', 'inventory_commands', 'inventory_adoption_receipts', 'storage_locations',
  'weekly_planner_preferences', 'meal_plans', 'shopping_lists', 'shopping_items', 'cooked_meals'];
const PRIVATE_READS = [`/recipes/${RECIPE.id}`, '/recommendations', '/notifications'];
const MUTATIONS = [
  ['/inventory', 'POST', { id: 'b01c-blocked-create', name: 'Eggs', quantity: 1, unit: 'piece' }],
  [`/inventory/stock-${HOUSE_A}`, 'PATCH', { quantity: 1, version: 1 }],
  [`/inventory/stock-${HOUSE_A}`, 'DELETE', undefined],
  ['/inventory/adopt', 'POST', {}],
  ['/week/preferences', 'PATCH', { budgetTargetVnd: 333_000 }],
  [`/recipes/${RECIPE.id}/cook/start`, 'POST', {}],
  [`/recipes/${RECIPE.id}/cook/complete`, 'POST', {}],
] as const;

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/', authRoutes);
app.route('/', inventoryRoutes);
app.route('/', recipeRoutes);
app.route('/', notificationRoutes);
app.route('/', weekRoutes);
app.get('/private', (c) => c.json(c.get('auth')));
let db: SqliteD1;
let env: Env;
let cookieA: string;
let cookieB: string;
let cookieMember: string;
let cookieGuest: string;

function facts() {
  return Object.fromEntries(TABLES.map((table) => [table, db.query(`SELECT * FROM ${table} ORDER BY rowid`)]));
}

function afterCookieLookup(mutate: () => void) {
  const state = { ran: false, expectedFacts: undefined as ReturnType<typeof facts> | undefined };
  db.hooks.afterStatement = ({ sql }) => {
    if (!state.ran && sql.includes('FROM sessions_v2 s')) {
      state.ran = true;
      mutate();
      state.expectedFacts = facts();
    }
  };
  return state;
}

function makeLastSeenStale() {
  db.execute("UPDATE sessions_v2 SET last_seen_at=datetime('now','-1 day')");
}

async function session(id: string, userId: string, householdId: string) {
  const token = generateSessionToken();
  db.execute(`INSERT INTO sessions_v2(id,user_id,household_id,token_hash,expires_at,last_seen_at)
    VALUES (?,?,?,?,datetime('now','+1 day'),datetime('now'))`, [id, userId, householdId, await sha256Hex(token)]);
  return `${SESSION_COOKIE}=${token}`;
}

async function request(path: string, cookie = cookieA, method = 'GET', body?: object,
  headers: Record<string, string> = {}, overrides: Partial<Env> = {}) {
  const response = await app.fetch(new Request(`${ORIGIN}${path}`, { method,
    headers: { Cookie: cookie, Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { ...env, ...overrides });
  return { status: response.status, response, json: await response.json() as any };
}

async function expectDenied(path: string, cookie = cookieA, method = 'GET', body?: object,
  headers: Record<string, string> = {}, overrides: Partial<Env> = {}, status = 403, code = 'TENANCY_VIOLATION') {
  const before = facts();
  const result = await request(path, cookie, method, body, headers, overrides);
  expect(result.status, `${method} ${path}: status=${result.status}, code=${result.json.code}`).toBe(status);
  expect(result.json).toMatchObject({ code });
  expect(result.response.headers.get('Set-Cookie')).toBeNull();
  expect(JSON.stringify(result.json)).not.toContain('PRIVATE-B01c');
  expect(facts()).toEqual(before);
  return result;
}

async function native(householdId = HOUSE_A, actorId = USER_A) {
  await backfillLegacyInventory(db, householdId);
  await executeInventoryAdoption(db, { householdId, actorId }, {});
  const location = db.query<{ id: string }>('SELECT id FROM storage_locations WHERE household_id=? AND type=?', householdId, 'FRIDGE')[0];
  await executeInventoryLotCommand(db, { householdId, actorId }, `b01c-native-${householdId}`, {
    type: 'CREATE', lotId: `b01c-native-${householdId}`, ingredientId: 'CHICKEN_EGG',
    rawName: `PRIVATE-B01c-native-${householdId}`, quantity: 4, unit: 'piece',
    storageLocationId: location.id, sourceType: 'MANUAL',
  }, new Date().toISOString());
}

beforeEach(async () => {
  db = new SqliteD1();
  env = { DB: db, ENVIRONMENT: 'production', APP_URL: ORIGIN,
    JWT_SECRET: 'b01c-fixture-jwt-secret-at-least-32-bytes', OTP_HASH_SECRET: 'b01c-fixture-otp-secret-at-least-32-bytes',
    WEEK_SCHEMA_MODE: 'legacy' };
  db.seed(`INSERT INTO users(id,email,is_guest) VALUES
      ('${USER_A}','b01c-a@example.test',0),('${USER_B}','b01c-b@example.test',0),('${GUEST}',NULL,1);
    INSERT INTO households(id,name,created_by) VALUES
      ('${HOUSE_A}','PRIVATE-B01c-A','${USER_A}'),('${HOUSE_B}','PRIVATE-B01c-B','${USER_B}'),('${HOUSE_G}','PRIVATE-B01c-guest','${GUEST}');
    INSERT INTO household_members(id,household_id,user_id,role) VALUES
      ('hm_${USER_A}','${HOUSE_A}','${USER_A}','owner'),('hm_${USER_B}','${HOUSE_B}','${USER_B}','owner'),
      ('b01c-member-b-a','${HOUSE_A}','${USER_B}','member'),('b01c-guest-member','${HOUSE_G}','${GUEST}','owner');`);
  for (const householdId of [HOUSE_A, HOUSE_B, HOUSE_G]) {
    db.execute(`INSERT INTO inventory_items(id,household_id,ingredient_id,name,quantity,unit,category,storage,freshness)
      VALUES (?,?,'CHICKEN_EGG',?,?,'piece','egg','fridge','expiring')`,
    [`stock-${householdId}`, householdId, `PRIVATE-B01c-${householdId}`, householdId === HOUSE_B ? 2 : 8]);
    db.execute('INSERT INTO shopping_lists(id,household_id,name) VALUES (?,?,?)', [`list-${householdId}`, householdId, `PRIVATE-B01c-${householdId}`]);
    db.execute('INSERT INTO shopping_items(id,list_id,name) VALUES (?,?,?)', [`shop-${householdId}`, `list-${householdId}`, `PRIVATE-B01c-${householdId}`]);
    db.execute(`INSERT INTO weekly_planner_preferences(id,household_id,budget_target_vnd) VALUES (?,?,?)`,
      [`pref-${householdId}`, householdId, householdId === HOUSE_A ? 111_000 : 222_000]);
  }
  cookieA = await session('b01c-session-a', USER_A, HOUSE_A);
  cookieB = await session('b01c-session-b', USER_B, HOUSE_B);
  cookieMember = await session('b01c-session-member', USER_B, HOUSE_A);
  cookieGuest = await session('b01c-session-guest', GUEST, HOUSE_G);
});
afterEach(() => { vi.restoreAllMocks(); db.close(); });

describe('B01c membership revocation and default-household repro', () => {
  it.each(['/inventory', '/week/preferences'])('does not re-create revoked default membership on %s', async (path) => {
    db.execute('DELETE FROM household_members WHERE household_id=? AND user_id=?', [HOUSE_A, USER_A]);
    makeLastSeenStale();
    await expectDenied(path);
    expect(db.query('SELECT id FROM household_members WHERE household_id=? AND user_id=?', HOUSE_A, USER_A)).toEqual([]);
  });
  it('does not resurrect a deleted default household from an old cookie', async () => {
    db.execute('DELETE FROM households WHERE id=?', [HOUSE_A]);
    makeLastSeenStale();
    await expectDenied('/week/preferences');
    expect(db.query('SELECT id FROM households WHERE id=?', HOUSE_A)).toEqual([]);
  });
  it.each(PRIVATE_READS)('rejects a revoked same-household member on %s', async (path) => {
    db.execute('DELETE FROM household_members WHERE household_id=? AND user_id=?', [HOUSE_A, USER_B]);
    makeLastSeenStale();
    await expectDenied(path, cookieMember);
  });
  it('rejects an existing guest cookie after its membership is revoked', async () => {
    db.execute('DELETE FROM household_members WHERE household_id=? AND user_id=?', [HOUSE_G, GUEST]);
    makeLastSeenStale();
    await expectDenied('/inventory', cookieGuest);
  });
  it('rejects a persisted cross-household cookie without a membership row', async () => {
    const foreignCookie = await session('b01c-session-foreign', USER_A, HOUSE_B);
    makeLastSeenStale();
    await expectDenied('/notifications', foreignCookie);
  });
  it('rejects a guest cookie bound to a foreign household even with a membership row', async () => {
    db.execute('INSERT INTO household_members(id,household_id,user_id,role) VALUES (?,?,?,?)',
      ['b01c-guest-foreign-member', HOUSE_B, GUEST, 'member']);
    const foreignCookie = await session('b01c-guest-foreign', GUEST, HOUSE_B);
    makeLastSeenStale();
    await expectDenied('/notifications', foreignCookie);
  });
  it('rejects a guest household whose creator changed after the session was issued', async () => {
    db.execute('UPDATE households SET created_by=? WHERE id=?', [USER_A, HOUSE_G]);
    makeLastSeenStale();
    await expectDenied('/inventory', cookieGuest);
  });
  describe.each(['legacy', 'native'] as const)('%s mutation admission', (mode) => {
    it.each(MUTATIONS)('blocks revoked-member %s %s without any mutation', async (path, method, body) => {
      if (mode === 'native') await native();
      db.execute('DELETE FROM household_members WHERE household_id=? AND user_id=?', [HOUSE_A, USER_B]);
      makeLastSeenStale();
      await expectDenied(path, cookieMember, method, body);
    });
  });
});

describe('B01c route guard freshness after cookie lookup', () => {
  it.each(PRIVATE_READS)('checks registered-member revocation again on %s', async (path) => {
    const race = afterCookieLookup(() => {
      db.execute('DELETE FROM household_members WHERE household_id=? AND user_id=?', [HOUSE_A, USER_B]);
    });
    const result = await request(path, cookieMember);
    expect(race.ran).toBe(true);
    expect(result.status).toBe(403);
    expect(result.json.code).toBe('TENANCY_VIOLATION');
    expect(JSON.stringify(result.json)).not.toContain('PRIVATE-B01c');
    expect(facts()).toEqual(race.expectedFacts);
  });
  it.each(PRIVATE_READS)('checks guest-member revocation again on %s', async (path) => {
    const race = afterCookieLookup(() => {
      db.execute('DELETE FROM household_members WHERE household_id=? AND user_id=?', [HOUSE_G, GUEST]);
    });
    const result = await request(path, cookieGuest);
    expect(race.ran).toBe(true);
    expect(result.status).toBe(403);
    expect(result.json.code).toBe('TENANCY_VIOLATION');
    expect(JSON.stringify(result.json)).not.toContain('PRIVATE-B01c');
    expect(facts()).toEqual(race.expectedFacts);
  });
  it.each(PRIVATE_READS)('checks guest-household creator changes again on %s', async (path) => {
    const race = afterCookieLookup(() => {
      db.execute('UPDATE households SET created_by=? WHERE id=?', [USER_A, HOUSE_G]);
    });
    const result = await request(path, cookieGuest);
    expect(race.ran).toBe(true);
    expect(result.status).toBe(403);
    expect(result.json.code).toBe('TENANCY_VIOLATION');
    expect(JSON.stringify(result.json)).not.toContain('PRIVATE-B01c');
    expect(facts()).toEqual(race.expectedFacts);
  });
});

describe('B01c authoritative cookie failures and public recipe browsing', () => {
  it.each(['unknown-token', '', '%broken'])('rejects cookie value %s without anonymous recipe fallback', async (token) => {
    const denied = await expectDenied(`/recipes/${RECIPE.id}`, `${SESSION_COOKIE}=${token}`, 'GET', undefined,
      {}, {}, 401, 'UNAUTHORIZED');
    expect(denied.response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('rejects an expired cookie even with correct expected-owner headers', async () => {
    db.execute("UPDATE sessions_v2 SET expires_at=datetime('now','-1 day') WHERE id=?", ['b01c-session-a']);
    await expectDenied('/notifications', cookieA, 'GET', undefined,
      { 'X-Frigo-Expected-User-Id': USER_A, 'X-Frigo-Expected-Household-Id': HOUSE_A }, {}, 401, 'UNAUTHORIZED');
  });
  it('does not fall back to a valid development bearer after an invalid supplied cookie', async () => {
    const bearer = await signJwt({ sub: USER_A, hid: HOUSE_A, typ: 'access', exp: Math.floor(Date.now() / 1000) + 3600 }, env.JWT_SECRET!);
    await expectDenied('/inventory', `${SESSION_COOKIE}=unknown-token`, 'GET', undefined,
      { Authorization: `Bearer ${bearer}` }, { ENVIRONMENT: 'test' }, 401, 'UNAUTHORIZED');
  });
  it('fails closed when the cookie authentication database is missing', async () => {
    await expectDenied('/notifications', cookieA, 'GET', undefined, {}, { DB: undefined }, 503, 'AUTH_UNAVAILABLE');
  });
  it('fails closed on session lookup errors without private data or session activity writes', async () => {
    makeLastSeenStale();
    db.hooks.beforeStatement = ({ sql }) => {
      if (sql.includes('FROM sessions_v2 s')) throw new Error('PRIVATE-B01c injected D1 failure');
    };
    await expectDenied(`/recipes/${RECIPE.id}`, cookieA, 'GET', undefined, {}, {}, 503, 'AUTH_UNAVAILABLE');
  });
  describe.each(['registered', 'guest'] as const)('%s second tenancy query', (identity) => {
    it.each(PRIVATE_READS)('fails closed when the tenancy query errors on %s', async (path) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      db.hooks.beforeStatement = ({ sql }) => {
        if (!sql.includes('FROM sessions_v2 s') && sql.includes('FROM household_members')) {
          throw new Error('PRIVATE-B01c tenancy failure');
        }
      };
      await expectDenied(path, identity === 'guest' ? cookieGuest : cookieMember, 'GET', undefined,
        {}, {}, 503, 'DATABASE_UNAVAILABLE');
      expect(JSON.stringify(error.mock.calls)).toContain('tenancy_check_failed');
      expect(JSON.stringify(error.mock.calls)).not.toContain('PRIVATE-B01c');
    });
  });
  it('keeps anonymous catalog and recipe detail public without sentinel household stock', async () => {
    db.seed(`INSERT INTO users(id,is_guest) VALUES ('guest_anonymous',1);
      INSERT INTO households(id,name,created_by) VALUES ('hh_guest_anonymous','PRIVATE-B01c-sentinel','guest_anonymous');
      INSERT INTO household_members(id,household_id,user_id,role) VALUES ('b01c-sentinel-member','hh_guest_anonymous','guest_anonymous','owner');
      INSERT INTO inventory_items(id,household_id,ingredient_id,name,quantity,unit)
        VALUES ('b01c-sentinel-stock','hh_guest_anonymous','CHICKEN_EGG','PRIVATE-B01c-sentinel',999,'piece');`);
    const before = facts();
    expect((await request('/recipes', '')).status).toBe(200);
    const detail = await request(`/recipes/${RECIPE.id}`, '');
    expect(detail.status).toBe(200);
    expect(detail.json.match.availableIngredientCount).toBe(0);
    expect(detail.json.match.ingredientAvailability.find((item: { ingredientId: string }) => item.ingredientId === 'CHICKEN_EGG'))
      .toMatchObject({ availableQuantity: 0, status: 'missing' });
    expect(JSON.stringify(detail.json)).not.toContain('PRIVATE-B01c');
    expect(facts()).toEqual(before);
  });
  it('rejects anonymous browsing with a stale account expected-owner pair', async () => {
    await expectDenied(`/recipes/${RECIPE.id}`, '', 'GET', undefined,
      { 'X-Frigo-Expected-User-Id': USER_A, 'X-Frigo-Expected-Household-Id': HOUSE_A }, {}, 403, 'SESSION_OWNER_MISMATCH');
  });
});

describe('B01c existing isolation and real-cookie compatibility', () => {
  it('authenticates both accounts and two explicit members in one household', async () => {
    for (const [cookie, userId, householdId] of [[cookieA, USER_A, HOUSE_A], [cookieB, USER_B, HOUSE_B], [cookieMember, USER_B, HOUSE_A]]) {
      const result = await request('/private', cookie);
      expect(result.status).toBe(200);
      expect(result.json).toMatchObject({ userId, householdId, isGuest: false });
    }
  });
  it('keeps inventory, notifications, recipe availability and Week preferences inside the session household', async () => {
    for (const [cookie, householdId, budget, quantity] of [[cookieA, HOUSE_A, 111_000, 8], [cookieB, HOUSE_B, 222_000, 2], [cookieMember, HOUSE_A, 111_000, 8]] as const) {
      const inventory = await request('/inventory', cookie);
      expect(inventory.status).toBe(200);
      expect(inventory.json.items.map((item: { householdId: string }) => item.householdId)).toEqual([householdId]);
      const notifications = await request('/notifications', cookie);
      expect(notifications.status).toBe(200);
      expect(JSON.stringify(notifications.json)).toContain(`PRIVATE-B01c-${householdId}`);
      expect(JSON.stringify(notifications.json)).not.toContain(householdId === HOUSE_A ? `PRIVATE-B01c-${HOUSE_B}` : `PRIVATE-B01c-${HOUSE_A}`);
      expect((await request('/week/preferences', cookie)).json.preferences.budgetTargetVnd).toBe(budget);
      const detail = await request(`/recipes/${RECIPE.id}`, cookie);
      expect(detail.status).toBe(200);
      expect(detail.json.match.ingredientAvailability.find((item: { ingredientId: string }) => item.ingredientId === 'CHICKEN_EGG').availableQuantity).toBe(quantity);
      expect((await request('/recommendations', cookie)).status).toBe(200);
    }
  });
  it.each([
    { 'X-Frigo-Expected-User-Id': USER_A, 'X-Frigo-Expected-Household-Id': HOUSE_A },
    { 'X-Frigo-Expected-User-Id': USER_B },
    { 'X-Frigo-Expected-Household-Id': HOUSE_B },
  ] as Record<string, string>[])('rejects mismatched or partial expected-owner headers before reading household state: %j', async (headers) => {
    makeLastSeenStale();
    await expectDenied('/notifications', cookieB, 'GET', undefined, headers, {}, 403, 'SESSION_OWNER_MISMATCH');
  });
  it('allows the exact expected-owner pair for a household member', async () => {
    const result = await request('/inventory', cookieMember, 'GET', undefined,
      { 'X-Frigo-Expected-User-Id': USER_B, 'X-Frigo-Expected-Household-Id': HOUSE_A });
    expect(result.status).toBe(200);
    expect(result.json.items.map((item: { householdId: string }) => item.householdId)).toEqual([HOUSE_A]);
  });
  it.each(['/inventory', '/week/preferences'])('blocks cross-origin cookie writes at %s', async (path) => {
    makeLastSeenStale();
    await expectDenied(path, cookieA, path === '/inventory' ? 'POST' : 'PATCH',
      { name: 'FORGED', quantity: 1, unit: 'piece', householdId: HOUSE_B }, { Origin: 'https://foreign.example.test' }, {}, 403, 'CSRF_ORIGIN_DENIED');
  });
  it('rejects a revoked session while retaining the other member session', async () => {
    db.execute("UPDATE sessions_v2 SET revoked_at=datetime('now') WHERE id=?", ['b01c-session-a']);
    await expectDenied('/notifications', cookieA, 'GET', undefined, {}, {}, 401, 'UNAUTHORIZED');
    const valid = await request('/inventory', cookieMember);
    expect(valid.status).toBe(200);
    expect(valid.json.items.map((item: { householdId: string }) => item.householdId)).toEqual([HOUSE_A]);
  });
  it('allows a valid guest cookie only in its existing household', async () => {
    const result = await request('/inventory', cookieGuest);
    expect(result.status).toBe(200);
    expect(result.json.items.map((item: { householdId: string }) => item.householdId)).toEqual([HOUSE_G]);
  });
  it.each(['legacy', 'native'] as const)('uses the session scope for legitimate member %s writes despite forged body identifiers', async (mode) => {
    if (mode === 'native') await native();
    const foreignInventory = db.query('SELECT * FROM inventory_items WHERE household_id=? ORDER BY id', HOUSE_B);
    const foreignPreferences = db.query('SELECT * FROM weekly_planner_preferences WHERE household_id=?', HOUSE_B);
    const create = await request('/inventory', cookieMember, 'POST', { id: 'b01c-member-create', name: 'Eggs', quantity: 3,
      unit: 'piece', category: 'egg', storage: 'fridge', householdId: HOUSE_B, userId: USER_A, actorId: USER_A });
    expect(create.status).toBe(201);
    expect(create.json.item).toMatchObject({ householdId: HOUSE_A, quantity: 3 });
    const preferences = await request('/week/preferences', cookieMember, 'PATCH',
      { budgetTargetVnd: 333_000, householdId: HOUSE_B, userId: USER_A });
    expect(preferences.status).toBe(200);
    expect((await request('/week/preferences', cookieMember)).json.preferences.budgetTargetVnd).toBe(333_000);
    expect(db.query('SELECT * FROM inventory_items WHERE household_id=? ORDER BY id', HOUSE_B)).toEqual(foreignInventory);
    expect(db.query('SELECT * FROM weekly_planner_preferences WHERE household_id=?', HOUSE_B)).toEqual(foreignPreferences);
    if (mode === 'native') {
      expect(db.query('SELECT actor_id FROM inventory_commands WHERE command_type=? ORDER BY rowid', 'CREATE'))
        .toEqual([{ actor_id: USER_A }, { actor_id: USER_B }]);
    }
  });
  it('retains native inventory provenance and rejects a foreign item mutation', async () => {
    await native();
    const before = facts();
    const inventory = await request('/inventory');
    expect(inventory.status).toBe(200);
    expect(inventory.json.items.every((item: { householdId: string }) => item.householdId === HOUSE_A)).toBe(true);
    expect(db.query('SELECT source_type FROM inventory_lots WHERE household_id=? ORDER BY source_type', HOUSE_A))
      .toEqual([{ source_type: 'LEGACY_BACKFILL' }, { source_type: 'MANUAL' }]);
    const foreign = await request(`/inventory/stock-${HOUSE_B}`, cookieA, 'PATCH', { quantity: 1, version: 1 });
    expect(foreign.status).toBe(404);
    expect(facts()).toEqual(before);
  });
});
