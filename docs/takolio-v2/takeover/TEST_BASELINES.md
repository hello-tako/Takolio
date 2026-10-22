# Test baselines

Environment: macOS, Node v25.9.0, pnpm 10.33.2, unchanged main lockfile. All results are local.

## Historical salvage baseline (main 0322a919)

These runs predate the main refresh; they are retained as historical comparisons.

| Baseline | Full unit result | Browser result |
|---|---|---|
| Main | 408/410 files; 9,151/9,156 tests pass; five failures | Two takeover tests pass, icon regression test fails |
| Argon WIP disposable snapshot copy | Full unit suite not run | Two takeover tests pass, icon regression test fails |
| Integration | 409/411 files; 9,159/9,164 tests pass; same five failures | Final six tests pass |
| Byte-identical integration copy without spaces in path | 410/411 files; 9,163/9,164 pass; one timeout | Not run |

Executed checks:

- `pnpm lint`: exit 0, repeated after the final E2E evidence extension.
- `pnpm typecheck`: exit 0 for web and Worker, repeated after the final E2E extension.
- `pnpm check:migrations`: exit 0; no migration changed or remotely applied.
- `pnpm build`: exit 0 for web/Admin/Worker; existing Admin font warnings remain.
- `pnpm test`: exit 1 on both main and integration. One failure is in `production-catalog-continuity.test.mjs`, four in `release-check.test.mjs`. Their CLI paths use URL `.pathname` without decoding (`tests/unit/production-catalog-continuity.test.mjs:116`, `tests/unit/release-check.test.mjs:1168`), turning `New project` into `New%20project`. The protected release scripts/tests were retained unchanged.
- `pnpm exec vitest run tests/unit/takosan-brand.test.tsx tests/unit/ui15-culinary-upgrade.test.tsx`: 2 files, 28 tests pass.
- `pnpm test` in the no-space disposable copy: exit 1, one 5-second timeout at `t21rc2t-production-approval.test.mjs:237`. `pnpm exec vitest run tests/unit/t21rc2t-production-approval.test.mjs` then passed 42/42. Combined retry with `tests/unit/release-check.test.mjs` and `tests/unit/production-catalog-continuity.test.mjs` passed 340/340 across three files. Neither retry is a full-suite pass.
- `pnpm audit --audit-level=high`: exit 1, eight inherited vulnerabilities (1 low, 6 moderate, 1 high). High: Vite GHSA-587h-7wmj-h5pm, patched in >=6.4.4. No dependency changes selected.
- `git diff --check`: exit 0; repeated at checkpoint.

Final browser command (exit 0; 6 passed, 1.0 minute):

```sh
PORT=3281 PREVIEW_API_PORT=8907 pnpm exec playwright test --config=playwright.t17.config.ts --project=mobile-390 tests/e2e/t17-ui/takolio-culinary-experience.e2e.ts tests/e2e/t17-ui/takolio-takeover.e2e.ts --output=.artifacts/takeover/integration/complete-browser-results
```

This uses the real isolated local Worker with in-memory SQLite, mock AI, synchronous scan queue, planner ON and composition V2 OFF. Browser external requests and service workers are blocked; external server fetch is disabled. Pending-state tests hold a local POST, capture UI, then release it to the real local API; they do not replace response DTOs. No OTP delivery, live AI, remote payment or production behavior is certified.

Earlier browser attempts are retained as failures, not silently counted as passes: the legacy screenshot baseline failed; main and WIP icon assertions failed; harness iterations hit a hidden revision visibility assertion, route/setup assumptions and an offline lazy-import race. Harness corrections wait for real plan data and load settings before going offline. An accepted five-test run preceded the final six-test extension. The separate icon RED/GREEN run measured the CSS defect and fix.

Raw logs remain under ignored `.artifacts/takeover/`: `main/test.log`, `main-clean/verified-playwright.log`, `wip/verified-playwright.log`, `integration/test.log`, `integration/complete-playwright.log`, `integration/final-lint.log`, `integration/final-typecheck.log`, and `integration-no-spaces/{test,focused-retry,confirmed-retry}.log`. Evidence hashes and sanitized outcomes are tracked; raw traces are local only.

Final staging whitespace check found one extra EOF blank line in the new culinary E2E file; it was removed without executable changes. `git diff --cached --check` then passed. Protected-scope audit and evidence hash/CSV/token-pattern validation also passed before the documentation checkpoint.

Documentation staging exposed CRLF CSV rows, intentional Markdown hard-break spaces and extra EOF lines. CSV line endings were normalized to LF; Markdown hard breaks use backslashes, preserving rendering. JSON companions gained a final newline without changing parsed data; evidence hashes were refreshed for the tracked representation. The original Argon bytes remain in the private snapshot; selected-source hashes record the integration differences.

