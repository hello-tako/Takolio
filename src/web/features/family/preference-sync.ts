import {
  DEFAULT_FAMILY_PREFERENCES,
  FamilyPreferencesSchema,
  type FamilyPreferences,
} from '../../services/family-preferences';
import type { GlobalCuisine } from '../../../../packages/domain/src/family-preferences-api';

export interface AvoidanceGroup {
  readonly id: string;
  readonly labelVi: string;
  readonly labelEn: string;
  readonly ingredientIds: readonly string[];
}

/**
 * Canonical ingredient exclusion groups backed by verified recipe `ingredient_id`s
 * across both the 71 static baseline and the 500-recipe D1 catalog.
 *
 * Why this matters: `packages/db/src/ranking-nutrition.ts` intentionally emits
 * `safety: []` until a clinically reviewed allergen registry exists, which causes
 * `evaluateHardRestrictions` to reject 100% of recipes (`SAFETY_UNKNOWN` -> 0 meals)
 * whenever unverified `allergens` keys are persisted. Mapping user avoidance groups
 * to `forbiddenIngredientIds` enforces strict ingredient exclusion (`FORBIDDEN_INGREDIENT`)
 * without triggering a 100% catalog blackout.
 */
export const AVOIDANCE_GROUPS: readonly AvoidanceGroup[] = [
  {
    id: 'peanut',
    labelVi: 'Đậu phộng',
    labelEn: 'Peanuts',
    ingredientIds: ['PEANUT', 'PEANUT_BUTTER'],
  },
  {
    id: 'shellfish',
    labelVi: 'Tôm · Cua · Mực',
    labelEn: 'Shellfish',
    ingredientIds: [
      'SHRIMP',
      'DRIED_SHRIMP',
      'SHRIMP_PASTE',
      'CRAB_MEAT',
      'SQUID',
      'DRIED_SQUID',
      'CLAM_MUSSEL',
    ],
  },
  {
    id: 'fish',
    labelVi: 'Cá tươi',
    labelEn: 'Fish',
    ingredientIds: [
      'FISH_FRESHWATER',
      'WHITE_FISH_FILLET',
      'SALMON_FILLET',
      'SALMON_ROE',
      'FISH_CAKE',
    ],
  },
  {
    id: 'beef',
    labelVi: 'Thịt bò',
    labelEn: 'Beef',
    ingredientIds: [
      'BEEF_SIRLOIN',
      'BEEF_BRISKET',
      'BEEF_RIB_BONE',
      'BEEF_BROTH',
      'GROUND_BEEF',
    ],
  },
  {
    id: 'milk',
    labelVi: 'Sữa · Phô mai · Bơ',
    labelEn: 'Dairy',
    ingredientIds: [
      'FRESH_MILK',
      'BUTTER',
      'CHEDDAR_CHEESE',
      'MOZZARELLA_CHEESE',
      'PARMESAN_CHEESE',
      'PECORINO_CHEESE',
      'RICOTTA_CHEESE',
    ],
  },
  {
    id: 'egg',
    labelVi: 'Trứng',
    labelEn: 'Eggs',
    ingredientIds: [
      'CHICKEN_EGG',
      'DUCK_EGG',
      'QUAIL_EGG',
      'SALTED_EGG',
      'EGG_NOODLE',
      'EGG_TOFU',
    ],
  },
  {
    id: 'soy',
    labelVi: 'Đậu phụ · Đậu nành',
    labelEn: 'Soy & Tofu',
    ingredientIds: [
      'TOFU',
      'SOFT_TOFU',
      'FRIED_TOFU',
      'EGG_TOFU',
      'SOYBEAN',
      'SOY_SAUCE',
      'LIGHT_SOY_SAUCE',
      'DARK_SOY_SAUCE',
    ],
  },
  {
    id: 'wheat',
    labelVi: 'Bột mì · Mì sợi',
    labelEn: 'Wheat & Gluten',
    ingredientIds: [
      'ALL_PURPOSE_FLOUR',
      'BREAD',
      'SPAGHETTI_PASTA',
      'ITALIAN_PASTA_SHORT',
      'UDON_WHEAT',
      'EGG_NOODLE',
    ],
  },
  {
    id: 'mushroom',
    labelVi: 'Nấm',
    labelEn: 'Mushrooms',
    ingredientIds: [
      'MUSHROOM',
      'ENOKI_MUSHROOM',
      'KING_OYSTER_MUSHROOM',
      'WOOD_EAR_MUSHROOM',
    ],
  },
  {
    id: 'spicy',
    labelVi: 'Ớt · Đồ cay',
    labelEn: 'Chili & Spicy',
    ingredientIds: ['CHILI', 'CHILI_OIL', 'CHILI_POWDER', 'CHILI_SAUCE'],
  },
] as const;

