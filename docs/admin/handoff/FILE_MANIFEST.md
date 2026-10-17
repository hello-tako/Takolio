# File manifest — Admin-related files at `HEAD` (handoff)

Counts and commit attribution were computed with `git log --diff-filter=A` (first introduction) and `git log -1` (last touch) for every tracked path matching `admin`, case-insensitive. **232 paths.** The introducing-commit tables below are generated from git; the purposes are written by hand.

## 1. Significant components

Generated at `45cbec8` (before the handoff documentation commits).

| Path | Purpose | Introduced in | Last touched in |
|---|---|---|---|
| `migrations-admin/0001_admin_console_foundation.sql` | ADMIN_DB schema: 7 tables, 9 triggers, schema version row | `3e865d0` | `25140ba` |
| `wrangler.admin.jsonc` | Admin Worker config. `DB` binds the customer database (F1); `ADMIN_DB` and KV use placeholder IDs; no route; `workers_dev: false` | `25140ba` | `25140ba` |
| `wrangler.admin-local.jsonc` | Local-only config with `__ADMIN_LOCAL_AUTH__`; never deploy | `25140ba` | `25140ba` |
| `vite.admin.config.ts` | Admin SPA build to `dist/admin` | `25140ba` | `25140ba` |
| `playwright.admin.config.ts` | Playwright configuration for admin E2E | `3e865d0` | `3e865d0` |
| `src/worker/admin-worker.ts` | Admin Worker entry: host and origin gate, asset routing (`STATIC_FILE`, `SHELL_ROUTE`), API dispatch (F10) | `25140ba` | `25140ba` |
| `src/shared/admin.ts` | Shared contract: permission matrix, roles, response types | `3e865d0` | `25140ba` |
| `src/worker/routes/admin/index.ts` | Admin API: 21 authenticated routes, each with `requirePermission`; roles, approvals, PII reveal | `3e865d0` | `25140ba` |
| `src/worker/routes/admin/auth.ts` | Login (Access and local password), logout, session check, credential fingerprint, login budgets (F1, F6, F11) | `3e865d0` | `25140ba` |
| `src/worker/routes/admin/access.ts` | Cloudflare Access JWT verifier: RS256, JWKS cache and refresh throttle, audience, issuer, time claims | `3e865d0` | `25140ba` |
| `src/worker/routes/admin/policy.ts` | Environment and auth-mode policy: exact allow-list, fail closed (S1) | `25140ba` | `25140ba` |
| `src/worker/routes/admin/readonly-db.ts` | SELECT-only wrapper over the customer D1 binding; code-level guard only (F1) | `25140ba` | `25140ba` |
| `src/worker/routes/admin/limits.ts` | `consumeLimit`: global, IP and account budgets | `25140ba` | `25140ba` |
| `src/worker/routes/admin/headers.ts` | API CSP and admin document CSP | `25140ba` | `25140ba` |
| `src/worker/routes/admin/http.ts` | Principal and Hono variable types for admin routes | `3e865d0` | `25140ba` |
| `src/worker/routes/admin/env.ts` | Typed `AdminEnv` bindings | `25140ba` | `25140ba` |
| `src/worker/routes/admin/audit.ts` | Audit event construction and writes (`requireAudit` fails closed) | `3e865d0` | `25140ba` |
| `src/worker/routes/admin/schemas.ts` | Request validation: pagination, ranges, identifiers (F10) | `3e865d0` | `3e865d0` |
| `src/worker/routes/admin/mask.ts` | Default masking for email and order codes | `3e865d0` | `3e865d0` |
| `src/worker/routes/admin/people.ts` | Users, households and email search (search audited); aggregates (F7) | `3e865d0` | `25140ba` |
| `src/worker/routes/admin/billing-ai.ts` | Billing summary and transactions; AI usage aggregates (F7) | `3e865d0` | `25140ba` |
| `src/worker/routes/admin/recipes.ts` | Recipe list and detail; editorial review actions | `3e865d0` | `25140ba` |
| `src/worker/routes/admin/overview.ts` | Overview aggregates over customer tables (F7) | `3e865d0` | `25140ba` |
| `src/worker/routes/admin/system.ts` | System status view | `3e865d0` | `25140ba` |
| `src/worker/routes/admin/settings.ts` | Preferences, approvals list, audit view | `3e865d0` | `25140ba` |
| `scripts/admin-local-lib.mjs` | Bootstrap SQL builder (F3, F5) and local fixture constants | `3e865d0` | `25140ba` |
| `scripts/admin-local-d1.mjs` | Local D1 seed and reset with refusal guards (`--remote` refused; reset requires `--yes`) | `3e865d0` | `25140ba` |
| `scripts/admin-provision.mjs` | Local account provisioning; refuses outside development, in CI, with remote flags or a Cloudflare token | `3e865d0` | `25140ba` |
| `scripts/admin-preview.mjs` | In-memory preview server with synthetic fixture (Option A) | `3e865d0` | `25140ba` |
| `scripts/admin-workerd-check.mjs` | Real workerd checks (108 assertions in 6 scenarios) | `25140ba` | `25140ba` |
| `scripts/admin-migration-matrix.mjs` | Migration and rollback matrix; pinned to the 41-file customer ledger | `25140ba` | `25140ba` |
| `scripts/admin-migration-smoke.sh` | Admin schema smoke: trigger invariants and idempotent apply | `25140ba` | `25140ba` |
| `tests/integration/admin-console.test.ts` | Integration tests for the console API | `3e865d0` | `25140ba` |
| `tests/integration/admin-remediation.test.ts` | Integration tests for R1 controls (environment, origin, governance) | `25140ba` | `25140ba` |
| `tests/e2e/admin-console.e2e.ts` | Playwright journeys across screens; writes tracked screenshots (F9) | `3e865d0` | `25140ba` |
| `tests/e2e/admin-a11y-responsive.e2e.ts` | axe, overflow and keyboard scroll checks (F8) | `25140ba` | `25140ba` |
| `tests/helpers/admin-harness.ts` | Shared admin test harness: databases, sessions, local and production environments | `25140ba` | `25140ba` |
| `tests/helpers/admin-worker-fetch.mjs` | Helper for calling the admin Worker in tests | `25140ba` | `25140ba` |
| `docs/admin/README.md` | Admin delivery index and status | `3e865d0` | `0331cc9` |
| `docs/admin/LOCAL_SETUP.md` | Local setup and command reference | `3e865d0` | `0331cc9` |
| `docs/admin/API_REFERENCE.md` | API transport and endpoint reference | `3e865d0` | `0331cc9` |
| `docs/admin/RBAC_MATRIX.md` | Permission matrix generated from `src/shared/admin.ts` | `3e865d0` | `0331cc9` |
| `docs/admin/ARCHITECTURE_MAP.md` | Architecture map (stale: line 38 names withdrawn `0042`) | `3e865d0` | `0331cc9` |
| `docs/admin/MIGRATION_COMPATIBILITY.md` | Migration compatibility (superseded by R1 report §7) | `3e865d0` | `0331cc9` |
| `docs/admin/PRODUCTION_INTEGRATION_PLAN.md` | Production integration plan (not executed) | `3e865d0` | `0331cc9` |
| `docs/admin/remediation-r1/REPORT.md` | R1 remediation report: root causes, fixes, evidence, limitations | `0331cc9` | `0331cc9` |
| `docs/admin/reviews/2026-10-12-independent-review.md` | First review (CHANGES_REQUIRED) with S1–S12 | `6889f8d` | `6889f8d` |
| `docs/admin/reviews/2026-10-14-r1-certification.md` | R1 certification review (CHANGES_REQUIRED), with erratum | `95a1425` | `95a1425` |

