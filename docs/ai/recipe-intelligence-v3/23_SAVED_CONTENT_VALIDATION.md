# Saved recipe content validation - 2026-10-30 JST

Status: implementation checkpoint; production NOT_READY. Owner authorization to
complete deployment remains in force. Source branch: codex/recipe-v3-saved-content;
parent cooking implementation:680502cc7aa64a4d11abca1ae0625ee9f5166d66.
Resolve this checkpoint's SHA from Git; this document cannot identify its own commit.

## Implemented scope

ADR-076 and migration0047 retain server-issued immutable content fingerprints on
saved composition components, including family generation and regeneration.
Role/order/lock edits and locked regeneration retain their existing pin or legacy
NULL. Legacy records are not backfilled from the current catalog. Database guards
reject missing, wrong-recipe and simple-food pins. Household archive grants and
existing authority/current-snapshot/CAS guards remain required.

New clients opt into content metadata through
`Accept: application/json; recipe-content=1`. Old strict response shapes omit the
field and cannot offer unversioned cooking for pinned components. Historical
reads retain archived display content; incompatible current assessment, role,
nutrition and shopping facts remain unavailable. Corrective removal remains
possible. Detail/cooking URLs, cache keys and offline fallback bind exact content.
V1 standalone selection pins and approved-content publication remain unfinished.

The scoped picker derives its ranking context from the already prepared trusted
context. The regression requires two catalog preparations for more than20items,
while preserving unknown-time rejection. Focused execution measured654ms;
previous pre-fix evidence measured389preparations and approximately11.8s.

## Executed local checks

Node24.16.0, pnpm10.33.2. Commands use
`PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp`.

- `CI=1 pnpm check`: completion marker PASS;433files/9697tests,1029.07s;
  lint/typecheck, Main/Admin migration smoke and builds PASS. Log:
  `/private/tmp/takolio-v3-saved-content-check-final.log`. This run preceded the
  final picker optimization. Original process exit receipt is unavailable.
  `/private/tmp/takolio-v3-saved-full-check.exit` belongs to an earlier failed run,
  not this completion. Earlier8failures remain in the original failure log.
- `pnpm exec vitest run tests/integration/saved-composition-content.test.ts tests/integration/saved-recipe-content-migration.test.ts tests/integration/t20-scoped-picker-quantity.test.ts tests/unit/admin-customer-baseline.test.mjs`:
  PASS exit0,4files/60tests,33.01s. Log/exit:
  `/private/tmp/takolio-v3-saved-content-focused.log` and `.exit`.
- `PORT=3217 PREVIEW_API_PORT=8917 PREVIEW_MEAL_COMPOSITION_V2=true PREVIEW_T20_D1=true pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/takolio-planner-continuation.e2e.ts tests/e2e/t17-ui/takolio-cooking-continuation.e2e.ts --project mobile-390 --project desktop-1440 --output .artifacts/recipe-v3-saved-content-browser`:
  PASS exit0,20tests,2.4m.124layout captures/124axe reports/146PNGs;
  aggregate zero overflow, broken images, clipped/split words or axe violations.
  Three saved-meal/board/cooking screenshots inspected directly. Local synthetic
  preview API, service workers blocked; the historical warning uses an explicit
  synthetic DTO. This is browser evidence, not hosted/device certification.
  Log/exit: `/private/tmp/takolio-v3-saved-content-browser.log` and `.exit`.
- `pnpm exec wrangler d1 migrations apply frigo-db --local --config wrangler.jsonc`:
  PASS exit0; migrations0001-0047 applied. Recheck log/exit:
  `/private/tmp/takolio-v3-saved-content-d1-recheck.log` and `.exit`.
- `pnpm exec wrangler d1 execute frigo-db --local --config wrangler.jsonc --json --file /private/tmp/takolio-v3-saved-schema-gate.sql`:
  PASS exit0; exact schema results empty, success=true. Evidence:
  `/private/tmp/takolio-v3-saved-schema-recheck.json` and `.exit`.
