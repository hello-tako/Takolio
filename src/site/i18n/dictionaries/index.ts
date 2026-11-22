import type { SupportedLocale } from '../../../shared/locales';
import type { SiteDictionary } from '../types';
import { viDictionary } from './vi';
import { enDictionary } from './en';
import {
  itDictionary,
  jaDictionary,
  koDictionary,
  thDictionary,
  zhDictionary,
} from './tier2';

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
