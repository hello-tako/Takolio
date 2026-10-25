# DEP01 - Bounded Vite/Vitest security patches

Status: LOCAL_DEP01_VERIFIED. Implementation `0da750f8fa25ddf8de01345c26a38cacc6d90937`. Parent `24d191b2cf90373fe0a2107772a6e1d7b4593fc0`.

Vite 6.4.3 becomes 6.4.4; Vitest 4.1.11 and its seven internal packages become
4.1.12. The Vite manifest range stays ^6.2.1; only the exact Vitest pin changes.
Lock normalization proves all other lock bytes unchanged after these patch
families and the upstream optional browser-webdriverio peer range are accounted
for. Rollup 4.63.1 and plugin-react 4.7.0 remain installed. Registry metadata,
lock integrities and downloaded tarball SHA512 match for all nine patch packages.
Node v24.16.0 satisfies their published engine ranges.

| Check | Actual result |
| --- | --- |
| Frozen install, installed versions, lock scope, registry integrity | PASS |
| Full `pnpm test --maxWorkers=1` | 412/412 files, 9169/9169 tests PASS; exit 0; wall 971.04s; reported 969.76s |
| Lint, typecheck, local migration smoke | PASS |
| Default build and actual paired planner/composition ON build | PASS |
| `pnpm audit --json` | Exit 1: 5 findings; 0 low / 3 moderate / 2 high |

Exact commands, source hashes, timings and complete-log hashes are bound in
`evidence/dependency-patch/checks.json`. Checks ran at the parent HEAD with the
exact manifest/lock bytes now committed by the implementation. Initial pnpm
lock generation changed additional Rollup resolutions; they were restored.
The first minimization attempt exited 1 (block matcher found zero keys), after
changing the manifest; its receipt/log are retained. The corrected attempt
restored 52 Rollup blocks and the final bounded normalization passed. These
preparation source transitions are recorded separately from immutable gates.

The audit falls from CLI01's 12 to the observed 5 findings. Hono, Zod and Undici
remain vulnerable; overall dependency audit remains FAIL. No broad audit fix,
major upgrade or override is introduced. Default-build inherited Admin font
warnings remain in the complete logs. This local serial run does not certify
hosted concurrency or production behavior.

Recovery and official-main/strict-parent proofs are separate JSON receipts in
the same evidence directory. Original Argon source and private snapshot remain
recoverable; 54 selected paths, ledger bytes and 38 PENDING owner reviews remain.
Frontend screenshots and historical evidence stay unchanged. No frontend,
asset, backend, auth, payment, schema or production-infrastructure source changes.
Next: continue the separately scoped category readback/replay, scan manual-history
and Week offline-durability packets. Owner/media/device/live/hosted acceptance
stays open. No push, merge, deploy, remote migration or production operation.
