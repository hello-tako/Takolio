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
import { roleLabel } from '../planner/composition';
import { IngredientCoverage } from '../planner/IngredientCoverage';
import { plannerErrorMessage } from '../planner/presentation';
import { isPlannerSlotElapsed, plannerDefaultTimes, plannerSlotId, plannerSlotTime } from '../planner/schedule';
import type { MealRole } from '../../../../packages/domain/src/meal-composition-api';

export type RecipeMealDialogEntry = {
  recipeId: string;
  title: string;
  roles?: MealRole[];
};

export function FavoritesCollection() {
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
  if (guest)
    return (
      <div className="planning-empty">
        <Heart size={32} aria-hidden="true" />
        <h2>Giữ những món nhà mình thích</h2>
        <p>Đăng nhập để lưu và chọn nhanh cho bữa tới.</p>
        <Link
          className="planning-primary-link"
          to="/auth?mode=login&returnTo=%2Frecipes%3Fview%3Dsaved"
        >
          Đăng nhập để lưu món
        </Link>
      </div>
    );
  return (
    <section className="family-favorites" aria-labelledby="favorite-heading">
      <div className="family-collection-heading">
        <div>
          <h2 id="favorite-heading">Món nhà mình đã lưu</h2>
          <p>Những món muốn nấu lại, sẵn để chọn cho bữa tới.</p>
        </div>
        <label>
          <span className="sr-only">Tìm món đã lưu</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm trong món đã lưu…"
            autoComplete="off"
          />
        </label>
      </div>
      {query.isPending ? (
        <InlineLoading label="Đang tải món đã lưu…" />
      ) : query.isError ? (
        <InlineError error={query.error} onRetry={() => void query.refetch()} />
      ) : !entries.length ? (
        <div className="planning-empty">
          <Heart size={32} aria-hidden="true" />
          <h3>{search ? 'Không có món khớp' : 'Bắt đầu từ món quen của nhà mình'}</h3>
          <p>Chạm trái tim trên món muốn nấu lần sau. Món được lưu cho tài khoản của bạn.</p>
        </div>
      ) : (
        <div className="family-favorites-grid">
          {entries.map((entry) => (
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
                <h3>{entry.title}</h3>
                <SaveRecipeButton recipeId={entry.recipeId} title={entry.title} compact />
              </div>
              <p>
                {entry.roles.map((role) => roleLabel(role, 'vi')).join(' · ') || 'Chưa rõ vai trò'}{' '}
                ·{' '}
                {entry.cookTimeMinutes === null
                  ? 'Chưa rõ thời gian'
                  : `${entry.cookTimeMinutes} phút`}
              </p>
              {entry.available ? (
                <div className="family-favorite-actions">
                  <Link
                    className="planning-text-link"
                    to={`/recipes/id/${encodeURIComponent(entry.recipeId)}`}
                  >
                    Xem công thức
                  </Link>
                  <Button onClick={() => setSelected(entry)}>Thêm vào bữa</Button>
                </div>
              ) : (
                <p>Món này hiện không còn trong danh mục. Bạn có thể bỏ lưu.</p>
              )}
            </article>
          ))}
        </div>
      )}
      {selected && <RecipeMealDialog entry={selected} onClose={() => setSelected(null)} />}
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
      { time: plannerSlotTime(family!.plan, plannerSlotId(slot)) ?? defaultTimes[slot.mealType],
        sequence: slot.sequence },
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
        if (!isCurrent()) throw new ApiError('auth', 'Phiên làm việc đã thay đổi.');
        if (!state.isSaved) throw new Error('Món vừa được bỏ lưu. Hãy tải lại danh sách.');
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
  return (
    <div className="planning-picker fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-semantic-overlay/50">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="favorite-meal-title"
        className="family-dialog"
      >
        <div className="family-dialog-heading">
          <h2 id="favorite-meal-title">Đặt {entry.title} vào bữa</h2>
          <Button variant="ghost" disabled={busy} onClick={onClose} aria-label="Đóng">
            <X size={20} aria-hidden="true" />
          </Button>
        </div>
        {guest ? (
          <div>
            <p>Đăng nhập để chọn món cho bữa của gia đình.</p>
            <Link
              className="planning-primary-link"
              to={`/auth?mode=login&returnTo=${encodeURIComponent(`/recipes/id/${entry.recipeId}`)}`}
              onClick={onClose}
            >
              Đăng nhập để lên thực đơn
            </Link>
          </div>
        ) : plan.isPending ? (
          <InlineLoading label="Đang tải các bữa…" />
        ) : plan.isError ? (
          <InlineError error={plan.error} onRetry={() => void plan.refetch()} />
        ) : done ? (
          <div role="status">
            <p>Đã đặt món vào bữa. Các món khác được giữ nguyên.</p>
            <Link
              className="planning-primary-link"
              to={`/planner/${family?.plan.id}/meal/${encodeURIComponent(selected?.slotId ?? '')}`}
              onClick={onClose}
            >
              Xem bữa vừa chọn
            </Link>
          </div>
        ) : !family || !compositions.length ? (
          <div>
            <p>Chọn lịch và số người ăn để đặt món vào bữa tới.</p>
            <Link
              className="planning-primary-link"
              to={`/planner/new?recipe=${encodeURIComponent(entry.recipeId)}${handoffServings ? `&servings=${handoffServings}` : ''}`}
              onClick={onClose}
            >
              Tạo lịch trống để chọn món
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
              Bữa
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
            <label>
              Vai trò
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
                  Chọn vai trò cho món
                </option>
                {roles.map((value) => (
                  <option key={value} value={value}>
                    {roleLabel(value, 'vi')}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="family-placement-choice">
              <legend>Đặt món theo cách nào?</legend>
              <label>
                <input
                  type="radio"
                  name="favorite-placement"
                  value="add"
                  checked={placement === 'add'}
                  onChange={() => setPlacement('add')}
                  disabled={busy}
                />{' '}
                Thêm món này
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
                  Thay một món trong vai trò đã chọn
                </label>
              )}
            </fieldset>
            {placement === 'replace' && existingCandidates.length > 0 && (
              <label>
                Món sẽ thay
                <select
                  value={existing?.id ?? ''}
                  onChange={(event) => setReplaceComponentId(event.target.value)}
                  disabled={busy}
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
              <p className="planning-notice">
                Món này sẽ thay “{existing.title}” ở vai trò{' '}
                {roleLabel(role as MealRole, 'vi').toLowerCase()}. Các món khác giữ nguyên.
              </p>
            )}
            {placement === 'add' && existingCandidates.length > 0 && (
              <p className="planning-note">
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
              <p className="planning-note">Chọn vai trò để kiểm tra lượng món trong bữa này.</p>
            ) : assessment ? (
              <IngredientCoverage
                assessment={assessment}
                locale="vi"
                servings={selected?.servings}
              />
            ) : (
              <p className="planning-notice">
                Chưa xác nhận được món này cho bữa đã chọn. Kiểm tra lại thực đơn và hạn chế thực
                phẩm.
              </p>
            )}
            {!!error && <InlineError error={error} message={plannerErrorMessage(error, 'vi')} />}
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
              {placement === 'replace' ? 'Thay món trong bữa' : 'Thêm vào bữa'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
