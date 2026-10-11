# Exact local validation

Implementation `7ef2f8407d3a6a958c78146db3b5c9a9f0990b78`; Node24, pnpm10.33.2, CI=true,
NODE_OPTIONS=--no-experimental-webstorage, Wrangler metrics=false; remote flags unset.
Final required commands have clean source state before and after. Full tests and build ran sequentially.
Historical scoped agent runs retain their actual Node25 metadata; the final full gates use Node24.

| Receipt | Exact command | Exit | State | Seconds |
| --- | --- | ---: | --- | ---: |
| b01c-typecheck-first | `pnpm run typecheck` | 2 | FAIL | 10.401 |
| b01c-security-first | `pnpm exec vitest run tests/integration/auth-hardening.test.ts tests/integration/browser-security.test.ts tests/integration/auth-me-quota.test.ts tests/integration/t07-security.test.ts tests/unit/auth.test.ts --maxWorkers=2` | 0 | PASS | 13.123 |
| b01c-typecheck-second | `pnpm run typecheck` | 2 | FAIL | 9.786 |
| program-typecheck-third | `pnpm run typecheck` | 2 | FAIL | 9.93 |
| b03a-focused-first | `pnpm exec vitest run tests/unit/scan-v3-evaluator.test.ts tests/unit/scan-v3-dataset.test.ts tests/unit/ai-golden-dataset.test.ts --maxWorkers=2` | 1 | FAIL | 1.693 |
| program-typecheck-fourth | `pnpm run typecheck` | 2 | FAIL | 10.807 |
| b01c-focused-final | `pnpm exec vitest run tests/integration/auth-tenant-adversarial.test.ts tests/integration/auth-hardening.test.ts tests/integration/browser-security.test.ts tests/integration/auth-me-quota.test.ts tests/integration/t07-security.test.ts tests/unit/auth.test.ts --maxWorkers=2` | 0 | PASS | 16.628 |
| b03a-focused-second | `pnpm exec vitest run tests/unit/scan-v3-evaluator.test.ts tests/unit/scan-v3-dataset.test.ts tests/unit/ai-golden-dataset.test.ts --maxWorkers=2` | 0 | PASS | 1.983 |
| b03a-cli-first | `node scripts/scan-v3-eval.mjs --dataset tests/fixtures/scan-v3/dataset.json --predictions tests/fixtures/scan-v3/predictions.json --dry-run --output .artifacts/backend-program-20261011/scan-v3-report-first.json` | 0 | PASS | 0.437 |
| program-lint-first | `pnpm run lint` | 0 | PASS | 5.777 |
| program-typecheck-fifth | `pnpm run typecheck` | 2 | FAIL | 10.099 |
| b06-whole-week-first | `pnpm exec vitest run tests/integration/backend-whole-week.test.ts --maxWorkers=1` | 1 | FAIL | 3.148 |
| b03a-focused-reviewed | `pnpm exec vitest run tests/unit/scan-v3-evaluator.test.ts tests/unit/scan-v3-dataset.test.ts tests/unit/ai-golden-dataset.test.ts --maxWorkers=2` | 0 | PASS | 1.768 |
| b06-whole-week-second | `pnpm exec vitest run tests/integration/backend-whole-week.test.ts --maxWorkers=1` | 1 | FAIL | 3.395 |
| b08-audit-full-first | `pnpm audit --json` | 1 | FAIL | 1.744 |
| b08-audit-prod-first | `pnpm audit --prod --json` | 1 | FAIL | 1.035 |
| b06-whole-week-third | `pnpm exec vitest run tests/integration/backend-whole-week.test.ts --maxWorkers=1` | 0 | PASS | 3.362 |
| b07-contract-before | `pnpm exec vitest run tests/integration/backend-week-read-contract.test.ts --maxWorkers=1` | 1 | FAIL | 2.221 |
| b07-contract-after-first | `pnpm exec vitest run tests/integration/backend-week-read-contract.test.ts --maxWorkers=1` | 1 | FAIL | 2.594 |
| b07-typecheck-first | `pnpm run typecheck` | 2 | FAIL | 10.767 |
| b07-contract-after-second | `pnpm exec vitest run tests/integration/backend-week-read-contract.test.ts tests/integration/week-core-flow.test.ts --maxWorkers=2` | 1 | FAIL | 2.615 |
| b07-contract-after-third | `pnpm exec vitest run tests/integration/backend-week-read-contract.test.ts tests/integration/week-core-flow.test.ts` | 0 | PASS | 3.224 |
| b06-shopping-after-first | `pnpm exec vitest run tests/integration/backend-shopping-cooking.test.ts` | 0 | PASS | 3.352 |
| b04b-cancel-first | `pnpm exec vitest run tests/integration/scan-cancellation.test.ts tests/integration/scan-queue-fencing.test.ts tests/integration/scan-async-quota-lifecycle.test.ts tests/unit/scan-queue.test.ts` | 1 | FAIL | 4.355 |
| b04b-cancel-second | `pnpm exec vitest run tests/integration/scan-cancellation.test.ts tests/integration/scan-queue-fencing.test.ts tests/integration/scan-async-quota-lifecycle.test.ts tests/unit/scan-queue.test.ts tests/unit/ai-task-provider.test.ts tests/unit/ai-runtime-governance.test.ts` | 0 | PASS | 5.025 |
| program-typecheck-mid | `pnpm typecheck` | 2 | FAIL | 14.276 |
| b06-repeat-after-first | `pnpm exec vitest run tests/integration/backend-shopping-cooking.test.ts` | 0 | PASS | 9.401 |
| program-lint-mid | `pnpm lint` | 0 | PASS | 6.862 |
| program-evaluator-final | `node scripts/scan-v3-eval.mjs --dry-run --output .artifacts/backend-program-20261011/scan-v3-report-final.json` | 0 | PASS | 0.663 |
| program-typecheck-after-fixes | `pnpm typecheck` | 0 | PASS | 16.078 |
| b07-contract-generator-first | `node scripts/planner-contract.mjs` | 0 | PASS | 0.678 |
| b07-openapi-focused | `pnpm exec vitest run tests/unit/backend-planner-openapi.test.ts tests/unit/planner-contract.test.ts` | 1 | FAIL | 2.185 |
| b05-mutable-source-fix | `pnpm exec vitest run tests/unit/ingredient-review-source-buffer.test.ts tests/unit/ingredient-review-manifest.test.ts` | 0 | PASS | 2.419 |
| b07-openapi-focused-second | `pnpm exec vitest run tests/unit/backend-planner-openapi.test.ts tests/unit/planner-contract.test.ts` | 0 | PASS | 1.656 |
| b07-openapi-regenerate | `node scripts/planner-contract.mjs` | 0 | PASS | 0.979 |
| b07-openapi-check | `node scripts/planner-contract.mjs --check` | 0 | PASS | 0.555 |
| core-frozen-neighbor | `pnpm exec vitest run tests/integration/auth-tenant-adversarial.test.ts tests/integration/backend-whole-week.test.ts tests/integration/backend-shopping-cooking.test.ts tests/integration/backend-week-read-contract.test.ts tests/integration/scan-cancellation.test.ts tests/unit/scan-route-errors.test.ts tests/unit/scans.test.ts tests/unit/receipt-scan.test.ts tests/integration/scan-response-loss.test.ts tests/integration/inventory-closed-loop-routes.test.ts tests/unit/backend-planner-openapi.test.ts tests/unit/ingredient-review-source-buffer.test.ts` | 0 | PASS | 12.029 |
| program-typecheck-final | `pnpm typecheck` | 2 | FAIL | 13.597 |
| program-lint-final | `pnpm lint` | 0 | PASS | 7.901 |
| program-evaluator-lock-focused | `pnpm exec vitest run tests/unit/scan-v3-evaluator.test.ts tests/unit/scan-v3-dataset.test.ts` | 0 | PASS | 1.956 |
| program-typecheck-recovery | `pnpm typecheck` | 2 | FAIL | 12.856 |
| program-buffer-types-focused | `pnpm exec vitest run tests/unit/ingredient-review-source-buffer.test.ts` | 0 | PASS | 2.206 |
| program-typecheck-recovery-second | `pnpm typecheck` | 0 | PASS | 15.829 |
| program-pilot-generate | `node docs/backend-upgrade/b05a/generate-pilot.mjs` | 0 | PASS | 1.34 |
| program-migrations-final | `pnpm check:migrations` | 0 | PASS | 0.697 |
| program-install-frozen | `pnpm install --frozen-lockfile` | 0 | PASS | 0.726 |
| program-pilot-check | `node docs/backend-upgrade/b05a/generate-pilot.mjs --check` | 0 | PASS | 1.438 |
| program-web-parity | `python3 docs/backend-upgrade/program-20261011/web_asset_parity.py` | 1 | FAIL | 2.289 |
| program-evaluator-lock-cli-first | `node scripts/scan-v3-eval.mjs --dry-run --output .artifacts/backend-program-20261011/scan-v3-report-lock.json` | 0 | PASS | 0.748 |
| program-openapi-consumer-types | `pnpm exec tsc --noEmit --strict --skipLibCheck --moduleResolution bundler --module ESNext --target ES2022 docs/backend-upgrade/b07/contracts/planner-consumer.ts` | 2 | FAIL | 2.577 |
| program-web-parity-recovery | `python3 docs/backend-upgrade/program-20261011/web_asset_parity.py web-parity-recovery` | 1 | FAIL | 22.815 |
| program-openapi-consumer-types-recovery | `pnpm exec tsc -p docs/backend-upgrade/program-20261011/consumer-tsconfig.json --noEmit` | 0 | PASS | 2.362 |
| program-openapi-check | `node scripts/planner-contract.mjs --check` | 0 | PASS | 0.578 |
| program-web-parity-second-recovery | `python3 docs/backend-upgrade/program-20261011/web_asset_parity.py web-parity-second-recovery` | 0 | PASS | 22.846 |
| program-source-freeze | `python3 docs/backend-upgrade/program-20261011/scope_freeze.py source-freeze-first` | 1 | FAIL | 0.14 |
| program-source-freeze-recovery | `python3 docs/backend-upgrade/program-20261011/scope_freeze.py source-freeze-recovery` | 0 | PASS | 0.621 |
| program-full-tests-frozen | `pnpm test` | 1 | FAIL | 141.759 |
| program-typecheck-precommit | `pnpm typecheck` | 0 | PASS | 13.559 |
| program-lint-precommit | `pnpm lint` | 0 | PASS | 6.796 |
| program-auth-payment-fixture-focused | `pnpm exec vitest run tests/integration/payment-authority.test.ts tests/integration/auth-tenant-adversarial.test.ts` | 0 | PASS | 8.284 |
| program-full-tests-committed | `pnpm test` | 130 | FAIL | 605.974 |
| program-lint-committed | `pnpm lint` | 0 | PASS | 18.233 |
| program-typecheck-committed | `pnpm typecheck` | 0 | PASS | 25.661 |
| program-migrations-committed | `pnpm check:migrations` | 0 | PASS | 0.882 |
| program-source-freeze-committed | `python3 docs/backend-upgrade/program-20261011/scope_freeze.py source-freeze-committed` | 0 | PASS | 1.329 |
| program-audit-prod-committed | `pnpm audit --prod --json` | 1 | FAIL | 0.843 |
| program-audit-full-committed | `pnpm audit --json` | 1 | FAIL | 1.126 |
| program-main-readonly-final | `gh api repos/vn-tak/Tako-san/commits/main --jq .sha` | 0 | PASS | 0.698 |
| program-pilot-committed | `node docs/backend-upgrade/b05a/generate-pilot.mjs --check` | 0 | PASS | 1.863 |
| program-openapi-committed | `node scripts/planner-contract.mjs --check` | 0 | PASS | 0.971 |
| program-consumer-committed | `pnpm exec tsc -p docs/backend-upgrade/program-20261011/consumer-tsconfig.json --noEmit` | 0 | PASS | 3.197 |
| program-evaluator-committed | `node scripts/scan-v3-eval.mjs --dry-run --output .artifacts/backend-program-20261011/scan-v3-report-committed.json` | 0 | PASS | 0.949 |
| program-test-discovery-diagnostic | `pnpm exec vitest list --filesOnly` | 0 | PASS | 0.897 |
| program-recipe-seed-local | `pnpm recipe:seed:check` | 0 | PASS | 1.014 |
| program-recipe-refresh-local | `pnpm recipe:refresh:check` | 1 | FAIL | 0.836 |
| program-ingredient-release-local | `pnpm recipe:refresh:release-check` | 1 | FAIL | 1.828 |
| program-recipe-import-local | `pnpm recipe:import:check` | 0 | PASS | 1.491 |
| program-recipe-refresh-sequential | `pnpm recipe:refresh:check` | 0 | PASS | 1.394 |
| program-test-discovery-final | `pnpm exec vitest list --filesOnly` | 0 | PASS | 0.727 |
| program-source-freeze-final-committed | `python3 docs/backend-upgrade/program-20261011/scope_freeze.py source-freeze-final-committed` | 0 | PASS | 0.518 |
| program-typecheck-final-committed | `pnpm typecheck` | 0 | PASS | 13.343 |
| program-lint-final-committed | `pnpm lint` | 0 | PASS | 5.919 |
| program-migrations-final-committed | `pnpm check:migrations` | 0 | PASS | 0.444 |
| program-test-discovery-source-only | `pnpm exec vitest list --filesOnly` | 0 | PASS | 0.694 |
| program-full-tests-final-committed | `pnpm test` | 0 | PASS | 136.404 |
| program-build-final-committed | `pnpm build` | 0 | PASS | 6.534 |

