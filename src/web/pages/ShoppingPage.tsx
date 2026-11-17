import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CANONICAL_INGREDIENTS } from '@frigo/domain';
import { Plus, Trash2, ArrowRight, Pencil, X, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { KitchenHeader, KitchenPageHeading } from '../components/common/KitchenHeader';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { InlineError } from '../components/common/AsyncState';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
  SlideDrawer,
} from '../design-system/v4/AtelierPrimitives';
import {
  NavShoppingIcon,
  NavFridgeIcon,
  CatVegetableIcon,
  CatMeatIcon,
  CatDairyEggIcon,
  CatGrainDryIcon,
  CatOtherIcon,
  ZoneCoolIcon,
  ZoneFreezeIcon,
  ZonePantryIcon,
  FreshnessShieldIcon,
  ReceiptScanIcon,
} from '../design-system/icons';
import { useModalFocus } from '../design-system/use-modal-focus';
import { shoppingApi, type ShoppingInput, type ShoppingItem } from '../services/shopping';
import { ApiError, createClientItemId } from '../services/http';
import { queryKeys } from '../lib/queryKeys';
import { invalidateInventoryDependents } from '../lib/query-invalidation';
import { parseShoppingForm, SHOPPING_UNITS, shoppingQuantity } from '../lib/shopping-form';
import { ShoppingDemandReview } from '../features/ShoppingDemandReview';

type AisleId = 'produce' | 'meat_seafood' | 'dairy_eggs' | 'pantry_spice' | 'other';
type StorageZone = 'fridge' | 'freezer' | 'pantry';

interface AisleMeta {
  id: AisleId;
  titleVi: string;
  subtitleVi: string;
  defaultZone: StorageZone;
  icon: React.ReactNode;
}

const AISLE_DEFINITIONS: AisleMeta[] = [
  {
    id: 'produce',
    titleVi: 'Quầy Rau Củ & Thảo Mộc',
    subtitleVi: 'Rau xanh, củ quả tươi, hành tỏi, nấm, trái cây',
    defaultZone: 'fridge',
    icon: <CatVegetableIcon size={20} tone="jade" active />,
  },
  {
    id: 'meat_seafood',
    titleVi: 'Quầy Thịt & Hải Sản',
    subtitleVi: 'Thịt heo, bò, gà, cá, tôm mực tươi sống',
    defaultZone: 'fridge',
    icon: <CatMeatIcon size={20} tone="flame" active />,
  },
  {
    id: 'dairy_eggs',
    titleVi: 'Trứng, Sữa & Đậu Phụ',
    subtitleVi: 'Trứng gia cầm, đậu phụ, sữa tươi, phô mai, bơ',
    defaultZone: 'fridge',
    icon: <CatDairyEggIcon size={20} tone="turmeric" active />,
  },
  {
    id: 'pantry_spice',
    titleVi: 'Gạo, Đồ Khô & Gia Vị',
    subtitleVi: 'Gạo, bún phở khô, nước mắm, dầu ăn, gia vị nêm',
    defaultZone: 'pantry',
    icon: <CatGrainDryIcon size={20} tone="turmeric" active />,
  },
  {
    id: 'other',
    titleVi: 'Mặt Hàng Khác',
    subtitleVi: 'Các nguyên liệu bổ sung ngoài quầy chính',
    defaultZone: 'fridge',
    icon: <CatOtherIcon size={20} tone="ink" active />,
  },
];

const CANONICAL_BY_ID = new Map(CANONICAL_INGREDIENTS.map((ing) => [ing.id, ing]));

