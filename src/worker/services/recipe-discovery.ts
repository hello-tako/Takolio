import type { Env, AuthContext } from '../types';
import type { RecipeAuthoritySnapshot } from '../../../packages/recipes/src/recipe-authority';
import type { DiscoveryQuery } from '../../../packages/recipes/src/discovery-contract';
import {
  discoverySnapshot,
  normalizeDiscoverySearch,
  rankDiscovery,
  selectDiscoveryPage,
  presentDiscoveryPage,
} from '../../../packages/recipes/src/discovery';
import { fingerprintRecipes } from '../../../packages/recipes/src/catalog-fingerprint';
import { expandCatalogWithV5Masterpieces, rankRecipes, scaleRecipeServings } from '@frigo/recipes';
import { InventoryReadError, fetchHouseholdInventoryFromDb } from '../routes/inventory';
import { enrichRecipesWithMedia } from './recipe-media';
import { filterSafeRecipes, loadHouseholdDiscoveryContext } from './allergen-safety';

export async function discoverRecipes(
  env: Env,
  auth: AuthContext,
  catalog: RecipeAuthoritySnapshot,
  query: DiscoveryQuery,
) {
  const [inventory, discoveryCtx] = await Promise.all([
    fetchHouseholdInventoryFromDb(env.DB, auth.householdId, undefined, {
      actorId: auth.userId,
      strict: true,
    }).catch(() => {
      throw new InventoryReadError();
    }),
    loadHouseholdDiscoveryContext(env.DB, {
      householdId: auth.householdId,
      userId: auth.userId,
    }),
  ]);

  const isV5Expanded = env.RECIPE_CATALOG_V5_EXPANDED === 'true';
  const baseCatalogList = isV5Expanded
    ? expandCatalogWithV5Masterpieces(catalog.list())
    : catalog.list();
  const baseCatalogFingerprint = isV5Expanded
    ? await fingerprintRecipes(baseCatalogList)
    : catalog.fingerprint;

  const safeCatalog = filterSafeRecipes(baseCatalogList, discoveryCtx);
  const hasPersonalization =
    discoveryCtx.hasSafetyFilters ||
    discoveryCtx.recentCookedRecipeIds.length > 0 ||
    discoveryCtx.preferredCuisines.length > 0;

  // Preserve exact snapshot fingerprint when no household restrictions/history exist;
  // incorporate restriction + history state when active so cursors detect preference changes.
  const catalogFingerprint = hasPersonalization
    ? `${baseCatalogFingerprint}:${JSON.stringify([
        discoveryCtx.allergens,
        discoveryCtx.dietaryRestrictions,
        discoveryCtx.forbiddenIngredientIds,
        discoveryCtx.neverRecommendRecipeIds,
        discoveryCtx.preferredCuisines,
        discoveryCtx.recentCookedRecipeIds,
      ])}`
    : baseCatalogFingerprint;

  const snapshot = await discoverySnapshot({
    source: `server:${catalog.source}`,
    catalogFingerprint,
    userId: auth.userId,
    householdId: auth.householdId,
    inventory,
    query,
  });

  let ranked;
  if (!hasPersonalization) {
    ranked = rankDiscovery(safeCatalog, inventory, query);
  } else {
    const search = normalizeDiscoverySearch(query.q.trim());
    const candidates = safeCatalog.filter((recipe) => {
      if (query.cuisine && recipe.cuisine !== query.cuisine) return false;
      if (query.category && recipe.category !== query.category) return false;
      if (query.region && recipe.region !== query.region && recipe.region !== 'toan_quoc') return false;
      if (query.maxTime && recipe.cookTimeMinutes > query.maxTime) return false;
      return (
        !search ||
        [
          recipe.title,
          recipe.description,
          ...recipe.tags,
          ...recipe.ingredients.map((line) => line.name),
        ].some((text) => normalizeDiscoverySearch(text).includes(search))
      );
    });
    const portioned = query.servings
      ? candidates.map((recipe) => scaleRecipeServings(recipe, query.servings!))
      : candidates;
    ranked = rankRecipes(portioned, {
      inventory,
      onlyNoBuyNeeded: query.noBuy,
      maxCookTimeMinutes: query.maxTime,
      preferredCuisines: query.cuisine
        ? [query.cuisine]
        : discoveryCtx.preferredCuisines.length > 0
          ? discoveryCtx.preferredCuisines
          : undefined,
      recentCookedRecipeIds:
        discoveryCtx.recentCookedRecipeIds.length > 0 ? discoveryCtx.recentCookedRecipeIds : undefined,
    }).sort(
      (a, b) =>
        b.score - a.score ||
        b.matchPercentage - a.matchPercentage ||
        a.recipe.cookTimeMinutes - b.recipe.cookTimeMinutes ||
        (a.recipe.id < b.recipe.id ? -1 : a.recipe.id > b.recipe.id ? 1 : 0),
    );
  }

  const selection = selectDiscoveryPage(ranked, query, snapshot);
  const page = presentDiscoveryPage(selection, 'server');
  const recipes = await enrichRecipesWithMedia(
    env,
    page.items.map((item) => item.recipe),
  );
  return { ...page, items: page.items.map((item, index) => ({ ...item, recipe: recipes[index] })) };
}
