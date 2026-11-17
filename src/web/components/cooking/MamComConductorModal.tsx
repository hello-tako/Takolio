import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Flame, Plus, Search, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import {
  buildParallelMamComTimeline,
  evaluateRecipeMatch,
  type MamComColorSlot,
  type Recipe,
  type RecipeScoringContext,
} from '@frigo/recipes';
import { recipesApi } from '../../services/recipes';
import {
  ActionButton,
  AtelierBadge,
  SlideDrawer,
} from '../../design-system/v4/AtelierPrimitives';
import { HouseholdTrayIcon } from '../../design-system/icons';
import { resolveRecipeImageV4 } from '../../lib/recipe-media';

interface MamComConductorModalProps {
  open: boolean;
  onClose: () => void;
  primaryRecipe: Recipe;
  currentRecipes: Recipe[];
  servings: number;
  inventory: RecipeScoringContext['inventory'];
  dark?: boolean;
  onApplyMamCom: (recipes: Recipe[]) => void;
  onReturnSingleDish?: () => void;
}

const SLOT_BADGE_STYLES: Record<MamComColorSlot, string> = {
  terracotta: 'bg-tk-flame text-white',
  jade: 'bg-tk-jade text-white',
  amber: 'bg-tk-turmeric text-white',
  cobalt: 'bg-tk-ocean text-white',
};

