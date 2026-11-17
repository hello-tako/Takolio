import { normalizeIngredientText } from '@takolio/domain';
import type { Recipe, RecipeIngredient } from '../types';

export interface NutritionMacroMicroV6 {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
}

export interface IngredientUnitGramsMapV6 {
  piece?: number;
  fruit?: number;
  bulb?: number;
  clove?: number;
  bunch?: number;
  slice?: number;
  pack?: number;
  bowl?: number;
  cup?: number;
  tbsp?: number;
  tsp?: number;
  stalk?: number;
  sprig?: number;
  sheet?: number;
  pinch?: number;
  densityGPerMl?: number;
}

export type NutritionIngredientGroupV6 =
  | 'protein_meat'
  | 'protein_poultry'
  | 'protein_seafood'
  | 'protein_egg_dairy'
  | 'protein_plant'
  | 'grain_starch'
  | 'vegetable_leafy'
  | 'vegetable_gourd_root'
  | 'mushroom'
  | 'herb_aromatic'
  | 'fruit_sour'
  | 'sauce_seasoning'
  | 'cooking_fat'
  | 'nut_seed'
  | 'liquid_base';

export interface IngredientNutritionProfileV6 {
  key: string;
  nameVi: string;
  group: NutritionIngredientGroupV6;
  keywords: readonly string[];
  per100g: NutritionMacroMicroV6;
  unitGrams: IngredientUnitGramsMapV6;
  glycemicIndexTier?: 'low' | 'medium' | 'high';
}

export interface RecipeNutritionReportV6 {
  servings: number;
  perServing: NutritionMacroMicroV6;
  totalDish: NutritionMacroMicroV6;
  macroSplitPct: {
    proteinPct: number;
    carbsPct: number;
    fatPct: number;
  };
  healthBadgesVi: string[];
  sodiumAdvisoryVi: string | null;
  glycemicLoadLabelVi: 'Thấp' | 'Cân bằng' | 'Năng lượng cao';
  confidence: 'high' | 'estimated';
}

export interface VietnameseRdiBenchmarksV6 {
  caloriesKcal: 2000;
  proteinG: 65;
  carbsG: 260;
  fatG: 60;
  fiberG: 25;
  sodiumMg: 2000;
}

export const VIETNAMESE_RDI_BENCHMARKS_V6: VietnameseRdiBenchmarksV6 = {
  caloriesKcal: 2000,
  proteinG: 65,
  carbsG: 260,
  fatG: 60,
  fiberG: 25,
  sodiumMg: 2000,
};

export interface DailyTrayNutritionBalanceV6 {
  householdSize: number;
  dishCount: number;
  perPersonIntake: NutritionMacroMicroV6;
  householdTotal: NutritionMacroMicroV6;
  rdiBenchmarks: VietnameseRdiBenchmarksV6;
  rdiCompletionPct: {
    caloriesPct: number;
    proteinPct: number;
    carbsPct: number;
    fatPct: number;
    fiberPct: number;
    sodiumPct: number;
  };
  balanceScore: number;
  statusLabelVi:
    | 'Chưa có món'
    | 'Thanh nhẹ · Cần thêm năng lượng'
    | 'Cân đối chuẩn mâm cơm Việt'
    | 'Giàu năng lượng · Cần thêm rau xanh'
    | 'Đậm vị · Lưu ý giảm mặn';
  coachSummaryVi: string;
  dishReports: Array<{
    recipeId: string;
    title: string;
    report: RecipeNutritionReportV6;
  }>;
}

function p(
  key: string,
  nameVi: string,
  group: NutritionIngredientGroupV6,
  keywords: readonly string[],
  per100g: NutritionMacroMicroV6,
  unitGrams: IngredientUnitGramsMapV6 = {},
  glycemicIndexTier?: 'low' | 'medium' | 'high',
): IngredientNutritionProfileV6 {
  return {
    key,
    nameVi,
    group,
    keywords: keywords.map((kw) => normalizeIngredientText(kw)).filter(Boolean),
    per100g,
    unitGrams,
    glycemicIndexTier,
  };
}

/**
 * Curated 120+ Vietnamese & Global Culinary Macro/Micro Nutrition Profiles (per 100g / 100ml edible portion).
 * Reference calibrated with Viện Dinh Dưỡng Quốc Gia Việt Nam (NIN) & USDA FoodData Central.
 */
