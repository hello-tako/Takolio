import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, RotateCcw, X } from 'lucide-react';
import type {
  ReviewShoppingDemandInput,
  ShoppingUnknownDemand,
} from '../../../packages/domain/src/shopping-plan-api';
import { Button } from '../components/common/Button';
import { InlineError } from '../components/common/AsyncState';
import { useModalFocus } from '../design-system/use-modal-focus';
import {
  shoppingApi,
  type ShoppingItem,
  type ShoppingSnapshot,
  type ShoppingUnresolvedItem,
} from '../services/shopping';
import { ApiError, createClientItemId } from '../services/http';
import { SHOPPING_UNITS, shoppingQuantity } from '../lib/shopping-form';
import { capturePrivateSession, onPrivateSessionReset } from '../lib/private-session';

type ReviewAction = ReviewShoppingDemandInput['action'];
type PurchaseUnit = Extract<ReviewShoppingDemandInput, { action: 'purchase' }>['unit'];
type ReviewAttempt = {
  demand: ShoppingUnknownDemand;
  input: ReviewShoppingDemandInput;
  requestKey: string;
};

function reviewable(item: ShoppingUnresolvedItem): item is ShoppingUnknownDemand {
  return (
    typeof item.sourceId === 'string' &&
    typeof item.demandKey === 'string' &&
    typeof item.snapshot === 'string' &&
    /^[a-f0-9]{64}$/.test(item.snapshot) &&
    typeof item.reviewRevision === 'number' &&
    Number.isInteger(item.reviewRevision) &&
    typeof item.reviewState === 'string' &&
    typeof item.purchaseItemId !== 'undefined'
  );
}
function actionLabel(action: ReviewAction) {
  return action === 'purchase'
    ? 'lượng vừa gửi'
    : action === 'skip'
      ? 'bỏ qua vừa gửi'
      : 'mở lại vừa gửi';
}
function mealLabel(mealType: string) {
  return mealType === 'breakfast' ? 'Sáng' : mealType === 'lunch' ? 'Trưa' : 'Tối';
}
function reviewErrorMessage(failure: unknown) {
  if (failure instanceof ApiError && failure.code === 'SHOPPING_PENDING_SYNC')
    return 'Danh sách đang chờ đồng bộ. Chờ đồng bộ xong rồi tải lại để chọn lượng.';
  if (failure instanceof ApiError && failure.status === 409)
    return 'Danh sách vừa thay đổi. Tải lại để xem lượng và nguồn món mới nhất, rồi chọn lại.';
  if (failure instanceof ApiError && failure.kind === 'auth')
    return 'Phiên làm việc hoặc quyền truy cập đã thay đổi. Tải lại danh sách trước khi tiếp tục.';
  if (failure instanceof ApiError && failure.kind === 'offline')
    return 'Chưa xác nhận được thao tác do mất kết nối. Giữ nguyên thao tác và thử lại khi có mạng.';
  if (failure instanceof ApiError && (failure.status === 422 || failure.status === 404))
    return 'Nguyên liệu hoặc dữ liệu đi chợ không còn phù hợp. Tải lại danh sách trước khi chọn tiếp.';
  return 'Chưa xác nhận được thao tác. Thử lại đúng thao tác vừa gửi để tránh thay đổi trùng.';
}

