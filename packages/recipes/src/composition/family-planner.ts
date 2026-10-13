import { compareIds } from '../../../domain/src/availability';
import type { FamilyPreferences } from '../../../domain/src/family-preferences-api';
import type { MealRole } from '../../../domain/src/meal-composition-api';
import { generateRecipeCandidates, type RecipeCandidate } from '../candidates';
import { createPlanningContext, planningFingerprint, readPlanningContext, type PlanningContext } from '../planner-context';
import { applyProjectedConsumption, InventoryProjectionError, projectInventoryRows, type ProjectedInventory, type ProjectedInventoryDelta } from '../planner-inventory';
import { normalizePlannerRequest, type NormalizedPlannerSlot, type PlannerRequestInput } from '../planner-request';
import { createRankingEvidenceSnapshot } from '../ranking-evidence';
import { rankRecipeCandidates, type RankedRecipeCandidate } from '../ranking';
import { resolveRankingPreferences } from '../personalization';
import { contextForSlot } from '../weekly-planner';
import type { Recipe } from '../types';
import { prepareComposerCandidates, recipeKey } from './candidates';
import type { ComposerCandidate } from './composer';
import { normalizeComponents, targetKey, type MealComponent } from './model';
import { compatibilityIssues, coveredRoles, hasHardIssue, type ComposableItem } from './profiles';
import { evaluateDefinition, evaluationScope, simpleFoodDefinition } from './projection';
import { recipeRestrictions, simpleFoodRestrictions } from './restrictions';
import { normalizeText, type RoleIndex } from './roles';
import { getSimpleFood } from './simple-foods';

export const FAMILY_SEARCH_LIMITS = Object.freeze({ weekBeam: 3, mealBeam: 4, mains: 4, perRole: 6, evaluations: 4096, poolBuilds: 1536 });
export function familyMealRoles(mealType: NormalizedPlannerSlot['mealType'], style: FamilyPreferences['mealStyle']): MealRole[] {
  if (mealType === 'breakfast' || style === 'one_pot') return ['main'];
  return style === 'quick' ? ['main', 'vegetable', 'staple'] : ['main', 'vegetable', 'soup', 'staple'];
}
export interface FamilyPlannedSlot {
  slot: NormalizedPlannerSlot;
  components: MealComponent[];
  anchor: RankedRecipeCandidate | null;
  anchorDeltas: readonly ProjectedInventoryDelta[];
  missingRoles: MealRole[];
  warnings: string[];
}
interface Branch { inventory: ProjectedInventory; meals: FamilyPlannedSlot[]; score: number; international: number; internationalDates: string[]; usedMains: Set<string> }
interface MealBranch { inventory: ProjectedInventory; components: MealComponent[]; score: number; anchor: RankedRecipeCandidate | null;
  anchorDeltas: readonly ProjectedInventoryDelta[]; international: number; warnings: string[] }
export interface FamilyPlanningResult {
  request: ReturnType<typeof normalizePlannerRequest>;
  reference: ReturnType<typeof readPlanningContext>['reference'];
  meals: FamilyPlannedSlot[];
  finalInventory: ReturnType<typeof projectInventoryRows>;
  internationalGeneratedMainCount: number;
  lockedInternationalMainCount: number;
  evaluations: number;
  searchLimited: boolean;
  poolBuilds: number;
  alternativeMeals: FamilyPlannedSlot[][];
}

export function familyInternationalCapExceeded(dates: readonly string[], date: string, cap: number): boolean {
  return dates.filter(start => start <= date && Date.parse(date) - Date.parse(start) < 7 * 86400000)
    .some(start => dates.filter(entry => entry >= start && Date.parse(entry) - Date.parse(start) < 7 * 86400000).length > cap);
}

const canonicalMealKey = (meals: readonly FamilyPlannedSlot[]) => meals.flatMap((meal) => meal.components.map(targetKey)).join('|');

