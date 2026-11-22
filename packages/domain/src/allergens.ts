import { normalizeMultilingualText, type SupportedLocale } from './i18n';

/**
 * Regulatory Allergen & Dietary Safety Engine:
 * 1. Japan Consumer Affairs Agency (消費者庁 CAA) Food Labeling Standards:
 *    - 9 Mandatory Specific Raw Materials (`特定原材料`): shrimp, crab, walnut (くるみ),
 *      wheat, buckwheat (そば), egg, milk, peanut, cashew (カシューナッツ).
 *    - 19 Recommended (`特定原材料に準ずるもの`): almond, abalone, squid, salmon_roe,
 *      orange, kiwi, beef, sesame, salmon, mackerel, soybean, chicken, banana, pork,
 *      matsutake, peach, yam, apple, gelatin (+ macadamia).
 * 2. EU Regulation (EU) No 1169/2011 Annex II — 14 Mandatory Substances:
 *    - gluten_cereals (wheat, rye, barley, oats, spelt, khorasan), crustaceans, eggs,
 *      fish, peanuts, soybeans, milk, tree_nuts (almond, hazelnut, walnut, cashew,
 *      pecan, brazil_nut, pistachio, macadamia), celery, mustard, sesame, sulphites,
 *      lupin, molluscs (strictly distinct from crustaceans!).
 */

export const JP_CAA_MANDATORY_ALLERGENS = [
  'shrimp',
  'crab',
  'walnut',
  'wheat',
  'buckwheat',
  'egg',
  'milk',
  'peanut',
  'cashew',
] as const;

export const JP_CAA_RECOMMENDED_ALLERGENS = [
  'almond',
  'abalone',
  'squid',
  'salmon_roe',
  'orange',
  'kiwi',
  'beef',
  'sesame',
  'salmon',
  'mackerel',
  'soybean',
  'chicken',
  'banana',
  'pork',
  'matsutake',
  'peach',
  'yam',
  'apple',
  'gelatin',
  'macadamia',
] as const;

