import type { SupportedLocale } from '../../../shared/locales';

export type PackLocale = Exclude<SupportedLocale, 'vi' | 'en'>;

export const PACK_LOCALES = ['ja', 'ko', 'th', 'zh', 'it'] as const;

export interface LocalePack {
  locale: PackLocale;
  /** Exact static English string -> native translation (100% coverage of all l()/lSync() phrases). */
  phrases: Readonly<Record<string, string>>;
  /** Complete 90-key plannerCopy dictionary in this locale. */
  planner: Readonly<Record<string, string>>;
  /** Canonical ingredient English name (lowercase) or ID (UPPERCASE) -> native ingredient name. */
  ingredients: Readonly<Record<string, string>>;
  /** All 500 recipe slugs -> authentic native dish title. */
  recipeTitles: Readonly<Record<string, string>>;
  /** Domain enumerations & measurement labels. */
  enums: {
    storageZone: Readonly<Record<string, string>>;
    freshness: Readonly<Record<string, string>>;
    cuisine: Readonly<Record<string, string>>;
    category: Readonly<Record<string, string>>;
    difficulty: Readonly<Record<string, string>>;
    mealSlot: Readonly<Record<string, string>>;
    displayCategory: Readonly<Record<string, string>>;
    unit: Readonly<Record<string, string>>;
    weekdaysShort: readonly [string, string, string, string, string, string, string];
    weekdaysFull: readonly [string, string, string, string, string, string, string];
  };
  /** Pattern translators for interpolated / dynamic English template strings. */
  translateDynamic: (enText: string) => string | null;
  /** Native recipe description & cooking step templates. */
  recipeCopy: {
    prep: (lead: string, timerHint: string) => string;
    finish: (timerHint: string) => string;
    simmer: (mins: number) => string;
    stirFry: (mins: number) => string;
    combine: (mins: number) => string;
    timerHint: (mins: number) => string;
    description: (cuisineLabel: string, ingredientsSummary: string, mins: number, servings: number) => string;
    fallbackTitle: string;
    fallbackDescription: string;
    fallbackIngredient: string;
    fallbackError: string;
  };
}
