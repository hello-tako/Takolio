import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowRightLeft } from 'lucide-react';
import { useWeekStore } from '../stores/useWeekStore';
import { WeekWorkspace, weekCurrency, mealLabels } from '../features/week/WeekWorkspace';
import { InlineError, InlineLoading } from '../components/common/AsyncState';
import { MealSwapSheet } from '../features/week/MealSwapSheet';
import { BentoCard } from '../design-system/v4/AtelierPrimitives';
import { ExpiryRescueBellIcon, WokFlameIcon } from '../design-system/icons';
import { getIngredientImage } from '../lib/ingredient-images';
import { queryKeys } from '../lib/queryKeys';
import { api } from '../services/api';
import {
  resolveRecipeImage,
  resolveRecipeImageV4,
  recipeImageErrorHandler,
} from '../lib/recipe-media';

export function MealDetailPage() {
  const { planId, mealId } = useParams<{ planId: string; mealId: string }>();
  const { openSwap, error: workflowError } = useWeekStore();
  const [activeTab, setActiveTab] = useState<'ingredients' | 'steps' | 'nutrition'>('ingredients');
  const planQuery = useQuery({
    queryKey: queryKeys.weekPlan(planId || ''),
    queryFn: () => api.getWeekPlan(planId!),
    enabled: Boolean(planId),
  });
  const currentPlan = planQuery.data ?? null;

  useEffect(() => {
    if (currentPlan) useWeekStore.setState({ currentPlan });
  }, [currentPlan]);

  const day = currentPlan?.days.find((entry) => entry.slots.some((slot) => slot.id === mealId));
  const slot = day?.slots.find((entry) => entry.id === mealId);
  const recipe = slot?.recipe;
  const baseMedia = recipe ? resolveRecipeImage(recipe) : null;
  const v4Media = recipe ? resolveRecipeImageV4(recipe) : null;
  const media =
    baseMedia && v4Media
      ? baseMedia.source === 'placeholder'
        ? v4Media
        : baseMedia
      : baseMedia;
  const backTo = planId ? `/week/${planId}` : '/week';

  return (
    <WeekWorkspace
      title={recipe?.title || 'Chi tiết món ăn'}
      backTo={backTo}
      description={
        day && slot
          ? `${day.dayNameVi} · ${mealLabels[slot.slotType]} · ${slot.servings} phần ăn`
          : 'Món ăn trong thực đơn tuần của bạn.'
      }
    >
      {planQuery.isError ? (
        <InlineError error={planQuery.error} onRetry={() => planQuery.refetch()} />
      ) : planQuery.isPending ? (
        <InlineLoading label="Đang tải món trong thực đơn…" />
      ) : !recipe || !slot || !media ? (
        <BentoCard tone="sunken" padding="md" className="week-paper space-y-2">
          <p role="status" className="text-sm font-semibold text-tk-ink">
            Không tìm thấy thông tin món ăn này.
          </p>
          <Link
            to={backTo}
            className="week-text-link inline-flex min-h-11 items-center text-sm font-extrabold text-tk-jade-deep underline"
          >
            Về thực đơn tuần
          </Link>
        </BentoCard>
      ) : (
        <>
          {workflowError && <InlineError message={workflowError} />}

          <div className="week-meal-overview grid gap-5 lg:grid-cols-12">
            <div className="overflow-hidden rounded-[26px] border border-tk-stone bg-tk-sunken shadow-card lg:col-span-6">
              <img
                className="week-recipe-cover h-64 w-full object-cover sm:h-80"
                src={media.src}
                alt={recipe.title}
                width={720}
                height={480}
                onError={recipeImageErrorHandler(media.fallbackSrc)}
              />
            </div>

            <BentoCard
              tone="ceramic"
              padding="md"
              className="week-paper week-recipe-facts flex flex-col justify-between space-y-4 lg:col-span-6"
            >
              <div className="space-y-3">
                <h2 className="font-heading text-xl font-extrabold text-tk-ink">
                  Chuẩn bị bữa ăn
                </h2>
                <dl className="grid grid-cols-3 gap-2.5 rounded-2xl border border-tk-stone/80 bg-tk-sunken/70 p-3.5 text-center">
                  <div>
                    <dt className="text-[11px] font-bold text-tk-muted">Thời gian theo công thức</dt>
                    <dd className="mt-1 text-sm font-extrabold text-tk-ink tk-tabular">
                      {recipe.cookTimeMinutes} phút
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold text-tk-muted">Theo kế hoạch · có sẵn</dt>
                    <dd className="mt-1 text-sm font-extrabold text-tk-jade-deep tk-tabular">
                      {slot.availabilityPercent}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold text-tk-muted">Mua thêm · ước tính</dt>
                    <dd className="mt-1 text-sm font-extrabold text-tk-flame-deep tk-tabular">
                      ~{weekCurrency(slot.incrementalCostVnd)}
                    </dd>
                  </div>
                </dl>
                <p className="week-muted text-xs leading-relaxed text-tk-secondary">
                  Kiểm tra lại số lượng và hạn dùng thực tế trước khi nấu. Chi phí dự kiến có thể
                  thiếu dữ liệu giá.
                </p>
              </div>

              <div className="week-actions flex flex-wrap gap-3">
                <button
                  type="button"
                  className="week-button week-button-secondary inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-tk-stone bg-white px-4 py-2.5 text-sm font-bold text-tk-ink transition-colors hover:bg-tk-sunken"
                  onClick={() => openSwap(mealId!)}
                >
                  <ArrowRightLeft size={17} aria-hidden="true" />
                  Đổi món
                </button>
                <Link
                  to={`/cook/${recipe.slug}`}
                  className="week-button inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-tk-flame px-5 py-2.5 text-sm font-extrabold text-white shadow-float transition-tap hover:bg-tk-flame-hover"
                >
                  <WokFlameIcon size={18} tone="flame" active />
                  Bắt đầu nấu
                </Link>
              </div>
            </BentoCard>
          </div>

          {slot.rescuedExpiringIngredients.length > 0 && (
            <aside className="week-note rounded-[24px] border border-tk-turmeric/30 bg-tk-turmeric-soft/75 p-4 space-y-1">
              <h2 className="flex items-center gap-2 font-heading text-sm font-extrabold text-tk-turmeric-deep">
                <ExpiryRescueBellIcon size={16} tone="turmeric" />
                Ưu tiên nguyên liệu sắp hết hạn
              </h2>
              <p className="text-sm font-bold text-tk-ink">
                {slot.rescuedExpiringIngredients.join(', ')}
              </p>
              <p className="week-muted text-xs text-tk-secondary">
                Được xếp vào kế hoạch; chưa phải nguyên liệu đã sử dụng.
              </p>
            </aside>
          )}

          <div
            className="week-tabs inline-flex flex-wrap gap-1.5 rounded-2xl border border-tk-stone/80 bg-tk-sunken p-1.5"
            role="group"
            aria-label="Nội dung công thức"
          >
            {(
              [
                { id: 'ingredients', label: 'Nguyên liệu' },
                { id: 'steps', label: 'Cách nấu' },
                { id: 'nutrition', label: 'Dinh dưỡng' },
              ] as const
            ).map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={`week-button week-button-secondary min-h-10 rounded-xl px-4 py-2 text-xs font-extrabold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-tk-ink shadow-xs'
                    : 'text-tk-secondary hover:text-tk-ink'
                }`}
                aria-pressed={activeTab === tab.id}
                aria-controls="week-recipe-content"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <BentoCard
            id="week-recipe-content"
            tone="ceramic"
            padding="md"
            className="week-paper week-recipe-content"
            aria-live="polite"
          >
            {activeTab === 'ingredients' && (
              <>
                <h2 className="font-heading text-lg font-extrabold text-tk-ink">
                  Nguyên liệu ({slot.ingredients.length})
                </h2>
                <p className="week-muted mt-1 text-xs text-tk-secondary">
                  Số lượng dự kiến cho {slot.servings} phần ăn, theo dữ liệu của thực đơn.
                </p>
                <ul className="week-ingredient-list mt-4 divide-y divide-tk-stone/70">
                  {slot.ingredients.map((ingredient) => (
                    <li
                      key={ingredient.ingredientId}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <img
                          src={getIngredientImage(ingredient.ingredientId, ingredient.name)}
                          alt=""
                          width={44}
                          height={44}
                          loading="lazy"
                          className="h-11 w-11 shrink-0 rounded-xl border border-tk-stone/70 bg-tk-sunken object-cover"
                        />
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-extrabold text-tk-ink">
                            {ingredient.name}
                          </h3>
                          <p className="text-xs text-tk-secondary">
                            Cần {ingredient.requiredQuantity} {ingredient.unit} · dự kiến có{' '}
                            {ingredient.availableQuantity} {ingredient.unit}
                          </p>
                        </div>
                      </div>
                      <p
                        className={`week-badge shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          ingredient.missingQuantity > 0
                            ? 'bg-tk-flame-soft text-tk-flame-deep'
                            : 'bg-tk-jade-soft text-tk-jade-deep'
                        }`}
                      >
                        {ingredient.missingQuantity > 0
                          ? `Cần mua ${ingredient.missingQuantity} ${ingredient.unit}`
                          : 'Dự kiến đủ'}
                      </p>
                    </li>
                  ))}
                </ul>
                {!slot.ingredients.length && (
                  <p className="week-note mt-3 text-sm text-tk-muted">
                    Chưa có dữ liệu nguyên liệu trong bữa này.
                  </p>
                )}
              </>
            )}

            {activeTab === 'steps' && (
              <>
                <h2 className="font-heading text-lg font-extrabold text-tk-ink">
                  Các bước chế biến
                </h2>
                {recipe.steps?.length ? (
                  <ol className="week-recipe-steps mt-4 space-y-4">
                    {recipe.steps.map((step, index) => (
                      <li key={index} className="flex items-start gap-3.5">
                        <span
                          className="week-step-number flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-tk-flame-soft text-xs font-extrabold text-tk-flame-deep tk-tabular"
                          aria-hidden="true"
                        >
                          {index + 1}
                        </span>
                        <div className="space-y-1">
                          <h3 className="text-sm font-extrabold text-tk-ink">{`Bước ${index + 1}`}</h3>
                          <p className="text-sm leading-relaxed text-tk-secondary">
                            {step.instruction}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="week-note mt-3 text-sm text-tk-muted">
                    Chưa có hướng dẫn chế biến cho công thức này.
                  </p>
                )}
              </>
            )}

            {activeTab === 'nutrition' && (
              <>
                <h2 className="font-heading text-lg font-extrabold text-tk-ink">
                  Dinh dưỡng theo công thức · mỗi phần
                </h2>
                <p className="week-muted mt-1 text-xs leading-relaxed text-tk-secondary">
                  Số liệu tham khảo của công thức, có thể khác nguyên liệu thực tế. Dấu — là chưa có
                  dữ liệu, không phải bằng 0.
                </p>
                <dl className="week-nutrition mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['Năng lượng', recipe.nutrition?.calories, 'kcal'],
                    ['Đạm', recipe.nutrition?.proteinG, 'g'],
                    ['Chất béo', recipe.nutrition?.fatG, 'g'],
                    ['Tinh bột', recipe.nutrition?.carbG, 'g'],
                  ].map(([label, value, unit]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-tk-stone bg-tk-sunken/70 p-3.5 text-center"
                    >
                      <dt className="text-xs font-bold text-tk-muted">{label}</dt>
                      <dd className="mt-1 font-heading text-lg font-extrabold text-tk-ink tk-tabular">
                        {value ?? '—'} <span className="text-xs font-semibold">{unit}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </BentoCard>
          <MealSwapSheet />
        </>
      )}
    </WeekWorkspace>
  );
}
