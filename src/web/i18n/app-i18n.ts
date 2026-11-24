import { useCallback, useSyncExternalStore } from 'react';
import { CANONICAL_INGREDIENTS } from '@frigo/domain';
import {
  convertStepTemperatures,
  formatDisplayQuantity,
} from '../../../packages/domain/src/unit-conversion';
import {
  synthesizeEnglishRecipeMeta,
  synthesizeEnglishSteps,
  translateIngredientNameToEn,
} from '../../../packages/recipes/src/global-i18n';
import { LOCALE_CATALOG, type SupportedLocale, type UnitSystem } from '../../shared/locales';
import {
  getCanonicalEnglishRecipeTitle,
  resolveRecipeSlug,
} from '../../shared/recipe-titles-en';
import { getActiveAppLocale, getActiveUnitSystem, useAppLocale } from './LocaleContext';
import {
  getLoadedLocalePack,
  getLocalePackVersion,
  subscribeLocalePack,
} from './packs/registry';

const VIETNAMESE_DIACRITIC_RE =
  /[ăđơưĂĐƠƯảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/u;

export function containsVietnameseDiacritics(text: string): boolean {
  return VIETNAMESE_DIACRITIC_RE.test(text);
}

/**
 * Translates an English UI string into any supported non-Vietnamese locale using
 * the active loaded LocalePack (exact phrase lookup + dynamic pattern translation).
 */
export function translateEnForLocale(
  en: string,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  if (locale === 'en' || locale === 'vi') return en;
  const pack = getLoadedLocalePack(locale);
  if (!pack) return en;
  const exact = pack.phrases[en];
  if (exact !== undefined) return exact;
  const dynamic = pack.translateDynamic(en);
  if (dynamic !== null) return dynamic;
  return en;
}

/**
 * Synchronous locale picker for non-React utilities, services, and stores.
 * Supports all 7 Takolio locales (`vi`, `en`, `ja`, `ko`, `th`, `zh`, `it`).
 */
export function lSync(
  vi: string,
  en: string,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  if (locale === 'vi') return vi;
  if (locale === 'en') return en;
  return translateEnForLocale(en, locale);
}

/**
 * Planner-compatible bridge for components that accept an explicit `'vi' | 'en'` prop
 * in unit tests while rendering in all 7 locales inside the real app.
 */
export function lPlanner(plannerLocale: 'vi' | 'en', vi: string, en: string): string {
  if (plannerLocale === 'vi') return vi;
  const active = getActiveAppLocale();
  return lSync(vi, en, active === 'vi' ? 'en' : active);
}

export function isViLocale(locale: SupportedLocale = getActiveAppLocale()): boolean {
  return locale === 'vi';
}

export function getActiveBcp47(locale: SupportedLocale = getActiveAppLocale()): string {
  const bcp = LOCALE_CATALOG[locale]?.bcp47;
  if (bcp === 'vi') return 'vi-VN';
  if (bcp === 'en') return 'en-US';
  if (bcp === 'ja') return 'ja-JP';
  if (bcp === 'ko') return 'ko-KR';
  if (bcp === 'th') return 'th-TH';
  if (bcp === 'zh-Hans') return 'zh-CN';
  if (bcp === 'it') return 'it-IT';
  return 'en-US';
}

const DEFAULT_WEEKDAYS_SHORT_VI = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;
const DEFAULT_WEEKDAYS_SHORT_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DEFAULT_WEEKDAYS_FULL_VI = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'] as const;
const DEFAULT_WEEKDAYS_FULL_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export function getLocalizedWeekdays(
  locale: SupportedLocale = getActiveAppLocale(),
  format: 'short' | 'full' = 'short',
): readonly [string, string, string, string, string, string, string] {
  if (locale === 'vi') return format === 'full' ? DEFAULT_WEEKDAYS_FULL_VI : DEFAULT_WEEKDAYS_SHORT_VI;
  const pack = getLoadedLocalePack(locale);
  if (pack) {
    return format === 'full' ? pack.enums.weekdaysFull : pack.enums.weekdaysShort;
  }
  return format === 'full' ? DEFAULT_WEEKDAYS_FULL_EN : DEFAULT_WEEKDAYS_SHORT_EN;
}

/**
 * Primary React hook for full 7-language consumer app localization.
 * - Preserves exact Vietnamese copy when `locale === 'vi'`.
 * - Delivers native translations for `en`, `ja`, `ko`, `th`, `zh`, and `it` via loaded LocalePacks.
 */
export function useLocaleText() {
  const ctx = useAppLocale();
  const packVersion = useSyncExternalStore(
    subscribeLocalePack,
    getLocalePackVersion,
    getLocalePackVersion,
  );
  const effectiveLocale = ctx.isProvided ? ctx.locale : getActiveAppLocale();
  const effectiveUnitSystem = ctx.isProvided ? ctx.unitSystem : getActiveUnitSystem(effectiveLocale);
  const isVi = effectiveLocale === 'vi';
  const l = useCallback(
    (vi: string, en: string) => {
      void packVersion;
      return lSync(vi, en, effectiveLocale);
    },
    [effectiveLocale, packVersion],
  );
  return {
    locale: effectiveLocale,
    unitSystem: effectiveUnitSystem,
    copy: ctx.copy,
    setLocale: ctx.setLocale,
    setUnitSystem: ctx.setUnitSystem,
    isVi,
    l,
  };
}

// ── Ingredient & Unit Localization ─────────────────────────────────────────

const CANONICAL_VI_TO_EN: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    CANONICAL_INGREDIENTS.flatMap((item) => {
      const pairs: Array<[string, string]> = [[item.nameVi.trim().toLowerCase(), item.nameEn]];
      for (const alias of item.aliases ?? []) {
        pairs.push([alias.trim().toLowerCase(), item.nameEn]);
      }
      return pairs;
    }),
  ),
);

