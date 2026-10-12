# payOS operations

## Environment mapping

| Environment | Worker | Channel | Webhook |
| --- | --- | --- | --- |
| staging | frigo-staging | Tako-san Staging | https://frigo-staging.tungbipdz.workers.dev/api/v1/billing/payos/webhook |
| production | frigo | Tako-san Production | https://frigo.tungjpstore.net/api/v1/billing/payos/webhook |

The staging channel uses a real linked bank account; it is not a bank sandbox.
Never automatically pay a staging QR. The server owns prices: 49,000 VND monthly
and 499,000 VND annual. Entitlements are 31 and 366 days respectively.

## Provision and activate

1. Require a green exact-SHA CI, approved main release and verified live Worker.
   Deploy through `.github/workflows/deploy.yml`, preserving catalog mode `d1`,
   canary `0`, and paired planner/T20 `true`. Check migration 0041 through the
   release workflow, not by replaying applied migrations manually.
2. After the flag-aware application is deployed, write
   `PAYOS_CHECKOUT_ENABLED=false` as a Worker secret binding. Confirm the active
   code's GIT_COMMIT, APP_URL and D1 identity before the next step. Record the
   previous stable Worker version; secret updates create/deploy new versions.
3. Bulk-upload only the matching channel's `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`
   and `PAYOS_CHECKSUM_KEY` to that Worker from a private JSON file. Never print
   the file, place it in a repo or pass keys as command-line arguments. Inspect
   secret names only after upload.
4. Run a dry-run, then the explicit registration action for staging:

   ```sh
   node scripts/payos-channel.mjs --env staging --dry-run
   node scripts/payos-channel.mjs --env staging --credentials /private/path/staging.json --confirm-webhook
   ```

   Repeat with `--env production` and the separate production credential file.
   The signed preflight ACK creates no order and grants no subscription. The
   provider must return the exact webhook URL. Stop on any failure.
5. Verify invalid signatures return 401, malformed input returns 400, oversized
   input returns 413 and guests/unauthenticated users cannot issue orders.
   Exercise actual create/signature/read/cancel through the provider without
   transferring money; keep a private receipt containing only allowlisted fields.
6. Set `PAYOS_CHECKOUT_ENABLED=true` as a Worker secret binding, staging first.
   Check active stable version, health and signed webhook again. Repeat production
   only after its release approval and the concurrent release have completed.
7. Truncate temporary credential files after verified upload and setup. Preserve
   evidence of secret names, Worker versions and provider-confirmed URLs, without
   values. Keys remain recoverable only from the owner's payOS dashboard.

## Acceptance

Automated tests cover server prices, provider signatures/order identity, webhook
replay, duplicate references, expiry, owner isolation and atomic Plus grants.
The modal polls the owned payment and refreshes `/me` before displaying Plus.
For settlement acceptance the owner signs into a controlled app account, selects
a plan, checks its amount/destination/content, and performs the bank transfer.
Verify the owned intent is paid and `/me` reports Plus; a refresh must preserve it.
Never fabricate a webhook or directly edit a subscription to satisfy this check.

## Incident and rollback

Set the checkout flag false to stop new issuance. Keep checksum verification and
polling available for existing orders. For a timeout or ambiguous create failure,
match the application order code against the provider transaction dashboard before
retrying; do not automatically grant, cancel, or refund an uncertain payment.

Existing handlers reject mismatched, unknown, expired, non-pending and reused-reference
callbacks. Review these exceptions manually against bank/provider evidence. A late
payment needs owner-approved reconciliation/refund handling; no automated refund API
is implemented. Retention, refund and support policy are business decisions still
requiring documented owner acceptance.

A rollback to a version before this integration ignores the new flag. Remove only
the API key before that code rollback to prevent unintended issuance; keep checksum
verification for outstanding orders. Reprovision the API key only after deploying
flag-aware code and reconfirming setup. Do not restore a Worker version without
checking its secrets and pending-order compatibility.
