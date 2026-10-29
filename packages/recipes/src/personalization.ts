import { z } from 'zod';
import { OffsetDateTimeSchema, CanonicalIngredientIdSchema, CatalogIdSchema } from '../../domain/src/foundation';

export const NutrientSchema = z.enum(['energyKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fiberG', 'sugarG', 'sodiumMg']);
export type RankingNutrient = z.infer<typeof NutrientSchema>;
export const MealNutrientTargetSchema = z.object({
  nutrient: NutrientSchema,
  min: z.number().finite().nonnegative().max(1e9).default(0),
  max: z.number().finite().nonnegative().max(1e9),
  hard: z.boolean().default(false),
  allowEstimates: z.boolean().default(false),
}).strict().refine((value) => value.min <= value.max, 'Meal target range is reversed');

const ids = z.array(CatalogIdSchema).max(200).default([]);
const ingredients = z.array(CanonicalIngredientIdSchema).max(200).default([]);
export const RankingPreferencesSchema = z.object({
  preferredCuisines: ids,
  avoidedCuisines: ids,
  likedIngredientIds: ingredients,
  dislikedIngredientIds: ingredients,
  forbiddenIngredientIds: ingredients,
  neverRecommendRecipeIds: ids,
  allergens: ids,
  requiredDietaryTags: ids,
  preferredTimeMinutes: z.number().int().min(1).max(1440).optional(),
  hardMaxTimeMinutes: z.number().int().min(1).max(1440).optional(),
  mealNutritionTargets: z.array(MealNutrientTargetSchema).max(7).default([]),
}).strict().refine((value) => new Set(value.mealNutritionTargets.map((target) => target.nutrient)).size ===
  value.mealNutritionTargets.length, 'Duplicate meal nutrient target');
export type RankingPreferences = z.infer<typeof RankingPreferencesSchema>;
export const ScopedRankingPreferencesSchema = z.object({
  householdId: CatalogIdSchema,
  userId: CatalogIdSchema.nullable(),
  values: RankingPreferencesSchema,
}).strict();

export const RecipeIdentitySchema = z.object({
  kind: z.enum(['recipe', 'family']),
  id: CatalogIdSchema,
}).strict();
// Context event identities are namespaced projections, not catalog IDs.
export const RankingEventIdSchema = z.string().trim().min(1).max(210)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_:-]*$/);
export const RecipeFeedbackSchema = z.object({
  id: RankingEventIdSchema,
  householdId: CatalogIdSchema,
  userId: CatalogIdSchema,
  type: z.enum(['liked', 'disliked', 'cooked', 'skipped', 'swapped']),
  target: RecipeIdentitySchema,
  occurredAt: OffsetDateTimeSchema,
  replacement: RecipeIdentitySchema.optional(),
  familyId: CatalogIdSchema.optional(),
  cuisine: CatalogIdSchema.optional(),
}).strict().refine((value) => (value.type === 'swapped') === (value.replacement !== undefined),
  'Only swapped feedback requires a replacement');
export type RecipeFeedback = z.infer<typeof RecipeFeedbackSchema>;
export const RankingContextSchema = z.object({
  householdId: CatalogIdSchema,
  userId: CatalogIdSchema,
  preferences: z.array(ScopedRankingPreferencesSchema).max(2).default([]),
  feedback: z.array(RecipeFeedbackSchema).default([]),
}).strict().superRefine((context, ctx) => {
  const scopes = new Set<string | null>();
  for (const row of context.preferences) {
    if (row.householdId !== context.householdId || (row.userId !== null && row.userId !== context.userId) || scopes.has(row.userId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ambiguous or unauthorized preference scope' });
    }
    scopes.add(row.userId);
  }
  const eventIds = new Set<string>();
  for (const event of context.feedback) {
    // Cooked meals are explicitly household-shared; tastes/skips/swaps are personal.
    if (event.householdId !== context.householdId || (event.type !== 'cooked' && event.userId !== context.userId) || eventIds.has(event.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ambiguous or unauthorized feedback scope' });
    }
    eventIds.add(event.id);
  }
});
export type RankingContext = z.infer<typeof RankingContextSchema>;

export function resolveRankingPreferences(context: RankingContext) {
  const household = context.preferences.find((row) => row.userId === null)?.values;
  const individual = context.preferences.find((row) => row.userId === context.userId)?.values;
  const empty = RankingPreferencesSchema.parse({});
  return {
    // A personal snapshot replaces household soft defaults; hard policies accumulate.
    soft: individual ?? household ?? empty,
    hard: [household, individual].filter((value): value is RankingPreferences => value !== undefined),
    explicit: individual !== undefined || household !== undefined,
  };
}
