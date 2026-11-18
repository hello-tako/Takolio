# RELEASE_CHECKLIST_G12.md — Takolio Frontend vNext Release Candidate & Rollback Plan

- **Gate:** `G12` — Release Readiness, PR #61 & Staging Preview
- **Status:** **`PR_OPEN_AND_STAGING_PREVIEW_LIVE` (`PR #61 OPEN / NOT MERGED` · `PRODUCTION NOT DEPLOYED`)**
- **Updated at (JST):** `2026-11-18T16:22:00+09:00`
- **Repository:** `hello-tako/Takolio` (`/Users/tunbee27/.gemini/antigravity/scratch/Takolio-vnext`)
- **Feature Branch & PR:** `feat/takolio-vnext-ui-architecture` → **PR #61** (`https://github.com/hello-tako/Takolio/pull/61`, base `origin/main` `87f279a055e028336ea334cc51c7ab4224f30ef4`)
- **Staging Preview URL (`frigo-staging` Worker Version `50d4df9a-6283-46de-96ea-b2924a4cd189`):**
  - `https://vnext-g12-frigo-staging.tungbipdz.workers.dev` (immutable: `https://50d4df9a-frigo-staging.tungbipdz.workers.dev`)
- **Owner Signoffs:** Gate `G02` approved `2026-11-18T14:36:13+09:00`; Gate `G12` (`PR #61` + Staging Preview + `M09/M11/M12` copy) approved `2026-11-18T16:11:00+09:00`.

---

## 1. Old → New Route & SEO Compatibility Matrix (`DDR-001` Option A)

| Surface / Cohort | Screen IDs | Canonical vNext Route(s) | Legacy / Alias Compatibility | Auth / Guard Contract |
| :--- | :--- | :--- | :--- | :--- |
| **Public Landing & Features** | `M01–M08` | `/landing`, `/how-it-works`, `/features/{ai-scan,fridge,meal-planning,recipes,cooking,shopping}` | `/` redirects unauthenticated visitors to `/landing`; `sitemap.xml` & `robots.txt` index all public pages | Public (redirects authenticated users on `/landing` to `/` or `/onboarding`) |
| **Public Pricing, FAQ, Stories, Legal** | `M09–M12` | `/pricing`, `/faq`, `/stories`, `/about`, `/contact`, `/privacy`, `/terms` | New routes; zero conflict with authenticated app paths | Public (`M09/M11/M12` carry transparent `BLOCKED_CONTENT` notices) |
| **Authentication** | `A01–A08` | `/auth` (`?mode=choose|login|register|forgot|reset|transfer-deferred`, `?provider=google`), `/auth/verify` | 100% URL-compatible with `HEAD`; preserves `returnTo` & `DEC-012` transfer refusal | Unauthenticated or Guest |
| **Onboarding (6 Steps)** | `O01–O06` | `/onboarding/{welcome,goals,household,preferences,start,ready}` | `/onboarding` defaults cleanly into step 1; `POST /api/v1/onboarding` server ack required | Authenticated / Guest (`!isOnboarded`) |
| **Home, Search & Fridge** | `C01–C08` | `/`, `/search`, `/fridge`, `/fridge/:id`, `/inventory-reconciliation` | `/inventory` → `/fridge`; `/ingredients/:id` & `/inventory/:id` preserved | Session + Household (`SessionBoundary`) |
| **AI Scan & Receipt OCR** | `C09–C14` | `/scan`, `/scan/:id/review`, `/scan/receipt-review` | `/scan/result` preserved | Session + Household + Mandatory human review |
| **Recipes & Cooking** | `C15–C22` | `/recipes` (`?q=&cuisine=&category=&maxTime=&noBuy=&view=saved`), `/recipes/:slug`, `/cook/:slug`, `/cooking/complete` | `/recipes/id/:id` & `/cooking/:id` preserved | Session + Household; zero stock deduction until `C22` confirm |
| **Meal Planner & Shopping** | `C23–C29` | `/planner`, `/planner/new`, `/planner/:planId`, `/planner/:planId/meal/:slotId`, `/planner/:planId/shopping`, `/shopping` | `/week/*` bidirectional redirects & `MEAL_PLANNER_ENABLED` flag ON/OFF preserved | Registered account for planner; offline outbox for `/shopping` |
| **Account, Plus & System States** | `C30, U01–U10, S01–S08` | `/notifications`, `/me`, `/me/preferences`, `/me/household`, `/settings/{app,notifications,planning,privacy}`, `/plus`, `*` (`S02` 404) | `/profile` → `/me`, `/family` → `/me/household`, `/settings` → `/settings/app` | `U06` & `U10` show honest `UnavailableState` (`RFC-001/002`); `U07/U08` Red Zone untouched |
| **Admin Console** | `AD01–AD11` | `/admin/login`, `/admin/`, `/admin/{users,users/:id,households,billing,ai,recipes,system,audit,settings}` | Separate `dist/admin` bundle; `AD06` billing read-only | Separate Admin cookie, CSRF & RBAC permissions |

