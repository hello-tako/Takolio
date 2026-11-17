import type { D1DatabaseBinding } from '@frigo/db';
import type { CuisineType, Recipe } from '@frigo/recipes';

export interface HouseholdDiscoveryContext {
  allergens: string[];
  dietaryRestrictions: string[];
  forbiddenIngredientIds: string[];
  neverRecommendRecipeIds: string[];
  preferredCuisines: CuisineType[];
  spicyLevel: string | null;
  recentCookedRecipeIds: string[];
  hasSafetyFilters: boolean;
}

const VALID_CUISINES = new Set<CuisineType>([
  'vietnamese',
  'korean',
  'japanese',
  'chinese',
  'thai',
  'italian',
]);

interface AllergenRule {
  ingredientIds: string[];
  keywords: string[];
}

const ALLERGEN_RULES: Record<string, AllergenRule> = {
  peanut: {
    ingredientIds: ['PEANUT', 'PEANUT_BUTTER', 'ROASTED_PEANUT'],
    keywords: ['đậu phộng', 'dau phong', 'lạc', 'peanut'],
  },
  peanuts: {
    ingredientIds: ['PEANUT', 'PEANUT_BUTTER', 'ROASTED_PEANUT'],
    keywords: ['đậu phộng', 'dau phong', 'lạc', 'peanut'],
  },
  tree_nut: {
    ingredientIds: ['CASHEW', 'ALMOND', 'WALNUT', 'MACADAMIA', 'CHESTNUT'],
    keywords: ['hạt điều', 'hat dieu', 'hạnh nhân', 'óc chó', 'cashew', 'almond', 'walnut'],
  },
  nuts: {
    ingredientIds: ['PEANUT', 'CASHEW', 'ALMOND', 'WALNUT'],
    keywords: ['đậu phộng', 'hạt điều', 'hạnh nhân', 'óc chó', 'peanut', 'cashew', 'almond'],
  },
  shellfish: {
    ingredientIds: ['SHRIMP', 'CRAB', 'SQUID', 'CLAM', 'OYSTER', 'SCALLOP', 'MUSSEL', 'PRAWN', 'DRIED_SHRIMP', 'SHRIMP_PASTE'],
    keywords: ['tôm', 'cua', 'ghẹ', 'mực', 'nghêu', 'ngao', 'sò', 'hàu', 'mắm tôm', 'shrimp', 'crab', 'squid', 'clam', 'shellfish'],
  },
  seafood: {
    ingredientIds: [
      'SHRIMP', 'CRAB', 'SQUID', 'CLAM', 'OYSTER', 'SCALLOP', 'MUSSEL', 'PRAWN', 'DRIED_SHRIMP', 'SHRIMP_PASTE',
      'FISH', 'SALMON', 'SNAKEHEAD_FISH', 'CATFISH', 'MACKEREL', 'TUNA', 'TILAPIA', 'BASA_FISH', 'ANCHOVY',
    ],
    keywords: ['hải sản', 'tôm', 'cua', 'ghẹ', 'mực', 'nghêu', 'ngao', 'sò', 'hàu', 'cá ', 'cá lóc', 'cá hồi', 'cá thu', 'cá basa', 'cá trê', 'seafood', 'shrimp', 'salmon'],
  },
  fish: {
    ingredientIds: ['FISH', 'SALMON', 'SNAKEHEAD_FISH', 'CATFISH', 'MACKEREL', 'TUNA', 'TILAPIA', 'BASA_FISH', 'ANCHOVY', 'FISH_SAUCE'],
    keywords: ['cá lóc', 'cá hồi', 'cá thu', 'cá basa', 'cá trê', 'cá rô', 'cá chép', 'cá ngừ', 'nước mắm', 'fish', 'salmon', 'tuna'],
  },
  milk: {
    ingredientIds: ['MILK', 'FRESH_MILK', 'CONDENSED_MILK', 'BUTTER', 'CHEESE', 'CREAM', 'WHIPPING_CREAM', 'YOGURT', 'MOZZARELLA', 'PARMESAN'],
    keywords: ['sữa', 'phô mai', 'bơ lạt', 'kem tươi', 'milk', 'cheese', 'butter', 'cream', 'yogurt'],
  },
  dairy: {
    ingredientIds: ['MILK', 'FRESH_MILK', 'CONDENSED_MILK', 'BUTTER', 'CHEESE', 'CREAM', 'WHIPPING_CREAM', 'YOGURT', 'MOZZARELLA', 'PARMESAN'],
    keywords: ['sữa', 'phô mai', 'bơ lạt', 'kem tươi', 'milk', 'cheese', 'butter', 'cream', 'yogurt'],
  },
  egg: {
    ingredientIds: ['CHICKEN_EGG', 'DUCK_EGG', 'QUAIL_EGG', 'EGG', 'SALTED_EGG', 'CENTURY_EGG'],
    keywords: ['trứng', 'egg'],
  },
  eggs: {
    ingredientIds: ['CHICKEN_EGG', 'DUCK_EGG', 'QUAIL_EGG', 'EGG', 'SALTED_EGG', 'CENTURY_EGG'],
    keywords: ['trứng', 'egg'],
  },
  gluten: {
    ingredientIds: ['WHEAT_FLOUR', 'ALL_PURPOSE_FLOUR', 'BREAD', 'PASTA', 'SPAGHETTI', 'UDON', 'RAMEN', 'EGG_NOODLE', 'INSTANT_NOODLE', 'BREADCRUMBS'],
    keywords: ['bột mì', 'bánh mì', 'mì ý', 'mì trứng', 'mì gói', 'udon', 'ramen', 'pasta', 'wheat', 'gluten'],
  },
  wheat: {
    ingredientIds: ['WHEAT_FLOUR', 'ALL_PURPOSE_FLOUR', 'BREAD', 'PASTA', 'SPAGHETTI', 'UDON', 'RAMEN', 'EGG_NOODLE', 'INSTANT_NOODLE', 'BREADCRUMBS'],
    keywords: ['bột mì', 'bánh mì', 'mì ý', 'mì trứng', 'wheat'],
  },
  soy: {
    ingredientIds: ['TOFU', 'SOY_SAUCE', 'SOYBEAN', 'SOY_MILK', 'EDAMAME', 'FERMENTED_TOFU', 'MISO'],
    keywords: ['đậu phụ', 'đậu hũ', 'nước tương', 'xì dầu', 'đậu nành', 'tương miso', 'tofu', 'soy'],
  },
  sesame: {
    ingredientIds: ['SESAME', 'SESAME_OIL', 'SESAME_SEED', 'WHITE_SESAME', 'BLACK_SESAME'],
    keywords: ['dầu mè', 'hạt mè', 'vừng', 'sesame'],
  },
  beef: {
    ingredientIds: ['BEEF', 'BEEF_SHANK', 'BEEF_BRISKET', 'BEEF_TENDERLOIN', 'MINCED_BEEF', 'BEEF_RIB'],
    keywords: ['thịt bò', 'bắp bò', 'gân bò', 'bò bằm', 'ba chỉ bò', 'beef'],
  },
  pork: {
    ingredientIds: ['PORK', 'PORK_BELLY', 'PORK_RIB', 'MINCED_PORK', 'PORK_SHOULDER', 'PORK_LOIN', 'BACON', 'PORK_SAUSAGE'],
    keywords: ['thịt heo', 'thịt lợn', 'ba chỉ', 'sườn non', 'sườn heo', 'thịt bằm', 'chả lụa', 'xúc xích heo', 'pork', 'bacon'],
  },
  mushroom: {
    ingredientIds: ['MUSHROOM', 'SHIITAKE_MUSHROOM', 'WOOD_EAR_MUSHROOM', 'ENOKI_MUSHROOM', 'OYSTER_MUSHROOM', 'STRAW_MUSHROOM', 'KING_OYSTER_MUSHROOM', 'BUTTON_MUSHROOM'],
    keywords: ['nấm ', 'nấm hương', 'nấm đông cô', 'nấm kim châm', 'nấm rơm', 'nấm bào ngư', 'nấm đùi gà', 'mộc nhĩ', 'mushroom'],
  },
  onion_garlic: {
    ingredientIds: ['ONION', 'GARLIC', 'SHALLOT', 'SPRING_ONION', 'SCALLION', 'CHIVE', 'LEEK'],
    keywords: ['hành tây', 'hành tím', 'hành khô', 'hành lá', 'tỏi', 'hẹ', 'tỏi tây', 'onion', 'garlic', 'shallot', 'scallion'],
  },
  spicy: {
    ingredientIds: ['CHILI', 'BIRD_EYE_CHILI', 'CHILI_POWDER', 'CHILI_PASTE', 'GOCHUJANG', 'GOCHUGARU', 'SATE_SAUCE', 'CHILI_SAUCE'],
    keywords: ['ớt hiểm', 'ớt chỉ thiên', 'ớt bột', 'sa tế', 'tương ớt Hàn Quốc', 'gochujang', 'cay nồng'],
  },
};

