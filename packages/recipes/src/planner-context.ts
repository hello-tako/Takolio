import { z } from 'zod';
import { compareIds } from '../../domain/src/availability';
import { OffsetDateTimeSchema, CatalogIdSchema } from '../../domain/src/foundation';
import { createRecipeCatalog, type RecipeCatalogSnapshot } from './catalog';
import { type RecipeCandidate } from './candidates';
import { RankingContextSchema, resolveRankingPreferences } from './personalization';
import { BALANCED_RANKING_PROFILE, RankingProfileSchema } from './ranking-policy';
import { SubstitutionRuleSchema } from './substitutions';
import { createProjectedInventory, projectInventoryRows, type InventoryLotSnapshot } from './planner-inventory';
import { PLANNER_LIMITS } from './planner-policy';

export interface PlanningReference {
  instant: string;
  localDate: string;
  utcOffsetMinutes: number;
}

export function planningReference(instant: string): PlanningReference {
  OffsetDateTimeSchema.parse(instant);
  const suffix = instant.match(/(Z|([+-])(\d{2}):(\d{2}))$/);
  if (!suffix) throw new Error('Planning reference requires Z or an explicit HH:MM offset');
  const hours = Number(suffix[3] ?? 0);
  const minutes = Number(suffix[4] ?? 0);
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) throw new Error('Unsupported UTC offset');
  const utcOffsetMinutes = (hours * 60 + minutes) * (suffix[2] === '-' ? -1 : 1);
  const epoch = Date.parse(instant);
  if (!Number.isFinite(epoch)) throw new Error('Invalid planning instant');
  return { instant: new Date(epoch).toISOString(),
    localDate: new Date(epoch + utcOffsetMinutes * 60_000).toISOString().slice(0, 10), utcOffsetMinutes };
}

export function slotInstant(date: string, time: string, reference: PlanningReference): string {
  const epoch = Date.parse(`${date}T${time}:00Z`) - reference.utcOffsetMinutes * 60_000;
  return new Date(epoch).toISOString();
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).filter((key) => row[key] !== undefined).sort(compareIds)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// A reproducible display identity, never an authorization or optimistic-lock token.
export function planningFingerprint(value: unknown): string {
  let hash = 14695981039346656037n;
  for (const char of canonicalJson(value)) {
    hash ^= BigInt(char.codePointAt(0)!);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return hash.toString(16).padStart(16, '0');
}

export function freezePlanningValue<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezePlanningValue);
    Object.freeze(value);
  }
  return value;
}

export interface PlanningSourceInput {
  snapshotId: string;
  referenceInstant: string;
  inventory: readonly InventoryLotSnapshot[];
  catalog: RecipeCatalogSnapshot;
  rankingContext: z.input<typeof RankingContextSchema>;
  rankingProfile?: z.input<typeof RankingProfileSchema>;
  substitutions?: readonly z.input<typeof SubstitutionRuleSchema>[];
  approvedSubstitutionIds?: readonly string[];
  activeConstraints?: readonly string[];
  evidenceProvider?: (candidates: readonly RecipeCandidate[]) => readonly unknown[];
}

declare const planningContextBrand: unique symbol;
export interface PlanningContext { readonly [planningContextBrand]: true }
const contexts = new WeakMap<PlanningContext, ReturnType<typeof prepareSource>>();

/** Install only an authorized, preloaded server snapshot and a synchronous in-memory review provider. */
export function createPlanningContext(serverProvider: () => PlanningSourceInput): PlanningContext {
  if (typeof serverProvider !== 'function') throw new Error('Planning requires a server-owned context provider');
  const prepared = prepareSource(serverProvider());
  const context = Object.freeze({}) as PlanningContext;
  contexts.set(context, prepared);
  return context;
}

export function readPlanningContext(context: PlanningContext) {
  const stored = contexts.get(context);
  if (!stored) throw new Error('Planning requires the original trusted context snapshot');
  return stored;
}

