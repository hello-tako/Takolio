# NEXT_TASK_PACKET.md — Ready Immediately After Gate G02 Owner Signoff

- **Prepared at (JST):** `2026-11-18T13:45:00+09:00`
- **Target Gates:** `G03` (Public Marketing Website `M01–M12`) → `G04` (Auth & Onboarding `A01–A08, O01–O06`)

## Packet `G03` — Public Website (`M01–M12`)
1. **Scope (`12` screens):**
   - Finalize `M01` (`Landing — Hôm nay ăn gì?`) with locked brand direction (removing temporary `G02DirectionPreviewBar`).
   - Implement `M02` (`/how-it-works`), `M03` (`/features/ai-scan`), `M04` (`/features/fridge`), `M05` (`/features/meal-planning`), `M06` (`/features/recipes`), `M07` (`/features/cooking`), `M08` (`/features/shopping`), `M09` (`/pricing` — honest plan comparison & sign-in to `/plus` without unverified prices), `M10` (`/faq`), `M11` (`/stories` editorial template), `M12` (`/about`, `/contact`, `/privacy`, `/terms` legal/contact family).
2. **Hard Guardrails:**
   - Zero protected-file modifications (`src/worker/**`, `migrations/**`, `public/takolio/v1/**`, PayOS untouched).
   - Every route lazy-loaded in `src/web/App.tsx` (preserving AST lazy-route invariant in `tests/integration/frontend-ui-integration.test.tsx`).
   - Semantic landmarks, `vi-VN` metadata/OpenGraph (`og-1200x630.webp`), `390×844` + `1440×900` Playwright captures + `axe-core` WCAG 2.2 AA `0` violations.

## Packet `G04` — Authentication & Onboarding (`A01–A08`, `O01–O06`)
1. **Scope (`14` screens):**
   - `A01` Choose entry, `A02` Login, `A03` Google Identity Services state, `A04` Register with Cloudflare Turnstile boundary, `A05` 6-digit OTP `/auth/verify` with tab-scoped recovery & cooldown, `A06` Forgot password, `A07` Reset password, `A08` `DEC-012` guest data transfer deferred state.
   - `O01` Welcome, `O02` Goals (`primaryGoal`), `O03` Household size (`1..20`), `O04` Taste & dietary restrictions, `O05` Kitchen starter path, `O06` Server-confirmed onboarding completion.
2. **Verification:**
   - Full `tests/unit/auth-funnel-ui.test.tsx` + `tests/integration/frontend-ui-integration.test.tsx` + live Playwright auth/OTP/onboarding flow verification.
