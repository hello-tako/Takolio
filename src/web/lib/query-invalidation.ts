import { getCurrentScope } from '../services/http';
import { queryClient } from './query-client';
import { queryKeys } from './queryKeys';

function mealPlanningPrefixes() {
  const { userId, householdId } = getCurrentScope();
  return [
    ['mealPlanningPlan', userId, householdId] as const,
    ['mealPlanningShopping', userId, householdId] as const,
    ['mealPlanningAlternatives', userId, householdId] as const,
    ['mealPlanningCompositions', userId, householdId] as const,
    ['mealCompositionPicker', userId, householdId] as const,
  ];
}

export function invalidateInventoryDependents() {
  return Promise.all(
    [
      queryKeys.inventory(),
      queryKeys.inventoryObservations(),
      queryKeys.recommendationLists(),
      queryKeys.recipes(),
      queryKeys.notifications(),
      queryKeys.me(),
      ...mealPlanningPrefixes(),
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
}

export function invalidateWeekDependents() {
  return Promise.all([
    invalidateInventoryDependents(),
    queryClient.invalidateQueries({ queryKey: queryKeys.weekPlans() }),
  ]);
}

export function invalidateReplayedQueries(paths: string[]) {
  const inventoryChanged = paths.some(
    (path) =>
      path.startsWith('/inventory') ||
      path.includes('/cook/complete') ||
      path.includes('/shopping/complete') ||
      path.includes('/shopping-list/import-purchased') ||
      path.startsWith('/scans/')
  );
  const weekOrMealPlanningChanged = paths.some(
    (path) =>
      path.startsWith('/week/') ||
      path.startsWith('/meal-plans') ||
      path.startsWith('/family-meal-plans') ||
      path.includes('/cook/complete')
  );
  return Promise.all([
    inventoryChanged ? invalidateInventoryDependents() : Promise.resolve(),
    ...(weekOrMealPlanningChanged
      ? [
          queryClient.invalidateQueries({ queryKey: queryKeys.weekPlans() }),
          queryClient.invalidateQueries({ queryKey: queryKeys.inventoryObservations() }),
          ...mealPlanningPrefixes().map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        ]
      : []),
    ...(paths.some((path) => path.startsWith('/shopping') || path.includes('/shopping/complete'))
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList() })]
      : []),
  ]);
}