const EXTRA_VI_INGREDIENT_TO_EN: Readonly<Record<string, string>> = Object.freeze({
  'thịt ba chỉ': 'Pork belly',
  'thịt heo': 'Pork',
  'thịt lợn': 'Pork',
  'thịt bằm': 'Ground pork',
  'thịt xay': 'Ground pork',
  'sườn non': 'Pork ribs',
  'ức gà': 'Chicken breast',
  'đùi gà': 'Chicken thigh',
  'cánh gà': 'Chicken wings',
  'thịt gà': 'Chicken',
  'thịt bò': 'Beef',
  'bắp bò': 'Beef shank',
  'tôm tươi': 'Fresh shrimp',
  'tôm': 'Shrimp',
  'mực': 'Squid',
  'cá hồi': 'Salmon',
  'cá lóc': 'Snakehead fish',
  'cá thu': 'Mackerel',
  'cá': 'Fish',
  'trứng gà': 'Chicken eggs',
  'trứng vịt': 'Duck eggs',
  'trứng cút': 'Quail eggs',
  'trứng': 'Eggs',
  'đậu phụ': 'Tofu',
  'đậu hũ': 'Tofu',
  'đậu hũ non': 'Silken tofu',
  'bí đỏ': 'Pumpkin',
  'cà chua': 'Tomatoes',
  'cà rốt': 'Carrots',
  'khoai tây': 'Potatoes',
  'khoai lang': 'Sweet potatoes',
  'hành tây': 'Onion',
  'hành lá': 'Scallions',
  'hành tím': 'Shallot',
  'tỏi': 'Garlic',
  'gừng': 'Ginger',
  'sả': 'Lemongrass',
  'ớt': 'Chili pepper',
  'rau muống': 'Water spinach',
  'cải thìa': 'Bok choy',
  'cải thảo': 'Napa cabbage',
  'bắp cải': 'Cabbage',
  'bông cải xanh': 'Broccoli',
  'rau cải': 'Leafy greens',
  'rau thơm': 'Fresh herbs',
  'ngò rí': 'Cilantro',
  'rau mùi': 'Cilantro',
  'dưa leo': 'Cucumber',
  'dưa chuột': 'Cucumber',
  'giá đỗ': 'Bean sprouts',
  'nấm hương': 'Shiitake mushrooms',
  'nấm đông cô': 'Shiitake mushrooms',
  'nấm kim châm': 'Enoki mushrooms',
  'nấm': 'Mushrooms',
  'chanh': 'Lime',
  'nước mắm': 'Fish sauce',
  'nước tương': 'Soy sauce',
  'xì dầu': 'Soy sauce',
  'dầu hào': 'Oyster sauce',
  'dầu ăn': 'Cooking oil',
  'dầu mè': 'Sesame oil',
  'dầu ô liu': 'Olive oil',
  'muối': 'Salt',
  'đường': 'Sugar',
  'tiêu': 'Black pepper',
  'hạt tiêu': 'Black pepper',
  'hạt nêm': 'Seasoning powder',
  'bột ngọt': 'MSG',
  'gạo': 'Rice',
  'cơm': 'Steamed rice',
  'bún': 'Rice vermicelli',
  'phở': 'Flat rice noodles',
  'mì': 'Noodles',
  'mì gói': 'Instant noodles',
  'mì trứng': 'Egg noodles',
  'mì ý': 'Spaghetti',
  'sữa tươi': 'Fresh milk',
  'sữa': 'Milk',
  'phô mai': 'Cheese',
  'bơ': 'Butter',
  'nước cốt dừa': 'Coconut milk',
  'nước dừa': 'Coconut water',
  'ngô ngọt': 'Sweet corn',
  'bắp ngọt': 'Sweet corn',
  'đậu que': 'Green beans',
  'đậu cô ve': 'Green beans',
  'cà tím': 'Eggplant',
  'mướp đắng': 'Bitter melon',
  'khổ qua': 'Bitter melon',
  'bí đao': 'Winter melon',
  'su su': 'Chayote',
  'đậu bắp': 'Okra',
  'củ cải trắng': 'Daikon radish',
  'củ cải': 'Radish',
  'rau bina': 'Spinach',
  'cải bó xôi': 'Spinach',
  'kim chi': 'Kimchi',
});

