import { z } from 'zod';
export const BillingPlanSchema = z.enum(['monthly', 'annual']);
export const BillingPlanRequestSchema = z.object({ plan: BillingPlanSchema });
export const CheckoutKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);
export const BillingPriceSchema = z.object({ plan: BillingPlanSchema,
  amountVnd: z.number().int().positive().safe(), currency: z.literal('VND') });
const timestamp = z.string().min(1).refine((value) => Number.isFinite(Date.parse(value)));
export const BillingStatusSchema = z.enum(['pending', 'paid', 'failed', 'expired', 'refunded']);
export const BillingPaymentSchema = BillingPriceSchema.extend({ id: z.string().min(1), orderCode: z.string().min(1),
  description: z.string().min(1), expiresAt: timestamp, status: BillingStatusSchema });
export const BillingInstructionsSchema = z.object({ bankBin: z.string().min(1), accountNumber: z.string().min(1),
  accountName: z.string().min(1), transferContent: z.string().min(1),
  qrImageUrl: z.string().refine((value) => {
    try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
  }) });
export const BillingCreatedPaymentSchema = BillingPaymentSchema.extend({ instructions: BillingInstructionsSchema });
export const BillingPlansResponseSchema = z.object({ checkoutAdmissionEnabled: z.boolean().default(false), plans: z.array(BillingPriceSchema).min(1)
  .refine((plans) => new Set(plans.map((plan) => plan.plan)).size === plans.length) });
export const BillingCreatedResponseSchema = z.object({ success: z.literal(true), payment: BillingCreatedPaymentSchema });
export const OpenCheckoutSchema = z.object({ intentId: z.string().min(1), plan: BillingPlanSchema,
  status: BillingStatusSchema, expiresAt: timestamp, state: z.enum(['dispatching', 'ready', 'remote_uncertain']) });
export const OpenCheckoutsResponseSchema = z.object({ checkouts: z.array(OpenCheckoutSchema).max(20) });
export const CheckoutUncertainSchema = z.object({ success: z.literal(false),
  code: z.literal('PAYMENT_RECONCILIATION_REQUIRED'), intentId: z.string().min(1) });
export type OpenCheckout = z.infer<typeof OpenCheckoutSchema>;
