# CURRENT_BASELINE.md — G00 Read-Only Audit (`hello-tako/Takolio`)

- **Audit Timestamp (JST):** `2026-11-18T12:55:00+09:00`
- **Repository:** `https://github.com/hello-tako/Takolio.git` (`hello-tako/Takolio`)
- **Live `origin/main` HEAD SHA:** `87f279a055e028336ea334cc51c7ab4224f30ef4` (`Merge pull request #59 from hello-tako/codex/staging-content-chain`)
- **Kit Historical Reference SHA:** `87f279a055e028336ea334cc51c7ab4224f30ef4` *(Verified identical to live `origin/main` after `git fetch origin`)*
- **Clean Audit Worktree:** `/Users/tunbee27/.gemini/antigravity/scratch/Takolio-vnext` (detached at exact `87f279a055e028336ea334cc51c7ab4224f30ef4`; `git status --short` = empty; `0` app files modified during G00).
- **Preserved Prior Local Worktree:** `/Users/tunbee27/.gemini/antigravity/scratch/Takolio` (unmerged experimental branch `feat/takolio-v4-overhaul` preserved untouched in separate worktree; zero cross-contamination).

---

## 1. Runtime & Architecture Inventory (`SOURCE:LIVE`)

| Layer | Verified Stack & Entrypoint | Key Findings on `87f279a0` |
| :--- | :--- | :--- |
| **Consumer Web / PWA** | React `18.3.1`, React Router `7.18.3`, TanStack Query `5.102.8`, Zustand `5.0.15`, Vite `6.4.5`, Tailwind `4.3.3` (`src/web/App.tsx`) | 27 lazy page modules + `features/{auth,planner,week,family,favorites}`; `SessionBoundary` + `AppErrorBoundary` keyed by `${userId}:${householdId}` |
| **Admin Console** | Separate Vite bundle (`vite.admin.config.ts`, `src/admin/App.tsx`, `basename="/admin"`) | 11 routes (`login`, index overview, `users`, `users/:userId`, `households`, `billing`, `ai`, `recipes`, `recipes/:recipeId`, `system`, `audit`, `settings`) guarded by `RequireSession` + `RequirePermission` |
| **Worker API** | Hono `4.13.13` (`src/worker/index.ts`, `src/worker/admin-worker.ts`) | Public `/api/v1/{health,ready,public-config,recipe-media/*}`; auth-protected `/api/v1/{auth,billing,inventory,scans,recipes,recipe-favorites,shopping-list,preferences,family-preferences,notifications,week,meal-planning}`; additive `/api/v2/meal-planning/*` |
| **Domain & Catalog** | `@frigo/domain`, `@frigo/recipes`, `@frigo/db`, `@frigo/ai` (`packages/*`) | 71 runtime seed recipes (59 Vietnamese + 12 global) + D1 500-recipe import layer; deterministic unit conversion, serving scaling, quantity-aware availability, shopping net demand |
| **Database & Migrations** | Cloudflare D1 / SQLite (`migrations/0001..0047`, `migrations-admin/`) | Both migration smoke suites (`migration-smoke=ok`, `admin-migration-smoke=ok`) pass cleanly |
| **Fonts & Brand Assets** | Self-hosted SIL OFL `.woff2` (`Nunito` Vietnamese variable in `public/takosan/v3/fonts/` & `dist/admin/admin/fonts/`; `Plus Jakarta Sans` Vietnamese variable in `public/takolio/v1/fonts/`; `Be Vietnam Pro` in `public/takosan/fonts/`) | Canonical `public/takolio/v1/` hashed and locked (`60+` files); preserved untouched for rollback |

---

## 2. Feature Flags & Environment Controls Verified on HEAD

1. **`VITE_MEAL_PLANNER_ENABLED` / `MEAL_PLANNER_ENABLED`** (`src/web/features/planner/feature.ts`):
   - Controls canonical `/planner/*` vs legacy `/week/*` bidirectional redirects while preserving `planId` and `mealId`/`slotId`.
2. **`VITE_MEAL_COMPOSITION_V2_ENABLED` / `MEAL_COMPOSITION_V2_ENABLED`** (`src/web/features/planner/composition.ts`):
   - Controls additive `/api/v2` multi-dish meal slot composition (`C26`).
3. **`PUBLIC_DOMAIN_ROUTING`** (`src/worker/middleware/domains.ts`):
   - Controls host-level domain profile headers in Worker; disabled in local preview.
4. **`RECIPE_CATALOG_MODE` / `RECIPE_CATALOG_CUTOVER_ENABLED`**:
   - Controls static 71-recipe seed vs D1 500-recipe catalog projection.

---

## 3. Baseline 85-Screen Coverage Summary (`87f279a0`)

Full per-screen contract mapping is recorded in `ROUTE_STATE_API_MATRIX.csv`:

| Cohort | Screen IDs | Total | Existing Live Route/State | Proposed New Route/State | Backend/Content Gap (`BLOCKED_*` / `PROTECTED`) |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **01 Public Website** | `M01–M12` | **12** | `1` (`M01` at `/landing`) | `8` (`M02–M08`, `M10`) | `3` (`M09` public pricing API, `M11` Stories CMS, `M12` legal/contact copy) |
| **02 Authentication** | `A01–A08` | **8** | `8` (`/auth`, `/auth/verify`, modes & `DEC-012`) | `0` | `0` (Google GSI / Turnstile require runtime keys in prod) |
| **02 Onboarding** | `O01–O06` | **6** | `3` (`O02` goals, `O03` household, `O04` prefs) | `3` (`O01` welcome, `O05` init, `O06` ready) | `0` (uses authoritative `POST /api/v1/onboarding`) |
| **03 Consumer App** | `C01–C30` | **30** | `29` (routes + stateful sheets/tabs) | `1` (`C02` dedicated quick-find sheet) | `0` (`C30` notification unread badge omitted where IDs are ephemeral) |
| **04 Account & Plus** | `U01–U10` | **10** | `7` (`U01–U05`, `U07`, `U09`) | `0` | `3` (`U06` invite/join `BLOCKED_BACKEND`, `U10` export/delete `BLOCKED_BACKEND`, `U08` PayOS `PROTECTED_READONLY`) |
| **05 System States** | `S01–S08` | **8** | `7` (`S01`, `S03–S08`) | `1` (`S02` real 404 replacing catch-all redirect) | `0` |
| **06 Admin Console** | `AD01–AD11` | **11** | `11` (`/admin/login` + 10 console views) | `0` | `1` (`AD06` Billing `PROTECTED_READONLY`) |
| **TOTAL** | **`M/A/O/C/U/S/AD`** | **85** | **66** | **13** | **6** (`2 BLOCKED_BACKEND`, `3 BLOCKED_CONTENT`, `2 PROTECTED_READONLY` — note `AD06` overlaps existing) |
