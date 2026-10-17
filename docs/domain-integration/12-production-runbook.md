# Production Runbook

Release credentials were provisioned and the existing verification secret was rotated without changing application code/runtime/bindings/assets; see `14-release-operations.md`. No new-domain cutover has occurred. These gates are mandatory before application upload or domain attachment.

1. Verify canonical repository ID 1422954151, current origin/main, clean reviewed release SHA, exact-SHA hosted CI and independent review. Staging/production Environments and scoped deployment/release-verification secrets are restored; verify their current configuration and required independent production reviewer before using a release workflow. Never weaken branch protection or reuse old repository-bound authority evidence.
2. Accept staging on the same candidate: isolation, Access, real Google, approved OTP inbox, sandbox PayOS, PWA, frontend/backend journeys and new-host DNS/TLS.
3. Re-read current deployment/version immediately before cutover. Captured production deployment is `0ce984e1-0c1a-4221-a271-ff252a279ae1`, version `01b81140-3162-47e0-8573-88b679877f8a`, source `526596a8cd857984ad2b69901a8c7b0e9d6bccc2`. Abort and re-audit on drift.
4. Capture current custom domains/routes/DNS IDs, workers.dev state, queue consumer/dead-letter settings, cron, compatibility, observability and secret names. Version metadata alone does not prove all settings. Resolve every `operationalBlockers` entry. No schema/data migration is required here.
5. Refresh complete supported binding evidence, commit it, then prepare the candidate from the clean release SHA. Review route delta, public vars and paired planner/T20 build flags against current live state. Keep flags and secrets unchanged except approved APP_URL/routing activation.
6. Present the concrete SHA, CI/review, route/config delta, rollback snapshot and monitoring window against the owner's explicit release authorization. The independent production Environment review remains required.
7. First review an activation path that consumes the audited domain candidate; the existing default Deploy workflow still uses legacy configs. Through that reviewed release mechanism, activate host-aware Worker configuration and its custom domains coherently. Avoid attaching domains to old code before host boundaries exist. Preserve `frigo.tungjpstore.net` throughout.
8. Verify apex/WWW/API HTTPS, redirect preservation, health/readiness SHA, asset SHA, cookies/CORS/CSRF, approved auth/OTP, read-only recipe/planner and PWA. Inspect errors/request IDs for the release window, at least 15 minutes active observation.
9. Only after endpoint acceptance, coordinate provider-approved PayOS webhook migration and pending-order reconciliation. No real payment without separate authorization.

This runbook contains no automatic Cloudflare mutation command. Failure triggers the paired code/routes/provider rollback plan.