export const EU_1169_MANDATORY_ALLERGENS = [
  'gluten_cereals',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'tree_nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;

export const DIETARY_PROFILES = [
  'vegan',
  'vegetarian',
  'pescatarian',
  'gluten_free',
  'lactose_free',
  'halal',
  'kosher',
] as const;

export type DietaryProfile = (typeof DIETARY_PROFILES)[number];
export type JpCaaMandatoryAllergen = (typeof JP_CAA_MANDATORY_ALLERGENS)[number];
export type JpCaaRecommendedAllergen = (typeof JP_CAA_RECOMMENDED_ALLERGENS)[number];
export type Eu1169Allergen = (typeof EU_1169_MANDATORY_ALLERGENS)[number];

/**
 * Canonical allergen taxonomy mapping every regional alias & child species to
 * its canonical key and parent regulatory groups.
 * CRITICAL INVARIANT: `molluscs` (clams, mussels, squid, octopus, abalone) NEVER
 * implies `crustaceans` (shrimp, crab, lobster), and vice-versa.
 */
const ALLERGEN_SYNONYMS: Readonly<Record<string, string>> = Object.freeze({
  // Eggs
  egg: 'egg',
  eggs: 'egg',
  tamago: 'egg',
  '卵': 'egg',
  // Milk / Dairy
  milk: 'milk',
  dairy: 'milk',
  lactose: 'milk',
  '乳': 'milk',
  '乳成分': 'milk',
  // Peanuts (legume — never conflated with tree_nuts)
  peanut: 'peanut',
  peanuts: 'peanut',
  groundnut: 'peanut',
  erdnusse: 'peanut',
  arachide: 'peanut',
  '落花生': 'peanut',
  // Soybeans
  soy: 'soybean',
  soya: 'soybean',
  soybean: 'soybean',
  soybeans: 'soybean',
  '大豆': 'soybean',
  //Gluten & Cereals
  gluten: 'gluten_cereals',
  gluten_cereals: 'gluten_cereals',
  cereals_containing_gluten: 'gluten_cereals',
  wheat: 'wheat',
  '小麦': 'wheat',
  rye: 'rye',
  barley: 'barley',
  oats: 'oats',
  spelt: 'spelt',
  khorasan: 'khorasan',
  // Buckwheat (そば — NOT a gluten cereal, mandatory JP CAA)
  buckwheat: 'buckwheat',
  soba: 'buckwheat',
  'そば': 'buckwheat',
  '蕎麦': 'buckwheat',
  // Crustaceans (Ebi / Kani)
  crustacean: 'crustaceans',
  crustaceans: 'crustaceans',
  shrimp: 'shrimp',
  prawn: 'shrimp',
  'えび': 'shrimp',
  crab: 'crab',
  'かに': 'crab',
  lobster: 'lobster',
  // Molluscs (EU Annex II #14 — strictly separate from crustaceans)
  mollusc: 'molluscs',
  molluscs: 'molluscs',
  mollusk: 'molluscs',
  mollusks: 'molluscs',
  clam: 'clam',
  clams: 'clam',
  mussel: 'mussel',
  mussels: 'mussel',
  oyster: 'oyster',
  squid: 'squid',
  'いか': 'squid',
  octopus: 'octopus',
  abalone: 'abalone',
  'あわび': 'abalone',
  // Fish & JP specific species
  fish: 'fish',
  salmon: 'salmon',
  'さけ': 'salmon',
  mackerel: 'mackerel',
  'さば': 'mackerel',
  salmon_roe: 'salmon_roe',
  ikura: 'salmon_roe',
  'いくら': 'salmon_roe',
  // Tree nuts (EU Annex II #8 + JP CAA specific nuts)
  nuts: 'tree_nuts',
  tree_nut: 'tree_nuts',
  tree_nuts: 'tree_nuts',
  walnut: 'walnut',
  walnuts: 'walnut',
  'くるみ': 'walnut',
  cashew: 'cashew',
  cashews: 'cashew',
  'カシューナッツ': 'cashew',
  'かしゅーなっつ': 'cashew',
  almond: 'almond',
  almonds: 'almond',
  'アーモンド': 'almond',
  'あーもんど': 'almond',
  hazelnut: 'hazelnut',
  pecan: 'pecan',
  brazil_nut: 'brazil_nut',
  pistachio: 'pistachio',
  macadamia: 'macadamia',
  'マカダミアナッツ': 'macadamia',
  'まかだみあなっつ': 'macadamia',
  // EU mandatory aromatics, seeds, additives & legumes
  celery: 'celery',
  sellerie: 'celery',
  celeri: 'celery',
  mustard: 'mustard',
  senf: 'mustard',
  moutarde: 'mustard',
  sesame: 'sesame',
  sesame_seeds: 'sesame',
  'ごま': 'sesame',
  sulphites: 'sulphites',
  sulfites: 'sulphites',
  sulphur_dioxide: 'sulphites',
  'sulphur_dioxide_and_sulphites': 'sulphites',
  so2: 'sulphites',
  lupin: 'lupin',
  lupine: 'lupin',
  // JP CAA meats, fruits, yam, mushroom & gelatin
  beef: 'beef',
  '牛肉': 'beef',
  pork: 'pork',
  '豚肉': 'pork',
  chicken: 'chicken',
  '鶏肉': 'chicken',
  yam: 'yam',
  yamaimo: 'yam',
  'やまいも': 'yam',
  gelatin: 'gelatin',
  gelatine: 'gelatin',
  'ゼラチン': 'gelatin',
  'ぜらちん': 'gelatin',
  orange: 'orange',
  'オレンジ': 'orange',
  kiwi: 'kiwi',
  'キウイフルーツ': 'kiwi',
  banana: 'banana',
  'バナナ': 'banana',
  peach: 'peach',
  'もも': 'peach',
  apple: 'apple',
  'りんご': 'apple',
  matsutake: 'matsutake',
  'まつたけ': 'matsutake',
});

/**
 * Parent group -> specific child tags.
 * If a user declares allergy to `tree_nuts`, a recipe tagged `walnut` MUST conflict.
 * Conversely, if a user declares allergy to `walnut` AND a recipe is broadly tagged
 * `tree_nuts` (ambiguous nut species), fail-closed safety MUST also flag conflict!
 */
const ALLERGEN_GROUP_CHILDREN: Readonly<Record<string, readonly string[]>> = Object.freeze({
  gluten_cereals: ['wheat', 'rye', 'barley', 'oats', 'spelt', 'khorasan'],
  crustaceans: ['shrimp', 'crab', 'lobster'],
  molluscs: ['clam', 'mussel', 'oyster', 'squid', 'octopus', 'abalone'],
  fish: ['salmon', 'mackerel', 'salmon_roe'],
  tree_nuts: ['walnut', 'cashew', 'almond', 'hazelnut', 'pecan', 'brazil_nut', 'pistachio', 'macadamia'],
});

const CHILD_TO_PARENT_GROUP: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(ALLERGEN_GROUP_CHILDREN).flatMap(([parent, children]) =>
      children.map((child) => [child, parent]),
    ),
  ),
);

