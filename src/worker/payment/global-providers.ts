import {
  currencyMinorDigits,
  type GlobalCurrency,
  type SupportedLocale,
} from '../../../packages/domain/src/i18n';
import type { PlusPlan } from '../../shared/payment';
import type { Env } from '../types';
import { effectivePlusPrices } from './prices';

export type PaymentProviderId = 'dodo_mor' | 'payos_vn';

export type GlobalPaymentMethodType =
  | 'credit'
  | 'debit'
  | 'apple_pay'
  | 'google_pay'
  | 'amazon_pay'
  | 'konbini'
  | 'ideal'
  | 'sepa'
  | 'sepa_debit'
  | 'blik'
  | 'klarna'
  | 'vietqr';

export interface GlobalPlanOffer {
  plan: PlusPlan;
  provider: PaymentProviderId;
  currency: GlobalCurrency;
  amountMinor: number;
  minorDigits: 0 | 2;
  taxRatePercent: number;
  taxAmountMinor: number;
  taxInclusive: boolean;
  taxLabel: string;
  paymentMethods: GlobalPaymentMethodType[];
}

export interface GlobalRegionalCatalog {
  countryCode: string;
  provider: PaymentProviderId;
  merchantOfRecord: 'Dodo Payments' | null;
  currency: GlobalCurrency;
  minorDigits: 0 | 2;
  requiresEuWithdrawalWaiver: boolean;
  requiresTokushohoDisclosure: boolean;
  tokushohoUrl: string | null;
  plans: GlobalPlanOffer[];
}

export interface GlobalCheckoutSessionInput {
  intentId: string;
  userId: string;
  email?: string;
  displayName?: string;
  plan: PlusPlan;
  offer: GlobalPlanOffer;
  countryCode: string;
  locale: SupportedLocale;
  appUrl: string;
}

export interface GlobalCheckoutSessionOutput {
  provider: 'dodo_mor';
  providerSessionId: string;
  checkoutUrl: string;
  initialStatus: 'pending' | 'awaiting_async_payment';
}

export interface PaymentProviderAdapter {
  readonly id: 'dodo_mor';
  isConfigured(env: Env): boolean;
  createCheckoutSession(env: Env, input: GlobalCheckoutSessionInput): Promise<GlobalCheckoutSessionOutput>;
  createCustomerPortalSession(env: Env, dodoCustomerId: string, sendEmail?: boolean): Promise<{ portalUrl: string }>;
}

/**
 * EEA Member States (27 EU + IS, LI, NO) + United Kingdom (`GB`) where the
 * statutory 14-day digital right-of-withdrawal waiver (EU Directive 2011/83/EU
 * Art. 16(m) / UK Consumer Contracts Regulations Reg. 37) MUST be explicitly
 * acknowledged before immediate digital subscription activation.
 */
const EU_WITHDRAWAL_WAIVER_COUNTRIES = new Set<string>([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB',
]);

export function isEuWithdrawalWaiverRequired(countryCode: string): boolean {
  return EU_WITHDRAWAL_WAIVER_COUNTRIES.has(countryCode.trim().toUpperCase());
}

interface RegionalPriceSpec {
  currency: GlobalCurrency;
  monthlyMinor: number;
  annualMinor: number;
  vatPercent: number;
  paymentMethods: GlobalPaymentMethodType[];
}

