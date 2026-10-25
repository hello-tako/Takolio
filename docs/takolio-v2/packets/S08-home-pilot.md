# BEGIN TASK PACKET S08

# TASK PACKET S08 — Pilot Screen 08 (`08-home` — Trang chủ có thực đơn)

**STATUS:** `TECHNICAL_VERIFIED_PENDING_FINAL_OWNER_DESIGN_APPROVAL` (tách bạch rõ 3 trạng thái: (1) Quyền thực thi S08: `AUTHORIZED`; (2) Kiểm thử kỹ thuật S08: `PASS` tại mốc `2026-10-22T14:11:51.306Z` — `145/145` unit tests + Playwright 7 viewports, `200%` text zoom, `Tab`/`Shift+Tab`/`Enter`, `@axe-core/playwright` `0` violations; (3) Phê duyệt thiết kế cuối cùng từ Owner: `PENDING`)\
**PLAN_SHA256:** `90364b63063242ac7cdecefea1f56b7c30ff611661e29d371260350b05eaf06e`\
**REPO_MAIN_SHA:** `0322a9197bee4a4a42d95cc150f8d4fff6d53ba8`\
**CURRENT_SOURCE_SHA:** `5db70a578764ccdb9ad458a21833fec5b6c04741`\
**BRANCH:** `feat/takolio-culinary-experience` (never `main`)\
**OWNER_SCOPE_APPROVAL:** `YES (EXECUTION AUTHORIZATION ONLY) — Owner authorized S08 execution ("tiếp tục hoàn thành theo spec") on 2026-10-22`\
**TECHNICAL_VERIFICATION_STATUS:** `PASS (2026-10-22T14:11:51.306Z) — 145/145 unit tests (4 test files) + Playwright 7 viewports, 200% text zoom & Tab/Shift+Tab/Enter keyboard navigation + axe-core 0 violations verified`\
**FINAL_OWNER_DESIGN_APPROVAL:** `PENDING`\
**REFERENCE_IDS:** `08-home` (paired state awareness with `09-home-empty`)\
**REFERENCE_SHA256:** `23244c994a4b95ba7b20168e6fb72f62367040279cf6b8e310c82af390b4f540` (`references/screens/08-home.png`)

## Objective and must-not-change

### Objective

Hoàn thiện presentation và hệ thống phân cấp bố cục (layout hierarchy) của Pilot Screen `08-home` (`/`, trạng thái người dùng đã đăng nhập và có thực đơn sắp tới) theo chuẩn Takolio V2 Kitchen Companion tại `390×844` cùng các kích thước responsive (`320`, `360`, `430`, `768`, `1024`, `1440px`) và `200%` text zoom, đồng thời bảo toàn tuyệt đối mọi trạng thái thay thế của Home (`requiresAccount`, `isPending`, `isError`, `empty plan`, `meal.state` = `ready` / `pending` / `error` / `empty`, `requiresReview`) và toàn bộ data bindings thực tế (`useHomePlan`, `presentExpiry`, `api.getInventory`, `api.getRecipeDiscovery`).

### Must not change

- Không hardcode tên món ăn concept, số lượng nguyên liệu giả hoặc chuỗi demo tĩnh từ `references/index.html`.
- Không crop, nhúng hoặc phát hành ảnh JPG concept (`design-lock/references/assets/*.jpg`) hay screenshot PNG.
- Giữ nguyên logo và mascot chính thức từ `src/web/lib/takolio-brand.ts` và `public/takolio/v1/`.
- Không thay đổi backend, Worker, D1, API contracts, auth/session boundaries, household isolation, planner feature flag semantics (`isMealPlannerEnabled`, `isMealCompositionEnabled`), hoặc mã nguồn thanh toán PayOS/Plus.
- Bảo toàn `[data-testid="t18c-home-primary"]`, `[data-testid="t18c-home-recommendations"]`, `[data-testid="home-use-soon-expiry"]`, `data-expiry-kind` (`KNOWN`, `ESTIMATED`, `UNKNOWN`) và toàn bộ contract kiểm thử Unit/E2E hiện có.
- Không sửa global `:root` tokens (để bảo toàn tương thích thanh toán); mọi tinh chỉnh CSS cho S08 phải được scope trong `.takosan-rebuild[data-page='home-s08']`.

