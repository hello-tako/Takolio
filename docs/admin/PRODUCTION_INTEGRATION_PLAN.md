# Admin Console V1 — staging/production integration plan (NOT executed)

Nothing in this plan has been run. Production integration is a separately authorized operation and
must go through the existing GitHub Environment approvals and release gates (`deploy.yml`,
`production-d1-migrate.yml`). The console adds **no** deploy, migrate, or flag buttons.

## Default production behavior of this code

Deploying this code without new configuration changes nothing user-visible:
`ENVIRONMENT=production` without `ADMIN_CONSOLE_ENABLED=true` → `/admin*` and `/api/v1/admin/*`
return 404. With the console enabled but Access not configured, admin APIs fail closed with
`503 ADMIN_AUTH_NOT_CONFIGURED`; password login is never available in production.

## Cloudflare Access contract

- Dedicated hostname (recommended `admin.<domain>`), set as `ADMIN_HOSTNAME`; admin API and HTML are
  served only for that host. Add a Worker custom-domain route for it in `wrangler.jsonc`.
- Create an Access self-hosted application for the hostname (path `/*`), policy restricted to named
  staff identities, session ≤ 8h.
- Worker vars: `ADMIN_CONSOLE_ENABLED=true`, `ADMIN_AUTH_MODE=cloudflare_access`,
  `ADMIN_ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com`, `ADMIN_ACCESS_AUD=<application AUD tag>`.
- The Worker verifies `Cf-Access-Jwt-Assertion` (RS256 against `https://<team>/cdn-cgi/access/certs`,
  `aud`, `iss`, `exp/nbf`) on login **and every request**, and requires the Access email to equal the
  admin session user's account email. Access alone grants nothing: an active
  `admin_role_assignments` row is still required.
- The verifier was unit-tested with a locally generated RSA key only; it has **not** been verified
  against a real Access tenant.

## D1 migration sequence

1. Staging: apply `0042_admin_console_foundation.sql` through the existing staging migrate workflow;
   run `schema:check` and the staging readiness checks.
2. Production: the production migrate workflow pins an allow-list of migrations
   (`production-d1-migrate.yml`, tested by `tests/unit/production-migration-preflight.test.mjs`).
   0042 must be added there through a reviewed PR; it was intentionally **not** changed here.
3. After it is applied, append the 0042 SHA-256 to `tests/fixtures/migration-sha256.json` (repository
   rule: pin only after merge + apply).
4. 0042 is additive: new tables and four indexes on `users`, `sessions_v2`, `ai_requests`. Rollback
   needs no schema change (disable the console); the tables can stay.

## Bootstrap in production

There is no endpoint for it, and the CLI refuses non-development environments. The first production
SUPER_ADMIN needs a reviewed one-off SQL change through the protected migration/operations path
(two-person review), recorded in `admin_audit_events` with `grant_source='local_bootstrap'` semantics.
That procedure needs its own authorization and is a blocker.

## Bindings and environment

Uses the existing `DB`, `CACHE` (rate limits; login and writes fail closed in production without
KV), and `ASSETS`. No new secrets. `JWT_SECRET` (existing) keys the audit IP HMAC.

## Staging verification procedure

1. Deploy to staging via the existing workflow with Access configured for a staging admin host.
2. Check: unauthenticated `/api/v1/admin/me` returns 401; an Access-only identity without a role is
   denied; role-bound identities see exactly their matrix; mutations without `X-Admin-CSRF` return 403;
   audit rows appear for login, denial, and mutations.
3. Check that the customer app regression suite and `/api/v1/health/ready` are unchanged.

## Health checks and rollback

- Health: the existing `/api/v1/health/ready`. Admin status is at `/api/v1/admin/system/status`
  (authenticated).
- Rollback: set `ADMIN_CONSOLE_ENABLED=false` (immediate 404), or redeploy the previous release.
  Admin sessions can be revoked in bulk with
  `UPDATE admin_sessions SET revoked_at=…, revoked_reason='admin_revoked'` through the protected ops path.

## Independent security review gates (before enabling)

Access policy review · Access JWT verification against a real tenant · production bootstrap procedure ·
audit retention/export policy · rate-limit KV fail-closed confirmation · PII reveal policy sign-off ·
penetration test of `/api/v1/admin/*` on staging.
