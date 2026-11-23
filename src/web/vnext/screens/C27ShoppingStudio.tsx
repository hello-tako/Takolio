import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { findOperationalIngredientById } from '@frigo/domain';
import type {
  ReviewShoppingDemandInput,
  ShoppingUnknownDemand,
} from '../../../../packages/domain/src/shopping-plan-api';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  shoppingApi,
  type ShoppingInput,
  type ShoppingItem,
  type ShoppingUnresolvedItem,
} from '../../services/shopping';
import { ApiError, createClientItemId } from '../../services/http';
import { queryKeys } from '../../lib/queryKeys';
import { parseShoppingForm, SHOPPING_UNITS } from '../../lib/shopping-form';
import { getIngredientImage } from '../../lib/ingredient-images';
import { capturePrivateSession, onPrivateSessionReset } from '../../lib/private-session';
import { usePlanner } from '../../features/planner/usePlanner';
import { plannerErrorMessage } from '../../features/planner/presentation';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useModalFocus } from '../../design-system/use-modal-focus';
import {
  TkvButton,
  TkvEmptyState,
  TkvErrorState,
  TkvSurface,
} from '../components/Primitives';
import { BrandFeatureIcon, MascotIllustration } from '../components/VNextMedia';
import { VNextIcon } from '../components/VNextIcons';
import { ShoppingListSkeleton } from '../components/Skeletons';
import { showTkvToast } from '../components/LivingMotion';
import { formatKitchenAmount, syncPlanToShoppingList } from '../lib/planner-workbench';
import { useVNextSeo } from '../lib/seo';

type AisleKey = 'produce' | 'protein' | 'dairy_egg' | 'pantry' | 'other';
type PurchaseUnit = Extract<ReviewShoppingDemandInput, { action: 'purchase' }>['unit'];

const AISLE_META: ReadonlyArray<{ id: AisleKey; label: string }> = [
  { id: 'produce', label: 'Rau củ & trái cây' },
  { id: 'protein', label: 'Thịt, cá & hải sản' },
  { id: 'dairy_egg', label: 'Trứng, sữa & đậu hũ' },
  { id: 'pantry', label: 'Đồ khô & gia vị' },
  { id: 'other', label: 'Mục cần mua khác' },
];

const MEAL_SHORT_VI: Record<string, string> = {
  breakfast: 'Sáng',
  lunch: 'Trưa',
  dinner: 'Tối',
};

function classifyShoppingAisle(item: ShoppingItem): AisleKey {
  if (item.ingredientId) {
    const canonical = findOperationalIngredientById(item.ingredientId);
    if (canonical) {
      switch (canonical.category) {
        case 'vegetable':
        case 'fruit':
          return 'produce';
        case 'meat':
        case 'seafood':
          return 'protein';
        case 'egg':
        case 'dairy':
          return 'dairy_egg';
        case 'grain':
        case 'spice':
          return 'pantry';
        default:
          break;
      }
    }
  }

  const text = `${item.name} ${item.ingredientId ?? ''}`.toLowerCase();
  if (
    /(rau|cải|cà chua|cà rốt|hành|tỏi|ớt|gừng|sả|khoai|bí|nấm|dưa|chuối|táo|cam|chanh|ngò|mùi|bắp|đậu bắp|mướp|bầu|su hào|bông cải|xà lách|rau muống|mồng tơi)/.test(
      text,
    )
  ) {
    return 'produce';
  }
  if (
    /(thịt|gà|bò|heo|lợn|cá|tôm|mực|cua|hải sản|sườn|ba chỉ|xúc xích|chả|ngao|nghêu|ốc|vịt)/.test(
      text,
    )
  ) {
    return 'protein';
  }
  if (/(trứng|sữa|phô mai|bơ|sữa chua|đậu phụ|đậu hũ|tàu hũ)/.test(text)) {
    return 'dairy_egg';
  }
  if (
    /(gạo|mì|bún|phở|miến|nước mắm|muối|đường|tiêu|dầu|tương|bột|hạt nêm|giấm|mắm|sa tế|nước dừa)/.test(
      text,
    )
  ) {
    return 'pantry';
  }
  return 'other';
}