Machine receipts retain timestamps, exact environment, HEAD/source status and raw log SHA256.
Public local/test/migration/build/audit logs are gzip-packed with hashes of compressed and original bytes.
Private scanner reports/logs/source snapshots and binary/venv inputs are intentionally not exported.

Independent review records identify checks actually performed, original findings and verified fixes.
D1 and web parity were captured before the final commit; input hashes/protected Git blobs show the
40 migrations, schema-gate script, web source, package and lock inputs remain byte-identical.
Parity uses fixed timestamp/commit/version/paired flags; final build separately uses the implementation SHA.

The security repository scan binds its exact recorded current-worktree content hash, not a claim
of release cleanliness or coverage after documentation changes. Rerun before promotion.

Initial full:1file/62test failures,308files/7401tests passed. The final run passes all tests.
Auth/payment fixture recovery:2files/126tests PASS; all payment assertions protected.
A second full run was intentionally interrupted (exit130) because copied private scanner tests were discovered.
Snapshot relocation and the runner fix preserve all bytes outside the repository; final discovery lists309 intended tests.
Other retained failures include evaluator denominator fixtures, stale cancellation fixtures, historical
Week normalization, OpenAPI module/alias checks, mutable-buffer TOCTOU, TS narrowing, Unicode Git
path quoting and parity tar/sourcemap dependency paths; their successful corrective runs are recorded.
Parallel recipe CLI helpers also collided in the shared Vite dependency cache (ENOTEMPTY); sequential refresh rerun PASS.
