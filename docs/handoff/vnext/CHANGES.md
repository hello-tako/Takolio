# CHANGES.md — Takolio Frontend vNext (`G00–G12`) Change Inventory

- **Base Commit (`origin/main`):** `87f279a055e028336ea334cc51c7ab4224f30ef4`
- **Feature Branch:** `feat/takolio-vnext-ui-architecture`
- **Protected Red-Zone Files Modified:** **`0 / 341`** (verified via SHA-256 in `tests/unit/vnext-g02-foundation.test.tsx`)

## 1. Consumer Web vNext Architecture (`src/web/vnext/**`)
- `src/web/vnext/feature.ts`: Dual-mode rollback-safe activation (`PROD` default `true`, `?vnext=1` opt-in, `?vnext=0` / `VITE_VNEXT_UI_PREVIEW=false` instant rollback, `MODE==='test'` safe compatibility) + locked Direction A.
- `src/web/vnext/pilot-router.tsx`: Reversible `withVNextPilot` route dispatcher.
- `src/web/vnext/lib/seo.ts`: Dynamic document title, description, canonical link, OpenGraph metadata, `lang="vi"`, and consent-gated local conversion tracker (`M01–M12`).
- `src/web/vnext/styles/tokens.css` & `vnext-adapted.css`: Kitchen Studio Leaf & Coral tokens (`#FFF9F1`, `#196149`, `#C8432B` AA CTA) and scoped inner-surface adaptation.
- `src/web/vnext/components/{VNextIcons.tsx,VNextMedia.tsx,Primitives.tsx,Shells.tsx}`: 53 pure-vector `24×24` SVG icons, `BrandLockup`, `MascotIllustration` (8 Bé Mầm Bếp poses + SVG fallback), `VerifiedDishImage` (12 verified recipe slugs + honest bowl placeholder), `PublicMarketingShell`, `AuthFlowShell`, `OnboardingStepShell`, `ConsumerStudioShell`.
- `src/web/vnext/screens/`:
  - `M01LandingPilot.tsx` + `PublicSitePages.tsx` (`M01–M12` Public Website)
  - `A02LoginPilot.tsx` + `AuthFlowPages.tsx` (`A01–A08` Auth Funnel)
  - `O03HouseholdPilot.tsx` + `OnboardingFlowPages.tsx` (`O01–O06` 6-Step Onboarding)
  - `C01HomePilot.tsx`, `C03InventoryPilot.tsx`, `FridgeAndScanWrappers.tsx` (`C01–C14` Home, Search, Fridge, Reconciliation, AI Scan & Receipt OCR)
  - `C18RecipeDetailPilot.tsx`, `RecipesAndCookPages.tsx` (`C15–C22` Recipes Discovery, Saved, Detail & Native Guided Cooking Sanctuary `C20/C21/C22`)
  - `C23PlannerPilot.tsx`, `PlannerAndShoppingPages.tsx` (`C23–C29` Weekly Planner, Meal Swap, Shopping & Inventory Import)
  - `AccountAndSystemPages.tsx` (`C30`, `U01–U10` including honest `U06` `RFC-001` & `U10` `RFC-002`, read-only `U07/U08` wrapper, and `S01–S08` System States & `404`)
  - `G02ReviewHubPage.tsx` (`/vnext` Design System & Asset Inspection Board)

## 2. Admin Console vNext Alignment (`src/admin/vnext/**`)
- `src/admin/vnext/{feature.ts,AdminOverviewVNext.tsx,admin-vnext.css}`: Separate Admin Console visual alignment (`AD01–AD11`) preserving Admin cookie/CSRF/RBAC isolation and keeping `BillingPage.tsx` (`AD06`) 100% untouched.

## 3. Minimal Reversible Shell Hooks (`4` Existing Files)
- `src/web/App.tsx`: Lazy route registrations (`DDR-001` Option A public paths + `withVNextPilot` wrappers + `S02` 404 fallback).
- `src/web/components/layout/AppLayout.tsx`: Delegates to vNext shell when `isVNextConsumerPilotActive` is true; adds `/search` to `isKitchenSurface`.
- `src/admin/App.tsx` & `src/admin/components/AdminShell.tsx`: Reversible vNext overview & theme hook.

## 4. Original Brand, Mascot, Culinary & SEO Assets (`public/**`)
- `public/takolio/vnext/**`: `87` registered SVG/WebP/PNG assets (`public/takolio/v1/**` untouched).
- `public/sitemap.xml` & `public/robots.txt`: Public Website SEO discovery (`DDR-001` Option A).

## 5. Tests & Handoff Ledger (`tests/**`, `docs/**`)
- `tests/unit/vnext-g02-foundation.test.tsx`: 9 comprehensive automated checks (341 protected-file SHA-256 hashes, 85-screen matrices, pure-SVG audit, canonical recipe slug check, 53 icons, and `G03–G09` component mounts).
- `docs/handoff/vnext/**` & prepended checkpoints in `docs/ai/{CURRENT_STATE,TASK_BOARD,HANDOFF}.md`.
