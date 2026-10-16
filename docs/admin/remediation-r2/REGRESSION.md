# Recovered-source checks — 2026-10-16

**Verdict: ADMIN_V1_R2_BLOCKED.** Source before import-only matrix repair:
`9ade6a1593016e99ecd6cd4044495c95ed7cccb9`; repaired source:
`9f3e59a6ed3a9b6b6041fef2e0a83340d1db1dd5`.
These are implementer checks, not independent certification.

| Executed check | Observed result |
|---|---|
| `pnpm lint` | PASS, exit0 on9ade6a15 |
| `pnpm typecheck` | FAIL, exit2: six TS2307 missing-module diagnostics |
| `pnpm build` | FAIL, exit2: frontends build, Worker TS fails on missing modules |
| `pnpm check:migrations` | PASS, exit0, both smoke markers; Admin0001 only, NOT R2/version2 proof |
| `pnpm exec vitest run tests/unit/admin-r2-routing.test.ts --silent` | PASS, 1file/20tests, exit0 |
| `pnpm exec vitest run tests/integration/admin-r2-auth.test.ts --silent` | FAIL at import, 0tests executed, exit1 |
| `pnpm admin:workerd:check` | FAIL, exit1: missing facade Worker entrypoint; no new workerd/browser proof |
| `pnpm test:admin:e2e` | FAIL, exit1: preview cannot load missing facade client; no browser tests executed |
| `pnpm admin:migration:matrix -- --out ...` before repair | FAIL0/1, exit1: `spawnSync is not defined` |
| Expanded matrix after9f3e59a6 import repair | FAIL, exit1, **20/23**: two version1-vs2 apply failures plus missing-column rollback-injection precondition. Preserved JSON: evidence/migration-matrix-9f3e59a6.json |
| `pnpm test --maxWorkers=1 --bail=1 --silent` | Stopped after confirmed missing-module collection failure; exit143 (SIGTERM). Partial run only, no complete test total/PASS. |

The missing modules and preserved preliminary draft stash are listed in REPORT.md.
Protected-path diff against integrated main0ff82ed is empty for customer web,
packages, customer Worker entry/types/services/middleware, customer migrations,
public assets, customer configs, workflows and Vite config.

Earlier WP0 counts below are historical observations, not fresh R2 proof.
No screenshot is shared as current evidence: the recovered app cannot start.

---

# R2 regression evidence

Provenance: SOURCE_MANIFEST.md. **R2 final checks are not complete.**

Historical R1 reports remain under reviews/ and remediation-r1/. Current R2
acceptance cannot reuse their counts. WP0 observations and the interrupted
single-worker rerun are documented in REPORT.md. Source-integration checks
run while dependencies were being reconstructed failed; they are not final
regression evidence. A new frozen-source run is required after integration.

The raw historical PoCs intentionally assert defects. Fixing a defect can make
that historical assertion fail; preserve raw outputs and explain each expected
difference rather than removing assertions. New controls must explicitly test
issuer/subject/enrollment requirements that R1 token fixtures did not include.