export function normalizeAllergenTag(raw: string): string {
  const trimmed = raw.trim().replace(/^[a-z]{2}:/i, '');
  const direct = ALLERGEN_SYNONYMS[trimmed];
  if (direct) return direct;
  const normalized = normalizeMultilingualText(trimmed).replace(/[-\s]+/g, '_');
  return ALLERGEN_SYNONYMS[normalized] ?? normalized;
}

/**
 * Hierarchical allergen matcher used by T03/T20 `evaluateHardRestrictions`:
 * - Exact canonical match (`eggs` == `egg`, `soybeans` == `soybean`, `くるみ` == `walnut`)
 * - Child triggers parent (`walnut` in recipe triggers `tree_nuts` policy; `shrimp` triggers `crustaceans`)
 * - Broad parent tag in recipe conservatively triggers specific child policy (`tree_nuts` triggers `walnut`)
 * - Sibling species do NOT false-trigger (`almond` != `walnut`; `molluscs` != `crustaceans`; `peanut` != `tree_nuts`).
 */
export function matchesAllergenHierarchy(
  recipeAllergenTags: readonly string[],
  requestedAllergen: string,
): boolean {
  if (recipeAllergenTags.length === 0) return false;
  const target = normalizeAllergenTag(requestedAllergen);
  const targetChildren = new Set(ALLERGEN_GROUP_CHILDREN[target] ?? []);
  const targetParent = CHILD_TO_PARENT_GROUP[target];

  for (const rawTag of recipeAllergenTags) {
    const tag = normalizeAllergenTag(rawTag);
    if (tag === target) return true;
    if (targetChildren.has(tag)) return true;
    if (targetParent && tag === targetParent) return true;
  }
  return false;
}

/** Maps Open Food Facts `allergens_tags` (e.g. `en:milk`, `en:molluscs`, `ja:そば`) to canonical allergen IDs. */
export function mapOpenFoodFactsAllergens(offTags: readonly string[]): string[] {
  const result = new Set<string>();
  for (const raw of offTags) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const normalized = normalizeAllergenTag(raw);
    if (normalized) result.add(normalized);
  }
  return [...result].sort();
}

export interface IngredientDietaryFacts {
  readonly allergens: readonly string[];
  readonly animalOrigin: 'none' | 'meat_pork' | 'meat_beef' | 'meat_poultry' | 'fish' | 'shellfish' | 'egg' | 'dairy';
  readonly containsAlcohol?: boolean;
  readonly containsGluten?: boolean;
}

/**
 * Canonical ingredient allergen & dietary knowledge base across all 45 V1 + 32 Global ingredients.
 */