const EUROPE_REGIONAL_PRICES: Readonly<Record<string, RegionalPriceSpec>> = Object.freeze({
  DE: { currency: 'EUR', monthlyMinor: 499, annualMinor: 4990, vatPercent: 19, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay', 'sepa_debit', 'klarna'] },
  FR: { currency: 'EUR', monthlyMinor: 499, annualMinor: 4990, vatPercent: 20, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay', 'sepa_debit'] },
  IT: { currency: 'EUR', monthlyMinor: 499, annualMinor: 4990, vatPercent: 22, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay', 'sepa_debit'] },
  ES: { currency: 'EUR', monthlyMinor: 499, annualMinor: 4990, vatPercent: 21, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay', 'sepa_debit'] },
  NL: { currency: 'EUR', monthlyMinor: 499, annualMinor: 4990, vatPercent: 21, paymentMethods: ['credit', 'debit', 'ideal', 'apple_pay', 'google_pay', 'sepa_debit'] },
  AT: { currency: 'EUR', monthlyMinor: 499, annualMinor: 4990, vatPercent: 20, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay', 'sepa_debit', 'klarna'] },
  BE: { currency: 'EUR', monthlyMinor: 499, annualMinor: 4990, vatPercent: 21, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay', 'sepa_debit'] },
  IE: { currency: 'EUR', monthlyMinor: 499, annualMinor: 4990, vatPercent: 23, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay'] },
  PT: { currency: 'EUR', monthlyMinor: 499, annualMinor: 4990, vatPercent: 23, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay'] },
  FI: { currency: 'EUR', monthlyMinor: 499, annualMinor: 4990, vatPercent: 25.5, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay'] },
  GR: { currency: 'EUR', monthlyMinor: 499, annualMinor: 4990, vatPercent: 24, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay'] },
  GB: { currency: 'GBP', monthlyMinor: 449, annualMinor: 4490, vatPercent: 20, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay'] },
  CH: { currency: 'CHF', monthlyMinor: 490, annualMinor: 4900, vatPercent: 8.1, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay'] },
  PL: { currency: 'PLN', monthlyMinor: 1999, annualMinor: 19990, vatPercent: 23, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay', 'blik'] },
  SE: { currency: 'SEK', monthlyMinor: 5900, annualMinor: 59000, vatPercent: 25, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay', 'klarna'] },
  NO: { currency: 'NOK', monthlyMinor: 5900, annualMinor: 59000, vatPercent: 25, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay'] },
  DK: { currency: 'DKK', monthlyMinor: 3900, annualMinor: 39000, vatPercent: 25, paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay'] },
});

function computeInclusiveTaxMinor(grossMinor: number, taxPercent: number): number {
  if (taxPercent <= 0) return 0;
  return Math.round(grossMinor - grossMinor / (1 + taxPercent / 100));
}

export function resolveGlobalRegionalCatalog(
  countryCodeInput: string,
  env: Pick<Env, 'PAYOS_TEST_MONTHLY_PRICE_VND' | 'APP_URL'> = {},
): GlobalRegionalCatalog {
  const cc = (countryCodeInput || 'US').trim().toUpperCase();
  const baseAppUrl = (env.APP_URL || 'https://app.takolio.com').replace(/\/+$/, '');

  if (cc === 'VN') {
    const vndPrices = effectivePlusPrices(env);
    return {
      countryCode: 'VN',
      provider: 'payos_vn',
      merchantOfRecord: null,
      currency: 'VND',
      minorDigits: 0,
      requiresEuWithdrawalWaiver: false,
      requiresTokushohoDisclosure: false,
      tokushohoUrl: null,
      plans: (['monthly', 'annual'] as const).map((plan) => ({
        plan,
        provider: 'payos_vn',
        currency: 'VND',
        amountMinor: vndPrices[plan],
        minorDigits: 0,
        taxRatePercent: 10,
        taxAmountMinor: computeInclusiveTaxMinor(vndPrices[plan], 10),
        taxInclusive: true,
        taxLabel: 'Đã bao gồm thuế GTGT',
        paymentMethods: ['vietqr'],
      })),
    };
  }

  if (cc === 'JP') {
    const jpAmounts: Record<PlusPlan, number> = { monthly: 480, annual: 4800 };
    return {
      countryCode: 'JP',
      provider: 'dodo_mor',
      merchantOfRecord: 'Dodo Payments',
      currency: 'JPY',
      minorDigits: 0,
      requiresEuWithdrawalWaiver: false,
      requiresTokushohoDisclosure: true,
      tokushohoUrl: `${baseAppUrl}/api/v1/billing/tokushoho`,
      plans: (['monthly', 'annual'] as const).map((plan) => ({
        plan,
        provider: 'dodo_mor',
        currency: 'JPY',
        amountMinor: jpAmounts[plan],
        minorDigits: 0,
        taxRatePercent: 10,
        taxAmountMinor: computeInclusiveTaxMinor(jpAmounts[plan], 10),
        taxInclusive: true,
        taxLabel: '税込（消費税10%込・決済代行/MoR: Dodo Payments）',
        paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay', 'amazon_pay'],
      })),
    };
  }

  const euSpec =
    EUROPE_REGIONAL_PRICES[cc] ??
    (EU_WITHDRAWAL_WAIVER_COUNTRIES.has(cc)
      ? {
          currency: 'EUR' as const,
          monthlyMinor: 499,
          annualMinor: 4990,
          vatPercent: 20,
          paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay'] as GlobalPaymentMethodType[],
        }
      : null);

  if (euSpec) {
    const minorDigits = currencyMinorDigits(euSpec.currency);
    return {
      countryCode: cc,
      provider: 'dodo_mor',
      merchantOfRecord: 'Dodo Payments',
      currency: euSpec.currency,
      minorDigits,
      requiresEuWithdrawalWaiver: isEuWithdrawalWaiverRequired(cc),
      requiresTokushohoDisclosure: false,
      tokushohoUrl: null,
      plans: (['monthly', 'annual'] as const).map((plan) => {
        const amountMinor = plan === 'monthly' ? euSpec.monthlyMinor : euSpec.annualMinor;
        return {
          plan,
          provider: 'dodo_mor',
          currency: euSpec.currency,
          amountMinor,
          minorDigits,
          taxRatePercent: euSpec.vatPercent,
          taxAmountMinor: computeInclusiveTaxMinor(amountMinor, euSpec.vatPercent),
          taxInclusive: true,
          taxLabel: `Incl. ${euSpec.vatPercent}% VAT (Merchant of Record: Dodo Payments)`,
          paymentMethods: euSpec.paymentMethods,
        };
      }),
    };
  }

  // Rest-of-world USD via Dodo Payments Merchant of Record
  return {
    countryCode: cc,
    provider: 'dodo_mor',
    merchantOfRecord: 'Dodo Payments',
    currency: 'USD',
    minorDigits: 2,
    requiresEuWithdrawalWaiver: false,
    requiresTokushohoDisclosure: false,
    tokushohoUrl: null,
    plans: (['monthly', 'annual'] as const).map((plan) => {
      const amountMinor = plan === 'monthly' ? 499 : 4990;
      return {
        plan,
        provider: 'dodo_mor',
        currency: 'USD',
        amountMinor,
        minorDigits: 2,
        taxRatePercent: 0,
        taxAmountMinor: 0,
        taxInclusive: false,
        taxLabel: 'Applicable local sales tax handled by Dodo Payments (Merchant of Record)',
        paymentMethods: ['credit', 'debit', 'apple_pay', 'google_pay'],
      };
    }),
  };
}

/**
 * Japan Specified Commercial Transactions Act (`特定商取引法に基づく表記` / Tokushoho)
 * statutory disclosure document reflecting Dodo Payments as Merchant of Record.
 */
export interface TokushohoDisclosure {
  act: 'JP_SPECIFIED_COMMERCIAL_TRANSACTIONS_ACT';
  locale: 'ja' | 'en';
  serviceProviderName: string;
  merchantOfRecord: string;
  representativeDirector: string;
  addressDisclosurePolicy: string;
  contactEmail: string;
  phoneDisclosurePolicy: string;
  sellingPriceTaxInclusive: {
    monthly: string;
    annual: string;
    additionalFees: string;
  };
  paymentMethods: string[];
  paymentTiming: string;
  serviceDeliveryTiming: string;
  cancellationAndRefundPolicy: string;
  operatingEnvironment: string;
}

export function buildTokushohoDisclosure(
  locale: SupportedLocale,
  env: Pick<Env, 'EMAIL_FROM_ADDRESS'> = {},
): TokushohoDisclosure {
  const supportEmail = env.EMAIL_FROM_ADDRESS || `${'support'}@takolio.com`;
  if (locale === 'ja') {
    return {
      act: 'JP_SPECIFIED_COMMERCIAL_TRANSACTIONS_ACT',
      locale: 'ja',
      serviceProviderName: 'Takolio Global Operations',
      merchantOfRecord: 'Dodo Payments（公認販売・決済代行事業者 / Merchant of Record：消費税等の徴収・納付および請求書発行を担当）',
      representativeDirector: '運営統括責任者（ご請求があり次第遅滞なく開示いたします）',
      addressDisclosurePolicy: '所在地については、お問い合わせ窓口へのご請求により遅滞なく電子メールにて開示いたします（消費者庁通達準拠）。',
      contactEmail: supportEmail,
      phoneDisclosurePolicy: '電話番号については、上記メールアドレスへのご請求により遅滞なく開示いたします。受付時間：平日 10:00〜18:00（JST）。',
      sellingPriceTaxInclusive: {
        monthly: 'Takolio Pro 月額プラン：¥480（税込・消費税10%込）',
        annual: 'Takolio Pro 年額プラン：¥4,800（税込・消費税10%込）',
        additionalFees: 'インターネット接続料金および通信料金はお客様のご負担となります。コンビニ決済手数料は¥0です。',
      },
      paymentMethods: [
        'クレジットカード / デビットカード（Visa / Mastercard / JCB / American Express — 3Dセキュア対応）',
        'Apple Pay / Google Pay',
        'コンビニ決済（年額プラン：セブン-イレブン・ローソン・ファミリーマート・ミニストップ）',
      ],
      paymentTiming: 'カード・Apple Pay・Google Pay：申込時および毎更新日に自動決済。コンビニ決済：お申込日から指定期限内にお支払いください（入金確認後に有効化）。',
      serviceDeliveryTiming: '即時決済の場合は決済完了後ただちにご利用いただけます。コンビニ決済の場合はご入金確認後ただちにご利用可能となります。',
      cancellationAndRefundPolicy: 'アカウント設定の「プラン管理（Dodo カスタマーポータルまたはアプリ内解約）」より次回更新日の前日までにいつでも自動更新を解約できます。解約後も契約期間満了日までTakolio Proをご利用いただけます。デジタルコンテンツの性質上、決済完了後の日割り返金・返品はお受けしておりません。',
      operatingEnvironment: 'iOS / Android 最新版ブラウザ、または Chrome / Safari / Edge / Firefox 最新版。',
    };
  }

  return {
    act: 'JP_SPECIFIED_COMMERCIAL_TRANSACTIONS_ACT',
    locale: 'en',
    serviceProviderName: 'Takolio Global Operations',
    merchantOfRecord: 'Dodo Payments (Authorized Merchant of Record handling billing, tax collection/remittance, and compliant tax invoicing)',
    representativeDirector: 'Operations Representative (disclosed promptly upon request pursuant to CAA guidance)',
    addressDisclosurePolicy: 'Physical business address is disclosed without delay via email upon consumer request in accordance with Japan Consumer Affairs Agency (CAA) guidelines.',
    contactEmail: supportEmail,
    phoneDisclosurePolicy: 'Telephone number is disclosed without delay via email upon request. Support hours: Weekdays 10:00-18:00 JST.',
    sellingPriceTaxInclusive: {
      monthly: 'Takolio Pro Monthly Plan: ¥480 (tax-inclusive, includes 10% JCT)',
      annual: 'Takolio Pro Annual Plan: ¥4,800 (tax-inclusive, includes 10% JCT)',
      additionalFees: 'Internet data charges apply separately. Konbini convenience store handling fee: ¥0.',
    },
    paymentMethods: [
      'Credit/Debit Card (Visa / Mastercard / JCB / Amex with 3D Secure)',
      'Apple Pay / Google Pay',
      'Konbini Cash Voucher (Annual Plan: 7-Eleven, Lawson, FamilyMart)',
    ],
    paymentTiming: 'Card / Apple Pay / Google Pay: charged upon purchase and on each renewal date. Konbini: payable within the voucher window (entitlement activates upon payment confirmation).',
    serviceDeliveryTiming: 'Immediate access upon confirmed payment; for Konbini payments, immediately upon receipt confirmation.',
    cancellationAndRefundPolicy: 'Cancel auto-renewal anytime before the next billing date via Account Settings -> Billing or the Dodo Customer Portal. Access continues until the end of the current paid period. Due to the nature of digital services, mid-cycle prorated refunds are not provided except where required by law.',
    operatingEnvironment: 'Latest iOS, Android, Chrome, Safari, Edge, or Firefox.',
  };
}

function constantTimeStringEquals(expected: string, candidate: string): boolean {
  if (expected.length === 0 || expected.length !== candidate.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
  }
  return diff === 0;
}

function decodeBase64Bytes(base64Input: string): Uint8Array | null {
  try {
    const normalized = base64Input.trim().replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLen);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function encodeBase64Bytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Verifies Dodo Payments webhook requests according to the **Standard Webhooks** specification:
 * - Required headers: `webhook-id`, `webhook-timestamp`, `webhook-signature` (`v1,<base64_hmac>` space-separated)
 * - Signing secret: strip `whsec_` prefix and **Base64-decode** into raw key bytes
 * - Signed payload: `${webhookId}.${webhookTimestamp}.${rawBody}`
 * - Replay protection: `|nowSec - Number(webhookTimestamp)| <= toleranceSec` (default `300s`)
 */
export async function verifyDodoWebhookSignature(
  rawBody: string,
  headers: {
    webhookId: string | undefined | null;
    webhookTimestamp: string | undefined | null;
    webhookSignature: string | undefined | null;
  },
  webhookKey: string | undefined | null,
  nowSec = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): Promise<boolean> {
  const { webhookId, webhookTimestamp, webhookSignature } = headers;
  if (!webhookId || !webhookTimestamp || !webhookSignature || !webhookKey) return false;
  if (!/^\d+$/.test(webhookTimestamp.trim())) return false;

  const ts = Number(webhookTimestamp.trim());
  if (!Number.isSafeInteger(ts) || Math.abs(nowSec - ts) > toleranceSec) return false;

  const strippedSecret = webhookKey.trim().startsWith('whsec_')
    ? webhookKey.trim().slice('whsec_'.length)
    : webhookKey.trim();
  const secretBytes = decodeBase64Bytes(strippedSecret);
  if (!secretBytes || secretBytes.length === 0) return false;

  const v1Candidates = webhookSignature
    .trim()
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith('v1,'))
    .map((entry) => entry.slice(3));

  if (v1Candidates.length === 0) return false;

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secretBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signingPayload = new TextEncoder().encode(`${webhookId.trim()}.${webhookTimestamp.trim()}.${rawBody}`);
  const macBuffer = await crypto.subtle.sign('HMAC', cryptoKey, signingPayload);
  const expectedBase64 = encodeBase64Bytes(new Uint8Array(macBuffer));

  return v1Candidates.some((sig) => constantTimeStringEquals(expectedBase64, sig));
}

export function resolveDodoApiBaseUrl(env: Pick<Env, 'DODO_PAYMENTS_BASE_URL' | 'DODO_PAYMENTS_ENVIRONMENT'>): string {
  if (env.DODO_PAYMENTS_BASE_URL) {
    return env.DODO_PAYMENTS_BASE_URL.replace(/\/+$/, '');
  }
  return env.DODO_PAYMENTS_ENVIRONMENT === 'live'
    ? 'https://live.dodopayments.com'
    : 'https://test.dodopayments.com';
}

/**
 * Maps internal payment method identifiers onto Dodo Payments' exact `/checkouts`
 * `allowed_payment_method_types` enum values (verified live against `test.dodopayments.com`).
 */
const DODO_WIRE_PAYMENT_METHODS = new Set<string>([
  'credit',
  'debit',
  'apple_pay',
  'google_pay',
  'amazon_pay',
  'ideal',
  'sepa',
  'blik',
  'klarna',
]);

export function toDodoAllowedPaymentMethodTypes(methods: readonly GlobalPaymentMethodType[]): string[] {
  const out = new Set<string>();
  for (const m of methods) {
    const mapped = m === 'sepa_debit' ? 'sepa' : m;
    if (DODO_WIRE_PAYMENT_METHODS.has(mapped)) {
      out.add(mapped);
    }
  }
  return out.size > 0 ? [...out] : ['credit', 'debit'];
}

class DodoPaymentsMoRAdapter implements PaymentProviderAdapter {
  readonly id = 'dodo_mor' as const;

  isConfigured(env: Env): boolean {
    return Boolean(
      env.DODO_PAYMENTS_API_KEY &&
      env.DODO_PAYMENTS_WEBHOOK_KEY &&
      env.DODO_PRODUCT_ID_MONTHLY &&
      env.DODO_PRODUCT_ID_ANNUAL,
    );
  }

  async createCheckoutSession(
    env: Env,
    input: GlobalCheckoutSessionInput,
  ): Promise<GlobalCheckoutSessionOutput> {
    if (!this.isConfigured(env)) {
      throw new Error('DODO_PAYMENTS_NOT_CONFIGURED');
    }

    const baseUrl = resolveDodoApiBaseUrl(env);
    const productId =
      input.plan === 'annual' ? env.DODO_PRODUCT_ID_ANNUAL! : env.DODO_PRODUCT_ID_MONTHLY!;

    const payload: Record<string, unknown> = {
      product_cart: [
        {
          product_id: productId,
          quantity: 1,
        },
      ],
      billing_currency: input.offer.currency,
      allowed_payment_method_types: toDodoAllowedPaymentMethodTypes(input.offer.paymentMethods),
      billing_address: {
        country: input.countryCode,
      },
      customer: {
        ...(input.email ? { email: input.email } : {}),
        ...(input.displayName ? { name: input.displayName } : {}),
      },
      metadata: {
        intent_id: input.intentId,
        user_id: input.userId,
        plan: input.plan,
        country_code: input.countryCode,
        locale: input.locale,
      },
      return_url: `${input.appUrl}/billing/return?intent_id=${encodeURIComponent(input.intentId)}`,
    };

    const res = await fetch(`${baseUrl}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DODO_PAYMENTS_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.intentId,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`DODO_CHECKOUT_FAILED_${res.status}`);
    }

    const body = (await res.json()) as {
      session_id?: string;
      checkout_url?: string;
      payment_status?: string;
    };

    if (!body.session_id || !body.checkout_url) {
      throw new Error('DODO_CHECKOUT_INVALID_RESPONSE');
    }

    return {
      provider: 'dodo_mor',
      providerSessionId: body.session_id,
      checkoutUrl: body.checkout_url,
      initialStatus: 'pending',
    };
  }

  async createCustomerPortalSession(
    env: Env,
    dodoCustomerId: string,
    sendEmail = false,
  ): Promise<{ portalUrl: string }> {
    if (!env.DODO_PAYMENTS_API_KEY) {
      throw new Error('DODO_PAYMENTS_NOT_CONFIGURED');
    }
    const baseUrl = resolveDodoApiBaseUrl(env);
    const query = sendEmail ? '?send_email=true' : '';
    const res = await fetch(
      `${baseUrl}/customers/${encodeURIComponent(dodoCustomerId)}/customer-portal/session${query}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.DODO_PAYMENTS_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!res.ok) {
      throw new Error(`DODO_PORTAL_FAILED_${res.status}`);
    }
    const body = (await res.json()) as { link?: string };
    if (!body.link) {
      throw new Error('DODO_PORTAL_INVALID_RESPONSE');
    }
    return { portalUrl: body.link };
  }
}

export const dodoPaymentsAdapter = new DodoPaymentsMoRAdapter();

export function getPaymentProviderAdapter(): PaymentProviderAdapter {
  return dodoPaymentsAdapter;
}
