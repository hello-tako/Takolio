## Recipe V3 beef identity and release recheck - 2026-10-29 JST

Status: RECIPE_V3_RESEARCH_IN_PROGRESS; release RECIPE_V3_BLOCKED. Owner
production deployment authorization remains in effect. No production mutation.
`research/BEEF_IDENTITY_REVIEW.md` records 12 V2 lines/12 recipes using
BEEF_SIRLOIN for several different or unspecified cuts; the V1 source also
contains broader labels. Runtime production impact has not been established.
No mapping, candidate, runtime, schema, or database was changed. Human review
and compatibility analysis are required before changing the shared identity.

Worktree /Users/tunbee27/Documents/New project/Takolio-recipe-v3; starting HEAD
393eb0ea. Node24.16.0, pnpm10.33.2, prefix
`PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp`:
`pnpm recipe:seed:check` PASS (59 Vietnamese, 12 global, 71 runtime/71 media;
Vite reported port 24678 already in use); `pnpm recipe:import:check` PASS
(500 recipes/2 batches); `node scripts/recipe-intelligence-v3-audit.mjs --check`
PASS (500/44/25; same Vite port warning); `pnpm audit --audit-level high` PASS
(no known vulnerabilities); `pnpm recipe:refresh:release-check` FAIL exit 1
with RUNTIME_PROJECTION_LOSS, INGREDIENT_RECONCILIATION_INCOMPLETE,
SOURCE_CONTENT_VERIFICATION_INCOMPLETE, NUTRITION_EVIDENCE_INCOMPLETE.
`python3 scripts/recipe-intelligence-v3-ingredient-exact.py` PASS (1395 IDs,
4233 lines, zero exact matches). The report's embedded Python check PASS:
503 manifest hashes and 12 lines in 12 recipes. This is not a culinary approval.

Next: review cut and substitution meaning and legacy consumers; continue the
1,395 unresolved identities, 6 critical safety cases, source/nutrition evidence,
versioned consumer implementation and same-source staging/rollback. Do not
bypass release gates or infer approval from automated checks. Full suite was not
rerun for documentation-only changes.

---

## Production deployment authorization - 2026-10-29 JST

The owner explicitly confirmed an exception authorizing deployment. This resolves
the request for owner permission; it does not itself establish a release artifact,
review, food-safety evidence, staging, rollback, or a passing technical gate.
Recipe V3 remains RECIPE_V3_BLOCKED / NOT_READY: the V2 release check fails on
projection, ingredient reconciliation, source verification, and nutrition;
V3 publication and version-pinned saved consumers are not implemented. Six
critical safety cases and human culinary review remain pending. Exact-source V3
staging and recovery rehearsal have not been performed. No deploy was dispatched.

Read-only checks: `git status --short --branch` showed local HEAD 6decfe25 ahead
of origin by one; `gh pr view 47 --json state,isDraft,headRefOid,baseRefName,reviews,mergeStateStatus,statusCheckRollup,url`
showed Draft PR47, no reviews, remote HEAD e6f681275034e1aa1210202bc888e88144f84c56,
and both hosted checks successful on that remote HEAD. Local documentation
commit 6decfe25 has no hosted check. `git log --oneline -1 origin/main` showed
b49f3e6c (local remote-tracking reference; not a fresh fetch). A search for
`docs/DEPLOYMENT.md` failed because that path does not exist; `DEPLOYMENT.md`
contains the actual workflow and continuity requirements.

Next: finish and verify the actual V3 artifact and consumer compatibility,
independent safety review, exact-source staging and rollback, and normal protected
main/Environment gates. Owner deployment authorization is retained for that
release; do not reinterpret it as evidence or bypass the continuity fence.

---

## Recipe V3 water review checkpoint - 2026-10-29 JST

Status: RECIPE_V3_RESEARCH_IN_PROGRESS; release RECIPE_V3_BLOCKED.
Worktree: /Users/tunbee27/Documents/New project/Takolio-recipe-v3; branch
codex/recipe-v3-readiness-evidence; starting HEAD e6f681275034e1aa1210202bc888e88144f84c56.
Read-only ingredient review: research/WATER_INGREDIENT_REVIEW.md records one
provisional water ID across 204 lines/198 recipes; five source lines explicitly
contain stock alternatives or a mixture. Preserve semantics and require review;
no identity mapping, candidate, runtime or database change. Literal filter is
not exhaustive. No human or safety approval is inferred.

