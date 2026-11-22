import { z } from 'zod';

/**
 * Tier-1 global locales supported by Takolio backend content negotiation,
 * search normalization, transactional communications, and regional defaults.
 */
export const SUPPORTED_LOCALES = [
  'en',
  'ja',
  'de',
  'fr',
  'es',
  'it',
  'nl',
  'pl',
  'sv',
  'vi',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const SupportedLocaleSchema = z.enum(SUPPORTED_LOCALES);

const SUPPORTED_LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);

export const GLOBAL_CURRENCIES = [
  'VND',
  'JPY',
  'USD',
  'EUR',
  'GBP',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'HUF',
  'RON',
  'ISK',
] as const;

export type GlobalCurrency = (typeof GLOBAL_CURRENCIES)[number];

export const GlobalCurrencySchema = z.enum(GLOBAL_CURRENCIES);

export const CURRENCY_MINOR_DIGITS: Readonly<Record<GlobalCurrency, 0 | 2>> = Object.freeze({
  VND: 0,
  JPY: 0,
  ISK: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
  CHF: 2,
  SEK: 2,
  NOK: 2,
  DKK: 2,
  PLN: 2,
  CZK: 2,
  HUF: 2,
  RON: 2,
});

export function currencyMinorDigits(currency: GlobalCurrency): 0 | 2 {
  return CURRENCY_MINOR_DIGITS[currency];
}

export const CountryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Invalid ISO 3166-1 alpha-2 country code');

export type WeekStartDay = 0 | 1; // 0 = Sunday (Japan/US), 1 = Monday (ISO-8601 Europe/Vietnam)

export const WeekStartDaySchema = z.union([z.literal(0), z.literal(1)]);

export type CulinaryCultureCode =
  | 'jp_home'
  | 'eu_continental'
  | 'eu_mediterranean'
  | 'vn_family'
  | 'global_balanced';

export interface MarketDefaults {
  countryCode: string;
  locale: SupportedLocale;
  currency: GlobalCurrency;
  timeZone: string;
  weekStartDay: WeekStartDay;
  culinaryCulture: CulinaryCultureCode;
  defaultCuisines: readonly string[];
}

