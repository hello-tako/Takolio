# Customer inventory CAS regression found during Admin acceptance

Admin staging acceptance source: `0322a9197bee4a4a42d95cc150f8d4fff6d53ba8`.
Production Admin remains `NOT_DEPLOYED`.

A synthetic guest transaction against the actual customer staging Worker/D1
reproduced a false conflict: POST inventory succeeded at version 1; PATCH with
version 1 returned 409 even though a subsequent GET showed quantity 3/version 2.
DELETE with the current version also returned 409 despite committing the
zero-quantity/version-3 tombstone. No concurrent writer was present.

D1's `meta.changes` includes household revision-trigger effects. The legacy
inventory handlers incorrectly require exactly one total change after the batch
commits. The fix uses the single row returned by the existing conditional UPDATE
as its success signal. Household ownership, revision predicates, atomic audit
insertion, native-authority commands and idempotency remain in force. No migration
or authentication change is needed.

Two actual local D1 route regressions fail on the original code and pass with the
fix. They cover mutation acknowledgement without an idempotency key, stale-version
and cross-household rejection, idempotent PATCH replay and exact audit counts.
The focused five-suite run passes 154/154 tests. These local results do not claim
that the customer staging deployment has been updated or that ST19 is complete.

The remote failed attempt retained four revoked guest sessions and a zero-quantity
inventory tombstone. These synthetic rows stay under the normal staging guest
lifecycle. No paid AI call, email send or production mutation occurred.

This finding must be verified after the customer staging runtime receives the
reviewed fix. The Admin all-PASS certificate is still absent; existing incomplete
role/browser, provider rotation and registered-account checks retain their actual
pending state.