function resolveEnglishIngredientName(
  ingredientId: string | null | undefined,
  rawName: string | null | undefined,
): string {
  const safeRaw = (rawName ?? '').trim();
  if (ingredientId) {
    const byId = translateIngredientNameToEn(ingredientId, '');
    if (byId && !containsVietnameseDiacritics(byId)) return byId;
  }

  const lower = safeRaw.toLowerCase();
  if (CANONICAL_VI_TO_EN[lower]) return CANONICAL_VI_TO_EN[lower];
  if (EXTRA_VI_INGREDIENT_TO_EN[lower]) return EXTRA_VI_INGREDIENT_TO_EN[lower];

  for (const [viKey, enVal] of Object.entries(EXTRA_VI_INGREDIENT_TO_EN)) {
    if (lower.includes(viKey)) return enVal;
  }

  if (safeRaw && !containsVietnameseDiacritics(safeRaw)) return safeRaw;
  if (ingredientId && !containsVietnameseDiacritics(ingredientId)) {
    return ingredientId
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return 'Kitchen ingredient';
}

export function localizeIngredientName(
  ingredientId: string | null | undefined,
  rawName: string | null | undefined,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  const safeRaw = (rawName ?? '').trim();
  if (locale === 'vi') return safeRaw || (ingredientId ?? '');

  const enName = resolveEnglishIngredientName(ingredientId, safeRaw);
  if (locale === 'en') return enName;

  const pack = getLoadedLocalePack(locale);
  if (pack) {
    const idKey = (ingredientId ?? '').trim().toUpperCase();
    if (idKey && pack.ingredients[idKey]) return pack.ingredients[idKey];
    const enLower = enName.toLowerCase();
    if (pack.ingredients[enLower]) return pack.ingredients[enLower];
    if (pack.ingredients[enName]) return pack.ingredients[enName];
    if (enName === 'Kitchen ingredient') return pack.recipeCopy.fallbackIngredient;
  }
  return enName;
}

const VI_UNIT_TO_EN: Readonly<Record<string, string>> = Object.freeze({
  g: 'g',
  gram: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'L',
  lít: 'L',
  lit: 'L',
  quả: 'pcs',
  trái: 'pcs',
  cái: 'pcs',
  chiếc: 'pcs',
  con: 'pcs',
  củ: 'pcs',
  miếng: 'pcs',
  lát: 'slices',
  bó: 'bunch',
  mớ: 'bunch',
  nhánh: 'cloves',
  tép: 'cloves',
  cây: 'stalks',
  lá: 'leaves',
  gói: 'pack',
  bịch: 'pack',
  túi: 'bag',
  hộp: 'box',
  hũ: 'jar',
  lọ: 'jar',
  chai: 'bottle',
  lon: 'can',
  vỉ: 'tray',
  khay: 'tray',
  'thìa canh': 'tbsp',
  'muỗng canh': 'tbsp',
  'thìa cà phê': 'tsp',
  'muỗng cà phê': 'tsp',
  thìa: 'tbsp',
  muỗng: 'tbsp',
  bát: 'cup',
  chén: 'cup',
  cốc: 'cup',
  ly: 'cup',
  phần: 'serving',
  khẩu_phần: 'serving',
  piece: 'pcs',
  pack: 'pack',
  bunch: 'bunch',
  slice: 'slice',
  tbsp: 'tbsp',
  tsp: 'tsp',
  cup: 'cup',
  oz: 'oz',
  lb: 'lb',
});

export function localizeUnit(
  unit: string | null | undefined,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  const raw = (unit ?? '').trim();
  if (!raw || locale === 'vi') return raw;
  const lower = raw.toLowerCase();
  const enUnit = VI_UNIT_TO_EN[lower] ?? (containsVietnameseDiacritics(raw) ? 'pcs' : raw);
  if (locale === 'en') return enUnit;

  const pack = getLoadedLocalePack(locale);
  if (pack) {
    const mapped = pack.enums.unit[enUnit.toLowerCase()] ?? pack.enums.unit[lower];
    if (mapped) return mapped;
  }
  return enUnit;
}

export function formatLocalizedMeasure(
  quantity: number,
  unit: string,
  locale: SupportedLocale = getActiveAppLocale(),
  unitSystem: UnitSystem = getActiveUnitSystem(locale),
): string {
  if (!Number.isFinite(quantity)) return '';
  if (locale !== 'vi' && ['g', 'kg', 'ml', 'l', 'piece', 'pack', 'bunch', 'slice'].includes(unit)) {
    return formatDisplayQuantity(quantity, unit, unitSystem, locale).text;
  }
  const rounded = Math.round(quantity * 100) / 100;
  const unitText = localizeUnit(unit, locale);
  return unitText ? `${rounded} ${unitText}` : String(rounded);
}

// ── Recipe Content Localization ────────────────────────────────────────────

export interface LocalizableRecipeLike {
  id?: string;
  slug?: string;
  title: string;
  description?: string;
  cuisine?: string;
  category?: string | null;
  cookTimeMinutes?: number;
  servings?: number;
  ingredients?: ReadonlyArray<{
    ingredientId?: string;
    name: string;
    quantity?: number;
    unit?: string;
  }>;
  steps?: ReadonlyArray<{
    stepNumber?: number;
    instruction: string;
    timerMinutes?: number;
  }>;
}

/**
 * Strips any parenthetical (including nested parentheses) containing Vietnamese diacritics
 * and repairs any unmatched stray parentheses left behind.
 */
function stripVietnameseParen(text: string): string {
  let out = text;
  // Iteratively strip innermost parentheticals containing Vietnamese diacritics first
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(
      /\s*\([^()]*[ăđơưĂĐƠƯảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ][^()]*\)/gu,
      '',
    );
  }
  out = out.replace(
    /\s*[—–-]\s*[^—–-]*[ăđơưĂĐƠƯảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ].*$/gu,
    '',
  );
  // Balance/clean any unmatched trailing/leading stray parens
  let depth = 0;
  let balanced = '';
  for (const ch of out) {
    if (ch === '(') {
      depth += 1;
      balanced += ch;
    } else if (ch === ')') {
      if (depth > 0) {
        depth -= 1;
        balanced += ch;
      }
    } else {
      balanced += ch;
    }
  }
  while (depth > 0) {
    const idx = balanced.lastIndexOf('(');
    if (idx === -1) break;
    balanced = balanced.slice(0, idx) + balanced.slice(idx + 1);
    depth -= 1;
  }
  return balanced.replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
}

