import { z } from 'zod';
import { normalizeIngredientText, type StandardUnit } from '@frigo/domain';
import {
  AIPromptGuardError,
  inspectAndSanitizePrompt,
  type PromptGuardOptions,
  type PromptGuardResult,
} from './prompt-guard';
import {
  TakolioAiGateway,
  inspectCulinaryFoodSafety,
  matchesHouseholdAllergen,
} from './gateway-v4';

// ── Public Contracts & Zod Schemas ───────────────────────────────────────────

export interface HeirloomRecipePromptInput {
  promptVi: string;
  familyStoryVi?: string;
  servings?: number;
  regionHint?: 'bac' | 'trung' | 'nam' | 'all';
  maxCookTimeMinutes?: number;
  householdAllergens?: string[];
  userId?: string;
  householdId?: string;
}

export const HeirloomRecipePromptInputSchema = z.object({
  promptVi: z.string(),
  familyStoryVi: z.string().optional(),
  servings: z.number().int().min(1).max(24).optional(),
  regionHint: z.enum(['bac', 'trung', 'nam', 'all']).optional(),
  maxCookTimeMinutes: z.number().int().min(8).max(360).optional(),
  householdAllergens: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  userId: z.string().optional(),
  householdId: z.string().optional(),
});

export const HeirloomCategorySchema = z.enum([
  'mon_kho',
  'mon_canh',
  'mon_xao',
  'mon_chien',
  'mon_hap_luoc',
  'mon_cuon_nom',
  'mon_bun_pho',
  'mon_chay',
  'mon_nhanh_sang',
  'mon_lau_tiec',
]);

export type HeirloomCategory = z.infer<typeof HeirloomCategorySchema>;

export const HeirloomRegionSchema = z.enum(['bac', 'trung', 'nam', 'toan_quoc']);
export type HeirloomRegion = z.infer<typeof HeirloomRegionSchema>;

export const HeirloomStepPhaseSchema = z.enum([
  'mise_en_place',
  'marinate',
  'active_cook',
  'plate',
]);

export const HeirloomHeatLevelSchema = z.enum([
  'off',
  'low',
  'medium_low',
  'medium',
  'medium_high',
  'high',
]);

export const HeirloomCookwareSchema = z.enum([
  'prep_board',
  'wok',
  'claypot',
  'stockpot',
  'steamer',
  'pan',
]);

export const HeirloomStandardUnitSchema = z.enum([
  'g',
  'kg',
  'ml',
  'l',
  'piece',
  'pack',
  'bunch',
  'slice',
]);

export const HeirloomRecipeIngredientSchema = z.object({
  ingredientId: z.string().min(1),
  name: z.string().min(1),
  nameVi: z.string().min(1),
  quantity: z.number().positive(),
  requiredQuantity: z.number().positive(),
  unit: HeirloomStandardUnitSchema,
  marketUnitVi: z.string().min(1),
  formattedAmountVi: z.string().min(1),
  prepNoteVi: z.string().min(1),
  isOptional: z.boolean().optional(),
});

export type HeirloomRecipeIngredient = z.infer<typeof HeirloomRecipeIngredientSchema>;

export const HeirloomRecipeStepSchema = z.object({
  stepNumber: z.number().int().min(1).max(12),
  titleVi: z.string().min(1),
  phase: HeirloomStepPhaseSchema,
  instruction: z.string().min(12),
  timerMinutes: z.number().int().min(1).max(240),
  heatLevel: HeirloomHeatLevelSchema,
  cookware: HeirloomCookwareSchema,
  sensoryCue: z.string().min(8),
  tip: z.string().min(8),
});

export type HeirloomRecipeStep = z.infer<typeof HeirloomRecipeStepSchema>;

export const HeirloomRecipeBlueprintSchema = z.object({
  titleVi: z.string().min(3),
  slug: z.string().min(3),
  descriptionVi: z.string().min(20),
  familyStoryVi: z.string().optional(),
  region: HeirloomRegionSchema,
  category: HeirloomCategorySchema,
  difficulty: z.enum(['easy', 'medium', 'hard']),
  prepTimeMinutes: z.number().int().min(3).max(180),
  cookTimeMinutes: z.number().int().min(5).max(360),
  totalTimeMinutes: z.number().int().min(8).max(540),
  servings: z.number().int().min(1).max(24),
  ingredients: z.array(HeirloomRecipeIngredientSchema).min(5).max(8),
  steps: z.array(HeirloomRecipeStepSchema).min(4).max(5),
  chefSecretVi: z.string().min(15),
  allergenWarningsVi: z.array(z.string()),
  tags: z.array(z.string()).min(1),
  mode: z.enum(['llm', 'culinary_knowledge_engine']),
  confidence: z.number().min(0).max(1),
});

export type HeirloomRecipeBlueprint = z.infer<typeof HeirloomRecipeBlueprintSchema>;

const STACKED_INJECTION_RE =
  /\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+|any\s+|every\s+)?(?:(?:previous|prior|above|earlier|system|developer|safety|hidden)\s+){1,4}(?:instructions?|prompts?|rules?|constraints?|guardrails?)\b/i;

const STACKED_PROBE_RE =
  /\b(?:reveal|show|print|dump|output|repeat|leak|expose)\s+(?:your\s+|the\s+|entire\s+|exact\s+|full\s+)?(?:(?:system|developer|hidden|initial|internal)\s+){1,4}(?:prompts?|instructions?|rules?)\b/i;

/**
 * Prompt-guard entrypoint delegating to `prompt-guard.ts` (`inspectAndSanitizePrompt`).
 * Validates prompt safety before any LLM dispatch or culinary synthesis.
 */
export function inspectPromptSafety(
  rawText: string,
  options: PromptGuardOptions = {},
): PromptGuardResult {
  const base = inspectAndSanitizePrompt(rawText, {
    maxChars: 2_400,
    maxEstimatedTokens: 700,
    ...options,
  });

  const extraFlags = new Set<string>(base.flags);
  let riskScore = base.riskScore;

  if (STACKED_INJECTION_RE.test(rawText) && !extraFlags.has('PROMPT_INJECTION_OVERRIDE')) {
    extraFlags.add('PROMPT_INJECTION_OVERRIDE');
    riskScore = Math.min(1, riskScore + 0.7);
  }
  if (STACKED_PROBE_RE.test(rawText) && !extraFlags.has('SYSTEM_PROMPT_PROBING')) {
    extraFlags.add('SYSTEM_PROMPT_PROBING');
    riskScore = Math.min(1, riskScore + 0.65);
  }

  const threshold = options.blockThreshold ?? 0.5;
  const boundedScore = Math.round(riskScore * 100) / 100;
  return {
    safe: base.safe && boundedScore < threshold,
    sanitizedText: base.sanitizedText,
    riskScore: boundedScore,
    flags: [...extraFlags],
  };
}

// ── Culinary Signal Parser ───────────────────────────────────────────────────

type DetectedTechnique =
  | 'kho'
  | 'nuong'
  | 'canh'
  | 'xao'
  | 'hap'
  | 'chao'
  | 'bun'
  | 'chien';

type DetectedProtein =
  | 'ca'
  | 'ga'
  | 'thit'
  | 'bo'
  | 'tom'
  | 'dau'
  | 'trung';

type DetectedAromatic =
  | 'rieng'
  | 'sa'
  | 'gung'
  | 'nghe'
  | 'la_chanh'
  | 'me'
  | 'dua_chua'
  | 'nuoc_dua'
  | 'thi_la'
  | 'la_lot';