/** Reuse a trusted immutable source when a slot changes only its ranking policy. */
export function derivePlanningContext(context: PlanningContext, overrides: {
  rankingContext: z.input<typeof RankingContextSchema>;
  rankingProfile?: z.input<typeof RankingProfileSchema>;
}): PlanningContext {
  const source = readPlanningContext(context);
  const rankingContext = RankingContextSchema.parse(overrides.rankingContext);
  if (rankingContext.householdId !== source.rankingContext.householdId || rankingContext.userId !== source.rankingContext.userId) {
    throw new Error('Derived planning context must retain its authorized scope');
  }
  if (rankingContext.feedback.length > PLANNER_LIMITS.feedbackEvents) throw new Error('Planning history limit exceeded');
  rankingContext.feedback = rankingContext.feedback
    .filter((event) => Date.parse(event.occurredAt) <= Date.parse(source.reference.instant))
    .sort((a, b) => compareIds(a.id, b.id));
  rankingContext.preferences.sort((a, b) => compareIds(a.userId ?? '', b.userId ?? ''));
  const rankingProfile = RankingProfileSchema.parse(overrides.rankingProfile ?? source.rankingProfile);
  const hard = resolveRankingPreferences(rankingContext).hard;
  const activeConstraints = [...new Set([...source.activeConstraints, ...hard.flatMap((policy) => [
    ...policy.allergens.map((key) => `allergen:${key}`), ...policy.requiredDietaryTags.map((key) => `dietary:${key}`),
  ])])].sort(compareIds);
  if (activeConstraints.length > 100) throw new Error('Planning substitution constraint limit exceeded');
  const fingerprint = planningFingerprint({ parent: source.fingerprint, rankingContext, rankingProfile, activeConstraints });
  const derived = Object.freeze({}) as PlanningContext;
  contexts.set(derived, Object.freeze({ ...source, rankingContext: freezePlanningValue(rankingContext),
    rankingProfile: freezePlanningValue(rankingProfile), activeConstraints: freezePlanningValue(activeConstraints), fingerprint }));
  return derived;
}

function prepareSource(source: PlanningSourceInput) {
  const reference = planningReference(source.referenceInstant);
  const snapshotId = z.string().min(1).max(200).parse(source.snapshotId);
  const rankingContext = RankingContextSchema.parse(source.rankingContext);
  if (rankingContext.feedback.length > PLANNER_LIMITS.feedbackEvents) throw new Error('Planning history limit exceeded');
  rankingContext.feedback = rankingContext.feedback
    .filter((event) => Date.parse(event.occurredAt) <= Date.parse(reference.instant))
    .sort((a, b) => compareIds(a.id, b.id));
  rankingContext.preferences.sort((a, b) => compareIds(a.userId ?? '', b.userId ?? ''));
  const rankingProfile = RankingProfileSchema.parse(source.rankingProfile ?? BALANCED_RANKING_PROFILE);
  if (source.inventory.length > PLANNER_LIMITS.inventoryLots) throw new Error('Planning inventory limit exceeded');
  const inventory = createProjectedInventory(source.inventory, {
    householdId: rankingContext.householdId, asOfDate: reference.localDate,
  });
  if (source.catalog.recipes.length > PLANNER_LIMITS.catalogRecipes ||
      source.catalog.families.length > PLANNER_LIMITS.catalogFamilies || source.catalog.ingredientIds.length > 2000 ||
      source.catalog.classifications.length > 5000) throw new Error('Planning catalog input limit exceeded');
  const catalog = createRecipeCatalog({ ...structuredClone(source.catalog),
    source: z.enum(['provided', 'static', 'd1']).parse(source.catalog.source) });
  catalog.recipes.sort((a, b) => compareIds(a.id, b.id));
  catalog.families.sort((a, b) => compareIds(a.id, b.id));
  catalog.ingredientIds.sort(compareIds);
  catalog.classifications.sort((a, b) => compareIds(canonicalJson(a), canonicalJson(b)));
  catalog.diagnostics.sort((a, b) => compareIds(canonicalJson(a), canonicalJson(b)));
  const substitutions = z.array(SubstitutionRuleSchema).max(1000).parse(source.substitutions ?? [])
    .sort((a, b) => compareIds(a.id, b.id));
  const approvedSubstitutionIds = z.array(CatalogIdSchema).max(1000).parse(source.approvedSubstitutionIds ?? []).sort(compareIds);
  const hard = resolveRankingPreferences(rankingContext).hard;
  const activeConstraints = [...new Set([
    ...z.array(z.string().min(1).max(200)).max(100).parse(source.activeConstraints ?? []),
    ...hard.flatMap((policy) => [...policy.allergens.map((key) => `allergen:${key}`),
      ...policy.requiredDietaryTags.map((key) => `dietary:${key}`)]),
  ])].sort(compareIds);
  if (activeConstraints.length > 100) throw new Error('Planning substitution constraint limit exceeded');
  if (source.evidenceProvider !== undefined && typeof source.evidenceProvider !== 'function') {
    throw new Error('Planning review evidence requires a server-owned provider');
  }
  const fingerprint = planningFingerprint({ snapshotId, reference, inventory: projectInventoryRows(inventory),
    catalog, rankingContext, rankingProfile, substitutions, approvedSubstitutionIds, activeConstraints });
  return freezePlanningValue({ snapshotId, reference, inventory, catalog, rankingContext, rankingProfile,
    substitutions, approvedSubstitutionIds, activeConstraints, fingerprint, evidenceProvider: source.evidenceProvider });
}
