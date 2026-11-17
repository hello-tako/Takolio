import { z } from 'zod';
import {
  CANONICAL_INGREDIENTS,
  findCanonicalIngredient,
  findCanonicalIngredientById,
  normalizeIngredientText,
} from '@frigo/domain';
import type { AIConfig } from './types';
import type { CloudflareAIBinding } from './providers/cloudflare';
import type { TelemetryD1Database } from './d1-telemetry';
import { createGovernanceConfig } from './model-governance';
import {
  TakolioAiGateway,
  inspectCulinaryFoodSafety,
  matchesHouseholdAllergen,
} from './gateway-v4';

// ── Shared Input & Output Schemas ────────────────────────────────────────────

export const CulinaryFridgeItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(160),
  ingredientId: z.string().nullable().optional(),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1).max(32),
  category: z.string().max(48).optional(),
  storage: z.string().max(32).optional(),
  expiryDate: z.string().nullable().optional(),
  freshness: z.string().max(32).optional(),
});

export type CulinaryFridgeItem = z.infer<typeof CulinaryFridgeItemSchema>;

export const RecipeLineItemSchema = z.object({
  name: z.string().min(1).max(160),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1).max(32),
});

export const SousChefSubstitutionItemSchema = z.object({
  missing: z.string().min(1),
  replacement: z.string().min(1),
  ratioNoteVi: z.string().min(1),
  inFridge: z.boolean(),
});

export type SousChefSubstitutionItem = z.infer<typeof SousChefSubstitutionItemSchema>;

export const SousChefContextInputSchema = z.object({
  question: z.string().trim().min(1, 'Câu hỏi không được để trống').max(1_200),
  recipeTitle: z.string().trim().max(200).optional(),
  currentStepNumber: z.number().int().min(1).max(60).optional(),
  currentStepText: z.string().trim().max(1_500).optional(),
  heatLevel: z.string().trim().max(48).optional(),
  recipeIngredients: z.array(RecipeLineItemSchema).max(60).optional(),
  fridgeItems: z.array(CulinaryFridgeItemSchema).max(150).optional(),
  householdAllergens: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  servings: z.number().int().min(1).max(24).optional(),
});

export type SousChefContextInput = z.infer<typeof SousChefContextInputSchema>;

export const SousChefResponseSchema = z.object({
  answerVi: z.string().min(1),
  quickActionTitle: z.string().optional(),
  chefSecretVi: z.string().optional(),
  suggestedTimerSeconds: z.number().int().positive().max(28_800).optional(),
  suggestedHeatLevel: z.enum(['low', 'medium', 'high']).optional(),
  safeSubstitutions: z.array(SousChefSubstitutionItemSchema).max(8).optional(),
  safetyAlertVi: z.string().optional(),
  confidence: z.number().min(0).max(1),
  mode: z.enum(['llm', 'culinary_knowledge_engine']),
  latencyMs: z.number().int().nonnegative(),
});

export type SousChefResponse = z.infer<typeof SousChefResponseSchema>;

export const DishRoleSchema = z.enum(['braise', 'soup', 'stir_fry', 'marinade', 'garnish']);
export type DishRole = z.infer<typeof DishRoleSchema>;

export const SmartSubstitutionInputSchema = z.object({
  ingredientName: z.string().trim().min(1, 'Tên nguyên liệu cần thay thế là bắt buộc').max(160),
  ingredientId: z.string().trim().max(80).optional(),
  requiredQuantity: z.number().positive().max(100_000).optional(),
  unit: z.string().trim().max(32).optional(),
  dishRole: DishRoleSchema.optional(),
  recipeTitle: z.string().trim().max(200).optional(),
  fridgeItems: z.array(CulinaryFridgeItemSchema).max(150).optional(),
  householdAllergens: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
});

export type SmartSubstitutionInput = z.infer<typeof SmartSubstitutionInputSchema>;

export const SmartSubstitutionCandidateSchema = z.object({
  replacementName: z.string().min(1),
  replacementCanonicalId: z.string().nullable(),
  conversionRatioVi: z.string().min(1),
  convertedQuantityVi: z.string().optional(),
  flavorImpactVi: z.string().min(1),
  bestForRoles: z.array(z.string()).max(6),
  inFridge: z.boolean(),
  fridgeStockNoteVi: z.string().optional(),
  allergenSafe: z.literal(true),
  rankScore: z.number().min(0).max(1),
});

export type SmartSubstitutionCandidate = z.infer<typeof SmartSubstitutionCandidateSchema>;

export const SmartSubstitutionResponseSchema = z.object({
  ingredientName: z.string().min(1),
  canonicalId: z.string().nullable(),
  dishRole: z.enum(['braise', 'soup', 'stir_fry', 'marinade', 'garnish', 'general']),
  substitutions: z.array(SmartSubstitutionCandidateSchema).max(8),
  excludedAllergenItems: z.array(z.string()),
  chefTipVi: z.string().min(1),
  safetyAlertVi: z.string().optional(),
  confidence: z.number().min(0).max(1),
  mode: z.enum(['llm', 'culinary_knowledge_engine']),
  latencyMs: z.number().int().nonnegative(),
});

export type SmartSubstitutionResponse = z.infer<typeof SmartSubstitutionResponseSchema>;

export const FridgeRescueInputSchema = z.object({
  fridgeItems: z.array(CulinaryFridgeItemSchema).max(150),
  householdAllergens: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  availableCookTimeMinutes: z.number().int().min(5).max(180).optional(),
  servings: z.number().int().min(1).max(20).optional(),
});

export type FridgeRescueInput = z.infer<typeof FridgeRescueInputSchema>;

export const FridgeRescueBriefSchema = z.object({
  headlineVi: z.string().min(1),
  urgencyLevel: z.enum(['critical', 'moderate', 'calm']),
  priorityRescueCombo: z.object({
    titleVi: z.string().min(1),
    rationaleVi: z.string().min(1),
    rescuedItems: z.array(z.string()).max(12),
    matchScore: z.number().min(0).max(1),
  }),
  quickRescueDish: z.object({
    dishNameVi: z.string().min(1),
    cookTimeMinutes: z.number().int().min(5).max(120),
    difficulty: z.enum(['easy', 'medium']),
    heroIngredients: z.array(z.string()).max(10),
    pantryStaplesVi: z.array(z.string()).max(8),
    stepsVi: z.array(z.string().min(1)).min(2).max(6),
    chefSecretVi: z.string().min(1),
  }),
  storageExtensionTips: z
    .array(
      z.object({
        itemName: z.string().min(1),
        freshness: z.enum(['expiring', 'use_soon', 'fresh']),
        extensionTipVi: z.string().min(1),
        extraDaysGained: z.number().int().min(1).max(90),
        canFreeze: z.boolean(),
      }),
    )
    .max(10),
  estimatedWasteSavedVnd: z.number().int().nonnegative(),
  wasteSavedBreakdown: z
    .array(
      z.object({
        itemName: z.string().min(1),
        quantityLabel: z.string().min(1),
        estimatedVnd: z.number().int().nonnegative(),
      }),
    )
    .max(15),
  allergenFilteredItems: z.array(z.string()),
  safetyAlertVi: z.string().optional(),
  confidence: z.number().min(0).max(1),
  mode: z.enum(['llm', 'culinary_knowledge_engine']),
  latencyMs: z.number().int().nonnegative(),
});

export type FridgeRescueBrief = z.infer<typeof FridgeRescueBriefSchema>;

// ── Flexible Execution Environment Adapter ───────────────────────────────────

export interface CulinaryEnvBindings {
  QWEN_API_KEY?: string;
  QWEN_BASE_URL?: string;
  QWEN_MODEL?: string;
  QWEN_REQUEST_TIMEOUT_MS?: string | number;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_FALLBACK_ENABLED?: string | boolean;
  GROQ_API_KEY?: string;
  GROQ_BASE_URL?: string;
  GROQ_FALLBACK_ENABLED?: string | boolean;
  AI?: CloudflareAIBinding;
  AI_MOCK_MODE?: string | boolean;
  AI_ENABLED?: string | boolean;
  DB?: TelemetryD1Database | null;
  userId?: string | null;
  waitUntil?: (promise: Promise<unknown>) => void;
  signal?: AbortSignal;
}

export type CulinaryExecutionEnv = TakolioAiGateway | AIConfig | CulinaryEnvBindings | undefined;

function toGateway(env: CulinaryExecutionEnv): {
  gateway: TakolioAiGateway;
  userId?: string | null;
  signal?: AbortSignal;
} {
  if (env instanceof TakolioAiGateway) {
    return { gateway: env };
  }
  if (!env) {
    return { gateway: new TakolioAiGateway({ config: { aiMockMode: true } }) };
  }
  if ('qwenApiKey' in env || 'aiMockMode' in env || 'governance' in env) {
    const cfg = env as AIConfig;
    return { gateway: new TakolioAiGateway({ config: cfg, waitUntil: cfg.backgroundExecutor }) };
  }
  const bindings = env as CulinaryEnvBindings;
  const aiEnabled = bindings.AI_ENABLED !== 'false' && bindings.AI_ENABLED !== false;
  const config: AIConfig = {
    aiMockMode: bindings.AI_MOCK_MODE === 'true' || bindings.AI_MOCK_MODE === true,
    qwenApiKey: bindings.QWEN_API_KEY,
    qwenBaseUrl: bindings.QWEN_BASE_URL,
    qwenModel: bindings.QWEN_MODEL,
    qwenRequestTimeoutMs: bindings.QWEN_REQUEST_TIMEOUT_MS ? Number(bindings.QWEN_REQUEST_TIMEOUT_MS) : undefined,
    deepseekApiKey: bindings.DEEPSEEK_API_KEY,
    deepseekBaseUrl: bindings.DEEPSEEK_BASE_URL,
    deepseekFallbackEnabled: bindings.DEEPSEEK_FALLBACK_ENABLED === 'true' || bindings.DEEPSEEK_FALLBACK_ENABLED === true,
    groqApiKey: bindings.GROQ_API_KEY,
    groqBaseUrl: bindings.GROQ_BASE_URL,
    groqFallbackEnabled: bindings.GROQ_FALLBACK_ENABLED === 'true' || bindings.GROQ_FALLBACK_ENABLED === true,
    aiBinding: bindings.AI,
    backgroundExecutor: bindings.waitUntil,
  };
  if (!aiEnabled) {
    config.governance = createGovernanceConfig({ AI_ENABLED: 'false' });
  }
  return {
    gateway: new TakolioAiGateway({
      config,
      db: bindings.DB ?? null,
      waitUntil: bindings.waitUntil,
    }),
    userId: bindings.userId ?? null,
    signal: bindings.signal,
  };
}

// ── Vietnamese Culinary Substitution Knowledge Graph ─────────────────────────

interface SubstitutionRuleEntry {
  canonicalId: string | null;
  keywords: readonly string[];
  chefTipVi: string;
  options: ReadonlyArray<{
    name: string;
    canonicalId: string | null;
    ratioMultiplier: number;
    ratioTextVi: string;
    flavorImpactVi: string;
    roles: readonly DishRole[];
  }>;
}