export const NUTRITION_DICTIONARY_V6: readonly IngredientNutritionProfileV6[] = [
  // ── 1. PORK (THỊT HEO / LỢN) ──────────────────────────────────────────────
  p(
    'PORK_BELLY',
    'Thịt ba chỉ heo',
    'protein_meat',
    ['thit ba chi', 'ba chi', 'ba roi', 'thit ba roi', 'pork belly', 'ba chi heo', 'ba chi rut suon'],
    { caloriesKcal: 395, proteinG: 14.5, carbsG: 0, fatG: 37.0, fiberG: 0, sodiumMg: 62 },
    { piece: 150, slice: 45, pack: 400, bowl: 150 },
  ),
  p(
    'GROUND_PORK',
    'Thịt heo xay / Thịt băm',
    'protein_meat',
    ['thit heo xay', 'thit bam', 'thit xay', 'thit lon xay', 'thit bam nho', 'nac vai xay', 'ground pork', 'minced pork'],
    { caloriesKcal: 263, proteinG: 17.5, carbsG: 0, fatG: 21.0, fiberG: 0, sodiumMg: 65 },
    { piece: 100, tbsp: 18, bowl: 160, pack: 300 },
  ),
  p(
    'PORK_LEAN',
    'Thịt heo nạc / Thăn heo / Nạc vai',
    'protein_meat',
    ['thit heo nac', 'thit than heo', 'thit nac vai', 'nac dam', 'thit lon nac', 'thit heo', 'thit lon', 'thit luoc', 'lean pork', 'pork loin', 'pork shoulder'],
    { caloriesKcal: 195, proteinG: 21.5, carbsG: 0, fatG: 11.8, fiberG: 0, sodiumMg: 58 },
    { piece: 120, slice: 40, pack: 350 },
  ),
  p(
    'PORK_RIBS',
    'Sườn heo non',
    'protein_meat',
    ['suon heo', 'suon non', 'suon sun', 'suon cot let', 'suon', 'pork ribs', 'spare ribs'],
    // Edible yield adjusted (~72% meat on bone) so raw bone-in weight produces accurate macros
    { caloriesKcal: 238, proteinG: 15.8, carbsG: 0, fatG: 19.2, fiberG: 0, sodiumMg: 68 },
    { piece: 65, slice: 80, pack: 500 },
  ),
  p(
    'PORK_HOCK',
    'Chân giò / Móng giò heo',
    'protein_meat',
    ['chan gio', 'mong gio', 'gio heo', 'bap gio heo', 'pork hock', 'pork trotter'],
    { caloriesKcal: 255, proteinG: 17.2, carbsG: 0, fatG: 20.4, fiberG: 0, sodiumMg: 72 },
    { piece: 250, slice: 90, pack: 500 },
  ),
  p(
    'VIETNAMESE_HAM',
    'Chả lụa / Giò lụa',
    'protein_meat',
    ['cha lua', 'gio lua', 'gio thu', 'cha que', 'gio cha', 'nem chua', 'vietnamese ham'],
    { caloriesKcal: 218, proteinG: 18.5, carbsG: 3.5, fatG: 14.2, fiberG: 0, sodiumMg: 780 },
    { slice: 35, piece: 100, pack: 500 },
  ),
  p(
    'CHINESE_SAUSAGE',
    'Lạp xưởng',
    'protein_meat',
    ['lap xuong', 'lap suon', 'chinese sausage', 'xuc xich'],
    { caloriesKcal: 460, proteinG: 19.0, carbsG: 11.0, fatG: 38.0, fiberG: 0, sodiumMg: 960 },
    { piece: 55, slice: 10, pack: 250 },
  ),
  p(
    'PORK_LIVER_PATE',
    'Gan heo / Pate gan',
    'protein_meat',
    ['gan heo', 'gan lon', 'pate', 'pa te', 'pork liver'],
    { caloriesKcal: 165, proteinG: 20.4, carbsG: 3.2, fatG: 7.5, fiberG: 0, sodiumMg: 290 },
    { tbsp: 18, slice: 40, pack: 200 },
  ),
  p(
    'BACON',
    'Thịt xông khói / Bacon',
    'protein_meat',
    ['thit xong khoi', 'ba chi xong khoi', 'bacon', 'guanciale', 'pancetta'],
    { caloriesKcal: 458, proteinG: 15.0, carbsG: 1.2, fatG: 43.5, fiberG: 0, sodiumMg: 1150 },
    { slice: 25, piece: 30, pack: 200 },
  ),

  // ── 2. BEEF (THỊT BÒ) ─────────────────────────────────────────────────────
  p(
    'BEEF_SIRLOIN',
    'Thịt bò thăn / Phi lê bò',
    'protein_meat',
    ['thit bo', 'bo phi le', 'than bo', 'thit bo mem', 'thit bo thai mong', 'beef', 'beef sirloin', 'beef tenderloin'],
    { caloriesKcal: 182, proteinG: 22.5, carbsG: 0, fatG: 9.8, fiberG: 0, sodiumMg: 60 },
    { piece: 150, slice: 35, pack: 300 },
  ),
  p(
    'BEEF_SHANK',
    'Bắp bò / Gân bò',
    'protein_meat',
    ['bap bo', 'gan bo', 'bap bo hoa', 'beef shank', 'beef tendon'],
    { caloriesKcal: 196, proteinG: 24.2, carbsG: 0, fatG: 10.6, fiberG: 0, sodiumMg: 66 },
    { piece: 180, slice: 45, pack: 400 },
  ),
  p(
    'BEEF_BRISKET',
    'Nạm bò / Gầu bò / Dẻ sườn bò',
    'protein_meat',
    ['nam bo', 'bo kho', 'de suon bo', 'gau bo', 'ba chi bo', 'beef brisket', 'beef short ribs'],
    { caloriesKcal: 255, proteinG: 20.8, carbsG: 0, fatG: 19.0, fiberG: 0, sodiumMg: 68 },
    { piece: 180, slice: 45, pack: 400 },
  ),
  p(
    'LAMB_GOAT',
    'Thịt cừu / Thịt dê',
    'protein_meat',
    ['thit cuu', 'suon cuu', 'thit de', 'lamb', 'goat meat'],
    { caloriesKcal: 235, proteinG: 20.5, carbsG: 0, fatG: 16.8, fiberG: 0, sodiumMg: 72 },
    { piece: 160, slice: 45, pack: 350 },
  ),
  p(
    'GROUND_BEEF',
    'Thịt bò băm / Bò xay',
    'protein_meat',
    ['thit bo bam', 'thit bo xay', 'bo bam', 'bo xay', 'ground beef', 'minced beef'],
    { caloriesKcal: 242, proteinG: 19.5, carbsG: 0, fatG: 18.0, fiberG: 0, sodiumMg: 68 },
    { tbsp: 18, bowl: 160, pack: 300 },
  ),
  p(
    'BEEF_MEATBALL',
    'Bò viên',
    'protein_meat',
    ['bo vien', 'cha bo', 'beef meatball', 'beef balls'],
    { caloriesKcal: 225, proteinG: 16.5, carbsG: 6.2, fatG: 14.8, fiberG: 0.2, sodiumMg: 740 },
    { piece: 22, pack: 250 },
  ),
  p(
    'BEEF_BONE',
    'Xương ống bò / Xương heo ninh nước dùng',
    'protein_meat',
    ['xuong ong', 'xuong bo', 'xuong heo', 'xuong ga', 'xuong ham'],
    // Broth extraction yield only (bones are discarded)
    { caloriesKcal: 42, proteinG: 5.5, carbsG: 0, fatG: 2.2, fiberG: 0, sodiumMg: 48 },
    { piece: 150, pack: 500 },
  ),

  // ── 3. POULTRY (GÀ / VỊT / CHIM CÚT) ──────────────────────────────────────
  p(
    'CHICKEN_BREAST',
    'Ức gà phi lê',
    'protein_poultry',
    ['uc ga', 'luon ga', 'thit uc ga', 'ga phi le', 'chicken breast'],
    { caloriesKcal: 165, proteinG: 31.0, carbsG: 0, fatG: 3.6, fiberG: 0, sodiumMg: 65 },
    { piece: 200, slice: 50, pack: 400 },
  ),
  p(
    'CHICKEN_THIGH',
    'Đùi gà / Má đùi gà',
    'protein_poultry',
    ['dui ga', 'ma dui ga', 'thit dui ga', 'dui ga goc tu', 'chicken thigh', 'chicken leg'],
    { caloriesKcal: 209, proteinG: 24.0, carbsG: 0, fatG: 12.0, fiberG: 0, sodiumMg: 76 },
    { piece: 165, slice: 60, pack: 450 },
  ),
  p(
    'CHICKEN_WING',
    'Cánh gà',
    'protein_poultry',
    ['canh ga', 'canh ga giua', 'chicken wing', 'chicken wings'],
    { caloriesKcal: 222, proteinG: 19.8, carbsG: 0, fatG: 15.6, fiberG: 0, sodiumMg: 78 },
    { piece: 80, pack: 500 },
  ),
  p(
    'WHOLE_CHICKEN',
    'Thịt gà ta',
    'protein_poultry',
    ['ga ta', 'thit ga', 'ga nguyen con', 'ga doi', 'ga xe', 'whole chicken', 'chicken meat'],
    { caloriesKcal: 198, proteinG: 23.5, carbsG: 0, fatG: 11.2, fiberG: 0, sodiumMg: 72 },
    { piece: 250, slice: 60, pack: 600 },
  ),
  p(
    'DUCK_MEAT',
    'Thịt vịt',
    'protein_poultry',
    ['thit vit', 'vit xiem', 'uc vit', 'dui vit', 'duck', 'duck meat'],
    { caloriesKcal: 258, proteinG: 19.0, carbsG: 0, fatG: 20.2, fiberG: 0, sodiumMg: 74 },
    { piece: 220, slice: 65, pack: 500 },
  ),

  // ── 4. FISH & SEAFOOD (CÁ & HẢI SẢN) ──────────────────────────────────────
  p(
    'FISH_FRESHWATER',
    'Cá lóc đồng / Cá quả',
    'protein_seafood',
    ['ca loc', 'ca qua', 'ca bong', 'ca tuoi', 'phi le ca', 'freshwater fish', 'snakehead fish'],
    { caloriesKcal: 115, proteinG: 20.8, carbsG: 0, fatG: 3.2, fiberG: 0, sodiumMg: 60 },
    { piece: 180, slice: 150, pack: 400 },
  ),
  p(
    'RED_TILAPIA',
    'Cá điêu hồng / Cá rô phi',
    'protein_seafood',
    ['ca dieu hong', 'ca ro phi', 'ca ro', 'tilapia', 'red tilapia'],
    { caloriesKcal: 121, proteinG: 20.2, carbsG: 0, fatG: 4.0, fiberG: 0, sodiumMg: 58 },
    { piece: 220, slice: 150, pack: 450 },
  ),
  p(
    'CARP_FISH',
    'Cá trắm / Cá chép',
    'protein_seafood',
    ['ca tram', 'ca tram den', 'ca chep', 'ca me', 'carp', 'grass carp'],
    { caloriesKcal: 134, proteinG: 19.4, carbsG: 0, fatG: 5.8, fiberG: 0, sodiumMg: 64 },
    { piece: 200, slice: 160, pack: 450 },
  ),
  p(
    'CATFISH',
    'Cá basa / Cá hú / Cá trê / Cá bông lau',
    'protein_seafood',
    ['ca basa', 'ca hu', 'ca tre', 'ca bong lau', 'ca tra', 'ca lang', 'catfish', 'pangasius'],
    { caloriesKcal: 158, proteinG: 17.8, carbsG: 0, fatG: 9.4, fiberG: 0, sodiumMg: 65 },
    { piece: 180, slice: 160, pack: 400 },
  ),
  p(
    'MACKEREL',
    'Cá thu / Cá nục',
    'protein_seafood',
    ['ca thu', 'ca nuc', 'ca bac ma', 'ca doi', 'mackerel'],
    { caloriesKcal: 176, proteinG: 20.8, carbsG: 0, fatG: 9.8, fiberG: 0, sodiumMg: 90 },
    { piece: 170, slice: 160, pack: 350 },
  ),
  p(
    'TUNA',
    'Cá ngừ',
    'protein_seafood',
    ['ca ngu', 'ca ngu dai duong', 'tuna'],
    { caloriesKcal: 132, proteinG: 28.0, carbsG: 0, fatG: 1.3, fiberG: 0, sodiumMg: 48 },
    { piece: 160, slice: 150, pack: 250 },
  ),
  p(
    'ANCHOVY',
    'Cá cơm tươi / Cá cơm khô',
    'protein_seafood',
    ['ca com', 'ca com kho', 'anchovy', 'anchovies'],
    { caloriesKcal: 145, proteinG: 24.5, carbsG: 0, fatG: 4.8, fiberG: 0, sodiumMg: 360 },
    { bowl: 100, pack: 150 },
  ),
  p(
    'SALMON_FILLET',
    'Cá hồi phi lê',
    'protein_seafood',
    ['ca hoi', 'phi le ca hoi', 'salmon', 'salmon fillet'],
    { caloriesKcal: 208, proteinG: 20.4, carbsG: 0, fatG: 13.4, fiberG: 0, sodiumMg: 59 },
    { piece: 180, slice: 160, pack: 300 },
  ),
  p(
    'EEL',
    'Lươn đồng',
    'protein_seafood',
    ['luon', 'luon dong', 'thit luon', 'eel'],
    { caloriesKcal: 184, proteinG: 18.6, carbsG: 0, fatG: 11.5, fiberG: 0, sodiumMg: 65 },
    { piece: 150, pack: 300 },
  ),
  p(
    'SHRIMP',
    'Tôm tươi (Tôm sú / Tôm thẻ / Tôm đất)',
    'protein_seafood',
    ['tom tuoi', 'tom su', 'tom the', 'tom dat', 'tom non', 'tom lot', 'tom', 'tep tuoi', 'shrimp', 'prawn'],
    { caloriesKcal: 99, proteinG: 20.9, carbsG: 0.2, fatG: 1.4, fiberG: 0, sodiumMg: 148 },
    { piece: 22, pack: 300, bowl: 150 },
  ),
  p(
    'DRIED_SHRIMP',
    'Tôm khô / Tép khô',
    'protein_seafood',
    ['tom kho', 'tep kho', 'dried shrimp'],
    { caloriesKcal: 295, proteinG: 62.0, carbsG: 2.0, fatG: 3.5, fiberG: 0, sodiumMg: 1680 },
    { tbsp: 12, tsp: 4, bowl: 90, pack: 100 },
  ),
  p(
    'CRAB_MEAT',
    'Cua đồng / Thịt cua / Ghẹ',
    'protein_seafood',
    ['cua dong', 'rieu cua', 'thit cua', 'cua bien', 'ghe tuoi', 'cua', 'crab', 'crab meat'],
    { caloriesKcal: 97, proteinG: 18.2, carbsG: 0.5, fatG: 2.1, fiberG: 0, sodiumMg: 295 },
    { piece: 120, pack: 250, bowl: 150 },
  ),
  p(
    'CLAMS',
    'Ngao / Nghêu / Hến',
    'protein_seafood',
    ['ngao', 'ngheu', 'hen', 'thit hen', 'so diep', 'clams', 'mussels'],
    { caloriesKcal: 68, proteinG: 11.8, carbsG: 2.4, fatG: 1.1, fiberG: 0, sodiumMg: 185 },
    { piece: 18, pack: 500, bowl: 150 },
  ),
  p(
    'SNAILS',
    'Ốc bươu / Ốc nhồi',
    'protein_seafood',
    ['oc buou', 'oc nhoi', 'oc van', 'thit oc', 'snail', 'escargot'],
    { caloriesKcal: 86, proteinG: 15.6, carbsG: 2.0, fatG: 1.4, fiberG: 0, sodiumMg: 92 },
    { piece: 15, bowl: 150, pack: 300 },
  ),
  p(
    'OYSTER',
    'Hàu sữa',
    'protein_seafood',
    ['hau sua', 'ruot hau', 'hau', 'oyster', 'oysters'],
    { caloriesKcal: 81, proteinG: 9.5, carbsG: 4.9, fatG: 2.3, fiberG: 0, sodiumMg: 210 },
    { piece: 25, pack: 300 },
  ),
  p(
    'SQUID',
    'Mực tươi / Bạch tuộc',
    'protein_seafood',
    ['muc tuoi', 'muc ong', 'muc la', 'muc nang', 'muc', 'bach tuoc', 'squid', 'calamari', 'octopus'],
    { caloriesKcal: 92, proteinG: 16.2, carbsG: 3.0, fatG: 1.4, fiberG: 0, sodiumMg: 165 },
    { piece: 160, slice: 30, pack: 350 },
  ),
  p(
    'FISH_CAKE',
    'Chả cá / Chả mực',
    'protein_seafood',
    ['cha ca', 'cha ca thac lac', 'cha ca thu', 'cha muc', 'fish cake'],
    { caloriesKcal: 176, proteinG: 17.5, carbsG: 6.5, fatG: 8.8, fiberG: 0, sodiumMg: 680 },
    { piece: 50, slice: 35, pack: 300 },
  ),

  // ── 5. EGGS, TOFU & DAIRY (TRỨNG, ĐẬU PHỤ & SỮA) ─────────────────────────
  p(
    'CHICKEN_EGG',
    'Trứng gà',
    'protein_egg_dairy',
    ['trung ga', 'trung ga ta', 'trung', 'chicken egg', 'egg', 'eggs'],
    { caloriesKcal: 155, proteinG: 12.6, carbsG: 1.1, fatG: 10.6, fiberG: 0, sodiumMg: 124 },
    { piece: 55, pack: 550 },
  ),
  p(
    'DUCK_EGG',
    'Trứng vịt',
    'protein_egg_dairy',
    ['trung vit', 'trung vit kho', 'duck egg'],
    { caloriesKcal: 185, proteinG: 13.0, carbsG: 1.4, fatG: 13.8, fiberG: 0, sodiumMg: 146 },
    { piece: 68, pack: 680 },
  ),
  p(
    'QUAIL_EGG',
    'Trứng cút',
    'protein_egg_dairy',
    ['trung cut', 'quail egg', 'quail eggs'],
    { caloriesKcal: 158, proteinG: 13.1, carbsG: 0.4, fatG: 11.1, fiberG: 0, sodiumMg: 141 },
    { piece: 11, pack: 220 },
  ),
  p(
    'SALTED_EGG',
    'Trứng muối',
    'protein_egg_dairy',
    ['trung muoi', 'long do trung muoi', 'salted egg'],
    { caloriesKcal: 195, proteinG: 13.5, carbsG: 1.5, fatG: 14.8, fiberG: 0, sodiumMg: 1480 },
    { piece: 60 },
  ),
  p(
    'TOFU',
    'Đậu phụ trắng / Đậu hũ',
    'protein_plant',
    ['dau phu', 'dau hu', 'tau hu', 'dau phu trang', 'dau phu mo', 'tofu', 'firm tofu'],
    { caloriesKcal: 98, proteinG: 10.5, carbsG: 2.2, fatG: 5.4, fiberG: 1.2, sodiumMg: 14 },
    { piece: 150, slice: 50, pack: 300 },
    'low',
  ),
  p(
    'FRIED_TOFU',
    'Đậu phụ chiên vàng',
    'protein_plant',
    ['dau phu chien', 'dau hu chien', 'dau chien', 'fried tofu', 'tofu puffs'],
    { caloriesKcal: 192, proteinG: 13.8, carbsG: 3.5, fatG: 13.8, fiberG: 1.5, sodiumMg: 22 },
    { piece: 120, slice: 35, pack: 250 },
    'low',
  ),
  p(
    'SILKEN_TOFU',
    'Đậu hũ non / Tàu hũ non',
    'protein_plant',
    ['dau hu non', 'tau hu non', 'dau phu non', 'silken tofu', 'soft tofu'],
    { caloriesKcal: 62, proteinG: 5.8, carbsG: 2.0, fatG: 3.2, fiberG: 0.5, sodiumMg: 10 },
    { piece: 250, pack: 300 },
    'low',
  ),
  p(
    'TOFU_SKIN',
    'Tàu hũ ky / Phù trúc / Váng đậu',
    'protein_plant',
    ['tau hu ky', 'phu truc', 'vang dau', 'tofu skin', 'beancurd skin'],
    { caloriesKcal: 385, proteinG: 42.0, carbsG: 12.0, fatG: 19.5, fiberG: 2.5, sodiumMg: 45 },
    { sheet: 25, piece: 30, pack: 150 },
    'low',
  ),
  p(
    'FRESH_MILK',
    'Sữa tươi',
    'protein_egg_dairy',
    ['sua tuoi', 'sua khong duong', 'sua tuoi thanh trung', 'sua', 'fresh milk', 'milk'],
    { caloriesKcal: 61, proteinG: 3.2, carbsG: 4.8, fatG: 3.3, fiberG: 0, sodiumMg: 44 },
    { pack: 220, cup: 240, bowl: 250, tbsp: 15, densityGPerMl: 1.03 },
    'low',
  ),
  p(
    'CONDENSED_MILK',
    'Sữa đặc',
    'protein_egg_dairy',
    ['sua dac', 'sua ong tho', 'condensed milk'],
    { caloriesKcal: 321, proteinG: 7.9, carbsG: 54.4, fatG: 8.7, fiberG: 0, sodiumMg: 127 },
    { tbsp: 20, tsp: 7, pack: 380, densityGPerMl: 1.3 },
    'high',
  ),
  p(
    'CHEDDAR_CHEESE',
    'Phô mai',
    'protein_egg_dairy',
    ['pho mai', 'pho mat', 'phomai', 'cheese', 'cheddar', 'mozzarella', 'parmesan'],
    { caloriesKcal: 380, proteinG: 24.5, carbsG: 2.1, fatG: 31.0, fiberG: 0, sodiumMg: 640 },
    { slice: 20, piece: 18, tbsp: 12, pack: 200 },
  ),
  p(
    'BUTTER',
    'Bơ lạt / Bơ động vật',
    'cooking_fat',
    ['bo lat', 'bo dong vat', 'bo thuc vat', 'bo phe', 'butter', 'unsalted butter'],
    { caloriesKcal: 717, proteinG: 0.9, carbsG: 0.1, fatG: 81.1, fiberG: 0, sodiumMg: 20 },
    { tbsp: 14, tsp: 5, slice: 10, pack: 200, densityGPerMl: 0.91 },
  ),

  // ── 6. RICE, NOODLES & STARCHES (GẠO, CƠM, BÚN, PHỞ, MÌ) ─────────────────
  p(
    'COOKED_RICE',
    'Cơm trắng / Cơm nguội',
    'grain_starch',
    ['com trang', 'com nong', 'com nguoi', 'com', 'cooked rice', 'steamed rice'],
    { caloriesKcal: 130, proteinG: 2.7, carbsG: 28.2, fatG: 0.3, fiberG: 0.4, sodiumMg: 2 },
    { bowl: 160, cup: 180, piece: 160 },
    'high',
  ),
  p(
    'BROKEN_RICE',
    'Gạo tấm / Cơm tấm',
    'grain_starch',
    ['com tam', 'gao tam', 'broken rice'],
    { caloriesKcal: 134, proteinG: 2.8, carbsG: 29.0, fatG: 0.4, fiberG: 0.5, sodiumMg: 3 },
    { bowl: 170, cup: 185, pack: 500 },
    'high',
  ),
  p(
    'RICE',
    'Gạo tẻ / Gạo thơm',
    'grain_starch',
    ['gao', 'gao te', 'gao thom', 'gao st25', 'gao tam xoan', 'jasmine rice', 'white rice'],
    { caloriesKcal: 360, proteinG: 6.8, carbsG: 79.2, fatG: 0.7, fiberG: 1.3, sodiumMg: 4 },
    { bowl: 180, cup: 200, tbsp: 14, pack: 1000 },
    'high',
  ),
  p(
    'BROWN_RICE',
    'Gạo lứt / Cơm gạo lứt',
    'grain_starch',
    ['gao lut', 'com gao lut', 'brown rice'],
    { caloriesKcal: 362, proteinG: 7.5, carbsG: 76.2, fatG: 2.7, fiberG: 3.5, sodiumMg: 5 },
    { bowl: 180, cup: 195 },
    'medium',
  ),
  p(
    'STICKY_RICE',
    'Gạo nếp / Xôi',
    'grain_starch',
    ['gao nep', 'nep cai hoa vang', 'xoi', 'sticky rice', 'glutinous rice'],
    { caloriesKcal: 368, proteinG: 6.8, carbsG: 81.0, fatG: 0.8, fiberG: 1.1, sodiumMg: 6 },
    { bowl: 180, cup: 200 },
    'high',
  ),
  p(
    'PHO_NOODLE',
    'Bánh phở tươi',
    'grain_starch',
    ['banh pho', 'pho tuoi', 'soi pho', 'pho kho', 'pho noodle', 'rice noodle flat'],
    { caloriesKcal: 142, proteinG: 2.6, carbsG: 31.5, fatG: 0.4, fiberG: 0.6, sodiumMg: 18 },
    { bowl: 180, pack: 400, piece: 150 },
    'medium',
  ),
  p(
    'BUN_NOODLE',
    'Bún tươi / Bún sợi / Hủ tiếu',
    'grain_starch',
    ['bun tuoi', 'bun roi', 'bun bo', 'bun', 'hu tieu', 'banh canh', 'mi quang', 'noodle', 'rice vermicelli'],
    { caloriesKcal: 112, proteinG: 2.1, carbsG: 25.4, fatG: 0.2, fiberG: 0.5, sodiumMg: 14 },
    { bowl: 170, pack: 450, piece: 150 },
    'medium',
  ),
  p(
    'GLASS_NOODLE',
    'Miến dong / Bún tàu',
    'grain_starch',
    ['mien dong', 'mien', 'bun tau', 'glass noodle', 'mung bean vermicelli', 'cellophane noodle'],
    { caloriesKcal: 332, proteinG: 0.6, carbsG: 82.0, fatG: 0.1, fiberG: 1.0, sodiumMg: 12 },
    { pack: 100, bunch: 50, bowl: 65 },
    'low',
  ),
  p(
    'SPAGHETTI_PASTA',
    'Mì Ý / Pasta / Mì trứng',
    'grain_starch',
    ['mi y', 'spaghetti', 'pasta', 'mi trung', 'mi soi', 'udon', 'ramen'],
    { caloriesKcal: 356, proteinG: 12.5, carbsG: 71.8, fatG: 1.8, fiberG: 3.2, sodiumMg: 16 },
    { pack: 250, bowl: 100, bunch: 90 },
    'medium',
  ),
  p(
    'INSTANT_NOODLE',
    'Mì gói',
    'grain_starch',
    ['mi goi', 'mi an lien', 'instant noodle'],
    { caloriesKcal: 445, proteinG: 9.2, carbsG: 61.0, fatG: 18.2, fiberG: 2.1, sodiumMg: 1420 },
    { pack: 75, piece: 75 },
    'high',
  ),
  p(
    'RICE_PAPER',
    'Bánh tráng cuốn / Bánh đa nem',
    'grain_starch',
    ['banh trang', 'banh da nem', 'vo ram', 'la nem', 'rice paper'],
    { caloriesKcal: 335, proteinG: 5.5, carbsG: 78.0, fatG: 0.4, fiberG: 0.8, sodiumMg: 240 },
    { sheet: 10, piece: 10, pack: 150 },
    'high',
  ),
  p(
    'BANH_MI',
    'Bánh mì Việt Nam',
    'grain_starch',
    ['banh mi', 'banh mi gion', 'bread', 'baguette'],
    { caloriesKcal: 274, proteinG: 8.8, carbsG: 54.0, fatG: 2.4, fiberG: 2.5, sodiumMg: 480 },
    { piece: 95, slice: 28 },
    'high',
  ),
  p(
    'STARCH_FLOUR',
    'Bột năng / Bột bắp / Bột mì / Bột chiên giòn',
    'grain_starch',
    ['bot nang', 'bot bap', 'bot ngo', 'bot san', 'bot mi', 'bot gao', 'bot chien gion', 'cornstarch', 'tapioca starch', 'wheat flour'],
    { caloriesKcal: 364, proteinG: 4.5, carbsG: 85.0, fatG: 0.5, fiberG: 1.2, sodiumMg: 8 },
    { tbsp: 9, tsp: 3, cup: 125, pack: 150 },
    'high',
  ),

  // ── 7. LEAFY GREENS & CRUCIFEROUS (RAU LÁ XANH & HỌ CẢI) ─────────────────
  p(
    'WATER_SPINACH',
    'Rau muống',
    'vegetable_leafy',
    ['rau muong', 'muong nuoc', 'rau muong dong', 'water spinach', 'morning glory'],
    { caloriesKcal: 23, proteinG: 2.9, carbsG: 3.1, fatG: 0.3, fiberG: 2.4, sodiumMg: 78 },
    { bunch: 280, pack: 250, bowl: 90 },
    'low',
  ),
  p(
    'SPINACH',
    'Cải bó xôi / Rau chân vịt',
    'vegetable_leafy',
    ['cai bo xoi', 'rau chan vit', 'rau bina', 'spinach'],
    { caloriesKcal: 23, proteinG: 2.9, carbsG: 3.6, fatG: 0.4, fiberG: 2.2, sodiumMg: 79 },
    { bunch: 250, pack: 250, bowl: 80 },
    'low',
  ),
  p(
    'BOK_CHOY',
    'Cải ngọt / Cải thìa / Cải chíp',
    'vegetable_leafy',
    ['cai ngot', 'cai thia', 'cai chip', 'rau cai', 'bok choy', 'choy sum'],
    { caloriesKcal: 16, proteinG: 1.8, carbsG: 2.5, fatG: 0.2, fiberG: 1.7, sodiumMg: 45 },
    { bunch: 280, pack: 250, piece: 90 },
    'low',
  ),
  p(
    'MUSTARD_GREENS',
    'Cải bẹ xanh / Cải canh',
    'vegetable_leafy',
    ['cai be xanh', 'cai canh', 'cai xanh', 'mustard greens'],
    { caloriesKcal: 26, proteinG: 2.7, carbsG: 4.5, fatG: 0.4, fiberG: 3.2, sodiumMg: 25 },
    { bunch: 280, pack: 250 },
    'low',
  ),
  p(
    'PICKLED_MUSTARD',
    'Dưa cải chua / Cà pháo muối',
    'vegetable_leafy',
    ['dua chua', 'dua cai chua', 'cai chua', 'ca phao', 'ca muoi', 'pickled mustard'],
    { caloriesKcal: 22, proteinG: 1.4, carbsG: 4.1, fatG: 0.2, fiberG: 2.1, sodiumMg: 720 },
    { bowl: 120, pack: 250, piece: 25 },
    'low',
  ),
  p(
    'KIMCHI',
    'Kim chi Hàn Quốc',
    'vegetable_leafy',
    ['kim chi', 'kimchi'],
    { caloriesKcal: 24, proteinG: 1.6, carbsG: 4.4, fatG: 0.5, fiberG: 1.9, sodiumMg: 670 },
    { bowl: 110, pack: 300, tbsp: 18 },
    'low',
  ),
  p(
    'CABBAGE',
    'Bắp cải trắng / Bắp cải tím',
    'vegetable_leafy',
    ['bap cai', 'cai bap', 'bap cai tim', 'cabbage'],
    { caloriesKcal: 25, proteinG: 1.3, carbsG: 5.8, fatG: 0.1, fiberG: 2.5, sodiumMg: 18 },
    { piece: 400, bunch: 350, bowl: 90 },
    'low',
  ),
  p(
    'NAPA_CABBAGE',
    'Cải thảo',
    'vegetable_leafy',
    ['cai thao', 'napa cabbage', 'chinese cabbage'],
    { caloriesKcal: 16, proteinG: 1.2, carbsG: 3.2, fatG: 0.2, fiberG: 1.2, sodiumMg: 9 },
    { piece: 450, bunch: 350, bowl: 90 },
    'low',
  ),
  p(
    'JUTE_MALLOW',
    'Rau đay',
    'vegetable_leafy',
    ['rau day', 'jute mallow'],
    { caloriesKcal: 32, proteinG: 3.8, carbsG: 5.2, fatG: 0.3, fiberG: 3.1, sodiumMg: 24 },
    { bunch: 250, bowl: 85 },
    'low',
  ),
  p(
    'MALABAR_SPINACH',
    'Rau mồng tơi',
    'vegetable_leafy',
    ['mong toi', 'rau mong toi', 'malabar spinach'],
    { caloriesKcal: 19, proteinG: 1.8, carbsG: 3.4, fatG: 0.3, fiberG: 2.1, sodiumMg: 24 },
    { bunch: 250, bowl: 85 },
    'low',
  ),
  p(
    'SWEET_LEAF',
    'Rau ngót / Bồ ngót',
    'vegetable_leafy',
    ['rau ngot', 'bo ngot', 'sweet leaf', 'katuk'],
    { caloriesKcal: 36, proteinG: 5.3, carbsG: 3.4, fatG: 0.4, fiberG: 2.5, sodiumMg: 25 },
    { bunch: 220, bowl: 80 },
    'low',
  ),
  p(
    'AMARANTH_WATERCRESS',
    'Rau dền / Cải xoong',
    'vegetable_leafy',
    ['rau den', 'den do', 'cai xoong', 'amaranth', 'watercress'],
    { caloriesKcal: 23, proteinG: 2.5, carbsG: 4.0, fatG: 0.3, fiberG: 2.2, sodiumMg: 28 },
    { bunch: 250, bowl: 85 },
    'low',
  ),
  p(
    'LETTUCE_SALAD',
    'Xà lách / Rau sống ăn kèm',
    'vegetable_leafy',
    ['xa lach', 'rau song', 'rau diep', 'lettuce', 'romaine'],
    { caloriesKcal: 15, proteinG: 1.3, carbsG: 2.9, fatG: 0.2, fiberG: 1.4, sodiumMg: 22 },
    { bunch: 200, piece: 180, pack: 200 },
    'low',
  ),
  p(
    'BROCCOLI',
    'Bông cải xanh / Súp lơ xanh',
    'vegetable_leafy',
    ['bong cai xanh', 'sup lo xanh', 'sup lo', 'broccoli'],
    { caloriesKcal: 34, proteinG: 2.8, carbsG: 6.6, fatG: 0.4, fiberG: 2.6, sodiumMg: 33 },
    { piece: 280, pack: 300, bowl: 100 },
    'low',
  ),
  p(
    'CAULIFLOWER',
    'Bông cải trắng / Súp lơ trắng',
    'vegetable_leafy',
    ['sup lo trang', 'bong cai trang', 'cauliflower'],
    { caloriesKcal: 25, proteinG: 1.9, carbsG: 5.0, fatG: 0.3, fiberG: 2.0, sodiumMg: 30 },
    { piece: 300, pack: 300, bowl: 100 },
    'low',
  ),
  p(
    'CELERY_WATER_DROPWORT',
    'Cần tây / Rau cần nước',
    'vegetable_leafy',
    ['can tay', 'rau can', 'can nuoc', 'celery'],
    { caloriesKcal: 16, proteinG: 0.8, carbsG: 3.2, fatG: 0.2, fiberG: 1.6, sodiumMg: 80 },
    { bunch: 220, stalk: 35, piece: 40 },
    'low',
  ),
  p(
    'BEAN_SPROUTS',
    'Giá đỗ',
    'vegetable_leafy',
    ['gia do', 'gia song', 'bean sprouts'],
    { caloriesKcal: 30, proteinG: 3.0, carbsG: 5.9, fatG: 0.2, fiberG: 1.8, sodiumMg: 6 },
    { pack: 200, bunch: 150, bowl: 80 },
    'low',
  ),
  p(
    'GREEN_BEANS',
    'Đậu cô ve / Đậu đũa / Đậu Hà Lan',
    'vegetable_leafy',
    ['dau co ve', 'dau cove', 'dau dua', 'dau ha lan', 'green beans', 'string beans', 'snow peas'],
    { caloriesKcal: 31, proteinG: 1.9, carbsG: 7.0, fatG: 0.2, fiberG: 3.1, sodiumMg: 6 },
    { piece: 15, bunch: 220, pack: 250 },
    'low',
  ),
  p(
    'OKRA_TARO_STEM',
    'Đậu bắp / Bạc hà (Dọc mùng) / Hoa chuối',
    'vegetable_leafy',
    ['dau bap', 'bac ha', 'doc mung', 'hoa chuoi', 'bap chuoi', 'okra', 'taro stem', 'banana blossom'],
    { caloriesKcal: 28, proteinG: 1.7, carbsG: 6.2, fatG: 0.2, fiberG: 3.2, sodiumMg: 9 },
    { piece: 18, stalk: 60, bunch: 220, pack: 250 },
    'low',
  ),

  // ── 8. GOURDS, ROOTS, TUBERS & FRUITING VEG (CỦ QUẢ) ─────────────────────
  p(
    'BITTER_MELON',
    'Khổ qua / Mướp đắng',
    'vegetable_gourd_root',
    ['kho qua', 'muop dang', 'bitter melon', 'bitter gourd'],
    { caloriesKcal: 19, proteinG: 1.0, carbsG: 4.3, fatG: 0.2, fiberG: 2.8, sodiumMg: 6 },
    { piece: 160, fruit: 160, slice: 15 },
    'low',
  ),
  p(
    'WINTER_MELON',
    'Bí đao / Bí xanh',
    'vegetable_gourd_root',
    ['bi dao', 'bi xanh', 'winter melon'],
    { caloriesKcal: 13, proteinG: 0.4, carbsG: 3.0, fatG: 0.2, fiberG: 1.5, sodiumMg: 4 },
    { piece: 350, fruit: 350, slice: 35 },
    'low',
  ),
  p(
    'LUFFA_BOTTLE_GOURD',
    'Mướp hương / Quả bầu',
    'vegetable_gourd_root',
    ['muop huong', 'muop', 'qua bau', 'bau sao', 'luffa', 'sponge gourd', 'bottle gourd'],
    { caloriesKcal: 17, proteinG: 0.8, carbsG: 3.9, fatG: 0.2, fiberG: 1.4, sodiumMg: 3 },
    { piece: 300, fruit: 300, slice: 30 },
    'low',
  ),
  p(
    'CHAYOTE',
    'Su su',
    'vegetable_gourd_root',
    ['su su', 'qua su su', 'ngon su su', 'chayote'],
    { caloriesKcal: 19, proteinG: 0.8, carbsG: 4.5, fatG: 0.1, fiberG: 1.7, sodiumMg: 2 },
    { piece: 210, fruit: 210 },
    'low',
  ),
  p(
    'KOHLRABI',
    'Su hào',
    'vegetable_gourd_root',
    ['su hao', 'cu su hao', 'kohlrabi'],
    { caloriesKcal: 27, proteinG: 1.7, carbsG: 6.2, fatG: 0.1, fiberG: 3.6, sodiumMg: 20 },
    { piece: 220, bulb: 220 },
    'low',
  ),
  p(
    'PUMPKIN',
    'Bí đỏ / Bí ngô',
    'vegetable_gourd_root',
    ['bi do', 'bi ngo', 'pumpkin', 'butternut squash'],
    { caloriesKcal: 36, proteinG: 1.1, carbsG: 8.6, fatG: 0.2, fiberG: 1.8, sodiumMg: 3 },
    { piece: 350, slice: 80, pack: 400 },
    'medium',
  ),
  p(
    'TOMATO',
    'Cà chua',
    'vegetable_gourd_root',
    ['ca chua', 'ca chua bi', 'tomato', 'cherry tomato'],
    { caloriesKcal: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2, fiberG: 1.2, sodiumMg: 5 },
    { piece: 110, fruit: 110, slice: 20 },
    'low',
  ),
  p(
    'CUCUMBER',
    'Dưa leo / Dưa chuột',
    'vegetable_gourd_root',
    ['dua leo', 'dua chuot', 'cucumber'],
    { caloriesKcal: 15, proteinG: 0.7, carbsG: 3.6, fatG: 0.1, fiberG: 0.7, sodiumMg: 2 },
    { piece: 150, slice: 12 },
    'low',
  ),
  p(
    'EGGPLANT',
    'Cà tím',
    'vegetable_gourd_root',
    ['ca tim', 'eggplant', 'aubergine'],
    { caloriesKcal: 25, proteinG: 1.0, carbsG: 5.9, fatG: 0.2, fiberG: 3.0, sodiumMg: 2 },
    { piece: 180, slice: 25 },
    'low',
  ),
  p(
    'BELL_PEPPER',
    'Ớt chuông',
    'vegetable_gourd_root',
    ['ot chuong', 'ot ngot', 'bell pepper', 'capsicum'],
    { caloriesKcal: 28, proteinG: 1.0, carbsG: 6.1, fatG: 0.3, fiberG: 2.1, sodiumMg: 4 },
    { piece: 140, slice: 20 },
    'low',
  ),
  p(
    'CARROT',
    'Cà rốt',
    'vegetable_gourd_root',
    ['ca rot', 'cu ca rot', 'carrot'],
    { caloriesKcal: 41, proteinG: 0.9, carbsG: 9.6, fatG: 0.2, fiberG: 2.8, sodiumMg: 69 },
    { piece: 120, bulb: 120, slice: 10 },
    'low',
  ),
  p(
    'WHITE_RADISH',
    'Củ cải trắng / Củ đậu',
    'vegetable_gourd_root',
    ['cu cai trang', 'cu cai', 'cu dau', 'cu san', 'daikon', 'white radish', 'jicama'],
    { caloriesKcal: 18, proteinG: 0.6, carbsG: 4.1, fatG: 0.1, fiberG: 1.6, sodiumMg: 21 },
    { piece: 220, bulb: 220 },
    'low',
  ),
  p(
    'POTATO',
    'Khoai tây',
    'vegetable_gourd_root',
    ['khoai tay', 'potato'],
    { caloriesKcal: 77, proteinG: 2.0, carbsG: 17.5, fatG: 0.1, fiberG: 2.2, sodiumMg: 6 },
    { piece: 150, bulb: 150 },
    'high',
  ),
  p(
    'SWEET_POTATO',
    'Khoai lang',
    'vegetable_gourd_root',
    ['khoai lang', 'sweet potato'],
    { caloriesKcal: 86, proteinG: 1.6, carbsG: 20.1, fatG: 0.1, fiberG: 3.0, sodiumMg: 55 },
    { piece: 160, bulb: 160 },
    'medium',
  ),
  p(
    'TARO',
    'Khoai môn / Khoai sọ / Khoai mỡ',
    'vegetable_gourd_root',
    ['khoai mon', 'khoai so', 'khoai mo', 'taro'],
    { caloriesKcal: 112, proteinG: 1.5, carbsG: 26.5, fatG: 0.2, fiberG: 4.1, sodiumMg: 11 },
    { piece: 180, bulb: 180 },
    'medium',
  ),
  p(
    'LOTUS_ROOT',
    'Củ sen / Ngó sen / Hạt sen',
    'vegetable_gourd_root',
    ['cu sen', 'ngo sen', 'hat sen', 'lotus root', 'lotus seed'],
    { caloriesKcal: 74, proteinG: 2.6, carbsG: 17.2, fatG: 0.1, fiberG: 4.9, sodiumMg: 40 },
    { piece: 200, bulb: 220, bowl: 110, pack: 200 },
    'low',
  ),
  p(
    'CORN',
    'Bắp ngọt / Ngô ngọt',
    'vegetable_gourd_root',
    ['bap ngot', 'ngo ngot', 'trai bap', 'sweet corn', 'corn'],
    { caloriesKcal: 86, proteinG: 3.3, carbsG: 19.0, fatG: 1.2, fiberG: 2.4, sodiumMg: 15 },
    { piece: 160, bowl: 130, pack: 250 },
    'medium',
  ),
  p(
    'BAMBOO_SHOOTS',
    'Măng tươi / Măng chua',
    'vegetable_gourd_root',
    ['mang tuoi', 'mang chua', 'mang tre', 'mang kho', 'bamboo shoots'],
    { caloriesKcal: 27, proteinG: 2.6, carbsG: 5.2, fatG: 0.3, fiberG: 2.2, sodiumMg: 120 },
    { bowl: 130, pack: 250, piece: 150 },
    'low',
  ),

  // ── 9. MUSHROOMS (CÁC LOẠI NẤM) ───────────────────────────────────────────
  p(
    'MUSHROOM',
    'Nấm đùi gà / Nấm rơm / Nấm bào ngư',
    'mushroom',
    ['nam', 'nam dui ga', 'nam rom', 'nam bao ngu', 'nam mo', 'nam tuoi', 'mushroom', 'king oyster mushroom', 'straw mushroom'],
    { caloriesKcal: 28, proteinG: 3.1, carbsG: 4.6, fatG: 0.4, fiberG: 2.1, sodiumMg: 7 },
    { pack: 200, piece: 25, bowl: 90 },
    'low',
  ),
  p(
    'ENOKI_MUSHROOM',
    'Nấm kim châm',
    'mushroom',
    ['nam kim cham', 'enoki', 'enoki mushroom'],
    { caloriesKcal: 37, proteinG: 2.7, carbsG: 7.8, fatG: 0.3, fiberG: 2.7, sodiumMg: 3 },
    { pack: 150, bunch: 150 },
    'low',
  ),
  p(
    'SHIITAKE_MUSHROOM',
    'Nấm hương / Nấm đông cô',
    'mushroom',
    ['nam huong', 'nam dong co', 'shiitake', 'shiitake mushroom'],
    { caloriesKcal: 54, proteinG: 3.6, carbsG: 11.8, fatG: 0.4, fiberG: 3.8, sodiumMg: 13 },
    { piece: 8, pack: 100, bowl: 70 },
    'low',
  ),
  p(
    'WOOD_EAR_MUSHROOM',
    'Mộc nhĩ / Nấm mèo',
    'mushroom',
    ['moc nhi', 'nam meo', 'wood ear mushroom', 'black fungus'],
    { caloriesKcal: 48, proteinG: 2.9, carbsG: 10.6, fatG: 0.2, fiberG: 5.5, sodiumMg: 16 },
    { piece: 6, pack: 80, bowl: 60 },
    'low',
  ),

  // ── 10. HERBS & AROMATICS (RAU THƠM & GIA VỊ TƯƠI) ────────────────────────
  p(
    'ONION',
    'Hành tây',
    'herb_aromatic',
    ['hanh tay', 'cu hanh tay', 'onion'],
    { caloriesKcal: 40, proteinG: 1.1, carbsG: 9.3, fatG: 0.1, fiberG: 1.7, sodiumMg: 4 },
    { piece: 140, bulb: 140, slice: 15 },
    'low',
  ),
  p(
    'GARLIC',
    'Tỏi tươi',
    'herb_aromatic',
    ['toi', 'tep toi', 'cu toi', 'toi bam', 'toi ta', 'garlic'],
    { caloriesKcal: 149, proteinG: 6.4, carbsG: 33.1, fatG: 0.5, fiberG: 2.1, sodiumMg: 17 },
    { piece: 5, clove: 5, bulb: 30, tbsp: 10, tsp: 4 },
    'low',
  ),
  p(
    'SHALLOT',
    'Hành tím / Hành khô',
    'herb_aromatic',
    ['hanh tim', 'hanh kho', 'cu hanh tim', 'hanh phi', 'cu nen', 'shallot'],
    { caloriesKcal: 72, proteinG: 2.5, carbsG: 16.8, fatG: 0.1, fiberG: 3.2, sodiumMg: 12 },
    { piece: 10, bulb: 12, clove: 8, tbsp: 12, tsp: 4 },
    'low',
  ),
  p(
    'GINGER',
    'Gừng tươi',
    'herb_aromatic',
    ['gung', 'cu gung', 'gung tuoi', 'ginger'],
    { caloriesKcal: 80, proteinG: 1.8, carbsG: 17.8, fatG: 0.8, fiberG: 2.0, sodiumMg: 13 },
    { piece: 18, bulb: 30, slice: 4, tbsp: 10, tsp: 4 },
    'low',
  ),
  p(
    'GALANGAL',
    'Riềng tươi / Củ riềng',
    'herb_aromatic',
    ['rieng', 'cu rieng', 'rieng xay', 'galangal'],
    { caloriesKcal: 71, proteinG: 1.2, carbsG: 15.5, fatG: 0.6, fiberG: 2.3, sodiumMg: 11 },
    { piece: 30, bulb: 45, slice: 5, tbsp: 12 },
    'low',
  ),
  p(
    'TURMERIC',
    'Nghệ tươi / Bột nghệ',
    'herb_aromatic',
    ['nghe', 'nghe tuoi', 'cu nghe', 'bot nghe', 'turmeric'],
    { caloriesKcal: 96, proteinG: 2.4, carbsG: 20.1, fatG: 1.0, fiberG: 2.8, sodiumMg: 14 },
    { piece: 15, bulb: 20, tsp: 3, tbsp: 9 },
    'low',
  ),
  p(
    'LEMONGRASS',
    'Sả tươi',
    'herb_aromatic',
    ['sa', 'sa tuoi', 'cay sa', 'cu sa', 'sa bam', 'lemongrass'],
    { caloriesKcal: 99, proteinG: 1.8, carbsG: 25.3, fatG: 0.5, fiberG: 2.4, sodiumMg: 6 },
    { piece: 15, stalk: 15, tbsp: 10, bunch: 80 },
    'low',
  ),
  p(
    'CHILI',
    'Ớt tươi',
    'herb_aromatic',
    ['ot', 'ot hiem', 'ot sung', 'ot chi thien', 'ot do', 'chili'],
    { caloriesKcal: 40, proteinG: 1.9, carbsG: 8.8, fatG: 0.4, fiberG: 1.5, sodiumMg: 9 },
    { piece: 5, fruit: 5, slice: 2, tsp: 4 },
    'low',
  ),
  p(
    'SCALLION',
    'Hành lá / Hành hoa',
    'herb_aromatic',
    ['hanh la', 'hanh hoa', 'scallion', 'green onion', 'spring onion'],
    { caloriesKcal: 32, proteinG: 1.8, carbsG: 7.3, fatG: 0.2, fiberG: 2.6, sodiumMg: 16 },
    { bunch: 45, stalk: 10, piece: 10, tbsp: 6 },
    'low',
  ),
  p(
    'CORIANDER_DILL',
    'Ngò rí (Rau mùi) & Thì là',
    'herb_aromatic',
    ['ngo ri', 'rau mui', 'thi la', 'ngo gai', 'rau ngo', 'rau om', 'coriander', 'cilantro', 'dill', 'culantro'],
    { caloriesKcal: 26, proteinG: 2.3, carbsG: 4.4, fatG: 0.5, fiberG: 2.8, sodiumMg: 38 },
    { bunch: 40, stalk: 6, sprig: 5, tbsp: 4 },
    'low',
  ),
  p(
    'VIETNAMESE_HERBS',
    'Tía tô / Kinh giới / Rau răm / Húng quế / Lá lốt / Lá chanh',
    'herb_aromatic',
    ['tia to', 'kinh gioi', 'rau ram', 'hung que', 'hung lui', 'la chanh', 'la lot', 'rau thom', 'la giang', 'perilla', 'thai basil', 'lime leaf', 'betel leaf'],
    { caloriesKcal: 35, proteinG: 2.8, carbsG: 6.4, fatG: 0.6, fiberG: 3.2, sodiumMg: 22 },
    { bunch: 45, sprig: 5, piece: 3, sheet: 3, tbsp: 5 },
    'low',
  ),

  // ── 11. FRUITS, SOURING AGENTS & COCONUT (TRÁI CÂY, VỊ CHUA & DỪA) ───────
  p(
    'PINEAPPLE',
    'Dứa / Thơm / Khóm',
    'fruit_sour',
    ['dua', 'thom', 'khom', 'qua dua', 'pineapple'],
    { caloriesKcal: 50, proteinG: 0.5, carbsG: 13.1, fatG: 0.1, fiberG: 1.4, sodiumMg: 1 },
    { piece: 220, slice: 55, fruit: 450 },
    'medium',
  ),
  p(
    'TAMARIND',
    'Me chua / Cơm mẻ / Quả sấu / Khế chua',
    'fruit_sour',
    ['me chua', 'cot me', 'me', 'com me', 'me chua nau canh', 'qua sau', 'khe chua', 'xoai xanh', 'tamarind'],
    { caloriesKcal: 115, proteinG: 1.8, carbsG: 28.0, fatG: 0.3, fiberG: 2.6, sodiumMg: 28 },
    { tbsp: 16, tsp: 5, piece: 20, pack: 100 },
    'low',
  ),
  p(
    'LIME',
    'Chanh tươi / Tắc (Quất)',
    'fruit_sour',
    ['chanh', 'chanh tuoi', 'nuoc cot chanh', 'tac', 'quat', 'lime', 'lemon'],
    { caloriesKcal: 29, proteinG: 0.7, carbsG: 9.5, fatG: 0.2, fiberG: 0.8, sodiumMg: 2 },
    { piece: 20, fruit: 20, tbsp: 15, tsp: 5 },
    'low',
  ),
  p(
    'COCONUT_WATER',
    'Nước dừa tươi',
    'liquid_base',
    ['nuoc dua', 'nuoc dua tuoi', 'nuoc dua xiem', 'coconut water'],
    { caloriesKcal: 19, proteinG: 0.7, carbsG: 3.7, fatG: 0.2, fiberG: 0.2, sodiumMg: 45 },
    { bowl: 250, cup: 240, piece: 300, densityGPerMl: 1.01 },
    'low',
  ),
  p(
    'COCONUT_MILK',
    'Nước cốt dừa',
    'cooking_fat',
    ['nuoc cot dua', 'cot dua', 'kem dua', 'coconut milk', 'coconut cream'],
    { caloriesKcal: 197, proteinG: 2.0, carbsG: 5.5, fatG: 20.5, fiberG: 0.8, sodiumMg: 15 },
    { pack: 400, cup: 240, bowl: 240, tbsp: 15, densityGPerMl: 1.02 },
    'low',
  ),
  p(
    'AVOCADO',
    'Quả bơ sáp',
    'fruit_sour',
    ['qua bo', 'trai bo', 'bo sap', 'avocado'],
    { caloriesKcal: 160, proteinG: 2.0, carbsG: 8.5, fatG: 14.7, fiberG: 6.7, sodiumMg: 7 },
    { piece: 170, fruit: 170 },
    'low',
  ),

  // ── 12. SAUCES, OILS, NUTS & SEASONINGS (NƯỚC MẮM, DẦU, GIA VỊ) ──────────
  p(
    'FISH_SAUCE',
    'Nước mắm truyền thống',
    'sauce_seasoning',
    ['nuoc mam', 'mam phu quoc', 'mam nhi', 'mam ca com', 'mam', 'fish sauce'],
    { caloriesKcal: 38, proteinG: 5.8, carbsG: 3.4, fatG: 0, fiberG: 0, sodiumMg: 7600 },
    { tbsp: 17, tsp: 6, bowl: 280, densityGPerMl: 1.15 },
  ),
  p(
    'SOY_SAUCE',
    'Nước tương / Xì dầu',
    'sauce_seasoning',
    ['nuoc tuong', 'xi dau', 'tuong dau nanh', 'soy sauce', 'tamari'],
    { caloriesKcal: 53, proteinG: 8.1, carbsG: 4.9, fatG: 0.1, fiberG: 0, sodiumMg: 5490 },
    { tbsp: 17, tsp: 6, densityGPerMl: 1.15 },
  ),
  p(
    'OYSTER_SAUCE',
    'Dầu hào',
    'sauce_seasoning',
    ['dau hao', 'dau hao chay', 'oyster sauce'],
    { caloriesKcal: 76, proteinG: 1.8, carbsG: 16.5, fatG: 0.2, fiberG: 0.1, sodiumMg: 3920 },
    { tbsp: 18, tsp: 6, densityGPerMl: 1.2 },
  ),
  p(
    'HOISIN_BEAN_PASTE',
    'Tương đen / Tương bần / Chao',
    'sauce_seasoning',
    ['tuong den', 'tuong ban', 'chao', 'tuong hot', 'hoisin sauce', 'fermented bean curd'],
    { caloriesKcal: 118, proteinG: 4.2, carbsG: 22.0, fatG: 1.6, fiberG: 0.8, sodiumMg: 2950 },
    { tbsp: 18, tsp: 6, densityGPerMl: 1.18 },
  ),
  p(
    'SHRIMP_PASTE',
    'Mắm tôm / Mắm ruốc / Mắm nêm',
    'sauce_seasoning',
    ['mam tom', 'mam ruoc', 'mam nem', 'shrimp paste', 'fermented fish sauce'],
    { caloriesKcal: 92, proteinG: 15.2, carbsG: 4.5, fatG: 1.6, fiberG: 0, sodiumMg: 8900 },
    { tbsp: 18, tsp: 6, densityGPerMl: 1.18 },
  ),
  p(
    'CHILI_SAUCE',
    'Tương ớt / Sa tế',
    'sauce_seasoning',
    ['tuong ot', 'sa te', 'gochujang', 'chili sauce', 'sriracha'],
    { caloriesKcal: 108, proteinG: 1.6, carbsG: 22.5, fatG: 1.8, fiberG: 1.2, sodiumMg: 1240 },
    { tbsp: 17, tsp: 6, densityGPerMl: 1.12 },
  ),
  p(
    'TOMATO_KETCHUP',
    'Tương cà',
    'sauce_seasoning',
    ['tuong ca', 'sot ca chua dong chai', 'ketchup', 'tomato paste'],
    { caloriesKcal: 112, proteinG: 1.3, carbsG: 26.0, fatG: 0.2, fiberG: 0.5, sodiumMg: 980 },
    { tbsp: 17, tsp: 6, densityGPerMl: 1.14 },
  ),
  p(
    'COOKING_OIL',
    'Dầu ăn thực vật / Dầu olive',
    'cooking_fat',
    ['dau an', 'dau thuc vat', 'dau olive', 'dau o liu', 'dau dau nanh', 'cooking oil', 'olive oil', 'vegetable oil'],
    { caloriesKcal: 884, proteinG: 0, carbsG: 0, fatG: 100.0, fiberG: 0, sodiumMg: 0 },
    { tbsp: 14, tsp: 4.6, cup: 220, densityGPerMl: 0.92 },
  ),
  p(
    'SESAME_OIL',
    'Dầu mè thơm',
    'cooking_fat',
    ['dau me', 'dau vung', 'sesame oil'],
    { caloriesKcal: 884, proteinG: 0, carbsG: 0, fatG: 100.0, fiberG: 0, sodiumMg: 0 },
    { tbsp: 14, tsp: 4.6, densityGPerMl: 0.92 },
  ),
  p(
    'LARD_PORK_FAT',
    'Mỡ heo / Tóp mỡ',
    'cooking_fat',
    ['mo heo', 'mo lon', 'top mo', 'lard', 'pork fat'],
    { caloriesKcal: 892, proteinG: 1.5, carbsG: 0, fatG: 98.0, fiberG: 0, sodiumMg: 12 },
    { tbsp: 14, tsp: 4.6, bowl: 120, densityGPerMl: 0.91 },
  ),
  p(
    'SUGAR',
    'Đường cát / Đường phèn / Đường thốt nốt',
    'sauce_seasoning',
    ['duong', 'duong cat', 'duong phen', 'duong thot not', 'duong nau', 'sugar', 'brown sugar', 'palm sugar'],
    { caloriesKcal: 387, proteinG: 0, carbsG: 99.8, fatG: 0, fiberG: 0, sodiumMg: 2 },
    { tbsp: 12, tsp: 4 },
    'high',
  ),
  p(
    'CARAMEL_HONEY',
    'Nước màu kho / Nước hàng / Mật ong',
    'sauce_seasoning',
    ['nuoc mau', 'nuoc hang', 'nuoc mau dua', 'mat ong', 'honey', 'caramel sauce'],
    { caloriesKcal: 310, proteinG: 0.3, carbsG: 81.0, fatG: 0, fiberG: 0, sodiumMg: 12 },
    { tbsp: 18, tsp: 6, densityGPerMl: 1.3 },
    'high',
  ),
  p(
    'SALT',
    'Muối ăn / Muối biển',
    'sauce_seasoning',
    ['muoi', 'muoi an', 'muoi hat', 'muoi bien', 'muoi tinh', 'salt'],
    { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sodiumMg: 38750 },
    { tbsp: 15, tsp: 5, pinch: 0.5 },
  ),
  p(
    'SEASONING_POWDER',
    'Hạt nêm / Bột canh / Bột ngọt',
    'sauce_seasoning',
    ['hat nem', 'bot nem', 'bot canh', 'bot ngot', 'mi chinh', 'seasoning powder', 'bouillon'],
    { caloriesKcal: 165, proteinG: 12.0, carbsG: 24.0, fatG: 2.0, fiberG: 0, sodiumMg: 17400 },
    { tbsp: 12, tsp: 4, pinch: 0.6 },
  ),
  p(
    'BLACK_PEPPER',
    'Tiêu đen / Hạt tiêu Bắc',
    'sauce_seasoning',
    ['tieu', 'hat tieu', 'tieu den', 'tieu so', 'tieu xanh', 'black pepper', 'pepper'],
    { caloriesKcal: 251, proteinG: 10.4, carbsG: 64.0, fatG: 3.3, fiberG: 25.3, sodiumMg: 20 },
    { tbsp: 7, tsp: 2.3, pinch: 0.4, stalk: 10 },
  ),
  p(
    'FIVE_SPICE_CURRY',
    'Ngũ vị hương / Bột cà ri / Hoa hồi / Quế',
    'sauce_seasoning',
    ['ngu vi huong', 'bot ca ri', 'hoa hoi', 'que', 'thao qua', 'hat dieu mau', 'five spice', 'curry powder', 'star anise'],
    { caloriesKcal: 285, proteinG: 11.2, carbsG: 58.0, fatG: 8.5, fiberG: 26.0, sodiumMg: 48 },
    { tbsp: 7, tsp: 2.5, pinch: 0.5, piece: 2, pack: 10 },
  ),
  p(
    'VINEGAR',
    'Giấm gạo',
    'sauce_seasoning',
    ['giam', 'giam gao', 'giam tao', 'vinegar', 'rice vinegar'],
    { caloriesKcal: 18, proteinG: 0, carbsG: 0.8, fatG: 0, fiberG: 0, sodiumMg: 5 },
    { tbsp: 15, tsp: 5, densityGPerMl: 1.01 },
  ),
  p(
    'PEANUT',
    'Đậu phộng (Lạc rang)',
    'nut_seed',
    ['dau phong', 'lac rang', 'lac', 'bo dau phong', 'peanut', 'peanuts'],
    { caloriesKcal: 567, proteinG: 25.8, carbsG: 16.1, fatG: 49.2, fiberG: 8.5, sodiumMg: 18 },
    { tbsp: 10, tsp: 3.5, bowl: 110, pack: 100 },
    'low',
  ),
  p(
    'SESAME_CASHEW',
    'Mè rang (Hạt vừng) / Hạt điều',
    'nut_seed',
    ['hat vung', 'me rang', 'hat me', 'hat dieu', 'sesame', 'cashew'],
    { caloriesKcal: 573, proteinG: 17.7, carbsG: 23.4, fatG: 49.7, fiberG: 11.8, sodiumMg: 11 },
    { tbsp: 9, tsp: 3, pack: 100 },
    'low',
  ),
  p(
    'WATER_BROTH',
    'Nước lọc / Nước dùng thanh',
    'liquid_base',
    ['nuoc loc', 'nuoc soi', 'nuoc lanh', 'nuoc dung', 'nuoc ham', 'water', 'broth', 'stock'],
    { caloriesKcal: 4, proteinG: 0.5, carbsG: 0.2, fatG: 0.1, fiberG: 0, sodiumMg: 35 },
    { bowl: 250, cup: 240, tbsp: 15, tsp: 5, densityGPerMl: 1.0 },
  ),
  p(
    'QUAIL_MEAT',
    'Chim cút',
    'protein_poultry',
    ['chim cut', 'thit chim cut', 'quail'],
    { caloriesKcal: 192, proteinG: 21.8, carbsG: 0, fatG: 11.2, fiberG: 0, sodiumMg: 58 },
    { piece: 110, pack: 350 },
  ),
  p(
    'YOGURT',
    'Sữa chua',
    'protein_egg_dairy',
    ['sua chua', 'yaourt', 'yogurt', 'greek yogurt'],
    { caloriesKcal: 63, proteinG: 4.5, carbsG: 6.8, fatG: 2.0, fiberG: 0, sodiumMg: 46 },
    { pack: 100, cup: 180, tbsp: 15 },
    'low',
  ),
  p(
    'HU_TIEU_NOODLE',
    'Sợi hủ tiếu / Bánh canh bột gạo',
    'grain_starch',
    ['soi hu tieu', 'hu tieu dai', 'soi banh canh', 'banh canh bot gao'],
    { caloriesKcal: 138, proteinG: 2.4, carbsG: 30.8, fatG: 0.3, fiberG: 0.5, sodiumMg: 16 },
    { bowl: 170, pack: 400 },
    'medium',
  ),
  p(
    'EGG_NOODLE',
    'Mì trứng tươi / Mì vằn thắn',
    'grain_starch',
    ['mi trung tuoi', 'mi van than', 'mi hoanh thanh', 'egg noodle'],
    { caloriesKcal: 280, proteinG: 9.8, carbsG: 54.0, fatG: 2.6, fiberG: 2.2, sodiumMg: 195 },
    { bunch: 80, bowl: 120, pack: 300 },
    'medium',
  ),
  p(
    'OATS',
    'Yến mạch nguyên cám',
    'grain_starch',
    ['yen mach', 'bot yen mach', 'oats', 'rolled oats'],
    { caloriesKcal: 379, proteinG: 13.2, carbsG: 67.7, fatG: 6.5, fiberG: 10.1, sodiumMg: 6 },
    { tbsp: 10, cup: 90, bowl: 80, pack: 500 },
    'low',
  ),
  p(
    'LOTUS_SEED',
    'Hạt sen tươi / Hạt sen khô',
    'vegetable_gourd_root',
    ['hat sen tuoi', 'hat sen kho', 'lotus seeds'],
    { caloriesKcal: 89, proteinG: 4.1, carbsG: 17.3, fatG: 0.5, fiberG: 2.4, sodiumMg: 5 },
    { bowl: 110, pack: 150, tbsp: 12 },
    'low',
  ),
  p(
    'GREEN_MANGO',
    'Xoài xanh / Cóc non làm gỏi',
    'fruit_sour',
    ['xoai xanh', 'xoai keo', 'coc non', 'green mango'],
    { caloriesKcal: 54, proteinG: 0.7, carbsG: 13.5, fatG: 0.2, fiberG: 1.8, sodiumMg: 2 },
    { piece: 220, fruit: 220, slice: 30 },
    'low',
  ),
  p(
    'LIME_LEAF',
    'Lá chanh tươi',
    'herb_aromatic',
    ['la chanh', 'la chanh tuoi', 'kaffir lime leaf', 'lime leaves'],
    { caloriesKcal: 36, proteinG: 2.2, carbsG: 7.0, fatG: 0.5, fiberG: 3.5, sodiumMg: 14 },
    { piece: 1.5, sheet: 1.5, sprig: 5, bunch: 25 },
    'low',
  ),
  p(
    'BETEL_LEAF',
    'Lá lốt tươi',
    'herb_aromatic',
    ['la lot', 'rau la lot', 'piper lolot', 'betel leaf'],
    { caloriesKcal: 39, proteinG: 4.3, carbsG: 5.4, fatG: 0.5, fiberG: 3.8, sodiumMg: 18 },
    { bunch: 60, sheet: 3, piece: 3 },
    'low',
  ),
  p(
    'PERILLA_LEAF',
    'Tía tô & Kinh giới',
    'herb_aromatic',
    ['la tia to', 'rau tia to', 'rau kinh gioi', 'perilla', 'shiso'],
    { caloriesKcal: 37, proteinG: 2.9, carbsG: 6.5, fatG: 0.6, fiberG: 3.4, sodiumMg: 20 },
    { bunch: 50, sprig: 5, piece: 2 },
    'low',
  ),
];

