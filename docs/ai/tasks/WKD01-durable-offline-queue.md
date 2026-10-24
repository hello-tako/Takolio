# WKD01 - Durable offline receipts and truthful Week shopping stock

Status: LOCAL_WKD01_VERIFIED, 2026-10-25 JST; ADR-068. Local implementation and bounded acceptance completed; implementation SHA follows checkpoint. The sections below retain the original proposal/regression recipe as historical task scope, not current unexecuted status. Exact results: `../../takolio-v2/takeover/WKD01_DURABLE_OFFLINE_QUEUE.md` and `../../takolio-v2/takeover/evidence/week-offline-durability/checks.json`.

## Problem and bounded result

The outbox reports an operation even when localStorage persistence fails.
`completeWeekShopping()` also deduplicates its queued command while applying its
inventory quantity addition on every offline retry. One durable request can thus
produce two local stock additions, and a failed write can be presented as saved.

Require a successful durable queue write before returning pending success. Keep
Week shopping inventory at its last server-confirmed state while its exact request
is queued. Delete the offline stock projection instead of adding a projection
ledger. Reconcile authoritative inventory after successful replay. This task does
not promise cross-tab localStorage transactions or implement a new storage layer.

## Verified source and callers

- `src/web/lib/sync.ts`: `load()` treats read/parse/sanitization failures as an empty
  list; `save()` catches setItem failures; `pushOp()` returns regardless. The
  in-memory fallback comment has no corresponding in-memory queue. `removeOp()`,
  `rebindPendingOps()` and `flushOnce()` share that persistence path.
- `src/web/services/http.ts`: `queueWrite()` returns void and does not validate a
  durable receipt. `isNonRetryable()` deliberately retains auth failures and409.
- `src/web/services/week.ts`: `completeWeekShopping()` freezes a deterministic
  command and exact body/header, dedupes that command, then unconditionally adds
  selected quantities to cached inventory. Its `shop_import_<plan>_<ingredient>`
  IDs omit the command. Quantity defaults, mapping and expiry are local guesses.
- `src/web/services/api.ts`: `retryPendingWrites()` validates current server owner
  before replay, sends the frozen raw request, removes it after success, then
  refreshes inventory/shopping/current Week and invalidates queries best-effort.
- `src/web/stores/useWeekStore.ts` and
  `tests/unit/week-query-sync.test.ts`: UI10 already carries pendingSync through
  the explicit Week command result. Preserve its session/query generation fences.
- Other enqueue callers: `services/inventory.ts`, `scans.ts`, `recipes.ts`,
  `shopping.ts` and other Week commands. Recipes and shopping already check a
  queued receipt/readback; avoid replacing their stronger contracts. Scan
  confirmation and local-only scans use different replay lanes.
- `services/auth.ts` uses `rebindPendingOps()` during guest conversion. Auth source
  is protected: preserve its contract and verify it through existing regression
  tests. Escalate any necessary auth edit as a separately scoped task.

## Smallest proposed change

1. Make unavailable/corrupt/unreadable outbox state fail closed for mutation.
   Never replace unreadable existing data with a fresh list or claim an empty
   durable queue. Preserve the original bytes for recovery; no automatic wipe or
   broad sanitization of unknown data. Diagnostic reads must not silently destroy
   operations. Choose the smallest existing-API error/receipt contract in the ADR.
2. Propagate setItem failure through enqueue. Return pending success only after
   successful persistence; scoped dedupe may return the existing durable command.
   Keep storage key/format, owner scope, operationId, dedupeKey, raw body and replay
   headers unchanged. Do not add tokens or fabricated server IDs to storage.
3. Delete only the optimistic inventory block in Week shopping completion. Queue
   the exact stable command, return pendingSync, and state that the request awaits
   synchronization. Do not claim imported stock or an authoritative imported count
   before the server accepts it. Preserve the caller's established result shape
   where required; document any pending-only count semantics explicitly.
4. Audit mutation ordering in every existing queueWrite caller. No optimistic cache
   mutation may run after enqueue failure. A later cache failure must not delete an
   already durable request or cause a second distinct command on retry. Preserve
   explicit cancellation, server error and stale-session behavior.
