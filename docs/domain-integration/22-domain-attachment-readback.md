# Worker domain attachment read-back

## Live failure and reconciliation

Main `ff3b78a653cc3adaca333ebe637ef44374074a55` passed CI 39083922483
and Admin CI 39083922411 (399 files / 8,931 tests each). The owner confirmed
account-level Workers Scripts Edit on the existing staging token. Its scope
change was saved without changing expiry or other grants.

Read-only audit 39088470405 initially failed with Cloudflare HTTP 500 / code 10500
on the active Worker version GET. Attempt 2 succeeded against the same version.
No cause beyond a transient provider read failure is asserted.

Staging release 39088644278 activated version
`5f7a12fb-b4ab-4a51-918a-21720d07c21f`, deployment
`ae070c36-5ae4-411d-ab7e-2608e5724144`, and proved the legacy HTTPS
readiness/assets/source/recipe authority. The first hostname PUT succeeded but
its metadata failed the response check. The retained receipt remains ambiguous;
no automatic retry or rollback was performed.

Fresh audit 39088800033 passed. It independently proves the same candidate at
100%, unchanged operations/bindings and all 43 migrations. It finds one custom
domain, `staging.takolio.app` (ID `5556df933b1ab7756f71ea0e34f349312f2cac45`),
one proxied AAAA record and zero routes. The API staging host is not attached.
A supplementary existing-credential diagnostic was stopped by HTTP 403 before
mutation; it is not a successful attachment or a release result.

After reconciling the exact domain ID, full unrelated-domain commitments and
active deployment through read-only API reads, a bounded operator diagnostic
reaffirmed the identical existing hostname/Worker/zone/routing settings. Its PUT
returned `environment: ""`; GET returned `environment: "production"` for the
same ID. All other projected fields and the full account inventory were equal
before and after. This diagnostic did not create another hostname or alter
routing settings. The earlier failed release did not retain its raw PUT payload,
so the direct observation is explicitly a separate operation.

See `evidence/staging-domain-response-observation.json`. The Cloudflare API schema
marks environment deprecated/read-only; the current live inventory consistently
uses production for the direct script `frigo-staging`.

## Change

The shared hostname primitive accepts only empty or production environment in an
otherwise complete valid PUT response. ID, hostname, service, zone, enabled and
preview settings remain mandatory and strict. It persists the acknowledged ID
before another request. It then reads the complete account inventory and requires
the exact same domain, production environment and all routing fields, with no
unrelated inventory change. Only after confirmation is the domain added to the
receipt's owned attachments. No missing field or other environment is normalized.

Failed reads or inconsistent metadata leave the receipt attaching. Automatic
retry and deletion remain blocked. A matching acknowledgement alone is never
ownership proof. Both staging and production use this shared primitive; no
application/payment/credential/Access policy behavior changes.

## Release boundary

The patch requires hosted exact-head CI, independent approval and protected merge
before the workflow can use it. A later release must capture the currently
existing staging hostname as pre-existing and preserve it; it cannot claim that
hostname for deletion. Preserve the original failed receipt and the separate
operator reconciliation evidence for rollback planning. The remaining API host
must be attached only by the reviewed lane after fresh audit/source/CI checks.

Live Google/OTP/session/sandbox payment, user journeys, mobile/PWA and a rollback
rehearsal remain pending. No production release has been dispatched. Production
retains its existing source and domains. Admin remains reserved and undeployed.

## Validation

- Focused domain/release/routing/assets regression: 17 files / 454 tests PASS.
- Full lint PASS with two pre-existing generated-bundle warnings, no errors.
- Both TypeScript checks, customer/Admin migration smoke, Web/Admin/Worker build,
  changed-file ESLint, Node syntax and whitespace checks PASS.
- Build retains existing Admin font resolution warnings.
- The first new positive test incorrectly expected an acknowledgement during the
  later post-confirmation inventory read; its fixture hook was corrected before
  the final passing run. Assertions and runtime timeouts were not weakened.
- No local full-suite PASS is claimed. Hosted exact-head CI remains required.