const RESTRICTION_TAG_TO_INGREDIENTS: Record<string, readonly string[]> = {
  peanut: AVOIDANCE_GROUPS.find((g) => g.id === 'peanut')!.ingredientIds,
  peanuts: AVOIDANCE_GROUPS.find((g) => g.id === 'peanut')!.ingredientIds,
  shellfish: AVOIDANCE_GROUPS.find((g) => g.id === 'shellfish')!.ingredientIds,
  fish: AVOIDANCE_GROUPS.find((g) => g.id === 'fish')!.ingredientIds,
  seafood: [
    ...AVOIDANCE_GROUPS.find((g) => g.id === 'shellfish')!.ingredientIds,
    ...AVOIDANCE_GROUPS.find((g) => g.id === 'fish')!.ingredientIds,
  ],
  beef: AVOIDANCE_GROUPS.find((g) => g.id === 'beef')!.ingredientIds,
  milk: AVOIDANCE_GROUPS.find((g) => g.id === 'milk')!.ingredientIds,
  egg: AVOIDANCE_GROUPS.find((g) => g.id === 'egg')!.ingredientIds,
  soy: AVOIDANCE_GROUPS.find((g) => g.id === 'soy')!.ingredientIds,
  wheat: AVOIDANCE_GROUPS.find((g) => g.id === 'wheat')!.ingredientIds,
  gluten: AVOIDANCE_GROUPS.find((g) => g.id === 'wheat')!.ingredientIds,
  mushroom: AVOIDANCE_GROUPS.find((g) => g.id === 'mushroom')!.ingredientIds,
  spicy: AVOIDANCE_GROUPS.find((g) => g.id === 'spicy')!.ingredientIds,
  onion_garlic: ['ONION', 'RED_ONION', 'GARLIC', 'GARLIC_POWDER', 'SCALLION'],
};

const CUISINE_TAG_MAP: Record<string, GlobalCuisine | null> = {
  vietnamese: 'vietnamese',
  korean: 'korean',
  japanese: 'japanese',
  chinese: 'chinese',
  thai: 'thai',
  italian: 'italian',
  western: 'european',
  european: 'european',
  other: null,
};

export function isAvoidanceGroupActive(
  forbiddenIds: readonly string[] | undefined,
  groupId: string,
): boolean {
  const group = AVOIDANCE_GROUPS.find((item) => item.id === groupId);
  if (!group || !forbiddenIds?.length) return false;
  const set = new Set(forbiddenIds);
  return group.ingredientIds.some((id) => set.has(id));
}

export function toggleAvoidanceGroup(
  forbiddenIds: readonly string[] | undefined,
  groupId: string,
  enabled: boolean,
): string[] {
  const group = AVOIDANCE_GROUPS.find((item) => item.id === groupId);
  const current = new Set(forbiddenIds ?? []);
  if (!group) return [...current];
  for (const id of group.ingredientIds) {
    if (enabled) current.add(id);
    else current.delete(id);
  }
  return [...current].slice(0, 100);
}

/**
 * Converts legacy unverified `allergens` keys (which trigger `SAFETY_UNKNOWN` and
 * yield 0-meal schedules because `safety: []` has no clinical registry yet) into
 * concrete `forbiddenIngredientIds` so recipe filtering works deterministically.
 */
