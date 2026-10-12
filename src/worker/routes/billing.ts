import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { BillingPlanRequestSchema } from '../../shared/billing';
import { z } from 'zod';
import type { Env, AuthContext } from '../types';
import { rateLimiter } from '../middleware/rate-limit';
import {
  isValidIssuedIntent, INTENT_TTL_SECONDS, newOrderCode, PAYMENT_CURRENCY,
  paymentView, plusPrices, type PaymentRow,
} from '../payment/authority';
import { PLUS_PRICES } from '../payment/prices';
import { checkoutKeySchema, createCheckout, readCheckout } from '../payment/checkout';
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

billingRoutes.get('/billing/plans', (c) => c.json({ plans: plusPrices(),
  checkoutAdmissionEnabled: c.env.CHECKOUT_ADMISSION_ENABLED === 'true' }));

billingRoutes.post('/billing/payment-intents', rateLimiter({
  maxRequests: 10, windowSeconds: 60, prefix: 'rl_payment_create', enforcement: 'fail-closed',
}), async (c) => {
  // Extra legacy fields are ignored; none can override server monetary values.
  const parsed = planRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Gói Plus không hợp lệ', code: 'INVALID_PLAN' }, 400);
  if (!payosConfigured(c.env)) return c.json({ error: 'Thanh toán tạm thời chưa khả dụng', code: 'PAYMENT_UNAVAILABLE' }, 503);
  const { plan } = parsed.data;
  const key = c.req.header('Idempotency-Key');
  if (key !== undefined) {
    if (c.env.CHECKOUT_ADMISSION_ENABLED !== 'true') return c.json({ code: 'CHECKOUT_ADMISSION_DISABLED' }, 503);
    if (!checkoutKeySchema.safeParse(key).success) return c.json({ error: 'Invalid checkout key', code: 'INVALID_IDEMPOTENCY_KEY' }, 400);
    const result = await createCheckout(c.env.DB, c.get('auth').userId, key, plan,
      (intent) => createPayosInstructions(c.env, intent));
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
    plan, amount_vnd: PLUS_PRICES[plan], currency: PAYMENT_CURRENCY,
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
    WHERE a.user_id = ? AND (a.state <> 'ready' OR (p.status = 'pending' AND p.expires_at > ?))
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
  const envelope = z.object({ data: z.record(z.unknown()), signature: z.string().optional() })
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