const PROFILE_BY_KEY: ReadonlyMap<string, IngredientNutritionProfileV6> = (() => {
  const map = new Map<string, IngredientNutritionProfileV6>();
  for (const entry of NUTRITION_DICTIONARY_V6) {
    map.set(entry.key.toUpperCase(), entry);
  }
  const keyAliases: ReadonlyArray<readonly [string, string]> = [
    ['NOODLE', 'BUN_NOODLE'],
    ['CRAB', 'CRAB_MEAT'],
    ['CORIANDER', 'CORIANDER_DILL'],
    ['DILL', 'CORIANDER_DILL'],
    ['LIME_LEAF', 'VIETNAMESE_HERBS'],
    ['CARAMEL_SAUCE', 'CARAMEL_HONEY'],
    ['HONEY', 'CARAMEL_HONEY'],
    ['SESAME_SEED', 'SESAME_CASHEW'],
    ['WATER', 'WATER_BROTH'],
  ];
  for (const [aliasKey, targetKey] of keyAliases) {
    const found = map.get(targetKey);
    if (found && !map.has(aliasKey)) {
      map.set(aliasKey, found);
    }
  }
  return map;
})();

const SORTED_KEYWORD_INDEX: ReadonlyArray<{
  keyword: string;
  profile: IngredientNutritionProfileV6;
}> = (() => {
  const pairs: Array<{ keyword: string; profile: IngredientNutritionProfileV6 }> = [];
  for (const profile of NUTRITION_DICTIONARY_V6) {
    for (const kw of profile.keywords) {
      pairs.push({ keyword: kw, profile });
    }
  }
  // Match longest multi-word phrases first so "ca chua" never collides with "ca", and "dau an" never collides with "dau"
  pairs.sort((a, b) => b.keyword.length - a.keyword.length);
  return pairs;
})();

