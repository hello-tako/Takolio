import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { BillingAccountResponseSchema, BillingCheckoutStateSchema, BillingPlanRequestSchema } from '../../shared/billing';
import { z } from 'zod';
import type { Env, AuthContext } from '../types';
import { rateLimiter } from '../middleware/rate-limit';
import {
  isValidIssuedIntent, INTENT_TTL_SECONDS, newOrderCode, PAYMENT_CURRENCY,
  paymentView, plusPrices, type PaymentRow,
} from '../payment/authority';
import { effectivePlusPrices } from '../payment/prices';
import { getScanQuotaEntitlement } from '../config/scan-quota-policy';
import { checkoutInstructionsSchema, checkoutKeySchema, createCheckout, outstandingPaymentPredicate, readCheckout, verifiedPaidPaymentPredicate } from '../payment/checkout';
import { createPayosInstructions, payosConfigured, verifyPayosData } from '../payment/payos';

export const billingRoutes = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
const planRequest = BillingPlanRequestSchema;
const webhookData = z.object({
  orderCode: z.number().int().positive().safe(),
  amount: z.number().int().positive().safe(),
  currency: z.string(),
  reference: z.string().min(1).max(200),
  code: z.string().min(1),
});

billingRoutes.use('/billing/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  if (c.req.path.endsWith('/billing/payos/webhook')) return next();
  const auth = c.get('auth');
  if (!auth?.userId || auth.isGuest) return c.json({ error: 'Đăng nhập bắt buộc', code: 'UNAUTHORIZED' }, 401);
  if (!c.env.DB) return c.json({ error: 'Dịch vụ thanh toán chưa sẵn sàng', code: 'DATABASE_UNAVAILABLE' }, 503);
  return next();
});

billingRoutes.get('/billing/plans', (c) => {
  try {
    return c.json({ plans: plusPrices(c.env), checkoutAdmissionEnabled: c.env.CHECKOUT_ADMISSION_ENABLED === 'true' });
  } catch {
    return c.json({ error: 'Cấu hình giá chưa hợp lệ', code: 'PAYMENT_PRICE_CONFIGURATION_INVALID' }, 503);
  }
});


const historyRowSchema = z.object({
  id: z.string().min(1), user_id: z.string().min(1), plan: z.enum(['monthly', 'annual']),
  amount_vnd: z.number().int().positive().safe(), currency: z.literal('VND'),
  order_code: z.string().min(1), description: z.string().min(1),
  status: z.enum(['pending', 'paid', 'failed', 'expired', 'refunded']), expires_at: z.string(),
  provider_reference: z.string().nullable(), created_at: z.string(),
  checkout_plan: z.enum(['monthly', 'annual']).nullable(), checkout_state: BillingCheckoutStateSchema.nullable(),
  checkout_deadline: z.string().nullable(), instructions_json: z.string().nullable(),
});
const subscriptionRowSchema = z.object({
  plan: z.enum(['free', 'plus']), status: z.string().min(1).max(50), expires_at: z.string().nullable(),
});
function billingTimestamp(value: string): string {
  const canonical = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value);
  const sqlite = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value);
  if (!canonical && !sqlite) throw new Error('BILLING_TIMESTAMP_INVALID');
  const utc = sqlite ? `${value.replace(' ', 'T')}Z` : value;
  const normalized = /\.\d{3}Z$/.test(utc) ? utc : utc.replace('Z', '.000Z');
  if (!Number.isFinite(Date.parse(normalized)) || new Date(normalized).toISOString() !== normalized) {
    throw new Error('BILLING_TIMESTAMP_INVALID');
  }
  return normalized;
}

