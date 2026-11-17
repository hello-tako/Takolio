import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { StandardUnit } from '@frigo/domain';
import { KitchenHeader } from '../components/common/KitchenHeader';
import { useScanStore } from '../stores/useScanStore';
import { api } from '../services/api';
import { ReviewHeading, ReviewSummary } from '../components/scan/ReviewHeading';
import {
  REVIEW_UNITS,
  ReviewFields,
  validReviewValues,
  validReviewQuantity,
} from '../components/scan/ReviewFields';
import { Button } from '../components/common/Button';
import { BottomSheet } from '../design-system/primitives';
import { getIngredientImage } from '../lib/ingredient-images';
import { capturePrivateSession } from '../lib/private-session';
import { invalidateInventoryDependents } from '../lib/query-invalidation';
import {
  presentConfidence,
  presentDomainError,
  presentRefetchOutcome,
} from '../lib/inventory-truth';
import { ApiError } from '../services/http';
import { scanErrorMessage } from '../lib/scan-errors';
import { ReviewSource } from '../components/scan/ReviewSource';
import { ScanProcessingState } from '../components/scan/ScanProcessingState';

const confidenceClass = {
  unknown: 'text-tk-secondary bg-tk-sunken border-tk-stone',
  low: 'text-tk-turmeric-deep bg-tk-turmeric-soft border-tk-turmeric/30',
  medium: 'text-tk-turmeric-deep bg-tk-turmeric-soft border-tk-turmeric/30',
  high: 'text-tk-jade-deep bg-tk-jade-soft border-tk-jade/25',
};

export const ScanResultPage: React.FC = () => {
  const { id: paramScanId } = useParams<{ id: string }>();
  const scanId = useScanStore((state) => state.scanId);
  const targetScanId = paramScanId || scanId || '';
  return <ScanReview key={targetScanId} effectiveScanId={targetScanId} />;
};

