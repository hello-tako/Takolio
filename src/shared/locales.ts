import type { GlobalDisplayCurrency } from './global-pricing';

export const SUPPORTED_LOCALES = ['vi', 'en', 'ja', 'ko', 'th', 'zh', 'it'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'vi';
export const X_DEFAULT_LOCALE: SupportedLocale = 'en';

export type UnitSystem = 'metric' | 'imperial';

export interface LocaleMeta {
  code: SupportedLocale;
  bcp47: string;
  hreflang: string;
  ogLocale: string;
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
  urlPrefix: string;
  defaultCurrency: GlobalDisplayCurrency;
  defaultUnitSystem: UnitSystem;
  speechLang: string;
  scriptClass: 'latin' | 'cjk-jp' | 'cjk-kr' | 'cjk-sc' | 'thai';
}

export const LOCALE_CATALOG: Readonly<Record<SupportedLocale, LocaleMeta>> = Object.freeze({
  vi: {
    code: 'vi',
    bcp47: 'vi',
    hreflang: 'vi-VN',
    ogLocale: 'vi_VN',
    nativeName: 'Tiếng Việt',
    englishName: 'Vietnamese',
    dir: 'ltr',
    urlPrefix: '',
    defaultCurrency: 'VND',
    defaultUnitSystem: 'metric',
    speechLang: 'vi-VN',
    scriptClass: 'latin',
  },
  en: {
    code: 'en',
    bcp47: 'en',
    hreflang: 'en',
    ogLocale: 'en_US',
    nativeName: 'English',
    englishName: 'English',
    dir: 'ltr',
    urlPrefix: '/en',
    defaultCurrency: 'USD',
    defaultUnitSystem: 'imperial',
    speechLang: 'en-US',
    scriptClass: 'latin',
  },
  ja: {
    code: 'ja',
    bcp47: 'ja',
    hreflang: 'ja',
    ogLocale: 'ja_JP',
    nativeName: '日本語',
    englishName: 'Japanese',
    dir: 'ltr',
    urlPrefix: '/ja',
    defaultCurrency: 'JPY',
    defaultUnitSystem: 'metric',
    speechLang: 'ja-JP',
    scriptClass: 'cjk-jp',
  },
  ko: {
    code: 'ko',
    bcp47: 'ko',
    hreflang: 'ko',
    ogLocale: 'ko_KR',
    nativeName: '한국어',
    englishName: 'Korean',
    dir: 'ltr',
    urlPrefix: '/ko',
    defaultCurrency: 'KRW',
    defaultUnitSystem: 'metric',
    speechLang: 'ko-KR',
    scriptClass: 'cjk-kr',
  },
  th: {
    code: 'th',
    bcp47: 'th',
    hreflang: 'th',
    ogLocale: 'th_TH',
    nativeName: 'ไทย',
    englishName: 'Thai',
    dir: 'ltr',
    urlPrefix: '/th',
    defaultCurrency: 'THB',
    defaultUnitSystem: 'metric',
    speechLang: 'th-TH',
    scriptClass: 'thai',
  },
  zh: {
    code: 'zh',
    bcp47: 'zh-Hans',
    hreflang: 'zh-Hans',
    ogLocale: 'zh_CN',
    nativeName: '中文',
    englishName: 'Chinese',
    dir: 'ltr',
    urlPrefix: '/zh',
    defaultCurrency: 'USD',
    defaultUnitSystem: 'metric',
    speechLang: 'zh-CN',
    scriptClass: 'cjk-sc',
  },
  it: {
    code: 'it',
    bcp47: 'it',
    hreflang: 'it',
    ogLocale: 'it_IT',
    nativeName: 'Italiano',
    englishName: 'Italian',
    dir: 'ltr',
    urlPrefix: '/it',
    defaultCurrency: 'EUR',
    defaultUnitSystem: 'metric',
    speechLang: 'it-IT',
    scriptClass: 'latin',
  },
});

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  if (!value) return false;
  return (SUPPORTED_LOCALES as readonly string[]).includes(value.toLowerCase());
}

export function normalizeLocale(value: string | null | undefined, fallback: SupportedLocale = DEFAULT_LOCALE): SupportedLocale {
  if (!value) return fallback;
  const primary = value.trim().toLowerCase().split(/[-_]/)[0];
  return isSupportedLocale(primary) ? primary : fallback;
}

export function parseLocaleFromPathname(pathname: string): {
  locale: SupportedLocale;
  barePath: string;
} {
  const clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const match = clean.match(/^\/([a-z]{2})(\/.*|$)/);
  if (match && match[1] && isSupportedLocale(match[1]) && match[1] !== 'vi') {
    const rest = match[2] || '/';
    return {
      locale: match[1],
      barePath: rest === '' ? '/' : rest.length > 1 ? rest.replace(/\/+$/, '') : rest,
    };
  }
  const normalized = clean.length > 1 ? clean.replace(/\/+$/, '') : clean;
  return { locale: 'vi', barePath: normalized };
}

export function buildLocalizedPath(locale: SupportedLocale, barePath: string): string {
  const clean = barePath.startsWith('/') ? barePath : `/${barePath}`;
  const normalized = clean.length > 1 ? clean.replace(/\/+$/, '') : clean;
  const prefix = LOCALE_CATALOG[locale].urlPrefix;
  if (!prefix) return normalized;
  return normalized === '/' ? prefix : `${prefix}${normalized}`;
}

export function buildHreflangCluster(
  origin: string,
  barePath: string,
  locales: readonly SupportedLocale[] = SUPPORTED_LOCALES,
): Array<{ hreflang: string; href: string }> {
  const base = origin.replace(/\/+$/, '');
  const list = locales.map((loc) => ({
    hreflang: LOCALE_CATALOG[loc].hreflang,
    href: `${base}${buildLocalizedPath(loc, barePath)}`,
  }));
  const xDefaultLocale = locales.includes(X_DEFAULT_LOCALE) ? X_DEFAULT_LOCALE : locales[0] ?? DEFAULT_LOCALE;
  list.push({
    hreflang: 'x-default',
    href: `${base}${buildLocalizedPath(xDefaultLocale, barePath)}`,
  });
  return list;
}