const SUBSTITUTION_GRAPH: readonly SubstitutionRuleEntry[] = [
  {
    canonicalId: 'FISH_SAUCE',
    keywords: ['nuoc mam', 'mam', 'mam nhi', 'fish sauce'],
    chefTipVi: 'Nêm nước mắm ở cuối quá trình nấu hoặc khi hạ nhỏ lửa để giữ trọn hương đạm amin tự nhiên, tránh bị chua gắt.',
    options: [
      {
        name: 'Xì dầu / Nước tương ủ tự nhiên',
        canonicalId: 'SOY_SAUCE',
        ratioMultiplier: 1.15,
        ratioTextVi: '1 thìa nước mắm = 1 thìa nước tương + 1 nhúm nhỏ muối hạt',
        flavorImpactVi: 'Vị mặn dịu và thơm mùi đậu nành rang; hợp món xào, kho chay và ướp thịt nhanh.',
        roles: ['stir_fry', 'marinade', 'braise'],
      },
      {
        name: 'Muối biển + Nước nấm hương ngâm ấm',
        canonicalId: 'MUSHROOM',
        ratioMultiplier: 1,
        ratioTextVi: '1 thìa canh nước mắm = 1/3 thìa cà phê muối + 1 thìa canh nước ngâm nấm hương',
        flavorImpactVi: 'Tạo chiều sâu vị ngọt umami thanh thoát, không mùi cá — lý tưởng cho người dị ứng hải sản hoặc ăn chay.',
        roles: ['soup', 'braise', 'stir_fry'],
      },
      {
        name: 'Dầu hào + chút muối tinh',
        canonicalId: null,
        ratioMultiplier: 1,
        ratioTextVi: '1 thìa nước mắm = 3/4 thìa dầu hào + 1 nhúm muối nhỏ',
        flavorImpactVi: 'Tăng độ sánh bóng và vị ngọt đậm cho các món rau xào hoặc thịt ướp áp chảo.',
        roles: ['stir_fry', 'marinade'],
      },
    ],
  },
  {
    canonicalId: 'SOY_SAUCE',
    keywords: ['xi dau', 'nuoc tuong', 'soy sauce', 'tamari'],
    chefTipVi: 'Nếu dùng nước mắm thay xì dầu trong món xào, hãy giảm 25% lượng dùng vì độ mặn của nước mắm Việt Nam cao hơn.',
    options: [
      {
        name: 'Nước mắm pha loãng chút đường nâu',
        canonicalId: 'FISH_SAUCE',
        ratioMultiplier: 0.75,
        ratioTextVi: '1 thìa xì dầu = 3/4 thìa nước mắm + 1/4 thìa cà phê đường',
        flavorImpactVi: 'Đậm đà kiểu Việt truyền thống, lên màu hổ phách đẹp khi kho hoặc rim.',
        roles: ['braise', 'marinade', 'stir_fry'],
      },
      {
        name: 'Muối + chút nước màu dừa + nước dùng nấm',
        canonicalId: 'MUSHROOM',
        ratioMultiplier: 1,
        ratioTextVi: '1 thìa xì dầu = 1/4 thìa cà phê muối + vài giọt nước màu dừa + 1 thìa nước nấm',
        flavorImpactVi: 'An toàn tuyệt đối cho người dị ứng đậu nành & gluten mà vẫn giữ màu nâu óng và vị umami.',
        roles: ['braise', 'stir_fry', 'soup'],
      },
    ],
  },
  {
    canonicalId: 'LIME',
    keywords: ['chanh', 'chanh tuoi', 'nuoc cot chanh', 'lime', 'lemon', 'quat', 'tac'],
    chefTipVi: 'Chỉ vắt chanh hoặc cho chất chua thanh vào nồi canh ngay sau khi tắt bếp để nước canh không bị đắng vì tinh dầu vỏ.',
    options: [
      {
        name: 'Tắc (Quất) tươi',
        canonicalId: null,
        ratioMultiplier: 1.5,
        ratioTextVi: '1 quả chanh = 2 quả tắc tươi (bỏ hạt)',
        flavorImpactVi: 'Vị chua thanh kèm hương tinh dầu thơm nồng đặc trưng, cực hợp pha nước chấm và canh chua.',
        roles: ['garnish', 'marinade', 'soup'],
      },
      {
        name: 'Giấm gạo lên men tự nhiên',
        canonicalId: null,
        ratioMultiplier: 1.2,
        ratioTextVi: '1 thìa nước cốt chanh = 1.2 thìa giấm gạo',
        flavorImpactVi: 'Vị chua dịu ổn định ở nhiệt độ cao, không bị đắng khi đun sôi cùng canh hoặc sốt chua ngọt.',
        roles: ['soup', 'stir_fry', 'marinade'],
      },
      {
        name: 'Dứa / Thơm chín cắt lát',
        canonicalId: 'PINEAPPLE',
        ratioMultiplier: 3,
        ratioTextVi: '1 quả chanh = 3-4 lát dứa tươi nấu lấy nước chua ngọt',
        flavorImpactVi: 'Tạo vị chua dịu kèm enzyme bromelain giúp làm mềm thịt/cá tự nhiên trong món canh hoặc kho.',
        roles: ['soup', 'braise', 'stir_fry'],
      },
    ],
  },
  {
    canonicalId: 'SCALLION',
    keywords: ['hanh la', 'hanh hoa', 'scallion', 'green onion', 'ngo ri', 'rau mui'],
    chefTipVi: 'Chia đầu hành trắng để phi thơm đầu bước nấu và phần lá xanh cắt nhỏ rắc lúc tắt bếp để tận dụng trọn 2 tầng hương.',
    options: [
      {
        name: 'Hành tây thái lát thật mỏng',
        canonicalId: 'ONION',
        ratioMultiplier: 0.5,
        ratioTextVi: '1 nhánh hành lá = 2-3 lát hành tây thái chỉ mỏng',
        flavorImpactVi: 'Giữ được hương thơm ngọt dịu khi gặp nhiệt nóng trong canh, trứng chiên và món xào.',
        roles: ['soup', 'stir_fry', 'marinade'],
      },
      {
        name: 'Tỏi phi vàng giòn + vài lát ớt sừng',
        canonicalId: 'GARLIC',
        ratioMultiplier: 0.5,
        ratioTextVi: 'Thay phần hành lá rắc mặt bằng 1 thìa cà phê tỏi phi thơm',
        flavorImpactVi: 'Tạo điểm nhấn dậy mùi thơm béo cho cháo, canh súp hoặc rau xào khi hết rau thơm tươi.',
        roles: ['garnish', 'stir_fry', 'soup'],
      },
    ],
  },
  {
    canonicalId: 'GARLIC',
    keywords: ['toi', 'cu toi', 'garlic', 'hanh tim', 'hanh kho', 'shallot'],
    chefTipVi: 'Cho tỏi băm vào chảo khi dầu vừa ấm nhẹ, phi lửa vừa tới khi vàng rơm là cho nguyên liệu vào ngay để tỏi không cháy đắng.',
    options: [
      {
        name: 'Hành tây băm nhuyễn',
        canonicalId: 'ONION',
        ratioMultiplier: 1.5,
        ratioTextVi: '2 tép tỏi = 1.5 thìa canh hành tây băm nhỏ',
        flavorImpactVi: 'Tạo nền hương thơm ngọt thanh và giúp sốt kho/xào sánh tự nhiên.',
        roles: ['stir_fry', 'braise', 'marinade', 'soup'],
      },
      {
        name: 'Đầu hành lá trắng đập dập + lát gừng mỏng',
        canonicalId: 'SCALLION',
        ratioMultiplier: 1,
        ratioTextVi: '2 tép tỏi = 3 đầu hành trắng đập dập + 2 lát gừng mỏng',
        flavorImpactVi: 'Khử mùi tanh thịt cá cực hiệu quả và dậy mùi thơm thanh tao.',
        roles: ['marinade', 'braise', 'soup', 'stir_fry'],
      },
    ],
  },
  {
    canonicalId: 'GINGER',
    keywords: ['gung', 'cu gung', 'ginger'],
    chefTipVi: 'Đập dập gừng thay vì băm nhỏ khi nấu canh hoặc luộc để tinh dầu tiết ra từ từ mà nước dùng vẫn trong.',
    options: [
      {
        name: 'Sả tươi đập dập',
        canonicalId: 'LEMONGRASS',
        ratioMultiplier: 1,
        ratioTextVi: '1 nhánh gừng nhỏ = 1 cây sả đập dập cắt khúc',
        flavorImpactVi: 'Khử tanh hải sản, gà, bò xuất sắc với hương the mát sảng khoái.',
        roles: ['braise', 'soup', 'marinade'],
      },
      {
        name: 'Tiêu đen đập dập + chút vỏ chanh mỏng',
        canonicalId: 'LIME',
        ratioMultiplier: 0.5,
        ratioTextVi: '10g gừng = 1/2 thìa cà phê tiêu hạt đập dập',
        flavorImpactVi: 'Giữ độ ấm nồng cay nhẹ cho món kho và canh ngày mưa.',
        roles: ['braise', 'soup', 'marinade'],
      },
    ],
  },
  {
    canonicalId: 'PORK_BELLY',
    keywords: ['thit ba chi', 'ba chi', 'ba roi', 'pork belly', 'thit heo', 'thit heo xay', 'ground pork'],
    chefTipVi: 'Áp chảo sơ mặt thịt trên chảo nóng không dầu 2 phút trước khi kho để khóa ngọt và giúp mỡ săn trong.',
    options: [
      {
        name: 'Đùi gà lọc xương cắt miếng vừa ăn',
        canonicalId: 'CHICKEN_THIGH',
        ratioMultiplier: 1,
        ratioTextVi: 'Thay thế tỷ lệ 1:1 theo khối lượng (giảm thời gian kho khoảng 25%)',
        flavorImpactVi: 'Thịt mềm mọng không bị khô bã, ít mỡ bão hòa hơn ba chỉ mà vẫn thấm đẫm sốt kho/xào.',
        roles: ['braise', 'stir_fry', 'marinade'],
      },
      {
        name: 'Đậu phụ chiên vàng + Nấm đùi gà cắt quân cờ',
        canonicalId: 'TOFU',
        ratioMultiplier: 1,
        ratioTextVi: '300g thịt ba chỉ = 2 bìa đậu phụ chiên sơ + 150g nấm đùi gà',
        flavorImpactVi: 'Thấm sốt kho tiêu/sốt cà chua cực bắt cơm, giòn ngoài mềm trong và thanh nhẹ.',
        roles: ['braise', 'stir_fry', 'soup'],
      },
      {
        name: 'Sườn heo non chặt miếng',
        canonicalId: 'PORK_RIBS',
        ratioMultiplier: 1.15,
        ratioTextVi: '300g thịt ba chỉ = 350g sườn non (tính cả phần xương ngọt nước)',
        flavorImpactVi: 'Nước kho hoặc nước canh ngọt thanh tự nhiên từ tủy xương, thịt giòn mềm.',
        roles: ['braise', 'soup'],
      },
    ],
  },
  {
    canonicalId: 'CHICKEN_BREAST',
    keywords: ['uc ga', 'chicken breast', 'dui ga', 'chicken thigh', 'thit ga'],
    chefTipVi: 'Thái ức gà ngang thớ nghiêng dao 45 độ và ướp 1 thìa cà phê dầu ăn + chút bột bắp 10 phút giúp thịt mềm mướt như nhà hàng.',
    options: [
      {
        name: 'Đậu phụ non / Đậu phụ trắng cắt vuông',
        canonicalId: 'TOFU',
        ratioMultiplier: 1,
        ratioTextVi: 'Thay thế tỷ lệ 1:1 theo khối lượng, áp chảo vàng 2 mặt trước khi sốt',
        flavorImpactVi: 'Giàu đạm thực vật, mềm béo dịu và thấm gia vị rất nhanh.',
        roles: ['stir_fry', 'braise', 'soup'],
      },
      {
        name: 'Thịt heo thăn hoặc nạc vai thái mỏng',
        canonicalId: 'GROUND_PORK',
        ratioMultiplier: 1,
        ratioTextVi: 'Thay thế tỷ lệ 1:1 theo khối lượng',
        flavorImpactVi: 'Độ mềm tương đương, dễ kết hợp với gừng, sả ớt hoặc rau củ xào.',
        roles: ['stir_fry', 'braise', 'soup', 'marinade'],
      },
      {
        name: 'Nấm đùi gà xé sợi / thái lát dày',
        canonicalId: 'MUSHROOM',
        ratioMultiplier: 1,
        ratioTextVi: '250g ức gà = 250g nấm đùi gà áp chảo xém cạnh',
        flavorImpactVi: 'Thớ nấm dai giòn sần sật rất giống thịt gà xé, ngọt thanh tự nhiên.',
        roles: ['stir_fry', 'braise', 'soup'],
      },
    ],
  },
  {
    canonicalId: 'SHRIMP',
    keywords: ['tom', 'tom tuoi', 'tom su', 'shrimp', 'muc', 'squid', 'hai san'],
    chefTipVi: 'Tôm/mực nấu trên lửa lớn rất nhanh chín (chỉ 2-3 phút khi chuyển màu hồng cam chữ C); nấu quá lâu sẽ bị dai và co rút.',
    options: [
      {
        name: 'Thịt heo băm viên nhỏ',
        canonicalId: 'GROUND_PORK',
        ratioMultiplier: 1,
        ratioTextVi: '200g tôm tươi = 200g thịt heo xay vo viên nhỏ',
        flavorImpactVi: 'Giữ trọn vị ngọt đằm cho canh bầu, canh bí đao hoặc rau củ xào; an toàn cho người dị ứng hải sản.',
        roles: ['soup', 'stir_fry'],
      },
      {
        name: 'Nấm đùi gà + Đậu phụ trắng',
        canonicalId: 'MUSHROOM',
        ratioMultiplier: 1,
        ratioTextVi: '200g tôm = 150g nấm tươi + 1 bìa đậu phụ',
        flavorImpactVi: 'Vị ngọt thanh tự nhiên từ nấm giúp nước canh trong và nhẹ bụng.',
        roles: ['soup', 'stir_fry'],
      },
      {
        name: 'Ức gà thái hạt lựu ướp tiêu',
        canonicalId: 'CHICKEN_BREAST',
        ratioMultiplier: 1,
        ratioTextVi: 'Thay thế tỷ lệ 1:1 theo khối lượng',
        flavorImpactVi: 'Nhanh chín, giàu đạm nạc, rất hợp các món xào thập cẩm hoặc cơm chiên.',
        roles: ['stir_fry', 'soup'],
      },
    ],
  },
  {
    canonicalId: 'CHICKEN_EGG',
    keywords: ['trung ga', 'trung', 'egg', 'trung vit'],
    chefTipVi: 'Thêm 1/2 thìa cà phê nước lọc hoặc vài giọt nước cốt chanh khi đánh trứng giúp trứng chiên bông xốp và mềm lâu hơn.',
    options: [
      {
        name: 'Đậu phụ non dầm nhẹ + nhúm bột nghệ',
        canonicalId: 'TOFU',
        ratioMultiplier: 1,
        ratioTextVi: '2 quả trứng gà = 150g đậu phụ non dầm sơ + 1/5 thìa cà phê bột nghệ tạo màu vàng',
        flavorImpactVi: 'Kết cấu mềm mịn như trứng bác, an toàn cho người dị ứng trứng và thuần chay.',
        roles: ['stir_fry', 'soup'],
      },
      {
        name: 'Hỗn hợp bột năng / bột bắp hòa nước (làm chất kết dính)',
        canonicalId: null,
        ratioMultiplier: 1,
        ratioTextVi: '1 quả trứng (trong nhân chả/ướp) = 1 thìa canh bột năng hòa 2 thìa canh nước lạnh',
        flavorImpactVi: 'Giữ độ kết dính dẻo dai cho chả viên hoặc lớp áo chiên giòn mà không cần trứng.',
        roles: ['marinade', 'braise'],
      },
    ],
  },
  {
    canonicalId: 'FRESH_MILK',
    keywords: ['sua tuoi', 'sua', 'milk', 'kem tuoi', 'whipping cream', 'nuoc cot dua'],
    chefTipVi: 'Khi đun sữa hoặc nước cốt dừa, luôn giữ lửa nhỏ lăn tăn và khuấy đều tay để nhũ tương béo không bị tách dầu.',
    options: [
      {
        name: 'Nước cốt dừa tươi / đóng lon',
        canonicalId: null,
        ratioMultiplier: 0.85,
        ratioTextVi: '100ml sữa tươi = 70ml nước cốt dừa + 30ml nước ấm',
        flavorImpactVi: 'Béo thơm ngậy kiểu nhiệt đới, không chứa lactose — rất hợp súp bí đỏ, cà ri và món kho.',
        roles: ['soup', 'braise', 'marinade'],
      },
      {
        name: 'Sữa hạt không đường (hạnh nhân / yến mạch) hoặc nước luộc rau củ sánh',
        canonicalId: null,
        ratioMultiplier: 1,
        ratioTextVi: 'Thay thế tỷ lệ 1:1 theo thể tích (chọn loại không đường cho món mặn)',
        flavorImpactVi: 'Giữ độ mượt dịu nhẹ cho súp và sốt kem mà không gây đầy bụng do lactose.',
        roles: ['soup', 'stir_fry'],
      },
    ],
  },
  {
    canonicalId: 'BUTTER',
    keywords: ['bo', 'bo lat', 'butter'],
    chefTipVi: 'Pha 1 phần dầu ăn với 1 phần bơ khi áp chảo giúp nâng điểm bốc khói, giữ hương thơm bơ mà không bị cháy khét.',
    options: [
      {
        name: 'Dầu ăn thực vật / Dầu olive + nhúm muối nhỏ',
        canonicalId: 'COOKING_OIL',
        ratioMultiplier: 0.8,
        ratioTextVi: '10g bơ lạt = 8ml dầu ăn (khoảng 1.5 thìa cà phê)',
        flavorImpactVi: 'Chịu nhiệt cao hơn bơ sữa, không chứa lactose/sữa, giúp món xào bóng mượt.',
        roles: ['stir_fry', 'marinade'],
      },
    ],
  },
  {
    canonicalId: 'TOMATO',
    keywords: ['ca chua', 'tomato'],
    chefTipVi: 'Khía chữ thập, trụng sơ cà chua 20 giây để bóc vỏ rồi xào với chút muối ngay từ đầu giúp cà chua nhanh nhuyễn thành sốt đỏ au.',
    options: [
      {
        name: 'Dứa / Thơm chín băm nhỏ + vài giọt nước cốt chanh',
        canonicalId: 'PINEAPPLE',
        ratioMultiplier: 0.75,
        ratioTextVi: '2 quả cà chua = 1/4 quả dứa chín băm nhỏ',
        flavorImpactVi: 'Tạo độ chua ngọt tự nhiên và hương thơm tươi mát cho canh chua hoặc sốt cá/đậu phụ.',
        roles: ['soup', 'braise', 'stir_fry'],
      },
      {
        name: 'Tương cà (Ketchup) giảm đường + chút nước lọc',
        canonicalId: null,
        ratioMultiplier: 0.3,
        ratioTextVi: '2 quả cà chua = 2 thìa canh tương cà hòa 4 thìa canh nước ấm (giảm đường khi nêm)',
        flavorImpactVi: 'Tạo màu đỏ bóng và vị chua ngọt tức thì cho đậu phụ sốt, sườn xào chua ngọt hoặc trứng sốt.',
        roles: ['stir_fry', 'braise'],
      },
    ],
  },
  {
    canonicalId: 'WATER_SPINACH',
    keywords: ['rau muong', 'cai bo xoi', 'rau chan vit', 'bap cai', 'bong cai xanh', 'rau cai'],
    chefTipVi: 'Luôn để lửa lớn nhất và đảo nhanh tay khi xào rau xanh; nêm gia vị ngay trước khi tắt bếp để rau giữ màu xanh ngọc và độ giòn.',
    options: [
      {
        name: 'Bắp cải trắng thái sợi bản vừa',
        canonicalId: 'CABBAGE',
        ratioMultiplier: 1,
        ratioTextVi: '1 bó rau lá = 1/3 cái bắp cải (khoảng 300g)',
        flavorImpactVi: 'Giòn ngọt tự nhiên, bảo quản được lâu trong tủ lạnh và rất hợp xào tỏi hoặc nấu canh.',
        roles: ['stir_fry', 'soup'],
      },
      {
        name: 'Rau chân vịt (Cải bó xôi)',
        canonicalId: 'SPINACH',
        ratioMultiplier: 1,
        ratioTextVi: 'Thay thế tỷ lệ 1:1 theo khối lượng (xào nhanh hơn 30-45 giây vì lá mềm)',
        flavorImpactVi: 'Lá mềm ngọt thanh, giàu sắt, cực hợp xào tỏi hoặc nấu canh thịt băm/trứng.',
        roles: ['stir_fry', 'soup'],
      },
      {
        name: 'Bông cải xanh / Su su thái lát mỏng',
        canonicalId: 'BROCCOLI',
        ratioMultiplier: 1,
        ratioTextVi: 'Thay thế tỷ lệ 1:1 (chần sơ 45 giây trước khi xào để chín đều)',
        flavorImpactVi: 'Giòn sần sật, giữ form đẹp và hút sốt xào rất tốt.',
        roles: ['stir_fry', 'soup'],
      },
    ],
  },
];