billingRoutes.get('/billing/account', async (c) => {
  const userId = c.get('auth').userId;
  const now = new Date();
  let snapshot;
  try {
    // One read snapshot covers entitlement, recent history and outstanding orders outside the page.
    snapshot = await c.env.DB.batch([
      c.env.DB.prepare('SELECT plan, status, expires_at FROM subscriptions WHERE user_id = ?').bind(userId),
      c.env.DB.prepare(`SELECT p.*, a.plan AS checkout_plan, a.state AS checkout_state,
        a.deadline_at AS checkout_deadline, a.instructions_json
        FROM payment_intents p LEFT JOIN checkout_admissions a ON a.intent_id = p.id AND a.user_id = p.user_id
        WHERE p.user_id = ? ORDER BY datetime(p.created_at) DESC, p.id DESC LIMIT 21`).bind(userId),
      c.env.DB.prepare(`SELECT EXISTS (SELECT 1 FROM payment_intents p
        LEFT JOIN checkout_admissions a ON a.intent_id = p.id AND a.user_id = p.user_id
        WHERE ${outstandingPaymentPredicate}) AS has_pending`).bind(userId, now.toISOString()),
    ]);
    if (snapshot.length !== 3 || snapshot.some((result) => result.success !== true)) throw new Error('BILLING_READ_FAILED');
  } catch {
    return c.json({ error: 'Chưa đọc được tài khoản thanh toán', code: 'BILLING_ACCOUNT_UNAVAILABLE' }, 503);
  }
  try {
    if (snapshot[0].results.length > 1 || snapshot[1].results.length > 21) throw new Error('BILLING_ROWS_INVALID');
    const rawSubscription = snapshot[0].results[0];
    const subscription = rawSubscription === undefined ? null : subscriptionRowSchema.parse(rawSubscription);
    const expiresAt = subscription?.expires_at === null || !subscription ? null : billingTimestamp(subscription.expires_at);
    const entitlement = getScanQuotaEntitlement(subscription ? { ...subscription, expires_at: expiresAt } : null, now);
    const expired = subscription?.plan === 'plus'
      && (subscription.status === 'expired' || (expiresAt !== null && Date.parse(expiresAt) <= now.getTime()));
    const payments = snapshot[1].results.slice(0, 20).map((value) => {
      const row = historyRowSchema.parse(value);
      if (row.user_id !== userId || !isValidIssuedIntent(row)) throw new Error('BILLING_PAYMENT_INVALID');
      const payment = paymentView(row, now.getTime());
      let checkoutState = row.checkout_state;
      if (checkoutState !== null) {
        if (row.checkout_plan !== row.plan || row.checkout_deadline === null) throw new Error('BILLING_CHECKOUT_INVALID');
        const deadline = billingTimestamp(row.checkout_deadline);
        if (checkoutState === 'dispatching' && Date.parse(deadline) <= now.getTime()) checkoutState = 'remote_uncertain';
        if (checkoutState === 'ready') {
          const instructions = checkoutInstructionsSchema.parse(JSON.parse(row.instructions_json ?? 'null'));
          if (instructions.transferContent !== row.description) throw new Error('BILLING_CHECKOUT_INVALID');
        } else if (row.instructions_json !== null) throw new Error('BILLING_CHECKOUT_INVALID');
      } else if (row.checkout_plan !== null || row.checkout_deadline !== null || row.instructions_json !== null) {
        throw new Error('BILLING_CHECKOUT_INVALID');
      }
      return { ...payment, createdAt: billingTimestamp(row.created_at), expiresAt: billingTimestamp(row.expires_at), checkoutState,
        canResume: c.env.CHECKOUT_ADMISSION_ENABLED === 'true' && checkoutState === 'ready' && payment.status === 'pending' };
    });
    const pending = z.object({ has_pending: z.number().int().min(0).max(1) }).parse(snapshot[2].results[0]);
    const account = BillingAccountResponseSchema.parse({
      subscription: { plan: entitlement.plan, status: entitlement.isPlus ? 'active' : expired ? 'expired' : 'inactive', expiresAt },
      payments, hasMore: snapshot[1].results.length > 20, hasPendingPayment: pending.has_pending === 1,
    });
    return c.json(account);
  } catch {
    return c.json({ error: 'Dữ liệu thanh toán cần được kiểm tra', code: 'BILLING_ACCOUNT_INVALID' }, 409);
  }
});

