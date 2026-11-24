import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Heart, X } from 'lucide-react';
import { useModalFocus } from '../../design-system/use-modal-focus';
import { useRecipeFavorites } from './useRecipeFavorites';
import { recipeFavoritesApi, type FavoriteEntry } from '../../services/recipe-favorites';
import { familyMealPlanningApi } from '../../services/family-meal-planning';
import { mealCompositionApi } from '../../services/meal-composition';
import { InlineError, InlineLoading } from '../../components/common/AsyncState';
import { SaveRecipeButton } from '../../components/common/SaveRecipeButton';
import { Button } from '../../components/common/Button';
import { queryKeys } from '../../lib/queryKeys';
import { useAuthStore } from '../../stores/useAuthStore';
import { capturePrivateSession } from '../../lib/private-session';
import { ApiError } from '../../services/http';
import { resolveRecipeImage, recipeImageErrorHandler } from '../../lib/recipe-media';
import {
  localizeErrorText,
  localizeMealSlot,
  localizeRecipeTitle,
  useLocaleText,
} from '../../i18n/app-i18n';
import { componentTitle, roleLabel } from '../planner/composition';
import { IngredientCoverage } from '../planner/IngredientCoverage';
import { plannerErrorMessage } from '../planner/presentation';
import {
  isPlannerSlotElapsed,
  plannerDefaultTimes,
  plannerSlotId,
  plannerSlotTime,
} from '../planner/schedule';
import type { MealRole } from '../../../../packages/domain/src/meal-composition-api';

export type RecipeMealDialogEntry = {
  recipeId: string;
  title: string;
  slug?: string;
  cuisine?: string;
  roles?: MealRole[];
};

