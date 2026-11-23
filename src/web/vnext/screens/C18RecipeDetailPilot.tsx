import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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

const UNIT_LABELS_VI: Record<string, string> = {
  piece: 'quả/cái',
  pack: 'gói',
  bunch: 'bó',
  slice: 'lát',
};

function formatQty(quantity: number, unit: string): string {
  const formatted = new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 6 }).format(quantity);
  return `${formatted} ${UNIT_LABELS_VI[unit] ?? unit}`;
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
  const isSafeAppReturn = (candidate: unknown): candidate is string =>
    typeof candidate === 'string' &&
    !candidate.startsWith('//') &&
    (candidate === '/' ||
      candidate.startsWith('/recipes') ||
      candidate.startsWith('/planner') ||
      candidate.startsWith('/fridge'));
  const returnTo = isSafeAppReturn(queryReturnTo)
    ? queryReturnTo
    : isSafeAppReturn(state?.discoveryReturn)
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
    staleTime: 30_000,
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
        throw new Error('Cần kiểm tra đơn vị trước khi thêm tự động vào giỏ đi chợ.');
      }
      return api.addShoppingItem({
        name: ing.name,
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

  const recipeJsonLd = useMemo(() => {
    if (!recipe) return null;
    return buildRecipeJsonLd({
      slug: recipe.slug,
      title: recipe.title,
      description: recipe.description,
      imageUrl: resolveRecipeImage(recipe).src,
      cookMinutes: recipe.cookTimeMinutes,
      servings: recipe.servings,
      calories: recipe.nutrition?.calories ?? null,
      ingredients: recipe.ingredients.map(
        (ing) => `${ing.name} (${formatQty(ing.requiredQuantity, ing.unit)})`,
      ),
      steps: recipe.steps.map((st) => st.instruction),
    });
  }, [recipe]);

  useVNextSeo({
    title: recipe ? `${recipe.title} — Công thức chuẩn định lượng` : 'Chi tiết món ăn',
    description: recipe
      ? recipe.description
      : 'Công thức bữa cơm gia đình Việt đối chiếu định lượng tồn kho tủ lạnh trên Takolio.',
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
      <ConsumerStudioShell screenId="C18" title="Chi tiết món ăn" backTo={returnTo}>
        <RecipeDetailSkeleton />
      </ConsumerStudioShell>
    );
  }

  if (notFound || (!recipeQuery.isError && !recipe)) {
    return (
      <ConsumerStudioShell screenId="C18" title="Chi tiết món ăn" backTo={returnTo}>
        <TkvEmptyState
          pose="error"
          eyebrow="Không tìm thấy món ăn"
          title="Công thức này không tồn tại hoặc đã thay đổi đường dẫn"
          description="Bạn có thể quay lại kho công thức để tìm món ăn khác phù hợp với tủ lạnh."
          primaryAction={
            <TkvButton onClick={() => navigate('/recipes')}>Xem kho công thức</TkvButton>
          }
        />
      </ConsumerStudioShell>
    );
  }

  if (recipeQuery.isError || !recipe) {
    return (
      <ConsumerStudioShell screenId="C18" title="Chi tiết món ăn" backTo={returnTo}>
        <TkvErrorState
          title="Chưa tải được chi tiết món ăn"
          message="Kết nối tới máy chủ công thức gặp gián đoạn. Vui lòng thử lại."
          onRetry={() => void recipeQuery.refetch()}
        />
      </ConsumerStudioShell>
    );
  }

  const availability = evaluateRecipeAvailability(recipe, inventory);
  const difficultyLabel = formatDifficultyLabel(recipe.difficulty).label;
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
    if (returnTo && returnTo !== '/recipes') {
      cookParams.set('returnTo', returnTo);
    }
    navigate(`/cook/${recipe.slug}?${cookParams.toString()}`);
  };

  return (
    <ConsumerStudioShell screenId="C18" title="Chi tiết món ăn" backTo={returnTo}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left Media & Facts Column (5 cols on Desktop; Top Hero on Mobile) */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
          <div className="rounded-[24px] overflow-hidden bg-[var(--tkv-surface)] border border-[var(--tkv-border)] shadow-xs">
            <VerifiedDishImage
              recipeId={recipe.id}
              slug={recipe.slug}
              title={recipe.title}
              canonicalFallbackSrc={canonicalImg}
              aspectClass="aspect-[4/3]"
              priority
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)] leading-tight">
                {recipe.title}
              </h1>
              <SaveRecipeButton recipeId={recipe.id} title={recipe.title} compact />
            </div>

            {/* Calm Brand Board v2 Metadata Pills */}
            <div className="flex items-center gap-2 flex-wrap tabular-nums">
              <span className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-[var(--tkv-surface)] border border-[var(--tkv-border)] text-[var(--tkv-ink)] text-xs sm:text-sm font-bold inline-flex items-center gap-1.5">
                <VNextIcon name="timer" size={14} className="text-[var(--tkv-primary)]" />
                {recipe.cookTimeMinutes} phút
              </span>
              <span className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-[var(--tkv-surface)] border border-[var(--tkv-border)] text-[var(--tkv-ink)] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5">
                <VNextIcon name="users" size={14} className="text-[var(--tkv-primary)]" />
                {recipe.servings} người
              </span>
              <span className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-[var(--tkv-primary)] text-xs sm:text-sm font-bold inline-flex items-center">
                {difficultyLabel}
              </span>
            </div>

            <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
              {recipe.description}
            </p>

            <div className="pt-1 flex flex-col gap-2.5">
              <TkvButton
                variant="primary"
                size="lg"
                fullWidth
                iconRight="arrow-right"
                onClick={handleStartCooking}
                data-testid="c18-start-cooking-btn"
              >
                Bắt đầu nấu ({recipe.steps.length} bước)
              </TkvButton>
              <Link
                to={`/planner/new?recipe=${encodeURIComponent(recipe.id)}&servings=${recipe.servings}`}
                data-testid="c18-add-to-planner-link"
                className="tkv-focusable w-full min-h-[44px] px-4 py-2 rounded-full bg-[var(--tkv-surface)] border border-[var(--tkv-border-strong)] hover:border-[var(--tkv-primary)] hover:bg-[var(--tkv-surface-mint)]/40 text-sm font-extrabold text-[var(--tkv-primary)] inline-flex items-center justify-center gap-2 transition-colors"
              >
                <VNextIcon name="calendar" size={16} />
                <span>Xếp vào thực đơn tuần</span>
              </Link>
            </div>
          </div>

          {/* Sourced Nutrition Card — strictly honest when null */}
          <TkvSurface className="p-4 space-y-2.5 bg-white border-[var(--tkv-border,#DCE6DE)]">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <h2 className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink,#152E2C)]">
                Thông tin dinh dưỡng / khẩu phần
              </h2>
              <span className="text-xs text-[var(--tkv-ink-muted,#52706A)] shrink-0">Nguồn công thức</span>
            </div>
            {recipe.nutrition ? (
              <div className="grid grid-cols-2 min-[400px]:grid-cols-4 gap-2 text-center tabular-nums">
                <div className="p-2 rounded-xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)]">
                  <p className="text-sm font-extrabold text-[var(--tkv-ink,#152E2C)]">{recipe.nutrition.calories}</p>
                  <p className="text-[11px] text-[var(--tkv-ink-muted,#52706A)]">kcal</p>
                </div>
                <div className="p-2 rounded-xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)]">
                  <p className="text-sm font-extrabold text-[var(--tkv-ink,#152E2C)]">{recipe.nutrition.proteinG}g</p>
                  <p className="text-[11px] text-[var(--tkv-ink-muted,#52706A)]">Đạm</p>
                </div>
                <div className="p-2 rounded-xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)]">
                  <p className="text-sm font-extrabold text-[var(--tkv-ink,#152E2C)]">{recipe.nutrition.carbG}g</p>
                  <p className="text-[11px] text-[var(--tkv-ink-muted,#52706A)]">Tinh bột</p>
                </div>
                <div className="p-2 rounded-xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)]">
                  <p className="text-sm font-extrabold text-[var(--tkv-ink,#152E2C)]">{recipe.nutrition.fatG}g</p>
                  <p className="text-[11px] text-[var(--tkv-ink-muted,#52706A)]">Chất béo</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--tkv-ink-muted,#52706A)]">
                Chưa có thông tin dinh dưỡng đã xác minh cho món ăn này.
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
                Nguyên liệu chính ({availability.length})
              </h2>

              <div className="inline-flex items-center gap-2 bg-white border border-[var(--tkv-border,#DCE6DE)] rounded-2xl p-1">
                <span className="pl-2.5 text-xs font-semibold text-[var(--tkv-ink-soft,#3C5954)]">
                  Thay khẩu phần:
                </span>
                <TkvIconButton
                  icon="minus"
                  label="Giảm khẩu phần"
                  onClick={() => updateServings(recipe.servings - 1)}
                  disabled={recipe.servings <= 1}
                />
                <span
                  data-testid="c18-servings-value"
                  className="min-w-[60px] text-center text-sm font-bold tabular-nums text-[var(--tkv-ink,#152E2C)]"
                >
                  {recipe.servings} người
                </span>
                <TkvIconButton
                  icon="plus"
                  label="Tăng khẩu phần"
                  onClick={() => updateServings(recipe.servings + 1)}
                  disabled={recipe.servings >= 20}
                />
              </div>
            </div>

            {addedKeys.length > 0 && (
              <div className="rounded-2xl bg-[var(--tkv-surface-mint)]/60 border border-[var(--tkv-border-mint)] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs font-bold text-[var(--tkv-primary)]">
                <span>Đã thêm {addedKeys.length} nguyên liệu thiếu vào danh sách mua sắm</span>
                <Link to="/shopping" className="underline shrink-0">
                  Mở giỏ đi chợ →
                </Link>
              </div>
            )}

            <ul className="space-y-2.5" aria-label="Đối chiếu nguyên liệu theo định lượng">
              {availability.map((ing) => {
                const key = `${ing.ingredientId}:${ing.unit}`;
                const added = addedKeys.includes(key);
                const canAddShortfall =
                  !added && ing.missingQuantity !== null && ing.missingQuantity > 0;

                return (
                  <li key={`${ing.ingredientId}-${ing.name}`}>
                    <TkvSurface padded={false} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-[var(--tkv-border)]">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className={
                            ing.status === 'satisfied'
                              ? 'w-10 h-10 rounded-xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0'
                              : ing.status === 'unresolved'
                                ? 'w-10 h-10 rounded-xl bg-[var(--tkv-bg)] border border-[var(--tkv-border-saffron)] text-[var(--tkv-warning-ink)] flex items-center justify-center shrink-0'
                                : 'w-10 h-10 rounded-xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] text-[var(--tkv-ink-secondary)] flex items-center justify-center shrink-0'
                          }
                        >
                          <VNextIcon
                            name={ing.status === 'satisfied' ? 'check' : ing.status === 'unresolved' ? 'warning' : 'shopping'}
                            size={18}
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-bold text-[var(--tkv-ink,#152E2C)] tabular-nums">
                            {ing.name} · {formatQty(ing.requiredQuantity, ing.unit)}
                          </p>
                          <p className="text-xs text-[var(--tkv-ink-soft,#3C5954)] tabular-nums">
                            {!inventoryQuery.isSuccess
                              ? 'Đang kiểm tra tồn kho trong tủ lạnh…'
                              : ing.status === 'satisfied'
                                ? `Đủ định lượng trong tủ (${formatQty(ing.availableQuantity ?? ing.requiredQuantity, ing.unit)})`
                                : ing.status === 'unresolved'
                                  ? 'Có trong tủ nhưng khác đơn vị đo — cần kiểm tra trực tiếp'
                                  : ing.missingQuantity !== null
                                    ? `Cần mua thêm ${formatQty(ing.missingQuantity, ing.unit)}`
                                    : 'Chưa có trong tủ lạnh'}
                          </p>
                        </div>
                      </div>

                      {added ? (
                        <TkvBadge tone="success" icon="check">
                          Đã thêm giỏ mua
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
                              recipeTitle: recipe.title,
                              sourceKey: recipeKey,
                            })
                          }
                        >
                          Mua phần thiếu
                        </TkvButton>
                      ) : (
                        <TkvBadge
                          tone={ing.status === 'satisfied' ? 'success' : 'warning'}
                          icon={ing.status === 'satisfied' ? 'check' : 'info'}
                        >
                          {ing.status === 'satisfied' ? 'Đủ lượng' : 'Kiểm tra tủ'}
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
              Các bước thực hiện ({recipe.steps.length})
            </h2>
            <ol className="space-y-3">
              {recipe.steps.map((step) => (
                <li key={step.stepNumber}>
                  <TkvSurface className="p-4 sm:p-5 flex items-start gap-3.5 bg-white border-[var(--tkv-border)]">
                    <span className="tkv-heading w-8 h-8 rounded-xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-[var(--tkv-primary)] font-extrabold text-xs tabular-nums flex items-center justify-center shrink-0">
                      {String(step.stepNumber).padStart(2, '0')}
                    </span>
                    <div className="space-y-2 min-w-0 flex-1">
                      <p className="text-sm sm:text-base text-[var(--tkv-ink)] leading-relaxed">
                        {step.instruction}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {typeof step.timerMinutes === 'number' && step.timerMinutes > 0 && (
                          <TkvBadge tone="neutral" icon="timer">
                            <span className="tabular-nums">Hẹn giờ gợi ý: {step.timerMinutes} phút</span>
                          </TkvBadge>
                        )}
                        {step.tip && (
                          <span className="text-xs font-medium text-[var(--tkv-ink-secondary)] bg-[var(--tkv-bg)] border border-[var(--tkv-border)] px-2.5 py-1 rounded-xl">
                            Mẹo bếp: {step.tip}
                          </span>
                        )}
                      </div>
                    </div>
                  </TkvSurface>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </ConsumerStudioShell>
  );
};
