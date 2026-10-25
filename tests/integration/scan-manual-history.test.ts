import { executeInventoryLotCommand } from '../../packages/db/src/inventory-lot-commands';
import { readInventoryLot } from '../../packages/db/src/inventory-read-authority';
import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { executeInventoryAdoption } from '../../packages/db/src/inventory-adoption-executor';
import { backfillLegacyInventory } from '../../packages/db/src/inventory-truth';
import type { InventoryScanEvidence } from '../../packages/domain/src/inventory-lot-commands';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { inventoryRoutes } from '../../src/worker/routes/inventory';
import { scanRoutes } from '../../src/worker/routes/scans';
import type { AuthContext, Env } from '../../src/worker/types';
import { signJwt } from '../../src/worker/utils/jwt';
import { createBarrier, SqliteD1 } from '../helpers/sqlite-d1';

const scope = { householdId: 'manual-history-home', actorId: 'manual-history-user' };
const secret = 'test-only-scan-manual-history-secret';
const modes = ['legacy', 'native'] as const;
const lanes = modes.flatMap((mode) => (['fridge', 'receipt'] as const).map((scanType) => ({ mode, scanType })));
const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use('*', authMiddleware);
app.route('/', inventoryRoutes);
app.route('/', scanRoutes);
let db: SqliteD1;
let token: string;

