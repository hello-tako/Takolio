# Nine-region production release result - 2026-10-12 JST

**Task/status:** PRODUCTION_VERIFIED_WITH_EXTERNAL_ACCEPTANCE_OPEN.
Repository hello-tako/Tako-san, ID 1385308553. PR #69 MERGED through required
checks without bypass; implementation 0d8bc26bfc0ee896270978d8bd3affdfc57d4584.
Exact deployed release source: d63321af13d81a20a3f19f12969030fe353376b9.
User authorizes production upgrade; AI budget USD 0, no real OTP or live payment
tests. This documentation checkpoint is not a new runtime deployment.

**Changes:** Turnstile lifecycle/loader fixes, typed auth/provider/queue boundaries,
shared validated billing contract and additive 0041 are integrated. New checkout
admission remains default OFF; no-key checkout, PayOS signatures, prices and
pending-only grants remain. Scanner policy stays a non-executable candidate.
AI V3/provider, Ingredient V2 and Product VNext remain dormant. Applied 0040,
config, lock and deploy bytes unchanged. See ADR-RELEASE-001 and the actual receipt.

**Verification:** Local pnpm check PASS: 330 files / 7705 tests; lint, both
TypeScript projects, 41-migration replay, exact paired build and actual local
workerd schema PASS. Exact PR CI 38232271283 and main CI 38233405702 SUCCESS,
7705 tests each. Production deploy also reruns 330 files / 7705 tests PASS,
476.84s total. Local three-engine default-off/mock-opt-in browser checks PASS:
12 cases / 24 screenshots. Dependency audits 0. Exact implementation scanner
4867 files: Semgrep/zizmor 0; Syft 504 declared components; Gitleaks raw 17/exit 1
and FAILED receipt preserved, exact-context 17 matched / 0 unresolved. No
independent/hosted scanner promotion claimed. Failed tests/mock attempts retained.

**Database/deployment:** Staging migration 38234283593 and deploy 38234498171
SUCCESS at d63321af, public smoke PASS 30 checks. Production migration
38235082984 SUCCESS: ledger 40 -> 41, only 0041 applied, exact two tables/one
index/constraints PASS, FK [], quick_check ok, aggregate drift none, schema gate
PASS. Private Time Travel bookmark captured. Catalog/media retain 500 recipes,
500 ready active heroes, zero hydration failures and exact runtime fingerprint;
R2 availability was not recertified by the migration metadata query.

Production deploy 38236084633 SUCCESS. Active 100% Worker version
bd52d61f-c068-4844-9f5c-2b24a1f8d1a9, deployment
71b0bf82-2bd8-45bf-b359-693a190655e1, canonical D1 binding verified. Exact API and
assets SHA d63321af. Catalog d1 / cutover true / canary 0 / 500 / no fallback,
paired T20 true. Actual GitHub approvals for BOTH production runs:
vn-taphoanhatung; protections unchanged. Previous strict-compatible Worker
820c79ef-2db1-4016-95e8-afad9d61958f is the captured code rollback target;
no rollback, down-migration or new strict-recovery version executed.

**Deployed checks/failures:** Production smoke PASS 30 checks, including 18 native
Chromium/Firefox/WebKit public page cases at 320/1440, exact brand bytes,
tenant401 guards and release-specific PWA upgrade/offline shell. Five staging/
production screenshots visually inspected with no observed layout/image defect.
Bounded production monitor PASS: 11 observations across 321.902s,
all exact-SHA DB/queue/catalog/config assertions passed. Status degraded solely
for the existing intentional CONFIG_RECIPE_CATALOG_D1_AUTHORITY warning.
No seven-day SLO, challenge solve, authenticated journey or inbox/payment proof.

Original Node connect ETIMEDOUT/EHOSTUNREACH attempts retained: smoke1 failed
before checks, smoke2 after 8 checks, monitor after 3 observations. Ten targeted
readiness controls and complete rerun PASS with Node-only ipv4first/address-attempt
timeout3000ms; application/assertions unchanged, root cause not certified. Local
gh JSON dispatch parse failure created no run; corrected strings succeeded.
Receipt assertion initially expected count instead of names[]; corrected read-only
verification proved41. Failed evidence is not counted as PASS.

**Limits/next:** Release is deployed and bounded verification complete; all nine
real acceptance rows remain PENDING_EXTERNAL_EVIDENCE. Checkout/security/AI/data/
VNext activation requires the concrete missing acceptance in EXTERNAL_ACCEPTANCE.md.
No paid AI, real OTP or financial transaction made. No additional production
change required for this release. Packet:
../backend-upgrade/nine-region-production-release/rollout-receipt.json, RESULT.md
and EXTERNAL_ACCEPTANCE.md contain source/run identities, hashes and limits.
Canonical worktree /Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo;
original checkout untouched. Historical sections below remain preserved.

## Concurrent PayOS integration

After the verified deployment, main was observed at
4fb7c40d01769f0d8d8d043fac0c799b435b3e3e. The user confirmed that another thread
owns the ongoing PayOS/payment integration. This packet certifies only the
released source d63321af13d81a20a3f19f12969030fe353376b9 and its recorded workflows;
it does not certify the concurrent integration or later main revisions.

Save these receipts on the separate documentation branch
codex/nine-region-release-receipt. Do not merge, rebase, deploy or change payment
configuration as part of this receipt checkpoint. The PayOS owner can incorporate
the historical release evidence without treating its dormant checkout candidate
as accepted or inheriting CI/release certification for a different SHA.
