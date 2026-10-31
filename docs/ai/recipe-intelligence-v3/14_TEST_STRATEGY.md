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

# Zod security migration validation - 2026-10-29 JST

ADR-074: owner approved the necessary Zod migration exception, including
PayOS/billing schema/type compatibility and tests. Branch
codex/recipe-v3-zod-security; base904eb0872103524711e63d9fb74a1beeea6b9646.
All commands run locally in /Users/tunbee27/Documents/New project/Takolio-recipe-v3.
Node24.16.0/pnpm10.33.2; prefix for Node commands:
`CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp`.
No production mutation, deployed-version claim or human culinary approval.

| Exact command after prefix | Actual result / local log |
|---|---|
| `pnpm test tests/unit/zod-security-compatibility.test.ts tests/unit/inventory-lot-commands.test.ts tests/integration/inventory-lot-commands.test.ts tests/integration/payment-authority.test.ts tests/unit/backend-planner-openapi.test.ts tests/unit/recipe-intelligence-v3-artifacts.test.mjs` | PASS6files/516tests/35.65s; /private/tmp/takolio-v3-zod-final-focused.log |
| `pnpm test tests/integration/t13b-review-roundtrip.test.tsx tests/unit/ingredient-review-manifest.test.ts tests/unit/ingredient-review-source-buffer.test.ts tests/unit/product-vnext.test.ts tests/unit/slo-report.test.ts` | PASS5files/73tests/4.43s; /private/tmp/takolio-v3-zod-datetime-callers.log |
| `pnpm audit --json` | PASS exit0;438dependencies/0vulnerabilities; /private/tmp/takolio-v3-zod-audit-final.json |
| `node scripts/recipe-intelligence-v3-audit.mjs --check` | PASS500recipes/44edits/25packets; /private/tmp/takolio-v3-zod-candidate-check-final.log |
| `pnpm recipe:seed:check` | PASS59Vietnamese/12global+71runtime/71media byte parity; /private/tmp/takolio-v3-zod-catalog-seed-final.log |
| `pnpm recipe:import:check` | PASS500recipes/2batches/rel-bd00a4f53fcaeee4; /private/tmp/takolio-v3-zod-catalog-import-final.log |
| `pnpm check` | PASS exit0;429files/9597tests/938.60s; typecheck/lint, Main/Admin local migration replay and Client/Admin/Worker builds PASS; /private/tmp/takolio-v3-zod-final-check.log and .exit=0 |
| `pnpm recipe:refresh:release-check` | FAIL exit1; four retained data blockers; /private/tmp/takolio-v3-zod-v2-release-check.log |
| `python3 /private/tmp/takolio-v3-zod-scope-review.py` (no Node prefix) | PASS exact dependency/payment/auth/type deltas, unchanged production fence/candidate and five historical status tails; /private/tmp/takolio-v3-zod-scope-review-result.json |
| `python3 scripts/admin-public-scan.py` (no Node prefix) | PASS added text; binary/manual limits retained |
| `git diff --check` | PASS |

Publication verification: implementation `7c4d8700c0e1d4bd78a51007f7fdb0d46ae82091`;
PR46 review HEAD `9049f346372dbc9ed515e572f3d66fbc75c2fc18` on codex/recipe-v3-release-patches.
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

Exact readbacks: `gh run view 40860409614 --json headSha,status,conclusion,url`,
`gh run view 40860409658 --json status,conclusion,headSha,jobs,url`,
`gh run view 40860038264 --json headSha,conclusion,status` and
`gh run view 40860038241 --json headSha,conclusion,status`.
Complete hosted logs downloaded with `gh run view <run-id> --log` to
/private/tmp/takolio-v3-zod-head-recipe-ci-complete.log and
/private/tmp/takolio-v3-zod-head-admin-ci-complete.log.
Clean committed local preflight command:
`PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/admin-release-preflight.mjs`;
log /private/tmp/takolio-v3-zod-head-preflight.log. GitHub's warning of48
default-branch advisories is separate from branch audit0; no main certification.

## Documentation and research continuation

