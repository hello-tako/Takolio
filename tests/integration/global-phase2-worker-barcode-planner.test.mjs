import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../src/worker/index.ts';
import { SESSION_COOKIE, sha256Hex } from '../../src/worker/utils/session.ts';
import { SqliteD1 } from '../helpers/sqlite-d1.ts';
import { saveRankingPreferences, upsertRecipeContentLocalization } from '../../packages/db/src/index.ts';
import { ALL_RECIPES, createPlanningContext, createRecipeCatalog } from '../../packages/recipes/src/index.ts';
import { buildRoleIndex } from '../../packages/recipes/src/composition/roles.ts';
import { planFamilyMeals } from '../../packages/recipes/src/composition/family-planner.ts';
import { FamilyPreferencesSchema } from '../../packages/domain/src/family-preferences-api.ts';
import {
  captureRecipeContentVersion,
  grantRecipeContentAccess,
  readLocalizedHouseholdRecipeContentVersion,
} from '../../src/worker/services/recipe-content-versions.ts';
import { evaluateCookingHardRestrictions } from '../../src/worker/services/cooking-hard-restrictions.ts';

const JWT_SECRET = 'global-phase2-jwt-secret-32-chars-minimum!!';
const APP_URL = 'https://app.takolio.com';

class MemoryKV {
  store = new Map();
  async get(key, type) {
    const entry = this.store.get(key);
    if (!entry) return null;
    return type === 'json' ? JSON.parse(entry) : entry;
  }
  async put(key, value) {
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  async delete(key) {
    this.store.delete(key);
  }
}

function createWorkerEnv(db) {
  return {
    DB: db,
    CACHE: new MemoryKV(),
    ENVIRONMENT: 'development',
    APP_URL,
    JWT_SECRET,
    OTP_HASH_SECRET: 'global-phase2-otp-secret-32-chars-minimum!!',
    AI_MOCK_MODE: 'true',
  };
}

function createExecutionContext() {
  const pending = [];
  return {
    ctx: {
      waitUntil(promise) {
        pending.push(Promise.resolve(promise).catch(() => {}));
      },
      passThroughOnException() {},
    },
    flush: () => Promise.all(pending),
  };
}

describe('Global Phase 2 — JAN-13/EAN-13 Barcode API, Decoupled Recipe Localizations & Multi-Culture Planner', () => {
  const databases = [];
  afterEach(() => {
    vi.restoreAllMocks();
    for (const db of databases.splice(0)) db.close();
  });

  it('validates GS1 Modulo-10 check digits, resolves JAN-13 & EAN-13 via Open Food Facts, and caches in D1', async () => {
    const db = new SqliteD1();
    databases.push(db);
    const rawToken = 'jp_session_token_phase2';
    const tokenHash = await sha256Hex(rawToken);
    db.seed(`
      INSERT INTO users (id, email, is_guest) VALUES ('u_jp', 'tokyo@jp.example', 0);
      INSERT INTO households (id, name, created_by, locale, country_code, currency, timezone)
      VALUES ('h_jp', '東京のキッチン', 'u_jp', 'ja', 'JP', 'JPY', 'Asia/Tokyo');
      INSERT INTO household_members (id, household_id, user_id, role) VALUES ('hm_jp', 'h_jp', 'u_jp', 'owner');
      INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at)
      VALUES ('sess_jp_p2', 'u_jp', 'h_jp', '${tokenHash}', datetime('now', '+7 days'));
    `);
    const cookieHeader = `${SESSION_COOKIE}=${rawToken}`;
    const env = createWorkerEnv(db);

    // 1. Invalid GS1 check digit rejected with 400 before any network call
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const exec1 = createExecutionContext();
    const badRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/barcodes/4901234567890`, {
        headers: { Cookie: cookieHeader, 'Accept-Language': 'ja-JP' },
      }),
      env,
      exec1.ctx,
    );
    await exec1.flush();
    expect(badRes.status).toBe(400);
    const badJson = await badRes.json();
    expect(badJson.code).toBe('INVALID_BARCODE_CHECK_DIGIT');
    expect(fetchSpy).not.toHaveBeenCalled();

    // 2. Valid Japanese JAN-13 (`4902777000008`: body 490277700000 -> sum=82 -> check=8)
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 1,
          product: {
            code: '4902777000008',
            product_name: '納豆',
            product_name_ja: '納豆',
            product_name_en: 'Natto (fermented soybeans)',
            brands: 'Takano Foods',
            product_quantity: 45,
            product_quantity_unit: 'g',
            nutriscore_grade: 'a',
            allergens_tags: ['en:soybeans'],
            nutriments: {
              'energy-kcal_100g': 200,
              proteins_100g: 16.5,
              fat_100g: 10,
              'saturated-fat_100g': 1.4,
              carbohydrates_100g: 12.1,
              sugars_100g: 0.5,
              fiber_100g: 6.7,
              sodium_100g: 0.002,
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const exec2 = createExecutionContext();
    const janRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/barcodes/4902777000008`, {
        headers: { Cookie: cookieHeader, 'Accept-Language': 'ja-JP' },
      }),
      env,
      exec2.ctx,
    );
    await exec2.flush();
    expect(janRes.status).toBe(200);
    const janBody = await janRes.json();
    expect(janBody).toMatchObject({
      found: true,
      cached: false,
      barcode: '4902777000008',
      symbology: 'JAN13',
      product: {
        productName: '納豆',
        brand: 'Takano Foods',
        canonicalIngredientId: 'NATTO',
        netQuantity: 45,
        netUnit: 'g',
        nutriscoreGrade: 'a',
        allergenTags: ['soybean'],
        allergenLabels: [{ key: 'soybean', label: '大豆' }],
        storageZone: 'fridge',
      },
    });
    expect(janBody.product.nutritionPer100g.energyKj).toBe(837);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // 3. Second request hits D1 `barcode_products` cache (`cached: true`) with ZERO network calls!
    const exec3 = createExecutionContext();
    const cachedRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/barcodes/4902777000008`, {
        headers: { Cookie: cookieHeader, 'Accept-Language': 'en-GB' },
      }),
      env,
      exec3.ctx,
    );
    await exec3.flush();
    const cachedBody = await cachedRes.json();
    expect(cachedBody.cached).toBe(true);
    expect(cachedBody.symbology).toBe('JAN13');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps SHA-256 recipe content fingerprints invariant across Japanese, German, and Vietnamese localizations', async () => {
    const db = new SqliteD1();
    databases.push(db);
    db.seed(`
      INSERT INTO users (id, email, is_guest) VALUES ('u_loc', 'user@eu.example', 0);
      INSERT INTO households (id, name, created_by) VALUES ('h_loc', 'Berlin Home', 'u_loc');
      INSERT INTO household_members (id, household_id, user_id, role) VALUES ('hm_loc', 'h_loc', 'u_loc', 'owner');
    `);

    const sampleRecipe = ALL_RECIPES[0];
    const fingerprint = await captureRecipeContentVersion(db, sampleRecipe);
    await grantRecipeContentAccess(db, 'h_loc', fingerprint);

    await upsertRecipeContentLocalization(db, {
      fingerprint,
      locale: 'ja',
      localizedSlug: `${sampleRecipe.slug}-ja`,
      title: 'ベトナム風トマト卵スープ',
      titleReading: 'べとなむふうとまとたまごすーぷ',
      description: '優しい味わいの家庭スープ',
      steps: sampleRecipe.steps.map((step) => ({
        stepNumber: step.stepNumber,
        instruction: `手順 ${step.stepNumber}: 材料を調理します。`,
      })),
    });

    await upsertRecipeContentLocalization(db, {
      fingerprint,
      locale: 'de',
      localizedSlug: `${sampleRecipe.slug}-de`,
      title: 'Vietnamesische Tomaten-Eier-Suppe',
      description: 'Leichte Familiensuppe',
      steps: sampleRecipe.steps.map((step) => ({
        stepNumber: step.stepNumber,
        instruction: `Schritt ${step.stepNumber}: Zutaten zubereiten.`,
      })),
    });

    const jaView = await readLocalizedHouseholdRecipeContentVersion(db, 'h_loc', fingerprint, 'ja');
    const deView = await readLocalizedHouseholdRecipeContentVersion(db, 'h_loc', fingerprint, 'de');
    const viView = await readLocalizedHouseholdRecipeContentVersion(db, 'h_loc', fingerprint, 'vi');

    expect(jaView?.title).toBe('ベトナム風トマト卵スープ');
    expect(deView?.title).toBe('Vietnamesische Tomaten-Eier-Suppe');
    expect(viView?.title).toBe(sampleRecipe.title);
    // Non-linguistic SHA-256 fingerprint stays 100% identical across all 3 locales!
    expect(jaView?.contentFingerprint).toBe(fingerprint);
    expect(deView?.contentFingerprint).toBe(fingerprint);
    expect(viView?.contentFingerprint).toBe(fingerprint);
  });

  it('composes Japanese Ichiju-sansai, European Abendbrot with bread unlocked, and enforces whole-household member allergens', async () => {
    // 1. Multi-culture family planner test (jp_home & eu_continental)
    const runtimeRecipes = [
      {
        id: 'jp-salmon-shioyaki',
        slug: 'jp-salmon-shioyaki',
        title: '鮭の塩焼き',
        description: 'Grilled salted salmon',
        cuisine: 'japanese',
        region: 'jp_kanto',
        cookTimeMinutes: 15,
        servings: 2,
        difficulty: 'easy',
        imageUrl: '',
        ingredients: [{ ingredientId: 'SALMON_FILLET', name: '鮭', requiredQuantity: 200, unit: 'g' }],
        steps: [{ stepNumber: 1, instruction: '塩を振って焼く' }],
        tags: ['和食'],
      },
      {
        id: 'jp-spinach-ohitashi',
        slug: 'jp-spinach-ohitashi',
        title: 'ほうれん草のおひたし',
        description: 'Spinach ohitashi',
        cuisine: 'japanese',
        region: 'jp_kanto',
        cookTimeMinutes: 10,
        servings: 2,
        difficulty: 'easy',
        imageUrl: '',
        ingredients: [{ ingredientId: 'SPINACH', name: 'ほうれん草', requiredQuantity: 200, unit: 'g' }],
        steps: [{ stepNumber: 1, instruction: '茹でて浸す' }],
        tags: ['副菜'],
      },
      {
        id: 'jp-tofu-miso-soup',
        slug: 'jp-tofu-miso-soup',
        title: '豆腐の味噌汁',
        description: 'Tofu miso soup',
        cuisine: 'japanese',
        region: 'jp_kanto',
        cookTimeMinutes: 10,
        servings: 2,
        difficulty: 'easy',
        imageUrl: '',
        ingredients: [{ ingredientId: 'TOFU', name: '豆腐', requiredQuantity: 1, unit: 'piece' }],
        steps: [{ stepNumber: 1, instruction: '味噌を溶く' }],
        tags: ['汁物'],
      },
      {
        id: 'eu-omelette-herbs',
        slug: 'eu-omelette-herbs',
        title: 'Kräuteromelett',
        description: 'European herb omelette',
        cuisine: 'italian',
        region: 'eu_central',
        cookTimeMinutes: 10,
        servings: 2,
        difficulty: 'easy',
        imageUrl: '',
        ingredients: [{ ingredientId: 'CHICKEN_EGG', name: 'Eier', requiredQuantity: 4, unit: 'piece' }],
        steps: [{ stepNumber: 1, instruction: 'Braten' }],
        tags: ['Abendbrot'],
      },
    ];

    const catalog = createRecipeCatalog({
      source: 'provided',
      ingredientIds: ['SALMON_FILLET', 'SPINACH', 'TOFU', 'RICE', 'CHICKEN_EGG'],
      recipes: runtimeRecipes.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        cuisine: r.cuisine,
        servings: r.servings,
        prepTimeMinutes: 5,
        cookTimeMinutes: r.cookTimeMinutes,
        difficulty: r.difficulty,
        ingredients: r.ingredients,
      })),
    });

    const roles = buildRoleIndex(runtimeRecipes);
    const context = createPlanningContext(() => ({
      snapshotId: 'snap-global-p2',
      referenceInstant: '2026-11-22T09:00:00Z',
      timeZone: 'Asia/Tokyo',
      catalog,
      inventory: [
        { id: 'lot-salmon', version: 1, householdId: 'h-plan', ingredientId: 'SALMON_FILLET', quantity: 600, unit: 'g', freshness: 'fresh', expiryDate: null, expiryKind: 'unknown' },
        { id: 'lot-spinach', version: 1, householdId: 'h-plan', ingredientId: 'SPINACH', quantity: 400, unit: 'g', freshness: 'fresh', expiryDate: null, expiryKind: 'unknown' },
        { id: 'lot-tofu', version: 1, householdId: 'h-plan', ingredientId: 'TOFU', quantity: 2, unit: 'piece', freshness: 'fresh', expiryDate: null, expiryKind: 'unknown' },
        { id: 'lot-rice', version: 1, householdId: 'h-plan', ingredientId: 'RICE', quantity: 1000, unit: 'g', freshness: 'fresh', expiryDate: null, expiryKind: 'unknown' },
        { id: 'lot-egg', version: 1, householdId: 'h-plan', ingredientId: 'CHICKEN_EGG', quantity: 10, unit: 'piece', freshness: 'fresh', expiryDate: null, expiryKind: 'unknown' },
      ],
      rankingContext: { householdId: 'h-plan', userId: 'u-plan', preferences: [], feedback: [] },
    }));

    // Japanese Ichiju-sansai dinner + bento carry-over lunch (0 international meals cap!)
    const jpPlan = planFamilyMeals({
      context,
      request: {
        startDate: '2026-11-23',
        horizonDays: 2,
        defaultServings: 2,
        mode: 'shopping_allowed',
        slots: [
          { date: '2026-11-23', mealType: 'dinner' },
          { date: '2026-11-24', mealType: 'lunch' },
        ],
      },
      preferences: FamilyPreferencesSchema.parse({
        mealCulture: 'jp_home',
        preferredCuisines: ['japanese'],
        preferredRegions: ['jp_kanto'],
        internationalMealsPerWeek: 0,
        bentoFromDinner: true,
      }),
      roles,
      runtimeRecipes,
      revision: 1,
    });
    const jpDinnerRoles = jpPlan.meals[0].components.map((c) => c.role);
    expect(jpDinnerRoles).toEqual(['main', 'vegetable', 'soup', 'staple']);
    expect(jpPlan.internationalGeneratedMainCount).toBe(0);
    // Next day's lunch carries over the non-brothy grilled salmon for Bento!
    expect(jpPlan.meals[1].components.find((c) => c.role === 'main')?.recipeId).toBe('jp-salmon-shioyaki');

    // European Continental Abendbrot dinner: composes ['main', 'staple'] with bread (`sf-bread`) unlocked!
    const euPlan = planFamilyMeals({
      context,
      request: {
        startDate: '2026-11-23',
        horizonDays: 1,
        defaultServings: 2,
        mode: 'shopping_allowed',
        slots: [{ date: '2026-11-23', mealType: 'dinner' }],
      },
      preferences: FamilyPreferencesSchema.parse({
        mealCulture: 'eu_continental',
        preferredCuisines: ['italian', 'german', 'european'],
        preferredRegions: ['eu_central'],
        preferredTimeMinutes: 15,
        internationalMealsPerWeek: 0,
      }),
      roles,
      runtimeRecipes,
      revision: 1,
    });
    expect(euPlan.meals[0].components.map((c) => c.role)).toEqual(['main', 'staple']);
    expect(euPlan.meals[0].components.some((c) => c.simpleFoodId === 'sf-bread')).toBe(true);

    // 2. Whole-household member safety union at cooking boundary:
    // Child member ('u_child') has forbiddenIngredientIds: ['SHRIMP'], parent ('u_parent') tries to cook a shrimp recipe!
    const db = new SqliteD1();
    databases.push(db);
    db.seed(`
      INSERT INTO users (id, email, is_guest) VALUES ('u_parent', 'p@home.test', 0), ('u_child', 'c@home.test', 0);
      INSERT INTO households (id, name, created_by) VALUES ('h_safe', 'Safe Family', 'u_parent');
      INSERT INTO household_members (id, household_id, user_id, role) VALUES
        ('hm_p', 'h_safe', 'u_parent', 'owner'),
        ('hm_c', 'h_safe', 'u_child', 'member');
    `);
    await saveRankingPreferences(
      db,
      { householdId: 'h_safe', userId: 'u_child' },
      {
        scope: 'user',
        values: { forbiddenIngredientIds: ['SHRIMP'] },
        updatedAt: '2026-11-22T00:00:00.000Z',
      },
    );
    const shrimpRecipe = ALL_RECIPES.find((r) => r.ingredients.some((i) => i.ingredientId === 'SHRIMP'));
    expect(shrimpRecipe).toBeDefined();
    const verdict = await evaluateCookingHardRestrictions(
      db,
      { householdId: 'h_safe', userId: 'u_parent' },
      'static',
      shrimpRecipe,
    );
    expect(verdict.blocked).toBe(true);
    expect(verdict.reasons).toContain('FORBIDDEN_INGREDIENT');
  });
});
