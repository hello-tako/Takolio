# Checkout reconciliation and local rollback

Local implementation only. Actual PayOS/sandbox, retention/refund policy and
production rollout: PENDING_EXTERNAL_EVIDENCE.

New clients send one Idempotency-Key for the frozen plan through transport retries.
HTTP 202 PAYMENT_RECONCILIATION_REQUIRED is not a successful checkout or permission
to pay. Repeating that key returns the same handle without dispatch. HTTP 409
COMMAND_IN_PROGRESS may be polled with the same key; a new key is a new purchase,
not transport recovery. GET /billing/checkouts exposes only the authenticated
user's outstanding handles, with no provider/account/key material. A reload must
use this read before deciding to create a replacement purchase.

For an unresolved handle, an authorized operator checks checkout_admissions,
payment_intents and payment_reconciliation_records by intent_id in restricted
storage, then compares the provider order/status using the merchant console.
Record restricted evidence externally; do not log account details, signatures,
raw provider responses or addresses. Confirm amount/currency/order/reference and
one grant. No automatic lookup/resolution/refund endpoint or synthetic money
movement is supplied. A paid failed/expired intent retains ADR-029 rejection;
finance must approve any remedy. Never change it to pending to replay a webhook.

Migration 0041 expands without backfill or rewriting 0018/0040. Older code can
still read payment_intents; old no-key creation retains its previous behavior.
Rollback keeps receipt/reconciliation tables. Do not discard uncertain receipts,
reset keys or resubmit through the legacy creator. Retention approval is required
before enabling this protocol in a real environment. Existing user-delete cascades
are inherited, not a new approved financial-retention policy.

Offline required checks: concurrent same-key admission, owner/plan separation,
original offer replay, response loss, process crash, expired tombstone, late result,
invalid instructions, transactional failure and existing webhook/grant suite.
Mock provider acceptance is separate from PayOS operational certification.