function isReviewableDemand(item: ShoppingUnresolvedItem): item is ShoppingUnknownDemand {
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

/**
 * When every contribution in an unresolved demand row has a valid positive numeric quantity
 * in compatible units (e.g. repeating-decimal float scaling like 13.333333333333334 g),
 * computes a clean kitchen-rounded suggested purchase total for 1-tap user confirmation.
 * Returns `null` whenever any contribution has an unknown (`null`) quantity or mixed
 * incompatible units — strictly preserving honesty without fabricating weights.
 */
export function estimateDemandSuggestion(
  demand: ShoppingUnresolvedItem,
): { quantity: number; unit: PurchaseUnit; mealCount: number } | null {
  const contributions = demand.contributions;
  if (!contributions.length) return null;

  let total = 0;
  let targetUnit: PurchaseUnit | null = null;

  for (const entry of contributions) {
    if (entry.quantity === null || !Number.isFinite(entry.quantity) || entry.quantity <= 0) {
      return null;
    }
    const rawUnit = entry.unit;
    if (rawUnit === 'g' || rawUnit === 'kg') {
      if (targetUnit && targetUnit !== 'g') return null;
      targetUnit = 'g';
      total += rawUnit === 'kg' ? entry.quantity * 1000 : entry.quantity;
    } else if (rawUnit === 'ml' || rawUnit === 'l') {
      if (targetUnit && targetUnit !== 'ml') return null;
      targetUnit = 'ml';
      total += rawUnit === 'l' ? entry.quantity * 1000 : entry.quantity;
    } else if (SHOPPING_UNITS.some((u) => u.value === rawUnit)) {
      const castUnit = rawUnit as PurchaseUnit;
      if (targetUnit && targetUnit !== castUnit) return null;
      targetUnit = castUnit;
      total += entry.quantity;
    } else {
      return null;
    }
  }

  if (!targetUnit || total <= 0) return null;

  let rounded: number;
  if (targetUnit === 'g' || targetUnit === 'ml') {
    if (total >= 1000 && Math.round(total / 50) * 50 >= 1000) {
      // Keep in g/ml if < 2000 or cleanly display kg/l when >= 1000 and exact-ish
      const inMajor = Math.round((total / 1000) * 10) / 10;
      if (inMajor >= 1 && Math.abs(inMajor * 1000 - total) <= 50) {
        return {
          quantity: inMajor,
          unit: targetUnit === 'g' ? 'kg' : 'l',
          mealCount: new Set(contributions.map((c) => `${c.planId}:${c.slotId}`)).size,
        };
      }
    }
    if (total >= 25) {
      rounded = Math.max(5, Math.round(total / 5) * 5);
    } else {
      rounded = Math.max(1, Math.round(total));
    }
  } else {
    rounded = Math.max(0.5, Math.round(total * 2) / 2);
  }

  return {
    quantity: rounded,
    unit: targetUnit,
    mealCount: new Set(contributions.map((c) => `${c.planId}:${c.slotId}`)).size,
  };
}

function formatShortDateVi(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}`;
}

function reviewErrorMessage(failure: unknown): string {
  if (failure instanceof ApiError && failure.code === 'SHOPPING_PENDING_SYNC') {
    return 'Danh sách đang chờ đồng bộ. Chờ đồng bộ xong rồi tải lại để xác nhận lượng.';
  }
  if (failure instanceof ApiError && failure.status === 409) {
    return 'Danh sách vừa thay đổi. Bấm tải lại để lấy bản mới nhất.';
  }
  if (failure instanceof ApiError && failure.kind === 'offline') {
    return 'Cần kết nối mạng để xác nhận lượng mua từ thực đơn.';
  }
  return 'Chưa xác nhận được lượng mua. Vui lòng thử lại.';
}

export const C27ShoppingStudio: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const client = useQueryClient();
  const isGuest = useAuthStore((s) => s.isGuest);
  const returnTo = `${location.pathname}${location.search}`;
  const shoppingKey = queryKeys.shoppingList();

  useVNextSeo({
    title: 'Danh sách mua sắm — Takolio',
    description: 'Danh sách đi chợ đồng bộ trực tiếp từ thực đơn tuần, gom theo quầy chợ gọn gàng.',
    canonicalPath: '/shopping',
    domainSurface: 'app',
    noindex: true,
  });

  const planModel = usePlanner(undefined, !isGuest);
  const activePlan = planModel.plan;

  const query = useQuery({
    queryKey: [...shoppingKey, 'snapshot'],
    queryFn: shoppingApi.getShoppingListSnapshot,
    enabled: !isGuest,
    retry: false,
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const demands = useMemo(
    () => query.data?.unresolvedItems ?? [],
    [query.data?.unresolvedItems],
  );
  const pendingDemands = useMemo(
    () => demands.filter((d) => !d.reviewState || d.reviewState === 'pending'),
    [demands],
  );
  const processedDemands = useMemo(
    () =>
      demands
        .filter((d) => d.reviewState === 'purchased' || d.reviewState === 'skipped')
        .filter(isReviewableDemand),
    [demands],
  );

  const remaining = useMemo(() => items.filter((i) => !i.isChecked), [items]);
  const checked = useMemo(() => items.filter((i) => i.isChecked), [items]);

  const [activeTab, setActiveTab] = useState<'remaining' | 'checked'>('remaining');
  const [groupByAisle, setGroupByAisle] = useState(true);
  const [quickMode, setQuickMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [syncDays, setSyncDays] = useState<number | undefined>(undefined);
  const [syncingPlan, setSyncingPlan] = useState(false);
  const [planSyncError, setPlanSyncError] = useState<string | null>(null);

  // Add form state (preserves idempotent retry attempt)
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('piece');
  const [attempt, setAttempt] = useState<ShoppingInput | null>(null);
  const [formInvalid, setFormInvalid] = useState(false);

  // Item dialogs & expanded row details
  const [removing, setRemoving] = useState<ShoppingItem | null>(null);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [expandedSourcesId, setExpandedSourcesId] = useState<string | null>(null);

  // Demand review state
  const [reviewOpen, setReviewOpen] = useState(true);
  const [reviewBusyKey, setReviewBusyKey] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [purchaseDemand, setPurchaseDemand] = useState<ShoppingUnknownDemand | null>(null);
  const [demandQty, setDemandQty] = useState('');
  const [demandUnit, setDemandUnit] = useState<PurchaseUnit>('g');
  const [demandInvalid, setDemandInvalid] = useState(false);

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    const unsub = onPrivateSessionReset(() => {
      setPurchaseDemand(null);
      setReviewBusyKey(null);
      setReviewError(null);
      setAttempt(null);
    });
    return () => {
      aliveRef.current = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!name.trim() && !attempt) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [name, attempt]);

  const refresh = () => client.invalidateQueries({ queryKey: shoppingKey });

  const addMutation = useMutation({
    mutationFn: shoppingApi.addShoppingItem,
    onError: (failure) => {
      if (failure instanceof ApiError && failure.status === 400) setAttempt(null);
    },
    onSuccess: (result) => {
      setName('');
      setQuantity('1');
      setAttempt(null);
      showTkvToast({
        message: result.pendingSync
          ? `Đã lưu tạm “${result.name}” (chờ đồng bộ)`
          : `Đã thêm “${result.name}” vào danh sách`,
        tone: result.pendingSync ? 'info' : 'success',
      });
      return refresh();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isChecked }: { id: string; isChecked: boolean }) =>
      shoppingApi.updateShoppingItem(id, {
        isChecked,
        ...(isChecked ? { cannotBuy: false } : {}),
      }),
    onSuccess: () => refresh(),
  });

  const cannotBuyMutation = useMutation({
    mutationFn: ({ id, unavailable }: { id: string; unavailable: boolean }) =>
      shoppingApi.updateShoppingItem(id, {
        cannotBuy: unavailable,
        ...(unavailable ? { isChecked: false } : {}),
      }),
    onSuccess: () => refresh(),
  });

  const removeMutation = useMutation({
    mutationFn: shoppingApi.deleteShoppingItem,
    onSuccess: () => {
      showTkvToast({ message: 'Đã xóa khỏi danh sách mua sắm', tone: 'info' });
      return refresh();
    },
  });

  const listBusy =
    addMutation.isPending ||
    toggleMutation.isPending ||
    cannotBuyMutation.isPending ||
    removeMutation.isPending;
  const busy = listBusy || Boolean(reviewBusyKey) || syncingPlan;
  const mutationError =
    addMutation.error ??
    toggleMutation.error ??
    cannotBuyMutation.error ??
    removeMutation.error;
  const serverReady =
    query.data?.source === 'server' && !query.data?.hasPendingChanges && !listBusy && !query.isError;

  const aisleGroups = useMemo(() => {
    const map = new Map<AisleKey, ShoppingItem[]>();
    for (const item of remaining) {
      const key = classifyShoppingAisle(item);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return AISLE_META.filter((m) => (map.get(m.id)?.length ?? 0) > 0).map((m) => ({
      ...m,
      items: map.get(m.id)!,
    }));
  }, [remaining]);

  const confirmableDemands = useMemo(() => {
    return pendingDemands
      .filter(isReviewableDemand)
      .map((demand) => ({
        demand,
        suggestion: estimateDemandSuggestion(demand),
      }));
  }, [pendingDemands]);

  const autoConfirmableCount = confirmableDemands.filter((entry) => entry.suggestion !== null).length;

  const handleSyncFromPlan = async () => {
    if (!activePlan || busy) return;
    setPlanSyncError(null);
    setSyncingPlan(true);
    try {
      const res = await syncPlanToShoppingList(client, activePlan, { days: syncDays });
      await query.refetch();
      const totalSynced = res.itemCount;
      showTkvToast({
        message:
          totalSynced > 0
            ? `Đã đồng bộ ${totalSynced} mục nguyên liệu từ thực đơn tuần`
            : res.unresolvedCount > 0
              ? `Có ${res.unresolvedCount} nguyên liệu từ thực đơn cần chốt lượng mua`
              : 'Danh sách đi chợ đã khớp với thực đơn hiện tại',
        tone: 'success',
      });
    } catch (failure) {
      setPlanSyncError(plannerErrorMessage(failure, 'vi'));
    } finally {
      if (aliveRef.current) setSyncingPlan(false);
    }
  };

  const handleAddSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const parsed = attempt ?? parseShoppingForm(name, quantity, unit);
    if (!parsed) {
      setFormInvalid(true);
      return;
    }
    setFormInvalid(false);
    const input = attempt ?? { ...parsed, id: createClientItemId('shop') };
    setAttempt(input);
    addMutation.mutate(input);
  };

  const handleReviewDemand = async (
    demand: ShoppingUnknownDemand,
    input: ReviewShoppingDemandInput,
    busyId: string,
  ) => {
    if (!serverReady || busy) return;
    const isCurrent = capturePrivateSession();
    setReviewError(null);
    setReviewBusyKey(busyId);
    try {
      await shoppingApi.reviewShoppingDemand(input, createClientItemId('shopping_review'));
      if (!aliveRef.current || !isCurrent()) return;
      setPurchaseDemand(null);
      await query.refetch();
      showTkvToast({
        message:
          input.action === 'purchase'
            ? `Đã thêm “${demand.name}” (${formatKitchenAmount(input.quantity, input.unit)})`
            : input.action === 'skip'
              ? `Đã bỏ qua “${demand.name}” trong lượt này`
              : `Đã mở lại “${demand.name}”`,
        tone: input.action === 'purchase' ? 'success' : 'info',
      });
    } catch (failure) {
      if (!aliveRef.current || !isCurrent()) return;
      setReviewError(reviewErrorMessage(failure));
    } finally {
      if (aliveRef.current && isCurrent()) setReviewBusyKey(null);
    }
  };

  const handleConfirmAllSuggested = async () => {
    if (!serverReady || busy) return;
    const targets = confirmableDemands.filter((entry) => entry.suggestion !== null);
    if (targets.length === 0) return;
    const isCurrent = capturePrivateSession();
    setReviewError(null);
    setReviewBusyKey('batch-confirm');
    let confirmed = 0;
    try {
      for (const { demand, suggestion } of targets) {
        if (!suggestion) continue;
        await shoppingApi.reviewShoppingDemand(
          {
            sourceId: demand.sourceId,
            demandKey: demand.demandKey,
            snapshot: demand.snapshot,
            reviewRevision: demand.reviewRevision,
            action: 'purchase',
            quantity: suggestion.quantity,
            unit: suggestion.unit,
          },
          createClientItemId('shopping_review'),
        );
        confirmed += 1;
      }
      if (!aliveRef.current || !isCurrent()) return;
      await query.refetch();
      showTkvToast({
        message: `Đã xác nhận nhanh ${confirmed} nguyên liệu vào danh sách mua sắm`,
        tone: 'success',
      });
    } catch (failure) {
      if (!aliveRef.current || !isCurrent()) return;
      await query.refetch();
      setReviewError(reviewErrorMessage(failure));
    } finally {
      if (aliveRef.current && isCurrent()) setReviewBusyKey(null);
    }
  };

  const openCustomDemandModal = (demand: ShoppingUnknownDemand) => {
    const suggestion = estimateDemandSuggestion(demand);
    setPurchaseDemand(demand);
    setDemandQty(suggestion ? String(suggestion.quantity) : '');
    setDemandUnit(
      suggestion?.unit ??
        (SHOPPING_UNITS.some((u) => u.value === demand.unit)
          ? (demand.unit as PurchaseUnit)
          : 'g'),
    );
    setDemandInvalid(false);
    setReviewError(null);
  };

  const planSpanLabel = useMemo(() => {
    if (!activePlan) return '';
    const dates = [...new Set(activePlan.intent.slots.map((s) => s.date))].sort();
    if (dates.length === 0) return `${activePlan.intent.horizonDays} ngày`;
    if (dates.length === 1) return formatShortDateVi(dates[0]!);
    return `${formatShortDateVi(dates[0]!)} – ${formatShortDateVi(dates[dates.length - 1]!)} (${dates.length} ngày)`;
  }, [activePlan]);

  const renderShoppingRow = (item: ShoppingItem) => {
    const sources = item.contributions ?? [];
    const uniqueTitles = [...new Set(sources.map((s) => s.title))];
    const thumb = getIngredientImage(item.ingredientId ?? undefined, item.name);
    const expanded = expandedSourcesId === item.id;
    const firstPlanSource = sources.find((s) => Boolean(s.planId && s.slotId));

    return (
      <li
        key={item.id}
        data-testid={`c27-shopping-row-${item.id}`}
        className={clsx(
          'px-3.5 transition-colors',
          quickMode ? 'py-2' : 'py-3',
          item.isChecked && 'opacity-70',
          item.cannotBuy && 'bg-[var(--tkv-surface-coral)]/35',
        )}
      >
        <div className="flex items-start sm:items-center justify-between gap-3">
          {/* Check + Info */}
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.isChecked}
              aria-label={item.isChecked ? `Bỏ đánh dấu đã mua: ${item.name}` : `Đã mua: ${item.name}`}
              disabled={busy}
              onClick={() => {
                const nextChecked = !item.isChecked;
                toggleMutation.mutate(
                  { id: item.id, isChecked: nextChecked },
                  {
                    onSuccess: () => {
                      showTkvToast({
                        message: nextChecked
                          ? `Đã mua “${item.name}”`
                          : `Chuyển “${item.name}” về cần mua`,
                        tone: nextChecked ? 'success' : 'info',
                      });
                    },
                  },
                );
              }}
              className={clsx(
                'tkv-focusable w-10 h-10 -ml-1.5 rounded-full inline-flex items-center justify-center shrink-0 transition-colors',
              )}
            >
              <span
                className={clsx(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
                  item.isChecked
                    ? 'bg-[var(--tkv-primary)] border-[var(--tkv-primary)] text-white'
                    : 'bg-[var(--tkv-surface)] border-[var(--tkv-border-strong)] hover:border-[var(--tkv-primary)] text-transparent',
                )}
              >
                <VNextIcon name="check" size={14} />
              </span>
            </button>

            {!quickMode && thumb && (
              <span className="w-9 h-9 rounded-xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] flex items-center justify-center shrink-0">
                <img
                  src={thumb}
                  alt=""
                  width={26}
                  height={26}
                  loading="lazy"
                  className="w-6 h-6 object-contain"
                />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className={clsx(
                    'text-sm sm:text-[15px] font-extrabold leading-snug',
                    item.isChecked
                      ? 'line-through text-[var(--tkv-ink-muted)]'
                      : 'text-[var(--tkv-ink)]',
                  )}
                >
                  {item.name}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[var(--tkv-bg)] border border-[var(--tkv-border)] text-xs font-extrabold text-[var(--tkv-primary)] tabular-nums shrink-0">
                  {formatKitchenAmount(item.quantity, item.unit)}
                </span>
                {item.pendingSync && (
                  <span className="text-[11px] font-bold text-[var(--tkv-ink-muted)]">
                    · Chờ đồng bộ
                  </span>
                )}
              </div>

              {!quickMode && (
                <div className="mt-0.5 flex items-center gap-2 flex-wrap text-xs text-[var(--tkv-ink-secondary)]">
                  {uniqueTitles.length > 0 ? (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedSourcesId(expanded ? null : item.id)}
                      className="tkv-focusable text-left font-semibold text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-primary)] transition-colors"
                    >
                      Cho {uniqueTitles.slice(0, 2).join(', ')}
                      {uniqueTitles.length > 2 ? ` +${uniqueTitles.length - 2} món` : ''}{' '}
                      <span className="text-[var(--tkv-primary)] font-bold">
                        ({expanded ? 'ẩn' : `${sources.length} bữa`})
                      </span>
                    </button>
                  ) : item.sourceRecipeTitle ? (
                    <span className="font-semibold">Cho {item.sourceRecipeTitle}</span>
                  ) : null}

                  {item.quantityOverridden && !item.unknownDemand && (
                    <span className="text-[11px] font-semibold text-[var(--tkv-ink-muted)]">
                      · Đã chỉnh lượng
                    </span>
                  )}
                </div>
              )}

              {item.cannotBuy && (
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] text-[11px] font-extrabold text-[var(--tkv-coral-ink)]">
                    Chưa mua được
                  </span>
                  {firstPlanSource ? (
                    <Link
                      to={`/planner/${firstPlanSource.planId}/meal/${encodeURIComponent(firstPlanSource.slotId)}`}
                      className="text-xs font-extrabold text-[var(--tkv-primary)] hover:underline inline-flex items-center gap-0.5"
                    >
                      <span>Đổi món ở thực đơn</span>
                      <VNextIcon name="chevron-right" size={12} />
                    </Link>
                  ) : (
                    <Link
                      to="/planner"
                      className="text-xs font-extrabold text-[var(--tkv-primary)] hover:underline inline-flex items-center gap-0.5"
                    >
                      <span>Xem thực đơn để đổi món</span>
                      <VNextIcon name="chevron-right" size={12} />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Row Actions */}
          {!quickMode && (
            <div className="flex items-center gap-1 shrink-0">
              {!item.isChecked && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    cannotBuyMutation.mutate({ id: item.id, unavailable: !item.cannotBuy })
                  }
                  className={clsx(
                    'tkv-focusable h-8 px-2.5 rounded-lg border text-[11px] font-bold transition-colors hidden sm:inline-flex items-center',
                    item.cannotBuy
                      ? 'bg-[var(--tkv-surface-coral)] border-[var(--tkv-border-coral)] text-[var(--tkv-coral-ink)]'
                      : 'bg-[var(--tkv-bg)] border-[var(--tkv-border)] text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]',
                  )}
                >
                  {item.cannotBuy ? 'Có thể mua' : 'Hết hàng'}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                aria-label={`Sửa số lượng: ${item.name}`}
                onClick={() => setEditing(item)}
                className="tkv-focusable w-8 h-8 rounded-lg bg-[var(--tkv-bg)] border border-[var(--tkv-border)] hover:border-[var(--tkv-primary)] text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-primary)] inline-flex items-center justify-center transition-colors"
              >
                <VNextIcon name="edit" size={14} />
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label={`Xóa khỏi danh sách: ${item.name}`}
                onClick={() => setRemoving(item)}
                className="tkv-focusable w-8 h-8 rounded-lg bg-[var(--tkv-bg)] border border-[var(--tkv-border)] hover:border-[var(--tkv-border-coral)] text-[var(--tkv-ink-muted)] hover:text-[var(--tkv-coral)] inline-flex items-center justify-center transition-colors"
              >
                <VNextIcon name="trash" size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Expanded Meal Contributions Breakdown (In-App Links — No target=_blank!) */}
        {!quickMode && expanded && sources.length > 0 && (
          <div className="mt-2.5 ml-10 rounded-xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] p-2.5 space-y-1.5">
            <ul className="space-y-1.5">
              {sources.map((src, idx) => {
                const slotHref =
                  src.planId && src.slotId
                    ? `/planner/${src.planId}/meal/${encodeURIComponent(src.slotId)}`
                    : src.recipeId
                      ? `/recipes/id/${encodeURIComponent(src.recipeId)}`
                      : null;
                return (
                  <li
                    key={`${src.slotId}:${src.componentId}:${idx}`}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="min-w-0 truncate text-[var(--tkv-ink-secondary)]">
                      <span className="font-bold text-[var(--tkv-ink-muted)] tabular-nums">
                        {formatShortDateVi(src.date)} · {MEAL_SHORT_VI[src.mealType] ?? src.mealType}
                      </span>{' '}
                      ·{' '}
                      {slotHref ? (
                        <Link
                          to={slotHref}
                          className="font-bold text-[var(--tkv-ink)] hover:text-[var(--tkv-primary)] hover:underline"
                        >
                          {src.title}
                        </Link>
                      ) : (
                        <span className="font-bold text-[var(--tkv-ink)]">{src.title}</span>
                      )}
                    </span>
                    <span className="font-extrabold text-[var(--tkv-ink)] tabular-nums shrink-0">
                      {src.quantity === null
                        ? 'Chưa rõ'
                        : formatKitchenAmount(src.quantity, src.unit)}
                    </span>
                  </li>
                );
              })}
            </ul>

            {!item.isChecked && (
              <div className="pt-1.5 border-t border-[var(--tkv-border)] flex items-center justify-between sm:hidden">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    cannotBuyMutation.mutate({ id: item.id, unavailable: !item.cannotBuy })
                  }
                  className="text-[11px] font-extrabold text-[var(--tkv-coral-ink)]"
                >
                  {item.cannotBuy ? 'Bỏ dấu chưa mua được' : 'Đánh dấu chưa mua được'}
                </button>
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  if (isGuest) {
    return (
      <TkvSurface className="p-5 sm:p-6 space-y-5 bg-[var(--tkv-surface)] max-w-xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4">
          <MascotIllustration pose="shopping" size={84} className="w-20 h-20 shrink-0" />
          <div className="space-y-1.5 min-w-0 flex-1">
            <h1 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">
              Đăng nhập để dùng danh sách mua sắm gia đình
            </h1>
            <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
              Tự động gom nguyên liệu còn thiếu từ thực đơn tuần và chia nhóm theo quầy chợ gọn gàng.
            </p>
          </div>
        </div>
        <Link
          to={`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`}
          className="tkv-focusable w-full min-h-[48px] px-5 py-3 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white shadow-[var(--tkv-shadow-cta)] font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-colors"
        >
          <span>Đăng nhập để tiếp tục</span>
          <VNextIcon name="chevron-right" size={16} />
        </Link>
      </TkvSurface>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto" data-testid="c27-shopping-studio">
      {/* 1. Compact Header */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BrandFeatureIcon name="shopping" size={40} className="shrink-0" />
          <div className="min-w-0">
            <h1 className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink)] leading-tight">
              Danh sách mua sắm
            </h1>
            <p className="text-xs font-semibold text-[var(--tkv-ink-secondary)] tabular-nums leading-snug">
              Còn {remaining.length} mục cần mua · {checked.length} đã mua
              {pendingDemands.length > 0 ? ` · ${pendingDemands.length} chờ chọn lượng` : ''}
            </p>
          </div>
        </div>

        <TkvButton
          variant={addOpen ? 'secondary' : 'primary'}
          size="sm"
          iconLeft={addOpen ? 'close' : 'plus'}
          data-testid="c27-toggle-add-btn"
          onClick={() => setAddOpen((prev) => !prev)}
          className="shrink-0"
        >
          {addOpen ? 'Đóng' : 'Thêm món'}
        </TkvButton>
      </div>

      {/* 2. Live Meal-Plan Connection Strip */}
      {activePlan ? (
        <TkvSurface
          data-testid="c27-plan-sync-strip"
          className="p-3.5 sm:p-4 bg-[var(--tkv-surface)] border-[var(--tkv-border)] space-y-3"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                <VNextIcon name="calendar" size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-extrabold text-[var(--tkv-ink)] truncate">
                  Liên kết thực đơn tuần · {planSpanLabel}
                </p>
                <p className="text-[11px] font-semibold text-[var(--tkv-ink-secondary)]">
                  Tự đối chiếu tủ lạnh để gom đúng phần còn thiếu
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Link
                to={`/planner/${activePlan.id}`}
                className="tkv-focusable min-h-[36px] px-3 rounded-full bg-[var(--tkv-bg)] border border-[var(--tkv-border)] hover:border-[var(--tkv-primary)] text-xs font-bold text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-primary)] inline-flex items-center gap-1 transition-colors"
              >
                <span>Xem thực đơn</span>
                <VNextIcon name="chevron-right" size={12} />
              </Link>
              <button
                type="button"
                data-testid="c27-sync-plan-btn"
                disabled={busy}
                onClick={() => void handleSyncFromPlan()}
                className="tkv-focusable min-h-[36px] px-3.5 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-[var(--tkv-shadow-cta)] transition-colors"
              >
                <VNextIcon name="refresh" size={13} />
                <span>{syncingPlan ? 'Đang đồng bộ…' : 'Đồng bộ thực đơn'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-2.5 border-t border-[var(--tkv-border)]/70">
            <div className="flex items-center gap-1.5" role="group" aria-label="Chọn nhịp đi chợ">
              <span className="text-[11px] font-bold text-[var(--tkv-ink-muted)] mr-1">
                Khoảng ngày:
              </span>
              {(
                [
                  [1, 'Hôm nay'],
                  [3, '3 ngày'],
                  [undefined, 'Cả tuần'],
                ] as const
              ).map(([daysVal, label]) => {
                const active = syncDays === daysVal;
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSyncDays(daysVal)}
                    className={clsx(
                      'tkv-focusable min-h-[28px] px-2.5 rounded-full text-[11px] font-bold border transition-colors',
                      active
                        ? 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] border-[var(--tkv-primary)]'
                        : 'bg-[var(--tkv-bg)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-mint)]',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <Link
              to={`/planner/${activePlan.id}/shopping`}
              className="text-[11px] font-bold text-[var(--tkv-primary)] hover:underline"
            >
              Xem trước nguyên liệu →
            </Link>
          </div>

          {planSyncError && (
            <div
              role="alert"
              className="rounded-xl bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] px-3 py-2 text-xs font-semibold text-[var(--tkv-coral-ink)]"
            >
              {planSyncError}
            </div>
          )}
        </TkvSurface>
      ) : (
        !planModel.query.isPending && (
          <TkvSurface className="p-3.5 sm:p-4 bg-[var(--tkv-surface)] border-[var(--tkv-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                <VNextIcon name="sparkles" size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-extrabold text-[var(--tkv-ink)]">
                  Chưa có thực đơn tuần để đồng bộ
                </p>
                <p className="text-[11px] font-semibold text-[var(--tkv-ink-secondary)]">
                  Tạo thực đơn gợi ý để tự động tính lượng nguyên liệu còn thiếu so với tủ lạnh.
                </p>
              </div>
            </div>
            <TkvButton
              size="sm"
              variant="secondary"
              iconRight="arrow-right"
              onClick={() => navigate('/planner/new')}
              className="shrink-0"
            >
              Tạo thực đơn gợi ý
            </TkvButton>
          </TkvSurface>
        )
      )}

      {/* 3. Collapsible Quick-Add Card */}
      {addOpen && (
        <TkvSurface className="p-4 bg-[var(--tkv-surface)] border-[var(--tkv-border-mint)] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)]">
              Thêm nguyên liệu ngoài thực đơn
            </h2>
            <span className="text-[11px] font-semibold text-[var(--tkv-ink-muted)]">
              Lưu cho cả gia đình
            </span>
          </div>
          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_150px_auto] gap-2.5 items-end">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-[var(--tkv-ink-secondary)]">Tên nguyên liệu</span>
              <input
                name="shopping-name"
                autoComplete="off"
                required
                maxLength={100}
                disabled={busy || Boolean(attempt)}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormInvalid(false);
                }}
                placeholder="Ví dụ: Hành lá, sữa tươi…"
                className="w-full min-h-[42px] rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] px-3 text-sm font-semibold text-[var(--tkv-ink)] focus:outline-none focus:border-[var(--tkv-primary)]"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-[var(--tkv-ink-secondary)]">Số lượng</span>
              <input
                name="shopping-quantity"
                type="number"
                inputMode="decimal"
                step="any"
                min={Number.MIN_VALUE}
                required
                disabled={busy || Boolean(attempt)}
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setFormInvalid(false);
                }}
                className="w-full min-h-[42px] rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] px-3 text-sm font-semibold text-[var(--tkv-ink)] tabular-nums focus:outline-none focus:border-[var(--tkv-primary)]"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-[var(--tkv-ink-secondary)]">Đơn vị</span>
              <select
                name="shopping-unit"
                disabled={busy || Boolean(attempt)}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] px-3 text-sm font-semibold text-[var(--tkv-ink)] focus:outline-none focus:border-[var(--tkv-primary)]"
              >
                {SHOPPING_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
            <TkvButton
              type="submit"
              size="md"
              iconLeft="plus"
              disabled={busy}
              className="min-h-[42px]"
            >
              {attempt ? 'Thử lại' : 'Thêm'}
            </TkvButton>
          </form>
          {formInvalid && (
            <p role="alert" className="text-xs font-semibold text-[var(--tkv-coral-ink)]">
              Nhập tên nguyên liệu, số lượng lớn hơn 0 và chọn đơn vị.
            </p>
          )}
        </TkvSurface>
      )}

      {/* Offline / Error Banners */}
      {query.data?.source === 'device' && (
        <div
          role="status"
          className="rounded-2xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] px-3.5 py-2.5 text-xs font-semibold text-[var(--tkv-ink-secondary)] flex items-center gap-2"
        >
          <VNextIcon name="offline" size={15} className="shrink-0 text-[var(--tkv-ink-muted)]" />
          <span>
            Đang xem bản lưu trên thiết bị. Các mục đánh dấu sẽ tự đồng bộ khi có mạng trở lại.
          </span>
        </div>
      )}

      {mutationError && (
        <div
          role="alert"
          className="rounded-2xl bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] px-3.5 py-2.5 text-xs font-semibold text-[var(--tkv-coral-ink)] flex items-center justify-between gap-2"
        >
          <span>Chưa xác nhận được thay đổi. Vui lòng thử lại thao tác vừa gửi.</span>
          <button
            type="button"
            onClick={() => {
              addMutation.reset();
              toggleMutation.reset();
              cannotBuyMutation.reset();
              removeMutation.reset();
            }}
            className="font-extrabold px-2"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 4. Main Content: Loading / Error / List */}
      {query.isPending ? (
        <ShoppingListSkeleton />
      ) : query.isError && !query.data ? (
        <TkvErrorState
          title="Chưa tải được danh sách mua sắm"
          message="Không thể kết nối máy chủ để đọc danh sách của gia đình. Vui lòng thử lại."
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          {/* 4A. Smart Unresolved Demand Review Card */}
          {pendingDemands.length > 0 && (
            <TkvSurface
              data-testid="c27-unresolved-review-card"
              className="p-4 bg-[var(--tkv-surface)] border-[var(--tkv-border-saffron)] space-y-3"
            >
              <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  aria-expanded={reviewOpen}
                  onClick={() => setReviewOpen((prev) => !prev)}
                  className="tkv-focusable text-left min-w-0 flex-1"
                >
                  <p className="text-sm font-extrabold text-[var(--tkv-ink)] tabular-nums">
                    {pendingDemands.length} nguyên liệu từ thực đơn cần chốt lượng mua
                  </p>
                  <p className="text-xs text-[var(--tkv-ink-secondary)] mt-0.5">
                    {autoConfirmableCount > 0
                      ? 'Một số món có lượng lẻ sau khi chia khẩu phần — bấm xác nhận nhanh hoặc tự chỉnh.'
                      : 'Chọn lượng bạn muốn mua hoặc tạm bỏ qua cho lượt đi chợ này.'}
                  </p>
                </button>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {autoConfirmableCount >= 2 && (
                    <TkvButton
                      size="sm"
                      variant="primary"
                      iconLeft="check"
                      data-testid="c27-confirm-all-demands-btn"
                      disabled={!serverReady || busy}
                      onClick={() => void handleConfirmAllSuggested()}
                    >
                      {reviewBusyKey === 'batch-confirm'
                        ? 'Đang xác nhận…'
                        : `Xác nhận nhanh (${autoConfirmableCount})`}
                    </TkvButton>
                  )}
                  <button
                    type="button"
                    onClick={() => setReviewOpen((prev) => !prev)}
                    className="tkv-focusable min-h-[34px] px-3 rounded-full bg-[var(--tkv-bg)] border border-[var(--tkv-border)] text-xs font-bold text-[var(--tkv-ink-secondary)]"
                  >
                    {reviewOpen ? 'Thu gọn' : 'Mở xem'}
                  </button>
                </div>
              </div>

              {reviewError && (
                <div
                  role="alert"
                  className="rounded-xl bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] px-3 py-2 text-xs font-semibold text-[var(--tkv-coral-ink)] flex items-center justify-between gap-2"
                >
                  <span>{reviewError}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewError(null);
                      void query.refetch();
                    }}
                    className="font-extrabold underline shrink-0"
                  >
                    Tải lại
                  </button>
                </div>
              )}

              {reviewOpen && (
                <ul className="divide-y divide-[var(--tkv-border)] rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] overflow-hidden">
                  {confirmableDemands.map(({ demand, suggestion }) => {
                    const rowBusy = reviewBusyKey === demand.demandKey || reviewBusyKey === 'batch-confirm';
                    const thumb = getIngredientImage(demand.ingredientId, demand.name);
                    return (
                      <li
                        key={demand.demandKey}
                        className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {thumb && (
                            <img
                              src={thumb}
                              alt=""
                              width={24}
                              height={24}
                              loading="lazy"
                              className="w-6 h-6 object-contain shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-extrabold text-[var(--tkv-ink)] truncate">
                              {demand.name}
                            </p>
                            <p className="text-[11px] text-[var(--tkv-ink-secondary)]">
                              {suggestion
                                ? `Ước tính từ ${suggestion.mealCount} bữa trong thực đơn`
                                : 'Món chưa ghi rõ định lượng — cần chọn lượng bạn muốn mua'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {suggestion && (
                            <button
                              type="button"
                              data-testid={`c27-quick-confirm-${demand.demandKey}`}
                              disabled={!serverReady || busy}
                              onClick={() =>
                                void handleReviewDemand(
                                  demand,
                                  {
                                    sourceId: demand.sourceId,
                                    demandKey: demand.demandKey,
                                    snapshot: demand.snapshot,
                                    reviewRevision: demand.reviewRevision,
                                    action: 'purchase',
                                    quantity: suggestion.quantity,
                                    unit: suggestion.unit,
                                  },
                                  demand.demandKey,
                                )
                              }
                              className="tkv-focusable min-h-[34px] px-3 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1 tabular-nums"
                            >
                              <VNextIcon name="plus" size={12} />
                              <span>
                                {rowBusy
                                  ? 'Đang thêm…'
                                  : `Thêm ${formatKitchenAmount(suggestion.quantity, suggestion.unit)}`}
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!serverReady || busy}
                            onClick={() => openCustomDemandModal(demand)}
                            className="tkv-focusable min-h-[34px] px-2.5 rounded-full bg-[var(--tkv-surface)] border border-[var(--tkv-border)] hover:border-[var(--tkv-primary)] text-xs font-bold text-[var(--tkv-ink)]"
                          >
                            {suggestion ? 'Tự nhập' : 'Chọn lượng'}
                          </button>
                          <button
                            type="button"
                            disabled={!serverReady || busy}
                            onClick={() =>
                              void handleReviewDemand(
                                demand,
                                {
                                  sourceId: demand.sourceId,
                                  demandKey: demand.demandKey,
                                  snapshot: demand.snapshot,
                                  reviewRevision: demand.reviewRevision,
                                  action: 'skip',
                                },
                                demand.demandKey,
                              )
                            }
                            className="tkv-focusable min-h-[34px] px-2.5 rounded-full text-xs font-bold text-[var(--tkv-ink-muted)] hover:text-[var(--tkv-ink)]"
                          >
                            Bỏ qua
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TkvSurface>
          )}

          {/* 4B. Filter Tabs & Market Mode Controls */}
          {items.length > 0 && (
            <div className="flex items-center justify-between gap-2.5 flex-wrap">
              <div
                role="tablist"
                aria-label="Trạng thái mua sắm"
                className="inline-flex items-center rounded-full bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'remaining'}
                  onClick={() => setActiveTab('remaining')}
                  className={clsx(
                    'tkv-focusable min-h-[34px] px-3.5 rounded-full text-xs font-extrabold transition-colors tabular-nums',
                    activeTab === 'remaining'
                      ? 'bg-[var(--tkv-primary)] text-white shadow-2xs'
                      : 'text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]',
                  )}
                >
                  Cần mua ({remaining.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'checked'}
                  onClick={() => setActiveTab('checked')}
                  className={clsx(
                    'tkv-focusable min-h-[34px] px-3.5 rounded-full text-xs font-extrabold transition-colors tabular-nums',
                    activeTab === 'checked'
                      ? 'bg-[var(--tkv-primary)] text-white shadow-2xs'
                      : 'text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]',
                  )}
                >
                  Đã mua ({checked.length})
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {activeTab === 'remaining' && remaining.length > 0 && (
                  <button
                    type="button"
                    aria-pressed={groupByAisle}
                    data-testid="c27-aisle-group-toggle"
                    onClick={() => setGroupByAisle((prev) => !prev)}
                    className={clsx(
                      'tkv-focusable min-h-[36px] px-3 rounded-full text-xs font-bold border transition-colors',
                      groupByAisle
                        ? 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] border-[var(--tkv-primary)]'
                        : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)]',
                    )}
                  >
                    Theo quầy chợ
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={quickMode}
                  data-testid="c28-quick-market-toggle"
                  onClick={() => setQuickMode((prev) => !prev)}
                  className={clsx(
                    'tkv-focusable min-h-[36px] px-3 rounded-full text-xs font-bold border transition-colors inline-flex items-center gap-1.5',
                    quickMode
                      ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                      : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)]',
                  )}
                >
                  <span>Đi chợ nhanh</span>
                </button>
              </div>
            </div>
          )}

          {/* 4C. Shopping Checklist Card(s) */}
          {items.length === 0 ? (
            pendingDemands.length === 0 ? (
              <TkvEmptyState
                pose="shopping"
                eyebrow="Giỏ đi chợ gọn gàng"
                title="Chưa có nguyên liệu cần mua"
                description="Tạo thực đơn tuần để Takolio tự trừ đồ sẵn trong tủ lạnh và gom gọn các món còn thiếu vào đây."
                primaryAction={
                  <TkvButton
                    iconRight="arrow-right"
                    onClick={() => navigate(activePlan ? `/planner/${activePlan.id}` : '/planner/new')}
                  >
                    {activePlan ? 'Mở thực đơn tuần' : 'Tạo thực đơn gợi ý'}
                  </TkvButton>
                }
                secondaryAction={
                  <TkvButton variant="secondary" iconLeft="plus" onClick={() => setAddOpen(true)}>
                    Thêm món thủ công
                  </TkvButton>
                }
              />
            ) : null
          ) : activeTab === 'remaining' ? (
            remaining.length > 0 ? (
              groupByAisle ? (
                <div className="space-y-3" data-testid="c27-aisle-list">
                  {aisleGroups.map((group) => (
                    <TkvSurface
                      key={group.id}
                      padded={false}
                      className="bg-[var(--tkv-surface)] border-[var(--tkv-border)] overflow-hidden"
                    >
                      <div className="px-4 py-2.5 bg-[var(--tkv-bg)]/80 border-b border-[var(--tkv-border)] flex items-center justify-between gap-2">
                        <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-secondary)]">
                          {group.label}
                        </h2>
                        <span className="text-xs font-bold text-[var(--tkv-ink-muted)] tabular-nums">
                          {group.items.length} mục
                        </span>
                      </div>
                      <ul className="divide-y divide-[var(--tkv-border)]/70">
                        {group.items.map(renderShoppingRow)}
                      </ul>
                    </TkvSurface>
                  ))}
                </div>
              ) : (
                <TkvSurface
                  padded={false}
                  className="bg-[var(--tkv-surface)] border-[var(--tkv-border)] overflow-hidden"
                >
                  <ul className="divide-y divide-[var(--tkv-border)]/70">
                    {remaining.map(renderShoppingRow)}
                  </ul>
                </TkvSurface>
              )
            ) : (
              <TkvSurface className="p-5 bg-[var(--tkv-surface)] border-[var(--tkv-border-mint)] text-center space-y-2">
                <p className="tkv-heading text-base font-extrabold text-[var(--tkv-primary)]">
                  Đã đánh dấu mua hết tất cả các mục
                </p>
                <p className="text-xs text-[var(--tkv-ink-secondary)]">
                  Chuyển sang thẻ “Đã mua ({checked.length})” để xem lại hoặc nhập thực phẩm vừa mua về tủ lạnh.
                </p>
              </TkvSurface>
            )
          ) : checked.length > 0 ? (
            <TkvSurface
              padded={false}
              className="bg-[var(--tkv-surface)] border-[var(--tkv-border)] overflow-hidden"
            >
              <ul className="divide-y divide-[var(--tkv-border)]/70">
                {checked.map(renderShoppingRow)}
              </ul>
            </TkvSurface>
          ) : (
            <TkvSurface className="p-5 bg-[var(--tkv-surface)] border-[var(--tkv-border)] text-center space-y-1">
              <p className="text-sm font-extrabold text-[var(--tkv-ink)]">Chưa có mục nào đã mua</p>
              <p className="text-xs text-[var(--tkv-ink-secondary)]">
                Chạm vào vòng tròn cạnh mỗi nguyên liệu khi bạn cho vào giỏ hàng.
              </p>
            </TkvSurface>
          )}

          {/* 4D. Post-Shopping Restock Strip (Closes Shopping → Fridge Loop!) */}
          {checked.length > 0 && (
            <TkvSurface
              data-testid="c27-restock-strip"
              className="p-4 bg-[var(--tkv-surface-mint)]/55 border-[var(--tkv-border-mint)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-extrabold text-[var(--tkv-ink)] tabular-nums">
                  Đã mua {checked.length} mục — Cập nhật về tủ lạnh?
                </p>
                <p className="text-xs text-[var(--tkv-ink-secondary)]">
                  Đánh dấu đã mua chưa tự cộng vào tủ lạnh. Khi về nhà, quét ảnh hoặc thêm nhanh vào tủ.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <TkvButton
                  size="sm"
                  variant="primary"
                  iconLeft="scan"
                  onClick={() => navigate('/scan')}
                >
                  Quét đồ vừa mua
                </TkvButton>
                <TkvButton
                  size="sm"
                  variant="secondary"
                  iconLeft="fridge"
                  onClick={() => navigate('/fridge?action=add')}
                >
                  Nhập vào tủ lạnh
                </TkvButton>
              </div>
            </TkvSurface>
          )}

          {/* 4E. Processed Demands Disclosure (Reopen skipped demands if needed) */}
          {processedDemands.length > 0 && (
            <details className="rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-3.5">
              <summary className="cursor-pointer list-none flex items-center justify-between text-xs font-extrabold text-[var(--tkv-ink-secondary)]">
                <span>Nguyên liệu đã rà từ thực đơn ({processedDemands.length})</span>
                <span className="text-[var(--tkv-primary)]">Xem</span>
              </summary>
              <ul className="mt-2.5 pt-2.5 border-t border-[var(--tkv-border)] divide-y divide-[var(--tkv-border)]/70">
                {processedDemands.map((demand) => (
                  <li
                    key={demand.demandKey}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-bold text-[var(--tkv-ink)]">
                      {demand.name}{' '}
                      <span className="font-semibold text-[var(--tkv-ink-muted)]">
                        · {demand.reviewState === 'purchased' ? 'Đã thêm lượng' : 'Đã bỏ qua'}
                      </span>
                    </span>
                    {demand.reviewState === 'skipped' && (
                      <button
                        type="button"
                        disabled={!serverReady || busy}
                        onClick={() =>
                          void handleReviewDemand(
                            demand,
                            {
                              sourceId: demand.sourceId,
                              demandKey: demand.demandKey,
                              snapshot: demand.snapshot,
                              reviewRevision: demand.reviewRevision,
                              action: 'reopen',
                            },
                            demand.demandKey,
                          )
                        }
                        className="font-extrabold text-[var(--tkv-primary)] hover:underline"
                      >
                        Mở lại
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={Boolean(removing)}
        title="Xóa khỏi danh sách?"
        description={
          removing
            ? `Xóa “${removing.name}” khỏi danh sách mua sắm của gia đình.${
                removing.unknownDemand
                  ? ' Nguyên liệu này sẽ trở lại mục cần chọn lượng.'
                  : ''
              }`
            : undefined
        }
        confirmText="Xóa món"
        cancelText="Giữ lại"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target && !busy) {
            removeMutation.mutate(target.id);
          }
        }}
      />

      {/* C28 Edit Quantity Modal */}
      {editing && (
        <ShoppingItemEditModal
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async (res) => {
            setEditing(null);
            showTkvToast({
              message: res.pendingSync
                ? 'Đã lưu chỉnh sửa tạm (chờ đồng bộ)'
                : 'Đã cập nhật số lượng cần mua',
              tone: 'success',
            });
            await refresh();
          }}
        />
      )}

      {/* Custom Demand Purchase Modal */}
      {purchaseDemand && (
        <DemandPurchaseModal
          demand={purchaseDemand}
          quantity={demandQty}
          unit={demandUnit}
          invalid={demandInvalid}
          busy={Boolean(reviewBusyKey)}
          onQuantityChange={(v) => {
            setDemandQty(v);
            setDemandInvalid(false);
          }}
          onUnitChange={setDemandUnit}
          onClose={() => {
            if (!reviewBusyKey) setPurchaseDemand(null);
          }}
          onSubmit={() => {
            const parsed = demandQty.trim() ? Number(demandQty) : NaN;
            if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100_000) {
              setDemandInvalid(true);
              return;
            }
            void handleReviewDemand(
              purchaseDemand,
              {
                sourceId: purchaseDemand.sourceId,
                demandKey: purchaseDemand.demandKey,
                snapshot: purchaseDemand.snapshot,
                reviewRevision: purchaseDemand.reviewRevision,
                action: 'purchase',
                quantity: parsed,
                unit: demandUnit,
              },
              purchaseDemand.demandKey,
            );
          }}
        />
      )}
    </div>
  );
};

const ShoppingItemEditModal: React.FC<{
  item: ShoppingItem;
  onClose: () => void;
  onSaved: (result: { pendingSync: boolean }) => void;
}> = ({ item, onClose, onSaved }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit);
  const [invalid, setInvalid] = useState(false);

  const save = useMutation({
    mutationFn: (input: NonNullable<ReturnType<typeof parseShoppingForm>>) =>
      shoppingApi.updateShoppingItem(item.id, input),
    onSuccess: onSaved,
  });

  useModalFocus(true, panelRef, () => {
    if (!save.isPending) onClose();
  });

  return (
    <div
      role="presentation"
      onClick={() => {
        if (!save.isPending) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="c28-edit-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-5 space-y-4 shadow-[var(--tkv-shadow-elevated)] tkv-sheet-enter"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="c28-edit-title" className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
            Chỉnh lượng cần mua
          </h2>
          <button
            type="button"
            aria-label="Đóng"
            disabled={save.isPending}
            onClick={onClose}
            className="tkv-focusable w-9 h-9 rounded-full bg-[var(--tkv-bg)] border border-[var(--tkv-border)] text-[var(--tkv-ink-secondary)] inline-flex items-center justify-center"
          >
            <VNextIcon name="close" size={16} />
          </button>
        </div>

        <form
          className="space-y-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = parseShoppingForm(name, quantity, unit);
            setInvalid(!parsed);
            if (parsed) save.mutate(parsed);
          }}
        >
          <label className="block space-y-1">
            <span className="text-xs font-bold text-[var(--tkv-ink-secondary)]">Tên nguyên liệu</span>
            <input
              required
              maxLength={100}
              disabled={save.isPending}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] px-3.5 text-sm font-semibold text-[var(--tkv-ink)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-[var(--tkv-ink-secondary)]">Số lượng</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min={Number.MIN_VALUE}
                required
                disabled={save.isPending}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] px-3.5 text-sm font-semibold text-[var(--tkv-ink)] tabular-nums"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-[var(--tkv-ink-secondary)]">Đơn vị</span>
              <select
                disabled={save.isPending}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] px-3 text-sm font-semibold text-[var(--tkv-ink)]"
              >
                {SHOPPING_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {item.generated && (
            <p className="text-xs text-[var(--tkv-ink-secondary)] bg-[var(--tkv-bg)] rounded-xl px-3 py-2 border border-[var(--tkv-border)]">
              {item.unknownDemand
                ? 'Bạn đang chỉnh lượng muốn mua thủ công cho mục này.'
                : 'Lượng bạn tự chỉnh sẽ được ưu tiên giữ lại khi đồng bộ thực đơn.'}
            </p>
          )}

          {invalid && (
            <p role="alert" className="text-xs font-semibold text-[var(--tkv-coral-ink)]">
              Nhập tên và số lượng lớn hơn 0.
            </p>
          )}
          {save.isError && (
            <p role="alert" className="text-xs font-semibold text-[var(--tkv-coral-ink)]">
              Chưa lưu được thay đổi. Vui lòng thử lại.
            </p>
          )}

          <TkvButton type="submit" disabled={save.isPending} className="w-full min-h-[46px]">
            {save.isPending ? 'Đang lưu…' : 'Lưu lượng cần mua'}
          </TkvButton>
        </form>
      </div>
    </div>
  );
};

const DemandPurchaseModal: React.FC<{
  demand: ShoppingUnknownDemand;
  quantity: string;
  unit: PurchaseUnit;
  invalid: boolean;
  busy: boolean;
  onQuantityChange: (val: string) => void;
  onUnitChange: (val: PurchaseUnit) => void;
  onClose: () => void;
  onSubmit: () => void;
}> = ({
  demand,
  quantity,
  unit,
  invalid,
  busy,
  onQuantityChange,
  onUnitChange,
  onClose,
  onSubmit,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalFocus(true, panelRef, onClose);

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="c27-demand-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-5 space-y-4 shadow-[var(--tkv-shadow-elevated)] tkv-sheet-enter"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2
              id="c27-demand-modal-title"
              className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]"
            >
              Chọn lượng mua · {demand.name}
            </h2>
            <p className="text-xs text-[var(--tkv-ink-secondary)] mt-0.5">
              Dùng cho {demand.contributions.length} món trong thực đơn
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            disabled={busy}
            onClick={onClose}
            className="tkv-focusable w-9 h-9 rounded-full bg-[var(--tkv-bg)] border border-[var(--tkv-border)] text-[var(--tkv-ink-secondary)] inline-flex items-center justify-center"
          >
            <VNextIcon name="close" size={16} />
          </button>
        </div>

        <form
          className="space-y-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-[var(--tkv-ink-secondary)]">Số lượng</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min={Number.MIN_VALUE}
                required
                disabled={busy}
                value={quantity}
                onChange={(e) => onQuantityChange(e.target.value)}
                placeholder="Ví dụ: 200"
                className="w-full min-h-[44px] rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] px-3.5 text-sm font-semibold text-[var(--tkv-ink)] tabular-nums"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-[var(--tkv-ink-secondary)]">Đơn vị</span>
              <select
                disabled={busy}
                value={unit}
                onChange={(e) => onUnitChange(e.target.value as PurchaseUnit)}
                className="w-full min-h-[44px] rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] px-3 text-sm font-semibold text-[var(--tkv-ink)]"
              >
                {SHOPPING_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {invalid && (
            <p role="alert" className="text-xs font-semibold text-[var(--tkv-coral-ink)]">
              Vui lòng nhập số lượng lớn hơn 0.
            </p>
          )}

          <TkvButton type="submit" disabled={busy} className="w-full min-h-[46px]">
            {busy ? 'Đang thêm…' : 'Thêm vào danh sách mua sắm'}
          </TkvButton>
        </form>
      </div>
    </div>
  );
};
