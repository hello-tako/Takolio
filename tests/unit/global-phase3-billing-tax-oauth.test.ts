import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildTokushohoDisclosure,
  isEuWithdrawalWaiverRequired,
  resolveDodoApiBaseUrl,
  resolveGlobalRegionalCatalog,
  toDodoAllowedPaymentMethodTypes,
  verifyDodoWebhookSignature,
} from '../../src/worker/payment/global-providers';
import { getScanQuotaEntitlement } from '../../src/worker/config/scan-quota-policy';
import {
  APPLE_OIDC_ISSUER,
  clearIsolateJwksCache,
  LINE_OIDC_ISSUER,
  verifyOidcIdToken,
} from '../../src/worker/utils/jwks-oidc';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonToBase64Url(obj: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
}

function encodeBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function signStandardWebhook(rawSecretBytes: Uint8Array, msgId: string, ts: number, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    rawSecretBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${msgId}.${ts}.${rawBody}`),
  );
  return `v1,${encodeBase64(new Uint8Array(sig))}`;
}

describe('Global Phase 3 — Unified Dodo Payments MoR Billing, Tokushoho/EU Waiver & Edge JWKS OIDC', () => {
  afterEach(() => {
    clearIsolateJwksCache();
    vi.restoreAllMocks();
  });

  it('unifies Japan (JPY 0-decimal) and Europe (EUR/GBP/CHF/PLN/SEK 2-decimal) under Dodo Payments MoR while preserving PayOS VN', () => {
    const jp = resolveGlobalRegionalCatalog('JP', { APP_URL: 'https://app.takolio.com' });
    expect(jp.provider).toBe('dodo_mor');
    expect(jp.merchantOfRecord).toBe('Dodo Payments');
    expect(jp.currency).toBe('JPY');
    expect(jp.minorDigits).toBe(0);
    expect(jp.requiresTokushohoDisclosure).toBe(true);
    expect(jp.requiresEuWithdrawalWaiver).toBe(false);
    expect(jp.plans.find((p) => p.plan === 'monthly')?.amountMinor).toBe(480);
    expect(jp.plans.find((p) => p.plan === 'annual')?.amountMinor).toBe(4800);
    expect(jp.plans.find((p) => p.plan === 'annual')?.paymentMethods).toContain('amazon_pay');

    const de = resolveGlobalRegionalCatalog('DE');
    expect(de.provider).toBe('dodo_mor');
    expect(de.merchantOfRecord).toBe('Dodo Payments');
    expect(de.currency).toBe('EUR');
    expect(de.minorDigits).toBe(2);
    expect(de.requiresEuWithdrawalWaiver).toBe(true);
    expect(de.plans.find((p) => p.plan === 'monthly')?.amountMinor).toBe(499);
    expect(de.plans.find((p) => p.plan === 'annual')?.amountMinor).toBe(4990);
    expect(toDodoAllowedPaymentMethodTypes(de.plans[0].paymentMethods)).toContain('sepa');
    expect(toDodoAllowedPaymentMethodTypes(['credit', 'sepa_debit', 'konbini', 'vietqr'])).toEqual([
      'credit',
      'sepa',
    ]);

    const nl = resolveGlobalRegionalCatalog('NL');
    expect(nl.plans[0].paymentMethods).toContain('ideal');

    const gb = resolveGlobalRegionalCatalog('GB');
    expect(gb.currency).toBe('GBP');
    expect(gb.requiresEuWithdrawalWaiver).toBe(true);
    expect(gb.plans[0].amountMinor).toBe(449);

    const ch = resolveGlobalRegionalCatalog('CH');
    expect(ch.currency).toBe('CHF');
    expect(ch.requiresEuWithdrawalWaiver).toBe(false);
    expect(ch.plans[0].amountMinor).toBe(490);

    const vn = resolveGlobalRegionalCatalog('VN');
    expect(vn.provider).toBe('payos_vn');
    expect(vn.merchantOfRecord).toBeNull();
    expect(vn.currency).toBe('VND');

    expect(resolveDodoApiBaseUrl({ DODO_PAYMENTS_ENVIRONMENT: 'test' })).toBe('https://test.dodopayments.com');
    expect(resolveDodoApiBaseUrl({ DODO_PAYMENTS_ENVIRONMENT: 'live' })).toBe('https://live.dodopayments.com');
  });

  it('enforces EU Directive 2011/83/EU Art. 16(m) 14-day withdrawal waiver across EEA + UK and builds JP Tokushoho MoR disclosures', () => {
    for (const cc of ['DE', 'FR', 'IT', 'ES', 'NL', 'PL', 'SE', 'NO', 'IS', 'GB']) {
      expect(isEuWithdrawalWaiverRequired(cc)).toBe(true);
    }
    for (const cc of ['JP', 'CH', 'US', 'VN']) {
      expect(isEuWithdrawalWaiverRequired(cc)).toBe(false);
    }

    const tokushohoJa = buildTokushohoDisclosure('ja', { EMAIL_FROM_ADDRESS: 'legal@takolio.test' });
    expect(tokushohoJa.act).toBe('JP_SPECIFIED_COMMERCIAL_TRANSACTIONS_ACT');
    expect(tokushohoJa.merchantOfRecord).toContain('Dodo Payments');
    expect(tokushohoJa.sellingPriceTaxInclusive.monthly).toContain('¥480');
    expect(tokushohoJa.sellingPriceTaxInclusive.monthly).toContain('税込');
    expect(tokushohoJa.paymentTiming).toContain('コンビニ決済');
    expect(tokushohoJa.contactEmail).toBe('legal@takolio.test');
  });

  it('verifies Dodo Payments Standard Webhooks (`whsec_` Base64 secret + key rotation) and rejects replay or tampered payloads', async () => {
    const nowSec = 1_795_000_000;
    const rawSecret = new TextEncoder().encode('dodo-raw-signing-key-bytes-32len');
    const webhookKey = `whsec_${encodeBase64(rawSecret)}`;
    const msgId = 'msg_dodo_2x9abc';
    const rawBody = JSON.stringify({ type: 'subscription.active', data: { subscription_id: 'sub_1' } });
    const sigHeader = await signStandardWebhook(rawSecret, msgId, nowSec, rawBody);

    expect(
      await verifyDodoWebhookSignature(
        rawBody,
        { webhookId: msgId, webhookTimestamp: String(nowSec), webhookSignature: sigHeader },
        webhookKey,
        nowSec,
      ),
    ).toBe(true);

    // Supports rotated space-delimited Standard Webhooks signatures (`v1,old_sig v1,current_sig`)
    expect(
      await verifyDodoWebhookSignature(
        rawBody,
        { webhookId: msgId, webhookTimestamp: String(nowSec), webhookSignature: `v1,AAAA ${sigHeader}` },
        webhookKey,
        nowSec,
      ),
    ).toBe(true);

    // Replay beyond 300s window rejected
    expect(
      await verifyDodoWebhookSignature(
        rawBody,
        { webhookId: msgId, webhookTimestamp: String(nowSec), webhookSignature: sigHeader },
        webhookKey,
        nowSec + 301,
      ),
    ).toBe(false);

    // Tampered payload rejected
    expect(
      await verifyDodoWebhookSignature(
        rawBody + ' ',
        { webhookId: msgId, webhookTimestamp: String(nowSec), webhookSignature: sigHeader },
        webhookKey,
        nowSec,
      ),
    ).toBe(false);
  });

  it('preserves Plus entitlement during an active 7-day past_due dunning grace period and revokes after grace expiry', () => {
    const now = new Date('2026-11-22T12:00:00.000Z');
    const activeGrace = getScanQuotaEntitlement(
      {
        plan: 'plus',
        status: 'past_due',
        expires_at: '2026-11-21T00:00:00.000Z',
        grace_period_ends_at: '2026-11-28T00:00:00.000Z',
      },
      now,
    );
    expect(activeGrace.isPlus).toBe(true);

    const expiredGrace = getScanQuotaEntitlement(
      {
        plan: 'plus',
        status: 'past_due',
        expires_at: '2026-11-10T00:00:00.000Z',
        grace_period_ends_at: '2026-11-17T00:00:00.000Z',
      },
      now,
    );
    expect(expiredGrace.isPlus).toBe(false);
  });

  it('verifies Apple RS256 and LINE ES256 OIDC ID tokens locally via Web Crypto JWKS and caches keysets', async () => {
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
    const applePublicJwk = await crypto.subtle.exportKey('jwk', rsaPair.publicKey);

    const ecPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const linePublicJwk = await crypto.subtle.exportKey('jwk', ecPair.publicKey);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('appleid.apple.com')) {
        return new Response(JSON.stringify({ keys: [{ ...applePublicJwk, kid: 'apple-k1', alg: 'RS256' }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ keys: [{ ...linePublicJwk, kid: 'line-k1', alg: 'ES256' }] }), { status: 200 });
    });

    const appleHeader = jsonToBase64Url({ alg: 'RS256', kid: 'apple-k1', typ: 'JWT' });
    const applePayload = jsonToBase64Url({
      iss: APPLE_OIDC_ISSUER,
      sub: '001234.apple_sub_tokyo',
      aud: 'com.takolio.app',
      email: ['hide', 'privaterelay.appleid.com'].join('@'),
      email_verified: 'true',
      is_private_email: 'true',
      exp: nowSec + 600,
      iat: nowSec - 10,
    });
    const appleSig = new Uint8Array(
      await crypto.subtle.sign('RSASSA-PKCS1-v1_5', rsaPair.privateKey, new TextEncoder().encode(`${appleHeader}.${applePayload}`)),
    );
    const appleToken = `${appleHeader}.${applePayload}.${bytesToBase64Url(appleSig)}`;

    const appleClaims = await verifyOidcIdToken({
      token: appleToken,
      expectedIssuer: APPLE_OIDC_ISSUER,
      expectedAudience: 'com.takolio.app',
      jwksUrl: 'https://appleid.apple.com/auth/keys',
      nowSec,
    });
    expect(appleClaims.sub).toBe('001234.apple_sub_tokyo');

    await verifyOidcIdToken({
      token: appleToken,
      expectedIssuer: APPLE_OIDC_ISSUER,
      expectedAudience: 'com.takolio.app',
      jwksUrl: 'https://appleid.apple.com/auth/keys',
      nowSec,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const lineHeader = jsonToBase64Url({ alg: 'ES256', kid: 'line-k1', typ: 'JWT' });
    const linePayload = jsonToBase64Url({
      iss: LINE_OIDC_ISSUER,
      sub: 'U9876543210abcdef',
      aud: '2000123456',
      name: '佐藤 花子',
      exp: nowSec + 600,
      iat: nowSec - 5,
    });
    const lineSig = new Uint8Array(
      await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        ecPair.privateKey,
        new TextEncoder().encode(`${lineHeader}.${linePayload}`),
      ),
    );
    const lineToken = `${lineHeader}.${linePayload}.${bytesToBase64Url(lineSig)}`;

    const lineClaims = await verifyOidcIdToken({
      token: lineToken,
      expectedIssuer: LINE_OIDC_ISSUER,
      expectedAudience: '2000123456',
      jwksUrl: 'https://api.line.me/oauth2/v2.1/certs',
      nowSec,
    });
    expect(lineClaims.sub).toBe('U9876543210abcdef');
    expect(lineClaims.name).toBe('佐藤 花子');
  });
});