export function sanitizeFamilyPreferencesForGeneration(
  prefs: FamilyPreferences,
): { sanitized: FamilyPreferences; migratedAllergens: string[] } {
  const legacyAllergens = prefs.allergens ?? [];
  if (legacyAllergens.length === 0 && (!prefs.dietaryProfile || prefs.dietaryProfile.length === 0)) {
    return { sanitized: prefs, migratedAllergens: [] };
  }

  const forbidden = new Set(prefs.forbiddenIngredientIds ?? []);
  const migrated: string[] = [];

  for (const rawKey of legacyAllergens) {
    const key = rawKey.toLowerCase();
    const mapped = RESTRICTION_TAG_TO_INGREDIENTS[key];
    if (mapped) {
      for (const id of mapped) forbidden.add(id);
      migrated.push(rawKey);
    }
  }

  const next: FamilyPreferences = FamilyPreferencesSchema.parse({
    ...prefs,
    forbiddenIngredientIds: [...forbidden].slice(0, 100),
    allergens: [],
    dietaryProfile: [],
  });

  return { sanitized: next, migratedAllergens: migrated };
}

/**
 * Syncs user-level taste choices from Onboarding (O04) and FoodPreferencesPage (U02)
 * into `FamilyPreferences` so meal generation immediately honors the user's selections.
 */
export function mergeUserFoodPrefsIntoFamilyPreferences(
  base: FamilyPreferences | undefined | null,
  input: {
    householdSize: number;
    spicyLevel?: 'none' | 'mild' | 'medium' | 'hot';
    favoriteCuisines?: readonly string[];
    dietaryRestrictions?: readonly string[];
  },
): FamilyPreferences {
  const seed = base ?? DEFAULT_FAMILY_PREFERENCES;
  const cuisines = new Set<GlobalCuisine>();
  for (const tag of input.favoriteCuisines ?? []) {
    const mapped = CUISINE_TAG_MAP[tag];
    if (mapped) cuisines.add(mapped);
  }
  if (cuisines.size === 0) cuisines.add('vietnamese');

  const hasInternational = [...cuisines].some((c) => c !== 'vietnamese');
  const nextInternationalCount = hasInternational
    ? Math.max(seed.internationalMealsPerWeek, 2)
    : seed.internationalMealsPerWeek;

  // Rebuild managed restriction ingredients from the active restriction chips while
  // preserving custom canonical ingredients the user added manually in planner settings.
  const allManagedRestrictionIngredients = new Set<string>(
    Object.values(RESTRICTION_TAG_TO_INGREDIENTS).flat(),
  );
  const customForbidden = (seed.forbiddenIngredientIds ?? []).filter(
    (id) => !allManagedRestrictionIngredients.has(id),
  );
  const nextForbidden = new Set<string>(customForbidden);

  for (const tag of input.dietaryRestrictions ?? []) {
    const mapped = RESTRICTION_TAG_TO_INGREDIENTS[tag];
    if (mapped) {
      for (const id of mapped) nextForbidden.add(id);
    }
  }
  if (input.spicyLevel === 'none') {
    for (const id of RESTRICTION_TAG_TO_INGREDIENTS.spicy) nextForbidden.add(id);
  }

  const wantsQuick = (input.dietaryRestrictions ?? []).includes('quick_meals');

  const merged = FamilyPreferencesSchema.parse({
    ...seed,
    householdSize: Math.min(20, Math.max(1, Math.round(input.householdSize || 2))),
    preferredCuisines: [...cuisines].slice(0, 14),
    internationalMealsPerWeek: nextInternationalCount,
    mealStyle: wantsQuick ? 'quick' : seed.mealStyle,
    preferredTimeMinutes: wantsQuick ? Math.min(seed.preferredTimeMinutes, 30) : seed.preferredTimeMinutes,
    forbiddenIngredientIds: [...nextForbidden].slice(0, 100),
    allergens: [],
    dietaryProfile: [],
  });

  return merged;
}
