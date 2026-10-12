# Backend + Brand V3 integrated release - 2026-10-12 JST

**Task/status:** INTEGRATED_VALIDATION_IN_PROGRESS. User authorizes integrating
Brand PR66, protected merge to main, staging migration/deploy and production
through existing Environment approval. Active packet:
docs/backend-upgrade/final-local-completion/PLAN.md.

**Source:** vn-tak/Tako-san (1385308553), main652e0d7632745e9b77cda4b5b3caac83a3ec1015.
Full brand6114a43ee6c2798ecd9aebca959dd6496d1a2aea merged at c8c151eb;
branch codex/backend-final-local-completion, isolated canonical worktree
/Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo.

**Changes:** official Tailwind4.3.3 compiler removes vulnerable braces/chokidar
owner graph; retain measured v3 geometry, alpha, focus, shadow and sRGB gradients.
SVG exact bytes / PNG exact decoded pixels avoid OS compression variation.
Deploy setup-node6 pinned with supported automatic cache disabled. Production
E/H E2E instrumentation uses observable private-session state and scoped status.
Add staging-only0040 certification including indexes and constraint SQL. Readiness
requires strict OTP tables. First strict cutover prepares an exact-candidate,
fail-closed OTP recovery version with unchanged D1/catalog/T20 authority; all
approval/current-main/CI/binding/ledger fences retained. ADRs in active packet.

**Executed checks:** targeted6files/323tests PASS, full dependency audit0,
lint/types/migration40/build passed discovery. Final committed-source full gates,
production E2E, paired appearance, native browser, fresh scanners and hosted gates
remain in progress. Prior full suite1raw-palette failure corrected; parallel
build/cache failure retained and validation now sequential. Synthetic samples
remain TEST_ONLY and do not certify inbox/provider/real image accuracy.

**Remote/limits/next:** no push/main merge/remote0040/deploy yet. Production and
staging currently652e..., D1/catalog500/cutovertrue/canary0, T20pairedtrue. Preserve
these flags. Environment reviewer vn-taphoanhatung is required for production;
authenticated vn-tak cannot impersonate approval. Original user checkout untouched.
Next: commit implementation, complete final local/hosted checks, merge normally,
apply staging0040 then deploy and certify exactSHA, queue production0040 approval,
then deploy same exact main with verified recovery and post-deploy receipts.

---

# B01a strict OTP A1 local checkpoint - 2026-10-11 JST

**Task/status:** `B01a_A1_DORMANT_LOCAL_VERIFIED`; kernel/schema foundation only.
Active packet: docs/backend-upgrade/tasks/B01a-strict-otp.md; ADR-B01a-001 accepted
for dormant local A1. Full strict route/client integration remains A2.

**Repository/source:** vn-tak/Tako-san, ID 1385308553; canonical worktree
/Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo, branch
codex/backend-b01a-foundation. Base 8a9b386f46f245c727b9ac2f885bab842d5796b5;
implementation `0649324a729b57019df61da6bceec40cd9ba1135`. Main reverified 652e0d7632745e9b77cda4b5b3caac83a3ec1015.
Receipt checkpoint records the implementation, not its own commit hash.

**Actual changes:** migration 0040, six non-cascading tables; typed D1 claim/assertion
commands; key/time policy and real comparison coordinator; 55 kernel / 49 policy tests.
Account-wide keyed registry, budget 5/rolling 900s, generation/cooldown and atomic
consume/account/password/revoke/session/outcome; stale/crash never refunds.
Legacy accounting imported once; legacy OTP/session bytes untouched. Eleven tests
preserve historical 0039/0038 source after current tip 0040. 21 source and 319 protected
records frozen; routes/providers/client/config/workflow/lock and all 39 applied migrations unchanged.

**Executed checks:** focused 8 files / 287 tests PASS; historical recovery 331 / staging 37 PASS;
final complete committed-HEAD 291 files / 6908 tests PASS. Install/lint/typecheck/
migration smoke / sequential build / freeze PASS; isolated local D1, exact 40 entries,
reapply none/gate []/FK []/quick_check ok. Initial full 4 failed files / 7 failed tests plus
failed suite, intermediate full SIGINT exit 130, SW race build FAIL and audit-selector FAIL
retained separately. Fresh audit exit 1: full 2 critical / 16 high / 19 moderate / 4 low;
prod 2 moderate, 0 high / 0 critical. Earlier fixture 41 failures / test-spy type error fixed.
Exact commands/environment/time/exit/hash/raw gzip in b01a/validation.json.

