import type { IngredientCategory, StandardUnit } from './index';
import { normalizeIngredientText } from './index';

export type CulinaryExtraUnit =
  | 'tbsp'
  | 'tsp'
  | 'cup'
  | 'bowl'
  | 'clove'
  | 'bulb'
  | 'stalk'
  | 'sprig'
  | 'pinch'
  | 'fruit'
  | 'sheet';

export type CulinaryUnit = StandardUnit | CulinaryExtraUnit;

export type AllergenGroupV4 =
  | 'shellfish'
  | 'seafood'
  | 'peanut'
  | 'tree_nut'
  | 'egg'
  | 'dairy'
  | 'soy'
  | 'wheat_gluten'
  | 'sesame';

export type IngredientParentFamily =
  | 'pork'
  | 'beef'
  | 'poultry'
  | 'fish'
  | 'shellfish_crustacean'
  | 'mollusk'
  | 'egg'
  | 'dairy'
  | 'soy_tofu'
  | 'leafy_green'
  | 'gourd_melon'
  | 'root_tuber'
  | 'fruiting_veg'
  | 'cruciferous'
  | 'legume_sprout'
  | 'mushroom'
  | 'allium_aromatic'
  | 'fresh_herb'
  | 'condiment_sauce'
  | 'dry_spice_seasoning'
  | 'cooking_fat'
  | 'rice_grain'
  | 'noodle_wrapper'
  | 'nut_seed'
  | 'fruit'
  | 'other';

export type AnimalOriginV4 =
  | 'none'
  | 'pork'
  | 'beef'
  | 'poultry'
  | 'seafood'
  | 'egg'
  | 'dairy'
  | 'honey';

export interface IngredientUnitBridgeV4 {
  gramsPerPiece?: number;
  gramsPerFruit?: number;
  gramsPerPack?: number;
  gramsPerBunch?: number;
  gramsPerSlice?: number;
  gramsPerClove?: number;
  gramsPerBulb?: number;
  gramsPerStalk?: number;
  gramsPerSprig?: number;
  gramsPerSheet?: number;
  gramsPerPinch?: number;
  gramsPerTbsp?: number;
  gramsPerTsp?: number;
  gramsPerCup?: number;
  gramsPerBowl?: number;
  mlPerTbsp?: number;
  mlPerTsp?: number;
  mlPerCup?: number;
  mlPerBowl?: number;
  mlPerPiece?: number;
  densityGPerMl?: number;
}

export interface IngredientMacrosPer100g {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
}

export interface CulinaryIngredientProfileV4 {
  id: string;
  legacyCanonicalId?: string;
  nameVi: string;
  nameEn: string;
  aliases: readonly string[];
  category: IngredientCategory;
  parentFamily: IngredientParentFamily;
  defaultStorageUnit: StandardUnit;
  preferredCulinaryUnit?: CulinaryUnit;
  pieceLabelVi?: string;
  isPantryStaple: boolean;
  allergens: readonly AllergenGroupV4[];
  animalOrigin: AnimalOriginV4;
  unitBridge: IngredientUnitBridgeV4;
  macrosPer100g: IngredientMacrosPer100g;
}

export const ALL_CULINARY_UNITS: readonly CulinaryUnit[] = [
  'g',
  'kg',
  'ml',
  'l',
  'piece',
  'pack',
  'bunch',
  'slice',
  'tbsp',
  'tsp',
  'cup',
  'bowl',
  'clove',
  'bulb',
  'stalk',
  'sprig',
  'pinch',
  'fruit',
  'sheet',
] as const;

const CULINARY_UNIT_SET = new Set<string>(ALL_CULINARY_UNITS);

const DEFAULT_VOLUME_ML: Partial<Record<CulinaryUnit, number>> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
  bowl: 250,
};

const DEFAULT_MASS_G: Partial<Record<CulinaryUnit, number>> = {
  g: 1,
  kg: 1000,
};

const RAW_UNIT_ALIASES: ReadonlyArray<readonly [CulinaryUnit, readonly string[]]> = [
  ['tbsp', ['tbsp', 'tbs', 'tablespoon', 'tablespoons', 'muỗng canh', 'thìa canh', 'muỗng súp', 'thìa súp', 'mc']],
  ['tsp', ['tsp', 'teaspoon', 'teaspoons', 'muỗng cà phê', 'thìa cà phê', 'muỗng cafe', 'thìa cafe', 'muỗng nhỏ', 'thìa nhỏ', 'mcp']],
  ['cup', ['cup', 'cups', 'cốc', 'ly']],
  ['bowl', ['bowl', 'bowls', 'chén', 'bát', 'chén cơm', 'bát cơm', 'bát con']],
  ['clove', ['clove', 'cloves', 'tép', 'tép tỏi']],
  ['bulb', ['bulb', 'bulbs', 'củ']],
  ['piece', ['piece', 'pieces', 'pc', 'pcs', 'quả', 'trái', 'cái', 'con', 'khúc', 'viên', 'đùi', 'ức']],
  ['stalk', ['stalk', 'stalks', 'nhánh', 'cây', 'cọng', 'dọc', 'bẹ']],
  ['sprig', ['sprig', 'sprigs', 'ngọn', 'cành']],
  ['pinch', ['pinch', 'pinches', 'nhúm', 'chút', 'xíu', 'ít']],
  ['fruit', ['fruit', 'fruits']],
  ['sheet', ['sheet', 'sheets', 'tờ', 'lá bánh', 'bánh tráng']],
  ['pack', ['pack', 'packs', 'package', 'hộp', 'gói', 'bịch', 'túi', 'bìa', 'lon', 'chai', 'hũ']],
  ['bunch', ['bunch', 'bunches', 'bó', 'mớ', 'nắm', 'chùm']],
  ['slice', ['slice', 'slices', 'lát', 'miếng', 'khứa']],
  ['g', ['g', 'gr', 'gam', 'gram', 'grams']],
  ['kg', ['kg', 'kilo', 'kilogram', 'kilograms', 'ký', 'kí']],
  ['ml', ['ml', 'milliliter', 'millilitre', 'mililit']],
  ['l', ['l', 'lit', 'lít', 'liter', 'litre', 'liters']],
];

const NORMALIZED_UNIT_MAP: ReadonlyMap<string, CulinaryUnit> = (() => {
  const map = new Map<string, CulinaryUnit>();
  for (const [canonical, aliases] of RAW_UNIT_ALIASES) {
    map.set(canonical, canonical);
    for (const alias of aliases) {
      map.set(alias.trim().toLowerCase(), canonical);
      const folded = normalizeIngredientText(alias);
      if (folded) {
        map.set(folded, canonical);
      }
    }
  }
  return map;
})();

export function isCulinaryUnit(value: unknown): value is CulinaryUnit {
  return typeof value === 'string' && CULINARY_UNIT_SET.has(value);
}

/**
 * Normalizes Vietnamese & international culinary/storage unit labels into a canonical CulinaryUnit.
 */
export function normalizeCulinaryUnit(rawUnit: string | null | undefined): CulinaryUnit | null {
  if (typeof rawUnit !== 'string') return null;
  const trimmed = rawUnit.trim().toLowerCase();
  if (!trimmed) return null;
  const direct = NORMALIZED_UNIT_MAP.get(trimmed);
  if (direct) return direct;
  const folded = normalizeIngredientText(trimmed);
  return folded ? (NORMALIZED_UNIT_MAP.get(folded) ?? null) : null;
}

export const CORE_PANTRY_STAPLE_IDS = [
  'FISH_SAUCE',
  'SOY_SAUCE',
  'COOKING_OIL',
  'SALT',
  'SUGAR',
  'BLACK_PEPPER',
  'GARLIC',
  'SHALLOT',
  'OYSTER_SAUCE',
] as const;

function ing(
  id: string,
  nameVi: string,
  nameEn: string,
  aliases: readonly string[],
  category: IngredientCategory,
  parentFamily: IngredientParentFamily,
  defaultStorageUnit: StandardUnit,
  options: {
    legacyCanonicalId?: string;
    preferredCulinaryUnit?: CulinaryUnit;
    pieceLabelVi?: string;
    isPantryStaple?: boolean;
    allergens?: readonly AllergenGroupV4[];
    animalOrigin?: AnimalOriginV4;
    unitBridge?: IngredientUnitBridgeV4;
    macrosPer100g: IngredientMacrosPer100g;
  },
): CulinaryIngredientProfileV4 {
  return {
    id,
    legacyCanonicalId: options.legacyCanonicalId,
    nameVi,
    nameEn,
    aliases,
    category,
    parentFamily,
    defaultStorageUnit,
    preferredCulinaryUnit: options.preferredCulinaryUnit,
    pieceLabelVi: options.pieceLabelVi,
    isPantryStaple: options.isPantryStaple ?? false,
    allergens: options.allergens ?? [],
    animalOrigin: options.animalOrigin ?? 'none',
    unitBridge: options.unitBridge ?? {},
    macrosPer100g: options.macrosPer100g,
  };
}

const LIQUID_CONDIMENT_BRIDGE: IngredientUnitBridgeV4 = {
  mlPerTbsp: 15,
  mlPerTsp: 5,
  mlPerCup: 240,
  mlPerBowl: 250,
  gramsPerPack: 500,
  densityGPerMl: 1.12,
};

const LEAFY_GREEN_BRIDGE: IngredientUnitBridgeV4 = {
  gramsPerBunch: 300,
  gramsPerPack: 250,
  gramsPerBowl: 80,
  gramsPerStalk: 20,
  gramsPerSprig: 12,
};

const FRESH_HERB_BRIDGE: IngredientUnitBridgeV4 = {
  gramsPerBunch: 50,
  gramsPerStalk: 8,
  gramsPerSprig: 5,
  gramsPerTbsp: 4,
};

/**
 * 165+ Vietnamese & International Market Ingredient Taxonomy for Takolio V4.
 */
