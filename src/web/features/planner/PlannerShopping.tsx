import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, ShoppingBag } from 'lucide-react';
import type {
  MealPlanDto,
  PlanShoppingDtoSchema,
} from '../../../../packages/domain/src/meal-planning-api';
import type { MoneyDto } from '../../../../packages/domain/src/meal-shopping-api';
import type { z } from 'zod';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
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
    if (familyPreferences.data)
      setTripDays(
        familyPreferences.data.preferences.shoppingCadence === 'daily'
          ? 1
          : familyPreferences.data.preferences.shoppingCadence === 'weekly'
            ? 7
            : 3,
      );
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
          className="rounded-xl bg-semantic-warning-soft p-4 space-y-2"
        >
          <h2 id="untracked-shopping" className="font-semibold text-sm">
            {c.notTracked}
          </h2>
          <p className="text-sm">{c.untrackedShopping}</p>
          <ul className="text-sm">
            {untracked.map(({ meal, item }) => (
              <li key={`${meal.slotId}:${item.id}`}>
                <Link
                  className="inline-flex min-h-11 items-center underline"
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
        <Card className="planning-share-shopping">
          <div className="planning-share-heading">
            <CalendarDays size={20} aria-hidden="true" />
            <div>
              <h2>{locale === 'vi' ? 'Chuẩn bị lượt đi chợ' : 'Prepare your shopping trip'}</h2>
              <p>
                {locale === 'vi'
                  ? 'Chọn khoảng ngày cần mua. Takosan gom phần còn thiếu của các bữa sắp tới theo tủ lạnh hiện tại.'
                  : 'Choose the days to shop for. Takosan combines what upcoming meals still need from your current fridge.'}
              </p>
            </div>
          </div>
          <div className="family-field-pair">
            <label>
              {locale === 'vi' ? 'Mua cho các bữa từ ngày' : 'Meals from'}
              <input
                type="date"
                min={calendarToday}
                value={tripStart}
                onChange={(event) => setTripStart(event.target.value)}
              />
            </label>
            <label>
              {locale === 'vi' ? 'Khoảng đi chợ' : 'Shopping period'}
              <select
                value={tripDays}
                onChange={(event) => setTripDays(Number(event.target.value))}
              >
                <option value={1}>{locale === 'vi' ? '1 ngày' : '1 day'}</option>
                <option value={3}>{locale === 'vi' ? '3 ngày' : '3 days'}</option>
                <option value={7}>{locale === 'vi' ? 'Cả tuần' : 'Full week'}</option>
              </select>
            </label>
          </div>
          <p className="planning-note">
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
            <p className="text-sm text-semantic-text-secondary mt-3" role="status">
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
            <p role="status" className="planning-notice">
              {shareMessage}
            </p>
          )}
          {needsRefresh && (
            <div role="status" className="planning-notice">
              {!shareMessage && (
                <p>
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
          <Link className="planning-text-link" to="/shopping">
            {locale === 'vi' ? 'Mở danh sách và chỉnh lượng' : 'Open and edit the list'}
          </Link>
        </Card>
      )}
      <details className="planning-diagnostics planning-price-options">
        <summary>
          {locale === 'vi'
            ? 'Ước tính giá & ngân sách (tuỳ chọn)'
            : 'Price estimates and budget (optional)'}
        </summary>
        <Card className="planning-shopping-form">
          <h2 className="font-heading font-bold text-xl flex items-center gap-2">
            <ShoppingBag className="text-takosan-green-deep" />
            {t.shopping}
          </h2>
          <p className="text-sm text-semantic-text-secondary mt-2 leading-relaxed">
            {t.shoppingIntro}
          </p>
          <form onSubmit={submit} className="space-y-4 mt-5">
            <fieldset disabled={!!model.busy || !fresh} className="space-y-4 disabled:opacity-60">
              <div className="planning-pair">
                <label className="text-sm font-semibold">
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
                <label className="text-sm font-semibold">
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
              <label className="block text-sm font-semibold">
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
                className="planning-error"
              >
                {t.budgetInvalid}
              </p>
            )}
            <Button fullWidth type="submit" disabled={!fresh} isLoading={!!model.busy}>
              {t.optimize}
            </Button>
          </form>
          {model.busy === 'shopping' && (
            <p role="status" className="text-sm mt-3 text-takosan-green-deep">
              {t.optimizing}
            </p>
          )}
        </Card>
      </details>
      {response && <ShoppingResult key={response.result.id} response={response} locale={locale} />}
      {!fresh && (
        <Link
          className="inline-flex min-h-11 items-center underline text-sm text-takosan-green-deep"
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
    <div className="planning-shopping-result" data-testid="shopping-result">
      <section className="planning-cost-summary" aria-label={t.knownTotal}>
        <h2 className="text-sm text-white">{complete ? t.completeTotal : t.knownTotal}</h2>
        {result.cost.status === 'unknown' ? (
          <p className="font-semibold text-lg leading-snug">{t.priceUnavailable}</p>
        ) : (
          <p className="text-3xl font-heading font-bold break-all">
            {formatMoney(complete ? result.cost.totalCost : result.cost.knownCost, locale)}
          </p>
        )}
        {result.cost.unknownCostItemCount > 0 && (
          <p className="text-sm text-white">
            {result.cost.unknownCostItemCount} {t.unknownPrices}
          </p>
        )}
        <p
          className="text-sm font-semibold border-t border-white/20 pt-3"
          data-testid="budget-status"
        >
          {budgetStatusLabel(result.budget.status, locale)}
        </p>
        <p className="text-sm" data-testid="shopping-status">
          {shoppingStatusLabel(result.shoppingStatus, locale)}
        </p>
        {result.budget.status === 'over_budget' && (
          <p className="text-sm">
            {t.gap}: {formatMoney(result.budget.selectedKnownGap, locale)}
          </p>
        )}
        {!result.optimization.exhaustive && <p className="text-xs text-white">{t.bestKnown}</p>}
      </section>
      {response.catalogStatus === 'reviewed_catalog_unavailable' && (
        <p className="text-sm bg-semantic-warning-soft rounded-xl p-4 text-semantic-warning-strong">
          {t.noPrices}
        </p>
      )}
      {result.shoppingCompleteness !== 'complete' && (
        <p className="text-sm bg-semantic-warning-soft rounded-xl p-4 text-semantic-warning-strong">
          {t.shoppingPartial}
        </p>
      )}
      <section className="planning-requirements">
        <h2 className="font-heading text-lg font-bold">{t.list}</h2>
        <p className="text-xs text-semantic-text-muted">
          {locale === 'vi'
            ? 'Xem lượng và giá tham khảo tại đây; đánh dấu đã mua trong danh sách dùng chung.'
            : 'Review quantities and prices here; mark purchases in the shared list.'}
        </p>
        {[...result.requirements, ...result.optionalRequirements].map((requirement) => {
          const line = result.purchaseLines.find((item) => item.requirementId === requirement.id);
          const unresolved = result.unresolvedRequirements.find(
            (item) => item.requirementId === requirement.id,
          );
          return (
            <Card key={requirement.id} className="planning-purchase-row">
              <div className="flex gap-3 items-start min-h-11">
                <span className="min-w-0">
                  <span className="font-semibold text-sm">
                    {ingredientLabel(requirement.ingredientId, locale)}
                  </span>
                  {requirement.optional && (
                    <span className="block text-xs text-semantic-text-muted">{t.optional}</span>
                  )}
                  <span className="block text-sm mt-1">
                    {t.required}: {formatQuantity(requirement.required, locale)}
                  </span>
                </span>
              </div>
              {requirement.status === 'unresolved' && (
                <p className="text-sm text-semantic-warning-strong mt-2">{t.unresolved}</p>
              )}
              {line && line.selectedPackages.length > 0 ? (
                <div className="mt-3 border-t border-semantic-border/70 pt-3 text-sm space-y-2">
                  <p className="text-xs font-semibold text-semantic-text-muted">
                    {t.selectedPackages}
                  </p>
                  {line.selectedPackages.map((pack) => (
                    <p key={pack.purchaseOptionId} className="flex flex-wrap justify-between gap-2">
                      <span>
                        {pack.packageCount} × {formatQuantity(pack.packageContent, locale)}
                      </span>
                      <span>{formatMoney(pack.lineCost, locale)}</span>
                    </p>
                  ))}
                  <p className="text-xs text-semantic-text-secondary">
                    {t.surplus}: {formatQuantity(line.surplus, locale)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-semantic-warning-strong mt-2">
                  {requirement.optional
                    ? t.optionalNotPurchased
                    : unresolved
                      ? reasonLabel(unresolved.code, locale)
                      : t.priceUnavailable}
                </p>
              )}
              <p className="mt-3 text-xs text-semantic-text-muted">
                {[...new Set(requirement.sourceMealSlots.map((slot) => slot.date))].join(' · ')}
              </p>
            </Card>
          );
        })}
        {!result.requirements.length && !result.optionalRequirements.length && (
          <Card>
            <p className="text-sm">{t.noShopping}</p>
          </Card>
        )}
      </section>
      {result.budget.largestKnownCostDrivers.length > 0 && (
        <Card>
          <h2 className="font-heading font-bold">{t.largestCosts}</h2>
          <ul className="space-y-3 mt-3 text-sm">
            {result.budget.largestKnownCostDrivers.map((item) => (
              <li key={item.ingredientId} className="flex justify-between gap-3">
                <span>{ingredientLabel(item.ingredientId, locale)}</span>
                <span className="break-all">{formatMoney(item.knownCost, locale)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <h2 className="font-heading font-bold">{t.waste}</h2>
        <div className="text-sm text-semantic-text-secondary mt-3 space-y-2">
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
      </Card>
      {(result.optimization.truncated || result.optimization.incompleteReasons.length > 0) && (
        <details className="text-sm border border-semantic-border p-4 rounded-xl">
          <summary className="font-semibold cursor-pointer">{t.diagnostics}</summary>
          <p className="mt-2">{t.bestKnown}</p>
          <ul className="mt-2 text-xs space-y-1">
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
      <p className="text-xs text-semantic-text-muted">
        {t.priceAsOf}{' '}
        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(response.priceAsOf),
        )}
        . {t.checklistNote}
      </p>
    </div>
  );
}