export function localizeRecipeTitle(
  recipe: Pick<
    LocalizableRecipeLike,
    'slug' | 'title' | 'description' | 'cuisine' | 'category' | 'cookTimeMinutes' | 'servings' | 'ingredients'
  >,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  if (locale === 'vi') return recipe.title;

  const resolvedSlug = resolveRecipeSlug({ slug: recipe.slug, title: recipe.title });

  // 1. Check loaded non-EN native locale pack first (`ja`, `ko`, `th`, `zh`, `it`)
  if (locale !== 'en' && resolvedSlug) {
    const pack = getLoadedLocalePack(locale);
    const nativeTitle = pack?.recipeTitles[resolvedSlug];
    if (nativeTitle) return nativeTitle;
  }

  // 2. Check authoritative 500-recipe English title catalog
  const canonicalEn = getCanonicalEnglishRecipeTitle({ slug: resolvedSlug, title: recipe.title });
  if (canonicalEn) {
    if (locale === 'en') return canonicalEn;
    const pack = getLoadedLocalePack(locale);
    if (pack?.phrases[canonicalEn]) return pack.phrases[canonicalEn];
    return canonicalEn;
  }

  // 3. Preserve already-clean non-Vietnamese custom/user titles
  if (recipe.title && !containsVietnameseDiacritics(recipe.title)) {
    return stripVietnameseParen(recipe.title);
  }

  // 4. Deterministic fallback synthesis (never leaks Vietnamese or unmatched parens)
  const meta = synthesizeEnglishRecipeMeta({
    slug: resolvedSlug ?? '',
    titleVi: recipe.title,
    descriptionVi: recipe.description ?? '',
    cuisine: recipe.cuisine ?? 'vietnamese',
    category: recipe.category ?? null,
    cookTimeMinutes: recipe.cookTimeMinutes ?? 20,
    servings: recipe.servings ?? 2,
    ingredients: (recipe.ingredients ?? []).map((ing) => ({
      ingredientId: ing.ingredientId ?? '',
      nameVi: ing.name,
      quantity: ing.quantity ?? 1,
      unit: ing.unit ?? 'g',
    })),
  });
  const cleaned = stripVietnameseParen(meta.titleEn);
  if (cleaned && !containsVietnameseDiacritics(cleaned)) return cleaned;
  const pack = getLoadedLocalePack(locale);
  return pack?.recipeCopy.fallbackTitle ?? 'Home-Cooked Dish';
}

