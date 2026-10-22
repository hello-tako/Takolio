# Test baselines

Environment: macOS, Node v25.9.0, pnpm 10.33.2, unchanged main lockfile. All results are local.

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
