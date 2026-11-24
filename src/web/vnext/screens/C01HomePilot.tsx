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
import { HomeDashboardSkeleton } from '../components/Skeletons';
import { prefetchRouteChunk } from '../lib/prefetch';
import { useVNextSeo } from '../lib/seo';
import {
  formatLocalizedMeasure,
  localizeIngredientName,
  localizeMealSlot,
  localizeRecipeTitle,
  useLocaleText,
} from '../../i18n/app-i18n';

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
function sanitizeUserDisplayName(
  raw: string | undefined | null,
  isGuest: boolean,
  l: (vi: string, en: string) => string,
): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return isGuest ? l('Khách ghé thăm', 'Guest') : l('Bếp trưởng', 'Chef');
  if (LEGACY_NAME_RE.test(trimmed) || trimmed === 'Bếp trưởng') return l('Bếp trưởng', 'Chef');
  if (trimmed === 'Khách ghé thăm') return l('Khách ghé thăm', 'Guest');
  return raw as string;
}

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

const HOME_FILTER_CHIPS: ReadonlyArray<{ id: HomeFilterTab; vi: string; en: string }> = [
  { id: 'for-you', vi: 'Gợi ý cho bạn', en: 'For you' },
  { id: 'quick', vi: 'Nhanh gọn', en: 'Quick' },
  { id: 'family', vi: 'Gia đình', en: 'Family' },
  { id: 'saving', vi: 'Tiết kiệm', en: 'Budget-friendly' },
];

/**
 * C01 — Hôm nay ăn gì? (Official Takolio Brand Board v2).
 * Matches `board.jpg` & `board-2.jpg` center phone mockup over 100% real API queries
 * (`useHomePlan`, `api.getInventory`, `api.getRecipeDiscovery`).
 */