export function localizeRecipeDescription(
  recipe: Pick<
    LocalizableRecipeLike,
    'slug' | 'title' | 'description' | 'cuisine' | 'category' | 'cookTimeMinutes' | 'servings' | 'ingredients'
  >,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  const raw = recipe.description ?? '';
  if (locale === 'vi') return raw;

  const pack = getLoadedLocalePack(locale);
  if (pack && locale !== 'en') {
    const cuisineLabel = localizeCuisine(recipe.cuisine ?? 'vietnamese', locale);
    const primary = (recipe.ingredients ?? [])
      .slice(0, 3)
      .map((ing) => localizeIngredientName(ing.ingredientId, ing.name, locale))
      .filter(Boolean);
    const summary = primary.length > 0 ? primary.join(', ') : pack.recipeCopy.fallbackIngredient;
    return pack.recipeCopy.description(
      cuisineLabel,
      summary,
      recipe.cookTimeMinutes ?? 20,
      recipe.servings ?? 2,
    );
  }

  if (raw && !containsVietnameseDiacritics(raw)) return raw;

  const meta = synthesizeEnglishRecipeMeta({
    slug: resolveRecipeSlug({ slug: recipe.slug, title: recipe.title }) ?? '',
    titleVi: recipe.title,
    descriptionVi: raw,
    cuisine: recipe.cuisine ?? 'vietnamese',
    category: recipe.category ?? null,
    cookTimeMinutes: recipe.cookTimeMinutes ?? 20,
    servings: recipe.servings ?? 2,
    ingredients: (recipe.ingredients ?? []).map((ing) => ({
      ingredientId: ing.ingredientId ?? '',
      nameVi: ing.name,
      quantity: ing.quantity ?? 1,
      unit: ing.unit ?? 'g',
    })),
  });
  const cleaned = stripVietnameseParen(meta.descriptionEn);
  return cleaned && !containsVietnameseDiacritics(cleaned)
    ? cleaned
    : 'Balanced home-cooked recipe with deterministic portion scaling.';
}

