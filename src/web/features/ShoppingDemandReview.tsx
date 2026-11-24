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
import { getShoppingUnits, SHOPPING_UNITS, shoppingQuantity } from '../lib/shopping-form';
import { capturePrivateSession, onPrivateSessionReset } from '../lib/private-session';
import type { SupportedLocale } from '../../shared/locales';
import {
  lSync,
  localizeIngredientName,
  localizeRecipeTitle,
  useLocaleText,
} from '../i18n/app-i18n';

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
function actionLabel(action: ReviewAction, locale: SupportedLocale) {
  return action === 'purchase'
    ? lSync('lượng vừa gửi', 'the submitted quantity', locale)
    : action === 'skip'
      ? lSync('bỏ qua vừa gửi', 'the skip request', locale)
      : lSync('mở lại vừa gửi', 'the reopen request', locale);
}
function mealLabel(mealType: string, locale: SupportedLocale) {
  return mealType === 'breakfast'
    ? lSync('Sáng', 'Breakfast', locale)
    : mealType === 'lunch'
      ? lSync('Trưa', 'Lunch', locale)
      : lSync('Tối', 'Dinner', locale);
}
function reviewErrorMessage(failure: unknown, locale: SupportedLocale) {
  if (failure instanceof ApiError && failure.code === 'SHOPPING_PENDING_SYNC')
    return lSync(
      'Danh sách đang chờ đồng bộ. Chờ đồng bộ xong rồi tải lại để chọn lượng.',
      'Your list has changes waiting to sync. Wait for sync to finish, then reload to choose a quantity.',
      locale,
    );
  if (failure instanceof ApiError && failure.status === 409)
    return lSync(
      'Danh sách vừa thay đổi. Tải lại để xem lượng và nguồn món mới nhất, rồi chọn lại.',
      'The list changed recently. Reload to view the latest quantities and linked meals, then try again.',
      locale,
    );
  if (failure instanceof ApiError && failure.kind === 'auth')
    return lSync(
      'Phiên làm việc hoặc quyền truy cập đã thay đổi. Tải lại danh sách trước khi tiếp tục.',
      'Your session or permissions changed. Reload the list before continuing.',
      locale,
    );
  if (failure instanceof ApiError && failure.kind === 'offline')
    return lSync(
      'Chưa xác nhận được thao tác do mất kết nối. Giữ nguyên thao tác và thử lại khi có mạng.',
      'Could not confirm this action while offline. Keep your selection and retry when back online.',
      locale,
    );
  if (failure instanceof ApiError && (failure.status === 422 || failure.status === 404))
    return lSync(
      'Nguyên liệu hoặc dữ liệu đi chợ không còn phù hợp. Tải lại danh sách trước khi chọn tiếp.',
      'This ingredient or shopping data is no longer current. Reload the list before choosing again.',
      locale,
    );
  return lSync(
    'Chưa xác nhận được thao tác. Thử lại đúng thao tác vừa gửi để tránh thay đổi trùng.',
    'Could not confirm this action. Retry the exact request you submitted to avoid duplicates.',
    locale,
  );
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
  const { l, locale } = useLocaleText();
  const units = getShoppingUnits(locale);
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
        <summary>
          {l(
            `Xem ${count} bữa liên quan`,
            `View ${count} related ${count === 1 ? 'meal' : 'meals'}`,
          )}
        </summary>
        <ul>
          {demand.contributions.map((source, index) => {
            const localizedTitle = localizeRecipeTitle({ title: source.title }, locale);
            return (
              <li key={`${source.slotId}:${source.componentId}:${index}`}>
                <span>
                  {source.date} · {mealLabel(source.mealType, locale)} ·{' '}
                  {source.recipeId && sourceLinksEnabled ? (
                    <Link
                      to={`/recipes/id/${encodeURIComponent(source.recipeId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {localizedTitle}
                    </Link>
                  ) : (
                    localizedTitle
                  )}
                </span>
                <span>
                  {source.quantity === null
                    ? l('Lượng món này chưa rõ', 'Quantity unknown for this dish')
                    : shoppingQuantity(source.quantity, source.unit, locale)}
                </span>
              </li>
            );
          })}
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
        ? l(
            'Đã ghi lượng bạn chọn. Tổng lượng theo thực đơn vẫn chưa xác định.',
            'Saved your chosen quantity. The total meal-plan requirement is still unresolved.',
          )
        : input.action === 'skip'
          ? l(
              'Đã bỏ qua việc chọn lượng trong lượt đi chợ này.',
              'Skipped choosing a quantity for this shopping trip.',
            )
          : l(
              'Đã mở lại nguyên liệu để bạn chọn lượng.',
              'Reopened this ingredient so you can choose a quantity.',
            ),
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
      ? l(
          'Bản lưu trên thiết bị vẫn giúp bạn xem món. Kết nối mạng và tải lại để chọn lượng hoặc bỏ qua.',
          'You can still view the cached list on this device. Reconnect and reload to choose quantities or skip items.',
        )
      : hasPendingChanges
        ? l(
            'Có thay đổi đang chờ đồng bộ. Chờ đồng bộ xong rồi tải lại để rà lượng.',
            'Some changes are waiting to sync. Wait for sync to finish, then reload to review quantities.',
          )
        : '';
  const errorMessage =
    error instanceof Error && error.message === 'reload'
      ? receipt
        ? l(
            'Thao tác đã được lưu, nhưng chưa tải lại được danh sách. Tải lại trước khi chọn tiếp.',
            'Your change was saved, but the list could not reload. Reload before choosing again.',
          )
        : l(
            'Chưa tải lại được danh sách. Kết nối lại rồi thử tải lại.',
            'Could not reload the list. Reconnect and try reloading.',
          )
      : reviewErrorMessage(error, locale);
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
            {l('Tải lại danh sách', 'Reload list')}
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
              {l(
                `Thử lại ${actionLabel(attempt.input.action, locale)}`,
                `Retry ${actionLabel(attempt.input.action, locale)}`,
              )}
            </Button>
          )
        )}
      </div>
    );
  }

  const purchaseDisplayName = purchaseDemand
    ? localizeIngredientName(purchaseDemand.ingredientId, purchaseDemand.name, locale)
    : '';

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
            {l('Tải lại danh sách', 'Reload list')}
          </Button>
        </div>
      )}
      {pending.length > 0 && (
        <section className="shopping-unresolved" aria-labelledby="shopping-demand-pending-title">
          <p className="planning-eyebrow">{l('CẦN QUYẾT ĐỊNH', 'NEEDS REVIEW')}</p>
          <h3 id="shopping-demand-pending-title">
            {l(`Chưa rõ lượng mua · ${pending.length}`, `Unknown quantities · ${pending.length}`)}
          </h3>
          <p>
            {l(
              'Chọn lượng bạn định mua hoặc tạm bỏ qua lần này. Gói, bó hay cái là đơn vị mua bạn chọn; tổng lượng theo thực đơn vẫn chưa xác định.',
              'Choose the amount you plan to buy or skip it for now. Packs, bunches, or pieces reflect how you shop; the total meal-plan requirement remains unresolved.',
            )}
          </p>
          <ul className="shopping-demand-list">
            {pending.map((demand, index) => {
              const bound = reviewable(demand);
              const prior = demand.purchaseItemId ? itemById.get(demand.purchaseItemId) : undefined;
              const demandName = localizeIngredientName(demand.ingredientId, demand.name, locale);
              return (
                <li
                  key={`${demand.sourceId ?? index}:${demand.demandKey ?? demand.ingredientId}`}
                  className="shopping-demand-card"
                >
                  <div className="shopping-demand-card-copy">
                    <strong>{demandName}</strong>
                    <span className="shopping-row-quantity">
                      {l('Tổng lượng chưa xác định', 'Total quantity unresolved')}
                    </span>
                    {prior && (
                      <p className="shopping-demand-prior">
                        {l(
                          `Đang giữ dòng ${shoppingQuantity(prior.quantity, prior.unit, locale)}${prior.isChecked ? ' đã mua' : ' bạn đã chọn'}. Tạm bỏ qua chỉ xóa dòng chưa mua; lịch sử đã mua được giữ.`,
                          `Keeping ${shoppingQuantity(prior.quantity, prior.unit, locale)} (${prior.isChecked ? 'bought' : 'chosen by you'}). Skipping only removes unchecked items; bought history is kept.`,
                        )}
                      </p>
                    )}
                    {!bound && (
                      <p className="shopping-demand-prior">
                        {l(
                          'Tải lại để có bản dữ liệu mới trước khi chọn lượng.',
                          'Reload for the latest data before choosing a quantity.',
                        )}
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
                      {l('Chọn lượng mua', 'Choose quantity')}
                    </Button>
                    <button
                      type="button"
                      className="shopping-demand-skip"
                      disabled={controlsDisabled || !bound}
                      onClick={() => {
                        if (bound) reviewAction(demand, 'skip');
                      }}
                    >
                      {l('Tạm bỏ qua', 'Skip for now')}
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
          <summary>
            {l(
              `Đã chọn lượng mua · ${purchased.length} nguyên liệu`,
              `Quantities chosen · ${purchased.length} ${purchased.length === 1 ? 'ingredient' : 'ingredients'}`,
            )}
          </summary>
          <p>
            {l(
              'Lượng bạn chọn nằm trong danh sách mua. Tổng lượng theo thực đơn vẫn chưa xác định; bạn có thể mở lại để rà khi cần.',
              'Your chosen quantities are in the shopping list. Total meal-plan requirements remain unresolved; you can reopen them anytime.',
            )}
          </p>
          <ul className="shopping-demand-list">
            {purchased.map((demand) => {
              const item = demand.purchaseItemId ? itemById.get(demand.purchaseItemId) : undefined;
              const demandName = localizeIngredientName(demand.ingredientId, demand.name, locale);
              return (
                <li
                  key={`${demand.sourceId}:${demand.demandKey}`}
                  className="shopping-demand-card is-reviewed"
                >
                  <div className="shopping-demand-card-copy">
                    <strong>{demandName}</strong>
                    <span className="shopping-row-quantity">
                      {item
                        ? l(
                            `Lượng bạn chọn: ${shoppingQuantity(item.quantity, item.unit, locale)}`,
                            `Your chosen amount: ${shoppingQuantity(item.quantity, item.unit, locale)}`,
                          )
                        : l('Đã ghi lượng bạn chọn', 'Your chosen quantity is saved')}
                    </span>
                    {sourceList(demand)}
                  </div>
                  <button
                    type="button"
                    className="shopping-demand-reopen"
                    disabled={controlsDisabled}
                    onClick={() => reviewAction(demand, 'reopen')}
                  >
                    <RotateCcw size={15} aria-hidden="true" /> {l('Xem lại', 'Review again')}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {skipped.length > 0 && (
        <details className="shopping-skipped">
          <summary>
            {l(
              `Đã bỏ qua · ${skipped.length} nguyên liệu`,
              `Skipped · ${skipped.length} ${skipped.length === 1 ? 'ingredient' : 'ingredients'}`,
            )}
          </summary>
          <p>
            {l(
              'Chỉ bỏ qua việc chọn lượng cho lượt đi chợ này. Thực đơn và thực phẩm trong tủ không thay đổi.',
              'Only skipped choosing a quantity for this shopping trip. Your meal plan and fridge stock stay unchanged.',
            )}
          </p>
          <ul className="shopping-demand-list">
            {skipped.map((demand) => (
              <li
                key={`${demand.sourceId}:${demand.demandKey}`}
                className="shopping-demand-card is-skipped"
              >
                <div className="shopping-demand-card-copy">
                  <strong>{localizeIngredientName(demand.ingredientId, demand.name, locale)}</strong>
                  {sourceList(demand)}
                </div>
                <button
                  type="button"
                  className="shopping-demand-reopen"
                  disabled={controlsDisabled}
                  onClick={() => reviewAction(demand, 'reopen')}
                >
                  <RotateCcw size={15} aria-hidden="true" /> {l('Xem lại', 'Review again')}
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
        <div
          role="presentation"
          onClick={() => {
            if (!busy) setPurchaseDemand(null);
          }}
          className="planning-picker fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-semantic-overlay/50"
        >
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shopping-demand-purchase-title"
            onClick={(e) => e.stopPropagation()}
            className="family-dialog shopping-demand-dialog"
          >
            <div className="family-dialog-heading">
              <div>
                <p className="planning-eyebrow">
                  {l('LƯỢNG CHO LẦN ĐI CHỢ NÀY', 'QUANTITY FOR THIS TRIP')}
                </p>
                <h2 ref={dialogHeading} tabIndex={-1} id="shopping-demand-purchase-title">
                  {l(
                    `Chọn lượng mua: ${purchaseDisplayName}`,
                    `Choose quantity: ${purchaseDisplayName}`,
                  )}
                </h2>
              </div>
              <Button
                variant="ghost"
                className="!px-2.5 !min-w-[44px]"
                aria-label={l('Đóng', 'Close')}
                disabled={busy}
                onClick={() => setPurchaseDemand(null)}
              >
                <X size={20} aria-hidden="true" />
              </Button>
            </div>
            <p className="shopping-demand-dialog-help">
              {l(
                'Ghi lượng bạn muốn mua ở chợ. Đây là lựa chọn của bạn; tổng lượng theo thực đơn vẫn chưa xác định.',
                'Enter how much you plan to buy at the store. This is your choice; the total meal-plan requirement remains unresolved.',
              )}
            </p>
            {purchaseDemand.purchaseItemId &&
              itemById.get(purchaseDemand.purchaseItemId)?.isChecked && (
                <p className="shopping-demand-prior">
                  {l(
                    'Dòng này đang được đánh dấu đã mua. Ghi lượng mới giữ nguyên dấu đã mua.',
                    'This item is already marked bought. Saving a new quantity keeps its bought status.',
                  )}
                </p>
              )}
            {sourceList(purchaseDemand)}
            <form className="family-settings-form" onSubmit={submitPurchase}>
              <fieldset disabled={busy || !serverReady || !!attempt || requiresReload}>
                <div className="family-field-pair">
                  <label htmlFor="shopping-review-quantity">
                    {l('Lượng muốn mua', 'Quantity to buy')}
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
                    {l('Đơn vị mua', 'Purchase unit')}
                    <select
                      id="shopping-review-unit"
                      name="shopping-review-unit"
                      autoComplete="off"
                      value={unit}
                      onChange={(event) => setUnit(event.target.value as PurchaseUnit)}
                    >
                      {units.map((entry) => (
                        <option key={entry.value} value={entry.value}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>
              <p id="shopping-demand-unit-note" className="planning-note">
                {l(
                  'Chọn bó hoặc gói chỉ ghi cách bạn mua, không đổi sang khối lượng của công thức.',
                  'Choosing bunches or packs only records how you buy; it does not convert to recipe weights.',
                )}
              </p>
              {invalid && (
                <p id="shopping-demand-quantity-error" role="alert">
                  {l(
                    'Nhập lượng lớn hơn 0, không quá 100.000 và chọn đơn vị mua.',
                    'Enter a quantity greater than 0, up to 100,000, and choose a purchase unit.',
                  )}
                </p>
              )}
              {!!attempt && !busy && (
                <p role="status">
                  {l(
                    'Giữ nguyên lượng vừa gửi để thử lại an toàn.',
                    'Keeping the submitted quantity for a safe retry.',
                  )}
                </p>
              )}
              {!serverReady && (
                <p role="status">
                  {l(
                    'Kết nối và đồng bộ lại để xác nhận lượng mua.',
                    'Reconnect and sync to confirm this purchase quantity.',
                  )}
                </p>
              )}
              {recovery()}
              {!requiresReload && (
                <Button type="submit" fullWidth isLoading={busy} disabled={!serverReady || busy}>
                  <Check size={18} aria-hidden="true" className="mr-2" />
                  {attempt
                    ? l('Thử lại lượng vừa gửi', 'Retry submitted quantity')
                    : l('Thêm lượng này vào danh sách', 'Add this quantity to list')}
                </Button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
