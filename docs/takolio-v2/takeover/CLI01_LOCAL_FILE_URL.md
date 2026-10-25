# CLI01 - Local file URL path correction

Status: LOCAL_CLI01_VERIFIED. Implementation `c7f7b5510c3f23d7f3d59b66b556d13afd358a9b`. Parent `7d0e539281ab6d8261ef416ef1978b90bba8e486`.

Two inherited CLI tests passed URL.pathname containing New%20project to Node,
so the release script could not run. Both use Node fileURLToPath now. Exactly
two imports and two path expressions changed; assertions/fixtures and production
scripts are unchanged. No frontend/component/asset/backend/schema change.

| Check | Actual result |
| --- | --- |
| Targeted baseline | 293/298 pass; five failures; exit 1 |
| Same targeted command after fix | 298/298 pass; exit 0 |
| Full `pnpm test --maxWorkers=1` | 412/412 files, 9169/9169 tests pass; exit 0 |
| `pnpm lint`, `pnpm typecheck` | Pass |
| `pnpm check:migrations` | Pass, local only |
| `pnpm build` | Pass; existing Admin font warnings retained |
| Paired planner/composition ON build | Pass; actual VITE_MEAL_PLANNER_ENABLED and VITE_MEAL_COMPOSITION_V2_ENABLED |
| `pnpm audit --json` | Exit 1: 12 findings; 1 low / 8 moderate / 3 high |

Exact commands, timings, test-source hashes and log bindings: `evidence/cli-path/checks.json`.
Node v24.16.0; canonical TMPDIR; checkout contains a space. Full suite is serial;
no hosted/default-concurrency certification. First full attempt interrupted at
120.03s/exit130 after intermediate ignored test drafts were discovered; draft
bytes retained under .txt names, then a clean full rerun passed. Vitest config
and assertions were not weakened. Historical failed evidence remains unchanged.

Private recovery recheck and protected-main/strict-parent scope proofs are kept
under evidence/cli-path. Original Argon workspace is read-only; selected54
salvage paths, all ledger bytes and 38 PENDING owner reviews stay unchanged.
No screenshots needed for this test-only change; previous UI evidence retained.

This supersedes only the inherited five-CLI-failure claim and older dependency
counts. Finite frontend local evidence remains bounded, owner/media/device/live
and hosted acceptance still open. Next: DEP01 bounded Vite/Vitest patch, then
separate category/scan-history/Week-durability packets. Hono/Zod/Undici advisories
need their own compatibility review. No push, merge, deploy, remote migration or
production operation.
