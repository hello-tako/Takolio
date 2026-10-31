# Planner, shopping, and cooking impact

ADR-075/076/077/078 preserve cooking, composition, standalone V1 and shared
shopping content identities. Existing catalog authority remains; publication is
blocked by evidence and review gates.

| Consumer | Implemented behavior | Remaining release requirement |
|---|---|---|
| Detail/start | Immutable unscaled content; separate fingerprint | Same-source hosted validation after0046/0047 |
| Cooking completion | Authorized archive; receipt-first replay; immutable command references | Version-aware hosted recovery |
| Offline queue | Exact version, command, servings and deductions survive reload/retry | Service-worker and real-device rehearsal |
| Legacy receipt | NULL unknown; fixed V1/unambiguous units; ambiguity fails closed | Preserve during promotion |
| Meal composition | New selection pins; authorized historical display; conservative assessment; corrective removal | Hosted flags-OFF recovery; versioned evidence for historical computation |
| Old composition client | Strict DTO retained; pinned unversioned cooking disabled | Mixed-client hosted verification |
| Shopping | Saved contributions retain pins; changed content requests review; purchases/history survive; mismatched historical calculation rejects; receipt replay retained | Same-source hosted recovery and mixed-client certification |
| V1 planner | New selections capture authority content; unchanged swaps retain pins; regeneration selects current content; projected composition resolves archive | Hosted recovery; approved publication integration |
| Family/V1 anchors | Matching component pin inherited, including legacy NULL; variants stay NULL | Hosted mixed-client and recovery proof |
| Old V1/family/shopping client | Capability negotiation omits new strict DTO fields | Older strict Workers/caches cannot decode pinned JSON; same-source OFF recovery required |

Current household restrictions precede new cooking mutations. Receipt replay
returns the durable result without another inventory debit. Historical content
cannot borrow mutable D1 time/nutrition evidence; unknown constraints fail closed.
Known pins survive detail/cook navigation and cache identity. An offline fallback
must match the requested content hash. V1 UI displays its persisted instructions;
ADR-077 adds no new detail/cooking navigation. Shopping reads preserve saved
attribution without recalculation or inventory changes.

Local validation:22_COOKING_FOUNDATION_VALIDATION.md,
23_SAVED_CONTENT_VALIDATION.md,24_V1_SAVED_CONTENT_VALIDATION.md and
25_SAVED_SHOPPING_VALIDATION.md. No food-safety, nutrition, publication, GitHub
review or hosted recovery approval is implied by local tests.
