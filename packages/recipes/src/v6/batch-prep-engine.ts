import {
  formatHumanCulinaryEquivalentVi,
  normalizeIngredientText,
} from '@takolio/domain';
import type { Recipe, RecipeIngredient } from '../types';
import {
  resolveIngredientNutritionV6,
  type NutritionIngredientGroupV6,
} from './nutrition-engine';

export type BatchPrepStationIdV6 =
  | 'wash_greens'
  | 'chop_marinate'
  | 'broth_sauce'
  | 'container_labels';

export interface SundayBatchPrepOptionsV6 {
  householdSize?: number;
  fridgeItemNames?: string[];
}

export interface BatchPrepTaskV6 {
  taskId: string;
  stationId: BatchPrepStationIdV6;
  titleVi: string;
  instructionVi: string;
  ingredientsSummaryVi: string[];
  usedInRecipeTitles: string[];
  storageZoneVi: string;
  shelfLifeVi: string;
  estimatedMinutes: number;
  alreadyInFridge: boolean;
}

export interface BatchPrepStationV6 {
  id: BatchPrepStationIdV6;
  stationNumber: 1 | 2 | 3 | 4;
  titleVi: string;
  subtitleVi: string;
  estimatedMinutes: number;
  shelfLifeNoteVi: string;
  tasks: BatchPrepTaskV6[];
}

export interface BatchPrepContainerLabelV6 {
  containerNumber: number;
  labelCode: string;
  labelVi: string;
  contentsVi: string;
  recipeTitle: string | null;
  storageZoneVi: string;
  cookDayOrder: number;
  plannedCookDayVi: string;
  thawGuidanceVi: string;
  shelfLifeVi: string;
}

export interface BatchPrepBlueprintV6 {
  householdSize: number;
  selectedRecipeCount: number;
  recipeTitles: string[];
  totalPrepMinutes: number;
  weeknightMinutesSaved: number;
  containerCount: number;
  stations: BatchPrepStationV6[];
  containers: BatchPrepContainerLabelV6[];
  fridgeMatchedIngredientsVi: string[];
  proTipsVi: string[];
}

interface AggregatedBatchIngredient {
  key: string;
  ingredientId: string;
  name: string;
  group: NutritionIngredientGroupV6;
  totalQuantity: number;
  unit: RecipeIngredient['unit'];
  recipeTitles: Set<string>;
  inFridge: boolean;
}

const WEEKDAY_LABELS_VI: readonly string[] = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật',
  'Đầu tuần kế tiếp',
];

const CHILL_ZONE_48H = 'Ngăn mát 3°C (nấu trong 48h)';
const FREEZER_ZONE_WEEKEND = 'Ngăn đông -18°C (nấu cuối tuần)';
const GREENS_BOX_ZONE = 'Hộp thoáng khí lót khăn giấy ẩm · Ngăn rau (5–7 ngày)';
const SAUCE_JAR_ZONE = 'Hũ thuỷ tinh kín · Ngăn mát 3°C (5–7 ngày)';

function isGreenOrVegGroup(group: NutritionIngredientGroupV6, ingredientKey: string): boolean {
  if (
    group === 'vegetable_leafy' ||
    group === 'vegetable_gourd_root' ||
    group === 'mushroom' ||
    group === 'fruit_sour'
  ) {
    return ingredientKey !== 'TAMARIND';
  }
  if (group === 'herb_aromatic') {
    return ['SCALLION', 'CORIANDER_DILL', 'VIETNAMESE_HERBS', 'LIME_LEAF', 'BETEL_LEAF', 'PERILLA_LEAF'].includes(
      ingredientKey,
    );
  }
  return false;
}

function isAromaticMinceItem(group: NutritionIngredientGroupV6, ingredientKey: string): boolean {
  return (
    group === 'herb_aromatic' &&
    ['GARLIC', 'SHALLOT', 'ONION', 'GINGER', 'GALANGAL', 'TURMERIC', 'LEMONGRASS', 'CHILI'].includes(
      ingredientKey,
    )
  );
}

function isProteinGroup(group: NutritionIngredientGroupV6): boolean {
  return (
    group === 'protein_meat' ||
    group === 'protein_poultry' ||
    group === 'protein_seafood' ||
    group === 'protein_plant' ||
    group === 'protein_egg_dairy'
  );
}

function matchesFridgeNames(
  ingName: string,
  ingId: string,
  normalizedFridgeNames: readonly string[],
): boolean {
  if (normalizedFridgeNames.length === 0) return false;
  const targetNorm = normalizeIngredientText(ingName);
  const idNorm = normalizeIngredientText(ingId);
  return normalizedFridgeNames.some(
    (fridgeNorm) =>
      fridgeNorm.length >= 2 &&
      (targetNorm === fridgeNorm ||
        targetNorm.includes(fridgeNorm) ||
        fridgeNorm.includes(targetNorm) ||
        (idNorm.length >= 3 && idNorm === fridgeNorm)),
  );
}

