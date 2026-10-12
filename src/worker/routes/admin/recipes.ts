import type { Env } from '../../types';
import type { AdminEditorialState, AdminPage, AdminRecipeDetail, AdminRecipesSummary, AdminRecipeSummary } from '../../../shared/admin';
import { escapeLike } from './http';

interface RecipeRow {
  id: string; slug: string; title: string; cuisine: string; difficulty: string; cook_time_minutes: number; source_type: string;
  verification_state: 'unverified' | 'reviewed' | 'rejected'; version: number; created_at: string; has_media: number; latest_state: AdminEditorialState | null;
}

const COLUMNS = `r.id, r.slug, r.title, r.cuisine, r.difficulty, r.cook_time_minutes, r.source_type, r.verification_state, r.version, r.created_at,
  EXISTS (SELECT 1 FROM recipe_media m WHERE m.recipe_id = r.id AND m.status = 'ready') AS has_media,
  (SELECT e.state FROM admin_recipe_editorial_reviews e WHERE e.recipe_id = r.id ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS latest_state`;

function summary(row: RecipeRow): AdminRecipeSummary {
  return { id: row.id, slug: row.slug, title: row.title, cuisine: row.cuisine, difficulty: row.difficulty, cookTimeMinutes: Number(row.cook_time_minutes),
    sourceType: row.source_type, verificationState: row.verification_state, version: Number(row.version), hasReadyMedia: row.has_media === 1,
    latestEditorialState: row.latest_state, createdAt: row.created_at };
}

export async function listRecipes(env: Env, query: { q?: string; cuisine?: string; verification?: string; source?: string; page: number; pageSize: number }): Promise<AdminPage<AdminRecipeSummary>> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (query.q) {
    const like = `%${escapeLike(query.q.toLowerCase())}%`;
    where.push(`(r.id = ? OR lower(r.title) LIKE ? ESCAPE '\\' OR lower(r.slug) LIKE ? ESCAPE '\\')`);
    binds.push(query.q, like, like);
  }
  if (query.cuisine) { where.push('r.cuisine = ?'); binds.push(query.cuisine); }
  if (query.verification) { where.push('r.verification_state = ?'); binds.push(query.verification); }
  if (query.source) { where.push('r.source_type = ?'); binds.push(query.source); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await env.DB.prepare(`SELECT COUNT(*) AS total FROM recipes r ${clause}`).bind(...binds).first<{ total: number }>();
  const rows = await env.DB.prepare(`SELECT ${COLUMNS} FROM recipes r ${clause} ORDER BY r.title COLLATE NOCASE, r.id LIMIT ? OFFSET ?`)
    .bind(...binds, query.pageSize, (query.page - 1) * query.pageSize).all<RecipeRow>();
  return { items: rows.results.map(summary), page: query.page, pageSize: query.pageSize, total: Number(total?.total ?? 0) };
}

export async function recipesSummary(env: Env): Promise<AdminRecipesSummary> {
  const [total, verification, source, cuisine, media, queue] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS value FROM recipes').first<{ value: number }>(),
    env.DB.prepare('SELECT verification_state AS key, COUNT(*) AS count FROM recipes GROUP BY 1 ORDER BY 1').all<{ key: string; count: number }>(),
    env.DB.prepare('SELECT source_type AS key, COUNT(*) AS count FROM recipes GROUP BY 1 ORDER BY 1').all<{ key: string; count: number }>(),
    env.DB.prepare('SELECT cuisine AS key, COUNT(*) AS count FROM recipes GROUP BY 1 ORDER BY count DESC, key LIMIT 20').all<{ key: string; count: number }>(),
    env.DB.prepare(`SELECT COUNT(DISTINCT recipe_id) AS value FROM recipe_media WHERE status = 'ready'`).first<{ value: number }>(),
    env.DB.prepare(`SELECT latest AS key, COUNT(*) AS count FROM (
        SELECT (SELECT e.state FROM admin_recipe_editorial_reviews e WHERE e.recipe_id = x.recipe_id ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS latest
        FROM (SELECT DISTINCT recipe_id FROM admin_recipe_editorial_reviews) x) GROUP BY 1 ORDER BY 1`).all<{ key: AdminEditorialState; count: number }>(),
  ]);
  return {
    total: Number(total?.value ?? 0),
    byVerification: verification.results.map((row) => ({ state: row.key, count: Number(row.count) })),
    bySource: source.results.map((row) => ({ sourceType: row.key, count: Number(row.count) })),
    byCuisine: cuisine.results.map((row) => ({ cuisine: row.key, count: Number(row.count) })),
    withReadyMedia: Number(media?.value ?? 0),
    catalogMode: env.RECIPE_CATALOG_MODE || 'static',
    editorialQueue: queue.results.map((row) => ({ state: row.key, count: Number(row.count) })),
  };
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string').slice(0, 50) : [];
  } catch {
    return [];
  }
}

export async function getRecipe(env: Env, id: string): Promise<AdminRecipeDetail | null> {
  const row = await env.DB.prepare(`SELECT ${COLUMNS}, r.description, r.servings, r.prep_time_minutes, r.tags, r.source_reference, r.family_id
      FROM recipes r WHERE r.id = ? LIMIT 1`).bind(id)
    .first<RecipeRow & { description: string | null; servings: number; prep_time_minutes: number | null; tags: string | null; source_reference: string | null; family_id: string | null }>();
  if (!row) return null;
  const [counts, media, reviews] = await Promise.all([
    env.DB.prepare(`SELECT (SELECT COUNT(*) FROM recipe_ingredients WHERE recipe_id = ?1) AS ingredients, (SELECT COUNT(*) FROM recipe_steps WHERE recipe_id = ?1) AS steps`)
      .bind(id).first<{ ingredients: number; steps: number }>(),
    env.DB.prepare(`SELECT role, version, status, source_type, mime_type FROM recipe_media WHERE recipe_id = ? ORDER BY role, version DESC LIMIT 20`)
      .bind(id).all<{ role: string; version: number; status: string; source_type: string | null; mime_type: string | null }>(),
    env.DB.prepare(`SELECT id, state, note, author_user_id, recipe_version, created_at FROM admin_recipe_editorial_reviews
        WHERE recipe_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`)
      .bind(id).all<{ id: string; state: AdminEditorialState; note: string; author_user_id: string; recipe_version: number; created_at: string }>(),
  ]);
  return {
    ...summary(row),
    description: row.description,
    servings: Number(row.servings),
    prepTimeMinutes: row.prep_time_minutes,
    tags: parseTags(row.tags),
    sourceReference: row.source_reference,
    familyId: row.family_id,
    ingredientCount: Number(counts?.ingredients ?? 0),
    stepCount: Number(counts?.steps ?? 0),
    media: media.results.map((m) => ({ role: m.role, version: Number(m.version), status: m.status, sourceType: m.source_type, mimeType: m.mime_type })),
    editorialReviews: reviews.results.map((r) => ({ id: r.id, state: r.state, note: r.note, authorUserId: r.author_user_id, recipeVersion: Number(r.recipe_version), createdAt: r.created_at })),
    publication: { canPublish: false, note: 'Xuất bản vào danh mục công thức chính thức chưa khả dụng trong V1; ghi chú biên tập không thay đổi công thức.' },
  };
}