const NON_VEGETARIAN_IDS = new Set([
  ...ALLERGEN_RULES.beef.ingredientIds,
  ...ALLERGEN_RULES.pork.ingredientIds,
  ...ALLERGEN_RULES.seafood.ingredientIds,
  ...ALLERGEN_RULES.fish.ingredientIds,
  'CHICKEN', 'CHICKEN_BREAST', 'CHICKEN_THIGH', 'CHICKEN_WING', 'WHOLE_CHICKEN', 'DUCK', 'FISH_SAUCE', 'OYSTER_SAUCE',
]);

const NON_VEGETARIAN_KEYWORDS = [
  'thịt bò', 'thịt heo', 'thịt lợn', 'thịt gà', 'cánh gà', 'đùi gà', 'ức gà', 'thịt vịt',
  'sườn', 'ba chỉ', 'tôm', 'cua', 'mực', 'cá ', 'nước mắm', 'dầu hào', 'mắm tôm',
];

function safeJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function dietaryTagsToForbiddenIngredients(tags: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of tags) {
    const key = raw.trim().toLowerCase();
    const rule = ALLERGEN_RULES[key];
    if (rule) {
      for (const id of rule.ingredientIds) out.add(id);
    }
  }
  return [...out];
}

export async function loadHouseholdDiscoveryContext(
  db: D1DatabaseBinding | undefined,
  scope: { householdId: string; userId: string },
): Promise<HouseholdDiscoveryContext> {
  if (!db || !scope.householdId || !scope.userId || scope.userId === 'guest_anonymous') {
    return {
      allergens: [],
      dietaryRestrictions: [],
      forbiddenIngredientIds: [],
      neverRecommendRecipeIds: [],
      preferredCuisines: [],
      spicyLevel: null,
      recentCookedRecipeIds: [],
      hasSafetyFilters: false,
    };
  }

  try {
    const [userPrefsRes, memberRankRes, hhRankRes, cookedRes] = await db.batch([
      db
        .prepare(
          `SELECT up.user_id, up.spicy_level, up.favorite_cuisines, up.dietary_restrictions
             FROM user_preferences up
            WHERE up.user_id = ?
               OR up.user_id IN (SELECT hm.user_id FROM household_members hm WHERE hm.household_id = ?)`
        )
        .bind(scope.userId, scope.householdId),
      db
        .prepare('SELECT values_json FROM member_ranking_preferences WHERE household_id = ?')
        .bind(scope.householdId),
      db
        .prepare('SELECT values_json FROM household_ranking_preferences WHERE household_id = ? LIMIT 1')
        .bind(scope.householdId),
      db
        .prepare(
          `SELECT DISTINCT recipe_id
             FROM cooked_meals
            WHERE household_id = ?
            ORDER BY completed_at DESC
            LIMIT 30`
        )
        .bind(scope.householdId),
    ]);

    const allergens = new Set<string>();
    const dietaryRestrictions = new Set<string>();
    const forbiddenIngredientIds = new Set<string>();
    const neverRecommendRecipeIds = new Set<string>();
    const preferredCuisines: CuisineType[] = [];
    let spicyLevel: string | null = null;

    for (const row of (userPrefsRes.results ?? []) as Array<{
      user_id: string;
      spicy_level: string | null;
      favorite_cuisines: string | null;
      dietary_restrictions: string | null;
    }>) {
      for (const d of safeJsonArray(row.dietary_restrictions)) {
        const cleaned = d.trim().toLowerCase();
        if (cleaned && cleaned !== 'other') dietaryRestrictions.add(cleaned);
      }
      if (row.user_id === scope.userId) {
        spicyLevel = row.spicy_level ?? null;
        for (const c of safeJsonArray(row.favorite_cuisines)) {
          if (VALID_CUISINES.has(c as CuisineType) && !preferredCuisines.includes(c as CuisineType)) {
            preferredCuisines.push(c as CuisineType);
          }
        }
      }
    }

    const rankingRows = [
      ...((hhRankRes.results ?? []) as Array<{ values_json: string }>),
      ...((memberRankRes.results ?? []) as Array<{ values_json: string }>),
    ];
    for (const r of rankingRows) {
      try {
        const parsed = JSON.parse(r.values_json);
        const values = parsed?.values ?? {};
        for (const a of safeJsonArray(values.allergens)) {
          if (a.trim()) allergens.add(a.trim().toLowerCase());
        }
        for (const f of safeJsonArray(values.forbiddenIngredientIds)) {
          if (f.trim()) forbiddenIngredientIds.add(f.trim().toUpperCase());
        }
        for (const n of safeJsonArray(values.neverRecommendRecipeIds)) {
          if (n.trim()) neverRecommendRecipeIds.add(n.trim());
        }
        if (preferredCuisines.length === 0) {
          for (const c of safeJsonArray(values.preferredCuisines)) {
            if (VALID_CUISINES.has(c as CuisineType) && !preferredCuisines.includes(c as CuisineType)) {
              preferredCuisines.push(c as CuisineType);
            }
          }
        }
      } catch {
        // Ignore malformed legacy preference JSON
      }
    }

    const recentCookedRecipeIds = ((cookedRes.results ?? []) as Array<{ recipe_id: string }>)
      .map((r) => r.recipe_id)
      .filter((id) => typeof id === 'string' && id.length > 0);

    const hasSafetyFilters =
      allergens.size > 0 ||
      dietaryRestrictions.size > 0 ||
      forbiddenIngredientIds.size > 0 ||
      neverRecommendRecipeIds.size > 0;

    return {
      allergens: [...allergens].sort(),
      dietaryRestrictions: [...dietaryRestrictions].sort(),
      forbiddenIngredientIds: [...forbiddenIngredientIds].sort(),
      neverRecommendRecipeIds: [...neverRecommendRecipeIds].sort(),
      preferredCuisines,
      spicyLevel,
      recentCookedRecipeIds,
      hasSafetyFilters,
    };
  } catch {
    return {
      allergens: [],
      dietaryRestrictions: [],
      forbiddenIngredientIds: [],
      neverRecommendRecipeIds: [],
      preferredCuisines: [],
      spicyLevel: null,
      recentCookedRecipeIds: [],
      hasSafetyFilters: false,
    };
  }
}

