# TASK_PACKET_G03.md — Public Marketing Website (`M01–M12`)

- **Gate:** `G03`
- **Owner Approval Basis:** Gate `G02` approved by Project Owner (`2026-11-18T14:36+09:00`) — Direction A locked, Mascot Concept A ("Bé Mầm Bếp") + 53 SVG icons locked, `DDR-001` Option A routing approved, `M09/M11/M12` honest content templates approved.
- **Screen IDs in Scope (`12`):** `M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M12`
- **Canonical Routes (`DDR-001` Option A):**
  - `M01`: `/landing`
  - `M02`: `/how-it-works`
  - `M03`: `/features/ai-scan`
  - `M04`: `/features/fridge`
  - `M05`: `/features/meal-planning`
  - `M06`: `/features/recipes`
  - `M07`: `/features/cooking`
  - `M08`: `/features/shopping`
  - `M09`: `/pricing` (`BLOCKED_CONTENT` commercial pricing truth — Free vs Plus comparison + `/plus` sign-in CTA, zero fabricated VND numbers)
  - `M10`: `/faq` (accessible keyboard accordion)
  - `M11`: `/stories` (`BLOCKED_CONTENT` static editorial Kitchen Studio guides, zero fake testimonials)
  - `M12`: `/about`, `/contact`, `/privacy`, `/terms` (`BLOCKED_CONTENT` company/contact/legal template family)
- **Protected Red-Zone Impact:** `NONE` (`0` protected files modified).
- **Rollback:** `?vnext=0` or `VITE_VNEXT_UI_PREVIEW=false` or `git revert` on `feat/takolio-vnext-ui-architecture`.
