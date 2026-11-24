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
import { getShoppingUnits, parseShoppingForm, shoppingQuantity } from '../lib/shopping-form';
import { ShoppingDemandReview } from '../features/ShoppingDemandReview';
import { ShoppingListSkeleton } from '../vnext/components/Skeletons';
import { showTkvToast } from '../vnext/components/LivingMotion';
import type { SupportedLocale } from '../../shared/locales';
import {
  localizeDisplayCategory,
  localizeErrorText,
  localizeIngredientName,
  localizeRecipeTitle,
  useLocaleText,
} from '../i18n/app-i18n';

const AISLE_LABELS_VI: Record<string, string> = {
  produce: 'Rau củ & trái cây',
  protein: 'Thịt, cá & hải sản',
  dairy_egg: 'Trứng, sữa & đồ mát',
  pantry: 'Đồ khô & gia vị',
  other: 'Mục cần mua khác',
};

function getAisleLabel(id: string, locale: SupportedLocale): string {
  if (locale === 'vi') return AISLE_LABELS_VI[id] ?? AISLE_LABELS_VI.other;
  if (id === 'produce') return localizeDisplayCategory('produce', locale);
  if (id === 'protein') return localizeDisplayCategory('meat_seafood', locale);
  if (id === 'dairy_egg') return localizeDisplayCategory('dairy_eggs', locale);
  if (id === 'pantry') return localizeDisplayCategory('pantry', locale);
  return localizeDisplayCategory('other', locale);
}

function classifyShoppingAisle(item: ShoppingItem): keyof typeof AISLE_LABELS_VI {
  const text = `${item.name} ${item.ingredientId ?? ''}`.toLowerCase();
  if (
    /(rau|cải|cà chua|cà rốt|hành|tỏi|ớt|gừng|sả|khoai|bí|nấm|dưa|chuối|táo|cam|chanh|ngò|mùi|bắp|đậu bắp|mướp|bầu|su hào|tomato|carrot|onion|garlic|chili|ginger|potato|pumpkin|mushroom|cucumber|banana|apple|orange|lime|lemon|cilantro|corn|spinach|broccoli|cabbage|lettuce|herb|scallion|shallot|produce|vegetable|fruit)/.test(
      text,
    )
  ) {
    return 'produce';
  }
  if (
    /(thịt|gà|bò|heo|lợn|cá|tôm|mực|cua|hải sản|sườn|ba chỉ|xúc xích|chả|pork|beef|chicken|fish|shrimp|squid|crab|seafood|salmon|mackerel|meat|sausage|ribs)/.test(
      text,
    )
  ) {
    return 'protein';
  }
  if (/(trứng|sữa|phô mai|bơ|sữa chua|đậu phụ|đậu hũ|egg|milk|cheese|butter|yogurt|tofu|dairy)/.test(text)) {
    return 'dairy_egg';
  }
  if (
    /(gạo|mì|bún|phở|miến|nước mắm|muối|đường|tiêu|dầu|tương|bột|hạt nêm|giấm|rice|noodle|pasta|spaghetti|sauce|salt|sugar|pepper|oil|flour|vinegar|seasoning|spice)/.test(
      text,
    )
  ) {
    return 'pantry';
  }
  return 'other';
}