## 2. Customer-adjacent paths (must equal `186a9cf` unless listed)

| Path | Status at HEAD vs `186a9cf` | Why it was touched | Restored by |
|---|---|---|---|
| `src/worker/index.ts` | identical | `3e865d0` edited; `25140ba` restored | `25140ba` |
| `src/worker/types.ts` | identical | `3e865d0` edited; `25140ba` restored | `25140ba` |
| `src/worker/config/csp.ts` | identical | `3e865d0` edited; `25140ba` restored | `25140ba` |
| `src/worker/middleware/rate-limit.ts` | identical | `3e865d0` edited; `25140ba` restored | `25140ba` |
| `public/sw.js` | identical | `3e865d0` edited; `25140ba` restored | `25140ba` |
| `scripts/migration-smoke.sh` | identical | `3e865d0` edited; `25140ba` restored | `25140ba` |
| `tests/helpers/sqlite-d1.ts` | identical | `3e865d0` edited; `25140ba` restored | `25140ba` |
| `tests/integration/auth-hardening.test.ts`, `auth-otp-coordinator.test.ts` | identical | `3e865d0` edited; `25140ba` restored | `25140ba` |
| `vite.config.ts` | identical | `3e865d0` added `adminSpaFallback`; `6889f8d` removed it (documented as docs-only) | `6889f8d` |
| `migrations/` (41 files) | identical | customer ledger; admin schema moved to `migrations-admin/` | `25140ba` |
| `wrangler.jsonc`, `wrangler.staging.jsonc`, `.github/` | identical | customer deployment | — |
| `index.html` | identical | customer entry | — |
| `package.json` | **differs**: +12/−3 | admin scripts (`build:admin`, `admin:*`, `test:admin:e2e`); `build` now also runs the admin build; `check:migrations` also runs the admin smoke | `3e865d0`, `25140ba` |
| `tsconfig.json` | **differs**: +1 | `src/admin` added to the include list | `3e865d0` |
| `HANDOFF.md`, `TASK_BOARD.md`, `docs/ai/CURRENT_STATE.md`, `docs/ai/DECISIONS.md` | docs, not runtime | status blocks edited by `3e865d0`, `0331cc9`, `95a1425`, and this handoff | — |

