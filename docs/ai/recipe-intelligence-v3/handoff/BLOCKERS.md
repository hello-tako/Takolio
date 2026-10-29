# Current release blockers - 2026-10-29 JST

The local Zod dependency advisory is resolved. The authorized compatibility
migration still needs exact-head hosted validation, independent review and fresh
catalog rollout certification. No audit suppression or continuity bypass.
The four data blockers and all safety/human/runtime/staging gates remain real.

Zod4.6.7 migration is authorized by the owner (ADR-074), including the narrow
PayOS/billing schema/type exception and tests. Local pnpm check PASS exit0:
429files/9597tests/938.60s; typecheck/lint/Main+Admin migrations/builds PASS.
Dependency audit PASS438dependencies/0vulnerabilities, no muted advisories.
Candidate --check500/44/25, seed parity and import500/2batches PASS.
Retained failures, exact commands and warning limits: 14_TEST_STRATEGY.md.

V1release rel-bd00a4f53fcaeee4/fingerprint
f8cf8c7ff59df9fe29e246b9e3c9aad0fd155fa8df35bf671ac4d03fa2b5ab37 unchanged;
candidate SHA2560f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4
unchanged. Production D1 continuity still rejects the changed Zod/foundation
blobs. Fresh reviewed shadow/canary1/canary5/canary25/d1 progression must retain
the same SHA and normal approvals; local parity alone is insufficient.

Fresh V2 release-check FAIL exit1: RUNTIME_PROJECTION_LOSS,
INGREDIENT_RECONCILIATION_INCOMPLETE, SOURCE_CONTENT_VERIFICATION_INCOMPLETE,
NUTRITION_EVIDENCE_INCOMPLETE. Human approval/full culinary verification0/500;
six critical cases pending, raw-shrimp/crab FAIL_UNRESOLVED. Ingredient/source/
nutrition decisions, versioned publication, old saved-plan/shopping/cooking/
offline/rollback compatibility and V3 staging/recovery remain incomplete.
No remote D1 mutation, flag change, merge or deployment. Release NOT_READY.

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
