# WKD02 backend implementation evidence

Date: 2026-10-25 JST. Worktree: Takolio-v2-codex-integration. Scope: ADR-069 Week keyed swap acceptance. Backend source frozen in `frozen-source.json` (6 SHA256 entries). No stage, commit, push, remote migration, merge, deploy, production operation or original Argon workspace write performed by this subtask.

## Implemented

- Additive0045 immutable household-lifetime receipt, unique household/plan/meal/client key. Actor and household FKs only; household cascade allowed; plan/slot deletion retains acceptance.
- Every supplied commandId/idempotencyKey/header key validated/equal. Trimmed recipe request token fingerprint. Keyless swaps/alternatives retained.
- Scoped ownership query and receipt lookup precede recipe/slot validation and legacy plan hydration. Exact conflict409 does not consult catalog. Matching replay rereads owned current D1 state without publishing cache, preserving later swap B.
- Plain receipt INSERT is first statement in existing atomic plan batch, legacy/dual. Batch failure rereads exact scoped receipt; matching winner returns current plan, changed fingerprint409, missing receipt503. No UNIQUE message regex.
- Keyed precommit inventory read bypasses optional cache to prevent `inv_*` publication when a later plan batch rolls back. Replay/conflict produce no plan/receipt/child/domain KV writes; existing rate-limit KV writes remain allowed.
- Distinct fresh commands still rewrite full snapshots without revision/CAS. A `ponytail:` comment records that separate-packet ceiling.

## Executed checks

Every command ran through `run-check.py`, Node24.16 path `/opt/homebrew/opt/node@24/bin/node`, preserving raw `.log` and exact argv/date/exit `.json` records.

- `baseline-red`: actual Hono+SQLite replay A after B FAILED (expected oyakodon, received tomato-egg-stir-fry), proving pre-fix stale replay. `baseline-green`: same1 test PASS.
- `focused-attempt1`: 21/25 PASS. Historical4failures retained: membership403 expectation correction; actual precommit inventory-cache writes on rollback fixed; populated native-inventory fixture now executes actual adoption after backfill.
- `focused-attempt2`: 25/25 PASS.
- `focused-final`: 6 files/111 tests PASS.
- `refined-focused`: 6 files/114 tests PASS, including deterministic B commit between ownership and receipt reads, legacy conflict before hydration/catalog, and successful D1 acceptance despite failed postcommit plan cache publication.
- Exact refined argv: `pnpm test tests/integration/week-swap-replay.test.ts tests/integration/week-swap-schema.test.ts tests/unit/week-route-serialization.test.ts tests/integration/week-core-flow.test.ts tests/integration/backend-week-read-contract.test.ts tests/integration/backend-shopping-cooking.test.ts --maxWorkers=1`.
- `migrations-initial`: `pnpm check:migrations` PASS (`migration-smoke=ok`, admin migration smoke PASS). Populated migration tests compare every existing table before/after0045; no backfill. Migration source unchanged after this PASS.
- `lint-initial`, `lint-final`, `refined-lint`: `pnpm lint` PASS.
- `typecheck-initial`: FAIL parent-owned response-loss test mode typing (since corrected). `typecheck-final`/`refined-typecheck`: FAIL client-owned `tests/unit/week-swap-client.test.ts:252`, inferred optional undefined header value. These do not constitute a global typecheck PASS. Parent/client notified; canonical full gates pending.

## Coverage and limits

32 new backend tests across receipt replay/schema files. Actual authenticated Hono+SQLite; deterministic batch twins and rollback failures, all four Week legacy/dual × inventory legacy/native combinations. Inventory items/lots/versions/commands/events/adoption/location/household bytes preserved. Receipt immutability, FK/integrity, malformed constraints, plan tombstones, response loss after committed batch, separate postcommit KV publication failure, retired recipe/changed slot, scope/membership/deleted plan, all key variants and zero writes are exercised.

This subtask does not certify actual local Cloudflare D1, browser, hosted deployment, devices or all fresh concurrent Week writers. Root owns actual local D1/browser, full canonical gates, shared docs and independent runtime review. No remote operations authorized.

## Later client freeze verification

Independent cross-review verified implementing-agent `client/client-typecheck-final.json` and corresponding SHA256 raw log: `pnpm typecheck` PASS after explicit Partial<PendingOp> parameter typing. Implementing-agent client-focused6files/251tests and lint also PASS; referenced only after raw-log SHA verification. Earlier FAIL logs remain preserved. Independent client review: no concrete findings; exact13-file scope in `independent-client-review.json`/`.md`. Root canonical full gates still separate.