function computeDishPerishabilityPriority(recipe: Recipe): number {
  let score = 50;
  for (const ing of recipe.ingredients) {
    const { profile } = resolveIngredientNutritionV6(ing.ingredientId, ing.name);
    if (profile.group === 'protein_seafood') score -= 22;
    if (profile.group === 'protein_plant') score -= 12;
    if (profile.group === 'vegetable_leafy') score -= 6;
    if (profile.group === 'protein_meat' || profile.group === 'protein_poultry') score += 8;
  }
  if (recipe.category === 'mon_cuon_nom' || recipe.category === 'mon_xao') score -= 8;
  if (recipe.category === 'mon_kho') score += 12;
  return score;
}

function inferMarinadeStyleVi(recipe: Recipe, proteinNames: string[]): string {
  const normTitle = normalizeIngredientText(`${recipe.title} ${recipe.category ?? ''}`);
  const joinedProteins = proteinNames.join(', ');

  if (recipe.category === 'mon_kho' || /\b(kho|rim)\b/.test(normTitle)) {
    return `Ướp ${joinedProteins} với hành tím, tỏi băm, nước mắm cốt, chút nước màu và tiêu xay cho thấm sâu trước khi cất hộp`;
  }
  if (/\b(nuong|ap chao|chien mam|sa ot)\b/.test(normTitle)) {
    return `Ướp ${joinedProteins} với sả/tỏi băm nhuyễn, dầu hào, chút dầu ăn khóa ẩm giúp khi nướng/áp chảo bóng mềm không khô`;
  }
  if (recipe.category === 'mon_xao' || /\b(xao)\b/.test(normTitle)) {
    return `Áo nhẹ ${joinedProteins} với tỏi/gừng băm, 1 thìa nhỏ dầu ăn và chút tiêu (chưa nêm mặn sớm để thịt không bị ra nước khi xào)`;
  }
  if (recipe.category === 'mon_canh' || /\b(canh|sup|chao|pho|bun)\b/.test(normTitle)) {
    return `Rửa sạch ${joinedProteins} với nước muối loãng/lát gừng khử mùi, thấm thật khô bằng giấy bếp rồi chia phần vừa 1 nồi canh`;
  }
  return `Sơ chế sạch ${joinedProteins}, cắt miếng đều tay vừa ăn và ướp nền hành tỏi tiêu dịu nhẹ`;
}

/**
 * Generates a structured 4-station Sunday Batch-Prep Blueprint for 1–8 selected Vietnamese/global recipes.
 */
