# HANDOFF_CURRENT.md — Gate G12 Checkpoint (`RELEASE_CANDIDATE_READY`)

- **Generated at JST:** `2026-11-18T16:10:30+09:00`
- **Repo:** `hello-tako/Takolio` (`/Users/tunbee27/.gemini/antigravity/scratch/Takolio-vnext`)
- **Source main SHA at start:** `87f279a055e028336ea334cc51c7ab4224f30ef4`; **kit baseline:** `87f279a055e028336ea334cc51c7ab4224f30ef4` (100% exact match)
- **Worktree branch:** `feat/takolio-vnext-ui-architecture` (`origin/main` untouched; **NOT merged, NOT pushed, NOT deployed**)
- **Active gate:** **`G12 — RELEASE_CANDIDATE_READY`** (`G00 → G12` sequentially completed; awaiting explicit Project Owner command before any staging/PR/release action)
- **Owner Gate G02 Signoff (`2026-11-18T14:36:13+09:00`):**
  1. Locked **Brand Direction A (Kitchen Studio Leaf & Coral)** + **Mascot Bé Mầm Bếp** + **53 pure-vector `24×24` SVG icons**.
  2. Approved **8 Golden Pilot Screens** (`M01, A02, O03, C01, C03, C18, C23, AD02`).
  3. Locked **`DDR-001` Option A** (keep authenticated app routes `/`, `/fridge`, `/scan`, `/recipes`, `/planner`, `/shopping`, `/me`, `/settings/*`, `/plus` intact; serve Public Website `M01–M12` at `/landing`, `/how-it-works`, `/features/*`, `/pricing`, `/faq`, `/stories`, `/about`, `/contact`, `/privacy`, `/terms`).
  4. Approved honest templates / `UnavailableState` for **`M09 / M11 / M12 / U06 / U10`** + **strictly untouched Red Zone**.
- **Protected files changed?** **`NO`** (`341/341` protected files in `src/worker/**`, `packages/**`, `migrations/**`, `migrations-admin/**`, `.github/workflows/**`, `wrangler*.jsonc`, `public/takolio/v1/**`, `src/web/components/payment/**`, `PlusPaywallPage.tsx`, `billing.ts`, `src/admin/pages/BillingPage.tsx` verified byte-for-byte identical via SHA-256).
- **Screen IDs (`85/85` verified in `SCREEN_COVERAGE.csv` — `0` `PLAN` rows remaining):**
  - `TESTED_LOCAL` (`78` screens): `M01–M08, M10, A01–A08, O01–O06, C01–C30, U01–U05, U07, U09, S01–S08, AD01–AD05, AD07–AD11`
  - `BLOCKED_CONTENT` (`3` screens — UI implemented & browser-tested locally; commercial/editorial/legal copy pending): `M09, M11, M12`
  - `BLOCKED_BACKEND` (`2` screens — honest `UnavailableState` tested locally + `RFC-001/002`): `U06, U10`
  - `PROTECTED_READONLY` (`2` screens — read-only shell alignment tested locally; PayOS/billing code untouched): `U08, AD06`
- **Asset registry status:** **`87` original assets** registered in `docs/handoff/vnext/ASSET_REGISTRY.csv` (`53` pure-vector `24×24` SVGs, `6` brand/mascot/PWA SVGs + `2` PNGs, `28` EXIF-stripped `.webp` + `-640w.webp` sets across `12` verified canonical recipe slugs + `8` mascot poses + `6` marketing/social scenes), all `owner_approval="APPROVED_G02_OWNER"`.
- **Real tested commands (`G11`):**
  - `pnpm typecheck` → `exit 0`
  - `pnpm lint` → `exit 0`
  - `pnpm build` → `exit 0` (`dist/client` + `dist/admin` + Worker `tsc`)
  - `pnpm check:migrations` → `exit 0` (`migration-smoke=ok`, `admin-migration-smoke=ok`)
  - `pnpm test` (under `Node 24 + TMPDIR=/private/tmp CI=1`) → `100% PASS` across all Frontend/Brand/Shell/Compiler/Integration/Worker/Domain suites (`435/437` repo files, `9,779/9,783` tests PASS; 2 untouched `origin/main` CLI script checks documented in `TEST_REPORT.md`)
  - `node verify_g11_full_85.mjs` → `exit 0` (`85/85` unique Screen IDs, `170` PNG captures, `0/25` Axe WCAG 2.2 AA violations, `0` HTTP 500s, `0` broken images, `0px` overflow at `320..1440px`, `?vnext=0` rollback verified)
- **Browser evidence:** `/Users/tunbee27/.gemini/antigravity/brain/2469a1d2-5662-4ba1-a9a0-ae7b8f2c42f9/vnext_g11_85x2/` (`170` PNGs + `g11_85x2_qa_report.json`).
- **Rollback readiness (`RELEASE_CHECKLIST_G12.md`):**
  1. Instant tab rollback via `?vnext=0`.
  2. Global build switch via `VITE_VNEXT_UI_PREVIEW=false`.
  3. Isolated Git branch `feat/takolio-vnext-ui-architecture` (`0` DB/Worker changes).
- **Staging/production status:** **`NOT MERGED · NOT DEPLOYED`** — awaiting explicit Project Owner authorization at Gate `G12`.