## Current source evidence and dependencies

Verified runtime files:

```text
/Users/tunbee27/Documents/New project/Takolio/src/web/pages/HomePage.tsx
/Users/tunbee27/Documents/New project/Takolio/src/web/lib/home-plan.ts
/Users/tunbee27/Documents/New project/Takolio/src/web/lib/use-home-plan.ts
/Users/tunbee27/Documents/New project/Takolio/src/web/components/common/TopBar.tsx
/Users/tunbee27/Documents/New project/Takolio/src/web/components/common/KitchenHeader.tsx
/Users/tunbee27/Documents/New project/Takolio/src/web/components/cooking/CookingTechniqueVisual.tsx
/Users/tunbee27/Documents/New project/Takolio/src/web/styles/takosan-tokens.css
/Users/tunbee27/Documents/New project/Takolio/src/web/styles/kitchen-daily.css
/Users/tunbee27/Documents/New project/Takolio/src/web/styles/kitchen-upgrade.css
```

Dependencies & tách bạch trạng thái với A01:

- `TASK PACKET A01` (`Phase A01-A` + `Phase A01-B`) đã đạt kiểm thử kỹ thuật (`38/38` unit tests + Playwright `200%` zoom & `Tab`/`Shift+Tab`/`Enter` tại `2026-10-22T11:38:36.635Z`), trong khi phê duyệt thiết kế cuối cùng của Owner cho A01 vẫn là `PENDING`.
- Kết quả kiểm thử kỹ thuật của A01 không thay thế cho kiểm thử kỹ thuật của S08, và quyền thực thi S08 không đồng nghĩa với phê duyệt thiết kế cuối cùng từ Owner (`PENDING`).

## Allowed files and forbidden files

### Allowed files

```text
/Users/tunbee27/Documents/New project/Takolio/src/web/pages/HomePage.tsx
/Users/tunbee27/Documents/New project/Takolio/src/web/components/common/TopBar.tsx
/Users/tunbee27/Documents/New project/Takolio/src/web/components/common/KitchenHeader.tsx
/Users/tunbee27/Documents/New project/Takolio/src/web/styles/takosan-tokens.css
/Users/tunbee27/Documents/New project/Takolio/docs/takolio-v2/packets/S08-home-pilot.md
/Users/tunbee27/Documents/New project/Takolio/docs/takolio-v2/evidence/
/Users/tunbee27/Documents/New project/Takolio/memory-bank/activeContext.md
/Users/tunbee27/Documents/New project/Takolio/memory-bank/progress.md
```

Ưu tiên phạm vi hẹp: Mặc định giữ nguyên `TopBar.tsx` và `KitchenHeader.tsx` nếu có thể đạt toàn bộ yêu cầu thông qua `HomePage.tsx` và CSS được scope riêng dưới `.takosan-rebuild[data-page='home-s08']` trong `src/web/styles/takosan-tokens.css`.

### Forbidden files

```text
/Users/tunbee27/Documents/New project/Takolio/src/worker/
/Users/tunbee27/Documents/New project/Takolio/migrations/
/Users/tunbee27/Documents/New project/Takolio/src/web/services/
/Users/tunbee27/Documents/New project/Takolio/src/web/stores/
/Users/tunbee27/Documents/New project/Takolio/src/web/lib/home-plan.ts
/Users/tunbee27/Documents/New project/Takolio/src/web/lib/use-home-plan.ts
/Users/tunbee27/Documents/New project/Takolio/src/shared/payment.ts
/Users/tunbee27/Documents/New project/Takolio/src/web/pages/PlusPaywallPage.tsx
/Users/tunbee27/Documents/New project/Takolio/public/takolio/v1/logo/
/Users/tunbee27/Documents/New project/Takolio/public/takolio/v1/mascot/
/Users/tunbee27/Documents/New project/Takolio/src/admin/
```

## Original asset deliverables

