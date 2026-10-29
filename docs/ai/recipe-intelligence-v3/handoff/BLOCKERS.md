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

# Current release blockers - 2026-10-29 JST

Review HEAD `9049f346372dbc9ed515e572f3d66fbc75c2fc18` of [Draft PR46](https://github.com/hello-tako/Takolio/pull/46)
passed both [Recipe V3 CI40860409614](https://github.com/hello-tako/Takolio/actions/runs/40860409614)
and [Admin CI40860409658](https://github.com/hello-tako/Takolio/actions/runs/40860409658).
Each ran429files/9597tests plus lint/typecheck/migrations/build. Admin also passed
real Workerd, migration matrix,13browser tests,10keyboard repeats and screenshot
guard. Hosted validate preflight reported cleanCheckout=false after build,
readyForDeployment=false, remoteExecuted=false. Separate clean local preflight
on that committed HEAD passed cleanCheckout=true with the same source manifest
6d042015488ced02508ace18add2ea80b1294d3602b01361b165f5b6989f68c4.
Implementation Recipe40860038264 succeeded; Admin40860038241 was CANCELLED by
the documentation push, never PASS. Independent review remains pending.

Release NOT_READY: RUNTIME_PROJECTION_LOSS,
INGREDIENT_RECONCILIATION_INCOMPLETE, SOURCE_CONTENT_VERIFICATION_INCOMPLETE,
NUTRITION_EVIDENCE_INCOMPLETE.1,395provisional IDs/4,233lines;
2,996excluded lines/2,860transformations need review; nutrition1inherited/
288blocked/211null. Full culinary verification/human approvals0/500;
six critical safety cases pending. Versioned publication and old saved-plan/
shopping/cooking/offline/rollback integration remain unimplemented (ADR-072).
Unchanged production continuity fence requires fresh reviewed same-SHA
shadow/canary1/canary5/canary25/d1 certification after the parser/foundation change.
No remote D1 mutation, feature flag change, merge or deployment.

Four additional public retrievals: CAA category index, two category PDFs
(all5pages extracted/rendered/read) and expanded Nissui90147 grilling FAQ.
These establish bounded category context and a manufacturer grilling use,
but no validated shrimp SKU/lot/process or crab grill endpoint. Both cases stay
FAIL_UNRESOLVED; no candidate/source/nutrition promotion or approval. Raw caches
stay private; retrieval bindings and limits: research/RAW_SEAFOOD_DECISIONS.md.

Local dependency advisory resolved: patched Zod4.6.7, audit0vulnerabilities.
Hosted technical checks passed on PR46 HEAD; independent approval absent.
Documentation continuation has its own HEAD/CI requirement. No technical check
confers HUMAN_APPROVED or validates raw seafood; no blocker waived.

Earlier checkpoint follows unchanged. Its pending exception, vulnerability,
branch, test and next-action statements describe its historical snapshot.

---

# Current blockers

1. RUNTIME_PROJECTION_LOSS:2,996excluded source lines;2,860 reviewed transformations needed. Conservation alone does not resolve demand semantics.
2. INGREDIENT_RECONCILIATION_INCOMPLETE:1,395provisional IDs/4,233lines;exact0;no approved mappings.
3. SOURCE_CONTENT_VERIFICATION_INCOMPLETE:500/500 bounded external-content claims;full culinary verification0;V2promotions0. 676 bounded reads; 199 reachable-only/unread; 309 unavailable-only; 4 reachable-and-unavailable.
4. NUTRITION_EVIDENCE_INCOMPLETE:288blocked/211null/1inherited publishable;V3certifications0.
5. Six critical safety cases remain pending; raw-shrimp acid/freezing and crab product identity FAIL_UNRESOLVED. Coordinated salmon/sprout/shrimp/chicken corrections are candidates awaiting human decisions. See research/GAP_RESEARCH_SUPPLEMENTS.md and the source/fingerprint-bound choices in research/RAW_SEAFOOD_DECISIONS.md. The latter adds decision/product-research evidence only; user selected raw-shrimp product/protocol and raw-crab research paths; six public product/context pages have been read, but exact package/process validation and supported crab grill endpoint remain missing; Marine Foods half-thaw versus archival full-thaw conflict needs coordinated review.
6. All500human approvals pending. Content-version pinning/saved-plan/shopping/cooking/offline/rollback integration unimplemented.
7. Fresh production-preparation audit after Hono/Undici patches exits1:1high/0moderate, remaining Zod3.25.76 GHSA-mrhx-c7xc-m3w5. Patched>=4.6.6 requires reviewed protected PayOS/error-contract compatibility and new catalog certification; no suppression. Current patch complete local gate PASS exit0;428files/9570tests;951.14s. Historical supplement07 full local gate:PASS, exit0 observed; Test Files  427 passed (427); Tests  9566 passed (9566); Duration  924.13s (transform 6.86s, setup 2.35s, import 48.82s, tests 800.62s, environment 15.33s); typecheck/lint, Main/Admin local migration smoke, Client/Admin/Worker builds PASS.
8. Implementation7bdd574b hosted validate40709482707/validate-admin40709482552 SUCCESS; later documentation HEAD needs own CI. Draft45 and separate stack review units remain open. Exact-head hosted stack review, V3browser/same-source staging certification and operator approval remain open. PR33historical CI covers its own head only.

No blocker removed or safety certification inferred from schema/source coverage. Production mutations0.