---

## 2. Three-Tier Instant Rollback Strategy (Zero Data Risk)

Because **0 database migrations**, **0 Worker endpoints**, **0 domain schemas**, and **0 `public/takolio/v1/**` brand files** were modified (`341/341` protected files byte-for-byte identical to `87f279a055e028336ea334cc51c7ab4224f30ef4`):

1. **Session-Level Instant Diagnostic Rollback (< 1 second, zero deploy):**
   - Append `?vnext=0` to any Consumer App URL (`/fridge?vnext=0`) or Admin URL (`/admin/?vnext=0`).
   - Persists `0` in `sessionStorage` and immediately restores the exact `origin/main` v1 component tree for that browser tab.
2. **Environment-Variable Canary / Global Kill-Switch (Build/Preview config, zero code revert):**
   - Build with `VITE_VNEXT_UI_PREVIEW=false pnpm build` to disable vNext across both `dist/client` and `dist/admin` while keeping static assets harmlessly inert.
3. **Git Branch / Deployment Rollback:**
   - All work resides on isolated branch `feat/takolio-vnext-ui-architecture`; `origin/main` (`87f279a055e028336ea334cc51c7ab4224f30ef4`) has not been merged or deployed.

---

## 3. Pre-Merge & Staging Promotion Checklist (Requires Explicit Owner Command)

- [x] **Red-Zone Integrity:** `341/341` protected files verified unchanged via SHA-256 (`tests/unit/vnext-g02-foundation.test.tsx`).
- [x] **Asset Provenance:** `87` original SVG/WebP/PNG exports in `public/takolio/vnext/**` verified (`0` raster-in-SVG, EXIF stripped, 12 canonical dish slugs verified).
- [x] **85/85 Screen Coverage:** All `85` Screen IDs mapped, implemented/guarded honestly, and captured at `390×844` & `1440×900` (`170` PNGs).
- [x] **Automated Gates:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm check:migrations`, and Playwright + Axe WCAG 2.2 AA verified locally.
- [x] **Owner Gate G12 Executed Actions (`2026-11-18T16:18–16:21+09:00`):**
  1. [x] Opened **PR #61** (`https://github.com/hello-tako/Takolio/pull/61`) from `feat/takolio-vnext-ui-architecture` → `main` (**NOT merged**).
  2. [x] Uploaded Cloudflare Staging Preview `https://vnext-g12-frigo-staging.tungbipdz.workers.dev` (Worker Version `50d4df9a-6283-46de-96ea-b2924a4cd189`, Cloudflare Access protected, preserving `main` `previous-authority`).
  3. [x] Locked owner-approved `M09 / M11 / M12` copy (`APPROVED_G12_OWNER_COPY`).
- [ ] **Hard Stop — Requires Separate Explicit Owner Command:**
  1. Merge **PR #61** into `main`?
  2. Deploy merged `main` SHA to canonical Staging (`staging.takolio.app`) / Production (`takolio.app`)?