Branch `codex/recipe-v3-readiness-evidence` starts at `9049f346372dbc9ed515e572f3d66fbc75c2fc18`;
documentation only, PR46 head unchanged. Four additional public retrievals: CAA category index, two category PDFs
(all5pages extracted/rendered/read) and expanded Nissui90147 grilling FAQ.
These establish bounded category context and a manufacturer grilling use,
but no validated shrimp SKU/lot/process or crab grill endpoint. Both cases stay
FAIL_UNRESOLVED; no candidate/source/nutrition promotion or approval. Raw caches
stay private; retrieval bindings and limits: research/RAW_SEAFOOD_DECISIONS.md.


| Exact executed check | Actual result |
|---|---|
| `python3 /private/tmp/takolio-v3-caa-provenance-check.py` | PASS4retrievals/8hashes/5PDFpages/2HTMLlocatorranges; candidate unchanged/code-data drift0 |
| `python3 /private/tmp/takolio-v3-zod-scope-review.py` | PASS50code paths/exact protected changes; production fence/candidate unchanged; five historical state tails preserved |
| `python3 scripts/admin-public-scan.py` | PASS added text; binary/manual limits retained |
| `git diff --check` | PASS |

Protection readbacks /private/tmp/takolio-v3-final-main-protection.json and
/private/tmp/takolio-v3-final-production-protection.json preserve strict checks,
independent review and production Environment gates. No protection mutation.
The old product-research checker has a fixed14Markdown-file historical scope;
it is not the current migration scope check. No claim of rerunning that old
checker against the expanded authorized migration. No local full-suite rerun
for these documentation edits. New documentation HEAD needs its own hosted CI;
its final SHA/results belong in the PR body without another recursive docs push.

The focused six-file run preceded the final one-line assertion that decodes the
result with InventoryLotSchema and the SLO relative-import correction. The
full gate covers those final edits; the five-file run covers affected decoders.
The complete build retained upstream Zod Rollup annotation warnings and existing
Admin font-resolution warnings; builds completed and font assets were emitted.
The error-boundary test intentionally logged its synthetic "secret stack detail".
Concurrent Vite helper checks emitted Port24678-in-use warnings but returned
exit0 with the expected artifact/seed results. No network release was involved.

Retained failures: earlier full run exit1,8failed/421passed files,
13failed/9510passed tests,966.08s; /private/tmp/takolio-v3-zod-full-check.log.
It loaded source while datetime fixes were in progress, causing undefined
helper exports and a wrong SLO import; it also observed pre-regeneration
baseline drift and colonless-offset rejection. This is failed evidence, not
certification. Corrected import is ../../../packages/domain/src/foundation.
Earlier typecheck failure TS2307 is retained in
/private/tmp/takolio-v3-zod-typecheck-datetime.log. Initial scoped candidate
check failed generated baseline drift; regeneration then passed, and the
final --check passed without further candidate changes. Earlier focused
payment tests had four fixture failures (seeded subscription and it.each array
flattening); compare unchanged before/after tables and preserve actual [] in
object cases. Earlier8files/321tests passed; these do not replace final gates.
No test timeout, assertion, release guard, migration or CI policy was weakened.

Independent read-only technical review found timestamp grammar drift, fixed
with shared compatibility schemas. Reviewer probed1,170 datetime combinations
and record edge cases against Zod3, found no remaining concrete issue and ran
git diff --check. It did not run the full suite and supplies no human approval.
Persistent regressions exercise early oversized-array rejection, defaults,
HTTP400/custom/flattened validation errors, five auth invalid requests, four
nonrecord payment requests with unchanged tables, OpenAPI rejection/markers,
legacy timestamp bytes and persisted inventory command replay.

Catalog evidence remains local: V1fingerprint
f8cf8c7ff59df9fe29e246b9e3c9aad0fd155fa8df35bf671ac4d03fa2b5ab37;
candidate SHA2560f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4.
The unchanged production continuity fence rejects the changed Zod dependency
and foundation blobs. Fresh reviewed continuity strategy, exact-main CI,
same-source staging/recovery and normal Environment approval remain required.

---

# Production preparation checks - 2026-10-29 JST