export function localizeRecipeSteps(
  recipe: Pick<LocalizableRecipeLike, 'steps' | 'ingredients' | 'cookTimeMinutes'>,
  locale: SupportedLocale = getActiveAppLocale(),
  unitSystem: UnitSystem = getActiveUnitSystem(locale),
): Array<{ stepNumber: number; instruction: string; timerMinutes?: number }> {
  const steps = recipe.steps ?? [];
  if (locale === 'vi') {
    return steps.map((st, idx) => ({
      stepNumber: st.stepNumber ?? idx + 1,
      instruction: st.instruction,
      ...(st.timerMinutes ? { timerMinutes: st.timerMinutes } : {}),
    }));
  }

  const pack = getLoadedLocalePack(locale);
  const localizedIngredients = (recipe.ingredients ?? []).map((ing) =>
    localizeIngredientName(ing.ingredientId, ing.name, locale),
  );

  if (pack && locale !== 'en') {
    const lead = localizedIngredients.slice(0, 4).join(', ') || pack.recipeCopy.fallbackIngredient;
    const totalMins = recipe.cookTimeMinutes ?? 20;
    return steps.map((st, idx) => {
      const timerHint = st.timerMinutes ? pack.recipeCopy.timerHint(st.timerMinutes) : '';
      let instruction: string;
      if (idx === 0) {
        instruction = pack.recipeCopy.prep(lead, timerHint);
      } else if (idx === steps.length - 1) {
        instruction = pack.recipeCopy.finish(timerHint);
      } else if (st.timerMinutes && st.timerMinutes >= 8) {
        instruction = pack.recipeCopy.simmer(st.timerMinutes);
      } else if (st.timerMinutes) {
        instruction = pack.recipeCopy.stirFry(st.timerMinutes);
      } else {
        instruction = pack.recipeCopy.combine(totalMins);
      }
      return {
        stepNumber: st.stepNumber ?? idx + 1,
        instruction: convertStepTemperatures(instruction, unitSystem),
        ...(st.timerMinutes ? { timerMinutes: st.timerMinutes } : {}),
      };
    });
  }

  const synthesized = synthesizeEnglishSteps({
    steps: steps.map((st, idx) => ({
      stepNumber: st.stepNumber ?? idx + 1,
      instruction: st.instruction,
      timerMinutes: st.timerMinutes,
    })),
    ingredientsEn: localizedIngredients,
    cookTimeMinutes: recipe.cookTimeMinutes ?? 20,
  });

  return synthesized.map((st, idx) => {
    const raw = steps[idx]?.instruction ?? '';
    const baseText = raw && !containsVietnameseDiacritics(raw) ? raw : st.instructionEn;
    return {
      stepNumber: st.stepNumber,
      instruction: convertStepTemperatures(baseText, unitSystem),
      ...(st.timerMinutes ? { timerMinutes: st.timerMinutes } : {}),
    };
  });
}

