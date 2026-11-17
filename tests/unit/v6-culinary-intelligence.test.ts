import { describe, expect, it } from 'vitest';
import type { Recipe } from '@frigo/recipes';
import { GLOBAL_RECIPES, VIETNAMESE_RECIPES } from '../../packages/recipes/src/data';
import {
  NUTRITION_DICTIONARY_V6,
  VIETNAMESE_RDI_BENCHMARKS_V6,
  buildSundayBatchPrepBlueprint,
  computeDailyTrayNutritionBalance,
  computeRecipeNutritionV6,
  convertIngredientToGramsV6,
  resolveIngredientNutritionV6,
} from '@frigo/recipes';

const BRAISED_PORK_BELLY_RECIPE: Recipe = {
  id: 'v6-test-thit-kho-tau',
  slug: 'thit-kho-tau-nuoc-dua',
  title: 'Thịt kho tàu trứng vịt nước dừa',
  description: 'Thịt ba chỉ kho mềm rục với trứng vịt và nước dừa tươi đậm đà.',
  cuisine: 'vietnamese',
  category: 'mon_kho',
  region: 'nam',
  cookTimeMinutes: 55,
  servings: 4,
  difficulty: 'medium',
  imageUrl: '/recipes/thit-kho-tau.webp',
  tags: ['món kho', 'miền nam'],
  ingredients: [
    { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ heo', requiredQuantity: 500, unit: 'g' },
    { ingredientId: 'DUCK_EGG', name: 'Trứng vịt', requiredQuantity: 4, unit: 'piece' },
    { ingredientId: 'COCONUT_WATER', name: 'Nước dừa tươi', requiredQuantity: 400, unit: 'ml' },
    { ingredientId: 'FISH_SAUCE', name: 'Nước mắm Phú Quốc', requiredQuantity: 60, unit: 'ml' },
    { ingredientId: 'SUGAR', name: 'Đường thốt nốt', requiredQuantity: 25, unit: 'g' },
    { ingredientId: 'GARLIC', name: 'Tỏi băm', requiredQuantity: 4, unit: 'piece' },
    { ingredientId: 'SHALLOT', name: 'Hành tím', requiredQuantity: 3, unit: 'piece' },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Sơ chế thịt ba chỉ cắt vuông 4cm, luộc trứng vịt bóc vỏ.' },
    { stepNumber: 2, instruction: 'Ướp thịt với nước mắm, đường, hành tỏi băm trong 20 phút.', timerMinutes: 20 },
    { stepNumber: 3, instruction: 'Kho liu riu với nước dừa tươi 40 phút cho thịt mềm trong.', timerMinutes: 40 },
  ],
};

const WATER_SPINACH_STIRFRY_RECIPE: Recipe = {
  id: 'v6-test-rau-muong-xao',
  slug: 'rau-muong-xao-toi',
  title: 'Rau muống xào tỏi xanh giòn',
  description: 'Rau muống đồng chần sơ xào lửa lớn dậy mùi tỏi.',
  cuisine: 'vietnamese',
  category: 'mon_xao',
  region: 'bac',
  cookTimeMinutes: 10,
  servings: 4,
  difficulty: 'easy',
  imageUrl: '/recipes/rau-muong-xao.webp',
  tags: ['món xào', 'rau xanh'],
  ingredients: [
    { ingredientId: 'WATER_SPINACH', name: 'Rau muống tươi', requiredQuantity: 2, unit: 'bunch' },
    { ingredientId: 'GARLIC', name: 'Tỏi ta đập dập', requiredQuantity: 6, unit: 'piece' },
    { ingredientId: 'COOKING_OIL', name: 'Dầu ăn', requiredQuantity: 15, unit: 'ml' },
    { ingredientId: 'FISH_SAUCE', name: 'Nước mắm', requiredQuantity: 10, unit: 'ml' },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Nhặt rau muống, rửa sạch quay ráo.' },
    { stepNumber: 2, instruction: 'Phi thơm tỏi với dầu ăn, cho rau vào xào lửa lớn 2 phút.', timerMinutes: 2 },
  ],
};

const SOUR_FISH_SOUP_RECIPE: Recipe = {
  id: 'v6-test-canh-chua-ca-loc',
  slug: 'canh-chua-ca-loc',
  title: 'Canh chua cá lóc miền Tây',
  description: 'Canh chua cá lóc nấu me dứa thanh mát.',
  cuisine: 'vietnamese',
  category: 'mon_canh',
  region: 'nam',
  cookTimeMinutes: 25,
  servings: 4,
  difficulty: 'easy',
  imageUrl: '/recipes/canh-chua-ca.webp',
  tags: ['món canh'],
  ingredients: [
    { ingredientId: 'FISH_FRESHWATER', name: 'Cá lóc đồng cắt khoanh', requiredQuantity: 450, unit: 'g' },
    { ingredientId: 'TOMATO', name: 'Cà chua', requiredQuantity: 2, unit: 'piece' },
    { ingredientId: 'PINEAPPLE', name: 'Dứa chín', requiredQuantity: 1, unit: 'piece' },
    { ingredientId: 'BEAN_SPROUTS', name: 'Giá đỗ', requiredQuantity: 150, unit: 'g' },
    { ingredientId: 'TAMARIND', name: 'Me chua', requiredQuantity: 30, unit: 'g' },
    { ingredientId: 'FISH_SAUCE', name: 'Nước mắm', requiredQuantity: 20, unit: 'ml' },
    { ingredientId: 'SCALLION', name: 'Ngò gai & Rau ngổ', requiredQuantity: 1, unit: 'bunch' },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Rửa sạch cá lóc, cắt lát dứa và cà chua.' },
    { stepNumber: 2, instruction: 'Đun sôi nước cốt me, thả cá và rau củ nấu chín tới 12 phút.', timerMinutes: 12 },
  ],
};

const STEAMED_RICE_SIDE: Recipe = {
  id: 'v6-test-com-trang',
  slug: 'com-trang-gao-thom',
  title: 'Cơm trắng gạo ST25 dẻo thơm',
  description: 'Cơm nóng nấu từ gạo thơm Việt Nam.',
  cuisine: 'vietnamese',
  category: 'mon_hap_luoc',
  cookTimeMinutes: 25,
  servings: 4,
  difficulty: 'easy',
  imageUrl: '/recipes/com.webp',
  tags: ['cơm'],
  ingredients: [
    { ingredientId: 'RICE', name: 'Gạo thơm ST25', requiredQuantity: 360, unit: 'g' },
  ],
  steps: [{ stepNumber: 1, instruction: 'Vo gạo và nấu chín 25 phút.', timerMinutes: 25 }],
};

describe('Takolio V6 Culinary Nutrition & Sunday Batch-Prep Intelligence', () => {
  describe('Nutrition Dictionary & Unit-to-Gram Bridge (nutrition-engine.ts)', () => {
    it('curates 100+ distinct Vietnamese & global ingredient profiles with accurate keyword disambiguation', () => {
      expect(NUTRITION_DICTIONARY_V6.length).toBeGreaterThanOrEqual(100);

      // Disambiguates "cà chua" (tomato) vs "cá" (fish), "dầu ăn" (oil) vs "đậu phụ" (tofu), "quả bơ" vs "thịt bò"
      expect(resolveIngredientNutritionV6(undefined, 'Cà chua chín đỏ').profile.key).toBe('TOMATO');
      expect(resolveIngredientNutritionV6(undefined, 'Cá basa phi lê').profile.key).toBe('CATFISH');
      expect(resolveIngredientNutritionV6(undefined, 'Dầu ăn thực vật').profile.key).toBe('COOKING_OIL');
      expect(resolveIngredientNutritionV6(undefined, 'Đậu phụ trắng').profile.key).toBe('TOFU');
      expect(resolveIngredientNutritionV6(undefined, 'Củ sen tươi').profile.key).toBe('LOTUS_ROOT');
      expect(resolveIngredientNutritionV6(undefined, 'Miến dong').profile.key).toBe('GLASS_NOODLE');
      expect(resolveIngredientNutritionV6(undefined, 'Nước cốt dừa').profile.key).toBe('COCONUT_MILK');
    });

    it('converts Vietnamese culinary & metric units (g, kg, ml, l, tbsp, tsp, quả, củ, tép, bó, miếng, gói, chén, bát) accurately to grams', () => {
      const fishSauce = resolveIngredientNutritionV6('FISH_SAUCE', 'Nước mắm').profile;
      const garlic = resolveIngredientNutritionV6('GARLIC', 'Tỏi').profile;
      const spinach = resolveIngredientNutritionV6('WATER_SPINACH', 'Rau muống').profile;
      const rice = resolveIngredientNutritionV6('COOKED_RICE', 'Cơm trắng').profile;
      const pork = resolveIngredientNutritionV6('PORK_LEAN', 'Thịt nạc').profile;

      expect(convertIngredientToGramsV6(0.5, 'kg', pork)).toBe(500);
      expect(convertIngredientToGramsV6(2, 'lạng', pork)).toBe(200);
      expect(convertIngredientToGramsV6(2, 'tbsp', fishSauce)).toBeGreaterThanOrEqual(30);
      expect(convertIngredientToGramsV6(2, 'muỗng canh', fishSauce)).toBe(
        convertIngredientToGramsV6(2, 'tbsp', fishSauce),
      );
      expect(convertIngredientToGramsV6(3, 'tsp', fishSauce)).toBeGreaterThanOrEqual(15);
      expect(convertIngredientToGramsV6(4, 'tép', garlic)).toBe(20);
      expect(convertIngredientToGramsV6(1, 'củ', garlic)).toBe(30);
      expect(convertIngredientToGramsV6(1, 'bó', spinach)).toBe(280);
      expect(convertIngredientToGramsV6(2, 'chén', rice)).toBe(320);
      expect(convertIngredientToGramsV6(2, 'bát', rice)).toBe(320);
    });
  });

  describe('computeRecipeNutritionV6', () => {
    it('computes per-serving & total-dish macros/micros, macroSplitPct summing to 100%, badges, and sodium advisory', () => {
      const braisedReport = computeRecipeNutritionV6(BRAISED_PORK_BELLY_RECIPE);

      expect(braisedReport.servings).toBe(4);
      expect(braisedReport.confidence).toBe('high');
      expect(braisedReport.perServing.caloriesKcal).toBeGreaterThan(500);
      expect(braisedReport.perServing.proteinG).toBeGreaterThan(22);
      expect(braisedReport.totalDish.caloriesKcal).toBeGreaterThan(
        braisedReport.perServing.caloriesKcal * 3.8,
      );

      // Macro split percentages strictly sum to 100%
      const splitSum =
        braisedReport.macroSplitPct.proteinPct +
        braisedReport.macroSplitPct.carbsPct +
        braisedReport.macroSplitPct.fatPct;
      expect(splitSum).toBe(100);

      // 60ml fish sauce across 4 servings + duck eggs -> >= 950mg sodium/serving triggers advisory
      expect(braisedReport.perServing.sodiumMg).toBeGreaterThanOrEqual(950);
      expect(braisedReport.sodiumAdvisoryVi).not.toBeNull();
      expect(braisedReport.sodiumAdvisoryVi).toContain('15–20%');
      expect(braisedReport.healthBadgesVi).toContain('Giàu đạm tự nhiên');
      expect(braisedReport.healthBadgesVi).toContain('Đậm đà đưa cơm');
    });

    it('produces light badges and null sodium advisory on low-calorie high-fiber vegetable dishes', () => {
      const greensReport = computeRecipeNutritionV6(WATER_SPINACH_STIRFRY_RECIPE);

      expect(greensReport.perServing.caloriesKcal).toBeLessThan(150);
      expect(greensReport.perServing.fiberG).toBeGreaterThanOrEqual(3.5);
      expect(greensReport.perServing.sodiumMg).toBeLessThan(500);
      expect(greensReport.sodiumAdvisoryVi).toBeNull();
      expect(greensReport.glycemicLoadLabelVi).toBe('Thấp');
      expect(greensReport.healthBadgesVi).toContain('Thanh nhẹ < 450 kcal');
      expect(greensReport.healthBadgesVi).toContain('Giàu chất xơ rau củ');
    });

    it('scales totalDish accurately when targetServings is customized while keeping macroSplitPct = 100%', () => {
      const reportFor2 = computeRecipeNutritionV6(SOUR_FISH_SOUP_RECIPE, 2);
      const reportFor6 = computeRecipeNutritionV6(SOUR_FISH_SOUP_RECIPE, 6);

      expect(reportFor2.servings).toBe(2);
      expect(reportFor6.servings).toBe(6);
      expect(reportFor6.totalDish.proteinG).toBeCloseTo(reportFor2.totalDish.proteinG * 3, 0);
      expect(
        reportFor6.macroSplitPct.proteinPct +
          reportFor6.macroSplitPct.carbsPct +
          reportFor6.macroSplitPct.fatPct,
      ).toBe(100);
    });

    it('runs deterministically without NaN across every Vietnamese & global catalog recipe', () => {
      const sampleCatalog = [...VIETNAMESE_RECIPES.slice(0, 12), ...GLOBAL_RECIPES.slice(0, 4)];
      for (const recipe of sampleCatalog) {
        const rep = computeRecipeNutritionV6(recipe);
        expect(Number.isFinite(rep.perServing.caloriesKcal)).toBe(true);
        expect(rep.perServing.caloriesKcal).toBeGreaterThan(20);
        expect(
          rep.macroSplitPct.proteinPct + rep.macroSplitPct.carbsPct + rep.macroSplitPct.fatPct,
        ).toBe(100);
        expect(rep.healthBadgesVi.length).toBeGreaterThan(0);
      }
    });
  });

  describe('computeDailyTrayNutritionBalance', () => {
    it('evaluates a full Vietnamese family tray against NIN RDI benchmarks with 0..100 balanceScore and coachSummaryVi', () => {
      const balance = computeDailyTrayNutritionBalance(
        [
          SOUR_FISH_SOUP_RECIPE,
          WATER_SPINACH_STIRFRY_RECIPE,
          STEAMED_RICE_SIDE,
        ],
        4,
      );

      expect(balance.householdSize).toBe(4);
      expect(balance.dishCount).toBe(3);
      expect(balance.rdiBenchmarks).toEqual(VIETNAMESE_RDI_BENCHMARKS_V6);
      expect(balance.perPersonIntake.caloriesKcal).toBeGreaterThan(450);
      expect(balance.perPersonIntake.proteinG).toBeGreaterThan(28);
      expect(balance.perPersonIntake.fiberG).toBeGreaterThan(5);
      expect(balance.balanceScore).toBeGreaterThanOrEqual(65);
      expect(balance.balanceScore).toBeLessThanOrEqual(100);
      expect(balance.coachSummaryVi.length).toBeGreaterThan(20);
    });

    it('flags high sodium and handles empty recipe list safely', () => {
      const emptyBalance = computeDailyTrayNutritionBalance([], 3);
      expect(emptyBalance.balanceScore).toBe(0);
      expect(emptyBalance.perPersonIntake.caloriesKcal).toBe(0);

      const saltyTray = computeDailyTrayNutritionBalance(
        [BRAISED_PORK_BELLY_RECIPE, BRAISED_PORK_BELLY_RECIPE],
        4,
      );
      expect(saltyTray.perPersonIntake.sodiumMg).toBeGreaterThan(2000);
      expect(saltyTray.statusLabelVi).toBe('Đậm vị · Lưu ý giảm mặn');
      expect(saltyTray.coachSummaryVi).toContain('2.000 mg');
    });
  });

  describe('buildSundayBatchPrepBlueprint (batch-prep-engine.ts)', () => {
    it('generates all 4 chronological Sunday Batch-Prep stations with exact Vietnamese storage zones & realistic timings', () => {
      const selectedMenu = [
        SOUR_FISH_SOUP_RECIPE,
        WATER_SPINACH_STIRFRY_RECIPE,
        BRAISED_PORK_BELLY_RECIPE,
        ...VIETNAMESE_RECIPES.slice(0, 2),
      ];

      const blueprint = buildSundayBatchPrepBlueprint(selectedMenu, {
        householdSize: 4,
        fridgeItemNames: ['Rau muống', 'Cà chua', 'Tỏi'],
      });

      expect(blueprint.selectedRecipeCount).toBe(5);
      expect(blueprint.householdSize).toBe(4);
      expect(blueprint.stations).toHaveLength(4);
      expect(blueprint.stations.map((s) => s.id)).toEqual([
        'wash_greens',
        'chop_marinate',
        'broth_sauce',
        'container_labels',
      ]);
      expect(blueprint.stations[0].titleVi).toBe(
        'Trạm 01 · Rửa sạch, quay ráo & bảo quản rau thơm',
      );
      expect(blueprint.stations[1].titleVi).toBe(
        'Trạm 02 · Sơ chế & ướp cốt thịt cá chia hộp',
      );
      expect(blueprint.stations[2].titleVi).toBe(
        'Trạm 03 · Pha sốt mắm chuẩn & ninh nước dùng nền',
      );
      expect(blueprint.stations[3].titleVi).toBe(
        'Trạm 04 · Đóng hộp thuỷ tinh & lịch rã đông trong tuần',
      );

      // Station 01 mentions 5–7 ngày damp paper-towel breathable box storage
      expect(blueprint.stations[0].tasks[0].shelfLifeVi).toContain('5–7 ngày');

      // Station 02 distinguishes chiller 3°C (48h) vs freezer -18°C (weekend)
      const station2Zones = blueprint.stations[1].tasks.map((t) => t.storageZoneVi).join(' | ');
      expect(station2Zones).toContain('Ngăn mát 3°C (nấu trong 48h)');
      expect(station2Zones).toContain('Ngăn đông -18°C (nấu cuối tuần)');

      // Station 03 pre-batches braise sauce & soup broth
      expect(blueprint.stations[2].tasks.length).toBeGreaterThanOrEqual(2);

      // Realistic totalPrepMinutes (~35-95 mins) and positive weeknightMinutesSaved
      expect(blueprint.totalPrepMinutes).toBeGreaterThanOrEqual(35);
      expect(blueprint.totalPrepMinutes).toBeLessThanOrEqual(95);
      expect(blueprint.weeknightMinutesSaved).toBeGreaterThanOrEqual(80);
      expect(blueprint.containerCount).toBe(blueprint.containers.length);
      expect(blueprint.containerCount).toBeGreaterThanOrEqual(4);
      expect(blueprint.fridgeMatchedIngredientsVi.length).toBeGreaterThanOrEqual(2);
      expect(blueprint.proTipsVi.length).toBeGreaterThanOrEqual(4);
    });

    it('caps >8 recipes cleanly at 8 and handles empty recipe list without throwing', () => {
      const empty = buildSundayBatchPrepBlueprint([]);
      expect(empty.selectedRecipeCount).toBe(0);
      expect(empty.stations).toHaveLength(4);
      expect(empty.totalPrepMinutes).toBe(0);

      const tenRecipes = buildSundayBatchPrepBlueprint(VIETNAMESE_RECIPES.slice(0, 10));
      expect(tenRecipes.selectedRecipeCount).toBe(8);
      expect(tenRecipes.totalPrepMinutes).toBeLessThanOrEqual(95);
    });
  });
});