const ScanReview: React.FC<{ effectiveScanId: string }> = ({ effectiveScanId }) => {
  const navigate = useNavigate();
  const {
    scanId,
    reviewStatus,
    items: storedItems,
    updateItem,
    addItem,
    removeItem,
    reset,
  } = useScanStore();

  const matchesScan = scanId === effectiveScanId;
  const items = matchesScan ? storedItems : [];
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [isConfirming, setIsConfirming] = useState(false);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const confirmBarRef = useRef<HTMLDivElement>(null);
  const restoreConfirmFocus = useRef(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [addUnit, setAddUnit] = useState<StandardUnit>('piece');
  const [pollError, setPollError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'pending' | 'ready' | 'confirmed' | 'failed'>(
    !effectiveScanId
      ? 'failed'
      : matchesScan && reviewStatus
        ? reviewStatus
        : items.length > 0 || (matchesScan && effectiveScanId.startsWith('scan_offline_'))
          ? 'ready'
          : 'pending',
  );
  const [loadError, setLoadError] = useState<string | null>(
    effectiveScanId ? null : 'Không tìm thấy bản quét. Vui lòng quay lại và quét ảnh mới.',
  );
  const [retryIndex, setRetryIndex] = useState(0);
  const canEdit = matchesScan && scanStatus === 'ready' && !isConfirming && !pendingNotice;
  const isConfirmed = matchesScan && scanStatus === 'confirmed';
  const acceptedCount = items.filter((item) => !item.rejected).length;
  const invalidItems = items.some((item) => !item.rejected && !validReviewValues(item));
  const [pendingStage, setPendingStage] = useState<'queued' | 'analyzing'>('queued');
  const announcedStatus = useRef<string | null>(null);
  const [lifecycleAnnouncement, setLifecycleAnnouncement] = useState('');

  useEffect(() => {
    const isCurrent = capturePrivateSession();
    return () => {
      if (pendingNotice && isCurrent() && useScanStore.getState().scanId === effectiveScanId) {
        reset();
      }
    };
  }, [pendingNotice, effectiveScanId, reset]);

  useEffect(() => {
    if (isConfirming || !restoreConfirmFocus.current) return;
    restoreConfirmFocus.current = false;
    if (document.activeElement === document.body) {
      confirmBarRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    }
  }, [isConfirming, isConfirmed]);

  useEffect(() => {
    if (announcedStatus.current === scanStatus) return;
    announcedStatus.current = scanStatus;
    setLifecycleAnnouncement(
      scanStatus === 'ready'
        ? `Kết quả quét đã sẵn sàng. Có ${items.length} nguyên liệu cần kiểm tra.`
        : scanStatus === 'confirmed'
          ? `Đã xác nhận ${acceptedCount} nguyên liệu.`
          : scanStatus === 'failed'
            ? `Bản quét không thể xử lý. ${loadError ?? pollError ?? 'Vui lòng thử lại.'}`
            : '',
    );
  }, [scanStatus, items.length, acceptedCount, loadError, pollError]);

  useEffect(() => {
    if (!effectiveScanId || scanStatus !== 'pending') return;
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const isCurrent = capturePrivateSession();
    const active = () => !cancelled && isCurrent();
    const poll = async () => {
      if (!active()) return;
      try {
        const scan = await api.getScan(effectiveScanId);
        if (!active()) return;
        if (scan.id !== effectiveScanId) {
          setScanStatus('failed');
          setLoadError('Dữ liệu trả về không khớp với bản quét đang mở. Vui lòng tải lại.');
          return;
        }
        setPollError(null);
        setPendingStage(scan.status === 'processing' ? 'analyzing' : 'queued');
        if (scan.status === 'ready' || scan.status === 'confirmed') {
          setScanStatus(scan.status);
          if (!active()) return;
          useScanStore.getState().setScanResults(effectiveScanId, scan.items || [], scan.status);
          return;
        }
        if (scan.status === 'failed') {
          setScanStatus('failed');
          setPollError(scanErrorMessage(scan.errorCode, 'fridge', { requestId: scan.supportId }));
          return;
        }
      } catch {
        if (!active()) return;
        setPollError('Không thể cập nhật trạng thái bản quét. Kiểm tra kết nối rồi thử lại.');
      }
      attempts += 1;
      if (active() && attempts < 45) {
        timer = window.setTimeout(poll, 2000);
      } else if (active()) {
        setPollError(
          'Bản quét đang xử lý lâu hơn dự kiến. Bạn có thể kiểm tra lại hoặc chọn ảnh mới.',
        );
      }
    };
    timer = window.setTimeout(poll, 500);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [effectiveScanId, scanStatus, retryIndex]);

  const handleEstimateExpiry = (id: string, days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const expiryDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    updateItem(id, { expiryDate, expiryEstimated: true });
  };

  const handleConfirm = async () => {
    if (
      items.length === 0 ||
      invalidItems ||
      !canEdit ||
      useScanStore.getState().scanId !== effectiveScanId
    ) {
      return;
    }
    const isCurrent = capturePrivateSession();
    const active = () =>
      mounted.current && isCurrent() && useScanStore.getState().scanId === effectiveScanId;
    if (!active()) return;
    setConfirmError(null);
    restoreConfirmFocus.current = confirmBarRef.current?.contains(document.activeElement) ?? false;
    setIsConfirming(true);
    try {
      const confirmation = items.map((item) =>
        item.rejected ? { id: item.id, rejected: true } : item,
      );
      const result = await api.confirmScan(effectiveScanId, confirmation);
      if (!active()) return;
      void invalidateInventoryDependents();
      if (!active()) return;
      if (result?.pendingSync) {
        setPendingNotice(
          'Đã lưu yêu cầu trên thiết bị. Chờ đồng bộ khi có kết nối; chưa xác nhận được việc cập nhật tủ trên máy chủ.',
        );
        setIsConfirming(false);
        return;
      }
      reset();
      navigate('/fridge');
    } catch (error) {
      if (!active()) return;
      const presentation = presentDomainError(
        error instanceof ApiError ? error.code : null,
        'Chưa lưu được nguyên liệu. Vui lòng thử lại.',
      );
      if (presentation.refetch) {
        try {
          const scan = await api.getScan(effectiveScanId);
          if (!active()) return;
          if (scan.id !== effectiveScanId) throw new Error('Mismatched scan response');
          setScanStatus(
            scan.status === 'ready' || scan.status === 'confirmed' ? scan.status : 'failed',
          );
          if (!active()) return;
          useScanStore
            .getState()
            .setScanResults(
              effectiveScanId,
              scan.items || [],
              scan.status === 'ready' || scan.status === 'confirmed' ? scan.status : null,
            );
          if (!active()) return;
          void invalidateInventoryDependents();
        } catch {
          if (!active()) return;
          setScanStatus('failed');
          if (!active()) return;
          setLoadError(
            'Thông tin đã thay đổi nhưng chưa tải lại được. Vui lòng tải lại trước khi thử xác nhận.',
          );
          if (!active()) return;
          setIsConfirming(false);
          return;
        }
      }
      if (!active()) return;
      setConfirmError(
        presentRefetchOutcome(presentation, presentation.refetch ? true : null).message,
      );
      if (!active()) return;
      setIsConfirming(false);
    }
  };

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !validReviewQuantity(addQty) || !canEdit) return;
    addItem({
      rawName: addName.trim(),
      estimatedQuantity: Number(addQty),
      unit: addUnit,
      storage: 'fridge',
    });
    setAddName('');
    setAddQty(1);
    setIsManualAddOpen(false);
  };

  return (
    <>
      <KitchenHeader />
      <div className="review-workspace bg-tk-canvas">
        <ReviewHeading confirmed={isConfirmed} />
        <div className="review-layout">
          <aside className="review-sidebar">
            <ReviewSummary total={items.length} accepted={acceptedCount} confirmed={isConfirmed} />
            <ReviewSource
              scanId={effectiveScanId}
              verified={matchesScan && (scanStatus === 'ready' || isConfirmed)}
            />
          </aside>

          <div className="review-main">
            {scanStatus === 'pending' && (
              <ScanProcessingState stage={pendingStage} kind="fridge" compact />
            )}

            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
              data-testid="scan-lifecycle-status"
            >
              {lifecycleAnnouncement}
            </p>

            {confirmError && (
              <p
                role={isConfirmed ? undefined : 'alert'}
                className="rounded-2xl border border-tk-berry/30 bg-tk-berry-soft px-4 py-3 text-sm font-semibold text-tk-berry-deep"
              >
                {confirmError}
              </p>
            )}

            {loadError && (
              <p
                role={scanStatus === 'failed' ? undefined : 'alert'}
                className="rounded-2xl border border-tk-berry/30 bg-tk-berry-soft px-4 py-3 text-sm font-semibold text-tk-berry-deep"
              >
                {loadError}
                {effectiveScanId && (
                  <button
                    type="button"
                    className="ml-2 underline font-extrabold tap-target cursor-pointer"
                    onClick={() => {
                      setLoadError(null);
                      setScanStatus('pending');
                      setRetryIndex((value) => value + 1);
                    }}
                  >
                    Thử tải lại
                  </button>
                )}
              </p>
            )}

            {(scanStatus !== 'ready' || items.length === 0) && (
              <div
                className={
                  scanStatus === 'failed'
                    ? 'rounded-2xl border border-tk-berry/30 bg-tk-berry-soft p-4 flex items-start gap-3'
                    : 'rounded-2xl border border-tk-jade/25 bg-tk-jade-soft p-4 flex items-start gap-3'
                }
              >
                {scanStatus === 'failed' ? (
                  <AlertCircle className="w-5 h-5 text-tk-berry shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-tk-jade shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <p className="font-heading font-extrabold text-sm text-tk-ink">
                    {isConfirmed
                      ? `Đã xác nhận ${acceptedCount} nguyên liệu`
                      : items.length > 0
                        ? `${items.length} nguyên liệu cần kiểm tra`
                        : scanStatus === 'failed'
                          ? 'Bản quét không thể xử lý'
                          : scanStatus === 'ready'
                            ? 'Chưa có nguyên liệu trong danh sách'
                            : 'Đang chờ AI hoàn tất bản quét'}
                  </p>
                  <p className="text-tk-secondary mt-0.5">
                    {isConfirmed
                      ? 'Thông tin bản quét đã được lưu. Bạn có thể xem hoặc chỉnh sửa lô từ trang tủ lạnh.'
                      : items.length > 0
                        ? 'Sửa tên, số lượng, đơn vị, nơi bảo quản, hạn dùng hoặc từ chối từng dòng trước khi lưu.'
                        : scanStatus === 'failed'
                          ? 'Vui lòng quay lại và thử lại với ảnh khác.'
                          : scanStatus === 'ready'
                            ? 'Bạn có thể thêm nguyên liệu thủ công trước khi xác nhận.'
                            : 'Kết quả sẽ tự động xuất hiện khi xử lý xong.'}
                  </p>
                </div>
              </div>
            )}

            {pollError && (
              <div
                role={scanStatus === 'pending' ? 'alert' : undefined}
                className="rounded-2xl border border-tk-turmeric/35 bg-tk-turmeric-soft px-4 py-3 text-xs text-tk-turmeric-deep flex items-center justify-between gap-3"
              >
                <span className="font-semibold">{pollError}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {scanStatus === 'pending' && (
                    <button
                      type="button"
                      className="underline font-extrabold cursor-pointer"
                      onClick={() => {
                        setPollError(null);
                        setRetryIndex((value) => value + 1);
                      }}
                    >
                      Kiểm tra lại
                    </button>
                  )}
                  {scanStatus === 'failed' && (
                    <button
                      type="button"
                      className="underline font-extrabold cursor-pointer"
                      onClick={() => {
                        reset();
                        navigate('/scan');
                      }}
                    >
                      Quét ảnh mới
                    </button>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-tk-secondary">
              Bản quét tủ lạnh bổ sung số lượng vào nguyên liệu phù hợp đã có; không đổi nơi bảo
              quản hay hạn dùng của lô cũ.
            </p>

            <form
              id="scan-review"
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleConfirm();
              }}
            >
              {items.map((item, index) => {
                const confidence = presentConfidence(item.confidence);
                const persisted = item.sourceItemId !== undefined;
                const manual = item.isManual === true || !persisted;
                const raw = item.rawEvidence;
                const corrected =
                  raw &&
                  ((raw.rawName != null && raw.rawName !== item.rawName) ||
                    (raw.estimatedQuantity != null &&
                      raw.estimatedQuantity !== item.estimatedQuantity) ||
                    (raw.unit != null && raw.unit !== item.unit));

                return (
                  <article
                    key={item.id}
                    data-scan-item-id={item.id}
                    aria-label={`Nguyên liệu ${index + 1}`}
                    data-rejected={Boolean(item.rejected)}
                    className="review-card !rounded-[22px] !border-tk-stone/85 shadow-card"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={getIngredientImage(item.canonicalId ?? undefined, item.rawName)}
                        alt=""
                        className="w-11 h-11 rounded-xl bg-tk-sunken p-1.5 object-contain shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h2 className="font-heading font-extrabold text-sm text-tk-ink break-words">
                          {item.rawName}
                        </h2>
                        {/* IMPORTANT: keep confidence <span> as the first <span> inside <article> */}
                        {manual ? (
                          <span className="text-xs font-semibold text-tk-secondary">
                            Nhập thủ công
                          </span>
                        ) : (
                          <span
                            className={`inline-block text-xs px-2 py-0.5 rounded-full border font-bold ${confidenceClass[confidence.tone]}`}
                          >
                            {confidence.label}
                          </span>
                        )}
                        {!manual && (
                          <p
                            className="text-xs text-tk-secondary mt-1 break-words"
                            data-raw-evidence
                          >
                            AI đọc:{' '}
                            {raw
                              ? `${raw.rawName ?? 'Không rõ tên'} · ${raw.estimatedQuantity ?? 'Không rõ số lượng'} ${raw.unit ?? 'Không rõ đơn vị'}`
                              : 'Không có dữ liệu gốc'}
                          </p>
                        )}
                        {corrected && (
                          <p className="text-xs font-semibold text-tk-turmeric-deep mt-1">
                            Đã chỉnh sửa so với dữ liệu gốc
                          </p>
                        )}
                        {item.rejected && (
                          <p className="text-xs font-extrabold text-tk-berry-deep mt-1">
                            Đã từ chối · Không thêm vào tủ lạnh
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          persisted
                            ? updateItem(item.id, { rejected: !item.rejected })
                            : removeItem(item.id)
                        }
                        aria-pressed={persisted ? Boolean(item.rejected) : undefined}
                        className="p-2 rounded-xl text-tk-berry-deep hover:bg-tk-berry-soft tap-target shrink-0 text-xs font-extrabold cursor-pointer"
                        aria-label={
                          persisted
                            ? item.rejected
                              ? 'Khôi phục dòng này'
                              : 'Từ chối dòng này'
                            : 'Xóa dòng thủ công'
                        }
                      >
                        {persisted ? (
                          item.rejected ? (
                            'Khôi phục'
                          ) : (
                            'Từ chối'
                          )
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <ReviewFields
                      prefix={`scan-${item.id}`}
                      item={item}
                      disabled={!canEdit || Boolean(item.rejected)}
                      onChange={(changes) => updateItem(item.id, changes)}
                    />

                    <fieldset
                      aria-label="Thông tin hạn dùng"
                      disabled={!canEdit || Boolean(item.rejected)}
                      className="review-expiry !border-tk-stone/75"
                    >
                      <div className="col-span-2">
                        <p className="text-sm font-medium text-tk-secondary" data-expiry-state>
                          {isConfirmed
                            ? item.rejected
                              ? 'Đã bỏ qua: không có hạn dùng'
                              : !item.expiryDate
                                ? 'Đã xác nhận không rõ hạn dùng'
                                : item.expiryEstimated
                                  ? 'Hạn dùng ước tính đã xác nhận'
                                  : 'Ngày do bạn xác nhận'
                            : !item.expiryDate
                              ? 'Chưa rõ hạn dùng'
                              : item.expiryEstimated
                                ? 'Hạn dùng ước tính'
                                : 'Ngày do bạn xác nhận'}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {[3, 7].map((days) => (
                            <button
                              key={days}
                              type="button"
                              className="text-xs font-bold px-2.5 py-1.5 rounded-xl border border-tk-stone bg-tk-canvas hover:bg-tk-sunken tap-target cursor-pointer"
                              onClick={() => handleEstimateExpiry(item.id, days)}
                            >
                              Ước tính {days} ngày
                            </button>
                          ))}
                          <button
                            type="button"
                            className="text-xs font-bold px-2.5 py-1.5 rounded-xl border border-tk-stone bg-tk-canvas hover:bg-tk-sunken tap-target cursor-pointer"
                            onClick={() =>
                              updateItem(item.id, { expiryDate: undefined, expiryEstimated: false })
                            }
                          >
                            Không rõ hạn dùng
                          </button>
                        </div>
                      </div>
                    </fieldset>
                  </article>
                );
              })}
            </form>

            {!isConfirmed && (
              <Button
                variant="outline"
                fullWidth
                size="md"
                disabled={!canEdit}
                onClick={() => setIsManualAddOpen(true)}
                className="flex items-center justify-center gap-1.5 text-xs font-extrabold"
              >
                <Plus className="w-4 h-4 text-tk-jade" aria-hidden="true" />
                <span>Thêm nguyên liệu AI còn thiếu</span>
              </Button>
            )}
          </div>
        </div>

        <div className="review-actions !bg-white/95 backdrop-blur-md !border-tk-stone/85">
          <div ref={confirmBarRef} className="review-actions-inner">
            {pendingNotice && (
              <p role="status" className="font-semibold text-tk-secondary">
                {pendingNotice}
              </p>
            )}
            {isConfirmed || pendingNotice ? (
              <Button fullWidth size="lg" onClick={() => navigate('/fridge')}>
                Xem tủ lạnh
              </Button>
            ) : (
              <Button
                fullWidth
                size="lg"
                type="submit"
                form="scan-review"
                isLoading={isConfirming}
                disabled={items.length === 0 || invalidItems || !canEdit}
                className="flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Xác nhận nguyên liệu ({acceptedCount} món)</span>
              </Button>
            )}
          </div>
        </div>

        <BottomSheet
          open={isManualAddOpen && canEdit}
          title="Thêm nguyên liệu thủ công"
          onClose={() => setIsManualAddOpen(false)}
        >
          <form onSubmit={handleAddManualItem} className="space-y-3.5">
            <div>
              <label
                htmlFor="scan-add-name"
                className="block text-xs font-bold text-tk-secondary mb-1.5"
              >
                Tên nguyên liệu
              </label>
              <input
                id="scan-add-name"
                type="text"
                required
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Ví dụ: Nấm hương, Hành lá..."
                className="review-input !rounded-xl !border-tk-stone"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="scan-add-quantity"
                  className="block text-xs font-bold text-tk-secondary mb-1.5"
                >
                  Số lượng
                </label>
                <input
                  id="scan-add-quantity"
                  type="number"
                  min="0.001"
                  max="10000"
                  step="any"
                  required
                  value={addQty}
                  onChange={(e) => setAddQty(Number(e.target.value))}
                  className="review-input !rounded-xl !border-tk-stone tk-tabular"
                />
              </div>

              <div>
                <label
                  htmlFor="scan-add-unit"
                  className="block text-xs font-bold text-tk-secondary mb-1.5"
                >
                  Đơn vị
                </label>
                <select
                  id="scan-add-unit"
                  value={addUnit}
                  onChange={(e) => setAddUnit(e.target.value as StandardUnit)}
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

            <div className="pt-2">
              <Button fullWidth size="md" type="submit">
                Thêm vào danh sách
              </Button>
            </div>
          </form>
        </BottomSheet>
      </div>
    </>
  );
};
