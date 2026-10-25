# WKD02 narrow client patch design

Date: 2026-10-25 JST
Worktree: `[WORKTREE]`
Status: inspection/design only. No runtime, tests, migration, ADR or shared docs changed.
Dependency: root checkpoints WKD01, accepts WKD02 ADR and implements the durable
server receipt contract before accepting this client's replay claim.

## Result and boundary

A keyed explicit legacy Week swap whose HTTP 2xx body is lost retains its exact
original request durably and reports `pendingSync`. Receipt replay returns the
current owned plan, so a later B never becomes historical A in client cache.
A precise permanent swap conflict remains queued and visibly blocked until the
user explicitly confirms recovery. Reuse existing `OfflineBanner`, `ConfirmDialog`,
`retryPendingWrites`, outbox subscription, scope/key helpers and flush mutex.

Only four runtime files need change: `week.ts`, `api.ts`, `sync.ts`, and
`OfflineBanner.tsx`. No new dependency, module, error bus, outbox format, persisted
failure record or generic command framework. `http.ts` and `private-session.ts`
remain unchanged. Keyless swap, alternatives, generic 409, auth and unrelated
endpoints retain their existing behavior.

## Exact current contracts

`src/web/services/http.ts:15-40`: `ApiError` carries `kind`, optional `status`,
`retryable`, `requestId`, parsed `payload`, and getter `code`. Payload is parsed
only from message matching `/^HTTP \d{3}: ([\s\S]*)$/`; code must be a top-level
string. Exact expected conflict is `kind === 'http'`, `status === 409`,
`code === 'IDEMPOTENCY_CONFLICT'`. Do not match translated message substrings.

`fetchJson` outcomes (`http.ts:67-140`):

| Boundary | Current thrown value | WKD02 treatment |
| --- | --- | --- |
| fetch rejects, session current, caller signal active/absent | `ApiError('offline', ..., retryable:true)` | Existing durable offline branch |
| HTTP non-2xx; body readable | `ApiError('http', 'HTTP <status>: <text>', status, {requestId})` | Surface; never queue as response loss |
| HTTP non-2xx; text read rejects | Same status ApiError, empty text, code null | Surface; no synthetic offline success |
| HTTP 401 | Clear current private identity, then ApiError auth | Existing behavior, no WKD02 bypass |
| HTTP 403 | ApiError auth; identity retained | Existing behavior, no queued success |
| HTTP 2xx; `res.json()` rejects TypeError/AbortError | Original error rethrown after fence | Narrow keyed explicit-swap ambiguous transport retention |
| HTTP 2xx; JSON SyntaxError | Original SyntaxError | Surface; no queue |
| Caller signal aborted | Original `signal.reason`, else DOMException AbortError | Explicit cancellation; no queue even if reason resembles transport error |
| Scope/generation/logout fence fails | ApiError auth | Surface; no cache or queue write |

`fetchJson` does not validate successful DTOs. Do not treat arbitrary application
exceptions, malformed success or post-response cache errors as transport loss.
Non-2xx body failures cannot arrive as raw TypeError because `res.text()` catches
and substitutes an empty string. A late old 401 is fenced before identity clear.

`week.ts:106-161`: commandId/body/header are created once before await; explicit
requests use `week-swap:<plan>:<meal>:<commandId>` dedupe. Current catch encloses
fetch plus cache work and recognizes only `isOffline`. It reads/parses cache and
may await inventory before queue acceptance. No caller signal exists today.
`useWeekStore.ts:180-211` consumes `{plan}`, closes the sheet on a returned plan,
and invalidates Week queries. Existing global banner exposes pending count.

`api.ts:32-71`: each replay verifies actual `/me` owner, preserves original body
and headers, fences with `capturePrivateSession`, and refreshes authoritative
Week/inventory/shopping after successful writes. It currently discards command
responses. `sync.ts:222-255` retains any non-drop rejection but swallows it and
breaks. Generic `isNonRetryable` excludes every 409 and auth. Retained rejection
currently emits no event. `OfflineBanner.tsx:31-43` consequently cannot distinguish
permanent conflict from pending/offline; its catch only sees thrown persistence
or other escaping errors.