function matchFridgeStock(
  candidateName: string,
  candidateCanonicalId: string | null,
  fridgeItems: readonly CulinaryFridgeItem[] | undefined,
): CulinaryFridgeItem | undefined {
  if (!fridgeItems || fridgeItems.length === 0) return undefined;
  const candNorm = normalizeIngredientText(candidateName);
  return fridgeItems.find((item) => {
    if (item.quantity <= 0 || item.freshness === 'out_of_stock') return false;
    if (candidateCanonicalId && item.ingredientId && item.ingredientId.toUpperCase() === candidateCanonicalId.toUpperCase()) {
      return true;
    }
    const itemCanonical = findCanonicalIngredient(item.name);
    if (candidateCanonicalId && itemCanonical?.id === candidateCanonicalId) {
      return true;
    }
    const itemNorm = normalizeIngredientText(item.name);
    return (
      Boolean(itemNorm) &&
      (candNorm.includes(itemNorm) || itemNorm.includes(candNorm))
    );
  });
}

function formatConvertedQuantity(
  requiredQuantity: number | undefined,
  unit: string | undefined,
  multiplier: number,
): string | undefined {
  if (!requiredQuantity || !Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
    return undefined;
  }
  const raw = requiredQuantity * multiplier;
  const rounded = raw >= 10 ? Math.round(raw) : Math.round(raw * 10) / 10;
  return `Khoảng ${rounded}${unit ? ` ${unit}` : ''} cho khẩu phần hiện tại`;
}

// ── 1. Deterministic Smart Substitutions Engine ──────────────────────────────