export const ShoppingPage: React.FC = () => {
  const { l, locale } = useLocaleText();
  const units = getShoppingUnits(locale);
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
  const [quickMode, setQuickMode] = useState(false);
  const [groupByAisle, setGroupByAisle] = useState(true);
  const [receipt, setReceipt] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  const refresh = () => client.invalidateQueries({ queryKey: shoppingKey });
  const accept = (result: { pendingSync?: boolean }) => {
    setReceipt(
      result.pendingSync
        ? l(
            'Đã lưu trên thiết bị, đang chờ đồng bộ. Máy chủ có thể chưa nhận thay đổi.',
            'Saved on this device, waiting to sync. The server may not have received this change yet.',
          )
        : l('Đã cập nhật danh sách của gia đình.', 'Updated your household shopping list.'),
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
  const aisleGroups = (() => {
    const groups = new Map<string, ShoppingItem[]>();
    for (const item of remaining) {
      const key = classifyShoppingAisle(item);
      const bucket = groups.get(key) ?? [];
      bucket.push(item);
      groups.set(key, bucket);
    }
    return Array.from(groups.entries()).map(([id, list]) => ({
      id,
      label: getAisleLabel(id, locale),
      items: list,
    }));
  })();
  const removingName = removing
    ? localizeIngredientName(removing.ingredientId, removing.name, locale)
    : '';
  function row(item: ShoppingItem) {
    const displayName = localizeIngredientName(item.ingredientId, item.name, locale);
    const sources = item.contributions ?? [];
    const titles = [
      ...new Set(sources.map((source) => localizeRecipeTitle({ title: source.title }, locale))),
    ];
    const sourceRecipeDisplay = item.sourceRecipeTitle
      ? localizeRecipeTitle({ title: item.sourceRecipeTitle }, locale)
      : null;
    return (
      <li
        key={item.id}
        className={`shopping-saved-row ${item.isChecked ? 'is-checked' : ''} ${item.cannotBuy ? 'is-unavailable' : ''} ${quickMode ? 'py-2' : ''}`}
      >
        <label className="shopping-check-label">
          <input
            type="checkbox"
            checked={item.isChecked}
            disabled={busy}
            aria-label={l(`Đã mua: ${displayName}`, `Bought: ${displayName}`)}
            onChange={(event) => {
              const nextChecked = event.target.checked;
              clearErrors();
              toggle.mutate(
                { id: item.id, checked: nextChecked },
                {
                  onSuccess: () => {
                    showTkvToast({
                      message: nextChecked
                        ? l(`Đã mua “${displayName}”`, `Marked “${displayName}” as bought`)
                        : l(`Chuyển “${displayName}” về cần mua`, `Moved “${displayName}” back to to-buy`),
                      tone: nextChecked ? 'success' : 'info',
                    });
                  },
                },
              );
            }}
          />
          <span>
            <strong>{displayName}</strong>
            <span className="shopping-row-quantity tabular-nums">
              {shoppingQuantity(item.quantity, item.unit, locale)}
              {item.unknownDemand
                ? l(' · Lượng bạn chọn', ' · Your chosen amount')
                : item.quantityOverridden && l(' · lượng đã chỉnh', ' · edited amount')}
            </span>
            {!quickMode && item.unknownDemand && (
              <span className="shopping-demand-badge">
                {l('Tổng lượng theo thực đơn chưa xác định', 'Total meal-plan quantity unresolved')}
                {item.reviewState === 'pending' &&
                  l(' · cần chọn lại cho lượt này', ' · needs review for this trip')}
              </span>
            )}
            {!quickMode &&
              (titles.length > 0 ? (
                <span className="shopping-row-source">
                  {l('Cho', 'For')} {titles.slice(0, 2).join(', ')}
                  {titles.length > 2 &&
                    l(` và ${titles.length - 2} món khác`, ` and ${titles.length - 2} more`)}
                </span>
              ) : (
                sourceRecipeDisplay && (
                  <span className="shopping-row-source">
                    {l('Cho', 'For')} {sourceRecipeDisplay}
                  </span>
                )
              ))}
            {item.pendingSync && (
              <span className="shopping-pending-label">{l('Chờ đồng bộ', 'Pending sync')}</span>
            )}
            {item.cannotBuy && (
              <span className="shopping-unavailable-label">
                {l(
                  'Chưa mua được · xem bữa liên quan để đổi món',
                  'Unavailable · view linked meals to swap dishes',
                )}
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
            aria-label={l(`Sửa số lượng: ${displayName}`, `Edit quantity: ${displayName}`)}
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="planning-icon-button"
            disabled={busy}
            onClick={() => setRemoving(item)}
            aria-label={l(`Xóa khỏi danh sách: ${displayName}`, `Remove from list: ${displayName}`)}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
        {!quickMode && sources.length > 0 && (
          <details className="shopping-source-details">
            <summary>{l('Dùng cho bữa nào?', 'Used in which meals?')}</summary>
            <ul>
              {sources.map((source, index) => {
                const localizedSourceTitle = localizeRecipeTitle({ title: source.title }, locale);
                return (
                  <li key={`${source.slotId}:${source.componentId}:${index}`}>
                    <span>
                      {source.date} ·{' '}
                      {source.mealType === 'breakfast'
                        ? l('Sáng', 'Breakfast')
                        : source.mealType === 'lunch'
                          ? l('Trưa', 'Lunch')
                          : l('Tối', 'Dinner')}{' '}
                      ·{' '}
                      {source.recipeId && !busy ? (
                        <Link
                          to={`/recipes/id/${encodeURIComponent(source.recipeId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {localizedSourceTitle}
                        </Link>
                      ) : (
                        localizedSourceTitle
                      )}
                    </span>
                    <span className="tabular-nums">
                      {source.quantity === null
                        ? l('Lượng món này chưa rõ', 'Quantity unknown for this dish')
                        : shoppingQuantity(source.quantity, source.unit, locale)}
                    </span>
                  </li>
                );
              })}
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
          {item.cannotBuy
            ? l('Bỏ dấu chưa mua được', 'Clear unavailable mark')
            : l('Chưa mua được', 'Mark unavailable')}
        </button>
      </li>
    );
  }
  return (
    <div className="shopping-workspace">
      <KitchenHeader backTo="/" />
      <div className="planning-page-body">
        <KitchenPageHeading
          eyebrow={l('Takolio · ĐI CHỢ', 'Takolio · SHOPPING')}
          title={l('Danh sách mua sắm', 'Shopping list')}
          description={l(
            'Chỉnh lượng cần mua, rồi đánh dấu từng món khi đã mua.',
            'Adjust quantities to buy, then check off each item as you shop.',
          )}
          action={
            <Link to="/planner" className="planning-text-link">
              {l('Xem thực đơn', 'View meal plan')} <ArrowRight size={18} aria-hidden="true" />
            </Link>
          }
        />
        <div className="saved-shopping-layout">
          <details
            className="shopping-add-panel planning-paper"
            open={addOpen}
            onToggle={(event) => setAddOpen(event.currentTarget.open)}
          >
            <summary>{l('Thêm nguyên liệu ngoài thực đơn', 'Add an extra item')}</summary>
            <form onSubmit={submit} className="shopping-add-form">
              <fieldset disabled={busy || !!attempt}>
                <label>
                  {l('Tên nguyên liệu', 'Ingredient name')}
                  <input
                    name="shopping-name"
                    autoComplete="off"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={l('Ví dụ: trái cây, sữa…', 'e.g., fruit, milk…')}
                  />
                </label>
                <div className="shopping-amount-fields">
                  <label>
                    {l('Số lượng', 'Quantity')}
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
                    {l('Đơn vị', 'Unit')}
                    <select
                      name="shopping-unit"
                      value={unit}
                      onChange={(event) => setUnit(event.target.value)}
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
              {attempt && !busy && (
                <p className="planning-note">
                  {l(
                    'Thử lại đúng món và lượng vừa gửi để tránh thêm trùng.',
                    'Retry the exact item and quantity you submitted to avoid duplicates.',
                  )}
                </p>
              )}
              <Button
                type="submit"
                fullWidth
                isLoading={add.isPending}
                disabled={busy && !add.isPending}
              >
                <Plus size={18} aria-hidden="true" className="mr-2" />
                {attempt
                  ? l('Thử lại món vừa gửi', 'Retry previous item')
                  : l('Thêm vào danh sách', 'Add to list')}
              </Button>
            </form>
            <p className="planning-note">
              {l(
                'Mua xong chưa tự thêm vào tủ. Khi về nhà, quét hoặc nhập thực phẩm đã mua.',
                'Checking items off does not add them to your fridge automatically. When you get home, scan or add your groceries.',
              )}
            </p>
            <Link to="/scan" className="planning-text-link">
              {l('Quét thực phẩm đã mua', 'Scan purchased groceries')}{' '}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </details>
          <section className="shopping-saved-list" aria-labelledby="saved-list-heading">
            <div className="shopping-list-heading">
              <div>
                <p className="planning-eyebrow">
                  {l('DANH SÁCH CỦA GIA ĐÌNH', 'HOUSEHOLD LIST')}
                </p>
                <h2 id="saved-list-heading" className="tabular-nums">
                  {l('Cần mua', 'To buy')} <span>{remaining.length}</span>
                </h2>
              </div>
              <div className="shopping-count-summary tabular-nums">
                <p>
                  {checked.length} {l('đã mua', 'bought')}
                </p>
                {needsReviewCount > 0 && (
                  <p className="shopping-review-count">
                    {l(
                      `${needsReviewCount} nguyên liệu cần chọn lượng`,
                      `${needsReviewCount} ${needsReviewCount === 1 ? 'ingredient needs' : 'ingredients need'} a quantity`,
                    )}
                  </p>
                )}
              </div>
            </div>
            {items.length > 0 && (
              <div
                role="group"
                aria-label={l('Tùy chọn hiển thị khi đi chợ', 'Shopping view options')}
                className="flex flex-wrap items-center gap-2 mb-3"
              >
                <button
                  type="button"
                  aria-pressed={quickMode}
                  data-testid="c28-quick-market-toggle"
                  onClick={() => setQuickMode((prev) => !prev)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-full text-xs font-bold border transition-colors inline-flex items-center gap-1.5 ${
                    quickMode
                      ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                      : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink)] border-[var(--tkv-border)] hover:border-[var(--tkv-primary)]'
                  }`}
                >
                  {quickMode && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-coral)] shrink-0" aria-hidden="true" />
                  )}
                  <span>{l('Chế độ đi chợ nhanh', 'Quick market mode')}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={groupByAisle}
                  data-testid="c27-aisle-group-toggle"
                  onClick={() => setGroupByAisle((prev) => !prev)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-full text-xs font-bold border transition-colors ${
                    groupByAisle
                      ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                      : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:border-[var(--tkv-primary)]'
                  }`}
                >
                  {l('Nhóm theo quầy chợ', 'Group by aisle')}
                </button>
              </div>
            )}
            {query.data?.source === 'device' && (
              <p role="status" className="planning-notice">
                {l(
                  'Đang xem bản lưu trên thiết bị; các thay đổi ở dòng mua sẽ đồng bộ khi có kết nối. Việc chọn lượng chưa rõ cần kết nối lại.',
                  'Viewing the cached list on this device; checklist changes will sync when back online. Reviewing unknown quantities requires a connection.',
                )}
              </p>
            )}
            {(invalid || mutationError) && (
              <div ref={errorRef} tabIndex={-1} className="planning-error-focus">
                {invalid ? (
                  <p role="alert">
                    {l(
                      'Nhập tên, số lượng lớn hơn 0 và chọn đơn vị.',
                      'Enter a name, a quantity greater than 0, and choose a unit.',
                    )}
                  </p>
                ) : (
                  <InlineError
                    message={l(
                      'Chưa xác nhận được thay đổi. Hãy thử lại thao tác vừa gửi.',
                      'Could not confirm the change. Please retry your last action.',
                    )}
                  />
                )}
              </div>
            )}
            <p role="status" className="planning-receipt">
              {receipt}
            </p>
            {query.isError && !query.data ? (
              <InlineError
                error={query.error}
                message={
                  locale === 'vi'
                    ? undefined
                    : localizeErrorText(
                        query.error,
                        'Could not load your shopping list. Please try again.',
                      )
                }
                onRetry={() => void query.refetch()}
              />
            ) : query.isPending ? (
              <ShoppingListSkeleton />
            ) : (
              <>
                {query.isError && (
                  <InlineError
                    message={l(
                      'Chưa tải lại được danh sách. Đang giữ bản vừa xem; tải lại trước khi rà lượng.',
                      'Could not refresh the list. Keeping your last view; reload before reviewing quantities.',
                    )}
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
                  <ul className={`shopping-item-list ${quickMode ? 'is-quick-market' : ''}`}>
                    {groupByAisle
                      ? aisleGroups.map((group) => (
                          <React.Fragment key={group.id}>
                            <li className="shopping-aisle-header list-none pt-2 pb-1.5 px-1 flex items-center justify-between gap-2 border-b border-[var(--tkv-border)] text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-muted)]">
                              <span className="min-w-0">{group.label}</span>
                              <span className="tabular-nums shrink-0">
                                {group.items.length}{' '}
                                {l('mục', group.items.length === 1 ? 'item' : 'items')}
                              </span>
                            </li>
                            {group.items.map(row)}
                          </React.Fragment>
                        ))
                      : remaining.map(row)}
                  </ul>
                ) : (
                  <div className="shopping-empty planning-paper">
                    <ShoppingBag size={32} aria-hidden="true" />
                    <h3>
                      {needsReviewCount
                        ? l('Còn nguyên liệu cần chọn lượng', 'Ingredients still need quantities')
                        : items.length
                          ? l('Đã mua xong các dòng có lượng', 'All quantified items bought')
                          : demands.length
                            ? l('Các dòng chưa rõ lượng đã được rà', 'All unknown quantities reviewed')
                            : l('Chưa có nguyên liệu cần mua', 'No items to buy yet')}
                    </h3>
                    <p>
                      {needsReviewCount
                        ? l(
                            'Chọn lượng hoặc tạm bỏ qua ở phần trên trước khi đi chợ.',
                            'Choose a quantity or skip items above before heading to the store.',
                          )
                        : demands.length
                          ? l(
                              'Mở phần đã chọn hoặc đã bỏ qua nếu bạn muốn xem lại.',
                              'Open the chosen or skipped sections above if you want to review them.',
                            )
                          : l(
                              'Lên thực đơn để Takolio gom nguyên liệu của mọi món vào danh sách.',
                              'Create a meal plan so Takolio can gather missing ingredients into your list.',
                            )}
                    </p>
                    <Link to="/planner" className="planning-text-link">
                      {l('Lên thực đơn', 'Plan meals')}{' '}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                )}
                {checked.length > 0 && (
                  <details className="shopping-bought">
                    <summary>
                      {l(
                        `Đã mua · ${checked.length} dòng`,
                        `Bought · ${checked.length} ${checked.length === 1 ? 'item' : 'items'}`,
                      )}
                    </summary>
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
        title={l('Xóa khỏi danh sách?', 'Remove from list?')}
        description={
          removing
            ? l(
                `Xóa “${removingName}” khỏi danh sách mua sắm của gia đình.${removing.unknownDemand ? ' Nguyên liệu chưa rõ lượng sẽ trở lại phần cần chọn lượng.' : ''}`,
                `Remove “${removingName}” from your household shopping list.${removing.unknownDemand ? ' Items with unresolved meal-plan demand will return to the review section.' : ''}`,
              )
            : undefined
        }
        confirmText={l('Xóa món', 'Remove item')}
        cancelText={l('Giữ lại', 'Keep')}
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
  const { l, locale } = useLocaleText();
  const units = getShoppingUnits(locale);
  const panel = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(() =>
    locale === 'vi' ? item.name : localizeIngredientName(item.ingredientId, item.name, locale),
  );
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
    <div
      role="presentation"
      onClick={() => {
        if (!save.isPending) onClose();
      }}
      className="planning-picker fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-semantic-overlay/50"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopping-edit-title"
        onClick={(e) => e.stopPropagation()}
        className="family-dialog"
      >
        <div className="family-dialog-heading">
          <h2 id="shopping-edit-title">{l('Chỉnh món cần mua', 'Edit shopping item')}</h2>
          <Button
            variant="ghost"
            className="!px-2.5 !min-w-[44px]"
            aria-label={l('Đóng', 'Close')}
            disabled={save.isPending}
            onClick={onClose}
          >
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
              {l('Tên nguyên liệu', 'Ingredient name')}
              <input
                required
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <div className="family-field-pair">
              <label>
                {l('Số lượng', 'Quantity')}
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={Number.MIN_VALUE}
                  required
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </label>
              <label>
                {l('Đơn vị', 'Unit')}
                <select value={unit} onChange={(event) => setUnit(event.target.value)}>
                  {units.map((entry) => (
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
                ? l(
                    'Bạn đang chỉnh lượng muốn mua. Tổng lượng theo thực đơn vẫn chưa xác định; thay đổi này không xác nhận nhu cầu của món.',
                    'You are editing the amount you plan to buy. The total meal-plan requirement is still unresolved; this does not confirm recipe demand.',
                  )
                : l(
                    'Lượng bạn chỉnh được giữ khi cập nhật lại thực đơn.',
                    'Your edited quantity is kept when the meal plan updates.',
                  )}
            </p>
          )}
          {invalid && (
            <p role="alert">
              {l('Nhập tên và số lượng lớn hơn 0.', 'Enter a name and a quantity greater than 0.')}
            </p>
          )}
          {save.isError && (
            <InlineError
              error={save.error}
              message={
                locale === 'vi'
                  ? undefined
                  : localizeErrorText(save.error, 'Could not save this item. Please try again.')
              }
            />
          )}
          <Button type="submit" fullWidth isLoading={save.isPending}>
            {l('Lưu lượng cần mua', 'Save quantity')}
          </Button>
        </form>
      </div>
    </div>
  );
}
