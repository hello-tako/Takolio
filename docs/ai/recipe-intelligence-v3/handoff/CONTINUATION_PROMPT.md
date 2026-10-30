## Recipe V3 immutable release baseline - 2026-10-30 JST

Status: RECIPE_V3_IMPLEMENTATION_IN_PROGRESS; production NOT_READY.
Owner deployment authorization remains valid. Candidate implementation is frozen
at a1e706c7c870881d2e472ef7a1b211ac61bdd38c on codex/recipe-v3-saved-content;
parent680502cc7aa64a4d11abca1ae0625ee9f5166d66. Admin preflight now recognizes
these exact customer bytes; protected-history/post-checkpoint guards remain.

Actual checks:25baseline tests/lint/preflight PASS exit0. Real local D1 migration
matrix PASS exit0,39/39,including populated45→46→47 and immutable archive/receipt
checks. Initial27/28 failure was D1 SQLITE_AUTH for integrity_check; reproduced,
replaced with supported quick_check while retaining FK checks. Full commands,
hashes,logs,failure and earlier runtime/browser limits are in
`docs/ai/recipe-intelligence-v3/23_SAVED_CONTENT_VALIDATION.md`.
Read-only existing-production smoke PASS exit0 on mainb49f3e6c; this candidate
has not been deployed. No remote mutation or approval is claimed.

Next: commit/push the baseline and evidence; publish a stacked PR against
codex/recipe-v3-cooking-content; observe Recipe/Admin CI on its exact final HEAD.
Continue V1 saved selection pins/publication and ingredient/source/nutrition/
safety evidence. Four catalog gates remain red,1395provisional IDs,six critical
safety cases,0/500human approvals. Independent review,protected main/exact-main
CI,same-source staging/continuity/recovery and Environment reviewer are required.
Migration dispatch must target0047 from a0047tip,applying ordered46/47 before
Worker. Recovery after saved pins requires version-aware same-source flags OFF.

Earlier records are historical checkpoints.

---

## Recipe V3 saved content checkpoint - 2026-10-30 JST

Status: RECIPE_V3_IMPLEMENTATION_IN_PROGRESS; production NOT_READY.
Owner deployment authorization remains in force; do not ask again.
Branch codex/recipe-v3-saved-content; parent680502cc7aa64a4d11abca1ae0625ee9f5166d66.
ADR-076/migration0047retain saved composition versions, household archive access,
legacy NULL and old strict DTO compatibility. Historical display/cooking retain
content; current assessment/shopping keep authority fences. Picker now prepares
catalog twice per request rather than per candidate. V1 standalone pins and
approved-content publication remain open.

Local full gate433files/9697tests reached PASS before the picker optimization;
original exit receipt unavailable. Final focused4files/60tests and browser20tests
PASS exit0;124layout/124axe reports,zero measured issues. Local D1 exact0047
recheck PASS exit0,empty issues; audit0,public text scan,diff check PASS.
Commands,logs,scope and limitations:
`docs/ai/recipe-intelligence-v3/23_SAVED_CONTENT_VALIDATION.md`.

Next: freeze immutable0047candidate; pin Admin baseline; execute preflight and real
migration matrix; publish stacked PR and validate exact HEAD. Independent review,
protected main,exact-main CI,same-source hosted staging/recovery and production
Environment approval remain.0047dispatch can apply the ordered0046/0047chain
from verified0045; do not dispatch0046from a0047tip SHA. After any saved pin,
recovery requires a version-aware same-source flags-OFF Worker. Four catalog
release failures,1395provisional IDs,six safety cases and0/500human culinary
approvals remain unresolved. No production deployment claimed.

Earlier records follow as historical checkpoints.

---

# Current continuation instructions - 2026-10-29 JST

Continue in /Users/tunbee27/Documents/New project/Takolio-recipe-v3,
branch codex/recipe-v3-readiness-evidence, base9049f346372dbc9ed515e572f3d66fbc75c2fc18. Read mandatory authority documents,
CURRENT_CHECKPOINT, NEXT_ACTION, PULL_REQUESTS,14_TEST_STRATEGY,
17_PRODUCTION_RELEASE_PACKET,21_PRODUCTION_PREPARATION and RAW_SEAFOOD_DECISIONS.
Verify Git/PR/run state. Preserve PR46 HEAD and its completed checks; no repeated
full local suite absent a new runtime change or concrete concern. Owner approved
the narrow Zod compatibility exception, not payment business/infrastructure work.