export function recommendSmartSubstitutionsLocal(
  rawInput: SmartSubstitutionInput,
): SmartSubstitutionResponse {
  const startedAt = Date.now();
  const parsed = SmartSubstitutionInputSchema.parse(rawInput);
  const normTarget = normalizeIngredientText(parsed.ingredientName);
  const canonical =
    (parsed.ingredientId ? findCanonicalIngredientById(parsed.ingredientId) : null) ??
    findCanonicalIngredient(parsed.ingredientName);
  const dishRole = parsed.dishRole ?? 'general';

  const rule = SUBSTITUTION_GRAPH.find((entry) => {
    if (canonical && entry.canonicalId === canonical.id) return true;
    return entry.keywords.some((kw) => normTarget === kw || normTarget.includes(kw));
  });

  const excludedAllergenItems: string[] = [];
  const candidates: SmartSubstitutionCandidate[] = [];

  if (rule) {
    for (const opt of rule.options) {
      const allergenCheck = matchesHouseholdAllergen(
        opt.canonicalId || opt.name,
        parsed.householdAllergens,
      );
      const nameAllergenCheck = matchesHouseholdAllergen(opt.name, parsed.householdAllergens);
      if (allergenCheck.matched || nameAllergenCheck.matched) {
        excludedAllergenItems.push(opt.name);
        continue;
      }

      const fridgeMatch = matchFridgeStock(opt.name, opt.canonicalId, parsed.fridgeItems);
      const roleMatched = dishRole === 'general' || opt.roles.includes(dishRole);
      let score = 0.76 + (roleMatched ? 0.09 : 0) + (fridgeMatch ? 0.12 : 0);
      if (fridgeMatch?.freshness === 'expiring' || fridgeMatch?.freshness === 'use_soon') {
        score += 0.02;
      }

      const convertedQty = formatConvertedQuantity(parsed.requiredQuantity, parsed.unit, opt.ratioMultiplier);
      candidates.push({
        replacementName: opt.name,
        replacementCanonicalId: opt.canonicalId,
        conversionRatioVi: opt.ratioTextVi,
        ...(convertedQty ? { convertedQuantityVi: convertedQty } : {}),
        flavorImpactVi: opt.flavorImpactVi,
        bestForRoles: [...opt.roles],
        inFridge: Boolean(fridgeMatch),
        ...(fridgeMatch
          ? {
              fridgeStockNoteVi: `Có sẵn ${fridgeMatch.quantity} ${fridgeMatch.unit} ${fridgeMatch.name} trong tủ lạnh${
                fridgeMatch.freshness === 'expiring' || fridgeMatch.freshness === 'use_soon'
                  ? ' (nên ưu tiên dùng sớm!)'
                  : ''
              }.`,
            }
          : {}),
        allergenSafe: true,
        rankScore: Math.min(0.99, Math.round(score * 100) / 100),
      });
    }
  }

  // Category-aware fallback from canonical catalog + user's live fridge when ingredient is outside core graph
  if (candidates.length === 0) {
    const targetCategory = canonical?.category ?? 'vegetable';
    const sameCategoryCatalog = CANONICAL_INGREDIENTS.filter(
      (item) =>
        item.category === targetCategory &&
        item.id !== canonical?.id &&
        normalizeIngredientText(item.nameVi) !== normTarget,
    );

    for (const catItem of sameCategoryCatalog) {
      const check = matchesHouseholdAllergen(catItem.id, parsed.householdAllergens);
      if (check.matched) {
        excludedAllergenItems.push(catItem.nameVi);
        continue;
      }
      const fridgeMatch = matchFridgeStock(catItem.nameVi, catItem.id, parsed.fridgeItems);
      const score = fridgeMatch ? 0.88 : 0.72;
      const convertedQty = formatConvertedQuantity(parsed.requiredQuantity, parsed.unit, 1);
      candidates.push({
        replacementName: catItem.nameVi,
        replacementCanonicalId: catItem.id,
        conversionRatioVi: 'Thay thế tỷ lệ 1:1 theo định lượng cùng nhóm nguyên liệu',
        ...(convertedQty ? { convertedQuantityVi: convertedQty } : {}),
        flavorImpactVi: `Cùng nhóm ${
          targetCategory === 'meat'
            ? 'đạm thịt'
            : targetCategory === 'seafood'
              ? 'hải sản ngọt nước'
              : targetCategory === 'spice'
                ? 'gia vị dậy hương'
                : 'rau củ tươi'
        }, giữ cấu trúc món hài hòa và dễ điều chỉnh thời gian chín.`,
        bestForRoles: dishRole === 'general' ? ['stir_fry', 'soup', 'braise'] : [dishRole],
        inFridge: Boolean(fridgeMatch),
        ...(fridgeMatch
          ? {
              fridgeStockNoteVi: `Đang có sẵn ${fridgeMatch.quantity} ${fridgeMatch.unit} ${fridgeMatch.name} trong tủ lạnh.`,
            }
          : {}),
        allergenSafe: true,
        rankScore: score,
      });
      if (candidates.length >= 6) break;
    }
  }

  // Sort strictly: inFridge first, then highest rankScore
  candidates.sort((a, b) => {
    if (a.inFridge !== b.inFridge) return a.inFridge ? -1 : 1;
    return b.rankScore - a.rankScore;
  });

  const topSubstitutions = candidates.slice(0, 4);
  const targetAllergenWarning = matchesHouseholdAllergen(parsed.ingredientName, parsed.householdAllergens);

  return {
    ingredientName: parsed.ingredientName,
    canonicalId: canonical?.id ?? null,
    dishRole,
    substitutions: topSubstitutions,
    excludedAllergenItems: [...new Set(excludedAllergenItems)],
    chefTipVi:
      rule?.chefTipVi ??
      'Khi thay nguyên liệu mới, hãy cho vào từng phần và nếm thử ở lửa vừa để cân chỉnh độ mặn-ngọt chuẩn vị gia đình.',
    ...(targetAllergenWarning.matched || excludedAllergenItems.length > 0
      ? {
          safetyAlertVi: targetAllergenWarning.matched
            ? `Nguyên liệu gốc "${parsed.ingredientName}" nằm trong danh sách dị ứng/kiêng của gia đình — Takolio đã lọc chỉ giữ các phương án thay thế an toàn 100%.`
            : `Đã tự động loại bỏ ${excludedAllergenItems.join(', ')} khỏi gợi ý để bảo vệ hồ sơ dị ứng của gia đình.`,
        }
      : {}),
    confidence: topSubstitutions.some((item) => item.inFridge) ? 0.93 : 0.88,
    mode: 'culinary_knowledge_engine',
    latencyMs: Math.max(1, Date.now() - startedAt),
  };
}

// ── 2. Deterministic Sous-Chef Active Cooking Copilot ────────────────────────

interface CulinaryScenarioRule {
  id: string;
  quickActionTitle: string;
  matches: (foldedQuestion: string) => boolean;
  compose: (ctx: SousChefContextInput, foldedQuestion: string) => {
    answerVi: string;
    chefSecretVi: string;
    suggestedTimerSeconds?: number;
    suggestedHeatLevel?: 'low' | 'medium' | 'high';
    safetyAlertVi?: string;
  };
}

function availableAbsorbentsInFridge(fridgeItems: readonly CulinaryFridgeItem[] | undefined, allergens?: readonly string[]): string[] {
  if (!fridgeItems) return [];
  const helpfulKeywords = ['ca chua', 'dau phu', 'dau hu', 'bi dao', 'cu cai', 'nam', 'bap cai', 'khoai tay'];
  return fridgeItems
    .filter((item) => {
      if (item.quantity <= 0 || item.freshness === 'out_of_stock') return false;
      if (matchesHouseholdAllergen(item.name, allergens).matched) return false;
      const norm = normalizeIngredientText(item.name);
      return helpfulKeywords.some((kw) => norm.includes(kw));
    })
    .map((item) => item.name)
    .slice(0, 3);
}

