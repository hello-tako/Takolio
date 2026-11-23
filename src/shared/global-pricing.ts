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
  checkoutMode: 'live_vietqr' | 'live_dodo_mor';
  paymentProvider: 'payos_vietqr' | 'dodo_mor';
  localeDefault: string;
}

/**
 * Authoritative regional display prices for Takolio Pro:
 * - `VND`: live VietQR / PayOS checkout pricing (`effectivePlusPrices`).
 * - International currencies (`USD`, `JPY`, `EUR`, `GBP`, etc.): live Dodo Payments
 *   Merchant-of-Record checkout with Adaptive Currency & tax-inclusive pricing.
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
      monthlyMinor: 499,
      annualMinor: 4990,
      checkoutMode: 'live_dodo_mor',
      paymentProvider: 'dodo_mor',
      localeDefault: 'en-US',
    },
    {
      currency: 'JPY',
      minorDigits: 0,
      monthlyMinor: 480,
      annualMinor: 4800,
      checkoutMode: 'live_dodo_mor',
      paymentProvider: 'dodo_mor',
      localeDefault: 'ja-JP',
    },
    {
      currency: 'EUR',
      minorDigits: 2,
      monthlyMinor: 499,
      annualMinor: 4990,
      checkoutMode: 'live_dodo_mor',
      paymentProvider: 'dodo_mor',
      localeDefault: 'de-DE',
    },
    {
      currency: 'KRW',
      minorDigits: 0,
      monthlyMinor: 6900,
      annualMinor: 69000,
      checkoutMode: 'live_dodo_mor',
      paymentProvider: 'dodo_mor',
      localeDefault: 'ko-KR',
    },
    {
      currency: 'THB',
      minorDigits: 0,
      monthlyMinor: 179,
      annualMinor: 1790,
      checkoutMode: 'live_dodo_mor',
      paymentProvider: 'dodo_mor',
      localeDefault: 'th-TH',
    },
    {
      currency: 'GBP',
      minorDigits: 2,
      monthlyMinor: 449,
      annualMinor: 4490,
      checkoutMode: 'live_dodo_mor',
      paymentProvider: 'dodo_mor',
      localeDefault: 'en-GB',
    },
    {
      currency: 'SGD',
      minorDigits: 2,
      monthlyMinor: 690,
      annualMinor: 6900,
      checkoutMode: 'live_dodo_mor',
      paymentProvider: 'dodo_mor',
      localeDefault: 'en-SG',
    },
    {
      currency: 'AUD',
      minorDigits: 2,
      monthlyMinor: 790,
      annualMinor: 7900,
      checkoutMode: 'live_dodo_mor',
      paymentProvider: 'dodo_mor',
      localeDefault: 'en-AU',
    },
  ];
}

export function marketCodeForCurrency(currency: GlobalDisplayCurrency): string {
  switch (currency) {
    case 'VND':
      return 'VN';
    case 'JPY':
      return 'JP';
    case 'EUR':
      return 'DE';
    case 'GBP':
      return 'GB';
    default:
      return 'US';
  }
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
