import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, Lock, RefreshCw, Users } from 'lucide-react';
import type { MealPlanDto } from '../../../../packages/domain/src/meal-planning-api';
import type {
  MealComponentDto,
  MealCompositionDto,
  PickerItemDto,
} from '../../../../packages/domain/src/meal-composition-api';
import { Button } from '../../components/common/Button';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { SaveRecipeButton } from '../../components/common/SaveRecipeButton';
import {
  AtelierBadge,
  BentoCard,
  RadialProgressRing,
} from '../../design-system/v4/AtelierPrimitives';
import {
  CalendarMealCheckIcon,
  FreshnessShieldIcon,
  HouseholdTrayIcon,
  NavShoppingIcon,
  WokFlameIcon,
} from '../../design-system/icons';
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
import { DishThumbV4, RolePillIcon, rolePillClasses } from './roleVisual';

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
    <div className="planning-composition-card mt-3 space-y-2.5">
      <ul className="planning-dish-list space-y-2" aria-label={c.heading}>
        {composition.components.map((component) => {
          const title = componentTitle(component, locale);
          const status = component.projection?.status;
          return (
            <li
              key={component.id}
              className="planning-dish-row flex items-center justify-between gap-2.5 rounded-2xl border border-tk-stone/80 bg-tk-canvas/85 p-2.5 transition-colors hover:bg-white"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <DishThumbV4
                  item={{
                    id: component.id,
                    recipeId: component.recipeId,
                    simpleFoodId: component.simpleFoodId,
                    title,
                    role: component.role,
                  }}
                  sizeClassName="h-11 w-11 rounded-xl"
                />
                <div className="planning-dish-copy min-w-0">
                  <strong className="block truncate text-sm font-extrabold text-tk-ink">
                    {title}
                  </strong>
                  <span className="planning-dish-meta mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-tk-secondary">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold ${rolePillClasses(component.role)}`}
                    >
                      <RolePillIcon role={component.role} size={11} />
                      <span>{roleLabel(component.role, locale)}</span>
                    </span>
                    {component.locked && (
                      <span className="inline-flex items-center gap-0.5 font-semibold text-tk-ink">
                        <span aria-hidden="true"> · </span>
                        <Lock size={11} aria-hidden="true" /> <span>{c.locked}</span>
                      </span>
                    )}
                    {status === 'covered' && (
                      <span className="dish-status is-covered font-bold text-tk-jade-deep">
                        {' '}
                        · {c.covered}
                      </span>
                    )}
                    {status === 'needs_shopping' && (
                      <span className="dish-status is-shopping font-bold text-tk-flame-deep">
                        {' '}
                        · {c.needsShopping}
                      </span>
                    )}
                    {status === 'unresolved' && (
                      <span className="dish-status is-warning font-bold text-tk-turmeric-deep">
                        {' '}
                        · {c.unresolved}
                      </span>
                    )}
                    {status === 'not_tracked' && (
                      <span className="dish-status text-tk-muted"> · {c.notTracked}</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="planning-dish-actions flex shrink-0 items-center gap-1">
                {component.recipeId && (
                  <SaveRecipeButton recipeId={component.recipeId} title={title} compact />
                )}
                <button
                  type="button"
                  className={`planning-icon-button inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors disabled:opacity-45 ${
                    component.locked
                      ? 'border-tk-jade/30 bg-tk-jade-soft text-tk-jade-deep'
                      : 'border-tk-stone bg-white text-tk-secondary hover:bg-tk-sunken hover:text-tk-ink'
                  }`}
                  disabled={disabled}
                  aria-label={`${component.locked ? c.unlock : c.lock}: ${title}`}
                  aria-pressed={component.locked}
                  onClick={() => onLock(component)}
                >
                  <Lock size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="planning-icon-button inline-flex h-9 w-9 items-center justify-center rounded-xl border border-tk-stone bg-white text-tk-secondary transition-colors hover:bg-tk-sunken hover:text-tk-ink disabled:opacity-45"
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
      {composition.warnings.includes('SAVED_CONTENT_REQUIRES_REVALIDATION') && (
        <p
          className="planning-note rounded-xl bg-tk-turmeric-soft px-3 py-1.5 text-xs font-semibold text-tk-turmeric-deep"
          role="status"
        >
          {reasonLabel('SAVED_CONTENT_REQUIRES_REVALIDATION', locale)}
        </p>
      )}
      {composition.source === 'v2' && missing.size > 0 && (
        <div className="planning-missing-roles flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-tk-jade/35 bg-tk-jade-soft/45 px-3.5 py-2.5 text-xs">
          <p className="font-semibold text-tk-jade-deep">
            {locale === 'vi' ? 'Bữa còn thiếu nhóm món:' : 'Meal groups still missing:'}{' '}
            {Array.from(missing)
              .map((role) => roleLabel(role, locale))
              .join(' · ')}
          </p>
          <Link
            className="planning-text-link inline-flex min-h-9 items-center rounded-xl bg-white px-3 py-1.5 font-extrabold text-tk-jade-deep shadow-xs transition-colors hover:bg-tk-jade-soft"
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

  const totalSlots = Math.max(1, plan.intent.slots.length);
  const progressRatio = legacySummary
    ? Math.round((plan.result.meals.length / totalSlots) * 100)
    : uncertain
      ? 0
      : Math.round((completeCount / totalSlots) * 100);

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
      <BentoCard
        tone="jade"
        padding="md"
        className="planning-board-summary flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-4">
          <RadialProgressRing
            value={progressRatio}
            size={60}
            strokeWidth={5}
            tone="jade"
            label={`${progressRatio}%`}
          />
          <div className="space-y-1">
            <AtelierBadge tone="jade" icon={<HouseholdTrayIcon size={13} tone="jade" active />}>
              <span className="planning-eyebrow">THỰC ĐƠN GIA ĐÌNH</span>
            </AtelierBadge>
            <p
              className="planning-board-status font-heading text-lg font-extrabold text-tk-ink sm:text-xl"
              role="status"
            >
              {summaryStatus}
            </p>
            <p className="planning-board-meta text-xs leading-relaxed text-tk-secondary sm:text-sm">
              {summaryNote}
            </p>
          </div>
        </div>
        <Link
          className="planning-text-link planning-summary-link inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl border border-tk-stone bg-white px-4 py-2.5 text-sm font-extrabold text-tk-ink shadow-xs transition-colors hover:bg-tk-sunken"
          to="/planner/new"
        >
          {t.newPlan}
        </Link>
      </BentoCard>

      <FamilyPlanNotice
        plan={plan}
        familyPlan={model.familyPlan}
        warnings={currentCompositions.flatMap((composition) => composition.warnings)}
        locale={locale}
      />

      {legacy && plan.result.conclusion !== 'feasible' && (
        <BentoCard tone="turmeric" padding="md" className="space-y-2">
          <p role="status" className="text-sm font-semibold leading-relaxed text-tk-ink">
            {plannerConclusionLabel(plan.result.conclusion, locale)}
          </p>
          <Link
            to="/planner/new"
            className="planning-text-link inline-flex min-h-11 items-center text-sm font-extrabold text-tk-jade-deep underline"
          >
            {t.settings}
          </Link>
        </BentoCard>
      )}

      {plan.result.search.truncated && (
        <p className="planning-board-warning rounded-2xl border border-tk-turmeric/30 bg-tk-turmeric-soft px-4 py-3 text-xs font-semibold text-tk-turmeric-deep">
          {t.limited}
        </p>
      )}

      {!legacy &&
        (revisionChanged ? (
          <div
            role="status"
            className="planning-notice rounded-2xl border border-tk-turmeric/30 bg-tk-turmeric-soft p-4 text-sm text-tk-turmeric-deep"
          >
            <p className="font-semibold">
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

      <div className="planning-day-board grid gap-5 md:grid-cols-2">
        {days.map((date) => (
          <section
            key={date}
            className="planning-day space-y-3 rounded-[26px] border border-tk-stone/80 bg-gradient-to-b from-white via-tk-canvas to-tk-sunken/60 p-4 shadow-card sm:p-5"
          >
            <h2 className="planning-day-heading flex items-center gap-2 font-heading text-base font-extrabold capitalize text-tk-ink">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-tk-jade-soft text-tk-jade-deep">
                <CalendarMealCheckIcon size={16} tone="jade" active />
              </span>
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
                    <BentoCard
                      key={composition.slotId}
                      tone="sunken"
                      padding="sm"
                      className="planning-meal-card planning-manual-empty border-dashed"
                    >
                      <p className="planning-meal-label text-xs font-bold uppercase tracking-wide text-tk-jade-deep">
                        {t[composition.mealType]} · {slot.time} · {composition.servings} {t.people}
                      </p>
                      <h3 className="planning-meal-name mt-1 font-heading text-base font-extrabold text-tk-ink">
                        {locale === 'vi'
                          ? slotElapsed
                            ? 'Bữa đã qua chưa được xếp món'
                            : 'Bữa này chờ bạn chọn món'
                          : slotElapsed
                            ? 'No dishes planned for this past meal'
                            : 'Choose dishes for this meal'}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-tk-secondary">
                        {locale === 'vi'
                          ? slotElapsed
                            ? 'Giữ nguyên bữa đã qua. Bạn có thể tiếp tục xếp món cho những bữa sắp tới.'
                            : 'Chọn từ món đã lưu hoặc nguyên liệu đang có. Bạn có thể nhờ Takolio hoàn thiện sau.'
                          : slotElapsed
                            ? 'Past meals stay unchanged. Continue choosing dishes for future meals.'
                            : 'Use saved dishes or your fridge. Takolio can help complete the meal later.'}
                      </p>
                      <Link
                        className="planning-primary-link mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-tk-jade px-4 py-2 text-xs font-extrabold text-white shadow-xs transition-colors hover:bg-tk-jade-hover"
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
                    </BentoCard>
                  );
                }

                const meal = boardMeals.find((entry) => entry.slotId === slot.slotId);
                if (!meal) {
                  const unplanned = plan.result.unplannedSlots.find(
                    (entry) => entry.slotId === slot.slotId,
                  );
                  if (!unplanned || (!legacy && composition?.components.length)) return null;
                  return (
                    <div
                      className="planning-unplanned rounded-2xl border border-dashed border-tk-turmeric/40 bg-tk-turmeric-soft/55 p-4 text-sm"
                      key={slot.slotId}
                    >
                      <h3 className="font-heading text-sm font-extrabold text-tk-turmeric-deep">
                        {t[slot.mealType]} · {slot.time} · {t.unplanned}
                      </h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-tk-secondary">
                        {unplanned.reasons.map((code) => (
                          <li key={code}>{reasonLabel(code, locale)}</li>
                        ))}
                      </ul>
                      {composing && (
                        <Link
                          className="planning-text-link mt-3 inline-flex min-h-10 items-center rounded-xl bg-white px-3.5 py-1.5 text-xs font-extrabold text-tk-jade-deep shadow-xs"
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

                const leadCookable = composition?.components.find(
                  (entry) => entry.cookable && entry.recipeId,
                );
                const legacyRecipeId =
                  'source' in meal && meal.source.kind === 'recipe' ? meal.source.id : null;
                const cookStudioHref = leadCookable?.recipeId
                  ? `/cooking/${encodeURIComponent(leadCookable.recipeId)}?servings=${meal.servings}${leadCookable.contentFingerprint ? `&contentFingerprint=${leadCookable.contentFingerprint}` : ''}`
                  : legacyRecipeId
                    ? `/cooking/${encodeURIComponent(legacyRecipeId)}?servings=${meal.servings}`
                    : null;

                return (
                  <BentoCard
                    key={meal.slotId}
                    tone="ceramic"
                    padding="sm"
                    className="planning-meal-card"
                    data-testid="planned-meal"
                  >
                    <div className="planning-meal-card-head flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {legacy && (
                          <DishThumbV4
                            item={{
                              id: legacyRecipeId ?? meal.slotId,
                              recipeId: legacyRecipeId,
                              title: meal.title,
                              role: 'main',
                            }}
                            sizeClassName="h-12 w-12 rounded-2xl"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="planning-meal-label text-xs font-bold uppercase tracking-wide text-tk-jade-deep">
                            {t[meal.mealType]}
                            {slot.time && <> · {slot.time}</>}
                            {slotElapsed && (
                              <>
                                {' '}
                                · {locale === 'vi' ? 'Đã qua giờ dự kiến' : 'Scheduled time passed'}
                              </>
                            )}
                          </p>
                          <h3 className="planning-meal-name mt-0.5 font-heading text-base font-extrabold leading-snug text-tk-ink">
                            {legacy
                              ? meal.title
                              : !composition
                                ? t[meal.mealType]
                                : `${composition.components.length} ${locale === 'vi' ? 'món' : 'dishes'} · ${meal.servings} ${t.people}`}
                          </h3>
                        </div>
                      </div>
                      <Link
                        aria-label={`${compositionCopy[locale].detail}: ${meal.title}`}
                        className="planning-icon-link inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-tk-stone bg-tk-canvas text-tk-ink transition-colors hover:bg-tk-sunken"
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
                      <div className="planning-legacy-meal-meta mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-tk-secondary">
                        <span className="inline-flex items-center gap-1 rounded-full bg-tk-sunken px-2.5 py-1">
                          <Users size={13} /> {meal.servings} {t.people}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-tk-sunken px-2.5 py-1">
                          <Clock size={13} />{' '}
                          {meal.cookTimeMinutes === null
                            ? t.unknownTime
                            : `${meal.cookTimeMinutes} ${t.minutes}`}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-tk-muted">
                        {compositions.isPending
                          ? compositionCopy[locale].loadingDishes
                          : compositionCopy[locale].loadFailed}
                      </p>
                    )}

                    {legacy && meal.reasons.length > 0 && (
                      <p className="planning-note mt-2 text-xs text-tk-secondary">
                        {reasonLabel(meal.reasons[0], locale)}
                      </p>
                    )}

                    {legacy && (
                      <p className="planning-meal-availability mt-2 inline-flex items-center gap-1.5 rounded-full border border-tk-jade/20 bg-tk-jade-soft/65 px-2.5 py-1 text-xs font-bold text-tk-jade-deep">
                        <FreshnessShieldIcon size={12} tone="jade" />
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

                    {cookStudioHref && !slotElapsed && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-tk-stone/70 pt-3">
                        <Link
                          to={cookStudioHref}
                          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-tk-flame px-3.5 py-2 text-xs font-extrabold text-white shadow-xs transition-tap hover:bg-tk-flame-hover"
                        >
                          <WokFlameIcon size={15} tone="flame" active />
                          <span>
                            {locale === 'vi'
                              ? 'Vào bếp đạo diễn bữa này'
                              : 'Direct this meal in Cooking Studio'}
                          </span>
                        </Link>
                        <Link
                          to={`/planner/${plan.id}/meal/${encodeURIComponent(meal.slotId)}`}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-tk-stone bg-tk-canvas px-3 py-2 text-xs font-bold text-tk-ink transition-colors hover:bg-tk-sunken"
                        >
                          {locale === 'vi' ? 'Chỉnh mâm / Phản hồi' : 'Adjust & Feedback'}
                        </Link>
                      </div>
                    )}
                  </BentoCard>
                );
              })}
          </section>
        ))}
      </div>

      <details className="planning-diagnostics rounded-2xl border border-tk-stone bg-tk-sunken/70 p-4 text-xs text-tk-secondary space-y-2">
        <summary className="cursor-pointer text-sm font-bold text-tk-ink">{t.diagnostics}</summary>
        <p className="mt-2 font-semibold text-tk-ink">
          {t.revision} <span data-testid="plan-revision">{plan.revision}</span>
        </p>
        <p>{t.rejectionNote}</p>
        <ul className="list-disc space-y-1 pl-5">
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
        <p className="text-tk-muted">{t.safety}</p>
      </details>

      <div className="planning-board-actions grid gap-3 sm:grid-cols-2">
        <Link
          to={`/planner/${plan.id}/shopping`}
          className="planning-primary-link inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-tk-jade px-5 py-3 text-sm font-extrabold text-white shadow-jade transition-tap hover:bg-tk-jade-hover"
        >
          <NavShoppingIcon size={18} tone="jade" active />
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
        <p
          role="status"
          className="planning-board-status text-center text-sm font-bold text-tk-jade-deep"
        >
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
            ? 'Takolio sẽ gợi ý lại các bữa chưa khoá. Các món đã khoá được giữ nguyên; nguyên liệu sẽ được kiểm tra lại sau đó.'
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
