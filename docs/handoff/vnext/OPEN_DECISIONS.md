# OPEN_DECISIONS.md — Gate G02 Owner Signoff & Non-Reversible Decisions

- **Generated at (JST):** `2026-11-18T13:45:00+09:00`
- **Blocking Gate:** `G02` (Visual & Brand Asset Lock + Pilot Golden Signoff before scaling `G03–G12`)

## Decision 1 — Brand Direction Lock (`DDR-002`)
- **Context:** Three complete token palettes and pure-vector SVG brand lockups (`A`, `B`, `C`) are live and switchable on `/vnext` and across all 8 pilot screens (`?dir=a|b|c`).
  - **Option A (Recommended — Kitchen Studio Leaf & Coral):** Warm Cream `#FFF9F1`, Leaf Green `#196149` (`7.38:1` AAA), Hardened Coral CTA `#C8432B` (`5.38:1` AA) + Coral Accent `#F46B52`, Saffron `#F6C453`, Deep Pine Ink `#152E2C` (`13.9:1` AAA). Matches `DESIGN_TOKENS_CANDIDATE.json` and the 85 wireframes most faithfully.
  - **Option B (Botanical Market Herb & Linen):** `#F4F8F4` cool herb canvas, Forest `#14533D`, Amber Citrus `#B45309`.
  - **Option C (Warm Terracotta Hearth & Slate):** `#FDF6EE` warm stone canvas, Bistro Slate `#1E3A34`, Clay Terracotta `#B83B28`.
- **Owner Question:** Approve **Direction A (Kitchen Studio Leaf & Coral)** + Concept A Mascot (**"Bé Mầm Bếp"** ceramic pot character, 8 poses + pure SVG master) + the 53 pure-vector `24×24` SVG icons as the locked Takolio vNext visual system?

## Decision 2 — Pilot Golden Candidate Signoff (`M01, A02, O03, C01, C03, C18, C23, AD02`)
- **Context:** Per `QA/03_VISUAL_COMPARISON_PROTOCOL.md`, the 8 pilot screens have been implemented over real Worker/SQLite contracts and captured at `390×844` and `1440×900` with `0` console errors, `0` HTTP 500s, `0px` horizontal overflow (`320..1440px`), and `0` Axe WCAG 2.2 AA violations.
- **Owner Question:** Approve these 8 live browser screen implementations as the **G02 Golden Baseline** to scale across `G03–G10` (removing the temporary top `G02DirectionPreviewBar` once Direction A/B/C is locked)?

## Decision 3 — Public Marketing vs Consumer App Routing (`DDR-001`, Gate `G03`)
- **Context:** On `origin/main` (`87f279a0`), `/` is the authenticated Consumer App Home (`C01`) and `/landing` is the Public Landing (`M01`), protected by dozens of integration/auth redirect tests.
  - **Option A (Recommended — Zero-Regression Same-Origin Path Prefix):** Keep authenticated app routes (`/`, `/fridge`, `/scan`, `/recipes`, `/planner`, `/shopping`, `/me`) 100% intact; serve Public Website `M01–M12` at `/landing`, `/how-it-works`, `/features/*`, `/pricing`, `/faq`, `/stories`, `/about`, `/contact`, `/privacy`, `/terms` (and redirect unauthenticated visitors hitting `/` to `/landing` exactly as `HEAD` already does!).
  - **Option B (Split Subdomain):** `takolio.com` (`M01–M12`) vs `app.takolio.com` (`C01..U10`) — requires DNS/Cloudflare Worker route & cookie/CORS infrastructure approval.
- **Owner Question:** Confirm **Option A** for `G03` implementation?

## Decision 4 — Commercial, Legal & Backend RFC Scope (`M09, M11, M12, U06, U10`)
- **Context:**
  - `M09` (`/pricing`), `M11` (`/stories`), `M12` (`/about, /contact, /privacy, /terms`): No public unauthenticated billing plans API, CMS, or legal text exists on `HEAD` (`RFC-003`). In `G03`, we recommend building honest production-ready UI templates marked with transparent preview/sign-in actions until owner supplies approved legal/pricing copy.
  - `U06` (Household Invites/Members — `RFC-001`) & `U10` (Data Export/Account Deletion — `RFC-002`): Protected Worker/D1 endpoints do not exist on `HEAD`. Per `00_MASTER_ORCHESTRATOR_COPY_PASTE.md`, we keep Protected Red Zone untouched (`0` backend edits) and render honest `UnavailableState` panels in `G09` unless you explicitly authorize backend RFC work in a separate backend track.
- **Owner Question:** Confirm keeping **Protected Red Zone (`src/worker/**`, `migrations/**`, PayOS `U08`) strictly untouched** during `G03–G12` frontend rollout and using honest preview/unavailable states for `M09/M11/M12/U06/U10`?