export const CANONICAL_INGREDIENT_DIETARY_FACTS: Readonly<Record<string, IngredientDietaryFacts>> = Object.freeze({
  // V1 Meat & Poultry
  PORK_BELLY: { allergens: ['pork'], animalOrigin: 'meat_pork' },
  GROUND_PORK: { allergens: ['pork'], animalOrigin: 'meat_pork' },
  PORK_RIBS: { allergens: ['pork'], animalOrigin: 'meat_pork' },
  BEEF_SIRLOIN: { allergens: ['beef'], animalOrigin: 'meat_beef' },
  CHICKEN_BREAST: { allergens: ['chicken'], animalOrigin: 'meat_poultry' },
  CHICKEN_THIGH: { allergens: ['chicken'], animalOrigin: 'meat_poultry' },
  // V1 Seafood
  SHRIMP: { allergens: ['shrimp', 'crustaceans'], animalOrigin: 'shellfish' },
  CRAB_MEAT: { allergens: ['crab', 'crustaceans'], animalOrigin: 'shellfish' },
  SQUID: { allergens: ['squid', 'molluscs'], animalOrigin: 'shellfish' },
  SALMON_FILLET: { allergens: ['salmon', 'fish'], animalOrigin: 'fish' },
  WHITE_FISH: { allergens: ['fish'], animalOrigin: 'fish' },
  FISH_FRESHWATER: { allergens: ['fish'], animalOrigin: 'fish' },
  FISH_SAUCE: { allergens: ['fish'], animalOrigin: 'fish' },
  // V1 Egg & Dairy
  CHICKEN_EGG: { allergens: ['egg'], animalOrigin: 'egg' },
  FRESH_MILK: { allergens: ['milk'], animalOrigin: 'dairy' },
  CHEDDAR_CHEESE: { allergens: ['milk'], animalOrigin: 'dairy' },
  BUTTER: { allergens: ['milk'], animalOrigin: 'dairy' },
  // V1 Soy, Grains & Produce
  TOFU: { allergens: ['soybean'], animalOrigin: 'none' },
  SOY_SAUCE: { allergens: ['soybean', 'wheat'], animalOrigin: 'none', containsGluten: true },
  SPAGHETTI_PASTA: { allergens: ['wheat'], animalOrigin: 'none', containsGluten: true },
  RICE: { allergens: [], animalOrigin: 'none' },
  RICE_PAPER: { allergens: [], animalOrigin: 'none' },
  NOODLE: { allergens: [], animalOrigin: 'none' },
  COOKING_OIL: { allergens: [], animalOrigin: 'none' },
  SUGAR: { allergens: [], animalOrigin: 'none' },
  // Global Extended Ingredients
  SESAME_OIL: { allergens: ['sesame'], animalOrigin: 'none' },
  SESAME_SEED: { allergens: ['sesame'], animalOrigin: 'none' },
  OLIVE_OIL: { allergens: [], animalOrigin: 'none' },
  MISO: { allergens: ['soybean'], animalOrigin: 'none' },
  MIRIN: { allergens: [], animalOrigin: 'none', containsAlcohol: true },
  DASHI: { allergens: ['fish', 'mackerel'], animalOrigin: 'fish' },
  MUSTARD: { allergens: ['mustard'], animalOrigin: 'none' },
  WINE_COOKING: { allergens: ['sulphites'], animalOrigin: 'none', containsAlcohol: true },
  SOBA_BUCKWHEAT: { allergens: ['buckwheat'], animalOrigin: 'none' },
  UDON_WHEAT: { allergens: ['wheat'], animalOrigin: 'none', containsGluten: true },
  BREAD: { allergens: ['wheat'], animalOrigin: 'none', containsGluten: true },
  OATS: { allergens: ['oats', 'gluten_cereals'], animalOrigin: 'none', containsGluten: true },
  POTATO: { allergens: [], animalOrigin: 'none' },
  YOGURT: { allergens: ['milk'], animalOrigin: 'dairy' },
  CREAM: { allergens: ['milk'], animalOrigin: 'dairy' },
  NATTO: { allergens: ['soybean'], animalOrigin: 'none' },
  SOYBEAN: { allergens: ['soybean'], animalOrigin: 'none' },
  GROUND_BEEF: { allergens: ['beef'], animalOrigin: 'meat_beef' },
  BACON_HAM: { allergens: ['pork'], animalOrigin: 'meat_pork' },
  MACKEREL: { allergens: ['mackerel', 'fish'], animalOrigin: 'fish' },
  CLAM_MUSSEL: { allergens: ['clam', 'mussel', 'molluscs'], animalOrigin: 'shellfish' },
  SALMON_ROE: { allergens: ['salmon_roe', 'salmon', 'fish'], animalOrigin: 'fish' },
  WALNUT: { allergens: ['walnut', 'tree_nuts'], animalOrigin: 'none' },
  CASHEW: { allergens: ['cashew', 'tree_nuts'], animalOrigin: 'none' },
  PEANUT: { allergens: ['peanut'], animalOrigin: 'none' },
  ALMOND: { allergens: ['almond', 'tree_nuts'], animalOrigin: 'none' },
  LUPIN_BEAN: { allergens: ['lupin'], animalOrigin: 'none' },
  CELERY: { allergens: ['celery'], animalOrigin: 'none' },
  YAM_NAGAIIMO: { allergens: ['yam'], animalOrigin: 'none' },
  BELL_PEPPER: { allergens: [], animalOrigin: 'none' },
  ZUCCHINI: { allergens: [], animalOrigin: 'none' },
});