export function filterSafeRecipes(recipes: Recipe[], ctx: HouseholdDiscoveryContext): Recipe[] {
  if (!ctx.hasSafetyFilters) return recipes;

  const forbiddenSet = new Set(ctx.forbiddenIngredientIds);
  const neverSet = new Set(ctx.neverRecommendRecipeIds);
  const activeTags = new Set([...ctx.allergens, ...ctx.dietaryRestrictions]);
  const requireVegetarian = activeTags.has('vegetarian') || activeTags.has('vegan') || activeTags.has('chay');

  for (const tag of activeTags) {
    const rule = ALLERGEN_RULES[tag];
    if (rule) {
      for (const id of rule.ingredientIds) forbiddenSet.add(id);
    }
    // If a tag looks like a canonical ingredient ID (e.g. 'PEANUT' or 'SHRIMP'), enforce directly too.
    if (/^[A-Z0-9_]{2,}$/.test(tag.toUpperCase()) && !ALLERGEN_RULES[tag]) {
      forbiddenSet.add(tag.toUpperCase());
    }
  }

  return recipes.filter((recipe) => {
    if (neverSet.has(recipe.id)) return false;

    for (const line of recipe.ingredients) {
      const ingId = line.ingredientId.toUpperCase();
      if (forbiddenSet.has(ingId)) return false;
      if (requireVegetarian && NON_VEGETARIAN_IDS.has(ingId)) return false;
    }

    const lowerIngredients = recipe.ingredients.map((l) => ` ${l.name.toLowerCase()} `);
    const lowerTags = (recipe.tags ?? []).map((t) => t.toLowerCase());

    if (requireVegetarian) {
      if (recipe.category !== 'mon_chay' && !lowerTags.includes('chay') && !lowerTags.includes('vegetarian')) {
        for (const kw of NON_VEGETARIAN_KEYWORDS) {
          if (lowerIngredients.some((name) => name.includes(kw))) return false;
        }
      }
    }

    for (const tag of activeTags) {
      const rule = ALLERGEN_RULES[tag];
      if (!rule) continue;
      for (const kw of rule.keywords) {
        if (lowerIngredients.some((name) => name.includes(kw))) return false;
      }
    }

    return true;
  });
}
