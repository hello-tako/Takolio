import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { StandardUnit } from '@frigo/domain';
import { KitchenPageHeading } from '../components/common/KitchenHeader';
import { TopBar } from '../components/common/TopBar';
import { IngredientRow } from '../components/common/IngredientRow';
import { EmptyState } from '../components/common/EmptyState';
import { AnimatePresence, motion, MOTION_TOKENS } from '../design-system/motion';
import { InlineLoading, InlineError } from '../components/common/AsyncState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { BottomSheet } from '../design-system/primitives';
import { Button } from '../components/common/Button';
import { SmartFridge3D, type FridgeZoneFilter } from '../components/3d';
import { AtelierBadge } from '../design-system/v4/AtelierPrimitives';
import {
  CatDairyEggIcon,
  CatFruitIcon,
  CatGrainDryIcon,
  CatMeatIcon,
  CatOtherIcon,
  CatSeafoodIcon,
  CatSpiceSauceIcon,
  CatVegetableIcon,
  ExpiryRescueBellIcon,
  FreshnessShieldIcon,
  NavScanApertureIcon,
  ZoneCoolIcon,
  ZoneFreezeIcon,
  ZonePantryIcon,
  type TakolioIconProps,
} from '../design-system/icons';
import { api } from '../services/api';
import { ApiError } from '../services/http';
import { queryKeys } from '../lib/queryKeys';
import { invalidateInventoryDependents } from '../lib/query-invalidation';
import { presentDomainError, presentRefetchOutcome } from '../lib/inventory-truth';
import { adjustedInventoryQuantity } from '../lib/inventory-quantity';

const UNIT_PRESET_CHIPS: ReadonlyArray<{ value: StandardUnit; shortLabel: string; fullLabel: string }> = [
  { value: 'g', shortLabel: 'g', fullLabel: 'gam (g)' },
  { value: 'kg', shortLabel: 'kg', fullLabel: 'kilôgam (kg)' },
  { value: 'ml', shortLabel: 'ml', fullLabel: 'ml' },
  { value: 'l', shortLabel: 'l', fullLabel: 'lít (l)' },
  { value: 'piece', shortLabel: 'quả/cái', fullLabel: 'quả / củ / bìa / miếng' },
  { value: 'pack', shortLabel: 'gói/hộp', fullLabel: 'gói / hộp' },
  { value: 'bunch', shortLabel: 'bó', fullLabel: 'bó' },
  { value: 'slice', shortLabel: 'lát', fullLabel: 'lát' },
];

const ZONE_LABELS: Record<Exclude<FridgeZoneFilter, 'all'>, string> = {
  cool: 'Ngăn mát',
  freeze: 'Ngăn đá',
  pantry: 'Tủ đồ khô',
};

function matchesZoneFilter(itemStorage: string | undefined, activeZone: FridgeZoneFilter): boolean {
  if (activeZone === 'all') return true;
  if (activeZone === 'cool') {
    return !itemStorage || itemStorage === 'fridge' || itemStorage === 'cool';
  }
  if (activeZone === 'freeze') {
    return itemStorage === 'freezer' || itemStorage === 'freeze';
  }
  return itemStorage === 'pantry';
}

function matchesCategoryFilter(itemCategory: string | undefined, filterCategory: string): boolean {
  if (filterCategory === 'all') return true;
  if (filterCategory === 'vegetable') return itemCategory === 'vegetable';
  if (filterCategory === 'meat') return itemCategory === 'meat';
  if (filterCategory === 'seafood') return itemCategory === 'seafood';
  if (filterCategory === 'dairy_egg') {
    return itemCategory === 'egg' || itemCategory === 'dairy' || itemCategory === 'dairy_egg';
  }
  if (filterCategory === 'fruit') return itemCategory === 'fruit';
  if (filterCategory === 'grain') return itemCategory === 'grain';
  if (filterCategory === 'spice_sauce') {
    return (
      itemCategory === 'spice' ||
      itemCategory === 'spice_sauce' ||
      itemCategory === 'condiment'
    );
  }
  if (filterCategory === 'other') {
    return !itemCategory || itemCategory === 'other';
  }
  return itemCategory === filterCategory;
}

