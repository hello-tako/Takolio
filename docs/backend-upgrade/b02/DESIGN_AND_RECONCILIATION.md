# B02 checkout retry and reconciliation design

Status: DESIGN_COMPLETE_LOCAL; implementation requires the explicit protected
billing task described by AGENTS.md and docs/ai/AGENT_RULES.md rule7.
Source inspected1963c469e2e3bd4819cda6bb9ef8162101ad523a, 2026-10-11 JST.
No billing, PayOS, payment schema, client or webhook bytes changed.

## Existing contract and observed gap

ADR-029 controls server prices/VND/order codes and pending-only transactional
entitlement grants. Provider creation failure marks the local intent failed;
late callbacks cannot grant a failed/expired intent. provider_reference uniqueness
rolls back a repeated reference and grant together. The existing client sends only
plan and the server creates a fresh order/intent on every POST. Thus a response
loss followed by a new POST can create a second intent. This is a source finding,
not evidence of a production duplicate charge. Existing payment-authority tests
must remain mandatory when implementing this design.

## Decision-complete future creation protocol

The client creates a random checkout-generation key for an explicit new purchase.
All transport retries use that key and frozen request. The key is scoped by the
server authenticated user, operation and normalized plan; client price/currency/
ownership fields cannot enter authority. A new explicit checkout uses a new key.
The client keeps a bounded tab-memory generation record and does not automatically
re-key uncertain requests. Reload recovery needs an authorized read of that user's
pending/uncertain intents; it cannot silently assume no payment exists.

One atomic D1 admission writes an immutable receipt binding user/key/fingerprint,
original offer(plan,amount,currency,priceVersion), intent ID and provider orderCode.
Same key/body replays that offer even after prices change. Changed normalized body
returns409 IDEMPOTENCY_CONFLICT. Denied/expired keys never become new purchases.
Proposed intent/key validity is24hours for request identity with a retained tombstone
of90days; actual payment expiry remains ADR-029's issued offer TTL. Finance/privacy
owners must approve final retention before a migration. Unknown remote outcomes
cannot be garbage-collected while unresolved.

A leased provider-create attempt transitions admission -> dispatching -> instructions
accepted or remote_uncertain. A crash after dispatch, a timeout or malformed/lost
response remains uncertain. A second worker cannot blindly issue another create.
It reads the provider order by persisted orderCode using an approved read API;
only authoritative evidence of absence plus documented provider idempotency permits
a new bounded attempt. The same remote order identity must be retained. No
exactly-once network call is promised without PayOS's documented guarantee.

States and responses: local admission returns an intent handle; accepted instructions
replay201/200 with original fields; active dispatch returns409 COMMAND_IN_PROGRESS;
uncertain returns202 PAYMENT_RECONCILIATION_REQUIRED plus a bounded handle; body
conflict409; expired key409 CHECKOUT_KEY_EXPIRED. No client timeout becomes paid.
This is a future versioned protocol, not a claim about today's endpoint responses.

## Reconciliation record and operator procedure

Keep a durable record bound to intent/order, reason(enum), first/last observed UTC,
attempt number, evidence reference/hash, observed provider status, local status,
resolution action and operator authority. Access to full payment/account details
belongs in the restricted source system. General logs contain only random support
references and bounded event/status enums; no bank account, transfer description,
signature, raw provider response or user email.

1. Freeze automatic create/retry/grant for the affected uncertain intent.
2. Read the local intent, immutable offer, grant receipt and provider order using
   read-only access. Capture an authorized sanitized evidence reference.
3. Verify order identity, expected amount/currency, provider reference uniqueness
   and current local entitlement. Mismatch stays unresolved and escalates.
4. If remote paid while local failed/expired, retain ADR-029 rejection. An operator
   must choose an explicitly authorized business resolution; do not replay a grant
   or mutate the webhook to bypass pending-only policy.
5. If paid already granted, verify one durable grant and close as replay. If unpaid
   authoritatively cancelled/absent, record resolution before inviting a new key.
6. Record operator/reason/evidence/time and immutable receipt. A repeated resolution
   command returns its receipt and cannot issue another grant/refund.

## Refund policy gate

The existing refunded enum does not prove money moved. Automatic full/partial
refunds remain disabled. Before B02b, finance must decide refundable amount/fees,
partial allocation, rounding, entitlement revocation/pro-ration, consumed benefits,
late refunds, disputed payments, provider refund identifiers and operator roles.
Refund command keys bind intent + amountMinor + currency + policyVersion; same key
with different amount conflicts. A provider timeout creates refund_uncertain,
never refunded. Confirmed provider evidence and one durable settlement are required.
No policy decision is fabricated in this document.

## Acceptance and rollout packet

Future scoped implementation must reproduce checkout response-loss first and prove
one durable intent across concurrent same-key requests/crash/takeover, original-price
replay, conflict/expired tombstones and remote uncertainty. Keep existing signed
webhook/mismatch/reference reuse/late/failed transaction tests, client retry-generation
and restricted operator tests. Additive schema gets a coordinator-assigned number;
old rows preserve ADR-029. Run local D1 replay/FK/quick_check and clone reconciliation
before a separately authorized staging release. Rollback retains receipts/offers/
uncertain states and never resets grants or generates replacement remote orders.
