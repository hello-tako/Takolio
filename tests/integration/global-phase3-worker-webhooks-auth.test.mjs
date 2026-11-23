import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../src/worker/index.ts';
import { clearIsolateJwksCache, APPLE_OIDC_ISSUER, LINE_OIDC_ISSUER } from '../../src/worker/utils/jwks-oidc.ts';
import { SESSION_COOKIE, sha256Hex } from '../../src/worker/utils/session.ts';
import { SqliteD1 } from '../helpers/sqlite-d1.ts';

const JWT_SECRET = 'global-phase3-jwt-secret-32-chars-minimum!!';
const DODO_RAW_SECRET = new TextEncoder().encode('dodo-test-webhook-signing-key-32');
const DODO_WEBHOOK_KEY = `whsec_${btoa(String.fromCharCode(...DODO_RAW_SECRET))}`;
const APP_URL = 'https://app.takolio.com';

class MemoryKV {
  store = new Map();
  async get(key, type) {
    const entry = this.store.get(key);
    if (!entry) return null;
    return type === 'json' ? JSON.parse(entry) : entry;
  }
  async put(key, value) {
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  async delete(key) {
    this.store.delete(key);
  }
}

function createExecutionContext() {
  const pending = [];
  return {
    ctx: {
      waitUntil(promise) {
        pending.push(Promise.resolve(promise));
      },
      passThroughOnException() {},
    },
    async flush() {
      await Promise.all(pending.splice(0));
    },
  };
}

function createWorkerEnv(db, overrides = {}) {
  return {
    DB: db,
    CACHE: new MemoryKV(),
    ENVIRONMENT: 'development',
    APP_URL,
    JWT_SECRET,
    OTP_HASH_SECRET: 'global-phase3-otp-secret-32-chars-minimum!!',
    DODO_PAYMENTS_API_KEY: 'dodo_test_api_key_123',
    DODO_PAYMENTS_WEBHOOK_KEY: DODO_WEBHOOK_KEY,
    DODO_PAYMENTS_ENVIRONMENT: 'test',
    DODO_PRODUCT_ID_MONTHLY: 'pdt_takolio_pro_monthly',
    DODO_PRODUCT_ID_ANNUAL: 'pdt_takolio_pro_annual',
    APPLE_CLIENT_ID: 'com.takolio.global',
    LINE_CHANNEL_ID: '2000998877',
    ...overrides,
  };
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonToBase64Url(obj) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
}

async function signDodoWebhook(msgId, tsSec, rawBody) {
  const key = await crypto.subtle.importKey(
    'raw',
    DODO_RAW_SECRET,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${msgId}.${tsSec}.${rawBody}`)),
  );
  let bin = '';
  for (let i = 0; i < sig.length; i++) bin += String.fromCharCode(sig[i]);
  return `v1,${btoa(bin)}`;
}

describe('Global Phase 3 — Dodo Payments MoR (JP Konbini Async + EU Waiver + Customer Portal) & Apple/LINE Auth E2E', () => {
  const databases = [];
  afterEach(() => {
    clearIsolateJwksCache();
    vi.restoreAllMocks();
    for (const db of databases.splice(0)) db.close();
  });

  it('handles Japan Tokushoho disclosure, Dodo JP Konbini async payment (processing -> succeeded), Customer Portal, and idempotent Standard Webhooks', async () => {
    const db = new SqliteD1();
    databases.push(db);
    const rawToken = 'sess_tok_jp_billing';
    const tokenHash = await sha256Hex(rawToken);
    db.seed(`
      INSERT INTO users (id, email, is_guest) VALUES ('u_jp_bill', 'taro@jp.example', 0);
      INSERT INTO households (id, name, created_by, locale, country_code, currency, timezone)
      VALUES ('h_jp_bill', '太郎のキッチン', 'u_jp_bill', 'ja', 'JP', 'JPY', 'Asia/Tokyo');
      INSERT INTO household_members (id, household_id, user_id, role) VALUES ('hm_jp_b', 'h_jp_bill', 'u_jp_bill', 'owner');
      INSERT INTO user_preferences (id, user_id, locale, country_code, currency, timezone)
      VALUES ('pref_jp_b', 'u_jp_bill', 'ja', 'JP', 'JPY', 'Asia/Tokyo');
      INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at)
      VALUES ('s_jp_b', 'u_jp_bill', 'h_jp_bill', '${tokenHash}', datetime('now', '+7 days'));
    `);

    const env = createWorkerEnv(db);
    const cookieHeader = `${SESSION_COOKIE}=${rawToken}`;

    // 1. Public Tokushoho endpoint requires NO auth & cites Dodo Payments MoR
    const tokRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/billing/tokushoho`, { headers: { 'Accept-Language': 'ja-JP' } }),
      env,
      createExecutionContext().ctx,
    );
    expect(tokRes.status).toBe(200);
    const tokBody = await tokRes.json();
    expect(tokBody.act).toBe('JP_SPECIFIED_COMMERCIAL_TRANSACTIONS_ACT');
    expect(tokBody.merchantOfRecord).toContain('Dodo Payments');
    expect(tokBody.sellingPriceTaxInclusive.annual).toContain('¥4,800');

    // 2. Dodo Payments JP Annual Checkout (`¥4,800` JPY via `test.dodopayments.com/checkouts`)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session_id: 'cks_dodo_jp_001',
          checkout_url: 'https://test.checkout.dodopayments.com/session/cks_dodo_jp_001',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const checkoutRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/billing/global/checkout`, {
        method: 'POST',
        headers: {
          Cookie: cookieHeader,
          Origin: APP_URL,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-jp-annual-dodo-001',
        },
        body: JSON.stringify({ plan: 'annual', countryCode: 'JP' }),
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(checkoutRes.status).toBe(201);
    const checkoutBody = await checkoutRes.json();
    expect(checkoutBody.intent).toMatchObject({
      provider: 'dodo_mor',
      merchantOfRecord: 'Dodo Payments',
      currency: 'JPY',
      amountMinor: 4800,
      minorDigits: 0,
      status: 'pending',
    });
    expect(fetchSpy.mock.calls[0][0]).toBe('https://test.dodopayments.com/checkouts');
    const intentId = checkoutBody.intent.id;

    // 3. Konbini voucher issued (`payment.processing`):
    // MUST transition to `awaiting_async_payment` and MUST NOT grant Plus before cash payment!
    const nowSec = Math.floor(Date.now() / 1000);
    const processingPayload = JSON.stringify({
      type: 'payment.processing',
      data: {
        payment_id: 'pay_dodo_konbini_1',
        metadata: { intent_id: intentId },
      },
    });
    const sig1 = await signDodoWebhook('msg_dodo_proc_1', nowSec, processingPayload);
    const wh1 = await worker.fetch(
      new Request(`${APP_URL}/api/v1/billing/dodo/webhook`, {
        method: 'POST',
        headers: {
          'webhook-id': 'msg_dodo_proc_1',
          'webhook-timestamp': String(nowSec),
          'webhook-signature': sig1,
          'Content-Type': 'application/json',
        },
        body: processingPayload,
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(wh1.status).toBe(200);
    expect(await wh1.json()).toMatchObject({ status: 'awaiting_async_payment' });

    const accBeforeCash = await (
      await worker.fetch(
        new Request(`${APP_URL}/api/v1/billing/global/account`, { headers: { Cookie: cookieHeader } }),
        env,
        createExecutionContext().ctx,
      )
    ).json();
    expect(accBeforeCash.subscription.isPlus).toBe(false);
    expect(accBeforeCash.payments[0].status).toBe('awaiting_async_payment');

    // 4. Rejects tampered `product_id` (monthly product sent for an annual intent), then accepts
    // real Dodo Adaptive Currency (`currency: 'USD'` base on `subscription.active` or FX-converted JPY)!
    const tamperedProductPayload = JSON.stringify({
      type: 'subscription.active',
      data: {
        subscription_id: 'sub_dodo_tamper',
        product_id: 'pdt_takolio_pro_monthly',
        currency: 'USD',
        metadata: { intent_id: intentId },
      },
    });
    const tamperSig = await signDodoWebhook('msg_dodo_tamper_1', nowSec, tamperedProductPayload);
    const whTamper = await worker.fetch(
      new Request(`${APP_URL}/api/v1/billing/dodo/webhook`, {
        method: 'POST',
        headers: {
          'webhook-id': 'msg_dodo_tamper_1',
          'webhook-timestamp': String(nowSec),
          'webhook-signature': tamperSig,
          'Content-Type': 'application/json',
        },
        body: tamperedProductPayload,
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(whTamper.status).toBe(409);
    expect(await whTamper.json()).toMatchObject({ code: 'PRODUCT_MISMATCH' });

    // Real Adaptive Currency webhook (`payment.succeeded` with live FX-converted JPY amount & matching annual product_id)
    const activePayload = JSON.stringify({
      type: 'payment.succeeded',
      data: {
        payment_id: 'pay_dodo_jp_fx_001',
        subscription_id: 'sub_dodo_jp_001',
        customer: { customer_id: 'cus_dodo_jp_taro' },
        product_cart: [{ product_id: 'pdt_takolio_pro_annual', quantity: 1 }],
        currency: 'JPY',
        total_amount: 7650,
        tax: 695,
        metadata: { intent_id: intentId },
      },
    });
    const sig2 = await signDodoWebhook('msg_dodo_active_2', nowSec, activePayload);
    const wh2 = await worker.fetch(
      new Request(`${APP_URL}/api/v1/billing/dodo/webhook`, {
        method: 'POST',
        headers: {
          'webhook-id': 'msg_dodo_active_2',
          'webhook-timestamp': String(nowSec),
          'webhook-signature': sig2,
          'Content-Type': 'application/json',
        },
        body: activePayload,
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(wh2.status).toBe(200);
    expect(await wh2.json()).toMatchObject({ status: 'paid' });

    // Replaying the exact same Standard Webhook `webhook-id` is idempotent (`duplicate: true`)
    const whReplay = await worker.fetch(
      new Request(`${APP_URL}/api/v1/billing/dodo/webhook`, {
        method: 'POST',
        headers: {
          'webhook-id': 'msg_dodo_active_2',
          'webhook-timestamp': String(nowSec),
          'webhook-signature': sig2,
          'Content-Type': 'application/json',
        },
        body: activePayload,
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(await whReplay.json()).toMatchObject({ received: true, duplicate: true });

    const accAfterCash = await (
      await worker.fetch(
        new Request(`${APP_URL}/api/v1/billing/global/account`, { headers: { Cookie: cookieHeader } }),
        env,
        createExecutionContext().ctx,
      )
    ).json();
    expect(accAfterCash.subscription).toMatchObject({
      plan: 'plus',
      isPlus: true,
      provider: 'dodo_mor',
      dodoCustomerId: 'cus_dodo_jp_taro',
      canOpenCustomerPortal: true,
      billingCurrency: 'JPY',
    });

    // 5. Open self-service Dodo Customer Portal (`POST /api/v1/billing/global/portal`)
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ link: 'https://test.dodopayments.com/portal/cus_dodo_jp_taro' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const portalRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/billing/global/portal`, {
        method: 'POST',
        headers: { Cookie: cookieHeader, Origin: APP_URL },
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(portalRes.status).toBe(200);
    expect(await portalRes.json()).toEqual({
      success: true,
      portalUrl: 'https://test.dodopayments.com/portal/cus_dodo_jp_taro',
    });
  });

  it('enforces EU 14-day withdrawal waiver for German EUR checkouts and processes Dodo MoR lifecycle webhooks', async () => {
    const db = new SqliteD1();
    databases.push(db);
    const rawToken = 'sess_tok_de_billing';
    const tokenHash = await sha256Hex(rawToken);
    db.seed(`
      INSERT INTO users (id, email, is_guest) VALUES ('u_de_bill', 'anna@de.example', 0);
      INSERT INTO households (id, name, created_by, locale, country_code, currency, timezone)
      VALUES ('h_de_bill', 'Annas Küche', 'u_de_bill', 'de', 'DE', 'EUR', 'Europe/Berlin');
      INSERT INTO household_members (id, household_id, user_id, role) VALUES ('hm_de_b', 'h_de_bill', 'u_de_bill', 'owner');
      INSERT INTO user_preferences (id, user_id, locale, country_code, currency, timezone)
      VALUES ('pref_de_b', 'u_de_bill', 'de', 'DE', 'EUR', 'Europe/Berlin');
      INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at)
      VALUES ('s_de_b', 'u_de_bill', 'h_de_bill', '${tokenHash}', datetime('now', '+7 days'));
    `);

    const env = createWorkerEnv(db);
    const cookieHeader = `${SESSION_COOKIE}=${rawToken}`;

    // 1. Missing EU Art. 16(m) withdrawal waiver MUST fail with 422!
    const missingWaiverRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/billing/global/checkout`, {
        method: 'POST',
        headers: { Cookie: cookieHeader, Origin: APP_URL, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'monthly', countryCode: 'DE' }),
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(missingWaiverRes.status).toBe(422);
    expect((await missingWaiverRes.json()).code).toBe('EU_WITHDRAWAL_WAIVER_REQUIRED');

    // 2. Explicit waiver accepted -> Dodo checkout session created (`499` minor units = €4.99)
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session_id: 'cks_dodo_de_001',
          checkout_url: 'https://test.checkout.dodopayments.com/session/cks_dodo_de_001',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const okRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/billing/global/checkout`, {
        method: 'POST',
        headers: { Cookie: cookieHeader, Origin: APP_URL, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'monthly', countryCode: 'DE', euWithdrawalWaiverAccepted: true }),
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(okRes.status).toBe(201);
    const okBody = await okRes.json();
    expect(okBody.intent).toMatchObject({
      provider: 'dodo_mor',
      currency: 'EUR',
      amountMinor: 499,
      minorDigits: 2,
    });
    expect(okBody.intent.euWithdrawalWaiverAt).toBeTruthy();

    // 3. Dodo `subscription.active` webhook -> grants Plus
    const nowSec = Math.floor(Date.now() / 1000);
    const dodoActive = JSON.stringify({
      type: 'subscription.active',
      data: {
        subscription_id: 'sub_dodo_de_001',
        customer: { customer_id: 'cus_dodo_de_anna', email: 'anna@de.example' },
        currency: 'EUR',
        total_amount: 499,
        metadata: { intent_id: okBody.intent.id },
      },
    });
    const dodoSig = await signDodoWebhook('msg_dodo_de_1', nowSec, dodoActive);
    const dodoWh = await worker.fetch(
      new Request(`${APP_URL}/api/v1/billing/dodo/webhook`, {
        method: 'POST',
        headers: {
          'webhook-id': 'msg_dodo_de_1',
          'webhook-timestamp': String(nowSec),
          'webhook-signature': dodoSig,
          'Content-Type': 'application/json',
        },
        body: dodoActive,
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(dodoWh.status).toBe(200);

    // 4. Dodo `subscription.on_hold` -> enters 7-day dunning grace period while keeping Plus active!
    const onHoldBody = JSON.stringify({
      type: 'subscription.on_hold',
      data: { subscription_id: 'sub_dodo_de_001' },
    });
    const holdSig = await signDodoWebhook('msg_dodo_de_hold', nowSec, onHoldBody);
    await worker.fetch(
      new Request(`${APP_URL}/api/v1/billing/dodo/webhook`, {
        method: 'POST',
        headers: {
          'webhook-id': 'msg_dodo_de_hold',
          'webhook-timestamp': String(nowSec),
          'webhook-signature': holdSig,
          'Content-Type': 'application/json',
        },
        body: onHoldBody,
      }),
      env,
      createExecutionContext().ctx,
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ subscription_id: 'sub_dodo_de_001', cancel_at_next_billing_date: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const cancelRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/billing/global/cancel`, {
        method: 'POST',
        headers: { Cookie: cookieHeader, Origin: APP_URL },
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(cancelRes.status).toBe(200);

    const acc = await (
      await worker.fetch(
        new Request(`${APP_URL}/api/v1/billing/global/account`, { headers: { Cookie: cookieHeader } }),
        env,
        createExecutionContext().ctx,
      )
    ).json();
    expect(acc.subscription).toMatchObject({
      plan: 'plus',
      status: 'past_due',
      isPlus: true,
      provider: 'dodo_mor',
      billingCurrency: 'EUR',
      cancelAtPeriodEnd: true,
    });
  });

  it('authenticates Sign in with Apple (private relay) and LINE Login (Tokyo ja-JP/JPY bootstrap) via Edge JWKS', async () => {
    const db = new SqliteD1();
    databases.push(db);
    const env = createWorkerEnv(db);
    const nowSec = Math.floor(Date.now() / 1000);

    const rsaPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const appleJwk = await crypto.subtle.exportKey('jwk', rsaPair.publicKey);

    const ecPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const lineJwk = await crypto.subtle.exportKey('jwk', ecPair.publicKey);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('appleid.apple.com')) {
        return new Response(JSON.stringify({ keys: [{ ...appleJwk, kid: 'ap-1', alg: 'RS256' }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ keys: [{ ...lineJwk, kid: 'ln-1', alg: 'ES256' }] }), { status: 200 });
    });

    const apHeader = jsonToBase64Url({ alg: 'RS256', kid: 'ap-1', typ: 'JWT' });
    const apPayload = jsonToBase64Url({
      iss: APPLE_OIDC_ISSUER,
      sub: '000999.apple_eu_user',
      aud: 'com.takolio.global',
      email: ['relay99', 'privaterelay.appleid.com'].join('@'),
      email_verified: true,
      is_private_email: true,
      exp: nowSec + 600,
    });
    const apSig = new Uint8Array(
      await crypto.subtle.sign('RSASSA-PKCS1-v1_5', rsaPair.privateKey, new TextEncoder().encode(`${apHeader}.${apPayload}`)),
    );
    const appleRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/auth/apple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': 'de-DE',
          'CF-IPCountry': 'DE',
        },
        body: JSON.stringify({
          identityToken: `${apHeader}.${apPayload}.${bytesToBase64Url(apSig)}`,
          user: { name: { firstName: 'Lukas', lastName: 'Müller' } },
        }),
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(appleRes.status).toBe(200);
    const appleJson = await appleRes.json();
    expect(appleJson.user).toMatchObject({
      provider: 'apple',
      isPrivateRelay: true,
      locale: 'de',
      countryCode: 'DE',
      currency: 'EUR',
      timeZone: 'Europe/Berlin',
    });

    const lnHeader = jsonToBase64Url({ alg: 'ES256', kid: 'ln-1', typ: 'JWT' });
    const lnPayload = jsonToBase64Url({
      iss: LINE_OIDC_ISSUER,
      sub: 'U_line_tokyo_777',
      aud: '2000998877',
      name: '高橋 健太',
      exp: nowSec + 600,
    });
    const lnSig = new Uint8Array(
      await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        ecPair.privateKey,
        new TextEncoder().encode(`${lnHeader}.${lnPayload}`),
      ),
    );
    const lineRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/auth/line`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': 'ja-JP',
          'CF-IPCountry': 'JP',
        },
        body: JSON.stringify({
          idToken: `${lnHeader}.${lnPayload}.${bytesToBase64Url(lnSig)}`,
        }),
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(lineRes.status).toBe(200);
    const lineCookie = lineRes.headers.get('set-cookie').split(';')[0];
    const lineJson = await lineRes.json();
    expect(lineJson.user).toMatchObject({
      provider: 'line',
      displayName: '高橋 健太',
      locale: 'ja',
      countryCode: 'JP',
      currency: 'JPY',
      timeZone: 'Asia/Tokyo',
    });

    const meRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/me`, { headers: { Cookie: lineCookie } }),
      env,
      createExecutionContext().ctx,
    );
    expect(meRes.status).toBe(200);
  });

  it('prevents double-extension on payment.succeeded + subscription.active, ignores foreign-workspace product webhooks, calls Dodo PATCH on cancel, and preserves takolio.app return_url', async () => {
    const db = new SqliteD1();
    databases.push(db);
    const rawToken = 'sess_tok_dodo_live_hardening';
    const tokenHash = await sha256Hex(rawToken);
    db.seed(`
      INSERT INTO users (id, email, is_guest) VALUES ('u_dodo_hard', 'dodo@jp.example', 0);
      INSERT INTO households (id, name, created_by, locale, country_code, currency, timezone)
      VALUES ('h_dodo_hard', 'Kitchen', 'u_dodo_hard', 'ja', 'JP', 'JPY', 'Asia/Tokyo');
      INSERT INTO household_members (id, household_id, user_id, role) VALUES ('hm_dodo_h', 'h_dodo_hard', 'u_dodo_hard', 'owner');
      INSERT INTO user_preferences (id, user_id, locale, country_code, currency, timezone)
      VALUES ('pref_dodo_h', 'u_dodo_hard', 'ja', 'JP', 'JPY', 'Asia/Tokyo');
      INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at)
      VALUES ('s_dodo_h', 'u_dodo_hard', 'h_dodo_hard', '${tokenHash}', datetime('now', '+7 days'));
    `);

    const env = createWorkerEnv(db, { APP_URL: 'https://takolio.app' });
    const cookieHeader = `${SESSION_COOKIE}=${rawToken}`;
    const takolioOrigin = 'https://takolio.app';

    let capturedCheckoutPayload = null;
    let capturedCancelRequest = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/checkouts')) {
        capturedCheckoutPayload = JSON.parse(String(init?.body ?? '{}'));
        return new Response(
          JSON.stringify({
            session_id: 'cks_dodo_origin_01',
            checkout_url: 'https://checkout.dodopayments.com/session/cks_dodo_origin_01',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/subscriptions/sub_dodo_single_ext') && init?.method === 'PATCH') {
        capturedCancelRequest = { url, body: JSON.parse(String(init?.body ?? '{}')) };
        return new Response(JSON.stringify({ subscription_id: 'sub_dodo_single_ext', cancel_at_next_billing_date: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    // 1. Checkout initiated from `https://takolio.app` MUST preserve `https://takolio.app/billing/return` & `metadata.app = 'takolio'`
    const checkoutRes = await worker.fetch(
      new Request(`${takolioOrigin}/api/v1/billing/global/checkout`, {
        method: 'POST',
        headers: {
          Cookie: cookieHeader,
          Origin: takolioOrigin,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-takolio-origin-001',
        },
        body: JSON.stringify({ plan: 'monthly', countryCode: 'JP' }),
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(checkoutRes.status).toBe(201);
    const intentId = (await checkoutRes.json()).intent.id;
    expect(capturedCheckoutPayload.return_url).toBe(`https://takolio.app/billing/return?intent_id=${encodeURIComponent(intentId)}`);
    expect(capturedCheckoutPayload.metadata.app).toBe('takolio');

    // 2. Foreign-workspace product event (e.g. another brand in shared Dodo account) MUST return 200 OK ignored
    const nowSec = Math.floor(Date.now() / 1000);
    const foreignPayload = JSON.stringify({
      type: 'payment.succeeded',
      data: {
        payment_id: 'pay_other_brand_01',
        product_cart: [{ product_id: 'pdt_other_brand_foreign', quantity: 1 }],
        currency: 'USD',
        total_amount: 500,
      },
    });
    const foreignSig = await signDodoWebhook('msg_foreign_brand_1', nowSec, foreignPayload);
    const foreignRes = await worker.fetch(
      new Request(`${takolioOrigin}/api/v1/billing/dodo/webhook`, {
        method: 'POST',
        headers: {
          'webhook-id': 'msg_foreign_brand_1',
          'webhook-timestamp': String(nowSec),
          'webhook-signature': foreignSig,
          'Content-Type': 'application/json',
        },
        body: foreignPayload,
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(foreignRes.status).toBe(200);
    expect(await foreignRes.json()).toMatchObject({ received: true, ignored: true, reason: 'foreign_product' });

    // 3. `payment.succeeded` followed by `subscription.active` for SAME intent MUST NOT double-extend `expires_at`
    const paySucceededPayload = JSON.stringify({
      type: 'payment.succeeded',
      data: {
        payment_id: 'pay_single_01',
        subscription_id: 'sub_dodo_single_ext',
        customer: { customer_id: 'cus_dodo_single_01' },
        product_cart: [{ product_id: 'pdt_takolio_pro_monthly', quantity: 1 }],
        currency: 'JPY',
        total_amount: 780,
        tax: 71,
        metadata: { app: 'takolio', intent_id: intentId },
      },
    });
    const sigPay = await signDodoWebhook('msg_single_pay_1', nowSec, paySucceededPayload);
    const whPay = await worker.fetch(
      new Request(`${takolioOrigin}/api/v1/billing/dodo/webhook`, {
        method: 'POST',
        headers: {
          'webhook-id': 'msg_single_pay_1',
          'webhook-timestamp': String(nowSec),
          'webhook-signature': sigPay,
          'Content-Type': 'application/json',
        },
        body: paySucceededPayload,
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(whPay.status).toBe(200);

    const accAfterPay = await (
      await worker.fetch(
        new Request(`${takolioOrigin}/api/v1/billing/global/account`, { headers: { Cookie: cookieHeader } }),
        env,
        createExecutionContext().ctx,
      )
    ).json();
    const firstExpiresAt = accAfterPay.subscription.expiresAt;
    expect(accAfterPay.subscription.isPlus).toBe(true);
    expect(accAfterPay.dodoConfigured).toBe(true);

    const subActivePayload = JSON.stringify({
      type: 'subscription.active',
      data: {
        subscription_id: 'sub_dodo_single_ext',
        customer: { customer_id: 'cus_dodo_single_01' },
        product_id: 'pdt_takolio_pro_monthly',
        currency: 'USD',
        metadata: { app: 'takolio', intent_id: intentId },
      },
    });
    const sigSub = await signDodoWebhook('msg_single_sub_2', nowSec, subActivePayload);
    const whSub = await worker.fetch(
      new Request(`${takolioOrigin}/api/v1/billing/dodo/webhook`, {
        method: 'POST',
        headers: {
          'webhook-id': 'msg_single_sub_2',
          'webhook-timestamp': String(nowSec),
          'webhook-signature': sigSub,
          'Content-Type': 'application/json',
        },
        body: subActivePayload,
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(whSub.status).toBe(200);

    const accAfterSub = await (
      await worker.fetch(
        new Request(`${takolioOrigin}/api/v1/billing/global/account`, { headers: { Cookie: cookieHeader } }),
        env,
        createExecutionContext().ctx,
      )
    ).json();
    expect(accAfterSub.subscription.expiresAt).toBe(firstExpiresAt);

    // 4. Recurring `payment.succeeded` without `intent_id` for known Takolio subscription returns 200 OK
    const recurringPayPayload = JSON.stringify({
      type: 'payment.succeeded',
      data: {
        payment_id: 'pay_recurring_month_2',
        subscription_id: 'sub_dodo_single_ext',
        product_cart: [{ product_id: 'pdt_takolio_pro_monthly', quantity: 1 }],
        currency: 'JPY',
        total_amount: 780,
      },
    });
    const sigRec = await signDodoWebhook('msg_recurring_pay_3', nowSec, recurringPayPayload);
    const whRec = await worker.fetch(
      new Request(`${takolioOrigin}/api/v1/billing/dodo/webhook`, {
        method: 'POST',
        headers: {
          'webhook-id': 'msg_recurring_pay_3',
          'webhook-timestamp': String(nowSec),
          'webhook-signature': sigRec,
          'Content-Type': 'application/json',
        },
        body: recurringPayPayload,
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(whRec.status).toBe(200);
    expect(await whRec.json()).toMatchObject({ received: true, status: 'subscription_payment_recorded' });

    // 5. `POST /api/v1/billing/global/cancel` calls Dodo PATCH `/subscriptions/:id` with `cancel_at_next_billing_date: true`
    const cancelRes = await worker.fetch(
      new Request(`${takolioOrigin}/api/v1/billing/global/cancel`, {
        method: 'POST',
        headers: { Cookie: cookieHeader, Origin: takolioOrigin },
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(cancelRes.status).toBe(200);
    expect(capturedCancelRequest).toEqual({
      url: 'https://test.dodopayments.com/subscriptions/sub_dodo_single_ext',
      body: { cancel_at_next_billing_date: true },
    });
  });
});