## UI-C5 recipe filters on main 90b94129

Implementation: `89b0a3312104a4064ad42462098c6bda2802085e`; prior salvage source/docs `279d8af7` / `752ee35a`. Same macOS, Node v25.9.0 and pnpm 10.33.2; dependencies unchanged. Logs are under ignored `.artifacts/takeover/recipe-filters/`.

| Check | Exit / actual result | Log |
|---|---|---|
| `pnpm lint` | 0 | `final-lint.log` |
| `pnpm typecheck` | 0, web and Worker | `final-typecheck.log` |
| `pnpm check:migrations` | 0, customer/Admin local smoke | `migrations.log` |
| `pnpm build` | 0, existing Admin font warnings | `build.log` |
| `pnpm test` with ordinary TMPDIR | 1, 407/412 files; 9,151/9,168 tests pass | `test.log` |
| `pnpm test` with canonical TMPDIR | 1, 410/412 files; 9,163/9,168 tests pass | `canonical-tmp-test.log`, `canonical-tmp-test-receipt.json` |
| Focused regressions, exact command below | 0, six files / 116 tests | `final-focused-regressions.log` |
| Combined browser, exact command below | 0, eight tests / 1.7m | `complete-playwright.log` |
| Recipe-specific browser rerun | 0, two tests / 14.2s | `refined-playwright.log` |
| `pnpm audit --audit-level=high` | 1, inherited eight findings | `dependency-audit.log` |

The ordinary full run's 17 failures comprise the five inherited encoded-space CLI path failures, 11 `/var` versus `/private/var` fixture assertions in t21rc2/t21rc2t production-capture tests, and an Admin settings concurrent-run timeout. The investigated rerun kept all source/assertions unchanged and used `TMPDIR=/private/var/folders/m4/1tyb0d41399gbt62vgxhhsph0000gn/T/` for `pnpm test` (233.53s). The 11 temp-path failures and Admin timeout did not recur; no timeout fix is claimed. The five remaining failures are one production-catalog-continuity case and four release-check cases, again attempting to load `New%20project/.../scripts/release-check.mjs`. These reproduce the historical main path defect; protected scripts/tests were not edited. Full suite remains PARTIAL.

Final focused command (6 files / 116 tests, exit 0):

```sh
pnpm exec vitest run tests/unit/ui03-discovery.test.ts tests/unit/ui02-presentation.test.ts tests/unit/takosan-brand.test.tsx tests/unit/ui15-culinary-upgrade.test.tsx tests/integration/ui03-discovery-api.test.ts tests/integration/inventory-mutation-d1.test.mjs
```

Earlier focused logs contain 44 tests / four files and 27 tests / two files respectively; because their filenames were not captured in those logs, they are retained as supporting evidence only. The final command above provides the exact reproducible focused selection.

Combined browser command (8 tests, exit 0):

```sh
PORT=3282 PREVIEW_API_PORT=8908 pnpm exec playwright test --config=playwright.t17.config.ts --project=mobile-390 tests/e2e/t17-ui/takolio-culinary-experience.e2e.ts tests/e2e/t17-ui/takolio-takeover.e2e.ts tests/e2e/t17-ui/takolio-recipe-discovery.e2e.ts --output=.artifacts/takeover/recipe-filters/complete-browser
```

Recipe-specific rerun used the same ports/config/project, only `tests/e2e/t17-ui/takolio-recipe-discovery.e2e.ts`, and output `.artifacts/takeover/recipe-filters/refined`. Real isolated Worker/SQLite synthetic household, mock AI and external-fetch blocking are retained. No production calls occurred. Eight axe reports have zero violations; manual keyboard/focus, 44px targets, narrow/text200% wrapping and long search were checked. No screen-reader, OS magnifier, Week OFF, live OTP/AI or LCP/CLS/capacity certification is implied.

Inherited dependency audit remains 1 low / 6 moderate / 1 high (Vite GHSA-587h-7wmj-h5pm, patched >=6.4.4). No dependency or protected release-tool changes were included. Build warnings and initial harness failures remain in local logs. Protected-scope, evidence hashes/CSV/token-pattern checks and staged whitespace checks are repeated for the documentation checkpoint.

## UI-C5 saved recipes on main 90b94129

Implementation: `f11a244ca0964a63618c1fc3a3f30b8a670ec90a`. Same macOS, Node v25.9.0, pnpm 10.33.2 and unchanged dependencies. Raw logs below are under ignored `.artifacts/takeover/saved-recipes/`; sanitized command/outcome/log-hash receipt is `evidence/saved-recipes-checks.json`.

