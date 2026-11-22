import {
  CANONICAL_INGREDIENTS,
  CURRENCY_MINOR_DIGITS,
  GLOBAL_CURRENCIES,
  findCanonicalIngredient,
  findCanonicalIngredientById,
  type CanonicalIngredient,
  type GlobalCurrency,
} from '@frigo/domain';

export interface OcrNumberNormalizeOptions {
  locale?: string;
  currency?: string;
  /** True when parsing a physical quantity (e.g. `1,250 kg` in Europe = `1.25`, not `1250`). */
  isQuantity?: boolean;
}

const EUROPEAN_DECIMAL_COMMA_LOCALES = new Set(['de', 'fr', 'es', 'it', 'nl', 'pl', 'sv']);
const EUROPEAN_CURRENCIES = new Set([
  'EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'ISK',
]);

/** Strip Japanese parenthetical tax/rate suffixes (`¥298(外8%)`, `￥298（軽8%）`, `298円(税込321円)`) before extracting digits! */
function stripJapaneseTaxAnnotations(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/\((?:外|内|軽|税|軽減|非課税)[^)]*\)/gu, '')
    .replace(/(?:外税|内税|軽減税率|消費税)\s*\d+\s*%/gu, '');
}

function isEuropeanNumberContext(raw: string, options?: OcrNumberNormalizeOptions): boolean {
  if (/[€£]|(?:\b(?:eur|gbp|chf|pln|sek|nok|dkk|czk)\b)/i.test(raw)) return true;
  const currency = options?.currency?.trim().toUpperCase();
  if (currency && EUROPEAN_CURRENCIES.has(currency)) return true;
  const baseLang = options?.locale?.trim().toLowerCase().split(/[-_]/)[0];
  return Boolean(baseLang && EUROPEAN_DECIMAL_COMMA_LOCALES.has(baseLang));
}

/**
 * Coerce OCR number formats across Vietnam, Japan, and Europe:
 * - Default (no locale/currency): preserves legacy Vietnamese thousands-dot behavior (`42.000` -> `42000`, `0,91` -> `0.91`).
 * - Japan (`ja` / `JPY` / `¥` / `円`): normalizes full-width digits (`２９８円` -> `298`) and strips tax annotations (`¥298(外8%)` -> `298`, NOT `2988`).
 * - Europe (`de`/`fr`/`es`/`it`/`nl`/`pl`/`sv` / `EUR`): parses comma decimals (`1,99 €` -> `1.99`, `1,250 kg` -> `1.25`, `-0,25 €` -> `-0.25`, `1.234,56 €` -> `1234.56`).
 */
export function normalizeOcrNumber(value: unknown, options?: OcrNumberNormalizeOptions): unknown {
  if (typeof value !== 'string') return value;

  const stripped = stripJapaneseTaxAnnotations(value);
  const compact = stripped.trim().replace(/\s+/g, '');
  if (!compact) return value;

  const euContext = isEuropeanNumberContext(stripped, options);
  const cleaned = compact.replace(/[^0-9.,+-]/g, '');
  const sign = cleaned.startsWith('-') ? '-' : '';
  const unsigned = cleaned.replace(/^[+-]/, '').replace(/[+-]/g, '');
  if (!/\d/.test(unsigned)) return value;

  const commaIndex = unsigned.lastIndexOf(',');
  const dotIndex = unsigned.lastIndexOf('.');
  let normalized: string;

  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalIndex = Math.max(commaIndex, dotIndex);
    const integerPart = unsigned.slice(0, decimalIndex).replace(/[.,]/g, '');
    const fractionPart = unsigned.slice(decimalIndex + 1).replace(/[.,]/g, '');
    normalized = fractionPart ? `${integerPart}.${fractionPart}` : integerPart;
  } else if (commaIndex >= 0 || dotIndex >= 0) {
    const separator = commaIndex >= 0 ? ',' : '.';
    const groups = unsigned.split(separator);
    const fractionPart = groups[groups.length - 1] || '';
    const integerGroups = groups.slice(0, -1);
    const integerPart = integerGroups.join('');
    const groupedInteger =
      integerGroups.length > 0 &&
      integerGroups.every((group, index) => index === 0 || group.length === 3);

    if (groups.length > 2 && !groupedInteger) {
      normalized = groups.join('');
    } else if (euContext && separator === ',' && groups.length === 2) {
      // In Europe (`de`, `fr`, `es`, `it`, `nl`, `pl`, `sv`, `EUR`), a single comma is ALWAYS the decimal separator
      // (including 3-decimal weighed produce like `1,250 kg` = `1.25` kg!).
      normalized = `${integerPart || '0'}.${fractionPart}`;
    } else if (fractionPart.length === 3 && integerPart !== '0' && integerPart.length > 0 && !options?.isQuantity) {
      // `42.000` / `42,000` in VND/JPY or thousands-grouped major currencies (`1.000 EUR`).
      normalized = `${integerPart}${fractionPart}`;
    } else if (fractionPart) {
      normalized = `${integerPart || '0'}.${fractionPart}`;
    } else {
      normalized = integerPart;
    }
  } else {
    normalized = unsigned;
  }

  const parsed = Number(`${sign}${normalized}`);
  return Number.isFinite(parsed) ? parsed : value;
}

/** Converts a major-unit OCR price (e.g. `1.99` EUR or `298` JPY or `42000` VND) into exact integer minor units. */
export function toCurrencyMinorUnits(amountMajor: unknown, currency: string): number | undefined {
  if (amountMajor === null || amountMajor === undefined || amountMajor === '') return undefined;
  const upper = currency.trim().toUpperCase();
  if (!(GLOBAL_CURRENCIES as readonly string[]).includes(upper)) return undefined;
  const numeric = typeof amountMajor === 'number'
    ? amountMajor
    : normalizeOcrNumber(amountMajor, { currency: upper });
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return undefined;
  const scale = 10 ** CURRENCY_MINOR_DIGITS[upper as GlobalCurrency];
  const minor = Math.round(numeric * scale);
  return Number.isSafeInteger(minor) ? minor : undefined;
}

const V1_ID_SET = new Set(CANONICAL_INGREDIENTS.map((item) => item.id));

/**
 * Prefer a deterministic name/alias match, then retain a provider-supplied
 * canonical ID only when it resolves to an entry in the D1 `ingredients` FK catalog
 * (`CANONICAL_INGREDIENTS`), preventing foreign-key violations on `scan_items`.
 */
export function resolveProviderCanonical(
  rawName: string,
  providerCanonicalId?: unknown,
  options?: { includeGlobalLocales?: boolean },
): CanonicalIngredient | null {
  const byName = findCanonicalIngredient(rawName, options);
  if (byName && V1_ID_SET.has(byName.id)) return byName;
  const byId = findCanonicalIngredientById(providerCanonicalId);
  return byId && V1_ID_SET.has(byId.id) ? byId : null;
}