function containsWholeWords(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  if (haystack === needle) return true;
  const padded = ` ${haystack} `;
  return padded.includes(` ${needle} `);
}

/**
 * Resolves a recipe ingredient to its curated V6 nutrition profile with deterministic keyword disambiguation.
 */
export function resolveIngredientNutritionV6(
  ingredientId?: string | null,
  ingredientName?: string | null,
): { profile: IngredientNutritionProfileV6; matched: boolean } {
  if (ingredientId) {
    const cleanKey = ingredientId.trim().toUpperCase();
    const direct = PROFILE_BY_KEY.get(cleanKey);
    if (direct) {
      return { profile: direct, matched: true };
    }
  }

  const normName = normalizeIngredientText(`${ingredientName ?? ''} ${ingredientId ?? ''}`);
  if (normName) {
    for (const entry of SORTED_KEYWORD_INDEX) {
      if (containsWholeWords(normName, entry.keyword)) {
        return { profile: entry.profile, matched: true };
      }
    }
  }

  // Fallback neutral vegetable/mixed profile if completely unknown ingredient
  return {
    profile: {
      key: 'ESTIMATED_GENERIC',
      nameVi: ingredientName || 'Nguyên liệu ước tính',
      group: 'vegetable_gourd_root',
      keywords: [],
      per100g: {
        caloriesKcal: 65,
        proteinG: 3.2,
        carbsG: 9.0,
        fatG: 1.8,
        fiberG: 1.8,
        sodiumMg: 38,
      },
      unitGrams: { piece: 100, bunch: 200, pack: 200, slice: 40, tbsp: 15, tsp: 5, bowl: 150 },
      glycemicIndexTier: 'low',
    },
    matched: false,
  };
}

