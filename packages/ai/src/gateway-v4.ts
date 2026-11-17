import { z } from 'zod';
import { findCanonicalIngredient, findCanonicalIngredientById, normalizeIngredientText } from '@frigo/domain';
import type { AIConfig } from './types';
import {
  AIBudgetExceededError,
  createAIHttpError,
  createAINetworkError,
  createAIResponseError,
  createAISchemaError,
  createAITimeoutError,
  isAIProviderError,
} from './errors';
import { calculateEstimatedCost, createGovernanceConfig, estimateInputTokens } from './model-governance';
import {
  AIPromptGuardError,
  guardStructuredStrings,
  type PromptGuardOptions,
  type PromptGuardResult,
} from './prompt-guard';
import {
  globalCircuitBreakerRegistry,
  type CircuitProviderId,
  type ProviderCircuitBreakerRegistry,
  type ProviderCircuitSnapshot,
} from './circuit-breaker';
import {
  recordAiRequestTelemetry,
  type TelemetryD1Database,
} from './d1-telemetry';
import { AIUsageLedger, type AIUsageSnapshot } from './telemetry';

export const GATEWAY_TASK_TIERS = [
  'fast_triage',
  'sous_chef_copilot',
  'substitution_reasoner',
  'fridge_rescue',
  'vision_ocr',
] as const;

export type GatewayTaskTier = (typeof GATEWAY_TASK_TIERS)[number];

export interface GatewayTierPolicy {
  tier: GatewayTaskTier;
  descriptionVi: string;
  primaryProvider: CircuitProviderId;
  primaryModel: string;
  fallbackOrder: readonly CircuitProviderId[];
  maxInputTokens: number;
  maxOutputTokens: number;
  timeoutMs: number;
  temperature: number;
}

export const GATEWAY_TIER_ROUTING_TABLE: Readonly<Record<GatewayTaskTier, GatewayTierPolicy>> = {
  fast_triage: {
    tier: 'fast_triage',
    descriptionVi: 'Phân loại nhanh ý định bếp & chuẩn hóa nguyên liệu độ trễ thấp',
    primaryProvider: 'qwen',
    primaryModel: 'qwen3.7-flash-2026-07-15',
    fallbackOrder: ['groq', 'cloudflare', 'culinary_knowledge_engine'],
    maxInputTokens: 2_048,
    maxOutputTokens: 384,
    timeoutMs: 8_000,
    temperature: 0.1,
  },
  sous_chef_copilot: {
    tier: 'sous_chef_copilot',
    descriptionVi: 'Phụ bếp thông minh xử lý sự cố nêm nếm, độ chín, lửa & thời gian theo bước nấu',
    primaryProvider: 'qwen',
    primaryModel: 'qwen3.7-flash-2026-07-15',
    fallbackOrder: ['deepseek', 'groq', 'cloudflare', 'culinary_knowledge_engine'],
    maxInputTokens: 4_500,
    maxOutputTokens: 900,
    timeoutMs: 12_000,
    temperature: 0.2,
  },
  substitution_reasoner: {
    tier: 'substitution_reasoner',
    descriptionVi: 'Suy luận thay thế nguyên liệu chuẩn tỷ lệ Việt & ưu tiên đồ sẵn trong tủ lạnh',
    primaryProvider: 'qwen',
    primaryModel: 'qwen3.7-flash-2026-07-15',
    fallbackOrder: ['deepseek', 'groq', 'cloudflare', 'culinary_knowledge_engine'],
    maxInputTokens: 4_096,
    maxOutputTokens: 900,
    timeoutMs: 12_000,
    temperature: 0.15,
  },
  fridge_rescue: {
    tier: 'fridge_rescue',
    descriptionVi: 'Chiến lược giải cứu thực phẩm sắp hết hạn Zero-Waste & ước tính tiết kiệm VND',
    primaryProvider: 'qwen',
    primaryModel: 'qwen3.8-flash',
    fallbackOrder: ['deepseek', 'groq', 'cloudflare', 'culinary_knowledge_engine'],
    maxInputTokens: 6_000,
    maxOutputTokens: 1_200,
    timeoutMs: 15_000,
    temperature: 0.2,
  },
  vision_ocr: {
    tier: 'vision_ocr',
    descriptionVi: 'Nhận diện ảnh tủ lạnh & OCR hóa đơn siêu thị Việt Nam',
    primaryProvider: 'qwen',
    primaryModel: 'qwen-vl-ocr',
    fallbackOrder: ['groq', 'cloudflare'],
    maxInputTokens: 12_000,
    maxOutputTokens: 2_048,
    timeoutMs: 45_000,
    temperature: 0.1,
  },
};

