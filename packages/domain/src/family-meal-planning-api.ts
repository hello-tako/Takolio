import { z } from 'zod';
import { MealPlanDtoSchema } from './meal-planning-api';
import { PlanCompositionsDtoSchema } from './meal-composition-api';
import { CULINARY_REGIONS, GLOBAL_CUISINES, MEAL_CULTURES } from './family-preferences-api';

export const FamilyMealPolicySchema = z.object({
  mealStyle: z.enum(['family', 'quick', 'one_pot']),
  mealCulture: z.enum(MEAL_CULTURES).optional(),
  preferredRegions: z.array(z.enum(CULINARY_REGIONS)).max(8),
  internationalMealsPerWeek: z.number().int().min(0).max(21),
  internationalGeneratedMainCount: z.number().int().nonnegative(),
  lockedInternationalMainCount: z.number().int().nonnegative(),
  defaultCuisine: z.enum(GLOBAL_CUISINES),
  profileRevision: z.number().int().safe().nonnegative(),
}).strict();
export const FamilyMealDiagnosticsSchema = z.object({
  completeMealCount: z.number().int().nonnegative(),
  partialMealCount: z.number().int().nonnegative(),
  unplannedMealCount: z.number().int().nonnegative(),
  reasons: z.array(z.string().min(1).max(200)),
  searchLimited: z.boolean(),
}).strict();
export const FamilyMealPlanDtoSchema = z.object({
  schemaVersion: z.literal(2),
  plan: MealPlanDtoSchema,
  compositions: PlanCompositionsDtoSchema,
  policy: FamilyMealPolicySchema,
  diagnostics: FamilyMealDiagnosticsSchema,
  familyPreferenceFreshness: z.enum(['fresh', 'requires_revalidation']),
}).strict().superRefine((value, ctx) => {
  if (value.plan.id !== value.compositions.planId || value.plan.revision !== value.compositions.planRevision) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Composition and plan must have the same identity and revision' });
  }
});
export type FamilyMealPlanDto = z.infer<typeof FamilyMealPlanDtoSchema>;
export const CurrentFamilyMealPlanDtoSchema = z.object({ plan: FamilyMealPlanDtoSchema.nullable() }).strict();
