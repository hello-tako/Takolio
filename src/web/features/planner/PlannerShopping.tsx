import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import type {
  MealPlanDto,
  PlanShoppingDtoSchema,
} from '../../../../packages/domain/src/meal-planning-api';
import type { MoneyDto } from '../../../../packages/domain/src/meal-shopping-api';
import type { z } from 'zod';
import { Button } from '../../components/common/Button';
import { BentoCard } from '../../design-system/v4/AtelierPrimitives';
import {
  BudgetCoinJarIcon,
  CalendarMealCheckIcon,
  NavShoppingIcon,
} from '../../design-system/icons';
import { mealPlanningApi } from '../../services/meal-planning';
import { queryKeys } from '../../lib/queryKeys';
import { plannerCopy, type PlannerLocale } from './copy';
import {
  budgetStatusLabel,
  formatMoney,
  formatQuantity,
  ingredientLabel,
  parseBudgetMinorAmount,
  reasonLabel,
  shoppingStatusLabel,
  wasteRiskLabel,
} from './presentation';
import { plannerInputClass } from './PlannerSetup';
import type { usePlanner } from './usePlanner';
import { useFamilyPreferences } from '../family/useFamilyPreferences';
import { ApiError } from '../../services/http';
import { capturePrivateSession } from '../../lib/private-session';
import { shoppingApi } from '../../services/shopping';
import {
  compositionCopy,
  compositionUnavailable,
  componentTitle,
  isMealCompositionEnabled,
  usePlanCompositions,
} from './composition';
import { CompositionLoadState } from './CompositionLoadState';
import {
  canSharePlannerShopping,
  hasFuturePlannerSlot,
  isPlannerSlotElapsed,
  plannerLocalDate,
} from './schedule';

type Shopping = z.infer<typeof PlanShoppingDtoSchema>;

function tripDateLabel(value: string, locale: PlannerLocale) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(
        date,
      )
    : '—';
}

