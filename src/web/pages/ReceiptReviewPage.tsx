import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ShoppingBag,
  Trash2,
  Store,
  Calendar,
  CalendarCheck,
  AlertCircle,
  Plus,
} from 'lucide-react';
import type { StandardUnit } from '@frigo/domain';
import { clsx } from 'clsx';
import { KitchenHeader } from '../components/common/KitchenHeader';
import { ReviewHeading, ReviewSummary } from '../components/scan/ReviewHeading';
import {
  REVIEW_UNITS,
  ReviewFields,
  validReviewQuantity as validQuantity,
  validReviewExpiry as validExpiry,
} from '../components/scan/ReviewFields';
import { Button } from '../components/common/Button';
import { BottomSheet } from '../design-system/primitives';
import { AtelierBadge } from '../design-system/v4/AtelierPrimitives';
import { ReceiptScanIcon } from '../design-system/icons';
import { api } from '../services/api';
import { useWeekStore } from '../stores/useWeekStore';
import { isMealPlannerEnabled } from '../features/planner/feature';
import { getIngredientImage } from '../lib/ingredient-images';
import { capturePrivateSession } from '../lib/private-session';
import { invalidateInventoryDependents } from '../lib/query-invalidation';
import {
  presentConfidence,
  presentDomainError,
  presentPrice,
  presentPurchaseDate,
  presentRefetchOutcome,
} from '../lib/inventory-truth';
import { ApiError } from '../services/http';
import { ReviewSource } from '../components/scan/ReviewSource';
import { ScanProcessingState } from '../components/scan/ScanProcessingState';
import { scanErrorMessage } from '../lib/scan-errors';

interface ReceiptItemState {
  id: string;
  isManual?: boolean;
  rawName: string;
  canonicalId?: string | null;
  estimatedQuantity: number | '';
  unit: StandardUnit;
  unitPriceVnd?: number;
  totalPriceVnd?: number;
  category?: string;
  storage: 'fridge' | 'freezer' | 'pantry';
  confidence?: number | null;
  rawEvidence?: {
    rawName?: string | null;
    estimatedQuantity?: number | null;
    unit?: StandardUnit | null;
  };
  rejected?: boolean;
  reviewState?: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  expiryDate?: string;
  expiryEstimated?: boolean;
  expiryKind?: 'KNOWN' | 'ESTIMATED' | 'UNKNOWN';
}

interface ReceiptState {
  id: string;
  status: 'pending' | 'processing' | 'ready' | 'confirmed' | 'failed';
  items: ReceiptItemState[];
  merchantName?: string;
  purchaseDate?: string;
  invoiceNumber?: string;
  totalAmountVnd?: number;
  errorCode?: string;
  supportId?: string;
  errorMessage?: string;
}

const MISMATCH_MESSAGE =
  'Dữ liệu trả về không khớp với hóa đơn đang mở nên không được hiển thị. Vui lòng tải lại.';

class ReceiptOwnershipError extends Error {
  constructor() {
    super('Receipt response does not belong to this route');
    this.name = 'ReceiptOwnershipError';
  }
}

/** The only acceptable receipt for this route is the one whose id equals the route's scanId. */
function ownsReceipt(receiptScanId: string, receipt: { id?: unknown } | null | undefined): boolean {
  return Boolean(receipt) && typeof receipt!.id === 'string' && receipt!.id === receiptScanId;
}

function reviewedItems(receipt: ReceiptState): ReceiptItemState[] {
  return receipt.items.map((item) => ({
    ...item,
    rejected: item.reviewState === 'REJECTED' || item.rejected === true,
  }));
}

export const ReceiptReviewPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const receiptScanId = searchParams.get('scanId');
  return <ReceiptReview key={receiptScanId || ''} receiptScanId={receiptScanId} />;
};