**Limits/next:** coordinator dormant; live auth retains existing paths. A2 owns
all issue/verify/reset/client integration, guarded registration/guest transfer,
terminal issuance receipts, legacy cutover/cleanup and retention compatibility.
Hosted D1 proof / hardened rollback / inbox certification separate. No production proof,
real mail/paid AI/remote DB/R2/push/PR/merge/deploy. Full plan backend not complete.
See docs/backend-upgrade/b01a/RESULT.md and LOCAL_VALIDATION.md.

---

# B00 backend baseline checkpoint - 2026-10-11 JST

**Task/status:** B00_BASELINE_COMPLETE_WITH_RECORDED_FINDINGS; docs/source/local baseline, backend runtime waves not implemented. Active packet `docs/backend-upgrade/tasks/B00-baseline.md`.

**Repository/source:** Canonical vn-tak/Tako-san, ID1385308553; worktree `/Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo`, branch `codex/backend-b00-baseline`, source base `652e0d7632745e9b77cda4b5b3caac83a3ec1015`. Documentation checkpoint prepared from this source; its own commit hash is intentionally not claimed here. Original Frigo legacy checkout/user untracked files retained. Old origin URL redirects to same repository ID.

**Actual changes:** Docs only: baseline migration/lock/catalog/V2 hashes,79routes/13groups, ownership/background effects, fresh hosted/public evidence, audit/validation, gap/release/PR triage, four detailed packets and B01-B08 supporting scopes. B00 decisions register accepted for documentation; runtime policy/key/cutover/V3/review decisions remain ADR drafts. No runtime source/migration/lockfile/flag/workflow edit.

**Executed checks:** Frozen install/lint/typecheck/local migration smoke/build/recipe-seed/ingredient-audit/refresh-check PASS. Initial full6743PASS/1Wrangler5s timeout; focused/CI-only also timeout. Actual registry update-cache diagnostic makes focused32/32PASS; final full rerun: Test Files  288 passed (288); Tests  6744 passed (6744); Duration  372.06s (transform 4.95s, setup 1.29s, collect 38.75s, tests 629.50s, environment 10.44s, prepare 11.85s). Full/production audit exit1:41findings(2critical,16high,19moderate,4low)/2moderate respectively. V2 release-check exit1 EXPECTED_BLOCKED4blockers. Exact commands/environment/exits/timing/logSHA256 in `docs/backend-upgrade/b00/LOCAL_VALIDATION.md` and baseline.json; no timeout waiver or source change.

**Hosted/public evidence:** CI38098775083 success and latest deploy38103079308 success on sourceSHA. ZIP digest verified against artifact11688468304. Timestamped receipt Worker versioneee43e96-53ff-40f3-9779-e10fe256e0d8, schema39/0039/FK[]/quickcheckok/catalogrel-bd00a4f53fcaeee4/500/fingerprint exact; MealCompositionV2 true, D1/cutovertrue/canary0. Public ready at2026-10-11T02:34:04.954Z confirmsSHA/D1/configok; degraded is source-emitted D1-authority warning; emaildeliveryVerifiedfalse. Receipt does not equal direct current CF version/vars query.

**Database/operational state:** Only local synthetic SQLite/Worker test state and migration replay. No remote D1/R2/schema mutation, mail send, paid AI, push/PR/merge/settings change or deploy. Direct current CFversion/vars/fullAIflags/inventoryadoption/R2bytes/inbox/SLO/retention/livejourneys unverified. V2 remains candidate; no release eligibility promotion.

**Next action:** B01b adapterA1 before B01a issuance wiring; B01a reviewed ADR + typed admission/finalization commands and comparison-count tests; B03b pure candidate DTOs/cross-version-idempotency and B03a offline evaluator; B05a evidence-bound review schema. B08 tracks Wrangler ancillary-network harness and audit triage. Billing stays design/protected until explicit scope. Separate operator/data/budget/staging/release gates apply when dependent work reaches them. See `docs/backend-upgrade/tasks/INDEX.md`.

---

Detailed historical handoff remains at `docs/ai/HANDOFF.md`.
