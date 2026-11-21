import React, { useState } from 'react';
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
  TkvSkeleton,
  TkvSurface,
} from '../components/Primitives';
import { VNextIcon } from '../components/VNextIcons';
import { VerifiedDishImage } from '../components/VNextMedia';

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

  const updateServings = (nextServings: number) => {
    const clamped = Math.max(1, Math.min(20, nextServings));
    const next = new URLSearchParams(params);
    next.set('servings', String(clamped));
    setParams(next, { replace: true });
  };

  if (recipeQuery.isPending) {
    return (
      <ConsumerStudioShell screenId="C18" title="Chi tiết món ăn" backTo={returnTo}>
        <div className="space-y-4">
          <TkvSkeleton className="h-64" label="Đang tải công thức món ăn…" />
          <TkvSkeleton className="h-24" label="Đang tải danh sách nguyên liệu…" />
          <TkvSkeleton className="h-36" label="Đang tải các bước nấu…" />
        </div>
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
    navigate(`/cook/${recipe.slug}?${cookParams.toString()}`);
  };

  return (
    <ConsumerStudioShell screenId="C18" title="Chi tiết món ăn" backTo={returnTo}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left Media & Facts Column (5 cols on Desktop; Top Hero on Mobile) */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
          <div className="rounded-[24px] bg-[var(--tkv-surface-muted,#F7EFE6)] p-2.5 border border-[var(--tkv-border,#EAE0D5)] shadow-xs">
            <VerifiedDishImage
              slug={recipe.slug}
              title={recipe.title}
              canonicalFallbackSrc={canonicalImg}
              aspectClass="aspect-[4/3]"
              priority
              className="rounded-[18px]"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#2C221E)] leading-tight">
                {recipe.title}
              </h1>
              <SaveRecipeButton recipeId={recipe.id} title={recipe.title} compact />
            </div>

            {/* 3 Sunlit Ceramic Metadata Pills */}
            <div className="flex items-center gap-2 flex-wrap tabular-nums">
              <span className="min-h-[38px] px-4 py-1.5 rounded-full bg-[var(--tkv-accent-soft,#FDF0EA)] border border-[var(--tkv-accent-border,#F2D5C7)] text-[var(--tkv-accent-ink,#9E4322)] text-sm font-bold inline-flex items-center gap-1.5">
                <VNextIcon name="timer" size={15} className="text-[var(--tkv-primary,#D86A43)]" />
                {recipe.cookTimeMinutes} phút
              </span>
              <span className="min-h-[38px] px-4 py-1.5 rounded-full bg-white border border-[var(--tkv-border,#EAE0D5)] text-[var(--tkv-ink,#2C221E)] text-sm font-semibold inline-flex items-center gap-1.5">
                <VNextIcon name="users" size={15} className="text-[var(--tkv-sage,#4E7A5B)]" />
                {recipe.servings} người
              </span>
              <span className="min-h-[38px] px-4 py-1.5 rounded-full bg-[var(--tkv-sage-soft,#EEF5F0)] border border-[var(--tkv-sage-border,#CFE2D5)] text-[var(--tkv-sage-ink,#355940)] text-sm font-semibold inline-flex items-center">
                {difficultyLabel}
              </span>
            </div>

            <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#5F524A)] leading-relaxed">
              {recipe.description}
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
                Bắt đầu nấu ({recipe.steps.length} bước)
              </TkvButton>
            </div>
          </div>

          {/* Sourced Nutrition Card — strictly honest when null */}
          <TkvSurface className="p-4 space-y-2.5 bg-white border-[var(--tkv-border,#EAE0D5)]">
            <div className="flex items-center justify-between">
              <h2 className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink,#2C221E)]">
                Thông tin dinh dưỡng / khẩu phần
              </h2>
              <span className="text-xs text-[var(--tkv-ink-muted,#87776E)]">Nguồn công thức</span>
            </div>
            {recipe.nutrition ? (
              <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
                <div className="p-2 rounded-xl bg-[var(--tkv-bg,#FCF9F5)] border border-[var(--tkv-border,#EAE0D5)]">
                  <p className="text-sm font-extrabold text-[var(--tkv-ink,#2C221E)]">{recipe.nutrition.calories}</p>
                  <p className="text-[11px] text-[var(--tkv-ink-muted,#87776E)]">kcal</p>
                </div>
                <div className="p-2 rounded-xl bg-[var(--tkv-bg,#FCF9F5)] border border-[var(--tkv-border,#EAE0D5)]">
                  <p className="text-sm font-extrabold text-[var(--tkv-ink,#2C221E)]">{recipe.nutrition.proteinG}g</p>
                  <p className="text-[11px] text-[var(--tkv-ink-muted,#87776E)]">Đạm</p>
                </div>
                <div className="p-2 rounded-xl bg-[var(--tkv-bg,#FCF9F5)] border border-[var(--tkv-border,#EAE0D5)]">
                  <p className="text-sm font-extrabold text-[var(--tkv-ink,#2C221E)]">{recipe.nutrition.carbG}g</p>
                  <p className="text-[11px] text-[var(--tkv-ink-muted,#87776E)]">Tinh bột</p>
                </div>
                <div className="p-2 rounded-xl bg-[var(--tkv-bg,#FCF9F5)] border border-[var(--tkv-border,#EAE0D5)]">
                  <p className="text-sm font-extrabold text-[var(--tkv-ink,#2C221E)]">{recipe.nutrition.fatG}g</p>
                  <p className="text-[11px] text-[var(--tkv-ink-muted,#87776E)]">Chất béo</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--tkv-ink-muted,#87776E)]">
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
              <h2 id="c18-ingredients-heading" className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink,#2C221E)] tabular-nums">
                Nguyên liệu chính ({availability.length})
              </h2>

              <div className="inline-flex items-center gap-2 bg-white border border-[var(--tkv-border,#EAE0D5)] rounded-2xl p-1">
                <span className="pl-2.5 text-xs font-semibold text-[var(--tkv-ink-soft,#5F524A)]">
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
                  className="min-w-[60px] text-center text-sm font-bold tabular-nums text-[var(--tkv-ink,#2C221E)]"
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

            <ul className="space-y-2.5" aria-label="Đối chiếu nguyên liệu theo định lượng">
              {availability.map((ing) => {
                const key = `${ing.ingredientId}:${ing.unit}`;
                const added = addedKeys.includes(key);
                const canAddShortfall =
                  !added && ing.missingQuantity !== null && ing.missingQuantity > 0;

                return (
                  <li key={`${ing.ingredientId}-${ing.name}`}>
                    <TkvSurface padded={false} className="p-4 flex items-center justify-between gap-3 flex-wrap bg-white border-[var(--tkv-border,#EAE0D5)]">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className={
                            ing.status === 'satisfied'
                              ? 'relative w-10 h-10 rounded-xl bg-[var(--tkv-sage-soft,#EEF5F0)] border border-[var(--tkv-sage-border,#CFE2D5)] text-[var(--tkv-sage,#4E7A5B)] flex items-center justify-center shrink-0'
                              : ing.status === 'unresolved'
                                ? 'relative w-10 h-10 rounded-xl bg-[var(--tkv-honey-soft,#FCF5E6)] border border-[var(--tkv-honey-border,#EDD9B4)] text-[var(--tkv-honey-ink,#8C5B18)] flex items-center justify-center shrink-0'
                                : 'relative w-10 h-10 rounded-xl bg-[var(--tkv-accent-soft,#FDF0EA)] border border-[var(--tkv-accent-border,#F2D5C7)] text-[var(--tkv-primary,#D86A43)] flex items-center justify-center shrink-0'
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
                                  ? 'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--tkv-honey,#C68634)]'
                                  : 'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--tkv-primary,#D86A43)]'
                              }
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-bold text-[var(--tkv-ink,#2C221E)] tabular-nums">
                            {ing.name} · {formatQty(ing.requiredQuantity, ing.unit)}
                          </p>
                          <p className="text-xs text-[var(--tkv-ink-soft,#5F524A)] tabular-nums">
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
            <h2 id="c18-steps-heading" className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink,#2C221E)] tabular-nums">
              Các bước thực hiện ({recipe.steps.length})
            </h2>
            <ol className="space-y-3">
              {recipe.steps.map((step) => (
                <li key={step.stepNumber}>
                  <TkvSurface className="p-4 sm:p-5 flex items-start gap-3.5 bg-white border-[var(--tkv-border,#EAE0D5)]">
                    <span className="tkv-heading w-9 h-9 rounded-xl bg-[var(--tkv-accent-soft,#FDF0EA)] border border-[var(--tkv-accent-border,#F2D5C7)] text-[var(--tkv-accent-ink,#9E4322)] font-bold text-xs font-mono tabular-nums flex items-center justify-center shrink-0">
                      {String(step.stepNumber).padStart(2, '0')}
                    </span>
                    <div className="space-y-2 min-w-0 flex-1">
                      <p className="text-sm sm:text-base text-[var(--tkv-ink,#2C221E)] leading-relaxed">
                        {step.instruction}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {typeof step.timerMinutes === 'number' && step.timerMinutes > 0 && (
                          <TkvBadge tone="coral" icon="timer">
                            <span className="tabular-nums">Hẹn giờ gợi ý: {step.timerMinutes} phút</span>
                          </TkvBadge>
                        )}
                        {step.tip && (
                          <span className="text-xs font-medium text-[var(--tkv-honey-ink,#8C5B18)] bg-[var(--tkv-honey-soft,#FCF5E6)] border border-[var(--tkv-honey-border,#EDD9B4)] px-2.5 py-1 rounded-xl">
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
