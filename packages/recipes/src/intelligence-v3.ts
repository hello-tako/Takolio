import { z } from 'zod';
import { RefreshRecipeSchema } from './refresh/schema';
import { runtimeExclusionFromSource } from './refresh/compiler';
import { deriveRefreshReleaseEligibility } from './refresh/release';
import { RuntimeRecipeSchema, stableRuntimeJson } from './runtime-recipe';

export const V3_COMPILER_VERSION = 1;
export const V3_EDITABLE_PATH = /^\/(?:steps\/(?:0|[1-9]\d*)\/(?:instruction|tip|timerMinutes)|ingredients\/(?:0|[1-9]\d*)\/note|content\/(?:description|cookTimeMinutes|difficulty|category|region))$/u;

const EditValueSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
export const V3EditsSchema = z.object({
  schemaVersion: z.literal(1),
  edits: z.array(z.object({
    recipeId: z.string().min(1),
    path: z.string().regex(V3_EDITABLE_PATH),
    oldValue: EditValueSchema,
    newValue: EditValueSchema,
    reason: z.string().trim().min(1),
    evidenceReferences: z.array(z.string().trim().min(1)).min(1),
  }).strict()),
}).strict();

export type V3Edit = z.infer<typeof V3EditsSchema>['edits'][number];

export class V3ValidationError extends Error {
  constructor(readonly code: string, readonly recipeId: string) {
    super(`${code}: ${recipeId}`);
  }
}

function assertFiniteNumbers(value: unknown): void {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('NON_FINITE_NUMBER');
  if (value !== null && typeof value === 'object') for (const child of Object.values(value)) assertFiniteNumbers(child);
}

