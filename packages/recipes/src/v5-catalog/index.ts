import type { Recipe } from '../types';
import { REGIONAL_MASTERPIECES_V5 } from './regional-masterpieces';
import { standardizeRecipeCulinaryV5, standardizeRecipeTitleV5 } from './title-normalizer';

export { REGIONAL_MASTERPIECES_V5, standardizeRecipeCulinaryV5, standardizeRecipeTitleV5 };

/**
 * Standardizes `baseRecipes` (titles, typography, V5 35mm live-action photo URLs)
 * and appends the 85 authentic 3-region Vietnamese masterpieces (`REGIONAL_MASTERPIECES_V5`),
 * deduplicated strictly by `id` and `slug`.
 */
export function expandCatalogWithV5Masterpieces(baseRecipes: readonly Recipe[]): Recipe[] {
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  const expanded: Recipe[] = [];

  for (const rawRecipe of baseRecipes) {
    const normalized = standardizeRecipeCulinaryV5(rawRecipe);
    if (seenIds.has(normalized.id) || seenSlugs.has(normalized.slug)) continue;
    seenIds.add(normalized.id);
    seenSlugs.add(normalized.slug);
    expanded.push(normalized);
  }

  for (const masterpiece of REGIONAL_MASTERPIECES_V5) {
    const normalized = standardizeRecipeCulinaryV5(masterpiece);
    if (seenIds.has(normalized.id) || seenSlugs.has(normalized.slug)) continue;
    seenIds.add(normalized.id);
    seenSlugs.add(normalized.slug);
    expanded.push(normalized);
  }

  return expanded;
}

/**
 * Resolves a single recipe by `id` first, then `slug`, over the V5-expanded catalog.
 */
export function findRecipeInV5Catalog(
  baseRecipes: readonly Recipe[],
  idOrSlug: string,
): Recipe | null {
  if (!idOrSlug) return null;
  const catalog = expandCatalogWithV5Masterpieces(baseRecipes);
  for (const recipe of catalog) {
    if (recipe.id === idOrSlug) return recipe;
  }
  for (const recipe of catalog) {
    if (recipe.slug === idOrSlug) return recipe;
  }
  return null;
}
