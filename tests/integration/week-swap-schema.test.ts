import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { backfillLegacyInventory } from '../../packages/db/src/inventory-truth';
import { executeInventoryAdoption } from '../../packages/db/src/inventory-adoption-executor';
import { executeInventoryLotCommand } from '../../packages/db/src/inventory-lot-commands';
import { SqliteD1 } from '../helpers/sqlite-d1';

const migration = readFileSync('migrations/0045_week_swap_receipts.sql', 'utf8');
const databases: SqliteD1[] = [];
function database(previous = false) {
  const db = new SqliteD1(previous ? { through: '0044_inventory_display_category.sql' } : {});
  databases.push(db);
  db.seed(`INSERT INTO users(id) VALUES ('swap-schema-user'), ('swap-schema-other');
    INSERT INTO households(id,name,created_by) VALUES
      ('swap-schema-home','Swap schema','swap-schema-user'), ('swap-schema-foreign','Other','swap-schema-other');`);
  return db;
}
afterEach(() => databases.splice(0).forEach((db) => db.close()));
function insert(db: SqliteD1, patch: Partial<{ id: string; home: string; actor: string; plan: string; meal: string; key: string; fingerprint: string }> = {}, verb = 'INSERT') {
  const row = { id: 'receipt-a', home: 'swap-schema-home', actor: 'swap-schema-user', plan: 'schema-plan',
    meal: 'schema-meal', key: 'schema-key-A', fingerprint: 'recipe-a', ...patch };
  return db.execute(`${verb} INTO week_swap_receipts
    (id,household_id,actor_id,plan_id,meal_id,client_key,fingerprint,created_at) VALUES (?,?,?,?,?,?,?,?)`,
  [row.id, row.home, row.actor, row.plan, row.meal, row.key, row.fingerprint, '2030-01-02T00:00:00Z']);
}
function receipts(db: SqliteD1) { return db.query('SELECT * FROM week_swap_receipts ORDER BY id'); }

