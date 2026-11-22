import { useSyncExternalStore } from 'react';
import {
  currencyMinorDigits,
  type GlobalCurrency,
  type SupportedLocale,
} from '../../../packages/domain/src/i18n';
import { ApiError } from '../services/http';
import { deCatalog } from './locales/de';
import { enCatalog, type UiTranslationCatalog } from './locales/en';
import { frCatalog } from './locales/fr';
import { jaCatalog } from './locales/ja';
import { viCatalog } from './locales/vi';

export {
  getActiveAppLocale,
  LocaleProvider,
  TAKOLIO_LOCALE_STORAGE_KEY,
  TAKOLIO_UNIT_SYSTEM_STORAGE_KEY,
  useAppLocale,
  type AppChromeCopy,
} from './LocaleContext';

export const TIER1_UI_LOCALES = ['en', 'ja', 'de', 'fr', 'vi'] as const;
export type Tier1UiLocale = (typeof TIER1_UI_LOCALES)[number];

export const UI_LOCALE_DISPLAY_NAMES: Readonly<Record<Tier1UiLocale, string>> = Object.freeze({
  en: 'English',
  ja: '日本語',
  de: 'Deutsch',
  fr: 'Français',
  vi: 'Tiếng Việt',
});

export const UI_CATALOGS: Readonly<Record<Tier1UiLocale, UiTranslationCatalog>> = Object.freeze({
  en: enCatalog,
  ja: jaCatalog,
  de: deCatalog,
  fr: frCatalog,
  vi: viCatalog,
});

const STORAGE_KEY = 'takolio.ui_locale';
const NOTO_SANS_JP_LINK_ID = 'takolio-font-noto-sans-jp';

let currentLocale: Tier1UiLocale = 'en';
let hasExplicitSelection = false;
const listeners = new Set<() => void>();

export function resolveTier1UiLocale(raw: SupportedLocale | string | null | undefined): Tier1UiLocale {
  const normalized = (raw || '').trim().toLowerCase().split(/[-_]/)[0];
  if ((TIER1_UI_LOCALES as readonly string[]).includes(normalized)) {
    return normalized as Tier1UiLocale;
  }
  // Tier-2 European locales fall back cleanly to International English (`en`), NEVER Vietnamese (`vi`).
  return 'en';
}

export function applyDocumentLocaleTypography(locale: Tier1UiLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;

  if (locale === 'ja') {
    if (!document.getElementById(NOTO_SANS_JP_LINK_ID)) {
      const link = document.createElement('link');
      link.id = NOTO_SANS_JP_LINK_ID;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap';
      document.head.appendChild(link);
    }
    document.documentElement.style.setProperty(
      '--takolio-cjk-font-stack',
      '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
    );
  }
}

export function getActiveUiLocale(): Tier1UiLocale {
  if (hasExplicitSelection) return currentLocale;
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage?.getItem(STORAGE_KEY);
      if (stored) {
        currentLocale = resolveTier1UiLocale(stored);
        hasExplicitSelection = true;
        return currentLocale;
      }
    } catch {
      // Ignore storage access errors in restricted webviews
    }
  }
  return currentLocale;
}

export function hasExplicitGlobalUiLocale(): boolean {
  if (hasExplicitSelection) return true;
  if (typeof window !== 'undefined') {
    try {
      return Boolean(window.localStorage?.getItem(STORAGE_KEY));
    } catch {
      return false;
    }
  }
  return false;
}

export function setActiveUiLocale(locale: SupportedLocale | string): Tier1UiLocale {
  const next = resolveTier1UiLocale(locale);
  currentLocale = next;
  hasExplicitSelection = true;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage write errors
    }
  }
  applyDocumentLocaleTypography(next);
  for (const listener of listeners) listener();
  return next;
}

export function resetActiveUiLocaleForTests(): void {
  currentLocale = 'en';
  hasExplicitSelection = false;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
  for (const listener of listeners) listener();
}

export function getCatalog(locale: SupportedLocale | string = getActiveUiLocale()): UiTranslationCatalog {
  return UI_CATALOGS[resolveTier1UiLocale(locale)];
}