export const InventoryPage: React.FC = () => {
  const navigate = useNavigate();

  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [activeZone, setActiveZone] = useState<FridgeZoneFilter>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; version: number } | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [refetchFailed, setRefetchFailed] = useState(false);

  // Add Form states
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<StandardUnit>('piece');
  const [category, setCategory] = useState('vegetable');
  const [storage, setStorage] = useState('fridge');
  const [expiryDays, setExpiryDays] = useState(5);

  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
  });

  const canQueryObservations = typeof api.getInventoryObservations === 'function';
  const observationsQuery = useQuery({
    queryKey: queryKeys.inventoryObservations(),
    queryFn: async () => {
      if (typeof api.getInventoryObservations !== 'function') return [];
      try {
        return await api.getInventoryObservations('OPEN');
      } catch {
        return [];
      }
    },
    enabled: canQueryObservations,
    staleTime: 45_000,
    retry: false,
  });

  // Retained zero-quantity rows belong to history, not available fridge stock.
  const items = (inventoryQuery.data ?? []).filter((item) => item.quantity > 0);
  const loading = inventoryQuery.isPending;
  const openObservationCount = (observationsQuery.data ?? []).length;

  const presentMutationFailure = async (error: unknown, fallback: string) => {
    const code = error instanceof ApiError ? error.code : null;
    const presentation = presentDomainError(code, fallback);
    if (!presentation.refetch) {
      setRefetchFailed(false);
      setMutationError(presentation.message);
      return;
    }
    setMutationError(presentation.message);
    await invalidateInventoryDependents();
    const reloaded = await inventoryQuery.refetch({ throwOnError: false });
    const refreshed = reloaded.status === 'success';
    setRefetchFailed(!refreshed);
    setMutationError(presentRefetchOutcome(presentation, refreshed).message);
  };

  const updateQty = useMutation({
    retry: false,
    mutationFn: ({ id, newQty, version }: { id: string; newQty: number; version: number }) =>
      api.updateInventoryItem(id, { quantity: newQty }, version),
    onSuccess: invalidateInventoryDependents,
    onError: (error: unknown) =>
      presentMutationFailure(error, 'Chưa cập nhật được số lượng. Vui lòng thử lại.'),
  });

  const deleteItem = useMutation({
    retry: false,
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.deleteInventoryItem(id, version),
    onSuccess: invalidateInventoryDependents,
    onError: (error: unknown) =>
      presentMutationFailure(error, 'Chưa xóa được nguyên liệu. Vui lòng thử lại.'),
  });

  const addItem = useMutation({
    retry: false,
    mutationFn: (payload: Record<string, unknown>) => api.addInventoryItem(payload as any),
    onSuccess: () => {
      void invalidateInventoryDependents();
      setIsAddModalOpen(false);
      setName('');
      setQuantity(1);
    },
    onError: (error: unknown) =>
      presentMutationFailure(error, 'Chưa thêm được nguyên liệu. Vui lòng thử lại.'),
  });

  const handleUpdateQty = (id: string, currentQty: number, delta: number, version: number) => {
    setMutationError(null);
    setRefetchFailed(false);
    const newQty = adjustedInventoryQuantity(currentQty, delta);
    if (newQty !== null) updateQty.mutate({ id, newQty, version });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || addItem.isPending) return;
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) {
      setMutationError('Nhập lượng lớn hơn 0 và không quá 10.000 theo đơn vị đã chọn.');
      return;
    }
    setMutationError(null);
    setRefetchFailed(false);
    const expiryDate =
      expiryDays > 0
        ? new Date(Date.now() + expiryDays * 86400000).toISOString().split('T')[0]
        : null;
    addItem.mutate({
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
  const vegCount = items.filter((i) => i.category === 'vegetable').length;

  const zoneCounts = {
    cool: items.filter((i) => matchesZoneFilter(i.storage, 'cool')).length,
    freeze: items.filter((i) => matchesZoneFilter(i.storage, 'freeze')).length,
    pantry: items.filter((i) => matchesZoneFilter(i.storage, 'pantry')).length,
    expiring: expiringCount,
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (!matchesZoneFilter(item.storage, activeZone)) return false;
    if (filterCategory === 'expiring') {
      return item.freshness === 'expiring' || item.freshness === 'use_soon';
    }
    return matchesCategoryFilter(item.category, filterCategory);
  });

  // Complete 9-Category Ribbon + Expiring rescue filter
  const categories: ReadonlyArray<{
    id: string;
    label: string;
    Icon?: React.FC<TakolioIconProps>;
    tone?: TakolioIconProps['tone'];
  }> = [
    { id: 'all', label: `Tất cả (${items.length})`, Icon: FreshnessShieldIcon, tone: 'jade' },
    {
      id: 'expiring',
      label: `Nên dùng sớm (${expiringCount})`,
      Icon: ExpiryRescueBellIcon,
      tone: 'turmeric',
    },
    { id: 'vegetable', label: `Rau củ (${vegCount})`, Icon: CatVegetableIcon, tone: 'jade' },
    { id: 'meat', label: 'Thịt', Icon: CatMeatIcon, tone: 'flame' },
    { id: 'seafood', label: 'Hải sản', Icon: CatSeafoodIcon, tone: 'ink' },
    { id: 'dairy_egg', label: 'Trứng & Sữa', Icon: CatDairyEggIcon, tone: 'turmeric' },
    { id: 'fruit', label: 'Trái cây', Icon: CatFruitIcon, tone: 'flame' },
    { id: 'grain', label: 'Ngũ cốc & Đồ khô', Icon: CatGrainDryIcon, tone: 'turmeric' },
    { id: 'spice_sauce', label: 'Gia vị & Sốt', Icon: CatSpiceSauceIcon, tone: 'flame' },
    { id: 'other', label: 'Khác', Icon: CatOtherIcon, tone: 'ink' },
  ];

  return (
    <div className="takosan-rebuild min-h-screen bg-tk-canvas pb-36 relative">
      <TopBar kitchen />

      <div className="kitchen-page-body max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Title & Quick Scan CTA */}
        <KitchenPageHeading
          title="Khoang Tủ Lạnh FEFO"
          eyebrow="Kho nguyên liệu của bạn"
          description={
            inventoryQuery.isSuccess
              ? `${items.length} nguyên liệu đang có trong tủ · Tự động xếp hạng ưu tiên hạn dùng`
              : 'Theo dõi nguyên liệu theo từng khoang bảo quản và kiểm tra hạn dùng FEFO trước khi nấu.'
          }
          action={
            <div className="hidden sm:flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => navigate('/scan')}
                className="tap-target inline-flex items-center gap-2 rounded-2xl bg-tk-sanctuary px-4 py-2.5 text-xs font-extrabold text-white shadow-card transition-colors hover:bg-tk-sanctuary-elevated cursor-pointer"
              >
                <NavScanApertureIcon size={17} tone="flame" active />
                <span>Quét AI thêm nhanh</span>
              </button>
            </div>
          }
        />

        {/* 12-Column Master-Detail Desktop Split Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8 lg:items-start">
          {/* LEFT 4 COLS: Connected Obsidian Vault Dock (Cinema Fridge + 3-Compartment Telemetry) */}
          <aside className="space-y-4 lg:col-span-4 lg:sticky lg:top-24 min-w-0">
            <div className="rounded-[30px] border border-white/14 bg-tk-sanctuary-card p-3 sm:p-3.5 text-white shadow-cinema space-y-3">
              <SmartFridge3D
                activeZone={activeZone}
                onSelectZone={setActiveZone}
                zoneCounts={zoneCounts}
              />

              {/* Connected Dark-Graphite Zone Summary Strip */}
              <div className="rounded-2xl border border-white/10 bg-tk-sanctuary p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-tk-jade-mint">
                    Tổng quan 3 ngăn bảo quản
                  </p>
                  {activeZone !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setActiveZone('all')}
                      className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/20 cursor-pointer"
                    >
                      <span>Hiện tất cả</span>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center tk-tabular">
                  <button
                    type="button"
                    onClick={() => setActiveZone(activeZone === 'cool' ? 'all' : 'cool')}
                    aria-pressed={activeZone === 'cool'}
                    className={clsx(
                      'flex flex-col items-center gap-1 rounded-2xl border p-2.5 text-xs transition-colors cursor-pointer',
                      activeZone === 'cool'
                        ? 'border-tk-jade-mint/60 bg-tk-jade text-white font-extrabold'
                        : 'border-white/10 bg-tk-sanctuary-card text-white/75 hover:bg-tk-sanctuary-elevated hover:text-white',
                    )}
                  >
                    <ZoneCoolIcon size={18} tone="cream" active={activeZone === 'cool'} />
                    <span className="font-bold text-white">{zoneCounts.cool}</span>
                    <span className="text-[11px]">Ngăn mát</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveZone(activeZone === 'freeze' ? 'all' : 'freeze')}
                    aria-pressed={activeZone === 'freeze'}
                    className={clsx(
                      'flex flex-col items-center gap-1 rounded-2xl border p-2.5 text-xs transition-colors cursor-pointer',
                      activeZone === 'freeze'
                        ? 'border-white/40 bg-tk-ocean text-white font-extrabold'
                        : 'border-white/10 bg-tk-sanctuary-card text-white/75 hover:bg-tk-sanctuary-elevated hover:text-white',
                    )}
                  >
                    <ZoneFreezeIcon size={18} tone="cream" active={activeZone === 'freeze'} />
                    <span className="font-bold text-white">{zoneCounts.freeze}</span>
                    <span className="text-[11px]">Ngăn đá</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveZone(activeZone === 'pantry' ? 'all' : 'pantry')}
                    aria-pressed={activeZone === 'pantry'}
                    className={clsx(
                      'flex flex-col items-center gap-1 rounded-2xl border p-2.5 text-xs transition-colors cursor-pointer',
                      activeZone === 'pantry'
                        ? 'border-white/40 bg-tk-turmeric text-white font-extrabold'
                        : 'border-white/10 bg-tk-sanctuary-card text-white/75 hover:bg-tk-sanctuary-elevated hover:text-white',
                    )}
                  >
                    <ZonePantryIcon size={18} tone="cream" active={activeZone === 'pantry'} />
                    <span className="font-bold text-white">{zoneCounts.pantry}</span>
                    <span className="text-[11px]">Đồ khô</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Open Inventory Truth Reconciliation Alert */}
            <button
              type="button"
              onClick={() => navigate('/inventory-reconciliation')}
              className={clsx(
                'tap-target flex w-full items-center justify-between gap-3 rounded-[22px] border px-4 py-3.5 text-left shadow-card transition-tap cursor-pointer',
                openObservationCount > 0
                  ? 'border-tk-turmeric/45 bg-tk-turmeric-soft hover:border-tk-turmeric'
                  : 'border-tk-stone bg-tk-surface hover:border-tk-jade/50',
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-tk-ink">Đối chiếu tủ lạnh</span>
                  {openObservationCount > 0 && (
                    <AtelierBadge tone="turmeric" className="tk-tabular">
                      {openObservationCount} chờ duyệt
                    </AtelierBadge>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-tk-secondary">
                  {openObservationCount > 0
                    ? 'Có ghi nhận mới từ hóa đơn / ảnh quét cần bạn xác nhận.'
                    : 'Kiểm tra bằng chứng số lượng & hạn dùng từ hóa đơn, ảnh quét.'}
                </p>
              </div>
              <span className="shrink-0 text-xs font-extrabold text-tk-jade">Xem bằng chứng →</span>
            </button>
          </aside>

          {/* RIGHT 8 COLS: Connected Stoneware Search + 9-Category Filter Deck & Lot Cards */}
          <div className="space-y-4 lg:col-span-8 min-w-0">
            <div className="rounded-[26px] border border-tk-stone bg-tk-surface p-4 shadow-card space-y-3.5">
              {/* Search Input */}
              <div className="relative">
                <Search className="h-4.5 w-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-tk-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  name="inventory-search"
                  autoComplete="off"
                  ref={searchRef}
                  aria-label="Tìm nguyên liệu trong tủ"
                  placeholder="Tìm theo tên nguyên liệu (ví dụ: thịt ba chỉ, cà chua, nước mắm)…"
                  className="w-full min-w-0 h-12 pl-11 pr-10 bg-tk-canvas rounded-2xl border border-tk-stone focus:outline-none focus:ring-2 focus:ring-tk-jade/25 focus:border-tk-jade focus:bg-tk-surface text-sm font-semibold text-tk-ink placeholder:text-tk-muted transition-colors"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Xóa từ khóa tìm kiếm"
                    onClick={() => {
                      setSearch('');
                      searchRef.current?.focus();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-tk-muted hover:bg-tk-sunken hover:text-tk-ink cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Active Vault Zone Filter Indicator */}
              {activeZone !== 'all' && (
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-tk-jade/30 bg-tk-jade-soft px-3.5 py-2 text-xs font-bold text-tk-jade-deep">
                  <span>Đang lọc theo khoang bảo quản: {ZONE_LABELS[activeZone]}</span>
                  <button
                    type="button"
                    onClick={() => setActiveZone('all')}
                    className="underline font-extrabold cursor-pointer"
                  >
                    Bỏ lọc ngăn
                  </button>
                </div>
              )}

              {/* Complete 9-Category Filter Ribbon with Bespoke Icons */}
              <div
                role="group"
                aria-label="Lọc theo nhóm thực phẩm"
                className="flex gap-2 overflow-x-auto no-scrollbar py-0.5"
              >
                {categories.map((c) => {
                  const active = filterCategory === c.id;
                  const ChipIcon = c.Icon;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFilterCategory(c.id)}
                      aria-pressed={active}
                      className={clsx(
                        'tap-target inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-heading font-extrabold whitespace-nowrap transition-tap cursor-pointer',
                        active
                          ? 'border-tk-sanctuary bg-tk-sanctuary text-white shadow-xs'
                          : 'border-tk-stone bg-tk-canvas text-tk-secondary hover:bg-tk-sunken hover:text-tk-ink',
                      )}
                    >
                      {ChipIcon && (
                        <ChipIcon
                          size={15}
                          tone={active ? 'cream' : (c.tone ?? 'ink')}
                          active={active}
                        />
                      )}
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inventory Item List */}
            <div className="space-y-2.5 pt-1">
              {mutationError && (
                <div
                  className="rounded-2xl border border-tk-berry/25 bg-tk-berry-soft px-4 py-3 text-xs font-semibold text-tk-berry-deep space-y-1.5"
                  role="alert"
                  data-refetch-state={refetchFailed ? 'failed' : 'ok'}
                >
                  <p>{mutationError}</p>
                  {refetchFailed && (
                    <button
                      type="button"
                      className="underline font-extrabold tap-target cursor-pointer"
                      disabled={inventoryQuery.isFetching}
                      onClick={async () => {
                        const reloaded = await inventoryQuery.refetch({ throwOnError: false });
                        if (reloaded.status === 'success') {
                          setRefetchFailed(false);
                          setMutationError(null);
                        }
                      }}
                    >
                      {inventoryQuery.isFetching ? 'Đang tải lại…' : 'Tải lại tủ lạnh'}
                    </button>
                  )}
                </div>
              )}

              {loading ? (
                <InlineLoading label="Đang tải tủ lạnh…" />
              ) : inventoryQuery.isError && inventoryQuery.data === undefined ? (
                <InlineError
                  error={inventoryQuery.error}
                  onRetry={() => inventoryQuery.refetch()}
                />
              ) : items.length === 0 ? (
                <EmptyState
                  type="empty-fridge"
                  title="Tủ lạnh đang trống"
                  description="Hãy bấm quét ảnh tủ lạnh bằng AI hoặc thêm thủ công nguyên liệu bạn vừa mua nhé."
                  actionText="Chụp tủ lạnh ngay"
                  onAction={() => navigate('/scan')}
                  secondaryActionText="Thêm nguyên liệu"
                  onSecondaryAction={() => setIsAddModalOpen(true)}
                />
              ) : filteredItems.length === 0 ? (
                <div
                  role="status"
                  className="rounded-[24px] border border-tk-stone/85 bg-white p-8 text-center shadow-card"
                >
                  <Search
                    className="mx-auto mb-3 h-8 w-8 text-tk-muted"
                    aria-hidden="true"
                  />
                  <h3 className="text-lg font-extrabold text-tk-ink">
                    Không tìm thấy nguyên liệu phù hợp
                  </h3>
                  <p className="mt-2 text-sm text-tk-secondary">
                    {search
                      ? `Không có kết quả cho “${search}” trong bộ lọc hiện tại.`
                      : 'Nhóm hoặc ngăn bảo quản đang chọn chưa có nguyên liệu.'}
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => {
                      setSearch('');
                      setFilterCategory('all');
                      setActiveZone('all');
                      searchRef.current?.focus();
                    }}
                  >
                    Xóa tìm kiếm và bộ lọc
                  </Button>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {filteredItems.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: MOTION_TOKENS.duration.normal,
                        ease: MOTION_TOKENS.easing.standard,
                      }}
                    >
                      <IngredientRow
                        id={item.id}
                        name={item.name}
                        quantity={item.quantity}
                        unit={item.unit}
                        category={item.category}
                        storage={item.storage}
                        freshness={item.freshness}
                        ingredientId={item.ingredientId}
                        expiryDate={item.expiryDate}
                        expiryKind={item.expiryKind}
                        estimatedExpiryDate={item.estimatedExpiryDate}
                        onClick={() => navigate(`/ingredients/${item.id}`)}
                        onUpdateQuantity={(delta) =>
                          handleUpdateQty(item.id, item.quantity, delta, item.version)
                        }
                        onDelete={() => setPendingDelete({ id: item.id, version: item.version })}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Add Ingredient CTA */}
      <div
        data-kitchen-action="fixed"
        className="kitchen-stock-action fixed bottom-[calc(68px+env(safe-area-inset-bottom,0px)+0.75rem)] sm:bottom-6 left-0 right-0 sm:left-20 lg:left-64 px-4 md:px-6 z-30 pointer-events-none"
      >
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="w-full md:w-auto md:min-w-64 md:ml-auto py-4 px-5 md:px-6 rounded-2xl bg-tk-flame hover:bg-tk-flame-hover text-white font-heading font-extrabold text-[15px] shadow-float active:scale-[0.985] transition-tap pointer-events-auto flex items-center justify-center gap-2 tap-target cursor-pointer"
        >
          <Plus className="w-5.5 h-5.5 stroke-[2.5]" />
          <span>Thêm nguyên liệu</span>
        </button>
      </div>

      {/* Polished Add Ingredient Sheet with Smart Unit Chips & Storage Presets */}
      <BottomSheet
        open={isAddModalOpen}
        title="Thêm nguyên liệu vào tủ"
        onClose={() => setIsAddModalOpen(false)}
        className="p-6"
      >
        <form onSubmit={handleAddItem} className="space-y-4">
          <div>
            <label
              htmlFor="add-name"
              className="block text-xs font-bold text-tk-secondary mb-1.5"
            >
              Tên nguyên liệu
            </label>
            <input
              id="add-name"
              type="text"
              name="ingredient-name"
              autoComplete="off"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Thịt ba chỉ, Trứng gà, Cà chua, Gạo ST25…"
              className="w-full h-11 px-3.5 rounded-xl border border-tk-stone focus:outline-none focus:ring-2 focus:ring-tk-jade/25 focus:border-tk-jade font-semibold text-sm text-tk-ink placeholder:text-tk-muted bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="add-quantity"
                className="block text-xs font-bold text-tk-secondary mb-1.5"
              >
                Số lượng
              </label>
              <input
                id="add-quantity"
                type="number"
                min="0"
                max="10000"
                step="any"
                inputMode="decimal"
                aria-describedby="add-quantity-note"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full h-11 px-3.5 rounded-xl border border-tk-stone focus:outline-none focus:ring-2 focus:ring-tk-jade/25 focus:border-tk-jade font-semibold text-sm text-tk-ink bg-white tk-tabular"
              />
            </div>

            <div>
              <label
                htmlFor="add-unit"
                className="block text-xs font-bold text-tk-secondary mb-1.5"
              >
                Đơn vị
              </label>
              <select
                id="add-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as StandardUnit)}
                className="w-full h-11 px-3 rounded-xl border border-tk-stone focus:outline-none focus:ring-2 focus:ring-tk-jade/25 focus:border-tk-jade font-semibold text-sm text-tk-ink bg-white"
              >
                {UNIT_PRESET_CHIPS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.fullLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Smart Quick-Tap Unit Chips */}
          <div>
            <p className="text-[11px] font-bold text-tk-muted mb-1.5">Chọn nhanh đơn vị:</p>
            <div className="flex flex-wrap gap-1.5">
              {UNIT_PRESET_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setUnit(chip.value)}
                  aria-pressed={unit === chip.value}
                  className={clsx(
                    'rounded-xl border px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer',
                    unit === chip.value
                      ? 'border-tk-jade bg-tk-jade-soft text-tk-jade-deep'
                      : 'border-tk-stone bg-tk-canvas text-tk-secondary hover:bg-tk-sunken',
                  )}
                >
                  {chip.shortLabel}
                </button>
              ))}
            </div>
          </div>

          <p id="add-quantity-note" className="text-xs text-tk-secondary">
            Nhập lượng thực tế, ví dụ 0,5 kg hoặc 250 g. Gói và bó không được tự quy đổi sang gram.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="add-category"
                className="block text-xs font-bold text-tk-secondary mb-1.5"
              >
                Phân loại
              </label>
              <select
                id="add-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-tk-stone focus:outline-none focus:ring-2 focus:ring-tk-jade/25 focus:border-tk-jade font-semibold text-sm text-tk-ink bg-white"
              >
                <option value="vegetable">Rau củ</option>
                <option value="meat">Thịt</option>
                <option value="seafood">Hải sản</option>
                <option value="egg">Trứng</option>
                <option value="dairy">Sữa / Bơ</option>
                <option value="fruit">Trái cây</option>
                <option value="grain">Ngũ cốc &amp; Đồ khô</option>
                <option value="spice_sauce">Gia vị &amp; Sốt</option>
                <option value="other">Khác</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="add-storage"
                className="block text-xs font-bold text-tk-secondary mb-1.5"
              >
                Bảo quản
              </label>
              <select
                id="add-storage"
                value={storage}
                onChange={(e) => setStorage(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-tk-stone focus:outline-none focus:ring-2 focus:ring-tk-jade/25 focus:border-tk-jade font-semibold text-sm text-tk-ink bg-white"
              >
                <option value="fridge">Ngăn mát</option>
                <option value="freezer">Ngăn đông</option>
                <option value="pantry">Tủ đồ khô</option>
              </select>
            </div>
          </div>

          {/* Storage Presets */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'fridge', label: 'Ngăn mát', Icon: ZoneCoolIcon, tone: 'jade' as const },
              { id: 'freezer', label: 'Ngăn đông', Icon: ZoneFreezeIcon, tone: 'ink' as const },
              { id: 'pantry', label: 'Đồ khô', Icon: ZonePantryIcon, tone: 'turmeric' as const },
            ].map((preset) => {
              const PresetIcon = preset.Icon;
              const selected = storage === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setStorage(preset.id)}
                  aria-pressed={selected}
                  className={clsx(
                    'flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition-colors cursor-pointer',
                    selected
                      ? 'border-tk-jade bg-tk-jade-soft text-tk-jade-deep'
                      : 'border-tk-stone bg-white text-tk-secondary hover:bg-tk-sunken',
                  )}
                >
                  <PresetIcon size={14} tone={preset.tone} active={selected} />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>

          <div>
            <p
              id="add-expiry-label"
              className="block text-xs font-bold text-tk-secondary mb-1.5"
            >
              Hạn sử dụng dự kiến
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="add-expiry-label">
              {[
                { days: 0, label: 'Chưa rõ' },
                { days: 2, label: '2 ngày' },
                { days: 5, label: '5 ngày' },
                { days: 10, label: '10 ngày' },
                { days: 30, label: '1 tháng' },
              ].map((d) => (
                <button
                  key={d.days}
                  type="button"
                  onClick={() => setExpiryDays(d.days)}
                  aria-pressed={expiryDays === d.days}
                  className={clsx(
                    'flex-1 min-w-[60px] py-2 rounded-xl text-xs font-bold border transition-tap tap-target cursor-pointer',
                    expiryDays === d.days
                      ? 'bg-tk-jade-soft border-tk-jade text-tk-jade-deep'
                      : 'bg-white border-tk-stone text-tk-secondary hover:bg-tk-sunken',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <Button fullWidth size="lg" type="submit" isLoading={addItem.isPending}>
              Lưu vào tủ lạnh
            </Button>
          </div>
        </form>
      </BottomSheet>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Xóa nguyên liệu?"
        description="Nguyên liệu này sẽ bị xóa khỏi tủ lạnh của bạn."
        confirmText="Xóa"
        destructive
        onConfirm={() => {
          if (pendingDelete) {
            setMutationError(null);
            setRefetchFailed(false);
            deleteItem.mutate(pendingDelete);
          }
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
