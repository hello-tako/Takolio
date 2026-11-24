import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import type { PlannedMealDto } from '../../../../packages/domain/src/meal-planning-api';
import { useAuthStore } from '../../stores/useAuthStore';
import { usePlanner } from '../../features/planner/usePlanner';
import { plannerStatusLabel } from '../../features/planner/presentation';
import { ConsumerStudioShell } from '../components/Shells';
import {
  TkvButton,
  TkvEmptyState,
  TkvErrorState,
  TkvSurface,
} from '../components/Primitives';
import { VNextIcon } from '../components/VNextIcons';
import {
  BrandFeatureIcon,
  MascotIllustration,
  VerifiedDishImage,
} from '../components/VNextMedia';
import { WeeklyPlannerSkeleton } from '../components/Skeletons';
import { useVNextSeo } from '../lib/seo';
import type { SupportedLocale } from '../../../shared/locales';
import {
  lSync,
  localizeMealSlot,
  localizeRecipeTitle,
  useLocaleText,
} from '../../i18n/app-i18n';

const LEGACY_NAME_RE = /\bFri\w*\b/i;
function sanitizeUserDisplayName(
  raw: string | undefined | null,
  isGuest = false,
  locale?: SupportedLocale,
): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return isGuest
      ? lSync('Khách ghé thăm', 'Guest', locale)
      : lSync('Bếp trưởng', 'Home Chef', locale);
  }
  if (LEGACY_NAME_RE.test(trimmed)) return lSync('Bếp trưởng', 'Home Chef', locale);
  return raw as string;
}

function formatDayHeading(isoDate: string, locale: SupportedLocale): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  if (locale === 'vi') {
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      timeZone: 'UTC',
    }).format(parsed);
  }
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function slugifyDishTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolvePlannedMealSlug(meal: PlannedMealDto): string {
  if (meal.source.kind === 'recipe' && !meal.source.id.startsWith('rec_')) {
    return meal.source.id;
  }
  return slugifyDishTitle(meal.title);
}

/**
 * C23 — Thực đơn 7 ngày (Official Takolio Brand Board v2).
 * Matches `board.jpg` & `board-2.jpg` right phone mockup (`T2..CN` pill selector,
 * day meal preview cards, full-width Leaf Green CTA, `+ Tạo thực đơn mới`, and
 * Coral `Danh sách mua sắm` row) while preserving 100% of `usePlanner` server truth.
 */
