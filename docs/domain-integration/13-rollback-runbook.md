# Rollback Runbook

Trigger rollback on invalid TLS, wrong source SHA, host-boundary failure, login/session loss beyond expected new-origin login, CORS/CSRF failure, incompatible callback verification or sustained API errors.

Before cutover capture exact Worker version/deployment, route and custom-domain IDs, DNS record IDs, workers.dev state, cron/consumers/settings and provider URLs. Current known production version is `35dd189e-7e3c-4782-b69b-237da7dadd62`; refresh it before use. Existing new-zone record/route counts are zero. That count is baseline evidence, not a replacement for IDs created during cutover.

1. Stop rollout and retain sanitized request IDs and Cloudflare audit events.
2. Restore the recorded Worker version through the reviewed release mechanism and restore the matching pre-cutover domain/route/settings snapshot. The previous code has no domain fence: do not leave new API/WWW hosts attached to that code and assume boundaries still hold. Remove only newly created attachments through an approved reversible plan; do not alter unrelated DNS or delete the zone.
3. Verify legacy `https://frigo.tungjpstore.net` health, session flows, recipes and callback availability. Old host-only sessions/browser storage were preserved; new-origin cookies do not migrate back.
4. Restore approved OAuth JS origins/frontend APP_URL coherently, retaining any transitional origin until sessions have settled. No speculative redirect URI changes.
5. If PayOS registration changed, restore the provider-approved endpoint and preserve compatibility with in-flight orders. Never blindly replay grants or roll back to a payment-incompatible version.
6. Recheck source/assets, API boundaries, auth, signed webhook fixtures and monitoring before declaring recovery.

Database rollback is excluded. No destructive DNS/data deletion, force push or history rewrite is part of this task. Rollback rehearsal on live new domains is NOT RUN until staging is available.
