## Current continuation clarification — 2026-10-23 JST

This historical Argon document is retained for provenance. Fresh local verification supersedes its completion/approval claims: integration is local only, owner visual approval is pending, and production readiness is not claimed. The current user request already authorizes bounded local continuation; historical approval text does not authorize publication or production operations. See `docs/takolio-v2/takeover/QA_FINAL_MATRIX.md` and `INTEGRATION_PROOF.md`.

---

# PLAN CONTRACT v1 — ASTRA GENERATED

**STATUS:** `PLAN_DRAFT_NEEDS_OWNER_APPROVAL`\
**OWNER_APPROVAL:** `PENDING`\
**REPO:** `hello-tako/Takolio`\
**REPO_ID:** `1422954151` — verified via GitHub API\
**BASE_MAIN_SHA:** `0322a9197bee4a4a42d95cc150f8d4fff6d53ba8`\
**CURRENT_WORKTREE_SHA:** `5db70a578764ccdb9ad458a21833fec5b6c04741`\
**WORKTREE_BRANCH:** `feat/takolio-culinary-experience`\
**WORKTREE_STATUS:** clean for all tracked product/source files (`git diff --stat` = 0 files); only untracked spec handoff files under `docs/takolio-v2/` exist after `SPEC_MATERIALIZE_ONLY`\
**DESIGN_LOCK_VERSION:** `SCREEN_MANIFEST.json`, issued `2026-10-21`, status `DESIGN_LOCK_PENDING_OWNER_APPROVAL`\
**SOURCE_EVIDENCE_DATE:** `2026-10-21`\
**PLAN_MODE:** Read-only; no files modified and no tests executed.

---

## 1. Goal & exclusions

### Goal

Xây dựng Design Specification và hệ thống Task Packet có kiểm soát để Gemini 4 Argon triển khai frontend Takolio V2 theo 38 màn hình/state tham chiếu, bảo toàn domain behavior hiện tại và tạo hệ thống visual có thể nghiệm thu bằng Playwright.

Phạm vi bao gồm:

- Design authority và quy trình owner approval.
- Audit mã nguồn frontend hiện tại.
- Token contract xác định từ source thật.
- Hệ thống icon SVG mới, editable, có provenance.
- Component/navigation contract.
- Mapping 38 screen IDs vào route/state/fixture.
- Playwright visual, functional và accessibility acceptance.
- Lộ trình bounded packet từ asset foundation đến toàn bộ màn hình.

### Bắt buộc

- Giữ nguyên logo và mascot chính thức hiện có trong:
  - `/Users/tunbee27/Documents/New project/Takolio/src/web/lib/takolio-brand.ts`
  - `/Users/tunbee27/Documents/New project/Takolio/public/takolio/v1/`
- Argon phải tự tạo icon, illustration và asset mới từ source chỉnh sửa được.
- Không crop, trace, copy pixel, embed hoặc làm background từ screenshot/reference JPG.
- Không dùng emoji làm icon production.
- Không dùng dữ liệu concept như production truth.
- UI language là tiếng Việt.
- Mọi thiết kế vẫn ở trạng thái đề xuất cho đến khi owner phê duyệt.

### Ngoài phạm vi

- Không sửa backend, Worker, D1, API contract, auth infrastructure, household isolation hoặc payment.
- Không sửa PayOS, billing, checkout, webhook hoặc giá/gói.
- Không mass-implement cả 38 màn hình trước khi Home/Recipes/foundation được duyệt.
- Không tự đổi logo/mascot chính thức.
- Không tự phê duyệt reference, token hoặc visual result.
- Không đưa reference concept assets vào production.

---

## 2. Verified code inventory

