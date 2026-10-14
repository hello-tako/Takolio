import { useEffect, useId, useRef, useState } from 'react';
import { Heart, Search, X } from 'lucide-react';
import type {
  MealRole,
  PickerCuisine,
  PickerItemDto,
} from '../../../../packages/domain/src/meal-composition-api';
import { MEAL_ROLES, PICKER_CUISINES } from '../../../../packages/domain/src/meal-composition-api';
import { Button } from '../../components/common/Button';
import { useModalFocus } from '../../design-system/use-modal-focus';
import { mealCompositionApi } from '../../services/meal-composition';
import { ApiError } from '../../services/http';
import { compositionCopy, componentTitle, cuisineLabel, roleLabel } from './composition';
import type { PlannerLocale } from './copy';
import { PlannerError } from './PlannerShell';
import { IngredientCoverage } from './IngredientCoverage';

export type PickerMealContext = {
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  servings: number;
};
export type PickerMealScope = {
  planId: string;
  slotId: string;
  revision: number;
  excludeComponentId?: string;
  noBuy?: boolean;
};
export function mealContextLabel(context: PickerMealContext, locale: PlannerLocale) {
  const meals =
    locale === 'vi'
      ? { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', dinner: 'Bữa tối' }
      : { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
  return `${context.date} · ${meals[context.mealType]} · ${context.servings} ${locale === 'vi' ? 'người' : 'servings'}`;
}

export function ComponentPicker({
  locale,
  initialRole,
  initialRecipeId,
  context,
  scope,
  intent = 'add',
  busy,
  mutationError,
  onChoose,
  onClose,
  onReloadPlan,
}: {
  locale: PlannerLocale;
  initialRole?: MealRole;
  initialRecipeId?: string;
  context?: PickerMealContext;
  scope?: PickerMealScope;
  intent?: 'add' | 'swap';
  busy: boolean;
  mutationError?: unknown;
  onChoose: (item: PickerItemDto, role: MealRole) => void;
  onClose: () => void;
  onReloadPlan?: () => void;
}) {
  const c = compositionCopy[locale];
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState<MealRole | ''>(initialRole ?? '');
  const [cuisine, setCuisine] = useState<PickerCuisine | ''>(
    initialRecipeId || initialRole === 'staple' || initialRole === 'simple_food'
      ? ''
      : 'vietnamese',
  );
  const [source, setSource] = useState<'catalog' | 'saved'>('catalog');
  const [query, setQuery] = useState('');
  const [handoffId, setHandoffId] = useState<string | undefined>(initialRecipeId);
  const [itemRoles, setItemRoles] = useState<Record<string, MealRole>>({});
  const [stockOnly, setStockOnly] = useState(scope?.noBuy ?? false);
  const filterKey = JSON.stringify([
    role,
    cuisine,
    source,
    query.trim(),
    handoffId,
    stockOnly,
    scope?.planId,
    scope?.slotId,
    scope?.revision,
    scope?.excludeComponentId,
    context?.date,
    context?.mealType,
    context?.servings,
  ]);
  const requestId = useRef(0);
  const [results, setResults] = useState<{
    key: string;
    items: PickerItemDto[];
    cursor: string | null;
    total: number;
    snapshot?: string;
  }>({ key: '', items: [], cursor: null, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ key: string; failure: unknown } | null>(null);
  const current = results.key === filterKey;
  const currentError = error?.key === filterKey ? error.failure : null;
  const pending = !currentError && (loading || !current);
  const planChanged =
    currentError instanceof ApiError && currentError.code === 'PLAN_REVISION_CONFLICT';
  useModalFocus(
    true,
    panel,
    () => {
      if (!busy) onClose();
    },
    searchRef,
  );

  async function load(reset: boolean, from: string | null) {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const page = await mealCompositionApi.picker({
        role: role || undefined,
        cuisine: cuisine || undefined,
        q: handoffId ?? (query.trim() || undefined),
        cursor: reset ? undefined : (from ?? undefined),
        limit: '20',
        savedOnly: source === 'saved' ? 'true' : undefined,
        ...(scope
          ? {
              planId: scope.planId,
              slotId: scope.slotId,
              revision: String(scope.revision),
              excludeComponentId: scope.excludeComponentId,
              noBuy: stockOnly ? 'true' : undefined,
              snapshot: reset ? undefined : results.snapshot,
            }
          : {}),
      });
      if (id !== requestId.current) return;
      if (
        scope &&
        (!page.scope ||
          page.scope.planId !== scope.planId ||
          page.scope.slotId !== scope.slotId ||
          page.scope.revision !== scope.revision ||
          page.scope.excludeComponentId !== (scope.excludeComponentId ?? null) ||
          (context &&
            (page.scope.date !== context.date ||
              page.scope.mealType !== context.mealType ||
              page.scope.servings !== context.servings)) ||
          (!reset && page.scope.snapshotId !== results.snapshot))
      ) {
        throw new ApiError('http', 'HTTP 409: {"code":"PICKER_SNAPSHOT_CHANGED"}', 409);
      }
      setResults((prior) => ({
        key: filterKey,
        items: reset || prior.key !== filterKey ? page.items : [...prior.items, ...page.items],
        cursor: page.nextCursor,
        total: page.total,
        snapshot: page.scope?.snapshotId,
      }));
    } catch (failure) {
      if (id === requestId.current) {
        setError({ key: filterKey, failure });
        setResults({ key: filterKey, items: [], cursor: null, total: 0 });
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(true, null), 200);
    return () => {
      window.clearTimeout(timer);
      requestId.current++;
    };
  }, [filterKey]);
  const filtered = !!(role || cuisine || query.trim() || handoffId || stockOnly);
  function selectRole(value: MealRole | '') {
    setRole(value);
    if (value === 'staple' || value === 'simple_food') setCuisine('');
  }
  function clearFilters() {
    setRole(initialRole ?? '');
    setCuisine('');
    setQuery('');
    setHandoffId(undefined);
    setStockOnly(false);
    searchRef.current?.focus();
  }
  return (
    <div className="planning-picker fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-semantic-overlay/50">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="planning-picker-panel w-full sm:max-w-lg max-h-[88dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
      >
        <div className="p-4 sm:p-5 border-b border-semantic-border/70 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id={titleId} className="font-heading font-bold text-lg">
                {c.pickerTitle}
              </h2>
              <p className="text-xs text-semantic-text-secondary mt-1">
                {intent === 'swap'
                  ? locale === 'vi'
                    ? 'Đổi món trong bữa này'
                    : 'Replace a dish in this meal'
                  : locale === 'vi'
                    ? 'Thêm món vào bữa này'
                    : 'Add a dish to this meal'}
              </p>
              {context && (
                <p className="planning-picker-context">{mealContextLabel(context, locale)}</p>
              )}
            </div>
            <Button variant="ghost" aria-label={c.close} disabled={busy} onClick={onClose}>
              <X size={18} />
            </Button>
          </div>
          {!!mutationError && <PlannerError error={mutationError} locale={locale} focus />}
          <div
            className="planning-picker-tabs"
            aria-label={locale === 'vi' ? 'Nguồn chọn món' : 'Dish source'}
          >
            <button
              type="button"
              aria-pressed={source === 'catalog'}
              disabled={busy}
              onClick={() => setSource('catalog')}
            >
              {locale === 'vi' ? 'Khám phá món' : 'Explore dishes'}
            </button>
            <button
              type="button"
              aria-pressed={source === 'saved'}
              disabled={busy}
              onClick={() => setSource('saved')}
            >
              <Heart size={15} aria-hidden="true" />
              {locale === 'vi' ? 'Món đã lưu' : 'Saved dishes'}
            </button>
          </div>
          <div className="space-y-2">
            <label className="relative block">
              <span className="sr-only">{c.search}</span>
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-semantic-text-muted"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                name="dish-search"
                autoComplete="off"
                type="search"
                value={query}
                disabled={busy}
                maxLength={80}
                onChange={(event) => {
                  setHandoffId(undefined);
                  setQuery(event.target.value);
                }}
                placeholder={c.search}
                className="w-full min-h-11 rounded-xl border border-semantic-border pl-9 pr-3 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="sr-only">{c.role}</span>
                <select
                  value={role}
                  disabled={busy || !!initialRole}
                  onChange={(event) => selectRole(event.target.value as MealRole | '')}
                  className="w-full min-h-11 rounded-xl border border-semantic-border px-3 text-sm bg-white"
                >
                  <option value="">{c.allRoles}</option>
                  {MEAL_ROLES.map((value) => (
                    <option key={value} value={value}>
                      {roleLabel(value, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">{c.cuisine}</span>
                <select
                  value={cuisine}
                  disabled={busy}
                  onChange={(event) => setCuisine(event.target.value as PickerCuisine | '')}
                  className="w-full min-h-11 rounded-xl border border-semantic-border px-3 text-sm bg-white"
                >
                  <option value="">{c.allCuisines}</option>
                  {PICKER_CUISINES.map((value) => (
                    <option key={value} value={value}>
                      {cuisineLabel(value, locale)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {scope && (
              <label className="planning-picker-stock">
                <input
                  type="checkbox"
                  checked={stockOnly}
                  disabled={busy}
                  onChange={(event) => setStockOnly(event.target.checked)}
                />
                {locale === 'vi'
                  ? 'Chỉ hiện món đủ lượng từ tủ lạnh'
                  : 'Only dishes covered by your fridge'}
              </label>
            )}
          </div>
        </div>
        <div className="planning-picker-results overflow-y-auto p-4 sm:p-5 flex-1">
          {!!currentError && (
            <>
              <p className="text-sm text-semantic-warning-strong mb-2">
                {locale === 'vi'
                  ? 'Chưa xác nhận được lượng cho bữa này. Tải lại trước khi chọn món.'
                  : 'Meal quantities are unconfirmed. Reload before choosing a dish.'}
              </p>
              <PlannerError
                error={currentError}
                locale={locale}
                onRetry={planChanged && onReloadPlan ? undefined : () => void load(true, null)}
              />
              {planChanged && onReloadPlan && (
                <Button variant="outline" disabled={busy} onClick={onReloadPlan}>
                  {locale === 'vi' ? 'Tải thực đơn mới nhất' : 'Load latest plan'}
                </Button>
              )}
            </>
          )}
          {handoffId && (
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm text-semantic-text-secondary">
                {locale === 'vi' ? 'Món bạn vừa chọn' : 'Your selected dish'}
              </p>
              <Button size="sm" variant="ghost" disabled={busy} onClick={clearFilters}>
                {locale === 'vi' ? 'Xem các món khác' : 'Browse other dishes'}
              </Button>
            </div>
          )}
          <p role="status" className="planning-picker-count">
            {currentError
              ? c.loadFailed
              : pending
                ? locale === 'vi'
                  ? 'Đang tìm món…'
                  : 'Finding dishes…'
                : locale === 'vi'
                  ? `${current ? results.total : 0} món phù hợp`
                  : `${current ? results.total : 0} dishes found`}
          </p>
          {!pending &&
            !currentError &&
            results.items.length === 0 &&
            (filtered ? (
              <div className="space-y-2">
                <p className="text-sm text-semantic-text-secondary">{c.noFilteredResults}</p>
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  {c.clearFilters}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-semantic-text-secondary">{c.noResults}</p>
            ))}
          <ul className="space-y-2">
            {(current && !currentError ? results.items : []).map((item) => {
              const title = componentTitle(item, locale);
              const itemKey = `${item.kind}:${item.id}`;
              const chosenRole =
                role && item.roles.includes(role)
                  ? role
                  : (itemRoles[itemKey] ?? (item.roles.length === 1 ? item.roles[0] : undefined));
              const selectable =
                (!scope || !!item.assessment) && item.assessment?.selectable !== false;
              return (
                <li key={itemKey} className="planning-picker-item">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-semantic-text-muted mt-0.5">
                      {item.roles.map((value) => roleLabel(value, locale)).join(' · ')}
                      {item.cookTimeMinutes !== null && ` · ${item.cookTimeMinutes}′`}
                    </p>
                    {item.roles.length > 1 && !role && (
                      <label className="planning-picker-item-role">
                        {c.role}: {title}
                        <select
                          value={chosenRole ?? ''}
                          disabled={busy}
                          onChange={(event) => {
                            const selected = event.target.value as MealRole;
                            if (scope) selectRole(selected);
                            else setItemRoles((prior) => ({ ...prior, [itemKey]: selected }));
                          }}
                        >
                          <option value="" disabled>
                            {locale === 'vi' ? 'Chọn vai trò' : 'Choose role'}
                          </option>
                          {item.roles.map((value) => (
                            <option key={value} value={value}>
                              {roleLabel(value, locale)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {item.assessment && (
                      <IngredientCoverage
                        assessment={item.assessment}
                        locale={locale}
                        servings={context?.servings}
                      />
                    )}
                    {scope && !item.assessment && (
                      <p className="text-xs text-semantic-warning-strong mt-2">
                        {locale === 'vi'
                          ? 'Chưa xác nhận nguyên liệu của món.'
                          : 'Ingredients are unconfirmed.'}
                      </p>
                    )}
                    {item.constraintState === 'unknown' && (
                      <p className="text-xs text-semantic-warning-strong mt-1">{c.safetyUnknown}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy || !chosenRole || !selectable}
                    aria-label={`${c.choose}: ${title}`}
                    onClick={() => chosenRole && selectable && onChoose(item, chosenRole)}
                  >
                    {c.choose}
                  </Button>
                </li>
              );
            })}
          </ul>
          {current && !currentError && results.cursor && (
            <Button
              variant="outline"
              fullWidth
              className="mt-3"
              disabled={pending || busy}
              onClick={() => void load(false, results.cursor)}
            >
              {c.loadMore}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
