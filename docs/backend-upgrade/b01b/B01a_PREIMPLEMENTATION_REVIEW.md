# B01a pre-implementation review after email A1

Date: 2026-10-11 JST. SOURCE_REVIEW_ONLY; no B01a runtime/schema/client changes.
Main reverified652e0d7632745e9b77cda4b5b3caac83a3ec1015; implementation base98471e10.
Independent SQL/cutover and frontend/key preflights examined current source and
`tasks/B01a-strict-otp.md`. These findings refine that draft before its own ADR.
A1 adapter semantics are available; full strict OTP is still unimplemented.

## Decisions required in the first B01a ADR

| Finding / source | Execution decision to include before implementation |
| --- | --- |
| UNIQUE(scope,key) cannot detect key reuse across purposes when scope includes purpose; separate issuance/ticket tables cannot detect reuse across operations | Use one request registry keyed by opaque account HMAC + request key across issuance/verify/reset and purposes. Keep abuse budget scopes account+purpose. Registry binds immutable operation/purpose/body/generation/challenge, references outcome; no raw email/code/password. Check registry conflict before current-generation selection. |
| auth_otps has per-challenge attempts without per-failure timestamps; resend can leave used/superseded rows with failures | Define conservative one-time legacy aggregate, including used/superseded retained rows and max existing lock. Proposed safe policy: cap SUM of retained attempt_count at5, import at init-time, mark source legacy_import, preserve max lock, one atomic cutover marker. Old failures may cause a one-time15minute lock; cannot claim an exact reconstructed rolling history. Review this compatibility cost in ADR. |
| SQLite now is stable within one statement, not guaranteed across db.batch | Capture DB now in the winning claim and reference it throughout the batch; do not rely on repeated app Date.now or unverified subsecond D1 functions. Choose/test explicit integer time representation. |
| cleanup.ts deletes old auth_otps without knowledge of future receipts/tickets/scopes | No cascade that removes durable budget/outcomes. Assign focused cleanup compatibility ownership and test expiry plus replay retention. General auth retention redesign stays separate. |
| First register/forgot issuance has no otpKeyIssuedAtMs yet | Decide public server-epoch bootstrap or explicit no-key-first policy before client implementation. Existing /config is a candidate additive bootstrap; no endpoint/config changed here. Do not assume user clock accuracy. |
| verify-context.ts rejects unknown fields via strict allowlist | Update context writer/parser/version compatibility together if generation/epoch/key is added. Never persist OTP/password; operation retry secrets stay in memory. |
| AuthPage verification starts browser-derived expiry/cooldown; resend network/5xx clears cooldown and tests expect immediate retry | Replace with server retry/cooldown metadata, including unknown delivery errors. OTP_REISSUE_REQUIRED must return reset flow to explicit request stage, never automatically send. |
| ApiError/fetchJson do not preserve Retry-After; CORS exposes only X-Request-Id | Put retryAfterSeconds in typed OTP error body, or explicitly own header exposure/parsing. Existing fetchJson already forwards Idempotency-Key, so avoid general HTTP retry refactor. |
| AuthPage normal reset path calls forgot then final reset directly | Preserve one normal final-reset admission; do not introduce preliminary verify. Dormant preliminary API path remains guarded/tested separately. |
| Unverified password login issues register-purpose challenge | Keep register scope/current UI behavior; login-purpose verification must not create OTP-only access sessions. |
| Guest deferred continuation changes migrateFromHouseholdId in verify payload | Changed payload is a new operation/key and spends a new admission. Same-key changed transfer payload must409. Preserve existing guest transfer deferral/fences. |
| Register retries use refreshed one-use Turnstile token | Define replay authorization before token consumption: an authorized matching receipt can replay without re-consuming old token. Exclude ephemeral Turnstile token from semantic body fingerprint or explicitly document conflict semantics; retain Origin and existing creation policy. |
| Successful replay has no raw cookie/session credential under packet policy; AuthPage currently trusts user on success | Return typed sessionRequired/login recovery for lost-cookie completion replay; client must not set authenticated identity from replay user alone. Confirm active session through existing /me authority where applicable. |

## First execution slice

1. Pin current main/migration tip (currently0039), approve B01a ADR/key/error/cutover
   decisions and assign shared paths/append-only migration sequence.
2. Implement policy and typed raw-D1 request-registry/scope/issuance/ticket commands
   before route changes. Use transient exact claims; every effect is guarded and
   required-write failure causes a real constraint abort within the same batch.
