# Admin Console V1 — architecture map

## Existing systems reused (not duplicated)

| Concern | Existing component | How the console uses it |
|---|---|---|
| HTTP app | Hono app `src/worker/index.ts` | `adminRoutes` mounted at `/api/v1/admin` **before** the customer router; `/admin/*` documents served before the SPA fallback |
| Security headers | global middleware in `index.ts`, `config/csp.ts` | new `adminCsp()` (no third-party origins) for `/admin*`; COOP `same-origin` |
| Production config gate | `middleware/config-gate.ts` | unchanged; still runs before admin routes |
| Origin/CSRF primitive | `middleware/csrf.ts#hasTrustedOrigin`, `config/origins.ts` | origin check for login and every admin mutation, plus a session-bound double-submit token |
| Rate limiting | `middleware/rate-limit.ts` | reused; gained an optional `key` callback (backward compatible) so admin limits key by admin user / IP without touching the customer `auth` variable |
| Hashing / passwords | `utils/session.ts` (`sha256Hex`, `hmacSha256Hex`), `utils/password.ts` | session/CSRF token hashing, audit IP HMAC, password verification against `auth_accounts` |
| Accounts | `users`, `auth_accounts`, `profiles` | admin identities are ordinary verified accounts; authority comes only from `admin_role_assignments` |
| Customer sessions/tenancy | `sessions_v2`, `authMiddleware`, `tenancyGuard` | **not used for admin authority**; unchanged |
| Payments/entitlements | `payment_intents`, `checkout_admissions`, `payment_reconciliation_records`, `subscriptions` | read-only SQL in `routes/admin/billing-ai.ts`; no payment code touched |
| Recipe authority | `recipes`, `recipe_media`, `recipe_ingredients`, `recipe_steps`, `RECIPE_CATALOG_MODE` | read-only; editorial notes go to a separate ledger table |
| AI/OCR | `ai_requests` (schema exists, runtime writer `LOG_AI_REQUEST` unused), `scans`, `scan_queue_jobs` | aggregated with explicit `partial`/`unavailable` status |
| Health | `routes/health.ts`, `config/validation.ts` | system status reuses `validateEnvironment` issue codes (codes only) |
| Brand | `src/web/styles/takosan-tokens.css`, Nunito fonts | imported by the admin stylesheet |
| Test DB | `tests/helpers/sqlite-d1.ts`, `tests/helpers/worker-fetch.mjs` | integration tests run the real Worker on SQLite with the full migration ledger |

## New components

```
admin/index.html                       admin entry (Vite multi-page input "admin")
src/shared/admin.ts                    roles, permission matrix, DTO contract (shared by Worker + UI)
src/admin/                             React app (basename /admin): api/, auth/, components/, pages/, i18n/vi.ts, styles/
src/worker/routes/admin/
  index.ts      router; per-route requirePermission; mutations
  auth.ts       mode resolution, login/logout, session middleware, CSRF, permission + limiter middleware
  access.ts     Cloudflare Access RS256/JWKS verifier adapter
  audit.ts      append-only audit writer (+ guarded insert for race-safe mutations)
  schemas.ts    Zod query/body schemas with strict bounds
  overview.ts, people.ts, billing-ai.ts, recipes.ts, system.ts, settings.ts   read services
  http.ts, mask.ts                     envelope, errors, masking helpers
migrations/0042_admin_console_foundation.sql
scripts/admin-local-lib.mjs, admin-provision.mjs, admin-local-d1.mjs, admin-preview.mjs
tests/integration/admin-console.test.ts, tests/unit/admin-*.test.ts(x), tests/e2e/admin-console.e2e.ts
playwright.admin.config.ts
```

## Request flow

`/api/v1/admin/*` → telemetry → security headers → production config gate → CORS →
`adminGate` (enabled? hostname? DB? auth mode) → public `/auth/config`, `/auth/login` **or**
`requireAdminSession` (cookie → `admin_sessions` → fresh roles; Access re-verification in Access mode) →
read/write limiter → `requireCsrf` (mutations) → `requirePermission(<explicit permission>)` → handler →
`{ data, context }` with `Cache-Control: no-store`.

## Separation from the customer app

Different cookie names, different session table, SameSite=Strict, separate HTML entry and bundle,
separate CSP, the customer service worker skips `/admin*`, and no shared navigation. Admin routes
never fall through to customer handlers (catch-all `ADMIN_NOT_FOUND`).
