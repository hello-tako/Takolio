import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Clock, Lock, RefreshCw, Users } from 'lucide-react';
import type { MealPlanDto } from '../../../../packages/domain/src/meal-planning-api';
import type {
  MealComponentDto,
  MealCompositionDto,
  PickerItemDto,
} from '../../../../packages/domain/src/meal-composition-api';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { SaveRecipeButton } from '../../components/common/SaveRecipeButton';
import { plannerCopy, type PlannerLocale } from './copy';
import { plannerStatusLabel, plannerConclusionLabel, reasonLabel } from './presentation';
import type { usePlanner } from './usePlanner';
import {
  compositionCopy,
  compositionUnavailable,
  componentTitle,
  isMealCompositionEnabled,
  roleLabel,
  usePlanCompositions,
} from './composition';
import { ComponentPicker } from './ComponentPicker';
import { mealCompositionApi } from '../../services/meal-composition';
import { CompositionLoadState } from './CompositionLoadState';
import { MealTimeNotice } from './MealTimeNotice';
import { MealStyleNotice } from './MealStyleNotice';
import { compositionState } from './composition-state';
import { FamilyPlanNotice } from './FamilyPlanNotice';
import { isPlannerSlotElapsed, plannerSlotTime } from './schedule';

function DishCard({
  composition,
  locale,
  planId,
  slotId,
  disabled,
  elapsed,
  onSwap,
  onLock,
}: {
  composition: MealCompositionDto;
  locale: PlannerLocale;
  planId: string;
  slotId: string;
  disabled: boolean;
  elapsed: boolean;
  onSwap: (item: MealComponentDto) => void;
  onLock: (item: MealComponentDto) => void;
}) {
  const c = compositionCopy[locale];
  const missing = new Set(composition.missingRoles);
  return (
    <div className="planning-composition-card">
      <ul className="planning-dish-list" aria-label={c.heading}>
        {composition.components.map((component) => {
          const title = componentTitle(component, locale);
          const status = component.projection?.status;
          return (
            <li key={component.id} className="planning-dish-row">
              <div className="planning-dish-copy">
                <strong>{title}</strong>
                <span className="planning-dish-meta">
                  <span>{roleLabel(component.role, locale)}</span>
                  {component.locked && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <Lock size={12} aria-hidden="true" /> <span>{c.locked}</span>
                    </>
                  )}
                  {status === 'covered' && (
                    <span className="dish-status is-covered"> · {c.covered}</span>
                  )}
                  {status === 'needs_shopping' && (
                    <span className="dish-status is-shopping"> · {c.needsShopping}</span>
                  )}
                  {status === 'unresolved' && (
                    <span className="dish-status is-warning"> · {c.unresolved}</span>
                  )}
                  {status === 'not_tracked' && (
                    <span className="dish-status"> · {c.notTracked}</span>
                  )}
                </span>
              </div>
              <div className="planning-dish-actions">
                {component.recipeId && (
                  <SaveRecipeButton recipeId={component.recipeId} title={title} compact />
                )}
                <button
                  type="button"
                  className="planning-icon-button"
                  disabled={disabled}
                  aria-label={`${component.locked ? c.unlock : c.lock}: ${title}`}
                  aria-pressed={component.locked}
                  onClick={() => onLock(component)}
                >
                  <Lock size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="planning-icon-button"
                  disabled={disabled}
                  aria-label={`${c.swapDish}: ${title}`}
                  onClick={() => onSwap(component)}
                >
                  <RefreshCw size={15} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <MealStyleNotice warnings={composition.warnings} locale={locale} />
      <MealTimeNotice warnings={composition.warnings} locale={locale} />
      {composition.source === 'v2' && missing.size > 0 && (
        <div className="planning-missing-roles">
          <p>
            {locale === 'vi' ? 'Bữa còn thiếu nhóm món:' : 'Meal groups still missing:'}{' '}
            {Array.from(missing)
              .map((role) => roleLabel(role, locale))
              .join(' · ')}
          </p>
          <Link
            className="planning-text-link"
            to={`/planner/${planId}/meal/${encodeURIComponent(slotId)}`}
          >
            {elapsed ? c.detail : c.addDish}
          </Link>
        </div>
      )}
    </div>
  );
}

export function PlannerWeek({
  plan,
  model,
  locale,
}: {
  plan: MealPlanDto;
  model: ReturnType<typeof usePlanner>;
  locale: PlannerLocale;
}) {
  const t = plannerCopy[locale];
  const [confirm, setConfirm] = useState(false);
  const [picker, setPicker] = useState<{ slotId: string; component: MealComponentDto } | null>(
    null,
  );
  async function mutate(slotId: string, operation: () => Promise<unknown>) {
    if (isPlannerSlotElapsed(plan, slotId)) {
      setPicker(null);
      return;
    }
    const result = await model.perform('composition-change', operation);
    if (result) {
      setPicker(null);
      await model.perform('refresh', () => model.loadPlan(plan.id), model.replacePlan);
    }
  }
  function choose(item: PickerItemDto) {
    if (!picker || isPlannerSlotElapsed(plan, picker.slotId)) return;
    const target =
      item.kind === 'recipe'
        ? { kind: 'recipe' as const, recipeId: item.id }
        : { kind: 'simple_food' as const, simpleFoodId: item.id };
    void mutate(picker.slotId, () =>
      mealCompositionApi.swap(plan.id, picker.slotId, picker.component.id, {
        revision: plan.revision,
        target,
        role: picker.component.role,
        locked: true,
      }),
    );
  }
  const days = [...new Set(plan.intent.slots.map((slot) => slot.date))].sort();
  const composing = isMealCompositionEnabled();
  const compositions = usePlanCompositions(plan, composing);
  const matchingCompositions =
    compositions.data?.planId === plan.id && compositions.data.planRevision === plan.revision;
  const revisionChanged =
    compositions.isSuccess &&
    compositions.data.planId === plan.id &&
    compositions.data.planRevision !== plan.revision;
  const compositionFor = (slotId: string) =>
    matchingCompositions
      ? compositions.data?.compositions.find((entry) => entry.slotId === slotId)
      : undefined;
  const legacy = !composing || compositionUnavailable(compositions.error);
  const missing =
    !legacy &&
    plan.intent.slots.some(
      (slot) => !compositionFor(`${slot.date}:${slot.mealType}:${slot.sequence ?? 0}`),
    );
  const past =
    plan.freshness.reasons.includes('planning_time_elapsed') ||
    plan.intent.slots.some((slot) =>
      isPlannerSlotElapsed(plan, `${slot.date}:${slot.mealType}:${slot.sequence ?? 0}`),
    );
  const uncertain = !legacy && (!compositions.isSuccess || compositions.isFetching || missing);
  const currentCompositions = plan.intent.slots.flatMap((slot) => {
    const composition = compositionFor(`${slot.date}:${slot.mealType}:${slot.sequence ?? 0}`);
    return composition ? [composition] : [];
  });
  const states = currentCompositions.map(compositionState);
  const hasOneDishMeal = currentCompositions.some((composition) =>
    composition.warnings.includes('MANUAL_ONE_DISH_MEAL'),
  );
  const legacySummary = legacy || (!uncertain && states.every((state) => state === 'legacy'));
  const completeCount = states.filter((state) => state === 'complete').length;
  const reviewOnly =
    states.length > 0 && states.every((state) => state === 'complete' || state === 'review');
  const summaryStatus = legacySummary
    ? `${locale === 'vi' ? 'Kế hoạch món chính' : 'Main-dish plan'} · ${plannerStatusLabel(plan.result.status, locale)}`
    : uncertain
      ? locale === 'vi'
        ? 'Chưa xác nhận đủ món'
        : 'Dish completeness not confirmed'
      : completeCount === plan.intent.slots.length
        ? locale === 'vi'
          ? hasOneDishMeal
            ? 'Đã xếp món cho các bữa'
            : 'Đã xếp đủ nhóm món'
          : hasOneDishMeal
            ? 'Dishes are planned for each meal'
            : 'All required dish groups are present'
        : reviewOnly
          ? locale === 'vi'
            ? 'Cần kiểm tra lại bữa ăn'
            : 'Meals need review'
          : locale === 'vi'
            ? 'Còn bữa cần hoàn thiện'
            : 'Some meals still need completing';
  const summaryNote = legacySummary
    ? locale === 'vi'
      ? `${plan.result.meals.length} bữa đã chọn món chính`
      : `Main dishes chosen for ${plan.result.meals.length} meals`
    : uncertain
      ? locale === 'vi'
        ? 'Đang chờ xác nhận các món trong phiên bản hiện tại.'
        : 'Waiting to confirm dishes in the current revision.'
      : locale === 'vi'
        ? hasOneDishMeal
          ? `${completeCount}/${plan.intent.slots.length} bữa đã xếp đủ món theo kiểu ăn đã chọn; nguyên liệu được kiểm tra riêng.`
          : `${completeCount}/${plan.intent.slots.length} bữa đủ nhóm món; nguyên liệu được kiểm tra riêng.`
        : hasOneDishMeal
          ? `${completeCount}/${plan.intent.slots.length} meals have dishes for the chosen meal style; ingredients are checked separately.`
          : `${completeCount}/${plan.intent.slots.length} meals have all required groups; ingredients are checked separately.`;
  const boardMeals = [
    ...plan.result.meals.filter((meal) => {
      const composition = legacy ? undefined : compositionFor(meal.slotId);
      return !(composition?.mode === 'manual' && composition.components.length === 0);
    }),
    ...(!legacy && compositions.isSuccess ? currentCompositions : [])
      .filter(
        (composition) =>
          composition.components.length > 0 &&
          !plan.result.meals.some((meal) => meal.slotId === composition.slotId),
      )
      .map((composition) => {
        const slot = plan.intent.slots.find(
          (entry) =>
            `${entry.date}:${entry.mealType}:${entry.sequence ?? 0}` === composition.slotId,
        );
        return {
          slotId: composition.slotId,
          date: composition.date,
          mealType: composition.mealType,
          time: slot?.time ?? '',
          title: t[composition.mealType],
          servings: composition.servings,
          cookTimeMinutes: null,
          reasons: [],
          requirements: [],
        };
      }),
  ];
  const boardSlots = plan.intent.slots
    .map((slot) => {
      const slotId = `${slot.date}:${slot.mealType}:${slot.sequence ?? 0}`;
      return {
        ...slot,
        slotId,
        time: plannerSlotTime(plan, slotId) ?? '',
      };
    })
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.time.localeCompare(right.time) ||
        (left.sequence ?? 0) - (right.sequence ?? 0) ||
        left.slotId.localeCompare(right.slotId),
    );
  return (
    <>
      <div className="planning-board-summary">
        <div>
          <p className="planning-eyebrow">THỰC ĐƠN GIA ĐÌNH</p>
          <p className="planning-board-status" role="status">
            {summaryStatus}
          </p>
          <p className="planning-board-meta">{summaryNote}</p>
        </div>
        <Link className="planning-text-link planning-summary-link" to="/planner/new">
          {t.newPlan}
        </Link>
      </div>
      <FamilyPlanNotice
        plan={plan}
        familyPlan={model.familyPlan}
        warnings={currentCompositions.flatMap((composition) => composition.warnings)}
        locale={locale}
      />
      {legacy && plan.result.conclusion !== 'feasible' && (
        <Card>
          <p role="status" className="text-sm leading-relaxed">
            {plannerConclusionLabel(plan.result.conclusion, locale)}
          </p>
          <Link to="/planner/new" className="planning-text-link">
            {t.settings}
          </Link>
        </Card>
      )}
      {plan.result.search.truncated && <p className="planning-board-warning">{t.limited}</p>}
      {!legacy &&
        (revisionChanged ? (
          <div role="status" className="planning-notice">
            <p>
              {locale === 'vi'
                ? 'Thực đơn đã có phiên bản mới. Tải lại để xem đúng các bữa.'
                : 'A newer plan is available. Load it to see the current meals.'}
            </p>
            <Button
              className="mt-3"
              variant="outline"
              disabled={!!model.busy}
              onClick={() =>
                void model.perform('refresh', () => model.loadPlan(plan.id), model.replacePlan)
              }
            >
              {locale === 'vi' ? 'Tải thực đơn mới nhất' : 'Load latest plan'}
            </Button>
          </div>
        ) : (
          <CompositionLoadState query={compositions} locale={locale} missing={missing} />
        ))}
      <div className="planning-day-board">
        {days.map((date) => (
          <section key={date} className="planning-day">
            <h2 className="planning-day-heading">
              <CalendarDays size={16} aria-hidden="true" />
              {new Intl.DateTimeFormat(locale, {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              }).format(new Date(`${date}T12:00:00Z`))}
            </h2>
            {boardSlots
              .filter((slot) => slot.date === date)
              .map((slot) => {
                const composition = legacy ? undefined : compositionFor(slot.slotId);
                const slotElapsed = isPlannerSlotElapsed(plan, slot.slotId);
                if (composition?.mode === 'manual' && composition.components.length === 0) {
                  return (
                    <Card
                      key={composition.slotId}
                      className="planning-meal-card planning-manual-empty"
                    >
                      <p className="planning-meal-label">
                        {t[composition.mealType]} · {slot.time} · {composition.servings} {t.people}
                      </p>
                      <h3 className="planning-meal-name">
                        {locale === 'vi'
                          ? slotElapsed
                            ? 'Bữa đã qua chưa được xếp món'
                            : 'Bữa này chờ bạn chọn món'
                          : slotElapsed
                            ? 'No dishes planned for this past meal'
                            : 'Choose dishes for this meal'}
                      </h3>
                      <p className="text-sm text-semantic-text-secondary mt-2">
                        {locale === 'vi'
                          ? slotElapsed
                            ? 'Giữ nguyên bữa đã qua. Bạn có thể tiếp tục xếp món cho những bữa sắp tới.'
                            : 'Chọn từ món đã lưu hoặc nguyên liệu đang có. Bạn có thể nhờ Takosan hoàn thiện sau.'
                          : slotElapsed
                            ? 'Past meals stay unchanged. Continue choosing dishes for future meals.'
                            : 'Use saved dishes or your fridge. Takosan can help complete the meal later.'}
                      </p>
                      <Link
                        className="planning-primary-link mt-3"
                        to={`/planner/${plan.id}/meal/${encodeURIComponent(composition.slotId)}`}
                      >
                        {slotElapsed
                          ? locale === 'vi'
                            ? 'Xem bữa này'
                            : 'View meal'
                          : locale === 'vi'
                            ? 'Chọn món cho bữa này'
                            : 'Choose dishes'}
                      </Link>
                    </Card>
                  );
                }
                const meal = boardMeals.find((entry) => entry.slotId === slot.slotId);
                if (!meal) {
                  const unplanned = plan.result.unplannedSlots.find(
                    (entry) => entry.slotId === slot.slotId,
                  );
                  if (!unplanned || (!legacy && composition?.components.length)) return null;
                  return (
                    <div className="planning-unplanned" key={slot.slotId}>
                      <h3>
                        {t[slot.mealType]} · {slot.time} · {t.unplanned}
                      </h3>
                      <ul>
                        {unplanned.reasons.map((code) => (
                          <li key={code}>{reasonLabel(code, locale)}</li>
                        ))}
                      </ul>
                      {composing && (
                        <Link
                          className="planning-text-link"
                          to={`/planner/${plan.id}/meal/${encodeURIComponent(slot.slotId)}`}
                        >
                          {slotElapsed
                            ? compositionCopy[locale].detail
                            : compositionCopy[locale].addDish}
                        </Link>
                      )}
                    </div>
                  );
                }
                return (
                  <Card key={meal.slotId} className="planning-meal-card" data-testid="planned-meal">
                    <div className="planning-meal-card-head">
                      <div>
                        <p className="planning-meal-label">
                          {t[meal.mealType]}
                          {slot.time && <> · {slot.time}</>}
                          {slotElapsed && (
                            <>
                              {' '}
                              · {locale === 'vi' ? 'Đã qua giờ dự kiến' : 'Scheduled time passed'}
                            </>
                          )}
                        </p>
                        <h3 className="planning-meal-name">
                          {legacy
                            ? meal.title
                            : !composition
                              ? t[meal.mealType]
                              : `${composition.components.length} ${locale === 'vi' ? 'món' : 'dishes'} · ${meal.servings} ${t.people}`}
                        </h3>
                      </div>
                      <Link
                        aria-label={`${compositionCopy[locale].detail}: ${meal.title}`}
                        className="planning-icon-link"
                        to={`/planner/${plan.id}/meal/${encodeURIComponent(meal.slotId)}`}
                      >
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                    {composition ? (
                      <DishCard
                        composition={composition}
                        locale={locale}
                        planId={plan.id}
                        slotId={meal.slotId}
                        disabled={!!model.busy || slotElapsed}
                        elapsed={slotElapsed}
                        onSwap={(component) => setPicker({ slotId: meal.slotId, component })}
                        onLock={(component) =>
                          void mutate(meal.slotId, () =>
                            mealCompositionApi.update(plan.id, meal.slotId, component.id, {
                              revision: plan.revision,
                              locked: !component.locked,
                            }),
                          )
                        }
                      />
                    ) : legacy ? (
                      <div className="planning-legacy-meal-meta">
                        <span>
                          <Users size={14} /> {meal.servings} {t.people}
                        </span>
                        <span>
                          <Clock size={14} />{' '}
                          {meal.cookTimeMinutes === null
                            ? t.unknownTime
                            : `${meal.cookTimeMinutes} ${t.minutes}`}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-semantic-text-muted">
                        {compositions.isPending
                          ? compositionCopy[locale].loadingDishes
                          : compositionCopy[locale].loadFailed}
                      </p>
                    )}
                    {legacy && meal.reasons.length > 0 && (
                      <p className="planning-note">{reasonLabel(meal.reasons[0], locale)}</p>
                    )}
                    {legacy && (
                      <p className="planning-meal-availability">
                        {meal.requirements.some(
                          (item) => !item.optional && item.status === 'unresolved',
                        )
                          ? t.quantityReview
                          : meal.requirements.some(
                                (item) => !item.optional && item.status !== 'satisfied',
                              )
                            ? t.needsShopping
                            : t.available}
                      </p>
                    )}
                  </Card>
                );
              })}
          </section>
        ))}
      </div>
      <details className="planning-diagnostics">
        <summary>{t.diagnostics}</summary>
        <p>
          {t.revision} <span data-testid="plan-revision">{plan.revision}</span>
        </p>
        <p>{t.rejectionNote}</p>
        <ul>
          {[
            ...new Set([
              ...plan.result.search.limitReasons,
              ...plan.result.search.incompleteReasons.map((item) => item.code),
              ...plan.result.search.rejections.map((item) => item.code),
            ]),
          ].map((code) => (
            <li key={code}>{reasonLabel(code, locale)}</li>
          ))}
        </ul>
        <p>{t.safety}</p>
      </details>
      <div className="planning-board-actions">
        <Link to={`/planner/${plan.id}/shopping`} className="planning-primary-link">
          {t.shopping}
        </Link>
        <Button
          variant="outline"
          fullWidth
          disabled={!!model.busy || past || uncertain}
          onClick={() => setConfirm(true)}
        >
          <RefreshCw size={16} className="mr-2" />
          {t.regenerate}
        </Button>
      </div>
      {model.busy === 'regenerate' && (
        <p role="status" className="planning-board-status">
          {t.generating}
        </p>
      )}
      {picker && !isPlannerSlotElapsed(plan, picker.slotId) && (
        <ComponentPicker
          locale={locale}
          busy={!!model.busy}
          mutationError={model.error}
          initialRole={picker.component.role}
          intent="swap"
          context={(() => {
            const slot = plan.intent.slots.find(
              (entry) => `${entry.date}:${entry.mealType}:${entry.sequence ?? 0}` === picker.slotId,
            );
            return slot
              ? {
                  date: slot.date,
                  mealType: slot.mealType,
                  servings: slot.servings ?? plan.intent.defaultServings,
                }
              : undefined;
          })()}
          scope={{
            planId: plan.id,
            slotId: picker.slotId,
            revision: plan.revision,
            excludeComponentId: picker.component.id,
          }}
          onChoose={choose}
          onClose={() => setPicker(null)}
          onReloadPlan={() => {
            setPicker(null);
            void model.perform('refresh', () => model.loadPlan(plan.id), model.replacePlan);
          }}
        />
      )}
      <ConfirmDialog
        open={confirm}
        title={t.regenerateTitle}
        description={
          locale === 'vi'
            ? 'Takosan sẽ gợi ý lại các bữa chưa khoá. Các món đã khoá được giữ nguyên; nguyên liệu sẽ được kiểm tra lại sau đó.'
            : t.regenerateText
        }
        confirmText={t.confirm}
        cancelText={t.cancel}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void model.perform(
            'regenerate',
            () => model.regenerate(plan.id, plan.revision),
            model.replacePlan,
          );
        }}
      />
    </>
  );
}
