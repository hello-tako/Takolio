import { Hono } from 'hono';
import { Env, AuthContext } from '../types';
import { SQL, type D1PreparedStatement } from '@frigo/db';
import { FamilyPreferencesSchema } from '../../../packages/domain/src/family-preferences-api';
import { RankingPreferencesSchema } from '../../../packages/recipes/src/personalization';
import { dietaryTagsToForbiddenIngredients } from '../services/allergen-safety';
import { z } from 'zod';

export const preferencesRoutes = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

const DEFAULT_PREFERENCES = {
  householdSize: 2,
  spicyLevel: 'medium',
  favoriteCuisines: ['vietnamese'],
  dietaryRestrictions: [],
  language: 'vi',
};

const FAMILY_CUISINE_SET = new Set(['vietnamese', 'korean', 'japanese', 'chinese', 'thai', 'italian']);

function toFamilyCuisines(cuisines: string[]): Array<'vietnamese' | 'korean' | 'japanese' | 'chinese' | 'thai' | 'italian'> {
  const mapped: Array<'vietnamese' | 'korean' | 'japanese' | 'chinese' | 'thai' | 'italian'> = [];
  for (const raw of cuisines) {
    const normalized = raw === 'western' ? 'italian' : raw;
    if (FAMILY_CUISINE_SET.has(normalized) && !mapped.includes(normalized as any)) {
      mapped.push(normalized as any);
    }
  }
  return mapped.length > 0 ? mapped.slice(0, 6) : ['vietnamese'];
}

const PreferencesPatchSchema = z.object({
  householdSize: z.coerce.number().int().min(1).max(20).optional(),
  spicyLevel: z.enum(['none', 'mild', 'medium', 'hot']).optional(),
  favoriteCuisines: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  dietaryRestrictions: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  allergens: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  forbiddenIngredientIds: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
  language: z.enum(['vi', 'en']).optional(),
  completeOnboarding: z.boolean().optional(),
});

// GET /api/v1/preferences
preferencesRoutes.get('/preferences', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;

  if (db) {
    try {
      const [pref, rank] = await Promise.all([
        db.prepare(SQL.GET_USER_PREFERENCES).bind(auth.userId).first<any>(),
        auth.householdId
          ? db
              .prepare('SELECT values_json FROM member_ranking_preferences WHERE household_id = ? AND user_id = ? LIMIT 1')
              .bind(auth.householdId, auth.userId)
              .first<{ values_json: string }>()
          : Promise.resolve(null),
      ]);
      if (pref) {
        let allergens: string[] = [];
        let forbiddenIngredientIds: string[] = [];
        if (rank?.values_json) {
          try {
            const parsedRank = JSON.parse(rank.values_json)?.values;
            if (Array.isArray(parsedRank?.allergens)) allergens = parsedRank.allergens;
            if (Array.isArray(parsedRank?.forbiddenIngredientIds)) forbiddenIngredientIds = parsedRank.forbiddenIngredientIds;
          } catch {
            // ignore
          }
        }
        return c.json({
          preferences: {
            householdSize: pref.household_size,
            spicyLevel: pref.spicy_level,
            favoriteCuisines:
              typeof pref.favorite_cuisines === 'string'
                ? JSON.parse(pref.favorite_cuisines)
                : pref.favorite_cuisines,
            dietaryRestrictions:
              typeof pref.dietary_restrictions === 'string'
                ? JSON.parse(pref.dietary_restrictions)
                : pref.dietary_restrictions,
            allergens,
            forbiddenIngredientIds,
            language: pref.language,
          },
        });
      }
    } catch {
      console.error('Failed querying user_preferences from D1:');
    }
  }

  return c.json({ preferences: DEFAULT_PREFERENCES });
});

