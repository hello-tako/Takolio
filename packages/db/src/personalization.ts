import { z } from 'zod';
import {
  RankingPreferencesSchema,
  RecipeFeedbackSchema,
  RecipeIdentitySchema,
  RankingContextSchema,
  type RankingContext,
  type RankingPreferences,
  type RecipeFeedback,
} from '../../recipes/src/personalization';
import { OffsetDateTimeSchema, CatalogIdSchema } from '../../domain/src/foundation';
import type { D1DatabaseBinding, D1PreparedStatement, D1Result } from './index';

const TrustedRankingScopeSchema = z.object({
  householdId: CatalogIdSchema,
  userId: CatalogIdSchema,
}).strict();

const UtcDateTimeSchema = OffsetDateTimeSchema.transform((value, ctx) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid timestamp' });
    return z.NEVER;
  }
  return date.toISOString();
});

const StoredPreferenceSchema = z.object({
  version: z.literal(1),
  values: RankingPreferencesSchema,
}).strict();

const PreferenceUpdateSchema = z.object({
  scope: z.enum(['household', 'user']),
  values: RankingPreferencesSchema,
  updatedAt: UtcDateTimeSchema,
}).strict();

const FeedbackWriteSchema = z.object({
  id: CatalogIdSchema,
  type: z.enum(['liked', 'disliked', 'skipped', 'swapped']),
  target: RecipeIdentitySchema,
  occurredAt: UtcDateTimeSchema,
  replacement: RecipeIdentitySchema.optional(),
}).strict().refine((value) => (value.type === 'swapped') === (value.replacement !== undefined),
  'Only swapped feedback requires a replacement');

const RankingWindowSchema = z.object({
  historyWindowDays: z.number().int().min(1).max(365).default(14),
  feedbackWindowDays: z.number().int().min(1).max(365).default(7),
}).passthrough();

const SqliteUtcTimestampSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/,
  'Invalid SQLite UTC timestamp',
);

type TrustedRankingScope = z.infer<typeof TrustedRankingScopeSchema>;
type FeedbackWrite = z.infer<typeof FeedbackWriteSchema>;

export class RankingContextAuthorizationError extends Error {
  readonly code = 'RANKING_CONTEXT_UNAUTHORIZED';

  constructor() {
    super('Ranking context is not authorized');
    this.name = 'RankingContextAuthorizationError';
  }
}

interface FeedbackRow {
  id: unknown;
  household_id: unknown;
  user_id: unknown;
  event_type: unknown;
  target_recipe_id: unknown;
  target_family_id: unknown;
  replacement_recipe_id: unknown;
  replacement_family_id: unknown;
  occurred_at: unknown;
  stored_occurred_at: unknown;
  family_id: unknown;
  cuisine: unknown;
}

