# Exact-source regression results

Frozen runtime source: `066c35ad670bc877756150c2055e3844dd7a17ce`. Tree: `341df1dd57e1034890007b3fec9a22c020fbadfb`.
Owner: `/root` (Codex). Start: 2026-10-16T20:52:04.696Z.
Finish: 2026-10-16T20:59:30.583Z. Environment: macOS arm64, Node 24.19.0,
pnpm 10.33.2, Python 3.12.14, TMPDIR=/private/tmp and recorded CI=true.
All commands completed with exit 0. Source and checkout remained unchanged.
Machine-readable commands, exact start/finish times, exits, signals, paths and
raw-log SHA256 are retained in `evidence/verification.json`. The runner did not
serialize GITHUB_ACTIONS; its value for this full run is not certified by that
record. The handoff reports true, but this is a provenance limitation. The
independent final-delta report separately records its 25-test command using both
CI=true and GITHUB_ACTIONS=true. Original verification bytes remain unchanged.

| Check | Exact command | Exit / result | Started UTC | Raw artifact path |
| --- | --- | --- | --- | --- |
| focused | `pnpm exec vitest run tests/integration/admin-console.test.ts tests/integration/admin-remediation.test.ts tests/integration/admin-r2-auth.test.ts tests/integration/admin-r2-governance.test.ts tests/integration/admin-r2-governance-races.test.ts tests/integration/admin-r2-facade.test.ts tests/integration/admin-r2-settings.test.ts tests/unit/admin-recovery.test.mjs tests/unit/admin-config.test.ts tests/unit/admin-local-tooling.test.ts tests/unit/admin-r2-routing.test.ts --maxWorkers=1 --testTimeout=20000` | 0 / PASS | 2026-10-16T20:52:04.712Z | `.artifacts/admin-r2/066c35ad/focused.log` |
| lint | `pnpm lint` | 0 / PASS | 2026-10-16T20:52:37.197Z | `.artifacts/admin-r2/066c35ad/lint.log` |
| typecheck | `pnpm typecheck` | 0 / PASS | 2026-10-16T20:52:44.003Z | `.artifacts/admin-r2/066c35ad/typecheck.log` |
| build | `pnpm build` | 0 / PASS | 2026-10-16T20:53:00.880Z | `.artifacts/admin-r2/066c35ad/build.log` |
| migration-smoke | `pnpm check:migrations` | 0 / PASS | 2026-10-16T20:53:10.196Z | `.artifacts/admin-r2/066c35ad/migration-smoke.log` |
| workerd | `node scripts/admin-workerd-check.mjs --out .artifacts/admin-r2/066c35ad/workerd.json` | 0 / PASS | 2026-10-16T20:53:10.652Z | `.artifacts/admin-r2/066c35ad/workerd.log` |
| migration-matrix | `node scripts/admin-migration-matrix.mjs --out .artifacts/admin-r2/066c35ad/migration-matrix.json` | 0 / PASS | 2026-10-16T20:53:45.102Z | `.artifacts/admin-r2/066c35ad/migration-matrix.log` |
| admin-e2e | `pnpm test:admin:e2e` | 0 / PASS | 2026-10-16T20:55:35.268Z | `.artifacts/admin-r2/066c35ad/admin-e2e.log` |
| keyboard-repeat | `pnpm exec playwright test -c playwright.admin.config.ts -g scrollable tables --repeat-each 10` | 0 / PASS | 2026-10-16T20:56:26.417Z | `.artifacts/admin-r2/066c35ad/keyboard-repeat.log` |
| tracked-screenshots | `git diff --exit-code -- docs/admin/screenshots` | 0 / PASS | 2026-10-16T20:56:46.393Z | `.artifacts/admin-r2/066c35ad/tracked-screenshots.log` |
| configuration | `node scripts/admin-release-preflight.mjs` | 0 / PASS | 2026-10-16T20:56:46.409Z | `.artifacts/admin-r2/066c35ad/configuration.log` |
| public-scan | `python3 scripts/admin-public-scan.py` | 0 / PASS | 2026-10-16T20:56:46.579Z | `.artifacts/admin-r2/066c35ad/public-scan.log` |
| dependency-audit | `pnpm audit --audit-level=high` | 0 / PASS | 2026-10-16T20:56:46.708Z | `.artifacts/admin-r2/066c35ad/dependency-audit.log` |
| full-suite | `pnpm test` | 0 / PASS | 2026-10-16T20:56:47.367Z | `.artifacts/admin-r2/066c35ad/full-suite.log` |

## Counts and scope

```json
{
  "focused": [
    " Test Files  11 passed (11)",
    "      Tests  146 passed (146)"
  ],
  "workerd": [
    "workerd-check current: PASS (9/9 scenarios)"
  ],
  "admin-e2e": [
    "  12 passed (49.1s)"
  ],
  "keyboard-repeat": [
    "  10 passed (19.5s)"
  ],
  "full-suite": [
    " Test Files  382 passed (382)",
    "      Tests  8661 passed (8661)"
  ]
}
```

Migration matrix: 23 scenarios,
all pass. Workerd uses actual local Wrangler/Workers/D1, synthetic fixtures and
Chromium. Admin E2E additionally uses the in-memory SQLite preview with the real
built frontend/Worker; it is not remote staging. Keyboard repeated ten consecutive
runs. Screenshot integrity command returned 0; no tracked reference changed.
Dependency audit reports no known vulnerabilities at its execution time; it is
not proof of absence. Existing Vite Admin font URL warnings are retained; emitted
font files exist and browser requests are checked. No new dependency is added.

## Failed and interrupted runs retained

- Historical R1 CI 38908914214 on cc1267e719b4af38325a20290382481e86f67a05
  is background only, never this R2 certification.
- Initial Node 25/macOS run had 11 failures in unchanged temp-path suites;
  targeted canonical-TMPDIR rerun passed. It is not a full-suite PASS.
- 53f4f4a0 verification failed its stale migration assertion/browser count and
  source-change check. Fixes are separate commits; no PASS is claimed for it.
- 6c3c6814-pnpm11-tooling-failure used the wrong bundled pnpm wrapper, which tried
  install and rejected dependency build scripts. Generated pnpm-workspace.yaml
  was removed; source/lockfile remained unchanged. This run is FAIL.
- Correct pnpm 10 run on 6c3c6814 passed focused/lint/types/build/migration matrix,
  but CI=true made fixture setup refuse workerd/browser startup. Full suite was
  deliberately stopped with SIGTERM before fixing source: INTERRUPTED, not PASS.
- Independent review retained its initial default-timeout failure and attributed
  passing 20-second-timeout rerun to the same reviewed backend source. See 13.

Raw logs are kept locally under the paths in verification.json and in the output
evidence archive. Public Git evidence records digests and sanitized reports,
not raw potentially verbose test output. See `evidence/artifacts.json` for
packaged artifact hashes. No real customer/operator data is included.

## Visual QA and release limits

The generated screenshots, axe report and per-route overflow JSON are retained
under `evidence/frontend`. Automated accessibility checks refuse serious/critical
violations; page overflow checks use 390/820/1440 widths. Manual screenshot
inspection observations are recorded with the delivery packet. Tests do not
claim complete manual keyboard/screen-reader certification or device coverage.

Hosted final-SHA CI, real Access tenant/JWKS/IdP policy, actual D1 distributed
concurrency, live resource identity, independent human roster, operational load,
live release adapters and all staging cases remain unverified. Runtime test
results are pinned to the exact SHA above. Later documentation-only packaging
is not silently relabeled as full-suite-tested; its runtime/source manifest must
match and hosted checks on any deployment SHA are still required.
