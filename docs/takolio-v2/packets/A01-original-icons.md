# BEGIN TASK PACKET A01

# TASK PACKET A01 — Original SVG Icon Library + Pilot Navigation

**STATUS:** `TECHNICAL_VERIFIED_PENDING_FINAL_OWNER_DESIGN_APPROVAL` (tách bạch rõ 3 trạng thái: (1) Đã có quyền thực thi A01; (2) Đã đạt kiểm thử kỹ thuật `38/38` unit tests + Playwright `200%` zoom & phím `Tab`/`Shift+Tab`/`Enter` tại mốc `2026-10-22T11:38:36.635Z`; (3) Phê duyệt thiết kế cuối cùng từ Owner: `PENDING`)\
**PLAN_SHA256:** `90364b63063242ac7cdecefea1f56b7c30ff611661e29d371260350b05eaf06e`\
**REPO_MAIN_SHA:** `0322a9197bee4a4a42d95cc150f8d4fff6d53ba8`\
**CURRENT_SOURCE_SHA:** `5db70a578764ccdb9ad458a21833fec5b6c04741`\
**BRANCH:** `feat/takolio-culinary-experience` — implementation must use a dedicated feature branch or approved current branch, never `main`\
**OWNER_SCOPE_APPROVAL:** `YES (EXECUTION AUTHORIZATION ONLY) — Owner authorized Gate 00 + Phase A01-A & Phase A01-B execution on 2026-10-22 (2026-10-21T21:25Z UTC) per docs/takolio-v2/OWNER_DESIGN_DECISIONS.md`\
**TECHNICAL_VERIFICATION_STATUS:** `PASS (2026-10-22T11:38:36.635Z) — 38/38 unit tests PASS + Playwright 200% zoom & Tab/Shift+Tab/Enter keyboard navigation verified`\
**FINAL_OWNER_DESIGN_APPROVAL:** `PENDING`\
**REFERENCE_IDS:** Navigation foundation; primarily `08-home`, with nav behavior shared across 38 screens\
**REFERENCE_SHA256:** `23244c994a4b95ba7b20168e6fb72f62367040279cf6b8e310c82af390b4f540` (`references/screens/08-home.png` from `SCREEN_MANIFEST.json`, `review_status: APPROVED_FOR_A01_NAVIGATION_FOUNDATION`)

## Objective and must-not-change

### Objective

Tạo một icon family SVG mới, editable, coherent và production-ready cho navigation Takolio V2:

```text
home
fridge
recipe
mealPlan
profile
scan
```

Tạo contact sheet/source registry và chuẩn bị pilot integration cho navigation mà không thay đổi domain behavior.

### Must not change

- Không thay logo hoặc mascot chính thức.
- Không crop/trace/copy screenshot, concept board, JPG hoặc HTML.
- Không dùng emoji.
- Không thay backend, Worker, D1, API, auth, payment hoặc feature flags.
- Không thay route semantics.
- Không đổi giá/gói/Plus/PayOS.
- Không mass rollout toàn bộ 38 màn hình.
- Không tự đánh dấu owner approval.
- Không tạo food photo hoặc illustration raster bằng text-only coding.
- Không dùng `meal-plan.svg` hiện tại cho Home sau khi icon mới được approved.

## Current source evidence and dependencies

Verified:

```text
/Users/tunbee27/Documents/New project/Takolio/src/web/components/common/TakosanIcon.tsx
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/navigation.tsx
/Users/tunbee27/Documents/New project/Takolio/src/web/lib/takolio-brand.ts
/Users/tunbee27/Documents/New project/Takolio/public/takolio/v1/ui-icons/
/Users/tunbee27/Documents/New project/Takolio/src/web/styles/takosan-tokens.css
```

Current behavior:

- `TakosanIcon` renders image URLs at 24×24.
- Navigation has five root items plus Scan CTA.
- `home` currently resolves to `meal-plan.svg`.
- Existing logo/mascot assets are canonical and protected.

