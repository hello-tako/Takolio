# Executed local validation

This immutable packet binds the implementation SHA recorded in validation.json.
Commands run with Node24, NODE_OPTIONS=--no-experimental-webstorage, CI=true,
Wrangler metrics disabled and remote-check flags unset. Original failures remain.

| Receipt | Command | Exit | Status | Seconds |
| --- | --- | --- | --- | --- |
| b08-audit-full-residual | `pnpm audit --json` | 1 | FAIL | 0.609 |
| b08-brand-regression-efficient | `pnpm exec vitest run tests/unit/ui07-brand-exports.test.mjs tests/unit/takosan-brand.test.tsx --maxWorkers=2` | 0 | PASS | 1.318 |
| b08-brand-regression | `pnpm exec vitest run tests/unit/ui07-brand-exports.test.mjs tests/unit/takosan-brand.test.tsx --maxWorkers=2` | 1 | FAIL | 6.887 |
| b08-brand-semantic-compatibility | `node docs/backend-upgrade/b08-local-remediation/local_compatibility_probe.mjs brand .artifacts/backend-b08-local-remediation/compatibility-brand-semantic` | 0 | PASS | 0.256 |
| b08-brand-sharp-compatibility | `node docs/backend-upgrade/b08-local-remediation/local_compatibility_probe.mjs brand` | 0 | PASS | 0.25 |
| b08-compatible-transitive-refresh | `pnpm update ws brace-expansion --depth 10` | 0 | PASS | 1.085 |
| b08-d1-persistence-compatibility | `node docs/backend-upgrade/b08-local-remediation/local_compatibility_probe.mjs d1` | 0 | PASS | 1.822 |
| b08-final-audit-full | `pnpm audit --json` | 1 | FAIL | 0.825 |
| b08-final-audit-prod | `pnpm audit --prod --json` | 0 | PASS | 0.685 |
| b08-final-brand | `node docs/backend-upgrade/b08-local-remediation/local_compatibility_probe.mjs brand .artifacts/backend-b08-local-remediation/compatibility-brand-final` | 0 | PASS | 0.257 |
| b08-final-build | `pnpm build` | 0 | PASS | 7.675 |
| b08-final-built-pwa | `node docs/backend-upgrade/b08-local-remediation/local_compatibility_probe.mjs pwa .artifacts/backend-b08-local-remediation/compatibility-pwa-final` | 0 | PASS | 2.955 |
| b08-final-d1 | `node docs/backend-upgrade/b08-local-remediation/local_compatibility_probe.mjs d1 .artifacts/backend-b08-local-remediation/compatibility-d1-final` | 0 | PASS | 1.816 |
| b08-final-frozen-install | `pnpm install --frozen-lockfile` | 0 | PASS | 0.442 |
| b08-final-full-tests | `pnpm exec vitest run --maxWorkers=2` | 0 | PASS | 347.828 |
| b08-final-lint | `pnpm lint` | 0 | PASS | 7.255 |
| b08-final-migrations | `pnpm check:migrations` | 0 | PASS | 0.443 |
| b08-final-native | `node docs/backend-upgrade/b08-local-remediation/local_compatibility_probe.mjs native .artifacts/backend-b08-local-remediation/compatibility-native-final` | 0 | PASS | 0.27 |
| b08-final-scanner-repository | `/opt/homebrew/bin/python3.12 -B docs/backend-upgrade/b08/security/runner.py scan --tools-dir .artifacts/backend-program-20261011/b08-security-downloads --output-dir .artifacts/backend-b08-local-remediation/scanner-final-repository` | 1 | FAIL | 113.803 |
| b08-final-scanner-selftest | `/opt/homebrew/bin/python3.12 -B docs/backend-upgrade/b08/security/runner.py selftest --tools-dir .artifacts/backend-program-20261011/b08-security-downloads --output-dir .artifacts/backend-b08-local-remediation/scanner-final-selftest` | 0 | PASS | 16.161 |
| b08-final-typecheck | `pnpm typecheck` | 0 | PASS | 13.671 |
| b08-first-audit-full | `pnpm audit --json` | 1 | FAIL | 1.098 |
| b08-first-audit-prod | `pnpm audit --prod --json` | 1 | FAIL | 0.675 |
| b08-first-build | `pnpm build` | 0 | PASS | 7.593 |
| b08-first-full-tests | `pnpm test` | 1 | FAIL | 133.235 |
| b08-first-typecheck | `pnpm typecheck` | 2 | FAIL | 10.395 |
| b08-fixed-date-types | `python3 docs/backend-upgrade/b08-local-remediation/fixed_date_types.py` | 0 | PASS | 3.414 |
| b08-frozen-install | `pnpm install --frozen-lockfile` | 0 | PASS | 0.448 |
| b08-isolated-wrangler4-d1 | `python3 docs/backend-upgrade/b08-local-remediation/isolated_local_d1.py` | 0 | PASS | 12.253 |
| b08-local-cli-probe | `python3 docs/backend-upgrade/b08-local-remediation/local_cli_probe.py` | 0 | PASS | 9.797 |
| b08-migrations-local | `pnpm check:migrations` | 0 | PASS | 0.467 |
| b08-native-compatibility | `node docs/backend-upgrade/b08-local-remediation/local_compatibility_probe.mjs native` | 0 | PASS | 0.133 |
| b08-nested-selector-install | `pnpm install --no-frozen-lockfile` | 0 | PASS | 1.101 |
| b08-owner-install-recovery | `pnpm install --no-frozen-lockfile` | 0 | PASS | 3.413 |
| b08-owner-install | `pnpm install` | 1 | FAIL | 0.3 |
| b08-parser-focused-final | `pnpm exec vitest run tests/integration/frontend-ui-integration.test.tsx` | 0 | PASS | 2.727 |
| b08-parser-pinned-targeted-final | `/opt/homebrew/bin/python3.12 -B /tmp/takosan-b08-parser-targeted-recovery-final.py` | 0 | PASS | 5.665 |
| b08-parser-pinned-targeted-recovery | `/opt/homebrew/bin/python3.12 -B /tmp/takosan-b08-parser-targeted-recovery.py` | 1 | FAIL | 5.662 |
| b08-precommit-lint | `pnpm lint` | 0 | PASS | 6.602 |
| b08-precommit-typecheck | `pnpm typecheck` | 0 | PASS | 13.67 |
| b08-recipe-import | `pnpm recipe:import:check` | 0 | PASS | 1.161 |
| b08-recipe-refresh | `pnpm recipe:refresh:check` | 0 | PASS | 1.467 |
| b08-recipe-release-blockers | `pnpm recipe:refresh:release-check` | 1 | FAIL | 1.41 |
| b08-recipe-seed | `pnpm recipe:seed:check` | 0 | PASS | 0.825 |
| b08-refined-audit-full | `pnpm audit --json` | 1 | FAIL | 1.074 |
| b08-refined-audit-prod | `pnpm audit --prod --json` | 0 | PASS | 0.967 |
| b08-refined-lint | `pnpm lint` | 0 | PASS | 6.842 |
| b08-refined-owner-install | `pnpm install --no-frozen-lockfile` | 0 | PASS | 1.879 |
| b08-refined-typecheck | `pnpm typecheck` | 0 | PASS | 13.797 |
| b08-router-pwa-compatibility-final | `node docs/backend-upgrade/b08-local-remediation/local_compatibility_probe.mjs browser .artifacts/backend-b08-local-remediation/compatibility-browser-final` | 1 | FAIL | 35.565 |
| b08-router-pwa-compatibility-recovery-final | `node docs/backend-upgrade/b08-local-remediation/local_compatibility_probe.mjs browser .artifacts/backend-b08-local-remediation/compatibility-browser-recovery-final` | 1 | FAIL | 10.638 |
| b08-router-pwa-compatibility-recovery-three | `node docs/backend-upgrade/b08-local-remediation/local_compatibility_probe.mjs browser .artifacts/backend-b08-local-remediation/compatibility-browser-recovery-three` | 0 | PASS | 7.477 |
| b08-router-pwa-compatibility-recovery-two | `node docs/backend-upgrade/b08-local-remediation/local_compatibility_probe.mjs browser .artifacts/backend-b08-local-remediation/compatibility-browser-recovery-two` | 1 | FAIL | 6.558 |
| b08-router-pwa-compatibility | `node docs/backend-upgrade/b08-local-remediation/local_compatibility_probe.mjs browser` | 1 | FAIL | 36.812 |
| b08-router-turnstile-regression | `pnpm exec vitest run tests/unit/auth-resend-turnstile.test.tsx tests/unit/auth-verify-route.test.tsx tests/unit/auth-guest-transfer-deferred.test.tsx` | 0 | PASS | 4.631 |
| b08-scanner-selftest | `python3.12 docs/backend-upgrade/b08/security/runner.py selftest --tools-dir .artifacts/backend-program-20261011/b08-security-downloads --output-dir .artifacts/backend-b08-local-remediation/scanner-selftest` | 0 | PASS | 15.629 |
| b08-workflow-policy-focused-final | `pnpm exec vitest run tests/unit/production-certify-workflow.test.mjs tests/unit/production-d1-diagnostics.test.mjs tests/unit/t21rc2-workflow.test.mjs tests/unit/staging-d1-runtime-readiness-check.test.mjs tests/unit/release-check.test.mjs` | 0 | PASS | 7.146 |
| b08-wrangler-import-output-focused | `pnpm exec vitest run tests/unit/production-catalog-import-output.test.mjs` | 0 | PASS | 0.981 |

Gzip preserves bytes; it is not redaction. Only the reviewed command logs are exported.
Raw engine reports/snapshots/tool caches/private pointers stay outside this packet.
Original first full test failure:305 passed/4 failed files,7455 passed/8 failed tests.
Compatibility fixes preserve auth assertions, vendor parser boundaries and protected public assets.
The PNG reproducibility test intentionally compares exact pixels/metadata after the native encoder update.
Parent evidence remains historical at2c42984b; run its verifier there, not against B08 source.
