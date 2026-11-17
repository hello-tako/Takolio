import {
  convertCulinaryQuantity,
  findCulinaryIngredientV4,
  formatHumanCulinaryEquivalentVi,
  normalizeIngredientText,
} from '@takolio/domain';
import type { Recipe, RecipeIngredient } from '../types';
import type {
  CulinaryPhaseV4,
  EquipmentItemV4,
  RecipeNutritionV4,
  RecipeStepV4,
  RecipeV4,
  StepCookwareV4,
  StepHeatLevelV4,
  StepIngredientAllocationV4,
  StepTechniqueV4,
} from './types';
import { resolveRecipeArtworkV4 } from './visual-artwork';

const PHASE_LABELS_VI: Record<CulinaryPhaseV4, string> = {
  mise_en_place: 'Sơ chế & Chuẩn bị',
  marinate: 'Tẩm ướp thấm vị',
  active_cook: 'Chế biến trên bếp',
  plate: 'Hoàn thiện & Trình bày',
};

const TECHNIQUE_LABELS_VI: Record<StepTechniqueV4, string> = {
  prep: 'Sơ chế & cắt thái',
  marinate: 'Tẩm ướp gia vị',
  stir_fry: 'Phi thơm & xào đảo',
  braise: 'Kho & rim thấm vị',
  simmer: 'Đun sôi & ninh hầm',
  steam: 'Hấp & chưng cách thủy',
  fry: 'Chiên vàng & áp chảo',
  plate: 'Trình bày & dọn món',
};

const COOKWARE_META: Record<StepCookwareV4, EquipmentItemV4> = {
  prep_board: {
    id: 'prep_board',
    labelVi: 'Dao, thớt & tô sơ chế',
    descriptionVi: 'Sơ chế sạch, cắt thái đồng đều và trộn ướp gia vị',
  },
  wok: {
    id: 'wok',
    labelVi: 'Chảo sâu lòng (Wok)',
    descriptionVi: 'Phi thơm và xào đảo nhanh trên nhiệt cao giữ độ giòn',
  },
  claypot: {
    id: 'claypot',
    labelVi: 'Nồi đất / Nồi kho đáy dày',
    descriptionVi: 'Giữ nhiệt âm ỉ giúp món kho rim lên màu cánh gián sánh đậm',
  },
  stockpot: {
    id: 'stockpot',
    labelVi: 'Nồi canh / Nồi hầm',
    descriptionVi: 'Đun sôi nước dùng, nấu canh và ninh mềm nguyên liệu',
  },
  steamer: {
    id: 'steamer',
    labelVi: 'Xửng hấp cách thủy',
    descriptionVi: 'Phân bổ hơi nước nóng đều giữ nguyên vị ngọt tự nhiên',
  },
  pan: {
    id: 'pan',
    labelVi: 'Chảo chống dính',
    descriptionVi: 'Chiên vàng giòn đều hai mặt hoặc áp chảo ít dầu',
  },
};

const HEAT_LABELS_VI: Record<StepHeatLevelV4, string> = {
  off: 'Không bật bếp',
  low: 'Lửa nhỏ liu riu',
  medium_low: 'Lửa nhỏ vừa',
  medium: 'Lửa vừa ổn định',
  medium_high: 'Lửa vừa lớn',
  high: 'Lửa lớn đảo nhanh',
};

