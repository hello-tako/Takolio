import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { findCulinaryIngredientV4 } from '@takolio/domain';
import {
  ALL_DISH_PHOTO_SLUGS_V5,
  ALL_RECIPES,
  DISH_PHOTO_V5_BASE_PATH,
  DISH_PHOTO_V5_FALLBACK_URL,
  REGIONAL_MASTERPIECES_V5,
  createRecipeAuthoritySnapshot,
  enrichRecipeToV4,
  evaluateRecipeDietarySafetyV4,
  expandCatalogWithV5Masterpieces,
  isCanonicalRecipeIdShape,
  resolveRecipeArtworkV4,
  scaleRecipeV4,
  standardizeRecipeCulinaryV5,
  standardizeRecipeTitleV5,
  toRuntimeRecipe,
  type DishPhotoSlugV5,
  type Recipe,
} from '../../index';
import { DiscoveryPageSchema, DiscoveryQuerySchema } from '../../discovery-contract';
import { authMiddleware } from '../../../../../src/worker/middleware/auth';
import { recipeRoutes } from '../../../../../src/worker/routes/recipes';
import { resetRecipeAuthorityCacheForTests } from '../../../../../src/worker/services/recipe-authority';
import { discoverRecipes } from '../../../../../src/worker/services/recipe-discovery';
import type { AuthContext, Env } from '../../../../../src/worker/types';
import { signJwt } from '../../../../../src/worker/utils/jwt';

const VALID_STANDARD_UNITS = new Set(['g', 'kg', 'ml', 'l', 'piece', 'pack', 'bunch', 'slice']);