Scope relative to f637134b4a337443b375985021d0d3bfc42a9e87:
Hono4.13.13/miniflare-only Undici7.30.1, dedicated read-only V3 CI/Admin
branch coverage, four regression tests, ADR-073 and release/handoff updates.
Original customer ci.yml, preflight, release-check test, candidate, catalog,
Zod dependency/integrity, migrations and runtime code remain byte-identical.

Commands below used Node24.16.0/pnpm10.33.2. Shell PATH was
`/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin`; local gates used
`TMPDIR=/private/tmp`, full/focused Vitest used `CI=1` unless stated otherwise.

| Exact executed command | Observed result |
|---|---|
| `pnpm install --lockfile-only --ignore-scripts --offline` | PASS; scoped lockfile transformations reviewed |
| `pnpm install --frozen-lockfile` | PASS; existing ignored esbuild/workerd script warnings retained |
| `pnpm audit --json` before patch | FAIL exit1;5high/5moderate/438dependencies; /private/tmp/takolio-v3-production-audit.json |
| `pnpm audit --json` after patch | FAIL exit1;1high/0moderate/438dependencies; Zod3.25.76 GHSA-mrhx-c7xc-m3w5; /private/tmp/takolio-v3-production-audit-patched.json |
| `pnpm exec vitest run tests/unit/recipe-v3-ci.test.mjs` | PASS1file/4tests; /private/tmp/takolio-v3-ci-trigger-test.log; initial workflow design |
| `pnpm exec eslint tests/unit/recipe-v3-ci.test.mjs` | PASS, including final dedicated-workflow test |
| `pnpm check` first attempt | Interrupted during Vitest; typecheck/lintPASS; /private/tmp/takolio-v3-release-patches-check.log |
| `pnpm check` replacement | FAIL exit1;425files/9564testsPASS;2files/2testsFAIL;956.14s; /private/tmp/takolio-v3-release-patches-check-rerun.log |
| `pnpm exec vitest run tests/unit/staging-d1-catchup-check.test.mjs -t 'is readable by Wrangler locally'` | PASS1/31skipped,4.52s; /private/tmp/takolio-v3-release-patches-wrangler-focused.log |
| `pnpm exec vitest run tests/unit/staging-d1-catchup-check.test.mjs` | PASS32/32,6.25s; /private/tmp/takolio-v3-release-patches-wrangler-file.log |
| `pnpm exec vitest run tests/unit/release-check.test.mjs tests/unit/recipe-v3-ci.test.mjs tests/unit/staging-d1-catchup-check.test.mjs` | PASS3files/294tests,8.37s; /private/tmp/takolio-v3-release-patches-focused.log; intermediate branch expectation update subsequently restored |
| `pnpm exec eslint tests/unit/release-check.test.mjs tests/unit/recipe-v3-ci.test.mjs` | PASS; intermediate test change subsequently restored |
| `pnpm check` intermediate rerun | Terminated exit143 after workflow design changed; no complete result; /private/tmp/takolio-v3-release-patches-check-final.log |
| `node scripts/admin-release-preflight.mjs` initial direct customer-CI edit | FAIL exit1, Customer release surface changed: .github/workflows/ci.yml; /private/tmp/takolio-v3-release-patches-admin-preflight.log |
| `node scripts/admin-release-preflight.mjs` after restoring customer CI | PASS validate mode; cleanCheckout=false; readyForDeployment=false; remoteExecuted=false; no preflight/baseline changes |
| `node scripts/admin-release-preflight.mjs` committed implementation7bdd574b | PASS cleanCheckout=true; sourceSha7bdd574bc8ad401efd348e466093d13bf62c6ea3; manifestSHA2566d042015488ced02508ace18add2ea80b1294d3602b01361b165f5b6989f68c4; readyForDeployment=false;remoteExecuted=false |
| `pnpm exec vitest run tests/unit/recipe-v3-ci.test.mjs tests/unit/release-check.test.mjs` final workflow | PASS2files/262tests,2.30s; /private/tmp/takolio-v3-release-patches-workflow-focused.log |
| `pnpm check` final dedicated-workflow tree | PASS exit0;428files/9570tests;951.14s; typecheck/lint/migrations/buildPASS; /private/tmp/takolio-v3-release-patches-check-v3-workflow.log; .exit=0 |
| `pnpm check:migrations` separate run | PASS Main/Admin local replay; /private/tmp/takolio-v3-release-patches-migrations.log |
| `pnpm build` separate run | PASS Client/Admin/Worker; existing Admin font-resolution warnings, emitted fonts present; /private/tmp/takolio-v3-release-patches-build.log |
| `node scripts/recipe-intelligence-v3-audit.mjs --check` | PASS500recipes/44edits/25packets; four release blockers retained |
| `pnpm recipe:refresh:release-check` | FAIL exit1,RECIPE_REFRESH_RELEASE_BLOCKED; four actual data blockers; canonical500PASS |
| `python3 /private/tmp/takolio-v3-release-patches-review.py` | PASS131artifacts; four exact dependency/CI transformations; candidate/customerCI unchanged; protected drift0; historical tails4preserved |
| `python3 scripts/admin-public-scan.py` | PASS added text; binary/manual limits retained |
| `git diff --check` | PASS |
| `git fetch origin main --no-tags`; repository/PR44/protection/Environment readback | repo1422954151/mainb49f3e6c; Draft44OPEN/f637134b/no checks; strict validate/validate-admin,1reviewer/stale/last-push/admin enforcement; production reviewer/self-review/protected-branch gates unchanged |