const SOUS_CHEF_SCENARIOS: readonly CulinaryScenarioRule[] = [
  {
    id: 'seasoning_too_salty',
    quickActionTitle: 'Cứu món bị mặn tức thì',
    matches: (q) => /\b(?:qua\s+man|hoi\s+man|bi\s+man|man\s+qua|lo\s+tay\s+cho\s+muoi|nhieu\s+nuoc\s+mam)\b/.test(q),
    compose: (ctx, q) => {
      const isBraise = /\b(?:kho|rim|ram)\b/.test(q) || /\b(?:kho|rim|ram)\b/.test(normalizeIngredientText(ctx.recipeTitle || ''));
      const fridgeHelpers = availableAbsorbentsInFridge(ctx.fridgeItems, ctx.householdAllergens);
      const fridgeHint =
        fridgeHelpers.length > 0
          ? ` Bạn đang có sẵn **${fridgeHelpers.join(', ')}** trong tủ lạnh — thả thêm vào nấu cùng 4-5 phút sẽ hút bớt vị mặn cực hiệu quả!`
          : '';
      if (isBraise) {
        return {
          answerVi:
            `Với món kho/rim đang bị mặn: Hãy **hạ nhỏ lửa ngay**, chắt bớt khoảng 1/3 nước kho mặn ra bát riêng, sau đó châm thêm **nước sôi nóng** (tuyệt đối không dùng nước lã để tránh tanh thịt/cá) kèm **1/2 thìa cà phê đường phèn hoặc nước dừa tươi** để làm tròn vị.${fridgeHint}`,
          chefSecretVi:
            'Vài lát củ cải trắng hoặc khoai tây gọt vỏ thả vào nồi kho 5 phút hoạt động như "miếng bọt biển" hút muối dư mà không làm loãng hương thơm.',
          suggestedHeatLevel: 'low',
          suggestedTimerSeconds: 240,
        };
      }
      return {
        answerVi:
          `Để chữa món đang hơi mặn: Châm từ từ **50-100ml nước sôi hoặc nước dùng nhạt**, hạ lửa vừa rồi dằn nhẹ **1/3 thìa cà phê đường + vài giọt nước cốt chanh cuối bước** để trung hòa cảm giác mặn gắt trên đầu lưỡi.${fridgeHint}`,
        chefSecretVi:
          'Nguyên tắc tam giác vị Việt: một chút vị chua thanh (chanh/cà chua) ở cuối bước nấu giúp giảm cảm nhận mặn tới 25% mà không cần pha quá nhiều nước.',
        suggestedHeatLevel: 'medium',
        suggestedTimerSeconds: 120,
      };
    },
  },
  {
    id: 'seasoning_too_sour',
    quickActionTitle: 'Cân bằng lại vị quá chua',
    matches: (q) => /\b(?:qua\s+chua|hoi\s+chua|bi\s+chua|chua\s+gat|chua\s+qua)\b/.test(q),
    compose: () => ({
      answerVi:
        'Hãy **vớt ngay xác me, lát chanh, sấu hoặc dứa/cà chua** ra khỏi nồi để ngắt nguồn tiết axit chua. Sau đó hạ lửa nhỏ, rắc từ từ **1/2 - 1 thìa cà phê đường** (hoặc 1/2 thìa nước mắm ngon tạo hậu vị umami) khuấy tan rồi nếm lại sau 1 phút.',
      chefSecretVi:
        'Nếu là canh chua Nam Bộ, thêm chút đường phèn và ngò om/ngổ tươi cuối cùng sẽ biến vị chua gắt thành vị chua thanh ngọt hậu.',
      suggestedHeatLevel: 'low',
      suggestedTimerSeconds: 90,
    }),
  },
  {
    id: 'seasoning_too_spicy',
    quickActionTitle: 'Giảm độ cay nồng an toàn',
    matches: (q) => /\b(?:qua\s+cay|hoi\s+cay|bi\s+cay|cay\s+qua|cay\s+xe)\b/.test(q),
    compose: (ctx) => {
      const dairySafe = !matchesHouseholdAllergen('FRESH_MILK', ctx.householdAllergens).matched;
      return {
        answerVi:
          `Hớt bỏ ngay các lát ớt và lớp váng dầu ớt nổi trên bề mặt (capsaicin tan trong dầu). Tiếp theo, làm dịu vị cay bằng **1/2 thìa cà phê đường + vài giọt chanh tươi**${
            dairySafe ? ' hoặc 1-2 thìa nước cốt dừa / sữa tươi không đường' : ' hoặc 1-2 thìa nước cốt dừa'
          } và bổ sung thêm rau củ/đậu phụ để phân tán độ cay.`,
        chefSecretVi:
          'Capsaicin trong ớt không tan trong nước lọc nhưng tan rất nhanh trong chất béo êm (nước cốt dừa) và dịu xuống ngay khi gặp cặp vị chua-ngọt nhẹ.',
        suggestedHeatLevel: 'low',
        suggestedTimerSeconds: 120,
      };
    },
  },
  {
    id: 'slightly_scorched_pan',
    quickActionTitle: 'Cấp cứu nồi bị khét nhẹ đáy',
    matches: (q) => /\b(?:bi\s+khet|khet\s+nhe|chay\s+day|sit\s+day|mui\s+khet|hoi\s+chay)\b/.test(q),
    compose: () => ({
      answerVi:
        '**DỪNG ĐẢO NGAY LẬP TỨC và tắt bếp!** Tuyệt đối không cạo đáy nồi. Hãy dùng đũa/muôi gắp nhẹ phần nguyên liệu và nước sốt phía trên (chưa chạm đáy cháy) sang **một nồi/chảo sạch khác**, bỏ hoàn toàn lớp sát đáy. Thêm 2 lát gừng đập dập hoặc đầu hành trắng vào nồi mới đun lửa nhỏ 2 phút để khử sạch mùi khói.',
      chefSecretVi:
        'Đặt một lát bánh mì trắng hoặc lá bắp cải úp lên miệng nồi mới 2 phút khi đun nhẹ sẽ hút bớt hơi khét còn vương trong nước sốt.',
      suggestedHeatLevel: 'low',
      suggestedTimerSeconds: 120,
      safetyAlertVi: 'Không sử dụng phần thực phẩm đã cháy đen sát đáy nồi vì chứa hợp chất acrylamide/PAHs không tốt cho sức khỏe.',
    }),
  },
  {
    id: 'thin_watery_sauce',
    quickActionTitle: 'Làm sánh sệt nước sốt chuẩn mượt',
    matches: (q) => /\b(?:sot\s+bi\s+loang|nuoc\s+sot\s+loang|bi\s+loang|nhieu\s+nuoc\s+qua|lam\s+sanh|lam\s+set|khong\s+sanh)\b/.test(q),
    compose: () => ({
      answerVi:
        'Mở vung hoàn toàn và có 2 cách chuẩn đầu bếp: (1) Nếu là **món kho/rim**, tăng lên **lửa vừa-lớn 3-4 phút** để nước bay hơi tự nhiên giúp sốt keo bóng; (2) Nếu là **món xào/sốt**, hòa tan **1 thìa cà phê bột năng (hoặc bột bắp) với 2 thìa canh NƯỚC NGUỘI**, vừa rót từ từ vào chảo đang sôi vừa đảo đều 45 giây.',
      chefSecretVi:
        'Tuyệt đối không rắc bột năng khô trực tiếp vào nồi nóng vì bột sẽ chín vón cục ngay bên ngoài. Luôn tắt bếp khi sốt vừa hơi sánh nhẹ vì khi nguội sốt sẽ đặc thêm 15%.',
      suggestedHeatLevel: 'medium',
      suggestedTimerSeconds: 180,
    }),
  },
  {
    id: 'pork_braise_doneness',
    quickActionTitle: 'Kiểm tra độ mềm thịt kho tàu / kho tộ',
    matches: (q) => /\b(?:thit\s+kho|kho\s+tau|ba\s+chi\s+kho|mem\s+chua|chin\s+mem)\b/.test(q),
    compose: () => ({
      answerVi:
        'Cách kiểm tra chuẩn: Dùng **một chiếc đũa tre xiên thẳng qua phần bì và lớp mỡ dày nhất** — nếu đũa xuyên qua nhẹ nhàng không bị bật ngược và lớp mỡ chuyển màu **trong veo hổ phách** là thịt đã mềm rục hoàn hảo. Nếu bì còn dai, hãy châm thêm nước sôi xâm xấp và kho lửa thật nhỏ (riu riu) thêm 12-15 phút không đậy kín nắp.',
      chefSecretVi:
        'Mở hé nắp (hoặc đậy lá chuối/giấy nến sát mặt thịt) và giữ lửa nhỏ lăn tăn 85-90°C giúp mỡ heo trong vắt và nước kho không bị đục.',
      suggestedHeatLevel: 'low',
      suggestedTimerSeconds: 720,
      safetyAlertVi: 'Đảm bảo thịt heo đạt nhiệt độ tâm chín kỹ tối thiểu 71°C trước khi thưởng thức.',
    }),
  },
  {
    id: 'fish_deodorize_and_soup',
    quickActionTitle: 'Bí quyết nấu cá không bị tanh',
    matches: (q) => /\b(?:bi\s+tanh|khu\s+tanh|ca\s+tanh|canh\s+ca|kho\s+ca|mui\s+tanh)\b/.test(q),
    compose: () => ({
      answerVi:
        'Ba nguyên tắc vàng để cá tuyệt đối không tanh: (1) Cạo sạch **lớp màng đen và máu đông sát xương sống** trong bụng cá, chà muối hạt + lát gừng hoặc rượu trắng rồi thấm khô; (2) Khi nấu canh cá, **bắt buộc đợi nước sôi sùng sục ở lửa lớn mới thả cá vào**; (3) Hạn chế lật trở khi mặt cá chưa săn.',
      chefSecretVi:
        'Áp chảo sơ cá với 2 lát gừng đập dập cho hơi vàng cạnh trước khi cho vào nồi canh hoặc nồi kho giúp thịt cá thơm phức và nguyên miếng không nát.',
      suggestedHeatLevel: 'high',
      suggestedTimerSeconds: 300,
      safetyAlertVi: 'Cá tươi cần nấu chín tới nhiệt độ tâm ≥ 63°C (thịt cá chuyển trắng đục và tách thớ dễ dàng).',
    }),
  },
  {
    id: 'sour_soup_aroma',
    quickActionTitle: 'Giữ canh chua thanh trong, không bị nồng',
    matches: (q) => /\b(?:canh\s+chua|bi\s+nong|rau\s+ngo|ngo\s+om|doc\s+mung|bac\s+ha)\b/.test(q),
    compose: () => ({
      answerVi:
        'Để canh chua thanh dịu không bị nồng hay đục nước: Lọc lấy nước cốt me/chua cho vào từ từ, hớt sạch bọt khi sôi; cho các loại rau nhanh chín (**bạc hà/dọc mùng, đậu bắp, giá đỗ**) vào nấu đúng 60-90 giây, sau đó **tắt bếp rồi mới rắc ngò om (rau ngổ), ngò gai và tỏi phi** lên mặt.',
      chefSecretVi:
        'Rau ngổ/ngò gai nếu đun sôi lâu sẽ biến đổi tinh dầu gây mùi nồng hăng và thâm màu — rắc ngay lúc vừa tắt bếp mới tỏa hương thơm chuẩn quán.',
      suggestedHeatLevel: 'medium',
      suggestedTimerSeconds: 90,
    }),
  },
  {
    id: 'crispy_green_stir_fry',
    quickActionTitle: 'Xào rau xanh mướt, giòn ngọt không thâm',
    matches: (q) => /\b(?:rau\s+xao|xao\s+rau|xanh\s+gion|bi\s+tham|bi\s+den|ra\s+nuoc|xao\s+lua)\b/.test(q),
    compose: () => ({
      answerVi:
        'Bật **lửa lớn nhất (High)**, đợi chảo thật nóng mới cho dầu tỏi và thả rau ráo nước vào đảo nhanh tay liên tục 90-120 giây (cho phần cọng cứng vào trước lá 30 giây). **Chỉ nêm muối/nước mắm/dầu hào ở 15 giây cuối cùng** ngay trước khi tắt bếp để rau không bị thẩm thấu chảy nước và giữ màu xanh ngọc.',
      chefSecretVi:
        'Nếu bếp gia đình lửa yếu, hãy chần sơ rau 20 giây trong nước sôi có nhúm muối + vài giọt dầu ăn, vớt ra để ráo rồi mới xào tỏi 45 giây — rau xanh mướt cả tiếng không thâm!',
      suggestedHeatLevel: 'high',
      suggestedTimerSeconds: 90,
    }),
  },
  {
    id: 'poultry_doneness_safety',
    quickActionTitle: 'Kiểm tra gà chín mọng & an toàn nhiệt độ',
    matches: (q) => /\b(?:ga\s+chin|luoc\s+ga|uc\s+ga\s+chin|dui\s+ga\s+chin|thit\s+ga\s+song|mau\s+do\s+o\s+xuong)\b/.test(q),
    compose: () => ({
      answerVi:
        'Dùng đầu đũa hoặc tăm nhọn xiên vào **phần thịt dày nhất sát đùi hoặc giữa ức gà**: nếu **nước tiết ra trong suốt hoàn toàn** (không còn sắc hồng đục) và thớ thịt đàn hồi săn chắc là gà đã chín tới. Nếu luộc nguyên con, sau khi sôi lăn tăn 12-15 phút ở lửa nhỏ, hãy tắt bếp đậy kín vung ủ thêm 15 phút để gà chín đều tận xương mà da giòn không nứt.',
      chefSecretVi:
        'Vớt gà vừa chín tới nhúng nhanh qua tô nước đun sôi để nguội có vài viên đá sạch 2 phút rồi quét lớp mỡ gà nghệ giúp da căng bóng vàng ươm.',
      suggestedHeatLevel: 'low',
      suggestedTimerSeconds: 900,
      safetyAlertVi: 'An toàn thực phẩm gia cầm: Tâm thịt gà bắt buộc đạt tối thiểu 74°C — tuyệt đối không ăn thịt gà còn tái hồng.',
    }),
  },
  {
    id: 'equipment_air_fryer_oven',
    quickActionTitle: 'Quy đổi Nồi chiên không dầu ↔ Lò nướng',
    matches: (q) => /\b(?:noi\s+chien\s+khong\s+dau|air\s*fryer|thay\s+lo\s+nuong|khong\s+co\s+lo\s+nuong)\b/.test(q),
    compose: () => ({
      answerVi:
        'Hoàn toàn dùng **Nồi chiên không dầu** thay lò nướng rất ngon! Hãy áp dụng quy tắc quy đổi chuẩn: **Giảm nhiệt độ xuống 15-20°C** so với công thức lò nướng (ví dụ 200°C hạ còn 180°C) và **giảm khoảng 20% thời gian nướng**. Làm nóng nồi trước 3 phút, xếp thực phẩm 1 lớp thoáng khí và lật mặt + phết mỏng chút dầu/sốt ở mốc 2/3 thời gian.',
      chefSecretVi:
        'Đặt 1 chén sứ nhỏ chịu nhiệt đựng 2 thìa canh nước ở góc giỏ chiên giúp luồng gió đối lưu không làm khô bề mặt thịt nướng.',
      suggestedHeatLevel: 'medium',
      suggestedTimerSeconds: 720,
    }),
  },
  {
    id: 'equipment_claypot_swap',
    quickActionTitle: 'Kho ngon bằng nồi thường thay nồi đất',
    matches: (q) => /\b(?:noi\s+dat|nieu\s+dat|thay\s+noi\s+dat|noi\s+thuong|noi\s+inox)\b/.test(q),
    compose: () => ({
      answerVi:
        'Khi dùng **nồi inox / nồi đáy dày thay nồi đất**: Hãy thắng nước màu đường ở lửa nhỏ trước, áp chảo săn mặt thịt/cá rồi kho ở **lửa nhỏ nhất (Low)** đậy hé vung. Vì nồi kim loại thoát hơi nhanh hơn nồi đất khoảng 15%, hãy châm dư thêm 3-4 thìa canh nước sôi lúc đầu; ở **2 phút cuối mở vung tăng lửa vừa** để kẹo sốt sánh bóng và hơi cháy cạnh thơm lừng như kho tộ.',
      chefSecretVi:
        'Lót một lớp mía chẻ, riềng lát hoặc đầu hành lá dưới đáy nồi inox giúp chống dính đáy và tạo hương thơm giữ nhiệt y hệt niêu đất.',
      suggestedHeatLevel: 'low',
      suggestedTimerSeconds: 600,
    }),
  },
];

