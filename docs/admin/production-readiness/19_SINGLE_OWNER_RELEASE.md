# Single-owner Admin release - 2026-10-18

Status: `ADMIN_SINGLE_OWNER_IMPLEMENTED_LIVE_ACCEPTANCE_PENDING`.
Canonical repository: `hello-tako/Takolio` (ID `1422954151`). This work starts at
main `571f3c229696d6bc766de89f552a36f48ca92e58` in an isolated checkout.
This document supersedes the staffing/quorum and obsolete publication blockers
in the historical 00-18 package. Its old receipts remain attributed to their
original source. Current verification is recorded in 20_CURRENT_VERIFICATION.md.

## Owner decision and security contract

The owner explicitly removed the requirement for three independent administrators
and two release custodians. One approved enrolled SUPER_ADMIN in the configured
Access issuer is sufficient. The requester may confirm their own expiring role
operation. The affected account cannot request or approve its own grant/revocation.
Normal operations must retain one usable owner; role, identity and operator status
transitions enforce this at the database boundary.

One rostered Ed25519 signature authorizes a release or a staging report/certificate.
Offline recovery accepts one enrolled owner key (existing two-key records remain
valid). These changes do not weaken existing main review/check requirements or
GitHub Environment approvals. Single-owner administration is not a recovery plan
for loss of both the Access identity and its signing key: keep the key under
owner custody with an independently usable backup and rehearse restoration.

Access issuer/subject enrollment, JWT verification, server-side RBAC, CSRF,
session revocation, append-only audit, tenant isolation and the internal-only
customer read facade remain required. Customer authentication, payment authority,
customer data/schema and customer release workflows are unchanged.

## Schema and first-owner enrollment

Apply the new Admin-only migration 0004 after immutable 0001-0003. It preserves
bootstrap, approval, recovery and audit history, updates schema_version to 4,
invalidates existing Admin sessions and rebuilds governance constraints. A populated
version-3 upgrade is covered by regression tests. Never roll a schema-4 database
back to a version-3 Worker; the runtime deliberately rejects mismatched schema.

The `enroll-owner` operation accepts only bounded userId, actual Access subject,
email, displayName and approvalRef. Its issuer and public key come from the trusted
release policy and validated signer. One `admin_owner_enrollments` insert writes
the approved operator, immutable identity binding and mandatory audit atomically.
It refuses any existing authority, replay or audit failure and grants no role.
A separate `bootstrap` operation grants the single enrolled owner and closes
bootstrap atomically. Synthetic local provisioning cannot enroll real identities.

Private Access subjects, emails, signing keys, authorization bundles and token
values must stay outside public Git and public comments. A public key and durable
nonsecret approval reference may enter the reviewed release policy. No real
operator identity or key has been fabricated or enrolled by this change.

## Fixed release sequence

1. Complete exact-head PR review and both required checks; merge through normal
   protection and wait for exact-main push CI/Admin CI.
2. Run `Admin Infrastructure Audit` on main. This workflow uses the existing
   protected staging credential for GET-only metadata. It exports only project
   resource identities and allowlisted bindings; missing scopes remain
   `PENDING_EXTERNAL_EVIDENCE`. It never reads database rows or secret values.
3. Provision distinct Admin D1/KV, an internal facade and a dedicated Access app
   and hostname per environment. Proposed hostnames are admin-staging.takolio.app
   and admin.takolio.app; verify availability before assigning them. Confirm the
   customer staging/production D1 identities and account-wide facade visibility.
4. Review actual targets in `admin/release-policy.json`, leaving execution off
   until ready. Create protected admin-staging/admin-production Environments
   using the existing production review policy (no admin bypass, protected main,
   self-review prevention). Keep the existing customer Environments unchanged.
5. Provision narrowly scoped Admin deployment and GitHub metadata-read secrets,
   the owner's public signing key and actual Access identity. Require one owner
   authorization bound to exact SHA, run ID, operation, policy/migration digests
   and at most one hour. Never expose private keys in Actions.