// ── Allergen & Food-Safety Output Gate ───────────────────────────────────────

const ALLERGEN_SYNONYM_GROUPS: Readonly<Record<string, readonly string[]>> = {
  peanut: ['peanut', 'peanuts', 'dau phong', 'lac', 'bo dau phong', 'keo lac', 'muoi vung lac'],
  tree_nut: ['tree_nut', 'tree nut', 'nuts', 'hat dieu', 'oc cho', 'hanh nhan', 'hat de', 'mac ca', 'hat thong'],
  sesame: ['sesame', 'hat vung', 'dau me', 'muoi me', 'hat me'],
  shellfish: [
    'shellfish', 'crustacean', 'hai san co vo', 'hai san', 'shrimp', 'crab', 'squid',
    'tom', 'tom tuoi', 'tom kho', 'mam tom', 'ruoc', 'cua', 'cua dong', 'ghe', 'ngheu', 'so', 'oc', 'hau', 'dau hao', 'muc',
  ],
  fish: [
    'fish', 'salmon', 'ca hoi', 'ca loc', 'ca dieu hong', 'ca ro', 'ca tuoi', 'ca kho',
    'nuoc mam', 'mam ca', 'mam nem', 'fish_sauce', 'salmon_fillet', 'fish_freshwater',
  ],
  egg: ['egg', 'eggs', 'chicken_egg', 'trung', 'trung ga', 'trung vit', 'trung cut', 'mayonnaise', 'sot mayo'],
  dairy: [
    'dairy', 'milk', 'lactose', 'fresh_milk', 'cheddar_cheese', 'butter',
    'sua', 'sua tuoi', 'sua dac', 'pho mai', 'pho mat', 'bo lat', 'bo sua', 'bo dong vat', 'kem tuoi', 'whipping cream', 'sua chua',
  ],
  soy: [
    'soy', 'soybean', 'tofu', 'soy_sauce',
    'dau nanh', 'dau phu', 'dau hu', 'tau hu', 'nuoc tuong', 'xi dau', 'tuong ban', 'chao', 'sua dau nanh',
  ],
  wheat: [
    'wheat', 'gluten', 'spaghetti_pasta',
    'lua mi', 'bot mi', 'mi y', 'pasta', 'spaghetti', 'mi can', 'banh mi', 'mi goi',
  ],
  pork: [
    'pork', 'halal', 'pork_belly', 'ground_pork', 'pork_ribs',
    'thit heo', 'thit lon', 'ba chi', 'ba roi', 'suon heo', 'suon non', 'mo heo', 'cha lua', 'gio lua',
  ],
  beef: ['beef', 'beef_sirloin', 'thit bo', 'bap bo', 'bo vien', 'nam bo', 'gan bo'],
};

const DIETARY_MODE_FORBIDDEN: Readonly<Record<'vegetarian' | 'vegan', readonly string[]>> = {
  vegetarian: [
    'thit heo', 'thit lon', 'ba chi', 'thit bo', 'uc ga', 'dui ga', 'thit ga', 'suon heo',
    'tom', 'cua', 'muc', 'ca hoi', 'ca loc', 'ca tuoi', 'nuoc mam', 'mam tom', 'dau hao',
    'pork_belly', 'ground_pork', 'beef_sirloin', 'chicken_breast', 'chicken_thigh', 'pork_ribs',
    'shrimp', 'salmon_fillet', 'crab_meat', 'squid', 'fish_freshwater', 'fish_sauce',
  ],
  vegan: [
    'thit heo', 'thit lon', 'ba chi', 'thit bo', 'uc ga', 'dui ga', 'thit ga', 'suon heo',
    'tom', 'cua', 'muc', 'ca hoi', 'ca loc', 'ca tuoi', 'nuoc mam', 'mam tom', 'dau hao',
    'trung', 'trung ga', 'sua tuoi', 'sua dac', 'pho mai', 'bo lat', 'mat ong',
    'pork_belly', 'ground_pork', 'beef_sirloin', 'chicken_breast', 'chicken_thigh', 'pork_ribs',
    'shrimp', 'salmon_fillet', 'crab_meat', 'squid', 'fish_freshwater', 'fish_sauce',
    'chicken_egg', 'fresh_milk', 'cheddar_cheese', 'butter',
  ],
};

