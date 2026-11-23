// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resetActiveUiLocaleForTests,
  setActiveUiLocale,
} from '../../src/web/i18n';
import { GlobalDodoBillingPanel } from '../../src/web/components/global/GlobalDodoBillingPanel';
import { BillingReturnPage } from '../../src/web/pages/BillingReturnPage';
import { M09PricingPage } from '../../src/web/vnext/screens/PublicSitePages';
import { PricingPage } from '../../src/site/pages/MarketingPages';
import * as globalApi from '../../src/web/services/global-api';
import type {
  GlobalBillingAccountResponse,
  GlobalBillingPaymentDto,
  GlobalCatalogResponse,
} from '../../src/web/services/global-api';
import { useAuthStore } from '../../src/web/stores/useAuthStore';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mountedCleanups: Array<() => void> = [];

function mountUi(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  const unmount = () => {
    act(() => {
      root.unmount();
    });
    container.remove();
  };
  mountedCleanups.push(unmount);
  return { container, unmount };
}

async function flushMicrotasks(ticks = 6) {
  for (let i = 0; i < ticks; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function makePayment(overrides: Partial<GlobalBillingPaymentDto>): GlobalBillingPaymentDto {
  return {
    id: 'pay-default',
    provider: 'dodo_mor',
    plan: 'annual',
    currency: 'USD',
    amountMinor: 4990,
    minorDigits: 2,
    taxAmountMinor: 0,
    taxInclusive: true,
    countryCode: 'US',
    status: 'paid',
    checkoutUrl: null,
    euWithdrawalWaiverAt: null,
    expiresAt: '2026-11-24T00:00:00.000Z',
    createdAt: '2026-11-23T00:00:00.000Z',
    ...overrides,
  };
}

function makeAccount(
  subOverrides: Partial<GlobalBillingAccountResponse['subscription']>,
  payments: GlobalBillingPaymentDto[],
): GlobalBillingAccountResponse {
  return {
    dodoConfigured: true,
    dodoEnvironment: 'live',
    subscription: {
      plan: 'free',
      status: 'none',
      isPlus: false,
      expiresAt: null,
      provider: null,
      providerSubscriptionId: null,
      dodoCustomerId: null,
      canOpenCustomerPortal: false,
      billingCurrency: null,
      cancelAtPeriodEnd: false,
      gracePeriodEndsAt: null,
      ...subOverrides,
    },
    payments,
  };
}

function makeCatalog(country: string): GlobalCatalogResponse {
  const isDe = country === 'DE';
  const isJp = country === 'JP';
  const currency = isDe ? 'EUR' : isJp ? 'JPY' : 'USD';
  const minorDigits: 0 | 2 = isJp ? 0 : 2;
  const monthlyMinor = isJp ? 480 : 499;
  const annualMinor = isJp ? 4800 : 4990;
  return {
    dodoConfigured: true,
    dodoEnvironment: 'live',
    catalog: {
      countryCode: country,
      provider: 'dodo_mor',
      merchantOfRecord: 'Dodo Payments',
      currency,
      minorDigits,
      requiresEuWithdrawalWaiver: isDe,
      requiresTokushohoDisclosure: isJp,
      tokushohoUrl: isJp ? '/api/v1/billing/tokushoho' : null,
      plans: [
        {
          plan: 'monthly',
          provider: 'dodo_mor',
          currency,
          amountMinor: monthlyMinor,
          minorDigits,
          taxRatePercent: isDe ? 19 : isJp ? 10 : 0,
          taxAmountMinor: 0,
          taxInclusive: true,
          taxLabel: isDe ? 'MwSt' : isJp ? '消費税' : 'Tax',
          paymentMethods: ['card', 'apple_pay'],
        },
        {
          plan: 'annual',
          provider: 'dodo_mor',
          currency,
          amountMinor: annualMinor,
          minorDigits,
          taxRatePercent: isDe ? 19 : isJp ? 10 : 0,
          taxAmountMinor: 0,
          taxInclusive: true,
          taxLabel: isDe ? 'MwSt' : isJp ? '消費税' : 'Tax',
          paymentMethods: ['card', 'apple_pay'],
        },
      ],
    },
  };
}

describe('Calm Kitchen Commerce UI — Pricing, Global Checkout & Return Continuity', () => {
  afterEach(() => {
    while (mountedCleanups.length > 0) {
      mountedCleanups.pop()?.();
    }
    resetActiveUiLocaleForTests();
    vi.restoreAllMocks();
    useAuthStore.setState({
      userId: undefined,
      householdId: undefined,
      isGuest: true,
      isPlus: false,
    });
  });

  it('M09PricingPage supports billing cycle toggle, currency pills, live Dodo prices, and deep-link handoff to /plus', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          plans: [
            { plan: 'monthly', amountVnd: 49000 },
            { plan: 'annual', amountVnd: 499000 },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    useAuthStore.setState({
      userId: 'user-1',
      householdId: 'hh-1',
      isGuest: false,
      isPlus: false,
    });

    const LocationEcho: React.FC = () => {
      const loc = useLocation();
      return <div data-testid="navigated-to">{`${loc.pathname}${loc.search}`}</div>;
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { container } = mountUi(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/pricing']}>
          <Routes>
            <Route path="/pricing" element={<M09PricingPage />} />
            <Route path="/plus" element={<LocationEcho />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await flushMicrotasks();

    // Default state: Annual + VND shows 499.000
    expect(container.textContent).toContain('499.000');

    // Switch currency pill to JPY -> live JPY ¥4,800 price
    const jpyBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'JPY',
    );
    expect(jpyBtn).toBeTruthy();
    act(() => {
      jpyBtn!.click();
    });
    expect(container.textContent).toContain('4,800');

    // Switch billing cycle toggle to Monthly -> ¥480
    const monthlyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Gói 1 tháng'),
    );
    expect(monthlyBtn).toBeTruthy();
    act(() => {
      monthlyBtn!.click();
    });
    expect(container.textContent).toContain('480');

    // Clicking CTA navigates directly to /plus?plan=monthly&market=JP
    const ctaBtn = container.querySelector('[data-testid="m09-plus-cta"]') as HTMLButtonElement | null;
    expect(ctaBtn).toBeTruthy();
    act(() => {
      ctaBtn!.click();
    });
    expect(container.querySelector('[data-testid="navigated-to"]')?.textContent).toBe(
      '/plus?plan=monthly&market=JP',
    );
  });

  it('Marketing PricingPage (takolio.com/pricing) renders live Dodo pricing and deep-links to takolio.app/plus', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ plans: { monthly: 49000, annual: 499000 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { container } = mountUi(
      <MemoryRouter initialEntries={['/en/pricing']}>
        <PricingPage locale="en" />
      </MemoryRouter>,
    );
    await flushMicrotasks();

    expect(container.textContent).toContain('$49.90');
    expect(container.textContent).not.toContain('$24.99');

    const proCta = Array.from(container.querySelectorAll('a')).find((a) =>
      decodeURIComponent(a.getAttribute('href') ?? '').includes('/plus?plan='),
    );
    expect(decodeURIComponent(proCta?.getAttribute('href') ?? '')).toContain('/plus?plan=annual&market=US');
  });

  it('GlobalDodoBillingPanel localizes cleanly in Vietnamese, switches currency pills, and uses two-step inline cancel confirmation', async () => {
    setActiveUiLocale('vi');

    const fetchPlansSpy = vi
      .spyOn(globalApi, 'fetchGlobalPlans')
      .mockImplementation(async (country) => makeCatalog(country ?? 'US'));

    vi.spyOn(globalApi, 'fetchGlobalBillingAccount').mockResolvedValue(
      makeAccount(
        {
          isPlus: true,
          plan: 'annual',
          provider: 'dodo_mor',
          status: 'active',
          expiresAt: '2027-01-01T00:00:00.000Z',
          canOpenCustomerPortal: true,
          billingCurrency: 'USD',
        },
        [makePayment({ id: 'pay-1', plan: 'annual', amountMinor: 4990, currency: 'USD', status: 'paid' })],
      ),
    );

    const cancelSpy = vi.spyOn(globalApi, 'cancelGlobalSubscription').mockResolvedValue({
      success: true,
      cancelAtPeriodEnd: true,
    });

    const { container } = mountUi(
      <GlobalDodoBillingPanel locale="vi" initialCountryCode="US" initialPlan="monthly" />,
    );
    await flushMicrotasks();

    expect(container.textContent).not.toContain('Recent global payments');
    expect(container.textContent).toContain('Takolio Pro đang hoạt động');
    expect(container.textContent).toContain('Lịch sử giao dịch quốc tế');

    const detailsEl = container.querySelector('details');
    expect(detailsEl?.hasAttribute('open')).toBe(false);

    const eurPill = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('EUR €'),
    );
    expect(eurPill).toBeTruthy();
    act(() => {
      eurPill!.click();
    });
    await flushMicrotasks();
    expect(fetchPlansSpy).toHaveBeenCalledWith('DE', 'vi');
    expect(container.querySelector('input[type="checkbox"]')).not.toBeNull();

    const cancelBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Huỷ gia hạn tự động cuối kỳ'),
    );
    expect(cancelBtn).toBeTruthy();
    act(() => {
      cancelBtn!.click();
    });
    expect(cancelSpy).not.toHaveBeenCalled();

    const confirmBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Xác nhận dừng gia hạn'),
    );
    expect(confirmBtn).toBeTruthy();
    act(() => {
      confirmBtn!.click();
    });
    await flushMicrotasks();
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  it('BillingReturnPage renders warm celebration receipt on paid and recovery CTA on failed', async () => {
    setActiveUiLocale('en');
    vi.spyOn(globalApi, 'fetchGlobalBillingAccount').mockResolvedValue(
      makeAccount(
        {
          isPlus: true,
          plan: 'annual',
          provider: 'dodo_mor',
          status: 'active',
          expiresAt: '2027-11-23T00:00:00.000Z',
          canOpenCustomerPortal: true,
          billingCurrency: 'USD',
        },
        [makePayment({ id: 'intent_paid_1', plan: 'annual', amountMinor: 4990, currency: 'USD', status: 'paid' })],
      ),
    );

    const { container: paidContainer, unmount: unmountPaid } = mountUi(
      <MemoryRouter initialEntries={['/billing/return?intent_id=intent_paid_1']}>
        <Routes>
          <Route path="/billing/return" element={<BillingReturnPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await flushMicrotasks();

    expect(paidContainer.textContent).toContain('You are all set to cook!');
    expect(paidContainer.textContent).toContain('$49.90');
    expect(paidContainer.textContent).toContain('Start cooking with Pro');
    unmountPaid();

    vi.spyOn(globalApi, 'fetchGlobalBillingAccount').mockResolvedValue(
      makeAccount(
        { isPlus: false, plan: 'free', provider: 'dodo_mor', status: 'none' },
        [makePayment({ id: 'intent_fail_1', plan: 'monthly', amountMinor: 499, currency: 'USD', status: 'failed' })],
      ),
    );

    const { container: failedContainer } = mountUi(
      <MemoryRouter initialEntries={['/billing/return?intent_id=intent_fail_1']}>
        <Routes>
          <Route path="/billing/return" element={<BillingReturnPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await flushMicrotasks();

    expect(failedContainer.textContent).toContain('Payment was not completed');
    expect(failedContainer.textContent).toContain('Back to plans');
  });
});