- `git diff --check`, `python3 scripts/admin-public-scan.py` and
  `pnpm audit --audit-level high`: PASS; no known vulnerabilities. Public scan
  checks added text, with its documented binary/manual limits.

## Immutable baseline and migration matrix

Freeze candidate bytes at `a1e706c7c870881d2e472ef7a1b211ac61bdd38c`;
`V3_RELEASE_BASELINE` does not follow HEAD and confers no independent approval.
Historical41/43/45 scenarios remain alongside exact47 checks. Changes after the
checkpoint and protected parallel-main drift still fail closed.

Executed with the Node24 prefix above:

- `pnpm exec vitest run tests/unit/admin-customer-baseline.test.mjs`: PASS exit0,
  1file/25tests,15.54s. `/private/tmp/takolio-v3-baseline-pinned-test-final.log`
  and `.exit`.
- `pnpm lint`: PASS exit0. `/private/tmp/takolio-v3-baseline-lint.log` and `.exit`.
- `node scripts/admin-release-preflight.mjs`: PASS exit0; configurationValidation
  PASS, customerBaseline/sourceSha a1e706c7, cleanCheckout=false (four intended
  edits), readyForDeployment=false, remoteExecuted=false. This is offline Admin
  planning, not customer production eligibility. Final sourceManifestSha256:
  `5c26ea3737aedc803d5da0e31fffad5463e54211eeb1e03d0496acaa6d2dd449`.
  `/private/tmp/takolio-v3-baseline-preflight-final.log` and `.exit`.
- First `node scripts/admin-migration-matrix.mjs --out .artifacts/admin-r2/migration-matrix.json`:
  FAIL exit1,27/28. New `PRAGMA integrity_check` failed with
  `not authorized: SQLITE_AUTH` after successful fresh47. Direct local D1
  reproduction failed identically; `PRAGMA quick_check` returned `ok`.
  Replace only the two new integrity calls with supported quick_check; retain
  foreign_key_check and include SQL in query failure labels. Original evidence:
  `/private/tmp/takolio-v3-baseline-matrix.log` and `.exit`.
- Same matrix command after the fix: PASS exit0,39/39; report generated
  2026-10-30T11:11:40.796Z,sourceHEAD a1e706c7 with explicit dirty script hashes.
  Fresh/reapply47, populated45→46→47, legacy NULL/data/0046archive/grants/receipts,
  invalid pin/archive/receipt mutations, missing46/47, unexpected48 and strict45
  binary rollback refusal all pass. Admin failure-transaction scenarios also pass.
  `/private/tmp/takolio-v3-baseline-matrix-fixed.log` and `.exit`;
  `.artifacts/admin-r2/migration-matrix.json` (private generated artifact).
  Matrix script SHA256 `38fb946bbeb027b88f4aca1f2651647283a84528180cca6db7edd2ba979e5e98`;
  baseline guard SHA256 `3008696dff178cbbac0cd97296d2d53a6a60a77514d781d620dd9283902579d2`.
  SQL-only local D1; no hosted Worker or flags-OFF recovery assertion.
- `git diff --check` and `python3 scripts/admin-public-scan.py`: PASS; public
  scan covers added text only, with its documented binary/manual limits.

Read-only existing-production observation:
`APP_SMOKE_URL=https://takolio.app bash scripts/post-deploy-smoke.sh https://takolio.app b49f3e6c4fc2f1485b77623ed7257d0f8bd31f9a`
PASS exit0; liveness/landing200,3consecutive ordinary/revalidated SW identities,
D1global500recipes,release rel-bd00a4f53fcaeee4,DBok,readiness degraded.
Log/exit: `/private/tmp/takolio-v3-production-smoke-20261030.log` and `.exit`.
This observes the old release, not this candidate's deployment.

## Release sequence and limits

