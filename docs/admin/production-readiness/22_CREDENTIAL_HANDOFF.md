# Admin credential handoff - 2026-10-18

The Admin release path is deliberately still disabled. The owner must create and
store credentials through the Cloudflare/GitHub protected UI; no token or private
key belongs in this workspace or chat. The custom-token form is open with name
and account selected; no credential has been generated.

## Cloudflare release token

Create a custom token named `Takolio Admin Release 2026-10-18` with a 30-day
expiry, scoped to account `ef250a88911fd24073cb73d1c07e0218`.

Required account permissions:

- Workers Scripts: Edit (API permission name: Workers Scripts Write)
- D1: Edit
- Workers KV Storage: Read
- Account Settings: Read
- Access: Apps and Policies: Read (or separate Access Apps and Access Policies Read groups in the current UI)
- Access: Organizations, Identity Providers, and Groups: Read (or Access Organizations Read in the current UI)

The provider verifies that both Workers have no zone routes on every account
zone. The token therefore needs Zone: Read and Workers Routes: Read for all zones
in this account, plus DNS: Read for takolio.app. Read visibility must include all
account zones; a one-zone-filtered list cannot certify account-wide absence.
The dashboard may combine selected zone permissions under a common resource
scope. If it cannot separate DNS scope, read-only DNS visibility across this
account's zones is acceptable; do not add any zone write permission.

No Workers Routes Edit or DNS Edit is requested. The Admin config uses only
custom domains; the official Workers Domains Update API accepts Workers Scripts
Write. Validate the pinned Wrangler upload against actual token permissions;
if the provider requires an additional scope, stop for a reviewed narrow change.
Reference: https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/update/

Do not grant payment, email, queues, R2, AI, memberships, user management,
Global API Key, or all-zones write access. Account-level Worker/D1 edit remains
powerful: retain the fixed Admin-only adapter, signed exact-source authorization
and protected Environment approvals for all writes.

Save the token as the `ADMIN_RELEASE_CLOUDFLARE_TOKEN` secret in both protected
GitHub Environments `admin-staging` and `admin-production`, only after verifying
the name, expiry and scopes in the Cloudflare token summary. Do not paste it into
chat, terminal output, Git, workflow inputs or public comments.

## GitHub metadata token

Create a fine-grained GitHub token limited to repository `hello-tako/Takolio`,
with `Metadata: Read`, `Administration: Read`, `Actions: Read`, and `Contents:
Read`, expiring in about 30 days. Save it as
`ADMIN_RELEASE_GITHUB_READ_TOKEN` in both protected Admin Environments. Never
place it in a workflow variable or repository file.

## Owner signing key and actual identity

Generate an Ed25519 key pair offline under owner custody, keep the private key
and an independently recoverable backup offline, and provide only the public key
plus a durable approval reference for the reviewed policy. The private key is
never uploaded to GitHub, Cloudflare, chat or this checkout.

Actual enrollment also requires the verified Access issuer/subject. Do not use
the Cloudflare dashboard user ID, the owner's email as a fabricated subject, or
a synthetic identity. No live OTP has been sent by this task. An authenticated
owner flow or owner-supplied verified identity evidence is still required.

## Resume sequence

Use the new credential for a GET-only infrastructure verification before any
mutation. It must read the exact staging/production Access app IDs, audiences,
Access organization and full account inventories. The historical audit runs use
the existing customer staging credential and do not certify the new token.

Review the public owner key and target policy through a new PR, then wait for
its exact-main CI/Admin CI. Policy `enabled=true` permits guarded release
operations; it does not turn the console on. A separately configured
`ADMIN_RELEASE_EXECUTION_ENABLED=true` and run-bound owner authorization are
required before initialization/migration, and each protected job still needs
the configured reviewer. Console runtime stays disabled until a later explicit
`enable` operation passes all prerequisites.

Complete staging initialization, Admin-only migration, HMAC provisioning, actual
owner enrollment/bootstrap, disabled rollback baseline, enable and ST01-ST20.
Only completed signed staging evidence can authorize the production sequence.

## Storage checkpoint - 2026-10-18 11:44 UTC

The introduction's uncreated-token state is historical. The owner has now created
the Cloudflare token and authorized storage. It is active, expires
2026-11-18T14:59:59Z, and ADMIN_RELEASE_CLOUDFLARE_TOKEN is stored in both
admin-staging and admin-production. Metadata readback and a GET-only local audit
passed; see 23_CREDENTIAL_STORAGE_RECEIPT.md. The GitHub metadata token and owner
signing/identity requirements above remain pending. No release was dispatched.
