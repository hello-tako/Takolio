# B01a A2 - Strict OTP route and client integration

Status: **B01a_A2_ROUTE_CLIENT_LOCAL_VERIFIED**, 2026-10-11 JST.
Repository vn-tak/Tako-san, ID 1385308553; branch codex/backend-b01a-integration.
Base 8f55a745e08c800898555be829b93c8f1a7a5d18; final implementation `dcc0e1a74d2f5e3b67e13ecbb241bc04c8fafdde`.
Initial implementation 15ee1c5ca8bbaa792f7a3fe3936c5c8c0ae1dcc7 precedes test-fixture recovery.
The canonical worktree is /Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo.
Main was read-only reverified unchanged at 652e0d7632745e9b77cda4b5b3caac83a3ec1015.

## Delivered behavior

All OTP issuance, verify and reset routes now use durable strict admission. Five
new candidates per account/purpose in 900 seconds; D1 cooldown 60 seconds, challenge 600 seconds and ticket 30 seconds.
Account-wide keyed receipts bind purpose, operation and semantic payload; replay
never compares twice, resends email or creates another session. No-key bootstrap
uses D1 time; subsequent client retries use keys held only in tab memory.

Pending registration creation is atomic with issuance and required parent writes.
Activation installs the mailbox owner's chosen password atomically with verify,
consume, session and outcome, closing preregistration-password takeover. Reset
also activates a pending account, changes password and revokes prior sessions in
one transaction. Preliminary reset remains proof-only; normal UI goes direct final.
Completion replay returns sessionRequired and asks for login, never another cookie.
The first cookie response rechecks principal, email, verification, membership and
exact live token hash. Provider accepted/pending/rejected/unknown states remain
explicit; only development exposes a fresh dev code. Forgot responses remain
generic through delivery and stale replay states with durable budget/metadata parity.

Legacy challenges are not adopted; retained failure/lock/cooldown evidence imports
before supersession. Strict cleanup keeps scope/import authority and all active
horizons, with minimum 24 hours pruning. Failed/locked legacy rows remain until an
explicit retention policy. Guest inventory transfer still returns 409 before admission;
its data-preservation regressions cover real guest cookies and all inventory modes.

## Executed verification

Final full suite on the committed final implementation: **293 files / 7037 tests PASS**.
Recovery focused **15 files / 454 tests PASS**; lint/typecheck/frozen install,
migration smoke, sequential build and source/protected freeze PASS. Isolated local
D1 exact 40 ledger/reapply/gate[]/FK[]/quick_check ok PASS. All 40 migrations unchanged.
Independent agent review reports no blocking source findings; human PR review and
hosted certification are separate. 23 frozen source/test records and 369 protected
records match Git. Failed runs, including first full 25 FAIL, are preserved with
exact root receipts and deterministic gzip hashes.

Audit remains FAIL: full 2 critical / 16 high / 19 moderate / 4 low; production 2 moderate / 0 high or critical.
No lock/config/workflow/provider/inventory authority or billing change occurs.
See [LOCAL_VALIDATION](LOCAL_VALIDATION.md), [validation.json](validation.json),
[ADR](ADR-B01a-002.md), [review snapshot](review-record.json) and
[GIT_VERIFICATION](GIT_VERIFICATION.md). Original masterplan remains unchanged.

## Next execution sequence

1. B01c: prepare and implement the scoped auth/tenant isolation regressions and fixes
   from the canonical packet, preserving unrelated authority and billing fences.
2. Hosted-readiness packet: review 0040-compatible preflight/release readers and a
   named hardened rollback; prove concurrency/fault behavior on controlled staging D1.
3. B01b: controlled inbox/provider/bounce evidence and delivery reconciliation.
4. B08: dependency remediation and durable test/build artifact isolation. Secret-HMAC
   rotation requires a preservation policy; do not erase scopes/history during rollback.

No hosted D1/route/inbox/production certification, browser E2E, real mail, paid AI,
remote D1/R2, push, PR, merge or deploy was performed. Full backend masterplan,
authorized guest transfer, secret rotation and hardened rollback remain unfinished.
