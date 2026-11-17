import { useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useModalFocus } from '../../design-system/use-modal-focus';
import { useWeekStore } from '../../stores/useWeekStore';
import { InlineError, InlineLoading } from '../../components/common/AsyncState';
import {
  resolveRecipeImage,
  resolveRecipeImageV4,
  recipeImageErrorHandler,
} from '../../lib/recipe-media';
import { weekCurrency } from './WeekWorkspace';

export function MealSwapSheet() {
  const {
    swapSlotId,
    swapAlternatives,
    isLoadingAlternatives,
    closeSwap,
    executeSwap,
    currentPlan,
    error,
    openSwap,
    isLoading,
  } = useWeekStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useModalFocus(Boolean(swapSlotId && currentPlan), panelRef, closeSwap, closeRef);
  if (!swapSlotId || !currentPlan) return null;
  const slot = currentPlan.days.flatMap((day) => day.slots).find((item) => item.id === swapSlotId);

  return (
    <div
      className="week-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-xs sm:items-center"
      onClick={closeSwap}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="week-dialog week-swap-dialog flex max-h-[88dvh] w-full flex-col rounded-t-[28px] border border-tk-stone bg-tk-canvas text-tk-ink shadow-elevated sm:max-w-lg sm:rounded-[28px]"
      >
        <div className="week-dialog-heading flex items-start justify-between gap-3 border-b border-tk-stone/80 bg-white/90 p-5">
          <div>
            <p className="week-eyebrow text-xs font-extrabold uppercase tracking-wider text-tk-jade-deep">
              ĐỔI MÓN
            </p>
            <h2 id={titleId} className="mt-1 font-heading text-lg font-extrabold text-tk-ink">
              Thay thế: {slot?.recipe?.title || slot?.notes || 'Bữa này'}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="week-icon-button inline-flex h-10 w-10 items-center justify-center rounded-xl text-tk-muted transition-colors hover:bg-tk-sunken hover:text-tk-ink"
            onClick={closeSwap}
            aria-label="Đóng bảng đổi món"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div
          className="week-dialog-body flex-1 space-y-3 overflow-y-auto p-5"
          aria-busy={isLoadingAlternatives || isLoading}
        >
          <p className="week-muted text-xs leading-relaxed text-tk-secondary">
            Chi phí và mức khớp là ước tính theo kế hoạch. Đổi món chưa làm thay đổi nguyên liệu
            trong tủ.
          </p>
          {error && <InlineError message={error} onRetry={() => openSwap(swapSlotId)} />}
          {isLoadingAlternatives ? (
            <InlineLoading label="Đang tìm món thay thế…" />
          ) : !swapAlternatives.length ? (
            <p
              role="status"
              className="week-note rounded-2xl border border-tk-stone bg-white p-4 text-sm text-tk-secondary"
            >
              Không tìm thấy món thay thế phù hợp với ràng buộc hiện tại.
            </p>
          ) : (
            swapAlternatives.map((alternative) => {
              const baseMedia = resolveRecipeImage(alternative.recipe);
              const v4Media = resolveRecipeImageV4(alternative.recipe);
              const media = baseMedia.source === 'placeholder' ? v4Media : baseMedia;
              return (
                <article
                  key={alternative.recipe.id}
                  className="week-swap-option flex items-center justify-between gap-3 rounded-2xl border border-tk-stone bg-white p-3.5 shadow-xs"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={media.src}
                      alt=""
                      width={72}
                      height={72}
                      loading="lazy"
                      onError={recipeImageErrorHandler(media.fallbackSrc)}
                      className="h-16 w-16 shrink-0 rounded-xl object-cover bg-tk-sunken"
                    />
                    <div className="min-w-0">
                      <h3 className="truncate font-heading text-sm font-extrabold text-tk-ink">
                        {alternative.recipe.title}
                      </h3>
                      <p className="week-muted mt-0.5 text-xs text-tk-secondary">
                        {alternative.recipe.cookTimeMinutes} phút · khớp {alternative.matchPercent}%
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-tk-ink">
                        Chênh lệch mua thêm: {alternative.budgetDeltaVnd > 0 ? '+' : ''}
                        {weekCurrency(alternative.budgetDeltaVnd)}
                      </p>
                      {alternative.badges.length > 0 && (
                        <div className="week-badges mt-1 flex flex-wrap gap-1">
                          {alternative.badges.map((badge) => (
                            <span
                              className="week-badge rounded-full bg-tk-jade-soft px-2 py-0.5 text-[10px] font-bold text-tk-jade-deep"
                              key={badge}
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="week-button shrink-0 rounded-xl bg-tk-flame px-3.5 py-2 text-xs font-extrabold text-white shadow-xs transition-tap hover:bg-tk-flame-hover disabled:opacity-50"
                    disabled={isLoading}
                    onClick={() => executeSwap(alternative.recipe.id)}
                    aria-label={`Chọn món ${alternative.recipe.title}`}
                  >
                    {isLoading ? 'Đang đổi…' : 'Chọn món'}
                  </button>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
