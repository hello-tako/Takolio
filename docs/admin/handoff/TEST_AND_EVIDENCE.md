# Test and evidence register

**Read this before quoting any number.** Each result below has a provenance tag:

- **EXEC-REVIEW-0331cc9** — executed by the R1 certification review on 2026-10-14 in a clean worktree of `0331cc9` (`git worktree add --detach`, `pnpm install --frozen-lockfile --offline`). Logs are in `docs/admin/reviews/r1-certification/evidence/`.
- **HIST-R1-25140ba** — reported by the R1 remediation team at `25140ba`. Cited from `docs/admin/remediation-r1/`. Not re-executed by this handoff.
- **EXEC-HANDOFF-2026-10-15** — executed during this handoff.

The handoff did **not** re-run the full suite (the handoff brief said that was not required). The last full run is EXEC-REVIEW-0331cc9.

## 1. Results

| Check | Command | Result | Tag | Evidence |
|---|---|---|---|---|
| Full suite | `pnpm test --reporter=dot --silent` | exit 0; **342 files / 7865 tests passed**; 654.5 s | EXEC-REVIEW-0331cc9; HIST-R1-25140ba (same count) | `reviews/r1-certification/evidence/full-suite.txt`; `remediation-r1/evidence/full-suite-summary.txt` |
| Lint | `pnpm lint` | exit 0 | EXEC-REVIEW-0331cc9; EXEC-HANDOFF-2026-10-15 (at `95a1425`) | `evidence/logs/lint.log` |
| Typecheck | `pnpm typecheck` | exit 0 | EXEC-REVIEW-0331cc9 | `evidence/logs/typecheck.log` |
| Build | `pnpm build` | exit 0 (customer, admin and Worker) | EXEC-REVIEW-0331cc9 | `evidence/logs/build.log` |
| Migration smoke | `pnpm check:migrations` | `migration-smoke=ok`, `admin-migration-smoke=ok` | EXEC-REVIEW-0331cc9 | command output only; not committed as a file |
| Migration and rollback matrix | `node scripts/admin-migration-matrix.mjs --out …` | **11/11** (pinned to the 41-file customer ledger) | EXEC-REVIEW-0331cc9 | `evidence/migration-matrix.json` |
| Implementer workerd checks | `node scripts/admin-workerd-check.mjs --out …` | **108/108** in 6 scenarios | EXEC-REVIEW-0331cc9 | `evidence/workerd-implementer.json` |
| Reviewer workerd probe | `node docs/admin/reviews/r1-certification/tools/workerd-probe.mjs <baseline-worktree> <out>` | **1169/1169** in 17 scenarios (production positive, 12 negative variants, real browser session under workerd, customer Worker parity with `186a9cf`) | EXEC-REVIEW-0331cc9 | `evidence/workerd-independent.json`, `evidence/r1-independent.log` |
| Reviewer tests | `vitest run r1-independent.test.ts` (restored) | **18/18** (6 FINDING tests reproduce; 12 CONTROL tests hold) | EXEC-REVIEW-0331cc9 | `evidence/r1-independent.txt` |
| Original PoCs before | `vitest` on `3e865d0` | **51/51 passed** (the defects reproduce) | EXEC-REVIEW-0331cc9 | `evidence/poc-before.json` |
| Original PoCs after | `vitest` on `0331cc9` through the adapter | **22 passed / 29 failed**; 0 unexplained (8 controls fail for intended contract changes; 2 attack PoCs still pass for stated reasons) | EXEC-REVIEW-0331cc9 | `evidence/poc-after.json`, `evidence/poc-matrix.md` |
| E2E + axe + overflow | `pnpm test:admin:e2e` | **11 passed, 1 failed** (keyboard test F8). axe: 0 violations on 11 screens. Overflow: 0 on 10 screens at 1440/820/390. | EXEC-REVIEW-0331cc9. HIST-R1-25140ba reported **12/12**. | `evidence/e2e.txt`, `evidence/axe-report.json`, `evidence/overflow-*.json` |
| Keyboard E2E repeat | `playwright test -g "scrollable tables" --repeat-each 6` | 4 passed, 2 failed | EXEC-REVIEW-0331cc9 | `evidence/e2e-keyboard-repeat.txt` |
| Keyboard diagnostic | `tools/keyboard-diagnostic.mjs` (5 runs) | 80 px scrolled within 150 ms in 5/5 runs | EXEC-REVIEW-0331cc9 | `evidence/keyboard-diagnostic.json` |
| Customer artifact identity | `dist/client` digests and `wrangler deploy --dry-run` bundle vs `186a9cf` | 441/441 files identical; Worker bundle identical (path-normalised); 0 admin files in customer `dist/client` | EXEC-REVIEW-0331cc9 | `evidence/dist-client-src.sha`, `evidence/dist-client-pre.sha`, `evidence/logs/dryrun-*.log` |
| Guard refusals | `admin-local-d1.mjs seed --remote`; `reset` without `--yes`; `admin-provision` with `CLOUDFLARE_API_TOKEN` set | each exits 1 with a refusal message; no wrangler call | EXEC-HANDOFF-2026-10-15 | this register |
| Workflow trigger parse | `js-yaml` on `.github/workflows/*.yml` | see `FILE_MANIFEST.md` §3 and `PRODUCTION_BLOCKERS.md` | EXEC-HANDOFF-2026-10-15 | this register |
| Secret scan | `docs/admin/handoff/tools/secret_scan.py` on `186a9cf..HEAD` and on the handoff diff | no GitHub, Cloudflare, AWS, Google, Slack, OpenAI-style, PEM or JWT material; no session or CSRF values; only synthetic fixture values (`*.takosan.test`, the local fixture password defined in `scripts/admin-local-lib.mjs`) and hashes | EXEC-HANDOFF-2026-10-15 | this register; scanner in `tools/` |
| Customer identity vs `186a9cf` | `git diff --quiet 186a9cf HEAD -- <paths>` | identical for `src/worker/index.ts`, `types.ts`, `config/csp.ts`, `middleware/rate-limit.ts`, `public/sw.js`, `scripts/migration-smoke.sh`, `tests/helpers/sqlite-d1.ts`, `tests/integration/auth-*.test.ts`, `vite.config.ts`, `migrations/`, `wrangler*.jsonc`, `.github/`, `index.html`. Different: `package.json` (+12/−3, admin scripts) and `tsconfig.json` (+1, `src/admin` include). | EXEC-HANDOFF-2026-10-15 | `FILE_MANIFEST.md` §2 |
| Repository identity | unauthenticated `GET https://api.github.com/repos/hello-tako/Tako-san` | id `1385308553`, `public`, `default_branch: main` | EXEC-HANDOFF-2026-10-15 | this register |

