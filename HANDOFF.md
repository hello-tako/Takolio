# Current checkpoint: Takolio domain integration - 2026-10-17

Status: `DOMAIN_IMPLEMENTED_LOCAL_VERIFIED`; staging blocked; production NOT_CHANGED. This checkpoint supersedes historical operational claims below for the current domain task.

Canonical source: `hello-tako/Takolio`, repository ID `1422954151`; base `526596a8cd857984ad2b69901a8c7b0e9d6bccc2`; branch `feat/takolio-app-domain-integration`. Both combined Workers are preserved, Admin remains reserved. Default Wrangler files, payment business logic and storage schema are unchanged. New routing is dormant until an explicitly reviewed generated candidate enables it.

Implemented: central domain profiles, exact host boundaries, safe WWW document redirects, preserved legacy app/API, API-only aliases, noindex/SEO, verified native association 404 boundaries, current-host export attribution, local read-only capture/probes and candidate preparation. Candidate preparation checks complete supported typed bindings, compatibility, staging overlap and clean source identity, and reports outstanding operational audit blockers. Unknown binding shapes are rejected.

Actual local verification: full run before final review fixes 367 files / 8,496 tests PASS (811.53s). After review fixes, 86 focused domain/config/CORS/Workerd tests PASS; domain + export presentation subset 38 PASS. Lint, both TypeScript checks, paired planner/T20 build, migration smoke and high-severity dependency audit PASS. Initial synthetic harness failures (stale validator, Hono HSTS ordering) were corrected; actual Workerd harness initially omitted has_user_worker and was corrected without relaxing assertions. Legacy HSTS regression assertion required the outer header to preserve existing strict legacy asset policy. No tests were skipped or timeouts increased.

Browser: isolated synthetic SQLite preview, mobile 390x844 and desktop 1440x1000. Created 7-day family meal plan, opened shopping view, refreshed nested route, no horizontal overflow or broken images on inspected views. This is local regression evidence, not live domain or real Google/OTP/PayOS certification. Plain Vite static preview initially showed session-unavailable because no API was attached; switched to existing isolated API preview.

Cloudflare: account `ef250a88911fd24073cb73d1c07e0218`, active zone `takolio.app` / `9284fb2186987f14f810818583acaa46`, Universal SSL active. DNS 0 records, Worker routes 0, Redirect rules 0, no Worker connected. Access has 3 unrelated apps and no Takolio staging protection. Edge HSTS, live cron/consumers/observability and account-wide DO/Workflows remain unverified. Pages/D1 list NOT_ACCESSIBLE with current OAuth. Existing staging storage/queue IDs are distinct, but sandbox provider credentials/data sensitivity are unverified.

Live versions: production `35dd189e-7e3c-4782-b69b-237da7dadd62`, SHA equals verified main; staging `b97b11fe-9151-41ac-9130-52532c045c8e`, SHA `f7386e6a8d9ef8955cc314daebf4d1aeecf4e5a1` exists and is ancestor of main. Read-only probes reached legacy production/staging; all five new hosts unreachable. No DNS, Worker, database, secret, OAuth, email or payment mutation occurred.

Next: final exact-head draft PR/hosted CI and independent review; then authorized operator resolves Cloudflare scope, live settings, staging Access/data/provider isolation, Google JS origins and approved OTP inbox. New-domain staging acceptance must precede any separate owner production approval. Current repository has 0 Actions secrets and 0 Environments; historical deployment identity/approval controls need reviewed restoration before release. Do not weaken branch protection or route Admin.

Details: `docs/domain-integration/FINAL-ACCEPTANCE.md`, `12-production-runbook.md`, `13-rollback-runbook.md`. Rollback pairs previous code with the recorded routes/settings/provider configuration; database rollback is excluded.

---

# payOS Worker runtime correction - 2026-10-12 JST

**Status:** FIX_IMPLEMENTED_FOCUSED_VERIFIED; final hosted CI and replacement
staging/production deployments required. PR70 merged as
4fb7c40d01769f0d8d8d043fac0c799b435b3e3e. Final branch CI38236830274:
331files/7725tests PASS; merge CI38237818252 PASS. Staging deploy38238816115
and production deploy38239310493 PASS; actual production reviewer
vn-taphoanhatung. Concurrent production release38236084633 completed before merge.

**Operations:** Dedicated Tako-san channels have separate credentials uploaded
to frigo-staging/frigo. Both exact webhooks are provider-confirmed. Live signed
verification200, invalid401, malformed400, oversized413 and unauthenticated
issuance401 PASS. Stable merge4fb/config/origin/D1 identities verified, catalog
d1/canary0/plannerT20true preserved. No extra migration or protection change.
Temporary credentials remain private pending final setup verification.