function rowsFromResult(result: D1Result<unknown>, label: string): Record<string, unknown>[] {
  if (!result.success || !Array.isArray(result.results)) throw new Error(`Ranking ${label} read failed`);
  return result.results.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Ranking ${label} row is invalid`);
    return row as Record<string, unknown>;
  });
}

function parseStoredPreference(row: Record<string, unknown>, label: string): RankingPreferences {
  if (typeof row.values_json !== 'string') throw new Error(`Ranking ${label} preference JSON is invalid`);
  try {
    return StoredPreferenceSchema.parse(JSON.parse(row.values_json)).values;
  } catch {
    throw new Error(`Ranking ${label} preference JSON is invalid`);
  }
}

function identity(recipeId: unknown, familyId: unknown, label: string): { kind: 'recipe' | 'family'; id: string } {
  if (typeof recipeId === 'string' && familyId === null) return { kind: 'recipe', id: recipeId };
  if (recipeId === null && typeof familyId === 'string') return { kind: 'family', id: familyId };
  throw new Error(`Ranking ${label} identity is invalid`);
}

function isExplicitStoredUtcTimestamp(value: string, cookedHistory: boolean): boolean {
  const source = cookedHistory
    ? SqliteUtcTimestampSchema.safeParse(value)
    : UtcDateTimeSchema.safeParse(value);
  if (!source.success || (!cookedHistory && !value.endsWith('Z'))) return false;
  const instant = cookedHistory ? `${value.replace(' ', 'T')}Z` : value;
  const timestamp = new Date(instant);
  if (Number.isNaN(timestamp.getTime())) return false;
  const sourceSeconds = cookedHistory ? value.slice(0, 19).replace(' ', 'T') : value.slice(0, 19);
  return timestamp.toISOString().slice(0, 19) === sourceSeconds;
}

function feedbackFromRow(
  row: Record<string, unknown>,
  label: string,
  idPrefix?: 'feedback:' | 'cooked:',
): RecipeFeedback {
  const record = row as unknown as FeedbackRow;
  if (typeof record.stored_occurred_at === 'string') {
    if (!isExplicitStoredUtcTimestamp(record.stored_occurred_at, label === 'cooked history')) {
      throw new Error(`Ranking ${label} timestamp is not explicit UTC`);
    }
  } else if (idPrefix !== undefined) {
    throw new Error(`Ranking ${label} timestamp is invalid`);
  }
  const target = identity(record.target_recipe_id, record.target_family_id, `${label} target`);
  const replacement = record.event_type === 'swapped'
    ? identity(record.replacement_recipe_id, record.replacement_family_id, `${label} replacement`)
    : undefined;
  return RecipeFeedbackSchema.parse({
    id: idPrefix === undefined ? record.id : `${idPrefix}${String(record.id)}`,
    householdId: record.household_id,
    userId: record.user_id,
    type: record.event_type,
    target,
    occurredAt: record.occurred_at,
    replacement,
    familyId: record.family_id === null ? undefined : record.family_id,
    cuisine: record.cuisine === null ? undefined : record.cuisine,
  });
}

function scopedColumns(identityValue: { kind: 'recipe' | 'family'; id: string }): [string | null, string | null] {
  return identityValue.kind === 'recipe' ? [identityValue.id, null] : [null, identityValue.id];
}

function sameIdentity(
  left: { kind: 'recipe' | 'family'; id: string } | undefined,
  right: { kind: 'recipe' | 'family'; id: string } | undefined,
): boolean {
  return left?.kind === right?.kind && left?.id === right?.id;
}

function sameFeedback(left: RecipeFeedback, right: FeedbackWrite, scope: TrustedRankingScope): boolean {
  return left.householdId === scope.householdId && left.userId === scope.userId && left.type === right.type
    && sameIdentity(left.target, right.target) && sameIdentity(left.replacement, right.replacement)
    && left.occurredAt === right.occurredAt;
}

function assertWriteSucceeded(success: boolean): void {
  if (!success) throw new Error('Ranking persistence write failed');
}

function changeCount(meta: Record<string, unknown>): number {
  const changes = meta.changes;
  return typeof changes === 'number' && Number.isFinite(changes) ? changes : 0;
}

/**
 * Persists explicit ranking preferences without importing legacy global
 * user_preferences values. Any such import needs a reviewed, opt-in flow.
 */
export async function saveRankingPreferences(
  db: D1DatabaseBinding,
  trustedScope: unknown,
  rawInput: unknown,
): Promise<{ householdId: string; userId: string | null; values: RankingPreferences }> {
  const scope = TrustedRankingScopeSchema.parse(trustedScope);
  const input = PreferenceUpdateSchema.parse(rawInput);
  const stored = JSON.stringify({ version: 1, values: input.values });
  const result = input.scope === 'household'
    ? await db.prepare(
      `INSERT INTO household_ranking_preferences (household_id, values_json, updated_at)
       SELECT ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM household_members
         WHERE household_id = ? AND user_id = ? AND role = 'owner'
       )
       ON CONFLICT(household_id) DO UPDATE SET
         values_json = excluded.values_json, updated_at = excluded.updated_at`,
    ).bind(scope.householdId, stored, input.updatedAt, scope.householdId, scope.userId).run()
    : await db.prepare(
      `INSERT INTO member_ranking_preferences (household_id, user_id, values_json, updated_at)
       SELECT ?, ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?
       )
       ON CONFLICT(household_id, user_id) DO UPDATE SET
         values_json = excluded.values_json, updated_at = excluded.updated_at`,
    ).bind(scope.householdId, scope.userId, stored, input.updatedAt, scope.householdId, scope.userId).run();
  assertWriteSucceeded(result.success);
  if (changeCount(result.meta) !== 1) throw new Error('Ranking preference write is not authorized');
  return { householdId: scope.householdId, userId: input.scope === 'household' ? null : scope.userId, values: input.values };
}

/** Records personal feedback only; actual cooking remains the existing cooked_meals command. */
export async function recordRecipeFeedback(
  db: D1DatabaseBinding,
  trustedScope: unknown,
  rawInput: unknown,
): Promise<RecipeFeedback> {
  const scope = TrustedRankingScopeSchema.parse(trustedScope);
  const input = FeedbackWriteSchema.parse(rawInput);
  const [targetRecipeId, targetFamilyId] = scopedColumns(input.target);
  const [replacementRecipeId, replacementFamilyId] = input.replacement === undefined
    ? [null, null]
    : scopedColumns(input.replacement);
  const result = await db.prepare(
    `INSERT INTO recipe_feedback_events (
      id, household_id, user_id, event_type, target_recipe_id, target_family_id,
      replacement_recipe_id, replacement_family_id, occurred_at
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (
      SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?
    )
    ON CONFLICT(id) DO NOTHING`,
  ).bind(
    input.id, scope.householdId, scope.userId, input.type, targetRecipeId, targetFamilyId,
    replacementRecipeId, replacementFamilyId, input.occurredAt, scope.householdId, scope.userId,
  ).run();
  assertWriteSucceeded(result.success);
  if (changeCount(result.meta) === 1) {
    return RecipeFeedbackSchema.parse({ ...input, householdId: scope.householdId, userId: scope.userId });
  }

  const existingResult = await db.prepare(
    `SELECT e.id, e.household_id, e.user_id, e.event_type, e.target_recipe_id, e.target_family_id,
        e.replacement_recipe_id, e.replacement_family_id,
        strftime('%Y-%m-%dT%H:%M:%fZ', e.occurred_at) AS occurred_at,
        CASE WHEN e.target_family_id IS NOT NULL THEN e.target_family_id ELSE r.family_id END AS family_id,
        r.cuisine
     FROM recipe_feedback_events e
     JOIN household_members member ON member.household_id = e.household_id AND member.user_id = e.user_id
     LEFT JOIN recipes r ON r.id = e.target_recipe_id
     WHERE e.id = ? AND e.household_id = ? AND e.user_id = ?`,
  ).bind(input.id, scope.householdId, scope.userId).all();
  const rows = rowsFromResult(existingResult, 'feedback idempotency');
  if (rows.length !== 1) throw new Error('Ranking feedback write is not authorized or conflicts with another event');
  const existing = feedbackFromRow(rows[0], 'feedback idempotency');
  if (!sameFeedback(existing, input, scope)) throw new Error('Ranking feedback ID conflicts with a different event');
  return RecipeFeedbackSchema.parse({
    id: existing.id,
    householdId: existing.householdId,
    userId: existing.userId,
    type: existing.type,
    target: existing.target,
    occurredAt: existing.occurredAt,
    replacement: existing.replacement,
  });
}

export const RANKING_CONTEXT_READ_STATEMENT_COUNT = 6;

/** Builds the authorized ranking-context statements for a caller-owned coherent D1 batch. */
export function prepareRankingContextRead(
  db: D1DatabaseBinding,
  trustedScope: unknown,
  rawReferenceTime: unknown,
  rawWindows: unknown = {},
): D1PreparedStatement[] {
  const scope = TrustedRankingScopeSchema.parse(trustedScope);
  const referenceTime = UtcDateTimeSchema.parse(rawReferenceTime);
  const windowDays = typeof rawWindows === 'number'
    ? z.number().int().min(1).max(365).parse(rawWindows)
    : Math.max(...(() => {
      const windows = RankingWindowSchema.parse(rawWindows);
      return [windows.historyWindowDays, windows.feedbackWindowDays];
    })());
  const windowStart = new Date(new Date(referenceTime).getTime() - windowDays * 86_400_000).toISOString();
  return [
    db.prepare('SELECT 1 AS present FROM household_members WHERE household_id = ? AND user_id = ?')
      .bind(scope.householdId, scope.userId),
    db.prepare('SELECT values_json FROM household_ranking_preferences WHERE household_id = ?')
      .bind(scope.householdId),
    db.prepare('SELECT values_json FROM member_ranking_preferences WHERE household_id = ? AND user_id = ?')
      .bind(scope.householdId, scope.userId),
    db.prepare(
      `SELECT latest.id, latest.household_id, latest.user_id, latest.event_type,
          latest.target_recipe_id, latest.target_family_id,
          latest.replacement_recipe_id, latest.replacement_family_id,
          strftime('%Y-%m-%dT%H:%M:%fZ', latest.occurred_at) AS occurred_at,
          latest.occurred_at AS stored_occurred_at,
          CASE WHEN latest.target_family_id IS NOT NULL THEN latest.target_family_id ELSE recipe.family_id END AS family_id,
          recipe.cuisine
       FROM (
         SELECT e.*, ROW_NUMBER() OVER (
           PARTITION BY CASE WHEN e.target_recipe_id IS NOT NULL
             THEN 'recipe:' || e.target_recipe_id ELSE 'family:' || e.target_family_id END
           ORDER BY e.occurred_at DESC, e.id DESC
         ) AS row_number
         FROM recipe_feedback_events e
         WHERE e.household_id = ? AND e.user_id = ? AND e.event_type IN ('liked', 'disliked')
           AND (e.occurred_at NOT GLOB '????-??-??T??:??:??*Z' OR julianday(e.occurred_at) IS NULL
             OR julianday(e.occurred_at) <= julianday(?))
       ) latest
       LEFT JOIN recipes recipe ON recipe.id = latest.target_recipe_id
       WHERE row_number = 1
       ORDER BY latest.target_recipe_id, latest.target_family_id, latest.id`,
    ).bind(scope.householdId, scope.userId, referenceTime),
    db.prepare(
      `SELECT e.id, e.household_id, e.user_id, e.event_type, e.target_recipe_id, e.target_family_id,
          e.replacement_recipe_id, e.replacement_family_id,
          strftime('%Y-%m-%dT%H:%M:%fZ', e.occurred_at) AS occurred_at,
          e.occurred_at AS stored_occurred_at,
          CASE WHEN e.target_family_id IS NOT NULL THEN e.target_family_id ELSE recipe.family_id END AS family_id,
          recipe.cuisine
       FROM recipe_feedback_events e
       LEFT JOIN recipes recipe ON recipe.id = e.target_recipe_id
       WHERE e.household_id = ? AND e.user_id = ? AND e.event_type IN ('skipped', 'swapped')
         AND (e.occurred_at NOT GLOB '????-??-??T??:??:??*Z' OR julianday(e.occurred_at) IS NULL OR (julianday(e.occurred_at) >= julianday(?)
           AND julianday(e.occurred_at) <= julianday(?)))
       ORDER BY e.occurred_at DESC, e.id DESC`,
    ).bind(scope.householdId, scope.userId, windowStart, referenceTime),
    db.prepare(
      `SELECT cooked.id, cooked.household_id, cooked.user_id, 'cooked' AS event_type,
          cooked.recipe_id AS target_recipe_id, NULL AS target_family_id,
          NULL AS replacement_recipe_id, NULL AS replacement_family_id,
          strftime('%Y-%m-%dT%H:%M:%fZ', cooked.completed_at) AS occurred_at,
          cooked.completed_at AS stored_occurred_at,
          recipe.family_id, recipe.cuisine
       FROM cooked_meals cooked
       JOIN recipes recipe ON recipe.id = cooked.recipe_id
       WHERE cooked.household_id = ?
         AND (NOT ((cooked.completed_at GLOB '????-??-?? ??:??:??*' AND instr(cooked.completed_at, 'T') = 0)
           OR cooked.completed_at GLOB '????-??-??T??:??:??*Z') OR julianday(cooked.completed_at) IS NULL OR (julianday(cooked.completed_at) >= julianday(?)
           AND julianday(cooked.completed_at) <= julianday(?)))
       ORDER BY cooked.completed_at DESC, cooked.id DESC`,
    ).bind(scope.householdId, windowStart, referenceTime),
  ];
}

/** Maps exactly the ranking-context statement slice returned by {@link prepareRankingContextRead}. */
export function mapRankingContextRead(
  results: readonly D1Result<unknown>[],
  trustedScope: unknown,
): RankingContext {
  const scope = TrustedRankingScopeSchema.parse(trustedScope);
  if (results.length !== RANKING_CONTEXT_READ_STATEMENT_COUNT) {
    throw new Error('Ranking context batch returned an unexpected result count');
  }
  const [membership, householdPreference, memberPreference, tastes, recentFeedback, cooked] = results.map((result, index) =>
    rowsFromResult(result, ['membership', 'household preference', 'member preference', 'tastes', 'recent feedback', 'cooked history'][index]),
  );
  if (membership.length !== 1) throw new RankingContextAuthorizationError();
  if (householdPreference.length > 1 || memberPreference.length > 1) throw new Error('Ranking preference scope is ambiguous');

  const preferences = [
    ...householdPreference.map((row) => ({ householdId: scope.householdId, userId: null, values: parseStoredPreference(row, 'household') })),
    ...memberPreference.map((row) => ({ householdId: scope.householdId, userId: scope.userId, values: parseStoredPreference(row, 'member') })),
  ];
  const feedback = [
    ...tastes.map((row) => feedbackFromRow(row, 'taste feedback', 'feedback:')),
    ...recentFeedback.map((row) => feedbackFromRow(row, 'recent feedback', 'feedback:')),
    ...cooked.map((row) => feedbackFromRow(row, 'cooked history', 'cooked:')),
  ];
  return RankingContextSchema.parse({ householdId: scope.householdId, userId: scope.userId, preferences, feedback });
}

/**
 * Loads all authorized ranking inputs in one D1 batch. Cooked history remains
 * household-shared and is projected from cooked_meals; no duplicate cook event exists.
 * Pass a ranking profile (or its two window fields) to load the larger history/feedback window.
 */
export async function loadRankingContext(
  db: D1DatabaseBinding,
  trustedScope: unknown,
  rawReferenceTime: unknown,
  rawWindows: unknown = {},
): Promise<RankingContext> {
  return mapRankingContextRead(
    await db.batch(prepareRankingContextRead(db, trustedScope, rawReferenceTime, rawWindows)),
    trustedScope,
  );
}
