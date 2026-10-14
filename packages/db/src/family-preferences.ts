import { FamilyPreferencesDtoSchema, FamilyPreferencesSchema, SaveFamilyPreferencesSchema, type FamilyPreferencesDto } from '../../domain/src/family-preferences-api';
import { RankingPreferencesSchema } from '../../recipes/src/personalization';
import type { D1DatabaseBinding } from './index';

export interface FamilyPreferenceScope { householdId: string; userId: string }
export class FamilyPreferenceError extends Error {
  constructor(readonly code: 'FORBIDDEN' | 'REVISION_CONFLICT', readonly status: 403 | 409) { super(code); }
}

export async function readFamilyPreferences(db: D1DatabaseBinding, scope: FamilyPreferenceScope): Promise<FamilyPreferencesDto> {
  const result = await db.prepare(`SELECT fp.revision, fp.preferences_json, ranking.values_json
    FROM household_members hm LEFT JOIN family_meal_preferences fp
      ON fp.household_id = hm.household_id AND fp.user_id = hm.user_id
    LEFT JOIN member_ranking_preferences ranking ON ranking.household_id=hm.household_id AND ranking.user_id=hm.user_id
    WHERE hm.household_id = ? AND hm.user_id = ?`).bind(scope.householdId, scope.userId)
    .first<{ revision: number | null; preferences_json: string | null; values_json:string|null }>();
  if (!result) throw new FamilyPreferenceError('FORBIDDEN', 403);
  const ranking=result.values_json ? RankingPreferencesSchema.parse(JSON.parse(result.values_json).values) : RankingPreferencesSchema.parse({});
  const preferences=result.preferences_json ? FamilyPreferencesSchema.parse(JSON.parse(result.preferences_json)) : FamilyPreferencesSchema.parse({});
  return FamilyPreferencesDtoSchema.parse({ revision: result.revision ?? 0,
    preferences: {...preferences,forbiddenIngredientIds:ranking.forbiddenIngredientIds,allergens:ranking.allergens} });
}

export async function saveFamilyPreferences(db: D1DatabaseBinding, scope: FamilyPreferenceScope,
  input: unknown): Promise<FamilyPreferencesDto> {
  const { expectedRevision, preferences } = SaveFamilyPreferencesSchema.parse(input);
  await readFamilyPreferences(db, scope);
  const json = JSON.stringify(preferences);
  const now = new Date().toISOString();
  const soft = { preferredCuisines: preferences.preferredCuisines, dislikedIngredientIds: preferences.dislikedIngredientIds,
    preferredTimeMinutes: preferences.preferredTimeMinutes };
  const initialRanking = JSON.stringify({ version: 1, values: RankingPreferencesSchema.parse({...soft,forbiddenIngredientIds:preferences.forbiddenIngredientIds,allergens:preferences.allergens}) });
  try {
    const results = await db.batch([
      db.prepare(`INSERT INTO family_meal_preferences(household_id,user_id,revision,preferences_json,updated_at)
        SELECT ?, ?, ? + 1, ?, ?
        WHERE EXISTS(SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?)
          AND (? = 0 OR EXISTS(SELECT 1 FROM family_meal_preferences WHERE household_id = ? AND user_id = ?))
        ON CONFLICT(household_id,user_id) DO UPDATE SET
          revision = CASE WHEN family_meal_preferences.revision = ? THEN family_meal_preferences.revision + 1 ELSE -1 END,
          preferences_json = excluded.preferences_json, updated_at = excluded.updated_at`)
        .bind(scope.householdId, scope.userId, expectedRevision, json, now, scope.householdId, scope.userId, expectedRevision, scope.householdId, scope.userId, expectedRevision),
      db.prepare(`INSERT INTO member_ranking_preferences(household_id,user_id,values_json,updated_at)
        SELECT ?, ?, ?, ? WHERE EXISTS(SELECT 1 FROM family_meal_preferences
          WHERE household_id = ? AND user_id = ? AND revision = ? AND preferences_json = ?)
        ON CONFLICT(household_id,user_id) DO UPDATE SET values_json = json_set(member_ranking_preferences.values_json,
          '$.values.preferredCuisines', json(?), '$.values.dislikedIngredientIds', json(?), '$.values.preferredTimeMinutes', ?,
          '$.values.forbiddenIngredientIds', json(CASE WHEN ? IS NULL THEN COALESCE(json_extract(member_ranking_preferences.values_json,'$.values.forbiddenIngredientIds'),'[]') ELSE ? END),
          '$.values.allergens', json(CASE WHEN ? IS NULL THEN COALESCE(json_extract(member_ranking_preferences.values_json,'$.values.allergens'),'[]') ELSE ? END)),
          updated_at = excluded.updated_at`)
        .bind(scope.householdId, scope.userId, initialRanking, now, scope.householdId, scope.userId, expectedRevision + 1, json,
          JSON.stringify(soft.preferredCuisines), JSON.stringify(soft.dislikedIngredientIds), soft.preferredTimeMinutes,
          preferences.forbiddenIngredientIds===undefined?null:JSON.stringify(preferences.forbiddenIngredientIds),preferences.forbiddenIngredientIds===undefined?null:JSON.stringify(preferences.forbiddenIngredientIds),
          preferences.allergens===undefined?null:JSON.stringify(preferences.allergens),preferences.allergens===undefined?null:JSON.stringify(preferences.allergens)),
    ]);
    if (results.some((result) => !result.success)) throw new Error('Preference batch failed');
    if (results[0].meta.changes !== 1) {
      await readFamilyPreferences(db, scope);
      throw new FamilyPreferenceError('REVISION_CONFLICT', 409);
    }
  } catch (error) {
    if (error instanceof FamilyPreferenceError) throw error;
    const current = await readFamilyPreferences(db, scope);
    if (current.revision !== expectedRevision) throw new FamilyPreferenceError('REVISION_CONFLICT', 409);
    throw error;
  }
  return readFamilyPreferences(db,scope);
}
