import React, { useState } from 'react';
import { clsx } from 'clsx';
import { RECIPE_IMAGE_PLACEHOLDER, type ResolvedRecipeImage } from '../../lib/recipe-media';
import { RecipeDishIllustration } from '../cooking/CookingTechniqueVisual';

export type RecipeMediaProps = {
  image: ResolvedRecipeImage;
  title: string;
  className?: string;
  priority?: boolean;
  overlay?: React.ReactNode;
  aspectClass?: string;
};

export function RecipeMedia(props: RecipeMediaProps) {
  // A new identity owns new load/error events; abandoned images cannot alter it.
  return (
    <MediaView
      key={JSON.stringify([props.title, props.image.src, props.image.fallbackSrc])}
      {...props}
    />
  );
}

function MediaView({
  image,
  title,
  className = '',
  priority = false,
  overlay,
  aspectClass = 'aspect-[4/3]',
}: RecipeMediaProps) {
  const [src, setSrc] = useState(image.source === 'placeholder' ? null : image.src);
  const [loaded, setLoaded] = useState(false);
  const state = src ? (loaded ? 'photo' : 'loading') : 'missing';

  return (
    <div
      className={clsx(
        'recipe-media relative overflow-hidden bg-tk-sunken',
        aspectClass,
        state === 'loading' && 'tk-skeleton',
        className,
      )}
      data-recipe-media={state}
      aria-busy={state === 'loading'}
    >
      {src ? (
        <img
          key={src}
          src={src}
          alt={title}
          width={image.width ?? 800}
          height={image.height ?? 600}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={clsx(
            'h-full w-full object-cover transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.035]',
            loaded ? 'opacity-100' : 'opacity-90',
          )}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setSrc(
              src !== image.fallbackSrc && image.fallbackSrc !== RECIPE_IMAGE_PLACEHOLDER
                ? image.fallbackSrc
                : null,
            );
          }}
        />
      ) : (
        <div
          className="recipe-media-missing flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-tk-canvas to-tk-sunken p-4 text-center text-xs font-semibold text-tk-muted"
          role="img"
          aria-label="Chưa có ảnh món ăn"
        >
          <RecipeDishIllustration title={title} />
          <span>Chưa có ảnh món ăn</span>
        </div>
      )}

      {overlay && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-black/15"
          />
          {overlay}
        </>
      )}
    </div>
  );
}
