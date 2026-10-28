# Production preparation update - 2026-10-28 JST

RECIPE_V3_BLOCKED; production NOT_READY. Hono/Undici patches reduce fresh
audit5high/5moderate to1high/0moderate; Zod unresolved. Dedicated read-only
V3 CI plus Admin branch coverage preserve original customer CI/preflight.
Final focused262tests/lint PASS; full gate RUNNING; hosted PENDING. Earlier
full failures/interrupted runs retained in14_TEST_STRATEGY.md. No data/runtime
promotion or deployment. Current evidence:21_PRODUCTION_PREPARATION.md,
17_PRODUCTION_RELEASE_PACKET.md and handoff/CURRENT_CHECKPOINT.md.

The following supplement07 status is historical: unchanged-dependency,
working-branch and full-gate statements refer to that earlier snapshot.
Candidate/evidence/review counts remain unchanged by the production patch.

---

# Recipe Intelligence V3 status

RECIPE_V3_RESEARCH_IN_PROGRESS; RECIPE_V3_INDEPENDENT_REVIEW_REQUIRED; RECIPE_V3_BLOCKED. Full program acceptance remains open.

1,188 source rows / 1,150 distinct URLs / 1,326 claims; 500/500 recipes with bounded external-content claims; 44 reversible edits across 29 recipes. 676 bounded reads; 199 reachable-only/unread; 309 unavailable-only; 4 reachable-and-unavailable. Claims: {"FACT_SUPPORTED": 405, "SOURCE_CONFLICT": 8, "SOURCE_CONTENT_READ": 592, "SOURCE_UNAVAILABLE": 321}. Full culinary verification0/500, human approval0/500, source/runtime promotions0. Bounded facts do not approve an entire recipe.

Supplement07 adds official FDA/CDC evidence and8 new edit paths/1 replacement. Coordinated instruction/tip changes cover salmon, sprouts, grilled shrimp and chicken; six critical cases remain pending. Raw shrimp acid/freezing and crab identity remain FAIL_UNRESOLVED. See research/GAP_RESEARCH_SUPPLEMENTS.md for exact fields, source limits and fingerprint-bound human decisions.

Preserved500 IDs/slugs,6,766 ingredient positions/4,938 steps. Provisional identities1,395/4,233 lines; exact matches0; no approved decisions. Runtime exclusions2,996; reviewed transformations2,860. Nutrition1 inherited publishable/288blocked/211null. P0=6/P1=494; scores UNASSESSED.

Current supplement07 full local gate: PASS, exit0 observed; Test Files  427 passed (427); Tests  9566 passed (9566); Duration  924.13s (transform 6.86s, setup 2.35s, import 48.82s, tests 800.62s, environment 15.33s); typecheck/lint, Main/Admin local migration smoke, Client/Admin/Worker builds PASS. Command `CI=1 PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp pnpm check`; log `/private/tmp/takolio-v3-full-check-supp07.log`. Independent technical review PASS on candidate SHA256 `0f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4`: 500 candidates recompiled with complete metadata; 503 V2 files/51 evidence inputs; 1,500 provenance pointers/3,937 claim pointers/755 fact references; 44 exact reversals across29 recipes; 559 frozen inputs unchanged. No concrete findings; human culinary approval0/500.

Historical V2 release-check exits1 on RUNTIME_PROJECTION_LOSS, INGREDIENT_RECONCILIATION_INCOMPLETE, SOURCE_CONTENT_VERIFICATION_INCOMPLETE and NUTRITION_EVIDENCE_INCOMPLETE. Historical dependency audit exits1:2high/3moderate, including Zod GHSA-mrhx-c7xc-m3w5 and undici GHSA-xjj6-f33q-929c. Dependencies unchanged; these failures remain open. GitHub push additionally reported48 default-branch advisories (8high/37moderate/3low); this hosted warning is separate from the historical local audit and was not independently re-audited. Draft stack33-44 remains open. Supplement07 Draft #44 uses codex/recipe-v3-safety-07, based on #43 (d7ed5cf8900212915246d151d8095602a40a225e); its Draft PR status and remote-head lookup are recorded in docs/ai/recipe-intelligence-v3/handoff/PULL_REQUESTS.md. PR33 historical hosted validate40385562918 and validate-admin40385562692 SUCCESS apply only to its audit/spec head. Later bases are not main; absent hosted checks grant no acceptance. No merge or deployment. Verified implementation `a578b5696389cdb6afeca7530e33b1f4e384690e`. No V3 runtime/browser/staging certification or production mutation. Next: Obtain independent human decisions on the six fingerprint-bound safety cases in research/GAP_RESEARCH_SUPPLEMENTS.md, especially raw-shrimp formulation and raw/pre-cooked crab identity. Review remaining formulation, ingredient, quantity and nutrition evidence. Runtime version pinning/saved-plan/shopping/cooking/offline/rollback integration follows evidence closure; staging and production require separate authority.