/** One bounded beam across chronological slots; every child evaluates against its parent's remaining stock. */
export function planFamilyMeals(input: {
  context: PlanningContext; request: PlannerRequestInput; preferences: FamilyPreferences; roles: RoleIndex;
  runtimeRecipes: readonly Recipe[]; locked?: ReadonlyMap<string, readonly MealComponent[]>; revision: number;
  variant?: number; generatedInternationalDates?: readonly string[];
}): FamilyPlanningResult {
  const source = readPlanningContext(input.context);
  const request = normalizePlannerRequest(input.request, source.reference);
  const runtime = new Map(input.runtimeRecipes.map((recipe) => [recipe.id, recipe]));
  let evaluations = 0;
  let searchLimited = false;
  let poolBuilds = 0;
  const internationalAllowed = (dates: readonly string[], date: string) =>
    !familyInternationalCapExceeded([...dates, date], date, input.preferences.internationalMealsPerWeek);
  const preservedInternationalDates = request.slots.flatMap(slot => (input.locked?.get(slot.id) ?? [])
    .filter(component => component.role === 'main' && component.recipeId && runtime.has(component.recipeId)
      && runtime.get(component.recipeId)?.cuisine !== 'vietnamese').map(() => slot.date));
  let frontier: Branch[] = [{ inventory: source.inventory, meals: [], score: 0, international: 0,
    internationalDates: [...(input.generatedInternationalDates ?? []), ...preservedInternationalDates], usedMains: new Set() }];
  const componentMinutes = (component: MealComponent): number | null => {
    if (component.simpleFoodId) return getSimpleFood(component.simpleFoodId)?.prepMinutes ?? null;
    const definition = source.catalog.recipes.find((recipe) => recipe.id === component.recipeId);
    return definition?.prepTimeMinutes === undefined ? null : definition.prepTimeMinutes + definition.cookTimeMinutes;
  };
  const mealEffort = (components: readonly MealComponent[], target: number) => {
    const minutes = components.map(componentMinutes);
    const known = minutes.reduce((sum: number, value) => sum + (value ?? 0), 0);
    return minutes.filter((value) => value === null).length * 0.2 + 0.1 * Math.min(known / target, 6)
      + 0.6 * Math.min(Math.max(known - target, 0) / target, 3);
  };
  const items = (components: readonly MealComponent[]): ComposableItem[] => components.map((component) => ({
    key: targetKey(component), kind: component.kind, id: (component.recipeId ?? component.simpleFoodId)!, role: component.role,
    traits: component.recipeId ? input.roles.get(component.recipeId)?.traits ?? [] : [],
    dominantIngredientId: component.recipeId ? input.roles.get(component.recipeId)?.dominantIngredientId ?? null : null,
  }));
  const covered = (components: readonly MealComponent[], slot: NormalizedPlannerSlot) => {
    const explicit = new Set(components.map((component) => component.role));
    return slot.mealType === 'breakfast' || input.preferences.mealStyle === 'one_pot' ? coveredRoles(items(components)) : explicit;
  };
  const rankKey = (branch: MealBranch) => branch.components.map(targetKey).join('|');
  const evaluate = (context: PlanningContext, component: MealComponent, inventory: ProjectedInventory, slot: NormalizedPlannerSlot,
    preserve: boolean): { inventory: ProjectedInventory; ranked: RankedRecipeCandidate | null; deltas: readonly ProjectedInventoryDelta[]; warning?: string } | null => {
    if (!preserve && evaluations >= FAMILY_SEARCH_LIMITS.evaluations) { searchLimited = true; return null; }
    evaluations++;
    const rows = projectInventoryRows(inventory);
    const scoped = readPlanningContext(context);
    let candidate: RecipeCandidate | null = null;
    let ranked: RankedRecipeCandidate | null = null;
    let warning: string | undefined;
    if (component.kind === 'recipe') {
      const definition = scoped.catalog.recipes.find((recipe) => recipe.id === component.recipeId);
      if (!definition) return preserve ? { inventory, ranked, deltas: [], warning: 'LOCKED_COMPONENT_UNAVAILABLE' } : null;
      const generation = generateRecipeCandidates({ catalog: { ...scoped.catalog, recipes: [definition], families: [] },
        inventory: rows.map((row) => ({ ...row, freshness: row.freshness ?? undefined })), householdId: scoped.rankingContext.householdId,
        asOfDate: slot.date, requestedServings: slot.servings, mode: preserve ? 'shopping_allowed' : request.mode,
        allocationPolicy: 'expiry_first', substitutions: scoped.substitutions, approvedSubstitutionIds: scoped.approvedSubstitutionIds,
        activeConstraints: scoped.activeConstraints });
      const evidence = scoped.evidenceProvider ? createRankingEvidenceSnapshot(generation, scoped.evidenceProvider) : undefined;
      ranked = rankRecipeCandidates({ generation, context: scoped.rankingContext, referenceDate: slot.date,
        referenceTime: slot.instant, profile: { ...scoped.rankingProfile, cuisineRepetitionStrength: 0 }, evidence }).ranked[0] ?? null;
      candidate = ranked?.candidate ?? generation.candidates[0] ?? null;
      if ((!ranked || candidate?.coverage.unresolvedRequiredCount) && !preserve) return null;
      if (preserve && !recipeRestrictions({ context, recipe: definition, slot, inventory: rows }).allowed) {
        warning = 'LOCKED_COMPONENT_REQUIRES_REVALIDATION';
        ranked = null;
      }
    } else {
      const food = getSimpleFood(component.simpleFoodId!);
      if (!food) return preserve ? { inventory, ranked, deltas: [], warning: 'LOCKED_COMPONENT_UNAVAILABLE' } : null;
      const policies = resolveRankingPreferences(scoped.rankingContext).hard;
      if (!simpleFoodRestrictions(food, policies).allowed) {
        if (!preserve) return null;
        warning = 'LOCKED_COMPONENT_REQUIRES_REVALIDATION';
      }
      const definition = simpleFoodDefinition(food);
      // Untracked simple foods are explicit manual choices, never an automatic way to hide demand.
      if (!definition) return preserve ? { inventory, ranked, deltas: [], warning: 'UNTRACKED_COMPONENT' } : null;
      candidate = evaluateDefinition(evaluationScope(context), definition, rows, slot.date, slot.servings);
      if (!candidate || (candidate.coverage.unresolvedRequiredCount && !preserve) || (!preserve && request.mode === 'cook_now' && !candidate.canCookWithoutBuying)) return null;
    }
    if (!candidate) return preserve ? { inventory, ranked, deltas: [], warning: 'LOCKED_COMPONENT_REQUIRES_REVALIDATION' } : null;
    if (preserve && request.mode === 'cook_now' && !candidate.canCookWithoutBuying) warning = 'LOCKED_COMPONENT_REQUIRES_SHOPPING';
    let applied;
    try { applied = applyProjectedConsumption(inventory, candidate, slot.date); }
    catch (error) {
      if (!(error instanceof InventoryProjectionError)) throw error;
      return preserve ? { inventory, ranked: null, deltas: [], warning: 'LOCKED_COMPONENT_PROJECTION_UNRESOLVED' } : null;
    }
    return { inventory: applied.state, ranked, deltas: applied.deltas,
      ...(warning || (preserve && !ranked && component.kind === 'recipe') ? { warning: warning ?? 'LOCKED_COMPONENT_REQUIRES_REVALIDATION' } : {}) };
  };
  for (const slot of request.slots) {
    const scopedContext = createPlanningContext(() => ({ snapshotId: source.snapshotId, referenceInstant: new Date(Date.parse(source.reference.instant) + source.reference.utcOffsetMinutes * 60_000).toISOString().replace('Z', '')
        + (source.reference.utcOffsetMinutes < 0 ? '-' : '+') + String(Math.floor(Math.abs(source.reference.utcOffsetMinutes) / 60)).padStart(2, '0')
        + ':' + String(Math.abs(source.reference.utcOffsetMinutes) % 60).padStart(2, '0'),
      catalog: source.catalog, inventory: projectInventoryRows(source.inventory).map(({ initialQuantity: _initial, consumedQuantity: _consumed, ...row }) => row),
      rankingContext: contextForSlot(source.rankingContext, slot), rankingProfile: { ...source.rankingProfile, cuisineRepetitionStrength: 0 },
      evidenceProvider: source.evidenceProvider, substitutions: source.substitutions, approvedSubstitutionIds: source.approvedSubstitutionIds,
      activeConstraints: source.activeConstraints }));
    const hardLimits = resolveRankingPreferences(readPlanningContext(scopedContext).rankingContext).hard
      .flatMap((policy) => policy.hardMaxTimeMinutes === undefined ? [] : [policy.hardMaxTimeMinutes]);
    const hardMaxTimeMinutes = hardLimits.length ? Math.min(...hardLimits) : undefined;
    const wanted = familyMealRoles(slot.mealType, input.preferences.mealStyle);
    const nextWeek: Branch[] = [];
    for (const week of frontier) {
      const locked = [...(input.locked?.get(slot.id) ?? [])];
      let base: MealBranch = { inventory: week.inventory, components: [], score: 0, anchor: null, anchorDeltas: [], international: 0, warnings: [] };
      for (const component of locked) {
        const evaluated = evaluate(scopedContext, component, base.inventory, slot, true);
        base = { ...base, components: [...base.components, component], inventory: evaluated?.inventory ?? base.inventory,
          anchor: component.role === 'main' ? evaluated?.ranked ?? null : base.anchor,
          anchorDeltas: component.role === 'main' ? evaluated?.deltas ?? [] : base.anchorDeltas,
          warnings: [...base.warnings, ...(evaluated?.warning ? [evaluated.warning] : [])] };
      }
      if (hardMaxTimeMinutes !== undefined && locked.length) {
        const minutes = locked.map(componentMinutes);
        if (minutes.some((value) => value === null) || minutes.reduce((sum: number, value) => sum + (value ?? 0), 0) > hardMaxTimeMinutes) {
          base.warnings.push('LOCKED_MEAL_TIME_REQUIRES_REVALIDATION');
        }
      }
      const preferredMinutes = slot.preferredTimeMinutes ?? input.preferences.preferredTimeMinutes;
      base.score -= mealEffort(base.components, preferredMinutes);
      const previousMain = week.meals.at(-1)?.components.find((component) => component.role === 'main' && component.recipeId);
      const previousProtein = previousMain?.recipeId ? input.roles.get(previousMain.recipeId)?.dominantIngredientId : null;
      const companionCounts = new Map<string, number>();
      for (const component of week.meals.flatMap(meal => meal.components)) {
        const key = targetKey(component);
        companionCounts.set(key, (companionCounts.get(key) ?? 0) + 1);
      }
      const candidateUtility = (candidate: ComposerCandidate, role: MealRole) => {
        const recipe = candidate.kind === 'recipe' ? runtime.get(candidate.id) : undefined;
        const regional = recipe?.region && input.preferences.preferredRegions.includes(recipe.region as 'bac' | 'trung' | 'nam') ? 0.04 : 0;
        const repeated = role === 'main' && week.usedMains.has(candidate.id) ? 0.2 : 0;
        const adjacent = role === 'main' && previousMain?.recipeId === candidate.id ? 0.8 : 0;
        const protein = role === 'main' && previousProtein && candidate.dominantIngredientId === previousProtein ? 0.08 : 0;
        const method = role === 'main' && recipe?.category && previousMain?.recipeId
          && runtime.get(previousMain.recipeId)?.category === recipe.category ? 0.03 : 0;
        const companionRepeat = role !== 'staple' && role !== 'main' && week.meals.at(-1)?.components.some((component) => targetKey(component) === candidate.key) ? 0.08 : 0;
        const companionWeekRepeat = role !== 'staple' && role !== 'main'
          ? 0.15 * (companionCounts.get(candidate.key) ?? 0) : 0;
        const canh = role === 'soup' && input.preferences.mealStyle === 'family'
          && recipe?.cuisine === 'vietnamese' && /^canh\b/.test(normalizeText(recipe.title)) ? 0.08 : 0;
        const definition = source.catalog.recipes.find((entry) => entry.id === candidate.id);
        const minutes = candidate.kind === 'simple_food' ? getSimpleFood(candidate.id)?.prepMinutes ?? null
          : definition?.prepTimeMinutes === undefined ? null : definition.prepTimeMinutes + definition.cookTimeMinutes;
        const effort = minutes === null ? 0.2 : 0.1 * Math.min(minutes / preferredMinutes, 6)
          + 0.6 * Math.min(Math.max(minutes - preferredMinutes, 0) / preferredMinutes, 3);
        return candidate.preference + (candidate.coverage ?? 0) * 0.15 + regional + canh
          - repeated - adjacent - protein - method - companionRepeat - companionWeekRepeat - effort;
      };
      let meals: MealBranch[] = [base];
      for (const role of wanted) {
        const nextMeals: MealBranch[] = [];
        for (const meal of meals) {
          if (covered(meal.components, slot).has(role)) { nextMeals.push(meal); continue; }
          if (evaluations >= FAMILY_SEARCH_LIMITS.evaluations || poolBuilds >= FAMILY_SEARCH_LIMITS.poolBuilds) {
            searchLimited = true; nextMeals.push(meal); continue;
          }
          poolBuilds++;
          const pool = prepareComposerCandidates({ context: scopedContext, roleIndex: input.roles, slot,
            inventory: projectInventoryRows(meal.inventory), roles: [role], mode: request.mode,
            excludeKeys: new Set(meal.components.map(targetKey)), usedElsewhere: new Set([...week.usedMains].map(recipeKey)) });
          const candidates = pool.filter((candidate) => {
            if (!candidate.roles.includes(role) || meal.components.some((component) => targetKey(component) === candidate.key)) return false;
            if (candidate.kind === 'simple_food') return candidate.id !== 'sf-bread';
            const recipe = runtime.get(candidate.id);
            if (!recipe || (recipe.category === 'mon_lau_tiec' && input.preferences.mealStyle !== 'one_pot')) return false;
            if (role !== 'main' && recipe.cuisine !== 'vietnamese') {
              const main = meal.components.find((component) => component.role === 'main');
              const cuisine = main?.recipeId ? runtime.get(main.recipeId)?.cuisine : null;
              if (!cuisine || cuisine === 'vietnamese' || recipe.cuisine !== cuisine || !input.preferences.preferredCuisines.includes(recipe.cuisine)) return false;
            }
            if (role === 'main') {
              if (recipe.cuisine !== 'vietnamese' && (!internationalAllowed(week.internationalDates, slot.date)
                || !input.preferences.preferredCuisines.includes(recipe.cuisine))) return false;
              if (slot.mealType === 'breakfast' && !candidate.traits.includes('complete_meal') && recipe.category !== 'mon_nhanh_sang') return false;
              if (slot.mealType !== 'breakfast' && input.preferences.mealStyle === 'family' && candidate.traits.includes('complete_meal')) return false;
              if (input.preferences.mealStyle === 'one_pot' && !candidate.traits.includes('complete_meal')) return false;
            }
            return true;
          }).sort((a, b) => candidateUtility(b, role) - candidateUtility(a, role) || compareIds(a.key, b.key)).slice(0, role === 'main' ? FAMILY_SEARCH_LIMITS.mains : FAMILY_SEARCH_LIMITS.perRole);
          let added = false;
          for (const candidate of candidates) {
            const component: MealComponent = { id: `family.${slot.id}.r${input.revision}.${role}.${planningFingerprint(candidate.key)}`, kind: candidate.kind,
              recipeId: candidate.kind === 'recipe' ? candidate.id : null, simpleFoodId: candidate.kind === 'simple_food' ? candidate.id : null,
              role, ordinal: meal.components.length, locked: false, provenance: 'auto', createdRevision: input.revision, updatedRevision: input.revision };
            const components = [...meal.components, component];
            if (hasHardIssue(compatibilityIssues(items(components)))) continue;
            const evaluated = evaluate(scopedContext, component, meal.inventory, slot, false);
            if (!evaluated) continue;
            const allMinutes = components.map(componentMinutes);
            if (hardMaxTimeMinutes !== undefined && (allMinutes.some((minutes) => minutes === null)
              || allMinutes.reduce((sum: number, minutes) => sum + (minutes ?? 0), 0) > hardMaxTimeMinutes)) continue;
            const score = 10 + candidateUtility(candidate, role)
              - mealEffort(components, preferredMinutes) + mealEffort(meal.components, preferredMinutes);
            nextMeals.push({ ...meal, inventory: evaluated.inventory, components, score: meal.score + score,
              anchor: role === 'main' ? evaluated.ranked : meal.anchor, anchorDeltas: role === 'main' ? evaluated.deltas : meal.anchorDeltas,
              international: meal.international + (role === 'main' && candidate.kind === 'recipe' && runtime.get(candidate.id)?.cuisine !== 'vietnamese' ? 1 : 0) });
            added = true;
          }
          if (!added) nextMeals.push(meal);
        }
        meals = nextMeals.sort((a, b) => b.score - a.score || compareIds(rankKey(a), rankKey(b))).slice(0, FAMILY_SEARCH_LIMITS.mealBeam);
      }
      for (const meal of meals) {
        const components = normalizeComponents(meal.components);
        const missing = wanted.filter((role) => !covered(components, slot).has(role));
        const usedMains = new Set(week.usedMains);
        for (const component of components) if (component.role === 'main' && component.recipeId) usedMains.add(component.recipeId);
        const minutes = components.map(componentMinutes);
        const timeWarnings = minutes.some((value) => value === null) ? ['MEAL_TIME_UNKNOWN']
          : minutes.reduce((sum: number, value) => sum + (value ?? 0), 0) > preferredMinutes ? ['MEAL_TIME_ABOVE_PREFERENCE'] : [];
        const internationalDates = [...week.internationalDates, ...Array.from({ length: meal.international }, () => slot.date)];
        const capWarnings = components.some(component => component.role === 'main' && component.recipeId
          && runtime.has(component.recipeId) && runtime.get(component.recipeId)?.cuisine !== 'vietnamese')
          && familyInternationalCapExceeded(internationalDates, slot.date, input.preferences.internationalMealsPerWeek)
          ? ['PRESERVED_INTERNATIONAL_CAP_EXCEEDED'] : [];
        nextWeek.push({ inventory: meal.inventory, score: week.score + meal.score, international: week.international + meal.international,
          internationalDates,
          usedMains, meals: [...week.meals, { slot, components, anchor: meal.anchor, anchorDeltas: meal.anchorDeltas, missingRoles: missing,
            warnings: [...meal.warnings, ...timeWarnings, ...capWarnings, ...missing.map((role) => `ROLE_UNFILLED:${role}`)] }] });
      }
    }
    frontier = nextWeek.sort((a, b) => b.score - a.score || compareIds(a.meals.flatMap((meal) => meal.components.map(targetKey)).join('|'),
      b.meals.flatMap((meal) => meal.components.map(targetKey)).join('|'))).slice(0, FAMILY_SEARCH_LIMITS.weekBeam);
  }
  const unique = frontier.filter((entry, index) => frontier.findIndex((other) =>
    canonicalMealKey(other.meals) === canonicalMealKey(entry.meals)) === index);
  const offset = Math.abs(Math.floor(input.variant ?? 0)) % unique.length;
  const alternatives = [...unique.slice(offset), ...unique.slice(0, offset)];
  const best = alternatives[0];
  return { request, reference: source.reference, meals: best.meals, finalInventory: projectInventoryRows(best.inventory),
    internationalGeneratedMainCount: best.international, lockedInternationalMainCount: best.meals.flatMap((meal) => meal.components)
      .filter((component) => component.locked && component.role === 'main' && component.recipeId && runtime.has(component.recipeId) && runtime.get(component.recipeId)?.cuisine !== 'vietnamese').length,
    evaluations, searchLimited, poolBuilds, alternativeMeals: alternatives.map((entry) => entry.meals) };
}