## 3. Workflow triggers (checked in this handoff with the repository's `js-yaml`)

| Workflow | Triggers | Jobs that can touch external systems | Relevant to this branch |
|---|---|---|---|
| `ci.yml` | `push` on `main`, `master`, `codex/security-hardening-sync`; `pull_request` to `main`, `master` | `validate` (no secrets referenced; no environment) | a push to this branch does **not** trigger it; a draft PR to `main` does (validation only) |
| `deploy.yml` | `workflow_dispatch` only (main guard; production requires confirmation input) | `staging`, `production` environments with Cloudflare secrets | cannot be triggered by a branch push |
| `production-catalog-recovery.yml` | `push` on `main` only; `workflow_dispatch` | `recover` in `production` | not triggered by this branch |
| `production-certify.yml`, `production-d1-*.yml`, `staging-*.yml`, `t20-staging-fixture.yml` | `workflow_dispatch` only, each with a `main` guard and a confirm input | Cloudflare secrets, D1 operations | not triggered by a branch push |

No workflow references `wrangler.admin*.jsonc`, `admin-*` scripts or `src/admin`.

## 4. Directory summary (all 232 admin-related tracked paths)

Counts at `45cbec8`, before the handoff documentation commits.

| Directory or file | Count | Introduced in (count) | Last touched in (count) |
|---|---|---|---|
| `docs/admin/reviews` | 95 | `45cbec8` 67, `95a1425` 19, `0331cc9` 7, `5ad7819` 1, `6889f8d` 1 | `45cbec8` 72, `95a1425` 22, `6889f8d` 1 |
| `src/admin` | 32 | `3e865d0` 29, `25140ba` 2, `d35f4a6` 1 | `25140ba` 22, `3e865d0` 10 |
| `docs/admin/remediation-r1` | 26 | `0331cc9` 19, `45cbec8` 5, `3e865d0` 1, `5ad7819` 1 | `0331cc9` 20, `45cbec8` 6 |
| `src/worker` | 19 | `3e865d0` 13, `25140ba` 6 | `25140ba` 17, `3e865d0` 2 |
| `docs/admin/screenshots` | 16 | `3e865d0` 15, `25140ba` 1 | `25140ba` 13, `3e865d0` 3 |
| `tests/unit` | 8 | `3e865d0` 6, `25140ba` 2 | `25140ba` 4, `3e865d0` 4 |
| `docs/admin/handoff` | 6 | `45cbec8` 6 | `45cbec8` 6 |
| `tests/helpers` | 3 | `25140ba` 3 | `25140ba` 3 |
| `tests/e2e` | 2 | `25140ba` 1, `3e865d0` 1 | `25140ba` 2 |
| `tests/integration` | 2 | `25140ba` 1, `3e865d0` 1 | `25140ba` 2 |
| `admin/index.html` | 1 | `3e865d0` 1 | `25140ba` 1 |
| `docs/admin/API_REFERENCE.md` | 1 | `3e865d0` 1 | `0331cc9` 1 |
| `docs/admin/ARCHITECTURE_MAP.md` | 1 | `3e865d0` 1 | `0331cc9` 1 |
| `docs/admin/LOCAL_SETUP.md` | 1 | `3e865d0` 1 | `0331cc9` 1 |
| `docs/admin/MIGRATION_COMPATIBILITY.md` | 1 | `3e865d0` 1 | `0331cc9` 1 |
| `docs/admin/PRODUCTION_INTEGRATION_PLAN.md` | 1 | `3e865d0` 1 | `0331cc9` 1 |
| `docs/admin/RBAC_MATRIX.md` | 1 | `3e865d0` 1 | `0331cc9` 1 |
| `docs/admin/README.md` | 1 | `3e865d0` 1 | `0331cc9` 1 |
| `docs/admin/SECURITY_ASSESSMENT.md` | 1 | `3e865d0` 1 | `0331cc9` 1 |
| `migrations-admin/0001_admin_console_foundation.sql` | 1 | `3e865d0` 1 | `25140ba` 1 |
| `playwright.admin.config.ts` | 1 | `3e865d0` 1 | `3e865d0` 1 |
| `scripts/admin-local-d1.mjs` | 1 | `3e865d0` 1 | `25140ba` 1 |
| `scripts/admin-local-lib.d.mts` | 1 | `3e865d0` 1 | `25140ba` 1 |
| `scripts/admin-local-lib.mjs` | 1 | `3e865d0` 1 | `25140ba` 1 |
| `scripts/admin-migration-matrix.mjs` | 1 | `25140ba` 1 | `25140ba` 1 |
| `scripts/admin-migration-smoke.sh` | 1 | `25140ba` 1 | `25140ba` 1 |
| `scripts/admin-preview.mjs` | 1 | `3e865d0` 1 | `25140ba` 1 |
| `scripts/admin-provision.mjs` | 1 | `3e865d0` 1 | `25140ba` 1 |
| `scripts/admin-workerd-check.mjs` | 1 | `25140ba` 1 | `25140ba` 1 |
| `src/shared` | 1 | `3e865d0` 1 | `25140ba` 1 |
| `vite.admin.config.ts` | 1 | `25140ba` 1 | `25140ba` 1 |
| `wrangler.admin-local.jsonc` | 1 | `25140ba` 1 | `25140ba` 1 |
| `wrangler.admin.jsonc` | 1 | `25140ba` 1 | `25140ba` 1 |

## 5. Manual inspection notes

- Files under `docs/` contain no secrets (see TEST_AND_EVIDENCE §1, secret scan).
- `tests/e2e/admin-console.e2e.ts` writes to `docs/admin/screenshots` (F9).
- `src/worker/admin-worker.ts` defines `STATIC_FILE` and `SHELL_ROUTE` (F10).
