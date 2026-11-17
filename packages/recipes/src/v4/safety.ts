import {
  findCulinaryIngredientV4,
  normalizeIngredientText,
} from '@takolio/domain';
import type { Recipe } from '../types';
import { enrichRecipeToV4 } from './enricher';
import type {
  AllergenTagV4,
  DietarySafetyConflictV4,
  DietarySafetyEvaluationV4,
  DietarySafetyPreferencesV4,
  DietaryTagV4,
} from './types';

function normalizeAllergenKey(raw: string): AllergenTagV4 | string {
  const clean = normalizeIngredientText(raw).replace(/\s+/g, '_');
  switch (clean) {
    case 'gluten':
    case 'wheat':
    case 'wheat_gluten':
    case 'lua_mi':
      return 'gluten';
    case 'peanut':
    case 'peanuts':
    case 'dau_phong':
    case 'lac':
      return 'peanut';
    case 'tree_nut':
    case 'tree_nuts':
    case 'nuts':
    case 'hat_cay':
      return 'tree_nut';
    case 'shellfish':
    case 'crustacean':
    case 'giap_xac':
    case 'tom_cua':
      return 'shellfish';
    case 'seafood':
    case 'fish':
    case 'hai_san':
      return 'seafood';
    case 'egg':
    case 'eggs':
    case 'trung':
      return 'egg';
    case 'dairy':
    case 'milk':
    case 'lactose':
    case 'sua':
      return 'dairy';
    case 'soy':
    case 'soybean':
    case 'dau_nanh':
      return 'soy';
    case 'sesame':
    case 'me':
    case 'vung':
      return 'sesame';
    case 'pork':
    case 'thit_heo':
    case 'thit_lon':
      return 'pork';
    case 'beef':
    case 'thit_bo':
      return 'beef';
    default:
      return clean;
  }
}

function normalizeDietKey(raw: string): DietaryTagV4 | string {
  const clean = normalizeIngredientText(raw).replace(/\s+/g, '_');
  switch (clean) {
    case 'vegetarian':
    case 'an_chay':
    case 'chay':
      return 'vegetarian';
    case 'vegan':
    case 'thuan_chay':
      return 'vegan';
    case 'halal':
      return 'halal';
    case 'eat_clean':
    case 'eatclean':
    case 'healthy':
      return 'eat_clean';
    case 'low_carb':
    case 'lowcarb':
    case 'keto':
      return 'low_carb';
    case 'pescatarian':
      return 'pescatarian';
    case 'dairy_free':
    case 'khong_sua':
      return 'dairy_free';
    case 'gluten_free':
    case 'khong_gluten':
      return 'gluten_free';
    case 'high_protein':
    case 'giau_dam':
      return 'high_protein';
    default:
      return clean;
  }
}

interface SignalEvidence {
  from: 'ingredient' | 'title_or_step';
  label: string;
}

