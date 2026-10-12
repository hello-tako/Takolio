# B01b A1 - Executed local validation

Implementation `31d5fd860ef9b65fc38ccdc664074bda348b0a8c` from `98471e10d4b874219b069ec8b38a26fdd719db81`. Actual command receipts are machine-readable
in [validation.json](validation.json); every command's complete raw log is preserved
as deterministic gzip with raw/compressed SHA256. Earlier runs remain recorded.

Node 24.16.0, pnpm 10.33.2, SQLite 3.51.0; PATH starts
/opt/homebrew/opt/node@24/bin, NODE_OPTIONS=--no-experimental-webstorage.
CHECK_REMOTE_SCHEMA and CHECK_WEEK_PARITY_REMOTE unset. Full/focused catalog use
CI=true, WRANGLER_SEND_METRICS=false and task-owned canonical TMPDIR
/private/tmp/takosan-b01b-wrangler-epj27_ad. Other exact environment values are per
receipt, rather than assumed common. Wrapper duration includes process overhead;
Vitest duration is its own reported measurement.

| Run | Executed command | Exit / interpretation | Wrapper duration | Raw log |
| --- | --- | --- | --- | --- |
| audit-full | `pnpm audit --json` | 1 / RECORDED_DEPENDENCY_FINDINGS | 1.791s | [audit-full](logs/audit-full.log.gz) |
| audit-prod | `pnpm audit --prod --json` | 1 / RECORDED_DEPENDENCY_FINDINGS | 0.96s | [audit-prod](logs/audit-prod.log.gz) |
| build | `pnpm build` | 0 / PASS | 8.865s | [build](logs/build.log.gz) |
| catalog-focused | `pnpm exec vitest run tests/unit/production-catalog-import-inspection.test.mjs --maxWorkers=1` | 0 / PASS | 52.21s | [catalog-focused](logs/catalog-focused.log.gz) |
| final-focused | `pnpm exec vitest run tests/unit/email-lifecycle.test.ts tests/unit/email-privacy.test.ts tests/integration/auth-hardening.test.ts tests/integration/browser-security.test.ts --maxWorkers=2` | 0 / PASS | 13.745s | [final-focused](logs/final-focused.log.gz) |
| final-lint | `pnpm lint` | 0 / PASS | 7.238s | [final-lint](logs/final-lint.log.gz) |
| final-typecheck | `pnpm typecheck` | 0 / PASS | 16.009s | [final-typecheck](logs/final-typecheck.log.gz) |
| first-regression | `pnpm exec vitest run tests/unit/email-lifecycle.test.ts` | 0 / PASS | 1.632s | [first-regression](logs/first-regression.log.gz) |
| first-typecheck | `pnpm typecheck` | 2 / FAIL | 10.922s | [first-typecheck](logs/first-typecheck.log.gz) |
| focused-email-auth | `pnpm exec vitest run tests/unit/email-lifecycle.test.ts tests/unit/email-privacy.test.ts tests/integration/auth-hardening.test.ts tests/integration/browser-security.test.ts --maxWorkers=2` | 0 / PASS | 11.681s | [focused-email-auth](logs/focused-email-auth.log.gz) |
| focused-email | `pnpm exec vitest run tests/unit/email-lifecycle.test.ts tests/unit/email-privacy.test.ts` | 0 / PASS | 1.697s | [focused-email](logs/focused-email.log.gz) |
| frozen-install | `pnpm install --frozen-lockfile` | 0 / PASS | 0.517s | [frozen-install](logs/frozen-install.log.gz) |
| full-tests-rerun | `pnpm exec vitest run --maxWorkers=2` | 0 / PASS | 381.808s | [full-tests-rerun](logs/full-tests-rerun.log.gz) |
| full-tests | `pnpm exec vitest run --maxWorkers=2` | 1 / INTERRUPTED_FAILED | 743.452s | [full-tests](logs/full-tests.log.gz) |
| lint | `pnpm lint` | 0 / PASS | 6.94s | [lint](logs/lint.log.gz) |
| migrations | `pnpm check:migrations` | 0 / PASS | 0.588s | [migrations](logs/migrations.log.gz) |
| reproduce-duplicate-fallback | `pnpm exec vitest run tests/unit/email-lifecycle.test.ts` | 1 / EXPECTED_RED_REGRESSION_ON_BASE_SOURCE | 1.714s | [reproduce-duplicate-fallback](logs/reproduce-duplicate-fallback.log.gz) |
| scope-freeze | `python3 /tmp/takosan-b01b-scope.py` | 0 / PASS | 0.312s | [scope-freeze](logs/scope-freeze.log.gz) |
| typecheck | `pnpm typecheck` | 0 / PASS | 14.69s | [typecheck](logs/typecheck.log.gz) |

Final full summary:

```text
Test Files  289 passed (289)
Tests  6798 passed (6798)
Duration  380.97s (transform 4.83s, setup 1.29s, collect 38.32s, tests 649.15s, environment 9.98s, prepare 11.80s)
```

Initial full is INTERRUPTED_FAILED with actual failed counts and unhandled RPC
error; SIGTERM targeted only the verified blocked Python child. Stack samples and
incident metadata are preserved in [hung-subprocess.json](hung-subprocess.json).
Catalog-only passed 163/163; final complete rerun is the full-gate evidence.

The reproduce-duplicate-fallback failure is the expected red regression on original
source, not a final failure. First-typecheck failure is retained and superseded by
the final passing typed-mock result. Audit failures are recorded dependency findings,
not passing gates; no advisories were suppressed or dependencies upgraded.

Scope-freeze independently checked 4 frozen source/test files, runtime ownership,
unchanged protected config/schema/dependency/route paths, exact OTP email copy,
byte-preserved historical ADR and packet, and git diff --check. Its temporary script
was local verification only. Committed source/evidence verification is documented in
GIT_VERIFICATION.md after the implementation commit.
