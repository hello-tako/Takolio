# Takosan Admin V1 — Security Remediation R1

**Status: `ADMIN_V1_REMEDIATION_READY_FOR_INDEPENDENT_REVIEW`**

That status means local implementation and local verification are complete. It is **not** an independent
review PASS and **not** production approval. The work was implemented and self-checked by the same
agent/thread that wrote the original code (see §12).

| Item | Value |
|---|---|
| Original implementation (recoverable) | `3e865d009ee62a92ed1d9c8d225a36893035670b`, tag `admin-v1-review-baseline` |
| Review record | `6889f8d` (`docs/admin/reviews/2026-10-12-independent-review.md`) |
| Remediation implementation commit | `25140ba` |
| Evidence/docs commit | the commit that adds this file (see `git log`; a file cannot contain its own hash) |
| Pre-admin customer baseline | `186a9cf05de7c91ed3289e13130feb3b38a264ac` |
| Remote | `origin https://github.com/hello-tako/Tako-san.git`. Nothing was pushed. Repository ID `1385308553` is not verifiable offline. |

Verification labels used below: **LOCAL_VERIFIED** (executed here with evidence), **STAGING_NOT_VERIFIED**,
**PRODUCTION_NOT_VERIFIED**.

## 1. Architecture decision (S2/S3 root cause and the chosen boundary)

The original design mounted the console inside the customer Worker on the customer origin. That single
choice caused S2 (the asset layer answered `/admin/` itself), S3 (admin trust followed `APP_URL`), the
release-train and rollback block (0042 in the customer D1 ledger), and the customer-XSS-to-admin path
(the JS-readable CSRF cookie on the customer origin).

R1 takes the option the remediation brief prefers: **a separate admin deployment boundary**.

- **Admin Worker** `src/worker/admin-worker.ts` + `wrangler.admin.jsonc` (production template, disabled) and
  `wrangler.admin-local.jsonc` (loopback only). `assets.run_worker_first: true` and `not_found_handling: "none"`,
  so every request (document, asset, API) passes the Worker's gate first. Admin assets are built separately
  (`vite.admin.config.ts` → `dist/admin`, all under `/admin/`, no source maps, no customer `public/`).
- **Admin database** `ADMIN_DB` with its own ledger `migrations-admin/0001_admin_console_foundation.sql`.
  Roles, sessions, approvals, audit, editorial notes and preferences live there. The customer DB is bound
  to the admin Worker but wrapped by `readOnlyDatabase()` (single `SELECT`/`WITH` statements only; `batch`/`exec` refused).
- **Customer Worker restored byte-for-byte** to `186a9cf05de7c91ed3289e13130feb3b38a264ac` for `src/worker/index.ts`, `types.ts`,
  `config/csp.ts`, `middleware/rate-limit.ts`, `public/sw.js`, `vite.config.ts`, `wrangler.jsonc`,
  `wrangler.staging.jsonc`, `tests/helpers/sqlite-d1.ts`, `scripts/migration-smoke.sh` and the two auth
  tests (`tests/unit/admin-config.test.ts` asserts this against git). `migrations/0042_*` is withdrawn.
  Customer `pnpm build` now also builds `dist/admin`, but `dist/client` contains no admin file.

ADR: `docs/ai/DECISIONS.md` ADR-ADMIN-002 (supersedes the deployment and storage parts of ADR-ADMIN-001).

## 2. Findings: root cause → fix → evidence

