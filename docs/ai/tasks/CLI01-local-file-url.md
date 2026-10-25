# CLI01 - Local file URL paths in CLI regression tests

Status: LOCAL_VERIFIED. Implementation: `c7f7b5510c3f23d7f3d59b66b556d13afd358a9b`. Parent checkpoint: `7d0e539281ab6d8261ef416ef1978b90bba8e486`.

## Problem and scope

The current full suite records five failures in two CLI fixture tests when the
checkout directory contains a space. `URL.pathname` passes the encoded `%20` to
Node instead of a filesystem path, preventing the intended release guard from
running. Reproduce the two existing test files, then use Node's `fileURLToPath`
for their two executable script paths. Keep all assertions and fixture authority.

Allowed code paths: `tests/unit/release-check.test.mjs` and
`tests/unit/production-catalog-continuity.test.mjs`. No production script,
workflow, app, backend, service, store, asset, schema or dependency change.
Original Argon workspace remains read-only; its verified private snapshot remains
available. No push, merge, deployment, remote migration or production operation.

## Acceptance and verification

- Existing successful CLI cases execute; existing rejection/ancestry/content-drift
  assertions still pass. No skipped assertions or weaker guard expectations.
- Run both affected files before/after from this space-containing checkout with
  Node24, then lint, typecheck, full suite, local migration smoke and build.
- Bind logs to exact commands, exit codes and source hashes; preserve historical
  evidence. No screenshot required for a test-only filesystem-path correction.
- Recheck protected/source scope and private recovery integrity; record actual
  results in CURRENT_STATE, TASK_BOARD and HANDOFF before the local checkpoint.

Dependency advisories, inventory category/scan history, Week offline durability,
media rights, owner review and device/live acceptance are separate work.

## Executed result

Full local serial suite 412 files / 9169 tests PASS; targeted 298/298 PASS.
Lint, typecheck, local migration smoke, default and actual paired-ON builds PASS.
Audit remains FAIL (12 findings: 1 low/8 moderate/3 high), dependencies unchanged.
Interrupted first full attempt130 and clean rerun are separately retained.
See `docs/takolio-v2/takeover/CLI01_LOCAL_FILE_URL.md` and exact check receipts.
