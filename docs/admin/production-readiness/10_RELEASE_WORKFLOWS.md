# Release workflows

The exact tested/reviewed source is identified in `12_REGRESSION_RESULTS.md` and
`13_INDEPENDENT_REVIEW.md`. Live execution remains disabled in both environments
in `admin/release-policy.json`. No real resource IDs, keys or credentials were
read or populated. No workflow was dispatched by this task.

Admin CI runs full regression, lint/typecheck/build, migration smoke/matrix,
real local multi-Worker workerd and binding-free containment, browser/keyboard,
configuration and public-content scans. Required hosted `validate-admin` must
succeed on the exact reviewed main SHA. GitHub account suspension prevents
current hosted/protection verification; earlier CI is not reused.

Five manual workflows are prepared: staging release, production release, Admin
migration, bootstrap/recovery, and emergency disable. Customer workflows and
customer migration ledger remain unchanged. External actions are pinned to
immutable commits. Workflow permissions are contents:read/actions:read; the
operator-provisioned GitHub read token must support the required protection,
environment and run metadata. Cloudflare credentials enter only the mutation
step after a durable immutable pre-action artifact is uploaded.

## Signed authorization and fixed operations

`admin-release-adapter.mjs` requires a clean exact-SHA checkout, exact reviewed
main and matching workflow source, protected branch/reviews/checks, successful
exact-source push CI, an ordinary first-attempt manual human dispatch, protected
environment with independent approval/self-review prevention/no admin bypass,
and two distinct rostered Ed25519 custodian signatures. The signed manifest
binds source, operation, environment, run ID, policy/migration digests and expiry
(maximum one hour). Reruns, stale approvals, payload extras and arbitrary SQL or
network/command destinations are rejected. A signed run plus exclusive local
execution lock protects against ordinary replay. Every write rechecks authorization
expiry and GitHub facts. Audit artifact ID/run/SHA/digest must match the pinned
upload action output; its bare hash is normalized to the API `sha256:` form.

Allowed operations are deploy-disabled, migrate, bootstrap, recover, disable and
rollback-disabled. There is no enable operation. An authorized bootstrap/recovery
requires current live enrolled operators/keys and the existing atomic database
audit contract. No customer database SQL or billing mutation path exists.

The provider verifies exact account, Admin/facade Worker, custom hostname mapping,
zone, Access issuer/audience, dedicated Admin/customer D1 and KV identities. It
checks all account zones (paginated) and their routes, account custom domains,
workers.dev and preview exposure for the facade. Domains and zone routes use
their single-page API contract; explicit truncation is rejected. Zone/KV
inventory is paginated. Tokens must have complete account-wide read visibility;
a scoped token cannot establish absence of resources it cannot see.

Migration file digests, ledger prefix, schema/trigger manifest, schema version,
integrity and immutable database identity are verified. Only the Admin migration
directory is applied. Deployment uses only generated disabled configs, verifies
real API `/api/v1/admin/me`, protected favicon and emitted JS, and checks exact
release metadata. Smoke accepts a marked no-store disabled body or redirect to
the exact tenant Access login path; generic 404/403 responses fail. A verified
compatible disabled baseline is required before ordinary replacement. Partial
failure attempts compensating rollback and records UNKNOWN if the outcome
cannot be established; a failed action never emits PASS.

## Independent emergency containment

`admin-emergency-disable.yml` has a separate concurrency lane and no dependency
on normal release/migration jobs or frontend builds. The signed disable action
retains exact source/target/environment/approval/audit checks, but does not require
staging certification, D1 ledger/identity, facade health, runtime secrets, or a
rollback baseline. Its migration manifest is the digest of an empty array.

It replaces only the exact Admin target with `admin-shutdown-worker.mjs`, an
import-free Worker denying every method/path without D1/KV/service/assets/auth
bindings. Wrangler retains existing opaque secrets; shutdown neither reads their
values nor depends on them. Postcheck permits opaque secret_text metadata while
rejecting data/service/asset capabilities. It checks only the Admin version,
exact target mapping and denial smoke. Deployment failure preserves an UNKNOWN
receipt for operator inspection and never attempts to restore an enabled console.
The independent lane avoids waiting behind a migration. Every prepared release
path also deploys only disabled Admin, so it cannot enable the console after
containment. No propagation-time or live race claim is made.

After containment, use the separately signed `rollback-disabled` action with
exact certified schema-3-compatible Admin/facade version IDs and previous SHA.
Only this restore path accepts the marker/no-capability shutdown state in place
of existing Admin bindings. It retains full live D1 identity/schema, facade,
Access and safe-version/ancestry/CI checks, then restores both disabled versions.
A failed restore compensates back to the minimal shutdown configuration. No
initial resource provisioning or automatic bootstrap of a rollback baseline is
implemented; those are separately reviewed operator prerequisites.

## Staging report and production certificate

The staging workflow has a separate opt-in protected `certify` job. It consumes
`ADMIN_STAGING_REPORT`, validates two production-custodian signatures over a
completed exact-source report, and uploads the immutable
`admin-staging-certification-{runId}` artifact. It has no Cloudflare credential.
The report includes version, sourceSha, policyDigest, stagingDatabaseId,
completedAt/expiresAt, independentReviewDigest and all twenty ST checks set PASS.
Nothing in this job runs, invents or promotes incomplete staging results.
Operators must attach the real command/target/time/result evidence and obtain
independent review before signing. Report validity is at most seven days.

After upload, the separate production certificate signs those same report fields
plus the resulting artifactId/artifactDigest. This avoids a circular self-digest.
Production operations other than disable require this certificate and verify
the artifact digest, exact name, source, successful first-attempt manual main
run, repository and dedicated staging workflow. Missing, stale, partial,
wrong-source or unrelated-workflow evidence blocks production. No report or
certificate was generated for real staging by this task.

## Live prerequisites and limits

Authorized staging must validate actual Cloudflare/GitHub response schemas,
complete token scope, protection rules, target identities, secret custody,
first compatible baseline, rollback, containment propagation and all ST01-ST20.
GitHub REST `can_admins_bypass` availability remains a live schema prerequisite;
missing values fail closed. Operator identity independence and human approval
are external requirements. Local fixtures and signed-attestation packaging do
not certify those facts. Production remains blocked until all independent and
real staging gates are met, then requires separate owner authorization.
