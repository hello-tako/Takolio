import { Hono, type Context, type Next } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { AuthContext, Env } from '../types';
import { hasTrustedOrigin } from '../middleware/csrf';
import { withDurableIdempotency } from '../middleware/idempotency-ledger';
import { rateLimiter } from '../middleware/rate-limit';
import { tenancyGuard } from '../middleware/tenancy';
import { SESSION_COOKIE } from '../utils/session';
import {
  autoRestockLowStaples,
  computeKitchenOsInsights,
  computeKitchenOsPulse,
  deleteHeirloomRecipe,
  getHeirloomRecipeByIdOrSlug,
  listHeirloomRecipes,
  listPantryThresholdsWithStock,
  matchesIfNoneMatch,
  recordBudgetExpense,
  recordWasteEvent,
  saveHeirloomRecipe,
  seedVietnamesePantryStaples,
  upsertPantryThreshold,
  upsertWeeklyBudgetTarget,
} from '../services/backend-power-engine';

type KitchenOsVariables = { auth: AuthContext; householdRole?: string };
export const kitchenOsRoutes = new Hono<{ Bindings: Env; Variables: KitchenOsVariables }>();

export async function enforceTrustedOrigin(
  c: Context<{ Bindings: Env; Variables: KitchenOsVariables }>,
  next: Next,
) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
    const cookieHeader = c.req.header('cookie') || '';
    const hasSessionCookie = cookieHeader
      .split(';')
      .some((part) => part.trim().startsWith(`${SESSION_COOKIE}=`));
    const hasExplicitOriginSignal =
      c.req.header('origin') !== undefined || c.req.header('referer') !== undefined;

    if ((hasSessionCookie || hasExplicitOriginSignal) && !hasTrustedOrigin(c)) {
      return c.json({ error: 'Cross-site request blocked', code: 'CSRF_ORIGIN_DENIED' }, 403);
    }
  }
  await next();
}

const WasteEventCreateSchema = z.object({
  itemName: z.string().trim().min(1, 'Tên nguyên liệu không được để trống').max(120),
  category: z.string().trim().min(1).max(40).default('produce'),
  eventType: z.enum(['rescued', 'expired_discarded', 'composted', 'leftover_saved']),
  quantity: z.coerce.number().positive().max(100_000).default(1),
  unit: z.string().trim().min(1).max(30).default('phần'),
  estimatedValueVnd: z.coerce.number().int().min(0).max(100_000_000).optional(),
  co2Grams: z.coerce.number().int().min(0).max(10_000_000).optional(),
  occurredAt: z.string().trim().min(4).max(64).optional(),
});

const BudgetExpenseCreateSchema = z.object({
  amountVnd: z.coerce.number().int().min(0).max(500_000_000),
  category: z.string().trim().min(1).max(40).default('market'),
  note: z.string().trim().max(240).default(''),
  source: z.enum(['manual', 'receipt_scan', 'shopping_import']).default('manual'),
  spentAt: z.string().trim().min(4).max(64).optional(),
});

const BudgetTargetUpdateSchema = z
  .object({
    amountVnd: z.coerce.number().int().min(0).max(500_000_000).optional(),
    weeklyTargetVnd: z.coerce.number().int().min(0).max(500_000_000).optional(),
    note: z.string().trim().max(240).optional(),
  })
  .refine((data) => data.amountVnd !== undefined || data.weeklyTargetVnd !== undefined, {
    message: 'Vui lòng nhập hạn mức chi tiêu tuần (amountVnd hoặc weeklyTargetVnd)',
  });

const PantryThresholdUpsertSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    nameVi: z.string().trim().min(1).max(100).optional(),
    ingredientId: z.string().trim().max(100).nullable().optional(),
    category: z.string().trim().min(1).max(40).default('seasoning'),
    storage: z.enum(['fridge', 'freezer', 'pantry']).default('pantry'),
    unit: z.string().trim().min(1).max(24).default('ml'),
    minQuantity: z.coerce.number().positive().max(100_000).default(1),
    targetQuantity: z.coerce.number().positive().max(100_000).default(2),
    autoAddShopping: z.boolean().default(true),
  })
  .refine((data) => Boolean(data.name || data.nameVi), {
    message: 'Tên nhu yếu phẩm không được để trống',
  })
  .refine((data) => data.targetQuantity >= data.minQuantity, {
    message: 'Số lượng mục tiêu (targetQuantity) phải lớn hơn hoặc bằng mức cảnh báo (minQuantity)',
  });

