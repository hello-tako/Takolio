# Admin infrastructure commissioning - 2026-10-18

Status: `ADMIN_IMPLEMENTATION_MERGED_INFRASTRUCTURE_PARTIAL`.
PR #15 was approved by vn-taphoanhatung on head
89349b4c588a65409abe40b26856c059c8d2bd33 and merged through main protection at
2026-10-18T10:58:29Z as 8217f0bdbd9c7defe7751c3c8a6b2982ceb2b079.
Both required PR checks and both exact-main push checks succeeded. These results
certify the merged implementation; the later commissioning policy branch needs
its own review and checks before merge or release.

## Verification attribution

| Source / run | Actual result |
| --- | --- |
| PR Admin CI 39119851603 | PASS; 405 files / 9,043 tests, lint, typecheck, build, migration smoke; workerd 10/10, migration matrix 25/25, browser 12/12, keyboard 10/10 |
| PR CI 39119851618 | PASS; 405 files / 9,043 tests, lint, typecheck, migration smoke and build |
| Local whole-project attempt | 404 files passed / 1 failed; 9,042 tests passed / 1 failed; existing staging-d1-catchup Wrangler case timed out at unchanged 5,000ms limit |
| Local targeted follow-up | File staging-d1-catchup-check.test.mjs passed 32/32, duration 5.32s; the original full-run failure remains recorded |
| Commissioning credential/configuration check | 4 files / 92 tests PASS: credential-audit workflow, infrastructure audit, release adapter and admin-config |
| Main Admin CI 39121353870 | PASS at 8217f0bd; 405 files / 9,043 tests, lint/types/build/migrations, workerd 10/10, migration matrix 25/25, browser 12/12, keyboard 10/10 |
| Main CI 39121353814 | PASS at 8217f0bd; 405 files / 9,043 tests, lint/types/build/migrations |
| Admin Infrastructure Audit 39121388586 | Workflow SUCCESS; metadata observation before production D1/KV; readyForDeployment=false |
| Admin Infrastructure Audit 39122015225 | Workflow SUCCESS at 8217f0bd; both Admin D1/KV pairs observed; readyForDeployment=false |

Admin PR artifact 12133859026 is named for GitHub's temporary PR merge commit
ea81844ee101560ce54684c60fd1697fc8a9a1b1. Its archive digest is
sha256:17c49a5a8cb32bdcdbb394f64bc72d21abbf410a33edb9b75270483075957a4d.
Do not relabel it as a push-CI artifact for 8217f0bd. The main Admin artifact
12134718940 is named admin-evidence-8217f0bdbd9c7defe7751c3c8a6b2982ceb2b079
and has digest sha256:4ef11da23d5ebd8fa934d231e0c402765ca90f59c4c3ac3c560679717bccc9b0.
Its offline preflight reports cleanCheckout=false solely for an untracked
scripts/__pycache__/ directory. This is not a clean-checkout release receipt.
The Workerd and SQL matrix artifacts bind their source to 8217f0bd and PASS.

Infrastructure artifact 12134068942 has digest
sha256:33d539e58ba45e4a2b8191a20a898bb42fb1a0ff63f671116a11ea4e62860c18.
The follow-up artifact 12134726105 has digest
sha256:0c4386cdbcf9f8a8dd12fe62b605161d948ff6eefa0c890d0f4cabbffb9b3639.
Both sanitized audit observations and main verification attribution are retained
in evidence/commissioning-20261018.

## Provisioned and observed resources

Account ef250a88911fd24073cb73d1c07e0218; zone takolio.app /
9284fb2186987f14f810818583acaa46. The owner chose the current logged-in
Cloudflare email as the sole owner; the actual address and Access subject are
kept outside public Git.

