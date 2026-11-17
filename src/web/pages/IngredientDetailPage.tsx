import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Clock,
  ChefHat,
  Calendar,
  Layers,
  ArrowRight,
  PackageOpen,
  Receipt,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { ALL_RECIPES } from '@frigo/recipes';
import { KitchenDetailPage } from '../components/common/KitchenDetailPage';
import { StatusChip } from '../components/common/StatusChip';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { InlineLoading, InlineError } from '../components/common/AsyncState';
import {
  resolveCategoryIcon,
  resolveStorageZoneBadge,
} from '../components/common/IngredientRow';
import { AtelierBadge } from '../design-system/v4/AtelierPrimitives';
import { FreshnessShieldIcon } from '../design-system/icons';
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
import { convertedInventoryQuantity } from '../lib/inventory-quantity';
import { getIngredientImage } from '../lib/ingredient-images';
import {
  resolveRecipeImage,
  resolveRecipeImageV4,
  recipeImageErrorHandler,
} from '../lib/recipe-media';

const EXPIRY_TONE_CLASS: Record<string, string> = {
  unknown: 'bg-tk-sunken text-tk-secondary border-tk-stone',
  expired: 'bg-tk-berry-soft text-tk-berry-deep border-tk-berry/30',
  expiring: 'bg-tk-turmeric-soft text-tk-turmeric-deep border-tk-turmeric/35',
  estimated: 'bg-tk-ocean-soft text-tk-ocean border-tk-ocean/30',
  fresh: 'bg-tk-jade-soft text-tk-jade-deep border-tk-jade/30',
};

const STORAGE_LABEL: Record<string, string> = {
  fridge: 'Ngăn mát tủ lạnh',
  freezer: 'Ngăn đông đá',
  pantry: 'Tủ đồ khô',
};

const CATEGORY_LABEL: Record<string, string> = {
  vegetable: 'Rau củ',
  meat: 'Thịt',
  seafood: 'Hải sản',
  egg: 'Trứng',
  dairy: 'Sữa / Bơ',
  fruit: 'Trái cây',
  grain: 'Ngũ cốc & Đồ khô',
  spice: 'Gia vị',
  spice_sauce: 'Gia vị & Sốt',
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

const EMPTY_DRAFT: EditDraft = {
  name: '',
  quantity: '',
  unit: '',
  category: '',
  storage: '',
  expiryDate: '',
};

/** The lot an edit draft was opened for. A draft is never submitted elsewhere. */
type DraftOwner = { routeId: string; itemId: string; version: number };

export const IngredientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <LotDetail key={id ?? ''} routeId={id ?? ''} />;
};

