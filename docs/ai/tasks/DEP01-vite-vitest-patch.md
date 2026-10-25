# DEP01 - Bounded Vite/Vitest security patches

Status: LOCAL_VERIFIED. Implementation: `0da750f8fa25ddf8de01345c26a38cacc6d90937`. Parent checkpoint: `24d191b2`.

## Scope

The fresh CLI01 audit reports twelve findings. Patch only installed Vite6.4.3
and Vitest4.1.11 to their compatible fixed patch versions6.4.4 and4.1.12.
Retain the Vite manifest range, existing dependency policy, assertions/config,
backend/security/runtime source and all Argon work. The Vitest exact direct pin
and its internal packages advance together. Inspect lockfile changes before
installing; reject unrelated resolutions. No blanket audit fix or overrides.

Hono, Zod and Undici advisories need separate compatibility/exposure work.
This packet does not upgrade their majors or claim the overall audit is green.
Original Argon checkout remains read-only; recovery snapshot remains private.
No push, merge, deploy, remote migration or production operation.

## Acceptance

- Only package.json Vitest exact pin and pnpm-lock.yaml patch graph change.
- Verify metadata engine/peer compatibility, installed versions and frozen lock.
- Run lint, typecheck, full serial test suite, local migration smoke, default and
  actual paired planner/composition-ON builds. Preserve every failure/attempt.
- Re-run dependency audit; report observed remaining advisories, not estimates.
- Bind exact commands/logs/source hashes and strict-parent protected scope;
  verify original/private recovery integrity, selected54paths and ledgers.
- Update CURRENT_STATE, TASK_BOARD and HANDOFF; implementation commit and separate
  evidence checkpoint. Prior frontend screenshot evidence stays unchanged.

## Executed result

Implementation `0da750f8fa25ddf8de01345c26a38cacc6d90937`; parent `24d191b2cf90373fe0a2107772a6e1d7b4593fc0`.

412/412 files, 9169/9169 tests PASS; exit 0; wall 971.04s; reported 969.76s. Frozen install, lint/typecheck/local migrations/default and
actual paired-ON builds PASS. Nine registry/lock/tarball integrity checks PASS;
all other lock bytes and Rollup 4.63.1 unchanged. First minimization exit 1
retained, corrected attempt and bounded normalization PASS. Audit remains FAIL:
5 findings (0 low / 3 moderate / 2 high), limited to Hono/Zod/Undici.
Exact commands/log/source bindings and recovery/scope proofs:
`docs/takolio-v2/takeover/DEP01_VITE_VITEST_PATCH.md`.
