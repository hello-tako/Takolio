import React, { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  LOCALE_CATALOG,
  parseLocaleFromPathname,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../shared/locales';
import type { SiteSsrPayload } from './types/ssr-data';
import { LandingPage } from './pages/LandingPage';
import {
  CompanyLegalPage,
  FaqPage,
  FeatureDetailPage,
  HowItWorksPage,
  PricingPage,
  SatelliteNotFoundPage,
  StoriesIndexPage,
  StoryDetailPage,
} from './pages/MarketingPages';
import { RecipeDetailPage, RecipesHubPage } from './pages/RecipesPages';

function renderLocaleRoutes(locale: SupportedLocale, ssrData?: SiteSsrPayload | null) {
  const prefix = LOCALE_CATALOG[locale].urlPrefix;
  const p = (bare: string) => (bare === '/' ? prefix || '/' : `${prefix}${bare}`);

  return (
    <React.Fragment key={locale}>
      <Route path={p('/')} element={<LandingPage locale={locale} />} />
      <Route path={p('/how-it-works')} element={<HowItWorksPage locale={locale} />} />
      <Route path={p('/features/ai-scan')} element={<FeatureDetailPage locale={locale} featureKey="ai-scan" />} />
      <Route path={p('/features/fridge')} element={<FeatureDetailPage locale={locale} featureKey="fridge" />} />
      <Route path={p('/features/meal-planning')} element={<FeatureDetailPage locale={locale} featureKey="meal-planning" />} />
      <Route path={p('/features/recipes')} element={<FeatureDetailPage locale={locale} featureKey="recipes" />} />
      <Route path={p('/features/cooking')} element={<FeatureDetailPage locale={locale} featureKey="cooking" />} />
      <Route path={p('/features/shopping')} element={<FeatureDetailPage locale={locale} featureKey="shopping" />} />
      <Route path={p('/pricing')} element={<PricingPage locale={locale} ssrData={ssrData} />} />
      <Route path={p('/faq')} element={<FaqPage locale={locale} />} />
      <Route path={p('/stories')} element={<StoriesIndexPage locale={locale} />} />
      <Route path={p('/stories/:slug')} element={<StoryDetailPage locale={locale} />} />
      <Route path={p('/recipes')} element={<RecipesHubPage locale={locale} ssrData={ssrData} />} />
      <Route path={p('/recipes/cuisine/:cuisine')} element={<RecipesHubPage locale={locale} ssrData={ssrData} />} />
      <Route path={p('/recipes/:slug')} element={<RecipeDetailPage locale={locale} ssrData={ssrData} />} />
      <Route path={p('/about')} element={<CompanyLegalPage locale={locale} section="about" />} />
      <Route path={p('/contact')} element={<CompanyLegalPage locale={locale} section="contact" />} />
      <Route path={p('/privacy')} element={<CompanyLegalPage locale={locale} section="privacy" />} />
      <Route path={p('/terms')} element={<CompanyLegalPage locale={locale} section="terms" />} />
    </React.Fragment>
  );
}

/**
 * Ultra-lean, True-SSR Satellite Application Router for `https://takolio.com`.
 * - Static imports only (zero `<Suspense>` hydration flash / zero CLS spike).
 * - Zero auth/store/Zod/Turnstile dependencies.
 * - Supports all 7 global locales (`/` Vietnamese default + `/en`, `/ja`, `/ko`, `/th`, `/zh`, `/it`).
 */
export const SiteApp: React.FC<{ ssrData?: SiteSsrPayload | null }> = ({ ssrData = null }) => {
  const location = useLocation();
  const { locale } = parseLocaleFromPathname(location.pathname);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const meta = LOCALE_CATALOG[locale];
    document.documentElement.lang = meta.bcp47;
    document.documentElement.dir = meta.dir;
  }, [locale]);

  return (
    <Routes>
      <Route path="/landing" element={<Navigate to="/" replace />} />
      {SUPPORTED_LOCALES.map((loc) => renderLocaleRoutes(loc, ssrData))}
      <Route path="*" element={<SatelliteNotFoundPage locale={locale} />} />
    </Routes>
  );
};
