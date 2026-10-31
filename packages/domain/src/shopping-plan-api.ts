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
  contentFingerprint: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
}).strict();
export type ShoppingContribution = z.infer<typeof ShoppingContributionSchema>;
export const SharePlanShoppingDtoSchema = z.object({
  success: z.literal(true), planId: PlanIdSchema, planRevision: PlanRevisionSchema,
  sourceId: z.string(), itemCount: z.number().int().nonnegative(),
  unresolvedCount: z.number().int().nonnegative(), idempotentReplay: z.boolean(),
}).strict();

const ShoppingUnitSchema = z.enum(['g', 'kg', 'ml', 'l', 'piece', 'pack', 'bunch', 'slice']);
export const ShoppingDemandReviewBindingSchema = z.object({
  sourceId: z.string().min(1).max(160),
  demandKey: z.string().min(1).max(500),
  snapshot: z.string().regex(/^[a-f0-9]{64}$/),
  reviewRevision: z.number().int().nonnegative(),
}).strict();
export const ShoppingUnknownDemandSchema = ShoppingDemandReviewBindingSchema.extend({
  ingredientId: z.string(), name: z.string(), unit: z.string(),
  contributions: z.array(ShoppingContributionSchema),
  reviewState: z.enum(['pending', 'purchased', 'skipped']),
  purchaseItemId: z.string().nullable(),
}).strict();
export type ShoppingUnknownDemand = z.infer<typeof ShoppingUnknownDemandSchema>;
export const ReviewShoppingDemandSchema = z.discriminatedUnion('action', [
  ShoppingDemandReviewBindingSchema.extend({
    action: z.literal('purchase'),
    quantity: z.number().finite().positive().max(100_000),
    unit: ShoppingUnitSchema,
  }).strict(),
  ShoppingDemandReviewBindingSchema.extend({ action: z.literal('skip') }).strict(),
  ShoppingDemandReviewBindingSchema.extend({ action: z.literal('reopen') }).strict(),
]);
export type ReviewShoppingDemandInput = z.infer<typeof ReviewShoppingDemandSchema>;
export const ReviewShoppingDemandDtoSchema = z.object({
  success: z.literal(true),
  sourceId: z.string(), demandKey: z.string(),
  reviewRevision: z.number().int().positive(),
  reviewState: z.enum(['pending', 'purchased', 'skipped']),
  purchaseItemId: z.string().nullable(),
  idempotentReplay: z.boolean(),
}).strict();
