import {
  CANONICAL_INGREDIENTS,
  type CanonicalIngredient,
  type IngredientCategory,
  type StandardUnit,
} from './index';
import { normalizeMultilingualText } from './i18n';
import {
  GLOBAL_EXTENDED_INGREDIENTS,
  type StorageZone,
} from './global-ingredients';

/**
 * Takolio Culinary Standard V4 — Operational Ingredient, Allergen & Nutrition Authority.
 *
 * Keeps V1 `CANONICAL_INGREDIENTS` (45) and `GLOBAL_EXTENDED_INGREDIENTS` (31) immutable
 * while adding ~175 curated culinary concepts (zero `ING_ENR_*` provisional hashes) and
 * complete USDA FoodData Central / Japan MEXT / NIN Vietnam per-100g nutritional &
 * household-unit conversion metadata for every operational ingredient.
 */

export interface CulinaryNutritionReferenceV4 {
  readonly energyKcal: number;
  readonly energyKj: number;
  readonly proteinG: number;
  readonly fatG: number;
  readonly saturatedFatG: number;
  readonly carbohydrateG: number;
  readonly fiberG: number;
  readonly sugarG: number;
  readonly sodiumMg: number;
  readonly saltG: number;
  /** Default edible yield ratio of raw/purchased ingredient (0..1]. */
  readonly edibleYieldRatio: number;
  /** Density in g/ml when unit is ml/l (default 1.0 for water-like liquids). */
  readonly densityGPerMl?: number;
  readonly gramsPerPiece?: number;
  readonly gramsPerBunch?: number;
  readonly gramsPerSlice?: number;
  readonly gramsPerPack?: number;
  readonly sourceReference: string;
}

export interface CulinaryIngredientMetadataV4 {
  readonly ingredient: CanonicalIngredient;
  readonly preferredStorageZone: StorageZone;
  readonly allergenTags: readonly string[];
  readonly nutrition: CulinaryNutritionReferenceV4;
}

type NutTuple = [
  kcal: number,
  protein: number,
  fat: number,
  satFat: number,
  carb: number,
  fiber: number,
  sugar: number,
  sodiumMg: number,
  yieldRatio?: number,
  density?: number,
  perPiece?: number,
  perBunch?: number,
  perSlice?: number,
  perPack?: number,
  src?: string,
];

function nut(
  [
    energyKcal,
    proteinG,
    fatG,
    saturatedFatG,
    carbohydrateG,
    fiberG,
    sugarG,
    sodiumMg,
    edibleYieldRatio = 1,
    densityGPerMl,
    gramsPerPiece,
    gramsPerBunch,
    gramsPerSlice,
    gramsPerPack,
    sourceReference = 'USDA FoodData Central / MEXT / NIN VN Reference',
  ]: NutTuple,
): CulinaryNutritionReferenceV4 {
  return {
    energyKcal,
    energyKj: Math.round(energyKcal * 4.184),
    proteinG,
    fatG,
    saturatedFatG,
    carbohydrateG,
    fiberG,
    sugarG,
    sodiumMg,
    saltG: Math.round(((sodiumMg * 2.5) / 1000) * 1000) / 1000,
    edibleYieldRatio,
    ...(densityGPerMl !== undefined ? { densityGPerMl } : {}),
    ...(gramsPerPiece !== undefined ? { gramsPerPiece } : {}),
    ...(gramsPerBunch !== undefined ? { gramsPerBunch } : {}),
    ...(gramsPerSlice !== undefined ? { gramsPerSlice } : {}),
    ...(gramsPerPack !== undefined ? { gramsPerPack } : {}),
    sourceReference,
  };
}

function item(
  id: string,
  nameVi: string,
  nameEn: string,
  aliases: string[],
  category: IngredientCategory,
  defaultUnit: StandardUnit,
  defaultShelfLifeDays: number,
  preferredStorageZone: StorageZone,
  allergenTags: string[],
  n: NutTuple,
  icon?: string,
): CulinaryIngredientMetadataV4 {
  return {
    ingredient: {
      id,
      nameVi,
      nameEn,
      aliases,
      category,
      defaultUnit,
      defaultShelfLifeDays,
      ...(icon ? { icon } : {}),
    },
    preferredStorageZone,
    allergenTags,
    nutrition: nut(n),
  };
}

/** Nutrition, conversion, and allergen metadata for the 45 V1 + 31 Global canonical IDs. */
export const EXISTING_INGREDIENT_PROFILES_V4: Readonly<
  Record<string, { allergenTags: readonly string[]; nutrition: CulinaryNutritionReferenceV4 }>
