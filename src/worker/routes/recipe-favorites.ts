import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { CatalogIdSchema } from '../../../packages/domain/src/foundation';
import { RecipeFavoriteEntrySchema, RecipeFavoriteStateSchema, SaveRecipeFavoriteSchema } from '../../../packages/domain/src/recipe-favorites-api';
import type { Env, AuthContext } from '../types';
import { tenancyGuard } from '../middleware/tenancy';
import { rateLimiter } from '../middleware/rate-limit';
import type { Recipe } from '../../../packages/recipes/src/types';
import { buildRoleIndex } from '../../../packages/recipes/src/composition/roles';
import { readRoleAssignments } from '../../../packages/db/src/meal-composition';
import { resolveRecipeAuthority } from '../services/recipe-authority';

export const recipeFavoritesRoutes = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
recipeFavoritesRoutes.use('/recipe-favorites*', tenancyGuard);
recipeFavoritesRoutes.use('/recipe-favorites*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
recipeFavoritesRoutes.use('/recipe-favorites*', bodyLimit({ maxSize: 4096 }));
recipeFavoritesRoutes.use('/recipe-favorites*', rateLimiter({ maxRequests: 60, windowSeconds: 60, prefix: 'recipe-favorites' }));
recipeFavoritesRoutes.use('/recipe-favorites*', async (c, next) => {
  if (c.get('auth').isGuest) return c.json({ code: 'LOGIN_REQUIRED', error: 'Đăng nhập để lưu món yêu thích.' }, 403);
  if (!c.env.DB) return c.json({ code: 'DATABASE_UNAVAILABLE' }, 503);
  await next();
});

interface EntryRow { recipe_id: string; revision: number; is_saved: number; display_json: string }
const displayOf = (recipe: Recipe) => ({
  title: recipe.title, slug: recipe.slug, cuisine: recipe.cuisine, region: recipe.region ?? null,
  imageUrl: recipe.imageUrl ?? '', cookTimeMinutes: recipe.cookTimeMinutes, servings: recipe.servings, difficulty: recipe.difficulty,
});
recipeFavoritesRoutes.get('/recipe-favorites', async (c) => {
  const auth = c.get('auth');
  try {
    const [rows, authority] = await Promise.all([
      c.env.DB.prepare('SELECT recipe_id,revision,is_saved,display_json FROM saved_recipe_entries WHERE user_id = ? AND is_saved = 1 ORDER BY updated_at DESC, recipe_id').bind(auth.userId).all<EntryRow>(),
      resolveRecipeAuthority(c.env, { tenantKey: auth.householdId }),
    ]);
    if (!rows.success) throw new Error('Favorite read failed');
    const persisted = authority.snapshot.source === 'd1' ? await readRoleAssignments(c.env.DB, new Set(authority.snapshot.list().map((recipe) => recipe.id))) : [];
    const roles = buildRoleIndex(authority.snapshot.list(), persisted);
    return c.json({ entries: rows.results.map((row) => {
      const recipe = authority.snapshot.findByIdOrSlug(row.recipe_id);
      return RecipeFavoriteEntrySchema.parse({ ...JSON.parse(row.display_json).display, ...(recipe ? displayOf(recipe) : {}),
        recipeId: row.recipe_id, revision: row.revision, isSaved: true, available: !!recipe, roles: recipe ? roles.get(recipe.id)?.roles ?? [] : [] });
    }) });
  } catch { return c.json({ code: 'DATABASE_UNAVAILABLE', error: 'Chưa tải được món đã lưu.' }, 503); }
});
recipeFavoritesRoutes.get('/recipe-favorites/:recipeId', async (c) => {
  const parsed = CatalogIdSchema.safeParse(c.req.param('recipeId'));
  if (!parsed.success) return c.json({ code: 'VALIDATION_ERROR' }, 422);
  try {
    const row = await c.env.DB.prepare('SELECT revision,is_saved FROM saved_recipe_entries WHERE user_id = ? AND recipe_id = ?')
      .bind(c.get('auth').userId, parsed.data).first<{revision: number; is_saved: number}>();
    return c.json(RecipeFavoriteStateSchema.parse({ recipeId: parsed.data, revision: row?.revision ?? 0, isSaved: !!row?.is_saved }));
  } catch { return c.json({ code: 'DATABASE_UNAVAILABLE' }, 503); }
});
recipeFavoritesRoutes.put('/recipe-favorites/:recipeId', async (c) => {
  const id = CatalogIdSchema.safeParse(c.req.param('recipeId'));
  const parsed = SaveRecipeFavoriteSchema.safeParse(await c.req.json().catch(() => null));
  if (!id.success || !parsed.success) return c.json({ code: 'VALIDATION_ERROR' }, 422);
  const auth = c.get('auth');
  const { expectedRevision, isSaved } = parsed.data;
  try {
    const previous = await c.env.DB.prepare('SELECT revision,is_saved,display_json FROM saved_recipe_entries WHERE user_id = ? AND recipe_id = ?')
      .bind(auth.userId, id.data).first<EntryRow>();
    if ((previous?.revision ?? 0) !== expectedRevision) return c.json({ code: 'REVISION_CONFLICT' }, 409);
    // Removal must work even when this authority no longer contains a saved recipe.
    const authority = isSaved ? (await resolveRecipeAuthority(c.env, { tenantKey: auth.householdId })).snapshot : null;
    const recipe = authority?.findById(id.data) ?? null;
    if (isSaved && (!recipe || recipe.id !== id.data)) return c.json({ code: 'RECIPE_UNAVAILABLE' }, 404);
    if (!isSaved && !previous) return c.json({ recipeId: id.data, revision: 0, isSaved: false });
    const displayJson = recipe ? JSON.stringify({ authoritySource: authority!.source, authorityFingerprint: authority!.fingerprint, display: displayOf(recipe) }) : previous!.display_json;
    const result = await c.env.DB.prepare(`INSERT INTO saved_recipe_entries(user_id,recipe_id,revision,is_saved,display_json,updated_at)
      SELECT ?, ?, ? + 1, ?, ?, ?
      WHERE EXISTS(SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?)
        AND (? = 0 OR EXISTS(SELECT 1 FROM saved_recipe_entries WHERE user_id = ? AND recipe_id = ?))
      ON CONFLICT(user_id,recipe_id) DO UPDATE SET
        revision = CASE WHEN saved_recipe_entries.revision = ? THEN saved_recipe_entries.revision + 1 ELSE -1 END,
        is_saved = excluded.is_saved, display_json = excluded.display_json, updated_at = excluded.updated_at`)
      .bind(auth.userId, id.data, expectedRevision, isSaved ? 1 : 0, displayJson, new Date().toISOString(), auth.householdId, auth.userId, expectedRevision, auth.userId, id.data, expectedRevision).run();
    if (result.meta.changes !== 1) return c.json({ code: 'FORBIDDEN' }, 403);
    return c.json({ recipeId: id.data, revision: expectedRevision + 1, isSaved });
  } catch {
    const current = await c.env.DB.prepare('SELECT revision FROM saved_recipe_entries WHERE user_id = ? AND recipe_id = ?')
      .bind(auth.userId, id.data).first<{ revision:number }>().catch(() => null);
    if ((current?.revision ?? 0) !== expectedRevision) return c.json({ code: 'REVISION_CONFLICT' }, 409);
    return c.json({ code: 'DATABASE_UNAVAILABLE', error: 'Chưa lưu được món. Vui lòng thử lại.' }, 503);
  }
});
