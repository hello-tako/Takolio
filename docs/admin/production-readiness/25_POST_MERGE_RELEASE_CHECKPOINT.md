# Admin post-merge release checkpoint - 2026-10-18

Status: `ADMIN_COMMISSIONING_MERGED_ROTATED_CREDENTIALS_VERIFIED`.

Latest evidence is in the rotated-token checkpoint at the end of this document.
Activation proposal and remaining live gates are recorded in
`26_REVIEWED_ACTIVATION_PROPOSAL.md`. Earlier observations below retain their
original timestamps and do not override that checkpoint.

PR #16 was independently approved by vn-taphoanhatung at exact source
02661c67f97b78749b53498abfa5fb543ed5efde. Required CI 39125868119 and Admin CI
39125868139 both succeeded. Each passed 406 files / 9,045 tests, lint, types,
migration checks and build. Admin CI also passed its workerd and migration
matrix steps, browser regression 12/12 and keyboard repetition 10/10.

The normal protected squash merge completed at 2026-10-18T12:33:39Z as
61a34b74d749ef1d6dfe42e74df74d79cb67ff50. The reviewed Admin source tree matches
the merged source. Exact-main CI 39127790356 and Admin CI 39127790370 both
subsequently succeeded on 61a34b74; prior PR results are not substituted for them.

## Protected read-only audit

Staging credential audit 39127939910 succeeded after actual Environment approval
by vn-taphoanhatung. It ran on main 61a34b74 and observed all seven metadata
sections, including both dedicated Access apps, audiences, issuer and D1/KV
identities. The report states remoteMutations=false and readyForDeployment=false.
It confirms only customer Workers exist and neither Admin custom hostname is
attached. Artifact 12136509550 has archive digest
sha256:dbd64f4c447a931759207aedd5c7f28a8ef8313959c4c080abc20be16d21ab8d.
The sanitized report is retained in evidence/commissioning-20261018.

Production credential audit 39127977644 is a separate GET-only dispatch on the
same main SHA. It also succeeded after actual vn-taphoanhatung approval and
observed all seven sections at 2026-10-18T12:46:47.385Z. Artifact 12136599643 has
digest sha256:e21480f4225ae1e7f666bab82be7b6aa06eb678180bcd979f9c0b97777c9e0ef.
Both audit reports were checked against the policy, with no deployed Admin
Workers and readyForDeployment=false. CLI hello-tako cannot approve either Environment. The owner authorized
the agent to use an already authenticated reviewer browser session. The observed
staging approval was performed through the browser while the owner was active;
it is attributed to the actual GitHub reviewer, not claimed as an agent approval.
Attempts to control the separate production approval were interrupted by active
browser-window changes, and the extension channel reported unavailable auth.
Later GitHub readback confirmed the production approval and successful audit;
the agent does not claim to have performed that approval itself.

## Local verification of the merged source

- Clean exact-SHA offline initialize-disabled plan: expected refusal because
  release-policy enabled=false. Policy digest
  211f6ea103fd292c7e0eb542190f65200f3db1342451cda7d1eeee360ea4ae51;
  migration digest 13628da1687137e6abdc2bf4ff6b36f432658905ea8b3dfc1833eb45175ca1fe.
- Admin build PASS; existing font-resolution warnings remain, emitted fonts exist.
- Admin Wrangler bundle dry-run PASS; this uses disabled placeholder templates
  and performs no upload. It is not a live-target deployment certificate.
- Owner private key and local recovery copy retain 0600 files / 0700 directories
  and match the reviewed public fingerprint. Off-machine backup remains pending.
- Public customer production readiness returned HTTP 200, database=ok, status
  degraded with CONFIG_RECIPE_CATALOG_D1_AUTHORITY warning, commit 571f3c22.
  An initial Python HTTP attempt returned 403; the successful curl observation is
  separately attributed. Customer staging health redirects to Cloudflare Access
  and is not an authenticated readiness PASS.

## Pending release dependencies

1. Exact-main CI/Admin CI completion.
2. Rotate the existing Cloudflare release token before any live release write;
   its one-time value was previously exposed in a tool transcript. At checkpoint,
   GitHub secret metadata still had the original 11:43 UTC storage timestamps.
   Re-audit the new credential after rotation and storage.
3. GitHub secret metadata confirms ADMIN_RELEASE_GITHUB_READ_TOKEN was stored
   in staging at 12:39:49 UTC and production at 12:40:06 UTC. Secret contents and
   effective token permissions were not read; actual protected-use verification
   remains pending. This is not a claim that least-privilege scopes were audited.
4. An independently recoverable backup of the owner signing key and the actual
   verified Access subject. Neither is fabricated from email/dashboard user ID.
5. A separately reviewed activation policy, run-bound signed authorization and
   protected Environment approvals for each fixed operation.
6. Actual staging initialization, migration, HMAC provisioning, enrollment,
   bootstrap, disabled rollback baseline, enable and ST01-ST20, followed by its
   signed certificate before the production sequence.

No Admin Worker upload, migration, HMAC provisioning, enrollment, bootstrap,
console enablement or production release was performed. All unexecuted live
acceptance stays `PENDING_EXTERNAL_EVIDENCE`. Customer/payment runtime and release
configuration were not changed. This evidence-only branch is not release source.

## Rotated-token audit checkpoint - 2026-10-18 23:25 JST

The owner rotated `ADMIN_RELEASE_CLOUDFLARE_TOKEN` and updated both protected
Admin Environments. Fresh GET-only audits ran on exact main
`61a34b74d749ef1d6dfe42e74df74d79cb67ff50`:

- Staging run `39135545563` succeeded after `vn-taphoanhatung` approved
  `admin-staging`; artifact `12139143437`, digest
  `sha256:e17301fd8a36b2a9446a896e4f5b333ae86769ce540f806fd4d79c6ffe01a558`.
- Production run `39135545460` succeeded after `vn-taphoanhatung` approved
  `admin-production`; artifact `12139304681`, digest
  `sha256:55f2e782f7e23964734a4b3d5b1015b061e58b922d5ef7de2850b9420e1b3bd5`.

Each report has all seven metadata sections `OBSERVED`, `remoteMutations=false`
and `readyForDeployment=false`. The reports confirm the dedicated D1/KV pairs,
Access application IDs/audiences and issuer; only the existing customer Workers
are present, so no Admin Worker or Admin hostname was uploaded by these audits.
Sanitized copies are retained under `evidence/commissioning-20261018/rotated-token/`.

The owner reports a Drive backup for the signing key with matching truncated
fingerprint. This is recorded as owner-supplied evidence only; independent
restore, sharing scope and offline encryption have not been verified. The Access
App Launcher message is an optional portal configuration issue; it does not
prove direct application authentication and does not change the requirement for
an actual verified Access subject before enrollment.

Main still has reviewed policy flags `enabled=false`; this branch proposes
`enabled=true` for guarded release operations only. Runtime rendering remains
disabled, and the execution variable is absent. Actual owner Access subject,
independently recoverable key evidence and live staging ST01-ST20 remain pending.
No Admin Worker upload, D1 migration, enrollment, bootstrap, enablement or
production deployment has occurred.
