import type { D1DatabaseBinding } from '@frigo/db';
import type { AdminEditorialState, AdminPage, AdminRecipeDetail, AdminRecipesSummary, AdminRecipeSummary } from '../../../shared/admin';
import { escapeLike } from './http';

interface RecipeRow {
  id: string; slug: string; title: string; cuisine: string; difficulty: string; cook_time_minutes: number; source_type: string;
  verification_state: 'unverified' | 'reviewed' | 'rejected'; version: number; created_at: string; has_media: number;
}

const COLUMNS = `r.id, r.slug, r.title, r.cuisine, r.difficulty, r.cook_time_minutes, r.source_type, r.verification_state, r.version, r.created_at,
  EXISTS (SELECT 1 FROM recipe_media m WHERE m.recipe_id = r.id AND m.status = 'ready') AS has_media`;

// Latest editorial row per recipe, from the admin database.
const LATEST_REVIEW_SQL = `SELECT e.recipe_id, e.state FROM admin_recipe_editorial_reviews e
  WHERE e.recipe_id IN (SELECT value FROM json_each(?))
    AND NOT EXISTS (SELECT 1 FROM admin_recipe_editorial_reviews n WHERE n.recipe_id = e.recipe_id
      AND (n.created_at > e.created_at OR (n.created_at = e.created_at AND n.id > e.id)))`;

async function latestStates(adminDb: D1DatabaseBinding, recipeIds: string[]): Promise<Map<string, AdminEditorialState>> {
  if (recipeIds.length === 0) return new Map();
  const rows = await adminDb.prepare(LATEST_REVIEW_SQL).bind(JSON.stringify(recipeIds)).all<{ recipe_id: string; state: AdminEditorialState }>();
  return new Map(rows.results.map((row) => [row.recipe_id, row.state]));
}

function summary(row: RecipeRow, latest: AdminEditorialState | null): AdminRecipeSummary {
  return { id: row.id, slug: row.slug, title: row.title, cuisine: row.cuisine, difficulty: row.difficulty, cookTimeMinutes: Number(row.cook_time_minutes),
    sourceType: row.source_type, verificationState: row.verification_state, version: Number(row.version), hasReadyMedia: row.has_media === 1,
    latestEditorialState: latest, createdAt: row.created_at };
}

export async function listRecipes(main: D1DatabaseBinding, adminDb: D1DatabaseBinding,
  query: { q?: string; cuisine?: string; verification?: string; source?: string; page: number; pageSize: number }): Promise<AdminPage<AdminRecipeSummary>> {
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
  const total = await main.prepare(`SELECT COUNT(*) AS total FROM recipes r ${clause}`).bind(...binds).first<{ total: number }>();
  const rows = await main.prepare(`SELECT ${COLUMNS} FROM recipes r ${clause} ORDER BY r.title COLLATE NOCASE, r.id LIMIT ? OFFSET ?`)
    .bind(...binds, query.pageSize, (query.page - 1) * query.pageSize).all<RecipeRow>();
  const latest = await latestStates(adminDb, rows.results.map((row) => row.id));
  return { items: rows.results.map((row) => summary(row, latest.get(row.id) ?? null)), page: query.page, pageSize: query.pageSize, total: Number(total?.total ?? 0) };
}

export async function recipesSummary(main: D1DatabaseBinding, adminDb: D1DatabaseBinding, catalogMode: string | undefined): Promise<AdminRecipesSummary> {
  const [total, verification, source, cuisine, media, queue] = await Promise.all([
    main.prepare('SELECT COUNT(*) AS value FROM recipes').first<{ value: number }>(),
    main.prepare('SELECT verification_state AS key, COUNT(*) AS count FROM recipes GROUP BY 1 ORDER BY 1').all<{ key: string; count: number }>(),
    main.prepare('SELECT source_type AS key, COUNT(*) AS count FROM recipes GROUP BY 1 ORDER BY 1').all<{ key: string; count: number }>(),
    main.prepare('SELECT cuisine AS key, COUNT(*) AS count FROM recipes GROUP BY 1 ORDER BY count DESC, key LIMIT 20').all<{ key: string; count: number }>(),
    main.prepare(`SELECT COUNT(DISTINCT recipe_id) AS value FROM recipe_media WHERE status = 'ready'`).first<{ value: number }>(),
    adminDb.prepare(`SELECT e.state AS key, COUNT(*) AS count FROM admin_recipe_editorial_reviews e
        WHERE NOT EXISTS (SELECT 1 FROM admin_recipe_editorial_reviews n WHERE n.recipe_id = e.recipe_id
          AND (n.created_at > e.created_at OR (n.created_at = e.created_at AND n.id > e.id)))
        GROUP BY 1 ORDER BY 1`).all<{ key: AdminEditorialState; count: number }>(),
  ]);
  return {
    total: Number(total?.value ?? 0),
    byVerification: verification.results.map((row) => ({ state: row.key, count: Number(row.count) })),
    bySource: source.results.map((row) => ({ sourceType: row.key, count: Number(row.count) })),
    byCuisine: cuisine.results.map((row) => ({ cuisine: row.key, count: Number(row.count) })),
    withReadyMedia: Number(media?.value ?? 0),
    // The authoritative mode lives in the customer Worker's configuration.
    catalogMode: catalogMode ?? 'unknown',
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

export async function getRecipe(main: D1DatabaseBinding, adminDb: D1DatabaseBinding, id: string): Promise<AdminRecipeDetail | null> {
  const row = await main.prepare(`SELECT ${COLUMNS}, r.description, r.servings, r.prep_time_minutes, r.tags, r.source_reference, r.family_id
      FROM recipes r WHERE r.id = ? LIMIT 1`).bind(id)
    .first<RecipeRow & { description: string | null; servings: number; prep_time_minutes: number | null; tags: string | null; source_reference: string | null; family_id: string | null }>();
  if (!row) return null;
  const [counts, media, reviews] = await Promise.all([
    main.prepare(`SELECT (SELECT COUNT(*) FROM recipe_ingredients WHERE recipe_id = ?1) AS ingredients, (SELECT COUNT(*) FROM recipe_steps WHERE recipe_id = ?1) AS steps`)
      .bind(id).first<{ ingredients: number; steps: number }>(),
    main.prepare(`SELECT role, version, status, source_type, mime_type FROM recipe_media WHERE recipe_id = ? ORDER BY role, version DESC LIMIT 20`)
      .bind(id).all<{ role: string; version: number; status: string; source_type: string | null; mime_type: string | null }>(),
    adminDb.prepare(`SELECT id, state, note, author_user_id, recipe_version, created_at FROM admin_recipe_editorial_reviews
        WHERE recipe_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`)
      .bind(id).all<{ id: string; state: AdminEditorialState; note: string; author_user_id: string; recipe_version: number; created_at: string }>(),
  ]);
  return {
    ...summary(row, reviews.results[0]?.state ?? null),
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
