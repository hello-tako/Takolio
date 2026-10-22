import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluateRecipeAvailability, scaleRecipeServings, type RecipeIngredientAvailability } from '@frigo/recipes';
import { TopBar } from '../components/common/TopBar';
import { SaveRecipeButton } from '../components/common/SaveRecipeButton';
import { RecipeMedia } from '../components/common/RecipeMedia';
import { Button } from '../components/common/Button';
import { InlineError, SkeletonCard } from '../components/common/AsyncState';
import { api, ApiError } from '../services/api';
import { queryKeys } from '../lib/queryKeys';
import { useCookingStore } from '../stores/useCookingStore';
import { getIngredientImage } from '../lib/ingredient-images';
import { Check, ArrowRight, SearchX } from 'lucide-react';
import { clsx } from 'clsx';
import { resolveRecipeImage } from '../lib/recipe-media';
import {
  formatDifficultyLabel,
  matchStepIngredients,
  resolveStepTechnique,
  summarizeRecipeTechniques,
} from '../lib/culinary-visuals';
import { CookingTechniqueVisual, KitchenLoopStrip } from '../components/cooking/CookingTechniqueVisual';
import { TakoMascot } from '../components/common/TakoMascot';
import { TakosanIcon } from '../components/common/TakosanIcon';
import { RecipeMealDialog } from '../features/favorites/FavoritesCollection';
import { isMealPlannerEnabled } from '../features/planner/feature';
import { isMealCompositionEnabled } from '../features/planner/composition';
import { useAuthStore } from '../stores/useAuthStore';


type RecipeTabId = 'steps' | 'ingredients' | 'nutrition';

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
    id: 'steps',
    label: 'Cách nấu',
    tabId: 'recipe-detail-tab-steps',
    panelId: 'recipe-detail-panel-steps',
  },
  {
    id: 'ingredients',
    label: 'Nguyên liệu',
    tabId: 'recipe-detail-tab-ingredients',
    panelId: 'recipe-detail-panel-ingredients',
  },
  {
    id: 'nutrition',
    label: 'Dinh dưỡng',
    tabId: 'recipe-detail-tab-nutrition',
    panelId: 'recipe-detail-panel-nutrition',
  },
];

