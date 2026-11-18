# CHANGES.md — Takolio Frontend vNext (`G00–G12` + Legacy UI Purge)

- **Base Commit (`origin/main`):** `87f279a055e028336ea334cc51c7ab4224f30ef4`
- **Feature Branch:** `feat/takolio-vnext-ui-architecture` (**PR #61**: `https://github.com/hello-tako/Takolio/pull/61`)
- **Protected Red-Zone Files Modified:** **`0 / 341`** (verified byte-for-byte via SHA-256 in `tests/unit/vnext-g02-foundation.test.tsx`)

---

## 1. Pure vNext Architecture (`src/web/vnext/**` & `src/admin/vnext/**`)
- `src/web/vnext/feature.ts`: Pure vNext production lock (`BrandDirection = 'a'`, `vnextHref(path)` returns canonical `path`; `?vnext=0`/`?vnext=1` dual-mode preview toggle removed).
- `src/web/vnext/lib/seo.ts`: Dynamic document title, description, canonical link, OpenGraph metadata, `lang="vi"`, and consent-gated local conversion tracker (`M01–M12`).
- `src/web/vnext/styles/tokens.css` & `vnext-adapted.css`: Kitchen Studio Leaf & Coral tokens (`#FFF9F1`, `#196149`, `#C8432B` AA CTA) and scoped inner-surface adaptation.
- `src/web/vnext/components/{VNextIcons.tsx,VNextMedia.tsx,Primitives.tsx,Shells.tsx}`: 53 pure-vector `24×24` SVG icons, `BrandLockup` (`/takolio/vnext/brand/lockup-direction-a.svg`), `MascotIllustration` (8 Bé Mầm Bếp poses + SVG fallback), `VerifiedDishImage` (12 verified recipe slugs + honest bowl placeholder), `PublicMarketingShell`, `AuthFlowShell`, `OnboardingStepShell`, `ConsumerStudioShell`.
- `src/web/vnext/screens/`:
  - `M01LandingPilot.tsx` + `PublicSitePages.tsx` (`M01–M12` Public Website with owner-approved legal copy on `M09/M11/M12`)
  - `AuthFlowPages.tsx` (`A01–A08` Auth Funnel)
  - `OnboardingFlowPages.tsx` (`O01–O06` 6-Step Onboarding)
  - `C01HomePilot.tsx`, `C03InventoryPilot.tsx`, `FridgeAndScanWrappers.tsx` (`C01–C14` Home, Search, Fridge, Reconciliation, AI Scan & Receipt OCR)
  - `C18RecipeDetailPilot.tsx`, `RecipesAndCookPages.tsx` (`C15–C22` Recipes Discovery, Saved, Detail & Native Guided Cooking Sanctuary `C20/C21/C22`)
  - `C23PlannerPilot.tsx`, `PlannerAndShoppingPages.tsx` (`C23–C29` Weekly Planner, Meal Swap, Shopping & Inventory Import)
  - `AccountAndSystemPages.tsx` (`C30`, `U01–U10` including honest `U06` `RFC-001` & `U10` `RFC-002`, read-only `U07/U08` wrapper, and `S01–S08` System States & `404`)
- `src/admin/vnext/{AdminOverviewVNext.tsx,admin-vnext.css}`: Unconditional Admin Console vNext Overview (`AD02`) & Kitchen Studio Control Tower theme (`AD01–AD11`) preserving separate Admin cookie/CSRF/RBAC isolation and keeping `BillingPage.tsx` (`AD06`) 100% untouched.

## 2. Clean Entry & Shell Cutover
- `src/web/App.tsx`: Pure lazy-loaded vNext routing (`DDR-001` Option A public paths, `/week/*` compatibility redirects to `/planner/*`, preserved `SessionBoundary` & `VerifyRouteLifecycle`).
- `src/web/components/layout/AppLayout.tsx`: Minimal `<Outlet />` wrapper + `isKitchenSurface` URL predicate (legacy `RailSidebar`, `BottomNavigationBar`, and `useKitchenShell` purged).
- `src/web/styles/index.css`: Purged 8 legacy CSS `@import`s (`index.css` compiled bundle reduced from `250.23 kB` to `162.37 kB`).
- `src/web/lib/frigo-assets.ts`: Trimmed to retain only `ingredients` & `recipes` maps used by `ingredient-images.ts`.
- `src/admin/App.tsx` & `src/admin/components/AdminShell.tsx`: Unconditional `AdminOverviewVNext` & `.is-vnext-admin` shell class.

## 3. Legacy Frontend Purge Inventory (`164` Obsolete Files Deleted, `0` Red-Zone Files Touched)
1. **20 Replaced Legacy Consumer & Admin Pages (`src/web/pages/**`, `src/admin/pages/**`):**
   - `src/web/pages/{AuthPage,CookingCompletePage,CookingModePage,FamilySharingPage,HomePage,InventoryPage,LandingPage,MealDetailPage,NotificationsPage,OnboardingPage,ProfilePage,RecipeDetailPage,RecipesPage,WeekDashboardPage,WeekGeneratingPage,WeekSettingsPage,WeekSetupPage,WeekShoppingPage}.tsx`
   - `src/web/pages/settings/PrivacyDataPage.tsx`
   - `src/admin/pages/OverviewPage.tsx`
2. **7 Temporary `G02` Preview/Pilot Scaffolding Files:**
   - `src/web/vnext/pilot-router.tsx`
   - `src/web/vnext/screens/{A02LoginPilot,G02ReviewHubPage,O03HouseholdPilot}.tsx`
   - `src/admin/vnext/feature.ts`
   - `public/takolio/vnext/brand/lockup-direction-{b,c}.svg`
3. **48 Legacy Components, Old Mascot, Navigation, Auth Modes & Week-v1 Widgets:**
   - `src/web/components/common/{Badge,EmptyState,Header,IngredientRow,LegacyRecipeCard,LogoutDialog,QuantityStepper,RecipeCard,RecipeMedia,TakoMascot,TakosanIcon,TopBar}.tsx`
   - `src/web/components/cooking/{CookingReview,CookingTechniqueVisual}.tsx`
   - `src/web/components/layout/use-kitchen-shell.ts`
   - `src/web/design-system/{deferred-nav-indicator,legacy-nav-indicator,motion-provider,motion,navigation}.tsx`
   - `src/web/design-system/assets/icons-src/{fridge,home,meal-plan,profile,recipe,scan}.svg` (`6` files)
   - `src/web/design-system/assets/icons/{fridge,home,meal-plan,profile,recipe,scan}.svg` (`6` files)
   - `src/web/features/auth/{AuthField,AuthShell,ForgotPasswordMode,LoginMode,OtpMode,RegisterMode,VerifyUnavailable}.tsx`
   - `src/web/features/family/FamilyPreferenceSummary.tsx`
   - `src/web/features/week/{MealCard,MealSwapSheet,WeekExportModal,WeekSetupChoices,WeekSummaryCards,WeekWorkspace}.tsx`
   - `src/web/lib/logout-ux.ts`
4. **8 Replaced Legacy Stylesheets (`src/web/styles/**`):**
   - `src/web/styles/{frigo-tokens,kitchen-cooking,kitchen-daily,kitchen-entry,kitchen-family,kitchen-recipes,kitchen-shell,kitchen-week}.css`
5. **53 Replaced Legacy Public Frigo Assets (`public/assets/**`, `public/frigo/**` — `public/takolio/v1/**` Red Zone strictly preserved):**
   - `public/assets/{frigo-app-icon.jpg,frigo-logo.svg,hero-banner.jpg,scan-mockup.jpg}` (`4` files)
   - `public/frigo/app-icons/*.png` (`10` files), `public/frigo/brand/*.png` (`4` files), `public/frigo/illustrations/*.png` (`8` files), `public/frigo/reference/*.png` (`4` files), `public/frigo/ui-icons/*.png` (`23` files)
6. **28 Obsolete Legacy-DOM Unit Tests & Fixtures (Replaced by Active vNext Contract Suites):**
   - `tests/fixtures/ui14-legacy/{index.html,main.tsx}` (`2` files)
   - `tests/unit/{auth-funnel-ui,auth-google-credential,auth-guest-transfer-deferred,auth-resend-turnstile,auth-verify-route,inventory-quantity-ui,logout-dialog,logout-ux,onboarding-contract,t13r-b-inventory-conflict,t18c-keyboard-controls,takolio-mascot,ui-rebuild-surfaces,ui02-surfaces,ui07-brand-shell,ui08-account,ui08-onboarding-navigation,ui08-route-scope,ui10-week-presentation,ui10-week-routes,ui11-navigation,ui11-shell-measurement,ui12-recipe-media,ui13-media-review,ui14-deferred-nav,ui15-culinary-upgrade}.test.*` (`26` files)

## 4. Original Brand, Mascot, Culinary & SEO Assets (`public/**`)
- `public/takolio/vnext/**`: `85` production-locked SVG/WebP/PNG assets registered in `docs/handoff/vnext/ASSET_REGISTRY.csv` (`public/takolio/v1/**` untouched).
- `public/sitemap.xml` & `public/robots.txt`: Public Website SEO discovery (`DDR-001` Option A).
