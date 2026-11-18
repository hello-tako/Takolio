# BASELINE_TESTS.md — G00 Executed Baseline Verification (`87f279a0`)

All commands below were executed on the unmodified `origin/main` worktree (`/Users/tunbee27/.gemini/antigravity/scratch/Takolio-vnext` at `87f279a055e028336ea334cc51c7ab4224f30ef4`) prior to creating any feature branch or editing any file.

| Command | Exit Code | Duration | Result Summary |
| :--- | :---: | :---: | :--- |
| `python3 TOOLS/verify_kit.py` | `0` | `<1s` | `PASS: 85 unique screens, 85 detailed specs, 85 PNG refs, 9 boards, 4 concept posters, hashes verified` |
| `pnpm install --frozen-lockfile` | `0` | `2.4s` | Lockfile up to date (`312` packages linked) |
| `pnpm typecheck` | `0` | `~4s` | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.worker.json --noEmit` — `0` errors |
| `pnpm lint` | `0` | `~5s` | `eslint .` — `0` errors |
| `pnpm build` | `0` | `5.7s` | Client Vite (`4.39s`) + Admin Vite (`1.31s`) + Worker `tsc` — `0` errors (upstream Zod `@__PURE__` comment notice & runtime `/admin/fonts/*.woff2` externalization retained as documented in `CURRENT_STATE.md`) |
| `pnpm check:migrations` | `0` | `~3s` | `migration-smoke=ok` (47 customer migrations) + `admin-migration-smoke=ok` (schema v4) |
| `pnpm exec vitest run` *(12 UI/Auth/Admin/Billing/Integration suites)* | `0` | `3.93s` | **`12/12` files, `166/166` tests PASS** (`takosan-brand`, `ui07-brand-shell`, `ui11-navigation`, `ui11-shell-measurement`, `ui02-surfaces`, `ui-rebuild-surfaces`, `auth-funnel-ui`, `admin-shell`, `admin-components`, `admin-login`, `billing-account-ui`, `frontend-ui-integration`) |
