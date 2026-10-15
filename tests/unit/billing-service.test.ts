// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { billingApi } from '../../src/web/services/billing';

const intent = {
  id: 'pay_test',
  orderCode: 'order_test',
  plan: 'annual' as const,
  amountVnd: 499000,
  currency: 'VND' as const,
  description: 'TP1234567',
  expiresAt: '2099-01-01T00:00:00.000Z',
  status: 'pending' as const,
};

const instructions = {
  bankBin: '970436',
  accountNumber: '123456789',
  accountName: 'SERVER ACCOUNT',
  transferContent: 'TP1234567',
  qrImageUrl: 'https://server.test/qr/pay_test.png',
};

describe('billing response runtime validation', () => {
  let responseBody: unknown;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('frigo_user_id', 'billing-user');
    localStorage.setItem('frigo_household_id', 'billing-household');
    responseBody = {};
    fetchMock = vi.fn(async () => new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    { amountVnd: 0 },
    { amountVnd: 1.5 },
    { currency: 'USD' },
    { plan: 'weekly' },
  ])('rejects invalid server price data: %o', async (change) => {
    responseBody = { plans: [{ plan: 'annual', amountVnd: 499000, currency: 'VND', ...change }] };

    await expect(billingApi.getPlans()).rejects.toThrow('Invalid billing plans response');
  });

  it('rejects duplicate plan rows instead of choosing a client price', async () => {
    responseBody = {
      plans: [
        { plan: 'annual', amountVnd: 499000, currency: 'VND' },
        { plan: 'annual', amountVnd: 1, currency: 'VND' },
      ],
    };

    await expect(billingApi.getPlans()).rejects.toThrow('Invalid billing plans response');
  });

  it.each([
    { id: '' },
    { amountVnd: 0 },
    { currency: 'USD' },
    { status: 'unknown' },
    { expiresAt: 'not-a-date' },
  ])('rejects malformed payment intent data: %o', async (change) => {
    responseBody = {
      success: true,
      payment: { ...intent, instructions, ...change },
    };

    await expect(billingApi.createPaymentIntent('annual')).rejects.toThrow('Invalid payment intent response');
  });

  it('rejects a payment intent with an invalid QR URL', async () => {
    responseBody = {
      success: true,
      payment: { ...intent, instructions: { ...instructions, qrImageUrl: 'not-a-url' } },
    };

    await expect(billingApi.createPaymentIntent('annual')).rejects.toThrow('Invalid payment intent response');
  });

  it('accepts a valid status response without introducing another price authority', async () => {
    responseBody = { success: true, payment: intent };

    await expect(billingApi.getPaymentIntent('pay_test')).resolves.toEqual({ success: true, payment: intent });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/billing/payment-intents/pay_test', expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({
        'X-Frigo-Expected-User-Id': 'billing-user',
        'X-Frigo-Expected-Household-Id': 'billing-household',
      }),
    }));
  });

  it('defaults an older server capability to false and rejects non-boolean opt-in', async () => {
    const plans = [{ plan: 'annual', amountVnd: 499000, currency: 'VND' }];
    responseBody = { plans };
    await expect(billingApi.getPlans()).resolves.toEqual({ plans, checkoutAdmissionEnabled: false });
    responseBody = { plans, checkoutAdmissionEnabled: 'true' };
    await expect(billingApi.getPlans()).rejects.toThrow('Invalid billing plans response');
  });

  it('sends no admission header on legacy calls and preserves explicit candidate keys', async () => {
    responseBody = { success: true, payment: { ...intent, instructions } };
    await billingApi.createPaymentIntent('annual');
    expect(fetchMock.mock.calls.at(-1)?.[1]?.headers).not.toHaveProperty('Idempotency-Key');
    await billingApi.createPaymentIntent('annual', 'explicit-candidate-key');
    expect(fetchMock.mock.calls.at(-1)?.[1]?.headers).toHaveProperty('Idempotency-Key', 'explicit-candidate-key');
  });

  it('sends owner headers when loading the server price catalog', async () => {
    responseBody = { plans: [{ plan: 'annual', amountVnd: 499000, currency: 'VND' }] };

    await billingApi.getPlans();

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/billing/plans', expect.objectContaining({
      headers: expect.objectContaining({
        'X-Frigo-Expected-User-Id': 'billing-user',
        'X-Frigo-Expected-Household-Id': 'billing-household',
      }),
    }));
  });

  it('defaults an older server capability to false and rejects non-boolean opt-in', async () => {
    const plans = [{ plan: 'annual', amountVnd: 499000, currency: 'VND' }];
    responseBody = { plans };
    await expect(billingApi.getPlans()).resolves.toEqual({ plans, checkoutAdmissionEnabled: false });
    responseBody = { plans, checkoutAdmissionEnabled: 'true' };
    await expect(billingApi.getPlans()).rejects.toThrow('Invalid billing plans response');
  });

  it('sends no admission header on legacy calls and preserves explicit candidate keys', async () => {
    responseBody = { success: true, payment: { ...intent, instructions } };
    await billingApi.createPaymentIntent('annual');
    expect(fetchMock.mock.calls.at(-1)?.[1]?.headers).not.toHaveProperty('Idempotency-Key');
    await billingApi.createPaymentIntent('annual', 'explicit-candidate-key');
    expect(fetchMock.mock.calls.at(-1)?.[1]?.headers).toHaveProperty('Idempotency-Key', 'explicit-candidate-key');
  });

  it('sends owner headers when creating a payment intent', async () => {
    responseBody = { success: true, payment: { ...intent, instructions } };

    await billingApi.createPaymentIntent('annual');

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/billing/payment-intents', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'X-Frigo-Expected-User-Id': 'billing-user',
        'X-Frigo-Expected-Household-Id': 'billing-household',
      }),
    }));
  });
});

describe('billing account runtime contract', () => {
  afterEach(() => vi.unstubAllGlobals());

  const account = {
    subscription: { plan: 'plus', status: 'active', expiresAt: '2099-01-01T00:00:00.000Z' },
    payments: [{ ...intent, createdAt: '2026-01-01T00:00:00.000Z', checkoutState: 'ready', canResume: true }],
    hasPendingPayment: true,
    hasMore: false,
  };

  it('reads history with current owner headers and validates the subscription snapshot', async () => {
    localStorage.setItem('frigo_user_id', 'billing-account-user');
    localStorage.setItem('frigo_household_id', 'billing-account-household');
    const request = vi.fn(async () => new Response(JSON.stringify(account), {
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', request);
    await expect(billingApi.getAccount()).resolves.toEqual(account);
    expect(request).toHaveBeenCalledWith('/api/v1/billing/account', expect.objectContaining({
      credentials: 'include', headers: expect.objectContaining({
        'X-Frigo-Expected-User-Id': 'billing-account-user',
        'X-Frigo-Expected-Household-Id': 'billing-account-household',
      }),
    }));
  });

  it.each([
    { subscription: { plan: 'plus', status: 'active', expiresAt: 'invalid' } },
    { payments: [{ ...account.payments[0], status: 'unknown' }] },
    { hasPendingPayment: 'false' },
  ])('rejects malformed billing account data before display: %o', async (changes) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...account, ...changes }), {
      headers: { 'Content-Type': 'application/json' },
    })));
    await expect(billingApi.getAccount()).rejects.toThrow('Invalid billing account response');
  });
});
