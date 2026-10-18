# Remaining live gates - 2026-10-18

Current policy and operational sequence are in
[19_SINGLE_OWNER_RELEASE.md](19_SINGLE_OWNER_RELEASE.md). The mandatory three-person
roster and two-key custodian requirements are removed by owner instruction.
GitHub suspension is resolved in canonical hello-tako/Takolio; baseline main CI
and Admin CI passed. New candidate checks must be verified on their own SHA.

| Gate | Current status | Required evidence |
| --- | --- | --- |
| Source publication/review | Candidate preparation | Normal PR, exact-head CI/Admin CI, configured approving review and exact-main push checks |
| Dedicated Admin resources | PENDING_EXTERNAL_EVIDENCE | Verified D1/KV/Worker/zone/hostname identities; internal-only facade; customer binding isolation |
| Real owner Access identity/key | PENDING_EXTERNAL_EVIDENCE | Dedicated Access app and allow policy; actual issuer/subject; owner key custody; audited enrollment/bootstrap |
| Protected Admin release infrastructure | PENDING_EXTERNAL_EVIDENCE | admin-staging/admin-production Environments, existing-style approval/no bypass, scoped secrets and actual enabled target policy |
| Live staging/provider contracts | PENDING_EXTERNAL_EVIDENCE | ST01-ST20, representative D1 load/concurrency, actual login/roles/browser/audit, recovery, disabled baseline and emergency/paired rollback |
| Production operations | PENDING_EXTERNAL_EVIDENCE | Owner production decision after staging, configured Environment approval, backup/retention/RPO/RTO and monitored authenticated smoke |

Missing external evidence must not be promoted to PASS. It does not block
independent offline implementation or publication. No Admin production deployment,
remote migration, enrollment, secret mutation or Environment approval has occurred.
