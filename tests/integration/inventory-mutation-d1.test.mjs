import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startLocalD1Worker } from '../helpers/local-d1-worker.mjs';

let worker;
const token = randomUUID();
const headers = { 'Content-Type': 'application/json', 'x-test-token': token };
const scope = { userId: 'inventory-mutation-user', householdId: 'inventory-mutation-household' };
async function sql(statements) {
  const response = await worker.fetch('http://localhost/', {
    method: 'POST', headers, body: JSON.stringify({ statements: statements.map(sql => ({ sql })) }),
  });
  expect(response.status).toBe(200);
  return (await response.json()).results;
}
async function route(path, method, payload, extraHeaders = {}, identity = scope) {
  const response = await worker.fetch('http://localhost/inventory-route', {
    method: 'POST', headers,
    body: JSON.stringify({ ...identity, path, method, payload, headers: extraHeaders }),
  });
  expect(response.status).toBe(200);
  return response.json();
}

beforeAll(async () => {
  worker = await startLocalD1Worker({ name: 'inventory-mutation', token,
    databaseName: 'inventory-mutation-isolated', databaseId: '00000000-0000-0000-0000-000000000025',
    script: 'tests/helpers/inventory-mutation-d1-worker.ts' });
  await worker.replayMigrations(expect);
  await sql([
    "INSERT INTO users(id) VALUES ('inventory-mutation-user'),('inventory-foreign-user')",
    "INSERT INTO households(id,name,created_by) VALUES ('inventory-mutation-household','Synthetic mutations','inventory-mutation-user'),('inventory-foreign-household','Foreign','inventory-foreign-user')",
    "INSERT INTO household_members(id,household_id,user_id,role) VALUES ('inventory-mutation-member','inventory-mutation-household','inventory-mutation-user','owner'),('inventory-foreign-member','inventory-foreign-household','inventory-foreign-user','owner')",
  ]);
}, 120_000);
afterAll(async () => { await worker?.stop(); });

describe('legacy inventory mutations on actual local D1', () => {
  it('acknowledges one successful CAS despite household revision triggers, rejects stale writes, and replays commands', async () => {
    expect(await route('/inventory', 'POST', { id: 'mutation-update', name: 'Synthetic pantry item', quantity: 2,
      unit: 'pack', storage: 'pantry', dataSource: 'manual' })).toMatchObject({ status: 201, body: { item: { version: 1 } } });
    const patch = { version: 1, quantity: 3 };
    const key = { 'Idempotency-Key': 'inventory-d1-update' };
    expect(await route('/inventory/mutation-update', 'PATCH', patch))
      .toMatchObject({ status: 200, body: { success: true, item: { quantity: 3, version: 2 } } });
    const nextPatch = { version: 2, quantity: 4 };
    expect(await route('/inventory/mutation-update', 'PATCH', nextPatch, key))
      .toMatchObject({ status: 200, body: { item: { quantity: 4, version: 3 } } });
    expect(await route('/inventory/mutation-update', 'PATCH', nextPatch, key))
      .toMatchObject({ status: 200, body: { idempotentReplay: true, item: { quantity: 4, version: 3 } } });
    expect(await route('/inventory/mutation-update', 'PATCH', { version: 1, quantity: 99 }))
      .toMatchObject({ status: 409, body: { code: 'CONFLICT' } });
    const facts = await sql([
      "SELECT quantity,version FROM inventory_items WHERE id='mutation-update'",
      "SELECT count(*) AS total FROM inventory_events WHERE inventory_item_id='mutation-update' AND event_type='MANUAL_UPDATE'",
    ]);
    expect(facts[0].results).toEqual([{ quantity: 4, version: 3 }]);
    expect(facts[1].results).toEqual([{ total: 2 }]);
  });

  it('acknowledges soft deletion, preserves one audit event and denies cross-household writes', async () => {
    expect(await route('/inventory', 'POST', { id: 'mutation-delete', name: 'Synthetic discard item', quantity: 2,
      unit: 'pack', storage: 'pantry', dataSource: 'manual' })).toMatchObject({ status: 201 });
    const foreign = { userId: 'inventory-foreign-user', householdId: 'inventory-foreign-household' };
    expect(await route('/inventory/mutation-delete', 'DELETE', undefined, { 'If-Match': '1' }, foreign))
      .toMatchObject({ status: 404 });
    const key = { 'If-Match': '1' };
    expect(await route('/inventory/mutation-delete', 'DELETE', undefined, key))
      .toMatchObject({ status: 200, body: { success: true } });
    expect(await route('/inventory/mutation-delete', 'DELETE', undefined, key))
      .toMatchObject({ status: 409, body: { code: 'CONFLICT' } });
    const facts = await sql([
      "SELECT quantity,version,freshness FROM inventory_items WHERE id='mutation-delete'",
      "SELECT count(*) AS total FROM inventory_events WHERE inventory_item_id='mutation-delete' AND event_type='DISCARD'",
    ]);
    expect(facts[0].results).toEqual([{ quantity: 0, version: 2, freshness: 'out_of_stock' }]);
    expect(facts[1].results).toEqual([{ total: 1 }]);
  });
});
