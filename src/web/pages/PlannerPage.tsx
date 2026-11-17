import React from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { OnboardingMamCom3D } from '../components/3d/OnboardingMamCom3D';
import { AtelierBadge, BentoCard } from '../design-system/v4/AtelierPrimitives';
import {
  BambooSteamerIcon,
  CalendarMealCheckIcon,
  ClaypotBraiseIcon,
  FreshnessShieldIcon,
  HerbSprigIcon,
  HouseholdTrayIcon,
  NavShoppingIcon,
  StockpotSoupIcon,
} from '../design-system/icons';
import { PlannerShell, PlannerError, FreshnessNotice } from '../features/planner/PlannerShell';
import { PlannerSetup } from '../features/planner/PlannerSetup';
import { PlannerWeek } from '../features/planner/PlannerWeek';
import { PlannerMeal } from '../features/planner/PlannerMeal';
import { PlannerShopping } from '../features/planner/PlannerShopping';
import { usePlanner } from '../features/planner/usePlanner';
import { usePlannerLocale } from '../features/planner/copy';
import { useAuthStore } from '../stores/useAuthStore';

function RegisteredAccountPrompt({ returnTo, locale }: { returnTo: string; locale: 'vi' | 'en' }) {
  const href = `/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`;
  const english = locale === 'en';
  const sampleRoles = english
    ? [
        { label: 'Braised / Savory Main', tone: 'flame' as const, icon: <ClaypotBraiseIcon size={14} tone="flame" /> },
        { label: 'Clear / Sour Soup', tone: 'ocean' as const, icon: <StockpotSoupIcon size={14} tone="jade" /> },
        { label: 'Stir-fried Greens', tone: 'jade' as const, icon: <HerbSprigIcon size={14} tone="jade" /> },
        { label: 'Steamed Rice', tone: 'turmeric' as const, icon: <BambooSteamerIcon size={14} tone="turmeric" /> },
      ]
    : [
        { label: 'Món mặn đậm đà', tone: 'flame' as const, icon: <ClaypotBraiseIcon size={14} tone="flame" /> },
        { label: 'Món canh thanh mát', tone: 'ocean' as const, icon: <StockpotSoupIcon size={14} tone="jade" /> },
        { label: 'Rau xào / luộc', tone: 'jade' as const, icon: <HerbSprigIcon size={14} tone="jade" /> },
        { label: 'Cơm trắng dẻo thơm', tone: 'turmeric' as const, icon: <BambooSteamerIcon size={14} tone="turmeric" /> },
      ];

  return (
    <BentoCard tone="ceramic" padding="lg" className="planning-empty">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center gap-2">
            <AtelierBadge tone="jade" icon={<HouseholdTrayIcon size={14} tone="jade" active />}>
              {english ? '7-Day Mâm Cơm Studio · Free' : 'Xưởng Thực Đơn Mâm Cơm 7 Ngày · Miễn phí'}
            </AtelierBadge>
            <AtelierBadge tone="turmeric" icon={<FreshnessShieldIcon size={14} tone="turmeric" />}>
              {english ? 'Keeps your guest fridge items' : 'Giữ nguyên nguyên liệu tủ lạnh phiên khách'}
            </AtelierBadge>
          </div>

          <h2 className="font-heading text-2xl font-extrabold tracking-tight text-tk-ink sm:text-3xl">
            {english
              ? 'Sign in to use meal planning'
              : 'Đăng nhập để dùng kế hoạch bữa ăn'}
          </h2>

          <p className="text-sm leading-relaxed text-tk-secondary sm:text-base">
            {english
              ? 'Meal plans are saved to a registered household account so your family shares one live 7-day tray calendar and supermarket list. Your guest fridge items stay intact when you sign in.'
              : 'Kế hoạch bữa ăn được lưu theo tài khoản gia đình miễn phí để đồng bộ mâm cơm 7 ngày và giỏ đi chợ chung. Toàn bộ nguyên liệu trong tủ lạnh phiên khách của bạn được giữ nguyên khi nâng cấp tài khoản.'}
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {sampleRoles.map((role) => (
              <AtelierBadge key={role.label} tone={role.tone} icon={role.icon}>
                {role.label}
              </AtelierBadge>
            ))}
          </div>

          <div className="grid gap-2.5 pt-1 sm:grid-cols-2">
            <div className="rounded-2xl border border-tk-stone/80 bg-tk-sunken/70 p-3.5 text-xs leading-relaxed text-tk-secondary">
              <p className="flex items-center gap-1.5 font-extrabold text-tk-ink">
                <CalendarMealCheckIcon size={15} tone="jade" />
                {english ? 'Balanced Vietnamese trays' : 'Cân bằng đủ món mặn - canh - rau'}
              </p>
              <p className="mt-1">
                {english
                  ? 'Prioritizes expiring fridge ingredients first before suggesting extra groceries.'
                  : 'Ưu tiên giải cứu thực phẩm sắp hết hạn trong tủ lạnh trước khi gợi ý mua thêm.'}
              </p>
            </div>
            <div className="rounded-2xl border border-tk-stone/80 bg-tk-sunken/70 p-3.5 text-xs leading-relaxed text-tk-secondary">
              <p className="flex items-center gap-1.5 font-extrabold text-tk-ink">
                <NavShoppingIcon size={15} tone="flame" />
                {english ? '1-tap supermarket sync' : 'Gom giỏ đi chợ khép kín'}
              </p>
              <p className="mt-1">
                {english
                  ? 'Combines missing quantities across upcoming meals and imports bought items straight to the fridge.'
                  : 'Tự động cộng dồn phần còn thiếu cho các bữa tới và nhập thẳng vào tủ lạnh sau khi đi chợ.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              data-testid="planner-login-cta"
              to={href}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-tk-flame px-6 py-3 text-sm font-extrabold text-white shadow-float transition-tap hover:bg-tk-flame-hover"
            >
              {english ? 'Sign in to continue' : 'Đăng nhập để tiếp tục'}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link
              to="/fridge"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-tk-stone bg-white px-4 py-3 text-sm font-bold text-tk-ink transition-colors hover:bg-tk-sunken"
            >
              {english ? 'Back to Fridge' : 'Xem tủ lạnh hiện tại'}
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5">
          <OnboardingMamCom3D
            householdSize={3}
            step={1}
            showControls={false}
            mealStyle={english ? 'Vietnamese Mâm Cơm' : 'Mâm cơm gia đình'}
          />
        </div>
      </div>
    </BentoCard>
  );
}

export const PlannerPage: React.FC = () => {
  const location = useLocation();
  return <PlannerWorkspace key={location.pathname} />;
};

function PlannerWorkspace() {
  const { planId, slotId } = useParams<{ planId: string; slotId: string }>();
  const location = useLocation();
  const setup = location.pathname === '/planner/new';
  const language = usePlannerLocale();
  const { locale, copy: t } = language;
  const registeredAccountRequired = useAuthStore((state) => state.isGuest);
  const returnTo = `${location.pathname}${location.search}`;
  const model = usePlanner(planId, !setup && !registeredAccountRequired);
  const plan = model.plan;
  if (!setup && !registeredAccountRequired && !planId && plan) {
    return <Navigate to={`/planner/${plan.id}`} replace />;
  }

  return (
    <PlannerShell {...language} plan={setup || registeredAccountRequired ? null : plan}>
      {registeredAccountRequired ? (
        <RegisteredAccountPrompt returnTo={returnTo} locale={locale} />
      ) : (
        <>
          {!!model.error && <PlannerError error={model.error} locale={locale} focus />}
          {model.refreshed && (
            <p
              role="status"
              className="planning-notice rounded-2xl border border-tk-jade/25 bg-tk-jade-soft px-4 py-3 text-sm font-bold text-tk-jade-deep"
            >
              {t.updated}
            </p>
          )}
          {setup ? (
            <PlannerSetup model={model} locale={locale} />
          ) : model.query.isPending ? (
            <BentoCard role="status" tone="sunken" padding="lg" className="py-14 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-tk-jade-soft text-tk-jade-deep">
                <CalendarMealCheckIcon size={30} tone="jade" active />
              </div>
              <p className="text-sm font-bold text-tk-ink">{t.loading}</p>
            </BentoCard>
          ) : model.query.isError ? (
            <>
              <PlannerError
                error={model.query.error}
                locale={locale}
                onRetry={() => void model.query.refetch()}
              />
              <Link
                to="/planner"
                className="inline-flex min-h-11 items-center text-sm font-bold text-tk-jade-deep underline"
              >
                {t.back}
              </Link>
            </>
          ) : !plan ? (
            <BentoCard tone="jade" padding="lg" className="planning-empty text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-tk-jade-deep shadow-xs">
                <HouseholdTrayIcon size={34} tone="jade" active />
              </div>
              <h2 className="font-heading text-2xl font-extrabold text-tk-ink">{t.empty}</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-tk-secondary">
                {t.emptyText}
              </p>
              <Link
                to="/planner/new"
                className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-tk-flame px-6 py-3 text-sm font-extrabold text-white shadow-float transition-tap hover:bg-tk-flame-hover"
              >
                {t.newPlan}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </BentoCard>
          ) : (
            <>
              <FreshnessNotice plan={plan} familyPlan={model.familyPlan} locale={locale} />
              {slotId ? (
                <PlannerMeal
                  key={`${plan.id}:${plan.revision}:${slotId}`}
                  plan={plan}
                  slotId={slotId}
                  model={model}
                  locale={locale}
                />
              ) : location.pathname.endsWith('/shopping') ? (
                <PlannerShopping
                  key={`${plan.id}:${plan.revision}`}
                  plan={plan}
                  model={model}
                  locale={locale}
                />
              ) : (
                <PlannerWeek plan={plan} model={model} locale={locale} />
              )}
            </>
          )}
        </>
      )}
    </PlannerShell>
  );
}
