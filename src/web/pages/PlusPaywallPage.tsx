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

function planName(plan: PlusPlan): string {
  return plan === 'annual' ? 'Gói 1 Năm' : 'Gói 1 Tháng';
}

function formatPrice(price: PlusPrice): string {
  return `${price.amountVnd.toLocaleString('vi-VN')} ${price.currency}`;
}

export const PlusPaywallPage: React.FC = () => {
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
  const [selectedPlan, setSelectedPlan] = useState<PlusPlan>('annual');
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
      if (active && isCurrent()) setErrorMsg('Không thể tải bảng giá từ máy chủ. Vui lòng thử lại.');
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
        setPriceNotice('Bảng giá đã cập nhật. Kiểm tra số tiền trên lệnh và mã QR trước khi chuyển khoản.');
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
          ? 'Lệnh thanh toán đang chờ đối soát. Không chuyển tiền thêm hoặc tạo lệnh thay thế.'
          : 'Không thể tạo lệnh thanh toán. Vui lòng thử lại.',
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
      if (mountedRef.current && generation === requestGenerationRef.current && isCurrent()) setErrorMsg('Chưa mở được lệnh cũ. Không chuyển tiền thêm; kiểm tra trạng thái trước khi thử lại.');
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
      <div className="plus-page">
        <KitchenHeader backTo="/me" />
        <div className="kitchen-page-body mx-auto w-full max-w-[var(--content-compact)]">
          <KitchenPageHeading title="Takolio Pro" />
          <section className="overflow-hidden rounded-feature border border-[var(--sumi-border,#E4E4E0)] bg-white">
            <div className="plus-hero bg-[var(--sumi-ink,#111315)] px-6 py-7 text-white">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <ShieldCheck aria-hidden="true" className="h-6 w-6 text-white" />
              </div>
              <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--sumi-dot,#C84B31)]" aria-hidden="true" />
                <span>Tài khoản bắt buộc</span>
              </p>
              <h2 className="mt-2 text-balance font-heading text-2xl font-bold leading-tight text-white">Đăng nhập trước khi chọn gói Pro</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                Gói Pro được gắn với tài khoản để quyền lợi không mất khi bạn đổi thiết bị. Dữ liệu phiên khách vẫn được giữ riêng khi bạn đăng nhập.
              </p>
            </div>
            <div className="space-y-3 p-5">
              <Link
                to="/auth?mode=login&returnTo=%2Fplus"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--sumi-ink,#111315)] px-4 py-3 font-heading text-sm font-bold text-white transition-colors hover:bg-[var(--sumi-ink-hover,#23262A)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sumi-ink,#111315)] focus-visible:ring-offset-2"
              >
                <LogIn aria-hidden="true" className="h-4 w-4" />
                Đăng nhập để tiếp tục
              </Link>
              <Link
                to="/"
                className="flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--sumi-border,#E4E4E0)] bg-white px-4 py-3 text-sm font-semibold text-[var(--sumi-ink,#111315)] transition-colors hover:bg-[var(--sumi-canvas,#F7F7F5)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sumi-border-strong,#CFCFC9)] focus-visible:ring-offset-2"
              >
                Quay lại bảng điều khiển
              </Link>
              <p className="text-center text-xs leading-relaxed text-[var(--sumi-muted,#5C5F62)]">
                Chưa có tài khoản? Bạn có thể đăng ký từ màn hình đăng nhập.
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="plus-page">
      <KitchenHeader backTo="/me" />
      <div className="kitchen-page-body mx-auto w-full max-w-[var(--content-compact)] space-y-5">
        <KitchenPageHeading title={isPlus ? "Quản lý Takolio Pro" : "Nâng cấp Takolio Pro"} />
        <div className="plus-hero bg-[var(--sumi-ink,#111315)] text-white rounded-card p-5 flex items-center justify-between gap-3 overflow-hidden border border-[var(--sumi-ink,#111315)]">
          <div className="space-y-1 max-w-[230px]">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--sumi-dot,#C84B31)]" aria-hidden="true" />
              <Sparkles className="w-3.5 h-3.5 text-white/80" />
              <span className="text-[10px] font-semibold text-white/80 uppercase tracking-widest">Takolio Pro</span>
            </div>
            <h2 className="font-heading font-bold text-xl leading-tight text-white">
              {isPlus ? 'Bạn là hội viên Pro' : 'Nấu ăn thông minh hơn'}
            </h2>
            <p className="text-xs text-white/80 leading-relaxed">
              {isPlus ? 'Gói hội viên đang hoạt động với đầy đủ đặc quyền' : 'Mở khóa toàn bộ tính năng cao cấp cùng AI Chef'}
            </p>
          </div>
          <div className="w-20 h-20 shrink-0 overflow-hidden flex items-center justify-center rounded-2xl bg-white/10 border border-white/15 p-1.5">
            <img src="/takolio/vnext/mascot/pose-06-achievement.webp" alt="" aria-hidden="true" className="w-full h-full object-contain" />
          </div>
        </div>

        <BillingAccountPanel refreshVersion={accountRefreshVersion} isBusy={isCreating} onResume={handleHistoryResume} onLoaded={onAccountLoaded} onLoading={onAccountLoading} />
        {accountReady && historyBlockingCheckout && <p role="status" className="rounded-xl border border-[var(--sumi-border,#E4E4E0)] bg-[var(--sumi-canvas,#F7F7F5)] p-4 text-sm text-[var(--sumi-ink,#111315)]">Bạn còn lệnh thanh toán đang mở hoặc chờ đối soát. Kiểm tra lệnh cũ trong lịch sử trước khi tạo lệnh mới.</p>}

        {priceNotice && <p role="status" className="rounded-xl border border-[var(--sumi-border,#E4E4E0)] bg-[var(--sumi-canvas,#F7F7F5)] p-4 text-sm text-[var(--sumi-ink,#111315)]">{priceNotice}</p>}
        {errorMsg && <div className="space-y-2"><p role="alert" className="rounded-xl border border-[var(--sumi-border-strong,#CFCFC9)] bg-[var(--sumi-canvas,#F7F7F5)] px-3.5 py-2.5 text-sm font-medium text-[var(--sumi-ink,#111315)]">{errorMsg}</p>{checkoutRecoveryPending && <Button variant="outline" onClick={() => setPricesReload((value) => value + 1)}>Tải lại bảng giá</Button>}</div>}

        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Gói Takolio Pro">
          {plans.map((price) => {
            const isSelected = selectedPlan === price.plan;
            return (
              <button
                key={price.plan}
                type="button"
                aria-pressed={isSelected}
                disabled={attemptedPlan !== null || hasOpenCheckout || historyBlockingCheckout}
                onClick={() => { setSelectedPlan(price.plan); setPaymentIntent(null); setIsQRModalOpen(false); }}
                className={clsx(
                  'text-left rounded-xl p-4 relative cursor-pointer transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-t17-focus border',
                  isSelected
                    ? 'bg-[var(--sumi-ink,#111315)] text-white border-[var(--sumi-ink,#111315)]'
                    : 'bg-white text-[var(--sumi-ink,#111315)] border-[var(--sumi-border,#E4E4E0)] hover:border-[var(--sumi-ink,#111315)]',
                )}
              >
                <p className={clsx('font-heading font-semibold text-xs flex items-center justify-between', isSelected ? 'text-white/80' : 'text-[var(--sumi-muted,#5C5F62)]')}>
                  <span>{planName(price.plan)}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[var(--sumi-dot,#C84B31)]" aria-hidden="true" />}
                </p>
                <p className={clsx('font-heading font-bold text-xl mt-1 tabular-nums', isSelected ? 'text-white' : 'text-[var(--sumi-ink,#111315)]')}>
                  {formatPrice(price)}
                </p>
              </button>
            );
          })}
        </div>

        <div className="space-y-2 bg-white rounded-xl p-4 border border-[var(--sumi-border,#E4E4E0)]">
          <h3 className="font-heading font-bold text-sm text-[var(--sumi-ink,#111315)] mb-2">Quyền lợi thành viên:</h3>
          {[
            'Không giới hạn số lượng nguyên liệu trong tủ lạnh',
            'Không giới hạn lượt quét AI tủ lạnh & hóa đơn siêu thị OCR',
            'Trọn bộ Takolio Planner lập thực đơn tuần tự động',
            'AI Voice Sous Chef trợ lý nấu ăn rảnh tay thông minh',
            'Đầy đủ 6 nền ẩm thực (Việt, Hàn, Nhật, Trung, Thái, Ý)',
            'Gợi ý công thức nâng cao bởi DeepSeek AI Chef',
            'Ưu tiên nhận diện hoá đơn & nguyên liệu AI chính xác cao',
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-2.5 text-xs text-[var(--sumi-muted,#5C5F62)] font-medium py-1">
              <div className="w-5 h-5 rounded-full bg-[var(--sumi-canvas,#F7F7F5)] border border-[var(--sumi-border,#E4E4E0)] flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5 text-[var(--sumi-ink,#111315)] stroke-[2.5]" /></div>
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <div className="pt-2 space-y-2">
          {recoverableCheckoutId && (
            <Button fullWidth size="lg" disabled={isCreating || !accountReady} onClick={(event) => { checkoutTriggerRef.current = event.currentTarget; void handleResumeCheckout(); }}>
              Mở lệnh thanh toán cũ
            </Button>
          )}
          <Button fullWidth size="lg" disabled={checkoutRecoveryPending || hasOpenCheckout || historyBlockingCheckout || !accountReady || !selectedPrice || isCreating} onClick={(event) => { checkoutTriggerRef.current = event.currentTarget; void handleCreateIntent(); }} className="flex items-center justify-center gap-2 tabular-nums">
            <span>{isCreating ? 'Đang tạo lệnh thanh toán…' : isPlus ? 'Gia hạn hội viên' : selectedPrice ? `Nâng cấp ngay với ${formatPrice(selectedPrice)}` : 'Đang tải bảng giá…'}</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
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
