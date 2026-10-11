# B01b A1 - Bounded email acceptance adapter

Date: 2026-10-11 JST. Repository vn-tak/Tako-san, ID1385308553.
Main reverified with `git ls-remote origin refs/heads/main`:
`652e0d7632745e9b77cda4b5b3caac83a3ec1015`.
Implementation base: `98471e10d4b874219b069ec8b38a26fdd719db81`.
Branch: `codex/backend-b01b-email`.

## Scope and decision

Implement adapter checkpoint A1 before B01a issuance integration. Owned runtime:
`src/worker/services/email.ts`; related email privacy/lifecycle tests. No auth
route, database, migration, provider config, billing or workflow edits.
ADR-B01b-001 extends ADR-028's routing policy. Provider acceptance is not inbox
proof. This checkpoint uses mocked providers only.

## Contract

Keep `sent/provider/error` compatibility, add required `state/evidence`.
`sent` is true only for `accepted`. Actual adapter states are accepted, rejected,
delivery_unknown and not_configured. Delivered/bounced are later lifecycle states
requiring authenticated evidence; neither can originate from sending an email.
Replace unused raw `messageId` with optional SHA256 `messageIdHash` of bounded
opaque tokens (8-128ASCII letters/digits/underscore/hyphen, at least one letter);
omit malformed/contact/numeric/control-bearing/oversized values. No caller reads IDs.
Never expose/log raw IDs, including IDs containing contact or OTP text. Hashes
are private correlation metadata, not anonymization or delivery proof.

Native send fulfillment proves acceptance. Exact string native codes for sender,
recipient, rate and daily policy failures prove rejection under the structured
provider contract. Only E_SENDER_NOT_VERIFIED / E_SENDER_DOMAIN_NOT_AVAILABLE
permit same-call Resend fallback. Recipient suppression, recipient policy and
quota/rate limits terminate the call. Arbitrary exceptions or unknown codes are
unknown. A subdomain-message heuristic may choose a sanitized error category but
cannot authorize fallback or establish rejection evidence.

Resend HTTP 2xx is acceptance, independently of optional body/ID parsing. HTTP
4xx except408 proves rejection;408/5xx/unexpected statuses are unknown. Fetch
exceptions/deadlines are unknown. No automatic HTTP retry or redirect is allowed.
Use an8000ms deadline per attempted provider, covering dispatch and body reads;
maximum sequential fallback budget16000ms plus local scheduling overhead. This is
an adapter policy, not a measured production latency SLO. Abort Resend best effort;
Cloudflare structured send has no abort contract. Ignore late completions and
attach rejection handlers. Cancellation never proves non-delivery.

Retain/parse at most4096metadata bytes, with at most64stream read calls. The
chunk crossing the byte limit is discarded; this is not a hard transport-byte
bound. Cancel oversized/stalled bodies best effort.
Observed HTTP status survives metadata failure/deadline. Never retain/log bodies,
exception text, recipient, subject, OTP, credentials or provider IDs in diagnostics.
Evidence is a bounded provenance enum, not an unverified delivery certificate.

## Acceptance and checks

1. Reproduce generic native exception triggering Resend before implementation.
2. Test acceptance, known sender fallback, suppression/quota terminal behavior,
   generic/unknown-code exceptions, unabortable native timeout and late resolve/
   reject; exactly one provider call after ambiguity and no late logging/fallback.
3. Test Resend dispatch that ignores abort, stalled/malformed/oversized bodies,
   2xx acceptance without ID,4xx rejection,408/5xx ambiguity and safe ID handling.
4. Capture sanitized logs and run current auth-hardening/browser-security regressions
   to preserve legacy `sent` compatibility and password-reset enumeration behavior.
5. Required full lint/typecheck/tests/local migration smoke/build. Freeze source
   hashes; retain actual failure and passing records in b01b/RESULT.md.

## Integration limits and next action

Current auth invalidates production challenges on `sent=false`; resend clears its
KV cooldown on delivery failure. Thus A1 only prevents duplicate fallback within
one adapter invocation. B01a must persist acceptance/unknown generations and retain
strict issuance cooldown across HTTP requests before lifecycle certification.
No callbacks, delivered/bounced transitions, retention policy, real inbox/bounce
send or production rollout in A1. B01b E2E follows B01a and operator inbox inputs.

Rollback uses a reviewed adapter retaining conservative unknown handling; never
restore unconditional fallback after an ambiguous native send. No durable schema
or data rollback is introduced by this checkpoint.

## Local checkpoint receipt

A1_LOCAL_VERIFIED; implementation `31d5fd860ef9b65fc38ccdc664074bda348b0a8c`. Final focused 4 files / 174 tests and
full 289 files / 6798 tests PASS; lint/typecheck/migration/build/frozen-install PASS.
Initial interrupted full run and dependency findings remain recorded.
See [RESULT.md](../b01b/RESULT.md) and validation.json for actual gates/limits.
