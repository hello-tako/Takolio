import { useCallback } from 'react';
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
import type { SupportedLocale, UnitSystem } from '../../shared/locales';
import { getActiveAppLocale, getActiveUnitSystem, useAppLocale } from './LocaleContext';

const VIETNAMESE_DIACRITIC_RE =
  /[ăđơưĂĐƠƯảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/u;

export function containsVietnameseDiacritics(text: string): boolean {
  return VIETNAMESE_DIACRITIC_RE.test(text);
}

/**
 * Synchronous locale picker for non-React utilities, services, and stores.
 */
export function lSync(vi: string, en: string, locale: SupportedLocale = getActiveAppLocale()): string {
  return locale === 'vi' ? vi : en;
}

export function isViLocale(locale: SupportedLocale = getActiveAppLocale()): boolean {
  return locale === 'vi';
}

/**
 * Primary React hook for full consumer app localization.
 * - Preserves exact Vietnamese copy when `locale === 'vi'`.
 * - Delivers clean International English across all non-Vietnamese locales (`en`, `ja`, `ko`, `th`, `zh`, `it`)
 *   so international users NEVER experience Vietnamese/English mixed screens.
 */
export function useLocaleText() {
  const ctx = useAppLocale();
  const effectiveLocale = ctx.isProvided ? ctx.locale : getActiveAppLocale();
  const effectiveUnitSystem = ctx.isProvided ? ctx.unitSystem : getActiveUnitSystem(effectiveLocale);
  const isVi = effectiveLocale === 'vi';
  const l = useCallback((vi: string, en: string) => (isVi ? vi : en), [isVi]);
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

export function localizeIngredientName(
  ingredientId: string | null | undefined,
  rawName: string | null | undefined,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  const safeRaw = (rawName ?? '').trim();
  if (locale === 'vi') return safeRaw || (ingredientId ?? '');

  if (ingredientId) {
    const byId = translateIngredientNameToEn(ingredientId, '');
    if (byId && !containsVietnameseDiacritics(byId)) return byId;
  }

  const lower = safeRaw.toLowerCase();
  if (CANONICAL_VI_TO_EN[lower]) return CANONICAL_VI_TO_EN[lower];
  if (EXTRA_VI_INGREDIENT_TO_EN[lower]) return EXTRA_VI_INGREDIENT_TO_EN[lower];

  // Partial Vietnamese token translation if custom ingredient has Vietnamese words
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
  if (VI_UNIT_TO_EN[lower]) return VI_UNIT_TO_EN[lower];
  return containsVietnameseDiacritics(raw) ? 'pcs' : raw;
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

function stripVietnameseParen(text: string): string {
  return text
    .replace(/\s*\([^)]*[ăđơưĂĐƠƯảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ][^)]*\)/gu, '')
    .replace(/\s*[—–-]\s*[^—–-]*[ăđơưĂĐƠƯảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ].*$/gu, '')
    .trim();
}

export function localizeRecipeTitle(
  recipe: Pick<LocalizableRecipeLike, 'slug' | 'title' | 'description' | 'cuisine' | 'category' | 'cookTimeMinutes' | 'servings' | 'ingredients'>,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  if (locale === 'vi') return recipe.title;
  if (!containsVietnameseDiacritics(recipe.title)) return recipe.title;

  const meta = synthesizeEnglishRecipeMeta({
    slug: recipe.slug ?? '',
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
  return cleaned && !containsVietnameseDiacritics(cleaned) ? cleaned : 'Home-Cooked Dish';
}

export function localizeRecipeDescription(
  recipe: Pick<LocalizableRecipeLike, 'slug' | 'title' | 'description' | 'cuisine' | 'category' | 'cookTimeMinutes' | 'servings' | 'ingredients'>,
  locale: SupportedLocale = getActiveAppLocale(),
): string {
  const raw = recipe.description ?? '';
  if (locale === 'vi') return raw;
  if (raw && !containsVietnameseDiacritics(raw)) return raw;

  const meta = synthesizeEnglishRecipeMeta({
    slug: recipe.slug ?? '',
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

  const ingredientsEn = (recipe.ingredients ?? []).map((ing) =>
    localizeIngredientName(ing.ingredientId, ing.name, locale),
  );
  const synthesized = synthesizeEnglishSteps({
    steps: steps.map((st, idx) => ({
      stepNumber: st.stepNumber ?? idx + 1,
      instruction: st.instruction,
      timerMinutes: st.timerMinutes,
    })),
    ingredientsEn,
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
 * Ensures user-visible error strings never leak Vietnamese messages into non-Vietnamese locales.
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
  if (!raw || containsVietnameseDiacritics(raw) || raw.startsWith('HTTP ')) {
    return fallbackEn;
  }
  return raw;
}