## 2. Commands and prerequisites

Prerequisites, versions and environment: see `LOCAL_RUNBOOK.md` §1–§2. Reviewer environment for EXEC-REVIEW-0331cc9: Node v24.21.0, pnpm 10.31.0, wrangler 4.149.0, Playwright 1.63.0 (Chromium), vitest 4.1.11, sqlite3 3.45.1. CI uses Node 22 and pnpm 10; Node 22 has **not** been used locally by this register (UNVERIFIED on 22).

Every wrangler call in the review ran with `WRANGLER_SEND_METRICS=false`, an empty `CLOUDFLARE_API_TOKEN` and a throwaway `XDG_CONFIG_HOME`. The review made no remote Cloudflare call.

## 3. Evidence index

`docs/admin/reviews/r1-certification/evidence/` (review, EXEC-REVIEW-0331cc9):
- `full-suite.txt`, `gates.txt`, `logs/` (lint, typecheck, build, pre-build, dry-run, e2e, e2e-keyboard-repeat, r1-independent, workerd, migration-matrix, poc-before/after logs)
- `poc-before.json`, `poc-after.json`, `poc-matrix.md` (the full 51-row matrix)
- `workerd-implementer.json`, `workerd-independent.json`, `migration-matrix.json`
- `axe-report.json`, `overflow-1440.json`, `overflow-820.json`, `overflow-390.json`, `keyboard-diagnostic.json`, `e2e.txt`, `e2e-keyboard-repeat.txt`, `r1-independent.txt`
- `dist-client-src.sha`, `dist-client-pre.sha`

`docs/admin/remediation-r1/evidence/` (R1 team, HIST-R1-25140ba): `full-suite-summary.txt`, `gates-clean-25140ba.txt`, `migration-matrix.json`, `poc-original-vs-remediated.{log,summary.txt}`, `poc-baseline-3e865d0.log`, `workerd-baseline-3e865d0.json`, `workerd-current.json`, `axe-report.json`, `overflow-*.json`, `screens/` (5 PNG), `screens-r1-local-run/` (24 PNG, unique local captures added by this handoff), `poc-adapter/harness.ts`, `logs/` (R1 team logs, copied from `/tmp/remed`).

`docs/admin/reviews/evidence/first-review-2026-10-12/`: `full-suite.log`, `gate-d-scripts/` and `gate-d-results/` (first-review browser sweep, Gate D), `review-shots/` (3 PNG, unique local captures).

`docs/admin/reviews/poc-archive/`: 16 `.txt` files (original 3e865d0 PoCs and adapter copies) and a README with restore steps.

`docs/admin/screenshots/`: 16 tracked PNG from earlier runs. The E2E overwrites them (F9).

## 4. Known limitations of this evidence

1. The reviewer and the implementer are the same agent (review §0). Results are self-verification, not independent verification.
2. Chromium only. No staging and no production behaviour was tested.
3. Cloudflare Access was tested with locally generated RS256 keys, not with the real team JWKS.
4. The keyboard E2E is flaky (F8). E2E 11/12 is the reviewer's run; the R1 team's 12/12 is historical.
5. The migration matrix pins the 41-file ledger. It fails on `origin/main` (43 files) by design until WP0.
6. Several logs contain sandbox paths such as `/tmp/r1cert/src`. They are kept unedited for evidence integrity.
7. Secret scanning used a regex scanner (`tools/secret_scan.py`). `gitleaks` is not installed in this environment and was not run.
8. The evidence was not regenerated during this handoff.
