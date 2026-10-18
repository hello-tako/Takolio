# Admin activation proposal - 2026-10-18

Status: `REVIEW_REQUIRED_BEFORE_LIVE_WRITE`

This proposal is based on exact main `61a34b74d749ef1d6dfe42e74df74d79cb67ff50`.
It enables the release adapter's reviewed target validation for staging and
production by changing only `admin/release-policy.json` flags to `enabled=true`.
It does not upload a Worker, attach a hostname, create DNS, apply D1 migrations,
write HMAC secrets, enroll an owner, bootstrap a role or enable the console.
Rendered release configurations continue to set `ADMIN_CONSOLE_ENABLED=false` and
`ADMIN_AUTH_MODE=cloudflare_access`.

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
- Local verification matched all policy D1/KV/Access IDs, issuer and audiences;
  both Admin Worker names and custom domains are absent from the audit inventory.
- Owner Ed25519 public fingerprint matches the reviewed policy. Local recovery
  challenge passes; independent off-machine restoration is still pending.

## Required review and gate sequence

1. Review and merge this activation proposal through normal branch protection.
2. Wait for exact-main CI and Admin CI on the merge SHA.
3. Set `ADMIN_RELEASE_EXECUTION_ENABLED=true` only in the protected Admin
   Environments after the exact-main checks pass; leave customer Environments
   unchanged.
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

The Access App Launcher is optional. Its organization-disabled message does not
replace direct application authentication or provide an Access subject. The
owner must complete a direct authenticated Access flow after the staging
hostname is deployed; the verified issuer/subject is required for enrollment.
