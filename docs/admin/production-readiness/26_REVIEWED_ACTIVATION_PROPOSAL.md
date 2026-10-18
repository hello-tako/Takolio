# Admin activation proposal - 2026-10-18

Status: `REVIEW_REQUIRED_BEFORE_LIVE_WRITE`

This proposal is based on exact main `61a34b74d749ef1d6dfe42e74df74d79cb67ff50`.
It enables the release adapter's reviewed target validation for staging and
production by changing only `admin/release-policy.json` flags to `enabled=true`.
It does not upload a Worker, attach a hostname, create DNS, apply D1 migrations,
write HMAC secrets, enroll an owner, bootstrap a role or enable the console.
Rendered release configurations continue to set `ADMIN_CONSOLE_ENABLED=false` and
`ADMIN_AUTH_MODE=cloudflare_access`.

Both policy targets are enabled in the same reviewed candidate so staging and
production share one immutable policy digest for the exact-source certificate.
Production still requires that certificate, its own run-bound owner signature
and the protected Environment approval before every operation. Proposed policy
digest: `a2314d5ab8effacc66f307c130ed1268f92e6f93a467a520a92cb94a01bcc1cf`.

## Evidence used

- Main CI `39127790356` and Admin CI `39127790370`: SUCCESS on exact main.
- Rotated-token staging audit `39135545563`: SUCCESS; artifact
  `12139143437`; digest
  `sha256:e17301fd8a36b2a9446a896e4f5b333ae86769ce540f806fd4d79c6ffe01a558`.
- Rotated-token production audit `39135545460`: SUCCESS; artifact
  `12139304681`; digest
  `sha256:55f2e782f7e23964734a4b3d5b1015b061e58b922d5ef7de2850b9420e1b3bd5`.
- Both audits were approved by `vn-taphoanhatung`, observed all seven sections,
  and reported `remoteMutations=false` and `readyForDeployment=false`.
- Downloaded artifact ZIP SHA-256 digests matched the GitHub artifact metadata.
  Local verification matched all policy D1/KV/Access IDs, issuer and audiences;
  both Admin Worker names and custom domains are absent from the audit inventory.
- Owner Ed25519 public fingerprint matches the reviewed policy. Local recovery
  challenge passes; independent off-machine restoration is still pending.

## Required review and gate sequence

1. Review and merge this activation proposal through normal branch protection.
2. Wait for exact-main CI and Admin CI on the merge SHA.
3. Set the repository configuration variable `ADMIN_RELEASE_EXECUTION_ENABLED`
   to `true` only after the exact-main checks pass. The Admin workflows read this
   gate in job-level `if` conditions, before environment-level variables become
   available. An environment-only variable cannot open this job gate. This name
   is consumed only by Admin workflows; credentials and signatures remain in the
   dedicated protected Admin Environments. Leave customer settings unchanged.
4. For each operation, dispatch the fixed workflow on exact main, create a
   one-hour owner-signed authorization bound to the returned run ID, and approve
   the configured Environment with `vn-taphoanhatung`.
5. Execute staging in this order: `initialize-disabled`, `migrate`, provision
   operator HMAC secrets through the protected path, `enroll-owner`, `bootstrap`,
   `deploy-disabled`, `enable`, then the real ST01-ST20 matrix.
6. Package a signed staging certificate with the exact source SHA, artifact ID
   and digest. A single failed or unverified ST row blocks production.
7. Run the same fixed sequence for production only after the staging certificate
   is accepted by the production workflow.

## Access identity and owner backup

The Access App Launcher is optional. Its organization-disabled message does not
replace direct application authentication or provide an Access subject. The
owner must complete a direct authenticated Access flow after the staging
hostname is deployed; the verified issuer/subject is required for enrollment.
The existing `initialize-disabled` operation needs no enrolled identity: it can
establish the protected hostname before the owner authenticates. Do not invent
an issuer/subject or enable the console to work around this ordering.

Use the direct `https://admin-staging.takolio.app/admin/` URL after initialization.
The owner completes the existing IdP/OTP flow. Verify the issued JWT signature,
issuer, audience and expiry before retaining only its enrollment claims in a
private local file. Do not paste the cookie, JWT, owner email or subject into
chat, public artifacts or Git. Production uses its own direct hostname/audience.

The owner reports a separate Drive copy with matching fingerprint. No private
key or Drive URL is published here. Drive sharing/encryption and restoration
from that independent copy remain `PENDING_EXTERNAL_EVIDENCE`; the successful
local recovery challenge certifies only the local copy. Complete the independent
restore rehearsal before signing the live staging recovery acceptance.

References:

- https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/app-launcher/
  documents default-disabled App Launcher and direct app access independently.
- https://docs.github.com/en/actions/reference/variables-reference
  documents the timing of environment-level variables.

## Local validation

- Focused adapter/provider/credential-audit/infrastructure/config: 5 files / 158 tests PASS.
- Admin production build PASS; pre-existing font-resolution warnings remain and
  all three emitted font files exist.
- Whole-repository ESLint PASS with one warning in a pre-existing ignored
  generated bundle; both TypeScript checks PASS.
- Both clean-candidate offline plans validate their target identities and report
  `remoteExecuted=false`, `readyForDeployment=false`.
- Offline customer-isolation/configuration preflight PASS; public added-text
  secret/PII scan PASS; `git diff --check` PASS.
- An initial scan command used the wrong `.mjs` extension and did not run;
  the actual `python3 scripts/admin-public-scan.py` subsequently passed.

Hosted CI and independent review must certify the final PR HEAD, then the merge
SHA. No local check replaces actual staging acceptance or release approval.
