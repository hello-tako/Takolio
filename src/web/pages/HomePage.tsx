import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, Clock, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../stores/useAuthStore';
import { TopBar } from '../components/common/TopBar';
import { RecipeCard } from '../components/common/RecipeCard';
import { RecipeMedia } from '../components/common/RecipeMedia';
import { KitchenLoopStrip } from '../components/cooking/CookingTechniqueVisual';
import { InlineLoading, InlineError, SkeletonCard } from '../components/common/AsyncState';
import { Button } from '../components/common/Button';
import { resolveCategoryIcon } from '../components/common/IngredientRow';
import { TakoChef3D } from '../components/3d';
import {
  AtelierBadge,
  BentoCard,
  RadialProgressRing,
} from '../design-system/v4/AtelierPrimitives';
import {
  AiSousChefSparkIcon,
  BudgetCoinJarIcon,
  ChopsticksBowlIcon,
  ClaypotBraiseIcon,
  ExpiryRescueBellIcon,
  FreshnessShieldIcon,
  HouseholdTrayIcon,
  NavRecipesIcon,
  NavShoppingIcon,
  ReceiptScanIcon,
  StockpotSoupIcon,
  WokFlameIcon,
} from '../design-system/icons';
import { api } from '../services/api';
import { aiCopilotApi, type FridgeRescueBrief } from '../services/ai-copilot';
import { queryKeys } from '../lib/queryKeys';
import { daysUntil } from '../lib/format';
import { presentExpiry } from '../lib/inventory-truth';
import { calendarLabel, type HomePlan } from '../lib/home-plan';
import { useHomePlan } from '../lib/use-home-plan';
import { getIngredientImage } from '../lib/ingredient-images';
import { resolveRecipeImage, resolveRecipeImageV4 } from '../lib/recipe-media';

