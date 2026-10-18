# Production build guard correction - 2026-10-18

Current: DOMAIN_STAGING_VERIFIED on d5f2e726; production cutover pending the reviewed
adapter correction. This checkpoint supersedes earlier domain status sections.
Production remains version 01b81140/source 526596a8. Admin remains reserved.

Staging canonical release 39098613336 succeeded with version 53b3ce38 and both
custom hostnames. Real Google GIS, approved-inbox OTP delivery, refresh/logout,
sandbox QR/provider verification and signed synthetic replay, user journeys and
mobile/PWA smoke were executed. The sandbox event was not a bank settlement or
transfer. Staging scan used its configured mock-AI pipeline. A real paired rollback
restored 5ce93d26, retained the app hostname, detached only the receipt-owned API
hostname and passed audit 39098518311 before canonical same-SHA re-release.
Public evidence with explicit test scope:
https://github.com/hello-tako/Takolio/pull/13#issuecomment-6245968702

The old staging checksum appeared in private tool output. The owner confirmed
rotation and Worker secret update. No new checksum was read. Two real provider
verification callbacks after rotation returned POST 200/outcome ok/exceptions 0;
the canonical webhook was restored. Audit 39101311454 confirms the same active
version/source, isolated bindings, vars, secret names, runtime and operations.
The owner-approved exact-path Access exception retains Worker signatures;
anonymous app/health remain protected.

Read-only production certification 39101415582 was independently approved and
passed at 05:44:39Z. Production release 39101591421 was independently approved by
vn-taphoanhatung, then failed at prepared before upload/traffic/hostname mutation.
Receipt records mutationAttempted=false, no uploadedVersionId and recovery says
no traffic or hostname mutation attempted. Failed evidence remains unchanged.

The actual production build passes. Exact receipt reproduction identifies the
composition CLI's optional config argument as staging-only. The adapter now uses
existing generic composition/planner validators directly against audited production
vars and the compiled UI record, with an explicit production identity check.
Mismatches still fail. Staging, shared validators, customer application, payments,
schema, feature flags and workflow protections are unchanged.

Executed: actual pnpm build and corrected adapter build using the sanitized
production receipt PASS; 19 related files / 288 tests PASS (11 new build cases);
lint, both TypeScript checks and customer/Admin migration smoke PASS. Two existing
generated-bundle lint warnings and existing Admin font warnings remain. Exact-head
hosted CI and independent PR review remain mandatory; full hosted result pending.

Next: protected fix review/merge and exact-main CI, new canonical staging receipt
and accurate acceptance on the new SHA, fresh production certification and release
approval, then at least 15 real minutes and final live acceptance. Do not relabel
an old-SHA attestation as a test of the new release. See 24-production-build-guard.md.

---

# Final local verification - 2026-10-17

Full canonical-temp run: 388 files / 8,804 tests PASS. Final focused audit/config/
readiness/Admin guard run: 44/44 PASS; independent read-only delta review PASS.
Lint, both TypeScript checks and public-change scan PASS. The full run overlapped
final audit fixes; final focused checks and exact-commit hosted CI cover that
delta. Prior build/migration smoke also passed. No new application/domain deploy
has occurred. Fresh final-head GitHub review and CI remain mandatory. See
`docs/domain-integration/14-release-operations.md`.

---

# Credential and release checkpoint - 2026-10-17

Status: `DOMAIN_IMPLEMENTED_LOCAL_VERIFIED`; new-domain staging acceptance and
production cutover remain pending. The owner authorized production release and
confirmed creating/saving the reviewed separate Cloudflare tokens. Both 30-day
API tokens and account-ID secrets are now saved in their matching GitHub
Environments; expiry is 2026-11-16. Separate release-verification keys are also
synchronized with the Workers and proven by authenticated HTTP 200 responses.
Secret rotation preserved code/runtime/bindings/assets. Current production
version is `01b81140-3162-47e0-8573-88b679877f8a` (source `526596a8`); staging is
`b4257b5c-dddf-4093-b969-f5bc09888bf6` (source `f7386e6a`). This was credential
provisioning, not a new application/domain deployment. Admin is undeployed.

