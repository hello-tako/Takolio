import type { GlobalCurrency, SupportedLocale } from '../../../packages/domain/src/i18n';
import { getActiveUiLocale } from '../i18n';
import { fetchJson } from './http';

export interface GlobalPlanDto {
  plan: 'monthly' | 'annual';
  provider: 'dodo_mor' | 'payos_vn';
  currency: GlobalCurrency;
  amountMinor: number;
  minorDigits: 0 | 2;
  taxRatePercent: number;
  taxAmountMinor: number;
  taxInclusive: boolean;
  taxLabel: string;
  paymentMethods: string[];
}

export interface GlobalCatalogResponse {
  catalog: {
    countryCode: string;
    provider: 'dodo_mor' | 'payos_vn';
    merchantOfRecord: 'Dodo Payments' | null;
    currency: GlobalCurrency;
    minorDigits: 0 | 2;
    requiresEuWithdrawalWaiver: boolean;
    requiresTokushohoDisclosure: boolean;
    tokushohoUrl: string | null;
    plans: GlobalPlanDto[];
  };
}

export interface BarcodeLookupResponse {
  found: boolean;
  cached?: boolean;
  barcode: string;
  symbology: 'JAN13' | 'EAN13' | 'EAN8' | 'UPCA' | 'GTIN14';
  product?: {
    productName: string;
    brand: string | null;
    canonicalIngredientId: string | null;
    netQuantity: number | null;
    netUnit: string | null;
    nutriscoreGrade: 'a' | 'b' | 'c' | 'd' | 'e' | null;
    allergenTags: string[];
    allergenLabels: Array<{ key: string; label: string }>;
    storageZone: 'fridge' | 'veg_crisper' | 'chilled' | 'freezer' | 'pantry';
  };
}

function localeHeaders(locale: SupportedLocale | string = getActiveUiLocale()): Record<string, string> {
  return {
    'X-Takolio-Locale': String(locale),
  };
}

export async function fetchGlobalPlans(countryCode?: string, locale?: SupportedLocale): Promise<GlobalCatalogResponse> {
  const qs = countryCode ? `?country=${encodeURIComponent(countryCode)}` : '';
  return fetchJson<GlobalCatalogResponse>(`/billing/global/plans${qs}`, {
    method: 'GET',
    headers: localeHeaders(locale),
  });
}

export async function createGlobalDodoCheckout(input: {
  plan: 'monthly' | 'annual';
  countryCode?: string;
  euWithdrawalWaiverAccepted?: boolean;
  idempotencyKey?: string;
  locale?: SupportedLocale;
}): Promise<{
  success: boolean;
  intent: {
    id: string;
    provider: 'dodo_mor';
    merchantOfRecord: 'Dodo Payments';
    plan: 'monthly' | 'annual';
    currency: GlobalCurrency;
    amountMinor: number;
    minorDigits: 0 | 2;
    checkoutUrl: string | null;
    status: string;
  };
}> {
  return fetchJson('/billing/global/checkout', {
    method: 'POST',
    headers: {
      ...localeHeaders(input.locale),
      'Idempotency-Key': input.idempotencyKey ?? `dodo_${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      plan: input.plan,
      countryCode: input.countryCode,
      euWithdrawalWaiverAccepted: input.euWithdrawalWaiverAccepted,
    }),
  });
}

export async function openDodoCustomerPortal(): Promise<{ success: boolean; portalUrl: string }> {
  return fetchJson('/billing/global/portal', { method: 'POST' });
}

export async function cancelGlobalSubscription(): Promise<{ success: boolean; cancelAtPeriodEnd: boolean }> {
  return fetchJson('/billing/global/cancel', { method: 'POST' });
}

export async function lookupBarcodeProduct(code: string, locale?: SupportedLocale): Promise<BarcodeLookupResponse> {
  return fetchJson<BarcodeLookupResponse>(`/barcodes/${encodeURIComponent(code.trim())}`, {
    method: 'GET',
    headers: localeHeaders(locale),
  });
}

export async function signInWithApple(input: {
  identityToken: string;
  nonce?: string;
  firstName?: string;
  lastName?: string;
  locale?: SupportedLocale;
}) {
  return fetchJson('/auth/apple', {
    method: 'POST',
    headers: localeHeaders(input.locale),
    body: JSON.stringify({
      identityToken: input.identityToken,
      nonce: input.nonce,
      user: input.firstName || input.lastName ? { name: { firstName: input.firstName, lastName: input.lastName } } : undefined,
    }),
  });
}

export async function signInWithLine(input: { idToken: string; nonce?: string; locale?: SupportedLocale }) {
  return fetchJson('/auth/line', {
    method: 'POST',
    headers: localeHeaders(input.locale),
    body: JSON.stringify({ idToken: input.idToken, nonce: input.nonce }),
  });
}

export async function fetchAccountResidency() {
  return fetchJson<{
    activeCell: 'EU' | 'JP' | 'VN' | 'GLOBAL';
    residencyTier: string;
    recommendedCell: string;
    countryCode: string;
    sovereigntyEnforced: boolean;
  }>('/account/residency', { method: 'GET' });
}

export async function updateUserConsent(input: {
  consentType:
    | 'privacy_policy'
    | 'terms_of_service'
    | 'ai_vision_processing'
    | 'cross_border_ai_transfer'
    | 'marketing_communications';
  policyVersion: string;
  granted: boolean;
}) {
  return fetchJson('/account/consents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchGdprDataExport() {
  return fetchJson<Record<string, unknown>>('/account/export', { method: 'GET' });
}

export async function deleteAccountPermanently() {
  return fetchJson<{
    success: boolean;
    erasure: {
      requestId: string;
      status: 'completed' | 'pending_r2_purge';
      erasureMode: 'hard_delete' | 'cryptographic_tombstone';
    };
  }>('/account', {
    method: 'DELETE',
    body: JSON.stringify({ confirm: 'DELETE_MY_ACCOUNT' }),
  });
}