function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUiTranslation(overrideLocale?: SupportedLocale | string): {
  locale: Tier1UiLocale;
  catalog: UiTranslationCatalog;
  setLocale: (next: SupportedLocale | string) => Tier1UiLocale;
} {
  const active = useSyncExternalStore(subscribeLocale, getActiveUiLocale, () => 'en' as Tier1UiLocale);
  const effective = overrideLocale ? resolveTier1UiLocale(overrideLocale) : active;
  return {
    locale: effective,
    catalog: UI_CATALOGS[effective],
    setLocale: setActiveUiLocale,
  };
}

const BCP47_BY_UI_LOCALE: Readonly<Record<Tier1UiLocale, string>> = Object.freeze({
  en: 'en-GB',
  ja: 'ja-JP',
  de: 'de-DE',
  fr: 'fr-FR',
  vi: 'vi-VN',
});

export function bcp47ForUiLocale(locale: SupportedLocale | string): string {
  return BCP47_BY_UI_LOCALE[resolveTier1UiLocale(locale)];
}

/**
 * Formats integer minor-unit monetary values (`amountMinor`) with zero float drift
 * across 0-decimal (`JPY`, `VND`, `ISK`) and 2-decimal (`EUR`, `GBP`, `CHF`, `PLN`, `SEK`, `USD`) currencies.
 */
export function formatMoneyMinor(
  amountMinor: number,
  currency: GlobalCurrency,
  locale: SupportedLocale | string = getActiveUiLocale(),
): string {
  if (!Number.isFinite(amountMinor)) return '—';
  const digits = currencyMinorDigits(currency);
  const major = digits === 0 ? amountMinor : amountMinor / 10 ** digits;
  const tag = bcp47ForUiLocale(locale);
  return new Intl.NumberFormat(tag, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(major);
}

/**
 * Formats an ISO `YYYY-MM-DD` date alongside its legal food-safety regime
 * (`USE_BY` = `消費期限` / `Zu verbrauchen bis` / `DLC` vs `BEST_BEFORE` = `賞味期限` / `MHD` / `DDM`).
 */
export function formatExpiryWithRegime(
  isoDate: string,
  regime: 'USE_BY' | 'BEST_BEFORE' | 'ESTIMATED' | 'UNKNOWN',
  locale: SupportedLocale | string = getActiveUiLocale(),
): { formattedDate: string; regimeLabel: string; severity: 'danger' | 'warning' | 'neutral' } {
  const uiLocale = resolveTier1UiLocale(locale);
  const catalog = UI_CATALOGS[uiLocale];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  let formattedDate = isoDate;
  if (match) {
    const utcDate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    formattedDate = new Intl.DateTimeFormat(bcp47ForUiLocale(uiLocale), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    }).format(utcDate);
  }

  if (regime === 'USE_BY') {
    return { formattedDate, regimeLabel: catalog.fridge.expiryUseBy, severity: 'danger' };
  }
  if (regime === 'BEST_BEFORE') {
    return { formattedDate, regimeLabel: catalog.fridge.expiryBestBefore, severity: 'warning' };
  }
  return { formattedDate, regimeLabel: catalog.fridge.expiryBestBefore, severity: 'neutral' };
}

/**
 * Maps machine-readable backend `code` values onto localized UI messages,
 * guaranteeing that international users (`ja`, `de`, `fr`, `en`) never see legacy Vietnamese `error` text.
 */
export function translateApiError(
  errorOrCode: unknown,
  locale: SupportedLocale | string = getActiveUiLocale(),
): string {
  const catalog = getCatalog(locale);
  let code: string | null = null;
  if (typeof errorOrCode === 'string') {
    code = errorOrCode;
  } else if (errorOrCode instanceof ApiError) {
    code = errorOrCode.code;
  } else if (errorOrCode && typeof errorOrCode === 'object' && 'code' in errorOrCode) {
    const raw = (errorOrCode as { code?: unknown }).code;
    if (typeof raw === 'string') code = raw;
  }

  if (code && code in catalog.apiErrors) {
    return catalog.apiErrors[code as keyof typeof catalog.apiErrors];
  }
  return catalog.apiErrors.DEFAULT_ERROR;
}

export type { UiTranslationCatalog };
