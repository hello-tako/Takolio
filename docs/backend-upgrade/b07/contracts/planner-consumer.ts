import type { z } from 'zod';
import type { MealPlanningIntentSchema, RegenerateMealPlanSchema, MealPlanDto } from '../../../../packages/domain/src/meal-planning-api';
import type { CurrentMealPlanDto } from '../../../../packages/domain/src/meal-planning-presentation';

// Candidate type mapping only; existing web clients and route adapters retain authority.
export interface PlannerContractOperations {
  createPlannerPlan: { request: z.input<typeof MealPlanningIntentSchema>; response: MealPlanDto };
  getCurrentPlannerPlan: { response: CurrentMealPlanDto };
  getPlannerPlan: { response: MealPlanDto };
  regeneratePlannerPlan: { request: z.input<typeof RegenerateMealPlanSchema>; response: MealPlanDto };
}
