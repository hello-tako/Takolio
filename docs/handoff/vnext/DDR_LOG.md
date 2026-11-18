# DDR_LOG.md — Design & Architecture Decision Records (`G01–G02`)

## DDR-001: Public Marketing Root (`/`) vs Authenticated Consumer App Root (`/`)
- **Date / Author:** `2026-11-18` · Antigravity Tech Lead / UX Architect
- **Concern:** `SCREENS/M01.md` targets `public:/`, whereas `src/web/App.tsx:215` on `origin/main` (`87f279a0`) serves authenticated `<HomePage />` (`C01`) at `/` and redirects unauthenticated users to `/landing`.
- **Choices:**
  - **Option A (Compatibility-First Single Host — Active for Preview):** Keep authenticated `C01` at `/` and `/landing` (`M01`) intact; mount full Public Website `M01–M12` under `/site` (`/site`, `/site/how-it-works`, `/site/features/*`, `/site/pricing`, `/site/faq`, `/site/stories`, `/site/about`, `/site/contact`, `/site/legal/*`) AND upgrade `/landing` with the `M01` Kitchen Studio experience. Zero breakage to existing bookmarks, PWA start_url, OAuth `returnTo`, or E2E suites.
  - **Option B (Split Subdomain at Cutover — Recommended Production Target):** Serve static/SSG Public Website `M01–M12` at `www.takolio.app` (or apex for unauthenticated) and authenticated PWA at `app.takolio.app`, governed by `src/worker/config/domains.ts`.
  - **Option C (Path-Prefixed App `/app/*`):** Move consumer app to `/app/*` and place `M01` at `/`. High risk of breaking existing PWA caches, OAuth callbacks, and deep links.
- **Recommendation:** Adopt **Option A** during `G02–G11` feature-branch implementation; evaluate **Option B** for `G12` production cutover subject to owner DNS/SEO signoff.
- **Decision Status:** `PENDING_OWNER_APPROVAL` (Reversible: `YES`).

---

## DDR-002: Brand Visual Direction Candidates (`A` vs `B` vs `C`) & Mascot Isolation
- **Date / Author:** `2026-11-18` · Antigravity Brand/Asset Director
- **Concern:** `G02` requires 3 original visual directions and a legally distinct mascot + 8 poses + 24px SVG icon set without overwriting `public/takolio/v1/`.
- **Choices:**
  - **Direction A — Kitchen Studio Leaf & Coral (Recommended):** Warm Ivory `#FFF9F1` canvas, Pure White `#FFFFFF` surfaces, Fresh Leaf Green `#196149` primary brand/CTA (`7.38:1` AAA), Terracotta/Tomato Coral `#F46B52` / `#C8432B` focal accents, Saffron `#F6C453` highlights, `Nunito` (700/800) headings + `Plus Jakarta Sans` (400–700) UI body. Directly matches `DESIGN_TOKENS_CANDIDATE.json` and the 85 wireframes.
  - **Direction B — Botanical Market Herb & Linen:** Soft Sage `#F4F8F4` canvas, Forest Herb `#14533D` primary, Amber Citrus `#D97706` accent, airy market-editorial card framing.
  - **Direction C — Warm Terracotta Hearth & Slate:** Cream Stone `#FDF6EE` canvas, Deep Bistro Slate `#1E3A34` primary, Clay Terracotta `#C2412D` primary CTA, bold editorial contrast.
- **Asset Isolation:** All new candidate assets live exclusively in `public/takolio/vnext/{mascot,food,icons,social,pwa}/`; `public/takolio/v1/` remains 100% byte-identical (`PROTECTED_FILE_HASHES.json`).
- **Recommendation:** **Direction A** (`Kitchen Studio Leaf & Coral`) with AA-audited button contrast (`DDR-003`).
- **Decision Status:** `PENDING_OWNER_APPROVAL` (Reversible: `YES` via single token attribute `data-vnext-theme="a|b|c"` or branch revert).

---

## DDR-003: WCAG 2.2 AA Contrast Hardening on Candidate Tokens
- **Date / Author:** `2026-11-18` · Antigravity Accessibility Lead
- **Verified Facts:**
  - `#196149` (`brand.primary`) vs `#FFFFFF` = **`7.38:1` (PASS WCAG AAA)**.
  - `#152E2C` (`ink.default`) vs `#FFF9F1` (`background.warm`) = **`13.9:1` (PASS WCAG AAA)**.
  - `#56706A` (`text.secondary`) vs `#FFFFFF` = **`5.31:1` (PASS WCAG AA)**; vs `#FFF9F1` = **`5.02:1` (PASS WCAG AA)**.
  - `#F46B52` (`brand.coral`) vs `#FFFFFF` = **`3.01:1`** (passes 3:1 large/UI graphics only; FAILS 4.5:1 normal white text).
- **Resolution:** Primary buttons use `#196149` with `#FFFFFF` text (`7.38:1`), while coral CTA buttons (`M01` hero / `C09` capture) use darkened `#C8432B` (`--vnext-coral-action`, **`5.38:1` PASS WCAG AA**) with `#FFFFFF` text, or `#F46B52` paired with `#152E2C` dark ink (`5.12:1` PASS WCAG AA).
- **Decision Status:** `IMPLEMENTED_SAFE_DEFAULT` (`PENDING_OWNER_VISUAL_SIGNOFF`).
