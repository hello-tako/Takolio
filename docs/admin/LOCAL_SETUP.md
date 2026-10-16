# Admin Console V1 - local R2 setup

Local tools use synthetic .test identities. They never authorize a real staging
or production operator. Prerequisites: Node >=22.13 (local evidence uses 24.19),
pnpm 10, sqlite3, installed frozen dependencies, and Playwright Chromium.

## Built frontend and SQLite preview

```sh
pnpm build:admin
pnpm admin:preview
```

Open http://127.0.0.1:8790/admin/ . The real Admin Worker serves built HTML,
assets and API over loopback with in-memory SQLite, current customer/Admin
migrations and synthetic-admin-v1 fixture. Fixture SUPER_ADMIN identities are
super, super2 and super3 at fixture.takosan.test. Local fixture password is
Local-Fixture-Only-2026! . Other fixture roles are ops/content/support/auditor.
A household owner or revoked identity cannot sign in as an Admin. Every page
labels synthetic data. No actual production numbers are shown.

## Local workerd topology

```sh
pnpm admin:local:reset -- --yes
pnpm build:admin
pnpm admin:dev
```

This creates/replaces only local D1 state, replays customer and separate Admin
migrations, and seeds fixed synthetic fixtures. Admin + Facade Workers are
started with restricted service binding on loopback. Telemetry is disabled,
Cloudflare API credentials are blanked for Wrangler children and the OAuth config
home is throwaway. Never deploy local configs. Synthetic preview/seed may run in
CI under their local-only guard; operator provisioning still refuses CI.

## Optional local operator ceremony

Use an empty already-migrated local ADMIN_DB, three distinct reserved .test
emails, an explicit approval reference, and ADMIN_LOCAL_PASSWORD in the local
environment. `pnpm admin:provision -- --local --email a@example.test --email
b@example.test --email c@example.test --approval-ref local-independent-review`
creates independent local Admin identities/credentials and one atomic three-role
bootstrap. It does not read customer accounts. It refuses CI, nondevelopment,
remote/env/preview/production flags or reachable Cloudflare API credentials.
Do not pass real identities or use it against a remote database.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm check:migrations
pnpm exec vitest run tests/unit/admin- tests/integration/admin- --maxWorkers=1
pnpm admin:workerd:check
pnpm admin:migration:matrix
pnpm test:admin:e2e
pnpm exec playwright test -c playwright.admin.config.ts -g 'scrollable tables' --repeat-each 10
```

Exact completed results are recorded in production-readiness/12, with full
source SHA and environment. Generated images live in ignored
.hoplite/artifacts/admin-e2e rather than tracked historical references.
Staging and production need separate operator authorization and reviewed live
adapters. The four release workflows are offline plans only.
