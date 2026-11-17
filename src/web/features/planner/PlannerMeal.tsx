import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, RefreshCw, Users, X } from 'lucide-react';
import type {
  MealPlanDto,
  PlanFeedbackSchema,
} from '../../../../packages/domain/src/meal-planning-api';
import type { z } from 'zod';
import { Button } from '../../components/common/Button';
import { AtelierBadge, BentoCard } from '../../design-system/v4/AtelierPrimitives';
import {
  AiSousChefSparkIcon,
  AllergenShieldIcon,
  FreshnessShieldIcon,
  HouseholdTrayIcon,
  WokFlameIcon,
} from '../../design-system/icons';
import { mealPlanningApi } from '../../services/meal-planning';
import { ApiError } from '../../services/http';
import { queryKeys } from '../../lib/queryKeys';
import { plannerCopy, type PlannerLocale } from './copy';
import { formatQuantity, ingredientLabel, reasonLabel } from './presentation';
import { PlannerError } from './PlannerShell';
import type { usePlanner } from './usePlanner';
import { MealComposer } from './MealComposer';
import {
  compositionUnavailable,
  isMealCompositionEnabled,
  usePlanCompositions,
} from './composition';
import { CompositionLoadState } from './CompositionLoadState';

export function PlannerMeal({
  plan,
  slotId,
  model,
  locale,
}: {
  plan: MealPlanDto;
  slotId: string;
  model: ReturnType<typeof usePlanner>;
  locale: PlannerLocale;
}) {
  const t = plannerCopy[locale];
  const navigate = useNavigate();
  const location = useLocation();
  const meal = plan.result.meals.find((item) => item.slotId === slotId);
  const [swapOpen, setSwapOpen] = useState(false);
  const [receipts, setReceipts] = useState<string[]>([]);
  const [explanation, setExplanation] = useState<Awaited<
    ReturnType<typeof mealPlanningApi.explanation>
  > | null>(null);
  const [aiFailed, setAiFailed] = useState(false);
  const alternatives = useQuery({
    queryKey: [...queryKeys.mealPlanningAlternatives(plan.id, slotId), plan.revision],
    queryFn: () => mealPlanningApi.alternatives(plan.id, plan.revision),
    enabled: swapOpen,
    retry: false,
  });
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!swapOpen) return;
    const trigger = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [swapOpen]);

  const composing = isMealCompositionEnabled();
  const compositions = usePlanCompositions(plan, composing);
  const slotComposition = compositions.data?.compositions.find((entry) => entry.slotId === slotId);
  const legacyFamily = meal?.source.kind === 'family' && slotComposition?.source !== 'v2';
  const editor = composing && compositions.isSuccess && !legacyFamily;
  const v1Controls = !composing || compositionUnavailable(compositions.error) || legacyFamily;
  const composed = editor && slotComposition?.source === 'v2';
  const slotExists = plan.intent.slots.some(
    (slot) => `${slot.date}:${slot.mealType}:${slot.sequence ?? 0}` === slotId,
  );

  if (
    slotExists &&
    composing &&
    !compositionUnavailable(compositions.error) &&
    (!compositions.isSuccess || !slotComposition)
  ) {
    return (
      <>
        <Link
          className="inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-tk-jade-deep"
          to={`/planner/${plan.id}`}
        >
          <ArrowLeft size={16} />
          {t.back}
        </Link>
        <CompositionLoadState query={compositions} locale={locale} missing={!slotComposition} />
      </>
    );
  }

  if (!meal) {
    return composing && !compositions.isError && slotExists ? (
      <>
        <Link
          className="inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-tk-jade-deep"
          to={`/planner/${plan.id}`}
        >
          <ArrowLeft size={16} />
          {t.back}
        </Link>
        <BentoCard tone="jade" padding="md" className="planning-meal-overview">
          <AtelierBadge tone="jade" icon={<HouseholdTrayIcon size={13} tone="jade" active />}>
            {slotComposition?.date} · {slotComposition ? t[slotComposition.mealType] : ''}
          </AtelierBadge>
          <h2 className="mt-2 font-heading text-2xl font-extrabold text-tk-ink">
            {locale === 'vi' ? 'Chọn món cho bữa này' : 'Choose dishes for this meal'}
          </h2>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-tk-secondary">
            <Users size={15} aria-hidden="true" />
            {slotComposition?.servings ?? plan.intent.defaultServings} {t.people}
          </p>
        </BentoCard>
        <MealComposer
          query={compositions}
          plan={plan}
          slotId={slotId}
          model={model}
          locale={locale}
        />
      </>
    ) : (
      <BentoCard tone="sunken" padding="md" className="space-y-2">
        <p className="text-sm font-semibold text-tk-ink">{t.mealUnavailable}</p>
        <Link
          to={`/planner/${plan.id}`}
          className="inline-flex min-h-11 items-center text-sm font-extrabold text-tk-jade-deep underline"
        >
          {t.back}
        </Link>
      </BentoCard>
    );
  }

  const swappedHere =
    location.state?.swappedRevision === plan.revision && location.state?.swappedSlot === slotId;

  async function feedback(type: z.infer<typeof PlanFeedbackSchema>['type']) {
    const input = { revision: plan.revision, slotId, type };
    const result = await model.perform(type, () =>
      mealPlanningApi.feedback(plan.id, input, model.requestKey(input)),
    );
    if (result) {
      setReceipts((prior) => [...new Set([...prior, type])]);
      await model.query.refetch();
    }
  }

  const codes = explanation?.reasonCodes ?? meal.reasons;
  const elapsed = plan.freshness.reasons.includes('planning_time_elapsed');

  return (
    <>
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-tk-jade-deep"
        to={`/planner/${plan.id}`}
      >
        <ArrowLeft size={16} />
        {t.back}
      </Link>

      <BentoCard tone="jade" padding="md" className="planning-meal-overview">
        <div className="flex flex-wrap items-center gap-2">
          <AtelierBadge tone="jade" icon={<HouseholdTrayIcon size={13} tone="jade" active />}>
            {t[meal.mealType]} · {meal.date}
          </AtelierBadge>
        </div>

        <h2 className="mt-2.5 font-heading text-2xl font-extrabold leading-tight text-tk-ink sm:text-3xl">
          {composed ? t[meal.mealType] : meal.title}
        </h2>

        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-tk-secondary">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1">
            <Users size={15} />
            {meal.servings} {t.people}
          </span>
          {!composed && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1">
              <Clock size={15} />
              {meal.cookTimeMinutes === null
                ? t.unknownTime
                : `${meal.cookTimeMinutes} ${t.minutes}`}
            </span>
          )}
        </div>

        {(!composed || v1Controls) && (
          <div className="mt-5 flex flex-wrap gap-3">
            {!composed && meal.source.kind === 'recipe' && !elapsed && (
              <Link
                to={`/cooking/${encodeURIComponent(meal.source.id)}?servings=${meal.servings}`}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-tk-flame px-5 py-2.5 text-sm font-extrabold text-white shadow-float transition-tap hover:bg-tk-flame-hover"
              >
                <WokFlameIcon size={16} tone="flame" active />
                <span>
                  {locale === 'vi'
                    ? 'Vào bếp đạo diễn bữa này'
                    : 'Direct this meal in Cooking Studio'}
                </span>
              </Link>
            )}
            {v1Controls && (
              <Button
                className="flex-1"
                variant="secondary"
                disabled={!!model.busy || elapsed}
                onClick={() => setSwapOpen(true)}
              >
                <RefreshCw size={16} className="mr-2" />
                {t.swap}
              </Button>
            )}
          </div>
        )}
      </BentoCard>

      {editor && (
        <MealComposer
          query={compositions}
          plan={plan}
          slotId={slotId}
          model={model}
          locale={locale}
        />
      )}

      {!composed && (
        <>
          <BentoCard tone="ceramic" padding="md">
            <div className="flex items-center gap-2">
              <FreshnessShieldIcon size={18} tone="jade" />
              <h3 className="font-heading text-lg font-extrabold text-tk-ink">{t.ingredients}</h3>
            </div>
            <ul className="mt-3 divide-y divide-tk-stone/70">
              {meal.requirements.map((item, index) => (
                <li key={`${item.ingredientId}:${index}`} className="py-3.5">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-sm font-bold text-tk-ink">
                      {ingredientLabel(item.ingredientId, locale)}
                      {item.optional && (
                        <span className="block text-xs font-normal text-tk-muted">{t.optional}</span>
                      )}
                    </span>
                    <span className="text-sm font-extrabold text-tk-ink tk-tabular">
                      {formatQuantity(item.required, locale)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-tk-secondary">
                    {t.covered}: {formatQuantity(item.covered, locale)}
                  </p>
                  {item.status === 'unresolved' || item.missing === null ? (
                    <p className="mt-1.5 text-xs font-bold text-tk-turmeric-deep">{t.unresolved}</p>
                  ) : (
                    item.status !== 'satisfied' && (
                      <p
                        className={`mt-1.5 text-xs font-semibold ${
                          item.optional ? 'text-tk-muted' : 'text-tk-flame-deep'
                        }`}
                      >
                        {t.missing}: {formatQuantity(item.missing, locale)}
                      </p>
                    )
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-2 border-t border-tk-stone/70 pt-3 text-xs text-tk-muted">
              <AllergenShieldIcon size={14} tone="ink" className="mt-0.5 shrink-0" />
              <span>{t.safety}</span>
            </p>
          </BentoCard>

          <BentoCard tone="ceramic" padding="md">
            <h3 className="font-heading text-lg font-extrabold text-tk-ink">{t.instructions}</h3>
            {meal.instructions.length ? (
              <ol className="mt-4 list-decimal space-y-3.5 pl-5 text-sm leading-relaxed text-tk-secondary">
                {meal.instructions.map((step, index) => (
                  <li key={index} className="pl-1">
                    {step}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-tk-muted">{t.noInstructions}</p>
            )}
            <p className="mt-5 border-t border-tk-stone/70 pt-3 text-xs text-tk-muted">
              {t.nutrition}
            </p>
          </BentoCard>

          <BentoCard tone="sunken" padding="md">
            <h3 className="font-heading text-lg font-extrabold text-tk-ink">{t.reasons}</h3>
            <ul className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              {codes.map((code, index) => (
                <li
                  key={`${code}:${index}`}
                  className="rounded-full border border-tk-jade/25 bg-tk-jade-soft px-3 py-1.5 text-tk-jade-deep"
                >
                  {reasonLabel(code, locale)}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="mt-4"
              disabled={!!model.busy}
              onClick={async () => {
                setAiFailed(false);
                const response = await model.perform('explain', () =>
                  mealPlanningApi.explanation(plan.id, { revision: plan.revision, slotId, locale }),
                );
                if (response) setExplanation(response);
                else setAiFailed(true);
              }}
            >
              <AiSousChefSparkIcon size={16} tone="flame" className="mr-2" />
              {t.explain}
            </Button>
            {model.busy === 'explain' && (
              <p role="status" className="mt-2 text-sm font-semibold text-tk-jade-deep">
                {t.explaining}
              </p>
            )}
            {(explanation || aiFailed) && (
              <p role="status" className="mt-3 text-xs font-bold text-tk-jade-deep">
                {explanation?.source === 'ai' ? t.aiUsed : t.fallback}
              </p>
            )}
            <p className="mt-3 text-xs text-tk-muted">{t.aiNote}</p>
          </BentoCard>
        </>
      )}

      <BentoCard tone="ceramic" padding="md">
        <h3 className="font-heading text-lg font-extrabold text-tk-ink">{t.feedback}</h3>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {(
            [
              'liked',
              'disliked',
              'cooked',
              'skipped',
              ...(swappedHere ? ['swapped' as const] : []),
            ] as const
          ).map((type) => (
            <Button
              key={type}
              variant={receipts.includes(type) ? 'secondary' : 'outline'}
              disabled={!!model.busy || receipts.includes(type)}
              onClick={() => void feedback(type)}
            >
              {receipts.includes(type) ? `${t.feedbackSaved}: ` : ''}
              {t[type]}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-xs text-tk-muted">{t.cookedNote}</p>
      </BentoCard>

      {swapOpen && (
        <dialog
          ref={dialog}
          onCancel={(event) => {
            if (model.busy) event.preventDefault();
            else setSwapOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return;
            const buttons =
              event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (
              first &&
              ((event.shiftKey && document.activeElement === first) ||
                (!event.shiftKey && document.activeElement === last))
            ) {
              event.preventDefault();
              (event.shiftKey ? last : first).focus();
            }
          }}
          aria-labelledby="swap-title"
          className="planning-swap-dialog max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg rounded-[24px] border border-tk-stone bg-white p-0 text-tk-ink shadow-elevated backdrop:bg-black/45"
        >
          <div className="p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 id="swap-title" className="font-heading text-xl font-extrabold text-tk-ink">
                {t.chooseAlternative}
              </h2>
              <Button
                variant="ghost"
                aria-label={t.cancel}
                disabled={!!model.busy}
                onClick={() => setSwapOpen(false)}
              >
                <X size={18} />
              </Button>
            </div>
            <p className="mb-4 mt-2 text-xs leading-relaxed text-tk-secondary">
              {t.alternativeNote}
            </p>
            {alternatives.data?.truncated && (
              <p className="mb-3 text-xs font-semibold text-tk-turmeric-deep">
                {t.alternativesLimited}
              </p>
            )}
            {alternatives.isPending ? (
              <p role="status" className="text-sm font-semibold text-tk-secondary">
                {t.loading}
              </p>
            ) : alternatives.isError ? (
              <PlannerError
                error={alternatives.error}
                locale={locale}
                onRetry={() => {
                  if (alternatives.error instanceof ApiError && alternatives.error.status === 409) {
                    void model.perform(
                      'refresh',
                      () => mealPlanningApi.get(plan.id),
                      model.replacePlan,
                    );
                  } else void alternatives.refetch();
                }}
              />
            ) : (
              <ul className="space-y-2">
                {alternatives.data?.alternatives
                  .filter((item) => item.id !== meal.source.id)
                  .map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-tk-stone bg-tk-canvas/70 p-3"
                    >
                      <span className="text-sm font-bold text-tk-ink">{item.title}</span>
                      <Button
                        disabled={!!model.busy}
                        variant="secondary"
                        aria-label={`${t.choose}: ${item.title}`}
                        onClick={async () => {
                          const next = await model.perform(
                            'swap',
                            () =>
                              mealPlanningApi.swap(plan.id, {
                                revision: plan.revision,
                                slotId,
                                replacement: { kind: 'recipe', id: item.id },
                              }),
                            model.replacePlan,
                          );
                          if (next) {
                            setSwapOpen(false);
                            navigate(`/planner/${plan.id}/meal/${encodeURIComponent(slotId)}`, {
                              replace: true,
                              state: { swappedRevision: next.revision, swappedSlot: slotId },
                            });
                          }
                        }}
                      >
                        {t.choose}
                      </Button>
                    </li>
                  ))}
                {!alternatives.data?.alternatives.some((item) => item.id !== meal.source.id) && (
                  <li className="text-sm text-tk-secondary">{t.noAlternatives}</li>
                )}
              </ul>
            )}
            {model.busy === 'swap' && (
              <p role="status" className="mt-3 text-sm font-semibold text-tk-jade-deep">
                {t.swapping}
              </p>
            )}
            {!!model.error && (
              <div className="mt-3">
                <PlannerError error={model.error} locale={locale} />
              </div>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
