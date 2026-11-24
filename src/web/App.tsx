import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { SessionBoundary } from './components/common/SessionBoundary';
import { RouteFallback } from './components/common/RouteFallback';
import { SystemStatusPage } from './components/common/SystemStatusPage';
import { useAuthStore } from './stores/useAuthStore';
import { AppLayout } from './components/layout/AppLayout';
import { VerifyRouteLifecycle } from './features/auth/VerifyRouteLifecycle';
import { lSync } from './i18n/app-i18n';
import {
  detectRuntimeDomainRole,
  resolveSatelliteSurfaceHref,
} from './vnext/lib/domain-surface';

const M01LandingPage = lazy(() =>
  import('./vnext/screens/M01LandingPilot').then((m) => ({ default: m.M01LandingPilot })),
);
const M02HowItWorksPage = lazy(() =>
  import('./vnext/screens/PublicSitePages').then((m) => ({ default: m.M02HowItWorksPage })),
);
const M03AiScanFeaturePage = lazy(() =>
  import('./vnext/screens/PublicSitePages').then((m) => ({ default: m.M03AiScanFeaturePage })),
);
const M04FridgeFeaturePage = lazy(() =>
  import('./vnext/screens/PublicSitePages').then((m) => ({ default: m.M04FridgeFeaturePage })),
);
const M05MealPlanningFeaturePage = lazy(() =>
  import('./vnext/screens/PublicSitePages').then((m) => ({ default: m.M05MealPlanningFeaturePage })),
);
const M06RecipesFeaturePage = lazy(() =>
  import('./vnext/screens/PublicSitePages').then((m) => ({ default: m.M06RecipesFeaturePage })),
);
const M07CookingFeaturePage = lazy(() =>
  import('./vnext/screens/PublicSitePages').then((m) => ({ default: m.M07CookingFeaturePage })),
);
const M08ShoppingFeaturePage = lazy(() =>
  import('./vnext/screens/PublicSitePages').then((m) => ({ default: m.M08ShoppingFeaturePage })),
);
const M09PricingPage = lazy(() =>
  import('./vnext/screens/PublicSitePages').then((m) => ({ default: m.M09PricingPage })),
);
const M10FaqPage = lazy(() =>
  import('./vnext/screens/PublicSitePages').then((m) => ({ default: m.M10FaqPage })),
);
const M11StoriesPage = lazy(() =>
  import('./vnext/screens/PublicSitePages').then((m) => ({ default: m.M11StoriesPage })),
);
const M12CompanyLegalPage = lazy(() =>
  import('./vnext/screens/PublicSitePages').then((m) => ({ default: m.M12CompanyLegalPage })),
);

const VNextAuthFlowPage = lazy(() =>
  import('./vnext/screens/AuthFlowPages').then((m) => ({ default: m.VNextAuthFlow })),
);
const VNextOnboardingFlowPage = lazy(() =>
  import('./vnext/screens/OnboardingFlowPages').then((m) => ({ default: m.VNextOnboardingFlow })),
);

const C01HomePage = lazy(() =>
  import('./vnext/screens/C01HomePilot').then((m) => ({ default: m.C01HomePilot })),
);
const C02QuickSearchPage = lazy(() =>
  import('./vnext/screens/FridgeAndScanWrappers').then((m) => ({ default: m.C02QuickSearchPage })),
);
const C03InventoryPage = lazy(() =>
  import('./vnext/screens/C03InventoryPilot').then((m) => ({ default: m.C03InventoryPilot })),
);
const C06LotDetailPage = lazy(() =>
  import('./vnext/screens/FridgeAndScanWrappers').then((m) => ({ default: m.C06LotDetailVNext })),
);
const C08ReconciliationPage = lazy(() =>
  import('./vnext/screens/FridgeAndScanWrappers').then((m) => ({ default: m.C08ReconciliationVNext })),
);
const C09ScanStudioPage = lazy(() =>
  import('./vnext/screens/FridgeAndScanWrappers').then((m) => ({ default: m.C09ScanStudioVNext })),
);
const C12ScanReviewPage = lazy(() =>
  import('./vnext/screens/FridgeAndScanWrappers').then((m) => ({ default: m.C12ScanReviewVNext })),
);
const C14ReceiptReviewPage = lazy(() =>
  import('./vnext/screens/FridgeAndScanWrappers').then((m) => ({ default: m.C14ReceiptReviewVNext })),
);

