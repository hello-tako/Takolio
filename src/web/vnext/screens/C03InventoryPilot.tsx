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
  TkvSkeleton,
  TkvSurface,
  TkvTextField,
} from '../components/Primitives';
import { VNextIcon, type VNextIconName } from '../components/VNextIcons';
import { useVNextSeo } from '../lib/seo';
import { InteractiveFridgeCutawaySvg } from '../interactive-svg/InteractiveFridgeCutawaySvg';

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
    <span className="w-10 h-10 rounded-xl bg-[var(--tkv-surface-muted,#F7EFE6)] border border-[var(--tkv-border,#EAE0D5)] text-[var(--tkv-primary,#D86A43)] flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
      {showImage ? (
        <img
          src={src}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-contain"
        />
      ) : (
        <VNextIcon name={catIcon} size={20} />
      )}
    </span>
  );
};

/**
 * C03 — Tủ lạnh của tôi (G02 Live Pilot).
 * Faithfully implements `C03.png` on mobile (390×844) and Desktop Inventory Workbench (1440×900):
 * - URL-synced search & filter chips (`C04` back-restoration ready)
 * - Strict separation between Empty Fridge (`pose="empty-fridge"`) vs Empty Search/Filter (`S06`)
 * - `If-Match` version-guarded +/- mutations + authoritative refetch on `409 CONFLICT` (`S05`)
 * - Honest `expiryEstimated` day chips (`0 = Chưa rõ` sends `expiryDate: null`) (`C05`)
 */
