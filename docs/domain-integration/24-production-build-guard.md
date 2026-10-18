# Production candidate composition guard

Production run [39101591421](https://github.com/hello-tako/Takolio/actions/runs/39101591421)
was independently approved, then failed in `prepared`. No upload, traffic activation
or hostname mutation occurred. Recovery completed with `mutationAttempted=false`.
Read-only certification [39101415582](https://github.com/hello-tako/Takolio/actions/runs/39101415582)
passed; the prior production baseline is version `01b81140-3162-47e0-8573-88b679877f8a`,
source `526596a8cd857984ad2b69901a8c7b0e9d6bccc2`.

## Reproduction and cause

The actual production build passes. Running the next CLI command with the retained
manifest/config and actual build record exits 1:
`Planner prerequisite must use the staging Wrangler configuration`.
The CLI's optional fourth config argument intentionally calls
`verifyStagingPlannerPrerequisite`; the production adapter incorrectly reused it.
The generic command-output wrapper hid this safe error behind its sanitized message.

## Correction

Only the production adapter changes. After compiling, it requires production
identity and directly calls existing `verifyCompositionRelease` and
`verifyPlannerPrerequisite` with the audited configuration and actual Vite record.
This binds the manifest, Worker composition flag, requested and compiled UI flag,
Worker planner flag and compiled planner flag. Staging-specific checks retain their
original contract. No flags are disabled, assertions removed or release gates bypassed.

## Validation

- The same actual production receipt now passes the complete adapter build locally.
- New provider-build tests cover matching on/on and off/off, wrong environment,
  server/requested/compiled composition differences, manifest disagreement,
  server/compiled planner differences and missing compiled flags.
- Related regression: 19 files / 288 tests PASS; lint, both TypeScript checks,
  customer/Admin migration smoke and build PASS.
- Existing generated-bundle lint and Admin font warnings remain.
- Hosted exact-head CI, independent review and normal protected merge are required.

Actual staging evidence and its synthetic/provider qualifications are published in
[this attestation](https://github.com/hello-tako/Takolio/pull/13#issuecomment-6245968702).
A new source SHA requires a new canonical staging receipt and accurate attestation;
the old receipt must not be relabeled. Production release remains pending.
