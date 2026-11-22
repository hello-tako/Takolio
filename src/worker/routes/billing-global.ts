import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { CountryCodeSchema, SupportedLocaleSchema } from '../../../packages/domain/src/i18n';
import { getScanQuotaEntitlement } from '../config/scan-quota-policy';
import { negotiateEdgeLocaleContext, resolveEffectiveLocaleContext } from '../middleware/locale';
import { rateLimiter } from '../middleware/rate-limit';
import { INTENT_TTL_SECONDS } from '../payment/authority';
import {
  buildTokushohoDisclosure,
  getPaymentProviderAdapter,
  isEuWithdrawalWaiverRequired,
  resolveGlobalRegionalCatalog,
  verifyDodoWebhookSignature,
  type PaymentProviderId,
} from '../payment/global-providers';
import type { AuthContext, Env } from '../types';

export const billingGlobalPublicRoutes = new Hono<{ Bindings: Env }>();
export const billingGlobalRoutes = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

const GlobalCheckoutRequestSchema = z.object({
  plan: z.enum(['monthly', 'annual']),
  countryCode: CountryCodeSchema.optional(),
  euWithdrawalWaiverAccepted: z.boolean().optional(),
});

interface GlobalPaymentIntentRow {
  id: string;
  user_id: string;
  provider: PaymentProviderId;
  plan: 'monthly' | 'annual';
  currency: string;
  amount_minor: number;
  minor_digits: number;
  tax_amount_minor: number;
  tax_inclusive: number;
  country_code: string;
  payment_method_types_json: string;
  eu_withdrawal_waiver_at: string | null;
  idempotency_key: string | null;
  provider_session_id: string | null;
  provider_reference: string | null;
  checkout_url: string | null;
  status: 'pending' | 'awaiting_async_payment' | 'paid' | 'failed' | 'expired' | 'refunded';
  expires_at: string;
  created_at: string;
}

export const PUBLIC_GLOBAL_BILLING_SUFFIXES = [
  '/billing/tokushoho',
  '/billing/dodo/webhook',
];

billingGlobalPublicRoutes.use('/billing/tokushoho', async (c, next) => {
  c.header('Vary', 'Accept-Language, CF-IPCountry, X-Takolio-Locale');
  return next();
});

