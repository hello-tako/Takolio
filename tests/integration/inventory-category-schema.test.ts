import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { executeInventoryFefoCommand, executeInventoryLotCommand, readLotCommandReceipt } from '../../packages/db/src/inventory-lot-commands';
import { SqliteD1, type SqliteStatementEvent } from '../helpers/sqlite-d1';

const scope = { householdId: 'category-schema-home', actorId: 'category-schema-owner' };
const now = '2026-10-24T10:00:00Z';
const databases: SqliteD1[] = [];
type Json = Record<string, unknown>;
type Statement = { sql: string; bindings: unknown[] };
const receiptColumns = ['id', 'household_id', 'actor_id', 'client_key', 'fingerprint', 'command_type', 'result_json', 'created_at'];
const isReceipt = (statement: Pick<Statement, 'sql'>) => /^INSERT INTO inventory_commands/.test(statement.sql);
const create = (patch: Json = {}) => ({ type: 'CREATE', lotId: 'category-schema-lot', ingredientId: null,
  rawName: 'Rice', quantity: 2, unit: 'g', storageLocationId: 'category-schema-pantry',
  sourceType: 'MANUAL', displayCategory: 'spice', ...patch });
const execute = (db: SqliteD1, key: string, input: unknown) => executeInventoryLotCommand(db, scope, key, input, now);

function database() {
  const db = new SqliteD1();
  databases.push(db);
  db.seed(`INSERT INTO users(id) VALUES ('${scope.actorId}');
    INSERT INTO households(id,name,created_by) VALUES ('${scope.householdId}','Category SQL','${scope.actorId}');
    INSERT INTO household_members(id,household_id,user_id,role)
      VALUES ('category-schema-member','${scope.householdId}','${scope.actorId}','owner');
    INSERT INTO storage_locations(id,household_id,type,name,sort_order,is_default,created_at,updated_at)
      VALUES ('category-schema-pantry','${scope.householdId}','PANTRY','Pantry',0,1,'${now}','${now}');`);
  return db;
}
afterEach(() => databases.splice(0).forEach((db) => db.close()));
function state(db: SqliteD1) {
  return JSON.stringify(['households', 'inventory_items', 'inventory_lots', 'inventory_commands', 'inventory_events']
    .map((table) => db.query(`SELECT * FROM ${table} ORDER BY id`)));
}
async function captured(type: 'CREATE' | 'CORRECT' | 'USE' | 'FEFO' = 'USE') {
  const db = database();
  if (type !== 'CREATE') await execute(db, 'seed', create({ ingredientId: type === 'FEFO' ? 'RICE' : null }));
  const before = state(db);
  let statements: Statement[] = [];
  db.hooks.beforeBatch = (batch: readonly SqliteStatementEvent[]) => {
    if (!batch.some(isReceipt)) return;
    statements = batch.map(({ sql, bindings }) => ({ sql, bindings: [...bindings] }));
    throw new Error('Capture category authority transaction');
  };
  const input = type === 'CREATE' ? create()
    : type === 'CORRECT' ? { type, lotId: 'category-schema-lot', expectedVersion: 1,
      changes: { displayCategory: 'condiment' }, reason: 'Correct label' }
    : { type: 'USE', lotId: 'category-schema-lot', expectedVersion: 1, quantity: 0.25, unit: 'g' };
  await expect(type === 'FEFO' ? executeInventoryFefoCommand(db, scope, 'attempt', {
    type: 'USE', mode: 'FEFO', ingredientId: 'RICE', quantity: 0.25, unit: 'g',
  }, now) : execute(db, 'attempt', input)).rejects.toMatchObject({ code: 'PERSISTENCE_FAILED' });
  db.hooks = {};
  expect(state(db)).toBe(before);
  expect(statements.filter(isReceipt)).toHaveLength(1);
  return { db, statements, receipt: statements.find(isReceipt)! };
}
function alter(statement: Statement, column: string, change: (value: Json) => void) {
  const index = receiptColumns.indexOf(column);
  const json = JSON.parse(statement.bindings[index] as string) as Json;
  change(json);
  statement.bindings[index] = JSON.stringify(json);
}
function after(result: Json): Json { return ((result.effects as Json[])[0].after as Json); }
async function rejected(fixture: Awaited<ReturnType<typeof captured>>, onlyReceipt = false, pattern = /Inventory category command evidence mismatch/) {
  const before = state(fixture.db);
  const statements = onlyReceipt ? [fixture.receipt] : fixture.statements;
  await expect(fixture.db.batch(statements.map(({ sql, bindings }) => fixture.db.prepare(sql).bind(...bindings))))
    .rejects.toThrow(pattern);
  expect(state(fixture.db)).toBe(before);
  expect(fixture.db.query('PRAGMA foreign_key_check')).toEqual([]);
}

