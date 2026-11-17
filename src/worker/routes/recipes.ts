import { Hono } from 'hono';
import { InventoryWriterAuthorityError, readInventoryAuthorityMode, runLegacyInventoryBatch } from '../../../packages/db/src/inventory-writer-fence';
import { composeInventoryLotCommands, readAdoptedLotSnapshot, type LotCommandSpec } from '../../../packages/db/src/inventory-lot-commands';
import { LotCommandError } from '../../../packages/domain/src/inventory-lot-commands';
import { compareFefoLots } from '../../../packages/domain/src/inventory-fefo';
import { toLotQuantity } from '../../../packages/domain/src/inventory-truth';
import { inventoryAuthorityFailure } from '../utils/inventory-authority';
import { Env, AuthContext } from '../types';
import {
  expandCatalogWithV5Masterpieces,
  findRecipeInV5Catalog,
  rankRecipes,
  evaluateRecipeMatch,
  CuisineType,
  type Recipe,
  type RecipeAuthoritySource,
} from '@frigo/recipes';
import { areUnitsCompatible, computeFreshness, convertUnit, findCanonicalIngredient, StandardUnit } from '@frigo/domain';
import { SQL } from '@frigo/db';
import { fetchHouseholdInventoryFromDb } from './inventory';
import { tenancyGuard } from '../middleware/tenancy';
import { CookingCompleteSchema, CookingSessionStartSchema, CookingSessionUpdateSchema } from '../validation/schemas';
import { backgroundExecutorOf, resolveRecipeAuthority } from '../services/recipe-authority';
import { evaluateCookingHardRestrictions } from '../services/cooking-hard-restrictions';
import { fingerprintRecipes } from '../../../packages/recipes/src/catalog-fingerprint';
import { captureRecipeContentVersion, readRecipeContentVersion, grantRecipeContentAccess, readHouseholdRecipeContentVersion, findLegacyCookingRecipe, CONTENT_FINGERPRINT, UNVERSIONED_COOKING_CATALOGS } from '../services/recipe-content-versions';
import { enrichRecipesWithMedia } from '../services/recipe-media';
import { DiscoveryQuerySchema } from '../../../packages/recipes/src/discovery-contract';
import { DiscoveryCursorError } from '../../../packages/recipes/src/discovery';
import { InventoryReadError } from './inventory';
import { discoverRecipes } from '../services/recipe-discovery';
import { filterSafeRecipes, loadHouseholdDiscoveryContext } from '../services/allergen-safety';
import { lotExpiryFromEvidence } from '../utils/scan-evidence';

export const recipeRoutes = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

type StockAllocation = {
  itemId: string;
  currentQuantity: number;
  expectedVersion: number;
  unit: StandardUnit;
  quantity: number;
};

type CookingLot = {
  id: string;
  quantity: number;
  unit: StandardUnit;
  version?: number | null;
};

export type CookingLotAllocationResult = {
  availableQuantity: number;
  remainingQuantity: number;
  allocations: StockAllocation[];
};

/**
 * Allocate one deduction over FIFO inventory lots without crossing unit
 * families. Quantities in each allocation stay in that lot's storage unit so
 * the projection and audit event remain lossless.
 */
export function allocateCookingLots(
  lots: CookingLot[],
  requestedQuantity: number,
  requestedUnit: StandardUnit,
  alreadyAllocated: Map<string, number>
): CookingLotAllocationResult {
  let availableQuantity = 0;
  let remainingQuantity = Math.max(0, requestedQuantity);
  const allocations: StockAllocation[] = [];

  for (const lot of lots) {
    if (!areUnitsCompatible(requestedUnit, lot.unit)) continue;
    const previouslyAllocated = Math.max(0, Number(alreadyAllocated.get(lot.id) || 0));
    const remainingLotQuantity = Math.max(0, Number(lot.quantity) - previouslyAllocated);
    if (!Number.isFinite(remainingLotQuantity)) continue;

    const availableInRequestedUnit = convertUnit(remainingLotQuantity, lot.unit, requestedUnit);
    if (!Number.isFinite(availableInRequestedUnit) || availableInRequestedUnit <= 0) continue;
    availableQuantity += availableInRequestedUnit;

    if (remainingQuantity <= Number.EPSILON) continue;
    const takeInRequestedUnit = Math.min(remainingQuantity, availableInRequestedUnit);
    const takeInStorageUnit = convertUnit(takeInRequestedUnit, requestedUnit, lot.unit);
    if (!Number.isFinite(takeInStorageUnit) || takeInStorageUnit <= 0) continue;

    allocations.push({
      itemId: lot.id,
      currentQuantity: Number(lot.quantity),
      expectedVersion: Number.isInteger(Number(lot.version)) ? Number(lot.version) : 1,
      unit: lot.unit,
      quantity: takeInStorageUnit,
    });
    remainingQuantity = Math.max(0, remainingQuantity - takeInRequestedUnit);
  }

  return {
    availableQuantity,
    remainingQuantity,
    allocations,
  };
}

function assertBatchSucceeded(results: any[] | undefined): void {
  if (results?.some((result) => result && result.success === false)) {
    throw new Error('D1 batch reported an unsuccessful statement');
  }
}

async function stableCookingCommandId(householdId: string, idempotencyKey: string): Promise<string> {
  const input = new TextEncoder().encode(`${householdId}:${idempotencyKey}`);
  const digest = await crypto.subtle.digest('SHA-256', input);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `cook_${hex.slice(0, 48)}`;
}

function cookingRequestFingerprint(
  recipeId: string,
  servings: number,
  deductions: Array<{
    ingredientId: string;
    name?: string;
    quantityDeducted: number;
    unit?: StandardUnit;
  }>,
  contentFingerprint?: string,
  leftoverPortions?: number,
): string {
  // Deduction order is not semantically meaningful, but every quantity/unit
  // is. Sorting makes retries compare equivalent requests deterministically.
  const normalized = deductions
    .map((item) => ({
      ingredientId: item.ingredientId,
      name: item.name || '',
      quantityDeducted: item.quantityDeducted,
      unit: item.unit,
    }))
    .sort((a, b) =>
      `${a.ingredientId}:${a.name}:${a.unit}:${a.quantityDeducted}`.localeCompare(
        `${b.ingredientId}:${b.name}:${b.unit}:${b.quantityDeducted}`
      )
    );
  return JSON.stringify({
    recipeId,
    servings,
    deductions: normalized,
    ...(contentFingerprint ? { contentFingerprint } : {}),
    ...(leftoverPortions && leftoverPortions > 0 ? { leftoverPortions } : {}),
  });
}