The post-main-merge CI failure was isolated to the Admin customer-baseline test
(8,794 other tests passed); its reviewed-baseline guard and the public documentation
scan are fixed. Generated production candidates now explicitly preserve
workers.dev/preview OFF. A manual current-schema read-only Cloudflare audit is
prepared; the historical 0039-only readiness contract remains intact. Final-head
hosted CI and fresh PR #3 approval are required; prior approval was dismissed by
GitHub after the main merge. Main and Environment protections remain enforced.

Next: finish final-head CI/review, merge normally, pass exact-main CI and execute
read-only infrastructure audits. Resolve operational/provider/isolation evidence
before reviewing a deployment activation path; the default Deploy workflow still
uses legacy configs. Do not dispatch it as a domain cutover. Live staging must
pass before production Environment approval and rollout. See
`docs/domain-integration/14-release-operations.md` for evidence and exact gates.

---

# Release operations checkpoint - 2026-10-17

Canonical repository: `hello-tako/Takolio` (`1422954151`). Admin prerequisite PR #2
was approved by `vn-taphoanhatung` at exact head `84554b0f` and merged through
branch protection as `304349ea09d542881eb09033327fdd0ff8c2d272`.
This does not activate or deploy the Admin Console. Domain PR #3 was approved at
`352a4211`; it is being integrated with the new main and requires fresh exact-head
CI and review. Its last complete hosted run was 39011736920: 368 files / 8499 tests
passed, plus lint, type checks, migration validation and production build.
Local isolated browser regression: 94/94 passed (synthetic providers).

The owner authorized production release and creating necessary Cloudflare tokens.
GitHub staging/production Environments and account-ID secrets are restored;
production still requires independent environment review without admin bypass.
Cloudflare tokens are being provisioned with limited scope and 30-day expiry.
New-domain live staging/provider acceptance remains pending; production/DNS are
unchanged. Keep the existing planner/T20 flags and isolated storage. Never infer
staging or production verification from local tests or candidate dry runs.

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

# Admin R2 local recovery/readiness checkpoint - 2026-10-17

Status: ADMIN_V1_PRODUCTION_READINESS_BLOCKED. Runtime source:
066c35ad670bc877756150c2055e3844dd7a17ce, branch
codex/admin-v1-r2-production-readiness, Draft PR #82 (last verified remote backend
ba762a205fd890efe4af47ef6c0fd7cd6f45fc14). PR #77 remains untouched.

Recovered facade/identity/governance/recovery implementation and fixed independently
reproduced roster/target races. Added CI-safe synthetic fixture guard while real
operator provisioning still refuses CI. On the exact clean runtime commit with
Node24/pnpm10/Python3.12, canonical TMPDIR and CI=true/GITHUB_ACTIONS=true:
382 files /8661 tests, 146 focused tests, lint, typecheck, build, customer/Admin
migration smoke, 9 workerd scenarios/127 assertions, 23 migration cases,
12 Admin browser tests and 10 consecutive keyboard repetitions all PASS.
Tracked screenshot diff, configuration preflight, public patch scan and dependency
audit exit0. Full suite completed 2026-10-16T20:59:30Z; source unchanged.
Independent reviewer /root/independent_admin_review found no new actionable issue
in final delta; review scope and inherited SHA-specific evidence are explicit.
Earlier failed and interrupted runs are retained, never promoted to PASS.

Complete 19-document evidence package: docs/admin/production-readiness/00-18.
Customer runtime, customer migrations and customer release protected paths are
unchanged from main 526596a8cd857984ad2b69901a8c7b0e9d6bccc2. No customer payment,
authentication or production infrastructure operation occurred.

Blocked: GitHub account suspended prevents ref refresh/push/hosted CI; four
release workflows remain offline plans with no reviewed live adapters; protections,
real Access/resource identity, independent human roster/custody, representative
D1 load and all live staging/rollback gates are unverified. Staging authorization
is required; production is not deployed or authorized. Next: restore GitHub,
publish local branch/evidence with a normal push, commission live-adapter/protection
review and scoped staging authorization. No merge, remote D1, secrets change,
production bootstrap, deployment or enablement is authorized.

---

# PR #77 brand-main merge verification — 2026-10-16

**Result:** four conflicts resolved in merge
`03a84b03e0b11b93c0e2ab2a6c56cc29cf3fa845` (parents `73e0c490`, `526596a8`).
On that exact source: `pnpm lint`, `pnpm typecheck`, `pnpm build`,
`pnpm check:migrations` and focused Admin/brand Vitest all exit0. Regression
command: `pnpm exec vitest run tests/unit/admin- tests/integration/admin-
tests/unit/takolio-brand.test.mjs tests/unit/takolio-3d-assets.test.mjs
tests/unit/takolio-mascot.test.tsx --maxWorkers=1 --silent`: 13 files /143 tests
PASS. Both customer/Admin migration smoke markers are `ok`. Existing Admin font
build warnings remain; the expected emitted font files are present.

