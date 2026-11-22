import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { StandardUnit } from '@frigo/domain';
import { api } from '../../services/api';
import { ApiError } from '../../services/http';
import { queryKeys } from '../../lib/queryKeys';
import { invalidateInventoryDependents } from '../../lib/query-invalidation';
import { daysUntil } from '../../lib/format';
import {
  presentDomainError,
  presentExpiry,
  presentRefetchOutcome,
} from '../../lib/inventory-truth';
import { adjustedInventoryQuantity } from '../../lib/inventory-quantity';
import { getIngredientImage } from '../../lib/ingredient-images';
import { ConsumerStudioShell } from '../components/Shells';
import {
  TkvButton,
  TkvChip,
  TkvEmptyState,
  TkvErrorState,
  TkvIconButton,
  TkvSearchField,
  TkvSurface,
  TkvTextField,
} from '../components/Primitives';
import { VNextIcon, type VNextIconName } from '../components/VNextIcons';
import { BrandFeatureIcon } from '../components/VNextMedia';
import { FridgeInventorySkeleton } from '../components/Skeletons';
import { showTkvToast } from '../components/LivingMotion';
import { useVNextSeo } from '../lib/seo';

const CATEGORY_ICONS: Record<string, VNextIconName> = {
  vegetable: 'cat-vegetable',
  meat: 'cat-meat',
  seafood: 'cat-seafood',
  egg: 'cat-egg',
  dairy: 'cat-dairy',
  grain: 'cat-grain',
  spice: 'cat-spice',
  fruit: 'cat-fruit',
};

const STORAGE_LABELS: Record<string, string> = {
  fridge: 'Ngăn mát',
  freezer: 'Ngăn đông',
  pantry: 'Tủ khô',
};

const UNIT_LABELS_VI: Record<string, string> = {
  piece: 'quả',
  bunch: 'bó',
  pack: 'gói',
  slice: 'lát',
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'lít',
};

const IngredientThumb: React.FC<{
  ingredientId?: string;
  name: string;
  category: string;
}> = ({ ingredientId, name, category }) => {
  const [failed, setFailed] = useState(false);
  const src = getIngredientImage(ingredientId, name);
  const catIcon = CATEGORY_ICONS[category] ?? 'cat-vegetable';
  const showImage = Boolean(src) && !failed && !src.includes('placeholder');

  return (
    <span className="w-12 h-12 rounded-2xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] text-[var(--tkv-primary)] flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
      {showImage ? (
        <img
          src={src}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-contain"
        />
      ) : (
        <VNextIcon name={catIcon} size={22} />
      )}
    </span>
  );
};

/**
 * C03 — Tủ lạnh của bạn (Official Takolio Brand Board v2).
 * Matches `board.jpg` & `board-2.jpg` left phone mockup while preserving 100% of PR #62's
 * version-guarded inventory mutations, FEFO labels, and URL filter persistence.
 */
