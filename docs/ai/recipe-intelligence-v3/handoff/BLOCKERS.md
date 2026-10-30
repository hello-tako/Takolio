## Current checkpoint - 2026-10-31 JST

Production NOT_READY. Local PWA and flags recovery PASS; hosted certification,
approved publication and four data gates remain open. PR51 exact ae68f7e5 is
approved with both CI checks SUCCESS; PR33-50 still need independent review.
Current scope/checks/next action:
[26_PWA_RECOVERY_VALIDATION.md](../26_PWA_RECOVERY_VALIDATION.md).
Earlier records are historical checkpoints.

---

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

## Recipe V3 cooking foundation - 2026-10-30 JST

Status: RECIPE_V3_IMPLEMENTATION_IN_PROGRESS; release RECIPE_V3_BLOCKED.
Owner deployment authorization remains in force. Worktree
/Users/tunbee27/Documents/New project/Takolio-recipe-v3; branch
codex/recipe-v3-cooking-content; base555ce63d87dc354664ede8fb998fbb9567e5c71a.
Resolve this checkpoint's final HEAD and PR from Git; it cannot name itself.

ADR-075/migration0046 add immutable validated recipe content, household access
grants and nullable immutable cooking content/request references. Detail/start
capture unscaled content; retries/offline freeze version, servings, deductions
and command ID. Receipt-first replay survives catalog changes/failure without
another debit. Legacy NULL remains unknown; omitted-unit ambiguity fails closed.
Archived content uses current household restrictions without borrowing mutable
D1 evidence. Existing inventory/Week authority retained. Migration workflows
certify exact0046 through existing identity/main/CI/Environment gates; apply0046
before Worker. Old Worker rollback is valid only before changed content is served.
Vite6.4.5 fixes GHSA-8g5g-mxqh-grgj; other package versions unchanged.

Actual checks: Node24.16.0/pnpm10.33.2;
`CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm check`
PASS completion marker;431files/9656tests/964.56s; lint/typecheck, Main/Admin
migration replay and builds PASS. Original process exit receipt unavailable;
set-e deploy-check log reaches ALL CHECKS PASSED SUCCESSFULLY.
Final browser PASS exit0:12tests/59.0s,64layout captures/64axe reports,
0overflow/broken images/clipped/split words/axe violations. Synthetic preview API,
service workers blocked; not hosted/device proof. Frozen install/audit PASS
438dependencies/0vulnerabilities; seed59+12/71 parity, import500/2batches,
candidate500/44edits/25packets PASS. Fresh local D1 migrations0001-0046 and exact
schema gate PASS. `git diff --check` and `python3 scripts/admin-public-scan.py`
PASS; public scan checks added text only. Commands/logs/failures/limits:
recipe-intelligence-v3/22_COOKING_FOUNDATION_VALIDATION.md.

`pnpm recipe:refresh:release-check` FAIL exit1: RUNTIME_PROJECTION_LOSS,
INGREDIENT_RECONCILIATION_INCOMPLETE,SOURCE_CONTENT_VERIFICATION_INCOMPLETE,
NUTRITION_EVIDENCE_INCOMPLETE.1395provisional IDs/4233lines;2996exclusions/
2860transformations pending review;nutrition1inherited/288blocked/211null;
human culinary approvals0/500;six critical safety reviews. Publication and
saved planner/composition/shopping pinning incomplete. Source review found no
concrete cooking-foundation finding; it is not GitHub/human culinary approval.

Fresh GitHub main b49f3e6c4fc2f1485b77623ed7257d0f8bd31f9a. PR47 HEAD555ce63d:
Recipe40955325772/Admin40955325748 SUCCESS. No independent approvals in stack33-47.
Strict validate/validate-admin,required independent approval,last-push/stale/admin
protection and production reviewer vn-taphoanhatung/prevent_self_review remain.
Existing production read-only smoke PASS; ready reports mainb49f3e6c,d1,
500recipes,no fallback,database ok,status degraded,email delivery unverified.
This is existing production, not a new deployment.

Next: publish the coherent foundation PR against codex/recipe-v3-readiness-evidence;
validate exact HEAD. Complete saved-consumer/publication and real evidence work;
require independent review,protected main/exact-main CI,same-source hosted
staging/browser/recovery and normal Environment approval. Changed Zod/foundation
requires reviewed same-SHA shadow/canary1/canary5/canary25/d1 certification;
continuity fence intact. No merge,remote D1 mutation,flag change or new deploy.

Earlier records follow unchanged as historical checkpoints.

---

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
