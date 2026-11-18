import React, { lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { isVNextPreviewEnabled } from './feature';

export const G02ReviewHubPage = lazy(() =>
  import('./screens/G02ReviewHubPage').then((m) => ({ default: m.G02ReviewHubPage })),
);
export const M01LandingPilot = lazy(() =>
  import('./screens/M01LandingPilot').then((m) => ({ default: m.M01LandingPilot })),
);
export const A02LoginPilot = lazy(() =>
  import('./screens/A02LoginPilot').then((m) => ({ default: m.A02LoginPilot })),
);
export const O03HouseholdPilot = lazy(() =>
  import('./screens/O03HouseholdPilot').then((m) => ({ default: m.O03HouseholdPilot })),
);
export const C01HomePilot = lazy(() =>
  import('./screens/C01HomePilot').then((m) => ({ default: m.C01HomePilot })),
);
export const C03InventoryPilot = lazy(() =>
  import('./screens/C03InventoryPilot').then((m) => ({ default: m.C03InventoryPilot })),
);
export const C18RecipeDetailPilot = lazy(() =>
  import('./screens/C18RecipeDetailPilot').then((m) => ({ default: m.C18RecipeDetailPilot })),
);
export const C23PlannerPilot = lazy(() =>
  import('./screens/C23PlannerPilot').then((m) => ({ default: m.C23PlannerPilot })),
);

/**
 * Returns true when the current URL is rendered by a vNext pilot screen that
 * provides its own `ConsumerStudioShell` (preventing legacy AppLayout chrome).
 */
export function isVNextConsumerPilotActive(pathname: string, search: string): boolean {
  if (!isVNextPreviewEnabled(search)) return false;
  const p = pathname.toLowerCase();
  return (
    p === '/' ||
    p === '/fridge' ||
    p === '/inventory' ||
    /^\/recipes\/(?!$)[^/]+\/?$/.test(p) ||
    /^\/recipes\/id\/[^/]+\/?$/.test(p) ||
    p === '/planner' ||
    /^\/planner\/(?!new(?:\/|$))[^/]+\/?$/.test(p)
  );
}

export function withVNextPilot<P extends object>(
  PilotComponent: React.ComponentType<P>,
  LegacyComponent: React.ComponentType<P>,
  predicate?: (pathname: string, search: string) => boolean,
): React.FC<P> {
  const Wrapped: React.FC<P> = (props) => {
    const { pathname, search } = useLocation();
    const enabled =
      isVNextPreviewEnabled(search) && (predicate ? predicate(pathname, search) : true);
    return enabled ? <PilotComponent {...props} /> : <LegacyComponent {...props} />;
  };
  return Wrapped;
}
