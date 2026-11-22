/**
 * Phase P3: Locale-aware prompt directives for Takolio AI Produce & Receipt Scanning.
 * Defaults to Vietnamese (`vi`) for full backwards compatibility while enabling
 * English, Japanese, Korean, Thai, Chinese, and Italian household scanning sessions.
 */
export interface ScanLocalePromptDirectives {
  locale: string;
  outputLanguageName: string;
  currencyHint: string;
  produceDirective: string;
  receiptDirective: string;
}

const LOCALE_DIRECTIVES: Readonly<Record<string, Omit<ScanLocalePromptDirectives, 'locale'>>> = {
  vi: {
    outputLanguageName: 'Vietnamese',
    currencyHint: 'VND',
    produceDirective: 'Return ingredient display names in natural Vietnamese with canonical metric units (g, kg, ml, l, piece, pack, bunch, slice).',
    receiptDirective: 'Extract supermarket receipt lines in Vietnamese with exact quantities, units, and integer VND amounts.',
  },
  en: {
    outputLanguageName: 'English',
    currencyHint: 'USD',
    produceDirective: 'Return ingredient display names in clear English with canonical units (g, kg, ml, l, piece, pack, bunch, slice).',
    receiptDirective: 'Extract grocery receipt lines in English with exact quantities, units, and detected currency code.',
  },
  ja: {
    outputLanguageName: 'Japanese',
    currencyHint: 'JPY',
    produceDirective: 'Return ingredient display names in natural Japanese with metric units (g, kg, ml, l, piece, pack, bunch, slice).',
    receiptDirective: 'Extract Japanese supermarket receipt lines with exact quantities, units, and integer JPY amounts.',
  },
  ko: {
    outputLanguageName: 'Korean',
    currencyHint: 'KRW',
    produceDirective: 'Return ingredient display names in natural Korean with metric units (g, kg, ml, l, piece, pack, bunch, slice).',
    receiptDirective: 'Extract Korean grocery receipt lines with exact quantities, units, and integer KRW amounts.',
  },
  th: {
    outputLanguageName: 'Thai',
    currencyHint: 'THB',
    produceDirective: 'Return ingredient display names in natural Thai with metric units (g, kg, ml, l, piece, pack, bunch, slice).',
    receiptDirective: 'Extract Thai grocery receipt lines with exact quantities, units, and THB amounts.',
  },
  zh: {
    outputLanguageName: 'Simplified Chinese',
    currencyHint: 'CNY',
    produceDirective: 'Return ingredient display names in natural Simplified Chinese with metric units (g, kg, ml, l, piece, pack, bunch, slice).',
    receiptDirective: 'Extract Chinese grocery receipt lines with exact quantities, units, and detected currency amounts.',
  },
  it: {
    outputLanguageName: 'Italian',
    currencyHint: 'EUR',
    produceDirective: 'Return ingredient display names in natural Italian with metric units (g, kg, ml, l, piece, pack, bunch, slice).',
    receiptDirective: 'Extract Italian grocery receipt lines with exact quantities, units, and EUR amounts.',
  },
};

export function getScanLocalePromptDirectives(locale?: string | null): ScanLocalePromptDirectives {
  const primary = (locale || 'vi').trim().toLowerCase().split(/[-_]/)[0];
  const entry = LOCALE_DIRECTIVES[primary] ?? LOCALE_DIRECTIVES.vi;
  return { locale: primary in LOCALE_DIRECTIVES ? primary : 'vi', ...entry };
}
