# WKD01 Independent Review

Date: 2026-10-25 JST
Worktree: `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`
HEAD under review: `4d330940c328d70ca49384fa54792e95637a3dd5`

## Scope

Reviewed the final WKD01 runtime and caller diff across:

- `src/web/lib/sync.ts`
- `src/web/services/http.ts`
- `src/web/services/api.ts`
- `src/web/services/inventory.ts`
- `src/web/services/recipes.ts`
- `src/web/services/scans.ts`
- `src/web/services/shopping.ts`
- `src/web/services/week.ts`
- `src/web/lib/logout-ux.ts`
- `src/web/components/common/OfflineBanner.tsx`
- `tests/unit/sync.test.ts`
- `tests/unit/client-session.test.ts`
- `tests/unit/logout-dialog.test.tsx`
- `tests/unit/offline-banner.test.tsx`
- relevant cooking, shopping, Week and browser-security tests

The review checked accepted outbox-write semantics, exact request preservation,
cache-failure handling, private-session guards, caller behavior, stock and Week
retry behavior, generated IDs, and banner recovery.

## Finding resolved during review

Shopping callers captured `ownedOps()` before awaiting the network request. Two
concurrent offline additions could both observe an empty queue; the second cache
projection then marked the first row as no longer pending even though both
requests remained in the outbox. A regression was added to
`tests/unit/client-session.test.ts`; it failed before the fix and passed after
`src/web/services/shopping.ts` moved the owned-operation read into the cache
projection.

Evidence:

- RED: `.artifacts/takeover/wkd01/concurrent-shopping-red.log`
- GREEN: `.artifacts/takeover/wkd01/concurrent-shopping-green.log`

The final banner review also covered storage diagnostics returning `null`,
automatic retry recovery, and manual retry no-op recovery. The final implementation
clears stale `syncError` when the subscription reports zero pending operations and
consumes `retryPendingWrites().remaining` after a manual retry.

## Result

No concrete unresolved finding was identified in the reviewed WKD01 scope after
the above fix. The final focused run is recorded in
`.artifacts/takeover/wkd01/focused-final.log`:

- Node 24 via `/opt/homebrew/opt/node@24/bin/node`
- 8 test files
- 280 tests passed
- 13.16s

This review does not claim the parent-owned full lint/typecheck/build/browser/
Worker/recovery gates; those remain represented by their own logs and caveats.
The first full-gate attempt was interrupted after 176.59s and retained for audit;
source freeze gates are parent-owned.

## WKD02 read-only handoff

Read `docs/ai/tasks/WKD02-week-swap-replay.md`. It is a draft packet and explicitly
creates no runtime, test, schema or migration change. Before implementation, the
minimum required ADR must settle:

1. keyed swap receipt identity and immutable normalized recipe fingerprint;
2. optional `commandId`/`Idempotency-Key` equality and legacy keyless behavior;
3. receipt insertion in the same D1 transaction as all plan row changes;
4. matching replay returning the current owned plan with `idempotentReplay:true`,
   never the stale historical plan;
5. same-key/different-request permanent `409` behavior and visible recovery;
6. narrow handling of successful-response transport loss for keyed swaps only;
7. concurrency ceiling: duplicate keyed commands are fenced, but distinct fresh
   full-snapshot swaps are not serialized by this packet.

No WKD02 source, schema, migration, test or ADR change was made in this review.
Existing `src/worker/routes/week.ts` currently strips `commandId` from swap
behavior and has no dedicated Week swap receipt, matching the packet's stated
baseline. Proceed only after WKD01 final gates and ADR acceptance.

## Final tracked/untracked and acceptance pass

A fresh final review read all 23 tracked modified files and the sole non-ignored
untracked file, `tests/unit/offline-banner.test.tsx`. `git diff --check` exited 0.
The parent source-freeze manifest
`.artifacts/takeover/wkd01/gates-reviewed/frozen-source.json` contains 1,184 files;
independent SHA-256 comparison found zero changed or missing entries during this
review. The review itself modified only this ignored report.

Protected-scope result:

- No Worker/backend, DB, migration, catalog, auth implementation, production
  configuration, PayOS/payment/billing/checkout/webhook, asset or icon changes.
- `http.ts` changes only the return type/value of `queueWrite`; request identity,
  cancellation, HTTP classification and transport handling remain unchanged.
- Logout changes only conservative unknown-count copy; protected auth and explicit
  logout behavior remain unchanged.
- ESLint adds `.artifacts/**` to global generated/evidence ignores. No app/test
  assertion or app/test lint rule was weakened. The first artifact-dependency lint
  failure and interrupted full run are retained rather than presented as PASS.
- No deleted file, new dependency, migration or schema change is present.

Acceptance mapping:

| Packet requirement | Reviewed evidence / boundary |
| --- | --- |
| Native outbox acceptance; corrupt/read/write failure | Strict load, pre-write validation, typed persistence errors; original bytes retained; regression RED/GREEN logs |
| No Week pending stock inflation | Optimistic stock block deleted; pending-only message/count semantics documented in ADR-068; repeated/reload tests |
| Exact request/key/owner retained | Existing format and raw request fields preserved; dedupe/session/headers tests |
| Enqueue before cache; receipt survives cache failure | Every queueWrite caller inspected; eight caller fault cases; generated-ID and Week-create checks |
| Successful replay with failed local removal | Removal outside HTTP classifier; finally refresh under current-session fences; regression preserves queue bytes |
| Guest rebind / auth / conflict / cancellation | Existing source contracts retained; strict write failure propagated; private-session/security suites included in parent focused evidence |
| Concurrent shopping pending projection | Review-found defect reproduced RED, parent fix verified GREEN |
| Unknown pending and retry recovery UI | Banner/null logout tests; automatic count-zero and manual no-op recovery included in final focused run |
| Worker/browser, full gates, recovery | Parent-owned evidence; this review confirms reports exist but does not substitute for their exact execution/source bindings |

The current status documents correctly still say active/no WKD01 completion claim.
Parent must replace that provisional header with final exact gate results and
limits before checkpoint/handoff completion. WKD01 is not a certification of
cross-tab atomicity, multi-item local scan atomicity, Safari/device behavior,
hosted acceptance, all endpoint replay safety, or WKD02 swap receipts.

Final finding status: no concrete unresolved implementation defect in reviewed
WKD01 tracked/untracked scope. Completion remains conditional on parent-owned
final gate, browser/Worker/recovery and final documentation acceptance.
