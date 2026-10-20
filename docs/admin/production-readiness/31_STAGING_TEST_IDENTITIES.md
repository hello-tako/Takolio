## Admin live acceptance continuation - 2026-10-21 JST

The live evidence remains bound to exact source `c7417120f6226d3a52d25e900af5b82bb8f311b3`; no newer source has been deployed. The working tree contains a scoped responsive CSS fix and its local E2E evidence. The owner authenticated through the real Cloudflare Access staging application and completed a read-only smoke over the Admin surface. The owner acceptance harness recorded 26/26 PASS: 13 API reads returned HTTP 200 with `Cache-Control: no-store` and zero forbidden credential-field names, missing/wrong CSRF returned `403 ADMIN_CSRF_FAILED` without state change, self-grant and self-revoke returned `403 ADMIN_FORBIDDEN`, a preference round-trip succeeded and was restored, and the corresponding success/denial audit rows were present. A small read load of 12 requests at concurrency 3 returned 200; max and p95 latency were 6.307s, so this is a bounded smoke measurement rather than a capacity certification.

Authenticated static-boundary checks on the real host passed 10/10: canonical Admin asset served, encoded asset/traversal/unknown route/customer asset variants returned 404, and the responses remained no-store. Real-host axe coverage now includes overview, users, households, billing, AI, recipes, system, audit and settings with zero reported violations and no horizontal overflow. Private cookie metadata confirms the Admin session cookie is HttpOnly, Secure and SameSite=Strict; values remain private.

Local exact-source validation also passed: focused Admin tests 124/124, R2 auth/facade/race tests 19/19, workerd scenarios 10/10, migration matrix 25/25, lint exit 0 with two existing warnings in ignored generated bundles, and TypeScript typecheck passed. These results strengthen ST10, ST13, ST16 and ST18 evidence, but do not close the live foreign issuer/audience/expiry cases, separate unauthorized/no-role identity, authenticated hostile-origin test, internal facade negatives, live recovery/concurrency, or full customer/load/JWKS certification.

The staging Access policy remains owner-only after QA cleanup. Production Admin remains untouched; no all-PASS ST01-ST20 certificate exists, so no production execute dispatch is safe or permitted by the release adapter. Local synthetic Admin E2E now covers 10 screens at 320, 390, 820 and 1440px with zero axe violations and zero client-width overflow after a scoped responsive CSS fix; it is local evidence only.

## Cleanup record - 2026-10-21 JST

The five actual Access identities were revoked one at a time while the exact-source staging console was OFF. Protected runs and verification receipts:

| Alias | Revoke run | Result | Access session/device readback |
| --- | ---: | --- | --- |
| auditor | 39469415829 | PASS | 0 / 0 |
| content | 39470282640 | PASS | 0 / 0 |
| ops | 39470824179 | PASS | 0 / 0 |
| support | 39471359186 | PASS | 0 / 0 |
| unprivileged | 39472092782 | PASS | 0 / 0 |

The staging Access policy was saved with only the owner email; no QA alias remains in the Allow rule. Staging was then re-enabled owner-only by run `39473100906`, PASS. Historical enrollment, role and identity evidence is preserved outside Git; no password, OTP, JWT, cookie, private key or token value was committed.

The role matrix evidence is 60/60 actual API rows PASS. The auditor alias's later OTP re-login denial is retained as FAIL and must not be relabeled as a successful independent auditor login. Missing ST01-ST20 evidence remains a production blocker; fixtures and role reports do not substitute for foreign-token, concurrency/recovery, facade-negative, full responsive/JWKS and complete customer-regression evidence.

Production plan-only run `39474465306` PASS on the same source; execute SKIPPED. Artifact `12289305865` archive SHA256 `4ebd4aa375077af61d69fb35a555e3db3eaa1af5f98098427aaee308b726c319` was verified. JSON syntax, aggregate assertions, `git diff --check` and `python3 scripts/admin-public-scan.py` passed.

This checkpoint supersedes the historical checkpoints below.

---

# Staging QA identity commissioning

Status: `IMPLEMENTED_NOT_COMMISSIONED`. This is the lifecycle needed to replace
local fixture evidence with actual Access identity acceptance. It does not
certify staging or authorize a PASS without runtime results.

The signed `Admin Operator Ceremony` adds `enroll-staging-test` and
`revoke-staging-test`. Both reject production in offline validation and at the
durable database boundary. They preserve protected main, exact-source CI,
run-bound owner signatures, Environment approval, pre-action artifacts, exact
target/schema checks and console OFF. The first-owner ceremony is unchanged.

Migration 0005 adds an append-only QA ceremony ledger and atomic
enrollment/revocation triggers. The Worker schema contract stays at version 4;
the exact migration/trigger manifest still requires all five migrations. One verified owner-controlled
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

## Additive rollout and acceptance

Keep the Admin console OFF while applying migration 0005. It preserves the
version-4 Worker contract, existing authority/session/audit rows and view columns.
The release adapter requires the exact five-file migration and schema/trigger
manifest before QA operations. Record a disabled pair on the new exact source
before enablement and rehearse rollback/OFF again for certification. An older
release tool may reject the forward migration ledger even though its runtime
remains compatible; use the reviewed current release adapter for rollback.
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

## Policy save checkpoint - 2026-10-20

The five owner-controlled staging aliases were saved in the staging Access
policy after the owner confirmed the exact change. The production policy was not
modified. Real Access sign-in and subject capture remain separate steps; no
identity was invented from the alias strings.

## Containment-to-migration ordering

Emergency OFF deliberately removes the Admin data/service bindings. The
migration operation may verify that exact mapped contained target while the
console remains OFF, then apply only the signed Admin migration manifest.
It must verify the complete ledger/schema and authority identity afterward.
Migration must not redeploy or enable either Worker. Restore the verified
schema-4 disabled pair only after the fifth migration is present, then deploy
the new exact-source disabled pair. Ordinary deploy/enable/identity operations
must continue rejecting containment, and the restored pair must pass the normal
full-binding check. Retain all receipts, including a failed postcondition.
