import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { executeInventoryAdoption } from '../../packages/db/src/inventory-adoption-executor';
import { executeInventoryLotCommand } from '../../packages/db/src/inventory-lot-commands';
import { assertProjectionParity, readInventoryLot } from '../../packages/db/src/inventory-read-authority';
import { backfillLegacyInventory } from '../../packages/db/src/inventory-truth';
import { defaultStorageLocations, legacyInventoryToLot } from '../../packages/domain/src/inventory-truth';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { inventoryRoutes } from '../../src/worker/routes/inventory';
import type { AuthContext, Env } from '../../src/worker/types';
import { signJwt } from '../../src/worker/utils/jwt';
import { SqliteD1 } from '../helpers/sqlite-d1';

const scope = { householdId: 'category-home', actorId: '' };
const foreign = { householdId: 'category-other', actorId: 'category-foreign' };
const secret = 'test-only-category-authority-secret';
const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/', inventoryRoutes);
let db: SqliteD1;
let token: string;
let foreignToken: string;

beforeEach(async () => {
  scope.actorId = `category-user-${crypto.randomUUID()}`;
  db = new SqliteD1();
  db.seed(`INSERT INTO users(id) VALUES ('${scope.actorId}'), ('${foreign.actorId}');
    INSERT INTO households(id,name,created_by) VALUES
      ('category-home','Category','${scope.actorId}'), ('category-other','Other','${foreign.actorId}');
    INSERT INTO household_members(id,household_id,user_id,role) VALUES
      ('category-member','category-home','${scope.actorId}','owner'),
      ('category-other-member','category-other','${foreign.actorId}','owner');`);
  await executeInventoryAdoption(db, scope, {});
  await executeInventoryAdoption(db, foreign, {});
  const exp = Math.floor(Date.now() / 1000) + 3600;
  token = await signJwt({ sub: scope.actorId, hid: scope.householdId, typ: 'access', exp }, secret);
  foreignToken = await signJwt({ sub: foreign.actorId, hid: foreign.householdId, typ: 'access', exp }, secret);
});
afterEach(() => db.close());