export const RecipeDetailPage: React.FC = () => {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const recipeKey = slug || id || '';
  const [params, setParams] = useSearchParams();
  const selectedServings = /^[1-9][0-9]?$/.test(params.get('servings') ?? '') && Number(params.get('servings')) <= 20
    ? Number(params.get('servings')) : undefined;
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

  const owner = useAuthStore(state => `${state.userId}:${state.householdId}:${state.isGuest}`);
  const isGuest = useAuthStore(state => state.isGuest);
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  useEffect(() => { setMealDialogOpen(false); }, [owner, recipeKey]);
  const [addedToShop, setAddedToShop] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<RecipeTabId>('ingredients');
  const tabRefs = useRef<Record<RecipeTabId, HTMLButtonElement | null>>({
    steps: null,
    ingredients: null,
    nutrition: null,
  });

  const recipeQuery = useQuery({
    queryKey: queryKeys.recipe(recipeKey),
    queryFn: () => api.getRecipeById(recipeKey),
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
      setAddedToShop((prev) => [...prev, shoppingEntryKey(sourceRecipeKey, ingredient)]);
      return queryClient.invalidateQueries({ queryKey: shoppingKey });
    },
  });

  const baseRecipe = recipeQuery.data?.recipe;
  const recipe = baseRecipe && selectedServings ? scaleRecipeServings(baseRecipe, selectedServings) : baseRecipe;
  const matchInfo = recipeQuery.data?.match;
  const inventory = inventoryQuery.data ?? [];

  const notFound =
    recipeQuery.isError &&
    recipeQuery.error instanceof ApiError &&
    recipeQuery.error.kind === 'http' &&
    recipeQuery.error.status === 404;

  if (recipeKey && recipeQuery.isPending) {
    return (
      <div className="takosan-rebuild recipe-page min-h-screen bg-semantic-background">
        <TopBar kitchen showBack backTo={returnTo} title="Chi tiết món ăn" />
        <h1 className="sr-only">Chi tiết món ăn</h1>
        <div className="p-4 space-y-4" role="status" aria-live="polite">
          <SkeletonCard className="h-56 rounded-2xl" />
          <SkeletonCard className="h-10" />
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
          <span className="sr-only">Đang tải công thức…</span>
        </div>
      </div>
    );
  }

  if (recipeQuery.isError && !notFound) {
    return (
      <div className="takosan-rebuild recipe-page min-h-screen bg-semantic-background">
        <TopBar kitchen showBack backTo={returnTo} title="Chi tiết món ăn" />
        <h1 className="sr-only">Chi tiết món ăn</h1>
        <div className="p-4">
          <InlineError error={recipeQuery.error} onRetry={() => recipeQuery.refetch()} />
        </div>
      </div>
    );
  }

  if (notFound || !recipe) {
    return (
      <div className="takosan-rebuild recipe-page min-h-screen bg-semantic-background">
        <TopBar kitchen showBack backTo={returnTo} title="Chi tiết món ăn" />
        <div className="p-8 text-center space-y-3">
          <SearchX className="w-10 h-10 text-semantic-border-strong mx-auto" aria-hidden="true" />
          <h1 className="font-heading font-bold text-base text-semantic-text-primary">
            Không tìm thấy công thức này
          </h1>
          <p className="text-xs text-semantic-text-muted">
            Món ăn có thể đã bị gỡ hoặc đường dẫn không đúng.
          </p>
          <Button onClick={() => navigate('/recipes')} className="mt-2">
            Xem tất cả công thức
          </Button>
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
  const image = resolveRecipeImage(recipe);
  const difficultyInfo = formatDifficultyLabel(recipe.difficulty);
  const techniqueHighlights = summarizeRecipeTechniques(recipe);
  const satisfiedCount = availability.filter((item) => item.status === 'satisfied').length;
  const readinessPercent = inventoryReady
    ? Math.round((satisfiedCount / Math.max(1, availability.length)) * 100)
    : 0;

  const handleStartCook = () => {
    const attempt = useCookingStore.getState().attempt;
    if (attempt && !['saved', 'queued'].includes(attempt.status)) {
      navigate('/cooking/complete');
      return;
    }
    startCooking(recipe, inventory);
    navigate(`/cook/${recipe.slug}?servings=${recipe.servings}`);
  };

  return (
    <div className="takosan-rebuild recipe-page min-h-screen bg-semantic-background pb-32">
      <TopBar kitchen showBack backTo={returnTo} title={recipe.title} />
      {mealDialogOpen && !isGuest && (
        <RecipeMealDialog key={`${owner}:${recipe.id}`} entry={{ recipeId: recipe.id, title: recipe.title }}
          requireSaved={false} defaultServings={recipe.servings} onClose={() => setMealDialogOpen(false)} />
      )}
      {inventoryQuery.isError && (
        <InlineError error={inventoryQuery.error} onRetry={() => inventoryQuery.refetch()} />
      )}

      <div className="recipe-loop-wrapper">
        <KitchenLoopStrip
          activeStage="recipes"
          summaryText={
            inventoryReady
              ? pendingIngredients.length === 0
                ? 'Tủ lạnh đã đủ nguyên liệu — sẵn sàng vào bếp'
                : `Còn ${pendingIngredients.length} nguyên liệu cần kiểm tra hoặc thêm vào giỏ đi chợ`
              : 'Đang đồng bộ dữ liệu nguyên liệu với tủ lạnh của bạn'
          }
        />
      </div>

      <div className="recipe-workspace">
        <section className="recipe-overview" aria-label="Tổng quan món ăn">
          <RecipeMedia image={image} title={recipe.title} className="recipe-cover" priority />
          <div className="recipe-intro">
            <div className="recipe-badges flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-takosan-green text-white text-xs font-bold uppercase tracking-wider">
                {recipe.cuisine === 'vietnamese' ? 'Món Việt' : recipe.cuisine}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-takosan-mint text-takosan-green-deep text-xs font-semibold">
                {difficultyInfo.label}
              </span>
              {typeof matchInfo?.matchPercentage === 'number' && (
                <span className="px-2.5 py-0.5 rounded-full bg-semantic-background-subtle text-xs font-semibold text-semantic-text-secondary">
                  Có {matchInfo.matchPercentage}% loại nguyên liệu
                </span>
              )}
            </div>
            <h1 className="font-heading font-bold text-[28px] leading-tight text-semantic-text-primary sm:text-[32px]">
              {recipe.title}
            </h1>
            <SaveRecipeButton recipeId={recipe.id} title={recipe.title} />
            {!isGuest && isMealPlannerEnabled() && isMealCompositionEnabled() && (
              <Button variant="outline" className="mt-3" onClick={() => setMealDialogOpen(true)}>
                Xếp món vào bữa
              </Button>
            )}
            <div className="recipe-facts flex items-center gap-4 text-sm mt-3 text-semantic-text-secondary">
              <span className="flex items-center gap-1">
                <TakosanIcon name="history" className="w-4 h-4" />
                <span>{recipe.cookTimeMinutes} phút</span>
              </span>
              <span className="flex items-center gap-1">
                <TakosanIcon name="profile" className="w-4 h-4" />
                <span>{recipe.servings} người</span>
              </span>
              <span className="flex items-center gap-1">
                <TakosanIcon name="chef" className="w-4 h-4" />
                <span>{recipe.steps.length} bước thực hiện</span>
              </span>
            </div>
            {techniqueHighlights.length > 0 && (
              <div className="recipe-technique-summary" aria-label="Kỹ thuật chế biến chính">
                <span className="recipe-technique-summary-label">
                  <TakosanIcon name="chef" className="w-4 h-4" />
                  Kỹ thuật bếp:
                </span>
                <div className="recipe-technique-summary-pills">
                  {techniqueHighlights.map((tech) => (
                    <span key={tech.id} className="recipe-technique-chip">
                      {tech.shortLabel}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <label className="discovery-select-label mt-4">
              Nấu cho bao nhiêu người?
              <select value={recipe.servings} onChange={event => {
                const next = new URLSearchParams(params);
                next.set('servings', event.target.value);
                setParams(next, { replace: true });
              }}>
                {Array.from({ length: 20 }, (_, index) => index + 1).map(value =>
                  <option key={value} value={value}>{value} người</option>)}
              </select>
            </label>
            {addedToShop.length > 0 && <p className="mt-2 text-sm text-semantic-text-secondary">
              Đã thêm nguyên liệu vào danh sách. Nếu đổi số người, kiểm tra và chỉnh lượng đã thêm trong danh sách đi chợ.
            </p>}
            <p className="mt-4 text-base leading-relaxed text-semantic-text-secondary">
              {recipe.description}
            </p>
            <div className="recipe-availability mt-5" data-testid="recipe-availability" role="status">

              <div className="recipe-availability-head">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {!inventoryReady
                      ? 'Chưa kiểm tra được lượng trong tủ'
                      : pendingIngredients.length === 0
                        ? 'Đủ lượng nguyên liệu để nấu'
                        : `Cần bổ sung hoặc kiểm tra ${pendingIngredients.length} nguyên liệu`}
                  </p>
                  <p className="mt-1 text-sm text-semantic-text-secondary">
                    Lượng bên dưới dành cho {recipe.servings} người. Kiểm tra độ tươi trước khi nấu.
                  </p>
                </div>
                <TakoMascot
                  pose={inventoryReady && pendingIngredients.length === 0 ? 'cooking' : 'thinking'}
                  size={96}
                  className="recipe-availability-mascot"
                />
              </div>
              {inventoryReady && (
                <div className="recipe-readiness-bar-wrap" aria-hidden="true">
                  <div className="recipe-readiness-bar">
                    <span style={{ width: `${readinessPercent}%` }} />
                  </div>
                  <span className="recipe-readiness-caption">
                    {satisfiedCount}/{availability.length} nguyên liệu sẵn sàng trong tủ
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>


        <div className="recipe-preparation space-y-4 animate-fade-in">
          {/* Tabs: Cách nấu | Nguyên liệu | Dinh dưỡng */}
          {/* Arrow-key navigation uses automatic activation and follows focus. */}
          <div
            className="recipe-tabs flex bg-semantic-border/70 p-1 rounded-xl"
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
                  if (event.key === 'ArrowLeft')
                    nextIndex = (tabIndex - 1 + RECIPE_TABS.length) % RECIPE_TABS.length;
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
                  'flex-1 py-2 rounded-lg text-xs font-heading font-bold transition-tap tap-target focus-visible:outline-none focus-visible:shadow-t17-focus',
                  activeTab === tab.id
                    ? 'bg-white text-takosan-green shadow-xs'
                    : 'text-semantic-text-secondary hover:text-semantic-text-primary',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Cách nấu */}
          <div
            id="recipe-detail-panel-steps"
            role="tabpanel"
            aria-labelledby="recipe-detail-tab-steps"
            tabIndex={0}
            hidden={activeTab !== 'steps'}
            className="space-y-4 pt-1 focus-visible:outline-none focus-visible:shadow-t17-focus"
          >
            {/* tabIndex provides a direct keyboard entry point for text-only panels. */}
            {activeTab === 'steps' && (
              <>
                <div className="recipe-steps-banner">
                  <div>
                    <p className="recipe-steps-eyebrow">Hướng dẫn từng bước · Takolio Bếp Nhà</p>
                    <p className="recipe-steps-subtitle">
                      Mỗi bước đi kèm minh họa kỹ thuật, dụng cụ gợi ý và nguyên liệu cần dùng ngay tại bước đó.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartCook}
                    disabled={inventoryQuery.isPending || inventoryQuery.isError}
                    className="recipe-inline-cook-btn"
                  >
                    <TakosanIcon name="chef" className="w-4 h-4" />
                    <span>Mở chế độ nấu từng bước</span>
                  </button>
                </div>
                {recipe.steps.map((s: any, idx: number) => {
                  const stepNum = s.stepNumber || idx + 1;
                  const technique = resolveStepTechnique(
                    s.instruction,
                    s.title,
                    idx,
                    recipe.steps.length,
                  );
                  const stepIngredients = matchStepIngredients(s.instruction, recipe.ingredients);
                  return (
                    <div
                      key={stepNum}
                      className="recipe-step-card bg-white rounded-2xl p-4 border border-semantic-border shadow-xs"
                    >
                      <CookingTechniqueVisual
                        technique={technique}
                        stepNumber={stepNum}
                        variant="card"
                      />
                      <div className="recipe-step-body flex gap-3.5 mt-3">
                        <div className="recipe-step-number w-7 h-7 rounded-full bg-takosan-green text-white font-heading font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          {stepNum}
                        </div>
                        <div className="flex-1 min-w-0">
                          {s.title && (
                            <h4 className="font-heading font-bold text-sm text-semantic-text-primary mb-1">
                              {s.title}
                            </h4>
                          )}
                          <p className="text-base text-semantic-text-secondary leading-relaxed">
                            {s.instruction}
                          </p>
                          {stepIngredients.length > 0 && (
                            <div
                              className="recipe-step-ingredients"
                              aria-label="Nguyên liệu nhắc trong bước này (định lượng tổng món)"
                            >
                              {stepIngredients.map((ing) => (
                                <span
                                  key={`${ing.ingredientId}-${ing.unit}`}
                                  className="recipe-step-ingredient-chip"
                                >
                                  <img
                                    src={getIngredientImage(ing.ingredientId, ing.name)}
                                    alt=""
                                    width={20}
                                    height={20}
                                    loading="lazy"
                                  />
                                  <span>
                                    {ing.name} (tổng: {quantityText(ing.requiredQuantity, ing.unit)})
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                          {s.tip && (
                            <div className="recipe-step-tip">
                              <TakosanIcon name="aiSuggestion" className="w-4 h-4" />
                              <p>
                                <strong>Mẹo bếp:</strong> {s.tip}
                              </p>
                            </div>
                          )}
                          {s.timerMinutes && (
                            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-takosan-green-deep bg-takosan-mint px-2.5 py-1 rounded-lg mt-2.5 border border-takosan-mint-deep/60">
                              <TakosanIcon name="history" className="w-3.5 h-3.5" />
                              <span>Hẹn giờ: {s.timerMinutes} phút</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>


          {/* Tab 2: Nguyên liệu */}
          <div
            id="recipe-detail-panel-ingredients"
            role="tabpanel"
            aria-labelledby="recipe-detail-tab-ingredients"
            tabIndex={0}
            hidden={activeTab !== 'ingredients'}
            className="bg-white rounded-2xl p-4 border border-semantic-border shadow-xs space-y-3 focus-visible:outline-none focus-visible:shadow-t17-focus"
          >
            {activeTab === 'ingredients' && (
              <>
                <div className="recipe-ingredients-heading flex items-center justify-between border-b border-semantic-border/70 pb-2.5">
                  <h3 className="font-heading font-bold text-sm text-semantic-text-primary">
                    Nguyên liệu ({recipe.ingredients.length})
                  </h3>
                  {typeof matchInfo?.availableIngredientCount === 'number' && (
                    <span className="text-xs font-bold text-takosan-green">
                      {inventoryReady
                        ? `${availability.filter((item) => item.status === 'satisfied').length} đủ lượng`
                        : 'Đang kiểm tra'}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {availability.map((ing, index) => {
                    const hasIngredient = inventoryReady && ing.status === 'satisfied';
                    const canBuy =
                      inventoryReady && ing.missingQuantity !== null && ing.missingQuantity > 0;
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

                    return (
                      <div
                        key={`${ing.ingredientId}-${index}`}
                        className={clsx(
                          'ingredient-availability-row p-3 rounded-xl border flex items-center justify-between gap-3 transition-tap',
                          hasIngredient
                            ? 'bg-takosan-mint/50 border-takosan-mint-deep/80'
                            : 'bg-white border-semantic-border/70',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-semantic-background-subtle border border-semantic-border/70 flex items-center justify-center p-1 overflow-hidden shrink-0">
                            <img
                              src={getIngredientImage(ing.ingredientId, ing.name)}
                              alt={ing.name}
                              width={40}
                              height={40}
                              loading="lazy"
                              className="w-full h-full object-contain"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-heading font-bold text-sm text-semantic-text-primary">
                                {ing.name}
                              </p>
                              {hasIngredient && (
                                <span className="w-4 h-4 rounded-full bg-takosan-green text-white flex items-center justify-center text-[10px]">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-semantic-text-secondary mt-1">
                              Cần {quantityText(ing.requiredQuantity, ing.unit)}
                              {ing.isOptional ? ' · Tùy chọn' : ''}
                            </p>
                            <p
                              className="text-sm text-semantic-text-muted mt-1"
                              data-availability={inventoryReady ? ing.status : 'pending'}
                            >
                              {!inventoryReady
                                ? 'Chưa có dữ liệu tồn kho'
                                : ing.status === 'unresolved'
                                  ? 'Cần kiểm tra lượng hoặc đơn vị trong tủ'
                                  : `Trong tủ: ${quantityText(ing.availableQuantity, ing.unit)}${hasIngredient ? ' · Đủ lượng' : ` · Thiếu ${quantityText(ing.missingQuantity ?? 0, ing.unit)}`}`}
                            </p>
                          </div>
                        </div>

                        {canBuy && (
                          <button
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
                              'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-tap tap-target',
                              isAdded
                                ? 'bg-semantic-border/60 text-semantic-text-muted border border-semantic-border'
                                : 'bg-takosan-mint text-takosan-green-deep border border-takosan-mint-deep/80 hover:bg-takosan-mint-hover active:scale-95 shadow-xs',
                            )}
                          >
                            <TakosanIcon name="shopping" className="w-3.5 h-3.5" />
                            <span>{isAdded ? 'Đã thêm' : 'Mua phần thiếu'}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {addToShopping.isError && (
                  <p className="text-[11px] text-semantic-danger font-medium" role="alert">
                    Chưa thêm được vào danh sách mua. Vui lòng thử lại.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Tab 3: Dinh dưỡng — only real data, no invented numbers */}
          <div
            id="recipe-detail-panel-nutrition"
            role="tabpanel"
            aria-labelledby="recipe-detail-tab-nutrition"
            tabIndex={0}
            hidden={activeTab !== 'nutrition'}
            className="bg-white rounded-2xl p-4 border border-semantic-border shadow-xs space-y-3 focus-visible:outline-none focus-visible:shadow-t17-focus"
          >
            {activeTab === 'nutrition' && (
              <>
                <h3 className="font-heading font-bold text-sm text-semantic-text-primary">
                  Dinh dưỡng mỗi khẩu phần
                </h3>
                {recipe.nutrition ? (
                  <div className="recipe-nutrition-grid grid grid-cols-4 gap-2 pt-1 text-center">
                    {[
                      { label: 'Calories', value: recipe.nutrition.calories, unit: 'kcal' },
                      { label: 'Đạm', value: recipe.nutrition.proteinG, unit: 'g' },
                      { label: 'Béo', value: recipe.nutrition.fatG, unit: 'g' },
                      { label: 'Carb', value: recipe.nutrition.carbG, unit: 'g' },
                    ].map((cell) => (
                      <div
                        key={cell.label}
                        className="bg-semantic-background-subtle p-2.5 rounded-xl border border-semantic-border/70"
                      >
                        <p className="text-xs text-semantic-text-muted uppercase font-semibold">
                          {cell.label}
                        </p>
                        <p className="font-heading font-bold text-base text-semantic-text-primary mt-1">
                          {typeof cell.value === 'number' ? cell.value : '—'}
                        </p>
                        <p className="text-xs text-semantic-text-muted">{cell.unit}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-semantic-text-muted">
                    Món này chưa có thông tin dinh dưỡng.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {/* Sticky Bottom Start Cooking Button */}
      <div
        data-kitchen-action="fixed"
        className="kitchen-recipe-action fixed bottom-[calc(68px+env(safe-area-inset-bottom,0px))] sm:bottom-0 left-0 right-0 sm:left-20 lg:left-64 p-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] bg-white/95 backdrop-blur-md border-t border-semantic-border z-40 shadow-lg"
      >
        <div className="mx-auto w-full max-w-[var(--content-wide)]">
          <Button
            fullWidth
            size="lg"
            onClick={handleStartCook}
            disabled={inventoryQuery.isPending || inventoryQuery.isError}
            className="bg-takosan-green hover:bg-takosan-green-hover text-white font-heading font-bold text-base py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2"
          >
            <TakosanIcon name="chef" className="w-5 h-5" />
            <span>Bắt đầu nấu ({recipe.cookTimeMinutes} phút)</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};