// ── Domain Enums & Status Labels ───────────────────────────────────────────

export function localizeStorageZone(
  zone: string | null | undefined,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  const key = (zone ?? 'fridge').toLowerCase();
  if (locale === 'vi') {
    if (key === 'freezer') return 'Ngăn đông';
    if (key === 'pantry') return 'Tủ khô';
    if (key === 'veg_crisper') return 'Ngăn rau củ';
    if (key === 'chilled') return 'Ngăn đông mềm';
    return 'Ngăn mát';
  }
  const pack = getLoadedLocalePack(locale);
  if (pack?.enums.storageZone[key]) return pack.enums.storageZone[key];
  if (key === 'freezer') return 'Freezer';
  if (key === 'pantry') return 'Pantry';
  if (key === 'veg_crisper') return 'Crisper';
  if (key === 'chilled') return 'Chilled';
  return 'Fridge';
}

export function localizeFreshnessStatus(
  status: string | null | undefined,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  const key = (status ?? 'fresh').toLowerCase();
  if (locale === 'vi') {
    if (key === 'expired') return 'Đã hết hạn';
    if (key === 'expiring_soon') return 'Sắp hết hạn';
    return 'Còn tươi';
  }
  const pack = getLoadedLocalePack(locale);
  if (pack?.enums.freshness[key]) return pack.enums.freshness[key];
  if (key === 'expired') return 'Expired';
  if (key === 'expiring_soon') return 'Expiring soon';
  return 'Fresh';
}

export function localizeCuisine(
  cuisine: string | null | undefined,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  const key = (cuisine ?? '').toLowerCase();
  if (locale === 'vi') {
    const map: Record<string, string> = {
      vietnamese: 'Món Việt',
      japanese: 'Món Nhật',
      korean: 'Món Hàn',
      chinese: 'Món Hoa',
      thai: 'Món Thái',
      italian: 'Món Ý',
      all: 'Tất cả',
    };
    return map[key] ?? cuisine ?? 'Món Việt';
  }
  const pack = getLoadedLocalePack(locale);
  if (pack?.enums.cuisine[key]) return pack.enums.cuisine[key];
  const map: Record<string, string> = {
    vietnamese: 'Vietnamese',
    japanese: 'Japanese',
    korean: 'Korean',
    chinese: 'Chinese',
    thai: 'Thai',
    italian: 'Italian',
    all: 'All cuisines',
  };
  return map[key] ?? (cuisine && !containsVietnameseDiacritics(cuisine) ? cuisine : 'Homestyle');
}

export function localizeRecipeCategory(
  category: string | null | undefined,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  const key = (category ?? '').toLowerCase();
  if (locale === 'vi') {
    const map: Record<string, string> = {
      mon_canh: 'Món canh',
      mon_kho: 'Món kho',
      mon_xao: 'Món xào',
      mon_chien: 'Món chiên',
      mon_hap_luoc: 'Hấp & luộc',
      mon_cuon_nom: 'Cuốn & nộm',
      mon_bun_pho: 'Bún & phở',
      mon_chay: 'Món chay',
      mon_nhanh_sang: 'Bữa sáng & nhanh',
      mon_lau_tiec: 'Lẩu & tiệc',
      all: 'Tất cả',
    };
    return map[key] ?? category ?? '';
  }
  const pack = getLoadedLocalePack(locale);
  if (pack?.enums.category[key]) return pack.enums.category[key];
  const map: Record<string, string> = {
    mon_canh: 'Soup',
    mon_kho: 'Braised',
    mon_xao: 'Stir-fry',
    mon_chien: 'Pan-fried',
    mon_hap_luoc: 'Steamed & Boiled',
    mon_cuon_nom: 'Salads & Rolls',
    mon_bun_pho: 'Noodles',
    mon_chay: 'Vegetarian',
    mon_nhanh_sang: 'Quick & Breakfast',
    mon_lau_tiec: 'Hotpot & Sharing',
    all: 'All',
  };
  return map[key] ?? '';
}

