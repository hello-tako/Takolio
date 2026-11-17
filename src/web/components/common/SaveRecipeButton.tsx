import { Heart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { useRecipeFavorites } from '../../features/favorites/useRecipeFavorites';

export function SaveRecipeButton({
  recipeId,
  title,
  compact = false,
  glass = false,
  className,
}: {
  recipeId: string;
  title: string;
  compact?: boolean;
  glass?: boolean;
  className?: string;
}) {
  const { query, mutation, saved, guest, error } = useRecipeFavorites();
  const location = useLocation();

  const baseClasses = clsx(
    'recipe-save-button inline-flex items-center justify-center gap-1.5 transition-tap duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-tk-flame/35 active:scale-92',
    compact
      ? 'h-10 w-10 rounded-full p-0'
      : 'min-h-[42px] rounded-full px-4 py-2 text-xs font-extrabold tracking-tight',
    className,
  );

  if (guest) {
    return (
      <Link
        className={clsx(
          baseClasses,
          glass
            ? 'tk-glass text-tk-ink hover:text-tk-berry'
            : 'border border-tk-stone bg-white text-tk-secondary shadow-xs hover:border-tk-berry/35 hover:bg-tk-berry-soft/50 hover:text-tk-berry',
        )}
        aria-label={`Đăng nhập để lưu ${title}`}
        to={`/auth?mode=login&returnTo=${encodeURIComponent(location.pathname + location.search)}`}
      >
        <Heart size={18} aria-hidden="true" className="transition-transform" />
        {!compact && <span>Lưu món</span>}
      </Link>
    );
  }

  const selected = saved(recipeId);
  return (
    <span className="recipe-save-control inline-flex flex-col items-end gap-1">
      <button
        type="button"
        className={clsx(
          baseClasses,
          selected
            ? 'border border-tk-berry/30 bg-tk-berry-soft text-tk-berry shadow-xs hover:bg-tk-berry-soft/90'
            : glass
              ? 'tk-glass text-tk-ink hover:text-tk-berry'
              : 'border border-tk-stone bg-white text-tk-secondary shadow-xs hover:border-tk-berry/35 hover:bg-tk-berry-soft/40 hover:text-tk-berry',
          (query.isPending || query.isError || mutation.isPending) && 'opacity-55 pointer-events-none',
        )}
        aria-label={`${selected ? 'Bỏ lưu' : 'Lưu'} ${title}`}
        aria-pressed={selected}
        disabled={query.isPending || query.isError || mutation.isPending}
        onClick={() => mutation.mutate({ recipeId, isSaved: !selected })}
      >
        <Heart
          size={18}
          fill={selected ? 'currentColor' : 'none'}
          aria-hidden="true"
          className={clsx('transition-transform duration-200', selected && 'scale-110')}
        />
        {!compact && <span>{selected ? 'Đã lưu' : 'Lưu món'}</span>}
      </button>
      {mutation.isError && (
        <span className="recipe-save-error text-[11px] font-semibold text-tk-berry" role="alert">
          {error}
        </span>
      )}
      {query.isError && !compact && (
        <button
          type="button"
          className="planning-text-link text-xs font-bold text-tk-flame underline underline-offset-2 cursor-pointer"
          onClick={() => void query.refetch()}
        >
          Tải lại món đã lưu
        </button>
      )}
    </span>
  );
}
