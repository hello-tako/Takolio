# HANDOFF_CURRENT.md — Gate G12 Pure-vNext Cutover (`LEGACY_PURGED_READY_FOR_MAIN_MERGE_AND_PROD`)

- **Generated at JST:** `2026-11-18T20:12:00+09:00`
- **Repo:** `hello-tako/Takolio` (`/Users/tunbee27/.gemini/antigravity/scratch/Takolio-vnext`)
- **Source main SHA at start:** `87f279a055e028336ea334cc51c7ab4224f30ef4`
- **Pull Request:** **PR #61** — `https://github.com/hello-tako/Takolio/pull/61` (`feat/takolio-vnext-ui-architecture` → `main`)
- **Legacy Frontend Purge Status:** **`COMPLETE`** — **`164` obsolete legacy Frontend pages, components, stylesheets, G02 preview toggles, Frigo brand/UI assets, and legacy-DOM unit tests deleted**; `0 / 341` Red-Zone files modified (`341/341` SHA-256 verified).
- **Pre-Cutover Production Baseline & Rollback Target (`frigo` Worker):**
  - **Current Live Production Deployment ID:** `c57e9d9e-cb9e-4ca5-a121-a233c63e9b85`
  - **Rollback Worker Version ID (Version #161):** **`904851f4-e3b6-4881-8c9a-78cdf88d5740`** (`GIT_COMMIT=cedeec779db51bf24a25543d72c6ca00f1026aea`, `RECIPE_CATALOG_MODE=d1`, `MEAL_PLANNER_ENABLED=true`, `MEAL_COMPOSITION_V2_ENABLED=true`).
  - **Instant Production Rollback Command:**
    `pnpm exec wrangler rollback 904851f4-e3b6-4881-8c9a-78cdf88d5740 --name frigo --message "Rollback to pre-vNext Worker version #161"`
    (or `node scripts/cloudflare-worker-rollback.mjs 904851f4-e3b6-4881-8c9a-78cdf88d5740`)
- **Staging Preview (`frigo-staging`):**
  - `https://vnext-g12-frigo-staging.tungbipdz.workers.dev` (Worker Version `50d4df9a-6283-46de-96ea-b2924a4cd189`)
- **Protected files changed?** **`NO`** (`341/341` protected files verified byte-for-byte identical via SHA-256 in `PROTECTED_FILE_HASHES.json`).
- **Verification Gates (`CI` + `Admin CI` Parity):**
  - `python3 scripts/admin-public-scan.py` → `PASS`
  - `pnpm lint` → `exit 0`
  - `pnpm typecheck` → `exit 0`
  - `pnpm build` → `exit 0` (`index.css` reduced from `250.23 kB` → `162.37 kB`)
  - `pnpm check:migrations` → `exit 0`
  - `node scripts/admin-release-preflight.mjs` → `PASS`
  - `node scripts/admin-workerd-check.mjs` + `node scripts/admin-migration-matrix.mjs` → `PASS`
  - `pnpm exec playwright test -c playwright.admin.config.ts` → **`13 / 13` PASS (`0` Axe violations, `0px` overflow at `320/390/820/1440px`)**
