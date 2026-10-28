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