export const C03InventoryPilot: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const activeFilter = searchParams.get('filter') ?? 'all';

  const [addOpen, setAddOpen] = useState(() => searchParams.get('action') === 'add');

  useVNextSeo({
    title: 'Tủ lạnh của bạn — Takolio',
    description: 'Quản lý nguyên liệu trong tủ lạnh theo lô và cảnh báo hạn dùng cùng Bé Mầm Bếp.',
    canonicalPath: '/fridge',
    domainSurface: 'app',
    noindex: true,
  });

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setAddOpen(true);
    }
  }, [searchParams]);

  const [mutationBanner, setMutationBanner] = useState<{
    message: string;
    refetchFailed: boolean;
  } | null>(null);

  // Add item form state (C05)
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<StandardUnit>('piece');
  const [category, setCategory] = useState('vegetable');
  const [storage, setStorage] = useState('fridge');
  const [expiryDays, setExpiryDays] = useState<number>(5);

  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
  });

  const items = (inventoryQuery.data ?? []).filter((item) => item.quantity > 0);

  const updateUrlParam = (key: 'q' | 'filter', val: string) => {
    const next = new URLSearchParams(searchParams);
    if (!val || (key === 'filter' && val === 'all')) {
      next.delete(key);
    } else {
      next.set(key, val);
    }
    setSearchParams(next, { replace: true });
  };

  const handleMutationError = async (error: unknown, fallback: string) => {
    const code = error instanceof ApiError ? error.code : null;
    const presentation = presentDomainError(code, fallback);
    if (!presentation.refetch) {
      setMutationBanner({ message: presentation.message, refetchFailed: false });
      return;
    }
    setMutationBanner({ message: presentation.message, refetchFailed: false });
    await invalidateInventoryDependents();
    const reloaded = await inventoryQuery.refetch({ throwOnError: false });
    const refreshed = reloaded.status === 'success';
    setMutationBanner({
      message: presentRefetchOutcome(presentation, refreshed).message,
      refetchFailed: !refreshed,
    });
  };

  const updateQtyMutation = useMutation({
    retry: false,
    mutationFn: ({ id, newQty, version }: { id: string; newQty: number; version: number }) =>
      api.updateInventoryItem(id, { quantity: newQty }, version),
    onSuccess: () => {
      setMutationBanner(null);
      return invalidateInventoryDependents();
    },
    onError: (err) => handleMutationError(err, 'Chưa cập nhật được số lượng. Vui lòng thử lại.'),
  });

  const addItemMutation = useMutation({
    retry: false,
    mutationFn: (payload: {
      name: string;
      quantity: number;
      unit: StandardUnit;
      category: string;
      storage: string;
      expiryDate: string | null;
      expiryEstimated: boolean;
    }) => api.addInventoryItem(payload),
    onSuccess: (_res, vars) => {
      void invalidateInventoryDependents();
      setAddOpen(false);
      setName('');
      setQuantity(1);
      setMutationBanner(null);
      showTkvToast({ message: `Đã thêm “${vars.name}” vào tủ lạnh`, tone: 'success' });
    },
    onError: (err) => handleMutationError(err, 'Chưa thêm được nguyên liệu vào tủ lạnh.'),
  });

  const handleAdjustQty = (id: string, currentQty: number, delta: number, version: number) => {
    setMutationBanner(null);
    const nextQty = adjustedInventoryQuantity(currentQty, delta);
    if (nextQty !== null) {
      updateQtyMutation.mutate({ id, newQty: nextQty, version });
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || addItemMutation.isPending) return;
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) {
      setMutationBanner({
        message: 'Số lượng phải lớn hơn 0 và không vượt quá 10.000 theo đơn vị đã chọn.',
        refetchFailed: false,
      });
      return;
    }
    const expiryDate =
      expiryDays > 0
        ? new Date(Date.now() + expiryDays * 86_400_000).toISOString().split('T')[0]
        : null;
    addItemMutation.mutate({
      name: name.trim(),
      quantity: Number(quantity),
      unit,
      category,
      storage,
      expiryDate,
      expiryEstimated: false,
    });
  };

  const expiringCount = items.filter((i) => {
    const exp = presentExpiry(i);
    const rem = daysUntil((exp.date ?? i.expiryDate) ?? undefined);
    return i.freshness === 'expiring' || i.freshness === 'use_soon' || (rem !== null && rem <= 3);
  }).length;
  const healthyCount = Math.max(0, items.length - expiringCount);

  const filteredItems = items.filter((item) => {
    if (query.trim() && !item.name.toLowerCase().includes(query.trim().toLowerCase())) {
      return false;
    }
    if (activeFilter === 'all') return true;
    if (activeFilter === 'expiring') {
      const exp = presentExpiry(item);
      const rem = daysUntil((exp.date ?? item.expiryDate) ?? undefined);
      return item.freshness === 'expiring' || item.freshness === 'use_soon' || (rem !== null && rem <= 3);
    }
    if (activeFilter === 'fresh') {
      return item.freshness !== 'expiring' && item.freshness !== 'use_soon';
    }
    if (activeFilter === 'meat') {
      return item.category === 'meat' || item.category === 'seafood';
    }
    if (activeFilter === 'spice') {
      return item.category === 'spice' || item.category === 'other' || item.category === 'grain';
    }
    return item.category === activeFilter;
  });

  const filterChips = [
    { id: 'all', label: 'Tất cả' },
    { id: 'meat', label: 'Thịt cá' },
    { id: 'vegetable', label: 'Rau củ' },
    { id: 'spice', label: 'Gia vị' },
  ];

  return (
    <ConsumerStudioShell screenId="C03" title="Tủ lạnh của bạn">
      <div className="space-y-4 pb-6 lg:pb-0">
        {/* Top Heading & Workbench Actions (`board-2.jpg` left screen) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <BrandFeatureIcon name="fridge" size={48} />
            <div>
              <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
                Tủ lạnh của bạn
              </h1>
              <p className="text-sm font-semibold text-[var(--tkv-ink-secondary)] mt-0.5 tabular-nums">
                {inventoryQuery.isSuccess
                  ? `${items.length} nguyên liệu · ${expiringCount} sắp hết hạn`
                  : 'Theo dõi định lượng và hạn dùng thực tế của gia đình'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/scan"
              className="tkv-focusable min-h-[44px] px-4 py-2 rounded-full bg-[var(--tkv-surface-mint)] hover:opacity-95 border border-[var(--tkv-border-mint)] text-sm font-extrabold text-[var(--tkv-primary)] inline-flex items-center gap-1.5 transition-colors"
            >
              <VNextIcon name="scan" size={16} />
              <span>Quét AI</span>
            </Link>
            <Link
              to="/inventory-reconciliation"
              className="tkv-focusable min-h-[44px] px-3.5 py-2 rounded-full bg-[var(--tkv-surface)] border border-[var(--tkv-border)] hover:bg-[var(--tkv-surface-mint)] text-sm font-bold text-[var(--tkv-ink-secondary)] inline-flex items-center gap-1.5 transition-colors"
            >
              <VNextIcon name="history" size={16} />
              <span>Đối soát</span>
            </Link>
          </div>
        </div>

        {/* S05 / Conflict or Mutation Notice */}
        {mutationBanner && (
          <TkvSurface
            role="alert"
            className="p-4 bg-[var(--tkv-surface-saffron)] border-[var(--tkv-border-saffron)] flex items-center justify-between gap-3 flex-wrap"
          >
            <div className="flex items-center gap-2.5 text-sm font-bold text-[var(--tkv-warning-ink)]">
              <VNextIcon name="warning" size={18} />
              <span>{mutationBanner.message}</span>
            </div>
            {mutationBanner.refetchFailed && (
              <TkvButton
                size="sm"
                variant="quiet"
                iconLeft="refresh"
                onClick={() => void inventoryQuery.refetch()}
              >
                Tải lại tồn kho
              </TkvButton>
            )}
          </TkvSurface>
        )}

        {/* C05 Inline Add Ingredient Sheet */}
        {addOpen && (
          <TkvSurface className="p-5 space-y-4 bg-[var(--tkv-surface)] border-[var(--tkv-border-mint)]">
            <div className="flex items-center justify-between">
              <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                Thêm nguyên liệu vào tủ lạnh
              </h2>
              <TkvIconButton
                icon="close"
                label="Đóng biểu mẫu thêm nguyên liệu"
                onClick={() => setAddOpen(false)}
              />
            </div>
            <form
              onSubmit={handleAddSubmit}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end"
            >
              <TkvTextField
                label="Tên nguyên liệu"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Thịt ba chỉ, Cà chua…"
                required
              />
              <TkvTextField
                label="Số lượng"
                type="number"
                min={0.1}
                step="any"
                value={String(quantity)}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
              <div className="space-y-2">
                <label
                  htmlFor="tkv-c05-unit"
                  className="text-sm font-bold text-[var(--tkv-ink)] block"
                >
                  Đơn vị & Vị trí
                </label>
                <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
                  <select
                    id="tkv-c05-unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as StandardUnit)}
                    className="tkv-focusable w-full min-w-0 min-h-[48px] px-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-surface)] border border-[var(--tkv-border)] text-base font-semibold text-[var(--tkv-ink)]"
                  >
                    <option value="piece">quả / cái</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="bunch">bó</option>
                    <option value="pack">gói</option>
                  </select>
                  <select
                    aria-label="Vị trí bảo quản"
                    value={storage}
                    onChange={(e) => setStorage(e.target.value)}
                    className="tkv-focusable w-full min-w-0 min-h-[48px] px-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-surface)] border border-[var(--tkv-border)] text-base font-semibold text-[var(--tkv-ink)]"
                  >
                    <option value="fridge">Ngăn mát</option>
                    <option value="freezer">Ngăn đông</option>
                    <option value="pantry">Tủ khô</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="tkv-c05-expiry"
                  className="text-sm font-bold text-[var(--tkv-ink)] block"
                >
                  Hạn dùng ước tính
                </label>
                <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
                  <select
                    id="tkv-c05-expiry"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                    className="tkv-focusable w-full min-w-0 min-h-[48px] px-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-surface)] border border-[var(--tkv-border)] text-base font-semibold text-[var(--tkv-ink)]"
                  >
                    <option value={2}>Còn 2 ngày</option>
                    <option value={3}>Còn 3 ngày</option>
                    <option value={4}>Còn 4 ngày</option>
                    <option value={5}>Còn 5 ngày</option>
                    <option value={7}>Còn 7 ngày</option>
                    <option value={0}>Chưa rõ ngày</option>
                  </select>
                  <select
                    aria-label="Nhóm nguyên liệu"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="tkv-focusable w-full min-w-0 min-h-[48px] px-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-surface)] border border-[var(--tkv-border)] text-base font-semibold text-[var(--tkv-ink)]"
                  >
                    <option value="vegetable">Rau củ</option>
                    <option value="meat">Thịt cá</option>
                    <option value="egg">Trứng</option>
                    <option value="dairy">Sữa</option>
                    <option value="spice">Gia vị</option>
                  </select>
                </div>
              </div>
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2 pt-1">
                <TkvButton variant="quiet" size="sm" onClick={() => setAddOpen(false)}>
                  Hủy
                </TkvButton>
                <TkvButton type="submit" variant="primary" size="sm" isLoading={addItemMutation.isPending}>
                  Lưu vào tủ lạnh
                </TkvButton>
              </div>
            </form>
          </TkvSurface>
        )}

        {/* Search + `+ Thêm` Button Row + 4 Balanced Pill Filter Chips (`board-2.jpg` left screen!) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <TkvSearchField
                id="tkv-fridge-search"
                value={query}
                onChange={(val) => updateUrlParam('q', val)}
                placeholder="Tìm nguyên liệu…"
                label="Tìm nguyên liệu trong tủ lạnh"
              />
            </div>
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              data-testid="c03-toggle-add-btn"
              className="tkv-focusable min-h-[48px] px-4 sm:px-5 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white font-extrabold text-sm inline-flex items-center gap-1.5 shrink-0 shadow-[var(--tkv-shadow-cta)] transition-colors"
            >
              <VNextIcon name="plus" size={16} />
              <span>Thêm</span>
            </button>
          </div>

          <div
            role="group"
            aria-label="Bộ lọc trạng thái tủ lạnh"
            className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap tabular-nums"
          >
            {filterChips.map((chip) => (
              <TkvChip
                key={chip.id}
                active={activeFilter === chip.id}
                onClick={() => updateUrlParam('filter', chip.id)}
                className="px-3.5 sm:px-4 text-sm"
              >
                {chip.label}
              </TkvChip>
            ))}
            <TkvChip
              active={activeFilter === 'expiring'}
              onClick={() => updateUrlParam('filter', 'expiring')}
              className="px-3.5 sm:px-4 text-sm"
            >
              Sắp hết ({expiringCount})
            </TkvChip>
            <TkvChip
              active={activeFilter === 'fresh'}
              onClick={() => updateUrlParam('filter', 'fresh')}
              className="px-3.5 sm:px-4 text-sm"
            >
              Còn đủ ({healthyCount})
            </TkvChip>
          </div>
        </div>

        {/* Inventory Content */}
        {inventoryQuery.isPending ? (
          <FridgeInventorySkeleton />
        ) : inventoryQuery.isError ? (
          <TkvErrorState
            title="Không đọc được tồn kho hiện tại"
            message="Dữ liệu tủ lạnh chưa thể đồng bộ từ máy chủ. Vui lòng thử tải lại."
            onRetry={() => void inventoryQuery.refetch()}
          />
        ) : items.length === 0 ? (
          /* Truly Empty Fridge (C03 / S06) — Bé Mầm Bếp Empty Fridge Pose! */
          <TkvEmptyState
            pose="empty-fridge"
            eyebrow="Tủ lạnh đang trống"
            title="Chưa có nguyên liệu nào trong tủ lạnh"
            description="Chụp ảnh ngăn mát hoặc hóa đơn siêu thị để Bé Mầm Bếp gợi ý danh sách duyệt, hoặc nhấn + Thêm để nhập nhanh nguyên liệu đầu tiên."
            primaryAction={
              <Link
                to="/scan"
                className="tkv-focusable min-h-[48px] px-5 py-2.5 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white shadow-xs font-extrabold text-sm inline-flex items-center gap-2 transition-colors"
              >
                <VNextIcon name="scan" size={18} />
                <span>Quét nguyên liệu bằng AI</span>
              </Link>
            }
            secondaryAction={
              <TkvButton variant="secondary" onClick={() => setAddOpen(true)}>
                + Thêm thủ công
              </TkvButton>
            }
          />
        ) : filteredItems.length === 0 ? (
          <TkvSurface
            className="p-6 text-center space-y-3 bg-[var(--tkv-surface)] border-[var(--tkv-border)]"
            data-testid="c03-filtered-empty"
          >
            <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
              Không có nguyên liệu khớp bộ lọc hiện tại
            </h2>
            <p className="text-sm text-[var(--tkv-ink-secondary)] tabular-nums">
              Tủ lạnh của bạn vẫn đang có <strong>{items.length}</strong> nguyên liệu ở các nhóm khác.
            </p>
            <TkvButton
              variant="quiet"
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('q');
                next.delete('filter');
                if (!next.has('vnext')) {
                  next.set('vnext', '1');
                }
                setSearchParams(next, { replace: true });
              }}
            >
              Xóa từ khóa & bộ lọc
            </TkvButton>
          </TkvSurface>
        ) : (
          <ul
            aria-label="Danh sách nguyên liệu trong tủ"
            className="grid grid-cols-1 md:grid-cols-2 gap-3.5"
          >
            {filteredItems.map((item) => {
              const exp = presentExpiry(item);
              const fallbackLegacyDate =
                !exp.date && item.expiryKind == null && item.expiryDate ? item.expiryDate : null;
              const effectiveDate = exp.date ?? fallbackLegacyDate;
              const remDays = daysUntil(effectiveDate ?? undefined);
              const isExpiring =
                item.freshness === 'expiring' ||
                item.freshness === 'use_soon' ||
                (remDays !== null && remDays <= 3);
              const unitVi = UNIT_LABELS_VI[item.unit] ?? item.unit;

              return (
                <li key={item.id} data-testid="inventory-row" data-item-id={item.id}>
                  <TkvSurface
                    padded={false}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--tkv-surface)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-mint)] transition-colors"
                  >
                    <Link
                      to={`/fridge/${item.id}`}
                      className="tkv-focusable flex items-start sm:items-center gap-3 min-w-0 flex-1 rounded-xl py-0.5"
                    >
                      <IngredientThumb
                        ingredientId={item.ingredientId}
                        name={item.name}
                        category={item.category}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)] line-clamp-2 leading-snug">
                          {item.name}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap text-xs text-[var(--tkv-ink-secondary)] tabular-nums">
                          <span className="font-bold text-[var(--tkv-ink)]">
                            {item.quantity} {unitVi}
                          </span>
                          <span>·</span>
                          <span>{STORAGE_LABELS[item.storage] ?? item.storage}</span>
                        </div>
                        <span
                          className={
                            isExpiring
                              ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] text-xs font-extrabold text-[var(--tkv-coral-ink)] tabular-nums'
                              : 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-xs font-extrabold text-[var(--tkv-primary)] tabular-nums'
                          }
                        >
                          <VNextIcon name="timer" size={12} className="shrink-0" />
                          <span>
                            {effectiveDate
                              ? exp.estimated
                                ? remDays !== null
                                  ? remDays <= 0
                                    ? 'Ước tính hết hạn hôm nay'
                                    : `Ước tính còn ${remDays} ngày`
                                  : 'Hạn ước tính'
                                : remDays !== null
                                  ? remDays <= 0
                                    ? 'Hết hạn hôm nay'
                                    : `Còn ${remDays} ngày`
                                  : effectiveDate
                              : 'Chưa rõ hạn dùng'}
                          </span>
                        </span>
                      </div>
                    </Link>

                    <div className="flex items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t border-[var(--tkv-border)] sm:border-0 shrink-0">
                      <TkvIconButton
                        icon="minus"
                        label={`Giảm lượng ${item.name}`}
                        onClick={() => handleAdjustQty(item.id, item.quantity, -1, item.version)}
                        disabled={updateQtyMutation.isPending || item.quantity <= 1}
                      />
                      <TkvIconButton
                        icon="plus"
                        label={`Tăng lượng ${item.name}`}
                        onClick={() => handleAdjustQty(item.id, item.quantity, 1, item.version)}
                        disabled={updateQtyMutation.isPending}
                      />
                      <Link
                        to={`/fridge/${item.id}`}
                        aria-label={`Chi tiết ${item.name}`}
                        className="tkv-focusable hidden sm:inline-flex w-11 h-11 rounded-full items-center justify-center text-[var(--tkv-ink-muted)] hover:text-[var(--tkv-primary)]"
                      >
                        <VNextIcon name="chevron-right" size={16} />
                      </Link>
                    </div>
                  </TkvSurface>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ConsumerStudioShell>
  );
};
