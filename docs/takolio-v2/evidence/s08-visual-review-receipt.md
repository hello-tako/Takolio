# S08 Visual / Diff & Functional Review Receipt (`08-home` — Trang chủ có thực đơn)

**Review command:** `prompts/06_ASTRA_DIFF_AND_VISUAL_REVIEW.md`
**Date:** `2026-10-22` local (`2026-10-22T14:11:51.306Z` UTC)
**Status:** `TECHNICAL_VERIFIED_PENDING_FINAL_OWNER_DESIGN_APPROVAL`
**Scope:** `TASK PACKET S08` — Pilot Screen `08-home` (`/` signed-in with planned meal present + paired `09-home-empty` state awareness)

## Tách bạch trạng thái S08 (3 phần độc lập)

1. **Quyền thực thi S08 (S08 Execution Authorization):** `AUTHORIZED` (Owner đã chỉ đạo thực thi đợt tiếp theo theo spec S08 vào ngày `2026-10-22`).
2. **Kết quả kiểm thử kỹ thuật đã đạt (Technical Verification Result):** `PASS` tại mốc `2026-10-22T14:11:51.306Z` — `pnpm typecheck` PASS, `pnpm lint` PASS, `4 test files / 145/145 unit tests PASS` (`ui02-surfaces.test.tsx`, `takosan-brand.test.tsx`, `inventory-truth.test.ts`, `recipe-media-presentation.test.ts`), `pnpm build:web` PASS + Playwright live verification PASS trên 7 kích thước (`320×420`, `360×844`, `390×844`, `430×932`, `768×1024`, `1024×900`, `1440×900`), `200%` text zoom (`scrollWidth <= innerWidth`), điều hướng bàn phím `Tab` / `Shift+Tab` / `Enter`, và `@axe-core/playwright` (`0` violations).
3. **Trạng thái phê duyệt thiết kế cuối cùng từ Owner (Final Owner Design Approval):** `PENDING` (chờ Owner nghiệm thu và phê duyệt thiết kế cuối cùng cho cả A01 và S08; kết quả kiểm thử kỹ thuật và quyền thực thi không thay thế phê duyệt thiết kế cuối cùng từ Owner).

## Repository pin

- Branch: `feat/takolio-culinary-experience`
- HEAD: `5db70a578764ccdb9ad458a21833fec5b6c04741`
- Frozen plan/packet base: `0322a9197bee4a4a42d95cc150f8d4fff6d53ba8`

## Scope and protected-system review

- Tracked product files modified in `TASK PACKET S08` (strictly matching the S08 allowlist):
  - `src/web/pages/HomePage.tsx` (`data-page="home-s08"`, `data-meal-state` on `.home-plan-card`, truthful `useSoonAll.length` in `KitchenLoopStrip` summary)
  - `src/web/styles/takosan-tokens.css` (scoped `.takosan-rebuild[data-page='home-s08']` rules for mobile bottom nav clearance, `.home-plan-card` / `.home-meal-media` responsive layout, `44px` minimum touch targets, `:focus-visible` + `scroll-margin-block`, and `prefers-reduced-motion: reduce`)
- Shared components (`TopBar.tsx`, `KitchenHeader.tsx`) and all protected paths (`public/takolio/v1/*`, `src/worker/*`, `migrations/*`, `src/web/services/*`, `src/web/stores/*`, `src/web/lib/home-plan.ts`, `src/web/lib/use-home-plan.ts`, `src/shared/payment.ts`, `src/web/pages/PlusPaywallPage.tsx`, `src/admin/*`) remained untouched.

## Executed checks & exit codes

