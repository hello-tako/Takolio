# Staging QA identity commissioning

Status: `IMPLEMENTED_NOT_COMMISSIONED`. This is the lifecycle needed to replace
local fixture evidence with actual Access identity acceptance. It does not
certify staging or authorize a PASS without runtime results.

The signed `Admin Operator Ceremony` adds `enroll-staging-test` and
`revoke-staging-test`. Both reject production in offline validation and at the
durable database boundary. They preserve protected main, exact-source CI,
run-bound owner signatures, Environment approval, pre-action artifacts, exact
target/schema checks and console OFF. The first-owner ceremony is unchanged.

Migration 0005 raises Admin schema version to 5, adds an append-only QA ceremony
ledger and atomic enrollment/revocation triggers. One verified owner-controlled
plus alias is bound to one actual Access issuer/subject; at most five may be
active. Enrollment grants no role, password, local credential or recovery key.
Ordinary role grants and the explicit SUPER_ADMIN confirmation still use the
existing Admin API. QA SUPER_ADMINs do not count as the durable owner for
last-owner guards or release readiness. These aliases represent one owner's
test accounts, not independent human approvers.

Revocation requires a matching enrolled QA identity, revokes all active roles,
revokes sessions through existing identity/operator triggers and writes its
success audit in the same statement. Any audit failure rolls the whole change
back. Ceremonies, bindings, roles and audit history are retained. Do not delete
or reactivate historical QA identities; use fresh alias suffixes for another run.

## Identity and Access setup

1. Review/merge this source normally; wait for both exact-main CIs. Preserve the
   existing source-specific staging results as historical evidence.
2. For the staging Access app only, allow exactly five owner-controlled aliases
   with suffixes `unprivileged`, `content`, `ops`, `support`, and `auditor` under
   `+takolio-qa-`. Keep the existing owner entry and 30-minute session. Never
   add a domain-wide Allow, Bypass, service-token substitute or production alias.
3. Check whether app-scoped One-time PIN is available. If a new authentication
   provider is required, assess its scope before enabling it. A Gmail alias
   requires no separate Gmail account or password. Each must still complete a
   real Access sign-in and yield a distinct signed subject. Do not invent the
   subject, reuse the owner subject or infer it from an email.
4. Keep the exact aliases, identity evidence and JWTs outside Git. Use the
   verified issuer/subject for each owner-signed payload. Creating the local
   fixtures does not complete this step. Browser policy requires action-time
   confirmation for expanding Access; account passwords stay owner-controlled.

## Signed payload and execution

The private payload has exactly `userId`, `operatorId`, `subject`, `email`,
`displayName`, and `approvalRef`. IDs must begin with `qa_`; aliases must use
`+takolio-qa-`; the database checks they belong to the actual enrolled owner
mailbox. The configured issuer and owner key cannot come from payload fields.

Use the normal signed release manifest (exact SHA, policy/migration digests,
run ID, one-hour maximum expiry), default execute OFF and the protected
`admin-staging` Environment. No arbitrary SQL, endpoint, password or role input
is accepted. Both operations require the Admin console OFF; record and verify
the version/flag before the ceremony. The workflow's receipt marks FAIL/UNKNOWN
if a postcondition fails.

## Schema-5 rollout and acceptance

Keep the Admin console OFF while migrating 4 to 5 and deploying both schema-5
Workers. A schema-4 Worker deliberately rejects a schema-5 database. Do not use
the historical schema-4 rollback as a schema-5 application rollback. Establish a
new disabled schema-5 pair before enablement; emergency OFF remains available.
Customer migrations, database and application release are outside this change.

After real enrollment, enable staging and prove the no-role account is denied.
Use owner API role grants for the other four aliases and verify both allowed
and forbidden API/screens for each role. Use a temporary reviewed grant to test
approval/revocation/recovery if required, with the real owner retained. Record
CSRF, origin, session-revocation, action/audit correspondence, credential-field
exclusion, real-host browser/axe and customer regression results on that exact
source. Local fixtures and signed synthetic JWTs cannot become live evidence.

Disable staging and execute a separately signed revocation per alias. Verify
all QA identities/operators and role assignments are revoked and no active QA
session remains. Remove the exact QA entries from staging Access and revoke
Access sessions; keep the owner's policy. Re-enable only after verified cleanup.
Failure or missing identity evidence remains `PENDING_EXTERNAL_EVIDENCE` and
prevents signing an all-PASS ST01-ST20 certificate or production deployment.

## Verification record

Local result details are in the latest checkpoint in
`30_STAGING_LIVE_ACCEPTANCE_20261020.md`. The new test cases cover signed staging
scope, production rejection, run/SHA binding, alias ownership, duplicate/replay,
active limit, audit failure atomicity, session/role cleanup and last-owner
protection. They do not prove live Access identities have been created.
