import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  enrichRecipeToV4,
  evaluateRecipeAvailability,
  evaluateRecipeDietarySafetyV4,
  scaleRecipeV4,
  type CulinaryPhaseV4,
  type Recipe,
  type RecipeIngredientAvailability,
  type RecipeStepV4,
  type StepCookwareV4,
  type StepHeatLevelV4,
} from '@frigo/recipes';
import { isPantryStapleIngredient } from '@frigo/domain';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  Minus,
  Plus,
  SearchX,
  Sparkles,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { TopBar } from '../components/common/TopBar';
import { SaveRecipeButton } from '../components/common/SaveRecipeButton';
import { RecipeMedia } from '../components/common/RecipeMedia';
import { InlineError, SkeletonCard } from '../components/common/AsyncState';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
  RadialProgressRing,
} from '../design-system/v4/AtelierPrimitives';
import {
  AllergenShieldIcon,
  BambooSteamerIcon,
  CalendarMealCheckIcon,
  CaloriesLeafIcon,
  ChefKnifeBoardIcon,
  ClaypotBraiseIcon,
  FishSauceCruetIcon,
  FlameHighIcon,
  FlameLowIcon,
  FlameMediumIcon,
  FlameOffIcon,
  FreshnessShieldIcon,
  HouseholdTrayIcon,
  IngredientSwapIcon,
  MarinateBowlIcon,
  MultiTimerIcon,
  NavShoppingIcon,
  PlatingSparkleIcon,
  PortionScaleIcon,
  SensoryAromaIcon,
  StockpotSoupIcon,
  ThreeDOrbitBadgeIcon,
  WokFlameIcon,
} from '../design-system/icons';
import { TakoChef3D } from '../components/3d';
import { api, ApiError } from '../services/api';
import { aiCopilotApi, type SmartSubstitutionResponse } from '../services/ai-copilot';
import { queryKeys } from '../lib/queryKeys';
import { useCookingStore } from '../stores/useCookingStore';
import { getIngredientImage } from '../lib/ingredient-images';
import { resolveRecipeImage, resolveRecipeImageV4 } from '../lib/recipe-media';
import { formatDifficultyLabel } from '../lib/culinary-visuals';
import { KitchenLoopStrip } from '../components/cooking/CookingTechniqueVisual';
import { MamComConductorModal } from '../components/cooking/MamComConductorModal';
import { RecipeMealDialog } from '../features/favorites/FavoritesCollection';
import { useFamilyPreferences } from '../features/family/useFamilyPreferences';
import { isMealPlannerEnabled } from '../features/planner/feature';
import { isMealCompositionEnabled } from '../features/planner/composition';
import { useAuthStore } from '../stores/useAuthStore';

type RecipeTabId = 'ingredients' | 'steps' | 'nutrition';

type ShoppingShortfall = {
  ingredient: RecipeIngredientAvailability;
  sourceRecipeKey: string;
  sourceRecipeTitle: string;
};

function shoppingEntryKey(recipeKey: string, ingredient: RecipeIngredientAvailability) {
  return JSON.stringify([
    recipeKey,
    ingredient.ingredientId,
    ingredient.unit,
    ingredient.isOptional,
  ]);
}

const RECIPE_TABS: Array<{ id: RecipeTabId; label: string; tabId: string; panelId: string }> = [
  {
    id: 'ingredients',
    label: 'Nguyên liệu & Tủ lạnh',
    tabId: 'recipe-detail-tab-ingredients',
    panelId: 'recipe-detail-panel-ingredients',
  },
  {
    id: 'steps',
    label: 'Lộ trình 4 pha chế biến',
    tabId: 'recipe-detail-tab-steps',
    panelId: 'recipe-detail-panel-steps',
  },
  {
    id: 'nutrition',
    label: 'Dinh dưỡng & An toàn',
    tabId: 'recipe-detail-tab-nutrition',
    panelId: 'recipe-detail-panel-nutrition',
  },
];

const PHASE_ORDER: ReadonlyArray<{
  phase: CulinaryPhaseV4;
  code: string;
  titleVi: string;
  subtitleVi: string;
}> = [
  {
    phase: 'mise_en_place',
    code: '01',
    titleVi: 'Sơ chế chuẩn bếp (Mise en Place)',
    subtitleVi: 'Rửa sạch, cắt thái đúng thớ để nguyên liệu chín đều',
  },
  {
    phase: 'marinate',
    code: '02',
    titleVi: 'Tẩm ướp thấm vị',
    subtitleVi: 'Ướp cốt gia vị giúp nguyên liệu đậm đà từ bên trong',
  },
  {
    phase: 'active_cook',
    code: '03',
    titleVi: 'Chế biến trên bếp',
    subtitleVi: 'Canh chuẩn nhiệt độ lửa, âm thanh và hương thơm dậy mùi',
  },
  {
    phase: 'plate',
    code: '04',
    titleVi: 'Trình bày & Thưởng thức',
    subtitleVi: 'Dọn ra đĩa nóng hổi, điểm xuyết rau thơm dậy sắc',
  },
];

const QUICK_PORTION_PILLS = [1, 2, 4, 6, 8, 12] as const;

function renderCookwareIcon(cookware: StepCookwareV4) {
  switch (cookware) {
    case 'wok':
    case 'pan':
      return <WokFlameIcon size={16} tone="flame" active />;
    case 'claypot':
      return <ClaypotBraiseIcon size={16} tone="flame" active />;
    case 'stockpot':
      return <StockpotSoupIcon size={16} tone="jade" active />;
    case 'steamer':
      return <BambooSteamerIcon size={16} tone="turmeric" active />;
    case 'prep_board':
    default:
      return <ChefKnifeBoardIcon size={16} tone="jade" active />;
  }
}

function renderPhaseIcon(phase: CulinaryPhaseV4) {
  switch (phase) {
    case 'mise_en_place':
      return <ChefKnifeBoardIcon size={20} tone="jade" active />;
    case 'marinate':
      return <MarinateBowlIcon size={20} tone="turmeric" active />;
    case 'active_cook':
      return <WokFlameIcon size={20} tone="flame" active />;
    case 'plate':
      return <PlatingSparkleIcon size={20} tone="jade" active />;
  }
}

function renderHeatBadgeIcon(heat: StepHeatLevelV4) {
  if (heat === 'off') return <FlameOffIcon size={14} tone="ink" />;
  if (heat === 'low' || heat === 'medium_low') return <FlameLowIcon size={14} tone="jade" active />;
  if (heat === 'medium' || heat === 'medium_high') {
    return <FlameMediumIcon size={14} tone="turmeric" active />;
  }
  return <FlameHighIcon size={14} tone="flame" active />;
}

