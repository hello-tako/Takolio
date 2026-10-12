# Admin Console V1 — local setup

Everything here is local. No command below contacts Cloudflare or GitHub.

## Prerequisites

Node ≥ 22.13 (verified with 24), pnpm 10, `sqlite3` CLI, and `pnpm install --frozen-lockfile`.
For E2E only: `pnpm exec playwright install chromium`.

## Option A — isolated preview (fastest; used by E2E)

```sh
pnpm build:web
pnpm admin:preview            # http://127.0.0.1:8790/admin/
```

The real Worker (`src/worker/index.ts`) serves both the API and the built admin frontend through an
emulated `ASSETS` binding over `dist/client`. Data lives in in-memory SQLite: the full migration
ledger plus the deterministic synthetic fixture `synthetic-admin-v1` (every screen shows a
"Dữ liệu tổng hợp" banner). `POST /__admin-preview/reset` restores the fixture; it exists only in
this Node preview, not in the Worker. External network is disabled.

Fixture accounts (password `Local-Fixture-Only-2026!`, local fixture only):

| Email | Role |
|---|---|
| `super@fixture.takosan.test` | SUPER_ADMIN (bootstrap) |
| `super2@fixture.takosan.test` | SUPER_ADMIN (second approver) |
| `ops@fixture.takosan.test` | OPERATIONS_ADMIN |
| `content@fixture.takosan.test` | CONTENT_EDITOR |
| `support@fixture.takosan.test` | SUPPORT_AGENT |
| `auditor@fixture.takosan.test` | READ_ONLY_AUDITOR |
| `revoked@fixture.takosan.test` | revoked role → denied |
| `owner@fixture.takosan.test` | household owner, no platform role → denied |

## Option B — wrangler dev against local D1 (Miniflare)

```sh
pnpm admin:local:reset -- --yes   # wipe .wrangler/state D1, apply migrations, seed fixture
pnpm build:web
pnpm dev:worker                    # wrangler dev, ENVIRONMENT=development, local bindings
pnpm dev:web                       # Vite :5173 proxies /api → :8787; open http://localhost:5173/admin/
```

To bootstrap a real local account instead of the fixture (one-time; refuses if an active
SUPER_ADMIN exists, outside `ENVIRONMENT=development`, in CI, with `--remote`/`--env`, or when
`CLOUDFLARE_API_TOKEN` is set):

```sh
pnpm admin:provision -- --local --email you@example.test --create-account --password '<12+ chars>' --name 'You'
# or for an existing verified local account:
pnpm admin:provision -- --local --email you@example.test
```

## Tests

```sh
pnpm exec vitest run tests/integration/admin-* tests/unit/admin-*   # backend security + frontend + tooling
pnpm test:admin:e2e                                                 # build + Playwright against admin-preview
pnpm check                                                          # repository gate (lint, types, tests, migrations, build)
```

E2E screenshots are written to `docs/admin/screenshots/`.
