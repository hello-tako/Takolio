import { z } from 'zod';
import { CanonicalIngredientIdSchema, CatalogIdSchema } from './foundation';
import { DIETARY_PROFILES } from './allergens';

export const MEAL_CULTURES = [
  'vn_family',
  'jp_home',
  'eu_plated',
  'eu_continental',
  'eu_mediterranean',
  'global_balanced',
] as const;
export type MealCulture = (typeof MEAL_CULTURES)[number];

export const GLOBAL_CUISINES = [
  'vietnamese',
  'korean',
  'japanese',
  'chinese',
  'thai',
  'italian',
  'french',
  'german',
  'spanish',
  'mediterranean',
  'european',
  'american',
  'indian',
  'mexican',
] as const;
export type GlobalCuisine = (typeof GLOBAL_CUISINES)[number];

export const CULINARY_REGIONS = [
  'bac',
  'trung',
  'nam',
  'jp_kanto',
  'jp_kansai',
  'jp_kyushu',
  'jp_hokkaido',
  'eu_north',
  'eu_central',
  'eu_south',
  'eu_west',
] as const;
export type CulinaryRegion = (typeof CULINARY_REGIONS)[number];

export const FamilyPreferencesSchema = z.object({
  householdSize: z.number().int().min(1).max(20).default(2),
  mealCulture: z.enum(MEAL_CULTURES).optional(),
  preferredRegions: z.array(z.enum(CULINARY_REGIONS)).max(8).default([]),
  internationalMealsPerWeek: z.number().int().min(0).max(21).default(0),
  preferredCuisines: z.array(z.enum(GLOBAL_CUISINES)).max(14).default(['vietnamese']),
  mealStyle: z.enum(['family', 'quick', 'one_pot']).default('family'),
  cookingMealTypes: z.array(z.enum(['breakfast', 'lunch', 'dinner'])).min(1).max(3).default(['dinner']),
  cookingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
  preferredTimeMinutes: z.number().int().min(5).max(180).default(45),
  shoppingCadence: z.enum(['daily', 'every_2_3_days', 'weekly']).default('every_2_3_days'),
  dislikedIngredientIds: z.array(CanonicalIngredientIdSchema).max(100).default([]),
  forbiddenIngredientIds: z.array(CanonicalIngredientIdSchema).max(100).optional(),
  allergens: z.array(CatalogIdSchema).max(50).optional(),
  dietaryProfile: z.array(z.enum(DIETARY_PROFILES)).max(10).optional(),
  bentoFromDinner: z.boolean().optional(),
}).strict().superRefine((value, ctx) => {
  for (const key of ['preferredRegions', 'preferredCuisines', 'cookingMealTypes', 'cookingDays', 'dislikedIngredientIds', 'forbiddenIngredientIds', 'allergens', 'dietaryProfile'] as const) {
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