describe('WKD02 additive immutable Week swap acceptance schema', () => {
  it('upgrades all populated prior tables without changing a row or inventing receipts', async () => {
    const db = database(true);
    await backfillLegacyInventory(db, 'demo_household_01');
    await executeInventoryAdoption(db, { householdId: 'demo_household_01', actorId: 'demo_user_01' }, {});
    const location = db.query<{ id: string }>("SELECT id FROM storage_locations WHERE household_id = 'demo_household_01' LIMIT 1")[0].id;
    await executeInventoryLotCommand(db, { householdId: 'demo_household_01', actorId: 'demo_user_01' }, 'schema-command',
      { type: 'CREATE', lotId: 'schema-lot', ingredientId: 'CHICKEN_EGG', rawName: 'Eggs', quantity: 3,
        unit: 'piece', storageLocationId: location, sourceType: 'MANUAL' }, '2030-01-02T00:00:00Z');
    db.seed(`INSERT INTO meal_plans(id,household_id,start_date,end_date,status)
      VALUES ('schema-plan','swap-schema-home','2030-01-02','2030-01-08','READY');
      INSERT INTO meal_plan_days(id,plan_id,day_of_week,date,day_type)
      VALUES ('schema-day','schema-plan',3,'2030-01-02','cooking');
      INSERT INTO meal_plan_slots(id,day_id,plan_id,slot_type,status)
      VALUES ('schema-meal','schema-day','schema-plan','dinner','PLANNED');`);
    expect(db.query('SELECT * FROM inventory_commands')).not.toHaveLength(0);
    expect(db.query('SELECT * FROM inventory_events')).not.toHaveLength(0);
    const tables = db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const facts = () => JSON.stringify(Object.fromEntries(tables.map(({ name }) => [name, db.query(`SELECT * FROM "${name}"`)])));
    const before = facts();
    db.seed(migration);
    expect(facts()).toBe(before);
    expect(receipts(db)).toEqual([]);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
    expect(db.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
  });

  it.each(['INSERT', 'INSERT OR REPLACE'])('blocks duplicate identity and replacement using %s', (verb) => {
    const db = database();
    insert(db);
    const before = receipts(db);
    for (const patch of [{}, { id: 'receipt-b', fingerprint: 'recipe-b' }, { meal: 'other-meal' }]) {
      expect(() => insert(db, patch, verb)).toThrow('Week swap receipt already exists');
      expect(receipts(db)).toEqual(before);
    }
  });

  it('guards UPDATE and direct DELETE while allowing household-lifetime cascade', () => {
    const db = database();
    insert(db);
    const before = receipts(db);
    expect(() => db.execute("UPDATE week_swap_receipts SET fingerprint = 'changed'")).toThrow('Week swap receipts are immutable');
    expect(() => db.execute('DELETE FROM week_swap_receipts')).toThrow('Week swap receipts are retained for household lifetime');
    expect(receipts(db)).toEqual(before);
    db.execute("DELETE FROM households WHERE id = 'swap-schema-home'");
    expect(receipts(db)).toEqual([]);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('scopes uniqueness to household/plan/meal/key with actor/household FKs only', () => {
    const db = database();
    insert(db);
    insert(db, { id: 'receipt-b', home: 'swap-schema-foreign', actor: 'swap-schema-other' });
    insert(db, { id: 'receipt-c', plan: 'other-plan' });
    insert(db, { id: 'receipt-d', meal: 'other-meal' });
    expect(receipts(db)).toHaveLength(4);
    expect(db.query<{ table: string }>('PRAGMA foreign_key_list(week_swap_receipts)').map((row) => row.table).sort()).toEqual(['households', 'users']);
    expect(db.query("SELECT * FROM sqlite_master WHERE type='trigger' AND tbl_name='week_swap_receipts'")).toHaveLength(3);
    expect(() => insert(db, { id: 'bad-home', home: 'missing-home' })).toThrow();
    expect(() => insert(db, { id: 'bad-user', actor: 'missing-user', key: 'other-key' })).toThrow();
    for (const patch of [{ plan: ' ' }, { meal: '' }, { key: 'short' }, { key: 'x'.repeat(201) }, { fingerprint: ' ' }]) {
      expect(() => insert(db, { id: 'bad-row', ...patch })).toThrow();
    }
    expect(receipts(db)).toHaveLength(4);
  });

  it('retains acceptance after plan/slot deletion and rolls back receipt with later batch failure', async () => {
    const db = database();
    db.seed(`INSERT INTO meal_plans(id,household_id,start_date,end_date,status)
      VALUES ('schema-plan','swap-schema-home','2030-01-02','2030-01-08','READY');
      INSERT INTO meal_plan_days(id,plan_id,day_of_week,date,day_type)
      VALUES ('schema-day','schema-plan',3,'2030-01-02','cooking');
      INSERT INTO meal_plan_slots(id,day_id,plan_id,slot_type,status)
      VALUES ('schema-meal','schema-day','schema-plan','dinner','PLANNED');`);
    insert(db);
    const before = receipts(db);
    db.execute("DELETE FROM meal_plans WHERE id = 'schema-plan'");
    expect(receipts(db)).toEqual(before);
    expect(db.query('SELECT * FROM meal_plan_slots')).toEqual([]);
    await expect(db.batch([
      db.prepare(`INSERT INTO week_swap_receipts(id,household_id,actor_id,plan_id,meal_id,client_key,fingerprint,created_at)
        VALUES ('receipt-b','swap-schema-home','swap-schema-user','schema-plan','schema-meal','schema-key-B','recipe-b','2030-01-02')`),
      db.prepare("INSERT INTO week_swap_receipts(id,household_id,actor_id,plan_id,meal_id,client_key,fingerprint,created_at) VALUES ('bad','missing','swap-schema-user','p','m','schema-key-C','r','2030-01-02')"),
    ])).rejects.toThrow();
    expect(receipts(db)).toEqual(before);
  });
});
