import { z } from 'zod';
import { PlanIdSchema, PlanRevisionSchema } from './meal-planning-api';
export const SharePlanShoppingSchema = z.object({
  planId: PlanIdSchema,
  expectedRevision: PlanRevisionSchema,
  startDate: z.string().date(),
  endDate: z.string().date(),
}).strict().refine(value => value.startDate <= value.endDate, 'Shopping horizon is reversed');
export const ShoppingContributionSchema = z.object({
  planId: z.string(), slotId: z.string(), componentId: z.string(),
  date: z.string(), mealType: z.string(), recipeId: z.string().nullable(), title: z.string(),
  quantity: z.number().positive().nullable(), unit: z.string(),
}).strict();
export type ShoppingContribution = z.infer<typeof ShoppingContributionSchema>;
export const SharePlanShoppingDtoSchema = z.object({
  success: z.literal(true), planId: PlanIdSchema, planRevision: PlanRevisionSchema,
  sourceId: z.string(), itemCount: z.number().int().nonnegative(),
  unresolvedCount: z.number().int().nonnegative(), idempotentReplay: z.boolean(),
}).strict();
