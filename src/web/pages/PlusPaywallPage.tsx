import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { KitchenHeader, KitchenPageHeading } from '../components/common/KitchenHeader';
import { Button } from '../components/common/Button';
import { BillingAccountPanel } from '../components/payment/BillingAccountPanel';
import type { BillingAccount, BillingHistoryPayment } from '../../shared/billing';
import { VietQRModal } from '../components/payment/VietQRModal';
import { capturePrivateSession, onPrivateSessionReset } from '../lib/private-session';
import { billingApi } from '../services/billing';
import { ApiError } from '../services/http';
import type { CreatedPaymentIntent, PlusPlan, PlusPrice } from '../../shared/payment';
import { Check, Sparkles, ArrowRight, LogIn, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import type { SupportedLocale } from '../../shared/locales';
import { getActiveBcp47, lSync, useLocaleText } from '../i18n/app-i18n';

function planName(plan: PlusPlan, l: (vi: string, en: string) => string): string {
  return plan === 'annual' ? l('Gói 1 Năm', 'Annual Plan') : l('Gói 1 Tháng', 'Monthly Plan');
}

function formatPrice(price: PlusPrice, locale: SupportedLocale): string {
  return `${price.amountVnd.toLocaleString(getActiveBcp47(locale))} ${price.currency}`;
}

export interface PlusPaywallPageProps {
  embedded?: boolean;
  initialPlan?: PlusPlan;
}

export const PlusPaywallPage: React.FC<PlusPaywallPageProps> = ({
  embedded = false,
  initialPlan = 'annual',
}) => {
  const { l, locale } = useLocaleText();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);
  const householdId = useAuthStore((s) => s.householdId);
  const isGuest = useAuthStore((s) => s.isGuest);
  const cachedIsPlus = useAuthStore((s) => s.isPlus);
  const [verifiedPlus, setVerifiedPlus] = useState<{ owner: string; active: boolean } | null>(null);
  const isPlus = verifiedPlus?.owner === `${userId}:${householdId}` ? verifiedPlus.active : cachedIsPlus;
  const isRenderCurrent = typeof window === 'undefined' ? () => false : capturePrivateSession();
  const ownsCurrentSession = () => isRenderCurrent() && !useAuthStore.getState().isGuest &&
    useAuthStore.getState().userId === userId && useAuthStore.getState().householdId === householdId;

  const [plans, setPlans] = useState<PlusPrice[]>([]);
  const [checkoutAdmissionEnabled, setCheckoutAdmissionEnabled] = useState(false);
  const [checkoutRecoveryPending, setCheckoutRecoveryPending] = useState(true);
  const [hasOpenCheckout, setHasOpenCheckout] = useState(false);
  const [historyBlockingCheckout, setHistoryBlockingCheckout] = useState(true);
  const [accountReady, setAccountReady] = useState(false);
  const [accountRefreshVersion, setAccountRefreshVersion] = useState(0);
  const [pricesReload, setPricesReload] = useState(0);
  const onAccountLoading = useCallback(() => { setAccountReady(false); }, []);
  const onAccountLoaded = useCallback((account: BillingAccount) => {
    const owner = useAuthStore.getState();
    setVerifiedPlus({ owner: `${owner.userId}:${owner.householdId}`, active: account.subscription.plan === 'plus' && account.subscription.status === 'active' });
    setHistoryBlockingCheckout(account.hasPendingPayment);
    setHasOpenCheckout(account.hasPendingPayment);
    setRecoverableCheckoutId(account.payments.find((payment) => payment.canResume)?.id ?? null);
    setAccountReady(true);
    if (paymentIdRef.current && account.payments.some((payment) => payment.id === paymentIdRef.current && payment.status !== 'pending')) {
      checkoutKeyRef.current = null;
      setAttemptedPlan(null);
    }
  }, []);
  const [recoverableCheckoutId, setRecoverableCheckoutId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlusPlan>(initialPlan);
  const [paymentIntent, setPaymentIntent] = useState<CreatedPaymentIntent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [attemptedPlan, setAttemptedPlan] = useState<PlusPlan | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);
  const creatingRef = useRef(false);
  const checkoutKeyRef = useRef<string | null>(null);
  const checkoutTriggerRef = useRef<HTMLButtonElement | null>(null);
  const paymentOwnerRef = useRef('');
  const paymentIdRef = useRef<string | null>(null);
  const requestGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const selectedPlanRef = useRef(selectedPlan);
  selectedPlanRef.current = selectedPlan;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
      creatingRef.current = false;
    };
  }, []);

  useEffect(() => {
    requestGenerationRef.current += 1;
    checkoutKeyRef.current = null;
    setAttemptedPlan(null);
    setIsCreating(false);
    creatingRef.current = false;
    setPlans([]);
    setCheckoutAdmissionEnabled(false);
    setCheckoutRecoveryPending(true);
    setHasOpenCheckout(false);
    setHistoryBlockingCheckout(true);
    setAccountReady(false);
    setRecoverableCheckoutId(null);
    setPaymentIntent(null);
    paymentIdRef.current = null;
    setIsQRModalOpen(false);
    setPriceNotice(null);
  }, [isGuest, userId, householdId]);

  useEffect(() => {
    if (checkoutKeyRef.current) return;
    requestGenerationRef.current += 1;
    setIsCreating(false);
    creatingRef.current = false;
    setPaymentIntent(null);
    setIsQRModalOpen(false);
  }, [selectedPlan]);

  useEffect(() => {
    if (isGuest || !userId || !ownsCurrentSession()) return;
    const isCurrent = capturePrivateSession();
    let active = true;
    const unsubscribe = onPrivateSessionReset(() => { active = false; });
    setErrorMsg(null);
    void billingApi.getPlans().then((result) => {
      if (!active || !isCurrent()) return;
      setCheckoutAdmissionEnabled(result.checkoutAdmissionEnabled);
      setCheckoutRecoveryPending(false);
      const nextPlans = result.plans.filter((price) => price.plan === 'monthly' || price.plan === 'annual');
      setPlans(nextPlans);
      if (!nextPlans.some((price) => price.plan === selectedPlanRef.current)) {
        setSelectedPlan(nextPlans[0]?.plan ?? 'annual');
      }
    }).catch(() => {
      if (active && isCurrent())
        setErrorMsg(
          lSync(
            'Không thể tải bảng giá từ máy chủ. Vui lòng thử lại.',
            'Could not load pricing from the server. Please try again.',
          ),
        );
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [isGuest, userId, householdId, pricesReload]);

  const selectedPrice = useMemo(
    () => plans.find((price) => price.plan === selectedPlan) ?? null,
    [plans, selectedPlan],
  );

  const handleCreateIntent = async () => {
    if (!ownsCurrentSession() || checkoutRecoveryPending || hasOpenCheckout || historyBlockingCheckout || !accountReady || !selectedPrice || isCreating || creatingRef.current || isGuest || !userId || !householdId) return;
    const requestedPlan = selectedPrice.plan;
    const requestedHouseholdId = householdId;
    const requestGeneration = requestGenerationRef.current;
    const isCurrent = capturePrivateSession();
    let active = true;
    const unsubscribe = onPrivateSessionReset(() => { active = false; });
    creatingRef.current = true;
    setIsCreating(true);
    setErrorMsg(null);
    setPriceNotice(null);
    try {
      if (checkoutAdmissionEnabled) {
        checkoutKeyRef.current ??= crypto.randomUUID();
        setAttemptedPlan(requestedPlan);
      }
      const result = await billingApi.createPaymentIntent(selectedPrice.plan, checkoutKeyRef.current ?? undefined);
      if (requestGeneration !== requestGenerationRef.current || !active || !mountedRef.current || !isCurrent() || useAuthStore.getState().userId !== userId || useAuthStore.getState().householdId !== requestedHouseholdId || selectedPlanRef.current !== requestedPlan) return;
      if (result.payment.plan !== requestedPlan) throw new Error('PAYMENT_PLAN_MISMATCH');
      if (result.payment.amountVnd !== selectedPrice.amountVnd || result.payment.currency !== selectedPrice.currency) {
        setPriceNotice(
          l(
            'Bảng giá đã cập nhật. Kiểm tra số tiền trên lệnh và mã QR trước khi chuyển khoản.',
            'Pricing has been updated. Please verify the amount on the payment order and QR code before transferring.',
          ),
        );
        setPricesReload((value) => value + 1);
      }
      paymentOwnerRef.current = `${userId}:${requestedHouseholdId}`;
      if (checkoutAdmissionEnabled) {
        setHasOpenCheckout(true);
        setRecoverableCheckoutId(result.payment.id);
      }
      paymentIdRef.current = result.payment.id;
      setPaymentIntent(result.payment);
      setIsQRModalOpen(true);
      setHistoryBlockingCheckout(true);
      setAccountRefreshVersion((version) => version + 1);
    } catch (error) {
      if (requestGeneration === requestGenerationRef.current && active && isCurrent() &&
          error instanceof ApiError && error.code === 'PAYMENT_RECONCILIATION_REQUIRED') setHasOpenCheckout(true);
      if (requestGeneration === requestGenerationRef.current && active && isCurrent()) setErrorMsg(
        error instanceof ApiError && error.code === 'PAYMENT_RECONCILIATION_REQUIRED'
          ? l(
              'Lệnh thanh toán đang chờ đối soát. Không chuyển tiền thêm hoặc tạo lệnh thay thế.',
              'A payment order is awaiting reconciliation. Do not send additional funds or create a duplicate order.',
            )
          : l(
              'Không thể tạo lệnh thanh toán. Vui lòng thử lại.',
              'Could not create payment order. Please try again.',
            ),
      );
    } finally {
      unsubscribe();
      if (requestGeneration === requestGenerationRef.current) {
        creatingRef.current = false;
        if (active && mountedRef.current && isCurrent() && useAuthStore.getState().householdId === requestedHouseholdId && selectedPlanRef.current === requestedPlan) setIsCreating(false);
      }
    }
  };

  const handleResumeCheckout = async (intentId = recoverableCheckoutId) => {
    if (!ownsCurrentSession() || !accountReady || !intentId || creatingRef.current || isGuest || !userId || !householdId) return;
    const generation = requestGenerationRef.current;
    const isCurrent = capturePrivateSession();
    creatingRef.current = true; setIsCreating(true);
    try {
      const result = await billingApi.resumeCheckout(intentId);
      if (!mountedRef.current || generation !== requestGenerationRef.current || !isCurrent()) return;
      paymentOwnerRef.current = `${userId}:${householdId}`;
      paymentIdRef.current = result.payment.id;
      setPaymentIntent(result.payment); setIsQRModalOpen(true);
    } catch {
      if (mountedRef.current && generation === requestGenerationRef.current && isCurrent())
        setErrorMsg(
          l(
            'Chưa mở được lệnh cũ. Không chuyển tiền thêm; kiểm tra trạng thái trước khi thử lại.',
            'Could not reopen the previous order. Do not send additional funds; check its status before trying again.',
          ),
        );
    } finally {
      if (generation === requestGenerationRef.current) {
        creatingRef.current = false;
        if (mountedRef.current && isCurrent()) setIsCreating(false);
      }
    }
  };

  const handleHistoryResume = (payment: BillingHistoryPayment, trigger: HTMLButtonElement) => {
    if (!payment.canResume) return;
    checkoutTriggerRef.current = trigger;
    void handleResumeCheckout(payment.id);
  };

  const handlePaymentSuccess = () => {
    checkoutKeyRef.current = null;
    setAttemptedPlan(null);
    setIsQRModalOpen(false);
    setPaymentIntent(null);
    navigate('/me');
  };

  if (isGuest) {
    return (
      <div className={clsx('plus-page', embedded && 'takolio-plus-embedded')}>
        {!embedded && <KitchenHeader backTo="/me" />}
        <div className={clsx(!embedded && 'kitchen-page-body mx-auto w-full max-w-[var(--content-compact)]')}>
          {!embedded && <KitchenPageHeading title="Takolio Pro" />}
          <section className="overflow-hidden rounded-[24px] border border-semantic-border bg-semantic-surface shadow-card">
            <div className="plus-hero bg-gradient-to-br from-semantic-action-primary-pressed to-semantic-action-primary-hover px-6 py-7 text-white">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15">
                <ShieldCheck aria-hidden="true" className="h-6 w-6 text-takosan-yellow" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-takosan-yellow">
                {l('Tài khoản bắt buộc', 'Account required')}
              </p>
              <h2 className="mt-2 text-balance font-heading text-2xl font-bold leading-tight text-white">
                {l('Đăng nhập trước khi chọn gói Pro', 'Sign in before choosing a Pro plan')}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white">
                {l(
                  'Gói Pro được gắn với tài khoản để quyền lợi không mất khi bạn đổi thiết bị. Dữ liệu phiên khách vẫn được giữ riêng khi bạn đăng nhập.',
                  'Your Pro plan is tied to your account so your benefits stay with you across devices. Your guest session data remains separate when you sign in.',
                )}
              </p>
            </div>
            <div className="space-y-3 p-5">
              <Link
                to="/auth?mode=login&returnTo=%2Fplus"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-takosan-green px-4 py-3 font-heading text-sm font-bold text-white shadow-xs transition hover:bg-takosan-green-deep active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-takosan-green focus-visible:ring-offset-2"
              >
                <LogIn aria-hidden="true" className="h-4 w-4" />
                {l('Đăng nhập để tiếp tục', 'Sign in to continue')}
              </Link>
              <Link
                to="/"
                className="flex min-h-11 w-full items-center justify-center rounded-full border border-semantic-border bg-white px-4 py-3 text-sm font-semibold text-semantic-text-secondary transition hover:bg-semantic-background-subtle active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-strong focus-visible:ring-offset-2"
              >
                {l('Quay lại bảng điều khiển', 'Back to dashboard')}
              </Link>
              <p className="text-center text-xs leading-relaxed text-semantic-text-muted">
                {l(
                  'Chưa có tài khoản? Bạn có thể đăng ký từ màn hình đăng nhập.',
                  'No account yet? You can register from the sign-in screen.',
                )}
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('plus-page', embedded && 'takolio-plus-embedded')}>
      {!embedded && <KitchenHeader backTo="/me" />}
      <div className={clsx('space-y-5', !embedded && 'kitchen-page-body mx-auto w-full max-w-[var(--content-compact)]')}>
        {!embedded && (
          <KitchenPageHeading
            title={
              isPlus
                ? l('Quản lý Takolio Pro', 'Manage Takolio Pro')
                : l('Nâng cấp Takolio Pro', 'Upgrade to Takolio Pro')
            }
          />
        )}
        {!embedded && (
          <div className="plus-hero bg-gradient-to-br from-semantic-action-primary-pressed to-semantic-action-primary-hover text-white rounded-card p-5 shadow-card flex items-center justify-between gap-3 overflow-hidden border border-semantic-action-primary/40">
            <div className="space-y-1 max-w-[200px]">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="w-4 h-4 text-takosan-yellow" />
                <span className="text-[10px] font-semibold text-takosan-yellow uppercase tracking-wider">Takolio Pro</span>
              </div>
              <h2 className="font-heading font-bold text-xl leading-tight text-white">
                {isPlus
                  ? l('Bạn là hội viên Pro', 'You are a Pro member')
                  : l('Nấu ăn thông minh hơn', 'Cook smarter every day')}
              </h2>
              <p className="text-xs text-white">
                {isPlus
                  ? l(
                      'Gói hội viên đang hoạt động với đầy đủ đặc quyền',
                      'Your membership is active with all Pro features unlocked',
                    )
                  : l(
                      'Mở khóa toàn bộ tính năng cao cấp cùng AI Chef',
                      'Unlock all premium features with AI Chef',
                    )}
              </p>
            </div>
            <div className="w-24 h-24 shrink-0 overflow-hidden flex items-center justify-center">
              <img src="/takolio/vnext/mascot/pose-06-achievement.webp" alt="" aria-hidden="true" className="w-full h-full object-contain" />
            </div>
          </div>
        )}

        <section className="space-y-4 rounded-[24px] border border-semantic-border bg-white p-5 sm:p-6 shadow-xs">
          {accountReady && historyBlockingCheckout && (
            <p role="status" className="rounded-2xl border border-semantic-border bg-semantic-surface p-4 text-sm">
              {l(
                'Bạn còn lệnh thanh toán đang mở hoặc chờ đối soát. Kiểm tra lệnh cũ trong lịch sử trước khi tạo lệnh mới.',
                'You have an open payment order or one awaiting reconciliation. Check your order history before creating a new one.',
              )}
            </p>
          )}

          {priceNotice && (
            <p role="status" className="rounded-2xl border border-semantic-border bg-semantic-surface p-4 text-sm">
              {priceNotice}
            </p>
          )}
          {errorMsg && (
            <div className="space-y-2">
              <p role="alert" className="rounded-2xl border border-semantic-danger/20 bg-semantic-danger-soft px-3.5 py-2.5 text-sm text-semantic-danger-strong">
                {errorMsg}
              </p>
              {checkoutRecoveryPending && (
                <Button variant="outline" onClick={() => setPricesReload((value) => value + 1)}>
                  {l('Tải lại bảng giá', 'Reload prices')}
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label={l('Gói Takolio Pro', 'Takolio Pro plans')}>
            {plans.map((price) => {
              const isSelected = selectedPlan === price.plan;
              const isAnnual = price.plan === 'annual';
              return (
                <button
                  key={price.plan}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={attemptedPlan !== null || hasOpenCheckout || historyBlockingCheckout}
                  onClick={() => { setSelectedPlan(price.plan); setPaymentIntent(null); setIsQRModalOpen(false); }}
                  className={clsx(
                    'text-left rounded-2xl p-4 relative cursor-pointer transition-tap active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-t17-focus',
                    isSelected
                      ? 'bg-[var(--tkv-surface-mint)] border-2 border-[var(--tkv-primary)] shadow-xs'
                      : 'bg-white border border-semantic-border hover:border-semantic-border-strong',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-heading font-bold text-xs uppercase tracking-wider text-semantic-text-secondary">
                      {planName(price.plan, l)}
                    </p>
                    {isAnnual && (
                      <span className="rounded-full border border-[var(--tkv-border-saffron)] bg-[var(--tkv-surface-saffron)] px-2.5 py-0.5 text-[11px] font-extrabold text-[var(--tkv-warning-ink)]">
                        {l('Tiết kiệm 15%', 'Save 15%')}
                      </span>
                    )}
                  </div>
                  <p className="font-heading font-extrabold tabular-nums text-2xl text-semantic-text-primary mt-1.5">
                    {formatPrice(price, locale)}
                  </p>
                  <p className="text-xs text-semantic-text-secondary mt-1">
                    {isAnnual
                      ? l('Trả 1 lần · không tự động trừ tiền', 'One-time payment · no auto-renewal')
                      : l(
                          'Linh hoạt 30 ngày · chuyển khoản VietQR',
                          'Flexible 30 days · VietQR bank transfer',
                        )}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5 pt-1">
            {recoverableCheckoutId && (
              <Button fullWidth size="lg" disabled={isCreating || !accountReady} onClick={(event) => { checkoutTriggerRef.current = event.currentTarget; void handleResumeCheckout(); }}>
                {l('Mở lệnh thanh toán cũ', 'Resume previous payment order')}
              </Button>
            )}
            <Button
              fullWidth
              size="lg"
              disabled={checkoutRecoveryPending || hasOpenCheckout || historyBlockingCheckout || !accountReady || !selectedPrice || isCreating}
              onClick={(event) => { checkoutTriggerRef.current = event.currentTarget; void handleCreateIntent(); }}
              className="flex items-center justify-center gap-2 !rounded-full"
            >
              <span>
                {isCreating
                  ? l('Đang tạo lệnh thanh toán…', 'Creating payment order…')
                  : isPlus
                    ? l('Gia hạn hội viên', 'Renew membership')
                    : selectedPrice
                      ? l(
                          `Nâng cấp ngay với ${formatPrice(selectedPrice, locale)}`,
                          `Upgrade now for ${formatPrice(selectedPrice, locale)}`,
                        )
                      : l('Đang tải bảng giá…', 'Loading prices…')}
              </span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <p className="text-center text-[11px] text-semantic-text-muted">
              {l(
                'Quét mã VietQR trên mọi ứng dụng ngân hàng Việt Nam · Kích hoạt tức thì · Không tự gia hạn ẩn.',
                'Scan VietQR with any Vietnamese banking app · Instant activation · No hidden auto-renewal.',
              )}
            </p>
          </div>
        </section>

        <section className="space-y-2.5 bg-white rounded-[24px] p-5 border border-semantic-border shadow-xs">
          <h3 className="font-heading font-bold text-sm text-semantic-text-primary mb-1">
            {l('Quyền lợi Takolio Pro', 'Takolio Pro benefits')}
          </h3>
          {[
            l(
              'Quét ảnh tủ lạnh & hoá đơn siêu thị bằng AI không giới hạn',
              'Unlimited AI fridge & grocery receipt scans',
            ),
            l(
              'Lập thực đơn tuần tự động & tối ưu danh sách đi chợ thông minh',
              'Automatic weekly meal planning & smart grocery lists',
            ),
            l(
              '500+ công thức chuẩn hoá kèm dinh dưỡng & khẩu phần linh hoạt',
              '500+ structured recipes with nutrition & flexible portion scaling',
            ),
            l(
              'Trợ lý nấu ăn giọng nói rảnh tay & đồng bộ đa thiết bị cho gia đình',
              'Hands-free voice cooking assistant & multi-device family sync',
            ),
          ].map((feature) => (
            <div key={feature} className="flex items-start gap-2.5 text-xs sm:text-sm text-semantic-text-secondary font-medium py-0.5">
              <div className="mt-0.5 w-5 h-5 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-[var(--tkv-primary)] stroke-[2.5]" />
              </div>
              <span>{feature}</span>
            </div>
          ))}
        </section>

        <BillingAccountPanel refreshVersion={accountRefreshVersion} isBusy={isCreating} onResume={handleHistoryResume} onLoaded={onAccountLoaded} onLoading={onAccountLoading} />
      </div>

      {paymentIntent && paymentOwnerRef.current === `${userId}:${householdId}` && (
        <VietQRModal
          isOpen={isQRModalOpen}
          onClose={() => { setIsQRModalOpen(false); setAccountRefreshVersion((version) => version + 1); }}
          onSuccess={handlePaymentSuccess}
          intent={paymentIntent}
          recoverable={checkoutAdmissionEnabled}
          returnFocus={checkoutTriggerRef}
        />
      )}
    </div>
  );
};
