import type { SupportedLocale } from '../../../shared/locales';
import type { LocalePack, PackLocale } from './types';

const loadedPacks = new Map<PackLocale, LocalePack>();
const inFlight = new Map<PackLocale, Promise<LocalePack | null>>();
const listeners = new Set<() => void>();
let packVersion = 0;

export function isPackLocale(locale: string | null | undefined): locale is PackLocale {
  return locale === 'ja' || locale === 'ko' || locale === 'th' || locale === 'zh' || locale === 'it';
}

export function getLoadedLocalePack(locale: SupportedLocale | string): LocalePack | null {
  if (!isPackLocale(locale)) return null;
  return loadedPacks.get(locale) ?? null;
}

export function registerLocalePack(pack: LocalePack): void {
  loadedPacks.set(pack.locale, pack);
  packVersion += 1;
  for (const fn of listeners) fn();
}

export function getLocalePackVersion(): number {
  return packVersion;
}

export function subscribeLocalePack(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function importPackModule(locale: PackLocale): Promise<LocalePack | null> {
  try {
    switch (locale) {
      case 'ja':
        return (await import('./ja')).jaLocalePack;
      case 'ko':
        return (await import('./ko')).koLocalePack;
      case 'th':
        return (await import('./th')).thLocalePack;
      case 'zh':
        return (await import('./zh')).zhLocalePack;
      case 'it':
        return (await import('./it')).itLocalePack;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function loadLocalePack(locale: SupportedLocale | string): Promise<LocalePack | null> {
  if (!isPackLocale(locale)) return Promise.resolve(null);
  const existing = loadedPacks.get(locale);
  if (existing) return Promise.resolve(existing);

  const pending = inFlight.get(locale);
  if (pending) return pending;

  const task = importPackModule(locale)
    .then((pack) => {
      if (pack) {
        loadedPacks.set(locale, pack);
        packVersion += 1;
        for (const fn of listeners) fn();
      }
      return pack;
    })
    .finally(() => {
      inFlight.delete(locale);
    });

  inFlight.set(locale, task);
  return task;
}