1. `validate_handoff.py --plan docs/takolio-v2/PLAN_CONTRACT.md --packet docs/takolio-v2/packets/S08-home-pilot.md` → `FORMAT_CHECK=PASS` (exit `0`).
2. `pnpm typecheck` → `PASS` (exit `0`).
3. `pnpm lint` → `PASS` (exit `0`).
4. `pnpm exec vitest run tests/unit/ui02-surfaces.test.tsx tests/unit/takosan-brand.test.tsx tests/unit/inventory-truth.test.ts tests/unit/recipe-media-presentation.test.ts --maxWorkers=1` → `4 test files / 145/145 unit tests PASS` (exit `0`, including `Home authority and recovery` 10-state contract tests, A01 icon parity tests, inventory expiry truth tests, and recipe media provenance tests).
5. `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build:web` → `PASS` (exit `0`, 2579 modules transformed).
6. Live Playwright + `@axe-core/playwright` verification against isolated local preview (`http://127.0.0.1:5261`, `docs/takolio-v2/evidence/s08-playwright-receipt.json`, timestamp `2026-10-22T14:11:51.306Z`) → `S08_PLAYWRIGHT_VERIFICATION=PASS` (exit `0`):
   - Paired empty state (`09-home-empty`) verified prior to plan creation: `planHeadingText = "Chưa có thực đơn hiện tại"`, `setupCtaHref = "/planner/new"`, `hasMascot = true`.
   - Active planned meal state (`08-home`) verified across all 7 required viewports (`320×420`, `360×844`, `390×844`, `430×932`, `768×1024`, `1024×900`, `1440×900`): `mealState = "ready"`, `planHeadingText = "Cơm chiên kim chi Hàn Quốc"`, `hasPlanSummary = true` (`7/7 bữa đã xếp`), `expiryChips = [{ kind: "ESTIMATED", text: "Ước tính còn 2 ngày" }]`, `primaryCtaHeight = 45px` (`>= 44px`), and `scrollWidth <= innerWidth`.
   - `200%` text zoom check (`document.documentElement.style.fontSize = '200%'`, root font `16px -> 32px`) at `390×844` and `320×420`: `scrollWidth <= innerWidth` (no horizontal overflow), primary CTA visible (`88px` height).
   - Keyboard navigation check (`Tab` / `Shift+Tab` / `Enter`): verified `Tab` and `Shift+Tab` focus restoration on `.home-plan-card .kitchen-primary-link` (`Xem bữa ăn`, `matchesFocusVisible: true`, `outlineStyle: "solid"`, `outlineWidth: "3px"`) and `Enter` navigation to `/planner/102db7d8-f895-4712-ba1a-5fb8d4a898d7/meal/2026-10-23%3Adinner%3A0`.
   - `@axe-core/playwright`: `0` violations at `390×844`, `1440×900`, and `390×844` @ `200%` text zoom.
   - Captured runtime screenshots:
     - `docs/takolio-v2/evidence/s08-home-390x844.png` (`cc1b21e3cb56485c55edff4362d54e8cf9408ffe5db3c1b04050b4ec22cd9d3c`)
     - `docs/takolio-v2/evidence/s08-home-320x420.png` (`0f91bf0a9a73d3f927917c31d7c1d2dba66f8cc0bfeca61317a5c82ea7218202`)
     - `docs/takolio-v2/evidence/s08-home-768x1024.png` (`0012e7ee92604dc2223e2f3e28cd9128090dc9af3c91317a832e5d477a9b01ba`)
     - `docs/takolio-v2/evidence/s08-home-1440x900.png` (`959579faad579506bf74f980bdcb7fb1b902d83fa59e10da1267033030174f30`)
     - `docs/takolio-v2/evidence/s08-home-390x844-zoom200.png` (`760cc0f83a3cf88e4a8ce12de9a088232aa814d68d1698e4f028c4986428cade`)

## Next bounded task

- **Quyền thực thi S08:** `AUTHORIZED`.
- **Kiểm thử kỹ thuật S08:** `PASS` tại mốc `2026-10-22T14:11:51.306Z`.
- **Phê duyệt thiết kế cuối cùng từ Owner (A01 & S08):** `PENDING`. Dừng tại đây chờ Owner nghiệm thu thiết kế; không tự chuyển sang packet tiếp theo, không merge, push hoặc deploy.
