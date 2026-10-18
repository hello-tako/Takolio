# Access preflight and domain deletion reconciliation

## Observed release and live state

Main `2dbe74bac990860cb44f96acc39877c471846df6` passed both required checks.
Staging release `39093031910` activated version
`5ce93d26-5500-474c-a396-f59f1ee01544`, deployment
`d50174ac-2259-4d89-a43c-2db22bd59246`. It proved the old URL and web hostname,
attached `api-staging.takolio.app`, then failed at preflight CORS verification.
Recovery recorded a DELETE intent for the API domain and stopped because its
response was not parseable as JSON. The raw HTTP status/body were not retained;
no particular empty-response status is claimed as observed.

Read-only reconciliation proves the exact recorded original account domain
inventory is restored, including pre-existing `staging.takolio.app`. The API
hostname is absent, and candidate traffic is still active. Hosted read-only
staging audit `39093604510` passed after the failure. Production infrastructure
audit `39093057999` was approved by `vn-taphoanhatung` and passed. Neither audit
is a production release or the separate production read-only certification.

## Causes and bounded changes

Cloudflare Access has no CORS response settings. An unauthenticated staging
OPTIONS probe returns HTTP 403. The Worker routing/CORS integration tests pass.
Cloudflare documents that Access blocks preflight by default and that its
configured preflight response is HTTP 200:
https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/

The prepared dashboard change allows only `https://staging.takolio.app`, with
credentials and explicit application methods/headers. OPTIONS bypass remains
OFF and the existing email/service policies remain intact. Saving awaits the
owner's action-time confirmation; this document does not claim it is saved.

The adapter accepts preflight HTTP 200 or 204 only with the exact approved
origin, credential flag and GET method. It additionally checks actual-response
CORS and denies browser access from production and an untrusted origin. The
production prerequisite verifier requires these additional proofs before
accepting an Access HTTP 200 staging receipt. Production's own preflight check
remains unchanged.

Both providers now share an acknowledgement parser. Empty HTTP 200/204 is valid
only for DELETE; POST/PUT still require a successful JSON acknowledgement.
Domain removal always requires independent exact full-inventory verification.
For a persisted DELETE intent whose response was lost, recovery can reconcile
absence only when the latest event names the exact created domain ID/hostname,
all other metadata is unchanged, the live traffic/operational fence passes, and
a second inventory read agrees. It never repeats that DELETE. Changed IDs,
owner, metadata, inventory, source/traffic fences or missing intent stop recovery.

## Validation and remaining gates

- Initial regression reproduced two missing detach-reconciliation behaviors.
- Final focused domain/Worker selection: 20 files, 252 tests PASS.
- Response/reconciliation/ownership selection: 5 files, 79 tests PASS.
- Full lint PASS with two existing generated-bundle warnings.
- Typecheck, customer/Admin migration smoke and Web/Admin/Worker build PASS.
- Build retains existing Admin font-path warnings.

No application, auth, payment, feature-flag, data, DNS or production code is
changed by this PR. No failed release receipt was rewritten. Hosted checks,
independent review, protected merge/exact-main CI, fresh staging release, all
nine real staging acceptance checks, fresh production certification and
independent production Environment approval remain required.
