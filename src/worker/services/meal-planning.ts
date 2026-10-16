import { z } from 'zod';
import type { D1DatabaseBinding } from '../../../packages/db/src/index';
import {
  createGeneratedMealPlan,
  getGeneratedMealPlan,
  findGeneratedMealPlanByRequest,
  findCurrentGeneratedMealPlan,
  updateGeneratedMealPlan,
  recordCookedGeneratedMealPlanAnnotation,
  type GeneratedMealPlanRecord,
} from '../../../packages/db/src/meal-planning';
import { recipeAuthoritySnapshotIsCurrent } from './recipe-authority';
import { loadMealPlanningSnapshot } from '../../../packages/db/src/meal-planning-snapshot';
import type { RecipeAuthoritySnapshot } from '../../../packages/recipes/src/recipe-authority';
import {
  MealPlanningIntentSchema,
  MealPlanDtoSchema,
  PlanResultDtoSchema,
  PlanSourceIdentitySchema,
  PlanFeedbackDtoSchema,
  PlanShoppingDtoSchema,
  type MealPlanningIntent,
  type MealPlanDto,
  type RegenerateMealPlanSchema,
  type SwapMealSchema,
  type OptimizePlanShoppingSchema,
  type PlanFeedbackSchema,
} from '../../../packages/domain/src/meal-planning-api';
import {
  createPlanningContext,
  canonicalJson,
  readPlanningContext,
  planningReference,
} from '../../../packages/recipes/src/planner-context';
import {
  normalizePlannerRequest,
  PlannerLockSchema,
} from '../../../packages/recipes/src/planner-request';
import { projectInventoryRows } from '../../../packages/recipes/src/planner-inventory';
import { planWeeklyMeals } from '../../../packages/recipes/src/weekly-planner';
import {
  createShoppingContext,
  type PurchaseOption,
} from '../../../packages/recipes/src/shopping-catalog';
import { optimizeShopping } from '../../../packages/recipes/src/shopping-optimizer';
import {
  projectShoppingMealPlan,
  ShoppingMealPlanSnapshotSchema,
} from '../../../packages/recipes/src/shopping-plan-snapshot';
import { mapPlanResultDto } from './meal-planning-dto';
import { toShoppingResultDto } from './meal-shopping-dto';
import { recordPlanningTaste } from './meal-planning-feedback';
import { MealPlanningError } from './meal-planning-error';
import { sha256Hex } from '../utils/session';
import {
  CurrentMealPlanDtoSchema,
  PlanAlternativesDtoSchema,
  PLAN_ALTERNATIVES_LIMIT,
  type PlanExplanationRequest,
} from '../../../packages/domain/src/meal-planning-presentation';
import { explainMealReasons, type ExplanationTransport } from './meal-planning-explanation';
import {
  planHasCompositions,
  readPlanCompositions,
  readRoleAssignments,
  writePlanCompositions,
} from '../../../packages/db/src/meal-composition';
import { MealCompositionService, roleIndexFor } from './meal-composition';
import { familyMealRoles, familyMealRolesForComponents, planFamilyMeals, type FamilyPlanningResult } from '../../../packages/recipes/src/composition/family-planner';
import { compositionShoppingSnapshot, evaluationScope, projectCompositions } from '../../../packages/recipes/src/composition/projection';
import { readFamilyPreferences } from '../../../packages/db/src/family-preferences';
import { FamilyPreferencesSchema, type FamilyPreferences } from '../../../packages/domain/src/family-preferences-api';
import { FamilyMealPlanDtoSchema, CurrentFamilyMealPlanDtoSchema, type FamilyMealPlanDto } from '../../../packages/domain/src/family-meal-planning-api';
import { assertFamilyPreferenceSnapshot, familyPlanningFenceStatements, FamilyPlanningInputChanged, readFamilyCatalogReceipts,
  readFamilyPreferenceFence } from '../../../packages/db/src/family-planning-fence';
import { createFamilyMealPlan, familyMetadataUpdateStatement, readFamilyPlanMetadata, type FamilyPlanMetadataWrite } from '../../../packages/db/src/family-meal-planning';

type Scope = { householdId: string; userId: string };
type Snapshot = Awaited<ReturnType<typeof loadMealPlanningSnapshot>>;
const LockEntrySchema = z.object({ slotId: z.string(), lock: PlannerLockSchema }).strict();
const StoredIntentSchema = z
  .object({ intent: MealPlanningIntentSchema, locks: z.array(LockEntrySchema) })
  .strict();
const StoredResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    result: PlanResultDtoSchema,
    shoppingPlan: ShoppingMealPlanSnapshotSchema,
    lastSwap: z
      .object({
        slotId: z.string(),
        previous: PlanSourceIdentitySchema,
        replacement: PlanSourceIdentitySchema,
      })
      .strict()
      .nullable(),
  })
  .strict();
const StoredAuthoritySchema = z
  .object({
    source: z.enum(['static', 'd1']),
    fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    recipeCount: z.number().int().nonnegative(),
  })
  .strict();
// `authority` is absent on plans persisted before T19; those revalidate through the catalog fingerprint alone.
const FingerprintsSchema = z
  .object({
    inventory: z.string(),
    preferences: z.string(),
    catalog: z.string(),
    history: z.string(),
    authority: StoredAuthoritySchema.optional(),
  })
  .strict();
const envelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ version: z.literal(1), data }).strict();
const serialize = (data: object) => JSON.stringify({ version: 1, data });