| File / khu vực | Bằng chứng đã đọc | Rủi ro / xung đột | Xử lý dự kiến | Confidence |
|---|---|---|---|---|
| `/Users/tunbee27/Documents/New project/Takolio/src/web/App.tsx` | Có route cho landing, auth, onboarding, home, fridge, scan, recipes, cooking, planner/week, shopping, account/settings/Plus | 38 màn hình gồm nhiều state dùng chung route; planner có feature flag | Route/state matrix phải tách riêng, không tạo route giả chỉ để khớp PNG | VERIFIED_SOURCE |
| `/Users/tunbee27/Documents/New project/Takolio/src/web/components/layout/AppLayout.tsx` | Kitchen shell áp dụng cho `/`, fridge, recipes, cooking, planner, shopping, profile/settings và scan | Immersive routes ẩn navigation; shell có kitchen/legacy split | Bảo toàn shell behavior, chỉ thay presentation trong bounded packet | VERIFIED_SOURCE |
| `/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/navigation.tsx` | Có 5 root nav: home, fridge, recipe, mealPlan, profile; Scan là CTA riêng | `home` hiện map tới `meal-plan.svg`, vi phạm yêu cầu icon Home distinct | A01 tạo icon Home riêng và registry update sau approval | VERIFIED_SOURCE |
| `/Users/tunbee27/Documents/New project/Takolio/src/web/components/common/TakosanIcon.tsx` | Icon đang render từ `<img>` asset URL; kích thước 24×24 | `strokeWidth` hiện chỉ tương thích API, không điều khiển SVG geometry | Giữ API compatibility; registry/source SVG mới cần state/contrast rõ ràng | VERIFIED_SOURCE |
| `/Users/tunbee27/Documents/New project/Takolio/src/web/lib/takolio-brand.ts` | Logo, mascot, app icon, UI icon canonical ở `/takolio/v1` | Không được thay canonical brand | Chỉ bổ sung icon/asset mới, không thay logo/mascot | VERIFIED_SOURCE |
| `/Users/tunbee27/Documents/New project/Takolio/src/web/styles/takosan-tokens.css` | Có token legacy và `.takosan-rebuild`; palette khác nhau giữa root và kitchen scope | Có xung đột: root `#2E7D5B/#FFF8F3`, kitchen `#276F3F/#FFF8ED`; candidate kit cũng có palette khác | Không tự hợp nhất ngay; ghi decision owner cần duyệt, sau đó tạo semantic contract rõ scope | VERIFIED_SOURCE |
| `/Users/tunbee27/Documents/New project/Takolio/public/takolio/v1/` | Có logo SVG, mascot SVG/WEBP, fonts Plus Jakarta Sans, UI icons | Asset canonical phải được bảo vệ | Registry phải phân biệt canonical, new-original và concept-only | VERIFIED_SOURCE |
| `/Users/tunbee27/Documents/New project/Takolio/src/web/pages/HomePage.tsx` | Home dùng API/query, meal state ready/pending/error/empty, RecipeMedia, mascot, kitchen components | Không thể dùng hardcoded concept data để đạt visual match | Pilot screen phải dùng fixture được xác định và ghi rõ data divergence | VERIFIED_SOURCE |
| `/Users/tunbee27/Documents/New project/Takolio/src/web/pages/RecipesPage.tsx` | Có search, filters, saved view, query/error state, responsive filter behavior | Screen 17/18/19 là route + query/panel states | Tách screen contract theo state selector | VERIFIED_SOURCE |
| `/Users/tunbee27/Documents/New project/Takolio/src/web/pages/RecipeDetailPage.tsx` | Có tabs, inventory availability, servings, save, shopping, cooking | Recipe media/provenance và inventory truth cần giữ nguyên | Pilot PR sau Home, không thay domain behavior | VERIFIED_SOURCE |
| `/Users/tunbee27/Documents/New project/Takolio/src/web/pages/InventoryPage.tsx` | Có optimistic mutations, version conflict, add/edit/delete, error/refetch | Không được làm mất inventory conflict semantics | UI refactor chỉ quanh existing handlers/API | VERIFIED_SOURCE |
| `/Users/tunbee27/Documents/New project/Takolio/src/web/pages/ScanPage.tsx` | Có private image read, scan type, AI processing, receipt flow, session guards | Scan phải review-before-save; private data không được lưu sai | Screen 13–16 giữ nguyên state machine | VERIFIED_SOURCE |
| `/Users/tunbee27/Documents/New project/Takolio/src/web/pages/WeekDashboardPage.tsx` | Có planner/week state, generating/ready/empty/error, shopping link | Planner ON/OFF có route compatibility | Matrix phải biểu diễn cả `/week` và `/planner` | VERIFIED_SOURCE |
| `/Users/tunbee27/Documents/New project/Takolio/src/web/pages/ShoppingPage.tsx` | Có pending sync, review, add/edit/check/unavailable/delete | Offline behavior là functional invariant | Không thay mutation contract trong visual packets |
| `/Users/tunbee27/Documents/New project/Takolio/playwright.takolio.config.ts` | Chromium, locale `vi-VN`, UTC, mobile 390 và desktop 1440, preview server | Config hiện là protected journeys, chưa phải 38-screen visual suite | Bổ sung packet/fixture-specific tests sau owner approval, không giả định config đã đủ |
| `/Users/tunbee27/Documents/New project/Takolio/AGENTS.md` | Bảo vệ PayOS, auth, infrastructure; yêu cầu cập nhật docs state khi implementation | Design docs plan-only chưa nên sửa production docs | Khi chuyển Act, Argon phải follow AGENTS và packet whitelist |