**New failure and correction:** Authenticated production issuance returned502.
Actual workerd reproduces TypeError before outbound provider work because
redirect:error is unsupported at the edge. Node-only no-transfer tests had
passed and missed this runtime difference. The adapter now uses redirect:manual;
existing non-2xx rejection prevents following redirects or forwarding credentials.
Seven actual-workerd regressions fail before the fix; focused fivefiles/138tests
PASS after it, including redirect301/302/303/307/308 and forged-signature rejection.
Both PAYOS_CHECKOUT_ENABLED secret flags setfalse while replacement is prepared;
callbacks remain available. Checkout admission stays OFF independently.

**Next:** Finish local/full/hosted checks, normal PR/main merge, deploy staging,
verify actual app issuance, then protected production replacement with reviewer
approval. Enable and verify only after exact deployment. Owner-controlled bank
transfer and persisted Plus acceptance remain unverified; no fake grant or real
money movement. Historical checkpoints below are superseded by this entry.

---

# payOS live protocol fix - 2026-10-12 JST

PR70 / initial e2a963b7 hosted CI38235911445 PASS; final code updates pending CI.
Live staging found existing digits-only account validation incompatible with a
signed alphanumeric virtual account. Restricted ASCII letter/digit support and
redirect rejection added; unsafe QR paths rejected. Six regressions also cover
existing payment reconciliation with checkout OFF. Focused4files/131tests,
lint/bothTS/sequentialpairedT20build PASS. Real staging create/HMAC/read/cancel
PASS, order11877934005, amountPaid0; no app intent/entitlement/transfer.
See docs/payos/SURVEY.md for failed attempts and cancelled diagnostic orders.
Production0041 run38235082984 PASS; concurrent production deploy38236084633
still in progress. Wait completion before merge to preserve its exact-main gate.

---

# payOS integration - 2026-10-12 JST

**Task/status:** IMPLEMENTED_LOCAL_VERIFIED; hosted PR and operational activation
pending. Explicit owner request authorizes payOS and isolated staging/production
channels. Independent branch codex/payos-integration-20261012, base d63321af,
repository hello-tako/Tako-san (1385308553). Other release worktrees untouched.

**Changes:** Exact signed unmapped payOS verification sample ACK without writes
or grants; default-off checkout flag independent of callback reconciliation;
16 KiB webhook/64 KiB provider limits; private-credentials/origin-pinned/dry-run
operator CLI and tests. No price/auth/migration/dependency/catalog change.
See docs/payos/SURVEY.md, ADR-PAYOS-001.md and RUNBOOK.md.

**Checks/failures:** Full331files/7719tests PASS, focused120 and operator5 PASS;
lint/both TypeScript/41-migration replay/audit0/sequential pairedT20build PASS.
Broad unknown-order ACK, TextDecoder typing and concurrent-build SW failures
were fixed; details retained in survey. No actual paid settlement claim.

**Remote/next:** Dedicated channels created, Cloudflare login scoped to Worker
script management confirmed. No keys uploaded/checkout enabled yet. Staging
migration38234283593/deploy38234498171 PASS on d63321af; production0041
38235082984 awaits actual vn-taphoanhatung review. Complete concurrent release
before payOS production deployment. Normal PR/exact-mainCI/deploy, then secrets,
provider confirmations and activation with evidence. Retain existing approvals.

---

# Integrated backend and Brand V3 production release - 2026-10-12 JST

**Task/status:** PRODUCTION_VERIFIED_WITH_EXTERNAL_ACCEPTANCE_OPEN.
Repository hello-tako/Tako-san, immutable ID 1385308553. PRs 66, 67 and 68 are MERGED.
Exact deployed source/main merge: 0c0f9933dcd1af2296d8033709ea3bf5ceec30f2; hardening ancestor
231486aed1fd67b7bb4e1ce443b56752c8e9bfc7; full Brand ancestor
6114a43ee6c2798ecd9aebca959dd6496d1a2aea. Canonical worktree
/Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo. This documentation
checkpoint records the verified release source; it is not a new runtime release.

**Delivered/evidence:** Backend integration, Brand V3, Tailwind 4.3.3 compatibility,
strict OTP recovery and exact-main migration fences are on production. PR68
preserves only the unchanged complete D1 authority, with verified 22 source blobs. Main CI
38208731783 PASS. Local/hosted suite 320 files / 7650 tests PASS; 94 isolated
production-build E2E PASS; 198 responsive screenshots have 0 axe/overflow/broken
images; 40 appearance + 12 state pairs exact. Full dependency audit 0 findings.
Pinned Semgrep/zizmor 0; Gitleaks raw 17 context-reviewed / 0 unresolved, raw status
retained. Approved deploy 38206476316 FAILED before any Worker upload; retained.
Protected payment/billing sources are unchanged. Synthetic invoice/fridge
fixtures remain TEST_ONLY. Earlier failed attempts remain recorded.