export interface MealPlanningServiceOptions {
  now?: () => Date;
  explanationTransport?: ExplanationTransport;
  purchaseCatalog?: (
    scope: Scope,
    asOf: string,
  ) => Promise<{
    snapshotId: string;
    options: readonly PurchaseOption[];
    status: 'available' | 'reviewed_catalog_unavailable';
  }>;
  /**
   * T19 (ADR-026): the household's EFFECTIVE recipe authority, resolved once per operation by
   * server composition from deployment config + deterministic canary — never from request input.
   * The planner universe is exactly this snapshot, so Recipe API, Planner, Shopping and Cooking agree.
   */
  recipeAuthority: (scope: Scope) => Promise<RecipeAuthoritySnapshot>;
  /**
   * T20 (ADR-031): server flag `MEAL_COMPOSITION_V2_ENABLED`. Ordinary V1 plans retain
   * pre-T20 behaviour without composition reads; stored family plans become read-only when off.
   */
  compositionV2Enabled?: boolean;
  familyPreferences?: (scope: Scope) => Promise<{ revision: number; preferences: FamilyPreferences }>;
}

export class MealPlanningApplicationService {
  constructor(
    private readonly db: D1DatabaseBinding,
    private readonly options: MealPlanningServiceOptions,
  ) {
    if (typeof options?.recipeAuthority !== 'function')
      throw new Error('Meal planning requires a server-owned recipe authority resolver');
  }

  /** @internal */
  compositions() {
    return new MealCompositionService(this.db, this, this.options.recipeAuthority);
  }

  private now() {
    return (this.options.now?.() ?? new Date()).toISOString();
  }

  private async snapshot(scope: Scope, referenceTime: string) {
    return (await this.snapshotWithAuthority(scope, referenceTime)).snapshot;
  }

  /** @internal T20: one authority resolution shared by the planner snapshot and role enrichment. */
  async snapshotWithAuthority(scope: Scope, referenceTime: string) {
    const authority = await this.options.recipeAuthority(scope);
    return {
      authority,
      snapshot: await loadMealPlanningSnapshot(this.db, scope, referenceTime, authority),
    };
  }

  /** Persisted source identity: planner fingerprints + the recipe authority the plan was fenced to. */
  /** @internal */
  sourceIdentity(snapshot: Snapshot) {
    return { ...snapshot.fingerprint.parts, authority: snapshot.authority };
  }

  /** @internal */
  authorityChanged(
    stored: {
      fingerprints: { authority?: { source: string; fingerprint: string; recipeCount: number } };
    },
    snapshot: Snapshot,
  ) {
    const previous = stored.fingerprints.authority;
    return (
      previous !== undefined &&
      (previous.source !== snapshot.authority.source ||
        previous.fingerprint !== snapshot.authority.fingerprint ||
        previous.recipeCount !== snapshot.authority.recipeCount)
    );
  }

  /** @internal */
  decode(row: GeneratedMealPlanRecord) {
    const intent = envelope(StoredIntentSchema).parse(JSON.parse(row.intentJson)).data;
    const result = envelope(StoredResultSchema).parse(JSON.parse(row.resultJson)).data;
    const fingerprints = envelope(FingerprintsSchema).parse(JSON.parse(row.sourceJson)).data;
    if (
      result.shoppingPlan.householdId !== row.householdId ||
      result.shoppingPlan.userId !== row.creatorUserId ||
      result.shoppingPlan.id !== row.id
    )
      throw new Error('Stored plan ownership mismatch');
    return { ...intent, ...result, fingerprints };
  }

  /** @internal */
  async freshness(row: GeneratedMealPlanRecord, snapshot?: Snapshot) {
    const stored = this.decode(row);
    const checkedAt = this.now();
    const current =
      snapshot ??
      (await this.snapshot({ householdId: row.householdId, userId: row.creatorUserId }, checkedAt));
    const reasons: MealPlanDto['freshness']['reasons'] = [];
    const labels = {
      inventory: 'stale_inventory',
      preferences: 'stale_preferences',
      catalog: 'stale_catalog',
      history: 'stale_history',
    } as const;
    for (const key of Object.keys(labels) as Array<keyof typeof labels>) {
      if (stored.fingerprints[key] !== current.fingerprint.parts[key]) reasons.push(labels[key]);
    }
    if (this.authorityChanged(stored, current)) reasons.push('catalog_authority_changed');
    if (stored.result.meals.some((meal) => Date.parse(meal.instant) < Date.parse(checkedAt)))
      reasons.push('planning_time_elapsed');
    return {
      status: reasons.length ? ('requires_revalidation' as const) : ('fresh' as const),
      reasons,
      checkedAt,
      requiresRevalidationBeforeConsumption: true as const,
    };
  }

  private async dto(row: GeneratedMealPlanRecord, snapshot?: Snapshot): Promise<MealPlanDto> {
    const stored = this.decode(row);
    return MealPlanDtoSchema.parse({
      schemaVersion: 1,
      id: row.id,
      householdId: row.householdId,
      revision: row.revision,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      intent: stored.intent,
      result: stored.result,
      freshness: await this.freshness(row, snapshot),
    });
  }

  /** @internal */
  assertRevision(row: GeneratedMealPlanRecord, revision: number) {
    if (row.revision !== revision)
      throw new MealPlanningError(
        'PLAN_REVISION_CONFLICT',
        409,
        'Plan revision changed; retrieve the current plan',
      );
  }

  /** @internal */
  nowIso() {
    return this.now();
  }