The two failed tests were a stale exact branch-list assertion in release-check
and Wrangler local startup exceeding its default5s timeout (5.229s observed).
Standalone Wrangler32/32 passed; timing cause beyond startup/load remains
unproven. No timeout/retry/assertion change was made. Dedicated V3 CI restores
the original release-check/customer-CI bytes; Admin preflight now accepts them.
The earlier direct edit was abandoned after the real guard failure; no guard
was removed, baseline advanced, or file excluded from preflight.

Scoped reviewer preserves the original125-artifact checker. It constrains the
entire package/lockfile, Admin filter-only change and new workflow (original CI
steps/permissions, V3-only header). Only those four exact files are exempted
from the older zero-diff rule. The focused test is the fifth permitted code
path. All other workflows, runtime/payment/auth/catalog/migrations and four
historical tails retain byte assertions. Initial temporary reviewer extension
failed NameError:git_file before review; corrected to existing prior(), rerunPASS.

Bounded Zod reproduction: array max2 visits1,000invalid entries/issues1,001;
no exhaustion benchmark. Patched>=4.6.6; zod/v3 retains affected parser.
Protected PayOS one-argument z.record/error contracts and catalog Zod continuity
need reviewed migration/recertification. No advisory muted.

Hosted implementation 7bdd574bc8ad401efd348e466093d13bf62c6ea3:

| Exact readback command | Complete result |
|---|---|
| `gh run view 40709482707 --repo hello-tako/Takolio --json status,conclusion,headSha,jobs` | [Recipe V3 CI](https://github.com/hello-tako/Takolio/actions/runs/40709482707) SUCCESS; validate lint/typecheck/full tests/migrations/build |
| `gh run view 40709482552 --repo hello-tako/Takolio --json status,conclusion,headSha,jobs` | [Admin CI](https://github.com/hello-tako/Takolio/actions/runs/40709482552) SUCCESS; full tests/migrations/build/preflight, real Workerd boundary, migration matrix, browser regression, ten keyboard repeats and screenshot guard |
| `gh pr view 45 --repo hello-tako/Takolio --json state,isDraft,headRefName,baseRefName,reviewDecision,statusCheckRollup` | OPEN/Draft;codex/recipe-v3-release-patches ->codex/recipe-v3-safety-07; no approval inferred |

Final evidence reconciliation:
`python3 /private/tmp/takolio-v3-release-patches-certify-ci.py` PASS; exact SHA,
local exit0/log counts and every required hosted job/step checked against fresh
GitHub responses. Receipt:/private/tmp/takolio-v3-release-patches-final-evidence.json.
Final documentation checks: `python3 /private/tmp/takolio-v3-release-patches-review.py`
PASS (131artifacts;500recipes;25packets;1,188sources;1,150URLs;1,326claims;
protected drift0;four historical tails preserved); `python3 scripts/admin-public-scan.py`
PASS (added text only; binary/manual caveat); `git diff --check` PASS.
No full suite repeated for the documentation checkpoint; its hosted checks are
separate and must be read from the current PR HEAD.

These runs bind implementation7bdd574b; later documentation-only commits need
their own exact-head CI and are never labeled covered by older runs. Branch
success never substitutes for exact-main CI, V3 browser/staging/recovery,
independent human approval or production approval.
Production/remoteD1mutations0. Current packet:21_PRODUCTION_PREPARATION.md.
Historical product/supplement records follow unchanged.

---

# Autonomous product research checks - 2026-10-28 JST

Documentation only, relative to `56d077e172e14aa3505afd4d9f4aec1272f14c05`:
user directions plus six public product/context pages, bounded summaries,
retrieval times, 12 snapshot hashes and source locators. No canonical data,
source-status, candidate, dependency or runtime changes. Candidate SHA256 remains
`0f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4`.
The full supplement07 gate covers unchanged code/data; not repeated for docs.
No current application-browser, staging or release acceptance. Research browser
inspection is source reading, not application acceptance or safety validation.

| Exact executed command | Observed result |
|---|---|
| `python3 /private/tmp/takolio-v3-product-research.py` | Four publisher pages cached HTTP200; strict decoding, raw/text hashes and locators |
| `python3 /private/tmp/takolio-v3-product-research-astra.py` | Two Astra pages cached HTTP200, preserving four earlier snapshots; certificate page says Updating data |
| `python3 /private/tmp/takolio-v3-product-research-check.py` | PASS 6 public pages / 12 snapshot hashes / 17 locator ranges / 14 Markdown files; candidate/canonical/protected paths unchanged; safety pending |
| `python3 /private/tmp/takolio-v3-supp08-culinary/check-packet.py` | PASS prior 2 cases / 5 observations / 14 cache hashes and exact description locators; its unavailable product is the historical suspended shop |
| `python3 /private/tmp/takolio-v3-seafood-decisions-check.py` | PASS 2 cases / 26 JSON pointers / 6 options, source hashes and Markdown links / 14 documentation files; its PENDING decisions refer to the historical unselected packet, not the later user research choices |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check` | PASS 500 recipes / 44 edits / 25 packets, four release blockers retained |
| `python3 /private/tmp/takolio-v3-review-artifacts.py` | PASS 125 changed/untracked artifacts, 500 recipes / 1,188 sources / 1,326 claims, protected drift 0, four historical tails preserved |
| `python3 scripts/admin-public-scan.py` | PASS added text; binary/manual scope limits retained |
| `git diff --check b49f3e6c4fc2f1485b77623ed7257d0f8bd31f9a` | PASS |

Initial product checker ran before this 14th Markdown file was updated; its
14-file assertion failed while only 13 files were changed. No provenance or
candidate assertion failed; rerun after completing documentation PASS.
The search-service connector was unavailable, not successful; browser plus
stdlib retrieval provided the fallback. An unavailable `bs4` import was replaced
with stdlib `HTMLParser`; no dependency added. Product/process marketing and the
historical 2001 MHLW report do not establish validated raw-shrimp service, current
law, exact crab grilling instructions or human culinary approval. Full raw source
files remain private; only hashes/locators and bounded summaries are published.

The following documentation checks describe the prior checkpoint; their independent
agent review does not cover the later user-direction/product-research delta.

# Documentation continuation - 2026-10-28 JST

Changes: RAW_SEAFOOD_DECISIONS.md and status/review links only, relative to
`90c5b221b3c4e3c1d878c4edb5dab7f5f07465cb`. Candidate SHA256 remains
`0f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4`.
The full supplement07 gate below covers unchanged code/data; it was not rerun
for this documentation continuation. No current browser/staging/release claim.

| Exact executed command | Observed result |
|---|---|
| `python3 /private/tmp/takolio-v3-supp08-culinary/check-packet.py` | PASS 2 cases / 5 bounded observations / 14 cache hashes, V2/candidate snapshots and exact description locators; video/captions unread; product unavailable |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check` | PASS 500 recipes / 44 edits / 25 batches; four genuine release blockers retained |
| `python3 /private/tmp/takolio-v3-seafood-decisions-check.py` | PASS 2 cases / 26 existing JSON pointers / 6 options, source hashes, Markdown links; 14 documentation-only files; candidate unchanged |
| `python3 /private/tmp/takolio-v3-review-artifacts.py` | PASS changed/untracked text/JSON, protected drift 0, four historical tails preserved |
| `python3 scripts/admin-public-scan.py` | PASS added text; binary/manual limits retained |
| `git diff --check b49f3e6c4fc2f1485b77623ed7257d0f8bd31f9a` | PASS |

The temporary culinary packet is research provenance, not human review. Its five
observations are bounded decision evidence in the document; no canonical claims,
source statuses, candidate edits or approvals were added. All historical failures
and open dependency advisories below remain open. The initial temporary documentation
writer failed with `IndentationError: unexpected indent` before any repository write;
parenthesizing the multiline string corrected the writer. Documentation checks pass.

Independent agent documentation review found no concrete issues across all 14
Markdown changes: four historical tails byte-identical, candidate hash unchanged,
26 JSON pointers, six options and 14 cache hashes checked; no code/data drift.
Review included bounded PDF/Iwamoto/YouTube-description/suspension text and both
temporary checkers. Video/captions, human culinary approval and a repeated full
gate remain outside that review.

# Current supplement07 checks

Environment: macOS, Node24.16.0, Python3; isolated V3 worktree; TMPDIR=/private/tmp. Verified data implementation `a578b5696389cdb6afeca7530e33b1f4e384690e`, candidate SHA256 `0f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4`. Documentation-only changes follow this tested data snapshot.

Current supplement07 full local gate: PASS, exit0 observed; Test Files  427 passed (427); Tests  9566 passed (9566); Duration  924.13s (transform 6.86s, setup 2.35s, import 48.82s, tests 800.62s, environment 15.33s); typecheck/lint, Main/Admin local migration smoke, Client/Admin/Worker builds PASS. Command `CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm check`; log `/private/tmp/takolio-v3-full-check-supp07.log`. This gate includes the persistent artifact test and supplements04-07. Existing Admin font build warnings retain their original scope; see actual log.

| Exact executed command | Observed result |
|---|---|
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs` | PASS500recipes/44edits/25batches; four inherited blockers retained |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check` | PASS exact generated outputs/source hashes/claim ownership/candidate fingerprints |
| `python3 /private/tmp/takolio-v3-supp07-agent/check-proposal.py` | PASS3V2 hashes/5official raw-text hashes/10locators/5proposed edits/32retrieval attempts; proposal-only scope |
| `python3 /private/tmp/takolio-v3-supplement07-review.py` | PASS canonical500V1/500V2,1,319 prior claims/1,180 sources/36 prior edits-history;7incoming claims/208metadata fields/1,190links/5caches/13locators |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node /private/tmp/takolio-v3-independent-review.mjs` | PASS500recompiled/44reversals;1,500provenance/3,937claim pointers/755facts/559frozen inputs |
| `python3 /private/tmp/takolio-v3-review-artifacts.py` | PASS full changed/untracked text/JSON/bounded summaries; protected drift0; four historical tails preserved |
| `python3 scripts/admin-public-scan.py` | PASS added text; binary/manual limits retained |
| `git diff --check b49f3e6c4fc2f1485b77623ed7257d0f8bd31f9a` | PASS full base-to-worktree diff |

Independent technical review PASS on candidate SHA256 `0f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4`: 500 candidates recompiled with complete metadata; 503 V2 files/51 evidence inputs; 1,500 provenance pointers/3,937 claim pointers/755 fact references; 44 exact reversals across29 recipes; 559 frozen inputs unchanged. No concrete findings; human culinary approval0/500. Historical V2 release-check exits1 on RUNTIME_PROJECTION_LOSS, INGREDIENT_RECONCILIATION_INCOMPLETE, SOURCE_CONTENT_VERIFICATION_INCOMPLETE and NUTRITION_EVIDENCE_INCOMPLETE. Historical dependency audit exits1:2high/3moderate, including Zod GHSA-mrhx-c7xc-m3w5 and undici GHSA-xjj6-f33q-929c. Dependencies unchanged; these failures remain open. GitHub push additionally reported48 default-branch advisories (8high/37moderate/3low); this hosted warning is separate from the historical local audit and was not independently re-audited. No additional focused rerun is necessary when the current full gate passes; its29 V3 tests are included.

Supplement07 checker first looked for replaced chicken edit history in the edits packet; corrected to its owning evidence recipe without canonical change. Earlier urllib FDA404 was abuse detection; complete curlHTTP200 was subsequently read. No publisher outage claimed. Raw caches remain private; repository packets retain hashes, summaries and locators.

Source-cache01-06 checks and the full gates below are historical. They do not supersede current07 results. No V3 browser, staging, runtime compatibility or production certification. All four release blockers and human review remain open.

---

The following supplement06 record is historical; its current/final wording applies only to that earlier snapshot.

<!-- supplement06-history -->
# Test strategy and observed results

Environment: macOS, Node24.16.0 (`/opt/homebrew/opt/node@24/bin`), Python3, TMPDIR=/private/tmp, isolated V3 worktree. No remote database or deployment checks.

## Current checkpoint

Full gate completed on the pre-supplement04-06 snapshot before the new persistent artifact test. It passed427 files/9565 tests/923.26s. Final06 focused29 tests cover subsequent data/test changes. No current-snapshot full-suite claim. Existing Admin font build warnings retained.

| Exact command | Observed result |
|---|---|
| `CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm check` | PASS, exit 0 observed; Test Files  427 passed (427); Tests  9565 passed (9565); typecheck/lint, Main/Admin migration smoke, Client/Admin/Worker builds PASS; log `/private/tmp/takolio-v3-current-full-check.log` |
| `CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm test tests/unit/recipe-intelligence-v3.test.mjs tests/unit/recipe-intelligence-v3-artifacts.test.mjs` | PASS2files/29tests; session91061, final06 rerun4.07s; log /private/tmp/takolio-v3-focused-final06.log |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs` | PASS rebuild500 recipes/36edits/25batches; no source promotion |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check` | PASS exact generated artifacts, V1/V2 hashes, claims, edit pointers, candidates and four retained blockers |
| `node scripts/recipe-intelligence-v3-source-scan.mjs self-check` | PASS parser and URL/address boundaries; no network |
| `node scripts/recipe-intelligence-v3-source-scan.mjs check` | PASS500 discovery attempts/488 initial URLs; persisted evidence only |
| `python3 scripts/recipe-intelligence-v3-ingredient-exact.py` | PASS45 registry entries/204 keys; exact0, unresolved1395; pending/no-promotion |
| `python3 /private/tmp/takolio-v3-gap-research-01-check.py` | PASS10 reviews/15claims/9 proposed edits; historical supplement01 cache scope |
| `python3 /private/tmp/takolio-v3-gap-research-02-check.py` | PASS30 reviews/47claims/10 proposed edits; exact edit-pointer source support |
| `python3 /private/tmp/takolio-v3-gap-research-03-check.py` | PASS57 reviews/175claims/0edits;75 bounded reads/85fact refs; hashes/locators/PDF extraction |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node /private/tmp/takolio-v3-independent-review.mjs` | No concrete technical findings on current snapshot 16d8f05ae328184dcaa5797c733271692fa5d804b4d7c7ab9fd8dffc32f09838; recompiled500, provenance1500, claim pointers3914, fact refs741, reversed36 edits. Human culinary approval remains0. |
| `python3 /private/tmp/takolio-v3-gap-research-04-check.py` | PASS8 reviews/46source records/17locators/36fact refs; retained retrieval history |
| `python3 /private/tmp/takolio-v3-gap-research-05-check.py` | PASS4 reviews/17claims/12fact refs; exact V2 formulations verified0 |
| `python3 /private/tmp/takolio-v3-gap-research-06-check.py` | PASS28raw/text hashes/10locators/10fact refs/6V1+6V2 hashes/4oldValue pointers; appliedEdits0 describes temp research before integration |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec eslint tests/unit/recipe-intelligence-v3-artifacts.test.mjs scripts/recipe-intelligence-v3-audit.mjs` | PASS |
| `python3 /private/tmp/takolio-v3-supplement-final-review.py` | PASS final post-apply preservation review;500V1/500V2 hashes,682prior claim prefixes,583prior sources,64incoming claims,1316metadata fields,42facts,1181reciprocal links |
| `python3 /private/tmp/takolio-v3-supp06-review-check.py` | PASS4cached official raw/visible hashes,3cited documents,4exact edits,2unmodified critical salmon pointers |
| `python3 /private/tmp/takolio-v3-review-artifacts.py` | PASS full changed/untracked text/JSON/bounded-summary review; protected drift0; all4 historical tails preserved |
| `python3 scripts/admin-public-scan.py` | PASS added text; binary/manual-review limits retained |
| `git diff --check` | PASS; final result recorded in audit/TECHNICAL_REVIEW.md |

Current research reports contain shared runnable audit --check. Original fixed-count Python/sh fences are explicitly historical text. The earlier14 embedded checks passed their initial snapshot; they are not current supplement validation. Temporary raw HTML/PDF/text caches are session evidence only; canonical packets retain hashes, bounded summaries and exact fact locators.

## Historical completed checks

Before test splitting and supplements, full local `CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm check` PASS exit0:426files/9565tests/942.89s, typecheck/lint, Main/Admin migration smoke, Client/Admin/Worker builds. Log `/private/tmp/takolio-v3-full-check-resumed.log`, completed41961. Not exact-current dataset proof. Earlier attempt `/private/tmp/takolio-v3-full-check-final.log` failed/incomplete during Vitest; retained.

With `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp`: `pnpm recipe:seed:check` PASS59Vietnamese+12global/71runtime; `pnpm recipe:import:check` PASS500/2batches; `pnpm recipe:refresh:check` PASS500, canonical artifact da87da20475fa8d7ec92c716e899ee572339573258ae6d9cc7f3f8f554f2d695; `pnpm recipe:ingredient-v2:audit` PASS6766/2996excluded/2860review. Source paths remain unchanged.

## Failures and limits

`PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm recipe:refresh:release-check`: exit1, `RECIPE_REFRESH_RELEASE_BLOCKED`; four inherited blockers; `/private/tmp/takolio-v3-release-check.log`. Expected refusal, not release acceptance.

`PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm audit --audit-level=high`: exit1,2high/3moderate; `/private/tmp/takolio-v3-dependency-audit-final.log`; high Zod GHSA-mrhx-c7xc-m3w5, undici GHSA-xjj6-f33q-929c. Dependency/lockfile unchanged.

The old supplement05 pre-apply integration checker fails against integrated canonical state at its prior-source assertion; post-apply preservation assertions now pass. Supplement06 reviewer check first assumed all four cached documents must be canonical citations; only three were cited. Correcting the checker assumption passed without canonical changes. Corrected CI mutation reproduction uses each fixture as process.cwd(); earlier --root-only evidence is superseded. See audit/TECHNICAL_REVIEW.md.

Supplement06 first integration failed a linked-source count assertion before writes; removed that unnecessary hardcode. Audit then rejected overly broad source ownership; narrowed four source recipeIds to actual linked claims and rebuilt successfully. The unchanged audit guard caught the issue. Persistent CI artifact check closes the previously uncovered unchanged-candidate/generated-artifact drift gap; mutation reproduction and final review are recorded in audit/TECHNICAL_REVIEW.md.

Supplement02 initially lacked exact field support for3 edits; added3 source claims before integration, checker now enforces exact pointers. Supplement05 initial integration assertion raised KeyError for recipe-level runtime flag; corrected to established packet-level flag, checker PASS. Supplement03 initial salmon locator missed an anchor; expanded lines30-52, removed unsupported fresh-only assertion. Historical UnicodeEncodeError is retrieval failure, not publisher outage. Neither issue is relabeled source confirmation.

PR33 hosted validate40385562918 and validate-admin40385562692 SUCCESS; REVIEW_REQUIRED. Stacked PR34-43 have no hosted CI acceptance; documentation PR must be checked separately. No human culinary approval, V3 browser acceptance, same-source staging certification or production action. Full culinary and safety review, ingredient decisions, nutrition evidence, runtime snapshots, saved-plan/shopping/cooking/offline/rollback compatibility and fresh release gates remain required.