export const RecipeDetailPage: React.FC = () => {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const recipeKey = slug || id || '';
  const [params, setParams] = useSearchParams();
  const requestedFingerprint = params.get('contentFingerprint') ?? undefined;
  const selectedServings =
    /^[1-9][0-9]?$/.test(params.get('servings') ?? '') && Number(params.get('servings')) <= 20
      ? Number(params.get('servings'))
      : undefined;

  const navigate = useNavigate();
  const { state } = useLocation();
  const returnTo =
    typeof state?.discoveryReturn === 'string' &&
    (state.discoveryReturn === '/' || state.discoveryReturn.startsWith('/recipes?'))
      ? state.discoveryReturn
      : '/recipes';

  const queryClient = useQueryClient();
  const shoppingKey = queryKeys.shoppingList();
  const startCooking = useCookingStore((s) => s.startCooking);
  const startMultiDishCooking = useCookingStore((s) => s.startMultiDishCooking);

  const owner = useAuthStore((s) => `${s.userId}:${s.householdId}:${s.isGuest}`);
  const isGuest = useAuthStore((s) => s.isGuest);
  const familyPrefsQuery = useFamilyPreferences(!isGuest);

  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [mamComOpen, setMamComOpen] = useState(false);
  const [addedToShop, setAddedToShop] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<RecipeTabId>('ingredients');
  const [swapOpenIngredientKey, setSwapOpenIngredientKey] = useState<string | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapData, setSwapData] = useState<SmartSubstitutionResponse | null>(null);

  useEffect(() => {
    setMealDialogOpen(false);
    setMamComOpen(false);
    setSwapOpenIngredientKey(null);
  }, [owner, recipeKey]);

  const tabRefs = useRef<Record<RecipeTabId, HTMLButtonElement | null>>({
    ingredients: null,
    steps: null,
    nutrition: null,
  });

  const recipeQuery = useQuery({
    queryKey: queryKeys.recipe(recipeKey, requestedFingerprint),
    queryFn: () => api.getRecipeById(recipeKey, requestedFingerprint),
    enabled: Boolean(recipeKey),
  });

  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
  });

  const addToShopping = useMutation({
    mutationFn: ({ ingredient: ing, sourceRecipeTitle, sourceRecipeKey }: ShoppingShortfall) => {
      if (ing.missingQuantity === null || ing.missingQuantity <= 0) {
        throw new Error('Cần kiểm tra lượng trước khi thêm vào danh sách mua.');
      }
      return api.addShoppingItem({
        name: ing.name,
        quantity: ing.missingQuantity,
        unit: ing.unit,
        sourceRecipeTitle,
        ingredientId: ing.ingredientId,
        sourceRecipeId: sourceRecipeKey,
      });
    },
    onSuccess: (_data, { ingredient, sourceRecipeKey }) => {
      const key = shoppingEntryKey(sourceRecipeKey, ingredient);
      setAddedToShop((prev) => (prev.includes(key) ? prev : [...prev, key]));
      return queryClient.invalidateQueries({ queryKey: shoppingKey });
    },
  });

  const addBulkShopping = useMutation({
    mutationFn: async (items: ShoppingShortfall[]) => {
      const results = [];
      for (const entry of items) {
        if (entry.ingredient.missingQuantity !== null && entry.ingredient.missingQuantity > 0) {
          const added = await api.addShoppingItem({
            name: entry.ingredient.name,
            quantity: entry.ingredient.missingQuantity,
            unit: entry.ingredient.unit,
            sourceRecipeTitle: entry.sourceRecipeTitle,
            ingredientId: entry.ingredient.ingredientId,
            sourceRecipeId: entry.sourceRecipeKey,
          });
          results.push({ added, entry });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      setAddedToShop((prev) => {
        const next = new Set(prev);
        for (const { entry } of results) {
          next.add(shoppingEntryKey(entry.sourceRecipeKey, entry.ingredient));
        }
        return [...next];
      });
      return queryClient.invalidateQueries({ queryKey: shoppingKey });
    },
  });

  const baseRecipe = recipeQuery.data?.recipe;

  const v4Data = useMemo(() => {
    if (!baseRecipe) return null;
    if (selectedServings !== undefined) {
      return scaleRecipeV4(baseRecipe, selectedServings);
    }
    return enrichRecipeToV4(baseRecipe);
  }, [baseRecipe, selectedServings]);

  const recipe: Recipe | undefined = useMemo(() => {
    if (!baseRecipe || !v4Data) return undefined;
    if (selectedServings === undefined || selectedServings === baseRecipe.servings) {
      return baseRecipe;
    }
    return {
      ...baseRecipe,
      servings: v4Data.servings,
      ingredients: v4Data.ingredients.map((line) => ({
        ingredientId: line.ingredientId,
        name: line.name,
        requiredQuantity: line.requiredQuantity,
        unit: line.unit,
        isOptional: line.isOptional,
      })),
    };
  }, [baseRecipe, v4Data, selectedServings]);

  const matchInfo = recipeQuery.data?.match;
  const inventory = inventoryQuery.data ?? [];

  const notFound =
    recipeQuery.isError &&
    recipeQuery.error instanceof ApiError &&
    recipeQuery.error.kind === 'http' &&
    recipeQuery.error.status === 404;

  if (recipeKey && recipeQuery.isPending) {
    return (
      <div className="takosan-rebuild recipe-page min-h-screen bg-tk-canvas">
        <TopBar kitchen showBack backTo={returnTo} title="Chi tiết món ăn" />
        <h1 className="sr-only">Chi tiết món ăn</h1>
        <div className="mx-auto max-w-[1200px] p-4 sm:p-6 space-y-4" role="status" aria-live="polite">
          <SkeletonCard className="h-72 rounded-3xl" />
          <SkeletonCard className="h-14 rounded-2xl" />
          <SkeletonCard className="h-32 rounded-2xl" />
          <SkeletonCard className="h-32 rounded-2xl" />
          <span className="sr-only">Đang tải công thức…</span>
        </div>
      </div>
    );
  }

  if (recipeQuery.isError && !notFound) {
    return (
      <div className="takosan-rebuild recipe-page min-h-screen bg-tk-canvas">
        <TopBar kitchen showBack backTo={returnTo} title="Chi tiết món ăn" />
        <h1 className="sr-only">Chi tiết món ăn</h1>
        <div className="mx-auto max-w-[1200px] p-4 sm:p-6">
          <InlineError error={recipeQuery.error} onRetry={() => recipeQuery.refetch()} />
        </div>
      </div>
    );
  }

  if (notFound || !recipe || !v4Data || !baseRecipe) {
    return (
      <div className="takosan-rebuild recipe-page min-h-screen bg-tk-canvas">
        <TopBar kitchen showBack backTo={returnTo} title="Chi tiết món ăn" />
        <div className="mx-auto max-w-lg p-8 text-center space-y-4">
          <SearchX className="w-12 h-12 text-tk-muted mx-auto" aria-hidden="true" />
          <h1 className="font-heading font-extrabold text-xl text-tk-ink">
            Không tìm thấy công thức này
          </h1>
          <p className="text-sm text-tk-secondary">
            Món ăn có thể đã bị gỡ hoặc đường dẫn không đúng.
          </p>
          <ActionButton variant="flame" onClick={() => navigate('/recipes')}>
            Xem tất cả công thức
          </ActionButton>
        </div>
      </div>
    );
  }

  const availability = evaluateRecipeAvailability(recipe, inventory);
  const pendingIngredients = availability.filter(
    (item) => !item.isOptional && item.status !== 'satisfied',
  );
  const inventoryReady = inventoryQuery.isSuccess;
  const units: Record<string, string> = { piece: 'cái', pack: 'gói', bunch: 'bó', slice: 'lát' };
  const quantityText = (quantity: number, unit: string) =>
    `${new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 15 }).format(quantity)} ${units[unit] ?? unit}`;

  const v4Fallback = resolveRecipeImageV4(recipe);
  const canonicalResolved = resolveRecipeImage(recipe, v4Fallback.src);
  const v4Image = {
    ...v4Fallback,
    src: canonicalResolved.source === 'canonical_r2' ? canonicalResolved.src : v4Fallback.src,
  };
  const difficultyInfo = formatDifficultyLabel(recipe.difficulty);
  const satisfiedCount = availability.filter((item) => item.status === 'satisfied').length;
  const readinessPercent = inventoryReady
    ? Math.round((satisfiedCount / Math.max(1, availability.length)) * 100)
    : 0;

  const panCrowdingWarningVi: string | null =
    'panCrowdingWarningVi' in v4Data && typeof v4Data.panCrowdingWarningVi === 'string'
      ? v4Data.panCrowdingWarningVi
      : null;

  const safetyEval = evaluateRecipeDietarySafetyV4(recipe, {
    allergens: familyPrefsQuery.data?.preferences.allergens,
    forbiddenIngredientIds: familyPrefsQuery.data?.preferences.forbiddenIngredientIds,
  });

  const nutrition = recipe.nutrition ?? v4Data.estimatedNutrition;
  const nutritionIsEstimated = !recipe.nutrition;

  const updateServingsParam = (nextServings: number) => {
    const clamped = Math.max(1, Math.min(20, Math.round(nextServings)));
    const next = new URLSearchParams(params);
    next.set('servings', String(clamped));
    setParams(next, { replace: true });
  };

  // Deduplicated bulk shopping shortfalls (fixes the 6-clicks audit bug!)
  const bulkShortfalls: ShoppingShortfall[] = (() => {
    if (!inventoryReady) return [];
    const seen = new Set<string>();
    const list: ShoppingShortfall[] = [];
    for (const ing of availability) {
      if (ing.missingQuantity === null || ing.missingQuantity <= 0) continue;
      const entryKey = shoppingEntryKey(recipe.id, ing);
      if (seen.has(entryKey) || addedToShop.includes(entryKey)) continue;
      seen.add(entryKey);
      const combinedMissing = availability.reduce(
        (sum, item) =>
          item.ingredientId === ing.ingredientId &&
          item.unit === ing.unit &&
          item.isOptional === ing.isOptional
            ? sum + (item.missingQuantity ?? 0)
            : sum,
        0,
      );
      list.push({
        ingredient: { ...ing, missingQuantity: combinedMissing },
        sourceRecipeKey: recipe.id,
        sourceRecipeTitle: recipe.title,
      });
    }
    return list;
  })();

  // Group ingredient rows into Smart Fridge Studio sections
  const indexedAvailability = availability.map((ing, index) => ({
    ing,
    index,
    formattedV4:
      'formattedAmountVi' in (v4Data.ingredients[index] ?? {})
        ? (v4Data.ingredients[index] as { formattedAmountVi?: string }).formattedAmountVi
        : undefined,
    isPantry: isPantryStapleIngredient(ing.ingredientId, ing.name),
  }));

  const neededRows = inventoryReady
    ? indexedAvailability.filter((r) => r.ing.status !== 'satisfied')
    : indexedAvailability;
  const fridgeReadyRows = inventoryReady
    ? indexedAvailability.filter((r) => r.ing.status === 'satisfied' && !r.isPantry)
    : [];
  const pantryReadyRows = inventoryReady
    ? indexedAvailability.filter((r) => r.ing.status === 'satisfied' && r.isPantry)
    : [];

  const openIngredientAiSwap = async (rowKey: string, ing: RecipeIngredientAvailability) => {
    if (swapOpenIngredientKey === rowKey) {
      setSwapOpenIngredientKey(null);
      return;
    }
    setSwapOpenIngredientKey(rowKey);
    setSwapLoading(true);
    setSwapData(null);
    try {
      const res = await aiCopilotApi.recommendSubstitutions({
        ingredientName: ing.name,
        ingredientId: ing.ingredientId,
        requiredQuantity: ing.requiredQuantity,
        unit: ing.unit,
        recipeTitle: recipe.title,
        householdAllergens: familyPrefsQuery.data?.preferences.allergens,
      });
      setSwapData(res);
    } catch {
      setSwapData(null);
    } finally {
      setSwapLoading(false);
    }
  };

  const handleStartCook = () => {
    const attempt = useCookingStore.getState().attempt;
    if (attempt && !['saved', 'queued'].includes(attempt.status)) {
      navigate('/cooking/complete');
      return;
    }
    startCooking(baseRecipe, inventory, {
      contentFingerprint: recipeQuery.data?.contentFingerprint,
      targetServings: recipe.servings,
    });
    const cookingParams = new URLSearchParams({ servings: String(recipe.servings) });
    if (recipeQuery.data?.contentFingerprint) {
      cookingParams.set('contentFingerprint', recipeQuery.data.contentFingerprint);
    }
    navigate(`/cook/${recipe.slug}?${cookingParams}`);
  };

  const handleStartMamCom = (selectedRecipes: Recipe[]) => {
    const attempt = useCookingStore.getState().attempt;
    if (attempt && !['saved', 'queued'].includes(attempt.status)) {
      navigate('/cooking/complete');
      return;
    }
    startMultiDishCooking(selectedRecipes, inventory, recipe.servings);
    navigate(`/cook/${recipe.slug}?servings=${recipe.servings}`);
  };

  const renderIngredientRow = ({
    ing,
    index,
    formattedV4,
  }: {
    ing: RecipeIngredientAvailability;
    index: number;
    formattedV4?: string;
  }) => {
    const hasIngredient = inventoryReady && ing.status === 'satisfied';
    const canBuy = inventoryReady && ing.missingQuantity !== null && ing.missingQuantity > 0;
    const isAdded = addedToShop.includes(shoppingEntryKey(recipe.id, ing));
    const shoppingQuantity = availability.reduce(
      (sum, item) =>
        item.ingredientId === ing.ingredientId &&
        item.unit === ing.unit &&
        item.isOptional === ing.isOptional
          ? sum + (item.missingQuantity ?? 0)
          : sum,
      0,
    );
    const rowKey = `${ing.ingredientId}-${index}`;
    const isSwapOpen = swapOpenIngredientKey === rowKey;

    return (
      <div key={rowKey} className="space-y-2">
        <div
          className={clsx(
            'ingredient-availability-row rounded-2xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all',
            hasIngredient
              ? 'border-tk-jade/25 bg-tk-jade-soft/45'
              : 'border-tk-stone bg-white shadow-2xs',
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-tk-canvas border border-tk-stone/75 flex items-center justify-center p-1.5 overflow-hidden shrink-0">
              <img
                src={getIngredientImage(ing.ingredientId, ing.name)}
                alt={ing.name}
                width={40}
                height={40}
                loading="lazy"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-heading font-extrabold text-sm sm:text-base text-tk-ink">
                  {ing.name}
                </p>
                {hasIngredient && (
                  <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-tk-jade text-white">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
                {ing.isOptional && (
                  <span className="rounded-full bg-tk-sunken px-2 py-0.5 text-[10px] font-bold text-tk-muted">
                    Tùy chọn
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm font-bold text-tk-jade-deep mt-0.5 tk-tabular">
                Cần {formattedV4 ?? quantityText(ing.requiredQuantity, ing.unit)}
              </p>

              <p
                className={clsx(
                  'text-xs mt-0.5 font-medium tk-tabular',
                  !inventoryReady
                    ? 'text-tk-muted'
                    : hasIngredient
                      ? 'text-tk-secondary'
                      : 'text-tk-turmeric-deep font-semibold',
                )}
                data-availability={inventoryReady ? ing.status : 'pending'}
              >
                {!inventoryReady
                  ? 'Chưa có dữ liệu tồn kho'
                  : ing.status === 'unresolved'
                    ? 'Cần kiểm tra lượng hoặc đơn vị trong tủ'
                    : `Trong tủ: ${quantityText(ing.availableQuantity, ing.unit)}${
                        hasIngredient
                          ? ' · Đủ lượng'
                          : ` · Thiếu ${quantityText(ing.missingQuantity ?? 0, ing.unit)}`
                      }`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => void openIngredientAiSwap(rowKey, ing)}
              aria-expanded={isSwapOpen}
              aria-label={`Gợi ý thay thế cho ${ing.name}`}
              className={clsx(
                'inline-flex items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-bold transition-tap cursor-pointer min-h-[38px]',
                isSwapOpen
                  ? 'border-tk-flame bg-tk-flame-soft text-tk-flame-deep'
                  : 'border-tk-stone bg-tk-canvas text-tk-secondary hover:bg-tk-sunken hover:text-tk-ink',
              )}
            >
              <IngredientSwapIcon size={14} tone="flame" />
              <span>Đổi AI</span>
            </button>

            {canBuy && (
              <button
                type="button"
                aria-label={`Mua phần thiếu: ${ing.name}`}
                onClick={() =>
                  addToShopping.mutate({
                    ingredient: { ...ing, missingQuantity: shoppingQuantity },
                    sourceRecipeKey: recipe.id,
                    sourceRecipeTitle: recipe.title,
                  })
                }
                disabled={isAdded || addToShopping.isPending}
                className={clsx(
                  'px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-tap min-h-[38px] cursor-pointer',
                  isAdded
                    ? 'bg-tk-sunken text-tk-muted border border-tk-stone cursor-default'
                    : 'bg-tk-flame text-white hover:bg-tk-flame-hover shadow-xs active:scale-95',
                )}
              >
                <NavShoppingIcon size={14} tone={isAdded ? 'ink' : 'cream'} />
                <span>{isAdded ? 'Đã thêm' : 'Mua phần thiếu'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Inline AI Substitution Popover */}
        {isSwapOpen && (
          <div className="rounded-2xl border border-tk-flame/25 bg-tk-flame-soft/40 p-3.5 space-y-2 animate-slide-up">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-tk-flame-deep">
                <Sparkles size={13} aria-hidden="true" />
                Nguyên liệu thay thế tương đương cho {ing.name}
              </span>
              <button
                type="button"
                onClick={() => setSwapOpenIngredientKey(null)}
                aria-label="Đóng gợi ý"
                className="p-1 text-tk-muted hover:text-tk-ink cursor-pointer"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            {swapLoading ? (
              <p className="text-xs text-tk-secondary">Đang đối chiếu khẩu vị & tủ lạnh…</p>
            ) : swapData ? (
              <div className="space-y-2">
                {swapData.substitutions.map((cand) => (
                  <div
                    key={cand.replacementName}
                    className="rounded-xl border border-tk-stone bg-white p-2.5 text-xs space-y-1"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-extrabold text-tk-ink">{cand.replacementName}</span>
                      {cand.inFridge && (
                        <span className="rounded-full bg-tk-jade px-2 py-0.5 text-[10px] font-bold text-white">
                          Có trong tủ lạnh
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-tk-jade-deep">{cand.conversionRatioVi}</p>
                    <p className="text-tk-secondary">{cand.flavorImpactVi}</p>
                  </div>
                ))}
                <p className="text-[11px] italic text-tk-muted">
                  Mẹo bếp: {swapData.chefTipVi}
                </p>
              </div>
            ) : (
              <p className="text-xs text-tk-secondary">Chưa tải được gợi ý lúc này.</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="takosan-rebuild recipe-page min-h-screen bg-tk-canvas pb-36">
      <TopBar kitchen showBack backTo={returnTo} title={recipe.title} />

      {mealDialogOpen && !isGuest && (
        <RecipeMealDialog
          key={`${owner}:${recipe.id}`}
          entry={{ recipeId: recipe.id, title: recipe.title }}
          requireSaved={false}
          defaultServings={recipe.servings}
          onClose={() => setMealDialogOpen(false)}
        />
      )}

      {mamComOpen && (
        <MamComConductorModal
          open={mamComOpen}
          onClose={() => setMamComOpen(false)}
          primaryRecipe={recipe}
          currentRecipes={[recipe]}
          servings={recipe.servings}
          inventory={inventory}
          dark={false}
          onApplyMamCom={handleStartMamCom}
        />
      )}

      <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 pt-4 space-y-6">
        {inventoryQuery.isError && (
          <InlineError error={inventoryQuery.error} onRetry={() => inventoryQuery.refetch()} />
        )}

        <KitchenLoopStrip
          activeStage="recipes"
          summaryText={
            inventoryReady
              ? pendingIngredients.length === 0
                ? 'Tủ lạnh đã đủ nguyên liệu — sẵn sàng vào chế độ Bếp 3D Rảnh tay!'
                : `Còn ${pendingIngredients.length} nguyên liệu cần kiểm tra hoặc thêm 1 chạm vào giỏ đi chợ`
              : 'Đang đồng bộ dữ liệu nguyên liệu với tủ lạnh của bạn'
          }
        />

        {/* Magazine-Grade Split Editorial Hero */}
        <section
          className="recipe-overview rounded-[28px] border border-tk-stone/90 bg-white p-4 sm:p-6 lg:p-7 shadow-card"
          aria-label="Tổng quan món ăn"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Dish Photography Hero */}
            <div className="lg:col-span-6 space-y-3">
              <RecipeMedia
                image={v4Image}
                title={recipe.title}
                className="recipe-cover rounded-[24px] shadow-soft"
                aspectClass="aspect-[4/3]"
                priority
                overlay={
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tk-glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold text-tk-ink">
                        <Clock size={13} aria-hidden="true" className="text-tk-flame" />
                        Tổng {v4Data.totalTimeMinutes} phút
                      </span>
                      <span className="inline-flex items-center rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
                        {v4Image.categoryLabelVi}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-tk-sanctuary/85 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                        <ThreeDOrbitBadgeIcon size={15} tone="cream" />
                        Hỗ trợ Sân khấu Nấu 3D &amp; Rảnh tay
                      </span>
                    </div>
                  </div>
                }
              />

              {/* Time Breakdown Strip: Prep + Active Cook + Simmer */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="rounded-2xl border border-tk-stone/75 bg-tk-canvas p-2.5">
                  <p className="text-[11px] font-bold text-tk-muted uppercase">Sơ chế</p>
                  <p className="mt-0.5 text-sm sm:text-base font-extrabold text-tk-ink tk-tabular">
                    {v4Data.prepTimeMinutes} phút
                  </p>
                </div>
                <div className="rounded-2xl border border-tk-stone/75 bg-tk-canvas p-2.5">
                  <p className="text-[11px] font-bold text-tk-muted uppercase">Đứng bếp</p>
                  <p className="mt-0.5 text-sm sm:text-base font-extrabold text-tk-flame tk-tabular">
                    {v4Data.activeCookTimeMinutes} phút
                  </p>
                </div>
                <div className="rounded-2xl border border-tk-stone/75 bg-tk-canvas p-2.5">
                  <p className="text-[11px] font-bold text-tk-muted uppercase">Độ khó</p>
                  <p className="mt-0.5 text-sm sm:text-base font-extrabold text-tk-jade">
                    {difficultyInfo.label}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Magazine Editorial Info & Interactive Portion Studio */}
            <div className="recipe-intro lg:col-span-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <AtelierBadge tone="jade">
                    {recipe.cuisine === 'vietnamese' ? 'Tinh hoa Món Việt' : recipe.cuisine.toUpperCase()}
                  </AtelierBadge>
                  {typeof matchInfo?.matchPercentage === 'number' && (
                    <AtelierBadge tone="flame">
                      Khớp {matchInfo.matchPercentage}% nguyên liệu
                    </AtelierBadge>
                  )}
                  {safetyEval.safe ? (
                    <AtelierBadge
                      tone="jade"
                      icon={<AllergenShieldIcon size={13} tone="jade" />}
                    >
                      An toàn dị ứng gia đình
                    </AtelierBadge>
                  ) : (
                    <AtelierBadge
                      tone="berry"
                      icon={<AllergenShieldIcon size={13} tone="flame" />}
                    >
                      Lưu ý dị ứng ({safetyEval.conflicts.length})
                    </AtelierBadge>
                  )}
                </div>

                <SaveRecipeButton recipeId={recipe.id} title={recipe.title} />
              </div>

              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-[34px] leading-tight tracking-tight text-tk-ink">
                {recipe.title}
              </h1>

              {recipe.description && (
                <p className="text-sm sm:text-base leading-relaxed text-tk-secondary">
                  {recipe.description}
                </p>
              )}

              {/* Dietary Safety Alert if household has conflicting allergen */}
              {!safetyEval.safe && (
                <div
                  role="alert"
                  className="rounded-2xl border border-tk-berry/35 bg-tk-berry-soft p-3.5 text-xs font-semibold text-tk-berry-deep space-y-1"
                >
                  <p className="font-extrabold flex items-center gap-1.5">
                    <AlertTriangle size={15} aria-hidden="true" />
                    Cảnh báo an toàn thực phẩm gia đình:
                  </p>
                  {safetyEval.conflicts.map((c, idx) => (
                    <p key={idx}>• {c.reasonVi}</p>
                  ))}
                </div>
              )}

              {/* Action Strip: Xếp vào Thực đơn + Đạo diễn Mâm Cơm + Calories Ring */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {!isGuest && isMealPlannerEnabled() && isMealCompositionEnabled() && (
                  <ActionButton
                    variant="ceramic"
                    size="sm"
                    icon={<CalendarMealCheckIcon size={16} tone="jade" />}
                    onClick={() => setMealDialogOpen(true)}
                  >
                    Xếp món vào bữa
                  </ActionButton>
                )}

                <ActionButton
                  variant="sunken"
                  size="sm"
                  icon={<HouseholdTrayIcon size={16} tone="flame" />}
                  onClick={() => setMamComOpen(true)}
                >
                  Đạo diễn Mâm Cơm (Nấu 2–3 món)
                </ActionButton>

                <div className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-tk-stone/80 bg-tk-canvas px-3 py-1.5">
                  <RadialProgressRing
                    value={Math.min(100, Math.round((nutrition.calories / 800) * 100))}
                    size={36}
                    strokeWidth={3.5}
                    tone="jade"
                    label={<CaloriesLeafIcon size={14} tone="jade" />}
                  />
                  <div className="leading-tight">
                    <p className="text-xs font-extrabold text-tk-ink tk-tabular">
                      ~{nutrition.calories} kcal
                    </p>
                    <p className="text-[10px] font-semibold text-tk-muted tk-tabular">
                      Đạm {nutrition.proteinG}g · Béo {nutrition.fatG}g
                    </p>
                  </div>
                </div>
              </div>

              {/* Interactive Non-Linear Portion Scaler (1..12 quick pills + 1..20 select) */}
              <div className="rounded-2xl border border-tk-stone/85 bg-tk-canvas p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-tk-ink">
                    <PortionScaleIcon size={18} tone="flame" active />
                    <span>Khẩu phần thông minh (Non-linear V4)</span>
                  </label>

                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Giảm khẩu phần"
                      disabled={recipe.servings <= 1}
                      onClick={() => updateServingsParam(recipe.servings - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-tk-stone bg-white text-tk-ink hover:bg-tk-sunken disabled:opacity-40 cursor-pointer"
                    >
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <select
                      aria-label="Nấu cho bao nhiêu người?"
                      value={recipe.servings}
                      onChange={(event) => updateServingsParam(Number(event.target.value))}
                      className="h-8 rounded-xl border border-tk-stone bg-white px-2.5 text-xs font-extrabold text-tk-ink tk-tabular focus:border-tk-flame focus:outline-none cursor-pointer"
                    >
                      {Array.from({ length: 20 }, (_, index) => index + 1).map((value) => (
                        <option key={value} value={value}>
                          {value} người
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label="Tăng khẩu phần"
                      disabled={recipe.servings >= 20}
                      onClick={() => updateServingsParam(recipe.servings + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-tk-stone bg-white text-tk-ink hover:bg-tk-sunken disabled:opacity-40 cursor-pointer"
                    >
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Quick 1..12 Tactile Portion Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {QUICK_PORTION_PILLS.map((count) => {
                    const active = recipe.servings === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => updateServingsParam(count)}
                        className={clsx(
                          'rounded-xl border px-2.5 py-1 text-xs font-extrabold tk-tabular transition-tap cursor-pointer',
                          active
                            ? 'border-tk-flame bg-tk-flame text-white shadow-2xs'
                            : 'border-tk-stone bg-white text-tk-secondary hover:text-tk-ink',
                        )}
                      >
                        {count} người
                      </button>
                    );
                  })}
                </div>

                {panCrowdingWarningVi && (
                  <p className="rounded-xl border border-tk-turmeric/35 bg-tk-turmeric-soft px-3 py-2 text-xs font-semibold text-tk-turmeric-deep leading-relaxed">
                    🔥 {panCrowdingWarningVi}
                  </p>
                )}

                {addedToShop.length > 0 && (
                  <p className="text-xs font-medium text-tk-secondary">
                    Đã thêm nguyên liệu vào giỏ đi chợ. Nếu đổi số người, hãy kiểm tra lại lượng mua trong Giỏ đi chợ.
                  </p>
                )}
              </div>

              {/* Fridge Readiness Banner */}
              <div
                className={clsx(
                  'recipe-availability rounded-2xl border p-4',
                  inventoryReady && pendingIngredients.length === 0
                    ? 'border-tk-jade/30 bg-tk-jade-soft/65'
                    : 'border-tk-stone/85 bg-tk-sunken/60',
                )}
                data-testid="recipe-availability"
                role="status"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-tk-ink">
                      {!inventoryReady
                        ? 'Chưa kiểm tra được lượng trong tủ'
                        : pendingIngredients.length === 0
                          ? 'Đủ lượng nguyên liệu để nấu ngay!'
                          : `Cần bổ sung hoặc kiểm tra ${pendingIngredients.length} nguyên liệu`}
                    </p>
                    <p className="mt-0.5 text-xs text-tk-secondary">
                      Lượng bên dưới dành cho {recipe.servings} người. Kiểm tra độ tươi trước khi nấu.
                    </p>
                  </div>
                  <div className="hidden sm:block shrink-0">
                    <TakoChef3D
                      pose={inventoryReady && pendingIngredients.length === 0 ? 'cook' : 'think'}
                      size={74}
                      interactive={false}
                    />
                  </div>
                </div>

                {inventoryReady && (
                  <div className="mt-3 space-y-1" aria-hidden="true">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/80">
                      <span
                        className="block h-full rounded-full bg-tk-jade transition-all duration-500"
                        style={{ width: `${readinessPercent}%` }}
                      />
                    </div>
                    <p className="text-[11px] font-bold text-tk-jade-deep tk-tabular">
                      {satisfiedCount}/{availability.length} nguyên liệu sẵn sàng trong tủ ({readinessPercent}%)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Studio Tabs: Nguyên liệu & Tủ lạnh | Lộ trình 4 pha chế biến | Dinh dưỡng & An toàn */}
        <div className="recipe-preparation space-y-5">
          <div
            className="recipe-tabs flex rounded-2xl border border-tk-stone/85 bg-tk-sunken p-1.5"
            role="tablist"
            aria-label="Thông tin món ăn"
          >
            {RECIPE_TABS.map((tab, tabIndex) => (
              <button
                key={tab.id}
                id={tab.tabId}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={tab.panelId}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onFocus={() => setActiveTab(tab.id)}
                onKeyDown={(event) => {
                  let nextIndex: number | undefined;
                  if (event.key === 'ArrowRight') nextIndex = (tabIndex + 1) % RECIPE_TABS.length;
                  if (event.key === 'ArrowLeft') {
                    nextIndex = (tabIndex - 1 + RECIPE_TABS.length) % RECIPE_TABS.length;
                  }
                  if (event.key === 'Home') nextIndex = 0;
                  if (event.key === 'End') nextIndex = RECIPE_TABS.length - 1;
                  if (nextIndex === undefined) return;

                  event.preventDefault();
                  const nextTab = RECIPE_TABS[nextIndex];
                  setActiveTab(nextTab.id);
                  tabRefs.current[nextTab.id]?.focus();
                }}
                ref={(element) => {
                  tabRefs.current[tab.id] = element;
                }}
                className={clsx(
                  'flex-1 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-extrabold transition-tap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tk-flame',
                  activeTab === tab.id
                    ? 'bg-white text-tk-ink shadow-xs'
                    : 'text-tk-secondary hover:text-tk-ink',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Panel 1: Smart Fridge vs Needed Ingredient Studio */}
          <div
            id="recipe-detail-panel-ingredients"
            role="tabpanel"
            aria-labelledby="recipe-detail-tab-ingredients"
            tabIndex={0}
            hidden={activeTab !== 'ingredients'}
            className="space-y-5 focus-visible:outline-none"
          >
            {activeTab === 'ingredients' && (
              <>
                {/* 1-Tap Bulk Add Missing Ingredients CTA */}
                {inventoryReady && bulkShortfalls.length > 0 && (
                  <BentoCard
                    tone="flame"
                    padding="sm"
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-extrabold text-tk-ink">
                        Thiếu {bulkShortfalls.length} nguyên liệu định lượng rõ ràng
                      </p>
                      <p className="text-xs text-tk-secondary">
                        Thêm toàn bộ phần thiếu vào Giỏ đi chợ chỉ với 1 chạm thay vì bấm từng dòng.
                      </p>
                    </div>
                    <ActionButton
                      variant="flame"
                      size="md"
                      loading={addBulkShopping.isPending}
                      icon={<NavShoppingIcon size={16} tone="cream" />}
                      onClick={() => addBulkShopping.mutate(bulkShortfalls)}
                    >
                      Thêm tất cả nguyên liệu thiếu vào Giỏ đi chợ ({bulkShortfalls.length})
                    </ActionButton>
                  </BentoCard>
                )}

                {(addToShopping.isError || addBulkShopping.isError) && (
                  <p className="text-xs text-tk-berry font-bold" role="alert">
                    Chưa thêm được vào danh sách mua. Vui lòng thử lại.
                  </p>
                )}

                {/* Group 1: Cần mua bổ sung / Kiểm tra */}
                {neededRows.length > 0 && (
                  <BentoCard tone="ceramic" padding="md" className="space-y-3">
                    <div className="flex items-center justify-between border-b border-tk-stone/70 pb-2.5">
                      <h3 className="text-sm sm:text-base font-extrabold text-tk-ink">
                        {inventoryReady
                          ? `Cần mua bổ sung / Kiểm tra (${neededRows.length})`
                          : `Danh sách nguyên liệu (${neededRows.length})`}
                      </h3>
                      {inventoryReady && (
                        <AtelierBadge tone="turmeric">Cần chuẩn bị thêm</AtelierBadge>
                      )}
                    </div>
                    <div className="space-y-2.5">{neededRows.map(renderIngredientRow)}</div>
                  </BentoCard>
                )}

                {/* Group 2: Sẵn có đủ trong tủ lạnh */}
                {fridgeReadyRows.length > 0 && (
                  <BentoCard tone="jade" padding="md" className="space-y-3">
                    <div className="flex items-center justify-between border-b border-tk-jade/20 pb-2.5">
                      <h3 className="inline-flex items-center gap-2 text-sm sm:text-base font-extrabold text-tk-ink">
                        <FreshnessShieldIcon size={18} tone="jade" active />
                        Sẵn có đủ trong tủ lạnh ({fridgeReadyRows.length})
                      </h3>
                      <AtelierBadge tone="jade">Sẵn sàng sơ chế</AtelierBadge>
                    </div>
                    <div className="space-y-2.5">{fridgeReadyRows.map(renderIngredientRow)}</div>
                  </BentoCard>
                )}

                {/* Group 3: Gia vị tủ bếp sẵn nhà */}
                {pantryReadyRows.length > 0 && (
                  <BentoCard tone="sunken" padding="md" className="space-y-3">
                    <div className="flex items-center justify-between border-b border-tk-stone/70 pb-2.5">
                      <h3 className="inline-flex items-center gap-2 text-sm sm:text-base font-extrabold text-tk-ink">
                        <FishSauceCruetIcon size={18} tone="flame" active />
                        Gia vị tủ bếp ({pantryReadyRows.length})
                      </h3>
                      <AtelierBadge tone="neutral">Đủ lượng trong bếp</AtelierBadge>
                    </div>
                    <div className="space-y-2.5">{pantryReadyRows.map(renderIngredientRow)}</div>
                  </BentoCard>
                )}
              </>
            )}
          </div>

          {/* Panel 2: 4-Phase Culinary Roadmap Preview */}
          <div
            id="recipe-detail-panel-steps"
            role="tabpanel"
            aria-labelledby="recipe-detail-tab-steps"
            tabIndex={0}
            hidden={activeTab !== 'steps'}
            className="space-y-6 focus-visible:outline-none"
          >
            {activeTab === 'steps' && (
              <>
                <BentoCard
                  tone="sanctuary"
                  padding="md"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                      Lộ trình 4 Pha Chuẩn Đầu Bếp · Takolio V4
                    </span>
                    <h3 className="text-lg font-extrabold text-white">
                      Mỗi bước tách sẵn định lượng riêng, mức lửa &amp; dấu hiệu nhận biết chín tới
                    </h3>
                  </div>
                  <ActionButton
                    variant="flame"
                    size="md"
                    disabled={inventoryQuery.isPending || inventoryQuery.isError}
                    icon={<ThreeDOrbitBadgeIcon size={17} tone="cream" />}
                    onClick={handleStartCook}
                  >
                    Mở Sân Khấu Bếp 3D
                  </ActionButton>
                </BentoCard>

                {PHASE_ORDER.map((phaseGroup) => {
                  const stepsInPhase: RecipeStepV4[] = v4Data.steps.filter(
                    (s) => s.phase === phaseGroup.phase,
                  );
                  if (stepsInPhase.length === 0) return null;

                  return (
                    <section key={phaseGroup.phase} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white border border-tk-stone shadow-xs">
                          {renderPhaseIcon(phaseGroup.phase)}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-tk-flame tk-tabular">
                              Pha {phaseGroup.code}
                            </span>
                            <h3 className="text-base sm:text-lg font-extrabold text-tk-ink">
                              {phaseGroup.titleVi}
                            </h3>
                          </div>
                          <p className="text-xs text-tk-muted">{phaseGroup.subtitleVi}</p>
                        </div>
                      </div>

                      <div className="space-y-3 pl-0 sm:pl-5">
                        {stepsInPhase.map((step) => (
                          <BentoCard
                            key={step.stepNumber}
                            tone="ceramic"
                            padding="md"
                            className="recipe-step-card space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-tk-jade text-xs font-extrabold text-white tk-tabular">
                                  {step.stepNumber}
                                </span>
                                <h4 className="text-sm sm:text-base font-extrabold text-tk-ink">
                                  {step.titleVi}
                                </h4>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <AtelierBadge
                                  tone="neutral"
                                  icon={renderCookwareIcon(step.cookware)}
                                >
                                  {step.cookwareLabelVi}
                                </AtelierBadge>
                                <AtelierBadge
                                  tone={
                                    step.heatLevel === 'high' || step.heatLevel === 'medium_high'
                                      ? 'flame'
                                      : step.heatLevel === 'off'
                                        ? 'neutral'
                                        : 'turmeric'
                                  }
                                  icon={renderHeatBadgeIcon(step.heatLevel)}
                                >
                                  {step.heatLabelVi}
                                </AtelierBadge>
                                {step.timerMinutes && (
                                  <AtelierBadge
                                    tone="jade"
                                    icon={<MultiTimerIcon size={13} tone="jade" />}
                                  >
                                    {step.timerMinutes} phút
                                  </AtelierBadge>
                                )}
                              </div>
                            </div>

                            <p className="text-sm sm:text-base leading-relaxed text-tk-ink">
                              {step.instruction}
                            </p>

                            {/* Exact Per-Step Split Ingredients Preview */}
                            {step.stepIngredients.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {step.stepIngredients.map((alloc, i) => (
                                  <span
                                    key={`${alloc.ingredientId}-${i}`}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-tk-stone bg-tk-canvas px-2.5 py-1 text-xs font-bold text-tk-ink tk-tabular"
                                  >
                                    <img
                                      src={getIngredientImage(alloc.ingredientId, alloc.name)}
                                      alt=""
                                      width={18}
                                      height={18}
                                      loading="lazy"
                                      className="h-4.5 w-4.5 object-contain"
                                    />
                                    <span>{alloc.name}:</span>
                                    <span className="text-tk-jade-deep">{alloc.formattedAmountVi}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Sensory Doneness Cue */}
                            {step.sensoryCue && (
                              <div className="flex items-start gap-2 rounded-2xl border border-tk-jade/20 bg-tk-jade-soft/55 px-3.5 py-2.5 text-xs font-semibold text-tk-jade-deep">
                                <SensoryAromaIcon size={16} tone="jade" active className="mt-0.5" />
                                <span>
                                  <strong>Dấu hiệu đạt chuẩn:</strong> {step.sensoryCue}
                                </span>
                              </div>
                            )}

                            {step.tip && (
                              <div className="rounded-2xl border border-tk-turmeric/25 bg-tk-turmeric-soft/75 px-3.5 py-2.5 text-xs font-medium text-tk-turmeric-deep">
                                <strong>Mẹo Bếp Trưởng:</strong> {step.tip}
                              </div>
                            )}
                          </BentoCard>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </>
            )}
          </div>

          {/* Panel 3: Nutrition & Equipment & Dietary Safety */}
          <div
            id="recipe-detail-panel-nutrition"
            role="tabpanel"
            aria-labelledby="recipe-detail-tab-nutrition"
            tabIndex={0}
            hidden={activeTab !== 'nutrition'}
            className="space-y-4 focus-visible:outline-none"
          >
            {activeTab === 'nutrition' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <BentoCard tone="ceramic" padding="md" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-extrabold text-tk-ink">
                      Dinh dưỡng mỗi khẩu phần
                    </h3>
                    <AtelierBadge tone={nutritionIsEstimated ? 'neutral' : 'jade'}>
                      {nutritionIsEstimated ? 'Ước tính từ định lượng V4' : 'Công bố chuẩn'}
                    </AtelierBadge>
                  </div>

                  <div className="grid grid-cols-4 gap-2.5 text-center">
                    {[
                      { label: 'Năng lượng', value: nutrition.calories, unit: 'kcal' },
                      { label: 'Chất đạm', value: nutrition.proteinG, unit: 'g' },
                      { label: 'Chất béo', value: nutrition.fatG, unit: 'g' },
                      { label: 'Tinh bột', value: nutrition.carbG, unit: 'g' },
                    ].map((cell) => (
                      <div
                        key={cell.label}
                        className="rounded-2xl border border-tk-stone/80 bg-tk-canvas p-3"
                      >
                        <p className="text-[11px] font-bold uppercase text-tk-muted">{cell.label}</p>
                        <p className="mt-1 text-lg font-extrabold text-tk-ink tk-tabular">
                          {cell.value}
                        </p>
                        <p className="text-[11px] font-semibold text-tk-secondary">{cell.unit}</p>
                      </div>
                    ))}
                  </div>
                </BentoCard>

                <BentoCard tone="ceramic" padding="md" className="space-y-4">
                  <h3 className="text-base font-extrabold text-tk-ink">
                    Dụng cụ bếp &amp; Hồ sơ ăn uống
                  </h3>

                  {v4Data.equipmentList.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-tk-muted uppercase">Dụng cụ cần chuẩn bị:</p>
                      <div className="flex flex-wrap gap-2">
                        {v4Data.equipmentList.map((eq) => (
                          <AtelierBadge
                            key={eq.id}
                            tone="neutral"
                            icon={renderCookwareIcon(eq.id)}
                          >
                            {eq.labelVi}
                          </AtelierBadge>
                        ))}
                      </div>
                    </div>
                  )}

                  {safetyEval.compliantDiets.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-bold text-tk-muted uppercase">Phù hợp chế độ ăn:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {safetyEval.compliantDiets.map((diet) => (
                          <AtelierBadge key={diet} tone="jade">
                            {diet.replace(/_/g, ' ')}
                          </AtelierBadge>
                        ))}
                      </div>
                    </div>
                  )}
                </BentoCard>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Prominent Sticky Bottom Start 3D Hands-Free Cooking CTA */}
      <div
        data-kitchen-action="fixed"
        className="kitchen-recipe-action fixed bottom-[calc(68px+env(safe-area-inset-bottom,0px))] sm:bottom-0 left-0 right-0 sm:left-20 lg:left-64 p-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] bg-white/92 backdrop-blur-xl border-t border-tk-stone z-40 shadow-elevated"
      >
        <div className="mx-auto w-full max-w-[1240px] flex items-center gap-3">
          <button
            type="button"
            aria-label={`Bắt đầu nấu (${recipe.cookTimeMinutes} phút)`}
            onClick={handleStartCook}
            disabled={inventoryQuery.isPending || inventoryQuery.isError}
            className={clsx(
              'w-full min-h-[56px] rounded-2xl bg-tk-flame hover:bg-tk-flame-hover active:bg-tk-flame-deep px-6 py-3.5 text-white font-heading font-extrabold text-sm sm:text-base shadow-float flex items-center justify-center gap-2.5 transition-tap cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-tk-flame/40',
              (inventoryQuery.isPending || inventoryQuery.isError) &&
                'opacity-50 pointer-events-none',
            )}
          >
            <ThreeDOrbitBadgeIcon size={20} tone="cream" />
            <span>
              Vào Bếp Nấu Ngay · Chế độ 3D Rảnh tay ({recipe.cookTimeMinutes} phút)
            </span>
            <ArrowRight className="w-5 h-5 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
