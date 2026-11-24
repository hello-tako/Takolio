import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { KitchenDetailPage } from '../components/common/KitchenDetailPage';
import { StatusChip } from '../components/common/StatusChip';
import { Button } from '../components/common/Button';
import { InlineLoading, InlineError } from '../components/common/AsyncState';
import { api, ApiError } from '../services/api';
import { queryKeys } from '../lib/queryKeys';
import { invalidateInventoryDependents } from '../lib/query-invalidation';
import {
  presentDomainError,
  presentExpiry,
  presentOpenedState,
  presentPurchaseDate,
  presentRefetchOutcome,
  provenanceLabel,
} from '../lib/inventory-truth';
import { ALL_RECIPES } from '@frigo/recipes';
import { convertedInventoryQuantity } from '../lib/inventory-quantity';
import { getIngredientImage } from '../lib/ingredient-images';
import { Clock, ChefHat, Calendar, Layers, ArrowRight, PackageOpen, Receipt } from 'lucide-react';
import { clsx } from 'clsx';
import { resolveRecipeImage, recipeImageErrorHandler } from '../lib/recipe-media';
import {
  formatLocalizedMeasure,
  localizeCuisine,
  localizeDisplayCategory,
  localizeIngredientName,
  localizeRecipeTitle,
  localizeStorageZone,
  useLocaleText,
} from '../i18n/app-i18n';

const EXPIRY_TONE_CLASS: Record<string, string> = {
  unknown: 'bg-semantic-border/60 text-semantic-text-secondary border-semantic-border',
  expired: 'bg-semantic-danger-soft text-semantic-danger-strong border-semantic-danger/30',
  expiring: 'bg-semantic-warning-soft text-semantic-warning-strong border-semantic-warning/30',
  estimated: 'bg-semantic-info-soft text-semantic-info border-semantic-info/30',
  fresh: 'bg-semantic-accent-soft text-semantic-text-primary border-semantic-border',
};

const STORAGE_LABEL_VI: Record<string, string> = {
  fridge: 'Ngăn mát tủ lạnh',
  freezer: 'Ngăn đông đá',
  pantry: 'Tủ đồ khô',
};

const CATEGORY_LABEL_VI: Record<string, string> = {
  vegetable: 'Rau củ',
  meat: 'Thịt',
  egg: 'Trứng',
  seafood: 'Hải sản',
  dairy: 'Sữa / Bơ',
  spice: 'Gia vị',
  grain: 'Gạo / Mì',
  other: 'Khác',
};

type EditDraft = {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  storage: string;
  expiryDate: string;
};
const EMPTY_DRAFT: EditDraft = { name: '', quantity: '', unit: '', category: '', storage: '', expiryDate: '' };

/** The lot an edit draft was opened for. A draft is never submitted elsewhere. */
type DraftOwner = { routeId: string; itemId: string; version: number };

export const IngredientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  // T13R-A P1-3: the route's lot id keys the detail so every draft, baseline
  // and error state is discarded on a same-component route change. A chicken
  // draft cannot survive into the tofu view, let alone be saved there.
  return <LotDetail key={id ?? ''} routeId={id ?? ''} />;
};

