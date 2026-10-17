# Risk Register

| Risk | Evidence | Control | Status |
| --- | --- | --- | --- |
| DNS/custom domain absent | Zone has 0 DNS records, 0 Worker routes and no Worker connected | Attach only after staged gate with reversible snapshot | BLOCKED |
| Live binding drift | Version includes AI, Assets, Send Email and typed storage bindings | Capture complete typed set; fail unknown or mismatch | CONTROLLED LOCALLY |
| Dirty SHA identity | Domain implementation is uncommitted on this branch | Candidate preparation rejects dirty/untracked source | CONTROLLED LOCALLY |
| Legacy session break | `__Host-` cookies are host-only | Preserve old host; no legacy redirect; require new-origin login | ACCEPTED / DOCUMENTED |
| Staging/production overlap | Separate D1/KV/R2/Queue IDs observed | Exact comparison rejects overlap | PASS locally; live settings audit pending |
| Provider callback mismatch | PayOS webhook and Google GIS depend on exact origin/provider settings | Keep old callbacks until provider-approved cutover; real tests blocked | BLOCKED |
| Staging exposure | Access has no Takolio staging app; new hosts are absent | Operator must add reviewed Access policy or prove safe public data | BLOCKED |
| Mobile association error | Package, Team ID and fingerprints unavailable | Return 404; publish only verified payloads | PENDING |
| Operational settings drift | Version metadata does not fully prove routes/crons/consumers/observability | Re-capture and compare immediately before deployment | BLOCKED |
| Production change without owner approval | Prompt explicitly gates cutover | No deploy/DNS/provider mutation by this branch | BLOCKED |