| Check | Exit / actual result | Log |
|---|---|---|
| `pnpm lint` | 0, final after CSS fix | `final-lint.log` |
| `pnpm typecheck` | 0, web and Worker, final after CSS fix | `final-typecheck.log` |
| `pnpm check:migrations` | 0, customer and Admin local smoke | `migrations.log` |
| `pnpm build` | 0, final default build | `final-build-default.log` |
| `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` | 0, final paired build | `final-build-paired.log` |
| Canonical-TMPDIR `pnpm test` | 1, 406/412 files; 9,159/9,168 tests pass | `full-test.log` |
| Canonical-TMPDIR `pnpm test --maxWorkers=4` | 1, 410/412 files; 9,163/9,168 tests pass, 286.03s, final source | `final-full-test.log` |
| Focused family command below | 0, four files / 49 tests, before final scoped CSS | `focused-family.log` |
| Focused discovery/inventory command below | 0, four files / 88 tests, before final scoped CSS | `focused-regressions.log` |
| Final paired browser command below | 0, six tests / 49.8s, after CSS/geometry guards | `verified-paired.log` |
| Default composition V1 browser subset below | 0, two tests / 19.0s | `default-v1.log` |

Both full runs used `TMPDIR=/private/var/folders/m4/1tyb0d41399gbt62vgxhhsph0000gn/T/`. The initial full run (291.91s), concurrent with other checks, failed the inherited five encoded-space CLI cases and four unchanged Admin tests at 5000ms: integration/admin-owner, integration/admin-r2-governance, integration/admin-r2-settings and unit/admin-local-tooling. The complete final run reduces concurrency with --maxWorkers=4, preserves all test source/assertions/timeouts, and leaves only the five path failures. These attempt to load `New%20project/.../scripts/release-check.mjs`, as in the verified main baseline. This is neither an all-PASS result nor proof of an Admin timeout fix. Protected Admin/release scripts and dependencies were not changed. Both final builds retain existing Admin font warnings.

Exact focused commands:

```sh
pnpm exec vitest run tests/unit/family-preferences-favorites-ui.test.tsx tests/unit/family-meal-selection-ui.test.tsx tests/integration/family-preferences-favorites.test.ts tests/integration/family-manual-drafts.test.ts
pnpm exec vitest run tests/unit/ui03-discovery.test.ts tests/unit/ui02-presentation.test.ts tests/integration/ui03-discovery-api.test.ts tests/integration/inventory-mutation-d1.test.mjs
```

Final paired browser command:

```sh
PREVIEW_MEAL_COMPOSITION_V2=true PORT=3282 PREVIEW_API_PORT=8908 pnpm exec playwright test --config=playwright.t17.config.ts --project=mobile-390 tests/e2e/t17-ui/takolio-saved-recipes.e2e.ts tests/e2e/t17-ui/takolio-recipe-discovery.e2e.ts --output=.artifacts/takeover/saved-recipes/verified-paired
```

Default composition V1 subset:

```sh
PORT=3282 PREVIEW_API_PORT=8908 pnpm exec playwright test --config=playwright.t17.config.ts --project=mobile-390 tests/e2e/t17-ui/takolio-saved-recipes.e2e.ts --grep 'persist|tabs' --output=.artifacts/takeover/saved-recipes/default-v1
```

Browser fixtures use the real isolated local Worker/SQLite with synthetic household data, mock AI and external-fetch blocking. Four saved tests cover persistence/search/removal/resave/reload, servings-preserving tabs/detail/planner-empty handoff, keyboard and eight responsive/text configurations. Seventeen axe reports have zero violations; two summary JSONs verify revisions 1 -> 2 -> 3, servings=4 and unchanged inventory. The paired run also repeats the two discovery tests. These are bounded local checks; Week OFF, live OTP/AI, screen reader, OS zoom, full meal-mutation E2E and performance certification are not implied.

Earlier attempts remain recorded. Parent-level `.artifacts/takeover/saved-recipes-before.log` had one pass/two failures due to initial harness assumptions about the discovery accessible name and the composition flag; `saved-recipes-baseline-paired.log` then confirmed servings losses, while also exposing an incorrect manual-radio label assumption. After harness correction and the servings fix, `saved-recipes-after-focused.log` passed three tests; `saved-recipes-final-paired.log` passed six tests before geometry guards. Its screenshots exposed clipped action text at 200% and a shrunken close icon. In the saved-recipes subdirectory, `layout-before.log` stopped at preview bootstrap routing before UI coverage; `layout-red.log` reached the UI and failed close SVG width 11.140625px against >=20px. The final scoped CSS and text-range/SVG guards pass in `verified-paired.log`. No failed harness run is counted as a successful behavior baseline.

Private snapshot verification, protected-main audit, evidence hashes/dimensions/completeness, 38 screen rows, CSV counts (69/79/12), selected-source hashes, token/private-path pattern scan and whitespace validation pass for this checkpoint. Dependency audit is inherited from the recipe-filter checkpoint (eight findings); it was not rerun here. No remote write or production mutation occurred.