type CanonicalSizeUnit =
  | 'g'
  | 'kg'
  | 'lang'
  | 'ml'
  | 'l'
  | 'tbsp'
  | 'tsp'
  | 'piece'
  | 'bulb'
  | 'clove'
  | 'bunch'
  | 'slice'
  | 'pack'
  | 'bowl'
  | 'cup'
  | 'stalk'
  | 'sprig'
  | 'sheet'
  | 'pinch';

function classifyUnitKind(rawUnit: string): CanonicalSizeUnit {
  const trimmed = (rawUnit || 'g').trim().toLowerCase();
  const norm = normalizeIngredientText(trimmed);

  if (norm === 'g' || norm === 'gr' || norm === 'gam' || norm === 'gram' || norm === 'grams') return 'g';
  if (norm === 'kg' || norm === 'kilo' || norm === 'ky' || norm === 'ki' || norm === 'kilogram') return 'kg';
  if (norm === 'lang') return 'lang';
  if (norm === 'ml' || norm === 'mililit') return 'ml';
  if (norm === 'l' || norm === 'lit' || norm === 'liter' || norm === 'litre') return 'l';
  if (
    norm === 'tbsp' ||
    norm === 'tbs' ||
    norm === 'mc' ||
    norm.includes('muong canh') ||
    norm.includes('thia canh') ||
    norm.includes('muong sup') ||
    norm.includes('thia sup')
  ) {
    return 'tbsp';
  }
  if (
    norm === 'tsp' ||
    norm === 'mcp' ||
    norm.includes('muong ca phe') ||
    norm.includes('thia ca phe') ||
    norm.includes('muong nho') ||
    norm.includes('thia nho')
  ) {
    return 'tsp';
  }
  if (norm === 'clove' || norm === 'cloves' || norm === 'tep' || norm === 'tep toi') return 'clove';
  if (norm === 'bulb' || norm === 'bulbs' || norm === 'cu') return 'bulb';
  if (norm === 'bunch' || norm === 'bo' || norm === 'mo' || norm === 'nam') return 'bunch';
  if (
    norm === 'slice' ||
    norm === 'slices' ||
    norm === 'mieng' ||
    norm === 'lat' ||
    norm === 'khua' ||
    norm === 'bia' ||
    norm === 'khuc'
  ) {
    return 'slice';
  }
  if (
    norm === 'pack' ||
    norm === 'goi' ||
    norm === 'hop' ||
    norm === 'bich' ||
    norm === 'tui' ||
    norm === 'lon' ||
    norm === 'hu'
  ) {
    return 'pack';
  }
  if (norm === 'bowl' || norm === 'chen' || norm === 'bat') return 'bowl';
  if (norm === 'cup' || norm === 'coc' || norm === 'ly') return 'cup';
  if (norm === 'stalk' || norm === 'nhanh' || norm === 'cay' || norm === 'cong' || norm === 'doc') return 'stalk';
  if (norm === 'sprig' || norm === 'ngon' || norm === 'canh' || norm === 'la') return 'sprig';
  if (norm === 'sheet' || norm === 'to' || norm === 'banh trang') return 'sheet';
  if (norm === 'pinch' || norm === 'nhum' || norm === 'chut' || norm === 'it' || norm === 'xiu') return 'pinch';
  // Default countable ('piece', 'quả', 'trái', 'cái', 'con', 'viên', 'đùi', 'ức')
  return 'piece';
}

