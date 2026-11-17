import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CatalogIdSchema } from '../../../../packages/domain/src/foundation';
import {
  ArrowDown,
  ArrowUp,
  Lock,
  LockOpen,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import type {
  AssistProposalDto,
  AutoOptionsDto,
  CompositionOptionDto,
  MealComponentDto,
  MealRole,
  PickerItemDto,
} from '../../../../packages/domain/src/meal-composition-api';
import type { MealPlanDto } from '../../../../packages/domain/src/meal-planning-api';
import { Button } from '../../components/common/Button';
import { SaveRecipeButton } from '../../components/common/SaveRecipeButton';
import { BentoCard } from '../../design-system/v4/AtelierPrimitives';
import { HouseholdTrayIcon, WokFlameIcon } from '../../design-system/icons';
import { mealCompositionApi } from '../../services/meal-composition';
import { CompositionLoadState } from './CompositionLoadState';
import { MealTimeNotice } from './MealTimeNotice';
import { MealStyleNotice } from './MealStyleNotice';
import { compositionState, compositionStateCopy } from './composition-state';
import { reasonLabel } from './presentation';
import { FamilyPlanNotice } from './FamilyPlanNotice';
import { isPlannerSlotElapsed, plannerSlotInstant } from './schedule';
import { ComponentPicker, type PickerMealContext } from './ComponentPicker';
import { IngredientCoverage } from './IngredientCoverage';
import { compositionCopy, componentTitle, roleLabel, usePlanCompositions } from './composition';
import type { PlannerLocale } from './copy';
import type { usePlanner } from './usePlanner';
import { DishThumbV4, RolePillIcon, rolePillClasses } from './roleVisual';

// The meal page remounts on every plan revision; this carries focus and the announcement across it.
let pendingFocus: { id: string; message: string } | null = null;

type Picker = { mode: 'add'; role?: MealRole } | { mode: 'swap'; component: MealComponentDto };

const TRAY_CORE_ROLES: MealRole[] = ['main', 'soup', 'vegetable', 'staple'];

export function MealComposer({
  plan,
  slotId,
  model,
  locale,
  query: loaded,
}: {
  plan: MealPlanDto;
  slotId: string;
  model: ReturnType<typeof usePlanner>;
  locale: PlannerLocale;
  query?: ReturnType<typeof usePlanCompositions>;
}) {
  const c = compositionCopy[locale];
  const [params, setParams] = useSearchParams();
  const requestedRecipe = CatalogIdSchema.safeParse(params.get('recipe'));
  const pendingRecipeId = requestedRecipe.success ? requestedRecipe.data : undefined;
  function clearRecipeHandoff() {
    if (!pendingRecipeId) return;
    const next = new URLSearchParams(params);
    next.delete('recipe');
    setParams(next, { replace: true });
  }
  const ownQuery = usePlanCompositions(plan, !loaded);
  const query = loaded ?? ownQuery;
  const matchingCompositions =
    query.data?.planId === plan.id && query.data.planRevision === plan.revision;
  const revisionChanged =
    query.isSuccess && query.data.planId === plan.id && query.data.planRevision !== plan.revision;
  const composition = matchingCompositions
    ? query.data?.compositions.find((entry) => entry.slotId === slotId)
    : undefined;
  const [picker, setPicker] = useState<Picker | null>(() =>
    pendingRecipeId ? { mode: 'add' } : null,
  );
  const [proposal, setProposal] = useState<AssistProposalDto | null>(null);
  const [options, setOptions] = useState<AutoOptionsDto | null>(null);
  const [message, setMessage] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const past = isPlannerSlotElapsed(plan, slotId);

  useEffect(() => {
    if (!pendingFocus || !composition) return;
    const { id, message: text } = pendingFocus;
    pendingFocus = null;
    setMessage(text);
    (document.getElementById(id) ?? heading.current)?.focus();
  }, [composition]);

  async function mutate(label: string, focusId: string, operation: () => Promise<unknown>) {
    if (isPlannerSlotElapsed(plan, slotId)) {
      setPicker(null);
      setMessage(
        locale === 'vi'
          ? 'Bữa này đã qua giờ dự kiến. Chọn một bữa sắp tới để chỉnh món.'
          : 'This meal has passed. Choose a future meal to edit dishes.',
      );
      return;
    }
    const result = await model.perform(label, operation);
    if (!result) return;
    pendingFocus = { id: focusId, message: c.changed };
    setPicker(null);
    clearRecipeHandoff();
    setProposal(null);
    setOptions(null);
    await model.perform('refresh', () => model.loadPlan(plan.id), model.replacePlan);
  }

  function choose(item: PickerItemDto, role: MealRole) {
    const target =
      item.kind === 'recipe'
        ? { kind: 'recipe' as const, recipeId: item.id }
        : { kind: 'simple_food' as const, simpleFoodId: item.id };
    if (picker?.mode === 'swap') {
      const permitted = item.roles.includes(picker.component.role) ? picker.component.role : role;
      void mutate('composition-swap', `component-${picker.component.id}`, () =>
        mealCompositionApi.swap(plan.id, slotId, picker.component.id, {
          revision: plan.revision,
          target,
          role: permitted,
          locked: true,
        }),
      );
    } else {
      void mutate('composition-add', 'composition-heading', () =>
        mealCompositionApi.add(plan.id, slotId, {
          revision: plan.revision,
          target,
          role,
          locked: true,
        }),
      );
    }
  }

  if (!query.isSuccess || !composition) {
    return (
      <BentoCard tone="ceramic" padding="md">
        {revisionChanged ? (
          <div role="status" className="planning-notice space-y-2">
            <p className="text-sm font-semibold text-tk-ink">
              {locale === 'vi'
                ? 'Thực đơn đã có phiên bản mới. Tải lại trước khi chọn món.'
                : 'A newer plan is available. Load it before choosing dishes.'}
            </p>
            <Button
              className="mt-2"
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
          <CompositionLoadState query={query} locale={locale} missing={!composition} />
        )}
      </BentoCard>
    );
  }

  const disabled = !!model.busy || past;
  const components = composition.components;
  const presentRoles = new Set(components.map((item) => item.role));
  const context: PickerMealContext = {
    date: composition.date,
    mealType: composition.mealType,
    servings: composition.servings,
  };
  const pickerScope =
    picker && picker.mode === 'swap'
      ? {
          planId: plan.id,
          slotId,
          revision: plan.revision,
          excludeComponentId: picker.component.id,
        }
      : { planId: plan.id, slotId, revision: plan.revision };

  return (
    <BentoCard
      tone="ceramic"
      padding="md"
      className="planning-composer space-y-4"
      aria-labelledby="composition-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-tk-jade-soft text-tk-jade-deep">
            <HouseholdTrayIcon size={22} tone="jade" active />
          </span>
          <div>
            <h3
              id="composition-heading"
              ref={heading}
              tabIndex={-1}
              className="font-heading text-lg font-extrabold text-tk-ink"
            >
              {c.heading}
            </h3>
            <p className="mt-0.5 text-xs text-tk-muted">
              {past
                ? plannerSlotInstant(plan, slotId) === undefined
                  ? locale === 'vi'
                    ? 'Chưa xác nhận được giờ của bữa này. Tải lại thực đơn trước khi chỉnh món.'
                    : 'This meal time could not be confirmed. Reload the plan before editing.'
                  : locale === 'vi'
                    ? 'Bữa này đã qua giờ dự kiến nên được giữ nguyên. Bạn vẫn có thể chỉnh các bữa sắp tới.'
                    : 'This scheduled meal has passed and stays unchanged. You can still edit future meals.'
                : c.editHint}
            </p>
          </div>
        </div>

        <p
          className="planning-composer-state inline-flex items-center rounded-full border border-tk-jade/25 bg-tk-jade-soft px-3 py-1 text-xs font-extrabold text-tk-jade-deep"
          role="status"
        >
          {compositionState(composition) === 'complete' &&
          composition.warnings.includes('MANUAL_ONE_DISH_MEAL')
            ? locale === 'vi'
              ? 'Đã xếp món cho bữa gọn'
              : 'Your one-dish meal is ready'
            : compositionStateCopy[locale][compositionState(composition)]}
        </p>
      </div>

      {/* Visual Mâm Cơm Tray Role Balance Strip */}
      <div
        className="flex flex-wrap gap-2 rounded-2xl border border-tk-stone/80 bg-tk-sunken/60 p-2.5"
        aria-hidden="true"
      >
        {TRAY_CORE_ROLES.map((role) => {
          const filled = presentRoles.has(role);
          return (
            <span
              key={role}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                filled
                  ? rolePillClasses(role)
                  : 'border-dashed border-tk-stone bg-white/70 text-tk-muted'
              }`}
            >
              <RolePillIcon role={role} size={12} />
              <span>{roleLabel(role, locale)}</span>
            </span>
          );
        })}
      </div>

      <FamilyPlanNotice
        plan={plan}
        familyPlan={model.familyPlan}
        warnings={composition.warnings}
        locale={locale}
      />

      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>

      {components.length === 0 && (
        <div className="planning-empty-composition rounded-2xl border border-dashed border-tk-stone bg-tk-sunken/50 p-5 text-center space-y-1.5">
          <p className="font-heading text-base font-extrabold text-tk-ink">{c.emptyMeal}</p>
          <p className="text-sm text-tk-secondary">
            {locale === 'vi'
              ? past
                ? 'Bữa đã qua vẫn được giữ trống. Chọn một bữa sắp tới để xếp món.'
                : 'Chọn một món đầu tiên, sau đó Takolio sẽ cho biết nhóm món và lượng còn thiếu.'
              : past
                ? 'This past meal remains empty. Choose a future meal to plan dishes.'
                : 'Choose a first dish, then Takolio will show dish groups and quantities still needed.'}
          </p>
        </div>
      )}

      <ol className="mt-2 space-y-3">
        {components.map((component, index) => (
          <ComponentRow
            key={component.id}
            component={component}
            index={index}
            count={components.length}
            servings={composition.servings}
            locale={locale}
            disabled={disabled}
            onLock={() =>
              void mutate('composition-lock', `lock-${component.id}`, () =>
                mealCompositionApi.update(plan.id, slotId, component.id, {
                  revision: plan.revision,
                  locked: !component.locked,
                }),
              )
            }
            onRole={(role) =>
              void mutate('composition-role', `component-${component.id}`, () =>
                mealCompositionApi.update(plan.id, slotId, component.id, {
                  revision: plan.revision,
                  role,
                }),
              )
            }
            onMove={(offset) =>
              void mutate('composition-move', `component-${component.id}`, () =>
                mealCompositionApi.update(plan.id, slotId, component.id, {
                  revision: plan.revision,
                  ordinal: index + offset,
                }),
              )
            }
            onSwap={() => setPicker({ mode: 'swap', component })}
            assessment={component.assessment}
            onRemove={() =>
              void mutate('composition-remove', 'composition-heading', () =>
                mealCompositionApi.remove(plan.id, slotId, component.id, plan.revision),
              )
            }
          />
        ))}
      </ol>

      <MealStyleNotice warnings={composition.warnings} locale={locale} />
      <MealTimeNotice warnings={composition.warnings} locale={locale} />

      {composition.warnings.includes('SAVED_CONTENT_REQUIRES_REVALIDATION') && (
        <p
          className="planning-note rounded-xl bg-tk-turmeric-soft px-3 py-2 text-xs font-semibold text-tk-turmeric-deep"
          role="status"
        >
          {reasonLabel('SAVED_CONTENT_REQUIRES_REVALIDATION', locale)}
        </p>
      )}

      {[...new Set([...composition.missingRoles, ...composition.recommendedRoles])].map((role) => (
        <div
          key={role}
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-tk-jade/35 bg-tk-jade-soft/50 p-3.5"
        >
          <p className="flex items-center gap-2 text-sm font-bold text-tk-jade-deep">
            <RolePillIcon role={role} size={15} />
            <span>{c.missing(roleLabel(role, locale))}</span>
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            aria-label={`${c.addDish}: ${roleLabel(role, locale)}`}
            onClick={() => setPicker({ mode: 'add', role })}
          >
            <Plus size={14} className="mr-1" />
            {c.addDish}
          </Button>
        </div>
      ))}

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <Button variant="secondary" disabled={disabled} onClick={() => setPicker({ mode: 'add' })}>
          <Plus size={16} className="mr-2" />
          {c.addDish}
        </Button>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={async () => {
            setOptions(null);
            const result = await model.perform('composition-assist', () =>
              mealCompositionApi.assist(plan.id, slotId, {
                revision: plan.revision,
                action: 'complete',
              }),
            );
            if (result) {
              setProposal(result);
              setMessage(c.proposalReady);
            }
          }}
        >
          <Sparkles size={16} className="mr-2" />
          {c.complete}
        </Button>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={async () => {
            setOptions(null);
            const result = await model.perform('composition-assist', () =>
              mealCompositionApi.assist(plan.id, slotId, {
                revision: plan.revision,
                action: 'regenerate_unlocked',
              }),
            );
            if (result) {
              setProposal(result);
              setMessage(c.proposalReady);
            }
          }}
        >
          <RefreshCw size={16} className="mr-2" />
          {c.regenerateUnlocked}
        </Button>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={async () => {
            setProposal(null);
            const result = await model.perform('composition-auto', () =>
              mealCompositionApi.auto(plan.id, slotId, { revision: plan.revision }),
            );
            if (result) {
              setOptions(result);
              setMessage(c.proposalReady);
            }
          }}
        >
          <Wand2 size={16} className="mr-2" />
          {c.build}
        </Button>
      </div>

      {proposal && (
        <Suggestions
          title={c.suggestionTitle}
          locale={locale}
          options={proposal.proposal ? [proposal.proposal] : []}
          disabled={disabled}
          onDismiss={() => setProposal(null)}
          onAccept={(option) =>
            void mutate('composition-assist-apply', 'composition-heading', () =>
              mealCompositionApi.assistApply(plan.id, slotId, {
                revision: plan.revision,
                action: proposal.action,
                variant: proposal.variant,
                proposalId: option.optionId,
              }),
            )
          }
        />
      )}

      {options && (
        <Suggestions
          title={c.options}
          locale={locale}
          options={options.options}
          disabled={disabled}
          onDismiss={() => setOptions(null)}
          onAccept={(option) =>
            void mutate('composition-auto-apply', 'composition-heading', () =>
              mealCompositionApi.autoApply(plan.id, slotId, {
                revision: plan.revision,
                variant: options.variant,
                optionId: option.optionId,
              }),
            )
          }
        />
      )}

      {picker && !past && (
        <ComponentPicker
          locale={locale}
          busy={!!model.busy}
          mutationError={model.error}
          context={context}
          scope={pickerScope}
          onReloadPlan={() => {
            setPicker(null);
            void model.perform('refresh', () => model.loadPlan(plan.id), model.replacePlan);
          }}
          intent={picker.mode === 'swap' ? 'swap' : 'add'}
          initialRecipeId={picker.mode === 'add' ? pendingRecipeId : undefined}
          initialRole={picker.mode === 'add' ? picker.role : picker.component.role}
          onChoose={choose}
          onClose={() => {
            setPicker(null);
            clearRecipeHandoff();
          }}
        />
      )}
    </BentoCard>
  );
}

function ComponentRow({
  component,
  servings,
  index,
  count,
  locale,
  disabled,
  onLock,
  onRole,
  onMove,
  onSwap,
  onRemove,
  assessment,
}: {
  component: MealComponentDto;
  servings: number;
  assessment?: MealComponentDto['assessment'];
  index: number;
  count: number;
  locale: PlannerLocale;
  disabled: boolean;
  onLock: () => void;
  onRole: (role: MealRole) => void;
  onMove: (offset: number) => void;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const c = compositionCopy[locale];
  const title = componentTitle(component, locale);
  const status = component.projection?.status;
  const statusText =
    status === 'covered'
      ? c.covered
      : status === 'needs_shopping'
        ? c.needsShopping
        : status === 'unresolved'
          ? c.unresolved
          : status === 'not_tracked'
            ? c.notTracked
            : null;

  return (
    <li
      id={`component-${component.id}`}
      tabIndex={-1}
      className="planning-component-row rounded-2xl border border-tk-stone bg-tk-canvas/85 p-4 shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <DishThumbV4
            item={{
              id: component.id,
              recipeId: component.recipeId,
              simpleFoodId: component.simpleFoodId,
              title,
              role: component.role,
            }}
            sizeClassName="h-14 w-14 rounded-2xl"
          />
          <div className="min-w-0">
            <p className="text-base font-extrabold leading-snug text-tk-ink">{title}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-tk-secondary">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-bold ${rolePillClasses(component.role)}`}
              >
                <RolePillIcon role={component.role} size={12} />
                <span>{roleLabel(component.role, locale)}</span>
              </span>
              {component.locked && <span className="font-bold text-tk-ink"> · {c.locked}</span>}
              {statusText && <span> · {statusText}</span>}
            </p>
            {!component.resolvable && (
              <p className="mt-1 text-xs font-semibold text-tk-turmeric-deep">{c.unavailable}</p>
            )}
            {assessment && (
              <IngredientCoverage
                assessment={assessment}
                locale={locale}
                title={locale === 'vi' ? 'Xem lượng cho món này' : 'Review this dish quantities'}
              />
            )}
          </div>
        </div>

        <Button
          id={`lock-${component.id}`}
          size="sm"
          variant={component.locked ? 'secondary' : 'ghost'}
          aria-pressed={component.locked}
          aria-label={`${component.locked ? c.unlock : c.lock}: ${title}`}
          disabled={disabled}
          onClick={onLock}
        >
          {component.locked ? (
            <Lock size={16} aria-hidden="true" />
          ) : (
            <LockOpen size={16} aria-hidden="true" />
          )}
        </Button>
      </div>

      <div className="planning-component-primary-actions mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          aria-label={`${c.swapDish}: ${title}`}
          onClick={onSwap}
        >
          <RefreshCw size={14} className="mr-1" />
          {c.swapDish}
        </Button>
        {component.recipeId && <SaveRecipeButton recipeId={component.recipeId} title={title} />}
      </div>

      <details className="group mt-2">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs font-bold text-tk-jade-deep underline">
          {c.remove} · {c.role} · {locale === 'vi' ? 'Sắp xếp' : 'Reorder'}
        </summary>
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-white p-2.5 border border-tk-stone/70">
          {component.permittedRoles.length > 1 && (
            <label className="flex items-center gap-2 text-xs font-semibold text-tk-ink">
              {c.role}
              <select
                id={`role-${component.id}`}
                value={component.role}
                disabled={disabled}
                onChange={(event) => onRole(event.target.value as MealRole)}
                className="min-h-11 rounded-lg border border-tk-stone bg-white px-2 text-tk-ink"
                aria-label={`${c.role}: ${title}`}
              >
                {component.permittedRoles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role, locale)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || index === 0}
            aria-label={`${c.moveUp}: ${title}`}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || index === count - 1}
            aria-label={`${c.moveDown}: ${title}`}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            aria-label={`${c.remove}: ${title}`}
            onClick={onRemove}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </details>

      <div className="mt-2 border-t border-tk-stone/60 pt-2 text-xs">
        {component.cookable && component.recipeId ? (
          <span className="flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex min-h-11 items-center font-bold text-tk-jade-deep underline"
              to={`/recipes/id/${encodeURIComponent(component.recipeId)}?servings=${servings}${component.contentFingerprint ? `&contentFingerprint=${component.contentFingerprint}` : ''}`}
            >
              {c.detail}
            </Link>
            <Link
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-tk-flame px-3.5 py-2 font-extrabold text-white shadow-xs transition-tap hover:bg-tk-flame-hover"
              to={`/cooking/${encodeURIComponent(component.recipeId)}?servings=${servings}${component.contentFingerprint ? `&contentFingerprint=${component.contentFingerprint}` : ''}`}
            >
              <WokFlameIcon size={14} tone="flame" active />
              {c.cook}
            </Link>
          </span>
        ) : component.kind === 'simple_food' ? (
          <span className="text-tk-muted">{c.noCooking}</span>
        ) : null}
      </div>
    </li>
  );
}

function Suggestions({
  title,
  locale,
  options,
  disabled,
  onAccept,
  onDismiss,
}: {
  title: string;
  locale: PlannerLocale;
  options: CompositionOptionDto[];
  disabled: boolean;
  onAccept: (option: CompositionOptionDto) => void;
  onDismiss: () => void;
}) {
  const c = compositionCopy[locale];
  const reason = (entry: CompositionOptionDto['explanations'][number]) => {
    if (entry.code === 'ROLE_ADDED') return c.roleAdded(roleLabel(entry.role!, locale));
    if (entry.code === 'ROLE_UNFILLED') return c.roleUnfilled(roleLabel(entry.role!, locale));
    return c.reasons[entry.code](entry.count ?? 0);
  };
  return (
    <section
      aria-label={title}
      className="planning-suggestions mt-4 space-y-3 rounded-2xl border border-tk-jade/25 bg-tk-jade-soft/50 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-heading text-base font-extrabold text-tk-ink">{title}</h4>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          {c.dismiss}
        </Button>
      </div>
      <p className="text-xs text-tk-secondary">{c.suggestionNote}</p>
      {options.length === 0 && <p className="text-sm font-semibold text-tk-ink">{c.noSuggestion}</p>}
      {options.map((option, index) => (
        <div
          key={option.optionId}
          className="space-y-2.5 rounded-2xl border border-tk-stone bg-white p-4 shadow-xs"
        >
          {options.length > 1 && (
            <p className="text-xs font-extrabold uppercase tracking-wide text-tk-jade-deep">
              {c.option} {index + 1}
            </p>
          )}
          <ul className="space-y-2 text-sm">
            {option.components.map((item) => {
              const displayTitle = componentTitle(
                { kind: item.kind, simpleFoodId: item.simpleFoodId, title: item.title },
                locale,
              );
              return (
                <li
                  key={`${item.kind}:${item.recipeId ?? item.simpleFoodId}`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-2 font-bold text-tk-ink">
                    <DishThumbV4
                      item={{
                        recipeId: item.recipeId,
                        simpleFoodId: item.simpleFoodId,
                        title: displayTitle,
                        role: item.role,
                      }}
                      sizeClassName="h-9 w-9 rounded-xl"
                    />
                    <span className="truncate">{displayTitle}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${rolePillClasses(item.role)}`}
                  >
                    {roleLabel(item.role, locale)} · {item.existingComponentId ? c.kept : c.added}
                  </span>
                </li>
              );
            })}
          </ul>
          {option.removedComponentIds.length > 0 && (
            <p className="text-xs font-semibold text-tk-turmeric-deep">{c.removedLabel}</p>
          )}
          {option.explanations.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 pt-1 text-xs">
              {option.explanations.map((entry, position) => (
                <li
                  key={position}
                  className="rounded-full border border-tk-jade/20 bg-tk-jade-soft px-2.5 py-1 font-semibold text-tk-jade-deep"
                >
                  {reason(entry)}
                </li>
              ))}
            </ul>
          )}
          <Button size="sm" className="mt-2" disabled={disabled} onClick={() => onAccept(option)}>
            {c.accept}
          </Button>
        </div>
      ))}
    </section>
  );
}
