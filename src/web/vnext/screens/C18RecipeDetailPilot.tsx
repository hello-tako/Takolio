import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  evaluateRecipeAvailability,
  scaleRecipeServings,
  type RecipeIngredientAvailability,
} from '@frigo/recipes';
import { api, ApiError } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';
import { useCookingStore } from '../../stores/useCookingStore';
import { resolveRecipeImage } from '../../lib/recipe-media';
import { formatDifficultyLabel } from '../../lib/culinary-visuals';
import { SaveRecipeButton } from '../../components/common/SaveRecipeButton';
import { ConsumerStudioShell } from '../components/Shells';
import {
  TkvBadge,
  TkvButton,
  TkvEmptyState,
  TkvErrorState,
  TkvIconButton,
  TkvSurface,
} from '../components/Primitives';
import { VNextIcon } from '../components/VNextIcons';
import { VerifiedDishImage } from '../components/VNextMedia';
import { RecipeDetailSkeleton } from '../components/Skeletons';
import { buildRecipeJsonLd, useVNextSeo } from '../lib/seo';
import type { SupportedLocale, UnitSystem } from '../../../shared/locales';
import {
  containsVietnameseDiacritics,
  formatLocalizedMeasure,
  localizeDifficulty,
  localizeIngredientName,
  localizeRecipeCategory,
  localizeRecipeDescription,
  localizeRecipeSteps,
  localizeRecipeTitle,
  lSync,
  useLocaleText,
} from '../../i18n/app-i18n';

function formatQty(
  quantity: number,
  unit: string,
  locale: SupportedLocale,
  unitSystem: UnitSystem,
): string {
  if (locale !== 'vi') {
    return formatLocalizedMeasure(quantity, unit, locale, unitSystem);
  }
  const formatted = new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 6 }).format(quantity);
  const unitLabel =
    unit === 'piece'
      ? lSync('quả/cái', 'pcs', locale)
      : unit === 'pack'
        ? lSync('gói', 'pack', locale)
        : unit === 'bunch'
          ? lSync('bó', 'bunch', locale)
          : unit === 'slice'
            ? lSync('lát', 'slice', locale)
            : unit;
  return `${formatted} ${unitLabel}`;
}

/**
 * C18 — Chi tiết món ăn + C19 Nguyên liệu có và thiếu (G02 Live Pilot).
 * Faithfully matches `C18.png` on mobile (390×844) and Desktop 2-Column Culinary Workbench (1440×900):
 * - Verified dish image (`VerifiedDishImage` — never mismatches dish!)
 * - Pills: Cook time · Servings · Difficulty (`35-45 phút · 4 người · Dễ/Vừa`)
 * - Interactive serving scaler (`1..20`) updating exact quantities via `scaleRecipeServings`
 * - Quantity & unit-aware `evaluateRecipeAvailability` (`C19` — never binary name-only match!)
 * - Sourced nutrition facts only (`Chưa có thông tin` if absent)
 */