6. Execute `initialize-disabled` only when both Workers, DNS name and custom
   hostname are absent. It verifies dedicated resources/Access first, deploys
   the nonpublic facade and disabled Admin, then verifies identity and denial.
   A failed first install attempts narrow containment on an exact mapped target;
   it never reports PASS for a partial or unknown outcome.
7. Run `migrate`, provision matching facade HMAC plus Admin audit HMAC secrets,
   `enroll-owner`, then `bootstrap`, each with its own signed authorization and
   protected approval. No arbitrary SQL/command/endpoint input is accepted.
8. Run `deploy-disabled` as needed, recording a verified schema-4 disabled rollback
   baseline. `enable` requires the complete migration/schema manifest, bound DB
   identity, secrets, owner and bootstrap marker. Both Workers must match the
   expected source. Anonymous HTML/API/favicon must still redirect to the exact
   tenant Access login; any failure attempts the disabled baseline rollback.
9. Execute the actual staging matrix, owner login, role/audit/browser/isolation,
   representative load, recovery and paired rollback/containment. Package only
   completed evidence with the owner signature. Production checks the exact-SHA
   staging artifact ID/digest and its successful protected workflow run.
10. Production requires its own owner decision and configured Environment approval,
    then the same dedicated initialization/migration/enrollment/deployment sequence.
    Record versions, denial/authenticated smoke and customer health, then enable
    and observe. Keep emergency disable available independently of D1/facade health.

`initialize-disabled` refuses occupied Worker names, custom hostname or DNS record;
Admin destination names are restricted so the customer Worker cannot be selected.
Both Workers must have no extra public domain/zone route; the facade must also
have workers.dev/preview disabled. An initial install has no previous version;
its recovery is containment, followed by reviewed inspection and restoration.
No customer database rollback or authority-history deletion belongs in this lane.

## Offline owner signing

`scripts/admin-owner-sign.mjs` signs an already prepared manifest and immediately
validates it against its trust/context. It supports release, staging-report,
staging-certificate and recovery, accepts an existing owner key file, writes a
new private output file exclusively (0600), never creates a real owner identity
and never calls a network API. Example with local private files:

```sh
node scripts/admin-owner-sign.mjs release /private/release-manifest.json owner-key-id /private/owner-key.pem admin/release-policy.json /private/release-context.json /private/new-authorization.json
```

The context contains exact sourceSha, environment, operation, runId, runAttempt
and migrationDigest from the workflow plan. Upload the resulting authorization
through the protected secret channel; do not put it in workflow inputs or logs.
The run-bound authorization may be prepared while the Environment job waits for
its configured reviewer. An expired authorization needs a fresh ordinary dispatch.

## Remaining live evidence

| Requirement | Observed state / next evidence |
| --- | --- |
| Repository and main protections | Current canonical main has required validate/validate-admin, one approving review, stale dismissal, last-push approval and enforced admins |
| Current main hosted checks | Baseline Admin CI 39103823833 and CI 39103823819 succeeded; new candidate must get its own checks |
| Customer production | Existing customer domain release 39106394126 succeeded at baseline SHA; this is not Admin deployment evidence |
| Admin dedicated Environments | Not present at read-only inspection; must be created with reviewed protection |
| Admin Access application | None observed in the logged-in dashboard; dedicated allow policy and real owner subject remain pending |
| Admin D1/KV and credentials | No verified dedicated IDs yet; current local OAuth lacks D1/KV/zone permissions; protected metadata audit prepared |
| Staging ST01-ST20 | `PENDING_EXTERNAL_EVIDENCE`; no actual Admin staging deployment |
| Production Admin | `PENDING_EXTERNAL_EVIDENCE`; no Admin migration, enrollment, secrets change or deployment performed |

No local/CI result may clear a live-evidence row. The removed staffing quorum is
not a blocker; actual owner identity, infrastructure, release review and live
acceptance still are.
