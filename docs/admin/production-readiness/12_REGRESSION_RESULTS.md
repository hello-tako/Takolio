# Exact-source regression results

Frozen source: `9395f0e31ea599f1eb7780a8eba36964fed7c483`. Tree: `72276a5a3ecc8754c7537ac23ff2c8639d5cb79c`.
Implementation owner: `/root` (Codex). Started 2026-10-16T23:05:40.862Z; finished
2026-10-17T01:08:26.747Z. Environment: darwin/arm64, Node v24.16.0,
pnpm 10.33.2, Python 3.9.6. Recorded environment:
`{"CI": "true", "GITHUB_ACTIONS": "true", "PYTHONDONTWRITEBYTECODE": "1", "TMPDIR": "/private/tmp", "WRANGLER_SEND_METRICS": "false"}`.
All 15 commands completed with exit 0 and the frozen checkout
remained unchanged. Exact arguments, timestamps, raw-log SHA256 and results are
in `evidence/verification.json`. Original 066c35ad evidence is preserved under
`evidence/historical-066c35ad/`; it is not relabeled as this candidate.

| Check | Command | Exit / result | Local raw artifact |
| --- | --- | --- | --- |
| focused | `pnpm exec vitest run tests/integration/admin-console.test.ts tests/integration/admin-remediation.test.ts tests/integration/admin-r2-auth.test.ts tests/integration/admin-r2-governance.test.ts tests/integration/admin-r2-governance-races.test.ts tests/integration/admin-r2-facade.test.ts tests/integration/admin-r2-settings.test.ts tests/unit/admin-recovery.test.mjs tests/unit/admin-config.test.ts tests/unit/admin-local-tooling.test.ts tests/unit/admin-r2-routing.test.ts --maxWorkers=1 --testTimeout=20000` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/focused.log` |
| adapter | `pnpm exec vitest run tests/unit/admin-release-adapter.test.mjs tests/unit/admin-release-provider.test.mjs --maxWorkers=1` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/adapter.log` |
| lint | `pnpm lint` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/lint.log` |
| typecheck | `pnpm typecheck` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/typecheck.log` |
| build | `pnpm build` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/build.log` |
| migration-smoke | `pnpm check:migrations` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/migration-smoke.log` |
| workerd | `node scripts/admin-workerd-check.mjs --out .artifacts/admin-r2/9395f0e3/workerd.json` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/workerd.log` |
| migration-matrix | `node scripts/admin-migration-matrix.mjs --out .artifacts/admin-r2/9395f0e3/migration-matrix.json` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/migration-matrix.log` |
| admin-e2e | `pnpm test:admin:e2e` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/admin-e2e.log` |
| keyboard-repeat | `pnpm exec playwright test -c playwright.admin.config.ts -g scrollable tables --repeat-each 10` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/keyboard-repeat.log` |
| tracked-screenshots | `git diff --exit-code -- docs/admin/screenshots` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/tracked-screenshots.log` |
| configuration | `node scripts/admin-release-preflight.mjs` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/configuration.log` |
| public-scan | `python3 scripts/admin-public-scan.py` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/public-scan.log` |
| dependency-audit | `pnpm audit --audit-level=high` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/dependency-audit.log` |
| full-suite | `pnpm test --maxWorkers=1` | 0 / PASS | `.artifacts/admin-r2/9395f0e3/full-suite-serial.log` |

## Counts and scope

```json
{
  "focused": [
    "Test Files  11 passed (11)",
    "Tests  146 passed (146)"
  ],
  "adapter": [
    "Test Files  2 passed (2)",
    "Tests  107 passed (107)"
  ],
  "workerd": [
    "workerd-check current: PASS (10/10 scenarios)"
  ],
  "admin-e2e": [
    "12 passed (48.6s)"
  ],
  "keyboard-repeat": [
    "10 passed (20.0s)"
  ],
  "full-suite": [
    "Test Files  384 passed (384)",
    "Tests  8768 passed (8768)"
  ]
}
```

The matrix has 23
passing scenarios. Real local workerd includes the minimal shutdown Worker with
no bindings, three HTTP methods and protected pages/API/built assets. Multi-Worker
facade, customer compatibility, local D1 and Chromium checks remain included.
Browser E2E uses synthetic local data; keyboard runs repeat ten times; tracked
reference screenshots remain unchanged. The dependency audit is time-bounded,
and no dependency was added. All real staging checks remain NOT RUN.

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
remote adapter behavior and all staging cases remain unverified. Runtime test
results are pinned to the exact SHA above. Later documentation-only packaging
is not silently relabeled as full-suite-tested; its runtime/source manifest must
match and hosted checks on any deployment SHA are still required.


## Latest candidate qualification

The current full run is `9395f0e31ea599f1eb7780a8eba36964fed7c483`. Retained visual contact sheets and manual
observations named 066c35ad belong to that historical SHA; current generated E2E
screenshots/axe/overflow reports are copied from the new run and hashed in the
artifact manifest. No new manual device or screen-reader certification is claimed.
Live provider responses, environment configuration, account-wide token visibility,
first-resource provisioning and a compatible certified rollback baseline require
operator verification in staging. The live adapter exists and has local review;
its remote behavior is not certified by these offline fixtures.

## Current-source timing failure and complete rerun

The first default-concurrency `pnpm test` on 9395f0e3 failed: 374/384 files and 8758/8768 tests passed; nine tests exceeded their existing five-second timeout, and native family D1 measured 9136ms against its existing 8000ms budget. The exact failed verification and raw log remain under `.artifacts/admin-r2/9395f0e3-concurrent-failure/` in the private archive. All ten affected files then passed with one worker (170 tests); native D1 measured 2862ms. The complete full suite was subsequently rerun with `pnpm test --maxWorkers=1`, with all assertions and timeouts unchanged. Its actual result and count are listed above. These observations support machine resource contention; they do not certify default-concurrency stability or hosted latency. No source was changed to obtain the rerun. `evidence/verification.json` retains both fullSuiteAttempts and names the effective passing command.

Isolation experiment metadata is retained alongside timing-isolation.log in the private raw archive as timing-isolation.json. It binds the exact command, source, environment and digest; filesystem timestamps are recorded with their retrospective limitation. The complete serial full-suite native D1 measurement was 1966ms.

Public serialization normalization is recorded in evidence/public-normalization.json: a dependency patch filename is escaped for the unchanged email scanner; parsed source paths/digests remain identical. The original historical review report is preserved in the private evidence ZIP.
