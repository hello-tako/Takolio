/**
 * T14C — recipe media presentation for API responses (ADR-025).
 *
 * Enrichment happens AFTER recipe retrieval/ranking: callers pass the already-decided recipe list and
 * receive an additive `media` presentation per recipe. Recipe content, order and scores are untouched.
 * A D1 media failure degrades to legacy `imageUrl` presentation and emits a bounded diagnostic; it
 * never turns GET /recipes into a 500.
 */
import { presentRecipeMedia, isRecipeMediaRole, parseRecipeMediaVersion, RECIPE_MEDIA_STATUSES, type Recipe, type RecipeMediaPresentationSet, type RecipeMediaRecord } from '@frigo/recipes';
import { D1RecipeMediaCatalog, type RecipeMediaCatalog } from '@frigo/db';
import type { Env } from '../types';

export type RecipeMediaDiagnosticEvent =
  | 'recipe_media_metadata_missing'
  | 'recipe_media_not_ready'
  | 'recipe_media_invalid'
  | 'recipe_media_object_missing'
  | 'recipe_media_mime_rejected'
  | 'recipe_media_read_failed';

const DIAGNOSTIC_WINDOW_MS = 60_000;
const DIAGNOSTIC_LIMIT_PER_WINDOW = 20;
let windowStartedAt = 0;
let emittedInWindow = 0;

const DIAGNOSTIC_EVENTS = new Set<RecipeMediaDiagnosticEvent>([
  'recipe_media_metadata_missing', 'recipe_media_not_ready', 'recipe_media_invalid',
  'recipe_media_object_missing', 'recipe_media_mime_rejected', 'recipe_media_read_failed',
]);
const DIAGNOSTIC_CODES = new Set<string>([
  ...RECIPE_MEDIA_STATUSES, 'D1_READ_FAILED', 'incomplete', 'missing_storage_key',
  'untrusted_storage_key', 'missing_mime_type', 'unsupported_mime_type',
  'missing_dimensions', 'invalid_dimensions', 'missing_content_hash',
  'invalid_content_hash', 'missing_content_length', 'invalid_content_length',
  'object_mime_mismatch', 'object_size_mismatch',
]);

/** A valid path recipe ID can still contain private text; retain only bounded diagnostic fields. */
export function emitRecipeMediaDiagnostic(event: RecipeMediaDiagnosticEvent, detail: { recipeId?: string; role?: string; version?: number; code?: string } = {}, now = Date.now()): boolean {
  if (!DIAGNOSTIC_EVENTS.has(event)) return false;
  if (now - windowStartedAt >= DIAGNOSTIC_WINDOW_MS) { windowStartedAt = now; emittedInWindow = 0; }
  if (emittedInWindow >= DIAGNOSTIC_LIMIT_PER_WINDOW) return false;
  emittedInWindow += 1;
  let fields: PropertyDescriptorMap = {};
  try { fields = Object.getOwnPropertyDescriptors(detail); } catch { /* Ignore unavailable diagnostic metadata. */ }
  const role = fields.role?.value;
  const code = fields.code?.value;
  const version = typeof fields.version?.value === 'number' ? parseRecipeMediaVersion(fields.version.value) : null;
  console.warn(JSON.stringify({
    level: 'warn', event,
    ...(isRecipeMediaRole(role) ? { role } : {}),
    ...(version !== null ? { version } : {}),
    ...(typeof code === 'string' && DIAGNOSTIC_CODES.has(code) ? { code } : {}),
  }));
  return true;
}

/** Test seam only. */
export function resetRecipeMediaDiagnosticsForTests(): void { windowStartedAt = 0; emittedInWindow = 0; }

export type RecipeWithMedia<T extends Pick<Recipe, 'id' | 'imageUrl'>> = T & { media: RecipeMediaPresentationSet };

export function createRecipeMediaCatalog(env: Pick<Env, 'DB'>): RecipeMediaCatalog | null {
  return env.DB ? new D1RecipeMediaCatalog(env.DB) : null;
}

/** Reads current-ready hero rows for all given recipes in bounded bulk queries; `[]` on failure. */
export async function loadCurrentHeroMedia(catalog: RecipeMediaCatalog | null, recipeIds: readonly string[]): Promise<RecipeMediaRecord[]> {
  if (!catalog || recipeIds.length === 0) return [];
  try {
    return await catalog.readCurrentReady(recipeIds, 'hero');
  } catch {
    emitRecipeMediaDiagnostic('recipe_media_read_failed', { code: 'D1_READ_FAILED' });
    return [];
  }
}

/** Pure attach step: same array order, same objects plus `media`. */
export function attachRecipeMedia<T extends Pick<Recipe, 'id' | 'imageUrl'>>(recipes: readonly T[], records: readonly RecipeMediaRecord[]): RecipeWithMedia<T>[] {
  const byRecipe = new Map<string, RecipeMediaRecord[]>();
  for (const record of records) {
    const list = byRecipe.get(record.recipeId);
    if (list) list.push(record); else byRecipe.set(record.recipeId, [record]);
  }
  return recipes.map((recipe) => ({ ...recipe, media: presentRecipeMedia(recipe, byRecipe.get(recipe.id) ?? []) }));
}

export async function enrichRecipesWithMedia<T extends Pick<Recipe, 'id' | 'imageUrl'>>(env: Pick<Env, 'DB'>, recipes: readonly T[]): Promise<RecipeWithMedia<T>[]> {
  const records = await loadCurrentHeroMedia(createRecipeMediaCatalog(env), recipes.map((recipe) => recipe.id));
  return attachRecipeMedia(recipes, records);
}