describe('CAT01 SQL category boundaries and immutable evidence', () => {
  it.each(['', 'x'.repeat(30), '\u{1F355}'.repeat(15), null])('accepts raw column category %j', async (category) => {
    const db = database();
    await execute(db, 'seed', create());
    db.execute('UPDATE inventory_lots SET display_category = ?, version = version + 1 WHERE id = ?', [category, 'category-schema-lot']);
    expect(db.query('SELECT display_category FROM inventory_lots')).toEqual([{ display_category: category }]);
  });
  it.each(['x'.repeat(31), '\u{1F355}'.repeat(16), 'x\0hidden'])('rejects raw column category %j', async (category) => {
    const db = database();
    await execute(db, 'seed', create());
    const before = state(db);
    expect(() => db.execute('UPDATE inventory_lots SET display_category = ?, version = version + 1 WHERE id = ?', [category, 'category-schema-lot']))
      .toThrow(/constraint failed|Inventory display category is invalid/);
    expect(state(db)).toBe(before);
  });
  it.each(['CREATE', 'CORRECT', 'USE', 'FEFO'] as const)('commits valid %s category and preserves receipt replay', async (type) => {
    const fixture = await captured(type);
    await fixture.db.batch(fixture.statements.map(({ sql, bindings }) => fixture.db.prepare(sql).bind(...bindings)));
    expect(fixture.db.query('SELECT display_category FROM inventory_lots'))
      .toEqual([{ display_category: type === 'CORRECT' ? 'condiment' : 'spice' }]);
    expect(fixture.db.query("SELECT category FROM inventory_items WHERE id = 'category-schema-lot'")).toEqual([{ category: type === 'CORRECT' ? 'condiment' : type === 'FEFO' ? 'grain' : 'spice' }]);
    if (type !== 'FEFO') expect(await readLotCommandReceipt(fixture.db, scope, 'attempt'))
      .toMatchObject({ execution: { replayed: true } });
  });
  it.each([null, 12, 'x'.repeat(31), '\u{1F355}'.repeat(16), 'x\0hidden'])('rejects invalid CREATE receipt category %j before lot writes', async (category) => {
    const fixture = await captured('CREATE');
    alter(fixture.receipt, 'fingerprint', (value) => { (value.command as Json).displayCategory = category; });
    alter(fixture.receipt, 'result_json', (value) => { after(value).displayCategory = category; });
    await rejected(fixture, true);
  });
  it.each(['CREATE', 'CORRECT'] as const)('rejects %s category that contradicts fingerprint intent', async (type) => {
    const fixture = await captured(type);
    alter(fixture.receipt, 'result_json', (value) => { after(value).displayCategory = 'forged'; });
    await rejected(fixture, true);
  });
  it.each(['USE', 'FEFO'] as const)('rejects %s category mutation or omission', async (type) => {
    const fixture = await captured(type);
    alter(fixture.receipt, 'result_json', (value) => { delete after(value).displayCategory; });
    await rejected(fixture, true);
  });
  it.each(['USE', 'FEFO'] as const)('rejects %s forged before and matching after category', async (type) => {
    const fixture = await captured(type);
    alter(fixture.receipt, 'result_json', (value) => {
      const effect = (value.effects as Json[])[0];
      (effect.before as Json).displayCategory = 'forged';
      (effect.after as Json).displayCategory = 'forged';
    });
    await rejected(fixture, true);
  });
  it('rejects FEFO after extra keys instead of allowing a 25-field shape escape', async () => {
    const fixture = await captured('FEFO');
    alter(fixture.receipt, 'result_json', (value) => { after(value).unexpected = 'forged'; });
    await rejected(fixture, true, /Inventory FEFO command evidence mismatch/);
  });
  it('rejects lot/projection category poststate divergence atomically at the event fence', async () => {
    const fixture = await captured();
    const eventIndex = fixture.statements.findIndex(({ sql }) => /^INSERT INTO inventory_events/.test(sql) && sql.includes('command_id'));
    fixture.statements.splice(eventIndex, 0, { sql: 'UPDATE inventory_items SET category = ? WHERE id = ?',
      bindings: ['forged', 'category-schema-lot'] });
    await rejected(fixture, false, /Inventory category event evidence mismatch/);
  });
  it('omits NULL on historical snapshots and preserves old 24-field receipts byte for byte', async () => {
    const db = database();
    const input = create();
    delete (input as Json).displayCategory;
    const created = await execute(db, 'old-style', input);
    const receipt = db.query('SELECT fingerprint,result_json FROM inventory_commands');
    expect(created.result.effects[0].after).not.toHaveProperty('displayCategory');
    expect(Object.keys(created.result.effects[0].after)).toHaveLength(24);
    expect(await execute(db, 'old-style', input)).toEqual({ ...created, replayed: true });
    expect(db.query('SELECT fingerprint,result_json FROM inventory_commands')).toEqual(receipt);
    expect(db.query('SELECT display_category FROM inventory_lots')).toEqual([{ display_category: null }]);
  });
  it('retains exact 0030 FEFO guards after reversing only optional category shape additions', () => {
    const previous = readFileSync('migrations/0030_inventory_fefo_backfill_compatibility.sql', 'utf8');
    const next = readFileSync('migrations/0044_inventory_display_category.sql', 'utf8');
    for (const name of ['trg_inventory_commands_fefo_authority_insert', 'trg_inventory_events_command_fefo_authority_insert']) {
      const extract = (source: string) => source.match(new RegExp(`CREATE TRIGGER ${name}\\n[\\s\\S]*?\\nEND;`))![0];
      const normalized = extract(next)
        .replaceAll("24 + CASE WHEN json_type(e.value, '$.before.displayCategory') IS NULL THEN 0 ELSE 1 END", '24')
        .replaceAll("24 + CASE WHEN json_type(e.value, '$.after.displayCategory') IS NULL THEN 0 ELSE 1 END", '24')
        .replaceAll(", 'displayCategory'", '');
      expect(normalized).toBe(extract(previous));
    }
  });
});
