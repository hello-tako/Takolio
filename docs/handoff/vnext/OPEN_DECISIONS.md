# OPEN_DECISIONS.md — Gate G12 Release Signoff Ledger

- **Updated at (JST):** `2026-11-18T15:32:00+09:00`
- **Resolved Gate G02 Decisions (`APPROVED BY OWNER 2026-11-18T14:36:13+09:00`):**
  1. [x] **Brand Lock (`DDR-002` / `DDR-003`):** Direction A (Kitchen Studio Leaf & Coral) + Mascot "Bé Mầm Bếp" + 53 pure-vector SVG icons — **LOCKED**.
  2. [x] **Golden Candidates (`G02`):** `M01, A02, O03, C01, C03, C18, C23, AD02` — **APPROVED**.
  3. [x] **Public/App Routing (`DDR-001`):** Option A same-origin routes — **APPROVED & IMPLEMENTED**.
  4. [x] **Honest Gaps & Red Zone (`DDR-004`):** `M09/M11/M12/U06/U10` transparent templates/unavailable states + `341` Red-Zone files untouched — **APPROVED & ENFORCED**.

---

## Remaining Gate `G12` Owner Release & Merge Decisions (`RELEASE_CANDIDATE_READY`)

1. **PR / Merge / Staging Promotion Authorization:**
   - All `G00–G12` engineering deliverables are complete locally on branch `feat/takolio-vnext-ui-architecture`. Per strict safety rules, **no push, merge to `main`, staging deploy, or production deploy** has been executed.
   - **Question:** Do you authorize pushing `feat/takolio-vnext-ui-architecture` and opening a Pull Request / deploying to **Staging** first for live review before any Production promotion?
2. **Optional Post-Frontend Tracks (Non-Blocking for vNext UI):**
   - Supply final legal/commercial text for `M09` (public pricing), `M11` (CMS stories), and `M12` (`/privacy`, `/terms`, support email).
   - Authorize separate backend track if you wish to implement `RFC-001` (`U06` Household Invites) or `RFC-002` (`U10` Self-Service Data Export/Deletion).