billingRoutes.post('/billing/payment-intents', rateLimiter({
  maxRequests: 10, windowSeconds: 60, prefix: 'rl_payment_create', enforcement: 'fail-closed',
}), async (c) => {
  // Extra legacy fields are ignored; none can override server monetary values.
  const parsed = planRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Gói Plus không hợp lệ', code: 'INVALID_PLAN' }, 400);
  let prices;
  try { prices = effectivePlusPrices(c.env); } catch {
    return c.json({ error: 'Cấu hình giá chưa hợp lệ', code: 'PAYMENT_PRICE_CONFIGURATION_INVALID' }, 503);
  }
  if (!payosConfigured(c.env)) return c.json({ error: 'Thanh toán tạm thời chưa khả dụng', code: 'PAYMENT_UNAVAILABLE' }, 503);
  const { plan } = parsed.data;
  const suppliedKey = c.req.header('Idempotency-Key');
  if (suppliedKey !== undefined || c.env.CHECKOUT_ADMISSION_ENABLED === 'true') {
    if (c.env.CHECKOUT_ADMISSION_ENABLED !== 'true') return c.json({ code: 'CHECKOUT_ADMISSION_DISABLED' }, 503);
    const key = suppliedKey ?? crypto.randomUUID();
    if (!checkoutKeySchema.safeParse(key).success) return c.json({ error: 'Invalid checkout key', code: 'INVALID_IDEMPOTENCY_KEY' }, 400);
    const result = await createCheckout(c.env.DB, c.get('auth').userId, key, plan,
      (intent) => createPayosInstructions(c.env, intent), prices);
    if (result.kind === 'created' || result.kind === 'replay') {
      return c.json({ success: true, payment: result.payment }, result.kind === 'created' ? 201 : 200);
    }
    const code = { conflict: 'IDEMPOTENCY_CONFLICT', expired: 'CHECKOUT_KEY_EXPIRED',
      in_progress: 'COMMAND_IN_PROGRESS', reconciliation: 'PAYMENT_RECONCILIATION_REQUIRED' }[result.kind];
    return c.json({ success: false, code, intentId: result.intentId }, result.kind === 'reconciliation' ? 202 : 409);
  }
  const orderCode = newOrderCode();
  const intent: PaymentRow = {
    id: `pay_${crypto.randomUUID()}`, user_id: c.get('auth').userId,
    plan, amount_vnd: prices[plan], currency: PAYMENT_CURRENCY,
    order_code: orderCode, description: `TP${orderCode.slice(-7)}`,
    expires_at: new Date((Math.floor(Date.now() / 1000) + INTENT_TTL_SECONDS) * 1000).toISOString(),
    status: 'pending', provider_reference: null,
  };
  await c.env.DB.prepare(`INSERT INTO payment_intents
    (id,user_id,plan,amount_vnd,currency,order_code,description,expires_at) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(intent.id, intent.user_id, plan, intent.amount_vnd, intent.currency, orderCode, intent.description, intent.expires_at).run();
  try {
    const instructions = await createPayosInstructions(c.env, intent);
    intent.description = instructions.transferContent;
    await c.env.DB.prepare('UPDATE payment_intents SET description = ? WHERE id = ?')
      .bind(intent.description, intent.id).run();
    return c.json({ success: true, payment: { ...paymentView(intent), instructions } }, 201);
  } catch {
    // Ambiguous provider orders need operator reconciliation, never an automatic grant.
    await c.env.DB.prepare("UPDATE payment_intents SET status = 'failed', updated_at = datetime('now') WHERE id = ? AND status = 'pending'")
      .bind(intent.id).run();
    return c.json({ error: 'Chưa tạo được hướng dẫn thanh toán. Vui lòng thử lại.', code: 'PAYMENT_PROVIDER_UNAVAILABLE' }, 502);
  }
});

billingRoutes.get('/billing/checkouts', async (c) => {
  if (c.env.CHECKOUT_ADMISSION_ENABLED !== 'true') return c.json({ code: 'CHECKOUT_ADMISSION_DISABLED' }, 404);
  const rows = await c.env.DB.prepare(`SELECT p.id, p.plan, p.status, p.expires_at, a.state, a.deadline_at
    FROM checkout_admissions a JOIN payment_intents p ON p.id = a.intent_id
    WHERE a.user_id = ? AND NOT ${verifiedPaidPaymentPredicate}
      AND (a.state <> 'ready' OR (p.status = 'pending' AND p.expires_at > ?))
    ORDER BY a.created_at DESC LIMIT 20`).bind(c.get('auth').userId, new Date().toISOString()).all<{
      id: string; plan: string; status: string; expires_at: string; state: string; deadline_at: string;
    }>();
  return c.json({ checkouts: rows.results.map((row) => ({
    intentId: row.id, plan: row.plan, status: row.status, expiresAt: row.expires_at,
    state: row.state === 'dispatching' && Date.parse(row.deadline_at) <= Date.now() ? 'remote_uncertain' : row.state,
  })) });
});

billingRoutes.get('/billing/checkouts/:id', async (c) => {
  if (c.env.CHECKOUT_ADMISSION_ENABLED !== 'true') return c.json({ code: 'CHECKOUT_ADMISSION_DISABLED' }, 404);
  const result = await readCheckout(c.env.DB, c.get('auth').userId, c.req.param('id'));
  if (!result) return c.json({ error: 'Không tìm thấy thanh toán', code: 'PAYMENT_NOT_FOUND' }, 404);
  if (result.kind === 'replay' || result.kind === 'created') return c.json({ success: true, payment: result.payment });
  return c.json({ success: false, code: result.kind === 'reconciliation' ? 'PAYMENT_RECONCILIATION_REQUIRED'
    : result.kind === 'expired' ? 'CHECKOUT_KEY_EXPIRED' : 'COMMAND_IN_PROGRESS', intentId: result.intentId },
    result.kind === 'reconciliation' ? 202 : 409);
});

billingRoutes.get('/billing/payment-intents/:id', async (c) => {
  const intent = await c.env.DB.prepare('SELECT * FROM payment_intents WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('auth').userId).first<PaymentRow>();
  if (!intent) return c.json({ error: 'Không tìm thấy thanh toán', code: 'PAYMENT_NOT_FOUND' }, 404);
  if (!isValidIssuedIntent(intent)) return c.json({ error: 'Thanh toán không hợp lệ', code: 'PAYMENT_INVALID' }, 409);
  return c.json({ success: true, payment: paymentView(intent) });
});

billingRoutes.post('/billing/payos/webhook', bodyLimit({
  maxSize: 16 * 1024, onError: (c) => c.json({ error: 'Invalid webhook', code: 'WEBHOOK_TOO_LARGE' }, 413),
}), async (c) => {
  const receivedAt = new Date().toISOString();
  if (!c.env.DB || !c.env.PAYOS_CHECKSUM_KEY) return c.json({ error: 'Webhook chưa cấu hình' }, 503);
  const envelope = z.object({ data: z.record(z.string(), z.unknown()), signature: z.string().optional() })
    .safeParse(await c.req.json().catch(() => null));
  if (!envelope.success) return c.json({ error: 'Invalid webhook' }, 400);
  const { data } = envelope.data;
  const signature = c.req.header('x-payos-signature') || envelope.data.signature;
  if (!await verifyPayosData(data, signature, c.env.PAYOS_CHECKSUM_KEY)) return c.json({ error: 'Invalid signature' }, 401);
  const parsed = webhookData.safeParse(data);
  if (!parsed.success) return c.json({ error: 'Invalid payment data' }, 400);
  const payment = parsed.data;
  const intent = await c.env.DB.prepare('SELECT * FROM payment_intents WHERE order_code = ?')
    .bind(String(payment.orderCode)).first<PaymentRow>();
  // payOS verifies a webhook URL with signed data for an order we did not issue.
  // Acknowledgement never creates a payment or entitlement; mapped orders keep all checks.
  if (!intent && payment.orderCode === 123 && payment.amount === 3000 &&
      payment.currency === 'VND' && data.description === 'VQRIO123') return c.json({ success: true });
  if (!intent || !isValidIssuedIntent(intent) || payment.amount !== intent.amount_vnd || payment.currency !== intent.currency) {
    return c.json({ error: 'Payment reconciliation failed' }, 409);
  }
  const status = payment.code === '00' ? 'paid' : 'failed';
  if (intent.status === status && intent.provider_reference === payment.reference) return c.json({ success: true });
  if (intent.status !== 'pending' || Date.parse(intent.expires_at) <= Date.parse(receivedAt)) {
    return c.json({ error: 'Payment is no longer pending' }, 409);
  }
  const days = intent.plan === 'annual' ? 366 : 31;
  try {
    // D1 batch is transactional: only the still-pending order may grant, then it is consumed.
    const results = await c.env.DB.batch([
      ...(status === 'paid' ? [c.env.DB.prepare(`INSERT INTO subscriptions (id, user_id, plan, status, expires_at)
        SELECT ?, user_id, 'plus', 'active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)
        FROM payment_intents WHERE id = ? AND status = 'pending' AND datetime(expires_at) > datetime(?)
        ON CONFLICT(user_id) DO UPDATE SET plan = 'plus', status = 'active',
          expires_at = strftime('%Y-%m-%dT%H:%M:%fZ',
            CASE WHEN subscriptions.plan = 'plus' AND subscriptions.status = 'active'
              AND datetime(subscriptions.expires_at) > datetime('now')
              THEN subscriptions.expires_at ELSE datetime('now') END, ?),
          updated_at = datetime('now')`)
        .bind(`sub_${intent.user_id}`, `+${days} days`, intent.id, receivedAt, `+${days} days`)] : []),
      c.env.DB.prepare(`UPDATE payment_intents SET status = ?, provider_reference = ?, updated_at = datetime('now')
        WHERE id = ? AND status = 'pending' AND datetime(expires_at) > datetime(?)`)
        .bind(status, payment.reference, intent.id, receivedAt),
    ]);
    if (results.at(-1)?.meta?.changes === 0) {
      const current = await c.env.DB.prepare('SELECT * FROM payment_intents WHERE id = ?').bind(intent.id).first<PaymentRow>();
      if (current?.status !== status || current.provider_reference !== payment.reference) return c.json({ error: 'Payment transition rejected' }, 409);
    }
    return c.json({ success: true });
  } catch {
    // A duplicate provider reference rolls back the subscription and intent together.
    return c.json({ error: 'Payment reconciliation failed' }, 409);
  }
});