> = Object.freeze({
  // --- 45 V1 CANONICAL_INGREDIENTS ---
  PORK_BELLY: {
    allergenTags: ['pork'],
    nutrition: nut([518, 9.34, 53.01, 19.33, 0, 0, 0, 32, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 167820']),
  },
  GROUND_PORK: {
    allergenTags: ['pork'],
    nutrition: nut([263, 16.88, 21.19, 7.87, 0, 0, 0, 56, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 167902']),
  },
  BEEF_SIRLOIN: {
    allergenTags: ['beef'],
    nutrition: nut([183, 20.6, 10.6, 4.1, 0, 0, 0, 56, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170187']),
  },
  CHICKEN_BREAST: {
    allergenTags: ['chicken'],
    nutrition: nut([120, 22.5, 2.62, 0.56, 0, 0, 0, 45, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 171477']),
  },
  CHICKEN_THIGH: {
    allergenTags: ['chicken'],
    nutrition: nut([177, 19.3, 10.5, 2.9, 0, 0, 0, 82, 0.82, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 172385']),
  },
  SHRIMP: {
    allergenTags: ['shrimp', 'crustaceans'],
    nutrition: nut([85, 20.1, 0.51, 0.1, 0, 0, 0, 119, 0.78, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 175179']),
  },
  SALMON_FILLET: {
    allergenTags: ['salmon', 'fish'],
    nutrition: nut([208, 20.42, 13.42, 3.05, 0, 0, 0, 59, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 175167']),
  },
  CHICKEN_EGG: {
    allergenTags: ['egg'],
    nutrition: nut([143, 12.56, 9.51, 3.13, 0.72, 0, 0.37, 142, 0.88, undefined, 50, undefined, undefined, undefined, 'USDA FDC 171287']),
  },
  FRESH_MILK: {
    allergenTags: ['milk'],
    nutrition: nut([61, 3.15, 3.25, 1.87, 4.8, 0, 5.05, 43, 1, 1.03, undefined, undefined, undefined, undefined, 'USDA FDC 171265']),
  },
  CHEDDAR_CHEESE: {
    allergenTags: ['milk'],
    nutrition: nut([403, 22.87, 33.31, 18.87, 3.09, 0, 0.48, 653, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 173414']),
  },
  BUTTER: {
    allergenTags: ['milk'],
    nutrition: nut([717, 0.85, 81.11, 51.37, 0.06, 0, 0.06, 11, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 173430']),
  },
  TOMATO: {
    allergenTags: [],
    nutrition: nut([18, 0.88, 0.2, 0.03, 3.89, 1.2, 2.63, 5, 1, undefined, 120, undefined, undefined, undefined, 'USDA FDC 170457']),
  },
  WATER_SPINACH: {
    allergenTags: [],
    nutrition: nut([19, 2.6, 0.2, 0.05, 3.14, 2.1, 0.5, 113, 0.85, undefined, undefined, 300, undefined, undefined, 'USDA FDC 169378']),
  },
  SPINACH: {
    allergenTags: [],
    nutrition: nut([23, 2.86, 0.39, 0.06, 3.63, 2.2, 0.42, 79, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168462']),
  },
  TOFU: {
    allergenTags: ['soybean'],
    nutrition: nut([83, 10.0, 5.26, 0.76, 1.2, 0.9, 0.4, 8, 1, undefined, 120, undefined, undefined, undefined, 'USDA FDC 172475']),
  },
  BROCCOLI: {
    allergenTags: [],
    nutrition: nut([34, 2.82, 0.37, 0.04, 6.64, 2.6, 1.7, 33, 0.82, undefined, 300, undefined, undefined, undefined, 'USDA FDC 170379']),
  },
  CARROT: {
    allergenTags: [],
    nutrition: nut([41, 0.93, 0.24, 0.04, 9.58, 2.8, 4.74, 69, 0.89, undefined, 110, undefined, undefined, undefined, 'USDA FDC 170393']),
  },
  ONION: {
    allergenTags: [],
    nutrition: nut([40, 1.1, 0.1, 0.04, 9.34, 1.7, 4.24, 4, 0.9, undefined, 140, undefined, undefined, undefined, 'USDA FDC 170000']),
  },
  GARLIC: {
    allergenTags: [],
    nutrition: nut([149, 6.36, 0.5, 0.09, 33.06, 2.1, 1.0, 17, 0.87, undefined, 25, undefined, undefined, undefined, 'USDA FDC 169230']),
  },
  GINGER: {
    allergenTags: [],
    nutrition: nut([80, 1.82, 0.75, 0.2, 17.77, 2.0, 1.7, 13, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169231']),
  },
  SCALLION: {
    allergenTags: [],
    nutrition: nut([32, 1.83, 0.19, 0.03, 7.34, 2.6, 2.33, 16, 0.92, undefined, undefined, 40, undefined, undefined, 'USDA FDC 170005']),
  },
  CHILI: {
    allergenTags: [],
    nutrition: nut([40, 1.87, 0.44, 0.04, 8.81, 1.5, 5.3, 9, 0.9, undefined, 5, undefined, undefined, undefined, 'USDA FDC 170106']),
  },
  CUCUMBER: {
    allergenTags: [],
    nutrition: nut([15, 0.65, 0.11, 0.04, 3.63, 0.5, 1.67, 2, 0.95, undefined, 150, undefined, undefined, undefined, 'USDA FDC 168409']),
  },
  CABBAGE: {
    allergenTags: [],
    nutrition: nut([25, 1.28, 0.1, 0.03, 5.8, 2.5, 3.2, 18, 0.85, undefined, 800, undefined, undefined, undefined, 'USDA FDC 169975']),
  },
  KIMCHI: {
    allergenTags: [],
    nutrition: nut([15, 1.1, 0.5, 0.07, 2.4, 1.6, 1.06, 498, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170497']),
  },
  MUSHROOM: {
    allergenTags: [],
    nutrition: nut([27, 2.5, 0.34, 0.05, 4.5, 1.7, 1.8, 8, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169251']),
  },
  RICE: {
    allergenTags: [],
    nutrition: nut([358, 6.5, 0.58, 0.16, 79.15, 1.3, 0.12, 1, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169756']),
  },
  SPAGHETTI_PASTA: {
    allergenTags: ['wheat'],
    nutrition: nut([371, 13.04, 1.51, 0.28, 74.67, 3.2, 2.67, 6, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168927']),
  },
  NOODLE: {
    allergenTags: [],
    nutrition: nut([110, 2.2, 0.3, 0.05, 24.5, 0.8, 0.1, 12, 1, undefined, undefined, undefined, undefined, undefined, 'NIN VN Fresh Rice Noodle Ref']),
  },
  FISH_SAUCE: {
    allergenTags: ['fish'],
    nutrition: nut([35, 5.06, 0.01, 0, 3.64, 0, 3.64, 7851, 1, 1.2, undefined, undefined, undefined, undefined, 'USDA FDC 172185']),
  },
  SOY_SAUCE: {
    allergenTags: ['soybean', 'wheat'],
    nutrition: nut([53, 8.14, 0.57, 0.07, 4.93, 0.8, 0.4, 5493, 1, 1.18, undefined, undefined, undefined, undefined, 'USDA FDC 174277']),
  },
  COOKING_OIL: {
    allergenTags: [],
    nutrition: nut([884, 0, 100, 14.5, 0, 0, 0, 0, 1, 0.92, undefined, undefined, undefined, undefined, 'USDA FDC 171413']),
  },
  PORK_RIBS: {
    allergenTags: ['pork'],
    nutrition: nut([277, 15.6, 23.3, 8.6, 0, 0, 0, 76, 0.65, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 167861']),
  },
  CRAB_MEAT: {
    allergenTags: ['crab', 'crustaceans'],
    nutrition: nut([87, 18.06, 1.08, 0.22, 0.04, 0, 0, 293, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 174208']),
  },
  SQUID: {
    allergenTags: ['squid', 'molluscs'],
    nutrition: nut([92, 15.58, 1.38, 0.36, 3.08, 0, 0, 44, 0.85, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 174223']),
  },
  FISH_FRESHWATER: {
    allergenTags: ['fish'],
    nutrition: nut([105, 19.5, 2.4, 0.65, 0, 0, 0, 52, 0.78, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 175176']),
  },
  BITTER_MELON: {
    allergenTags: [],
    nutrition: nut([17, 1.0, 0.17, 0.03, 3.7, 2.8, 1.0, 5, 0.82, undefined, 160, undefined, undefined, undefined, 'USDA FDC 168393']),
  },
  WINTER_MELON: {
    allergenTags: [],
    nutrition: nut([13, 0.4, 0.2, 0.02, 3.0, 2.9, 1.2, 111, 0.78, undefined, 500, undefined, undefined, undefined, 'USDA FDC 169214']),
  },
  PUMPKIN: {
    allergenTags: [],
    nutrition: nut([26, 1.0, 0.1, 0.05, 6.5, 0.5, 2.76, 1, 0.75, undefined, 800, undefined, undefined, undefined, 'USDA FDC 168448']),
  },
  PINEAPPLE: {
    allergenTags: [],
    nutrition: nut([50, 0.54, 0.12, 0.01, 13.12, 1.4, 9.85, 1, 0.6, undefined, 600, undefined, undefined, undefined, 'USDA FDC 169124']),
  },
  BEAN_SPROUTS: {
    allergenTags: [],
    nutrition: nut([30, 3.04, 0.18, 0.05, 5.94, 1.8, 4.13, 6, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169963']),
  },
  CHAYOTE: {
    allergenTags: [],
    nutrition: nut([19, 0.82, 0.13, 0.03, 4.51, 1.7, 1.66, 2, 0.88, undefined, 220, undefined, undefined, undefined, 'USDA FDC 169990']),
  },
  LEMONGRASS: {
    allergenTags: [],
    nutrition: nut([99, 1.82, 0.49, 0.11, 25.31, 0, 0, 6, 0.75, undefined, 20, undefined, undefined, undefined, 'USDA FDC 168573']),
  },
  LIME: {
    allergenTags: [],
    nutrition: nut([30, 0.7, 0.2, 0.02, 10.54, 2.8, 1.69, 2, 0.5, undefined, 45, undefined, undefined, undefined, 'USDA FDC 168155']),
  },
  RICE_PAPER: {
    allergenTags: [],
    nutrition: nut([335, 3.5, 0.4, 0.1, 79.0, 1.2, 0.5, 280, 1, undefined, undefined, undefined, undefined, 200, 'USDA FDC Rice Paper Ref']),
  },

  // --- 31 GLOBAL_EXTENDED_INGREDIENTS ---
  SESAME_OIL: {
    allergenTags: ['sesame'],
    nutrition: nut([884, 0, 100, 14.2, 0, 0, 0, 0, 1, 0.92, undefined, undefined, undefined, undefined, 'USDA FDC 171028']),
  },
  OLIVE_OIL: {
    allergenTags: [],
    nutrition: nut([884, 0, 100, 13.8, 0, 0, 0, 2, 1, 0.91, undefined, undefined, undefined, undefined, 'USDA FDC 171413']),
  },
  MISO: {
    allergenTags: ['soybean'],
    nutrition: nut([199, 11.69, 6.01, 0.87, 26.47, 5.4, 6.2, 3728, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 172446']),
  },
  MIRIN: {
    allergenTags: [],
    nutrition: nut([241, 0.3, 0, 0, 43.2, 0, 38.0, 15, 1, 1.15, undefined, undefined, undefined, undefined, 'MEXT Hon-Mirin 16031']),
  },
  DASHI: {
    allergenTags: ['fish'],
    nutrition: nut([5, 0.8, 0, 0, 0.4, 0, 0, 320, 1, 1.0, undefined, undefined, undefined, undefined, 'MEXT Ichiban Dashi Ref']),
  },
  MUSTARD: {
    allergenTags: ['mustard'],
    nutrition: nut([60, 3.74, 3.34, 0.21, 5.83, 4.0, 0.94, 1135, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 172234']),
  },
  WINE_COOKING: {
    allergenTags: ['sulphites'],
    nutrition: nut([82, 0.07, 0, 0, 2.6, 0, 0.96, 5, 1, 0.99, undefined, undefined, undefined, undefined, 'USDA FDC 173190']),
  },
  SOBA_BUCKWHEAT: {
    allergenTags: ['buckwheat', 'wheat'],
    nutrition: nut([344, 13.8, 2.2, 0.4, 69.0, 4.0, 1.2, 700, 1, undefined, undefined, undefined, undefined, undefined, 'MEXT Dry Soba 01097']),
  },
  UDON_WHEAT: {
    allergenTags: ['wheat'],
    nutrition: nut([105, 2.6, 0.4, 0.08, 21.6, 1.1, 0.2, 120, 1, undefined, undefined, undefined, undefined, 200, 'MEXT Boiled/Fresh Udon']),
  },
  BREAD: {
    allergenTags: ['wheat'],
    nutrition: nut([265, 9.0, 3.2, 0.7, 49.0, 2.7, 5.0, 491, 1, undefined, undefined, undefined, 30, undefined, 'USDA FDC 172687']),
  },
  OATS: {
    allergenTags: [],
    nutrition: nut([379, 13.15, 6.52, 1.11, 67.7, 10.1, 0.99, 6, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 173904']),
  },
  POTATO: {
    allergenTags: [],
    nutrition: nut([77, 2.02, 0.09, 0.03, 17.47, 2.2, 0.78, 6, 0.85, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170026']),
  },
  YOGURT: {
    allergenTags: ['milk'],
    nutrition: nut([61, 3.47, 3.25, 2.1, 4.66, 0, 4.66, 46, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 171284']),
  },
  CREAM: {
    allergenTags: ['milk'],
    nutrition: nut([340, 2.84, 36.1, 23.03, 2.84, 0, 2.92, 27, 1, 0.99, undefined, undefined, undefined, undefined, 'USDA FDC 170859']),
  },
  NATTO: {
    allergenTags: ['soybean'],
    nutrition: nut([211, 19.4, 11.0, 1.6, 12.6, 5.4, 4.9, 7, 1, undefined, undefined, undefined, undefined, 45, 'USDA FDC 172443']),
  },
  SOYBEAN: {
    allergenTags: ['soybean'],
    nutrition: nut([121, 11.91, 5.2, 0.62, 8.91, 5.2, 2.18, 6, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168411']),
  },
  GROUND_BEEF: {
    allergenTags: ['beef'],
    nutrition: nut([215, 18.6, 15.0, 5.9, 0, 0, 0, 68, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 174036']),
  },
  BACON_HAM: {
    allergenTags: ['pork'],
    nutrition: nut([368, 13.7, 34.0, 11.5, 1.2, 0, 0.5, 1370, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 167923']),
  },
  MACKEREL: {
    allergenTags: ['mackerel', 'fish'],
    nutrition: nut([205, 18.6, 13.89, 3.26, 0, 0, 0, 90, 0.8, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 175119']),
  },
  CLAM_MUSSEL: {
    allergenTags: ['molluscs'],
    nutrition: nut([86, 14.67, 0.96, 0.1, 3.57, 0, 0, 601, 0.45, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 174212']),
  },
  SALMON_ROE: {
    allergenTags: ['salmon_roe', 'fish'],
    nutrition: nut([264, 24.6, 17.9, 4.1, 4.0, 0, 0, 1500, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 171968']),
  },
  WALNUT: {
    allergenTags: ['walnut', 'tree_nuts'],
    nutrition: nut([654, 15.23, 65.21, 6.13, 13.71, 6.7, 2.61, 2, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170187']),
  },
  CASHEW: {
    allergenTags: ['cashew', 'tree_nuts'],
    nutrition: nut([553, 18.22, 43.85, 7.78, 30.19, 3.3, 5.91, 12, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170162']),
  },
  PEANUT: {
    allergenTags: ['peanut'],
    nutrition: nut([567, 25.8, 49.24, 6.28, 16.13, 8.5, 4.72, 18, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 172430']),
  },
  ALMOND: {
    allergenTags: ['almond', 'tree_nuts'],
    nutrition: nut([579, 21.15, 49.93, 3.8, 21.55, 12.5, 4.35, 1, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170567']),
  },
  SESAME_SEED: {
    allergenTags: ['sesame'],
    nutrition: nut([573, 17.73, 49.67, 6.96, 23.45, 11.8, 0.3, 11, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170150']),
  },
  LUPIN_BEAN: {
    allergenTags: ['lupin'],
    nutrition: nut([119, 15.57, 2.92, 0.35, 9.88, 2.8, 0, 4, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 172427']),
  },
  CELERY: {
    allergenTags: ['celery'],
    nutrition: nut([14, 0.69, 0.17, 0.04, 2.97, 1.6, 1.34, 80, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169988']),
  },
  YAM_NAGAIIMO: {
    allergenTags: ['yam'],
    nutrition: nut([65, 2.2, 0.3, 0.05, 13.9, 1.0, 0.5, 11, 0.88, undefined, undefined, undefined, undefined, undefined, 'MEXT Nagaimo 02026']),
  },
  BELL_PEPPER: {
    allergenTags: [],
    nutrition: nut([26, 0.99, 0.3, 0.06, 6.03, 2.1, 4.2, 4, 0.85, undefined, 150, undefined, undefined, undefined, 'USDA FDC 170108']),
  },
  ZUCCHINI: {
    allergenTags: [],
    nutrition: nut([17, 1.21, 0.32, 0.08, 3.11, 1.0, 2.5, 8, 0.92, undefined, 200, undefined, undefined, undefined, 'USDA FDC 169291']),
  },
});

/** Curated Takolio Culinary Standard V4 Canonical Ingredients (~175 essential items). */
export const CULINARY_STANDARD_INGREDIENT_METADATA_V4: readonly CulinaryIngredientMetadataV4[] =
  Object.freeze([
    // =========================================================================
    // 1. PANTRY SEASONINGS, SALTS, SUGARS & DRY SPICES
    // =========================================================================
    item('SALT', 'Muối ăn', 'Salt', ['muối', 'muối tinh', 'muối hạt', 'muối biển', 'kosher salt'], 'spice', 'g', 1095, 'pantry', [], [0, 0, 0, 0, 0, 0, 0, 38758, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 173468'], '🧂'),
    item('SUGAR', 'Đường cát trắng', 'White sugar', ['đường', 'đường cát', 'đường trắng', 'đường kính', 'granulated sugar'], 'spice', 'g', 1095, 'pantry', [], [387, 0, 0, 0, 99.98, 0, 99.8, 1, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169655'], '🍚'),
    item('BROWN_SUGAR', 'Đường nâu / Đường vàng', 'Brown sugar', ['đường nâu', 'đường vàng', 'đường đỏ', 'brown sugar'], 'spice', 'g', 730, 'pantry', [], [380, 0.12, 0, 0, 98.09, 0, 97.02, 28, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168833'], '🟤'),
    item('ROCK_SUGAR', 'Đường phèn', 'Rock sugar', ['đường phèn', 'rock sugar'], 'spice', 'g', 1095, 'pantry', [], [387, 0, 0, 0, 99.9, 0, 99.9, 1, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC Sucrose Ref'], '💎'),
    item('PALM_SUGAR', 'Đường thốt nốt / Đường dừa', 'Palm sugar', ['đường thốt nốt', 'đường dừa', 'palm sugar', 'coconut sugar'], 'spice', 'g', 730, 'pantry', [], [375, 0.5, 0.1, 0, 93.0, 0, 90.0, 45, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC Palm Sugar Ref'], '🍯'),
    item('HONEY', 'Mật ong', 'Honey', ['mật ong', 'mật ong nguyên chất', 'honey'], 'spice', 'ml', 1095, 'pantry', [], [304, 0.3, 0, 0, 82.4, 0.2, 82.12, 4, 1, 1.42, undefined, undefined, undefined, undefined, 'USDA FDC 169640'], '🍯'),
    item('CORN_SYRUP', 'Siro ngô / Siro gạo', 'Corn or rice syrup', ['siro ngô', 'siro gạo', 'mạch nha', 'corn syrup', 'oligosaccharide'], 'spice', 'ml', 730, 'pantry', [], [286, 0, 0, 0, 77.5, 0, 77.0, 68, 1, 1.38, undefined, undefined, undefined, undefined, 'USDA FDC 168836'], '🍯'),
    item('MSG', 'Bột ngọt (Mì chính)', 'MSG', ['bột ngọt', 'mì chính', 'msg'], 'spice', 'g', 1095, 'pantry', [], [0, 0, 0, 0, 0, 0, 0, 12300, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC Monosodium Glutamate'], '🧂'),
    item('SEASONING_POWDER', 'Hạt nêm (Bột nêm)', 'Seasoning powder', ['hạt nêm', 'bột nêm', 'bột canh', 'hạt nêm gà', 'chicken bouillon powder'], 'spice', 'g', 365, 'pantry', [], [210, 8.0, 2.5, 0.8, 39.0, 0, 12.0, 16500, 1, undefined, undefined, undefined, undefined, undefined, 'VN/Asian Seasoning Powder Avg'], '🧂'),
    item('VEG_SEASONING_POWDER', 'Hạt nêm chay nấm hương', 'Mushroom vegan seasoning powder', ['hạt nêm chay', 'bột nêm chay', 'nêm chay nấm'], 'spice', 'g', 365, 'pantry', [], [195, 5.5, 0.8, 0.2, 41.0, 1.5, 10.0, 15200, 1, undefined, undefined, undefined, undefined, undefined, 'Vegetarian Seasoning Powder Ref'], '🍄'),
    item('BLACK_PEPPER', 'Tiêu đen xay', 'Black pepper', ['tiêu', 'tiêu xay', 'tiêu đen', 'tiêu đen xay', 'tiêu hạt', 'black pepper'], 'spice', 'g', 730, 'pantry', [], [251, 10.39, 3.26, 1.39, 63.95, 25.3, 0.64, 20, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170931'], '⚫'),
    item('WHITE_PEPPER', 'Tiêu trắng xay', 'White pepper', ['tiêu trắng', 'tiêu trắng xay', 'tiêu sọ', 'white pepper'], 'spice', 'g', 730, 'pantry', [], [296, 10.4, 2.12, 0.63, 68.61, 26.2, 0, 5, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170933'], '⚪'),
    item('GREEN_PEPPERCORN', 'Tiêu xanh tươi', 'Green peppercorns', ['tiêu xanh', 'tiêu xanh nguyên nhánh', 'green peppercorn'], 'spice', 'g', 14, 'veg_crisper', [], [95, 4.2, 1.2, 0.4, 21.0, 8.5, 0.3, 12, 0.85, undefined, undefined, undefined, undefined, undefined, 'Green Peppercorn Ref'], '🟢'),
    item('SICHUAN_PEPPER', 'Tiêu Tứ Xuyên (Hoa tiêu)', 'Sichuan peppercorn', ['tiêu tứ xuyên', 'hoa tiêu', 'sichuan peppercorn'], 'spice', 'g', 730, 'pantry', [], [265, 11.0, 4.0, 0.8, 60.0, 24.0, 0, 18, 1, undefined, undefined, undefined, undefined, undefined, 'Spice Reference'], '🌶️'),
    item('CHILI_POWDER', 'Ớt bột / Ớt vảy khô', 'Chili powder / Dried chili', ['ớt bột', 'ớt vảy', 'ớt khô', 'ớt bột paprika', 'ớt bột huế', 'chili flakes'], 'spice', 'g', 730, 'pantry', [], [282, 13.46, 14.28, 2.46, 49.7, 34.8, 7.19, 1640, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 171319'], '🌶️'),
    item('GOCHUGARU', 'Ớt bột Hàn Quốc (Gochugaru)', 'Korean chili flakes', ['gochugaru', 'ớt bột hàn', 'ớt bột hàn quốc'], 'spice', 'g', 365, 'pantry', [], [318, 12.0, 12.0, 1.8, 56.0, 28.0, 10.0, 91, 1, undefined, undefined, undefined, undefined, undefined, 'Korean Chili Flake Ref'], '🌶️'),
    item('SHICHIMI', 'Bột ớt 7 vị Nhật (Shichimi)', 'Shichimi togarashi', ['shichimi', 'shichimi togarashi', 'ớt 7 vị'], 'spice', 'g', 365, 'pantry', ['sesame'], [340, 13.0, 14.0, 2.0, 50.0, 20.0, 6.0, 40, 1, undefined, undefined, undefined, undefined, undefined, 'MEXT Spice Ref'], '🌶️'),
    item('TURMERIC', 'Nghệ tươi / Bột nghệ', 'Turmeric', ['nghệ', 'bột nghệ', 'nghệ tươi', 'turmeric'], 'spice', 'g', 365, 'pantry', [], [312, 9.68, 3.25, 1.84, 67.14, 22.7, 3.21, 27, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 172231'], '🟡'),
    item('CURRY_POWDER', 'Bột cà ri', 'Curry powder', ['bột cà ri', 'cà ri bột', 'curry powder'], 'spice', 'g', 730, 'pantry', [], [325, 14.29, 14.01, 2.24, 55.83, 53.2, 2.76, 52, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170924']),
    item('FIVE_SPICE', 'Ngũ vị hương', 'Chinese five-spice powder', ['ngũ vị hương', 'bột ngũ vị hương', 'five spice'], 'spice', 'g', 730, 'pantry', [], [330, 6.5, 11.5, 1.5, 62.0, 32.0, 2.5, 48, 1, undefined, undefined, undefined, undefined, undefined, 'Five Spice USDA Ref']),
    item('STAR_ANISE', 'Hoa hồi khô', 'Star anise', ['hoa hồi', 'đại hồi', 'star anise'], 'spice', 'g', 1095, 'pantry', [], [337, 17.6, 15.9, 0.6, 50.0, 14.6, 0, 16, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 171316']),
    item('CINNAMON', 'Quế thanh / Bột quế', 'Cinnamon', ['quế', 'quế thanh', 'bột quế', 'cinnamon'], 'spice', 'g', 1095, 'pantry', [], [247, 3.99, 1.24, 0.35, 80.59, 53.1, 2.17, 10, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 171320']),
    item('BLACK_CARDAMOM', 'Thảo quả', 'Black cardamom', ['thảo quả', 'cardamom'], 'spice', 'g', 1095, 'pantry', [], [311, 10.76, 6.7, 0.68, 68.47, 28.0, 0, 18, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170919']),
    item('CORIANDER_SEED', 'Hạt mùi khô', 'Coriander seeds', ['hạt mùi', 'hạt ngò khô', 'coriander seed'], 'spice', 'g', 730, 'pantry', [], [298, 12.37, 17.77, 0.99, 54.99, 41.9, 0, 35, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170922']),
    item('CLOVE', 'Đinh hương', 'Cloves', ['đinh hương', 'clove', 'cloves'], 'spice', 'g', 1095, 'pantry', [], [274, 5.97, 13.0, 3.95, 65.53, 33.9, 2.38, 277, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 171321']),
    item('BAY_LEAF', 'Lá nguyệt quế khô', 'Bay leaves', ['lá nguyệt quế', 'nguyệt quế', 'bay leaf'], 'spice', 'g', 730, 'pantry', [], [313, 7.61, 8.36, 2.28, 74.97, 26.3, 0, 23, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170917']),
    item('OREGANO_HERBS', 'Lá Oregano / Thảo mộc Ý khô', 'Dried Italian herbs / Oregano', ['oregano', 'gia vị ý', 'italian seasoning', 'thyme', 'cỏ xạ hương', 'hương thảo', 'rosemary'], 'spice', 'g', 730, 'pantry', [], [265, 9.0, 4.28, 1.55, 68.92, 42.5, 4.09, 25, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 173475']),
    item('NUTMEG', 'Nhục đậu khấu xay', 'Nutmeg', ['nhục đậu khấu', 'nutmeg'], 'spice', 'g', 730, 'pantry', [], [525, 5.84, 36.31, 25.94, 49.29, 20.8, 2.99, 16, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 171326']),
    item('ANNATTO_OIL', 'Dầu màu điều / Hạt điều màu', 'Annatto oil / seeds', ['dầu màu điều', 'màu điều', 'hạt điều màu', 'annatto'], 'spice', 'ml', 365, 'pantry', [], [884, 0, 100, 14.5, 0, 0, 0, 0, 1, 0.92, undefined, undefined, undefined, undefined, 'Annatto Infused Oil Ref']),
    item('GARLIC_POWDER', 'Bột tỏi', 'Garlic powder', ['bột tỏi', 'garlic powder'], 'spice', 'g', 730, 'pantry', [], [331, 16.55, 0.73, 0.25, 72.73, 9.0, 2.43, 60, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 171325']),

    // =========================================================================
    // 2. SAUCES, CONDIMENTS, VINEGARS & COOKING LIQUIDS
    // =========================================================================
    item('OYSTER_SAUCE', 'Dầu hào', 'Oyster sauce', ['dầu hào', 'sốt hàu', 'tương hàu', 'oyster sauce'], 'spice', 'ml', 365, 'fridge', ['molluscs', 'soybean', 'wheat'], [51, 1.35, 0.25, 0.05, 10.9, 0.1, 8.5, 2733, 1, 1.22, undefined, undefined, undefined, undefined, 'USDA FDC 171369'], '🦪'),
    item('VEG_OYSTER_SAUCE', 'Dầu hào chay nấm đông cô', 'Vegetarian mushroom oyster sauce', ['dầu hào chay', 'sốt hào chay'], 'spice', 'ml', 365, 'fridge', ['soybean', 'wheat'], [60, 1.2, 0.2, 0, 13.5, 0.2, 10.0, 2400, 1, 1.2, undefined, undefined, undefined, undefined, 'Vegan Mushroom Sauce Ref']),
    item('LIGHT_SOY_SAUCE', 'Xì dầu nhạt (Light soy sauce)', 'Light soy sauce', ['xì dầu nhạt', 'nước tương nhạt', 'light soy sauce', 'usukuchi'], 'spice', 'ml', 365, 'pantry', ['soybean', 'wheat'], [53, 8.1, 0.4, 0.05, 4.9, 0.5, 0.4, 5700, 1, 1.18, undefined, undefined, undefined, undefined, 'USDA FDC 174277']),
    item('DARK_SOY_SAUCE', 'Xì dầu đặc (Dark soy sauce)', 'Dark soy sauce', ['xì dầu đặc', 'xì dầu đậm', 'hắc xì dầu', 'nước tương đen', 'dark soy sauce'], 'spice', 'ml', 365, 'pantry', ['soybean', 'wheat'], [96, 6.2, 0.2, 0, 17.5, 0.5, 12.0, 4800, 1, 1.25, undefined, undefined, undefined, undefined, 'Dark Soy Sauce Label Ref']),
    item('VEG_FISH_SAUCE', 'Nước mắm chay', 'Vegetarian fish sauce', ['nước mắm chay', 'mắm chay'], 'spice', 'ml', 365, 'pantry', ['soybean'], [42, 3.0, 0, 0, 7.5, 0, 6.5, 5800, 1, 1.15, undefined, undefined, undefined, undefined, 'Vegetarian Fish Sauce Ref']),
    item('CHILI_SAUCE', 'Tương ớt', 'Chili sauce', ['tương ớt', 'tương ớt thái', 'sriracha', 'sweet chili sauce'], 'spice', 'ml', 365, 'fridge', [], [93, 1.9, 0.9, 0.1, 19.6, 1.6, 15.8, 2050, 1, 1.15, undefined, undefined, undefined, undefined, 'USDA FDC Sriracha Ref']),
    item('CHILI_OIL', 'Sa tế / Dầu ớt Tứ Xuyên', 'Chili oil / Satay sauce', ['sa tế', 'sa tế tôm', 'dầu ớt', 'chili oil', 'lao gan ma'], 'spice', 'ml', 365, 'pantry', [], [710, 2.5, 74.0, 11.0, 8.0, 2.5, 2.0, 1800, 1, 0.95, undefined, undefined, undefined, undefined, 'Chili Oil / Satay Ref']),
    item('KETCHUP', 'Tương cà (Ketchup)', 'Tomato ketchup', ['tương cà', 'ketchup', 'sốt cà chua ketchup'], 'spice', 'ml', 365, 'fridge', [], [112, 1.74, 0.1, 0.02, 27.4, 0.3, 21.3, 907, 1, 1.15, undefined, undefined, undefined, undefined, 'USDA FDC 169076']),
    item('HOISIN_SAUCE', 'Tương đen (Hoisin sauce)', 'Hoisin sauce', ['tương đen', 'tương hoisin', 'tương đen ăn phở', 'hoisin sauce'], 'spice', 'ml', 365, 'fridge', ['soybean', 'wheat', 'sesame'], [220, 3.2, 3.4, 0.6, 44.1, 2.5, 32.0, 1615, 1, 1.24, undefined, undefined, undefined, undefined, 'USDA FDC 171370']),
    item('PLUM_SAUCE_CHUNJANG', 'Tương đậu đen Hàn (Chunjang)', 'Korean black bean paste', ['chunjang', 'tương đen chunjang', 'black bean paste'], 'spice', 'g', 365, 'fridge', ['soybean', 'wheat'], [178, 7.8, 1.8, 0.3, 32.5, 4.0, 11.0, 3100, 1, undefined, undefined, undefined, undefined, undefined, 'Korean Chunjang Ref']),
    item('GOCHUJANG', 'Tương ớt Hàn Quốc (Gochujang)', 'Korean gochujang paste', ['gochujang', 'tương ớt hàn', 'tương ớt hàn quốc'], 'spice', 'g', 365, 'fridge', ['soybean', 'wheat'], [213, 4.5, 1.5, 0.3, 45.0, 4.0, 22.0, 2400, 1, undefined, undefined, undefined, undefined, undefined, 'USDA / Korean Gochujang Ref'], '🌶️'),
    item('DOENJANG', 'Tương đậu tương Hàn (Doenjang)', 'Korean fermented soybean paste', ['doenjang', 'tương đậu hàn', 'tương đậu nành hàn quốc'], 'spice', 'g', 365, 'fridge', ['soybean', 'wheat'], [152, 12.0, 4.5, 0.7, 16.0, 5.0, 3.0, 4400, 1, undefined, undefined, undefined, undefined, undefined, 'Korean Doenjang Ref']),
    item('DOUBANJIANG', 'Tương ớt đậu bản Tứ Xuyên (Doubanjiang)', 'Pixian doubanjiang', ['doubanjiang', 'tương ớt đậu bản', 'tương đậu cay tứ xuyên'], 'spice', 'g', 365, 'fridge', ['soybean', 'wheat'], [95, 5.2, 3.5, 0.5, 10.5, 3.2, 3.0, 5800, 1, undefined, undefined, undefined, undefined, undefined, 'Pixian Doubanjiang Ref']),
    item('FERMENTED_BLACK_BEAN', 'Đậu tương đen lên men (Douchi)', 'Fermented black soybeans', ['douchi', 'đậu tương đen lên men', 'đậu đen muối', 'tàu xì'], 'spice', 'g', 365, 'pantry', ['soybean'], [242, 19.0, 9.0, 1.3, 21.0, 8.0, 2.0, 4900, 1, undefined, undefined, undefined, undefined, undefined, 'Douchi Reference']),
    item('TAHINI_SESAME_PASTE', 'Sốt tương mè (Sesame paste)', 'Chinese sesame paste / Tahini', ['tương mè', 'tương vừng', 'sesame paste', 'tahini'], 'spice', 'g', 365, 'pantry', ['sesame'], [595, 17.0, 53.8, 7.5, 21.2, 9.3, 0.5, 115, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170189']),
    item('SHRIMP_PASTE', 'Mắm tôm / Mắm ruốc', 'Fermented shrimp paste', ['mắm tôm', 'mắm ruốc', 'mắm ruốc huế', 'kapi', 'shrimp paste'], 'spice', 'g', 365, 'fridge', ['shrimp', 'crustaceans'], [98, 17.5, 1.5, 0.4, 3.5, 0, 1.0, 6800, 1, undefined, undefined, undefined, undefined, undefined, 'Asian Shrimp Paste Ref']),
    item('FERMENTED_ANCHOVY_SAUCE', 'Mắm nêm', 'Fermented anchovy sauce', ['mắm nêm', 'mắm cá cơm'], 'spice', 'ml', 365, 'fridge', ['fish'], [65, 9.5, 0.5, 0.1, 5.5, 0, 3.5, 5900, 1, 1.15, undefined, undefined, undefined, undefined, 'VN Mam Nem Ref']),
    item('FERMENTED_RICE_ME', 'Cơm mẻ lên men', 'Fermented rice starter', ['bỗng mẻ', 'cơm mẻ lên men', 'men mẻ'], 'spice', 'g', 60, 'fridge', [], [125, 2.8, 0.3, 0.05, 27.5, 0.4, 2.5, 12, 1, undefined, undefined, undefined, undefined, undefined, 'VN Com Me Ref']),
    item('MAYONNAISE', 'Sốt Mayonnaise', 'Mayonnaise', ['mayonnaise', 'sốt mayonnaise', 'sốt mayo'], 'spice', 'g', 180, 'fridge', ['egg'], [680, 0.96, 74.85, 11.7, 0.57, 0, 0.57, 635, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 171009']),
    item('WORCESTERSHIRE_SAUCE', 'Sốt Worcestershire / Tonkatsu', 'Worcestershire / Tonkatsu sauce', ['worcestershire', 'tonkatsu sauce', 'sốt tonkatsu'], 'spice', 'ml', 730, 'pantry', [], [78, 0, 0, 0, 19.46, 0, 10.03, 980, 1, 1.12, undefined, undefined, undefined, undefined, 'USDA FDC 172227']),
    item('PONZU_SAUCE', 'Nước tương Ponzu chanh Nhật', 'Ponzu citrus soy sauce', ['ponzu', 'nước tương ponzu'], 'spice', 'ml', 365, 'fridge', ['soybean', 'wheat'], [48, 4.2, 0, 0, 7.8, 0, 5.0, 3400, 1, 1.1, undefined, undefined, undefined, undefined, 'MEXT Ponzu Ref']),
    item('RICE_VINEGAR', 'Giấm gạo', 'Rice vinegar', ['giấm', 'dấm', 'giấm gạo', 'dấm gạo', 'giấm ăn', 'rice vinegar'], 'spice', 'ml', 730, 'pantry', [], [18, 0, 0, 0, 0.4, 0, 0.2, 2, 1, 1.01, undefined, undefined, undefined, undefined, 'USDA FDC 172238']),
    item('BLACK_VINEGAR', 'Giấm đen Trấn Giang', 'Chinese black vinegar', ['giấm đen', 'giấm trấn giang', 'chinkiang vinegar'], 'spice', 'ml', 730, 'pantry', ['wheat'], [32, 0.5, 0, 0, 5.8, 0, 2.5, 180, 1, 1.03, undefined, undefined, undefined, undefined, 'Chinkiang Black Vinegar Ref']),
    item('BALSAMIC_VINEGAR', 'Giấm Balsamic Ý', 'Balsamic vinegar', ['giấm balsamic', 'balsamic vinegar'], 'spice', 'ml', 1095, 'pantry', ['sulphites'], [88, 0.49, 0, 0, 17.03, 0, 14.95, 23, 1, 1.06, undefined, undefined, undefined, undefined, 'USDA FDC 173470']),
    item('TAMARIND', 'Me chín / Cơm me vắt', 'Tamarind pulp', ['me chín', 'cơm me chín', 'me vắt', 'nước cốt me', 'tamarind'], 'fruit', 'g', 180, 'fridge', [], [239, 2.8, 0.6, 0.27, 62.5, 5.1, 38.8, 28, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169918']),
    item('SHAOXING_WINE', 'Rượu Thiệu Hưng', 'Shaoxing cooking wine', ['rượu thiệu hưng', 'rượu nấu ăn trung quốc', 'shaoxing wine'], 'spice', 'ml', 730, 'pantry', ['wheat'], [105, 0.4, 0, 0, 4.5, 0, 1.5, 8, 1, 0.99, undefined, undefined, undefined, undefined, 'Shaoxing Wine Ref']),
    item('SAKE', 'Rượu Sake Nhật Bản', 'Cooking sake', ['rượu sake', 'sake', 'rượu trắng', 'rượu gạo', 'rượu nếp', 'rượu nấu ăn'], 'spice', 'ml', 730, 'pantry', [], [103, 0.4, 0, 0, 4.9, 0, 1.2, 2, 1, 0.99, undefined, undefined, undefined, undefined, 'MEXT Sake 16021']),
    item('CURRY_ROUX_BLOCK', 'Viên cà ri Nhật', 'Japanese curry roux block', ['viên cà ri nhật', 'bánh cà ri nhật', 'curry roux'], 'spice', 'g', 365, 'pantry', ['wheat', 'soybean'], [512, 6.8, 34.5, 16.0, 43.2, 4.5, 12.0, 3900, 1, undefined, undefined, undefined, undefined, undefined, 'MEXT Curry Roux Ref']),
    item('TOM_YUM_PASTE', 'Sốt Tom Yum / Gia vị lẩu Thái', 'Tom Yum paste', ['tom yum paste', 'sốt tom yum', 'gia vị lẩu thái'], 'spice', 'g', 365, 'fridge', ['shrimp', 'crustaceans'], [235, 3.2, 14.5, 2.5, 22.8, 2.5, 14.0, 3600, 1, undefined, undefined, undefined, undefined, undefined, 'Thai Tom Yum Paste Ref']),
    item('THAI_CURRY_PASTE', 'Sốt cà ri xanh / đỏ Thái', 'Thai green or red curry paste', ['cà ri xanh', 'sốt cà ri xanh', 'bột cà ri xanh', 'cà ri đỏ', 'curry paste'], 'spice', 'g', 365, 'fridge', ['shrimp', 'crustaceans'], [128, 3.0, 5.2, 1.2, 17.5, 4.5, 4.0, 3200, 1, undefined, undefined, undefined, undefined, undefined, 'Thai Curry Paste Ref']),
    item('COCONUT_MILK', 'Nước cốt dừa', 'Coconut milk', ['nước cốt dừa', 'cốt dừa', 'coconut milk'], 'other', 'ml', 180, 'pantry', [], [230, 2.29, 23.84, 21.14, 5.54, 2.2, 3.34, 15, 1, 1.0, undefined, undefined, undefined, undefined, 'USDA FDC 170172'], '🥥'),
    item('COCONUT_WATER', 'Nước dừa tươi', 'Coconut water', ['nước dừa tươi', 'nước dừa', 'coconut water'], 'other', 'ml', 7, 'fridge', [], [19, 0.72, 0.2, 0.18, 3.71, 1.1, 2.61, 105, 1, 1.01, undefined, undefined, undefined, undefined, 'USDA FDC 170174'], '🥥'),
    item('CHICKEN_BROTH', 'Nước dùng gà', 'Chicken broth', ['nước dùng gà', 'nước luộc gà', 'chicken broth', 'chicken stock'], 'other', 'ml', 5, 'fridge', [], [15, 1.4, 0.6, 0.15, 0.8, 0, 0.4, 240, 1, 1.0, undefined, undefined, undefined, undefined, 'USDA FDC 172883']),
    item('BEEF_BROTH', 'Nước dùng bò / Hầm xương', 'Beef broth', ['nước dùng bò', 'nước xương bò', 'beef broth'], 'other', 'ml', 5, 'fridge', [], [17, 1.8, 0.6, 0.25, 0.9, 0, 0.3, 250, 1, 1.0, undefined, undefined, undefined, undefined, 'USDA FDC 171593']),
    item('VEG_BROTH', 'Nước dùng rau củ / Nấm', 'Vegetable broth', ['nước dùng rau củ', 'nước dùng nấm', 'nước ngâm nấm hương', 'vegetable broth'], 'other', 'ml', 5, 'fridge', [], [12, 0.4, 0.1, 0, 2.2, 0.2, 1.0, 210, 1, 1.0, undefined, undefined, undefined, undefined, 'USDA FDC 171595']),
    item('ANCHOVY_KOMBU_BROTH', 'Nước dùng cá cơm tảo bẹ Hàn', 'Anchovy kelp stock', ['nước dùng cá cơm', 'nước dùng cá cơm tảo bẹ', 'anchovy stock'], 'other', 'ml', 5, 'fridge', ['fish'], [10, 1.2, 0.1, 0, 0.8, 0, 0, 260, 1, 1.0, undefined, undefined, undefined, undefined, 'Korean Anchovy Kelp Stock Ref']),
    item('COOKING_WATER', 'Nước lọc', 'Water', ['nước', 'nước lọc', 'nước sạch', 'nước sôi', 'nước nóng', 'nước ấm', 'nước luộc mì', 'water', 'đá viên'], 'other', 'ml', 365, 'pantry', [], [0, 0, 0, 0, 0, 0, 0, 0, 1, 1.0, undefined, undefined, undefined, undefined, 'USDA FDC 173647'], '💧'),

    // =========================================================================
    // 3. FATS, STARCHES & FLOURS
    // =========================================================================
    item('LARD', 'Mỡ heo thắng (Mỡ nước / Tóp mỡ)', 'Pork lard / fat', ['mỡ heo', 'mỡ lợn', 'mỡ gà', 'tóp mỡ', 'lard'], 'meat', 'g', 60, 'fridge', ['pork'], [902, 0, 100, 39.2, 0, 0, 0, 0, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 171401']),
    item('PEANUT_BUTTER', 'Bơ đậu phộng', 'Peanut butter', ['bơ đậu phộng', 'bơ lạc', 'peanut butter'], 'other', 'g', 365, 'pantry', ['peanut'], [588, 25.09, 50.39, 10.3, 19.56, 6.0, 9.22, 429, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 172470']),
    item('CORNSTARCH', 'Bột bắp (Bột ngô)', 'Cornstarch', ['bột bắp', 'bột ngô', 'cornstarch'], 'grain', 'g', 730, 'pantry', [], [381, 0.26, 0.05, 0.01, 91.27, 0.9, 0, 9, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169698']),
    item('TAPIOCA_STARCH', 'Bột năng', 'Tapioca starch', ['bột năng', 'bột sắn', 'tapioca starch'], 'grain', 'g', 730, 'pantry', [], [358, 0.19, 0.02, 0.01, 88.69, 0.9, 3.35, 1, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169717']),
    item('POTATO_STARCH', 'Tinh bột khoai tây', 'Potato starch', ['tinh bột khoai tây', 'bột khoai tây', 'potato starch'], 'grain', 'g', 730, 'pantry', [], [331, 0.1, 0.1, 0, 83.0, 0, 0, 12, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC Potato Starch']),
    item('ALL_PURPOSE_FLOUR', 'Bột mì đa dụng', 'All-purpose wheat flour', ['bột mì', 'bột mì đa dụng', 'bột mì 00', 'wheat flour'], 'grain', 'g', 365, 'pantry', ['wheat'], [364, 10.33, 0.98, 0.16, 76.31, 2.7, 0.27, 2, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169761']),
    item('RICE_FLOUR', 'Bột gạo', 'Rice flour', ['bột gạo', 'bột gạo tẻ', 'rice flour'], 'grain', 'g', 365, 'pantry', [], [366, 5.95, 1.42, 0.39, 80.13, 2.4, 0.12, 0, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169714']),
    item('CRISPY_BATTER_MIX', 'Bột chiên giòn / Bột chiên xù', 'Crispy coating flour / Panko', ['bột chiên giòn', 'bột chiên xù', 'panko', 'tempura flour'], 'grain', 'g', 365, 'pantry', ['wheat'], [358, 9.5, 1.5, 0.3, 76.0, 2.5, 2.0, 620, 1, undefined, undefined, undefined, undefined, undefined, 'Panko / Batter Mix Ref']),
    item('BAKING_SODA', 'Baking soda / Bột nở', 'Baking soda / Baking powder', ['baking soda', 'bột nở', 'baking powder'], 'other', 'g', 730, 'pantry', [], [0, 0, 0, 0, 0, 0, 0, 27360, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 175039']),

    // =========================================================================
    // 4. HERBS, AROMATICS & FRESH SPICES
    // =========================================================================
    item('SHALLOT', 'Hành tím (Hành khô)', 'Shallots', ['hành tím', 'hành khô', 'hành tím băm', 'hành phi', 'shallot', 'hẹ tây'], 'spice', 'g', 30, 'pantry', [], [72, 2.5, 0.1, 0.02, 16.8, 3.2, 7.87, 12, 0.88, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170499'], '🧅'),
    item('RED_ONION', 'Hành tây tím', 'Red onion', ['hành tây tím', 'red onion'], 'vegetable', 'g', 20, 'pantry', [], [40, 1.1, 0.1, 0.04, 9.34, 1.7, 4.24, 4, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170000']),
    item('LEEK', 'Tỏi tây (Hành boa-rô)', 'Leek / Tokyo Negi', ['tỏi tây', 'hành boa rô', 'hành boa-rô', 'hành negi', 'leek'], 'vegetable', 'g', 10, 'veg_crisper', [], [61, 1.5, 0.3, 0.04, 14.15, 1.8, 3.9, 20, 0.8, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169246']),
    item('CILANTRO', 'Ngò rí (Rau mùi ta)', 'Cilantro / Coriander', ['ngò rí', 'rau mùi', 'rau mùi ta', 'rễ ngò rí', 'rễ mùi', 'cilantro', 'coriander'], 'vegetable', 'g', 5, 'veg_crisper', [], [23, 2.13, 0.52, 0.01, 3.67, 2.8, 0.87, 46, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169997'], '🌿'),
    item('CULANTRO', 'Ngò gai (Mùi tàu)', 'Culantro / Sawtooth coriander', ['ngò gai', 'mùi tàu', 'rau mùi tàu', 'culantro'], 'vegetable', 'g', 5, 'veg_crisper', [], [26, 2.2, 0.4, 0.02, 4.3, 2.9, 0.8, 38, 0.9, undefined, undefined, undefined, undefined, undefined, 'VN Culinary Herb Ref']),
    item('RICE_PADDY_HERB', 'Rau ngổ (Ngò ôm)', 'Rice paddy herb', ['rau ngổ', 'ngò ôm', 'rau om'], 'vegetable', 'g', 4, 'veg_crisper', [], [22, 2.0, 0.3, 0, 3.8, 2.4, 0.6, 30, 0.9, undefined, undefined, undefined, undefined, undefined, 'VN Herb Ref']),
    item('DILL', 'Thì là tươi', 'Fresh dill', ['thì là', 'thìa là', 'dill'], 'vegetable', 'g', 5, 'veg_crisper', [], [43, 3.46, 1.12, 0.06, 7.02, 2.1, 0, 61, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 172233']),
    item('VIETNAMESE_CORIANDER', 'Rau răm', 'Vietnamese coriander', ['rau răm', 'laksa leaf'], 'vegetable', 'g', 5, 'veg_crisper', [], [28, 2.4, 0.4, 0.04, 4.8, 2.6, 0.5, 25, 0.9, undefined, undefined, undefined, undefined, undefined, 'VN Rau Ram Ref']),
    item('THAI_BASIL', 'Húng quế (Quế vị / Húng chó)', 'Thai / Holy basil', ['húng quế', 'rau quế', 'húng quế thái', 'húng quế thánh', 'holy basil', 'thai basil'], 'vegetable', 'g', 5, 'veg_crisper', [], [23, 3.15, 0.64, 0.04, 2.65, 1.6, 0.3, 4, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 172232']),
    item('SWEET_BASIL_IT', 'Lá húng quế Tây (Sweet basil)', 'Italian sweet basil', ['lá húng quế tươi', 'húng quế tây', 'basil', 'sweet basil'], 'vegetable', 'g', 5, 'veg_crisper', [], [23, 3.15, 0.64, 0.04, 2.65, 1.6, 0.3, 4, 0.92, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 172232']),
    item('PERILLA', 'Lá tía tô', 'Perilla leaves', ['tía tô', 'lá tía tô', 'perilla', 'shiso', 'lá vừng hàn'], 'vegetable', 'g', 5, 'veg_crisper', [], [37, 3.8, 0.6, 0.1, 5.5, 4.2, 0.4, 10, 0.9, undefined, undefined, undefined, undefined, undefined, 'MEXT Shiso Ref']),
    item('MARJORAM_MINT', 'Húng lủi / Kinh giới / Bạc hà', 'Mint / Vietnamese balm', ['húng lủi', 'kinh giới', 'húng láng', 'bạc hà', 'rau thơm', 'mint'], 'vegetable', 'g', 5, 'veg_crisper', [], [44, 3.29, 0.73, 0.19, 8.41, 6.8, 0, 30, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 173474']),
    item('CHIVES', 'Hẹ lá tươi', 'Garlic chives', ['hẹ', 'lá hẹ', 'hẹ tỏi', 'chives'], 'vegetable', 'g', 5, 'veg_crisper', [], [30, 3.27, 0.73, 0.15, 4.35, 2.5, 1.85, 3, 0.92, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169994']),
    item('PARSLEY', 'Ngò tây (Parsley)', 'Fresh parsley', ['ngò tây', 'mùi tây', 'parsley'], 'vegetable', 'g', 7, 'veg_crisper', [], [36, 2.97, 0.79, 0.13, 6.33, 3.3, 0.85, 56, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170416']),
    item('GALANGAL', 'Củ riềng tươi', 'Fresh galangal', ['riềng', 'củ riềng', 'riềng băm', 'galangal'], 'spice', 'g', 14, 'veg_crisper', [], [71, 1.2, 0.4, 0.1, 16.0, 2.2, 1.5, 14, 0.88, undefined, undefined, undefined, undefined, undefined, 'USDA / SE Asian Galangal Ref']),
    item('KAFFIR_LIME_LEAF', 'Lá chanh tươi / Lá chanh Kaffir', 'Lime / Kaffir lime leaves', ['lá chanh', 'lá chanh kaffir', 'lá chanh makrut', 'kaffir lime leaf'], 'spice', 'g', 14, 'veg_crisper', [], [45, 2.0, 0.5, 0.1, 9.0, 4.0, 0.5, 5, 0.95, undefined, undefined, undefined, undefined, undefined, 'Citrus Leaf Culinary Ref']),
    item('LEMON', 'Chanh vàng tươi (Lemon)', 'Fresh lemon', ['chanh vàng', 'vỏ chanh vàng', 'lemon'], 'fruit', 'piece', 14, 'veg_crisper', [], [29, 1.1, 0.3, 0.04, 9.32, 2.8, 2.5, 2, 0.55, undefined, 100, undefined, undefined, undefined, 'USDA FDC 167746'], '🍋'),

    // =========================================================================
    // 5. MEATS, POULTRY & OFFAL
    // =========================================================================
    item('PORK_SHOULDER', 'Thịt nạc vai / Nạc dăm heo', 'Pork shoulder / collar', ['nạc vai', 'thịt vai', 'nạc dăm', 'thịt nạc vai', 'thịt heo', 'pork shoulder'], 'meat', 'g', 3, 'chilled', ['pork'], [236, 17.4, 18.0, 6.4, 0, 0, 0, 65, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 167847'], '🥩'),
    item('PORK_CHOP', 'Sườn cốt lết / Thăn heo', 'Pork chop / loin', ['cốt lết', 'sườn cốt lết', 'thịt thăn heo', 'nạc thăn', 'pork loin'], 'meat', 'g', 3, 'chilled', ['pork'], [143, 20.7, 6.0, 2.1, 0, 0, 0, 52, 0.85, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 167827'], '🥩'),
    item('PORK_HOCK', 'Chân giò heo / Bắp giò', 'Pork hock / shank', ['chân giò', 'giò heo', 'bắp giò', 'móng giò'], 'meat', 'g', 3, 'chilled', ['pork'], [248, 17.2, 19.5, 7.0, 0, 0, 0, 68, 0.62, undefined, undefined, undefined, undefined, undefined, 'USDA FDC Pork Leg Ref']),
    item('PORK_BONE', 'Xương ống heo (Ninh nước dùng)', 'Pork soup bones', ['xương ống', 'xương ống heo', 'xương heo', 'xương chân giò'], 'meat', 'g', 3, 'chilled', ['pork'], [150, 14.0, 10.0, 3.6, 0, 0, 0, 60, 0.25, undefined, undefined, undefined, undefined, undefined, 'Pork Bone Stock Extraction Ref']),
    item('PORK_EAR', 'Tai heo', 'Pork ear', ['tai heo', 'tai lợn'], 'meat', 'g', 3, 'chilled', ['pork'], [234, 22.5, 15.1, 5.4, 0, 0, 0, 185, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 167879']),
    item('PORK_LIVER', 'Gan heo / Pate', 'Pork liver / Pate', ['gan heo', 'gan lợn', 'pate', 'pate gan'], 'meat', 'g', 2, 'chilled', ['pork'], [134, 21.39, 3.65, 1.17, 2.47, 0, 0, 87, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 167871']),
    item('PORK_SAUSAGE_GIO', 'Giò lụa / Chả lụa / Nem chua', 'Vietnamese pork roll (Giò lụa)', ['giò lụa', 'chả lụa', 'chả cốm', 'chả Huế', 'giò thủ'], 'meat', 'g', 7, 'fridge', ['pork'], [165, 18.5, 9.2, 3.3, 2.0, 0, 0.5, 650, 1, undefined, undefined, undefined, undefined, undefined, 'NIN VN Gio Lua Ref']),
    item('CHINESE_SAUSAGE', 'Lạp xưởng / Xúc xích', 'Chinese sausage / Pork sausage', ['lạp xưởng', 'xúc xích', 'sausage'], 'meat', 'g', 30, 'fridge', ['pork'], [435, 16.0, 36.0, 13.0, 11.5, 0, 9.5, 1180, 1, undefined, undefined, undefined, undefined, undefined, 'USDA / Chinese Sausage Ref']),
    item('BEEF_BRISKET', 'Nạm bò / Gầu bò', 'Beef brisket / shank', ['nạm bò', 'gầu bò', 'thịt bò vai', 'gân bò', 'beef brisket'], 'meat', 'g', 3, 'chilled', ['beef'], [215, 18.8, 15.0, 6.2, 0, 0, 0, 62, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170198'], '🥩'),
    item('BEEF_RIB_BONE', 'Xương bò / Sườn bò', 'Beef bones / Short ribs', ['xương bò', 'sườn bò', 'xương sườn bò', 'beef bone'], 'meat', 'g', 3, 'chilled', ['beef'], [240, 17.5, 18.5, 7.8, 0, 0, 0, 60, 0.45, undefined, undefined, undefined, undefined, undefined, 'USDA Beef Rib / Bone Ref']),
    item('CHICKEN_WHOLE', 'Thịt gà ta nguyên con / Chặt miếng', 'Whole chicken (bone-in)', ['gà ta', 'gà nguyên con', 'gà miếng', 'thịt gà', 'xương gà'], 'meat', 'g', 2, 'chilled', ['chicken'], [215, 18.6, 15.06, 4.31, 0, 0, 0, 70, 0.68, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 171077'], '🍗'),
    item('CHICKEN_WING', 'Cánh gà', 'Chicken wings', ['cánh gà', 'cánh gà khúc giữa'], 'meat', 'g', 2, 'chilled', ['chicken'], [222, 18.3, 15.9, 4.46, 0, 0, 0, 73, 0.65, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 171080'], '🍗'),

    // =========================================================================
    // 6. SEAFOOD & EGGS
    // =========================================================================
    item('WHITE_FISH_FILLET', 'Phi lê cá thịt trắng (Chẽm, basa, thu)', 'White fish fillet', ['cá phi lê', 'cá chẽm', 'cá thu', 'cá kiếm', 'cá thác lác', 'cá basa', 'white fish'], 'seafood', 'g', 2, 'chilled', ['fish'], [112, 20.5, 2.8, 0.7, 0, 0, 0, 58, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 175148'], '🐟'),
    item('DRIED_SHRIMP', 'Tôm khô', 'Dried shrimp', ['tôm khô', 'tép khô', 'dried shrimp'], 'seafood', 'g', 180, 'pantry', ['shrimp', 'crustaceans'], [295, 62.0, 3.2, 0.7, 2.5, 0, 0, 2240, 1, undefined, undefined, undefined, undefined, undefined, 'USDA / Asian Dried Shrimp Ref']),
    item('DRIED_ANCHOVY', 'Cá cơm khô', 'Dried anchovy', ['cá cơm khô', 'cá khô', 'dried anchovy'], 'seafood', 'g', 180, 'pantry', ['fish'], [278, 56.0, 4.5, 1.2, 0.5, 0, 0, 1950, 1, undefined, undefined, undefined, undefined, undefined, 'MEXT Niboshi Ref']),
    item('BONITO_FLAKES', 'Cá bào khô (Katsuobushi)', 'Bonito flakes (Katsuobushi)', ['katsuobushi', 'cá bào', 'cá bào khô'], 'seafood', 'g', 180, 'pantry', ['fish'], [352, 77.1, 2.9, 0.8, 0.4, 0, 0, 130, 1, undefined, undefined, undefined, undefined, undefined, 'MEXT Katsuobushi 10099']),
    item('DRIED_SQUID', 'Mực khô', 'Dried squid', ['mực khô', 'khô mực'], 'seafood', 'g', 180, 'pantry', ['squid', 'molluscs'], [334, 69.2, 4.3, 1.0, 0.8, 0, 0, 880, 1, undefined, undefined, undefined, undefined, undefined, 'MEXT Surume Ref']),
    item('FISH_CAKE', 'Chả cá / Chả cua / Thanh cua', 'Fish cake / Surimi / Kamaboko', ['chả cá', 'chả cua', 'chả cá hàn quốc', 'kamaboko', 'thanh cua', 'kanikama'], 'seafood', 'g', 7, 'fridge', ['fish'], [115, 12.2, 2.4, 0.5, 10.5, 0.2, 2.5, 680, 1, undefined, undefined, undefined, undefined, undefined, 'USDA / MEXT Fish Cake Ref']),
    item('QUAIL_EGG', 'Trứng cút', 'Quail eggs', ['trứng cút', 'trứng chim cút'], 'egg', 'piece', 14, 'fridge', ['egg'], [158, 13.05, 11.09, 3.56, 0.41, 0, 0.4, 141, 0.85, undefined, 10, undefined, undefined, undefined, 'USDA FDC 172191'], '🥚'),
    item('DUCK_EGG', 'Trứng vịt', 'Duck eggs', ['trứng vịt', 'trứng vịt tươi'], 'egg', 'piece', 14, 'fridge', ['egg'], [185, 12.81, 13.77, 3.68, 1.45, 0, 0.93, 146, 0.88, undefined, 68, undefined, undefined, undefined, 'USDA FDC 172189'], '🥚'),
    item('SALTED_EGG', 'Trứng muối', 'Salted duck egg', ['trứng muối', 'lòng đỏ trứng muối'], 'egg', 'piece', 30, 'fridge', ['egg'], [190, 13.0, 14.2, 4.0, 1.5, 0, 0.5, 1650, 0.88, undefined, 65, undefined, undefined, undefined, 'Salted Duck Egg Ref'], '🥚'),

    // =========================================================================
    // 7. CHEESES, DAIRY & SOY PRODUCTS
    // =========================================================================
    item('PARMESAN_CHEESE', 'Phô mai Parmesan / Parmigiano bào', 'Parmesan cheese', ['parmesan', 'parmigiano', 'phô mai parmesan', 'phô mai bào'], 'dairy', 'g', 60, 'fridge', ['milk'], [431, 38.46, 28.61, 17.3, 4.06, 0, 0.9, 1529, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170848'], '🧀'),
    item('PECORINO_CHEESE', 'Phô mai Pecorino Romano', 'Pecorino Romano cheese', ['pecorino', 'pecorino romano'], 'dairy', 'g', 60, 'fridge', ['milk'], [387, 31.8, 26.9, 17.5, 3.6, 0, 0.5, 1200, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC Pecorino Ref']),
    item('MOZZARELLA_CHEESE', 'Phô mai Mozzarella', 'Mozzarella cheese', ['mozzarella', 'phô mai mozzarella'], 'dairy', 'g', 14, 'fridge', ['milk'], [280, 27.5, 17.1, 10.9, 3.1, 0, 1.03, 627, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170845']),
    item('RICOTTA_CHEESE', 'Phô mai Ricotta / Feta', 'Ricotta / Feta cheese', ['ricotta', 'feta', 'phô mai ricotta', 'phô mai feta'], 'dairy', 'g', 10, 'fridge', ['milk'], [174, 11.26, 12.98, 8.29, 3.04, 0, 0.27, 84, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170853']),
    item('SOFT_TOFU', 'Đậu phụ non (Silken tofu)', 'Silken soft tofu', ['đậu phụ non', 'đậu hũ non', 'đậu phụ lụa', 'silken tofu'], 'vegetable', 'g', 5, 'fridge', ['soybean'], [55, 4.8, 2.7, 0.4, 2.9, 0.2, 0.8, 36, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 172476']),
    item('EGG_TOFU', 'Đậu phụ trứng', 'Egg tofu', ['đậu phụ trứng', 'đậu hũ trứng', 'egg tofu'], 'vegetable', 'g', 5, 'fridge', ['soybean', 'egg'], [78, 5.2, 4.5, 1.1, 3.8, 0.2, 0.5, 195, 1, undefined, undefined, undefined, undefined, undefined, 'Asian Egg Tofu Ref']),
    item('FRIED_TOFU', 'Đậu phụ chiên sẵn / Đậu hũ ky', 'Fried tofu / Tofu skin', ['đậu hũ chiên', 'đậu phụ chiên', 'váng đậu', 'tàu hũ ky'], 'vegetable', 'g', 5, 'fridge', ['soybean'], [271, 17.2, 20.2, 3.1, 10.5, 2.5, 0.6, 16, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 172472']),

    // =========================================================================
    // 8. VEGETABLES, MUSHROOMS, SEAWEED & PLANT PROTEINS
    // =========================================================================
    item('BOK_CHOY', 'Cải thìa / Cải chíp', 'Bok choy', ['cải thìa', 'cải chíp', 'cải ngọt', 'cải bẹ xanh', 'cải làn', 'cải rổ', 'bok choy'], 'vegetable', 'g', 5, 'veg_crisper', [], [13, 1.5, 0.2, 0.03, 2.18, 1.0, 1.18, 65, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170390'], '🥬'),
    item('NAPA_CABBAGE', 'Cải thảo', 'Napa cabbage', ['cải thảo', 'bắp cải thảo', 'napa cabbage'], 'vegetable', 'g', 10, 'veg_crisper', [], [12, 1.1, 0.2, 0.04, 2.23, 1.2, 1.4, 11, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169977']),
    item('LETTUCE', 'Xà lách tươi / Rau sống ăn kèm', 'Lettuce / Salad greens', ['xà lách', 'rau sống', 'xà lách xoong', 'rau ăn kèm', 'lettuce'], 'vegetable', 'g', 5, 'veg_crisper', [], [15, 1.36, 0.15, 0.02, 2.87, 1.3, 0.78, 28, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169247'], '🥬'),
    item('GARLAND_CHRYSANTHEMUM', 'Rau cải cúc (Tần ô) / Rau đay / Mồng tơi', 'Chrysanthemum greens / Malabar spinach', ['cải cúc', 'tần ô', 'rau đay', 'mồng tơi', 'rau cần nước', 'rau nhút'], 'vegetable', 'g', 4, 'veg_crisper', [], [19, 1.8, 0.2, 0.03, 3.4, 2.1, 0.4, 79, 0.85, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169249']),
    item('DAIKON', 'Củ cải trắng', 'Daikon radish', ['củ cải trắng', 'củ cải', 'củ cải hàn', 'daikon'], 'vegetable', 'g', 14, 'veg_crisper', [], [18, 0.6, 0.1, 0.03, 4.1, 1.6, 2.5, 21, 0.85, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168452']),
    item('PICKLED_RADISH', 'Củ cải muối vàng (Danmuji)', 'Pickled yellow radish', ['danmuji', 'củ cải muối', 'củ cải vàng', 'fukujinzuke'], 'vegetable', 'g', 60, 'fridge', [], [24, 0.5, 0.1, 0, 5.2, 1.0, 3.8, 690, 1, undefined, undefined, undefined, undefined, undefined, 'MEXT Takuan Ref']),
    item('EGGPLANT', 'Cà tím', 'Eggplant', ['cà tím', 'cà tím dài', 'eggplant'], 'vegetable', 'g', 7, 'veg_crisper', [], [25, 0.98, 0.18, 0.03, 5.88, 3.0, 3.53, 2, 0.88, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169228'], '🍆'),
    item('OKRA', 'Đậu bắp', 'Okra', ['đậu bắp', 'okra'], 'vegetable', 'g', 5, 'veg_crisper', [], [33, 1.93, 0.19, 0.05, 7.45, 3.2, 1.48, 7, 0.88, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169260']),
    item('TARO_STEM', 'Dọc mùng (Bạc hà nấu canh)', 'Taro stem / Elephant ear stem', ['dọc mùng', 'bạc hà dọc mùng'], 'vegetable', 'g', 5, 'veg_crisper', [], [14, 0.5, 0.1, 0, 3.0, 1.4, 0.5, 8, 0.8, undefined, undefined, undefined, undefined, undefined, 'NIN VN Doc Mung Ref']),
    item('LUFFA', 'Mướp hương', 'Luffa / Angled gourd', ['mướp hương', 'mướp ngọt', 'luffa'], 'vegetable', 'g', 5, 'veg_crisper', [], [20, 1.2, 0.2, 0.03, 4.35, 1.1, 1.5, 3, 0.82, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168421']),
    item('GREEN_BEANS', 'Đậu cô ve / Đậu đũa / Đậu Hà Lan', 'Green beans / Snow peas', ['đậu cô ve', 'đậu que', 'đậu đũa', 'đậu hà lan', 'snap peas', 'đậu non'], 'vegetable', 'g', 6, 'veg_crisper', [], [31, 1.83, 0.22, 0.05, 6.97, 2.7, 3.26, 6, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169961']),
    item('BABY_CORN', 'Ngô non (Bắp non)', 'Baby corn', ['ngô non', 'bắp non', 'ngô bao tử', 'baby corn'], 'vegetable', 'g', 5, 'veg_crisper', [], [26, 2.2, 0.2, 0.03, 5.2, 2.0, 1.5, 12, 1, undefined, undefined, undefined, undefined, undefined, 'Baby Corn Ref']),
    item('SWEET_CORN', 'Bắp ngọt (Ngô ngọt)', 'Sweet corn kernels', ['bắp ngọt', 'ngô ngọt', 'hạt ngô'], 'vegetable', 'g', 5, 'veg_crisper', [], [86, 3.27, 1.35, 0.2, 18.7, 2.0, 6.26, 15, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169998']),
    item('SWEET_POTATO', 'Khoai lang / Khoai môn', 'Sweet potato / Taro', ['khoai lang', 'khoai môn', 'sweet potato'], 'vegetable', 'g', 21, 'pantry', [], [86, 1.57, 0.05, 0.02, 20.12, 3.0, 4.18, 55, 0.85, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168482'], '🍠'),
    item('JICAMA', 'Củ đậu (Củ sắn nước) / Su hào', 'Jicama / Kohlrabi', ['củ đậu', 'củ sắn', 'su hào', 'jicama', 'kohlrabi'], 'vegetable', 'g', 14, 'veg_crisper', [], [38, 0.72, 0.09, 0.02, 8.82, 4.9, 1.8, 4, 0.85, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170072']),
    item('LOTUS_ROOT', 'Củ sen tươi', 'Lotus root', ['củ sen', 'ngó sen', 'lotus root'], 'vegetable', 'g', 7, 'veg_crisper', [], [74, 2.6, 0.1, 0.03, 17.23, 4.9, 0.5, 40, 0.85, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169248']),
    item('LOTUS_SEED', 'Hạt sen tươi / khô', 'Lotus seeds', ['hạt sen', 'hạt sen tươi', 'hạt sen khô'], 'vegetable', 'g', 180, 'pantry', [], [89, 4.13, 0.53, 0.1, 17.28, 1.8, 1.2, 1, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170148 Fresh']),
    item('BANANA_BLOSSOM', 'Hoa chuối bào / Chuối xanh', 'Banana blossom / Green banana', ['hoa chuối', 'bắp chuối', 'chuối xanh', 'chuối chát'], 'vegetable', 'g', 4, 'veg_crisper', [], [51, 1.6, 0.6, 0.1, 9.9, 5.7, 0.5, 4, 0.85, undefined, undefined, undefined, undefined, undefined, 'SE Asian Banana Blossom Ref']),
    item('BAMBOO_SHOOT', 'Măng tươi / Măng chua', 'Bamboo shoots', ['măng chua', 'măng tươi', 'măng', 'bamboo shoot'], 'vegetable', 'g', 14, 'fridge', [], [27, 2.6, 0.3, 0.07, 5.2, 2.2, 3.0, 4, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169958']),
    item('CAULIFLOWER', 'Súp lơ trắng (Bông cải trắng)', 'Cauliflower', ['súp lơ trắng', 'bông cải trắng', 'cauliflower'], 'vegetable', 'g', 7, 'veg_crisper', [], [25, 1.92, 0.28, 0.13, 4.97, 2.0, 1.91, 30, 0.82, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169986']),
    item('WATER_CHESTNUT', 'Củ năng (Củ mã thầy)', 'Water chestnuts', ['củ năng', 'mã thầy', 'water chestnut'], 'vegetable', 'g', 14, 'veg_crisper', [], [97, 1.4, 0.1, 0.02, 23.94, 3.0, 4.8, 14, 0.82, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169294']),
    item('SOUR_STARFRUIT', 'Khế chua / Lá giang / Sấu', 'Sour starfruit / Giang leaves', ['khế chua', 'lá giang', 'quả sấu', 'dọc'], 'fruit', 'g', 7, 'veg_crisper', [], [31, 1.04, 0.33, 0.02, 6.73, 2.8, 3.98, 2, 0.95, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 171711']),
    item('GREEN_MANGO_PAPAYA', 'Xoài xanh / Đu đủ xanh bào sợi', 'Green mango or green papaya', ['đu đủ xanh', 'xoài xanh', 'gỏi đu đủ'], 'fruit', 'g', 7, 'veg_crisper', [], [43, 0.5, 0.25, 0.05, 10.8, 1.7, 7.8, 8, 0.82, undefined, undefined, undefined, undefined, undefined, 'USDA FDC Green Papaya Ref']),
    item('CANNED_TOMATO', 'Cà chua nghiền / Đóng hộp Ý', 'Canned crushed tomatoes / Passata', ['passata', 'cà chua đóng hộp', 'cà chua pelati', 'cà chua xay nhuyễn', 'sốt cà chua'], 'vegetable', 'g', 365, 'pantry', [], [32, 1.64, 0.25, 0.03, 7.29, 1.9, 4.38, 128, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169072']),
    item('TOMATO_PASTE', 'Cà chua cô đặc (Tomato paste)', 'Tomato paste', ['tomato paste', 'cà chua cô đặc', 'bột cà chua'], 'vegetable', 'g', 365, 'fridge', [], [82, 4.32, 0.47, 0.1, 18.91, 4.1, 12.18, 59, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170460']),
    item('OLIVE_BLACK', 'Quả ô liu đen / xanh bỏ hạt', 'Olives', ['ô liu', 'ô liu đen', 'quả ô liu', 'olives'], 'fruit', 'g', 180, 'fridge', [], [116, 0.84, 10.9, 1.44, 6.04, 1.6, 0, 735, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169094']),
    item('CANNELLINI_BEANS', 'Đậu trắng / Đậu Borlotti Ý', 'White kidney / Cannellini beans', ['đậu cannellini', 'đậu borlotti', 'đậu trắng', 'white beans'], 'vegetable', 'g', 365, 'pantry', [], [114, 8.2, 0.4, 0.1, 20.5, 5.5, 0.3, 180, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 175200']),
    item('MUNG_BEAN', 'Đậu xanh cà vỏ', 'Peeled split mung beans', ['đậu xanh', 'đậu xanh cà vỏ', 'đậu xanh không vỏ'], 'grain', 'g', 365, 'pantry', [], [347, 23.86, 1.15, 0.35, 62.62, 16.3, 6.6, 15, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 174256']),
    item('VEGAN_MEAT_CHAY', 'Sườn non chay / Đậu hũ non chay', 'Dried vegan soy protein', ['sườn chay', 'sườn non chay', 'thịt chay'], 'vegetable', 'g', 180, 'pantry', ['soybean'], [345, 50.0, 1.5, 0.3, 30.0, 16.0, 2.0, 45, 1, undefined, undefined, undefined, undefined, undefined, 'Textured Soy Protein USDA Ref']),
    item('DRIED_SHIITAKE', 'Nấm hương khô (Đông cô khô)', 'Dried shiitake mushrooms', ['nấm hương khô', 'đông cô khô', 'dried shiitake'], 'vegetable', 'g', 365, 'pantry', [], [296, 9.58, 0.99, 0.23, 75.37, 11.5, 2.21, 13, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168436']),
    item('WOOD_EAR_MUSHROOM', 'Mộc nhĩ (Nấm mèo khô)', 'Dried wood ear mushroom', ['mộc nhĩ', 'nấm mèo', 'wood ear mushroom'], 'vegetable', 'g', 365, 'pantry', [], [284, 9.25, 0.73, 0.1, 73.01, 70.1, 0, 35, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168437']),
    item('ENOKI_MUSHROOM', 'Nấm kim châm tươi (Enoki)', 'Enoki mushrooms', ['enoki', 'nấm enoki'], 'vegetable', 'g', 7, 'veg_crisper', [], [37, 2.66, 0.29, 0.03, 7.81, 2.7, 0.22, 3, 0.9, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169253']),
    item('KING_OYSTER_MUSHROOM', 'Nấm đùi gà & Bào ngư', 'King oyster / Oyster mushrooms', ['nấm bào ngư', 'nấm sò', 'nấm shimeji', 'nấm linh chi', 'nấm mỡ', 'king oyster mushroom'], 'vegetable', 'g', 7, 'veg_crisper', [], [33, 3.31, 0.41, 0.06, 6.09, 2.3, 1.11, 18, 0.95, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168580']),
    item('NORI_SEAWEED', 'Rong biển lá khô (Nori / Gim)', 'Roasted seaweed sheets (Nori)', ['rong biển khô', 'rong biển nori', 'gim', 'nori', 'rong biển vụn'], 'vegetable', 'g', 365, 'pantry', [], [35, 5.81, 0.28, 0.05, 5.11, 0.3, 0.5, 48, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168456']),
    item('KOMBU_KELP', 'Tảo bẹ Kombu khô', 'Dried kombu kelp', ['kombu', 'tảo bẹ', 'tảo bẹ kombu'], 'vegetable', 'g', 730, 'pantry', [], [43, 1.68, 0.56, 0.25, 9.57, 1.3, 0.6, 233, 0.15, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168457']),
    item('WAKAME_SEAWEED', 'Rong biển Wakame khô', 'Dried wakame seaweed', ['wakame', 'rong biển wakame'], 'vegetable', 'g', 365, 'pantry', [], [45, 3.03, 0.64, 0.13, 9.14, 0.5, 0.65, 872, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 170496']),
    item('JUJUBE_GOJI', 'Táo đỏ / Kỷ tử khô', 'Dried jujube & goji berries', ['táo đỏ', 'táo tàu', 'kỷ tử', 'goji'], 'fruit', 'g', 365, 'pantry', [], [287, 3.7, 1.1, 0, 73.6, 6.0, 50.0, 9, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC Jujube Ref']),

    // =========================================================================
    // 9. RICE, NOODLES, WRAPPERS & BREADS
    // =========================================================================
    item('COOKED_RICE', 'Cơm trắng nấu chín', 'Cooked steamed white rice', ['cơm trắng', 'cơm nấu chín', 'cơm dẻo', 'cooked rice'], 'grain', 'g', 3, 'fridge', [], [130, 2.69, 0.28, 0.08, 28.17, 0.4, 0.05, 1, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168878'], '🍚'),
    item('GLUTINOUS_RICE', 'Gạo nếp', 'Glutinous sticky rice', ['gạo nếp', 'nếp cái hoa vàng', 'sticky rice'], 'grain', 'g', 365, 'pantry', [], [370, 6.81, 0.55, 0.11, 81.68, 2.8, 0.12, 7, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168881']),
    item('RICE_VERMICELLI', 'Bún gạo tươi', 'Fresh rice vermicelli (Bún)', ['bún rối', 'bún lá', 'bún sợi to', 'bún bò', 'rice vermicelli'], 'grain', 'g', 2, 'fridge', [], [109, 1.8, 0.2, 0.05, 24.9, 0.9, 0.1, 12, 1, undefined, undefined, undefined, undefined, undefined, 'NIN VN Fresh Bun Ref'], '🍜'),
    item('DRIED_VERMICELLI', 'Bún khô / Bánh hỏi khô', 'Dried rice vermicelli', ['bún khô', 'miến gạo khô'], 'grain', 'g', 365, 'pantry', [], [364, 5.95, 0.56, 0.15, 80.17, 1.8, 0.1, 182, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169745']),
    item('PHO_NOODLE_FRESH', 'Bánh phở tươi / Hủ tiếu / Mì Quảng', 'Fresh flat rice noodles', ['bánh phở', 'bánh phở tươi', 'hủ tiếu tươi', 'mì quảng tươi'], 'grain', 'g', 2, 'fridge', [], [112, 2.0, 0.3, 0.05, 25.0, 0.8, 0.1, 15, 1, undefined, undefined, undefined, undefined, undefined, 'NIN VN Fresh Pho Noodle Ref']),
    item('PAD_THAI_NOODLE', 'Bánh phở khô / Hủ tiếu khô', 'Dried flat rice noodles', ['bánh phở khô', 'hủ tiếu khô', 'mì gạo bản to', 'pad thai noodle'], 'grain', 'g', 365, 'pantry', [], [364, 5.95, 0.56, 0.15, 80.17, 1.8, 0.1, 182, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 169745']),
    item('GLASS_NOODLE', 'Miến dong / Miến khoai lang Hàn (Japchae)', 'Glass vermicelli noodles', ['miến', 'miến dong', 'miến khoai lang', 'miến đậu xanh', 'dangmyeon'], 'grain', 'g', 365, 'pantry', [], [351, 0.16, 0.06, 0.01, 86.09, 0.5, 0, 10, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168952']),
    item('EGG_NOODLE', 'Mì trứng / Mì ramen / Mì vắt', 'Egg / Ramen wheat noodles', ['mì trứng', 'mì ramen', 'mì gói', 'mì tươi', 'mì yakisoba', 'ramen', 'naengmyeon'], 'grain', 'g', 180, 'pantry', ['wheat', 'egg'], [352, 12.2, 2.8, 0.7, 68.5, 2.6, 1.2, 420, 1, undefined, undefined, undefined, undefined, undefined, 'USDA / MEXT Wheat Noodle Ref']),
    item('RICE_CAKE_TTEOK', 'Bánh gạo Hàn Quốc (Tteokbokki)', 'Korean cylindrical rice cake', ['bánh gạo', 'bánh gạo hàn quốc', 'tteok', 'tokbokki'], 'grain', 'g', 14, 'fridge', [], [234, 4.1, 0.4, 0.1, 52.8, 0.8, 0.5, 15, 1, undefined, undefined, undefined, undefined, undefined, 'Korean Tteok Ref']),
    item('BANH_MI', 'Bánh mì Việt Nam', 'Vietnamese baguette', ['bánh mì', 'bánh mì việt nam', 'banh mi'], 'grain', 'piece', 2, 'pantry', ['wheat'], [272, 8.8, 1.9, 0.4, 53.6, 2.3, 3.0, 560, 1, undefined, 90, undefined, undefined, undefined, 'USDA FDC 172686'], '🥖'),
    item('ITALIAN_PASTA_SHORT', 'Mì Ý Penne / Fusilli / Nui / Lasagna', 'Italian Penne / Fusilli / Lasagna pasta', ['penne', 'linguine', 'lasagna', 'nui', 'ditali', 'mì ý ngắn'], 'grain', 'g', 365, 'pantry', ['wheat'], [365, 12.5, 1.5, 0.3, 74.0, 3.0, 2.5, 6, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC 168927'], '🍝'),
    item('ARBORIO_RICE', 'Gạo Ý Arborio / Carnaroli (nấu Risotto)', 'Arborio risotto rice', ['arborio', 'carnaroli', 'gạo arborio', 'gạo risotto'], 'grain', 'g', 365, 'pantry', [], [355, 6.5, 0.6, 0.15, 79.0, 1.2, 0.2, 2, 1, undefined, undefined, undefined, undefined, undefined, 'USDA FDC Arborio Rice Ref'], '🍚'),
    item('ROASTED_RICE_POWDER', 'Thính gạo rang (Khao Khua)', 'Toasted rice powder', ['thính gạo', 'gạo rang xay', 'khao khua', 'toasted rice powder'], 'grain', 'g', 180, 'pantry', [], [360, 6.8, 0.8, 0.2, 79.5, 1.8, 0.2, 4, 1, undefined, undefined, undefined, undefined, undefined, 'Toasted Rice Powder Ref']),
    item('WINE_VINEGAR', 'Giấm vang trắng / Giấm táo', 'White wine or apple cider vinegar', ['giấm vang trắng', 'giấm táo', 'white wine vinegar', 'apple cider vinegar'], 'spice', 'ml', 730, 'pantry', ['sulphites'], [19, 0, 0, 0, 0.9, 0, 0.4, 5, 1, 1.01, undefined, undefined, undefined, undefined, 'USDA FDC 172235']),
    item('PIZZA_RICE_CRACKER', 'Bánh đa / Bánh phồng tôm', 'Grilled rice cracker / Prawn cracker', ['bánh đa', 'bánh đa nướng', 'bánh phồng tôm', 'bánh tráng nướng'], 'grain', 'g', 180, 'pantry', [], [375, 4.0, 1.2, 0.3, 86.0, 1.0, 2.0, 480, 1, undefined, undefined, undefined, undefined, undefined, 'VN Banh Da Ref']),
  ]);

export const CULINARY_STANDARD_INGREDIENTS_V4: readonly CanonicalIngredient[] = Object.freeze(
  CULINARY_STANDARD_INGREDIENT_METADATA_V4.map((entry) => entry.ingredient),
);

export function getAllOperationalIngredients(): readonly CanonicalIngredient[] {
  return [
    ...CANONICAL_INGREDIENTS,
    ...GLOBAL_EXTENDED_INGREDIENTS,
    ...CULINARY_STANDARD_INGREDIENTS_V4,
  ];
}

const CULINARY_META_BY_ID = new Map<string, CulinaryIngredientMetadataV4>(
  CULINARY_STANDARD_INGREDIENT_METADATA_V4.map((entry) => [entry.ingredient.id, entry]),
);

let cachedOperationalById: Map<string, CanonicalIngredient> | null = null;
function operationalByIdMap(): Map<string, CanonicalIngredient> {
  cachedOperationalById ??= new Map<string, CanonicalIngredient>(
    getAllOperationalIngredients().map((entry) => [entry.id, entry]),
  );
  return cachedOperationalById;
}

export const OPERATIONAL_NUTRITION_MAP_V4: ReadonlyMap<string, CulinaryNutritionReferenceV4> = new Map<
  string,
  CulinaryNutritionReferenceV4
>([
  ...Object.entries(EXISTING_INGREDIENT_PROFILES_V4).map(
    ([id, meta]) => [id, meta.nutrition] as const,
  ),
  ...CULINARY_STANDARD_INGREDIENT_METADATA_V4.map(
    (meta) => [meta.ingredient.id, meta.nutrition] as const,
  ),
]);

export const OPERATIONAL_ALLERGEN_MAP_V4: ReadonlyMap<string, readonly string[]> = new Map<
  string,
  readonly string[]
>([
  ...Object.entries(EXISTING_INGREDIENT_PROFILES_V4).map(
    ([id, meta]) => [id, meta.allergenTags] as const,
  ),
  ...CULINARY_STANDARD_INGREDIENT_METADATA_V4.map(
    (meta) => [meta.ingredient.id, meta.allergenTags] as const,
  ),
]);

export function findOperationalIngredientById(id: string | null | undefined): CanonicalIngredient | null {
  if (!id) return null;
  return operationalByIdMap().get(id.trim().toUpperCase()) ?? null;
}

export function findOperationalIngredient(input: string): CanonicalIngredient | null {
  if (!input) return null;
  const byId = findOperationalIngredientById(input);
  if (byId) return byId;
  const clean = normalizeMultilingualText(input);
  if (!clean) return null;
  const all = getAllOperationalIngredients();
  const exactName = all.filter(
    (ing) =>
      normalizeMultilingualText(ing.nameVi) === clean ||
      normalizeMultilingualText(ing.nameEn) === clean,
  );
  if (exactName.length === 1) return exactName[0];
  const exactAlias = all.filter((ing) =>
    ing.aliases.some((alias) => normalizeMultilingualText(alias) === clean),
  );
  return exactAlias.length === 1 ? exactAlias[0] : null;
}

export function getCulinaryIngredientMetadataV4(
  id: string,
): CulinaryIngredientMetadataV4 | undefined {
  return CULINARY_META_BY_ID.get(id.trim().toUpperCase());
}

export function getOperationalNutritionV4(
  id: string,
): CulinaryNutritionReferenceV4 | undefined {
  return OPERATIONAL_NUTRITION_MAP_V4.get(id.trim().toUpperCase());
}

export function getOperationalAllergensV4(id: string): readonly string[] {
  return OPERATIONAL_ALLERGEN_MAP_V4.get(id.trim().toUpperCase()) ?? [];
}
