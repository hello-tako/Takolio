# Planner, shopping, and cooking impact

ADR-075/076 retain V1 catalog authority while preserving selected cooking and
composition content. Candidate publication remains blocked.

| Consumer | Implemented behavior | Remaining release requirement |
|---|---|---|
| Detail/start | Immutable unscaled content; separate fingerprint | Same-source hosted validation after0046/0047 |
| Cooking completion | Authorized archive; receipt-first replay; immutable command references | Version-aware hosted recovery |
| Offline queue | Exact version, command, servings and deductions survive reload/retry | Service-worker and real-device rehearsal |
| Legacy receipt | NULL unknown; fixed V1/unambiguous units; ambiguity fails closed | Preserve during promotion |
| Meal composition | New selection pins; authorized historical display; no current-fact borrowing; corrective removal | Hosted recovery with paired flags OFF; versioned evidence before historical computation |
| Old composition client | Strict DTO retained; pinned unversioned cooking disabled | Mixed-client hosted verification |
| Shopping | Historical mismatch rejects demand computation; no current-content substitution | Version-bound saved demand and explicit revalidation |
| Existing V1 planner | Existing immutable result and authority fence retained | Version-bound selection and recovery compatibility |

Current household restrictions precede new cooking mutations. Receipt replay
returns the durable result without another inventory debit. Historical content
cannot borrow mutable D1 time/nutrition evidence; unknown constraints fail closed.
Known pins survive detail/cook navigation and cache identity. An offline fallback
must match the requested content hash.

Local validation:22_COOKING_FOUNDATION_VALIDATION.md and
23_SAVED_CONTENT_VALIDATION.md. No food-safety, nutrition, publication, GitHub
review or hosted recovery approval is implied.
