# B01b - Controlled inbox certification (not executed)

Status: PREPARED_ONLY. A1 mock acceptance checks do not certify inbox delivery.
Execute this runbook only after B01a issuance/unknown-generation/cooldown wiring,
operator authorization and a controlled recipient/domain are supplied. No scripts
here send mail or inspect credentials. Current readiness deliveryVerified=false
must remain until a separate evidence-reviewed implementation/release task.

## Inputs and setup

Pin reviewed implementation SHA, staging Worker version, expanded schema,
provider route and sender-domain onboarding evidence. The operator controls one
allowed test inbox and a provider-supported bounce test destination. Keep actual
addresses, OTPs, raw message IDs and provider console payloads out of repository,
logs, screenshots and shared reports. Use a random test-run ID for correlation.
Use isolated staging accounts/data and finite authorized send budget. Local mock
fixtures do not count toward this certification.

## Evidence and classification

Record only run ID, scenario, generation/issuance opaque correlation, provider,
state/evidence, response class, UTC admission/acceptance/inbox-observation times,
expiry and cooldown outcomes, plus private optional messageIdHash if approved for
operator artifact access. Hashes are correlation metadata, not anonymization.
Distinguish adapter accepted (native resolution/HTTP2xx) from delivered (controlled
inbox observed by operator) and bounced (authenticated provider evidence). Never
mark delivered from messageIdHash, configured binding or successful send result.

## Scenario sequence

1. Register/send to the controlled inbox. Observe one issuance generation and one
   provider acceptance. Confirm receipt manually without publishing OTP/body.
2. Verify before expiry through actual API; confirm authorized cookie/account
   transition. Replay the same operation/key; no new comparison/effect/session.
3. Request again inside the shared issuance cooldown. Expect strict denial before
   account mutation or provider call. After cooldown, one new generation may issue;
   old generation cannot verify or reactivate through a late acceptance.
4. Wait until the exact expiry boundary; expired verification cannot authorize.
   Explicitly request a new issuance after allowed cooldown/budget, then recover.
5. Exercise lost HTTP response/unknown transport via staging fault injection that
   does not invent a non-send result. Record unknown; do not automatically resend
   or switch provider. Reconcile evidence before deciding on a fresh issuance.
6. Use only a provider-supported bounce fixture. Record authenticated rejection/
   bounce provenance privately. A native suppression code must not fall through
   another provider. Do not send to arbitrary third-party addresses.
7. If lifecycle callbacks/status queries are implemented in a later scoped task,
   test authentication/signature, duplicate/reordered/late events and generation
   fencing before claiming delivered/bounced transitions. No callback exists in A1.
8. Password-reset known/unknown accounts must keep generic responses and strict
   shared cooldown/admission; only known eligible accounts send mail. Review
   response/timing evidence without exposing account membership or credentials.

## Completion and failure

Require actual controlled inbox and bounce evidence, strict B01a issuance/concurrency
checks, sanitized telemetry, reviewed callback/status semantics if used, retention/
access decision and a separately approved release artifact. Keep uncertified
scenarios OPEN; provider outages or uncertain sends are not a passing certificate.
A1 only prevents ambiguous native fallback within one invocation. Current legacy
resend clears KV cooldown on false and must be replaced by B01a before this run.

Retain generation/tickets/cooldown history on rollback. Use a named reviewed
adapter/coordinator artifact that understands unknown outcomes. Never restore
blind fallback, clear strict budgets or retry an unknown issuance automatically.