const HeirloomIngredientInputSchema = z
  .object({
    ingredientId: z.string().trim().min(1).max(100).optional(),
    name: z.string().trim().min(1).max(120),
    requiredQuantity: z.coerce.number().positive().max(100_000).optional(),
    quantity: z.coerce.number().positive().max(100_000).optional(),
    unit: z.string().trim().min(1).max(30).default('g'),
    isOptional: z.boolean().optional(),
  })
  .refine((val) => val.requiredQuantity !== undefined || val.quantity !== undefined, {
    message: 'Nguyên liệu phải có số lượng định lượng (requiredQuantity hoặc quantity)',
  });

const HeirloomStepInputSchema = z.union([
  z.string().trim().min(1).max(2000),
  z.object({
    stepNumber: z.coerce.number().int().positive().max(100).optional(),
    instruction: z.string().trim().min(1).max(2000),
    tip: z.string().trim().max(600).optional(),
    timerMinutes: z.coerce.number().positive().max(1440).optional(),
  }),
]);

const HeirloomRecipeUpsertSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1, 'Tên món ăn gia truyền không được để trống').max(140),
  description: z.string().trim().max(1200).default(''),
  region: z.enum(['bac', 'trung', 'nam', 'all', 'toan_quoc']).default('all'),
  category: z.string().trim().min(1).max(40).default('braise'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  prepTimeMinutes: z.coerce.number().int().min(1).max(1440).default(15),
  cookTimeMinutes: z.coerce.number().int().min(1).max(1440).default(25),
  servings: z.coerce.number().int().min(1).max(50).default(4),
  ingredients: z.array(HeirloomIngredientInputSchema).min(1, 'Cần ít nhất 1 nguyên liệu').max(60),
  steps: z.array(HeirloomStepInputSchema).min(1, 'Cần ít nhất 1 bước chế biến').max(40),
  chefSecret: z.string().trim().max(800).nullable().optional(),
  familyStory: z.string().trim().max(2000).nullable().optional(),
  isPinned: z.boolean().optional(),
});

function parseJsonBody(rawBodyText: string): { ok: true; value: unknown } | { ok: false } {
  if (!rawBodyText.trim()) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(rawBodyText) };
  } catch {
    return { ok: false };
  }
}

kitchenOsRoutes.use('/kitchen-os/*', enforceTrustedOrigin);
kitchenOsRoutes.use('/kitchen-os/*', tenancyGuard);
kitchenOsRoutes.use('/kitchen-os/*', bodyLimit({ maxSize: 131_072 }));
kitchenOsRoutes.use('/kitchen-os/*', async (c, next) => {
  if (!c.req.path.endsWith('/kitchen-os/pulse')) {
    c.header('Cache-Control', 'no-store');
  }
  const auth = c.get('auth');
  if (!auth?.userId || auth.userId === 'guest_anonymous' || !auth.householdId) {
    return c.json({ error: 'Unauthorized: Authentication required', code: 'UNAUTHORIZED' }, 401);
  }
  return c.req.method === 'GET'
    ? next()
    : rateLimiter({ maxRequests: 60, windowSeconds: 60, prefix: 'rl_kitchen_os' })(c, next);
});

// 1. GET /api/v1/kitchen-os/pulse — Parallelized D1 Batch + Weak ETag + 304 Conditional Revalidation
kitchenOsRoutes.get('/kitchen-os/pulse', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const auth = c.get('auth');
  try {
    const { payload, etag, d1BatchDurationMs } = await computeKitchenOsPulse(db, {
      householdId: auth.householdId,
      userId: auth.userId,
    });
    const serverTiming = `d1_batch;dur=${d1BatchDurationMs.toFixed(2)}`;

    c.header('ETag', etag);
    c.header('Cache-Control', 'private, no-cache');
    c.header('Server-Timing', serverTiming);

    if (matchesIfNoneMatch(c.req.header('If-None-Match'), etag)) {
      return c.body(null, 304);
    }

    return c.json(payload, 200);
  } catch {
    return c.json({ error: 'Không thể tải nhịp đập bếp gia đình', code: 'DATABASE_ERROR' }, 500);
  }
});

