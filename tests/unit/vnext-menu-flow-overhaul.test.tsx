// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { SIMPLE_FOODS } from '../../packages/recipes/src/composition/simple-foods';
import { FamilyPreferencesSchema } from '../../packages/domain/src/family-preferences-api';
import { FamilyMealPlanDtoSchema } from '../../packages/domain/src/family-meal-planning-api';
import {
  mergeUserFoodPrefsIntoFamilyPreferences,
  sanitizeFamilyPreferencesForGeneration,
  toggleAvoidanceGroup,
} from '../../src/web/features/family/preference-sync';
import {
  buildSmartPlanningIntent,
  C24PlannerSetupVNext,
  C25C26PlannerMealVNext,
} from '../../src/web/vnext/screens/PlannerAndShoppingPages';
import { C23PlannerPilot } from '../../src/web/vnext/screens/C23PlannerPilot';
import { ConsumerStudioShell } from '../../src/web/vnext/components/Shells';
import { formatKitchenAmount } from '../../src/web/vnext/lib/planner-workbench';
import { ingredientAmount } from '../../src/web/features/planner/IngredientCoverage';
import {
  resolveCanonicalDishSlug,
  VERIFIED_SIMPLE_FOOD_MEDIA,
  VERIFIED_VNEXT_RECIPE_MEDIA,
  VerifiedDishImage,
} from '../../src/web/vnext/components/VNextMedia';
import { useAuthStore } from '../../src/web/stores/useAuthStore';
import { resetPrivateSession } from '../../src/web/lib/private-session';
import { hookPlan, hookPlanId } from '../helpers/planner-hook-fixtures';
import { homeComposition } from '../helpers/ui02-fixtures';

