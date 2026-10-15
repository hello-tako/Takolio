# Admin migration matrix: WP0 and R2

This document describes the local-only matrix implemented by
scripts/admin-migration-matrix.mjs. It is not release certification, independent
review, or proof of remote database state.

## Immutable source pins

| Purpose | Exact SHA | Expected customer migrations |
|---|---|---:|
| R1 regression source | 25140baa99ef0aecc5e8d0e53206132e01e0f765 | 41 |
| Pre-admin customer release | 186a9cf05de7c91ed3289e13130feb3b38a264ac | 41 |
| Original Admin implementation for historical 0042 finding | 3e865d009ee62a92ed1d9c8d225a36893035670b | 42 |
| Current-main baseline | 0ff82edb7c251be340b5e00fbcf0ae8703b22a55 | 43 |

The current-main pin is the verified merge-base of implementation HEAD and
origin/main at WP0. The script reads migrations and the schema-gate template
from this exact SHA; it does not resolve a movable main ref for migration
inputs. It checks that the live merge-base still matches the recorded pin.
Migration manifests are reported as SHA-256 over sorted names and file hashes.
Each run also records its exact HEAD/tree, script-content hash, current Admin
migration-manifest hash, and Worker schema version read from source.

## Preserved R1 regression matrix

The original eleven R1 scenarios remain backed by R1 SHA
25140baa99ef0aecc5e8d0e53206132e01e0f765, not current main:

1. R1 customer migration identity against the 41-file pre-admin release.
2. Pre-admin release ledger gate on a fresh 0041 database.
3. R1 ledger and read-only schema gates on that database.
4. Original Admin commit rejected before its customer 0042 is applied.
5. Pre-admin release gate rejects the original 0042 ledger.
6. R1 rejects that unexpected forward ledger.
7. Both R1 gates reject unexpected migration drift.
8. Fresh R1 Admin D1 apply and idempotent re-apply, including schema version 1
   and nine expected triggers.
9. Failed R1 Admin migration leaves no record or partial Admin schema beyond
   the deliberately injected conflicting table. This SQL test does not assert
   an Admin Worker response.
10. Customer-release compatibility with the separate Admin database present.
11. The corresponding R1-only customer application rollback ledger check.

The historical evidence at
docs/admin/remediation-r1/evidence/migration-matrix.json records 11/11 for the
original R1 run. That artifact remains historical; it is not a substitute for
a new run of this expanded matrix.

## Current-main and R2 scenarios

Current-main customer checks use the pinned 43-file 0041..0043 ledger:

- compare HEAD, working-tree migration bytes, and pinned-main manifest hashes;
- freshly apply 43 migrations and pass exact customer release-ledger and
  read-only schema gates;
- incrementally upgrade the R1 41-file database through 0042 and 0043;
- delete 0043 from a local ledger and require both gates to report missing
  migration drift;
- apply an unknown local 0044 and require both gates to reject it;
- prove strict 41-file release and schema gates reject a 43-entry ledger;
- compare every pre-existing R1 SQLite table, index, trigger, and view
  definition with current main to verify additive schema objects.

The Admin checks derive migration counts, versions, names, and hashes from the
actual migrations-admin manifest rather than assuming a fixed migration
count. They verify the R1 schema-version mismatch against the current Worker
contract, apply current Admin migrations locally from the R1 Admin schema,
verify exact ledger/version and idempotent re-apply, and exercise an injected
mid-migration failure to check that prior DDL and schema_version roll back.
Mismatch and failure rows are D1 evidence only: this matrix does not launch the
Worker and does not claim a 503 response.

A strict 41-file gate refusing the 43-file ledger is not evidence of an
application rollback failure. Survival of all legacy SQLite objects is not
evidence that an older Worker can safely run over the newer database. Neither
test proves current-main flags-OFF application recovery. That behavior must
be checked separately by local Worker/runtime tests against current main and
the flags-OFF configuration before anyone claims application rollback
recovery.

## Execution record

Run the full local matrix after the uncommitted R2 governance migration is
stable:

    pnpm admin:migration:matrix -- --out /tmp/admin-migration-matrix.json

The script uses Wrangler with --local only and refuses --remote. It records its
source SHA and migration hashes in the output file. No new matrix run is
claimed here; the historical R1 11/11 artifact predates WP0 and R2 and is not
evidence for this expanded matrix. Do not claim independent review PASS from a
local matrix result.
