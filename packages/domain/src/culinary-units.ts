import type { StandardUnit } from './units';
import { CURRENCY_MINOR_DIGITS, type GlobalCurrency, type SupportedLocale } from './i18n';

/**
 * Regional Culinary & Retail Measurement System:
 * - Japan: 大さじ (15ml), 小さじ (5ml), カップ (200ml — NOT 240ml!), 合 (180ml volume / 150g raw rice), cc (1ml), 丁 (tofu ~300g).
 * - Europe: cl (10ml — FR/BE), dl (100ml — CH/AT/Nordics), EL (15ml), TL (5ml), g/kg/ml/l, EU Directive 98/6/EC reference pricing (€/kg, €/100g, €/L).
 * - US/UK Imperial fallback: cup_us (240ml), cup_metric (250ml), fl_oz (29.5735ml), oz (28.3495g), lb (453.59237g).
 */
export const CULINARY_UNITS = [
  'mg',
  'g',
  'kg',
  'oz',
  'lb',
  'ml',
  'cc',
  'cl',
  'dl',
  'l',
  'tsp',
  'tbsp',
  'cup_jp',
  'cup_us',
  'cup_metric',
  'go',
  'fl_oz',
  'piece',
  'pack',
  'bunch',
  'slice',
] as const;

export type CulinaryUnit = (typeof CULINARY_UNITS)[number];

interface PhysicalCulinarySpec {
  readonly dimension: 'mass' | 'volume' | 'contextual';
  /** Multiplier to base unit (`g` for mass, `ml` for volume, `1` for contextual). */
  readonly toBaseFactor: number;
}

export const CULINARY_UNIT_SPECS: Readonly<Record<CulinaryUnit, PhysicalCulinarySpec>> = Object.freeze({
  mg: { dimension: 'mass', toBaseFactor: 0.001 },
  g: { dimension: 'mass', toBaseFactor: 1 },
  kg: { dimension: 'mass', toBaseFactor: 1000 },
  oz: { dimension: 'mass', toBaseFactor: 28.349523125 },
  lb: { dimension: 'mass', toBaseFactor: 453.59237 },
  ml: { dimension: 'volume', toBaseFactor: 1 },
  cc: { dimension: 'volume', toBaseFactor: 1 },
  cl: { dimension: 'volume', toBaseFactor: 10 },
  dl: { dimension: 'volume', toBaseFactor: 100 },
  l: { dimension: 'volume', toBaseFactor: 1000 },
  tsp: { dimension: 'volume', toBaseFactor: 5 },
  tbsp: { dimension: 'volume', toBaseFactor: 15 },
  cup_jp: { dimension: 'volume', toBaseFactor: 200 },
  cup_us: { dimension: 'volume', toBaseFactor: 240 },
  cup_metric: { dimension: 'volume', toBaseFactor: 250 },
  go: { dimension: 'volume', toBaseFactor: 180 },
  fl_oz: { dimension: 'volume', toBaseFactor: 29.5735295625 },
  piece: { dimension: 'contextual', toBaseFactor: 1 },
  pack: { dimension: 'contextual', toBaseFactor: 1 },
  bunch: { dimension: 'contextual', toBaseFactor: 1 },
  slice: { dimension: 'contextual', toBaseFactor: 1 },
});

/**
 * Standard retail piece / pack / bunch / slice net mass in grams for culinary planning,
 * nutrition scaling, and Week cost estimation.
 * Note: T02 `availability.ts` keeps strict lot-authority `context_required` when package
 * weights are unverified on inventory lots; this table powers culinary conversion,
 * recipe scaling, and price estimation where explicit standard equivalents are needed.
 */
export const INGREDIENT_STANDARD_EQUIVALENTS_GRAMS: Readonly<
  Record<string, Partial<Record<'piece' | 'pack' | 'bunch' | 'slice', number>> & { densityGPerMl?: number }>
