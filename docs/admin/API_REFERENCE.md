# Takosan Admin Console V1 — API reference

Base path: `/api/v1/admin`. Types: `src/shared/admin.ts`. Migration: `migrations/0042_admin_console_foundation.sql`.

## Transport rules (all endpoints)

- Success body: `{ "data": T, "context": AdminDataContext }` (201 for creations).
- Error body: `{ "error": string, "code": AdminErrorCode }` (Vietnamese message, no stack, no SQL).
- Headers on every admin response: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`.
- Pagination: `page` (int 1..1000, default 1), `pageSize` (int 1..100, default 25). Deterministic
  `ORDER BY <time> DESC, id DESC`. Out-of-bounds or malformed query → `400 ADMIN_VALIDATION_FAILED`.
- `range`: `7d | 30d | 90d` (default `30d`). Day buckets are UTC `YYYY-MM-DD`, zero-filled.
- `q` search: trimmed, 1..100 chars; LIKE wildcards are escaped.
- Unknown admin path → `404 ADMIN_NOT_FOUND` for an authenticated admin (unauthenticated callers get the
  session error first). Admin paths never fall through to customer routes.

## Authentication

Admin authority = an **admin session** (`admin_sessions`, cookie `__Host-takosan_admin_session`,
HttpOnly, Secure, SameSite=Strict, Path=/) **plus** at least one active row in
`admin_role_assignments`, re-read on every request. Customer sessions, household roles,
`Authorization` bearer tokens, `x-user-id`, `x-admin-role`, `X-Frigo-Expected-*` or any other
client header are never admin authority.

Mode resolution (`GET /auth/config`):

| ENVIRONMENT | Config | Mode |
|---|---|---|
| production | `ADMIN_CONSOLE_ENABLED != "true"` | console disabled: every `/api/v1/admin/*` and `/admin*` → 404 |
| production | `ADMIN_AUTH_MODE=cloudflare_access` + `ADMIN_ACCESS_TEAM_DOMAIN` + `ADMIN_ACCESS_AUD` | `cloudflare_access` |
| production | anything else | `unavailable` (all authenticated endpoints → `503 ADMIN_AUTH_NOT_CONFIGURED`) |
| non-production | Access config as above | `cloudflare_access` |
| development, or `ADMIN_PASSWORD_LOGIN_ENABLED=true` (non-prod) | — | `password` |
| other | — | `unavailable` |

`ADMIN_HOSTNAME` (optional): when set, admin API + HTML are served only for that hostname.
Non-production console is enabled unless `ADMIN_CONSOLE_ENABLED=false`.

Session lifetime: absolute 8h (`expires_at`), idle 30 min (`idle_expires_at`, slid at most once/min).

Session failures: no/unknown cookie → `401 ADMIN_UNAUTHENTICATED`; revoked → `401 ADMIN_SESSION_REVOKED`;
expired (absolute or idle) → `401 ADMIN_SESSION_EXPIRED`; no remaining active role → session revoked
(`role_revoked`) and `401 ADMIN_SESSION_REVOKED`. In `cloudflare_access` mode every request must also
carry a valid `Cf-Access-Jwt-Assertion` whose email matches the session user → else `401 ADMIN_ACCESS_DENIED`.

CSRF (every POST/PUT/PATCH/DELETE except login): trusted `Origin` (existing `hasTrustedOrigin`) **and**
header `X-Admin-CSRF` equal to the session's CSRF token (cookie `__Host-takosan_admin_csrf`, readable by
JS, SameSite=Strict; server stores only its SHA-256) → else `403 ADMIN_CSRF_FAILED` (audited).
Login requires trusted `Origin` only.

Permission failure → `403 ADMIN_FORBIDDEN` (audited as `admin.permission.denied`).

Rate limits (existing limiter; fail-closed in production for login and writes):
login 5/min per IP · reads 120/min per admin user · writes 20/min per admin user → `429 RATE_LIMIT_EXCEEDED`.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/auth/config` | public | `{data: AdminAuthConfig, context}` |
| POST | `/auth/login` | public (Origin) | password mode body `{email,password}`; Access mode uses verified assertion. Generic `401 ADMIN_INVALID_CREDENTIALS` for unknown user, bad password, unverified account, guest, or no admin role. Sets both cookies. Body `{data: AdminMe, context, csrfToken}` |
| POST | `/auth/logout` | session + CSRF | revokes (`logout`), clears cookies, `{data:{loggedOut:true}}` |

## Read endpoints

| Method | Path | Permission | Response `data` |
|---|---|---|---|
| GET | `/me` | `admin.self.read` | `AdminMe` |
| GET | `/overview?range` | `overview.read` | `AdminOverview` |
| GET | `/users?q&page&pageSize&type=registered\|guest\|all&plan=free\|plus&admin=true\|false` | `users.read` | `AdminPage<AdminUserSummary>` (type default `registered`) |
| GET | `/users/:id?reveal=email` | `users.read` (+ `users.pii.reveal` when `reveal=email`, audited `users.pii.reveal`) | `AdminUserDetail` |
| GET | `/households?q&page&pageSize` | `households.read` | `AdminPage<AdminHouseholdSummary>` |
| GET | `/billing/summary?range` | `billing.read` | `AdminBillingSummary` |
| GET | `/billing/transactions?status&page&pageSize` | `billing.read` | `AdminPage<AdminTransaction>` |
| GET | `/ai/summary?range` | `ai.read` | `AdminAiSummary` |
| GET | `/ai/usage?task&status&page&pageSize` | `ai.read` | `AdminPage<AdminAiUsageRow>` |
| GET | `/recipes?q&cuisine&verification&source&page&pageSize` | `recipes.read` | `AdminPage<AdminRecipeSummary>` |
| GET | `/recipes/summary` | `recipes.read` | `AdminRecipesSummary` |
| GET | `/recipes/:id` | `recipes.read` | `AdminRecipeDetail` |
| GET | `/system/status` | `system.read` | `AdminSystemStatus` |
| GET | `/audit?action&outcome&actor&from&to&page&pageSize` | `audit.read` | `AdminPage<AdminAuditEvent>` |
| GET | `/settings` | `admin.self.read` (assignments/approvals only with `admin.roles.read`, else `[]`) | `AdminSettings` |
| GET | `/sessions` | `admin.sessions.revoke` | active admin sessions (`id,userId,authMethod,createdAt,lastSeenAt,expiresAt`) |

## Mutations (all: session + CSRF + write rate limit + audit in the same D1 batch)

| Method | Path | Permission | Rules |
|---|---|---|---|
| PUT | `/preferences` | `admin.preferences.write` | body `Partial<AdminPreferences>` |
| POST | `/recipes/:id/reviews` | `recipes.review` | body `AdminRecipeReviewRequest`; `recipeVersion` ≠ current → `409 ADMIN_CONFLICT`. Writes `admin_recipe_editorial_reviews` only; never mutates `recipes`. |
| POST | `/roles` | `admin.roles.manage` | body `AdminGrantRoleRequest`. Target must be a verified non-guest user; self-target → 403. `SUPER_ADMIN` → creates pending approval (72h) instead of granting. Duplicate active → 409. |
| DELETE | `/roles/:assignmentId` | `admin.roles.manage` | cannot revoke own assignment; cannot revoke last active `SUPER_ADMIN`; revokes target admin sessions when no active role remains |
| POST | `/approvals/:id/approve` · `/approvals/:id/reject` | `admin.approvals.decide` | decider ≠ requester ≠ target; must be pending and unexpired |
| POST | `/sessions/:id/revoke` | `admin.sessions.revoke` | reason `admin_revoked` |

There is **no** bootstrap, provisioning, entitlement, payment, refund, or recipe-publish endpoint.
Administrator provisioning is the local-only CLI `pnpm admin:provision` (see `docs/admin/LOCAL_SETUP.md`).

## Redaction guarantees

Never returned: password hashes/salts, Google IDs, session/CSRF tokens or hashes, OTP material,
payment provider references, checkout instructions, full order codes (last 4 only), scan image keys,
raw IPs. Emails are masked (`ab•••@domain`) unless revealed via the audited endpoint.