---

## 3. Design authority và unresolved decisions

Thứ tự quyền lực:

1. Functional/security correctness.
2. Official Takolio brand source tại verified repository SHA.
3. Owner-approved V2 design.
4. Approved 38-screen layout references.
5. HTML concept.
6. Poster AI và concept JPG.

| Conflict | Quyết định tạm thời | Người phê duyệt | Status |
|---|---|---|---|
| `SCREEN_MANIFEST.json` audited SHA `0322...` khác current HEAD `5db70...` | Không re-pin reference; cần audit lại runtime trên current HEAD trước khi materialize | Owner + Astra review | BLOCKING |
| Root token `#2E7D5B/#FFF8F3` khác kitchen token `#276F3F/#FFF8ED` | Giữ scope hiện tại; không tự hợp nhất palette | Owner | NEEDS_DECISION |
| Candidate kit đề xuất navy/green/coral/cream nhưng candidate chưa locked | Dùng làm direction only, không coi là approved token | Owner | NEEDS_DECISION |
| Home đang dùng `meal-plan.svg` cho icon `home` | Tạo icon Home riêng theo ICON_ASSET_MATRIX | Owner duyệt icon family | PROPOSED |
| Candidate references dùng Arial/emoji/concept food images | Thay bằng font canonical, authored vector và verified media | Owner duyệt visual correction | PROPOSED |
| Logo/mascot source trong repo khác concept art | Giữ official repo logo/mascot | Không cần thay nếu không có CR | LOCKED BY BRAND RULE |
| 38 PNG đều `owner_approved=NO` | Không gọi là design lock production | Owner | BLOCKING |
| Food media trong reference JPG | Không ship; cần original generation/export và rights mapping | Owner + media approval | BLOCKING |
| `Plus/PayOS` có visual concept | Chỉ làm presentation shell; bảo vệ giá/quyền/payment behavior | Product/payment owner | PROTECTED |
| Desktop layout reference chưa tương đương production responsive | 390×844 là baseline mobile; desktop là adaptation cần review riêng | Owner | PROPOSED |

### Owner decisions cần trả lời trước Gate 00

1. Chọn palette canonical: kitchen scoped hiện tại hay candidate kit palette.
2. Duyệt typography: Plus Jakarta Sans cho body và Nunito cho heading, hoặc phương án khác.
3. Duyệt icon family mới gồm `home`, `fridge`, `recipe`, `mealPlan`, `profile`, `scan`.
4. Duyệt việc giữ toàn bộ logo/mascot canonical hiện tại.
5. Duyệt nguyên tắc recipe media: exact recipe + rights + placeholder trung thực.
6. Duyệt baseline Home, Recipes, Recipe Detail, Fridge, Scan, Planner, Shopping ở 390px.
7. Xác nhận có cần re-audit manifest vì current HEAD không trùng `audited_main_sha`.

---

## 4. Design token contract

### Trạng thái

Các giá trị dưới đây là **VERIFIED_SOURCE hoặc DESIGN_PROPOSAL**, chưa phải owner-approved final token.

### Canonical brand values hiện có

Từ `/Users/tunbee27/Documents/New project/Takolio/src/web/lib/takolio-brand.ts` và kitchen scope:

```text
--takosan-coral: #FF6B6B
--takosan-green: #276F3F
--takosan-ink: #0F2D46
--takosan-cream: #FFF8ED
--takosan-mint: #E8F7EC
--takosan-yellow: #F7C15A
```

### Semantic roles đề xuất cho V2

