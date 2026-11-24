import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, ShoppingBag, ArrowRight } from 'lucide-react';
import type { MealPlanDto } from '../../../../packages/domain/src/meal-planning-api';
import type { FamilyMealPlanDto } from '../../../../packages/domain/src/family-meal-planning-api';
import { KitchenHeader } from '../../components/common/KitchenHeader';
import { plannerCopy, type PlannerLocale } from './copy';
import { freshnessReasonLabel, plannerErrorMessage } from './presentation';
import { Button } from '../../components/common/Button';
import { canSharePlannerShopping, hasFuturePlannerSlot } from './schedule';
import { isMealCompositionEnabled } from './composition';
import { lPlanner, useLocaleText } from '../../i18n/app-i18n';
import { getLoadedLocalePack } from '../../i18n/packs/registry';

function resolvePlannerCopy(locale: PlannerLocale, appLocale: string) {
  if (locale === 'vi') return plannerCopy.vi;
  const pack = getLoadedLocalePack(appLocale === 'vi' ? 'en' : appLocale);
  return pack?.planner
    ? ({ ...plannerCopy.en, ...pack.planner } as unknown as typeof plannerCopy.en)
    : plannerCopy.en;
}

export function PlannerShell({
  children,
  plan,
  locale,
  setLocale,
}: {
  children: ReactNode;
  plan?: MealPlanDto | null;
  locale: PlannerLocale;
  setLocale: (locale: PlannerLocale) => void;
}) {
  const { locale: appLocale } = useLocaleText();
  const t = resolvePlannerCopy(locale, appLocale);
  const pathname = useLocation().pathname;
  const shopping = pathname.endsWith('/shopping');
  const setup = pathname === '/planner/new';
  const meal = pathname.includes('/meal/');
  const heading = setup
    ? lPlanner(locale, 'Tạo thực đơn', 'Create a meal plan')
    : shopping
      ? lPlanner(locale, 'Đi chợ theo thực đơn', 'Shop for your meals')
      : meal
        ? lPlanner(locale, 'Chuẩn bị bữa ăn', 'Prepare your meal')
        : lPlanner(locale, 'Thực đơn của nhà mình', 'Your household meal plan');
  useEffect(() => {
    document.documentElement.scrollTop = 0;
  }, [pathname]);
  return (
    <div className={`planning-workspace${plan ? ' has-plan' : ''}`} lang={locale}>
      <KitchenHeader backTo="/" />
      <div className="planning-page-body">
        <header className="planning-heading">
          <div>
            <p className="planning-eyebrow" translate="no">
              {t.eyebrow}
            </p>
            <h1>{heading}</h1>
            <p className="planning-intro">
              {setup
                ? lPlanner(
                    locale,
                    'Chọn lịch nấu, Takolio lo xếp món và phần cần mua.',
                    'Choose your cooking calendar. Takolio plans the dishes and shopping.',
                  )
                : t.intro}
            </p>
          </div>
          <label className="planning-locale">
            <span>{lPlanner(locale, 'Ngôn ngữ', 'Language')}</span>
            <select
              aria-label="Language"
              value={locale}
              onChange={(e) => setLocale(e.target.value as PlannerLocale)}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </label>
        </header>
        {plan && (
          <nav aria-label={t.week} className="planning-tabs">
            <Link to={`/planner/${plan.id}`} aria-current={!shopping ? 'page' : undefined}>
              <CalendarDays size={18} aria-hidden="true" />
              {t.week}
            </Link>
            <Link to={`/planner/${plan.id}/shopping`} aria-current={shopping ? 'page' : undefined}>
              <ShoppingBag size={18} aria-hidden="true" />
              {t.shopping}
            </Link>
          </nav>
        )}
        <div className="planning-content">{children}</div>
        <footer className="planning-footer">
          <p>{t.planNote}</p>
          <Link className="planning-text-link" to="/shopping">
            {lPlanner(locale, 'Danh sách mua sắm đã lưu', 'Saved shopping list')}{' '}
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
  const { locale: appLocale } = useLocaleText();
  const t = resolvePlannerCopy(locale, appLocale);
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
      className="planning-notice planning-error"
    >
      <p>{plannerErrorMessage(error, locale)}</p>
      {onRetry && (
        <Button className="mt-3" variant="outline" onClick={onRetry}>
          {t.retry}
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
  const { locale: appLocale } = useLocaleText();
  if (plan.freshness.status === 'fresh') return null;
  const t = resolvePlannerCopy(locale, appLocale);
  const past = plan.freshness.reasons.includes('planning_time_elapsed');
  const composing = isMealCompositionEnabled();
  const continuing = composing && canSharePlannerShopping(plan, familyPlan);
  const future = hasFuturePlannerSlot(plan);
  return (
    <section role="status" className="planning-notice planning-stale">
      <h2>
        {continuing
          ? lPlanner(
              locale,
              'Tiếp tục chuẩn bị những bữa sắp tới',
              'Continue planning your next meals',
            )
          : t.staleTitle}
      </h2>
      <p>
        {continuing
          ? past
            ? lPlanner(
                locale,
                'Các bữa đã qua được giữ nguyên. Bạn vẫn có thể chỉnh món cho những bữa sắp tới. Khi tạo danh sách đi chợ, Takolio kiểm tra lại tủ lạnh hiện tại và chỉ tính các bữa còn phía trước.',
                'Past meals stay unchanged. You can still edit future meals. Creating a shared shopping list checks your current fridge and only includes upcoming meals.',
              )
            : lPlanner(
                locale,
                'Bạn vẫn có thể chỉnh món cho những bữa sắp tới. Khi tạo danh sách đi chợ, Takolio kiểm tra lại tủ lạnh hiện tại và chỉ tính các bữa còn phía trước.',
                'You can still edit future meals. Creating a shared shopping list checks your current fridge and only includes upcoming meals.',
              )
          : composing && past && future
            ? lPlanner(
                locale,
                'Các bữa đã qua được giữ nguyên. Dữ liệu dùng cho kế hoạch đã thay đổi và cần kiểm tra lại trước khi tiếp tục chuẩn bị các bữa sắp tới hoặc tạo danh sách đi chợ.',
                'Past meals stay unchanged. Planning data changed and must be revalidated before continuing with future meals or creating a shared shopping list.',
              )
            : past
              ? t.historical
              : t.staleText}
      </p>
      <ul>
        {plan.freshness.reasons.map((code) => (
          <li key={code}>{freshnessReasonLabel(code, locale)}</li>
        ))}
      </ul>
      <Link
        className="planning-text-link"
        to={continuing ? `/planner/${plan.id}/shopping` : '/planner/new'}
      >
        {continuing ? t.shopping : t.newPlan}
      </Link>
    </section>
  );
}