const MEAL_LABELS = { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', dinner: 'Bữa tối' } as const;

function getTimeOfDayGreetingVi(now: Date, firstName?: string): {
  greeting: string;
  subline: string;
} {
  const hour = now.getHours();
  const suffix = firstName ? `, ${firstName}` : '';
  if (hour >= 5 && hour < 11) {
    return {
      greeting: `Chào buổi sáng${suffix}`,
      subline: 'Khởi đầu ngày mới nhẹ nhàng từ những nguyên liệu tươi sẵn trong tủ.',
    };
  }
  if (hour >= 11 && hour < 14) {
    return {
      greeting: `Bữa trưa ấm áp${suffix}`,
      subline: 'Gợi ý mâm cơm gọn gàng, đủ chất và tiết kiệm thời gian giữa ngày.',
    };
  }
  if (hour >= 14 && hour < 18) {
    return {
      greeting: `Bếp chiều thong thả${suffix}`,
      subline: 'Xem trước bữa tối, chuẩn bị phần sơ chế và tận dụng rau thịt nên dùng sớm.',
    };
  }
  return {
    greeting: `Bữa tối sum vầy${suffix}`,
    subline: 'Đỏ lửa căn bếp ấm cúng với mâm cơm chuẩn vị gia đình Việt.',
  };
}

function classifyDishRoleBadge(dishTitle: string, index: number): {
  roleLabel: string;
  Icon: typeof ClaypotBraiseIcon;
  tone: 'flame' | 'jade' | 'turmeric' | 'ink';
} {
  const lower = dishTitle.toLowerCase();
  if (/\b(canh|súp|lẩu)\b/.test(lower)) {
    return { roleLabel: 'Canh', Icon: StockpotSoupIcon, tone: 'jade' };
  }
  if (/\b(xào|luộc|trộn|gỏi|nộm|rau)\b/.test(lower)) {
    return { roleLabel: 'Xào / Rau', Icon: WokFlameIcon, tone: 'jade' };
  }
  if (/\b(cơm|bún|miến|phở)\b/.test(lower)) {
    return { roleLabel: 'Cơm', Icon: ChopsticksBowlIcon, tone: 'turmeric' };
  }
  if (index === 0 || /\b(kho|rim|chiên|rán|nướng|om|hấp)\b/.test(lower)) {
    return { roleLabel: 'Mặn', Icon: ClaypotBraiseIcon, tone: 'flame' };
  }
  const fallbackRoles = [
    { roleLabel: 'Mặn', Icon: ClaypotBraiseIcon, tone: 'flame' as const },
    { roleLabel: 'Canh', Icon: StockpotSoupIcon, tone: 'jade' as const },
    { roleLabel: 'Xào', Icon: WokFlameIcon, tone: 'jade' as const },
    { roleLabel: 'Cơm', Icon: ChopsticksBowlIcon, tone: 'turmeric' as const },
  ];
  return fallbackRoles[index % fallbackRoles.length];
}

function PlannedMeal({
  plan,
  onRetry,
  onStartCooking,
}: {
  plan: HomePlan;
  onRetry: () => void;
  onStartCooking: (targetHref: string) => void;
}) {
  const meal = plan.meal;
  const label = meal ? calendarLabel(meal.date, plan.today) : null;
  const legacyResolved = meal?.recipe ? resolveRecipeImage(meal.recipe) : null;
  const sunlitArtwork =
    meal && meal.dishes.length > 0
      ? meal.recipe
        ? resolveRecipeImageV4(meal.recipe)
        : resolveRecipeImageV4({
            title: meal.dishes[0],
            cuisine: 'vietnamese',
            imageUrl: legacyResolved?.src,
          })
      : null;

  const directCookHref = meal?.recipe?.slug
    ? `/cook/${encodeURIComponent(meal.recipe.slug)}`
    : (meal?.href ?? plan.href);

  return (
    <section
      aria-labelledby="home-plan-heading"
      className="home-plan-card !rounded-[28px] !border !border-tk-stone/85 !border-l-4 !border-l-tk-flame bg-white shadow-card overflow-hidden"
      data-meal-state={meal?.state ?? 'no-upcoming'}
    >
      <div className="home-plan-copy flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="kitchen-eyebrow !mb-0 !text-tk-flame">
              <CalendarDays size={16} aria-hidden="true" />
              {meal ? `${MEAL_LABELS[meal.mealType]} · ${label}` : 'Thực đơn của bạn'}
            </p>
            {meal?.state === 'ready' && meal.dishes.length > 1 && (
              <AtelierBadge tone="jade" icon={<HouseholdTrayIcon size={13} tone="jade" active />}>
                Mâm cơm {meal.dishes.length} món
              </AtelierBadge>
            )}
          </div>

          <h2 id="home-plan-heading" className="home-meal-title mt-2.5 text-tk-ink">
            {!meal
              ? 'Không còn bữa sắp tới trong lịch'
              : meal.state === 'pending'
                ? 'Đang tải các món trong bữa…'
                : meal.state === 'error'
                  ? 'Chưa kiểm tra được các món trong bữa'
                  : meal.state === 'empty'
                    ? 'Bữa này chưa có món nào'
                    : meal.dishes.length === 1
                      ? meal.dishes[0]
                      : `${MEAL_LABELS[meal.mealType]} có ${meal.dishes.length} món`}
          </h2>

          {meal?.state === 'ready' && meal.dishes.length > 1 && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Các món trong bữa">
              {meal.dishes.map((title, index) => {
                const role = classifyDishRoleBadge(title, index);
                const RoleIcon = role.Icon;
                return (
                  <li
                    key={`${title}-${index}`}
                    className="flex items-center gap-2.5 rounded-2xl border border-tk-stone/75 bg-tk-sunken/60 px-3 py-2 text-sm font-bold text-tk-ink"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs">
                      <RoleIcon size={15} tone={role.tone} active />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{title}</span>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-tk-secondary">
                      {role.roleLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {meal && (
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-tk-secondary tk-tabular">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-tk-sunken px-3 py-1">
                <Users size={15} aria-hidden="true" className="text-tk-jade" />
                {meal.servings} người
              </span>
              {meal.state === 'ready' && meal.cookTimeMinutes !== null && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-tk-sunken px-3 py-1">
                  <Clock size={15} aria-hidden="true" className="text-tk-flame" />
                  {meal.cookTimeMinutes} phút
                </span>
              )}
            </div>
          )}

          {meal && meal.date > plan.today && (
            <p className="mt-3 text-sm text-tk-secondary">
              {plan.startDate > plan.today
                ? `Thực đơn bắt đầu ${calendarLabel(plan.startDate, plan.today).toLocaleLowerCase('vi-VN')}.`
                : 'Đây là bữa sắp tới trong lịch của bạn.'}
            </p>
          )}

          {meal?.state === 'pending' && (
            <p role="status" className="mt-3 text-sm text-tk-secondary">
              Đang kiểm tra thực đơn mới nhất.
            </p>
          )}

          {meal?.state === 'error' && (
            <div role="alert" className="mt-3 text-sm text-semantic-danger-strong">
              <p>
                Thực đơn có thể đã thay đổi hoặc chưa tải được. Tải lại để xem các món hiện tại.
              </p>
              <Button variant="outline" className="mt-3" onClick={onRetry}>
                Tải lại thực đơn
              </Button>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {/* Primary authoritative plan link (must stay first <a> in section) */}
          <Link
            to={meal?.href ?? plan.href}
            className="kitchen-primary-link !rounded-2xl !bg-tk-jade hover:!bg-tk-jade-hover shadow-jade font-extrabold"
          >
            {meal?.state === 'empty'
              ? 'Chọn món cho bữa này'
              : meal
                ? 'Xem bữa ăn'
                : 'Xem thực đơn'}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>

          {meal?.state === 'ready' && (
            <button
              type="button"
              onClick={() => onStartCooking(directCookHref)}
              className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-tk-flame px-5 py-3 text-sm font-extrabold text-white shadow-float transition-tap hover:bg-tk-flame-hover active:scale-[0.985] cursor-pointer"
            >
              <WokFlameIcon size={18} tone="cream" active />
              <span>Vào bếp nấu ngay</span>
            </button>
          )}
        </div>

        {plan.requiresReview && (
          <p className="mt-3 text-sm font-semibold text-semantic-warning-strong">
            Dữ liệu đã thay đổi. Kiểm tra lại nguyên liệu trước khi nấu.
          </p>
        )}
      </div>

      {sunlitArtwork && meal && (
        <div className="w-full sm:w-64 md:w-72 shrink-0 p-3 sm:p-4 flex items-center">
          <RecipeMedia
            className="home-meal-media w-full rounded-2xl shadow-card"
            image={sunlitArtwork}
            title={meal.dishes[0]}
            aspectClass="aspect-[4/3]"
          />
        </div>
      )}
    </section>
  );
}

export const HomePage = () => {
  const navigate = useNavigate();
  const { displayName, householdSize, dietaryRestrictions } = useAuthStore();
  const [now, setNow] = useState(() => new Date());
  const [rescueBrief, setRescueBrief] = useState<FridgeRescueBrief | null>(null);
  const [rescueLoading, setRescueLoading] = useState(false);
  const [rescueError, setRescueError] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, []);

  const home = useHomePlan(now);
  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
  });
  const recommendationsQuery = useQuery({
    queryKey: queryKeys.recipeDiscovery({ pageSize: 3 }),
    queryFn: () => api.getRecipeDiscovery({ pageSize: 3 }),
  });

  const inventory = (inventoryQuery.data ?? []).filter(
    (item) => item.quantity === undefined || item.quantity > 0,
  );
  const useSoonAll = inventory.filter(
    (item) => item.freshness === 'use_soon' || item.freshness === 'expiring',
  );
  const freshCount = Math.max(0, inventory.length - useSoonAll.length);
  const readinessScore =
    inventory.length === 0
      ? 0
      : Math.round(
          Math.min(
            100,
            Math.max(20, (freshCount / inventory.length) * 85 + Math.min(15, inventory.length * 3)),
          ),
        );

  const useSoon = [...useSoonAll]
    .sort(
      (a, b) =>
        (daysUntil(presentExpiry(a).date ?? undefined) ?? 99) -
        (daysUntil(presentExpiry(b).date ?? undefined) ?? 99),
    )
    .slice(0, 4);

  const firstName = displayName?.trim().split(/\s+/).at(-1);
  const timeGreeting = getTimeOfDayGreetingVi(now, firstName);
  const plan = home.plan;
  const recommendations = recommendationsQuery.data?.items ?? [];

  const handleRequestAiFridgeRescue = async () => {
    if (rescueLoading) return;
    setRescueLoading(true);
    setRescueError(null);
    try {
      const brief = await aiCopilotApi.getFridgeRescueBrief({
        fridgeItems: inventory.map((item) => ({
          id: item.id,
          name: item.name,
          ingredientId: item.ingredientId ?? null,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          storage: item.storage,
          expiryDate: presentExpiry(item).date,
          freshness: item.freshness,
        })),
        householdAllergens: dietaryRestrictions?.length ? dietaryRestrictions : undefined,
        availableCookTimeMinutes: 15,
        servings: householdSize || 2,
      });
      setRescueBrief(brief);
    } catch {
      setRescueError('Chưa kết nối được AI Bếp Trưởng lúc này. Vui lòng thử lại sau giây lát.');
    } finally {
      setRescueLoading(false);
    }
  };

  return (
    <div
      className="takosan-rebuild min-h-screen bg-tk-canvas pb-14"
      data-page="home-s08"
    >
      <TopBar kitchen />

      <div className="kitchen-page-body space-y-6">
        {/* 1. OBSIDIAN HEARTH KITCHEN COMMAND HERO & AMBIENT CINEMA BANNER */}
        <section
          aria-label="Trung tâm điều phối gian bếp"
          className="tk-cinema-stage tk-sanctuary-theme p-6 sm:p-8 text-white"
        >
          {/* Subtle Looping Golden-Hour Mâm Cơm Ambient Backdrop */}
          <img
            src="/takolio/v5/posters/mamcom-poster.webp"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
          />
          <video
            ref={(el) => {
              if (!el) return;
              if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent ?? '')) return;
              if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
              try {
                const p = el.play?.();
                if (p && typeof p.catch === 'function') p.catch(() => {});
              } catch {
                // Ignore autoplay restrictions
              }
            }}
            src="/takolio/v5/videos/mam-com-hearth-loop.mp4"
            poster="/takolio/v5/posters/mamcom-poster.webp"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-48"
          />
          <div
            aria-hidden="true"
            className="tk-cinema-vignette pointer-events-none absolute inset-0"
          />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1 space-y-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <AtelierBadge tone="dark" icon={<FreshnessShieldIcon size={14} tone="cream" active />}>
                  {timeGreeting.greeting}
                </AtelierBadge>
                {useSoonAll.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-pill border border-tk-turmeric bg-tk-turmeric px-2.5 py-1 text-xs font-extrabold text-white tk-tabular">
                    <ExpiryRescueBellIcon size={13} tone="cream" active />
                    <span>{useSoonAll.length} món nên dùng sớm</span>
                  </span>
                )}
              </div>

              <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Hôm nay ăn gì?
              </h1>
              <p className="max-w-2xl text-sm sm:text-base text-white/80 leading-relaxed">
                {timeGreeting.subline}
              </p>

              {/* High-Contrast Quick-Action Pills */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Link
                  to="/scan"
                  className="tap-target inline-flex items-center gap-2 rounded-full bg-tk-flame px-4.5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-float transition-tap hover:bg-tk-flame-hover active:scale-[0.985]"
                >
                  <ReceiptScanIcon size={17} tone="cream" active />
                  <span>Quét hóa đơn / tủ lạnh</span>
                </Link>
                <Link
                  to="/shopping"
                  className="tk-glass-dark tap-target inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs sm:text-sm font-bold text-white transition-colors hover:bg-white/16"
                >
                  <NavShoppingIcon size={17} tone="cream" active />
                  <span>Đi chợ</span>
                </Link>
                <Link
                  to="/recipes"
                  className="tk-glass-dark tap-target inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs sm:text-sm font-bold text-white transition-colors hover:bg-white/16"
                >
                  <NavRecipesIcon size={17} tone="flame" active />
                  <span>Khám phá món</span>
                </Link>
              </div>
            </div>

            {/* Kitchen Readiness Ring + Obsidian & Terracotta Culinary Medallion */}
            <div className="tk-glass-dark flex flex-wrap items-center gap-4 rounded-[24px] p-4 text-white shrink-0">
              <RadialProgressRing
                value={readinessScore}
                size={68}
                strokeWidth={6}
                tone={useSoonAll.length > 2 ? 'turmeric' : 'flame'}
                label={
                  <span className="text-xs font-extrabold text-white tk-tabular">
                    {inventory.length} món
                  </span>
                }
              />
              <div className="space-y-1 text-xs tk-tabular">
                <p className="font-extrabold text-sm text-white">Nhịp sẵn sàng căn bếp</p>
                <p className="text-white/80">
                  Tươi mới: <strong className="text-tk-jade-mint">{freshCount}</strong> · Dùng sớm:{' '}
                  <strong className="text-tk-flame-glow">{useSoonAll.length}</strong>
                </p>
                <p className="text-white/60">
                  {inventory.length > 0
                    ? 'Sẵn sàng phối mâm cơm từ tủ lạnh'
                    : 'Quét tủ lạnh để bắt đầu gợi ý'}
                </p>
              </div>
              <div className="hidden sm:block">
                <TakoChef3D pose="wave" size={84} interactive={false} />
              </div>
            </div>
          </div>
        </section>

        <KitchenLoopStrip
          activeStage={plan ? 'plan' : inventory.length > 0 ? 'recipes' : 'fridge'}
          summaryText={
            inventory.length > 0
              ? `Tủ lạnh đang có ${inventory.length} nguyên liệu${useSoonAll.length > 0 ? ` · ${useSoonAll.length} nguyên liệu nên dùng sớm` : ''}`
              : 'Bắt đầu từ tủ lạnh hoặc chọn món yêu thích cho bữa tới'
          }
        />

        {/* MAIN BENTO WORKSPACE */}
        <div className="home-workspace">
          <div data-testid="t18c-home-primary" className="min-w-0 space-y-6">
            {/* 2. FEATURED NEXT MEAL / MÂM CƠM CARD */}
            {home.requiresAccount ? (
              <section
                aria-labelledby="home-plan-heading"
                className="home-plan-card !rounded-[28px] !border !border-tk-stone/85 !border-l-4 !border-l-tk-flame bg-white shadow-card"
              >
                <div className="home-plan-copy">
                  <p className="kitchen-eyebrow !text-tk-flame">Thực đơn của bạn</p>
                  <h2 id="home-plan-heading" className="home-meal-title text-tk-ink">
                    Đăng nhập để lập thực đơn
                  </h2>
                  <p className="mt-3 text-base text-tk-secondary">
                    Thực đơn được lưu theo tài khoản của bạn. Bạn vẫn có thể dùng tủ lạnh và xem
                    công thức trong phiên khách.
                  </p>
                  <Link
                    className="kitchen-primary-link mt-5 !rounded-2xl !bg-tk-flame hover:!bg-tk-flame-hover shadow-float font-extrabold"
                    to="/auth?mode=login&returnTo=%2Fplanner"
                  >
                    Đăng nhập để tiếp tục <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </div>
              </section>
            ) : home.query.isPending ? (
              <div role="status">
                <SkeletonCard className="h-64 rounded-[28px]" />
                <span className="sr-only">Đang tải thực đơn…</span>
              </div>
            ) : home.query.isError ? (
              <InlineError error={home.query.error} onRetry={() => void home.retry()} />
            ) : plan ? (
              <PlannedMeal
                plan={plan}
                onRetry={() => void home.retry()}
                onStartCooking={(href) => navigate(href)}
              />
            ) : (
              <section
                aria-labelledby="home-plan-heading"
                className="home-plan-card !rounded-[28px] !border !border-tk-stone/85 !border-l-4 !border-l-tk-jade bg-white shadow-card"
              >
                <div className="home-plan-copy">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="kitchen-eyebrow !text-tk-jade">
                        <HouseholdTrayIcon size={16} tone="jade" active />
                        <span>Bắt đầu từ căn bếp của bạn</span>
                      </p>
                      <h2 id="home-plan-heading" className="home-meal-title text-tk-ink">
                        Chưa có thực đơn hiện tại
                      </h2>
                      <p className="mt-3 text-base text-tk-secondary">
                        Chọn ngày và số người. Takolio tự động phối mâm cơm đủ Mặn · Canh · Xào · Cơm
                        từ nguyên liệu đang có trong tủ lạnh.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <AtelierBadge tone="flame" icon={<ClaypotBraiseIcon size={13} tone="flame" />}>
                          Món mặn
                        </AtelierBadge>
                        <AtelierBadge tone="jade" icon={<StockpotSoupIcon size={13} tone="jade" />}>
                          Món canh
                        </AtelierBadge>
                        <AtelierBadge tone="jade" icon={<WokFlameIcon size={13} tone="jade" />}>
                          Món xào
                        </AtelierBadge>
                        <AtelierBadge
                          tone="turmeric"
                          icon={<ChopsticksBowlIcon size={13} tone="turmeric" />}
                        >
                          Cơm nóng
                        </AtelierBadge>
                      </div>
                      <Link
                        className="kitchen-primary-link mt-5 !rounded-2xl !bg-tk-flame hover:!bg-tk-flame-hover shadow-float font-extrabold"
                        to={home.setupHref}
                      >
                        Tạo thực đơn thông minh <ArrowRight size={18} aria-hidden="true" />
                      </Link>
                    </div>
                    <div className="hidden sm:block shrink-0">
                      <TakoChef3D pose="think" size={112} interactive={false} />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {plan && home.query.isSuccess && (
              <section
                className="home-plan-summary rounded-2xl border border-tk-stone/80 bg-white px-5 py-4 shadow-xs"
                aria-label="Tổng quan thực đơn"
              >
                <div>
                  <p className="kitchen-eyebrow !mb-1 !text-tk-jade">Trong thực đơn</p>
                  <p className="text-lg font-extrabold text-tk-ink tk-tabular">
                    {plan.planned === null
                      ? plan.meal?.state === 'error'
                        ? 'Chưa kiểm tra được các bữa đã xếp'
                        : plan.meal?.state === 'pending'
                          ? 'Đang kiểm tra các bữa đã xếp'
                          : 'Chưa xác nhận số bữa đã xếp'
                      : `${plan.planned}/${plan.total} bữa đã xếp`}
                  </p>
                  {plan.budgetText && (
                    <p className="mt-1 text-sm text-tk-muted">{plan.budgetText}</p>
                  )}
                </div>
                <Link to={plan.href} className="kitchen-text-link !text-tk-jade font-extrabold">
                  Xem lịch <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </section>
            )}

            {/* 3. AI ZERO-WASTE FRIDGE RESCUE STUDIO CARD */}
            <BentoCard
              tone="ceramic"
              padding="md"
              aria-labelledby="use-soon-heading"
              className="space-y-4 border-tk-stone/85"
            >
              <div className="kitchen-section-heading">
                <div className="flex items-center gap-2">
                  <ExpiryRescueBellIcon size={20} tone="turmeric" active />
                  <h2 id="use-soon-heading" className="text-tk-ink">
                    Giải cứu tủ lạnh · Nên dùng sớm
                  </h2>
                </div>
                <Link to="/fridge" className="kitchen-text-link !text-tk-jade font-bold">
                  Mở tủ lạnh <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>

              {inventoryQuery.isPending ? (
                <InlineLoading label="Đang tải nguyên liệu…" />
              ) : inventoryQuery.isError ? (
                <InlineError
                  error={inventoryQuery.error}
                  onRetry={() => void inventoryQuery.refetch()}
                />
              ) : !useSoon.length ? (
                <div className="rounded-2xl border border-tk-stone/75 bg-tk-sunken/65 p-4">
                  <p className="text-sm text-tk-secondary">
                    {inventory.length
                      ? 'Chưa có nguyên liệu được đánh dấu cần dùng sớm. Kiểm tra hạn dùng trong tủ lạnh hoặc nhờ AI gợi ý món nhanh từ tủ.'
                      : 'Tủ lạnh đang trống. Thêm nguyên liệu để tìm món phù hợp.'}
                  </p>
                  {!inventory.length && (
                    <Link to="/scan" className="kitchen-text-link mt-2 !text-tk-flame font-extrabold">
                      Quét nguyên liệu <ArrowRight size={17} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              ) : (
                <div className="home-stock-list">
                  {useSoon.map((item) => {
                    const expiry = presentExpiry(item);
                    const days = expiry.date === null ? null : daysUntil(expiry.date);
                    const catMeta = resolveCategoryIcon(item.category);
                    const CatIcon = catMeta.Icon;
                    const label =
                      expiry.tone === 'unknown' || days === null
                        ? 'Chưa rõ hạn dùng'
                        : expiry.tone === 'expired'
                          ? expiry.estimated
                            ? 'Ước tính đã quá hạn'
                            : 'Đã quá hạn'
                          : expiry.estimated
                            ? days <= 0
                              ? 'Ước tính hết hạn hôm nay'
                              : `Ước tính còn ${days} ngày`
                            : days <= 0
                              ? 'Hết hạn hôm nay'
                              : `Còn ${days} ngày`;
                    const progressPct =
                      days === null ? 50 : days <= 0 ? 100 : Math.max(25, 100 - days * 18);

                    return (
                      <Link
                        key={item.id}
                        to={`/ingredients/${item.id}`}
                        className="home-stock-item !rounded-2xl !border-tk-stone/85 hover:!border-tk-flame/40 transition-colors"
                      >
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tk-sunken/80 p-1.5">
                          <img
                            src={getIngredientImage(item.ingredientId, item.name)}
                            alt=""
                            width={40}
                            height={40}
                            loading="lazy"
                            className="h-full w-full object-contain"
                          />
                          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-tk-stone bg-white">
                            <CatIcon size={12} tone={catMeta.tone} active />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="truncate text-sm font-extrabold text-tk-ink">
                              {item.name}
                            </h3>
                            <span className="shrink-0 text-xs font-bold text-tk-secondary tk-tabular">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                          <p
                            className="mt-0.5 text-xs font-semibold text-tk-secondary"
                            data-testid="home-use-soon-expiry"
                            data-expiry-kind={
                              expiry.tone === 'unknown'
                                ? 'UNKNOWN'
                                : expiry.estimated
                                  ? 'ESTIMATED'
                                  : 'KNOWN'
                            }
                          >
                            {label}
                          </p>
                          <div
                            aria-hidden="true"
                            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-tk-sunken"
                          >
                            <span
                              className={clsx(
                                'block h-full rounded-full',
                                days !== null && days <= 1 ? 'bg-tk-flame' : 'bg-tk-turmeric',
                              )}
                              style={{ width: `${Math.min(100, Math.max(18, progressPct))}%` }}
                            />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Inline AI Sous-Chef Zero-Waste Rescue Trigger */}
              {inventory.length > 0 && (
                <div className="pt-1 space-y-3">
                  <button
                    type="button"
                    onClick={() => void handleRequestAiFridgeRescue()}
                    disabled={rescueLoading}
                    data-testid="ai-fridge-rescue-btn"
                    className="tap-target w-full flex items-center justify-center gap-2 rounded-2xl border border-tk-jade/25 bg-tk-jade-soft px-4 py-3 text-sm font-extrabold text-tk-jade-deep shadow-xs transition-colors hover:bg-tk-jade hover:text-white disabled:opacity-60 cursor-pointer"
                  >
                    <AiSousChefSparkIcon size={19} tone="jade" active />
                    <span>
                      {rescueLoading
                        ? 'AI Bếp Trưởng đang lên phương án 15 phút…'
                        : 'Nhờ AI Bếp Trưởng gợi ý giải cứu tủ lạnh'}
                    </span>
                  </button>

                  {rescueError && (
                    <p
                      role="status"
                      className="rounded-xl border border-tk-berry/25 bg-tk-berry-soft px-3.5 py-2.5 text-xs font-semibold text-tk-berry-deep"
                    >
                      {rescueError}
                    </p>
                  )}

                  {rescueBrief && (
                    <div
                      data-testid="ai-fridge-rescue-result"
                      className="rounded-[22px] border border-tk-jade/25 bg-gradient-to-br from-tk-jade-soft/70 via-white to-tk-turmeric-soft/40 p-4 sm:p-5 space-y-3.5 animate-fade-in"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          <p className="text-xs font-extrabold uppercase tracking-wider text-tk-jade">
                            Kế hoạch Zero-Waste 15 phút
                          </p>
                          <h3 className="text-base font-extrabold text-tk-ink">
                            {rescueBrief.headlineVi}
                          </h3>
                        </div>
                        {rescueBrief.estimatedWasteSavedVnd > 0 && (
                          <AtelierBadge
                            tone="turmeric"
                            icon={<BudgetCoinJarIcon size={14} tone="turmeric" active />}
                            className="tk-tabular"
                          >
                            Tiết kiệm ~{rescueBrief.estimatedWasteSavedVnd.toLocaleString('vi-VN')}đ
                          </AtelierBadge>
                        )}
                      </div>

                      <div className="rounded-2xl border border-tk-stone/80 bg-white p-3.5 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-extrabold text-tk-ink">
                            {rescueBrief.quickRescueDish.dishNameVi}
                          </p>
                          <span className="inline-flex items-center gap-1 rounded-full bg-tk-flame-soft px-2.5 py-0.5 text-xs font-extrabold text-tk-flame-deep tk-tabular">
                            <Clock size={12} aria-hidden="true" />
                            {rescueBrief.quickRescueDish.cookTimeMinutes} phút
                          </span>
                        </div>
                        <p className="text-xs text-tk-secondary">
                          {rescueBrief.priorityRescueCombo.rationaleVi}
                        </p>
                        <ol className="space-y-1.5 pl-4 list-decimal text-xs text-tk-ink font-medium">
                          {rescueBrief.quickRescueDish.stepsVi.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                        <p className="rounded-xl bg-tk-sunken/80 px-3 py-2 text-xs font-semibold text-tk-secondary">
                          Mẹo Bếp Trưởng: {rescueBrief.quickRescueDish.chefSecretVi}
                        </p>
                      </div>

                      {rescueBrief.storageExtensionTips.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {rescueBrief.storageExtensionTips.slice(0, 2).map((tip, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-tk-stone/80 bg-white px-3 py-1.5 text-xs text-tk-secondary"
                            >
                              <strong className="text-tk-ink">{tip.itemName}:</strong>{' '}
                              {tip.extensionTipVi} (+{tip.extraDaysGained} ngày)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </BentoCard>
          </div>

          {/* 4. CURATED DISH RECOMMENDATIONS GRID */}
          <section
            data-testid="t18c-home-recommendations"
            className="min-w-0 space-y-4"
            aria-labelledby="home-recipes-heading"
          >
            <div className="kitchen-section-heading">
              <h2 id="home-recipes-heading" className="text-tk-ink">
                Gợi ý món ngon cho bữa tới
              </h2>
              <Link to="/recipes" className="kitchen-text-link !text-tk-jade font-bold">
                Xem thêm <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>

            {recommendationsQuery.data?.source === 'device' && (
              <p role="status" className="text-sm text-tk-secondary">
                Gợi ý từ nguyên liệu và công thức lưu trên thiết bị.
              </p>
            )}

            {recommendationsQuery.isPending ? (
              <InlineLoading label="Đang tìm món phù hợp…" />
            ) : recommendationsQuery.isError ? (
              <InlineError
                error={recommendationsQuery.error}
                onRetry={() => void recommendationsQuery.refetch()}
              />
            ) : recommendations.length ? (
              <div className="space-y-4">
                {recommendations.map((match) => (
                  <RecipeCard
                    kitchen
                    variant="grid"
                    key={match.recipe.id}
                    matchResult={match}
                    headingLevel={3}
                    onClick={() =>
                      navigate(`/recipes/${match.recipe.slug}`, { state: { discoveryReturn: '/' } })
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="kitchen-neutral-panel !rounded-2xl !border-tk-stone/80">
                <p className="text-sm text-tk-secondary">Chưa có món phù hợp để gợi ý.</p>
                <Link to="/recipes" className="kitchen-text-link mt-2 !text-tk-jade font-bold">
                  Tìm trong công thức <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            )}

            <Link
              to="/recipes?noBuy=true"
              className="kitchen-discovery-link !rounded-2xl !bg-tk-jade-soft !text-tk-jade-deep border border-tk-jade/25 font-extrabold transition-colors hover:!bg-tk-jade hover:!text-white"
            >
              <span>Xem món nấu ngay không cần mua thêm</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
};
