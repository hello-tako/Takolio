import { z } from 'zod';
import { CheckoutKeySchema } from '../../shared/billing';
import type { CreatedPaymentIntent, PlusPlan } from '../../shared/payment';
import type { D1DatabaseBinding } from '@frigo/db';
import { INTENT_TTL_SECONDS, newOrderCode, PAYMENT_CURRENCY, paymentView, type PaymentRow } from './authority';
import { PLUS_PRICES } from './prices';
import type { createPayosInstructions } from './payos';

export const checkoutKeySchema = CheckoutKeySchema;
export const checkoutInstructionsSchema = z.object({
  bankBin: z.string().regex(/^\d{6}$/), accountNumber: z.string().regex(/^[A-Za-z\d]{1,32}$/),
  accountName: z.string().min(1).max(200), transferContent: z.string().min(1).max(200),
  qrImageUrl: z.string().url().refine((value) => new URL(value).protocol === 'https:'),
});
interface CheckoutRow extends PaymentRow {
  checkout_plan: PlusPlan;
  state: 'dispatching' | 'ready' | 'remote_uncertain';
  attempt_id: string;
  deadline_at: string;
  instructions_json: string | null;
}
export type CheckoutResult =
  | { kind: 'created'; payment: CreatedPaymentIntent }
  | { kind: 'replay'; payment: CreatedPaymentIntent }
  | { kind: 'conflict' | 'expired' | 'in_progress' | 'reconciliation'; intentId: string };

export const verifiedPaidPaymentPredicate = `(p.status = 'paid' AND p.provider_reference IS NOT NULL)`;
export const outstandingPaymentPredicate = `p.user_id = ? AND NOT ${verifiedPaidPaymentPredicate}
  AND ((p.status = 'pending' AND
  (julianday(p.expires_at) IS NULL OR julianday(p.expires_at) > julianday(?)))
  OR a.state IN ('dispatching', 'remote_uncertain'))`;

const readSql = `SELECT p.*, a.plan AS checkout_plan, a.state, a.attempt_id,
  a.deadline_at, a.instructions_json FROM checkout_admissions a
  JOIN payment_intents p ON p.id = a.intent_id WHERE a.user_id = ? AND a.request_key = ?`;

