import type { D1DatabaseBinding } from '@frigo/db';
import { computeRecipeNutritionV6, type Recipe } from '@frigo/recipes';
import {
  TakolioAiGateway,
  askSousChef,
  composeFridgeRescueBrief,
  craftHeirloomRecipeWithAi,
  recommendSmartSubstitutions,
  type CulinaryFridgeItem,
  type FridgeRescueBrief,
  type FridgeRescueInput,
  type GatewayStatusReport,
  type HeirloomRecipeBlueprint,
  type HeirloomRecipePromptInput,
  type SmartSubstitutionInput,
  type SmartSubstitutionResponse,
  type SousChefContextInput,
  type SousChefResponse,
} from '@takolio/ai';
import { aiConfigFromEnv } from '../config/ai';
import { fetchHouseholdInventoryFromDb } from '../routes/inventory';
import type { AuthContext, Env } from '../types';

export interface HouseholdCulinarySafetyProfile {
  householdAllergens: string[];
  householdSize: number;
  preferredTimeMinutes?: number;
  spicyLevel?: string;
}

function parseJsonStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((s) => s.trim());
  }
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((s) => s.trim());
    }
  } catch {
    // Ignore malformed legacy JSON strings
  }
  return [];
}

/**
 * Loads authoritative household allergens, dietary restrictions, and forbidden
 * ingredients across `user_preferences`, `member_ranking_preferences`, and
 * `family_meal_preferences` in D1.
 */
export async function loadHouseholdCulinarySafetyProfile(
  db: D1DatabaseBinding | undefined,
  auth: Pick<AuthContext, 'userId' | 'householdId'>,
): Promise<HouseholdCulinarySafetyProfile> {
  const restrictions = new Set<string>();
  let householdSize = 2;
  let preferredTimeMinutes: number | undefined;
  let spicyLevel: string | undefined;

  if (!db) {
    return { householdAllergens: [], householdSize };
  }

  // 1. user_preferences (schema 0001)
  try {
    const userPref = await db
      .prepare('SELECT household_size, spicy_level, dietary_restrictions FROM user_preferences WHERE user_id = ? LIMIT 1')
      .bind(auth.userId)
      .first<{ household_size?: number; spicy_level?: string; dietary_restrictions?: string }>();
    if (userPref) {
      if (typeof userPref.household_size === 'number' && userPref.household_size >= 1) {
        householdSize = userPref.household_size;
      }
      if (typeof userPref.spicy_level === 'string' && userPref.spicy_level.trim()) {
        spicyLevel = userPref.spicy_level.trim();
      }
      for (const item of parseJsonStringArray(userPref.dietary_restrictions)) {
        restrictions.add(item);
      }
    }
  } catch {
    // Table may be absent in minimal test fixtures
  }

  // 2. member_ranking_preferences (schema 0021) — aggregate across household & members
  if (auth.householdId) {
    try {
      const rankingRows = await db
        .prepare('SELECT values_json FROM member_ranking_preferences WHERE household_id = ? LIMIT 25')
        .bind(auth.householdId)
        .all<{ values_json?: string }>();
      for (const row of rankingRows.results || []) {
        if (!row.values_json) continue;
        try {
          const parsed = JSON.parse(row.values_json) as {
            values?: {
              allergens?: unknown;
              forbiddenIngredientIds?: unknown;
              requiredDietaryTags?: unknown;
              preferredTimeMinutes?: unknown;
            };
          };
          const vals = parsed?.values;
          if (!vals) continue;
          for (const item of parseJsonStringArray(vals.allergens)) restrictions.add(item);
          for (const item of parseJsonStringArray(vals.forbiddenIngredientIds)) restrictions.add(item);
          for (const item of parseJsonStringArray(vals.requiredDietaryTags)) restrictions.add(item);
          if (typeof vals.preferredTimeMinutes === 'number' && vals.preferredTimeMinutes >= 5) {
            preferredTimeMinutes = vals.preferredTimeMinutes;
          }
        } catch {
          // Ignore malformed ranking JSON
        }
      }
    } catch {
      // Table may not be migrated in legacy-only test harnesses
    }

    // 3. family_meal_preferences (schema 0042)
    try {
      const familyRows = await db
        .prepare('SELECT preferences_json FROM family_meal_preferences WHERE household_id = ? LIMIT 25')
        .bind(auth.householdId)
        .all<{ preferences_json?: string }>();
      for (const row of familyRows.results || []) {
        if (!row.preferences_json) continue;
        try {
          const parsed = JSON.parse(row.preferences_json) as {
            householdSize?: unknown;
            preferredTimeMinutes?: unknown;
            allergens?: unknown;
            forbiddenIngredientIds?: unknown;
          };
          if (typeof parsed.householdSize === 'number' && parsed.householdSize >= 1) {
            householdSize = parsed.householdSize;
          }
          if (typeof parsed.preferredTimeMinutes === 'number' && parsed.preferredTimeMinutes >= 5) {
            preferredTimeMinutes = parsed.preferredTimeMinutes;
          }
          for (const item of parseJsonStringArray(parsed.allergens)) restrictions.add(item);
          for (const item of parseJsonStringArray(parsed.forbiddenIngredientIds)) restrictions.add(item);
        } catch {
          // Ignore malformed family preference JSON
        }
      }
    } catch {
      // Table may not be migrated in legacy-only test harnesses
    }
  }

  return {
    householdAllergens: [...restrictions],
    householdSize,
    ...(preferredTimeMinutes !== undefined ? { preferredTimeMinutes } : {}),
    ...(spicyLevel !== undefined ? { spicyLevel } : {}),
  };
}