const C15RecipesDiscoveryPage = lazy(() =>
  import('./vnext/screens/RecipesAndCookPages').then((m) => ({ default: m.C15RecipesDiscoveryVNext })),
);
const C18RecipeDetailPage = lazy(() =>
  import('./vnext/screens/C18RecipeDetailPilot').then((m) => ({ default: m.C18RecipeDetailPilot })),
);
const C20C21CookingStudioPage = lazy(() =>
  import('./vnext/screens/RecipesAndCookPages').then((m) => ({ default: m.C20C21CookingStudioVNext })),
);
const C22CookingCompletePage = lazy(() =>
  import('./vnext/screens/RecipesAndCookPages').then((m) => ({ default: m.C22CookingCompleteVNext })),
);

const C23PlannerPage = lazy(() =>
  import('./vnext/screens/C23PlannerPilot').then((m) => ({ default: m.C23PlannerPilot })),
);
const C24PlannerSetupPage = lazy(() =>
  import('./vnext/screens/PlannerAndShoppingPages').then((m) => ({ default: m.C24PlannerSetupVNext })),
);
const C25C26PlannerMealPage = lazy(() =>
  import('./vnext/screens/PlannerAndShoppingPages').then((m) => ({ default: m.C25C26PlannerMealVNext })),
);
const C27C28ShoppingPage = lazy(() =>
  import('./vnext/screens/PlannerAndShoppingPages').then((m) => ({ default: m.C27C28ShoppingVNext })),
);
const C29ShoppingImportPage = lazy(() =>
  import('./vnext/screens/PlannerAndShoppingPages').then((m) => ({ default: m.C29ShoppingImportVNext })),
);

const C30NotificationsPage = lazy(() =>
  import('./vnext/screens/AccountAndSystemPages').then((m) => ({ default: m.C30NotificationsVNext })),
);
const U01ProfileHubPage = lazy(() =>
  import('./vnext/screens/AccountAndSystemPages').then((m) => ({ default: m.U01ProfileHubVNext })),
);
const U02FoodPrefsPage = lazy(() =>
  import('./vnext/screens/AccountAndSystemPages').then((m) => ({ default: m.U02FoodPrefsVNext })),
);
const U03PlanningSettingsPage = lazy(() =>
  import('./vnext/screens/AccountAndSystemPages').then((m) => ({ default: m.U03PlanningSettingsVNext })),
);
const U04AppSettingsPage = lazy(() =>
  import('./vnext/screens/AccountAndSystemPages').then((m) => ({ default: m.U04AppSettingsVNext })),
);
const U05NotificationPrefsPage = lazy(() =>
  import('./vnext/screens/AccountAndSystemPages').then((m) => ({ default: m.U05NotificationPrefsVNext })),
);
const U06HouseholdHonestPage = lazy(() =>
  import('./vnext/screens/AccountAndSystemPages').then((m) => ({ default: m.U06HouseholdHonestPage })),
);
const U07U08PlusReadOnlyPage = lazy(() =>
  import('./vnext/screens/AccountAndSystemPages').then((m) => ({ default: m.U07U08PlusReadOnlyWrapper })),
);
const BillingReturnPage = lazy(() =>
  import('./pages/BillingReturnPage').then((m) => ({ default: m.BillingReturnPage })),
);
const U09U10PrivacyAndDataRightsPage = lazy(() =>
  import('./vnext/screens/AccountAndSystemPages').then((m) => ({
    default: m.U09U10PrivacyAndDataRightsPage,
  })),
);
const VNextSystemStatePage = lazy(() =>
  import('./vnext/screens/AccountAndSystemPages').then((m) => ({ default: m.VNextSystemStatePage })),
);
const S02NotFoundPage = lazy(() =>
  import('./vnext/screens/AccountAndSystemPages').then((m) => ({ default: m.S02NotFoundPage })),
);

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed)
      return (
        <SystemStatusPage title={lSync('Không thể mở trang này', 'Unable to open this page')}>
          <p role="alert">{lSync('Vui lòng tải lại ứng dụng để thử lại.', 'Please reload the app and try again.')}</p>
          <button
            className="rounded-xl bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] px-4 py-3 font-semibold text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--tkv-primary,#196149)]"
            onClick={() => window.location.reload()}
          >
            {lSync('Tải lại', 'Reload')}
          </button>
        </SystemStatusPage>
      );
    return this.props.children;
  }
}

// Legacy /week/* → canonical /planner/* compatibility redirects preserving route params.
const WeekHomeRedirect: React.FC = () => <Navigate to="/planner" replace />;
const WeekSetupRedirect: React.FC = () => <Navigate to="/planner/new" replace />;
const WeekPlanRedirect: React.FC = () => {
  const { planId } = useParams();
  return <Navigate to={`/planner/${planId ?? ''}`} replace />;
};
const WeekMealRedirect: React.FC = () => {
  const { planId, mealId } = useParams();
  return <Navigate to={`/planner/${planId ?? ''}/meal/${mealId ?? ''}`} replace />;
};
const WeekShoppingRedirect: React.FC = () => {
  const { planId } = useParams();
  return <Navigate to={`/planner/${planId ?? ''}/shopping`} replace />;
};

