import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ShoppingBag, ArrowRight, Pencil, X } from 'lucide-react';
import { KitchenHeader, KitchenPageHeading } from '../components/common/KitchenHeader';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { InlineError } from '../components/common/AsyncState';
import { useModalFocus } from '../design-system/use-modal-focus';
import { shoppingApi, type ShoppingInput, type ShoppingItem } from '../services/shopping';
import { ApiError, createClientItemId } from '../services/http';
import { queryKeys } from '../lib/queryKeys';
import { parseShoppingForm, SHOPPING_UNITS, shoppingQuantity } from '../lib/shopping-form';
import { ShoppingDemandReview } from '../features/ShoppingDemandReview';

export const ShoppingPage: React.FC = () => {
  const client = useQueryClient();
  const shoppingKey = queryKeys.shoppingList();
  const query = useQuery({
    queryKey: [...shoppingKey, 'snapshot'],
    queryFn: shoppingApi.getShoppingListSnapshot,
    retry: false,
  });
  const items = query.data?.items ?? [];
  const demands = query.data?.unresolvedItems ?? [];
  const needsReviewCount = demands.filter(
    (item) => !item.reviewState || item.reviewState === 'pending',
  ).length;
  const [reviewBusy, setReviewBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(
    () => window.matchMedia?.('(min-width: 1024px)').matches ?? false,
  );
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('piece');
  const [attempt, setAttempt] = useState<ShoppingInput | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [removing, setRemoving] = useState<ShoppingItem | null>(null);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [receipt, setReceipt] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  const refresh = () => client.invalidateQueries({ queryKey: shoppingKey });
  const accept = (result: { pendingSync?: boolean }) => {
    setReceipt(
      result.pendingSync
        ? 'Đã lưu trên thiết bị, đang chờ đồng bộ. Máy chủ có thể chưa nhận thay đổi.'
        : 'Đã cập nhật danh sách của gia đình.',
    );
    return refresh();
  };
  const add = useMutation({
    mutationFn: shoppingApi.addShoppingItem,
    onError: (failure) => {
      if (failure instanceof ApiError && failure.status === 400) setAttempt(null);
    },
    onSuccess: (result) => {
      setName('');
      setQuantity('1');
      setAttempt(null);
      return accept(result);
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) =>
      shoppingApi.updateShoppingItem(id, {
        isChecked: checked,
        ...(checked ? { cannotBuy: false } : {}),
      }),
    onSuccess: accept,
  });
  const cannotBuy = useMutation({
    mutationFn: ({ id, unavailable }: { id: string; unavailable: boolean }) =>
      shoppingApi.updateShoppingItem(id, {
        cannotBuy: unavailable,
        ...(unavailable ? { isChecked: false } : {}),
      }),
    onSuccess: accept,
  });
  const remove = useMutation({ mutationFn: shoppingApi.deleteShoppingItem, onSuccess: accept });
  const listBusy = add.isPending || toggle.isPending || remove.isPending || cannotBuy.isPending;
  const busy = listBusy || reviewBusy;
  const mutationError = add.error ?? toggle.error ?? remove.error ?? cannotBuy.error;
  useEffect(() => {
    if (invalid || mutationError) {
      errorRef.current?.focus();
      errorRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [invalid, mutationError]);
  useEffect(() => {
    if (!name.trim() && !attempt) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [name, attempt]);
  function clearErrors() {
    add.reset();
    toggle.reset();
    remove.reset();
    cannotBuy.reset();
    setReceipt('');
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const parsed = attempt ?? parseShoppingForm(name, quantity, unit);
    if (!parsed) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    clearErrors();
    const input = attempt ?? { ...parsed, id: createClientItemId('shop') };
    setAttempt(input);
    add.mutate(input);
  }
  const remaining = items.filter((item) => !item.isChecked);
  const checked = items.filter((item) => item.isChecked);
  function row(item: ShoppingItem) {
    const sources = item.contributions ?? [];
    const titles = [...new Set(sources.map((source) => source.title))];
    return (
      <li
        key={item.id}
        className={`shopping-saved-row ${item.isChecked ? 'is-checked' : ''} ${item.cannotBuy ? 'is-unavailable' : ''}`}
      >
        <label className="shopping-check-label">
          <input
            type="checkbox"
            checked={item.isChecked}
            disabled={busy}
            aria-label={`Đã mua: ${item.name}`}
            onChange={(event) => {
              clearErrors();
              toggle.mutate({ id: item.id, checked: event.target.checked });
            }}
          />
          <span>
            <strong>{item.name}</strong>
            <span className="shopping-row-quantity">
              {shoppingQuantity(item.quantity, item.unit)}
              {item.unknownDemand
                ? ' · Lượng bạn chọn'
                : item.quantityOverridden && ' · lượng đã chỉnh'}
            </span>
            {item.unknownDemand && (
              <span className="shopping-demand-badge">
                Tổng lượng theo thực đơn chưa xác định
                {item.reviewState === 'pending' && ' · cần chọn lại cho lượt này'}
              </span>
            )}
            {titles.length > 0 ? (
              <span className="shopping-row-source">
                Cho {titles.slice(0, 2).join(', ')}
                {titles.length > 2 && ` và ${titles.length - 2} món khác`}
              </span>
            ) : (
              item.sourceRecipeTitle && (
                <span className="shopping-row-source">Cho {item.sourceRecipeTitle}</span>
              )
            )}
            {item.pendingSync && <span className="shopping-pending-label">Chờ đồng bộ</span>}
            {item.cannotBuy && (
              <span className="shopping-unavailable-label">
                Chưa mua được · xem bữa liên quan để đổi món
              </span>
            )}
          </span>
        </label>
        <div className="shopping-row-actions">
          <button
            type="button"
            className="planning-icon-button"
            disabled={busy}
            onClick={() => setEditing(item)}
            aria-label={`Sửa số lượng: ${item.name}`}
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="planning-icon-button"
            disabled={busy}
            onClick={() => setRemoving(item)}
            aria-label={`Xóa khỏi danh sách: ${item.name}`}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
        {sources.length > 0 && (
          <details className="shopping-source-details">
            <summary>Dùng cho bữa nào?</summary>
            <ul>
              {sources.map((source, index) => (
                <li key={`${source.slotId}:${source.componentId}:${index}`}>
                  <span>
                    {source.date} ·{' '}
                    {source.mealType === 'breakfast'
                      ? 'Sáng'
                      : source.mealType === 'lunch'
                        ? 'Trưa'
                        : 'Tối'}{' '}
                    ·{' '}
                    {source.recipeId && !busy ? (
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
        )}
        <button
          type="button"
          className="shopping-cannot-buy"
          disabled={busy}
          onClick={() => {
            clearErrors();
            cannotBuy.mutate({ id: item.id, unavailable: !item.cannotBuy });
          }}
        >
          {item.cannotBuy ? 'Bỏ dấu chưa mua được' : 'Chưa mua được'}
        </button>
      </li>
    );
  }
  return (
    <div className="shopping-workspace">
      <KitchenHeader backTo="/" />
      <div className="planning-page-body">
        <KitchenPageHeading
          eyebrow="Takolio · ĐI CHỢ"
          title="Danh sách mua sắm"
          description="Chỉnh lượng cần mua, rồi đánh dấu từng món khi đã mua."
          action={
            <Link to="/planner" className="planning-text-link">
              Xem thực đơn <ArrowRight size={18} aria-hidden="true" />
            </Link>
          }
        />
        <div className="saved-shopping-layout">
          <details
            className="shopping-add-panel planning-paper"
            open={addOpen}
            onToggle={(event) => setAddOpen(event.currentTarget.open)}
          >
            <summary>Thêm nguyên liệu ngoài thực đơn</summary>
            <form onSubmit={submit} className="shopping-add-form">
              <fieldset disabled={busy || !!attempt}>
                <label>
                  Tên nguyên liệu
                  <input
                    name="shopping-name"
                    autoComplete="off"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ví dụ: trái cây, sữa…"
                  />
                </label>
                <div className="shopping-amount-fields">
                  <label>
                    Số lượng
                    <input
                      name="shopping-quantity"
                      autoComplete="off"
                      type="number"
                      inputMode="decimal"
                      min={Number.MIN_VALUE}
                      step="any"
                      required
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                    />
                  </label>
                  <label>
                    Đơn vị
                    <select
                      name="shopping-unit"
                      value={unit}
                      onChange={(event) => setUnit(event.target.value)}
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
              {attempt && !busy && (
                <p className="planning-note">
                  Thử lại đúng món và lượng vừa gửi để tránh thêm trùng.
                </p>
              )}
              <Button
                type="submit"
                fullWidth
                isLoading={add.isPending}
                disabled={busy && !add.isPending}
              >
                <Plus size={18} aria-hidden="true" className="mr-2" />
                {attempt ? 'Thử lại món vừa gửi' : 'Thêm vào danh sách'}
              </Button>
            </form>
            <p className="planning-note">
              Mua xong chưa tự thêm vào tủ. Khi về nhà, quét hoặc nhập thực phẩm đã mua.
            </p>
            <Link to="/scan" className="planning-text-link">
              Quét thực phẩm đã mua <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </details>
          <section className="shopping-saved-list" aria-labelledby="saved-list-heading">
            <div className="shopping-list-heading">
              <div>
                <p className="planning-eyebrow">DANH SÁCH CỦA GIA ĐÌNH</p>
                <h2 id="saved-list-heading">
                  Cần mua <span>{remaining.length}</span>
                </h2>
              </div>
              <div className="shopping-count-summary">
                <p>{checked.length} đã mua</p>
                {needsReviewCount > 0 && (
                  <p className="shopping-review-count">
                    {needsReviewCount} nguyên liệu cần chọn lượng
                  </p>
                )}
              </div>
            </div>
            {query.data?.source === 'device' && (
              <p role="status" className="planning-notice">
                Đang xem bản lưu trên thiết bị; các thay đổi ở dòng mua sẽ đồng bộ khi có kết nối.
                Việc chọn lượng chưa rõ cần kết nối lại.
              </p>
            )}
            {(invalid || mutationError) && (
              <div ref={errorRef} tabIndex={-1} className="planning-error-focus">
                {invalid ? (
                  <p role="alert">Nhập tên, số lượng lớn hơn 0 và chọn đơn vị.</p>
                ) : (
                  <InlineError message="Chưa xác nhận được thay đổi. Hãy thử lại thao tác vừa gửi." />
                )}
              </div>
            )}
            <p role="status" className="planning-receipt">
              {receipt}
            </p>
            {query.isError && !query.data ? (
              <InlineError error={query.error} onRetry={() => void query.refetch()} />
            ) : query.isPending ? (
              <p role="status" className="planning-paper">
                Đang tải danh sách đi chợ…
              </p>
            ) : (
              <>
                {query.isError && (
                  <InlineError
                    message="Chưa tải lại được danh sách. Đang giữ bản vừa xem; tải lại trước khi rà lượng."
                    onRetry={() => void query.refetch()}
                  />
                )}
                <ShoppingDemandReview
                  demands={demands}
                  items={items}
                  source={query.data?.source ?? 'device'}
                  hasPendingChanges={query.data?.hasPendingChanges}
                  listBusy={listBusy || query.isError}
                  onBusyChange={setReviewBusy}
                  onChanged={async () => {
                    const latest = await query.refetch();
                    if (latest.isError || latest.data?.source !== 'server')
                      throw new Error('Shopping reload failed');
                  }}
                />
                {remaining.length ? (
                  <ul className="shopping-item-list">{remaining.map(row)}</ul>
                ) : (
                  <div className="shopping-empty planning-paper">
                    <ShoppingBag size={32} aria-hidden="true" />
                    <h3>
                      {needsReviewCount
                        ? 'Còn nguyên liệu cần chọn lượng'
                        : items.length
                          ? 'Đã mua xong các dòng có lượng'
                          : demands.length
                            ? 'Các dòng chưa rõ lượng đã được rà'
                            : 'Chưa có nguyên liệu cần mua'}
                    </h3>
                    <p>
                      {needsReviewCount
                        ? 'Chọn lượng hoặc tạm bỏ qua ở phần trên trước khi đi chợ.'
                        : demands.length
                          ? 'Mở phần đã chọn hoặc đã bỏ qua nếu bạn muốn xem lại.'
                          : 'Lên thực đơn để Takolio gom nguyên liệu của mọi món vào danh sách.'}
                    </p>
                    <Link to="/planner" className="planning-text-link">
                      Lên thực đơn <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                )}
                {checked.length > 0 && (
                  <details className="shopping-bought">
                    <summary>Đã mua · {checked.length} dòng</summary>
                    <ul className="shopping-item-list">{checked.map(row)}</ul>
                  </details>
                )}
              </>
            )}
          </section>
        </div>
      </div>
      <ConfirmDialog
        open={!!removing}
        title="Xóa khỏi danh sách?"
        description={
          removing
            ? `Xóa “${removing.name}” khỏi danh sách mua sắm của gia đình.${removing.unknownDemand ? ' Nguyên liệu chưa rõ lượng sẽ trở lại phần cần chọn lượng.' : ''}`
            : undefined
        }
        confirmText="Xóa món"
        cancelText="Giữ lại"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const item = removing;
          setRemoving(null);
          if (item && !busy) {
            clearErrors();
            remove.mutate(item.id);
          }
        }}
      />
      {editing && (
        <ShoppingEditDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async (result) => {
            setEditing(null);
            await accept(result);
          }}
        />
      )}
    </div>
  );
};

function ShoppingEditDialog({
  item,
  onClose,
  onSaved,
}: {
  item: ShoppingItem;
  onClose: () => void;
  onSaved: (result: { pendingSync: boolean }) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit);
  const [invalid, setInvalid] = useState(false);
  const save = useMutation({
    mutationFn: (input: NonNullable<ReturnType<typeof parseShoppingForm>>) =>
      shoppingApi.updateShoppingItem(item.id, input),
    onSuccess: onSaved,
  });
  useModalFocus(true, panel, () => {
    if (!save.isPending) onClose();
  });
  return (
    <div className="planning-picker fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-semantic-overlay/50">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopping-edit-title"
        className="family-dialog"
      >
        <div className="family-dialog-heading">
          <h2 id="shopping-edit-title">Chỉnh món cần mua</h2>
          <Button variant="ghost" aria-label="Đóng" disabled={save.isPending} onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </Button>
        </div>
        <form
          className="family-settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseShoppingForm(name, quantity, unit);
            setInvalid(!parsed);
            if (parsed) save.mutate(parsed);
          }}
        >
          <fieldset disabled={save.isPending}>
            <label>
              Tên nguyên liệu
              <input
                required
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <div className="family-field-pair">
              <label>
                Số lượng
                <input
                  type="number"
                  step="any"
                  min={Number.MIN_VALUE}
                  required
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </label>
              <label>
                Đơn vị
                <select value={unit} onChange={(event) => setUnit(event.target.value)}>
                  {SHOPPING_UNITS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
          {item.generated && (
            <p className="planning-note">
              {item.unknownDemand
                ? 'Bạn đang chỉnh lượng muốn mua. Tổng lượng theo thực đơn vẫn chưa xác định; thay đổi này không xác nhận nhu cầu của món.'
                : 'Lượng bạn chỉnh được giữ khi cập nhật lại thực đơn.'}
            </p>
          )}
          {invalid && <p role="alert">Nhập tên và số lượng lớn hơn 0.</p>}
          {save.isError && <InlineError error={save.error} />}
          <Button type="submit" fullWidth isLoading={save.isPending}>
            Lưu lượng cần mua
          </Button>
        </form>
      </div>
    </div>
  );
}
