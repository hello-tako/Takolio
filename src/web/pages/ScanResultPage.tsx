import { KitchenHeader } from '../components/common/KitchenHeader';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useScanStore } from '../stores/useScanStore';
import { api } from '../services/api';
import { ReviewHeading, ReviewSummary } from '../components/scan/ReviewHeading';
import {
  REVIEW_UNITS,
  REVIEW_UNIT_LABELS_EN,
  ReviewFields,
  validReviewValues,
  validReviewQuantity,
} from '../components/scan/ReviewFields';
import { Button } from '../components/common/Button';
import { BottomSheet } from '../design-system/primitives';
import { getIngredientImage } from '../lib/ingredient-images';
import { Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { StandardUnit } from '@frigo/domain';
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
import {
  lSync,
  localizeIngredientName,
  localizeUnit,
  useLocaleText,
} from '../i18n/app-i18n';

const confidenceClass = {
  unknown: 'text-semantic-text-secondary bg-semantic-border/60',
  low: 'text-semantic-warning-strong bg-semantic-warning-soft',
  medium: 'text-semantic-warning-strong bg-semantic-warning-soft',
  high: 'text-semantic-text-primary bg-semantic-accent-soft',
};

export const ScanResultPage: React.FC = () => {
  const { id: paramScanId } = useParams<{ id: string }>();
  const scanId = useScanStore((state) => state.scanId);
  const targetScanId = paramScanId || scanId || '';
  return <ScanReview key={targetScanId} effectiveScanId={targetScanId} />;
};

const ScanReview: React.FC<{ effectiveScanId: string }> = ({ effectiveScanId }) => {
  const { l, locale } = useLocaleText();
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
  // A route change must hide the previous scan before hydration's first effect.
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
    effectiveScanId
      ? null
      : l(
          'Không tìm thấy bản quét. Vui lòng quay lại và quét ảnh mới.',
          'Scan not found. Please go back and scan a new photo.',
        ),
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
      // A queued confirmation must not become an editable ready draft after leaving review.
      if (pendingNotice && isCurrent() && useScanStore.getState().scanId === effectiveScanId)
        reset();
    };
  }, [pendingNotice, effectiveScanId, reset]);

  useEffect(() => {
    if (isConfirming || !restoreConfirmFocus.current) return;
    restoreConfirmFocus.current = false;
    // Native disabled buttons can drop focus during confirmation; never override a new focus target.
    if (document.activeElement === document.body) {
      confirmBarRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    }
  }, [isConfirming, isConfirmed]);

  useEffect(() => {
    // Snapshot counts at transitions, not on every edit to the review list.
    if (announcedStatus.current === scanStatus) return;
    announcedStatus.current = scanStatus;
    setLifecycleAnnouncement(
      scanStatus === 'ready'
        ? l(
            `Kết quả quét đã sẵn sàng. Có ${items.length} nguyên liệu cần kiểm tra.`,
            `Scan results are ready. ${items.length} ${items.length === 1 ? 'ingredient' : 'ingredients'} to review.`,
          )
        : scanStatus === 'confirmed'
          ? l(
              `Đã xác nhận ${acceptedCount} nguyên liệu.`,
              `Confirmed ${acceptedCount} ${acceptedCount === 1 ? 'ingredient' : 'ingredients'}.`,
            )
          : scanStatus === 'failed'
            ? l(
                `Bản quét không thể xử lý. ${loadError ?? pollError ?? 'Vui lòng thử lại.'}`,
                `Scan could not be processed. ${loadError ?? pollError ?? 'Please try again.'}`,
              )
            : '',
    );
  }, [scanStatus, items.length, acceptedCount, loadError, pollError, l]);

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
          setLoadError(
            lSync(
              'Dữ liệu trả về không khớp với bản quét đang mở. Vui lòng tải lại.',
              'Returned data does not match the open scan. Please reload.',
            ),
          );
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
        setPollError(
          lSync(
            'Không thể cập nhật trạng thái bản quét. Kiểm tra kết nối rồi thử lại.',
            'Could not refresh scan status. Check your connection and try again.',
          ),
        );
      }
      attempts += 1;
      if (active() && attempts < 45) {
        timer = window.setTimeout(poll, 2000);
      } else if (active()) {
        setPollError(
          lSync(
            'Bản quét đang xử lý lâu hơn dự kiến. Bạn có thể kiểm tra lại hoặc chọn ảnh mới.',
            'The scan is taking longer than expected. You can check again or pick a new photo.',
          ),
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
    )
      return;
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
          l(
            'Đã lưu yêu cầu trên thiết bị. Chờ đồng bộ khi có kết nối; chưa xác nhận được việc cập nhật tủ trên máy chủ.',
            'Saved on this device. Waiting to sync when back online; server fridge update is not confirmed yet.',
          ),
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
        l(
          'Chưa lưu được nguyên liệu. Vui lòng thử lại.',
          'Could not save ingredients. Please try again.',
        ),
      );
      if (presentation.refetch) {
        try {
          const scan = await api.getScan(effectiveScanId);
          if (!active()) return;
          if (scan.id !== effectiveScanId) throw new Error('Mismatched scan response');
          // Conflicts invalidate local edits; review authoritative evidence again.
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
            l(
              'Thông tin đã thay đổi nhưng chưa tải lại được. Vui lòng tải lại trước khi thử xác nhận.',
              'Details changed but could not be reloaded. Please reload before confirming again.',
            ),
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
    <div className="review-workspace">
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
              className="text-sm text-semantic-danger-strong"
            >
              {confirmError}
            </p>
          )}
          {loadError && (
            <p
              role={scanStatus === 'failed' ? undefined : 'alert'}
              className="text-sm text-semantic-danger-strong"
            >
              {loadError}
              {effectiveScanId && (
                <button
                  className="ml-2 underline tap-target"
                  onClick={() => {
                    setLoadError(null);
                    setScanStatus('pending');
                    setRetryIndex((value) => value + 1);
                  }}
                >
                  {l('Thử tải lại', 'Retry')}
                </button>
              )}
            </p>
          )}
          {/* Banner Alert */}
          {(scanStatus !== 'ready' || items.length === 0) && (
            <div
              className={
                scanStatus === 'failed'
                  ? 'bg-semantic-danger-soft border border-semantic-danger/30 rounded-xl p-3.5 flex items-start gap-3'
                  : 'bg-semantic-success-soft border border-semantic-border rounded-xl p-3.5 flex items-start gap-3'
              }
            >
              {scanStatus === 'failed' ? (
                <AlertCircle className="w-5 h-5 text-semantic-danger shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-semantic-action-primary shrink-0 mt-0.5" />
              )}
              <div className="text-xs">
                <p className="font-heading font-bold text-sm text-semantic-text-primary">
                  {isConfirmed
                    ? l(
                        `Đã xác nhận ${acceptedCount} nguyên liệu`,
                        `Confirmed ${acceptedCount} ${acceptedCount === 1 ? 'ingredient' : 'ingredients'}`,
                      )
                    : items.length > 0
                      ? l(
                          `${items.length} nguyên liệu cần kiểm tra`,
                          `${items.length} ${items.length === 1 ? 'ingredient' : 'ingredients'} to review`,
                        )
                      : scanStatus === 'failed'
                        ? l('Bản quét không thể xử lý', 'Scan could not be processed')
                        : scanStatus === 'ready'
                          ? l('Chưa có nguyên liệu trong danh sách', 'No ingredients in the list yet')
                          : l('Đang chờ AI hoàn tất bản quét', 'Waiting for AI to finish scanning')}
                </p>
                <p className="text-semantic-text-secondary mt-0.5">
                  {isConfirmed
                    ? l(
                        'Thông tin bản quét đã được lưu. Bạn có thể xem hoặc chỉnh sửa lô từ trang tủ lạnh.',
                        'Scan details have been saved. You can view or edit lots from your fridge page.',
                      )
                    : items.length > 0
                      ? l(
                          'Sửa tên, số lượng, đơn vị, nơi bảo quản, hạn dùng hoặc từ chối từng dòng trước khi lưu.',
                          'Edit names, quantities, units, storage, or expiry dates, or reject individual lines before saving.',
                        )
                      : scanStatus === 'failed'
                        ? l(
                            'Vui lòng quay lại và thử lại với ảnh khác.',
                            'Please go back and try again with another photo.',
                          )
                        : scanStatus === 'ready'
                          ? l(
                              'Bạn có thể thêm nguyên liệu thủ công trước khi xác nhận.',
                              'You can add ingredients manually before confirming.',
                            )
                          : l(
                              'Kết quả sẽ tự động xuất hiện khi xử lý xong.',
                              'Results will appear automatically once processing completes.',
                            )}
                </p>
              </div>
            </div>
          )}
          {pollError && (
            <div
              role={scanStatus === 'pending' ? 'alert' : undefined}
              className="rounded-xl border border-semantic-warning/30 bg-semantic-warning-soft px-3 py-2 text-xs text-semantic-warning-strong flex flex-wrap items-center justify-between gap-2 sm:gap-3"
            >
              <span>{pollError}</span>
              <div className="flex items-center gap-2 shrink-0">
                {scanStatus === 'pending' && (
                  <button
                    className="underline font-semibold"
                    onClick={() => {
                      setPollError(null);
                      setRetryIndex((value) => value + 1);
                    }}
                  >
                    {l('Kiểm tra lại', 'Check again')}
                  </button>
                )}
                {scanStatus === 'failed' && (
                  <button
                    className="underline font-semibold"
                    onClick={() => {
                      reset();
                      navigate('/scan');
                    }}
                  >
                    {l('Quét ảnh mới', 'Scan new photo')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Detected Items List */}
          <p className="text-xs text-semantic-text-secondary">
            {l(
              'Bản quét tủ lạnh bổ sung số lượng vào nguyên liệu phù hợp đã có; không đổi nơi bảo quản hay hạn dùng của lô cũ.',
              'Fridge scans add quantity to matching existing items without overwriting the storage location or expiry of older lots.',
            )}
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
              const displayName = item.rawName
                ? localizeIngredientName(item.canonicalId, item.rawName, locale)
                : item.rawName;
              return (
                <article
                  key={item.id}
                  data-scan-item-id={item.id}
                  aria-label={l(`Nguyên liệu ${index + 1}`, `Ingredient ${index + 1}`)}
                  data-rejected={Boolean(item.rejected)}
                  className="review-card"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={getIngredientImage(item.canonicalId ?? undefined, item.rawName)}
                      alt=""
                      className="w-10 h-10 object-contain shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="font-heading font-semibold text-sm text-semantic-text-primary break-words">
                        {displayName}
                      </h2>
                      {manual ? (
                        <span className="text-xs text-semantic-text-secondary">
                          {l('Nhập thủ công', 'Manual entry')}
                        </span>
                      ) : (
                        <span
                          className={`inline-block text-xs px-1.5 py-0.5 rounded font-semibold ${confidenceClass[confidence.tone]}`}
                        >
                          {confidence.label}
                        </span>
                      )}
                      {!manual && (
                        <p
                          className="text-xs text-semantic-text-secondary mt-1 break-words"
                          data-raw-evidence
                        >
                          {l('AI đọc:', 'AI detected:')}{' '}
                          {raw
                            ? `${
                                locale === 'vi'
                                  ? (raw.rawName ?? 'Không rõ tên')
                                  : raw.rawName
                                    ? localizeIngredientName(item.canonicalId, raw.rawName, locale)
                                    : 'Unknown name'
                              } · ${raw.estimatedQuantity ?? l('Không rõ số lượng', 'Unknown qty')} ${
                                raw.unit ? localizeUnit(raw.unit, locale) : l('Không rõ đơn vị', 'Unknown unit')
                              }`
                            : l('Không có dữ liệu gốc', 'No raw evidence')}
                        </p>
                      )}
                      {corrected && (
                        <p className="text-xs text-semantic-warning-strong mt-1">
                          {l('Đã chỉnh sửa so với dữ liệu gốc', 'Edited from original AI detection')}
                        </p>
                      )}
                      {item.rejected && (
                        <p className="text-xs font-semibold text-semantic-danger-strong mt-1">
                          {l('Đã từ chối · Không thêm vào tủ lạnh', 'Rejected · Will not be added to fridge')}
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
                      className="p-2 rounded-lg text-semantic-danger-strong hover:bg-semantic-danger-soft tap-target shrink-0 text-xs font-semibold"
                      aria-label={
                        persisted
                          ? item.rejected
                            ? l('Khôi phục dòng này', 'Restore this item')
                            : l('Từ chối dòng này', 'Reject this item')
                          : l('Xóa dòng thủ công', 'Remove manual item')
                      }
                    >
                      {persisted ? (
                        item.rejected ? (
                          l('Khôi phục', 'Restore')
                        ) : (
                          l('Từ chối', 'Reject')
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
                    aria-label={l('Thông tin hạn dùng', 'Expiry information')}
                    disabled={!canEdit || Boolean(item.rejected)}
                    className="review-expiry"
                  >
                    <div className="col-span-2">
                      <p className="text-sm text-semantic-text-secondary" data-expiry-state>
                        {isConfirmed
                          ? // A confirmed line reports the review the server recorded
                            // (T13R-A P2-B): the accepted date, its estimate basis, or
                            // an explicit "no expiry accepted" — never a fresh guess.
                            item.rejected
                            ? l('Đã bỏ qua: không có hạn dùng', 'Skipped: no expiry recorded')
                            : !item.expiryDate
                              ? l('Đã xác nhận không rõ hạn dùng', 'Confirmed with unknown expiry')
                              : item.expiryEstimated
                                ? l('Hạn dùng ước tính đã xác nhận', 'Confirmed estimated expiry')
                                : l('Ngày do bạn xác nhận', 'Confirmed expiry date')
                          : !item.expiryDate
                            ? l('Chưa rõ hạn dùng', 'Expiry unknown')
                            : item.expiryEstimated
                              ? l('Hạn dùng ước tính', 'Estimated expiry')
                              : l('Ngày do bạn xác nhận', 'Date confirmed by you')}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {[3, 7].map((days) => (
                          <button
                            key={days}
                            type="button"
                            className="text-xs px-2 py-1.5 rounded-lg border border-semantic-border tap-target"
                            onClick={() => handleEstimateExpiry(item.id, days)}
                          >
                            {l(`Ước tính ${days} ngày`, `Est. ${days} days`)}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="text-xs px-2 py-1.5 rounded-lg border border-semantic-border tap-target"
                          onClick={() =>
                            updateItem(item.id, { expiryDate: undefined, expiryEstimated: false })
                          }
                        >
                          {l('Không rõ hạn dùng', 'Unknown expiry')}
                        </button>
                      </div>
                    </div>
                  </fieldset>
                </article>
              );
            })}
          </form>

          {/* Add Missing Item Button */}
          {!isConfirmed && (
            <Button
              variant="outline"
              fullWidth
              size="md"
              disabled={!canEdit}
              onClick={() => setIsManualAddOpen(true)}
              className="flex items-center justify-center gap-1.5 text-xs"
            >
              <Plus className="w-4 h-4 text-semantic-action-primary" aria-hidden="true" />
              <span>{l('Thêm nguyên liệu AI còn thiếu', 'Add item missed by AI')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation remains in document flow; short viewports do not pin it over fields. */}
      <div className="review-actions" data-kitchen-action="fixed">
        <div ref={confirmBarRef} className="review-actions-inner">
          {pendingNotice && <p role="status">{pendingNotice}</p>}
          {isConfirmed || pendingNotice ? (
            <Button fullWidth size="lg" onClick={() => navigate('/fridge')}>
              {l('Xem tủ lạnh', 'View fridge')}
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
              <span>
                {l(
                  `Xác nhận nguyên liệu (${acceptedCount} món)`,
                  `Confirm ingredients (${acceptedCount})`,
                )}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Manual add sheet (components/BOTTOM_SHEET.md): labelled modal with
          focus trap, Escape and focus return. */}
      <BottomSheet
        open={isManualAddOpen && canEdit}
        title={l('Thêm nguyên liệu thủ công', 'Add ingredient manually')}
        onClose={() => setIsManualAddOpen(false)}
      >
        <form onSubmit={handleAddManualItem} className="space-y-3.5">
          <div>
            <label
              htmlFor="scan-add-name"
              className="block text-xs font-semibold text-semantic-text-secondary mb-1.5"
            >
              {l('Tên nguyên liệu', 'Ingredient name')}
            </label>
            <input
              id="scan-add-name"
              type="text"
              required
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder={l('Ví dụ: Nấm hương, Hành lá...', 'e.g. Shiitake mushrooms, Scallions...')}
              className="review-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="scan-add-quantity"
                className="block text-xs font-semibold text-semantic-text-secondary mb-1.5"
              >
                {l('Số lượng', 'Quantity')}
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
                className="review-input"
              />
            </div>

            <div>
              <label
                htmlFor="scan-add-unit"
                className="block text-xs font-semibold text-semantic-text-secondary mb-1.5"
              >
                {l('Đơn vị', 'Unit')}
              </label>
              <select
                id="scan-add-unit"
                value={addUnit}
                onChange={(e) => setAddUnit(e.target.value as StandardUnit)}
                className="review-input"
              >
                {REVIEW_UNITS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {locale === 'vi' ? label : REVIEW_UNIT_LABELS_EN[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <Button fullWidth size="md" type="submit">
              {l('Thêm vào danh sách', 'Add to list')}
            </Button>
          </div>
        </form>
      </BottomSheet>
    </div>
    </>
  );
};
