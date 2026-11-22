import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';
import { daysUntil } from '../../lib/format';
import { presentExpiry } from '../../lib/inventory-truth';
import { calendarLabel } from '../../lib/home-plan';
import { useHomePlan } from '../../lib/use-home-plan';
import { isMealPlannerEnabled } from '../../features/planner/feature';
import { resolveRecipeImage } from '../../lib/recipe-media';
import { getIngredientImage } from '../../lib/ingredient-images';
import { ConsumerStudioShell } from '../components/Shells';
import {
  TkvBadge,
  TkvButton,
  TkvChip,
  TkvErrorState,
  TkvSkeleton,
  TkvSurface,
} from '../components/Primitives';
import { VNextIcon } from '../components/VNextIcons';
import {
  BrandFeatureIcon,
  MascotIllustration,
  VerifiedDishImage,
} from '../components/VNextMedia';
import { useVNextSeo } from '../lib/seo';

function slugifyDishTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const LEGACY_NAME_RE = /\bFri\w*\b/i;
function sanitizeUserDisplayName(raw: string | undefined | null, isGuest = false): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return isGuest ? 'Khách ghé thăm' : 'Bếp trưởng';
  if (LEGACY_NAME_RE.test(trimmed)) return 'Bếp trưởng';
  return raw as string;
}

const MEAL_LABELS = {
  breakfast: 'Bữa sáng',
  lunch: 'Bữa trưa',
  dinner: 'Bữa tối',
} as const;

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

type HomeFilterTab = 'for-you' | 'quick' | 'family' | 'saving';

const HOME_FILTER_CHIPS: ReadonlyArray<{ id: HomeFilterTab; label: string }> = [
  { id: 'for-you', label: 'Gợi ý cho bạn' },
  { id: 'quick', label: 'Nhanh gọn' },
  { id: 'family', label: 'Gia đình' },
  { id: 'saving', label: 'Tiết kiệm' },
];

/**
 * C01 — Hôm nay ăn gì? (Official Takolio Brand Board v2).
 * Matches `board.jpg` & `board-2.jpg` center phone mockup over 100% real API queries
 * (`useHomePlan`, `api.getInventory`, `api.getRecipeDiscovery`).
 */
