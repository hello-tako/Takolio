# Super administrator governance

Provenance/proof status: REPORT.md and SOURCE_MANIFEST.md.

Access identity must match a previously approved issuer/subject enrollment,
not an email-only first-login takeover. Human operator approval is a separate
record. A single person must not satisfy two-person controls by using two user
IDs, subjects or signing keys. Explicit role rows are independent of email.
Production login requires at least three active, independently enrolled,
loginable SUPER_ADMIN operators. The minimum-two database invariant remains.

Privileged transactions recheck acting authority, session validity and enrolled
identity at the write boundary. Approval requester/decider/target separation and
one-time decisions apply to concurrent requests as well as sequential requests.
Bootstrap grants, closure and durable audit must commit together. Recovery is
not an HTTP API or an emergency flag: a reviewed offline batch verifies two
pre-enrolled signatures over one canonical action with source/database identity,
expiry and replay protection; grants precede any revocation so the minimum is
never bypassed. Audit failure rolls the entire action back.

A staging ceremony must independently establish named humans, Access issuer/sub,
account IDs, approval references, recovery key custody and reviewer separation.
No production/bootstrap/remote recovery action is authorized by this package.
