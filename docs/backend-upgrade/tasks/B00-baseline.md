# B00 - Canonical baseline and execution packets

Status: actual result at `../b00/baseline.json`; source652e0d7632745e9b77cda4b5b3caac83a3ec1015, repository1385308553. Owner coordinator, 2026-10-11 JST.

Goal: đúng checkout/source authority, reconstructable hashes/evidence, complete explicit API/ownership map, local baseline failures/audits recorded, historical PR reconciliation proposal and next task ownership/acceptance. B00 permits docs and local/read-only verification; no runtime deployment, code/schema/provider changes.

Owned: docs/backend-upgrade, checkpoint sections docs/ai/CURRENT_STATE.md/TASK_BOARD.md/HANDOFF.md/DECISIONS.md, root TASK_BOARD/HANDOFF. No runtime source/lockfile/migrations/config/workflow changes. Keep original checkout/user files intact. Canonical branch codex/backend-b00-baseline uses managed worktree.

Sequence: pin repository ID/fullSHA -> read source/rules/callers/tests/ADRs -> capture lock/migrations/catalog/candidate/routes -> hosted metadata/artifact digest + public readiness -> frozen install/local gates/audits -> detailed packets/dependency corrections -> review/docs integrity -> coherent local checkpoint. No push/merge/release in this task.

Acceptance: 79 explicit routes with exact methods/source lines and valid callers/tests; source checksums match39-migration release receipt; hosted/public/direct-runtime unknowns distinguished; local commands/exits/counts/timing/log digests captured; audit findings and expected-red V2 release gate retained; PR63/#20/#29 proposals no mutations; B01a/B03a/B03b/B05a detailed packets and B01-B08 supporting scope/rollback matrix. Baseline test failure can be recorded and investigated rather than hidden; it prevents a claim that full local suite is green, not docs/source baseline completion.

Next: B01b adapter A1 and B01a repository/admission ADR; B03b pure candidate DTOs and B03a offline evaluator; B05a review schema. Full-suite timing gap and audit triage tracked in gap register. New runtime task must read draft policy/ownership and current main before edits.
