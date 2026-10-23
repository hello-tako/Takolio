# UI08 Food preferences row33 baseline - 2026-10-24 JST

Implementation `793ade743aecc4cafd0c39f8e1bd3e457f75bc50` on `codex/takolio-v2-rescue`; integration `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`. Read-only canonical main remains `90b94129113b41e34701d99f51175cfa81cb73de`.

| Exact executed command | Actual result |
|---|---|
| `pnpm exec eslint src/web/pages/settings/FoodPreferencesPage.tsx tests/unit/ui08-account.test.tsx tests/e2e/t17-ui/takolio-food-preferences-continuation.e2e.ts` | PASS; existing Admin font warnings apply only to builds (exit0; wall 1.08s) |
| `pnpm exec vitest run tests/unit/ui08-account.test.tsx tests/unit/frontend-services.test.ts tests/unit/ui08-route-scope.test.tsx tests/unit/ui11-navigation.test.tsx tests/unit/onboarding-contract.test.tsx tests/unit/family-preferences-api.test.ts` | PASS 5 files/103 tests in 2.19s; executed filter also included nonexistent family-preferences-api.test.ts, which selected no file; not six files (exit0; wall 2.9s) |
| `pnpm exec vitest run tests/integration/frontend-ui-integration.test.tsx tests/integration/auth-tenant-adversarial.test.ts tests/integration/inventory-closed-loop.test.ts` | PASS 3 files/104 tests in 7.63s (exit0; wall 8.31s) |
| `pnpm lint` | PASS; existing Admin font warnings apply only to builds (exit0; wall 7.65s) |
| `pnpm typecheck` | PASS; existing Admin font warnings apply only to builds (exit0; wall 18.97s) |
| `pnpm check:migrations` | PASS; existing Admin font warnings apply only to builds (exit0; wall 0.55s) |
| `pnpm build` | PASS; existing Admin font warnings apply only to builds (exit0; wall 11.44s) |
| `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` | PASS; existing Admin font warnings apply only to builds (exit0; wall 11.27s) |
| `pnpm audit --json` | OPEN_INHERITED 1 low/6 moderate/1 high, including Vite GHSA-587h-7wmj-h5pm; dependencies unchanged (exit1; wall 1.24s) |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/var/folders/m4/1tyb0d41399gbt62vgxhhsph0000gn/T/ pnpm test` | PARTIAL 410/412 files; 9164/9169 tests; same five inherited encoded-space CLI failures in production-catalog-continuity/release-check; Node24 rerun after Node25 child stalled; see log for test duration (exit1; wall 198.76s) |
| `PREVIEW_MEAL_COMPOSITION_V2=true pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/takolio-food-preferences-continuation.e2e.ts --project=mobile-390 --project=desktop-1440 --output=.artifacts/takeover/food-preferences/after` | PASS 6/6; exact four configs x eight states x two contexts; 64 zero-violation final axe reports with incomplete contrast; 1256 measured controls; real local API roundtrip and offline guest reload (exit0; reported2.4m; shell wall not recorded) |

Browser 6/6 in 2.4m; focused 5 files/103 unit tests (2.19s) and 3 files/104 integration tests (7.63s); targeted ESLint, lint/types, local migrations and default/paired builds PASS. Full suite rerun under v24.16.0: 410/412 files, 9,164/9,169 tests; duration 197.54s (transform 15.86s, setup 4.53s, import 95.05s, tests 1175.07s, environment 24.69s), wall 198.76s. Same five inherited encoded-space CLI failures remain. Initial Node25 suite was interrupted after a stalled synchronous Python child; no completed count claimed for that attempt. Audit retains inherited 1 low/6 moderate/1 high including Vite GHSA-587h-7wmj-h5pm.

268 bound payloads: 128 PNG, 128 axe JSON and twelve summaries. Four viewport/text configs x eight states x two contexts per phase. All 64 final axe reports have zero reported violations with incomplete color-contrast; 1,256 measured controls including disabled actions. Real local PATCH/reload preserves size7, unknown vocabulary and language; pending lock, shaped500 retry and unsaved-discard checks pass. Hard safety, inventory, shopping and onboarding snapshots unchanged. Read/offline monitored journeys make no writes; offline selections survive navigation and reset on reload.

Baseline browser uses identical command with output`.artifacts/takeover/food-preferences/baseline`:4 PASS/2 FAIL in2.1m, offline disclosure only. Harness unchanged; page baseline matches main. Node25 initial `pnpm test` with resolved TMPDIR was interrupted after a child stalled; no complete count claimed. Read-only1s Python/Node samples retained. Focused filter includes one nonexistent path and selects five actual files/103 tests. Exact log/source hashes and environment overrides are in the receipt.

Root-font text200/reduced-motion Chromium and shaped read/write500 do not certify OS zoom, physical devices, screen readers, live providers, full Week-OFF, performance or production. Full-page captures follow trial-control/focus scrolling and can include fixed chrome/skip links; no pixel or owner acceptance claimed.

Recovery, protected-main/evidence/changed-text credential-private-path/whitespace/historical-tail verification run before documentation checkpoint. Next bounded packet: row34 planning settings source/API/browser baseline; preserve revision conflict handling, hard allergen/exclusion authority, current meal plans, household isolation and legacy flag compatibility. Owner/device/manual accessibility review remains open. No push, PR publication, merge, deploy, remote migration or production action.

---

# UI08 Settings row32 baseline - 2026-10-24 JST

Implementation `b7a32b69f19f06bac4dbf7bc6d61ecd3bcce1969` on `codex/takolio-v2-rescue`, integration `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`. Fresh read-only canonical main remains `90b94129113b41e34701d99f51175cfa81cb73de`.

Environment: macOS, Node 25.9.0, pnpm 10.33.2, unchanged dependencies, isolated local Worker/SQLite fixture; external API fetch and service workers blocked. Reduced motion; root-font text simulation.

| Exact executed command | Actual result |
|---|---|
| `pnpm exec eslint src/web/pages/SettingsPage.tsx tests/e2e/t17-ui/takolio-settings-continuation.e2e.ts` | PASS; existing Admin font warnings apply only to builds (exit 0; wall 1.12s) |
| `pnpm exec vitest run tests/unit/ui08-account.test.tsx tests/unit/frontend-services.test.ts tests/unit/ui08-route-scope.test.tsx tests/unit/ui11-navigation.test.tsx` | PASS 4 files/76 tests in 1.38s (exit 0; wall 2.15s) |
| `pnpm exec vitest run tests/integration/frontend-ui-integration.test.tsx tests/integration/auth-tenant-adversarial.test.ts tests/integration/inventory-closed-loop.test.ts` | PASS 3 files/104 tests in 6.85s (exit 0; wall 7.54s) |
| `pnpm lint` | PASS; existing Admin font warnings apply only to builds (exit 0; wall 6.87s) |
| `pnpm typecheck` | PASS; existing Admin font warnings apply only to builds (exit 0; wall 17.2s) |
| `pnpm check:migrations` | PASS; existing Admin font warnings apply only to builds (exit 0; wall 0.54s) |
| `pnpm build` | PASS; existing Admin font warnings apply only to builds (exit 0; wall 10.24s) |
| `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` | PASS; existing Admin font warnings apply only to builds (exit 0; wall 9.89s) |
| `pnpm audit --json` | OPEN_INHERITED 1 low/6 moderate/1 high, including Vite GHSA-587h-7wmj-h5pm; dependencies unchanged (exit 1; wall 1.28s) |
| `TMPDIR=/private/var/folders/m4/1tyb0d41399gbt62vgxhhsph0000gn/T/ pnpm test` | PARTIAL 410/412 files; 9163/9168 tests in 200.86s; five inherited encoded-space CLI failures in production-catalog-continuity/release-check; no timeout (exit 1; wall 201.7s) |
| `PREVIEW_MEAL_COMPOSITION_V2=true pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/takolio-settings-continuation.e2e.ts --project=mobile-390 --project=desktop-1440 --output=.artifacts/takeover/settings/after` | PASS 6/6; 64 zero-violation after axe reports retain incomplete contrast; accepted/dismissed one prompt call with disabled pending action; cache/outbox/reload and failure checks pass (exit 0; test duration 51.4s, shell wall not recorded) |

Initial identical browser command with `--output=.artifacts/takeover/settings/baseline` produced 2 PASS / 4 FAIL in 1.4m. Two harness problems: the generic navigation helper asserted /settings before its valid immediate redirect; synthetic PWA event dispatched before the lazy page listener mounted. Both were corrected before editing product source. Initial harness/log/error contexts/traces remain ignored.

Corrected pre-fix command uses `--output=.artifacts/takeover/settings/baseline-corrected`: 4 PASS / 2 FAIL in 54.3s, only the pending/duplicate PWA assertions. Accepted/dismissed both invoke prompt twice while remaining enabled; rejected once. Corrected harness SHA256 `93105441d5211130c392ea85c60fc211f82fab3b6fec0bd91a08f0a9ace2f9a3` is unchanged in the final 6/6 run. Pre-fix Settings source matches GitHub main. Copy/log hashes are retained in the receipt.

268 bound payloads: 128 PNG, 128 axe JSON, twelve summaries. All 64 final axe reports show zero violations and incomplete contrast; 232 controls measured (including disabled actions). Four viewport/text configs across two contexts and eight states. Accepted/dismissed calls change from two to one with pending action disabled. CacheStorage clears while private localStorage data/outbox and pending shopping projection survive reload; server inventory/shopping snapshots equal. Two automatic queue POST retries per context stay aborted; zero writes is not claimed.

Synthetic PWA events/choice/rejection/standalone test client handling only; service workers blocked. Cache success uses actual CacheStorage; deletion denial is shaped. Root-font scaling/reduced-motion Chromium does not certify native installation, physical devices, OS zoom, screen readers, full Week-OFF, live providers, performance or production. Full-page capture follows focus/trial scrolling, so fixed navigation/skip-link placement is not a pixel acceptance claim.

Full suite duration 200.86s (wall 201.70s); focused units 1.38s, integration 6.85s. Same five inherited encoded-space CLI failures remain in production-catalog-continuity/release-check; no timeout. Existing Admin font build warnings and dependencies/protected release tests/scripts unchanged. Audit remains inherited, not PASS.

Recovery after implementation, `git ls-remote` canonical main, `python3 .artifacts/takeover/audit-scope.py`, `python3 .artifacts/takeover/verify-evidence.py`, changed-text credential/private-path scan, `git diff --check` and historical-tail verification PASS. Eleven final logs and five retained logs bound by `evidence/settings-checks.json`; raw logs and private recovery paths ignored. Next bounded packet: row33 food preferences source/API/browser baseline under UI08, preserving wire fields, allergy/diet/exclusion semantics, household isolation and persistence. Owner/manual accessibility/device review remains open. No push, PR publication, merge, deploy, remote migration or production action.

---

# UI-C7 household baseline - 2026-10-24 JST

Implementation `d9107856888cafd2dc3d0462f4a03595c7b72fa4` on `codex/takolio-v2-rescue`, integration `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`. Read-only canonical main remains `90b94129113b41e34701d99f51175cfa81cb73de`. Original Argon workspace is unchanged; full private snapshot recheck matches 22,763 regular files / 772 symlinks, bytes/modes/links/HEAD/index/status with zero worktree differences and parent permissions 0700.

Environment: macOS; Node 25.9.0; pnpm 10.33.2; unchanged dependencies; existing isolated Worker/SQLite fixtures and actual local guest. External API fetch/service workers blocked. Three final source hashes bind to implementation in `evidence/household-checks.json`.

| Exact executed command | Actual result |
|---|---|
| `pnpm exec eslint src/web/pages/FamilySharingPage.tsx tests/e2e/t17-ui/takolio-family-continuation.e2e.ts` | PASS final source; existing Admin font warnings where applicable (exit 0; wall 1.11s) |
| `pnpm exec vitest run tests/unit/ui08-account.test.tsx tests/unit/frontend-services.test.ts tests/unit/ui08-route-scope.test.tsx tests/unit/ui11-navigation.test.tsx` | PASS 4 files/76 tests in 1.38s (exit 0; wall 2.14s) |
| `pnpm exec vitest run tests/integration/frontend-ui-integration.test.tsx tests/integration/auth-tenant-adversarial.test.ts tests/integration/inventory-closed-loop.test.ts` | PASS 3 files/104 tests in 6.67s (exit 0; wall 7.34s) |
| `pnpm lint` | PASS final source; existing Admin font warnings where applicable (exit 0; wall 6.76s) |
| `pnpm typecheck` | PASS final source; existing Admin font warnings where applicable (exit 0; wall 16.88s) |
| `pnpm check:migrations` | PASS final source; existing Admin font warnings where applicable (exit 0; wall 0.52s) |
| `pnpm build` | PASS final source; existing Admin font warnings where applicable (exit 0; wall 9.82s) |
| `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` | PASS final source; existing Admin font warnings where applicable (exit 0; wall 9.58s) |
| `pnpm audit --json` | OPEN_INHERITED 1 low/6 moderate/1 high including Vite GHSA-587h-7wmj-h5pm; dependencies unchanged (exit 1; wall 2.58s) |
| `PREVIEW_MEAL_COMPOSITION_V2=true pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/takolio-family-continuation.e2e.ts --project=mobile-390 --project=desktop-1440 --output=.artifacts/takeover/household/final` | PASS 6/6 in 19.3s; 24 final zero-violation axe reports retain incomplete contrast; registered/guest monitored journeys have no writes; registered stock/shopping unchanged (exit 0; wall 19.99s) |
| `TMPDIR=/private/var/folders/m4/1tyb0d41399gbt62vgxhhsph0000gn/T/ pnpm test` | PARTIAL 410/412 files; 9163/9168 tests in 192.21s; same five inherited encoded-space CLI failures; no timeout (exit 1; wall 193.09s) |

Test duration: full suite 192.21s (runner wall 193.09s), browser 19.3s (wall 19.99s), focused units 1.38s, integration 6.67s. Five inherited encoded-space CLI failures in production-catalog-continuity/release-check remain, with no timeout; protected release scripts/tests unchanged. Audit retains Vite GHSA-587h-7wmj-h5pm and unchanged dependencies. Existing Admin font build warnings remain.

Baseline had four passing/two failing tests and four guest requested-width failures at 320. Mobile innerWidth expands to 330; desktop scrollWidth reaches 340. Both are measured against requested 320, not just innerWidth. Before PNG/axe/summaries are bound; raw baseline terminal log was not retained. `.last-run.json`, error contexts/traces and debug/debug2 directories remain local without fabricated logs. Earlier passing layout attempt is retained in after.log: three test definitions across two contexts, 6/6 executions in 19.1s. Final unbroken cached name differs from spaced baseline input; its comparison is after-only.

The receipt binds eleven final logs, four retained logs and one baseline artifact. Manifest binds 108 payloads: 48 PNG, 48 axe, twelve summaries. Twenty-four final axe reports have zero violations and incomplete color-contrast. Registered and guest monitored journeys issue no writes after setup; registered inventory/shopping snapshots remain equal. Long-name journey shapes cache and retains after-only stock/shopping reads. Baseline long name has spaces; final is unbroken, so no matched unbroken-name baseline is claimed. Root-font checks do not certify OS zoom, devices or screen readers.

Documentation finalization: `python3 .artifacts/takeover/audit-scope.py`, `python3 .artifacts/takeover/verify-evidence.py`, full private snapshot verifier outside repository, `git diff --check`, source/log hash checks, changed-text credential/private-path scan and historical-tail verification PASS. Historical receipt validation uses immutable Git objects for changed shared CSS; previous CSS retained verbatim. Raw logs/private locations stay ignored.

Next action: bounded row32 App Settings source/API/browser baseline under UI08, preserving cache/outbox/data semantics. Family invite/join/member-list APIs remain unavailable. Owner visual/manual accessibility review, full Week-OFF, physical devices, providers, performance and production remain open. No push, merge, deploy, remote migration or production action.

---

# UI-C7 profile baseline - 2026-10-23 JST

Implementation `6cb0d462813482b8137d975b207d8b530fc55776` on `codex/takolio-v2-rescue`, integration `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`. Read-only canonical main remains `90b94129113b41e34701d99f51175cfa81cb73de`. Original Argon workspace is unchanged; the full private snapshot recheck matches 22,763 regular files / 772 symlinks, bytes/modes/links/HEAD/index/status with zero worktree differences and parent permissions 0700.

Environment: macOS, Node 25.9.0, pnpm 10.33.2, unchanged main dependencies, isolated Worker/SQLite synthetic households and actual local guest session. External fetch/service workers blocked. Product copy and E2E source match the implementation's source hashes in `evidence/profile-checks.json`.

| Exact executed command | Actual result |
|---|---|
| `pnpm exec eslint src/web/pages/ProfilePage.tsx tests/e2e/t17-ui/takolio-profile-continuation.e2e.ts` | PASS final source; existing Admin font build warnings when applicable (exit 0) |
| `pnpm exec vitest run tests/unit/ui08-account.test.tsx tests/unit/frontend-services.test.ts tests/unit/ui08-route-scope.test.tsx tests/unit/ui11-navigation.test.tsx` | PASS 4 files/76 tests in 1.30s (exit 0) |
| `pnpm exec vitest run tests/integration/frontend-ui-integration.test.tsx tests/integration/auth-tenant-adversarial.test.ts tests/integration/inventory-closed-loop.test.ts` | PASS 3 files/104 tests in 6.64s (exit 0) |
| `pnpm lint` | PASS final source; existing Admin font build warnings when applicable (exit 0) |
| `pnpm typecheck` | PASS final source; existing Admin font build warnings when applicable (exit 0) |
| `pnpm check:migrations` | PASS final source; existing Admin font build warnings when applicable (exit 0) |
| `pnpm build` | PASS final source; existing Admin font build warnings when applicable (exit 0) |
| `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` | PASS final source; existing Admin font build warnings when applicable (exit 0) |
| `pnpm audit --json` | OPEN_INHERITED 1 low/6 moderate/1 high; Vite GHSA-587h-7wmj-h5pm; no dependency change (exit 1) |
| `PREVIEW_MEAL_COMPOSITION_V2=true pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/takolio-profile-continuation.e2e.ts --project=mobile-390 --project=desktop-1440 --output=.artifacts/takeover/profile/final` | PASS 6/6 in 42.2s; 48 after PNG/48 zero-violation axe with incomplete contrast; 192 actionable measured controls; no API writes after setup (exit 0) |
| `TMPDIR=/private/var/folders/m4/1tyb0d41399gbt62vgxhhsph0000gn/T/ pnpm test` | PARTIAL 410/412 files; 9163/9168 tests in 185.62s; five inherited encoded-space CLI failures; no timeouts (exit 1) |

Full-suite test duration is 185.62s (runner wall 186.5s); browser test duration 42.2s (runner wall 42.82s). Five inherited encoded-space CLI failures remain in production-catalog-continuity/release-check; no timeout. Audit retains Vite GHSA-587h-7wmj-h5pm; dependencies/protected scripts/tests unchanged. Existing Admin font build warnings remain.

The receipt binds 11 check logs and seven retained logs, including narrower baseline, two heading-expectation harness failures, corrected 3/3 pre-copy baseline, pre/post-implementation recovery and read-only main check. Final evidence: 153 payloads; 48 after PNG/axe and six after summaries, 192 actionable measured controls. All 48 final axe reports retain incomplete contrast; owner/manual review remains pending. Session states do not explicitly set reduced motion. No actual logout commit or payment invocation; destination forms/role/persistence matrices remain subsequent work.

Documentation finalization checks: `python3 .artifacts/takeover/verify-evidence.py`, `python3 .artifacts/takeover/audit-scope.py`, full private snapshot verifier (outside the repository), `git diff --check`, source/log hash checks, changed-text credential/private-path scan and historical-tail checks PASS. Raw outputs and private recovery location remain ignored/local. Prior evidence is unchanged.

Next bounded packet: row31 household/family source/runtime baseline. Device/OS zoom/screen readers/live providers/full Week-OFF/performance/production remain unclaimed.

---

# UI-C8 notifications baseline - 2026-10-23 JST

Environment: macOS, Node v25.9.0, pnpm 10.33.2, unchanged main lockfile. All results are local.

- Implementation: `8c1ad40ec5e63587c8b3b2900d0e683b35a3c794`; product diff is one scoped `overflow-wrap:anywhere` rule.
- Focused existing units: `pnpm exec vitest run tests/unit/ui08-account.test.tsx tests/unit/frontend-services.test.ts tests/unit/ui08-route-scope.test.tsx tests/unit/ui11-navigation.test.tsx` -> 4 files / 76 tests PASS in 1.56s.
- Focused integrations: `pnpm exec vitest run tests/integration/frontend-ui-integration.test.tsx tests/integration/auth-tenant-adversarial.test.ts tests/integration/inventory-closed-loop.test.ts` -> 3 files / 104 tests PASS in 6.86s.
- Static gates: `pnpm lint`, `pnpm typecheck`, targeted notification E2E ESLint, `pnpm check:migrations`, `pnpm build`, and `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` -> PASS.
- Browser: `PREVIEW_MEAL_COMPOSITION_V2=true pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/takolio-notifications-continuation.e2e.ts --project=mobile-390 --project=desktop-1440 --output=.artifacts/takeover/notifications/final2` -> 4/4 PASS in 58.9s.
- Full suite: `TMPDIR=/private/var/folders/m4/1tyb0d41399gbt62vgxhhsph0000gn/T/ pnpm test` -> exit 1, 410/412 files and 9,163/9,168 tests pass in 194.75s. Five inherited encoded-space CLI failures remain in production-catalog-continuity/release-check; no timeout. An earlier `TMPDIR=/tmp pnpm test` also exposed 11 path-form failures and two 5s timeouts; canonical retry removes those environment effects.
- Audit: `pnpm audit --json` exits 1 with inherited 1 low / 6 moderate / 1 high (Vite GHSA-587h-7wmj-h5pm); no dependency change.
- Evidence validation: `python3 .artifacts/takeover/verify-evidence.py` PASS; protected-main audit PASS; private recovery verifier PASS; `git diff --check` PASS.

Evidence limits: local Worker/SQLite and shaped response states do not certify live push, permission prompts, background delivery, OS zoom, physical devices, screen readers, performance or production. All 60 final axe reports retain incomplete color-contrast checks. Raw logs/traces remain ignored.

---

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

## UI-C5 recipe detail on main 90b94129

Implementation:`61150c83e5a97882aaf31d700f01a28f52ed8393`. Same macOS / Node v25.9.0 / pnpm 10.33.2 and unchanged dependencies. Raw logs under ignored `.artifacts/takeover/recipe-detail/`; exact command/outcome/source/log-hash receipt: `evidence/recipe-detail-checks.json`.

Command:

```sh
pnpm lint
```

Exit 0: PASS final source. Log: `lint-final.log`.

Command:

```sh
pnpm typecheck
```

Exit 0: PASS web and Worker final source. Log: `typecheck-final.log`.

Command:

```sh
pnpm check:migrations
```

Exit 0: PASS customer/Admin local smoke; no schema or migration changes. Log: `migrations.log`.

Command:

```sh
pnpm build
```

Exit 0: PASS product source final; existing Admin font warnings; later test-only measurement key correction does not affect build graph. Log: `build-default.log`.

Command:

```sh
VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build
```

Exit 0: PASS product source final; existing Admin font warnings; later test-only measurement key correction does not affect build graph. Log: `build-paired.log`.

Command:

```sh
TMPDIR=/private/var/folders/m4/1tyb0d41399gbt62vgxhhsph0000gn/T/ pnpm test --maxWorkers=4
```

Exit 1: PARTIAL: 410/412 files; 9163/9168 tests pass in 267.91s; five inherited encoded-space CLI path failures only. Log: `full-test.log`.

Command:

```sh
pnpm audit --audit-level=high --json
```

Exit 1: OPEN_INHERITED: 1 low / 6 moderate / 1 high; Vite GHSA-587h-7wmj-h5pm fixed >=6.4.4; dependencies unchanged. Log: `audit.json`.

Command:

```sh
PREVIEW_MEAL_COMPOSITION_V2=true PORT=3292 PREVIEW_API_PORT=8918 pnpm exec playwright test --config=playwright.t17.config.ts --project=mobile-390 tests/e2e/t17-ui/takolio-recipe-detail.e2e.ts tests/e2e/t17-ui/takolio-culinary-experience.e2e.ts --output=.artifacts/takeover/recipe-detail/verified-paired
```

Exit 0: 5/5 PASS, 30.9s; final product/test source; three new recipe tests and two existing culinary tests. Log: `verified-paired.log`.

Command:

```sh
PORT=3292 PREVIEW_API_PORT=8918 pnpm exec playwright test --config=playwright.t17.config.ts --project=mobile-390 tests/e2e/t17-ui/takolio-recipe-detail.e2e.ts --grep 'exact quantities|confirmed exit' --output=.artifacts/takeover/recipe-detail/default-v1
```

Exit 0: 2/2 PASS, 8.1s; default composition V1; quantity/reload and cooking exit. Log: `default-v1.log`.

Focused checks below are transcript-only supporting evidence; their files are also in the final full regression.

```sh
pnpm exec vitest run tests/unit/ui-rebuild-surfaces.test.tsx tests/unit/ui-rebuild-availability.test.ts tests/unit/recipe-servings.test.ts tests/unit/cooking-store.test.ts
```

4 files /27 tests PASS,3.34s; tool transcript only, not independently hashed log.

```sh
pnpm exec vitest run tests/integration/ui03-discovery-api.test.ts tests/integration/meal-planning-presentation-http.test.ts tests/integration/t20-meal-composition-flows.test.ts
```

3 files /69 tests PASS,20.91s; tool transcript only, not independently hashed log.

The full run keeps exactly five inherited failures: one production-catalog-continuity and four release-check cases resolve New%20project instead of the filesystem space, then MODULE_NOT_FOUND. No Admin timeout recurred; no protected tooling was edited. Full suite is PARTIAL. Build/font warnings and dependency findings remain inherited. Builds/full unit graph preceded only the test measurement serialization correction, which is outside that graph; final lint/types/browser repeat the final test source.

Retained attempts:

- `baseline.log`: 2 pass / 1 fail (1.4m); initial harness queried dialog instead of actual alertdialog; not counted as product reproduction.
- `baseline-corrected.log`: 1 fail; corrected alertdialog selector; detail4 -> cooking4 -> reload -> exit returned no servings query and base2; zero API mutations.
- `layout-red.log`: 1 fail; after navigation fix, before CSS fix; nonspace-word range assertion catches split phut) word at 320/text 200.
- `typecheck.log`: exit2 TS2783: duplicate height in test measurements; fixed by viewport object; interactions/assertions/product source unchanged.
- `final-paired.log`: 5/5 PASS,29.8s; before measurement key correction; superseded by final verified-paired evidence.

One local evidence-copy helper initially selected an incorrect directory-name prefix and asserted 0 files; it was corrected to the observed Playwright names, copied 63 after files and verified the66-file manifest. It did not edit product source.

Private snapshot after implementation, protected-main audit, manifests/hash/dimensions/completeness,38 screens, ledger 69/80/12,54 selected-source paths, token/private-path scan and whitespace checks are repeated before documentation commit. Evidence is synthetic; no production/release claim.


## UI-C5 cooking continuation on integration `6276a6b9`

Environment: macOS, Node v25.9.0, pnpm 10.33.2, unchanged dependencies, real isolated Worker/SQLite synthetic API, external fetch blocked.

| Check | Exit / actual result | Log / evidence |
|---|---|---|
| `pnpm lint` | 0, PASS | `.artifacts/takeover/cooking/checks/lint.log` |
| `pnpm typecheck` | 0, web and Worker PASS | `.artifacts/takeover/cooking/checks/typecheck.log` |
| `pnpm check:migrations` | 0, customer/Admin smoke PASS | `.artifacts/takeover/cooking/checks/migrations.log` |
| `pnpm build` | 0, default web/Admin/Worker PASS; existing Admin font warnings | `.artifacts/takeover/cooking/checks/build-default.log` |
| paired build flags | 0, `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` PASS | `.artifacts/takeover/cooking/checks/build-paired-vite-flags.log` |
| targeted ESLint | 0, CookingReview and new E2E PASS | `.artifacts/takeover/cooking/checks/targeted-eslint.log` |
| final paired browser | 0, 10/10 PASS in 1.7m (cooking5, culinary2, detail3) | `evidence/cooking/manifest.json`; `.artifacts/takeover/cooking/checks/verified-paired.log` |
| default-V1 cooking subset | 0, 4/4 PASS in 21.8s | `.artifacts/takeover/cooking/checks/default-v1.log` |
| full `TMPDIR=<canonical> pnpm test --maxWorkers=4` | 1, 410/412 files and 9,163/9,168 tests in 447.30s; five inherited encoded-space CLI failures | `.artifacts/takeover/cooking/checks/test.log` |
| `pnpm audit --audit-level=high` | 1, inherited 1 low / 6 moderate / 1 high; dependencies unchanged | `.artifacts/takeover/cooking/checks/audit.log` |

The first expanded baseline was 4/5 and reproduced the missing servings query; the retained failure remains evidence, not hidden. The private snapshot verification after implementation again reports zero source/snapshot worktree differences. The complete sanitized receipt is `evidence/cooking-checks.json`; cooking screenshots/axe reports are under `evidence/cooking/`.

Exact final browser commands:

```sh
PREVIEW_MEAL_COMPOSITION_V2=true PORT=3292 PREVIEW_API_PORT=8918 pnpm exec playwright test --config=playwright.t17.config.ts --project=mobile-390 tests/e2e/t17-ui/takolio-cooking-continuation.e2e.ts tests/e2e/t17-ui/takolio-culinary-experience.e2e.ts tests/e2e/t17-ui/takolio-recipe-detail.e2e.ts --output=.artifacts/takeover/cooking/verified-paired
PORT=3292 PREVIEW_API_PORT=8918 pnpm exec playwright test --config=playwright.t17.config.ts --project=mobile-390 tests/e2e/t17-ui/takolio-cooking-continuation.e2e.ts --grep 'wall-clock timer|review return|actual-use guards|direct completion' --output=.artifacts/takeover/cooking/default-v1
```

The full test command used the realpath of the local temporary directory for TMPDIR and `pnpm test --maxWorkers=4`; its literal executed command is retained in the check receipt. Retained attempts include the 4/5 product-bug baseline, the initial 7/7 browser run whose nonexistent detail-continuation filename matched no detail file, a successful PREVIEW-only build that did not set Vite flags, the passing baseline typecheck and passing targeted ESLint. Correct final 10/10 browser coverage and actual paired Vite build supersede those narrower attempts. None of these attempts is hidden or counted as broader coverage.

Final documentation checks: `python3 .artifacts/takeover/audit-scope.py` PASS (5,846 unchanged main paths, zero failures); `python3 .artifacts/takeover/verify-evidence.py` PASS (all current and prior manifests/source receipts/log hashes, cooking75 payloads/38PNG/32axe/5summaries/32state-config captures/568 control measurements, ledgers69/81/12, source54, screen38, token/private-path scan); `git diff --check` PASS. The original workspace's private recovery verifier also passed after implementation. No process was listening on the task preview ports3292/8918 at checkpoint cleanup.

## UI-C6 planner continuation on integration `30693884`

Environment: macOS, Node v25.9.0, pnpm 10.33.2, unchanged main dependencies, isolated local Worker/SQLite synthetic household, external fetch/service workers blocked. Final source is `30693884c3b66ebe3d4fcd48fb57100853703826`. The sanitized `evidence/planner-checks.json` binds two source hashes, 13 checks and 13 retained attempts to exact local log sizes/hashes.

| Check | Actual result |
|---|---|
| `pnpm lint`; `pnpm typecheck`; targeted E2E ESLint | Final source PASS |
| `pnpm check:migrations` | Local customer/Admin migration smoke PASS; no schema or remote change |
| `pnpm build` | Default web/Admin/Worker PASS; existing Admin font warnings |
| `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` | Actual paired Vite build PASS |
| Focused planner units | 4 files / 43 tests PASS, 2.21s |
| Final paired browser | 2/2 PASS, 38.3s; nine picker configurations / 36 reachable controls |
| Full unit suite | PARTIAL, 404/412 files, 9,157/9,168 tests, 466.01s |
| Unchanged failed subset retry | PARTIAL, 6/8 files, 413/418 tests, 13.76s; six timeout cases pass; five inherited CLI failures remain |
| `pnpm audit --audit-level=high` | Exit 1; inherited 1 low / 6 moderate / 1 high including Vite GHSA-587h-7wmj-h5pm |
| Canonical Week ON redirect | 1/1 PASS, 45.8s; before final picker specificity correction; routing source unchanged |
| Synthetic Week feature-module OFF keyboard setup | 1/1 PASS, 14.1s; does not certify compiled flag OFF or Week generation |

Exact focused, full-suite and retry commands:

```sh
TMPDIR=/private/tmp pnpm test tests/unit/planner-shopping-share-ui.test.tsx tests/unit/ui06-planner-lifecycle.test.tsx tests/unit/planner-weekly-continuation.test.tsx tests/unit/family-planner-client.test.tsx --maxWorkers=4
TMPDIR=/private/tmp pnpm test --maxWorkers=4
TMPDIR=/private/var/folders/m4/1tyb0d41399gbt62vgxhhsph0000gn/T/ pnpm test tests/integration/admin-owner.test.ts tests/integration/admin-r2-governance.test.ts tests/integration/admin-r2-settings.test.ts tests/integration/admin-staging-test-identities.test.ts tests/unit/production-catalog-continuity.test.mjs tests/unit/release-check.test.mjs tests/unit/staging-d1-catchup-check.test.mjs tests/unit/t21rc2-classification-diagnostics.test.mjs --maxWorkers=2
```

The full run had five inherited encoded-space CLI path failures plus six 5000ms timeouts. Every timeout case passed on retry without source, protected-test or timeout changes. Five CLI cases still resolve `New%20project` incorrectly. A subset retry is not full-suite PASS. The full run preceded the final CSS specificity correction; final browser/lint/types/builds bind to final source. CSS and this E2E file are outside the unit test graph.

Exact final browser and Week commands:

```sh
PREVIEW_MEAL_COMPOSITION_V2=true pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/takolio-planner-continuation.e2e.ts --project=mobile-390 --output=.artifacts/takeover/planner/final
PREVIEW_MEAL_COMPOSITION_V2=true pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/t17-ui.e2e.ts --grep 'week compatibility' --project=mobile-390 --output=.artifacts/takeover/planner/week-compat
pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/t18c-week-compatibility.e2e.ts --project=mobile-390 --output=.artifacts/takeover/planner/week-off
```

Final evidence has 61 payloads (33 PNG, 24 axe reports, 4 summaries). Automatic generation persists seven slots at revision 1; explicit three-day shopping sharing survives reload. Manual setup persists one slot, accepts a component at revision 2 and preserves keyboard focus/escape behavior. Inventory remains unchanged. Nine picker configurations include both 320x420/text200 and 320x568/text200; 36 controls are reachable/actionable after scrolling. Five other states each have three configurations. All 24 axe reports record zero violations while retaining incomplete color-contrast in 24 and aria-prohibited-attr in 12. Manual accessibility and owner visual acceptance remain pending.

Retained attempts preserve the initial selector/loading/timestamp/accessible-name harness failures, the real before failure, an eight-configuration pass under superseded short-height CSS, the later 320x568/text200 failure, and geometry evidence showing Tailwind utilities still overriding nested result overflow. Final selector specificity fixes the measured issue. Five earlier static/build checks also remain hashed. The stopped legacy attempt used a stale Takosan onboarding selector and has no recoverable complete counts; no additional legacy cases are claimed PASS. All 13 retained logs and all 13 check logs must verify without changing historical evidence.

The private recovery receipt remains bound separately to Planner implementation. Prior cooking source, recovery receipt, reports and logs remain historical and unchanged. No production action occurred.

Final Planner documentation validation: `python3 .artifacts/takeover/audit-scope.py` PASS (5,845 unchanged main paths, zero failures); `python3 .artifacts/takeover/verify-evidence.py` PASS (all earlier manifests retained; Planner 61 payloads / 33 PNG / 24 axe with incomplete rule counts preserved / 4 summaries / 24 state-config captures / 36 controls / 13 check logs / 13 retained logs / recovery binding; ledgers69/83/12, selected source54, screens38, credential/private-path scan); `git diff --check` PASS. Three handoff files retain their prior historical tails byte-for-byte.

## UI-C6 saved Shopping continuation on integration9dad1494

Environment:macOS,Node25.9.0,pnpm10.33.2;unchanged main dependencies;isolated Worker/SQLite synthetic household;external fetch/service workers blocked. Implementation:`9dad1494dab2719eb3f787ab161ab49748bd30d4`. Receipt `evidence/shopping-checks.json` binds14check logs/12retained logs and two source hashes. Raw output stays under ignored `.artifacts/takeover/shopping/`.

| Check | Actual result |
|---|---|
| `pnpm lint`;`pnpm typecheck`;targeted E2E ESLint | PASS;repeated final lint/types after final harness adaptations |
| `pnpm check:migrations` | PASS local customer/Admin smoke;no schema or remote apply |
| `pnpm build` | PASS final product CSS;existing Admin font warnings |
| `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` | PASS actual paired Vite build |
| Focused existing units | PASS4files/61tests,2.62s |
| Focused existing integration | PASS3files/53tests,8.12s |
| Frozen final browser | PASS4/4,reported1.4m;separate mobile/desktop contexts |
| Full unit suite | PARTIAL410/412files;9,163/9,168tests;360.97s test duration(361.98s runner wall time) |
| `pnpm audit --audit-level=high` | Exit1;inherited1low/6moderate/1high;Vite GHSA-587h-7wmj-h5pm |

Exact focused/full/browser commands:

```sh
pnpm test tests/unit/ui06-shopping.test.ts tests/unit/shopping-demand-review-ui.test.tsx tests/unit/shopping-demand-review-service.test.ts tests/unit/shopping-hardening.test.ts --maxWorkers=4
pnpm test tests/integration/shopping-demand-review.test.ts tests/integration/family-shopping-input-fences.test.ts tests/integration/family-shopping-reconciliation.test.ts --maxWorkers=4
TMPDIR=/private/tmp pnpm test --maxWorkers=4
pnpm exec eslint tests/e2e/t17-ui/takolio-shopping-continuation.e2e.ts
PREVIEW_MEAL_COMPOSITION_V2=true pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/takolio-shopping-continuation.e2e.ts --project=mobile-390 --project=desktop-1440 --output=.artifacts/takeover/shopping/final3
```

The full run has five inherited encoded-space CLI failures (one production-catalog-continuity/four release-check),again attempting `New%20project/.../scripts/release-check.mjs`. No timeouts occurred;protected scripts/tests unchanged. Builds/full suite use final product CSS before last E2E-only locator/comment/measurement adaptations;final lint/types/ESLint/browser cover committed source. No full-suite or dependency-security pass is claimed.

The real local flows retain fractions/invalid guards/pending controls/edit/reload,keyboard check/delete cancel/confirm,durable125.5g offline projection and honest device/pending labels. Unknown demand retains contributions and no aggregate quantity. Committed first0.5pack response loss followed by identical key/payload returns actual200/200 receipt replay and one purchase row;concurrent same-household revision yields real409 and explicit reload. Inventory unchanged throughout.

Final evidence:195payloads(95PNG/95axe/5summaries),including seven before screenshots/seven failing contrast reports/one saved summary. After:88captures/88zero-violation axe/four summaries across mobile/desktop. Seven configs for five states plus three compact configs for offline/uncertain/stale yield44captures per context.154enabled dialog controls are measured reachable/actionable after scrolling.38after axe reports retain incomplete contrast;manual accessibility remains pending. Synthetic root-font scaling is not OS zoom;viewport changes within mobile context retain mobile emulation. Full-page modal screenshots precede per-control scrolling.

Retained raw attempts:interrupted hung select(no complete counts);port3000 startup failure(no tests);two selector failures;baseline two failures(actual checked-row contrast and incorrect unknown-aggregate harness assumption);1pass/1fail42.6s with insufficient initial CSS(4.44:1 action contrast);narrower2/2mobile pass40.6s;3pass/1fail1.9m desktop extension interrupted when report writes triggered Vite page reload;earlier static gates/ESLint. Frozen final4/4 supersedes the interrupted capture. An exploratory ESLint invocation including CSS produced ignored-file warning;it is not CSS lint certification. Logs are preserved without altering old receipts.

Private recovery was reverified after implementation:22,763regular files/772symlinks,bytes/modes/links/HEAD/index/status,zero worktree differences,parent0700. Prior saved-recipe CSS receipt stays historically bound to its implementation;the Shopping receipt binds current CSS. Earlier source/evidence/three handoff historical tails remain intact. No production or remote write occurred.