export const C01HomePilot: React.FC = () => {
  const { l, locale, unitSystem } = useLocaleText();
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
    title: l('Hôm nay ăn gì? — Takolio', 'What to cook today? — Takolio'),
    description: l(
      'Gợi ý thực đơn phù hợp với nguyên liệu trong tủ lạnh của bạn cùng Bé Mầm Bếp.',
      'Smart meal ideas matched to what is in your fridge with Takolio.',
    ),
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
  const sanitizedName = sanitizeUserDisplayName(displayName, isGuest, l);
  const defaultChefName = l('Bếp trưởng', 'Chef');
  const greetingName = isGuest
    ? null
    : sanitizedName === defaultChefName
      ? defaultChefName
      : sanitizedName.trim().split(/\s+/).at(-1) || l('Bạn', 'there');
  const plan = home.plan;
  const meal = plan?.meal ?? null;
  const heroRecipe = meal?.recipe ?? topRecommendation?.recipe;
  const heroSlug = heroRecipe?.slug ?? (meal?.dishes[0] ? slugifyDishTitle(meal.dishes[0]) : '');
  const heroDishTitle = meal?.dishes[0]
    ? localizeRecipeTitle(meal.recipe ?? { title: meal.dishes[0] }, locale)
    : heroRecipe
      ? localizeRecipeTitle(heroRecipe, locale)
      : l('Món gợi ý', 'Suggested dish');

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
                  {l('Hôm nay ăn gì?', 'What to cook today?')}
                </h1>
                <Link
                  to="/plus"
                  aria-label={l('Khám phá Takolio Pro', 'Explore Takolio Pro')}
                  className="tkv-focusable relative before:absolute before:-inset-y-2 before:-inset-x-1 inline-flex items-center gap-1 rounded-full bg-[var(--tkv-surface-saffron)] border border-[var(--tkv-border-saffron)] px-2.5 py-1 text-xs font-extrabold text-[var(--tkv-ink)]"
                >
                  <VNextIcon name="crown" size={14} className="text-[var(--tkv-warning)]" />
                  <span>Pro</span>
                </Link>
              </div>
              <p className="text-sm font-medium text-[var(--tkv-ink-secondary)] mt-0.5">
                {greetingName
                  ? l(
                      `Chào ${greetingName} · Gợi ý thực đơn phù hợp với nguyên liệu của bạn`,
                      `Hi ${greetingName} · Meal ideas matched to your ingredients`,
                    )
                  : l(
                      'Gợi ý thực đơn phù hợp với nguyên liệu của bạn',
                      'Meal ideas matched to your ingredients',
                    )}
              </p>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div aria-label={l('Lối tắt nhanh', 'Quick shortcuts')} className="flex flex-wrap items-center gap-2">
            <TkvChip active icon="scan" onClick={() => navigate('/scan')}>
              {l('Quét AI', 'AI Scan')}
            </TkvChip>
            <TkvChip icon="plus" onClick={() => navigate('/fridge?action=add')}>
              {l('Thêm đồ', 'Add item')}
            </TkvChip>
            <TkvChip icon="shopping" onClick={() => navigate('/shopping')}>
              {l('Mua sắm', 'Shopping')}
            </TkvChip>
          </div>
        </div>

        {/* Mood / Context Filter Pills (`Gợi ý cho bạn · Nhanh gọn · Gia đình · Tiết kiệm` from `board-2.jpg`) */}
        <div
          role="group"
          aria-label={l('Chế độ gợi ý món ăn', 'Meal recommendation mode')}
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
                  'tkv-focusable tkv-tactile min-h-[44px] px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap active:scale-95 border',
                  active
                    ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-[var(--tkv-shadow-cta)]'
                    : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:bg-[var(--tkv-surface-mint)] hover:text-[var(--tkv-primary)]',
                )}
              >
                {l(chip.vi, chip.en)}
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
              <TkvSkeleton className="h-48" label={l('Đang tải bữa ăn tiếp theo…', 'Loading next meal…')} />
            ) : !home.requiresAccount && home.query.isError ? (
              <TkvErrorState
                title={l('Chưa kiểm tra được lịch bữa ăn', 'Could not check your meal schedule')}
                message={l(
                  'Không thể tải thực đơn hiện tại. Bạn có thể thử tải lại hoặc xem gợi ý món bên dưới.',
                  'Unable to load your current meal plan. Try reloading or browse suggestions below.',
                )}
                onRetry={() => void home.retry()}
              />
            ) : (
              <div className="tkv-hero-living rounded-3xl p-4 sm:p-6 text-[var(--tkv-ink)] tkv-enter-fade-up">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-5">
                  {/* Mobile Hero Dish Photo (`board-2.jpg` center phone top dish card!) */}
                  <div className="sm:hidden">
                    {heroSlug ? (
                      <VerifiedDishImage
                        slug={heroSlug}
                        title={heroDishTitle}
                        canonicalFallbackSrc={heroRecipe ? resolveRecipeImage(heroRecipe) : undefined}
                        aspectClass="aspect-[16/9]"
                        priority
                        className="w-full rounded-2xl border border-[var(--tkv-border)] shadow-xs"
                      />
                    ) : (
                      <div className="flex justify-center py-2">
                        <MascotIllustration pose="welcome" size={96} priority motion="idle" className="w-24 h-24" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5 flex-1 min-w-0">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-2xl sm:rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-xs font-extrabold leading-snug text-[var(--tkv-primary)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary)] shrink-0" aria-hidden="true" />
                      <span>
                        {meal && plan
                          ? `${localizeMealSlot(meal.mealType, locale)} · ${calendarLabel(meal.date, plan.today)}`
                          : l(
                              'Bữa ngon, nhẹ đầu · Ăn đủ. Mua đủ. Dùng hết.',
                              'Calm cooking · Eat well. Buy right. Waste less.',
                            )}
                      </span>
                    </span>

                    <h2 className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink)]">
                      {home.requiresAccount
                        ? l('Gợi ý món từ tủ lạnh của bạn', 'Meal ideas from your fridge')
                        : meal?.state === 'ready' && meal.dishes.length > 0
                          ? localizeRecipeTitle(meal.recipe ?? { title: meal.dishes[0] }, locale)
                          : topRecommendation
                            ? localizeRecipeTitle(topRecommendation.recipe, locale)
                            : l(
                                'Bắt đầu bữa ngon từ nguyên liệu sẵn có',
                                'Start cooking with what you have',
                              )}
                    </h2>

                    <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed tabular-nums">
                      {home.requiresAccount
                        ? l(
                            'Bé Mầm Bếp đối chiếu nguyên liệu thực tế trong tủ lạnh để gợi ý món ngon sát khẩu phần gia đình.',
                            'Takolio matches what is actually in your fridge to suggest recipes tailored to your household portions.',
                          )
                        : meal?.state === 'ready'
                          ? l(
                              `Khẩu phần ${meal.servings} người${meal.cookTimeMinutes ? ` · ${meal.cookTimeMinutes} phút chuẩn bị` : ''}.`,
                              `Serves ${meal.servings}${meal.cookTimeMinutes ? ` · ${meal.cookTimeMinutes} min prep` : ''}.`,
                            )
                          : topRecommendation
                            ? l(
                                `${topRecommendation.recipe.cookTimeMinutes} phút · Khớp tình trạng tủ lạnh hiện tại của hộ.`,
                                `${topRecommendation.recipe.cookTimeMinutes} min · Matched to your current fridge stock.`,
                              )
                            : l(
                                'Thêm nguyên liệu vào tủ hoặc mở kho công thức để chọn bữa tối nay.',
                                'Add ingredients to your fridge or browse recipes to pick dinner tonight.',
                              )}
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
                        <span>{meal ? l('Xem bữa ăn', 'View meal') : l('Xem món gợi ý', 'View suggestion')}</span>
                        <VNextIcon name="arrow-right" size={16} />
                      </Link>
                      {home.requiresAccount && (
                        <Link
                          to={`/auth?mode=login&returnTo=${encodeURIComponent(plannerBase)}`}
                          className="tkv-focusable min-h-[46px] px-4 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] text-[var(--tkv-ink)] hover:opacity-95 font-extrabold text-sm inline-flex items-center transition-colors"
                        >
                          {l('Đăng nhập lập tuần', 'Sign in to plan week')}
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center justify-center sm:w-36 shrink-0">
                    {heroSlug ? (
                      <VerifiedDishImage
                        slug={heroSlug}
                        title={heroDishTitle}
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
                  {l('Món gợi ý cho bữa tới', 'Suggested for your next meal')}
                </h2>
                <Link
                  to="/recipes"
                  className="tkv-focusable min-h-[44px] inline-flex items-center shrink-0 whitespace-nowrap text-sm font-extrabold text-[var(--tkv-primary)] hover:underline"
                >
                  {l('Xem tất cả món', 'View all recipes')}
                </Link>
              </div>

              {recommendationsQuery.isPending ? (
                <HomeDashboardSkeleton label={l('Đang tải món gợi ý…', 'Loading meal suggestions…')} />
              ) : recommendationsQuery.isError ? (
                <TkvErrorState
                  message={l('Chưa tải được danh sách gợi ý món ăn.', 'Could not load recipe suggestions.')}
                  onRetry={() => void recommendationsQuery.refetch()}
                />
              ) : displayedRecommendations.length === 0 ? (
                <TkvSurface className="p-5 flex items-center gap-4 bg-[var(--tkv-surface)] tkv-enter-fade-up">
                  <MascotIllustration pose="cooking" size={76} motion="idle" className="w-20 h-20 shrink-0" />
                  <div className="flex flex-col gap-1.5">
                    <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                      {l('Sẵn sàng chọn món ngon hôm nay', 'Ready to pick something delicious today')}
                    </p>
                    <p className="text-sm text-[var(--tkv-ink-secondary)]">
                      {l(
                        'Thêm nguyên liệu vào tủ lạnh để nhận điểm khớp định lượng hoặc duyệt toàn bộ kho món Việt.',
                        'Add ingredients to your fridge for exact match scores, or browse the full recipe catalog.',
                      )}
                    </p>
                  </div>
                </TkvSurface>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {displayedRecommendations.map(
                    ({ recipe, canCookWithoutBuying, missingRequiredIngredientCount }, idx) => {
                      const localizedTitle = localizeRecipeTitle(recipe, locale);
                      return (
                        <Link
                          key={recipe.id}
                          to={`/recipes/${recipe.slug || recipe.id}`}
                          onPointerEnter={() => prefetchRouteChunk(`/recipes/${recipe.slug || recipe.id}`)}
                          onFocus={() => prefetchRouteChunk(`/recipes/${recipe.slug || recipe.id}`)}
                          style={{ '--tkv-i': idx } as React.CSSProperties}
                          className="group tkv-focusable tkv-bento-card tkv-bento-interactive tkv-stagger overflow-hidden flex flex-col justify-between"
                        >
                          <div>
                            <VerifiedDishImage
                              slug={recipe.slug}
                              title={localizedTitle}
                              canonicalFallbackSrc={resolveRecipeImage(recipe)}
                              aspectClass="aspect-[16/10]"
                            />
                            <div className="p-4 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)] line-clamp-2 leading-snug">
                                  {localizedTitle}
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
                                  {l(`${recipe.cookTimeMinutes} phút`, `${recipe.cookTimeMinutes} min`)}
                                </span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1">
                                  <VNextIcon name="users" size={13} className="text-[var(--tkv-primary)]" />
                                  {l(`${recipe.servings} người`, `${recipe.servings} servings`)}
                                </span>
                                <span>·</span>
                                <span className="px-2 py-0.5 rounded-full bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] font-bold">
                                  {l('Dễ làm', 'Easy')}
                                </span>
                              </div>

                              <div className="pt-1">
                                <TkvBadge
                                  tone={canCookWithoutBuying ? 'success' : 'coral'}
                                  icon={canCookWithoutBuying ? 'check' : 'shopping'}
                                >
                                  <span className="tabular-nums">
                                    {canCookWithoutBuying
                                      ? l('Đủ nguyên liệu sẵn có', 'All ingredients on hand')
                                      : l(
                                          `Cần thêm ${missingRequiredIngredientCount} nguyên liệu`,
                                          `Missing ${missingRequiredIngredientCount} ${missingRequiredIngredientCount === 1 ? 'ingredient' : 'ingredients'}`,
                                        )}
                                  </span>
                                </TkvBadge>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    },
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
                  {l('Nguyên liệu ưu tiên dùng sớm', 'Use soon')}
                </h2>
                <Link
                  to="/fridge"
                  className="tkv-focusable min-h-[44px] inline-flex items-center shrink-0 whitespace-nowrap text-xs font-extrabold text-[var(--tkv-primary)] hover:underline"
                >
                  {l('Mở tủ lạnh', 'Open fridge')}
                </Link>
              </div>

              {inventoryQuery.isPending ? (
                <TkvSkeleton className="h-32" label={l('Đang tải danh sách tồn kho…', 'Loading inventory…')} />
              ) : inventoryQuery.isError ? (
                <TkvErrorState
                  message={l(
                    'Chưa đọc được dữ liệu tủ lạnh từ máy chủ.',
                    'Could not load fridge inventory from the server.',
                  )}
                  onRetry={() => void inventoryQuery.refetch()}
                />
              ) : useSoonItems.length === 0 ? (
                <TkvSurface className="p-4 text-sm text-[var(--tkv-ink-secondary)] bg-[var(--tkv-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <MascotIllustration pose="fridge" size={56} motion="idle" decorative className="w-14 h-14 shrink-0" />
                    <span className="min-w-0">
                      {activeItems.length === 0
                        ? l('Chưa có nguyên liệu nào trong tủ lạnh.', 'No ingredients in your fridge yet.')
                        : l(
                            `Tủ đang có ${activeItems.length} nguyên liệu tươi ngon ổn định.`,
                            `Your fridge has ${activeItems.length} fresh ${activeItems.length === 1 ? 'item' : 'items'} in good shape.`,
                          )}
                    </span>
                  </div>
                  <TkvButton size="sm" variant="secondary" className="w-full sm:w-auto shrink-0" onClick={() => navigate('/fridge')}>
                    {activeItems.length === 0 ? l('Thêm ngay', 'Add now') : l('Xem tủ', 'View fridge')}
                  </TkvButton>
                </TkvSurface>
              ) : (
                <TkvSurface padded={false} className="divide-y divide-[var(--tkv-border)] bg-[var(--tkv-surface)]">
                  {useSoonItems.map((item) => {
                    const exp = presentExpiry(item);
                    const remDays = daysUntil(exp.date ?? undefined);
                    const thumbSrc = getIngredientImage(item.ingredientId, item.name);
                    const localizedName = localizeIngredientName(item.ingredientId, item.name, locale);
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
                              {localizedName}
                            </p>
                            <p className="text-xs text-[var(--tkv-ink-secondary)] tabular-nums mt-0.5">
                              {locale === 'vi'
                                ? `${item.quantity} ${UNIT_LABELS_VI[item.unit] ?? item.unit}`
                                : formatLocalizedMeasure(item.quantity, item.unit, locale, unitSystem)}
                            </p>
                          </div>
                        </div>
                        <span className="self-start sm:self-center inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] text-xs font-extrabold text-[var(--tkv-coral-ink)] tabular-nums shrink-0">
                          <span>
                            {exp.estimated
                              ? remDays !== null
                                ? l(`Ước tính còn ${remDays} ngày`, `Est. ${remDays}d left`)
                                : l('Hạn dùng ước tính', 'Estimated expiry')
                              : remDays !== null
                                ? l(`Còn ${remDays} ngày`, `${remDays}d left`)
                                : l('Nên dùng sớm', 'Use soon')}
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
                {l('Trợ lý bếp cùng bạn hôm nay', 'Your kitchen shortcuts today')}
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
                        {l('Quét & thêm nguyên liệu bằng AI', 'Scan & add ingredients with AI')}
                      </p>
                      <p className="text-xs text-[var(--tkv-ink-secondary)] leading-relaxed text-pretty">
                        {l(
                          'Chụp ngăn mát hoặc hóa đơn đi chợ, luôn kiểm duyệt trước khi lưu',
                          'Snap your fridge or grocery receipt — always review before saving',
                        )}
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
                        {plan
                          ? l('Thực đơn 7 ngày đang mở', 'Active 7-day meal plan')
                          : l('Lên thực đơn 7 ngày', 'Build a 7-day meal plan')}
                      </p>
                      <p className="text-xs text-[var(--tkv-ink-secondary)] leading-relaxed text-pretty">
                        {home.requiresAccount
                          ? l(
                              'Đăng nhập để đồng bộ lịch bữa ăn tuần của hộ gia đình',
                              'Sign in to sync your household weekly meal schedule',
                            )
                          : l(
                              'Cân bằng dinh dưỡng cho cả gia đình, linh hoạt đổi món 1 chạm',
                              'Balanced meals for the household with one-tap dish swaps',
                            )}
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
                        {l('Danh sách mua sắm thông minh', 'Smart shopping list')}
                      </p>
                      <p className="text-xs text-[var(--tkv-ink-secondary)] leading-relaxed text-pretty">
                        {l(
                          'Tự động trừ nguyên liệu sẵn có trong tủ lạnh để mua vừa đủ',
                          'Automatically deducts fridge stock so you buy only what you need',
                        )}
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
