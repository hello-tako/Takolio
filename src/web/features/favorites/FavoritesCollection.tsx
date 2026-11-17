import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Heart, Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useModalFocus } from '../../design-system/use-modal-focus';
import { useRecipeFavorites } from './useRecipeFavorites';
import { recipeFavoritesApi, type FavoriteEntry } from '../../services/recipe-favorites';
import { familyMealPlanningApi } from '../../services/family-meal-planning';
import { mealCompositionApi } from '../../services/meal-composition';
import { InlineError, InlineLoading } from '../../components/common/AsyncState';
import { SaveRecipeButton } from '../../components/common/SaveRecipeButton';
import { RecipeMedia } from '../../components/common/RecipeMedia';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
} from '../../design-system/v4/AtelierPrimitives';
import {
  CalendarMealCheckIcon,
  NavRecipesIcon,
} from '../../design-system/icons';
import { queryKeys } from '../../lib/queryKeys';
import { useAuthStore } from '../../stores/useAuthStore';
import { capturePrivateSession } from '../../lib/private-session';
import { ApiError } from '../../services/http';
import { resolveRecipeImageV4 } from '../../lib/recipe-media';
import { roleLabel } from '../planner/composition';
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
  roles?: MealRole[];
};

export function FavoritesCollection({ servings }: { servings: number }) {
  const { query, guest } = useRecipeFavorites();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FavoriteEntry | null>(null);
  const owner = useAuthStore((state) => `${state.userId}:${state.householdId}`);

  useEffect(() => {
    setSelected(null);
  }, [owner]);

  const entries =
    query.data?.entries.filter((item) =>
      item.title.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')),
    ) ?? [];

  if (guest) {
    return (
      <BentoCard tone="flame" padding="lg" className="planning-empty text-center space-y-4 max-w-xl mx-auto my-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-tk-berry shadow-xs border border-tk-berry/15">
          <Heart size={28} aria-hidden="true" fill="currentColor" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold text-tk-ink">Giữ những món nhà mình thích</h2>
          <p className="text-sm text-tk-secondary">
            Đăng nhập để lưu bộ sưu tập món tủ và xếp nhanh vào thực đơn tuần cho cả nhà.
          </p>
        </div>
        <div className="pt-1">
          <ActionButton
            variant="flame"
            to={`/auth?mode=login&returnTo=${encodeURIComponent(`/recipes?view=saved&servings=${servings}`)}`}
          >
            Đăng nhập để lưu món
          </ActionButton>
        </div>
      </BentoCard>
    );
  }

  return (
    <section className="family-favorites space-y-5" aria-labelledby="favorite-heading">
      <BentoCard tone="ceramic" padding="md" className="family-collection-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AtelierBadge tone="berry" icon={<Heart size={12} fill="currentColor" />}>
              Bộ sưu tập gia đình
            </AtelierBadge>
          </div>
          <h2 id="favorite-heading" className="text-lg sm:text-xl font-extrabold text-tk-ink">
            {query.data ? `${query.data.entries.length} món để nấu lại` : 'Món nhà mình đã lưu'}
          </h2>
          <p className="text-xs sm:text-sm text-tk-secondary">
            Chọn “Thêm vào bữa” để đặt thẳng món quen vào lịch thực đơn tuần.
          </p>
        </div>

        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Tìm món đã lưu</span>
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tk-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm trong món đã lưu…"
            autoComplete="off"
            className="w-full min-h-[44px] rounded-2xl border border-tk-stone bg-tk-canvas pl-10 pr-4 py-2 text-sm font-medium text-tk-ink placeholder:text-tk-muted focus:border-tk-flame focus:bg-white focus:outline-none focus:ring-3 focus:ring-tk-flame/20"
          />
        </label>
      </BentoCard>

      {query.isPending ? (
        <InlineLoading label="Đang tải món đã lưu…" />
      ) : query.isError ? (
        <InlineError error={query.error} onRetry={() => void query.refetch()} />
      ) : !entries.length ? (
        <BentoCard tone="sunken" padding="lg" className="planning-empty text-center space-y-4 py-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-tk-flame shadow-xs border border-tk-stone">
            <NavRecipesIcon size={28} tone="flame" active />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg font-extrabold text-tk-ink">
              {search ? 'Không có món khớp' : 'Bắt đầu từ món quen của nhà mình'}
            </h3>
            <p className="text-sm text-tk-secondary">
              {search
                ? 'Thử tên ngắn hơn hoặc xem lại tất cả món đã lưu.'
                : 'Chạm biểu tượng trái tim ở bất kỳ món ngon nào bạn yêu thích để lưu lại cho bữa sau.'}
            </p>
          </div>
          <div className="pt-1">
            {search ? (
              <ActionButton variant="ceramic" onClick={() => setSearch('')}>
                Xem tất cả món đã lưu
              </ActionButton>
            ) : (
              <ActionButton variant="flame" to={`/recipes?servings=${servings}`}>
                Tìm món để lưu
              </ActionButton>
            )}
          </div>
        </BentoCard>
      ) : (
        <div className="family-favorites-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {entries.map((entry) => {
            const v4Img = resolveRecipeImageV4({
              id: entry.recipeId,
              title: entry.title,
              imageUrl: entry.imageUrl ?? '',
            });
            return (
              <article
                key={entry.recipeId}
                className="family-favorite-card group relative flex flex-col overflow-hidden rounded-[24px] border border-tk-stone/85 bg-white shadow-card transition-tap duration-200 hover:-translate-y-0.5 hover:shadow-elevated"
              >
                <div className="relative">
                  <RecipeMedia
                    image={v4Img}
                    title={entry.title}
                    aspectClass="aspect-[16/10]"
                    overlay={
                      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-1.5">
                        {entry.cookTimeMinutes !== null && (
                          <span className="tk-glass inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-tk-ink tk-tabular">
                            <Clock size={12} aria-hidden="true" className="text-tk-flame" />
                            {entry.cookTimeMinutes} phút
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                          {entry.roles.map((role) => roleLabel(role, 'vi')).join(' · ') ||
                            v4Img.categoryLabelVi}
                        </span>
                      </div>
                    }
                  />
                  <div className="absolute right-3 top-3 z-20">
                    <SaveRecipeButton recipeId={entry.recipeId} title={entry.title} compact glass />
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between gap-4 p-4 sm:p-5">
                  <div className="family-favorite-title space-y-1">
                    <h3 className="text-base sm:text-lg font-extrabold text-tk-ink leading-snug">
                      {entry.title}
                    </h3>
                    <p className="text-xs font-medium text-tk-muted">
                      {entry.roles.map((role) => roleLabel(role, 'vi')).join(' · ') || 'Món gia đình'} ·{' '}
                      {entry.cookTimeMinutes === null
                        ? 'Linh hoạt thời gian'
                        : `${entry.cookTimeMinutes} phút chế biến`}
                    </p>
                  </div>

                  {entry.available ? (
                    <div className="family-favorite-actions flex items-center gap-2.5 pt-2 border-t border-tk-stone/60">
                      <ActionButton
                        variant="ceramic"
                        size="sm"
                        className="flex-1"
                        to={`/recipes/id/${encodeURIComponent(entry.recipeId)}?servings=${servings}`}
                      >
                        Xem công thức
                      </ActionButton>
                      <ActionButton
                        variant="jade"
                        size="sm"
                        className="flex-1"
                        icon={<CalendarMealCheckIcon size={15} tone="cream" />}
                        onClick={() => setSelected(entry)}
                      >
                        Thêm vào bữa
                      </ActionButton>
                    </div>
                  ) : (
                    <p className="rounded-xl bg-tk-sunken px-3 py-2 text-xs text-tk-secondary">
                      Món này hiện không còn trong danh mục. Bạn có thể bỏ lưu.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selected && (
        <RecipeMealDialog
          entry={selected}
          defaultServings={servings}
          onClose={() => setSelected(null)}
        />
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
    ) {
      return;
    }
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
        if (!isCurrent()) throw new ApiError('auth', 'Phiên làm việc đã thay đổi.');
        if (!state.isSaved) throw new Error('Món vừa được bỏ lưu. Hãy tải lại danh sách.');
      }
      if (!isCurrent() || useAuthStore.getState().isGuest) return;
      const target = { kind: 'recipe' as const, recipeId: entry.recipeId };
      if (placement === 'replace' && existing) {
        await mealCompositionApi.swap(family.plan.id, selected.slotId, existing.id, {
          revision: family.plan.revision,
          target,
          role,
          locked: true,
        });
      } else {
        await mealCompositionApi.add(family.plan.id, selected.slotId, {
          revision: family.plan.revision,
          target,
          role,
          locked: true,
        });
      }
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

  return (
    <div
      className="planning-picker fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-tk-sanctuary/55 p-0 sm:p-4 backdrop-blur-xs animate-fade-in"
      onClick={() => {
        if (!busyRef.current) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="favorite-meal-title"
        onClick={(e) => e.stopPropagation()}
        className="family-dialog recipe-meal-dialog w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] border border-tk-stone bg-tk-canvas p-5 sm:p-6 shadow-elevated animate-slide-up space-y-4"
      >
        <div className="family-dialog-heading flex items-start justify-between gap-3 border-b border-tk-stone/80 pb-3.5">
          <div className="min-w-0">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-tk-jade">
              Xếp vào Thực đơn Gia đình
            </span>
            <h2 id="favorite-meal-title" className="mt-0.5 text-lg font-extrabold text-tk-ink leading-snug">
              Đặt {entry.title} vào bữa
            </h2>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Đóng"
            className="tap-target rounded-xl p-2 text-tk-muted hover:bg-tk-sunken hover:text-tk-ink transition-colors cursor-pointer flex items-center justify-center"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {guest ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-tk-secondary">Đăng nhập để chọn món cho bữa của gia đình.</p>
            <ActionButton
              variant="flame"
              fullWidth
              to={`/auth?mode=login&returnTo=${encodeURIComponent(`/recipes/id/${entry.recipeId}`)}`}
              onClick={onClose}
            >
              Đăng nhập để lên thực đơn
            </ActionButton>
          </div>
        ) : plan.isPending ? (
          <InlineLoading label="Đang tải các bữa…" />
        ) : plan.isError ? (
          <InlineError error={plan.error} onRetry={() => void plan.refetch()} />
        ) : done ? (
          <div role="status" className="rounded-2xl border border-tk-jade/25 bg-tk-jade-soft/70 p-4 space-y-3">
            <p className="text-sm font-bold text-tk-jade-deep">
              Đã đặt món vào bữa. Các món khác được giữ nguyên.
            </p>
            <ActionButton
              variant="jade"
              fullWidth
              to={`/planner/${family?.plan.id}/meal/${encodeURIComponent(selected?.slotId ?? '')}`}
              onClick={onClose}
            >
              Xem bữa vừa chọn
            </ActionButton>
          </div>
        ) : !family || !compositions.length ? (
          <div className="rounded-2xl border border-tk-stone bg-white p-4 space-y-3">
            <p className="text-sm text-tk-secondary">
              Chọn lịch và số người ăn để đặt món vào bữa tới.
            </p>
            <ActionButton
              variant="flame"
              fullWidth
              to={`/planner/new?recipe=${encodeURIComponent(entry.recipeId)}${handoffServings ? `&servings=${handoffServings}` : ''}`}
              onClick={onClose}
            >
              Tạo lịch trống để chọn món
            </ActionButton>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
            className="family-settings-form space-y-4"
          >
            <label className="block space-y-1.5 text-xs font-bold text-tk-ink">
              <span className="sr-only">Bữa</span>
              <span aria-hidden="true">Bữa ăn trong tuần</span>
              <select
                value={selected?.slotId ?? ''}
                onChange={(event) => {
                  setSlotId(event.target.value);
                  setPlacement('add');
                  setReplaceComponentId('');
                }}
                disabled={busy}
                className="w-full min-h-[44px] rounded-xl border border-tk-stone bg-white px-3.5 py-2 text-sm font-semibold text-tk-ink focus:border-tk-flame focus:outline-none"
              >
                {compositions.map((meal) => (
                  <option key={meal.slotId} value={meal.slotId}>
                    {meal.date} ·{' '}
                    {meal.mealType === 'breakfast'
                      ? 'Bữa sáng'
                      : meal.mealType === 'lunch'
                        ? 'Bữa trưa'
                        : 'Bữa tối'}{' '}
                    · {meal.servings} người
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5 text-xs font-bold text-tk-ink">
              <span className="sr-only">Nhóm món</span>
              <span aria-hidden="true">Nhóm món trên mâm cơm</span>
              <select
                value={role}
                onChange={(event) => {
                  setRole(event.target.value as MealRole);
                  setPlacement('add');
                  setReplaceComponentId('');
                }}
                disabled={busy || !roles.length}
                className="w-full min-h-[44px] rounded-xl border border-tk-stone bg-white px-3.5 py-2 text-sm font-semibold text-tk-ink focus:border-tk-flame focus:outline-none"
              >
                <option value="" disabled>
                  Chọn nhóm món
                </option>
                {roles.map((value) => (
                  <option key={value} value={value}>
                    {roleLabel(value, 'vi')}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="family-placement-choice rounded-2xl border border-tk-stone/80 bg-white p-3.5 space-y-2">
              <legend className="px-1 text-xs font-bold text-tk-ink">Đặt món theo cách nào?</legend>
              <div className="flex flex-wrap gap-3">
                <label
                  className={clsx(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer transition-colors',
                    placement === 'add'
                      ? 'border-tk-jade bg-tk-jade-soft text-tk-jade-deep'
                      : 'border-tk-stone bg-tk-canvas text-tk-secondary',
                  )}
                >
                  <input
                    type="radio"
                    name="favorite-placement"
                    value="add"
                    checked={placement === 'add'}
                    onChange={() => setPlacement('add')}
                    disabled={busy}
                  />
                  <span>Thêm món này</span>
                </label>

                {existingCandidates.length > 0 && (
                  <label
                    className={clsx(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer transition-colors',
                      placement === 'replace'
                        ? 'border-tk-flame bg-tk-flame-soft text-tk-flame-deep'
                        : 'border-tk-stone bg-tk-canvas text-tk-secondary',
                    )}
                  >
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
                    />
                    <span>Thay món cùng nhóm</span>
                  </label>
                )}
              </div>
            </fieldset>

            {placement === 'replace' && existingCandidates.length > 0 && (
              <label className="block space-y-1.5 text-xs font-bold text-tk-ink">
                <span>Món sẽ thay</span>
                <select
                  value={existing?.id ?? ''}
                  onChange={(event) => setReplaceComponentId(event.target.value)}
                  disabled={busy}
                  className="w-full min-h-[44px] rounded-xl border border-tk-stone bg-white px-3.5 py-2 text-sm font-semibold text-tk-ink focus:border-tk-flame focus:outline-none"
                >
                  {existingCandidates.map((component) => (
                    <option key={component.id} value={component.id}>
                      {component.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {placement === 'replace' && existing && (
              <p className="planning-notice rounded-xl bg-tk-turmeric-soft px-3.5 py-2.5 text-xs font-semibold text-tk-turmeric-deep border border-tk-turmeric/25">
                Món này sẽ thay “{existing.title}” ở vai trò{' '}
                {roleLabel(role as MealRole, 'vi').toLowerCase()}. Các món khác giữ nguyên.
              </p>
            )}

            {placement === 'add' && existingCandidates.length > 0 && (
              <p className="planning-note rounded-xl bg-tk-sunken px-3.5 py-2.5 text-xs text-tk-secondary">
                Món hiện có vẫn được giữ. Món đã chọn sẽ thêm thành một món nữa trong bữa.
              </p>
            )}

            {assessmentQuery.isPending || assessmentQuery.isFetching ? (
              <InlineLoading label="Đang kiểm tra lượng cho bữa đã chọn…" />
            ) : assessmentQuery.isError ? (
              <InlineError
                error={assessmentQuery.error}
                message={plannerErrorMessage(assessmentQuery.error, 'vi')}
                onRetry={() => void assessmentQuery.refetch()}
              />
            ) : !role && roles.length > 1 ? (
              <p className="planning-note text-xs font-medium text-tk-secondary">
                Chọn vai trò để kiểm tra lượng món trong bữa này.
              </p>
            ) : assessment ? (
              <IngredientCoverage
                assessment={assessment}
                locale="vi"
                servings={selected?.servings}
              />
            ) : (
              <p className="planning-notice rounded-xl bg-tk-berry-soft px-3.5 py-2.5 text-xs font-semibold text-tk-berry-deep">
                Chưa xác nhận được món này cho bữa đã chọn. Kiểm tra lại thực đơn và hạn chế thực phẩm.
              </p>
            )}

            {!!error && <InlineError error={error} message={plannerErrorMessage(error, 'vi')} />}

            <ActionButton
              type="submit"
              variant="flame"
              size="lg"
              fullWidth
              loading={busy}
              disabled={
                !role ||
                !assessment?.selectable ||
                assessmentQuery.isFetching ||
                (placement === 'replace' && !existing)
              }
            >
              {placement === 'replace' ? 'Thay món trong bữa' : 'Thêm vào bữa'}
            </ActionButton>
          </form>
        )}
      </div>
    </div>
  );
}