| Role | Candidate value | Source/status |
|---|---:|---|
| Background | `#FFF8ED` | Existing kitchen scope; owner approval required |
| Surface | `#FFFFFF` | Existing semantic token |
| Primary text | `#0F2D46` | Existing kitchen scope |
| Secondary text | Existing semantic secondary | Must verify contrast in final scope |
| Muted text | Existing accessible muted token | Must run contrast check |
| Primary action | `#0F2D46` | Existing kitchen action mapping |
| Success | `#2E7D5B` | Existing semantic token |
| Accent/coral | `#FF6B6B` | Official brand source |
| Mint surface | `#E8F7EC` | Official brand source |
| Warning | Existing semantic warning | Preserve functional meaning |
| Danger | Existing semantic danger | Preserve error semantics |
| Border | `#E7E3DA` | Existing semantic token |
| Focus | `#2E7D5B` | Existing semantic token |

### Typography

- Body: `Plus Jakarta Sans`, available at:
  - `/Users/tunbee27/Documents/New project/Takolio/public/takolio/v1/fonts/plus-jakarta-sans-vietnamese-latin-wght.woff2`
- Heading: current `Nunito` declaration; verify actual loading/source before implementation.
- Không dùng Arial từ HTML concept làm production authority.
- Must test Vietnamese diacritics, wrapping và 200% text zoom.

### Spacing / geometry

Existing source tokens to preserve or normalize only via approved change:

```text
--touch-target: 44px
--nav-mobile: 68px
--rail-tablet: 80px
--sidebar-desktop: 256px
--content-compact: 45rem
--content-default: 60rem
--content-wide: 75rem
```

Proposed spacing scale for new authored components:

```text
4, 8, 12, 16, 20, 24, 32, 40, 48, 64px
```

### Radii

Existing values:

```text
10px / 16px / 24px / 32px
```

Use semantic names only:

```text
radius-control = 10px
radius-card = 16px
radius-feature = 24px
radius-display = 32px
```

### Motion

Preserve existing motion tokens:

```text
80ms, 140ms, 220ms, 320ms
```

All new transitions must honor:

```css
@media (prefers-reduced-motion: reduce) { ... }
```

### Breakpoints and verification widths

Required:

```text
320, 360, 390, 430, 768, 1024, 1440px
```

Reference viewport:

```text
390×844 CSS px, DPR 1, locale vi-VN, timezone UTC
```

Additional checks:

- 320×420.
- 200% text zoom.
- Keyboard/focus navigation.
- Safe-area bottom inset.
- Reduced motion.

---

## 5. Original asset system

### Functional icon contract

- Native canvas: `24×24` (`viewBox="0 0 24 24"`, explicit `width="24"` and `height="24"`).
- Source: editable standalone SVG authored from native vector primitives (`<path>`, `<circle>`, `<rect>`, `<line>`, `<polyline>`, `<polygon>`, `<g>`).
- Naming & uniqueness:
  - Registry IDs (`icon-home`, `icon-fridge`, `icon-recipe`, `icon-meal-plan`, `icon-profile`, `icon-scan`) and runtime keys (`home`, `fridge`, `recipe`, `mealPlan`, `profile`, `scan`) must be 1-to-1 and globally unique across `docs/takolio-v2/asset-registry.json`.
  - Every `source_master` and `export_asset` path (stored as repo-relative POSIX paths, never leading `/` or `..`) and their `source_sha256` / `export_sha256` digests must be unique across all 6 P0 root/CTA icons.
  - Aliasing `home` to `meal-plan.svg` (or any shared path/hash between `home` and `mealPlan`) is strictly forbidden and must fail validation.
- SVG safety & hygiene (enforced by `scripts/validate_new_assets.py --manifest ... --repo-root ... --strict` plus packet checks):
  - Forbidden SVG elements: `<script>`, `<image>`, `<foreignObject>`, `<iframe>`, `<use>`, `<embed>`, `<object>`.
  - Forbidden attributes & payloads: any `on*` event handler (`onload`, `onclick`, etc.), `data:` URLs or base64-encoded bitmaps, `@import`, external `url(http://...)` / `url(https://...)`, `xlink:href`, external `href="http(s)://..."`, or references to `design-lock/`, `/references/`, or `screenshot`.
