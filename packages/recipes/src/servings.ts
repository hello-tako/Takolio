import { Quantity } from '../../domain/src/quantity';
import type { Recipe } from './types';

/** Keeps line identity and fractional counts while scaling the same recipe for a household. */
export function scaleRecipeServings(recipe: Recipe, servings: number): Recipe {
  if (!Number.isSafeInteger(servings) || servings < 1 || servings > 20
    || !Number.isFinite(recipe.servings) || recipe.servings <= 0) {
    throw new RangeError('Recipe servings must be between 1 and 20');
  }
  if (servings === recipe.servings) return recipe;
  const factor = Quantity.from(servings).divide(Quantity.from(recipe.servings));
  return { ...recipe, servings, ingredients: recipe.ingredients.map(line => ({
    ...line, requiredQuantity: Quantity.from(line.requiredQuantity).multiply(factor).toNumber(),
  })) };
}