// PATCH /api/v1/preferences — Two-way synchronized with family_meal_preferences & member_ranking_preferences
preferencesRoutes.patch('/preferences', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'Database service unavailable' }, 503);
  }

  const parsed = PreferencesPatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Tùy chọn không hợp lệ', code: 'VALIDATION_ERROR' }, 400);
  }

  try {
    const existing = await db.prepare(SQL.GET_USER_PREFERENCES).bind(auth.userId).first<any>();

    const patch = parsed.data;
    const householdSize = patch.householdSize ?? existing?.household_size ?? 2;
    const spicyLevel = patch.spicyLevel ?? existing?.spicy_level ?? 'medium';
    const favoriteCuisines: string[] =
      patch.favoriteCuisines ?? (existing?.favorite_cuisines ? JSON.parse(existing.favorite_cuisines) : ['vietnamese']);
    const dietaryRestrictions: string[] =
      patch.dietaryRestrictions ??
      patch.allergens ??
      (existing?.dietary_restrictions ? JSON.parse(existing.dietary_restrictions) : []);
    const language = patch.language ?? existing?.language ?? 'vi';

    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO user_preferences (id, user_id, household_size, spicy_level, favorite_cuisines, dietary_restrictions, language, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(user_id) DO UPDATE SET
             household_size = excluded.household_size,
             spicy_level = excluded.spicy_level,
             favorite_cuisines = excluded.favorite_cuisines,
             dietary_restrictions = excluded.dietary_restrictions,
             language = excluded.language,
             updated_at = datetime('now')`
        )
        .bind(
          `pref_${auth.userId}`,
          auth.userId,
          householdSize,
          spicyLevel,
          JSON.stringify(favoriteCuisines),
          JSON.stringify(dietaryRestrictions),
          language
        ),
    ];

    // Two-way sync into family_meal_preferences + member_ranking_preferences when user belongs to household
    if (auth.householdId && auth.userId) {
      const existingFamily = await db
        .prepare(
          `SELECT fp.preferences_json, rk.values_json
             FROM household_members hm
             LEFT JOIN family_meal_preferences fp ON fp.household_id = hm.household_id AND fp.user_id = hm.user_id
             LEFT JOIN member_ranking_preferences rk ON rk.household_id = hm.household_id AND rk.user_id = hm.user_id
            WHERE hm.household_id = ? AND hm.user_id = ?
            LIMIT 1`
        )
        .bind(auth.householdId, auth.userId)
        .first<{ preferences_json: string | null; values_json: string | null }>();

      if (existingFamily) {
        const now = new Date().toISOString();
        const baseFamily = existingFamily.preferences_json
          ? FamilyPreferencesSchema.parse(JSON.parse(existingFamily.preferences_json))
          : FamilyPreferencesSchema.parse({});
        const mappedCuisines = toFamilyCuisines(favoriteCuisines);
        const nextFamily = FamilyPreferencesSchema.parse({
          ...baseFamily,
          householdSize,
          preferredCuisines: mappedCuisines,
        });
        const familyJson = JSON.stringify(nextFamily);

        const baseRanking = existingFamily.values_json
          ? RankingPreferencesSchema.parse(JSON.parse(existingFamily.values_json).values)
          : RankingPreferencesSchema.parse({});
        const derivedForbidden =
          patch.forbiddenIngredientIds !== undefined
            ? [...new Set(patch.forbiddenIngredientIds.map((id) => id.toUpperCase()))]
            : patch.dietaryRestrictions !== undefined
              ? dietaryTagsToForbiddenIngredients(dietaryRestrictions)
              : baseRanking.forbiddenIngredientIds;
        const nextAllergens =
          patch.allergens !== undefined
            ? [...new Set(patch.allergens.map((a) => a.trim().toLowerCase()).filter(Boolean))]
            : baseRanking.allergens;
        const nextRanking = RankingPreferencesSchema.parse({
          ...baseRanking,
          preferredCuisines: mappedCuisines,
          forbiddenIngredientIds: derivedForbidden,
          allergens: nextAllergens,
        });

        statements.push(
          db
            .prepare(
              `INSERT INTO family_meal_preferences (household_id, user_id, revision, preferences_json, updated_at)
               SELECT ?, ?, 1, ?, ?
                WHERE EXISTS (SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?)
               ON CONFLICT(household_id, user_id) DO UPDATE SET
                 revision = family_meal_preferences.revision + 1,
                 preferences_json = excluded.preferences_json,
                 updated_at = excluded.updated_at`
            )
            .bind(auth.householdId, auth.userId, familyJson, now, auth.householdId, auth.userId),
          db
            .prepare(
              `INSERT INTO member_ranking_preferences (household_id, user_id, values_json, updated_at)
               SELECT ?, ?, ?, ?
                WHERE EXISTS (SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?)
               ON CONFLICT(household_id, user_id) DO UPDATE SET
                 values_json = excluded.values_json,
                 updated_at = excluded.updated_at`
            )
            .bind(auth.householdId, auth.userId, JSON.stringify({ version: 1, values: nextRanking }), now, auth.householdId, auth.userId)
        );
      }
    }

    // Keep onboarding UPDATE last so results.at(-1)?.meta?.changes check remains exact!
    if (patch.completeOnboarding) {
      statements.push(
        db
          .prepare(
            "UPDATE profiles SET onboarding_completed_at = COALESCE(onboarding_completed_at, datetime('now')), updated_at = datetime('now') WHERE user_id = ?"
          )
          .bind(auth.userId)
      );
    }

    const results = await db.batch(statements);
    if (patch.completeOnboarding && results.at(-1)?.meta?.changes !== 1) {
      throw new Error('PROFILE_NOT_FOUND');
    }

    const updated = {
      householdSize,
      spicyLevel,
      favoriteCuisines,
      dietaryRestrictions,
      language,
    };

    return c.json({
      success: true,
      preferences: updated,
      onboardingCompleted: patch.completeOnboarding ? true : undefined,
    });
  } catch {
    console.error('Failed saving user_preferences to D1:');
    return c.json({ error: 'Lỗi cập nhật tùy chọn người dùng', code: 'DATABASE_ERROR' }, 500);
  }
});