// 2. GET /api/v1/kitchen-os/insights — 30-Day Analytics Breakdown
kitchenOsRoutes.get('/kitchen-os/insights', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const auth = c.get('auth');
  try {
    const insights = await computeKitchenOsInsights(db, {
      householdId: auth.householdId,
      userId: auth.userId,
    });
    return c.json(insights, 200);
  } catch {
    return c.json({ error: 'Không thể tải phân tích 30 ngày của bếp', code: 'DATABASE_ERROR' }, 500);
  }
});

// 3. POST /api/v1/kitchen-os/waste-events
kitchenOsRoutes.post('/kitchen-os/waste-events', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const rawBodyText = await c.req.text();
  return withDurableIdempotency(c, 'POST:/kitchen-os/waste-events', rawBodyText, async () => {
    const json = parseJsonBody(rawBodyText);
    if (!json.ok) {
      return c.json({ error: 'Dữ liệu JSON không hợp lệ', code: 'VALIDATION_ERROR' }, 400);
    }
    const parsed = WasteEventCreateSchema.safeParse(json.value);
    if (!parsed.success) {
      return c.json(
        {
          error: parsed.error.issues[0]?.message || 'Thông tin sự kiện chống lãng phí không hợp lệ',
          code: 'VALIDATION_ERROR',
        },
        400,
      );
    }
    const auth = c.get('auth');
    try {
      const wasteEvent = await recordWasteEvent(
        db,
        { householdId: auth.householdId, userId: auth.userId },
        parsed.data,
      );
      return c.json({ success: true, wasteEvent }, 201);
    } catch {
      return c.json({ error: 'Không thể ghi nhận sự kiện chống lãng phí', code: 'DATABASE_ERROR' }, 500);
    }
  });
});

// 4. POST /api/v1/kitchen-os/budget-entries
kitchenOsRoutes.post('/kitchen-os/budget-entries', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const rawBodyText = await c.req.text();
  return withDurableIdempotency(c, 'POST:/kitchen-os/budget-entries', rawBodyText, async () => {
    const json = parseJsonBody(rawBodyText);
    if (!json.ok) {
      return c.json({ error: 'Dữ liệu JSON không hợp lệ', code: 'VALIDATION_ERROR' }, 400);
    }
    const parsed = BudgetExpenseCreateSchema.safeParse(json.value);
    if (!parsed.success) {
      return c.json(
        {
          error: parsed.error.issues[0]?.message || 'Thông tin khoản chi đi chợ không hợp lệ',
          code: 'VALIDATION_ERROR',
        },
        400,
      );
    }
    const auth = c.get('auth');
    try {
      const entry = await recordBudgetExpense(
        db,
        { householdId: auth.householdId, userId: auth.userId },
        parsed.data,
      );
      return c.json({ success: true, entry }, 201);
    } catch {
      return c.json({ error: 'Không thể lưu khoản chi ngân sách', code: 'DATABASE_ERROR' }, 500);
    }
  });
});

// 5. PUT /api/v1/kitchen-os/budget-target
kitchenOsRoutes.put('/kitchen-os/budget-target', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const rawBodyText = await c.req.text();
  return withDurableIdempotency(c, 'PUT:/kitchen-os/budget-target', rawBodyText, async () => {
    const json = parseJsonBody(rawBodyText);
    if (!json.ok) {
      return c.json({ error: 'Dữ liệu JSON không hợp lệ', code: 'VALIDATION_ERROR' }, 400);
    }
    const parsed = BudgetTargetUpdateSchema.safeParse(json.value);
    if (!parsed.success) {
      return c.json(
        {
          error: parsed.error.issues[0]?.message || 'Hạn mức ngân sách tuần không hợp lệ',
          code: 'VALIDATION_ERROR',
        },
        400,
      );
    }
    const amountVnd = (parsed.data.amountVnd ?? parsed.data.weeklyTargetVnd)!;
    const auth = c.get('auth');
    try {
      const entry = await upsertWeeklyBudgetTarget(
        db,
        { householdId: auth.householdId, userId: auth.userId },
        { amountVnd, note: parsed.data.note },
      );
      return c.json({ success: true, weeklyTargetVnd: entry.amountVnd, entry }, 200);
    } catch {
      return c.json({ error: 'Không thể cập nhật ngân sách tuần', code: 'DATABASE_ERROR' }, 500);
    }
  });
});

