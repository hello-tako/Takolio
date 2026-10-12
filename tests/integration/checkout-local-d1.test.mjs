import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listMigrations, renderSchemaGateSql } from '../../scripts/d1-schema-gate.mjs';
import { startLocalD1Worker } from '../helpers/local-d1-worker.mjs';
let worker;
const token = randomUUID();
const post = async (path, body) => {
  const response = await worker.fetch(`http://localhost/${path}`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-token': token }, body: JSON.stringify(body) });
  expect(response.status).toBe(200);
  return response.json();
};
beforeAll(async () => {
  worker = await startLocalD1Worker({ name: 'checkout', token, databaseName: 'offline-checkout-test',
    databaseId: '00000000-0000-0000-0000-000000000041', script: 'tests/helpers/checkout-d1-worker.ts' });
  await worker.replayMigrations(expect);
  const schema = await post('', { statements: [
    { sql: 'CREATE TABLE IF NOT EXISTS d1_migrations (name TEXT PRIMARY KEY NOT NULL)' },
    ...listMigrations().map((name) => ({ sql: 'INSERT OR IGNORE INTO d1_migrations(name) VALUES (?)', values: [name] })),
    { sql: renderSchemaGateSql() },
  ] });
  expect(schema.results.at(-1).results).toEqual([]);
  await post('', { statements: [{ sql: "INSERT INTO users(id,email) VALUES ('offline-checkout-owner','offline@example.test')" }] });
}, 120000);
afterAll(async () => { await worker?.stop(); });
describe('actual local workerd D1 checkout protocol', () => {
  it('replays one durable offer and retains uncertainty without provider resubmission', async () => {
    const key = 'local_d1_checkout_generation';
    const first = await post('checkout', { key, plan: 'monthly' });
    const retry = await post('checkout', { key, plan: 'monthly' });
    expect(first.result.kind).toBe('created');
    expect(retry.result).toEqual({ ...first.result, kind: 'replay' });
    expect(retry.dispatchCount).toBe(first.dispatchCount);
    expect((await post('checkout', { key, plan: 'annual' })).result.kind).toBe('conflict');
    const uncertain = await post('checkout', { key: `${key}_lost`, plan: 'monthly', fail: true });
    const uncertainRetry = await post('checkout', { key: `${key}_lost`, plan: 'monthly' });
    expect(uncertain.result.kind).toBe('reconciliation');
    expect(uncertainRetry.result).toEqual(uncertain.result);
    expect(uncertainRetry.dispatchCount).toBe(uncertain.dispatchCount);
    const integrity = await post('', { statements: [{ sql: 'PRAGMA foreign_key_check' }, { sql: 'PRAGMA quick_check' }] });
    expect(integrity.results[0].results).toEqual([]);
    expect(integrity.results[1].results).toEqual([{ quick_check: 'ok' }]);
  });
});