const createBody = (overrides: Record<string, unknown> = {}) => ({
  id: 'category-item', name: 'CAT01 custom seasoning', quantity: 0.25, unit: 'pack',
  category: 'spice', storage: 'pantry', expiryDate: '2027-10-24', expiryEstimated: false,
  dataSource: 'manual', ...overrides,
});
async function request(method: string, path: string, body?: unknown,
  headers: Record<string, string> = {}, bearer = token) {
  const response = await app.fetch(new Request(`https://category.example${path}`, {
    method, headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, ENVIRONMENT: 'test', JWT_SECRET: secret });
  return { status: response.status, json: await response.json() as Record<string, unknown> };
}
const create = (body = createBody(), bearer = token) => request('POST', '/inventory', body, {}, bearer);
const lot = () => readInventoryLot(db, scope, { lotId: 'category-item' });
const location = (type: string) => db.query<{ id: string }>(
  'SELECT id FROM storage_locations WHERE household_id = ? AND type = ?', scope.householdId, type)[0].id;
async function patch(body: Record<string, unknown>, key = 'category-patch-key') {
  return request('PATCH', '/inventory/category-item', body, { 'Idempotency-Key': key });
}
async function items(bearer = token) {
  const response = await request('GET', '/inventory', undefined, {}, bearer);
  expect(response.status).toBe(200);
  return response.json.items as Array<Record<string, unknown>>;
}
function facts() {
  return Object.fromEntries(['households', 'inventory_items', 'inventory_lots', 'storage_locations',
    'inventory_commands', 'inventory_events', 'inventory_adoption_receipts']
    .map((table) => [table, db.query(`SELECT * FROM ${table} ORDER BY id`)]));
}
async function use() {
  return executeInventoryLotCommand(db, scope, 'category-use-key', {
    type: 'USE', lotId: 'category-item', expectedVersion: (await lot()).version,
    quantity: 0.05, unit: 'pack', reason: 'Cooked' });
}
async function move() {
  return executeInventoryLotCommand(db, scope, 'category-move-key', {
    type: 'MOVE', lotId: 'category-item', expectedVersion: (await lot()).version,
    storageLocationId: location('FREEZER') });
}

describe('CAT01 authoritative display category and manual CREATE receipts', () => {
  it('retains an unmapped 0.25 pack spice through create, authority read and repeated GET', async () => {
    expect(await create()).toMatchObject({ status: 201, json: { item: {
      id: 'category-item', ingredientId: '', quantity: 0.25, unit: 'pack', category: 'spice',
    } } });
    expect(await lot()).toMatchObject({ ingredientId: null, quantityMilli: 250,
      canonicalUnit: 'pack', category: 'spice', sourceType: 'MANUAL' });
    for (let reload = 0; reload < 2; reload += 1) {
      expect(await items()).toEqual([expect.objectContaining({ id: 'category-item', ingredientId: '',
        quantity: 0.25, unit: 'pack', quantityMilli: 250, category: 'spice' })]);
    }
    expect(await assertProjectionParity(db, scope)).toEqual([]);
  });

  it('category-only PATCH preserves stock, identity and provenance through USE and MOVE', async () => {
    expect((await create()).status).toBe(201);
    const before = await lot();
    expect(await patch({ version: before.legacyVersion, category: 'condiment' }))
      .toMatchObject({ status: 200, json: { item: { category: 'condiment', quantity: 0.25, unit: 'pack' } } });
    const corrected = await lot();
    expect(corrected).toMatchObject({ ingredientId: before.ingredientId, lotId: before.lotId,
      quantityMilli: 250, canonicalUnit: 'pack', category: 'condiment', sourceType: before.sourceType,
      sourceId: before.sourceId, createdAt: before.createdAt, version: before.version + 1,
      legacyVersion: before.legacyVersion! + 1 });
    expect(db.query(`SELECT e.quantity_delta FROM inventory_events e JOIN inventory_commands c ON c.id = e.command_id
      WHERE c.command_type = 'CORRECT'`)).toEqual([{ quantity_delta: 0 }]);
    await use();
    await move();
    expect(await lot()).toMatchObject({ category: 'condiment', quantityMilli: 200,
      storage: 'freezer', ingredientId: null, sourceType: 'MANUAL' });
    expect(await items()).toEqual([expect.objectContaining({ category: 'condiment', quantity: 0.2,
      unit: 'pack', storage: 'freezer' })]);
    expect(await assertProjectionParity(db, scope)).toEqual([]);
  });

  it('keeps RICE grain on CREATE and category PATCH, including PATCH receipt replay', async () => {
    expect(await create(createBody({ name: 'Rice', quantity: 250, unit: 'g', category: 'vegetable' })))
      .toMatchObject({ status: 201, json: { item: { ingredientId: 'RICE', category: 'grain' } } });
    const body = { version: (await lot()).legacyVersion, category: 'meat' };
    const result = await patch(body);
    expect(result).toMatchObject({ status: 200, json: { item: { ingredientId: 'RICE', category: 'grain' } } });
    const committed = facts();
    expect(await patch(body)).toEqual({ status: 200, json: { ...result.json, idempotentReplay: true } });
    expect(facts()).toEqual(committed);
    expect(await lot()).toMatchObject({ ingredientId: 'RICE', category: 'grain' });
    expect(await assertProjectionParity(db, scope)).toEqual([]);
  });

  it.each([
    ['unmapped', 'CAT01 custom seasoning', 'spice'], ['canonical', 'Rice', 'grain'],
  ])('ignores tampered projection category for %s stock', async (_kind, name, category) => {
    expect((await create(createBody({ name }))).status).toBe(201);
    db.seed("UPDATE inventory_items SET category = 'tampered' WHERE id = 'category-item'");
    const tampered = facts();
    expect(await lot()).toMatchObject({ category });
    expect(await items()).toEqual([expect.objectContaining({ category })]);
    expect(facts()).toEqual(tampered);
  });

  it.each(['PATCH', 'USE', 'MOVE', 'DELETE'])('replays the original CREATE result after %s without mutations', async (operation) => {
    const body = createBody();
    const original = await create(body);
    expect(original.status).toBe(201);
    if (operation === 'PATCH') {
      expect((await patch({ version: (await lot()).legacyVersion, category: 'condiment', quantity: 0.2 })).status).toBe(200);
    } else if (operation === 'USE') await use();
    else if (operation === 'MOVE') await move();
    else expect((await request('DELETE', '/inventory/category-item', undefined, {
      'If-Match': String((await lot()).legacyVersion), 'Idempotency-Key': 'category-delete-key',
    })).status).toBe(200);
    const committed = facts();
    expect(await create(body)).toEqual({ status: 200, json: { ...original.json, idempotentReplay: true } });
    expect(facts()).toEqual(committed);
    if (operation === 'DELETE') expect(await items()).toEqual([]);
  });

  it.each([
    ['category', 'other'], ['expiryEstimated', true], ['dataSource', 'scan'],
  ])('rejects changed CREATE %s under the original item ID', async (field, value) => {
    const body = createBody({ category: 'other' });
    if (field === 'category') body.category = 'spice';
    expect((await create(body)).status).toBe(201);
    const committed = facts();
    expect(await create({ ...body, [field as string]: value })).toMatchObject({ status: 409,
      json: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(facts()).toEqual(committed);
  });

  it.each(['spice\0forged', 'x'.repeat(31), null, 12])('rejects invalid category %j on CREATE and PATCH', async (category) => {
    const before = facts();
    expect(await create(createBody({ category }))).toMatchObject({ status: 400, json: { code: 'VALIDATION_ERROR' } });
    expect(facts()).toEqual(before);
    expect((await create()).status).toBe(201);
    const created = facts();
    expect(await patch({ version: (await lot()).legacyVersion, category }))
      .toMatchObject({ status: 400, json: { code: 'VALIDATION_ERROR' } });
    expect(facts()).toEqual(created);
  });

  it('does not replay another household receipt or reveal its stock', async () => {
    const body = createBody();
    expect((await create(body)).status).toBe(201);
    const committed = facts();
    expect(await create(body, foreignToken)).toMatchObject({ status: 409, json: { code: 'CONFLICT' } });
    expect(await items(foreignToken)).toEqual([]);
    expect(facts()).toEqual(committed);
  });

  it('checks current membership before serving a CREATE receipt', async () => {
    const body = createBody();
    expect((await create(body)).status).toBe(201);
    db.seed("DELETE FROM household_members WHERE id = 'category-member'");
    const committed = facts();
    expect(await create(body)).toMatchObject({ status: 403, json: { code: 'TENANCY_VIOLATION' } });
    expect(facts()).toEqual(committed);
  });

  it('fails closed for native CREATE receipts without retained original manual intent', async () => {
    await executeInventoryLotCommand(db, scope, 'manual-create:category-item', {
      type: 'CREATE', lotId: 'category-item', ingredientId: null, rawName: 'CAT01 custom seasoning',
      quantity: 0.25, unit: 'pack', storageLocationId: location('PANTRY'), sourceType: 'MANUAL',
    });
    const committed = facts();
    expect(await create(createBody({ category: 'other', expiryDate: null })))
      .toMatchObject({ status: 409, json: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(facts()).toEqual(committed);
  });
});

const historicalNow = '2026-10-24T09:00:00Z';
async function legacyCategoryHousehold(historical = false) {
  if (historical) {
    db.close();
    db = new SqliteD1({ through: '0043_shopping_demand_review.sql' });
  }
  const owner = { householdId: 'category-legacy-home', actorId: `category-legacy-${crypto.randomUUID()}` };
  db.seed(`INSERT INTO users(id) VALUES ('${owner.actorId}');
    INSERT INTO households(id,name,created_by,created_at,updated_at)
      VALUES ('${owner.householdId}','Legacy category','${owner.actorId}','${historicalNow}','${historicalNow}');
    INSERT INTO household_members(id,household_id,user_id,role)
      VALUES ('category-legacy-member','${owner.householdId}','${owner.actorId}','owner');
    INSERT INTO inventory_items(id,household_id,ingredient_id,name,quantity,unit,category,storage,
      expiry_date,expiry_kind,expiry_source,created_at,updated_at,added_date,data_source)
      VALUES ('category-legacy-item','${owner.householdId}',NULL,'CAT01 legacy seasoning',0.25,'pack','spice','pantry',
        NULL,'unknown','unknown','${historicalNow}','${historicalNow}','${historicalNow}','manual');`);
  const bearer = await signJwt({ sub: owner.actorId, hid: owner.householdId, typ: 'access',
    exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
  return { owner, bearer };
}

// Frozen pre-0044 backfill/adoption SQL certifies historical NULL without disabling guards.
async function historicalCategorySnapshot(owner: { householdId: string; actorId: string }, adopted = false) {
  const locations = defaultStorageLocations(owner.householdId, historicalNow, historicalNow);
  const row = db.query<Parameters<typeof legacyInventoryToLot>[0]>(`SELECT id,household_id,ingredient_id,
    name,quantity,unit,storage,expiry_date,opened_at,expiry_kind,expiry_source,version,created_at,updated_at
    FROM inventory_items WHERE id = 'category-legacy-item'`)[0];
  const before = legacyInventoryToLot(row);
  before.storageLocationId = locations.find(({ type }) => type === 'PANTRY')!.id;
  expect(Object.keys(before)).toHaveLength(24);
  await db.batch([
    ...locations.map((location) => db.prepare(`INSERT INTO storage_locations
      (id,household_id,type,name,sort_order,is_default,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)`)
      .bind(location.id, owner.householdId, location.type, location.name, location.sortOrder, historicalNow, historicalNow)),
    db.prepare(`INSERT INTO inventory_lots
      (id,household_id,ingredient_id,raw_name,quantity_milli,canonical_unit,storage_location_id,
       state,purchased_at,opened_at,expiry_at,estimated_expiry_at,expiry_kind,source_type,source_id,
       version,created_at,updated_at,currency,amount_minor,minor_digits,
       legacy_expiry_at,legacy_expiry_kind,legacy_expiry_source,legacy_opened_at,legacy_version)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,NULL,?,?,?,?,?)`)
      .bind(before.id, before.householdId, before.ingredientId, before.rawName, before.quantityMilli,
        before.canonicalUnit, before.storageLocationId, before.state, before.purchasedAt, before.openedAt,
        before.expiryAt, before.estimatedExpiryAt, before.expiryKind, before.sourceType, before.sourceId,
        before.version, before.createdAt, before.updatedAt, before.legacyExpiryAt, before.legacyExpiryKind,
        before.legacyExpirySource, before.legacyOpenedAt, before.legacyVersion),
  ]);
  if (adopted) {
    const projection = db.query(`SELECT id,household_id,ingredient_id,name,quantity,unit,storage,
      expiry_date,opened_at,expiry_kind,expiry_source,version,category,data_source,freshness,
      added_date,created_at,updated_at FROM inventory_items WHERE id = 'category-legacy-item'`)[0];
    const sourceVersion = db.query<{ inventory_version: number }>(
      'SELECT inventory_version FROM households WHERE id = ?', owner.householdId)[0].inventory_version;
    const result = { schemaVersion: 3, commandType: 'ADOPT', ...owner,
      sourceInventoryVersion: sourceVersion, emptyHousehold: false, createdLocationCount: 0,
      createdSnapshotCount: 0, mappedLotCount: 1, effects: [{ ordinal: 0, lotId: before.id,
        legacyItemId: row.id, snapshotMissing: false, before,
        after: { ...before, version: before.version + 1, updatedAt: historicalNow },
        projectionBefore: projection, projectionAfter: projection, deltaMilli: 0, terminalEvidence: null }] };
    await db.batch([
      db.prepare('UPDATE households SET inventory_version = inventory_version + 1 WHERE id = ?').bind(owner.householdId),
      db.prepare(`INSERT INTO inventory_adoption_receipts
        (id,household_id,actor_id,source_inventory_version,fingerprint,result_json,created_at)
        VALUES (?,?,?,?,?,?,?)`).bind('historical-category-adoption', owner.householdId, owner.actorId,
        sourceVersion, JSON.stringify({ householdId: owner.householdId, terminalEvidence: [] }),
        JSON.stringify(result), historicalNow),
      db.prepare('UPDATE inventory_lots SET legacy_item_id = ?, version = version + 1 WHERE id = ?')
        .bind(row.id, before.id),
    ]);
  }
  db.seed(readFileSync('migrations/0044_inventory_display_category.sql', 'utf8'));
  expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
  expect(db.query('SELECT display_category FROM inventory_lots WHERE id = ?', before.id))
    .toEqual([{ display_category: null }]);
  return before;
}

describe('CAT01 category adoption and populated historical upgrade', () => {
  it('rolls back adoption when only the legacy source category changes after its snapshot', async () => {
    const { owner } = await legacyCategoryHousehold();
    await backfillLegacyInventory(db, owner.householdId);
    let concurrent: ReturnType<typeof facts> | undefined;
    db.hooks.beforeBatch = (statements) => {
      if (!statements.some(({ sql }) => sql.includes('INSERT INTO inventory_adoption_receipts'))) return;
      db.hooks = {};
      db.seed("UPDATE inventory_items SET category = 'condiment' WHERE id = 'category-legacy-item'");
      concurrent = facts();
    };
    await expect(executeInventoryAdoption(db, owner, {}, historicalNow)).rejects.toMatchObject({ code: 'STALE_SNAPSHOT' });
    expect(concurrent).toBeDefined();
    expect(facts()).toEqual(concurrent);
    expect(db.query('SELECT id FROM inventory_adoption_receipts WHERE household_id = ?', owner.householdId)).toEqual([]);
    expect(db.query('SELECT legacy_item_id,display_category FROM inventory_lots WHERE household_id = ?', owner.householdId))
      .toEqual([{ legacy_item_id: null, display_category: 'spice' }]);
  });

  it('fails closed on an invalid historical legacy category without repair or partial adoption', async () => {
    const { owner } = await legacyCategoryHousehold();
    await backfillLegacyInventory(db, owner.householdId);
    db.execute('UPDATE inventory_items SET category = ? WHERE id = ?', ['spice\0forged', 'category-legacy-item']);
    const before = facts();
    await expect(executeInventoryAdoption(db, owner, {}, historicalNow))
      .rejects.toMatchObject({ code: 'INVALID_ADOPTION_SNAPSHOT' });
    expect(facts()).toEqual(before);
    expect(db.query('SELECT id FROM inventory_adoption_receipts WHERE household_id = ?', owner.householdId)).toEqual([]);
  });

  it('captures legacy category only after an old unlinked NULL snapshot with a truthful omitted before', async () => {
    const { owner, bearer } = await legacyCategoryHousehold(true);
    const historical = await historicalCategorySnapshot(owner);
    const projection = db.query("SELECT * FROM inventory_items WHERE id = 'category-legacy-item'");
    const result = await executeInventoryAdoption(db, owner, {}, historicalNow);
    expect(result).toMatchObject({ replayed: false, result: { mappedLotCount: 1, createdSnapshotCount: 0,
      effects: [{ snapshotMissing: false, before: historical,
        after: { displayCategory: 'spice', quantityMilli: 250, canonicalUnit: 'pack', version: 2 },
        projectionBefore: { category: 'spice' }, projectionAfter: { category: 'spice' } }] } });
    expect(result.result.effects[0].before).not.toHaveProperty('displayCategory');
    expect(Object.keys(result.result.effects[0].before)).toHaveLength(24);
    expect(await readInventoryLot(db, owner, { legacyItemId: 'category-legacy-item' }))
      .toMatchObject({ category: 'spice', quantityMilli: 250, version: 2, legacyVersion: 1 });
    expect(await items(bearer)).toEqual([expect.objectContaining({ id: 'category-legacy-item', category: 'spice', quantity: 0.25 })]);
    expect(db.query("SELECT * FROM inventory_items WHERE id = 'category-legacy-item'")).toEqual(projection);
    const committed = facts();
    expect(await executeInventoryAdoption(db, owner, {}, historicalNow)).toEqual({ ...result, replayed: true });
    expect(facts()).toEqual(committed);
    expect(await assertProjectionParity(db, owner)).toEqual([]);
  });

  it('keeps an already adopted historical NULL category unknown despite a mutable projection', async () => {
    const { owner, bearer } = await legacyCategoryHousehold(true);
    const historical = await historicalCategorySnapshot(owner, true);
    const originalReceipt = db.query('SELECT * FROM inventory_adoption_receipts');
    const upgraded = facts();
    const replay = await executeInventoryAdoption(db, owner, {}, historicalNow);
    expect(replay.replayed).toBe(true);
    expect(replay.result.effects[0].before).toEqual(historical);
    expect(replay.result.effects[0].after).not.toHaveProperty('displayCategory');
    expect(facts()).toEqual(upgraded);
    for (const category of ['spice', 'condiment']) {
      if (category === 'condiment') db.seed("UPDATE inventory_items SET category = 'condiment' WHERE id = 'category-legacy-item'");
      const beforeRead = facts();
      expect(await readInventoryLot(db, owner, { legacyItemId: 'category-legacy-item' }))
        .toMatchObject({ category: 'other', quantityMilli: 250, version: 2, legacyVersion: 1 });
      expect(await items(bearer)).toEqual([expect.objectContaining({ id: 'category-legacy-item', category: 'other', quantity: 0.25 })]);
      expect(facts()).toEqual(beforeRead);
    }
    expect(db.query('SELECT * FROM inventory_adoption_receipts')).toEqual(originalReceipt);
    expect(db.query('SELECT display_category FROM inventory_lots WHERE household_id = ?', owner.householdId))
      .toEqual([{ display_category: null }]);
  });
});
