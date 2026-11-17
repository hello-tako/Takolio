import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Leaf,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { clsx } from 'clsx';
import { TopBar } from '../components/common/TopBar';
import { CulinaryCinemaStage } from '../components/3d/CulinaryCinemaStage';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
  RadialProgressRing,
  SegmentedTabs,
} from '../design-system/v4/AtelierPrimitives';
import {
  BudgetCoinJarIcon,
  CaloriesLeafIcon,
  CatDairyEggIcon,
  CatGrainDryIcon,
  CatSpiceSauceIcon,
  ExpiryRescueBellIcon,
  FishSauceCruetIcon,
  FreshnessShieldIcon,
  HerbSprigIcon,
  HouseholdTrayIcon,
  LeftoverBoxIcon,
  NavShoppingIcon,
  WokFlameIcon,
  type TakolioIconProps,
} from '../design-system/icons';
import { getCurrentScope, readCachedInventory } from '../services/http';
import {
  kitchenOsApi,
  type AutoRestockResult,
  type PantryThresholdItem,
  type WasteEventType,
} from '../services/kitchen-os';
import { queryKeys } from '../lib/queryKeys';
import { formatVnd, formatVndCompact } from '../lib/format';

type InsightsWorkspaceTab = 'pantry' | 'budget' | 'waste';

const BUDGET_PRESETS_VND = [800_000, 1_200_000, 1_800_000, 2_500_000] as const;

const EXPENSE_CATEGORIES = [
  { id: 'cho_truyen_thong', labelVi: 'Chợ truyền thống' },
  { id: 'sieu_thi', labelVi: 'Siêu thị' },
  { id: 'thit_ca', labelVi: 'Thịt cá tươi' },
  { id: 'rau_cu', labelVi: 'Rau củ quả' },
  { id: 'gia_vi_kho', labelVi: 'Gia vị & Đồ khô' },
] as const;

const QUICK_EXPENSE_AMOUNTS = [65_000, 120_000, 250_000, 420_000] as const;

const WASTE_ACTION_OPTIONS: ReadonlyArray<{
  eventType: WasteEventType;
  labelVi: string;
  subtitleVi: string;
  tone: 'jade' | 'turmeric' | 'flame';
}> = [
  {
    eventType: 'rescued',
    labelVi: 'Đã giải cứu kịp thời',
    subtitleVi: 'Nấu ngay trước ngày hết hạn · Cộng điểm Zero-Waste',
    tone: 'jade',
  },
  {
    eventType: 'leftover_saved',
    labelVi: 'Cất hộp phần ăn dư',
    subtitleVi: 'Bảo quản hộp kín cho bữa kế tiếp · Tránh bỏ phí',
    tone: 'turmeric',
  },
  {
    eventType: 'composted',
    labelVi: 'Ủ phân hữu cơ',
    subtitleVi: 'Gốc rau, vỏ củ tuần hoàn xanh cho cây trồng',
    tone: 'jade',
  },
  {
    eventType: 'expired_discarded',
    labelVi: 'Bỏ đi do quá hạn',
    subtitleVi: 'Ghi sổ minh bạch để AI điều chỉnh lượng mua tuần tới',
    tone: 'flame',
  },
] as const;

function formatCo2Display(grams: number): { primary: string; unitLabel: string } {
  if (!Number.isFinite(grams) || grams <= 0) {
    return { primary: '0 g', unitLabel: 'CO2e ngăn chặn' };
  }
  if (grams >= 1000) {
    const kg = (grams / 1000).toFixed(1).replace('.', ',');
    return { primary: `${kg} kg`, unitLabel: `${Math.round(grams).toLocaleString('vi-VN')} g CO2e` };
  }
  return { primary: `${Math.round(grams)} g`, unitLabel: 'CO2e ngăn chặn' };
}

function formatRelativeTimeVi(isoString: string): string {
  const ts = Date.parse(isoString);
  if (!Number.isFinite(ts)) return 'Vừa xong';
  const diffMinutes = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (diffMinutes < 2) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays <= 7) return `${diffDays} ngày trước`;
  return new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function resolveStapleIcon(item: PantryThresholdItem): React.FC<TakolioIconProps> {
  const key = `${item.ingredientKey} ${item.nameVi}`.toLowerCase();
  if (key.includes('mam') || key.includes('dau')) return FishSauceCruetIcon;
  if (key.includes('gao')) return CatGrainDryIcon;
  if (key.includes('trung')) return CatDairyEggIcon;
  if (key.includes('toi') || key.includes('hanh')) return HerbSprigIcon;
  return CatSpiceSauceIcon;
}

function stepIncrementForUnit(unit: string): number {
  const u = unit.toLowerCase().trim();
  if (u === 'ml') return 50;
  if (u === 'g') return 50;
  if (u === 'kg' || u === 'l') return 0.5;
  return 1;
}

