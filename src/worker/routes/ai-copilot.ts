import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import {
  AIBudgetExceededError,
  AIPromptGuardError,
  CulinaryFridgeItemSchema,
  DishRoleSchema,
  RecipeLineItemSchema,
  inspectAndSanitizePrompt,
  isAIProviderError,
  recordAiRequestTelemetry,
} from '@takolio/ai';
import { rateLimiter } from '../middleware/rate-limit';
import { tenancyGuard } from '../middleware/tenancy';
import {
  getAiCopilotGatewayStatus,
  runFridgeRescueCopilot,
  runSmartSubstitutions,
  runSousChefCopilot,
} from '../services/ai-copilot';
import type { AuthContext, Env } from '../types';

export type AppContext = {
  Bindings: Env;
  Variables: { auth: AuthContext };
};

type CopilotRouteContext = Context<AppContext>;

export const SousChefRouteRequestSchema = z
  .object({
    question: z.string().trim().min(1, 'Vui lòng nhập câu hỏi cho Phụ bếp AI').max(1_200),
    recipeTitle: z.string().trim().max(200).optional(),
    currentStepNumber: z.number().int().min(1).max(60).optional(),
    currentStepText: z.string().trim().max(1_500).optional(),
    heatLevel: z.string().trim().max(48).optional(),
    recipeIngredients: z.array(RecipeLineItemSchema).max(60).optional(),
    fridgeItems: z.array(CulinaryFridgeItemSchema).max(150).optional(),
    householdAllergens: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    servings: z.number().int().min(1).max(24).optional(),
  })
  .strict();

export const SubstitutionsRouteRequestSchema = z
  .object({
    ingredientName: z.string().trim().min(1, 'Vui lòng cung cấp tên nguyên liệu cần thay thế').max(160),
    ingredientId: z.string().trim().max(80).optional(),
    requiredQuantity: z.number().positive().max(100_000).optional(),
    unit: z.string().trim().max(32).optional(),
    dishRole: DishRoleSchema.optional(),
    recipeTitle: z.string().trim().max(200).optional(),
    fridgeItems: z.array(CulinaryFridgeItemSchema).max(150).optional(),
    householdAllergens: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  })
  .strict();

export const FridgeRescueRouteRequestSchema = z
  .object({
    fridgeItems: z.array(CulinaryFridgeItemSchema).max(150).optional(),
    householdAllergens: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    availableCookTimeMinutes: z.number().int().min(5).max(180).optional(),
    servings: z.number().int().min(1).max(20).optional(),
  })
  .strict();

function safeWaitUntil(c: CopilotRouteContext): ((promise: Promise<unknown>) => void) | undefined {
  try {
    const execCtx = c.executionCtx;
    if (execCtx && typeof execCtx.waitUntil === 'function') {
      return (promise) => execCtx.waitUntil(promise);
    }
  } catch {
    // No ExecutionContext attached (e.g., direct unit/integration test harness)
  }
  return undefined;
}

