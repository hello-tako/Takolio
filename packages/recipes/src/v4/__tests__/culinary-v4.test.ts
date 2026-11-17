import { describe, expect, it } from 'vitest';
import {
  CULINARY_INGREDIENT_TAXONOMY_V4,
  PANTRY_STAPLE_IDS,
  convertCulinaryQuantity,
  evaluateCulinaryStockSatisfaction,
  formatHumanCulinaryEquivalentVi,
  isPantryStapleIngredient,
  normalizeCulinaryUnit,
} from '@takolio/domain';
import {
  ALL_RECIPES,
  DISH_ARTWORK_V4_BASE_PATH,
  buildParallelMamComTimeline,
  enrichRecipeToV4,
  evaluateRecipeDietarySafetyV4,
  resolveRecipeArtworkV4,
  scaleRecipeV4,
  type Recipe,
} from '../../index';

describe('Takolio V4 — Dual Culinary <-> Storage Unit Bridge & Expanded Taxonomy', () => {
  it('normalizes Vietnamese and international culinary unit aliases deterministically', () => {
    expect(normalizeCulinaryUnit('muỗng canh')).toBe('tbsp');
    expect(normalizeCulinaryUnit('thìa canh')).toBe('tbsp');
    expect(normalizeCulinaryUnit('muỗng cà phê')).toBe('tsp');
    expect(normalizeCulinaryUnit('thìa cà phê')).toBe('tsp');
    expect(normalizeCulinaryUnit('tép')).toBe('clove');
    expect(normalizeCulinaryUnit('củ')).toBe('bulb');
    expect(normalizeCulinaryUnit('quả')).toBe('piece');
    expect(normalizeCulinaryUnit('trái')).toBe('piece');
    expect(normalizeCulinaryUnit('nhánh')).toBe('stalk');
    expect(normalizeCulinaryUnit('cây')).toBe('stalk');
    expect(normalizeCulinaryUnit('chén')).toBe('bowl');
    expect(normalizeCulinaryUnit('bát')).toBe('bowl');
    expect(normalizeCulinaryUnit('hộp')).toBe('pack');
    expect(normalizeCulinaryUnit('gói')).toBe('pack');
    expect(normalizeCulinaryUnit('bịch')).toBe('pack');
    expect(normalizeCulinaryUnit('bó')).toBe('bunch');
    expect(normalizeCulinaryUnit('mớ')).toBe('bunch');
    expect(normalizeCulinaryUnit('lát')).toBe('slice');
    expect(normalizeCulinaryUnit('miếng')).toBe('slice');
  });

  it('bridges canonical gram/ml weights per ingredient so 300g tomato satisfies 2 piece tomato', () => {
    const satisfaction = evaluateCulinaryStockSatisfaction({
      availableQuantity: 300,
      availableUnit: 'g',
      requiredQuantity: 2,
      requiredUnit: 'piece',
      ingredientId: 'TOMATO',
    });
    expect(satisfaction.satisfied).toBe(true);
    expect(satisfaction.availableInRequiredUnit).toBeCloseTo(300 / 110, 2);

    expect(convertCulinaryQuantity(2, 'piece', 'g', 'CHICKEN_EGG')?.convertedQuantity).toBe(110);
    expect(convertCulinaryQuantity(3, 'clove', 'g', 'GARLIC')?.convertedQuantity).toBe(15);
    expect(convertCulinaryQuantity(2, 'bulb', 'g', 'SHALLOT')?.convertedQuantity).toBe(24);
    expect(convertCulinaryQuantity(2, 'stalk', 'g', 'SCALLION')?.convertedQuantity).toBe(30);
    expect(convertCulinaryQuantity(1, 'pack', 'g', 'TOFU')?.convertedQuantity).toBe(300);
    expect(convertCulinaryQuantity(2, 'piece', 'g', 'CHILI')?.convertedQuantity).toBe(8);
    expect(convertCulinaryQuantity(1, 'piece', 'g', 'LIME')?.convertedQuantity).toBe(45);
    expect(convertCulinaryQuantity(1, 'bulb', 'g', 'GINGER')?.convertedQuantity).toBe(35);
    expect(convertCulinaryQuantity(2, 'tbsp', 'ml', 'FISH_SAUCE')?.convertedQuantity).toBe(30);
    expect(convertCulinaryQuantity(2, 'tbsp', 'g', 'SUGAR')?.convertedQuantity).toBe(24);
    expect(convertCulinaryQuantity(1, 'bowl', 'g', 'RICE')?.convertedQuantity).toBe(180);
    expect(convertCulinaryQuantity(1, 'bunch', 'g', 'WATER_SPINACH')?.convertedQuantity).toBe(300);
  });

  it('covers 150+ market items with pantry staple classification and allergen groups', () => {
    expect(CULINARY_INGREDIENT_TAXONOMY_V4.length).toBeGreaterThanOrEqual(150);
    for (const staple of [
      'FISH_SAUCE',
      'SOY_SAUCE',
      'COOKING_OIL',
      'SALT',
      'SUGAR',
      'BLACK_PEPPER',
      'GARLIC',
      'SHALLOT',
      'OYSTER_SAUCE',
    ]) {
      expect(PANTRY_STAPLE_IDS.has(staple)).toBe(true);
      expect(isPantryStapleIngredient(staple)).toBe(true);
    }
    expect(isPantryStapleIngredient('PORK_BELLY')).toBe(false);
    expect(formatHumanCulinaryEquivalentVi(30, 'ml', 'FISH_SAUCE')).toContain('2 muỗng canh');
  });
});