## 1. Isolate explicit swap response loss

In `weekApi.swapMeal`, append optional fourth argument `signal?: AbortSignal`;
existing three-argument callers stay valid. Forward it to `fetchJson`. This small
boundary permits an explicit-cancellation regression without adding an abort
controller, timeout policy or UI cancellation flow.

Keep body/header/key frozen before await. Store fetch result in a local variable;
put only `await fetchJson(...)` inside the response-loss try/catch. Known-success
validation/cache work happens after that catch. This prevents a cache TypeError
from generating an outbox command after already-known success.

Catch order is mandatory:

1. `assertCurrent()` first; owner/session/logout changes win over transport errors.
2. If `signal?.aborted`, throw original cancellation reason/error. Never enqueue.
3. Keep existing `isOffline` behavior. Additionally allow raw TypeError or an Error
   named AbortError only when `recipeId` and its frozen commandId exist. A raw
   body error for alternatives is not a new offline fallback.
4. Explicit writes enqueue exact path/method/body/header before optional cache
   projection. Native outbox persistence failure rejects; never return pending.
5. Optional cached plan parse, inventory read and deterministic projection may
   fail after durable acceptance without losing the accepted request. Assert
   current after every await and before optional cache writes/return.
6. Return `{plan?: updated, pendingSync: true}` for accepted explicit commands.
   Existing plan-bearing path remains compatible; banner supplies pending copy.
   Known-success return passes current replay plan through, including optional
   `idempotentReplay`, and cannot substitute an old queued projection.

No broadening of `fetchJson`, `isOffline` or scan/cooking behavior. SyntaxError,
HTTP errors, explicit cancellation and ordinary application exceptions remain
visible and unqueued. An uncancelled transport AbortError is ambiguous; exact
replay resolves whether the command committed.

## 2. Retained conflict visibility using existing notifications

Keep one transient `blockedWeekSwap` snapshot inside `api.ts`, containing a clone
of the exact PendingOp, not a raw server message. Set it only inside the replay
callback after a precise 409/code match for POST to exact path
`^/week/plans/[^/]+/meals/[^/]+/swap$`, a valid explicit body recipeId/commandId,
and matching Idempotency-Key. Malformed or unrelated requests stay generic.

Expose `api.getBlockedWeekSwap()` for the banner. Return the snapshot only while
current owner, active session and exact persisted op still match. Compare ID,
owner, path, method, serialized body and original headers; never substitute a new
key/body. Clear the transient snapshot on private session reset, absent/changed
op, successful replay or successful explicit recovery. Unreadable outbox is
unknown storage state, not an empty queue or safe discard.

In `flushOnce` retained catch, call existing `emit()` before `break`. This wakes
existing count subscribers without changing Listener or flush result shapes.
The API callback has already stored the precise conflict. OfflineBanner's existing
subscription reads `getBlockedWeekSwap()` as well as count, so load/online automatic
replay also reveals the conflict. No error bus or persisted diagnostic field.
After reload the normal online/load replay rediscovers the permanent conflict;
while offline, show ordinary retained-pending copy and allow no recovery.

Banner conflict copy precedes generic pending copy:
`Yêu cầu đổi món xung đột với dữ liệu đã lưu. Yêu cầu vẫn được giữ trên thiết bị.`
Keep `Đồng bộ ngay`. Add `Tải lại và bỏ yêu cầu đổi món` only for this precise
owned snapshot. Existing ConfirmDialog supplies alertdialog/focus/escape behavior:

- Title: `Bỏ yêu cầu đổi món bị xung đột?`
- Description: `Takolio sẽ tải thực đơn hiện tại và chỉ bỏ yêu cầu đổi món này khỏi hàng chờ. Các thay đổi khác vẫn được giữ. Bạn có thể chọn món lại sau đó.`
- Confirm: `Tải lại và bỏ yêu cầu`; cancel: `Giữ yêu cầu`.

Render fixed local copy only, never server error payload, body, key or private IDs.
Disable repeated recovery while active. Offline/cancel/storage failure retains
snapshot and request; render safe failure copy. Count zero must not clear another
owner's private conflict into the current screen.

