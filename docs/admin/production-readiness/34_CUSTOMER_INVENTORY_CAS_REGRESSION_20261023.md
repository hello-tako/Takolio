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

## Candidate preview against actual staging D1

The isolated candidate preview at runtime commit `485bb1218d85b771a7c3234776a0e5ddd74f618d`
passed 113/113 assertions over 116 requests using four genuine guest cookie
sessions. Inventory PATCH/DELETE used the candidate handler and actual staging
D1; other requests exercised the existing customer staging Worker through its
service binding. Cleanup passed 17/17 checks, removed synthetic shopping items,
retained the expected zero-quantity inventory tombstone, and revoked all four
sessions. A separate temporary diagnostic guest was also revoked with a final
zero-active-session readback.

The 48 read requests ran at concurrency 4: p95 844ms, maximum 913ms. This is a
bounded measurement, not representative capacity certification. Sanitized
receipt: `evidence/customer-inventory-cas-preview-20261023.json`.

The first full local test run had 9146 PASS / 12 FAIL. Eleven failures were macOS
`/var` versus `/private/var` temporary-path expectations; the affected tests pass
100/100 with `TMPDIR=/private/tmp`. The remaining failure identified an inventory
unit-test fake that omitted UPDATE RETURNING rows. Its result shape was updated
without weakening assertions. The initial failed run remains retained; the
current full-suite outcome must be read separately. No all-green full-suite
claim is inferred from targeted reruns.
