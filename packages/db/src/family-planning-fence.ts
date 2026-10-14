import { FamilyPreferencesSchema } from '../../domain/src/family-preferences-api';
import { canonicalJson } from '../../recipes/src/planner-context';
import { RankingPreferencesSchema } from '../../recipes/src/personalization';
import type { InventoryLotSnapshot } from '../../recipes/src/planner-inventory';
import type { D1DatabaseBinding, D1PreparedStatement } from './index';
import type { GeneratedMealPlanScope } from './meal-planning';

const CATALOG_COLUMNS = [
  ['recipes', ['id', 'slug', 'title', 'description', 'cuisine', 'servings', 'prep_time_minutes', 'cook_time_minutes', 'difficulty', 'family_id', 'source_type', 'source_reference', 'verification_state', 'version', 'tags']],
  ['recipe_ingredients', ['id', 'recipe_id', 'ingredient_id', 'name', 'required_quantity', 'unit', 'is_optional']],
  ['recipe_steps', ['id', 'recipe_id', 'step_number', 'instruction', 'tip', 'timer_minutes']],
  ['recipe_runtime_fields', ['recipe_id', 'runtime_order', 'category', 'region', 'legacy_calories', 'legacy_protein_g', 'legacy_fat_g', 'legacy_carb_g']],
  ['recipe_runtime_ingredient_order', ['recipe_ingredient_id', 'recipe_id', 'position']],
  ['recipe_classifications', ['recipe_id', 'kind', 'tag']],
  ['recipe_role_assignments', ['recipe_id', 'role', 'source', 'decision', 'confidence', 'reviewed']],
  ['recipe_nutrition', ['recipe_id', 'nutrition_profile_id']],
  ['nutrition_profiles', ['id', 'basis_quantity', 'basis_unit', 'source_type', 'source_reference', 'energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg']],
] as const;
export class FamilyPlanningInputChanged extends Error { constructor() { super('Family planning inputs changed'); } }
function receiptQuery(table: string, columns: readonly string[]) {
  return `SELECT json_group_array(json_array(${columns.join(', ')})) AS receipt FROM (SELECT ${columns.join(', ')} FROM ${table} ORDER BY ${columns.join(', ')})`;
}
export interface CatalogReceipt { query: string; value: string }
export async function readFamilyCatalogReceipts(db: D1DatabaseBinding): Promise<CatalogReceipt[]> {
  const queries = CATALOG_COLUMNS.map(([table, columns]) => receiptQuery(table, columns));
  const results = await db.batch<{ receipt: string }>(queries.map((query) => db.prepare(query)));
  if (results.some((result) => !result.success || result.results.length !== 1)) throw new Error('Family catalog fence read failed');
  return queries.map((query, index) => ({ query, value: results[index].results[0].receipt }));
}
export interface FamilyPlanningFence {
  inventory: readonly InventoryLotSnapshot[]; memberJson: string | null; householdJson: string | null;
  profileRevision: number; profileJson: string | null; catalog: CatalogReceipt[];
}
export async function readFamilyPreferenceFence(db: D1DatabaseBinding, scope: GeneratedMealPlanScope) {
  const [member, household, profile] = await db.batch<{ values_json?: string; revision?: number; preferences_json?: string }>([
    db.prepare('SELECT values_json FROM member_ranking_preferences WHERE household_id = ? AND user_id = ?').bind(scope.householdId, scope.userId),
    db.prepare('SELECT values_json FROM household_ranking_preferences WHERE household_id = ?').bind(scope.householdId),
    db.prepare('SELECT revision, preferences_json FROM family_meal_preferences WHERE household_id = ? AND user_id = ?').bind(scope.householdId, scope.userId),
  ]);
  if (![member, household, profile].every((result) => result.success)) throw new Error('Family preference fence read failed');
  return { memberJson: member.results[0]?.values_json ?? null, householdJson: household.results[0]?.values_json ?? null,
    profileRevision: profile.results[0]?.revision ?? 0, profileJson: profile.results[0]?.preferences_json ?? null };
}
export function assertFamilyPreferenceSnapshot(fence: Awaited<ReturnType<typeof readFamilyPreferenceFence>>, scope: GeneratedMealPlanScope,
  preferences: readonly { userId: string | null; values: unknown }[], profileRevision: number, profilePreferences: unknown) {
  const rows = [fence.householdJson ? { userId: null, values: RankingPreferencesSchema.parse(JSON.parse(fence.householdJson).values) } : null,
    fence.memberJson ? { userId: scope.userId, values: RankingPreferencesSchema.parse(JSON.parse(fence.memberJson).values) } : null]
    .filter((entry) => entry !== null);
  const sorted = (entries: readonly { userId: string | null; values: unknown }[]) => entries.map(({ userId, values }) => ({ userId, values })).sort((a, b) => (a.userId ?? '').localeCompare(b.userId ?? ''));
  const member = RankingPreferencesSchema.parse(rows.find((entry) => entry.userId === scope.userId)?.values ?? {});
  const storedProfile = { ...FamilyPreferencesSchema.parse(fence.profileJson ? JSON.parse(fence.profileJson) : {}),
    forbiddenIngredientIds: member.forbiddenIngredientIds, allergens: member.allergens };
  const suppliedProfile = FamilyPreferencesSchema.parse(profilePreferences);
  const normalizedProfile = { ...suppliedProfile, forbiddenIngredientIds: suppliedProfile.forbiddenIngredientIds ?? [],
    allergens: suppliedProfile.allergens ?? [] };
  if (canonicalJson(sorted(rows)) !== canonicalJson(sorted(preferences)) || fence.profileRevision !== profileRevision
    || canonicalJson(storedProfile) !== canonicalJson(normalizedProfile)) throw new FamilyPlanningInputChanged();
}
/** SQL JSON witnesses keep bind counts constant even with 1,000 inventory lots or 500 catalog recipes. */
export function familyPlanningFenceStatements(db: D1DatabaseBinding, scope: GeneratedMealPlanScope, fence: FamilyPlanningFence): D1PreparedStatement[] {
  const inventory = fence.inventory.map((lot) => ({ id: lot.id, version: lot.version, ingredientId: lot.ingredientId, quantity: lot.quantity,
    unit: lot.unit, freshness: lot.freshness, expiryDate: lot.expiryDate, expiryKind: lot.expiryKind, storage: lot.storage ?? null,
    openedAt: lot.openedAt ?? null, expirySource: lot.expirySource ?? null, addedDate: lot.addedDate ?? null, updatedAt: lot.updatedAt ?? null }));
  const condition = `(SELECT COUNT(1) FROM inventory_items WHERE household_id = ?) = json_array_length(?)
    AND NOT EXISTS (SELECT 1 FROM json_each(?) witness WHERE NOT EXISTS (SELECT 1 FROM inventory_items lot
      WHERE lot.household_id = ? AND lot.id = json_extract(witness.value, '$.id') AND lot.version = json_extract(witness.value, '$.version')
        AND COALESCE(lot.ingredient_id, '') = json_extract(witness.value, '$.ingredientId') AND lot.quantity = json_extract(witness.value, '$.quantity')
        AND lot.unit = json_extract(witness.value, '$.unit') AND lot.freshness IS json_extract(witness.value, '$.freshness')
        AND lot.expiry_date IS json_extract(witness.value, '$.expiryDate') AND lot.expiry_kind = json_extract(witness.value, '$.expiryKind')
        AND lot.storage IS json_extract(witness.value, '$.storage') AND lot.opened_at IS json_extract(witness.value, '$.openedAt')
        AND lot.expiry_source IS json_extract(witness.value, '$.expirySource') AND lot.added_date IS json_extract(witness.value, '$.addedDate')
        AND lot.updated_at IS json_extract(witness.value, '$.updatedAt')))
    AND (SELECT values_json FROM member_ranking_preferences WHERE household_id = ? AND user_id = ?) IS ?
    AND (SELECT values_json FROM household_ranking_preferences WHERE household_id = ?) IS ?
    AND COALESCE((SELECT revision FROM family_meal_preferences WHERE household_id = ? AND user_id = ?), 0) = ?
    AND (SELECT preferences_json FROM family_meal_preferences WHERE household_id = ? AND user_id = ?) IS ?`;
  const guard = (predicate: string) => `INSERT INTO generated_meal_plan_compositions
    (plan_id, household_id, creator_user_id, slot_id, mode, created_revision, updated_revision)
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL WHERE NOT (${predicate})`;
  const json = JSON.stringify(inventory);
  return [db.prepare(guard(condition)).bind(scope.householdId, json, json, scope.householdId, scope.householdId, scope.userId,
    fence.memberJson, scope.householdId, fence.householdJson, scope.householdId, scope.userId, fence.profileRevision,
    scope.householdId, scope.userId, fence.profileJson), ...fence.catalog.map((receipt) => db.prepare(guard(`(${receipt.query}) IS ?`)).bind(receipt.value))];
}