const LotDetail: React.FC<{ routeId: string }> = ({ routeId }) => {
  const id = routeId || undefined;
  const navigate = useNavigate();
  const errorRef = useRef<HTMLDivElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const wasEditing = useRef(false);
  const quantityUnitRef = useRef('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [draft, setDraft] = useState<EditDraft>(EMPTY_DRAFT);
  const [editBaseline, setEditBaseline] = useState<EditDraft>(EMPTY_DRAFT);
  const [draftOwner, setDraftOwner] = useState<DraftOwner | null>(null);
  const [refetchFailed, setRefetchFailed] = useState(false);

  useEffect(() => {
    if (actionError) errorRef.current?.focus();
  }, [actionError]);

  useEffect(() => {
    if (editing) nameInputRef.current?.focus();
    else if (wasEditing.current) editButtonRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const lotQuery = useQuery({
    queryKey: queryKeys.inventoryLot(id ?? ''),
    queryFn: () => api.getInventoryLot(id as string),
    enabled: Boolean(id),
    retry: false,
  });

  const legacyQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
    enabled: Boolean(id) && lotQuery.isError,
  });

  const lot = lotQuery.data ?? null;
  const legacyItem = lot
    ? null
    : ((legacyQuery.data ?? []).find((entry: any) => entry.id === id) ?? null);
  const item: any = lot ?? legacyItem;

  // Query related recipes cleanly via /recipe-discovery?q=... when available, with ALL_RECIPES fallback
  const canQueryDiscovery = typeof api.getRecipeDiscovery === 'function' && Boolean(item?.name);
  const relatedDiscoveryQuery = useQuery({
    queryKey: queryKeys.recipeDiscovery({ q: String(item?.name ?? ''), pageSize: 6 }),
    queryFn: async () => {
      if (typeof api.getRecipeDiscovery !== 'function' || !item?.name) return null;
      try {
        return await api.getRecipeDiscovery({ q: String(item.name), pageSize: 6 });
      } catch {
        return null;
      }
    },
    enabled: canQueryDiscovery,
    staleTime: 60_000,
    retry: false,
  });

  const handleMutationConflictError = async (error: unknown, fallbackMessage: string) => {
    const code = error instanceof ApiError ? error.code : null;
    const presentation = presentDomainError(code, fallbackMessage);
    if (!presentation.refetch) {
      setActionError(presentation.message);
      return;
    }
    setActionError(presentation.message);
    await invalidateInventoryDependents();
    const reloaded = await lotQuery.refetch({ throwOnError: false });
    const refreshed = reloaded.status === 'success';
    setRefetchFailed(!refreshed);
    setActionError(presentRefetchOutcome(presentation, refreshed).message);
  };

  const mutate = useMutation({
    retry: false,
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
    onError: (error: unknown) =>
      handleMutationConflictError(
        error,
        'Chưa cập nhật được nguyên liệu. Vui lòng thử lại.',
      ),
  });

  const deleteLot = useMutation({
    retry: false,
    mutationFn: async (target: { id: string; version: number }) => {
      if (typeof api.deleteInventoryItem !== 'function') {
        throw new ApiError('http', 'Delete unavailable', 501);
      }
      return api.deleteInventoryItem(target.id, target.version);
    },
    onSuccess: async () => {
      setActionError(null);
      setConfirmDeleteOpen(false);
      await invalidateInventoryDependents();
      navigate('/fridge');
    },
    onError: async (error: unknown) => {
      setConfirmDeleteOpen(false);
      await handleMutationConflictError(
        error,
        'Chưa xóa được lô thực phẩm. Vui lòng thử lại.',
      );
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
      <KitchenDetailPage title="Chi tiết nguyên liệu">
        <InlineLoading label="Đang tải nguyên liệu…" />
      </KitchenDetailPage>
    );
  }

  if (!item) {
    return (
      <KitchenDetailPage title="Chi tiết nguyên liệu">
        <div className="rounded-[24px] border border-tk-stone/85 bg-white p-6 text-center shadow-card">
          {legacyQuery.isError ? (
            <InlineError error={legacyQuery.error} onRetry={() => void legacyQuery.refetch()} />
          ) : (
            <p className="text-sm text-tk-secondary">Không tìm thấy nguyên liệu này trong tủ.</p>
          )}
          <Button className="mt-4" onClick={() => navigate('/fridge')}>
            Về tủ lạnh
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

  const catMeta = resolveCategoryIcon(item.category);
  const zoneMeta = resolveStorageZoneBadge(item.storage);
  const CategoryIcon = catMeta.Icon;
  const ZoneIcon = zoneMeta.Icon;

  // Compute Freshness Timeline Bar metrics honestly
  const daysRemaining =
    expiry.date === null
      ? null
      : Math.ceil((new Date(expiry.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const timelinePercent =
    daysRemaining === null
      ? 30
      : daysRemaining <= 0
        ? 100
        : Math.max(15, Math.min(100, Math.round(100 - (daysRemaining / 12) * 85)));

  // Merge discovery API hits with static ALL_RECIPES fallback (deduplicated by slug)
  const staticMatching = ALL_RECIPES.filter((recipe) =>
    recipe.ingredients.some(
      (ingredient) =>
        ingredient.ingredientId === item.ingredientId ||
        ingredient.name.toLowerCase() === String(item.name).toLowerCase(),
    ),
  );
  const discoveryItems = (relatedDiscoveryQuery.data?.items ?? []).map((entry) => entry.recipe);
  const seenSlugs = new Set<string>();
  const matchingRecipes = [...discoveryItems, ...staticMatching].filter((recipe) => {
    if (!recipe?.slug || seenSlugs.has(recipe.slug)) return false;
    seenSlugs.add(recipe.slug);
    return true;
  });

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
    if (!draftOwner || draftOwner.routeId !== routeId || String(item.id) !== draftOwner.itemId) {
      setEditing(false);
      setDraftOwner(null);
      setDraft(EMPTY_DRAFT);
      setEditBaseline(EMPTY_DRAFT);
      setActionError(
        'Bản chỉnh sửa thuộc nguyên liệu khác nên chưa được lưu. Vui lòng mở lại và sửa trên nguyên liệu này.',
      );
      return;
    }
    const quantity = Number(draft.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) {
      setActionError('Nhập lượng còn thực tế lớn hơn 0 và không quá 10.000 theo đơn vị đã chọn.');
      return;
    }
    const baselineQuantity =
      convertedInventoryQuantity(Number(editBaseline.quantity), editBaseline.unit, draft.unit) ??
      Number(editBaseline.quantity);
    const correctingQuantity = quantity !== baselineQuantity;
    const changingMeasurement = correctingQuantity || draft.unit !== editBaseline.unit;
    if (changingMeasurement && Number(item.version) !== draftOwner.version) {
      setActionError(
        'Nguyên liệu đã đổi trong lúc bạn sửa lượng hoặc đơn vị. Chọn “Hủy”, kiểm tra lượng mới rồi mở lại chỉnh sửa.',
      );
      return;
    }
    const updates: Record<string, unknown> = {};
    if (correctingQuantity) updates.quantity = quantity;
    if (draft.name.trim() !== editBaseline.name.trim()) updates.name = draft.name.trim();
    if (draft.unit !== editBaseline.unit) updates.unit = draft.unit;
    if (draft.category !== editBaseline.category) updates.category = draft.category;
    if (draft.expiryDate !== editBaseline.expiryDate) {
      updates.expiryDate = draft.expiryDate || null;
      updates.expiryEstimated = false;
    }
    if (draft.storage !== editBaseline.storage) updates.storage = draft.storage;
    if (Object.keys(updates).length === 0) {
      cancelEdit();
      return;
    }
    mutate.mutate({
      target: {
        id: String(item.id),
        version: changingMeasurement ? draftOwner.version : Number(item.version),
      },
      updates,
    });
  };

  return (
    <KitchenDetailPage
      title="Chi tiết nguyên liệu"
      description="Kiểm tra lượng đang có, dòng thời gian hạn dùng FEFO và nguồn gốc lô trước khi chỉnh sửa."
    >
      {/* 1. LOT SUMMARY HERO CARD */}
      <div className="stock-summary rounded-[24px] border border-tk-stone/85 !border-t-4 !border-t-tk-flame bg-white p-5 flex items-start gap-4 shadow-card">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-tk-stone/75 bg-tk-sunken/70 p-2">
          <img
            src={getIngredientImage(item.ingredientId, item.name)}
            alt=""
            width={64}
            height={64}
            className="h-full w-full object-contain"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-tk-stone bg-white shadow-xs"
          >
            <CategoryIcon size={14} tone={catMeta.tone} active />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="font-heading font-extrabold text-xl text-tk-ink leading-tight">
              {item.name}
            </h2>
            <StatusChip status={status} />
          </div>
          <p className="stock-quantity !text-tk-jade font-extrabold tk-tabular">
            {item.quantity} {item.unit}
          </p>
        </div>
      </div>

      {actionError && (
        <div
          ref={errorRef}
          tabIndex={-1}
          className="rounded-2xl border border-tk-berry/30 bg-tk-berry-soft px-4 py-3 text-xs font-semibold text-tk-berry-deep space-y-2"
          role="alert"
          data-refetch-state={refetchFailed ? 'failed' : 'ok'}
        >
          <p>{actionError}</p>
          {refetchFailed && (
            <button
              type="button"
              className="underline font-extrabold tap-target cursor-pointer"
              disabled={lotQuery.isFetching}
              onClick={async () => {
                const reloaded = await lotQuery.refetch({ throwOnError: false });
                if (reloaded.status === 'success') {
                  setRefetchFailed(false);
                  setActionError(null);
                }
              }}
            >
              {lotQuery.isFetching ? 'Đang tải lại…' : 'Tải lại trạng thái mới nhất'}
            </button>
          )}
        </div>
      )}

      {/* 2. STORAGE ZONE, EXPIRY & FRESHNESS TIMELINE BAR */}
      <div className="stock-facts">
        <div className="rounded-2xl border border-tk-stone/85 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-tk-muted mb-1.5">
            <Layers aria-hidden="true" className="w-4 h-4 text-tk-jade" />
            <span className="text-xs font-bold">Vị trí bảo quản</span>
          </div>
          <p className="flex items-center gap-2 font-heading font-extrabold text-sm text-tk-ink">
            <ZoneIcon size={18} tone={zoneMeta.tone} active />
            <span>{STORAGE_LABEL[item.storage] ?? item.storage ?? 'Chưa rõ vị trí'}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-tk-stone/85 bg-white p-4 shadow-xs space-y-2.5">
          <div className="flex items-center gap-1.5 text-tk-muted">
            <Calendar aria-hidden="true" className="w-4 h-4 text-tk-jade" />
            <span className="text-xs font-bold">Hạn sử dụng &amp; Nhịp FEFO</span>
          </div>
          <p
            className={clsx(
              'font-heading font-extrabold text-xs px-2.5 py-1 rounded-xl border inline-block tk-tabular',
              EXPIRY_TONE_CLASS[expiry.tone],
            )}
            data-testid="lot-expiry"
          >
            {expiry.label}
          </p>
          {/* Honest Freshness Timeline Bar */}
          <div aria-hidden="true" className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-tk-sunken">
              <span
                className={clsx(
                  'block h-full rounded-full transition-opacity',
                  expiry.tone === 'unknown'
                    ? 'bg-tk-stone'
                    : expiry.tone === 'expired'
                      ? 'bg-tk-berry'
                      : expiry.tone === 'expiring'
                        ? 'bg-tk-flame'
                        : 'bg-tk-jade',
                )}
                style={{ width: `${timelinePercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. LOT FEFO PROVENANCE CARD */}
      {lot && (
        <div className="stock-provenance rounded-2xl border border-tk-stone/85 bg-white p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-tk-muted">
              <Receipt aria-hidden="true" className="w-4 h-4 text-tk-jade" />
              <span className="text-xs font-extrabold text-tk-ink">Nguồn gốc &amp; Hồ sơ lô FEFO</span>
            </div>
            <AtelierBadge tone="jade" icon={<FreshnessShieldIcon size={12} tone="jade" active />}>
              Lot Truth
            </AtelierBadge>
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-xs">
            <dt className="text-tk-muted">Nguồn ghi nhận</dt>
            <dd
              className="text-tk-ink font-bold text-right"
              data-testid="lot-provenance"
            >
              {provenanceLabel(lot.dataSource)}
            </dd>
            <dt className="text-tk-muted">Ngày mua</dt>
            <dd className="text-tk-ink font-bold text-right tk-tabular">
              {presentPurchaseDate(lot.purchasedAt)}
            </dd>
            <dt className="text-tk-muted">Trạng thái mở</dt>
            <dd
              className="text-tk-ink font-bold text-right tk-tabular"
              data-testid="lot-opened"
            >
              {presentOpenedState(lot.openedAt)}
            </dd>
            <dt className="text-tk-muted">Mã lô</dt>
            <dd className="text-tk-ink font-mono text-[11px] text-right break-all">
              {lot.lotId}
            </dd>
            <dt className="text-tk-muted">Phiên bản lô</dt>
            <dd className="text-tk-ink font-bold text-right tk-tabular">
              v{lot.lotVersion}
            </dd>
          </dl>
        </div>
      )}

      {/* 4. INLINE EDIT & DELETE LOT ACTIONS */}
      {!editing ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            ref={editButtonRef}
            type="button"
            onClick={startEdit}
            className="stock-edit-trigger !rounded-2xl !border-tk-stone/90 !bg-white hover:!bg-tk-sunken flex items-center justify-center gap-2 text-tk-ink font-extrabold shadow-xs transition-colors cursor-pointer"
          >
            <PackageOpen aria-hidden="true" className="w-4 h-4 text-tk-jade" />
            <span>Sửa thông tin nguyên liệu</span>
          </button>

          <button
            type="button"
            disabled={deleteLot.isPending}
            onClick={() => setConfirmDeleteOpen(true)}
            data-testid="delete-lot-trigger"
            className="flex items-center justify-center gap-2 rounded-2xl border border-tk-berry/25 bg-tk-berry-soft px-4 py-3 text-sm font-extrabold text-tk-berry-deep shadow-xs transition-colors hover:bg-tk-berry hover:text-white disabled:opacity-60 cursor-pointer"
          >
            <Trash2 aria-hidden="true" className="w-4 h-4" />
            <span>Xóa / Hủy lô thực phẩm</span>
          </button>
        </div>
      ) : (
        <form
          className="rounded-[24px] border border-tk-stone/85 bg-white p-5 shadow-card space-y-3.5"
          data-draft-owner={draftOwner?.itemId ?? ''}
          onSubmit={(event) => {
            event.preventDefault();
            submitDraft();
          }}
        >
          <fieldset disabled={mutate.isPending} className="stock-editor">
            <legend className="font-heading font-extrabold text-tk-ink">Chỉnh sửa thông tin</legend>
            <p className="text-tk-secondary">
              Thay đổi chỉ được lưu khi bạn chọn “Lưu thay đổi”. Rời trang hoặc chọn “Hủy” sẽ bỏ bản
              chỉnh sửa.
            </p>
            <div>
              <label
                htmlFor="lot-name-input"
                className="block text-xs font-bold text-tk-secondary mb-1"
              >
                Tên nguyên liệu
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
                className="w-full h-11 px-3.5 rounded-xl border border-tk-stone text-sm font-semibold text-tk-ink bg-white focus:outline-none focus:ring-2 focus:ring-tk-jade/20 focus:border-tk-jade"
              />
            </div>
            <div>
              <label
                htmlFor="lot-quantity-input"
                className="block text-xs font-bold text-tk-secondary mb-1"
              >
                Lượng còn thực tế
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
                className="w-full h-11 px-3.5 rounded-xl border border-tk-stone text-sm font-semibold text-tk-ink bg-white focus:outline-none focus:ring-2 focus:ring-tk-jade/20 focus:border-tk-jade tk-tabular"
              />
              <p id="lot-quantity-note" className="mt-1 text-xs text-tk-secondary">
                Nhập lượng bạn vừa kiểm tra, ví dụ 0,5 kg hoặc 250 g.
                {draft.unit !== editBaseline.unit &&
                  ' Kiểm tra lại lượng theo đơn vị mới trước khi lưu.'}
              </p>
            </div>
            <div className="stock-editor-grid">
              <div>
                <label
                  htmlFor="lot-unit-input"
                  className="block text-xs font-bold text-tk-secondary mb-1"
                >
                  Đơn vị
                </label>
                <select
                  id="lot-unit-input"
                  name="unit"
                  value={draft.unit}
                  onChange={(event) => {
                    const nextUnit = event.target.value;
                    const converted = convertedInventoryQuantity(
                      Number(draft.quantity),
                      quantityUnitRef.current,
                      nextUnit,
                    );
                    if (converted !== null) quantityUnitRef.current = nextUnit;
                    setDraft({
                      ...draft,
                      unit: nextUnit,
                      quantity: converted === null ? draft.quantity : String(converted),
                    });
                  }}
                  className="w-full h-11 px-3 rounded-xl border border-tk-stone text-sm font-semibold text-tk-ink bg-white focus:outline-none focus:ring-2 focus:ring-tk-jade/20 focus:border-tk-jade"
                >
                  <option value="g">gam (g)</option>
                  <option value="kg">kg</option>
                  <option value="piece">quả / củ / bìa / miếng</option>
                  <option value="bunch">bó</option>
                  <option value="pack">gói / hộp</option>
                  <option value="slice">lát</option>
                  <option value="ml">ml</option>
                  <option value="l">lít</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="lot-category-input"
                  className="block text-xs font-bold text-tk-secondary mb-1"
                >
                  Danh mục
                </label>
                <select
                  id="lot-category-input"
                  name="category"
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-tk-stone text-sm font-semibold text-tk-ink bg-white focus:outline-none focus:ring-2 focus:ring-tk-jade/20 focus:border-tk-jade"
                >
                  {!Object.hasOwn(CATEGORY_LABEL, editBaseline.category) && (
                    <option value={editBaseline.category}>{editBaseline.category}</option>
                  )}
                  {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label
                htmlFor="lot-expiry-input"
                className="block text-xs font-bold text-tk-secondary mb-1"
              >
                Hạn sử dụng chính xác
              </label>
              <input
                id="lot-expiry-input"
                name="expiry"
                autoComplete="off"
                type="date"
                value={draft.expiryDate}
                onChange={(event) => setDraft({ ...draft, expiryDate: event.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-tk-stone text-sm font-semibold text-tk-ink bg-white focus:outline-none focus:ring-2 focus:ring-tk-jade/20 focus:border-tk-jade"
              />
              <p className="text-[11px] text-tk-muted mt-1">
                Ngày bạn chọn được lưu là hạn dùng đã biết chắc chắn.
              </p>
            </div>
            <div>
              <label
                htmlFor="lot-storage-input"
                className="block text-xs font-bold text-tk-secondary mb-1"
              >
                Chuyển vị trí bảo quản
              </label>
              <select
                id="lot-storage-input"
                name="storage"
                value={draft.storage}
                onChange={(event) => setDraft({ ...draft, storage: event.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-tk-stone text-sm font-semibold text-tk-ink bg-white focus:outline-none focus:ring-2 focus:ring-tk-jade/20 focus:border-tk-jade"
              >
                <option value="fridge">Ngăn mát</option>
                <option value="freezer">Ngăn đông</option>
                <option value="pantry">Tủ đồ khô</option>
              </select>
            </div>
            <div className="flex gap-2.5 pt-1">
              <Button type="submit" fullWidth disabled={mutate.isPending || !draft.name.trim()}>
                {mutate.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
              </Button>
              <Button type="button" variant="outline" onClick={cancelEdit}>
                Hủy
              </Button>
            </div>
          </fieldset>
        </form>
      )}

      {/* 5. RELATED RECIPES */}
      <div className="pt-2">
        <h3 className="font-heading font-extrabold text-base text-tk-ink flex items-center gap-2 mb-2">
          <ChefHat aria-hidden="true" className="w-4.5 h-4.5 text-tk-jade" />
          <span>Món có nguyên liệu này ({matchingRecipes.length})</span>
        </h3>

        <p className="stock-recipe-note text-tk-secondary">
          Đây là các món có dùng nguyên liệu này. Mở từng món để kiểm tra lượng cần, nguyên liệu còn
          thiếu và cách nấu.
        </p>

        {matchingRecipes.length === 0 && (
          <p className="stock-recipe-note text-tk-secondary">
            Chưa có món liên quan trong danh sách này.{' '}
            <Link to="/recipes" className="underline font-bold text-tk-jade">
              Khám phá món ăn
            </Link>
          </p>
        )}

        <div className="space-y-2.5">
          {matchingRecipes.map((recipe) => {
            const legacyMedia = resolveRecipeImage(recipe);
            const sunlitMedia = resolveRecipeImageV4({
              id: recipe.id,
              slug: recipe.slug,
              title: recipe.title,
              cuisine: recipe.cuisine,
              category: 'category' in recipe ? recipe.category : undefined,
              tags: 'tags' in recipe ? recipe.tags : undefined,
              imageUrl: recipe.imageUrl,
              media: 'media' in recipe ? recipe.media : undefined,
            });
            const displaySrc =
              legacyMedia.source === 'canonical_r2' ? legacyMedia.src : sunlitMedia.src;

            return (
              <Link
                key={recipe.id}
                to={`/recipes/${recipe.slug}`}
                aria-label={recipe.title}
                className="stock-recipe-link rounded-2xl border border-tk-stone/85 bg-white p-3.5 flex items-center gap-3.5 shadow-xs cursor-pointer hover:border-tk-jade/45 hover:shadow-card active:scale-[0.99] transition-tap"
              >
                <img
                  src={displaySrc}
                  alt=""
                  width={60}
                  height={60}
                  className="w-15 h-15 rounded-xl object-cover shrink-0 border border-tk-stone/70"
                  loading="lazy"
                  onError={recipeImageErrorHandler(sunlitMedia.fallbackSrc)}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-tk-jade-soft text-tk-jade-deep border border-tk-jade/20 uppercase">
                    {sunlitMedia.categoryLabelVi || recipe.cuisine}
                  </span>
                  <h4 className="font-heading font-extrabold text-sm text-tk-ink truncate mt-1">
                    {recipe.title}
                  </h4>
                  <span className="flex items-center gap-1 text-xs text-tk-muted mt-0.5 tk-tabular">
                    <Clock aria-hidden="true" className="w-3 h-3 text-tk-flame" />
                    <span>{recipe.cookTimeMinutes} phút</span>
                  </span>
                </div>
                <ArrowRight aria-hidden="true" className="w-4 h-4 text-tk-muted" />
              </Link>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Xóa / Hủy lô thực phẩm này?"
        description={`Lô "${item.name}" (${item.quantity} ${item.unit}) sẽ được hủy khỏi tồn kho tủ lạnh hiện tại.`}
        confirmText={deleteLot.isPending ? 'Đang xóa…' : 'Xác nhận xóa lô'}
        cancelText="Giữ lại"
        destructive
        onConfirm={() => {
          deleteLot.mutate({ id: String(item.id), version: Number(item.version) });
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </KitchenDetailPage>
  );
};
