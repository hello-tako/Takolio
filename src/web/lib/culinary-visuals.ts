import type { Recipe, RecipeIngredient } from '@frigo/recipes';
import type { SupportedLocale } from '../../shared/locales';
import { lSync } from '../i18n/app-i18n';

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

function getTechniqueMeta(
  id: CulinaryTechniqueId,
  locale?: SupportedLocale,
): CulinaryTechniqueMeta {
  switch (id) {
    case 'prep':
      return {
        id: 'prep',
        label: lSync('Sơ chế & cắt thái', 'Prep & Chop', locale),
        shortLabel: lSync('Sơ chế', 'Prep', locale),
        heatLabel: lSync('Chuẩn bị nguội', 'Cold prep', locale),
        toolLabel: lSync('Dao & thớt sạch', 'Knife & cutting board', locale),
        accentTone: 'green',
      };
    case 'marinate':
      return {
        id: 'marinate',
        label: lSync('Ướp & thấm gia vị', 'Marinate & Season', locale),
        shortLabel: lSync('Ướp vị', 'Marinate', locale),
        heatLabel: lSync('Để thấm tự nhiên', 'Rest to infuse', locale),
        toolLabel: lSync('Tô trộn & đũa', 'Mixing bowl & chopsticks', locale),
        accentTone: 'gold',
      };
    case 'saute':
      return {
        id: 'saute',
        label: lSync('Phi thơm & xào đảo', 'Sauté & Stir-fry', locale),
        shortLabel: lSync('Phi & xào', 'Sauté', locale),
        heatLabel: lSync('Canh nhiệt theo bước', 'Adjust heat per step', locale),
        toolLabel: lSync('Chảo sâu lòng', 'Wok or deep skillet', locale),
        accentTone: 'coral',
      };
    case 'simmer':
      return {
        id: 'simmer',
        label: lSync('Kho, rim & ninh thấm', 'Braise & Simmer', locale),
        shortLabel: lSync('Kho / ninh', 'Simmer', locale),
        heatLabel: lSync('Lửa nhỏ liu riu', 'Low gentle simmer', locale),
        toolLabel: lSync('Nồi kho / nồi đáy dày', 'Heavy-bottom pot', locale),
        accentTone: 'coral',
      };
    case 'boil':
      return {
        id: 'boil',
        label: lSync('Đun sôi, nấu canh & luộc', 'Boil & Soup', locale),
        shortLabel: lSync('Nấu sôi / luộc', 'Boil', locale),
        heatLabel: lSync('Lửa vừa giữ sôi', 'Medium steady boil', locale),
        toolLabel: lSync('Nồi canh / nồi luộc', 'Soup pot', locale),
        accentTone: 'green',
      };
    case 'steam':
      return {
        id: 'steam',
        label: lSync('Hấp & chưng cách thủy', 'Steam', locale),
        shortLabel: lSync('Hấp / chưng', 'Steam', locale),
        heatLabel: lSync('Giữ hơi nước sôi đều', 'Steady steam', locale),
        toolLabel: lSync('Xửng hấp / nồi hấp', 'Steamer basket', locale),
        accentTone: 'green',
      };
    case 'fry':
      return {
        id: 'fry',
        label: lSync('Chiên vàng & áp chảo', 'Pan-fry & Sear', locale),
        shortLabel: lSync('Chiên / áp chảo', 'Pan-fry', locale),
        heatLabel: lSync('Lửa vừa ổn định', 'Steady medium heat', locale),
        toolLabel: lSync('Chảo chống dính', 'Non-stick skillet', locale),
        accentTone: 'gold',
      };
    case 'season':
      return {
        id: 'season',
        label: lSync('Nêm nếm & cân bằng vị', 'Season & Taste', locale),
        shortLabel: lSync('Nêm nếm', 'Season', locale),
        heatLabel: lSync('Điều chỉnh cuối bước', 'Finish & taste', locale),
        toolLabel: lSync('Muỗng nếm', 'Tasting spoon', locale),
        accentTone: 'navy',
      };
    case 'plate':
      return {
        id: 'plate',
        label: lSync('Trình bày & thưởng thức', 'Plate & Serve', locale),
        shortLabel: lSync('Hoàn thiện', 'Serve', locale),
        heatLabel: lSync('Dọn nóng ra bàn', 'Serve hot', locale),
        toolLabel: lSync('Tô / đĩa trình bày', 'Serving bowl / plate', locale),
        accentTone: 'green',
      };
    case 'general':
    default:
      return {
        id: 'general',
        label: lSync('Thao tác theo bước', 'Step Action', locale),
        shortLabel: lSync('Thực hiện', 'Cook', locale),
        heatLabel: lSync('Theo hướng dẫn bước nấu', 'Follow step heat guide', locale),
        toolLabel: lSync('Dụng cụ theo hướng dẫn', 'Kitchen tools as directed', locale),
        accentTone: 'navy',
      };
  }
}

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

