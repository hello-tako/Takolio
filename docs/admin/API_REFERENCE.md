> R2 CURRENT AUTHORITY: production-readiness/00_EXECUTIVE_STATUS.md and 03-18.
> The material retained below is historical original/R1 documentation; its source,
> customer binding/password authority, schema version 1, two-person/bootstrap,
> per-email throttling and rollout directions are superseded. Do not execute
> historical release or SQL instructions. Current Admin authority is independent
> issuer/subject enrollment, three operators, ADMIN_DB schema 3 and internal
> read facade. Live workflows are offline plans; staging/production are blocked.

# Takosan Admin Console V1 — API reference

Base path: `/api/v1/admin` on the admin Worker. Types: `src/shared/admin.ts`. Admin schema: `migrations-admin/0001_admin_console_foundation.sql` (binding `ADMIN_DB`).

## Transport rules (all endpoints) — R1

Served by the **admin Worker** (`src/worker/admin-worker.ts`) on its own origin (`ADMIN_ORIGIN`); the customer
Worker has no admin routes. Full contract and rationale: `remediation-r1/REPORT.md` §3–§5.

- Success body: `{ "data": T, "context": AdminDataContext }` (201 for creations). Exception: public
  `GET /auth/config` returns `{ "data": { "mode": "password" | "cloudflare_access" | "unavailable" } }` with no context.
- Error body: `{ "error": string, "code": AdminErrorCode }`; no stack, no SQL. `Retry-After` on 429/503 limiter errors.
- Every admin response: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, no `Access-Control-*` headers.
- Disabled, misconfigured, or foreign-origin requests: plain-text `404 Not Found` for every path (documents, assets, API).
- API prerequisites: both databases bound, admin schema version `1` (else `503 ADMIN_SCHEMA_MISMATCH`), and no
  synthetic fixture marker outside development/test (else `503 ADMIN_FIXTURE_DATA_REJECTED`).
- Pagination: `page` 1..1000 (default 1), `pageSize` 1..100 (default 25), deterministic ordering; malformed or unknown
  query parameters → `400 ADMIN_VALIDATION_FAILED`. `range`: `7d | 30d | 90d` (default `30d`). `q`: 1..100 chars.

## Authentication — R1

Availability and auth mode are decided server-side by `resolveAdminPolicy` (REPORT §3). Password login exists only
in local builds (`__ADMIN_LOCAL_AUTH__` define) with `ENVIRONMENT=development|test` on a loopback `ADMIN_ORIGIN`.
Staging/production use Cloudflare Access only.

- Session cookie: `__Host-takosan_admin_session` (HttpOnly, Secure, SameSite=Strict, host-only, 8 h absolute,
  30 min idle). No other admin cookie.
- CSRF: every non-GET request needs `Origin` exactly equal to `ADMIN_ORIGIN` (no Referer fallback; `Sec-Fetch-Site`
  must be `same-origin` when present) and `X-Admin-CSRF` equal to the session-derived token returned by login
  (`csrfToken`, top level and `data.csrfToken`) and by `GET /me` (`data.csrfToken`). Keep it in memory only.
- Login (`POST /auth/login`): exact Origin; budgets global 60/min, per IP (`CF-Connecting-IP` only) 5/min, per account
  10/15 min; generic `401 ADMIN_INVALID_CREDENTIALS`. Access mode verifies `Cf-Access-Jwt-Assertion` on login and on
  every request (`401 ADMIN_ACCESS_DENIED`).
- Session errors: `401 ADMIN_UNAUTHENTICATED` (no/unknown cookie), `401 ADMIN_SESSION_EXPIRED`, `401 ADMIN_SESSION_REVOKED`
  (logout, admin revoke, any role change, credential/verification/identity change, auth-mode change).
- Required audit writes that fail → `503 ADMIN_AUDIT_UNAVAILABLE` with no data disclosed and no side effect.

## Read endpoints

| Method | Path | Permission | Response `data` |
|---|---|---|---|
| GET | `/me` | `admin.self.read` | `AdminMe` |
| GET | `/overview?range` | `overview.read` | `AdminOverview` |
| GET | `/users?q&page&pageSize&type=registered\|guest\|all&plan=free\|plus&admin=true\|false` | `users.read` | `AdminPage<AdminUserSummary>` (type default `registered`). `q` matches emails only for `users.pii.reveal` holders and is audited (`users.search`) before results |
| GET | `/users/:id?reveal=email` | `users.read` (+ `users.pii.reveal` for `reveal=email`, 30/h) | `AdminUserDetail`; audited (`users.view` / `users.pii.reveal`) **before** the response |
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

## Mutations (session + CSRF + write budget; audit in the same D1 batch)

| Method | Path | Permission | Rules |
|---|---|---|---|
| PUT | `/preferences` | `admin.preferences.write` | body `Partial<AdminPreferences>` |
| POST | `/recipes/:id/reviews` | `recipes.review` | `recipeVersion` ≠ current → 409; writes the admin editorial ledger only |
| POST | `/roles` | `admin.roles.manage` | `AdminGrantRoleResult`. Self → 403. Target must be a verified non-guest user. `SUPER_ADMIN` → 201 `{approval}` (72 h); others → 201 `{assignment}` and the target's admin sessions are revoked. Duplicate/concurrent → 409 |
| DELETE | `/roles/:assignmentId` | `admin.roles.manage` | `AdminRevokeRoleResult`. Self → 403. `SUPER_ADMIN` → 201 `{approval}` (409 if fewer than 3 active SUPER_ADMINs); others → 200 `{assignment}` and target sessions revoked |
| POST | `/approvals/:id/approve` · `/reject` | `admin.approvals.decide` | requester or target → 403; not pending/expired → 409; requester no longer SUPER_ADMIN → approval cancelled + 409; all guards re-checked inside the batch; database keeps ≥ 2 active SUPER_ADMINs |
| POST | `/sessions/:id/revoke` | `admin.sessions.revoke` | reason `admin_revoked` |

There is **no** bootstrap, provisioning, entitlement, payment, refund or recipe-publish endpoint. The first two
SUPER_ADMINs come from the two-person operator bootstrap (`PRODUCTION_INTEGRATION_PLAN.md` §5; local: `pnpm admin:provision`).

## Redaction guarantees

Never returned: password hashes/salts, Google IDs, session/CSRF tokens or hashes, OTP material,
payment provider references, checkout instructions, full order codes (last 4 only), scan image keys,
raw IPs. Emails are masked (`ab•••@domain`) unless revealed via the audited endpoint.