export const C18RecipeDetailPilot: React.FC = () => {
  const { l, locale, unitSystem } = useLocaleText();
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const recipeKey = slug || id || 'thit-kho-trung';
  const [params, setParams] = useSearchParams();
  const requestedFingerprint = params.get('contentFingerprint') ?? undefined;
  const rawServings = params.get('servings') ?? '';
  const selectedServings =
    /^[1-9][0-9]?$/.test(rawServings) && Number(rawServings) <= 20
      ? Number(rawServings)
      : undefined;

  const navigate = useNavigate();
  const { state } = useLocation();
  const queryReturnTo = params.get('returnTo');
  const returnTo =
    queryReturnTo &&
    (queryReturnTo === '/' || queryReturnTo.startsWith('/recipes')) &&
    !queryReturnTo.startsWith('//')
      ? queryReturnTo
      : typeof state?.discoveryReturn === 'string' &&
          (state.discoveryReturn === '/' || state.discoveryReturn.startsWith('/recipes'))
        ? state.discoveryReturn
        : '/recipes';

  const queryClient = useQueryClient();
  const startCooking = useCookingStore((s) => s.startCooking);
  const [addedKeys, setAddedKeys] = useState<string[]>([]);

  const recipeQuery = useQuery({
    queryKey: queryKeys.recipe(recipeKey, requestedFingerprint),
    queryFn: () => api.getRecipeById(recipeKey, requestedFingerprint),
    enabled: Boolean(recipeKey),
  });

  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
  });

  const addShortfallMutation = useMutation({
    mutationFn: ({
      ing,
      recipeTitle,
      sourceKey,
    }: {
      ing: RecipeIngredientAvailability;
      recipeTitle: string;
      sourceKey: string;
    }) => {
      if (ing.missingQuantity === null || ing.missingQuantity <= 0) {
        throw new Error(
          l(
            'Cần kiểm tra đơn vị trước khi thêm tự động vào giỏ đi chợ.',
            'Please check the unit before adding automatically to your shopping list.',
          ),
        );
      }
      return api.addShoppingItem({
        name: localizeIngredientName(ing.ingredientId, ing.name, locale),
        quantity: ing.missingQuantity,
        unit: ing.unit,
        sourceRecipeTitle: recipeTitle,
        ingredientId: ing.ingredientId,
        sourceRecipeId: sourceKey,
      });
    },
    onSuccess: (_res, { ing }) => {
      setAddedKeys((prev) => [...prev, `${ing.ingredientId}:${ing.unit}`]);
      return queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList() });
    },
  });

  const baseRecipe = recipeQuery.data?.recipe;
  const recipe =
    baseRecipe && selectedServings
      ? scaleRecipeServings(baseRecipe, selectedServings)
      : baseRecipe;
  const inventory = inventoryQuery.data ?? [];

  const notFound =
    recipeQuery.isError &&
    recipeQuery.error instanceof ApiError &&
    recipeQuery.error.kind === 'http' &&
    recipeQuery.error.status === 404;

  const displayTitle = recipe ? localizeRecipeTitle(recipe, locale) : '';
  const displayDescription = recipe ? localizeRecipeDescription(recipe, locale) : '';
  const localizedSteps = useMemo(
    () => (recipe ? localizeRecipeSteps(recipe, locale, unitSystem) : []),
    [recipe, locale, unitSystem],
  );

  const recipeJsonLd = useMemo(() => {
    if (!recipe) return null;
    return buildRecipeJsonLd({
      slug: recipe.slug,
      title: displayTitle,
      description: displayDescription,
      cuisine: recipe.cuisine,
      category: recipe.category ? localizeRecipeCategory(recipe.category, locale) : null,
      locale,
      inLanguage: locale === 'vi' ? 'vi-VN' : 'en',
      imageUrl: resolveRecipeImage(recipe).src,
      cookMinutes: recipe.cookTimeMinutes,
      servings: recipe.servings,
      calories: recipe.nutrition?.calories ?? null,
      ingredients: recipe.ingredients.map(
        (ing) =>
          `${localizeIngredientName(ing.ingredientId, ing.name, locale)} (${formatQty(ing.requiredQuantity, ing.unit, locale, unitSystem)})`,
      ),
      steps: localizedSteps.map((st) => st.instruction),
    });
  }, [recipe, displayTitle, displayDescription, locale, unitSystem, localizedSteps]);

  useVNextSeo({
    title: recipe
      ? l(`${displayTitle} — Công thức chuẩn định lượng`, `${displayTitle} — Scaled Recipe`)
      : l('Chi tiết món ăn', 'Recipe details'),
    description: recipe
      ? displayDescription
      : l(
          'Công thức bữa cơm gia đình Việt đối chiếu định lượng tồn kho tủ lạnh trên Takolio.',
          'Home-cooked recipes matched against your fridge inventory with exact scaling on Takolio.',
        ),
    canonicalPath: `/recipes/${recipe?.slug || recipeKey}`,
    domainSurface: 'app',
    noindex: notFound,
    jsonLd: recipeJsonLd,
  });

  const updateServings = (nextServings: number) => {
    const clamped = Math.max(1, Math.min(20, nextServings));
    const next = new URLSearchParams(params);
    next.set('servings', String(clamped));
    setParams(next, { replace: true });
  };

  if (recipeQuery.isPending) {
    return (
      <ConsumerStudioShell screenId="C18" title={l('Chi tiết món ăn', 'Recipe details')} backTo={returnTo}>
        <RecipeDetailSkeleton />
      </ConsumerStudioShell>
    );
  }

  if (notFound || (!recipeQuery.isError && !recipe)) {
    return (
      <ConsumerStudioShell screenId="C18" title={l('Chi tiết món ăn', 'Recipe details')} backTo={returnTo}>
        <TkvEmptyState
          pose="error"
          eyebrow={l('Không tìm thấy món ăn', 'Recipe not found')}
          title={l(
            'Công thức này không tồn tại hoặc đã thay đổi đường dẫn',
            'This recipe does not exist or has moved',
          )}
          description={l(
            'Bạn có thể quay lại kho công thức để tìm món ăn khác phù hợp với tủ lạnh.',
            'Return to the recipe catalog to find another dish that fits your fridge.',
          )}
          primaryAction={
            <TkvButton onClick={() => navigate('/recipes')}>
              {l('Xem kho công thức', 'Browse recipes')}
            </TkvButton>
          }
        />
      </ConsumerStudioShell>
    );
  }

  if (recipeQuery.isError || !recipe) {
    return (
      <ConsumerStudioShell screenId="C18" title={l('Chi tiết món ăn', 'Recipe details')} backTo={returnTo}>
        <TkvErrorState
          title={l('Chưa tải được chi tiết món ăn', 'Could not load recipe details')}
          message={l(
            'Kết nối tới máy chủ công thức gặp gián đoạn. Vui lòng thử lại.',
            'Connection to the recipe server was interrupted. Please try again.',
          )}
          onRetry={() => void recipeQuery.refetch()}
        />
      </ConsumerStudioShell>
    );
  }

  const availability = evaluateRecipeAvailability(recipe, inventory);
  const difficultyLabel =
    locale === 'vi'
      ? formatDifficultyLabel(recipe.difficulty, locale).label
      : localizeDifficulty(recipe.difficulty, locale);
  const canonicalImg = resolveRecipeImage(recipe);

  const handleStartCooking = () => {
    const attempt = useCookingStore.getState().attempt;
    if (attempt && !['saved', 'queued'].includes(attempt.status)) {
      navigate('/cooking/complete');
      return;
    }
    startCooking(recipe, inventory, recipeQuery.data?.contentFingerprint);
    const cookParams = new URLSearchParams({
      stage: 'prep',
      servings: String(recipe.servings),
    });
    if (recipeQuery.data?.contentFingerprint) {
      cookParams.set('contentFingerprint', recipeQuery.data.contentFingerprint);
    }
    navigate(`/cook/${recipe.slug}?${cookParams.toString()}`);
  };

  return (
    <ConsumerStudioShell screenId="C18" title={l('Chi tiết món ăn', 'Recipe details')} backTo={returnTo}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left Media & Facts Column (5 cols on Desktop; Top Hero on Mobile) */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
          <div className="rounded-[24px] bg-[var(--tkv-surface-muted,#E7F4EC)] p-2.5 border border-[var(--tkv-border,#DCE6DE)] shadow-xs">
            <VerifiedDishImage
              slug={recipe.slug}
              title={displayTitle}
              canonicalFallbackSrc={canonicalImg}
              aspectClass="aspect-[4/3]"
              priority
              className="rounded-[18px]"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#152E2C)] leading-tight">
                {displayTitle}
              </h1>
              <SaveRecipeButton recipeId={recipe.id} title={displayTitle} compact />
            </div>

            {/* 3 Sunlit Ceramic Metadata Pills */}
            <div className="flex items-center gap-2 flex-wrap tabular-nums">
              <span className="min-h-[38px] px-4 py-1.5 rounded-full bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-[var(--tkv-accent-ink,#B33A22)] text-sm font-bold inline-flex items-center gap-1.5">
                <VNextIcon name="timer" size={15} className="text-[var(--tkv-primary,#196149)]" />
                {l(`${recipe.cookTimeMinutes} phút`, `${recipe.cookTimeMinutes} min`)}
              </span>
              <span className="min-h-[38px] px-4 py-1.5 rounded-full bg-white border border-[var(--tkv-border,#DCE6DE)] text-[var(--tkv-ink,#152E2C)] text-sm font-semibold inline-flex items-center gap-1.5">
                <VNextIcon name="users" size={15} className="text-[var(--tkv-sage,#196149)]" />
                {l(
                  `${recipe.servings} người`,
                  `${recipe.servings} ${recipe.servings === 1 ? 'serving' : 'servings'}`,
                )}
              </span>
              <span className="min-h-[38px] px-4 py-1.5 rounded-full bg-[var(--tkv-sage-soft,#E7F4EC)] border border-[var(--tkv-sage-border,#BDE0CC)] text-[var(--tkv-sage-ink,#134C39)] text-sm font-semibold inline-flex items-center">
                {difficultyLabel}
              </span>
            </div>

            <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
              {displayDescription}
            </p>

            <div className="pt-1 flex flex-col sm:flex-row gap-2.5">
              <TkvButton
                variant="primary"
                size="lg"
                fullWidth
                iconRight="arrow-right"
                onClick={handleStartCooking}
                data-testid="c18-start-cooking-btn"
              >
                {l(
                  `Bắt đầu nấu (${localizedSteps.length} bước)`,
                  `Start cooking (${localizedSteps.length} ${localizedSteps.length === 1 ? 'step' : 'steps'})`,
                )}
              </TkvButton>
            </div>
          </div>

          {/* Sourced Nutrition Card — strictly honest when null */}
          <TkvSurface className="p-4 space-y-2.5 bg-white border-[var(--tkv-border,#DCE6DE)]">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <h2 className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink,#152E2C)]">
                {l('Thông tin dinh dưỡng / khẩu phần', 'Nutrition per serving')}
              </h2>
              <span className="text-xs text-[var(--tkv-ink-muted,#52706A)] shrink-0">
                {l('Nguồn công thức', 'Recipe source')}
              </span>
            </div>
            {recipe.nutrition ? (
              <div className="grid grid-cols-2 min-[400px]:grid-cols-4 gap-2 text-center tabular-nums">
                <div className="p-2 rounded-xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)]">
                  <p className="text-sm font-extrabold text-[var(--tkv-ink,#152E2C)]">{recipe.nutrition.calories}</p>
                  <p className="text-[11px] text-[var(--tkv-ink-muted,#52706A)]">kcal</p>
                </div>
                <div className="p-2 rounded-xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)]">
                  <p className="text-sm font-extrabold text-[var(--tkv-ink,#152E2C)]">{recipe.nutrition.proteinG}g</p>
                  <p className="text-[11px] text-[var(--tkv-ink-muted,#52706A)]">{l('Đạm', 'Protein')}</p>
                </div>
                <div className="p-2 rounded-xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)]">
                  <p className="text-sm font-extrabold text-[var(--tkv-ink,#152E2C)]">{recipe.nutrition.carbG}g</p>
                  <p className="text-[11px] text-[var(--tkv-ink-muted,#52706A)]">{l('Tinh bột', 'Carbs')}</p>
                </div>
                <div className="p-2 rounded-xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)]">
                  <p className="text-sm font-extrabold text-[var(--tkv-ink,#152E2C)]">{recipe.nutrition.fatG}g</p>
                  <p className="text-[11px] text-[var(--tkv-ink-muted,#52706A)]">{l('Chất béo', 'Fat')}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--tkv-ink-muted,#52706A)]">
                {l(
                  'Chưa có thông tin dinh dưỡng đã xác minh cho món ăn này.',
                  'No verified nutrition facts available for this recipe yet.',
                )}
              </p>
            )}
          </TkvSurface>
        </div>

        {/* Right Ingredients (C19) & Cooking Steps Column (7 cols on Desktop) */}
        <div className="lg:col-span-7 space-y-7 min-w-0">
          {/* Ingredients Section */}
          <section aria-labelledby="c18-ingredients-heading" className="space-y-3.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 id="c18-ingredients-heading" className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink,#152E2C)] tabular-nums">
                {l(`Nguyên liệu chính (${availability.length})`, `Ingredients (${availability.length})`)}
              </h2>

              <div className="inline-flex items-center gap-2 bg-white border border-[var(--tkv-border,#DCE6DE)] rounded-2xl p-1">
                <span className="pl-2.5 text-xs font-semibold text-[var(--tkv-ink-soft,#3C5954)]">
                  {l('Thay khẩu phần:', 'Servings:')}
                </span>
                <TkvIconButton
                  icon="minus"
                  label={l('Giảm khẩu phần', 'Decrease servings')}
                  onClick={() => updateServings(recipe.servings - 1)}
                  disabled={recipe.servings <= 1}
                />
                <span
                  data-testid="c18-servings-value"
                  className="min-w-[60px] text-center text-sm font-bold tabular-nums text-[var(--tkv-ink,#152E2C)]"
                >
                  {l(
                    `${recipe.servings} người`,
                    `${recipe.servings} ${recipe.servings === 1 ? 'serving' : 'servings'}`,
                  )}
                </span>
                <TkvIconButton
                  icon="plus"
                  label={l('Tăng khẩu phần', 'Increase servings')}
                  onClick={() => updateServings(recipe.servings + 1)}
                  disabled={recipe.servings >= 20}
                />
              </div>
            </div>

            <ul className="space-y-2.5" aria-label={l('Đối chiếu nguyên liệu theo định lượng', 'Ingredient availability by quantity')}>
              {availability.map((ing) => {
                const key = `${ing.ingredientId}:${ing.unit}`;
                const added = addedKeys.includes(key);
                const canAddShortfall =
                  !added && ing.missingQuantity !== null && ing.missingQuantity > 0;
                const displayIngName = localizeIngredientName(ing.ingredientId, ing.name, locale);
                const requiredText = formatQty(ing.requiredQuantity, ing.unit, locale, unitSystem);
                const availableText = formatQty(
                  ing.availableQuantity ?? ing.requiredQuantity,
                  ing.unit,
                  locale,
                  unitSystem,
                );
                const missingText =
                  ing.missingQuantity !== null
                    ? formatQty(ing.missingQuantity, ing.unit, locale, unitSystem)
                    : '';

                return (
                  <li key={`${ing.ingredientId}-${ing.name}`}>
                    <TkvSurface padded={false} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-[var(--tkv-border,#DCE6DE)]">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className={
                            ing.status === 'satisfied'
                              ? 'relative w-10 h-10 rounded-xl bg-[var(--tkv-sage-soft,#E7F4EC)] border border-[var(--tkv-sage-border,#BDE0CC)] text-[var(--tkv-sage,#196149)] flex items-center justify-center shrink-0'
                              : ing.status === 'unresolved'
                                ? 'relative w-10 h-10 rounded-xl bg-[var(--tkv-honey-soft,#FFF5D6)] border border-[var(--tkv-honey-border,#F5DE93)] text-[var(--tkv-honey-ink,#8A5205)] flex items-center justify-center shrink-0'
                                : 'relative w-10 h-10 rounded-xl bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-[var(--tkv-primary,#196149)] flex items-center justify-center shrink-0'
                          }
                        >
                          <VNextIcon
                            name={ing.status === 'satisfied' ? 'check' : ing.status === 'unresolved' ? 'warning' : 'shopping'}
                            size={18}
                          />
                          {ing.status !== 'satisfied' && (
                            <span
                              className={
                                ing.status === 'unresolved'
                                  ? 'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--tkv-honey,#F6C453)]'
                                  : 'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--tkv-primary,#196149)]'
                              }
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-bold text-[var(--tkv-ink,#152E2C)] tabular-nums">
                            {displayIngName} · {requiredText}
                          </p>
                          <p className="text-xs text-[var(--tkv-ink-soft,#3C5954)] tabular-nums">
                            {!inventoryQuery.isSuccess
                              ? l('Đang kiểm tra tồn kho trong tủ lạnh…', 'Checking your fridge inventory…')
                              : ing.status === 'satisfied'
                                ? l(
                                    `Đủ định lượng trong tủ (${availableText})`,
                                    `In fridge (${availableText})`,
                                  )
                                : ing.status === 'unresolved'
                                  ? l(
                                      'Có trong tủ nhưng khác đơn vị đo — cần kiểm tra trực tiếp',
                                      'In fridge with a different unit — check manually',
                                    )
                                  : ing.missingQuantity !== null
                                    ? l(`Cần mua thêm ${missingText}`, `Need ${missingText} more`)
                                    : l('Chưa có trong tủ lạnh', 'Not in fridge yet')}
                          </p>
                        </div>
                      </div>

                      {added ? (
                        <TkvBadge tone="success" icon="check">
                          {l('Đã thêm giỏ mua', 'Added to list')}
                        </TkvBadge>
                      ) : canAddShortfall ? (
                        <TkvButton
                          size="sm"
                          variant="secondary"
                          iconLeft="plus"
                          className="w-full sm:w-auto shrink-0"
                          isLoading={addShortfallMutation.isPending}
                          onClick={() =>
                            addShortfallMutation.mutate({
                              ing,
                              recipeTitle: displayTitle,
                              sourceKey: recipeKey,
                            })
                          }
                        >
                          {l('Mua phần thiếu', 'Add missing')}
                        </TkvButton>
                      ) : (
                        <TkvBadge
                          tone={ing.status === 'satisfied' ? 'success' : 'warning'}
                          icon={ing.status === 'satisfied' ? 'check' : 'info'}
                        >
                          {ing.status === 'satisfied'
                            ? l('Đủ lượng', 'In stock')
                            : l('Kiểm tra tủ', 'Check fridge')}
                        </TkvBadge>
                      )}
                    </TkvSurface>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Step-by-Step Instructions */}
          <section aria-labelledby="c18-steps-heading" className="space-y-3.5">
            <h2 id="c18-steps-heading" className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink,#152E2C)] tabular-nums">
              {l(`Các bước thực hiện (${localizedSteps.length})`, `Cooking steps (${localizedSteps.length})`)}
            </h2>
            <ol className="space-y-3">
              {localizedSteps.map((step, idx) => {
                const rawTip = recipe.steps[idx]?.tip;
                const visibleTip =
                  rawTip && (locale === 'vi' || !containsVietnameseDiacritics(rawTip))
                    ? rawTip
                    : null;
                return (
                  <li key={step.stepNumber}>
                    <TkvSurface className="p-4 sm:p-5 flex items-start gap-3.5 bg-white border-[var(--tkv-border,#DCE6DE)]">
                      <span className="tkv-heading w-9 h-9 rounded-xl bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-[var(--tkv-accent-ink,#B33A22)] font-bold text-xs tabular-nums flex items-center justify-center shrink-0">
                        {String(step.stepNumber).padStart(2, '0')}
                      </span>
                      <div className="space-y-2 min-w-0 flex-1">
                        <p className="text-sm sm:text-base text-[var(--tkv-ink,#152E2C)] leading-relaxed">
                          {step.instruction}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {typeof step.timerMinutes === 'number' && step.timerMinutes > 0 && (
                            <TkvBadge tone="coral" icon="timer">
                              <span className="tabular-nums">
                                {l(
                                  `Hẹn giờ gợi ý: ${step.timerMinutes} phút`,
                                  `Suggested timer: ${step.timerMinutes} min`,
                                )}
                              </span>
                            </TkvBadge>
                          )}
                          {visibleTip && (
                            <span className="text-xs font-medium text-[var(--tkv-honey-ink,#8A5205)] bg-[var(--tkv-honey-soft,#FFF5D6)] border border-[var(--tkv-honey-border,#F5DE93)] px-2.5 py-1 rounded-xl">
                              {l(`Mẹo bếp: ${visibleTip}`, `Chef's tip: ${visibleTip}`)}
                            </span>
                          )}
                        </div>
                      </div>
                    </TkvSurface>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
    </ConsumerStudioShell>
  );
};