export const KitchenInsightsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = getCurrentScope();

  const initialTab = useMemo<InsightsWorkspaceTab>(() => {
    const raw = searchParams.get('tab');
    if (raw === 'budget' || raw === 'waste' || raw === 'pantry') return raw;
    return 'pantry';
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState<InsightsWorkspaceTab>(initialTab);

  // Tab A state
  const [restockBanner, setRestockBanner] = useState<AutoRestockResult | null>(null);

  // Tab B state
  const [customTargetInput, setCustomTargetInput] = useState('');
  const [selectedExpenseCat, setSelectedExpenseCat] = useState<string>('cho_truyen_thong');
  const [expenseAmountInput, setExpenseAmountInput] = useState<string>('120000');
  const [expenseNoteInput, setExpenseNoteInput] = useState<string>('');
  const [budgetStatusNotice, setBudgetStatusNotice] = useState<string | null>(null);

  // Tab C state
  const [wasteItemInput, setWasteItemInput] = useState<string>('Rau cải ngọt & nấm tươi cuối tuần');
  const [wasteValueInput, setWasteValueInput] = useState<number>(45_000);
  const [wasteFeedbackBanner, setWasteFeedbackBanner] = useState<string | null>(null);

  const handleTabChange = (next: InsightsWorkspaceTab) => {
    setActiveTab(next);
    if (next === 'pantry') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: next }, { replace: true });
    }
  };

  // Queries
  const pulseQueryKey = ['kitchen-os', 'pulse', scope.userId, scope.householdId] as const;
  const insightsQueryKey = ['kitchen-os', 'insights', scope.userId, scope.householdId] as const;
  const pantryQueryKey = ['kitchen-os', 'pantry-thresholds', scope.userId, scope.householdId] as const;

  const pulseQuery = useQuery({
    queryKey: pulseQueryKey,
    queryFn: () => kitchenOsApi.getPulse(),
    staleTime: 15_000,
  });

  const insightsQuery = useQuery({
    queryKey: insightsQueryKey,
    queryFn: () => kitchenOsApi.getInsights(),
    staleTime: 15_000,
  });

  const pantryQuery = useQuery({
    queryKey: pantryQueryKey,
    queryFn: () => kitchenOsApi.getPantryThresholds(),
    staleTime: 15_000,
  });

  const invalidateAllInsights = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: pulseQueryKey }),
      queryClient.invalidateQueries({ queryKey: insightsQueryKey }),
      queryClient.invalidateQueries({ queryKey: pantryQueryKey }),
    ]);
  };

  // Mutations
  const seedStaplesMutation = useMutation({
    mutationFn: () => kitchenOsApi.seedVietnamesePantryStaples(),
    onSuccess: async (seeded) => {
      queryClient.setQueryData(pantryQueryKey, seeded);
      await invalidateAllInsights();
    },
  });

  const adjustThresholdMutation = useMutation({
    mutationFn: (payload: { item: PantryThresholdItem; delta: number }) => {
      const nextMin = Math.max(
        payload.delta < 0 ? (payload.item.unit === 'kg' ? 0.5 : 1) : 1,
        Math.round((payload.item.minQuantity + payload.delta) * 10) / 10,
      );
      return kitchenOsApi.upsertPantryThreshold({
        id: payload.item.id,
        ingredientKey: payload.item.ingredientKey,
        ingredientId: payload.item.ingredientId,
        nameVi: payload.item.nameVi,
        unit: payload.item.unit,
        minQuantity: nextMin,
        targetQuantity: Math.max(nextMin, payload.item.targetQuantity),
        restockQuantity: payload.item.restockQuantity,
        currentQuantity: payload.item.currentQuantity,
        category: payload.item.category,
        storage: payload.item.storage,
      });
    },
    onSuccess: async () => {
      await invalidateAllInsights();
    },
  });

  const autoRestockMutation = useMutation({
    mutationFn: () => kitchenOsApi.autoRestockLowStaples(),
    onSuccess: async (result) => {
      setRestockBanner(result);
      await Promise.all([
        invalidateAllInsights(),
        queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList() }),
      ]);
    },
  });

  const updateBudgetTargetMutation = useMutation({
    mutationFn: (amountVnd: number) => kitchenOsApi.updateWeeklyBudgetTarget(amountVnd),
    onSuccess: async (res) => {
      setBudgetStatusNotice(`Đã cập nhật hạn mức ngân sách tuần: ${formatVnd(res.weeklyTargetVnd)}`);
      setCustomTargetInput('');
      await invalidateAllInsights();
    },
  });

  const addExpenseMutation = useMutation({
    mutationFn: (payload: { amountVnd: number; category: string; note?: string }) =>
      kitchenOsApi.addBudgetEntry(payload),
    onSuccess: async (entry) => {
      setBudgetStatusNotice(
        `Đã ghi nhận ${formatVnd(entry.amountVnd)} vào nhóm ${entry.categoryLabelVi}`,
      );
      setExpenseNoteInput('');
      await invalidateAllInsights();
    },
  });

  const logWasteMutation = useMutation({
    mutationFn: (eventType: WasteEventType) =>
      kitchenOsApi.logWasteEvent({
        itemName: wasteItemInput.trim() || 'Thực phẩm bếp gia đình',
        eventType,
        estimatedValueVnd: wasteValueInput,
      }),
    onSuccess: async (created) => {
      const actionMap: Record<WasteEventType, string> = {
        rescued: `Tuyệt vời! Đã cộng ${formatVnd(created.estimatedValueVnd)} vào Quỹ Giải Cứu Thực Phẩm`,
        leftover_saved: `Đã ghi sổ cất hộp phần ăn dư (${formatVnd(created.estimatedValueVnd)})`,
        composted: `Đã ghi nhận ủ phân hữu cơ tuần hoàn (${created.co2Grams}g CO2e)`,
        expired_discarded: `Đã ghi nhận thực phẩm quá hạn để tối ưu định lượng đi chợ tuần tới`,
      };
      setWasteFeedbackBanner(actionMap[created.eventType]);
      await invalidateAllInsights();
    },
  });

  // Resolved Metrics
  const insights = insightsQuery.data;
  const pulse = pulseQuery.data;
  const thresholds = pantryQuery.data ?? [];
  const lowStaples = useMemo(() => thresholds.filter((item) => item.isLow), [thresholds]);

  const zeroWasteScore = insights?.zeroWasteScore ?? pulse?.zeroWasteScore ?? 88;
  const savedValueVnd30d = insights?.savedValueVnd30d ?? pulse?.savedValueVnd30d ?? 0;
  const co2PreventedGrams30d = insights?.co2PreventedGrams30d ?? pulse?.co2PreventedGrams30d ?? 0;
  const cookedMeals30d = insights?.cookedMeals30d ?? pulse?.cookedMeals30d ?? 18;
  const co2Display = formatCo2Display(co2PreventedGrams30d);

  const telemetry = pulse?.telemetry ?? insights?.telemetry;
  const timingLabel =
    telemetry?.serverTimingMs !== null && telemetry?.serverTimingMs !== undefined
      ? `${telemetry.serverTimingMs.toFixed(1)} ms`
      : 'Edge Ready';
  const cacheBadgeLabel =
    telemetry?.cacheStatus === '304_SWR'
      ? 'ETag 304 SWR · HIT'
      : telemetry?.cacheStatus === '200_LIVE'
        ? 'ETag 304 SWR · LIVE'
        : 'ETag 304 SWR · LOCAL';

  const budget = insights?.budget ?? {
    weeklyTargetVnd: pulse?.weeklyTargetVnd ?? 1_200_000,
    spentThisWeekVnd: pulse?.spentThisWeekVnd ?? 0,
    remainingVnd: (pulse?.weeklyTargetVnd ?? 1_200_000) - (pulse?.spentThisWeekVnd ?? 0),
    burnRatePercent: Math.round(
      ((pulse?.spentThisWeekVnd ?? 0) / Math.max(1, pulse?.weeklyTargetVnd ?? 1_200_000)) * 100,
    ),
    entries: [],
    byCategory: [],
  };

  const expiringChips = useMemo(() => {
    const inv = readCachedInventory();
    const fromInv = Array.isArray(inv)
      ? inv
          .filter((i) => i && typeof i.name === 'string')
          .slice(0, 4)
          .map((i) => String(i.name))
      : [];
    if (fromInv.length >= 3) return fromInv;
    return [
      'Rau cải ngọt & nấm tươi cuối tuần',
      'Đậu phụ làng Mơ ngăn mát',
      'Thịt kho trứng bữa tối qua',
      'Gốc hành & vỏ rau củ ủ xanh',
    ];
  }, []);

  const activityFeed = insights?.activityFeed ?? pulse?.recentActivities ?? [];

  return (
    <div className="min-h-screen bg-tk-canvas text-tk-ink">
      <TopBar kitchen backTo="/" />

      <main className="kitchen-page-body space-y-6">
        {/* ====================================================================
         * 1. OBSIDIAN HEARTH CINEMA TELEMETRY HEADER
         * ==================================================================== */}
        <section
          aria-label="Trung tâm phân tích bếp và chỉ số chống lãng phí"
          className="tk-sanctuary-theme relative overflow-hidden rounded-[30px] border border-white/14 p-4 sm:p-6 lg:p-7 shadow-2xl"
        >
          {/* Top Backend Power Telemetry Pill Row */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-tk-jade-mint/35 bg-tk-jade/45 px-3 py-1 text-[11px] font-extrabold tracking-wide text-tk-jade-mint">
                <Zap className="h-3.5 w-3.5 text-tk-turmeric" aria-hidden="true" />
                <span>Single-RTT D1 Batch</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-extrabold tracking-wide text-white/90">
                <ShieldCheck className="h-3.5 w-3.5 text-tk-jade-mint" aria-hidden="true" />
                <span>{cacheBadgeLabel}</span>
              </span>
              <span
                data-testid="kitchen-os-server-timing-pill"
                className="inline-flex items-center gap-1.5 rounded-full border border-tk-flame/40 bg-tk-flame/20 px-3 py-1 text-[11px] font-extrabold text-tk-flame-glow tk-tabular"
              >
                <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Server-Timing: {timingLabel}</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                pulseQuery.refetch();
                insightsQuery.refetch();
                pantryQuery.refetch();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/14 bg-white/8 px-3 py-1.5 text-xs font-bold text-white/85 transition-colors hover:bg-white/15 hover:text-white cursor-pointer"
            >
              <RefreshCw
                className={clsx(
                  'h-3.5 w-3.5',
                  (pulseQuery.isFetching || insightsQuery.isFetching) && 'animate-spin',
                )}
                aria-hidden="true"
              />
              <span>Đồng bộ Pulse</span>
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-12 lg:items-stretch">
            {/* 35mm Live-Action Cinema Stage */}
            <div className="lg:col-span-5 flex flex-col">
              <CulinaryCinemaStage
                videoSrc="/takolio/v5/videos/batch-prep-loop.mp4"
                posterSrc="/takolio/v5/posters/batch-prep-poster.webp"
                ariaLabel="Thước phim 35mm sơ chế nguyên liệu tươi và kiểm soát tủ bếp không lãng phí"
                studioBadgeLabel="KITCHEN OS · PULSE"
                liveLabel="PULSE"
                ambientRimTone="jade"
                className="min-h-[230px] sm:min-h-[265px] flex-1"
              >
                <div className="absolute inset-x-4 bottom-4 flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-tk-jade-mint">
                    TRUNG TÂM ĐIỀU HÀNH BẾP GIA ĐÌNH
                  </span>
                  <h1 className="text-xl sm:text-2xl font-extrabold leading-tight tracking-tight text-white">
                    Sổ Cái Zero-Waste, Tủ Gia Vị Nền & Ngân Sách Tuần
                  </h1>
                  <p className="text-xs text-white/75 line-clamp-2">
                    Giữ căn bếp Việt luôn đủ gia vị cốt lõi, ưu tiên giải cứu đồ tươi FEFO và minh bạch từng đồng đi chợ.
                  </p>
                </div>
              </CulinaryCinemaStage>
            </div>

            {/* Live KPI Telemetry Bento Grid */}
            <div className="lg:col-span-7 grid gap-3.5 sm:grid-cols-2">
              {/* KPI 1: Zero-Waste Score */}
              <div className="tk-glass-dark rounded-[24px] p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-tk-jade-mint">
                    Điểm Chống Lãng Phí
                  </p>
                  <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-white tk-tabular">
                    {zeroWasteScore}
                    <span className="text-sm font-bold text-white/55">/100</span>
                  </p>
                  <p className="mt-1.5 text-xs text-white/70">
                    {zeroWasteScore >= 85
                      ? 'Chuẩn Bếp Xanh Xuất Sắc'
                      : zeroWasteScore >= 70
                        ? 'Nhịp tiêu thụ ổn định'
                        : 'Nên ưu tiên nấu đồ cận hạn'}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-2 text-white">
                  <RadialProgressRing
                    value={zeroWasteScore}
                    size={64}
                    strokeWidth={6}
                    tone={zeroWasteScore >= 75 ? 'jade' : 'turmeric'}
                    label={<span className="text-white">{zeroWasteScore}%</span>}
                  />
                </div>
              </div>

              {/* KPI 2: Food Rescued VND + CO2e */}
              <div className="tk-glass-dark rounded-[24px] p-4 sm:p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                    Thực Phẩm Đã Cứu · 30 Ngày
                  </span>
                  <CaloriesLeafIcon size={20} tone="cream" active />
                </div>
                <div className="mt-2">
                  <p className="text-2xl sm:text-3xl font-extrabold text-white tk-tabular">
                    {formatVnd(savedValueVnd30d)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-tk-jade/45 px-2.5 py-0.5 font-bold text-tk-jade-mint tk-tabular">
                      <Leaf className="h-3 w-3" aria-hidden="true" />
                      {co2Display.primary}
                    </span>
                    <span className="text-white/65 tk-tabular">{co2Display.unitLabel}</span>
                  </div>
                </div>
              </div>

              {/* KPI 3: Home Cooked Meals Streak */}
              <div className="tk-glass-dark rounded-[24px] p-4 sm:p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-tk-flame-glow">
                    Chuỗi Bữa Cơm Nhà · 30 Ngày
                  </span>
                  <WokFlameIcon size={20} tone="flame" active />
                </div>
                <div className="mt-2">
                  <p className="text-2xl sm:text-3xl font-extrabold text-white tk-tabular">
                    {cookedMeals30d}{' '}
                    <span className="text-base font-bold text-white/70">bữa đỏ lửa</span>
                  </p>
                  <p className="mt-1.5 text-xs text-white/65">
                    Tiết kiệm trung bình ~45.000đ/khẩu phần so với gọi món ngoài
                  </p>
                </div>
              </div>

              {/* KPI 4: Weekly Burn-Rate & Pantry Alert */}
              <div className="tk-glass-dark rounded-[24px] p-4 sm:p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-white/75">
                    Nhịp Ngân Sách & Tủ Gia Vị
                  </span>
                  <BudgetCoinJarIcon size={20} tone="turmeric" active />
                </div>
                <div className="mt-2">
                  <p className="text-xl sm:text-2xl font-extrabold text-white tk-tabular">
                    {formatVndCompact(budget.spentThisWeekVnd)}{' '}
                    <span className="text-sm font-semibold text-white/55">
                      / {formatVndCompact(budget.weeklyTargetVnd)}
                    </span>
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-white/70 tk-tabular">
                      Đã chi {budget.burnRatePercent}% tuần này
                    </span>
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[11px] font-extrabold tk-tabular',
                        lowStaples.length > 0
                          ? 'bg-tk-flame/30 text-tk-flame-glow'
                          : 'bg-tk-jade/45 text-tk-jade-mint',
                      )}
                    >
                      {lowStaples.length > 0
                        ? `${lowStaples.length} gia vị cạn`
                        : 'Gia vị đủ đầy'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================================
         * 2. SEGMENTED 3-WORKSPACE STUDIO SWITCHER
         * ==================================================================== */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedTabs<InsightsWorkspaceTab>
            layoutId="kitchen-insights-workspace-tabs"
            value={activeTab}
            onChange={handleTabChange}
            className="max-w-full overflow-x-auto no-scrollbar"
            options={[
              {
                value: 'pantry',
                label: 'Tủ Gia Vị Nền Tự Động',
                icon: <FishSauceCruetIcon size={16} tone="flame" active={activeTab === 'pantry'} />,
                badge: lowStaples.length > 0 ? lowStaples.length : thresholds.length || undefined,
              },
              {
                value: 'budget',
                label: 'Ngân Sách Đi Chợ Tuần',
                icon: <BudgetCoinJarIcon size={16} tone="turmeric" active={activeTab === 'budget'} />,
                badge: `${budget.burnRatePercent}%`,
              },
              {
                value: 'waste',
                label: 'Sổ Cái Zero-Waste & Nhật Ký',
                icon: <FreshnessShieldIcon size={16} tone="jade" active={activeTab === 'waste'} />,
              },
            ]}
          />

          <Link
            to="/studio"
            className="inline-flex items-center gap-1.5 rounded-2xl border border-tk-stone/85 bg-white px-4 py-2 text-xs font-extrabold text-tk-ink shadow-xs transition-colors hover:bg-tk-sunken"
          >
            <Sparkles className="h-3.5 w-3.5 text-tk-flame" aria-hidden="true" />
            <span>Sang Xưởng Gia Truyền & Sơ Chế</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* ====================================================================
         * TAB A — TỦ GIA VỊ NỀN TỰ ĐỘNG (SMART PANTRY AUTO-RESTOCK)
         * ==================================================================== */}
        {activeTab === 'pantry' && (
          <section aria-label="Tủ gia vị nền tự động bù giỏ đi chợ" className="space-y-5">
            {/* Auto-restock confirmation banner */}
            {restockBanner && (
              <BentoCard tone="jade" padding="sm" className="border-tk-jade/35 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-tk-jade" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-extrabold text-tk-ink">{restockBanner.messageVi}</p>
                      {restockBanner.addedItems.length > 0 && (
                        <p className="mt-0.5 text-xs text-tk-secondary">
                          Đã thêm:{' '}
                          {restockBanner.addedItems
                            .map((i) => `${i.name} (${i.quantity} ${i.unit})`)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <ActionButton
                    variant="jade"
                    size="sm"
                    to="/shopping"
                    icon={<NavShoppingIcon size={16} tone="cream" active />}
                    trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
                  >
                    Mở Giỏ Đi Chợ Kiểm Tra
                  </ActionButton>
                </div>
              </BentoCard>
            )}

            {thresholds.length === 0 ? (
              /* Empty State with 1-tap Vietnamese Pantry Staples Seeder */
              <BentoCard tone="ceramic" padding="lg" className="text-center max-w-3xl mx-auto">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-tk-flame-soft border border-tk-flame/20">
                  <FishSauceCruetIcon size={34} tone="flame" active />
                </div>
                <AtelierBadge tone="turmeric" className="mb-3">
                  8 GIA VỊ CỐT LÕI BẾP VIỆT
                </AtelierBadge>
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-tk-ink">
                  Chưa bao giờ hết nước mắm nhĩ hay hành tỏi giữa lúc đang nấu
                </h2>
                <p className="mt-2 text-sm text-tk-secondary max-w-xl mx-auto">
                  Thiết lập định mức tối thiểu cho 8 nguyên liệu nền (Nước mắm nhĩ, Gạo thơm ST25, Dầu ăn, Tỏi khô, Hành tím, Trứng gà ta, Đường vàng, Hạt nêm). Khi tồn kho chạm ngưỡng, Takolio tự động đẩy món cạn vào Giỏ Đi Chợ.
                </p>
                <div className="mt-6 flex justify-center">
                  <ActionButton
                    variant="flame"
                    size="lg"
                    loading={seedStaplesMutation.isPending}
                    onClick={() => seedStaplesMutation.mutate()}
                    icon={<Sparkles className="h-4.5 w-4.5" />}
                  >
                    Khởi tạo 8 Gia Vị Nền Chuẩn Bếp Việt
                  </ActionButton>
                </div>
              </BentoCard>
            ) : (
              <>
                {/* Top Action Bar for Auto-Restock */}
                <BentoCard tone="ceramic" padding="md">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-extrabold tracking-tight text-tk-ink">
                          Định Mức Tủ Gia Vị & Đồ Khô Gia Đình
                        </h2>
                        <AtelierBadge tone={lowStaples.length > 0 ? 'flame' : 'jade'}>
                          {lowStaples.length > 0
                            ? `${lowStaples.length} món sắp cạn · Cần bù`
                            : '8/8 gia vị nền đủ dùng'}
                        </AtelierBadge>
                      </div>
                      <p className="mt-1 text-xs sm:text-sm text-tk-secondary">
                        Tự động đối chiếu lượng tồn trong Khoang Tủ Lạnh & Tủ Khô với ngưỡng an toàn của gia đình bạn.
                      </p>
                    </div>

                    <ActionButton
                      variant="flame"
                      size="md"
                      loading={autoRestockMutation.isPending}
                      onClick={() => autoRestockMutation.mutate()}
                      icon={<NavShoppingIcon size={18} tone="cream" active />}
                    >
                      Tự Động Bù Món Cạn Vào Giỏ Đi Chợ
                      {lowStaples.length > 0 ? ` (${lowStaples.length})` : ''}
                    </ActionButton>
                  </div>
                </BentoCard>

                {/* 8 Staples Ceramic Grid */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {thresholds.map((item) => {
                    const StapleIcon = resolveStapleIcon(item);
                    const step = stepIncrementForUnit(item.unit);
                    const stockRatio = Math.min(
                      100,
                      Math.round((item.currentQuantity / Math.max(0.1, item.minQuantity)) * 100),
                    );
                    return (
                      <BentoCard
                        key={item.id}
                        tone={item.isLow ? 'flame' : 'ceramic'}
                        padding="sm"
                        className="flex flex-col justify-between gap-3.5"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-tk-sunken/80 border border-tk-stone/70">
                              <StapleIcon
                                size={22}
                                tone={item.isLow ? 'flame' : 'jade'}
                                active={item.isLow}
                              />
                            </div>
                            <AtelierBadge tone={item.isLow ? 'flame' : 'jade'}>
                              {item.isLow ? 'Sắp cạn · Cần bù' : 'Đủ dùng'}
                            </AtelierBadge>
                          </div>

                          <h3 className="mt-3 text-base font-extrabold text-tk-ink">
                            {item.nameVi}
                          </h3>

                          <div className="mt-2 flex items-baseline justify-between text-xs">
                            <span className="text-tk-secondary">Tồn hiện tại:</span>
                            <span className="font-extrabold text-tk-ink tk-tabular">
                              {item.currentQuantity} {item.unit}
                            </span>
                          </div>

                          {/* Stock Bar */}
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-tk-sunken">
                            <div
                              className={clsx(
                                'h-full rounded-full transition-all duration-300',
                                item.isLow ? 'bg-tk-flame' : 'bg-tk-jade',
                              )}
                              style={{ width: `${Math.max(8, stockRatio)}%` }}
                            />
                          </div>
                        </div>

                        {/* Inline +/- Threshold Adjuster */}
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-tk-stone/75 bg-white/85 px-3 py-2">
                          <span className="text-[11px] font-bold text-tk-secondary">
                            Ngưỡng tối thiểu
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              aria-label={`Giảm ngưỡng ${item.nameVi}`}
                              onClick={() =>
                                adjustThresholdMutation.mutate({ item, delta: -step })
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-tk-stone bg-tk-canvas text-tk-ink transition-colors hover:bg-tk-sunken cursor-pointer"
                            >
                              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <span className="min-w-[54px] text-center text-xs font-extrabold text-tk-ink tk-tabular">
                              {item.minQuantity} {item.unit}
                            </span>
                            <button
                              type="button"
                              aria-label={`Tăng ngưỡng ${item.nameVi}`}
                              onClick={() =>
                                adjustThresholdMutation.mutate({ item, delta: step })
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-tk-stone bg-tk-canvas text-tk-ink transition-colors hover:bg-tk-sunken cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </BentoCard>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {/* ====================================================================
         * TAB B — NGÂN SÁCH ĐI CHỢ & CHI TIÊU TUẦN
         * ==================================================================== */}
        {activeTab === 'budget' && (
          <section aria-label="Ngân sách đi chợ và chi tiêu tuần" className="space-y-5">
            {budgetStatusNotice && (
              <BentoCard tone="jade" padding="sm" className="animate-fade-in">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs sm:text-sm font-bold text-tk-jade-deep">
                    {budgetStatusNotice}
                  </p>
                  <button
                    type="button"
                    onClick={() => setBudgetStatusNotice(null)}
                    className="text-xs font-bold text-tk-muted hover:text-tk-ink cursor-pointer"
                  >
                    Ẩn
                  </button>
                </div>
              </BentoCard>
            )}

            <div className="grid gap-5 lg:grid-cols-12">
              {/* Left Column: Burn-Rate Meter & Target Presets */}
              <BentoCard tone="ceramic" padding="md" className="lg:col-span-7 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <AtelierBadge tone="turmeric" className="mb-2">
                      NHỊP ĐỐT NGÂN SÁCH TUẦN
                    </AtelierBadge>
                    <h2 className="text-xl font-extrabold tracking-tight text-tk-ink">
                      Đã chi {formatVnd(budget.spentThisWeekVnd)}{' '}
                      <span className="text-sm font-bold text-tk-muted">
                        / mục tiêu {formatVnd(budget.weeklyTargetVnd)}
                      </span>
                    </h2>
                  </div>
                  <AtelierBadge
                    tone={
                      budget.burnRatePercent > 100
                        ? 'flame'
                        : budget.burnRatePercent >= 80
                          ? 'turmeric'
                          : 'jade'
                    }
                    className="tk-tabular text-sm px-3 py-1"
                  >
                    {budget.burnRatePercent}% hạn mức
                  </AtelierBadge>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="h-4 w-full overflow-hidden rounded-full bg-tk-sunken p-0.5 border border-tk-stone/70">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all duration-500',
                        budget.burnRatePercent > 100
                          ? 'bg-tk-flame'
                          : budget.burnRatePercent >= 80
                            ? 'bg-tk-turmeric'
                            : 'bg-tk-jade',
                      )}
                      style={{ width: `${Math.min(100, Math.max(4, budget.burnRatePercent))}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs font-bold tk-tabular">
                    <span className="text-tk-secondary">0đ đầu tuần</span>
                    <span
                      className={
                        budget.remainingVnd >= 0 ? 'text-tk-jade' : 'text-tk-flame'
                      }
                    >
                      {budget.remainingVnd >= 0
                        ? `Còn dư ${formatVnd(budget.remainingVnd)} cho các bữa tới`
                        : `Vượt hạn mức ${formatVnd(Math.abs(budget.remainingVnd))}`}
                    </span>
                  </div>
                </div>

                {/* Preset Weekly Target Selector */}
                <div className="rounded-2xl bg-tk-sunken/65 p-4 border border-tk-stone/70 space-y-3">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-tk-secondary">
                    Chỉnh nhanh hạn mức đi chợ tuần
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {BUDGET_PRESETS_VND.map((preset) => {
                      const active = budget.weeklyTargetVnd === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => updateBudgetTargetMutation.mutate(preset)}
                          className={clsx(
                            'rounded-xl border px-3.5 py-2 text-xs font-extrabold transition-colors tk-tabular cursor-pointer',
                            active
                              ? 'border-tk-jade bg-tk-jade text-white shadow-xs'
                              : 'border-tk-stone bg-white text-tk-ink hover:bg-tk-canvas',
                          )}
                        >
                          {formatVnd(preset)}
                        </button>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const numeric = Number(customTargetInput.replace(/[^\d]/g, ''));
                      if (Number.isFinite(numeric) && numeric >= 100_000) {
                        updateBudgetTargetMutation.mutate(numeric);
                      }
                    }}
                    className="flex flex-wrap items-center gap-2 pt-1"
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customTargetInput}
                      onChange={(e) => setCustomTargetInput(e.target.value)}
                      placeholder="Hoặc nhập hạn mức riêng (VD: 1500000)"
                      className="min-w-[200px] flex-1 rounded-xl border border-tk-stone bg-white px-3.5 py-2 text-xs font-semibold text-tk-ink focus:border-tk-jade focus:outline-none tk-tabular"
                    />
                    <ActionButton
                      type="submit"
                      variant="ceramic"
                      size="sm"
                      loading={updateBudgetTargetMutation.isPending}
                    >
                      Lưu hạn mức
                    </ActionButton>
                  </form>
                </div>

                {/* Category Breakdown Bars */}
                <div className="space-y-2.5">
                  <h3 className="text-sm font-extrabold text-tk-ink">
                    Cơ cấu chi tiêu theo nhóm thực phẩm
                  </h3>
                  {budget.byCategory.length === 0 ? (
                    <p className="text-xs text-tk-muted">Chưa có khoản chi nào trong tuần này.</p>
                  ) : (
                    budget.byCategory.map((cat) => (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-tk-ink">{cat.labelVi}</span>
                          <span className="text-tk-secondary tk-tabular">
                            {formatVnd(cat.amountVnd)} ({cat.sharePercent}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-tk-sunken">
                          <div
                            className="h-full rounded-full bg-tk-turmeric"
                            style={{ width: `${Math.max(6, cat.sharePercent)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </BentoCard>

              {/* Right Column: Quick 1-Tap Expense Logger + Ledger */}
              <div className="lg:col-span-5 space-y-5">
                <BentoCard tone="ceramic" padding="md" className="space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4.5 w-4.5 text-tk-flame" aria-hidden="true" />
                    <h3 className="text-base font-extrabold text-tk-ink">
                      Ghi Nhanh Khoản Đi Chợ 1 Chạm
                    </h3>
                  </div>

                  {/* Category Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {EXPENSE_CATEGORIES.map((cat) => {
                      const active = selectedExpenseCat === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedExpenseCat(cat.id)}
                          className={clsx(
                            'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer',
                            active
                              ? 'border-tk-flame bg-tk-flame text-white'
                              : 'border-tk-stone bg-tk-canvas text-tk-secondary hover:text-tk-ink',
                          )}
                        >
                          {cat.labelVi}
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Amount Presets */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {QUICK_EXPENSE_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setExpenseAmountInput(String(amt))}
                        className={clsx(
                          'rounded-xl border py-2 text-xs font-extrabold tk-tabular transition-colors cursor-pointer',
                          Number(expenseAmountInput) === amt
                            ? 'border-tk-turmeric bg-tk-turmeric-soft text-tk-turmeric-deep'
                            : 'border-tk-stone/80 bg-white text-tk-ink hover:bg-tk-sunken',
                        )}
                      >
                        {formatVndCompact(amt)}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={expenseAmountInput}
                      onChange={(e) => setExpenseAmountInput(e.target.value)}
                      placeholder="Số tiền (VND)"
                      aria-label="Số tiền đi chợ VND"
                      className="rounded-xl border border-tk-stone bg-white px-3.5 py-2.5 text-sm font-extrabold text-tk-ink focus:border-tk-flame focus:outline-none tk-tabular"
                    />
                    <input
                      type="text"
                      value={expenseNoteInput}
                      onChange={(e) => setExpenseNoteInput(e.target.value)}
                      placeholder="Ghi chú (VD: Cá thu, rau muống)"
                      aria-label="Ghi chú khoản chi"
                      className="rounded-xl border border-tk-stone bg-white px-3.5 py-2.5 text-sm text-tk-ink focus:border-tk-flame focus:outline-none"
                    />
                  </div>

                  <ActionButton
                    variant="flame"
                    size="md"
                    fullWidth
                    loading={addExpenseMutation.isPending}
                    onClick={() => {
                      const amt = Number(expenseAmountInput.replace(/[^\d]/g, ''));
                      if (Number.isFinite(amt) && amt >= 1_000) {
                        addExpenseMutation.mutate({
                          amountVnd: amt,
                          category: selectedExpenseCat,
                          note: expenseNoteInput.trim() || undefined,
                        });
                      }
                    }}
                  >
                    Ghi Vào Sổ Chi Tiêu Tuần
                  </ActionButton>
                </BentoCard>

                {/* Recent Expense Ledger */}
                <BentoCard tone="ceramic" padding="md" className="space-y-3">
                  <h3 className="text-sm font-extrabold text-tk-ink">
                    Sổ Chi Tiêu Gần Đây ({budget.entries.length})
                  </h3>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {budget.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-tk-stone/65 bg-tk-canvas/55 px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-extrabold text-tk-ink">
                            {entry.categoryLabelVi}
                          </p>
                          <p className="truncate text-[11px] text-tk-muted">
                            {entry.note || entry.actorName} · {formatRelativeTimeVi(entry.createdAt)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-extrabold text-tk-ink tk-tabular">
                          {formatVnd(entry.amountVnd)}
                        </span>
                      </div>
                    ))}
                  </div>
                </BentoCard>
              </div>
            </div>
          </section>
        )}

        {/* ====================================================================
         * TAB C — SỔ CÁI ZERO-WASTE & NHẬT KÝ GIA ĐÌNH
         * ==================================================================== */}
        {activeTab === 'waste' && (
          <section aria-label="Sổ cái chống lãng phí và nhật ký bếp gia đình" className="space-y-5">
            {wasteFeedbackBanner && (
              <BentoCard tone="jade" padding="sm" className="animate-fade-in">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs sm:text-sm font-extrabold text-tk-jade-deep">
                    {wasteFeedbackBanner}
                  </p>
                  <button
                    type="button"
                    onClick={() => setWasteFeedbackBanner(null)}
                    className="text-xs font-bold text-tk-muted hover:text-tk-ink cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </BentoCard>
            )}

            <div className="grid gap-5 lg:grid-cols-12">
              {/* Quick 1-Tap Waste/Rescue Logger */}
              <BentoCard tone="ceramic" padding="md" className="lg:col-span-7 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <AtelierBadge tone="jade" className="mb-1.5">
                      GHI SỔ ZERO-WASTE 1 CHẠM
                    </AtelierBadge>
                    <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-tk-ink">
                      Ghi Nhận Giải Cứu Hoặc Tuần Hoàn Thực Phẩm
                    </h2>
                    <p className="mt-1 text-xs text-tk-secondary">
                      Mỗi lần nấu kịp đồ cận hạn hoặc cất hộp phần ăn dư sẽ cộng trực tiếp vào Điểm Zero-Waste & Quỹ Thực Phẩm Đã Cứu.
                    </p>
                  </div>
                  <LeftoverBoxIcon size={28} tone="jade" active />
                </div>

                {/* Quick Item Suggestion Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {expiringChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setWasteItemInput(chip)}
                      className={clsx(
                        'rounded-full border px-3 py-1 text-xs font-bold transition-colors cursor-pointer',
                        wasteItemInput === chip
                          ? 'border-tk-jade bg-tk-jade-soft text-tk-jade-deep'
                          : 'border-tk-stone bg-tk-canvas text-tk-secondary hover:text-tk-ink',
                      )}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Item & Value Inputs */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-tk-secondary mb-1">
                      Tên nguyên liệu / món ăn
                    </label>
                    <input
                      type="text"
                      value={wasteItemInput}
                      onChange={(e) => setWasteItemInput(e.target.value)}
                      placeholder="VD: Đậu phụ, rau cải ngọt, cá kho dư..."
                      className="w-full rounded-xl border border-tk-stone bg-white px-3.5 py-2.5 text-sm font-semibold text-tk-ink focus:border-tk-jade focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-tk-secondary mb-1">
                      Giá trị ước tính (VND)
                    </label>
                    <select
                      value={wasteValueInput}
                      onChange={(e) => setWasteValueInput(Number(e.target.value))}
                      className="w-full rounded-xl border border-tk-stone bg-white px-3 py-2.5 text-sm font-extrabold text-tk-ink focus:border-tk-jade focus:outline-none tk-tabular"
                    >
                      <option value={20_000}>20.000đ</option>
                      <option value={35_000}>35.000đ</option>
                      <option value={45_000}>45.000đ</option>
                      <option value={65_000}>65.000đ</option>
                      <option value={95_000}>95.000đ</option>
                      <option value={150_000}>150.000đ</option>
                    </select>
                  </div>
                </div>

                {/* 4 Action Cards */}
                <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
                  {WASTE_ACTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.eventType}
                      type="button"
                      disabled={logWasteMutation.isPending}
                      onClick={() => logWasteMutation.mutate(opt.eventType)}
                      className={clsx(
                        'flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all cursor-pointer active:scale-[0.985]',
                        opt.tone === 'jade'
                          ? 'border-tk-jade/30 bg-tk-jade-soft/55 hover:bg-tk-jade-soft'
                          : opt.tone === 'turmeric'
                            ? 'border-tk-turmeric/35 bg-tk-turmeric-soft/65 hover:bg-tk-turmeric-soft'
                            : 'border-tk-berry/30 bg-tk-berry-soft/55 hover:bg-tk-berry-soft',
                      )}
                    >
                      <span className="text-sm font-extrabold text-tk-ink">
                        {opt.labelVi}
                      </span>
                      <span className="mt-1 text-xs text-tk-secondary">
                        {opt.subtitleVi}
                      </span>
                    </button>
                  ))}
                </div>
              </BentoCard>

              {/* Live Household Kitchen Activity Timeline */}
              <BentoCard tone="ceramic" padding="md" className="lg:col-span-5 flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <HouseholdTrayIcon size={20} tone="jade" active />
                    <h2 className="text-base font-extrabold text-tk-ink">
                      Nhật Ký Hoạt Động Bếp Gia Đình
                    </h2>
                  </div>
                  <AtelierBadge tone="neutral" className="tk-tabular">
                    {activityFeed.length} sự kiện
                  </AtelierBadge>
                </div>

                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {activityFeed.map((act) => {
                    const isDiscard = act.actionType === 'waste_discard';
                    return (
                      <div
                        key={act.id}
                        className="relative flex items-start gap-3 rounded-2xl border border-tk-stone/70 bg-tk-canvas/55 p-3"
                      >
                        <div
                          className={clsx(
                            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                            isDiscard
                              ? 'bg-tk-berry-soft text-tk-berry'
                              : 'bg-tk-jade-soft text-tk-jade',
                          )}
                        >
                          {isDiscard ? (
                            <ExpiryRescueBellIcon size={17} tone="flame" active />
                          ) : (
                            <FreshnessShieldIcon size={17} tone="jade" active />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-extrabold text-tk-ink leading-snug">
                            {act.titleVi}
                          </p>
                          {act.detailVi && (
                            <p className="mt-0.5 text-xs text-tk-secondary">{act.detailVi}</p>
                          )}
                          <div className="mt-1.5 flex items-center justify-between text-[11px] text-tk-muted">
                            <span className="font-semibold">{act.actorName}</span>
                            <span className="tk-tabular">{formatRelativeTimeVi(act.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </BentoCard>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default KitchenInsightsPage;
