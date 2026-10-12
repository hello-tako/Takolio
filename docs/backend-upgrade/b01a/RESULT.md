# B01a A1 - Dormant strict OTP foundation

Status: **B01a_A1_DORMANT_LOCAL_VERIFIED**, 2026-10-11 JST.
Repository vn-tak/Tako-san (ID 1385308553), branch codex/backend-b01a-foundation,
canonical worktree /Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo.
Base 8a9b386f46f245c727b9ac2f885bab842d5796b5; implementation `0649324a729b57019df61da6bceec40cd9ba1135`.
Main read-only reverified 652e0d7632745e9b77cda4b5b3caac83a3ec1015.

## Delivered behavior

A dormant coordinator reserves durable account/purpose budget before comparing
OTP digests. Account-wide HMAC request keys bind purpose/operation/semantic body;
replay never compares twice or creates another session. Five new admissions per
rolling 900 seconds; the fifth locks new candidates but may finish. Cooldown 60s,
challenge 600s, ticket 30s, keys 1800s/future 30s, receipt retention >= 86400s.

Raw D1 batches use command claims and same-transaction CHECK assertions to roll
back required-write-ignore/constraint failures. Registration activate+consume+
session and final reset password+consume+revoke+session+outcome are atomic.
Login-purpose verification consumes without an OTP-only session. Preliminary proof
keeps its original expiry and cannot replay after supersession/consume/deletion.
Principal identity is pinned before comparison/finalization; guest transfer is
explicitly deferred before effects. Returned raw token requires a newly acknowledged
commit; completion replay returns sessionRequired and never another token.

Migration 0040 adds six non-cascading authority tables; no legacy challenge/session
mutation. All retained legacy failure counts import once conservatively, with
preserved lock/cooldown and a required imported-ticket postcondition. The schema
gate requires six tables, 52 columns and two indexes. Eleven historical test fixtures
retain 0039/0038 and source 652e while current repository migration tip becomes 0040.
Recovery/release scripts and workflows are unchanged.

## Verification

Actual final full suite on committed implementation: **291 files / 6908 tests PASS**.
Focused 287/287, historical recovery 331/331 and staging 37/37 PASS. Frozen install,
lint/typecheck, SQLite migration smoke, sequential build and source/protected
freeze PASS. Isolated Wrangler local apply/reapply verified 40 exact migrations,
no pending apply, schema gate [], FK [], quick_check ok. 21 source records and 319
unchanged protected records are frozen. Independent source review found no
remaining blocking dormant A1 issues. Agent review does not equal human approval.

Failed initial fixtures, typecheck, first full run and concurrent build plus the
interrupted intermediate full and mistaken local-audit selector remain recorded;
see [LOCAL_VALIDATION](LOCAL_VALIDATION.md), [validation.json](validation.json),
[review-record](review-record.json) and deterministic raw gzip logs. Audits exit 1:
full 2 critical / 16 high / 19 moderate / 4 low; prod 2 moderate / 0 high / 0 critical. Lock unchanged,
B08 triage pending. No failure/timeout/assertion suppression or hosted PASS claim.

## A2 implementation sequence

1. Review request context/error/Turnstile/replay/cookie-loss contract and map typed
   terminal issuance delivery/expiry receipts; A1 currently replays issued as
   in_progress even after terminal delivery. Preserve no-second-send semantics.
2. Add guarded registration creation/pre-issue changes and authorized guest transfer.
   Cut over all register/login-unverified/forgot/resend issuance through strict
   reservation plus B01b acceptance/unknown hooks; retain budget/cooldown/generation.
3. Route verify/preliminary/final reset through strict tickets; integrate no-key-first
   server epoch bootstrap and client retry keys. Existing reset UI goes directly
   final; do not add unnecessary preliminary admissions.
4. Review legacy challenge supersession/OTP_REISSUE_REQUIRED and compatible cleanup,
   retention and secret-rotation policies; strict scope accounting must survive
   principal deletion and all active-window pruning.
5. Re-run route/client/adversarial comparison-count tests and all local gates, then
   separately certify hosted D1 transaction semantics and hardened rollback artifact
   before release. Real inbox/bounce proof remains B01b/operator work.

The kernel remains unimported by routes/providers/client. SEC-01/02/03 are still
open for live integration; A1 is not full strict OTP CODE_COMPLETE. PayOS/billing,
AI/providers, recipe/inventory/Week authority and production config stay protected.
No push/PR/merge/deploy/remote D1/R2/real mail/paid AI in this slice.
