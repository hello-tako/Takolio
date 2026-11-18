import React, { lazy } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isVNextPreviewEnabled } from './feature';

export const G02ReviewHubPage = lazy(() =>
  import('./screens/G02ReviewHubPage').then((m) => ({ default: m.G02ReviewHubPage })),
);
export const M01LandingPilot = lazy(() =>
  import('./screens/M01LandingPilot').then((m) => ({ default: m.M01LandingPilot })),
);
export const A02LoginPilot = lazy(() =>
  import('./screens/AuthFlowPages').then((m) => ({ default: m.VNextAuthFlow })),
);
export const O03HouseholdPilot = lazy(() =>
  import('./screens/OnboardingFlowPages').then((m) => ({ default: m.VNextOnboardingFlow })),
);
export const C01HomePilot = lazy(() =>
  import('./screens/C01HomePilot').then((m) => ({ default: m.C01HomePilot })),
);
export const C02QuickSearchVNext = lazy(() =>
  import('./screens/FridgeAndScanWrappers').then((m) => ({ default: m.C02QuickSearchPage })),
);
export const C03InventoryPilot = lazy(() =>
  import('./screens/C03InventoryPilot').then((m) => ({ default: m.C03InventoryPilot })),
);
export const C06LotDetailVNext = lazy(() =>
  import('./screens/FridgeAndScanWrappers').then((m) => ({ default: m.C06LotDetailVNext })),
);
export const C08ReconciliationVNext = lazy(() =>
  import('./screens/FridgeAndScanWrappers').then((m) => ({ default: m.C08ReconciliationVNext })),
);
export const C09ScanStudioVNext = lazy(() =>
  import('./screens/FridgeAndScanWrappers').then((m) => ({ default: m.C09ScanStudioVNext })),
);
export const C12ScanReviewVNext = lazy(() =>
  import('./screens/FridgeAndScanWrappers').then((m) => ({ default: m.C12ScanReviewVNext })),
);
export const C14ReceiptReviewVNext = lazy(() =>
  import('./screens/FridgeAndScanWrappers').then((m) => ({ default: m.C14ReceiptReviewVNext })),
);
export const C15RecipesDiscoveryVNext = lazy(() =>
  import('./screens/RecipesAndCookPages').then((m) => ({ default: m.C15RecipesDiscoveryVNext })),
);
export const C18RecipeDetailPilot = lazy(() =>
  import('./screens/C18RecipeDetailPilot').then((m) => ({ default: m.C18RecipeDetailPilot })),
);
export const C20C21CookingStudioVNext = lazy(() =>
  import('./screens/RecipesAndCookPages').then((m) => ({ default: m.C20C21CookingStudioVNext })),
);
export const C22CookingCompleteVNext = lazy(() =>
  import('./screens/RecipesAndCookPages').then((m) => ({ default: m.C22CookingCompleteVNext })),
);
export const C23PlannerPilot = lazy(() =>
  import('./screens/C23PlannerPilot').then((m) => ({ default: m.C23PlannerPilot })),
);
export const C24PlannerSetupVNext = lazy(() =>
  import('./screens/PlannerAndShoppingPages').then((m) => ({ default: m.C24PlannerSetupVNext })),
);
export const C25C26PlannerMealVNext = lazy(() =>
  import('./screens/PlannerAndShoppingPages').then((m) => ({ default: m.C25C26PlannerMealVNext })),
);
export const C27C28ShoppingVNext = lazy(() =>
  import('./screens/PlannerAndShoppingPages').then((m) => ({ default: m.C27C28ShoppingVNext })),
);
export const C29ShoppingImportVNext = lazy(() =>
  import('./screens/PlannerAndShoppingPages').then((m) => ({ default: m.C29ShoppingImportVNext })),
);
export const C30NotificationsVNext = lazy(() =>
  import('./screens/AccountAndSystemPages').then((m) => ({ default: m.C30NotificationsVNext })),
);
export const U01ProfileHubVNext = lazy(() =>
  import('./screens/AccountAndSystemPages').then((m) => ({ default: m.U01ProfileHubVNext })),
);
export const U02FoodPrefsVNext = lazy(() =>
  import('./screens/AccountAndSystemPages').then((m) => ({ default: m.U02FoodPrefsVNext })),
);
export const U03PlanningSettingsVNext = lazy(() =>
  import('./screens/AccountAndSystemPages').then((m) => ({ default: m.U03PlanningSettingsVNext })),
);
export const U04AppSettingsVNext = lazy(() =>
  import('./screens/AccountAndSystemPages').then((m) => ({ default: m.U04AppSettingsVNext })),
);
export const U05NotificationPrefsVNext = lazy(() =>
  import('./screens/AccountAndSystemPages').then((m) => ({ default: m.U05NotificationPrefsVNext })),
);
export const U06HouseholdHonestPage = lazy(() =>
  import('./screens/AccountAndSystemPages').then((m) => ({ default: m.U06HouseholdHonestPage })),
);
export const U07U08PlusReadOnlyWrapper = lazy(() =>
  import('./screens/AccountAndSystemPages').then((m) => ({ default: m.U07U08PlusReadOnlyWrapper })),
);
export const U09U10PrivacyAndDataRightsPage = lazy(() =>
  import('./screens/AccountAndSystemPages').then((m) => ({
    default: m.U09U10PrivacyAndDataRightsPage,
  })),
);
export const VNextSystemStatePage = lazy(() =>
  import('./screens/AccountAndSystemPages').then((m) => ({ default: m.VNextSystemStatePage })),
);
export const S02NotFoundVNext = lazy(() =>
  import('./screens/AccountAndSystemPages').then((m) => ({ default: m.S02NotFoundPage })),
);

/**
 * Returns true when the current URL is rendered by a vNext screen that owns its
 * own `ConsumerStudioShell` or immersive frame (preventing duplicate legacy AppLayout chrome).
 */
export function isVNextConsumerPilotActive(pathname: string, search: string): boolean {
  if (!isVNextPreviewEnabled(search)) return false;
  const p = pathname.toLowerCase();
  if (p.startsWith('/week')) return false;
  return true;
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

export const NotFoundEntry: React.FC = () => {
  const { search } = useLocation();
  return isVNextPreviewEnabled(search) ? <S02NotFoundVNext /> : <Navigate to="/" replace />;
};