function classifyAisle(item: ShoppingItem): AisleId {
  if (item.ingredientId) {
    const canonical = CANONICAL_BY_ID.get(item.ingredientId);
    if (canonical) {
      const cat = canonical.category.toLowerCase();
      if (cat.includes('veg') || cat.includes('fruit') || cat.includes('herb') || cat.includes('mushroom'))
        return 'produce';
      if (cat.includes('meat') || cat.includes('poultry') || cat.includes('seafood') || cat.includes('fish'))
        return 'meat_seafood';
      if (cat.includes('dairy') || cat.includes('egg') || cat.includes('tofu'))
        return 'dairy_eggs';
      if (
        cat.includes('grain') ||
        cat.includes('spice') ||
        cat.includes('sauce') ||
        cat.includes('condiment') ||
        cat.includes('dry') ||
        cat.includes('oil')
      )
        return 'pantry_spice';
    }
  }

  const text = `${item.name} ${item.ingredientId ?? ''}`.toLocaleLowerCase('vi');
  if (
    /rau|cải|xà lách|hành|tỏi|ớt|gừng|sả|chanh|cà chua|cà rốt|khoai|bí|bầu|mướp|dưa|nấm|ngò|mùi|húng|thì là|bắp cải|su hào|đậu bắp|giá đỗ|trái cây|chuối|táo|cam|xoài/.test(
      text,
    )
  ) {
    return 'produce';
  }
  if (
    /thịt|bò|heo|lợn|gà|vịt|sườn|ba chỉ|nạc|cá|tôm|mực|cua|nghêu|ngao|sò|ốc|hải sản|chả|xúc xích|giò/.test(
      text,
    )
  ) {
    return 'meat_seafood';
  }
  if (/trứng|sữa|đậu phụ|đậu hũ|phô mai|bơ|sữa chua|kem tươi/.test(text)) {
    return 'dairy_eggs';
  }
  if (
    /gạo|bún|phở|mì|miến|hủ tiếu|nui|bánh tráng|muối|đường|mắm|nước tương|xì dầu|dầu|tiêu|bột|hạt nêm|tương ớt|giấm|mè|vừng|đậu xanh|đậu đen|hành phi|khô/.test(
      text,
    )
  ) {
    return 'pantry_spice';
  }
  return 'other';
}

function inferStorageZone(item: ShoppingItem): StorageZone {
  if (item.ingredientId) {
    const canonical = CANONICAL_BY_ID.get(item.ingredientId);
    const cat = canonical?.category?.toLowerCase() ?? '';
    if (cat.includes('frozen')) return 'freezer';
    if (cat.includes('grain') || cat.includes('spice') || cat.includes('sauce') || cat.includes('dry') || cat.includes('oil')) {
      return 'pantry';
    }
  }
  const text = item.name.toLocaleLowerCase('vi');
  if (/đông lạnh|đá|kem/.test(text)) return 'freezer';
  const aisle = classifyAisle(item);
  if (aisle === 'pantry_spice') return 'pantry';
  return 'fridge';
}

