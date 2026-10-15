# R2 implementation plan (PLAN ONLY — not implemented)

**Status:** `R2 IMPLEMENTATION NOT STARTED`. This document defines the work. The emergency handoff did not implement any of it. Each package below names the findings it closes (`SECURITY_FINDINGS.md`) and the acceptance tests that must pass before the package is considered done. None of the findings may be marked RESOLVED without an independent review of the result.

**Ground rules**
- Work on a derived branch (for example `r2/admin-v1-<slug>` from the handoff tip). Do not rewrite `handoff/admin-v1-r2-20261015`.
- Any change to customer runtime (`src/worker/index.ts`, customer auth, customer migrations, `wrangler.jsonc`) needs explicit authorization first. The repository `AGENTS.md` forbids touching PayOS, payments, billing, checkout and payment webhooks, and unrelated authentication.
- Tests are not to be weakened. Where a test pins a fact that R2 deliberately changes (for example the 41-file ledger), update it in the same change, with the reason in the commit message.

## WP0 — Integrate with `origin/main` (no behaviour change)

- **Why:** `origin/main` (`0ff82edb7c251be340b5e00fbcf0ae8703b22a55`) is 15 commits ahead of `186a9cf` and has 43 migration files (41 at `186a9cf`). It changed `src/worker/index.ts` and `scripts/migration-smoke.sh`.
- **Steps:** create the derived branch; merge `origin/main`; resolve conflicts (none expected in admin files); re-pin the migration-matrix customer-ledger assertion to the chosen main SHA; run the full gate set.
- **Acceptance:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm check:migrations` pass on the merged SHA; `admin-migration-matrix` passes with the new pin; no customer file changes beyond the merge result.

## WP1 — Remove the customer D1 binding from the Admin Worker (priority 1; F1)

- **Files:** `wrangler.admin.jsonc`, `wrangler.admin-local.jsonc`, `src/worker/admin-worker.ts`, `src/worker/routes/admin/{auth,people,recipes,billing-ai,overview,system,settings}.ts`, `readonly-db.ts`.
- **Change:** delete the `DB` binding from both admin configs. Every customer read goes through the WP2 facade binding. `readOnlyDatabase()` is removed.
- **Acceptance:** (a) a static test fails if any admin config binds a database whose ID equals the customer ID; (b) `grep -R "env.DB\|c.env.DB" src/worker/routes/admin` is empty; (c) `R1C-B1` (write capture on every customer table) reports 0 writes; (d) the workerd check starts without `DB`.

## WP2 — Internal read facade through a Service Binding (priority 2; F1)

- **Requires customer-runtime authorization.**
- **Change:** the customer Worker exports `AdminReadFacade extends WorkerEntrypoint`. It has no `fetch` route and is reachable only through the service binding `CUSTOMER_READ` declared in `wrangler.admin.jsonc`.
- **Acceptance:** (a) customer HTTP surface unchanged for every existing path (the workerd customer comparison, 23 checks, passes, with the facade's entry change documented as the only intended difference); (b) a request to any facade-like path on the customer host returns 404; (c) the facade is not in `wrangler.jsonc` routes.

## WP3 — Fixed authorized read operations with strict schemas (priority 3)

- **Change:** an allow-list of named operations (for example `listUsers`, `getUserSummary`, `listHouseholds`, `billingSummary`, `listTransactions`, `aiSummary`, `listAiUsage`, `listRecipes`, `getRecipe`, `overviewCounts`). Each has an input schema (`zod`, bounded pages and ranges) and an output schema. Output projection excludes credential columns and raw email unless the caller holds `users.pii.reveal`, in which case the audit row is written first.
- **Acceptance:** (a) invalid input is refused before any SQL; (b) every operation's output parses against its schema; (c) a table-driven test asserts that no operation output contains `password_hash`, `salt`, `google_sub` or token columns; (d) a test or lint rule asserts that every `prepare()` call in the facade uses a constant SQL string.

## WP4 — Eliminate password_hash exposure to the Admin Worker (priority 4; F1, S6)

- **Requires customer-runtime authorization** (customer auth must maintain the epoch).
- **Interim (no customer change):** compute the session credential fingerprint inside the facade; the Admin Worker receives only an opaque value.
- **Target:** a monotonic `security_epoch` maintained by customer auth flows (password change or reset, verification, Google link, email change). The admin session stores the epoch; mismatch revokes.
- **Acceptance:** no admin SQL selects `password_hash` or `salt` (grep test); `R1C-B3` inverted to "not observed"; session-revocation controls (`R1C-C2`, the session lifecycle PoCs) still pass.

## WP5 — Super Admin break-glass governance (priority 5; F2)

- **Change:** production enablement refuses unless at least three SUPER_ADMIN are active and loginable (`ADMIN_GOVERNANCE_INCOMPLETE`). A break-glass procedure runs as one reviewed SQL batch through a protected workflow approved by two owners, writes an `admin.breakglass` audit row, and keeps the minimum-two trigger.
- **Acceptance:** `R1C-D2` passes through the break-glass path; a break-glass without two distinct approvers is refused; enablement is refused with two SUPER_ADMIN.

## WP6 — Bind administrator identity to verified Access issuer and subject (priority 6; F11)

- **Change:** store `access_iss` and `access_sub` at first Access login (an additive migration in `migrations-admin/` only). Later logins require equality. Email change without re-binding denies access until a SUPER_ADMIN re-binds.
- **Acceptance:** same email with a different `sub` → 403 and audit; first-login binding recorded; the migration passes `admin-migration-smoke`.

## WP7 — Two-person authorization means two independently approved human operators (priority 7; F3)

- **Change:** approvals and bootstrap require two distinct `access_sub` values, not two user IDs. The bootstrap SQL refuses identical subjects. The production ceremony is documented in `PRODUCTION_BLOCKERS.md`.
- **Acceptance:** two user IDs mapped to one subject → second approval refused; bootstrap refuses identical subjects; the ceremony is executed once in staging with three named operators (separate authorization).

## WP8 — Atomic approval and bootstrap (priority 8; F4, F5)

- **Change:** decider check inside the same batch (F4). Bootstrap as one batch: grants, marker and audit (F5). Migration 0002 (ADMIN_DB) closes bootstrap after the first pair.
- **Acceptance:** `R1C-D1` returns 409 with no grant; `R1C-D3` cannot leave a partial bootstrap (injected failure test); the concurrent-revocation test passes ≥20 times.

## WP9 — Remaining P2 findings (priority 9; F6–F10)

- **F6:** failed-attempt-only accounting keyed on the verified subject (see SECURITY_FINDINGS F6 acceptance).
- **F7:** sargable predicates and indexes. Indexes are a customer migration (separate authorization). Alternative: facade rollups cached for 60 s.
- **F8:** `expect.poll` in the keyboard E2E; ≥10 consecutive `--repeat-each` passes.
- **F9:** E2E screenshots to a git-ignored directory; tracked screenshots only by explicit opt-in.
- **F10:** `SHELL_ROUTE` charset aligned with `IdParam`; `.` and `..` segments refused.
- **Acceptance:** each item has a test that fails before the change and passes after it.

## Sequencing and gates

`WP0 → WP1 + WP2 (authorization) → WP3 → WP4 (authorization for the epoch) → WP6 → WP7 → WP8 → WP5 → WP9`, then independent review, then staging (separate authorization), then production (separate authorization). Each step: full gates green on the step's SHA, the R1 PoC matrix updated with the new expectation, and this document and `SECURITY_FINDINGS.md` updated.
