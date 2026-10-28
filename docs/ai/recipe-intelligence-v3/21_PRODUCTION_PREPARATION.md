# Production preparation - 2026-10-29 JST

Status: RECIPE_V3_BLOCKED. User requested completion for production deployment.
Preparation follows the normal release path; failed data/security gates,
independent review and production Environment approval remain required.

## Concrete patch

Hono4.13.7 ->4.13.13 (manifest floor4.13.11), compatible major4. Only miniflare's
Undici edge7.29.1 ->7.30.1; Wrangler4.149.0/Miniflare5.20261006.1-alpha/workerd
1.20261006.1 unchanged. Zod specifier/version/integrity and all unrelated
package records unchanged. Scoped override is temporary until upstream adopts
patched Undici; ADR-073 records removal/rollback conditions.

Dedicated Recipe V3 CI validates codex/recipe-v3-** pushes using the original
CI's complete steps, pinned actions and read-only permissions. Admin CI adds
the same push filter. Original customer CI and Admin preflight remain unchanged.
The initial direct CI edit failed its byte guard; dedicated workflow resolved
that conflict. Four regression tests cover branch selection, main/PR validation,
complete steps and no secrets/deployment/Environment authority. Existing Draft
review units33-44 remain separate; focused patch base codex/recipe-v3-safety-07.
Verified implementation 7bdd574bc8ad401efd348e466093d13bf62c6ea3;
[Draft PR45](https://github.com/hello-tako/Takolio/pull/45) OPEN. Later documentation
checkpoint SHA/checks must be resolved separately from Git/PR.

## Actual verification

Node24.16.0/pnpm10.33.2. Frozen install PASS; ignored esbuild/workerd script
warnings retained. Fresh audit improves5high/5moderate to1high/0moderate, exit1:
Zod3.25.76 GHSA-mrhx-c7xc-m3w5 requires>=4.6.6. Bounded max2 reproduction
still parses1,000invalid elements/issues1,001; not an exhaustion benchmark.
No suppression; zod/v3 under an upgraded package does not repair that parser.

Complete local pnpm check PASS exit0;428files/9570tests;951.14s; typecheck/lint, Main/Admin
migration replay and Client/Admin/Worker builds PASS. Log:
/private/tmp/takolio-v3-release-patches-check-v3-workflow.log; .exit=0.
Focused workflow/release262tests and ESLintPASS; earlier focused294tests and
standalone Wrangler32/32PASS. Clean committed Admin validate preflightPASS at
7bdd574b, cleanCheckout=true; source manifestSHA256
6d042015488ced02508ace18add2ea80b1294d3602b01361b165f5b6989f68c4;
readyForDeployment=false,remoteExecuted=false. Earlier dirty preflight, two
interrupted/terminated attempts and full failure425files/9564testsPASS,2failed
(stale branch assertion/Wrangler5s startup) remain recorded. Original test/CI
bytes restored; no timeout, assertion, preflight or release guard weakened.

Separate Main/Admin local migration replay and Client/Admin/Worker buildsPASS;
existing Admin font warnings retained, emitted fonts present. V3 auditPASS500/
44edits/25packets. Public/scoped reviewPASS131artifacts, four constrained
package/lockfile/workflow paths, candidate unchanged, protected drift0 and four
historical status tails unchanged. Exact commands and all failures:
14_TEST_STRATEGY.md. Complete hosted checks on implementation7bdd574b:
[Recipe V3 CI40709482707](https://github.com/hello-tako/Takolio/actions/runs/40709482707)
and [Admin CI40709482552](https://github.com/hello-tako/Takolio/actions/runs/40709482552)
SUCCESS. Admin includes real Workerd boundary, migration matrix, full browser
suite, ten keyboard repeats and screenshot guard. These are branch validation;
V3 runtime/browser/staging and production remain unaccepted. Later documentation
HEAD requires separate exact-head CI; these runs do not cover a new commit.

## Unresolved release prerequisites

V2 release-check exits1 RECIPE_REFRESH_RELEASE_BLOCKED:
RUNTIME_PROJECTION_LOSS, INGREDIENT_RECONCILIATION_INCOMPLETE,
SOURCE_CONTENT_VERIFICATION_INCOMPLETE, NUTRITION_EVIDENCE_INCOMPLETE.
1,395provisional IDs/4,233lines,2,996excluded ingredient lines/2,860reviewed
transformations needed; nutrition1inherited/288blocked/211null. Full culinary
verification0/500, human approvals0/500; six critical safety cases pending.
Located shrimp/crab product marketing is insufficient protocol evidence; both
remain FAIL_UNRESOLVED. See research/RAW_SEAFOOD_DECISIONS.md.

Content-version pinning, old saved-plan/shopping/cooking/offline/rollback
compatibility, V3 browser acceptance and same-source staging are incomplete.
Hono/Undici/CI changes resolve none of those data/runtime requirements.
Zod migration requires reviewed protected PayOS/error-contract compatibility
and new catalog certification; PayOS cannot be edited under this task.
A specific exception request for the Zod migration is pending user reply;
no protected implementation work is authorized by silence. The concrete PayOS
boundaries are src/worker/payment/payos.ts:99 and src/worker/routes/billing.ts:215:
replace one-argument z.record(z.unknown()) with explicit string-key records.
Compatibility also includes auth/validation error.errors readers, web ZodTypeDef
signatures and scripts/planner-openapi.ts's Zod3 internals. Any exception must
retain existing validation, signed-payment reconciliation and error contracts;
catalog continuity still requires actual recertification, never a bypass.

Production sequence: close data/security/runtime/review gates; protected review/
main merge; exact-main CI; exact-source staging and rollback/recovery proof;
normal production Environment approval; deploy/verify/monitor. Main requires
strict validate/validate-admin, one approving reviewer, stale/last-push review
and admin enforcement. Production reviewer vn-taphoanhatung, self-review blocked,
protected branches. No policy changed. Candidate SHA256 remains
0f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4;
V1rel-bd00a4f53fcaeee4/fingerprint
f8cf8c7ff59df9fe29e246b9e3c9aad0fd155fa8df35bf671ac4d03fa2b5ab37
authoritative. No runtime promotion, production credentials, remote D1 mutation,
flag change, deployment, merge or fabricated approval.