// 6. GET /api/v1/kitchen-os/pantry-thresholds
kitchenOsRoutes.get('/kitchen-os/pantry-thresholds', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const auth = c.get('auth');
  try {
    const result = await listPantryThresholdsWithStock(db, auth.householdId);
    return c.json(result, 200);
  } catch {
    return c.json({ error: 'Không thể tải định mức tủ gia vị', code: 'DATABASE_ERROR' }, 500);
  }
});

// 7. POST /api/v1/kitchen-os/pantry-thresholds/seed-vietnamese
kitchenOsRoutes.post('/kitchen-os/pantry-thresholds/seed-vietnamese', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const rawBodyText = await c.req.text();
  return withDurableIdempotency(
    c,
    'POST:/kitchen-os/pantry-thresholds/seed-vietnamese',
    rawBodyText,
    async () => {
      const auth = c.get('auth');
      try {
        const result = await seedVietnamesePantryStaples(db, {
          householdId: auth.householdId,
          userId: auth.userId,
        });
        return c.json({ success: true, ...result }, 200);
      } catch {
        return c.json({ error: 'Không thể khởi tạo bộ gia vị thiết yếu', code: 'DATABASE_ERROR' }, 500);
      }
    },
  );
});

// 8. PUT /api/v1/kitchen-os/pantry-thresholds
kitchenOsRoutes.put('/kitchen-os/pantry-thresholds', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const rawBodyText = await c.req.text();
  return withDurableIdempotency(c, 'PUT:/kitchen-os/pantry-thresholds', rawBodyText, async () => {
    const json = parseJsonBody(rawBodyText);
    if (!json.ok) {
      return c.json({ error: 'Dữ liệu JSON không hợp lệ', code: 'VALIDATION_ERROR' }, 400);
    }
    const parsed = PantryThresholdUpsertSchema.safeParse(json.value);
    if (!parsed.success) {
      return c.json(
        {
          error: parsed.error.issues[0]?.message || 'Định mức nhu yếu phẩm không hợp lệ',
          code: 'VALIDATION_ERROR',
        },
        400,
      );
    }
    const auth = c.get('auth');
    try {
      const staple = await upsertPantryThreshold(
        db,
        { householdId: auth.householdId, userId: auth.userId },
        {
          ...parsed.data,
          name: (parsed.data.name ?? parsed.data.nameVi)!,
        },
      );
      return c.json({ success: true, staple }, 200);
    } catch {
      return c.json({ error: 'Không thể lưu định mức nhu yếu phẩm', code: 'DATABASE_ERROR' }, 500);
    }
  });
});

// 9. POST /api/v1/kitchen-os/pantry-thresholds/auto-restock
kitchenOsRoutes.post('/kitchen-os/pantry-thresholds/auto-restock', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const rawBodyText = await c.req.text();
  return withDurableIdempotency(
    c,
    'POST:/kitchen-os/pantry-thresholds/auto-restock',
    rawBodyText,
    async () => {
      const auth = c.get('auth');
      try {
        const result = await autoRestockLowStaples(db, {
          householdId: auth.householdId,
          userId: auth.userId,
        });
        return c.json({ success: true, addedCount: result.addedCount, items: result.items }, 200);
      } catch {
        return c.json({ error: 'Không thể tự động thêm vào danh sách đi chợ', code: 'DATABASE_ERROR' }, 500);
      }
    },
  );
});

// 10. GET /api/v1/kitchen-os/heirloom-recipes
kitchenOsRoutes.get('/kitchen-os/heirloom-recipes', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const auth = c.get('auth');
  try {
    const recipes = await listHeirloomRecipes(db, auth.householdId);
    return c.json({ recipes }, 200);
  } catch {
    return c.json({ error: 'Không thể tải sổ tay công thức gia truyền', code: 'DATABASE_ERROR' }, 500);
  }
});

