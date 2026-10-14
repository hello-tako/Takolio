# T25 - Release Vietnamese family meals T22-T24

Status: IN_PROGRESS (2026-10-14 JST).
User explicitly authorizes gathering all implemented family-meal changes and
releasing production. Source baseline d64ba0c9; T24 implementation cf54910f.
Release PR: https://github.com/hello-tako/Tako-san/pull/75.

## Scope

Release T22-T24 through normal PR/merge, exact-head and exact-main CI, staging
0042/0043 migration and paired-flag deployment/smoke, then Environment-protected
production migration/deployment and receipt verification. Necessary release-tooling
support is authorized; preserve human Environment reviewers and immutable release
gates. No payment runtime, unrelated auth, dependency, production config or applied
migration edits. Scratch work and node_modules remain untracked.

## Implemented release tooling

ADR-061 records additive operational support for migration tips 0042 and 0043.
The staging-only workflow accepts exactly the current-main 0041->0042->0043 chain
or a complete 0043 certification. It pins repository/database identity, exact CI,
ledger/plan and Time Travel bookmark, preserves 103 aggregate counts across 83
legacy tables/media diagnostics, and verifies exact new tables/indexes/triggers
and repository schema. This is aggregate preservation, not database byte-content
or R2 availability proof. A partial 0042 ledger is intentionally rejected and
requires operator reconciliation rather than automatic blind retry.

Production catalog/media verification recognizes the reviewed operational tips,
retains current-main/CI rechecks after approval and immediately before mutation,
and certifies the exact family schema at 0043. Existing catalog/runtime/media and
schema gates remain binding.

Deploy prepares an inactive current-candidate recovery Worker with paired planner
UI/server flags OFF, pins source SHA/D1/catalog vars and flags-OFF HTML/module byte
hashes, then rebuilds and rechecks the approved active UI. Failure recovery prefers
that compatible version; a used recovery must prove the named deployment, mutation,
authority and exact served asset bytes. Keep additive 0042/0043 schema. Existing
initial strict-OTP recovery behavior remains intact. No live recovery rehearsal
has occurred.

## Verification and failures

Initial frozen full suite: 359 files, 8,438 passed / 2 failed. One failure was an
inherited Wrangler startup exceeding the 5-second test deadline; isolated rerun
passed 32/32 without changing the test. The other was an obsolete one-build-only
workflow assertion. Updated it to verify explicit paired flags for every allowed
build and OFF build -> proof -> inactive upload -> certify -> active rebuild ->
guard -> active upload ordering. Focused composition/recovery: 2 files / 54 tests
PASS. Migration focused suite: 7 files / 172 tests PASS; production exact schema
addition: 3 files / 30 tests PASS. Final full rerun uses maxWorkers=2.

Executed lint, both TypeScript checks, migration smoke, default and paired builds
PASS. Final full-suite result and hosted receipts will be appended after execution.
Earlier T24 browser 12/12 at 320/390/768/1280 and local workerd/D1 8/8 remain local
product evidence; no hosted authenticated household flow is claimed from them.

## Hosted release sequence

Prior successful production receipt 38274253206 certifies approved hardened_sha
3a24808b97838235596a43694013e74b1ba64cc2, schema0041, d1/0, paired flags ON.
Current public staging/production readiness confirms that source SHA and 500-recipe
D1 authority with no fallback. Active version IDs and ledger must be re-read by
new pipeline preflight, not copied from historical handoff IDs. Existing production
Environment requires reviewer vn-taphoanhatung; do not change or bypass that gate.

1. Push final candidate; require exact-head PR CI; merge normally preserving ancestry.
2. Require exact-main push CI; dispatch staging-family-meals-migrate.yml with full
   current main SHA and confirm_staging_migration=true.
3. Deploy staging with the same SHA, approved hardened_sha, mode=d1/0 and
   meal_composition_v2_enabled=true; verify exact receipt and public smoke.
4. Dispatch production-d1-migrate.yml for the same SHA,
   expected_pre_tip=0041_checkout_admission.sql,
   migration=0043_shopping_demand_review.sql, confirm_production_migration=true.
5. After normal Environment approval and migration receipt, deploy production at
   shadow/0 with confirm_recipe_catalog_rollback=true and paired flags ON.
6. Promote the same SHA through canary1 -> canary5 -> canary25 -> d1/0, each using
   normal Environment approval and exact deployment/authority/asset verification.
7. Record exact run IDs, approvals, receipts, failures, current schema/authority and
   rollback state in CURRENT_STATE.md, TASK_BOARD.md and HANDOFF.md.

T22 changed recipe-authority code, so unchanged-D1 continuity does not apply.
Do not skip the explicit rollout progression or silently change runtime flags.

## Acceptance

1. Tooling supports exactly the new migration chain without old migration edits.
2. Relevant tests, lint/types/full CI pass at the final candidate.
3. Merge preserves hardened ancestry; final main SHA has passing hosted CI.
4. Staging migration and deployment precede production mutation with evidence.
5. Production migration/deploy retain existing Environment reviewer approval.
6. Verify readiness, flags, runtime/assets/service-worker SHA and supported flows;
   distinguish public hosted checks from authenticated/local product evidence.
7. Save exact receipts and any remaining limitation; do not claim production success
   until the final deployed receipts and smoke checks actually pass.

No tokens, private fixtures or raw user data may enter Git or public artifacts.

Final local rerun PASS: 359 files / 8,440 tests, 423.70s, command
`TMPDIR=/private/tmp pnpm test --maxWorkers=2`, log work/t25-full-tests-final2.log.
Default/paired builds and lint/types/migration smoke PASS; source remained frozen
except the documented workflow assertion update before this final rerun.
