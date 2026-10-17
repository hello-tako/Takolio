# Admin V1 Remediation R1 — regression evidence

All commands ran in a **clean detached worktree of `25140ba`** (`git worktree add --detach /tmp/remed/clean 25140ba`,
`pnpm install --frozen-lockfile --offline`), after the final source change. Environment: Linux 4.19.0-gvisor x86_64,
4 vCPU, Node v24.21.0, pnpm 10.31.0, sqlite3 3.45.1, wrangler 4.149.0 (`WRANGLER_SEND_METRICS=false`, empty token,
throwaway config home), Playwright 1.63.0 Chromium (`PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright`).

| Command | Exit | Result |
|---|---|---|
| `pnpm test --reporter=dot --silent` (full suite, 01:09:15Z–01:25:13Z) | 0 | **342/342 files, 7865/7865 tests** (baseline before R1: 339 files / 7799 tests) |
| `pnpm lint` | 0 | |
| `pnpm typecheck` | 0 | web/test and worker projects |
| `pnpm build` | 0 | `dist/client` (no admin files) + `dist/admin` + worker typecheck |
| `pnpm check:migrations` | 0 | `migration-smoke=ok`, `admin-migration-smoke=ok` |
| `pnpm exec vitest run tests/integration/admin- tests/unit/admin-` | 0 | 10 files / 133 tests |
| `node scripts/admin-workerd-check.mjs` (real workerd) | 0 | 6/6 scenarios, 108 checks (`evidence/workerd-current.json`, head `25140ba`) |
| `node scripts/admin-workerd-check.mjs --mode baseline --root <3e865d0 worktree>` | 0 | S2 reproduced on the original commit (`evidence/workerd-baseline-3e865d0.json`) |
| `node scripts/admin-migration-matrix.mjs` (HEAD `25140ba`) | 0 | 11/11 (`evidence/migration-matrix.json`) |
| `pnpm test:admin:e2e` | 0 | 12/12; axe 0 violations on 11 screens; 0 px overflow at 1440/820/390 |
| Original review PoCs (51) on `3e865d0` | 0 | 51/51 pass (defects reproduced) |
| Original review PoCs (51) on R1 via adapter | 1 (expected) | 22 pass / 29 fail; 21/23 defect PoCs now fail; the 2 remaining and 8 contract-bound controls are explained in REPORT §8 |

The +3 files / +66 tests over the baseline are the new admin test files (`admin-remediation.test.ts`,
`admin-config.test.ts`, `admin-remediation-ui.test.tsx`) and the rewritten admin suites. No existing customer test
was modified by R1; the two ledger tests changed in `3e865d0` are restored to their baseline content.

Details: `evidence/full-suite-summary.txt`, `evidence/gates-clean-25140ba.txt`.