const ReceiptReview: React.FC<{ receiptScanId: string | null }> = ({ receiptScanId }) => {
  const navigate = useNavigate();
  const currentPlan = useWeekStore((s) => s.currentPlan);
  const plannerEnabled = isMealPlannerEnabled();
  const isOfflineReceipt = Boolean(receiptScanId?.startsWith('receipt_offline_'));

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [liveReceipt, setLiveReceipt] = useState<ReceiptState>({
    id: receiptScanId || '',
    status: !receiptScanId ? 'failed' : isOfflineReceipt ? 'ready' : 'pending',
    items: [],
  });
  const [pollError, setPollError] = useState<string | null>(
    receiptScanId ? null : 'Không tìm thấy bản quét hóa đơn. Vui lòng quay lại và quét ảnh mới.',
  );
  const [retryIndex, setRetryIndex] = useState(0);
  const [items, setItems] = useState<ReceiptItemState[]>([]);

  // Manual item sheet state (fixes dead-end offline / empty OCR receipt bug!)
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState(1);
  const [manualUnit, setManualUnit] = useState<StandardUnit>('piece');
  const [manualStorage, setManualStorage] = useState<'fridge' | 'freezer' | 'pantry'>('fridge');

  const isPending = liveReceipt.status === 'pending' || liveReceipt.status === 'processing';
  const isReady = liveReceipt.status === 'ready';
  const isConfirmed = liveReceipt.status === 'confirmed';

  useEffect(() => {
    // Offline receipt drafts have no server scan row to poll; they start ready for manual entry.
    if (!receiptScanId || isOfflineReceipt) return;
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const isCurrent = capturePrivateSession();
    setPollError(null);
    setLiveReceipt((previous) => ({ ...previous, status: 'pending' }));
    const poll = async () => {
      try {
        const next: ReceiptState = await api.getScan(receiptScanId);
        if (cancelled || !isCurrent()) return;
        if (!ownsReceipt(receiptScanId, next)) {
          setLiveReceipt({ id: receiptScanId, status: 'failed', items: [] });
          setItems([]);
          setPollError(MISMATCH_MESSAGE);
          return;
        }
        setPollError(null);
        setLiveReceipt(next);
        setItems(reviewedItems(next));
        if (next.status === 'pending' || next.status === 'processing') {
          attempts += 1;
          if (attempts < 90) timer = window.setTimeout(poll, 1000);
          else {
            setPollError(
              'Hóa đơn đang xử lý lâu hơn dự kiến. Bạn có thể kiểm tra lại hoặc chọn ảnh mới.',
            );
          }
        } else if (next.status === 'failed') {
          setPollError(scanErrorMessage(next.errorCode, 'receipt', { requestId: next.supportId }));
        }
      } catch {
        if (cancelled || !isCurrent()) return;
        setPollError('Không thể cập nhật trạng thái hóa đơn. Kiểm tra kết nối rồi thử lại.');
        attempts += 1;
        if (attempts < 90) {
          timer = window.setTimeout(poll, 1000);
        } else {
          setPollError(
            'Không thể cập nhật hóa đơn trong thời gian cho phép. Bạn có thể kiểm tra lại hoặc chọn ảnh mới.',
          );
        }
      }
    };
    timer = window.setTimeout(poll, 500);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [receiptScanId, isOfflineReceipt, retryIndex]);

  const acceptedItems = items.filter((it) => !it.rejected);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const invalidItems = acceptedItems.some(
    (item) =>
      !item.rawName.trim() ||
      !validQuantity(item.estimatedQuantity) ||
      !validExpiry(item.expiryDate),
  );
  const canEdit = isReady && !isSubmitting && !isConfirmed;
  const canSubmit = isReady && items.length > 0 && !invalidItems && !isSubmitting;

  const updateItem = (id: string, changes: Partial<ReceiptItemState>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  };

  const removeManualItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id || !item.isManual));
  };

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !validQuantity(manualQty) || !canEdit) return;
    const newItem: ReceiptItemState = {
      id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      isManual: true,
      rawName: manualName.trim(),
      estimatedQuantity: Number(manualQty),
      unit: manualUnit,
      storage: manualStorage,
      rejected: false,
    };
    setItems((prev) => [...prev, newItem]);
    setManualName('');
    setManualQty(1);
    setManualUnit('piece');
    setManualStorage('fridge');
    setIsManualAddOpen(false);
  };

  const resolveSecondaryDestination = () => {
    if (plannerEnabled) {
      return '/planner';
    }
    return currentPlan ? `/week/${currentPlan.id}/shopping` : '/fridge';
  };

  const handleConfirm = async (openPlannerShortcut = false) => {
    if (!canSubmit) return;
    const isCurrent = capturePrivateSession();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const confirmation = items.map((item) =>
        item.rejected
          ? { id: item.id, rejected: true }
          : {
              id: item.id,
              rawName: item.rawName.trim(),
              estimatedQuantity: item.estimatedQuantity,
              unit: item.unit,
              canonicalId: item.canonicalId,
              category: item.category,
              storage: item.storage,
              expiryDate: item.expiryDate || undefined,
              expiryEstimated: Boolean(item.expiryDate && item.expiryEstimated),
              rejected: false,
            },
      );
      if (!receiptScanId || !ownsReceipt(receiptScanId, liveReceipt)) {
        throw new ReceiptOwnershipError();
      }
      const result = await api.confirmScan(receiptScanId, confirmation);
      if (!mounted.current || !isCurrent()) return;
      void invalidateInventoryDependents();
      setSuccessToast(
        result?.pendingSync
          ? 'Đã lưu yêu cầu, đang chờ đồng bộ khi có kết nối.'
          : acceptedItems.length > 0
            ? 'Đã nhập nguyên liệu hóa đơn vào tủ lạnh thành công!'
            : 'Đã lưu các dòng bỏ qua.',
      );
      setTimeout(() => {
        if (mounted.current && isCurrent()) {
          navigate(openPlannerShortcut ? resolveSecondaryDestination() : '/fridge');
        }
      }, 1200);
    } catch (err) {
      if (!mounted.current || !isCurrent()) return;
      if (err instanceof ReceiptOwnershipError) {
        setSubmitError(MISMATCH_MESSAGE);
        setIsSubmitting(false);
        return;
      }
      const code = err instanceof ApiError ? err.code : null;
      const presentation = presentDomainError(code, 'Chưa lưu được hóa đơn. Vui lòng thử lại.');
      if (presentation.refetch && !isOfflineReceipt) {
        try {
          const next: ReceiptState = await api.getScan(receiptScanId as string);
          if (!mounted.current || !isCurrent()) return;
          if (!ownsReceipt(receiptScanId as string, next)) {
            setLiveReceipt({ id: receiptScanId as string, status: 'failed', items: [] });
            setItems([]);
            setSubmitError(MISMATCH_MESSAGE);
            setIsSubmitting(false);
            return;
          }
          setLiveReceipt(next);
          setItems(reviewedItems(next));
        } catch {
          if (!mounted.current || !isCurrent()) return;
          setSubmitError(
            'Thông tin đã thay đổi nhưng chưa tải lại được. Vui lòng tải lại trang trước khi thử lại.',
          );
          setIsSubmitting(false);
          return;
        }
      }
      setSubmitError(
        presentRefetchOutcome(presentation, presentation.refetch ? true : null).message,
      );
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <KitchenHeader />
      <div className="review-workspace bg-tk-canvas">
        <ReviewHeading receipt confirmed={isConfirmed} />

        {/* Success Toast */}
        {successToast && (
          <div className="fixed top-16 left-4 right-4 z-50 bg-tk-sanctuary text-white px-4 py-3.5 rounded-2xl shadow-elevated flex items-center gap-3 animate-fade-in max-w-md mx-auto border border-white/15">
            <CheckCircle2 className="w-5 h-5 text-tk-jade-mint shrink-0" />
            <p role="status" className="text-sm font-bold leading-relaxed">
              {successToast}
            </p>
          </div>
        )}

        <div className="review-layout">
          <aside className="review-sidebar">
            <ReviewSummary
              total={items.length}
              accepted={acceptedItems.length}
              confirmed={isConfirmed}
            />
            <ReviewSource scanId={receiptScanId ?? ''} verified={isReady || isConfirmed} />
          </aside>

          <div className="review-main">
            {isPending && (
              <ScanProcessingState
                stage={liveReceipt.status === 'processing' ? 'analyzing' : 'queued'}
                kind="receipt"
                compact
              />
            )}

            {isPending && !pollError && (
              <div className="rounded-2xl border border-tk-turmeric/30 bg-tk-turmeric-soft px-4 py-3 text-xs font-semibold text-tk-turmeric-deep">
                Hóa đơn đang được AI xử lý nền. Trang sẽ tự cập nhật khi hoàn tất...
              </div>
            )}

            {isOfflineReceipt && isReady && (
              <div className="rounded-2xl border border-tk-turmeric/35 bg-tk-turmeric-soft px-4 py-3 text-xs font-semibold text-tk-turmeric-deep">
                Đang ở chế độ bản nháp hóa đơn ngoại tuyến. Hãy bấm “+ Thêm mặt hàng thủ công” bên
                dưới để ghi nhận thực phẩm và lưu vào tủ lạnh.
              </div>
            )}

            {pollError && (
              <div
                role="alert"
                className="rounded-2xl border border-tk-berry/30 bg-tk-berry-soft px-4 py-3 text-xs font-semibold text-tk-berry-deep flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pollError}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isPending && (
                    <button
                      type="button"
                      className="underline font-extrabold cursor-pointer"
                      onClick={() => {
                        setPollError(null);
                        setRetryIndex((value) => value + 1);
                      }}
                    >
                      Thử tải lại
                    </button>
                  )}
                  {!isPending && !isReady && pollError === MISMATCH_MESSAGE && (
                    <button
                      type="button"
                      className="underline font-extrabold cursor-pointer"
                      onClick={() => setRetryIndex((value) => value + 1)}
                    >
                      Thử tải lại
                    </button>
                  )}
                  {!isPending && !isReady && (
                    <button
                      type="button"
                      className="underline font-extrabold cursor-pointer"
                      onClick={() => navigate('/scan')}
                    >
                      Quét ảnh mới
                    </button>
                  )}
                </div>
              </div>
            )}

            {isConfirmed && (
              <p
                role="status"
                className="rounded-2xl border border-tk-jade/25 bg-tk-jade-soft p-3.5 text-xs font-semibold text-tk-jade-deep"
              >
                Hóa đơn đã được xác nhận. Thông tin dưới đây đã lưu; sửa lô trong tủ lạnh nếu cần.
              </p>
            )}

            {/* Receipt Header Card */}
            <div className="rounded-[24px] p-5 bg-white border border-tk-stone/85 shadow-card space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-tk-jade-soft border border-tk-jade/20 flex items-center justify-center text-tk-jade shrink-0">
                    <Store className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-heading font-extrabold text-sm text-tk-ink truncate">
                      {liveReceipt.merchantName || 'Không rõ cửa hàng'}
                    </h3>
                    <p className="text-xs text-tk-muted flex items-center gap-1 mt-0.5 tk-tabular">
                      <Calendar className="w-3 h-3 text-tk-muted shrink-0" />
                      <span>{presentPurchaseDate(liveReceipt.purchaseDate)}</span>
                      {liveReceipt.invoiceNumber && <span>• {liveReceipt.invoiceNumber}</span>}
                    </p>
                  </div>
                </div>
                <AtelierBadge
                  tone="jade"
                  icon={<ReceiptScanIcon size={13} tone="jade" active />}
                  className="shrink-0"
                >
                  AI OCR
                </AtelierBadge>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-tk-stone/75">
                <span className="text-xs font-semibold text-tk-muted">Tổng hóa đơn (OCR):</span>
                <span
                  data-testid="receipt-total"
                  className="font-heading font-extrabold text-lg text-tk-ink tk-tabular"
                >
                  {presentPrice(liveReceipt.totalAmountVnd)}
                </span>
              </div>
            </div>

            {/* Extracted Items Count */}
            <div className="flex items-center justify-between px-1">
              <h4 className="font-heading font-extrabold text-sm text-tk-ink">
                Các dòng nguyên liệu ({items.length} món)
              </h4>
              <span className="text-xs font-semibold text-tk-muted">Kiểm tra từng dòng</span>
            </div>

            {/* Items List */}
            <div className="space-y-3">
              {items.map((item) => {
                const manual = item.isManual === true;
                const confidence = presentConfidence(item.confidence);
                const raw = item.rawEvidence;
                const corrected =
                  (raw?.rawName != null && raw.rawName !== item.rawName) ||
                  (raw?.estimatedQuantity != null &&
                    raw.estimatedQuantity !== item.estimatedQuantity) ||
                  (raw?.unit != null && raw.unit !== item.unit);
                const disabled = item.rejected || !isReady || isSubmitting;

                return (
                  <div
                    key={item.id}
                    data-testid="receipt-line"
                    data-rejected={Boolean(item.rejected)}
                    className="review-card !rounded-[22px] !border-tk-stone/85 shadow-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-1 items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-tk-sunken border border-tk-stone/75 p-1.5 shrink-0 flex items-center justify-center">
                          <img
                            src={getIngredientImage(item.canonicalId ?? undefined, item.rawName)}
                            alt=""
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="font-heading font-extrabold text-tk-ink break-words">
                            {item.rawName || 'Chưa có tên'}
                          </h2>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {manual ? (
                              <span className="text-xs font-bold text-tk-jade bg-tk-jade-soft px-2 py-0.5 rounded-full">
                                Nhập thủ công
                              </span>
                            ) : (
                              <>
                                <span
                                  className="text-xs font-extrabold text-tk-jade tk-tabular"
                                  data-testid="receipt-price"
                                >
                                  Thành tiền OCR: {presentPrice(item.totalPriceVnd)}
                                </span>
                                <span
                                  data-testid="receipt-confidence"
                                  className={clsx(
                                    'text-xs px-2 py-0.5 rounded-full font-bold border',
                                    confidence.tone === 'unknown'
                                      ? 'bg-tk-sunken text-tk-secondary border-tk-stone'
                                      : confidence.tone === 'low'
                                        ? 'bg-tk-berry-soft text-tk-berry-deep border-tk-berry/30'
                                        : confidence.tone === 'medium'
                                          ? 'bg-tk-turmeric-soft text-tk-turmeric-deep border-tk-turmeric/30'
                                          : 'bg-tk-jade-soft text-tk-jade-deep border-tk-jade/25',
                                  )}
                                >
                                  {confidence.label}
                                </span>
                              </>
                            )}
                          </div>
                          {!item.canonicalId && (
                            <p className="text-xs font-semibold text-tk-turmeric-deep mt-1">
                              {manual
                                ? 'Chưa liên kết nguyên liệu chuẩn'
                                : 'Chưa nhận diện nguyên liệu chuẩn'}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {manual ? (
                          <button
                            type="button"
                            onClick={() => removeManualItem(item.id)}
                            disabled={!canEdit}
                            aria-label={`Xóa ${item.rawName}`}
                            className="p-2 text-tk-berry-deep hover:bg-tk-berry-soft rounded-xl transition-colors tap-target flex items-center gap-1 text-xs font-extrabold cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Xóa</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, { rejected: !item.rejected })}
                            disabled={!isReady || isSubmitting}
                            aria-label={
                              item.rejected ? `Khôi phục ${item.rawName}` : `Bỏ qua ${item.rawName}`
                            }
                            aria-pressed={Boolean(item.rejected)}
                            className="p-2 text-tk-muted hover:text-tk-berry-deep hover:bg-tk-berry-soft rounded-xl transition-colors tap-target flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-xs font-bold">
                              {item.rejected ? 'Khôi phục' : 'Bỏ qua'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    <ReviewFields
                      prefix={`receipt-${item.id}`}
                      item={item}
                      disabled={Boolean(disabled)}
                      receipt
                      onChange={(changes) => updateItem(item.id, changes)}
                    />

                    {!isConfirmed ? (
                      <div className="review-expiry !border-tk-stone/75 text-tk-secondary space-y-1">
                        <p data-testid="receipt-expiry-status">
                          {item.expiryDate
                            ? item.expiryEstimated
                              ? 'Hạn dùng ước tính'
                              : 'Hạn dùng do bạn cung cấp'
                            : 'Chưa cung cấp hạn dùng. Hệ thống có thể gợi ý hạn dùng ước tính.'}
                        </p>
                        {item.expiryDate && (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              updateItem(item.id, { expiryDate: undefined, expiryEstimated: false })
                            }
                            className="underline font-bold tap-target cursor-pointer"
                          >
                            Không rõ hạn dùng
                          </button>
                        )}
                      </div>
                    ) : (
                      <p
                        className="review-expiry !border-tk-stone/75 text-tk-secondary"
                        data-testid="receipt-expiry-status"
                      >
                        {item.rejected
                          ? 'Đã bỏ qua: không có hạn dùng.'
                          : item.expiryDate
                            ? item.expiryEstimated
                              ? 'Hạn dùng ước tính đã xác nhận.'
                              : 'Hạn dùng do bạn cung cấp.'
                            : item.reviewState === 'CONFIRMED' && item.expiryKind === 'UNKNOWN'
                              ? 'Đã xác nhận không rõ hạn dùng.'
                              : 'Hạn dùng đã lưu: xem chi tiết lô trong tủ lạnh.'}
                      </p>
                    )}

                    {!manual && item.unitPriceVnd != null && (
                      <p className="text-sm text-tk-muted mt-1 tk-tabular">
                        Đơn giá OCR: {presentPrice(item.unitPriceVnd)}
                      </p>
                    )}

                    <details className="text-xs text-tk-secondary break-words mt-1">
                      <summary className="cursor-pointer py-1 font-bold text-tk-ink">
                        {manual
                          ? 'Xem giá trị nhập thủ công đã xác nhận'
                          : `Xem OCR gốc và giá trị xác nhận${corrected ? ' · Đã chỉnh sửa' : ''}`}
                      </summary>
                      {!manual && (
                        <p data-testid="receipt-raw-evidence" className="mt-1">
                          OCR gốc: {raw?.rawName ?? 'Chưa rõ tên'} ·{' '}
                          {raw?.estimatedQuantity ?? 'Chưa rõ số lượng'} ·{' '}
                          {raw?.unit ?? 'Chưa rõ đơn vị'}
                        </p>
                      )}
                      <p data-testid="receipt-confirmed-evidence" className="mt-1">
                        {item.rejected ? 'Đã bỏ qua' : isConfirmed ? 'Đã xác nhận' : 'Bạn xác nhận'}
                        : {item.rawName || 'Chưa có tên'} · {item.estimatedQuantity} · {item.unit}
                      </p>
                    </details>

                    {item.rejected && (
                      <div className="text-sm mt-1">
                        <span className="text-xs font-extrabold text-tk-berry-deep">
                          Đã bỏ qua khỏi tủ lạnh
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {items.length === 0 && !isPending && !pollError && (
                <div className="text-center py-8 bg-white rounded-[22px] p-6 border border-tk-stone/85 shadow-xs">
                  <p className="text-sm font-semibold text-tk-secondary">
                    Không còn món nào trong hóa đơn
                  </p>
                  <p className="text-xs text-tk-muted mt-1">
                    Bạn có thể thêm mặt hàng thủ công bên dưới để tiếp tục lưu vào tủ lạnh.
                  </p>
                </div>
              )}
            </div>

            {/* + Thêm mặt hàng thủ công Button (fixes offline / empty OCR dead-end!) */}
            {!isConfirmed && (
              <Button
                variant="outline"
                fullWidth
                size="md"
                disabled={!canEdit}
                data-testid="receipt-add-manual-btn"
                onClick={() => setIsManualAddOpen(true)}
                className="flex items-center justify-center gap-1.5 text-xs font-extrabold"
              >
                <Plus className="w-4 h-4 text-tk-jade" aria-hidden="true" />
                <span>+ Thêm mặt hàng thủ công</span>
              </Button>
            )}
          </div>
        </div>

        {/* Sticky Confirmation & Post-Import Navigation Bar */}
        <div className="review-actions !bg-white/95 backdrop-blur-md !border-tk-stone/85">
          <div className="review-actions-inner">
            {submitError && (
              <p role="alert" className="text-xs font-semibold text-tk-berry-deep">
                {submitError}
              </p>
            )}
            {isConfirmed ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button fullWidth onClick={() => navigate('/fridge')}>
                  Xem tủ lạnh
                </Button>
                {plannerEnabled && (
                  <Button
                    fullWidth
                    variant="outline"
                    onClick={() => navigate('/planner')}
                  >
                    Mở Thực đơn
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Button
                  fullWidth
                  size="lg"
                  disabled={!canSubmit}
                  onClick={() => void handleConfirm(false)}
                  className="flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Đang lưu…'
                      : acceptedItems.length === 0 && items.length > 0
                        ? `Lưu ${items.length} dòng bỏ qua`
                        : `Nhập ${acceptedItems.length} món vào Tủ lạnh`}
                  </span>
                </Button>

                {plannerEnabled ? (
                  <Button
                    fullWidth
                    variant="outline"
                    size="md"
                    disabled={!canSubmit}
                    onClick={() => void handleConfirm(true)}
                    className="flex items-center justify-center gap-2 text-tk-ink"
                  >
                    <CalendarCheck className="w-4 h-4 text-tk-jade" />
                    <span>Lưu hóa đơn &amp; mở Thực đơn</span>
                  </Button>
                ) : (
                  currentPlan && (
                    <Button
                      fullWidth
                      variant="outline"
                      size="md"
                      disabled={!canSubmit}
                      onClick={() => void handleConfirm(true)}
                      className="flex items-center justify-center gap-2 text-tk-ink"
                    >
                      <CalendarCheck className="w-4 h-4 text-tk-jade" />
                      <span>Lưu hóa đơn &amp; mở danh sách tuần</span>
                    </Button>
                  )
                )}
              </>
            )}
          </div>
        </div>

        {/* Manual Receipt Line Item BottomSheet */}
        <BottomSheet
          open={isManualAddOpen && canEdit}
          title="Thêm mặt hàng thủ công vào hóa đơn"
          onClose={() => setIsManualAddOpen(false)}
        >
          <form onSubmit={handleAddManualItem} className="space-y-3.5">
            <div>
              <label
                htmlFor="receipt-add-name"
                className="block text-xs font-bold text-tk-secondary mb-1.5"
              >
                Tên mặt hàng
              </label>
              <input
                id="receipt-add-name"
                type="text"
                required
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Ví dụ: Sữa tươi không đường, Trứng gà, Cải thìa…"
                className="review-input !rounded-xl !border-tk-stone"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="receipt-add-quantity"
                  className="block text-xs font-bold text-tk-secondary mb-1.5"
                >
                  Số lượng
                </label>
                <input
                  id="receipt-add-quantity"
                  type="number"
                  min="0.001"
                  max="10000"
                  step="any"
                  required
                  value={manualQty}
                  onChange={(e) => setManualQty(Number(e.target.value))}
                  className="review-input !rounded-xl !border-tk-stone tk-tabular"
                />
              </div>

              <div>
                <label
                  htmlFor="receipt-add-unit"
                  className="block text-xs font-bold text-tk-secondary mb-1.5"
                >
                  Đơn vị
                </label>
                <select
                  id="receipt-add-unit"
                  value={manualUnit}
                  onChange={(e) => setManualUnit(e.target.value as StandardUnit)}
                  className="review-input !rounded-xl !border-tk-stone"
                >
                  {REVIEW_UNITS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="receipt-add-storage"
                className="block text-xs font-bold text-tk-secondary mb-1.5"
              >
                Nơi bảo quản
              </label>
              <select
                id="receipt-add-storage"
                value={manualStorage}
                onChange={(e) =>
                  setManualStorage(e.target.value as 'fridge' | 'freezer' | 'pantry')
                }
                className="review-input !rounded-xl !border-tk-stone"
              >
                <option value="fridge">Ngăn mát</option>
                <option value="freezer">Ngăn đông</option>
                <option value="pantry">Kệ bếp</option>
              </select>
            </div>

            <div className="pt-2">
              <Button fullWidth size="md" type="submit">
                Thêm vào hóa đơn
              </Button>
            </div>
          </form>
        </BottomSheet>
      </div>
    </>
  );
};
