# Takolio Culinary Experience Hardening v2 Specification

Status: `ACTIVE_IMPLEMENTATION_SPEC`
Branch: `feat/takolio-culinary-experience`
Date: 2026-10-20

## 1. Review Findings Addressed (R1–R6)

| ID | Priority | Finding | Resolution in v2 |
|---|---|---|---|
| **R1** | P1 | Step-level ingredient pills displayed whole-recipe `requiredQuantity` under labels implying per-step usage (`"Nguyên liệu dùng ở bước này"`). | Explicitly label step ingredient sections and pills with recipe-total semantics (`"Nguyên liệu nhắc trong bước này (định lượng tổng món)"` / `Tổng: ...`) so multi-step ingredients are never misread as per-step allocations. |
| **R2** | P1 | `resolveStepTechnique` could misclassify multi-action sentences (`"Cho thịt đã ướp vào xào"` -> `marinate`, `"Xào trên lửa nhỏ"` -> `simmer`), conflated `hấp` with `luộc`, had an un-normalized regex (`trên`), and guessed `prep`/`plate`/`saute` by step index when no verb matched. | Added `'steam'` (`Hấp & chưng cách thủy`) and neutral fallback `'general'` (`Thao tác theo bước`), stripped past-participle/modifier phrases (`đã ướp`, `đã sơ chế`, etc.) before primary verb matching, removed bare `lửa nhỏ` from overriding `xào`/`chiên`, fixed normalized regexes, and removed positional guessing when no culinary keyword matches. |
| **R3** | P2 | `matchStepIngredients` used raw substring `.includes()`, allowing `"nhanh"` to match `"Hành"`, missing `"tỏi"` for `"Tỏi băm"`, and truncating at `.slice(0, 5)`. | Replaced substring matching with word-boundary phrase matching, added controlled prep-modifier stem matching (`"Tỏi băm"` -> `"tỏi"`), preserved diacritics for single-syllable head words (`"cá"` vs `"cà"`), and removed `.slice(0, 5)` truncation in the data helper. |
| **R4** | P1 | Playwright E2E timer check used a conditional flag (`testedTimerRing`) without asserting `expect(testedTimerRing).toBe(true)`. | Enforced `expect(testedTimerRing).toBe(true)` and added explicit assertions for timer ring visibility, pause (`Tạm dừng hẹn giờ`), resume (`Tiếp tục hẹn giờ`), and reset (`Đặt lại hẹn giờ`). |
| **R5** | P1 | Playwright E2E completion test stopped at the `CookingReview` screen without submitting the completion command or verifying inventory deduction/idempotency. | Extended E2E to adjust actual-use quantity, submit `Xác nhận & Cập nhật tủ lạnh`, verify the `/cook/complete` API response and `Idempotency-Key` header, assert `'Đã cập nhật tủ lạnh'`, verify idempotent replay and deducted stock, and return to `/fridge`. |
| **R6** | P2 | Accessibility helper only asserted `serious`/`critical` axe violations and opened the ingredient drawer via `.click()` instead of keyboard activation. | Updated `assertAccessibleAndResponsive` to assert zero axe violations across all severities (`expect(axe.violations).toEqual([])`) and verified keyboard activation (`focus()` + `Enter`) on the cooking ingredient drawer. |

## 2. Scope & Guardrails

- **In Scope**:
  - `src/web/lib/culinary-visuals.ts`
  - `src/web/components/cooking/CookingTechniqueVisual.tsx`
  - `src/web/pages/RecipeDetailPage.tsx`
  - `src/web/pages/CookingModePage.tsx`
  - `tests/unit/ui15-culinary-upgrade.test.tsx`
  - `tests/e2e/t17-ui/takolio-culinary-experience.e2e.ts`
- **Out of Scope / Protected**:
  - PayOS, billing, checkout, auth/session infrastructure, D1 migrations, and `main` branch.

## 3. Acceptance Criteria

1. **No fabricated step quantities**: Step ingredient chips clearly state `Tổng:` (total recipe quantity for current servings).
2. **Accurate technique resolution**:
   - `"Cho thịt đã ướp vào xào săn trên lửa lớn"` -> `saute`.
   - `"Xào thơm tỏi trên lửa nhỏ"` -> `saute`.
   - `"Hấp cá cách thủy 15 phút"` -> `steam`.
   - `"Kiểm tra lại trước khi chuyển sang công đoạn kế tiếp"` -> `general` (neutral fallback).
3. **Word-boundary & stem-aware ingredient matching**:
   - `"Đảo nhanh tay trên chảo"` does NOT match `"Hành"` or `"Hành lá"`.
   - `"Cho tỏi vào phi thơm"` matches `"Tỏi băm"`.
   - `"Cho cá vào nồi"` matches `"Cá lóc"` and does NOT match `"Cà chua"`.
   - Recipes with >5 matched ingredients in a step return all matches without silent truncation.
4. **End-to-End & Accessibility Verification**:
   - Timer ring start, pause, resume, and reset are unconditionally asserted in E2E.
   - Cooking completion submits to `/cook/complete`, verifies idempotent replay and stock deduction, and transitions to `'Đã cập nhật tủ lạnh'`.
   - All 6 Playwright viewport projects (`mobile-360`, `mobile-390`, `mobile-430`, `tablet-768`, `desktop-1024`, `desktop-1440`) pass with 0 axe violations.