const COUNTRY_MARKET_TABLE: Readonly<Record<string, MarketDefaults>> = Object.freeze({
  JP: {
    countryCode: 'JP',
    locale: 'ja',
    currency: 'JPY',
    timeZone: 'Asia/Tokyo',
    weekStartDay: 0,
    culinaryCulture: 'jp_home',
    defaultCuisines: ['japanese'],
  },
  DE: {
    countryCode: 'DE',
    locale: 'de',
    currency: 'EUR',
    timeZone: 'Europe/Berlin',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian', 'japanese'],
  },
  AT: {
    countryCode: 'AT',
    locale: 'de',
    currency: 'EUR',
    timeZone: 'Europe/Vienna',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  CH: {
    countryCode: 'CH',
    locale: 'de',
    currency: 'CHF',
    timeZone: 'Europe/Zurich',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  FR: {
    countryCode: 'FR',
    locale: 'fr',
    currency: 'EUR',
    timeZone: 'Europe/Paris',
    weekStartDay: 1,
    culinaryCulture: 'eu_mediterranean',
    defaultCuisines: ['italian', 'japanese'],
  },
  BE: {
    countryCode: 'BE',
    locale: 'fr',
    currency: 'EUR',
    timeZone: 'Europe/Brussels',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  LU: {
    countryCode: 'LU',
    locale: 'fr',
    currency: 'EUR',
    timeZone: 'Europe/Luxembourg',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  ES: {
    countryCode: 'ES',
    locale: 'es',
    currency: 'EUR',
    timeZone: 'Europe/Madrid',
    weekStartDay: 1,
    culinaryCulture: 'eu_mediterranean',
    defaultCuisines: ['italian'],
  },
  IT: {
    countryCode: 'IT',
    locale: 'it',
    currency: 'EUR',
    timeZone: 'Europe/Rome',
    weekStartDay: 1,
    culinaryCulture: 'eu_mediterranean',
    defaultCuisines: ['italian'],
  },
  NL: {
    countryCode: 'NL',
    locale: 'nl',
    currency: 'EUR',
    timeZone: 'Europe/Amsterdam',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  GB: {
    countryCode: 'GB',
    locale: 'en',
    currency: 'GBP',
    timeZone: 'Europe/London',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian', 'japanese', 'thai'],
  },
  IE: {
    countryCode: 'IE',
    locale: 'en',
    currency: 'EUR',
    timeZone: 'Europe/Dublin',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  PT: {
    countryCode: 'PT',
    locale: 'en',
    currency: 'EUR',
    timeZone: 'Europe/Lisbon',
    weekStartDay: 1,
    culinaryCulture: 'eu_mediterranean',
    defaultCuisines: ['italian'],
  },
  FI: {
    countryCode: 'FI',
    locale: 'en',
    currency: 'EUR',
    timeZone: 'Europe/Helsinki',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  GR: {
    countryCode: 'GR',
    locale: 'en',
    currency: 'EUR',
    timeZone: 'Europe/Athens',
    weekStartDay: 1,
    culinaryCulture: 'eu_mediterranean',
    defaultCuisines: ['italian'],
  },
  PL: {
    countryCode: 'PL',
    locale: 'pl',
    currency: 'PLN',
    timeZone: 'Europe/Warsaw',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  SE: {
    countryCode: 'SE',
    locale: 'sv',
    currency: 'SEK',
    timeZone: 'Europe/Stockholm',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  NO: {
    countryCode: 'NO',
    locale: 'en',
    currency: 'NOK',
    timeZone: 'Europe/Oslo',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  DK: {
    countryCode: 'DK',
    locale: 'en',
    currency: 'DKK',
    timeZone: 'Europe/Copenhagen',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  CZ: {
    countryCode: 'CZ',
    locale: 'en',
    currency: 'CZK',
    timeZone: 'Europe/Prague',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  HU: {
    countryCode: 'HU',
    locale: 'en',
    currency: 'HUF',
    timeZone: 'Europe/Budapest',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  RO: {
    countryCode: 'RO',
    locale: 'en',
    currency: 'RON',
    timeZone: 'Europe/Bucharest',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  IS: {
    countryCode: 'IS',
    locale: 'en',
    currency: 'ISK',
    timeZone: 'Atlantic/Reykjavik',
    weekStartDay: 1,
    culinaryCulture: 'eu_continental',
    defaultCuisines: ['italian'],
  },
  VN: {
    countryCode: 'VN',
    locale: 'vi',
    currency: 'VND',
    timeZone: 'Asia/Ho_Chi_Minh',
    weekStartDay: 1,
    culinaryCulture: 'vn_family',
    defaultCuisines: ['vietnamese'],
  },
  US: {
    countryCode: 'US',
    locale: 'en',
    currency: 'USD',
    timeZone: 'America/New_York',
    weekStartDay: 0,
    culinaryCulture: 'global_balanced',
    defaultCuisines: ['italian', 'japanese'],
  },
});

const EUROZONE_FALLBACK_COUNTRIES = new Set([
  'SI',
  'SK',
  'EE',
  'LV',
  'LT',
  'CY',
  'MT',
  'HR',
]);

const LOCALE_DEFAULT_MARKET: Readonly<Record<SupportedLocale, MarketDefaults>> = Object.freeze({
  ja: COUNTRY_MARKET_TABLE.JP,
  de: COUNTRY_MARKET_TABLE.DE,
  fr: COUNTRY_MARKET_TABLE.FR,
  es: COUNTRY_MARKET_TABLE.ES,
  it: COUNTRY_MARKET_TABLE.IT,
  nl: COUNTRY_MARKET_TABLE.NL,
  pl: COUNTRY_MARKET_TABLE.PL,
  sv: COUNTRY_MARKET_TABLE.SE,
  vi: COUNTRY_MARKET_TABLE.VN,
  en: {
    countryCode: 'US',
    locale: 'en',
    currency: 'USD',
    timeZone: 'UTC',
    weekStartDay: 1,
    culinaryCulture: 'global_balanced',
    defaultCuisines: ['italian', 'japanese'],
  },
});

/**
 * Resolves a BCP-47 language tag (e.g. "ja-JP", "de-AT", "en-GB", "vi-VN")
 * into a canonical SupportedLocale, or null if unsupported.
 */
export function matchSupportedLocale(raw: string | null | undefined): SupportedLocale | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/_/g, '-').toLowerCase();
  if (!cleaned || cleaned === '*') return null;
  if (SUPPORTED_LOCALE_SET.has(cleaned)) return cleaned as SupportedLocale;
  const primary = cleaned.split('-')[0];
  if (primary && SUPPORTED_LOCALE_SET.has(primary)) return primary as SupportedLocale;
  return null;
}

export function resolveSupportedLocale(
  raw: string | null | undefined,
  fallback: SupportedLocale = 'en',
): SupportedLocale {
  return matchSupportedLocale(raw) ?? fallback;
}

/**
 * Parses an RFC 9110 Accept-Language header (e.g. "ja-JP,ja;q=0.9,en-US;q=0.8")
 * respecting quality weights (q=0..1) and returns the best matching SupportedLocale.
 */
export function negotiateAcceptLanguage(header: string | null | undefined): SupportedLocale | null {
  if (!header || typeof header !== 'string' || header.length > 512) return null;
  const candidates: Array<{ tag: string; q: number; index: number }> = [];
  const parts = header.split(',');
  for (let index = 0; index < parts.length; index++) {
    const segment = parts[index]?.trim();
    if (!segment) continue;
    const [rawTag, ...params] = segment.split(';').map((s) => s.trim());
    if (!rawTag) continue;
    let q = 1;
    let validQ = true;
    for (const param of params) {
      if (param.toLowerCase().startsWith('q=')) {
        const parsed = Number(param.slice(2));
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
          validQ = false;
          break;
        }
        q = parsed;
      }
    }
    if (!validQ || q <= 0) continue;
    candidates.push({ tag: rawTag, q, index });
  }
  candidates.sort((a, b) => b.q - a.q || a.index - b.index);
  for (const candidate of candidates) {
    const matched = matchSupportedLocale(candidate.tag);
    if (matched) return matched;
  }
  return null;
}

export function resolveMarketDefaults(
  countryCode?: string | null,
  preferredLocale?: SupportedLocale | null,
): MarketDefaults {
  const upperCountry = countryCode?.trim().toUpperCase();
  if (upperCountry && COUNTRY_MARKET_TABLE[upperCountry]) {
    const entry = COUNTRY_MARKET_TABLE[upperCountry];
    return preferredLocale ? { ...entry, locale: preferredLocale } : entry;
  }
  if (upperCountry && EUROZONE_FALLBACK_COUNTRIES.has(upperCountry)) {
    return {
      countryCode: upperCountry,
      locale: preferredLocale ?? 'en',
      currency: 'EUR',
      timeZone: 'Europe/Brussels',
      weekStartDay: 1,
      culinaryCulture: 'eu_continental',
      defaultCuisines: ['italian'],
    };
  }
  if (preferredLocale) {
    const fallback = LOCALE_DEFAULT_MARKET[preferredLocale];
    return upperCountry && /^[A-Z]{2}$/.test(upperCountry)
      ? { ...fallback, countryCode: upperCountry }
      : fallback;
  }
  return LOCALE_DEFAULT_MARKET.en;
}

// ============================================================================
// Script-Safe Unicode Normalization & Multilingual Search Tokenization
// ============================================================================

const LATIN_LIGATURE_MAP: Readonly<Record<string, string>> = Object.freeze({
  ß: 'ss',
  ẞ: 'ss',
  œ: 'oe',
  Œ: 'oe',
  æ: 'ae',
  Æ: 'ae',
  ø: 'o',
  Ø: 'o',
  ł: 'l',
  Ł: 'l',
  đ: 'd',
  Đ: 'd',
});

/**
 * Converts Katakana (including halfwidth Katakana after NFKC) to Hiragana
 * while strictly preserving dakuten/handakuten voicing marks (ぶ != ふ, ぱ != は).
 */
export function katakanaToHiragana(input: string): string {
  let out = '';
  for (const ch of input.normalize('NFKC')) {
    const cp = ch.codePointAt(0)!;
    // U+30A1 (ァ) .. U+30F6 (ヶ) -> U+3041 (ぁ) .. U+3096 (ゖ)
    // U+30FD (ヽ) .. U+30FE (ヾ) -> U+309D (ゝ) .. U+309E (ゞ)
    if ((cp >= 0x30a1 && cp <= 0x30f6) || (cp >= 0x30fd && cp <= 0x30fe)) {
      out += String.fromCodePoint(cp - 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}

function foldLatinCharactersOnly(input: string): string {
  return input.replace(/\p{Script=Latin}/gu, (ch) => {
    const mapped = LATIN_LIGATURE_MAP[ch];
    if (mapped !== undefined) return mapped;
    return ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  });
}

/**
 * Canonical script-safe text normalizer for ingredient aliases, OCR labels,
 * recipe discovery, and meal-composition search across CJK, Vietnamese, and European scripts.
 *
 * Guarantees:
 * 1. Halfwidth Katakana (`ﾊｰﾌﾍﾞｰｺﾝ`) & fullwidth digits (`２９８`) fold cleanly via NFKC.
 * 2. Katakana folds to Hiragana while NEVER stripping Kana dakuten/handakuten (`ぶた` stays `ぶた`, never `ふた`).
 * 3. European ligatures/letters (`ß->ss`, `œ->oe`, `æ->ae`, `ø->o`, `ł->l`, `đ->d`) and Latin accents fold cleanly.
 * 4. All Unicode letters & numbers (`\p{L}\p{N}`, plus Japanese prolonged sound mark `ー`) are preserved.
 */
export function normalizeMultilingualText(input: string): string {
  if (!input) return '';
  const nfkc = katakanaToHiragana(input);
  const latinFolded = foldLatinCharactersOnly(nfkc).toLowerCase();
  return latinFolded
    .replace(/[^\p{L}\p{N}\u30fc]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const CJK_CHAR_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u30fc]/u;
const GERMAN_UMLAUT_RE = /[äöüÄÖÜ]/;

function foldGermanDigraphVariant(word: string): string {
  return word
    .replace(/ä/gi, 'ae')
    .replace(/ö/gi, 'oe')
    .replace(/ü/gi, 'ue');
}

type SegmenterLike = {
  segment(input: string): Iterable<{ segment: string; isWordLike?: boolean }>;
};
const segmenterCache = new Map<string, SegmenterLike | null>();

function getWordSegmenter(locale: string): SegmenterLike | null {
  if (segmenterCache.has(locale)) return segmenterCache.get(locale)!;
  const SegCtor = (Intl as unknown as { Segmenter?: new (loc: string, opts: { granularity: 'word' }) => SegmenterLike }).Segmenter;
  if (typeof SegCtor !== 'function') {
    segmenterCache.set(locale, null);
    return null;
  }
  try {
    const seg = new SegCtor(locale, { granularity: 'word' });
    segmenterCache.set(locale, seg);
    return seg;
  } catch {
    segmenterCache.set(locale, null);
    return null;
  }
}

/**
 * Generates normalized search tokens for D1 FTS5 indexing (`unicode61 remove_diacritics 0`).
 * Handles space-less Japanese Kanji/Kana (via V8 Intl.Segmenter + bigrams + unigrams for 1-2 char queries like `卵`, `豆腐`)
 * and European digraphs (`Käse` -> both `kase` and `kaese`).
 */
export function tokenizeMultilingualSearch(
  text: string,
  options?: { locale?: SupportedLocale; readingHiragana?: string; mode?: 'document' | 'query' },
): string[] {
  const mode = options?.mode ?? 'document';
  const locale = options?.locale ?? 'en';
  const tokens = new Set<string>();

  const sources = [text];
  if (options?.readingHiragana) sources.push(options.readingHiragana);

  for (const raw of sources) {
    if (!raw) continue;
    const normalized = normalizeMultilingualText(raw);
    if (!normalized) continue;

    // Emit German DIN 5007-2 digraph variants (`ä->ae`, `ö->oe`, `ü->ue`) for documents
    if (mode === 'document' && GERMAN_UMLAUT_RE.test(raw)) {
      const digraph = normalizeMultilingualText(foldGermanDigraphVariant(raw));
      for (const part of digraph.split(' ')) {
        if (part) tokens.add(part);
      }
    }

    for (const chunk of normalized.split(' ')) {
      if (!chunk) continue;
      if (!CJK_CHAR_RE.test(chunk)) {
        tokens.add(chunk);
        continue;
      }

      // Space-less CJK chunk: segment words + emit bigrams/unigrams so 1-char (`卵`) & 2-char (`豆腐`, `そば`) match FTS5
      tokens.add(chunk);
      const segmenter = getWordSegmenter(locale === 'ja' ? 'ja' : 'ja');
      if (segmenter) {
        for (const item of segmenter.segment(chunk)) {
          if (item.isWordLike) {
            const w = item.segment.trim();
            if (w) tokens.add(w);
          }
        }
      }
      const chars = [...chunk];
      if (mode === 'document') {
        for (let i = 0; i < chars.length; i++) {
          tokens.add(chars[i]!);
          if (i + 1 < chars.length) {
            tokens.add(chars[i]! + chars[i + 1]!);
          }
        }
      } else if (chars.length <= 2) {
        tokens.add(chunk);
      } else {
        for (let i = 0; i + 1 < chars.length; i++) {
          tokens.add(chars[i]! + chars[i + 1]!);
        }
      }
    }
  }

  return [...tokens];
}

// ============================================================================
// IANA Timezone, European DST & Civil End-of-Day Expiry Authority
// ============================================================================

const dtfCache = new Map<string, Intl.DateTimeFormat>();
const validTzCache = new Map<string, boolean>();

export function isValidIanaTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string') return false;
  const trimmed = timeZone.trim();
  if (!trimmed || trimmed.length > 64 || !/^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)*$/.test(trimmed)) {
    return false;
  }
  const cached = validTzCache.get(trimmed);
  if (cached !== undefined) return cached;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed });
    validTzCache.set(trimmed, true);
    return true;
  } catch {
    validTzCache.set(trimmed, false);
    return false;
  }
}

export const IanaTimeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((tz) => isValidIanaTimeZone(tz), 'Invalid IANA time zone');

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = dtfCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(timeZone, fmt);
  }
  return fmt;
}

interface CivilParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function extractCivilParts(epochMs: number, timeZone: string): CivilParts {
  const parts = getFormatter(timeZone).formatToParts(new Date(epochMs));
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  let second = 0;
  for (const part of parts) {
    switch (part.type) {
      case 'year':
        year = Number(part.value);
        break;
      case 'month':
        month = Number(part.value);
        break;
      case 'day':
        day = Number(part.value);
        break;
      case 'hour':
        hour = Number(part.value);
        if (hour === 24) hour = 0;
        break;
      case 'minute':
        minute = Number(part.value);
        break;
      case 'second':
        second = Number(part.value);
        break;
    }
  }
  return { year, month, day, hour, minute, second };
}

/**
 * Returns the UTC offset in milliseconds (`localWallAsUtc - epochMs`) at `epochMs`
 * for an IANA `timeZone` (e.g. +32_400_000 for Asia/Tokyo, +3_600_000 / +7_200_000 for Europe/Berlin).
 */
export function getTimeZoneOffsetMs(epochMs: number, timeZone: string): number {
  const p = extractCivilParts(epochMs, timeZone);
  const subSecondMs = ((epochMs % 1000) + 1000) % 1000;
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, subSecondMs);
  return asUtc - epochMs;
}

/**
 * Formats an epoch timestamp as a civil `YYYY-MM-DD` date in the given IANA `timeZone`.
 * Prevents the 00:00-08:59 JST "yesterday" UTC date bug in Japan and Europe.
 */
export function formatLocalCalendarDate(epochMs: number, timeZone = 'UTC'): string {
  const tz = isValidIanaTimeZone(timeZone) ? timeZone : 'UTC';
  const p = extractCivilParts(epochMs, tz);
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function parseStrictIsoDate(dateStr: string): { year: number; month: number; day: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid civil date: ${dateStr}`);
  }
  const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maxDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > maxDays[month - 1]!) {
    throw new Error(`Impossible civil date: ${dateStr}`);
  }
  return { year, month, day };
}

/**
 * Converts a civil `YYYY-MM-DD` and `HH:MM` (or `HH:MM:SS.sss`) in an IANA `timeZone`
 * into exact UTC epoch milliseconds using Temporal-grade `compatible` DST disambiguation:
 * - On Fall-Back repeated hours (25h day in Europe), chooses the first (summer) occurrence.
 * - On Spring-Forward skipped hours (23h day in Europe), shifts forward by the transition gap.
 */
export function civilWallTimeToEpochMs(
  dateStr: string,
  timeStr: string,
  timeZone: string,
  millisecond = 0,
): number {
  const { year, month, day } = parseStrictIsoDate(dateStr);
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr);
  if (!match) throw new Error(`Invalid wall time: ${timeStr}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');
  if (hour > 23 || minute > 59 || second > 59) throw new Error(`Out-of-range wall time: ${timeStr}`);
  if (!isValidIanaTimeZone(timeZone)) throw new Error(`Invalid IANA time zone: ${timeZone}`);

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const offsetAfter = getTimeZoneOffsetMs(utcGuess, timeZone);
  const candidateLater = utcGuess - offsetAfter;
  const offsetBefore = getTimeZoneOffsetMs(candidateLater, timeZone);

  if (offsetBefore === offsetAfter) {
    // Check whether an earlier repeated Fall-Back occurrence exists 1-2 hours prior
    const probeEarlier = candidateLater - 3_600_000;
    const offsetProbe = getTimeZoneOffsetMs(probeEarlier, timeZone);
    if (offsetProbe > offsetAfter) {
      const candidateEarlier = utcGuess - offsetProbe;
      const parts = extractCivilParts(candidateEarlier, timeZone);
      if (
        parts.year === year &&
        parts.month === month &&
        parts.day === day &&
        parts.hour === hour &&
        parts.minute === minute &&
        parts.second === second
      ) {
        return candidateEarlier;
      }
    }
    return candidateLater;
  }

  // Spring-forward gap (`offsetBefore < offsetAfter`): shift forward cleanly (`utcGuess - offsetBefore`)
  if (offsetBefore < offsetAfter) {
    return utcGuess - offsetBefore;
  }

  // Fall-back overlap (`offsetBefore > offsetAfter`): `candidateLater` landed in the earlier (summer) occurrence
  return candidateLater;
}

export function wallClockToUtcInstant(dateStr: string, timeStr: string, timeZone: string): string {
  return new Date(civilWallTimeToEpochMs(dateStr, timeStr, timeZone, 0)).toISOString();
}

/**
 * Returns exact UTC epoch milliseconds for `23:59:59.999` on `dateStr` in `timeZone`.
 * Ensures a food item printed with `2026-11-23` remains valid until midnight at the end of Nov 23
 * in the household's local timezone (e.g. `2026-11-23T14:59:59.999Z` in `Asia/Tokyo`).
 */
export function endOfCivilDayEpochMs(dateStr: string, timeZone: string): number {
  return civilWallTimeToEpochMs(dateStr, '23:59:59', timeZone, 999);
}

// ============================================================================
// Localized Default Entity Labels (Eliminating Hardcoded Vietnamese DB Strings)
// ============================================================================

const DEFAULT_HOUSEHOLD_TEMPLATE: Readonly<Record<SupportedLocale, (name?: string | null) => string>> =
  Object.freeze({
    en: (name) => (name ? `${name}'s Kitchen` : 'My Kitchen'),
    ja: (name) => (name ? `${name}のキッチン` : 'マイキッチン'),
    de: (name) => (name ? `${name}s Küche` : 'Meine Küche'),
    fr: (name) => (name ? `Cuisine de ${name}` : 'Ma cuisine'),
    es: (name) => (name ? `Cocina de ${name}` : 'Mi cocina'),
    it: (name) => (name ? `Cucina di ${name}` : 'La mia cucina'),
    nl: (name) => (name ? `Keuken van ${name}` : 'Mijn keuken'),
    pl: (name) => (name ? `Kuchnia: ${name}` : 'Moja kuchnia'),
    sv: (name) => (name ? `${name}s kök` : 'Mitt kök'),
    vi: (name) => (name ? `Tủ lạnh của ${name}` : 'Tủ lạnh của tôi'),
  });

const GUEST_HOUSEHOLD_LABEL: Readonly<Record<SupportedLocale, string>> = Object.freeze({
  en: 'Guest Kitchen',
  ja: 'ゲストのキッチン',
  de: 'Gästeküche',
  fr: 'Cuisine invité',
  es: 'Cocina de invitado',
  it: 'Cucina ospite',
  nl: 'Gastkeuken',
  pl: 'Kuchnia gościa',
  sv: 'Gästkök',
  vi: 'Tủ lạnh khách ghé thăm',
});

const GUEST_DISPLAY_NAME: Readonly<Record<SupportedLocale, string>> = Object.freeze({
  en: 'Guest',
  ja: 'ゲスト',
  de: 'Gast',
  fr: 'Invité',
  es: 'Invitado',
  it: 'Ospite',
  nl: 'Gast',
  pl: 'Gość',
  sv: 'Gäst',
  vi: 'Khách ghé thăm',
});

const DEFAULT_USER_DISPLAY_NAME: Readonly<Record<SupportedLocale, string>> = Object.freeze({
  en: 'Takolio Member',
  ja: 'Takolio ユーザー',
  de: 'Takolio-Mitglied',
  fr: 'Membre Takolio',
  es: 'Usuario de Takolio',
  it: 'Utente Takolio',
  nl: 'Takolio-lid',
  pl: 'Użytkownik Takolio',
  sv: 'Takolio-medlem',
  vi: 'Người dùng Takolio',
});

const DEFAULT_SHOPPING_LIST_LABEL: Readonly<Record<SupportedLocale, string>> = Object.freeze({
  en: 'Shopping List',
  ja: '買い物リスト',
  de: 'Einkaufsliste',
  fr: 'Liste de courses',
  es: 'Lista de la compra',
  it: 'Lista della spesa',
  nl: 'Boodschappenlijst',
  pl: 'Lista zakupów',
  sv: 'Inköpslista',
  vi: 'Danh sách mua sắm',
});

export function localizeDefaultHouseholdName(
  locale: SupportedLocale,
  options?: { ownerName?: string | null; isGuest?: boolean },
): string {
  if (options?.isGuest) return GUEST_HOUSEHOLD_LABEL[locale];
  return DEFAULT_HOUSEHOLD_TEMPLATE[locale](options?.ownerName?.trim() || null);
}

export function localizeGuestDisplayName(locale: SupportedLocale): string {
  return GUEST_DISPLAY_NAME[locale];
}

export function localizeDefaultUserDisplayName(locale: SupportedLocale): string {
  return DEFAULT_USER_DISPLAY_NAME[locale];
}

export function localizeDefaultShoppingListName(locale: SupportedLocale): string {
  return DEFAULT_SHOPPING_LIST_LABEL[locale];
}