describe('Phase 1 — Menu Flow P0 Fixes & Preference Synchronization', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('heals legacy unverified allergen keys into concrete forbiddenIngredientIds without triggering SAFETY_UNKNOWN', () => {
    const legacy = FamilyPreferencesSchema.parse({
      householdSize: 4,
      allergens: ['peanut', 'shellfish'],
      forbiddenIngredientIds: ['BEEF_SIRLOIN'],
    });
    const { sanitized, migratedAllergens } = sanitizeFamilyPreferencesForGeneration(legacy);
    expect(migratedAllergens).toEqual(['peanut', 'shellfish']);
    expect(sanitized.allergens).toEqual([]);
    expect(sanitized.forbiddenIngredientIds).toEqual(
      expect.arrayContaining(['BEEF_SIRLOIN', 'PEANUT', 'PEANUT_BUTTER', 'SHRIMP', 'CRAB_MEAT', 'SQUID']),
    );
  });

  it('merges Onboarding (O04) & FoodPreferences (U02) selections into FamilyPreferences', () => {
    const merged = mergeUserFoodPrefsIntoFamilyPreferences(null, {
      householdSize: 4,
      spicyLevel: 'none',
      favoriteCuisines: ['vietnamese', 'japanese', 'korean'],
      dietaryRestrictions: ['peanuts', 'seafood', 'quick_meals'],
    });
    expect(merged.householdSize).toBe(4);
    expect(merged.mealStyle).toBe('quick');
    expect(merged.preferredTimeMinutes).toBeLessThanOrEqual(30);
    expect(merged.internationalMealsPerWeek).toBeGreaterThanOrEqual(2);
    expect(merged.preferredCuisines).toEqual(
      expect.arrayContaining(['vietnamese', 'japanese', 'korean']),
    );
    expect(merged.forbiddenIngredientIds).toEqual(
      expect.arrayContaining(['PEANUT', 'SHRIMP', 'SALMON_FILLET', 'CHILI']),
    );
    expect(merged.allergens).toEqual([]);
  });

  it('toggles avoidance ingredient groups cleanly without duplicates', () => {
    const withPeanut = toggleAvoidanceGroup(['BEEF_SIRLOIN'], 'peanut', true);
    expect(withPeanut).toEqual(['BEEF_SIRLOIN', 'PEANUT', 'PEANUT_BUTTER']);
    const withoutPeanut = toggleAvoidanceGroup(withPeanut, 'peanut', false);
    expect(withoutPeanut).toEqual(['BEEF_SIRLOIN']);
  });

  it('builds valid future-only slots when starting Today in the evening (preventing 422 INVALID_PLANNING_HORIZON)', () => {
    const eveningNow = new Date(2026, 10, 23, 19, 10, 0); // 19:10 local time
    const intent = buildSmartPlanningIntent({
      startDate: '2026-11-23',
      days: 3,
      servings: 4,
      meals: ['breakfast', 'lunch', 'dinner'],
      mode: 'shopping_allowed',
      cookingDays: [0, 1, 2, 3, 4, 5, 6],
      preferredTimeMinutes: 45,
      now: eveningNow,
    });

    // Breakfast (08:00) and Lunch (12:00) on 2026-11-23 are skipped, while tonight's dinner gets a future time >= 19:25
    const todaySlots = intent.slots.filter((s) => s.date === '2026-11-23');
    expect(todaySlots.length).toBe(1);
    expect(todaySlots[0]?.mealType).toBe('dinner');
    expect(todaySlots[0]?.time).toBe('19:25');
    // Subsequent days keep all 3 meals
    const day2Slots = intent.slots.filter((s) => s.date === '2026-11-24');
    expect(day2Slots.map((s) => s.mealType)).toEqual(['breakfast', 'lunch', 'dinner']);
  });

  it('renders V2 multi-dish compositions and manual slots accurately on C23PlannerPilot without 0-meal blank states', async () => {
    vi.stubEnv('VITE_MEAL_PLANNER_ENABLED', 'true');
    vi.stubEnv('VITE_MEAL_COMPOSITION_V2_ENABLED', 'true');
    localStorage.clear();
    resetPrivateSession();
    localStorage.setItem('frigo_user_id', 'u-test');
    localStorage.setItem('frigo_household_id', 'h-test');
    useAuthStore.setState({ userId: 'u-test', householdId: 'h-test', isGuest: false });

    const basePlan = hookPlan(1);
    const envelope = FamilyMealPlanDtoSchema.parse({
      schemaVersion: 2,
      plan: basePlan,
      compositions: homeComposition(basePlan, [
        'Cá lóc kho tộ',
        'Canh chua cá lóc',
        'Rau muống xào tỏi',
        'Cơm trắng',
      ]),
      policy: {
        mealStyle: 'family',
        preferredRegions: [],
        internationalMealsPerWeek: 0,
        internationalGeneratedMainCount: 0,
        lockedInternationalMainCount: 0,
        defaultCuisine: 'vietnamese',
        profileRevision: 1,
      },
      diagnostics: {
        completeMealCount: 1,
        partialMealCount: 0,
        unplannedMealCount: 0,
        reasons: [],
        searchLimited: false,
      },
      familyPreferenceFreshness: 'fresh',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/compositions')) {
          return Response.json(envelope.compositions);
        }
        if (url.endsWith('/current')) {
          return Response.json({ plan: envelope });
        }
        return Response.json(envelope);
      }),
    );

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={[`/planner/${hookPlanId}`]}>
            <Routes>
              <Route path="/planner/:planId" element={<C23PlannerPilot />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    for (let i = 0; i < 30; i += 1) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });
      if (host.textContent?.includes('Cá lóc kho tộ')) break;
    }

    expect(host.textContent).toContain('Cá lóc kho tộ · Canh chua cá lóc · Rau muống xào tỏi · Cơm trắng');
    expect(host.textContent).toContain('1/1 bữa đã có món');

    await act(async () => root.unmount());
    host.remove();
  });

  it('renders C24PlannerSetupVNext directly without LazyPlannerPage waterfall and submits valid family plan request', async () => {
    vi.stubEnv('VITE_MEAL_PLANNER_ENABLED', 'true');
    vi.stubEnv('VITE_MEAL_COMPOSITION_V2_ENABLED', 'true');
    localStorage.clear();
    resetPrivateSession();
    localStorage.setItem('frigo_user_id', 'u-setup');
    localStorage.setItem('frigo_household_id', 'h-setup');
    useAuthStore.setState({ userId: 'u-setup', householdId: 'h-setup', isGuest: false });

    const basePlan = hookPlan(1);
    const envelope = FamilyMealPlanDtoSchema.parse({
      schemaVersion: 2,
      plan: basePlan,
      compositions: homeComposition(basePlan, ['Gà kho gừng', 'Canh bí đao', 'Cơm trắng']),
      policy: {
        mealStyle: 'family',
        preferredRegions: [],
        internationalMealsPerWeek: 0,
        internationalGeneratedMainCount: 0,
        lockedInternationalMainCount: 0,
        defaultCuisine: 'vietnamese',
        profileRevision: 1,
      },
      diagnostics: {
        completeMealCount: 1,
        partialMealCount: 0,
        unplannedMealCount: 0,
        reasons: [],
        searchLimited: false,
      },
      familyPreferenceFreshness: 'fresh',
    });

    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/family-preferences') && (!init?.method || init.method === 'GET')) {
        return Response.json({
          revision: 1,
          preferences: FamilyPreferencesSchema.parse({
            householdSize: 3,
            allergens: ['peanut'], // Poisoned legacy allergen — should be healed automatically!
          }),
        });
      }
      if (url.includes('/family-preferences') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        return Response.json({
          revision: 2,
          preferences: body.preferences,
        });
      }
      if (url === '/api/v2/meal-planning/plans' && init?.method === 'POST') {
        return Response.json(envelope, { status: 201 });
      }
      return Response.json({});
    });
    vi.stubGlobal('fetch', fetchSpy);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={['/planner/new']}>
            <Routes>
              <Route path="/planner/new" element={<C24PlannerSetupVNext />} />
              <Route path="/planner/:planId" element={<div data-testid="navigated-plan">OK</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    for (let i = 0; i < 30; i += 1) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });
      if (host.querySelector('[data-testid="c24-servings-value"]')?.textContent === '3 người') break;
    }

    expect(host.querySelector('[data-testid="c24-servings-value"]')?.textContent).toBe('3 người');
    const submitBtn = host.querySelector<HTMLButtonElement>('[data-testid="c24-submit-btn"]')!;
    expect(submitBtn.disabled).toBe(false);

    await act(async () => {
      submitBtn.click();
    });

    for (let i = 0; i < 30; i += 1) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });
      if (host.querySelector('[data-testid="navigated-plan"]')) break;
    }

    expect(host.querySelector('[data-testid="navigated-plan"]')).not.toBeNull();
    const putCall = fetchSpy.mock.calls.find(
      ([u, init]) => String(u).includes('/family-preferences') && init?.method === 'PUT',
    );
    expect(putCall).toBeDefined();
    const savedPayload = JSON.parse(String(putCall![1]!.body));
    expect(savedPayload.preferences.allergens).toEqual([]);
    expect(savedPayload.preferences.forbiddenIngredientIds).toEqual(
      expect.arrayContaining(['PEANUT', 'PEANUT_BUTTER']),
    );

    await act(async () => root.unmount());
    host.remove();
  });
});

