import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useRecipeFavorites } from '../../features/favorites/useRecipeFavorites';
import { showTkvToast } from '../../vnext/components/LivingMotion';

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
  const [popping, setPopping] = useState(false);

  if (guest)
    return (
      <Link
        className="recipe-save-button tkv-tactile active:scale-95"
        aria-label={`Đăng nhập để lưu ${title}`}
        to={`/auth?mode=login&returnTo=${encodeURIComponent(location.pathname + location.search)}`}
      >
        <Heart size={18} aria-hidden="true" />
        {!compact && 'Lưu món'}
      </Link>
    );

  const selected = saved(recipeId);
  const handleToggle = () => {
    const nextSaved = !selected;
    setPopping(true);
    window.setTimeout(() => setPopping(false), 320);
    mutation.mutate(
      { recipeId, isSaved: nextSaved },
      {
        onSuccess: () => {
          showTkvToast({
            message: nextSaved ? `Đã lưu “${title}” vào yêu thích` : `Đã bỏ lưu “${title}”`,
            tone: nextSaved ? 'success' : 'info',
          });
        },
      },
    );
  };

  return (
    <span className="recipe-save-control">
      <button
        type="button"
        className="recipe-save-button tkv-tactile active:scale-95"
        aria-label={`${selected ? 'Bỏ lưu' : 'Lưu'} ${title}`}
        aria-pressed={selected}
        disabled={query.isPending || query.isError || mutation.isPending}
        onClick={handleToggle}
      >
        <Heart
          size={18}
          fill={selected ? 'currentColor' : 'none'}
          aria-hidden="true"
          className={popping ? 'tkv-pop' : undefined}
        />
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
