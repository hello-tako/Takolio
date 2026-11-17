import {
  GATEWAY_TIER_ROUTING_TABLE,
  askSousChefLocal,
  composeFridgeRescueBriefLocal,
  globalCircuitBreakerRegistry,
  inspectAndSanitizePrompt,
  recommendSmartSubstitutionsLocal,
  type CulinaryFridgeItem,
  type DishRole,
  type FridgeRescueBrief,
  type FridgeRescueInput,
  type GatewayStatusReport,
  type SmartSubstitutionCandidate,
  type SmartSubstitutionInput,
  type SmartSubstitutionResponse,
  type SousChefContextInput,
  type SousChefResponse,
  type SousChefSubstitutionItem,
} from '@takolio/ai';
import {
  ApiError,
  fetchJson,
  guardPrivateSession,
  isOffline,
  readCachedInventory,
} from './http';

export type {
  CulinaryFridgeItem,
  DishRole,
  FridgeRescueBrief,
  FridgeRescueInput,
  GatewayStatusReport,
  SmartSubstitutionCandidate,
  SmartSubstitutionInput,
  SmartSubstitutionResponse,
  SousChefContextInput,
  SousChefResponse,
  SousChefSubstitutionItem,
};

export interface ActiveCookingQuickPreset {
  id: string;
  labelVi: string;
  icon: string;
  category: 'seasoning' | 'doneness' | 'substitution' | 'heat_timing' | 'equipment';
  questionTemplateVi: string;
}

export const ACTIVE_COOKING_QUICK_PRESETS: readonly ActiveCookingQuickPreset[] = [
  {
    id: 'rescue_salty',
    labelVi: 'Hơi mặn, chữa sao?',
    icon: '🧂',
    category: 'seasoning',
    questionTemplateVi: 'Món đang hơi mặn ở bước này, mình chữa nhanh thế nào để không bị tanh hay loãng vị?',
  },
  {
    id: 'check_doneness',
    labelVi: 'Kiểm tra chín tới',
    icon: '🥢',
    category: 'doneness',
    questionTemplateVi: 'Làm sao nhận biết nguyên liệu ở bước này đã chín mềm chuẩn ngon và an toàn?',
  },
  {
    id: 'thicken_sauce',
    labelVi: 'Sốt bị loãng',
    icon: '🥣',
    category: 'seasoning',
    questionTemplateVi: 'Nước sốt đang hơi loãng, làm sao thu sánh bóng đẹp mà không bị vón cục?',
  },
  {
    id: 'heat_and_timer',
    labelVi: 'Canh lửa & thời gian',
    icon: '🔥',
    category: 'heat_timing',
    questionTemplateVi: 'Ở bước này nên để mức lửa nào và canh bao nhiêu phút là vừa chuẩn?',
  },
  {
    id: 'missing_ingredient',
    labelVi: 'Thiếu nguyên liệu',
    icon: '🔄',
    category: 'substitution',
    questionTemplateVi: 'Mình đang thiếu nước mắm / hành lá cho bước này, thay bằng gì sẵn trong tủ lạnh được?',
  },
  {
    id: 'rescue_scorched',
    labelVi: 'Hơi bén đáy nồi',
    icon: '🚨',
    category: 'seasoning',
    questionTemplateVi: 'Đáy nồi hơi bén khét nhẹ rồi, mình xử lý cấp cứu sao ngay bây giờ?',
  },
  {
    id: 'air_fryer_swap',
    labelVi: 'Đổi sang nồi chiên',
    icon: '♨️',
    category: 'equipment',
    questionTemplateVi: 'Bước này dùng nồi chiên không dầu hoặc nồi thường thay lò nướng / nồi đất thì chỉnh nhiệt sao?',
  },
  {
    id: 'crispy_greens',
    labelVi: 'Giữ rau xanh giòn',
    icon: '🥬',
    category: 'doneness',
    questionTemplateVi: 'Mẹo xào rau ở bước này để giữ màu xanh mướt, giòn ngọt và không ra nước?',
  },
] as const;