| ID | Root cause | Fix | Evidence | Label |
|---|---|---|---|---|
| **S1** env fail-open | `consoleEnabled`/`resolveAuthMode` defaulted `ENVIRONMENT` to `'development'` and treated anything non-`production` as permissive | `policy.ts#resolveAdminPolicy`: exact allow-list `development|test|staging|production`, else disabled; console needs `ADMIN_CONSOLE_ENABLED === 'true'` everywhere; exact `ADMIN_ORIGIN`; development/test require a loopback origin; staging/production require https, a non-loopback host distinct from `CUSTOMER_APP_URL`; password auth only when `ENVIRONMENT∈{development,test}` **and** loopback **and** compiled with the local-only `__ADMIN_LOCAL_AUTH__` define (absent from `wrangler.admin.jsonc`). No request value is an input. | 26-case decision matrix + HTTP tests (`admin-remediation.test.ts`), workerd scenarios "ENVIRONMENT missing" and "development on a public origin" (28/28 each), dry-run bundle proof | LOCAL_VERIFIED |
| **S2** asset bypass | Customer Worker had `not_found_handling: single-page-application` and compat date 2024-11-01 with no `run_worker_first`; `/admin/` matched a real file in `dist/client/admin/` and was served without invoking the Worker | Separate admin Worker with `run_worker_first: true`; Worker allow-lists exact asset paths (raw, still-encoded pathname) and serves the shell only for safe route shapes; disabled/misconfigured → opaque 404 for every path; customer bundle contains no admin files | Reproduced on `3e865d0` under workerd (`/admin/` 200 ADMIN_SHELL with customer CSP while disabled). Fixed: 28/28 paths × navigate/fetch 404 when disabled; enabled shell carries admin CSP + no-store | LOCAL_VERIFIED |
| **S3** origin/CSRF/cookies | Admin reused `hasTrustedOrigin`/CORS (trust = `APP_URL`), Referer fallback, JS-readable CSRF cookie | Exact `Origin === ADMIN_ORIGIN` (no Referer fallback; `Sec-Fetch-Site` must be `same-origin` when present) + `X-Admin-CSRF` = SHA-256(`takosan-admin-csrf:v1:` + session token), delivered in JSON (login, `GET /me`) and held in memory; single `__Host-` HttpOnly Secure SameSite=Strict host-only session cookie; **no** CORS headers; admin host must differ from the customer host outside development | Customer origin, third-party, `null`, missing Origin, cross-site metadata, forged Host/forwarding, malformed/foreign tokens, cross-origin preflight (integration); workerd: customer-origin login 403, forged Host 404, no CORS | LOCAL_VERIFIED |
| **0042 release/rollback** | Admin migration in the customer ledger; deploy requires remote ledger == repo set | Admin schema moved to `ADMIN_DB`; customer ledger identical to `186a9cf05de7c91ed3289e13130feb3b38a264ac` (same manifest SHA-256) | `admin-migration-matrix.mjs` 11/11 using the repo's own `verifyMigrationLedger`/`migrationManifest`/schema gate (§7) | LOCAL_VERIFIED |
| **S4** governance | One-time single bootstrap; no revocation four-eyes; no requester re-check | Two-person one-time operator bootstrap (both rows in one statement + `bootstrap_completed_at` + trigger); DB trigger keeps ≥ 2 active SUPER_ADMINs; SUPER_ADMIN grant **and** revocation are approval requests; requester/target cannot decide; requester must still be SUPER_ADMIN (else cancelled); guards re-checked inside the D1 batch; decisions final (trigger); target sessions revoked on any role change; duplicates → 409 | Integration "Super Admin governance" (6 tests), admin migration smoke (trigger invariants) | LOCAL_VERIFIED |
| **S5** audit fail-open | `writeAudit` swallowed errors before disclosure | `requireAudit` writes before disclosure and fails closed (`503 ADMIN_AUDIT_UNAVAILABLE`); mutations write audit in the same batch; denials stay best-effort (request already refused) | "PII is not disclosed when the reveal cannot be audited", "mutations without an audit record have no side effects" | LOCAL_VERIFIED |
| **S6** stale sessions | Session never re-checked account state | Session stores `account_id` + SHA-256 credential fingerprint (account id, user, email, password hash, salt, verified, google id); any change, unverification or guest flag revokes all the user's admin sessions (`credential_changed`); auth-mode switch revokes too | 4 credential-change tests + mode-switch test | LOCAL_VERIFIED |
| **S7** brute force | Per-IP only; XFF fallback | Independent global (60/min), per-IP (5/min) and per-account (10/15 min) budgets keyed only on `CF-Connecting-IP` (forwarding headers ignored; absent → shared bucket); KV required outside development/test (503 + `Retry-After`) | rate-limit tests | LOCAL_VERIFIED |
| S8 email oracle | Search matched emails for all `users.read` roles | Email matching only for `users.pii.reveal` holders, audited (`users.search`) before results | integration | LOCAL_VERIFIED |
| S9 JWKS amplification | Unknown `kid` refetched JWKS every request | Forced refresh at most once per 60 s | verifier test (≤ 1 fetch for 5 forged kids) | LOCAL_VERIFIED |
| S10 FK/retention | Cross-table FKs; sessions never purged | Admin DB has no FKs to customer tables; login purges sessions expired > 30 days; role/approval rows are retained history (no-delete triggers) | admin smoke | LOCAL_VERIFIED |
| S11 misc | 500 on concurrent request; decided approval → 200; `/auth/config` disclosed env | Constraint errors → 409; success only for the decision this request made; `/auth/config` returns `{mode}` only | integration | LOCAL_VERIFIED |
| UI P1 | see §9 | | Playwright 12/12 incl. axe + 3-viewport overflow | LOCAL_VERIFIED |