/**
 * Converts any Vietnamese or metric culinary quantity into edible grams.
 */
export function convertIngredientToGramsV6(
  quantity: number,
  rawUnit: string,
  profile: IngredientNutritionProfileV6,
): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  const kind = classifyUnitKind(rawUnit);
  const map = profile.unitGrams;
  const density = map.densityGPerMl ?? 1.0;

  switch (kind) {
    case 'g':
      return quantity;
    case 'kg':
      return quantity * 1000;
    case 'lang':
      return quantity * 100;
    case 'ml':
      return quantity * density;
    case 'l':
      return quantity * 1000 * density;
    case 'tbsp':
      return quantity * (map.tbsp ?? Math.round(15 * density));
    case 'tsp':
      return quantity * (map.tsp ?? Math.max(3, Math.round(5 * density)));
    case 'clove':
      return quantity * (map.clove ?? map.piece ?? 5);
    case 'bulb':
      return quantity * (map.bulb ?? map.piece ?? 120);
    case 'bunch':
      return quantity * (map.bunch ?? (profile.group === 'herb_aromatic' ? 45 : 280));
    case 'slice':
      return quantity * (map.slice ?? map.piece ?? 50);
    case 'pack':
      return quantity * (map.pack ?? 250);
    case 'bowl':
      return quantity * (map.bowl ?? Math.round(220 * density));
    case 'cup':
      return quantity * (map.cup ?? Math.round(240 * density));
    case 'stalk':
      return quantity * (map.stalk ?? map.piece ?? 15);
    case 'sprig':
      return quantity * (map.sprig ?? 5);
    case 'sheet':
      return quantity * (map.sheet ?? 10);
    case 'pinch':
      return quantity * (map.pinch ?? 0.5);
    case 'piece':
    default:
      return quantity * (map.piece ?? map.fruit ?? map.bulb ?? 100);
  }
}