**Database/deployment:** Staging migration 38204668457 and deploy 38209289078 PASS;
production migration 38205975841 PASS from 6bc1fe96; final deploy 38209910253 PASS.
Migration source/schema bytes are unchanged in the new deployed SHA.
Actual GitHub approvals for BOTH production runs: vn-taphoanhatung; protections
unchanged. D1 ledger 39 -> 40, only 0040 applied; FK [], quick_check ok, aggregate
drift none, six strict OTP tables/two indexes/constraints PASS; private rollback
bookmark retained. Active production Worker 820c79ef-2db1-4016-95e8-afad9d61958f, 100% traffic;
canonical D1/catalog 500, exact fingerprint, d1/cutover true/canary 0/T20 paired true.
Certified inactive strict OTP recovery a300e28d-d304-4dcb-a256-b2495befe72c; metadata/flags/binding
verified before traffic. No live activation/rollback rehearsal occurred.

**Deployed checks:** Staging and production each pass 30 read-only checks, including
18 Chromium/Firefox/WebKit public page cases at 320/1440, exact brand bytes,
unauthenticated tenant guards, release-specific PWA cache upgrade and offline shell.
Production monitoring: 11 observations across 301.163s,
all exact-SHA database/queue/catalog/configuration checks PASS. Runtime status is
`degraded` solely for CONFIG_RECIPE_CATALOG_D1_AUTHORITY, the deliberate complete
D1 cutover warning; no other issue was accepted. These are bounded
observations, not a seven-day SLO certificate. Routed WebKit empty-response failures
and controls retained. New staging smoke1 image timeout and smoke2 undefined
callback failure are retained; smoke3 passes. Exact transport cause unconfirmed.

**Limits/next:** Direct production WebKit Turnstile iframe errors remain recorded;
rendering smoke does not certify challenge solve/authentication. Real inbox delivery remains unverified (deliveryVerified=false);
live OCR/provider accuracy/budget, independent ingredient/data acceptance, physical
old devices/browser floor, protected billing acceptance and load/chaos/SLO remain
open. Dormant provider/V3 writer/Ingredient V2 candidates remain unpromoted. Use
final-local-completion/release-receipt.json, RESULT.md and validation.json for run
links, receipt hashes, recovery instructions and actual scope. No paid calls/mail/
financial transactions were made. Original checkout unchanged. Next work requires
the specific missing provider/data/owner inputs in OPEN_ACCEPTANCE.md.

---

# Production catalog continuity preflight fix - 2026-10-12 JST

**Task/status:** FIX_IMPLEMENTED_LOCAL_FULL_VALIDATED; normal PR/main CI and a new
staging/production deployment remain required. PR66/67 are MERGED; merged main
6bc1fe96527bf111958b870f66b47f4e0c5ea2fd CI38204233535 PASS.
Staging0040/deploy38204668457/38204783756 PASS and 30 read-only smoke checks PASS.
Production0040 run38205975841 PASS after actual vn-taphoanhatung approval: ledger40,
exact strict schema, FK/quick_check PASS, aggregate drift none; bookmark retained.

**Failure/source:** Approved deploy38206476316 FAILED during transition preflight
before recovery upload/application upload/traffic change. Current production remains
652e0d7632745e9b77cda4b5b3caac83a3ec1015; migration0040 remains applied. The guard
requires new application SHAs to reset D1 rollout to shadow, despite unchanged fully
verified catalog authority. Failed run/approval/receipt retained privately.

**Change:** ADR-CATALOG-CONTINUITY-003 narrows production d1->d1 continuity to a
complete healthy protected authority proof, active previous100% version, canonical
binding/flags/commit, ancestor source, identical22catalog kernel/dependency blobs
and unchanged Zod specifier/resolution/integrity. Trusted workflow supplies the
version evidence; no input bypass. Canary/source/catalog drift remains rejected.
Previous authority proof is retained only for bounded edge convergence retries;
old-SHA responses are never final deployment evidence. Runtime/catalog/payment
sources unchanged by this fix. Branch codex/production-catalog-continuity.

**Checks/next:** Targeted3files/301tests and full320files/7650tests PASS. Lint,
both TS,40migration replay and pairedT20 production build PASS. Pinned changed-source
Semgrep/zizmor/Gitleaks0 findings; actual22Gitblob/Zodcomparison PASS (source-only,
synthetic version/evidence input). Exact PR/main CI follows; then current-main staging deploy and30checks, new
production Environment approval/deploy/recovery/read-only smoke and bounded monitor.
Do not reapply0040. Real inbox/OCR/provider/data/device/payment/SLO acceptance remains
open. Original checkout untouched. See final-local-completion packet.