function stripPastParticipleModifiers(norm: string): string {
  return norm
    .replace(
      /\b(da|vua|sau khi)\s+(uop|so che|rua sach|rua|cat khuc|cat|thai lat|thai|bam nho|bam|luoc chin|luoc|chien so|chien|hap|chan qua|chan|de rao)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function inferStepTechniqueV4(
  instruction: string,
  stepIndex: number,
  totalSteps: number,
  recipeCategory?: string,
): StepTechniqueV4 {
  const rawNorm = normalizeIngredientText(instruction);
  const norm = stripPastParticipleModifiers(rawNorm);
  const isFinal = totalSteps > 1 && stepIndex === totalSteps - 1;

  if (
    /\b(muc canh ra|muc ra|don ra|trinh bay|thuong thuc|cho ra dia|cho ra to|xep ra dia|bay ra dia|trut ra dia thuong thuc|chan nuoc dung.*thuong thuc)\b/.test(
      norm,
    )
  ) {
    return 'plate';
  }
  if (
    isFinal &&
    /\b(tat bep|rac hanh|rac tieu|rac ngo|ruoi mo hanh|an nong|thuong thuc)\b/.test(norm) &&
    !/\b(kho|rim|ham|ninh|hap)\b/.test(norm)
  ) {
    return 'plate';
  }

  if (/\b(hap cach thuy|chung cach thuy|xung hap|cho vao hap|hap chin|hap)\b/.test(norm)) {
    return 'steam';
  }
  if (/\b(chien vang|chien gion|chien|ran|ap chao|op la|trang trung)\b/.test(norm)) {
    return 'fry';
  }
  if (/\b(kho|rim|om|kho to|kho tau|kho quet|nuoc mau|keo sanh)\b/.test(norm)) {
    return 'braise';
  }
  if (
    /\b(ham|ninh|dun soi|nau canh|nau soi|luoc|dun nho lua|dun liu riu|nau liu riu|vot bot|hot bot)\b/.test(
      norm,
    )
  ) {
    if (recipeCategory === 'mon_kho' && /\b(dun nho lua|dun liu riu|nau liu riu)\b/.test(norm)) {
      return 'braise';
    }
    return 'simmer';
  }
  if (/\b(phi thom|phi hanh|phi toi|xao san|xao nhanh|xao|dao deu|dao nhanh)\b/.test(norm)) {
    return 'stir_fry';
  }
  if (/\b(uop|tham gia vi|tron thit.*de \d+ phut|ngam gia vi)\b/.test(norm)) {
    return 'marinate';
  }
  if (
    /\b(rua sach|cat khuc|thai lat|thai mui cau|cat|thai|bam nho|bam|got vo|so che|ngam nuoc|ngam|de rao|dap dap|danh tan|pha sot|hoa sot|loc qua ray|cuon chat)\b/.test(
      rawNorm,
    )
  ) {
    return isFinal && /\b(cuon chat)\b/.test(rawNorm) ? 'plate' : 'prep';
  }

  if (stepIndex === 0) return 'prep';
  if (isFinal) return 'plate';
  return recipeCategory === 'mon_kho'
    ? 'braise'
    : recipeCategory === 'mon_canh'
      ? 'simmer'
      : 'stir_fry';
}

function inferPhaseFromTechnique(technique: StepTechniqueV4): CulinaryPhaseV4 {
  switch (technique) {
    case 'prep':
      return 'mise_en_place';
    case 'marinate':
      return 'marinate';
    case 'plate':
      return 'plate';
    default:
      return 'active_cook';
  }
}

function inferCookwareV4(technique: StepTechniqueV4, instruction: string): StepCookwareV4 {
  const norm = normalizeIngredientText(instruction);
  if (technique === 'prep' || technique === 'marinate' || technique === 'plate') {
    return 'prep_board';
  }
  if (/\b(noi dat|kho to|nieu)\b/.test(norm) || technique === 'braise') {
    return 'claypot';
  }
  if (/\b(xung|hap cach thuy|chung cach thuy)\b/.test(norm) || technique === 'steam') {
    return 'steamer';
  }
  if (technique === 'simmer') {
    return 'stockpot';
  }
  if (technique === 'fry') {
    return 'pan';
  }
  return 'wok';
}

function inferHeatLevelV4(
  technique: StepTechniqueV4,
  instruction: string,
  timerMinutes?: number,
): StepHeatLevelV4 {
  if (technique === 'prep' || technique === 'marinate' || technique === 'plate') {
    return 'off';
  }
  const norm = normalizeIngredientText(instruction);
  if (/\b(lua that nho|lua cuc nho|lua nho liu riu|liu riu|lua nho)\b/.test(norm)) {
    return 'low';
  }
  if (/\b(lua nho vua)\b/.test(norm)) {
    return 'medium_low';
  }
  if (/\b(lua lon|lua to|soi bung)\b/.test(norm)) {
    return 'high';
  }
  if (/\b(lua vua lon)\b/.test(norm)) {
    return 'medium_high';
  }
  if (/\b(lua vua)\b/.test(norm)) {
    return 'medium';
  }

  switch (technique) {
    case 'braise':
      return 'low';
    case 'simmer':
      return timerMinutes && timerMinutes >= 10 ? 'low' : 'medium';
    case 'steam':
      return 'medium';
    case 'fry':
      return 'medium_high';
    case 'stir_fry':
      return /\b(phi thom|phi toi|phi hanh)\b/.test(norm) && !/\b(xao)\b/.test(norm)
        ? 'medium'
        : 'high';
    default:
      return 'medium';
  }
}

function inferSensoryCueVi(technique: StepTechniqueV4, instruction: string): string {
  const norm = normalizeIngredientText(instruction);

  if (/\b(phi thom|phi toi|phi hanh)\b/.test(norm) && !/\b(kho|ham|ninh)\b/.test(norm)) {
    if (/\b(xao)\b/.test(norm)) {
      return 'Phi đến khi tỏi hành chuyển vàng óng dậy mùi thơm nồng rồi trút nguyên liệu vào đảo đều ngay trên chảo nóng.';
    }
    return 'Phi thơm đến khi tỏi chuyển vàng óng, dậy mùi thơm nồng thì hạ lửa ngay để tránh bị cháy đắng.';
  }

  if (/\b(rieu cua|cua dong)\b/.test(norm) && technique === 'simmer') {
    return 'Khi nước nóng già lăn tăn, thịt cua dần kết thành mảng riêu xốp mềm nổi lên trên mặt nước trong.';
  }

  switch (technique) {
    case 'prep':
      if (/\b(pha sot|hoa sot)\b/.test(norm)) {
        return 'Khuấy đều đến khi đường và gia vị tan hoàn toàn, hỗn hợp sốt sánh đồng nhất.';
      }
      return 'Nguyên liệu ráo nước, vết cắt đều tay giúp thấm vị và chín đồng nhất khi lên bếp.';
    case 'marinate':
      return 'Đảo nhẹ tay cho gia vị áo bóng đều quanh từng thớ nguyên liệu, dậy mùi thơm mắm tiêu hài hòa.';
    case 'braise':
      return 'Nước kho sôi lục bục nhẹ, chuyển màu hổ phách sánh bóng và dậy mùi mắm tiêu quyện đậm đà.';
    case 'simmer':
      if (/\b(rau|gia do|cai|mong toi)\b/.test(norm)) {
        return 'Nước canh sôi bùng trở lại, lá rau vừa chuyển màu xanh mướt chín tới là tắt bếp giữ độ ngọt giòn.';
      }
      return 'Mặt nước sôi lăn tăn trong trẻo, bọt gợn được hớt sạch và hương thơm thanh ngọt lan tỏa.';
    case 'steam':
      return 'Hơi nước bốc đều quanh nắp xửng, bề mặt món chín mọng mượt mà và giữ trọn vị ngọt tự nhiên.';
    case 'fry':
      return 'Bề mặt chuyển vàng ruộm giòn rụm, tiếng dầu sôi tí tách dịu nhỏ dần báo hiệu lớp vỏ đã ráo giòn.';
    case 'stir_fry':
      if (/\b(rau|bong cai|cai|su su|dau)\b/.test(norm)) {
        return 'Rau chuyển màu xanh ngọc bóng mượt, nghe tiếng xèo lớn đều tay — đảo nhanh để giữ độ giòn ngọt.';
      }
      return 'Nguyên liệu săn mọng trên lửa lớn, dậy mùi thơm áp chảo (wok hei) đặc trưng mà không bị ra nước.';
    case 'plate':
      return 'Món ăn bốc khói thơm lừng, sắc màu tươi tắn hài hòa — dọn nóng ngay ra mâm thưởng thức.';
  }
}

function buildStepTitleVi(technique: StepTechniqueV4, instruction: string, stepNumber: number): string {
  const norm = normalizeIngredientText(instruction);
  if (technique === 'prep' && /\b(pha sot|hoa sot)\b/.test(norm)) return 'Pha sốt chuẩn vị';
  if (technique === 'stir_fry' && /\b(phi thom|phi toi|phi hanh)\b/.test(norm) && !/\b(xao)\b/.test(norm)) {
    return 'Phi thơm dậy mùi';
  }
  return `${TECHNIQUE_LABELS_VI[technique]} (Bước ${stepNumber})`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWholeWordPhrase(haystack: string, phrase: string): boolean {
  const clean = phrase.trim();
  if (!clean) return false;
  return new RegExp(`(^| )${escapeRegex(clean)}(?=$| )`).test(haystack);
}

function extractCandidateTokens(ing: RecipeIngredient): string[] {
  const tokens = new Set<string>();
  const rawParts = ing.name.split(/[,/()&]/).map((p) => normalizeIngredientText(p)).filter(Boolean);

  for (const part of rawParts) {
    if (part.length >= 2) tokens.add(part);
    const stripped = part
      .replace(
        /\b(tuoi song|tuoi|chin|song|kho|ngon|nguyen chat|truyen thong|phu quoc|hao hang|sach|bam nho|bam nhuyen|bam|gia nhuyen|thai lat|thai mong|thai soi|thai mui cau|thai vat|thai|cat khuc|cat mieng|cat khoanh|cat|dap dap|xay|got vo|ngam no|luoc|chien vang)\b/g,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();
    if (stripped.length >= 2) tokens.add(stripped);

    const firstTwo = stripped.split(' ').slice(0, 2).join(' ');
    if (firstTwo.length >= 4) tokens.add(firstTwo);
  }

  const profile = findCulinaryIngredientV4(ing.ingredientId, ing.name);
  if (profile) {
    for (const alias of [profile.nameVi, ...profile.aliases]) {
      const cleanAlias = normalizeIngredientText(alias);
      if (cleanAlias.length >= 2) tokens.add(cleanAlias);
    }
  }

  // Broad head-noun fallbacks for unambiguous Vietnamese proteins/staples when mentioned in steps
  const idUpper = ing.ingredientId.toUpperCase();
  if (idUpper.includes('FISH') && idUpper !== 'FISH_SAUCE') tokens.add('ca');
  if (idUpper.includes('PORK_RIBS')) tokens.add('suon');
  if (idUpper === 'GROUND_PORK' || idUpper === 'PORK_BELLY') tokens.add('thit');
  if (idUpper.includes('CHICKEN') && idUpper !== 'CHICKEN_EGG') tokens.add('ga');
  if (idUpper === 'CHICKEN_EGG') tokens.add('trung');
  if (idUpper === 'BEEF_SIRLOIN') tokens.add('bo');
  if (idUpper === 'SHRIMP') tokens.add('tom');
  if (idUpper === 'SQUID') tokens.add('muc');
  if (idUpper === 'TOFU') {
    tokens.add('dau phu');
    tokens.add('dau hu');
  }
  if (idUpper === 'FISH_SAUCE') tokens.add('nuoc mam');
  if (idUpper === 'SOY_SAUCE') {
    tokens.add('nuoc tuong');
    tokens.add('xi dau');
  }
  if (idUpper === 'COOKING_OIL') tokens.add('dau an');

  return [...tokens].sort((a, b) => b.length - a.length);
}

function isDivisibleSeasoningOrAromatic(ing: RecipeIngredient): boolean {
  const profile = findCulinaryIngredientV4(ing.ingredientId, ing.name);
  if (!profile) {
    return ['ml', 'l'].includes(ing.unit);
  }
  return (
    profile.category === 'spice' ||
    profile.parentFamily === 'condiment_sauce' ||
    profile.parentFamily === 'cooking_fat' ||
    profile.parentFamily === 'allium_aromatic' ||
    profile.parentFamily === 'fresh_herb' ||
    profile.parentFamily === 'dry_spice_seasoning'
  );
}

function roundCleanQuantity(qty: number, unit: string): number {
  if (qty <= 0) return 0;
  if (unit === 'g' || unit === 'ml') {
    return qty >= 15 ? Math.round(qty) : Number(qty.toFixed(1));
  }
  if (unit === 'kg' || unit === 'l') {
    return Number(qty.toFixed(3));
  }
  return Number((Math.round(qty * 4) / 4).toFixed(2));
}

function roleLabelForStep(
  phase: CulinaryPhaseV4,
  technique: StepTechniqueV4,
  usageKind: StepIngredientAllocationV4['usageKind'],
): string {
  if (usageKind === 'prep_whole') return 'Sơ chế toàn bộ';
  if (usageKind === 'use_prepped') return 'Chế biến phần đã sơ chế';
  switch (phase) {
    case 'mise_en_place':
      return 'Chuẩn bị & pha sốt';
    case 'marinate':
      return 'Ướp thấm';
    case 'plate':
      return 'Rắc hoàn thiện';
    case 'active_cook':
      switch (technique) {
        case 'braise':
          return 'Kho dậy vị';
        case 'simmer':
          return 'Nấu thấm ngọt';
        case 'stir_fry':
          return 'Phi & xào dậy mùi';
        case 'fry':
          return 'Chiên vàng';
        case 'steam':
          return 'Hấp chín tới';
        default:
          return 'Nêm chế biến';
      }
  }
}

function allocateIngredientsAcrossSteps(
  ingredients: RecipeIngredient[],
  stepMetas: Array<{ instruction: string; phase: CulinaryPhaseV4; technique: StepTechniqueV4 }>,
): StepIngredientAllocationV4[][] {
  const perStep: StepIngredientAllocationV4[][] = stepMetas.map(() => []);
  if (!ingredients.length || !stepMetas.length) return perStep;

  const normSteps = stepMetas.map((s) => normalizeIngredientText(s.instruction));

  // Build compound multi-word phrases across recipe ingredients to avoid "ca" matching inside "ca chua" or "nuoc mam ca com"
  const compoundGuardPhrases = [
    'ca chua',
    'ca rot',
    'ca tim',
    'ca phao',
    'nuoc mam',
    'mam ca',
    'dau an',
    'dau hao',
    'dau me',
    'dau bap',
    'dau cove',
    'dau co ve',
    'dau dua',
    'dau phong',
    'hanh la',
    'hanh hoa',
    'hanh tay',
    'hanh tim',
    'hanh kho',
    'trung hoa',
  ];

  for (const ing of ingredients) {
    const candidateTokens = extractCandidateTokens(ing);
    const matchedIndices: number[] = [];

    normSteps.forEach((stepNorm, idx) => {
      const hit = candidateTokens.some((token) => {
        if (!token.includes(' ')) {
          // Mask guarded compounds that don't belong to this ingredient
          let masked = ` ${stepNorm} `;
          for (const guard of compoundGuardPhrases) {
            if (!candidateTokens.includes(guard)) {
              masked = masked.replace(new RegExp(`(^| )${escapeRegex(guard)}(?=$| )`, 'g'), ' ');
            }
          }
          return hasWholeWordPhrase(masked.trim(), token);
        }
        return hasWholeWordPhrase(stepNorm, token);
      });
      if (hit) matchedIndices.push(idx);
    });

    if (matchedIndices.length === 0) continue;

    if (matchedIndices.length === 1) {
      const stepIdx = matchedIndices[0];
      const meta = stepMetas[stepIdx];
      const usageKind: StepIngredientAllocationV4['usageKind'] =
        meta.phase === 'mise_en_place' ? 'prep_whole' : 'full_addition';
      perStep[stepIdx].push({
        ingredientId: ing.ingredientId,
        name: ing.name,
        allocatedQuantity: ing.requiredQuantity,
        totalRecipeQuantity: ing.requiredQuantity,
        unit: ing.unit,
        allocationRatio: 1,
        usageKind,
        roleLabelVi: roleLabelForStep(meta.phase, meta.technique, usageKind),
        formattedAmountVi: formatHumanCulinaryEquivalentVi(
          ing.requiredQuantity,
          ing.unit,
          ing.ingredientId,
          ing.name,
        ),
      });
      continue;
    }

    const divisible = isDivisibleSeasoningOrAromatic(ing);
    const prepIndices = matchedIndices.filter((i) => stepMetas[i].phase === 'mise_en_place');
    const actionIndices = matchedIndices.filter((i) => stepMetas[i].phase !== 'mise_en_place');

    // Case A: Non-divisible bulk ingredient (protein, vegetable, noodle) prepped in early step and cooked later
    if (!divisible && prepIndices.length > 0 && actionIndices.length > 0) {
      for (const pIdx of prepIndices) {
        perStep[pIdx].push({
          ingredientId: ing.ingredientId,
          name: ing.name,
          allocatedQuantity: ing.requiredQuantity,
          totalRecipeQuantity: ing.requiredQuantity,
          unit: ing.unit,
          allocationRatio: 1,
          usageKind: 'prep_whole',
          roleLabelVi: 'Sơ chế toàn bộ',
          formattedAmountVi: formatHumanCulinaryEquivalentVi(
            ing.requiredQuantity,
            ing.unit,
            ing.ingredientId,
            ing.name,
          ),
        });
      }
      if (actionIndices.length === 1) {
        const aIdx = actionIndices[0];
        perStep[aIdx].push({
          ingredientId: ing.ingredientId,
          name: ing.name,
          allocatedQuantity: ing.requiredQuantity,
          totalRecipeQuantity: ing.requiredQuantity,
          unit: ing.unit,
          allocationRatio: 1,
          usageKind: 'use_prepped',
          roleLabelVi: 'Chế biến phần đã sơ chế',
          formattedAmountVi: formatHumanCulinaryEquivalentVi(
            ing.requiredQuantity,
            ing.unit,
            ing.ingredientId,
            ing.name,
          ),
        });
        continue;
      }
      // Multiple active cook steps for bulk item -> split across active cook steps
      distributePortions(ing, actionIndices, stepMetas, perStep);
      continue;
    }

    // Case B: Divisible seasoning/aromatic prepped in mise_en_place (not pha sốt) + used in active steps
    const saucePrepIndices = prepIndices.filter((i) =>
      /\b(pha sot|hoa sot|pha nuoc mam|tron com)\b/.test(normSteps[i]),
    );
    const pureChopIndices = prepIndices.filter((i) => !saucePrepIndices.includes(i));
    const consumptiveIndices = [...saucePrepIndices, ...actionIndices];

    if (pureChopIndices.length > 0 && consumptiveIndices.length > 0) {
      for (const pIdx of pureChopIndices) {
        perStep[pIdx].push({
          ingredientId: ing.ingredientId,
          name: ing.name,
          allocatedQuantity: ing.requiredQuantity,
          totalRecipeQuantity: ing.requiredQuantity,
          unit: ing.unit,
          allocationRatio: 1,
          usageKind: 'prep_whole',
          roleLabelVi: 'Sơ chế sẵn',
          formattedAmountVi: formatHumanCulinaryEquivalentVi(
            ing.requiredQuantity,
            ing.unit,
            ing.ingredientId,
            ing.name,
          ),
        });
      }
      if (consumptiveIndices.length === 1) {
        const cIdx = consumptiveIndices[0];
        const meta = stepMetas[cIdx];
        perStep[cIdx].push({
          ingredientId: ing.ingredientId,
          name: ing.name,
          allocatedQuantity: ing.requiredQuantity,
          totalRecipeQuantity: ing.requiredQuantity,
          unit: ing.unit,
          allocationRatio: 1,
          usageKind: 'use_prepped',
          roleLabelVi: roleLabelForStep(meta.phase, meta.technique, 'full_addition'),
          formattedAmountVi: formatHumanCulinaryEquivalentVi(
            ing.requiredQuantity,
            ing.unit,
            ing.ingredientId,
            ing.name,
          ),
        });
      } else {
        distributePortions(ing, consumptiveIndices, stepMetas, perStep);
      }
      continue;
    }

    // Case C: Multi-step consumptive split (e.g., 1/3 Marinate + 2/3 Braise/Simmer!)
    distributePortions(ing, matchedIndices, stepMetas, perStep);
  }

  return perStep;
}

function distributePortions(
  ing: RecipeIngredient,
  stepIndices: number[],
  stepMetas: Array<{ instruction: string; phase: CulinaryPhaseV4; technique: StepTechniqueV4 }>,
  perStep: StepIngredientAllocationV4[][],
): void {
  const weights = stepIndices.map((idx) => {
    const meta = stepMetas[idx];
    if (meta.phase === 'marinate') return 1;
    if (meta.phase === 'plate') return 1;
    if (meta.phase === 'active_cook') {
      if (meta.technique === 'braise' || meta.technique === 'simmer') return 2;
      return 2;
    }
    return 1;
  });

  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1;
  const rawAllocations = weights.map((w) => (ing.requiredQuantity * w) / totalWeight);
  const rounded = rawAllocations.map((q) => roundCleanQuantity(q, ing.unit));

  // Adjust largest bucket so allocated quantities sum cleanly to totalRecipeQuantity
  const currentSum = rounded.reduce((acc, q) => acc + q, 0);
  const diff = Number((ing.requiredQuantity - currentSum).toFixed(4));
  if (Math.abs(diff) > 1e-4 && rounded.length > 0) {
    let maxPos = 0;
    for (let i = 1; i < weights.length; i++) {
      if (weights[i] >= weights[maxPos]) maxPos = i;
    }
    rounded[maxPos] = Math.max(0, Number((rounded[maxPos] + diff).toFixed(3)));
  }

  stepIndices.forEach((stepIdx, pos) => {
    const qty = rounded[pos];
    const ratio = ing.requiredQuantity > 0 ? Number((qty / ing.requiredQuantity).toFixed(2)) : 1;
    const meta = stepMetas[stepIdx];
    perStep[stepIdx].push({
      ingredientId: ing.ingredientId,
      name: ing.name,
      allocatedQuantity: qty,
      totalRecipeQuantity: ing.requiredQuantity,
      unit: ing.unit,
      allocationRatio: ratio,
      usageKind: 'split_portion',
      roleLabelVi: roleLabelForStep(meta.phase, meta.technique, 'split_portion'),
      formattedAmountVi: formatHumanCulinaryEquivalentVi(qty, ing.unit, ing.ingredientId, ing.name),
    });
  });
}

function estimateStepDurationMinutes(
  instruction: string,
  technique: StepTechniqueV4,
  explicitTimerMinutes?: number,
): { durationMinutes: number; isPassiveWait: boolean } {
  if (explicitTimerMinutes && explicitTimerMinutes > 0) {
    const isPassive =
      technique === 'braise' ||
      technique === 'steam' ||
      (technique === 'simmer' && explicitTimerMinutes >= 5) ||
      technique === 'marinate';
    return { durationMinutes: explicitTimerMinutes, isPassiveWait: isPassive };
  }

  // Extract explicit inline minutes in Vietnamese instruction (e.g. "ướp ... trong 10 phút")
  const norm = normalizeIngredientText(instruction);
  const match = /(\d+)\s*phut/.exec(norm);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 180) {
      const isPassive =
        technique === 'marinate' ||
        technique === 'braise' ||
        technique === 'steam' ||
        (technique === 'simmer' && parsed >= 5);
      return { durationMinutes: parsed, isPassiveWait: isPassive };
    }
  }

  switch (technique) {
    case 'prep':
      return { durationMinutes: 4, isPassiveWait: false };
    case 'marinate':
      return { durationMinutes: 10, isPassiveWait: true };
    case 'braise':
      return { durationMinutes: 12, isPassiveWait: true };
    case 'simmer':
      return { durationMinutes: 6, isPassiveWait: false };
    case 'steam':
      return { durationMinutes: 10, isPassiveWait: true };
    case 'fry':
      return { durationMinutes: 5, isPassiveWait: false };
    case 'stir_fry':
      return { durationMinutes: 3, isPassiveWait: false };
    case 'plate':
      return { durationMinutes: 2, isPassiveWait: false };
  }
}

function computeEstimatedNutrition(recipe: Recipe): RecipeNutritionV4 {
  if (
    recipe.nutrition &&
    Number.isFinite(recipe.nutrition.calories) &&
    recipe.nutrition.calories > 0
  ) {
    return {
      calories: Math.round(recipe.nutrition.calories),
      proteinG: Math.round(recipe.nutrition.proteinG),
      fatG: Math.round(recipe.nutrition.fatG),
      carbG: Math.round(recipe.nutrition.carbG),
      source: 'recipe_declared',
    };
  }

  let totalKcal = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarb = 0;

  for (const ing of recipe.ingredients) {
    const profile = findCulinaryIngredientV4(ing.ingredientId, ing.name);
    if (!profile) continue;
    const toGrams = convertCulinaryQuantity({
      quantity: ing.requiredQuantity,
      fromUnit: ing.unit,
      toUnit: 'g',
      ingredientId: profile.id,
      ingredientName: ing.name,
    });
    const grams = toGrams?.convertedQuantity ?? (ing.unit === 'g' ? ing.requiredQuantity : 50);
    // Frying oil absorption factor: only ~45% of deep-fry oil is retained when > 40ml
    const retention =
      profile.parentFamily === 'cooking_fat' && grams > 40 ? 0.45 : 1.0;
    const factor = (grams * retention) / 100;
    totalKcal += profile.macrosPer100g.kcal * factor;
    totalProtein += profile.macrosPer100g.proteinG * factor;
    totalFat += profile.macrosPer100g.fatG * factor;
    totalCarb += profile.macrosPer100g.carbG * factor;
  }

  const servings = Math.max(1, recipe.servings || 2);
  return {
    calories: Math.max(85, Math.round(totalKcal / servings)),
    proteinG: Math.max(2, Math.round(totalProtein / servings)),
    fatG: Math.max(1, Math.round(totalFat / servings)),
    carbG: Math.max(2, Math.round(totalCarb / servings)),
    source: 'ingredient_estimated',
  };
}

/**
 * Deterministically upgrades ANY V1/D1 `Recipe` into a rich `RecipeV4` culinary blueprint
 * with 4-phase DAG steps, exact per-step ingredient allocations, cookware/heat/sensory cues,
 * guaranteed non-null prep/active/passive timings, estimated nutrition, and V4 dish artwork.
 */
export function enrichRecipeToV4(recipe: Recipe): RecipeV4 {
  const totalSteps = recipe.steps.length;
  const preliminaryMetas = recipe.steps.map((step, idx) => {
    const technique = inferStepTechniqueV4(step.instruction, idx, totalSteps, recipe.category);
    const phase = inferPhaseFromTechnique(technique);
    return { instruction: step.instruction, phase, technique };
  });

  const allocationsByStep = allocateIngredientsAcrossSteps(recipe.ingredients, preliminaryMetas);
  const equipmentSeen = new Set<StepCookwareV4>();
  const equipmentList: EquipmentItemV4[] = [];

  const enrichedSteps: RecipeStepV4[] = recipe.steps.map((step, idx) => {
    const { phase, technique } = preliminaryMetas[idx];
    const cookware = inferCookwareV4(technique, step.instruction);
    const heatLevel = inferHeatLevelV4(technique, step.instruction, step.timerMinutes);
    const sensoryCue = inferSensoryCueVi(technique, step.instruction);
    const { durationMinutes, isPassiveWait } = estimateStepDurationMinutes(
      step.instruction,
      technique,
      step.timerMinutes,
    );

    if (!equipmentSeen.has(cookware)) {
      equipmentSeen.add(cookware);
      equipmentList.push(COOKWARE_META[cookware]);
    }

    const dependsOnStepNumbers: number[] = idx === 0 ? [] : [recipe.steps[idx - 1].stepNumber];

    return {
      ...step,
      titleVi: buildStepTitleVi(technique, step.instruction, step.stepNumber),
      phase,
      phaseLabelVi: PHASE_LABELS_VI[phase],
      technique,
      techniqueLabelVi: TECHNIQUE_LABELS_VI[technique],
      cookware,
      cookwareLabelVi: COOKWARE_META[cookware].labelVi,
      heatLevel,
      heatLabelVi: HEAT_LABELS_VI[heatLevel],
      sensoryCue,
      stepIngredients: allocationsByStep[idx] ?? [],
      estimatedDurationMinutes: durationMinutes,
      isPassiveWait,
      dependsOnStepNumbers,
    };
  });

  if (equipmentList.length === 0) {
    equipmentList.push(COOKWARE_META.prep_board);
  }

  // Compute realistic, never-null prep, active cook, and passive simmer minutes
  const rawPrepFromSteps = enrichedSteps
    .filter((s) => s.phase === 'mise_en_place')
    .reduce((sum, s) => sum + s.estimatedDurationMinutes, 0);
  const basePrepFloor =
    recipe.difficulty === 'hard' ? 15 : recipe.difficulty === 'medium' ? 8 : 5;
  const ingredientPrepEstimate = Math.max(4, Math.ceil(recipe.ingredients.length * 1.5));
  const prepTimeMinutes = Math.max(basePrepFloor, rawPrepFromSteps || ingredientPrepEstimate);

  const passiveSimmerMinutes = enrichedSteps
    .filter((s) => s.isPassiveWait)
    .reduce((sum, s) => sum + s.estimatedDurationMinutes, 0);

  const rawActiveCook = enrichedSteps
    .filter((s) => !s.isPassiveWait && s.phase !== 'mise_en_place')
    .reduce((sum, s) => sum + s.estimatedDurationMinutes, 0);

  const declaredCook = Math.max(5, recipe.cookTimeMinutes || 15);
  const activeCookTimeMinutes = Math.max(
    3,
    rawActiveCook > 0 ? rawActiveCook : Math.max(3, declaredCook - passiveSimmerMinutes),
  );

  const totalTimeMinutes = prepTimeMinutes + activeCookTimeMinutes + passiveSimmerMinutes;
  const estimatedNutrition = computeEstimatedNutrition(recipe);
  const artwork = resolveRecipeArtworkV4(recipe);

  return {
    ...recipe,
    v4SchemaVersion: 4,
    baseServings: Math.max(1, recipe.servings || 2),
    prepTimeMinutes,
    activeCookTimeMinutes,
    passiveSimmerMinutes,
    totalTimeMinutes,
    steps: enrichedSteps,
    equipmentList,
    estimatedNutrition,
    nutrition: recipe.nutrition ?? {
      calories: estimatedNutrition.calories,
      proteinG: estimatedNutrition.proteinG,
      fatG: estimatedNutrition.fatG,
      carbG: estimatedNutrition.carbG,
    },
    artwork,
  };
}
