import { z } from 'zod';
import { CatalogIdSchema } from './foundation';
import { SupportedLocaleSchema } from './i18n';
import { MealPlanDtoSchema, PlanIdSchema, PlanRevisionSchema, PlannedMealDtoSchema } from './meal-planning-api';

export const CurrentMealPlanDtoSchema = z.object({ plan: MealPlanDtoSchema.nullable() }).strict();
export type CurrentMealPlanDto = z.infer<typeof CurrentMealPlanDtoSchema>;

export const PLAN_ALTERNATIVES_LIMIT = 50;
export const PlanAlternativesQuerySchema = z.object({
  revision: z.string().regex(/^[1-9]\d{0,15}$/).transform(Number).pipe(PlanRevisionSchema),
}).strict();
export const PlanAlternativesDtoSchema = z.object({
  planId: PlanIdSchema,
  planRevision: PlanRevisionSchema,
  alternatives: z.array(z.object({
    kind: z.literal('recipe'),
    id: CatalogIdSchema,
    title: z.string().min(1).max(500),
  }).strict()).max(PLAN_ALTERNATIVES_LIMIT),
  truncated: z.boolean(),
}).strict();
export type PlanAlternativesDto = z.infer<typeof PlanAlternativesDtoSchema>;

export const PlanExplanationRequestSchema = z.object({
  revision: PlanRevisionSchema,
  slotId: PlannedMealDtoSchema.shape.slotId,
  locale: SupportedLocaleSchema,
}).strict();
export type PlanExplanationRequest = z.infer<typeof PlanExplanationRequestSchema>;

// IDs select UI-owned templates; membership in the server's fact set is checked separately.
export const PlanExplanationSelectionSchema = z.object({
  reasonCodes: z.array(z.string().min(1).max(200).regex(/^[A-Z][A-Z0-9_]*$/)).max(64)
    .refine((codes) => new Set(codes).size === codes.length, 'Duplicate reason IDs'),
}).strict();
export const PlanExplanationFallbackReasonSchema = z.enum([
  'disabled', 'no_facts', 'provider_unavailable', 'timeout', 'invalid_output', 'ungrounded_output',
]);
export const PlanExplanationDtoSchema = z.object({
  planId: PlanIdSchema,
  planRevision: PlanRevisionSchema,
  slotId: PlannedMealDtoSchema.shape.slotId,
  source: z.enum(['deterministic', 'ai']),
  reasonCodes: PlanExplanationSelectionSchema.shape.reasonCodes,
  fallbackReason: PlanExplanationFallbackReasonSchema.nullable(),
}).strict().refine((value) => (value.source === 'ai') === (value.fallbackReason === null),
  'Only AI success has no fallback reason');
export type PlanExplanationDto = z.infer<typeof PlanExplanationDtoSchema>;