> = Object.freeze({
  TOFU: { piece: 300, pack: 300 }, // 1丁 = ~300g
  NATTO: { pack: 45 }, // 1パック = 45g
  BEAN_SPROUTS: { pack: 200 }, // もやし 1袋 = 200g
  UDON_WHEAT: { pack: 200 }, // ゆでうどん 1玉 = 200g
  SOBA_BUCKWHEAT: { pack: 200 },
  SPAGHETTI_PASTA: { pack: 500 }, // Standard 500g retail pack
  NOODLE: { pack: 400 },
  RICE_PAPER: { pack: 200 },
  RICE: { pack: 2000, densityGPerMl: 150 / 180 }, // 1合 (180ml) = 150g raw Japanese/short-grain rice!
  CHICKEN_EGG: { piece: 55 },
  CHEDDAR_CHEESE: { slice: 20, pack: 200 },
  BREAD: { slice: 35, pack: 400 }, // 6-slice 食パン ~60g, EU slice ~35g
  BUTTER: { pack: 200, densityGPerMl: 0.911 },
  FRESH_MILK: { pack: 1000, densityGPerMl: 1.03 },
  YOGURT: { pack: 400, densityGPerMl: 1.04 },
  CREAM: { pack: 200, densityGPerMl: 0.99 },
  TOMATO: { piece: 150 },
  ONION: { piece: 180 },
  CARROT: { piece: 120 },
  POTATO: { piece: 150 },
  CUCUMBER: { piece: 120 },
  BELL_PEPPER: { piece: 130 },
  ZUCCHINI: { piece: 200 },
  BROCCOLI: { piece: 300 },
  CABBAGE: { piece: 1000 },
  GARLIC: { piece: 5 }, // 1 clove (かけ / Zehe / gousse) = 5g
  GINGER: { piece: 25 },
  CHILI: { piece: 5 },
  LIME: { piece: 50 },
  LEMONGRASS: { piece: 20 },
  SCALLION: { bunch: 100, piece: 15 },
  WATER_SPINACH: { bunch: 300 },
  SPINACH: { bunch: 200, pack: 200 }, // ほうれん草 1束 = 200g
  CELERY: { piece: 60, bunch: 400 },
  MUSHROOM: { pack: 100 }, // しめじ / えのき 1株 = 100g
  PUMPKIN: { piece: 800 },
  WINTER_MELON: { piece: 600 },
  BITTER_MELON: { piece: 200 },
  CHAYOTE: { piece: 250 },
  PINEAPPLE: { piece: 900 },
  SOY_SAUCE: { densityGPerMl: 1.18 },
  FISH_SAUCE: { densityGPerMl: 1.2 },
  MISO: { pack: 750, densityGPerMl: 1.2 }, // 大さじ1 味噌 = 18g!
  MIRIN: { densityGPerMl: 1.15 },
  COOKING_OIL: { densityGPerMl: 0.92 },
  OLIVE_OIL: { densityGPerMl: 0.916 },
  SESAME_OIL: { densityGPerMl: 0.92 },
  SUGAR: { densityGPerMl: 0.6 }, // 大さじ1 砂糖 = 9g (9g / 15ml = 0.6)
});

/**
 * Parses localized cooking/OCR unit tokens into canonical `CulinaryUnit`.
 * Crucially distinguishes Japanese `カップ` (`cup_jp` = 200ml) and `合` (`go` = 180ml)
 * from US `cup` (`cup_us` = 240ml) and European `cl` (10ml) / `dl` (100ml).
 */