Also fixed during R1: the fixture-marked admin DB is rejected outside development/test
(`503 ADMIN_FIXTURE_DATA_REJECTED`); the admin Worker refuses an unexpected admin schema version
(`503 ADMIN_SCHEMA_MISMATCH`); local tooling binds the preview to `127.0.0.1`, runs wrangler with
`WRANGLER_SEND_METRICS=false`, an empty API token and a throwaway `XDG_CONFIG_HOME` (a stored
`wrangler login` is unreachable); `admin:provision` needs two accounts.

## 3. Configuration decision matrix (server-side only)

`resolveAdminPolicy(env)`; inputs are Worker vars and the compile-time define, never request data.

| ENVIRONMENT | Console flag | ADMIN_ORIGIN | Build | Result |
|---|---|---|---|---|
| missing / `''` / `Production` / ` production` / `dev` | any | any | any | **404 everything** (`environment_invalid`) |
| valid | missing / `TRUE` / `1` / `false` | any | any | 404 (`console_disabled`) |
| valid | `true` | missing / trailing slash / wildcard / credentials | any | 404 (`origin_invalid`) |
| development, test | `true` | non-loopback | any | 404 (`origin_not_local`) |
| development, test | `true` | loopback | local define | enabled, `password` (if `ADMIN_AUTH_MODE=password`) or Access |
| development, test | `true` | loopback | production bundle | enabled, `unavailable` unless Access configured |
| staging, production | `true` | http or loopback | any | 404 (`origin_not_public_https`) |
| staging, production | `true` | https, no `CUSTOMER_APP_URL` | any | 404 (`customer_origin_missing`) |
| staging, production | `true` | same host as customer | any | 404 (`origin_shared_with_customer`) |
| staging, production | `true` | valid | any | `cloudflare_access` if team domain + AUD valid, else `unavailable` (503 for login/session APIs); password never |

## 4. Admin origin / CSP / cookie contract

- Origin: exactly `ADMIN_ORIGIN`; other hosts → 404 before any handler. Host-based routing is availability only;
  authorization is session + role + CSRF (+ Access assertion in production).
- Cookie: `__Host-takosan_admin_session=<64 hex>; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`
  (host-only, no `Domain`). Server stores SHA-256 only. No other admin cookie.
- CSRF: `X-Admin-CSRF` = SHA-256 of a domain-separated session token, returned by login and `GET /me`, held in JS memory
  only, compared in constant time; plus exact `Origin`, plus `Sec-Fetch-Site: same-origin` when sent.
