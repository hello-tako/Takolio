import {
  FamilyMealPlanDtoSchema,
  CurrentFamilyMealPlanDtoSchema,
} from '../../../packages/domain/src/family-meal-planning-api';
import {
  MealPlanningIntentSchema,
  PlanIdSchema,
  PlanningRequestKeySchema,
  RegenerateMealPlanSchema,
  type MealPlanningIntent,
} from '../../../packages/domain/src/meal-planning-api';
import { fetchJson } from './http';
const plans = '/meal-planning/plans';
const planPath = (id: string) => `${plans}/${encodeURIComponent(PlanIdSchema.parse(id))}`;
export const familyMealPlanningApi = {
  async generate(intent: MealPlanningIntent, key: string) {
    return FamilyMealPlanDtoSchema.parse(
      await fetchJson(
        plans,
        {
          method: 'POST',
          body: JSON.stringify(MealPlanningIntentSchema.parse(intent)),
          headers: { 'Idempotency-Key': PlanningRequestKeySchema.parse(key) },
        },
        'v2',
      ),
    );
  },
  async get(id: string) {
    const result = FamilyMealPlanDtoSchema.parse(
      await fetchJson(planPath(id), { cache: 'no-store' }, 'v2'),
    );
    if (result.plan.id !== id) throw new Error('Plan identity mismatch');
    return result;
  },
  async current() {
    return CurrentFamilyMealPlanDtoSchema.parse(
      await fetchJson(`${plans}/current`, { cache: 'no-store' }, 'v2'),
    );
  },
  async regenerate(id: string, revision: number) {
    const result = FamilyMealPlanDtoSchema.parse(
      await fetchJson(
        `${planPath(id)}/regenerate`,
        { method: 'POST', body: JSON.stringify(RegenerateMealPlanSchema.parse({ revision })) },
        'v2',
      ),
    );
    if (result.plan.id !== id || result.plan.revision <= revision)
      throw new Error('Plan revision mismatch');
    return result;
  },
};