export const C01HomePilot: React.FC = () => {
  const navigate = useNavigate();
  const { displayName, isGuest } = useAuthStore();
  const [now, setNow] = useState(() => new Date());
  const [activeMood, setActiveMood] = useState<HomeFilterTab>('for-you');

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

  const activeItems = (inventoryQuery.data ?? []).filter((item) => item.quantity > 0);

  useVNextSeo({
    title: 'Hôm nay ăn gì? — Takolio',
    description: 'Gợi ý thực đơn phù hợp với nguyên liệu trong tủ lạnh của bạn cùng Bé Mầm Bếp.',
    canonicalPath: '/',
    domainSurface: 'app',
    noindex: true,
  });

  const useSoonItems = activeItems
    .filter((item) => item.freshness === 'use_soon' || item.freshness === 'expiring')
    .sort(
      (a, b) =>
        (daysUntil(presentExpiry(a).date ?? undefined) ?? 99) -
        (daysUntil(presentExpiry(b).date ?? undefined) ?? 99),
    )
    .slice(0, 4);

  const rawRecommendations = recommendationsQuery.data?.items ?? [];
  const recommendations = rawRecommendations.filter(({ recipe, canCookWithoutBuying }) => {
    if (activeMood === 'quick') return recipe.cookTimeMinutes <= 30;
    if (activeMood === 'family') return recipe.servings >= 3;
    if (activeMood === 'saving') return canCookWithoutBuying;
    return true;
  });
  const displayedRecommendations =
    recommendations.length > 0 ? recommendations : rawRecommendations;

  const topRecommendation = rawRecommendations[0];
  const plannerBase = isMealPlannerEnabled() ? '/planner' : '/week';
  const sanitizedName = sanitizeUserDisplayName(displayName, isGuest);
  const greetingName = isGuest
    ? null
    : sanitizedName === 'Bếp trưởng'
      ? 'Bếp trưởng'
      : sanitizedName.trim().split(/\s+/).at(-1) || 'Bạn';
  const plan = home.plan;
  const meal = plan?.meal ?? null;
  const heroRecipe = meal?.recipe ?? topRecommendation?.recipe;
  const heroSlug = heroRecipe?.slug ?? (meal?.dishes[0] ? slugifyDishTitle(meal.dishes[0]) : '');

  return (
    <ConsumerStudioShell screenId="C01">
      <div className="space-y-6">
        {/* Top Brand Board Heading + Pro Crown Accent (`board.jpg` & `board-2.jpg` center screen) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <BrandFeatureIcon name="recipes" size={46} className="mt-0.5 hidden sm:inline-flex" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
                  Hôm nay ăn gì?
                </h1>
                <Link
                  to="/plus"
                  aria-label="Khám phá Takolio Pro"
                  className="tkv-focusable relative before:absolute before:-inset-y-2 before:-inset-x-1 inline-flex items-center gap-1 rounded-full bg-[var(--tkv-surface-saffron)] border border-[var(--tkv-border-saffron)] px-2.5 py-1 text-xs font-extrabold text-[var(--tkv-ink)]"
                >
                  <VNextIcon name="crown" size={14} className="text-[var(--tkv-warning)]" />
                  <span>Pro</span>
                </Link>
              </div>
              <p className="text-sm font-medium text-[var(--tkv-ink-secondary)] mt-0.5">
                {greetingName
                  ? `Chào ${greetingName} · Gợi ý thực đơn phù hợp với nguyên liệu của bạn`
                  : 'Gợi ý thực đơn phù hợp với nguyên liệu của bạn'}
              </p>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div aria-label="Lối tắt nhanh" className="flex flex-wrap items-center gap-2">
            <TkvChip active icon="scan" onClick={() => navigate('/scan')}>
              Quét AI
            </TkvChip>
            <TkvChip icon="plus" onClick={() => navigate('/fridge?action=add')}>
              Thêm đồ
            </TkvChip>
            <TkvChip icon="shopping" onClick={() => navigate('/shopping')}>
              Mua sắm
            </TkvChip>
          </div>
        </div>

        {/* Mood / Context Filter Pills (`Gợi ý cho bạn · Nhanh gọn · Gia đình · Tiết kiệm` from `board-2.jpg`) */}
        <div
          role="group"
          aria-label="Chế độ gợi ý món ăn"
          className="flex flex-wrap items-center gap-1.5 sm:gap-2"
        >
          {HOME_FILTER_CHIPS.map((chip) => {
            const active = activeMood === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveMood(chip.id)}
                className={clsx(
                  'tkv-focusable min-h-[44px] px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-colors border',
                  active
                    ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                    : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:bg-[var(--tkv-surface-mint)] hover:text-[var(--tkv-primary)]',
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Desktop 12-Col Workbench / Mobile 1-Col Stack */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Primary Column (7 cols on Desktop) */}
          <div data-testid="tkv-c01-primary" className="lg:col-span-7 space-y-6 min-w-0">
            {/* Hero Meal / Bé Mầm Bếp Card */}
            {!home.requiresAccount && home.query.isPending ? (
              <TkvSkeleton className="h-48" label="Đang tải bữa ăn tiếp theo…" />
            ) : !home.requiresAccount && home.query.isError ? (
              <TkvErrorState
                title="Chưa kiểm tra được lịch bữa ăn"
                message="Không thể tải thực đơn hiện tại. Bạn có thể thử tải lại hoặc xem gợi ý món bên dưới."
                onRetry={() => void home.retry()}
              />
            ) : (
              <div className="tkv-leaf-wave-band rounded-3xl bg-[var(--tkv-surface)] border border-[var(--tkv-border-mint)] p-4 sm:p-6 text-[var(--tkv-ink)] shadow-[var(--tkv-shadow-card)]">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-5">
                  {/* Mobile Hero Dish Photo (`board-2.jpg` center phone top dish card!) */}
                  <div className="sm:hidden">
                    {heroSlug ? (
                      <VerifiedDishImage
                        slug={heroSlug}
                        title={meal?.dishes[0] ?? heroRecipe?.title ?? 'Món gợi ý'}
                        canonicalFallbackSrc={heroRecipe ? resolveRecipeImage(heroRecipe) : undefined}
                        aspectClass="aspect-[16/9]"
                        priority
                        className="w-full rounded-2xl border border-[var(--tkv-border)] shadow-xs"
                      />
                    ) : (
                      <div className="flex justify-center py-2">
                        <MascotIllustration pose="welcome" size={96} priority className="w-24 h-24" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5 flex-1 min-w-0">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-2xl sm:rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-xs font-extrabold leading-snug text-[var(--tkv-primary)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary)] shrink-0" aria-hidden="true" />
                      <span>
                        {meal && plan
                          ? `${MEAL_LABELS[meal.mealType]} · ${calendarLabel(meal.date, plan.today)}`
                          : 'Bữa ngon, nhẹ đầu · Ăn đủ. Mua đủ. Dùng hết.'}
                      </span>
                    </span>

                    <h2 className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink)]">
                      {home.requiresAccount
                        ? 'Gợi ý món từ tủ lạnh của bạn'
                        : meal?.state === 'ready' && meal.dishes.length > 0
                          ? meal.dishes[0]
                          : topRecommendation
                            ? topRecommendation.recipe.title
                            : 'Bắt đầu bữa ngon từ nguyên liệu sẵn có'}
                    </h2>

                    <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed tabular-nums">
                      {home.requiresAccount
                        ? 'Bé Mầm Bếp đối chiếu nguyên liệu thực tế trong tủ lạnh để gợi ý món ngon sát khẩu phần gia đình.'
                        : meal?.state === 'ready'
                          ? `Khẩu phần ${meal.servings} người${meal.cookTimeMinutes ? ` · ${meal.cookTimeMinutes} phút chuẩn bị` : ''}.`
                          : topRecommendation
                            ? `${topRecommendation.recipe.cookTimeMinutes} phút · Khớp tình trạng tủ lạnh hiện tại của hộ.`
                            : 'Thêm nguyên liệu vào tủ hoặc mở kho công thức để chọn bữa tối nay.'}
                    </p>

                    <div className="pt-1 flex flex-wrap gap-2.5">
                      <Link
                        to={
                          meal?.href
                            ? `${meal.href}`
                            : topRecommendation
                              ? `/recipes/${topRecommendation.recipe.slug || topRecommendation.recipe.id}`
                              : `/recipes`
                        }
                        className="tkv-focusable min-h-[46px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white shadow-xs font-extrabold text-sm inline-flex items-center gap-2 transition-colors"
                      >
                        <span>{meal ? 'Xem bữa ăn' : 'Xem món gợi ý'}</span>
                        <VNextIcon name="arrow-right" size={16} />
                      </Link>
                      {home.requiresAccount && (
                        <Link
                          to={`/auth?mode=login&returnTo=${encodeURIComponent(plannerBase)}`}
                          className="tkv-focusable min-h-[46px] px-4 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] text-[var(--tkv-ink)] hover:opacity-95 font-extrabold text-sm inline-flex items-center transition-colors"
                        >
                          Đăng nhập lập tuần
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center justify-center sm:w-36 shrink-0">
                    {heroSlug ? (
                      <VerifiedDishImage
                        slug={heroSlug}
                        title={meal?.dishes[0] ?? heroRecipe?.title ?? 'Món gợi ý'}
                        canonicalFallbackSrc={heroRecipe ? resolveRecipeImage(heroRecipe) : undefined}
                        aspectClass="aspect-square"
                        priority
                        className="w-36 h-36 rounded-2xl border border-[var(--tkv-border)] shadow-xs"
                      />
                    ) : (
                      <MascotIllustration pose="welcome" size={128} priority className="w-32 h-32" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Large Visual Dish Recommendation Cards (matching `board-2.jpg` center phone cards!) */}
            <section aria-labelledby="c01-recs-heading" className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h2 id="c01-recs-heading" className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                  Món gợi ý cho bữa tới
                </h2>
                <Link
                  to="/recipes"
                  className="tkv-focusable min-h-[44px] inline-flex items-center shrink-0 whitespace-nowrap text-sm font-extrabold text-[var(--tkv-primary)] hover:underline"
                >
                  Xem tất cả món
                </Link>
              </div>

              {recommendationsQuery.isPending ? (
                <TkvSkeleton className="h-52" label="Đang tải món gợi ý…" />
              ) : recommendationsQuery.isError ? (
                <TkvErrorState
                  message="Chưa tải được danh sách gợi ý món ăn."
                  onRetry={() => void recommendationsQuery.refetch()}
                />
              ) : displayedRecommendations.length === 0 ? (
                <TkvSurface className="p-5 flex items-center gap-4 bg-[var(--tkv-surface)]">
                  <MascotIllustration pose="cooking" size={76} className="w-20 h-20 shrink-0" />
                  <div className="space-y-1.5">
                    <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                      Sẵn sàng chọn món ngon hôm nay
                    </p>
                    <p className="text-sm text-[var(--tkv-ink-secondary)]">
                      Thêm nguyên liệu vào tủ lạnh để nhận điểm khớp định lượng hoặc duyệt toàn bộ kho món Việt.
                    </p>
                  </div>
                </TkvSurface>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {displayedRecommendations.map(
                    ({ recipe, canCookWithoutBuying, missingRequiredIngredientCount }) => (
                      <Link
                        key={recipe.id}
                        to={`/recipes/${recipe.slug || recipe.id}`}
                        className="tkv-focusable tkv-bento-card overflow-hidden flex flex-col justify-between"
                      >
                        <div>
                          <VerifiedDishImage
                            slug={recipe.slug}
                            title={recipe.title}
                            canonicalFallbackSrc={resolveRecipeImage(recipe)}
                            aspectClass="aspect-[16/10]"
                          />
                          <div className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)] line-clamp-2 leading-snug">
                                {recipe.title}
                              </h3>
                              <span
                                aria-hidden="true"
                                className="inline-flex w-7 h-7 rounded-full bg-[var(--tkv-surface-coral)] text-[var(--tkv-coral)] items-center justify-center shrink-0"
                              >
                                <VNextIcon name="bookmark" size={14} />
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap text-xs font-semibold text-[var(--tkv-ink-secondary)] tabular-nums">
                              <span className="inline-flex items-center gap-1">
                                <VNextIcon name="timer" size={13} className="text-[var(--tkv-primary)]" />
                                {recipe.cookTimeMinutes} phút
                              </span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1">
                                <VNextIcon name="users" size={13} className="text-[var(--tkv-primary)]" />
                                {recipe.servings} người
                              </span>
                              <span>·</span>
                              <span className="px-2 py-0.5 rounded-full bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] font-bold">
                                Dễ làm
                              </span>
                            </div>

                            <div className="pt-1">
                              <TkvBadge
                                tone={canCookWithoutBuying ? 'success' : 'coral'}
                                icon={canCookWithoutBuying ? 'check' : 'shopping'}
                              >
                                <span className="tabular-nums">
                                  {canCookWithoutBuying
                                    ? 'Đủ nguyên liệu sẵn có'
                                    : `Cần thêm ${missingRequiredIngredientCount} nguyên liệu`}
                                </span>
                              </TkvBadge>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ),
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Right Workbench Column (5 cols on Desktop — FEFO Stock + Core Journey Cards) */}
          <div className="lg:col-span-5 space-y-6 min-w-0">
            <section aria-labelledby="c01-use-soon-heading" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h2 id="c01-use-soon-heading" className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                  Nguyên liệu ưu tiên dùng sớm
                </h2>
                <Link
                  to="/fridge"
                  className="tkv-focusable min-h-[44px] inline-flex items-center shrink-0 whitespace-nowrap text-xs font-extrabold text-[var(--tkv-primary)] hover:underline"
                >
                  Mở tủ lạnh
                </Link>
              </div>

              {inventoryQuery.isPending ? (
                <TkvSkeleton className="h-32" label="Đang tải danh sách tồn kho…" />
              ) : inventoryQuery.isError ? (
                <TkvErrorState
                  message="Chưa đọc được dữ liệu tủ lạnh từ máy chủ."
                  onRetry={() => void inventoryQuery.refetch()}
                />
              ) : useSoonItems.length === 0 ? (
                <TkvSurface className="p-4 text-sm text-[var(--tkv-ink-secondary)] bg-[var(--tkv-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <MascotIllustration pose="fridge" size={56} decorative className="w-14 h-14 shrink-0" />
                    <span className="min-w-0">
                      {activeItems.length === 0
                        ? 'Chưa có nguyên liệu nào trong tủ lạnh.'
                        : `Tủ đang có ${activeItems.length} nguyên liệu tươi ngon ổn định.`}
                    </span>
                  </div>
                  <TkvButton size="sm" variant="secondary" className="w-full sm:w-auto shrink-0" onClick={() => navigate('/fridge')}>
                    {activeItems.length === 0 ? 'Thêm ngay' : 'Xem tủ'}
                  </TkvButton>
                </TkvSurface>
              ) : (
                <TkvSurface padded={false} className="divide-y divide-[var(--tkv-border)] bg-[var(--tkv-surface)]">
                  {useSoonItems.map((item) => {
                    const exp = presentExpiry(item);
                    const remDays = daysUntil(exp.date ?? undefined);
                    const thumbSrc = getIngredientImage(item.ingredientId, item.name);
                    return (
                      <Link
                        key={item.id}
                        to={`/fridge/${item.id}`}
                        className="tkv-focusable min-h-[60px] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 hover:bg-[var(--tkv-bg)] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {thumbSrc && !thumbSrc.includes('placeholder') ? (
                            <img
                              src={thumbSrc}
                              alt=""
                              width={36}
                              height={36}
                              loading="lazy"
                              className="w-9 h-9 rounded-xl bg-[var(--tkv-bg)] p-1 object-contain shrink-0"
                            />
                          ) : (
                            <BrandFeatureIcon name="fridge" size={36} />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-extrabold text-[var(--tkv-ink)] line-clamp-2 leading-snug">
                              {item.name}
                            </p>
                            <p className="text-xs text-[var(--tkv-ink-secondary)] tabular-nums mt-0.5">
                              {item.quantity} {UNIT_LABELS_VI[item.unit] ?? item.unit}
                            </p>
                          </div>
                        </div>
                        <span className="self-start sm:self-center inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] text-xs font-extrabold text-[var(--tkv-coral-ink)] tabular-nums shrink-0">
                          <span>
                            {exp.estimated
                              ? remDays !== null
                                ? `Ước tính còn ${remDays} ngày`
                                : 'Hạn dùng ước tính'
                              : remDays !== null
                                ? `Còn ${remDays} ngày`
                                : 'Nên dùng sớm'}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </TkvSurface>
              )}
            </section>

            {/* Core Kitchen Action Stack with AI-Rendered BrandFeatureIcons */}
            <section aria-labelledby="c01-for-you-heading" className="space-y-3">
              <h2 id="c01-for-you-heading" className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                Trợ lý bếp cùng bạn hôm nay
              </h2>

              <div className="space-y-3">
                <Link
                  to="/scan"
                  className="tkv-focusable tkv-bento-card p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <BrandFeatureIcon name="scan" size={44} className="mt-0.5" />
                    <div className="min-w-0 space-y-1">
                      <p className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)]">
                        Quét & thêm nguyên liệu bằng AI
                      </p>
                      <p className="text-xs text-[var(--tkv-ink-secondary)] leading-relaxed text-pretty">
                        Chụp ngăn mát hoặc hóa đơn đi chợ, luôn kiểm duyệt trước khi lưu
                      </p>
                    </div>
                  </div>
                  <VNextIcon name="chevron-right" size={18} className="text-[var(--tkv-ink-muted)] shrink-0" />
                </Link>

                <Link
                  to={`${plannerBase}`}
                  className="tkv-focusable tkv-bento-card p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <BrandFeatureIcon name="planner" size={44} className="mt-0.5" />
                    <div className="min-w-0 space-y-1">
                      <p className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)]">
                        {plan ? 'Thực đơn 7 ngày đang mở' : 'Lên thực đơn 7 ngày'}
                      </p>
                      <p className="text-xs text-[var(--tkv-ink-secondary)] leading-relaxed text-pretty">
                        {home.requiresAccount
                          ? 'Đăng nhập để đồng bộ lịch bữa ăn tuần của hộ gia đình'
                          : 'Cân bằng dinh dưỡng cho cả gia đình, linh hoạt đổi món 1 chạm'}
                      </p>
                    </div>
                  </div>
                  <VNextIcon name="chevron-right" size={18} className="text-[var(--tkv-ink-muted)] shrink-0" />
                </Link>

                <Link
                  to="/shopping"
                  className="tkv-focusable tkv-bento-card p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <BrandFeatureIcon name="shopping" size={44} className="mt-0.5" />
                    <div className="min-w-0 space-y-1">
                      <p className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)]">
                        Danh sách mua sắm thông minh
                      </p>
                      <p className="text-xs text-[var(--tkv-ink-secondary)] leading-relaxed text-pretty">
                        Tự động trừ nguyên liệu sẵn có trong tủ lạnh để mua vừa đủ
                      </p>
                    </div>
                  </div>
                  <VNextIcon name="chevron-right" size={18} className="text-[var(--tkv-ink-muted)] shrink-0" />
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </ConsumerStudioShell>
  );
};