Dependencies:

- Owner approval of icon direction.
- Final token decision.
- Asset registry schema.
- Current branch and exact plan SHA.
- Existing icon usage audit before replacing any asset.

## Allowed files and forbidden files

### Phase A01-A — Asset-Only Candidate allowlist (authorized when A01 candidate is accepted)

Only new original SVG masters, exported SVGs, registry and contact sheet may be created in Phase A01-A. **Authoring SVG files does NOT authorize modifying any existing product code:**

```text
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/icons-src/home.svg
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/icons-src/fridge.svg
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/icons-src/recipe.svg
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/icons-src/meal-plan.svg
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/icons-src/profile.svg
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/icons-src/scan.svg
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/icons/home.svg
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/icons/fridge.svg
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/icons/recipe.svg
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/icons/meal-plan.svg
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/icons/profile.svg
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/assets/icons/scan.svg
/Users/tunbee27/Documents/New project/Takolio/docs/takolio-v2/asset-registry.json
/Users/tunbee27/Documents/New project/Takolio/docs/takolio-v2/evidence/a01-icon-contact-sheet.svg
```

### Phase A01-B — Pilot Navigation Integration Candidate (BLOCKED until separate owner approval of A01-A contact sheet)

Integration files are **FORBIDDEN during Phase A01-A** and require a separate explicit approval after owner reviews the A01-A contact sheet:

```text
/Users/tunbee27/Documents/New project/Takolio/src/web/lib/takolio-brand.ts
/Users/tunbee27/Documents/New project/Takolio/src/web/components/common/TakosanIcon.tsx
/Users/tunbee27/Documents/New project/Takolio/src/web/design-system/navigation.tsx
```

### Forbidden files

```text
/Users/tunbee27/Documents/New project/Takolio/src/worker/
/Users/tunbee27/Documents/New project/Takolio/migrations/
/Users/tunbee27/Documents/New project/Takolio/src/web/services/
/Users/tunbee27/Documents/New project/Takolio/src/web/stores/
/Users/tunbee27/Documents/New project/Takolio/public/takolio/v1/logo/
/Users/tunbee27/Documents/New project/Takolio/public/takolio/v1/mascot/
/Users/tunbee27/Documents/New project/Takolio/src/web/pages/
/Users/tunbee27/Documents/New project/Takolio/src/admin/
/Users/tunbee27/Documents/New project/Takolio/src/shared/payment.ts
```


## Original asset deliverables

For each of the six icons (`icon-home`, `icon-fridge`, `icon-recipe`, `icon-meal-plan`, `icon-profile`, `icon-scan`):

