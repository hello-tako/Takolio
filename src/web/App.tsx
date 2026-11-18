import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { SessionBoundary } from './components/common/SessionBoundary';
import { RouteFallback } from './components/common/RouteFallback';
import { SystemStatusPage } from './components/common/SystemStatusPage';
import { useAuthStore } from './stores/useAuthStore';
import { AppLayout } from './components/layout/AppLayout';
import { isMealPlannerEnabled } from './features/planner/feature';
import { MotionProvider } from './design-system/motion-provider';
import { VerifyRouteLifecycle } from './features/auth/VerifyRouteLifecycle';
import {
  A02LoginPilot,
  C01HomePilot,
  C02QuickSearchVNext,
  C03InventoryPilot,
  C06LotDetailVNext,
  C08ReconciliationVNext,
  C09ScanStudioVNext,
  C12ScanReviewVNext,
  C14ReceiptReviewVNext,
  C15RecipesDiscoveryVNext,
  C18RecipeDetailPilot,
  C20C21CookingStudioVNext,
  C22CookingCompleteVNext,
  C23PlannerPilot,
  C24PlannerSetupVNext,
  C25C26PlannerMealVNext,
  C27C28ShoppingVNext,
  C29ShoppingImportVNext,
  C30NotificationsVNext,
  M01LandingPilot,
  NotFoundEntry,
  O03HouseholdPilot,
  U01ProfileHubVNext,
  U02FoodPrefsVNext,
  U03PlanningSettingsVNext,
  U04AppSettingsVNext,
  U05NotificationPrefsVNext,
  U06HouseholdHonestPage,
  U07U08PlusReadOnlyWrapper,
  U09U10PrivacyAndDataRightsPage,
  withVNextPilot,
} from './vnext/pilot-router';

const VNextSystemStatePage = lazy(() =>
  import('./vnext/screens/AccountAndSystemPages').then((m) => ({ default: m.VNextSystemStatePage })),
);

