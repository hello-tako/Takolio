# Takosan Admin V1 — security & full-stack review of `3e865d0`

**Decision: `ADMIN_V1_REVIEW_CHANGES_REQUIRED`**

## Reviewer independence

Hoplite performed this review in the same thread and on the same model that implemented the change.
That is **not** organizational independence. Mitigations: backend and frontend audits ran in fresh-context
subagents that were told not to trust the implementation; every finding below has executable evidence
(PoC test, workerd run, or browser run) or an exact code citation; all gates ran in a clean worktree of
the exact commit. A human or separate-team review is still required before production.

No source file was modified during the review. No GitHub/Cloudflare API call, push, merge, deploy, or
remote D1 access happened. Wrangler review commands ran with `WRANGLER_SEND_METRICS=false`, with the OAuth
credentials hidden (`XDG_CONFIG_HOME=/tmp/review/xdg`), and with `--local` only. Disclosure: during the
implementation phase, local wrangler commands ran with wrangler's default anonymous telemetry enabled.
They performed no account or API operations.

## 1. Source and commit identity

| Item | Value |
|---|---|
| Implementation commit | `3e865d009ee62a92ed1d9c8d225a36893035670b`, "feat(admin): Takosan Admin Console V1 (local)" |
| Parent / baseline | `186a9cf05de7c91ed3289e13130feb3b38a264ac` (Merge PR #71), the checkout head at task start |
| Remote | `origin https://github.com/hello-tako/Tako-san.git`. Repository ID `1385308553` is **not verifiable offline** (no GitHub API allowed). |
| Working tree at review start | clean (`git status --porcelain` empty) |
| Changeset | 98 files, +10084/−11: 82 added, 16 modified |
| Review worktree | `git worktree add --detach /tmp/review/clone 3e865d0`, `pnpm install --frozen-lockfile --offline` |

## 2. Reviewed file manifest (authority-relevant)

- Backend: `src/worker/routes/admin/{index,auth,access,audit,http,mask,schemas,overview,people,billing-ai,recipes,system,settings}.ts`;
  modified `src/worker/index.ts` (mounts, `/admin*` documents, CSP/COOP), `src/worker/config/csp.ts`,
  `src/worker/middleware/rate-limit.ts` (`key` option), `src/worker/types.ts`.
- Contract: `src/shared/admin.ts` (roles, `ADMIN_PERMISSION_MATRIX`, cookie/CSRF constants, DTOs).
- Database: `migrations/0042_admin_console_foundation.sql`; `scripts/migration-smoke.sh`; `tests/helpers/sqlite-d1.ts`.
- Bootstrap and fixtures: `scripts/admin-local-lib.mjs`, `admin-provision.mjs`, `admin-local-d1.mjs`, `admin-preview.mjs`.
- Frontend: `admin/index.html`, `src/admin/**` (API client with CSRF header, session/permission gating, 11 pages), `vite.config.ts`, `tsconfig.json`, `public/sw.js`.
- Tests: `tests/integration/admin-console.test.ts`, `tests/unit/admin-*.test.ts(x)`, `tests/e2e/admin-console.e2e.ts`, `playwright.admin.config.ts`; modified `tests/integration/auth-hardening.test.ts`, `auth-otp-coordinator.test.ts`.
- Docs: `docs/admin/*`, `docs/ai/DECISIONS.md` (ADR-ADMIN-001).
- Untouched (verified by `git diff --name-only`): payment/PayOS/billing/checkout code, `.github/workflows/*`, existing migrations.

## 3. Security findings

Severity is the impact if the console is enabled in the affected configuration. Production defaults to
console-disabled for the API.

| ID | Sev | Finding | Affected paths | Evidence |
|---|---|---|---|---|
| S1 | High | **Environment detection fails open.** A missing or empty `ENVIRONMENT` is treated as development: console enabled and password login available. Wrong-case `'Production'` or `'staging'` also enables the console. This violates the spec requirement "fail closed outside local development". | `routes/admin/auth.ts` (`consoleEnabled`, `resolveAuthMode`) | PoC `h1-h2-h8-origin-host-env.test.ts` H2a–d |
| S2 | High | **The asset layer serves `/admin/` without running the Worker.** With `compatibility_date 2024-11-01` and no `run_worker_first`, `/admin/` (and the `/admin` → `/admin/` redirect) is answered from `dist/client/admin/index.html` with the customer CSP from `_headers`, no `X-Robots-Tag`, and **even when `ADMIN_CONSOLE_ENABLED=false`** or the host is not `ADMIN_HOSTNAME`. Deep links do reach the Worker. The Node preview and the integration tests do not model asset routing and missed this. The next production deploy after merge would publicly serve the admin shell (the API stays 404). | `wrangler.jsonc`, `wrangler.staging.jsonc` (`assets`), `src/worker/index.ts` (`serveAdminDocument`), `scripts/admin-preview.mjs` | `wrangler dev --local` (workerd): enabled: `/admin/` 200 customer CSP, `/admin/users` 200 admin CSP; disabled: `/admin/` 200 ADMIN_SHELL, `/admin/users` 404, API 404 |
| S3 | High | **Admin origin trust follows the customer origin.** Admin CSRF/Origin and CORS trust `APP_URL` (the customer origin). With `ADMIN_HOSTNAME` set, login and every mutation on the admin host fail (403), and the customer origin is accepted with credentials. When colocated, the CSRF cookie is JS-readable on the customer origin, so customer-SPA XSS gives admin mutations. The admin host also serves the customer SPA and API. | `config/origins.ts`, `middleware/csrf.ts`, `src/worker/index.ts` (CORS, routing), `routes/admin/auth.ts` (cookies) | PoC H1a–e, H8a–d |
| S4 | Medium | **SUPER_ADMIN lifecycle is broken.** With exactly one SUPER_ADMIN (the only state the one-time CLI bootstrap can create), no second SUPER_ADMIN can ever be approved (deadlock), and there is no production bootstrap path. One SUPER_ADMIN can revoke another without four-eyes. Pending approvals stay approvable after the requester loses SUPER_ADMIN. | `routes/admin/index.ts` (roles, approvals), `scripts/admin-local-lib.mjs` | PoC `h3-h4-h7-roles-approvals.test.ts` |
| S5 | Medium | **PII reveal can disclose without an audit row.** `writeAudit` swallows errors and the reveal response is still returned. | `routes/admin/index.ts` (`/users/:id`), `routes/admin/audit.ts` | PoC H5 |
| S6 | Medium | **Admin sessions survive customer credential changes** (password reset or change). The session middleware does not re-check `is_verified`. | `routes/admin/auth.ts`, `services/auth-otp.ts` | PoC H6 + code |
| S7 | Medium | **Login throttling is per-IP only.** There is no per-account limit, and the key falls back to the spoofable `X-Forwarded-For`/`X-Real-IP` when `CF-Connecting-IP` is absent. Password mode has no MFA (staging). | `routes/admin/auth.ts`, `middleware/rate-limit.ts` | PoC H9a–c |
| S8 | Low | Search works as an email oracle for `users.read` roles (an exact email gives total=1) and is unaudited. | `routes/admin/people.ts` | PoC H10 |
| S9 | Low | An unknown JWKS `kid` forces a JWKS refetch on every request (amplification). | `routes/admin/access.ts` | PoC `access-verifier.test.ts` |
| S10 | Low | FKs in 0042 (`granted_by`, `revoked_by`, `requested_by`, `decided_by`, `author_user_id`) have no ON DELETE, so they would block a future user deletion. `user_id`/`recipe_id` cascades delete admin history. `admin_sessions` is never purged. | `migrations/0042…sql`, `services/cleanup.ts` | PoC `gate-c-db-writeset.test.ts` + code |
| S11 | Low | A concurrent duplicate SUPER request returns 500 instead of 409. An already-decided approval returns 200. Anonymous `/auth/config` discloses environment and mode. Reads of user detail are unaudited. | `routes/admin/index.ts`, `auth.ts` | code |
| S12 | Info | Pre-existing, outside admin scope: customer auth accepts client `userInfo` and bearer JWTs when `ENVIRONMENT !== 'production'`. This amplifies S1-type misconfiguration. | `routes/auth.ts`, `middleware/auth.ts` | code |

Verified controls (held under PoC): SHA-256-at-rest session/CSRF tokens; HttpOnly `__Host-` session cookie;
CSRF bound to the session; forged headers, bearer tokens, Access headers and customer cookies ignored;
deny-by-default RBAC on every route; self-grant and self-revoke blocked; atomic last-SUPER guard; guarded audits
roll back with their mutation; Access verifier rejects alg none, wrong aud/iss, expired, bad signature and
missing email; production with `ENVIRONMENT=production` fails closed for the API.

## 4. Regression evidence

Environment: Linux 4.19.0-gvisor x86_64, 4 vCPU, Node v24.21.0, pnpm 10.31.0, sqlite3 3.45.1, wrangler 4.149.0,
Playwright 1.63.0 Chromium. Playwright needs `PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright` because the
sandbox default path has no browsers. All gates ran in `/tmp/review/clone` at `3e865d0`.

| Command | Exit | Result |
|---|---|---|
| `pnpm test --reporter=dot --silent` (full suite, 14:17:54Z–14:34:50Z) | 0 | **339/339 files, 7799/7799 tests**, 1015 s |
| `pnpm lint` | 0 | 13 s |
| `pnpm typecheck` | 0 | 30 s, both projects |
| `pnpm build` | 0 | emits `dist/client/admin/index.html` (scripts from `/assets/*` only) |
| `pnpm check:migrations` | 0 | `migration-smoke=ok` |
| `wrangler d1 migrations apply --local` (fresh) | 0 | ledger 42, 7 `admin_*` tables, 2 triggers, 0 FK violations |
| same, upgrade 0001–0041 + seeded rows → 0042 | 0 | ledger 42, pre-existing rows intact, 0 FK violations |
| `pnpm admin:local:reset -- --yes` / `admin:local:seed` / `admin:provision` (local D1) | 0/0/0,2 | seed idempotent; one-time bootstrap; refusals for `--remote`, staging, token |
| `vitest run tests/integration/admin-console.test.ts tests/unit/admin-` | 0 | 7 files / 67 tests |
| `playwright test -c playwright.admin.config.ts` | 0 | 5/5 |
| Review PoCs `vitest run .hoplite/artifacts/review-poc/` | 0 | 7 files / 51 tests (each asserts the defect exists) |

## 5. Admin API authorization matrix (verified)

Every route passes `adminGate` (enabled + host) and then a catch-all 404. Authenticated routes run session →
limiter (120 reads/min, 20 writes/min per admin) → CSRF (non-GET) → `requirePermission`. Denials are audited.
The matrix below was confirmed for 15 GET endpoints × 5 roles (PoC) and 21 endpoints × 6 roles (browser review).

| Endpoint | Permission → roles |
|---|---|
| GET `/auth/config`, POST `/auth/login` | public (login: Origin = APP_URL, 5/min/IP) |
| POST `/auth/logout` | session + CSRF |
| GET `/me`, `/overview`, `/settings` | all roles (`/settings` assignments need `admin.roles.read`: SUPER, AUDITOR) |
| GET `/users`, `/users/:id`, `/households` | SUPER, OPS, SUPPORT, AUDITOR; `?reveal=email` needs SUPER or SUPPORT |
| GET `/billing/*`, `/ai/*`, `/system/status`, `/audit` | SUPER, OPS, AUDITOR |
| GET `/recipes`, `/recipes/summary`, `/recipes/:id` | SUPER, OPS, CONTENT, AUDITOR |
| GET `/sessions`, POST `/sessions/:id/revoke` | SUPER |
| PUT `/preferences` | all roles + CSRF |
| POST `/recipes/:id/reviews` | SUPER, CONTENT + CSRF |
| POST `/roles`, DELETE `/roles/:id`, POST `/approvals/:id/{approve,reject}` | SUPER + CSRF |

## 6. Database migration assessment

- 0042 is additive (7 tables, append-only audit triggers, partial unique indexes, CHECKs, 4 indexes on
  non-payment tables). Replay passes fresh and as an upgrade, under both sqlite3 and wrangler local D1.
- Admin code writes **only** `admin_sessions`, `admin_role_assignments`, `admin_action_approvals`,
  `admin_recipe_editorial_reviews`, `admin_user_preferences`, `admin_audit_events`. This was confirmed with
  write-capture triggers across a full workflow. Admin V1 cannot mutate PayOS/payment, subscription,
  household, recipe or inventory authority.
- Mutations and their audit rows run in one D1 batch. Standalone denial and reveal audits are best-effort (S5).
- Audit history is append-only at the SQL level. There is no tamper-evidence chain: a DB operator can drop triggers.
- Latent FK semantics: S10. No runtime code deletes users or recipes today.

## 7. Frontend E2E assessment

Results come from the Node preview (all 12 screens × 1440/820/390), plus the API under workerd.
- Pass: real data with 0 console errors; navigation and deep links; pagination and every filter
  (observed query params); range selector; empty, loading (3 s delay), error-with-retry, 429, 503 and
  remote-revoke states; reveal dialog (Esc, focus trap); review + simulated 409; grant/revoke; approval by a
  second SUPER; logout; role × route UI matches the matrix for 6 roles; fixture banner on every
  authenticated screen. Axe: 0 violations on 9/11 screens.
- Fail or defect:
  - S2 (entry page served by assets under workerd).
  - Settings overflows horizontally (+444 px at 820, +648 px at 390).
  - Axe serious `scrollable-region-focusable` on the settings tables.
  - Queries other than `/me` and `/auth/config` retry 4xx/429 three times, so errors appear ~7 s late and
    retries burn the rate-limit budget.
  - The preferences "saved" notice unmounts at once.
  - Low: `heading-order` on overview; 4 px sr-only overflow; no reason shown for `ADMIN_UNAUTHENTICATED`;
    focus lost after reveal; audit date filter is UTC without a label.
- Not verified: audit paging (5 events); real idle/absolute expiry in the UI; Safari/Firefox.
  Note: `Secure` cookies on `http://127.0.0.1` work in Chromium only.

## 8. Production integration blockers

1. S1, S2 and S3 must be fixed before any non-local enablement.
2. **The release train is affected by 0042.** `deploy.yml` requires the remote D1 ledger to *equal* the repo
   migrations (`d1-schema-gate.sh remote`, `release-check.mjs schema`). Merging to main blocks every production
   deploy until 0042 is applied through `production-d1-migrate.yml`. After that, redeploying a pre-0042
   release fails the same check. `PRODUCTION_INTEGRATION_PLAN.md` is wrong on two points: the migrate workflow
   accepts any migration (the 0039–0041 list only adds rechecks), and "redeploy previous release" is not a valid rollback.
3. A Cloudflare Access application and policy, verified against a real tenant (only local keys were used).
4. A production SUPER_ADMIN bootstrap procedure with two-person control (S4).
5. A dedicated admin hostname with a matching route and `run_worker_first` (S2/S3).
6. Monitoring: no alerting on `admin.login` failures or denial spikes; audit retention/export is undefined.
7. Runtime `ai_requests` writer if AI metrics are required (currently `partial`).

## 9. Required fixes (ranked)

**P0 — before GitHub publication / merge to main**
1. S1: enable the console and password mode only on positive identification (`ENVIRONMENT === 'development'`
   for password; explicit allow-list otherwise; everything else → 404/unavailable). Add tests for undefined,
   `''`, wrong case and `staging`.
2. S2: add `assets.run_worker_first: ["/admin", "/admin/*"]` to `wrangler.jsonc` and `wrangler.staging.jsonc`
   (or do not ship admin assets until enabled). Add a workerd-level test (`wrangler dev`/Miniflare with
   assets) for `/admin/`, enabled and disabled.
3. Release plan for 0042: correct `PRODUCTION_INTEGRATION_PLAN.md` (allow-list, rollback); agree the
   merge → migrate (approved) → deploy window before merging; decide whether 0042 gets the same extra
   certification as 0039–0041.

**P1 — before staging or any Cloudflare enablement**
4. S3: dedicated `ADMIN_ORIGIN`; admin CSRF/CORS trust only that origin; require an admin host ≠ customer
   host outside development; serve only admin paths on the admin host; keep admin endpoints out of
   customer CORS trust.
5. S4: two-person bootstrap (or an explicit first-additional-SUPER rule); approval for SUPER revocation;
   recheck the requester at approval time; documented production bootstrap.
6. S5: audit before disclosure; fail closed when the audit insert fails.
7. S6: revoke admin sessions on password reset/change and verification/email changes; re-check `is_verified`.
8. S7: per-account limiter; key only on `CF-Connecting-IP` (fail closed if absent outside development).
9. UI: default `retry: retryUnlessClientError`; fix settings responsive overflow and the axe serious violation.

**P2 — hardening and quality**
10. S8–S11; the preferences saved notice and the low UI items in §7.
11. Tooling: `admin:provision --create-account` leaves the account behind when the grant is refused;
    `admin-preview` binds `0.0.0.0` with public fixture credentials (default to `127.0.0.1`); set
    `WRANGLER_SEND_METRICS=false` in admin scripts; refuse logins on a fixture-marked DB outside development;
    the CLI's `CLOUDFLARE_API_TOKEN` guard ignores wrangler OAuth logins.
12. Tests: turn the 51 review PoCs (in `.hoplite/artifacts/review-poc/`, gitignored) into inverted regression
    tests; add axe and tablet coverage to E2E; correct `SECURITY_ASSESSMENT.md` claims invalidated by S2 and S3.

## 10. Gate summary and decision

| Gate | Result |
|---|---|
| A Source integrity | PASS. Repository ID not verifiable offline. |
| B AuthN/AuthZ | **FAIL** (S1, S3, S4–S7) |
| C Database & financial authority | PASS for migration and financial authority; audit integrity needs S5 |
| D Full-stack functionality | **PARTIAL**. Functional flows pass; S2 under workerd; settings responsive and a11y defects. |
| E Full regression | PASS. All commands exit 0; full suite 7799/7799 in a clean worktree. |
| F Deployment readiness | **FAIL**. Plan is inaccurate on migrations/rollback; blockers in §8. |

**`ADMIN_V1_REVIEW_CHANGES_REQUIRED`.** Do not publish, merge, deploy or enable until the P0 items are fixed and
re-reviewed, and the P1 items before any staging or Cloudflare enablement.