function isSubLinearSeasoningGroup(group: NutritionIngredientGroupV6): boolean {
  return group === 'sauce_seasoning' || group === 'cooking_fat';
}

function roundMacroMicro(raw: NutritionMacroMicroV6): NutritionMacroMicroV6 {
  return {
    caloriesKcal: Math.max(0, Math.round(raw.caloriesKcal)),
    proteinG: Math.max(0, Number(raw.proteinG.toFixed(1))),
    carbsG: Math.max(0, Number(raw.carbsG.toFixed(1))),
    fatG: Math.max(0, Number(raw.fatG.toFixed(1))),
    fiberG: Math.max(0, Number(raw.fiberG.toFixed(1))),
    sodiumMg: Math.max(0, Math.round(raw.sodiumMg)),
  };
}

function computeMacroSplitPct(macros: NutritionMacroMicroV6): {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
} {
  const pKcal = Math.max(0, macros.proteinG) * 4;
  const cKcal = Math.max(0, macros.carbsG) * 4;
  const fKcal = Math.max(0, macros.fatG) * 9;
  const sum = pKcal + cKcal + fKcal;

  if (sum <= 0) {
    return { proteinPct: 0, carbsPct: 100, fatPct: 0 };
  }

  let proteinPct = Math.round((pKcal / sum) * 100);
  let carbsPct = Math.round((cKcal / sum) * 100);
  let fatPct = 100 - proteinPct - carbsPct;

  if (fatPct < 0) {
    if (proteinPct >= carbsPct) {
      proteinPct += fatPct;
    } else {
      carbsPct += fatPct;
    }
    fatPct = 0;
  }

  return { proteinPct, carbsPct, fatPct };
}

function deriveHealthBadgesVi(
  perServing: NutritionMacroMicroV6,
  macroSplitPct: { proteinPct: number; carbsPct: number; fatPct: number },
  recipeCategory?: string,
): string[] {
  const badges: string[] = [];

  if (perServing.proteinG >= 20 || (perServing.proteinG >= 14 && macroSplitPct.proteinPct >= 28)) {
    badges.push('Giàu đạm tự nhiên');
  }
  if (perServing.caloriesKcal > 0 && perServing.caloriesKcal < 450) {
    badges.push('Thanh nhẹ < 450 kcal');
  }
  if (perServing.fiberG >= 3.5) {
    badges.push('Giàu chất xơ rau củ');
  }
  if (perServing.carbsG <= 18) {
    badges.push('Ít tinh bột');
  }
  if (perServing.sodiumMg < 500) {
    badges.push('Thanh đạm ít muối');
  }
  if (
    perServing.sodiumMg >= 850 ||
    (recipeCategory === 'mon_kho' && perServing.sodiumMg >= 650)
  ) {
    badges.push('Đậm đà đưa cơm');
  }
  if (
    macroSplitPct.proteinPct >= 15 &&
    macroSplitPct.carbsPct >= 25 &&
    macroSplitPct.fatPct <= 40 &&
    badges.length < 4
  ) {
    badges.push('Cân bằng 3 nhóm chất');
  }
  if (badges.length === 0) {
    badges.push('Năng lượng trọn bữa gia đình');
  }

  return badges.slice(0, 4);
}

function deriveGlycemicLoadLabelVi(
  perServing: NutritionMacroMicroV6,
  highGiCarbRatio: number,
): 'Thấp' | 'Cân bằng' | 'Năng lượng cao' {
  const netCarbs = Math.max(0, perServing.carbsG - perServing.fiberG);
  const estimatedGi = 42 + highGiCarbRatio * 32; // ~42 (veg/legumes) up to ~74 (white rice/sugar)
  const glycemicLoad = (netCarbs * estimatedGi) / 100;

  if (glycemicLoad < 11 && perServing.caloriesKcal < 520) {
    return 'Thấp';
  }
  if (glycemicLoad > 24 || (netCarbs > 45 && perServing.caloriesKcal >= 550) || perServing.caloriesKcal >= 720) {
    return 'Năng lượng cao';
  }
  return 'Cân bằng';
}

/**
 * Deterministic Vietnamese & Global Macro/Micro Nutrition Calculator (Takolio V6).
 */
