import { describe, expect, it } from 'vitest';
import { ALL_RECIPES, evaluateRecipeAvailability, scaleRecipeServings, type Recipe } from '@frigo/recipes';

const recipe: Recipe = { ...ALL_RECIPES[0], servings: 4, ingredients: [
  { ingredientId: 'CHICKEN_EGG', name: 'Trứng', requiredQuantity: 3, unit: 'piece' },
  { ingredientId: 'CHICKEN_EGG', name: 'Trứng làm sốt', requiredQuantity: 1, unit: 'piece' },
  { ingredientId: 'PORK_BELLY', name: 'Thịt', requiredQuantity: 500, unit: 'g' },
] };

describe('household recipe servings', () => {
  it('preserves fractional counts, repeated lines and the source catalog', () => {
    const original = structuredClone(recipe);
    const scaled = scaleRecipeServings(recipe, 2);
    expect(scaled.servings).toBe(2);
    expect(scaled.ingredients.map(line => line.requiredQuantity)).toEqual([1.5, 0.5, 250]);
    expect(scaled.ingredients.map(line => line.name)).toEqual(recipe.ingredients.map(line => line.name));
    expect(scaled.nutrition).toBe(recipe.nutrition);
    expect(recipe).toEqual(original);
    expect(scaleRecipeServings(recipe, 4)).toBe(recipe);
  });

  it('evaluates the combined demand at the selected servings without assuming package mass', () => {
    const stock = [
      { ingredientId: 'CHICKEN_EGG', quantity: 2, unit: 'piece' as const },
      { ingredientId: 'PORK_BELLY', quantity: 1, unit: 'pack' as const },
    ];
    const two = evaluateRecipeAvailability(scaleRecipeServings(recipe, 2), stock);
    expect(two.slice(0, 2).every(line => line.status === 'satisfied')).toBe(true);
    expect(two[2].status).toBe('unresolved');
    const four = evaluateRecipeAvailability(recipe, stock);
    expect(four.slice(0, 2).reduce((sum, line) => sum + (line.missingQuantity ?? 0), 0)).toBe(2);
    expect(stock[0].quantity).toBe(2);
  });

  it.each([0, -1, 21, 1.5, NaN, Infinity])('rejects an invalid household size %s', servings => {
    expect(() => scaleRecipeServings(recipe, servings)).toThrow(RangeError);
  });
});