export const MamComConductorModal: React.FC<MamComConductorModalProps> = ({
  open,
  onClose,
  primaryRecipe,
  currentRecipes,
  servings,
  inventory,
  dark = true,
  onApplyMamCom,
  onReturnSingleDish,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const initial = currentRecipes.length > 0 ? currentRecipes.map((r) => r.id) : [primaryRecipe.id];
    return initial.includes(primaryRecipe.id) ? initial : [primaryRecipe.id, ...initial.slice(0, 2)];
  });
  const [search, setSearch] = useState('');
  const [catalogRecipes, setCatalogRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    recipesApi
      .getRecommendations()
      .then((matches) => {
        if (active) setCatalogRecipes(matches.map((m) => m.recipe));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open]);

  const candidatePool = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi');
    return catalogRecipes.filter((r) => r.id !== primaryRecipe.id)
      .filter((r) => !q || r.title.toLocaleLowerCase('vi').includes(q))
      .map((r) => ({
        recipe: r,
        match: evaluateRecipeMatch(r, { inventory }),
      }))
      .sort((a, b) => {
        // Complementary category boost (if primary is braise, boost soup & stir-fry!)
        const compA = a.recipe.category !== primaryRecipe.category ? 15 : 0;
        const compB = b.recipe.category !== primaryRecipe.category ? 15 : 0;
        return b.match.matchPercentage + compB - (a.match.matchPercentage + compA);
      })
      .slice(0, 18);
  }, [catalogRecipes, primaryRecipe.id, primaryRecipe.category, inventory, search]);

  const selectedRecipes = useMemo(() => {
    const map = new Map<string, Recipe>();
    map.set(primaryRecipe.id, primaryRecipe);
    for (const r of currentRecipes) map.set(r.id, r);
    for (const r of catalogRecipes) map.set(r.id, r);
    return selectedIds.map((id) => map.get(id)).filter((r): r is Recipe => Boolean(r));
  }, [selectedIds, primaryRecipe, currentRecipes, catalogRecipes]);

  const previewPlan = useMemo(
    () => buildParallelMamComTimeline(selectedRecipes, servings),
    [selectedRecipes, servings],
  );

  const toggleDish = (recipeId: string) => {
    if (recipeId === primaryRecipe.id) return;
    setSelectedIds((prev) => {
      if (prev.includes(recipeId)) {
        return prev.filter((id) => id !== recipeId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, recipeId];
    });
  };

  return (
    <SlideDrawer
      open={open}
      onClose={onClose}
      dark={dark}
      widthClass="max-w-xl"
      title="Đạo Diễn Mâm Cơm Song Song"
      subtitle="Phối hợp 2–3 món nhịp nhàng để dọn lên mâm nóng hổi cùng một lúc"
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {currentRecipes.length > 1 && onReturnSingleDish && (
            <ActionButton
              variant={dark ? 'sanctuary' : 'ceramic'}
              size="md"
              onClick={() => {
                onReturnSingleDish();
                onClose();
              }}
            >
              Về nấu 1 món chính
            </ActionButton>
          )}
          <ActionButton
            variant="flame"
            size="lg"
            fullWidth
            disabled={selectedRecipes.length < 2}
            icon={<HouseholdTrayIcon size={18} tone="cream" />}
            onClick={() => {
              onApplyMamCom(selectedRecipes);
              onClose();
            }}
          >
            {selectedRecipes.length < 2
              ? 'Chọn thêm 1–2 món ăn kèm bên dưới'
              : `Bắt đầu Mâm Cơm ${selectedRecipes.length} Món (${previewPlan.parallelTotalMinutes} phút)`}
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Live Parallel Timeline Savings Preview */}
        <div
          className={clsx(
            'rounded-3xl border p-4 space-y-3',
            dark
              ? 'border-tk-jade/40 bg-gradient-to-br from-tk-sanctuary-elevated to-emerald-950/40 text-white'
              : 'border-tk-jade/25 bg-gradient-to-br from-tk-jade-soft/75 to-white text-tk-ink',
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <AtelierBadge
              tone="jade"
              icon={<Sparkles size={12} aria-hidden="true" />}
            >
              Lịch trình Bếp Trưởng V4 · {servings} người
            </AtelierBadge>
            {previewPlan.savedMinutes > 0 && (
              <span className="rounded-full bg-tk-flame px-2.5 py-0.5 text-xs font-extrabold text-white tk-tabular">
                Tiết kiệm {previewPlan.savedMinutes} phút chờ ninh/ướp!
              </span>
            )}
          </div>

          <p className="text-sm font-extrabold leading-snug">{previewPlan.summaryHeadlineVi}</p>

          {/* Selected Dishes Chips */}
          <div className="space-y-1.5">
            {previewPlan.dishes.map((dish, idx) => (
              <div
                key={dish.recipeId}
                className={clsx(
                  'flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-xs',
                  dark ? 'border-white/10 bg-black/25' : 'border-tk-stone bg-white',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={clsx(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold',
                      SLOT_BADGE_STYLES[dish.dishColorSlot],
                    )}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-extrabold truncate">{dish.title}</p>
                    <p className="opacity-70 text-[11px]">{dish.dishRoleVi}</p>
                  </div>
                </div>
                {dish.recipeId === primaryRecipe.id ? (
                  <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">
                    Món gốc
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleDish(dish.recipeId)}
                    className="shrink-0 text-xs font-bold text-tk-flame hover:underline cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                )}
              </div>
            ))}
          </div>

          {selectedRecipes.length >= 2 && (
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs opacity-85 tk-tabular">
              <span className="inline-flex items-center gap-1">
                <Clock size={13} aria-hidden="true" />
                Nấu nối tiếp: {previewPlan.sequentialTotalMinutes}p → Song song:{' '}
                <strong>{previewPlan.parallelTotalMinutes}p</strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <Flame size={13} aria-hidden="true" className="text-tk-flame" />
                Tối đa {previewPlan.burnerConcurrencyPeak || 1} bếp cùng lúc
              </span>
            </div>
          )}
        </div>

        {/* Search & Pick Companion Dishes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider opacity-80">
              Chọn thêm món canh / xào ăn kèm (tối đa 3 món)
            </h3>
            <span className="text-xs font-bold tk-tabular opacity-70">
              Đã chọn {selectedIds.length}/3
            </span>
          </div>

          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 opacity-55"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm canh chua, rau muống xào, đậu phụ…"
              className={clsx(
                'w-full min-h-[44px] rounded-2xl border pl-10 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-tk-flame',
                dark
                  ? 'border-white/15 bg-tk-sanctuary-elevated text-white placeholder:text-white/45'
                  : 'border-tk-stone bg-white text-tk-ink placeholder:text-tk-muted',
              )}
            />
          </div>

          <div className="space-y-2">
            {candidatePool.map(({ recipe: cand, match }) => {
              const isSelected = selectedIds.includes(cand.id);
              const disabledAdd = !isSelected && selectedIds.length >= 3;
              const img = resolveRecipeImageV4(cand);

              return (
                <button
                  key={cand.id}
                  type="button"
                  disabled={disabledAdd}
                  onClick={() => toggleDish(cand.id)}
                  className={clsx(
                    'w-full flex items-center justify-between gap-3 rounded-2xl border p-2.5 text-left transition-tap cursor-pointer',
                    isSelected
                      ? dark
                        ? 'border-tk-flame bg-tk-flame/20 text-white'
                        : 'border-tk-flame bg-tk-flame-soft text-tk-ink'
                      : dark
                        ? 'border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-40'
                        : 'border-tk-stone bg-white text-tk-ink hover:bg-tk-canvas disabled:opacity-40',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={img.src}
                      alt=""
                      width={52}
                      height={52}
                      loading="lazy"
                      className="h-13 w-13 shrink-0 rounded-xl object-cover bg-tk-sunken"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold truncate">{cand.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs opacity-80 tk-tabular">
                        <span>{img.categoryLabelVi}</span>
                        <span>·</span>
                        <span>{cand.cookTimeMinutes} phút</span>
                        <span>·</span>
                        <span className="font-bold text-emerald-400">
                          Khớp tủ {match.matchPercentage}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={clsx(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border',
                      isSelected
                        ? 'border-tk-flame bg-tk-flame text-white'
                        : 'border-current/20',
                    )}
                  >
                    {isSelected ? <Check size={16} /> : <Plus size={16} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </SlideDrawer>
  );
};
