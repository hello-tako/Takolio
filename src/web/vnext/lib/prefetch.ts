import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';

type ChunkLoader = () => Promise<unknown>;

const ROUTE_CHUNK_LOADERS: Record<string, ChunkLoader> = {
  '/': () => import('../screens/C01HomePilot'),
  '/fridge': () => import('../screens/C03InventoryPilot'),
  '/inventory': () => import('../screens/C03InventoryPilot'),
  '/planner': () => import('../screens/C23PlannerPilot'),
  '/week': () => import('../screens/C23PlannerPilot'),
  '/shopping': () => import('../../pages/ShoppingPage'),
  '/me': () => import('../screens/AccountAndSystemPages'),
  '/recipes': () => import('../screens/RecipesAndCookPages'),
  '/scan': () => import('../../pages/ScanPage'),
  '/search': () => import('../screens/FridgeAndScanWrappers'),
  '/settings/app': () => import('../../pages/SettingsPage'),
  '/plus': () => import('../../pages/PlusPaywallPage'),
};

const prefetchedChunks = new Set<string>();
const prefetchedQueries = new Map<string, number>();
const QUERY_PREFETCH_TTL_MS = 25_000;

function normalizeRouteKey(pathname: string): string {
  const clean = pathname.split('?')[0]?.split('#')[0] || '/';
  if (clean === '/' || clean === '/home') return '/';
  if (clean.startsWith('/recipes/')) return '/recipes-detail';
  for (const key of Object.keys(ROUTE_CHUNK_LOADERS)) {
    if (key !== '/' && (clean === key || clean.startsWith(`${key}/`))) {
      return key;
    }
  }
  return clean;
}

/**
 * Prefetches the JS route chunk for a destination once per session.
 * Safe to call on hover, touchStart, keyboard focus, or Onboarding O06 completion.
 */
export function prefetchRouteChunk(pathname: string): void {
  if (typeof window === 'undefined') return;
  const key = normalizeRouteKey(pathname);
  if (prefetchedChunks.has(key)) return;

  if (key === '/recipes-detail') {
    prefetchedChunks.add(key);
    void import('../screens/C18RecipeDetailPilot').catch(() => {
      prefetchedChunks.delete(key);
    });
    return;
  }

  const loader = ROUTE_CHUNK_LOADERS[key];
  if (!loader) return;
  prefetchedChunks.add(key);
  void loader().catch(() => {
    prefetchedChunks.delete(key);
  });
}

/**
 * Warms both JS chunk and read-only TanStack Query cache for primary app destinations.
 * Strictly throttled so pointer sweeps never flood API endpoints.
 */
export function prefetchDestination(
  queryClient: QueryClient,
  pathname: string,
  options?: { userId?: string | null; householdId?: string | null; isGuest?: boolean },
): void {
  if (typeof window === 'undefined') return;
  prefetchRouteChunk(pathname);

  void (async () => {
    let userId = options?.userId ?? null;
    let householdId = options?.householdId ?? null;
    if (!userId || !householdId) {
      const { useAuthStore } = await import('../../stores/useAuthStore');
      const state = useAuthStore.getState();
      userId = userId ?? state.userId;
      householdId = householdId ?? state.householdId;
    }
    if (!userId || !householdId) return;

    const key = normalizeRouteKey(pathname);
    const cacheTag = `${userId}:${householdId}:${key}`;
    const now = Date.now();
    const last = prefetchedQueries.get(cacheTag) ?? 0;
    if (now - last < QUERY_PREFETCH_TTL_MS) return;
    prefetchedQueries.set(cacheTag, now);

    const { api } = await import('../../services/api');

    if (key === '/fridge' || key === '/inventory') {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.inventory(),
        queryFn: () => api.getInventory(),
        staleTime: 20_000,
      });
    } else if (key === '/shopping') {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.shoppingList(),
        queryFn: () => api.getShoppingList(),
        staleTime: 20_000,
      });
    } else if (key === '/' || key === '/recipes') {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.recipeDiscovery({ pageSize: 12 }),
        queryFn: () => api.getRecipeDiscovery({ pageSize: 12 }),
        staleTime: 30_000,
      });
    } else if (key === '/me') {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.notifications(),
        queryFn: () => api.getNotifications(),
        staleTime: 20_000,
      });
    }
  })().catch(() => {
    // Best-effort warmup must never surface unhandled rejections.
  });
}
