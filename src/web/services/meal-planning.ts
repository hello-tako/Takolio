import { z } from 'zod';
import {
  MealPlanningIntentSchema,
  MealPlanDtoSchema,
  PlanFeedbackDtoSchema,
  PlanFeedbackSchema,
  PlanIdSchema,
  PlanningRequestKeySchema,
  PlanRevisionSchema,
  PlanShoppingDtoSchema,
  RegenerateMealPlanSchema,
  SwapMealSchema,
  OptimizePlanShoppingSchema,
} from '../../../packages/domain/src/meal-planning-api';
import {
  CurrentMealPlanDtoSchema,
  PlanAlternativesDtoSchema,
  PlanAlternativesQuerySchema,
  PlanExplanationDtoSchema,
  PlanExplanationRequestSchema,
} from '../../../packages/domain/src/meal-planning-presentation';
import { fetchPlannerJson } from './planner-http';

const plansPath = '/meal-planning/plans';
const planPath = (id: string) => `${plansPath}/${encodeURIComponent(PlanIdSchema.parse(id))}`;

async function request<T>(
  path: string,
  schema: z.ZodType<T, unknown>,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set('Accept', 'application/json; recipe-content=1');
  return schema.parse(await fetchPlannerJson<unknown>(path, { ...options, headers, cache: 'no-store' }));
}

function post(body: unknown, key?: string): RequestInit {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    ...(key === undefined
      ? {}
      : { headers: { 'Idempotency-Key': PlanningRequestKeySchema.parse(key) } }),
  };
}

export const mealPlanningApi = {
  async generate(intent: z.input<typeof MealPlanningIntentSchema>, key: string) {
    return request(
      plansPath,
      MealPlanDtoSchema,
      post(MealPlanningIntentSchema.parse(intent), PlanningRequestKeySchema.parse(key)),
    );
  },

  async get(id: string) {
    return request(
      planPath(id),
      MealPlanDtoSchema.refine((plan) => plan.id === id, 'Plan identity mismatch'),
    );
  },

  async current() {
    return request(`${plansPath}/current`, CurrentMealPlanDtoSchema);
  },

  async alternatives(id: string, revision: number) {
    const path = planPath(id);
    const query = PlanAlternativesQuerySchema.parse({
      revision: String(PlanRevisionSchema.parse(revision)),
    });
    return request(
      `${path}/alternatives?revision=${query.revision}`,
      PlanAlternativesDtoSchema.refine(
        (result) => result.planId === id && result.planRevision === revision,
        'Plan revision mismatch',
      ),
    );
  },

  async regenerate(id: string, input: z.input<typeof RegenerateMealPlanSchema>) {
    return request(
      `${planPath(id)}/regenerate`,
      MealPlanDtoSchema.refine(
        (plan) => plan.id === id && plan.revision > input.revision,
        'Plan revision mismatch',
      ),
      post(RegenerateMealPlanSchema.parse(input)),
    );
  },

  async swap(id: string, input: z.input<typeof SwapMealSchema>) {
    return request(
      `${planPath(id)}/swap`,
      MealPlanDtoSchema.refine(
        (plan) => plan.id === id && plan.revision > input.revision,
        'Plan revision mismatch',
      ),
      post(SwapMealSchema.parse(input)),
    );
  },

  async shopping(id: string, input: z.input<typeof OptimizePlanShoppingSchema>) {
    return request(
      `${planPath(id)}/shopping`,
      PlanShoppingDtoSchema.refine(
        (result) => result.planId === id && result.planRevision === input.revision,
        'Plan revision mismatch',
      ),
      post(OptimizePlanShoppingSchema.parse(input)),
    );
  },

  async feedback(id: string, input: z.input<typeof PlanFeedbackSchema>, key: string) {
    return request(
      `${planPath(id)}/feedback`,
      PlanFeedbackDtoSchema.refine(
        (result) =>
          result.planId === id &&
          result.planRevision === input.revision &&
          result.slotId === input.slotId &&
          result.type === input.type,
        'Feedback intent mismatch',
      ),
      post(PlanFeedbackSchema.parse(input), PlanningRequestKeySchema.parse(key)),
    );
  },

  async explanation(id: string, input: z.input<typeof PlanExplanationRequestSchema>) {
    return request(
      `${planPath(id)}/explanation`,
      PlanExplanationDtoSchema.refine(
        (result) =>
          result.planId === id &&
          result.planRevision === input.revision &&
          result.slotId === input.slotId,
        'Explanation scope mismatch',
      ),
      post(PlanExplanationRequestSchema.parse(input)),
    );
  },
};