function expandRestrictionKeywords(restrictions: readonly string[]): Set<string> {
  const expanded = new Set<string>();
  for (const raw of restrictions) {
    const clean = normalizeIngredientText(raw);
    if (!clean) continue;
    expanded.add(clean);

    // Canonical lookup (e.g., "SHRIMP" -> "tom tuoi", "shrimp", aliases)
    const byId = findCanonicalIngredientById(raw);
    const byName = byId ?? findCanonicalIngredient(raw);
    if (byName) {
      expanded.add(normalizeIngredientText(byName.id));
      expanded.add(normalizeIngredientText(byName.nameVi));
      expanded.add(normalizeIngredientText(byName.nameEn));
      for (const alias of byName.aliases) {
        expanded.add(normalizeIngredientText(alias));
      }
    }

    if (clean === 'an chay' || clean === 'chay' || clean === 'vegetarian') {
      for (const kw of DIETARY_MODE_FORBIDDEN.vegetarian) expanded.add(normalizeIngredientText(kw));
      continue;
    }
    if (clean === 'thuan chay' || clean === 'vegan') {
      for (const kw of DIETARY_MODE_FORBIDDEN.vegan) expanded.add(normalizeIngredientText(kw));
      continue;
    }

    for (const [groupKey, groupTerms] of Object.entries(ALLERGEN_SYNONYM_GROUPS)) {
      const normalizedGroupKey = normalizeIngredientText(groupKey);
      if (
        clean === normalizedGroupKey ||
        clean.includes(`di ung ${normalizedGroupKey}`) ||
        groupTerms.some((term) => normalizeIngredientText(term) === clean)
      ) {
        for (const term of groupTerms) expanded.add(normalizeIngredientText(term));
      }
    }
  }
  return expanded;
}

/**
 * Checks whether a candidate ingredient name or canonical ID conflicts with any
 * household allergen, dietary restriction, or forbidden ingredient.
 */