function extractMissingIngredientQuery(foldedQuestion: string): string | null {
  const patterns = [
    /(?:thieu|het|khong\s+co|quen\s+mua|thay\s+the|thay)\s+([a-z0-9\s]{2,35}?)(?:\s+(?:bang\s+gi|thi\s+sao|duoc\s+khong|bang\s+cai\s+gi|o\s+buoc\s+nay)|[?.!,]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = foldedQuestion.match(pattern);
    if (match?.[1]) {
      const candidate = match[1]
        .replace(/\b(?:nguyen\s+lieu|gia\s+vi|mon\s+nay|trong\s+tu)\b/g, '')
        .trim();
      if (candidate.length >= 2) return candidate;
    }
  }
  return null;
}

export function askSousChefLocal(rawContext: SousChefContextInput): SousChefResponse {
  const startedAt = Date.now();
  const ctx = SousChefContextInputSchema.parse(rawContext);
  const foldedQuestion = normalizeIngredientText(ctx.question);
  const stepContextLabel = ctx.currentStepNumber
    ? `Ở bước ${ctx.currentStepNumber}${ctx.recipeTitle ? ` món "${ctx.recipeTitle}"` : ''}: `
    : ctx.recipeTitle
      ? `Với món "${ctx.recipeTitle}": `
      : '';

  // Check if user is asking for an on-the-fly missing ingredient swap
  const missingTarget = extractMissingIngredientQuery(foldedQuestion);
  let safeSubstitutions: SousChefSubstitutionItem[] | undefined;

  if (missingTarget && !/\b(?:noi\s+chien|lo\s+nuong|noi\s+dat)\b/.test(missingTarget)) {
    const subResult = recommendSmartSubstitutionsLocal({
      ingredientName: missingTarget,
      recipeTitle: ctx.recipeTitle,
      fridgeItems: ctx.fridgeItems,
      householdAllergens: ctx.householdAllergens,
    });
    if (subResult.substitutions.length > 0) {
      safeSubstitutions = subResult.substitutions.slice(0, 3).map((item) => ({
        missing: missingTarget,
        replacement: item.replacementName,
        ratioNoteVi: item.conversionRatioVi,
        inFridge: item.inFridge,
      }));
    }
  }

  for (const scenario of SOUS_CHEF_SCENARIOS) {
    if (scenario.matches(foldedQuestion)) {
      const built = scenario.compose(ctx, foldedQuestion);
      const safetyCheck = inspectCulinaryFoodSafety(built.answerVi);
      const mergedSafety = [built.safetyAlertVi, safetyCheck.safetyAlertVi].filter(Boolean).join(' ') || undefined;
      return {
        answerVi: `${stepContextLabel}${built.answerVi}`,
        quickActionTitle: scenario.quickActionTitle,
        chefSecretVi: built.chefSecretVi,
        ...(built.suggestedTimerSeconds ? { suggestedTimerSeconds: built.suggestedTimerSeconds } : {}),
        ...(built.suggestedHeatLevel ? { suggestedHeatLevel: built.suggestedHeatLevel } : {}),
        ...(safeSubstitutions ? { safeSubstitutions } : {}),
        ...(mergedSafety ? { safetyAlertVi: mergedSafety } : {}),
        confidence: 0.94,
        mode: 'culinary_knowledge_engine',
        latencyMs: Math.max(1, Date.now() - startedAt),
      };
    }
  }

  if (safeSubstitutions && safeSubstitutions.length > 0) {
    const top = safeSubstitutions[0];
    return {
      answerVi: `${stepContextLabel}Bạn có thể thay thế ngay bằng **${top.replacement}** (${top.ratioNoteVi})${
        top.inFridge ? ' — nguyên liệu này **đang có sẵn trong tủ lạnh của bạn**!' : '.'
      } Tất cả gợi ý dưới đây đều đã được kiểm tra an toàn với hồ sơ dị ứng gia đình.`,
      quickActionTitle: `Thay thế thông minh cho ${top.missing}`,
      chefSecretVi:
        'Hãy cho khoảng 2/3 lượng gia vị/nguyên liệu thay thế vào trước, đảo đều rồi nếm thử để tinh chỉnh vừa khít khẩu vị nhà mình.',
      safeSubstitutions,
      suggestedHeatLevel: 'medium',
      confidence: top.inFridge ? 0.93 : 0.89,
      mode: 'culinary_knowledge_engine',
      latencyMs: Math.max(1, Date.now() - startedAt),
    };
  }

  // Contextual active-step timing & heat advisor
  const stepTextFolded = normalizeIngredientText(`${ctx.currentStepText || ''} ${ctx.recipeTitle || ''}`);
  const inferredHeat: 'low' | 'medium' | 'high' =
    /\b(?:xao|ap\s+chao|phi\s+thom|luoc\s+rau|soi\s+manh)\b/.test(stepTextFolded)
      ? 'high'
      : /\b(?:kho|ham|inh|rim|niu|riu\s+riu)\b/.test(stepTextFolded)
        ? 'low'
        : 'medium';

  const inferredTimer =
    inferredHeat === 'high' ? 120 : inferredHeat === 'low' ? 600 : 240;

  const heatLabelVi =
    inferredHeat === 'high' ? 'lửa lớn (High)' : inferredHeat === 'low' ? 'lửa nhỏ riu riu (Low)' : 'lửa vừa ổn định (Medium)';

  const rawProteinMentioned = /\b(?:ga|heo|lon|bo\s+xay|thit\s+bam|ca|tom)\b/.test(`${foldedQuestion} ${stepTextFolded}`);

  return {
    answerVi: `${stepContextLabel}Hãy duy trì **${heatLabelVi}** trong khoảng **${Math.round(inferredTimer / 60)} phút**${
      ctx.currentStepText ? ` cho thao tác "${ctx.currentStepText.slice(0, 120)}"` : ''
    }. Quan sát bằng giác quan: khi dậy mùi thơm rõ, bề mặt nguyên liệu săn bóng và nước sốt bám đều quanh đũa là đạt điểm chín ngon nhất${
      ctx.servings && ctx.servings > 3
        ? ` (với ${ctx.servings} khẩu phần, hãy đảo từ dưới đáy lên nhẹ tay để nhiệt tỏa đều mà không nát nguyên liệu)`
        : ''
    }.`,
    quickActionTitle: 'Canh lửa & điểm chín chuẩn đầu bếp',
    chefSecretVi:
      'Luôn chuẩn bị sẵn bát nước sôi ấm bên cạnh bếp để châm thêm khi cần mà không làm tụt nhiệt đột ngột của nồi.',
    suggestedHeatLevel: inferredHeat,
    suggestedTimerSeconds: inferredTimer,
    ...(rawProteinMentioned
      ? {
          safetyAlertVi:
            'Đảm bảo đạm động vật chín kỹ hoàn toàn trước khi dọn (gia cầm ≥ 74°C, thịt heo/thịt xay ≥ 71°C, hải sản ≥ 63°C).',
        }
      : {}),
    confidence: 0.87,
    mode: 'culinary_knowledge_engine',
    latencyMs: Math.max(1, Date.now() - startedAt),
  };
}

// ── 3. Deterministic Zero-Waste Fridge Rescue Engine ─────────────────────────

// Realistic 2026 Vietnamese retail grocery valuation benchmarks (VND)
const VND_BENCHMARK_BY_CATEGORY: Readonly<Record<string, { perKgVnd: number; perPieceVnd: number; perBunchOrPackVnd: number }>> = {
  meat: { perKgVnd: 175_000, perPieceVnd: 45_000, perBunchOrPackVnd: 75_000 },
  seafood: { perKgVnd: 260_000, perPieceVnd: 55_000, perBunchOrPackVnd: 95_000 },
  egg: { perKgVnd: 70_000, perPieceVnd: 3_600, perBunchOrPackVnd: 35_000 },
  dairy: { perKgVnd: 160_000, perPieceVnd: 18_000, perBunchOrPackVnd: 36_000 },
  vegetable: { perKgVnd: 38_000, perPieceVnd: 7_000, perBunchOrPackVnd: 18_000 },
  fruit: { perKgVnd: 48_000, perPieceVnd: 12_000, perBunchOrPackVnd: 35_000 },
  spice: { perKgVnd: 90_000, perPieceVnd: 4_000, perBunchOrPackVnd: 15_000 },
  grain: { perKgVnd: 34_000, perPieceVnd: 10_000, perBunchOrPackVnd: 22_000 },
  other: { perKgVnd: 65_000, perPieceVnd: 12_000, perBunchOrPackVnd: 25_000 },
};

function estimateItemValueVnd(item: CulinaryFridgeItem): number {
  if (item.quantity <= 0) return 0;
  const canonical =
    (item.ingredientId ? findCanonicalIngredientById(item.ingredientId) : null) ??
    findCanonicalIngredient(item.name);
  const category = canonical?.category ?? item.category ?? 'other';
  const rate = VND_BENCHMARK_BY_CATEGORY[category] ?? VND_BENCHMARK_BY_CATEGORY.other;
  const unit = item.unit.trim().toLowerCase();

  // Special high-accuracy overrides for staple VN items
  if (canonical?.id === 'SALMON_FILLET') {
    if (unit === 'g') return Math.round(((item.quantity / 1000) * 480_000) / 1000) * 1000;
    if (unit === 'kg') return Math.round((item.quantity * 480_000) / 1000) * 1000;
  }
  if (canonical?.id === 'BEEF_SIRLOIN') {
    if (unit === 'g') return Math.round(((item.quantity / 1000) * 270_000) / 1000) * 1000;
    if (unit === 'kg') return Math.round((item.quantity * 270_000) / 1000) * 1000;
  }
  if (canonical?.id === 'TOFU' && unit === 'piece') {
    return Math.max(5_000, Math.round((item.quantity * 8_000) / 1000) * 1000);
  }

  let rawVnd = 0;
  if (unit === 'g' || unit === 'ml') {
    rawVnd = (item.quantity / 1000) * rate.perKgVnd;
  } else if (unit === 'kg' || unit === 'l') {
    rawVnd = item.quantity * rate.perKgVnd;
  } else if (unit === 'bunch' || unit === 'pack' || unit === 'bó' || unit === 'gói' || unit === 'hộp') {
    rawVnd = item.quantity * rate.perBunchOrPackVnd;
  } else if (unit === 'slice' || unit === 'lát') {
    rawVnd = item.quantity * (rate.perPieceVnd * 0.45);
  } else {
    rawVnd = item.quantity * rate.perPieceVnd;
  }

  return Math.max(3_000, Math.round(rawVnd / 1000) * 1000);
}

function buildStorageExtensionTip(item: CulinaryFridgeItem): {
  extensionTipVi: string;
  extraDaysGained: number;
  canFreeze: boolean;
} {
  const canonical =
    (item.ingredientId ? findCanonicalIngredientById(item.ingredientId) : null) ??
    findCanonicalIngredient(item.name);
  const category = canonical?.category ?? item.category ?? 'other';

  if (canonical?.id === 'TOFU') {
    return {
      extensionTipVi: 'Ngâm ngập đậu phụ trong hộp nước lọc sạch đậy kín nắp ở ngăn mát và thay nước mỗi ngày (hoặc cấp đông tạo đậu phụ đông đá xốp thấm sốt).',
      extraDaysGained: 3,
      canFreeze: true,
    };
  }
  if (canonical?.id === 'SCALLION') {
    return {
      extensionTipVi: 'Thấm thật khô, thái nhỏ cho vào chai/hộp kín để ngăn đông — khi nấu rắc thẳng vào nồi vẫn xanh thơm như mới.',
      extraDaysGained: 30,
      canFreeze: true,
    };
  }
  if (category === 'meat' || category === 'seafood') {
    return {
      extensionTipVi: 'Thấm khô bề mặt bằng giấy bếp, chia thành từng phần vừa 1 bữa ăn, thoa lớp dầu ăn cực mỏng khóa ẩm rồi ép sát khí trong túi zip đưa lên ngăn đông (-18°C).',
      extraDaysGained: 30,
      canFreeze: true,
    };
  }
  if (category === 'egg') {
    return {
      extensionTipVi: 'Xếp đầu nhọn của trứng quay xuống dưới trong hộp kín đặt sâu bên trong ngăn mát (không để ở cánh cửa tủ lạnh nơi nhiệt độ dao động).',
      extraDaysGained: 10,
      canFreeze: false,
    };
  }
  if (category === 'dairy') {
    return {
      extensionTipVi: 'Đậy chặt nắp và đặt ở kệ giữa ngăn mát (2-4°C); với phô mai/bơ, bọc giấy nến trước khi cho vào hộp kín để không hút mùi tủ lạnh.',
      extraDaysGained: 5,
      canFreeze: canonical?.id === 'BUTTER' || canonical?.id === 'CHEDDAR_CHEESE',
    };
  }
  if (category === 'vegetable') {
    const isLeafy = ['WATER_SPINACH', 'SPINACH', 'CABBAGE', 'BEAN_SPROUTS'].includes(canonical?.id ?? '');
    if (isLeafy) {
      return {
        extensionTipVi: 'Nhặt bỏ lá dập, KHÔNG rửa nước trước khi cất; quấn 1 lớp khăn giấy khô hút ẩm quanh bó rau rồi cho vào túi zip hé nhẹ miệng ở ngăn rau.',
        extraDaysGained: 4,
        canFreeze: false,
      };
    }
    return {
      extensionTipVi: 'Lau khô vỏ ngoài, bảo quản ngăn mát thoáng khí; nếu chưa kịp ăn hết có thể cắt miếng chần nước sôi 45 giây, để nguội rồi cấp đông.',
      extraDaysGained: 14,
      canFreeze: true,
    };
  }
  return {
    extensionTipVi: 'Bảo quản trong hộp kín khí có dán nhãn ngày mở nắp và ưu tiên xếp ra phía ngoài ngăn mát (nguyên tắc FEFO — hết hạn trước dùng trước).',
    extraDaysGained: 5,
    canFreeze: false,
  };
}

export function composeFridgeRescueBriefLocal(rawInput: FridgeRescueInput): FridgeRescueBrief {
  const startedAt = Date.now();
  const parsed = FridgeRescueInputSchema.parse(rawInput);
  const maxCookMinutes = Math.min(parsed.availableCookTimeMinutes ?? 15, 25);

  const allergenFilteredItems: string[] = [];
  const usableItems: CulinaryFridgeItem[] = [];

  for (const item of parsed.fridgeItems) {
    if (item.quantity <= 0 || item.freshness === 'out_of_stock') continue;
    const check = matchesHouseholdAllergen(item.ingredientId || item.name, parsed.householdAllergens);
    const checkByName = matchesHouseholdAllergen(item.name, parsed.householdAllergens);
    if (check.matched || checkByName.matched) {
      allergenFilteredItems.push(item.name);
      continue;
    }
    usableItems.push(item);
  }

  const urgencyWeight = (freshness?: string): number => {
    if (freshness === 'expiring') return 3;
    if (freshness === 'use_soon') return 2;
    return 1;
  };

  const sortedByUrgency = [...usableItems].sort((a, b) => urgencyWeight(b.freshness) - urgencyWeight(a.freshness));
  const atRiskItems = sortedByUrgency.filter((i) => i.freshness === 'expiring' || i.freshness === 'use_soon');
  const focusItems = (atRiskItems.length > 0 ? atRiskItems : sortedByUrgency).slice(0, 5);

  const hasExpiring = usableItems.some((i) => i.freshness === 'expiring');
  const hasUseSoon = usableItems.some((i) => i.freshness === 'use_soon');
  const urgencyLevel: 'critical' | 'moderate' | 'calm' = hasExpiring
    ? 'critical'
    : hasUseSoon
      ? 'moderate'
      : 'calm';

  // Compose an authentic quick rescue dish tailored to the top focus items
  const focusNames = focusItems.map((i) => i.name);
  const canonicalFocus = focusItems.map(
    (i) => (i.ingredientId ? findCanonicalIngredientById(i.ingredientId) : null) ?? findCanonicalIngredient(i.name),
  );

  const proteinItem = focusItems.find((_, idx) =>
    ['meat', 'seafood', 'egg'].includes(canonicalFocus[idx]?.category ?? focusItems[idx].category ?? ''),
  );
  const tofuItem = focusItems.find((_, idx) => canonicalFocus[idx]?.id === 'TOFU');
  const tomatoItem = focusItems.find((_, idx) => canonicalFocus[idx]?.id === 'TOMATO');
  const vegItems = focusItems.filter((_, idx) => {
    const cat = canonicalFocus[idx]?.category ?? focusItems[idx].category;
    return cat === 'vegetable' && canonicalFocus[idx]?.id !== 'TOFU';
  });

  let dishNameVi = 'Rau củ & đạm xào tỏi dầu hào lửa lớn vét tủ';
  let stepsVi: string[] = [
    'Sơ chế nhanh và thái vừa ăn các nguyên liệu cần giải cứu, để thật ráo nước để khi xào không bị ra nước.',
    'Phi thơm tỏi với 1 thìa canh dầu ăn trên lửa lớn, cho nguyên liệu lâu chín (đạm/củ cứng) vào đảo săn 2-3 phút trước.',
    'Thả phần rau mềm vào đảo nhanh tay 90 giây trên lửa lớn, nêm gia vị vừa miệng rồi tắt bếp rắc tiêu nóng hổi.',
  ];
  let chefSecretVi =
    'Nêm gia vị ở 20 giây cuối trên lửa lớn giúp mọi nguyên liệu vét tủ giữ trọn độ giòn ngọt và màu sắc bắt mắt.';

  if ((proteinItem || tofuItem) && tomatoItem) {
    const mainHero = proteinItem?.name ?? tofuItem!.name;
    dishNameVi = `${mainHero} sốt ${tomatoItem.name} mọng ngọt đưa cơm`;
    stepsVi = [
      `Thái ${mainHero} miếng vừa ăn (nếu là đậu phụ hoặc thịt thì áp chảo vàng nhẹ 2 mặt khoảng 3 phút rồi trút ra).`,
      `Cho ${tomatoItem.name} thái múi cau vào dầm mềm với chút muối trên lửa vừa 3 phút tạo nền sốt đỏ sánh tự nhiên.`,
      `Trút ${mainHero}${vegItems[0] ? ` và ${vegItems[0].name}` : ''} vào đảo thấm sốt 4 phút, rắc hành/tiêu rồi dọn nóng cùng cơm trắng.`,
    ];
    chefSecretVi = 'Thêm 1 nhúm muối nhỏ ngay lúc mới xào cà chua giúp cà chua nhanh tơi thành sốt bóng mượt chỉ trong nửa thời gian.';
  } else if (proteinItem && vegItems.length > 0) {
    dishNameVi = `${vegItems[0].name} xào ${proteinItem.name} tỏi thơm giòn ngọt`;
    stepsVi = [
      `Thái mỏng ${proteinItem.name}, ướp nhanh 3 phút với chút gia vị và tiêu; rửa sạch ${vegItems.map((v) => v.name).slice(0, 2).join(', ')} để ráo.`,
      `Bật lửa lớn xào săn ${proteinItem.name} cùng nửa phần tỏi băm trong 2 phút rồi trút riêng ra đĩa để giữ độ mềm mọng.`,
      `Phi nốt phần tỏi còn lại, cho ${vegItems.map((v) => v.name).slice(0, 2).join(', ')} vào đảo lửa lớn 2 phút rồi trút ${proteinItem.name} quay lại đảo đều 30 giây là hoàn tất.`,
    ];
    chefSecretVi = 'Xào riêng phần đạm rồi mới ghép với rau ở 30 giây cuối là bí quyết vàng để thịt không dai và rau không bị thâm.';
  } else if (focusItems.length === 0) {
    dishNameVi = 'Canh rau củ thanh mát & Cơm chiên tỏi giòn';
  }

  const fishSauceSafe = !matchesHouseholdAllergen('FISH_SAUCE', parsed.householdAllergens).matched;
  const soySauceSafe = !matchesHouseholdAllergen('SOY_SAUCE', parsed.householdAllergens).matched;
  const pantryStaplesVi = [
    'Dầu ăn thực vật',
    'Tỏi / Hành tím',
    fishSauceSafe ? 'Nước mắm nhĩ' : soySauceSafe ? 'Nước tương ủ tự nhiên' : 'Muối biển & tiêu xay',
    'Tiêu đen xay mới',
  ];

  const wasteTargetItems = atRiskItems.length > 0 ? atRiskItems : focusItems;
  const wasteSavedBreakdown = wasteTargetItems.slice(0, 10).map((item) => ({
    itemName: item.name,
    quantityLabel: `${item.quantity} ${item.unit}`,
    estimatedVnd: estimateItemValueVnd(item),
  }));
  const estimatedWasteSavedVnd = wasteSavedBreakdown.reduce((sum, row) => sum + row.estimatedVnd, 0);

  const storageExtensionTips = (atRiskItems.length > 0 ? atRiskItems : focusItems).slice(0, 6).map((item) => {
    const tip = buildStorageExtensionTip(item);
    const freshness: 'expiring' | 'use_soon' | 'fresh' =
      item.freshness === 'expiring'
        ? 'expiring'
        : item.freshness === 'use_soon'
          ? 'use_soon'
          : 'fresh';
    return {
      itemName: item.name,
      freshness,
      ...tip,
    };
  });

  const formattedVnd = estimatedWasteSavedVnd.toLocaleString('vi-VN');
  const headlineVi =
    focusItems.length === 0
      ? 'Tủ lạnh đang gọn gàng — chưa có thực phẩm nào cận hạn cần giải cứu gấp!'
      : urgencyLevel === 'critical'
        ? `Ưu tiên giải cứu ngay ${focusItems.length} nguyên liệu cận hạn hôm nay — tiết kiệm ước tính ${formattedVnd}₫!`
        : urgencyLevel === 'moderate'
          ? `Kế hoạch nấu gọn ${focusItems.length} nguyên liệu nên dùng trong 2-3 ngày tới — giữ trọn ${formattedVnd}₫ thực phẩm tươi!`
          : `Gợi ý tận dụng thông minh ${focusItems.length} nguyên liệu sẵn có trong tủ lạnh (~${formattedVnd}₫).`;

  return {
    headlineVi,
    urgencyLevel,
    priorityRescueCombo: {
      titleVi:
        focusNames.length > 0
          ? `Combo Giải Cứu FEFO: ${focusNames.slice(0, 3).join(' + ')}`
          : 'Tủ lạnh cân bằng Zero-Waste',
      rationaleVi:
        focusNames.length > 0
          ? `Kết hợp ${focusNames.join(', ')} theo nguyên tắc FEFO (hết hạn trước dùng trước) giúp giải phóng ngăn mát chỉ trong 1 lần bật bếp mà hương vị hài hòa tự nhiên.`
          : 'Hiện không có lô thực phẩm nào sắp hỏng; bạn có thể duy trì nguyên tắc xếp đồ cũ ra ngoài để tránh lãng phí.',
      rescuedItems: focusNames.slice(0, 6),
      matchScore: focusNames.length >= 2 ? 0.94 : focusNames.length === 1 ? 0.86 : 0.75,
    },
    quickRescueDish: {
      dishNameVi,
      cookTimeMinutes: Math.min(maxCookMinutes, 15),
      difficulty: 'easy',
      heroIngredients: focusNames.slice(0, 5),
      pantryStaplesVi,
      stepsVi,
      chefSecretVi,
    },
    storageExtensionTips,
    estimatedWasteSavedVnd,
    wasteSavedBreakdown,
    allergenFilteredItems: [...new Set(allergenFilteredItems)],
    ...(allergenFilteredItems.length > 0
      ? {
          safetyAlertVi: `Đã tự động loại ${allergenFilteredItems.join(', ')} khỏi thực đơn giải cứu theo hồ sơ dị ứng/kiêng của gia đình.`,
        }
      : {}),
    confidence: focusItems.length > 0 ? 0.92 : 0.85,
    mode: 'culinary_knowledge_engine',
    latencyMs: Math.max(1, Date.now() - startedAt),
  };
}

// ── Gateway-Powered Async Entrypoints (LLM + Culinary Knowledge Graph) ───────

export async function askSousChef(
  context: SousChefContextInput,
  env?: CulinaryExecutionEnv,
): Promise<SousChefResponse> {
  const validatedInput = SousChefContextInputSchema.parse(context);
  const { gateway, userId, signal } = toGateway(env);

  const result = await gateway.executeStructured<SousChefContextInput, SousChefResponse>({
    tier: 'sous_chef_copilot',
    telemetryTask: 'sous_chef_copilot',
    userId,
    signal,
    input: validatedInput,
    hasRichContext: Boolean(
      validatedInput.recipeTitle ||
        validatedInput.currentStepText ||
        (validatedInput.fridgeItems && validatedInput.fridgeItems.length > 0),
    ),
    systemPrompt: `Bạn là Bếp trưởng AI Sous-Chef của Takolio Việt Nam — chuyên gia ẩm thực gia đình Việt, khoa học thực phẩm và an toàn bếp.
Nhiệm vụ: Giải đáp chính xác, súc tích, thực chiến ngay tại bếp (chữa mặn/chua/cay/khét/loãng sốt, kiểm tra độ chín cảm quan, chỉnh lửa & thời gian, đổi dụng cụ, thay nguyên liệu thiếu).
QUY TẮC AN TOÀN BẮT BUỘC:
1. TUYỆT ĐỐI KHÔNG gợi ý bất kỳ nguyên liệu nào thuộc danh sách householdAllergens.
2. Thịt gia cầm phải đạt tâm ≥ 74°C, thịt heo/thịt xay ≥ 71°C, hải sản ≥ 63°C; không bao giờ khuyên ăn tái/sống gia cầm hay thịt heo.
3. Ưu tiên nguyên liệu đang có trong fridgeItems (đánh dấu inFridge: true).
Trả về DUY NHẤT JSON object khớp schema:
{"answerVi": string, "quickActionTitle"?: string, "chefSecretVi"?: string, "suggestedTimerSeconds"?: number, "suggestedHeatLevel"?: "low"|"medium"|"high", "safeSubstitutions"?: [{"missing": string, "replacement": string, "ratioNoteVi": string, "inFridge": boolean}], "safetyAlertVi"?: string, "confidence": number, "mode": "llm", "latencyMs": 1}`,
    buildUserPrompt: (clean) => JSON.stringify(clean),
    schema: SousChefResponseSchema,
    deterministicFallback: (clean) => askSousChefLocal(clean),
    outputSafetyGate: (output, clean) => {
      const safetyFlags: string[] = [];
      let safeSubs = output.safeSubstitutions;
      if (safeSubs && clean.householdAllergens?.length) {
        const filtered = safeSubs.filter((sub) => {
          const hit = matchesHouseholdAllergen(sub.replacement, clean.householdAllergens);
          if (hit.matched) safetyFlags.push(`ALLERGEN_FILTERED:${sub.replacement}`);
          return !hit.matched;
        });
        safeSubs = filtered;
      }

      // Check if free-text answer accidentally recommends a household allergen
      let answerVi = output.answerVi;
      if (clean.householdAllergens?.length) {
        const answerCheck = matchesHouseholdAllergen(answerVi, clean.householdAllergens);
        if (answerCheck.matched) {
          safetyFlags.push('ALLERGEN_REGENERATED_SAFE');
          const safeDeterministic = askSousChefLocal(clean);
          return { output: safeDeterministic, safetyFlags };
        }
      }

      const foodSafety = inspectCulinaryFoodSafety(answerVi);
      if (!foodSafety.safe) {
        safetyFlags.push(...foodSafety.flags);
        const safeDeterministic = askSousChefLocal(clean);
        return {
          output: {
            ...safeDeterministic,
            safetyAlertVi: foodSafety.safetyAlertVi ?? safeDeterministic.safetyAlertVi,
          },
          safetyFlags,
        };
      }

      return {
        output: {
          ...output,
          answerVi,
          ...(safeSubs !== undefined ? { safeSubstitutions: safeSubs } : {}),
        },
        safetyFlags,
      };
    },
  });

  return result.data;
}

export async function recommendSmartSubstitutions(
  input: SmartSubstitutionInput,
  env?: CulinaryExecutionEnv,
): Promise<SmartSubstitutionResponse> {
  const validatedInput = SmartSubstitutionInputSchema.parse(input);
  const { gateway, userId, signal } = toGateway(env);

  const result = await gateway.executeStructured<SmartSubstitutionInput, SmartSubstitutionResponse>({
    tier: 'substitution_reasoner',
    telemetryTask: 'smart_substitutions',
    userId,
    signal,
    input: validatedInput,
    hasRichContext: Boolean(validatedInput.fridgeItems && validatedInput.fridgeItems.length > 0),
    systemPrompt: `Bạn là Chuyên gia Hóa học Ẩm thực & Thay thế Nguyên liệu của Takolio Việt Nam.
Nhiệm vụ: Đề xuất các nguyên liệu thay thế chuẩn vị bếp Việt, có tỷ lệ quy đổi chính xác (conversionRatioVi), ghi chú ảnh hưởng hương vị (flavorImpactVi), ưu tiên nguyên liệu ĐANG CÓ TRONG TỦ LẠNH (inFridge: true xếp đầu).
QUY TẮC AN TOÀN: Tuyệt đối loại bỏ mọi nguyên liệu trùng với householdAllergens (ghi tên các mục bị loại vào excludedAllergenItems).
Trả về DUY NHẤT JSON object hợp lệ khớp schema SmartSubstitutionResponse.`,
    buildUserPrompt: (clean) => JSON.stringify(clean),
    schema: SmartSubstitutionResponseSchema,
    deterministicFallback: (clean) => recommendSmartSubstitutionsLocal(clean),
    outputSafetyGate: (output, clean) => {
      const safetyFlags: string[] = [];
      const newlyExcluded: string[] = [...output.excludedAllergenItems];
      const safeList = output.substitutions.filter((candidate) => {
        const checkId = matchesHouseholdAllergen(
          candidate.replacementCanonicalId || candidate.replacementName,
          clean.householdAllergens,
        );
        const checkName = matchesHouseholdAllergen(candidate.replacementName, clean.householdAllergens);
        if (checkId.matched || checkName.matched) {
          safetyFlags.push(`SUB_ALLERGEN_REMOVED:${candidate.replacementName}`);
          newlyExcluded.push(candidate.replacementName);
          return false;
        }
        return true;
      });

      // Ensure deterministic fallback fills in if LLM list became empty after allergen gate
      if (safeList.length === 0) {
        const fallback = recommendSmartSubstitutionsLocal(clean);
        return {
          output: {
            ...fallback,
            excludedAllergenItems: [...new Set([...newlyExcluded, ...fallback.excludedAllergenItems])],
          },
          safetyFlags,
        };
      }

      // Re-verify inFridge truth against actual fridgeItems snapshot & sort fridge-first
      const verified = safeList
        .map((cand) => {
          const match = matchFridgeStock(cand.replacementName, cand.replacementCanonicalId, clean.fridgeItems);
          return {
            ...cand,
            inFridge: Boolean(match),
            ...(match && !cand.fridgeStockNoteVi
              ? { fridgeStockNoteVi: `Có sẵn ${match.quantity} ${match.unit} ${match.name} trong tủ lạnh.` }
              : {}),
          };
        })
        .sort((a, b) => (a.inFridge !== b.inFridge ? (a.inFridge ? -1 : 1) : b.rankScore - a.rankScore));

      return {
        output: {
          ...output,
          substitutions: verified,
          excludedAllergenItems: [...new Set(newlyExcluded)],
        },
        safetyFlags,
      };
    },
  });

  return result.data;
}

export async function composeFridgeRescueBrief(
  input: FridgeRescueInput,
  env?: CulinaryExecutionEnv,
): Promise<FridgeRescueBrief> {
  const validatedInput = FridgeRescueInputSchema.parse(input);
  const { gateway, userId, signal } = toGateway(env);

  const result = await gateway.executeStructured<FridgeRescueInput, FridgeRescueBrief>({
    tier: 'fridge_rescue',
    telemetryTask: 'fridge_rescue',
    userId,
    signal,
    input: validatedInput,
    hasRichContext: validatedInput.fridgeItems.length > 0,
    systemPrompt: `Bạn là Kiến trúc sư Giải cứu Thực phẩm Zero-Waste của Takolio Việt Nam.
Nhiệm vụ: Từ danh sách thực phẩm trong tủ lạnh (ưu tiên expiring và use_soon), lập chiến lược giải cứu thông minh gồm:
1. Combo nguyên liệu ưu tiên dùng ngay (priorityRescueCombo),
2. Công thức 15 phút vét tủ ngon miệng (quickRescueDish),
3. Mẹo kéo dài hạn bảo quản khoa học cho từng món sắp hỏng (storageExtensionTips),
4. Ước tính giá trị thực phẩm cứu được bằng VNĐ thực tế tại siêu thị Việt Nam (estimatedWasteSavedVnd & wasteSavedBreakdown).
QUY TẮC AN TOÀN: Tuyệt đối KHÔNG đưa nguyên liệu thuộc householdAllergens vào món ăn gợi ý (đưa vào allergenFilteredItems).
Trả về DUY NHẤT JSON object hợp lệ khớp schema FridgeRescueBrief.`,
    buildUserPrompt: (clean) => JSON.stringify(clean),
    schema: FridgeRescueBriefSchema,
    deterministicFallback: (clean) => composeFridgeRescueBriefLocal(clean),
    outputSafetyGate: (output, clean) => {
      const safetyFlags: string[] = [];
      if (clean.householdAllergens?.length) {
        const unsafeHero = output.quickRescueDish.heroIngredients.some(
          (ing) => matchesHouseholdAllergen(ing, clean.householdAllergens).matched,
        );
        const unsafeCombo = output.priorityRescueCombo.rescuedItems.some(
          (ing) => matchesHouseholdAllergen(ing, clean.householdAllergens).matched,
        );
        const unsafeDishTitle = matchesHouseholdAllergen(
          output.quickRescueDish.dishNameVi,
          clean.householdAllergens,
        ).matched;

        if (unsafeHero || unsafeCombo || unsafeDishTitle) {
          safetyFlags.push('RESCUE_ALLERGEN_REGENERATED');
          return { output: composeFridgeRescueBriefLocal(clean), safetyFlags };
        }
      }

      const foodSafety = inspectCulinaryFoodSafety(output.quickRescueDish.stepsVi.join(' '));
      if (!foodSafety.safe) {
        safetyFlags.push(...foodSafety.flags);
        const safeFallback = composeFridgeRescueBriefLocal(clean);
        return {
          output: {
            ...safeFallback,
            safetyAlertVi: foodSafety.safetyAlertVi ?? safeFallback.safetyAlertVi,
          },
          safetyFlags,
        };
      }

      return { output, safetyFlags };
    },
  });

  return result.data;
}
