import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteD1 } from '../helpers/sqlite-d1';
import { createCheckout, readCheckout } from '../../src/worker/payment/checkout';
import { PLUS_PRICES } from '../../src/worker/payment/prices';

let db: SqliteD1;
const key = 'checkout_generation_001';
const instructions = { bankBin: '970422', accountNumber: '123456789', accountName: 'TEST ACCOUNT',
  transferContent: 'TEST', qrImageUrl: 'https://example.test/qr.png' };
const dispatch = vi.fn(async () => instructions);
beforeEach(() => {
  db = new SqliteD1();
  db.seed("INSERT INTO users(id,email) VALUES ('a','a@example.test'),('b','b@example.test')");
  dispatch.mockReset().mockResolvedValue(instructions);
});
afterEach(() => { db.close(); vi.useRealTimers(); });

describe('durable checkout creation with mock provider', () => {
  it('admits one order across concurrent retries and replays the immutable original price', async () => {
    const results = await Promise.all(Array.from({ length: 100 }, () => createCheckout(db, 'a', key, 'monthly', dispatch)));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(results.filter((result) => result.kind === 'created')).toHaveLength(1);
    expect(db.query('SELECT * FROM payment_intents')).toHaveLength(1);
    const first = results.find((result) => result.kind === 'created');
    expect(first?.kind === 'created' && first.payment.amountVnd).toBe(PLUS_PRICES.monthly);
    const retry = await createCheckout(db, 'a', key, 'monthly', dispatch);
    expect(retry.kind).toBe('replay');
    expect(retry.kind === 'replay' && retry.payment).toEqual(first?.kind === 'created' && first.payment);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
  });
  it('conflicts on changed plan without creating or dispatching another intent', async () => {
    await createCheckout(db, 'a', key, 'monthly', dispatch);
    expect((await createCheckout(db, 'a', key, 'annual', dispatch)).kind).toBe('conflict');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(db.query('SELECT * FROM payment_intents')).toHaveLength(1);
  });
  it('scopes the same key to the authenticated owner', async () => {
    const a = await createCheckout(db, 'a', key, 'monthly', dispatch);
    const b = await createCheckout(db, 'b', key, 'monthly', dispatch);
    expect(a.kind === 'created' && a.payment.id).not.toEqual(b.kind === 'created' && b.payment.id);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });
  it('keeps lost provider responses unresolved across repeated retries, never granting', async () => {
    dispatch.mockRejectedValueOnce(new Error('response lost after remote creation'));
    expect((await createCheckout(db, 'a', key, 'annual', dispatch)).kind).toBe('reconciliation');
    for (let i = 0; i < 10; i++) expect((await createCheckout(db, 'a', key, 'annual', dispatch)).kind).toBe('reconciliation');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(db.query('SELECT status FROM payment_intents')).toEqual([{ status: 'failed' }]);
    expect(db.query('SELECT * FROM payment_reconciliation_records')).toHaveLength(1);
    expect(db.query("SELECT * FROM subscriptions WHERE user_id = 'a'")).toHaveLength(0);
  });
  it('treats a crash after admission as uncertain rather than taking over provider creation', async () => {
    db.hooks.afterBatch = () => { throw new Error('simulated process crash'); };
    await expect(createCheckout(db, 'a', key, 'monthly', dispatch)).rejects.toThrow('simulated process crash');
    db.hooks = {};
    db.seed("UPDATE checkout_admissions SET deadline_at = '2000-01-01T00:00:00.000Z'");
    expect((await createCheckout(db, 'a', key, 'monthly', dispatch)).kind).toBe('reconciliation');
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('retains expired key tombstones and cannot silently buy another offer', async () => {
    await createCheckout(db, 'a', key, 'monthly', dispatch);
    db.seed("UPDATE payment_intents SET expires_at = '2000-01-01T00:00:00.000Z'");
    expect((await createCheckout(db, 'a', key, 'monthly', dispatch)).kind).toBe('expired');
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
  it('fences late provider completion after another request records deadline uncertainty', async () => {
    let complete!: (value: typeof instructions) => void;
    dispatch.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const first = createCheckout(db, 'a', key, 'monthly', dispatch);
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    db.seed("UPDATE checkout_admissions SET deadline_at = '2000-01-01T00:00:00.000Z'");
    expect((await createCheckout(db, 'a', key, 'monthly', dispatch)).kind).toBe('reconciliation');
    complete(instructions);
    expect((await first).kind).toBe('reconciliation');
    expect(db.query('SELECT state,instructions_json FROM checkout_admissions')).toEqual([{ state: 'remote_uncertain', instructions_json: null }]);
  });
  it('rejects malformed provider instructions without advertising a QR or retrying', async () => {
    dispatch.mockResolvedValueOnce({ ...instructions, qrImageUrl: 'javascript:alert(1)' });
    expect((await createCheckout(db, 'a', key, 'monthly', dispatch)).kind).toBe('reconciliation');
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});


it('resumes owned instructions without dispatch and never returns foreign checkout data', async () => {
  const result = await createCheckout(db, 'a', key, 'monthly', dispatch);
  expect(result.kind).toBe('created');
  if (result.kind !== 'created') throw new Error('Fixture failed');
  expect((await readCheckout(db, 'a', result.payment.id))?.kind).toBe('replay');
  expect(await readCheckout(db, 'b', result.payment.id)).toBeNull();
  expect(dispatch).toHaveBeenCalledTimes(1);
});


it('does not return stale pending state when a signed settlement wins before the create response', async () => {
  dispatch.mockImplementationOnce(async () => {
    db.seed("UPDATE payment_intents SET status = 'paid', provider_reference = 'TEST_ONLY_SETTLED'");
    return instructions;
  });
  const result = await createCheckout(db, 'a', key, 'monthly', dispatch);
  expect(result.kind === 'created' && result.payment.status).toBe('paid');
});


it('bounds a provider that ignores cancellation and rejects its late completion', async () => {
  vi.useFakeTimers();
  let complete!: (value: typeof instructions) => void;
  dispatch.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  const pending = createCheckout(db, 'a', key, 'monthly', dispatch);
  await vi.advanceTimersByTimeAsync(0);
  expect(dispatch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(30_001);
  expect((await pending).kind).toBe('reconciliation');
  complete(instructions);
  await vi.advanceTimersByTimeAsync(0);
  expect((await createCheckout(db, 'a', key, 'monthly', dispatch)).kind).toBe('reconciliation');
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(db.query('SELECT state,instructions_json FROM checkout_admissions')).toEqual([
    { state: 'remote_uncertain', instructions_json: null },
  ]);
});

it('recovers an already committed ready order after losing the database response', async () => {
  let batches = 0;
  db.hooks.afterBatch = () => { if (++batches === 2) throw new Error('lost committed ready response'); };
  expect((await createCheckout(db, 'a', key, 'monthly', dispatch)).kind).toBe('reconciliation');
  db.hooks = {};
  const retry = await createCheckout(db, 'a', key, 'monthly', dispatch);
  expect(retry.kind).toBe('replay');
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(db.query('SELECT * FROM payment_reconciliation_records')).toHaveLength(0);
  expect(db.query('SELECT status FROM payment_intents')).toEqual([{ status: 'pending' }]);
});
