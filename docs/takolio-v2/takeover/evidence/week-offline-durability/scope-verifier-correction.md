# Scope-verifier correction

The first precommit verifier invocation exited1 before producing a result because it referenced a nonexistent prior scan-manual-history/post-docs-scope.json. The actual retained prior public precommit-scope.json was used on the next invocation. The verifier independently compares every unchanged current path against parent4d330940 and protected main90b94129; prior proof supplies the reviewed allowlist, not an assumed current PASS. Corrected precommit PASS:9023parent paths and5783protected-main paths unchanged;54salvage paths exact;69Argon/12asset/38screen ledger rows exact;115prior file-decision rows preserved;38owner reviews PENDING;1184frozen hashes exact.

GitHub main read-only recheck on2026-10-25 JST remains90b94129113b41e34701d99f51175cfa81cb73de. No fetch/pull, remote mutation or production operation.