- Tái sử dụng bộ 6 icon SVG A01 (`home`, `fridge`, `recipe`, `mealPlan`, `profile`, `scan`) đã tích hợp trong navigation và các tài sản logo/mascot chính thức của Takolio.
- Ảnh món ăn trên Home bắt buộc đi qua `resolveRecipeImage` / `RecipeMedia` với nguồn gốc xác thực hoặc fallback ngữ nghĩa trung thực (`data-recipe-media="missing"`) — tuyệt đối không crop hay dùng ảnh JPG từ `design-lock/references/assets/*.jpg`.

## UI/interaction specification

### 1. Cấu trúc vùng giao diện & phân cấp hiển thị

- **Root container (`HomePage.tsx`):** Gắn `data-page="home-s08"` trên `.takosan-rebuild` để cô lập hoàn toàn các tinh chỉnh CSS của S08, bảo đảm khoảng đệm đáy (`padding-bottom`) đủ tránh thanh điều hướng dưới trên mobile (`--nav-mobile` + `safe-area-inset-bottom`).
- **Header & Greeting (`TopBar` + `KitchenPageHeading`):** Giữ lời chào tiếng Việt lấy từ `displayName` (`Chào <tên>` hoặc fallback `Căn bếp của bạn`), tiêu đề `<h1>Hôm nay ăn gì?</h1>` với font heading `Nunito` và mô tả bằng font body `Plus Jakarta Sans`.
- **Kitchen Loop Strip (`KitchenLoopStrip`):**
  - Hiển thị đúng `activeStage` (`plan` khi có thực đơn, `recipes` khi có nguyên liệu, `fridge` khi tủ lạnh trống).
  - `summaryText` phản ánh trung thực tổng số nguyên liệu trong tủ (`inventory.length`) và tổng số nguyên liệu cần dùng sớm thực tế trong tủ (`useSoonTotalCount`), không bị sai lệch bởi giới hạn hiển thị 4 mục của danh sách bên dưới.
- **Planned Meal Hero (`PlannedMeal` trong `[data-testid="t18c-home-primary"]`):**
  - Là điểm nhấn thị giác chính của cột primary; gắn `data-meal-state={meal?.state ?? 'no-upcoming'}` trên `.home-plan-card`.
  - Khi có `image` hợp lệ từ `resolveRecipeImage(meal.recipe)`, hiển thị `RecipeMedia.home-meal-media` cân đối cạnh `.home-plan-copy` trên màn hình rộng và xếp dọc gọn gàng trên màn hình hẹp/zoom 200%, không gây tràn ngang.
  - Bảo toàn đầy đủ 10 trạng thái thực đơn (`requiresAccount`, `isPending`, `isError`, `!plan`, `!plan.meal`, `meal.state === 'pending' | 'error' | 'empty' | 'ready'`, `plan.requiresReview`) và liên kết CTA `meal?.href ?? plan.href`.
- **Tổng quan thực đơn (`.home-plan-summary`):** Bảo toàn logic `plan.planned === null` (không hiển thị `null` thành `0`), `${plan.planned}/${plan.total} bữa đã xếp`, `plan.budgetText` và link `Xem lịch` (`plan.href`).
- **Nên dùng sớm (`#use-soon-heading` / `.home-stock-list`):** Giữ nguyên lọc `use_soon` / `expiring`, sắp xếp theo `daysUntil(presentExpiry(item).date)`, hiển thị tối đa 4 mục, bảo toàn `data-testid="home-use-soon-expiry"` và `data-expiry-kind` (`KNOWN`, `ESTIMATED`, `UNKNOWN`).
- **Gợi ý cho bữa tới (`[data-testid="t18c-home-recommendations"]`):** Bảo toàn thông báo nguồn thiết bị (`source === 'device'`), danh sách `RecipeCard`, trạng thái rỗng/lỗi/đang tải và link `Chỉ xem món đủ lượng trong tủ` (`/recipes?noBuy=true`).

### 2. Accessibility & Responsive

