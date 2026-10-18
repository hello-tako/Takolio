# Protected initial Admin HMAC provisioning

Status: `IMPLEMENTED_OFFLINE_LIVE_ACCEPTANCE_PENDING`.

The fixed release sequence required matching Admin/Facade HMAC keys and an audit
HMAC but previously delegated provisioning to an unspecified operator step.
`provision-hmac` now uses the existing protected Admin Operator Ceremony workflow
and signed release adapter. No secret value, Worker name or provider endpoint is
accepted as an input; its signed payload must be empty.

## Preconditions and writes

The normal exact-main CI, policy, run-bound owner signature, one-hour expiry,
protected Environment approval and immutable pre-action artifact are required.
Production additionally requires the exact-source signed staging certificate.
The adapter verifies schema-4 migration ledger and database identity first.

The provider verifies the dedicated Admin/Facade mapping and disabled Access-only
console, then queries only Admin D1 for authority/session/audit history. It refuses
any operator, identity, enrollment, role, local credential, session, audit event,
bootstrap, recovery, approval, bootstrap marker or fixture marker. All release
operations for an environment share one concurrency lane.

The runner generates two independent 256-bit values using Node's CSPRNG. It puts
one matching `ADMIN_FACADE_HMAC_SECRET` into the mapped facade and Admin Workers,
and the independent `ADMIN_AUDIT_HMAC_SECRET` into Admin only, using the fixed
Cloudflare Workers secret API. No customer Worker or customer D1 is written.
Before each PUT it rechecks the release authorization/approval/artifact, live
mapping, disabled console and unused authority. Values are never written to
local files, artifacts or command arguments and are not logged; provider response
bodies remain suppressed. Postchecks verify secret binding names/types, resource
mapping and disabled state without reading secret values back.

## Retry and failure behavior

A failed PUT stops the operation; the existing adapter writes a FAIL / UNKNOWN
receipt requiring inspection and never enables the console. It does not remove
secrets or retry writes silently. Before any authority/session/audit history
exists, a fresh ordinary dispatch with a new run-bound signature may replace
partial initial keys as one set. Once any such history exists this operation is
blocked, including after owner enrollment. Rotation of an operational audit HMAC
requires a separate reviewed procedure and is outside this operation.

## Execution order

After the final reviewed candidate is merged and exact-main checks pass:

1. `initialize-disabled` via Admin Staging Release.
2. `migrate` via Admin D1 Migrate.
3. `provision-hmac` via Admin Operator Ceremony, empty signed payload.
4. Owner authenticates through the direct staging hostname; verify the real
   Access issuer/subject/audience/expiry and retain claims privately.
5. `enroll-owner`, `bootstrap`, `deploy-disabled`, `enable`, actual ST01-ST20.
6. Signed exact-source staging certification before the production sequence.

Each operation needs its own signature and configured Environment approval.
Neither the policy activation nor provisioning certifies a live ST row. No real
HMAC or Admin mutation was performed during implementation.

## Validation

The focused release/provider/config/infrastructure/credential suite passes,
including guards for wrong targets, public facade, enabled console, missing
independent approval/artifact, foreign workflow, nonempty/invalid authority,
concurrent authority appearance, secret-body suppression and partial failure.
A real in-memory SQLite schema-4 check verifies the fixed query accepts an empty
authority and rejects an existing audit row. Tests use only offline fixtures.
Exact-source hosted checks and independent review are required before merge.
