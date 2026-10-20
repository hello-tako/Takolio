import type { Recipe, RecipeIngredient } from '@frigo/recipes';

export type CulinaryTechniqueId =
  | 'prep'
  | 'marinate'
  | 'saute'
  | 'simmer'
  | 'boil'
  | 'fry'
  | 'season'
  | 'plate';

export interface CulinaryTechniqueMeta {
  id: CulinaryTechniqueId;
  label: string;
  shortLabel: string;
  heatLabel: string;
  toolLabel: string;
  accentTone: 'green' | 'coral' | 'gold' | 'navy';
}

const TECHNIQUE_META: Record<CulinaryTechniqueId, CulinaryTechniqueMeta> = {
  prep: {
    id: 'prep',
    label: 'Sơ chế & cắt thái',
    shortLabel: 'Sơ chế',
    heatLabel: 'Chuẩn bị nguội',
    toolLabel: 'Dao & thớt sạch',
    accentTone: 'green',
  },
  marinate: {
    id: 'marinate',
    label: 'Ướp & thấm gia vị',
    shortLabel: 'Ướp vị',
    heatLabel: 'Để thấm tự nhiên',
    toolLabel: 'Tô trộn & đũa',
    accentTone: 'gold',
  },
  saute: {
    id: 'saute',
    label: 'Phi thơm & xào đảo',
    shortLabel: 'Phi & xào',
    heatLabel: 'Lửa vừa đến lớn',
    toolLabel: 'Chảo sâu lòng',
    accentTone: 'coral',
  },
  simmer: {
    id: 'simmer',
    label: 'Kho, rim & ninh thấm',
    shortLabel: 'Kho / ninh',
    heatLabel: 'Lửa nhỏ liu riu',
    toolLabel: 'Nồi kho / nồi đáy dày',
    accentTone: 'coral',
  },
  boil: {
    id: 'boil',
    label: 'Nấu canh, luộc & hấp',
    shortLabel: 'Nấu sôi / hấp',
    heatLabel: 'Lửa vừa giữ sôi',
    toolLabel: 'Nồi canh / xửng hấp',
    accentTone: 'green',
  },
  fry: {
    id: 'fry',
    label: 'Chiên vàng & áp chảo',
    shortLabel: 'Chiên / áp chảo',
    heatLabel: 'Lửa vừa ổn định',
    toolLabel: 'Chảo chống dính',
    accentTone: 'gold',
  },
  season: {
    id: 'season',
    label: 'Nêm nếm & cân bằng vị',
    shortLabel: 'Nêm nếm',
    heatLabel: 'Điều chỉnh cuối bước',
    toolLabel: 'Muỗng nếm',
    accentTone: 'navy',
  },
  plate: {
    id: 'plate',
    label: 'Trình bày & thưởng thức',
    shortLabel: 'Hoàn thiện',
    heatLabel: 'Dọn nóng ra bàn',
    toolLabel: 'Tô / đĩa trình bày',
    accentTone: 'green',
  },
};

function normalizeVi(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

/**
 * Deterministically classifies a cooking step into a visual culinary technique
 * based on Vietnamese kitchen verbs and step position.
 */
export function resolveStepTechnique(
  instruction: string,
  title?: string,
  stepIndex = 0,
  totalSteps = 1,
): CulinaryTechniqueMeta {
  const combined = `${title ?? ''} ${instruction}`.toLowerCase();
  const norm = normalizeVi(combined);

  if (
    stepIndex === totalSteps - 1 &&
    totalSteps > 1 &&
    /\b(muc ra|don ra|trinh bay|rac hanh|rac tieu|thuong thuc|cho ra dia|cho ra to|tat bep)\b/.test(
      norm,
    )
  ) {
    return TECHNIQUE_META.plate;
  }
  if (/\b(uop|tham gia vi|tron deu gia vi|de tham)\b/.test(norm)) {
    return TECHNIQUE_META.marinate;
  }
  if (/\b(chien|ran|ap chao|vang gion)\b/.test(norm)) {
    return TECHNIQUE_META.fry;
  }
  if (/\b(kho|rim|ninh|ham|om|sot sanh|lua nho)\b/.test(norm)) {
    return TECHNIQUE_META.simmer;
  }
  if (/\b(phi thom|phi hanh|phi toi|xao|dao deu trên lua|dao nhanh)\b/.test(norm)) {
    return TECHNIQUE_META.saute;
  }
  if (/\b(dun soi|nau canh|luoc|hap|chan qua|nuoc dung|hot bot)\b/.test(norm)) {
    return TECHNIQUE_META.boil;
  }
  if (/\b(nem nem|nem lai|vua an|pha nuoc mam|pha sot|tron goi)\b/.test(norm)) {
    return TECHNIQUE_META.season;
  }
  if (
    /\b(rua sach|cat|thai|bam|got|lot vo|so che|ngam|de rao|dap dap|cat khuc|thai lat)\b/.test(
      norm,
    )
  ) {
    return TECHNIQUE_META.prep;
  }

  if (stepIndex === 0) return TECHNIQUE_META.prep;
  if (stepIndex === totalSteps - 1 && totalSteps > 2) return TECHNIQUE_META.plate;
  return TECHNIQUE_META.saute;
}

/**
 * Matches recipe ingredients mentioned in a specific step instruction so cooks
 * can see exact quantities and icons inline without switching tabs.
 */
export function matchStepIngredients(
  instruction: string,
  ingredients: RecipeIngredient[],
): RecipeIngredient[] {
  if (!instruction || !ingredients?.length) return [];
  const normInstruction = normalizeVi(instruction);
  const matched: RecipeIngredient[] = [];

  for (const ing of ingredients) {
    const cleanName = ing.name.trim();
    if (!cleanName) continue;
    const normName = normalizeVi(cleanName);
    const primaryTokens = normName
      .split(/[,/()]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);

    const isHit = primaryTokens.some((token) => normInstruction.includes(token));
    if (isHit) {
      matched.push(ing);
    }
  }
  return matched.slice(0, 5);
}

export function formatDifficultyLabel(difficulty?: Recipe['difficulty'] | string): {
  label: string;
  description: string;
} {
  switch (difficulty) {
    case 'easy':
      return { label: 'Dễ nấu', description: 'Thao tác gọn, hợp bữa gia đình hằng ngày' };
    case 'medium':
      return { label: 'Vừa phải', description: 'Cần canh lửa và nêm nếm theo từng bước' };
    case 'hard':
      return { label: 'Cầu kỳ', description: 'Nhiều công đoạn sơ chế và canh nhiệt kỹ' };
    default:
      return { label: 'Chuẩn bếp nhà', description: 'Hướng dẫn từng bước rõ ràng' };
  }
}

export function summarizeRecipeTechniques(recipe: Pick<Recipe, 'steps'>): CulinaryTechniqueMeta[] {
  const seen = new Set<CulinaryTechniqueId>();
  const list: CulinaryTechniqueMeta[] = [];
  const total = recipe.steps.length;
  recipe.steps.forEach((step, idx) => {
    const stepTitle = 'title' in step && typeof step.title === 'string' ? step.title : undefined;
    const tech = resolveStepTechnique(step.instruction, stepTitle, idx, total);
    if (!seen.has(tech.id)) {
      seen.add(tech.id);
      list.push(tech);
    }
  });
  return list.slice(0, 4);
}
