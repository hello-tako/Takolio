# Planner, shopping, and cooking impact

ADR-075/076/077 retain existing catalog authority while preserving selected
cooking, composition and standalone V1 content. Candidate publication is blocked.

| Consumer | Implemented behavior | Remaining release requirement |
|---|---|---|
| Detail/start | Immutable unscaled content; separate fingerprint | Same-source hosted validation after0046/0047 |
| Cooking completion | Authorized archive; receipt-first replay; immutable command references | Version-aware hosted recovery |
| Offline queue | Exact version, command, servings and deductions survive reload/retry | Service-worker and real-device rehearsal |
| Legacy receipt | NULL unknown; fixed V1/unambiguous units; ambiguity fails closed | Preserve during promotion |
| Meal composition | New selection pins; authorized historical display; no current-fact borrowing; corrective removal | Hosted recovery with paired flags OFF; versioned evidence before historical computation |
| Old composition client | Strict DTO retained; pinned unversioned cooking disabled | Mixed-client hosted verification |
| Shopping | Historical mismatch rejects demand computation; no current-content substitution | Version-bound saved demand and explicit revalidation |
| V1 planner | New selections capture authority content; unchanged swaps retain pins; regeneration selects current content; projected composition resolves archive | Same-source hosted recovery; approved publication integration |
| Family/V1 anchors | Matching persisted component pin inherited, including legacy NULL; variants stay NULL | Hosted mixed-client and recovery proof |
| Old V1/family client | Capability negotiation omits new strict DTO fields | Pre-077 Worker cannot decode persisted pinned JSON; use same-source OFF recovery |

Current household restrictions precede new cooking mutations. Receipt replay
returns the durable result without another inventory debit. Historical content
cannot borrow mutable D1 time/nutrition evidence; unknown constraints fail closed.
Known pins survive detail/cook navigation and cache identity. An offline fallback
must match the requested content hash. V1 UI continues displaying its persisted
instructions; ADR-077 adds no new detail/cooking navigation.

Local validation:22_COOKING_FOUNDATION_VALIDATION.md,
23_SAVED_CONTENT_VALIDATION.md and24_V1_SAVED_CONTENT_VALIDATION.md.
No food-safety, nutrition, publication, GitHub review or hosted recovery approval
is implied by local tests.
