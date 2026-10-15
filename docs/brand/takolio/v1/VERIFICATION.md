# Takolio V1 verification

Date: 2026-10-16 JST. All commands ran locally against synthetic isolated fixtures. No production credentials, OTP delivery, payment settlement, deployment or telemetry mutation was used.

## Gates

| Command | Result | Receipt |
|---|---|---|
| `pnpm lint` | PASS | `work/after-lint-complete.log` |
| `pnpm typecheck` | PASS | `work/after-typecheck-complete.log` |
| `pnpm check:migrations` | PASS | `work/after-migrations.log` |
| `pnpm audit --audit-level=high` | PASS, no known high vulnerabilities | `work/after-audit.log` |
| `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` | PASS | `work/after-build-on-complete.log` |
| `VITE_MEAL_PLANNER_ENABLED=false VITE_MEAL_COMPOSITION_V2_ENABLED=false pnpm build` | PASS | `work/after-build-off.log` |
| `TMPDIR=/private/tmp pnpm test --maxWorkers=2` | PASS, 363 files / 8,470 tests | `work/after-full-test-final.log` |
| stale URL expectation repair suite | PASS, 2 files / 23 tests | `work/after-stale-tests.log` |
| focused Takolio brand suite | PASS, 5 files / 49 tests | `work/after-focused-final2.log` |
| `pnpm brand:icons` | PASS, deterministic manifest regeneration | `work/after-generator-final.log` |
| `pnpm exec playwright test --config playwright.takolio.config.ts` | PASS, 94/94 | `work/after-e2e-final.log` |
| `node scripts/takolio-pwa-check.mjs` | PASS, 3 checks; offline family data intentionally not certified | `work/after-pwa-final.log` |
| `BRAND_FLAG_OFF=true node scripts/brand-v3-state-check.mjs` | PASS, 12 screens (2 routes x 6 widths) | `work/after-flags-off.log` |

## Browser matrix

`final/` contains 198 matched local synthetic screenshots at 320, 375, 390, 768, 1024 and 1440 CSS pixels covering landing, login/register/verify, onboarding, home, fridge, scan/review, receipt review, recipes/detail/nutrition, planner/setup/saved/meal/shopping, cooking, profile, household, settings, notifications, Plus and logout focus. There was one transient axe finding at `scan-review/1024` while confirmation controls were disabled during a 50% opacity transition; the harness was corrected to wait for enabled controls and `scan-review-recheck/` passed with one screen, zero findings and two journeys. This transient receipt is retained; it is not counted as a blanket PASS for the original run.

`states/` contains 15 state checks and two real local journeys (delayed inventory loading/error and cooking completion/inventory confirmation), with zero axe findings. `flags-off/` covers Week empty/setup at all six widths with no overflow or axe findings. `evidence/` and the output visual directory contain matched before/after contact sheets and icon proof.

The shared presentation shell is used by the protected Plus surface; its payment files and payment authority are unchanged, and the isolated payment-authority E2E checks passed. The independent browser audit found no broken images, horizontal overflow, clipped navigation or public brand regressions. The synthetic persisted account name `Frigo Preview` remains customer data and is intentionally excluded from product-copy detection.

## Independent review

Independent code/design/security review by `/root/independent_brand_review` found no open implementation finding after the icon rendering, compact lockup, reverse logo, case and scoped palette fixes. It independently verified the 69 manifest hashes, root token preservation, 24/24 focused compatibility tests, 8,470 unit tests, 94 E2E tests, PWA checks and visual spot checks.

## Known limits

Hosted GitHub CI, authenticated hosted flows, native physical-device installs, legal/trademark clearance, premium 3D mascot finishing and protected payment/Worker copy migration are not certified. GitHub CLI was unauthenticated, so no branch push or draft PR was created.

## Reproducible evidence and retained failures

`evidence/receipts.json` records exact command text, environment, exit codes, log SHA256 and result excerpts. Workspace log paths refer to the outer projectless workspace, not a tracked repo directory; the full local evidence archive includes these logs. The selected evidence JSON and contact sheets are tracked for reviewers.

The first full run failed 11 old V3 URL expectations in ui08/ui09. Assertions now read the canonical contract while retaining route/session behavior checks. The first E2E run was 92/94: onboarding accepted its current URL before the save finished, so an immediate navigation aborted completion. The test now waits for the actual post-onboarding destination; expiry/inventory assertions are unchanged. Targeted 2/2 and complete 94/94 reruns passed. Original logs are retained. Baseline local gates were green at 362 files / 8,465 tests; 18 existing low-contrast family-coverage findings were resolved through the existing semantic text-secondary token.

The 198-screen run has one retained transient finding and a passing focused recheck, rather than a falsified 198/198 PASS. Shopping was recaptured at all six widths after exact brand-case correction. The app has no supported dark theme (no runtime theme toggle or dark-mode styling), so light is the supported matrix. Keyboard focus/Enter and dialog Escape/focus return, one h1, reduced motion, image presence and overflow were checked. Existing touch target authority remains 44 CSS pixels; no claim of exhaustive target-size certification across every interactive element is made.

Typography: 106 required Vietnamese precomposed letters were present in both font families. Existing Nunito subsets total 87,812 bytes; added Plus Jakarta Sans subset is 35,180 bytes. All use font-display swap and local fallbacks. Generated font and SVG hashes, maskable safe-circle pixel check and PNG alpha/dimensions are covered by the focused brand suites. Repeat deterministic generation is hash-stable in this pinned toolchain; cross-platform PNG encoders are compared by decoded pixel bytes.

`git diff --cached --check` returned exit 2 only for unchanged upstream OFL notice CRLF/trailing whitespace in the three imported license copies. These legal notices retain their original bytes; code lint/typecheck remain PASS. This exception is recorded in receipts.