Checks: report's embedded Python checksum/reproduction command PASS (204/198/5);
`pnpm recipe:ingredient-v2:audit` PASS (6766 canonical, 2996 excluded, 2860
review); `pnpm recipe:refresh:release-check` FAIL exit 1 with the four existing
projection, ingredient, source and nutrition blockers (Node v25.9.0; Vite also
reported port 24678 already in use). A prior exploratory candidate-schema query
failed with KeyError 'ingredients'; the successful check reads pinned V2 files.
`gh pr view 47 --json reviews,mergeStateStatus,headRefOid,baseRefName,url`:
no reviews; PR47 HEAD e6f681275034e1aa1210202bc888e88144f84c56. `gh run view`
40864196054 and 40864196031: Recipe V3 CI and Admin CI SUCCESS on that HEAD.
These hosted results do not certify subsequent local edits. No full suite rerun
for this documentation-only checkpoint. Production mutation: 0.

Next: review the five lines and remaining group against authoritative source;
continue unresolved safety, ingredient, nutrition and versioned consumer work;
obtain independent review and same-source staging/recovery evidence before release.

---

# Current next action - 2026-10-29 JST

1. Review [Draft PR46](https://github.com/hello-tako/Takolio/pull/46), HEAD9049f346372dbc9ed515e572f3d66fbc75c2fc18. Recipe40860409614/Admin40860409658 SUCCESS; independent approval pending. Preserve Draft33-45 and the stable PR46 HEAD.
2. Finish documentation continuation on codex/recipe-v3-readiness-evidence, base9049f346372dbc9ed515e572f3d66fbc75c2fc18; exact eventual PR/HEAD/CI resolve from Git/PULL_REQUESTS. Parent success is not its hosted acceptance. No repeated full local suite for docs only.
3. Close four data blockers and six fingerprint-bound safety decisions. CAA category PDFs/index and Nissui FAQ supplement prior product research but validate neither raw-shrimp product/process nor crab grill endpoint. Both FAIL_UNRESOLVED; human approval0/500. Continue ingredient/quantity/source/nutrition decisions; no user-URL request pending.
4. Implement accepted content-version and old plan/shopping/cooking/offline/rollback integration after evidence closure. Preserve the production continuity fence; changed Zod/foundation requires fresh reviewed same-SHA shadow/canary1/canary5/canary25/d1 certification.
5. Require independent approval, protected main integration/exact-main CI, same-source staging/browser/recovery and normal Environment approval. Release NOT_READY; no production dispatch while prerequisites fail.

Earlier checkpoint follows unchanged. Its pending exception, vulnerability,
branch, test and next-action statements describe its historical snapshot.

---

# Next action

1. Continue in codex/recipe-v3-release-patches, isolated V3 worktree. Verified implementation 7bdd574bc8ad401efd348e466093d13bf62c6ea3: complete local PASS exit0;428files/9570tests;951.14s; hosted validate40709482707/validate-admin40709482552 SUCCESS. Resolve subsequent documentation HEAD and its own exact-head CI from Git/PR45. Historical failures remain in14_TEST_STRATEGY.md.
2. Independent review of Draft PR45 (https://github.com/hello-tako/Takolio/pull/45), based on codex/recipe-v3-safety-07; preserve Draft units33-44. Full Admin hosted checks include Workerd, migration matrix, browser suite and ten keyboard repeats. Branch success is not main/staging/release acceptance; no review or merge inferred.
3. Resolve Zod GHSA-mrhx-c7xc-m3w5 through a reviewed compatibility/security migration and fresh catalog certification. zod/v3 under an upgraded package remains affected. Protected PayOS cannot be edited in this scope. Do not waive audit or continuity checks.
4. Complete ingredient/quantity/source/nutrition evidence and six fingerprint-bound safety decisions. Use the six already-read product/context pages in research/RAW_SEAFOOD_DECISIONS.md; exact raw-shrimp package/validated hazard-control protocol and raw-crab package/species/grill endpoint remain missing. Reconcile Marine Foods half-thaw with archival full-thaw wording. Both cases stay FAIL_UNRESOLVED; no user-URL request outstanding. Internal agents cannot confer HUMAN_APPROVED.
5. Implement accepted runtime version pinning and old saved-plan/shopping/cooking/offline/rollback compatibility after evidence closure. Preserve all500 IDs/slugs, quantities/yields, source variants, unknown identity/allergens, blocked/null nutrition and exact reversibility. No automatic mapping or source promotion.
6. Require independent human approvals, normal protected main merge and exact-main CI, same-source staging/browser/recovery proof, then normal production Environment approval. No production dispatch while blockers remain; no payment/auth/infrastructure edits or protection bypass.