/** Derives canonical allergen tags implied by structured canonical ingredient IDs. */
export function deriveAllergensFromIngredients(ingredientIds: readonly string[]): string[] {
  const tags = new Set<string>();
  for (const id of ingredientIds) {
    const facts = CANONICAL_INGREDIENT_DIETARY_FACTS[id.trim().toUpperCase()];
    if (!facts) continue;
    for (const tag of facts.allergens) tags.add(tag);
  }
  return [...tags].sort();
}

const KOSHER_MEAT_ORIGINS = new Set<IngredientDietaryFacts['animalOrigin']>([
  'meat_beef',
  'meat_poultry',
  'meat_pork',
]);

/**
 * Checks Kosher meal-level separation: meat/poultry (`Basar`) and dairy (`Chalav`)
 * must never be combined in the same dish or meal slot, and pork/shellfish are non-kosher (`Treif`).
 */
export function hasKosherConflict(ingredientIds: readonly string[]): {
  conflict: boolean;
  reasons: ('KOSHER_FORBIDDEN_SPECIES' | 'KOSHER_MEAT_DAIRY_MIX')[];
} {
  let hasMeat = false;
  let hasDairy = false;
  let hasForbiddenSpecies = false;

  for (const id of ingredientIds) {
    const facts = CANONICAL_INGREDIENT_DIETARY_FACTS[id.trim().toUpperCase()];
    if (!facts) continue;
    if (facts.animalOrigin === 'meat_pork' || facts.animalOrigin === 'shellfish') {
      hasForbiddenSpecies = true;
    }
    if (KOSHER_MEAT_ORIGINS.has(facts.animalOrigin)) hasMeat = true;
    if (facts.animalOrigin === 'dairy') hasDairy = true;
  }

  const reasons: ('KOSHER_FORBIDDEN_SPECIES' | 'KOSHER_MEAT_DAIRY_MIX')[] = [];
  if (hasForbiddenSpecies) reasons.push('KOSHER_FORBIDDEN_SPECIES');
  if (hasMeat && hasDairy) reasons.push('KOSHER_MEAT_DAIRY_MIX');
  return { conflict: reasons.length > 0, reasons };
}