export function PlannerShopping({
  plan,
  model,
  locale,
}: {
  plan: MealPlanDto;
  model: ReturnType<typeof usePlanner>;
  locale: PlannerLocale;
}) {
  const t = plannerCopy[locale];
  const c = compositionCopy[locale];
  const composing = isMealCompositionEnabled();
  const compositions = usePlanCompositions(plan, composing);
  const matchingCompositions =
    compositions.data?.planId === plan.id && compositions.data.planRevision === plan.revision;
  const compositionRevisionChanged =
    compositions.isSuccess &&
    compositions.data.planId === plan.id &&
    compositions.data.planRevision !== plan.revision;
  const untracked =
    compositions.isSuccess && matchingCompositions
      ? compositions.data.compositions
          .filter((meal) => !isPlannerSlotElapsed(plan, meal.slotId))
          .flatMap((meal) =>
            meal.components
              .filter((item) => item.projection?.status === 'not_tracked')
              .map((item) => ({ meal, item })),
          )
      : [];
  const client = useQueryClient();
  const [currency, setCurrency] = useState<MoneyDto['currency']>('VND');
  const [budget, setBudget] = useState('');
  const [mode, setMode] = useState<'hard' | 'soft'>('hard');
  const [invalid, setInvalid] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (invalid) {
      errorRef.current?.focus();
      errorRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [invalid]);

  const key = [...queryKeys.mealPlanningShopping(plan.id), plan.revision, currency, budget, mode];
  const shopping = useQuery<Shopping>({
    queryKey: key,
    queryFn: skipToken,
    enabled: false,
    retry: false,
  });
  const familyPreferences = useFamilyPreferences();
  const calendarToday = plannerLocalDate(plan);
  const [tripStart, setTripStart] = useState(
    calendarToday && plan.intent.startDate > calendarToday
      ? plan.intent.startDate
      : (calendarToday ?? ''),
  );
  const [tripDays, setTripDays] = useState(3);

  useEffect(() => {
    if (familyPreferences.data) {
      setTripDays(
        familyPreferences.data.preferences.shoppingCadence === 'daily'
          ? 1
          : familyPreferences.data.preferences.shoppingCadence === 'weekly'
            ? 7
            : 3,
      );
    }
  }, [familyPreferences.data]);

  const tripEnd = new Date(`${tripStart}T12:00:00Z`);
  tripEnd.setUTCDate(tripEnd.getUTCDate() + tripDays - 1);
  const endDate = Number.isFinite(tripEnd.getTime())
    ? tripEnd.toISOString().slice(0, 10)
    : tripStart;
  const shareInput = {
    planId: plan.id,
    expectedRevision: plan.revision,
    startDate: tripStart,
    endDate,
  };
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [shareRecovery, setShareRecovery] = useState(false);
  const needsRefresh = shareRecovery || compositionRevisionChanged;

  async function reloadPlan() {
    const isCurrent = capturePrivateSession();
    const result = await model.perform('refresh', () => model.loadPlan(plan.id), model.replacePlan);
    if (result && isCurrent()) {
      setShareRecovery(false);
      setShareMessage('');
    }
  }

  async function shareShopping() {
    if (
      shareBusy ||
      model.busy ||
      needsRefresh ||
      !plannerLocalDate(plan) ||
      !tripStart ||
      !canSharePlannerShopping(plan, model.familyPlan)
    )
      return;
    const isCurrent = capturePrivateSession();
    const requestIntent = { action: 'share-shopping', ...shareInput };
    setShareBusy(true);
    setShareMessage('');
    try {
      const result = await shoppingApi.sharePlanShopping(
        shareInput,
        model.requestKey(requestIntent),
      );
      if (!isCurrent()) return;
      model.retireRequestKey(requestIntent);
      await client.invalidateQueries({ queryKey: queryKeys.shoppingList() });
      if (!isCurrent()) return;
      setShareMessage(
        locale === 'vi'
          ? `Đã cập nhật nhu cầu cho ${result.itemCount} nguyên liệu${result.unresolvedCount ? ` · ${result.unresolvedCount} dòng cần kiểm tra lượng` : ''}.`
          : `Shared demand updated for ${result.itemCount} ingredients${result.unresolvedCount ? ` · ${result.unresolvedCount} need quantity review` : ''}.`,
      );
    } catch (failure) {
      if (!isCurrent()) return;
      const changed =
        failure instanceof ApiError &&
        [
          'PLAN_REVISION_CONFLICT',
          'REVISION_CONFLICT',
          'SHOPPING_SNAPSHOT_CHANGED',
          'PLAN_REVALIDATION_REQUIRED',
        ].includes(failure.code ?? '');
      setShareRecovery(changed);
      setShareMessage(
        changed
          ? locale === 'vi'
            ? 'Thực đơn, tủ lạnh hoặc thói quen vừa thay đổi. Tải lại dữ liệu trước khi cập nhật danh sách.'
            : 'The plan, fridge or preferences changed. Load the latest data before updating the list.'
          : failure instanceof ApiError && failure.code === 'SHOPPING_PLAN_CONFLICT'
            ? locale === 'vi'
              ? 'Danh sách đang dùng thực đơn của thành viên khác. Hãy thống nhất thực đơn trước khi cập nhật.'
              : 'The list uses another household member’s plan. Agree on a plan before updating it.'
            : locale === 'vi'
              ? 'Chưa tạo được danh sách chung. Kiểm tra kết nối và thử lại.'
              : 'Could not create the shared list. Check your connection and try again.',
      );
    } finally {
      if (isCurrent()) setShareBusy(false);
    }
  }

  const fresh = plan.freshness.status === 'fresh';
  const canShare = canSharePlannerShopping(plan, model.familyPlan);
  const hasFutureMeals = hasFuturePlannerSlot(plan);
  const response =
    fresh && !model.busy && !model.error && shopping.data?.planRevision === plan.revision
      ? shopping.data
      : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setInvalid(false);
    const minor = budget.trim() ? parseBudgetMinorAmount(budget, currency, locale) : null;
    if (budget.trim() && minor === null) {
      setInvalid(true);
      return;
    }
    await model.perform(
      'shopping',
      () =>
        mealPlanningApi.shopping(plan.id, {
          revision: plan.revision,
          currency,
          ...(minor === null ? {} : { budget: { mode, money: { currency, minorAmount: minor } } }),
        }),
      (result) => client.setQueryData(key, result),
    );
  }

  return (
    <>
      {composing && !compositionUnavailable(compositions.error) && (
        <CompositionLoadState query={compositions} locale={locale} />
      )}

      {untracked.length > 0 && (
        <section
          aria-labelledby="untracked-shopping"
          className="space-y-2 rounded-2xl border border-tk-turmeric/30 bg-tk-turmeric-soft p-4 text-tk-ink"
        >
          <h2 id="untracked-shopping" className="text-sm font-extrabold text-tk-turmeric-deep">
            {c.notTracked}
          </h2>
          <p className="text-sm text-tk-secondary">{c.untrackedShopping}</p>
          <ul className="space-y-1 text-sm">
            {untracked.map(({ meal, item }) => (
              <li key={`${meal.slotId}:${item.id}`}>
                <Link
                  className="inline-flex min-h-11 items-center font-bold text-tk-jade-deep underline"
                  to={`/planner/${plan.id}/meal/${encodeURIComponent(meal.slotId)}`}
                >
                  {componentTitle(item, locale)} · {meal.date} · {t[meal.mealType]}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {composing && (
        <BentoCard tone="jade" padding="md" className="planning-share-shopping space-y-4">
          <div className="planning-share-heading flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-tk-jade-deep shadow-xs">
              <CalendarMealCheckIcon size={22} tone="jade" active />
            </span>
            <div>
              <h2 className="font-heading text-lg font-extrabold text-tk-ink">
                {locale === 'vi' ? 'Chuẩn bị lượt đi chợ' : 'Prepare your shopping trip'}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-tk-secondary">
                {locale === 'vi'
                  ? 'Chọn khoảng ngày cần mua. Takolio gom phần còn thiếu của các bữa sắp tới theo tủ lạnh hiện tại.'
                  : 'Choose the days to shop for. Takolio combines what upcoming meals still need from your current fridge.'}
              </p>
            </div>
          </div>

          <div className="family-field-pair grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-bold text-tk-ink">
              {locale === 'vi' ? 'Mua cho các bữa từ ngày' : 'Meals from'}
              <input
                type="date"
                min={calendarToday}
                value={tripStart}
                onChange={(event) => setTripStart(event.target.value)}
                className={plannerInputClass}
              />
            </label>
            <label className="block text-sm font-bold text-tk-ink">
              {locale === 'vi' ? 'Khoảng đi chợ' : 'Shopping period'}
              <select
                value={tripDays}
                onChange={(event) => setTripDays(Number(event.target.value))}
                className={plannerInputClass}
              >
                <option value={1}>{locale === 'vi' ? '1 ngày' : '1 day'}</option>
                <option value={3}>{locale === 'vi' ? '3 ngày' : '3 days'}</option>
                <option value={7}>{locale === 'vi' ? 'Cả tuần' : 'Full week'}</option>
              </select>
            </label>
          </div>

          <p className="planning-note text-xs font-bold text-tk-jade-deep">
            {locale === 'vi' ? 'Cho các bữa từ' : 'For meals from'}{' '}
            {tripDateLabel(tripStart, locale)} → {tripDateLabel(endDate, locale)}
          </p>

          <Button
            fullWidth
            disabled={
              !canShare || !calendarToday || shareBusy || !!model.busy || needsRefresh || !tripStart
            }
            isLoading={shareBusy}
            onClick={() => void shareShopping()}
          >
            <CheckCircle2 size={16} className="mr-2" />
            {locale === 'vi' ? 'Tạo danh sách dùng chung' : 'Create shared list'}
          </Button>

          {!canShare && !needsRefresh && (
            <p className="mt-2 text-sm text-tk-secondary" role="status">
              {!hasFutureMeals
                ? locale === 'vi'
                  ? 'Các bữa trong thực đơn này đã qua giờ dự kiến. Lên thực đơn mới để chuẩn bị lượt đi chợ tiếp theo.'
                  : 'The scheduled meals in this plan have passed. Create a new plan for your next shopping trip.'
                : locale === 'vi'
                  ? 'Thực đơn hoặc thói quen ăn uống cần được kiểm tra lại. Tải bản mới nhất và cập nhật kế hoạch trước khi tạo danh sách chung.'
                  : 'The plan or food preferences need revalidation. Load the latest revision and update the plan before creating a shared list.'}
            </p>
          )}

          {shareMessage && (
            <p
              role="status"
              className="planning-notice rounded-2xl border border-tk-jade/25 bg-white px-4 py-3 text-sm font-bold text-tk-jade-deep"
            >
              {shareMessage}
            </p>
          )}

          {needsRefresh && (
            <div
              role="status"
              className="planning-notice space-y-2 rounded-2xl border border-tk-turmeric/30 bg-tk-turmeric-soft p-4 text-sm text-tk-turmeric-deep"
            >
              {!shareMessage && (
                <p className="font-semibold">
                  {locale === 'vi'
                    ? 'Thực đơn đã có phiên bản mới. Tải lại trước khi cập nhật danh sách đi chợ.'
                    : 'A newer plan is available. Load it before updating shopping.'}
                </p>
              )}
              <Button
                variant="outline"
                disabled={!!model.busy || shareBusy}
                onClick={() => void reloadPlan()}
              >
                {locale === 'vi' ? 'Tải thực đơn mới nhất' : 'Load latest plan'}
              </Button>
            </div>
          )}

          <Link
            className="planning-text-link inline-flex min-h-11 items-center text-sm font-extrabold text-tk-jade-deep underline"
            to="/shopping"
          >
            {locale === 'vi' ? 'Mở danh sách và chỉnh lượng' : 'Open and edit the list'}
          </Link>
        </BentoCard>
      )}

      <details className="planning-diagnostics planning-price-options rounded-2xl border border-tk-stone bg-tk-sunken/70 p-4">
        <summary className="cursor-pointer text-sm font-extrabold text-tk-ink">
          {locale === 'vi'
            ? 'Ước tính giá & ngân sách (tuỳ chọn)'
            : 'Price estimates and budget (optional)'}
        </summary>
        <BentoCard tone="ceramic" padding="md" className="planning-shopping-form mt-4">
          <h2 className="flex items-center gap-2 font-heading text-xl font-extrabold text-tk-ink">
            <NavShoppingIcon size={22} tone="jade" active />
            {t.shopping}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-tk-secondary">{t.shoppingIntro}</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <fieldset disabled={!!model.busy || !fresh} className="space-y-4 disabled:opacity-60">
              <div className="planning-pair grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-tk-ink">
                  {t.currency}
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as MoneyDto['currency'])}
                    className={plannerInputClass}
                  >
                    {['VND', 'JPY', 'USD', 'EUR'].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-tk-ink">
                  {t.budget}
                  <input
                    name="budget"
                    autoComplete="off"
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? 'budget-error' : undefined}
                    inputMode="decimal"
                    value={budget}
                    maxLength={100}
                    onChange={(e) => setBudget(e.target.value)}
                    className={plannerInputClass}
                    placeholder="—"
                  />
                </label>
              </div>
              <label className="block text-sm font-semibold text-tk-ink">
                {t.budgetMode}
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                  className={plannerInputClass}
                >
                  <option value="hard">{t.hard}</option>
                  <option value="soft">{t.soft}</option>
                </select>
              </label>
            </fieldset>
            {invalid && (
              <p
                id="budget-error"
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="planning-error rounded-2xl border border-tk-berry/30 bg-tk-berry-soft p-3.5 text-sm font-semibold text-tk-berry-deep"
              >
                {t.budgetInvalid}
              </p>
            )}
            <Button fullWidth type="submit" disabled={!fresh} isLoading={!!model.busy}>
              {t.optimize}
            </Button>
          </form>
          {model.busy === 'shopping' && (
            <p role="status" className="mt-3 text-sm font-bold text-tk-jade-deep">
              {t.optimizing}
            </p>
          )}
        </BentoCard>
      </details>

      {response && <ShoppingResult key={response.result.id} response={response} locale={locale} />}

      {!fresh && (
        <Link
          className="inline-flex min-h-11 items-center text-sm font-extrabold text-tk-jade-deep underline"
          to={`/planner/${plan.id}`}
        >
          {t.back}
        </Link>
      )}
    </>
  );
}

export function ShoppingResult({
  response,
  locale,
}: {
  response: Shopping;
  locale: PlannerLocale;
}) {
  const t = plannerCopy[locale];
  const result = response.result;
  const complete =
    result.cost.status === 'known' &&
    result.cost.totalCost !== null &&
    result.shoppingCompleteness === 'complete';

  return (
    <div className="planning-shopping-result space-y-4" data-testid="shopping-result">
      <section
        className="planning-cost-summary space-y-2.5 rounded-[26px] border border-white/10 bg-tk-sanctuary-card p-6 text-white shadow-elevated"
        aria-label={t.knownTotal}
      >
        <div className="flex items-center gap-2">
          <BudgetCoinJarIcon size={20} tone="turmeric" active />
          <h2 className="text-sm font-bold text-white/85">
            {complete ? t.completeTotal : t.knownTotal}
          </h2>
        </div>
        {result.cost.status === 'unknown' ? (
          <p className="text-lg font-extrabold leading-snug">{t.priceUnavailable}</p>
        ) : (
          <p className="break-all font-heading text-3xl font-extrabold tk-tabular">
            {formatMoney(complete ? result.cost.totalCost : result.cost.knownCost, locale)}
          </p>
        )}
        {result.cost.unknownCostItemCount > 0 && (
          <p className="text-sm text-white/80">
            {result.cost.unknownCostItemCount} {t.unknownPrices}
          </p>
        )}
        <p
          className="border-t border-white/15 pt-3 text-sm font-bold"
          data-testid="budget-status"
        >
          {budgetStatusLabel(result.budget.status, locale)}
        </p>
        <p className="text-sm text-white/85" data-testid="shopping-status">
          {shoppingStatusLabel(result.shoppingStatus, locale)}
        </p>
        {result.budget.status === 'over_budget' && (
          <p className="text-sm font-bold text-tk-turmeric">
            {t.gap}: {formatMoney(result.budget.selectedKnownGap, locale)}
          </p>
        )}
        {!result.optimization.exhaustive && (
          <p className="text-xs text-white/75">{t.bestKnown}</p>
        )}
      </section>

      {response.catalogStatus === 'reviewed_catalog_unavailable' && (
        <p className="rounded-2xl border border-tk-turmeric/30 bg-tk-turmeric-soft p-4 text-sm font-semibold text-tk-turmeric-deep">
          {t.noPrices}
        </p>
      )}
      {result.shoppingCompleteness !== 'complete' && (
        <p className="rounded-2xl border border-tk-turmeric/30 bg-tk-turmeric-soft p-4 text-sm font-semibold text-tk-turmeric-deep">
          {t.shoppingPartial}
        </p>
      )}

      <section className="planning-requirements space-y-3">
        <div>
          <h2 className="font-heading text-lg font-extrabold text-tk-ink">{t.list}</h2>
          <p className="mt-0.5 text-xs text-tk-muted">
            {locale === 'vi'
              ? 'Xem lượng và giá tham khảo tại đây; đánh dấu đã mua trong danh sách dùng chung.'
              : 'Review quantities and prices here; mark purchases in the shared list.'}
          </p>
        </div>
        {[...result.requirements, ...result.optionalRequirements].map((requirement) => {
          const line = result.purchaseLines.find((item) => item.requirementId === requirement.id);
          const unresolved = result.unresolvedRequirements.find(
            (item) => item.requirementId === requirement.id,
          );
          return (
            <BentoCard
              key={requirement.id}
              tone="ceramic"
              padding="sm"
              className="planning-purchase-row"
            >
              <div className="flex min-h-11 items-start gap-3">
                <span className="min-w-0">
                  <span className="text-sm font-extrabold text-tk-ink">
                    {ingredientLabel(requirement.ingredientId, locale)}
                  </span>
                  {requirement.optional && (
                    <span className="block text-xs text-tk-muted">{t.optional}</span>
                  )}
                  <span className="mt-1 block text-sm font-semibold text-tk-secondary">
                    {t.required}: {formatQuantity(requirement.required, locale)}
                  </span>
                </span>
              </div>
              {requirement.status === 'unresolved' && (
                <p className="mt-2 text-sm font-semibold text-tk-turmeric-deep">{t.unresolved}</p>
              )}
              {line && line.selectedPackages.length > 0 ? (
                <div className="mt-3 space-y-2 border-t border-tk-stone/70 pt-3 text-sm">
                  <p className="text-xs font-bold text-tk-muted">{t.selectedPackages}</p>
                  {line.selectedPackages.map((pack) => (
                    <p
                      key={pack.purchaseOptionId}
                      className="flex flex-wrap justify-between gap-2 font-semibold text-tk-ink"
                    >
                      <span>
                        {pack.packageCount} × {formatQuantity(pack.packageContent, locale)}
                      </span>
                      <span className="tk-tabular">{formatMoney(pack.lineCost, locale)}</span>
                    </p>
                  ))}
                  <p className="text-xs text-tk-secondary">
                    {t.surplus}: {formatQuantity(line.surplus, locale)}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs font-semibold text-tk-turmeric-deep">
                  {requirement.optional
                    ? t.optionalNotPurchased
                    : unresolved
                      ? reasonLabel(unresolved.code, locale)
                      : t.priceUnavailable}
                </p>
              )}
              <p className="mt-3 text-xs text-tk-muted">
                {[...new Set(requirement.sourceMealSlots.map((slot) => slot.date))].join(' · ')}
              </p>
            </BentoCard>
          );
        })}
        {!result.requirements.length && !result.optionalRequirements.length && (
          <BentoCard tone="sunken" padding="sm">
            <p className="text-sm text-tk-secondary">{t.noShopping}</p>
          </BentoCard>
        )}
      </section>

      {result.budget.largestKnownCostDrivers.length > 0 && (
        <BentoCard tone="ceramic" padding="md">
          <h2 className="font-heading text-base font-extrabold text-tk-ink">{t.largestCosts}</h2>
          <ul className="mt-3 space-y-2.5 text-sm">
            {result.budget.largestKnownCostDrivers.map((item) => (
              <li key={item.ingredientId} className="flex justify-between gap-3">
                <span className="font-semibold text-tk-ink">
                  {ingredientLabel(item.ingredientId, locale)}
                </span>
                <span className="break-all font-bold text-tk-ink tk-tabular">
                  {formatMoney(item.knownCost, locale)}
                </span>
              </li>
            ))}
          </ul>
        </BentoCard>
      )}

      <BentoCard tone="sunken" padding="md">
        <h2 className="font-heading text-base font-extrabold text-tk-ink">{t.waste}</h2>
        <div className="mt-3 space-y-2 text-sm text-tk-secondary">
          {result.wasteSummary.existingAtRiskLotCount > 0 ||
          result.wasteSummary.purchaseAtRiskSurplusCount > 0 ? (
            <p>{t.wasteAtRisk}</p>
          ) : (
            result.wasteSummary.assessedItemCount > 0 && <p>{t.wasteNone}</p>
          )}
          {(result.wasteSummary.unknownRiskItemCount > 0 ||
            result.wasteSummary.assessedItemCount === 0) && <p>{t.wasteUnknown}</p>}
          <p>{t.wasteNote}</p>
          {result.purchaseSurplus.map((item) => (
            <p key={`${item.requirementId}:${item.purchaseOptionId}`} className="text-xs">
              {ingredientLabel(item.ingredientId, locale)}: {formatQuantity(item.quantity, locale)}{' '}
              · {wasteRiskLabel(item.risk.status, locale)}
            </p>
          ))}
        </div>
      </BentoCard>

      {(result.optimization.truncated || result.optimization.incompleteReasons.length > 0) && (
        <details className="rounded-2xl border border-tk-stone bg-tk-sunken/70 p-4 text-sm text-tk-secondary">
          <summary className="cursor-pointer font-bold text-tk-ink">{t.diagnostics}</summary>
          <p className="mt-2">{t.bestKnown}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {[
              ...new Set([
                ...result.optimization.limitReasons,
                ...result.optimization.incompleteReasons,
              ]),
            ].map((code) => (
              <li key={code}>{reasonLabel(code, locale)}</li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-tk-muted">
        {t.priceAsOf}{' '}
        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(response.priceAsOf),
        )}
        . {t.checklistNote}
      </p>
    </div>
  );
}