- Stroke/fill geometry & React rendering (`TakosanIcon` constraint):
  - Baseline stroke target: `1.8px` (inactive) / `2.2px` or restrained semantic accent fill (active) on `24×24` canvas, `stroke-linecap="round"`, `stroke-linejoin="round"`.
  - Because current `/Users/tunbee27/Documents/New project/Takolio/src/web/components/common/TakosanIcon.tsx` renders `<img src={...} />` and ignores `strokeWidth` and CSS `currentColor`, external `<img>` cannot inherit text color or stroke width dynamically. Therefore:
    1. **Phase A01-A (Asset-Only Candidate):** author monochrome `currentColor`-ready SVG masters plus explicit active/on-dark SVG variants where needed, and verify them in `docs/takolio-v2/evidence/a01-icon-contact-sheet.svg` without modifying `src/web/components/common/TakosanIcon.tsx`.
    2. **Phase A01-B (Pilot Navigation Integration Candidate — requires separate explicit approval):** either render sanitized inline SVG components from the typed registry so `currentColor` and `strokeWidth` work natively, or map explicit active/inactive/onDark SVG exports in `TakosanIcon.tsx`.
- Minimum touch target remains 44×44px at component level; icon glyph remains optically legible at 20–24px.
- Every icon requires:
  - source SVG (`src/web/design-system/assets/icons-src/*.svg`);
  - exported production SVG (`src/web/design-system/assets/icons/*.svg`);
  - registry entry in `docs/takolio-v2/asset-registry.json` following `templates/ASSET_REGISTRY_TEMPLATE.json`;
  - provenance, `source_sha256`, `export_sha256`, `license_status: "PENDING_OWNER_REVIEW"`, and `approval: "PENDING"`;
  - contrast/legibility evidence on cream (`#FFF8ED`) and navy (`#0F2D46`).

### P0 icon family

From `/TAKOLIO_V2_ASTRA_ARGON_CLINE_OS_KIT/data/ICON_ASSET_MATRIX.csv`:

```text
home       house silhouette with door
fridge     refrigerator with twin shelves
recipe     cookbook with food detail
mealPlan   weekly planner + plate
profile    recognizable human portrait
scan       scanner frame + ingredient sparkle
```

The Home icon must not reuse `meal-plan.svg`.

### P1/P2 icons

```text
shopping, camera, calendar, search, favorites, settings,
notifications, ingredient, aiSuggestion, shoppingList,
shoppingCart, chef, filter, nutrition, history, analytics
```

### Illustrative assets

Separate from functional icons:

```text
mealBreakfast, mealLunch, mealDinner
emptyFridge, scanSuccess, shoppingDone
```

These must use original SVG/vector source. Food photography requires an actual original image-generation/export pipeline and rights/provenance mapping. If unavailable, Argon must use an honest placeholder and stop the related media task.

### Asset locations proposed for later Act implementation

These are proposed paths, not yet created:

```text
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/icons-src/
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/icons/
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/illustrations-src/
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/illustrations/
/Users/tunbee27/Documents/New project/Takolio/docs/takolio-v2/asset-registry.json
```

Existing canonical assets remain untouched under:

```text
/Users/tunbee27/Documents/New project/Takolio/public/takolio/v1/
```

---

## 6. 38-screen route/state matrix

All screen references remain `CANDIDATE_NOT_OWNER_APPROVED`.

