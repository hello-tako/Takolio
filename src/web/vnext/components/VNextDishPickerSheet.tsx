import React, { useEffect, useId, useRef, useState } from 'react';
import { clsx } from 'clsx';
import {
  MEAL_ROLES,
  PICKER_CUISINES,
  type MealRole,
  type PickerCuisine,
  type PickerItemDto,
} from '../../../../packages/domain/src/meal-composition-api';
import { useModalFocus } from '../../design-system/use-modal-focus';
import { mealCompositionApi } from '../../services/meal-composition';
import { ApiError } from '../../services/http';
import {
  componentTitle,
  cuisineLabel,
  roleLabel,
} from '../../features/planner/composition';
import { plannerErrorMessage } from '../../features/planner/presentation';
import { VNextIcon } from './VNextIcons';
import { VerifiedDishImage } from './VNextMedia';

export interface VNextPickerScope {
  planId: string;
  slotId: string;
  revision: number;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  servings: number;
  excludeComponentId?: string;
  noBuy?: boolean;
}

const DISPLAY_ROLES: readonly MealRole[] = [
  'main',
  'soup',
  'vegetable',
  'side',
  'staple',
  'simple_food',
  'dessert',
];

export const VNextDishPickerSheet: React.FC<{
  open: boolean;
  intent: 'add' | 'swap';
  initialRole?: MealRole;
  initialRecipeId?: string | null;
  replacingTitle?: string | null;
  scope: VNextPickerScope;
  busy: boolean;
  mutationError?: unknown;
  onChoose: (item: PickerItemDto, role: MealRole) => void;
  onClose: () => void;
  onReloadPlan?: () => void;
}> = ({
  open,
  intent,
  initialRole,
  initialRecipeId,
  replacingTitle,
  scope,
  busy,
  mutationError,
  onChoose,
  onClose,
  onReloadPlan,
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const defaultRole: MealRole = initialRole ?? 'main';
  const [role, setRole] = useState<MealRole>(defaultRole);
  const [source, setSource] = useState<'catalog' | 'saved'>('catalog');
  const [cuisine, setCuisine] = useState<PickerCuisine | ''>('');
  const [query, setQuery] = useState('');
  const [handoffId, setHandoffId] = useState<string | undefined>(initialRecipeId ?? undefined);
  const [stockOnly, setStockOnly] = useState(Boolean(scope.noBuy));

  useEffect(() => {
    if (open) {
      setRole(initialRole ?? 'main');
      setSource('catalog');
      setCuisine('');
      setQuery('');
      setHandoffId(initialRecipeId ?? undefined);
      setStockOnly(Boolean(scope.noBuy));
    }
  }, [open, initialRole, initialRecipeId, scope.noBuy, scope.slotId, scope.excludeComponentId]);

  useModalFocus(
    open,
    panelRef,
    () => {
      if (!busy) onClose();
    },
    searchRef,
  );

  const filterKey = JSON.stringify([
    open,
    handoffId ? '' : role,
    source === 'saved' || handoffId ? '' : cuisine,
    source,
    query.trim(),
    handoffId ?? '',
    stockOnly,
    scope.planId,
    scope.slotId,
    scope.revision,
    scope.excludeComponentId ?? '',
  ]);

  const requestSeq = useRef(0);
  const [state, setState] = useState<{
    key: string;
    items: PickerItemDto[];
    nextCursor: string | null;
    total: number;
    snapshotId?: string;
    loading: boolean;
    error: unknown;
  }>({
    key: '',
    items: [],
    nextCursor: null,
    total: 0,
    loading: false,
    error: null,
  });

  const loadPage = async (reset: boolean, cursor: string | null) => {
    if (!open) return;
    const seq = ++requestSeq.current;
    setState((prev) => ({
      ...prev,
      loading: true,
      error: reset ? null : prev.error,
    }));

    const effectiveRole = handoffId ? undefined : role;
    const effectiveCuisine =
      source === 'saved' ||
      handoffId ||
      effectiveRole === 'staple' ||
      effectiveRole === 'simple_food'
        ? undefined
        : cuisine || undefined;

    try {
      const page = await mealCompositionApi.picker({
        savedOnly: source === 'saved' ? 'true' : undefined,
        role: effectiveRole,
        cuisine: effectiveCuisine,
        q: handoffId ?? (query.trim() || undefined),
        cursor: cursor ?? undefined,
        limit: '20',
        planId: scope.planId,
        slotId: scope.slotId,
        revision: String(scope.revision),
        excludeComponentId: scope.excludeComponentId,
        noBuy: stockOnly ? 'true' : undefined,
        snapshot: reset ? undefined : state.snapshotId,
      });

      if (seq !== requestSeq.current) return;
      setState((prev) => ({
        key: filterKey,
        items: reset ? page.items : [...prev.items, ...page.items],
        nextCursor: page.nextCursor,
        total: page.total,
        snapshotId: page.scope?.snapshotId,
        loading: false,
        error: null,
      }));
    } catch (failure) {
      if (seq !== requestSeq.current) return;
      setState((prev) => ({
        ...prev,
        key: filterKey,
        items: reset ? [] : prev.items,
        loading: false,
        error: failure,
      }));
    }
  };

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(
      () => {
        void loadPage(true, null);
      },
      query.trim() ? 180 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [filterKey, open]);

  if (!open) return null;

  const isRevisionConflict =
    state.error instanceof ApiError && state.error.code === 'PLAN_REVISION_CONFLICT';
  const activeError = mutationError ?? state.error;

  const handleSelectSource = (nextSource: 'catalog' | 'saved') => {
    setSource(nextSource);
    setHandoffId(undefined);
    if (nextSource === 'saved') {
      // Never hide international saved dishes behind a Vietnamese cuisine filter
      setCuisine('');
    }
  };

  const resolveChosenRole = (item: PickerItemDto): MealRole => {
    if (item.roles.includes(role)) return role;
    if (initialRole && item.roles.includes(initialRole)) return initialRole;
    return item.roles[0] ?? MEAL_ROLES[0];
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--tkv-ink)]/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="vnext-dish-picker-sheet"
        className="w-full sm:max-w-xl max-h-[88dvh] rounded-t-3xl sm:rounded-3xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] shadow-xl flex flex-col overflow-hidden"
      >
        {/* Sheet Header */}
        <div className="px-4 sm:px-5 pt-4 pb-3 bg-[var(--tkv-surface)] border-b border-[var(--tkv-border)] space-y-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="tkv-heading text-base sm:text-lg font-extrabold text-[var(--tkv-ink)] truncate"
              >
                {intent === 'swap'
                  ? replacingTitle
                    ? `Đổi món: ${replacingTitle}`
                    : 'Đổi món trong bữa'
                  : 'Thêm món vào mâm cơm'}
              </h2>
              <p className="text-xs text-[var(--tkv-ink-secondary)] tabular-nums mt-0.5">
                Khẩu phần {scope.servings} người · Đối chiếu tồn kho trực tiếp
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              aria-label="Đóng bảng chọn món"
              className="tkv-focusable w-9 h-9 rounded-full bg-[var(--tkv-bg)] border border-[var(--tkv-border)] flex items-center justify-center text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)] shrink-0"
            >
              <VNextIcon name="close" size={16} />
            </button>
          </div>

          {/* Catalog vs Saved Toggle + Stock Filter */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex rounded-full bg-[var(--tkv-bg)] border border-[var(--tkv-border)] p-0.5">
              <button
                type="button"
                aria-pressed={source === 'catalog'}
                onClick={() => handleSelectSource('catalog')}
                className={clsx(
                  'tkv-focusable px-3 py-1 rounded-full text-xs font-extrabold transition-colors',
                  source === 'catalog'
                    ? 'bg-[var(--tkv-primary)] text-white'
                    : 'text-[var(--tkv-ink-secondary)]',
                )}
              >
                Kho công thức
              </button>
              <button
                type="button"
                aria-pressed={source === 'saved'}
                onClick={() => handleSelectSource('saved')}
                className={clsx(
                  'tkv-focusable px-3 py-1 rounded-full text-xs font-extrabold transition-colors',
                  source === 'saved'
                    ? 'bg-[var(--tkv-primary)] text-white'
                    : 'text-[var(--tkv-ink-secondary)]',
                )}
              >
                Món đã lưu
              </button>
            </div>

            <button
              type="button"
              aria-pressed={stockOnly}
              onClick={() => setStockOnly((v) => !v)}
              className={clsx(
                'tkv-focusable px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
                stockOnly
                  ? 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] border-[var(--tkv-primary)]'
                  : 'bg-[var(--tkv-bg)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)]',
              )}
            >
              Đủ đồ trong tủ
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tkv-ink-muted)] pointer-events-none">
              <VNextIcon name="search" size={16} />
            </span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              disabled={busy}
              onChange={(e) => {
                setHandoffId(undefined);
                setQuery(e.target.value);
              }}
              placeholder="Tìm tên món hoặc nguyên liệu…"
              aria-label="Tìm món ăn"
              className="w-full min-h-[40px] rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] pl-9 pr-3 text-sm font-medium text-[var(--tkv-ink)] focus:outline-none focus:border-[var(--tkv-primary)]"
            />
          </div>

          {/* Unlocked Role Pills */}
          {!handoffId && (
            <div
              role="group"
              aria-label="Nhóm vai trò món ăn"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
            >
              {DISPLAY_ROLES.map((r) => {
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={active}
                    disabled={busy}
                    onClick={() => {
                      setRole(r);
                      if (r === 'staple' || r === 'simple_food') setCuisine('');
                    }}
                    className={clsx(
                      'tkv-focusable shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap',
                      active
                        ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                        : 'bg-[var(--tkv-bg)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-mint)]',
                    )}
                  >
                    {roleLabel(r, 'vi')}
                  </button>
                );
              })}
            </div>
          )}

          {/* Optional Cuisine Pills (hidden on Saved tab or Staple/Simple food) */}
          {source === 'catalog' &&
            !handoffId &&
            role !== 'staple' &&
            role !== 'simple_food' && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  aria-pressed={cuisine === ''}
                  onClick={() => setCuisine('')}
                  className={clsx(
                    'tkv-focusable shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors',
                    cuisine === ''
                      ? 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] border-[var(--tkv-border-mint)]'
                      : 'bg-transparent text-[var(--tkv-ink-muted)] border-transparent hover:border-[var(--tkv-border)]',
                  )}
                >
                  Mọi ẩm thực
                </button>
                {PICKER_CUISINES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={cuisine === c}
                    onClick={() => setCuisine(cuisine === c ? '' : c)}
                    className={clsx(
                      'tkv-focusable shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors whitespace-nowrap',
                      cuisine === c
                        ? 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] border-[var(--tkv-border-mint)]'
                        : 'bg-transparent text-[var(--tkv-ink-muted)] border-transparent hover:border-[var(--tkv-border)]',
                    )}
                  >
                    {cuisineLabel(c, 'vi')}
                  </button>
                ))}
              </div>
            )}
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2.5">
          {handoffId && (
            <div className="rounded-xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-3 py-2 flex items-center justify-between gap-2 text-xs font-bold text-[var(--tkv-primary)]">
              <span>Món bạn vừa chọn từ kho công thức</span>
              <button
                type="button"
                onClick={() => setHandoffId(undefined)}
                className="underline font-extrabold"
              >
                Xem món khác
              </button>
            </div>
          )}

          {Boolean(activeError) && (
            <div
              role="alert"
              className="rounded-xl bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] p-3 text-xs font-semibold text-[var(--tkv-coral-ink)] flex items-center justify-between gap-2"
            >
              <span>{plannerErrorMessage(activeError, 'vi')}</span>
              {isRevisionConflict && onReloadPlan && (
                <button
                  type="button"
                  onClick={onReloadPlan}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-white border border-[var(--tkv-border-coral)] font-extrabold"
                >
                  Tải lại
                </button>
              )}
            </div>
          )}

          <p role="status" className="text-[11px] font-bold text-[var(--tkv-ink-muted)] px-1 tabular-nums">
            {state.loading && state.items.length === 0
              ? 'Đang tìm món phù hợp…'
              : `${state.total} món phù hợp`}
          </p>

          {!state.loading && !state.error && state.items.length === 0 && (
            <div className="rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-5 text-center space-y-2">
              <p className="text-sm font-bold text-[var(--tkv-ink)]">
                {source === 'saved'
                  ? 'Chưa có món đã lưu khớp bộ lọc này'
                  : 'Không tìm thấy món khớp bộ lọc hiện tại'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCuisine('');
                  setStockOnly(false);
                  setHandoffId(undefined);
                }}
                className="tkv-focusable px-3.5 py-1.5 rounded-full bg-[var(--tkv-surface-mint)] text-xs font-extrabold text-[var(--tkv-primary)]"
              >
                Xoá bộ lọc tìm kiếm
              </button>
            </div>
          )}

          <ul className="space-y-2">
            {state.items.map((item) => {
              const title = componentTitle(item, 'vi');
              const chosenRole = resolveChosenRole(item);
              const selectable = item.assessment?.selectable !== false;
              const missingCount = item.assessment?.missingCount ?? 0;
              const isCovered = item.assessment?.status === 'covered';

              return (
                <li
                  key={`${item.kind}:${item.id}`}
                  className="rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-2.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <VerifiedDishImage
                      recipeId={item.kind === 'recipe' ? item.id : undefined}
                      title={title}
                      aspectClass="aspect-square"
                      compact
                      className="w-12 h-12 rounded-xl shrink-0 border border-[var(--tkv-border)]"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-[var(--tkv-ink)] leading-snug line-clamp-1">
                        {title}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-semibold text-[var(--tkv-ink-secondary)] mt-0.5 tabular-nums">
                        <span className="text-[var(--tkv-primary)] font-bold">
                          {roleLabel(chosenRole, 'vi')}
                        </span>
                        {item.cookTimeMinutes !== null && (
                          <>
                            <span>·</span>
                            <span>{item.cookTimeMinutes}p</span>
                          </>
                        )}
                        {item.assessment && (
                          <>
                            <span>·</span>
                            <span
                              className={
                                isCovered
                                  ? 'text-[var(--tkv-primary)] font-bold'
                                  : 'text-[var(--tkv-coral-ink)]'
                              }
                            >
                              {isCovered
                                ? 'Đủ đồ trong tủ'
                                : missingCount > 0
                                  ? `Mua thêm ${missingCount}`
                                  : 'Cần mua thêm'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={busy || !selectable}
                    aria-label={`${intent === 'swap' ? 'Đổi sang' : 'Chọn'}: ${title}`}
                    onClick={() => onChoose(item, chosenRole)}
                    className="tkv-focusable shrink-0 min-h-[38px] px-3.5 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] disabled:opacity-40 text-white text-xs font-extrabold transition-colors"
                  >
                    {intent === 'swap' ? 'Đổi' : 'Thêm'}
                  </button>
                </li>
              );
            })}
          </ul>

          {state.nextCursor && !state.error && (
            <button
              type="button"
              disabled={busy || state.loading}
              onClick={() => void loadPage(false, state.nextCursor)}
              className="tkv-focusable w-full min-h-[40px] rounded-xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] text-xs font-extrabold text-[var(--tkv-primary)]"
            >
              {state.loading ? 'Đang tải thêm…' : 'Xem thêm món'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