- Editable SVG source with exact `viewBox="0 0 24 24"`, `width="24"`, `height="24"`, `fill="none"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `1.8px` baseline stroke geometry.
- Production SVG export in `src/web/design-system/assets/icons/*.svg`.
- **Uniqueness enforcement (mandatory):**
  - All 6 registry `id` values (`icon-home`, `icon-fridge`, `icon-recipe`, `icon-meal-plan`, `icon-profile`, `icon-scan`), all 6 `source_master` repo-relative paths, all 6 `export_asset` repo-relative paths, all 6 `source_sha256` hashes, and all 6 `export_sha256` hashes must be strictly unique.
  - `icon-home` (`home`) must never alias to `meal-plan.svg` or share geometry/hash with `icon-meal-plan` (`mealPlan`).
  - Validator must fail on any duplicate `id`, duplicate `source_master`/`export_asset` path, or duplicate SHA-256 hash.
- **SVG safety & security rules (mandatory):**
  - Only native vector elements (`<svg>`, `<g>`, `<path>`, `<circle>`, `<rect>`, `<line>`, `<polyline>`, `<polygon>`, `<title>`, `<desc>`) are permitted.
  - Strictly forbidden elements: `<script>`, `<image>`, `<foreignObject>`, `<iframe>`, `<use>`, `<embed>`, `<object>`, `<style>` containing `@import` or external URLs.
  - Strictly forbidden attributes & payloads: any `on*` event handler (`onload`, `onclick`, `onerror`, etc.), `data:` URLs or base64-encoded bitmaps, `@import`, external `url(http://...)` / `url(https://...)`, `xlink:href`, external `href="http(s)://..."`, non-`0 0 24 24` `viewBox`, or any path referencing `design-lock/`, `/references/`, or `screenshot`.
- Stable `data-icon-id` on root `<svg>`.
- React `TakosanIcon` color/stroke handling:
  - Current `TakosanIcon.tsx` uses `<img src={...} />`, which does not inherit CSS `currentColor` or `strokeWidth`.
  - In **Phase A01-A**, SVG masters must use `currentColor` (or approved semantic tokens in contact sheet preview) and remain standalone without touching `TakosanIcon.tsx`.
  - In **Phase A01-B** (authorized by Owner after A01-A signoff), `TakosanIcon.tsx` renders sanitized inline SVG elements directly from `TAKOLIO_BRAND.v2NavIcons[name].elements` (verified for 1:1 parity against the `.svg` files on disk in `tests/unit/takosan-brand.test.tsx`) while preserving its existing props API (`name`, `strokeWidth`, `onDark`, `title`, `variant`, `className`, `style`).
- Registry metadata (`docs/takolio-v2/asset-registry.json` following `templates/ASSET_REGISTRY_TEMPLATE.json`):
  - `id`, `kind: "svg-icon"`, `display_name`, repo-relative `source_master`, repo-relative `export_asset`, `source_sha256`, `export_sha256`, `authorship`, `reference_used_as`, `license_status: "APPROVED"`, `license_evidence`, `approval: "APPROVED"`, `components: ["navigation"]`.
- Contact sheet (`docs/takolio-v2/evidence/a01-icon-contact-sheet.svg`) showing all 6 icon IDs at 20/24/32/48px on cream (`#FFF8ED`) and dark navy (`#0F2D46`) across inactive/active/focus/disabled states, authored directly from the new SVG primitives—never from screenshots.

### Visual briefs

```text
home:      house silhouette + door, friendly roofline
fridge:    refrigerator with twin shelves
recipe:    cookbook with food detail, not calendar
mealPlan:  weekly planner + plate, not home
profile:   recognizable human portrait
scan:      scanner frame + ingredient sparkle
```

## UI/interaction specification

### Navigation

- Five primary roots:
  - Trang chủ
  - Tủ lạnh
  - Công thức
  - Thực đơn
  - Tôi
- Scan remains a distinct CTA.
- Active state must be distinguishable without color alone:
  - icon treatment;
  - label weight;
  - selected background/indicator;
  - `aria-current="page"`.
- Inactive, active, focus-visible and disabled states must use semantic tokens.
- Icon-only controls require accessible name.
- Touch target minimum: 44×44px.
- Mobile bottom navigation and desktop rail/sidebar must share the same icon registry.
- Do not alter route matching functions unless a separate navigation behavior defect is documented.

### Responsive behavior

Required checks:

```text
390×844 baseline
320×420
360×844
430×932
768×1024
1024×900
1440×900
200% text zoom
reduced motion
```

At 320px and 200% zoom:

- No horizontal scroll.
- Labels must remain understandable or use approved accessible truncation.
- Scan CTA must remain reachable.
- Bottom safe area must remain clear.

## Implementation steps

### Phase A01-A — Standalone Original SVG Asset Candidate (no product code edits)

- [x] Confirm Astra spec review acceptance (`SPEC_REVIEW_ACCEPTED_FOR_A01_CANDIDATE_ONLY`) and Gate 00 status.
- [x] Audit all existing usages of `home`, `mealPlan`, `fridge`, `recipe`, `profile`, `scan` (read-only).
- [x] Author six independent `24×24` SVG masters from native vector primitives in `src/web/design-system/assets/icons-src/{home,fridge,recipe,meal-plan,profile,scan}.svg`.
- [x] Export six deterministic production SVGs in `src/web/design-system/assets/icons/{home,fridge,recipe,meal-plan,profile,scan}.svg` without losing editability.
- [x] Create `docs/takolio-v2/asset-registry.json` with unique `id`, repo-relative `source_master`, repo-relative `export_asset`, `source_sha256`, `export_sha256`, `license_status: "APPROVED"`, `license_evidence`, and `approval: "APPROVED"`.
- [x] Create authored contact sheet `docs/takolio-v2/evidence/a01-icon-contact-sheet.svg` at 20/24/32/48px on cream (`#FFF8ED`) and dark navy (`#0F2D46`).
- [x] Run `validate_new_assets.py --strict` (`ASSET_CHECK=PASS assets= 6`) plus SVG safety & uniqueness assertions (`UNIQUENESS_AND_SVG_SAFETY=PASS`).
- [x] STOP at end of Phase A01-A (`STATUS = A01_CANDIDATE_REVIEW_REQUIRED`); return to Astra and Owner to review the contact sheet before touching any product code.

### Phase A01-B — Pilot Navigation Integration Candidate (ONLY after separate explicit Owner approval of A01-A)

- [x] Only after explicit Owner execution authorization of A01-A contact sheet and integration scope (`APPROVED_FOR_A01`), update `src/web/lib/takolio-brand.ts`, `src/web/components/common/TakosanIcon.tsx`, and `src/web/design-system/navigation.tsx`.
- [x] Capture navigation before/after at 390×844 (`a01-nav-390x844.png`), 320×420 (`a01-nav-320x420.png`), and 1440×900 (`a01-nav-1440x900.png`).
- [x] Run `pnpm typecheck`, `pnpm lint`, `38/38` unit tests (`5 test files`), Playwright `200%` zoom & keyboard `Tab`/`Shift+Tab`/`Enter` focus/route checks (`a01-playwright-receipt.json`, mốc `2026-10-22T11:38:36.635Z`), and `@axe-core/playwright` (`0` violations at 390×844 and 1440×900).
- [x] Produce A01 visual review receipt (`docs/takolio-v2/evidence/a01-visual-review-receipt.md`) and STOP before modifying any page-specific UI.
- [ ] Final Owner design approval on rendered A01 deliverables (`PENDING`).

### Tóm tắt tách bạch 3 trạng thái A01

1. **Quyền thực thi A01:** `AUTHORIZED` (`APPROVED_FOR_A01` — Owner đã cấp quyền thực thi `Gate 00` + `Phase A01-A` & `Phase A01-B` ngày `2026-10-22` / `2026-10-21T21:25Z` UTC trong `docs/takolio-v2/OWNER_DESIGN_DECISIONS.md`).
2. **Kết quả kiểm thử kỹ thuật đã đạt:** `PASS` tại mốc `2026-10-22T11:38:36.635Z` — `38/38` unit tests PASS + Playwright kiểm tra `200%` zoom và phím `Tab` / `Shift+Tab` / `Enter` (cùng `@axe-core/playwright` `0` violations).
3. **Trạng thái phê duyệt thiết kế cuối cùng từ Owner:** `PENDING` (chờ Owner phê duyệt thiết kế cuối cùng).

## Functional and visual test commands

Commands are proposed and must only be reported with actual exit codes after execution:

```sh
cd "/Users/tunbee27/Documents/New project/Takolio"

# 1. Run bundled original-asset hygiene & provenance validator (strict mode)
python3 -c "import zipfile, subprocess, sys; z=zipfile.ZipFile('/Users/tunbee27/Documents/New project/Takolio/takolio-cline-os-kit-20261021.zip'); code=z.read('TAKOLIO_V2_ASTRA_ARGON_CLINE_OS_KIT/scripts/validate_new_assets.py').decode(); sys.exit(subprocess.call([sys.executable, '-c', code, '--manifest', '/Users/tunbee27/Documents/New project/Takolio/docs/takolio-v2/asset-registry.json', '--repo-root', '/Users/tunbee27/Documents/New project/Takolio', '--strict']))"

# 2. Enforce strict uniqueness (6 unique IDs, 6 unique source paths, 6 unique export paths, 6 unique SHA-256 digests, home != meal-plan) and SVG safety (viewBox="0 0 24 24", no on* attributes, no forbidden elements)
python3 -c "import json, pathlib, re, sys, xml.etree.ElementTree as ET
root = pathlib.Path('/Users/tunbee27/Documents/New project/Takolio')
reg = json.loads((root / 'docs/takolio-v2/asset-registry.json').read_text())['assets']
assert len(reg) == 6, f'Expected 6 P0 icons, got {len(reg)}'
for k in ('id', 'source_master', 'export_asset', 'source_sha256', 'export_sha256'):
    vals = [x[k] for x in reg]
    assert len(vals) == len(set(vals)), f'Duplicate {k}: {vals}'
by_id = {x['id']: x for x in reg}
assert by_id['icon-home']['export_asset'] != by_id['icon-meal-plan']['export_asset']
assert by_id['icon-home']['export_sha256'] != by_id['icon-meal-plan']['export_sha256']
for item in reg:
    for key in ('source_master', 'export_asset'):
        svg_path = root / item[key]
        raw = svg_path.read_text(encoding='utf-8')
        assert not re.search(r'\bon[a-z]+\s*=', raw, re.I), f'Event handler in {svg_path}'
        el = ET.fromstring(raw)
        assert el.attrib.get('viewBox') == '0 0 24 24', f'Bad viewBox in {svg_path}'
print('UNIQUENESS_AND_SVG_SAFETY=PASS')"

# 3. Phase A01-B integration gates (only when Phase A01-B is explicitly approved)
pnpm typecheck
pnpm lint

pnpm exec playwright test \
  -c playwright.takolio.config.ts \
  --project=mobile-390

pnpm exec playwright test \
  -c playwright.takolio.config.ts \
  --project=desktop-1440
```

Additional required checks:

- Inspect every generated SVG source manually and via XML parser.
- Confirm all six icons (`icon-home`, `icon-fridge`, `icon-recipe`, `icon-meal-plan`, `icon-profile`, `icon-scan`) have unique IDs, paths, and SHA-256 hashes.
- Confirm no generated file references `design-lock/`, `references/`, `screens/`, concept JPGs or screenshot PNGs.
- Confirm Home and Meal Plan remain visually and structurally distinct.
- Confirm `aria-current="page"` and accessible labels in Phase A01-B.
- Confirm focus ring at keyboard navigation.
- Confirm 320px/200% zoom has no horizontal overflow.
- Confirm reduced-motion behavior.
- Capture actual evidence; do not claim PASS based on build alone.

## Stop / revert / review

Stop immediately if:

- Owner has not approved the icon direction.
- Owner has not resolved the token conflict.
- The implementation requires changing logo/mascot.
- Any icon is traced from screenshot or copied from concept.
- Any SVG embeds raster/external content.
- The task touches backend, API, auth, payment or data stores.
- Existing route behavior changes unexpectedly.
- Home and Meal Plan are not distinct.
- SVG validator, typecheck, lint, axe or Playwright fails.
- Actual browser evidence cannot be captured.
- Media generation is unavailable for any requested non-vector asset.
- Argon attempts to modify files outside the whitelist.

Revert procedure:

1. Stop work and preserve generated evidence.
2. Revert only A01-created files on the feature branch.
3. Do not reset unrelated work.
4. Record exact failure and affected paths.
5. Return to Astra review with `BLOCKED`.
6. Request owner decision or revised packet.

**Plan only. No files modified. Waiting for owner plan approval and Argon SPEC_MATERIALIZE_ONLY.**

# END TASK PACKET A01
