# ADR-B08-LOCAL-001: Remediate verified local security graphs

Status: accepted for local implementation; release acceptance pending.
Base receipt: 2c42984b2839d1b03c3b0ccfb89998d3535a48d8.

The user requested completion of the plan in sequence. Existing audit findings
have concrete direct owner patches and reversible local compatibility checks.
The program source freeze binds prior evidence; it does not prohibit a subsequent
isolated security packet. External certificates are still separate gates.

## Decisions

Pin Vitest 4.1.11, Wrangler 4.149.0, matching Workers types 5.20261006.1,
sharp 0.35.5 and Router 7.18.3. Router 7.18.0 met the earlier two advisory floors,
but actual installation/audit revealed an additional high-severity RSC advisory
fixed in 7.18.2; the new production audit must validate the patch selection.
Wrangler is an official stable owner release with an alpha Miniflare transitive;
retain its supported graph and require local emulator/CLI proof. Do not inject
incompatible Undici or Miniflare major overrides into an old owner.

Preserve React 18, Vite 6 and Tailwind 3. The unused vite-plugin-pwa direct tool
is removed after repository import inspection: the application uses its existing
custom public service worker and build-token injector. Verify the actual service
worker output and offline consumer behavior. Update supported TypeScript ESLint
owners and PostCSS, and refresh compatible ws/brace-expansion lock resolutions.

Tailwind 3 declares an older selector-parser major. A narrow override of only
that owner's selector-parser to 7.1.6 requires byte-identical generated CSS on
matching application inputs plus full build/browser validation. Treat failure
as a compatibility blocker, not permission to accept changed styling. No package
patch claims to fix braces when the registry has no published patched range;
retain any actual finding and describe its upstream or dedicated migration gate.

Keep runtime compatibility date, resource identities, flags, schema and catalog
unchanged. New Workers package types alone are not proof of platform behavior.
Wrangler4 changes the local persistence API to persist:true/persistTo:path;
the test harness must preserve directory isolation and durable restart behavior.
Router test wrappers migrate supported imports/transition options while preserving
all assertions. Font fixtures use the explicit fs base64 string overload; Vitest
mock signatures remain their actual callable contract.

The workflow lane may change local workflow action pins, environment indirection
for untrusted inputs, supported cache/checkout credential inputs and the exact
Wrangler version consumed by the deployment action. This narrowly supersedes the
packet's initial blanket workflow byte freeze. Preserve every current-main,
exact-SHA, approval, environment, ancestry, migration, release and rollback check.
No workflow run, push, settings change, remote migration or deployment is authorized
by these local file changes. Candidate scanner enablement remains separately gated.
Do not add unsupported action inputs or suppress scanner findings to obtain green.

Router7 defaults BrowserRouter/MemoryRouter to startTransition. The first full
run exposed a second Turnstile mount on registration-to-OTP navigation. Set the
app BrowserRouter useTransitions=false to preserve its Router6 urgent-navigation
default; matching auth wrappers use the same option. Existing auth assertions
remain unchanged and the targeted registration/resend suite passes. This is a
compatibility option, not a change to auth issuance, admission or tenant policy.

sharp0.35.5 changes the compressed IDAT representation of six small PNG icons.
All36 exports are checked:24 vector files remain byte-identical and12 PNGs have
exact decoded pixels, dimensions, channels, color depth/space and alpha. Keep the
generator and committed public assets unchanged, retain the original failing byte
comparison, and make the reproducibility test enforce those semantic invariants.
New checksum receipts record the encoder difference explicitly. The first focused
pixel check exceeded the5s default because Vitest recursively compared millions
of Buffer indices. Buffer.equals enforces identical byte content in native linear
time, preserving exact equality without increasing the timeout;24 focused tests
then pass. The original timeout receipt is retained.

## Verification

Record actual failures and corrected runs. Require frozen install, lint, types,
full tests, local migrations/D1, sequential build, native image decoding, Router
browser navigation and pinned scanner evidence. Retain parent receipt history;
new evidence binds the new implementation and its explicit protected delta.
