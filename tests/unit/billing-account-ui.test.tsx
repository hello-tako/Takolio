// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BillingAccountResponseSchema, BillingCreatedPaymentSchema, BillingHistoryPaymentSchema,
  BillingPlansResponseSchema, type BillingAccount, type BillingHistoryPayment,
} from '../../src/shared/billing';
import type { CreatedPaymentIntent } from '../../src/shared/payment';

const mocks = vi.hoisted(() => {
  const authState = {
    userId: 'billing-ui-user', householdId: 'billing-ui-household', isGuest: false,
    isPlus: false, avatarUrl: undefined, setPlusFromServer: vi.fn(),
  };
  return {
    authState,
    useAuthStore: Object.assign(
      (selector?: (state: typeof authState) => unknown) => selector ? selector(authState) : authState,
      { getState: () => authState },
    ),
    getPlans: vi.fn(), getAccount: vi.fn(), getOpenCheckouts: vi.fn(),
    createPaymentIntent: vi.fn(), resumeCheckout: vi.fn(), getPaymentIntent: vi.fn(), getMe: vi.fn(),
    resetListeners: new Set<() => void>(), generation: 0,
  };
});

vi.mock('../../src/web/stores/useAuthStore', () => ({ useAuthStore: mocks.useAuthStore }));
vi.mock('../../src/web/services/billing', () => ({ billingApi: mocks }));
vi.mock('../../src/web/services/api', () => ({ api: { getPaymentIntent: mocks.getPaymentIntent, getMe: mocks.getMe } }));
vi.mock('../../src/web/lib/private-session', () => ({
  capturePrivateSession: () => {
    const generation = mocks.generation;
    return () => generation === mocks.generation;
  },
  onPrivateSessionReset: (listener: () => void) => {
    mocks.resetListeners.add(listener);
    return () => mocks.resetListeners.delete(listener);
  },
}));

import { PlusPaywallPage } from '../../src/web/pages/PlusPaywallPage';