Production migration must use a reviewed exact current-main SHA whose repository
tip is0047. Dispatch0047with the verified actual pre-tip (expected0045if unchanged):
the existing candidate gate applies the ordered hash-pinned0046/0047chain and
certifies the exact post-ledger/schema. Do not dispatch0046from a0047tip SHA.
Apply migrations before the corresponding Worker; do not rewrite old migrations.

After the first non-NULL saved pin, an old Worker can lose pins on row replacement.
Recovery therefore requires a same-source version-aware Worker with paired flags
OFF, preserving0046/0047and receipt replay. SQL-only migration success does not
certify hosted OFF/recovery behavior. The existing continuity fence still requires
reviewed same-SHA shadow/canary1/canary5/canary25/d1 evidence after parser/foundation
changes, protected-main/exact-main CI and normal production Environment approval.

PR48 at680502cc: Recipe40960869412 SUCCESS; Admin40960869319 FAILURE on the
unrecognized0046/customer-workflow release surface. The new immutable baseline
must freeze the exact candidate while retaining protected-history drift checks;
it confers no independent review. Fresh GitHub protection read still requires
validate/validate-admin, one independent approval, stale/last-push/admin enforcement;
production reviewer vn-taphoanhatung with prevent_self_review=true.

The broader release check remains blocked by RUNTIME_PROJECTION_LOSS,
INGREDIENT_RECONCILIATION_INCOMPLETE, SOURCE_CONTENT_VERIFICATION_INCOMPLETE and
NUTRITION_EVIDENCE_INCOMPLETE.1395provisional ingredient IDs/4233lines;
2996exclusions/2860transformations await review; nutrition1inherited/288blocked/
211null; human culinary approvals0/500; six critical safety cases remain.
Raw shrimp/crab manufacturer research is bounded evidence, not validated safety
or approval. No candidate promotion, remote D1 mutation, flag change or deployment
is established by this checkpoint.

## PR48 correction integrated into PR49 - 2026-10-31 JST

Normal merge of cooking-content 6fb484cf9404738f554d6f4ca186fab848b6ca8b
into saved-content 744b4e25b2d710e573dac7d82610c363acd6194b. Retain immutable
47-file baseline a1e706c7c870881d2e472ef7a1b211ac61bdd38c and both histories.
The matrix additionally retains the parent correction's 0046 re-apply, rejected
missing/mismatched cooking receipt pins and immutable legacy NULL receipt test.
Runtime, migration, workflow and payment bytes are unchanged by this merge.

Actual commands, Node24; prefix
`CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp`:

- `pnpm exec vitest run tests/unit/admin-customer-baseline.test.mjs`: PASS exit0,
  25 tests,11.96s. `pnpm lint` and `pnpm typecheck`: PASS exit0. Logs and exit
  receipts `/private/tmp/takolio-pr49-integrated-{baseline,lint,typecheck}.{log,exit}`.
- `node scripts/admin-migration-matrix.mjs --out /private/tmp/takolio-pr49-integrated-migration-matrix.json`:
  PASS exit0,39/39, generated 2026-10-31T03:19:25.259Z. Actual local D1 only;
  working tree during merge explicitly dirty, sourceHEAD744b4e25. Matrix SHA256
  db88cbabf1977fe8d9ffdeb7f08cc4eecea7174853abceda1d6d3457014475d8; baseline guard
  3008696dff178cbbac0cd97296d2d53a6a60a77514d781d620dd9283902579d2.
  Log/exit `/private/tmp/takolio-pr49-integrated-migration-matrix.{log,exit}`.
- `pnpm audit --audit-level high`: PASS exit0, **2 moderate vulnerabilities**;
  not audit-zero. `/private/tmp/takolio-pr49-integrated-audit.{log,exit}`.
- `git diff --check`: PASS; exact conflict-marker scan of resolved files: no
  markers. Public scan and clean committed preflight are recorded separately
  after execution; neither is implied here.

The inherited runtime/full-suite receipts above are not reruns of this tooling
merge. Hosted CI must validate the final commit. No culinary approval, catalog
promotion, remote D1 operation or production deployment follows from local PASS.