billingGlobalRoutes.use('/billing/global/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  const auth = c.get('auth');
  if (!auth?.userId || auth.isGuest) {
    return c.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, 401);
  }
  if (!c.env.DB) {
    return c.json({ error: 'Billing database unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  return next();
});

// Public statutory disclosure under Japan's Specified Commercial Transactions Act (`特定商取引法に基づく表記`).
billingGlobalPublicRoutes.get('/billing/tokushoho', (c) => {
  const queryLang = c.req.query('lang');
  const parsedLang = queryLang ? SupportedLocaleSchema.safeParse(queryLang) : null;
  const edge = negotiateEdgeLocaleContext(c.req, c.env);
  const locale = parsedLang?.success ? parsedLang.data : edge.locale;
  return c.json(buildTokushohoDisclosure(locale, c.env));
});

billingGlobalRoutes.get('/billing/global/plans', async (c) => {
  const localeCtx = await resolveEffectiveLocaleContext(
    c.env.DB,
    c.get('auth'),
    negotiateEdgeLocaleContext(c.req, c.env),
  );
  const overrideCountry = c.req.query('country');
  const parsedCountry = overrideCountry ? CountryCodeSchema.safeParse(overrideCountry) : null;
  const effectiveCountry = parsedCountry?.success ? parsedCountry.data : localeCtx.countryCode;

  try {
    const catalog = resolveGlobalRegionalCatalog(effectiveCountry, c.env);
    return c.json({ catalog });
  } catch {
    return c.json({ error: 'Invalid regional price configuration', code: 'PAYMENT_PRICE_CONFIGURATION_INVALID' }, 503);
  }
});

billingGlobalRoutes.get('/billing/global/account', async (c) => {
  const userId = c.get('auth').userId;
  const now = new Date();
  const [subRes, intentsRes] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT plan, status, expires_at, provider, provider_subscription_id, dodo_customer_id,
              billing_currency, cancel_at_period_end, grace_period_ends_at
         FROM subscriptions
        WHERE user_id = ?`,
    ).bind(userId),
    c.env.DB.prepare(
      `SELECT *
         FROM global_payment_intents
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT 20`,
    ).bind(userId),
  ]);

  const rawSub = (subRes.results?.[0] ?? null) as {
    plan: string | null;
    status: string | null;
    expires_at: string | null;
    provider: string | null;
    provider_subscription_id: string | null;
    dodo_customer_id: string | null;
    billing_currency: string | null;
    cancel_at_period_end: number | null;
    grace_period_ends_at: string | null;
  } | null;

  const entitlement = getScanQuotaEntitlement(rawSub, now);
  const rows = (intentsRes.results ?? []) as GlobalPaymentIntentRow[];

  return c.json({
    subscription: {
      plan: entitlement.plan,
      status: rawSub?.status ?? (entitlement.isPlus ? 'active' : 'inactive'),
      isPlus: entitlement.isPlus,
      expiresAt: rawSub?.expires_at ?? null,
      provider: rawSub?.provider ?? null,
      providerSubscriptionId: rawSub?.provider_subscription_id ?? null,
      dodoCustomerId: rawSub?.dodo_customer_id ?? null,
      canOpenCustomerPortal: Boolean(rawSub?.dodo_customer_id && c.env.DODO_PAYMENTS_API_KEY),
      billingCurrency: rawSub?.billing_currency ?? null,
      cancelAtPeriodEnd: Boolean(rawSub?.cancel_at_period_end),
      gracePeriodEndsAt: rawSub?.grace_period_ends_at ?? null,
    },
    payments: rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      plan: r.plan,
      currency: r.currency,
      amountMinor: r.amount_minor,
      minorDigits: r.minor_digits,
      taxAmountMinor: r.tax_amount_minor,
      taxInclusive: Boolean(r.tax_inclusive),
      countryCode: r.country_code,
      status: r.status === 'pending' && Date.parse(r.expires_at) <= now.getTime() ? 'expired' : r.status,
      checkoutUrl: r.checkout_url,
      euWithdrawalWaiverAt: r.eu_withdrawal_waiver_at,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    })),
  });
});

billingGlobalRoutes.post(
  '/billing/global/checkout',
  rateLimiter({
    maxRequests: 10,
    windowSeconds: 60,
    prefix: 'rl_global_checkout',
    enforcement: 'fail-closed',
  }),
  async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = GlobalCheckoutRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid checkout request', code: 'INVALID_PLAN' }, 400);
    }

    const auth = c.get('auth');
    const localeCtx = await resolveEffectiveLocaleContext(
      c.env.DB,
      auth,
      negotiateEdgeLocaleContext(c.req, c.env),
    );
    const countryCode = parsed.data.countryCode ?? localeCtx.countryCode;
    const catalog = resolveGlobalRegionalCatalog(countryCode, c.env);

    if (catalog.provider === 'payos_vn') {
      return c.json(
        {
          error: 'Vietnam VND checkouts must use /api/v1/billing/payment-intents',
          code: 'USE_VIETNAM_PAYOS_CHECKOUT',
          provider: 'payos_vn',
        },
        409,
      );
    }

    // Enforce EU Directive 2011/83/EU Art. 16(m) & UK Consumer Contracts Reg. 37
    // 14-day digital right-of-withdrawal waiver before immediate subscription start.
    if (isEuWithdrawalWaiverRequired(countryCode) && parsed.data.euWithdrawalWaiverAccepted !== true) {
      return c.json(
        {
          error: 'Explicit consent to immediate digital service performance and waiver of the 14-day withdrawal right is required in EEA/UK.',
          code: 'EU_WITHDRAWAL_WAIVER_REQUIRED',
          countryCode,
        },
        422,
      );
    }

    const idempotencyKey = c.req.header('Idempotency-Key')?.trim() || null;
    if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 128)) {
      return c.json({ error: 'Invalid Idempotency-Key header', code: 'INVALID_IDEMPOTENCY_KEY' }, 400);
    }

    if (idempotencyKey) {
      const existing = await c.env.DB.prepare(
        'SELECT * FROM global_payment_intents WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
      )
        .bind(auth.userId, idempotencyKey)
        .first<GlobalPaymentIntentRow>();

      if (existing) {
        if (existing.plan !== parsed.data.plan || existing.country_code !== catalog.countryCode) {
          return c.json({ error: 'Idempotency key reused with conflicting parameters', code: 'IDEMPOTENCY_CONFLICT' }, 409);
        }
        return c.json({
          success: true,
          idempotentReplay: true,
          intent: {
            id: existing.id,
            provider: existing.provider,
            plan: existing.plan,
            currency: existing.currency,
            amountMinor: existing.amount_minor,
            minorDigits: existing.minor_digits,
            taxAmountMinor: existing.tax_amount_minor,
            checkoutUrl: existing.checkout_url,
            status: existing.status,
            expiresAt: existing.expires_at,
          },
        });
      }
    }

    const adapter = getPaymentProviderAdapter();
    if (!adapter.isConfigured(c.env)) {
      return c.json({ error: 'Dodo Payments is not configured', code: 'PAYMENT_UNAVAILABLE' }, 503);
    }

    const offer = catalog.plans.find((p) => p.plan === parsed.data.plan)!;
    const nowIso = new Date().toISOString();
    const expiresAt = new Date((Math.floor(Date.now() / 1000) + INTENT_TTL_SECONDS) * 1000).toISOString();
    const intentId = `gpay_${crypto.randomUUID()}`;
    const waiverAt = isEuWithdrawalWaiverRequired(countryCode) ? nowIso : null;

    await c.env.DB.prepare(
      `INSERT INTO global_payment_intents (
         id, user_id, provider, plan, currency, amount_minor, minor_digits,
         tax_amount_minor, tax_inclusive, country_code, payment_method_types_json,
         eu_withdrawal_waiver_at, idempotency_key, status, expires_at
       ) VALUES (?, ?, 'dodo_mor', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
      .bind(
        intentId,
        auth.userId,
        offer.plan,
        offer.currency,
        offer.amountMinor,
        offer.minorDigits,
        offer.taxAmountMinor,
        offer.taxInclusive ? 1 : 0,
        catalog.countryCode,
        JSON.stringify(offer.paymentMethods),
        waiverAt,
        idempotencyKey,
        expiresAt,
      )
      .run();

    try {
      const appUrl = (c.env.APP_URL || 'https://app.takolio.com').replace(/\/+$/, '');
      const session = await adapter.createCheckoutSession(c.env, {
        intentId,
        userId: auth.userId,
        email: auth.email,
        plan: offer.plan,
        offer,
        countryCode: catalog.countryCode,
        locale: localeCtx.locale,
        appUrl,
      });

      await c.env.DB.prepare(
        `UPDATE global_payment_intents
            SET provider_session_id = ?, checkout_url = ?, status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?`,
      )
        .bind(session.providerSessionId, session.checkoutUrl, session.initialStatus, intentId)
        .run();

      return c.json(
        {
          success: true,
          intent: {
            id: intentId,
            provider: 'dodo_mor',
            merchantOfRecord: 'Dodo Payments',
            plan: offer.plan,
            currency: offer.currency,
            amountMinor: offer.amountMinor,
            minorDigits: offer.minorDigits,
            taxAmountMinor: offer.taxAmountMinor,
            checkoutUrl: session.checkoutUrl,
            status: session.initialStatus,
            euWithdrawalWaiverAt: waiverAt,
            expiresAt,
          },
        },
        201,
      );
    } catch {
      await c.env.DB.prepare(
        "UPDATE global_payment_intents SET status = 'failed', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending'",
      )
        .bind(intentId)
        .run();
      return c.json({ error: 'Unable to initialize Dodo Payments checkout session', code: 'PAYMENT_PROVIDER_UNAVAILABLE' }, 502);
    }
  },
);

// Self-service Dodo Payments Customer Portal (`POST /api/v1/billing/global/portal`)
// Allows JP & EU subscribers to download compliant MoR tax invoices, update cards, or cancel.
billingGlobalRoutes.post(
  '/billing/global/portal',
  rateLimiter({ maxRequests: 10, windowSeconds: 60, prefix: 'rl_dodo_portal' }),
  async (c) => {
    const userId = c.get('auth').userId;
    const sub = await c.env.DB.prepare(
      "SELECT dodo_customer_id FROM subscriptions WHERE user_id = ? AND provider = 'dodo_mor' LIMIT 1",
    )
      .bind(userId)
      .first<{ dodo_customer_id: string | null }>();

    if (!sub?.dodo_customer_id) {
      return c.json({ error: 'No Dodo Payments customer profile found for this account', code: 'CUSTOMER_PORTAL_UNAVAILABLE' }, 404);
    }

    try {
      const adapter = getPaymentProviderAdapter();
      const { portalUrl } = await adapter.createCustomerPortalSession(c.env, sub.dodo_customer_id);
      return c.json({ success: true, portalUrl });
    } catch {
      return c.json({ error: 'Unable to open Dodo Customer Portal', code: 'PAYMENT_PROVIDER_UNAVAILABLE' }, 502);
    }
  },
);

billingGlobalRoutes.post('/billing/global/cancel', async (c) => {
  const userId = c.get('auth').userId;
  const res = await c.env.DB.prepare(
    `UPDATE subscriptions
        SET cancel_at_period_end = 1, updated_at = datetime('now')
      WHERE user_id = ? AND plan = 'plus'`,
  )
    .bind(userId)
    .run();

  if ((res.meta?.changes ?? 0) === 0) {
    return c.json({ error: 'No active Plus subscription found', code: 'SUBSCRIPTION_NOT_FOUND' }, 404);
  }
  return c.json({ success: true, cancelAtPeriodEnd: true });
});

async function grantDodoPlusEntitlement(
  db: Env['DB'],
  intent: GlobalPaymentIntentRow,
  webhookId: string,
  eventType: string,
  providerReference: string,
  providerSubscriptionId: string | null,
  dodoCustomerId: string | null,
  settledAmountMinor: number | null = null,
  settledTaxMinor: number | null = null,
): Promise<'granted' | 'duplicate'> {
  const days = intent.plan === 'annual' ? 366 : 31;
  const existingEvent = await db
    .prepare("SELECT 1 AS seen FROM billing_webhook_events WHERE provider = 'dodo_mor' AND event_id = ? LIMIT 1")
    .bind(webhookId)
    .first<{ seen: number }>();
  if (existingEvent) return 'duplicate';

  await db.batch([
    db
      .prepare(
        `INSERT INTO billing_webhook_events (provider, event_id, event_type, intent_id)
         VALUES ('dodo_mor', ?, ?, ?)`,
      )
      .bind(webhookId, eventType, intent.id),
    db
      .prepare(
        `INSERT INTO subscriptions (
           id, user_id, plan, status, expires_at, provider,
           provider_subscription_id, dodo_customer_id, billing_currency, cancel_at_period_end, grace_period_ends_at
         )
         VALUES (
           ?, ?, 'plus', 'active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?),
           'dodo_mor', ?, ?, ?, 0, NULL
         )
         ON CONFLICT(user_id) DO UPDATE SET
           plan = 'plus',
           status = 'active',
           provider = 'dodo_mor',
           provider_subscription_id = COALESCE(excluded.provider_subscription_id, subscriptions.provider_subscription_id),
           dodo_customer_id = COALESCE(excluded.dodo_customer_id, subscriptions.dodo_customer_id),
           billing_currency = excluded.billing_currency,
           cancel_at_period_end = 0,
           grace_period_ends_at = NULL,
           expires_at = strftime(
             '%Y-%m-%dT%H:%M:%fZ',
             CASE
               WHEN subscriptions.plan = 'plus'
                AND subscriptions.status IN ('active', 'past_due')
                AND subscriptions.expires_at IS NOT NULL
                AND datetime(subscriptions.expires_at) > datetime('now')
               THEN subscriptions.expires_at
               ELSE datetime('now')
             END,
             ?
           ),
           updated_at = datetime('now')`,
      )
      .bind(
        `sub_${intent.user_id}`,
        intent.user_id,
        `+${days} days`,
        providerSubscriptionId,
        dodoCustomerId,
        intent.currency,
        `+${days} days`,
      ),
    db
      .prepare(
        `UPDATE global_payment_intents
            SET status = 'paid',
                provider_reference = ?,
                amount_minor = COALESCE(?, amount_minor),
                tax_amount_minor = COALESCE(?, tax_amount_minor),
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ? AND status IN ('pending', 'awaiting_async_payment')`,
      )
      .bind(providerReference, settledAmountMinor, settledTaxMinor, intent.id),
  ]);

  return 'granted';
}

// Dodo Payments Merchant-of-Record Webhook (`POST /api/v1/billing/dodo/webhook`)
// Verifies Standard Webhooks (`webhook-id`, `webhook-timestamp`, `webhook-signature` with Base64 `whsec_` key).
billingGlobalPublicRoutes.post(
  '/billing/dodo/webhook',
  bodyLimit({
    maxSize: 64 * 1024,
    onError: (c) => c.json({ error: 'Webhook payload too large', code: 'WEBHOOK_TOO_LARGE' }, 413),
  }),
  async (c) => {
    if (!c.env.DB || !c.env.DODO_PAYMENTS_WEBHOOK_KEY) {
      return c.json({ error: 'Dodo Payments webhook is not configured' }, 503);
    }

    const rawBody = await c.req.text();
    const webhookId = c.req.header('webhook-id');
    const webhookTimestamp = c.req.header('webhook-timestamp');
    const webhookSignature = c.req.header('webhook-signature');

    const valid = await verifyDodoWebhookSignature(
      rawBody,
      { webhookId, webhookTimestamp, webhookSignature },
      c.env.DODO_PAYMENTS_WEBHOOK_KEY,
    );
    if (!valid || !webhookId) {
      return c.json({ error: 'Invalid Dodo webhook signature', code: 'INVALID_SIGNATURE' }, 401);
    }

    let event: {
      type?: string;
      business_id?: string;
      data?: Record<string, unknown>;
    };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return c.json({ error: 'Malformed JSON' }, 400);
    }

    if (!event.type || !event.data) {
      return c.json({ error: 'Invalid Dodo event envelope' }, 400);
    }

    const alreadyProcessed = await c.env.DB.prepare(
      "SELECT 1 AS seen FROM billing_webhook_events WHERE provider = 'dodo_mor' AND event_id = ? LIMIT 1",
    )
      .bind(webhookId)
      .first<{ seen: number }>();
    if (alreadyProcessed) {
      return c.json({ received: true, duplicate: true });
    }

    const data = event.data;
    const metadata = (data.metadata ?? {}) as Record<string, string | undefined>;
    const intentId = typeof metadata.intent_id === 'string' ? metadata.intent_id : null;
    const customerObj = (data.customer ?? {}) as Record<string, unknown>;
    const dodoCustomerId =
      typeof data.customer_id === 'string'
        ? data.customer_id
        : typeof customerObj.customer_id === 'string'
          ? customerObj.customer_id
          : null;
    const subscriptionId =
      typeof data.subscription_id === 'string' ? data.subscription_id : null;
    const paymentId =
      typeof data.payment_id === 'string' ? data.payment_id : null;

    // 1. Konbini / async bank payment voucher issued (`payment.processing`):
    // MUST transition to `awaiting_async_payment` and MUST NOT grant Plus until cash is received!
    if (event.type === 'payment.processing') {
      if (!intentId) return c.json({ error: 'Missing metadata.intent_id' }, 400);
      await c.env.DB.batch([
        c.env.DB.prepare(
          "INSERT INTO billing_webhook_events (provider, event_id, event_type, intent_id) VALUES ('dodo_mor', ?, ?, ?)",
        ).bind(webhookId, event.type, intentId),
        c.env.DB.prepare(
          `UPDATE global_payment_intents
              SET status = 'awaiting_async_payment',
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ? AND provider = 'dodo_mor' AND status = 'pending'`,
        ).bind(intentId),
      ]);
      return c.json({ received: true, status: 'awaiting_async_payment' });
    }

    // 2. Activated / paid / renewed subscription or Konbini payment confirmation
    if (
      event.type === 'subscription.active' ||
      event.type === 'subscription.renewed' ||
      event.type === 'payment.succeeded'
    ) {
      if (intentId) {
        const intent = await c.env.DB.prepare('SELECT * FROM global_payment_intents WHERE id = ? LIMIT 1')
          .bind(intentId)
          .first<GlobalPaymentIntentRow>();
        if (!intent || intent.provider !== 'dodo_mor') {
          return c.json({ error: 'Unknown Dodo payment intent' }, 409);
        }

        // Reconcile Dodo Adaptive Currency & immutable product_id (defense against plan tamper):
        // - `subscription.*` carries Dodo's base catalog currency (`USD`), whereas `payment.succeeded`
        //   carries the live FX-converted settlement amount in `intent.currency` (e.g. `¥823 JPY`).
        const expectedProductId =
          intent.plan === 'annual' ? c.env.DODO_PRODUCT_ID_ANNUAL : c.env.DODO_PRODUCT_ID_MONTHLY;
        const cartItems = Array.isArray(data.product_cart)
          ? (data.product_cart as Array<Record<string, unknown>>)
          : [];
        const payloadProductId =
          typeof data.product_id === 'string'
            ? data.product_id
            : typeof cartItems[0]?.product_id === 'string'
              ? (cartItems[0].product_id as string)
              : null;
        if (payloadProductId && expectedProductId && payloadProductId !== expectedProductId) {
          return c.json(
            { error: 'Dodo product_id does not match payment intent plan', code: 'PRODUCT_MISMATCH' },
            409,
          );
        }

        const payloadCurrency = typeof data.currency === 'string' ? data.currency.toUpperCase() : null;
        const payloadTotal = typeof data.total_amount === 'number' ? data.total_amount : null;
        const payloadTax = typeof data.tax === 'number' && data.tax >= 0 ? Math.round(data.tax) : null;
        if (payloadTotal !== null && (!Number.isFinite(payloadTotal) || payloadTotal <= 0)) {
          return c.json({ error: 'Invalid Dodo payment amount', code: 'AMOUNT_MISMATCH' }, 409);
        }
        if (
          event.type === 'payment.succeeded' &&
          payloadCurrency &&
          payloadCurrency !== intent.currency &&
          payloadCurrency !== 'USD'
        ) {
          return c.json({ error: 'Dodo payment currency mismatch', code: 'CURRENCY_MISMATCH' }, 409);
        }

        const settledMinor =
          payloadTotal !== null && payloadCurrency === intent.currency
            ? Math.round(payloadTotal)
            : null;
        const settledTax =
          payloadTax !== null && payloadCurrency === intent.currency ? payloadTax : null;

        const ref = paymentId ?? subscriptionId ?? webhookId;
        await grantDodoPlusEntitlement(
          c.env.DB,
          intent,
          webhookId,
          event.type,
          ref,
          subscriptionId,
          dodoCustomerId,
          settledMinor,
          settledTax,
        );
        return c.json({ received: true, status: 'paid' });
      }

      // Recurring renewal without initial intent_id (matched by `provider_subscription_id`)
      if (event.type === 'subscription.renewed' && subscriptionId) {
        const days = data.payment_frequency_interval === 'Year' ? 366 : 31;
        await c.env.DB.batch([
          c.env.DB.prepare(
            "INSERT INTO billing_webhook_events (provider, event_id, event_type) VALUES ('dodo_mor', ?, ?)",
          ).bind(webhookId, event.type),
          c.env.DB.prepare(
            `UPDATE subscriptions
                SET plan = 'plus',
                    status = 'active',
                    grace_period_ends_at = NULL,
                    dodo_customer_id = COALESCE(?, dodo_customer_id),
                    expires_at = strftime(
                      '%Y-%m-%dT%H:%M:%fZ',
                      CASE
                        WHEN expires_at IS NOT NULL AND datetime(expires_at) > datetime('now')
                        THEN expires_at ELSE datetime('now')
                      END,
                      ?
                    ),
                    updated_at = datetime('now')
              WHERE provider = 'dodo_mor' AND provider_subscription_id = ?`,
          ).bind(dodoCustomerId, `+${days} days`, subscriptionId),
        ]);
        return c.json({ received: true, status: 'renewed' });
      }

      return c.json({ error: 'Missing intent or subscription identifier' }, 400);
    }

    // 3. Payment failure
    if (event.type === 'payment.failed') {
      if (intentId) {
        await c.env.DB.batch([
          c.env.DB.prepare(
            "INSERT INTO billing_webhook_events (provider, event_id, event_type, intent_id) VALUES ('dodo_mor', ?, ?, ?)",
          ).bind(webhookId, event.type, intentId),
          c.env.DB.prepare(
            `UPDATE global_payment_intents
                SET status = 'failed', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
              WHERE id = ? AND status IN ('pending', 'awaiting_async_payment')`,
          ).bind(intentId),
        ]);
      }
      return c.json({ received: true, status: 'failed' });
    }

    // 4. Dunning / renewal on hold -> 7-day grace period (`past_due`)
    if ((event.type === 'subscription.on_hold' || event.type === 'subscription.failed') && subscriptionId) {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "INSERT INTO billing_webhook_events (provider, event_id, event_type) VALUES ('dodo_mor', ?, ?)",
        ).bind(webhookId, event.type),
        c.env.DB.prepare(
          `UPDATE subscriptions
              SET status = 'past_due',
                  grace_period_ends_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+7 days'),
                  updated_at = datetime('now')
            WHERE provider = 'dodo_mor' AND provider_subscription_id = ?`,
        ).bind(subscriptionId),
      ]);
      return c.json({ received: true, status: 'past_due' });
    }

    // 5. Subscription cancelled / expired
    if ((event.type === 'subscription.cancelled' || event.type === 'subscription.expired') && subscriptionId) {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "INSERT INTO billing_webhook_events (provider, event_id, event_type) VALUES ('dodo_mor', ?, ?)",
        ).bind(webhookId, event.type),
        c.env.DB.prepare(
          `UPDATE subscriptions
              SET status = 'expired', grace_period_ends_at = NULL, updated_at = datetime('now')
            WHERE provider = 'dodo_mor' AND provider_subscription_id = ?`,
        ).bind(subscriptionId),
      ]);
      return c.json({ received: true, status: 'expired' });
    }

    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO billing_webhook_events (provider, event_id, event_type) VALUES ('dodo_mor', ?, ?)",
    )
      .bind(webhookId, event.type)
      .run();
    return c.json({ received: true });
  },
);
