# Independent WKD02 backend/schema review

Reviewer: client agent `/root/domain_next_scope`. Date: 2026-10-25 JST.
Skill: `[PRIVATE_PATH]/.codex/skills/code-review/SKILL.md`.

No concrete findings in the reviewed frozen backend/schema patch.

## Surface inspected

- `src/worker/routes/week.ts`: WeekSwapSchema, resolveWeekCommandKey (including existing create caller), persistPlanRelational/commitPlan transaction composition and complete swap route; adjacent read/cache/inventory behavior.
- `migrations/0045_week_swap_receipts.sql`: additive table, scoped unique tuple, household/actor FKs, immutable INSERT/UPDATE/DELETE triggers and household-lifetime cascade.
- `scripts/migration-smoke.sh`, `tests/helpers/sqlite-d1.ts`, `tests/integration/week-swap-replay.test.ts`, `tests/integration/week-swap-schema.test.ts`.
- Existing `src/worker/services/week-read.ts` and `src/worker/middleware/auth.ts` contracts through route/tests; repository search found no existing user-deletion call site requiring an actor-FK compatibility change.

## Checks against accepted behavior

- Key validation requires all supplied body/header keys to agree. Normalized recipe token supplies immutable fingerprint; receipt lookup precedes recipe re-resolution. No mutable catalog fingerprint.
- Actual auth supplies actor/household. Current owned-plan lookup precedes receipt discovery. Removed membership, foreign household and deleted plan fail without replay mutation.
- Receipt INSERT is first in the existing full relational D1 batch. Duplicate receipt aborts the entire losing batch; catch reads winner and compares fingerprint. No INSERT OR IGNORE receipt or separately committed receipt.
- Matching replay performs a new authoritative D1 read and supplies no cache to readWeekPlan; no plan/receipt/child write and no plan KV publication. Current B is returned after later accepted B. Rate-limiter keys are explicitly outside the plan-cache claim.
- Keyless and alternatives stay supported without receipts. Existing protected auth/payment paths are untouched. Inventory matrix tests compare legacy/native stock tables byte-for-byte.
- Migration does not attach plan/slot foreign keys, preserving acceptance after row replacement/deletion. Triggers prevent replacement/update/direct deletion while household cascade remains allowed. Schema tests cover populated additive upgrade and rollback.
- Tests cover deterministic same-key twins, mismatched requests, batch failures after receipt and child deletion, cache failure, retired recipes, replaced slots, malformed keys and inventory-mode matrix.

## Residual limits

Static independent review; no additional backend test command executed by this reviewer. Backend agent114 focused PASS and parent canonical/migration/browser gates provide execution evidence separately; this report does not relabel their results as an independent run.

Distinct fresh Week commands still rewrite full snapshots; revision/CAS, hosted D1 concurrency semantics and deployment/migration rollout remain separate. Existing keyless commands remain outside receipt deduplication. SQLite tests do not certify hosted/Safari/device behavior. No push/merge/deploy/remote migration/production operation.

Frozen backend file hashes are recorded by the backend owner at `../backend/frozen-source.json`; parent verifies combined final source freeze before checkpoint.