export function ShoppingDemandReview({
  demands,
  items,
  source,
  hasPendingChanges = false,
  listBusy = false,
  onChanged,
  onBusyChange,
}: {
  demands: readonly ShoppingUnresolvedItem[];
  items: readonly ShoppingItem[];
  source: ShoppingSnapshot['source'];
  hasPendingChanges?: boolean;
  listBusy?: boolean;
  onChanged: () => Promise<unknown>;
  onBusyChange: (busy: boolean) => void;
}) {
  const [purchaseDemand, setPurchaseDemand] = useState<ShoppingUnknownDemand | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<PurchaseUnit>('g');
  const [invalid, setInvalid] = useState(false);
  const [attempt, setAttempt] = useState<ReviewAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [requiresReload, setRequiresReload] = useState(false);
  const [receipt, setReceipt] = useState('');
  const alive = useRef(true);
  const dialog = useRef<HTMLDivElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const dialogHeading = useRef<HTMLHeadingElement>(null);
  const errorFocus = useRef<HTMLDivElement>(null);
  const receiptFocus = useRef<HTMLParagraphElement>(null);
  const serverReady = source === 'server' && !hasPendingChanges && !listBusy;
  const pending = demands.filter((item) => !item.reviewState || item.reviewState === 'pending');
  const purchased = demands.filter((item) => item.reviewState === 'purchased').filter(reviewable);
  const skipped = demands.filter((item) => item.reviewState === 'skipped').filter(reviewable);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const controlsDisabled = !serverReady || busy || !!attempt || requiresReload;

  useModalFocus(
    !!purchaseDemand,
    dialog,
    () => {
      if (!busy) setPurchaseDemand(null);
    },
    dialogHeading,
  );
  useEffect(() => {
    onBusyChange(busy || !!attempt || requiresReload || !!purchaseDemand);
  }, [busy, attempt, requiresReload, purchaseDemand, onBusyChange]);
  useEffect(() => {
    if (receipt && !busy) receiptFocus.current?.focus();
  }, [receipt, busy]);
  useEffect(() => {
    if (!error) return;
    errorFocus.current?.focus();
  }, [error, purchaseDemand]);
  useEffect(() => {
    alive.current = true;
    const reset = onPrivateSessionReset(() => {
      setPurchaseDemand(null);
      setAttempt(null);
      setError(null);
      setReceipt('');
      setBusy(false);
      setRequiresReload(false);
    });
    return () => {
      alive.current = false;
      reset();
      onBusyChange(false);
    };
  }, [onBusyChange]);
  useEffect(() => {
    if (!attempt && !purchaseDemand) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [attempt, purchaseDemand]);

  function sourceList(demand: ShoppingUnresolvedItem) {
    const sourceLinksEnabled = !busy && !attempt && !requiresReload;
    const count = new Set(demand.contributions.map((source) => `${source.planId}:${source.slotId}`))
      .size;
    if (!demand.contributions.length) return null;
    return (
      <details className="shopping-source-details shopping-demand-sources">
        <summary>Xem {count} bữa liên quan</summary>
        <ul>
          {demand.contributions.map((source, index) => (
            <li key={`${source.slotId}:${source.componentId}:${index}`}>
              <span>
                {source.date} · {mealLabel(source.mealType)} ·{' '}
                {source.recipeId && sourceLinksEnabled ? (
                  <Link
                    to={`/recipes/id/${encodeURIComponent(source.recipeId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.title}
                  </Link>
                ) : (
                  source.title
                )}
              </span>
              <span>
                {source.quantity === null
                  ? 'Lượng món này chưa rõ'
                  : shoppingQuantity(source.quantity, source.unit)}
              </span>
            </li>
          ))}
        </ul>
      </details>
    );
  }

  async function reloadAfterReview() {
    const isCurrent = capturePrivateSession();
    setBusy(true);
    try {
      await onChanged();
      if (!alive.current || !isCurrent()) return;
      if (attempt && !requiresReload) return;
      setAttempt(null);
      setError(null);
      setRequiresReload(false);
      setPurchaseDemand(null);
    } catch {
      if (!alive.current || !isCurrent()) return;
      setError(new Error('reload'));
      if (!attempt) setRequiresReload(true);
    } finally {
      if (alive.current && isCurrent()) setBusy(false);
    }
  }

  async function send(
    input: ReviewShoppingDemandInput,
    demand: ShoppingUnknownDemand,
    requestKey?: string,
  ) {
    if (!serverReady || busy || requiresReload) return;
    const isCurrent = capturePrivateSession();
    const nextAttempt = {
      demand,
      input,
      requestKey: requestKey ?? createClientItemId('shopping_review'),
    };
    setBusy(true);
    setError(null);
    setReceipt('');
    setAttempt(nextAttempt);
    try {
      await shoppingApi.reviewShoppingDemand(input, nextAttempt.requestKey);
    } catch (failure) {
      if (!alive.current || !isCurrent()) return;
      setBusy(false);
      setError(failure);
      if (
        failure instanceof ApiError &&
        (failure.status === 409 ||
          failure.status === 404 ||
          failure.status === 422 ||
          failure.kind === 'auth')
      ) {
        setAttempt(null);
        setRequiresReload(true);
      } else if (failure instanceof ApiError && failure.status === 400) {
        setAttempt(null);
      }
      // Uncertain delivery retains this exact payload/key until its receipt is confirmed.
      return;
    }
    if (!alive.current || !isCurrent()) return;
    setAttempt(null);
    setPurchaseDemand(null);
    setReceipt(
      input.action === 'purchase'
        ? 'Đã ghi lượng bạn chọn. Tổng lượng theo thực đơn vẫn chưa xác định.'
        : input.action === 'skip'
          ? 'Đã bỏ qua việc chọn lượng trong lượt đi chợ này.'
          : 'Đã mở lại nguyên liệu để bạn chọn lượng.',
    );
    try {
      await onChanged();
    } catch {
      if (!alive.current || !isCurrent()) return;
      setError(new Error('reload'));
      setRequiresReload(true);
    } finally {
      if (alive.current && isCurrent()) setBusy(false);
    }
  }

  function openPurchase(demand: ShoppingUnknownDemand) {
    if (controlsDisabled) return;
    setPurchaseDemand(demand);
    setQuantity('');
    setUnit(
      SHOPPING_UNITS.some((entry) => entry.value === demand.unit)
        ? (demand.unit as PurchaseUnit)
        : 'g',
    );
    setInvalid(false);
    setError(null);
    setReceipt('');
  }
  function reviewAction(demand: ShoppingUnknownDemand, action: 'skip' | 'reopen') {
    if (controlsDisabled) return;
    void send(
      {
        sourceId: demand.sourceId,
        demandKey: demand.demandKey,
        snapshot: demand.snapshot,
        reviewRevision: demand.reviewRevision,
        action,
      },
      demand,
    );
  }
  function submitPurchase(event: React.FormEvent) {
    event.preventDefault();
    if (!purchaseDemand || !serverReady || busy || requiresReload) return;
    if (attempt) {
      void send(attempt.input, attempt.demand, attempt.requestKey);
      return;
    }
    const amount = quantity.trim() ? Number(quantity) : NaN;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
      setInvalid(true);
      amountInput.current?.focus();
      return;
    }
    setInvalid(false);
    void send(
      {
        sourceId: purchaseDemand.sourceId,
        demandKey: purchaseDemand.demandKey,
        snapshot: purchaseDemand.snapshot,
        reviewRevision: purchaseDemand.reviewRevision,
        action: 'purchase',
        quantity: amount,
        unit,
      },
      purchaseDemand,
    );
  }

  const disabledReason =
    source === 'device'
      ? 'Bản lưu trên thiết bị vẫn giúp bạn xem món. Kết nối mạng và tải lại để chọn lượng hoặc bỏ qua.'
      : hasPendingChanges
        ? 'Có thay đổi đang chờ đồng bộ. Chờ đồng bộ xong rồi tải lại để rà lượng.'
        : '';
  const errorMessage =
    error instanceof Error && error.message === 'reload'
      ? receipt
        ? 'Thao tác đã được lưu, nhưng chưa tải lại được danh sách. Tải lại trước khi chọn tiếp.'
        : 'Chưa tải lại được danh sách. Kết nối lại rồi thử tải lại.'
      : reviewErrorMessage(error);
  function recovery() {
    if (!error) return null;
    return (
      <div ref={errorFocus} tabIndex={-1} className="shopping-demand-error">
        <InlineError message={errorMessage} />
        {requiresReload ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void reloadAfterReview()}
          >
            Tải lại danh sách
          </Button>
        ) : (
          attempt &&
          !purchaseDemand && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || !serverReady}
              onClick={() => void send(attempt.input, attempt.demand, attempt.requestKey)}
            >
              Thử lại {actionLabel(attempt.input.action)}
            </Button>
          )
        )}
      </div>
    );
  }

  if (!demands.length && !attempt && !receipt && !error) return null;
  return (
    <div className="shopping-demand-review">
      {disabledReason && (
        <div className="shopping-demand-review-notice">
          <p role="status">{disabledReason}</p>
          <Button
            variant="outline"
            type="button"
            disabled={busy}
            onClick={() => void reloadAfterReview()}
          >
            Tải lại danh sách
          </Button>
        </div>
      )}
      {pending.length > 0 && (
        <section className="shopping-unresolved" aria-labelledby="shopping-demand-pending-title">
          <p className="planning-eyebrow">CẦN QUYẾT ĐỊNH</p>
          <h3 id="shopping-demand-pending-title">Chưa rõ lượng mua · {pending.length}</h3>
          <p>
            Chọn lượng bạn định mua hoặc tạm bỏ qua lần này. Gói, bó hay cái là đơn vị mua bạn chọn;
            tổng lượng theo thực đơn vẫn chưa xác định.
          </p>
          <ul className="shopping-demand-list">
            {pending.map((demand, index) => {
              const bound = reviewable(demand);
              const prior = demand.purchaseItemId ? itemById.get(demand.purchaseItemId) : undefined;
              return (
                <li
                  key={`${demand.sourceId ?? index}:${demand.demandKey ?? demand.ingredientId}`}
                  className="shopping-demand-card"
                >
                  <div className="shopping-demand-card-copy">
                    <strong>{demand.name}</strong>
                    <span className="shopping-row-quantity">Tổng lượng chưa xác định</span>
                    {prior && (
                      <p className="shopping-demand-prior">
                        Đang giữ dòng {shoppingQuantity(prior.quantity, prior.unit)}
                        {prior.isChecked ? ' đã mua' : ' bạn đã chọn'}. Tạm bỏ qua chỉ xóa dòng chưa
                        mua; lịch sử đã mua được giữ.
                      </p>
                    )}
                    {!bound && (
                      <p className="shopping-demand-prior">
                        Tải lại để có bản dữ liệu mới trước khi chọn lượng.
                      </p>
                    )}
                    {sourceList(demand)}
                  </div>
                  <div className="shopping-demand-actions">
                    <Button
                      type="button"
                      size="sm"
                      disabled={controlsDisabled || !bound}
                      onClick={() => {
                        if (bound) openPurchase(demand);
                      }}
                    >
                      Chọn lượng mua
                    </Button>
                    <button
                      type="button"
                      className="shopping-demand-skip"
                      disabled={controlsDisabled || !bound}
                      onClick={() => {
                        if (bound) reviewAction(demand, 'skip');
                      }}
                    >
                      Tạm bỏ qua
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {purchased.length > 0 && (
        <details className="shopping-demand-chosen">
          <summary>Đã chọn lượng mua · {purchased.length} nguyên liệu</summary>
          <p>
            Lượng bạn chọn nằm trong danh sách mua. Tổng lượng theo thực đơn vẫn chưa xác định; bạn
            có thể mở lại để rà khi cần.
          </p>
          <ul className="shopping-demand-list">
            {purchased.map((demand) => {
              const item = demand.purchaseItemId ? itemById.get(demand.purchaseItemId) : undefined;
              return (
                <li
                  key={`${demand.sourceId}:${demand.demandKey}`}
                  className="shopping-demand-card is-reviewed"
                >
                  <div className="shopping-demand-card-copy">
                    <strong>{demand.name}</strong>
                    <span className="shopping-row-quantity">
                      {item
                        ? `Lượng bạn chọn: ${shoppingQuantity(item.quantity, item.unit)}`
                        : 'Đã ghi lượng bạn chọn'}
                    </span>
                    {sourceList(demand)}
                  </div>
                  <button
                    type="button"
                    className="shopping-demand-reopen"
                    disabled={controlsDisabled}
                    onClick={() => reviewAction(demand, 'reopen')}
                  >
                    <RotateCcw size={15} aria-hidden="true" /> Xem lại
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {skipped.length > 0 && (
        <details className="shopping-skipped">
          <summary>Đã bỏ qua · {skipped.length} nguyên liệu</summary>
          <p>
            Chỉ bỏ qua việc chọn lượng cho lượt đi chợ này. Thực đơn và thực phẩm trong tủ không
            thay đổi.
          </p>
          <ul className="shopping-demand-list">
            {skipped.map((demand) => (
              <li
                key={`${demand.sourceId}:${demand.demandKey}`}
                className="shopping-demand-card is-skipped"
              >
                <div className="shopping-demand-card-copy">
                  <strong>{demand.name}</strong>
                  {sourceList(demand)}
                </div>
                <button
                  type="button"
                  className="shopping-demand-reopen"
                  disabled={controlsDisabled}
                  onClick={() => reviewAction(demand, 'reopen')}
                >
                  <RotateCcw size={15} aria-hidden="true" /> Xem lại
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p ref={receiptFocus} tabIndex={-1} role="status" className="shopping-demand-receipt">
        {receipt}
      </p>
      {!purchaseDemand && recovery()}
      {purchaseDemand && (
        <div className="planning-picker fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-semantic-overlay/50">
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shopping-demand-purchase-title"
            className="family-dialog shopping-demand-dialog"
          >
            <div className="family-dialog-heading">
              <div>
                <p className="planning-eyebrow">LƯỢNG CHO LẦN ĐI CHỢ NÀY</p>
                <h2 ref={dialogHeading} tabIndex={-1} id="shopping-demand-purchase-title">
                  Chọn lượng mua: {purchaseDemand.name}
                </h2>
              </div>
              <Button
                variant="ghost"
                aria-label="Đóng"
                disabled={busy}
                onClick={() => setPurchaseDemand(null)}
              >
                <X size={20} aria-hidden="true" />
              </Button>
            </div>
            <p className="shopping-demand-dialog-help">
              Ghi lượng bạn muốn mua ở chợ. Đây là lựa chọn của bạn; tổng lượng theo thực đơn vẫn
              chưa xác định.
            </p>
            {purchaseDemand.purchaseItemId &&
              itemById.get(purchaseDemand.purchaseItemId)?.isChecked && (
                <p className="shopping-demand-prior">
                  Dòng này đang được đánh dấu đã mua. Ghi lượng mới giữ nguyên dấu đã mua.
                </p>
              )}
            {sourceList(purchaseDemand)}
            <form className="family-settings-form" onSubmit={submitPurchase}>
              <fieldset disabled={busy || !serverReady || !!attempt || requiresReload}>
                <div className="family-field-pair">
                  <label htmlFor="shopping-review-quantity">
                    Lượng muốn mua
                    <input
                      ref={amountInput}
                      type="number"
                      inputMode="decimal"
                      min={Number.MIN_VALUE}
                      max={100_000}
                      step="any"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      aria-invalid={invalid || undefined}
                      id="shopping-review-quantity"
                      name="shopping-review-quantity"
                      autoComplete="off"
                      aria-describedby={
                        invalid
                          ? 'shopping-demand-quantity-error shopping-demand-unit-note'
                          : 'shopping-demand-unit-note'
                      }
                    />
                  </label>
                  <label htmlFor="shopping-review-unit">
                    Đơn vị mua
                    <select
                      id="shopping-review-unit"
                      name="shopping-review-unit"
                      autoComplete="off"
                      value={unit}
                      onChange={(event) => setUnit(event.target.value as PurchaseUnit)}
                    >
                      {SHOPPING_UNITS.map((entry) => (
                        <option key={entry.value} value={entry.value}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>
              <p id="shopping-demand-unit-note" className="planning-note">
                Chọn bó hoặc gói chỉ ghi cách bạn mua, không đổi sang khối lượng của công thức.
              </p>
              {invalid && (
                <p id="shopping-demand-quantity-error" role="alert">
                  Nhập lượng lớn hơn 0, không quá 100.000 và chọn đơn vị mua.
                </p>
              )}
              {!!attempt && !busy && (
                <p role="status">Giữ nguyên lượng vừa gửi để thử lại an toàn.</p>
              )}
              {!serverReady && <p role="status">Kết nối và đồng bộ lại để xác nhận lượng mua.</p>}
              {recovery()}
              {!requiresReload && (
                <Button type="submit" fullWidth isLoading={busy} disabled={!serverReady || busy}>
                  <Check size={18} aria-hidden="true" className="mr-2" />
                  {attempt ? 'Thử lại lượng vừa gửi' : 'Thêm lượng này vào danh sách'}
                </Button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