export const CULINARY_INGREDIENT_TAXONOMY_V4: readonly CulinaryIngredientProfileV4[] = [
  // ======================== 1. PANTRY STAPLES & CONDIMENTS ========================
  ing('FISH_SAUCE', 'Nước mắm', 'Fish sauce', ['nước mắm', 'mắm cá cơm', 'nước mắm ngon', 'nước mắm cốt', 'nước mắm phú quốc', 'mắm'], 'spice', 'condiment_sauce', 'ml', {
    isPantryStaple: true, preferredCulinaryUnit: 'tbsp', allergens: ['seafood'], animalOrigin: 'seafood',
    unitBridge: { ...LIQUID_CONDIMENT_BRIDGE, densityGPerMl: 1.15 }, macrosPer100g: { kcal: 35, proteinG: 5, fatG: 0, carbG: 3.6 },
  }),
  ing('SOY_SAUCE', 'Nước tương / Xì dầu', 'Soy sauce', ['xì dầu', 'nước tương', 'tương đậu nành', 'shoyu'], 'spice', 'condiment_sauce', 'ml', {
    isPantryStaple: true, preferredCulinaryUnit: 'tbsp', allergens: ['soy', 'wheat_gluten'], animalOrigin: 'none',
    unitBridge: { ...LIQUID_CONDIMENT_BRIDGE, densityGPerMl: 1.15 }, macrosPer100g: { kcal: 53, proteinG: 8, fatG: 0.1, carbG: 4.9 },
  }),
  ing('COOKING_OIL', 'Dầu ăn', 'Cooking oil', ['dầu ăn', 'dầu thực vật', 'dầu đậu nành', 'dầu hướng dương', 'dầu hạt cải', 'dầu olive', 'dầu ô liu'], 'spice', 'cooking_fat', 'ml', {
    isPantryStaple: true, preferredCulinaryUnit: 'tbsp',
    unitBridge: { mlPerTbsp: 15, mlPerTsp: 5, mlPerCup: 240, mlPerBowl: 250, densityGPerMl: 0.92 }, macrosPer100g: { kcal: 884, proteinG: 0, fatG: 100, carbG: 0 },
  }),
  ing('SALT', 'Muối ăn', 'Salt', ['muối', 'muối biển', 'muối hột', 'muối tinh', 'muối i-ốt'], 'spice', 'dry_spice_seasoning', 'g', {
    isPantryStaple: true, preferredCulinaryUnit: 'tsp',
    unitBridge: { gramsPerTbsp: 12, gramsPerTsp: 4, gramsPerPinch: 1, gramsPerPack: 500 }, macrosPer100g: { kcal: 0, proteinG: 0, fatG: 0, carbG: 0 },
  }),
  ing('SUGAR', 'Đường cát', 'Sugar', ['đường', 'đường trắng', 'đường cát', 'đường vàng', 'đường nâu', 'đường mía'], 'spice', 'dry_spice_seasoning', 'g', {
    isPantryStaple: true, preferredCulinaryUnit: 'tbsp',
    unitBridge: { gramsPerTbsp: 12, gramsPerTsp: 4, gramsPerPinch: 1.5, gramsPerCup: 200, gramsPerBowl: 210, gramsPerPack: 1000 }, macrosPer100g: { kcal: 387, proteinG: 0, fatG: 0, carbG: 100 },
  }),
  ing('BLACK_PEPPER', 'Tiêu đen', 'Black pepper', ['tiêu', 'hạt tiêu', 'tiêu xay', 'tiêu đen', 'tiêu sọ', 'tiêu bột'], 'spice', 'dry_spice_seasoning', 'g', {
    isPantryStaple: true, preferredCulinaryUnit: 'tsp',
    unitBridge: { gramsPerTbsp: 9, gramsPerTsp: 3, gramsPerPinch: 0.8, gramsPerPack: 100 }, macrosPer100g: { kcal: 251, proteinG: 10, fatG: 3.3, carbG: 64 },
  }),
  ing('GARLIC', 'Tỏi khô', 'Garlic', ['tỏi', 'tỏi ta', 'tỏi cô đơn', 'củ tỏi', 'tép tỏi', 'tỏi băm'], 'spice', 'allium_aromatic', 'piece', {
    isPantryStaple: true, preferredCulinaryUnit: 'clove', pieceLabelVi: 'củ',
    unitBridge: { gramsPerClove: 5, gramsPerBulb: 35, gramsPerPiece: 15, gramsPerTbsp: 10, gramsPerTsp: 3.5 }, macrosPer100g: { kcal: 149, proteinG: 6.4, fatG: 0.5, carbG: 33 },
  }),
  ing('SHALLOT', 'Hành tím / Hành khô', 'Shallot', ['hành tím', 'hành khô', 'củ hành tím', 'hành củ', 'hành hương', 'hành phi'], 'spice', 'allium_aromatic', 'piece', {
    legacyCanonicalId: 'GARLIC', isPantryStaple: true, preferredCulinaryUnit: 'bulb', pieceLabelVi: 'củ',
    unitBridge: { gramsPerBulb: 12, gramsPerPiece: 12, gramsPerClove: 6, gramsPerTbsp: 10 }, macrosPer100g: { kcal: 72, proteinG: 2.5, fatG: 0.1, carbG: 17 },
  }),
  ing('OYSTER_SAUCE', 'Dầu hào', 'Oyster sauce', ['dầu hào', 'sốt dầu hào'], 'spice', 'condiment_sauce', 'ml', {
    isPantryStaple: true, preferredCulinaryUnit: 'tbsp', allergens: ['shellfish', 'seafood', 'soy', 'wheat_gluten'], animalOrigin: 'seafood',
    unitBridge: { ...LIQUID_CONDIMENT_BRIDGE, densityGPerMl: 1.25 }, macrosPer100g: { kcal: 51, proteinG: 1.4, fatG: 0.2, carbG: 11 },
  }),
  ing('VEGETARIAN_OYSTER_SAUCE', 'Dầu hào chay', 'Vegetarian mushroom oyster sauce', ['dầu hào chay', 'dầu hào nấm hương'], 'spice', 'condiment_sauce', 'ml', {
    legacyCanonicalId: 'SOY_SAUCE', isPantryStaple: true, preferredCulinaryUnit: 'tbsp', allergens: ['soy', 'wheat_gluten'], animalOrigin: 'none',
    unitBridge: { ...LIQUID_CONDIMENT_BRIDGE, densityGPerMl: 1.2 }, macrosPer100g: { kcal: 48, proteinG: 1.2, fatG: 0.1, carbG: 10.5 },
  }),
  ing('SESAME_OIL', 'Dầu mè', 'Sesame oil', ['dầu mè', 'dầu vừng'], 'spice', 'cooking_fat', 'ml', {
    legacyCanonicalId: 'COOKING_OIL', isPantryStaple: true, preferredCulinaryUnit: 'tsp', allergens: ['sesame'],
    unitBridge: { mlPerTbsp: 15, mlPerTsp: 5, densityGPerMl: 0.92 }, macrosPer100g: { kcal: 884, proteinG: 0, fatG: 100, carbG: 0 },
  }),
  ing('SEASONING_POWDER', 'Hạt nêm', 'Seasoning powder', ['hạt nêm', 'bột nêm', 'hạt nêm thịt thăn'], 'spice', 'dry_spice_seasoning', 'g', {
    isPantryStaple: true, preferredCulinaryUnit: 'tsp', animalOrigin: 'pork',
    unitBridge: { gramsPerTbsp: 12, gramsPerTsp: 4, gramsPerPinch: 1, gramsPerPack: 400 }, macrosPer100g: { kcal: 165, proteinG: 12, fatG: 2, carbG: 24 },
  }),
  ing('MUSHROOM_SEASONING', 'Hạt nêm chay nấm', 'Mushroom seasoning powder', ['hạt nêm chay', 'hạt nêm nấm', 'bột nêm chay'], 'spice', 'dry_spice_seasoning', 'g', {
    isPantryStaple: true, preferredCulinaryUnit: 'tsp', animalOrigin: 'none',
    unitBridge: { gramsPerTbsp: 12, gramsPerTsp: 4, gramsPerPinch: 1, gramsPerPack: 400 }, macrosPer100g: { kcal: 150, proteinG: 8, fatG: 1, carbG: 26 },
  }),
  ing('MSG', 'Bột ngọt / Mì chính', 'MSG', ['bột ngọt', 'mì chính'], 'spice', 'dry_spice_seasoning', 'g', {
    isPantryStaple: true, preferredCulinaryUnit: 'tsp',
    unitBridge: { gramsPerTbsp: 12, gramsPerTsp: 4, gramsPerPinch: 1 }, macrosPer100g: { kcal: 0, proteinG: 0, fatG: 0, carbG: 0 },
  }),
  ing('ROCK_SUGAR', 'Đường phèn', 'Rock sugar', ['đường phèn'], 'spice', 'dry_spice_seasoning', 'g', {
    isPantryStaple: true, unitBridge: { gramsPerTbsp: 14, gramsPerTsp: 5, gramsPerPiece: 10 }, macrosPer100g: { kcal: 387, proteinG: 0, fatG: 0, carbG: 100 },
  }),
  ing('PALM_SUGAR', 'Đường thốt nốt', 'Palm sugar', ['đường thốt nốt', 'đường tán'], 'spice', 'dry_spice_seasoning', 'g', {
    unitBridge: { gramsPerTbsp: 14, gramsPerTsp: 5, gramsPerPiece: 25 }, macrosPer100g: { kcal: 377, proteinG: 0.3, fatG: 0.1, carbG: 94 },
  }),
  ing('HONEY', 'Mật ong', 'Honey', ['mật ong', 'mật ong rừng'], 'spice', 'condiment_sauce', 'ml', {
    isPantryStaple: true, animalOrigin: 'honey', unitBridge: { mlPerTbsp: 15, mlPerTsp: 5, densityGPerMl: 1.42 }, macrosPer100g: { kcal: 304, proteinG: 0.3, fatG: 0, carbG: 82 },
  }),
  ing('RICE_VINEGAR', 'Giấm gạo', 'Rice vinegar', ['giấm', 'giấm gạo', 'giấm trắng', 'dấm'], 'spice', 'condiment_sauce', 'ml', {
    isPantryStaple: true, unitBridge: { ...LIQUID_CONDIMENT_BRIDGE, densityGPerMl: 1.01 }, macrosPer100g: { kcal: 18, proteinG: 0, fatG: 0, carbG: 0.8 },
  }),
  ing('FERMENTED_RICE_VINEGAR', 'Giấm bỗng', 'Fermented rice vinegar', ['giấm bỗng', 'bỗng rượu'], 'spice', 'condiment_sauce', 'ml', {
    unitBridge: { ...LIQUID_CONDIMENT_BRIDGE, densityGPerMl: 1.01 }, macrosPer100g: { kcal: 22, proteinG: 0.4, fatG: 0, carbG: 2.5 },
  }),
  ing('CARAMEL_SAUCE', 'Nước màu / Nước hàng', 'Caramel braising sauce', ['nước màu', 'nước hàng', 'nước màu dừa'], 'spice', 'condiment_sauce', 'ml', {
    isPantryStaple: true, unitBridge: { mlPerTbsp: 15, mlPerTsp: 5, densityGPerMl: 1.3 }, macrosPer100g: { kcal: 260, proteinG: 0, fatG: 0, carbG: 65 },
  }),
  ing('CHILI_SAUCE', 'Tương ớt', 'Chili sauce', ['tương ớt', 'sốt ớt'], 'spice', 'condiment_sauce', 'ml', {
    isPantryStaple: true, unitBridge: { ...LIQUID_CONDIMENT_BRIDGE, densityGPerMl: 1.15 }, macrosPer100g: { kcal: 95, proteinG: 1.2, fatG: 0.5, carbG: 22 },
  }),
  ing('TOMATO_KETCHUP', 'Tương cà', 'Tomato ketchup', ['tương cà', 'sốt cà chua đóng chai'], 'spice', 'condiment_sauce', 'ml', {
    isPantryStaple: true, unitBridge: { ...LIQUID_CONDIMENT_BRIDGE, densityGPerMl: 1.15 }, macrosPer100g: { kcal: 101, proteinG: 1.2, fatG: 0.1, carbG: 25 },
  }),
  ing('HOISIN_SAUCE', 'Tương đen', 'Hoisin sauce', ['tương đen', 'tương ngọt', 'tương ăn phở'], 'spice', 'condiment_sauce', 'ml', {
    allergens: ['soy', 'wheat_gluten', 'sesame'], unitBridge: { ...LIQUID_CONDIMENT_BRIDGE, densityGPerMl: 1.28 }, macrosPer100g: { kcal: 220, proteinG: 3.3, fatG: 3.4, carbG: 44 },
  }),
  ing('SHRIMP_PASTE', 'Mắm tôm', 'Fermented shrimp paste', ['mắm tôm', 'mắm ruốc'], 'spice', 'condiment_sauce', 'g', {
    allergens: ['shellfish', 'seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerTbsp: 18, gramsPerTsp: 6, densityGPerMl: 1.2 }, macrosPer100g: { kcal: 78, proteinG: 14, fatG: 1.5, carbG: 2 },
  }),
  ing('FERMENTED_ANCHOVY_SAUCE', 'Mắm nêm', 'Fermented anchovy sauce', ['mắm nêm', 'mắm cá'], 'spice', 'condiment_sauce', 'ml', {
    allergens: ['seafood'], animalOrigin: 'seafood', unitBridge: { ...LIQUID_CONDIMENT_BRIDGE, densityGPerMl: 1.18 }, macrosPer100g: { kcal: 65, proteinG: 10, fatG: 1, carbG: 4 },
  }),
  ing('FERMENTED_TOFU', 'Chao', 'Fermented bean curd', ['chao', 'chao trắng', 'chao đỏ'], 'spice', 'condiment_sauce', 'g', {
    allergens: ['soy'], unitBridge: { gramsPerPiece: 15, gramsPerTbsp: 16, gramsPerPack: 250 }, macrosPer100g: { kcal: 116, proteinG: 8, fatG: 7, carbG: 5 },
  }),
  ing('GOCHUJANG', 'Tương ớt Hàn Quốc', 'Gochujang', ['tương ớt hàn quốc', 'gochujang'], 'spice', 'condiment_sauce', 'g', {
    allergens: ['soy', 'wheat_gluten'], unitBridge: { gramsPerTbsp: 18, gramsPerTsp: 6, gramsPerPack: 500 }, macrosPer100g: { kcal: 215, proteinG: 4, fatG: 1.8, carbG: 45 },
  }),
  ing('MISO_PASTE', 'Tương Miso', 'Miso paste', ['tương miso', 'miso'], 'spice', 'condiment_sauce', 'g', {
    allergens: ['soy'], unitBridge: { gramsPerTbsp: 18, gramsPerTsp: 6 }, macrosPer100g: { kcal: 198, proteinG: 12, fatG: 6, carbG: 26 },
  }),
  ing('TAMARIND', 'Me chua', 'Tamarind pulp', ['me', 'me chua', 'me vắt', 'nước cốt me'], 'spice', 'condiment_sauce', 'g', {
    unitBridge: { gramsPerTbsp: 15, gramsPerPiece: 30, gramsPerPack: 100 }, macrosPer100g: { kcal: 239, proteinG: 2.8, fatG: 0.6, carbG: 63 },
  }),
  ing('SATAY_CHILI_OIL', 'Sa tế', 'Lemongrass chili oil', ['sa tế', 'sa tế tôm', 'sa tế ớt'], 'spice', 'condiment_sauce', 'g', {
    unitBridge: { gramsPerTbsp: 15, gramsPerTsp: 5, gramsPerPack: 100 }, macrosPer100g: { kcal: 420, proteinG: 3, fatG: 38, carbG: 16 },
  }),
  ing('MAYONNAISE', 'Sốt Mayonnaise', 'Mayonnaise', ['mayonnaise', 'sốt mayo', 'mayo'], 'spice', 'condiment_sauce', 'g', {
    allergens: ['egg'], animalOrigin: 'egg', unitBridge: { gramsPerTbsp: 14, gramsPerTsp: 5 }, macrosPer100g: { kcal: 680, proteinG: 1, fatG: 75, carbG: 0.6 },
  }),

  // ======================== 2. AROMATICS & DRY SPICES ========================
  ing('GINGER', 'Gừng tươi', 'Ginger', ['gừng', 'củ gừng', 'gừng già', 'gừng thái sợi'], 'spice', 'allium_aromatic', 'g', {
    pieceLabelVi: 'củ',
    unitBridge: { gramsPerBulb: 35, gramsPerPiece: 35, gramsPerSlice: 5, gramsPerTbsp: 8, gramsPerTsp: 3 }, macrosPer100g: { kcal: 80, proteinG: 1.8, fatG: 0.8, carbG: 18 },
  }),
  ing('LEMONGRASS', 'Sả tươi', 'Lemongrass', ['sả', 'cây sả', 'củ sả', 'sả băm', 'nhánh sả'], 'spice', 'allium_aromatic', 'piece', {
    preferredCulinaryUnit: 'stalk', pieceLabelVi: 'cây',
    unitBridge: { gramsPerStalk: 20, gramsPerPiece: 20, gramsPerTbsp: 10, gramsPerBunch: 120 }, macrosPer100g: { kcal: 99, proteinG: 1.8, fatG: 0.5, carbG: 25 },
  }),
  ing('CHILI', 'Ớt tươi', 'Chili pepper', ['ớt', 'ớt hiểm', 'ớt sừng', 'ớt chỉ thiên', 'ớt đỏ', 'ớt xanh'], 'spice', 'allium_aromatic', 'piece', {
    pieceLabelVi: 'trái',
    unitBridge: { gramsPerPiece: 4, gramsPerFruit: 4, gramsPerTsp: 3, gramsPerSlice: 1 }, macrosPer100g: { kcal: 40, proteinG: 1.9, fatG: 0.4, carbG: 8.8 },
  }),
  ing('ONION', 'Hành tây', 'Onion', ['hành tây', 'củ hành tây', 'hành tây trắng', 'hành tây tím'], 'vegetable', 'allium_aromatic', 'piece', {
    pieceLabelVi: 'củ',
    unitBridge: { gramsPerPiece: 150, gramsPerBulb: 150, gramsPerSlice: 15, gramsPerCup: 160 }, macrosPer100g: { kcal: 40, proteinG: 1.1, fatG: 0.1, carbG: 9.3 },
  }),
  ing('SCALLION', 'Hành lá', 'Scallion / Green onion', ['hành lá', 'hành hoa', 'đầu hành', 'mỡ hành'], 'vegetable', 'allium_aromatic', 'bunch', {
    preferredCulinaryUnit: 'stalk',
    unitBridge: { gramsPerStalk: 15, gramsPerBunch: 90, gramsPerSprig: 10, gramsPerTbsp: 6 }, macrosPer100g: { kcal: 32, proteinG: 1.8, fatG: 0.2, carbG: 7.3 },
  }),
  ing('LEEK_BOARO', 'Hành boa-rô', 'Leek', ['boa-rô', 'boa rô', 'hành boa-rô', 'tỏi tây'], 'vegetable', 'allium_aromatic', 'piece', {
    pieceLabelVi: 'cây', unitBridge: { gramsPerStalk: 80, gramsPerPiece: 80, gramsPerTbsp: 8 }, macrosPer100g: { kcal: 61, proteinG: 1.5, fatG: 0.3, carbG: 14 },
  }),
  ing('GALANGAL', 'Củ riềng', 'Galangal', ['riềng', 'củ riềng', 'riềng xay'], 'spice', 'allium_aromatic', 'g', {
    unitBridge: { gramsPerBulb: 45, gramsPerPiece: 45, gramsPerSlice: 6, gramsPerTbsp: 10 }, macrosPer100g: { kcal: 71, proteinG: 1, fatG: 0.8, carbG: 15 },
  }),
  ing('TURMERIC', 'Nghệ tươi / Bột nghệ', 'Turmeric', ['nghệ', 'củ nghệ', 'bột nghệ', 'nghệ tươi'], 'spice', 'allium_aromatic', 'g', {
    unitBridge: { gramsPerBulb: 25, gramsPerPiece: 25, gramsPerTsp: 3, gramsPerTbsp: 9 }, macrosPer100g: { kcal: 110, proteinG: 2.5, fatG: 1.2, carbG: 22 },
  }),
  ing('STAR_ANISE', 'Hoa hồi', 'Star anise', ['hoa hồi', 'đại hồi', 'tai vị'], 'spice', 'dry_spice_seasoning', 'g', {
    isPantryStaple: true, unitBridge: { gramsPerPiece: 2, gramsPerTsp: 2 }, macrosPer100g: { kcal: 337, proteinG: 18, fatG: 16, carbG: 50 },
  }),
  ing('CINNAMON', 'Quế thanh', 'Cinnamon', ['quế', 'quế thanh', 'bột quế'], 'spice', 'dry_spice_seasoning', 'g', {
    isPantryStaple: true, unitBridge: { gramsPerPiece: 5, gramsPerStalk: 5, gramsPerTsp: 2.6 }, macrosPer100g: { kcal: 247, proteinG: 4, fatG: 1.2, carbG: 81 },
  }),
  ing('FIVE_SPICE', 'Ngũ vị hương', 'Five-spice powder', ['ngũ vị hương', 'bột ngũ vị hương'], 'spice', 'dry_spice_seasoning', 'g', {
    isPantryStaple: true, unitBridge: { gramsPerTsp: 3, gramsPerTbsp: 9, gramsPerPack: 10 }, macrosPer100g: { kcal: 295, proteinG: 10, fatG: 11, carbG: 50 },
  }),
  ing('CURRY_POWDER', 'Bột cà ri', 'Curry powder', ['bột cà ri', 'cà ri bột', 'sốt cà ri'], 'spice', 'dry_spice_seasoning', 'g', {
    unitBridge: { gramsPerTsp: 3, gramsPerTbsp: 9, gramsPerPack: 25 }, macrosPer100g: { kcal: 325, proteinG: 14, fatG: 14, carbG: 56 },
  }),
  ing('CHILI_POWDER', 'Ớt bột', 'Chili powder / Flakes', ['ớt bột', 'ớt khô', 'ớt bột hàn quốc'], 'spice', 'dry_spice_seasoning', 'g', {
    isPantryStaple: true, unitBridge: { gramsPerTsp: 3, gramsPerTbsp: 9 }, macrosPer100g: { kcal: 282, proteinG: 13, fatG: 14, carbG: 50 },
  }),
  ing('ANNATTO_SEED', 'Hạt điều màu', 'Annatto seeds', ['hạt điều màu', 'dầu màu điều', 'màu điều'], 'spice', 'dry_spice_seasoning', 'g', {
    unitBridge: { gramsPerTbsp: 12, gramsPerTsp: 4 }, macrosPer100g: { kcal: 310, proteinG: 12, fatG: 10, carbG: 55 },
  }),

  // ======================== 3. MEAT & POULTRY ========================
  ing('PORK_BELLY', 'Thịt ba chỉ', 'Pork belly', ['ba chỉ', 'ba rọi', 'thịt ba chỉ', 'thịt ba rọi', 'thịt ba chỉ heo'], 'meat', 'pork', 'g', {
    animalOrigin: 'pork', unitBridge: { gramsPerSlice: 25, gramsPerPiece: 250, gramsPerPack: 400 }, macrosPer100g: { kcal: 395, proteinG: 14.5, fatG: 37, carbG: 0 },
  }),
  ing('GROUND_PORK', 'Thịt heo xay', 'Ground pork', ['thịt băm', 'thịt xay', 'thịt heo xay', 'thịt lợn xay', 'thịt bằm'], 'meat', 'pork', 'g', {
    animalOrigin: 'pork', unitBridge: { gramsPerPack: 300, gramsPerBowl: 200, gramsPerTbsp: 18 }, macrosPer100g: { kcal: 263, proteinG: 17, fatG: 21, carbG: 0 },
  }),
  ing('PORK_RIBS', 'Sườn heo non', 'Pork ribs', ['sườn', 'sườn heo', 'sườn non', 'sườn sụn', 'sườn thăn'], 'meat', 'pork', 'g', {
    animalOrigin: 'pork', unitBridge: { gramsPerPiece: 45, gramsPerPack: 500 }, macrosPer100g: { kcal: 277, proteinG: 16, fatG: 23, carbG: 0 },
  }),
  ing('PORK_LOIN', 'Thịt thăn heo / Nạc vai', 'Pork loin / shoulder', ['thịt thăn', 'nạc vai', 'nạc dăm', 'thịt heo nạc', 'thịt lợn nạc'], 'meat', 'pork', 'g', {
    legacyCanonicalId: 'PORK_BELLY', animalOrigin: 'pork', unitBridge: { gramsPerSlice: 25, gramsPerPack: 400 }, macrosPer100g: { kcal: 195, proteinG: 21, fatG: 12, carbG: 0 },
  }),
  ing('PORK_HOCK', 'Chân giò heo', 'Pork hock', ['chân giò', 'giò heo', 'móng giò', 'bắp giò heo'], 'meat', 'pork', 'g', {
    animalOrigin: 'pork', unitBridge: { gramsPerPiece: 500 }, macrosPer100g: { kcal: 260, proteinG: 18, fatG: 20, carbG: 0 },
  }),
  ing('PORK_EAR', 'Tai heo', 'Pig ear', ['tai heo', 'tai lợn'], 'meat', 'pork', 'g', {
    animalOrigin: 'pork', unitBridge: { gramsPerPiece: 250 }, macrosPer100g: { kcal: 234, proteinG: 22, fatG: 15, carbG: 0.5 },
  }),
  ing('VIETNAMESE_PORK_SAUSAGE', 'Chả lụa / Giò lụa', 'Vietnamese pork sausage', ['chả lụa', 'giò lụa', 'giò thủ', 'chả quế'], 'meat', 'pork', 'g', {
    animalOrigin: 'pork', unitBridge: { gramsPerSlice: 30, gramsPerPack: 500 }, macrosPer100g: { kcal: 215, proteinG: 19, fatG: 14, carbG: 3 },
  }),
  ing('PATE', 'Pate gan', 'Liver pate', ['pate', 'pa tê', 'pate gan heo'], 'meat', 'pork', 'g', {
    allergens: ['dairy'], animalOrigin: 'pork', unitBridge: { gramsPerTbsp: 20, gramsPerPack: 170 }, macrosPer100g: { kcal: 319, proteinG: 14, fatG: 28, carbG: 2 },
  }),
  ing('BEEF_SIRLOIN', 'Thịt bò thăn', 'Beef sirloin', ['thịt bò', 'bò phi lê', 'thăn bò', 'thịt bò thái lát'], 'meat', 'beef', 'g', {
    animalOrigin: 'beef', unitBridge: { gramsPerSlice: 20, gramsPerPack: 300 }, macrosPer100g: { kcal: 201, proteinG: 22, fatG: 12, carbG: 0 },
  }),
  ing('BEEF_SHANK', 'Bắp bò / Nạm bò', 'Beef shank / brisket', ['bắp bò', 'nạm bò', 'gầu bò', 'bò hầm'], 'meat', 'beef', 'g', {
    legacyCanonicalId: 'BEEF_SIRLOIN', animalOrigin: 'beef', unitBridge: { gramsPerSlice: 25, gramsPerPack: 400 }, macrosPer100g: { kcal: 175, proteinG: 24, fatG: 8.5, carbG: 0 },
  }),
  ing('GROUND_BEEF', 'Thịt bò băm', 'Ground beef', ['bò băm', 'thịt bò xay', 'bò bằm'], 'meat', 'beef', 'g', {
    legacyCanonicalId: 'BEEF_SIRLOIN', animalOrigin: 'beef', unitBridge: { gramsPerPack: 300, gramsPerBowl: 200 }, macrosPer100g: { kcal: 250, proteinG: 20, fatG: 18, carbG: 0 },
  }),
  ing('DRIED_BEEF', 'Khô bò', 'Beef jerky', ['bò khô', 'khô bò'], 'meat', 'beef', 'g', {
    animalOrigin: 'beef', unitBridge: { gramsPerPack: 100 }, macrosPer100g: { kcal: 310, proteinG: 36, fatG: 8, carbG: 22 },
  }),
  ing('CHICKEN_BREAST', 'Ức gà', 'Chicken breast', ['ức gà', 'thịt ức gà', 'gà phi lê'], 'meat', 'poultry', 'g', {
    animalOrigin: 'poultry', unitBridge: { gramsPerPiece: 220, gramsPerPack: 400 }, macrosPer100g: { kcal: 165, proteinG: 31, fatG: 3.6, carbG: 0 },
  }),
  ing('CHICKEN_THIGH', 'Đùi gà / Thịt gà ta', 'Chicken thigh', ['đùi gà', 'má đùi gà', 'thịt đùi gà', 'thịt gà', 'gà ta'], 'meat', 'poultry', 'g', {
    animalOrigin: 'poultry', unitBridge: { gramsPerPiece: 180, gramsPerPack: 500 }, macrosPer100g: { kcal: 209, proteinG: 24, fatG: 11, carbG: 0 },
  }),
  ing('CHICKEN_WING', 'Cánh gà', 'Chicken wing', ['cánh gà', 'cánh gà giữa'], 'meat', 'poultry', 'g', {
    legacyCanonicalId: 'CHICKEN_THIGH', animalOrigin: 'poultry', unitBridge: { gramsPerPiece: 75, gramsPerPack: 500 }, macrosPer100g: { kcal: 222, proteinG: 20, fatG: 15, carbG: 0 },
  }),
  ing('DUCK_MEAT', 'Thịt vịt', 'Duck meat', ['thịt vịt', 'vịt cỏ', 'ức vịt', 'đùi vịt'], 'meat', 'poultry', 'g', {
    animalOrigin: 'poultry', unitBridge: { gramsPerPiece: 300, gramsPerPack: 600 }, macrosPer100g: { kcal: 240, proteinG: 19, fatG: 18, carbG: 0 },
  }),

  // ======================== 4. SEAFOOD & AQUACULTURE ========================
  ing('SHRIMP', 'Tôm tươi', 'Fresh shrimp', ['tôm', 'tôm sú', 'tôm thẻ', 'tôm đất', 'tôm nõn', 'tôm lột'], 'seafood', 'shellfish_crustacean', 'g', {
    allergens: ['shellfish', 'seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerPiece: 18, gramsPerPack: 300 }, macrosPer100g: { kcal: 99, proteinG: 24, fatG: 0.3, carbG: 0.2 },
  }),
  ing('DRIED_SHRIMP', 'Tôm khô', 'Dried shrimp', ['tôm khô', 'tép khô'], 'seafood', 'shellfish_crustacean', 'g', {
    allergens: ['shellfish', 'seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerTbsp: 10, gramsPerPack: 100 }, macrosPer100g: { kcal: 295, proteinG: 62, fatG: 3, carbG: 2 },
  }),
  ing('CRAB_MEAT', 'Cua đồng / Thịt cua', 'Crab meat', ['cua đồng', 'cua biển', 'thịt cua', 'riêu cua', 'ghẹ'], 'seafood', 'shellfish_crustacean', 'g', {
    allergens: ['shellfish', 'seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerPiece: 120, gramsPerPack: 300 }, macrosPer100g: { kcal: 97, proteinG: 19, fatG: 1.5, carbG: 0 },
  }),
  ing('CLAM', 'Ngao / Nghêu tươi', 'Clams', ['ngao', 'nghêu', 'hến', 'sò'], 'seafood', 'mollusk', 'g', {
    legacyCanonicalId: 'CRAB_MEAT', allergens: ['shellfish', 'seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerPiece: 15, gramsPerPack: 500 }, macrosPer100g: { kcal: 74, proteinG: 13, fatG: 1, carbG: 2.6 },
  }),
  ing('SNAIL', 'Ốc nhồi / Ốc bươu', 'Freshwater snail', ['ốc', 'ốc bươu', 'ốc nhồi', 'ốc móng tay'], 'seafood', 'mollusk', 'g', {
    allergens: ['shellfish', 'seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerPiece: 20, gramsPerPack: 500 }, macrosPer100g: { kcal: 90, proteinG: 16, fatG: 1.4, carbG: 2 },
  }),
  ing('SQUID', 'Mực tươi', 'Squid', ['mực', 'mực ống', 'mực lá', 'mực nang', 'bạch tuộc'], 'seafood', 'mollusk', 'g', {
    allergens: ['shellfish', 'seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerPiece: 180, gramsPerPack: 400 }, macrosPer100g: { kcal: 92, proteinG: 15.6, fatG: 1.4, carbG: 3.1 },
  }),
  ing('SALMON_FILLET', 'Cá hồi phi lê', 'Salmon fillet', ['cá hồi', 'phi lê cá hồi'], 'seafood', 'fish', 'g', {
    allergens: ['seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerSlice: 160, gramsPerPiece: 200, gramsPerPack: 300 }, macrosPer100g: { kcal: 208, proteinG: 20, fatG: 13, carbG: 0 },
  }),
  ing('FISH_FRESHWATER', 'Cá nước ngọt (cá lóc, điêu hồng, rô phi)', 'Freshwater fish', ['cá lóc', 'cá quả', 'cá điêu hồng', 'cá rô phi', 'cá trắm', 'cá chép', 'cá basa', 'cá hú'], 'seafood', 'fish', 'g', {
    allergens: ['seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerSlice: 150, gramsPerPiece: 500 }, macrosPer100g: { kcal: 118, proteinG: 20, fatG: 3.8, carbG: 0 },
  }),
  ing('MACKEREL', 'Cá thu / Cá nục', 'Mackerel', ['cá thu', 'cá nục', 'cá ngừ'], 'seafood', 'fish', 'g', {
    legacyCanonicalId: 'FISH_FRESHWATER', allergens: ['seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerSlice: 160, gramsPerPiece: 350 }, macrosPer100g: { kcal: 189, proteinG: 19, fatG: 12, carbG: 0 },
  }),
  ing('FISH_CAKE', 'Chả cá thác lác', 'Vietnamese fish cake', ['chả cá', 'cá thác lác', 'chả cá thác lác'], 'seafood', 'fish', 'g', {
    allergens: ['seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerPiece: 40, gramsPerPack: 300 }, macrosPer100g: { kcal: 145, proteinG: 18, fatG: 6, carbG: 4 },
  }),

  // ======================== 5. EGGS, DAIRY & SOY/TOFU ========================
  ing('CHICKEN_EGG', 'Trứng gà', 'Chicken egg', ['trứng gà', 'trứng gà ta', 'trứng gà công nghiệp', 'chicken egg'], 'egg', 'egg', 'piece', {
    pieceLabelVi: 'quả', allergens: ['egg'], animalOrigin: 'egg',
    unitBridge: { gramsPerPiece: 55, gramsPerPack: 550 }, macrosPer100g: { kcal: 143, proteinG: 12.6, fatG: 9.5, carbG: 0.7 },
  }),
  ing('DUCK_EGG', 'Trứng vịt', 'Duck egg', ['trứng vịt', 'hột vịt'], 'egg', 'egg', 'piece', {
    pieceLabelVi: 'quả', allergens: ['egg'], animalOrigin: 'egg',
    unitBridge: { gramsPerPiece: 68, gramsPerPack: 680 }, macrosPer100g: { kcal: 185, proteinG: 13, fatG: 14, carbG: 1.4 },
  }),
  ing('QUAIL_EGG', 'Trứng cút', 'Quail egg', ['trứng cút', 'hột cút'], 'egg', 'egg', 'piece', {
    pieceLabelVi: 'quả', allergens: ['egg'], animalOrigin: 'egg',
    unitBridge: { gramsPerPiece: 11, gramsPerPack: 220 }, macrosPer100g: { kcal: 158, proteinG: 13, fatG: 11, carbG: 0.4 },
  }),
  ing('TOFU', 'Đậu phụ / Đậu hũ', 'Firm tofu', ['đậu phụ', 'đậu hũ', 'tàu hũ', 'đậu phụ trắng'], 'vegetable', 'soy_tofu', 'piece', {
    pieceLabelVi: 'bìa', allergens: ['soy'], animalOrigin: 'none',
    unitBridge: { gramsPerPack: 300, gramsPerPiece: 150, gramsPerSlice: 35 }, macrosPer100g: { kcal: 86, proteinG: 9.5, fatG: 4.8, carbG: 1.9 },
  }),
  ing('SILKEN_TOFU', 'Đậu hũ non', 'Silken tofu', ['đậu hũ non', 'tàu hũ non', 'đậu phụ non'], 'vegetable', 'soy_tofu', 'pack', {
    legacyCanonicalId: 'TOFU', allergens: ['soy'], animalOrigin: 'none',
    unitBridge: { gramsPerPack: 300, gramsPerPiece: 300 }, macrosPer100g: { kcal: 55, proteinG: 5, fatG: 2.7, carbG: 2 },
  }),
  ing('FRIED_TOFU_PUFF', 'Đậu phụ chiên', 'Fried tofu puff', ['đậu phụ chiên', 'đậu hũ chiên', 'đậu khuôn rán'], 'vegetable', 'soy_tofu', 'piece', {
    legacyCanonicalId: 'TOFU', allergens: ['soy'], animalOrigin: 'none',
    unitBridge: { gramsPerPack: 300, gramsPerPiece: 40 }, macrosPer100g: { kcal: 195, proteinG: 14, fatG: 13, carbG: 5 },
  }),
  ing('TOFU_SKIN', 'Tàu hũ ky / Phù trúc', 'Tofu skin', ['tàu hũ ky', 'phù trúc', 'váng đậu'], 'vegetable', 'soy_tofu', 'pack', {
    allergens: ['soy'], animalOrigin: 'none',
    unitBridge: { gramsPerPack: 150, gramsPerSheet: 25 }, macrosPer100g: { kcal: 380, proteinG: 42, fatG: 20, carbG: 9 },
  }),
  ing('FRESH_MILK', 'Sữa tươi', 'Fresh milk', ['sữa tươi', 'sữa tươi không đường', 'sữa bò'], 'dairy', 'dairy', 'ml', {
    allergens: ['dairy'], animalOrigin: 'dairy',
    unitBridge: { mlPerCup: 240, mlPerBowl: 250, mlPerTbsp: 15, gramsPerPack: 220, densityGPerMl: 1.03 }, macrosPer100g: { kcal: 61, proteinG: 3.2, fatG: 3.3, carbG: 4.8 },
  }),
  ing('COCONUT_MILK', 'Nước cốt dừa', 'Coconut milk', ['nước cốt dừa', 'cốt dừa'], 'other', 'condiment_sauce', 'ml', {
    animalOrigin: 'none',
    unitBridge: { mlPerCup: 240, mlPerTbsp: 15, gramsPerPack: 400, densityGPerMl: 1.01 }, macrosPer100g: { kcal: 197, proteinG: 2, fatG: 21, carbG: 2.8 },
  }),
  ing('COCONUT_WATER', 'Nước dừa tươi', 'Fresh coconut water', ['nước dừa', 'nước dừa tươi', 'dừa xiêm'], 'other', 'fruit', 'ml', {
    animalOrigin: 'none',
    unitBridge: { mlPerCup: 240, mlPerBowl: 250, mlPerPiece: 300, densityGPerMl: 1.01 }, macrosPer100g: { kcal: 19, proteinG: 0.7, fatG: 0.2, carbG: 3.7 },
  }),
  ing('CONDENSED_MILK', 'Sữa đặc', 'Condensed milk', ['sữa đặc', 'sữa ông thọ'], 'dairy', 'dairy', 'g', {
    allergens: ['dairy'], animalOrigin: 'dairy',
    unitBridge: { gramsPerTbsp: 20, gramsPerPack: 380 }, macrosPer100g: { kcal: 321, proteinG: 7.9, fatG: 8.7, carbG: 54 },
  }),
  ing('YOGURT', 'Sữa chua', 'Yogurt', ['sữa chua', 'yaourt'], 'dairy', 'dairy', 'pack', {
    allergens: ['dairy'], animalOrigin: 'dairy',
    unitBridge: { gramsPerPack: 100, gramsPerCup: 240 }, macrosPer100g: { kcal: 63, proteinG: 4.5, fatG: 1.6, carbG: 7 },
  }),
  ing('CHEDDAR_CHEESE', 'Phô mai Cheddar', 'Cheddar cheese', ['phô mai', 'pho mát', 'cheddar'], 'dairy', 'dairy', 'g', {
    allergens: ['dairy'], animalOrigin: 'dairy',
    unitBridge: { gramsPerSlice: 20, gramsPerPack: 200, gramsPerTbsp: 10 }, macrosPer100g: { kcal: 402, proteinG: 25, fatG: 33, carbG: 1.3 },
  }),
  ing('MOZZARELLA_CHEESE', 'Phô mai Mozzarella', 'Mozzarella cheese', ['phô mai mozzarella', 'mozzarella kéo sợi'], 'dairy', 'dairy', 'g', {
    allergens: ['dairy'], animalOrigin: 'dairy',
    unitBridge: { gramsPerPack: 200, gramsPerCup: 110 }, macrosPer100g: { kcal: 280, proteinG: 28, fatG: 17, carbG: 3.1 },
  }),
  ing('BUTTER', 'Bơ lạt', 'Butter', ['bơ lạt', 'bơ động vật', 'butter'], 'dairy', 'dairy', 'g', {
    allergens: ['dairy'], animalOrigin: 'dairy',
    unitBridge: { gramsPerTbsp: 14, gramsPerTsp: 5, gramsPerSlice: 10, gramsPerPack: 200 }, macrosPer100g: { kcal: 717, proteinG: 0.9, fatG: 81, carbG: 0.1 },
  }),
  ing('HEAVY_CREAM', 'Kem tươi Whipping', 'Heavy cream', ['kem tươi', 'whipping cream', 'cooking cream'], 'dairy', 'dairy', 'ml', {
    allergens: ['dairy'], animalOrigin: 'dairy',
    unitBridge: { mlPerCup: 240, mlPerTbsp: 15, densityGPerMl: 1.0 }, macrosPer100g: { kcal: 340, proteinG: 2.1, fatG: 36, carbG: 2.8 },
  }),

  // ======================== 6. LEAFY GREENS & FRESH HERBS ========================
  ing('WATER_SPINACH', 'Rau muống', 'Water spinach', ['rau muống', 'muống nước', 'rau muống ngọn'], 'vegetable', 'leafy_green', 'bunch', {
    unitBridge: LEAFY_GREEN_BRIDGE, macrosPer100g: { kcal: 19, proteinG: 2.6, fatG: 0.2, carbG: 3.1 },
  }),
  ing('SPINACH', 'Cải bó xôi / Rau chân vịt', 'Spinach', ['rau chân vịt', 'cải bó xôi', 'rau bina'], 'vegetable', 'leafy_green', 'g', {
    unitBridge: LEAFY_GREEN_BRIDGE, macrosPer100g: { kcal: 23, proteinG: 2.9, fatG: 0.4, carbG: 3.6 },
  }),
  ing('MALABAR_SPINACH', 'Rau mồng tơi', 'Malabar spinach', ['mồng tơi', 'rau mồng tơi', 'mùng tơi'], 'vegetable', 'leafy_green', 'bunch', {
    legacyCanonicalId: 'SPINACH', unitBridge: LEAFY_GREEN_BRIDGE, macrosPer100g: { kcal: 19, proteinG: 1.8, fatG: 0.3, carbG: 3.4 },
  }),
  ing('JUTE_MALLOW', 'Rau đay', 'Jute mallow', ['rau đay'], 'vegetable', 'leafy_green', 'bunch', {
    legacyCanonicalId: 'SPINACH', unitBridge: LEAFY_GREEN_BRIDGE, macrosPer100g: { kcal: 32, proteinG: 3.5, fatG: 0.3, carbG: 5.6 },
  }),
  ing('SWEET_LEAF', 'Rau ngót', 'Katuk / Sweet leaf', ['rau ngót', 'bồ ngót'], 'vegetable', 'leafy_green', 'bunch', {
    unitBridge: LEAFY_GREEN_BRIDGE, macrosPer100g: { kcal: 35, proteinG: 5.3, fatG: 0.4, carbG: 4.5 },
  }),
  ing('MUSTARD_GREENS', 'Cải bẹ xanh', 'Mustard greens', ['cải bẹ xanh', 'cải xanh', 'cải cay'], 'vegetable', 'leafy_green', 'bunch', {
    unitBridge: LEAFY_GREEN_BRIDGE, macrosPer100g: { kcal: 27, proteinG: 2.9, fatG: 0.4, carbG: 4.7 },
  }),
  ing('BOK_CHOY', 'Cải thìa', 'Bok choy', ['cải thìa', 'cải chíp'], 'vegetable', 'leafy_green', 'bunch', {
    unitBridge: LEAFY_GREEN_BRIDGE, macrosPer100g: { kcal: 13, proteinG: 1.5, fatG: 0.2, carbG: 2.2 },
  }),
  ing('CHOY_SUM', 'Cải ngọt', 'Choy sum', ['cải ngọt'], 'vegetable', 'leafy_green', 'bunch', {
    unitBridge: LEAFY_GREEN_BRIDGE, macrosPer100g: { kcal: 16, proteinG: 1.8, fatG: 0.2, carbG: 2.6 },
  }),
  ing('NAPA_CABBAGE', 'Cải thảo', 'Napa cabbage', ['cải thảo', 'bắp cải thảo'], 'vegetable', 'cruciferous', 'piece', {
    pieceLabelVi: 'bắp', unitBridge: { gramsPerPiece: 600, gramsPerBunch: 300 }, macrosPer100g: { kcal: 16, proteinG: 1.2, fatG: 0.2, carbG: 3.2 },
  }),
  ing('CABBAGE', 'Bắp cải', 'Green cabbage', ['bắp cải', 'cải bắp', 'bắp cải tím'], 'vegetable', 'cruciferous', 'piece', {
    pieceLabelVi: 'bắp', unitBridge: { gramsPerPiece: 700, gramsPerBowl: 90 }, macrosPer100g: { kcal: 25, proteinG: 1.3, fatG: 0.1, carbG: 5.8 },
  }),
  ing('KIMCHI', 'Kim chi cải thảo', 'Kimchi', ['kim chi', 'kimchi'], 'vegetable', 'cruciferous', 'g', {
    allergens: ['seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerPack: 400, gramsPerBowl: 150, gramsPerTbsp: 20 }, macrosPer100g: { kcal: 15, proteinG: 1.1, fatG: 0.5, carbG: 2.4 },
  }),
  ing('LETTUCE', 'Xà lách', 'Lettuce', ['xà lách', 'rau sống', 'xà lách lô lô'], 'vegetable', 'leafy_green', 'bunch', {
    unitBridge: { ...LEAFY_GREEN_BRIDGE, gramsPerBunch: 250 }, macrosPer100g: { kcal: 15, proteinG: 1.4, fatG: 0.2, carbG: 2.9 },
  }),
  ing('WATERCRESS', 'Xà lách xoong / Cải xoong', 'Watercress', ['cải xoong', 'xà lách xoong'], 'vegetable', 'leafy_green', 'bunch', {
    unitBridge: LEAFY_GREEN_BRIDGE, macrosPer100g: { kcal: 11, proteinG: 2.3, fatG: 0.1, carbG: 1.3 },
  }),
  ing('AMARANTH_GREENS', 'Rau dền', 'Amaranth greens', ['rau dền', 'rau dền đỏ', 'rau dền cơm'], 'vegetable', 'leafy_green', 'bunch', {
    unitBridge: LEAFY_GREEN_BRIDGE, macrosPer100g: { kcal: 23, proteinG: 2.5, fatG: 0.3, carbG: 4 },
  }),
  ing('CHRYSANTHEMUM_GREENS', 'Cải cúc / Tần ô', 'Garland chrysanthemum', ['cải cúc', 'tần ô'], 'vegetable', 'leafy_green', 'bunch', {
    unitBridge: LEAFY_GREEN_BRIDGE, macrosPer100g: { kcal: 24, proteinG: 3.4, fatG: 0.6, carbG: 3 },
  }),
  ing('WATER_DROPWORT', 'Rau cần nước', 'Water dropwort', ['rau cần', 'cần nước', 'cần ta'], 'vegetable', 'leafy_green', 'bunch', {
    unitBridge: LEAFY_GREEN_BRIDGE, macrosPer100g: { kcal: 18, proteinG: 1.5, fatG: 0.2, carbG: 3.2 },
  }),
  ing('CELERY', 'Cần tây', 'Celery', ['cần tây'], 'vegetable', 'leafy_green', 'bunch', {
    unitBridge: { gramsPerBunch: 300, gramsPerStalk: 40 }, macrosPer100g: { kcal: 16, proteinG: 0.7, fatG: 0.2, carbG: 3 },
  }),
  ing('CILANTRO', 'Ngò rí / Rau mùi', 'Cilantro', ['ngò rí', 'rau mùi', 'ngò'], 'vegetable', 'fresh_herb', 'bunch', {
    legacyCanonicalId: 'SCALLION', unitBridge: FRESH_HERB_BRIDGE, macrosPer100g: { kcal: 23, proteinG: 2.1, fatG: 0.5, carbG: 3.7 },
  }),
  ing('SAW_HERB', 'Ngò gai / Mùi tàu', 'Culantro / Sawtooth herb', ['ngò gai', 'mùi tàu'], 'vegetable', 'fresh_herb', 'bunch', {
    legacyCanonicalId: 'SCALLION', unitBridge: FRESH_HERB_BRIDGE, macrosPer100g: { kcal: 25, proteinG: 2, fatG: 0.4, carbG: 4.2 },
  }),
  ing('RICE_PADDY_HERB', 'Ngò ôm / Rau ngổ', 'Rice paddy herb', ['ngò ôm', 'rau ngổ'], 'vegetable', 'fresh_herb', 'bunch', {
    legacyCanonicalId: 'SCALLION', unitBridge: FRESH_HERB_BRIDGE, macrosPer100g: { kcal: 21, proteinG: 1.8, fatG: 0.3, carbG: 3.8 },
  }),
  ing('DILL', 'Thì là', 'Dill', ['thì là', 'rau thì là'], 'vegetable', 'fresh_herb', 'bunch', {
    legacyCanonicalId: 'SCALLION', unitBridge: FRESH_HERB_BRIDGE, macrosPer100g: { kcal: 43, proteinG: 3.5, fatG: 1.1, carbG: 7 },
  }),
  ing('PERILLA', 'Tía tô', 'Perilla leaves', ['tía tô', 'lá tía tô'], 'vegetable', 'fresh_herb', 'bunch', {
    unitBridge: FRESH_HERB_BRIDGE, macrosPer100g: { kcal: 37, proteinG: 2.9, fatG: 0.7, carbG: 7 },
  }),
  ing('VIETNAMESE_BALM', 'Kinh giới', 'Vietnamese balm', ['kinh giới', 'rau kinh giới'], 'vegetable', 'fresh_herb', 'bunch', {
    unitBridge: FRESH_HERB_BRIDGE, macrosPer100g: { kcal: 30, proteinG: 2.4, fatG: 0.5, carbG: 5.5 },
  }),
  ing('THAI_BASIL', 'Húng quế', 'Thai basil', ['húng quế', 'lá quế', 'rau quế'], 'vegetable', 'fresh_herb', 'bunch', {
    unitBridge: FRESH_HERB_BRIDGE, macrosPer100g: { kcal: 23, proteinG: 3.2, fatG: 0.6, carbG: 2.7 },
  }),
  ing('MINT_HERB', 'Húng lủi / Bạc hà', 'Mint leaves', ['húng lủi', 'bạc hà lá', 'rau húng'], 'vegetable', 'fresh_herb', 'bunch', {
    unitBridge: FRESH_HERB_BRIDGE, macrosPer100g: { kcal: 44, proteinG: 3.3, fatG: 0.7, carbG: 8.4 },
  }),
  ing('VIETNAMESE_CORIANDER', 'Rau răm', 'Vietnamese coriander', ['rau răm'], 'vegetable', 'fresh_herb', 'bunch', {
    unitBridge: FRESH_HERB_BRIDGE, macrosPer100g: { kcal: 34, proteinG: 2.7, fatG: 0.6, carbG: 6 },
  }),
  ing('BETEL_LEAF', 'Lá lốt', 'Wild betel leaf', ['lá lốt'], 'vegetable', 'fresh_herb', 'bunch', {
    unitBridge: { ...FRESH_HERB_BRIDGE, gramsPerSheet: 2 }, macrosPer100g: { kcal: 39, proteinG: 3.1, fatG: 0.8, carbG: 6.5 },
  }),
  ing('LIME_LEAF', 'Lá chanh', 'Kaffir lime leaves', ['lá chanh'], 'spice', 'fresh_herb', 'g', {
    unitBridge: { gramsPerSheet: 1, gramsPerPiece: 1, gramsPerSprig: 5 }, macrosPer100g: { kcal: 30, proteinG: 2, fatG: 0.5, carbG: 6 },
  }),
  ing('RIVER_LEAF_LA_GIANG', 'Lá giang', 'River sour leaf', ['lá giang'], 'vegetable', 'fresh_herb', 'bunch', {
    unitBridge: { gramsPerBunch: 150 }, macrosPer100g: { kcal: 28, proteinG: 2.2, fatG: 0.4, carbG: 5 },
  }),

  // ======================== 7. VEGETABLES, GOURDS, ROOTS & MUSHROOMS ========================
  ing('TOMATO', 'Cà chua', 'Tomato', ['cà chua', 'cà chua đỏ', 'cà chua chín'], 'vegetable', 'fruiting_veg', 'piece', {
    pieceLabelVi: 'quả',
    unitBridge: { gramsPerPiece: 110, gramsPerFruit: 110, gramsPerSlice: 18, gramsPerPack: 500 }, macrosPer100g: { kcal: 18, proteinG: 0.9, fatG: 0.2, carbG: 3.9 },
  }),
  ing('CHERRY_TOMATO', 'Cà chua bi', 'Cherry tomato', ['cà chua bi'], 'vegetable', 'fruiting_veg', 'g', {
    legacyCanonicalId: 'TOMATO', unitBridge: { gramsPerPiece: 15, gramsPerPack: 300 }, macrosPer100g: { kcal: 18, proteinG: 0.9, fatG: 0.2, carbG: 3.9 },
  }),
  ing('CUCUMBER', 'Dưa leo / Dưa chuột', 'Cucumber', ['dưa leo', 'dưa chuột'], 'vegetable', 'gourd_melon', 'piece', {
    pieceLabelVi: 'quả',
    unitBridge: { gramsPerPiece: 140, gramsPerSlice: 10 }, macrosPer100g: { kcal: 15, proteinG: 0.7, fatG: 0.1, carbG: 3.6 },
  }),
  ing('BITTER_MELON', 'Khổ qua / Mướp đắng', 'Bitter melon', ['khổ qua', 'mướp đắng'], 'vegetable', 'gourd_melon', 'piece', {
    pieceLabelVi: 'trái',
    unitBridge: { gramsPerPiece: 130, gramsPerFruit: 130 }, macrosPer100g: { kcal: 17, proteinG: 1, fatG: 0.2, carbG: 3.7 },
  }),
  ing('WINTER_MELON', 'Bí đao / Bí xanh', 'Winter melon', ['bí đao', 'bí xanh'], 'vegetable', 'gourd_melon', 'piece', {
    pieceLabelVi: 'quả',
    unitBridge: { gramsPerPiece: 450, gramsPerSlice: 40 }, macrosPer100g: { kcal: 13, proteinG: 0.4, fatG: 0.2, carbG: 3 },
  }),
  ing('SPONGE_GOURD', 'Mướp hương', 'Sponge gourd / Loofah', ['mướp hương', 'quả mướp'], 'vegetable', 'gourd_melon', 'piece', {
    legacyCanonicalId: 'WINTER_MELON', pieceLabelVi: 'quả',
    unitBridge: { gramsPerPiece: 250 }, macrosPer100g: { kcal: 20, proteinG: 1.2, fatG: 0.2, carbG: 4.4 },
  }),
  ing('BOTTLE_GOURD', 'Bầu sao', 'Bottle gourd / Calabash', ['bầu', 'trái bầu', 'bầu sao'], 'vegetable', 'gourd_melon', 'piece', {
    pieceLabelVi: 'trái', unitBridge: { gramsPerPiece: 450 }, macrosPer100g: { kcal: 14, proteinG: 0.6, fatG: 0.1, carbG: 3.4 },
  }),
  ing('PUMPKIN', 'Bí đỏ / Bí ngô', 'Pumpkin / Kabocha', ['bí đỏ', 'bí ngô'], 'vegetable', 'gourd_melon', 'piece', {
    pieceLabelVi: 'miếng',
    unitBridge: { gramsPerPiece: 450, gramsPerSlice: 80 }, macrosPer100g: { kcal: 26, proteinG: 1, fatG: 0.1, carbG: 6.5 },
  }),
  ing('CHAYOTE', 'Su su', 'Chayote', ['su su', 'quả su su'], 'vegetable', 'gourd_melon', 'piece', {
    pieceLabelVi: 'quả',
    unitBridge: { gramsPerPiece: 180 }, macrosPer100g: { kcal: 19, proteinG: 0.8, fatG: 0.1, carbG: 4.5 },
  }),
  ing('EGGPLANT', 'Cà tím', 'Eggplant', ['cà tím', 'cà pháo'], 'vegetable', 'fruiting_veg', 'piece', {
    pieceLabelVi: 'quả',
    unitBridge: { gramsPerPiece: 180 }, macrosPer100g: { kcal: 25, proteinG: 1, fatG: 0.2, carbG: 5.9 },
  }),
  ing('OKRA', 'Đậu bắp', 'Okra', ['đậu bắp'], 'vegetable', 'fruiting_veg', 'g', {
    unitBridge: { gramsPerPiece: 15, gramsPerPack: 250 }, macrosPer100g: { kcal: 33, proteinG: 1.9, fatG: 0.2, carbG: 7.5 },
  }),
  ing('BELL_PEPPER', 'Ớt chuông', 'Bell pepper', ['ớt chuông', 'ớt ngọt Đà Lạt'], 'vegetable', 'fruiting_veg', 'piece', {
    pieceLabelVi: 'quả', unitBridge: { gramsPerPiece: 150 }, macrosPer100g: { kcal: 26, proteinG: 1, fatG: 0.3, carbG: 6 },
  }),
  ing('BROCCOLI', 'Bông cải xanh / Súp lơ xanh', 'Broccoli', ['bông cải xanh', 'súp lơ xanh', 'súp lơ'], 'vegetable', 'cruciferous', 'piece', {
    pieceLabelVi: 'bông', unitBridge: { gramsPerPiece: 300 }, macrosPer100g: { kcal: 34, proteinG: 2.8, fatG: 0.4, carbG: 6.6 },
  }),
  ing('CAULIFLOWER', 'Bông cải trắng', 'Cauliflower', ['bông cải trắng', 'súp lơ trắng'], 'vegetable', 'cruciferous', 'piece', {
    pieceLabelVi: 'bông', unitBridge: { gramsPerPiece: 350 }, macrosPer100g: { kcal: 25, proteinG: 1.9, fatG: 0.3, carbG: 5 },
  }),
  ing('CARROT', 'Cà rốt', 'Carrot', ['cà rốt'], 'vegetable', 'root_tuber', 'piece', {
    pieceLabelVi: 'củ', unitBridge: { gramsPerPiece: 120, gramsPerBulb: 120 }, macrosPer100g: { kcal: 41, proteinG: 0.9, fatG: 0.2, carbG: 9.6 },
  }),
  ing('DAIKON_RADISH', 'Củ cải trắng', 'Daikon radish', ['củ cải trắng', 'củ cải'], 'vegetable', 'root_tuber', 'piece', {
    legacyCanonicalId: 'CARROT', pieceLabelVi: 'củ', unitBridge: { gramsPerPiece: 220, gramsPerBulb: 220 }, macrosPer100g: { kcal: 18, proteinG: 0.6, fatG: 0.1, carbG: 4.1 },
  }),
  ing('KOHLRABI', 'Su hào', 'Kohlrabi', ['su hào', 'củ su hào'], 'vegetable', 'root_tuber', 'piece', {
    pieceLabelVi: 'củ', unitBridge: { gramsPerPiece: 250, gramsPerBulb: 250 }, macrosPer100g: { kcal: 27, proteinG: 1.7, fatG: 0.1, carbG: 6.2 },
  }),
  ing('POTATO', 'Khoai tây', 'Potato', ['khoai tây', 'củ khoai tây'], 'vegetable', 'root_tuber', 'piece', {
    pieceLabelVi: 'củ', unitBridge: { gramsPerPiece: 150, gramsPerBulb: 150 }, macrosPer100g: { kcal: 77, proteinG: 2, fatG: 0.1, carbG: 17 },
  }),
  ing('SWEET_POTATO', 'Khoai lang', 'Sweet potato', ['khoai lang', 'khoai mật'], 'vegetable', 'root_tuber', 'piece', {
    pieceLabelVi: 'củ', unitBridge: { gramsPerPiece: 160, gramsPerBulb: 160 }, macrosPer100g: { kcal: 86, proteinG: 1.6, fatG: 0.1, carbG: 20 },
  }),
  ing('TARO', 'Khoai môn / Khoai sọ', 'Taro', ['khoai môn', 'khoai sọ'], 'vegetable', 'root_tuber', 'g', {
    unitBridge: { gramsPerPiece: 300, gramsPerBulb: 300 }, macrosPer100g: { kcal: 112, proteinG: 1.5, fatG: 0.2, carbG: 26 },
  }),
  ing('JICAMA', 'Củ đậu / Củ sắn nước', 'Jicama', ['củ đậu', 'củ sắn nước'], 'vegetable', 'root_tuber', 'piece', {
    pieceLabelVi: 'củ', unitBridge: { gramsPerPiece: 250 }, macrosPer100g: { kcal: 38, proteinG: 0.7, fatG: 0.1, carbG: 8.8 },
  }),
  ing('LOTUS_ROOT', 'Củ sen', 'Lotus root', ['củ sen', 'ngó sen'], 'vegetable', 'root_tuber', 'g', {
    unitBridge: { gramsPerPiece: 200, gramsPerSlice: 15 }, macrosPer100g: { kcal: 74, proteinG: 2.6, fatG: 0.1, carbG: 17 },
  }),
  ing('LOTUS_SEED', 'Hạt sen', 'Lotus seeds', ['hạt sen', 'sen tươi', 'sen khô'], 'vegetable', 'legume_sprout', 'g', {
    unitBridge: { gramsPerPack: 200, gramsPerBowl: 140 }, macrosPer100g: { kcal: 89, proteinG: 4.1, fatG: 0.5, carbG: 17 },
  }),
  ing('BEAN_SPROUTS', 'Giá đỗ', 'Bean sprouts', ['giá đỗ', 'giá sống'], 'vegetable', 'legume_sprout', 'g', {
    unitBridge: { gramsPerPack: 250, gramsPerBowl: 90, gramsPerBunch: 200 }, macrosPer100g: { kcal: 30, proteinG: 3, fatG: 0.2, carbG: 5.9 },
  }),
  ing('GREEN_BEANS', 'Đậu cô ve', 'Green beans', ['đậu cô ve', 'đậu que'], 'vegetable', 'legume_sprout', 'g', {
    unitBridge: { gramsPerPack: 300, gramsPerBunch: 250 }, macrosPer100g: { kcal: 31, proteinG: 1.8, fatG: 0.2, carbG: 7 },
  }),
  ing('YARDLONG_BEANS', 'Đậu đũa', 'Yardlong beans', ['đậu đũa'], 'vegetable', 'legume_sprout', 'bunch', {
    unitBridge: { gramsPerBunch: 250 }, macrosPer100g: { kcal: 47, proteinG: 2.8, fatG: 0.4, carbG: 8 },
  }),
  ing('SNOW_PEAS', 'Đậu Hà Lan', 'Snow peas', ['đậu hà lan'], 'vegetable', 'legume_sprout', 'g', {
    unitBridge: { gramsPerPack: 200 }, macrosPer100g: { kcal: 42, proteinG: 2.8, fatG: 0.2, carbG: 7.5 },
  }),
  ing('BAMBOO_SHOOT', 'Măng tươi / Măng chua', 'Bamboo shoots', ['măng tươi', 'măng chua', 'măng khô', 'măng củ'], 'vegetable', 'root_tuber', 'g', {
    unitBridge: { gramsPerPack: 300 }, macrosPer100g: { kcal: 27, proteinG: 2.6, fatG: 0.3, carbG: 5.2 },
  }),
  ing('BANANA_BLOSSOM', 'Hoa chuối / Bắp chuối', 'Banana blossom', ['hoa chuối', 'bắp chuối bào'], 'vegetable', 'fruiting_veg', 'g', {
    unitBridge: { gramsPerPiece: 350, gramsPerPack: 250 }, macrosPer100g: { kcal: 28, proteinG: 1.6, fatG: 0.6, carbG: 5 },
  }),
  ing('GREEN_PAPAYA', 'Đu đủ xanh', 'Green papaya', ['đu đủ xanh', 'đu đủ bào'], 'vegetable', 'fruiting_veg', 'piece', {
    pieceLabelVi: 'trái', unitBridge: { gramsPerPiece: 450 }, macrosPer100g: { kcal: 32, proteinG: 0.6, fatG: 0.1, carbG: 8 },
  }),
  ing('SWEET_CORN', 'Bắp ngọt / Ngô Mỹ', 'Sweet corn', ['bắp ngọt', 'ngô ngọt', 'bắp mỹ', 'ngô non'], 'vegetable', 'fruiting_veg', 'piece', {
    pieceLabelVi: 'trái', unitBridge: { gramsPerPiece: 180, gramsPerPack: 250 }, macrosPer100g: { kcal: 86, proteinG: 3.3, fatG: 1.4, carbG: 19 },
  }),
  ing('ELEPHANT_EAR_STEM', 'Bạc hà canh / Dọc mùng', 'Taro stem (Dọc mùng)', ['dọc mùng', 'bạc hà nấu canh'], 'vegetable', 'leafy_green', 'bunch', {
    preferredCulinaryUnit: 'stalk', unitBridge: { gramsPerStalk: 80, gramsPerBunch: 250 }, macrosPer100g: { kcal: 14, proteinG: 0.5, fatG: 0.1, carbG: 3 },
  }),
  ing('MUSHROOM', 'Nấm tổng hợp', 'Mixed mushrooms', ['nấm', 'nấm tươi'], 'vegetable', 'mushroom', 'g', {
    unitBridge: { gramsPerPack: 200, gramsPerPiece: 20 }, macrosPer100g: { kcal: 28, proteinG: 3.1, fatG: 0.3, carbG: 4.3 },
  }),
  ing('SHIITAKE_MUSHROOM', 'Nấm hương / Nấm đông cô', 'Shiitake mushroom', ['nấm hương', 'nấm đông cô'], 'vegetable', 'mushroom', 'g', {
    legacyCanonicalId: 'MUSHROOM', unitBridge: { gramsPerPack: 150, gramsPerPiece: 12 }, macrosPer100g: { kcal: 34, proteinG: 2.2, fatG: 0.5, carbG: 6.8 },
  }),
  ing('STRAW_MUSHROOM', 'Nấm rơm', 'Straw mushroom', ['nấm rơm'], 'vegetable', 'mushroom', 'g', {
    legacyCanonicalId: 'MUSHROOM', unitBridge: { gramsPerPack: 200, gramsPerPiece: 10 }, macrosPer100g: { kcal: 32, proteinG: 3.8, fatG: 0.6, carbG: 4 },
  }),
  ing('KING_OYSTER_MUSHROOM', 'Nấm đùi gà', 'King oyster mushroom', ['nấm đùi gà'], 'vegetable', 'mushroom', 'g', {
    legacyCanonicalId: 'MUSHROOM', unitBridge: { gramsPerPack: 250, gramsPerPiece: 80 }, macrosPer100g: { kcal: 35, proteinG: 3.3, fatG: 0.4, carbG: 6 },
  }),
  ing('ENOKI_MUSHROOM', 'Nấm kim châm', 'Enoki mushroom', ['nấm kim châm'], 'vegetable', 'mushroom', 'pack', {
    legacyCanonicalId: 'MUSHROOM', unitBridge: { gramsPerPack: 150 }, macrosPer100g: { kcal: 37, proteinG: 2.7, fatG: 0.3, carbG: 7.8 },
  }),
  ing('OYSTER_MUSHROOM', 'Nấm bào ngư', 'Oyster mushroom', ['nấm bào ngư', 'nấm sò'], 'vegetable', 'mushroom', 'g', {
    legacyCanonicalId: 'MUSHROOM', unitBridge: { gramsPerPack: 200 }, macrosPer100g: { kcal: 33, proteinG: 3.3, fatG: 0.4, carbG: 6.1 },
  }),
  ing('WOOD_EAR_MUSHROOM', 'Mộc nhĩ / Nấm mèo', 'Wood ear mushroom', ['mộc nhĩ', 'nấm mèo'], 'vegetable', 'mushroom', 'g', {
    legacyCanonicalId: 'MUSHROOM', unitBridge: { gramsPerPiece: 8, gramsPerPack: 100 }, macrosPer100g: { kcal: 25, proteinG: 1.5, fatG: 0.2, carbG: 6 },
  }),

  // ======================== 8. GRAINS, NOODLES, WRAPPERS & FLOURS ========================
  ing('RICE', 'Gạo tẻ / Cơm trắng', 'Jasmine rice / Steamed rice', ['gạo', 'cơm', 'cơm trắng', 'cơm nguội', 'gạo st25', 'gạo thơm'], 'grain', 'rice_grain', 'g', {
    isPantryStaple: true, preferredCulinaryUnit: 'bowl',
    unitBridge: { gramsPerBowl: 180, gramsPerCup: 200, gramsPerTbsp: 15, gramsPerPack: 5000 }, macrosPer100g: { kcal: 130, proteinG: 2.7, fatG: 0.3, carbG: 28 },
  }),
  ing('GLUTINOUS_RICE', 'Gạo nếp', 'Glutinous sticky rice', ['gạo nếp', 'nếp cái hoa vàng', 'xôi'], 'grain', 'rice_grain', 'g', {
    unitBridge: { gramsPerBowl: 180, gramsPerCup: 200 }, macrosPer100g: { kcal: 169, proteinG: 3.5, fatG: 0.3, carbG: 37 },
  }),
  ing('NOODLE', 'Bún tươi / Mì sợi', 'Fresh noodles', ['bún', 'bún tươi', 'bún rối', 'bún lá'], 'grain', 'noodle_wrapper', 'g', {
    unitBridge: { gramsPerBowl: 180, gramsPerPack: 500 }, macrosPer100g: { kcal: 110, proteinG: 2, fatG: 0.2, carbG: 25 },
  }),
  ing('PHO_NOODLE', 'Bánh phở tươi', 'Flat pho rice noodles', ['bánh phở', 'phở tươi', 'sợi phở', 'bánh phở cuốn'], 'grain', 'noodle_wrapper', 'g', {
    legacyCanonicalId: 'NOODLE', unitBridge: { gramsPerBowl: 180, gramsPerPack: 500, gramsPerSheet: 25 }, macrosPer100g: { kcal: 115, proteinG: 2.2, fatG: 0.3, carbG: 26 },
  }),
  ing('GLASS_NOODLE', 'Miến dong', 'Mung bean glass noodles', ['miến', 'miến dong', 'miến tàu'], 'grain', 'noodle_wrapper', 'g', {
    legacyCanonicalId: 'NOODLE', unitBridge: { gramsPerBunch: 60, gramsPerPack: 250 }, macrosPer100g: { kcal: 332, proteinG: 0.7, fatG: 0.1, carbG: 82 },
  }),
  ing('EGG_NOODLE', 'Mì trứng / Mì vàng', 'Egg noodles', ['mì trứng', 'mì sợi vàng', 'mì tươi'], 'grain', 'noodle_wrapper', 'g', {
    legacyCanonicalId: 'NOODLE', allergens: ['wheat_gluten', 'egg'], animalOrigin: 'egg',
    unitBridge: { gramsPerPack: 250, gramsPerBowl: 150 }, macrosPer100g: { kcal: 280, proteinG: 9, fatG: 3.5, carbG: 54 },
  }),
  ing('INSTANT_NOODLE', 'Mì gói', 'Instant noodles', ['mì gói', 'mì tôm'], 'grain', 'noodle_wrapper', 'pack', {
    legacyCanonicalId: 'NOODLE', allergens: ['wheat_gluten'],
    unitBridge: { gramsPerPack: 75, gramsPerPiece: 75 }, macrosPer100g: { kcal: 440, proteinG: 9, fatG: 17, carbG: 62 },
  }),
  ing('SPAGHETTI_PASTA', 'Mì Ý Spaghetti', 'Spaghetti / Pasta', ['mì ý', 'spaghetti', 'pasta', 'nui'], 'grain', 'noodle_wrapper', 'g', {
    allergens: ['wheat_gluten'], unitBridge: { gramsPerPack: 500, gramsPerBowl: 120 }, macrosPer100g: { kcal: 355, proteinG: 12.5, fatG: 1.5, carbG: 72 },
  }),
  ing('RICE_PAPER', 'Bánh tráng / Bánh đa nem', 'Rice paper', ['bánh tráng', 'bánh đa nem', 'vỏ ram'], 'grain', 'noodle_wrapper', 'pack', {
    preferredCulinaryUnit: 'sheet', unitBridge: { gramsPerPack: 200, gramsPerSheet: 8, gramsPerPiece: 8 }, macrosPer100g: { kcal: 330, proteinG: 5, fatG: 0.5, carbG: 77 },
  }),
  ing('RICE_CAKE_TOKBOKKI', 'Bánh gạo Hàn Quốc', 'Korean rice cakes (Tteok)', ['bánh gạo', 'tokbokki', 'tteok'], 'grain', 'noodle_wrapper', 'g', {
    legacyCanonicalId: 'RICE', unitBridge: { gramsPerPack: 400, gramsPerPiece: 15 }, macrosPer100g: { kcal: 225, proteinG: 4.2, fatG: 0.5, carbG: 50 },
  }),
  ing('BREAD_BANH_MI', 'Bánh mì Việt Nam', 'Vietnamese baguette', ['bánh mì', 'ổ bánh mì'], 'grain', 'noodle_wrapper', 'piece', {
    pieceLabelVi: 'ổ', allergens: ['wheat_gluten'], unitBridge: { gramsPerPiece: 90, gramsPerSlice: 30 }, macrosPer100g: { kcal: 274, proteinG: 9, fatG: 3, carbG: 53 },
  }),
  ing('NORI_SEAWEED', 'Rong biển khô', 'Dried seaweed / Nori', ['rong biển', 'lá rong biển', 'rong biển cuộn cơm'], 'vegetable', 'other', 'pack', {
    preferredCulinaryUnit: 'sheet', unitBridge: { gramsPerPack: 30, gramsPerSheet: 3 }, macrosPer100g: { kcal: 35, proteinG: 5.8, fatG: 0.3, carbG: 5.1 },
  }),
  ing('WHEAT_FLOUR', 'Bột mì đa dụng', 'All-purpose wheat flour', ['bột mì'], 'grain', 'rice_grain', 'g', {
    isPantryStaple: true, allergens: ['wheat_gluten'], unitBridge: { gramsPerTbsp: 9, gramsPerCup: 125, gramsPerPack: 1000 }, macrosPer100g: { kcal: 364, proteinG: 10, fatG: 1, carbG: 76 },
  }),
  ing('CORNSTARCH', 'Bột năng / Bột bắp', 'Cornstarch / Tapioca starch', ['bột năng', 'bột bắp', 'bột lọc', 'bột sắn'], 'grain', 'rice_grain', 'g', {
    isPantryStaple: true, unitBridge: { gramsPerTbsp: 9, gramsPerTsp: 3, gramsPerPack: 400 }, macrosPer100g: { kcal: 381, proteinG: 0.3, fatG: 0.1, carbG: 91 },
  }),
  ing('CRISPY_FRY_FLOUR', 'Bột chiên giòn', 'Crispy frying batter mix', ['bột chiên giòn', 'bột chiên xù'], 'grain', 'rice_grain', 'pack', {
    allergens: ['wheat_gluten'], unitBridge: { gramsPerPack: 150, gramsPerTbsp: 10 }, macrosPer100g: { kcal: 355, proteinG: 7, fatG: 1.5, carbG: 78 },
  }),

  // ======================== 9. NUTS, SEEDS & DRIED GOODS ========================
  ing('ROASTED_PEANUT', 'Đậu phộng / Lạc rang', 'Peanuts', ['đậu phộng', 'lạc', 'đậu phộng rang', 'lạc rang', 'tương phộng'], 'other', 'nut_seed', 'g', {
    allergens: ['peanut'], unitBridge: { gramsPerTbsp: 10, gramsPerCup: 145, gramsPerPack: 200 }, macrosPer100g: { kcal: 567, proteinG: 25.8, fatG: 49, carbG: 16 },
  }),
  ing('PEANUT_BUTTER', 'Bơ đậu phộng', 'Peanut butter', ['bơ đậu phộng'], 'other', 'nut_seed', 'g', {
    allergens: ['peanut'], unitBridge: { gramsPerTbsp: 16, gramsPerTsp: 5 }, macrosPer100g: { kcal: 588, proteinG: 25, fatG: 50, carbG: 20 },
  }),
  ing('CASHEW_NUT', 'Hạt điều', 'Cashew nuts', ['hạt điều', 'điều rang'], 'other', 'nut_seed', 'g', {
    allergens: ['tree_nut'], unitBridge: { gramsPerTbsp: 10, gramsPerPack: 200 }, macrosPer100g: { kcal: 553, proteinG: 18, fatG: 44, carbG: 30 },
  }),
  ing('WALNUT_ALMOND', 'Hạnh nhân / Óc chó', 'Almonds / Walnuts', ['hạnh nhân', 'hạt óc chó', 'hạt dẻ'], 'other', 'nut_seed', 'g', {
    allergens: ['tree_nut'], unitBridge: { gramsPerTbsp: 10, gramsPerPack: 200 }, macrosPer100g: { kcal: 590, proteinG: 18, fatG: 52, carbG: 18 },
  }),
  ing('SESAME_SEED', 'Mè rang / Vừng', 'Sesame seeds', ['mè', 'vừng', 'mè trắng', 'mè đen', 'mè rang', 'vừng rang'], 'other', 'nut_seed', 'g', {
    allergens: ['sesame'], unitBridge: { gramsPerTbsp: 9, gramsPerTsp: 3, gramsPerPack: 100 }, macrosPer100g: { kcal: 573, proteinG: 17.7, fatG: 50, carbG: 23 },
  }),
  ing('MUNG_BEAN', 'Đậu xanh cà vỏ', 'Split mung beans', ['đậu xanh', 'đỗ xanh'], 'grain', 'legume_sprout', 'g', {
    unitBridge: { gramsPerCup: 200, gramsPerBowl: 190, gramsPerPack: 500 }, macrosPer100g: { kcal: 347, proteinG: 24, fatG: 1.2, carbG: 63 },
  }),
  ing('BLACK_BEAN', 'Đậu đen', 'Black beans', ['đậu đen', 'đỗ đen'], 'grain', 'legume_sprout', 'g', {
    unitBridge: { gramsPerCup: 200, gramsPerPack: 500 }, macrosPer100g: { kcal: 341, proteinG: 21, fatG: 1.4, carbG: 62 },
  }),
  ing('JUJUBE', 'Táo đỏ khô', 'Red jujube dates', ['táo đỏ', 'táo tàu'], 'fruit', 'fruit', 'g', {
    unitBridge: { gramsPerPiece: 5, gramsPerPack: 200 }, macrosPer100g: { kcal: 281, proteinG: 3.7, fatG: 0.4, carbG: 72 },
  }),

  // ======================== 10. FRUITS & CULINARY CITRUS ========================
  ing('LIME', 'Chanh tươi', 'Lime', ['chanh', 'quả chanh', 'chanh ta', 'chanh giấy', 'nước cốt chanh'], 'fruit', 'fruit', 'piece', {
    pieceLabelVi: 'quả',
    unitBridge: { gramsPerPiece: 45, gramsPerFruit: 45, mlPerPiece: 15, mlPerTbsp: 15, mlPerTsp: 5, densityGPerMl: 1.03 }, macrosPer100g: { kcal: 30, proteinG: 0.7, fatG: 0.2, carbG: 10.5 },
  }),
  ing('KUMQUAT', 'Quất / Tắc', 'Kumquat / Calamansi', ['quất', 'tắc', 'trái tắc'], 'fruit', 'fruit', 'piece', {
    legacyCanonicalId: 'LIME', pieceLabelVi: 'trái',
    unitBridge: { gramsPerPiece: 12, gramsPerFruit: 12, mlPerPiece: 4 }, macrosPer100g: { kcal: 37, proteinG: 0.9, fatG: 0.2, carbG: 9 },
  }),
  ing('PINEAPPLE', 'Dứa / Thơm / Khóm', 'Pineapple', ['dứa', 'thơm', 'khóm'], 'fruit', 'fruit', 'piece', {
    pieceLabelVi: 'quả',
    unitBridge: { gramsPerPiece: 500, gramsPerFruit: 500, gramsPerSlice: 60 }, macrosPer100g: { kcal: 50, proteinG: 0.5, fatG: 0.1, carbG: 13 },
  }),
  ing('STARFRUIT', 'Khế chua', 'Starfruit', ['khế', 'khế chua'], 'fruit', 'fruit', 'piece', {
    pieceLabelVi: 'quả', unitBridge: { gramsPerPiece: 90, gramsPerFruit: 90 }, macrosPer100g: { kcal: 31, proteinG: 1, fatG: 0.3, carbG: 6.7 },
  }),
  ing('GREEN_MANGO', 'Xoài xanh / Xoài chín', 'Mango', ['xoài', 'xoài xanh', 'xoài cát'], 'fruit', 'fruit', 'piece', {
    pieceLabelVi: 'quả', unitBridge: { gramsPerPiece: 280, gramsPerFruit: 280 }, macrosPer100g: { kcal: 60, proteinG: 0.8, fatG: 0.4, carbG: 15 },
  }),
  ing('GREEN_BANANA', 'Chuối xanh / Chuối chín', 'Banana', ['chuối', 'chuối xanh', 'chuối chát'], 'fruit', 'fruit', 'piece', {
    pieceLabelVi: 'quả', unitBridge: { gramsPerPiece: 115, gramsPerFruit: 115, gramsPerBunch: 900 }, macrosPer100g: { kcal: 89, proteinG: 1.1, fatG: 0.3, carbG: 23 },
  }),
  ing('AVOCADO', 'Bơ sáp', 'Avocado', ['bơ sáp', 'quả bơ', 'trái bơ'], 'fruit', 'fruit', 'piece', {
    pieceLabelVi: 'quả', unitBridge: { gramsPerPiece: 220, gramsPerFruit: 220 }, macrosPer100g: { kcal: 160, proteinG: 2, fatG: 15, carbG: 8.5 },
  }),
  ing('APPLE', 'Táo tươi', 'Apple', ['táo tươi', 'quả táo'], 'fruit', 'fruit', 'piece', {
    pieceLabelVi: 'quả', unitBridge: { gramsPerPiece: 180, gramsPerFruit: 180 }, macrosPer100g: { kcal: 52, proteinG: 0.3, fatG: 0.2, carbG: 14 },
  }),
  ing('ORANGE', 'Cam tươi', 'Orange', ['cam', 'cam sành', 'quả cam'], 'fruit', 'fruit', 'piece', {
    pieceLabelVi: 'quả', unitBridge: { gramsPerPiece: 200, gramsPerFruit: 200 }, macrosPer100g: { kcal: 47, proteinG: 0.9, fatG: 0.1, carbG: 12 },
  }),
  ing('POMELO', 'Bưởi', 'Pomelo', ['bưởi', 'múi bưởi'], 'fruit', 'fruit', 'piece', {
    pieceLabelVi: 'quả', unitBridge: { gramsPerPiece: 800, gramsPerSlice: 60 }, macrosPer100g: { kcal: 38, proteinG: 0.8, fatG: 0, carbG: 9.6 },
  }),
  ing('WATERMELON', 'Dưa hấu', 'Watermelon', ['dưa hấu'], 'fruit', 'fruit', 'piece', {
    pieceLabelVi: 'miếng', unitBridge: { gramsPerSlice: 200, gramsPerPiece: 2000 }, macrosPer100g: { kcal: 30, proteinG: 0.6, fatG: 0.2, carbG: 7.6 },
  }),
  ing('DRAGON_FRUIT', 'Thanh long', 'Dragon fruit', ['thanh long'], 'fruit', 'fruit', 'piece', {
    pieceLabelVi: 'quả', unitBridge: { gramsPerPiece: 350, gramsPerFruit: 350 }, macrosPer100g: { kcal: 50, proteinG: 1.1, fatG: 0.4, carbG: 11 },
  }),
  ing('PASSION_FRUIT', 'Chanh dây / Chanh leo', 'Passion fruit', ['chanh dây', 'chanh leo'], 'fruit', 'fruit', 'piece', {
    pieceLabelVi: 'quả', unitBridge: { gramsPerPiece: 55, gramsPerFruit: 55 }, macrosPer100g: { kcal: 97, proteinG: 2.2, fatG: 0.7, carbG: 23 },
  }),

  // ======================== 11. ADDITIONAL VIETNAMESE MARKET ESSENTIALS (150+ COVERAGE) ========================
  ing('PORK_BELLY_ROASTED', 'Heo quay', 'Roast pork belly', ['heo quay', 'thịt quay'], 'meat', 'pork', 'g', {
    animalOrigin: 'pork', unitBridge: { gramsPerPack: 300, gramsPerSlice: 30 }, macrosPer100g: { kcal: 365, proteinG: 19, fatG: 31, carbG: 1 },
  }),
  ing('CHINESE_SAUSAGE_LAP_XUONG', 'Lạp xưởng', 'Chinese sausage (Lap xuong)', ['lạp xưởng', 'lạp sườn'], 'meat', 'pork', 'piece', {
    pieceLabelVi: 'cây', animalOrigin: 'pork', unitBridge: { gramsPerPiece: 45, gramsPerPack: 500 }, macrosPer100g: { kcal: 460, proteinG: 21, fatG: 38, carbG: 9 },
  }),
  ing('PORK_FLOSS', 'Chà bông / Ruốc heo', 'Pork floss', ['chà bông', 'ruốc thịt', 'ruốc heo'], 'meat', 'pork', 'g', {
    allergens: ['soy'], animalOrigin: 'pork', unitBridge: { gramsPerTbsp: 8, gramsPerPack: 200 }, macrosPer100g: { kcal: 396, proteinG: 43, fatG: 16, carbG: 20 },
  }),
  ing('BEEF_MEATBALL', 'Bò viên', 'Beef meatballs', ['bò viên'], 'meat', 'beef', 'g', {
    animalOrigin: 'beef', unitBridge: { gramsPerPiece: 16, gramsPerPack: 250 }, macrosPer100g: { kcal: 215, proteinG: 16, fatG: 14, carbG: 6 },
  }),
  ing('BEEF_TENDON', 'Gân bò', 'Beef tendon', ['gân bò'], 'meat', 'beef', 'g', {
    animalOrigin: 'beef', unitBridge: { gramsPerPack: 300 }, macrosPer100g: { kcal: 150, proteinG: 34, fatG: 0.8, carbG: 0 },
  }),
  ing('QUAIL_BIRD', 'Chim cút', 'Quail', ['chim cút'], 'meat', 'poultry', 'piece', {
    pieceLabelVi: 'con', animalOrigin: 'poultry', unitBridge: { gramsPerPiece: 140 }, macrosPer100g: { kcal: 227, proteinG: 25, fatG: 14, carbG: 0 },
  }),
  ing('CHICKEN_GIBLETS', 'Lòng mề gà', 'Chicken giblets', ['lòng gà', 'mề gà', 'gan gà'], 'meat', 'poultry', 'g', {
    animalOrigin: 'poultry', unitBridge: { gramsPerPack: 250 }, macrosPer100g: { kcal: 154, proteinG: 18, fatG: 8, carbG: 1 },
  }),
  ing('PORK_LIVER', 'Gan heo', 'Pork liver', ['gan heo', 'gan lợn'], 'meat', 'pork', 'g', {
    animalOrigin: 'pork', unitBridge: { gramsPerPack: 250 }, macrosPer100g: { kcal: 134, proteinG: 21, fatG: 3.7, carbG: 2.5 },
  }),
  ing('PORK_BLOOD_CURD', 'Huyết heo / Tiết luộc', 'Cooked pork blood curd', ['huyết', 'huyết heo', 'tiết heo'], 'meat', 'pork', 'g', {
    animalOrigin: 'pork', unitBridge: { gramsPerPack: 300, gramsPerPiece: 50 }, macrosPer100g: { kcal: 75, proteinG: 16, fatG: 0.4, carbG: 0.5 },
  }),
  ing('CATFISH_CA_TRE', 'Cá trê / Cá bông lau', 'Catfish', ['cá trê', 'cá bông lau', 'cá diêu hồng'], 'seafood', 'fish', 'g', {
    legacyCanonicalId: 'FISH_FRESHWATER', allergens: ['seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerSlice: 160, gramsPerPiece: 450 }, macrosPer100g: { kcal: 145, proteinG: 18, fatG: 7.5, carbG: 0 },
  }),
  ing('GOBY_FISH_CA_KEO', 'Cá kèo / Cá bống', 'Goby fish', ['cá kèo', 'cá bống'], 'seafood', 'fish', 'g', {
    allergens: ['seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerPiece: 20, gramsPerPack: 300 }, macrosPer100g: { kcal: 96, proteinG: 18, fatG: 2, carbG: 0 },
  }),
  ing('ANCHOVY_CA_COM', 'Cá cơm tươi / khô', 'Anchovies', ['cá cơm', 'cá cơm khô'], 'seafood', 'fish', 'g', {
    allergens: ['seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerPack: 200 }, macrosPer100g: { kcal: 131, proteinG: 20, fatG: 4.8, carbG: 0 },
  }),
  ing('OYSTER_MEAT', 'Hàu sữa', 'Oyster meat', ['hàu', 'hàu sữa', 'ruột hàu'], 'seafood', 'mollusk', 'g', {
    allergens: ['shellfish', 'seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerPiece: 25, gramsPerPack: 300 }, macrosPer100g: { kcal: 81, proteinG: 9.5, fatG: 2.3, carbG: 4.9 },
  }),
  ing('SCALLOP', 'Cồi sò điệp', 'Scallops', ['cồi sò điệp', 'sò điệp'], 'seafood', 'mollusk', 'g', {
    allergens: ['shellfish', 'seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerPiece: 20, gramsPerPack: 250 }, macrosPer100g: { kcal: 88, proteinG: 17, fatG: 0.8, carbG: 3.2 },
  }),
  ing('SURIMI_CRAB_STICK', 'Thanh cua', 'Crab sticks (Surimi)', ['thanh cua'], 'seafood', 'fish', 'pack', {
    allergens: ['seafood', 'wheat_gluten', 'egg'], animalOrigin: 'seafood', unitBridge: { gramsPerPiece: 18, gramsPerPack: 250 }, macrosPer100g: { kcal: 95, proteinG: 8, fatG: 0.5, carbG: 14 },
  }),
  ing('SALTED_DUCK_EGG', 'Trứng vịt muối', 'Salted duck egg', ['trứng muối', 'hột vịt muối', 'lòng đỏ trứng muối'], 'egg', 'egg', 'piece', {
    pieceLabelVi: 'quả', allergens: ['egg'], animalOrigin: 'egg', unitBridge: { gramsPerPiece: 65 }, macrosPer100g: { kcal: 190, proteinG: 13.5, fatG: 14.5, carbG: 1.5 },
  }),
  ing('CENTURY_EGG', 'Trứng bắc thảo', 'Century egg', ['trứng bắc thảo', 'hột vịt bắc thảo'], 'egg', 'egg', 'piece', {
    pieceLabelVi: 'quả', allergens: ['egg'], animalOrigin: 'egg', unitBridge: { gramsPerPiece: 65 }, macrosPer100g: { kcal: 171, proteinG: 13.6, fatG: 10.7, carbG: 3 },
  }),
  ing('ASPARAGUS', 'Măng tây', 'Asparagus', ['măng tây'], 'vegetable', 'leafy_green', 'bunch', {
    unitBridge: { gramsPerBunch: 250, gramsPerStalk: 16 }, macrosPer100g: { kcal: 20, proteinG: 2.2, fatG: 0.1, carbG: 3.9 },
  }),
  ing('ZUCCHINI', 'Bí ngòi', 'Zucchini', ['bí ngòi', 'bí ngòi xanh'], 'vegetable', 'gourd_melon', 'piece', {
    pieceLabelVi: 'quả', unitBridge: { gramsPerPiece: 200 }, macrosPer100g: { kcal: 17, proteinG: 1.2, fatG: 0.3, carbG: 3.1 },
  }),
  ing('PICKLED_MUSTARD_GREENS', 'Dưa cải chua', 'Pickled mustard greens', ['dưa cải chua', 'dưa chua', 'cải chua'], 'vegetable', 'leafy_green', 'g', {
    unitBridge: { gramsPerPack: 300, gramsPerBowl: 150 }, macrosPer100g: { kcal: 22, proteinG: 1.5, fatG: 0.2, carbG: 4 },
  }),
  ing('PICKLED_EGGPLANT', 'Cà pháo muối', 'Pickled baby eggplant', ['cà pháo muối', 'cà muối'], 'vegetable', 'fruiting_veg', 'g', {
    unitBridge: { gramsPerPiece: 12, gramsPerPack: 250 }, macrosPer100g: { kcal: 28, proteinG: 1.1, fatG: 0.2, carbG: 5.5 },
  }),
  ing('WATER_MIMOSA', 'Rau nhút', 'Water mimosa', ['rau nhút'], 'vegetable', 'leafy_green', 'bunch', {
    unitBridge: LEAFY_GREEN_BRIDGE, macrosPer100g: { kcal: 28, proteinG: 4.5, fatG: 0.3, carbG: 3.5 },
  }),
  ing('SESBANIA_FLOWER', 'Bông điên điển / Bông bí', 'Edible blossoms (Điên điển / Squash flower)', ['bông điên điển', 'bông bí', 'bông thiên lý', 'hoa thiên lý'], 'vegetable', 'leafy_green', 'g', {
    unitBridge: { gramsPerPack: 200, gramsPerBunch: 200 }, macrosPer100g: { kcal: 26, proteinG: 2.4, fatG: 0.3, carbG: 4.8 },
  }),
  ing('CHIVES_HE', 'Hẹ lá', 'Garlic chives', ['hẹ', 'lá hẹ', 'bông hẹ'], 'vegetable', 'allium_aromatic', 'bunch', {
    unitBridge: { gramsPerBunch: 150, gramsPerStalk: 5 }, macrosPer100g: { kcal: 30, proteinG: 3.3, fatG: 0.7, carbG: 4.4 },
  }),
  ing('PANDAN_LEAF', 'Lá dứa / Lá nếp', 'Pandan leaves', ['lá dứa', 'lá nếp'], 'spice', 'fresh_herb', 'bunch', {
    unitBridge: { gramsPerBunch: 50, gramsPerSheet: 5 }, macrosPer100g: { kcal: 32, proteinG: 1.8, fatG: 0.4, carbG: 6 },
  }),
  ing('HU_TIEU_NOODLE', 'Bánh hủ tiếu / Bánh canh', 'Hu tieu / Thick rice noodles', ['hủ tiếu', 'sợi hủ tiếu', 'bánh canh'], 'grain', 'noodle_wrapper', 'g', {
    legacyCanonicalId: 'NOODLE', unitBridge: { gramsPerBowl: 180, gramsPerPack: 400 }, macrosPer100g: { kcal: 145, proteinG: 2.8, fatG: 0.4, carbG: 32 },
  }),
  ing('QUANG_NOODLE', 'Mì Quảng', 'Mi Quang turmeric noodles', ['mì quảng', 'sợi mì quảng'], 'grain', 'noodle_wrapper', 'g', {
    legacyCanonicalId: 'NOODLE', unitBridge: { gramsPerBowl: 200, gramsPerPack: 500 }, macrosPer100g: { kcal: 135, proteinG: 2.5, fatG: 0.8, carbG: 29 },
  }),
  ing('WONTON_WRAPPER', 'Vỏ hoành thánh / Sủi cảo', 'Wonton wrappers', ['vỏ hoành thánh', 'lá hoành thánh', 'vỏ sủi cảo'], 'grain', 'noodle_wrapper', 'pack', {
    allergens: ['wheat_gluten', 'egg'], animalOrigin: 'egg', unitBridge: { gramsPerPack: 250, gramsPerSheet: 7 }, macrosPer100g: { kcal: 291, proteinG: 9.8, fatG: 1.5, carbG: 58 },
  }),
  ing('RICE_FLOUR', 'Bột gạo', 'Rice flour', ['bột gạo', 'bột bánh xèo'], 'grain', 'rice_grain', 'g', {
    unitBridge: { gramsPerCup: 150, gramsPerTbsp: 10, gramsPerPack: 400 }, macrosPer100g: { kcal: 366, proteinG: 6, fatG: 1.4, carbG: 80 },
  }),
  ing('OATS', 'Yến mạch', 'Rolled oats', ['yến mạch', 'cán dẹt'], 'grain', 'rice_grain', 'g', {
    allergens: ['wheat_gluten'], unitBridge: { gramsPerCup: 90, gramsPerBowl: 80, gramsPerTbsp: 10, gramsPerPack: 500 }, macrosPer100g: { kcal: 389, proteinG: 16.9, fatG: 6.9, carbG: 66 },
  }),
  ing('LARD_TOP_MO', 'Mỡ heo / Tóp mỡ', 'Pork lard / Cracklings', ['mỡ heo', 'mỡ nước', 'tóp mỡ'], 'spice', 'cooking_fat', 'g', {
    animalOrigin: 'pork', unitBridge: { gramsPerTbsp: 14, gramsPerTsp: 5 }, macrosPer100g: { kcal: 898, proteinG: 0, fatG: 100, carbG: 0 },
  }),
  ing('COOKING_WINE', 'Rượu trắng nấu ăn / Mirin', 'Cooking rice wine', ['rượu trắng', 'rượu nấu ăn', 'mirin', 'rượu mai quế lộ'], 'spice', 'condiment_sauce', 'ml', {
    isPantryStaple: true, unitBridge: { mlPerTbsp: 15, mlPerTsp: 5, densityGPerMl: 0.99 }, macrosPer100g: { kcal: 120, proteinG: 0.2, fatG: 0, carbG: 8 },
  }),
  ing('DASHI_BROTH_STOCK', 'Nước dùng / Dashi', 'Cooking stock / Dashi', ['nước dùng', 'nước hầm xương', 'nước dashi', 'dashi'], 'other', 'condiment_sauce', 'ml', {
    unitBridge: { mlPerCup: 240, mlPerBowl: 250, mlPerTbsp: 15, densityGPerMl: 1.0 }, macrosPer100g: { kcal: 15, proteinG: 1.8, fatG: 0.4, carbG: 0.8 },
  }),
  ing('SEITAN_CHAY', 'Sườn non chay / Chả chay', 'Wheat gluten / Vegetarian mock meat', ['sườn non chay', 'chả lụa chay', 'thịt chay'], 'other', 'soy_tofu', 'g', {
    allergens: ['wheat_gluten', 'soy'], animalOrigin: 'none', unitBridge: { gramsPerPack: 200, gramsPerPiece: 25 }, macrosPer100g: { kcal: 210, proteinG: 24, fatG: 4, carbG: 18 },
  }),
  ing('CHIA_FLAX_SEED', 'Hạt chia / Hạt lanh', 'Chia / Flax seeds', ['hạt chia', 'hạt lanh'], 'other', 'nut_seed', 'g', {
    unitBridge: { gramsPerTbsp: 12, gramsPerTsp: 4, gramsPerPack: 250 }, macrosPer100g: { kcal: 486, proteinG: 17, fatG: 31, carbG: 42 },
  }),
  ing('CASSAVA', 'Củ sắn / Khoai mì', 'Cassava / Manioc', ['khoai mì', 'sắn củ'], 'vegetable', 'root_tuber', 'g', {
    unitBridge: { gramsPerPiece: 300 }, macrosPer100g: { kcal: 160, proteinG: 1.4, fatG: 0.3, carbG: 38 },
  }),
  ing('BEETROOT', 'Củ dền đỏ', 'Beetroot', ['củ dền'], 'vegetable', 'root_tuber', 'piece', {
    pieceLabelVi: 'củ', unitBridge: { gramsPerPiece: 160, gramsPerBulb: 160 }, macrosPer100g: { kcal: 43, proteinG: 1.6, fatG: 0.2, carbG: 9.6 },
  }),
  ing('SNOW_FUNGUS', 'Nấm tuyết / Ngân nhĩ', 'Snow fungus', ['nấm tuyết', 'ngân nhĩ'], 'vegetable', 'mushroom', 'g', {
    unitBridge: { gramsPerPiece: 20, gramsPerPack: 100 }, macrosPer100g: { kcal: 200, proteinG: 10, fatG: 1.4, carbG: 65 },
  }),
  ing('LOTUS_STEM_SALAD', 'Ngó sen chua ngọt', 'Pickled lotus stem', ['ngó sen'], 'vegetable', 'root_tuber', 'g', {
    unitBridge: { gramsPerPack: 250 }, macrosPer100g: { kcal: 55, proteinG: 1.2, fatG: 0.1, carbG: 12 },
  }),
  ing('DRIED_SQUID', 'Mực khô', 'Dried squid', ['mực khô', 'khô mực'], 'seafood', 'mollusk', 'piece', {
    pieceLabelVi: 'con', allergens: ['shellfish', 'seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerPiece: 60, gramsPerPack: 250 }, macrosPer100g: { kcal: 291, proteinG: 60, fatG: 4.5, carbG: 3 },
  }),
  ing('SALTED_FISH', 'Cá mặn / Khô cá dứa', 'Salted dried fish', ['cá mặn', 'khô cá lóc', 'khô cá dứa', 'khô cá sặc'], 'seafood', 'fish', 'g', {
    allergens: ['seafood'], animalOrigin: 'seafood', unitBridge: { gramsPerSlice: 50, gramsPerPiece: 120 }, macrosPer100g: { kcal: 245, proteinG: 42, fatG: 7, carbG: 0 },
  }),
  ing('FERMENTED_PORK_NEM_CHUA', 'Nem chua', 'Fermented pork roll', ['nem chua'], 'meat', 'pork', 'piece', {
    pieceLabelVi: 'cái', animalOrigin: 'pork', unitBridge: { gramsPerPiece: 25, gramsPerPack: 250 }, macrosPer100g: { kcal: 185, proteinG: 20, fatG: 9, carbG: 6 },
  }),
  ing('SMOKED_BACON_HAM', 'Thịt xông khói / Xúc xích', 'Bacon / Sausage', ['thịt xông khói', 'ba rọi xông khói', 'xúc xích', 'jambon'], 'meat', 'pork', 'g', {
    animalOrigin: 'pork', unitBridge: { gramsPerSlice: 25, gramsPerPiece: 45, gramsPerPack: 250 }, macrosPer100g: { kcal: 330, proteinG: 15, fatG: 29, carbG: 2 },
  }),
];

const BY_ID_V4 = new Map<string, CulinaryIngredientProfileV4>();
const BY_TEXT_V4 = new Map<string, CulinaryIngredientProfileV4>();

for (const profile of CULINARY_INGREDIENT_TAXONOMY_V4) {
  BY_ID_V4.set(profile.id.toUpperCase(), profile);
  for (const label of [profile.nameVi, profile.nameEn, ...profile.aliases]) {
    const clean = normalizeIngredientText(label);
    if (clean && !BY_TEXT_V4.has(clean)) {
      BY_TEXT_V4.set(clean, profile);
    }
  }
}

export const PANTRY_STAPLE_IDS: ReadonlySet<string> = new Set(
  CULINARY_INGREDIENT_TAXONOMY_V4.filter((item) => item.isPantryStaple).map((item) => item.id),
);

/**
 * Resolves a canonical ID or Vietnamese/English market ingredient label to a rich V4 profile.
 * Supports parenthetical/compound recipe names like "Cá lóc tươi (cắt khúc)" or "Hành tím khô băm nhỏ".
 */
export function findCulinaryIngredientV4(
  idOrName: string | null | undefined,
  secondaryNameHint?: string,
): CulinaryIngredientProfileV4 | null {
  if (secondaryNameHint) {
    const byHint = resolveByNamePhrase(secondaryNameHint);
    if (byHint) return byHint;
  }
  if (!idOrName) return null;
  const trimmed = idOrName.trim();
  if (!trimmed) return null;

  const byId = BY_ID_V4.get(trimmed.toUpperCase());
  if (byId) return byId;

  return resolveByNamePhrase(trimmed);
}

function resolveByNamePhrase(rawText: string): CulinaryIngredientProfileV4 | null {
  const clean = normalizeIngredientText(rawText);
  if (!clean) return null;
  const exact = BY_TEXT_V4.get(clean);
  if (exact) return exact;

  // Check comma/slash/paren segments e.g. "Ngao tươi sống / Thịt ngao", "Củ cải trắng (cắt khúc)"
  const segments = rawText
    .split(/[,/()&]/)
    .map((s) => normalizeIngredientText(s))
    .filter(Boolean);

  for (const seg of segments) {
    const hit = BY_TEXT_V4.get(seg);
    if (hit) return hit;
    // Strip trailing prep descriptors ("bam nho", "thai lat", "cat khuc", "tuoi", "chin")
    const stripped = seg
      .replace(
        /\b(tuoi song|tuoi|chin|song|kho|ngon|sach|bam nho|bam nhuyen|bam|thai lat|thai mong|thai soi|thai mui cau|thai|cat khuc|cat mieng|cat|dap dap|xay)\b/g,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();
    if (stripped) {
      const strippedHit = BY_TEXT_V4.get(stripped);
      if (strippedHit) return strippedHit;
    }
  }

  return null;
}

export function isPantryStapleIngredient(
  idOrName: string | null | undefined,
  nameHint?: string,
): boolean {
  if (idOrName && PANTRY_STAPLE_IDS.has(idOrName.trim().toUpperCase())) return true;
  const profile = findCulinaryIngredientV4(idOrName, nameHint);
  return Boolean(profile?.isPantryStaple);
}

export function getIngredientAllergensV4(
  idOrName: string | null | undefined,
  nameHint?: string,
): AllergenGroupV4[] {
  const profile = findCulinaryIngredientV4(idOrName, nameHint);
  return profile ? [...profile.allergens] : [];
}

export function getIngredientParentFamilyV4(
  idOrName: string | null | undefined,
  nameHint?: string,
): IngredientParentFamily | null {
  const profile = findCulinaryIngredientV4(idOrName, nameHint);
  return profile?.parentFamily ?? null;
}

export function areIngredientsSameFamilyV4(a: string, b: string): boolean {
  const famA = getIngredientParentFamilyV4(a);
  const famB = getIngredientParentFamilyV4(b);
  return famA !== null && famA === famB;
}

export interface ConvertCulinaryQuantityInput {
  quantity: number;
  fromUnit: string;
  toUnit: string;
  ingredientId?: string;
  ingredientName?: string;
}

export interface CulinaryConversionResult {
  convertedQuantity: number;
  fromUnit: CulinaryUnit;
  toUnit: CulinaryUnit;
  method: 'identity' | 'physical_metric' | 'culinary_volume' | 'ingredient_bridge';
  gramsEquivalent: number | null;
  mlEquivalent: number | null;
}

function unitToGrams(unit: CulinaryUnit, bridge: IngredientUnitBridgeV4): number | null {
  switch (unit) {
    case 'g':
      return 1;
    case 'kg':
      return 1000;
    case 'piece':
      return bridge.gramsPerPiece ?? bridge.gramsPerBulb ?? bridge.gramsPerFruit ?? null;
    case 'fruit':
      return bridge.gramsPerFruit ?? bridge.gramsPerPiece ?? null;
    case 'pack':
      return bridge.gramsPerPack ?? null;
    case 'bunch':
      return bridge.gramsPerBunch ?? null;
    case 'slice':
      return bridge.gramsPerSlice ?? null;
    case 'clove':
      return bridge.gramsPerClove ?? null;
    case 'bulb':
      return bridge.gramsPerBulb ?? bridge.gramsPerPiece ?? null;
    case 'stalk':
      return bridge.gramsPerStalk ?? null;
    case 'sprig':
      return bridge.gramsPerSprig ?? null;
    case 'sheet':
      return bridge.gramsPerSheet ?? null;
    case 'pinch':
      return bridge.gramsPerPinch ?? 1;
    case 'tbsp':
      if (bridge.gramsPerTbsp !== undefined) return bridge.gramsPerTbsp;
      if (bridge.mlPerTbsp !== undefined && bridge.densityGPerMl !== undefined) {
        return bridge.mlPerTbsp * bridge.densityGPerMl;
      }
      return bridge.densityGPerMl !== undefined ? 15 * bridge.densityGPerMl : null;
    case 'tsp':
      if (bridge.gramsPerTsp !== undefined) return bridge.gramsPerTsp;
      if (bridge.mlPerTsp !== undefined && bridge.densityGPerMl !== undefined) {
        return bridge.mlPerTsp * bridge.densityGPerMl;
      }
      return bridge.densityGPerMl !== undefined ? 5 * bridge.densityGPerMl : null;
    case 'cup':
      if (bridge.gramsPerCup !== undefined) return bridge.gramsPerCup;
      return bridge.densityGPerMl !== undefined ? 240 * bridge.densityGPerMl : null;
    case 'bowl':
      if (bridge.gramsPerBowl !== undefined) return bridge.gramsPerBowl;
      return bridge.densityGPerMl !== undefined ? 250 * bridge.densityGPerMl : null;
    case 'ml':
      return bridge.densityGPerMl !== undefined ? bridge.densityGPerMl : null;
    case 'l':
      return bridge.densityGPerMl !== undefined ? 1000 * bridge.densityGPerMl : null;
    default:
      return null;
  }
}

function unitToMl(unit: CulinaryUnit, bridge: IngredientUnitBridgeV4): number | null {
  switch (unit) {
    case 'ml':
      return 1;
    case 'l':
      return 1000;
    case 'tbsp':
      return bridge.mlPerTbsp ?? 15;
    case 'tsp':
      return bridge.mlPerTsp ?? 5;
    case 'cup':
      return bridge.mlPerCup ?? 240;
    case 'bowl':
      return bridge.mlPerBowl ?? 250;
    case 'piece':
    case 'fruit':
      return bridge.mlPerPiece ?? null;
    case 'g':
      return bridge.densityGPerMl ? 1 / bridge.densityGPerMl : null;
    case 'kg':
      return bridge.densityGPerMl ? 1000 / bridge.densityGPerMl : null;
    default: {
      const g = unitToGrams(unit, bridge);
      if (g !== null && bridge.densityGPerMl) return g / bridge.densityGPerMl;
      return null;
    }
  }
}

/**
 * Deterministic Dual Culinary <-> Storage Unit Bridge.
 * Supports both object input `{ quantity, fromUnit, toUnit, ingredientId, ingredientName }`
 * and positional arguments `(quantity, fromUnit, toUnit, ingredientIdOrName?)`.
 */
export function convertCulinaryQuantity(
  input: ConvertCulinaryQuantityInput,
): CulinaryConversionResult | null;
export function convertCulinaryQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  ingredientIdOrName?: string,
  ingredientNameHint?: string,
): CulinaryConversionResult | null;
export function convertCulinaryQuantity(
  inputOrQuantity: ConvertCulinaryQuantityInput | number,
  fromUnitArg?: string,
  toUnitArg?: string,
  ingredientIdOrName?: string,
  ingredientNameHint?: string,
): CulinaryConversionResult | null {
  const params: ConvertCulinaryQuantityInput =
    typeof inputOrQuantity === 'object' && inputOrQuantity !== null
      ? inputOrQuantity
      : {
          quantity: inputOrQuantity,
          fromUnit: fromUnitArg ?? '',
          toUnit: toUnitArg ?? '',
          ingredientId: ingredientIdOrName,
          ingredientName: ingredientNameHint,
        };

  if (!Number.isFinite(params.quantity) || params.quantity < 0) return null;
  const from = normalizeCulinaryUnit(params.fromUnit);
  const to = normalizeCulinaryUnit(params.toUnit);
  if (!from || !to) return null;

  const profile = findCulinaryIngredientV4(params.ingredientId, params.ingredientName);
  const bridge = profile?.unitBridge ?? {};

  const gramsFactorFrom = unitToGrams(from, bridge);
  const mlFactorFrom = unitToMl(from, bridge);
  const gramsEquivalent =
    gramsFactorFrom !== null ? Number((params.quantity * gramsFactorFrom).toFixed(4)) : null;
  const mlEquivalent =
    mlFactorFrom !== null ? Number((params.quantity * mlFactorFrom).toFixed(4)) : null;

  // 1. Exact identity (including piece <-> fruit synonymy)
  if (from === to || (from === 'piece' && to === 'fruit') || (from === 'fruit' && to === 'piece')) {
    return {
      convertedQuantity: params.quantity,
      fromUnit: from,
      toUnit: to,
      method: 'identity',
      gramsEquivalent,
      mlEquivalent,
    };
  }

  // 2. Pure metric mass (g <-> kg)
  if (DEFAULT_MASS_G[from] !== undefined && DEFAULT_MASS_G[to] !== undefined) {
    const grams = params.quantity * DEFAULT_MASS_G[from]!;
    return {
      convertedQuantity: Number((grams / DEFAULT_MASS_G[to]!).toFixed(6)),
      fromUnit: from,
      toUnit: to,
      method: 'physical_metric',
      gramsEquivalent: grams,
      mlEquivalent,
    };
  }

  // 3. Pure metric/culinary volume (ml <-> l <-> tbsp <-> tsp <-> cup <-> bowl when liquid or generic volume)
  if (
    DEFAULT_VOLUME_ML[from] !== undefined &&
    DEFAULT_VOLUME_ML[to] !== undefined &&
    (!profile || bridge.gramsPerTbsp === undefined || from === 'ml' || from === 'l' || to === 'ml' || to === 'l')
  ) {
    const fromMl = unitToMl(from, bridge) ?? DEFAULT_VOLUME_ML[from]!;
    const toMl = unitToMl(to, bridge) ?? DEFAULT_VOLUME_ML[to]!;
    const totalMl = params.quantity * fromMl;
    return {
      convertedQuantity: Number((totalMl / toMl).toFixed(6)),
      fromUnit: from,
      toUnit: to,
      method:
        (from === 'ml' || from === 'l') && (to === 'ml' || to === 'l')
          ? 'physical_metric'
          : 'culinary_volume',
      gramsEquivalent,
      mlEquivalent: totalMl,
    };
  }

  // 4. Per-ingredient gram bridge (e.g., 300g TOMATO -> 2.727 piece; 2 tbsp SUGAR -> 24g)
  const toGramsFactor = unitToGrams(to, bridge);
  if (gramsFactorFrom !== null && toGramsFactor !== null && toGramsFactor > 0) {
    const totalGrams = params.quantity * gramsFactorFrom;
    return {
      convertedQuantity: Number((totalGrams / toGramsFactor).toFixed(6)),
      fromUnit: from,
      toUnit: to,
      method: 'ingredient_bridge',
      gramsEquivalent: Number(totalGrams.toFixed(4)),
      mlEquivalent,
    };
  }

  // 5. Per-ingredient ml bridge
  const toMlFactor = unitToMl(to, bridge);
  if (mlFactorFrom !== null && toMlFactor !== null && toMlFactor > 0) {
    const totalMl = params.quantity * mlFactorFrom;
    return {
      convertedQuantity: Number((totalMl / toMlFactor).toFixed(6)),
      fromUnit: from,
      toUnit: to,
      method: 'ingredient_bridge',
      gramsEquivalent,
      mlEquivalent: Number(totalMl.toFixed(4)),
    };
  }

  return null;
}

/**
 * Evaluates whether an inventory lot/quantity satisfies a recipe culinary requirement,
 * bridging across storage units (g, kg, ml, pack, bunch) and culinary units (piece, tbsp, clove, bowl).
 */
export function evaluateCulinaryStockSatisfaction(params: {
  availableQuantity: number;
  availableUnit: string;
  requiredQuantity: number;
  requiredUnit: string;
  ingredientId?: string;
  ingredientName?: string;
}): {
  satisfied: boolean;
  availableInRequiredUnit: number | null;
  shortfallInRequiredUnit: number | null;
  conversionMethod: CulinaryConversionResult['method'] | 'unresolved';
} {
  if (params.requiredQuantity <= 0) {
    return {
      satisfied: true,
      availableInRequiredUnit: params.availableQuantity,
      shortfallInRequiredUnit: 0,
      conversionMethod: 'identity',
    };
  }
  const converted = convertCulinaryQuantity({
    quantity: params.availableQuantity,
    fromUnit: params.availableUnit,
    toUnit: params.requiredUnit,
    ingredientId: params.ingredientId,
    ingredientName: params.ingredientName,
  });

  if (!converted) {
    return {
      satisfied: false,
      availableInRequiredUnit: null,
      shortfallInRequiredUnit: null,
      conversionMethod: 'unresolved',
    };
  }

  const available = converted.convertedQuantity;
  const satisfied = available + 1e-6 >= params.requiredQuantity;
  return {
    satisfied,
    availableInRequiredUnit: Number(available.toFixed(4)),
    shortfallInRequiredUnit: satisfied
      ? 0
      : Number(Math.max(0, params.requiredQuantity - available).toFixed(4)),
    conversionMethod: converted.method,
  };
}

export function formatCulinaryUnitVi(
  unit: string,
  ingredientId?: string,
  ingredientName?: string,
): string {
  const canonical = normalizeCulinaryUnit(unit);
  const profile = findCulinaryIngredientV4(ingredientId, ingredientName);
  switch (canonical) {
    case 'tbsp':
      return 'muỗng canh';
    case 'tsp':
      return 'thìa cà phê';
    case 'cup':
      return 'cốc';
    case 'bowl':
      return 'chén';
    case 'clove':
      return 'tép';
    case 'bulb':
      return 'củ';
    case 'stalk':
      return 'nhánh';
    case 'sprig':
      return 'ngọn';
    case 'pinch':
      return 'nhúm';
    case 'fruit':
      return 'trái';
    case 'sheet':
      return 'lá';
    case 'pack':
      return 'gói';
    case 'bunch':
      return 'bó';
    case 'slice':
      return 'lát';
    case 'piece':
      return profile?.pieceLabelVi ?? 'quả/cái';
    case 'g':
    case 'kg':
    case 'ml':
    case 'l':
      return canonical;
    default:
      return unit;
  }
}

function formatNumberVi(value: number): string {
  const rounded = Math.abs(value - Math.round(value)) < 0.04 ? Math.round(value) : Number(value.toFixed(1));
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(rounded);
}

/**
 * Formats a storage/recipe amount with an intuitive Vietnamese home-kitchen culinary equivalent
 * (e.g., `30 ml` Fish Sauce -> `"30 ml (≈ 2 muỗng canh)"`, `2 piece` Tomato -> `"2 quả (≈ 220 g)"`).
 */
export function formatHumanCulinaryEquivalentVi(
  quantity: number,
  unit: string,
  ingredientId?: string,
  ingredientName?: string,
): string {
  const canonical = normalizeCulinaryUnit(unit);
  const unitLabel = formatCulinaryUnitVi(unit, ingredientId, ingredientName);
  const primary = `${formatNumberVi(quantity)} ${unitLabel}`;
  if (!canonical || !Number.isFinite(quantity) || quantity <= 0) return primary;

  // Liquid ml -> muỗng canh / thìa cà phê
  if (canonical === 'ml') {
    if (quantity >= 12 && quantity <= 120) {
      const tbsp = quantity / 15;
      const cleanTbsp = Math.round(tbsp * 2) / 2;
      if (cleanTbsp >= 0.5) {
        return `${primary} (≈ ${formatNumberVi(cleanTbsp)} muỗng canh)`;
      }
    }
    if (quantity > 0 && quantity < 12) {
      const tsp = Math.max(0.5, Math.round((quantity / 5) * 2) / 2);
      return `${primary} (≈ ${formatNumberVi(tsp)} thìa cà phê)`;
    }
    if (quantity >= 200 && quantity <= 600) {
      const bowls = Math.round((quantity / 250) * 2) / 2;
      if (bowls >= 0.5) return `${primary} (≈ ${formatNumberVi(bowls)} chén)`;
    }
  }

  const profile = findCulinaryIngredientV4(ingredientId, ingredientName);
  if (!profile) return primary;

  // Dry seasonings in grams -> tbsp / tsp
  if (canonical === 'g' && profile.unitBridge.gramsPerTbsp && quantity <= 60) {
    if (quantity >= profile.unitBridge.gramsPerTbsp * 0.75) {
      const tbsp = Math.round((quantity / profile.unitBridge.gramsPerTbsp) * 2) / 2;
      return `${primary} (≈ ${formatNumberVi(tbsp)} muỗng canh)`;
    }
    if (profile.unitBridge.gramsPerTsp) {
      const tsp = Math.max(0.5, Math.round((quantity / profile.unitBridge.gramsPerTsp) * 2) / 2);
      return `${primary} (≈ ${formatNumberVi(tsp)} thìa cà phê)`;
    }
  }

  // Rice in grams -> bowls
  if (canonical === 'g' && profile.id === 'RICE' && quantity >= 90) {
    const bowls = Math.round((quantity / 180) * 2) / 2;
    return `${primary} (≈ ${formatNumberVi(bowls)} chén)`;
  }

  // Countable/bunch/pack -> grams equivalent
  if (canonical === 'piece' || canonical === 'bunch' || canonical === 'pack' || canonical === 'clove' || canonical === 'bulb') {
    const toG = convertCulinaryQuantity({
      quantity,
      fromUnit: canonical,
      toUnit: 'g',
      ingredientId: profile.id,
      ingredientName,
    });
    if (toG && toG.convertedQuantity >= 5) {
      return `${primary} (≈ ${formatNumberVi(Math.round(toG.convertedQuantity / 5) * 5)} g)`;
    }
  }

  return primary;
}
