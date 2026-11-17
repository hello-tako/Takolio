import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { MealPlanDto } from '../../../../packages/domain/src/meal-planning-api';
import type { FamilyMealPlanDto } from '../../../../packages/domain/src/family-meal-planning-api';
import { KitchenHeader } from '../../components/common/KitchenHeader';
import { Button } from '../../components/common/Button';
import { AtelierBadge, BentoCard } from '../../design-system/v4/AtelierPrimitives';
import {
  CalendarMealCheckIcon,
  FreshnessShieldIcon,
  HouseholdTrayIcon,
  NavPlannerIcon,
  NavShoppingIcon,
} from '../../design-system/icons';
import { plannerCopy, type PlannerLocale } from './copy';
import { freshnessReasonLabel, plannerErrorMessage } from './presentation';
import { canSharePlannerShopping, hasFuturePlannerSlot } from './schedule';
import { isMealCompositionEnabled } from './composition';

export function PlannerShell({
  children,
  plan,
  locale,
  setLocale: _setLocale,
}: {
  children: ReactNode;
  plan?: MealPlanDto | null;
  locale: PlannerLocale;
  setLocale?: (locale: PlannerLocale) => void;
}) {
  const t = plannerCopy[locale];
  const pathname = useLocation().pathname;
  const shopping = pathname.endsWith('/shopping');
  const setup = pathname === '/planner/new';
  const meal = pathname.includes('/meal/');
  const heading =
    locale === 'vi'
      ? setup
        ? 'Tạo thực đơn'
        : shopping
          ? 'Đi chợ theo thực đơn'
          : meal
            ? 'Chuẩn bị bữa ăn'
            : 'Thực đơn của nhà mình'
      : setup
        ? 'Create a meal plan'
        : shopping
          ? 'Shop for your meals'
          : meal
            ? 'Prepare your meal'
            : 'Your household meal plan';

  useEffect(() => {
    document.documentElement.scrollTop = 0;
  }, [pathname]);

  return (
    <div className={`planning-workspace min-h-screen bg-tk-canvas text-tk-ink${plan ? ' has-plan' : ''}`} lang={locale}>
      <KitchenHeader backTo="/" />
      <div className="planning-page-body mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6">
        <header className="planning-heading mb-6 rounded-[28px] border border-tk-stone/80 bg-gradient-to-br from-white via-tk-canvas to-tk-jade-soft/45 p-5 shadow-card sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <AtelierBadge
                  tone="jade"
                  icon={<HouseholdTrayIcon size={14} tone="jade" active />}
                >
                  <span className="planning-eyebrow" translate="no">
                    {t.eyebrow}
                  </span>
                </AtelierBadge>
                {plan && (
                  <AtelierBadge
                    tone="turmeric"
                    icon={<CalendarMealCheckIcon size={14} tone="turmeric" />}
                  >
                    {locale === 'vi'
                      ? `${plan.intent.horizonDays} ngày · ${plan.intent.defaultServings} người`
                      : `${plan.intent.horizonDays} days · ${plan.intent.defaultServings} servings`}
                  </AtelierBadge>
                )}
              </div>
              <h1 className="font-heading text-2xl font-extrabold tracking-tight text-tk-ink sm:text-3xl">
                {heading}
              </h1>
              <p className="planning-intro max-w-2xl text-sm leading-relaxed text-tk-secondary">
                {setup
                  ? locale === 'vi'
                    ? 'Chọn lịch nấu, Takolio lo xếp mâm cơm đủ món và gom phần nguyên liệu cần mua.'
                    : 'Choose your cooking calendar. Takolio plans the dishes and shopping.'
                  : t.intro}
              </p>
            </div>
          </div>
        </header>

        {plan && (
          <nav
            aria-label={t.week}
            className="planning-tabs mb-6 inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-tk-stone/80 bg-tk-sunken/90 p-1.5"
          >
            <Link
              to={`/planner/${plan.id}`}
              aria-current={!shopping ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                !shopping
                  ? 'bg-white text-tk-ink shadow-xs'
                  : 'text-tk-secondary hover:text-tk-ink'
              }`}
            >
              <NavPlannerIcon size={18} tone={!shopping ? 'flame' : 'ink'} active={!shopping} />
              {t.week}
            </Link>
            <Link
              to={`/planner/${plan.id}/shopping`}
              aria-current={shopping ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                shopping
                  ? 'bg-white text-tk-ink shadow-xs'
                  : 'text-tk-secondary hover:text-tk-ink'
              }`}
            >
              <NavShoppingIcon size={18} tone={shopping ? 'jade' : 'ink'} active={shopping} />
              {t.shopping}
            </Link>
          </nav>
        )}

        <div className="planning-content space-y-5">{children}</div>

        <footer className="planning-footer mt-10 flex flex-col gap-3 rounded-[24px] border border-tk-stone/75 bg-tk-sunken/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-tk-secondary">{t.planNote}</p>
          <Link
            className="planning-text-link inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-tk-jade-deep shadow-xs transition-colors hover:bg-tk-jade-soft"
            to="/shopping"
          >
            {locale === 'vi' ? 'Danh sách mua sắm đã lưu' : 'Saved shopping list'}{' '}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </footer>
      </div>
    </div>
  );
}

