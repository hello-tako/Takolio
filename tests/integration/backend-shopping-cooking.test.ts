import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { executeInventoryAdoption } from '../../packages/db/src/inventory-adoption-executor';
import { executeInventoryLotCommand } from '../../packages/db/src/inventory-lot-commands';
import { loadRankingContext } from '../../packages/db/src/personalization';
import { fingerprintRecipes } from '../../packages/recipes/src/catalog-fingerprint';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { createPlanningContext } from '../../packages/recipes/src/planner-context';
import { createShoppingContext } from '../../packages/recipes/src/shopping-catalog';
import { optimizeShopping } from '../../packages/recipes/src/shopping-optimizer';
import { planWeeklyMeals } from '../../packages/recipes/src/weekly-planner';
import type { InventoryLotSnapshot } from '../../packages/recipes/src/planner-inventory';
import { catalog, recipe, reviewedEvidence } from '../helpers/planner-fixtures';
import { backfillLegacyInventory } from '../../packages/db/src/inventory-truth';
import { aggregateShoppingRequirements, type AggregatedShoppingItem, type InventoryItem, type MealPlan } from '../../packages/domain/src';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { inventoryRoutes } from '../../src/worker/routes/inventory';
import { captureRecipeContentVersion, readRecipeContentVersion } from '../../src/worker/services/recipe-content-versions';
import { recipeRoutes } from '../../src/worker/routes/recipes';
import { weekRoutes } from '../../src/worker/routes/week';
import { serializeMealPlanSnapshot } from '../../src/worker/services/week-read';
import type { AuthContext, Env, WeekSchemaMode } from '../../src/worker/types';
import { generateSessionToken, SESSION_COOKIE, sha256Hex } from '../../src/worker/utils/session';
import { SqliteD1 } from '../helpers/sqlite-d1';

const ORIGIN = 'https://b06-loop.example.test';
const HOUSE = 'b06-loop-household';
const USER = 'b06-loop-user';
const PLAN = 'b06-loop-plan';
const FOREIGN = 'b06-foreign-household';
const NOW = '2026-10-11T00:00:00.000Z';
const scope = { householdId: HOUSE, actorId: USER };
const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/', inventoryRoutes);
app.route('/', recipeRoutes);
app.route('/', weekRoutes);
const TABLES = ['households', 'inventory_items', 'inventory_lots', 'inventory_commands', 'inventory_events',
  'inventory_adoption_receipts', 'storage_locations', 'shopping_import_commands', 'shopping_runs',
  'shopping_run_items', 'cooked_meals', 'meal_plans', 'meal_plan_days', 'meal_plan_slots',
  'meal_plan_days_v2', 'meal_plan_slots_v2', 'meal_plan_shopping_items', 'meal_plan_shopping_items_v2'];
const MATRIX: { week: WeekSchemaMode; inventory: 'legacy' | 'native' }[] = [
  { week: 'legacy', inventory: 'legacy' }, { week: 'dual', inventory: 'legacy' },
  { week: 'legacy', inventory: 'native' }, { week: 'dual', inventory: 'native' },
];
let db: SqliteD1;
let env: Env;
let cookie: string;
let plan: MealPlan;

