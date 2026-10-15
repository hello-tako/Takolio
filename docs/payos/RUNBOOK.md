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

## Billing account recovery and temporary acceptance offer

Deploy the reviewed exact SHA through the protected release workflow, staging
before production. Confirm the active Worker, assets, D1 identity and migration
0041 before changing payment flags; a secret update deploys a new Worker version.
Preserve the matching channel credentials and checksum key already provisioned.
Record the previous stable version and inspect secret names without printing values.

After the new code passes live checks, set `CHECKOUT_ADMISSION_ENABLED=true` on
staging and verify authenticated `/billing/plans` reports the capability enabled.
Check `/billing/account` and owner-only recovery before repeating on production.
The exact value `true` is required. Keep `PAYOS_CHECKOUT_ENABLED=true` only while
creation is intended to be available. Admission disabled hides QR recovery and
returns to legacy unkeyed creation, so it is not an issuance kill switch.

For the owner's explicitly authorized real acceptance transfer only, set
`PAYOS_TEST_MONTHLY_PRICE_VND=2000` as a Worker secret on the intended environment
after the protected release is live. Confirm the active version and authenticated
plans response: monthly 2,000 VND, annual 499,000 VND. The temporary price applies
to all newly issued monthly offers on that Worker while configured; it is not
restricted to a browser or user account. Values other than exact `2000` make plans
and creation fail closed. Requests cannot select the price through fields, query
parameters or headers.

Delete `PAYOS_TEST_MONTHLY_PRICE_VND` immediately after acceptance to restore the
49,000 VND monthly catalog. Do not set an empty string, `false`, `0` or `49000`:
those are invalid configuration, not restoration. Verify the new active Worker,
secret-name absence and authenticated plans response after deletion. Staging and
production are independent: remove the secret from every environment where it was
set. Previously issued 2,000 VND or 49,000 VND orders retain their original amount
and expiry; catalog restoration does not reprice, cancel or renew them.

An existing legacy 49,000 VND pending order blocks a new offer until its original
30-minute expiry or verified settlement, even when its QR was not persisted. Its
history row has `canResume=false`; the app must not fabricate bank instructions or
create another provider order to recover it. Wait for expiry and refresh history,
or reconcile it against payOS/bank evidence. Do not alter expiry, mark it paid or
write a subscription to unblock the acceptance test. Never pay an expired QR:
late first settlements require manual reconciliation/refund handling.

The owner performs the bank transfer after checking amount, destination and
content in the app. Acceptance requires all of the following evidence:

- Closing/reopening the app restores the same pending intent and stored QR
  without another provider create; repeated or simultaneous attempts cannot
  create another outstanding offer for the owner.
- The real provider transaction is paid for the exact issued amount, and the
  authenticated intent and billing history show `paid`.
- `/me` and `/billing/account` show active Plus with the expected expiry after
  refresh/reopen; a repeated signed callback must not extend the same grant.
- Renewal uses a distinct new offer after settlement and extends an existing
  active finite expiry by 31 days monthly or 366 days annual when that new order
  is paid. Pending renewal alone never changes entitlement.
- Catalog restoration to 49,000 VND is verified without issuing an extra order.

History returns the latest 20 payments and `hasMore` for older rows. Its
`hasPendingPayment` summary also covers legacy pending orders and unresolved
admissions outside those 20 rows. An expired ready order does not block a new
offer; `dispatching` or `remote_uncertain` remains blocked regardless of expiry
until reconciliation. A payment already verified as `paid` with its persisted
provider reference no longer blocks renewal, even if its create response was
lost. The uncertain admission record remains truthful and is never replaced with
fabricated instructions.

For an incident, first set `PAYOS_CHECKOUT_ENABLED=false` to stop all creation;
retain checksum verification, history and polling for issued orders. Disabling
admission alone permits legacy unkeyed creation and loses recovery protection.
Worker/version rollback does not undo issued provider orders, payments,
subscriptions, checkout tombstones or secret changes. Keep additive migration
0041 and financial records. Verify the target version's flags, price configuration,
credentials and compatibility with pending orders before restoring it. Code from
before this release lacks account recovery and the owner-wide duplicate fence;
keep issuance disabled during such a rollback. Code before payOS flag support
also requires removing the API key to prevent creation. Do not remove the checksum
key needed to reconcile outstanding orders.
