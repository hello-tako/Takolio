import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { AuthContext, Env } from '../types';
import { tenancyGuard } from '../middleware/tenancy';
import { rateLimiter } from '../middleware/rate-limit';
import { MealPlanningIntentSchema, PlanIdSchema, PlanningRequestKeySchema, RegenerateMealPlanSchema } from '../../../packages/domain/src/meal-planning-api';
import type { FamilyMealPlanDto } from '../../../packages/domain/src/family-meal-planning-api';
import { legacyMealPlan, legacyPlanCompositions, supportsRecipeContent } from '../services/meal-composition-response';
import { FamilyPlanningInputChanged } from '../../../packages/db/src/family-planning-fence';
import { GeneratedMealPlanPersistenceError } from '../../../packages/db/src/meal-planning';
import { MealPlanningSnapshotAuthorizationError } from '../../../packages/db/src/meal-planning-snapshot';
import { readFamilyPreferences } from '../../../packages/db/src/family-preferences';
import { MealPlanningApplicationService, type MealPlanningServiceOptions } from '../services/meal-planning';
import { MealPlanningError } from '../services/meal-planning-error';
import { backgroundExecutorOf, resolveRecipeAuthority } from '../services/recipe-authority';

type App = { Bindings: Env; Variables: { auth: AuthContext } };
type Ctx = Context<App>;
async function body<T extends z.ZodTypeAny>(c: Ctx, schema: T): Promise<z.output<T>> {
  let json: unknown;
  try { json = await c.req.json(); } catch { throw new MealPlanningError('INVALID_JSON', 400, 'Expected a JSON request body'); }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new MealPlanningError('INVALID_REQUEST', 422, 'Request does not match the family meal planning contract');
  return parsed.data;
}
async function respond(c: Ctx, operation: () => Promise<FamilyMealPlanDto | { plan: FamilyMealPlanDto | null }>) {
  try {
    const result = await operation();
    if (supportsRecipeContent(c.req.header('Accept'))) return c.json(result);
    const legacy = (plan: FamilyMealPlanDto) => ({ ...plan, plan: legacyMealPlan(plan.plan), compositions: legacyPlanCompositions(plan.compositions) });
    return c.json('schemaVersion' in result ? legacy(result) : { plan: result.plan ? legacy(result.plan) : null });
  } catch (error) {
    if (error instanceof FamilyPlanningInputChanged) return c.json({ code: 'PLAN_REVALIDATION_REQUIRED', error: 'Planning inputs changed; retry with current data' }, 409);
    if (error instanceof MealPlanningError) return c.json({ code: error.code, error: error.message }, error.status);
    if (error instanceof MealPlanningSnapshotAuthorizationError) return c.json({ code: 'TENANCY_VIOLATION', error: 'Household access denied' }, 403);
    if (error instanceof GeneratedMealPlanPersistenceError) {
      const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : 409;
      return c.json({ code: error.code === 'REVISION_CONFLICT' ? 'PLAN_REVISION_CONFLICT' : error.code, error: 'Family plan state is unavailable or changed' }, status);
    }
    console.error(JSON.stringify({ level: 'error', event: 'family_meal_planning_failure', code: 'MEAL_PLANNING_UNAVAILABLE' }));
    return c.json({ code: 'MEAL_PLANNING_UNAVAILABLE', error: 'Family meal planning could not be completed' }, 500);
  }
}
export function createFamilyMealPlanningRoutes(options: Partial<MealPlanningServiceOptions> = {}) {
  const routes = new Hono<App>();
  routes.use('/meal-planning/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ code: 'UNAUTHORIZED', error: 'Authentication required' }, 401);
    if (auth.isGuest) return c.json({ code: 'REGISTERED_ACCOUNT_REQUIRED', error: 'Registered membership required' }, 403);
    if (c.env.MEAL_PLANNER_ENABLED !== 'true' || c.env.MEAL_COMPOSITION_V2_ENABLED !== 'true') {
      return c.json({ code: 'MEAL_COMPOSITION_DISABLED', error: 'Family meal planning is not enabled' }, 404);
    }
    await next();
  });
  routes.use('/meal-planning/*', tenancyGuard);
  routes.use('/meal-planning/*', bodyLimit({ maxSize: 65_536, onError: (c) => c.json({ code: 'REQUEST_TOO_LARGE', error: 'Request exceeds 64 KiB' }, 413) }));
  const compute = rateLimiter({ maxRequests: 10, windowSeconds: 60, prefix: 'planner-compute', scope: 'account' });
  const reads = rateLimiter({ maxRequests: 60, windowSeconds: 60, prefix: 'meal-planning-read' });
  const scope = (c: Ctx) => ({ householdId: c.get('auth').householdId, userId: c.get('auth').userId });
  const service = (c: Ctx) => new MealPlanningApplicationService(c.env.DB, { ...options, compositionV2Enabled: true,
    familyPreferences: options.familyPreferences ?? ((owned) => readFamilyPreferences(c.env.DB, owned)),
    recipeAuthority: options.recipeAuthority ?? (async (owned) => (await resolveRecipeAuthority(c.env, {
      tenantKey: owned.householdId, backgroundExecutor: backgroundExecutorOf(c) })).snapshot) });
  const planId = (c: Ctx) => {
    const parsed = PlanIdSchema.safeParse(c.req.param('id'));
    if (!parsed.success) throw new MealPlanningError('INVALID_PLAN_ID', 422, 'Invalid plan ID');
    return parsed.data;
  };
  routes.post('/meal-planning/plans', compute, (c) => respond(c, async () => {
    const parsed = PlanningRequestKeySchema.safeParse(c.req.header('Idempotency-Key'));
    if (!parsed.success) throw new MealPlanningError('IDEMPOTENCY_KEY_REQUIRED', 400, 'A valid Idempotency-Key header is required');
    return service(c).generateFamily(scope(c), await body(c, MealPlanningIntentSchema), parsed.data);
  }));
  routes.post('/meal-planning/drafts', compute, (c) => respond(c, async () => {
    const parsed = PlanningRequestKeySchema.safeParse(c.req.header('Idempotency-Key'));
    if (!parsed.success) throw new MealPlanningError('IDEMPOTENCY_KEY_REQUIRED', 400, 'A valid Idempotency-Key header is required');
    return service(c).createManualFamily(scope(c), await body(c, MealPlanningIntentSchema), parsed.data);
  }));
  routes.get('/meal-planning/plans/current', reads, (c) => respond(c, () => service(c).currentFamily(scope(c))));
  routes.get('/meal-planning/plans/:id', reads, (c) => respond(c, () => service(c).getFamily(scope(c), planId(c))));
  routes.post('/meal-planning/plans/:id/regenerate', compute, (c) => respond(c, async () =>
    service(c).regenerateFamily(scope(c), planId(c), await body(c, RegenerateMealPlanSchema))));
  return routes;
}
