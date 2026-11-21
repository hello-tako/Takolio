import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../web/lib/query-client';
import { RouteFallback } from '../web/components/common/RouteFallback';

const M01LandingPage = lazy(() =>
  import('../web/vnext/screens/M01LandingPilot').then((m) => ({ default: m.M01LandingPilot })),
);
const M02HowItWorksPage = lazy(() =>
  import('../web/vnext/screens/PublicSitePages').then((m) => ({ default: m.M02HowItWorksPage })),
);
const M03AiScanFeaturePage = lazy(() =>
  import('../web/vnext/screens/PublicSitePages').then((m) => ({ default: m.M03AiScanFeaturePage })),
);
const M04FridgeFeaturePage = lazy(() =>
  import('../web/vnext/screens/PublicSitePages').then((m) => ({ default: m.M04FridgeFeaturePage })),
);
const M05MealPlanningFeaturePage = lazy(() =>
  import('../web/vnext/screens/PublicSitePages').then((m) => ({
    default: m.M05MealPlanningFeaturePage,
  })),
);
const M06RecipesFeaturePage = lazy(() =>
  import('../web/vnext/screens/PublicSitePages').then((m) => ({ default: m.M06RecipesFeaturePage })),
);
const M07CookingFeaturePage = lazy(() =>
  import('../web/vnext/screens/PublicSitePages').then((m) => ({ default: m.M07CookingFeaturePage })),
);
const M08ShoppingFeaturePage = lazy(() =>
  import('../web/vnext/screens/PublicSitePages').then((m) => ({
    default: m.M08ShoppingFeaturePage,
  })),
);
const M09PricingPage = lazy(() =>
  import('../web/vnext/screens/PublicSitePages').then((m) => ({ default: m.M09PricingPage })),
);
const M10FaqPage = lazy(() =>
  import('../web/vnext/screens/PublicSitePages').then((m) => ({ default: m.M10FaqPage })),
);
const M11StoriesPage = lazy(() =>
  import('../web/vnext/screens/PublicSitePages').then((m) => ({ default: m.M11StoriesPage })),
);
const M12CompanyLegalPage = lazy(() =>
  import('../web/vnext/screens/PublicSitePages').then((m) => ({ default: m.M12CompanyLegalPage })),
);
const S02NotFoundPage = lazy(() =>
  import('../web/vnext/screens/AccountAndSystemPages').then((m) => ({
    default: m.S02NotFoundPage,
  })),
);

/**
 * Dedicated Satellite / SEO / GEO Application Router for `https://takolio.com`.
 * Zero session boundary, zero auth cookie dependency, instant public hydration.
 */
export const SiteApp: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter useTransitions={false}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<M01LandingPage />} />
          <Route path="/landing" element={<Navigate to="/" replace />} />
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
          <Route path="*" element={<S02NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </QueryClientProvider>
);
