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

# Production preparation update - 2026-10-29 JST

RECIPE_V3_BLOCKED; production NOT_READY. Authorized Zod4.6.7 migration fixes
GHSA-mrhx-c7xc-m3w5; fresh dependency audit PASS438dependencies/0vulnerabilities.
Complete local gate PASS429files/9597tests; lint/typecheck/migrations/builds PASS.
Verified security implementation7c4d8700; Draft PR46 on codex/recipe-v3-release-patches.
PR46 HEAD9049f346 passed Recipe40860409614/Admin40860409658, including browser
and Workerd. Exact hosted observations and release limits:14_TEST_STRATEGY.md
and handoff/PULL_REQUESTS.md; parent checks never certify a
later HEAD. Independent review, fresh catalog certification and all four inherited
data gates still block release. Human approvals/full culinary verification0/500.

CAA category standards and the Nissui grilling FAQ add bounded research context,
not product/process validation. Raw shrimp/crab stay FAIL_UNRESOLVED; six safety
reviews remain pending. See research/RAW_SEAFOOD_DECISIONS.md. Candidate SHA256
0f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4 unchanged.

The following supplement07 status is historical. Its dependency/branch/test
statements describe that earlier snapshot; the Zod/Undici findings are superseded
by ADR-073/074 and the current audit. Data/evidence/review counts remain unchanged.

---

# Recipe Intelligence V3 status

RECIPE_V3_RESEARCH_IN_PROGRESS; RECIPE_V3_INDEPENDENT_REVIEW_REQUIRED; RECIPE_V3_BLOCKED. Full program acceptance remains open.

1,188 source rows / 1,150 distinct URLs / 1,326 claims; 500/500 recipes with bounded external-content claims; 44 reversible edits across 29 recipes. 676 bounded reads; 199 reachable-only/unread; 309 unavailable-only; 4 reachable-and-unavailable. Claims: {"FACT_SUPPORTED": 405, "SOURCE_CONFLICT": 8, "SOURCE_CONTENT_READ": 592, "SOURCE_UNAVAILABLE": 321}. Full culinary verification0/500, human approval0/500, source/runtime promotions0. Bounded facts do not approve an entire recipe.

Supplement07 adds official FDA/CDC evidence and8 new edit paths/1 replacement. Coordinated instruction/tip changes cover salmon, sprouts, grilled shrimp and chicken; six critical cases remain pending. Raw shrimp acid/freezing and crab identity remain FAIL_UNRESOLVED. See research/GAP_RESEARCH_SUPPLEMENTS.md for exact fields, source limits and fingerprint-bound human decisions.

Preserved500 IDs/slugs,6,766 ingredient positions/4,938 steps. Provisional identities1,395/4,233 lines; exact matches0; no approved decisions. Runtime exclusions2,996; reviewed transformations2,860. Nutrition1 inherited publishable/288blocked/211null. P0=6/P1=494; scores UNASSESSED.

Current supplement07 full local gate: PASS, exit0 observed; Test Files  427 passed (427); Tests  9566 passed (9566); Duration  924.13s (transform 6.86s, setup 2.35s, import 48.82s, tests 800.62s, environment 15.33s); typecheck/lint, Main/Admin local migration smoke, Client/Admin/Worker builds PASS. Command `CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm check`; log `/private/tmp/takolio-v3-full-check-supp07.log`. Independent technical review PASS on candidate SHA256 `0f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4`: 500 candidates recompiled with complete metadata; 503 V2 files/51 evidence inputs; 1,500 provenance pointers/3,937 claim pointers/755 fact references; 44 exact reversals across29 recipes; 559 frozen inputs unchanged. No concrete findings; human culinary approval0/500.

Historical V2 release-check exits1 on RUNTIME_PROJECTION_LOSS, INGREDIENT_RECONCILIATION_INCOMPLETE, SOURCE_CONTENT_VERIFICATION_INCOMPLETE and NUTRITION_EVIDENCE_INCOMPLETE. Historical dependency audit exits1:2high/3moderate, including Zod GHSA-mrhx-c7xc-m3w5 and undici GHSA-xjj6-f33q-929c. Dependencies unchanged; these failures remain open. GitHub push additionally reported48 default-branch advisories (8high/37moderate/3low); this hosted warning is separate from the historical local audit and was not independently re-audited. Draft stack33-44 remains open. Supplement07 Draft #44 uses codex/recipe-v3-safety-07, based on #43 (d7ed5cf8900212915246d151d8095602a40a225e); its Draft PR status and remote-head lookup are recorded in docs/ai/recipe-intelligence-v3/handoff/PULL_REQUESTS.md. PR33 historical hosted validate40385562918 and validate-admin40385562692 SUCCESS apply only to its audit/spec head. Later bases are not main; absent hosted checks grant no acceptance. No merge or deployment. Verified implementation `a578b5696389cdb6afeca7530e33b1f4e384690e`. No V3 runtime/browser/staging certification or production mutation. Next: Obtain independent human decisions on the six fingerprint-bound safety cases in research/GAP_RESEARCH_SUPPLEMENTS.md, especially raw-shrimp formulation and raw/pre-cooked crab identity. Review remaining formulation, ingredient, quantity and nutrition evidence. Runtime version pinning/saved-plan/shopping/cooking/offline/rollback integration follows evidence closure; staging and production require separate authority.
