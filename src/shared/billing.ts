import { z } from 'zod';
export const BillingPlanSchema = z.enum(['monthly', 'annual']);
export const BillingPlanRequestSchema = z.object({ plan: BillingPlanSchema });
export const CheckoutKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);
export const BillingPriceSchema = z.object({ plan: BillingPlanSchema,
  amountVnd: z.number().int().positive().safe(), currency: z.literal('VND') });
const timestamp = z.string().min(1).refine((value) => Number.isFinite(Date.parse(value)));
const isoTimestamp = timestamp.refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
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
export const BillingCheckoutStateSchema = z.enum(['dispatching', 'ready', 'remote_uncertain']);
export const OpenCheckoutSchema = z.object({ intentId: z.string().min(1), plan: BillingPlanSchema,
  status: BillingStatusSchema, expiresAt: timestamp, state: BillingCheckoutStateSchema });
export const OpenCheckoutsResponseSchema = z.object({ checkouts: z.array(OpenCheckoutSchema).max(20) });
export const CheckoutUncertainSchema = z.object({ success: z.literal(false),
  code: z.literal('PAYMENT_RECONCILIATION_REQUIRED'), intentId: z.string().min(1) });
export const BillingSubscriptionSchema = z.object({
  plan: z.enum(['free', 'plus']), status: z.enum(['active', 'expired', 'inactive']), expiresAt: isoTimestamp.nullable(),
}).refine((value) => (value.plan === 'plus') === (value.status === 'active'));
export const BillingHistoryPaymentSchema = BillingPaymentSchema.extend({
  createdAt: isoTimestamp, expiresAt: isoTimestamp, canResume: z.boolean(), checkoutState: BillingCheckoutStateSchema.nullable(),
}).refine((value) => !value.canResume || (value.status === 'pending' && value.checkoutState === 'ready'));
export const BillingAccountResponseSchema = z.object({
  subscription: BillingSubscriptionSchema,
  payments: z.array(BillingHistoryPaymentSchema).max(20)
    .refine((payments) => new Set(payments.map((payment) => payment.id)).size === payments.length),
  hasMore: z.boolean(), hasPendingPayment: z.boolean(),
});
export type OpenCheckout = z.infer<typeof OpenCheckoutSchema>;
export type BillingAccount = z.infer<typeof BillingAccountResponseSchema>;
export type BillingHistoryPayment = z.infer<typeof BillingHistoryPaymentSchema>;
