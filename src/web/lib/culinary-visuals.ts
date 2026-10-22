import type { Recipe, RecipeIngredient } from '@frigo/recipes';

export type CulinaryTechniqueId =
  | 'prep'
  | 'marinate'
  | 'saute'
  | 'simmer'
  | 'boil'
  | 'steam'
  | 'fry'
  | 'season'
  | 'plate'
  | 'general';

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
    heatLabel: 'Canh nhiệt theo bước',
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
    label: 'Đun sôi, nấu canh & luộc',
    shortLabel: 'Nấu sôi / luộc',
    heatLabel: 'Lửa vừa giữ sôi',
    toolLabel: 'Nồi canh / nồi luộc',
    accentTone: 'green',
  },
  steam: {
    id: 'steam',
    label: 'Hấp & chưng cách thủy',
    shortLabel: 'Hấp / chưng',
    heatLabel: 'Giữ hơi nước sôi đều',
    toolLabel: 'Xửng hấp / nồi hấp',
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
  general: {
    id: 'general',
    label: 'Thao tác theo bước',
    shortLabel: 'Thực hiện',
    heatLabel: 'Theo hướng dẫn bước nấu',
    toolLabel: 'Dụng cụ theo hướng dẫn',
    accentTone: 'navy',
  },
};

function normalizeVi(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeAccentedTokens(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWholePhrase(haystack: string, phrase: string): boolean {
  const clean = phrase.trim();
  if (!clean) return false;
  return new RegExp(`(^| )${escapeRegex(clean)}(?=$| )`).test(haystack);
}

function stripSecondaryModifiers(normText: string): string {
  return normText
    .replace(
      /\b(da|vua|sau khi)\s+(uop|so che|rua sach|rua|cat khuc|cat|thai lat|thai|bam nho|bam|luoc chin|luoc|chien so|chien|hap|chan qua|chan|de rao)\b/g,
      ' ',
    )
    .replace(
      /\b(toi|hanh|hanh tim|hanh la|gung|ot|sa|rieng|nghe|ca chua|thit|ca)\s+(bam nho|bam|thai lat|thai nho|thai soi|thai mui cau|cat khuc|cat lat|dap dap|xay)\b/g,
      '$1',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function matchTechniqueFromClause(clause: string, isFinalStep: boolean): CulinaryTechniqueMeta | null {
  if (!clause) return null;

  if (/\b(muc ra|don ra|trinh bay|thuong thuc|cho ra dia|cho ra to|xep ra dia|bay ra dia)\b/.test(clause)) {
    return TECHNIQUE_META.plate;
  }
  if (
    isFinalStep &&
    /\b(rac hanh|rac tieu|rac ngo|tat bep)\b/.test(clause) &&
    !/\b(xao|chien|kho|rim|ninh|ham|dun soi|nau canh|luoc|hap)\b/.test(clause)
  ) {
    return TECHNIQUE_META.plate;
  }
  if (/\b(hap cach thuy|chung cach thuy|xung hap|cho vao hap|hap chin|hap)\b/.test(clause)) {
    return TECHNIQUE_META.steam;
  }
  if (/\b(chien vang|chien gion|chien|ran|ap chao)\b/.test(clause)) {
    return TECHNIQUE_META.fry;
  }
  if (/\b(phi thom|phi hanh|phi toi|xao san|xao nhanh|xao|dao deu tren lua|dao nhanh)\b/.test(clause)) {
    return TECHNIQUE_META.saute;
  }
  if (/\b(kho|rim|ninh|ham|om|sot sanh|dun liu riu|nau liu riu)\b/.test(clause)) {
    return TECHNIQUE_META.simmer;
  }
  if (/\b(dun soi|nau canh|luoc|chan qua|nuoc dung|hot bot|nau soi)\b/.test(clause)) {
    return TECHNIQUE_META.boil;
  }
  if (/\b(uop|tham gia vi|tron deu gia vi|de tham)\b/.test(clause)) {
    return TECHNIQUE_META.marinate;
  }
  if (/\b(nem nem|nem lai|vua an|pha nuoc mam|pha sot|tron goi|nem gia vi)\b/.test(clause)) {
    return TECHNIQUE_META.season;
  }
  if (
    /\b(rua sach|cat khuc|thai lat|thai mui cau|cat|thai|bam nho|bam|got vo|got|lot vo|so che|ngam nuoc|ngam|de rao|dap dap)\b/.test(
      clause,
    )
  ) {
    return TECHNIQUE_META.prep;
  }
  return null;
}

export function resolveStepTechnique(
  instruction: string,
  title?: string,
  stepIndex = 0,
  totalSteps = 1,
): CulinaryTechniqueMeta {
  const isFinalStep = totalSteps > 1 && stepIndex === totalSteps - 1;
  const normTitle = title ? normalizeVi(title) : '';
  const normInstruction = normalizeVi(instruction);

  if (normTitle) {
    const titleHit = matchTechniqueFromClause(stripSecondaryModifiers(normTitle), isFinalStep);
    if (titleHit) return titleHit;
  }

  const activeClause = stripSecondaryModifiers(normInstruction);
  const activeHit = matchTechniqueFromClause(activeClause, isFinalStep);
  if (activeHit) return activeHit;

  const rawHit = matchTechniqueFromClause(normInstruction, isFinalStep);
  if (rawHit) return rawHit;

  return TECHNIQUE_META.general;
}

const PREP_SUFFIX_REGEX =
  /\s+(bam nho|bam|thai lat|thai nho|thai soi|thai mui cau|thai|cat khuc|cat lat|cat|xay|dap dap|tuoi|kho|chin|song|lam sach|sach|hat luu|soi)$/;

const UNAMBIGUOUS_FOLDED_STEMS = new Set([
  'toi', 'gung', 'sa', 'ot', 'nghe', 'rieng', 'me', 'tieu', 'muoi', 'duong',
  'trung', 'sua', 'mi', 'bun', 'pho', 'mien', 'nam', 'tom', 'muc', 'cua', 'ngheu', 'so',
]);

const UNAMBIGUOUS_ACCENTED_HEADS = new Set([
  'cá', 'thịt', 'gà', 'bò', 'tôm', 'mực', 'trứng', 'nấm', 'đậu', 'bún', 'phở', 'miến',
]);

export function matchStepIngredients(
  instruction: string,
  ingredients: RecipeIngredient[],
): RecipeIngredient[] {
  if (!instruction || !ingredients?.length) return [];
  const normInst = normalizeVi(instruction);
  const accentedInst = normalizeAccentedTokens(instruction);
  if (!normInst) return [];

  // Collect multi-word ingredient phrases present in this recipe so single-word
  // ingredients/heads (e.g. "Hành", "Cá") do not falsely match inside a compound
  // ingredient phrase (e.g. "hành lá", "cá lóc") unless mentioned separately.
  const multiWordFoldedPhrases = ingredients
    .flatMap((ing) =>
      ing.name
        .split(/[,/()]/)
        .map((s) => normalizeVi(s))
        .filter((s) => s.includes(' ')),
    )
    .sort((a, b) => b.length - a.length);

  const multiWordAccentedPhrases = ingredients
    .flatMap((ing) =>
      ing.name
        .split(/[,/()]/)
        .map((s) => normalizeAccentedTokens(s))
        .filter((s) => s.includes(' ')),
    )
    .sort((a, b) => b.length - a.length);

  const maskCompoundPhrases = (text: string, phrases: string[], allowPhrase?: string): string => {
    let masked = ` ${text} `;
    for (const phrase of phrases) {
      if (allowPhrase && phrase === allowPhrase) continue;
      masked = masked.replace(new RegExp(`(^| )${escapeRegex(phrase)}(?=$| )`, 'g'), ' ');
    }
    return masked.trim();
  };

  const matched: RecipeIngredient[] = [];

  for (const ing of ingredients) {
    const cleanName = ing.name.trim();
    if (!cleanName) continue;

    const foldedSegments = cleanName
      .split(/[,/()]/)
      .map((s) => normalizeVi(s))
      .filter((s) => s.length >= 2);

    const accentedSegments = cleanName
      .split(/[,/()]/)
      .map((s) => normalizeAccentedTokens(s))
      .filter((s) => s.length >= 2);

    let isHit = foldedSegments.some((segment) => {
      const targetText = segment.includes(' ')
        ? normInst
        : maskCompoundPhrases(normInst, multiWordFoldedPhrases);
      if (hasWholePhrase(targetText, segment)) return true;

      const stem = segment.replace(PREP_SUFFIX_REGEX, '').trim();
      if (stem && stem !== segment) {
        if (stem.includes(' ') || UNAMBIGUOUS_FOLDED_STEMS.has(stem)) {
          const stemTarget = stem.includes(' ')
            ? normInst
            : maskCompoundPhrases(normInst, multiWordFoldedPhrases, segment);
          if (hasWholePhrase(stemTarget, stem)) return true;
        }
      }
      return false;
    });

    if (!isHit) {
      isHit = accentedSegments.some((accSeg) => {
        const targetAccented = accSeg.includes(' ')
          ? accentedInst
          : maskCompoundPhrases(accentedInst, multiWordAccentedPhrases);
        if (hasWholePhrase(targetAccented, accSeg)) return true;
        const firstWord = accSeg.split(' ')[0];
        if (firstWord && UNAMBIGUOUS_ACCENTED_HEADS.has(firstWord)) {
          const headTarget = maskCompoundPhrases(accentedInst, multiWordAccentedPhrases, accSeg);
          return hasWholePhrase(headTarget, firstWord);
        }
        return false;
      });
    }

    if (isHit) {
      matched.push(ing);
    }
  }
  return matched;
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
    if (tech.id !== 'general' && !seen.has(tech.id)) {
      seen.add(tech.id);
      list.push(tech);
    }
  });
  return list.slice(0, 4);
}
