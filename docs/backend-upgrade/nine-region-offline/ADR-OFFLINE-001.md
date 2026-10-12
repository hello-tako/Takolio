# ADR OFFLINE-001: Checkout admission and bounded offline authorization

Accepted for local implementation only, 2026-10-12.
The user's nine-region request explicitly authorizes B02a changes; the later
instruction forbids production changes, real OTP and paid AI, with budget USD 0.

Checkout identity is opt-in using Idempotency-Key (16-128 ASCII token characters).
Existing requests without the header preserve their legacy contract for coexistence.
The updated client retains one random key per purchase generation, scoped to the
current session/plan. No automatic retry changes identity. Before dispatch a new
plan may start a generation; after dispatch the plan stays frozen even across
transport failure. Ready receipts block another creator and can be reopened.
Owner changes fence the old generation. A reload checks outstanding handles.

Add migration 0041; no applied migration changes. Atomic D1 admission fixes one
intent/original offer per authenticated user/key. Same key with different plan
conflicts; ignored legacy price fields cannot alter authority. Initial admission
owns one provider attempt, with 30-second deadline. Ready instructions replay;
active attempt returns COMMAND_IN_PROGRESS; timeout/crash/invalid provider response
becomes PAYMENT_RECONCILIATION_REQUIRED and never dispatches again. No provider
absence/idempotency guarantee is assumed. Ambiguous intents become failed under
ADR-029, retaining late-payment rejection. A transaction commits offer description
and instructions together, fenced by attempt identity and deadline. Existing
pending-only signed webhook/grant logic is unchanged.

Receipts are retained without automatic cleanup until finance/privacy decide a
retention policy; no 24h/90d policy approval is fabricated. Payment expiry still
30 minutes; expired keys are tombstones and cannot mint replacement purchases.
Reconciliation records retain bounded reason/state/time only. No automatic grant,
refund, provider lookup or resolution endpoint is introduced without business and
operator authority. Owner-scoped outstanding handles support reload recovery.
Rollback keeps these tables and receipts, and disables the new client feature;
legacy code must never resubmit uncertain identities. Production rollout remains
PENDING_EXTERNAL_EVIDENCE and separately approved.