/**
 * Loads the household's live fridge/pantry snapshot from D1 (honoring T11
 * native lot authority when adopted, or legacy `inventory_items` otherwise).
 */
export async function loadHouseholdFridgeSnapshot(
  env: Env,
  auth: Pick<AuthContext, 'userId' | 'householdId'>,
): Promise<CulinaryFridgeItem[]> {
  if (!env.DB || !auth.householdId) return [];
  try {
    const rawItems = await fetchHouseholdInventoryFromDb(env.DB, auth.householdId, env.CACHE, {
      actorId: auth.userId,
      strict: false,
    });
    if (!Array.isArray(rawItems)) return [];
    return rawItems
      .filter((item) => item && typeof item.name === 'string' && Number(item.quantity) > 0)
      .slice(0, 120)
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : undefined,
        name: String(item.name).trim(),
        ingredientId: typeof item.ingredientId === 'string' && item.ingredientId ? item.ingredientId : null,
        quantity: Number(item.quantity) || 1,
        unit: typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim() : 'piece',
        category: typeof item.category === 'string' ? item.category : 'other',
        storage: typeof item.storage === 'string' ? item.storage : 'fridge',
        expiryDate: typeof item.expiryDate === 'string' ? item.expiryDate : null,
        freshness: typeof item.freshness === 'string' ? item.freshness : 'fresh',
      }));
  } catch {
    return [];
  }
}

function mergeAllergens(clientAllergens: readonly string[] | undefined, dbAllergens: readonly string[]): string[] {
  const merged = new Set<string>();
  for (const a of dbAllergens) {
    if (a.trim()) merged.add(a.trim());
  }
  if (clientAllergens) {
    for (const a of clientAllergens) {
      if (a.trim()) merged.add(a.trim());
    }
  }
  return [...merged];
}

function buildGatewayEnv(
  env: Env,
  auth: Pick<AuthContext, 'userId'> | undefined,
  waitUntil?: (promise: Promise<unknown>) => void,
) {
  return {
    QWEN_API_KEY: env.QWEN_API_KEY,
    QWEN_BASE_URL: env.QWEN_BASE_URL,
    QWEN_MODEL: env.QWEN_MODEL,
    QWEN_REQUEST_TIMEOUT_MS: env.QWEN_REQUEST_TIMEOUT_MS,
    DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL: env.DEEPSEEK_BASE_URL,
    DEEPSEEK_FALLBACK_ENABLED: env.DEEPSEEK_FALLBACK_ENABLED,
    GROQ_API_KEY: env.GROQ_API_KEY,
    GROQ_BASE_URL: env.GROQ_BASE_URL,
    GROQ_FALLBACK_ENABLED: env.GROQ_FALLBACK_ENABLED,
    AI: env.AI,
    AI_MOCK_MODE: env.AI_MOCK_MODE,
    AI_ENABLED: env.AI_ENABLED,
    DB: env.DB,
    userId: auth?.userId ?? null,
    waitUntil,
  };
}

