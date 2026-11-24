import type { SupportedLocale } from '../../../shared/locales';
import type { SiteDictionary } from '../types';
import { viDictionary } from './vi';
import { enDictionary } from './en';
import { jaDictionary } from './ja';
import { koDictionary } from './ko';
import { thDictionary } from './th';
import { zhDictionary } from './zh';
import { itDictionary } from './it';

const DICTIONARIES: Readonly<Record<SupportedLocale, SiteDictionary>> = {
  vi: viDictionary,
  en: enDictionary,
  ja: jaDictionary,
  ko: koDictionary,
  th: thDictionary,
  zh: zhDictionary,
  it: itDictionary,
};

export function getSiteDictionary(locale: SupportedLocale): SiteDictionary {
  return DICTIONARIES[locale] ?? viDictionary;
}
