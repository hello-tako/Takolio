/**
 * T14C + Takolio V4 — frontend resolution point for recipe display media (ADR-025).
 *
 * - `resolveRecipeImage`: preserves exact T14C / UI12 contract for legacy tests & surfaces.
 * - `resolveRecipeArtworkV4` & `resolveRecipeImageV4`: guarantees every recipe resolves to a rich
 *   curated WebP artwork under `/takolio/v4/dishes/*.webp` (never a blank grey box!).
 */
import {
  DISH_ARTWORK_CATALOG_V4,
  DISH_ARTWORK_V4_BASE_PATH,
  resolveRecipeArtworkV4,
  type DishArtworkIdV4,
  type Recipe,
  type RecipeArtworkInputV4,
  type RecipeArtworkV4,
  type RecipeMediaPresentationSet,
} from '@frigo/recipes';
import { legacyRecipeImageIssue } from '../../../packages/recipes/src/legacy-media-policy';

export {
  DISH_ARTWORK_CATALOG_V4,
  DISH_ARTWORK_V4_BASE_PATH,
  resolveRecipeArtworkV4,
  type DishArtworkIdV4,
  type RecipeArtworkInputV4,
  type RecipeArtworkV4,
};

export const RECIPE_IMAGE_PLACEHOLDER = '/takosan/recipe-placeholder.svg';

export type RecipeWithOptionalMedia = Pick<Recipe, 'imageUrl'> & {
  id?: string;
  media?: RecipeMediaPresentationSet | null;
};

export interface ResolvedRecipeImage {
  src: string;
  fallbackSrc: string;
  source: 'canonical_r2' | 'legacy_static' | 'legacy_external' | 'placeholder';
  width: number | null;
  height: number | null;
  aspectRatio: string | undefined;
}

export interface ResolvedRecipeImageV4 extends ResolvedRecipeImage {
  artworkId: DishArtworkIdV4;
  categoryLabelVi: string;
  accentTone: RecipeArtworkV4['accentTone'];
}

function isRenderableLegacyUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    ((trimmed.startsWith('/') && !trimmed.startsWith('//')) || /^https:\/\//i.test(trimmed))
  );
}

export function resolveRecipeImage(
  recipe: RecipeWithOptionalMedia | null | undefined,
  placeholder = RECIPE_IMAGE_PLACEHOLDER,
): ResolvedRecipeImage {
  const hero = recipe?.media?.hero;
  const legacyAllowed =
    recipe && isRenderableLegacyUrl(recipe.imageUrl) && !legacyRecipeImageIssue(recipe);
  if (
    hero &&
    hero.source === 'canonical_r2' &&
    typeof hero.url === 'string' &&
    hero.url.startsWith('/api/v1/recipe-media/')
  ) {
    const width = hero.width ?? null;
    const height = hero.height ?? null;
    return {
      src: hero.url,
      fallbackSrc: legacyAllowed ? recipe.imageUrl.trim() : placeholder,
      source: 'canonical_r2',
      width,
      height,
      aspectRatio: width && height ? `${width} / ${height}` : undefined,
    };
  }
  if (legacyAllowed) {
    const url = recipe.imageUrl.trim();
    return {
      src: url,
      fallbackSrc: placeholder,
      source: url.startsWith('/') ? 'legacy_static' : 'legacy_external',
      width: null,
      height: null,
      aspectRatio: undefined,
    };
  }
  return {
    src: placeholder,
    fallbackSrc: placeholder,
    source: 'placeholder',
    width: null,
    height: null,
    aspectRatio: undefined,
  };
}

/**
 * Takolio V4 artwork-backed image resolver: prioritizes canonical R2 hero -> reviewed static ->
 * deterministic V4 category/cuisine/technique WebP dish artwork so zero cards show a broken box.
 */
export function resolveRecipeImageV4(
  recipe: (Omit<Partial<RecipeWithOptionalMedia>, 'id'> & RecipeArtworkInputV4) | null | undefined,
): ResolvedRecipeImageV4 {
  const artwork = resolveRecipeArtworkV4(recipe);
  const hero = recipe?.media?.hero;

  if (
    hero &&
    hero.source === 'canonical_r2' &&
    typeof hero.url === 'string' &&
    hero.url.startsWith('/api/v1/recipe-media/')
  ) {
    const width = hero.width ?? artwork.width;
    const height = hero.height ?? artwork.height;
    return {
      src: hero.url,
      fallbackSrc: artwork.url,
      source: 'canonical_r2',
      width,
      height,
      aspectRatio: `${width} / ${height}`,
      artworkId: artwork.artworkId,
      categoryLabelVi: artwork.categoryLabelVi,
      accentTone: artwork.accentTone,
    };
  }

  if (
    recipe?.imageUrl &&
    isRenderableLegacyUrl(recipe.imageUrl) &&
    !legacyRecipeImageIssue({ id: recipe.id ?? undefined, imageUrl: recipe.imageUrl })
  ) {
    const cleanUrl = recipe.imageUrl.trim();
    return {
      src: cleanUrl,
      fallbackSrc: artwork.url,
      source: cleanUrl.startsWith('/') ? 'legacy_static' : 'legacy_external',
      width: artwork.width,
      height: artwork.height,
      aspectRatio: artwork.aspectRatio,
      artworkId: artwork.artworkId,
      categoryLabelVi: artwork.categoryLabelVi,
      accentTone: artwork.accentTone,
    };
  }

  return {
    src: artwork.url,
    fallbackSrc: artwork.fallbackUrl,
    source: 'legacy_static',
    width: artwork.width,
    height: artwork.height,
    aspectRatio: artwork.aspectRatio,
    artworkId: artwork.artworkId,
    categoryLabelVi: artwork.categoryLabelVi,
    accentTone: artwork.accentTone,
  };
}

/** `onError` handler that steps through the legacy fallback to the neutral placeholder (no infinite reload loops). */
export function recipeImageErrorHandler(fallbackSrc: string) {
  return (event: { currentTarget: HTMLImageElement }) => {
    const image = event.currentTarget;
    const current = image.getAttribute('src');
    if (current === RECIPE_IMAGE_PLACEHOLDER) return;
    const next = current === fallbackSrc ? RECIPE_IMAGE_PLACEHOLDER : fallbackSrc;
    image.dataset.recipeMediaFallbackApplied = '1';
    image.src = next;
    if (next === RECIPE_IMAGE_PLACEHOLDER) image.alt = 'Chưa có ảnh món ăn';
  };
}
