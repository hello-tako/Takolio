# TASK_PACKET_G02.md — Brand & Asset Foundation + 8 Live Pilot Screens

- **Gate:** `G02 — Brand and Assets: Generate original brand & 8 pilot screens`
- **Branch:** `feat/takolio-vnext-ui-architecture` (based on `origin/main` `87f279a055e028336ea334cc51c7ab4224f30ef4`)
- **Status:** `IN_PROGRESS` → target `TESTED_LOCAL` (`OWNER_APPROVAL = PENDING`)

## 1. Bounded Scope & Allowed File Diffs
- `docs/handoff/vnext/**` — G00/G01/G02 audit, architecture, DDRs, RFCs, asset registry, visual comparison, QA report, handoff current.
- `public/takolio/vnext/**` — Versioned candidate brand lockups (A/B/C), pure-vector mascot master, 8 EXIF-stripped mascot pose exports, 52 pure-vector 24px optical-grid SVG icons, 6 verified Vietnamese recipe photos, 2 marketing editorial visuals, PWA/OG candidate exports.
- `src/web/vnext/**` — Scoped Kitchen Studio semantic tokens (`tokens.css` supporting Directions A/B/C), typography loader (self-hosted `Nunito` + `Plus Jakarta Sans`), pure-vector `<VNextIcon />`, `<BrandLockup />`, `<MascotIllustration />`, `<FoodImage />`, 40+ typed UI/kitchen components, G02 Review Hub (`/vnext`), and 7 live data-wired consumer/public/auth/onboarding pilot screens (`M01`, `A02`, `O03`, `C01`, `C03`, `C18`, `C23`).
- `src/web/App.tsx` — Minimal, reversible preview route mount (`/vnext/*` + opt-in `?vnext=1` / `VITE_VNEXT_UI_PREVIEW` switch on pilot routes; zero change when preview switch is off).
- `src/admin/vnext/**` & `src/admin/App.tsx` — Minimal, reversible `?vnext=1` / preview mode for `AD02` Admin Overview (`AdminOverviewVNext.tsx`) preserving `RequireSession`, `RequirePermission("overview.read")`, `useOverview`, and all existing Admin E2E/unit contracts.
- `tests/unit/vnext-g02-foundation.test.tsx` — Automated unit & contract tests for SVG vector purity (0 embedded bitmaps), WCAG contrast tokens, recipe photo provenance, and all 8 pilot screens.

## 2. Red-Zone Protected Paths (Strictly Untouched — 0 Diffs Allowed)
- `src/worker/**`, `packages/domain/**`, `packages/db/**`, `packages/recipes/**`, `packages/ai/**`
- `migrations/**`, `migrations-admin/**`, `.github/workflows/**`, `wrangler*.jsonc`
- `public/takolio/v1/**`, `src/web/components/payment/**`, `src/web/services/billing.ts`

## 3. Verification & Rollback
- **Automated Checks:** Protected file SHA-256 check (`341/341` unchanged), `pnpm typecheck`, `pnpm lint`, `pnpm test` (focused baseline 166 tests + new vNext G02 suite), `pnpm build`, Playwright `390×844` + `1440×900` + `320×640` + `@axe-core/playwright` WCAG 2.2 AA audit + live browser verification.
- **Rollback:** Disable `?vnext=1` / `VITE_VNEXT_UI_PREVIEW` or `git switch main` — zero database, session, or canonical asset impact.