const LotDetail: React.FC<{ routeId: string }> = ({ routeId }) => {
  const { l, locale, unitSystem } = useLocaleText();
  const id = routeId || undefined;
  const navigate = useNavigate();
  const errorRef = useRef<HTMLDivElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const wasEditing = useRef(false);
  const quantityUnitRef = useRef('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft>(EMPTY_DRAFT);
  const [editBaseline, setEditBaseline] = useState<EditDraft>(EMPTY_DRAFT);
  const [draftOwner, setDraftOwner] = useState<DraftOwner | null>(null);
  // True while the authoritative reload after a conflict has not succeeded.
  const [refetchFailed, setRefetchFailed] = useState(false);

  useEffect(() => {
    if (actionError) errorRef.current?.focus();
  }, [actionError]);
  useEffect(() => {
    if (editing) nameInputRef.current?.focus();
    else if (wasEditing.current) editButtonRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  // Adopted households read canonical lot truth; the legacy projection is
  // never the source for provenance or expiry semantics.
  const lotQuery = useQuery({
    queryKey: queryKeys.inventoryLot(id ?? ''),
    queryFn: () => api.getInventoryLot(id as string),
    enabled: Boolean(id),
    retry: false,
  });

  const legacyQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
    // Only needed when the household has no lot authority yet.
    enabled: Boolean(id) && lotQuery.isError,
  });

  const lot = lotQuery.data ?? null;
  const legacyItem = lot
    ? null
    : ((legacyQuery.data ?? []).find((entry: any) => entry.id === id) ?? null);
  const item: any = lot ?? legacyItem;

  const mutate = useMutation({
    retry: false,
    // The target is fixed at submit time from the verified draft owner, not
    // re-read from whatever the component happens to display later.
    mutationFn: async ({
      target,
      updates,
    }: {
      target: { id: string; version: number };
      updates: Record<string, unknown>;
    }) => api.updateInventoryItem(target.id, updates, target.version),
    onSuccess: async () => {
      setActionError(null);
      setEditing(false);
      setDraftOwner(null);
      await invalidateInventoryDependents();
      await lotQuery.refetch();
    },
    onError: async (error: unknown) => {
      const code = error instanceof ApiError ? error.code : null;
      const presentation = presentDomainError(
        code,
        l(
          'Chưa cập nhật được nguyên liệu. Vui lòng thử lại.',
          'Could not update this ingredient. Please try again.',
        ),
      );
      if (!presentation.refetch) {
        setActionError(presentation.message);
        return;
      }
      // T13R-B P2-4: a stale/conflict state is only recoverable after the
      // authoritative lot is actually reloaded. React Query swallows refetch
      // failures by default, so the outcome is checked explicitly and the
      // copy never claims "latest state loaded" unless it is. The mutation is
      // never resubmitted here; the user re-saves against the fresh version.
      setActionError(presentation.message);
      await invalidateInventoryDependents();
      const reloaded = await lotQuery.refetch({ throwOnError: false });
      const refreshed = reloaded.status === 'success';
      setRefetchFailed(!refreshed);
      setActionError(presentRefetchOutcome(presentation, refreshed).message);
    },
  });

  const dirty =
    editing &&
    (Object.keys(EMPTY_DRAFT) as (keyof EditDraft)[]).some(
      (key) => draft[key] !== editBaseline[key],
    );
  useEffect(() => {
    if (!dirty && !mutate.isPending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, mutate.isPending]);

  if ((lotQuery.isPending || (lotQuery.isError && legacyQuery.isPending)) && !legacyItem) {
    return (
      <KitchenDetailPage title={l('Chi tiết nguyên liệu', 'Ingredient Details')}>
        <InlineLoading label={l('Đang tải nguyên liệu…', 'Loading ingredient…')} />
      </KitchenDetailPage>
    );
  }

  if (!item) {
    return (
      <KitchenDetailPage title={l('Chi tiết nguyên liệu', 'Ingredient Details')}>
        <div className="p-6 text-center">
          {legacyQuery.isError ? (
            <InlineError error={legacyQuery.error} onRetry={() => void legacyQuery.refetch()} />
          ) : (
            <p className="text-xs text-semantic-text-muted">
              {l('Không tìm thấy nguyên liệu này trong tủ.', 'This ingredient was not found in your fridge.')}
            </p>
          )}
          <Button className="mt-4" onClick={() => navigate('/fridge')}>
            {l('Về tủ lạnh', 'Back to fridge')}
          </Button>
        </div>
      </KitchenDetailPage>
    );
  }

  const expiry = presentExpiry(item);
  const status =
    item.freshness === 'out_of_stock'
      ? 'out_of_stock'
      : expiry.tone === 'unknown'
        ? 'unknown'
        : expiry.tone === 'estimated'
          ? 'estimated'
          : item.freshness;
  const matchingRecipes = ALL_RECIPES.filter((recipe) =>
    recipe.ingredients.some(
      (ingredient) =>
        ingredient.ingredientId === item.ingredientId ||
        ingredient.name.toLowerCase() === String(item.name).toLowerCase(),
    ),
  );
  const displayName = localizeIngredientName(item.ingredientId, item.name, locale);
  const storageDisplay = item.storage
    ? locale === 'vi'
      ? (STORAGE_LABEL_VI[item.storage] ?? item.storage)
      : localizeStorageZone(item.storage, locale)
    : l('Chưa rõ vị trí', 'Storage unknown');

  const startEdit = () => {
    setActionError(null);
    setRefetchFailed(false);
    const initialDraft = {
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      category: item.category ?? 'other',
      storage: item.storage ?? 'fridge',
      expiryDate: expiry.date ?? '',
    };
    quantityUnitRef.current = initialDraft.unit;
    setDraft(initialDraft);
    setEditBaseline(initialDraft);
    setDraftOwner({ routeId, itemId: String(item.id), version: Number(item.version) });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftOwner(null);
  };

  const submitDraft = () => {
    // Draft owner == current route == current authoritative item, or no
    // mutation at all. Any mismatch means the draft belongs to another lot.
    if (!draftOwner || draftOwner.routeId !== routeId || String(item.id) !== draftOwner.itemId) {
      setEditing(false);
      setDraftOwner(null);
      setDraft(EMPTY_DRAFT);
      setEditBaseline(EMPTY_DRAFT);
      setActionError(
        l(
          'Bản chỉnh sửa thuộc nguyên liệu khác nên chưa được lưu. Vui lòng mở lại và sửa trên nguyên liệu này.',
          'This edit draft belonged to a different item and was not saved. Please reopen and edit this item again.',
        ),
      );
      return;
    }
    const quantity = Number(draft.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) {
      setActionError(
        l(
          'Nhập lượng còn thực tế lớn hơn 0 và không quá 10.000 theo đơn vị đã chọn.',
          'Enter an actual remaining quantity greater than 0 and up to 10,000 in the selected unit.',
        ),
      );
      return;
    }
    const baselineQuantity = convertedInventoryQuantity(Number(editBaseline.quantity), editBaseline.unit, draft.unit)
      ?? Number(editBaseline.quantity);
    const correctingQuantity = quantity !== baselineQuantity;
    const changingMeasurement = correctingQuantity || draft.unit !== editBaseline.unit;
    if (changingMeasurement && Number(item.version) !== draftOwner.version) {
      setActionError(
        l(
          'Nguyên liệu đã đổi trong lúc bạn sửa lượng hoặc đơn vị. Chọn “Hủy”, kiểm tra lượng mới rồi mở lại chỉnh sửa.',
          'This item changed while you were editing its quantity or unit. Select “Cancel”, check the updated amount, and reopen edit.',
        ),
      );
      return;
    }
    const updates: Record<string, unknown> = {};
    if (correctingQuantity) updates.quantity = quantity;
    // Refetches must not turn untouched draft fields into corrections.
    if (draft.name.trim() !== editBaseline.name.trim()) updates.name = draft.name.trim();
    if (draft.unit !== editBaseline.unit) updates.unit = draft.unit;
    if (draft.category !== editBaseline.category) updates.category = draft.category;
    if (draft.expiryDate !== editBaseline.expiryDate) {
      updates.expiryDate = draft.expiryDate || null;
      // The date picker is an explicit dated fact, so the correction
      // establishes KNOWN expiry rather than another estimate.
      updates.expiryEstimated = false;
    }
    if (draft.storage !== editBaseline.storage) updates.storage = draft.storage;
    if (Object.keys(updates).length === 0) {
      cancelEdit();
      return;
    }
    mutate.mutate({ target: { id: String(item.id), version: changingMeasurement ? draftOwner.version : Number(item.version) }, updates });
  };

  return (
    <KitchenDetailPage
      title={l('Chi tiết nguyên liệu', 'Ingredient Details')}
      description={l(
        'Kiểm tra lượng đang có, hạn dùng và thông tin của lô trước khi chỉnh sửa.',
        'Review current quantity, expiry date, and lot provenance before editing.',
      )}
    >
      <div className="stock-summary bg-white rounded-xl p-4 flex items-center gap-4 border border-semantic-border shadow-xs">
        <div className="w-16 h-16 rounded-xl bg-semantic-background-subtle border border-semantic-border/70 flex items-center justify-center p-2 overflow-hidden shrink-0">
          <img
            src={getIngredientImage(item.ingredientId, item.name)}
            alt=""
            width={64}
            height={64}
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-heading font-bold text-xl text-semantic-text-primary leading-tight">
              {displayName}
            </h2>
            <StatusChip status={status} />
          </div>
          <p className="stock-quantity">
            {locale === 'vi'
              ? `${item.quantity} ${item.unit}`
              : formatLocalizedMeasure(Number(item.quantity), String(item.unit), locale, unitSystem)}
          </p>
        </div>
      </div>

      {actionError && (
        <div
          ref={errorRef}
          tabIndex={-1}
          className="text-xs text-semantic-danger-strong bg-semantic-danger-soft border border-semantic-danger/30 rounded-xl px-3 py-2 font-medium space-y-2"
          role="alert"
          data-refetch-state={refetchFailed ? 'failed' : 'ok'}
        >
          <p>{actionError}</p>
          {refetchFailed && (
            <button
              type="button"
              className="underline font-semibold tap-target"
              disabled={lotQuery.isFetching}
              onClick={async () => {
                // Explicit read-only reload; still no mutation retry.
                const reloaded = await lotQuery.refetch({ throwOnError: false });
                if (reloaded.status === 'success') {
                  setRefetchFailed(false);
                  setActionError(null);
                }
              }}
            >
              {lotQuery.isFetching
                ? l('Đang tải lại…', 'Reloading…')
                : l('Tải lại trạng thái mới nhất', 'Reload latest state')}
            </button>
          )}
        </div>
      )}

      <div className="stock-facts">
        <div className="bg-white rounded-xl p-3.5 border border-semantic-border shadow-xs">
          <div className="flex items-center gap-1.5 text-semantic-text-muted mb-1">
            <Layers aria-hidden="true" className="w-4 h-4 text-semantic-action-primary" />
            <span className="text-[11px] font-semibold">{l('Vị trí', 'Storage')}</span>
          </div>
          <p className="font-heading font-semibold text-sm text-semantic-text-primary">
            {storageDisplay}
          </p>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-semantic-border shadow-xs">
          <div className="flex items-center gap-1.5 text-semantic-text-muted mb-1">
            <Calendar aria-hidden="true" className="w-4 h-4 text-semantic-action-primary" />
            <span className="text-[11px] font-semibold">{l('Hạn sử dụng', 'Expiry date')}</span>
          </div>
          <p
            className={clsx(
              'font-heading font-semibold text-xs px-2 py-1 rounded-lg border inline-block',
              EXPIRY_TONE_CLASS[expiry.tone],
            )}
            data-testid="lot-expiry"
          >
            {expiry.label}
          </p>
        </div>
      </div>

      {lot && (
        <div className="stock-provenance bg-white rounded-xl p-3.5 border border-semantic-border shadow-xs space-y-2">
          <div className="flex items-center gap-1.5 text-semantic-text-muted">
            <Receipt aria-hidden="true" className="w-4 h-4 text-semantic-action-primary" />
            <span className="text-[11px] font-semibold">{l('Nguồn gốc & lô', 'Source & lot')}</span>
          </div>
          <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
            <dt className="text-semantic-text-muted">{l('Nguồn', 'Source')}</dt>
            <dd
              className="text-semantic-text-primary font-semibold text-right"
              data-testid="lot-provenance"
            >
              {provenanceLabel(lot.dataSource)}
            </dd>
            <dt className="text-semantic-text-muted">{l('Ngày mua', 'Purchased')}</dt>
            <dd className="text-semantic-text-primary font-semibold text-right">
              {presentPurchaseDate(lot.purchasedAt)}
            </dd>
            <dt className="text-semantic-text-muted">{l('Trạng thái mở', 'Opened state')}</dt>
            <dd
              className="text-semantic-text-primary font-semibold text-right"
              data-testid="lot-opened"
            >
              {presentOpenedState(lot.openedAt)}
            </dd>
            <dt className="text-semantic-text-muted">{l('Mã lô', 'Lot ID')}</dt>
            <dd className="text-semantic-text-primary font-mono text-[10px] text-right break-all">
              {lot.lotId}
            </dd>
            <dt className="text-semantic-text-muted">{l('Phiên bản lô', 'Lot version')}</dt>
            <dd className="text-semantic-text-primary font-semibold text-right">
              v{lot.lotVersion}
            </dd>
          </dl>
        </div>
      )}

      {!editing ? (
        <button
          ref={editButtonRef}
          type="button"
          onClick={startEdit}
          className="stock-edit-trigger flex items-center justify-center gap-2"
        >
          <PackageOpen aria-hidden="true" className="w-4 h-4 text-semantic-action-primary" />
          <span>{l('Sửa thông tin nguyên liệu', 'Edit ingredient details')}</span>
        </button>
      ) : (
        <form
          className="bg-white rounded-xl p-4 border border-semantic-border shadow-xs space-y-3"
          data-draft-owner={draftOwner?.itemId ?? ''}
          onSubmit={(event) => {
            event.preventDefault();
            submitDraft();
          }}
        >
          <fieldset disabled={mutate.isPending} className="stock-editor">
            <legend>{l('Chỉnh sửa thông tin', 'Edit details')}</legend>
            <p className="text-semantic-text-secondary">
              {l(
                'Thay đổi chỉ được lưu khi bạn chọn “Lưu thay đổi”. Rời trang hoặc chọn “Hủy” sẽ bỏ bản chỉnh sửa.',
                'Changes are only saved when you select “Save changes”. Leaving this page or selecting “Cancel” discards your edits.',
              )}
            </p>
            <div>
              <label
                htmlFor="lot-name-input"
                className="block text-xs font-semibold text-semantic-text-secondary mb-1"
              >
                {l('Tên nguyên liệu', 'Ingredient name')}
              </label>
              <input
                ref={nameInputRef}
                id="lot-name-input"
                name="name"
                autoComplete="off"
                required
                maxLength={100}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-semantic-border text-sm font-medium text-semantic-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-semantic-focus focus:border-semantic-action-primary"
              />
            </div>
            <div>
              <label htmlFor="lot-quantity-input" className="block text-xs font-semibold text-semantic-text-secondary mb-1">
                {l('Lượng còn thực tế', 'Actual remaining quantity')}
              </label>
              <input
                id="lot-quantity-input"
                name="quantity"
                type="number"
                inputMode="decimal"
                min="0"
                max="10000"
                step="any"
                required
                value={draft.quantity}
                onChange={(event) => {
                  quantityUnitRef.current = draft.unit;
                  setDraft({ ...draft, quantity: event.target.value });
                }}
                aria-describedby="lot-quantity-note"
                className="w-full h-11 px-3 rounded-xl border border-semantic-border text-sm font-medium text-semantic-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-semantic-focus focus:border-semantic-action-primary"
              />
              <p id="lot-quantity-note" className="mt-1 text-xs text-semantic-text-secondary">
                {l(
                  'Nhập lượng bạn vừa kiểm tra, ví dụ 0,5 kg hoặc 250 g.',
                  'Enter the amount you just checked, e.g. 0.5 kg or 250 g.',
                )}
                {draft.unit !== editBaseline.unit &&
                  l(
                    ' Kiểm tra lại lượng theo đơn vị mới trước khi lưu.',
                    ' Double-check the quantity in the new unit before saving.',
                  )}
              </p>
            </div>
            <div className="stock-editor-grid">
              <div>
                <label
                  htmlFor="lot-unit-input"
                  className="block text-xs font-semibold text-semantic-text-secondary mb-1"
                >
                  {l('Đơn vị', 'Unit')}
                </label>
                <select
                  id="lot-unit-input"
                  name="unit"
                  value={draft.unit}
                  onChange={(event) => {
                    const unit = event.target.value;
                    // Retain the last measured unit across an incompatible selection.
                    const converted = convertedInventoryQuantity(Number(draft.quantity), quantityUnitRef.current, unit);
                    if (converted !== null) quantityUnitRef.current = unit;
                    setDraft({ ...draft, unit, quantity: converted === null ? draft.quantity : String(converted) });
                  }}
                  className="w-full h-11 px-3 rounded-xl border border-semantic-border text-sm font-medium text-semantic-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-semantic-focus focus:border-semantic-action-primary"
                >
                  <option value="g">{l('gam (g)', 'grams (g)')}</option>
                  <option value="kg">kg</option>
                  <option value="piece">{l('quả / củ / bìa / miếng', 'piece / whole')}</option>
                  <option value="bunch">{l('bó', 'bunch')}</option>
                  <option value="pack">{l('gói / hộp', 'pack / box')}</option>
                  <option value="slice">{l('lát', 'slice')}</option>
                  <option value="ml">ml</option>
                  <option value="l">{l('lít', 'liter (L)')}</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="lot-category-input"
                  className="block text-xs font-semibold text-semantic-text-secondary mb-1"
                >
                  {l('Danh mục', 'Category')}
                </label>
                <select
                  id="lot-category-input"
                  name="category"
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-semantic-border text-sm font-medium text-semantic-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-semantic-focus focus:border-semantic-action-primary"
                >
                  {!Object.hasOwn(CATEGORY_LABEL_VI, editBaseline.category) && (
                    <option value={editBaseline.category}>
                      {locale === 'vi'
                        ? editBaseline.category
                        : localizeDisplayCategory(editBaseline.category, locale)}
                    </option>
                  )}
                  {Object.entries(CATEGORY_LABEL_VI).map(([value, viLabel]) => (
                    <option key={value} value={value}>
                      {locale === 'vi' ? viLabel : localizeDisplayCategory(value, locale)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label
                htmlFor="lot-expiry-input"
                className="block text-xs font-semibold text-semantic-text-secondary mb-1"
              >
                {l('Hạn sử dụng chính xác', 'Exact expiry date')}
              </label>
              <input
                id="lot-expiry-input"
                name="expiry"
                autoComplete="off"
                type="date"
                value={draft.expiryDate}
                onChange={(event) => setDraft({ ...draft, expiryDate: event.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-semantic-border text-sm font-medium text-semantic-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-semantic-focus focus:border-semantic-action-primary"
              />
              <p className="text-[11px] text-semantic-text-muted mt-1">
                {l(
                  'Ngày bạn chọn được lưu là hạn dùng đã biết chắc chắn.',
                  'The date you pick is saved as a confirmed expiry date.',
                )}
              </p>
            </div>
            <div>
              <label
                htmlFor="lot-storage-input"
                className="block text-xs font-semibold text-semantic-text-secondary mb-1"
              >
                {l('Chuyển vị trí bảo quản', 'Move storage location')}
              </label>
              <select
                id="lot-storage-input"
                name="storage"
                value={draft.storage}
                onChange={(event) => setDraft({ ...draft, storage: event.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-semantic-border text-sm font-medium text-semantic-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-semantic-focus focus:border-semantic-action-primary"
              >
                <option value="fridge">{l('Ngăn mát', localizeStorageZone('fridge', locale))}</option>
                <option value="freezer">{l('Ngăn đông', localizeStorageZone('freezer', locale))}</option>
                <option value="pantry">{l('Tủ đồ khô', localizeStorageZone('pantry', locale))}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" fullWidth disabled={mutate.isPending || !draft.name.trim()}>
                {mutate.isPending ? l('Đang lưu…', 'Saving…') : l('Lưu thay đổi', 'Save changes')}
              </Button>
              <Button type="button" variant="outline" onClick={cancelEdit}>
                {l('Hủy', 'Cancel')}
              </Button>
            </div>
          </fieldset>
        </form>
      )}

      <div className="pt-2">
        <h3 className="font-heading font-bold text-base text-semantic-text-primary flex items-center gap-1.5 mb-3">
          <ChefHat aria-hidden="true" className="w-4 h-4 text-semantic-action-primary" />
          <span>
            {l(
              `Món có nguyên liệu này (${matchingRecipes.length})`,
              `Recipes using this ingredient (${matchingRecipes.length})`,
            )}
          </span>
        </h3>

        <p className="stock-recipe-note">
          {l(
            'Đây là các món có dùng nguyên liệu này. Mở từng món để kiểm tra lượng cần, nguyên liệu còn thiếu và cách nấu.',
            'These recipes use this ingredient. Open any recipe to check required amounts, missing items, and steps.',
          )}
        </p>
        {matchingRecipes.length === 0 && (
          <div className="stock-recipe-note space-y-2">
            <p>{l('Chưa có món liên quan trong danh sách này.', 'No related recipes found in the catalog yet.')}</p>
            <Link to="/recipes" className="min-h-[44px] inline-flex items-center font-semibold text-semantic-action-primary underline underline-offset-4">
              {l('Khám phá món ăn', 'Explore recipes')}
            </Link>
          </div>
        )}
        <div className="space-y-2.5">
          {matchingRecipes.map((recipe) => {
            const recipeTitle = localizeRecipeTitle(recipe, locale);
            return (
              <Link
                key={recipe.id}
                to={`/recipes/${recipe.slug}`}
                aria-label={recipeTitle}
                className="stock-recipe-link bg-white rounded-xl p-3 flex items-center gap-3.5 border border-semantic-border shadow-xs cursor-pointer hover:border-semantic-border-strong active:scale-[0.99] transition-tap"
              >
                <img
                  src={resolveRecipeImage(recipe).src}
                  alt=""
                  width={56}
                  height={56}
                  className="w-14 h-14 rounded-lg object-cover shrink-0 border border-semantic-border/70"
                  loading="lazy"
                  onError={recipeImageErrorHandler(resolveRecipeImage(recipe).fallbackSrc)}
                />
                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-semantic-accent-soft text-semantic-text-primary border border-semantic-border uppercase">
                    {locale === 'vi'
                      ? recipe.cuisine === 'vietnamese'
                        ? 'Món Việt'
                        : recipe.cuisine
                      : localizeCuisine(recipe.cuisine, locale)}
                  </span>
                  <h4 className="font-heading font-semibold text-sm text-semantic-text-primary line-clamp-2 mt-1">
                    {recipeTitle}
                  </h4>
                  <span className="inline-flex items-center gap-1 text-xs text-semantic-text-muted mt-0.5">
                    <Clock aria-hidden="true" className="w-3 h-3 text-semantic-text-muted shrink-0" />
                    <span>{l(`${recipe.cookTimeMinutes} phút`, `${recipe.cookTimeMinutes} min`)}</span>
                  </span>
                </div>
                <ArrowRight aria-hidden="true" className="w-4 h-4 text-semantic-text-muted shrink-0" />
              </Link>
            );
          })}
        </div>
      </div>
    </KitchenDetailPage>
  );
};