const SatelliteSurfaceRedirect: React.FC = () => {
  useEffect(() => {
    const p = window.location.pathname;
    window.location.replace(resolveSatelliteSurfaceHref(p === '/landing' ? '/' : p));
  }, []);
  return <RouteFallback />;
};

export const App: React.FC = () => {
  const { isGuest, isOnboarded, userId, householdId, primaryGoal } = useAuthStore();
  const domainRole = detectRuntimeDomainRole();
  const satelliteMode = domainRole === 'satellite-com';
  const appOnlyMode = domainRole === 'application-app';
  const unauthEntryPath = appOnlyMode ? '/auth?mode=welcome' : '/landing';

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter useTransitions={false}>
        <AppErrorBoundary key={`${userId}:${householdId}`}>
          <SessionBoundary>
            <VerifyRouteLifecycle />
            <Suspense fallback={<RouteFallback />}>
              <Routes key={`${userId}:${householdId}`}>
                {/* S01–S08 System State Routes */}
                <Route path="/vnext/states/:stateId" element={<VNextSystemStatePage />} />

                {/* M02–M12 Public Marketing Website Routes -> on takolio.app, hand off to takolio.com */}
                <Route path="/how-it-works" element={appOnlyMode ? <SatelliteSurfaceRedirect /> : <M02HowItWorksPage />} />
                <Route path="/features/ai-scan" element={appOnlyMode ? <SatelliteSurfaceRedirect /> : <M03AiScanFeaturePage />} />
                <Route path="/features/fridge" element={appOnlyMode ? <SatelliteSurfaceRedirect /> : <M04FridgeFeaturePage />} />
                <Route path="/features/meal-planning" element={appOnlyMode ? <SatelliteSurfaceRedirect /> : <M05MealPlanningFeaturePage />} />
                <Route path="/features/recipes" element={appOnlyMode ? <SatelliteSurfaceRedirect /> : <M06RecipesFeaturePage />} />
                <Route path="/features/cooking" element={appOnlyMode ? <SatelliteSurfaceRedirect /> : <M07CookingFeaturePage />} />
                <Route path="/features/shopping" element={appOnlyMode ? <SatelliteSurfaceRedirect /> : <M08ShoppingFeaturePage />} />
                <Route path="/pricing" element={appOnlyMode ? <SatelliteSurfaceRedirect /> : <M09PricingPage />} />
                <Route path="/faq" element={appOnlyMode ? <SatelliteSurfaceRedirect /> : <M10FaqPage />} />
                <Route path="/stories" element={appOnlyMode ? <SatelliteSurfaceRedirect /> : <M11StoriesPage />} />
                <Route path="/about" element={appOnlyMode ? <SatelliteSurfaceRedirect /> : <M12CompanyLegalPage />} />
                <Route path="/contact" element={appOnlyMode ? <SatelliteSurfaceRedirect /> : <M12CompanyLegalPage />} />
                <Route path="/privacy" element={appOnlyMode ? <SatelliteSurfaceRedirect /> : <M12CompanyLegalPage />} />
                <Route path="/terms" element={appOnlyMode ? <SatelliteSurfaceRedirect /> : <M12CompanyLegalPage />} />

                {/* On takolio.com satellite host, `/` renders M01LandingPage directly with zero session redirect */}
                {satelliteMode && <Route path="/" element={<M01LandingPage />} />}

                {/* M01 Landing, A01–A08 Auth & O01–O06 Onboarding */}
                <Route
                  path="/landing"
                  element={
                    !satelliteMode && userId && householdId ? (
                      <Navigate to={isOnboarded ? '/' : '/onboarding'} replace />
                    ) : appOnlyMode ? (
                      <SatelliteSurfaceRedirect />
                    ) : (
                      <M01LandingPage />
                    )
                  }
                />
                <Route
                  path="/auth"
                  element={
                    userId && householdId && !isGuest ? (
                      <Navigate to={isOnboarded ? '/' : '/onboarding'} replace />
                    ) : (
                      <VNextAuthFlowPage />
                    )
                  }
                />
                <Route
                  path="/auth/verify"
                  element={
                    userId && householdId && !isGuest ? (
                      <Navigate to={isOnboarded ? '/' : '/onboarding'} replace />
                    ) : (
                      <VNextAuthFlowPage />
                    )
                  }
                />
                <Route
                  path="/onboarding/*"
                  element={
                    userId && householdId ? (
                      isOnboarded ? (
                        <Navigate to={primaryGoal === 'week' ? '/planner/new' : '/'} replace />
                      ) : (
                        <VNextOnboardingFlowPage />
                      )
                    ) : (
                      <Navigate to={unauthEntryPath} replace />
                    )
                  }
                />

                {/* Core App Shell (C01–C30, U01–U10) */}
                <Route
                  element={
                    userId && householdId ? <AppLayout /> : <Navigate to={unauthEntryPath} replace />
                  }
                >
                  <Route
                    path="/"
                    element={isOnboarded ? <C01HomePage /> : <Navigate to="/onboarding" replace />}
                  />
                  <Route path="/search" element={<C02QuickSearchPage />} />

                  {/* Fridge / Inventory */}
                  <Route path="/fridge" element={<C03InventoryPage />} />
                  <Route path="/inventory" element={<Navigate to="/fridge" replace />} />
                  <Route path="/fridge/:id" element={<C06LotDetailPage />} />
                  <Route path="/ingredients/:id" element={<C06LotDetailPage />} />
                  <Route path="/inventory/:id" element={<C06LotDetailPage />} />
                  <Route path="/inventory-reconciliation" element={<C08ReconciliationPage />} />

                  {/* AI Scan & Review */}
                  <Route path="/scan" element={<C09ScanStudioPage />} />
                  <Route path="/scan/:id/review" element={<C12ScanReviewPage />} />
                  <Route path="/scan/receipt-review" element={<C14ReceiptReviewPage />} />
                  <Route path="/scan/result" element={<C12ScanReviewPage />} />

                  {/* Recipes & Guided Cooking Sanctuary */}
                  <Route path="/recipes" element={<C15RecipesDiscoveryPage />} />
                  <Route path="/recipes/:slug" element={<C18RecipeDetailPage />} />
                  <Route path="/recipes/id/:id" element={<C18RecipeDetailPage />} />
                  <Route path="/cook/:slug" element={<C20C21CookingStudioPage />} />
                  <Route path="/cooking/:id" element={<C20C21CookingStudioPage />} />
                  <Route path="/cooking/complete" element={<C22CookingCompletePage />} />

                  {/* Legacy /week/* compatibility redirects */}
                  <Route path="/week" element={<WeekHomeRedirect />} />
                  <Route path="/week/setup" element={<WeekSetupRedirect />} />
                  <Route path="/week/generating" element={<Navigate to="/planner" replace />} />
                  <Route path="/week/:planId" element={<WeekPlanRedirect />} />
                  <Route path="/week/:planId/meal/:mealId" element={<WeekMealRedirect />} />
                  <Route path="/week/:planId/shopping" element={<WeekShoppingRedirect />} />
                  <Route path="/week/:planId/settings" element={<Navigate to="/settings/planning" replace />} />

                  {/* Canonical Meal Planner & Shopping */}
                  <Route path="/planner" element={<C23PlannerPage />} />
                  <Route path="/planner/new" element={<C24PlannerSetupPage />} />
                  <Route path="/planner/:planId" element={<C23PlannerPage />} />
                  <Route path="/planner/:planId/meal/:slotId" element={<C25C26PlannerMealPage />} />
                  <Route path="/planner/:planId/shopping" element={<C29ShoppingImportPage />} />
                  <Route path="/shopping" element={<C27C28ShoppingPage />} />

                  {/* Notifications, Profile, Settings, Household & Plus */}
                  <Route path="/notifications" element={<C30NotificationsPage />} />
                  <Route path="/me" element={<U01ProfileHubPage />} />
                  <Route path="/profile" element={<Navigate to="/me" replace />} />
                  <Route path="/me/preferences" element={<U02FoodPrefsPage />} />
                  <Route path="/family" element={<Navigate to="/me/household" replace />} />
                  <Route path="/me/household" element={<U06HouseholdHonestPage />} />
                  <Route path="/settings" element={<Navigate to="/settings/app" replace />} />
                  <Route path="/settings/app" element={<U04AppSettingsPage />} />
                  <Route path="/settings/notifications" element={<U05NotificationPrefsPage />} />
                  <Route path="/settings/planning" element={<U03PlanningSettingsPage />} />
                  <Route path="/settings/privacy" element={<U09U10PrivacyAndDataRightsPage />} />
                  <Route path="/plus" element={<U07U08PlusReadOnlyPage />} />
                  <Route path="/billing/return" element={<BillingReturnPage />} />
                </Route>

                {/* Catch-all fallback (S02 404) */}
                <Route path="*" element={<S02NotFoundPage />} />
              </Routes>
            </Suspense>
          </SessionBoundary>
        </AppErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
};
