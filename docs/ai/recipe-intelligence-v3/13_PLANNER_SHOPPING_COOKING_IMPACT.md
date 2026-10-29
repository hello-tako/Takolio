# Planner, shopping, and cooking impact

ADR-075 closes the cooking version gap while keeping the V1 catalog unchanged.

| Consumer | Current behavior | Remaining release requirement |
|---|---|---|
| Detail/start | Capture trusted unscaled content; return separate fingerprint | Same-source hosted validation after0046 |
| Cooking completion | Household-authorized archive; receipt-first replay; immutable references | Version-aware recovery before changed content |
| Offline queue | Retain exact version, command, servings and deductions across reload/retry | Hosted/service-worker and real-device rehearsal |
| Legacy receipt | NULL remains unknown; fixed V1/unambiguous units; ambiguity fails closed | Preserve these rules during later promotion |
| Meal composition | Stores recipe identity; catalog changes require revalidation | Durable selected-content pin/read policy |
| Shopping | Rejects catalog change rather than silently changing demand | Version-bound saved demand and explicit revalidation |
| Existing planner | V1-compatible instructions/requirements retained | Version-bound selection and recovery compatibility |

Current household restrictions are evaluated before a new cooking mutation.
A replay returns the durable result without another debit. Historical content
cannot borrow mutable D1 time/nutrition evidence; unknown constraints fail closed.

Candidates remain review-only. Cooking foundation alone does not authorize
publication or certify planner/shopping compatibility, food safety or nutrition.
