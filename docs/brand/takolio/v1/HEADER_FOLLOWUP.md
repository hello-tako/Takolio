# Takolio V1 header consistency follow-up - 2026-10-16 JST

## User finding

Home, Recipes, Planner Setup and Shopping previously rendered only the 44px `symbol-micro.svg` in the shared kitchen header. That was an intentional compact-header adaptation from ADR-TAKOLIO-001, but it created a visible inconsistency: registration/onboarding showed the Takolio lockup while daily app routes did not.

## Corrective implementation

- `src/web/components/common/KitchenHeader.tsx` now uses the canonical outlined horizontal lockup (`TAKOSAN_KITCHEN.logo`) in the shared header.
- At widths below 375px when a back control is present, the existing outlined wordmark (`TAKOSAN_KITCHEN.wordmark`) is selected through `<picture>` so the name remains legible beside the 44px back, notification and scan controls.
- The horizontal master is rendered at 180px on normal mobile/tablet header contexts, matching the kit's website-header minimum. The narrow wordmark is 120px, matching the kit's wordmark minimum.
- Persistent navigation at 640-1023px keeps the visible horizontal header lockup and the narrow rail keeps the symbol. At >=1024px the desktop rail continues to own the 168px wordmark and the header continues to show the motto.
- No generator, runtime asset, token authority, compact symbol contract, route, business logic, payment source, auth logic, API, database, flag, workflow or production configuration changed.

## Kit comparison

`01_Brand_Guidelines/02_LOGO_USAGE.md` says horizontal is for website headers, icon-only is for avatars/narrow places, wordmark minimum is 120px and horizontal minimum is 180px. The correction follows those rules using the actual outlined masters and preserves their intrinsic aspect ratios. It does not recreate the lettering with live text or crop a reference board.

The supplied kit still describes its Comfortaa-derived glyph geometry as candidate artwork pending official glyph finishing and its mascot as 2D gradient artwork pending premium 3D finishing. Therefore this follow-up improves the verified header variant consistency but does not claim 100% concept-board, legal or premium-3D fidelity.

## QA receipt

- Synthetic local preview: `scripts/takolio-header-check.mjs`, 36 screens across 320, 375, 390, 768, 1024 and 1440px; Home, Recipes, Planner Setup, Shopping, Recipe Detail and shared Plus shell. Before and after runs passed layout checks; after run has 0 axe violations, 0 page errors, 0 broken images and no horizontal overflow.
- Header controls remain at least 44px and do not overlap. Keyboard focus on the branded home link remains visible and Enter navigation passes.
- Focused unit tests: 4 files / 46 tests PASS. `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm check:migrations`, `pnpm brand:icons` pass for this follow-up. Complete `TMPDIR=/private/tmp pnpm test` rerun with bundled Node v24.19.0: 363 files / 8,474 tests PASS, 163.49s, exit 0. The first unadjusted macOS run had 11 existing temporary-directory normalization failures (8,463/8,474 tests passed); the isolated affected two files pass all 93 tests with `TMPDIR=/private/tmp`, matching the documented environment. No production code was edited for this limitation.
- Rebased source inventory: baseline `f7386e6a8d9ef8955cc314daebf4d1aeecf4e5a1`; 116 pre-migration product-copy locations, 25 protected deferred locations after migration. The prior audit entry using `03428467...` is historical and remains retained for provenance.
- Broad `ux_audit.py` was run as a heuristic repository scan: 110 checks passed but the tool exited `FAIL` with 59 cross-repository issues and 1,859 warnings, mostly test fixtures and pre-existing broad heuristics. This is not used as a pass for the targeted header change.

## Review comment reconciliation

The fresh source inventory uses the integrated main baseline. Entry screens are also scoped: LandingPage, AuthShell and OnboardingPage own `.takosan-rebuild` roots even though they sit outside AppLayout's kitchen-route scope. Synthetic measurements verify all three product palettes/fonts; legacy body/root tokens stay protected. `TakosanIcon.strokeWidth` intentionally remains a compatibility no-op because the kit owns SVG geometry. `portable-raster.json` is a historical CI incident receipt, while export hashes live in the runtime asset manifest.

Additional checks: PWA 3/3 PASS; text enlargement/short viewport/error/cooking states 15/15 PASS. A first attempt to build OFF flags into a custom `--outDir` completed the Vite bundle but the existing SW plugin rejected its hardcoded default output token; that command is retained as exit 1. Repeat with the standard repository output directory PASS; paired ON build also PASS and flags-OFF 12/12 states PASS. No build configuration changed.

## Evidence

- `.artifacts/takolio-v1/header-before/observations.json`
- `.artifacts/takolio-v1/header-after/observations.json`
- `docs/brand/takolio/v1/evidence/header-followup/header-comparison-320.png`
- `docs/brand/takolio/v1/evidence/header-followup/header-comparison-390.png`
- `docs/brand/takolio/v1/evidence/header-followup/header-comparison-768.png`
- `docs/ai/DECISIONS.md` ADR-TAKOLIO-002

## Review and release boundary

This is a branch correction for draft PR #79. It is ready for independent review and exact-head CI after commit/push. The owner's approval of the earlier PR does not certify this new commit. No merge, deployment, domain change, payment change or production rollout is performed by this follow-up.