interface ParsedCulinaryIntent {
  technique: DetectedTechnique;
  protein: DetectedProtein;
  specificProteinLabelVi: string;
  proteinCanonicalId: string;
  aromatics: DetectedAromatic[];
  region: HeirloomRegion;
  servings: number;
  maxCookTimeMinutes?: number;
  hasPorkBellyCombo: boolean;
  hasEggCombo: boolean;
  isVegetarianIntent: boolean;
}

function toSlugVi(text: string): string {
  const base = normalizeIngredientText(text).replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
  return (base || 'cong-thuc-gia-truyen-viet').slice(0, 72).replace(/-+$/g, '');
}

function capitalizeTitleVi(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Món Ngon Gia Truyền Bếp Việt';
  return cleaned
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function detectTechnique(folded: string): DetectedTechnique {
  // Strip regional/vegetable homographs ("miền Bắc/Trung/Nam/Tây" vs "miến", "súp lơ" vs "súp")
  const clean = ` ${folded} `
    .replace(/\bmien\s+(bac|trung|nam|tay|que|bien|nui)\b/g, ' ')
    .replace(/\bba\s+mien\b/g, ' ')
    .replace(/\bsup\s+lo\b/g, ' ');

  if (/\b(canh\s+chua|nau\s+canh|mon\s+canh)\b/.test(clean)) return 'canh';
  if (/\b(bun|pho|mien\s+ga|mien\s+luon|mien\s+dong|mien\s+tron|mien\s+xao|mien|hu\s+tieu|banh\s+canh)\b/.test(clean)) {
    if (/\bmien\s+xao\b/.test(clean)) return 'xao';
    return 'bun';
  }
  if (/\b(chao|sup\s+gao)\b/.test(clean)) return 'chao';
  if (/\b(canh|sup|ham|tiem|lau)\b/.test(clean)) return 'canh';
  if (/\b(nuong|ap\s+chao|cha\s+nuong|than\s+hoa)\b/.test(clean)) return 'nuong';
  if (/\b(hap|luoc|chung|tan)\b/.test(clean)) return 'hap';
  if (/\b(xao|dao\s+nhanh)\b/.test(clean)) return 'xao';
  if (/\b(chien|ran|sot\s+ca)\b/.test(clean) && !/\b(kho|rim)\b/.test(clean)) return 'chien';
  if (/\b(kho|rim|om|kho\s+to|kho\s+tau|kho\s+tieu)\b/.test(clean)) return 'kho';
  return 'kho';
}

function detectProtein(folded: string): {
  protein: DetectedProtein;
  labelVi: string;
  canonicalId: string;
  isVegetarian: boolean;
} {
  // Mask false-positive compounds ("ca chua", "ca rot", "ca tim", "ca phao", "bo cai", "dau an", "dau hao", "dau bap")
  const masked = ` ${folded} `
    .replace(/\b(ca chua|ca rot|ca tim|ca phao|nuoc mam|mam ca)\b/g, ' ')
    .replace(/\b(bo cai|cai bo xoi|trai bo|qua bo|bo lat)\b/g, ' ')
    .replace(/\b(dau an|dau hao|dau me|dau bap|dau co ve|dau cove|dau phong)\b/g, ' ');

  const isVeg = /\b(chay|thuan chay|dau phu|dau hu|tau hu)\b/.test(folded);

  if (/\b(ca tram)\b/.test(masked)) {
    return { protein: 'ca', labelVi: 'Cá trắm đen cắt khúc dày', canonicalId: 'FISH_FRESHWATER', isVegetarian: false };
  }
  if (/\b(ca bong)\b/.test(masked)) {
    return { protein: 'ca', labelVi: 'Cá bống sông tươi nguyên con', canonicalId: 'FISH_FRESHWATER', isVegetarian: false };
  }
  if (/\b(ca loc|ca qua)\b/.test(masked)) {
    return { protein: 'ca', labelVi: 'Cá lóc đồng cắt khoanh', canonicalId: 'FISH_FRESHWATER', isVegetarian: false };
  }
  if (/\b(ca hu|ca basa|ca bong lau|ca tre)\b/.test(masked)) {
    return { protein: 'ca', labelVi: 'Cá hú / Cá basa tươi cắt khoanh', canonicalId: 'FISH_FRESHWATER', isVegetarian: false };
  }
  if (/\b(ca thu)\b/.test(masked)) {
    return { protein: 'ca', labelVi: 'Cá thu phấn cắt lát dày', canonicalId: 'SALMON_FILLET', isVegetarian: false };
  }
  if (/\b(ca hoi)\b/.test(masked)) {
    return { protein: 'ca', labelVi: 'Cá hồi phi lê tươi', canonicalId: 'SALMON_FILLET', isVegetarian: false };
  }
  if (/\b(ca ro|ca dieu hong|ca chep|ca)\b/.test(masked)) {
    return { protein: 'ca', labelVi: 'Cá đồng tươi cắt khúc (cá lóc / cá trắm)', canonicalId: 'FISH_FRESHWATER', isVegetarian: false };
  }

  if (/\b(canh ga)\b/.test(masked)) {
    return { protein: 'ga', labelVi: 'Cánh gà ta chặt khúc vừa ăn', canonicalId: 'CHICKEN_THIGH', isVegetarian: false };
  }
  if (/\b(uc ga)\b/.test(masked)) {
    return { protein: 'ga', labelVi: 'Ức gà phi lê mềm', canonicalId: 'CHICKEN_BREAST', isVegetarian: false };
  }
  if (/\b(dui ga)\b/.test(masked)) {
    return { protein: 'ga', labelVi: 'Đùi gà ta góc tư khía nhẹ thớ', canonicalId: 'CHICKEN_THIGH', isVegetarian: false };
  }
  if (/\b(ga ta|ga doi|thit ga|ga|vit)\b/.test(masked)) {
    return { protein: 'ga', labelVi: 'Thịt gà ta thả vườn chặt miếng', canonicalId: 'CHICKEN_THIGH', isVegetarian: false };
  }

  if (/\b(bap bo|gan bo|nam bo)\b/.test(masked)) {
    return { protein: 'bo', labelVi: 'Bắp bò hoa có gân giòn', canonicalId: 'BEEF_SIRLOIN', isVegetarian: false };
  }
  if (/\b(thit bo|than bo|bo)\b/.test(masked)) {
    return { protein: 'bo', labelVi: 'Thịt thăn bò tươi thái mỏng ngang thớ', canonicalId: 'BEEF_SIRLOIN', isVegetarian: false };
  }

  if (/\b(tom dat|tom su|tom the|tom|tep|muc|ngao|ngheu|cua)\b/.test(masked)) {
    return { protein: 'tom', labelVi: 'Tôm sú / Tôm đất tươi cắt râu rút chỉ', canonicalId: 'SHRIMP', isVegetarian: false };
  }

  if (/\b(suon non|suon sun|suon heo|suon)\b/.test(masked)) {
    return { protein: 'thit', labelVi: 'Sườn heo non chặt miếng 4cm', canonicalId: 'PORK_RIBS', isVegetarian: false };
  }
  if (/\b(ba chi|ba roi|chan gio)\b/.test(masked)) {
    return { protein: 'thit', labelVi: 'Thịt ba chỉ rút sườn (tỷ lệ 7 nạc 3 mỡ)', canonicalId: 'PORK_BELLY', isVegetarian: false };
  }
  if (/\b(thit bam|thit xay)\b/.test(masked)) {
    return { protein: 'thit', labelVi: 'Thịt nạc dăm băm dối bằng tay', canonicalId: 'GROUND_PORK', isVegetarian: false };
  }
  if (/\b(thit heo|thit lon|thit)\b/.test(masked)) {
    return { protein: 'thit', labelVi: 'Thịt ba chỉ heo tươi thái quân cờ', canonicalId: 'PORK_BELLY', isVegetarian: false };
  }

  if (isVeg || /\b(dau phu|dau hu|tau hu|nam)\b/.test(masked)) {
    return { protein: 'dau', labelVi: 'Đậu phụ mơ trắng cắt miếng vuông', canonicalId: 'TOFU', isVegetarian: isVeg };
  }

  if (/\b(trung ga|trung vit|trung cut|trung)\b/.test(masked)) {
    return { protein: 'trung', labelVi: 'Trứng gà ta tươi', canonicalId: 'CHICKEN_EGG', isVegetarian: false };
  }

  return { protein: 'thit', labelVi: 'Thịt ba chỉ rút sườn tươi', canonicalId: 'PORK_BELLY', isVegetarian: false };
}

function detectAromatics(folded: string): DetectedAromatic[] {
  const list: DetectedAromatic[] = [];
  if (/\b(rieng|cu rieng)\b/.test(folded)) list.push('rieng');
  if (/\b(sa|cay sa|cu sa|sa ot)\b/.test(folded)) list.push('sa');
  if (/\b(gung|cu gung)\b/.test(folded)) list.push('gung');
  if (/\b(nghe|cu nghe|bot nghe)\b/.test(folded)) list.push('nghe');
  if (/\b(la chanh)\b/.test(folded)) list.push('la_chanh');
  if (/\b(me|cot me|canh chua)\b/.test(folded) && !/\b(dau me|hat me)\b/.test(folded)) list.push('me');
  if (/\b(dua chua|cai chua|dua cai)\b/.test(folded)) list.push('dua_chua');
  if (/\b(nuoc dua|kho tau|kho to)\b/.test(folded)) list.push('nuoc_dua');
  if (/\b(thi la)\b/.test(folded)) list.push('thi_la');
  if (/\b(la lot)\b/.test(folded)) list.push('la_lot');
  return list;
}

function detectRegion(
  folded: string,
  hint: HeirloomRecipePromptInput['regionHint'],
  aromatics: readonly DetectedAromatic[],
): HeirloomRegion {
  if (hint === 'bac' || hint === 'trung' || hint === 'nam') {
    return hint;
  }
  if (/\b(ha noi|mien bac|bac bo|nam dinh|hai phong|lang vu dai|vi bac)\b/.test(folded)) {
    return 'bac';
  }
  if (/\b(hue|xu hue|mien trung|quang nam|da nang|nghe an|binh dinh|vi trung)\b/.test(folded)) {
    return 'trung';
  }
  if (/\b(sai gon|mien nam|mien tay|nam bo|dong thap|can tho|kho to|vi nam)\b/.test(folded)) {
    return 'nam';
  }
  if (aromatics.includes('rieng') || aromatics.includes('dua_chua') || aromatics.includes('thi_la')) {
    return 'bac';
  }
  if (aromatics.includes('nghe') && aromatics.includes('sa')) {
    return 'trung';
  }
  if (aromatics.includes('me') || aromatics.includes('nuoc_dua')) {
    return 'nam';
  }
  return 'toan_quoc';
}

function parseCulinaryIntent(input: HeirloomRecipePromptInput): ParsedCulinaryIntent {
  const combinedFolded = normalizeIngredientText(
    `${input.promptVi} ${input.familyStoryVi ?? ''}`,
  );
  const promptOnlyFolded = normalizeIngredientText(input.promptVi);

  const technique = detectTechnique(promptOnlyFolded || combinedFolded);
  const detectedProtein = detectProtein(promptOnlyFolded || combinedFolded);
  const aromatics = detectAromatics(combinedFolded);
  const region = detectRegion(combinedFolded, input.regionHint, aromatics);
  const servings = Math.max(1, Math.min(24, Math.round(input.servings ?? 4)));

  return {
    technique,
    protein: detectedProtein.protein,
    specificProteinLabelVi: detectedProtein.labelVi,
    proteinCanonicalId: detectedProtein.canonicalId,
    aromatics,
    region,
    servings,
    maxCookTimeMinutes: input.maxCookTimeMinutes,
    hasPorkBellyCombo:
      detectedProtein.protein !== 'thit' && /\b(ba chi|thit ba chi|mo heo|top mo)\b/.test(combinedFolded),
    hasEggCombo:
      detectedProtein.protein !== 'trung' && /\b(trung|trung vit|trung cut|trung ga)\b/.test(combinedFolded),
    isVegetarianIntent: detectedProtein.isVegetarian,
  };
}

function makeIng(
  ingredientId: string,
  nameVi: string,
  baseQtyFor4: number,
  servings: number,
  unit: StandardUnit,
  marketUnitVi: string,
  prepNoteVi: string,
  isOptional = false,
): HeirloomRecipeIngredient {
  const scale = servings / 4;
  const raw = baseQtyFor4 * scale;
  const qty =
    unit === 'g' || unit === 'ml'
      ? raw >= 80
        ? Math.round(raw / 10) * 10
        : Math.max(5, Math.round(raw / 5) * 5)
      : Number(Math.max(0.5, Math.round(raw * 2) / 2).toFixed(1));

  return {
    ingredientId,
    name: nameVi,
    nameVi,
    quantity: qty,
    requiredQuantity: qty,
    unit,
    marketUnitVi,
    formattedAmountVi: `${qty} ${marketUnitVi}`,
    prepNoteVi,
    ...(isOptional ? { isOptional: true } : {}),
  };
}

const REGION_SOUL_LABEL_VI: Record<HeirloomRegion, string> = {
  bac: 'chuẩn vị Bắc thanh đằm tinh tế',
  trung: 'đậm đà cay thơm xứ Trung',
  nam: 'hài hòa mặn ngọt phóng khoáng phương Nam',
  toan_quoc: 'đậm tình cơm nhà Việt Nam',
};

function mapTechniqueToCategory(
  technique: DetectedTechnique,
  isVeg: boolean,
): HeirloomCategory {
  if (isVeg) return 'mon_chay';
  switch (technique) {
    case 'kho':
      return 'mon_kho';
    case 'canh':
      return 'mon_canh';
    case 'xao':
      return 'mon_xao';
    case 'hap':
      return 'mon_hap_luoc';
    case 'chao':
      return 'mon_nhanh_sang';
    case 'bun':
      return 'mon_bun_pho';
    case 'nuong':
    case 'chien':
    default:
      return 'mon_chien';
  }
}

function buildAuthenticTitleVi(
  rawPrompt: string,
  intent: ParsedCulinaryIntent,
): string {
  const trimmed = rawPrompt
    .replace(/^(hãy\s+|làm\s+ơn\s+|giúp\s+mình\s+|nấu\s+món\s+|công\s+thức\s+|cách\s+làm\s+|cách\s+nấu\s+)/i, '')
    .trim();

  if (trimmed.length >= 6 && trimmed.length <= 68) {
    const baseTitle = capitalizeTitleVi(trimmed);
    if (intent.region === 'bac' && !/bắc|hà nội/i.test(baseTitle)) {
      return `${baseTitle} Vị Bắc Gia Truyền`;
    }
    if (intent.region === 'trung' && !/trung|huế|quảng/i.test(baseTitle)) {
      return `${baseTitle} Đậm Vị Miền Trung`;
    }
    if (intent.region === 'nam' && !/nam|tộ|miền tây|sài gòn/i.test(baseTitle)) {
      return `${baseTitle} Chuẩn Cơm Nhà Phương Nam`;
    }
    return baseTitle;
  }

  const proteinShort: Record<DetectedProtein, string> = {
    ca: 'Cá Đồng',
    ga: 'Gà Ta',
    thit: 'Thịt Ba Chỉ',
    bo: 'Bắp Bò',
    tom: 'Tôm Tươi',
    dau: 'Đậu Phụ Mơ',
    trung: 'Trứng Gà Ta',
  };
  const techShort: Record<DetectedTechnique, string> = {
    kho: 'Kho Niêu Đất',
    nuong: 'Nướng Than Hoa Thơm Lừng',
    canh: 'Nấu Canh Thanh Ngọt',
    xao: 'Xào Lửa Lớn Dậy Vị',
    hap: 'Hấp Cách Thủy Giữ Ngọt',
    chao: 'Nấu Cháo Gừng Ấm Bụng',
    bun: 'Nấu Nước Dùng Thanh Trong',
    chien: 'Áp Chảo Sốt Mắm Tỏi',
  };
  return `${proteinShort[intent.protein]} ${techShort[intent.technique]}`;
}

function buildAromaticIngredients(
  intent: ParsedCulinaryIntent,
  fishSauceBlocked: boolean,
): HeirloomRecipeIngredient[] {
  const { aromatics, servings, technique, protein, region, isVegetarianIntent } = intent;
  const extras: HeirloomRecipeIngredient[] = [];

  if (aromatics.includes('rieng') || (technique === 'kho' && protein === 'ca' && region === 'bac')) {
    extras.push(
      makeIng(
        'GINGER',
        'Củ riềng bánh tẻ (nửa thái lát lót nồi, nửa giã dập)',
        80,
        servings,
        'g',
        'g (khoảng 1 củ vừa)',
        'rửa sạch, chia nửa thái lát mỏng lót đáy nồi đất, nửa giã tay cho dậy tinh dầu',
      ),
    );
  }
  if (aromatics.includes('sa') || (technique === 'nuong' && (protein === 'ga' || protein === 'thit' || protein === 'bo'))) {
    extras.push(
      makeIng(
        'LEMONGRASS',
        'Sả tươi đập dập băm nhuyễn',
        4,
        servings,
        'piece',
        'cây sả tươi',
        'bóc bẹ già, đập dập phần gốc trắng rồi băm thật mịn để bám đều thớ thịt',
      ),
    );
  }
  if (aromatics.includes('gung') || technique === 'hap' || technique === 'chao' || protein === 'bo') {
    extras.push(
      makeIng(
        'GINGER',
        'Gừng sẻ già cạo vỏ thái chỉ',
        30,
        servings,
        'g',
        'g (1 nhánh già)',
        'nướng sơ trên lửa cho dậy hương ấm rồi cạo vỏ, thái sợi mảnh',
      ),
    );
  }
  if (aromatics.includes('nghe')) {
    extras.push(
      makeIng(
        'GINGER',
        'Nghệ tươi giã vắt nước cốt vàng óng',
        25,
        servings,
        'g',
        'g (1 củ nghệ đỏ)',
        'giã nhỏ với 1 nhúm muối hạt để giữ sắc vàng hổ phách tươi không bị xỉn',
      ),
    );
  }
  if (aromatics.includes('la_chanh') || (protein === 'ga' && (technique === 'hap' || technique === 'nuong' || technique === 'kho'))) {
    extras.push(
      makeIng(
        'LIME',
        'Lá chanh bánh tẻ tươi',
        8,
        servings,
        'piece',
        'lá chanh tươi',
        'rửa sạch, tước sống lưng rồi thái chỉ mảnh như sợi tơ để không bị đắng',
      ),
    );
  }
  if (aromatics.includes('me') || (technique === 'canh' && region === 'nam' && protein === 'ca')) {
    extras.push(
      makeIng(
        'LIME',
        'Vắt me chín dầm nước ấm lọc bỏ hạt',
        40,
        servings,
        'g',
        'g (khoảng 2 muỗng canh cốt me)',
        'dầm me với 60ml nước ấm, lọc qua rây lấy phần cốt chua thanh mịn',
      ),
    );
  }
  if (aromatics.includes('dua_chua')) {
    extras.push(
      makeIng(
        'CABBAGE',
        'Dưa cải bẹ muối chua vàng giòn',
        250,
        servings,
        'g',
        'g (1 bát con dưa chua)',
        'rửa sơ qua 1 lần nước đun sôi để nguội nếu dưa quá chua, vắt ráo nhẹ tay',
      ),
    );
  }
  if (aromatics.includes('nuoc_dua') || (technique === 'kho' && region === 'nam')) {
    extras.push(
      makeIng(
        'FRESH_MILK',
        'Nước dừa xiêm tươi ngọt thanh',
        250,
        servings,
        'ml',
        'ml (1 trái dừa xiêm)',
        'chọn dừa xiêm vừa cứng cạy để nước kho lên màu nâu đỏ tự nhiên không gắt đường',
      ),
    );
  }
  if (aromatics.includes('thi_la') || (technique === 'canh' && protein === 'ca' && region !== 'nam')) {
    extras.push(
      makeIng(
        'SCALLION',
        'Thì là & Hành hoa tươi cắt khúc',
        1,
        servings,
        'bunch',
        'bó nhỏ',
        'tách riêng đầu hành trắng để phi thơm, phần lá xanh và thì là cắt khúc 3cm',
      ),
    );
  }
  if (aromatics.includes('la_lot')) {
    extras.push(
      makeIng(
        'SCALLION',
        'Lá lốt bánh tẻ thơm nồng',
        1,
        servings,
        'bunch',
        'bó lá lốt tươi',
        'chọn lá bản to xanh đậm để cuốn/thái sợi dậy tinh dầu',
      ),
    );
  }

  // Primary savory seasoning (respects vegetarian & fish-allergen constraints)
  if (isVegetarianIntent || fishSauceBlocked) {
    extras.push(
      makeIng(
        'SOY_SAUCE',
        'Nước tương ủ tự nhiên & chút muối biển',
        35,
        servings,
        'ml',
        'ml (hơn 2 muỗng canh)',
        'khuấy đều cùng 1/2 thìa cà phê hạt nêm nấm và tiêu xay',
      ),
    );
  } else {
    extras.push(
      makeIng(
        'FISH_SAUCE',
        'Nước mắm nhĩ truyền thống độ đạm cao',
        35,
        servings,
        'ml',
        'ml (khoảng 2,5 muỗng canh)',
        'chọn nước mắm cốt ủ chượp tự nhiên để dậy hậu vị ngọt sâu',
      ),
    );
  }

  return extras;
}

function detectAllergenNotesVi(
  ingredients: readonly HeirloomRecipeIngredient[],
  householdAllergens: readonly string[] | undefined,
  adaptationNotes: readonly string[],
): string[] {
  const warnings = new Set<string>(adaptationNotes);

  for (const ing of ingredients) {
    const id = ing.ingredientId.toUpperCase();
    const norm = normalizeIngredientText(ing.nameVi);
    if (id.includes('FISH') || norm.includes('nuoc mam') || /\bca\b/.test(norm)) {
      if (!norm.includes('ca chua') && !norm.includes('ca rot')) {
        warnings.add('Chứa đạm cá biển/đồng (từ cá tươi hoặc nước mắm truyền thống).');
      }
    }
    if (id === 'SHRIMP' || id === 'CRAB_MEAT' || id === 'SQUID' || /\b(tom|cua|muc|ngao|ngheu|oc|hau|dau hao)\b/.test(norm)) {
      warnings.add('Chứa giáp xác / nhuyễn thể (hải sản có vỏ).');
    }
    if (id === 'TOFU' || id === 'SOY_SAUCE' || /\b(dau phu|dau hu|nuoc tuong|xi dau|dau nanh)\b/.test(norm)) {
      warnings.add('Chứa đậu nành (đậu phụ / nước tương lên men).');
    }
    if (id === 'CHICKEN_EGG' || /\btrung\b/.test(norm)) {
      warnings.add('Chứa trứng gia cầm.');
    }
    if (/\b(dau phong|lac|vung|me rang|hat dieu)\b/.test(norm)) {
      warnings.add('Chứa đậu phộng (lạc) hoặc hạt có dầu.');
    }

    if (householdAllergens && householdAllergens.length > 0) {
      const conflict = matchesHouseholdAllergen(ing.nameVi, householdAllergens);
      if (conflict.matched) {
        warnings.add(
          `Cảnh báo dị ứng gia đình: Nguyên liệu "${ing.nameVi}" trùng với nhóm kiêng/dị ứng (${conflict.matchedTerm}) — hãy thay bằng đạm/gia vị an toàn trước khi nấu.`,
        );
      }
    }
  }

  return [...warnings];
}

/**
 * Chef-grade deterministic Vietnamese culinary synthesis engine.
 * Used whenever `gateway` is null, in mock mode, or when upstream LLM providers are unavailable.
 */
export function synthesizeHeirloomRecipeDeterministic(
  input: HeirloomRecipePromptInput,
): HeirloomRecipeBlueprint {
  const intent = parseCulinaryIntent(input);
  const adaptationNotes: string[] = [];

  const fishAllergenActive = matchesHouseholdAllergen(
    'FISH_SAUCE',
    input.householdAllergens,
  ).matched;
  const soyAllergenActive = matchesHouseholdAllergen(
    'SOY_SAUCE',
    input.householdAllergens,
  ).matched;

  if (fishAllergenActive && intent.protein !== 'ca') {
    adaptationNotes.push(
      'Đã tự động chuyển nước mắm sang gia vị không chứa cá theo hồ sơ dị ứng gia đình.',
    );
  }

  const titleVi = buildAuthenticTitleVi(input.promptVi, intent);
  const slug = toSlugVi(titleVi);
  const category = mapTechniqueToCategory(intent.technique, intent.isVegetarianIntent);

  // ── 1. Assemble 5–8 Authentic Market Ingredients ───────────────────────────
  const ingredients: HeirloomRecipeIngredient[] = [];

  const baseHeroGrams =
    intent.protein === 'trung'
      ? 5
      : intent.protein === 'dau'
        ? 4
        : intent.protein === 'tom'
          ? 400
          : 550;
  const heroUnit: StandardUnit =
    intent.protein === 'trung' || intent.protein === 'dau' ? 'piece' : 'g';
  const heroMarketUnit =
    intent.protein === 'trung'
      ? 'quả trứng tươi'
      : intent.protein === 'dau'
        ? 'bìa đậu phụ mơ'
        : 'g';
  const heroPrep =
    intent.protein === 'ca'
      ? 'đánh vảy, cạo sạch màng đen bụng cá, chà muối chanh khử nhớt rồi thấm thật khô'
      : intent.protein === 'ga'
        ? 'xát chút muối gừng rửa sạch, để ráo hoàn toàn giúp da săn giòn'
        : intent.protein === 'bo'
          ? 'thấm khô mặt thịt bằng khăn giấy, thái ngang thớ mỏng đều tay'
          : intent.protein === 'tom'
            ? 'cắt râu, rút chỉ lưng, rửa qua nước muối loãng để giữ độ giòn ngọt'
            : intent.protein === 'dau'
              ? 'thấm ráo nước, cắt quân cờ dày 2,5cm để chiên vàng mặt ngoài mà ruột vẫn mềm béo'
              : intent.protein === 'trung'
                ? 'luộc chín tới bóc vỏ (nếu kho) hoặc đánh bông nhẹ với 2 giọt cốt chanh'
                : 'rửa sạch, chần nhanh nước sôi cùng 2 lát gừng cho trong nước và săn thớ mỡ';

  ingredients.push(
    makeIng(
      intent.proteinCanonicalId,
      intent.specificProteinLabelVi,
      baseHeroGrams,
      intent.servings,
      heroUnit,
      heroMarketUnit,
      heroPrep,
    ),
  );

  if (intent.hasPorkBellyCombo) {
    ingredients.push(
      makeIng(
        'PORK_BELLY',
        'Thịt ba chỉ thái con chì (tươm mỡ làm bóng thớ cá)',
        150,
        intent.servings,
        'g',
        'g (1,5 lạng)',
        'thái miếng dày 1,5cm áp chảo sơ cho xém cạnh thơm ngậy',
      ),
    );
  } else if (intent.hasEggCombo) {
    ingredients.push(
      makeIng(
        'CHICKEN_EGG',
        'Trứng gà / Trứng vịt luộc bóc vỏ',
        4,
        intent.servings,
        'piece',
        'quả',
        'luộc lòng đào 7 phút, ngâm nước đá lạnh giúp bóc vỏ láng mịn',
      ),
    );
  }

  // Add detected aromatics + regional seasoning
  const aromaticItems = buildAromaticIngredients(
    intent,
    fishAllergenActive && !soyAllergenActive,
  );
  for (const item of aromaticItems) {
    if (ingredients.length < 7) {
      // Skip soy sauce if soy allergen is ALSO active -> use pure sea salt instead
      if (soyAllergenActive && item.ingredientId === 'SOY_SAUCE') {
        ingredients.push(
          makeIng(
            'COOKING_OIL',
            'Muối biển hầm & Hạt tiêu đen giã dập',
            10,
            intent.servings,
            'g',
            'g (2 thìa cà phê)',
            'nêm từng lớp để vị mặn dịu thấm tự nhiên không cần nước tương/nước mắm',
          ),
        );
        adaptationNotes.push('Đã thay thế nước tương bằng muối biển sạch theo hồ sơ dị ứng đậu nành.');
      } else {
        ingredients.push(item);
      }
    }
  }

  // Technique-specific supporting vegetables & aromatics so count lands strictly in 5..8
  if (intent.technique === 'canh') {
    ingredients.push(
      makeIng(
        'TOMATO',
        'Cà chua chín đỏ bổ múi cau',
        2,
        intent.servings,
        'piece',
        'quả vừa',
        'xào sơ 1 nửa tạo màu điều đỏ cam tự nhiên, 1 nửa thả cuối giữ múi đẹp',
      ),
    );
    if (!intent.aromatics.includes('dua_chua')) {
      ingredients.push(
        makeIng(
          'PINEAPPLE',
          'Dứa chín (Thơm) & Đậu bắp thái vát',
          180,
          intent.servings,
          'g',
          'g (1/4 quả dứa + 5 trái đậu bắp)',
          'cắt miếng vừa ăn giúp nước canh ngọt thanh tự nhiên',
        ),
      );
    }
  } else if (intent.technique === 'xao') {
    if (!intent.aromatics.includes('dua_chua')) {
      ingredients.push(
        makeIng(
          'BROCCOLI',
          'Rau củ giòn ngọt theo mùa (Bông cải / Cần tỏi / Đậu cô ve)',
          300,
          intent.servings,
          'g',
          'g (1 đĩa đầy)',
          'cắt miếng đồng đều, trụng nhanh 30 giây qua nước sôi có nhúm muối rồi vớt ra rổ ráo',
        ),
      );
    }
  } else if (intent.technique === 'chao') {
    ingredients.push(
      makeIng(
        'RICE',
        'Gạo tẻ thơm trộn nắm nhỏ gạo nếp cái hoa vàng',
        160,
        intent.servings,
        'g',
        'g (gần 1 bát con gạo)',
        'vo nhẹ giữ lớp cám thơm, rang sơ trên chảo khô 3 phút cho hạt gạo trong lại không bị vữa',
      ),
    );
  } else if (intent.technique === 'bun') {
    ingredients.push(
      makeIng(
        'NOODLE',
        'Bún tươi sợi nhỏ / Bánh phở mềm',
        600,
        intent.servings,
        'g',
        'g',
        'trụng nhanh qua nước sôi 15 giây ngay trước khi chan nước dùng nóng hổi',
      ),
    );
  }

  // Ensure fragrant alliums, cooking fat & finishing herbs/pepper fill cleanly to 6–8 items
  const fillerCandidates: HeirloomRecipeIngredient[] = [
    makeIng(
      'GARLIC',
      'Hành tím & Tỏi ta băm dối',
      5,
      intent.servings,
      'piece',
      'củ/tép lớn',
      'đập dập băm vừa tay để khi phi dậy mùi thơm ngọt mà không nhanh cháy',
    ),
    makeIng(
      'COOKING_OIL',
      intent.region === 'nam' && intent.technique === 'kho'
        ? 'Mỡ heo thắng trong (hoặc dầu ăn) & Đường thốt nốt thắng màu'
        : 'Dầu ăn thực vật & Chút đường phèn dịu vị',
      25,
      intent.servings,
      'ml',
      'ml (gần 2 muỗng canh)',
      'dùng phi thơm hành tỏi và khóa ẩm bề mặt nguyên liệu',
    ),
    makeIng(
      'SCALLION',
      'Hành lá, Ngò rí & Ớt hiểm tươi',
      1,
      intent.servings,
      'bunch',
      'bó nhỏ kèm 2 trái ớt',
      'thái nhỏ phần lá xanh, ớt để nguyên trái hoặc xắt lát rắc lúc tắt bếp',
    ),
  ];

  for (const cand of fillerCandidates) {
    if (ingredients.length >= 8) break;
    const dup = ingredients.some(
      (existing) => normalizeIngredientText(existing.nameVi) === normalizeIngredientText(cand.nameVi),
    );
    if (!dup) {
      ingredients.push(cand);
    }
  }

  const finalIngredients = ingredients.slice(0, 8);

  // ── 2. Calibrate Timings & Craft 4–5 Authentic Chef Steps ──────────────────
  const defaultCookByTechnique: Record<DetectedTechnique, number> = {
    kho: 40,
    nuong: 28,
    canh: 22,
    xao: 14,
    hap: 24,
    chao: 38,
    bun: 45,
    chien: 20,
  };

  const prepTimeMinutes = intent.technique === 'xao' || intent.technique === 'chien' ? 12 : 18;
  const rawCookMinutes = defaultCookByTechnique[intent.technique];
  const cookTimeMinutes = input.maxCookTimeMinutes
    ? Math.max(8, Math.min(rawCookMinutes, input.maxCookTimeMinutes))
    : rawCookMinutes;
  const quickAdapted = Boolean(
    input.maxCookTimeMinutes && input.maxCookTimeMinutes < rawCookMinutes,
  );

  const mainCookware: z.infer<typeof HeirloomCookwareSchema> =
    intent.technique === 'kho'
      ? 'claypot'
      : intent.technique === 'canh' || intent.technique === 'chao' || intent.technique === 'bun'
        ? 'stockpot'
        : intent.technique === 'hap'
          ? 'steamer'
          : intent.technique === 'nuong' || intent.technique === 'chien'
            ? 'pan'
            : 'wok';

  const mainStageMinutes = Math.max(4, Math.round(cookTimeMinutes * 0.65));
  const searStageMinutes = Math.max(2, cookTimeMinutes - mainStageMinutes - 2);

  const steps: HeirloomRecipeStep[] = [
    {
      stepNumber: 1,
      titleVi: 'Sơ chế khử mùi & cắt thái chuẩn thớ',
      phase: 'mise_en_place',
      instruction: `Làm sạch ${intent.specificProteinLabelVi.toLowerCase()} theo đúng mẹo bếp truyền thống rồi thấm thật ráo nước${
        quickAdapted
          ? ' (thái miếng mỏng vừa 1,5–2cm để rút ngắn thời gian chín kịp quỹ giờ bận rộn)'
          : ''
      }. Đồng thời băm sẵn hành tím, tỏi và chuẩn bị trọn bộ gia vị thơm bày gọn trên thớt.`,
      timerMinutes: Math.max(5, Math.round(prepTimeMinutes * 0.55)),
      heatLevel: 'off',
      cookware: 'prep_board',
      sensoryCue:
        'Bề mặt nguyên liệu khô ráo săn chắc, không còn mùi tanh hay nước đọng dưới đáy rổ.',
      tip: 'Nguyên liệu càng ráo nước thì khi gặp nhiệt hoặc gia vị càng hút sốt sâu và không bị bắn dầu.',
    },
    {
      stepNumber: 2,
      titleVi:
        intent.technique === 'canh' || intent.technique === 'chao'
          ? 'Ướp nền đằm vị & chuẩn bị cốt hương thơm'
          : 'Tẩm ướp thấm sâu từng thớ nguyên liệu',
      phase: 'marinate',
      instruction: `Cho nguyên liệu chính vào tô lớn, ướp cùng 2/3 lượng gia vị mặn-ngọt, hành tím băm${
        intent.aromatics.includes('rieng')
          ? ', cốt riềng giã tay'
          : intent.aromatics.includes('sa')
            ? ', sả tươi băm mịn'
            : intent.aromatics.includes('gung')
              ? ', gừng sẻ thái chỉ'
              : ''
      } và hạt tiêu xay. Đảo nhẹ tay theo một chiều để gia vị quyện đều trong khoang ướp.`,
      timerMinutes: Math.max(5, prepTimeMinutes - Math.round(prepTimeMinutes * 0.55)),
      heatLevel: 'off',
      cookware: 'prep_board',
      sensoryCue:
        'Lớp sốt ướp áo bóng mượt quanh từng miếng, dậy hương thơm nồng nàn hòa quyện giữa mắm và thảo mộc tươi.',
      tip:
        intent.technique === 'xao'
          ? 'Thêm 1 thìa cà phê dầu ăn vào bước cuối của tô ướp để khóa nước ngọt bên trong thớ thịt.'
          : 'Giữ lại 1/3 lượng nước mắm ngon để nêm ở cuối chặng nấu giúp giữ trọn hương thơm đạm amin.',
    },
    {
      stepNumber: 3,
      titleVi:
        intent.technique === 'kho'
          ? 'Thắng màu hổ phách & săn mặt khử tanh'
          : intent.technique === 'hap'
            ? 'Đun sôi xửng nước hương thảo mộc'
            : 'Phi thơm dậy mùi & khóa ngọt bề mặt',
      phase: 'active_cook',
      instruction:
        intent.technique === 'hap'
          ? 'Đun sôi bùng nước dưới đáy xửng hấp cùng vài lát gừng/sả đập dập trước khi đặt đĩa nguyên liệu vào để hơi nóng già khóa ngay vị ngọt tự nhiên.'
          : `Làm nóng dụng cụ nấu trên lửa vừa lớn, phi thơm hành tỏi${
              intent.aromatics.includes('sa') ? ' cùng gốc sả băm' : ''
            } đến khi vàng rơm rồi trút nguyên liệu đã ướp vào đảo săn hai mặt (hoặc thắng màu cánh gián bóng đẹp nếu kho).`,
      timerMinutes: searStageMinutes,
      heatLevel: intent.technique === 'xao' ? 'high' : 'medium_high',
      cookware: mainCookware,
      sensoryCue:
        'Tiếng xèo giòn rộn ràng, cạnh nguyên liệu săn lại óng ánh và hương thơm bốc lên ngào ngạt khắp gian bếp.',
      tip: 'Không đảo quá nhiều ngay khi vừa cho vào chảo/nồi — đợi 45–60 giây cho mặt dưới săn vàng tự tách đáy.',
    },
    {
      stepNumber: 4,
      titleVi:
        intent.technique === 'kho'
          ? 'Kho liu riu thấm đẫm sốt sánh keo'
          : intent.technique === 'nuong'
            ? 'Nướng / Áp chảo vàng ruộm xém cạnh mật ong'
            : intent.technique === 'xao'
              ? 'Xào lửa lớn giữ trọn độ giòn mọng (Wok Hei)'
              : 'Chế biến chín tới & cân chỉnh hậu vị vùng miền',
      phase: 'active_cook',
      instruction:
        intent.technique === 'kho'
          ? `Châm nước sôi${
              intent.aromatics.includes('nuoc_dua') || intent.region === 'nam'
                ? ' (hoặc nước dừa xiêm tươi)'
                : ''
            } xâm xấp mặt, hớt sạch bọt rồi hạ lửa liu riu đun mở hé vung đến khi nước kho sánh quyện màu cánh gián, rưới phần nước mắm cốt còn lại cho dậy hương.`
          : intent.technique === 'canh' || intent.technique === 'bun' || intent.technique === 'chao'
            ? 'Châm nước sôi vừa đủ khẩu phần, giữ lửa nhỏ vừa hớt sạch bọt gợn để nước trong veo thanh ngọt; thả rau củ/nguyên liệu đi kèm theo thứ tự lâu chín trước – mau chín sau rồi nêm chuẩn vị.'
            : intent.technique === 'nuong' || intent.technique === 'chien'
              ? 'Hạ về lửa vừa ổn định, trở đều các mặt và phết lớp sốt ướp còn dư để bề mặt lên màu vàng nâu óng ả mà tâm bên trong chín mềm mọng nước (đạt nhiệt độ an toàn ≥ 74°C với gia cầm).'
              : 'Giữ lửa lớn đảo nhanh tay cùng rau củ đi kèm trong vài phút cuối, rưới phần sốt quanh thành chảo nóng để hơi sốt bốc lên thấm đều mà không bị ra nước.',
      timerMinutes: mainStageMinutes,
      heatLevel:
        intent.technique === 'kho' || intent.technique === 'chao'
          ? 'low'
          : intent.technique === 'xao'
            ? 'high'
            : 'medium',
      cookware: mainCookware,
      sensoryCue:
        intent.technique === 'kho'
          ? 'Nước kho sôi lục bục chậm rãi, bong bóng sốt sánh đặc ánh nâu hổ phách bám đều từng thớ thịt cá.'
          : intent.technique === 'canh' || intent.technique === 'bun'
            ? 'Mặt nước sôi lăn tăn trong trẻo, rau củ chín tới giữ sắc xanh đỏ tươi tắn, hậu vị thanh tao.'
            : 'Màu sắc nguyên liệu bóng đẹp bắt mắt, thớ thịt chín mềm mọng nước không hề khô bã.',
      tip:
        intent.technique === 'kho'
          ? 'Luôn châm bằng nước thật sôi — tuyệt đối không châm nước lạnh giữa chừng để món kho không bị tanh hay sượng.'
          : 'Nếm lại ở 1 phút cuối cùng khi nhiệt vừa dịu để cảm nhận chính xác độ cân bằng mặn – ngọt – thanh.',
    },
    {
      stepNumber: 5,
      titleVi: 'Điểm hương thảo mộc & dọn nóng lên mâm',
      phase: 'plate',
      instruction: `Tắt bếp, rắc ngay hành lá, rau thơm đặc trưng${
        intent.aromatics.includes('la_chanh') ? ', sợi lá chanh thái chỉ mịn' : ''
      }${
        intent.aromatics.includes('thi_la') ? ', thì là tươi' : ''
      }, tiêu sọ đập dập và vài lát ớt đỏ lên mặt món. Bày ra đĩa sâu lòng hoặc giữ nguyên trong nồi đất nóng ấm dọn lên mâm cơm gia đình.`,
      timerMinutes: 2,
      heatLevel: 'off',
      cookware: 'prep_board',
      sensoryCue:
        'Làn khói ấm quyện tinh dầu thảo mộc tươi và tiêu mới xay lan tỏa, đánh thức trọn vẹn vị giác cả nhà.',
      tip: 'Rắc lá chanh/thì là/ngò gai ngay sau khi tắt bếp giúp giữ màu xanh ngọc và không làm tinh dầu bị đắng.',
    },
  ];

  // ── 3. Compose Description & Heirloom Chef Secret ──────────────────────────
  const storyClean = input.familyStoryVi?.trim();
  const descriptionVi = storyClean
    ? `Lấy cảm hứng từ ký ức gia đình ("${storyClean}"), công thức ${titleVi} tái hiện trọn vẹn phong vị ${
        REGION_SOUL_LABEL_VI[intent.region]
      } với từng bước canh lửa, chọn nguyên liệu tươi chợ sớm và tỷ lệ nêm nếm hài hòa đưa cơm.`
    : `Công thức ${titleVi} mang trọn tinh thần ${
        REGION_SOUL_LABEL_VI[intent.region]
      } — kết hợp kỹ thuật xử lý nguyên liệu sạch trong, tầng hương thảo mộc tươi dậy vị và độ chín chuẩn mực của bếp trưởng Việt.`;

  const chefSecretVi =
    intent.technique === 'kho'
      ? 'Bí quyết gia truyền món kho ngon gấp đôi: Sau khi kho thấm lần 1 khoảng 25 phút, tắt bếp để nghỉ 15 phút cho thớ thịt/cá co nhẹ hút ngược nước sốt vào tâm, rồi bật lửa nhỏ liu riu thêm 10 phút với 1 thìa mỡ heo/dầu hành cho mặt sốt bóng gương.'
      : intent.technique === 'canh' || intent.technique === 'bun'
        ? 'Bí quyết nước canh/nước dùng trong vắt ngọt hậu mà không cần mì chính: Nướng xém nhẹ 1 củ hành tím hoặc lát gừng thả vào nồi ngay lúc mới sôi lăn tăn, không đậy kín vung và vắt vị chua/rắc rau thơm ngay khi vừa tắt bếp.'
        : intent.technique === 'nuong' || intent.technique === 'chien'
          ? 'Bí quyết vàng giòn ngoài – mọng mềm trong: Luôn thấm thật khô bề mặt nguyên liệu và chỉ phết lớp mật ong/nước sốt ngọt ở 3 phút cuối cùng để tạo lớp caramel óng ả thơm khói mà không hề cháy đắng.'
          : intent.technique === 'hap'
            ? 'Bí quyết hấp giữ 100% nước ngọt tự nhiên: Chỉ đặt nguyên liệu vào xửng khi nước đã sôi già bốc hơi mạnh, và bọc 1 chiếc khăn sạch dưới nắp vung để nước ngưng tụ không nhỏ ngược làm nhạt mặt món ăn.'
            : 'Bí quyết "hơi chảo" (Wok Hei) chuẩn đầu bếp Việt: Chia làm 2 lượt — xào săn đạm tới 80% chín rồi trút ra đĩa riêng, xào rau củ chín giòn trên lửa lớn nhất rồi mới trút đạm quay lại đảo quyện sốt 30 giây cuối.';

  const allergenWarningsVi = detectAllergenNotesVi(
    finalIngredients,
    input.householdAllergens,
    adaptationNotes,
  );

  const difficulty: 'easy' | 'medium' | 'hard' =
    intent.technique === 'bun' || (intent.technique === 'kho' && cookTimeMinutes >= 38)
      ? 'medium'
      : 'easy';

  return {
    titleVi,
    slug,
    descriptionVi,
    ...(storyClean ? { familyStoryVi: storyClean } : {}),
    region: intent.region,
    category,
    difficulty,
    prepTimeMinutes,
    cookTimeMinutes,
    totalTimeMinutes: prepTimeMinutes + cookTimeMinutes,
    servings: intent.servings,
    ingredients: finalIngredients,
    steps,
    chefSecretVi,
    allergenWarningsVi,
    tags: [
      'gia_truyen_v6',
      intent.region,
      category,
      intent.technique,
      intent.protein,
    ],
    mode: 'culinary_knowledge_engine',
    confidence: 0.91,
  };
}

// ── Main Async Architect Entrypoint ──────────────────────────────────────────

/**
 * Crafts a complete, authentic Vietnamese Heirloom Recipe Blueprint (`HeirloomRecipeBlueprint`).
 * 1. Inspects `promptVi` and `familyStoryVi` via `inspectPromptSafety` (`prompt-guard.ts`) first.
 * 2. Dispatches structured generation through `TakolioAiGateway` when a live provider is configured.
 * 3. Falls back deterministically to `synthesizeHeirloomRecipeDeterministic` when `gateway` is null,
 *    in mock mode, or when upstream providers fail/violate food-safety gates.
 */
export async function craftHeirloomRecipeWithAi(
  gateway: TakolioAiGateway | null,
  input: HeirloomRecipePromptInput,
): Promise<HeirloomRecipeBlueprint> {
  if (!input || typeof input.promptVi !== 'string' || input.promptVi.trim().length < 2) {
    throw new AIPromptGuardError(
      'Mô tả món ăn (promptVi) không được để trống — hãy nhập ít nhất tên món hoặc nguyên liệu bạn muốn chế biến.',
      { flags: ['EMPTY_OR_TOO_SHORT_PROMPT'], riskScore: 1 },
    );
  }

  // 1. Mandatory PromptGuard check on promptVi & familyStoryVi FIRST
  const promptSafety = inspectPromptSafety(input.promptVi);
  if (!promptSafety.safe) {
    throw new AIPromptGuardError(
      'Yêu cầu thiết kế công thức chứa nội dung không an toàn hoặc vượt ngoài phạm vi ẩm thực gia đình Takolio.',
      promptSafety,
    );
  }

  let sanitizedStoryVi: string | undefined;
  if (typeof input.familyStoryVi === 'string' && input.familyStoryVi.trim().length > 0) {
    const storySafety = inspectPromptSafety(input.familyStoryVi);
    if (!storySafety.safe) {
      throw new AIPromptGuardError(
        'Câu chuyện kỷ niệm gia đình chứa nội dung không an toàn hoặc dấu hiệu can thiệp câu lệnh hệ thống.',
        storySafety,
      );
    }
    sanitizedStoryVi = storySafety.sanitizedText;
  }

  const parsedInput = HeirloomRecipePromptInputSchema.parse({
    ...input,
    promptVi: promptSafety.sanitizedText,
    ...(sanitizedStoryVi !== undefined ? { familyStoryVi: sanitizedStoryVi } : {}),
  });

  const hasLiveExternalProvider =
    gateway !== null &&
    gateway !== undefined &&
    (typeof gateway.getConfiguredExternalProviders === 'function'
      ? gateway.getConfiguredExternalProviders().length > 0
      : typeof gateway.executeStructured === 'function');

  // 2. If gateway is null or in offline/mock mode without live providers, use chef-grade deterministic synthesis directly
  if (!hasLiveExternalProvider || !gateway) {
    return HeirloomRecipeBlueprintSchema.parse(
      synthesizeHeirloomRecipeDeterministic(parsedInput),
    );
  }

  // 3. Live LLM Structured Generation via TakolioAiGateway + Output Safety Gate + Deterministic Fallback
  const result = await gateway.executeStructured<
    HeirloomRecipePromptInput,
    HeirloomRecipeBlueprint
  >({
    tier: 'sous_chef_copilot',
    telemetryTask: 'heirloom_recipe_architect',
    userId: parsedInput.userId ?? parsedInput.householdId ?? null,
    input: parsedInput,
    hasRichContext: Boolean(parsedInput.familyStoryVi || parsedInput.regionHint),
    systemPrompt: `Bạn là Nghệ Nhân Ẩm Thực Gia Truyền Việt Nam (Heirloom Recipe Architect V6) của Takolio.
Nhiệm vụ: Thiết kế công thức món ăn Việt chuẩn vị bếp trưởng từ mô tả món (promptVi) và câu chuyện ký ức gia đình (familyStoryVi).
YÊU CẦU CHẤT LƯỢNG BẮT BUỘC:
1. Gồm 5–8 nguyên liệu thực tế ngoài chợ Việt (ingredients), định lượng chuẩn khẩu phần servings, unit thuộc ["g","kg","ml","l","piece","pack","bunch","slice"] kèm marketUnitVi tự nhiên.
2. Gồm 4–5 bước nấu chi tiết (steps) có đầy đủ phase ("mise_en_place"|"marinate"|"active_cook"|"plate"), timerMinutes, heatLevel, cookware, sensoryCue sống động và tip thực chiến.
3. Tôn trọng tuyệt đối householdAllergens và maxCookTimeMinutes; thịt gia cầm bắt buộc chín ≥ 74°C, thịt heo ≥ 71°C.
4. Trả về DUY NHẤT JSON khớp schema HeirloomRecipeBlueprint.`,
    buildUserPrompt: (clean) => JSON.stringify(clean),
    schema: HeirloomRecipeBlueprintSchema,
    deterministicFallback: (clean) => synthesizeHeirloomRecipeDeterministic(clean),
    outputSafetyGate: (output, clean) => {
      const safetyFlags: string[] = [];
      const joinedSteps = output.steps.map((s) => s.instruction).join(' ');
      const foodSafety = inspectCulinaryFoodSafety(joinedSteps);
      if (!foodSafety.safe) {
        safetyFlags.push(...foodSafety.flags);
        return {
          output: synthesizeHeirloomRecipeDeterministic(clean),
          safetyFlags,
        };
      }

      // Verify maxCookTimeMinutes ceiling if requested
      let cookMins = output.cookTimeMinutes;
      if (clean.maxCookTimeMinutes && cookMins > clean.maxCookTimeMinutes) {
        cookMins = clean.maxCookTimeMinutes;
      }

      // Ensure allergenWarningsVi always reflects actual ingredients + householdAllergens
      const computedWarnings = detectAllergenNotesVi(
        output.ingredients,
        clean.householdAllergens,
        output.allergenWarningsVi,
      );

      return {
        output: {
          ...output,
          cookTimeMinutes: cookMins,
          totalTimeMinutes: output.prepTimeMinutes + cookMins,
          allergenWarningsVi: computedWarnings,
        },
        safetyFlags,
      };
    },
  });

  return result.data;
}