function memoryCache(): NonNullable<Env['CACHE']> {
  const values = new Map<string, string>();
  return {
    async get(key: string, type?: string) {
      const raw = values.get(key) ?? null;
      return raw === null ? null : type === 'json' ? JSON.parse(raw) as unknown : raw;
    },
    async put(key: string, value: string) { values.set(key, value); },
    async delete(key: string) { values.delete(key); },
  } as unknown as NonNullable<Env['CACHE']>;
}
function facts() {
  return Object.fromEntries(TABLES.map((table) => [table, db.query(`SELECT * FROM ${table} ORDER BY id`)]));
}
function foreignFacts() {
  return db.query('SELECT * FROM inventory_items WHERE household_id = ? ORDER BY id', FOREIGN);
}
async function request(path: string, method = 'GET', body?: unknown, key?: string) {
  const response = await app.fetch(new Request(`${ORIGIN}${path}`, { method,
    headers: { Cookie: cookie, Origin: ORIGIN, 'Content-Type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env);
  return { status: response.status, json: await response.json() as Record<string, unknown> };
}
function inventory() {
  return db.query<{ id: string; ingredient_id: string; quantity: number; unit: string; version: number }>(
    'SELECT id, ingredient_id, quantity, unit, version FROM inventory_items WHERE household_id = ? ORDER BY id', HOUSE);
}
function lots() {
  return db.query<{ id: string; legacy_item_id: string; quantity_milli: number; version: number;
    state: string; source_type: string; source_id: string | null }>(
    'SELECT id, legacy_item_id, quantity_milli, version, state, source_type, source_id FROM inventory_lots WHERE household_id = ? ORDER BY id', HOUSE);
}
async function patchItem(ingredientId: string, patch: { checked?: boolean; cannotBuy?: boolean }) {
  expect((await request(`/week/plans/${PLAN}/shopping/items/${ingredientId}`, 'PATCH', patch)).status).toBe(200);
}
function seededShopping(): AggregatedShoppingItem[] {
  const stock: InventoryItem[] = [{ id: 'stock', householdId: HOUSE, ingredientId: 'CHICKEN_EGG', name: 'Eggs',
    quantity: 6, unit: 'piece', category: 'egg', storage: 'fridge', addedDate: NOW, freshness: 'fresh', updatedAt: NOW }];
  return aggregateShoppingRequirements([
    { recipeId: 'egg-a', recipeTitle: 'Egg A', ingredientId: 'CHICKEN_EGG', name: 'Eggs', category: 'egg', quantity: 5, unit: 'piece' },
    { recipeId: 'egg-b', recipeTitle: 'Egg B', ingredientId: 'CHICKEN_EGG', name: 'Eggs', category: 'egg', quantity: 6, unit: 'piece' },
    { recipeId: 'rice-a', recipeTitle: 'Rice', ingredientId: 'RICE', name: 'Rice', category: 'grain', quantity: 500, unit: 'g' },
    { recipeId: 'carrot-a', recipeTitle: 'Carrot', ingredientId: 'CARROT', name: 'Carrot', category: 'vegetable', quantity: 80, unit: 'g' },
  ], stock).shoppingItems;
}
function seedPlan(items = seededShopping()) {
  plan = { id: PLAN, householdId: HOUSE, startDate: '2026-10-12', endDate: '2026-10-18', status: 'READY', days: [],
    budget: { targetVnd: null, estimatedMinVnd: 0, estimatedMaxVnd: 0, status: 'UNDER', displayText: 'Fixture' },
    utilization: { utilizationPercent: 0, plannedItemsCount: 0, totalUsableItemsCount: 2, highPriorityUsedCount: 0 },
    wasteRisk: { level: 'LOW', expiringItemsCount: 1, rescuedItemsCount: 0, displayText: 'Fixture' },
    shoppingItems: items, priorities: ['use_fridge'], shoppingFrequency: 'once', createdAt: NOW, updatedAt: NOW };
  db.execute('INSERT INTO meal_plans (id, household_id, start_date, end_date, status, snapshot_json) VALUES (?, ?, ?, ?, ?, ?)',
    [PLAN, HOUSE, plan.startDate, plan.endDate, plan.status, serializeMealPlanSnapshot(plan)]);
}
function loseBatchResponse(marker: string) {
  let matched = false;
  let lost = false;
  db.hooks = {
    beforeBatch: (statements) => { matched = statements.some(({ sql }) => sql.includes(marker)); },
    afterBatch: () => {
      if (matched) {
        lost = true;
        db.hooks = {};
        throw new Error('B06 fixture response lost after COMMIT');
      }
    },
  };
  return () => lost;
}

beforeEach(async () => {
  db = new SqliteD1();
  db.seed(`INSERT INTO users (id,email) VALUES ('${USER}','b06-loop@example.test'),('b06-foreign-user','foreign@example.test');
    INSERT INTO households (id,name,created_by) VALUES ('${HOUSE}','B06 loop','${USER}'),('${FOREIGN}','Private foreign','b06-foreign-user');
    INSERT INTO household_members (id,household_id,user_id,role) VALUES ('b06-loop-member','${HOUSE}','${USER}','owner'),
      ('b06-foreign-member','${FOREIGN}','b06-foreign-user','owner');
    INSERT INTO inventory_items (id,household_id,ingredient_id,name,quantity,unit,category,storage,expiry_date,expiry_kind,expiry_source,created_at,updated_at,added_date,data_source)
    VALUES ('a-later','${HOUSE}','CHICKEN_EGG','Eggs',4,'piece','egg','fridge','2026-10-25','use_by','user','2026-10-01','2026-10-01','2026-10-01','manual'),
      ('z-earlier','${HOUSE}','CHICKEN_EGG','Eggs',2,'piece','egg','fridge','2026-10-13','use_by','user','2026-10-05','2026-10-05','2026-10-05','manual'),
      ('foreign-eggs','${FOREIGN}','CHICKEN_EGG','PRIVATE-B06',500,'piece','egg','fridge',NULL,'unknown','unknown','2026-10-01','2026-10-01','2026-10-01','manual');`);
  const token = generateSessionToken();
  db.execute(`INSERT INTO sessions_v2(id,user_id,household_id,token_hash,expires_at,last_seen_at)
    VALUES ('b06-loop-session',?,?,?,datetime('now','+1 day'),datetime('now'))`, [USER, HOUSE, await sha256Hex(token)]);
  cookie = `${SESSION_COOKIE}=${token}`;
  env = { DB: db, CACHE: memoryCache(), ENVIRONMENT: 'production', APP_URL: ORIGIN, WEEK_SCHEMA_MODE: 'legacy',
    JWT_SECRET: 'b06-loop-fixture-secret-at-least-32-bytes', OTP_HASH_SECRET: 'b06-loop-otp-secret-at-least-32-bytes' };
  seedPlan();
});
afterEach(() => db.close());

describe.each(MATRIX)('B06 shopping/cooking: Week $week, inventory $inventory', (mode) => {
  beforeEach(async () => {
    env.WEEK_SCHEMA_MODE = mode.week;
    if (mode.inventory === 'native') {
      await backfillLegacyInventory(db, HOUSE);
      await executeInventoryAdoption(db, scope, {});
    }
  });

  it('does not import an unchecked item or a checked cannotBuy item on implicit completion', async () => {
    await patchItem('CHICKEN_EGG', { checked: true });
    await patchItem('CARROT', { checked: true, cannotBuy: true });
    const foreign = foreignFacts();
    const result = await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', {}, 'b06-implicit-select');
    expect(result).toMatchObject({ status: 200, json: { importedItemsCount: 1 } });
    expect(inventory().map((item) => item.ingredient_id)).toEqual(['CHICKEN_EGG', 'CHICKEN_EGG']);
    expect(inventory().reduce((sum, item) => sum + item.quantity, 0)).toBe(12);
    expect(foreignFacts()).toEqual(foreign);
    expect(db.query('SELECT ingredient_id FROM shopping_run_items ORDER BY ingredient_id')).toEqual([{ ingredient_id: 'CHICKEN_EGG' }]);
  });

  it('refuses explicit cannotBuy selection without a durable command or inventory effect', async () => {
    await patchItem('CARROT', { checked: true, cannotBuy: true });
    const before = facts();
    const result = await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', { items: [{ ingredientId: 'CARROT' }] }, 'b06-blocked-select');
    expect(result).toMatchObject({ status: 409, json: { code: 'CANNOT_BUY' } });
    expect(facts()).toEqual(before);
  });

  it('recovers a committed import when its final batch response is lost', async () => {
    const body = { items: [{ ingredientId: 'CHICKEN_EGG' }] };
    const lost = loseBatchResponse('UPDATE shopping_import_commands');
    const result = await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', body, 'b06-response-loss');
    expect(lost()).toBe(true);
    expect(result).toMatchObject({ status: 200, json: { success: true, importedItemsCount: 1, idempotentReplay: true } });
    const committed = facts();
    expect(inventory().reduce((sum, item) => sum + item.quantity, 0)).toBe(12);
    expect(await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', body, 'b06-response-loss')).toEqual(result);
    expect(facts()).toEqual(committed);
  });

  it('uses canonical plan quantities and identity despite forged fields, duplicates and case variants', async () => {
    const egg = plan.shoppingItems.find((item) => item.ingredientId === 'CHICKEN_EGG')!;
    expect(egg).toMatchObject({ requiredQuantity: 11, existingInventoryQuantity: 6, missingQuantity: 5, recommendedPurchaseQuantity: 6 });
    expect(egg.sourceRecipes.map((source) => source.quantity)).toEqual([5, 6]);
    const body = { householdId: FOREIGN, items: [{ ingredientId: ' chicken_egg ', name: 'Injected beef', unit: 'kg',
      recommendedPurchaseQuantity: 999999, missingQuantity: 999999, quantity: 999999,
      substituteIngredientId: 'BEEF_SIRLOIN', checked: true, cannotBuy: false }, { ingredientId: 'CHICKEN_EGG' }] };
    const foreign = foreignFacts();
    const result = await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', body, 'b06-canonical-override');
    expect(result).toMatchObject({ status: 200, json: { success: true, importedItemsCount: 1 } });
    expect(inventory().reduce((sum, item) => sum + item.quantity, 0)).toBe(12);
    expect(inventory().every((item) => item.ingredient_id === 'CHICKEN_EGG' && item.unit === 'piece')).toBe(true);
    expect(db.query('SELECT ingredient_id, name, quantity, unit, cannot_buy FROM shopping_run_items'))
      .toEqual([{ ingredient_id: 'CHICKEN_EGG', name: 'Eggs', quantity: 6, unit: 'piece', cannot_buy: 0 }]);
    expect(foreignFacts()).toEqual(foreign);
    const committed = facts();
    expect(await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', { items: [{ ingredientId: 'CHICKEN_EGG' }] }, 'b06-canonical-override'))
      .toEqual({ status: 200, json: { ...result.json, idempotentReplay: true } });
    expect(facts()).toEqual(committed);
  });

  it('denies a substituted ingredient absent from the plan before acquiring a command', async () => {
    const before = facts();
    expect(await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', {
      items: [{ ingredientId: 'BEEF_SIRLOIN', substituteFor: 'CHICKEN_EGG', quantity: 6, unit: 'piece' }],
    }, 'b06-forged-substitution')).toMatchObject({ status: 404, json: { code: 'NOT_FOUND' } });
    expect(facts()).toEqual(before);
  });

  it('imports a selected subset and records SHOPPING provenance for a newly created stock row', async () => {
    const result = await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', {
      items: [{ ingredientId: 'RICE' }],
    }, 'b06-partial-item-selection');
    expect(result).toMatchObject({ status: 200, json: { importedItemsCount: 1 } });
    expect(inventory().filter((row) => row.ingredient_id === 'RICE')).toEqual([
      { id: expect.any(String), ingredient_id: 'RICE', quantity: 500, unit: 'g', version: 1 },
    ]);
    expect(inventory().some((row) => row.ingredient_id === 'CARROT')).toBe(false);
    expect(inventory().filter((row) => row.ingredient_id === 'CHICKEN_EGG').reduce((sum, row) => sum + row.quantity, 0)).toBe(6);
    const command = db.query<{ id: string }>('SELECT id FROM shopping_import_commands')[0];
    if (mode.inventory === 'native') {
      expect(lots().find((lot) => lot.source_type === 'SHOPPING')).toMatchObject({
        source_id: command.id, quantity_milli: 500000, version: 1, state: 'ACTIVE',
      });
      expect(db.query('SELECT command_type FROM inventory_commands WHERE client_key LIKE ?', `shop-import:${command.id}:%`))
        .toEqual([{ command_type: 'CREATE' }]);
    } else {
      expect(db.query("SELECT data_source FROM inventory_items WHERE ingredient_id = 'RICE' AND household_id = ?", HOUSE))
        .toEqual([{ data_source: 'shopping' }]);
      expect(db.query('SELECT event_type, quantity_delta, unit FROM inventory_events WHERE household_id = ?', HOUSE))
        .toEqual([{ event_type: 'SHOPPING_IMPORT', quantity_delta: 500, unit: 'g' }]);
    }
  });

  it('rejects a changed selected set on the same shopping key without importing twice', async () => {
    expect((await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', {
      items: [{ ingredientId: 'CHICKEN_EGG' }],
    }, 'b06-shopping-conflict')).status).toBe(200);
    const committed = facts();
    expect(await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', {
      items: [{ ingredientId: 'RICE' }],
    }, 'b06-shopping-conflict')).toMatchObject({ status: 409, json: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(facts()).toEqual(committed);
  });

  it('rolls back stock, event, lot and run effects if the import batch aborts before COMMIT', async () => {
    const before = facts();
    db.seed(`CREATE TRIGGER b06_fail_run_item BEFORE INSERT ON shopping_run_items
      BEGIN SELECT RAISE(ABORT,'B06 injected precommit failure'); END;`);
    expect((await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', {
      items: [{ ingredientId: 'CHICKEN_EGG' }],
    }, 'b06-import-rollback')).status).toBe(500);
    const after = facts();
    for (const table of TABLES.filter((table) => table !== 'shopping_import_commands')) expect(after[table], table).toEqual(before[table]);
    expect(db.query<{ status: string }>('SELECT status FROM shopping_import_commands')).toHaveLength(1);
    expect(db.query<{ status: string }>('SELECT status FROM shopping_import_commands')[0].status).not.toBe('completed');
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('finishes import -> cook -> counted correction without double debit on response-loss replay', async () => {
    const foreign = foreignFacts();
    const planBefore = db.query('SELECT snapshot_json FROM meal_plans WHERE id=?', PLAN);
    const recipeBefore = db.query('SELECT * FROM recipes WHERE id=?', 'gl-03');
    const fingerprintBefore = await fingerprintRecipes(ALL_RECIPES);
    const versionsBefore = lots();
    const importBody = { items: [{ ingredientId: 'CHICKEN_EGG' }] };
    const lostImport = loseBatchResponse('UPDATE shopping_import_commands');
    expect(await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', importBody, 'b06-loop-import'))
      .toMatchObject({ status: 200, json: { idempotentReplay: true } });
    expect(lostImport()).toBe(true);
    const imported = facts();
    expect((await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', importBody, 'b06-loop-import')).status).toBe(200);
    expect(facts()).toEqual(imported);
    const initialLots = lots();
    const importedLater = initialLots.find((lot) => lot.legacy_item_id === 'a-later');
    if (mode.inventory === 'native') expect(importedLater).toMatchObject({ source_type: 'LEGACY_BACKFILL', source_id: 'a-later', quantity_milli: 10000, version: versionsBefore.find((lot) => lot.legacy_item_id === 'a-later')!.version + 1 });
    const cooking = { servings: 2, deductions: [{ ingredientId: 'CHICKEN_EGG', quantityDeducted: 4, unit: 'piece' }] };
    const lostCook = loseBatchResponse('INSERT INTO cooked_meals');
    const cooked = await request('/recipes/gl-03/cook/complete', 'POST', cooking, 'b06-loop-cook');
    expect(cooked).toMatchObject({ status: 200, json: { success: true, idempotentReplay: true } });
    expect(lostCook()).toBe(true);
    expect(inventory().map((row) => ({ id: row.id, quantity: row.quantity })))
      .toEqual([{ id: 'a-later', quantity: 8 }, { id: 'z-earlier', quantity: 0 }]);
    expect(db.query('SELECT recipe_id, servings_cooked FROM cooked_meals WHERE household_id = ?', HOUSE))
      .toEqual([{ recipe_id: 'gl-03', servings_cooked: 2 }]);
    const afterCook = facts();
    expect(await request('/recipes/gl-03/cook/complete', 'POST', cooking, 'b06-loop-cook')).toEqual(cooked);
    expect(facts()).toEqual(afterCook);
    expect(await request('/recipes/gl-03/cook/complete', 'POST', {
      ...cooking, deductions: [{ ingredientId: 'CHICKEN_EGG', quantityDeducted: 5, unit: 'piece' }],
    }, 'b06-loop-cook')).toMatchObject({ status: 409, json: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(facts()).toEqual(afterCook);
    const current = inventory().find((row) => row.id === 'a-later')!;
    expect(current.quantity).toBe(8);
    if (mode.inventory === 'native') {
      const earlier = lots().find((lot) => lot.legacy_item_id === 'z-earlier')!;
      expect(earlier).toMatchObject({ quantity_milli: 0, state: 'CONSUMED', version: versionsBefore.find((lot) => lot.legacy_item_id === 'z-earlier')!.version + 1 });
      expect(db.query('SELECT inventory_item_id, quantity_delta FROM inventory_events WHERE command_id IN (SELECT id FROM inventory_commands WHERE client_key LIKE ?) ORDER BY quantity_delta, inventory_item_id', 'cook:%'))
        .toEqual([{ inventory_item_id: 'a-later', quantity_delta: -2 }, { inventory_item_id: 'z-earlier', quantity_delta: -2 }]);
      const correction = { type: 'CORRECT', lotId: importedLater!.id,
        expectedVersion: lots().find((lot) => lot.id === importedLater!.id)!.version,
        changes: { quantity: 7, unit: 'piece' }, reason: 'Physical count after cooking' };
      const counted = await executeInventoryLotCommand(db, scope, 'b06-counted-correct', correction, new Date().toISOString());
      expect(counted.result.effects[0].after).toMatchObject({ quantityMilli: 7000, sourceType: 'LEGACY_BACKFILL', sourceId: 'a-later' });
      const corrected = facts();
      expect((await executeInventoryLotCommand(db, scope, 'b06-counted-correct', correction, new Date().toISOString())).replayed).toBe(true);
      expect(facts()).toEqual(corrected);
      await expect(executeInventoryLotCommand(db, scope, 'b06-counted-stale', {
        type: 'CORRECT', lotId: importedLater!.id, expectedVersion: importedLater!.version,
        changes: { quantity: 10, unit: 'piece' }, reason: 'Stale count',
      }, new Date().toISOString())).rejects.toMatchObject({ code: 'STALE_VERSION' });
      expect(facts()).toEqual(corrected);
    } else {
      expect((await request('/inventory/a-later', 'PATCH', { quantity: 7, version: current.version })).status).toBe(200);
      const corrected = facts();
      expect(await request('/inventory/a-later', 'PATCH', { quantity: 10, version: current.version }))
        .toMatchObject({ status: 409, json: { code: 'CONFLICT' } });
      expect(facts()).toEqual(corrected);
    }
    expect(db.query('SELECT snapshot_json FROM meal_plans WHERE id=?', PLAN)).toEqual(planBefore);
    expect(db.query('SELECT * FROM recipes WHERE id=?', 'gl-03')).toEqual(recipeBefore);
    expect(await fingerprintRecipes(ALL_RECIPES)).toBe(fingerprintBefore);
    expect(inventory().reduce((sum, row) => sum + row.quantity, 0)).toBe(7);
    expect(inventory().every((row) => row.quantity >= 0)).toBe(true);
    expect(foreignFacts()).toEqual(foreign);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('allocates repeated cooking lines against one remaining-stock snapshot', async () => {
    const foreign = foreignFacts();
    const body = { servings: 2, deductions: [
      { ingredientId: 'CHICKEN_EGG', quantityDeducted: 2, unit: 'piece' },
      { ingredientId: 'CHICKEN_EGG', quantityDeducted: 2, unit: 'piece' },
    ] };
    expect(await request('/recipes/gl-03/cook/complete', 'POST', body, 'b06-repeated-lines'))
      .toMatchObject({ status: 200, json: { success: true } });
    expect(inventory().reduce((sum, row) => sum + row.quantity, 0)).toBe(2);
    expect(inventory().every((row) => row.quantity >= 0)).toBe(true);
    const committed = facts();
    expect(await request('/recipes/gl-03/cook/complete', 'POST', body, 'b06-repeated-lines'))
      .toMatchObject({ status: 200, json: { idempotentReplay: true } });
    expect(facts()).toEqual(committed);
    expect(foreignFacts()).toEqual(foreign);
  });

  it('rejects cumulative repeated deductions beyond total stock without any partial debit', async () => {
    const before = facts();
    expect(await request('/recipes/gl-03/cook/complete', 'POST', { servings: 2, deductions: [
      { ingredientId: 'CHICKEN_EGG', quantityDeducted: 4, unit: 'piece' },
      { ingredientId: 'CHICKEN_EGG', quantityDeducted: 3, unit: 'piece' },
    ] }, 'b06-cumulative-shortage')).toMatchObject({ status: 409, json: { code: 'INSUFFICIENT_INVENTORY' } });
    expect(facts()).toEqual(before);
  });

  it('fences concurrent processing of one import key and replays its completed receipt', async () => {
    const body = { items: [{ ingredientId: 'CHICKEN_EGG' }] };
    let pause!: () => void;
    let release!: () => void;
    const paused = new Promise<void>((resolve) => { pause = resolve; });
    const released = new Promise<void>((resolve) => { release = resolve; });
    db.hooks.beforeBatch = async (statements) => {
      if (statements.some(({ sql }) => sql.includes('UPDATE shopping_import_commands'))) {
        db.hooks = {};
        pause();
        await released;
      }
    };
    const winner = request(`/week/plans/${PLAN}/shopping/complete`, 'POST', body, 'b06-concurrent-import');
    try {
      await Promise.race([paused, winner.then(() => { throw new Error('Import missed final batch barrier'); })]);
      expect(await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', body, 'b06-concurrent-import'))
        .toMatchObject({ status: 409, json: { code: 'COMMAND_IN_PROGRESS' } });
      expect(inventory().reduce((sum, row) => sum + row.quantity, 0)).toBe(6);
      release();
      const result = await winner;
      expect(result).toMatchObject({ status: 200, json: { importedItemsCount: 1 } });
      const committed = facts();
      expect(await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', body, 'b06-concurrent-import'))
        .toEqual({ status: 200, json: { ...result.json, idempotentReplay: true } });
      expect(facts()).toEqual(committed);
      expect(inventory().reduce((sum, row) => sum + row.quantity, 0)).toBe(12);
      expect(db.query('SELECT status FROM shopping_import_commands')).toEqual([{ status: 'completed' }]);
    } finally {
      release();
      await winner;
    }
  });

  it('uses native expiry order while preserving the legacy FIFO compatibility contract', async () => {
    expect((await request('/recipes/gl-03/cook/complete', 'POST', {
      servings: 2, deductions: [{ ingredientId: 'CHICKEN_EGG', quantityDeducted: 3, unit: 'piece' }],
    }, 'b06-order-cook')).status).toBe(200);
    expect(inventory().map((row) => ({ id: row.id, quantity: row.quantity }))).toEqual(mode.inventory === 'native'
      ? [{ id: 'a-later', quantity: 3 }, { id: 'z-earlier', quantity: 0 }]
      : [{ id: 'a-later', quantity: 1 }, { id: 'z-earlier', quantity: 2 }]);
  });

  it('rejects a mixed purchased and cannotBuy selection before any import claim', async () => {
    await patchItem('CARROT', { cannotBuy: true });
    const before = facts();
    expect(await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', {
      items: [{ ingredientId: 'CHICKEN_EGG' }, { ingredientId: 'CARROT', cannotBuy: false }],
    }, 'b06-mixed-blocked')).toMatchObject({ status: 409, json: { code: 'CANNOT_BUY' } });
    expect(facts()).toEqual(before);
  });

  if (mode.inventory === 'native') {
    it.each(['{broken', 'null', '{"success":false,"importedItemsCount":1}', '{"success":true,"importedItemsCount":-1}'])
    ('fails closed when a committed native receipt is corrupt (%s)', async (responseJson) => {
      let final = false;
      let committed: ReturnType<typeof facts> | undefined;
      db.hooks = {
        beforeBatch: (statements) => { final = statements.some(({ sql }) => sql.includes('UPDATE shopping_import_commands')); },
        afterBatch: () => {
          if (final) {
            db.hooks = {};
            db.execute('UPDATE shopping_import_commands SET response_json=? WHERE household_id=?', [responseJson, HOUSE]);
            committed = facts();
            throw new Error('B06 corrupt receipt after COMMIT');
          }
        },
      };
      expect(await request(`/week/plans/${PLAN}/shopping/complete`, 'POST', {
        items: [{ ingredientId: 'CHICKEN_EGG' }],
      }, 'b06-corrupt-receipt')).toMatchObject({ status: 503, json: { code: 'DATA_INTEGRITY_ERROR' } });
      expect(committed).toBeDefined();
      expect(facts()).toEqual(committed);
      expect(inventory().reduce((sum, row) => sum + row.quantity, 0)).toBe(12);
    });
  }

  it('pins detail content through catalog failure, historical reads and receipt replay', async () => {
    const detail = await request('/recipes/gl-03');
    expect(detail.status).toBe(200);
    const contentFingerprint = detail.json.contentFingerprint as string;
    const original = ALL_RECIPES.find(item => item.id === 'gl-03')!;
    expect(contentFingerprint).toBe(await fingerprintRecipes([original]));
    expect(await readRecipeContentVersion(db, contentFingerprint)).toEqual(original);
    // Synthetic next-version content changes units under the same stable identity.
    const changed = { ...original, title: 'Synthetic future version', ingredients: original.ingredients.map(line =>
      line.ingredientId === 'CHICKEN_EGG' ? { ...line, unit: 'g' as const } : line) };
    const nextFingerprint = await captureRecipeContentVersion(db, changed);
    expect(nextFingerprint).not.toBe(contentFingerprint);
    env.RECIPE_CATALOG_MODE = 'unavailable-for-this-test';
    expect(await request(`/recipes/gl-03?contentFingerprint=${contentFingerprint}`))
      .toMatchObject({ status: 200, json: { contentFingerprint, recipe: { title: original.title } } });
    const body = { contentFingerprint, servings: 4,
      deductions: [{ ingredientId: 'CHICKEN_EGG', quantityDeducted: 2 }] };
    const cooked = await request('/recipes/gl-03/cook/complete', 'POST', body, 'versioned-cook-command');
    expect(cooked).toMatchObject({ status: 200, json: { success: true,
      deductionsApplied: [{ ingredientId: 'CHICKEN_EGG', quantityDeducted: 2, unit: 'piece' }] } });
    expect(db.query('SELECT recipe_content_fingerprint, servings_cooked FROM cooked_meals WHERE household_id = ?', HOUSE))
      .toEqual([{ recipe_content_fingerprint: contentFingerprint, servings_cooked: 4 }]);
    const committed = facts();
    expect(await request('/recipes/gl-03/cook/complete', 'POST', body, 'versioned-cook-command'))
      .toMatchObject({ status: 200, json: { idempotentReplay: true } });
    for (const patch of [{ contentFingerprint: nextFingerprint }, { contentFingerprint: undefined }, { servings: 2 }]) {
      expect(await request('/recipes/gl-03/cook/complete', 'POST', { ...body, ...patch }, 'versioned-cook-command'))
        .toMatchObject({ status: 409, json: { code: 'IDEMPOTENCY_CONFLICT' } });
    }
    expect(facts()).toEqual(committed);
    expect(foreignFacts()[0].quantity).toBe(500);
  });

  it('rejects unknown, malformed and wrong-recipe content without changing stock', async () => {
    const wrong = await captureRecipeContentVersion(db, ALL_RECIPES.find(item => item.id === 'gl-04')!);
    const before = facts();
    for (const contentFingerprint of ['a'.repeat(64), wrong]) {
      expect(await request('/recipes/gl-03/cook/complete', 'POST', { contentFingerprint, deductions: [] }, 'missing-version-key'))
        .toMatchObject({ status: 409, json: { code: 'RECIPE_VERSION_UNAVAILABLE' } });
    }
    expect(await request('/recipes/gl-03/cook/complete', 'POST', { contentFingerprint: '../bad', deductions: [] }))
      .toMatchObject({ status: 400, json: { code: 'VALIDATION_ERROR' } });
    expect((await request('/recipes/gl-03?contentFingerprint=invalid')).status).toBe(400);
    expect((await request(`/recipes/gl-03?contentFingerprint=${wrong}`)).status).toBe(404);
    expect(facts()).toEqual(before);
  });

  it('replays reordered mixed units and omitted units without consulting the current catalog', async () => {
    const detail = await request('/recipes/gl-03');
    const body = { contentFingerprint: detail.json.contentFingerprint, servings: 2, deductions: [
      { ingredientId: 'CHICKEN_EGG', quantityDeducted: 0, unit: 'g' },
      { ingredientId: 'CHICKEN_EGG', quantityDeducted: 2 },
      { ingredientId: 'COOKING_OIL', quantityDeducted: 0 },
    ] };
    expect(await request('/recipes/gl-03/cook/complete', 'POST', body, 'mixed-unit-replay-key'))
      .toMatchObject({ status: 200, json: { deductionsApplied: [
        { ingredientId: 'CHICKEN_EGG', quantityDeducted: 0, unit: 'g' },
        { ingredientId: 'CHICKEN_EGG', quantityDeducted: 2, unit: 'piece' },
        { ingredientId: 'COOKING_OIL', quantityDeducted: 0, unit: 'ml' },
      ] } });
    const committed = facts();
    env.RECIPE_CATALOG_MODE = 'unavailable-for-this-test';
    expect(await request('/recipes/gl-03/cook/complete', 'POST', { ...body,
      deductions: [...body.deductions].reverse() }, 'mixed-unit-replay-key'))
      .toMatchObject({ status: 200, json: { idempotentReplay: true } });
    expect(await request('/recipes/gl-03/cook/complete', 'POST', { ...body,
      deductions: [{ ingredientId: 'CHICKEN_EGG', quantityDeducted: 3 }] }, 'mixed-unit-replay-key'))
      .toMatchObject({ status: 409, json: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(facts()).toEqual(committed);
  });

  it('replays legacy receipts before unavailable catalog resolution and keeps their version unknown', async () => {
    const body = { servings: 2, deductions: [{ ingredientId: 'CHICKEN_EGG', quantityDeducted: 2 }] };
    expect((await request('/recipes/gl-03/cook/complete', 'POST', body, 'legacy-version-command')).status).toBe(200);
    expect(db.query('SELECT recipe_content_fingerprint FROM cooked_meals WHERE household_id = ?', HOUSE))
      .toEqual([{ recipe_content_fingerprint: null }]);
    const committed = facts();
    env.RECIPE_CATALOG_MODE = 'unavailable-for-this-test';
    expect(await request('/recipes/gl-03/cook/complete', 'POST', body, 'legacy-version-command'))
      .toMatchObject({ status: 200, json: { idempotentReplay: true } });
    expect(facts()).toEqual(committed);
  });

  it('replays pre-0046 receipts with unknown content and request references; ambiguous units fail closed', async () => {
    db.execute(`INSERT INTO recipes(id,slug,title,cuisine,cook_time_minutes,servings,difficulty)
      VALUES ('legacy-imported','legacy-imported','Legacy fixture','vietnamese',10,2,'easy')`);
    const key = 'pre-content-receipt-command';
    const cookId = `cook_${(await sha256Hex(`${HOUSE}:${key}`)).slice(0, 48)}`;
    const deductions = [{ ingredientId: 'CHICKEN_EGG', quantityDeducted: 2, unit: 'piece' }];
    db.execute(`INSERT INTO cooked_meals(id,household_id,user_id,recipe_id,servings_cooked,deductions_applied)
      VALUES (?,?,?,'legacy-imported',2,?)`, [cookId, HOUSE, USER, JSON.stringify(deductions)]);
    expect(db.query('SELECT recipe_content_fingerprint,request_fingerprint FROM cooked_meals WHERE id = ?', cookId))
      .toEqual([{ recipe_content_fingerprint: null, request_fingerprint: null }]);
    const committed = facts();
    env.RECIPE_CATALOG_MODE = 'unavailable-for-this-test';
    expect(await request('/recipes/legacy-imported/cook/complete', 'POST', {
      servings: 2, deductions: [{ ingredientId: 'CHICKEN_EGG', quantityDeducted: 2 }],
    }, key)).toMatchObject({ status: 200, json: { idempotentReplay: true } });
    expect(facts()).toEqual(committed);

    const ambiguousKey = 'pre-content-ambiguous-command';
    const ambiguousId = `cook_${(await sha256Hex(`${HOUSE}:${ambiguousKey}`)).slice(0, 48)}`;
    db.execute(`INSERT INTO cooked_meals(id,household_id,user_id,recipe_id,servings_cooked,deductions_applied)
      VALUES (?,?,?,'legacy-imported',2,?)`, [ambiguousId, HOUSE, USER, JSON.stringify([
        ...deductions, { ingredientId: 'CHICKEN_EGG', quantityDeducted: 0, unit: 'g' },
      ])]);
    const ambiguous = facts();
    expect(await request('/recipes/legacy-imported/cook/complete', 'POST', {
      servings: 2, deductions: [{ ingredientId: 'CHICKEN_EGG', quantityDeducted: 2 },
        { ingredientId: 'CHICKEN_EGG', quantityDeducted: 0, unit: 'g' }],
    }, ambiguousKey)).toMatchObject({ status: 409, json: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(facts()).toEqual(ambiguous);
  });

  it('refuses insufficient cooking stock without consuming or creating a cooked receipt', async () => {
    const before = facts();
    expect(await request('/recipes/gl-03/cook/complete', 'POST', {
      servings: 2, deductions: [{ ingredientId: 'CHICKEN_EGG', quantityDeducted: 7, unit: 'piece' }],
    }, 'b06-insufficient-cook')).toMatchObject({ status: 409, json: { code: 'INSUFFICIENT_INVENTORY' } });
    expect(facts()).toEqual(before);
  });
});

describe('B06 current pure shopping optimizer', () => {
  it('consolidates post-allocation shortages once, rounds a reviewed pack and performs no I/O or writes', async () => {
    const rankingContext = await loadRankingContext(db, { householdId: HOUSE, userId: USER }, NOW);
    const inventoryRows = db.query<InventoryLotSnapshot>(`SELECT id,household_id AS householdId,ingredient_id AS ingredientId,
      quantity,unit,version,freshness,expiry_date AS expiryDate,expiry_kind AS expiryKind FROM inventory_items WHERE household_id=? ORDER BY id`, HOUSE);
    const eggs = (id: string, quantity: number) => recipe(id, 'CHICKEN_EGG', quantity, {
      ingredients: [{ ingredientId: 'CHICKEN_EGG', name: 'Eggs', requiredQuantity: quantity, unit: 'piece', isOptional: false }],
    });
    const mealPlan = planWeeklyMeals({ context: createPlanningContext(() => ({
      snapshotId: 'b06-reviewed-synthetic-plan', referenceInstant: NOW, inventory: inventoryRows, rankingContext,
      catalog: catalog([eggs('egg-a', 5), eggs('egg-b', 6)]), evidenceProvider: reviewedEvidence,
    })), request: { startDate: '2026-10-12', defaultServings: 2, horizonDays: 2, mode: 'shopping_allowed', slots: [
      { date: '2026-10-12', mealType: 'dinner', lock: { kind: 'recipe', id: 'egg-a', version: 1 } },
      { date: '2026-10-13', mealType: 'dinner', lock: { kind: 'recipe', id: 'egg-b', version: 1 } },
    ] } });
    expect(mealPlan.slots).toHaveLength(2);
    const context = createShoppingContext(() => ({ householdId: HOUSE, userId: USER, mealPlan, currency: 'JPY', budget: null,
      catalog: { snapshotId: 'b06-reviewed-synthetic-price', asOf: NOW, options: [{ id: 'egg-pack-six', ingredientId: 'CHICKEN_EGG',
        packageContent: { quantity: 6, unit: 'piece', sourceReference: 'b06-test-reviewed-package' },
        price: { amountMinor: 300, currency: 'JPY', source: 'manual', sourceReference: 'b06-test-observed-price', asOf: NOW },
        availability: 'available', expiry: null }] } }));
    const before = facts();
    let io = 0;
    db.hooks = { beforeStatement: () => { io++; throw new Error('Optimizer tried I/O'); },
      beforeBatch: () => { io++; throw new Error('Optimizer tried a mutation'); } };
    const optimized = optimizeShopping({ context });
    expect(optimized.requirements).toHaveLength(1);
    expect(optimized.requirements[0]).toMatchObject({ ingredientId: 'CHICKEN_EGG', requiredQuantity: 5, knownRequiredQuantity: 5, status: 'known' });
    expect(optimized.purchaseLines).toHaveLength(1);
    expect(optimized.purchaseLines[0]).toMatchObject({ requiredQuantity: 5, purchasedQuantity: 6, surplusQuantity: 1,
      selectedPackages: [{ purchaseOptionId: 'egg-pack-six', packageCount: 1, unitPriceMinor: '300' }] });
    expect(optimized.cost.totalCostMinor).toBe('300');
    expect(optimized.priceSnapshot.requiresRevalidationBeforeAcceptance).toBe(true);
    expect(optimized.mealPlan.sourceSnapshot).toEqual(mealPlan.sourceSnapshot);
    expect(optimizeShopping({ context })).toEqual(optimized);
    expect(io).toBe(0);
    expect(facts()).toEqual(before);
  });
});