function matchTechniqueFromClause(clause: string, isFinalStep: boolean): CulinaryTechniqueId | null {
  if (!clause) return null;

  if (/\b(muc ra|don ra|trinh bay|thuong thuc|cho ra dia|cho ra to|xep ra dia|bay ra dia|serve hot|plate and serve|garnish and serve)\b/.test(clause)) {
    return 'plate';
  }
  if (
    isFinalStep &&
    /\b(rac hanh|rac tieu|rac ngo|tat bep|serve|garnish)\b/.test(clause) &&
    !/\b(xao|chien|kho|rim|ninh|ham|dun soi|nau canh|luoc|hap|saute|stir fry|simmer|braise|boil|steam)\b/.test(clause)
  ) {
    return 'plate';
  }
  if (/\b(hap cach thuy|chung cach thuy|xung hap|cho vao hap|hap chin|hap|steam)\b/.test(clause)) {
    return 'steam';
  }
  if (/\b(chien vang|chien gion|chien|ran|ap chao|pan fry|sear|deep fry)\b/.test(clause)) {
    return 'fry';
  }
  if (/\b(phi thom|phi hanh|phi toi|xao san|xao nhanh|xao|dao deu tren lua|dao nhanh|saute|stir fry)\b/.test(clause)) {
    return 'saute';
  }
  if (/\b(kho|rim|ninh|ham|om|sot sanh|dun liu riu|nau liu riu|simmer|braise)\b/.test(clause)) {
    return 'simmer';
  }
  if (/\b(dun soi|nau canh|luoc|chan qua|nuoc dung|hot bot|nau soi|boil|blanch)\b/.test(clause)) {
    return 'boil';
  }
  if (/\b(uop|tham gia vi|tron deu gia vi|de tham|marinate)\b/.test(clause)) {
    return 'marinate';
  }
  if (/\b(nem nem|nem lai|vua an|pha nuoc mam|pha sot|tron goi|nem gia vi|taste and adjust|season)\b/.test(clause)) {
    return 'season';
  }
  if (
    /\b(rua sach|cat khuc|thai lat|thai mui cau|cat|thai|bam nho|bam|got vo|got|lot vo|so che|ngam nuoc|ngam|de rao|dap dap|prep|chop|slice|mince|rinse|measure)\b/.test(
      clause,
    )
  ) {
    return 'prep';
  }
  return null;
}

export function resolveStepTechnique(
  instruction: string,
  title?: string,
  stepIndex = 0,
  totalSteps = 1,
  locale?: SupportedLocale,
): CulinaryTechniqueMeta {
  const isFinalStep = totalSteps > 1 && stepIndex === totalSteps - 1;
  const normTitle = title ? normalizeVi(title) : '';
  const normInstruction = normalizeVi(instruction);

  if (normTitle) {
    const titleHit = matchTechniqueFromClause(stripSecondaryModifiers(normTitle), isFinalStep);
    if (titleHit) return getTechniqueMeta(titleHit, locale);
  }

  const activeClause = stripSecondaryModifiers(normInstruction);
  const activeHit = matchTechniqueFromClause(activeClause, isFinalStep);
  if (activeHit) return getTechniqueMeta(activeHit, locale);

  const rawHit = matchTechniqueFromClause(normInstruction, isFinalStep);
  if (rawHit) return getTechniqueMeta(rawHit, locale);

  return getTechniqueMeta('general', locale);
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

export function formatDifficultyLabel(
  difficulty?: Recipe['difficulty'] | string,
  locale?: SupportedLocale,
): {
  label: string;
  description: string;
} {
  switch (difficulty) {
    case 'easy':
      return {
        label: lSync('Dễ nấu', 'Easy', locale),
        description: lSync(
          'Thao tác gọn, hợp bữa gia đình hằng ngày',
          'Simple steps, ideal for everyday family meals',
          locale,
        ),
      };
    case 'medium':
      return {
        label: lSync('Vừa phải', 'Medium', locale),
        description: lSync(
          'Cần canh lửa và nêm nếm theo từng bước',
          'Requires heat control and step-by-step seasoning',
          locale,
        ),
      };
    case 'hard':
      return {
        label: lSync('Cầu kỳ', 'Advanced', locale),
        description: lSync(
          'Nhiều công đoạn sơ chế và canh nhiệt kỹ',
          'Multiple prep stages and careful temperature control',
          locale,
        ),
      };
    default:
      return {
        label: lSync('Chuẩn bếp nhà', 'Homestyle', locale),
        description: lSync(
          'Hướng dẫn từng bước rõ ràng',
          'Clear step-by-step guidance',
          locale,
        ),
      };
  }
}

export function summarizeRecipeTechniques(
  recipe: Pick<Recipe, 'steps'>,
  locale?: SupportedLocale,
): CulinaryTechniqueMeta[] {
  const seen = new Set<CulinaryTechniqueId>();
  const list: CulinaryTechniqueMeta[] = [];
  const total = recipe.steps.length;
  recipe.steps.forEach((step, idx) => {
    const stepTitle = 'title' in step && typeof step.title === 'string' ? step.title : undefined;
    const tech = resolveStepTechnique(step.instruction, stepTitle, idx, total, locale);
    if (tech.id !== 'general' && !seen.has(tech.id)) {
      seen.add(tech.id);
      list.push(tech);
    }
  });
  return list.slice(0, 4);
}