export function PlannerError({
  error,
  locale,
  onRetry,
  focus = false,
}: {
  error: unknown;
  locale: PlannerLocale;
  onRetry?: () => void;
  focus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]');
    if (focus && (!dialog || dialog.contains(ref.current))) {
      ref.current?.focus();
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [error, focus]);
  return (
    <div
      ref={ref}
      tabIndex={focus ? -1 : undefined}
      role="alert"
      className="planning-notice planning-error rounded-2xl border border-tk-berry/30 bg-tk-berry-soft p-4 text-sm text-tk-berry-deep"
    >
      <p className="font-semibold leading-relaxed">{plannerErrorMessage(error, locale)}</p>
      {onRetry && (
        <Button className="mt-3" variant="outline" onClick={onRetry}>
          {plannerCopy[locale].retry}
        </Button>
      )}
    </div>
  );
}

export function FreshnessNotice({
  plan,
  familyPlan,
  locale,
}: {
  plan: MealPlanDto;
  familyPlan?: FamilyMealPlanDto;
  locale: PlannerLocale;
}) {
  if (plan.freshness.status === 'fresh') return null;
  const t = plannerCopy[locale];
  const past = plan.freshness.reasons.includes('planning_time_elapsed');
  const composing = isMealCompositionEnabled();
  const continuing = composing && canSharePlannerShopping(plan, familyPlan);
  const future = hasFuturePlannerSlot(plan);
  return (
    <BentoCard
      role="status"
      tone="turmeric"
      padding="md"
      className="planning-notice planning-stale space-y-2.5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-tk-turmeric-deep shadow-xs">
          <FreshnessShieldIcon size={18} tone="turmeric" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="font-heading text-base font-extrabold text-tk-ink">
            {continuing
              ? locale === 'vi'
                ? 'Tiếp tục chuẩn bị những bữa sắp tới'
                : 'Continue planning your next meals'
              : t.staleTitle}
          </h2>
          <p className="text-sm leading-relaxed text-tk-secondary">
            {continuing
              ? locale === 'vi'
                ? `${past ? 'Các bữa đã qua được giữ nguyên. ' : ''}Bạn vẫn có thể chỉnh món cho những bữa sắp tới. Khi tạo danh sách đi chợ, Takolio kiểm tra lại tủ lạnh hiện tại và chỉ tính các bữa còn phía trước.`
                : `${past ? 'Past meals stay unchanged. ' : ''}You can still edit future meals. Creating a shared shopping list checks your current fridge and only includes upcoming meals.`
              : composing && past && future
                ? locale === 'vi'
                  ? 'Các bữa đã qua được giữ nguyên. Dữ liệu dùng cho kế hoạch đã thay đổi và cần kiểm tra lại trước khi tiếp tục chuẩn bị các bữa sắp tới hoặc tạo danh sách đi chợ.'
                  : 'Past meals stay unchanged. Planning data changed and must be revalidated before continuing with future meals or creating a shared shopping list.'
                : past
                  ? t.historical
                  : t.staleText}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs font-medium text-tk-turmeric-deep">
            {plan.freshness.reasons.map((code) => (
              <li key={code}>{freshnessReasonLabel(code, locale)}</li>
            ))}
          </ul>
          <Link
            className="planning-text-link inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-tk-ink shadow-xs transition-colors hover:bg-tk-sunken"
            to={continuing ? `/planner/${plan.id}/shopping` : '/planner/new'}
          >
            {continuing ? t.shopping : t.newPlan}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </BentoCard>
  );
}