| Target | Resource identity | Evidence |
| --- | --- | --- |
| Staging Admin D1 | takosan-admin-staging-db / 8027713e-c08b-4b32-8413-963f0d9d1877 | Created in dashboard; observed again by GET-only audit |
| Staging Admin KV | takosan-admin-staging-cache / f3416a5f66c446e8945f6ec25c037271 | Created in dashboard; observed again by GET-only audit |
| Staging Access app | Takolio Admin Staging / fccffa25-a7ca-40ba-b878-b149c7418064 | Created after explicit owner confirmation; dashboard readback |
| Staging Access policy | d6b3bcdb-788f-47a9-95c0-1960f14af4a4 | Exact owner email, Allow action, no bypass, one rule |
| Staging Access hostname | admin-staging.takolio.app | App destination readback; no Worker/custom-domain/DNS attachment yet |
| Staging Access audience | fed43dc973208d1b12fdcc0c6df838743ea450b59ace3842b665126a8673a9ce | App Additional settings readback |
| Production Admin D1 | takosan-admin-db / 757b3b48-f8d5-4caa-9528-3927226fd71b | Created in dashboard; observed by audit 39122015225 |
| Production Admin KV | takosan-admin-cache / a2054ef3166b484086aed1c5df02d821 | Created in dashboard; observed by audit 39122015225 |
| Production Access app | Takolio Admin Production / 12a242e6-d60a-4e07-97a5-1f77c34d7db1 | Dashboard readback; owner explicitly confirmed retention and cookie protection |
| Production Access policy | 1d51af88-00a8-48fa-850b-58d433a94ff3 | Exact owner email, Allow action, no bypass, one rule |
| Production Access hostname | admin.takolio.app | App destination readback; no Worker/custom-domain attachment yet |
| Production Access audience | b35d4e11be7103bf19479504628c18ea3c7eb9f550675d56b9ff90546fdbea51 | App Additional settings readback |
| Access issuer | https://little-bar-8ffa.cloudflareaccess.com | Read from account Access settings |
| Customer staging D1 | frigo-db-staging-v3 / 7854298a-20f5-46aa-9cbf-917079c2a3dd | Live customer binding observed by audit |
| Customer production D1 | frigo-db / f975ec39-b2c8-4a2a-80e1-0366054599d3 | Live customer binding observed by audit |

Both dedicated Access sessions are 30 minutes. Staging HttpOnly and binding
cookies were enabled and saved. Production Create was mistakenly clicked before
the pending action-time confirmation arrived; this was disclosed immediately.
The owner then explicitly confirmed creating/retaining the app and continuing
cookie protection. Production HttpOnly/binding were switched on, saved, and
read back as ON after reloading the persisted settings.
No OTP was sent and no owner identity has been enrolled or bootstrapped.
The existing customer Access apps and runtime were not changed.

## Protected Admin Environments

Created admin-staging (24626387050) and admin-production (24626387635), then read
back the API responses: required reviewer vn-taphoanhatung; prevent_self_review=true;
can_admins_bypass=false; protected_branches=true; custom_branch_policies=false.
No customer Environment was edited. Admin release execution remains off and
there are no verified Admin deployment credentials in these Environments yet.

The new Admin Credential Audit workflow permits only a manual main dispatch
selecting admin-staging or admin-production, uses that protected Environment's
ADMIN_RELEASE_CLOUDFLARE_TOKEN and runs the fixed GET-only metadata script.
It never falls back to the customer staging credential and has no mutation step.
Its two focused workflow contract tests and the existing four metadata safety
cases PASS. The workflow is prepared, not yet merged or executed.

## Audit visibility caveat

Both historical audits report accessOrganization as PENDING_EXTERNAL_EVIDENCE
(HTTP 403). Their filtered accessApplications result is empty despite the staging
app being visible in the dashboard. The follow-up audit predates creation of the
production Access app. Treat the staging discrepancy as unresolved credential
visibility/API contract evidence, not proof that the app is absent. A new Admin
credential must successfully read each exact app ID, audience, organization and
full required inventories before any deploy. Audit workflow SUCCESS only means
the sanitized observation was saved; it does not clear missing evidence.

## Remaining execution requirements

See 22_CREDENTIAL_HANDOFF.md for the exact minimum permissions, token scopes and
protected secret names. Account-wide zone/route read visibility is required to
prove the facade has no other public exposure. Custom-domain writes use Workers
Scripts Write; no all-zone DNS or route write permission is requested.

The owner must retain an Ed25519 private signing key and a recoverable backup;
only its public key and approval reference enter the policy. Obtain the actual
Access subject from a verified owner identity. Do not substitute an email, a
Cloudflare dashboard user ID, a synthetic subject or an agent-made human identity.
Run-bound authorization is signed offline for each operation after its plan.

Policy records only observed nonsecret targets, keeps enabled=false and has no
rostered signing key. Actual staging remains PENDING_EXTERNAL_EVIDENCE until
initialize-disabled, Admin-only migration, private HMAC provisioning, actual owner
enrollment/bootstrap, disabled baseline, enable, browser/isolation tests and
paired recovery all complete. All ST01-ST20 are still pending; no signature or CI
result invents a live PASS. Production requires the completed staging certificate
and its own protected release approval. No Admin Worker upload, Admin migration,
secret provisioning, owner enrollment or console enable has occurred here.

## Dedicated credential update - 2026-10-18 11:44 UTC

Supersedes the earlier absent-credential and unresolved Access-visibility notes:
ADMIN_RELEASE_CLOUDFLARE_TOKEN is now stored and metadata-verified in both
protected Admin Environments. A GET-only local audit using the new token observed
all seven sections and matched both exact Access app identities/audiences plus
the issuer. See 23_CREDENTIAL_STORAGE_RECEIPT.md and its sanitized report. Release
execution remains disabled; the local audit does not certify deployment readiness.