## 3. Explicit recovery through the existing retry API

Add optional argument to `retryPendingWrites`:
`{ discardWeekSwapConflict?: PendingOp }`, supplied only by ConfirmDialog after
explicit confirmation. It is the exact approved snapshot, not an arbitrary ID.
An ordinary call preserves its existing signature/result and deletion rules.

Keep recovery inside the existing serialized `flush` operation. In its replay
callback authenticate `/me` and issue the exact original swap request normally.
If it now succeeds, normal replay/removal is safe. If it returns the same precise
409 conflict, discard is eligible only when the approved snapshot still exactly
matches both the pending op and currently scoped blocked snapshot.

Before permitting deletion, fetch `/week/plans/<planId>` directly with fetchJson
(no offline/cache fallback); require an object plan with expected ID and current
household. Assert session, then persist this authoritative current plan under the
existing owned cache key. Failure to load/validate/store current plan retains the
request. Seed/cancel the existing matching Week query keys, preserving the current
plan key only when it already points to this plan; invalidate existing Week keys
using established query helpers. Never make an archived plan current merely
because its blocked request was acknowledged.

After authoritative refresh and a final exact-op/session check, flag this exact
caught error object as explicitly acknowledged. The existing isNonRetryable
callback returns true only for that one acknowledged error; otherwise delegate
to the existing global classifier. `flush` then uses existing `removeOp`, outside
the replay catch, so deletion-persistence failure escapes and retains the op.
Do not return fake network success, rewrite queue entries, globally drop 409/auth,
or clear all pending work. Later queued ops may proceed through normal replay.

Recovery's current-plan GET, cancellation and queue removal cannot be atomic
with arbitrary other tabs. Preserve the existing single-tab mutex ceiling; do
not claim cross-tab transaction isolation. A private-session change at any await
must prevent old data publication and old-request discard under the new session.
A deleted/missing plan 404 leaves recovery blocked; no stale snapshot resurrection
or automatic discard. Owner can keep the request; this bounded packet does not
add deleted-plan queue administration.

## Acceptance and ordered checks

1. After root's WKD01 checkpoint/ADR, add baseline-failing actual service+Hono+
   SQLite tests for committed fetch loss and committed HTTP 2xx body TypeError/
   uncancelled AbortError. Assert exact request body/header/key, one durable op,
   reload, later B, replay A, current B response/cache/SQL and no extra writes.
2. Negatives: caller AbortController aborted before fetch/during fetch/during body
   with custom TypeError reason; SyntaxError; HTTP 409/500 with rejected text read;
   alternatives raw body error; malformed success; known-success cache TypeError;
   session/household/logout changes; outbox setItem failure. Never queued success.
3. Conflict flow through real retry: exact POST/body/header/code only; normal and
   auto retry emit visible retained conflict; generic 409/auth/unrelated paths
   unchanged; no raw error/private body rendered; reload rediscovers conflict.
4. ConfirmDialog cancel leaves exact queue bytes. Confirm refreshes authoritative
   current B, preserves unrelated ops, removes only approved conflict, remains
   retryable on GET/cache/removal storage failure and rejects stale-owner/snapshot
   confirmation. No old A in query cache/Zustand rendered Week after recovery.
5. Existing `sync`, `client-session`, `week-query-sync`, `offline-banner` and
   actual Week browser checks; then root's standard full gates. Capture 320px and
   desktop conflict/offline/reload/recovery evidence, all failed attempts, and
   exact commands. Do not call design inspection a test PASS.

## Acceptance caveats

This file is design, not accepted ADR or implementation. Server durable receipt,
current-state replay, zero SQL/KV writes, immutable receipt, migration safety and
legacy/dual/native inventory matrices remain root's WKD02 dependency. No new
WKD02 executable test/browser ran here. No current-SHA PASS, deployed behavior,
Safari/device/accessibility certification or complete Week exactly-once claim.
A precise conflict can be acknowledged, not repaired automatically. Fresh different
full-snapshot commands retain the documented lost-update ceiling. Original Argon
workspace, protected auth/payment/production paths and all WIP remain untouched.
