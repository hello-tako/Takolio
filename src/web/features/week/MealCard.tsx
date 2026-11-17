import type { MouseEvent } from 'react';
import type { MealSlotItem } from '@frigo/domain';
import { Link } from 'react-router-dom';
import { ArrowRightLeft } from 'lucide-react';
import {
  resolveRecipeImage,
  resolveRecipeImageV4,
  recipeImageErrorHandler,
} from '../../lib/recipe-media';
import { weekCurrency } from './WeekWorkspace';

export function MealCard({
  slot,
  to,
  onSwapClick,
}: {
  slot: MealSlotItem;
  to: string;
  onSwapClick: (event: MouseEvent) => void;
}) {
  const recipe = slot.recipe;
  if (
    !recipe ||
    slot.status === 'EATING_OUT' ||
    slot.status === 'FLEXIBLE' ||
    slot.status === 'SKIPPED'
  ) {
    const title = {
      EATING_OUT: 'Bữa ăn ngoài',
      FLEXIBLE: 'Bữa linh hoạt',
      SKIPPED: 'Bỏ qua bữa này',
      LEFTOVER: 'Dùng món còn lại',
      PLANNED: 'Chưa có món',
      COOKED: 'Bữa đã nấu',
    }[slot.status];
    return (
      <article className="week-meal-card rounded-2xl border border-dashed border-tk-stone bg-tk-sunken/70 p-4 space-y-2">
        <h4 className="font-heading text-sm font-extrabold text-tk-ink">{title}</h4>
        <p className="week-muted text-xs text-tk-secondary">
          {slot.notes || 'Bữa này chưa có công thức để chuẩn bị.'}
        </p>
        {slot.status !== 'SKIPPED' && slot.status !== 'COOKED' && (
          <button
            type="button"
            className="week-button week-button-secondary inline-flex min-h-9 items-center justify-center rounded-xl border border-tk-stone bg-white px-3 py-1.5 text-xs font-bold text-tk-ink transition-colors hover:bg-tk-canvas"
            onClick={onSwapClick}
          >
            Chọn món khác
          </button>
        )}
      </article>
    );
  }

  const baseMedia = resolveRecipeImage(recipe);
  const v4Media = resolveRecipeImageV4(recipe);
  const media = baseMedia.source === 'placeholder' ? v4Media : baseMedia;

  return (
    <article className="week-meal-card overflow-hidden rounded-2xl border border-tk-stone/85 bg-white shadow-xs transition-colors hover:border-tk-jade/35">
      <img
        src={media.src}
        alt=""
        width={320}
        height={180}
        loading="lazy"
        onError={recipeImageErrorHandler(media.fallbackSrc)}
        className="h-36 w-full object-cover bg-tk-sunken"
      />
      <div className="week-meal-copy space-y-2 p-3.5">
        {slot.status === 'COOKED' && (
          <p className="week-badge inline-flex rounded-full bg-tk-jade-soft px-2.5 py-0.5 text-[11px] font-bold text-tk-jade-deep">
            Đã nấu
          </p>
        )}
        <h4 className="font-heading text-base font-extrabold leading-snug text-tk-ink">
          <Link className="week-meal-title hover:text-tk-jade-deep" to={to}>
            {recipe.title}
          </Link>
        </h4>
        <p className="week-muted text-xs font-semibold text-tk-secondary">
          {recipe.cookTimeMinutes} phút · {slot.servings} phần ăn
        </p>
        {slot.badges.length > 0 && (
          <div className="week-badges flex flex-wrap gap-1.5">
            {slot.badges.map((badge) => (
              <span
                className="week-badge rounded-full border border-tk-jade/20 bg-tk-jade-soft px-2 py-0.5 text-[11px] font-bold text-tk-jade-deep"
                key={badge}
              >
                {badge}
              </span>
            ))}
          </div>
        )}
        <p className="week-muted text-xs text-tk-secondary">
          Theo kế hoạch: có sẵn {slot.availabilityPercent}% · mua thêm ~
          {weekCurrency(slot.incrementalCostVnd)}
        </p>
        {slot.status !== 'COOKED' && (
          <button
            type="button"
            className="week-button week-button-secondary inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-tk-stone bg-tk-canvas px-3 py-1.5 text-xs font-bold text-tk-ink transition-colors hover:bg-tk-sunken"
            onClick={onSwapClick}
            aria-label={`Đổi món ${recipe.title}`}
          >
            <ArrowRightLeft size={15} aria-hidden="true" />
            Đổi món
          </button>
        )}
      </div>
    </article>
  );
}