export function buildSundayBatchPrepBlueprint(
  recipes: Recipe[],
  options?: SundayBatchPrepOptionsV6,
): BatchPrepBlueprintV6 {
  const effectiveHouseholdSize =
    typeof options?.householdSize === 'number' &&
    Number.isFinite(options.householdSize) &&
    options.householdSize > 0
      ? Math.max(1, Math.round(options.householdSize))
      : 4;

  const normalizedFridge = (options?.fridgeItemNames ?? [])
    .map((n) => normalizeIngredientText(n))
    .filter(Boolean);

  const selected = (recipes ?? []).slice(0, 8);

  if (selected.length === 0) {
    return {
      householdSize: effectiveHouseholdSize,
      selectedRecipeCount: 0,
      recipeTitles: [],
      totalPrepMinutes: 0,
      weeknightMinutesSaved: 0,
      containerCount: 0,
      stations: [
        {
          id: 'wash_greens',
          stationNumber: 1,
          titleVi: 'Trạm 01 · Rửa sạch, quay ráo & bảo quản rau thơm',
          subtitleVi: 'Nhặt, rửa, quay ly tâm ráo nước và lót giấy ẩm giữ tươi 5–7 ngày',
          estimatedMinutes: 0,
          shelfLifeNoteVi: '5–7 ngày trong hộp thoáng khí ngăn rau',
          tasks: [],
        },
        {
          id: 'chop_marinate',
          stationNumber: 2,
          titleVi: 'Trạm 02 · Sơ chế & ướp cốt thịt cá chia hộp',
          subtitleVi: 'Băm sả tỏi hành 1 mẻ và tẩm ướp đạm theo lịch nấu đầu tuần / cuối tuần',
          estimatedMinutes: 0,
          shelfLifeNoteVi: 'Ngăn mát 3°C (48h) hoặc Ngăn đông -18°C (cuối tuần)',
          tasks: [],
        },
        {
          id: 'broth_sauce',
          stationNumber: 3,
          titleVi: 'Trạm 03 · Pha sốt mắm chuẩn & ninh nước dùng nền',
          subtitleVi: 'Khuấy sẵn sốt kho/xào chua ngọt và ninh nước dùng thanh ngọt 1 mẻ',
          estimatedMinutes: 0,
          shelfLifeNoteVi: '5–7 ngày trong hũ thuỷ tinh kín',
          tasks: [],
        },
        {
          id: 'container_labels',
          stationNumber: 4,
          titleVi: 'Trạm 04 · Đóng hộp thuỷ tinh & lịch rã đông trong tuần',
          subtitleVi: 'Dán nhãn ngày nấu và nhắc chuyển rã đông xuống ngăn mát trước 12 giờ',
          estimatedMinutes: 0,
          shelfLifeNoteVi: 'Theo thứ tự ưu tiên độ tươi nguyên liệu',
          tasks: [],
        },
      ],
      containers: [],
      fridgeMatchedIngredientsVi: [],
      proTipsVi: [
        'Hãy chọn từ 1–8 món cho thực đơn tuần để hệ thống lập bản đồ sơ chế Chủ Nhật tự động.',
      ],
    };
  }

  // Sort recipes by perishability so seafood/fresh greens cook Mon-Tue (fridge 3°C) and braises/meats cook mid-to-late week (freezer -18°C)
  const orderedRecipes = [...selected].sort(
    (a, b) => computeDishPerishabilityPriority(a) - computeDishPerishabilityPriority(b),
  );

  const aggregated = new Map<string, AggregatedBatchIngredient>();
  const fridgeMatchedSet = new Set<string>();

  for (const recipe of orderedRecipes) {
    const baseServings = Math.max(1, recipe.servings || 2);
    const scale = effectiveHouseholdSize / baseServings;

    for (const ing of recipe.ingredients) {
      const { profile } = resolveIngredientNutritionV6(ing.ingredientId, ing.name);
      const mapKey = `${profile.key}:${ing.unit}`;
      const scaledQty = Number((Math.max(0.25, ing.requiredQuantity * scale)).toFixed(2));
      const inFridge = matchesFridgeNames(ing.name, ing.ingredientId, normalizedFridge);
      if (inFridge) {
        fridgeMatchedSet.add(ing.name);
      }

      const existing = aggregated.get(mapKey);
      if (existing) {
        existing.totalQuantity = Number((existing.totalQuantity + scaledQty).toFixed(2));
        existing.recipeTitles.add(recipe.title);
        existing.inFridge = existing.inFridge || inFridge;
      } else {
        aggregated.set(mapKey, {
          key: profile.key,
          ingredientId: ing.ingredientId,
          name: ing.name,
          group: profile.group,
          totalQuantity: scaledQty,
          unit: ing.unit,
          recipeTitles: new Set([recipe.title]),
          inFridge,
        });
      }
    }
  }

  const allAggregated = [...aggregated.values()];
  const containers: BatchPrepContainerLabelV6[] = [];

  // ── STATION 01: WASH GREENS & HERBS ────────────────────────────────────────
  const leafyAndHerbs = allAggregated.filter(
    (item) =>
      isGreenOrVegGroup(item.group, item.key) &&
      (item.group === 'vegetable_leafy' || item.group === 'herb_aromatic'),
  );
  const hardyRootsAndGourds = allAggregated.filter(
    (item) =>
      isGreenOrVegGroup(item.group, item.key) &&
      item.group !== 'vegetable_leafy' &&
      item.group !== 'herb_aromatic',
  );

  const station1Tasks: BatchPrepTaskV6[] = [];

  if (leafyAndHerbs.length > 0) {
    const formattedList = leafyAndHerbs.map(
      (i) =>
        `${i.name}: ${formatHumanCulinaryEquivalentVi(i.totalQuantity, i.unit, i.ingredientId, i.name)}${
          i.inFridge ? ' (đã có trong tủ lạnh)' : ''
        }`,
    );
    const recipesUsed = [...new Set(leafyAndHerbs.flatMap((i) => [...i.recipeTitles]))];
    station1Tasks.push({
      taskId: 'wash_greens_leafy',
      stationId: 'wash_greens',
      titleVi: 'Nhặt gốc, rửa sạch & quay ráo 100% nhóm rau lá – rau thơm',
      instructionVi:
        'Nhặt bỏ lá úa, rửa qua 2–3 nước sạch rồi dùng rổ quay rau vẩy thật khô ráo mặt lá. Xếp vào hộp thoáng khí có lót 1 lớp khăn giấy bếp hơi ẩm dưới đáy và phủ 1 lớp khăn giấy khô phía trên để hút ẩm thừa, giữ rau giòn ngọt suốt 5–7 ngày.',
      ingredientsSummaryVi: formattedList,
      usedInRecipeTitles: recipesUsed,
      storageZoneVi: GREENS_BOX_ZONE,
      shelfLifeVi: '5–7 ngày',
      estimatedMinutes: Math.min(18, 7 + leafyAndHerbs.length * 2),
      alreadyInFridge: leafyAndHerbs.every((i) => i.inFridge),
    });

    containers.push({
      containerNumber: containers.length + 1,
      labelCode: `HỘP #0${containers.length + 1}`,
      labelVi: 'Rau lá & Rau thơm đã quay ráo (Lót giấy ẩm)',
      contentsVi: leafyAndHerbs.map((i) => i.name).join(', '),
      recipeTitle: recipesUsed.join(' · '),
      storageZoneVi: GREENS_BOX_ZONE,
      cookDayOrder: 1,
      plannedCookDayVi: 'Dùng xuyên suốt Thứ Hai – Thứ Bảy',
      thawGuidanceVi: 'Mở hộp lấy lượng vừa đủ ngay trước khi bật bếp; thay khăn giấy nếu ẩm nhiều.',
      shelfLifeVi: '5–7 ngày',
    });
  }

  if (hardyRootsAndGourds.length > 0) {
    const formattedRoots = hardyRootsAndGourds.map(
      (i) =>
        `${i.name}: ${formatHumanCulinaryEquivalentVi(i.totalQuantity, i.unit, i.ingredientId, i.name)}${
          i.inFridge ? ' (đã có trong tủ lạnh)' : ''
        }`,
    );
    const recipesUsed = [...new Set(hardyRootsAndGourds.flatMap((i) => [...i.recipeTitles]))];
    station1Tasks.push({
      taskId: 'wash_greens_roots',
      stationId: 'wash_greens',
      titleVi: 'Gọt vỏ, cắt miếng sẵn nhóm củ quả & nấm tươi',
      instructionVi:
        'Củ quả cứng (cà rốt, bí đỏ, củ cải, su su) gọt vỏ, cắt khúc vừa ăn, thấm khô vết cắt rồi cất hộp thuỷ tinh lót giấy thấm ẩm. Riêng cà chua và nấm giữ khô nguyên vẹn, không rửa nước trước để giữ trọn độ săn ngọt 5–7 ngày.',
      ingredientsSummaryVi: formattedRoots,
      usedInRecipeTitles: recipesUsed,
      storageZoneVi: GREENS_BOX_ZONE,
      shelfLifeVi: '5–7 ngày',
      estimatedMinutes: Math.min(16, 6 + hardyRootsAndGourds.length * 2),
      alreadyInFridge: hardyRootsAndGourds.every((i) => i.inFridge),
    });

    containers.push({
      containerNumber: containers.length + 1,
      labelCode: `HỘP #0${containers.length + 1}`,
      labelVi: 'Củ quả cắt sẵn (Hộp thoáng khí lót giấy)',
      contentsVi: hardyRootsAndGourds.map((i) => i.name).join(', '),
      recipeTitle: recipesUsed.join(' · '),
      storageZoneVi: GREENS_BOX_ZONE,
      cookDayOrder: 1,
      plannedCookDayVi: 'Thứ Hai – Chủ Nhật',
      thawGuidanceVi: 'Không cần rã đông — trút thẳng vào nồi canh/chảo xào.',
      shelfLifeVi: '5–7 ngày',
    });
  }

  if (station1Tasks.length === 0) {
    station1Tasks.push({
      taskId: 'wash_greens_garnish_default',
      stationId: 'wash_greens',
      titleVi: 'Chuẩn bị hộp hành ngò & rau ăn kèm tươi giòn cả tuần',
      instructionVi:
        'Rửa sạch hành lá, ngò rí và dưa leo/rau ăn kèm, để thật ráo nước trên rổ thưa 15 phút rồi xếp vào hộp thoáng khí lót giấy bếp hơi ẩm để dùng dần trong 5–7 ngày.',
      ingredientsSummaryVi: ['Hành lá, ngò rí & rau ăn kèm cơ bản'],
      usedInRecipeTitles: orderedRecipes.map((r) => r.title),
      storageZoneVi: GREENS_BOX_ZONE,
      shelfLifeVi: '5–7 ngày',
      estimatedMinutes: 8,
      alreadyInFridge: false,
    });
  }

  // ── STATION 02: CHOP AROMATICS & MARINATE PROTEINS ─────────────────────────
  const station2Tasks: BatchPrepTaskV6[] = [];
  const aromatics = allAggregated.filter((item) => isAromaticMinceItem(item.group, item.key));

  if (aromatics.length > 0) {
    station2Tasks.push({
      taskId: 'chop_aromatics_batch',
      stationId: 'chop_marinate',
      titleVi: 'Bóc vỏ & băm mẻ lớn hành tím – tỏi – gừng – sả dùng cả tuần',
      instructionVi:
        'Bóc vỏ và băm nhuyễn toàn bộ gia vị thơm trong 1 lần để tiết kiệm công rửa thớt mỗi tối. Chia 1/2 dùng ngay để ướp cốt thịt cá bên dưới, 1/2 còn lại cho vào hũ thuỷ tinh nhỏ trộn 1 lớp mỏng dầu ăn bảo quản ngăn mát 3°C.',
      ingredientsSummaryVi: aromatics.map(
        (a) =>
          `${a.name}: ${formatHumanCulinaryEquivalentVi(a.totalQuantity, a.unit, a.ingredientId, a.name)}`,
      ),
      usedInRecipeTitles: [...new Set(aromatics.flatMap((a) => [...a.recipeTitles]))],
      storageZoneVi: SAUCE_JAR_ZONE,
      shelfLifeVi: '5–7 ngày',
      estimatedMinutes: Math.min(15, 6 + aromatics.length * 2),
      alreadyInFridge: aromatics.every((a) => a.inFridge),
    });
  }

  orderedRecipes.forEach((recipe, idx) => {
    const baseServings = Math.max(1, recipe.servings || 2);
    const scale = effectiveHouseholdSize / baseServings;
    const recipeProteins = recipe.ingredients.filter((ing) => {
      const { profile } = resolveIngredientNutritionV6(ing.ingredientId, ing.name);
      return isProteinGroup(profile.group) && profile.key !== 'CHICKEN_EGG' && profile.key !== 'FRESH_MILK';
    });

    const hasSeafoodOrTofu = recipeProteins.some((ing) => {
      const { profile } = resolveIngredientNutritionV6(ing.ingredientId, ing.name);
      return profile.group === 'protein_seafood' || profile.group === 'protein_plant';
    });

    // Seafood/tofu slated for Mon-Tue stays in 3°C chiller (48h); dishes from index >= 2 (or hearty late-week braises when >=2 dishes) freeze at -18°C
    const useChiller48h = idx === 0 || (idx === 1 && (hasSeafoodOrTofu || orderedRecipes.length >= 3));
    const storageZone = useChiller48h ? CHILL_ZONE_48H : FREEZER_ZONE_WEEKEND;
    const shelfLife = useChiller48h ? 'Tối đa 48 giờ (Ngăn mát 3°C)' : '7–14 ngày (Ngăn đông -18°C)';
    const plannedDay = WEEKDAY_LABELS_VI[Math.min(idx, WEEKDAY_LABELS_VI.length - 1)];

    if (recipeProteins.length > 0) {
      const proteinNames = recipeProteins.map((p) => p.name);
      const summaryLines = recipeProteins.map((p) => {
        const qty = Number((Math.max(0.5, p.requiredQuantity * scale)).toFixed(1));
        const inFridge = matchesFridgeNames(p.name, p.ingredientId, normalizedFridge);
        return `${p.name}: ${formatHumanCulinaryEquivalentVi(qty, p.unit, p.ingredientId, p.name)}${
          inFridge ? ' (sẵn trong tủ)' : ''
        }`;
      });

      const marinadeGuide = inferMarinadeStyleVi(recipe, proteinNames);

      station2Tasks.push({
        taskId: `marinate_dish_${idx + 1}`,
        stationId: 'chop_marinate',
        titleVi: `Chia hộp đạm Món #${idx + 1}: ${recipe.title}`,
        instructionVi: `${marinadeGuide}. Đóng hộp kín đặt tại ${storageZone}.`,
        ingredientsSummaryVi: summaryLines,
        usedInRecipeTitles: [recipe.title],
        storageZoneVi: storageZone,
        shelfLifeVi: shelfLife,
        estimatedMinutes: 7,
        alreadyInFridge: recipeProteins.every((p) =>
          matchesFridgeNames(p.name, p.ingredientId, normalizedFridge),
        ),
      });

      const boxNum = containers.length + 1;
      containers.push({
        containerNumber: boxNum,
        labelCode: boxNum < 10 ? `HỘP #0${boxNum}` : `HỘP #${boxNum}`,
        labelVi: `${plannedDay} · ${recipe.title} (Cốt đạm đã sơ chế/ướp)`,
        contentsVi: summaryLines.join('; '),
        recipeTitle: recipe.title,
        storageZoneVi: storageZone,
        cookDayOrder: idx + 1,
        plannedCookDayVi: plannedDay,
        thawGuidanceVi: useChiller48h
          ? 'Lấy trực tiếp từ ngăn mát 3°C trước bữa nấu 10 phút cho bớt lạnh rồi lên bếp.'
          : `Chuyển hộp từ ngăn đông -18°C xuống ngăn mát 3°C vào tối trước ${plannedDay} (trước 10–12 giờ) để rã đông chậm giữ mọng thớ thịt.`,
        shelfLifeVi: shelfLife,
      });
    }
  });

  if (station2Tasks.length === 0) {
    station2Tasks.push({
      taskId: 'chop_marinate_fallback',
      stationId: 'chop_marinate',
      titleVi: 'Sơ chế đậu phụ / trứng & hành tỏi băm chia khay',
      instructionVi:
        'Băm sẵn tỏi hành tím cất hũ kín; đậu phụ thay nước sạch bảo quản trong hộp ngập nước lọc ở Ngăn mát 3°C (nấu trong 48h).',
      ingredientsSummaryVi: ['Đậu phụ / trứng & hành tỏi cơ bản'],
      usedInRecipeTitles: orderedRecipes.map((r) => r.title),
      storageZoneVi: CHILL_ZONE_48H,
      shelfLifeVi: '48 giờ',
      estimatedMinutes: 9,
      alreadyInFridge: false,
    });
  }

  // ── STATION 03: MASTER SAUCES & BASE BROTHS ────────────────────────────────
  const station3Tasks: BatchPrepTaskV6[] = [];

  const braiseDishes = orderedRecipes.filter(
    (r) =>
      r.category === 'mon_kho' ||
      /\b(kho|rim)\b/.test(normalizeIngredientText(r.title)),
  );
  const soupOrNoodleDishes = orderedRecipes.filter((r) => {
    const cleanTitle = normalizeIngredientText(r.title)
      .replace(/\bmien\s+(bac|trung|nam|tay)\b/g, ' ')
      .replace(/\bsup\s+lo\b/g, ' ');
    return (
      r.category === 'mon_canh' ||
      r.category === 'mon_bun_pho' ||
      /\b(canh|sup|pho|bun|chao|mien)\b/.test(cleanTitle)
    );
  });
  const stirFryOrGlazeDishes = orderedRecipes.filter(
    (r) =>
      r.category === 'mon_xao' ||
      r.category === 'mon_chien' ||
      /\b(xao|chua ngot|sot ca|chien mam)\b/.test(normalizeIngredientText(r.title)),
  );

  if (braiseDishes.length > 0) {
    const tbspFishSauce = braiseDishes.length * 3;
    const tbspSugar = braiseDishes.length * 1.5;
    station3Tasks.push({
      taskId: 'sauce_braise_master',
      stationId: 'broth_sauce',
      titleVi: 'Pha hũ Cốt Sốt Kho – Rim màu hổ phách chuẩn vị',
      instructionVi: `Thắng nhẹ ${tbspSugar} muỗng canh đường thành nước màu cánh gián (hoặc dùng nước màu dừa), khuấy tan cùng ${tbspFishSauce} muỗng canh nước mắm ngon, tiêu sọ đập dập và chút nước lọc. Để nguội rót vào hũ thuỷ tinh — tối trong tuần chỉ cần rưới vào nồi kho.`,
      ingredientsSummaryVi: [
        `Nước mắm cốt (${tbspFishSauce} muỗng canh)`,
        `Đường / Nước màu dừa (${tbspSugar} muỗng canh)`,
        'Tiêu đen xay & đầu hành băm',
      ],
      usedInRecipeTitles: braiseDishes.map((d) => d.title),
      storageZoneVi: SAUCE_JAR_ZONE,
      shelfLifeVi: '7–10 ngày',
      estimatedMinutes: 8,
      alreadyInFridge: false,
    });

    const boxNum = containers.length + 1;
    containers.push({
      containerNumber: boxNum,
      labelCode: boxNum < 10 ? `HỘP #0${boxNum}` : `HỘP #${boxNum}`,
      labelVi: 'Hũ Cốt Sốt Kho Tiêu Nước Màu (Lắc đều trước khi kho)',
      contentsVi: `${tbspFishSauce} mc nước mắm + nước màu + tiêu sọ`,
      recipeTitle: braiseDishes.map((d) => d.title).join(' · '),
      storageZoneVi: SAUCE_JAR_ZONE,
      cookDayOrder: 2,
      plannedCookDayVi: 'Dùng cho các bữa món kho/rim trong tuần',
      thawGuidanceVi: 'Bảo quản ngăn mát, khuấy đều và rưới trực tiếp vào nồi.',
      shelfLifeVi: '7–10 ngày',
    });
  }

  if (soupOrNoodleDishes.length > 0) {
    const brothLiters = Number((soupOrNoodleDishes.length * 0.85).toFixed(1));
    station3Tasks.push({
      taskId: 'broth_simmer_batch',
      stationId: 'broth_sauce',
      titleVi: `Ninh 1 mẻ ${brothLiters} lít Nước Dùng Nền thanh ngọt chia hộp`,
      instructionVi: `Ninh xương heo/ức gà hoặc củ cải trắng, cà rốt, hành tây nướng thơm trong 25 phút trên lửa liu riu, hớt sạch bọt để thu ${brothLiters} lít nước dùng trong veo. Làm nguội nhanh rồi chia hộp: phần nấu đầu tuần để ngăn mát 3°C, phần cuối tuần cấp đông -18°C.`,
      ingredientsSummaryVi: [
        `Nước dùng nền thanh ngọt (${brothLiters} lít)`,
        'Hành tây, củ cải / gốc ngò ninh ngọt tự nhiên',
      ],
      usedInRecipeTitles: soupOrNoodleDishes.map((d) => d.title),
      storageZoneVi: soupOrNoodleDishes.length > 1 ? FREEZER_ZONE_WEEKEND : CHILL_ZONE_48H,
      shelfLifeVi: soupOrNoodleDishes.length > 1 ? '3 ngày ngăn mát / 14 ngày ngăn đông' : '48–72 giờ',
      estimatedMinutes: 15,
      alreadyInFridge: false,
    });

    const boxNum = containers.length + 1;
    containers.push({
      containerNumber: boxNum,
      labelCode: boxNum < 10 ? `HỘP #0${boxNum}` : `HỘP #${boxNum}`,
      labelVi: `Nước Dùng Nền Thanh Ngọt (${brothLiters}L chia phần)`,
      contentsVi: `Nước dùng ninh sẵn cho ${soupOrNoodleDishes.length} bữa canh/bún`,
      recipeTitle: soupOrNoodleDishes.map((d) => d.title).join(' · '),
      storageZoneVi: soupOrNoodleDishes.length > 1 ? FREEZER_ZONE_WEEKEND : CHILL_ZONE_48H,
      cookDayOrder: 2,
      plannedCookDayVi: 'Các bữa canh / bún trong tuần',
      thawGuidanceVi: 'Đun sôi trực tiếp khối nước dùng trên bếp 4 phút rồi thả rau/đạm vào nấu chín tới.',
      shelfLifeVi: '3–14 ngày',
    });
  }

  if (stirFryOrGlazeDishes.length > 0 || station3Tasks.length === 0) {
    const targetDishes =
      stirFryOrGlazeDishes.length > 0 ? stirFryOrGlazeDishes : orderedRecipes;
    station3Tasks.push({
      taskId: 'sauce_stirfry_glaze',
      stationId: 'broth_sauce',
      titleVi: 'Khuấy sẵn hũ Sốt Xào & Nước Mắm Tỏi Ớt đa năng',
      instructionVi:
        'Hòa tan sẵn dầu hào, nước tương/nước mắm, chút đường và tiêu trong hũ thuỷ tinh sạch để khi xào lửa lớn chỉ mất 30 giây rưới đều mặt chảo, rau vẫn xanh mướt giòn ngọt.',
      ingredientsSummaryVi: [
        'Sốt xào cân bằng mặn-ngọt (dầu hào + nước mắm + tiêu)',
        'Tỏi ớt băm ngâm chanh mắm chấm kèm',
      ],
      usedInRecipeTitles: targetDishes.map((d) => d.title),
      storageZoneVi: SAUCE_JAR_ZONE,
      shelfLifeVi: '7 ngày',
      estimatedMinutes: 6,
      alreadyInFridge: false,
    });

    const boxNum = containers.length + 1;
    containers.push({
      containerNumber: boxNum,
      labelCode: boxNum < 10 ? `HỘP #0${boxNum}` : `HỘP #${boxNum}`,
      labelVi: 'Hũ Sốt Xào Đa Năng & Mắm Tỏi Chấm',
      contentsVi: 'Sốt xào pha sẵn chuẩn tỷ lệ gia đình',
      recipeTitle: targetDishes.map((d) => d.title).join(' · '),
      storageZoneVi: SAUCE_JAR_ZONE,
      cookDayOrder: 1,
      plannedCookDayVi: 'Dùng nhanh mọi tối trong tuần',
      thawGuidanceVi: 'Khuấy nhẹ 3 giây trước khi rưới vào chảo nóng.',
      shelfLifeVi: '7 ngày',
    });
  }

  // ── STATION 04: GLASS CONTAINER LABELING & THAW SCHEDULE ───────────────────
  const chillContainers = containers.filter((c) => c.storageZoneVi === CHILL_ZONE_48H);
  const freezeContainers = containers.filter((c) => c.storageZoneVi === FREEZER_ZONE_WEEKEND);

  const station4Tasks: BatchPrepTaskV6[] = [
    {
      taskId: 'container_pack_and_label',
      stationId: 'container_labels',
      titleVi: `Đóng nắp & dán nhãn ${containers.length} hộp thuỷ tinh phân tầng nhiệt độ`,
      instructionVi: `Đợi nước dùng/sốt nguội hẳn mới đậy nắp kín. Dán băng keo giấy ghi rõ [Thứ nấu + Tên món]: xếp ${
        chillContainers.length
      } hộp đạm đầu tuần ở ${CHILL_ZONE_48H}${
        freezeContainers.length > 0
          ? `, và xếp phẳng ${freezeContainers.length} hộp đạm cuối tuần vào ${FREEZER_ZONE_WEEKEND}`
          : ''
      }.`,
      ingredientsSummaryVi: containers.map((c) => `${c.labelCode}: ${c.labelVi} → ${c.storageZoneVi}`),
      usedInRecipeTitles: orderedRecipes.map((r) => r.title),
      storageZoneVi:
        freezeContainers.length > 0
          ? `${CHILL_ZONE_48H} & ${FREEZER_ZONE_WEEKEND}`
          : CHILL_ZONE_48H,
      shelfLifeVi: 'Theo lịch rã đông từng ngày',
      estimatedMinutes: Math.max(5, Math.min(12, 4 + orderedRecipes.length)),
      alreadyInFridge: false,
    },
  ];

  if (freezeContainers.length > 0) {
    station4Tasks.push({
      taskId: 'thaw_schedule_reminder',
      stationId: 'container_labels',
      titleVi: 'Lịch chuyển hộp rã đông chậm qua đêm (An toàn vi sinh)',
      instructionVi: `Từ tối Thứ Ba trở đi, mỗi tối sau bữa ăn chỉ mất 15 giây chuyển hộp của ngày hôm sau từ ${FREEZER_ZONE_WEEKEND} xuống ${CHILL_ZONE_48H} để thịt cá rã đông từ từ, giữ nguyên nước ngọt tự nhiên.`,
      ingredientsSummaryVi: freezeContainers.map(
        (c) => `${c.plannedCookDayVi}: ${c.recipeTitle ?? c.labelVi}`,
      ),
      usedInRecipeTitles: freezeContainers
        .map((c) => c.recipeTitle)
        .filter((t): t is string => Boolean(t)),
      storageZoneVi: FREEZER_ZONE_WEEKEND,
      shelfLifeVi: 'Rã đông trước 10–12 giờ ở ngăn mát 3°C',
      estimatedMinutes: 3,
      alreadyInFridge: false,
    });
  }

  // ── CALIBRATE REALISTIC BATCH TIMING (35–95 MINS) ──────────────────────────
  const rawS1 = station1Tasks.reduce((acc, t) => acc + t.estimatedMinutes, 0);
  const rawS2 = station2Tasks.reduce((acc, t) => acc + t.estimatedMinutes, 0);
  const rawS3 = station3Tasks.reduce((acc, t) => acc + t.estimatedMinutes, 0);
  const rawS4 = station4Tasks.reduce((acc, t) => acc + t.estimatedMinutes, 0);
  const rawSum = Math.max(1, rawS1 + rawS2 + rawS3 + rawS4);

  // Target realistic Sunday batch-prep window: ~38 mins for 1 dish up to ~92 mins for 8 dishes
  const targetTotalMinutes = Math.min(
    95,
    Math.max(35, Math.round(30 + orderedRecipes.length * 8.2)),
  );
  const ratio = targetTotalMinutes / rawSum;

  const s1Mins = Math.max(8, Math.round(rawS1 * ratio));
  const s2Mins = Math.max(10, Math.round(rawS2 * ratio));
  const s3Mins = Math.max(8, Math.round(rawS3 * ratio));
  const s4Mins = Math.max(5, targetTotalMinutes - s1Mins - s2Mins - s3Mins);
  const totalPrepMinutes = s1Mins + s2Mins + s3Mins + s4Mins;

  const weeknightMinutesSaved = orderedRecipes.reduce((sum, recipe) => {
    const perDishSaved =
      recipe.category === 'mon_kho' || recipe.category === 'mon_bun_pho'
        ? 24
        : recipe.category === 'mon_canh'
          ? 20
          : 18;
    return sum + perDishSaved;
  }, 0);

  const stations: BatchPrepStationV6[] = [
    {
      id: 'wash_greens',
      stationNumber: 1,
      titleVi: 'Trạm 01 · Rửa sạch, quay ráo & bảo quản rau thơm',
      subtitleVi: 'Làm sạch rau củ trước khi chạm vào thịt sống để thớt và bồn rửa luôn tinh tươm',
      estimatedMinutes: s1Mins,
      shelfLifeNoteVi: 'Tươi giòn 5–7 ngày với kỹ thuật lót khăn giấy ẩm trong hộp thoáng khí',
      tasks: station1Tasks,
    },
    {
      id: 'chop_marinate',
      stationNumber: 2,
      titleVi: 'Trạm 02 · Sơ chế & ướp cốt thịt cá chia hộp',
      subtitleVi: 'Băm hành tỏi sả 1 mẻ lớn và tẩm ướp đạm chia sẵn theo khẩu phần gia đình',
      estimatedMinutes: s2Mins,
      shelfLifeNoteVi: `${CHILL_ZONE_48H} cho món đầu tuần · ${FREEZER_ZONE_WEEKEND} cho món cuối tuần`,
      tasks: station2Tasks,
    },
    {
      id: 'broth_sauce',
      stationNumber: 3,
      titleVi: 'Trạm 03 · Pha sốt mắm chuẩn & ninh nước dùng nền',
      subtitleVi: 'Chuẩn bị sẵn linh hồn hương vị để tối đi làm về chỉ mất 12–15 phút đỏ lửa',
      estimatedMinutes: s3Mins,
      shelfLifeNoteVi: 'Hũ sốt giữ 7 ngày ngăn mát · Nước dùng chia hộp mát/đông linh hoạt',
      tasks: station3Tasks,
    },
    {
      id: 'container_labels',
      stationNumber: 4,
      titleVi: 'Trạm 04 · Đóng hộp thuỷ tinh & lịch rã đông trong tuần',
      subtitleVi: 'Sắp xếp tủ lạnh khoa học theo thứ tự ngày nấu và nhắc rã đông an toàn',
      estimatedMinutes: s4Mins,
      shelfLifeNoteVi: `Tổng cộng ${containers.length} hộp/hũ gọn gàng theo nhãn ngày`,
      tasks: station4Tasks,
    },
  ];

  const fridgeMatchedList = [...fridgeMatchedSet];
  const proTipsVi: string[] = [
    'Quy tắc 1 thớt sạch trước – đạm sống sau: Luôn hoàn tất Trạm 01 (rau thơm) và băm hành tỏi trước khi cắt thịt cá ở Trạm 02 để tránh nhiễm chéo vi sinh.',
    'Bí quyết rau thơm tươi 7 ngày không thối nhũn: Nước đọng trên lá là kẻ thù số 1 — hãy vẩy thật ráo rồi kẹp giữa 2 lớp giấy bếp trong hộp cứng.',
    'Không nêm nhiều muối/nước mắm vào thịt bò xào từ Chủ Nhật; chỉ áo 1 thìa dầu ăn + tỏi gừng để giữ thớ thịt mọng nước suốt tuần.',
    'Luôn rã đông hộp đạm cuối tuần bằng cách hạ từ ngăn đông -18°C xuống ngăn mát 3°C trước 10–12 giờ (tuyệt đối tránh ngâm nước nóng).',
  ];

  if (fridgeMatchedList.length > 0) {
    proTipsVi.unshift(
      `Tận dụng ngay thực phẩm sẵn có trong tủ lạnh (${fridgeMatchedList.slice(0, 5).join(', ')}) xếp vào nhóm nấu Thứ Hai – Thứ Ba theo nguyên tắc FEFO.`,
    );
  }

  return {
    householdSize: effectiveHouseholdSize,
    selectedRecipeCount: orderedRecipes.length,
    recipeTitles: orderedRecipes.map((r) => r.title),
    totalPrepMinutes,
    weeknightMinutesSaved,
    containerCount: containers.length,
    stations,
    containers,
    fridgeMatchedIngredientsVi: fridgeMatchedList,
    proTipsVi,
  };
}