  /** @internal */
  reference(now: string, offset: number) {
    const local = new Date(Date.parse(now) + offset * 60_000).toISOString().slice(0, -1);
    const suffix = `${offset < 0 ? '-' : '+'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
    return `${local}${suffix}`;
  }

  /** @internal T20: the same trusted T04 context the V1 planner builds, for Assisted/Auto candidates. */
  planningContext(snapshot: Snapshot, referenceInstant: string,
    rankingContext: Snapshot['rankingContext'] = snapshot.rankingContext) {
    return createPlanningContext(() => ({
      snapshotId: crypto.randomUUID(),
      referenceInstant,
      catalog: snapshot.catalog,
      inventory: snapshot.inventory,
      rankingContext,
      evidenceProvider: snapshot.evidenceProvider,
      substitutions: [],
      approvedSubstitutionIds: [],
    }));
  }

  /** @internal */
  run(
    scope: Scope,
    id: string,
    intent: MealPlanningIntent,
    locks: z.infer<typeof LockEntrySchema>[],
    snapshot: Snapshot,
    now: string,
  ) {
    const referenceInstant = this.reference(now, intent.utcOffsetMinutes);
    const request = {
      startDate: intent.startDate,
      horizonDays: intent.horizonDays,
      defaultServings: intent.defaultServings,
      mode: intent.mode,
      slots: intent.slots,
    };
    const input = {
      ...request,
      slots: request.slots.map((slot) => ({
        ...slot,
        lock: locks.find(
          (entry) => entry.slotId === `${slot.date}:${slot.mealType}:${slot.sequence}`,
        )?.lock,
      })),
    };
    try {
      normalizePlannerRequest(input, planningReference(referenceInstant));
    } catch {
      throw new MealPlanningError(
        'INVALID_PLANNING_HORIZON',
        422,
        'Slots must be unique, future and inside the planning horizon',
      );
    }
    const context = this.planningContext(snapshot, referenceInstant);
    const plan = { ...planWeeklyMeals({ context, request: input }), id };
    if (plan.householdId !== scope.householdId || plan.userId !== scope.userId)
      throw new Error('Generated scope mismatch');
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'meal_planning_result',
        status: plan.status,
        conclusion: plan.conclusion,
        truncated: plan.search.truncated,
        states: plan.search.statesExplored,
      }),
    );
    const instructions = new Map<string, string[]>();
    for (const step of snapshot.recipeSteps) {
      const list = instructions.get(step.recipeId) ?? [];
      list.push(step.instruction);
      instructions.set(step.recipeId, list);
    }
    return {
      schemaVersion: 1 as const,
      result: mapPlanResultDto(plan, instructions),
      shoppingPlan: projectShoppingMealPlan(plan),
      lastSwap: null,
    };
  }

  private async familySnapshot(scope: Scope, now: string, profile: { revision: number; preferences: FamilyPreferences }) {
    const authority = await this.options.recipeAuthority(scope);
    const before = authority.source === 'd1' ? await readFamilyCatalogReceipts(this.db) : [];
    if (!await recipeAuthoritySnapshotIsCurrent(this.db, authority)) {
      throw new MealPlanningError('CATALOG_AUTHORITY_CHANGED', 409, 'Catalog changed; retry after it has been revalidated');
    }
    const snapshot = await loadMealPlanningSnapshot(this.db, scope, now, authority);
    const after = authority.source === 'd1' ? await readFamilyCatalogReceipts(this.db) : [];
    const preferences = await readFamilyPreferenceFence(this.db, scope);
    try {
      if (canonicalJson(before) !== canonicalJson(after)) throw new FamilyPlanningInputChanged();
      assertFamilyPreferenceSnapshot(preferences, scope, snapshot.rankingContext.preferences, profile.revision, profile.preferences);
    } catch (error) {
      if (error instanceof FamilyPlanningInputChanged) throw new MealPlanningError('PLAN_REVALIDATION_REQUIRED', 409, 'Planning inputs changed; retry with current data');
      throw error;
    }
    return { authority, snapshot, fence: { ...preferences, inventory: snapshot.inventory, catalog: after } };
  }

  /** @internal Shared snapshot and atomic-write witnesses for composition and shopping mutations. */
  async snapshotWithPlanningFences(scope: Scope, now: string) {
    const profile = await this.familyProfile(scope);
    const loaded = await this.familySnapshot(scope, now, profile);
    return { ...loaded, profile, transactionFences: familyPlanningFenceStatements(this.db, scope, loaded.fence) };
  }

  private async familyRoleIndex(authority: RecipeAuthoritySnapshot) {
    return roleIndexFor(authority, authority.source === 'd1' ? await readRoleAssignments(this.db, new Set(authority.list().map((recipe) => recipe.id))) : []);
  }

  async familyProfile(scope: Scope) {
    const profile = this.options.familyPreferences ? await this.options.familyPreferences(scope)
      : await readFamilyPreferences(this.db, scope);
    return { revision: profile.revision, preferences: FamilyPreferencesSchema.parse(profile.preferences) };
  }

  private familyRequest(intent: MealPlanningIntent, context: ReturnType<MealPlanningApplicationService['planningContext']>) {
    const request = { startDate: intent.startDate, horizonDays: intent.horizonDays, defaultServings: intent.defaultServings, mode: intent.mode, slots: intent.slots };
    try { normalizePlannerRequest(request, readPlanningContext(context).reference); }
    catch { throw new MealPlanningError('INVALID_PLANNING_HORIZON', 422, 'Slots must be unique, future and inside the planning horizon'); }
    return request;
  }

  private familyPolicy(result: FamilyPlanningResult, profile: { revision: number; preferences: FamilyPreferences }): FamilyPlanMetadataWrite['policy'] {
    return { mealStyle: profile.preferences.mealStyle, preferredRegions: profile.preferences.preferredRegions,
      internationalMealsPerWeek: profile.preferences.internationalMealsPerWeek,
      internationalGeneratedMainCount: result.internationalGeneratedMainCount,
      lockedInternationalMainCount: result.lockedInternationalMainCount, defaultCuisine: 'vietnamese', profileRevision: profile.revision };
  }

  /** A V1-compatible anchor projection of the actual chosen compositions, with one sequential shopping projection. */
  private familyStoredResult(scope: Scope, id: string, intent: MealPlanningIntent, snapshot: Snapshot, now: string,
    planning: FamilyPlanningResult) {
    const context = this.planningContext(snapshot, this.reference(now, intent.utcOffsetMinutes));
    const source = readPlanningContext(context);
    const base = { result: { search: { exhaustive: false, plannerExhaustive: false, recipeExhaustive: true, truncated: false,
      limitReasons: [] as string[], incompleteReasons: [], rejections: [] } }, shoppingPlan: ShoppingMealPlanSnapshotSchema.parse({
      schemaVersion: 1, id, householdId: scope.householdId, userId: scope.userId, planningReference: planning.reference,
      sourceSnapshot: { id: source.snapshotId, capturedAt: planning.reference.instant, fingerprint: source.fingerprint,
        catalogSource: source.catalog.source, recipes: source.catalog.recipes.map((recipe) => ({ id: recipe.id, version: recipe.provenance.version })),
        families: [], requiresRevalidationBeforeAcceptance: true }, request: { startDate: intent.startDate, horizonDays: intent.horizonDays },
      status: 'partial', conclusion: 'no_plan_found_without_proof', slots: [], unplannedSlots: [],
      initialInventorySnapshot: snapshot.inventory.map(({ householdId }) => ({ householdId })), projectedFinalInventory: planning.finalInventory,
      diagnostics: [], catalogDiagnostics: source.catalog.diagnostics, search: { searchExhaustive: false, plannerSearchExhaustive: false,
        recipeSearchExhaustive: true, truncated: planning.searchLimited, statesExplored: planning.evaluations, generationCalls: planning.evaluations + planning.poolBuilds,
        candidatesEvaluated: planning.candidateEvaluations, maxCandidatesGenerated: source.catalog.recipes.length, maxCandidatesConsidered: 6,
        maxFrontierSize: 3, limits: { policy: 'family-v2-bounded' }, familySearches: [], rejections: [], limitReasons: [], incompleteReasons: [],
        proofScope: 'supplied_catalog_constraints_and_fixed_allocation_policy' }, persistence: 'generated_only' }) };
    const instructions = new Map<string, string[]>();
    for (const step of snapshot.recipeSteps) instructions.set(step.recipeId, [...(instructions.get(step.recipeId) ?? []), step.instruction]);
    const quantity = (value: number, unit: string) => ({ value: value.toString(), unit });
    const meals = planning.meals.filter((meal) => meal.anchor !== null).map((meal) => {
      const ranked = meal.anchor!; const candidate = ranked.candidate; const slot = meal.slot;
      return { slotId: slot.id, date: slot.date, mealType: slot.mealType, time: slot.time, instant: slot.instant, servings: slot.servings,
        candidateId: candidate.id, source: { kind: candidate.source.kind, id: candidate.source.sourceId,
          version: candidate.source.version, variantId: candidate.variant?.id ?? null }, title: candidate.title, cuisine: candidate.cuisine ?? null,
        prepTimeMinutes: candidate.prepTimeMinutes ?? null, cookTimeMinutes: candidate.cookTimeMinutes ?? null,
        instructions: instructions.get(candidate.source.sourceId) ?? [], requirements: candidate.requirements.map((line) => ({
          ingredientId: line.ingredientId, optional: line.isOptional, status: line.status,
          required: quantity(line.requiredQuantity, line.unit), covered: quantity(line.coveredQuantity, line.unit),
          missing: line.missingQuantity === null ? null : quantity(line.missingQuantity, line.unit), reasons: line.direct.reasons })),
        reasons: ['FAMILY_MEAL_COMPOSITION', ...ranked.reasons, ...meal.warnings], safetyAssessment: ranked.eligibility.safetyAssessment,
        projectedConsumption: meal.anchorDeltas.map((delta) => ({ lotId: delta.lotId, ingredientId: delta.ingredientId,
          consumed: quantity(delta.consumedQuantity, delta.unit), remaining: quantity(delta.remainingQuantity, delta.unit) })) };
    });
    const missing = planning.meals.filter((meal) => meal.missingRoles.length > 0 || meal.warnings.some((code) => code.includes('REVALIDATION') || code.includes('UNAVAILABLE')));
    const status = planning.searchLimited ? 'search_limited' as const : missing.length ? 'partial' as const : 'feasible' as const;
    const conclusion = status === 'feasible' ? 'feasible' as const : 'no_plan_found_without_proof' as const;
    const unplannedSlots = planning.meals.filter((meal) => !meal.anchor).map((meal) => ({ slotId: meal.slot.id, date: meal.slot.date,
      mealType: meal.slot.mealType, reasons: meal.warnings.length ? meal.warnings : ['MAIN_UNAVAILABLE'] }));
    const diagnostics = missing.map((meal) => ({ slotId: meal.slot.id, code: 'MEAL_COMPOSITION_PARTIAL', count: meal.missingRoles.length }));
    const result = PlanResultDtoSchema.parse({ planningReference: planning.reference, status, conclusion, meals, unplannedSlots, diagnostics,
      search: { ...base.result.search, exhaustive: false, plannerExhaustive: false, truncated: planning.searchLimited,
        limitReasons: planning.searchLimited ? ['FAMILY_SEARCH_LIMIT'] : [], incompleteReasons: [], rejections: [] } });
    const slots = planning.meals.map((meal) => ({ slotId: meal.slot.id, date: meal.slot.date, instant: meal.slot.instant,
      servings: meal.slot.servings, components: meal.components }));
    const projection = projectCompositions({ scope: evaluationScope(context), referenceDate: planning.reference.localDate,
      inventory: snapshot.inventory, slots });
    const shoppingPlan = compositionShoppingSnapshot({ ...base.shoppingPlan, status, conclusion, diagnostics,
      unplannedSlots: planning.meals.filter((meal) => !meal.components.length).map(({ slot, warnings }) => ({
        id: slot.id, date: slot.date, mealType: slot.mealType, sequence: slot.sequence,
        time: slot.time, instant: slot.instant, servings: slot.servings,
        ...(slot.lock ? { lock: slot.lock } : {}), reasons: warnings,
      })) }, projection, slots);
    return { schemaVersion: 1 as const, result, shoppingPlan, lastSwap: null };
  }

  private familyDiagnostics(result: FamilyPlanningResult): FamilyPlanMetadataWrite['diagnostics'] {
    const unplanned = result.meals.filter((meal) => !meal.components.length).length;
    const complete = result.meals.filter((meal) => meal.missingRoles.length === 0 && !meal.warnings.some((warning) => warning.startsWith('LOCKED_') || warning === 'UNTRACKED_COMPONENT')).length;
    return { completeMealCount: complete, partialMealCount: result.meals.length - complete - unplanned, unplannedMealCount: unplanned,
      reasons: [...new Set(result.meals.flatMap((meal) => meal.warnings))].sort(), searchLimited: result.searchLimited };
  }

  async generateFamily(scope: Scope, intent: MealPlanningIntent, key: string): Promise<FamilyMealPlanDto> {
    return this.createFamily(scope, intent, key, false);
  }

  async createManualFamily(scope: Scope, intent: MealPlanningIntent, key: string): Promise<FamilyMealPlanDto> {
    return this.createFamily(scope, intent, key, true);
  }

  private async createFamily(scope: Scope, intent: MealPlanningIntent, key: string, manual: boolean): Promise<FamilyMealPlanDto> {
    const requestFingerprint = await sha256Hex(canonicalJson({ intent, schemaVersion: 2,
      ...(manual ? { selectionMode: 'manual' } : {}) }));
    const prior = await findGeneratedMealPlanByRequest(this.db, scope, key);
    if (prior) {
      if (prior.requestFingerprint !== requestFingerprint) throw new MealPlanningError('IDEMPOTENCY_CONFLICT', 409, 'Request key was used with different intent');
      return this.familyDto(scope, prior);
    }
    const profile = await this.familyProfile(scope); const now = this.now();
    const { snapshot, authority, fence } = await this.familySnapshot(scope, now, profile); const id = crypto.randomUUID();
    const context = this.planningContext(snapshot, this.reference(now, intent.utcOffsetMinutes));
    const request = this.familyRequest(intent, context);
    // A manual calendar intentionally starts empty; it never runs and then discards automatic suggestions.
    const normalized = normalizePlannerRequest(request, readPlanningContext(context).reference);
    const planning: FamilyPlanningResult = manual ? {
      request: normalized, reference: readPlanningContext(context).reference,
      meals: normalized.slots.map((slot) => ({ slot, components: [], anchor: null, anchorDeltas: [],
        missingRoles: familyMealRoles(slot.mealType, profile.preferences.mealStyle), warnings: ['MANUAL_SELECTION_PENDING'] })),
      finalInventory: projectInventoryRows(readPlanningContext(context).inventory),
      internationalGeneratedMainCount: 0, lockedInternationalMainCount: 0,
      evaluations: 0, poolBuilds: 0, candidateEvaluations: 0, candidateWork: 0, searchLimited: false, alternativeMeals: [],
    } : planFamilyMeals({ context, request, preferences: profile.preferences, roles: await this.familyRoleIndex(authority),
      runtimeRecipes: authority.list(), revision: 1 });
    const base = this.familyStoredResult(scope, id, intent, snapshot, now, planning);
    const slots = planning.meals.map((meal) => ({ slotId: meal.slot.id, mode: manual ? 'manual' as const : 'auto' as const, createdRevision: 1, createdAt: null, components: meal.components }));
    const metadata = { profileRevision: profile.revision, profileFingerprint: await sha256Hex(canonicalJson(profile.preferences)),
      policy: this.familyPolicy(planning, profile), diagnostics: this.familyDiagnostics(planning) };
    const row = await createFamilyMealPlan(this.db, scope, { id, requestKey: key, requestFingerprint,
      intentJson: serialize({ intent, locks: [] }), resultJson: serialize(base), sourceJson: serialize(this.sourceIdentity(snapshot)) }, slots, metadata, familyPlanningFenceStatements(this.db, scope, fence));
    return this.familyDto(scope, row);
  }

  private async familyDto(scope: Scope, row: GeneratedMealPlanRecord): Promise<FamilyMealPlanDto> {
    const service = this.compositions(); const loaded = await service.load(scope, row.id);
    const plan = await this.dto(loaded.row, loaded.snapshot);
    const compositions = service.compositionsFromLoaded(loaded);
    const metadata = await readFamilyPlanMetadata(this.db, scope, row.id);
    if (!metadata) throw new MealPlanningError('FAMILY_PLAN_METADATA_MISSING', 409, 'Family plan metadata is unavailable');
    for (const composition of compositions.compositions) {
      const wanted = familyMealRolesForComponents(composition.mealType, metadata.policy.mealStyle, composition.components, loaded.roles);
      const covered = new Set(composition.components.map((component) => component.role));
      if (composition.mealType === 'breakfast' || metadata.policy.mealStyle === 'one_pot') {
        for (const component of composition.components) {
          const traits = component.recipeId ? loaded.roles.get(component.recipeId)?.traits ?? [] : [];
          if (component.role === 'main' && traits.includes('includes_staple')) covered.add('staple');
          if (component.role === 'main' && traits.includes('brothy')) covered.add('soup');
        }
      }
      composition.missingRoles = wanted.filter((role) => !covered.has(role)); composition.recommendedRoles = [];
    }
    const count = compositions.compositions;
    const mainComponents = count.flatMap((composition) => composition.components).filter((component) => component.role === 'main' && component.recipeId);
    const international = mainComponents.filter((component) => { const recipe = loaded.authority.findById(component.recipeId!);
      return recipe !== null && recipe.cuisine !== 'vietnamese'; });
    const policy = { ...metadata.policy, internationalGeneratedMainCount: international.filter((component) => (component.provenance === 'auto' || component.provenance === 'assisted') && !component.locked).length,
      lockedInternationalMainCount: international.filter((component) => component.locked).length };
    const unplannedMealCount = count.filter((composition) => !composition.components.length).length;
    const completeMealCount = count.filter((composition) => composition.missingRoles.length === 0 && !composition.warnings.includes('COMPONENT_UNAVAILABLE')
      && !composition.warnings.some((reason) => reason.startsWith('LOCKED_COMPONENT_') || reason === 'MEAL_TIME_REQUIRES_REVALIDATION')).length;
    const diagnostics = { ...metadata.diagnostics, completeMealCount, unplannedMealCount,
      partialMealCount: count.length - completeMealCount - unplannedMealCount,
      reasons: [...new Set(count.flatMap((composition) => [...composition.warnings,
        ...composition.missingRoles.map((role) => 'ROLE_UNFILLED:' + role)]))].sort() };
    const current = await this.familyProfile(scope); const fingerprint = await sha256Hex(canonicalJson(current.preferences));
    this.assertRevision(await getGeneratedMealPlan(this.db, scope, row.id), loaded.row.revision);
    return FamilyMealPlanDtoSchema.parse({ schemaVersion: 2, plan, compositions, policy, diagnostics,
      familyPreferenceFreshness: current.revision === metadata.profileRevision && fingerprint === metadata.profileFingerprint ? 'fresh' : 'requires_revalidation' });
  }

  async currentFamily(scope: Scope): Promise<z.infer<typeof CurrentFamilyMealPlanDtoSchema>> {
    const row = await findCurrentGeneratedMealPlan(this.db, scope);
    if (!row || !await readFamilyPlanMetadata(this.db, scope, row.id)) return CurrentFamilyMealPlanDtoSchema.parse({ plan: null });
    return CurrentFamilyMealPlanDtoSchema.parse({ plan: await this.familyDto(scope, row) });
  }

  async getFamily(scope: Scope, id: string): Promise<FamilyMealPlanDto> {
    return this.familyDto(scope, await getGeneratedMealPlan(this.db, scope, id));
  }

  async regenerateFamily(scope: Scope, id: string, input: z.infer<typeof RegenerateMealPlanSchema>): Promise<FamilyMealPlanDto> {
    const row = await getGeneratedMealPlan(this.db, scope, id); this.assertRevision(row, input.revision);
    if (!await readFamilyPlanMetadata(this.db, scope, id)) throw new MealPlanningError('FAMILY_PLAN_METADATA_MISSING', 409, 'This plan requires the V1 regeneration endpoint');
    const intent = input.intent ?? this.decode(row).intent; const profile = await this.familyProfile(scope); const now = this.now();
    const { snapshot, authority, fence } = await this.familySnapshot(scope, now, profile); const compositions = await readPlanCompositions(this.db, scope, id);
    const previousIntent = this.decode(row).intent;
    for (const slot of intent.slots) {
      const slotId = `${slot.date}:${slot.mealType}:${slot.sequence}`;
      const previous = previousIntent.slots.find((entry) => `${entry.date}:${entry.mealType}:${entry.sequence}` === slotId);
      if (previous && compositions.get(slotId)?.components.some((component) => component.locked)
        && (previous.servings ?? previousIntent.defaultServings) !== (slot.servings ?? intent.defaultServings)) {
        throw new MealPlanningError('LOCKED_SERVINGS_CONFLICT', 422, 'Unlock the meal before changing its serving count');
      }
    }
    const locked = new Map([...compositions].map(([slotId, composition]) => [slotId, composition.components.filter((component) => component.locked)]));
    const context = this.planningContext(snapshot, this.reference(now, intent.utcOffsetMinutes));
    const planning = planFamilyMeals({ context, request: this.familyRequest(intent, context), preferences: profile.preferences, roles: await this.familyRoleIndex(authority), runtimeRecipes: authority.list(),
      locked, revision: row.revision + 1 });
    const result = this.familyStoredResult(scope, id, intent, snapshot, now, planning);
    const metadata = { profileRevision: profile.revision, profileFingerprint: await sha256Hex(canonicalJson(profile.preferences)),
      policy: this.familyPolicy(planning, profile), diagnostics: this.familyDiagnostics(planning) };
    const slots = planning.meals.map((meal) => ({ slotId: meal.slot.id, mode: 'auto' as const,
      createdRevision: compositions.get(meal.slot.id)?.createdRevision ?? row.revision + 1, createdAt: compositions.get(meal.slot.id)?.createdAt ?? null,
      components: meal.components }));
    const current = await writePlanCompositions(this.db, scope, { planId: id, expectedRevision: row.revision,
      planUpdate: { intentJson: serialize({ intent, locks: [] }), resultJson: serialize(result), sourceJson: serialize(this.sourceIdentity(snapshot)) },
      slots, deleteSlotIds: [...compositions.keys()].filter((slotId) => !slots.some((slot) => slot.slotId === slotId)),
      additionalStatements: [...familyPlanningFenceStatements(this.db, scope, fence), familyMetadataUpdateStatement(this.db, scope, id, metadata)] });
    return this.familyDto(scope, current);
  }

  async generate(scope: Scope, intent: MealPlanningIntent, key: string) {
    const requestFingerprint = await sha256Hex(canonicalJson(intent));
    const prior = await findGeneratedMealPlanByRequest(this.db, scope, key);
    if (prior) {
      if (prior.requestFingerprint !== requestFingerprint)
        throw new MealPlanningError(
          'IDEMPOTENCY_CONFLICT',
          409,
          'Request key was used with different intent',
        );
      return this.dto(prior);
    }
    const now = this.now();
    const snapshot = await this.snapshot(scope, now);
    const id = crypto.randomUUID();
    const result = this.run(scope, id, intent, [], snapshot, now);
    const { plan: row } = await createGeneratedMealPlan(this.db, scope, {
      id,
      requestKey: key,
      requestFingerprint,
      intentJson: serialize({ intent, locks: [] }),
      resultJson: serialize(result),
      sourceJson: serialize(this.sourceIdentity(snapshot)),
    });
    return this.dto(row, snapshot);
  }

  async get(scope: Scope, id: string) {
    return this.dto(await getGeneratedMealPlan(this.db, scope, id));
  }

  async current(scope: Scope) {
    const row = await findCurrentGeneratedMealPlan(this.db, scope);
    return CurrentMealPlanDtoSchema.parse({ plan: row ? await this.dto(row) : null });
  }

  async alternatives(scope: Scope, id: string, revision: number) {
    const row = await getGeneratedMealPlan(this.db, scope, id);
    this.assertRevision(row, revision);
    const snapshot = await this.snapshot(scope, this.now());
    // Alternatives come from the authority-fenced planner catalog only: never a D1-only recipe under static authority.
    const recipes = [...snapshot.catalog.recipes].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    this.assertRevision(await getGeneratedMealPlan(this.db, scope, id), revision);
    return PlanAlternativesDtoSchema.parse({
      planId: id,
      planRevision: row.revision,
      alternatives: recipes
        .slice(0, PLAN_ALTERNATIVES_LIMIT)
        .map((recipe) => ({ kind: 'recipe', id: recipe.id, title: recipe.title })),
      truncated: recipes.length > PLAN_ALTERNATIVES_LIMIT,
    });
  }

  async explanation(scope: Scope, id: string, input: PlanExplanationRequest, enabled: boolean) {
    const row = await getGeneratedMealPlan(this.db, scope, id);
    this.assertRevision(row, input.revision);
    const meal = this.decode(row).result.meals.find((entry) => entry.slotId === input.slotId);
    if (!meal)
      throw new MealPlanningError(
        'SLOT_NOT_FOUND',
        422,
        'Explanation requires a selected meal slot',
      );
    const result = await explainMealReasons({
      planId: id,
      planRevision: row.revision,
      slotId: meal.slotId,
      locale: input.locale,
      reasonCodes: meal.reasons,
      enabled,
      transport: this.options.explanationTransport,
    });
    this.assertRevision(await getGeneratedMealPlan(this.db, scope, id), input.revision);
    return result;
  }

  private assertFamilyMutationEnabled(stored: ReturnType<MealPlanningApplicationService['decode']>) {
    // The persisted server marker protects even empty family plans without reading optional schema.
    const limits = stored.shoppingPlan.search.limits;
    if (!this.options.compositionV2Enabled && limits !== null && typeof limits === 'object'
      && 'policy' in limits && limits.policy === 'family-v2-bounded') {
      throw new MealPlanningError('MEAL_COMPOSITION_DISABLED', 409,
        'This family plan is read-only while meal composition is disabled');
    }
  }

  async regenerate(scope: Scope, id: string, input: z.infer<typeof RegenerateMealPlanSchema>) {
    const row = await getGeneratedMealPlan(this.db, scope, id);
    this.assertRevision(row, input.revision);
    const stored = this.decode(row);
    this.assertFamilyMutationEnabled(stored);
    if (this.options.compositionV2Enabled && await readFamilyPlanMetadata(this.db, scope, id)) {
      return (await this.regenerateFamily(scope, id, input)).plan;
    }
    const intent = input.intent ?? stored.intent;
    const now = this.now();
    const snapshot = await this.snapshot(scope, now);
    const currentVersions = new Map<string, number | undefined>([
      ...snapshot.catalog.recipes.map(
        (recipe) => [`recipe:${recipe.id}`, recipe.provenance.version] as const,
      ),
      ...snapshot.catalog.families.map(
        (family) => [`family:${family.id}`, family.provenance.version] as const,
      ),
    ]);
    // Regenerate is the revalidation path: stale locks are dropped, never silently redirected.
    const locks = stored.locks
      .filter((entry) =>
        intent.slots.some(
          (slot) => `${slot.date}:${slot.mealType}:${slot.sequence}` === entry.slotId,
        ),
      )
      .filter(
        (entry) =>
          currentVersions.get(`${entry.lock.kind}:${entry.lock.id}`) === entry.lock.version,
      );
    if (this.options.compositionV2Enabled && (await planHasCompositions(this.db, scope, id))) {
      const composed = await this.compositions().regenerateComposed(scope, { row, intent, locks, snapshot, now });
      return this.dto(
        await writePlanCompositions(this.db, scope, {
          planId: id,
          expectedRevision: input.revision,
          planUpdate: {
            intentJson: serialize({ intent, locks: composed.locks }),
            resultJson: serialize(composed.result),
            sourceJson: serialize(this.sourceIdentity(snapshot)),
          },
          slots: composed.writes,
          deleteSlotIds: composed.deleted,
        }),
        snapshot,
      );
    }
    const result = this.run(scope, id, intent, locks, snapshot, now);
    return this.dto(
      await updateGeneratedMealPlan(this.db, scope, {
        id,
        expectedRevision: input.revision,
        intentJson: serialize({ intent, locks }),
        resultJson: serialize(result),
        sourceJson: serialize(this.sourceIdentity(snapshot)),
      }),
      snapshot,
    );
  }

  async swap(scope: Scope, id: string, input: z.infer<typeof SwapMealSchema>) {
    const row = await getGeneratedMealPlan(this.db, scope, id);
    this.assertRevision(row, input.revision);
    const stored = this.decode(row);
    this.assertFamilyMutationEnabled(stored);
    const original = stored.result.meals.find((meal) => meal.slotId === input.slotId);
    if (!original)
      throw new MealPlanningError('SLOT_NOT_FOUND', 422, 'Swap requires a selected meal slot');
    if (
      this.options.compositionV2Enabled &&
      (await readPlanCompositions(this.db, scope, id)).has(input.slotId)
    ) {
      throw new MealPlanningError(
        'COMPOSITION_MANAGED_SLOT',
        409,
        'This meal is edited as a composition; change its dishes through the meal editor',
      );
    }
    const now = this.now();
    const snapshot = await this.snapshot(scope, now);
    if (this.authorityChanged(stored, snapshot)) {
      throw new MealPlanningError(
        'CATALOG_AUTHORITY_CHANGED',
        409,
        'Recipe catalog authority changed since this plan was generated; regenerate the plan',
      );
    }
    if (stored.fingerprints.catalog !== snapshot.fingerprint.parts.catalog) {
      throw new MealPlanningError(
        'PLAN_REVALIDATION_REQUIRED',
        409,
        'Regenerate the plan before changing meals',
      );
    }
    // The replacement must be in the authority-fenced catalog: a D1-only recipe under static authority is a typed rejection.
    const source =
      input.replacement.kind === 'recipe'
        ? snapshot.catalog.recipes.find((recipe) => recipe.id === input.replacement.id)
        : snapshot.catalog.families.find((family) => family.id === input.replacement.id);
    if (!source)
      throw new MealPlanningError(
        'REPLACEMENT_NOT_FOUND',
        422,
        'Replacement is not in the trusted recipe catalog',
      );
    const lock = PlannerLockSchema.parse({
      ...input.replacement,
      version: source.provenance.version,
    });
    const locks = [
      ...stored.locks.filter((entry) => entry.slotId !== input.slotId),
      { slotId: input.slotId, lock },
    ];
    const generated = this.run(scope, id, stored.intent, locks, snapshot, now);
    const selected = generated.result.meals.find((meal) => meal.slotId === input.slotId);
    if (!selected || generated.result.status !== 'feasible') {
      throw new MealPlanningError(
        'SWAP_NOT_FEASIBLE',
        422,
        'Replacement cannot produce a complete plan under current constraints',
      );
    }
    const result = {
      ...generated,
      lastSwap: { slotId: input.slotId, previous: original.source, replacement: selected.source },
    };
    return this.dto(
      await updateGeneratedMealPlan(this.db, scope, {
        id,
        expectedRevision: input.revision,
        intentJson: serialize({ intent: stored.intent, locks }),
        resultJson: serialize(result),
        sourceJson: serialize(this.sourceIdentity(snapshot)),
      }),
      snapshot,
    );
  }

  async shopping(scope: Scope, id: string, input: z.infer<typeof OptimizePlanShoppingSchema>) {
    const row = await getGeneratedMealPlan(this.db, scope, id);
    this.assertRevision(row, input.revision);
    const stored = this.decode(row);
    const freshness = await this.freshness(row);
    if (freshness.reasons.includes('catalog_authority_changed')) {
      throw new MealPlanningError(
        'CATALOG_AUTHORITY_CHANGED',
        409,
        'Recipe catalog authority changed since this plan was generated; regenerate the plan',
      );
    }
    if (freshness.status !== 'fresh')
      throw new MealPlanningError(
        'PLAN_REVALIDATION_REQUIRED',
        409,
        'Regenerate the plan before optimizing shopping',
      );
    const asOf = this.now();
    const catalog = this.options.purchaseCatalog
      ? await this.options.purchaseCatalog(scope, asOf)
      : {
          snapshotId: 'no-reviewed-catalog',
          options: [],
          status: 'reviewed_catalog_unavailable' as const,
        };
    const budget = input.budget
      ? {
          householdId: scope.householdId,
          revision: `${id}:${row.revision}`,
          mode: input.budget.mode,
          currency: input.currency,
          amountMinor: Number(input.budget.money.minorAmount),
        }
      : null;
    // T20: a plan with canonical composed slots is projected over every component, then handed to
    // the unchanged T05 optimizer; plans without compositions keep the stored V1 projection.
    const mealPlan =
      this.options.compositionV2Enabled && (await planHasCompositions(this.db, scope, id))
        ? await this.compositions().shoppingPlanFor(scope, row)
        : stored.shoppingPlan;
    const context = createShoppingContext(() => ({
      ...scope,
      currency: input.currency,
      mealPlan,
      budget,
      catalog: { snapshotId: catalog.snapshotId, asOf, options: catalog.options },
    }));
    const result = optimizeShopping({ context });
    this.assertRevision(await getGeneratedMealPlan(this.db, scope, id), input.revision);
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'meal_shopping_result',
        catalogStatus: catalog.status,
      }),
    );
    return PlanShoppingDtoSchema.parse({
      schemaVersion: 1,
      planId: id,
      planRevision: row.revision,
      priceAsOf: asOf,
      requiresPriceRevalidation: true,
      catalogStatus: catalog.status,
      result: toShoppingResultDto(result),
    });
  }

  async feedback(scope: Scope, id: string, input: z.infer<typeof PlanFeedbackSchema>, key: string) {
    const row = await getGeneratedMealPlan(this.db, scope, id);
    this.assertRevision(row, input.revision);
    const stored = this.decode(row);
    const meal = stored.result.meals.find((item) => item.slotId === input.slotId);
    if (!meal)
      throw new MealPlanningError('SLOT_NOT_FOUND', 422, 'Feedback requires a selected meal slot');
    const now = this.now();
    let event: { id: string; occurredAt: string };
    if (input.type === 'cooked') {
      const { annotation } = await recordCookedGeneratedMealPlanAnnotation(this.db, scope, {
        id: crypto.randomUUID(),
        planId: id,
        expectedRevision: input.revision,
        slotId: input.slotId,
        requestKey: key,
      });
      event = { id: annotation.id, occurredAt: annotation.createdAt };
    } else {
      const swap = stored.lastSwap;
      if (input.type === 'swapped' && (!swap || swap.slotId !== input.slotId)) {
        throw new MealPlanningError(
          'SWAP_FEEDBACK_INVALID',
          422,
          'Swapped feedback requires a server-applied swap in this revision',
        );
      }
      const target = input.type === 'swapped' ? swap!.previous : meal.source;
      const replacement = input.type === 'swapped' ? swap!.replacement : undefined;
      event = await recordPlanningTaste(this.db, scope, {
        planId: id,
        revision: input.revision,
        slotId: input.slotId,
        key,
        type: input.type,
        occurredAt: now,
        target: { kind: target.kind, id: target.id },
        replacement: replacement ? { kind: replacement.kind, id: replacement.id } : undefined,
      });
    }
    return PlanFeedbackDtoSchema.parse({
      schemaVersion: 1,
      ...event,
      planId: id,
      planRevision: input.revision,
      slotId: input.slotId,
      type: input.type,
      inventoryMutated: false,
    });
  }
}