export const C23PlannerPilot: React.FC = () => {
  const { planId } = useParams<{ planId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { l, locale: appLocale, copy: appCopy } = useLocaleText();
  const isGuest = useAuthStore((s) => s.isGuest);
  const displayName = useAuthStore((s) => s.displayName);
  const cleanName = sanitizeUserDisplayName(displayName, isGuest, appLocale);
  const returnTo = `${location.pathname}${location.search}`;
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  useVNextSeo({
    title: l('Thực đơn 7 ngày — Takolio', '7-Day Meal Plan — Takolio'),
    description: l(
      'Cân bằng dinh dưỡng cho cả gia đình và tự động tạo danh sách mua sắm thông minh.',
      'Balanced family nutrition all week with an automatic smart shopping list.',
    ),
    canonicalPath: '/planner',
    domainSurface: 'app',
    noindex: true,
  });

  const model = usePlanner(planId, !isGuest);
  const plan = model.plan;

  const mealsByDate = new Map<string, PlannedMealDto[]>();
  if (plan) {
    for (const meal of plan.result.meals) {
      const list = mealsByDate.get(meal.date) ?? [];
      list.push(meal);
      mealsByDate.set(meal.date, list);
    }
  }
  const orderedDates = Array.from(mealsByDate.keys()).sort();
  const activeDateKey = orderedDates[selectedDayIdx] ?? orderedDates[0] ?? null;
  const activeDayMeals = activeDateKey ? mealsByDate.get(activeDateKey) ?? [] : [];
  const missingShoppingCount = plan
    ? new Set(
        plan.result.meals.flatMap((m) =>
          m.requirements
            .filter((r) => !r.optional && r.status !== 'satisfied')
            .map((r) => r.ingredientId),
        ),
      ).size
    : 0;
  const plannerLocale: 'vi' | 'en' = appLocale === 'vi' ? 'vi' : 'en';
  const activeDayLabel =
    selectedDayIdx === 6
      ? appCopy.planner.sundayFull
      : appLocale === 'vi'
        ? `Thứ ${selectedDayIdx + 2}`
        : appCopy.planner.weekdays[selectedDayIdx];

  return (
    <ConsumerStudioShell screenId="C23" title={appCopy.planner.title}>
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Top Brand Board Heading (`board-2.jpg` right screen) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <BrandFeatureIcon name="planner" size={48} />
            <div className="min-w-0">
              <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
                {appCopy.planner.title}
              </h1>
              <p className="text-sm font-semibold text-[var(--tkv-ink-secondary)] mt-0.5">
                {isGuest || plan
                  ? appCopy.planner.subtitleDefault
                  : appLocale === 'vi'
                    ? `Bếp của ${cleanName} · ${appCopy.planner.subtitleDefault}`
                    : `${cleanName} · ${appCopy.planner.subtitleDefault}`}
              </p>
            </div>
          </div>

          {!isGuest && (
            <div className="hidden sm:flex flex-wrap items-center gap-2.5 shrink-0">
              <TkvButton
                variant="primary"
                size="sm"
                iconLeft="plus"
                onClick={() => navigate('/planner/new')}
              >
                {appCopy.planner.createNew}
              </TkvButton>
              {plan && (
                <Link
                  to={`/planner/${plan.id}/shopping`}
                  className="tkv-focusable min-h-[44px] px-4 py-2 rounded-full bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] text-[var(--tkv-coral-ink)] text-sm font-extrabold inline-flex items-center gap-1.5 transition-colors"
                >
                  <VNextIcon name="shopping" size={16} />
                  <span>{appCopy.planner.shoppingList}</span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* 7-Day Pill Selector */}
        <div
          role="group"
          aria-label={l('Chọn thứ trong tuần', 'Select day of the week')}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:grid sm:grid-cols-7 sm:gap-2.5 max-w-xl"
        >
          {appCopy.planner.weekdays.map((dayLabel, idx) => {
            const active = selectedDayIdx === idx;
            return (
              <button
                key={dayLabel}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedDayIdx(idx)}
                className={clsx(
                  'tkv-focusable min-w-[44px] flex-1 min-h-[44px] rounded-full text-xs sm:text-sm font-extrabold flex items-center justify-center transition-colors border',
                  active
                    ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-[var(--tkv-shadow-cta)]'
                    : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:bg-[var(--tkv-surface-mint)] hover:text-[var(--tkv-primary)]',
                )}
              >
                {dayLabel}
              </button>
            );
          })}
        </div>

        {/* Guest Gate vs Loading vs Error vs Empty Plan vs Active Weekly Schedule */}
        {isGuest ? (
          <div className="space-y-4">
            <TkvSurface className="p-4 sm:p-6 space-y-5 bg-[var(--tkv-surface)]">
              <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-3.5 sm:gap-4">
                <MascotIllustration pose="shopping" size={96} className="w-20 h-20 sm:w-24 sm:h-24 shrink-0" />
                <div className="space-y-1.5 min-w-0 flex-1">
                  <span className="inline-flex items-center rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-3 py-0.5 text-xs font-extrabold text-[var(--tkv-primary)]">
                    {appCopy.planner.weekdays[selectedDayIdx]} · {l('Đồng bộ hộ gia đình', 'Household sync')}
                  </span>
                  <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">
                    {l(
                      'Đăng nhập để tạo và lưu thực đơn 7 ngày',
                      'Sign in to create and save a 7-day meal plan',
                    )}
                  </h2>
                  <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
                    {l(
                      'Thực đơn tuần được đồng bộ theo tài khoản để tự động đối chiếu tủ lạnh và tổng hợp danh sách mua sắm thông minh cho cả nhà.',
                      'Weekly meal plans sync with your account to automatically check your fridge and build a smart household shopping list.',
                    )}
                  </p>
                </div>
              </div>

              <Link
                data-testid="planner-login-cta"
                to={`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`}
                className="tkv-focusable w-full min-h-[50px] px-5 py-3 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white shadow-[var(--tkv-shadow-cta)] font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>
                  {l('Đăng nhập để lập thực đơn 7 ngày', 'Sign in to start your 7-day meal plan')}
                </span>
                <VNextIcon name="chevron-right" size={16} className="shrink-0" />
              </Link>
            </TkvSurface>

            {/* Action Rows matching `board-2.jpg` right phone bottom rows */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                to={`/auth?mode=login&returnTo=${encodeURIComponent('/planner/new')}`}
                className="tkv-focusable tkv-bento-card p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 shrink-0 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-[var(--tkv-primary)] flex items-center justify-center font-extrabold">
                    <VNextIcon name="plus" size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)]">
                      {l('Tạo thực đơn mới', 'Create new meal plan')}
                    </p>
                    <p className="text-xs text-[var(--tkv-ink-secondary)]">
                      {l('Tuỳ chỉnh số bữa & khẩu phần gia đình', 'Customize meals & family servings')}
                    </p>
                  </div>
                </div>
                <VNextIcon name="chevron-right" size={16} className="text-[var(--tkv-ink-muted)] shrink-0" />
              </Link>

              <Link
                to="/shopping"
                className="tkv-focusable tkv-bento-card p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 shrink-0 rounded-full bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] text-[var(--tkv-coral)] flex items-center justify-center">
                    <VNextIcon name="shopping" size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)]">
                      {l('Danh sách mua sắm', 'Shopping list')}
                    </p>
                    <p className="text-xs text-[var(--tkv-ink-secondary)]">
                      {l('Mở giỏ đi chợ hiện tại của bạn', 'Open your current grocery list')}
                    </p>
                  </div>
                </div>
                <VNextIcon name="chevron-right" size={16} className="text-[var(--tkv-ink-muted)] shrink-0" />
              </Link>
            </div>
          </div>
        ) : model.query.isPending ? (
          <WeeklyPlannerSkeleton />
        ) : model.query.isError ? (
          <TkvErrorState
            title={l('Chưa tải được thực đơn tuần', 'Could not load weekly meal plan')}
            message={l(
              'Không thể đọc dữ liệu kế hoạch bữa ăn từ máy chủ. Vui lòng thử lại.',
              'Unable to load meal plan data from the server. Please try again.',
            )}
            onRetry={() => void model.query.refetch()}
          />
        ) : !plan ? (
          <div className="space-y-4">
            <TkvEmptyState
              pose="shopping"
              eyebrow={l('Sẵn sàng lập lịch', 'Ready to plan')}
              title={l('Bắt đầu thực đơn 7 ngày đầu tiên', 'Start your first 7-day meal plan')}
              description={l(
                'Chọn số ngày, số bữa và khẩu phần tại màn hình thiết lập kế hoạch — Bé Mầm Bếp sẽ đối chiếu tủ lạnh và tính sẵn phần cần mua thêm.',
                'Choose your days, meals, and servings in plan setup — Takolio will match your fridge stock and calculate what you still need to buy.',
              )}
              primaryAction={
                <TkvButton onClick={() => navigate('/planner/new')} iconRight="arrow-right">
                  {l('+ Tạo thực đơn mới', '+ Create new meal plan')}
                </TkvButton>
              }
              secondaryAction={
                <TkvButton variant="secondary" iconLeft="shopping" onClick={() => navigate('/shopping')}>
                  {l('Danh sách mua sắm', 'Shopping list')}
                </TkvButton>
              }
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Highlighted Selected Day Card (`board-2.jpg` right phone card!) */}
            {activeDateKey && (
              <TkvSurface className="p-4 sm:p-5 space-y-3.5 bg-[var(--tkv-surface)] border-[var(--tkv-border)]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap tabular-nums">
                      <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">
                        {activeDayLabel}
                      </h2>
                      <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full bg-[var(--tkv-surface-mint)] text-xs font-extrabold text-[var(--tkv-primary)]">
                        {plannerStatusLabel(plan.result.status, plannerLocale)} · v{plan.revision}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-[var(--tkv-ink-secondary)] mt-0.5 tabular-nums">
                      {activeDayMeals.length}{' '}
                      {l('món', activeDayMeals.length === 1 ? 'dish' : 'dishes')} ·{' '}
                      {l('Khoảng 30–35 phút', 'About 30–35 min')}
                    </p>
                  </div>
                  <Link
                    to={
                      activeDayMeals[0]
                        ? `/planner/${plan.id}/meal/${encodeURIComponent(activeDayMeals[0].slotId)}`
                        : `/planner/new`
                    }
                    className="tkv-focusable w-11 h-11 shrink-0 rounded-full bg-[var(--tkv-bg)] flex items-center justify-center text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-primary)]"
                    aria-label={l(`Chi tiết ${activeDayLabel}`, `Details for ${activeDayLabel}`)}
                  >
                    <VNextIcon name="chevron-right" size={18} />
                  </Link>
                </div>

                {/* Dish Photo Trio Strip (`board-2.jpg` right phone!) */}
                <div
                  className={clsx(
                    'grid gap-2.5 sm:gap-3',
                    activeDayMeals.length === 1
                      ? 'grid-cols-1'
                      : activeDayMeals.length === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-3',
                  )}
                >
                  {(() => {
                    const seenSlugs = new Set<string>();
                    return activeDayMeals.slice(0, 3).map((slot, slotIdx) => {
                      const rawSlug = resolvePlannedMealSlug(slot);
                      const uniqueSlug = seenSlugs.has(rawSlug) ? undefined : rawSlug;
                      seenSlugs.add(rawSlug);
                      const localizedTitle = localizeRecipeTitle(
                        {
                          title: slot.title,
                          slug: rawSlug,
                          cuisine: slot.cuisine ?? undefined,
                          cookTimeMinutes: slot.cookTimeMinutes ?? undefined,
                          servings: slot.servings,
                        },
                        appLocale,
                      );
                      return (
                        <Link
                          key={slot.slotId}
                          to={`/planner/${plan.id}/meal/${encodeURIComponent(slot.slotId)}`}
                          aria-label={localizedTitle}
                          className="tkv-focusable group rounded-2xl overflow-hidden border border-[var(--tkv-border)] bg-[var(--tkv-bg)]"
                        >
                          <VerifiedDishImage
                            slug={uniqueSlug}
                            title={uniqueSlug ? localizedTitle : `${slot.mealType}-${slotIdx}`}
                            fallbackSeed={slotIdx}
                            aspectClass="aspect-square sm:aspect-[16/10] lg:aspect-[21/10]"
                            compact
                          />
                        </Link>
                      );
                    });
                  })()}
                </div>

                <Link
                  to={
                    activeDayMeals[0]
                      ? `/planner/${plan.id}/meal/${encodeURIComponent(activeDayMeals[0].slotId)}`
                      : `/planner/new`
                  }
                  className="tkv-focusable w-full min-h-[48px] px-5 py-2.5 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white font-extrabold text-sm inline-flex items-center justify-between shadow-[var(--tkv-shadow-cta)] transition-colors"
                >
                  <span className="mx-auto pl-4">
                    {l('Xem chi tiết thực đơn', 'View meal plan details')}
                  </span>
                  <VNextIcon name="chevron-right" size={16} className="shrink-0" />
                </Link>
              </TkvSurface>
            )}

            {/* Quick Action Rows (`+ Tạo thực đơn mới` & `Danh sách mua sắm` per `board-2.jpg`!) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                to="/planner/new"
                className="tkv-focusable tkv-bento-card p-3.5 sm:p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                    <VNextIcon name="plus" size={18} />
                  </span>
                  <span className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)] min-w-0">
                    {l('Tạo thực đơn mới', 'Create new meal plan')}
                  </span>
                </div>
                <VNextIcon name="chevron-right" size={16} className="text-[var(--tkv-ink-muted)] shrink-0" />
              </Link>

              <Link
                to={`/planner/${plan.id}/shopping`}
                className="tkv-focusable tkv-bento-card p-3.5 sm:p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] text-[var(--tkv-coral)] flex items-center justify-center shrink-0">
                    <VNextIcon name="shopping" size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)]">
                      {l('Danh sách mua sắm', 'Shopping list')}
                    </p>
                    <p className="text-xs font-medium text-[var(--tkv-ink-secondary)] tabular-nums">
                      {missingShoppingCount > 0
                        ? l(
                            `${missingShoppingCount} nguyên liệu cần mua`,
                            `${missingShoppingCount} ${missingShoppingCount === 1 ? 'ingredient' : 'ingredients'} to buy`,
                          )
                        : l(
                            'Tổng hợp nguyên liệu cần mua theo tuần',
                            'Weekly ingredients needed for shopping',
                          )}
                    </p>
                  </div>
                </div>
                <VNextIcon name="chevron-right" size={16} className="text-[var(--tkv-ink-muted)] shrink-0" />
              </Link>
            </div>

            {/* Full Multi-Day Schedule Grid */}
            <section aria-labelledby="c23-schedule-heading" className="space-y-3.5">
              <h2 id="c23-schedule-heading" className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                {l(
                  `Lịch chi tiết cả tuần (${plan.result.meals.length} bữa)`,
                  `Full weekly schedule (${plan.result.meals.length} ${plan.result.meals.length === 1 ? 'meal' : 'meals'})`,
                )}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {orderedDates.map((dateKey) => {
                  const dayMeals = mealsByDate.get(dateKey) ?? [];
                  return (
                    <TkvSurface key={dateKey} className="p-4 space-y-3 flex flex-col justify-between bg-[var(--tkv-surface)]">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2 border-b border-[var(--tkv-border)] pb-2">
                          <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)] capitalize min-w-0">
                            {formatDayHeading(dateKey, appLocale)}
                          </h3>
                          <span className="text-xs font-bold text-[var(--tkv-primary)] tabular-nums shrink-0 whitespace-nowrap">
                            {dayMeals.length} {l('bữa', dayMeals.length === 1 ? 'meal' : 'meals')}
                          </span>
                        </div>

                        <ul className="space-y-2.5">
                          {dayMeals.map((slot) => {
                            const missingReqs = slot.requirements.filter(
                              (r) => !r.optional && r.status !== 'satisfied',
                            ).length;
                            const slotSlug = resolvePlannedMealSlug(slot);
                            const localizedTitle = localizeRecipeTitle(
                              {
                                title: slot.title,
                                slug: slotSlug,
                                cuisine: slot.cuisine ?? undefined,
                                cookTimeMinutes: slot.cookTimeMinutes ?? undefined,
                                servings: slot.servings,
                              },
                              appLocale,
                            );
                            return (
                              <li key={slot.slotId}>
                                <Link
                                  to={`/planner/${plan.id}/meal/${encodeURIComponent(slot.slotId)}`}
                                  className="tkv-focusable p-3 rounded-2xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] hover:border-[var(--tkv-border-mint)] flex items-center justify-between gap-3 transition-colors"
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <VerifiedDishImage
                                      slug={slotSlug}
                                      title={localizedTitle}
                                      aspectClass="aspect-square"
                                      compact
                                      className="w-12 h-12 rounded-xl shrink-0 mt-0.5"
                                    />
                                    <div className="min-w-0 pr-1">
                                      <p className="text-xs font-semibold text-[var(--tkv-ink-muted)] tabular-nums">
                                        {localizeMealSlot(slot.mealType, appLocale)} · {slot.servings}{' '}
                                        {l('người', slot.servings === 1 ? 'serving' : 'servings')}
                                      </p>
                                      <p className="text-sm font-extrabold text-[var(--tkv-ink)] leading-snug break-words mt-0.5">
                                        {localizedTitle}
                                      </p>
                                      <p className="text-xs text-[var(--tkv-ink-secondary)] mt-0.5 inline-flex items-center gap-1.5 tabular-nums">
                                        <span
                                          className={
                                            missingReqs > 0
                                              ? 'w-1.5 h-1.5 rounded-full bg-[var(--tkv-coral)] shrink-0'
                                              : 'w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary)] shrink-0'
                                          }
                                          aria-hidden="true"
                                        />
                                        <span>
                                          {missingReqs === 0
                                            ? l(
                                                'Đủ nguyên liệu dự kiến',
                                                'Projected ingredients available',
                                              )
                                            : l(
                                                `Cần mua ${missingReqs} mục`,
                                                `Need to buy ${missingReqs} ${missingReqs === 1 ? 'item' : 'items'}`,
                                              )}
                                        </span>
                                      </p>
                                    </div>
                                  </div>
                                  <VNextIcon name="chevron-right" size={16} className="text-[var(--tkv-ink-muted)] shrink-0" />
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </TkvSurface>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </ConsumerStudioShell>
  );
};