const ZONE_META: Record<StorageZone, { label: string; icon: React.ReactNode }> = {
  fridge: { label: 'Ngăn mát', icon: <ZoneCoolIcon size={16} tone="jade" active /> },
  freezer: { label: 'Ngăn đá', icon: <ZoneFreezeIcon size={16} tone="ink" active /> },
  pantry: { label: 'Tủ khô', icon: <ZonePantryIcon size={16} tone="turmeric" active /> },
};

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
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [importedCelebration, setImportedCelebration] = useState<number | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const refresh = () => client.invalidateQueries({ queryKey: shoppingKey });
  const accept = (result: { pendingSync?: boolean }) => {
    setImportedCelebration(null);
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

  const remove = useMutation({
    mutationFn: shoppingApi.deleteShoppingItem,
    onSuccess: accept,
  });

  const importToFridge = useMutation({
    mutationFn: (itemIds: string[]) => shoppingApi.importPurchasedToFridge(itemIds),
    onSuccess: async (res) => {
      setImportDrawerOpen(false);
      setReceipt('');
      setImportedCelebration(res.importedCount);
      await Promise.all([refresh(), invalidateInventoryDependents()]);
    },
  });

  const listBusy =
    add.isPending ||
    toggle.isPending ||
    remove.isPending ||
    cannotBuy.isPending ||
    importToFridge.isPending;
  const busy = listBusy || reviewBusy;
  const mutationError =
    add.error ?? toggle.error ?? remove.error ?? cannotBuy.error ?? importToFridge.error;

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
    importToFridge.reset();
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

  const groupedRemaining = useMemo(() => {
    const buckets = new Map<AisleId, ShoppingItem[]>();
    for (const def of AISLE_DEFINITIONS) buckets.set(def.id, []);
    for (const item of remaining) {
      const aisle = classifyAisle(item);
      buckets.get(aisle)!.push(item);
    }
    return AISLE_DEFINITIONS.map((aisle) => ({
      aisle,
      items: buckets.get(aisle.id) ?? [],
    })).filter((entry) => entry.items.length > 0);
  }, [remaining]);

  const checkedByZone = useMemo(() => {
    const groups: Record<StorageZone, ShoppingItem[]> = {
      fridge: [],
      freezer: [],
      pantry: [],
    };
    for (const item of checked) {
      groups[inferStorageZone(item)].push(item);
    }
    return groups;
  }, [checked]);

  function row(item: ShoppingItem) {
    const sources = item.contributions ?? [];
    const titles = [...new Set(sources.map((source) => source.title))];
    return (
      <li
        key={item.id}
        className={clsx(
          'shopping-saved-row rounded-2xl border p-3.5 sm:p-4 transition-colors',
          item.isChecked
            ? 'is-checked border-tk-jade/25 bg-tk-jade-soft/35'
            : item.cannotBuy
              ? 'is-unavailable border-tk-berry/25 bg-tk-berry-soft/30'
              : 'border-tk-stone bg-white shadow-xs hover:border-tk-ink/20',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <label className="shopping-check-label flex items-start gap-3 min-w-0 flex-1 cursor-pointer">
            <input
              type="checkbox"
              checked={item.isChecked}
              disabled={busy}
              aria-label={`Đã mua: ${item.name}`}
              onChange={(event) => {
                clearErrors();
                toggle.mutate({ id: item.id, checked: event.target.checked });
              }}
              className="mt-0.5 w-5 h-5 rounded-lg accent-tk-jade shrink-0 cursor-pointer"
            />
            <span className="min-w-0 flex flex-col gap-0.5">
              <strong
                className={clsx(
                  'font-heading font-bold text-sm leading-snug',
                  item.isChecked ? 'line-through text-tk-muted' : 'text-tk-ink',
                )}
              >
                {item.name}
              </strong>
              <span className="shopping-row-quantity text-xs font-extrabold text-tk-jade-deep tk-tabular">
                {shoppingQuantity(item.quantity, item.unit)}
                {item.unknownDemand
                  ? ' · Lượng bạn chọn'
                  : item.quantityOverridden && ' · lượng đã chỉnh'}
              </span>
              {item.unknownDemand && (
                <span className="shopping-demand-badge text-[11px] font-semibold text-tk-turmeric-deep">
                  Tổng lượng theo thực đơn chưa xác định
                  {item.reviewState === 'pending' && ' · cần chọn lại cho lượt này'}
                </span>
              )}
              {titles.length > 0 ? (
                <span className="shopping-row-source text-xs text-tk-muted">
                  Cho {titles.slice(0, 2).join(', ')}
                  {titles.length > 2 && ` và ${titles.length - 2} món khác`}
                </span>
              ) : (
                item.sourceRecipeTitle && (
                  <span className="shopping-row-source text-xs text-tk-muted">
                    Cho {item.sourceRecipeTitle}
                  </span>
                )
              )}
              {item.pendingSync && (
                <span className="shopping-pending-label text-[11px] font-bold text-tk-turmeric-deep">
                  Chờ đồng bộ
                </span>
              )}
              {item.cannotBuy && (
                <span className="shopping-unavailable-label text-[11px] font-semibold text-tk-berry-deep">
                  Chưa mua được · xem bữa liên quan để đổi món
                </span>
              )}
            </span>
          </label>

          <div className="shopping-row-actions flex items-center gap-1 shrink-0">
            <button
              type="button"
              className="planning-icon-button tap-target w-9 h-9 rounded-xl border border-tk-stone/80 bg-tk-canvas hover:bg-tk-sunken text-tk-secondary hover:text-tk-ink flex items-center justify-center cursor-pointer transition-colors"
              disabled={busy}
              onClick={() => setEditing(item)}
              aria-label={`Sửa số lượng: ${item.name}`}
            >
              <Pencil size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="planning-icon-button tap-target w-9 h-9 rounded-xl border border-tk-stone/80 bg-tk-canvas hover:bg-tk-berry-soft text-tk-secondary hover:text-tk-berry-deep flex items-center justify-center cursor-pointer transition-colors"
              disabled={busy}
              onClick={() => setRemoving(item)}
              aria-label={`Xóa khỏi danh sách: ${item.name}`}
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-tk-stone/50">
          {sources.length > 0 ? (
            <details className="shopping-source-details text-xs text-tk-secondary flex-1 min-w-[180px]">
              <summary className="cursor-pointer font-semibold text-tk-muted hover:text-tk-ink">
                Dùng cho bữa nào?
              </summary>
              <ul className="mt-1.5 space-y-1 rounded-xl bg-tk-sunken/60 p-2.5">
                {sources.map((source, index) => (
                  <li
                    key={`${source.slotId}:${source.componentId}:${index}`}
                    className="flex flex-wrap justify-between gap-2"
                  >
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
                          className="font-bold text-tk-jade hover:underline"
                        >
                          {source.title}
                        </Link>
                      ) : (
                        source.title
                      )}
                    </span>
                    <span className="tk-tabular font-medium">
                      {source.quantity === null
                        ? 'Lượng món này chưa rõ'
                        : shoppingQuantity(source.quantity, source.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <span />
          )}

          <button
            type="button"
            className="shopping-cannot-buy text-xs font-bold text-tk-muted hover:text-tk-berry-deep cursor-pointer"
            disabled={busy}
            onClick={() => {
              clearErrors();
              cannotBuy.mutate({ id: item.id, unavailable: !item.cannotBuy });
            }}
          >
            {item.cannotBuy ? 'Bỏ dấu chưa mua được' : 'Chưa mua được'}
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="shopping-workspace">
      <KitchenHeader backTo="/" />
      <div className="planning-page-body pb-24">
        <KitchenPageHeading
          eyebrow="Takolio · SIÊU THỊ KHÉP KÍN"
          title="Đi chợ thông minh"
          description="Tự động phân quầy siêu thị để nhặt đồ một tay. Mua xong nhập thẳng vào Tủ lạnh 1 chạm!"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/scan"
                className="inline-flex items-center gap-1.5 rounded-2xl border border-tk-stone bg-white px-3.5 py-2 text-xs font-extrabold text-tk-ink shadow-xs hover:bg-tk-sunken transition-colors"
              >
                <ReceiptScanIcon size={16} tone="flame" active />
                <span>Quét hóa đơn OCR</span>
              </Link>
              <Link
                to="/planner"
                className="inline-flex items-center gap-1.5 rounded-2xl bg-tk-jade-soft border border-tk-jade/25 px-3.5 py-2 text-xs font-extrabold text-tk-jade-deep hover:bg-tk-jade/15 transition-colors"
              >
                <span>Xem thực đơn</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          }
        />

        {/* Celebratory Toast after Closed-Loop Import */}
        {importedCelebration !== null && (
          <BentoCard
            tone="jade"
            padding="md"
            role="status"
            className="mb-5 flex flex-wrap items-center justify-between gap-3 animate-slide-up"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-11 h-11 rounded-2xl bg-white border border-tk-jade/25 flex items-center justify-center shrink-0 shadow-xs">
                <FreshnessShieldIcon size={22} tone="jade" active />
              </span>
              <div className="min-w-0">
                <p className="font-heading font-extrabold text-sm text-tk-ink">
                  Tuyệt vời! Đã nhập {importedCelebration} món mới mua thẳng vào Tủ lạnh FEFO
                </p>
                <p className="text-xs text-tk-secondary mt-0.5">
                  Tồn kho, hạn dùng gợi ý và độ phủ nguyên liệu cho Thực đơn Mâm Cơm đã được cập
                  nhật tức thì.
                </p>
              </div>
            </div>
            <ActionButton
              variant="jade"
              size="sm"
              to="/fridge"
              icon={<NavFridgeIcon size={16} tone="cream" active />}
            >
              Mở Tủ lạnh xem ngay
            </ActionButton>
          </BentoCard>
        )}

        {/* Flagship Closed-Loop Banner when Checked Items > 0 */}
        {checked.length > 0 && (
          <BentoCard
            tone="flame"
            padding="md"
            className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in"
          >
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-11 h-11 rounded-2xl bg-white border border-tk-flame/25 flex items-center justify-center shrink-0 shadow-xs">
                <NavFridgeIcon size={22} tone="flame" active />
              </span>
              <div className="min-w-0">
                <AtelierBadge tone="flame">Khép kín vòng lặp Bếp Việt V4</AtelierBadge>
                <h2 className="font-heading font-extrabold text-base text-tk-ink mt-1.5">
                  Hoàn tất đi chợ → Nhập thẳng vào Tủ lạnh
                </h2>
                <p className="text-xs text-tk-secondary leading-relaxed mt-0.5">
                  Bạn đã tích chọn <strong>{checked.length} nguyên liệu</strong> trong giỏ. Đưa toàn
                  bộ vào Ngăn mát / Ngăn đá / Tủ khô chỉ với 1 chạm, không cần gõ lại!
                </p>
              </div>
            </div>
            <ActionButton
              variant="flame"
              size="md"
              disabled={busy || query.data?.source === 'device'}
              icon={<NavFridgeIcon size={18} tone="cream" active />}
              onClick={() => setImportDrawerOpen(true)}
            >
              Nhập {checked.length} món đã mua vào Tủ lạnh
            </ActionButton>
          </BentoCard>
        )}

        <div className="saved-shopping-layout">
          <details
            className="shopping-add-panel rounded-[24px] border border-tk-stone bg-white p-5 shadow-card self-start"
            open={addOpen}
            onToggle={(event) => setAddOpen(event.currentTarget.open)}
          >
            <summary className="cursor-pointer font-heading font-extrabold text-base text-tk-ink flex items-center justify-between gap-2">
              <span>Thêm nhanh ngoài thực đơn</span>
              <Plus size={18} className="text-tk-flame shrink-0" aria-hidden="true" />
            </summary>

            <form onSubmit={submit} className="shopping-add-form mt-4 space-y-3.5">
              <fieldset disabled={busy || !!attempt} className="space-y-3">
                <label className="block text-xs font-bold text-tk-ink">
                  Tên nguyên liệu
                  <input
                    name="shopping-name"
                    autoComplete="off"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ví dụ: Rau muống, Thịt ba chỉ, Trứng gà…"
                    className="mt-1 w-full min-h-11 rounded-xl border border-tk-stone bg-tk-canvas px-3.5 text-sm font-medium text-tk-ink placeholder:text-tk-muted focus:outline-none focus:ring-2 focus:ring-tk-flame"
                  />
                </label>
                <div className="shopping-amount-fields grid grid-cols-2 gap-2.5">
                  <label className="block text-xs font-bold text-tk-ink">
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
                      className="mt-1 w-full min-h-11 rounded-xl border border-tk-stone bg-tk-canvas px-3 text-sm font-bold text-tk-ink tk-tabular focus:outline-none focus:ring-2 focus:ring-tk-flame"
                    />
                  </label>
                  <label className="block text-xs font-bold text-tk-ink">
                    Đơn vị
                    <select
                      name="shopping-unit"
                      value={unit}
                      onChange={(event) => setUnit(event.target.value)}
                      className="mt-1 w-full min-h-11 rounded-xl border border-tk-stone bg-white px-3 text-sm font-semibold text-tk-ink focus:outline-none focus:ring-2 focus:ring-tk-flame"
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
                <p className="planning-note text-xs font-semibold text-tk-turmeric-deep">
                  Thử lại đúng món và lượng vừa gửi để tránh thêm trùng.
                </p>
              )}
              <Button
                type="submit"
                fullWidth
                isLoading={add.isPending}
                disabled={busy && !add.isPending}
              >
                <Plus size={18} aria-hidden="true" className="mr-1.5" />
                {attempt ? 'Thử lại món vừa gửi' : 'Thêm vào danh sách'}
              </Button>
            </form>

            <div className="mt-4 pt-3.5 border-t border-tk-stone/70 space-y-2">
              <p className="text-xs text-tk-muted leading-relaxed">
                Takolio tự động xếp món mới vào đúng quầy siêu thị. Đánh dấu đã mua để nhập 1 chạm
                vào Tủ lạnh, hoặc chụp hóa đơn siêu thị OCR.
              </p>
              <Link
                to="/scan"
                className="inline-flex items-center gap-1 text-xs font-extrabold text-tk-flame hover:underline"
              >
                Quét hóa đơn / thực phẩm đã mua <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </details>

          <section className="shopping-saved-list space-y-4" aria-labelledby="saved-list-heading">
            <BentoCard
              tone="ceramic"
              padding="sm"
              className="shopping-list-heading flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-tk-jade-soft border border-tk-jade/20 flex items-center justify-center shrink-0">
                  <NavShoppingIcon size={22} tone="jade" active />
                </span>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-tk-jade">
                    GIỎ ĐI CHỢ GIA ĐÌNH
                  </p>
                  <h2
                    id="saved-list-heading"
                    className="font-heading font-extrabold text-lg text-tk-ink tk-tabular"
                  >
                    Cần mua <span className="text-tk-flame">{remaining.length}</span> món
                  </h2>
                </div>
              </div>

              <div className="shopping-count-summary flex flex-wrap items-center gap-2">
                <AtelierBadge tone={checked.length > 0 ? 'jade' : 'neutral'}>
                  {checked.length} đã mua
                </AtelierBadge>
                {needsReviewCount > 0 && (
                  <span className="shopping-review-count inline-flex items-center rounded-full border border-tk-turmeric/30 bg-tk-turmeric-soft px-2.5 py-1 text-xs font-bold text-tk-turmeric-deep tk-tabular">
                    {needsReviewCount} nguyên liệu cần chọn lượng
                  </span>
                )}
              </div>
            </BentoCard>

            {query.data?.source === 'device' && (
              <p
                role="status"
                className="planning-notice rounded-2xl border border-tk-turmeric/30 bg-tk-turmeric-soft px-4 py-3 text-xs font-semibold text-tk-turmeric-deep"
              >
                Đang xem bản lưu trên thiết bị; các thay đổi ở dòng mua sẽ đồng bộ khi có kết nối.
                Việc chọn lượng chưa rõ hoặc nhập thẳng vào tủ lạnh cần kết nối mạng.
              </p>
            )}

            {(invalid || mutationError) && (
              <div ref={errorRef} tabIndex={-1} className="planning-error-focus">
                {invalid ? (
                  <p
                    role="alert"
                    className="rounded-2xl border border-tk-berry/25 bg-tk-berry-soft px-4 py-3 text-sm font-semibold text-tk-berry-deep"
                  >
                    Nhập tên, số lượng lớn hơn 0 và chọn đơn vị.
                  </p>
                ) : (
                  <InlineError message="Chưa xác nhận được thay đổi. Hãy thử lại thao tác vừa gửi." />
                )}
              </div>
            )}

            <p
              role="status"
              className={
                receipt
                  ? 'planning-receipt rounded-2xl border border-tk-jade/25 bg-tk-jade-soft px-4 py-2.5 text-xs font-bold text-tk-jade-deep'
                  : 'planning-receipt sr-only'
              }
            >
              {receipt}
            </p>

            {query.isError && !query.data ? (
              <InlineError error={query.error} onRetry={() => void query.refetch()} />
            ) : query.isPending ? (
              <BentoCard tone="ceramic" padding="md">
                <p role="status" className="text-sm font-semibold text-tk-secondary">
                  Đang tải danh sách đi chợ…
                </p>
              </BentoCard>
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

                {remaining.length > 0 ? (
                  <div className="shopping-item-list space-y-5">
                    {groupedRemaining.map(({ aisle, items: aisleItems }) => (
                      <div key={aisle.id} className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2 px-1">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-xl bg-white border border-tk-stone flex items-center justify-center shrink-0 shadow-xs">
                              {aisle.icon}
                            </span>
                            <div className="min-w-0">
                              <h3 className="font-heading font-extrabold text-sm text-tk-ink truncate">
                                {aisle.titleVi}
                              </h3>
                              <p className="text-[11px] text-tk-muted truncate hidden sm:block">
                                {aisle.subtitleVi}
                              </p>
                            </div>
                          </div>
                          <AtelierBadge tone="neutral">{aisleItems.length} món</AtelierBadge>
                        </div>
                        <ul className="space-y-2.5">{aisleItems.map(row)}</ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <BentoCard
                    tone="ceramic"
                    padding="lg"
                    className="shopping-empty text-center space-y-3"
                  >
                    <div className="w-14 h-14 rounded-3xl bg-tk-jade-soft border border-tk-jade/20 flex items-center justify-center mx-auto">
                      <NavShoppingIcon size={28} tone="jade" active />
                    </div>
                    <h3 className="font-heading font-extrabold text-lg text-tk-ink">
                      {needsReviewCount
                        ? 'Còn nguyên liệu cần chọn lượng'
                        : items.length
                          ? 'Đã mua xong các dòng có lượng'
                          : demands.length
                            ? 'Các dòng chưa rõ lượng đã được rà'
                            : 'Chưa có nguyên liệu cần mua'}
                    </h3>
                    <p className="text-sm text-tk-secondary max-w-md mx-auto leading-relaxed">
                      {needsReviewCount
                        ? 'Chọn lượng hoặc tạm bỏ qua ở phần trên trước khi đi chợ.'
                        : checked.length > 0
                          ? 'Bạn đã gom đủ nguyên liệu vào giỏ! Nhấn nút Nhập vào Tủ lạnh để hoàn tất chuyến đi chợ.'
                          : demands.length
                            ? 'Mở phần đã chọn hoặc đã bỏ qua nếu bạn muốn xem lại.'
                            : 'Lên thực đơn Mâm Cơm 7 ngày để Takolio tự động gom nguyên liệu còn thiếu vào từng quầy siêu thị.'}
                    </p>
                    <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
                      {checked.length > 0 && (
                        <ActionButton
                          variant="flame"
                          size="md"
                          disabled={busy || query.data?.source === 'device'}
                          icon={<NavFridgeIcon size={17} tone="cream" active />}
                          onClick={() => setImportDrawerOpen(true)}
                        >
                          Nhập {checked.length} món đã mua vào Tủ lạnh
                        </ActionButton>
                      )}
                      <Link
                        to="/planner"
                        className="planning-text-link inline-flex items-center gap-1.5 rounded-2xl border border-tk-stone bg-tk-canvas px-4 py-2.5 text-xs font-extrabold text-tk-ink hover:bg-tk-sunken transition-colors"
                      >
                        Lên thực đơn <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    </div>
                  </BentoCard>
                )}

                {checked.length > 0 && (
                  <details
                    className="shopping-bought rounded-[24px] border border-tk-jade/25 bg-white p-4 shadow-xs"
                    open={remaining.length === 0}
                  >
                    <summary className="cursor-pointer font-heading font-extrabold text-sm text-tk-jade-deep flex items-center justify-between gap-2">
                      <span>Đã bỏ vào giỏ · {checked.length} dòng</span>
                      <span className="text-xs font-bold text-tk-muted">Chạm để mở / thu gọn</span>
                    </summary>
                    <ul className="shopping-checked-list mt-3 space-y-2.5">{checked.map(row)}</ul>
                  </details>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* Sticky Mobile Closed-Loop Action Bar when Checked Items > 0 */}
      {checked.length > 0 && !importDrawerOpen && (
        <div className="fixed bottom-18 lg:bottom-5 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-lg pointer-events-none">
          <div className="pointer-events-auto rounded-3xl bg-tk-sanctuary text-white p-3 shadow-elevated border border-white/15 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 pl-1">
              <span className="w-9 h-9 rounded-2xl bg-tk-jade flex items-center justify-center shrink-0">
                <Check size={18} className="text-white" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-white truncate">
                  Đã mua {checked.length}/{items.length} món
                </p>
                <p className="text-[11px] text-white/70 truncate">
                  Sẵn sàng chuyển vào Tủ lạnh FEFO
                </p>
              </div>
            </div>
            <ActionButton
              variant="flame"
              size="sm"
              disabled={busy || query.data?.source === 'device'}
              onClick={() => setImportDrawerOpen(true)}
            >
              Nhập {checked.length} món vào Tủ
            </ActionButton>
          </div>
        </div>
      )}

      {/* Closed-Loop Import Confirmation Drawer */}
      <SlideDrawer
        open={importDrawerOpen}
        onClose={() => {
          if (!importToFridge.isPending) setImportDrawerOpen(false);
        }}
        title="Hoàn tất đi chợ → Nhập vào Tủ lạnh"
        subtitle={`Kiểm tra phân ngăn tự động cho ${checked.length} nguyên liệu bạn vừa mua`}
        footer={
          <div className="flex flex-col sm:flex-row gap-2.5">
            <ActionButton
              variant="ceramic"
              size="md"
              disabled={importToFridge.isPending}
              onClick={() => setImportDrawerOpen(false)}
            >
              Quay lại giỏ hàng
            </ActionButton>
            <ActionButton
              variant="jade"
              size="lg"
              fullWidth
              loading={importToFridge.isPending}
              icon={<NavFridgeIcon size={18} tone="cream" active />}
              onClick={() => importToFridge.mutate(checked.map((item) => item.id))}
            >
              Xác nhận nhập {checked.length} món vào Tủ lạnh
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-4">
          <BentoCard tone="jade" padding="sm" className="space-y-1">
            <p className="text-xs font-extrabold text-tk-jade-deep">
              Tự động gợi ý hạn dùng FEFO &amp; xoá khỏi danh sách đi chợ
            </p>
            <p className="text-xs text-tk-secondary leading-relaxed">
              Mỗi nguyên liệu sẽ được tạo lô mới trong Tủ lạnh gia đình kèm hạn dùng ước tính an
              toàn. Bạn luôn có thể chỉnh lại ngày hết hạn trong Tủ lạnh bất cứ lúc nào.
            </p>
          </BentoCard>

          {(['fridge', 'freezer', 'pantry'] as const).map((zone) => {
            const zoneItems = checkedByZone[zone];
            if (!zoneItems.length) return null;
            const meta = ZONE_META[zone];
            return (
              <div key={zone} className="space-y-2">
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="inline-flex items-center gap-2 font-heading font-extrabold text-xs uppercase tracking-wider text-tk-ink">
                    {meta.icon}
                    <span>{meta.label}</span>
                  </span>
                  <AtelierBadge tone="neutral">{zoneItems.length} món</AtelierBadge>
                </div>
                <ul className="divide-y divide-tk-stone/70 rounded-2xl border border-tk-stone bg-white overflow-hidden">
                  {zoneItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <span className="font-bold text-tk-ink truncate">{item.name}</span>
                      <span className="font-extrabold text-xs text-tk-jade-deep tk-tabular shrink-0">
                        {shoppingQuantity(item.quantity, item.unit)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </SlideDrawer>

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
    <div className="planning-picker fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-tk-sanctuary/55 backdrop-blur-xs p-0 sm:p-4">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopping-edit-title"
        className="family-dialog w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white border border-tk-stone shadow-elevated p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="shopping-edit-title" className="font-heading font-extrabold text-lg text-tk-ink">
            Chỉnh món cần mua
          </h2>
          <Button variant="ghost" aria-label="Đóng" disabled={save.isPending} onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </Button>
        </div>
        <form
          className="family-settings-form space-y-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseShoppingForm(name, quantity, unit);
            setInvalid(!parsed);
            if (parsed) save.mutate(parsed);
          }}
        >
          <fieldset disabled={save.isPending} className="space-y-3">
            <label className="block text-xs font-bold text-tk-ink">
              Tên nguyên liệu
              <input
                required
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full min-h-11 rounded-xl border border-tk-stone bg-tk-canvas px-3 text-sm font-semibold text-tk-ink focus:outline-none focus:ring-2 focus:ring-tk-flame"
              />
            </label>
            <div className="family-field-pair grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-tk-ink">
                Số lượng
                <input
                  type="number"
                  step="any"
                  min={Number.MIN_VALUE}
                  required
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="mt-1 w-full min-h-11 rounded-xl border border-tk-stone bg-tk-canvas px-3 text-sm font-bold text-tk-ink tk-tabular focus:outline-none focus:ring-2 focus:ring-tk-flame"
                />
              </label>
              <label className="block text-xs font-bold text-tk-ink">
                Đơn vị
                <select
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  className="mt-1 w-full min-h-11 rounded-xl border border-tk-stone bg-white px-3 text-sm font-semibold text-tk-ink focus:outline-none focus:ring-2 focus:ring-tk-flame"
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
          {item.generated && (
            <p className="planning-note text-xs text-tk-muted">
              {item.unknownDemand
                ? 'Bạn đang chỉnh lượng muốn mua. Tổng lượng theo thực đơn vẫn chưa xác định; thay đổi này không xác nhận nhu cầu của món.'
                : 'Lượng bạn chỉnh được giữ khi cập nhật lại thực đơn.'}
            </p>
          )}
          {invalid && (
            <p role="alert" className="text-xs font-bold text-tk-berry-deep">
              Nhập tên và số lượng lớn hơn 0.
            </p>
          )}
          {save.isError && <InlineError error={save.error} />}
          <Button type="submit" fullWidth isLoading={save.isPending}>
            Lưu lượng cần mua
          </Button>
        </form>
      </div>
    </div>
  );
}