/**
 * Selects and orders the most relevant quick-prompt presets for the current
 * active cooking step so users can tap with one finger while hands are busy.
 */
export function getContextualCookingPresets(context?: {
  recipeTitle?: string;
  currentStepText?: string;
}): ActiveCookingQuickPreset[] {
  const combined = `${context?.recipeTitle ?? ''} ${context?.currentStepText ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();

  if (!combined.trim()) {
    return [...ACTIVE_COOKING_QUICK_PRESETS.slice(0, 6)];
  }

  const prioritized = [...ACTIVE_COOKING_QUICK_PRESETS].sort((a, b) => {
    const score = (preset: ActiveCookingQuickPreset): number => {
      if (preset.id === 'crispy_greens' && /\b(?:rau|xao|cai|muong|bong cai)\b/.test(combined)) return 10;
      if (preset.id === 'air_fryer_swap' && /\b(?:nuong|lo nuong|noi dat|kho to)\b/.test(combined)) return 9;
      if (preset.id === 'thicken_sauce' && /\b(?:sot|kho|rim|sanh|keo)\b/.test(combined)) return 8;
      if (preset.id === 'check_doneness' && /\b(?:ga|thit|ca|kho|ham|luoc)\b/.test(combined)) return 8;
      if (preset.id === 'rescue_salty' && /\b(?:nem|nuoc mam|muoi|gia vi)\b/.test(combined)) return 7;
      return 1;
    };
    return score(b) - score(a);
  });

  return prioritized.slice(0, 6);
}

export const AI_COPILOT_BASE_PATH = '/ai-copilot';

function shouldUseOfflineEngine(err: unknown): boolean {
  if (isOffline(err)) return true;
  if (err instanceof ApiError && err.status === 0) return true;
  return false;
}

function mapCachedInventoryToFridgeItems(): CulinaryFridgeItem[] {
  const raw = readCachedInventory();
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item.name === 'string' && Number(item.quantity) > 0)
    .slice(0, 120)
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : undefined,
      name: String(item.name).trim(),
      ingredientId: typeof item.ingredientId === 'string' && item.ingredientId ? item.ingredientId : null,
      quantity: Number(item.quantity) || 1,
      unit: typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim() : 'piece',
      category: typeof item.category === 'string' ? item.category : 'other',
      storage: typeof item.storage === 'string' ? item.storage : 'fridge',
      expiryDate: typeof item.expiryDate === 'string' ? item.expiryDate : null,
      freshness: typeof item.freshness === 'string' ? item.freshness : 'fresh',
    }));
}

export interface FridgeRescueClientRequest {
  fridgeItems?: CulinaryFridgeItem[];
  householdAllergens?: string[];
  availableCookTimeMinutes?: number;
  servings?: number;
}

export async function askSousChefCopilot(
  input: SousChefContextInput,
  options?: { signal?: AbortSignal },
): Promise<SousChefResponse> {
  const assertCurrent = guardPrivateSession();
  const guard = inspectAndSanitizePrompt(input.question, { maxChars: 1_200 });
  if (!guard.safe) {
    throw new ApiError(
      'http',
      'Câu hỏi chứa nội dung không hợp lệ. Vui lòng đặt câu hỏi xoay quanh nấu ăn và thực phẩm.',
      400,
      { retryable: false },
    );
  }

  const sanitizedPayload: SousChefContextInput = {
    ...input,
    question: guard.sanitizedText,
  };

  try {
    const response = await fetchJson<SousChefResponse>(`${AI_COPILOT_BASE_PATH}/sous-chef`, {
      method: 'POST',
      body: JSON.stringify(sanitizedPayload),
      signal: options?.signal,
    });
    assertCurrent();
    return response;
  } catch (err) {
    assertCurrent();
    if (!shouldUseOfflineEngine(err)) throw err;
    return askSousChefLocal({
      ...sanitizedPayload,
      fridgeItems: sanitizedPayload.fridgeItems ?? mapCachedInventoryToFridgeItems(),
    });
  }
}

export async function fetchSmartSubstitutions(
  input: SmartSubstitutionInput,
  options?: { signal?: AbortSignal },
): Promise<SmartSubstitutionResponse> {
  const assertCurrent = guardPrivateSession();
  const guard = inspectAndSanitizePrompt(input.ingredientName, { maxChars: 160 });
  if (!guard.safe) {
    throw new ApiError('http', 'Tên nguyên liệu không hợp lệ.', 400, { retryable: false });
  }

  const sanitizedPayload: SmartSubstitutionInput = {
    ...input,
    ingredientName: guard.sanitizedText,
  };

  try {
    const response = await fetchJson<SmartSubstitutionResponse>(`${AI_COPILOT_BASE_PATH}/substitutions`, {
      method: 'POST',
      body: JSON.stringify(sanitizedPayload),
      signal: options?.signal,
    });
    assertCurrent();
    return response;
  } catch (err) {
    assertCurrent();
    if (!shouldUseOfflineEngine(err)) throw err;
    return recommendSmartSubstitutionsLocal({
      ...sanitizedPayload,
      fridgeItems: sanitizedPayload.fridgeItems ?? mapCachedInventoryToFridgeItems(),
    });
  }
}

export async function fetchFridgeRescueBrief(
  input: FridgeRescueClientRequest = {},
  options?: { signal?: AbortSignal },
): Promise<FridgeRescueBrief> {
  const assertCurrent = guardPrivateSession();
  try {
    const response = await fetchJson<FridgeRescueBrief>(`${AI_COPILOT_BASE_PATH}/fridge-rescue`, {
      method: 'POST',
      body: JSON.stringify(input),
      signal: options?.signal,
    });
    assertCurrent();
    return response;
  } catch (err) {
    assertCurrent();
    if (!shouldUseOfflineEngine(err)) throw err;
    return composeFridgeRescueBriefLocal({
      fridgeItems: input.fridgeItems ?? mapCachedInventoryToFridgeItems(),
      householdAllergens: input.householdAllergens,
      availableCookTimeMinutes: input.availableCookTimeMinutes ?? 15,
      servings: input.servings,
    });
  }
}

export async function fetchAiGatewayStatus(options?: { signal?: AbortSignal }): Promise<GatewayStatusReport> {
  const assertCurrent = guardPrivateSession();
  try {
    const response = await fetchJson<GatewayStatusReport>(`${AI_COPILOT_BASE_PATH}/status`, {
      method: 'GET',
      signal: options?.signal,
    });
    assertCurrent();
    return response;
  } catch (err) {
    assertCurrent();
    if (!shouldUseOfflineEngine(err)) throw err;
    return {
      gatewayVersion: '4.0.0',
      healthy: true,
      activeMode: 'deterministic_culinary_engine',
      configuredExternalProviders: [],
      routingTable: { ...GATEWAY_TIER_ROUTING_TABLE },
      circuitBreakers: globalCircuitBreakerRegistry.getAllSnapshots(),
      guardrails: {
        promptInjectionShield: true,
        piiRedaction: true,
        allergenOutputGate: true,
        foodSafetyTempGate: true,
        zodSchemaValidation: true,
        d1LiveTelemetry: false,
      },
      isolateUsage: {
        callsByTask: {},
        callsByModel: {},
        inputTokensByTask: {},
        outputTokensByTask: {},
        inputTokensByModel: {},
        outputTokensByModel: {},
        estimatedCostByTask: {},
        estimatedCostByModel: {},
        failures: 0,
        schemaFailures: 0,
        retries: 0,
        escalations: 0,
        latencies: { count: 0, totalMs: 0, maxMs: 0 },
        ocrFailures: 0,
        plannerRepairs: 0,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

export const aiCopilotApi = {
  askSousChef: askSousChefCopilot,
  recommendSubstitutions: fetchSmartSubstitutions,
  getFridgeRescueBrief: fetchFridgeRescueBrief,
  getStatus: fetchAiGatewayStatus,
  quickPresets: ACTIVE_COOKING_QUICK_PRESETS,
  getContextualPresets: getContextualCookingPresets,
};
