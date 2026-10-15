import { z } from 'zod';
import { CanonicalIngredientIdSchema, CatalogIdSchema } from './foundation';

export const FamilyPreferencesSchema = z.object({
  householdSize: z.number().int().min(1).max(20).default(2),
  preferredRegions: z.array(z.enum(['bac', 'trung', 'nam'])).max(3).default([]),
  internationalMealsPerWeek: z.number().int().min(0).max(7).default(0),
  preferredCuisines: z.array(z.enum(['vietnamese', 'korean', 'japanese', 'chinese', 'thai', 'italian'])).max(6).default(['vietnamese']),
  mealStyle: z.enum(['family', 'quick', 'one_pot']).default('family'),
  cookingMealTypes: z.array(z.enum(['breakfast', 'lunch', 'dinner'])).min(1).max(3).default(['dinner']),
  cookingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
  preferredTimeMinutes: z.number().int().min(15).max(180).default(45),
  shoppingCadence: z.enum(['daily', 'every_2_3_days', 'weekly']).default('every_2_3_days'),
  dislikedIngredientIds: z.array(CanonicalIngredientIdSchema).max(100).default([]),
  forbiddenIngredientIds: z.array(CanonicalIngredientIdSchema).max(100).optional(),
  allergens: z.array(CatalogIdSchema).max(30).optional(),
}).strict().superRefine((value, ctx) => {
  for (const key of ['preferredRegions', 'preferredCuisines', 'cookingMealTypes', 'cookingDays', 'dislikedIngredientIds', 'forbiddenIngredientIds', 'allergens'] as const) {
    if (new Set<string | number>(value[key] ?? []).size !== (value[key] ?? []).length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Duplicate preference' });
  }
});
export type FamilyPreferences = z.infer<typeof FamilyPreferencesSchema>;
export const FamilyPreferencesDtoSchema = z.object({
  revision: z.number().int().safe().nonnegative(),
  preferences: FamilyPreferencesSchema,
}).strict();
export type FamilyPreferencesDto = z.infer<typeof FamilyPreferencesDtoSchema>;
export const SaveFamilyPreferencesSchema = z.object({
  expectedRevision: z.number().int().safe().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  preferences: FamilyPreferencesSchema,
}).strict();
