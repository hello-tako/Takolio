# START HERE — Takosan Admin Console V1 handoff (2026-10-15)

**Status: preserved and documented, NOT approved.** Admin Console V1 and its R1 security remediation are on this branch as local source. The independent-style certification verdict is `ADMIN_V1_R1_CHANGES_REQUIRED`. Findings F1–F11 are open. **R2 has not been started.** Nothing is routed, deployed, activated, or certified for staging or production.

| Item | Value |
|---|---|
| Project | Takosan. Customer Worker `frigo` (`wrangler.jsonc`, D1 `frigo-db`). Admin Console is a separate Worker (`wrangler.admin.jsonc`, D1 `takosan-admin-db` bound as `ADMIN_DB`). |
| Repository | `https://github.com/hello-tako/Tako-san` — **public**; default branch `main` |
| Repository ID | `1385308553` (unauthenticated REST read of `repos/hello-tako/Tako-san` returned the same ID; the brokered credential is scoped to it) |
| Handoff branch | `handoff/admin-v1-r2-20261015`, created from `95a1425`. History is append-only: no rebase, squash, amend or force-push. |
| Published HEAD | the branch tip. The commit that introduced these documents is recorded in `HEAD_RECORD.md`. |
| Certification | `ADMIN_V1_R1_CHANGES_REQUIRED` (`docs/admin/reviews/2026-10-14-r1-certification.md`). Produced by the same agent that implemented R1; **not independent**. |
| Staging | `STAGING_NOT_CERTIFIED` |
| Production | `PRODUCTION_NOT_CERTIFIED` |
| R2 | `R2 IMPLEMENTATION NOT STARTED` — no R2 commits, diffs, stashes or worktrees exist (see `LOCAL_STATE_INVENTORY.md`). |

## 1. Exact SHAs (all verified with `git rev-parse` in this workspace)

| Role | Full SHA | Subject |
|---|---|---|
| Customer baseline (pre-admin) | `186a9cf05de7c91ed3289e13130feb3b38a264ac` | Merge PR #71 |
| Original Admin V1 | `3e865d009ee62a92ed1d9c8d225a36893035670b` | `feat(admin): Takosan Admin Console V1 (local)` — tag `admin-v1-review-baseline` (local only) |
| Review record (2026-10-12) | `6889f8da71591c49bfdac30a14108426ea05dd57` | `docs(admin): record 2026-10-12 Admin V1 review (CHANGES_REQUIRED)` — also edits `vite.config.ts`, see PROJECT_HISTORY |
| Pre-amend review record | `ef50e344bd34e89221773fcffb7849833dc808bb` | not on any branch; reflog only |
| R1 remediation implementation | `25140baa99ef0aecc5e8d0e53206132e01e0f765` | `fix(admin): Admin V1 security remediation R1` |
| R1 evidence and report | `0331cc9f4e247446dd1a99715047fe00866d8e2a` | `docs(admin): Admin V1 remediation R1 report, evidence and integration plan` |
| R1 certification report | `95a1425cc149346d6b8e17ac18bb32990338ef9b` | `docs(admin): R1 certification review (CHANGES_REQUIRED)` |
| Handoff preservation | `45cbec8281692b560bae6ce3b2fe6ad0749d196a` | `docs(admin): preserve handoff inputs, archive reviewer PoCs and evidence logs` |
| Handoff documentation | first commit after `45cbec8` | see `HEAD_RECORD.md` |
| Handoff receipt tip (pre-merge) | `9ee4c49` | `docs(admin): record main drift and the four status-document conflicts for PR #77` |
| Merge of `origin/main` | `a2f47c5` | `merge: origin/main into handoff/admin-v1-r2-20261015 (resolve PR #77 conflicts)` |
| Post-merge customer runtime guard update | `87d6d3d` | `test(admin): compare customer runtime to the merge base with main` |
| `origin/main` merged in WP0 | `0ff82ed` | 15 commits ahead of `186a9cf`; merged in `a2f47c5` |

Admin commits are authored by `usehoplite[bot]`. The series `186a9cf..95a1425` contains six commits; `45cbec8` and the documentation commits follow.

## 2. What is complete (local, on this branch)

