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
import type { MealRole } from '../../../../packages/domain/src/meal-composition-api';

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
      {selected && <FavoriteMealDialog entry={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
function FavoriteMealDialog({ entry, onClose }: { entry: FavoriteEntry; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  const [slotId, setSlotId] = useState('');
  const [role, setRole] = useState<MealRole>(entry.roles[0] ?? 'main');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const plan = useQuery({
    queryKey: [...queryKeys.currentMealPlanningPlan(), 'favorite-picker'],
    queryFn: familyMealPlanningApi.current,
    retry: false,
  });
  const isCurrent = capturePrivateSession();
  const family = plan.data?.plan;
  const compositions = family?.compositions.compositions ?? [];
  const selected = compositions.find((meal) => meal.slotId === (slotId || compositions[0]?.slotId));
  const existing = selected?.components.find((component) => component.role === role);
  useModalFocus(true, panel, () => {
    if (!busy) onClose();
  });
  async function add() {
    if (!family || !selected) return;
    const keys = [
      queryKeys.mealPlanningPlan(family.plan.id),
      queryKeys.currentMealPlanningPlan(),
      queryKeys.mealPlanningCompositionsForPlan(family.plan.id),
    ];
    setBusy(true);
    setError(null);
    try {
      const state = await recipeFavoritesApi.state(entry.recipeId);
      if (!isCurrent()) throw new ApiError('auth', 'Phiên làm việc đã thay đổi.');
      if (!state.isSaved) throw new Error('Món vừa được bỏ lưu. Hãy tải lại danh sách.');
      const target = { kind: 'recipe' as const, recipeId: entry.recipeId };
      if (existing)
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
      if (isCurrent()) setBusy(false);
    }
  }
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
        {plan.isPending ? (
          <InlineLoading label="Đang tải các bữa…" />
        ) : plan.isError ? (
          <InlineError error={plan.error} onRetry={() => void plan.refetch()} />
        ) : done ? (
          <div role="status">
            <p>Đã đặt món vào bữa. Các vai trò khác được giữ nguyên.</p>
            <Link
              className="planning-primary-link"
              to={`/planner/${family?.plan.id}`}
              onClick={onClose}
            >
              Xem thực đơn
            </Link>
          </div>
        ) : !family ? (
          <div>
            <p>Tạo thực đơn trước để đặt món vào bữa.</p>
            <Link className="planning-primary-link" to="/planner/new" onClick={onClose}>
              Tạo thực đơn
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
                onChange={(event) => setSlotId(event.target.value)}
                disabled={busy}
              >
                {compositions.map((meal) => (
                  <option key={meal.slotId} value={meal.slotId}>
                    {meal.date} ·{' '}
                    {meal.mealType === 'breakfast'
                      ? 'Bữa sáng'
                      : meal.mealType === 'lunch'
                        ? 'Bữa trưa'
                        : 'Bữa tối'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vai trò
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as MealRole)}
                disabled={busy}
              >
                {entry.roles.map((value) => (
                  <option key={value} value={value}>
                    {roleLabel(value, 'vi')}
                  </option>
                ))}
              </select>
            </label>
            {existing && (
              <p className="planning-notice">
                Món này sẽ thay “{existing.title}” ở vai trò {roleLabel(role, 'vi').toLowerCase()}.
                Các món khác giữ nguyên.
              </p>
            )}
            {!!error && <InlineError error={error} />}
            <Button type="submit" isLoading={busy} disabled={!entry.roles.length}>
              Đặt vào bữa
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
