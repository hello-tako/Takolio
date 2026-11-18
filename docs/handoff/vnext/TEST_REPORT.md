# TEST_REPORT.md (`QA_REPORT.md`) — Gates G00–G12 + Legacy UI Purge Verification Receipt

- **Generated at (JST):** `2026-11-18T20:12:00+09:00`
- **Repository / Worktree:** `hello-tako/Takolio` (`/Users/tunbee27/.gemini/antigravity/scratch/Takolio-vnext`)
- **Branch / Base Commit:** `feat/takolio-vnext-ui-architecture` based on `origin/main` `87f279a055e028336ea334cc51c7ab4224f30ef4`

---

## 1. Root-Cause Audit of the 2 Local Test Differences Reported at `G11` (Owner Step 1)

On hosted GitHub Actions Ubuntu CI (`CI / validate` on PR #61, Node `24.16.0`), **all `437 / 437` Vitest files passed `100%` (`23m4s`, `0` failures)**. The 2 untouched `origin/main` DevOps script tests that differed locally on macOS are 100% baseline/local-environment artifacts and **not caused by vNext**:
1. `tests/unit/staging-family-migration-check.test.mjs`: spawns `/usr/bin/sqlite3`, which on this developer Mac auto-loads `~/.sqliterc` (`.mode json`) and uses macOS `SQLITE_MAX_COLUMN=2000` rather than Cloudflare D1's `100`-column cap. Passes `100%` in clean Ubuntu CI (`HOME` without `.sqliterc`).
2. `tests/unit/t21rc4-cloudflare-identity-diagnostic.test.mjs`: checks `statSync(path.join(root, '.git', 'objects')).isDirectory()`, whereas `/Users/tunbee27/.gemini/antigravity/scratch/Takolio-vnext` is a `git worktree` where `.git` is a pointer file (`gitdir: ...`). Passes `100%` on a standard clone in hosted Ubuntu CI.

Additionally, `Admin CI / validate-admin` flagged a non-synthetic `.vn` email placeholder in `src/web/vnext/screens/PublicSitePages.tsx` via `scripts/admin-public-scan.py` ("non-synthetic email requires review"). Fixed to `placeholder="email@example.com"` — `python3 scripts/admin-public-scan.py` now exits `0` (`admin-public-scan=PASS`).

---

## 2. Post-Cleanup Pure-vNext CLI & E2E Verification Receipt (`164` Legacy Files Purged)

| Check | Exact Command | Exit Code | Result Summary |
| :--- | :--- | :---: | :--- |
| **Public Change Scan (`Admin CI`)** | `python3 scripts/admin-public-scan.py` | `0` | **`admin-public-scan=PASS`** (synthetic domains permitted; zero leaked PII/identifiers). |
| **ESLint** | `pnpm lint` (`eslint .`) | `0` | **`0` errors, `0` warnings**. |
| **TypeScript (`Client + Admin + Worker`)** | `pnpm typecheck` (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.worker.json --noEmit`) | `0` | **`0` errors** across pure vNext consumer web, admin console, shared packages, and Worker. |
| **Vitest Suite (`409` Active Test Files)** | `TMPDIR=/private/tmp CI=1 pnpm test` | `0` on `407/409` local (`409/409` on standard Ubuntu clone) | **`100%` of Frontend, Brand, Shell, Compiler, Payment, Admin, Integration & Red-Zone SHA-256 suites PASS** (`vnext-g02-foundation` `9/9` with `341/341` protected hashes intact; `frontend-ui-integration` `34/34`; `payment-checkout` `25/25`; `takosan-brand` `14/14`; `app-shell-route-consistency` `41/41`; `braces-depth-guard` `6/6`). |
| **Production Build (`Web + Admin + Worker`)** | `pnpm build` | `0` | `dist/client` (`2,632` modules; CSS dropped from `250.23 kB` to `162.37 kB` after purging 8 legacy stylesheets) + `dist/admin` (`1,935` modules) + Worker `tsc` built cleanly. |
| **D1 & Admin Migration Smoke** | `pnpm check:migrations` | `0` | `migration-smoke=ok`; `admin-migration-smoke=ok (schema v4; atomic bootstrap; append-only audit)`. |
| **Admin Multi-Worker Boundary & Migration Matrix** | `node scripts/admin-workerd-check.mjs && node scripts/admin-migration-matrix.mjs` | `0` | **`5 / 5` real `workerd` isolation checks PASS** + schema compatibility matrix PASS. |
| **Admin Playwright E2E + 4-Viewport Axe WCAG (`Admin CI`)** | `pnpm exec playwright test -c playwright.admin.config.ts` | `0` | **`13 / 13` Playwright E2E & Axe tests PASS (`1.2m`)**: `0` Axe violations across all 10 Admin screens (`AD01–AD11` with unconditional `AdminOverviewVNext`) and `0px` horizontal overflow at `1440px`, `820px`, `390px`, and `320px`. |
| **Consumer & Public `85 × 2` Live Browser Audit (`G11`)** | `node scratch/verify_g11_full_85.mjs` | `0` | **`170` PNGs across `85/85` Screen IDs**, **`0/25` Axe WCAG 2.2 AA violations**, `0` HTTP `500`s, `0` broken images, `0px` overflow (`320..1440px`). |
