import { z } from 'zod';
import type { D1DatabaseBinding, D1PreparedStatement } from './index';
import { FamilyMealPolicySchema, FamilyMealDiagnosticsSchema } from '../../domain/src/family-meal-planning-api';
import { ComponentIdSchema, ComponentProvenanceSchema, CompositionModeSchema, MealRoleSchema } from '../../domain/src/meal-composition-api';
import { canonicalGeneratedMealPlanPayload, findGeneratedMealPlanByRequest, getGeneratedMealPlan,
  GeneratedMealPlanPersistenceError, type CreateGeneratedMealPlanInput, type GeneratedMealPlanScope } from './meal-planning';
import { FamilyPlanningInputChanged } from './family-planning-fence';
import type { CompositionSlotWrite } from './meal-composition';

export interface FamilyPlanMetadataWrite {
  profileRevision: number; profileFingerprint: string;
  policy: z.infer<typeof FamilyMealPolicySchema>; diagnostics: z.infer<typeof FamilyMealDiagnosticsSchema>;
}
const MetadataSchema = z.object({
  profile_revision: z.number().int().safe().nonnegative(), profile_fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  policy_json: z.string(), diagnostics_json: z.string(),
}).strict();
export async function readFamilyPlanMetadata(db: D1DatabaseBinding, scope: GeneratedMealPlanScope, planId: string) {
  const row = await db.prepare(`SELECT meta.profile_revision, meta.profile_fingerprint, meta.policy_json, meta.diagnostics_json
    FROM generated_family_meal_plans meta JOIN generated_meal_plans plan ON plan.id = meta.plan_id
    JOIN household_members member ON member.household_id = plan.household_id AND member.user_id = plan.creator_user_id
    WHERE plan.id = ? AND plan.household_id = ? AND plan.creator_user_id = ?
      AND meta.household_id = plan.household_id AND meta.creator_user_id = plan.creator_user_id`)
    .bind(planId, scope.householdId, scope.userId).first<unknown>();
  if (!row) return null;
  const metadata = MetadataSchema.parse(row);
  return { profileRevision: metadata.profile_revision, profileFingerprint: metadata.profile_fingerprint,
    policy: FamilyMealPolicySchema.parse(JSON.parse(metadata.policy_json)),
    diagnostics: FamilyMealDiagnosticsSchema.parse(JSON.parse(metadata.diagnostics_json)) };
}
export function familyMetadataUpdateStatement(db: D1DatabaseBinding, scope: GeneratedMealPlanScope, planId: string,
  metadata: FamilyPlanMetadataWrite): D1PreparedStatement {
  return db.prepare(`UPDATE generated_family_meal_plans SET profile_revision = ?, profile_fingerprint = ?, policy_json = ?,
    diagnostics_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE plan_id = ? AND household_id = ? AND creator_user_id = ?`).bind(metadata.profileRevision, metadata.profileFingerprint,
    JSON.stringify(FamilyMealPolicySchema.parse(metadata.policy)), JSON.stringify(FamilyMealDiagnosticsSchema.parse(metadata.diagnostics)),
    planId, scope.householdId, scope.userId);
}

/** The plan, every composition and its V2 policy receipt commit in one D1 transaction. */
export async function createFamilyMealPlan(db: D1DatabaseBinding, scope: GeneratedMealPlanScope,
  input: CreateGeneratedMealPlanInput, slots: readonly CompositionSlotWrite[], metadata: FamilyPlanMetadataWrite,
  fences: readonly D1PreparedStatement[] = []) {
  const policy = FamilyMealPolicySchema.parse(metadata.policy);
  const diagnostics = FamilyMealDiagnosticsSchema.parse(metadata.diagnostics);
  z.string().regex(/^[0-9a-f]{64}$/).parse(input.requestFingerprint);
  z.string().regex(/^[0-9a-f]{64}$/).parse(metadata.profileFingerprint);
  const statements: D1PreparedStatement[] = [...fences, db.prepare(`INSERT INTO generated_meal_plans
    (id, household_id, creator_user_id, request_key, request_fingerprint, intent_json, result_json, source_json)
    SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?)
    ON CONFLICT(household_id, creator_user_id, request_key) DO NOTHING`).bind(input.id, scope.householdId, scope.userId,
    input.requestKey, input.requestFingerprint, canonicalGeneratedMealPlanPayload(input.intentJson, 'intent'),
    canonicalGeneratedMealPlanPayload(input.resultJson, 'result'), canonicalGeneratedMealPlanPayload(input.sourceJson, 'source'),
    scope.householdId, scope.userId)];
  const owned = `SELECT id FROM generated_meal_plans WHERE id = ? AND household_id = ? AND creator_user_id = ?
    AND request_key = ? AND request_fingerprint = ?`;
  const bindings = [input.id, scope.householdId, scope.userId, input.requestKey, input.requestFingerprint];
  statements.push(db.prepare(`INSERT INTO generated_family_meal_plans
    (plan_id, household_id, creator_user_id, schema_version, profile_revision, profile_fingerprint, policy_json, diagnostics_json,
      created_at, updated_at)
    SELECT id, ?, ?, 2, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    FROM (${owned}) WHERE 1 ON CONFLICT(plan_id) DO NOTHING`).bind(scope.householdId, scope.userId, metadata.profileRevision,
    metadata.profileFingerprint, JSON.stringify(policy), JSON.stringify(diagnostics), ...bindings));
  for (const slot of slots) {
    if (slot.components.length > 8) throw new Error('Composition exceeds component limit');
    statements.push(db.prepare(`INSERT INTO generated_meal_plan_compositions
      (plan_id, household_id, creator_user_id, slot_id, mode, created_revision, updated_revision)
      SELECT id, ?, ?, ?, ?, 1, 1 FROM (${owned}) WHERE 1 ON CONFLICT(plan_id, slot_id) DO NOTHING`)
      .bind(scope.householdId, scope.userId, slot.slotId, CompositionModeSchema.parse(slot.mode), ...bindings));
    for (const component of slot.components) statements.push(db.prepare(`INSERT INTO generated_meal_plan_components
      (plan_id, id, slot_id, ordinal, kind, role, recipe_id, simple_food_id, locked, provenance, created_revision, updated_revision)
      SELECT id, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1 FROM (${owned}) WHERE 1 ON CONFLICT(plan_id, id) DO NOTHING`)
      .bind(ComponentIdSchema.parse(component.id), slot.slotId, component.ordinal, component.kind, MealRoleSchema.parse(component.role),
        component.recipeId, component.simpleFoodId, component.locked ? 1 : 0, ComponentProvenanceSchema.parse(component.provenance), ...bindings));
  }
  let results;
  try { results = await db.batch(statements); }
  catch (error) {
    if (fences.length && error instanceof Error && error.message.includes('NOT NULL constraint failed: generated_meal_plan_compositions')) {
      throw new FamilyPlanningInputChanged();
    }
    throw error;
  }
  if (results.some((result) => !result.success)) throw new Error('Family plan transaction failed');
  const prior = await findGeneratedMealPlanByRequest(db, scope, input.requestKey);
  if (!prior) return getGeneratedMealPlan(db, scope, input.id);
  if (prior.requestFingerprint !== input.requestFingerprint) throw new GeneratedMealPlanPersistenceError('IDEMPOTENCY_CONFLICT');
  return prior;
}