export function evaluateRecipeDietarySafetyV4(
  recipe: Recipe,
  prefs: DietarySafetyPreferencesV4 = {},
): DietarySafetyEvaluationV4 {
  const allergenSignals = new Map<AllergenTagV4, SignalEvidence>();
  const animalOrigins = new Map<string, SignalEvidence>();

  const addAllergen = (tag: AllergenTagV4, from: SignalEvidence['from'], label: string) => {
    if (!allergenSignals.has(tag)) {
      allergenSignals.set(tag, { from, label });
    }
    if (tag === 'wheat_gluten' && !allergenSignals.has('gluten')) {
      allergenSignals.set('gluten', { from, label });
    }
    if (tag === 'gluten' && !allergenSignals.has('wheat_gluten')) {
      allergenSignals.set('wheat_gluten', { from, label });
    }
  };

  const addOrigin = (origin: string, from: SignalEvidence['from'], label: string) => {
    if (origin !== 'none' && !animalOrigins.has(origin)) {
      animalOrigins.set(origin, { from, label });
    }
  };

  const isExplicitChayCategory = recipe.category === 'mon_chay';

  // 1. Inspect structured ingredients
  for (const ing of recipe.ingredients) {
    const normIngName = normalizeIngredientText(ing.name);

    // Handle compound vegetarian labels like "Muối hột & hạt nêm chay" or "Dầu hào chay"
    if (/\b(chay)\b/.test(normIngName)) {
      if (/\b(nuoc tuong|xi dau|dau hao chay|dau phu|dau hu)\b/.test(normIngName)) {
        addAllergen('soy', 'ingredient', ing.name);
      }
      if (/\b(dau me)\b/.test(normIngName)) {
        addAllergen('sesame', 'ingredient', ing.name);
      }
      continue;
    }

    // Handle "Thịt bò/heo băm" dual-meat labels explicitly
    if (/\b(bo)\b/.test(normIngName) && /\b(heo|lon)\b/.test(normIngName)) {
      addAllergen('pork', 'ingredient', ing.name);
      addAllergen('beef', 'ingredient', ing.name);
      addOrigin('pork', 'ingredient', ing.name);
      addOrigin('beef', 'ingredient', ing.name);
    }

    const profile = findCulinaryIngredientV4(ing.ingredientId, ing.name);
    if (profile) {
      for (const alg of profile.allergens) {
        addAllergen(alg, 'ingredient', ing.name);
      }
      addOrigin(profile.animalOrigin, 'ingredient', ing.name);
      if (profile.animalOrigin === 'pork') addAllergen('pork', 'ingredient', ing.name);
      if (profile.animalOrigin === 'beef') addAllergen('beef', 'ingredient', ing.name);
    }

    if (/\b(dau me|me rang|me trang|me den|vung)\b/.test(normIngName)) {
      addAllergen('sesame', 'ingredient', ing.name);
    }
    if (/\b(dau phong|lac rang|tuong phong|bo dau phong)\b/.test(normIngName)) {
      addAllergen('peanut', 'ingredient', ing.name);
    }
  }

  // 2. Inspect normalized Vietnamese title + step instructions for hidden condiments/allergens
  const rawCorpus = [
    recipe.title,
    recipe.description ?? '',
    ...recipe.steps.map((s) => s.instruction),
  ].join(' . ');

  const scrubbedCorpus = normalizeIngredientText(rawCorpus)
    .replace(/\bdau hao chay\b/g, ' veg_oyster_sauce ')
    .replace(/\bnuoc mam chay\b/g, ' veg_fish_sauce ')
    .replace(/\bhat nem chay\b/g, ' veg_seasoning ')
    .replace(/\bbot nem chay\b/g, ' veg_seasoning ')
    .replace(/\bthit chay\b/g, ' veg_meat ')
    .replace(/\bsuon non chay\b/g, ' veg_ribs ')
    .replace(/\bcha lua chay\b/g, ' veg_sausage ')
    .replace(/\bdau mau dieu\b/g, ' annatto_oil ')
    .replace(/\bhat dieu mau\b/g, ' annatto_seed ')
    .replace(/\bnuoc cot dua\b/g, ' coconut_milk ')
    .replace(/\bcot dua\b/g, ' coconut_milk ')
    .replace(/\bsua dua\b/g, ' coconut_milk ');

  if (/\b(dau phong|lac rang|tuong phong|bo dau phong)\b/.test(scrubbedCorpus)) {
    addAllergen('peanut', 'title_or_step', 'Đậu phộng / Tương phộng');
  }
  if (/\b(hat dieu|hanh nhan|hat oc cho)\b/.test(scrubbedCorpus)) {
    addAllergen('tree_nut', 'title_or_step', 'Hạt cây (điều / hạnh nhân / óc chó)');
  }
  if (/\b(me trang|me den|me rang|dau me|vung rang)\b/.test(scrubbedCorpus)) {
    addAllergen('sesame', 'title_or_step', 'Mè / Dầu mè');
  }
  if (/\b(mam tom|mam ruoc|dau hao|tom|cua dong|rieu cua|ghe|muc|ngao|ngheu|oc|so diep|hau)\b/.test(scrubbedCorpus)) {
    addAllergen('shellfish', 'title_or_step', 'Tôm, cua, nhuyễn thể / Dầu hào / Mắm tôm');
    addAllergen('seafood', 'title_or_step', 'Hải sản / Thủy sản');
    addOrigin('seafood', 'title_or_step', 'Hải sản / Gia vị hải sản');
  }
  if (/\b(nuoc mam|mam nem|ca loc|ca dieu hong|ca ro|ca hoi|ca thu|cha ca|ca thac lac)\b/.test(scrubbedCorpus)) {
    addAllergen('seafood', 'title_or_step', 'Cá / Nước mắm');
    addOrigin('seafood', 'title_or_step', 'Cá / Nước mắm');
  }
  if (/\b(trung ga|trung vit|trung cut|op la|trang trung|trung luoc|trung hap|trung cuon)\b/.test(scrubbedCorpus)) {
    addAllergen('egg', 'title_or_step', 'Trứng');
    addOrigin('egg', 'title_or_step', 'Trứng');
  }
  if (/\b(pho mai|pho mat|sua tuoi|sua dac|bo lat|kem tuoi|cheddar|mozzarella)\b/.test(scrubbedCorpus)) {
    addAllergen('dairy', 'title_or_step', 'Sữa / Phô mai / Bơ');
    addOrigin('dairy', 'title_or_step', 'Sữa / Phô mai');
  }
  if (/\b(nuoc tuong|xi dau|dau phu|dau hu|tau hu|veg_oyster_sauce|gochujang|miso)\b/.test(scrubbedCorpus)) {
    addAllergen('soy', 'title_or_step', 'Đậu nành / Nước tương / Đậu phụ');
  }
  if (/\b(banh mi|mi y|spaghetti|pasta|mi goi|mi tom|mi soi vang|bot mi|bot chien gion)\b/.test(scrubbedCorpus)) {
    addAllergen('gluten', 'title_or_step', 'Bột mì / Mì sợi / Bánh mì');
  }
  if (
    !isExplicitChayCategory &&
    /\b(thit heo|thit lon|ba chi|ba roi|suon non|suon heo|suon sun|tai heo|gio heo|top mo|mo heo|pate|nem ran|nem lui|bun cha|thit bam|thit bam)\b/.test(
      scrubbedCorpus,
    )
  ) {
    addAllergen('pork', 'title_or_step', 'Thịt heo / Sườn heo / Chế phẩm từ heo');
    addOrigin('pork', 'title_or_step', 'Thịt heo');
  }
  if (
    !isExplicitChayCategory &&
    /\b(thit bo|bap bo|nam bo|bo kho|pho bo|bun bo|bo xao|bo tai)\b/.test(scrubbedCorpus)
  ) {
    addAllergen('beef', 'title_or_step', 'Thịt bò');
    addOrigin('beef', 'title_or_step', 'Thịt bò');
  }
  if (
    !isExplicitChayCategory &&
    /\b(thit ga|dui ga|uc ga|canh ga|ga ta|nuoc luoc ga|mien ga|sup ga|lau ga|goi ga|thit vit)\b/.test(
      scrubbedCorpus,
    )
  ) {
    addOrigin('poultry', 'title_or_step', 'Thịt gia cầm');
  }
  if (/\b(mat ong)\b/.test(scrubbedCorpus)) {
    addOrigin('honey', 'title_or_step', 'Mật ong');
  }

  // 3. Evaluate dietary compliance across all supported dietary tags
  const v4 = enrichRecipeToV4(recipe);
  const macros = v4.estimatedNutrition;

  const nonVegEvidence =
    animalOrigins.get('pork') ??
    animalOrigins.get('beef') ??
    animalOrigins.get('poultry') ??
    animalOrigins.get('seafood') ??
    null;

  const nonVeganEvidence =
    nonVegEvidence ??
    animalOrigins.get('egg') ??
    animalOrigins.get('dairy') ??
    animalOrigins.get('honey') ??
    null;

  const hasCookingAlcohol = /\b(ruou trang|ruou nau an|giam bong)\b/.test(scrubbedCorpus);
  const nonHalalEvidence =
    animalOrigins.get('pork') ??
    (hasCookingAlcohol ? { from: 'title_or_step' as const, label: 'Rượu trắng / Giấm bỗng' } : null);

  const isHeavyFriedOrFatty =
    recipe.category === 'mon_chien' ||
    /\b(chien gion|nem ran|canh ga chien|top mo|kho tau)\b/.test(scrubbedCorpus) ||
    macros.fatG > 24;

  const hasHighCarbStarch =
    recipe.ingredients.some((i) =>
      ['RICE', 'NOODLE', 'SPAGHETTI_PASTA', 'RICE_PAPER'].includes(i.ingredientId.toUpperCase()),
    ) ||
    /\b(com|chao|bun|pho|mien|mi y|mi goi|banh mi|banh gao|tokbokki)\b/.test(
      normalizeIngredientText(recipe.title),
    ) ||
    macros.carbG > 28;

  const nonPescatarianEvidence =
    animalOrigins.get('pork') ?? animalOrigins.get('beef') ?? animalOrigins.get('poultry') ?? null;

  const compliantDiets: DietaryTagV4[] = [];
  if (!nonVegEvidence) compliantDiets.push('vegetarian');
  if (!nonVeganEvidence) compliantDiets.push('vegan');
  if (!nonHalalEvidence) compliantDiets.push('halal');
  if (!isHeavyFriedOrFatty) compliantDiets.push('eat_clean');
  if (!hasHighCarbStarch) compliantDiets.push('low_carb');
  if (!nonPescatarianEvidence) compliantDiets.push('pescatarian');
  if (!allergenSignals.has('dairy')) compliantDiets.push('dairy_free');
  if (!allergenSignals.has('gluten') && !allergenSignals.has('wheat_gluten')) {
    compliantDiets.push('gluten_free');
  }
  if (macros.proteinG >= 20) compliantDiets.push('high_protein');

  // 4. Evaluate requested preferences
  const conflicts: DietarySafetyConflictV4[] = [];
  const rankingSafetyEvidence: DietarySafetyEvaluationV4['rankingSafetyEvidence'] = [];

  for (const rawAllergen of prefs.allergens ?? []) {
    const normalized = normalizeAllergenKey(rawAllergen);
    const hit = allergenSignals.get(normalized as AllergenTagV4);
    if (hit) {
      conflicts.push({
        kind: 'allergen',
        key: rawAllergen,
        reasonVi: `Món có chứa thành phần gây dị ứng/kiêng (${rawAllergen}): ${hit.label}.`,
        matchedFrom: hit.from,
        evidence: hit.label,
      });
      rankingSafetyEvidence.push({
        kind: 'allergen',
        key: rawAllergen,
        verdict: 'conflict',
        sourceReference: `takolio-v4-safety:${hit.from}:${hit.label}`,
      });
    } else {
      rankingSafetyEvidence.push({
        kind: 'allergen',
        key: rawAllergen,
        verdict: 'safe',
        sourceReference: 'takolio-v4-safety:verified-absent',
      });
    }
  }

  const requestedDiets = [
    ...(prefs.dietaryTags ?? []),
    ...(prefs.requiredDietaryTags ?? []),
  ];
  const seenDiets = new Set<string>();

  for (const rawDiet of requestedDiets) {
    if (seenDiets.has(rawDiet)) continue;
    seenDiets.add(rawDiet);
    const normalized = normalizeDietKey(rawDiet);

    const isCompliant = compliantDiets.includes(normalized as DietaryTagV4);
    if (isCompliant) {
      rankingSafetyEvidence.push({
        kind: 'dietary',
        key: rawDiet,
        verdict: 'safe',
        sourceReference: `takolio-v4-safety:diet-compliant:${normalized}`,
      });
      continue;
    }

    let reasonVi = `Món chưa đáp ứng chế độ ăn "${rawDiet}".`;
    let matchedFrom: DietarySafetyConflictV4['matchedFrom'] = 'ingredient';
    let evidence = recipe.title;

    if (normalized === 'vegetarian' && nonVegEvidence) {
      reasonVi = `Chế độ ăn chay không dùng ${nonVegEvidence.label}.`;
      matchedFrom = nonVegEvidence.from;
      evidence = nonVegEvidence.label;
    } else if (normalized === 'vegan' && nonVeganEvidence) {
      reasonVi = `Chế độ thuần chay không dùng ${nonVeganEvidence.label}.`;
      matchedFrom = nonVeganEvidence.from;
      evidence = nonVeganEvidence.label;
    } else if (normalized === 'halal' && nonHalalEvidence) {
      reasonVi = `Chế độ Halal không dùng ${nonHalalEvidence.label}.`;
      matchedFrom = nonHalalEvidence.from;
      evidence = nonHalalEvidence.label;
    } else if (normalized === 'eat_clean') {
      reasonVi = `Món chiên rán hoặc giàu chất béo (${macros.fatG}g chất béo/khẩu phần) không phù hợp Eat Clean.`;
      matchedFrom = macros.fatG > 24 ? 'nutrition' : 'title_or_step';
      evidence = `${macros.fatG}g fat`;
    } else if (normalized === 'low_carb') {
      reasonVi = `Món chứa tinh bột cao (${macros.carbG}g tinh bột/khẩu phần) không phù hợp Low Carb.`;
      matchedFrom = 'nutrition';
      evidence = `${macros.carbG}g carb`;
    }

    conflicts.push({
      kind: 'dietary',
      key: rawDiet,
      reasonVi,
      matchedFrom,
      evidence,
    });
    rankingSafetyEvidence.push({
      kind: 'dietary',
      key: rawDiet,
      verdict: 'conflict',
      sourceReference: `takolio-v4-safety:${matchedFrom}:${evidence}`,
    });
  }

  const forbiddenSet = new Set(
    (prefs.forbiddenIngredientIds ?? []).map((id) => id.trim().toUpperCase()),
  );
  const forbiddenIngredientConflicts: string[] = [];
  for (const ing of recipe.ingredients) {
    if (forbiddenSet.has(ing.ingredientId.toUpperCase())) {
      forbiddenIngredientConflicts.push(ing.ingredientId);
      conflicts.push({
        kind: 'forbidden_ingredient',
        key: ing.ingredientId,
        reasonVi: `Có nguyên liệu nằm trong danh sách kiêng: ${ing.name}.`,
        matchedFrom: 'ingredient',
        evidence: ing.name,
      });
    }
  }

  const allergenConflicts = conflicts.filter((c) => c.kind === 'allergen');
  const dietaryConflicts = conflicts.filter((c) => c.kind === 'dietary');
  const safe = conflicts.length === 0;

  return {
    recipeId: recipe.id,
    safe,
    verdict: safe ? 'safe' : 'conflict',
    detectedAllergens: [...allergenSignals.keys()],
    compliantDiets,
    conflicts,
    allergenConflicts,
    dietaryConflicts,
    forbiddenIngredientConflicts,
    rankingSafetyEvidence,
  };
}