describe('Phase 2 — 100% 1:1 Dish Photography Mapping (Zero Duplicates, Zero Ingredient Icons)', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps all 71 canonical recipes + 9 simple foods (80/80) to existing, 100% unique 1:1 dish photos with zero ingredient icons', () => {
    const repoRoot = process.cwd();
    const vnextMediaSource = readFileSync(
      path.join(repoRoot, 'src/web/vnext/components/VNextMedia.tsx'),
      'utf8',
    );
    expect(vnextMediaSource).not.toContain('/frigo/ingredients/');

    expect(ALL_RECIPES.length).toBe(71);
    expect(SIMPLE_FOODS.length).toBe(9);

    const seenSrc = new Set<string>();
    const seenSrc640 = new Set<string>();

    for (const recipe of ALL_RECIPES) {
      // Must resolve identically by ID alone, slug alone, and Vietnamese title alone
      expect(resolveCanonicalDishSlug(recipe.id, null, null)).toBe(recipe.slug);
      expect(resolveCanonicalDishSlug(null, recipe.slug, null)).toBe(recipe.slug);
      expect(resolveCanonicalDishSlug(null, recipe.id, null)).toBe(recipe.slug);
      expect(resolveCanonicalDishSlug(null, null, recipe.title)).toBe(recipe.slug);

      const entry = VERIFIED_VNEXT_RECIPE_MEDIA[recipe.slug];
      expect(entry, `Missing VERIFIED_VNEXT_RECIPE_MEDIA entry for ${recipe.slug}`).toBeDefined();
      expect(existsSync(path.join(repoRoot, 'public', entry!.src))).toBe(true);
      expect(existsSync(path.join(repoRoot, 'public', entry!.src640))).toBe(true);
      expect(seenSrc.has(entry!.src), `Duplicate src across recipes: ${entry!.src}`).toBe(false);
      expect(seenSrc640.has(entry!.src640), `Duplicate src640 across recipes: ${entry!.src640}`).toBe(false);
      seenSrc.add(entry!.src);
      seenSrc640.add(entry!.src640);
    }

    for (const food of SIMPLE_FOODS) {
      expect(resolveCanonicalDishSlug(food.id, null, null)).toBe(food.id);
      expect(resolveCanonicalDishSlug(null, food.id, null)).toBe(food.id);
      expect(resolveCanonicalDishSlug(null, null, food.title.vi)).toBe(food.id);
      expect(resolveCanonicalDishSlug(null, null, food.title.en)).toBe(food.id);

      const entry = VERIFIED_SIMPLE_FOOD_MEDIA[food.id];
      expect(entry, `Missing VERIFIED_SIMPLE_FOOD_MEDIA entry for ${food.id}`).toBeDefined();
      expect(existsSync(path.join(repoRoot, 'public', entry!.src))).toBe(true);
      expect(existsSync(path.join(repoRoot, 'public', entry!.src640))).toBe(true);
      expect(seenSrc.has(entry!.src), `Duplicate src across simple foods: ${entry!.src}`).toBe(false);
      expect(seenSrc640.has(entry!.src640), `Duplicate src640 across simple foods: ${entry!.src640}`).toBe(false);
      seenSrc.add(entry!.src);
      seenSrc640.add(entry!.src640);
    }

    expect(seenSrc.size).toBe(80);
    expect(seenSrc640.size).toBe(80);
  });

  it('prioritizes R2 canonical URLs and renders distinct 1:1 dish photos for every recipe and simple food without ingredient icons', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <div>
          <div data-testid="r2-dish">
            <VerifiedDishImage
              title="Món R2"
              canonicalFallbackSrc="/api/v1/recipe-media/vn-kho-01/hero/3"
            />
          </div>
          <div data-testid="gl-01">
            <VerifiedDishImage recipeId="gl-01" title="Mì Ý sốt cà chua Pomodoro" />
          </div>
          <div data-testid="gl-03">
            <VerifiedDishImage recipeId="gl-03" title="Cà chua xào trứng Trung Hoa" />
          </div>
          <div data-testid="gl-12">
            <VerifiedDishImage recipeId="gl-12" title="Trứng xào cà chua kiểu Trung Hoa" />
          </div>
          <div data-testid="gl-07">
            <VerifiedDishImage recipeId="gl-07" title="Cơm cuộn Kimbap Hàn Quốc" />
          </div>
          <div data-testid="gl-08">
            <VerifiedDishImage recipeId="gl-08" title="Bánh gạo Tokbokki sốt cay ngọt" />
          </div>
          <div data-testid="vn-nem">
            <VerifiedDishImage title="Nem rán truyền thống Hà Nội" />
          </div>
          <div data-testid="sf-rice">
            <VerifiedDishImage title="Cơm trắng" />
          </div>
          <div data-testid="sf-egg">
            <VerifiedDishImage recipeId="sf-boiled-egg" title="Trứng luộc" />
          </div>
          <div data-testid="unknown-custom">
            <VerifiedDishImage title="Món tự chế chưa có trong danh mục" />
          </div>
        </div>,
      );
    });

    expect(host.querySelector('[data-testid="r2-dish"] img')?.getAttribute('src')).toBe(
      '/api/v1/recipe-media/vn-kho-01/hero/3',
    );
    expect(host.querySelector('[data-testid="gl-01"] img')?.getAttribute('src')).toBe(
      '/takolio/vnext/food/pasta-pomodoro-640w.webp',
    );
    expect(host.querySelector('[data-testid="gl-03"] img')?.getAttribute('src')).toBe(
      '/takolio/vnext/food/tomato-egg-stir-fry-640w.webp',
    );
    expect(host.querySelector('[data-testid="gl-12"] img')?.getAttribute('src')).toBe(
      '/takolio/vnext/food/chinese-tomato-egg-640w.webp',
    );
    expect(host.querySelector('[data-testid="gl-07"] img')?.getAttribute('src')).toBe(
      '/takolio/vnext/food/kimbap-han-quoc-640w.webp',
    );
    expect(host.querySelector('[data-testid="gl-08"] img')?.getAttribute('src')).toBe(
      '/takolio/vnext/food/tokbokki-cay-ngot-640w.webp',
    );
    expect(host.querySelector('[data-testid="vn-nem"] img')?.getAttribute('src')).toBe(
      '/takolio/vnext/food/nem-ran-truyen-thong-ha-noi-640w.webp',
    );
    expect(host.querySelector('[data-testid="sf-rice"] img')?.getAttribute('src')).toBe(
      '/takolio/vnext/food/sf-steamed-rice-640w.webp',
    );
    expect(host.querySelector('[data-testid="sf-egg"] img')?.getAttribute('src')).toBe(
      '/takolio/vnext/food/sf-boiled-egg-640w.webp',
    );
    expect(host.querySelector('[data-testid="unknown-custom"] img')?.getAttribute('src')).toBe(
      '/takolio/vnext/brand/dish-fallback.svg',
    );

    const allRenderedSrcs = [...host.querySelectorAll<HTMLImageElement>('img')].map(
      (el) => el.getAttribute('src') ?? '',
    );
    expect(allRenderedSrcs.some((u) => u.includes('/frigo/ingredients/'))).toBe(false);
    expect(new Set(allRenderedSrcs).size).toBe(allRenderedSrcs.length);

    await act(async () => root.unmount());
    host.remove();
  });
});