function createMockWorkerDb(): Env['DB'] {
  const contentVersions = new Map<string, { recipe_id: string; slug: string; content_json: string }>();
  const contentAccess = new Set<string>();

  const makeStmt = (sql: string, bindings: unknown[] = []) => ({
    bind: (...args: unknown[]) => makeStmt(sql, args),
    all: async <T = unknown>() => {
      if (sql.includes('FROM household_members')) {
        return {
          success: true,
          results: [{ present: 1, role: 'owner', household_id: 'v5-house', user_id: 'v5-user' }] as unknown as T[],
        };
      }
      if (sql.includes('FROM inventory_items')) {
        return {
          success: true,
          results: [
            {
              id: 'lot-pork-1',
              household_id: 'v5-house',
              ingredient_id: 'PORK_BELLY',
              name: 'Thịt ba chỉ',
              quantity: 500,
              unit: 'g',
              category: 'meat',
              storage: 'fridge',
              freshness: 'fresh',
              data_source: 'manual',
              added_date: '2026-01-01',
              updated_at: '2026-01-01',
              version: 1,
            },
          ] as unknown as T[],
        };
      }
      return { success: true, results: [] as T[] };
    },
    first: async <T = unknown>() => {
      if (sql.includes('FROM household_members')) {
        return { role: 'owner', household_id: 'v5-house', user_id: 'v5-user' } as unknown as T;
      }
      if (sql.includes('FROM recipe_content_versions WHERE fingerprint = ?')) {
        const fp = String(bindings[0] ?? '');
        return (contentVersions.get(fp) ?? null) as unknown as T;
      }
      if (sql.includes('FROM recipe_content_access')) {
        const key = `${String(bindings[0] ?? '')}:${String(bindings[1] ?? '')}`;
        return (contentAccess.has(key) ? { allowed: 1 } : null) as unknown as T;
      }
      return null;
    },
    run: async () => {
      if (sql.includes('INSERT INTO recipe_content_versions')) {
        const [fp, recipeId, slug, contentJson] = bindings as [string, string, string, string];
        if (!contentVersions.has(fp)) {
          contentVersions.set(fp, { recipe_id: recipeId, slug, content_json: contentJson });
        }
      }
      if (sql.includes('INSERT OR IGNORE INTO recipe_content_access')) {
        const [hhId, fp] = bindings as [string, string];
        contentAccess.add(`${hhId}:${fp}`);
      }
      return { success: true, meta: { changes: 1 } };
    },
  });

  return {
    prepare: (sql: string) => makeStmt(sql),
    batch: async (stmts: Array<{ all?: () => Promise<unknown>; run?: () => Promise<unknown> }>) => {
      const out = [];
      for (const s of stmts) {
        if (typeof s.all === 'function') out.push(await s.all());
        else if (typeof s.run === 'function') out.push(await s.run());
        else out.push({ success: true, results: [] });
      }
      return out;
    },
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as Env['DB'];
}

describe('Takolio V5 — 32 Live-Action 35mm Dish Photos Mapping', () => {
  it('registers all 32 unique WebP dish photo slugs under /takolio/v5/dishes/', () => {
    expect(ALL_DISH_PHOTO_SLUGS_V5).toHaveLength(32);
    expect(new Set(ALL_DISH_PHOTO_SLUGS_V5).size).toBe(32);
    expect(DISH_PHOTO_V5_BASE_PATH).toBe('/takolio/v5/dishes');
    expect(DISH_PHOTO_V5_FALLBACK_URL).toBe('/takolio/v5/dishes/thit-kho-tau.webp');
  });

  it('maps every single one of the 32 dish photo slugs deterministically from culinary dish signatures', () => {
    const cases: Array<[Parameters<typeof resolveRecipeArtworkV4>[0], DishPhotoSlugV5]> = [
      [{ cuisine: 'japanese', title: 'Oyakodon' }, 'gl-japanese-donburi'],
      [{ cuisine: 'korean', title: 'Bibimbap' }, 'gl-korean-bibimbap'],
      [{ cuisine: 'italian', title: 'Pasta Pomodoro' }, 'gl-italian-pasta'],
      [{ cuisine: 'thai', title: 'Thai Green Curry' }, 'gl-thai-curry'],
      [{ cuisine: 'chinese', title: 'Mapo Tofu' }, 'gl-chinese-wok'],
      [{ cuisine: 'vietnamese', title: 'Thịt kho tàu trứng vịt' }, 'thit-kho-tau'],
      [{ cuisine: 'vietnamese', title: 'Cá bống sông Trà kho tiêu' }, 'ca-kho-to'],
      [{ cuisine: 'vietnamese', title: 'Gà kho gừng sả' }, 'ga-kho-gung'],
      [{ cuisine: 'vietnamese', title: 'Sườn xào chua ngọt' }, 'suon-xao-chua-ngot'],
      [{ cuisine: 'vietnamese', title: 'Tôm rim mắm tỏi' }, 'tom-rim-mam'],
      [{ cuisine: 'vietnamese', title: 'Bò kho bánh mì sả quế' }, 'bo-kho-banh-mi'],
      [{ cuisine: 'vietnamese', title: 'Vịt nấu chao khoai môn' }, 'bo-kho-banh-mi'],
      [{ cuisine: 'vietnamese', title: 'Bò lúc lắc tiêu xanh' }, 'bo-xao-can-toi'],
      [{ cuisine: 'vietnamese', title: 'Rau muống xào tỏi' }, 'rau-muong-xao'],
      [{ cuisine: 'vietnamese', title: 'Canh cua rau đay mồng tơi' }, 'canh-cua-rau-day'],
      [{ cuisine: 'vietnamese', title: 'Canh khổ qua nhồi thịt' }, 'canh-kho-qua'],
      [{ cuisine: 'vietnamese', title: 'Canh bí đỏ hầm sườn non' }, 'canh-bi-do-suon'],
      [{ cuisine: 'vietnamese', title: 'Canh ngao nấu chua thì là' }, 'canh-ngao-chua'],
      [{ cuisine: 'vietnamese', title: 'Canh chua cá lóc' }, 'canh-chua-ca'],
      [{ cuisine: 'vietnamese', title: 'Đậu phụ sốt cà chua' }, 'dau-phu-sot-ca'],
      [{ cuisine: 'vietnamese', title: 'Trứng chiên thịt bằm' }, 'trung-chien-thit'],
      [{ cuisine: 'vietnamese', title: 'Cánh gà chiên nước mắm' }, 'canh-ga-chien-mam'],
      [{ cuisine: 'vietnamese', title: 'Nem rán Hà Nội' }, 'nem-ran-cha-gio'],
      [{ cuisine: 'vietnamese', title: 'Cá tai tượng chiên xù' }, 'ca-chien-mam-gung'],
      [{ cuisine: 'vietnamese', title: 'Gà hấp lá chanh' }, 'ga-hap-la-chanh'],
      [{ cuisine: 'vietnamese', title: 'Thịt luộc cà pháo mắm tôm' }, 'thit-luoc-ca-phao'],
      [{ cuisine: 'vietnamese', title: 'Rau củ luộc kho quẹt' }, 'rau-luoc-kho-quet'],
      [{ cuisine: 'vietnamese', title: 'Bún bò Huế giò heo' }, 'bun-bo-hue'],
      [{ cuisine: 'vietnamese', title: 'Mì Quảng tôm thịt' }, 'bun-bo-hue'],
      [{ cuisine: 'vietnamese', title: 'Bún chả Hà Nội' }, 'bun-cha-ha-noi'],
      [{ cuisine: 'vietnamese', title: 'Phở bò tái lăn' }, 'pho-bo-ha-noi'],
      [{ cuisine: 'vietnamese', title: 'Hủ tiếu Nam Vang' }, 'pho-bo-ha-noi'],
      [{ cuisine: 'vietnamese', title: 'Cơm tấm sườn bì chả' }, 'com-tam-suon'],
      [{ cuisine: 'vietnamese', title: 'Cháo gà gừng hành' }, 'chao-ga-gung'],
      [{ cuisine: 'vietnamese', title: 'Gỏi cuốn tôm thịt' }, 'goi-cuon-tom-thit'],
    ];

    const matchedSlugs = new Set<DishPhotoSlugV5>();
    for (const [input, expectedSlug] of cases) {
      const resolved = resolveRecipeArtworkV4(input);
      expect(resolved.photoSlug, JSON.stringify(input)).toBe(expectedSlug);
      expect(resolved.url).toBe(`${DISH_PHOTO_V5_BASE_PATH}/${expectedSlug}.webp`);
      expect(resolved.fallbackUrl).toBe(DISH_PHOTO_V5_FALLBACK_URL);
      matchedSlugs.add(resolved.photoSlug);
    }

    expect(matchedSlugs.size).toBe(32);
  });
});

describe('Takolio V5 — Culinary Title Normalizer & 85 3-Region Masterpieces', () => {
  it('normalizes awkward/typo Vietnamese and imported titles cleanly', () => {
    expect(standardizeRecipeTitleV5('Canh cà chua trứng nhà lá')).toBe(
      'Canh cà chua trứng vân mây hành lá',
    );
    expect(standardizeRecipeTitleV5('Gà kho gừng ớt hiếm')).toBe(
      'Gà ta kho gừng ớt hiểm cay ấm',
    );
    expect(standardizeRecipeTitleV5('Canh su su băm thịt')).toBe(
      'Canh su su nấu thịt bằm ngọt thanh',
    );
    expect(standardizeRecipeTitleV5('Gà parmigiana nướng')).toBe(
      'Ức gà đút lò phô mai sốt cà Ý (Parmigiana)',
    );
    expect(standardizeRecipeTitleV5('Cơm trộn trứng tan Nhật')).toBe(
      'Cơm nóng trộn trứng lòng đào kiểu Nhật (Tamago)',
    );
    expect(standardizeRecipeTitleV5('Cháo trứng Trung')).toBe(
      'Cháo trứng gà sánh mịn gừng hành ấm bụng',
    );
    expect(standardizeRecipeTitleV5('Tôm chiên trứng mỏng')).toBe(
      'Tôm tươi chiên áo trứng vàng giòn',
    );
    expect(standardizeRecipeTitleV5('  Cá   kho   ớt hiếm   nhà lá  ')).toBe(
      'Cá kho ớt hiểm hành lá',
    );

    const standardized = standardizeRecipeCulinaryV5({
      ...ALL_RECIPES[0],
      slug: 'canh-ca-chua-trung-van-may',
      title: 'Canh cà chua trứng nhà lá',
      imageUrl: '',
    });
    expect(standardized.title).toBe('Canh cà chua trứng vân mây hành lá');
    expect(standardized.imageUrl).toBe('/takolio/v5/dishes/canh-chua-ca.webp');
  });

  it('validates all 85 regional masterpieces across Bắc (30), Trung (28), Nam (27) with full V4/Runtime compliance', () => {
    expect(REGIONAL_MASTERPIECES_V5).toHaveLength(85);

    const bac = REGIONAL_MASTERPIECES_V5.filter((r) => r.region === 'bac');
    const trung = REGIONAL_MASTERPIECES_V5.filter((r) => r.region === 'trung');
    const nam = REGIONAL_MASTERPIECES_V5.filter((r) => r.region === 'nam');

    expect(bac).toHaveLength(30);
    expect(trung).toHaveLength(28);
    expect(nam).toHaveLength(27);

    expect(bac.map((r) => r.id)).toEqual(
      Array.from({ length: 30 }, (_, i) => `v5-bac-${String(i + 1).padStart(2, '0')}`),
    );
    expect(trung.map((r) => r.id)).toEqual(
      Array.from({ length: 28 }, (_, i) => `v5-trung-${String(i + 1).padStart(2, '0')}`),
    );
    expect(nam.map((r) => r.id)).toEqual(
      Array.from({ length: 27 }, (_, i) => `v5-nam-${String(i + 1).padStart(2, '0')}`),
    );

    const staticSlugs = new Set(ALL_RECIPES.map((r) => r.slug));
    const v5Slugs = new Set<string>();
    const validPhotoUrls = new Set(
      ALL_DISH_PHOTO_SLUGS_V5.map((slug) => `${DISH_PHOTO_V5_BASE_PATH}/${slug}.webp`),
    );

    for (const recipe of REGIONAL_MASTERPIECES_V5) {
      expect(isCanonicalRecipeIdShape(recipe.id), recipe.id).toBe(true);
      expect(v5Slugs.has(recipe.slug), `Duplicate V5 slug: ${recipe.slug}`).toBe(false);
      expect(staticSlugs.has(recipe.slug), `Collision with static slug: ${recipe.slug}`).toBe(false);
      v5Slugs.add(recipe.slug);

      expect(() => toRuntimeRecipe(recipe)).not.toThrow();
      expect(recipe.nutrition).toBeDefined();
      expect(recipe.nutrition!.calories).toBeGreaterThan(100);
      expect(recipe.ingredients.length).toBeGreaterThanOrEqual(4);
      expect(recipe.ingredients.length).toBeLessThanOrEqual(6);
      expect(recipe.steps.length).toBeGreaterThanOrEqual(4);
      expect(recipe.steps.length).toBeLessThanOrEqual(5);
      expect(recipe.steps.some((s) => Boolean(s.tip))).toBe(true);
      expect(recipe.steps.some((s) => typeof s.timerMinutes === 'number' && s.timerMinutes > 0)).toBe(true);
      expect(validPhotoUrls.has(recipe.imageUrl), `${recipe.id} invalid photo ${recipe.imageUrl}`).toBe(true);

      for (const ing of recipe.ingredients) {
        expect(VALID_STANDARD_UNITS.has(ing.unit), `${recipe.id} invalid unit ${ing.unit}`).toBe(true);
        expect(ing.ingredientId).toMatch(/^[A-Z0-9_]+$/);
        expect(
          findCulinaryIngredientV4(ing.ingredientId, ing.name),
          `${recipe.id} unresolved ingredient ${ing.ingredientId}`,
        ).not.toBeNull();
      }

      const enriched = enrichRecipeToV4(recipe);
      expect(enriched.prepTimeMinutes).toBeGreaterThan(0);
      expect(validPhotoUrls.has(enriched.artwork.url)).toBe(true);
      expect(scaleRecipeV4(recipe, 6).ingredients.length).toBe(recipe.ingredients.length);
      expect(evaluateRecipeDietarySafetyV4(recipe, {}).safe).toBe(true);
    }

    const expandedStatic = expandCatalogWithV5Masterpieces(ALL_RECIPES);
    expect(expandedStatic).toHaveLength(71 + 85);
  });
});

describe('Takolio V5 — Worker RECIPE_CATALOG_V5_EXPANDED Gate (Zero Existing Regression)', () => {
  it('expands static 71 -> 156 and 500 -> 585 only when RECIPE_CATALOG_V5_EXPANDED === "true"', async () => {
    const db = createMockWorkerDb();
    const secret = 'v5-catalog-test-secret-with-at-least-thirty-two-chars';
    const auth: AuthContext = { userId: 'v5-user', householdId: 'v5-house', isGuest: false };
    const token = await signJwt(
      {
        sub: auth.userId,
        hid: auth.householdId,
        typ: 'access',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secret,
    );

    const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
    app.use('*', authMiddleware);
    app.route('/', recipeRoutes);
    resetRecipeAuthorityCacheForTests();

    const baseStaticEnv: Env = {
      DB: db,
      ENVIRONMENT: 'test',
      JWT_SECRET: secret,
      RECIPE_CATALOG_MODE: 'static',
    };

    try {
      // 1. Gate OFF (default): static catalog stays strictly 71
      const unexpandedRes = await app.fetch(
        new Request('https://v5.local/recommendations', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        baseStaticEnv,
      );
      expect(unexpandedRes.status).toBe(200);
      const unexpandedRecs = (await unexpandedRes.json()) as { total: number };
      expect(unexpandedRecs.total).toBe(71);

      // 2. Gate ON ('true'): static catalog expands to 71 + 85 = 156 across /recipes, /recommendations, /recipe-discovery
      const expandedEnv: Env = { ...baseStaticEnv, RECIPE_CATALOG_V5_EXPANDED: 'true' };
      const expandedRecsRes = await app.fetch(
        new Request('https://v5.local/recommendations', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        expandedEnv,
      );
      expect(expandedRecsRes.status).toBe(200);
      expect(((await expandedRecsRes.json()) as { total: number }).total).toBe(156);

      const page1Res = await app.fetch(
        new Request('https://v5.local/recipe-discovery', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        expandedEnv,
      );
      expect(page1Res.status).toBe(200);
      const page1 = DiscoveryPageSchema.parse(await page1Res.json());
      expect(page1.total).toBe(156);
      expect(page1.nextCursor).toBeTruthy();

      const page2Res = await app.fetch(
        new Request(`https://v5.local/recipe-discovery?page=2&cursor=${page1.nextCursor}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        expandedEnv,
      );
      expect(page2Res.status).toBe(200);
      expect(DiscoveryPageSchema.parse(await page2Res.json()).page).toBe(2);

      // 3. 500-recipe D1 snapshot + Gate ON -> 585 recipes with normalized titles
      const syntheticD1Catalog: Recipe[] = [
        ...ALL_RECIPES,
        ...Array.from({ length: 429 }, (_, idx): Recipe => ({
          ...ALL_RECIPES[0],
          id: `imp-${String(idx + 1).padStart(4, '0')}`,
          slug: `imp-dish-${idx + 1}`,
          title: idx === 0 ? 'Canh cà chua trứng nhà lá' : `Món ngon nhập khẩu ${idx + 1}`,
        })),
      ];
      const d1Snapshot = await createRecipeAuthoritySnapshot('d1', syntheticD1Catalog);
      const d1Unexpanded = await discoverRecipes(
        baseStaticEnv,
        auth,
        d1Snapshot,
        DiscoveryQuerySchema.parse({}),
      );
      expect(d1Unexpanded.total).toBe(500);

      const d1Expanded = await discoverRecipes(
        expandedEnv,
        auth,
        d1Snapshot,
        DiscoveryQuerySchema.parse({}),
      );
      expect(d1Expanded.total).toBe(585);

      const d1Search = await discoverRecipes(
        expandedEnv,
        auth,
        d1Snapshot,
        DiscoveryQuerySchema.parse({ q: 'trứng vân mây hành lá' }),
      );
      expect(
        d1Search.items.some((i) => i.recipe.title === 'Canh cà chua trứng vân mây hành lá'),
      ).toBe(true);

      // 4. Detail + Cook Start on V5 regional masterpiece ('v5-bac-01')
      const detailRes = await app.fetch(
        new Request('https://v5.local/recipes/v5-bac-01', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        expandedEnv,
      );
      expect(detailRes.status).toBe(200);
      const detailJson = (await detailRes.json()) as { contentFingerprint: string; recipe: Recipe };
      expect(detailJson.recipe.id).toBe('v5-bac-01');
      expect(detailJson.recipe.imageUrl).toBe('/takolio/v5/dishes/bun-cha-ha-noi.webp');

      const cookStartRes = await app.fetch(
        new Request('https://v5.local/recipes/v5-bac-01/cook/start', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mode: 'single', targetServings: 4 }),
        }),
        expandedEnv,
      );
      expect(cookStartRes.status).toBe(200);
    } finally {
      resetRecipeAuthorityCacheForTests();
    }
  });
});