Both complete parent status histories survive. Main's Takolio and V3 brand
commands and all prior Admin commands/build/migration checks coexist in valid
package JSON, with dependencies and lockfile unchanged. Customer runtime/assets,
configs/migrations and incoming brand artifacts match merged main byte-for-byte;
Admin runtime/config/schema matches the previous PR head. Resolution-path diff
checks and conflict-marker scans pass. Broad merge diff whitespace warnings are
inherited verbatim font licenses / historical logs, not new resolution changes;
those authoritative files were not reformatted. Separate local R2 stays excluded.

**Next:** publish only this handoff merge/receipt and require exact-head hosted CI.
Full repository tests and browser E2E were not rerun locally for this conflict
resolution. Preserve draft / DO NOT MERGE status, F1–F11 and independent-review /
release gates. No PR merge/close, deploy, remote D1, secret or account operation.

---

# PR #77 brand-main conflict reconciliation — 2026-10-16

**Scope:** merge main `526596a8cd857984ad2b69901a8c7b0e9d6bccc2` into handoff `73e0c490a15e2014abb6e5096ec45ec980981d37`.
Resolved three docs/ai status conflicts by keeping both complete parent histories.
Resolved package.json by retaining main's `brand:icons` Takolio generator and
`brand:icons:v3` legacy generator alongside all handoff Admin commands and the
existing Admin-aware build/migration checks. No dependency/lockfile change.
All customer source/assets/configs/migrations and incoming brand evidence are
identical to main; no custom product, authentication, payment or release edit.
Separate local R2 commits remain excluded from this historical handoff PR.

**Checks:** both-parent status content retention, package JSON/script assertions,
no conflict markers/unmerged paths, customer/main byte identity and diff check.
Lint/types/build/migration/Admin regression results follow in the verification
checkpoint. This merge does not remediate F1–F11 or grant release certification.

**Next:** publish the conflict-only handoff update and require exact-head hosted
CI. Preserve draft / DO NOT MERGE, independent review and release gates; no PR
merge/close, deployment, remote D1, credential or account operation is authorized.

---

# PR #77 conflict-resolution verification — 2026-10-16

**Result:** all three status-document conflicts resolved in merge
`d47cc70b0d477dfbf575e3d215f71178231a1362` (parents `87d6d3d`, `f7386e6a`).
On that exact source: `pnpm lint`, `pnpm typecheck`, `pnpm build`,
`pnpm check:migrations` and `pnpm exec vitest run tests/unit/admin-
tests/integration/admin- --maxWorkers=1 --silent` all exit0; Admin regressions:
10 files / 133 tests PASS. Both migration smoke markers are `ok`. Build reports
the existing runtime-resolved Admin font warnings; the generated font files exist.
Conflict-marker scan, staged diff check, both parents' status-history retention,
and exact customer-source/config/migration identity against merged main PASS.
The merge changes no Admin runtime/config/schema from the published handoff.

**Publication boundary:** only this handoff main merge and its verification notes
are authorized for PR #77. Separate local R2 commits/artifacts are excluded.
Full repository tests and browser E2E were not rerun locally for these document
resolutions; exact-head hosted CI remains required. Draft / DO NOT MERGE,
Admin findings, independent review and release gates remain unchanged.
No PR merge/close, deployment, remote D1, secret or account change.

---

# PR #77 main-conflict reconciliation — 2026-10-16

**Scope:** merge current main `f7386e6a8d9ef8955cc314daebf4d1aeecf4e5a1` into handoff
`87d6d3d2acc69a6ca3f0409c3c22753469807222` without rebasing or publishing local R2 work.
Resolved conflicts in `docs/ai/CURRENT_STATE.md`, `docs/ai/HANDOFF.md` and
`docs/ai/TASK_BOARD.md` by retaining both the Admin handoff notice and all new
main-side status entries. Customer runtime, configs, migration history and main's
T26/T27 changes are taken unchanged from the merged main. No new product/UI,
authentication, payment, deployment or remote database change is introduced.

