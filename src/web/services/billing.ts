import type {
  CreatedPaymentIntent,
  PaymentIntent,
  PlusPlan,
  PlusPrice,
} from '../../shared/payment';
import { z } from 'zod';
import { ApiError, fetchJson } from './http';

type PlansResponse = { plans: PlusPrice[]; checkoutAdmissionEnabled: boolean };
type PaymentResponse<T> = { success: true; payment: T };

import { BillingPaymentSchema, BillingCreatedResponseSchema, BillingPlansResponseSchema,
  OpenCheckoutsResponseSchema, CheckoutUncertainSchema } from '../../shared/billing';

function parseBillingResponse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid ${label} response`);
  return parsed.data;
}

export const billingApi = {
  resumeCheckout: async (id: string): Promise<PaymentResponse<CreatedPaymentIntent>> => {
    const response = await fetchJson<unknown>(`/billing/checkouts/${encodeURIComponent(id)}`);
    if (CheckoutUncertainSchema.safeParse(response).success) throw new ApiError('http', `HTTP 202: ${JSON.stringify(response)}`, 202, { retryable: false });
    return parseBillingResponse(BillingCreatedResponseSchema, response, 'payment intent');
  },
  getOpenCheckouts: async () => parseBillingResponse(OpenCheckoutsResponseSchema,
    await fetchJson<unknown>('/billing/checkouts'), 'open checkouts'),
  getPlans: async (): Promise<PlansResponse> => {
    const response = await fetchJson<unknown>('/billing/plans');
    return parseBillingResponse(BillingPlansResponseSchema, response, 'billing plans');
  },

  createPaymentIntent: async (
    plan: PlusPlan,
    checkoutKey?: string,
  ): Promise<PaymentResponse<CreatedPaymentIntent>> => {
    const response = await fetchJson<unknown>('/billing/payment-intents', {
      method: 'POST',
      ...(checkoutKey ? { headers: { 'Idempotency-Key': checkoutKey } } : {}),
      body: JSON.stringify({ plan }),
    });
    if (CheckoutUncertainSchema.safeParse(response).success) {
      throw new ApiError('http', `HTTP 202: ${JSON.stringify(response)}`, 202, { retryable: false });
    }
    return parseBillingResponse<PaymentResponse<CreatedPaymentIntent>>(
      BillingCreatedResponseSchema, response, 'payment intent',
    );
  },

  getPaymentIntent: async (
    id: string,
  ): Promise<PaymentResponse<PaymentIntent>> => {
    const response = await fetchJson<unknown>(`/billing/payment-intents/${encodeURIComponent(id)}`);
    return parseBillingResponse<PaymentResponse<PaymentIntent>>(
      z.object({ success: z.literal(true), payment: BillingPaymentSchema }), response, 'payment status',
    );
  },
};