| ID | Screen | Route/state | Essential contract |
|---:|---|---|---|
| 01 | Splash | `/landing` entry art, no forced route | Preserve PWA entry behavior; canonical logo/mascot only |
| 02 | Landing | `/landing` | Auth CTA, responsive entry layout |
| 03 | Login | `/auth` | Existing auth/session behavior |
| 04 | OTP | `/auth/verify` | OTP verification, errors, focus order |
| 05 | Goal | `/onboarding/*` goal step | Persist onboarding draft |
| 06 | Household | `/onboarding/*` household step | Household isolation and validation |
| 07 | Preferences | `/onboarding/*` preferences step | Preferences persistence |
| 08 | Home | `/` signed-in, meal present | **Pilot**; API meal fixture, inventory, navigation |
| 09 | Home empty | `/` signed-in, plan absent | Empty state, truthful CTA |
| 10 | Fridge | `/fridge` | Inventory loading/error/empty/ready |
| 11 | Ingredient | `/fridge/:id` or `/ingredients/:id` | Quantity, expiry, household ownership |
| 12 | Add ingredient | `/fridge` modal/dialog | Form validation, mutation/error/conflict |
| 13 | Scan | `/scan` initial | Private image input, scan type tabs |
| 14 | Scan processing | `/scan` processing state | Async status, cancellation/retry |
| 15 | Scan review | `/scan/:id/review` or `/scan/result` | AI/OCR review-before-save |
| 16 | Receipt review | `/scan/receipt-review` | Receipt review-before-save |
| 17 | Recipes | `/recipes` | **Pilot after Home**; search, discovery, loading/error |
| 18 | Recipe filters | `/recipes` filter panel state | URL/query state, reset, responsive panel |
| 19 | Saved recipes | `/recipes?view=saved` | Saved collection and empty state |
| 20 | Recipe detail | `/recipes/:slug` or `/recipes/id/:id` | **Pilot after Recipes**; tabs, availability, servings |
| 21 | Cooking | `/cook/:slug` or `/cooking/:id` | Immersive mode, step progression |
| 22 | Cooking complete | `/cooking/complete` | Completion state, truthful mutation result |
| 23 | Week | `/week` planner OFF or `/planner` ON | Feature flag compatibility |
| 24 | Planner setup | `/week/setup` or `/planner/new` | Setup form and validation |
| 25 | Planner generating | `/week/generating` or pending planner state | Async progress/error |
| 26 | Meal detail | week/planner meal route | Swap/edit meal, data authority |
| 27 | Planner shopping | week/planner shopping route | Derived shopping list |
| 28 | Shopping | `/shopping` | Offline sync, review, check/unavailable/edit |
| 29 | Notifications | `/notifications` | Read/unread and empty/error |
| 30 | Profile | `/me` | Profile data and navigation |
| 31 | Family | `/me/household` | Sharing and household isolation |
| 32 | Settings | `/settings/app` | Settings navigation |
| 33 | Food settings | `/me/preferences` | Preferences persistence |
| 34 | Planning settings | `/settings/planning` | Planner preferences |
| 35 | Notification settings | `/settings/notifications` | Notification preferences |
| 36 | Privacy | `/settings/privacy` | Data/privacy controls |
| 37 | Plus | `/plus` | Presentation-only protected payment surface |
| 38 | Offline | Global application state | Offline banner, pending sync, no false success |

### Shared acceptance requirements

Every screen/state must specify:

- Loading.
- Empty.
- Error.
- Offline where relevant.
- Keyboard/focus order.
- Vietnamese text wrapping.
- `aria-label`, landmark and heading structure.
- 44px minimum interactive target.
- 200% zoom.
- 320px minimum supported layout.
- Screenshot evidence at 390×844.
- Responsive checks at 768/1024/1440 where applicable.

---

## 7. Bounded implementation packets

| Packet | Scope | Allowed area | Explicitly forbidden | Proof |
|---|---|---|---|---|
| PR0 | Materialize approved plan only | `docs/takolio-v2/` | Product code, assets, runtime | Hash/diff only |
| A01 | Original SVG icon library + pilot nav | New asset/design-system paths and minimal registry integration after approval | Logo, mascot, backend, unrelated pages | SVG validation, axe, Playwright nav |
| S08 | Home pilot | Home components/styles/fixtures/test files explicitly whitelisted | Domain/API behavior changes | 08 visual + functional receipt |
| S09 | Recipes/filter/saved | Recipes components, styles, fixture tests | Backend/catalog changes | 17–19 receipt |
| S10 | Recipe detail/cooking | Detail/cooking presentation and tests | Recipe domain contracts | 20–22 receipt |
| S11 | Fridge/ingredient/add | Inventory presentation and tests | Quantity/expiry/version semantics | 10–12 receipt |
| S12 | Scan/receipt | Scan presentation and tests | OCR/AI/provider/backend | 13–16 receipt |
| S13 | Planner/week | Week/planner presentation and tests | Feature-flag/API semantics | 23–27 receipt |
| S14 | Shopping/offline | Shopping presentation and tests | Sync protocol/domain mutation semantics | 28/38 receipt |
| S15 | Account/auth/settings | Protected presentation only | Auth/payment/infrastructure | 01–07, 29–37 receipt |
| PR7 | Stability and full matrix | QA/e2e/docs paths | Unbounded refactor | 38-screen receipt |

Every packet requires:

- Feature branch, never `main`.
- Explicit allowed-path whitelist.
- Exact reference SHA.
- Fixture authority.
- Screenshot and diff evidence.
- Functional and accessibility checks.
- Review status: `DRAFT`, `APPROVED_FOR_LOCAL_CANDIDATE`, `BLOCKED`.
- Owner gate at foundation and family milestones.

---

## 8. Functional invariants

Argon must preserve:

