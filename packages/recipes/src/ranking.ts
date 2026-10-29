import { z } from 'zod';
import { OffsetDateTimeSchema } from '../../domain/src/foundation';
import { compareIds } from '../../domain/src/availability';
import { getCandidateSnapshotContext, type CandidateGenerationResult, type RecipeCandidate } from './candidates';
import { RankingContextSchema, resolveRankingPreferences } from './personalization';
import { evaluateRankingEligibility } from './ranking-eligibility';
import { readRankingEvidenceSnapshot, nutritionFacts, scoreNutrition, type RankingEvidenceSnapshot } from './ranking-evidence';
import { buildHistoryIndex, candidateHistoryFeatures, cookingTimeFeatures, expiryFeatures,
  inventoryFeatures, preferenceFeatures } from './ranking-features';
import { aggregateRankingScore, BALANCED_RANKING_PROFILE, RankingProfileSchema, type RankingComponents } from './ranking-policy';

export interface RecipeRankingInput {
  generation: CandidateGenerationResult;
  context: z.input<typeof RankingContextSchema>;
  referenceDate: string;
  referenceTime: string;
  profile?: z.input<typeof RankingProfileSchema>;
  evidence?: RankingEvidenceSnapshot;
}
export type RankingReason = 'USES_EXPIRING_INGREDIENTS' | 'MATCHES_PREFERRED_CUISINE' | 'AVOIDED_CUISINE'
  | 'LIKED_RECIPE' | 'DISLIKED_RECIPE' | 'LIKED_INGREDIENT' | 'DISLIKED_INGREDIENT'
  | 'RECENTLY_EATEN' | 'RECENT_FAMILY_OR_CUISINE' | 'RECENT_SKIP_OR_SWAP'
  | 'REQUIRES_SHOPPING' | 'USES_SUBSTITUTION' | 'AVAILABILITY_UNRESOLVED'
  | 'COOK_TIME_ABOVE_PREFERENCE' | 'COOK_TIME_PARTIAL' | 'COOK_TIME_UNKNOWN'
  | 'NUTRITION_DATA_PARTIAL' | 'NUTRITION_DATA_UNKNOWN' | 'NUTRITION_ESTIMATED'
  | 'SEARCH_TRUNCATED' | 'COLD_START';

export interface RankedRecipeCandidate {
  rank: number;
  candidate: RecipeCandidate;
  finalScore: number;
  components: RankingComponents;
  contributions: RankingComponents;
  profileId: string;
  eligibility: ReturnType<typeof evaluateRankingEligibility>;
  reasons: RankingReason[];
  facts: {
    inventory: ReturnType<typeof inventoryFeatures>;
    expiry: ReturnType<typeof expiryFeatures>;
    preference: ReturnType<typeof preferenceFeatures>;
    history: ReturnType<typeof candidateHistoryFeatures>;
    cookingTime: ReturnType<typeof cookingTimeFeatures>;
    nutrition: ReturnType<typeof nutritionFacts> & { fit: ReturnType<typeof scoreNutrition> };
  };
  dataCoverage: { availability: number; expiry: number; nutrition: number | null; cookingTime: number; preferences: number };
}

