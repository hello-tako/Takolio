# Admin Console V1 — migration and compatibility report

> **Status:** Superseded by `remediation-r1/REPORT.md` §7 (R1). Migration 0042 described below was withdrawn: admin tables now live in a separate `ADMIN_DB` (`migrations-admin/`), and the customer ledger is identical to `186a9cf`.

## Migration `0042_admin_console_foundation.sql` (additive)

New tables: `admin_role_assignments`, `admin_sessions`, `admin_audit_events` (append-only triggers),
`admin_action_approvals`, `admin_recipe_editorial_reviews`, `admin_user_preferences`,
`admin_config_metadata`. New indexes on existing non-payment tables: `users(created_at)`,
`sessions_v2(last_seen_at)`, `ai_requests(created_at)`, `ai_requests(task, created_at)` (all `IF NOT EXISTS`).

No historical migration was edited. No existing row is changed. Payment, entitlement, recipe, household
and inventory tables get no new columns or triggers. Payment tables were left without new indexes on
purpose (protected area). Billing aggregates are bounded by date filters and `LIMIT`s.

## Replay evidence (local only)

| Check | Result |
|---|---|
| `pnpm check:migrations` (sqlite3 in-memory, full ledger + 0042 assertions: unchanged users/payments, 7 tables, 2 triggers, FK + integrity) | `migration-smoke=ok` |
| `wrangler d1 migrations apply frigo-db --local` on a **fresh** Miniflare D1 | 0001–0042 applied; 7 `admin_*` tables present |
| Upgrade fixture: local Miniflare D1 previously migrated through 0041, then 0042 applied | applied ✅ |
| SQLite test harness (`SqliteD1`) replays all 42 migrations for every integration test | 30/30 admin integration tests pass on it |
| Synthetic fixture applies with `PRAGMA foreign_keys=ON` and zero FK violations | unit test |

## Test-side ledger updates (justified)

- `tests/helpers/sqlite-d1.ts` `MIGRATION_LEDGER.postCatalog` now includes `0042_admin_console_foundation.sql`.
  This is the single place the local ledger shape is declared; tests derived from it now expect 42 files.
- `scripts/migration-smoke.sh` replays 0042 with assertions.
- `tests/fixtures/migration-sha256.json` is **not** changed. The repository rule pins a hash only after merge
  and production apply.
- Production workflows (`production-d1-migrate.yml` allow-list) are **not** changed. That needs a reviewed
  release PR (see the integration plan).

## Application compatibility

- Customer API: unchanged routing and auth; admin router mounted before it handles only `/api/v1/admin/*`.
  Integration test confirms `/api/v1/me` still returns the customer `UNAUTHORIZED` contract.
- Customer HTML/CSP: unchanged for every non-`/admin` path (integration test asserts the customer CSP still
  includes Google/Turnstile origins).
- Build: Vite now has two inputs, `index` (unchanged name, so the customer chunk stays `index-*.js`) and
  `admin`. `dist/client/admin/index.html` is new.
- Service worker: only change is to skip `/admin` and `/admin/*`.
- Rate limiter: new optional `key` callback; existing call sites unchanged.
- Production default: the console stays off (404) until explicitly enabled and Access-configured.