const expiresAt = '2099-01-01T00:00:00.000Z';
function pendingPayment(changes: Partial<CreatedPaymentIntent> = {}): CreatedPaymentIntent {
  return BillingCreatedPaymentSchema.parse({
    id: 'pay_billing_ui', orderCode: '123456789', plan: 'annual', amountVnd: 499000,
    currency: 'VND', description: 'SYNTHETIC_BILLING_UI_TEST', expiresAt, status: 'pending',
    instructions: {
      bankBin: '970422', accountNumber: '000000001', accountName: 'SYNTHETIC TEST',
      transferContent: 'SYNTHETIC_BILLING_UI_TEST', qrImageUrl: 'https://synthetic.test/qr.png',
    }, ...changes,
  });
}
function historyPayment(changes: Partial<BillingHistoryPayment> = {}): BillingHistoryPayment {
  return BillingHistoryPaymentSchema.parse({
    ...pendingPayment(), createdAt: '2026-10-12T00:00:00.000Z', canResume: false, checkoutState: null, ...changes,
  });
}
function freeAccount(changes: Partial<BillingAccount> = {}): BillingAccount {
  return BillingAccountResponseSchema.parse({
    subscription: { plan: 'free', status: 'inactive', expiresAt: null }, payments: [], hasMore: false,
    hasPendingPayment: false, ...changes,
  });
}
const plans = BillingPlansResponseSchema.parse({
  checkoutAdmissionEnabled: true,
  plans: [{ plan: 'monthly', amountVnd: 49000, currency: 'VND' }, { plan: 'annual', amountVnd: 499000, currency: 'VND' }],
});
const pendingAccount = () => freeAccount({
  hasPendingPayment: true,
  payments: [historyPayment({ canResume: true, checkoutState: 'ready' })],
});
function getBuyButton(host: HTMLElement): HTMLButtonElement | undefined {
  return [...host.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent?.includes('Nâng cấp ngay') || button.textContent?.includes('Gia hạn hội viên'));
}
function findButton(host: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes(text));
}
async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe('billing account UI privacy and recovery', () => {
  let root: Root | undefined;
  let host: HTMLDivElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    mocks.authState.userId = 'billing-ui-user';
    mocks.authState.householdId = 'billing-ui-household';
    mocks.authState.isGuest = false;
    mocks.authState.isPlus = false;
    mocks.generation = 0;
    mocks.resetListeners.clear();
    for (const mock of [mocks.getPlans, mocks.getAccount, mocks.getOpenCheckouts, mocks.createPaymentIntent,
      mocks.resumeCheckout, mocks.getPaymentIntent, mocks.getMe]) mock.mockReset();
    mocks.getPlans.mockResolvedValue(plans);
    mocks.getOpenCheckouts.mockResolvedValue({ checkouts: [] });
    mocks.getAccount.mockResolvedValue(freeAccount());
    mocks.getPaymentIntent.mockResolvedValue({ success: true, payment: pendingPayment() });
    mocks.getMe.mockResolvedValue({ user: { id: 'billing-ui-user', isPlus: false } });
    mocks.createPaymentIntent.mockResolvedValue({ success: true, payment: pendingPayment() });
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    host.remove();
    mocks.resetListeners.clear();
    vi.restoreAllMocks();
  });

  async function render() {
    await act(async () => {
      root?.render(<MemoryRouter initialEntries={['/plus']}><PlusPaywallPage /></MemoryRouter>);
      await Promise.resolve();
      await Promise.resolve();
    });
  }
  async function mount(expectBuyButton = true) {
    root = createRoot(host);
    await render();
    if (expectBuyButton) await vi.waitFor(() => expect(getBuyButton(host)).toBeDefined());
  }

  it.each(['account', 'guest'] as const)('blocks a retained create handler after a switch to another %s', async (switchTo) => {
    await mount();
    expect(getBuyButton(host)?.disabled).toBe(false);
    mocks.authState.userId = 'other-user';
    mocks.authState.householdId = 'other-household';
    mocks.authState.isGuest = switchTo === 'guest';
    await act(async () => { getBuyButton(host)?.click(); });
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled();
  });

  it('uses a fresh idempotency key after a pending checkout becomes terminal', async () => {
    await mount();
    await act(async () => { getBuyButton(host)?.click(); });
    const firstKey = mocks.createPaymentIntent.mock.calls[0]?.[1];
    expect(firstKey).toMatch(/^[a-f0-9-]{36}$/);
    mocks.getAccount.mockResolvedValueOnce(freeAccount({
      payments: [historyPayment({ status: 'expired', expiresAt: '2025-01-01T00:00:00.000Z' })],
    }));
    await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-label="Đóng"]')?.click(); });
    await vi.waitFor(() => expect(getBuyButton(host)?.disabled).toBe(false));
    await act(async () => { getBuyButton(host)?.click(); });
    const secondKey = mocks.createPaymentIntent.mock.calls[1]?.[1];
    expect(secondKey).toMatch(/^[a-f0-9-]{36}$/);
    expect(secondKey).not.toBe(firstKey);
  });

  it('fails closed while an account refresh is unavailable', async () => {
    await mount();
    mocks.getAccount.mockRejectedValueOnce(new Error('synthetic refresh failure'));
    const refresh = findButton(host, 'Cập nhật trạng thái');
    expect(refresh).toBeDefined();
    await act(async () => { refresh?.click(); });
    await vi.waitFor(() => expect(host.textContent).toContain('Chưa tải được thông tin gói'));
    expect(getBuyButton(host)?.disabled).toBe(true);
    await act(async () => { getBuyButton(host)?.click(); });
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled();
  });

  it('blocks legacy pending history and never offers a QR resume without saved instructions', async () => {
    mocks.getAccount.mockResolvedValue(freeAccount({
      hasPendingPayment: true, payments: [historyPayment({ amountVnd: 49000 })],
    }));
    await mount();
    expect(getBuyButton(host)?.disabled).toBe(true);
    expect(host.textContent).toContain('QR của lệnh cũ chưa được lưu');
    expect(host.textContent).not.toContain('Mở lại mã QR');
    expect(mocks.resumeCheckout).not.toHaveBeenCalled();
  });

  it('renders paid history and server-active Plus even when cached auth starts false', async () => {
    mocks.getAccount.mockResolvedValue(freeAccount({
      subscription: { plan: 'plus', status: 'active', expiresAt },
      payments: [historyPayment({ status: 'paid' })],
    }));
    await mount();
    expect(host.textContent).toContain('Đang hoạt động');
    expect(host.textContent).toContain('Gia hạn hội viên');
    expect(host.textContent).toContain('Đã thanh toán');
    expect(host.querySelector<HTMLTimeElement>('time[dateTime="2099-01-01T00:00:00.000Z"]')).not.toBeNull();
  });

  it('does not create or issue another resume request across unmount and remount', async () => {
    mocks.getAccount.mockResolvedValue(pendingAccount());
    let resolveResume!: (value: unknown) => void;
    mocks.resumeCheckout.mockReturnValue(new Promise((resolve) => { resolveResume = resolve; }));
    await mount();
    const resume = findButton(host, 'Mở lại mã QR');
    expect(resume).toBeDefined();
    await act(async () => { resume?.click(); });
    expect(mocks.resumeCheckout).toHaveBeenCalledExactlyOnceWith('pay_billing_ui');
    act(() => root?.unmount());
    root = undefined;
    await mount();
    expect(mocks.resumeCheckout).toHaveBeenCalledExactlyOnceWith('pay_billing_ui');
    resolveResume({ success: true, payment: pendingPayment() });
    await flush();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled();
  });

  it('blocks a retained resume handler after another owner takes over', async () => {
    mocks.getAccount.mockResolvedValue(pendingAccount());
    await mount();
    const resume = findButton(host, 'Mở lại mã QR');
    mocks.authState.userId = 'other-user';
    mocks.authState.householdId = 'other-household';
    await act(async () => { resume?.click(); });
    expect(mocks.resumeCheckout).not.toHaveBeenCalled();
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled();
  });

  it('ignores an old account snapshot once the page switches to a guest session', async () => {
    let resolveAccount!: (value: BillingAccount) => void;
    mocks.getAccount.mockReturnValue(new Promise((resolve) => { resolveAccount = resolve; }));
    await mount();
    mocks.authState.isGuest = true;
    mocks.authState.userId = 'guest-user';
    await render();
    resolveAccount(pendingAccount());
    await flush();
    expect(host.textContent).toContain('Đăng nhập để tiếp tục');
    expect(host.textContent).not.toContain('123456789');
    expect(findButton(host, 'Mở lại mã QR')).toBeUndefined();
    expect(mocks.getAccount).toHaveBeenCalledOnce();
  });

  it('hides account history and blocks creation when a private session resets for the same owner', async () => {
    await mount();
    await act(async () => {
      mocks.generation += 1;
      mocks.resetListeners.forEach((listener) => listener());
    });
    expect(getBuyButton(host)?.disabled).toBe(true);
    expect(host.querySelector('#billing-history-heading')).toBeNull();
    await act(async () => { getBuyButton(host)?.click(); });
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled();
  });

  it('retains the changed-price warning after the authoritative prices reload', async () => {
    mocks.createPaymentIntent.mockResolvedValue({ success: true, payment: pendingPayment({ amountVnd: 500000 }) });
    mocks.getPlans.mockResolvedValueOnce(plans).mockResolvedValue({
      ...plans, plans: plans.plans.map((price) => price.plan === 'annual' ? { ...price, amountVnd: 500000 } : price),
    });
    await mount();
    await act(async () => { getBuyButton(host)?.click(); });
    await vi.waitFor(() => expect(mocks.getPlans).toHaveBeenCalledTimes(2));
    expect(host.textContent).toContain('Bảng giá đã cập nhật');
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('500.000 VND');
    expect(mocks.createPaymentIntent).toHaveBeenCalledOnce();
  });

  it('recovers an initial price-read failure without requiring a page reload', async () => {
    mocks.getPlans.mockRejectedValueOnce(new Error('synthetic price-read failure')).mockResolvedValue(plans);
    await mount(false);
    await vi.waitFor(() => expect(host.textContent).toContain('Không thể tải bảng giá'));
    const retry = findButton(host, 'Tải lại bảng giá');
    expect(retry).toBeDefined();
    await act(async () => { retry?.click(); });
    await vi.waitFor(() => expect(getBuyButton(host)?.disabled).toBe(false));
    expect(mocks.getPlans).toHaveBeenCalledTimes(2);
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled();
  });
});