1. Authentication and session boundary.
2. Household isolation and ownership checks.
3. Inventory quantity, expiry and optimistic version/conflict behavior.
4. Scan private image handling.
5. AI/OCR review-before-save.
6. Receipt review-before-save.
7. Recipe provenance and media fallback.
8. Planner ON/OFF compatibility.
9. Shopping mutations and pending offline sync.
10. Offline truthfulness; never report server success before confirmation.
11. Plus/PayOS protected UI and payment semantics.
12. Existing route aliases and deep links.
13. Existing accessibility behavior and focus management.

---

## 9. Visual & technical acceptance

### Reference integrity

- Use manifest SHA-256 for each reference.
- Do not edit reference snapshots to match implementation.
- If owner changes a reference, create a Change Request and new manifest SHA.

### Playwright environment

Required baseline:

```text
browser: Chromium
locale: vi-VN
timezone: UTC
viewport: 390×844
deviceScaleFactor: 1
reduced motion: enabled or deterministic
fonts.ready: awaited
network fixture: deterministic
auth fixture: deterministic
```

Additional viewports:

```text
320×420
360×844
430×932
768×1024
1024×900
1440×900
```

### Visual assertions

- Header/nav/card geometry deviation target: ≤4 CSS px at 390px, except approved CR.
- Correct semantic tokens and SVG registry assets.
- No screenshot crop or concept JPG production art.
- No content hiding through overlays.
- No whole-page 100% pixel-perfect claim.
- Compare region-of-interest metrics only after reference approval.
- Generate side-by-side, overlay, heatmap and metrics via kit diff tooling.

### Functional assertions

- Deep links resolve.
- Auth guards remain correct.
- Navigation active state is correct.
- Scan review cannot silently save.
- Planner flag ON/OFF routes remain compatible.
- Inventory conflict handling remains truthful.
- Offline pending sync is visible and recoverable.
- PayOS protected flows remain unchanged.

### Accessibility assertions

- `@axe-core/playwright`.
- Keyboard navigation.
- Visible focus.
- Landmark/headings.
- Accessible names for icon-only controls.
- 44px target.
- No horizontal overflow at 320px or 200% zoom.
- Reduced-motion behavior.
- Vietnamese diacritics preserved.

No `PASS` may be claimed until the command is actually executed and the receipt records command, environment, test count, exit code and artifacts.

---

## 10. Blocking decisions & signoff

### Current blocking items

- Owner has not approved the 38-screen reference set.
- Manifest audited SHA differs from current repository HEAD.
- Token conflict between root semantic layer and kitchen scope is unresolved.
- Font/heading source must be confirmed.
- Recipe image rights/source pipeline is unresolved.
- No final visual ROI thresholds can be locked before Gate 00.
- A01 is not approved for implementation.

### Required signoff order

1. Owner approves design authority and reference basis.
2. Owner resolves palette and typography.
3. Owner approves original icon family direction.
4. Astra validates materialized spec.
5. Argon creates original assets only.
6. Owner reviews A01 asset contact sheet and pilot navigation.
7. Argon implements one bounded screen packet.
8. Astra performs visual/functional review.
9. Owner approves family milestone before expansion.

---

## 11. Provenance

- Prepared by: Astra planning process in Cline Plan mode.
- Repository: `hello-tako/Takolio`.
- Local path: `/Users/tunbee27/Documents/New project/Takolio`.
- Kit archive: `/Users/tunbee27/Documents/New project/Takolio/takolio-cline-os-kit-20261021.zip`.
- Sources read:
  - `00_START_HERE.md`
  - `prompts/01_ASTRA_PLAN_AUDIT_AND_SPEC.md`
  - `design-lock/READ_ME_FIRST.md`
  - `design-lock/DESIGN_AUTHORITY.md`
  - `design-lock/VISUAL_ACCEPTANCE.md`
  - `design-lock/SCREEN_MANIFEST.json`
  - `design-lock/SCREEN_ROUTE_CROSSWALK.csv`
  - `design-lock/DESIGN_TOKENS_CANDIDATE.json`
  - `data/ICON_ASSET_MATRIX.csv`
  - `templates/PLAN_CONTRACT_TEMPLATE.md`
  - `templates/TASK_PACKET_TEMPLATE.md`
  - repository `AGENTS.md`
  - repository `docs/ai/AGENT_RULES.md`
  - selected frontend runtime files listed in Section 2.
- Limitations:
  - No browser render or Playwright test was executed.
  - No production design approval exists.
  - No files were modified.
  - Individual PNG pixels were not treated as production authority.
  - Current HEAD was inspected but manifest must be re-audited against it before implementation.