**Checks:** conflict-marker scan, main/head status-document content retention,
customer-source identity against merged main, and staged diff validation.
Additional lint/types/migration/admin regression results are recorded in the
follow-up verification checkpoint. This merge does not resolve Admin F1–F11 or
certify staging/production. The separate local R2 branch is not part of this PR.

**Next:** publish only this handoff merge, require exact-head CI, retain draft /
DO NOT MERGE status and independent-review/release gates. No PR merge or close.

---

# Admin V1 R1 certification review - 2026-10-14

**Status:** ADMIN_V1_R1_CHANGES_REQUIRED (local review of 0331cc9/25140ba; reviewer
is the same agent that implemented R1, so not independent and no PASS possible).
Report: docs/admin/reviews/2026-10-14-r1-certification.md (+ r1-certification/
evidence and reviewer tools). No source change, push, deploy or remote access.

**Re-verified (clean worktree of 0331cc9):** full vitest 342 files/7865 tests
exit 0; lint/typecheck/build exit 0; customer dist/client byte-identical to
186a9cf (441 files) and identical Worker dry-run bundle; check:migrations ok;
migration matrix 11/11; implementer workerd checks 108/108; independent workerd
probe 1169/1169 (production positive control, 12 negative variants, real browser
on workerd, customer Worker parity); reviewer tests 18/18; original PoCs 51/51
before, 22/29 after with 0 unexplained; E2E 11/12 (axe 0, overflow 0) — the one
failure is a flaky keyboard-scroll assertion (product verified correct).

**Findings:** P1 F1 admin Worker has a writable binding to the production
customer DB and reads password hashes every request (needs read facade); P1 F2
two-SUPER_ADMIN governance deadlock without break-glass; P1 F3 no identity-bound
production bootstrap ceremony. P2 F4-F11: decider TOCTOU, non-atomic bootstrap,
pre-auth account lockout, full-scan aggregates, flaky E2E, E2E rewrites tracked
screenshots, deep-link charset, Access sub binding.

**Next:** fix F1-F3 (+P2), then a genuinely independent review; production stays
blocked on Access staging, admin workflows and the ceremony.

---

# Takosan Admin V1 security remediation R1 - 2026-10-13

**Status:** ADMIN_V1_REMEDIATION_READY_FOR_INDEPENDENT_REVIEW (local only; not an
independent review PASS, not deployed). Implementation commit 25140ba; original
3e865d0 kept (tag admin-v1-review-baseline); review record 6889f8d. Report:
docs/admin/remediation-r1/REPORT.md (+ REGRESSION.md, evidence/). ADR-ADMIN-002.

**Changes:** console moved to a separate admin Worker (admin-worker.ts,
wrangler.admin.jsonc disabled template, wrangler.admin-local.jsonc loopback) with
its own ADMIN_DB (migrations-admin/0001). Customer Worker/config/sw/vite/ledger
restored to 186a9cf and 0042 withdrawn. Strict env allow-list, exact admin origin,
session-derived CSRF (no cookie), no CORS, two-person bootstrap, four-eyes
SUPER_ADMIN grant+revoke, DB minimum two, credential-change session revocation,
audit-before-disclosure, per-IP/account/global login limits, UI P1 fixes.

**Verification (clean worktree of 25140ba):** full vitest 342 files/7865 tests
PASS (exit 0); lint, typecheck, build PASS; check:migrations (customer + admin
smoke) PASS; admin vitest 10 files/133 tests; real workerd check 6/6 scenarios
(108 checks); S2 reproduced on 3e865d0 under workerd; migration matrix 11/11;
Playwright admin 12/12 (axe 0 violations, 0 px overflow at 1440/820/390);
original 51 PoCs: 51/51 on 3e865d0, 21/23 defect PoCs now fail on R1.
No GitHub/Cloudflare remote call, push, deploy or remote D1 access.

**Next:** independent review of R1; then (separately authorized) admin hostname,
Cloudflare Access app, ADMIN_DB + KV, reviewed admin-d1-migrate/admin-deploy
workflows, two-person bootstrap (PRODUCTION_INTEGRATION_PLAN.md).

---

# Takosan Admin Console V1 local implementation - 2026-10-12