export async function v3Fingerprint(value: unknown): Promise<string> {
  assertFiniteNumbers(value);
  const bytes = new TextEncoder().encode(stableRuntimeJson(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function assertSequence(recipe: z.infer<typeof RefreshRecipeSchema>): void {
  if (recipe.ingredients.length === 0 || recipe.ingredients.some((ingredient, index) => ingredient.position !== index)) {
    throw new V3ValidationError('INGREDIENT_POSITION_INVALID', recipe.identity.id);
  }
  if (recipe.steps.some((step, index) => step.stepNumber !== index + 1)) {
    throw new V3ValidationError('STEP_SEQUENCE_INVALID', recipe.identity.id);
  }
}

export async function compileV3Candidate(runtimeInput: unknown, sourceInput: unknown, editInput: unknown = []) {
  const runtime = RuntimeRecipeSchema.parse(runtimeInput);
  const source = RefreshRecipeSchema.parse(sourceInput);
  if (stableRuntimeJson(source) !== stableRuntimeJson(sourceInput)) throw new V3ValidationError('SOURCE_NOT_CANONICAL', source.identity.id);
  const sourceV1Fingerprint = await v3Fingerprint(runtime);
  const sourceV2Fingerprint = await v3Fingerprint(source);
  const edits = V3EditsSchema.parse({ schemaVersion: 1, edits: editInput }).edits;
  if (runtime.id !== source.identity.id) throw new V3ValidationError('RECIPE_ID_MISMATCH', source.identity.id);
  if (runtime.slug !== source.identity.slug) throw new V3ValidationError('RECIPE_SLUG_MISMATCH', source.identity.id);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(source.identity.id)) throw new V3ValidationError('RECIPE_ID_INVALID', source.identity.id);
  assertSequence(source);
  const content = structuredClone(source);
  const seen = new Set<string>();
  for (const edit of edits) {
    if (edit.recipeId !== source.identity.id) throw new V3ValidationError('RECIPE_ID_MISMATCH', edit.recipeId);
    if (seen.has(edit.path)) throw new V3ValidationError('DUPLICATE_EDIT_PATH', edit.recipeId);
    seen.add(edit.path);
    const keys = edit.path.slice(1).split('/');
    let target: Record<string, unknown> = content as unknown as Record<string, unknown>;
    for (const key of keys.slice(0, -1)) {
      if (!Object.hasOwn(target, key) || target[key] === null || typeof target[key] !== 'object') throw new V3ValidationError('EDIT_PATH_INVALID', edit.recipeId);
      target = target[key] as Record<string, unknown>;
    }
    const key = keys[keys.length - 1];
    if (!Object.hasOwn(target, key) || stableRuntimeJson(target[key]) !== stableRuntimeJson(edit.oldValue)) {
      throw new V3ValidationError('EDIT_SOURCE_MISMATCH', edit.recipeId);
    }
    if (stableRuntimeJson(edit.oldValue) === stableRuntimeJson(edit.newValue)) throw new V3ValidationError('EDIT_HAS_NO_CHANGE', edit.recipeId);
    target[key] = edit.newValue;
  }
  const candidate = RefreshRecipeSchema.parse(content);
  if (stableRuntimeJson(candidate) !== stableRuntimeJson(content)) throw new V3ValidationError('EDIT_VALUE_NOT_CANONICAL', source.identity.id);
  assertSequence(candidate);
  const candidateContentFingerprint = await v3Fingerprint(candidate);
  const eligibility = deriveRefreshReleaseEligibility([candidate]);
  const sourceVerified = candidate.research.sources.filter((entry) => entry.role === 'declared' && entry.verification === 'content_verified').length;
  const exclusions = candidate.ingredients.map(runtimeExclusionFromSource).filter((entry) => entry !== null);
  const issues = [
    ...(eligibility.blockers.includes('INGREDIENT_RECONCILIATION_INCOMPLETE') ? ['INGREDIENT_ID_UNRESOLVED'] : []),
    ...(candidate.ingredients.some((line) => line.quantity.runtime === null) ? ['UNSUPPORTED_OR_QUALITATIVE_RUNTIME_QUANTITY'] : []),
    ...(candidate.ingredients.some((line) => line.quantity.evidence === 'estimated') ? ['QUANTITY_CONVERSION_UNVERIFIED'] : []),
    ...(eligibility.blockers.includes('SOURCE_CONTENT_VERIFICATION_INCOMPLETE') ? ['SOURCE_CONTENT_UNVERIFIED'] : []),
    ...(eligibility.blockers.includes('NUTRITION_EVIDENCE_INCOMPLETE') ? ['NUTRITION_EVIDENCE_INSUFFICIENT'] : []),
    ...(eligibility.blockers.includes('RUNTIME_PROJECTION_LOSS') ? ['RUNTIME_PROJECTION_LOSS'] : []),
    'INGREDIENT_STEP_REVIEW_REQUIRED',
    'ALLERGEN_EVIDENCE_UNKNOWN',
    'USER_SNAPSHOT_COMPATIBILITY_RISK',
    'INDEPENDENT_REVIEW_REQUIRED',
  ].sort();
  return {
    metadata: {
      schemaVersion: 3,
      compilerVersion: V3_COMPILER_VERSION,
      recipeId: candidate.identity.id,
      slug: candidate.identity.slug,
      sourceV1Fingerprint,
      sourceV2Fingerprint,
      candidateVersion: `v3-candidate-${candidateContentFingerprint}`,
      previousVersion: `v2-source-${sourceV2Fingerprint}`,
      candidateContentFingerprint,
      sourceReference: `data/recipe-refresh/v2/recipes/${candidate.identity.id}.json`,
      sourcePreserved: true,
      state: 'NEEDS_REVIEW' as const,
      humanApproved: false as const,
      runtimePromotionAllowed: false as const,
      ingredientLines: candidate.ingredients.length,
      steps: candidate.steps.length,
      sourceContentVerified: sourceVerified,
      nutritionState: candidate.nutrition.certification,
      runtimeExclusions: exclusions,
      issues,
      edits,
    },
    // ponytail: existing editorial fields only; add structural/absent-field edits after evidence and compatibility review.
    content: candidate,
  };
}