beforeEach(async () => {
  db = new SqliteD1();
  db.seed(`INSERT INTO users(id) VALUES ('manual-history-user');
    INSERT INTO households(id, name, created_by) VALUES ('manual-history-home', 'History', 'manual-history-user');
    INSERT INTO household_members(id, household_id, user_id, role)
      VALUES ('manual-history-member', 'manual-history-home', 'manual-history-user', 'owner');`);
  token = await signJwt({ sub: scope.actorId, hid: scope.householdId, typ: 'access',
    exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
});
afterEach(() => db.close());

async function request(method: string, path: string, body?: unknown) {
  const response = await app.fetch(new Request(`https://manual-history.example${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, ENVIRONMENT: 'test', JWT_SECRET: secret, WEEK_SCHEMA_MODE: 'legacy' });
  return { status: response.status, json: await response.json() as Record<string, unknown> };
}
async function authority(mode: typeof modes[number]) {
  if (mode === 'native') {
    await backfillLegacyInventory(db, scope.householdId);
    await executeInventoryAdoption(db, scope, {}, '2026-10-24T10:00:00Z');
  }
}
function seedScan(scanId: string, scanType: 'fridge' | 'receipt' = 'fridge') {
  db.execute(`INSERT INTO scans(id, user_id, household_id, status, scan_type, purchase_date)
    VALUES (?, ?, ?, 'ready', ?, ?)`,
  [scanId, scope.actorId, scope.householdId, scanType, scanType === 'receipt' ? '2026-09-12' : null]);
}
function prediction(scanId: string, id: string) {
  db.execute(`INSERT INTO scan_items(id, scan_id, raw_name, canonical_id, estimated_quantity,
    unit, confidence, category, storage) VALUES (?, ?, ?, NULL, 2, 'piece', 0.9, 'other', 'fridge')`,
  [id, scanId, `Unknown legacy prediction ${id}`]);
}
const manual = (overrides: Record<string, unknown> = {}) => ({
  id: 'draft_manual_salt', rawName: 'SCAN01 manual salt', estimatedQuantity: 0.25,
  unit: 'pack', category: 'other', storage: 'pantry', ...overrides,
});
const historyId = (scanId: string, clientId: string | null, index: number) =>
  `scan_manual_${createHash('sha256').update(JSON.stringify([scanId, clientId, index])).digest('hex')}`;
const history = (scanId: string) => db.query('SELECT * FROM scan_items WHERE scan_id = ? ORDER BY id', scanId);
function facts() {
  return Object.fromEntries(['inventory_lots', 'inventory_items', 'inventory_commands', 'inventory_events',
    'inventory_observations', 'inventory_reconciliation_decisions', 'inventory_adoption_receipts',
    'scan_items', 'scans', 'households', 'storage_locations']
    .map((table) => [table, db.query(`SELECT * FROM ${table} ORDER BY id`)]));
}
async function reviewed(scanId: string) {
  const result = await request('GET', `/scans/${scanId}`);
  expect(result.status).toBe(200);
  return (result.json.scan as { items: Array<Record<string, unknown>> }).items;
}
function noMachineEvidence(row: Record<string, unknown>) {
  for (const key of ['ocr_raw_name', 'ocr_quantity', 'ocr_unit', 'ocr_confidence', 'ocr_canonical_id',
    'ocr_category', 'ocr_storage', 'unit_price_vnd', 'total_price_vnd']) expect(row[key]).toBeNull();
}
function noMachineClaims(item: Record<string, unknown>) {
  for (const key of ['confidence', 'rawEvidence', 'unitPriceVnd', 'totalPriceVnd'])
    expect(item).not.toHaveProperty(key);
}
const stock = () => db.query('SELECT * FROM inventory_items WHERE household_id = ? ORDER BY id', scope.householdId);

// Real migrated SQLite, HTTP handlers and authority commands; no mocked persistence or resolver.
describe('SCAN01 accepted manual scan review history', () => {
  it.each(lanes)('persists fractional review once through fresh GET: $mode/$scanType', async ({ mode, scanType }) => {
    await authority(mode);
    const scanId = `roundtrip-${mode}-${scanType}`;
    seedScan(scanId, scanType);
    const payload = { items: [manual()] };
    const result = await request('POST', `/scans/${scanId}/confirm`, payload);
    expect(result.status).toBe(200);
    expect(result.json.confirmedItemIds).toEqual([]);
    expect(stock()).toEqual([expect.objectContaining({ name: 'SCAN01 manual salt', quantity: 0.25,
      unit: 'pack', category: 'other', storage: 'pantry' })]);
    const rows = history(scanId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: historyId(scanId, 'draft_manual_salt', 0), scan_id: scanId,
      raw_name: 'SCAN01 manual salt', canonical_id: null, estimated_quantity: 0.25, unit: 'pack',
      category: 'other', storage: 'pantry', is_confirmed: 1, review_state: 'CONFIRMED',
      reviewed_expiry_date: null, reviewed_expiry_kind: 'UNKNOWN' });
    noMachineEvidence(rows[0]);
    const items = await reviewed(scanId);
    expect(items).toEqual([expect.objectContaining({ id: rows[0].id, scanId, isManual: true,
      rawName: 'SCAN01 manual salt', canonicalId: null, estimatedQuantity: 0.25, unit: 'pack',
      category: 'other', storage: 'pantry', isConfirmed: true, reviewState: 'CONFIRMED', expiryKind: 'UNKNOWN' })]);
    noMachineClaims(items[0]);
    expect(items[0]).not.toHaveProperty('expiryDate');
    if (mode === 'native') {
      expect(db.query('SELECT quantity_milli, expiry_kind FROM inventory_lots'))
        .toEqual([{ quantity_milli: 250, expiry_kind: 'ESTIMATED' }]);
      const commands = db.query<{ fingerprint: string }>(`SELECT fingerprint FROM inventory_commands
        WHERE json_extract(fingerprint, '$.command.scanEvidence.scanId') = ?`, scanId);
      expect(commands).toHaveLength(1);
      const evidence = JSON.parse(commands[0].fingerprint).command.scanEvidence as InventoryScanEvidence;
      expect(evidence.lines).toEqual([expect.objectContaining({ scanItemId: null,
        raw: { rawName: null, quantity: null, unit: null }, corrected: false })]);
      expect(db.query('SELECT raw_name FROM inventory_observations')).toEqual([{ raw_name: null }]);
    }
    const committed = facts();
    for (const retry of [payload, { items: [manual({ rawName: 'Altered valid retry', estimatedQuantity: 9 })] }]) {
      expect(await request('POST', `/scans/${scanId}/confirm`, retry))
        .toMatchObject({ status: 200, json: { idempotentReplay: true } });
      expect(facts()).toEqual(committed);
    }
  });

  it.each(lanes)('keeps expiry, rejection, omission and original input indices: $mode/$scanType', async ({ mode, scanType }) => {
    await authority(mode);
    const scanId = `expiry-${mode}-${scanType}`;
    seedScan(scanId, scanType);
    prediction(scanId, 'rejected-prediction');
    prediction(scanId, 'accepted-prediction');
    prediction(scanId, 'omitted-prediction');
    const items = [
      { id: 'rejected-prediction', rejected: true },
      manual({ id: 'draft_rejected', rawName: 'Rejected manual', rejected: true }),
      manual({ id: 'draft_known', rawName: 'Known manual', expiryDate: '2030-10-25' }),
      manual({ id: undefined, rawName: 'Estimated manual', expiryDate: '2030-10-26', expiryEstimated: true }),
      manual({ id: undefined, rawName: 'Unknown manual' }),
      { id: 'accepted-prediction', estimatedQuantity: 1, isManual: true },
    ];
    const result = await request('POST', `/scans/${scanId}/confirm`, { items });
    expect(result.status).toBe(200);
    expect(result.json.confirmedItemIds).toEqual(['accepted-prediction']);
    const rows = history(scanId);
    expect(rows).toHaveLength(6);
    const manualRows = rows.filter((row) => String(row.id).startsWith('scan_manual_'));
    expect(manualRows).toHaveLength(3);
    for (const [id, name, kind, date] of [
      [historyId(scanId, 'draft_known', 2), 'Known manual', 'KNOWN', '2030-10-25'],
      [historyId(scanId, null, 3), 'Estimated manual', 'ESTIMATED', '2030-10-26'],
      [historyId(scanId, null, 4), 'Unknown manual', 'UNKNOWN', null],
    ]) {
      const row = manualRows.find((entry) => entry.id === id)!;
      expect(row).toMatchObject({ raw_name: name, reviewed_expiry_kind: kind, reviewed_expiry_date: date,
        is_confirmed: 1, review_state: 'CONFIRMED' });
      noMachineEvidence(row);
    }
    expect(rows.find((row) => row.id === 'rejected-prediction')).toMatchObject({ review_state: 'REJECTED', is_confirmed: 0 });
    expect(rows.find((row) => row.id === 'omitted-prediction')).toMatchObject({ review_state: 'PENDING', is_confirmed: 0 });
    expect(stock().some((row) => row.name === 'Rejected manual')).toBe(false);
    const fresh = await reviewed(scanId);
    for (const [index, kind, date, estimated] of [[2, 'KNOWN', '2030-10-25', false], [3, 'ESTIMATED', '2030-10-26', true]] as const) {
      expect(fresh.find((item) => item.id === historyId(scanId, index === 2 ? 'draft_known' : null, index)))
        .toMatchObject({ isManual: true, expiryKind: kind, expiryDate: date, expiryEstimated: estimated });
    }
    expect(fresh.find((item) => item.id === historyId(scanId, null, 4)))
      .toMatchObject({ isManual: true, expiryKind: 'UNKNOWN' });
    for (const id of ['accepted-prediction', 'omitted-prediction']) {
      const item = fresh.find((entry) => entry.id === id)!;
      expect(item).not.toHaveProperty('isManual');
      noMachineClaims(item);
    }
  });

  it('scopes long draft IDs by scan, distinguishes no-ID rows, rejects duplicate input IDs atomically', async () => {
    const clientId = `draft_${'punctuation:/.?[]'.repeat(12)}`;
    for (const scanId of ['identity-one', 'identity-two']) {
      seedScan(scanId);
      expect((await request('POST', `/scans/${scanId}/confirm`, { items: [manual({ id: clientId }),
        manual({ id: undefined, rawName: 'No ID one' }), manual({ id: undefined, rawName: 'No ID two' })] })).status).toBe(200);
      const ids = history(scanId).map((row) => row.id);
      expect(ids).toEqual([historyId(scanId, clientId, 0), historyId(scanId, null, 1), historyId(scanId, null, 2)].sort());
      for (const id of ids) expect(id).toMatch(/^scan_manual_[a-f0-9]{64}$/);
    }
    const allIds = db.query<{ id: string }>('SELECT id FROM scan_items').map((row) => row.id);
    expect(new Set(allIds).size).toBe(6);
    seedScan('duplicate-input');
    const before = facts();
    expect(await request('POST', '/scans/duplicate-input/confirm', { items: [manual(), manual()] }))
      .toMatchObject({ status: 400, json: { code: 'DUPLICATE_SCAN_ITEM' } });
    expect(facts()).toEqual(before);
  });

  it.each(modes)('rejects a global history ID collision without replacing another scan: %s', async (mode) => {
    await authority(mode);
    seedScan('collision-target');
    seedScan('collision-other');
    const expectedId = historyId('collision-target', 'draft_manual_salt', 0);
    prediction('collision-other', expectedId);
    const before = facts();
    expect(await request('POST', '/scans/collision-target/confirm', { items: [manual()] }))
      .toMatchObject({ status: 500, json: { code: 'DATABASE_ERROR' } });
    expect(facts()).toEqual(before);
    expect(history('collision-other')).toEqual(before.scan_items);
  });

  it.each(modes)('rolls back history, stock and receipts on the final status failure, then retries once: %s', async (mode) => {
    await authority(mode);
    seedScan('rollback');
    db.seed(`CREATE TRIGGER scan01_injected_status_failure BEFORE UPDATE OF status ON scans
      WHEN NEW.id = 'rollback' AND NEW.status = 'confirmed'
      BEGIN SELECT RAISE(ABORT, 'injected SCAN01 status failure'); END;`);
    const before = facts();
    expect(await request('POST', '/scans/rollback/confirm', { items: [manual()] }))
      .toMatchObject({ status: 500, json: { code: 'DATABASE_ERROR' } });
    expect(facts()).toEqual(before);
    db.seed('DROP TRIGGER scan01_injected_status_failure');
    expect((await request('POST', '/scans/rollback/confirm', { items: [manual()] })).status).toBe(200);
    expect(history('rollback')).toHaveLength(1);
    expect(stock()).toEqual([expect.objectContaining({ quantity: 0.25 })]);
  });

  it.each(lanes)('retains each manual review while preserving existing stock merge semantics: $mode/$scanType', async ({ mode, scanType }) => {
    await authority(mode);
    expect((await request('POST', '/inventory', { id: 'existing-tomatoes', name: 'Cà chua', quantity: 3,
      unit: 'piece', category: 'vegetable', storage: 'pantry', expiryDate: '2030-10-01' })).status).toBe(201);
    const old = db.query('SELECT * FROM inventory_lots WHERE legacy_item_id = ?', 'existing-tomatoes')[0];
    const scanId = `merge-${mode}-${scanType}`;
    seedScan(scanId, scanType);
    const payload = { items: [manual({ id: 'draft_tomato_a', rawName: 'Cà chua', estimatedQuantity: 2,
      unit: 'piece', category: 'spice', storage: 'freezer', expiryDate: '2030-10-12' }),
    manual({ id: 'draft_tomato_b', rawName: 'Cà chua', estimatedQuantity: 1, unit: 'piece',
      category: 'other', storage: 'fridge', expiryDate: '2030-10-13', expiryEstimated: true })] };
    expect((await request('POST', `/scans/${scanId}/confirm`, payload)).status).toBe(200);
    expect(history(scanId)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: historyId(scanId, 'draft_tomato_a', 0), canonical_id: 'TOMATO',
        estimated_quantity: 2, category: 'spice', storage: 'freezer', reviewed_expiry_date: '2030-10-12', reviewed_expiry_kind: 'KNOWN' }),
      expect.objectContaining({ id: historyId(scanId, 'draft_tomato_b', 1), canonical_id: 'TOMATO',
        estimated_quantity: 1, category: 'other', storage: 'fridge', reviewed_expiry_date: '2030-10-13', reviewed_expiry_kind: 'ESTIMATED' }),
    ]));
    expect(history(scanId)).toHaveLength(2);
    history(scanId).forEach(noMachineEvidence);
    expect(stock().reduce((sum, row) => sum + Number(row.quantity), 0)).toBe(6);
    const lots = db.query('SELECT * FROM inventory_lots ORDER BY id');
    if (mode === 'native' && scanType === 'receipt') {
      expect(lots).toHaveLength(3);
      expect(lots.find((lot) => lot.id === old.id)).toEqual(old);
      const purchases = lots.filter((lot) => lot.id !== old.id);
      expect(purchases.map((lot) => lot.quantity_milli).sort()).toEqual([1000, 2000]);
      for (const lot of purchases) expect(lot).toMatchObject({ source_type: 'RECEIPT', source_id: scanId,
        purchased_at: '2026-09-12', amount_minor: null, currency: null, minor_digits: null });
    } else if (mode === 'native') {
      expect(lots).toHaveLength(1);
      expect(lots[0]).toEqual({ ...old, quantity_milli: 6000, version: Number(old.version) + 1,
        legacy_version: Number(old.legacy_version) + 1, updated_at: lots[0].updated_at });
    } else {
      expect(stock()).toEqual([expect.objectContaining({ id: 'existing-tomatoes', name: 'Cà chua', quantity: 6,
        unit: 'piece', category: 'vegetable', storage: 'pantry', expiry_date: '2030-10-01' })]);
    }
    const committed = facts();
    expect(await request('POST', `/scans/${scanId}/confirm`, payload))
      .toMatchObject({ status: 200, json: { idempotentReplay: true } });
    expect(facts()).toEqual(committed);
  });

  it.each(modes)('keeps history empty on an incompatible stock unit: %s', async (mode) => {
    await authority(mode);
    expect((await request('POST', '/inventory', { id: 'unit-conflict', name: 'SCAN01 manual salt',
      quantity: 2, unit: 'g', category: 'other', storage: 'pantry' })).status).toBe(201);
    seedScan('unit-conflict-scan');
    const before = facts();
    expect(await request('POST', '/scans/unit-conflict-scan/confirm', { items: [manual()] }))
      .toMatchObject({ status: 422, json: { code: 'UNIT_MISMATCH' } });
    expect(facts()).toEqual(before);
  });

  it.each(lanes)('fences concurrent manual twins at the actual commit barrier: $mode/$scanType', async ({ mode, scanType }) => {
    await authority(mode);
    seedScan('concurrent', scanType);
    const payload = { items: [manual()] };
    const barrier = createBarrier(2);
    db.hooks.beforeBatch = async (statements) => {
      if (statements.some((statement) => /UPDATE scans SET status = 'confirmed'/.test(statement.sql))) await barrier.wait();
    };
    const results = await Promise.all([request('POST', '/scans/concurrent/confirm', payload),
      request('POST', '/scans/concurrent/confirm', payload)]);
    db.hooks = {};
    expect(barrier.arrivals).toBe(2);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(results.filter((result) => result.json.idempotentReplay === true)).toHaveLength(1);
    expect(results[0].json.items).toEqual(results[1].json.items);
    expect(history('concurrent')).toHaveLength(1);
    expect(stock()).toEqual([expect.objectContaining({ quantity: 0.25 })]);
    expect(db.query('SELECT id FROM inventory_events WHERE household_id = ?', scope.householdId)).toHaveLength(1);
    if (mode === 'native') {
      expect(db.query('SELECT id FROM inventory_observations WHERE household_id = ?', scope.householdId)).toHaveLength(1);
      expect(db.query(`SELECT id FROM inventory_commands WHERE
        json_extract(fingerprint, '$.command.scanEvidence.scanId') = 'concurrent'`)).toHaveLength(1);
    }
    const committed = facts();
    expect(await request('POST', '/scans/concurrent/confirm', payload))
      .toMatchObject({ status: 200, json: { idempotentReplay: true } });
    expect(facts()).toEqual(committed);
  });

  it.each(lanes)('rolls back manual history when prepared inventory becomes stale: $mode/$scanType', async ({ mode, scanType }) => {
    await authority(mode);
    expect((await request('POST', '/inventory', { id: 'stale-manual-stock', name: 'SCAN01 manual salt',
      quantity: 1, unit: 'pack', category: 'other', storage: 'pantry' })).status).toBe(201);
    seedScan('stale-manual', scanType);
    let reached!: () => void;
    let release!: () => void;
    const prepared = new Promise<void>((resolve) => { reached = resolve; });
    const resume = new Promise<void>((resolve) => { release = resolve; });
    db.hooks.beforeBatch = async (statements) => {
      if (statements.some(({ sql }) => /UPDATE scans SET status = 'confirmed'/.test(sql))) {
        reached();
        await resume;
      }
    };
    const pending = request('POST', '/scans/stale-manual/confirm', { items: [manual()] });
    await prepared;
    expect((await request('PATCH', '/inventory/stale-manual-stock', { version: 1, quantity: 2 })).status).toBe(200);
    const winner = facts();
    release();
    // Native raw batch conflicts retain the existing generic error; both lanes must roll back.
    expect(await pending).toMatchObject(mode === 'native'
      ? { status: 500, json: { code: 'DATABASE_ERROR' } }
      : { status: 409, json: { code: 'INVENTORY_CONFLICT' } });
    db.hooks = {};
    expect(facts()).toEqual(winner);
    expect(history('stale-manual')).toEqual([]);
  });

  it.each(['fridge', 'receipt'] as const)('fences manual %s history when adoption wins before commit', async (scanType) => {
    await backfillLegacyInventory(db, scope.householdId);
    seedScan('adoption-race', scanType);
    let reached!: () => void;
    let release!: () => void;
    const prepared = new Promise<void>((resolve) => { reached = resolve; });
    const resume = new Promise<void>((resolve) => { release = resolve; });
    db.hooks.beforeBatch = async (statements) => {
      if (statements.some(({ sql }) => /UPDATE scans SET status = 'confirmed'/.test(sql))) {
        reached();
        await resume;
      }
    };
    const pending = request('POST', '/scans/adoption-race/confirm', { items: [manual()] });
    await prepared;
    await executeInventoryAdoption(db, scope, {}, '2026-10-24T10:00:00Z');
    const winner = facts();
    release();
    expect(await pending).toMatchObject({ status: 409, json: { code: 'INVENTORY_AUTHORITY_REQUIRED' } });
    db.hooks = {};
    expect(facts()).toEqual(winner);
    expect(history('adoption-race')).toEqual([]);
  });

  it.each(modes)('rejects foreign scan/item IDs and invalid manual fields without partial history: %s', async (mode) => {
    await authority(mode);
    db.execute('INSERT INTO users(id) VALUES (?)', ['manual-history-foreign-user']);
    db.execute('INSERT INTO households(id, name, created_by) VALUES (?, ?, ?)',
      ['manual-history-foreign-home', 'Foreign', 'manual-history-foreign-user']);
    db.execute(`INSERT INTO household_members(id, household_id, user_id, role) VALUES (?, ?, ?, 'owner')`,
      ['manual-history-foreign-member', 'manual-history-foreign-home', 'manual-history-foreign-user']);
    db.execute(`INSERT INTO scans(id, user_id, household_id, status, scan_type) VALUES (?, ?, ?, 'ready', 'fridge')`,
      ['foreign-scan', 'manual-history-foreign-user', 'manual-history-foreign-home']);
    prediction('foreign-scan', 'scan_item_foreign_0');
    seedScan('validation-scan');
    const before = facts();
    expect((await request('GET', '/scans/foreign-scan')).status).toBe(404);
    expect((await request('POST', '/scans/foreign-scan/confirm', { items: [manual()] })).status).toBe(404);
    expect(facts()).toEqual(before);
    for (const invalid of [manual({ id: 'scan_item_foreign_0', isManual: true }),
      manual({ id: 'draft_invalid', estimatedQuantity: 0 }),
      manual({ id: 'draft_invalid', estimatedQuantity: 10001 }),
      manual({ id: 'draft_invalid', category: 'bad\0category' }),
      manual({ id: 'draft_invalid', category: 'x'.repeat(31) }),
      manual({ id: 'draft_invalid', expiryDate: 'not-a-date' })]) {
      expect((await request('POST', '/scans/validation-scan/confirm', { items: [manual(), invalid] })).status).toBe(400);
      expect(facts()).toEqual(before);
    }
  });

  it.each(lanes)('recovers a lost acknowledgement after COMMIT with immutable manual history: $mode/$scanType', async ({ mode, scanType }) => {
    await authority(mode);
    seedScan('lost-ack', scanType);
    let committed: ReturnType<typeof facts> | undefined;
    db.hooks.beforeBatch = (statements) => {
      if (statements.some((statement) => /UPDATE scans SET status = 'confirmed'/.test(statement.sql))) {
        db.hooks.afterBatch = () => {
          committed = facts();
          db.hooks = {};
          throw new Error('SCAN01 lost acknowledgement after SQLite COMMIT');
        };
      }
    };
    const payload = { items: [manual()] };
    expect(await request('POST', '/scans/lost-ack/confirm', payload))
      .toMatchObject({ status: 200, json: { idempotentReplay: true } });
    expect(committed).toBeDefined();
    expect(facts()).toEqual(committed);
    expect(history('lost-ack')).toHaveLength(1);
    expect(stock()).toEqual([expect.objectContaining({ quantity: 0.25 })]);
    expect(await request('POST', '/scans/lost-ack/confirm', payload))
      .toMatchObject({ status: 200, json: { idempotentReplay: true } });
    expect(facts()).toEqual(committed);
  });

  it.each(['fridge', 'receipt'] as const)('keeps manual %s history immutable after stock edit, MOVE and USE', async (scanType) => {
    await authority('native');
    seedScan('immutable-history', scanType);
    expect((await request('POST', '/scans/immutable-history/confirm', { items: [manual({
      expiryDate: '2030-10-25', expiryEstimated: true,
    })] })).status).toBe(200);
    const rows = history('immutable-history');
    const dto = await reviewed('immutable-history');
    const [created] = db.query<{ id: string }>('SELECT id FROM inventory_lots');
    const initial = await readInventoryLot(db, scope, { lotId: created.id });
    expect((await request('PATCH', `/inventory/${initial.legacyItemId}`, {
      version: initial.legacyVersion, category: 'spice', expiryDate: '2030-11-01', expiryEstimated: false,
    })).status).toBe(200);
    const freezer = db.query<{ id: string }>('SELECT id FROM storage_locations WHERE household_id = ? AND type = ?',
      scope.householdId, 'FREEZER')[0];
    for (const command of [{ type: 'MOVE', storageLocationId: freezer.id },
      { type: 'USE', quantity: 0.05, unit: 'pack', reason: 'Cooked' }]) {
      const lot = await readInventoryLot(db, scope, { lotId: created.id });
      await executeInventoryLotCommand(db, scope, `history-${command.type.toLowerCase()}`, {
        ...command, lotId: lot.lotId, expectedVersion: lot.version,
      });
      expect(history('immutable-history')).toEqual(rows);
      expect(await reviewed('immutable-history')).toEqual(dto);
    }
    expect(await readInventoryLot(db, scope, { lotId: created.id }))
      .toMatchObject({ quantityMilli: 200, storage: 'freezer', category: 'spice', expiryKind: 'KNOWN', expiryAt: '2030-11-01' });
    expect(rows).toEqual([expect.objectContaining({ estimated_quantity: 0.25, category: 'other', storage: 'pantry',
      reviewed_expiry_date: '2030-10-25', reviewed_expiry_kind: 'ESTIMATED' })]);
  });
});