5. Failed removal after a successful replay must retain the original command and
   surface truthful remaining/retry state; server idempotency handles its next
   replay. Failed owner rebinding must not report a successful migration or lose
   either scope. Preserve ordering and existing in-tab flush serialization.
6. Keep generic409/auth retention unchanged. WKD02 separately defines swap replay
   and conflict recovery. No new generalized offline command framework.

## Reproducible baseline regression recipe

These are proposed tests, not executed reproductions in this draft.

Extend the MemoryStorage fixture in `tests/unit/sync.test.ts`. Seed user-a/house-a
and cached CHICKEN_EGG stock quantity2 piece. Make fetch reject with TypeError as
in the existing offline Week shopping test. Call completeWeekShopping twice for
the same plan and selected CHICKEN_EGG quantity6 piece. Current code leaves one
queued command but stock quantity14; desired code retains quantity2 until actual
server readback. Assert exact identical queued body/key and pendingSync on both
calls, including a simulated module/document reload.

Make only `frigo_sync_outbox_v1` setItem throw quota/unavailable. Current enqueue
can resolve pendingSync without a queue. Desired enqueue rejects with a recoverable
error and keeps inventory cache byte-identical. Add read/parse corruption cases
with original bytes retained. Exercise failed remove and rebind, dedupe after
reload, existing unowned/corrupt entries, and a cache write failure after successful
enqueue. Do not relax session isolation to make fixtures pass.

## Execution and acceptance

1. Finish/review CAT01 and the preceding accepted task. Re-read current callers,
   flags and source; record the bounded WKD01 ADR before implementation. UI10
   excludes outbox/service changes, so do not silently reopen its scope.
2. Add baseline-failing focused tests for repeated offline completion and durable
   persistence failure, then the smallest source changes. Maintain at least one
   runnable regression for both non-trivial behaviors.
3. Prove stable request/key through offline, reload, reconnect and repeated replay.
   Actual Worker readback must show one accepted import; pending stock never
   appears early. Exercise existing legacy/dual Week and legacy/native inventory
   combinations in `tests/integration/backend-shopping-cooking.test.ts` where
   applicable. No inventory receipt, version, lot or event duplication.
4. Verify foreign owner, guest conversion, sign-out, household change, in-flight
   session change, permanent HTTP error, auth error and409 handling. Existing
   command/cancel flows and inventory/shopping/recipe queue callers remain valid.
5. Focused suites: `tests/unit/sync.test.ts`,
   `tests/unit/week-query-sync.test.ts`, `tests/unit/client-session.test.ts`,
   `tests/unit/ui-rebuild-cooking.test.ts` and existing shopping/scan service
   persistence regressions. Then Node >=22.13, `pnpm lint`, `pnpm typecheck`,
   `pnpm test --maxWorkers=1`, `pnpm check:migrations`, `pnpm build`, and an actual
   paired planner/composition-ON build. No migration is expected or claimed.
6. Capture actual local Worker screenshots at320 and desktop: queued completion,
   fresh reload, reconnect, final stock. Save SQL/JSON before/after, queue bytes
   without tokens, exact logs, failed attempts and independent review. Update
   CURRENT_STATE.md, TASK_BOARD.md, HANDOFF.md and takeover report after source
   freeze and private-recovery verification.

## Compatibility, upgrade and limits

Existing valid outbox format and commands replay unchanged; no migration/backfill.
Previously inflated cached stock cannot safely be reversed by guessing which
commands ran. A successful authoritative online read replaces it; no heuristic
quantity decrement. Existing local-only scans can enqueue several item commands;
partial enqueue recovery must remain visible and is not a new atomic scan service.

localStorage does not provide a cross-tab compare-and-swap. This bounded fix must
not claim atomic multi-tab queue concurrency. Durable outbox acceptance also does
not certify every queued server endpoint as replay-safe; WKD02 and existing
endpoint-specific receipts own those guarantees. Device/Safari/assistive-technology
and hosted owner acceptance remain separate. No PayOS/payment/billing/checkout/
webhook, unrelated auth/production, pull/reset/clean/destructive checkout, push,
merge, deploy or remote operation. Release requires the user's approval.

Historical draft-only verification is superseded by the verified local result above. No schema/migration/dependency change; audit and external acceptance remain unresolved.
