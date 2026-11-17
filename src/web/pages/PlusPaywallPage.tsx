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
import { BentoCard, AtelierBadge } from '../design-system/v4/AtelierPrimitives';
import {
  CrownPlusIcon,
  NavScanApertureIcon,
  AiSousChefSparkIcon,
  HouseholdTrayIcon,
  VietQRBadgeIcon,
} from '../design-system/icons';
import { TakoChef3D } from '../components/3d';
import { Check, ArrowRight, LogIn, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

function planName(plan: PlusPlan): string {
  return plan === 'annual' ? 'Gói 1 Năm' : 'Gói 1 Tháng';
}

function formatPrice(price: PlusPrice): string {
  return `${price.amountVnd.toLocaleString('vi-VN')} ${price.currency}`;
}

interface EntitlementComparisonRow {
  feature: string;
  freeTier: string;
  plusTier: string;
  highlightPlus?: boolean;
}

const ENTITLEMENT_COMPARISON: EntitlementComparisonRow[] = [
  {
    feature: 'Thực đơn Mâm Cơm 7 ngày & gợi ý cân bằng nhóm món',
    freeTier: 'Miễn phí 100%',
    plusTier: 'Miễn phí 100%',
  },
  {
    feature: '500+ công thức chuẩn vị Việt & quốc tế V4',
    freeTier: 'Miễn phí 100%',
    plusTier: 'Miễn phí 100%',
  },
  {
    feature: 'Không gian Bếp 3D & Đạo diễn Mâm Cơm song song',
    freeTier: 'Miễn phí 100%',
    plusTier: 'Miễn phí 100%',
  },
  {
    feature: 'Tủ lạnh thông minh FEFO & Đi chợ khép kín 1 chạm',
    freeTier: 'Miễn phí 100%',
    plusTier: 'Miễn phí 100%',
  },
  {
    feature: 'Chia sẻ bếp gia đình đa thành viên (mã mời TAKO)',
    freeTier: 'Miễn phí 100%',
    plusTier: 'Miễn phí 100%',
  },
  {
    feature: 'Quét AI Tủ Lạnh & Hóa đơn Siêu thị OCR',
    freeTier: '6 lượt / tháng',
    plusTier: '100 lượt / tháng',
    highlightPlus: true,
  },
  {
    feature: 'Luồng xử lý AI Vision & Bếp Phó tốc độ cao',
    freeTier: 'Tiêu chuẩn',
    plusTier: 'Ưu tiên tốc độ cao',
    highlightPlus: true,
  },
];

export const PlusPaywallPage: React.FC = () => {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);
  const householdId = useAuthStore((s) => s.householdId);
  const isGuest = useAuthStore((s) => s.isGuest);
  const cachedIsPlus = useAuthStore((s) => s.isPlus);
  const [verifiedPlus, setVerifiedPlus] = useState<{ owner: string; active: boolean } | null>(null);
  const isPlus =
    verifiedPlus?.owner === `${userId}:${householdId}` ? verifiedPlus.active : cachedIsPlus;
  const isRenderCurrent = typeof window === 'undefined' ? () => false : capturePrivateSession();
  const ownsCurrentSession = () =>
    isRenderCurrent() &&
    !useAuthStore.getState().isGuest &&
    useAuthStore.getState().userId === userId &&
    useAuthStore.getState().householdId === householdId;

  const [plans, setPlans] = useState<PlusPrice[]>([]);
  const [checkoutAdmissionEnabled, setCheckoutAdmissionEnabled] = useState(false);
  const [checkoutRecoveryPending, setCheckoutRecoveryPending] = useState(true);
  const [hasOpenCheckout, setHasOpenCheckout] = useState(false);
  const [historyBlockingCheckout, setHistoryBlockingCheckout] = useState(true);
  const [accountReady, setAccountReady] = useState(false);
  const [accountRefreshVersion, setAccountRefreshVersion] = useState(0);
  const [pricesReload, setPricesReload] = useState(0);
  const onAccountLoading = useCallback(() => {
    setAccountReady(false);
  }, []);
  const onAccountLoaded = useCallback((account: BillingAccount) => {
    const owner = useAuthStore.getState();
    setVerifiedPlus({
      owner: `${owner.userId}:${owner.householdId}`,
      active: account.subscription.plan === 'plus' && account.subscription.status === 'active',
    });
    setHistoryBlockingCheckout(account.hasPendingPayment);
    setHasOpenCheckout(account.hasPendingPayment);
    setRecoverableCheckoutId(account.payments.find((payment) => payment.canResume)?.id ?? null);
    setAccountReady(true);
    if (
      paymentIdRef.current &&
      account.payments.some(
        (payment) => payment.id === paymentIdRef.current && payment.status !== 'pending',
      )
    ) {
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
    const unsubscribe = onPrivateSessionReset(() => {
      active = false;
    });
    setErrorMsg(null);
    void billingApi
      .getPlans()
      .then((result) => {
        if (!active || !isCurrent()) return;
        setCheckoutAdmissionEnabled(result.checkoutAdmissionEnabled);
        setCheckoutRecoveryPending(false);
        const nextPlans = result.plans.filter(
          (price) => price.plan === 'monthly' || price.plan === 'annual',
        );
        setPlans(nextPlans);
        if (!nextPlans.some((price) => price.plan === selectedPlanRef.current)) {
          setSelectedPlan(nextPlans[0]?.plan ?? 'annual');
        }
      })
      .catch(() => {
        if (active && isCurrent())
          setErrorMsg('Không thể tải bảng giá từ máy chủ. Vui lòng thử lại.');
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
    if (
      !ownsCurrentSession() ||
      checkoutRecoveryPending ||
      hasOpenCheckout ||
      historyBlockingCheckout ||
      !accountReady ||
      !selectedPrice ||
      isCreating ||
      creatingRef.current ||
      isGuest ||
      !userId ||
      !householdId
    )
      return;
    const requestedPlan = selectedPrice.plan;
    const requestedHouseholdId = householdId;
    const requestGeneration = requestGenerationRef.current;
    const isCurrent = capturePrivateSession();
    let active = true;
    const unsubscribe = onPrivateSessionReset(() => {
      active = false;
    });
    creatingRef.current = true;
    setIsCreating(true);
    setErrorMsg(null);
    setPriceNotice(null);
    try {
      if (checkoutAdmissionEnabled) {
        checkoutKeyRef.current ??= crypto.randomUUID();
        setAttemptedPlan(requestedPlan);
      }
      const result = await billingApi.createPaymentIntent(
        selectedPrice.plan,
        checkoutKeyRef.current ?? undefined,
      );
      if (
        requestGeneration !== requestGenerationRef.current ||
        !active ||
        !mountedRef.current ||
        !isCurrent() ||
        useAuthStore.getState().userId !== userId ||
        useAuthStore.getState().householdId !== requestedHouseholdId ||
        selectedPlanRef.current !== requestedPlan
      )
        return;
      if (result.payment.plan !== requestedPlan) throw new Error('PAYMENT_PLAN_MISMATCH');
      if (
        result.payment.amountVnd !== selectedPrice.amountVnd ||
        result.payment.currency !== selectedPrice.currency
      ) {
        setPriceNotice(
          'Bảng giá đã cập nhật. Kiểm tra số tiền trên lệnh và mã QR trước khi chuyển khoản.',
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
      if (
        requestGeneration === requestGenerationRef.current &&
        active &&
        isCurrent() &&
        error instanceof ApiError &&
        error.code === 'PAYMENT_RECONCILIATION_REQUIRED'
      )
        setHasOpenCheckout(true);
      if (requestGeneration === requestGenerationRef.current && active && isCurrent())
        setErrorMsg(
          error instanceof ApiError && error.code === 'PAYMENT_RECONCILIATION_REQUIRED'
            ? 'Lệnh thanh toán đang chờ đối soát. Không chuyển tiền thêm hoặc tạo lệnh thay thế.'
            : 'Không thể tạo lệnh thanh toán. Vui lòng thử lại.',
        );
    } finally {
      unsubscribe();
      if (requestGeneration === requestGenerationRef.current) {
        creatingRef.current = false;
        if (
          active &&
          mountedRef.current &&
          isCurrent() &&
          useAuthStore.getState().householdId === requestedHouseholdId &&
          selectedPlanRef.current === requestedPlan
        )
          setIsCreating(false);
      }
    }
  };

  const handleResumeCheckout = async (intentId = recoverableCheckoutId) => {
    if (
      !ownsCurrentSession() ||
      !accountReady ||
      !intentId ||
      creatingRef.current ||
      isGuest ||
      !userId ||
      !householdId
    )
      return;
    const generation = requestGenerationRef.current;
    const isCurrent = capturePrivateSession();
    creatingRef.current = true;
    setIsCreating(true);
    try {
      const result = await billingApi.resumeCheckout(intentId);
      if (!mountedRef.current || generation !== requestGenerationRef.current || !isCurrent())
        return;
      paymentOwnerRef.current = `${userId}:${householdId}`;
      paymentIdRef.current = result.payment.id;
      setPaymentIntent(result.payment);
      setIsQRModalOpen(true);
    } catch {
      if (mountedRef.current && generation === requestGenerationRef.current && isCurrent())
        setErrorMsg(
          'Chưa mở được lệnh cũ. Không chuyển tiền thêm; kiểm tra trạng thái trước khi thử lại.',
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
      <div className="plus-page">
        <KitchenHeader backTo="/me" />
        <div className="kitchen-page-body mx-auto w-full max-w-[var(--content-compact)] space-y-5">
          <KitchenPageHeading
            eyebrow="Takolio · HỘI VIÊN AI"
            title="Takolio Plus"
            description="Thực đơn Mâm Cơm 7 ngày, 500+ công thức và Bếp 3D luôn miễn phí 100%."
          />
          <section className="overflow-hidden rounded-[28px] border border-tk-stone bg-white shadow-card">
            <div className="plus-hero bg-tk-sanctuary-card px-6 py-7 text-white border-b border-white/10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <ShieldCheck aria-hidden="true" className="h-6 w-6 text-tk-turmeric" />
              </div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-tk-turmeric">
                Tài khoản bắt buộc
              </p>
              <h2 className="mt-2 text-balance font-heading text-2xl font-extrabold leading-tight text-white">
                Đăng nhập trước khi chọn gói Plus
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                Takolio Plus gắn liền với tài khoản gia đình để 100 lượt Quét AI Tủ Lạnh &amp; Hóa
                đơn OCR mỗi tháng được đồng bộ trên mọi thiết bị. Toàn bộ nguyên liệu trong phiên
                khách sẽ được giữ nguyên khi bạn đăng nhập.
              </p>
            </div>
            <div className="space-y-3 p-5">
              <Link
                to="/auth?mode=login&returnTo=%2Fplus"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-tk-flame px-5 py-3 font-heading text-sm font-extrabold text-white shadow-float transition-tap hover:bg-tk-flame-hover active:scale-[0.98]"
              >
                <LogIn aria-hidden="true" className="h-4 w-4" />
                Đăng nhập để tiếp tục
              </Link>
              <Link
                to="/"
                className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-tk-stone bg-white px-4 py-3 text-sm font-bold text-tk-secondary transition-colors hover:bg-tk-canvas"
              >
                Quay lại bảng điều khiển
              </Link>
              <p className="text-center text-xs leading-relaxed text-tk-muted">
                Chưa có tài khoản? Bạn có thể tạo tài khoản miễn phí ngay từ màn hình đăng nhập.
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
        <KitchenPageHeading
          eyebrow="Takolio · MINH BẠCH QUYỀN LỢI"
          title={isPlus ? 'Quản lý Takolio Plus' : 'Nâng cấp Takolio Plus'}
          description="Mọi tính năng nấu nướng cốt lõi đều miễn phí. Takolio Plus mở rộng hạn mức Quét AI & xử lý tốc độ cao."
        />

        <div className="plus-hero bg-tk-sanctuary-card text-white rounded-[28px] p-5 sm:p-6 shadow-elevated flex items-center justify-between gap-4 overflow-hidden border border-white/10">
          <div className="space-y-2 min-w-0">
            <AtelierBadge tone="dark" icon={<CrownPlusIcon size={14} tone="turmeric" active />}>
              Takolio Plus
            </AtelierBadge>
            <h2 className="font-heading font-extrabold text-xl sm:text-2xl leading-tight text-white">
              {isPlus ? 'Bạn là hội viên Takolio Plus' : 'Tăng tốc Quét AI cho cả gia đình'}
            </h2>
            <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
              {isPlus
                ? 'Đang kích hoạt 100 lượt Quét AI Tủ lạnh & OCR Hóa đơn mỗi tháng cùng luồng AI ưu tiên.'
                : 'Nhận 100 lượt Quét AI Tủ lạnh & OCR Hóa đơn siêu thị mỗi tháng (gấp 16 lần gói cơ bản) và luồng AI tốc độ cao.'}
            </p>
          </div>
          <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 flex items-center justify-center">
            <TakoChef3D pose="celebrate" size={104} interactive={false} />
          </div>
        </div>

        <BillingAccountPanel
          refreshVersion={accountRefreshVersion}
          isBusy={isCreating}
          onResume={handleHistoryResume}
          onLoaded={onAccountLoaded}
          onLoading={onAccountLoading}
        />

        {accountReady && historyBlockingCheckout && (
          <p
            role="status"
            className="rounded-2xl border border-tk-turmeric/30 bg-tk-turmeric-soft p-4 text-sm font-semibold text-tk-turmeric-deep"
          >
            Bạn còn lệnh thanh toán đang mở hoặc chờ đối soát. Kiểm tra lệnh cũ trong lịch sử trước
            khi tạo lệnh mới.
          </p>
        )}

        {priceNotice && (
          <p
            role="status"
            className="rounded-2xl border border-tk-turmeric/30 bg-tk-turmeric-soft p-4 text-sm font-semibold text-tk-turmeric-deep"
          >
            {priceNotice}
          </p>
        )}

        {errorMsg && (
          <div className="space-y-2">
            <p
              role="alert"
              className="rounded-2xl border border-tk-berry/25 bg-tk-berry-soft px-4 py-3 text-sm font-semibold text-tk-berry-deep"
            >
              {errorMsg}
            </p>
            {checkoutRecoveryPending && (
              <Button
                variant="outline"
                onClick={() => setPricesReload((value) => value + 1)}
              >
                Tải lại bảng giá
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label="Gói Takolio Plus">
          {plans.map((price) => {
            const isSelected = selectedPlan === price.plan;
            return (
              <button
                key={price.plan}
                type="button"
                aria-pressed={isSelected}
                disabled={attemptedPlan !== null || hasOpenCheckout || historyBlockingCheckout}
                onClick={() => {
                  setSelectedPlan(price.plan);
                  setPaymentIntent(null);
                  setIsQRModalOpen(false);
                }}
                className={clsx(
                  'text-left rounded-3xl p-4 sm:p-5 relative cursor-pointer transition-tap active:scale-[0.985] focus-visible:outline-none focus-visible:shadow-t17-focus disabled:opacity-60 disabled:cursor-not-allowed',
                  isSelected
                    ? 'bg-tk-flame-soft/70 border-2 border-tk-flame shadow-card'
                    : 'bg-white border border-tk-stone hover:border-tk-ink/25 shadow-xs',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-heading font-extrabold text-xs uppercase tracking-wider text-tk-secondary">
                    {planName(price.plan)}
                  </p>
                  {price.plan === 'annual' && (
                    <AtelierBadge tone="flame">Tiết kiệm 2 tháng</AtelierBadge>
                  )}
                </div>
                <p className="font-heading font-extrabold text-2xl text-tk-ink mt-2 tk-tabular">
                  {formatPrice(price)}
                </p>
                <p className="text-xs text-tk-muted mt-1">
                  {price.plan === 'annual'
                    ? '12 tháng · 100 lượt Quét AI/tháng · Không tự gia hạn'
                    : '30 ngày · 100 lượt Quét AI/tháng · Không tự gia hạn'}
                </p>
              </button>
            );
          })}
        </div>

        {/* Honest Transparent Comparison Table */}
        <BentoCard tone="ceramic" padding="md" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-tk-jade">
                CAM KẾT MINH BẠCH TAKOLIO V4
              </p>
              <h3 className="font-heading font-extrabold text-base text-tk-ink mt-0.5">
                So sánh Gói Miễn phí &amp; Takolio Plus
              </h3>
            </div>
            <AtelierBadge tone="jade" icon={<HouseholdTrayIcon size={14} tone="jade" active />}>
              Tính năng bếp cốt lõi luôn miễn phí
            </AtelierBadge>
          </div>

          <div className="divide-y divide-tk-stone/70 rounded-2xl border border-tk-stone/80 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 bg-tk-sunken px-3.5 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-tk-secondary">
              <div className="col-span-6">Tính năng</div>
              <div className="col-span-3 text-center">Miễn phí</div>
              <div className="col-span-3 text-center text-tk-flame-deep">Takolio Plus</div>
            </div>
            {ENTITLEMENT_COMPARISON.map((row) => (
              <div
                key={row.feature}
                className={clsx(
                  'grid grid-cols-12 items-center gap-2 px-3.5 py-3 text-xs',
                  row.highlightPlus ? 'bg-tk-flame-soft/35' : 'bg-white',
                )}
              >
                <div className="col-span-6 font-semibold text-tk-ink pr-1 flex items-start gap-2">
                  {row.highlightPlus ? (
                    <NavScanApertureIcon size={16} tone="flame" active className="mt-0.5" />
                  ) : (
                    <Check className="w-4 h-4 text-tk-jade shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <span>{row.feature}</span>
                </div>
                <div className="col-span-3 text-center text-tk-secondary font-medium tk-tabular">
                  {row.freeTier}
                </div>
                <div
                  className={clsx(
                    'col-span-3 text-center font-extrabold tk-tabular',
                    row.highlightPlus ? 'text-tk-flame-deep' : 'text-tk-jade-deep',
                  )}
                >
                  {row.plusTier}
                </div>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-2.5 pt-1 text-xs text-tk-secondary">
            <div className="flex items-start gap-2 rounded-2xl bg-tk-sunken/60 p-3">
              <AiSousChefSparkIcon size={18} tone="jade" active className="mt-0.5" />
              <span>
                <strong>100 lượt Quét AI/tháng:</strong> Chụp tủ lạnh hoặc hóa đơn siêu thị thoải mái
                mỗi lần đi chợ cho cả gia đình.
              </span>
            </div>
            <div className="flex items-start gap-2 rounded-2xl bg-tk-sunken/60 p-3">
              <VietQRBadgeIcon size={18} tone="flame" active className="mt-0.5" />
              <span>
                <strong>Chuyển khoản VietQR an toàn:</strong> Thanh toán từng kỳ qua Napas 24/7, tuyệt
                đối không lưu thẻ hay tự trừ tiền ngầm.
              </span>
            </div>
          </div>
        </BentoCard>

        <div className="pt-1 space-y-2.5 pb-6">
          {recoverableCheckoutId && (
            <Button
              fullWidth
              size="lg"
              variant="secondary"
              disabled={isCreating || !accountReady}
              onClick={(event) => {
                checkoutTriggerRef.current = event.currentTarget;
                void handleResumeCheckout();
              }}
            >
              Mở lệnh thanh toán cũ
            </Button>
          )}
          <Button
            fullWidth
            size="lg"
            disabled={
              checkoutRecoveryPending ||
              hasOpenCheckout ||
              historyBlockingCheckout ||
              !accountReady ||
              !selectedPrice ||
              isCreating
            }
            onClick={(event) => {
              checkoutTriggerRef.current = event.currentTarget;
              void handleCreateIntent();
            }}
            className="flex items-center justify-center gap-2"
          >
            <span>
              {isCreating
                ? 'Đang tạo lệnh thanh toán…'
                : isPlus
                  ? 'Gia hạn hội viên'
                  : selectedPrice
                    ? `Nâng cấp ngay với ${formatPrice(selectedPrice)}`
                    : 'Đang tải bảng giá…'}
            </span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      {paymentIntent && paymentOwnerRef.current === `${userId}:${householdId}` && (
        <VietQRModal
          isOpen={isQRModalOpen}
          onClose={() => {
            setIsQRModalOpen(false);
            setAccountRefreshVersion((version) => version + 1);
          }}
          onSuccess={handlePaymentSuccess}
          intent={paymentIntent}
          recoverable={checkoutAdmissionEnabled}
          returnFocus={checkoutTriggerRef}
        />
      )}
    </div>
  );
};