/** Evaluates ingredient-level dietary profile violations (Vegan, Vegetarian, Pescatarian, Halal, Kosher, Gluten-Free, Lactose-Free). */
export function evaluateDietaryProfileConflicts(
  ingredientIds: readonly string[],
  profiles: readonly DietaryProfile[],
): string[] {
  if (profiles.length === 0) return [];
  const conflicts = new Set<string>();
  const factsList = ingredientIds
    .map((id) => CANONICAL_INGREDIENT_DIETARY_FACTS[id.trim().toUpperCase()])
    .filter((item): item is IngredientDietaryFacts => item !== undefined);

  for (const profile of profiles) {
    switch (profile) {
      case 'vegan':
        if (factsList.some((f) => f.animalOrigin !== 'none')) conflicts.add('DIETARY_CONFLICT:vegan');
        break;
      case 'vegetarian':
        if (factsList.some((f) => f.animalOrigin !== 'none' && f.animalOrigin !== 'egg' && f.animalOrigin !== 'dairy')) {
          conflicts.add('DIETARY_CONFLICT:vegetarian');
        }
        break;
      case 'pescatarian':
        if (factsList.some((f) => KOSHER_MEAT_ORIGINS.has(f.animalOrigin))) {
          conflicts.add('DIETARY_CONFLICT:pescatarian');
        }
        break;
      case 'gluten_free':
        if (factsList.some((f) => f.containsGluten || matchesAllergenHierarchy(f.allergens, 'gluten_cereals'))) {
          conflicts.add('DIETARY_CONFLICT:gluten_free');
        }
        break;
      case 'lactose_free':
        if (factsList.some((f) => f.animalOrigin === 'dairy' || f.allergens.includes('milk'))) {
          conflicts.add('DIETARY_CONFLICT:lactose_free');
        }
        break;
      case 'halal':
        if (factsList.some((f) => f.animalOrigin === 'meat_pork' || f.containsAlcohol)) {
          conflicts.add('DIETARY_CONFLICT:halal');
        }
        break;
      case 'kosher': {
        const kosher = hasKosherConflict(ingredientIds);
        for (const reason of kosher.reasons) conflicts.add(`DIETARY_CONFLICT:${reason.toLowerCase()}`);
        break;
      }
    }
  }
  return [...conflicts].sort();
}