describe('Phase 3 — Minimalist Workbench, V2 Meal Detail Truth & AI-Slop Purge', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('rounds kitchen quantities cleanly without floating-point noise like 66,6666666667 g', () => {
    expect(formatKitchenAmount(200 / 3, 'g')).toBe('~65 g');
    expect(formatKitchenAmount(400, 'g')).toBe('400 g');
    expect(ingredientAmount(200 / 3, 'g', 'vi')).toBe('Khoảng 67 g');
  });

  it('renders Desktop Back button inside ConsumerStudioShell when backTo is provided', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await act(async () => {
      root.render(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={['/recipes/thit-kho-trung']}>
            <ConsumerStudioShell screenId="C18" title="Chi tiết món ăn" backTo="/planner/abc">
              <div>Nội dung công thức</div>
            </ConsumerStudioShell>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    expect(host.querySelector('[data-testid="desktop-shell-back-btn"]')).not.toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });

  it('renders V2 Meal Detail (C25) with dish visuals, aggregated ingredients, and cooking steps while omitting AI explanation fluff', async () => {
    vi.stubEnv('VITE_MEAL_PLANNER_ENABLED', 'true');
    vi.stubEnv('VITE_MEAL_COMPOSITION_V2_ENABLED', 'true');
    localStorage.clear();
    resetPrivateSession();
    localStorage.setItem('frigo_user_id', 'u-meal');
    localStorage.setItem('frigo_household_id', 'h-meal');
    useAuthStore.setState({ userId: 'u-meal', householdId: 'h-meal', isGuest: false });

    const basePlan = hookPlan(1);
    const slotId = basePlan.result.meals[0]!.slotId;
    const envelope = FamilyMealPlanDtoSchema.parse({
      schemaVersion: 2,
      plan: basePlan,
      compositions: homeComposition(basePlan, ['Thịt kho tàu nước dừa trứng', 'Cơm trắng']),
      policy: {
        mealStyle: 'family',
        preferredRegions: [],
        internationalMealsPerWeek: 0,
        internationalGeneratedMainCount: 0,
        lockedInternationalMainCount: 0,
        defaultCuisine: 'vietnamese',
        profileRevision: 1,
      },
      diagnostics: {
        completeMealCount: 1,
        partialMealCount: 0,
        unplannedMealCount: 0,
        reasons: [],
        searchLimited: false,
      },
      familyPreferenceFreshness: 'fresh',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/compositions')) {
          return Response.json(envelope.compositions);
        }
        if (url.includes('/recipes/')) {
          const fp = new URL(url, 'http://localhost').searchParams.get('contentFingerprint') ?? undefined;
          return Response.json({
            contentFingerprint: fp,
            recipe: {
              id: 'vn-kho-01',
              slug: 'thit-kho-trung',
              title: 'Thịt kho tàu nước dừa trứng',
              description: 'Món kho đậm đà',
              cuisine: 'vietnamese',
              cookTimeMinutes: 40,
              difficulty: 'easy',
              servings: 2,
              imageUrl: '',
              ingredients: [
                { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ', requiredQuantity: 400, unit: 'g' },
              ],
              steps: [
                { stepNumber: 1, instruction: 'Thái thịt ba chỉ thành miếng vuông vừa ăn.' },
                { stepNumber: 2, instruction: 'Kho nhỏ lửa cùng nước dừa tươi 35 phút.' },
              ],
              tags: [],
            },
          });
        }
        return Response.json(envelope);
      }),
    );

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <QueryClientProvider client={qc}>
          <MemoryRouter
            initialEntries={[`/planner/${hookPlanId}/meal/${encodeURIComponent(slotId)}`]}
          >
            <Routes>
              <Route path="/planner/:planId/meal/:slotId" element={<C25C26PlannerMealVNext />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    for (let i = 0; i < 30; i += 1) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 15));
      });
      if (
        host.querySelector('[data-testid="c25-meal-ingredients"]') &&
        host.querySelector('[data-testid="c25-meal-steps"]') &&
        host.textContent?.includes('Kho nhỏ lửa cùng nước dừa tươi 35 phút.')
      ) {
        break;
      }
    }

    expect(host.querySelector('[data-testid="c25-meal-ingredients"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="c25-meal-steps"]')).not.toBeNull();
    expect(host.textContent).toContain('Kho nhỏ lửa cùng nước dừa tươi 35 phút.');
    expect(host.textContent).not.toContain('Sắp xếp lời giải thích với AI');
    expect(host.textContent).not.toContain('không tự trừ tủ lạnh');

    await act(async () => root.unmount());
    host.remove();
  });
});
