# Security threat model

Runtime source: `9395f0e31ea599f1eb7780a8eba36964fed7c483`. Main baseline: `526596a8cd857984ad2b69901a8c7b0e9d6bccc2`.
Prepared by implementation owner `/root` (Codex); independent reviewer is
`/root/independent_admin_review`. Evidence environment: local macOS arm64,
Node v24.16.0, pnpm 10.33.2, Python 3.9.6, `TMPDIR=/private/tmp`.
Evidence timestamps are UTC. Commands, exit codes, log digests and limitations
are in `evidence/verification.json` and `12_REGRESSION_RESULTS.md`.
No live Cloudflare operation or operator approval is implied.

Assets: customer data, operator identities, grants, sessions, audit history,
recovery signing keys, facade HMAC secret and release credentials. Trust
boundaries: browser/Access, browser/Admin HTTP, Admin/ADMIN_DB, Admin/facade RPC,
facade/customer D1 and operator/release control plane.

| Threat / trigger | Implemented control | Remaining verification |
| --- | --- | --- |
| Forged or foreign Access assertion | RS256 signature, issuer/audience/time, human subject, service identity refusal, bounded JWKS refresh | Real tenant, approved IdP/application policy, rotation and logout |
| Reassigned email acquires grants | Immutable enrolled issuer/subject, human operator record, approved references and security epoch | Real human verification and custody |
| Customer-origin script mutates Admin | Dedicated origin, exact Origin and session CSRF, no cross-origin authority, strict cookie and CSP | Actual custom hostname, TLS/Access and asset edge routing |
| Client forges roles or asks for credentials | Server RBAC plus signed exact-input RPC, strict projections/output schemas | Deployment binding identity and secret custody |
| Compromised approver races revocation | Durable enrollment/role checks and audit in batch; immutable operation, replay/expiry guards | Real D1 concurrency rehearsal |
| Operator loss locks governance | Three eligible operators per issuer; offline two-custodian recovery | Independent people, key custody and staging rehearsal |
| Database/audit failure produces unaudited privilege or disclosure | Audit before sensitive disclosure; atomic trigger/batch writes | Managed-service failure behavior |
| Expensive read harms customer DB | Indexed capped materialized sources, operation query cap, output/page bounds, fail closed | Actual D1 rows-read, latency, cost and representative scale |
| Unauthorized workflow dispatch deploys production | Default-off signed exact-source release adapters; protected environment and durable audit gate | Authorized staging validation of actual API contracts, protections and token scope |
| Secret or sensitive evidence is published | Added-content credential/email scan; synthetic fixtures; manual patch review | Owner public-disclosure decision and external scanner/CI |

The source review and local tests do not prove absence of vulnerabilities. Any
new runtime, migration, config, workflow or permission change invalidates the
corresponding reviewed manifest and requires a new exact-SHA review/check.
Local SQLite failure injection does not fully model distributed D1 concurrency.