**Status:** ADMIN_V1_LOCAL_COMPLETE (local only; not deployed, not production-certified).
Implemented separate admin frontend (`admin/index.html`, `src/admin/`), Worker admin
API (`src/worker/routes/admin/`, `/api/v1/admin/*`), shared RBAC/DTO contract
(`src/shared/admin.ts`), additive migration `0042_admin_console_foundation.sql`,
local-only fixture/provision/preview tooling (`scripts/admin-*.mjs`), and docs in
`docs/admin/` (API reference, RBAC matrix, security assessment, migration report,
integration plan, local setup, screenshots). ADR-ADMIN-001 records the authority model.
No GitHub/Cloudflare remote operation, deployment, remote migration or payment-code change.

**Verification (local, exact):** pnpm lint PASS; pnpm typecheck PASS (both projects);
pnpm build PASS (dist/client/admin/index.html + unchanged `index-*` customer entry);
pnpm check:migrations `migration-smoke=ok` incl. 0042 assertions; wrangler `--local`
D1 fresh replay 0001-0042 and 0041->0042 upgrade PASS; admin integration 30/30,
admin unit 37/37 (frontend + tooling); Playwright admin E2E 5/5 (Chromium, real Worker
serving built admin assets, synthetic fixture); full vitest 339 files/7799 tests: 7797 PASS, 2 FAIL
(auth-hardening + auth-otp-coordinator hard-coded the 0041 ledger tip/count); both now use
MIGRATION_LEDGER and pass on re-run (2 files/189 tests). Full suite not re-run after that
test-only fix.

**Compatibility edits:** customer service worker skips `/admin*`; rate limiter gained
optional `key`; `MIGRATION_LEDGER` + migration smoke include 0042. Production workflow
migration allow-lists and `tests/fixtures/migration-sha256.json` intentionally unchanged.

**Next:** Independent security review; real Cloudflare Access tenant verification;
define production SUPER_ADMIN bootstrap procedure; reviewed PR adding 0042 to the
production migrate allow-list; wire runtime `ai_requests` logging if AI metrics are
required. Production integration is a separately authorized operation
(docs/admin/PRODUCTION_INTEGRATION_PLAN.md).

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

## Admin release adapter follow-up (2026-10-17)

The evidence-only checkpoint is 77f81b7bff1c29790a67ea48475aa720a86b9f2e.
It preserves full local runtime evidence on 066c35ad670bc877756150c2055e3844dd7a17ce.
A separate default-disabled release adapter now implements signed, expiry/run/source/
policy/migration-bound operations, live target/source/protection checks, durable
pre-action artifacts, fixed Admin-only migration/bootstrap/recovery paths and
disabled deploy/rollback with compensation attempts. Four manual workflows use
protected dedicated Admin environments and no credential in plan mode.
52 adapter/provider tests passed during development; new exact-SHA full validation
and independent source review are still mandatory. Initial development fixture
key destructuring failed four tests and was fixed before the passing run.
No Cloudflare or production operation occurred. Real identities/protections,
independent human custody, initial resource/enrollment setup, first safe rollback
baseline, live API staging rehearsal and explicit owner authorization remain
blocked. Existing evidence is not relabeled as a test of the adapter.

## Admin adapter containment follow-up (2026-10-17)

The next candidate includes `admin-emergency-disable.yml`, the minimal shutdown
Worker, full account facade route inventory, strict API/asset denial smoke and
signed staging/artifact gates. `rollback-disabled` is the narrowly authorized
restore path after shutdown; it validates both approved versions and live DB
identity, and compensates back to shutdown on partial failure. Validation is
pending the new frozen SHA. GitHub HTTP 403/account suspension, real Access and
operator roster, live provider schema, and all real staging cases remain blocked.
Do not push/merge/deploy/migrate/bootstrap or change production secrets here.

Admin final source `9395f0e31ea599f1eb7780a8eba36964fed7c483`: all 15 exact-source local verification commands exit 0;
independent release review is retained in docs/admin/production-readiness/13_INDEPENDENT_REVIEW.md.
Next: restore GitHub access/protections and obtain explicit real staging/resource/operator authorization.
Status remains ADMIN_V1_PRODUCTION_READINESS_BLOCKED / ADMIN_V1_STAGING_AUTHORIZATION_REQUIRED.

Validation qualification: default-concurrency full suite on 9395f0e3 failed 10 timing checks; full serial rerun uses existing assertions/timeouts. Both attempts are retained in production-readiness evidence and raw output archive; see 12_REGRESSION_RESULTS.md for actual results. Hosted default-concurrency CI remains required.