export function matchesHouseholdAllergen(
  candidateNameOrId: string,
  householdAllergens: readonly string[] | undefined,
): { matched: boolean; matchedTerm?: string } {
  if (!householdAllergens || householdAllergens.length === 0) {
    return { matched: false };
  }
  const normalizedCandidate = normalizeIngredientText(candidateNameOrId);
  if (!normalizedCandidate) return { matched: false };

  const candidateTokens = new Set<string>([normalizedCandidate]);
  const canonical = findCanonicalIngredient(candidateNameOrId);
  if (canonical) {
    candidateTokens.add(normalizeIngredientText(canonical.id));
    candidateTokens.add(normalizeIngredientText(canonical.nameVi));
    candidateTokens.add(normalizeIngredientText(canonical.nameEn));
    for (const alias of canonical.aliases) {
      candidateTokens.add(normalizeIngredientText(alias));
    }
  }

  const forbiddenTerms = expandRestrictionKeywords(householdAllergens);
  for (const forbidden of forbiddenTerms) {
    if (!forbidden) continue;
    for (const cand of candidateTokens) {
      if (cand === forbidden) {
        return { matched: true, matchedTerm: forbidden };
      }
      // Word-boundary check so short terms like "bo" or "ca" don't false-match "bo cai" or "ca chua".
      const escaped = forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const boundaryRe = new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`);
      if (forbidden.length >= 4 && boundaryRe.test(cand)) {
        // Guard "ca chua" / "ca rot" / "ca tim" against "ca" (fish), and "bo cai" / "trai bo" against "bo" (butter/beef)
        if (
          forbidden === 'ca' &&
          /\bca\s+(?:chua|rot|tim|phao)\b/.test(cand)
        ) {
          continue;
        }
        return { matched: true, matchedTerm: forbidden };
      }
    }
  }
  return { matched: false };
}

export interface FoodSafetyGateReport {
  safe: boolean;
  safetyAlertVi?: string;
  flags: string[];
}

const UNSAFE_RAW_POULTRY_OR_PORK_RE =
  /\b(?:ga\s+tai|uc\s+ga\s+tai|thit\s+ga\s+song|thit\s+heo\s+tai|thit\s+lon\s+tai|thit\s+bam\s+tai|an\s+song\s+thit\s+(?:ga|heo|lon))\b/i;

const UNSAFE_POULTRY_TEMP_RE =
  /\b(?:ga|uc\s+ga|dui\s+ga|gia\s+cam)[^.\n]{0,45}?\b(?:4\d|5\d|6[0-8])\s*°?\s*c\b/i;

/**
 * Inspects generated culinary advice for dangerous raw meat/poultry suggestions
 * or sub-safe internal temperatures.
 */
export function inspectCulinaryFoodSafety(textVi: string): FoodSafetyGateReport {
  const folded = normalizeIngredientText(textVi);
  const flags: string[] = [];
  const alerts: string[] = [];

  if (UNSAFE_RAW_POULTRY_OR_PORK_RE.test(folded)) {
    flags.push('UNSAFE_RAW_POULTRY_OR_PORK');
    alerts.push(
      'An toàn thực phẩm bắt buộc: Tuyệt đối KHÔNG ăn tái hoặc sống thịt gia cầm, thịt heo và thịt xay. Hãy nấu chín kỹ hoàn toàn (tâm thịt gà ≥ 74°C, thịt heo/bò xay ≥ 71°C).',
    );
  }

  if (UNSAFE_POULTRY_TEMP_RE.test(textVi.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase())) {
    flags.push('UNSAFE_POULTRY_INTERNAL_TEMP');
    alerts.push(
      'Lưu ý nhiệt độ an toàn: Thịt gia cầm (gà/vịt) bắt buộc đạt nhiệt độ tâm tối thiểu 74°C (nước tiết ra trong suốt, không còn màu hồng).',
    );
  }

  return {
    safe: flags.length === 0,
    ...(alerts.length > 0 ? { safetyAlertVi: alerts.join(' ') } : {}),
    flags,
  };
}

// ── Per-User / Isolate Sliding Budget Guard ──────────────────────────────────

class GatewayQuotaGuard {
  private readonly buckets = new Map<string, { count: number; tokens: number; resetAtMs: number }>();

  checkAndReserve(
    scopeKey: string,
    estimatedTokens: number,
    maxRequestsPerMinute = 45,
    maxTokensPerMinute = 80_000,
    nowMs = Date.now(),
  ): void {
    const key = scopeKey || 'anonymous';
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAtMs <= nowMs) {
      this.buckets.set(key, {
        count: 1,
        tokens: estimatedTokens,
        resetAtMs: nowMs + 60_000,
      });
      if (this.buckets.size > 500) {
        for (const [k, v] of this.buckets.entries()) {
          if (v.resetAtMs <= nowMs) this.buckets.delete(k);
        }
      }
      return;
    }

    if (existing.count >= maxRequestsPerMinute || existing.tokens + estimatedTokens > maxTokensPerMinute) {
      throw new AIBudgetExceededError(
        'AI_BUDGET_EXCEEDED: Đã vượt ngưỡng tần suất gọi AI trong 1 phút. Vui lòng thử lại sau giây lát.',
        key,
      );
    }
    existing.count += 1;
    existing.tokens += estimatedTokens;
  }
}

const globalQuotaGuard = new GatewayQuotaGuard();

// ── JSON Extraction & Confidence Calibration ─────────────────────────────────

export function parseGatewayJson(raw: unknown): unknown {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        // continue
      }
    }
    const objStart = trimmed.indexOf('{');
    const objEnd = trimmed.lastIndexOf('}');
    if (objStart >= 0 && objEnd > objStart) {
      try {
        return JSON.parse(trimmed.slice(objStart, objEnd + 1));
      } catch {
        // continue
      }
    }
  }
  return null;
}

export function calibrateGatewayConfidence(params: {
  mode: 'llm' | 'culinary_knowledge_engine';
  rawConfidence?: number;
  hasRichContext: boolean;
  safetyFlagCount: number;
  usedFallbackProvider: boolean;
}): number {
  const base =
    typeof params.rawConfidence === 'number' && Number.isFinite(params.rawConfidence)
      ? Math.min(1, Math.max(0, params.rawConfidence))
      : params.mode === 'llm'
        ? 0.91
        : 0.88;

  let adjusted = base;
  if (params.hasRichContext) adjusted += 0.03;
  if (params.usedFallbackProvider && params.mode === 'llm') adjusted -= 0.03;
  if (params.safetyFlagCount > 0) adjusted -= Math.min(0.15, params.safetyFlagCount * 0.06);

  return Math.round(Math.min(0.99, Math.max(0.35, adjusted)) * 100) / 100;
}

// ── Gateway Execution Contract ───────────────────────────────────────────────

export interface GatewayStructuredRequest<TInput, TOutput> {
  tier: GatewayTaskTier;
  /** D1 telemetry task label (e.g., `sous_chef_copilot`, `smart_substitutions`, `fridge_rescue`). */
  telemetryTask: string;
  userId?: string | null;
  input: TInput;
  promptGuardOptions?: PromptGuardOptions;
  systemPrompt: string;
  buildUserPrompt: (sanitizedInput: TInput) => string;
  schema: z.ZodType<TOutput>;
  /** Always-available deterministic Vietnamese culinary intelligence fallback. */
  deterministicFallback: (sanitizedInput: TInput) => TOutput;
  /** Optional post-validation allergen & food-safety output sanitizer. */
  outputSafetyGate?: (output: TOutput, sanitizedInput: TInput) => { output: TOutput; safetyFlags: string[] };
  hasRichContext?: boolean;
  signal?: AbortSignal;
}

export interface GatewayStructuredResult<TOutput> {
  data: TOutput;
  provider: CircuitProviderId;
  model: string;
  mode: 'llm' | 'culinary_knowledge_engine';
  confidence: number;
  latencyMs: number;
  promptGuard: PromptGuardResult;
  safetyFlags: string[];
  inputTokens: number;
  outputTokens: number;
}

export interface GatewayStatusReport {
  gatewayVersion: '4.0.0';
  healthy: boolean;
  activeMode: 'hybrid_llm_plus_culinary_engine' | 'deterministic_culinary_engine';
  configuredExternalProviders: CircuitProviderId[];
  routingTable: Record<GatewayTaskTier, GatewayTierPolicy>;
  circuitBreakers: Record<CircuitProviderId, ProviderCircuitSnapshot>;
  guardrails: {
    promptInjectionShield: true;
    piiRedaction: true;
    allergenOutputGate: true;
    foodSafetyTempGate: true;
    zodSchemaValidation: true;
    d1LiveTelemetry: boolean;
  };
  isolateUsage: AIUsageSnapshot;
  generatedAt: string;
}

export interface TakolioAiGatewayOptions {
  config: AIConfig;
  db?: TelemetryD1Database | null;
  waitUntil?: (promise: Promise<unknown>) => void;
  circuitBreakers?: ProviderCircuitBreakerRegistry;
}

const QWEN_DEFAULT_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const DEEPSEEK_DEFAULT_URL = 'https://api.deepseek.com/v1';
const GROQ_DEFAULT_URL = 'https://api.groq.com/openai/v1';

/**
 * Takolio Modern Multi-Tier AI Gateway V4.
 * Pipeline: PromptGuard -> Quota/Budget -> Tier Routing -> Circuit-Breaker Dispatch
 * + Zod Validation -> Allergen & Food-Safety Output Gate -> Confidence Calibration -> D1 Telemetry.
 */
export class TakolioAiGateway {
  private readonly config: AIConfig;
  private readonly db?: TelemetryD1Database | null;
  private readonly waitUntil?: (promise: Promise<unknown>) => void;
  private readonly breakers: ProviderCircuitBreakerRegistry;
  private readonly ledger = new AIUsageLedger();

  constructor(options: TakolioAiGatewayOptions) {
    this.config = options.config;
    this.db = options.db;
    this.waitUntil = options.waitUntil ?? options.config.backgroundExecutor;
    this.breakers = options.circuitBreakers ?? globalCircuitBreakerRegistry;
  }

  getConfiguredExternalProviders(): CircuitProviderId[] {
    if (this.config.aiMockMode) return [];
    const list: CircuitProviderId[] = [];
    if (this.config.qwenApiKey?.trim()) list.push('qwen');
    if (this.config.deepseekApiKey?.trim() && this.config.deepseekFallbackEnabled !== false) {
      list.push('deepseek');
    }
    if (this.config.groqApiKey?.trim() && this.config.groqFallbackEnabled !== false) {
      list.push('groq');
    }
    if (this.config.aiBinding) {
      list.push('cloudflare');
    }
    return list;
  }

  getStatus(): GatewayStatusReport {
    const configured = this.getConfiguredExternalProviders();
    const snapshots = this.breakers.getAllSnapshots();
    const anyHealthyExternal = configured.some((provider) => snapshots[provider].healthy);

    return {
      gatewayVersion: '4.0.0',
      healthy: true, // Culinary engine ensures continuous availability even when upstream LLMs degrade
      activeMode: configured.length > 0 && anyHealthyExternal
        ? 'hybrid_llm_plus_culinary_engine'
        : 'deterministic_culinary_engine',
      configuredExternalProviders: configured,
      routingTable: { ...GATEWAY_TIER_ROUTING_TABLE },
      circuitBreakers: snapshots,
      guardrails: {
        promptInjectionShield: true,
        piiRedaction: true,
        allergenOutputGate: true,
        foodSafetyTempGate: true,
        zodSchemaValidation: true,
        d1LiveTelemetry: Boolean(this.db),
      },
      isolateUsage: this.ledger.snapshot(),
      generatedAt: new Date().toISOString(),
    };
  }

  async executeStructured<TInput, TOutput>(
    request: GatewayStructuredRequest<TInput, TOutput>,
  ): Promise<GatewayStructuredResult<TOutput>> {
    const startedAt = Date.now();
    const policy = GATEWAY_TIER_ROUTING_TABLE[request.tier];
    const governance = this.config.governance ?? createGovernanceConfig();

    // 1. PromptGuard: inspect & sanitize all string inputs, strip PII, block prompt-injection
    const guardVerdict = guardStructuredStrings(request.input, {
      maxChars: policy.maxInputTokens * 3,
      maxEstimatedTokens: policy.maxInputTokens,
      ...request.promptGuardOptions,
    });

    const promptGuardSummary: PromptGuardResult = {
      safe: guardVerdict.safe,
      sanitizedText: '',
      riskScore: guardVerdict.riskScore,
      flags: guardVerdict.flags,
    };

    if (!guardVerdict.safe) {
      const latencyMs = Math.max(1, Date.now() - startedAt);
      await recordAiRequestTelemetry(
        this.db,
        {
          userId: request.userId,
          task: request.telemetryTask,
          provider: 'prompt-guard',
          model: 'guardrail-v4',
          inputTokens: estimateInputTokens(request.input),
          outputTokens: 0,
          latencyMs,
          estimatedCostUsd: 0,
          status: 'blocked',
        },
        { waitUntil: this.waitUntil },
      );
      throw new AIPromptGuardError(
        'Yêu cầu chứa nội dung không hợp lệ hoặc vượt ngoài phạm vi trợ lý bếp Takolio. Vui lòng đặt câu hỏi về nấu ăn và thực phẩm.',
        guardVerdict,
      );
    }

    const sanitizedInput = guardVerdict.sanitizedPayload;
    const userPrompt = request.buildUserPrompt(sanitizedInput);
    const estimatedInput = estimateInputTokens(`${request.systemPrompt}\n${userPrompt}`);

    // 2. Quota & Token Ceiling Check
    if (!governance.aiEnabled) {
      throw new AIBudgetExceededError('AI_DISABLED: Trợ lý AI hiện đang tạm tắt theo cấu hình.', request.telemetryTask);
    }
    if (estimatedInput > policy.maxInputTokens) {
      throw new AIBudgetExceededError(
        `AI_BUDGET_EXCEEDED: Nội dung đầu vào vượt giới hạn ${policy.maxInputTokens} token.`,
        request.telemetryTask,
      );
    }
    globalQuotaGuard.checkAndReserve(request.userId || 'household_anon', estimatedInput);

    // 3. Build Multi-Provider Candidate Chain with Circuit-Breaker Filtering
    const candidateChain = this.resolveProviderChain(policy);
    let resolvedOutput: TOutput | undefined;
    let winningProvider: CircuitProviderId = 'culinary_knowledge_engine';
    let winningModel = 'takolio-culinary-v4';
    let inputTokens = estimatedInput;
    let outputTokens = 0;
    let usedFallbackProvider = false;

    for (let idx = 0; idx < candidateChain.length; idx += 1) {
      const candidate = candidateChain[idx];
      if (!this.breakers.acquireSlot(candidate.provider)) {
        continue;
      }
      const attemptStartedAt = Date.now();
      try {
        const completion = await this.invokeExternalProvider(
          candidate.provider,
          candidate.model,
          request.systemPrompt,
          userPrompt,
          policy,
          request.signal,
        );
        const parsedJson = parseGatewayJson(completion.rawText);
        if (parsedJson === null || typeof parsedJson !== 'object') {
          throw createAIResponseError(candidate.provider, `${candidate.provider} returned non-JSON output`, candidate.model);
        }
        let validated: TOutput;
        try {
          validated = request.schema.parse(parsedJson);
        } catch (zodErr) {
          throw createAISchemaError(candidate.provider, `${candidate.provider} failed Zod schema validation`, candidate.model, zodErr);
        }

        this.breakers.recordSuccess(candidate.provider, Date.now() - attemptStartedAt);
        resolvedOutput = validated;
        winningProvider = candidate.provider;
        winningModel = candidate.model;
        inputTokens = completion.inputTokens ?? estimatedInput;
        outputTokens = completion.outputTokens ?? Math.ceil(completion.rawText.length / 4);
        usedFallbackProvider = idx > 0;
        break;
      } catch (err) {
        const status = isAIProviderError(err) ? err.status : undefined;
        const code = isAIProviderError(err) ? err.code : 'UPSTREAM_ERROR';
        this.breakers.recordFailure(candidate.provider, Date.now() - attemptStartedAt, {
          status,
          errorCode: code,
          isTimeout: code === 'REQUEST_TIMEOUT',
          isRateLimited: status === 429 || code === 'RATE_LIMITED',
        });
      }
    }

    // 4. Deterministic Vietnamese Culinary Intelligence Fallback (Zero-500 Guarantee)
    let mode: 'llm' | 'culinary_knowledge_engine' = 'llm';
    if (resolvedOutput === undefined) {
      mode = 'culinary_knowledge_engine';
      winningProvider = 'culinary_knowledge_engine';
      winningModel = 'takolio-culinary-v4';
      const fallbackRaw = request.deterministicFallback(sanitizedInput);
      resolvedOutput = request.schema.parse(fallbackRaw);
      inputTokens = estimatedInput;
      outputTokens = Math.ceil(JSON.stringify(resolvedOutput).length / 4);
      this.breakers.recordSuccess('culinary_knowledge_engine', Math.max(1, Date.now() - startedAt));
    }

    // 5. Allergen & Food-Safety Output Gate
    let safetyFlags: string[] = [];
    if (request.outputSafetyGate) {
      const gated = request.outputSafetyGate(resolvedOutput, sanitizedInput);
      resolvedOutput = request.schema.parse(gated.output);
      safetyFlags = gated.safetyFlags;
    }

    // 6. Confidence Calibration
    const latencyMs = Math.max(1, Date.now() - startedAt);
    const existingConfidence =
      resolvedOutput && typeof resolvedOutput === 'object' && 'confidence' in (resolvedOutput as Record<string, unknown>)
        ? Number((resolvedOutput as Record<string, unknown>).confidence)
        : undefined;

    const calibratedConfidence = calibrateGatewayConfidence({
      mode,
      rawConfidence: existingConfidence,
      hasRichContext: Boolean(request.hasRichContext),
      safetyFlagCount: safetyFlags.length,
      usedFallbackProvider,
    });

    if (resolvedOutput && typeof resolvedOutput === 'object') {
      const mutable = { ...(resolvedOutput as Record<string, unknown>) };
      if ('confidence' in mutable) mutable.confidence = calibratedConfidence;
      if ('mode' in mutable) mutable.mode = mode;
      if ('latencyMs' in mutable) mutable.latencyMs = latencyMs;
      resolvedOutput = request.schema.parse(mutable);
    }

    // 7. Live D1 Telemetry + Isolate Usage Ledger
    const estimatedCostUsd =
      mode === 'llm'
        ? calculateEstimatedCost(governance, winningModel, inputTokens, outputTokens)
        : 0;
    const telemetryStatus = mode === 'llm' && !usedFallbackProvider ? 'success' : 'fallback';

    this.ledger.record({
      userId: request.userId ?? undefined,
      task: 'fridge_chat',
      provider: winningProvider,
      model: winningModel,
      physicalModel: winningModel,
      inputTokens,
      outputTokens,
      latencyMs,
      estimatedCost: estimatedCostUsd,
      estimatedCostUsd,
      status: telemetryStatus,
      createdAt: new Date().toISOString(),
    });

    await recordAiRequestTelemetry(
      this.db,
      {
        userId: request.userId,
        task: request.telemetryTask,
        provider: winningProvider,
        model: winningModel,
        inputTokens,
        outputTokens,
        latencyMs,
        estimatedCostUsd,
        status: telemetryStatus,
      },
      { waitUntil: this.waitUntil },
    );

    return {
      data: resolvedOutput,
      provider: winningProvider,
      model: winningModel,
      mode,
      confidence: calibratedConfidence,
      latencyMs,
      promptGuard: promptGuardSummary,
      safetyFlags,
      inputTokens,
      outputTokens,
    };
  }

  private resolveProviderChain(policy: GatewayTierPolicy): Array<{ provider: CircuitProviderId; model: string }> {
    if (this.config.aiMockMode) return [];
    const chain: Array<{ provider: CircuitProviderId; model: string }> = [];
    const ordered: CircuitProviderId[] = [
      policy.primaryProvider,
      ...policy.fallbackOrder.filter((p) => p !== 'culinary_knowledge_engine' && p !== policy.primaryProvider),
    ];

    for (const provider of ordered) {
      if (provider === 'qwen' && this.config.qwenApiKey?.trim()) {
        chain.push({
          provider: 'qwen',
          model: this.config.qwenModel?.trim() || policy.primaryModel,
        });
      } else if (
        provider === 'deepseek' &&
        this.config.deepseekApiKey?.trim() &&
        this.config.deepseekFallbackEnabled !== false
      ) {
        chain.push({ provider: 'deepseek', model: 'deepseek-chat' });
      } else if (
        provider === 'groq' &&
        this.config.groqApiKey?.trim() &&
        this.config.groqFallbackEnabled !== false
      ) {
        chain.push({ provider: 'groq', model: 'llama-3.1-8b-instant' });
      } else if (provider === 'cloudflare' && this.config.aiBinding) {
        chain.push({ provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct' });
      }
    }
    return chain;
  }

  private async invokeExternalProvider(
    provider: CircuitProviderId,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    policy: GatewayTierPolicy,
    callerSignal?: AbortSignal,
  ): Promise<{ rawText: string; inputTokens?: number; outputTokens?: number }> {
    if (provider === 'cloudflare') {
      if (!this.config.aiBinding) {
        throw createAINetworkError('cloudflare', new Error('Cloudflare AI binding missing'), model);
      }
      const res = await this.config.aiBinding.run(model, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: policy.maxOutputTokens,
        temperature: policy.temperature,
      });
      const text =
        typeof res === 'string'
          ? res
          : res && typeof res === 'object'
            ? String(
                (res as Record<string, unknown>).response ??
                  (res as Record<string, unknown>).content ??
                  (res as Record<string, unknown>).output_text ??
                  '',
              )
            : '';
      if (!text.trim()) {
        throw createAIResponseError('cloudflare', 'Cloudflare Workers AI returned empty text', model);
      }
      return { rawText: text };
    }

    let baseUrl = QWEN_DEFAULT_URL;
    let apiKey = '';
    if (provider === 'qwen') {
      baseUrl = (this.config.qwenBaseUrl || QWEN_DEFAULT_URL).replace(/\/$/, '');
      apiKey = this.config.qwenApiKey || '';
    } else if (provider === 'deepseek') {
      baseUrl = (this.config.deepseekBaseUrl || DEEPSEEK_DEFAULT_URL).replace(/\/$/, '');
      apiKey = this.config.deepseekApiKey || '';
    } else if (provider === 'groq') {
      baseUrl = (this.config.groqBaseUrl || GROQ_DEFAULT_URL).replace(/\/$/, '');
      apiKey = this.config.groqApiKey || '';
    }

    const timeoutMs = Math.min(policy.timeoutMs, this.config.qwenRequestTimeoutMs || policy.timeoutMs);
    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: policy.temperature,
          max_tokens: policy.maxOutputTokens,
          response_format: { type: 'json_object' },
          ...(provider === 'qwen' ? { enable_thinking: false } : {}),
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw createAIHttpError(provider, response.status, detail, model);
      }

      const envelope = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number };
      };
      const rawContent = envelope.choices?.[0]?.message?.content;
      const text = typeof rawContent === 'string' ? rawContent.trim() : '';
      if (!text) {
        throw createAIResponseError(provider, `${provider} returned empty completion`, model);
      }

      const inTok = Number(envelope.usage?.input_tokens ?? envelope.usage?.prompt_tokens);
      const outTok = Number(envelope.usage?.output_tokens ?? envelope.usage?.completion_tokens);
      return {
        rawText: text,
        ...(Number.isFinite(inTok) && inTok >= 0 ? { inputTokens: inTok } : {}),
        ...(Number.isFinite(outTok) && outTok >= 0 ? { outputTokens: outTok } : {}),
      };
    } catch (err) {
      if (isAIProviderError(err)) throw err;
      if (timedOut || (err instanceof Error && err.name === 'AbortError')) {
        throw createAITimeoutError(provider, timeoutMs, model, err);
      }
      throw createAINetworkError(provider, err, model);
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }
  }
}