- CORS: none. `Access-Control-*` headers are stripped from every admin response.
- Documents: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';
  connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` (+ `upgrade-insecure-requests`
  on https); API: `default-src 'none'; frame-ancestors 'none'`. All responses: `no-store`, `noindex`, `nosniff`, `DENY`,
  `no-referrer`, COOP/CORP `same-origin`, restrictive Permissions-Policy, HSTS on https.
- Cloudflare Access (production/staging): RS256 against the team JWKS; `aud`, `iss`, `exp`, `nbf` checked on login **and every
  request**; email must equal the session account's email. Tested with locally generated keys only — **not** certified against
  a real Access tenant (PRODUCTION_NOT_VERIFIED).

## 5. Admin API authorization matrix

All `/api/v1/admin/*` routes: surface gate (§3) → API gate (both DBs, admin schema `1`, no fixture outside local) →
public `/auth/config` and `/auth/login`, or session (§2 S6) → per-admin budget (120 reads / 20 writes per min) →
CSRF on non-GET → explicit `requirePermission`. Denials are audited. Unknown paths → 404.

| Endpoint | Permission (roles) | Notes |
|---|---|---|
| GET `/auth/config` | public | `{data:{mode}}` only |
| POST `/auth/login` | public, exact Origin | global/IP/account limits; Access assertion in Access mode |
| POST `/auth/logout` | session + CSRF | |
| GET `/me`, `/overview`, `/settings` | all roles | `/me` returns `csrfToken`; `/settings` assignments/approvals need `admin.roles.read` (SUPER, AUDITOR) |
| GET `/users`, `/households` | SUPER, OPS, SUPPORT, AUDITOR | email search only with `users.pii.reveal`, audited first |
| GET `/users/:id` | same | audited (`users.view`) before response; `?reveal=email` needs SUPER/SUPPORT, 30/h, audited first |
| GET `/billing/*`, `/ai/*`, `/system/status`, `/audit` | SUPER, OPS, AUDITOR | read-only customer DB |
| GET `/recipes*` | SUPER, OPS, CONTENT, AUDITOR | |
| GET `/sessions`, POST `/sessions/:id/revoke` | SUPER | |
| PUT `/preferences` | all roles | |
| POST `/recipes/:id/reviews` | SUPER, CONTENT | writes admin ledger only; stale version → 409 |
| POST `/roles` | SUPER | self → 403; SUPER_ADMIN → 201 approval; others immediate + target sessions revoked |
| DELETE `/roles/:id` | SUPER | self → 403; SUPER_ADMIN → 201 approval (409 if it would leave < 2); others immediate |
| POST `/approvals/:id/{approve,reject}` | SUPER | requester/target → 403; requester no longer SUPER → cancelled + 409; re-validated in batch |

Matrix tests: 5 roles × 15 reads (integration) and the original reviewer's matrix PoC (still passing, §8).

## 6. Cloudflare static-asset routing evidence (real workerd, `wrangler dev --local`)

`scripts/admin-workerd-check.mjs`; reports in `evidence/workerd-*.json`. Telemetry off, no token, throwaway config home.

| Scenario | Result |
|---|---|
| **Baseline `3e865d0`**, customer Worker, console disabled | **Reproduced S2**: navigate `/admin/` → 200 admin shell with the customer CSP; `/admin/users` → 404 (Worker ran); API → 404 |
| Admin Worker, production template (flag false) | 14 paths × navigate/fetch (incl. `/admin/`, `/admin/index.html`, deep links, assets, `/%61dmin/`, `/admin%2F`, `//admin/`, `/ADMIN/`, API) → all 404, no admin content |
| Admin Worker, `ENVIRONMENT` missing (local build, flag true) | same 28/28 → 404 |
| Admin Worker, development on a public origin | same 28/28 → 404 |
| Admin Worker enabled on loopback | shell + deep link 200 with admin CSP/no-store; `/admin/index.html` → redirect; asset 200 no-store; `/assets/...`, `/admin/%61ssets/...`, encoded traversal → 404; config `{mode}` only; customer-origin login 403; forged Host 404; one `__Host-` cookie; CSRF enforced; no CORS (15/15) |
| Customer Worker from the R1 tree | `/admin/` and `/admin/users` serve the customer SPA shell, never the admin shell; admin API not answered by admin code; admin bundle not served; `dist/client` has no admin files (5/5) |
| `wrangler deploy --dry-run` (no upload) | production bundle keeps `typeof __ADMIN_LOCAL_AUTH__` guard (evaluates false); local bundle substitutes it; no fixture credential in either bundle |

Service worker: the customer `public/sw.js` is back to baseline and is never served by the admin Worker
(`/sw.js` → 404 on the admin host), so no customer SW can control or cache admin documents. Admin responses are `no-store`.

## 7. Migration and rollback matrix

`scripts/admin-migration-matrix.mjs` (local Wrangler D1 + the repository's release gates). `evidence/migration-matrix.json`: **11/11**.

| Scenario | Outcome |
|---|---|
| Customer ledger identity | HEAD `migrations/` manifest SHA-256 == `186a9cf05de7c91ed3289e13130feb3b38a264ac` (41 files) |
| DB 0041 + old application | deploy ledger gate passes |
| DB 0041 + new application (R1) | deploy ledger gate and read-only schema gate pass — customer release train unchanged |
| DB 0041 + original `3e865d0` | gate fails (reproduces the review's release-train block) |
| DB with original 0042 + old application | gate fails (reproduces the rollback defect) |
| DB with original 0042 + R1 | rejected as forward drift — R1 never needs 0042 |
| Unexpected extra customer migration | both gates reject (no bypass added) |
| Admin DB fresh apply + re-apply | ledger 1, `schema_version` 1, 9 triggers; re-apply no-op |
| Failed admin migration | apply fails, ledger empty, no partial schema; admin Worker answers 503 `ADMIN_SCHEMA_MISMATCH` (integration test) |
| Customer rollback with admin schema present | unaffected (separate database) |
| Failed admin application deployment | separate Worker script: the customer Worker is untouched; an admin Worker whose schema version differs fails closed (503). Simulated at the API gate, not by a real deploy |

Recovery for "ledger no longer matches": no customer database needs it, because 0042 never left this
workspace (`3e865d0` was not pushed by this work; remote D1 state itself was not inspected — no remote access).
Local `.wrangler` states that applied the old 0042 are rebuilt with `pnpm admin:local:reset -- --yes`.
No general schema-gate bypass was introduced; workflows are unchanged.

## 8. Original review PoCs (51) rerun

Run unchanged through an adapter (`evidence/poc-adapter/harness.ts`) that maps the legacy env model to the new one.

- Baseline `3e865d0`: **51/51 pass** (each defect PoC asserts the defect) — `evidence/poc-baseline-3e865d0.log`.
- R1: **22 pass / 29 fail** — `evidence/poc-original-vs-remediated.*`.
  - 21 of 23 defect-asserting PoCs now **fail** (defect gone).
  - `H9a` still passes because it makes exactly 10 attempts; the new per-account budget is 10 / 15 min and the
    11th attempt is 429 (`admin-remediation.test.ts` rate-limit test).
  - "latent: SUPER_ADMIN cannot be deleted (FK)" still passes because of the **pre-existing** customer FK
    `households.created_by REFERENCES users(id)` (fixture users own households); the admin DB has no FK to `users`.
  - 8 control PoCs fail only because their expectations encode the old contract: CSRF cookie parsing (2 Access PoCs),
    Referer fallback (removed), development on a non-loopback origin (now 404), production with a loopback origin
    (now 404 instead of 503), opaque `Not Found` text instead of JSON on foreign hosts, and `DELETE` of a SUPER_ADMIN
    now returning 201 (approval) instead of 200. The security property each control protected is covered by new tests.

## 9. Frontend / API behaviour (P1)

Memory-only CSRF (from login and `/me`, cleared on any 401); typed `Retry-After`; retry policy — never 4xx except
429; 429/503 once only with `Retry-After` ≤ 10 s (waits exactly that); other failures twice with 1 s/2 s backoff;
mutations never retried; session reasons `expired|revoked|ended|access`; error boundary around routed content;
permission-denied names the missing permission; four-eyes UX (approval notices, kind column, actions hidden for
requester/target, SUPER revocation disabled at the minimum); preferences confirmation persists; reveal focuses the
email; audit dates labelled UTC; Settings overflow root cause — absolutely positioned `sr-only` cell text escaped
the non-positioned `.table-wrap` scroll clip (fixed with `position: relative`); all scrollable tables are focusable
labelled regions.

Playwright (Chromium, real admin Worker over `dist/admin`): **12/12**. axe (WCAG 2.0/2.1 A/AA) on login + 10
screens: **0 violations of any impact** (`evidence/axe-report.json`). Horizontal overflow at 1440/820/390 px:
**0 px on all 10 screens** (`evidence/overflow-*.json`).

## 10. Regression summary

See `REGRESSION.md` (exact commands, environment, exit codes).

## 11. File manifest (`6889f8d..25140ba`)

Reverted to `186a9cf05de7c91ed3289e13130feb3b38a264ac`: `src/worker/index.ts`, `src/worker/types.ts`, `src/worker/config/csp.ts`,
`src/worker/middleware/rate-limit.ts`, `public/sw.js`, `tests/helpers/sqlite-d1.ts`, `scripts/migration-smoke.sh`,
`tests/integration/auth-hardening.test.ts`, `tests/integration/auth-otp-coordinator.test.ts`; `vite.config.ts` (already).
Deleted: `migrations/0042_admin_console_foundation.sql`.
Added: `src/worker/admin-worker.ts`; `src/worker/routes/admin/{env,policy,readonly-db,limits,headers}.ts`;
`migrations-admin/0001_admin_console_foundation.sql`; `wrangler.admin.jsonc`, `wrangler.admin-local.jsonc`;
`vite.admin.config.ts`; `src/admin/{api/retry.ts,components/ErrorBoundary.tsx,styles/fonts.css}`;
`scripts/admin-{migration-smoke.sh,workerd-check.mjs,migration-matrix.mjs}`;
`tests/helpers/{admin-harness.ts,admin-worker-fetch.mjs,admin-worker-fetch.d.mts}`;
`tests/integration/admin-remediation.test.ts`; `tests/unit/{admin-config.test.ts,admin-remediation-ui.test.tsx}`;
`tests/e2e/admin-a11y-responsive.e2e.ts`.
Modified: `src/shared/admin.ts`; all `src/worker/routes/admin/*`; `src/admin/**` (client, hooks, session, ui, pages,
i18n, styles); `admin/index.html`; `package.json` (scripts only); `scripts/admin-{local-lib.mjs,local-lib.d.mts,provision.mjs,local-d1.mjs,preview.mjs}`;
`tests/integration/admin-console.test.ts`; `tests/unit/{admin-api-client,admin-local-tooling}.test.ts`;
`tests/e2e/admin-console.e2e.ts`; `docs/admin/screenshots/*` (regenerated by E2E).
Protected paths (payment/PayOS/billing/checkout code, `.github/workflows`, existing migrations): **unchanged**.

## 12. Remaining limitations and open items

1. **Not independent.** Same agent and thread implemented and verified R1. A separate reviewer must re-run §6–§10.
2. **Cloudflare Access** verified only with local keys (PRODUCTION_NOT_VERIFIED, STAGING_NOT_VERIFIED).
3. **Production bootstrap procedure** (two named operators, reviewed SQL through a protected path) and a protected
   `ADMIN_DB` migration workflow are designed (integration plan) but not built; `.github/workflows` were not changed.
4. **Placeholders** in `wrangler.admin.jsonc`: all-zero `ADMIN_DB` and KV ids, empty origin/Access values; no route.
5. `readOnlyDatabase()` is a code-level guard; D1 has no read-only binding, so a compromise of the admin Worker
   process could still write the customer DB through the raw binding.
6. Audit log is append-only by trigger, not tamper-evident (an operator with D1 access can drop triggers).
7. KV-based limits are not atomic (abuse control, not exact quotas).
8. `ai_requests` still has no runtime writer (AI metrics `partial`).
9. Browser coverage: Chromium only. Staging and production behaviour not verified.