- **Ma trận kích thước bắt buộc:** `320×420`, `360×844`, `390×844`, `430×932`, `768×1024`, `1024×900`, `1440×900`.
- **Không tràn ngang:** `document.documentElement.scrollWidth <= window.innerWidth` ở mọi kích thước trên và khi phóng to chữ `200%` (`document.documentElement.style.fontSize = '200%'`).
- **Touch targets & Focus:** Các liên kết hành động chính (`.kitchen-primary-link`, `.kitchen-text-link`, `.kitchen-discovery-link`, `.home-stock-item`) đạt chiều cao tối thiểu `44px` (`var(--touch-target)`), có `:focus-visible` rõ nét và `scroll-margin-block` để không bị sticky header hay bottom navigation che khuất khi điều hướng bằng `Tab` / `Shift+Tab` / `Enter`.
- **Reduced motion:** Tôn trọng `@media (prefers-reduced-motion: reduce)` trong phạm vi `[data-page='home-s08']`.

## Implementation steps

- [x] Cập nhật đặc tả chi tiết vào `docs/takolio-v2/packets/S08-home-pilot.md` và kiểm tra `validate_handoff.py` (`FORMAT_CHECK=PASS`).
- [x] Tinh chỉnh có kiểm soát trong `src/web/pages/HomePage.tsx` và CSS được scope riêng dưới `.takosan-rebuild[data-page='home-s08']` trong `src/web/styles/takosan-tokens.css` (không chạm logic domain/query).
- [x] Chạy `pnpm typecheck`, `pnpm lint`, Vitest unit tests (`4 test files / 145/145 unit tests PASS`: `tests/unit/ui02-surfaces.test.tsx`, `tests/unit/takosan-brand.test.tsx`, `tests/unit/inventory-truth.test.ts`, `tests/unit/recipe-media-presentation.test.ts`), và `pnpm build:web`.
- [x] Chạy kiểm chứng Playwright trực tiếp trên bản build preview cho route `/` qua các viewport (`320×420`, `360×844`, `390×844`, `430×932`, `768×1024`, `1024×900`, `1440×900`), kiểm tra `200%` text zoom, điều hướng bàn phím `Tab` / `Shift+Tab` / `Enter`, `@axe-core/playwright` (`0` violations), và chụp ảnh minh chứng (`s08-home-390x844.png`, `s08-home-320x420.png`, `s08-home-768x1024.png`, `s08-home-1440x900.png`, `s08-home-390x844-zoom200.png`) tại mốc `2026-10-22T14:11:51.306Z`.
- [x] Xuất `docs/takolio-v2/evidence/s08-playwright-receipt.json` và `docs/takolio-v2/evidence/s08-visual-review-receipt.md` tách bạch rõ 3 trạng thái: (1) Quyền thực thi S08 (`AUTHORIZED`), (2) Kết quả kiểm thử kỹ thuật S08 (`PASS` tại mốc `2026-10-22T14:11:51.306Z`), (3) Phê duyệt thiết kế cuối cùng từ Owner (`PENDING`).
- [ ] Final Owner design approval on rendered S08 deliverables (`PENDING`).

## Functional and visual test commands

```sh
cd "/Users/tunbee27/Documents/New project/Takolio"
python3 -c "import zipfile, subprocess, sys; z=zipfile.ZipFile('takolio-cline-os-kit-20261021.zip'); code=z.read('TAKOLIO_V2_ASTRA_ARGON_CLINE_OS_KIT/scripts/validate_handoff.py').decode(); sys.exit(subprocess.call([sys.executable, '-c', code, '--plan', 'docs/takolio-v2/PLAN_CONTRACT.md', '--packet', 'docs/takolio-v2/packets/S08-home-pilot.md']))"
pnpm typecheck
pnpm lint
pnpm exec vitest run tests/unit/ui02-surfaces.test.tsx tests/unit/takosan-brand.test.tsx tests/unit/inventory-truth.test.ts tests/unit/recipe-media-presentation.test.ts --maxWorkers=1
pnpm build:web
```

## Stop / revert / review

- Dừng ngay lập tức nếu bất kỳ file được bảo vệ nào bị ảnh hưởng hoặc nếu bất kỳ bài kiểm thử nào thất bại.
- Chỉ hoàn tác các thay đổi thuộc phạm vi S08 nếu phát sinh lỗi và báo cáo `BLOCKED` kèm log chi tiết.
- Sau khi hoàn tất kiểm thử kỹ thuật S08, giữ nguyên trạng thái phê duyệt thiết kế cuối cùng từ Owner là `PENDING`.

# END TASK PACKET S08
