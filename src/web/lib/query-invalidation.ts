import { queryClient } from './query-client';
import { queryKeys } from './queryKeys';

export function invalidateInventoryDependents() {
  return Promise.all([
    queryKeys.inventory(),
    queryKeys.recommendationLists(),
    queryKeys.recipes(),
    queryKeys.notifications(),
    queryKeys.me(),
    ['mealPlanningPlan'],
    ['mealPlanningCompositions'],
    ['mealPlanningShopping'],
  ].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function invalidateWeekDependents() {
  return Promise.all([
    invalidateInventoryDependents(),
    queryClient.invalidateQueries({ queryKey: queryKeys.weekPlans() }),
  ]);
}

export function invalidateReplayedQueries(paths: string[]) {
  const inventoryChanged = paths.some((path) => path.startsWith('/inventory') ||
    path.includes('/cook/complete') || path.includes('/shopping/complete') || path.startsWith('/scans/'));
  return Promise.all([
    inventoryChanged ? invalidateInventoryDependents() : Promise.resolve(),
    ...(paths.some((path) => path.startsWith('/week/') || path.includes('/cook/complete'))
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.weekPlans() })] : []),
    ...(paths.some((path) => path.startsWith('/shopping') || path.includes('/shopping/complete'))
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList() })] : []),
  ]);
}
