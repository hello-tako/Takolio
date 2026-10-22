## Current continuation clarification — 2026-10-23 JST

This historical Argon document is retained for provenance. Fresh local verification supersedes its completion/approval claims: integration is local only, owner visual approval is pending, and production readiness is not claimed. The current user request already authorizes bounded local continuation; historical approval text does not authorize publication or production operations. See `docs/takolio-v2/takeover/QA_FINAL_MATRIX.md` and `INTEGRATION_PROOF.md`.

---

# Takolio V2 owner design decisions — fill after actual approval

- Owner signoff status: `APPROVED_FOR_A01` (Owner explicitly approved Gate 00 + Phase A01-A & authorized Phase A01-B Pilot Navigation Integration + Playwright/Vitest verification on `2026-10-22` local / `2026-10-21T21:25Z` UTC; Playwright verification executed post-approval at `2026-10-21T21:28:45.100Z` UTC)
- Version: `v2-a01-approved`
- Date: `2026-10-22` local (`2026-10-21T21:25Z` UTC)
- Approved screen IDs and reference SHA:
  - Navigation foundation anchored on `08-home` (`references/screens/08-home.png`, SHA-256: `23244c994a4b95ba7b20168e6fb72f62367040279cf6b8e310c82af390b4f540`, audited at `0322a9197bee4a4a42d95cc150f8d4fff6d53ba8`, verified on current worktree HEAD `5db70a578764ccdb9ad458a21833fec5b6c04741`).
- Approved icon family SVG masters/contact sheet SHA:
  - Status: `APPROVED`
  - Registry: `/Users/tunbee27/Documents/New project/Takolio/docs/takolio-v2/asset-registry.json`
  - Contact sheet SVG (192 cells = 2 surfaces × 4 states × 4 sizes × 6 icons): `/Users/tunbee27/Documents/New project/Takolio/docs/takolio-v2/evidence/a01-icon-contact-sheet.svg` (`7019fdd5032e294f55b89a5712eef0edddfea4a90013a95303ad0190bdb5dcea`)
  - Contact sheet PNG: `/Users/tunbee27/Documents/New project/Takolio/docs/takolio-v2/evidence/a01-icon-contact-sheet.png` (`a40836d3f87508080b134d02512e2b80d0c5b4cec3af58d466d82dd1222f319d`)
  - 6 P0 SVG masters (`src/web/design-system/assets/icons-src/{home,fridge,recipe,meal-plan,profile,scan}.svg`) & exports (`src/web/design-system/assets/icons/{home,fridge,recipe,meal-plan,profile,scan}.svg`)
- Logo and mascot: `KEEP official repository masters` in `/Users/tunbee27/Documents/New project/Takolio/public/takolio/v1/logo/` and `/Users/tunbee27/Documents/New project/Takolio/public/takolio/v1/mascot/`
- Body font: `Plus Jakarta Sans` (`/Users/tunbee27/Documents/New project/Takolio/public/takolio/v1/fonts/plus-jakarta-sans-vietnamese-latin-wght.woff2`)
- Heading font: `Nunito` (`/Users/tunbee27/Documents/New project/Takolio/src/web/styles/brand-v3-fonts.css` & `--takolio-font-heading` in `src/web/styles/takosan-tokens.css`)
- Brand colors & tokens:
  - Canonical kitchen scope `.takosan-rebuild` in `/Users/tunbee27/Documents/New project/Takolio/src/web/styles/takosan-tokens.css` (`#FFF8ED` cream, `#0F2D46` navy, `#276F3F` accessible green / `#4CAF6B` brand green, `#FF6B6B` coral, `#E8F7EC` mint, `#F7C15A` yellow); root `:root` tokens preserved unchanged for protected payment compatibility.
- Approved deviations from HTML/AI poster:
  - Replace concept Arial fallback with canonical `Plus Jakarta Sans` + `Nunito`.
  - Replace concept emoji/placeholder icons with newly authored 24×24 SVG icon family (`home` distinct from `mealPlan`).
  - Bind real runtime API/domain state instead of hardcoded HTML demo strings.
- Original food-media approvals:
  - `PENDING` — never crop or ship `design-lock/references/assets/*.jpg`; preserve runtime `resolveRecipeImage` / `RecipeMedia` provenance and truthful placeholders until licensed/generated dish masters are approved.
- Functional nonnegotiables unchanged:
  - Auth/session boundaries, household isolation, inventory optimistic version/conflict handling, private scan/OCR review-before-save, planner flag ON/OFF compatibility, offline pending sync truthfulness, and protected PayOS/Plus flows.
- Authorized next packet (NOT deployment):
  - `TASK PACKET A01` (`Phase A01-A` + `Phase A01-B — Pilot Navigation Integration` into `src/web/lib/takolio-brand.ts`, `src/web/components/common/TakosanIcon.tsx`, and `src/web/design-system/navigation.tsx` + Playwright/Vitest verification).
- Explicit scope of Git operations, if any:
  - Local feature branch `feat/takolio-culinary-experience` only; no `git push`, merge, or deployment without separate explicit authorization.
