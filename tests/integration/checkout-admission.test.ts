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
  it('creates, replays and resumes an alphanumeric payOS virtual account without another dispatch', async () => {
    const virtualInstructions = { ...instructions, accountNumber: 'VQRTEST1234567897' };
    dispatch.mockResolvedValueOnce(virtualInstructions);
    const first = await createCheckout(db, 'a', key, 'monthly', dispatch);
    expect(first.kind).toBe('created');
    if (first.kind !== 'created') throw new Error('Virtual-account checkout failed');
    expect(first.payment.instructions).toEqual(virtualInstructions);
    expect(await createCheckout(db, 'a', key, 'monthly', dispatch)).toEqual({ kind: 'replay', payment: first.payment });
    expect(await readCheckout(db, 'a', first.payment.id)).toEqual({ kind: 'replay', payment: first.payment });
    expect(await readCheckout(db, 'b', first.payment.id)).toBeNull();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(db.query('SELECT state FROM checkout_admissions')).toEqual([{ state: 'ready' }]);
    expect(db.query('SELECT * FROM payment_reconciliation_records')).toEqual([]);
  });
  it.each(['VQR/path', 'VQR?query', 'VQR account', 'VQR_123', 'VQR-123', 'VQR\u00e9123', 'x'.repeat(33)])(
    'does not advertise or retry unsafe virtual-account instructions (%s)', async (accountNumber) => {
      dispatch.mockResolvedValueOnce({ ...instructions, accountNumber });
      expect((await createCheckout(db, 'a', key, 'monthly', dispatch)).kind).toBe('reconciliation');
      expect((await createCheckout(db, 'a', key, 'monthly', dispatch)).kind).toBe('reconciliation');
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(db.query('SELECT state,instructions_json FROM checkout_admissions')).toEqual([
        { state: 'remote_uncertain', instructions_json: null },
      ]);
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


describe('owner outstanding-order fence', () => {
  it('admits one provider order across concurrent different keys and plans without orphan rows', async () => {
    const results = await Promise.all(Array.from({ length: 100 }, (_, index) =>
      createCheckout(db, 'a', `different_checkout_key_${index}`, index % 2 ? 'annual' : 'monthly', dispatch)));
    const created = results.find((result) => result.kind === 'created');
    expect(created?.kind).toBe('created');
    if (created?.kind !== 'created') throw new Error('Admission fixture failed');
    expect(results.filter((result) => result.kind === 'created')).toHaveLength(1);
    expect(results.filter((result) => result.kind === 'in_progress')).toHaveLength(99);
    expect(results.filter((result) => result.kind === 'in_progress').every((result) => result.kind !== 'in_progress' || result.intentId === created.payment.id)).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(db.query('SELECT * FROM payment_intents')).toHaveLength(1);
    expect(db.query('SELECT * FROM checkout_admissions')).toHaveLength(1);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
  });

  it.each(['2099-01-01T00:00:00.000Z', 'invalid'])('blocks a legacy pending order with expiry %s without fabricating QR', async (expiry) => {
    db.seed(`INSERT INTO payment_intents
      (id,user_id,plan,amount_vnd,currency,order_code,description,status,expires_at)
      VALUES ('legacy-pending','a','monthly',49000,'VND','100001','TP100001','pending','${expiry}')`);
    expect(await createCheckout(db, 'a', key, 'annual', dispatch)).toEqual({ kind: 'in_progress', intentId: 'legacy-pending' });
    expect(dispatch).not.toHaveBeenCalled();
    expect(db.query('SELECT * FROM payment_intents')).toHaveLength(1);
    expect(db.query('SELECT * FROM checkout_admissions')).toEqual([]);
    expect(await readCheckout(db, 'a', 'legacy-pending')).toBeNull();
    expect((await createCheckout(db, 'b', key, 'monthly', dispatch)).kind).toBe('created');
  });

  it('keeps ready same-key replay but blocks a different key until that offer expires', async () => {
    const first = await createCheckout(db, 'a', key, 'monthly', dispatch);
    expect(first.kind).toBe('created');
    if (first.kind !== 'created') throw new Error('Admission fixture failed');
    expect(await createCheckout(db, 'a', `${key}_new`, 'annual', dispatch)).toEqual({ kind: 'in_progress', intentId: first.payment.id });
    expect((await createCheckout(db, 'a', key, 'monthly', dispatch)).kind).toBe('replay');
    db.seed("UPDATE payment_intents SET expires_at = '2000-01-01T00:00:00.000Z'");
    expect((await createCheckout(db, 'a', key, 'monthly', dispatch)).kind).toBe('expired');
    expect((await createCheckout(db, 'a', `${key}_new`, 'annual', dispatch)).kind).toBe('created');
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(db.query('SELECT * FROM payment_intents')).toHaveLength(2);
  });

  it('blocks another key indefinitely after an ambiguous provider response, even after expiry', async () => {
    dispatch.mockRejectedValueOnce(new Error('response lost'));
    const first = await createCheckout(db, 'a', key, 'monthly', dispatch);
    expect(first.kind).toBe('reconciliation');
    if (first.kind !== 'reconciliation') throw new Error('Uncertainty fixture failed');
    db.seed("UPDATE payment_intents SET expires_at = '2000-01-01T00:00:00.000Z'");
    expect(await createCheckout(db, 'a', `${key}_new`, 'annual', dispatch)).toEqual(first);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(db.query('SELECT * FROM payment_intents')).toHaveLength(1);
    expect(db.query('SELECT * FROM checkout_admissions')).toHaveLength(1);
  });

  it('returns the existing dispatch and converts a crossed deadline to reconciliation on a different key', async () => {
    db.hooks.afterBatch = () => { throw new Error('simulated crash'); };
    await expect(createCheckout(db, 'a', key, 'monthly', dispatch)).rejects.toThrow('simulated crash');
    db.hooks = {};
    const id = db.query<{ id: string }>('SELECT id FROM payment_intents')[0].id;
    expect(await createCheckout(db, 'a', `${key}_new`, 'annual', dispatch)).toEqual({ kind: 'in_progress', intentId: id });
    db.seed("UPDATE checkout_admissions SET deadline_at = '2000-01-01T00:00:00.000Z'");
    expect(await createCheckout(db, 'a', `${key}_new`, 'annual', dispatch)).toEqual({ kind: 'reconciliation', intentId: id });
    expect(dispatch).not.toHaveBeenCalled();
    expect(db.query('SELECT state FROM checkout_admissions')).toEqual([{ state: 'remote_uncertain' }]);
    expect(db.query('SELECT * FROM payment_intents')).toHaveLength(1);
  });
});
