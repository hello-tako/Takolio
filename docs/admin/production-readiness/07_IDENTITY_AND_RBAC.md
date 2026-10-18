# Identity, sessions and RBAC

> Historical schema-3/source-specific snapshot. Staffing, signing, release operations
> and current blockers are superseded by [19_SINGLE_OWNER_RELEASE.md](19_SINGLE_OWNER_RELEASE.md).
> Retained receipts are not current-source or live deployment evidence.

Runtime source: `9395f0e31ea599f1eb7780a8eba36964fed7c483`. Main baseline: `526596a8cd857984ad2b69901a8c7b0e9d6bccc2`.
Prepared by implementation owner `/root` (Codex); independent reviewer is
`/root/independent_admin_review`. Evidence environment: local macOS arm64,
Node v24.16.0, pnpm 10.33.2, Python 3.9.6, `TMPDIR=/private/tmp`.
Evidence timestamps are UTC. Commands, exit codes, log digests and limitations
are in `evidence/verification.json` and `12_REGRESSION_RESULTS.md`.
No live Cloudflare operation or operator approval is implied.

Access verification requires RS256 against configured team JWKS, exact issuer,
expected application audience, unexpired token, valid optional nbf/iat, a bounded
human subject and email claim. Service identity `common_name` is rejected.
JWKS cache TTL is ten minutes; unknown-key refresh is bounded to once a minute.
Foreign issuer, audience, signatures, missing/malformed assertions and subject
mismatches are denied. Approved IdP/application policy in the actual Access
tenant remains an operator configuration and staging acceptance requirement.

ADMIN_DB stores immutable user/operator/issuer/subject enrollment, independent
human approval references and a security epoch. Email is a consistency check and
label; it does not assign authority. Subject reassignment with the same email
cannot inherit a grant. Identity status/epoch and operator revocation invalidate
sessions. R1 sessions are revoked by migration 0002. Production readiness checks
require bootstrap completion and at least three eligible operators in the
configured issuer.

Sessions use a random opaque token with a stored hash, secure HttpOnly
SameSite=Strict host-only cookie, 8-hour absolute and 30-minute idle expiry.
CSRF is derived from the session and held in frontend memory. Mutations require
an exact configured Origin plus CSRF; customer-origin script is denied. Session
rotation/revocation, audit failures and secure headers are covered by local
security regressions and workerd checks. Live Access logout and revocation
semantics still require staging.

`src/shared/admin.ts` is the server/client permission authority; unknown roles or
permissions are denied. UI hiding never grants access.

| Role | Resources / sensitive actions |
| --- | --- |
| SUPER_ADMIN | All listed Admin permissions, subject to four-eyes and minimum-roster constraints |
| OPERATIONS_ADMIN | Overview, masked users/households, billing, AI, recipes read, system and audit |
| CONTENT_EDITOR | Overview, recipes read and editorial review notes |
| SUPPORT_AGENT | Overview, users/households and explicitly audited email reveal |
| READ_ONLY_AUDITOR | Overview, masked users/households, billing, AI, recipes, system, audit and role matrix |

All roles may view their own session and save preferences. Billing/PayOS and
subscription mutation are absent. Recipe publication is absent. Settings may
render for every role while server permission checks protect each operation.

Local password authority exists only in the loopback development configuration.
Production define is explicitly false and dry-run bundle checks verify that its
credential module is removed. No staging configuration or live deployment has
been certified. Synthetic in-memory preview and fixed local D1 fixtures may run
in CI under the local-only development/credential guard; real operator
provisioning still refuses CI.
