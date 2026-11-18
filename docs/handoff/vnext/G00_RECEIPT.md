# G00_RECEIPT.md — Gate 00 Read-Only Baseline Audit Receipt

- **Gate:** `G00 — Baseline: Read-only audit`
- **Status:** **`PASS`** (Technical Gate — `0` app files modified during G00)
- **Verified Live `origin/main` Commit:** `87f279a055e028336ea334cc51c7ab4224f30ef4`
- **Kit Reference Commit:** `87f279a055e028336ea334cc51c7ab4224f30ef4` (Exact match)
- **Audit Worktree:** `/Users/tunbee27/.gemini/antigravity/scratch/Takolio-vnext`
- **Deliverables Produced:**
  1. `CURRENT_BASELINE.md` — Repo, stack, Worker mounts (`/api/v1`, `/api/v2`, `/admin/api`), feature flags, 85-ID summary.
  2. `ROUTE_STATE_API_MATRIX.csv` — `85/85` Screen IDs mapped to exact routes, states, components, APIs, and gaps.
  3. `PROTECTED_FILE_HASHES.json` & `PROTECTED_PATHS.txt` — `341` protected files SHA-256 hashed (`src/worker/**`, `packages/domain/**`, `packages/db/**`, `migrations/**`, `migrations-admin/**`, `.github/workflows/**`, `wrangler*.jsonc`, `public/takolio/v1/**`, `src/web/components/payment/**`, `src/web/services/billing.ts`).
  4. `DEBT_REGISTER.md` — 7 prioritized architectural/visual/contrast/backend risks (`RISK-01..RISK-07`).
  5. `BASELINE_TESTS.md` — `pnpm typecheck` (`exit 0`), `pnpm lint` (`exit 0`), `pnpm build` (`exit 0`), `pnpm check:migrations` (`exit 0`), focused Vitest `12 files / 166 tests` (`exit 0`).
  6. `baseline_screenshots/` — `18` baseline browser captures (`390×844` + `1440×900`) across `M01, A02, O03, C01, C03, C18, C23, AD01, AD02` on untouched `87f279a0`.