Branch codex/recipe-v3-readiness-evidence; base9049f346372dbc9ed515e572f3d66fbc75c2fc18; documentation only.
Security implementation 7c4d8700c0e1d4bd78a51007f7fdb0d46ae82091; audit0vulnerabilities;
local full gate429files/9597tests PASS. Candidate SHA2560f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4 unchanged.
Exact commands/failures and documentation checks:14_TEST_STRATEGY.md.

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

Four additional public retrievals: CAA category index, two category PDFs
(all5pages extracted/rendered/read) and expanded Nissui90147 grilling FAQ.
These establish bounded category context and a manufacturer grilling use,
but no validated shrimp SKU/lot/process or crab grill endpoint. Both cases stay
FAIL_UNRESOLVED; no candidate/source/nutrition promotion or approval. Raw caches
stay private; retrieval bindings and limits: research/RAW_SEAFOOD_DECISIONS.md.

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

Next: independent PR46/stack review and exact documentation HEAD checks; complete
evidence/safety/human decisions before accepted consumer integration. Use the
existing ten product/category retrievals; no pending request for user URLs.
Never mark safe/approved from product marketing, category rules or agent review.
Require protected main/exact-main CI, new same-source staging/recovery and normal
Environment approval before production. Update required status docs each checkpoint.

Earlier checkpoint follows unchanged. Its pending exception, vulnerability,
branch, test and next-action statements describe its historical snapshot.

---

Continue TAKOLIO_RECIPE_INTELLIGENCE_V3 production preparation in
/Users/tunbee27/Documents/New project/Takolio-recipe-v3,
branch codex/recipe-v3-release-patches; parent f637134b4a337443b375985021d0d3bfc42a9e87,
base/main b49f3e6c4fc2f1485b77623ed7257d0f8bd31f9a. Read mandatory authority
documents, CURRENT_CHECKPOINT, NEXT_ACTION, PULL_REQUESTS,14_TEST_STRATEGY,
21_PRODUCTION_PREPARATION and RAW_SEAFOOD_DECISIONS; verify actual Git/CI state.

Patch: Hono4.13.13, only miniflare's Undici7.30.1, dedicated read-only V3 CI/Admin branch coverage,
four regression tests; original customer CI/preflight bytes unchanged. Complete local PASS exit0;428files/9570tests;951.14s;implementation7bdd574b hosted validate40709482707/validate-admin40709482552 SUCCESS; clean committed preflightPASS. Earlier2test failures/interrupted attempts remain in14_TEST_STRATEGY.
Audit exits1 with1high/0moderate; remaining Zod3.25.76 advisory
GHSA-mrhx-c7xc-m3w5 requires reviewed compatibility migration preserving
protected PayOS/error contracts and fresh catalog certification. No audit or
release check may be bypassed. zod/v3 under a new package version is not a fix.

Candidate SHA2560f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4
unchanged; data implementation a578b5696389cdb6afeca7530e33b1f4e384690e.
500IDs/6,766ingredient lines/4,938steps preserved;44reversible edits/29recipes;
1,188source rows/1,150URLs/1,326claims. Full culinary verification/human
approval0/500;1,395provisional IDs/4,233lines unresolved;2,996runtime-excluded
lines/2,860reviewed transformations needed; nutrition1inherited/288blocked/211null.
Six safety cases pending; raw-shrimp protocol and raw-crab formulation remain
FAIL_UNRESOLVED. Existing six product/context pages are bounded research,
not validated protocols or human approval. No request for user URLs remains.

Verified implementation 7bdd574bc8ad401efd348e466093d13bf62c6ea3; Draft PR45 OPEN on
codex/recipe-v3-safety-07. Review it independently; resolve later documentation
HEAD and its own exact-head CI. Preserve separate Draft33-44 review units. Then resolve actual source/ingredient/nutrition/safety
and runtime version/old-consumer compatibility prerequisites. Require independent
human approvals, protected main merge/exact-main CI, same-source staging/recovery
and production Environment approval. Current release NOT_READY; no production
dispatch, remote D1 mutation, flag/credential change, payment/auth edit or bypass.
Update required status/handoff docs with actual results, exact failures and next
action; never replace evidence with readiness labels.