export const C03InventoryPilot: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const activeFilter = searchParams.get('filter') ?? 'all';

  const [addOpen, setAddOpen] = useState(() => searchParams.get('action') === 'add');
  const [cutawayOpen, setCutawayOpen] = useState(false);

  useVNextSeo({
    title: 'Tủ lạnh của tôi',
    description: 'Quản lý tồn kho thực phẩm theo lô và cảnh báo hạn dùng trên Takolio.',
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
    onSuccess: () => {
      void invalidateInventoryDependents();
      setAddOpen(false);
      setName('');
      setQuantity(1);
      setMutationBanner(null);
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
      expiryEstimated: expiryDate !== null,
    });
  };

  const expiringCount = items.filter(
    (i) => i.freshness === 'expiring' || i.freshness === 'use_soon',
  ).length;
  const healthyCount = items.length - expiringCount;
  const freezerZoneCount = items.filter((i) => i.storage === 'freezer').length;
  const crisperZoneCount = items.filter(
    (i) => i.storage !== 'freezer' && (i.category === 'vegetable' || i.category === 'fruit'),
  ).length;
  const chillerZoneCount = items.filter(
    (i) => i.storage !== 'freezer' && (i.category === 'meat' || i.category === 'seafood'),
  ).length;
  const coolZoneCount = Math.max(
    0,
    items.length - freezerZoneCount - crisperZoneCount - chillerZoneCount,
  );

  const filteredItems = items.filter((item) => {
    if (query.trim() && !item.name.toLowerCase().includes(query.trim().toLowerCase())) {
      return false;
    }
    if (activeFilter === 'all') return true;
    if (activeFilter === 'expiring') {
      return item.freshness === 'expiring' || item.freshness === 'use_soon';
    }
    if (activeFilter === 'fresh') {
      return item.freshness !== 'expiring' && item.freshness !== 'use_soon';
    }
    return item.category === activeFilter;
  });

  const filterChips = [
    { id: 'all', label: `Tất cả (${items.length})` },
    { id: 'expiring', label: `Sắp hết (${expiringCount})` },
    { id: 'fresh', label: `Còn đủ (${healthyCount})` },
    { id: 'vegetable', label: 'Rau củ' },
    { id: 'meat', label: 'Thịt & cá' },
    { id: 'egg', label: 'Trứng' },
    { id: 'dairy', label: 'Sữa & phô mai' },
  ];

  return (
    <ConsumerStudioShell screenId="C03" title="Tủ lạnh của tôi">
      <div className="space-y-5">
        {/* Top Heading & Workbench Actions */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="tkv-eyebrow text-xs font-semibold uppercase tracking-widest text-[var(--tkv-ink-muted,#87776E)]">
              Quản lý tồn kho theo lô
            </p>
            <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#2C221E)] mt-0.5">
              Tủ lạnh của tôi
            </h1>
            <p className="text-sm text-[var(--tkv-ink-soft,#5F524A)] mt-0.5 tabular-nums">
              {inventoryQuery.isSuccess
                ? `Đang có ${items.length} lô nguyên liệu khả dụng · Đối soát phiên bản máy chủ tự động.`
                : 'Theo dõi định lượng và hạn dùng thực tế của hộ gia đình.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <TkvButton
              variant="primary"
              size="sm"
              iconLeft="plus"
              onClick={() => setAddOpen((v) => !v)}
              data-testid="c03-toggle-add-btn"
            >
              Thêm nguyên liệu
            </TkvButton>
            <button
              type="button"
              aria-pressed={cutawayOpen}
              onClick={() => setCutawayOpen((v) => !v)}
              className="tkv-focusable min-h-[44px] px-3.5 py-2 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border,#EAE0D5)] hover:border-[var(--tkv-border-strong,#D5C3B3)] text-sm font-semibold text-[var(--tkv-ink,#2C221E)] inline-flex items-center gap-1.5 transition-colors"
            >
              <VNextIcon name="fridge" size={16} className="text-[var(--tkv-primary,#D86A43)]" />
              <span>{cutawayOpen ? 'Ẩn sơ đồ ngăn tủ' : 'Sơ đồ ngăn tủ'}</span>
            </button>
            <Link
              to="/inventory-reconciliation"
              className="tkv-focusable min-h-[44px] px-3.5 py-2 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border,#EAE0D5)] hover:border-[var(--tkv-border-strong,#D5C3B3)] text-sm font-semibold text-[var(--tkv-ink,#2C221E)] inline-flex items-center gap-1.5 transition-colors"
            >
              <VNextIcon name="history" size={16} />
              <span>Đối soát tồn kho</span>
            </Link>
          </div>
        </div>

        {cutawayOpen && (
          <InteractiveFridgeCutawaySvg
            countsByZone={{
              cool: coolZoneCount,
              crisper: crisperZoneCount,
              chiller: chillerZoneCount,
              freezer: freezerZoneCount,
            }}
            expiringCount={expiringCount}
            onSelectZone={(zoneId) => {
              if (zoneId === 'crisper') updateUrlParam('filter', 'vegetable');
              else if (zoneId === 'chiller') updateUrlParam('filter', 'meat');
              else updateUrlParam('filter', 'all');
            }}
          />
        )}

        {/* S05 / Conflict or Mutation Notice */}
        {mutationBanner && (
          <TkvSurface role="alert" className="p-4 bg-[var(--tkv-honey-soft,#FCF5E6)] border-[var(--tkv-honey-border,#EDD9B4)] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-[var(--tkv-honey-ink,#8C5B18)]">
              <span className="w-2 h-2 rounded-full bg-[var(--tkv-honey,#C68634)] shrink-0" aria-hidden="true" />
              <VNextIcon name="warning" size={18} />
              <span>{mutationBanner.message}</span>
            </div>
            {mutationBanner.refetchFailed && (
              <TkvButton size="sm" variant="quiet" iconLeft="refresh" onClick={() => void inventoryQuery.refetch()}>
                Tải lại tồn kho
              </TkvButton>
            )}
          </TkvSurface>
        )}

        {/* C05 Inline Add Ingredient Sheet */}
        {addOpen && (
          <TkvSurface className="p-5 space-y-4 bg-[var(--tkv-surface-muted,#F7EFE6)] border-[var(--tkv-border,#EAE0D5)]">
            <div className="flex items-center justify-between">
              <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#2C221E)]">
                Thêm nguyên liệu thủ công
              </h2>
              <TkvIconButton icon="close" label="Đóng biểu mẫu thêm nguyên liệu" onClick={() => setAddOpen(false)} />
            </div>
            <form onSubmit={handleAddSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
              <TkvTextField
                label="Tên nguyên liệu"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Cà chua, Thịt ba chỉ…"
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
                <label htmlFor="tkv-c05-unit" className="text-sm font-bold text-[var(--tkv-ink,#2C221E)] block">
                  Đơn vị & Vị trí
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    id="tkv-c05-unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as StandardUnit)}
                    className="tkv-focusable min-h-[48px] px-3 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border,#EAE0D5)] text-sm font-semibold text-[var(--tkv-ink,#2C221E)]"
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
                    className="tkv-focusable min-h-[48px] px-3 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border,#EAE0D5)] text-sm font-semibold text-[var(--tkv-ink,#2C221E)]"
                  >
                    <option value="fridge">Ngăn mát</option>
                    <option value="freezer">Ngăn đông</option>
                    <option value="pantry">Tủ khô</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="tkv-c05-expiry" className="text-sm font-bold text-[var(--tkv-ink,#2C221E)] block">
                  Hạn dùng ước tính
                </label>
                <div className="flex gap-2">
                  <select
                    id="tkv-c05-expiry"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                    className="tkv-focusable flex-1 min-h-[48px] px-3 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border,#EAE0D5)] text-sm font-semibold text-[var(--tkv-ink,#2C221E)]"
                  >
                    <option value={3}>Ước tính ~3 ngày</option>
                    <option value={5}>Ước tính ~5 ngày</option>
                    <option value={10}>Ước tính ~10 ngày</option>
                    <option value={0}>Chưa rõ ngày</option>
                  </select>
                  <select
                    aria-label="Nhóm nguyên liệu"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="tkv-focusable min-h-[48px] px-2.5 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border,#EAE0D5)] text-sm font-semibold text-[var(--tkv-ink,#2C221E)]"
                  >
                    <option value="vegetable">Rau củ</option>
                    <option value="meat">Thịt</option>
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
                  Xác nhận lưu vào tủ
                </TkvButton>
              </div>
            </form>
          </TkvSurface>
        )}

        {/* Search & Filter Strip */}
        <div className="space-y-3">
          <TkvSearchField
            id="tkv-fridge-search"
            value={query}
            onChange={(val) => updateUrlParam('q', val)}
            placeholder="Tìm kiếm hoặc lọc nguyên liệu trong tủ…"
            label="Tìm nguyên liệu trong tủ lạnh"
          />
          <div role="group" aria-label="Bộ lọc trạng thái tủ lạnh" className="flex items-center gap-2 overflow-x-auto pb-1 tabular-nums">
            {filterChips.map((chip) => (
              <TkvChip
                key={chip.id}
                active={activeFilter === chip.id}
                onClick={() => updateUrlParam('filter', chip.id)}
              >
                {chip.label}
              </TkvChip>
            ))}
          </div>
        </div>

        {/* Inventory Content: Loading vs Error vs Truly Empty Fridge vs Empty Filter vs Lot List */}
        {inventoryQuery.isPending ? (
          <div className="space-y-3">
            <TkvSkeleton className="h-20" label="Đang tải danh sách nguyên liệu…" />
            <TkvSkeleton className="h-20" label="Đang tải lô nguyên liệu…" />
            <TkvSkeleton className="h-20" label="Đang tải lô nguyên liệu…" />
          </div>
        ) : inventoryQuery.isError ? (
          <TkvErrorState
            title="Không đọc được tồn kho hiện tại"
            message="Dữ liệu tủ lạnh chưa thể đồng bộ từ máy chủ. Vui lòng thử tải lại."
            onRetry={() => void inventoryQuery.refetch()}
          />
        ) : items.length === 0 ? (
          /* Truly Empty Fridge (C03 / S06) */
          <TkvEmptyState
            pose="empty-fridge"
            eyebrow="Tủ lạnh đang trống"
            title="Chưa có nguyên liệu nào trong tủ lạnh"
            description="Chụp ảnh ngăn mát / hóa đơn siêu thị để AI gợi ý danh sách duyệt, hoặc nhập nhanh nguyên liệu đầu tiên bằng tay."
            primaryAction={
              <Link
                to="/scan"
                className="tkv-focusable min-h-[48px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#D86A43)] hover:bg-[var(--tkv-primary-hover,#C25731)] text-white shadow-xs font-semibold text-sm inline-flex items-center gap-2 transition-colors"
              >
                <VNextIcon name="scan" size={18} />
                <span>Quét nguyên liệu</span>
              </Link>
            }
            secondaryAction={
              <TkvButton variant="secondary" onClick={() => setAddOpen(true)}>
                Thêm thủ công
              </TkvButton>
            }
          />
        ) : filteredItems.length === 0 ? (
          /* Empty Filter / Search — NEVER conflated with Empty Fridge! */
          <TkvSurface className="p-6 text-center space-y-3 bg-[var(--tkv-surface-muted,#F7EFE6)] border-[var(--tkv-border,#EAE0D5)]" data-testid="c03-filtered-empty">
            <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#2C221E)]">
              Không có nguyên liệu khớp bộ lọc hiện tại
            </h2>
            <p className="text-sm text-[var(--tkv-ink-soft,#5F524A)] tabular-nums">
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
          /* Ingredient Cards (Mobile 1-col / Desktop 2-col Workbench Grid) with 79 rich PNG illustrations */
          <ul aria-label="Danh sách nguyên liệu trong tủ" className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredItems.map((item) => {
              const exp = presentExpiry(item);
              const remDays = daysUntil(exp.date ?? undefined);
              const isExpiring = item.freshness === 'expiring' || item.freshness === 'use_soon';

              return (
                <li key={item.id} data-testid="inventory-row" data-item-id={item.id}>
                  <TkvSurface padded={false} className="p-4 flex items-center justify-between gap-3 bg-white border-[var(--tkv-border,#EAE0D5)] hover:border-[var(--tkv-border-strong,#D5C3B3)] transition-colors">
                    <Link
                      to={`/fridge/${item.id}`}
                      className="tkv-focusable flex items-center gap-3.5 min-w-0 flex-1 rounded-xl py-0.5"
                    >
                      <IngredientThumb
                        ingredientId={item.ingredientId}
                        name={item.name}
                        category={item.category}
                      />
                      <div className="min-w-0 space-y-1">
                        <p className="tkv-heading text-base font-bold text-[var(--tkv-ink,#2C221E)] truncate">
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-[var(--tkv-ink-soft,#5F524A)] tabular-nums">
                          <span className="font-bold text-[var(--tkv-ink,#2C221E)]">
                            {item.quantity} {item.unit}
                          </span>
                          <span>·</span>
                          <span>{STORAGE_LABELS[item.storage] ?? item.storage}</span>
                          <span>·</span>
                          <span className="font-mono text-[var(--tkv-ink-muted,#87776E)]">v{item.version}</span>
                        </div>
                        <span
                          className={
                            isExpiring
                              ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--tkv-honey-soft,#FCF5E6)] border border-[var(--tkv-honey-border,#EDD9B4)] text-xs font-semibold text-[var(--tkv-honey-ink,#8C5B18)] tabular-nums'
                              : 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--tkv-sage-soft,#EEF5F0)] border border-[var(--tkv-sage-border,#CFE2D5)] text-xs font-semibold text-[var(--tkv-sage-ink,#355940)] tabular-nums'
                          }
                        >
                          <span
                            className={
                              isExpiring
                                ? 'w-1.5 h-1.5 rounded-full bg-[var(--tkv-honey,#C68634)]'
                                : 'w-1.5 h-1.5 rounded-full bg-[var(--tkv-sage,#4E7A5B)]'
                            }
                            aria-hidden="true"
                          />
                          <span>
                            {exp.date
                              ? exp.estimated
                                ? remDays !== null
                                  ? `Ước tính còn ${remDays} ngày`
                                  : 'Hạn ước tính'
                                : remDays !== null
                                  ? `Còn ${remDays} ngày`
                                  : exp.date
                              : 'Chưa rõ hạn dùng'}
                          </span>
                        </span>
                      </div>
                    </Link>

                    <div className="flex items-center gap-1.5 shrink-0">
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
