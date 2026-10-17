# Production runbook - prepared, not authorized

Runtime source: `9395f0e31ea599f1eb7780a8eba36964fed7c483`. Main baseline: `526596a8cd857984ad2b69901a8c7b0e9d6bccc2`.
Prepared by implementation owner `/root` (Codex); independent reviewer is
`/root/independent_admin_review`. Evidence environment: local macOS arm64,
Node v24.16.0, pnpm 10.33.2, Python 3.9.6, `TMPDIR=/private/tmp`.
Evidence timestamps are UTC. Commands, exit codes, log digests and limitations
are in `evidence/verification.json` and `12_REGRESSION_RESULTS.md`.
No live Cloudflare operation or operator approval is implied.

Current disposition: BLOCKED. Nothing in this runbook authorizes execution.
All technical/staging gates, actual resource identities and a separate explicit
owner approval must precede production migration, deployment, bootstrap or flag
enablement. No production resource or secret was inspected or changed.

## Entry checklist

Reviewed exact source/full regression/required hosted checks; all F1-F11 accepted
by independent reviewer; reviewed live release/migration/recovery adapters;
protected environment and self-review prevention verified; real staging matrix
and Access roster/rotation/rollback evidence accepted; target resource manifest
and secret custody verified; backup and restore rehearsal; named operator/on-call
and independent approvers; approved audit retention/access; cost/capacity envelope.
Current gaps are in 17. Template IDs, empty origin/Access values and unset shared
secret are deliberately nondeployable.

## Intended sequence after separate authorization

1. Pin exact approved source, build and migration hashes and record operator
   dispatch/approvals. Confirm customer release is independent and healthy.
2. Verify production account, Admin/Facade Worker identities, dedicated ADMIN_DB,
   KV, customer read target and Access hostname/issuer/audience. Stop on mismatch.
3. Take authorized ADMIN_DB backup with tested restore evidence and restricted
   custody. Record pre-deploy audit and previous compatible release version.
4. Apply only approved additive Admin migrations through reviewed adapter and
   confirm version 3/ledger/audit guards. Keep console disabled.
5. Release facade and disabled Admin artifacts with restricted Service Binding
   and secret distribution. Verify no public facade, no password module, disabled
   assets and customer health. Record actual versions and manifest.
6. Perform separately authorized operator enrollment/bootstrap and verify human
   separation, sessions, audit and recovery custody. Do not improvise SQL.
7. Enable only under explicit approval after all prior checks; run external
   Access, RBAC, CSRF/Origin, asset and data-projection smoke. Any failure invokes
   fail-closed shutdown and the compatible rollback plan in 16.
8. Record post-deploy versions, operator/result evidence and monitoring ownership.

## Monitoring and data handling required

Before release assign alerts for sustained Admin 5xx/503, JWKS failure, auth
anomalies, rate-store failures, facade dataset/query cap, audit write failure,
unexpected role/recovery operations and customer DB latency/rows-read/cost.
Thresholds must be set from staging measurements; no production SLO is invented.
Audit is append-only in ADMIN_DB; access is restricted by server RBAC. Approve a
retention period, export custody, encryption/access reviews and restore handling
before live use. Never log JWTs, cookies, passwords, raw credentials or full PII
reveal payloads. Real operator enrollment and recovery key material stay private.

Resource caps are documented in 06. High-cardinality production tables can exceed
5000 rows and return unavailable; representative staging scale/load evidence is
required before claiming that Admin is operationally suitable. Provider AI cost
completeness and external health/queue adapters remain unavailable.