export function computeRecipeNutritionV6(
  recipe: Recipe,
  targetServings?: number,
): RecipeNutritionReportV6 {
  const baseServings = Math.max(1, Math.round(recipe.servings || 2));
  const effectiveServings =
    typeof targetServings === 'number' && Number.isFinite(targetServings) && targetServings > 0
      ? Math.max(1, Math.round(targetServings))
      : baseServings;

  const linearScale = effectiveServings / baseServings;
  const seasoningScale = linearScale === 1 ? 1 : Math.pow(linearScale, 0.78);

  const ingredients: readonly RecipeIngredient[] = recipe.ingredients ?? [];
  let matchedCount = 0;

  const rawTotal: NutritionMacroMicroV6 = {
    caloriesKcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    sodiumMg: 0,
  };

  let totalCarbsWeightedHighGi = 0;
  let totalCarbsRaw = 0;

  for (const ing of ingredients) {
    const { profile, matched } = resolveIngredientNutritionV6(ing.ingredientId, ing.name);
    if (matched) matchedCount += 1;

    const scaleFactor = isSubLinearSeasoningGroup(profile.group) ? seasoningScale : linearScale;
    const scaledQuantity = Math.max(0, (ing.requiredQuantity || 0) * scaleFactor);
    const rawGrams = convertIngredientToGramsV6(scaledQuantity, ing.unit, profile);

    // Deep-frying oil retention adjustment: when > 45g oil is used in a dish, ~45% is absorbed into food
    const edibleGrams =
      profile.group === 'cooking_fat' && profile.key === 'COOKING_OIL' && rawGrams > 45 * linearScale
        ? rawGrams * 0.45
        : rawGrams;

    const factor = edibleGrams / 100;
    const p100 = profile.per100g;

    rawTotal.caloriesKcal += p100.caloriesKcal * factor;
    rawTotal.proteinG += p100.proteinG * factor;
    rawTotal.carbsG += p100.carbsG * factor;
    rawTotal.fatG += p100.fatG * factor;
    rawTotal.fiberG += p100.fiberG * factor;
    rawTotal.sodiumMg += p100.sodiumMg * factor;

    const ingCarbs = p100.carbsG * factor;
    totalCarbsRaw += ingCarbs;
    if (profile.glycemicIndexTier === 'high') {
      totalCarbsWeightedHighGi += ingCarbs;
    } else if (profile.glycemicIndexTier === 'medium') {
      totalCarbsWeightedHighGi += ingCarbs * 0.5;
    }
  }

  // Fallback to declared nutrition ONLY when recipe has zero ingredients
  if (ingredients.length === 0 && recipe.nutrition) {
    rawTotal.caloriesKcal = recipe.nutrition.calories * effectiveServings;
    rawTotal.proteinG = recipe.nutrition.proteinG * effectiveServings;
    rawTotal.carbsG = recipe.nutrition.carbG * effectiveServings;
    rawTotal.fatG = recipe.nutrition.fatG * effectiveServings;
    rawTotal.fiberG = 2.0 * effectiveServings;
    rawTotal.sodiumMg = 520 * effectiveServings;
  }

  const totalDish = roundMacroMicro(rawTotal);
  const perServing = roundMacroMicro({
    caloriesKcal: rawTotal.caloriesKcal / effectiveServings,
    proteinG: rawTotal.proteinG / effectiveServings,
    carbsG: rawTotal.carbsG / effectiveServings,
    fatG: rawTotal.fatG / effectiveServings,
    fiberG: rawTotal.fiberG / effectiveServings,
    sodiumMg: rawTotal.sodiumMg / effectiveServings,
  });

  const macroSplitPct = computeMacroSplitPct(perServing);
  const healthBadgesVi = deriveHealthBadgesVi(perServing, macroSplitPct, recipe.category);
  const highGiRatio = totalCarbsRaw > 0 ? totalCarbsWeightedHighGi / totalCarbsRaw : 0.3;
  const glycemicLoadLabelVi = deriveGlycemicLoadLabelVi(perServing, highGiRatio);

  const sodiumAdvisoryVi =
    perServing.sodiumMg >= 950
      ? `Món có hàm lượng natri khoảng ${perServing.sodiumMg} mg/khẩu phần (≥ 950 mg): Nên giảm 15–20% lượng nước mắm/hạt nêm khi chế biến và hạn chế chan nhiều nước kho nếu gia đình có người lớn tuổi hoặc nhạy cảm huyết áp.`
      : null;

  const confidence: 'high' | 'estimated' =
    ingredients.length > 0 && matchedCount / ingredients.length >= 0.75 ? 'high' : 'estimated';

  return {
    servings: effectiveServings,
    perServing,
    totalDish,
    macroSplitPct,
    healthBadgesVi,
    sodiumAdvisoryVi,
    glycemicLoadLabelVi,
    confidence,
  };
}

function scoreDailyTrayBalance(
  intake: NutritionMacroMicroV6,
  rdi: VietnameseRdiBenchmarksV6,
  dishCount: number,
): number {
  if (dishCount === 0 || intake.caloriesKcal <= 0) return 0;

  // 1. Macro ratio harmony (up to 35 pts)
  const split = computeMacroSplitPct(intake);
  // Ideal Vietnamese balanced tray: Protein 14-30%, Carbs 40-65%, Fat 18-35%
  const proteinDist =
    split.proteinPct >= 14 && split.proteinPct <= 32
      ? 12
      : Math.max(3, 12 - Math.abs(split.proteinPct - 22) * 0.45);
  const carbDist =
    split.carbsPct >= 38 && split.carbsPct <= 66
      ? 12
      : Math.max(3, 12 - Math.abs(split.carbsPct - 52) * 0.35);
  const fatDist =
    split.fatPct >= 16 && split.fatPct <= 36
      ? 11
      : Math.max(2, 11 - Math.abs(split.fatPct - 26) * 0.35);
  const macroHarmonyPts = proteinDist + carbDist + fatDist;

  // 2. Protein & Fiber adequacy relative to RDI / caloric density (up to 35 pts)
  const proteinCoverage = Math.min(1.15, intake.proteinG / rdi.proteinG);
  const proteinPts = Math.min(18, proteinCoverage * 18);

  const fiberDensityPer1000Kcal = (intake.fiberG / Math.max(350, intake.caloriesKcal)) * 1000;
  const fiberCoverage = Math.max(
    intake.fiberG / rdi.fiberG,
    Math.min(1, fiberDensityPer1000Kcal / 12.5),
  );
  const fiberPts = Math.min(17, fiberCoverage * 17);

  // 3. Sodium discipline (up to 20 pts — penalizes exceeding 2000mg RDI)
  let sodiumPts = 20;
  if (intake.sodiumMg > rdi.sodiumMg) {
    const excessRatio = (intake.sodiumMg - rdi.sodiumMg) / rdi.sodiumMg;
    sodiumPts = Math.max(2, 20 - excessRatio * 24);
  } else if (intake.caloriesKcal > 0) {
    const sodiumPer1000 = (intake.sodiumMg / Math.max(400, intake.caloriesKcal)) * 1000;
    if (sodiumPer1000 > 1350) {
      sodiumPts = Math.max(8, 20 - ((sodiumPer1000 - 1350) / 500) * 8);
    }
  }

  // 4. Caloric RDI closeness / multi-dish completeness (up to 10 pts)
  const kcalRatio = intake.caloriesKcal / rdi.caloriesKcal;
  let kcalPts = 10;
  if (kcalRatio < 0.35) {
    kcalPts = Math.max(3, kcalRatio * 20);
  } else if (kcalRatio > 1.25) {
    kcalPts = Math.max(2, 10 - (kcalRatio - 1.25) * 16);
  } else if (kcalRatio >= 0.75 && kcalRatio <= 1.12) {
    kcalPts = 10;
  } else {
    kcalPts = 8;
  }

  const rawScore = macroHarmonyPts + proteinPts + fiberPts + sodiumPts + kcalPts;
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

/**
 * Evaluates combined daily per-person intake across a tray/menu of Vietnamese & global dishes
 * against Vietnamese National Institute of Nutrition (NIN) RDI benchmarks.
 */
export function computeDailyTrayNutritionBalance(
  recipes: Recipe[],
  householdSize?: number,
): DailyTrayNutritionBalanceV6 {
  const effectiveHousehold =
    typeof householdSize === 'number' && Number.isFinite(householdSize) && householdSize > 0
      ? Math.max(1, Math.round(householdSize))
      : 4;

  const rdi = VIETNAMESE_RDI_BENCHMARKS_V6;

  if (!recipes || recipes.length === 0) {
    const zero: NutritionMacroMicroV6 = {
      caloriesKcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
      sodiumMg: 0,
    };
    return {
      householdSize: effectiveHousehold,
      dishCount: 0,
      perPersonIntake: zero,
      householdTotal: zero,
      rdiBenchmarks: rdi,
      rdiCompletionPct: {
        caloriesPct: 0,
        proteinPct: 0,
        carbsPct: 0,
        fatPct: 0,
        fiberPct: 0,
        sodiumPct: 0,
      },
      balanceScore: 0,
      statusLabelVi: 'Chưa có món',
      coachSummaryVi:
        'Chưa có món ăn nào trong thực đơn hôm nay. Hãy kết hợp đủ 3 trụ cột mâm cơm Việt: 1 món mặn giàu đạm + 1 món canh thanh mát + 1 món rau củ giàu chất xơ.',
      dishReports: [],
    };
  }

  const dishReports = recipes.map((recipe) => ({
    recipeId: recipe.id,
    title: recipe.title,
    report: computeRecipeNutritionV6(recipe, effectiveHousehold),
  }));

  const rawPerPerson: NutritionMacroMicroV6 = {
    caloriesKcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    sodiumMg: 0,
  };

  const rawHouseholdTotal: NutritionMacroMicroV6 = {
    caloriesKcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    sodiumMg: 0,
  };

  for (const item of dishReports) {
    rawPerPerson.caloriesKcal += item.report.perServing.caloriesKcal;
    rawPerPerson.proteinG += item.report.perServing.proteinG;
    rawPerPerson.carbsG += item.report.perServing.carbsG;
    rawPerPerson.fatG += item.report.perServing.fatG;
    rawPerPerson.fiberG += item.report.perServing.fiberG;
    rawPerPerson.sodiumMg += item.report.perServing.sodiumMg;

    rawHouseholdTotal.caloriesKcal += item.report.totalDish.caloriesKcal;
    rawHouseholdTotal.proteinG += item.report.totalDish.proteinG;
    rawHouseholdTotal.carbsG += item.report.totalDish.carbsG;
    rawHouseholdTotal.fatG += item.report.totalDish.fatG;
    rawHouseholdTotal.fiberG += item.report.totalDish.fiberG;
    rawHouseholdTotal.sodiumMg += item.report.totalDish.sodiumMg;
  }

  const perPersonIntake = roundMacroMicro(rawPerPerson);
  const householdTotal = roundMacroMicro(rawHouseholdTotal);

  const rdiCompletionPct = {
    caloriesPct: Math.round((perPersonIntake.caloriesKcal / rdi.caloriesKcal) * 100),
    proteinPct: Math.round((perPersonIntake.proteinG / rdi.proteinG) * 100),
    carbsPct: Math.round((perPersonIntake.carbsG / rdi.carbsG) * 100),
    fatPct: Math.round((perPersonIntake.fatG / rdi.fatG) * 100),
    fiberPct: Math.round((perPersonIntake.fiberG / rdi.fiberG) * 100),
    sodiumPct: Math.round((perPersonIntake.sodiumMg / rdi.sodiumMg) * 100),
  };

  const balanceScore = scoreDailyTrayBalance(perPersonIntake, rdi, recipes.length);

  let statusLabelVi: DailyTrayNutritionBalanceV6['statusLabelVi'] = 'Cân đối chuẩn mâm cơm Việt';
  const coachNotes: string[] = [];

  if (perPersonIntake.sodiumMg > rdi.sodiumMg) {
    statusLabelVi = 'Đậm vị · Lưu ý giảm mặn';
    coachNotes.push(
      `Lượng natri ước tính đạt ${perPersonIntake.sodiumMg} mg/người (${rdiCompletionPct.sodiumPct}% ngưỡng 2.000 mg/ngày) — nên nêm nhạt hơn 15–20% ở món kho/canh và ưu tiên chấm ngoài.`,
    );
  } else if (perPersonIntake.caloriesKcal < 900) {
    statusLabelVi = 'Thanh nhẹ · Cần thêm năng lượng';
    coachNotes.push(
      `Thực đơn hiện cung cấp ${perPersonIntake.caloriesKcal} kcal/người (${rdiCompletionPct.caloriesPct}% nhu cầu ngày 2.000 kcal) — phù hợp cho 1 bữa chính gọn nhẹ, nhớ bổ sung cơm/tinh bột và bữa phụ lành mạnh.`,
    );
  } else if (perPersonIntake.fiberG < 10 && perPersonIntake.caloriesKcal >= 1100) {
    statusLabelVi = 'Giàu năng lượng · Cần thêm rau xanh';
    coachNotes.push(
      `Chất xơ mới đạt ${perPersonIntake.fiberG}g/${rdi.fiberG}g khuyến nghị — gợi ý thêm 1 đĩa rau muống/bông cải luộc hoặc trái cây tươi tráng miệng.`,
    );
  } else {
    coachNotes.push(
      `Cấu trúc dinh dưỡng cân đối (${perPersonIntake.caloriesKcal} kcal, ${perPersonIntake.proteinG}g đạm, ${perPersonIntake.fiberG}g chất xơ/người, đạt ${balanceScore}/100 điểm chuẩn Viện Dinh Dưỡng).`,
    );
  }

  if (perPersonIntake.proteinG < 35 && coachNotes.length < 2) {
    coachNotes.push(
      `Đạm hiện đạt ${perPersonIntake.proteinG}g (${rdiCompletionPct.proteinPct}% mức 65g/ngày); có thể bổ sung đậu phụ, trứng hoặc cá/thịt nạc ở bữa kế tiếp.`,
    );
  } else if (perPersonIntake.fiberG >= 12 && perPersonIntake.sodiumMg <= rdi.sodiumMg && coachNotes.length < 2) {
    coachNotes.push(
      'Tỷ lệ rau xanh và kiểm soát muối rất tốt cho sức khỏe tim mạch cả gia đình.',
    );
  }

  return {
    householdSize: effectiveHousehold,
    dishCount: recipes.length,
    perPersonIntake,
    householdTotal,
    rdiBenchmarks: rdi,
    rdiCompletionPct,
    balanceScore,
    statusLabelVi,
    coachSummaryVi: coachNotes.join(' '),
    dishReports,
  };
}
