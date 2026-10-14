# Admin Console V1 — local setup (R1)

Everything here is local. Local tooling runs wrangler with `WRANGLER_SEND_METRICS=false`, an empty
`CLOUDFLARE_API_TOKEN` and a throwaway config home, so a stored `wrangler login` is never used.

## Prerequisites

Node ≥ 22.13 (verified with 24), pnpm 10, `sqlite3` CLI, `pnpm install --frozen-lockfile`.
For E2E: `pnpm exec playwright install chromium` (if the sandbox sets another `PLAYWRIGHT_BROWSERS_PATH`,
point it at the installed browsers).

## Option A — isolated preview (used by E2E)

```sh
pnpm build:admin              # dist/admin (admin bundle only)
pnpm admin:preview            # http://127.0.0.1:8790/admin/  (loopback only)
```

The real admin Worker serves documents, assets and API on one origin. Both databases are in-memory SQLite:
customer migrations + `migrations-admin` + the deterministic synthetic fixture (`synthetic-admin-v1`; every screen
shows the "Dữ liệu tổng hợp" banner). `POST /__admin-preview/reset` restores the fixture (preview only).

Fixture accounts (password `Local-Fixture-Only-2026!`, local fixture only):

| Email | Role |
|---|---|
| `super@fixture.takosan.test`, `super2@fixture.takosan.test` | SUPER_ADMIN (two-person bootstrap) |
| `ops@…`, `content@…`, `support@…`, `auditor@…` | OPERATIONS_ADMIN, CONTENT_EDITOR, SUPPORT_AGENT, READ_ONLY_AUDITOR |
| `revoked@…` | revoked role → denied |
| `owner@…` | household owner, no platform role → denied |

## Option B — real workerd (`wrangler dev --local`)

```sh
pnpm admin:local:reset -- --yes   # local frigo-db + takosan-admin-db: migrations + fixture
pnpm build:admin
pnpm admin:dev                    # wrangler dev -c wrangler.admin-local.jsonc on http://127.0.0.1:8799/admin/
```

`wrangler.admin-local.jsonc` is the only config that compiles the local password login (`__ADMIN_LOCAL_AUTH__`)
and it binds `ADMIN_ORIGIN` to loopback. Never deploy it.

Bootstrap two real local accounts instead of the fixture (one-time; refuses outside `ENVIRONMENT=development`,
in CI, with `--remote/--env`, or when `CLOUDFLARE_API_TOKEN` is set):

```sh
pnpm admin:provision -- --local --create-accounts --password '<12+ chars>' --email a@example.test --email b@example.test
```

## Checks

```sh
pnpm check:migrations                         # customer smoke + admin smoke (trigger invariants)
pnpm exec vitest run tests/integration/admin- tests/unit/admin-
pnpm test:admin:e2e                           # build:admin + Playwright (12 tests incl. axe + 3 viewports)
pnpm admin:workerd:check                      # real workerd routing evidence (needs pnpm build)
pnpm admin:migration:matrix                   # offline migration/rollback matrix against committed HEAD
```
