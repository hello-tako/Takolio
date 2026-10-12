# B00 - Local validation

Source `652e0d7632745e9b77cda4b5b3caac83a3ec1015`; completed UTC `2026-10-11T02:48:54.399516+00:00`.

Node24.16.0, pnpm10.33.2, SQLite CLI3.51.0, macOS. PATH ưu tiên Node24; NODE_OPTIONS=--no-experimental-webstorage. Commands chạy riêng, không gọi aggregate pnpm check. Remote schema/Week flags unset. Logs exact trong ignored `.artifacts/backend-b00`, mỗi digest giữ trong baseline.

| Check / actual command | Exit / outcome | Seconds |
| --- | --- | --- |
| install: `pnpm install --frozen-lockfile` | 0 / PASS | 3.598 |
| lint: `pnpm lint` | 0 / PASS | 8.193 |
| typecheck: `pnpm typecheck` | 0 / PASS | 17.109 |
| tests: `pnpm exec vitest run --maxWorkers=2` | 1 / FAIL | 407.736 |
| migrations: `pnpm check:migrations` | 0 / PASS | 0.532 |
| build: `pnpm build` | 0 / PASS | 8.602 |
| seed: `pnpm recipe:seed:check` | 0 / PASS | 0.99 |
| ingredient-audit: `pnpm recipe:ingredient-v2:audit` | 0 / PASS | 1.228 |
| refresh-check: `pnpm recipe:refresh:check` | 0 / PASS | 2.277 |
| release-check: `pnpm recipe:refresh:release-check` | 1 / EXPECTED_BLOCKED | 2.339 |
| dependency-audit: `pnpm audit --json` | 1 / FINDINGS_PRESENT | 2.012 |
| production-audit: `pnpm audit --prod --json` | 1 / FINDINGS_PRESENT | 0.911 |
| staging-catchup-focused: `pnpm exec vitest run tests/unit/staging-d1-catchup-check.test.mjs --maxWorkers=1` | 1 / FAIL | 61.208 |
| staging-catchup-ci: `pnpm exec vitest run tests/unit/staging-d1-catchup-check.test.mjs --maxWorkers=1` | 1 / FAIL | 60.834 |
| wrangler-diagnostic-cached: `node /tmp/takosan-b00-wrangler-diagnostic.mjs --cached` | 0 / PASS | 4.299 |
| staging-catchup-cached: `pnpm exec vitest run tests/unit/staging-d1-catchup-check.test.mjs --maxWorkers=1` | 0 / PASS | 4.721 |
| wrangler-diagnostic-uncached: `node /tmp/takosan-b00-wrangler-diagnostic.mjs` | 0 / PASS | 59.512 |
| tests-cached: `pnpm exec vitest run --maxWorkers=2` | 0 / PASS | 372.821 |

## Full-suite failure and reproduction

Initial run: 288files,6743PASS/1FAIL (staging-d1-catchup-check.test.mjs:169, Wrangler local subprocess >5s). Focused31PASS/1FAIL; CI=true and metrics=false alone still fails (~57s subprocess). No test source/assertions/timeout change.

Real latest-version metadata (4.149.0) fetched from registry via curl into task-owned canonical TMPDIR update-check cache. Uncached direct CLI: banner24.216s, listing24.691s, process exit59.225s; cached direct CLI: banner0.833s, listing1.764s, process exit1.787s. Update lookup and lingering request keep the process alive beyond the5s test budget; focused32/32PASS, failing test1.204s. Final full rerun uses CI=true, WRANGLER_SEND_METRICS=false and TMPDIR=/private/tmp/takosan-b00-wrangler-bCRyB0/canonical-temp; recorded separately from initial standard-environment failure. Installed Wrangler remains3.114.17. Ancillary registry lookup is isolated by this reproduction; enduring hermetic harness fix tracked B08.

Final actual Vitest summary:

```text
Test Files  288 passed (288)
Tests  6744 passed (6744)
Duration  372.06s (transform 4.95s, setup 1.29s, collect 38.75s, tests 629.50s, environment 10.44s, prepare 11.85s)
```

## Audit and expected blocked release

Fresh full dependency graph41findings:2critical/16high/19moderate/4low. Production graph2moderate/0high/0critical. Both audit exit1; no suppression/upgrade/remediation in B00. Public advisory details and preliminary mode/exposure assessment: dependency-audit.json. Tooling count is not a proven production vulnerability count.

Ingredient V2 audit/refresh source checks PASS; release-check exit1 with4expected blockers. Candidate eligibility remains false/finalRuntimeFingerprint null. Current certified production V1/T19 catalog is separate and serves500 according to hosted receipt; no current corruption claim.

## Warnings and limits

Frozen install ignored package build scripts (pnpm10policy); local build/tests execute successfully; no approve-builds policy change. Ingredient/refresh SSR tooling emitted port24678 already-in-use warnings during concurrent local checks, exits0 and exact artifact checks PASS; no existing process terminated. Node SQLite experimental and React Router future warnings retained in logs. Python public-ready collection403 followed curl200, recorded as collection difference. No remote SQL/migrations/D1 apply, provider paid run, inbox send, browser/E2E/load/chaos certification or production changes. Default local web build flags are not observed production flags.

## Review corrections

Independent source/packet reviews found and corrected OTP-only-login session overreach, ambiguous email fallback sequencing, legacy challenge acceptance-proof/cutover conflict, missing shopping_lists/Google dependency, V3 cross-version idempotency and V2 projection wording. Reviews only certify docs/source consistency; B01 SQL/concurrency/staging and B03/B05 certificates remain future implementation gates.