- **Separate Admin Worker** (`src/worker/admin-worker.ts`, `wrangler.admin.jsonc`, `wrangler.admin-local.jsonc`, `vite.admin.config.ts`). The customer Worker and customer assets were restored to the `186a9cf` baseline (see FILE_MANIFEST).
- **Admin database** `migrations-admin/0001_admin_console_foundation.sql`: 7 `admin_*` tables and 9 triggers (append-only audit, immutable role rows, minimum two active SUPER_ADMIN, one-time operator bootstrap, final approvals).
- **Admin API** under `/api/v1/admin`: 21 authenticated routes in `src/worker/routes/admin/index.ts`. All 21 declare `requirePermission` (checked with a script in this handoff). Auth endpoints live in `routes/admin/auth.ts`.
- **Authentication**: Cloudflare Access JWT verification (`access.ts`), environment policy with an exact allow-list (`policy.ts`), local password login only in development/test on loopback behind a compile-time define.
- **RBAC**: five roles (SUPER_ADMIN, OPERATIONS_ADMIN, CONTENT_EDITOR, SUPPORT_AGENT, READ_ONLY_AUDITOR). Matrix in `src/shared/admin.ts`, documented in `docs/admin/RBAC_MATRIX.md`.
- **Frontend**: nine specified screens plus login (`src/admin/pages`, 11 files), React/TSX.
- **Local tooling**: fixture seed/reset, provisioning (local only), preview server, workerd checks, migration matrix. Remote invocation is refused by guards (verified in this handoff).
- **R1 remediation claims** S1–S11 (`docs/admin/remediation-r1/REPORT.md`). Their probes were re-run by the reviewer; see TEST_AND_EVIDENCE. **None is marked RESOLVED** (see SECURITY_FINDINGS).

## 3. What is NOT complete

1. **R2** — not started. Plan: `R2_IMPLEMENTATION_PLAN.md` (WP0–WP9).
2. **Findings F1–F11** — all open. P1: F1, F2, F3. P2: F4–F11. P0: none identified.
3. **Cloudflare Access** — verified only with locally generated keys. Live staging verification has not happened.
4. **Admin CI and deploy** — `ci.yml` runs lint, typecheck, unit/integration tests, `check:migrations` and build, but **not** the admin E2E, the workerd check or the migration matrix. No workflow references the admin configs; nothing deploys the admin Worker.
5. **Production bootstrap and recovery** — designed in `docs/admin/PRODUCTION_INTEGRATION_PLAN.md` §5, not built.
6. **Integration with `origin/main`** — not done (see §9 traps).

## 4. What must NOT be done

- Do not push to `main`, merge any PR, force-push, rebase, squash, amend or delete branches or tags.
- Do not deploy staging or production. Do not run remote Cloudflare operations, change Cloudflare resources, or modify production D1 (`frigo-db`) or any production secret.
- Do not activate the Admin Console: no route, no `ADMIN_CONSOLE_ENABLED=true` outside local development, no custom domain, no `workers_dev`.
- Do not deploy or copy `wrangler.admin-local.jsonc` anywhere. It is the only config that compiles the local password login.
- Do not change repository protection rules, GitHub Actions permissions, or production secrets.
- Do not touch customer payments or billing (PayOS, checkout, payment webhooks, billing), household isolation, inventory commands, or Week compatibility (repository `AGENTS.md`).
- Do not commit `.env` files, tokens, cookies, JWT keys, real OTPs, customer data, DB dumps, or unredacted authorization headers.
- Do not mark any finding RESOLVED on the basis of unreviewed code.
- Do not treat the R1 PASS-style wording in `remediation-r1/REPORT.md` as certification. Its own status line is "READY_FOR_INDEPENDENT_REVIEW".

## 5. Document map (all under `docs/admin/handoff/` unless stated)

| Document | Purpose |
|---|---|
| `START_HERE.md` | this file |
| `PROJECT_HISTORY.md` | phases A–E with commits and findings |
| `CURRENT_ARCHITECTURE.md` | what the code does today; labelled separately from R2 target |
| `SECURITY_FINDINGS.md` | F1–F11 (plus S1–S12 status and one out-of-scope observation) |
| `R2_IMPLEMENTATION_PLAN.md` | work packages and acceptance tests |
| `TEST_AND_EVIDENCE.md` | results with source attribution, commands, evidence index |
| `LOCAL_RUNBOOK.md` | clean-clone setup, local startup, tests, troubleshooting |
| `PRODUCTION_BLOCKERS.md` | everything that blocks staging or production |
| `SESSION_HANDOFF.md` | reconstruction of recent work sessions and decisions |
| `FILE_MANIFEST.md` | admin-related files, purpose and introducing commit |
| `LOCAL_STATE_INVENTORY.md` | worktrees, refs, stashes, local-only artifacts |
| `HEAD_RECORD.md` | published HEAD and verification commands |
| `../README.md`, `../LOCAL_SETUP.md`, `../API_REFERENCE.md`, `../RBAC_MATRIX.md`, `../SECURITY_ASSESSMENT.md`, `../PRODUCTION_INTEGRATION_PLAN.md`, `../ARCHITECTURE_MAP.md` | existing admin docs (see stale items in §9) |
| `../remediation-r1/REPORT.md`, `../remediation-r1/REGRESSION.md` | R1 report, regression evidence |
| `../reviews/2026-10-12-independent-review.md` | first review (CHANGES_REQUIRED) |
| `../reviews/2026-10-14-r1-certification.md` | R1 certification review (CHANGES_REQUIRED), with erratum |
| `../reviews/poc-archive/` | the 51 review PoCs as `.txt` (not collected by `pnpm test`) |
| `prompts/` | verbatim copies of the five prompts that governed this work |
| `tools/secret_scan.py` | the regex scanner used for the handoff publication check |

