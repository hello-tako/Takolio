import { Heart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useRecipeFavorites } from '../../features/favorites/useRecipeFavorites';

export function SaveRecipeButton({
  recipeId,
  title,
  compact = false,
}: {
  recipeId: string;
  title: string;
  compact?: boolean;
}) {
  const { query, mutation, saved, guest, error } = useRecipeFavorites();
  const location = useLocation();
  if (guest)
    return (
      <Link
        className="recipe-save-button"
        aria-label={`Đăng nhập để lưu ${title}`}
        to={`/auth?mode=login&returnTo=${encodeURIComponent(location.pathname + location.search)}`}
      >
        <Heart size={18} aria-hidden="true" />
        {!compact && 'Lưu món'}
      </Link>
    );
  const selected = saved(recipeId);
  return (
    <span className="recipe-save-control">
      <button
        type="button"
        className="recipe-save-button"
        aria-label={`${selected ? 'Bỏ lưu' : 'Lưu'} ${title}`}
        aria-pressed={selected}
        disabled={query.isPending || query.isError || mutation.isPending}
        onClick={() => mutation.mutate({ recipeId, isSaved: !selected })}
      >
        <Heart size={18} fill={selected ? 'currentColor' : 'none'} aria-hidden="true" />
        {!compact && (selected ? 'Đã lưu' : 'Lưu món')}
      </button>
      {mutation.isError && (
        <span className="recipe-save-error" role="alert">
          {error}
        </span>
      )}
      {query.isError && !compact && (
        <button type="button" className="planning-text-link" onClick={() => void query.refetch()}>
          Tải lại món đã lưu
        </button>
      )}
    </span>
  );
}