export function FavoritesCollection({ servings }: { servings: number }) {
  const { l, locale } = useLocaleText();
  const plannerLocale = locale === 'vi' ? 'vi' : 'en';
  const { query, guest } = useRecipeFavorites();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FavoriteEntry | null>(null);
  const owner = useAuthStore((state) => `${state.userId}:${state.householdId}`);
  useEffect(() => {
    setSelected(null);
  }, [owner]);
  const entries =
    query.data?.entries.filter((item) => {
      const q = search.trim();
      if (!q) return true;
      const qVi = q.toLocaleLowerCase('vi');
      if (item.title.toLocaleLowerCase('vi').includes(qVi)) return true;
      if (locale !== 'vi') {
        const localized = localizeRecipeTitle(item, locale);
        return localized.toLocaleLowerCase('en').includes(q.toLocaleLowerCase('en'));
      }
      return false;
    }) ?? [];
  if (guest)
    return (
      <div className="planning-empty">
        <Heart size={32} aria-hidden="true" />
        <h2>{l('Giữ những món nhà mình thích', 'Keep your family favorites')}</h2>
        <p>{l('Đăng nhập để lưu và chọn nhanh cho bữa tới.', 'Sign in to save dishes and add them quickly to upcoming meals.')}</p>
        <Link
          className="planning-primary-link"
          to={`/auth?mode=login&returnTo=${encodeURIComponent(`/recipes?view=saved&servings=${servings}`)}`}
        >
          {l('Đăng nhập để lưu món', 'Sign in to save recipes')}
        </Link>
      </div>
    );
  return (
    <section className="family-favorites" aria-labelledby="favorite-heading">
      <div className="family-collection-heading">
        <div>
          <h2 id="favorite-heading">
            {query.data
              ? l(
                  `${query.data.entries.length} món để nấu lại`,
                  `${query.data.entries.length} saved ${query.data.entries.length === 1 ? 'recipe' : 'recipes'}`,
                )
              : l('Món nhà mình đã lưu', 'Saved recipes')}
          </h2>
          <p>{l('Chọn “Thêm vào bữa” để đặt món vào thực đơn.', 'Select “Add to meal” to place a dish in your meal plan.')}</p>
        </div>
        <label>
          <span className="sr-only">{l('Tìm món đã lưu', 'Search saved recipes')}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={l('Tìm trong món đã lưu…', 'Search saved recipes…')}
            autoComplete="off"
          />
        </label>
      </div>
      {query.isPending ? (
        <InlineLoading label={l('Đang tải món đã lưu…', 'Loading saved recipes…')} />
      ) : query.isError ? (
        <InlineError
          error={query.error}
          message={
            locale === 'vi'
              ? undefined
              : localizeErrorText(
                  query.error,
                  'Could not load saved recipes. Please try again.',
                  undefined,
                  locale,
                )
          }
          onRetry={() => void query.refetch()}
        />
      ) : !entries.length ? (
        <div className="planning-empty">
          <Heart size={32} aria-hidden="true" />
          <h3>
            {search
              ? l('Không có món khớp', 'No matching recipes')
              : l('Bắt đầu từ món quen của nhà mình', 'Start with your family favorites')}
          </h3>
          <p>
            {search
              ? l(
                  'Thử tên ngắn hơn hoặc xem lại tất cả món đã lưu.',
                  'Try a shorter keyword or view all saved recipes.',
                )
              : l(
                  'Chạm trái tim ở món bạn thích để tìm lại và thêm vào bữa sau.',
                  'Tap the heart on dishes you love to find and add them to future meals.',
                )}
          </p>
          {search ? (
            <Button variant="outline" onClick={() => setSearch('')}>
              {l('Xem tất cả món đã lưu', 'View all saved recipes')}
            </Button>
          ) : (
            <Link className="planning-primary-link" to={`/recipes?servings=${servings}`}>
              {l('Tìm món để lưu', 'Explore recipes to save')}
            </Link>
          )}
        </div>
      ) : (
        <div className="family-favorites-grid">
          {entries.map((entry) => {
            const displayTitle = localizeRecipeTitle(entry, locale);
            return (
              <article key={entry.recipeId} className="family-favorite-card">
                {entry.imageUrl && resolveRecipeImage(entry).source !== 'placeholder' && (
                  <img
                    className="family-favorite-image"
                    src={resolveRecipeImage(entry).src}
                    onError={recipeImageErrorHandler(resolveRecipeImage(entry).fallbackSrc)}
                    alt=""
                    loading="lazy"
                  />
                )}
                <div className="family-favorite-title">
                  <h3>{displayTitle}</h3>
                  <SaveRecipeButton recipeId={entry.recipeId} title={displayTitle} compact />
                </div>
                <p>
                  {entry.roles.map((role) => roleLabel(role, plannerLocale)).join(' · ') ||
                    l('Chưa rõ vai trò', 'Role unspecified')}{' '}
                  ·{' '}
                  {entry.cookTimeMinutes === null
                    ? l('Chưa rõ thời gian', 'Time unknown')
                    : l(`${entry.cookTimeMinutes} phút`, `${entry.cookTimeMinutes} min`)}
                </p>
                {entry.available ? (
                  <div className="family-favorite-actions">
                    <Link
                      className="planning-text-link"
                      to={`/recipes/id/${encodeURIComponent(entry.recipeId)}?servings=${servings}`}
                    >
                      {l('Xem công thức', 'View recipe')}
                    </Link>
                    <Button onClick={() => setSelected(entry)}>
                      {l('Thêm vào bữa', 'Add to meal')}
                    </Button>
                  </div>
                ) : (
                  <p>
                    {l(
                      'Món này hiện không còn trong danh mục. Bạn có thể bỏ lưu.',
                      'This recipe is no longer in the catalog. You can unsave it.',
                    )}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
      {selected && (
        <RecipeMealDialog entry={selected} defaultServings={servings} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

export function RecipeMealDialog({
  entry,
  onClose,
  requireSaved = true,
  defaultServings,
}: {
  entry: RecipeMealDialogEntry;
  onClose: () => void;
  requireSaved?: boolean;
  defaultServings?: number;
}) {
  const { l, locale } = useLocaleText();
  const plannerLocale = locale === 'vi' ? 'vi' : 'en';
  const entryTitle = localizeRecipeTitle(entry, locale);
  const panel = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  const guest = useAuthStore((state) => state.isGuest);
  const [slotId, setSlotId] = useState('');
  const [role, setRole] = useState<MealRole | ''>(entry.roles?.length === 1 ? entry.roles[0] : '');
  const [knownRoles, setKnownRoles] = useState<MealRole[]>(entry.roles ?? []);
  const [placement, setPlacement] = useState<'add' | 'replace'>('add');
  const [replaceComponentId, setReplaceComponentId] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const plan = useQuery({
    queryKey: [...queryKeys.currentMealPlanningPlan(), 'favorite-picker'],
    queryFn: familyMealPlanningApi.current,
    enabled: !guest,
    retry: false,
  });
  const isCurrent = capturePrivateSession();
  const family = plan.data?.plan;
  const defaultTimes = plannerDefaultTimes;
  const schedule = new Map(
    (family?.plan.intent.slots ?? []).map((slot) => [
      plannerSlotId(slot),
      {
        time: plannerSlotTime(family!.plan, plannerSlotId(slot)) ?? defaultTimes[slot.mealType],
        sequence: slot.sequence,
      },
    ]),
  );
  const compositions = (family?.compositions.compositions ?? [])
    .filter((meal) => family && !isPlannerSlotElapsed(family.plan, meal.slotId))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (schedule.get(a.slotId)?.time ?? defaultTimes[a.mealType]).localeCompare(
          schedule.get(b.slotId)?.time ?? defaultTimes[b.mealType],
        ) ||
        (schedule.get(a.slotId)?.sequence ?? 0) - (schedule.get(b.slotId)?.sequence ?? 0) ||
        a.slotId.localeCompare(b.slotId),
    );
  const selected = compositions.find((meal) => meal.slotId === (slotId || compositions[0]?.slotId));
  const existingCandidates =
    selected?.components.filter((component) => component.role === role) ?? [];
  const existing =
    placement === 'replace'
      ? (existingCandidates.find((component) => component.id === replaceComponentId) ??
        existingCandidates[0])
      : undefined;
  const assessmentQuery = useQuery({
    queryKey: [
      ...queryKeys.currentMealPlanningPlan(),
      'favorite-assessment',
      family?.plan.id,
      family?.plan.revision,
      selected?.slotId,
      entry.recipeId,
      role,
      existing?.id,
    ],
    enabled: !guest && !!family && !!selected,
    queryFn: () =>
      mealCompositionApi.picker({
        planId: family!.plan.id,
        slotId: selected!.slotId,
        revision: String(family!.plan.revision),
        q: entry.recipeId,
        role: role || undefined,
        excludeComponentId: existing?.id,
      }),
    staleTime: 0,
    retry: false,
  });
  const receipt = assessmentQuery.data;
  const matchingReceipt =
    !!family &&
    !!selected &&
    receipt?.scope?.planId === family.plan.id &&
    receipt.scope.slotId === selected.slotId &&
    receipt.scope.revision === family.plan.revision &&
    receipt.scope.date === selected.date &&
    receipt.scope.mealType === selected.mealType &&
    receipt.scope.servings === selected.servings &&
    receipt.scope.excludeComponentId === (existing?.id ?? null);
  const matchedItem = matchingReceipt
    ? receipt?.items.find((item) => item.kind === 'recipe' && item.id === entry.recipeId)
    : undefined;
  const roles = matchedItem?.roles ?? knownRoles;
  useEffect(() => {
    if (matchedItem) setKnownRoles(matchedItem.roles);
  }, [matchedItem]);
  const assessment = role && matchedItem?.roles.includes(role) ? matchedItem.assessment : undefined;
  useEffect(() => {
    if (!roles.length || (role && roles.includes(role))) return;
    if (roles.length === 1) setRole(roles[0]);
    else if (role) setRole('');
  }, [role, roles]);
  useModalFocus(true, panel, () => {
    if (!busyRef.current) onClose();
  });
  async function add() {
    if (
      busyRef.current ||
      !isCurrent() ||
      useAuthStore.getState().isGuest ||
      !family ||
      !selected ||
      !role ||
      !assessment?.selectable ||
      assessmentQuery.isFetching
    )
      return;
    const keys = [
      queryKeys.mealPlanningPlan(family.plan.id),
      queryKeys.currentMealPlanningPlan(),
      queryKeys.mealPlanningCompositionsForPlan(family.plan.id),
    ];
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (requireSaved) {
        const state = await recipeFavoritesApi.state(entry.recipeId);
        if (!isCurrent())
          throw new ApiError('auth', l('Phiên làm việc đã thay đổi.', 'Your session has changed.'));
        if (!state.isSaved)
          throw new Error(
            l(
              'Món vừa được bỏ lưu. Hãy tải lại danh sách.',
              'This recipe was just unsaved. Please reload the list.',
            ),
          );
      }
      if (!isCurrent() || useAuthStore.getState().isGuest) return;
      const target = { kind: 'recipe' as const, recipeId: entry.recipeId };
      if (placement === 'replace' && existing)
        await mealCompositionApi.swap(family.plan.id, selected.slotId, existing.id, {
          revision: family.plan.revision,
          target,
          role,
          locked: true,
        });
      else
        await mealCompositionApi.add(family.plan.id, selected.slotId, {
          revision: family.plan.revision,
          target,
          role,
          locked: true,
        });
      if (!isCurrent()) return;
      for (const queryKey of keys) await client.invalidateQueries({ queryKey });
      if (!isCurrent()) return;
      setDone(true);
    } catch (failure) {
      if (!isCurrent()) return;
      setError(failure);
      void plan.refetch();
    } finally {
      busyRef.current = false;
      if (isCurrent()) setBusy(false);
    }
  }
  const handoffServings =
    Number.isInteger(defaultServings) && defaultServings! >= 1 && defaultServings! <= 20
      ? defaultServings
      : undefined;
  const displayComponentTitle = (comp: (typeof existingCandidates)[number]) =>
    localizeRecipeTitle({ title: componentTitle(comp, plannerLocale) }, locale);
  return (
    <div
      role="presentation"
      onClick={() => {
        if (!busyRef.current) onClose();
      }}
      className="planning-picker fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-semantic-overlay/50"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="favorite-meal-title"
        onClick={(e) => e.stopPropagation()}
        className="family-dialog recipe-meal-dialog"
      >
        <div className="family-dialog-heading">
          <h2 id="favorite-meal-title">{l(`Đặt ${entryTitle} vào bữa`, `Add ${entryTitle} to a meal`)}</h2>
          <Button
            variant="ghost"
            className="!px-2.5 !min-w-[44px]"
            disabled={busy}
            onClick={onClose}
            aria-label={l('Đóng', 'Close')}
          >
            <X size={20} aria-hidden="true" />
          </Button>
        </div>
        {guest ? (
          <div className="space-y-3">
            <p>{l('Đăng nhập để chọn món cho bữa của gia đình.', 'Sign in to add dishes to your family meal plan.')}</p>
            <Link
              className="planning-primary-link w-full sm:w-auto"
              to={`/auth?mode=login&returnTo=${encodeURIComponent(`/recipes/id/${entry.recipeId}`)}`}
              onClick={onClose}
            >
              {l('Đăng nhập để lên thực đơn', 'Sign in to plan meals')}
            </Link>
          </div>
        ) : plan.isPending ? (
          <InlineLoading label={l('Đang tải các bữa…', 'Loading meals…')} />
        ) : plan.isError ? (
          <InlineError
            error={plan.error}
            message={locale === 'vi' ? undefined : plannerErrorMessage(plan.error, plannerLocale)}
            onRetry={() => void plan.refetch()}
          />
        ) : done ? (
          <div role="status" className="space-y-3">
            <p>{l('Đã đặt món vào bữa. Các món khác được giữ nguyên.', 'Added to your meal. Other dishes remain unchanged.')}</p>
            <Link
              className="planning-primary-link w-full sm:w-auto"
              to={`/planner/${family?.plan.id}/meal/${encodeURIComponent(selected?.slotId ?? '')}`}
              onClick={onClose}
            >
              {l('Xem bữa vừa chọn', 'View selected meal')}
            </Link>
          </div>
        ) : !family || !compositions.length ? (
          <div className="space-y-3">
            <p>
              {l(
                'Chọn lịch và số người ăn để đặt món vào bữa tới.',
                'Choose your schedule and servings to place this dish in an upcoming meal.',
              )}
            </p>
            <Link
              className="planning-primary-link w-full sm:w-auto"
              to={`/planner/new?recipe=${encodeURIComponent(entry.recipeId)}${handoffServings ? `&servings=${handoffServings}` : ''}`}
              onClick={onClose}
            >
              {l('Tạo lịch trống để chọn món', 'Create a schedule to add dishes')}
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
            className="family-settings-form"
          >
            <label>
              {l('Bữa', 'Meal')}
              <select
                value={selected?.slotId ?? ''}
                onChange={(event) => {
                  setSlotId(event.target.value);
                  setPlacement('add');
                  setReplaceComponentId('');
                }}
                disabled={busy}
              >
                {compositions.map((meal) => (
                  <option key={meal.slotId} value={meal.slotId}>
                    {meal.date} · {localizeMealSlot(meal.mealType, locale)} ·{' '}
                    {l(
                      `${meal.servings} người`,
                      `${meal.servings} ${meal.servings === 1 ? 'serving' : 'servings'}`,
                    )}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {l('Nhóm món', 'Meal role')}
              <select
                value={role}
                onChange={(event) => {
                  setRole(event.target.value as MealRole);
                  setPlacement('add');
                  setReplaceComponentId('');
                }}
                disabled={busy || !roles.length}
              >
                <option value="" disabled>
                  {l('Chọn nhóm món', 'Select meal role')}
                </option>
                {roles.map((value) => (
                  <option key={value} value={value}>
                    {roleLabel(value, plannerLocale)}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="family-placement-choice">
              <legend>{l('Đặt món theo cách nào?', 'How would you like to add it?')}</legend>
              <label>
                <input
                  type="radio"
                  name="favorite-placement"
                  value="add"
                  checked={placement === 'add'}
                  onChange={() => setPlacement('add')}
                  disabled={busy}
                />{' '}
                {l('Thêm món này', 'Add this dish')}
              </label>
              {existingCandidates.length > 0 && (
                <label>
                  <input
                    type="radio"
                    name="favorite-placement"
                    value="replace"
                    checked={placement === 'replace'}
                    onChange={() => {
                      setPlacement('replace');
                      setReplaceComponentId(existingCandidates[0]?.id ?? '');
                    }}
                    disabled={busy}
                  />{' '}
                  {l('Thay món cùng nhóm', 'Replace dish in same role')}
                </label>
              )}
            </fieldset>
            {placement === 'replace' && existingCandidates.length > 0 && (
              <label>
                {l('Món sẽ thay', 'Dish to replace')}
                <select
                  value={existing?.id ?? ''}
                  onChange={(event) => setReplaceComponentId(event.target.value)}
                  disabled={busy}
                >
                  {existingCandidates.map((component) => (
                    <option key={component.id} value={component.id}>
                      {displayComponentTitle(component)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {placement === 'replace' && existing && (
              <p className="planning-notice">
                {l(
                  `Món này sẽ thay “${displayComponentTitle(existing)}” ở vai trò ${roleLabel(role as MealRole, 'vi').toLowerCase()}. Các món khác giữ nguyên.`,
                  `This dish will replace “${displayComponentTitle(existing)}” as the ${roleLabel(role as MealRole, 'en').toLowerCase()}. Other dishes stay unchanged.`,
                )}
              </p>
            )}
            {placement === 'add' && existingCandidates.length > 0 && (
              <p className="planning-note">
                {l(
                  'Món hiện có vẫn được giữ. Món đã chọn sẽ thêm thành một món nữa trong bữa.',
                  'Existing dishes will stay. The selected dish will be added as another dish in this meal.',
                )}
              </p>
            )}
            {assessmentQuery.isPending || assessmentQuery.isFetching ? (
              <InlineLoading
                label={l(
                  'Đang kiểm tra lượng cho bữa đã chọn…',
                  'Checking quantities for the selected meal…',
                )}
              />
            ) : assessmentQuery.isError ? (
              <InlineError
                error={assessmentQuery.error}
                message={plannerErrorMessage(assessmentQuery.error, plannerLocale)}
                onRetry={() => void assessmentQuery.refetch()}
              />
            ) : !role && roles.length > 1 ? (
              <p className="planning-note">
                {l(
                  'Chọn vai trò để kiểm tra lượng món trong bữa này.',
                  'Choose a role to check ingredient coverage for this meal.',
                )}
              </p>
            ) : assessment ? (
              <IngredientCoverage
                assessment={assessment}
                locale={plannerLocale}
                servings={selected?.servings}
              />
            ) : (
              <p className="planning-notice">
                {l(
                  'Chưa xác nhận được món này cho bữa đã chọn. Kiểm tra lại thực đơn và hạn chế thực phẩm.',
                  'Could not confirm this dish for the selected meal. Check your meal plan and dietary restrictions.',
                )}
              </p>
            )}
            {!!error && (
              <InlineError error={error} message={plannerErrorMessage(error, plannerLocale)} />
            )}
            <Button
              type="submit"
              isLoading={busy}
              disabled={
                !role ||
                !assessment?.selectable ||
                assessmentQuery.isFetching ||
                (placement === 'replace' && !existing)
              }
            >
              {placement === 'replace'
                ? l('Thay món trong bữa', 'Replace dish in meal')
                : l('Thêm vào bữa', 'Add to meal')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