export async function runSousChefCopilot(
  env: Env,
  auth: AuthContext,
  input: SousChefContextInput,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<SousChefResponse> {
  const [safetyProfile, dbFridge] = await Promise.all([
    loadHouseholdCulinarySafetyProfile(env.DB, auth),
    input.fridgeItems === undefined ? loadHouseholdFridgeSnapshot(env, auth) : Promise.resolve(input.fridgeItems),
  ]);

  const enriched: SousChefContextInput = {
    ...input,
    fridgeItems: input.fridgeItems ?? dbFridge,
    householdAllergens: mergeAllergens(input.householdAllergens, safetyProfile.householdAllergens),
    servings: input.servings ?? safetyProfile.householdSize,
  };

  return askSousChef(enriched, buildGatewayEnv(env, auth, waitUntil));
}

export async function runSmartSubstitutions(
  env: Env,
  auth: AuthContext,
  input: SmartSubstitutionInput,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<SmartSubstitutionResponse> {
  const [safetyProfile, dbFridge] = await Promise.all([
    loadHouseholdCulinarySafetyProfile(env.DB, auth),
    input.fridgeItems === undefined ? loadHouseholdFridgeSnapshot(env, auth) : Promise.resolve(input.fridgeItems),
  ]);

  const enriched: SmartSubstitutionInput = {
    ...input,
    fridgeItems: input.fridgeItems ?? dbFridge,
    householdAllergens: mergeAllergens(input.householdAllergens, safetyProfile.householdAllergens),
  };

  return recommendSmartSubstitutions(enriched, buildGatewayEnv(env, auth, waitUntil));
}

export async function runFridgeRescueCopilot(
  env: Env,
  auth: AuthContext,
  input: Omit<FridgeRescueInput, 'fridgeItems'> & { fridgeItems?: CulinaryFridgeItem[] },
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<FridgeRescueBrief> {
  const [safetyProfile, dbFridge] = await Promise.all([
    loadHouseholdCulinarySafetyProfile(env.DB, auth),
    input.fridgeItems === undefined ? loadHouseholdFridgeSnapshot(env, auth) : Promise.resolve(input.fridgeItems),
  ]);

  const enriched: FridgeRescueInput = {
    fridgeItems: input.fridgeItems ?? dbFridge,
    householdAllergens: mergeAllergens(input.householdAllergens, safetyProfile.householdAllergens),
    availableCookTimeMinutes: input.availableCookTimeMinutes ?? safetyProfile.preferredTimeMinutes ?? 15,
    servings: input.servings ?? safetyProfile.householdSize,
  };

  return composeFridgeRescueBrief(enriched, buildGatewayEnv(env, auth, waitUntil));
}

export function getAiCopilotGatewayStatus(env: Env): GatewayStatusReport {
  const config = aiConfigFromEnv(env);
  const gateway = new TakolioAiGateway({
    config,
    db: env.DB ?? null,
  });
  return gateway.getStatus();
}

const HEAT_LEVEL_LABELS_VI: Record<string, string> = {
  off: 'Sơ chế nguội',
  low: 'Lửa liu riu',
  medium_low: 'Lửa liu riu',
  medium: 'Lửa vừa',
  medium_high: 'Lửa lớn',
  high: 'Lửa lớn',
};

const COOKWARE_LABELS_VI: Record<string, string> = {
  prep_board: 'Thớt gỗ & Âu sơ chế',
  wok: 'Chảo sâu lòng (Wok)',
  claypot: 'Nồi đất Bát Tràng',
  stockpot: 'Nồi canh đáy dày',
  steamer: 'Xửng hấp tre',
  pan: 'Chảo gang đáy phẳng',
};

export async function runHeirloomRecipeArchitect(
  env: Env,
  auth: AuthContext,
  input: HeirloomRecipePromptInput,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<{
  blueprint: HeirloomRecipeBlueprint;
  recipe: Record<string, unknown>;
}> {
  const safetyProfile = await loadHouseholdCulinarySafetyProfile(env.DB, auth);
  const config = aiConfigFromEnv(env);
  const gateway = new TakolioAiGateway({
    config,
    db: env.DB ?? null,
    waitUntil,
  });

  const blueprint = await craftHeirloomRecipeWithAi(gateway, {
    ...input,
    servings: input.servings ?? safetyProfile.householdSize,
    householdAllergens: mergeAllergens(input.householdAllergens, safetyProfile.householdAllergens),
    userId: auth.userId,
    householdId: auth.householdId,
  });

  const syntheticRecipe: Recipe = {
    id: blueprint.slug,
    slug: blueprint.slug,
    title: blueprint.titleVi,
    description: blueprint.descriptionVi,
    imageUrl: '/takolio/v5/posters/heirloom-poster.webp',
    cuisine: 'vietnamese',
    cookTimeMinutes: blueprint.cookTimeMinutes,
    servings: blueprint.servings,
    difficulty: blueprint.difficulty,
    tags: blueprint.tags,
    ingredients: blueprint.ingredients.map((ing) => ({
      ingredientId: ing.ingredientId,
      name: ing.nameVi || ing.name,
      requiredQuantity: ing.requiredQuantity,
      unit: ing.unit,
      isOptional: Boolean(ing.isOptional),
    })),
    steps: blueprint.steps.map((st) => ({
      stepNumber: st.stepNumber,
      instruction: st.instruction,
      timerMinutes: st.timerMinutes,
      tip: st.tip,
    })),
  };

  const nutritionReport = computeRecipeNutritionV6(syntheticRecipe, blueprint.servings);
  const normalizedRegion = blueprint.region === 'toan_quoc' ? 'all' : blueprint.region;

  return {
    blueprint,
    recipe: {
      title: blueprint.titleVi,
      titleVi: blueprint.titleVi,
      slug: blueprint.slug.startsWith('custom-') ? blueprint.slug : `custom-${blueprint.slug}`,
      description: blueprint.descriptionVi,
      descriptionVi: blueprint.descriptionVi,
      familyStory: blueprint.familyStoryVi ?? input.familyStoryVi ?? '',
      region: normalizedRegion,
      category: blueprint.category,
      prepTimeMinutes: blueprint.prepTimeMinutes,
      cookTimeMinutes: blueprint.cookTimeMinutes,
      servings: blueprint.servings,
      difficulty: blueprint.difficulty,
      caloriesPerServing: nutritionReport.perServing.caloriesKcal,
      proteinGrams: nutritionReport.perServing.proteinG,
      nutritionV6: nutritionReport,
      chefSecret: blueprint.chefSecretVi,
      chefSecretVi: blueprint.chefSecretVi,
      allergenWarningsVi: blueprint.allergenWarningsVi,
      tags: blueprint.tags,
      ingredients: blueprint.ingredients.map((ing) => ({
        ingredientId: ing.ingredientId,
        name: ing.nameVi || ing.name,
        quantity: ing.requiredQuantity,
        requiredQuantity: ing.requiredQuantity,
        unit: ing.unit,
        note: `${ing.formattedAmountVi} · ${ing.prepNoteVi}`,
      })),
      steps: blueprint.steps.map((st) => ({
        stepNumber: st.stepNumber,
        phase: st.phase,
        phaseTitleVi: st.titleVi,
        instruction: st.instruction,
        cookware: COOKWARE_LABELS_VI[st.cookware] ?? st.cookware,
        heatLevel: HEAT_LEVEL_LABELS_VI[st.heatLevel] ?? 'Lửa vừa',
        durationMinutes: st.timerMinutes,
        timerSeconds: st.timerMinutes * 60,
        sensoryCue: st.sensoryCue,
        tip: st.tip,
      })),
    },
  };
}
