import {
  katakanaToHiragana,
  normalizeMultilingualText,
  tokenizeMultilingualSearch,
  type SupportedLocale,
} from '../../domain/src/i18n';
import type { D1DatabaseBinding } from './index';

export interface RecipeSearchDocumentInput {
  recipeId: string;
  locale: SupportedLocale;
  title: string;
  readingHiragana?: string | null;
  description?: string | null;
  tags?: readonly string[];
  ingredientNames?: readonly string[];
}

export interface IndexedRecipeMatch {
  recipeId: string;
  locale: string;
  normalizedTitle: string;
  readingHiragana: string | null;
}

function escapeFtsPhrase(token: string): string {
  return `"${token.replace(/"/g, '""')}"`;
}

/**
 * Builds an FTS5 MATCH expression where every query token must match (AND),
 * using prefix matching (`"tok"*`) on multi-character Latin/Kana words so
 * partial typing (`"oyako"`, `"kartoffel"`, `"肉じゃ"`) resolves in O(log N).
 */
export function buildMultilingualFtsMatchQuery(
  rawQuery: string,
  locale: SupportedLocale = 'en',
): string | null {
  const tokens = tokenizeMultilingualSearch(rawQuery, { locale, mode: 'query' });
  if (tokens.length === 0) return null;
  return tokens
    .map((tok) => (tok.length >= 2 ? `${escapeFtsPhrase(tok)}*` : escapeFtsPhrase(tok)))
    .join(' AND ');
}

export async function upsertRecipeSearchDocuments(
  db: D1DatabaseBinding,
  documents: readonly RecipeSearchDocumentInput[],
): Promise<void> {
  if (documents.length === 0) return;
  const statements = documents.map((doc) => {
    const reading = doc.readingHiragana ? katakanaToHiragana(doc.readingHiragana.trim()) : null;
    const corpus = [
      doc.title,
      doc.description ?? '',
      ...(doc.tags ?? []),
      ...(doc.ingredientNames ?? []),
    ]
      .filter(Boolean)
      .join(' ');
    const tokens = tokenizeMultilingualSearch(corpus, {
      locale: doc.locale,
      readingHiragana: reading ?? undefined,
      mode: 'document',
    }).join(' ');
    const normalizedTitle = reading || normalizeMultilingualText(doc.title);
    return db
      .prepare(
        `INSERT INTO recipe_search_documents (recipe_id, locale, normalized_title, reading_hiragana, search_tokens, updated_at)
         VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(recipe_id, locale) DO UPDATE SET
           normalized_title = excluded.normalized_title,
           reading_hiragana = excluded.reading_hiragana,
           search_tokens = excluded.search_tokens,
           updated_at = excluded.updated_at`,
      )
      .bind(doc.recipeId, doc.locale, normalizedTitle, reading, tokens);
  });
  const results = await db.batch(statements);
  if (results.some((r) => !r.success)) {
    throw new Error('Failed to index multilingual recipe search documents');
  }
}

export async function searchIndexedRecipes(
  db: D1DatabaseBinding,
  options: {
    query: string;
    locale: SupportedLocale;
    fallbackLocales?: readonly SupportedLocale[];
    limit?: number;
  },
): Promise<IndexedRecipeMatch[]> {
  const matchExpr = buildMultilingualFtsMatchQuery(options.query, options.locale);
  if (!matchExpr) return [];
  const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
  const locales = [...new Set([options.locale, ...(options.fallbackLocales ?? [])])];
  const localePlaceholders = locales.map(() => '?').join(', ');

  const rows = await db
    .prepare(
      `SELECT d.recipe_id, d.locale, d.normalized_title, d.reading_hiragana
         FROM recipe_search_fts f
         JOIN recipe_search_documents d
           ON d.recipe_id = f.recipe_id AND d.locale = f.locale
        WHERE recipe_search_fts MATCH ?
          AND f.locale IN (${localePlaceholders})
        ORDER BY bm25(recipe_search_fts), d.normalized_title ASC, d.recipe_id ASC
        LIMIT ?`,
    )
    .bind(matchExpr, ...locales, limit)
    .all<{
      recipe_id: string;
      locale: string;
      normalized_title: string;
      reading_hiragana: string | null;
    }>();

  if (!rows.success) {
    throw new Error('Multilingual FTS5 recipe query failed');
  }

  const seen = new Set<string>();
  const matches: IndexedRecipeMatch[] = [];
  for (const row of rows.results) {
    if (seen.has(row.recipe_id)) continue;
    seen.add(row.recipe_id);
    matches.push({
      recipeId: row.recipe_id,
      locale: row.locale,
      normalizedTitle: row.normalized_title,
      readingHiragana: row.reading_hiragana,
    });
  }
  return matches;
}