export function localizeDifficulty(
  difficulty: string | null | undefined,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  const key = (difficulty ?? 'easy').toLowerCase();
  if (locale === 'vi') {
    if (key === 'hard') return 'Khó';
    if (key === 'medium') return 'Trung bình';
    return 'Dễ';
  }
  const pack = getLoadedLocalePack(locale);
  if (pack?.enums.difficulty[key]) return pack.enums.difficulty[key];
  if (key === 'hard') return 'Advanced';
  if (key === 'medium') return 'Medium';
  return 'Easy';
}

export function localizeMealSlot(
  slot: string | null | undefined,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  const key = (slot ?? '').toLowerCase();
  if (locale === 'vi') {
    if (key === 'breakfast') return 'Bữa sáng';
    if (key === 'lunch') return 'Bữa trưa';
    if (key === 'dinner') return 'Bữa tối';
    if (key === 'snack') return 'Bữa phụ';
    return slot ?? '';
  }
  const pack = getLoadedLocalePack(locale);
  if (pack?.enums.mealSlot[key]) return pack.enums.mealSlot[key];
  if (key === 'breakfast') return 'Breakfast';
  if (key === 'lunch') return 'Lunch';
  if (key === 'dinner') return 'Dinner';
  if (key === 'snack') return 'Snack';
  return 'Meal';
}

export function localizeDisplayCategory(
  category: string | null | undefined,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  const key = (category ?? 'other').toLowerCase();
  if (locale === 'vi') {
    const map: Record<string, string> = {
      produce: 'Rau củ & trái cây',
      vegetable: 'Rau củ',
      vegetables: 'Rau củ',
      fruit: 'Trái cây',
      meat_seafood: 'Thịt & hải sản',
      meat: 'Thịt',
      seafood: 'Hải sản',
      dairy_eggs: 'Trứng & sữa',
      egg: 'Trứng',
      dairy: 'Sữa & phô mai',
      grain: 'Tinh bột & ngũ cốc',
      pantry: 'Đồ khô & dự trữ',
      condiments: 'Gia vị & nước sốt',
      spice: 'Gia vị',
      beverages: 'Đồ uống',
      frozen: 'Đồ đông lạnh',
      other: 'Khác',
    };
    return map[key] ?? 'Khác';
  }
  const pack = getLoadedLocalePack(locale);
  if (pack?.enums.displayCategory[key]) return pack.enums.displayCategory[key];
  const map: Record<string, string> = {
    produce: 'Produce',
    vegetable: 'Vegetables',
    vegetables: 'Vegetables',
    fruit: 'Fruit',
    meat_seafood: 'Meat & Seafood',
    meat: 'Meat',
    seafood: 'Seafood',
    dairy_eggs: 'Dairy & Eggs',
    egg: 'Eggs',
    dairy: 'Dairy & Cheese',
    grain: 'Grains & Noodles',
    pantry: 'Pantry & Dry Goods',
    condiments: 'Sauces & Spices',
    spice: 'Spices',
    beverages: 'Beverages',
    frozen: 'Frozen',
    other: 'Other',
  };
  return map[key] ?? 'Other';
}

/**
 * Ensures user-visible error strings never leak Vietnamese messages into non-Vietnamese locales,
 * and translates fallback errors into the active pack locale (`ja`, `ko`, `th`, `zh`, `it`).
 */
export function localizeErrorText(
  err: unknown,
  fallbackEn = 'Something went wrong. Please try again.',
  fallbackVi = 'Đã có lỗi xảy ra. Vui lòng thử lại.',
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (locale === 'vi') {
    return raw || fallbackVi;
  }
  const localizedFallback = translateEnForLocale(fallbackEn, locale);
  if (!raw || containsVietnameseDiacritics(raw) || raw.startsWith('HTTP ')) {
    const pack = getLoadedLocalePack(locale);
    return localizedFallback !== fallbackEn ? localizedFallback : (pack?.recipeCopy.fallbackError ?? fallbackEn);
  }
  return translateEnForLocale(raw, locale);
}