async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  c: CopilotRouteContext,
  schema: TSchema,
  allowEmptyObject = false,
): Promise<{ ok: true; data: z.output<TSchema> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    const text = await c.req.text();
    raw = !text.trim() && allowEmptyObject ? {} : JSON.parse(text);
  } catch {
    return {
      ok: false,
      response: c.json(
        { error: 'Dữ liệu JSON gửi lên không hợp lệ.', code: 'INVALID_JSON' },
        400,
      ),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: c.json(
        {
          error: parsed.error.issues[0]?.message || 'Dữ liệu yêu cầu chưa hợp lệ.',
          code: 'VALIDATION_ERROR',
          issues: parsed.error.issues.slice(0, 5).map((issue) => ({
            path: issue.path.join('.') || '$',
            message: issue.message,
          })),
        },
        422,
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

function handleCopilotError(c: CopilotRouteContext, error: unknown) {
  if (error instanceof AIPromptGuardError) {
    return c.json(
      {
        error: error.message,
        code: 'AI_PROMPT_GUARD_BLOCKED',
        riskScore: error.riskScore,
        flags: error.flags,
      },
      400,
    );
  }
  if (error instanceof AIBudgetExceededError) {
    const status = error.message.startsWith('AI_DISABLED') ? 503 : 429;
    return c.json(
      {
        error: error.message,
        code: error.code,
      },
      status,
    );
  }
  if (isAIProviderError(error)) {
    return c.json(
      {
        error: error.message,
        code: error.code,
        retryable: error.retryable,
      },
      error.status === 400 ? 400 : 503,
    );
  }
  return c.json(
    {
      error: 'Trợ lý bếp AI tạm thời gián đoạn. Vui lòng thử lại.',
      code: 'AI_COPILOT_ERROR',
    },
    500,
  );
}

const handleSousChef = async (c: CopilotRouteContext) => {
  const startedAt = Date.now();
  const parsed = await parseJsonBody(c, SousChefRouteRequestSchema);
  if (!parsed.ok) return parsed.response;

  const auth = c.get('auth');
  const waitUntil = safeWaitUntil(c);

  // Explicit route-boundary PromptGuard check before loading D1 snapshots
  const questionGuard = inspectAndSanitizePrompt(parsed.data.question, { maxChars: 1_200 });
  if (!questionGuard.safe) {
    await recordAiRequestTelemetry(
      c.env.DB,
      {
        userId: auth?.userId ?? null,
        task: 'sous_chef_copilot',
        provider: 'prompt-guard',
        model: 'guardrail-v4',
        inputTokens: Math.ceil(parsed.data.question.length / 4),
        outputTokens: 0,
        latencyMs: Math.max(1, Date.now() - startedAt),
        estimatedCostUsd: 0,
        status: 'blocked',
      },
      { waitUntil },
    );
    return c.json(
      {
        error: 'Câu hỏi chứa cú pháp can thiệp hệ thống hoặc mã không an toàn. Hãy đặt câu hỏi xoay quanh nấu nướng nhé!',
        code: 'AI_PROMPT_GUARD_BLOCKED',
        riskScore: questionGuard.riskScore,
        flags: questionGuard.flags,
      },
      400,
    );
  }

  try {
    const result = await runSousChefCopilot(
      c.env,
      auth,
      { ...parsed.data, question: questionGuard.sanitizedText },
      waitUntil,
    );
    return c.json(result, 200);
  } catch (error) {
    return handleCopilotError(c, error);
  }
};

const handleSubstitutions = async (c: CopilotRouteContext) => {
  const startedAt = Date.now();
  const parsed = await parseJsonBody(c, SubstitutionsRouteRequestSchema);
  if (!parsed.ok) return parsed.response;

  const auth = c.get('auth');
  const waitUntil = safeWaitUntil(c);

  const ingredientGuard = inspectAndSanitizePrompt(parsed.data.ingredientName, { maxChars: 160 });
  if (!ingredientGuard.safe) {
    await recordAiRequestTelemetry(
      c.env.DB,
      {
        userId: auth?.userId ?? null,
        task: 'smart_substitutions',
        provider: 'prompt-guard',
        model: 'guardrail-v4',
        inputTokens: Math.ceil(parsed.data.ingredientName.length / 4),
        outputTokens: 0,
        latencyMs: Math.max(1, Date.now() - startedAt),
        estimatedCostUsd: 0,
        status: 'blocked',
      },
      { waitUntil },
    );
    return c.json(
      {
        error: 'Tên nguyên liệu chứa nội dung không hợp lệ.',
        code: 'AI_PROMPT_GUARD_BLOCKED',
        riskScore: ingredientGuard.riskScore,
        flags: ingredientGuard.flags,
      },
      400,
    );
  }

  try {
    const result = await runSmartSubstitutions(
      c.env,
      auth,
      { ...parsed.data, ingredientName: ingredientGuard.sanitizedText },
      waitUntil,
    );
    return c.json(result, 200);
  } catch (error) {
    return handleCopilotError(c, error);
  }
};

const handleFridgeRescue = async (c: CopilotRouteContext) => {
  const parsed = await parseJsonBody(c, FridgeRescueRouteRequestSchema, true);
  if (!parsed.ok) return parsed.response;

  const auth = c.get('auth');
  const waitUntil = safeWaitUntil(c);

  try {
    const result = await runFridgeRescueCopilot(c.env, auth, parsed.data, waitUntil);
    return c.json(result, 200);
  } catch (error) {
    return handleCopilotError(c, error);
  }
};

const handleStatus = async (c: CopilotRouteContext) => {
  const auth = c.get('auth');
  if (!auth?.userId) {
    return c.json({ error: 'Unauthorized: Authentication required', code: 'UNAUTHORIZED' }, 401);
  }
  const status = getAiCopilotGatewayStatus(c.env);
  return c.json(status, 200);
};

export const aiCopilotRoutes = new Hono<AppContext>();

aiCopilotRoutes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});

const copilotBodyLimit = bodyLimit({
  maxSize: 32_768,
  onError: (c) =>
    c.json(
      { error: 'Nội dung gửi lên vượt giới hạn 32KB.', code: 'PAYLOAD_TOO_LARGE' },
      413,
    ),
});

const copilotRateLimit = rateLimiter({
  maxRequests: 30,
  windowSeconds: 60,
  prefix: 'ai-copilot',
});

// Support mounting at `/ai-copilot`, `/ai`, OR `/` (consistent with src/worker/index.ts `api.route('/', ...)`).
for (const prefix of ['', '/ai-copilot', '/ai'] as const) {
  aiCopilotRoutes.post(`${prefix}/sous-chef`, tenancyGuard, copilotBodyLimit, copilotRateLimit, handleSousChef);
  aiCopilotRoutes.post(`${prefix}/substitutions`, tenancyGuard, copilotBodyLimit, copilotRateLimit, handleSubstitutions);
  aiCopilotRoutes.post(`${prefix}/fridge-rescue`, tenancyGuard, copilotBodyLimit, copilotRateLimit, handleFridgeRescue);
  aiCopilotRoutes.get(`${prefix}/status`, copilotRateLimit, handleStatus);
}