describe('Takolio V4 — Recipe DAG Enricher, Non-Linear Scaling, Dietary Safety & Parallel Mâm Cơm', () => {
  it('enriches all 71+ canonical recipes with non-null timings, 4 phases, sensory cues, and WebP artworks', () => {
    for (const recipe of ALL_RECIPES) {
      const v4 = enrichRecipeToV4(recipe);
      expect(v4.prepTimeMinutes).toBeGreaterThan(0);
      expect(v4.activeCookTimeMinutes).toBeGreaterThan(0);
      expect(v4.passiveSimmerMinutes).toBeGreaterThanOrEqual(0);
      expect(v4.equipmentList.length).toBeGreaterThan(0);
      expect(v4.artwork.url.startsWith(`${DISH_ARTWORK_V4_BASE_PATH}/`)).toBe(true);
      expect(v4.artwork.url.endsWith('.webp')).toBe(true);
      expect(v4.estimatedNutrition.calories).toBeGreaterThan(50);

      for (const step of v4.steps) {
        expect(['mise_en_place', 'marinate', 'active_cook', 'plate']).toContain(step.phase);
        expect(step.sensoryCue.length).toBeGreaterThan(15);
      }
    }
  });

  it('allocates seasoning quantities proportionally across marinate (1/3) and braise (2/3) steps and estimates missing nutrition', () => {
    const braisedPork: Recipe = {
      id: 'test-kho',
      slug: 'thit-kho-tieu',
      title: 'Thịt ba chỉ kho tiêu',
      description: 'Thịt kho đậm vị',
      cuisine: 'vietnamese',
      category: 'mon_kho',
      cookTimeMinutes: 30,
      servings: 2,
      difficulty: 'easy',
      imageUrl: '',
      tags: [],
      ingredients: [
        { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ', requiredQuantity: 300, unit: 'g' },
        { ingredientId: 'FISH_SAUCE', name: 'Nước mắm', requiredQuantity: 30, unit: 'ml' },
      ],
      steps: [
        { stepNumber: 1, instruction: 'Ướp thịt ba chỉ với nước mắm trong 15 phút.' },
        { stepNumber: 2, instruction: 'Cho thịt vào nồi đất, thêm nước mắm kho lửa nhỏ 20 phút.', timerMinutes: 20 },
        { stepNumber: 3, instruction: 'Múc ra đĩa thưởng thức nóng.' },
      ],
    };

    const enriched = enrichRecipeToV4(braisedPork);
    expect(enriched.estimatedNutrition.source).toBe('ingredient_estimated');
    expect(enriched.estimatedNutrition.calories).toBeGreaterThan(200);

    const step1FishSauce = enriched.steps[0].stepIngredients.find((i) => i.ingredientId === 'FISH_SAUCE')!;
    const step2FishSauce = enriched.steps[1].stepIngredients.find((i) => i.ingredientId === 'FISH_SAUCE')!;
    expect(step1FishSauce.allocatedQuantity).toBe(10);
    expect(step1FishSauce.roleLabelVi).toBe('Ướp thấm');
    expect(step2FishSauce.allocatedQuantity).toBe(20);
    expect(step2FishSauce.roleLabelVi).toBe('Kho dậy vị');
  });

  it('scales proteins linearly, oils/spices sub-linearly, rounds countable items, and warns on 2x pan crowding', () => {
    const base = ALL_RECIPES.find((r) => r.id === 'vn-kho-01')!; // 4 servings, 400g pork, 4 eggs, 40ml fish sauce
    const scaled8 = scaleRecipeV4(base, 8); // 2.0x ratio
    const pork = scaled8.ingredients.find((i) => i.ingredientId === 'PORK_BELLY')!;
    const eggs = scaled8.ingredients.find((i) => i.ingredientId === 'CHICKEN_EGG')!;
    const fishSauce = scaled8.ingredients.find((i) => i.ingredientId === 'FISH_SAUCE')!;

    expect(pork.requiredQuantity).toBe(800); // 1.0x linear: 400 * 2 = 800
    expect(eggs.requiredQuantity).toBe(8); // whole eggs rounded cleanly
    expect(fishSauce.requiredQuantity).toBeLessThan(80); // sub-linear: 40 * (2 ** 0.78) ≈ 69 -> 69
    expect(fishSauce.requiredQuantity).toBeGreaterThan(60);
    expect(scaled8.panCrowdingWarningVi).toContain('chia làm 2 mẻ');

    const scaled4 = scaleRecipeV4(base, 4);
    expect(scaled4.panCrowdingWarningVi).toBeNull();
  });

  it('evaluates dietary safety and allergens from both structured ingredients and Vietnamese step/title tokens without UNKNOWN blocks', () => {
    const goiCuon = ALL_RECIPES.find((r) => r.id === 'vn-cuon-01')!; // Gỏi cuốn tôm thịt chấm tương phộng
    const peanutCheck = evaluateRecipeDietarySafetyV4(goiCuon, {
      allergens: ['peanut', 'shellfish'],
      dietaryTags: ['vegetarian'],
    });
    expect(peanutCheck.safe).toBe(false);
    expect(peanutCheck.detectedAllergens).toContain('peanut');
    expect(peanutCheck.detectedAllergens).toContain('shellfish');
    expect(peanutCheck.dietaryConflicts.length).toBe(1);

    const chayDish = ALL_RECIPES.find((r) => r.id === 'vn-chay-01')!; // Đậu phụ kho nấm đông cô
    const veganCheck = evaluateRecipeDietarySafetyV4(chayDish, {
      allergens: ['peanut', 'shellfish', 'dairy', 'egg'],
      dietaryTags: ['vegetarian', 'vegan', 'halal'],
    });
    expect(veganCheck.safe).toBe(true);
    expect(veganCheck.verdict).toBe('safe');
  });

  it('conducts a 3-dish Vietnamese Mâm Cơm timeline with overlapped passive simmers and stir-fry greens right before plating', () => {
    const kho = ALL_RECIPES.find((r) => r.id === 'vn-kho-02')!; // Cá lóc kho tộ
    const canh = ALL_RECIPES.find((r) => r.id === 'vn-canh-01')!; // Canh chua cá lóc
    const xao = ALL_RECIPES.find((r) => r.id === 'vn-xao-01')!; // Rau muống xào tỏi

    const plan = buildParallelMamComTimeline([kho, canh, xao], 4);
    expect(plan.dishes).toHaveLength(3);
    expect(plan.timelineSteps.length).toBe(kho.steps.length + canh.steps.length + xao.steps.length);
    expect(plan.parallelTotalMinutes).toBeLessThan(plan.sequentialTotalMinutes);
    expect(plan.savedMinutes).toBeGreaterThan(0);

    // Intra-dish step order is strictly monotonic
    for (const dishId of [kho.id, canh.id, xao.id]) {
      const nums = plan.timelineSteps
        .filter((s) => s.recipeId === dishId)
        .map((s) => s.originalStepNumber);
      expect(nums).toEqual([...nums].sort((a, b) => a - b));
    }

    // Stir-fry active cooking lands after braise launch and right before final plating
    const khoCookFirstIdx = plan.timelineSteps.findIndex(
      (s) => s.recipeId === kho.id && s.step.phase === 'active_cook',
    );
    const xaoCookFirstIdx = plan.timelineSteps.findIndex(
      (s) => s.recipeId === xao.id && s.step.phase === 'active_cook',
    );
    expect(xaoCookFirstIdx).toBeGreaterThan(khoCookFirstIdx);
  });

  it('maps Vietnamese and Global dishes to distinct curated V4 artworks', () => {
    expect(resolveRecipeArtworkV4({ cuisine: 'japanese', title: 'Oyakodon' }).artworkId).toBe('gl-japanese-donburi');
    expect(resolveRecipeArtworkV4({ cuisine: 'korean', title: 'Bibimbap' }).artworkId).toBe('gl-korean-bibimbap');
    expect(resolveRecipeArtworkV4({ cuisine: 'italian', title: 'Spaghetti' }).artworkId).toBe('gl-italian-pasta');
    expect(resolveRecipeArtworkV4({ cuisine: 'thai', title: 'Green Curry' }).artworkId).toBe('gl-thai-curry');
    expect(resolveRecipeArtworkV4({ cuisine: 'chinese', title: 'Mapo Tofu' }).artworkId).toBe('gl-chinese-wok');
    expect(resolveRecipeArtworkV4({ cuisine: 'vietnamese', category: 'mon_kho', title: 'Cá kho tộ' }).artworkId).toBe('vn-braised-claypot');
    expect(resolveRecipeArtworkV4({ cuisine: 'vietnamese', category: 'mon_canh', title: 'Canh chua' }).artworkId).toBe('vn-sour-soup');
    expect(resolveRecipeArtworkV4({ cuisine: 'vietnamese', category: 'mon_xao', title: 'Rau muống xào' }).artworkId).toBe('vn-stirfry-greens');
    expect(resolveRecipeArtworkV4({ cuisine: 'vietnamese', category: 'mon_bun_pho', title: 'Phở bò' }).artworkId).toBe('vn-pho-noodle');
    expect(resolveRecipeArtworkV4({ cuisine: 'vietnamese', category: 'mon_chay', title: 'Đậu phụ kho nấm' }).artworkId).toBe('vn-tofu-vegetarian');
  });
});
