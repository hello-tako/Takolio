# CHANGES.md — Cumulative vNext Changes (`G00 → G02`)

- **Base Commit (`origin/main`):** `87f279a055e028336ea334cc51c7ab4224f30ef4`
- **Feature Branch:** `feat/takolio-vnext-ui-architecture` (`/Users/tunbee27/.gemini/antigravity/scratch/Takolio-vnext`)
- **Protected Red-Zone Files Modified:** **`0 / 341`** (verified byte-for-byte via SHA-256 in `tests/unit/vnext-g02-foundation.test.tsx`)

## 1. New vNext Design System, Primitives & 8 Pilot Screens (`src/web/vnext/**` & `src/admin/vnext/**`)
- `src/web/vnext/styles/tokens.css` — Tokenized CSS custom properties for Brand Directions `A` (Kitchen Studio Leaf & Coral — default), `B` (Botanical Market Herb & Linen), and `C` (Warm Terracotta Hearth & Slate), self-hosted Vietnamese variable fonts (`Nunito` + `Plus Jakarta Sans`), `prefers-reduced-motion` guard, and WCAG 2.2 AA hardened Coral CTA (`#C8432B`, `5.38:1`).
- `src/web/vnext/feature.ts` — Non-destructive opt-in preview flag (`?vnext=1` / `sessionStorage`) and `?dir=a|b|c` direction switcher.
- `src/web/vnext/components/VNextIcons.tsx` — `53` pure editable `24×24` SVG vector icons (`strokeWidth=1.85`, round caps/joins, `aria-hidden` vs labeled semantics).
- `src/web/vnext/components/VNextMedia.tsx` — `BrandLockup`, `MascotIllustration` (8 poses + pure SVG fallback), and `VerifiedDishImage` (strictly maps canonical Vietnamese recipe slugs; renders honest pure-SVG fallback when unverified — never substitutes unrelated dish photos).
- `src/web/vnext/components/Primitives.tsx` — `TkvButton`, `TkvIconButton`, `TkvSurface`, `TkvBadge`, `TkvChip`, `TkvTextField`, `TkvSkeleton`, `TkvEmptyState`, `TkvErrorState` (`44×44px` minimum touch targets, visible `:focus-visible` ring).
- `src/web/vnext/components/Shells.tsx` — `G02DirectionPreviewBar`, `PublicMarketingShell`, and `ConsumerStudioShell` (mobile 5-root bottom tab bar + contextual top scan CTA; desktop 264px left sidebar workbench).
- `src/web/vnext/screens/M01LandingPilot.tsx` — Pilot `M01` (`Landing — Hôm nay ăn gì?`).
- `src/web/vnext/screens/A02LoginPilot.tsx` — Pilot `A02` (`Đăng nhập tài khoản`, preserving `POST /api/v1/auth/login`, `GoogleAuthSection`, `capturePrivateSession`, and `DEC-012` guest transfer refusal).
- `src/web/vnext/screens/O03HouseholdPilot.tsx` — Pilot `O03` (`Gia đình và khẩu phần`, `1..20` server-truth household size with `familyPreferencesApi` revision concurrency).
- `src/web/vnext/screens/C01HomePilot.tsx` — Pilot `C01` (`Hôm nay ăn gì?`, wired to `useHomePlan`, `api.getInventory`, `api.getRecipeDiscovery`, `presentExpiry`).
- `src/web/vnext/screens/C03InventoryPilot.tsx` — Pilot `C03` (`Tủ lạnh của tôi`, URL-synced filters, distinct empty-fridge vs empty-filter states, `If-Match` versioned quantity updates, estimated expiry qualification).
- `src/web/vnext/screens/C18RecipeDetailPilot.tsx` — Pilot `C18` (`Chi tiết món ăn`, dynamic serving scaling, `evaluateRecipeAvailability` quantity+unit shortfall check, shopping list shortfall add, sourced nutrition truth).
- `src/web/vnext/screens/C23PlannerPilot.tsx` — Pilot `C23` (`Thực đơn tuần`, empty/guest/populated 7-day workbench states over `usePlanner`).
- `src/web/vnext/screens/G02ReviewHubPage.tsx` & `src/web/vnext/pilot-router.tsx` — Owner review board (`/vnext`) and reversible route wrapper (`withVNextPilot`).
- `src/admin/vnext/{feature.ts,AdminOverviewVNext.tsx,admin-vnext.css}` — Pilot `AD02` (`Tổng quan hệ thống` at `/admin/?vnext=1` in separate `dist/admin` bundle).

## 2. Reversible Preview Wiring in Existing Frontend Entrypoints (`4` files)
- `src/web/App.tsx` — Lazy-loaded `/vnext` review hub + `withVNextPilot` wrappers on `/landing`, `/auth`, `/onboarding/*`, `/`, `/fridge`, `/recipes/:slug`, `/planner` (default runtime behavior without `?vnext=1` remains 100% identical to `origin/main`).
- `src/web/components/layout/AppLayout.tsx` — Renders pilot screen's own `ConsumerStudioShell` when `?vnext=1` is active on a pilot route; preserves `KitchenHeader`/`BottomNav` unchanged otherwise.
- `src/admin/App.tsx` & `src/admin/components/AdminShell.tsx` — Reversible `?vnext=1` preview switch for `AD02` (`AdminOverviewVNext` + evergreen ops theme).

## 3. Original Candidate Brand, Mascot, Culinary & Icon Assets (`public/takolio/vnext/**`)
- `53` pure-vector `24×24` SVG icons (`public/takolio/vnext/icons/*.svg`).
- `6` pure-vector SVG brand/mascot/PWA masters (`public/takolio/vnext/brand/*.svg`, `mascot/mascot-master-vector.svg`, `pwa/pwa-icon-maskable.svg` + `192/512` PNGs).
- `18` EXIF-stripped `.webp` + `-640w/-256w.webp` exports (`mascot-concept-sheet-abc`, `pose-01..08`, 6 verified Vietnamese dishes, `hero-m01-kitchen-studio-table`, `m03-fresh-produce-scan`, `og-1200x630`, `og-1080x1080`) — all tracked in `docs/handoff/vnext/ASSET_REGISTRY.csv` with `owner_approval="PENDING"`.

## 4. Tests & Handoff Governance (`tests/unit/vnext-g02-foundation.test.tsx` & `docs/handoff/vnext/**`)
- `tests/unit/vnext-g02-foundation.test.tsx` — Automated enforcement of 341 protected file SHA-256 hashes, 85/85 screen matrix coverage, pure-vector SVG purity (`0` embedded bitmaps), canonical recipe slug verification, `ASSET_REGISTRY.csv` integrity, 53 icon renders, and live pilot component mounts.
- Full `G00`, `G01`, and `G02` handoff ledgers in `docs/handoff/vnext/`.