const ALLERGEN_LABELS: Readonly<Record<string, Partial<Record<SupportedLocale, string>>>> = Object.freeze({
  wheat: { en: 'Wheat', ja: '小麦', de: 'Weizen', fr: 'Blé', es: 'Trigo', it: 'Grano', nl: 'Tarwe', pl: 'Pszenica', sv: 'Vete', vi: 'Lúa mì' },
  gluten_cereals: { en: 'Gluten cereals', ja: 'グルテン含有穀物', de: 'Glutenhaltiges Getreide', fr: 'Céréales contenant du gluten', es: 'Cereales con gluten', it: 'Cereali contenenti glutine', nl: 'Glutenbevattende granen', pl: 'Zboża zawierające gluten', sv: 'Spannmål med gluten', vi: 'Ngũ cốc chứa gluten' },
  buckwheat: { en: 'Buckwheat (Soba)', ja: 'そば', de: 'Buchweizen', fr: 'Sarrasin', es: 'Trigo sarraceno', it: 'Grano saraceno', nl: 'Boekweit', pl: 'Gryka', sv: 'Bovete', vi: 'Kiều mạch (Soba)' },
  egg: { en: 'Egg', ja: '卵', de: 'Eier', fr: 'Œufs', es: 'Huevo', it: 'Uova', nl: 'Eieren', pl: 'Jaja', sv: 'Ägg', vi: 'Trứng' },
  milk: { en: 'Milk / Dairy', ja: '乳', de: 'Milch', fr: 'Lait', es: 'Leche', it: 'Latte', nl: 'Melk', pl: 'Mleko', sv: 'Mjölk', vi: 'Sữa' },
  peanut: { en: 'Peanuts', ja: '落花生', de: 'Erdnüsse', fr: 'Arachides', es: 'Cacahuetes', it: 'Arachidi', nl: "Pinda's", pl: 'Orzeszki ziemne', sv: 'Jordnötter', vi: 'Đậu phộng' },
  walnut: { en: 'Walnuts', ja: 'くるみ', de: 'Walnüsse', fr: 'Noix', es: 'Nueces', it: 'Noci', nl: 'Walnoten', pl: 'Orzechy włoskie', sv: 'Valnötter', vi: 'Hạt óc chó' },
  cashew: { en: 'Cashew nuts', ja: 'カシューナッツ', de: 'Cashewkerne', fr: 'Noix de cajou', es: 'Anacardos', it: 'Anacardi', nl: 'Cashewnoten', pl: 'Orzechy nerkowca', sv: 'Cashewnötter', vi: 'Hạt điều' },
  tree_nuts: { en: 'Tree nuts', ja: '木の実類', de: 'Schalenfrüchte', fr: 'Fruits à coque', es: 'Frutos de cáscara', it: 'Frutta a guscio', nl: 'Noten', pl: 'Orzechy', sv: 'Nötter', vi: 'Các loại hạt cây' },
  shrimp: { en: 'Shrimp / Prawns', ja: 'えび', de: 'Garnelen', fr: 'Crevettes', es: 'Gambas', it: 'Gamberi', nl: 'Garnalen', pl: 'Krewetki', sv: 'Räkor', vi: 'Tôm' },
  crab: { en: 'Crab', ja: 'かに', de: 'Krabben', fr: 'Crabe', es: 'Cangrejo', it: 'Granchio', nl: 'Krab', pl: 'Krab', sv: 'Krabba', vi: 'Cua' },
  crustaceans: { en: 'Crustaceans', ja: '甲殻類', de: 'Krebstiere', fr: 'Crustacés', es: 'Crustáceos', it: 'Crostacei', nl: 'Schaaldieren', pl: 'Skorupiaki', sv: 'Kräftdjur', vi: 'Giáp xác (Tôm/Cua)' },
  molluscs: { en: 'Molluscs', ja: '軟体動物（貝・いか・たこ）', de: 'Weichtiere', fr: 'Mollusques', es: 'Moluscos', it: 'Molluschi', nl: 'Weekdieren', pl: 'Mięczaki', sv: 'Blötdjur', vi: 'Nhuyễn thể (Nghêu/Mực)' },
  fish: { en: 'Fish', ja: '魚類', de: 'Fisch', fr: 'Poisson', es: 'Pescado', it: 'Pesce', nl: 'Vis', pl: 'Ryby', sv: 'Fisk', vi: 'Cá' },
  soybean: { en: 'Soybeans', ja: '大豆', de: 'Sojabohnen', fr: 'Soja', es: 'Soja', it: 'Soia', nl: 'Soja', pl: 'Soja', sv: 'Sojabönor', vi: 'Đậu nành' },
  sesame: { en: 'Sesame', ja: 'ごま', de: 'Sesamsamen', fr: 'Graines de sésame', es: 'Sésamo', it: 'Sesamo', nl: 'Sesamzaad', pl: 'Sezam', sv: 'Sesamfrön', vi: 'Mè / Vừng' },
  celery: { en: 'Celery', ja: 'セロリ', de: 'Sellerie', fr: 'Céleri', es: 'Apio', it: 'Sedano', nl: 'Selderij', pl: 'Seler', sv: 'Selleri', vi: 'Cần tây' },
  mustard: { en: 'Mustard', ja: 'マスタード', de: 'Senf', fr: 'Moutarde', es: 'Mostaza', it: 'Senape', nl: 'Mosterd', pl: 'Gorczyca', sv: 'Senap', vi: 'Mù tạt' },
  sulphites: { en: 'Sulphites (>10mg/kg)', ja: '亜硫酸塩', de: 'Sulfite', fr: 'Sulfites', es: 'Sulfitos', it: 'Solfiti', nl: 'Sulfieten', pl: 'Siarczyny', sv: 'Sulfiter', vi: 'Sulphite' },
  lupin: { en: 'Lupin', ja: 'ルピナス', de: 'Lupinen', fr: 'Lupin', es: 'Altramuces', it: 'Lupini', nl: 'Lupine', pl: 'Łubin', sv: 'Lupin', vi: 'Đậu Lupin' },
});

export function localizeAllergenLabel(allergenKey: string, locale: SupportedLocale = 'en'): string {
  const canonical = normalizeAllergenTag(allergenKey);
  const entry = ALLERGEN_LABELS[canonical];
  return entry?.[locale] ?? entry?.en ?? canonical;
}