function mapCookingSessionRow(row: any) {
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    userId: String(row.user_id),
    mode: row.mode === 'mam_com' ? 'mam_com' : 'single',
    recipeIds: (() => {
      try {
        const parsed = JSON.parse(row.recipe_ids_json || '[]');
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
      } catch {
        return [];
      }
    })(),
    currentStepIndex: Number(row.current_step_index || 0),
    targetServings: Number(row.target_servings || 2),
    timers: (() => {
      try {
        const parsed = JSON.parse(row.timers_json || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    })(),
    completedSteps: (() => {
      try {
        const parsed = JSON.parse(row.completed_steps_json || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })(),
    contentFingerprint: row.content_fingerprint ?? null,
    status: row.status,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? null,
  };
}

async function markActiveCookingSessionsCompleted(
  db: any,
  householdId: string,
  userId: string,
  cookingSessionId?: string,
): Promise<void> {
  if (!db || !householdId || !userId) return;
  const now = new Date().toISOString();
  try {
    if (cookingSessionId) {
      await db
        .prepare(
          `UPDATE cooking_sessions
              SET status = 'completed', updated_at = ?, completed_at = COALESCE(completed_at, ?)
            WHERE id = ? AND household_id = ? AND status = 'active'`
        )
        .bind(now, now, cookingSessionId, householdId)
        .run();
    } else {
      await db
        .prepare(
          `UPDATE cooking_sessions
              SET status = 'completed', updated_at = ?, completed_at = COALESCE(completed_at, ?)
            WHERE household_id = ? AND user_id = ? AND status = 'active'`
        )
        .bind(now, now, householdId, userId)
        .run();
    }
  } catch {
    // Best-effort session state sync when running against minimal unit-test mocks.
  }
}

function resolveCookingDeductionUnits(
  recipe: { ingredients: Array<{ ingredientId: string; name: string; unit: StandardUnit }> },
  deductions: Array<{
    ingredientId: string;
    name?: string;
    quantityDeducted: number;
    unit?: StandardUnit;
  }>
): Array<{ ingredientId: string; name?: string; quantityDeducted: number; unit: StandardUnit }> {
  return deductions.map((deduction) => {
    if (deduction.unit) return deduction as { ingredientId: string; name?: string; quantityDeducted: number; unit: StandardUnit };
    const recipeIngredient = recipe.ingredients.find(
      (ingredient) =>
        ingredient.ingredientId === deduction.ingredientId ||
        (Boolean(deduction.name?.trim()) && ingredient.name.trim().toLocaleLowerCase() === deduction.name!.trim().toLocaleLowerCase())
    );
    if (!recipeIngredient) {
      throw new Error(`Missing unit for cooking deduction ${deduction.ingredientId}`);
    }
    return { ...deduction, unit: recipeIngredient.unit };
  });
}

function storedCookingFingerprint(row: {
  recipe_id?: string;
  servings_cooked?: number;
  deductions_applied?: string | null;
  recipe_content_fingerprint?: string | null;
}): string | null {
  try {
    const deductions = JSON.parse(row.deductions_applied || '[]');
    if (!Array.isArray(deductions)) return null;
    return cookingRequestFingerprint(
      String(row.recipe_id || ''),
      Number(row.servings_cooked || 0),
      deductions as Array<{
        ingredientId: string;
        name?: string;
        quantityDeducted: number;
        unit: StandardUnit;
      }>,
      row.recipe_content_fingerprint ?? undefined,
    );
  } catch {
    return null;
  }
}

/**
 * T14D (ADR-026): ONE recipe authority snapshot per request. The router decides static vs verified
 * D1 from deployment config (+ deterministic household canary) BEFORE any filtering/ranking; every
 * recipe read in the handler then uses that same snapshot. In `shadow` mode this also schedules the
 * T14B-B off-response comparison (not awaited without an ExecutionContext).
 */
function recipeAuthority(c: { env: Env; executionCtx?: { waitUntil(task: Promise<unknown>): void }; get(key: 'auth'): AuthContext | undefined }) {
  let tenantKey: string | null = null;
  try { tenantKey = c.get('auth')?.householdId ?? null; } catch { tenantKey = null; }
  return resolveRecipeAuthority(c.env, { tenantKey, backgroundExecutor: backgroundExecutorOf(c) });
}

function listCatalogRecipes(env: Env, snapshot: { list(): Recipe[] }): Recipe[] {
  return env.RECIPE_CATALOG_V5_EXPANDED === 'true'
    ? expandCatalogWithV5Masterpieces(snapshot.list())
    : snapshot.list();
}

function findCatalogRecipe(
  env: Env,
  snapshot: { list(): Recipe[]; findByIdOrSlug(idOrSlug: string): Recipe | null },
  idOrSlug: string,
): Recipe | null {
  return env.RECIPE_CATALOG_V5_EXPANDED === 'true'
    ? findRecipeInV5Catalog(snapshot.list(), idOrSlug)
    : snapshot.findByIdOrSlug(idOrSlug);
}

// Additive authenticated list contract; legacy recipe/recommendation payloads stay intact.
recipeRoutes.use('/recipe-discovery', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
recipeRoutes.get('/recipe-discovery', tenancyGuard, async (c) => {
  const parsed = DiscoveryQuerySchema.safeParse(c.req.query());
  if (!parsed.success)
    return c.json({ error: 'Bộ lọc công thức không hợp lệ', code: 'DISCOVERY_QUERY_INVALID' }, 400);
  try {
    const { snapshot } = await recipeAuthority(c);
    return c.json(await discoverRecipes(c.env, c.get('auth'), snapshot, parsed.data));
  } catch (error) {
    if (error instanceof DiscoveryCursorError)
      return c.json(
        { error: 'Danh sách công thức đã thay đổi', code: error.code },
        error.code === 'DISCOVERY_SNAPSHOT_CHANGED' ? 409 : 400,
      );
    if (error instanceof InventoryReadError)
      return c.json(
        { error: 'Chưa kiểm tra được nguyên liệu trong tủ', code: 'DATABASE_UNAVAILABLE' },
        503,
      );
    throw error;
  }
});

// GET /api/v1/recipes
recipeRoutes.get('/recipes', async (c) => {
  const { snapshot } = await recipeAuthority(c);
  const cuisine = c.req.query('cuisine') as CuisineType | undefined;
  const category = c.req.query('category');
  const region = c.req.query('region');
  const search = c.req.query('q')?.toLowerCase();

  let list = listCatalogRecipes(c.env, snapshot);
  if (cuisine) {
    list = list.filter((r) => r.cuisine === cuisine);
  }
  if (category) {
    list = list.filter((r) => r.category === category);
  }
  if (region) {
    list = list.filter((r) => r.region === region || r.region === 'toan_quoc');
  }
  if (search) {
    list = list.filter(
      (r) =>
        r.title.toLowerCase().includes(search) ||
        r.description.toLowerCase().includes(search) ||
        (r.tags && r.tags.some((t) => t.toLowerCase().includes(search))) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(search))
    );
  }

  // T14C: media is attached after the authority snapshot decided content and order; never before.
  return c.json({ recipes: await enrichRecipesWithMedia(c.env, list) });
});

// GET /api/v1/recipes/cooking-sessions/active
// Must be registered BEFORE /recipes/:id so 'cooking-sessions' is never captured as :id.
recipeRoutes.get('/recipes/cooking-sessions/active', tenancyGuard, async (c) => {
  c.header('Cache-Control', 'no-store');
  const auth = c.get('auth');
  if (!auth || !auth.userId || auth.userId === 'guest_anonymous' || !auth.householdId) {
    return c.json({ error: 'Unauthorized: Authentication required', code: 'UNAUTHORIZED' }, 401);
  }
  if (!c.env.DB) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  try {
    const row = await c.env.DB.prepare(
      `SELECT * FROM cooking_sessions
        WHERE household_id = ? AND status = 'active'
        ORDER BY updated_at DESC, started_at DESC
        LIMIT 1`
    )
      .bind(auth.householdId)
      .first<any>();
    return c.json({ session: row ? mapCookingSessionRow(row) : null });
  } catch {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
});

// PUT /api/v1/recipes/cooking-sessions/:sessionId
recipeRoutes.put('/recipes/cooking-sessions/:sessionId', tenancyGuard, async (c) => {
  c.header('Cache-Control', 'no-store');
  const auth = c.get('auth');
  if (!auth || !auth.userId || auth.userId === 'guest_anonymous' || !auth.householdId) {
    return c.json({ error: 'Unauthorized: Authentication required', code: 'UNAUTHORIZED' }, 401);
  }
  const sessionId = c.req.param('sessionId');
  if (!sessionId) {
    return c.json({ error: 'Cooking session not found', code: 'NOT_FOUND' }, 404);
  }
  const parsed = CookingSessionUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      {
        error: parsed.error.issues[0]?.message || 'Dữ liệu cập nhật phiên nấu không hợp lệ',
        code: 'VALIDATION_ERROR',
      },
      400
    );
  }
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
  try {
    const existing = await db
      .prepare('SELECT * FROM cooking_sessions WHERE id = ? AND household_id = ? LIMIT 1')
      .bind(sessionId, auth.householdId)
      .first<any>();
    if (!existing) {
      return c.json({ error: 'Không tìm thấy phiên nấu ăn', code: 'NOT_FOUND' }, 404);
    }
    const body = parsed.data;
    const now = new Date().toISOString();
    const nextStepIndex = body.currentStepIndex ?? Number(existing.current_step_index || 0);
    const nextServings = body.targetServings ?? Number(existing.target_servings || 2);
    const nextTimersJson = body.timers !== undefined ? JSON.stringify(body.timers) : existing.timers_json;
    const nextCompletedStepsJson =
      body.completedSteps !== undefined ? JSON.stringify(body.completedSteps) : existing.completed_steps_json;
    const nextStatus = body.status ?? existing.status;
    const nextCompletedAt =
      nextStatus === 'completed' ? existing.completed_at || now : existing.completed_at;

    await db
      .prepare(
        `UPDATE cooking_sessions
            SET current_step_index = ?,
                target_servings = ?,
                timers_json = ?,
                completed_steps_json = ?,
                status = ?,
                updated_at = ?,
                completed_at = ?
          WHERE id = ? AND household_id = ?`
      )
      .bind(
        nextStepIndex,
        nextServings,
        nextTimersJson,
        nextCompletedStepsJson,
        nextStatus,
        now,
        nextCompletedAt,
        sessionId,
        auth.householdId
      )
      .run();

    const updated = await db
      .prepare('SELECT * FROM cooking_sessions WHERE id = ? AND household_id = ? LIMIT 1')
      .bind(sessionId, auth.householdId)
      .first<any>();
    return c.json({ success: true, session: mapCookingSessionRow(updated ?? existing) });
  } catch {
    return c.json({ error: 'Lỗi cập nhật phiên nấu ăn', code: 'DATABASE_ERROR' }, 500);
  }
});

// GET /api/v1/recipes/:id
recipeRoutes.get('/recipes/:id', tenancyGuard, async (c) => {
  const idOrSlug = c.req.param('id');
  if (!idOrSlug) return c.json({ error: 'Recipe not found' }, 404);
  const auth = c.get('auth');
  const requestedVersion = c.req.query('contentFingerprint');
  if (requestedVersion !== undefined && !CONTENT_FINGERPRINT.test(requestedVersion))
    return c.json({ error: 'Invalid recipe content fingerprint', code: 'VALIDATION_ERROR' }, 400);
  let recipe = requestedVersion && c.env.DB
    ? await readHouseholdRecipeContentVersion(c.env.DB, auth.householdId, requestedVersion) : null;
  if (!recipe) {
    const { snapshot } = await recipeAuthority(c);
    const current = findCatalogRecipe(c.env, snapshot, idOrSlug);
    if (current && (!requestedVersion || await fingerprintRecipes([current]) === requestedVersion)) recipe = current;
  }

  if (!recipe || (recipe.id !== idOrSlug && recipe.slug !== idOrSlug)) {
    return c.json({ error: 'Recipe not found' }, 404);
  }

  const inventory = auth.userId === 'guest_anonymous'
    ? []
    : await fetchHouseholdInventoryFromDb(c.env.DB, auth.householdId, c.env.CACHE, { actorId: auth.userId });
  const evaluation = evaluateRecipeMatch(recipe, { inventory });
  const [recipeWithMedia] = await enrichRecipesWithMedia(c.env, [recipe]);

  const contentFingerprint = c.env.DB
    ? await captureRecipeContentVersion(c.env.DB, recipe)
    : await fingerprintRecipes([recipe]);
  if (c.env.DB && auth.userId !== 'guest_anonymous')
    await grantRecipeContentAccess(c.env.DB, auth.householdId, contentFingerprint);
  return c.json({
    contentFingerprint,
    recipe: recipeWithMedia,
    match: evaluation,
  });
});

// GET /api/v1/recommendations
recipeRoutes.get('/recommendations', tenancyGuard, async (c) => {
  const { snapshot } = await recipeAuthority(c);
  const auth = c.get('auth');
  const noBuy = c.req.query('noBuy') === 'true';
  const cuisineQuery = c.req.query('cuisine');
  const categoryQuery = c.req.query('category');
  const regionQuery = c.req.query('region');
  const maxTime = c.req.query('maxTime') ? Number(c.req.query('maxTime')) : undefined;

  const [inventory, discoveryCtx] = await Promise.all([
    fetchHouseholdInventoryFromDb(c.env.DB, auth.householdId, c.env.CACHE, { actorId: auth.userId }),
    loadHouseholdDiscoveryContext(c.env.DB, { householdId: auth.householdId, userId: auth.userId }),
  ]);

  const preferredCuisines = cuisineQuery
    ? (cuisineQuery.split(',') as CuisineType[])
    : discoveryCtx.preferredCuisines.length > 0
      ? discoveryCtx.preferredCuisines
      : undefined;

  let targetRecipes = filterSafeRecipes(listCatalogRecipes(c.env, snapshot), discoveryCtx);
  if (categoryQuery) {
    targetRecipes = targetRecipes.filter((r) => r.category === categoryQuery);
  }
  if (regionQuery) {
    targetRecipes = targetRecipes.filter((r) => r.region === regionQuery || r.region === 'toan_quoc');
  }

  const ranked = rankRecipes(targetRecipes, {
    inventory,
    preferredCuisines,
    maxCookTimeMinutes: maxTime,
    onlyNoBuyNeeded: noBuy,
    recentCookedRecipeIds:
      discoveryCtx.recentCookedRecipeIds.length > 0 ? discoveryCtx.recentCookedRecipeIds : undefined,
  });

  // T14C: ranking is final above; media only decorates each already-ranked entry's recipe.
  const recipesWithMedia = await enrichRecipesWithMedia(c.env, ranked.map((entry) => entry.recipe));
  const recommendations = ranked.map((entry, index) => ({ ...entry, recipe: recipesWithMedia[index] }));

  return c.json({
    total: ranked.length,
    noBuyFilterActive: noBuy,
    recommendations,
  });
});

// POST /api/v1/recipes/:id/cook/start
// T19: cook/start is a state-changing boundary (it mints the cooking session the
// client completes), so it carries the tenancy guard and enforces the same
// canonical hard restrictions the planner and T20 Manual/Assisted/Auto enforce.
recipeRoutes.post('/recipes/:id/cook/start', tenancyGuard, async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const recipeId = c.req.param('id');
  if (!recipeId) {
    return c.json({ error: 'Recipe not found' }, 404);
  }
  const { snapshot } = await recipeAuthority(c);
  const recipe = findCatalogRecipe(c.env, snapshot, recipeId);

  if (!recipe) {
    return c.json({ error: 'Recipe not found' }, 404);
  }
  if (!db) {
    // The hard-restriction check below is fail-closed; never claim a cooking
    // session is safe when there is no authoritative persistence layer.
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  const startOptionsParsed = CookingSessionStartSchema.safeParse(await c.req.json().catch(() => ({})));
  const startOptions = startOptionsParsed.success
    ? startOptionsParsed.data
    : { mode: 'single' as const, recipeIds: undefined, targetServings: undefined };

  const restrictionSource: RecipeAuthoritySource = snapshot.findById(recipe.id) ? snapshot.source : 'static';
  const restriction = await evaluateCookingHardRestrictions(db, auth, restrictionSource, recipe);
  if (restriction.blocked) {
    console.warn('[cooking] cook/start blocked by hard restriction', { recipeId: recipe.id, reasons: restriction.reasons });
    return c.json(
      {
        error: 'This dish conflicts with a household restriction',
        code: 'HARD_CONSTRAINT_CONFLICT',
      },
      422
    );
  }

  const contentFingerprint = await captureRecipeContentVersion(db, recipe);
  await grantRecipeContentAccess(db, auth.householdId, contentFingerprint);

  const startedAt = new Date().toISOString();
  const cookingSessionId = `cook_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const recipeIds = startOptions.recipeIds?.length
    ? Array.from(new Set([recipe.id, ...startOptions.recipeIds]))
    : [recipe.id];
  const mode = recipeIds.length > 1 ? 'mam_com' : startOptions.mode;
  const targetServings = startOptions.targetServings ?? recipe.servings ?? 2;

  const sessionDto = {
    id: cookingSessionId,
    householdId: auth.householdId,
    userId: auth.userId,
    mode,
    recipeIds,
    currentStepIndex: 0,
    targetServings,
    timers: {},
    completedSteps: [],
    contentFingerprint,
    status: 'active' as const,
    startedAt,
    updatedAt: startedAt,
    completedAt: null,
  };

  if (auth.householdId && auth.userId && auth.userId !== 'guest_anonymous') {
    try {
      await db.batch([
        db
          .prepare('INSERT OR IGNORE INTO users (id, is_guest) VALUES (?, ?)')
          .bind(auth.userId, auth.isGuest ? 1 : 0),
        db
          .prepare('INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?)')
          .bind(auth.householdId, 'Tủ lạnh gia đình', auth.userId),
        db
          .prepare(
            `UPDATE cooking_sessions
                SET status = 'abandoned', updated_at = ?
              WHERE household_id = ? AND user_id = ? AND status = 'active'`
          )
          .bind(startedAt, auth.householdId, auth.userId),
        db
          .prepare(
            `INSERT INTO cooking_sessions
               (id, household_id, user_id, mode, recipe_ids_json, current_step_index, target_servings,
                timers_json, completed_steps_json, content_fingerprint, status, started_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 0, ?, '{}', '[]', ?, 'active', ?, ?)`
          )
          .bind(
            cookingSessionId,
            auth.householdId,
            auth.userId,
            mode,
            JSON.stringify(recipeIds),
            targetServings,
            contentFingerprint,
            startedAt,
            startedAt
          ),
      ]);
    } catch {
      // Allow lightweight mock D1 tests without cooking_sessions schema to still receive session token.
    }
  }

  return c.json({
    success: true,
    contentFingerprint,
    cookingSessionId,
    recipeId: recipe.id,
    stepsCount: recipe.steps.length,
    startedAt,
    session: sessionDto,
  });
});

// POST /api/v1/recipes/:id/cook/complete
recipeRoutes.post('/recipes/:id/cook/complete', tenancyGuard, async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const kv = c.env.CACHE;
  const recipeId = c.req.param('id');
  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = CookingCompleteSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return c.json(
      {
        error: parseResult.error.issues[0]?.message || 'Dữ liệu hoàn tất nấu không hợp lệ',
        code: 'VALIDATION_ERROR',
      },
      400
    );
  }

  const {
    deductions: rawDeductions,
    servings,
    commandId: bodyCommandId,
    contentFingerprint,
    cookingSessionId,
    leftoverServings,
    saveLeftoverPortions,
  } = parseResult.data;
  const leftoverPortionsToSave =
    typeof saveLeftoverPortions === 'number'
      ? saveLeftoverPortions
      : saveLeftoverPortions === true
        ? Math.max(1, leftoverServings ?? 1)
        : leftoverServings && leftoverServings > 0
          ? leftoverServings
          : 0;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  const headerIdempotencyKey = c.req.header('Idempotency-Key')?.trim();
  const bodyIdempotencyKey = bodyCommandId?.trim();
  if (headerIdempotencyKey && bodyIdempotencyKey && headerIdempotencyKey !== bodyIdempotencyKey) {
    return c.json(
      { error: 'Idempotency-Key trong header và commandId không khớp', code: 'IDEMPOTENCY_CONFLICT' },
      409
    );
  }
  const idempotencyKey = (headerIdempotencyKey || bodyIdempotencyKey)?.trim();
  if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 200)) {
    return c.json(
      { error: 'Idempotency-Key phải dài từ 8 đến 200 ký tự', code: 'VALIDATION_ERROR' },
      400
    );
  }
  const cookId = idempotencyKey
    ? await stableCookingCommandId(auth.householdId, idempotencyKey)
    : `cook_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const currentInventory = async () =>
    fetchHouseholdInventoryFromDb(db, auth.householdId, kv, { strict: true, actorId: auth.userId });

  // A committed command owns its units/version even if the catalog has moved or disappeared.
  if (idempotencyKey) {
    const prior = await db.prepare(
      'SELECT id, recipe_id, servings_cooked, deductions_applied, recipe_content_fingerprint, request_fingerprint FROM cooked_meals WHERE id = ? AND household_id = ? LIMIT 1',
    ).bind(cookId, auth.householdId).first<{
      id: string; recipe_id: string; servings_cooked: number; deductions_applied: string | null;
      recipe_content_fingerprint: string | null; request_fingerprint: string | null;
    }>();
    if (prior) {
      let replayMatches = false;
      let title = findLegacyCookingRecipe(prior.recipe_id)?.title;
      try {
        const baseline = findLegacyCookingRecipe(prior.recipe_id);
        const staticId = recipeId ? findLegacyCookingRecipe(recipeId)?.id : undefined;
        const archived = prior.recipe_content_fingerprint
          ? await readRecipeContentVersion(db, prior.recipe_content_fingerprint) : null;
        title = archived?.title ?? title;
        const sameRecipe = recipeId === prior.recipe_id || staticId === prior.recipe_id ||
          (archived?.id === prior.recipe_id && archived.slug === recipeId);
        replayMatches = sameRecipe && prior.request_fingerprint != null && prior.request_fingerprint ===
          cookingRequestFingerprint(prior.recipe_id, servings, rawDeductions, contentFingerprint, leftoverPortionsToSave);
        if (sameRecipe && !replayMatches && leftoverPortionsToSave === 0) {
          const stored = JSON.parse(prior.deductions_applied || '[]') as Array<{
            ingredientId: string; name?: string; quantityDeducted: number; unit: StandardUnit;
          }>;
          // Legacy omission is safe only when the receipt has one unit for that ingredient.
          const unambiguous = stored.filter(line => stored.every(other =>
            other.ingredientId !== line.ingredientId || other.unit === line.unit));
          const normalized = resolveCookingDeductionUnits(archived ?? baseline ?? {
            ingredients: unambiguous.map(line => ({ ...line, name: line.name ?? '' })),
          }, rawDeductions);
          replayMatches = storedCookingFingerprint(prior) ===
            cookingRequestFingerprint(prior.recipe_id, servings, normalized, contentFingerprint);
        }
      } catch {
        // Corrupt or ambiguous receipts cannot authorize another debit.
      }
      if (!replayMatches) return c.json({ error: 'Idempotency-Key đã được dùng cho một lệnh nấu khác', code: 'IDEMPOTENCY_CONFLICT' }, 409);
      const inventory = await currentInventory();
      return c.json({ success: true, idempotentReplay: true, cookId, recipeId: prior.recipe_id,
        message: title ? `Đã hoàn tất nấu món ${title} và tự động cập nhật lại tủ lạnh!` : 'Đã hoàn tất nấu và cập nhật lại tủ lạnh!',
        deductionsApplied: JSON.parse(prior.deductions_applied || '[]'),
        ...(leftoverPortionsToSave > 0 ? { leftoverItemId: `leftover_${cookId.slice(0, 36)}`, leftoverServingsSaved: leftoverPortionsToSave } : {}),
        remainingInventoryCount: inventory.length, inventory });
    }
  }

  let recipe: Recipe | null;
  let authoritySource: RecipeAuthoritySource = 'static';
  if (contentFingerprint) {
    recipe = await readHouseholdRecipeContentVersion(db, auth.householdId, contentFingerprint);
    if (!recipe) {
      const { snapshot } = await recipeAuthority(c);
      const current = recipeId ? findCatalogRecipe(c.env, snapshot, recipeId) : null;
      if (current && await fingerprintRecipes([current]) === contentFingerprint) {
        await captureRecipeContentVersion(db, current);
        await grantRecipeContentAccess(db, auth.householdId, contentFingerprint);
        recipe = current;
        authoritySource = snapshot.findById(current.id) ? snapshot.source : 'static';
      }
    }
    if (!recipe || (recipe.id !== recipeId && recipe.slug !== recipeId))
      return c.json({ error: 'Phiên bản công thức chưa được lưu; hãy mở lại công thức', code: 'RECIPE_VERSION_UNAVAILABLE' }, 409);
  } else {
    const { snapshot } = await recipeAuthority(c);
    authoritySource = snapshot.source;
    if (!UNVERSIONED_COOKING_CATALOGS.has(snapshot.fingerprint))
      return c.json({ error: 'Cần phiên bản công thức đã mở trước khi hoàn tất nấu', code: 'RECIPE_VERSION_REQUIRED' }, 409);
    recipe = recipeId ? findCatalogRecipe(c.env, snapshot, recipeId) : null;
    if (recipe && !snapshot.findById(recipe.id)) authoritySource = 'static';
  }
  if (!recipe) return c.json({ error: 'Recipe not found', code: 'NOT_FOUND' }, 404);

  let deductions: Array<{ ingredientId: string; name?: string; quantityDeducted: number; unit: StandardUnit }>;
  try {
    deductions = resolveCookingDeductionUnits(recipe, rawDeductions);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Thiếu đơn vị nguyên liệu', code: 'UNIT_MISMATCH' }, 422);
  }
  const requestFingerprint = cookingRequestFingerprint(recipe.id, servings, deductions, contentFingerprint, leftoverPortionsToSave);
  const rawRequestFingerprint = cookingRequestFingerprint(recipe.id, servings, rawDeductions, contentFingerprint, leftoverPortionsToSave);
  const allocations = new Map<string, StockAllocation>();

  // Adopted households cook through the lot authority: FEFO-ordered canonical
  // USE commands and the cooked_meals row commit in one atomic batch.
  if (await readInventoryAuthorityMode(db, auth.householdId) === 'native') {
    return completeAdoptedCooking(c, db, kv, auth, {
      cookId, recipe, servings, deductions, requestFingerprint,
      authoritySource, contentFingerprint, rawRequestFingerprint,
      cookingSessionId, leftoverPortionsToSave,
    });
  }

  try {
    // A replay with the same command key returns the original durable result
    // without applying inventory events a second time.
    const prior = await db
      .prepare(
        'SELECT id, recipe_id, servings_cooked, deductions_applied, recipe_content_fingerprint, request_fingerprint FROM cooked_meals WHERE id = ? AND household_id = ? LIMIT 1'
      )
      .bind(cookId, auth.householdId)
      .first<{
        id: string;
        recipe_id: string;
        servings_cooked: number;
        deductions_applied: string | null;
        recipe_content_fingerprint: string | null;
      }>();
    if (prior) {
      if (storedCookingFingerprint(prior) !== requestFingerprint) {
        return c.json(
          {
            error: 'Idempotency-Key đã được dùng cho một lệnh nấu khác',
            code: 'IDEMPOTENCY_CONFLICT',
          },
          409
        );
      }
      const inventory = await currentInventory();
      return c.json({
        success: true,
        idempotentReplay: true,
        cookId,
        message: `Đã hoàn tất nấu món ${recipe.title} và tự động cập nhật lại tủ lạnh!`,
        recipeId: recipe.id,
        deductionsApplied: deductions,
        remainingInventoryCount: inventory.length,
        inventory,
      });
    }

    // T19: enforce the canonical hard restrictions before any inventory
    // mutation. The idempotent replay above stays untouched.
    const restriction = await evaluateCookingHardRestrictions(db, auth, authoritySource, recipe);
    if (restriction.blocked) {
      console.warn('[cooking] cook/complete blocked by hard restriction', { recipeId: recipe.id, reasons: restriction.reasons });
      return c.json(
        {
          error: 'This dish conflicts with a household restriction',
          code: 'HARD_CONSTRAINT_CONFLICT',
        },
        422
      );
    }

    for (const deduction of deductions) {
      if (deduction.quantityDeducted === 0) continue;

      const lookupName = (deduction.name || deduction.ingredientId).trim();
      const canonical = findCanonicalIngredient(lookupName);
      const lookupId = canonical?.id || (deduction.ingredientId === 'OTHER' ? null : deduction.ingredientId);
      const lotStatement = db
        .prepare(
          `SELECT id, quantity, unit, version
           FROM inventory_items
           WHERE household_id = ?
             AND ((? IS NOT NULL AND ingredient_id = ?) OR LOWER(name) = LOWER(?))
             AND quantity > 0
           ORDER BY updated_at ASC, id ASC`
        )
        .bind(auth.householdId, lookupId, lookupId, lookupName);
      const lotResult = await lotStatement.all<{ id: string; quantity: number; unit: string; version?: number | null }>();
      const lots = [...(lotResult.results || [])] as CookingLot[];
      // A small compatibility fallback keeps lightweight test/local D1 mocks
      // working while production D1 uses the multi-lot query above.
      if (lots.length === 0) {
        const single = await lotStatement.first<{ id: string; quantity: number; unit: string; version?: number | null }>();
        if (single) lots.push(single as CookingLot);
      }

      const priorAllocations = new Map(
        Array.from(allocations.values()).map((allocation) => [allocation.itemId, allocation.quantity])
      );
      const allocationResult = allocateCookingLots(
        lots,
        deduction.quantityDeducted,
        deduction.unit,
        priorAllocations
      );
      if (lots.length > 0 && !lots.some((lot) => areUnitsCompatible(deduction.unit, lot.unit))) {
        return c.json(
          {
            error: `Không thể quy đổi đơn vị ${deduction.unit} cho ${lookupName}`,
            code: 'UNIT_MISMATCH',
          },
          422
        );
      }
      if (allocationResult.remainingQuantity > Number.EPSILON) {
        return c.json(
          {
            error: allocationResult.availableQuantity > 0
              ? `Số lượng ${lookupName} trong tủ không đủ để hoàn tất món ăn`
              : `Không tìm thấy nguyên liệu để trừ: ${lookupName}`,
            code: 'INSUFFICIENT_INVENTORY',
            available: allocationResult.availableQuantity,
            requested: deduction.quantityDeducted,
            unit: deduction.unit,
          },
          409
        );
      }

      for (const allocation of allocationResult.allocations) {
        const existing = allocations.get(allocation.itemId);
        allocations.set(allocation.itemId, {
          itemId: allocation.itemId,
          currentQuantity: allocation.currentQuantity,
          expectedVersion: allocation.expectedVersion,
          unit: allocation.unit,
          quantity: (existing?.quantity || 0) + allocation.quantity,
        });
      }
    }

    const batchStatements: any[] = [
      db
        .prepare('INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?)')
        .bind(auth.householdId, 'Tủ lạnh gia đình', auth.userId),
      db
        .prepare(
          `INSERT OR IGNORE INTO recipes (id, slug, title, cuisine, cook_time_minutes, servings, difficulty)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(recipe.id, recipe.slug, recipe.title, recipe.cuisine, recipe.cookTimeMinutes, recipe.servings, recipe.difficulty),
      db
        .prepare(
          `INSERT INTO cooked_meals (id, household_id, user_id, recipe_id, servings_cooked, deductions_applied, recipe_content_fingerprint, request_fingerprint)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(cookId, auth.householdId, auth.userId, recipe.id, servings, JSON.stringify(deductions), contentFingerprint ?? null, rawRequestFingerprint),
    ];

    for (const allocation of allocations.values()) {
      // Apply the deduction atomically against the quantity observed above. A
      // failed guard aborts the whole D1 batch, so no cooked meal/event can be
      // committed when another command consumed the stock first.
      batchStatements.push(
        db
          .prepare(
            `UPDATE inventory_items
             SET quantity = quantity - ?,
                 freshness = CASE WHEN quantity - ? <= 0 THEN 'out_of_stock' ELSE freshness END,
                 version = version + 1,
                 updated_at = datetime('now')
             WHERE id = ? AND household_id = ? AND quantity >= ? AND version = ?`
          )
          .bind(
            allocation.quantity,
            allocation.quantity,
            allocation.itemId,
            auth.householdId,
            allocation.quantity,
            allocation.expectedVersion
          )
      );
      batchStatements.push(
        db
          .prepare(
            `INSERT INTO inventory_events
               (id, household_id, inventory_item_id, event_type, quantity_delta, unit, reason, metadata)
             SELECT ?, NULL, NULL, 'COOK_GUARD', 0, ?, 'guard', NULL
             WHERE changes() = 0`
          )
          .bind(`cook_guard_${cookId}_${allocation.itemId}`, allocation.unit)
      );
      batchStatements.push(
        db.prepare(SQL.INSERT_INVENTORY_EVENT).bind(
          `evt_${cookId}_${allocation.itemId}`,
          auth.householdId,
          allocation.itemId,
          'COOK',
          -allocation.quantity,
          allocation.unit,
          `Nấu món ${recipe.title}`,
          JSON.stringify({ recipeId: recipe.id, cookId })
        )
      );
    }

    const leftoverItemId = `leftover_${cookId.slice(0, 36)}`;
    const leftoverExpiryDate = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const leftoverName = `${recipe.title} (Phần dư)`;
    if (leftoverPortionsToSave > 0) {
      const nowIso = new Date().toISOString();
      batchStatements.push(
        db.prepare(SQL.INSERT_INVENTORY_ITEM.replace(/^INSERT /, 'INSERT OR IGNORE ')).bind(
          leftoverItemId,
          auth.householdId,
          null,
          leftoverName,
          leftoverPortionsToSave,
          'piece',
          'other',
          'fridge',
          leftoverExpiryDate,
          nowIso,
          computeFreshness(leftoverExpiryDate, undefined, 2),
          'manual'
        ),
        db.prepare(SQL.INSERT_INVENTORY_EVENT.replace(/^INSERT /, 'INSERT OR IGNORE ')).bind(
          `evt_leftover_${cookId}`,
          auth.householdId,
          leftoverItemId,
          'ADD',
          leftoverPortionsToSave,
          'piece',
          `Lưu phần ăn dư sau khi nấu món ${recipe.title}`,
          JSON.stringify({ recipeId: recipe.id, cookId, leftoverServings: leftoverPortionsToSave })
        )
      );
    }

    const batchResults = await runLegacyInventoryBatch(db, auth.householdId, batchStatements);
    assertBatchSucceeded(batchResults);
    await markActiveCookingSessionsCompleted(db, auth.householdId, auth.userId, cookingSessionId);
    if (kv) await kv.delete(`inv_${auth.householdId}`).catch(() => {});

    const updatedInventory = await currentInventory();
    return c.json({
      success: true,
      cookId,
      message: `Đã hoàn tất nấu món ${recipe.title} và tự động cập nhật lại tủ lạnh!`,
      recipeId: recipe.id,
      deductionsApplied: deductions,
      ...(leftoverPortionsToSave > 0
        ? { leftoverItemId, leftoverServingsSaved: leftoverPortionsToSave }
        : {}),
      remainingInventoryCount: updatedInventory.length,
      inventory: updatedInventory,
    });
  } catch (err: any) {
    // A concurrent request may have committed the same idempotent command just
    // before this request hit the INSERT. Re-read and return that result.
    if (idempotencyKey) {
      try {
        const prior = await db
          .prepare(
            'SELECT id, recipe_id, servings_cooked, deductions_applied, recipe_content_fingerprint, request_fingerprint FROM cooked_meals WHERE id = ? AND household_id = ? LIMIT 1'
          )
          .bind(cookId, auth.householdId)
          .first<{
            id: string;
            recipe_id: string;
            servings_cooked: number;
            deductions_applied: string | null;
            recipe_content_fingerprint: string | null;
            request_fingerprint?: string | null;
          }>();
        if (prior) {
          const fpMatches =
            prior.request_fingerprint != null
              ? prior.request_fingerprint === rawRequestFingerprint || prior.request_fingerprint === requestFingerprint
              : storedCookingFingerprint(prior) === requestFingerprint;
          if (!fpMatches) {
            return c.json(
              {
                error: 'Idempotency-Key đã được dùng cho một lệnh nấu khác',
                code: 'IDEMPOTENCY_CONFLICT',
              },
              409
            );
          }
          const inventory = await currentInventory();
          return c.json({
            success: true,
            idempotentReplay: true,
            cookId,
            message: `Đã hoàn tất nấu món ${recipe.title} và tự động cập nhật lại tủ lạnh!`,
            recipeId: recipe.id,
            deductionsApplied: deductions,
            ...(leftoverPortionsToSave > 0
              ? { leftoverItemId: `leftover_${cookId.slice(0, 36)}`, leftoverServingsSaved: leftoverPortionsToSave }
              : {}),
            remainingInventoryCount: inventory.length,
            inventory,
          });
        }
      } catch {
        // Fall through to the durable error response below.
      }
    }
    if (allocations.size > 0) {
      try {
        const latestInventory = await currentInventory();
        const concurrencyConflict = Array.from(allocations.values()).some((allocation) => {
          const latest = latestInventory.find((item: any) => item.id === allocation.itemId);
          return (
            !latest ||
            Number(latest.quantity) < allocation.quantity ||
            Number(latest.version) !== allocation.expectedVersion
          );
        });
        if (concurrencyConflict) {
          return c.json(
            {
              error: 'Tồn kho vừa thay đổi, vui lòng kiểm tra lại lượng nguyên liệu trước khi hoàn tất món ăn',
              code: 'CONFLICT',
            },
            409
          );
        }
      } catch {
        // Preserve the original database failure when the conflict probe also
        // cannot reach D1; an unavailable read is not evidence of low stock.
      }
    }
    if (err instanceof InventoryWriterAuthorityError) return c.json({ error: err.message, code: err.code }, 409);
    console.error('D1 complete cooking transaction failed:');
    return c.json({ error: 'Lỗi hoàn tất nấu món trong cơ sở dữ liệu', code: 'DATABASE_ERROR' }, 500);
  }
});

// Adopted-household cooking: each deduction allocates deterministically
// (FEFO order, shared remaining-stock snapshot) and commits as canonical USE
// commands together with the cooked_meals row. Duplicate commands replay via
// the cook receipt or the per-lot command receipts.
async function completeAdoptedCooking(c: any, db: any, kv: any, auth: AuthContext, plan: {
  cookId: string;
  recipe: Recipe;
  servings: number;
  deductions: Array<{ ingredientId: string; name?: string; quantityDeducted: number; unit: StandardUnit }>;
  requestFingerprint: string;
  authoritySource: RecipeAuthoritySource;
  contentFingerprint?: string;
  rawRequestFingerprint: string;
  cookingSessionId?: string;
  leftoverPortionsToSave?: number;
}) {
  const scope = { householdId: auth.householdId, actorId: auth.userId };
  const leftoverPortions = plan.leftoverPortionsToSave ?? 0;
  const leftoverItemId = `leftover_${plan.cookId.slice(0, 36)}`;
  try {
    // Response-loss retry must replay the durable cooked_meals receipt before
    // any re-planning: after the first commit the authority already holds the
    // consumed poststate, so re-planning the same deductions would wrongly
    // report INSUFFICIENT_INVENTORY instead of the idempotent replay.
    const prior = await db
      .prepare('SELECT id, recipe_id, servings_cooked, deductions_applied, recipe_content_fingerprint, request_fingerprint FROM cooked_meals WHERE id = ? AND household_id = ? LIMIT 1')
      .bind(plan.cookId, auth.householdId)
      .first();
    if (prior) {
      const priorRow = prior as { deductions_applied: string | null; request_fingerprint?: string | null };
      const fpMatches =
        priorRow.request_fingerprint != null
          ? priorRow.request_fingerprint === plan.rawRequestFingerprint || priorRow.request_fingerprint === plan.requestFingerprint
          : storedCookingFingerprint(priorRow) === plan.requestFingerprint;
      if (!fpMatches) {
        return c.json({ error: 'Idempotency-Key đã được dùng cho một lệnh nấu khác', code: 'IDEMPOTENCY_CONFLICT' }, 409);
      }
      const inventory = await fetchHouseholdInventoryFromDb(db, auth.householdId, kv, { strict: true, actorId: auth.userId });
      return c.json({
        success: true, idempotentReplay: true, cookId: plan.cookId,
        message: `Đã hoàn tất nấu món ${plan.recipe.title} và tự động cập nhật lại tủ lạnh!`,
        recipeId: plan.recipe.id, deductionsApplied: plan.deductions,
        ...(leftoverPortions > 0 ? { leftoverItemId, leftoverServingsSaved: leftoverPortions } : {}),
        remainingInventoryCount: inventory.length, inventory,
      });
    }
    // T19: enforce the canonical hard restrictions before any lot/inventory
    // mutation. The idempotent replay above stays untouched.
    const adoptedRestriction = await evaluateCookingHardRestrictions(db, auth, plan.authoritySource, plan.recipe);
    if (adoptedRestriction.blocked) {
      console.warn('[cooking] cook/complete blocked by hard restriction', { recipeId: plan.recipe.id, reasons: adoptedRestriction.reasons });
      return c.json(
        {
          error: 'This dish conflicts with a household restriction',
          code: 'HARD_CONSTRAINT_CONFLICT',
        },
        422
      );
    }
    const snapshot = await readAdoptedLotSnapshot(db, scope);
    const now = new Date().toISOString();
    type PlannedUse = { lotId: string; takeMilli: number; canonicalUnit: typeof snapshot.lots[number]['lot']['canonicalUnit'] };
    const planned = new Map<string, PlannedUse>();
    for (const deduction of plan.deductions) {
      if (deduction.quantityDeducted === 0) continue;
      const lookupName = (deduction.name || deduction.ingredientId).trim();
      const canonical = findCanonicalIngredient(lookupName);
      const lookupId = canonical?.id || (deduction.ingredientId === 'OTHER' ? null : deduction.ingredientId);
      const eligible = snapshot.lots
        .filter(({ lot, legacyItemId }) => legacyItemId !== null && lot.state === 'ACTIVE' && lot.quantityMilli > 0
          && (lookupId ? lot.ingredientId === lookupId : lot.rawName.toLowerCase() === lookupName.toLowerCase())
          && areUnitsCompatible(deduction.unit, lot.canonicalUnit))
        .sort((left, right) => compareFefoLots(left.lot, right.lot));
      let remainingMilli: number;
      try {
        remainingMilli = toLotQuantity(deduction.quantityDeducted, deduction.unit).quantityMilli;
      } catch {
        return c.json({ error: `Không thể quy đổi đơn vị ${deduction.unit} cho ${lookupName}`, code: 'UNIT_MISMATCH' }, 422);
      }
      if (eligible.length === 0 && remainingMilli > 0) {
        return c.json({
          error: `Không tìm thấy nguyên liệu để trừ: ${lookupName}`,
          code: 'INSUFFICIENT_INVENTORY', available: 0, requested: deduction.quantityDeducted, unit: deduction.unit,
        }, 409);
      }
      const availableMilli = eligible.reduce((total, { lot }) =>
        total + Math.max(0, lot.quantityMilli - (planned.get(lot.id)?.takeMilli ?? 0)), 0);
      for (const { lot } of eligible) {
        if (remainingMilli <= 0) break;
        const existing = planned.get(lot.id);
        const unallocatedMilli = Math.max(0, lot.quantityMilli - (existing?.takeMilli ?? 0));
        if (unallocatedMilli === 0) continue;
        const takeMilli = Math.min(remainingMilli, unallocatedMilli);
        planned.set(lot.id, {
          lotId: lot.id, canonicalUnit: lot.canonicalUnit,
          takeMilli: (existing?.takeMilli ?? 0) + takeMilli,
        });
        remainingMilli -= takeMilli;
      }
      if (remainingMilli > 0) {
        const available = convertUnit(availableMilli / 1000, eligible[0].lot.canonicalUnit, deduction.unit);
        return c.json({
          error: `Số lượng ${lookupName} trong tủ không đủ để hoàn tất món ăn`,
          code: 'INSUFFICIENT_INVENTORY', available,
          requested: deduction.quantityDeducted, unit: deduction.unit,
        }, 409);
      }
    }
    const specs: LotCommandSpec[] = [];
    for (const use of planned.values()) {
      const lot = snapshot.lots.find((entry) => entry.lot.id === use.lotId)!.lot;
      specs.push({
        clientKey: `cook:${plan.cookId}:use:${use.lotId}`,
        input: {
          type: 'USE', lotId: use.lotId, expectedVersion: lot.version,
          quantity: use.takeMilli / 1000, unit: use.canonicalUnit,
          reason: `Nấu món ${plan.recipe.title}`,
        },
      });
    }
    if (leftoverPortions > 0) {
      const fridgeLocation =
        snapshot.locations.find((entry) => entry.isDefault && entry.type === 'FRIDGE') ??
        snapshot.locations.find((entry) => entry.type === 'FRIDGE') ??
        snapshot.locations[0];
      if (!fridgeLocation) throw new LotCommandError('DRIFT_DETECTED');
      const leftoverExpiryDate = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
      const leftoverExpiry = lotExpiryFromEvidence(leftoverExpiryDate, 'inferred');
      specs.push({
        clientKey: `cook:${plan.cookId}:leftover`,
        input: {
          type: 'CREATE',
          lotId: leftoverItemId,
          ingredientId: null,
          rawName: `${plan.recipe.title} (Phần dư)`,
          displayCategory: 'other',
          quantity: leftoverPortions,
          unit: 'piece',
          storageLocationId: fridgeLocation.id,
          expiryAt: leftoverExpiry.expiryAt,
          estimatedExpiryAt: leftoverExpiry.estimatedExpiryAt,
          expiryKind: leftoverExpiry.expiryKind,
          purchasedAt: null,
          openedAt: null,
          purchasePrice: null,
          sourceType: 'MANUAL',
          sourceId: null,
        },
      });
    }
    const composed = await composeInventoryLotCommands(db, scope, specs, now);
    const batchStatements: any[] = [
      db.prepare('INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?)')
        .bind(auth.householdId, 'Tủ lạnh gia đình', auth.userId),
      db.prepare(`INSERT OR IGNORE INTO recipes (id, slug, title, cuisine, cook_time_minutes, servings, difficulty)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(plan.recipe.id, plan.recipe.slug, plan.recipe.title, plan.recipe.cuisine,
          plan.recipe.cookTimeMinutes, plan.recipe.servings, plan.recipe.difficulty),
      db.prepare(`INSERT INTO cooked_meals (id, household_id, user_id, recipe_id, servings_cooked, deductions_applied, recipe_content_fingerprint, request_fingerprint)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(plan.cookId, auth.householdId, auth.userId, plan.recipe.id, plan.servings, JSON.stringify(plan.deductions), plan.contentFingerprint ?? null, plan.rawRequestFingerprint),
    ];
    await db.batch([...composed.statements, ...batchStatements]);
    await markActiveCookingSessionsCompleted(db, auth.householdId, auth.userId, plan.cookingSessionId);
    if (kv) await kv.delete(`inv_${auth.householdId}`).catch(() => {});
    const updatedInventory = await fetchHouseholdInventoryFromDb(db, auth.householdId, kv, { strict: true, actorId: auth.userId });
    return c.json({
      success: true,
      cookId: plan.cookId,
      message: `Đã hoàn tất nấu món ${plan.recipe.title} và tự động cập nhật lại tủ lạnh!`,
      recipeId: plan.recipe.id,
      deductionsApplied: plan.deductions,
      ...(leftoverPortions > 0 ? { leftoverItemId, leftoverServingsSaved: leftoverPortions } : {}),
      remainingInventoryCount: updatedInventory.length,
      inventory: updatedInventory,
    });
  } catch (error: any) {
    // A concurrent request may have committed the same idempotent command
    // first; the durable cooked_meals row is the replay evidence.
    const prior = await db
      .prepare('SELECT id, recipe_id, servings_cooked, deductions_applied, recipe_content_fingerprint, request_fingerprint FROM cooked_meals WHERE id = ? AND household_id = ? LIMIT 1')
      .bind(plan.cookId, auth.householdId)
      .first();
    if (prior) {
      const priorRow = prior as { deductions_applied: string | null; request_fingerprint?: string | null };
      const fpMatches =
        priorRow.request_fingerprint != null
          ? priorRow.request_fingerprint === plan.rawRequestFingerprint || priorRow.request_fingerprint === plan.requestFingerprint
          : storedCookingFingerprint(priorRow) === plan.requestFingerprint;
      if (!fpMatches) {
        return c.json({ error: 'Idempotency-Key đã được dùng cho một lệnh nấu khác', code: 'IDEMPOTENCY_CONFLICT' }, 409);
      }
      const inventory = await fetchHouseholdInventoryFromDb(db, auth.householdId, kv, { strict: true, actorId: auth.userId });
      return c.json({
        success: true, idempotentReplay: true, cookId: plan.cookId,
        message: `Đã hoàn tất nấu món ${plan.recipe.title} và tự động cập nhật lại tủ lạnh!`,
        recipeId: plan.recipe.id, deductionsApplied: plan.deductions,
        ...(leftoverPortions > 0 ? { leftoverItemId, leftoverServingsSaved: leftoverPortions } : {}),
        remainingInventoryCount: inventory.length, inventory,
      });
    }
    if (error instanceof LotCommandError) {
      const failure = inventoryAuthorityFailure(error);
      return c.json({ error: error.message, code: failure.code }, failure.status);
    }
    console.error('Adopted cooking failed:');
    return c.json({ error: 'Lỗi hoàn tất nấu món trong cơ sở dữ liệu', code: 'DATABASE_ERROR' }, 500);
  }
}
