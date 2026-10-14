# T25 - Release Vietnamese family meals T22-T24

Status: IN_PROGRESS (`RELEASE_IN_PROGRESS`, 2026-10-15 JST).
Immutable main candidate `0ff82edb7c251be340b5e00fbcf0ae8703b22a55`; approved
hardened SHA `3a24808b97838235596a43694013e74b1ba64cc2`. User selected automated
checks and public smoke; signed-in hosted household flows are not claimed.

## Certified stages

Normal PR #75/#76 merges, exact-head/main CI `38626853404` / `38628474378`,
staging migration/deploy `38629910072` / `38630223689` and production migration
`38630661149` PASS. Production D1 ledger 43/tip 0043, healthy FK/quick checks,
500 recipes/fingerprint and family schema constraints remain certified.
Post-migration previous-Worker public smoke PASS, retained in
`work/t25-production-postmigration-oldworker-smoke.log`.

Shadow `38631551953` workflow/independent receipt PASS; hosted full suite 359
files / 8,442 tests, 456.63s. Paired flags ON, served 500/protected fingerprint,
exact Worker/deployment/assets/SW, inactive paired-OFF recovery and no rollback
certified. Shadow public readiness/smoke PASS.

Canary/1 `38633505550` workflow/independent receipt PASS with exact shadow
predecessor join; hosted full suite 359 files / 8,442 tests, 614.33s. Authority
is canary 1%, actual D1/global mixed, D1 ready, served 500/fingerprint, ledger 43,
paired ON. Worker `bb35e2cc-f6fe-4fc0-84ee-284b8440bfe9` / deployment
`10c00336-861c-4077-8f3a-3355701c2bc1`; inactive paired-OFF recovery
`86fe3947-73dd-4610-9b34-cf94fef4b570`; three asset/SW observations; rollback
NOT_USED. Public smoke PASS. Fresh readiness was degraded with informational
`CONFIG_RECIPE_CATALOG_D1_AUTHORITY` (`src/worker/config/validation.ts:149`),
which confirms the canary/D1 cutover fence is satisfied; database is ok, no fallback.

Canary/5 `38635714965` release gate PASS, production WAITING for the required
reviewer `vn-taphoanhatung`. Actual approval, upload, receipt and smoke are pending.
Final production release remains IN_PROGRESS.

## Remaining sequence and documentation checkpoint

1. Root may commit/push the four docs normally on
   `codex/family-release-receipts-20261015`; source/runtime/config/schema unchanged.
2. Remote main must stay `0ff82edb7c251be340b5e00fbcf0ae8703b22a55` during
   rollout; do not merge this receipts branch into main until final certification.
3. After approval, complete canary/5 and prove exact Canary/1 predecessor join,
   same candidate/hardening, authority, ledger, assets/SW and public smoke.
4. Repeat normal approval and exact join/receipt/smoke for canary/25, then d1/0.
5. Record actual run/approval/warning/rollback evidence in all four docs. Final
   D1 source, 500/no fallback, exact SHA/SW and no rollback are required.

Keep paired flags, source transitions, additive 0042/0043 and fail-closed recovery.
Public smoke remains the authorized acceptance path; authenticated household flows
remain NOT_TESTED.

## Historical comparison

Optional local artifact `38274253206` join failed on IDs predating separately
authorized secret operations; protected gates and root verifier without the stale
comparison PASS. Actual previous Worker `ded100e7-98ae-4c83-aab5-94342daa06a3` /
deployment `56b74111-0bf8-44db-ac79-a15e28f80f27` matches payOS acceptance.
Subsequent receipts must join immediately preceding candidate IDs exactly.

---

## Prior Checkpoint - 2026-10-14 JST

The following entries preserve the earlier state and failures; the current state
at the top supersedes their pending release claims.

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

Hosted CI38579146408 at2ffebf44 failed8437passed/3timeouts: three scoped-picker
multi-request fixtures exceeded default5s at5.215-5.272s. Unchanged isolated local
rerun28/28PASS. Align only the three functional suites with existing30s family
fixture deadlines; assertions and separate planner performance/query/evaluation
caps remain intact. No runtime/globalCIpolicy change. User explicitly chooses
automated checks and public hosted smoke rather than authenticated hosted flows.

Follow-up focused picker/bounds/performance: 3 files / 32 tests PASS (36.92s),
`pnpm exec vitest run tests/integration/t20-scoped-picker-quantity.test.ts tests/integration/family-meal-planner-bounds.test.ts tests/integration/t20-performance.test.ts --maxWorkers=2`.
Focused ESLint and app/Worker typecheck PASS. Runtime/build/migration source is
unchanged from the full8440PASS checkpoint; exact-head hosted full CI is required.

## Hosted staging boundary and D1 limit correction - 2026-10-15 JST

PR75 merged headbdb5014d as a07b308c6997947c59a9e5f6ecf715b6b1eb573a.
Exact-head CI38581755662 and exact-main CI38583565990 PASS359files/8440tests,
589.91s and592.25s respectively; lint/types/migration smoke/build PASS.
Staging migration38585376230 attempt1 certified identity/complete0041ledger and
TimeTravelbookmark, then failed before apply at aggregate query. Apply SKIPPED;
no new appdeploy or production mutation. Actual remote error stdout was not
retained; exact query reproduces `too many columns in result set` under SQLite
column100, matching D1/workerd's security limit.103wide baseline is incompatible.
The narrow correction splits84+19columns and retains all103aggregates with strict
shape validation. Product/runtime/migration bytes remain unchanged. New PR/exact
head/mainCI and sequential staging receipt/deploy/smoke are required before prod.
Official evidence: https://developers.cloudflare.com/d1/platform/limits/ and
https://github.com/cloudflare/workerd/blob/main/src/workerd/util/sqlite.c++.

Correction checks PASS: focused migration/workflow suite4files/70tests(6.55s),
including12direct regressions, full lint/scopedESLint/diffcheck. NativeWrangler4.149
localworkerd/D1 reproduced oldSQLITE_ERROR and accepted exact2results84/19; all103
values match0041/0043 reference baselines. Independent source review no findings.
No remote mutation; hosted exact-head/main gates remain pending for this fix.