const G02ReviewHubPage = lazy(() =>
  import('./vnext/screens/G02ReviewHubPage').then((m) => ({ default: m.G02ReviewHubPage })),
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

const PlannerPage = lazy(() =>
  import('./pages/PlannerPage').then((m) => ({ default: m.PlannerPage })),
);

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })),
);
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const OnboardingPage = lazy(() =>
  import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
);
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const InventoryPage = lazy(() =>
  import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage })),
);
const IngredientDetailPage = lazy(() =>
  import('./pages/IngredientDetailPage').then((m) => ({ default: m.IngredientDetailPage })),
);
const ReconciliationPage = lazy(() =>
  import('./pages/ReconciliationPage').then((m) => ({ default: m.ReconciliationPage })),
);
const ScanPage = lazy(() => import('./pages/ScanPage').then((m) => ({ default: m.ScanPage })));
const ScanResultPage = lazy(() =>
  import('./pages/ScanResultPage').then((m) => ({ default: m.ScanResultPage })),
);
const ReceiptReviewPage = lazy(() =>
  import('./pages/ReceiptReviewPage').then((m) => ({ default: m.ReceiptReviewPage })),
);
const RecipesPage = lazy(() =>
  import('./pages/RecipesPage').then((m) => ({ default: m.RecipesPage })),
);
const RecipeDetailPage = lazy(() =>
  import('./pages/RecipeDetailPage').then((m) => ({ default: m.RecipeDetailPage })),
);
const CookingModePage = lazy(() =>
  import('./pages/CookingModePage').then((m) => ({ default: m.CookingModePage })),
);
const CookingCompletePage = lazy(() =>
  import('./pages/CookingCompletePage').then((m) => ({ default: m.CookingCompletePage })),
);
const ShoppingPage = lazy(() =>
  import('./pages/ShoppingPage').then((m) => ({ default: m.ShoppingPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const FamilySharingPage = lazy(() =>
  import('./pages/FamilySharingPage').then((m) => ({ default: m.FamilySharingPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const PlusPaywallPage = lazy(() =>
  import('./pages/PlusPaywallPage').then((m) => ({ default: m.PlusPaywallPage })),
);
const FoodPreferencesPage = lazy(() =>
  import('./pages/settings/FoodPreferencesPage').then((m) => ({ default: m.FoodPreferencesPage })),
);
const PlanningSettingsPage = lazy(() =>
  import('./pages/settings/PlanningSettingsPage').then((m) => ({
    default: m.PlanningSettingsPage,
  })),
);
const NotificationPreferencesPage = lazy(() =>
  import('./pages/settings/NotificationPreferencesPage').then((m) => ({
    default: m.NotificationPreferencesPage,
  })),
);
const PrivacyDataPage = lazy(() =>
  import('./pages/settings/PrivacyDataPage').then((m) => ({ default: m.PrivacyDataPage })),
);
const WeekDashboardPage = lazy(() =>
  import('./pages/WeekDashboardPage').then((m) => ({ default: m.WeekDashboardPage })),
);
const WeekSetupPage = lazy(() =>
  import('./pages/WeekSetupPage').then((m) => ({ default: m.WeekSetupPage })),
);
const WeekGeneratingPage = lazy(() =>
  import('./pages/WeekGeneratingPage').then((m) => ({ default: m.WeekGeneratingPage })),
);
const MealDetailPage = lazy(() =>
  import('./pages/MealDetailPage').then((m) => ({ default: m.MealDetailPage })),
);
const WeekShoppingPage = lazy(() =>
  import('./pages/WeekShoppingPage').then((m) => ({ default: m.WeekShoppingPage })),
);
const WeekSettingsPage = lazy(() =>
  import('./pages/WeekSettingsPage').then((m) => ({ default: m.WeekSettingsPage })),
);

const LandingEntry = withVNextPilot(M01LandingPilot, LandingPage);
const AuthEntry = withVNextPilot(A02LoginPilot, AuthPage);
const OnboardingEntry = withVNextPilot(O03HouseholdPilot, OnboardingPage);
const HomeEntry = withVNextPilot(C01HomePilot, HomePage);
const InventoryEntry = withVNextPilot(C03InventoryPilot, InventoryPage);
const LotDetailEntry = withVNextPilot(C06LotDetailVNext, IngredientDetailPage);
const ReconciliationEntry = withVNextPilot(C08ReconciliationVNext, ReconciliationPage);
const ScanEntry = withVNextPilot(C09ScanStudioVNext, ScanPage);
const ScanReviewEntry = withVNextPilot(C12ScanReviewVNext, ScanResultPage);
const ReceiptReviewEntry = withVNextPilot(C14ReceiptReviewVNext, ReceiptReviewPage);
const RecipesEntry = withVNextPilot(C15RecipesDiscoveryVNext, RecipesPage);
const RecipeDetailEntry = withVNextPilot(C18RecipeDetailPilot, RecipeDetailPage);
const CookModeEntry = withVNextPilot(C20C21CookingStudioVNext, CookingModePage);
const CookCompleteEntry = withVNextPilot(C22CookingCompleteVNext, CookingCompletePage);
const PlannerEntry = withVNextPilot(
  C23PlannerPilot,
  PlannerPage,
  (pathname) =>
    pathname === '/planner' ||
    (/^\/planner\/[^/]+\/?$/.test(pathname) && pathname !== '/planner/new'),
);
const PlannerSetupEntry = withVNextPilot(C24PlannerSetupVNext, PlannerPage);
const PlannerMealEntry = withVNextPilot(C25C26PlannerMealVNext, PlannerPage);
const PlannerShoppingEntry = withVNextPilot(C29ShoppingImportVNext, PlannerPage);
const ShoppingEntry = withVNextPilot(C27C28ShoppingVNext, ShoppingPage);
const NotificationsEntry = withVNextPilot(C30NotificationsVNext, NotificationsPage);
const ProfileEntry = withVNextPilot(U01ProfileHubVNext, ProfilePage);
const FoodPrefsEntry = withVNextPilot(U02FoodPrefsVNext, FoodPreferencesPage);
const HouseholdEntry = withVNextPilot(U06HouseholdHonestPage, FamilySharingPage);
const AppSettingsEntry = withVNextPilot(U04AppSettingsVNext, SettingsPage);
const NotificationPrefsEntry = withVNextPilot(U05NotificationPrefsVNext, NotificationPreferencesPage);
const PlanningSettingsEntry = withVNextPilot(U03PlanningSettingsVNext, PlanningSettingsPage);
const PrivacyEntry = withVNextPilot(U09U10PrivacyAndDataRightsPage, PrivacyDataPage);
const PlusEntry = withVNextPilot(U07U08PlusReadOnlyWrapper, PlusPaywallPage);

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed)
      return (
        <SystemStatusPage title="Không thể mở trang này">
          <p role="alert">Vui lòng tải lại ứng dụng để thử lại.</p>
          <button
            className="rounded-xl bg-takosan-green px-4 py-3 text-white"
            onClick={() => window.location.reload()}
          >
            Tải lại
          </button>
        </SystemStatusPage>
      );
    return this.props.children;
  }
}

// Week → Planner compatibility redirects preserve route params. `Navigate`
// does not interpolate params, so each redirect reads them explicitly.
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

export const App: React.FC = () => {
  const { isGuest, isOnboarded, userId, householdId, primaryGoal } = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter useTransitions={false}>
        <MotionProvider>
          <AppErrorBoundary key={`${userId}:${householdId}`}>
            <SessionBoundary>
              <VerifyRouteLifecycle />
              <Suspense fallback={<RouteFallback />}>
                <Routes key={`${userId}:${householdId}`}>
                  {/* Non-destructive G02 Brand & Pilot Preview Routes */}
                  <Route path="/vnext" element={<G02ReviewHubPage />} />
                  <Route path="/vnext/m01" element={<M01LandingPilot />} />
                  <Route path="/vnext/a02" element={<A02LoginPilot />} />
                  <Route path="/vnext/o03" element={<O03HouseholdPilot />} />
                  <Route path="/vnext/states/:stateId" element={<VNextSystemStatePage />} />

                  {/* G03 Public Marketing Website Routes (DDR-001 Option A) */}
                  <Route path="/how-it-works" element={<M02HowItWorksPage />} />
                  <Route path="/features/ai-scan" element={<M03AiScanFeaturePage />} />
                  <Route path="/features/fridge" element={<M04FridgeFeaturePage />} />
                  <Route path="/features/meal-planning" element={<M05MealPlanningFeaturePage />} />
                  <Route path="/features/recipes" element={<M06RecipesFeaturePage />} />
                  <Route path="/features/cooking" element={<M07CookingFeaturePage />} />
                  <Route path="/features/shopping" element={<M08ShoppingFeaturePage />} />
                  <Route path="/pricing" element={<M09PricingPage />} />
                  <Route path="/faq" element={<M10FaqPage />} />
                  <Route path="/stories" element={<M11StoriesPage />} />
                  <Route path="/about" element={<M12CompanyLegalPage />} />
                  <Route path="/contact" element={<M12CompanyLegalPage />} />
                  <Route path="/privacy" element={<M12CompanyLegalPage />} />
                  <Route path="/terms" element={<M12CompanyLegalPage />} />

                  {/* Public / Intro Routes */}
                  <Route
                    path="/landing"
                    element={
                      userId && householdId ? (
                        <Navigate to={isOnboarded ? '/' : '/onboarding'} replace />
                      ) : (
                        <LandingEntry />
                      )
                    }
                  />
                  <Route
                    path="/auth"
                    element={
                      userId && householdId && !isGuest ? (
                        <Navigate to={isOnboarded ? '/' : '/onboarding'} replace />
                      ) : (
                        <AuthEntry />
                      )
                    }
                  />
                  {/* Screen 03: OTP verification is a real route (same state machine). */}
                  <Route
                    path="/auth/verify"
                    element={
                      userId && householdId && !isGuest ? (
                        <Navigate to={isOnboarded ? '/' : '/onboarding'} replace />
                      ) : (
                        <AuthEntry />
                      )
                    }
                  />
                  {/* Screens 04-06 share one draft while the URL owns the visible step. */}
                  <Route
                    path="/onboarding/*"
                    element={
                      userId && householdId ? (
                        isOnboarded ? (
                          <Navigate to={primaryGoal === 'week' ? '/week/setup' : '/'} replace />
                        ) : (
                          <OnboardingEntry />
                        )
                      ) : (
                        <Navigate to="/landing" replace />
                      )
                    }
                  />

                  {/* Core App Shell */}
                  <Route
                    element={
                      userId && householdId ? <AppLayout /> : <Navigate to="/landing" replace />
                    }
                  >
                    <Route
                      path="/"
                      element={isOnboarded ? <HomeEntry /> : <Navigate to="/onboarding" replace />}
                    />
                    <Route path="/search" element={<C02QuickSearchVNext />} />

                    {/* Fridge / Inventory */}
                    <Route path="/fridge" element={<InventoryEntry />} />
                    <Route path="/inventory" element={<Navigate to="/fridge" replace />} />
                    <Route path="/fridge/:id" element={<LotDetailEntry />} />
                    <Route path="/ingredients/:id" element={<LotDetailEntry />} />
                    <Route path="/inventory/:id" element={<LotDetailEntry />} />
                    <Route path="/inventory-reconciliation" element={<ReconciliationEntry />} />

                    {/* AI Scan & Review */}
                    <Route path="/scan" element={<ScanEntry />} />
                    <Route path="/scan/:id/review" element={<ScanReviewEntry />} />
                    <Route path="/scan/receipt-review" element={<ReceiptReviewEntry />} />
                    <Route path="/scan/result" element={<ScanReviewEntry />} />

                    {/* Recipes & Cooking */}
                    <Route path="/recipes" element={<RecipesEntry />} />
                    <Route path="/recipes/:slug" element={<RecipeDetailEntry />} />
                    <Route path="/recipes/id/:id" element={<RecipeDetailEntry />} />
                    <Route path="/cook/:slug" element={<CookModeEntry />} />
                    <Route path="/cooking/:id" element={<CookModeEntry />} />
                    <Route path="/cooking/complete" element={<CookCompleteEntry />} />

                    {/* Planner is canonical when enabled; Week stays the visible
                      compatibility surface while the flag is off. Params are
                      preserved in both redirect directions. */}
                    <Route
                      path="/week"
                      element={
                        isMealPlannerEnabled() ? <WeekHomeRedirect /> : <WeekDashboardPage />
                      }
                    />
                    <Route
                      path="/week/setup"
                      element={isMealPlannerEnabled() ? <WeekSetupRedirect /> : <WeekSetupPage />}
                    />
                    <Route
                      path="/week/generating"
                      element={
                        isMealPlannerEnabled() ? (
                          <Navigate to="/planner" replace />
                        ) : (
                          <WeekGeneratingPage />
                        )
                      }
                    />
                    <Route
                      path="/week/:planId"
                      element={
                        isMealPlannerEnabled() ? <WeekPlanRedirect /> : <WeekDashboardPage />
                      }
                    />
                    <Route
                      path="/week/:planId/meal/:mealId"
                      element={isMealPlannerEnabled() ? <WeekMealRedirect /> : <MealDetailPage />}
                    />
                    <Route
                      path="/week/:planId/shopping"
                      element={
                        isMealPlannerEnabled() ? <WeekShoppingRedirect /> : <WeekShoppingPage />
                      }
                    />
                    <Route
                      path="/week/:planId/settings"
                      element={
                        isMealPlannerEnabled() ? (
                          <Navigate to="/settings/planning" replace />
                        ) : (
                          <WeekSettingsPage />
                        )
                      }
                    />
                    <Route
                      path="/planner"
                      element={
                        isMealPlannerEnabled() ? <PlannerEntry /> : <Navigate to="/week" replace />
                      }
                    />
                    <Route
                      path="/planner/new"
                      element={
                        isMealPlannerEnabled() ? <PlannerSetupEntry /> : <Navigate to="/week" replace />
                      }
                    />
                    <Route
                      path="/planner/:planId"
                      element={
                        isMealPlannerEnabled() ? <PlannerEntry /> : <Navigate to="/week" replace />
                      }
                    />
                    <Route
                      path="/planner/:planId/meal/:slotId"
                      element={
                        isMealPlannerEnabled() ? <PlannerMealEntry /> : <Navigate to="/week" replace />
                      }
                    />
                    <Route
                      path="/planner/:planId/shopping"
                      element={
                        isMealPlannerEnabled() ? <PlannerShoppingEntry /> : <Navigate to="/week" replace />
                      }
                    />

                    {/* Shopping, Profile/Me, Settings, Notifications, Plus, Household */}
                    <Route path="/shopping" element={<ShoppingEntry />} />
                    <Route path="/notifications" element={<NotificationsEntry />} />
                    <Route path="/me" element={<ProfileEntry />} />
                    <Route path="/profile" element={<Navigate to="/me" replace />} />
                    <Route path="/me/preferences" element={<FoodPrefsEntry />} />
                    <Route path="/family" element={<Navigate to="/me/household" replace />} />
                    <Route path="/me/household" element={<HouseholdEntry />} />
                    <Route path="/settings" element={<Navigate to="/settings/app" replace />} />
                    <Route path="/settings/app" element={<AppSettingsEntry />} />
                    <Route
                      path="/settings/notifications"
                      element={<NotificationPrefsEntry />}
                    />
                    <Route path="/settings/planning" element={<PlanningSettingsEntry />} />
                    <Route path="/settings/privacy" element={<PrivacyEntry />} />
                    <Route path="/plus" element={<PlusEntry />} />
                  </Route>

                  {/* Catch-all fallback */}
                  <Route path="*" element={<NotFoundEntry />} />
                </Routes>
              </Suspense>
            </SessionBoundary>
          </AppErrorBoundary>
        </MotionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};
