import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useRecipeFavorites } from '../../features/favorites/useRecipeFavorites';
import { localizeErrorText, useLocaleText } from '../../i18n/app-i18n';
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
  const { l, locale } = useLocaleText();
  const { query, mutation, saved, guest, error } = useRecipeFavorites();
  const location = useLocation();
  const [popping, setPopping] = useState(false);

  if (guest)
    return (
      <Link
        className="recipe-save-button tkv-tactile active:scale-95"
        aria-label={l(`Đăng nhập để lưu ${title}`, `Sign in to save ${title}`)}
        to={`/auth?mode=login&returnTo=${encodeURIComponent(location.pathname + location.search)}`}
      >
        <Heart size={18} aria-hidden="true" />
        {!compact && l('Lưu món', 'Save')}
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
            message: nextSaved
              ? l(`Đã lưu “${title}” vào yêu thích`, `Saved “${title}” to favorites`)
              : l(`Đã bỏ lưu “${title}”`, `Removed “${title}” from favorites`),
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
        aria-label={selected ? l(`Bỏ lưu ${title}`, `Unsave ${title}`) : l(`Lưu ${title}`, `Save ${title}`)}
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
        {!compact && (selected ? l('Đã lưu', 'Saved') : l('Lưu món', 'Save'))}
      </button>
      {mutation.isError && (
        <span className="recipe-save-error" role="alert">
          {localizeErrorText(error, 'Could not update saved recipe. Please try again.', error ?? '', locale)}
        </span>
      )}
      {query.isError && !compact && (
        <button type="button" className="planning-text-link" onClick={() => void query.refetch()}>
          {l('Tải lại món đã lưu', 'Reload saved recipes')}
        </button>
      )}
    </span>
  );
}
