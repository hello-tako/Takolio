# OPEN_DECISIONS.md — Gate G12 Release Signoff Ledger

- **Updated at (JST):** `2026-11-18T16:22:00+09:00`
- **Resolved Gate G02 Decisions (`APPROVED BY OWNER 2026-11-18T14:36:13+09:00`):**
  1. [x] **Brand Lock (`DDR-002` / `DDR-003`):** Direction A (Kitchen Studio Leaf & Coral) + Mascot "Bé Mầm Bếp" + 53 pure-vector SVG icons — **LOCKED**.
  2. [x] **Golden Candidates (`G02`):** `M01, A02, O03, C01, C03, C18, C23, AD02` — **APPROVED**.
  3. [x] **Public/App Routing (`DDR-001`):** Option A same-origin routes — **APPROVED & IMPLEMENTED**.
  4. [x] **Honest Gaps & Red Zone (`DDR-004`):** `U06/U10` transparent `UnavailableState` (`RFC-001/002`) + `341` Red-Zone files untouched — **APPROVED & ENFORCED**.
- **Resolved Gate G12 Decisions (`APPROVED BY OWNER 2026-11-18T16:11:00+09:00`):**
  1. [x] **Open PR to `main` (Without Merging):** Opened **PR #61** (`https://github.com/hello-tako/Takolio/pull/61`) from `feat/takolio-vnext-ui-architecture` → `main` (**OPEN · NOT MERGED**).
  2. [x] **Deploy Staging Preview:** Uploaded `frigo-staging` Worker Version **`50d4df9a-6283-46de-96ea-b2924a4cd189`** (`55d35c74`) behind Cloudflare Access:
     - **Alias URL:** `https://vnext-g12-frigo-staging.tungbipdz.workers.dev`
     - **Immutable Version URL:** `https://50d4df9a-frigo-staging.tungbipdz.workers.dev`
  3. [x] **Approve `M09 / M11 / M12` Legal & Commercial Copy:** Approved as drafted (`APPROVED_G12_OWNER_COPY` in `SCREEN_COVERAGE.csv`).

---

## Remaining Post-Staging Owner Signoff (`HARD STOP — DO NOT EXECUTE WITHOUT EXPLICIT COMMAND`)

1. [ ] **Merge Authorization (`PR #61` → `main`):** Awaiting Project Owner Staging acceptance before merging `https://github.com/hello-tako/Takolio/pull/61`.
2. [ ] **Canonical Staging / Production Release Authorization:** Do **NOT** promote to `staging.takolio.app` canonical main release or **Production** (`takolio.app` / `frigo.tungjpstore.net`) until separate explicit Project Owner command is given.
