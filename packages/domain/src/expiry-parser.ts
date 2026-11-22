/**
 * Global Dual-Regime Food Expiry Parser (Japan CAA/MAFF & EU Reg 1169/2011 Art. 24):
 * - Distinguishes safety cutoff (`USE_BY`: 消費期限 / zu verbrauchen bis / DLC / Use by)
 *   from quality date (`BEST_BEFORE`: 賞味期限 / MHD / DDM / Best before).
 * - Converts Japanese Reiwa era (`令和` / `R`) dates (`year = 2018 + reiwaYear`, `元年 = 2019`),
 *   European `DD.MM.YYYY` / `DD/MM/YYYY` dates, and optional Japanese bento/sozai hour (`23時`).
 */

export type GlobalExpiryRegime = 'USE_BY' | 'BEST_BEFORE' | 'UNKNOWN';

export interface ParsedExpiryLabel {
  readonly expiryDate: string; // YYYY-MM-DD
  readonly regime: GlobalExpiryRegime;
  readonly expiryHour?: number; // 0..23 when printed on JP konbini/supermarket bentos
}

function isValidCalendarYmd(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maxDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day > maxDays) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const USE_BY_PATTERN =
  /消費期限|zu\s*verbrauchen\s*bis|verbrauchen\s*bis|\bdlc\b|[aà]\s*consommer\s*jusqu|fecha\s*de\s*caducidad|\bcaducidad\b|da\s*consumarsi\s*entro(?!\s*preferibilmente)|te\s*gebruiken\s*tot|\btgt\b|nale[zż]y\s*spo[zż]y[cć]\s*do|sista\s*f[oö]rbrukningsdag|\buse\s*by\b|h[aạ]n\s*s[uử]\s*d[uụ]ng|\bhsd\b/iu;

const BEST_BEFORE_PATTERN =
  /賞味期限|mindestens\s*haltbar(?:\s*bis)?|\bmhd\b|\bddm\b|\bdluo\b|consommer\s*de\s*pr[eé]f[eé]rence|consumir\s*preferentemente|da\s*consumarsi\s*preferibilmente|ten\s*minste\s*houdbaar|\btht\b|najlepiej\s*spo[zż]y[cć]\s*przed|b[aä]st\s*f[oö]re|\bbest\s*before\b|\bbbe\b/iu;

export function detectExpiryRegime(rawText: string): GlobalExpiryRegime {
  const normalized = rawText.normalize('NFKC');
  if (USE_BY_PATTERN.test(normalized)) return 'USE_BY';
  if (BEST_BEFORE_PATTERN.test(normalized)) return 'BEST_BEFORE';
  return 'UNKNOWN';
}

function extractOptionalHour(normalized: string): number | undefined {
  const jpHour = normalized.match(/(?:午後\s*)?(\d{1,2})\s*時/u);
  if (jpHour) {
    let hour = Number(jpHour[1]);
    if (/午後/.test(jpHour[0]) && hour >= 1 && hour <= 11) hour += 12;
    if (hour >= 0 && hour <= 23) return hour;
  }
  const hhmm = normalized.match(/(?:^|\s)([01]?\d|2[0-3]):[0-5]\d(?:\s|$)/);
  if (hhmm) return Number(hhmm[1]);
  return undefined;
}

/**
 * Parses localized expiry label strings from packaging or OCR into canonical ISO `YYYY-MM-DD`
 * plus the legal safety regime (`USE_BY` vs `BEST_BEFORE`). Never fabricates or defaults to "today".
 */
export function parseLocalizedExpiryLabel(
  rawInput: string,
  options?: { locale?: string },
): ParsedExpiryLabel | null {
  if (typeof rawInput !== 'string' || !rawInput.trim()) return null;
  const normalized = rawInput.normalize('NFKC').trim();
  const regime = detectExpiryRegime(normalized);
  const expiryHour = extractOptionalHour(normalized);

  // 1. Japanese Reiwa era (`令和8年11月25日`, `令和元年5月1日`, `R8.11.25`, `R08/11/25`)
  const reiwaKanji = normalized.match(/令和\s*(元|\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/u);
  if (reiwaKanji) {
    const reiwaYear = reiwaKanji[1] === '元' ? 1 : Number(reiwaKanji[1]);
    const ymd = isValidCalendarYmd(2018 + reiwaYear, Number(reiwaKanji[2]), Number(reiwaKanji[3]));
    return ymd ? { expiryDate: ymd, regime, ...(expiryHour !== undefined ? { expiryHour } : {}) } : null;
  }

  const reiwaShort = normalized.match(/(?:^|[^\p{L}])R\s*0?(\d{1,2})[./-](\d{1,2})[./-](\d{1,2})(?:\D|$)/iu);
  if (reiwaShort) {
    const ymd = isValidCalendarYmd(2018 + Number(reiwaShort[1]), Number(reiwaShort[2]), Number(reiwaShort[3]));
    return ymd ? { expiryDate: ymd, regime, ...(expiryHour !== undefined ? { expiryHour } : {}) } : null;
  }

  // 2. Japanese Kanji Gregorian (`2026年11月25日` or `26年11月25日`)
  const jpGregorian = normalized.match(/(\d{2,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/u);
  if (jpGregorian) {
    const rawYear = Number(jpGregorian[1]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const ymd = isValidCalendarYmd(year, Number(jpGregorian[2]), Number(jpGregorian[3]));
    return ymd ? { expiryDate: ymd, regime, ...(expiryHour !== undefined ? { expiryHour } : {}) } : null;
  }

  // 3. Explicit ISO / JP 4-digit year (`YYYY-MM-DD`, `YYYY.MM.DD`, `YYYY/MM/DD`)
  const isoMatch = normalized.match(/(?:^|\D)(20\d{2})[./-](\d{1,2})[./-](\d{1,2})(?:\D|$)/);
  if (isoMatch) {
    const ymd = isValidCalendarYmd(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    return ymd ? { expiryDate: ymd, regime, ...(expiryHour !== undefined ? { expiryHour } : {}) } : null;
  }

  // 4. European 4-digit year (`DD.MM.YYYY`, `DD/MM/YYYY`, `DD-MM-YYYY`)
  const euFullMatch = normalized.match(/(?:^|\D)(\d{1,2})[./-](\d{1,2})[./-](20\d{2})(?:\D|$)/);
  if (euFullMatch) {
    const ymd = isValidCalendarYmd(Number(euFullMatch[3]), Number(euFullMatch[2]), Number(euFullMatch[1]));
    return ymd ? { expiryDate: ymd, regime, ...(expiryHour !== undefined ? { expiryHour } : {}) } : null;
  }

  // 5. Ambiguous 2-digit year (`26.11.25` in JP = YY.MM.DD vs `25.11.26` in DE/FR/EU = DD.MM.YY)
  const shortMatch = normalized.match(/(?:^|\D)(\d{2})[./-](\d{1,2})[./-](\d{2})(?:\D|$)/);
  if (shortMatch) {
    const a = Number(shortMatch[1]);
    const b = Number(shortMatch[2]);
    const c = Number(shortMatch[3]);
    const isJapaneseContext =
      options?.locale?.toLowerCase().startsWith('ja') || /消費期限|賞味期限|製造|時/.test(normalized);
    const ymd = isJapaneseContext
      ? isValidCalendarYmd(2000 + a, b, c)
      : isValidCalendarYmd(2000 + c, b, a);
    return ymd ? { expiryDate: ymd, regime, ...(expiryHour !== undefined ? { expiryHour } : {}) } : null;
  }

  return null;
}
