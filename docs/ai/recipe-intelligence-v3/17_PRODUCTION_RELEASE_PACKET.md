## Current checkpoint - 2026-10-31 JST

Production NOT_READY. Cooking/saved V1/composition/shopping pins are implemented;
local flags-OFF/ON and real-service-worker recovery checks PASS. Approved V3
publication and hosted certification remain open. PR51 exact ae68f7e5 is approved
with both CI checks SUCCESS; PR33-50 still need independent review.
Current scope, exact checks, four data blockers and next action:
[26_PWA_RECOVERY_VALIDATION.md](26_PWA_RECOVERY_VALIDATION.md).
Earlier records are historical checkpoints.

---

## Recipe V3 saved shopping content - 2026-10-30 JST

Status: RECIPE_V3_IMPLEMENTATION_IN_PROGRESS; production NOT_READY.
Branch codex/recipe-v3-shopping-content; parent5cf2d197. ADR-078 retains saved
recipe pins in shopping attribution and private cache, negotiates legacy DTOs,
reopens review on changed content and preserves purchases/replay. No new SQL.
Four catalog CLIs and browser preview now isolate Vite caches after reproduced
ENOENT/504 failures. Final local full gate PASS435files/9716tests,1156.63s;
focused47/regression43/CLI30/browser4tests PASS; audit0. Browser88axe reports:
0violations,39incomplete contrast findings. Exact commands, failures and limits:
docs/ai/recipe-intelligence-v3/25_SAVED_SHOPPING_VALIDATION.md.

Next: publish the validated slice against codex/recipe-v3-v1-content; observe
exact-head Recipe/Admin CI. Four catalog gates remain red,1395provisional IDs,
six critical safety cases,0/500human approvals; approved publication still blocked.
Independent review,protected main/exact-main CI,same-source hosted staging/recovery/
catalog certification and normal Environment approval remain. Production permission
already granted; no repeat permission request. No remote mutation/deployment.

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

# Current production release packet - 2026-10-29 JST

Status: NOT_READY. Authorized Zod migration passed local and hosted validation.
The independent reviewer and production approval gates remain open.

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

Main protection still requires strict validate/validate-admin, one independent
approval, stale/last-push enforcement and admin enforcement. Production retains
reviewer vn-taphoanhatung, prevent_self_review=true and protected branches.
No production workflow dispatch is eligible. Next: close actual data/review/
compatibility gates; protected main/exact-main CI; same-source staging/recovery;
normal Environment approval. Documentation HEAD needs its own checks; resolve
its eventual PR/HEAD from handoff/PULL_REQUESTS.md and Git.

Earlier checkpoint follows unchanged. Its pending exception, vulnerability,
branch, test and next-action statements describe its historical snapshot.

---

# Production release packet

Status: `NOT_READY` - 2026-10-29 JST.

This packet now records production preparation, not merely the original audit.
Candidate/data implementation remains a578b5696389cdb6afeca7530e33b1f4e384690e;
parent documentation checkpoint f637134b4a337443b375985021d0d3bfc42a9e87.
Branch codex/recipe-v3-release-patches contains compatible Hono/Undici patches
and dedicated read-only V3 push validation. Verified patch implementation
7bdd574bc8ad401efd348e466093d13bf62c6ea3; [Draft PR45](https://github.com/hello-tako/Takolio/pull/45)
is OPEN. Subsequent documentation HEAD/checks are resolved separately from
Git/PULL_REQUESTS. No production release exists.

| Gate | Current evidence / missing prerequisite |
|---|---|
| Candidate identity | 500 stable IDs/slugs; SHA2560f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4 |
| Local patch checks | Complete pnpm check PASS exit0;428files/9570tests;951.14s; focused262tests/lint/clean preflight/public/scoped reviewPASS; earlier failures retained |
| Dependency security | FAIL exit1,1high/0moderate; Zod3.25.76 GHSA-mrhx-c7xc-m3w5 unresolved; reviewed compatibility migration and catalog recertification required |
| Ingredient/runtime projection | FAIL;1,395provisional IDs/4,233lines;2,996excluded/2,860reviewed transformations needed |
| Source/culinary evidence | FAIL;1,188source rows/1,326bounded claims do not confer whole-recipe verification; full verification0/500 |
| Nutrition | FAIL;1inherited publishable/288blocked/211null; V3certifications0 |
| Safety / independent human review | PENDING;6critical cases;raw-shrimp/crab FAIL_UNRESOLVED; human approvals0/500 |
| Versioning / saved consumers | UNIMPLEMENTED;approved-content publication, old plan/shopping/cooking/offline/rollback compatibility |
| Hosted checks / main | Implementation7bdd574b validate40709482707/validate-admin40709482552 SUCCESS; Draft PR45 plus stack33-44 await review; later docs HEAD needs own CI; main merge/exact-main CI absent |
| V3 staging/browser/recovery | NOT EXECUTED; exact-source certification and rollback receipt missing |
| Production approval / deployment | NOT REQUESTED/DISPATCHED; normal Environment reviewer and protected branch gates remain |

Fresh V2 release-check exits1 RECIPE_REFRESH_RELEASE_BLOCKED with
RUNTIME_PROJECTION_LOSS, INGREDIENT_RECONCILIATION_INCOMPLETE,
SOURCE_CONTENT_VERIFICATION_INCOMPLETE and NUTRITION_EVIDENCE_INCOMPLETE.
No code/manifest gate was removed and no advisory was suppressed.

Main protections observed: strict validate/validate-admin, approving reviewer,
stale dismissal/last-push approval and administrator enforcement. Production
Environment requires vn-taphoanhatung, prevents self-review and uses protected
branches. No policy changed. Branch CI is only implementation evidence.

V1rel-bd00a4f53fcaeee4/fingerprint
f8cf8c7ff59df9fe29e246b9e3c9aad0fd155fa8df35bf671ac4d03fa2b5ab37 remains
authoritative. Migration files, runtime authority, household isolation,
inventory commands, Week compatibility, payment/auth code and deployment
workflows are unchanged. Remote D1 mutations, production credentials, feature
flag changes and production deployments0.

Required release sequence: resolve data/security/runtime/review gates; normal
protected PR review/merge; exact-main push CI; exact-source staging/migration
certification if needed; V3 browser/old-consumer/rollback proof; fresh production
ledger/recovery receipts; normal Environment approval; deploy/verify/monitor.
No workflow dispatch is appropriate while this packet remains NOT_READY.

Exact executed checks/failures:14_TEST_STRATEGY.md and
21_PRODUCTION_PREPARATION.md. PR state:handoff/PULL_REQUESTS.md. Source-specific
raw-seafood research remains in research/RAW_SEAFOOD_DECISIONS.md; those public
pages are not validated product protocols or safety approvals.
