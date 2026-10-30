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
import { fetchPlannerJson } from './planner-http';
const plans = '/meal-planning/plans';
const planPath = (id: string) => `${plans}/${encodeURIComponent(PlanIdSchema.parse(id))}`;
export const familyMealPlanningApi = {
  async generate(intent: MealPlanningIntent, key: string) {
    return FamilyMealPlanDtoSchema.parse(
      await fetchPlannerJson(
        plans,
        {
          method: 'POST',
          body: JSON.stringify(MealPlanningIntentSchema.parse(intent)),
          headers: { Accept: 'application/json; recipe-content=1', 'Idempotency-Key': PlanningRequestKeySchema.parse(key) },
        },
        'v2',
      ),
    );
  },
  async createManual(intent: MealPlanningIntent, key: string) {
    return FamilyMealPlanDtoSchema.parse(
      await fetchPlannerJson('/meal-planning/drafts', {
        method: 'POST', body: JSON.stringify(MealPlanningIntentSchema.parse(intent)),
        headers: { Accept: 'application/json; recipe-content=1', 'Idempotency-Key': PlanningRequestKeySchema.parse(key) },
      }, 'v2'),
    );
  },
  async get(id: string) {
    const result = FamilyMealPlanDtoSchema.parse(
      await fetchPlannerJson(planPath(id), { cache: 'no-store', headers: { Accept: 'application/json; recipe-content=1' } }, 'v2'),
    );
    if (result.plan.id !== id) throw new Error('Plan identity mismatch');
    return result;
  },
  async current() {
    return CurrentFamilyMealPlanDtoSchema.parse(
      await fetchPlannerJson(`${plans}/current`, { cache: 'no-store', headers: { Accept: 'application/json; recipe-content=1' } }, 'v2'),
    );
  },
  async regenerate(id: string, revision: number) {
    const result = FamilyMealPlanDtoSchema.parse(
      await fetchPlannerJson(
        `${planPath(id)}/regenerate`,
        { method: 'POST', body: JSON.stringify(RegenerateMealPlanSchema.parse({ revision })), headers: { Accept: 'application/json; recipe-content=1' } },
        'v2',
      ),
    );
    if (result.plan.id !== id || result.plan.revision <= revision)
      throw new Error('Plan revision mismatch');
    return result;
  },
};