export function parseLocalizedCulinaryUnit(
  rawUnit: string,
  options?: { locale?: SupportedLocale | string },
): CulinaryUnit | null {
  const trimmed = rawUnit.trim();
  if (!trimmed) return null;

  // Case-sensitive German/European spoon abbreviations before lowercasing if needed
  if (trimmed === 'EL' || trimmed === 'Esslöffel') return 'tbsp';
  if (trimmed === 'TL' || trimmed === 'Teelöffel') return 'tsp';

  const lower = trimmed.normalize('NFKC').toLowerCase();
  const locale = options?.locale?.toLowerCase() ?? 'en';

  if (lower === 'mg') return 'mg';
  if (lower === 'g' || lower === 'gr' || lower === 'gram' || lower === 'gramm' || lower === 'グラム') return 'g';
  if (lower === 'kg' || lower === 'kilo' || lower === 'kilogram' || lower === 'ký' || lower === 'kí' || lower === 'キロ') return 'kg';
  if (lower === 'oz' || lower === 'ounce' || lower === 'ounces') return 'oz';
  if (lower === 'lb' || lower === 'lbs' || lower === 'pound' || lower === 'pounds') return 'lb';

  if (lower === 'ml' || lower === 'ミリリットル') return 'ml';
  if (lower === 'cc' || lower === 'シーシー') return 'cc';
  if (lower === 'cl' || lower === 'centilitre' || lower === 'centiliter') return 'cl';
  if (lower === 'dl' || lower === 'decilitre' || lower === 'deciliter' || lower === 'deziliter') return 'dl';
  if (lower === 'l' || lower === 'liter' || lower === 'litre' || lower === 'lít' || lower === 'リットル') return 'l';
  if (lower === 'fl oz' || lower === 'fl_oz') return 'fl_oz';

  if (lower === 'tsp' || lower === 'teaspoon' || lower === '小さじ' || lower === 'thìa cà phê' || lower === 'muỗng cà phê' || lower === 'cuillère à café' || lower === 'cac' || lower === 'c.à.c') {
    return 'tsp';
  }
  if (lower === 'tbsp' || lower === 'tablespoon' || lower === '大さじ' || lower === 'thìa canh' || lower === 'muỗng canh' || lower === 'cuillère à soupe' || lower === 'cas' || lower === 'c.à.s') {
    return 'tbsp';
  }
  if (lower === '合' || lower === 'go' || lower === 'gou') return 'go';
  if (lower === 'cup_jp' || lower === '計量カップ') return 'cup_jp';
  if (lower === 'cup_us') return 'cup_us';
  if (lower === 'cup_metric') return 'cup_metric';
  if (lower === 'カップ' || lower === 'cup' || lower === 'cups' || lower === 'tasse') {
    return locale.startsWith('ja') ? 'cup_jp' : 'cup_us';
  }

  if (
    lower === 'piece' || lower === 'pcs' || lower === 'pc' || lower === 'stk' || lower === 'stück' ||
    lower === 'pièce' || lower === 'unidad' || lower === 'pezzo' || lower === 'stuks' || lower === 'szt' ||
    lower === 'quả' || lower === 'trái' || lower === 'củ' || lower === 'cái' ||
    lower === '個' || lower === '本' || lower === '玉' || lower === '尾' || lower === '枚'
  ) {
    return 'piece';
  }
  if (
    lower === 'pack' || lower === 'pkt' || lower === 'packung' || lower === 'paquet' || lower === 'envase' ||
    lower === 'confezione' || lower === 'gói' || lower === 'hộp' || lower === 'túi' || lower === 'bìa' ||
    lower === 'パック' || lower === '袋' || lower === '丁' || lower === '株' || lower === '箱'
  ) {
    return 'pack';
  }
  if (
    lower === 'bunch' || lower === 'bund' || lower === 'botte' || lower === 'manojo' || lower === 'mazzo' ||
    lower === 'bó' || lower === 'mớ' || lower === '束' || lower === '把'
  ) {
    return 'bunch';
  }
  if (lower === 'slice' || lower === 'slices' || lower === 'scheibe' || lower === 'tranche' || lower === 'lát' || lower === '切れ') {
    return 'slice';
  }
  return null;
}

/** Converts a culinary unit to Frigo's 8 closed `StandardUnit` storage units (`g`, `kg`, `ml`, `l`, `piece`, `pack`, `bunch`, `slice`). */
export function normalizeToStandardUnit(
  quantity: number,
  unit: CulinaryUnit,
  ingredientId?: string | null,
): { quantity: number; unit: StandardUnit } {
  // Special case: Japanese rice `合` (`go`) -> `150g` raw rice when ingredient is `RICE`!
  if (unit === 'go' && ingredientId?.trim().toUpperCase() === 'RICE') {
    return { quantity: Number((quantity * 150).toFixed(3)), unit: 'g' };
  }
  const spec = CULINARY_UNIT_SPECS[unit];
  if (spec.dimension === 'mass') {
    if (unit === 'kg') return { quantity, unit: 'kg' };
    return { quantity: Number((quantity * spec.toBaseFactor).toFixed(3)), unit: 'g' };
  }
  if (spec.dimension === 'volume') {
    if (unit === 'l') return { quantity, unit: 'l' };
    return { quantity: Number((quantity * spec.toBaseFactor).toFixed(3)), unit: 'ml' };
  }
  return { quantity, unit: unit as StandardUnit };
}

/**
 * Converts between any two `CulinaryUnit`s, using exact physical factors when dimensions match,
 * or ingredient-specific standard equivalents / densities (`INGREDIENT_STANDARD_EQUIVALENTS_GRAMS`)
 * when converting between mass, volume, and standard retail packs/pieces (e.g. `1丁 TOFU` <-> `300g`,
 * `1合 RICE` <-> `150g`, `1 tbsp MISO` <-> `18g`, `180g SPAGHETTI_PASTA` <-> `0.36 pack`).
 */