export function rankRecipeCandidates(input: RecipeRankingInput) {
  const context = RankingContextSchema.parse(input.context);
  const referenceTime = OffsetDateTimeSchema.parse(input.referenceTime);
  const referenceDate = z.string().date().parse(input.referenceDate);
  const snapshot = getCandidateSnapshotContext(input.generation);
  if (snapshot.householdId === null || snapshot.householdId !== context.householdId || snapshot.asOfDate !== referenceDate) {
    throw new Error('Ranking requires the same authorized household and T02 as-of date');
  }
  const profile = RankingProfileSchema.parse(input.profile ?? BALANCED_RANKING_PROFILE);
  const preferences = resolveRankingPreferences(context);
  const historyIndex = buildHistoryIndex(context, referenceTime, profile);
  const evidenceIndex = readRankingEvidenceSnapshot(input.evidence, input.generation);
  const ranked: RankedRecipeCandidate[] = [];
  const excluded: Array<{ candidate: RecipeCandidate; reasons: ReturnType<typeof evaluateRankingEligibility>['reasons'];
    eligibility: ReturnType<typeof evaluateRankingEligibility> }> = [];
  for (const candidate of input.generation.candidates) {
    const evidence = evidenceIndex.get(candidate.id);
    const nutrition = nutritionFacts(evidence);
    const eligibility = evaluateRankingEligibility(candidate, snapshot.mode, preferences.hard, evidence, nutrition);
    if (!eligibility.eligible) { excluded.push({ candidate, reasons: eligibility.reasons, eligibility }); continue; }
    const inventory = inventoryFeatures(candidate);
    const expiry = expiryFeatures(candidate, referenceDate, profile);
    const history = candidateHistoryFeatures(candidate, historyIndex, profile);
    const preference = preferenceFeatures(candidate, preferences.soft, history);
    const time = cookingTimeFeatures(candidate, preferences.soft);
    const fit = scoreNutrition(nutrition, preferences.soft.mealNutritionTargets);
    const components: RankingComponents = { inventoryFit: inventory.fit, expiryPriority: expiry.score,
      preferenceFit: preference.score, nutritionFit: fit.score, cookingTimeFit: time.score,
      variety: history.variety, recentMealPenalty: history.exactRecency,
      shoppingBurden: inventory.shoppingBurden, substitutionPenalty: inventory.substitutionPenalty };
    const reasons: RankingReason[] = [];
    if (expiry.score > 0) reasons.push('USES_EXPIRING_INGREDIENTS');
    if (preference.preferredCuisine) reasons.push('MATCHES_PREFERRED_CUISINE');
    if (preference.avoidedCuisine) reasons.push('AVOIDED_CUISINE');
    if (preference.explicitTaste === 'liked') reasons.push('LIKED_RECIPE');
    if (preference.explicitTaste === 'disliked') reasons.push('DISLIKED_RECIPE');
    if (preference.likedIngredients.length) reasons.push('LIKED_INGREDIENT');
    if (preference.dislikedIngredients.length) reasons.push('DISLIKED_INGREDIENT');
    if (preference.weakPenaltyApplied > 0) reasons.push('RECENT_SKIP_OR_SWAP');
    if (history.exactRecency > 0) reasons.push('RECENTLY_EATEN');
    if (history.variety < 1) reasons.push('RECENT_FAMILY_OR_CUISINE');
    if (inventory.shoppingBurden > 0) reasons.push('REQUIRES_SHOPPING');
    if (inventory.substitutionPenalty > 0) reasons.push('USES_SUBSTITUTION');
    if (candidate.coverage.unresolvedRequiredCount > 0) reasons.push('AVAILABILITY_UNRESOLVED');
    if (time.abovePreference) reasons.push('COOK_TIME_ABOVE_PREFERENCE');
    if (time.coverage < 1) reasons.push(time.coverage === 0 ? 'COOK_TIME_UNKNOWN' : 'COOK_TIME_PARTIAL');
    if (fit.coverage !== null && fit.coverage < 1) reasons.push(fit.coverage === 0 ? 'NUTRITION_DATA_UNKNOWN' : 'NUTRITION_DATA_PARTIAL');
    if (nutrition.profile?.sourceType === 'estimated') reasons.push('NUTRITION_ESTIMATED');
    if (input.generation.truncated) reasons.push('SEARCH_TRUNCATED');
    if (!preferences.explicit && !context.feedback.length) reasons.push('COLD_START');
    ranked.push({ rank: 0, candidate, ...aggregateRankingScore(components, profile), components,
      profileId: profile.id, eligibility, reasons: reasons.sort(compareIds),
      facts: { inventory, expiry, preference, history, cookingTime: time, nutrition: { ...nutrition, fit } },
      dataCoverage: { availability: inventory.coverage, expiry: expiry.coverage, nutrition: fit.coverage,
        cookingTime: time.coverage, preferences: preferences.explicit || history.explicitTaste !== null ? 1 : 0 } });
  }
  ranked.sort((a, b) => b.finalScore - a.finalScore || b.components.inventoryFit - a.components.inventoryFit ||
    compareIds(a.candidate.source.sourceId, b.candidate.source.sourceId) || compareIds(a.candidate.id, b.candidate.id));
  ranked.forEach((item, index) => { item.rank = index + 1; });
  excluded.sort((a, b) => compareIds(a.candidate.id, b.candidate.id));
  return { ranked, excluded, generation: input.generation, familySearches: input.generation.familySearches,
    truncated: input.generation.truncated, searchExhaustive: input.generation.familySearches.every((search) => search.exhaustive),
    context: { householdId: context.householdId, userId: context.userId, referenceDate, referenceTime }, profile };
}