async function uncertain(db: D1DatabaseBinding, row: Pick<CheckoutRow, 'id'>, reason: 'provider_outcome_unknown' | 'attempt_deadline') {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE payment_intents SET status = 'failed', updated_at = ?
      WHERE id = ? AND status = 'pending' AND EXISTS
      (SELECT 1 FROM checkout_admissions WHERE intent_id = ? AND state = 'dispatching')`)
      .bind(now, row.id, row.id),
    db.prepare(`INSERT INTO payment_reconciliation_records
      (intent_id,reason,first_observed_at,last_observed_at)
      SELECT intent_id,?,?,? FROM checkout_admissions WHERE intent_id = ? AND state = 'dispatching'
      ON CONFLICT(intent_id) DO UPDATE SET last_observed_at = excluded.last_observed_at`)
      .bind(reason, now, now, row.id),
    db.prepare(`UPDATE checkout_admissions SET state = 'remote_uncertain', updated_at = ?
      WHERE intent_id = ? AND state = 'dispatching'`).bind(now, row.id),
  ]);
}

export async function createCheckout(
  db: D1DatabaseBinding, userId: string, key: string, plan: PlusPlan,
  dispatch: (intent: PaymentRow) => ReturnType<typeof createPayosInstructions>,
  prices: Readonly<Record<PlusPlan, number>> = PLUS_PRICES,
): Promise<CheckoutResult> {
  checkoutKeySchema.parse(key);
  const now = new Date().toISOString();
  const id = `pay_${crypto.randomUUID()}`;
  const orderCode = newOrderCode();
  const attemptId = crypto.randomUUID();
  const expiresAt = new Date((Math.floor(Date.now() / 1000) + INTENT_TTL_SECONDS) * 1000).toISOString();
  const deadlineAt = new Date(Date.now() + 30_000).toISOString();
  // Both inserts are one transaction; losing admissions create neither rows nor orders.
  await db.batch([
    db.prepare(`INSERT INTO payment_intents
      (id,user_id,plan,amount_vnd,currency,order_code,description,expires_at)
      SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS
      (SELECT 1 FROM checkout_admissions WHERE user_id = ? AND request_key = ?)
      AND NOT EXISTS (SELECT 1 FROM payment_intents p LEFT JOIN checkout_admissions a
        ON a.intent_id = p.id AND a.user_id = p.user_id WHERE ${outstandingPaymentPredicate})`)
      .bind(id, userId, plan, prices[plan], PAYMENT_CURRENCY, orderCode,
        `TP${orderCode.slice(-7)}`, expiresAt, userId, key, userId, now),
    db.prepare(`INSERT INTO checkout_admissions
      (user_id,request_key,intent_id,plan,state,attempt_id,deadline_at,created_at,updated_at)
      SELECT ?,?,?,?,'dispatching',?,?,?,? FROM payment_intents WHERE id = ?`)
      .bind(userId, key, id, plan, attemptId, deadlineAt, now, now, id),
  ]);
  const row = await db.prepare(readSql).bind(userId, key).first<CheckoutRow>();
  if (!row) {
    const outstanding = await db.prepare(`SELECT p.id, a.state, a.deadline_at FROM payment_intents p
      LEFT JOIN checkout_admissions a ON a.intent_id = p.id AND a.user_id = p.user_id
      WHERE ${outstandingPaymentPredicate}
      ORDER BY CASE WHEN a.state IN ('dispatching', 'remote_uncertain') THEN 0 ELSE 1 END,
        datetime(p.created_at) DESC, p.id DESC LIMIT 1`)
      .bind(userId, now).first<{ id: string; state: CheckoutRow['state'] | null; deadline_at: string | null }>();
    if (!outstanding) throw new Error('CHECKOUT_ADMISSION_UNAVAILABLE');
    if (outstanding.state === 'remote_uncertain') return { kind: 'reconciliation', intentId: outstanding.id };
    if (outstanding.state === 'dispatching' && (outstanding.deadline_at === null
        || !Number.isFinite(Date.parse(outstanding.deadline_at)) || Date.parse(outstanding.deadline_at) <= Date.now())) {
      await uncertain(db, outstanding, 'attempt_deadline');
      return { kind: 'reconciliation', intentId: outstanding.id };
    }
    return { kind: 'in_progress', intentId: outstanding.id };
  }
  if (row.checkout_plan !== plan) return { kind: 'conflict', intentId: row.id };
  if (row.state === 'remote_uncertain') return { kind: 'reconciliation', intentId: row.id };
  if (row.state === 'dispatching' && Date.parse(row.deadline_at) <= Date.now()) {
    await uncertain(db, row, 'attempt_deadline');
    return { kind: 'reconciliation', intentId: row.id };
  }
  if (Date.parse(row.expires_at) <= Date.now()) return { kind: 'expired', intentId: row.id };
  if (row.state === 'ready') {
    const instructions = checkoutInstructionsSchema.parse(JSON.parse(row.instructions_json!));
    return { kind: 'replay', payment: { ...paymentView(row), instructions } };
  }
  if (row.attempt_id !== attemptId) return { kind: 'in_progress', intentId: row.id };
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let value: Awaited<ReturnType<typeof createPayosInstructions>>;
    try {
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('CHECKOUT_ATTEMPT_DEADLINE')),
          Math.max(0, Date.parse(row.deadline_at) - Date.now()));
      });
      value = await Promise.race([Promise.resolve().then(() => dispatch(row)), deadline]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
    const instructions = checkoutInstructionsSchema.parse(value);
    const finishedAt = new Date().toISOString();
    const results = await db.batch([
      db.prepare(`UPDATE payment_intents SET description = ?, updated_at = ? WHERE id = ? AND EXISTS
        (SELECT 1 FROM checkout_admissions WHERE intent_id = ? AND state = 'dispatching'
         AND attempt_id = ? AND deadline_at > ?)`)
        .bind(instructions.transferContent, finishedAt, row.id, row.id, attemptId, finishedAt),
      db.prepare(`UPDATE checkout_admissions SET state = 'ready', instructions_json = ?, updated_at = ?
        WHERE intent_id = ? AND state = 'dispatching' AND attempt_id = ? AND deadline_at > ?`)
        .bind(JSON.stringify(instructions), finishedAt, row.id, attemptId, finishedAt),
    ]);
    if (results[1].meta?.changes !== 1) {
      await uncertain(db, row, 'attempt_deadline');
      return { kind: 'reconciliation', intentId: row.id };
    }
    const current = await db.prepare('SELECT * FROM payment_intents WHERE id = ? AND user_id = ?').bind(row.id, userId).first<PaymentRow>();
    if (!current) throw new Error('CHECKOUT_INTENT_UNAVAILABLE');
    return { kind: 'created', payment: { ...paymentView(current), instructions } };
  } catch {
    // Any exception after admission may hide a remote order. Never issue a replacement.
    await uncertain(db, row, 'provider_outcome_unknown');
    return { kind: 'reconciliation', intentId: row.id };
  }
}


export async function readCheckout(db: D1DatabaseBinding, userId: string, intentId: string): Promise<CheckoutResult | null> {
  const row = await db.prepare(`SELECT p.*, a.plan AS checkout_plan, a.state, a.attempt_id,
    a.deadline_at, a.instructions_json FROM checkout_admissions a
    JOIN payment_intents p ON p.id = a.intent_id WHERE a.user_id = ? AND a.intent_id = ?`)
    .bind(userId, intentId).first<CheckoutRow>();
  if (!row) return null;
  if (row.state !== 'ready') return { kind: row.state === 'remote_uncertain' || Date.parse(row.deadline_at) <= Date.now()
    ? 'reconciliation' : 'in_progress', intentId: row.id };
  if (Date.parse(row.expires_at) <= Date.now()) return { kind: 'expired', intentId: row.id };
  const instructions = checkoutInstructionsSchema.parse(JSON.parse(row.instructions_json!));
  return { kind: 'replay', payment: { ...paymentView(row), instructions } };
}