---

# Integrated release candidate after repository transfer - 2026-10-12 JST

**Task/status:** LOCAL_VALIDATED_FINAL_HOSTED_AND_DEPLOYMENT_PENDING.
Authorized: integrate Brand66, normal protected merge67, staging0040/deploy,
production0040/deploy through existing Environment approval.

**Source:** hello-tako/Tako-san, unchanged ID1385308553; implementationb2fc564f3ff39bcd15dfb6bcb8f32912893b0506;
main652e0d7632745e9b77cda4b5b3caac83a3ec1015. PR67 draft. Full Brand6114a43e
retained via c8c151eb. Worktree /Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo.

**Changes/evidence:** Tailwind4.3.3 official compiler and measured compatibility;
strict OTP recovery/certification and0040 exact-main/schema fences; transferred
repository ID+name check; native Node22SQLite helper.319files/7610tests PASS on
Node22, lint/types/40migrations/production-flagsbuild/audit0 PASS.94production-build
E2E PASS,198responsive visual checks0issues,40paired+12state exact,18native checks,
3PWA checks PASS. Earlier browser receipts preserve their actual SHA; runtime bytes
unchanged since e869da7e. Pinned Semgrep/zizmor0, Syft500components; Gitleaks17
context-reviewed/0unresolved, raw findings status retained. Commands/hash/source
scope/failures and limits: docs/backend-upgrade/final-local-completion/validation.json
and RESULT.md. First hosted Node22bundling failure fixed;839bdCIcancelled during
account transfer, not PASS. Original checkout untouched.

**Remote/next:** GitHubCLIhello-tako valid; transferred secrets/variables preserved.
Production/staging still652e..., D1catalog500/cutovertrue/canary0/T20pairedtrue.
No0040/merge/deploy yet. Require exact final PR CI, merge commit, exact main-push CI;
staging0040 then same-SHAdeploy/authority/PWA verification; production0040 approval
then same-SHAdeploy/recovery/monitoring. Environment reviewer vn-taphoanhatung
remains required, cannot be bypassed by hello-tako admin rights. Real inbox/OCR/
provider/human ingredient/device/protectedbilling/SLO evidence stays open.

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

## 2026-10-12 payOS production recovery and Plus shell consistency

Scope: explicit owner authorization to finish payOS production integration and fix
related failures, including the reported home/Plus navigation mismatch.

- Verified active production is safe rollback source 4fb7c40, checkout OFF; staging
  serves 186a9cf with checkout ON. Existing channel secrets and webhook registration
  remain provisioned separately; no bank transfer or fabricated settlement.
- Corrected durable admission to accept the same bounded ASCII alphanumeric virtual
  bank accounts as the signed payOS adapter; real-SQLite create/replay/resume regression.
- Candidate download follows immutable artifact ID from the producer, including
  failed-only reruns; missing IDs fail closed, no name/attempt guessing.
- Added bounded recovery only for proven Wrangler 4.149.0 GET service/secrets
  metadata transient failures before any mutation. Every restart rechecks current
  main, exact-SHA hosted CI and release policy. Ambiguous upload/timeout stays failed
  and uses the existing verified rollback path. Only sanitized evidence is retained.
- Public smoke proves both ordinary and revalidated native-curl /sw.js profiles,
  three consecutive full SHA and matching byte hashes. Only a structurally valid
  prior canonical SHA waits, within 90 seconds; invalid assets still fail closed.
- Source cause of UI mismatch: /plus omitted from AppLayout kitchen allowlist; same
  defect exists in both current main and rollback code. Migrated guest/account Plus
  to shared header, top scan and five-item navigation. Regression enumerates every
  actual route; immersive scan/cook stays fullscreen.
- Executed so far: 153 payment tests, 176 UI tests, 313 release/flags/retry tests PASS;
  lint, both TypeScript checks, executable billing contract, 41 migration replay and
  paired planner/T20 build PASS. Full suite and protected rollout pending.
- Next: PR review and exact-SHA hosted CI, staging proof, required production reviewer
  approval, production identity/assets/authority proof, then checkout activation and
  authenticated application QR. Paid entitlement acceptance needs the owner's bank
  transfer. Do not describe pending production as complete.
- Final pre-PR review: case/slash route variants align with Router; 245 UI and 48
  retry/process tests PASS. First full local run 7,822 PASS/12 failures; stale Plus
  exclusion fixed and the 11 existing macOS tmp-path fixture failures all pass under
  canonical TMPDIR (93 tests). A final full canonical run and hosted CI remain pending.
