# Standalone V1 saved content validation - 2026-10-30 JST

Status: implementation checkpoint; production NOT_READY. Deployment authorized
by owner. Branch codex/recipe-v3-v1-content; parent
744b4e25b2d710e573dac7d82610c363acd6194b. Resolve final implementation/review
HEAD from Git and the PR; this document cannot identify its own commit.

## Scope and compatibility

ADR-077 adds optional nullable contentFingerprint to persisted V1 meal result
JSON. New standalone recipe selections capture trusted unscaled RuntimeRecipe
content and household access through migration0046. Family/composed anchors
inherit their matching component pin, including legacy NULL. Family variants
remain NULL. Swap preserves unchanged known/unknown pins. Explicit regeneration
selects current content and drops a stale known lock even when provenance.version
is unchanged. V1 composition projections resolve household-authorized archives.
Existing V1 UI displays its stored instructions; no new navigation was added.

V1/family/composition DTOs require the existing recipe-content=1 Accept capability
to expose pins. Old strict clients receive the previous shape. Pinned components
cannot cook through old unversioned links. Existing tenancy, stock, idempotency,
Week and plan/CAS fences remain. Captures attest the planning authority snapshot;
this slice adds no new guarantee about standalone authority cache freshness.

No migration added.0046 is mandatory for V1 selection even with paired composition
flags OFF. The disabled-schema regression omits0039 but explicitly installs exact
0046 SQL; missing0046 fails closed without plan/inventory/event changes. A pre-077
strict Worker cannot decode pinned result JSON. After the first pin, recovery
must use this version-aware same-source Worker with paired flags OFF, retaining
0046/0047. Hosted recovery and mixed-client certification remain pending.

## Executed checks

Environment: Node24.16.0,pnpm10.33.2. Commands use
`PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp CI=1`.

- `pnpm check`: PASS exit0,434files/9710tests,1168.84s; typecheck,lint,
  Main/Admin migration replay and production builds PASS. Log
  `/private/tmp/takolio-v3-v1-complete-check.log`; standalone exit receipt
  `/private/tmp/takolio-v3-v1-complete-check.exit`.
- Focused planning/compatibility receipt: PASS exit0,5files/62tests,31.19s;
  `/private/tmp/takolio-v3-v1-focused.log` and `.exit`. The exact focused file list
  was not retained in the log; full-gate evidence below is the reproducible gate.
- Cooking regression receipt: PASS exit0,1file/10tests,10.70s;
  `/private/tmp/takolio-v3-v1-cooking.log` and `.exit`.
- `pnpm exec vitest run tests/integration/t20-disabled-schema.test.ts`:
  PASS exit0,1file/4tests,4.28s. Final log
  `/private/tmp/takolio-v3-v1-disabled-final.log`; original process returned0,
  no standalone exit file. Earlier full run was interrupted after two fixture
  failures: through0038 lacked newly required0046. An intermediate assertion
  wrongly expected an empty seeded event table; fixed to compare before/after.
  Preserve `/private/tmp/takolio-v3-v1-disabled-before.log` and `-after.log`.
- `pnpm audit --audit-level high`: PASS exit0,no known vulnerabilities.
- `pnpm recipe:seed:check`: PASS exit0,59Vietnamese+12global,71media/runtime parity.
- `pnpm recipe:import:check`: PASS exit0,500recipes/2batches.
- `node scripts/recipe-intelligence-v3-audit.mjs --check`:
  PASS exit0,500recipes/44edits/25packets. Seed/audit had Vite24678 port warnings.
- `pnpm recipe:refresh:release-check`: FAIL exit1,unchanged four blockers:
  RUNTIME_PROJECTION_LOSS,INGREDIENT_RECONCILIATION_INCOMPLETE,
  SOURCE_CONTENT_VERIFICATION_INCOMPLETE,NUTRITION_EVIDENCE_INCOMPLETE.
  `/private/tmp/takolio-v3-v1-{seed,import,audit,release-check}.log` and `.exit`
  retain actual results. No readiness override or data promotion.