// 11. GET /api/v1/kitchen-os/heirloom-recipes/:idOrSlug
kitchenOsRoutes.get('/kitchen-os/heirloom-recipes/:idOrSlug', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const idOrSlug = c.req.param('idOrSlug')?.trim();
  if (!idOrSlug) {
    return c.json({ error: 'Không tìm thấy công thức gia truyền', code: 'NOT_FOUND' }, 404);
  }
  const auth = c.get('auth');
  try {
    const recipe = await getHeirloomRecipeByIdOrSlug(db, auth.householdId, idOrSlug);
    if (!recipe) {
      return c.json({ error: 'Không tìm thấy công thức gia truyền', code: 'NOT_FOUND' }, 404);
    }
    return c.json({ recipe }, 200);
  } catch {
    return c.json({ error: 'Không thể tải công thức gia truyền', code: 'DATABASE_ERROR' }, 500);
  }
});

// 12. POST /api/v1/kitchen-os/heirloom-recipes
kitchenOsRoutes.post('/kitchen-os/heirloom-recipes', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const rawBodyText = await c.req.text();
  return withDurableIdempotency(c, 'POST:/kitchen-os/heirloom-recipes', rawBodyText, async () => {
    const json = parseJsonBody(rawBodyText);
    if (!json.ok) {
      return c.json({ error: 'Dữ liệu JSON không hợp lệ', code: 'VALIDATION_ERROR' }, 400);
    }
    const parsed = HeirloomRecipeUpsertSchema.safeParse(json.value);
    if (!parsed.success) {
      return c.json(
        {
          error: parsed.error.issues[0]?.message || 'Công thức gia truyền không hợp lệ',
          code: 'VALIDATION_ERROR',
        },
        400,
      );
    }
    const auth = c.get('auth');
    const body = parsed.data;
    const region = body.region === 'toan_quoc' ? 'all' : body.region;
    const normalizedIngredients = body.ingredients.map((ing) => ({
      ingredientId: ing.ingredientId,
      name: ing.name,
      requiredQuantity: (ing.requiredQuantity ?? ing.quantity)!,
      unit: ing.unit,
      ...(ing.isOptional !== undefined ? { isOptional: ing.isOptional } : {}),
    }));
    const normalizedSteps = body.steps.map((step, index) =>
      typeof step === 'string'
        ? { stepNumber: index + 1, instruction: step }
        : {
            stepNumber: step.stepNumber ?? index + 1,
            instruction: step.instruction,
            ...(step.tip ? { tip: step.tip } : {}),
            ...(step.timerMinutes !== undefined ? { timerMinutes: step.timerMinutes } : {}),
          },
    );

    try {
      const result = await saveHeirloomRecipe(
        db,
        { householdId: auth.householdId, userId: auth.userId },
        {
          id: body.id,
          title: body.title,
          description: body.description,
          region,
          category: body.category,
          difficulty: body.difficulty,
          prepTimeMinutes: body.prepTimeMinutes,
          cookTimeMinutes: body.cookTimeMinutes,
          servings: body.servings,
          ingredients: normalizedIngredients,
          steps: normalizedSteps,
          chefSecret: body.chefSecret,
          familyStory: body.familyStory,
          isPinned: body.isPinned,
        },
      );
      return c.json(
        { success: true, created: result.created, recipe: result.recipe },
        result.created ? 201 : 200,
      );
    } catch {
      return c.json({ error: 'Không thể lưu công thức gia truyền', code: 'DATABASE_ERROR' }, 500);
    }
  });
});

// 13. DELETE /api/v1/kitchen-os/heirloom-recipes/:id
kitchenOsRoutes.delete('/kitchen-os/heirloom-recipes/:id', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  const targetId = c.req.param('id')?.trim();
  if (!targetId) {
    return c.json({ error: 'Không tìm thấy công thức gia truyền', code: 'NOT_FOUND' }, 404);
  }
  const rawBodyText = await c.req.text().catch(() => '');
  return withDurableIdempotency(
    c,
    `DELETE:/kitchen-os/heirloom-recipes/${targetId}`,
    rawBodyText,
    async () => {
      const auth = c.get('auth');
      try {
        const result = await deleteHeirloomRecipe(
          db,
          { householdId: auth.householdId, userId: auth.userId },
          targetId,
        );
        if (!result.deleted) {
          return c.json({ error: 'Không tìm thấy công thức gia truyền', code: 'NOT_FOUND' }, 404);
        }
        return c.json({ success: true, deletedId: result.deletedId }, 200);
      } catch {
        return c.json({ error: 'Không thể xóa công thức gia truyền', code: 'DATABASE_ERROR' }, 500);
      }
    },
  );
});
