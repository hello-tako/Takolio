# ADR-PAYOS-001: Isolated payOS channels and staged activation

Status: Accepted for the explicitly authorized payOS integration, 2026-10-12.

## Context

Tako-san already issues server-priced payment intents, verifies payOS HMACs,
reconciles owned pending orders and grants Plus in a transactional D1 batch.
Neither deployed Worker currently has payOS credentials. payOS confirms webhook
URLs by sending a signed sample transaction for an order the application did not
issue. The existing handler rejects that sample, preventing channel setup.
A separate production release is in progress on main.

## Decision

Use separate `Tako-san Staging` and `Tako-san Production` channels on the bank
account selected by the owner (suffix 7897). Store each channel's client ID,
API key and checksum key only in its corresponding Cloudflare Worker.
Keep keys out of repository, PRs, browser screenshots and operator output.

New checkout requires exact `PAYOS_CHECKOUT_ENABLED=true` as well as all three
keys and a valid application origin. An absent or false flag rejects issuance
before D1 writes or provider calls. Existing issued orders continue to reconcile
when checkout is disabled. Store this operational flag as a Worker secret binding,
so ordinary application deployments retain the operator's activation state;
there is intentionally no default-on Wrangler variable or deployment input.

Only an authenticated, schema-valid signed event with the documented sample
order 123, amount 3000 VND and description VQRIO123 is acknowledged without a
mapped order. It performs no write and grants nothing. A mapped order always
passes the existing reconciliation checks. Other unknown orders remain errors.
Bound webhook bodies at 16 KiB and provider responses at 64 KiB.

The setup CLI pins both application origins and the official payOS API origin.
It defaults to dry-run, reads private regular credential files, sends a signed
no-purchase preflight, and confirms the provider webhook only after that succeeds.
Its output excludes keys and raw provider data.

## Release and rollback

Merge through the normal protected PR/CI process. Complete the concurrent release
and migration 0041 before uploading a new production application. Deploy this
change with checkout disabled, then provision secrets, confirm staging and
production webhooks, and explicitly enable each environment only after checks.
Use existing immutable-SHA deployment workflows and Environment review; retain
D1 catalog authority and paired planner/T20 settings.

Disable new checkout by setting the flag to false, leaving checksum verification
available for outstanding orders. A code rollback to a pre-flag version ignores
this new flag: remove its API key before that rollback, retain the checksum for
pending callbacks, and record the outstanding-order reconciliation queue.
Never treat removal of credentials or a restored old version as payment success.

## Consequences

No price, entitlement duration, authentication rule or applied migration changes.
No automatic refund, payout, transfer, or invented success event is introduced.
A real bank transfer and end-to-end Plus entitlement observation require the
owner's controlled payment. Provider link creation/cancellation and webhook
confirmation establish protocol/configuration evidence, not money settlement.

Reference: https://payos.vn/docs/api/ (webhook sample and confirm-webhook API).
