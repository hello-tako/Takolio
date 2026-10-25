# WKD02 client implementation and focused verification

Date: 2026-10-25 JST. Worktree: `[WORKTREE]`.
Status: client runtime/tests frozen; parent owns canonical full gates, browser evidence, shared docs and commits.

## Change

- Keyed explicit Week swaps retain the frozen original body/key on fetch loss or uncancelled successful-body TypeError/AbortError. Durable enqueue precedes optional cache projection. Return `pendingSync` only after persistence succeeds.
- Fetch-only catch excludes malformed success, JSON/application errors, explicit cancellation, private-session fences and known-success cache failure. Owned-plan validation checks identity, required metadata and render containers before accepting direct/recovery success.
- Exact POST Week swap409 `IDEMPOTENCY_CONFLICT` remains persisted. Existing outbox notification exposes a transient exact owner/session-bound snapshot through the existing banner.
- Existing ConfirmDialog supplies explicit cancel/confirm. Recovery authenticates/replays the exact request inside the existing flush mutex; only the same precise conflict and exact prior approved snapshot permit authoritative GET, cache/query refresh, then removal through the existing classifier. Archived-plan recovery does not replace another current plan.
- Four runtime files; no dependency, new module, queue format, auth/http/store or unrelated endpoint change. Two focused test files. No staging/commit/shared-doc edits by this agent.

## Exact executed checks

All commands run from the worktree. Raw logs and JSON record argv, UTC start, elapsed seconds, exit status and SHA256.

| Artifact | Exact command | Result | Elapsed seconds | Log SHA256 |
| --- | --- | --- | --- | --- |
| baseline | `pnpm exec vitest run tests/unit/week-swap-client.test.ts --maxWorkers=1` | expected RED, 2 transport-body cases | 1.702 | b7c32cb778cf41830d51a0c57adc4f942de44530ba53adff78eb4d1eb77279db |
| source-first | `pnpm exec vitest run tests/unit/week-swap-client.test.ts tests/unit/sync.test.ts tests/unit/client-session.test.ts tests/unit/week-query-sync.test.ts --maxWorkers=1` | 4 files / 173 tests PASS | 4.305 | 42164997822a9353e47b72a24233b46385cd946f4fc929d022ca2da4e3036076 |
| integration-first | `pnpm exec vitest run tests/integration/week-swap-response-loss.test.ts --maxWorkers=1` | 1 file / 6 tests PASS after source edit | 3.112 | 3a52a79f47e19ab103131c91883a71985a7b20a8304e303d2d95f031f1d39edb |
| expanded-first | `pnpm exec vitest run tests/unit/week-swap-client.test.ts --maxWorkers=1` | 59/61 PASS; 2 test expectations corrected for existing auth cleanup | 5.230 | ddac1b1f36c5bd5b5e2856184b6c790445a441b8d76b443f931e795b6b59ec0e |
| banner-first | `pnpm exec vitest run tests/unit/week-swap-client.test.ts tests/unit/offline-banner.test.tsx --maxWorkers=1` | 2 files / 67 tests PASS | 3.023 | 30026632eb7825152d21fb7e9a8e00fcae3af7ccd572686c89609b54334a10c3 |
| client-focused | `pnpm exec vitest run tests/unit/week-swap-client.test.ts tests/unit/offline-banner.test.tsx tests/unit/sync.test.ts tests/unit/client-session.test.ts tests/unit/week-query-sync.test.ts tests/integration/week-swap-response-loss.test.ts --maxWorkers=1` | 6 files / 251 tests PASS | 7.443 | 176cb1417f4ab1cf66884dc45cb38135fad08d84344b97f6e1ec3b3a78991861 |
| client-lint | `pnpm lint` | PASS | 9.069 | 3f2044fca43a5e60905becf2ebfc3a21ddd85976975841aa1e16bc87b0f40a6d |
| client-typecheck | `pnpm typecheck` | FAIL: inferred optional header in test parameter union | 15.545 | c901cbea7f47cd138258a448a766971aa2903e1905030394c41a687516f53bd7 |
| client-typecheck-final | `pnpm typecheck` | PASS after explicit `it.each<Partial<PendingOp>>` annotation | 18.373 | 5f4468d37dab2f6f369b5ca0cbd05aabb894945949268315be5c0aa50fed643e |

Only change after client-focused PASS is the explicit generic test annotation; runtime byte-identical. Final source/test hashes: `frozen-source.json`. Parent canonical suite will cover the exact combined tree.

## Coverage and limits

Client suite68 cases covers durable queue/reload, caller cancellation, private-session fences, malformed/HTTP/application/cache failures, retained conflict notifications and automatic online retry, exact classifier exclusions, authoritative recovery failures/storage faults/stale snapshot/session/owner checks, serial double confirmation, success-on-retry and archive/current query preservation. Banner6 cases cover unknown storage, safe fixed copy, focus/modal cancellation, exact confirmation snapshot, disabled recovery, offline closure and safe retry failure.

Existing `/me` server-owner mismatch deliberately calls `clearPrivateIdentity`, clearing private outbox/caches and identity. WKD02 honors that pre-existing security cleanup; it does not claim queue retention after confirmed identity invalidation. Logout/private-session behavior remains unchanged.

Query/cache validation is bounded to this Week response path, not a new repository-wide schema. Existing single-tab flush mutex remains the concurrency ceiling; no cross-tab atomicity claim. Missing/deleted-plan GET, unreadable storage, or failed removal retains the conflict. Hosted/Safari/device/assistive-technology acceptance remains separate. No push/merge/deploy/remote migration/production action.