3. Claims/assertions must be scoped to exact command/ticket. Required one-row writes
   abort in the same batch on zero rows; revocation legitimately changes0..N and
   needs a postcondition assertion rather than changes()==1. A lost batch response
   must not cause a second comparison: retry sees in-progress ticket; timeout/crash
   ends abandoned/expired with no budget refund, even if no comparison occurred. Do not reuse inventory-event guards for OTP.
4. Add meaningful SQLite-backed concurrency/comparison instrumentation: at most5
   new admissions/comparisons, fifth valid ticket finalizes despite lock, sixth
   never compares, registry conflict across purpose/operation, crash no refund,
   single-time boundaries, late-generation fences and required-write rollback.
5. Only after commands pass, integrate all issuance/verify/reset entry points and
   minimal client key/error/recovery lifecycle. Unknown delivery must preserve
   cooldown and must not permit a blind resend. Settle unknown-generation recovery
   policy explicitly; no callback/status reconciliation exists in A1.
6. Re-run focused/full local gates and prepare separately authorized staging D1
   proof and named hardened rollback. SQLite does not certify hosted D1 semantics.

Client key generation must use16cryptographic random bytes, keep retry key/bound
validated payload in memory, rotate on explicit new operation/generation and clear
on ownership change/abandon. Do not use Math.random or the offline sync outbox;
never persist OTP/password. Replay/conflict/in-progress/410/reissue/sessionRequired
need narrow typed handling while generic forgot metadata remains account-neutral.

## Exact source anchors

- `src/worker/routes/auth.ts`: issueAndSendOtp, register retry mutations, resend
  cooldown clearing, verify/reset finalization and unverified-password login.
- `src/worker/services/cleanup.ts`: cleanupExpiredOtps and scheduled cleanup.
- `src/web/services/auth.ts`: register/verifyOtp/resendOtp/login/forgotPassword/
  resetPassword; only sent bridge currently affects email adapter compatibility.
- `src/web/pages/AuthPage.tsx`: enterVerification, handleVerifyOtp, guest deferred
  continuation, handleForgotPassword/handleResetPassword and cookie-loss recovery.
- `src/web/features/auth/verify-context.ts`: strict verification-context storage contract.
- `src/web/services/http.ts`: ApiError and caller-header forwarding.
- `tests/helpers/sqlite-d1.ts`: outside-batch barriers and BEGIN IMMEDIATE rollback.

These are offline source findings and proposed decisions, not production incidents
or deployed policies. Current body/header/cookie contracts remain unchanged in A1.

## Additional independent first-slice review

Still SOURCE_REVIEW_ONLY; these choices belong to the first B01a ADR, before
schema or route integration. Agent email_test_matrix reviewed the updated packet
and current auth source without editing runtime or running tests.

| Decision to settle | Proposed conservative behavior and required proof |
| --- | --- |
| Recovery from delivery_unknown | Matching issuance-key replay never sends again. A fresh explicit user request may issue only after durable cooldown and no lock; supersede the old unknown generation atomically. Late old acceptance must never activate the replacement. This cannot be called provider reconciliation because A1 has no callback/status lookup. |
| Known/unknown forgot accounting while mail is pending, unknown or rejected | Accepted-only admission for known accounts but synthetic admission for unknown accounts can produce different429 behavior. Choose one account-neutral accounting policy before readiness denial, or an equivalent synthetic lifecycle. Prove same status/body/retry metadata and budget transitions across pending/accepted/unknown/rejected cases; no expected-digest comparison for an ineligible challenge. |
| Preliminary reset replay | Persist original proof expiry and challenge/generation binding. Replay must not mint Date.now()+900 JWTs, extend proof lifetime or create an API session. Final reset remains separately payload-bound and admitted. |
| Account deletion/recreation and cleanup | Request registry, scope budget/lock and durable outcomes must not cascade away with users/accounts/auth_otps. Define explicit retention/FK behavior so the same normalized email cannot reset abuse history through recreation. Challenge/session existence remains guarded in finalization. |

First implementation checkpoint should contain reviewed ADR, additive schema,
typed raw-D1 commands, and a dormant coordinator kernel before any route imports.
The integration test must observe the real kernel's verifyOtpDigest boundary;
a test-only `if admitted then compare` loop cannot certify service admission.
Lost-response faults after a committed admission must return replay/in-progress
without acquiring comparison ownership a second time. Finalization-response loss
must likewise preserve exactly one committed effect/outcome.

Suggested paths remain otp-policy.ts, packages/db/src/auth-otp.ts,
services/auth-otp.ts and integration/auth-otp-coordinator.test.ts; the coordinator
assigns the migration number after repinning the migration tip and related work.
Shared db export/test-helper edits have one owner. This checkpoint remains dormant
until all issuance, verify/reset and client compatibility paths are integrated.