export function convertCulinaryQuantity(
  quantity: number,
  fromUnit: CulinaryUnit,
  toUnit: CulinaryUnit,
  ingredientId?: string | null,
): number | null {
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  if (fromUnit === toUnit) return quantity;

  const fromSpec = CULINARY_UNIT_SPECS[fromUnit];
  const toSpec = CULINARY_UNIT_SPECS[toUnit];
  const cleanId = ingredientId?.trim().toUpperCase() ?? '';
  const equiv = cleanId ? INGREDIENT_STANDARD_EQUIVALENTS_GRAMS[cleanId] : undefined;

  // Same physical dimension (mass <-> mass, volume <-> volume)
  if (fromSpec.dimension !== 'contextual' && fromSpec.dimension === toSpec.dimension) {
    return (quantity * fromSpec.toBaseFactor) / toSpec.toBaseFactor;
  }

  // Convert `fromUnit` -> grams first via equivalents or density
  let grams: number | null = null;
  if (fromSpec.dimension === 'mass') {
    grams = quantity * fromSpec.toBaseFactor;
  } else if (fromSpec.dimension === 'volume') {
    const ml = quantity * fromSpec.toBaseFactor;
    if (equiv?.densityGPerMl) grams = ml * equiv.densityGPerMl;
  } else if (equiv) {
    const unitMass = equiv[fromUnit as 'piece' | 'pack' | 'bunch' | 'slice'];
    if (unitMass !== undefined) grams = quantity * unitMass;
  }

  if (grams === null) return null;

  // Convert grams -> `toUnit`
  if (toSpec.dimension === 'mass') {
    return grams / toSpec.toBaseFactor;
  }
  if (toSpec.dimension === 'volume') {
    if (!equiv?.densityGPerMl) return null;
    const ml = grams / equiv.densityGPerMl;
    return ml / toSpec.toBaseFactor;
  }
  if (equiv) {
    const targetMass = equiv[toUnit as 'piece' | 'pack' | 'bunch' | 'slice'];
    if (targetMass !== undefined && targetMass > 0) return grams / targetMass;
  }
  return null;
}

export interface ReferenceUnitPrice {
  readonly currency: GlobalCurrency;
  readonly referenceAmountMinor: number;
  readonly minorDigits: 0 | 2;
  readonly referenceBasis: '1kg' | '100g' | '1l' | '100ml' | '1piece';
}

/**
 * Computes EU Directive 98/6/EC (`Grundpreis` `€/kg`, `€/100g`, `€/L`) and Japanese
 * supermarket (`¥/100g`) reference unit prices for transparent cross-pack comparison.
 */
export function computeReferenceUnitPrice(input: {
  priceAmountMinor: number;
  currency: GlobalCurrency;
  netQuantity: number;
  netUnit: CulinaryUnit;
  basis?: 'per_kg_or_l' | 'per_100g_or_100ml';
}): ReferenceUnitPrice | null {
  if (!Number.isFinite(input.priceAmountMinor) || input.priceAmountMinor < 0) return null;
  if (!Number.isFinite(input.netQuantity) || input.netQuantity <= 0) return null;

  const minorDigits = CURRENCY_MINOR_DIGITS[input.currency];
  const spec = CULINARY_UNIT_SPECS[input.netUnit];
  const basisMode = input.basis ?? (input.currency === 'JPY' ? 'per_100g_or_100ml' : 'per_kg_or_l');

  if (spec.dimension === 'mass') {
    const grams = input.netQuantity * spec.toBaseFactor;
    const refGrams = basisMode === 'per_100g_or_100ml' ? 100 : 1000;
    return {
      currency: input.currency,
      referenceAmountMinor: Math.round((input.priceAmountMinor * refGrams) / grams),
      minorDigits,
      referenceBasis: basisMode === 'per_100g_or_100ml' ? '100g' : '1kg',
    };
  }
  if (spec.dimension === 'volume') {
    const ml = input.netQuantity * spec.toBaseFactor;
    const refMl = basisMode === 'per_100g_or_100ml' ? 100 : 1000;
    return {
      currency: input.currency,
      referenceAmountMinor: Math.round((input.priceAmountMinor * refMl) / ml),
      minorDigits,
      referenceBasis: basisMode === 'per_100g_or_100ml' ? '100ml' : '1l',
    };
  }
  if (input.netUnit === 'piece') {
    return {
      currency: input.currency,
      referenceAmountMinor: Math.round(input.priceAmountMinor / input.netQuantity),
      minorDigits,
      referenceBasis: '1piece',
    };
  }
  return null;
}

/** Japan MEXT & EU 1169/2011 salt-equivalent formula: `食塩相当量 (g) = Na (mg) × 2.54 / 1000`. */
export function sodiumMgToSaltGrams(sodiumMg: number): number {
  return Number(((sodiumMg * 2.54) / 1000).toFixed(3));
}

export function saltGramsToSodiumMg(saltGrams: number): number {
  return Number(((saltGrams * 1000) / 2.54).toFixed(1));
}

/** EU Regulation 1169/2011 energy conversion: `1 kcal = 4.184 kJ`. */
export function kcalToKj(energyKcal: number): number {
  return Math.round(energyKcal * 4.184);
}