- `git diff --check`, `python3 scripts/admin-public-scan.py`: PASS; public scan
  examines added text only. `node scripts/admin-release-preflight.mjs`: PASS
  configuration validation,dirty checkout,readyForDeployment=false,
  remoteExecuted=false. SHA744b4e25; Admin baselinea1e706c7 remains appropriate
  because this slice changes no guarded customer paths. Source manifest SHA256
  5c26ea3737aedc803d5da0e31fffad5463e54211eeb1e03d0496acaa6d2dd449.

New saved-v1-content.test.ts has10 cases: static/D1 capture,household access,
strict client/replay/read/current/swap/regenerate,legacy NULL,archived display,
revision race,stale same-version locks and composed anchors.0046/0047 migration
matrix39/39 belongs to the committed parent and remains prior evidence; this
slice introduces no SQL changes.

## Browser verification

Exact commands, with environment prefix above:

```sh
PORT=3227 PREVIEW_API_PORT=8927 PREVIEW_MEAL_COMPOSITION_V2=true PREVIEW_T20_D1=true pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/takolio-family-continuation.e2e.ts tests/e2e/t17-ui/takolio-saved-recipes.e2e.ts tests/e2e/t17-ui/takolio-cooking-continuation.e2e.ts --project mobile-390 --project desktop-1440 --output .artifacts/recipe-v3-v1-content-browser
PORT=3228 PREVIEW_API_PORT=8928 PREVIEW_MEAL_COMPOSITION_V2=true PREVIEW_T20_D1=true pnpm exec playwright test -c playwright.t17.config.ts tests/e2e/t17-ui/takolio-planner-continuation.e2e.ts --project mobile-390 --project desktop-1440 --output .artifacts/recipe-v3-v1-planner-browser
```

First: PASS exit0,28tests,2.1m;145JSON/140PNG/122axe reports/0violations.
Its observations arrays contain24layout entries;122axe reports must not be
misreported as122layout observations. Second: PASS exit0,6tests,1.4m;
69JSON/68PNG/60axe reports/0violations,60layout observations. Measured checks
found no overflow,broken images,clipped words or unreachable picker controls.
Representative mobile/desktop saved and cooking captures were opened directly;
planner saved-recipe-meal-390x844-text1.png and
saved-recipe-board-1440x900-text1.png also inspected directly. No concrete new
visual regression identified. Fixed mobile navigation appears at the original
viewport position in full-page captures; this is not device certification.

Logs/exit: `/private/tmp/takolio-v3-v1-browser.log` and `.exit`,
`/private/tmp/takolio-v3-v1-planner-browser.log` and `.exit`.
Synthetic local preview API,service workers blocked. Historical warning is an
explicit synthetic DTO. Household suite is not planner coverage; the second
command supplies actual planner/browser interaction. Hosted,offline/device,
production and catalog-promotion behavior are not certified by these runs.

## Remaining release gates

Saved shopping version/revalidation and approved V3 publication remain open.
Four data gates remain red:1395provisional IDs/4233lines;2996excluded lines/
2860transformations pending review;nutrition1inherited/288blocked/211null.
Human culinary approval0/500,six critical safety cases. Research evidence does
not confer approval or a validated raw seafood process.

Fresh GitHub mainb49f3e6c;PR33 BLOCKED/REVIEW_REQUIRED with no reviews. Strict
validate/validate-admin,one independent approval,stale dismissal,last-push/admin
enforcement remain. Production reviewer vn-taphoanhatung,prevent_self_review,
protected branches. PR49 exact744b4e25 Recipe41046560970/Admin41046560909 SUCCESS
certifies the parent only. New HEAD needs its own CI/review. Deploy workflow has
no run. No merge,remote migration,flag change or production deployment performed.

Next: commit/push this validated slice,create/attach a stacked PR
against codex/recipe-v3-saved-content,observe exact-head Recipe/Admin CI. Continue
remaining consumer/evidence work. Release requires independent review,protected
main/exact-main CI,same-source staging/catalog/recovery and Environment approval.
Owner deployment authorization remains valid; no redundant permission request.