## 6. Run locally and reproduce tests

Follow `LOCAL_RUNBOOK.md` in a clean clone. Results and their provenance are in `TEST_AND_EVIDENCE.md`. Historical results are not a fresh execution.

## 7. Immediate next actions for the successor

1. Read `PRODUCTION_BLOCKERS.md` and `SECURITY_FINDINGS.md`.
2. In a clean clone of this branch, run the baseline gates from `LOCAL_RUNBOOK.md` (install, lint, typecheck, test, build, `check:migrations`). Confirm they match TEST_AND_EVIDENCE before changing anything.
3. Get the owner decisions in §10.
4. **WP0** (`R2_IMPLEMENTATION_PLAN.md`): integrate `origin/main`, re-pin the migration matrix to the current customer ledger, and re-run the full suite on the merged result.
5. Then R2 WP1 → WP8 in order. WP2 and WP4 change customer runtime and need explicit authorization first.
6. Independent review of the result. Staging and production remain blocked until `PRODUCTION_BLOCKERS.md` is cleared.

## 8. Traps you will hit

- **Ledger drift.** `origin/main` has 43 migration files; `186a9cf` (the admin base) has 41. The R1 migration matrix pins the 41-file customer ledger, so it will fail on `main`. This is expected until WP0 re-pins it deliberately. Do not weaken the assertion.
- **PR #77 is `DIRTY`.** Merging `main` conflicts in four status documents: `docs/ai/CURRENT_STATE.md`, `docs/ai/DECISIONS.md`, `docs/ai/HANDOFF.md` and `docs/ai/TASK_BOARD.md`. `main` added about 1,900 lines to them since `186a9cf`, and this branch added blocks at the top. Resolve by keeping both sides. No admin code file conflicts (checked with `git merge-tree`).
- **Commit labels lie.** `6889f8d` is labelled `docs(admin)` but edits `vite.config.ts`. Use `git diff 186a9cf HEAD -- <path>` for customer provenance, not commit subjects.
- **Customer files were touched and restored.** `3e865d0` changed customer files (`src/worker/index.ts`, `types.ts`, `config/csp.ts`, `middleware/rate-limit.ts`, `public/sw.js`, `scripts/migration-smoke.sh`, `tests/helpers/sqlite-d1.ts`). `25140ba` restored them. At HEAD they are byte-identical to `186a9cf`. The reviewer's earlier claim that these edits were "admin-related" was wrong; it is corrected in the certification report.
- **Local PoCs are collected by `vitest` in a dirty workspace.** Restored copies under `.hoplite/artifacts/` are picked up by `pnpm test`. Run the suite in a clean clone, or move the PoCs aside first.
- **Keyboard E2E is flaky** (F8). A failure of `scrollable tables are reachable…` is a known test race, not a regression signal by itself.
- **E2E rewrites tracked screenshots** (F9): `tests/e2e/admin-console.e2e.ts` writes to `docs/admin/screenshots`. Restore them with `git checkout -- docs/admin/screenshots` after a run unless you intend to update them.
- **Stale docs.** `docs/admin/ARCHITECTURE_MAP.md` line 38 still names `migrations/0042_admin_console_foundation.sql` (withdrawn). `docs/admin/MIGRATION_COMPATIBILITY.md` is marked superseded. `docs/admin/README.md` status says "READY_FOR_INDEPENDENT_REVIEW", which the certification verdict supersedes.
- **Local tag only.** `admin-v1-review-baseline` exists only in this workspace. It is recoverable through the branch history (`3e865d0` is an ancestor of the handoff tip).
- **Wrangler credentials.** A local Wrangler OAuth file was removed during this handoff (see `LOCAL_STATE_INVENTORY.md` §6). Re-authenticate only if a read-only local task needs it. No remote operation is authorized.

## 9. Decisions the owner must make

1. **Visibility.** The repository is public. This branch publishes Admin source and the defect reproductions (the PoCs) for the first time: no admin path existed on `origin/main` before this push (verified). Decide whether to keep the repository public, make it private, or move the security material to a private advisory. Redaction was applied: no secrets, tokens, cookies, real account identifiers or personal data were found (see `TEST_AND_EVIDENCE.md`, secret scan).
2. **Customer-runtime authorization** for R2 WP2 (facade entrypoint in the customer Worker), WP4 (`security_epoch` written by customer auth flows) and WP9 (customer index or migration for F7).
3. **Cloudflare Access app** for staging (separate authorization).
4. **Production operators** for the three-person bootstrap ceremony and the break-glass procedure (F2, F3).
