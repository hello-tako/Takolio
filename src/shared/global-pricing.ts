import type { PlusPlan } from './payment';

export const DEFAULT_VND_PRICES: Readonly<Record<PlusPlan, number>> = {
  monthly: 49000,
  annual: 499000,
};

export const GLOBAL_DISPLAY_CURRENCIES = [
  'VND',
  'USD',
  'JPY',
  'EUR',
  'KRW',
  'THB',
  'GBP',
  'SGD',
  'AUD',
] as const;

export type GlobalDisplayCurrency = (typeof GLOBAL_DISPLAY_CURRENCIES)[number];

export interface PublicVndPlanDto {
  plan: PlusPlan;
  amountVnd: number;
  currency: 'VND';
}

export interface RegionalPriceReference {
  currency: GlobalDisplayCurrency;
  minorDigits: 0 | 2;
  monthlyMinor: number;
  annualMinor: number;
  checkoutMode: 'live_vietqr' | 'display_reference';
  paymentProvider: 'payos_vietqr' | 'international_pending';
  localeDefault: string;
}

/**
 * Transparent global currency display references for Takolio Pro.
 * - `VND` is authoritative live checkout pricing via PayOS / VietQR (read from `effectivePlusPrices`).
 * - International currencies are indicative reference tiers until Stripe/Paddle merchant keys are activated.
 */
export function buildRegionalPriceReferences(
  vndPrices: Readonly<Record<PlusPlan, number>>,
): RegionalPriceReference[] {
  return [
    {
      currency: 'VND',
      minorDigits: 0,
      monthlyMinor: vndPrices.monthly,
      annualMinor: vndPrices.annual,
      checkoutMode: 'live_vietqr',
      paymentProvider: 'payos_vietqr',
      localeDefault: 'vi-VN',
    },
    {
      currency: 'USD',
      minorDigits: 2,
      monthlyMinor: 299,
      annualMinor: 2499,
      checkoutMode: 'display_reference',
      paymentProvider: 'international_pending',
      localeDefault: 'en-US',
    },
    {
      currency: 'JPY',
      minorDigits: 0,
      monthlyMinor: 450,
      annualMinor: 3800,
      checkoutMode: 'display_reference',
      paymentProvider: 'international_pending',
      localeDefault: 'ja-JP',
    },
    {
      currency: 'EUR',
      minorDigits: 2,
      monthlyMinor: 279,
      annualMinor: 2299,
      checkoutMode: 'display_reference',
      paymentProvider: 'international_pending',
      localeDefault: 'it-IT',
    },
    {
      currency: 'KRW',
      minorDigits: 0,
      monthlyMinor: 3900,
      annualMinor: 33000,
      checkoutMode: 'display_reference',
      paymentProvider: 'international_pending',
      localeDefault: 'ko-KR',
    },
    {
      currency: 'THB',
      minorDigits: 0,
      monthlyMinor: 99,
      annualMinor: 890,
      checkoutMode: 'display_reference',
      paymentProvider: 'international_pending',
      localeDefault: 'th-TH',
    },
    {
      currency: 'GBP',
      minorDigits: 2,
      monthlyMinor: 249,
      annualMinor: 1999,
      checkoutMode: 'display_reference',
      paymentProvider: 'international_pending',
      localeDefault: 'en-GB',
    },
    {
      currency: 'SGD',
      minorDigits: 2,
      monthlyMinor: 390,
      annualMinor: 3290,
      checkoutMode: 'display_reference',
      paymentProvider: 'international_pending',
      localeDefault: 'en-SG',
    },
    {
      currency: 'AUD',
      minorDigits: 2,
      monthlyMinor: 449,
      annualMinor: 3799,
      checkoutMode: 'display_reference',
      paymentProvider: 'international_pending',
      localeDefault: 'en-AU',
    },
  ];
}

export function formatGlobalMinorCurrency(
  minorAmount: number,
  currency: GlobalDisplayCurrency,
  minorDigits: 0 | 2,
  intlLocale: string,
): string {
  const major = minorDigits === 0 ? minorAmount : minorAmount / 10 ** minorDigits;
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency,
      maximumFractionDigits: minorDigits,
      minimumFractionDigits: minorDigits,
    }).format(major);
  } catch {
    return `${major.toFixed(minorDigits)} ${currency}`;
  }
}

export function defaultCurrencyForLocale(locale: string): GlobalDisplayCurrency {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith('vi')) return 'VND';
  if (normalized.startsWith('ja')) return 'JPY';
  if (normalized.startsWith('ko')) return 'KRW';
  if (normalized.startsWith('th')) return 'THB';
  if (normalized.startsWith('it')) return 'EUR';
  if (normalized.startsWith('zh')) return 'USD';
  return 'USD';
}
