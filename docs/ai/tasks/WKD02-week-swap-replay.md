# WKD02 verified implementation checkpoint - 2026-10-25 JST

Implementation `89d0ea243d08e98670a512ef797da4f64ac516f4`;implementation scope PASS. Current report:`docs/takolio-v2/takeover/WKD02_WEEK_SWAP_REPLAY.md`. Local acceptance complete;external owner/media/device/hosted and dependency follow-ups remain. Post-docs proof follows the documentation commit in ignored `.artifacts/takeover/wkd02/post-docs-scope.json`. No production operation. Historical packet follows unchanged.

---

# WKD02 accepted local result - 2026-10-25 JST

Status: LOCAL_WKD02_VERIFIED; ADR-069 acceptance executed. Full420files/9430tests PASS; lint/types/migrations/default/paired-ON builds, focused/backend/client, populated local D1 and browser PASS. Audit remains0low/3moderate/2high;26verbatim evidence whitespace warnings retained. Recovery/scope,exact commands,failed attempts and concurrency/hosted ceilings: `docs/takolio-v2/takeover/WKD02_WEEK_SWAP_REPLAY.md`. Local checkpoint/scope binding follows; external owner/device/media/hosted acceptance remains pending. No production operation. Historical activation/draft follows unchanged.

---

# WKD02 activation - 2026-10-25 JST

Status: ACTIVE LOCAL IMPLEMENTATION; ADR-069 supersedes the historical draft below. User authorized sequential local execution. WKD01 implementationcc426b04/documentation2cde9235 and post-docs scope PASS. Choose additive0045;0001-0044 remain immutable. Accepted response is current owned plan; exact409 remains visible until explicit confirmed recovery. Use existing outbox/banner/dialog/flush. No WKD02 executable PASS claimed at activation.

Execute the acceptance sequence below against ADR-069. Preserve raw failed attempts, exact commands, source hashes and local/hosted limits. No push/merge/deploy/remote migration/production. Historical draft follows unchanged as problem/design context; ADR-069 is the accepted decision.

---

# WKD02 - Durable Week swap replay without restoring stale plans

Status: DRAFT TASK PACKET; implementation pending; no new ADR accepted.
Date: 2026-10-24 JST. CAT01 / ADR-066 remains active until final gates; SCAN01
and WKD01 are separate queued packets. Complete WKD01 durability before relying
on pending swap success. This draft creates no runtime, test, schema or migration.
Worktree: `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`.
Original Argon workspace and all recovery/evidence remain preserved.

## Problem and bounded result

The client generates a stable key per swap and retains it during offline replay,
but the server swap route ignores it. Replaying swap A after later swap B writes
A over B again. A successful-response body transport failure can also escape the
client's offline fallback, although the server may already have committed A.

Add one narrowly scoped durable swap receipt, transactionally coupled to the
existing Week write. Replaying an accepted command must cause zero writes and
return the current owned plan, preserving later B in DB, KV and client cache.
This does not serialize distinct fresh concurrent Week commands or certify all
Week mutations as exactly-once.

## Verified source and test anchors

- `src/web/services/week.ts`, `swapMeal()`: creates `week_swap_` commandId once,
  sends body/header, retains both when enqueueing and updates the local plan.
- `src/worker/routes/week.ts`, `WeekSwapSchema`: currently accepts recipeId only;
  commandId is stripped. `resolveWeekCommandKey()` exists for create but swap
  does not call it. The swap POST reads current state and rewrites the full plan.
- Same route, `persistPlanRelational()` / `commitPlan()`: legacy/dual relational
  delete/insert/upsert is committed in one D1 batch; cache publish follows D1.
  `publishPlanCache()` is rebuildable and swallows KV failure. There is no swap
  receipt or plan revision compare-and-swap.
- `packages/domain/src/week/types.ts`, MealPlan: no monotonic revision. Planner
  swap updates updatedAt; a timestamp alone is not a conditional-write fence.
- `src/web/services/http.ts`, `fetchJson()`: fetch failure becomes ApiError offline;
  successful body-read TypeError/AbortError is rethrown. The Week service catches
  only isOffline. Scan confirmation has a narrow response-loss retry pattern in
  `src/web/services/scans.ts` rather than a globally broadened fetch policy.
- `src/web/services/api.ts`: replay discards command response, then refreshes
  current Week. Direct swap caches the returned plan, so returning original A on
  receipt replay could still roll the visible cache backward after B.
- `tests/integration/week-core-flow.test.ts`,
  `tests/integration/backend-week-read-contract.test.ts`: actual Hono + SQLite
  plan/read fixtures. `tests/unit/week-route-serialization.test.ts` covers dual
  batch shape. `tests/integration/scan-response-loss.test.ts` supplies transport
  failure precedent. `tests/unit/week-query-sync.test.ts` covers UI10 explicit
  command handling and private-session/query generation fences.

## Proposed minimal command contract; ADR required

1. Accept an optional bounded commandId and Idempotency-Key, using existing key
   validation (8-200 allowed characters) and requiring equality when both exist.
   Keyless legacy swap remains supported with its current replay ceiling. A
   request for alternatives without recipeId stays read-only and has no receipt.
2. Define one dedicated Week swap receipt table/record. Do not reuse shopping
   import, inventory or auth receipts. Choose the next unused additive migration
   index only on activation, after CAT01; this draft reserves no index. Derive
   receipt identity server-side from household, plan, meal and key. Actor/tenant
   come exclusively from auth. Retain an immutable fingerprint of the normalized
   requested recipe identifier; do not fingerprint mutable catalog data.
3. Lookup a matching receipt before resolving the requested recipe again. An
   accepted historical command must survive a subsequently retired recipe. Same
   key/different request returns permanent409 with a precise machine code and no
   mutation. Another household cannot discover or consume the receipt. Missing
   or deleted current plan may404; never reapply its old action.
4. Insert the receipt in the exact same existing D1 transaction as every legacy/
   dual plan row change. A unique-conflict loser must roll back its whole batch,
   then read the winner and compare the fingerprint. No receipt written after a
   separately committed plan; no INSERT OR IGNORE that lets a losing plan write
   continue; no KV authority, in-memory lock or general command framework.
5. Matching replay returns current owned plan plus idempotentReplay:true, with no
   plan/receipt/child writes and no old A publication. The immutable receipt proves
   acceptance; response is intentionally current state, not a byte-identical old
   snapshot. Verify the direct client and refresh path cannot install original A
   after B. Cache failure after the winning transaction cannot undo the receipt.
6. Handle ambiguous successful-response transport loss only for a keyed explicit
   swap: retain its frozen original body/key, validate current owner, enqueue it
   durably and expose pendingSync. Follow WKD01 persistence rules. HTTP errors,
   auth/session changes, explicit cancellation, JSON SyntaxError and ordinary
   application exceptions must not become fabricated offline success. Do not
   broaden fetchJson behavior for unrelated endpoints.
7. Resolve permanent replay conflict visibly. Generic isNonRetryable retains409;
   do not globally drop409/auth or discard requests silently. The ADR must choose
   either narrowly classify the exact Week swap path + IDEMPOTENCY_CONFLICT for
   explicit failure/recovery, or retain a visible blocked command until user
   recovery. Acceptance cannot claim automatic permanent conflict resolution
   while the generic queue still retries it indefinitely.

## Reproducible baseline regression recipes

These are proposed checks, not executed reproductions in this draft.

Extend the real SQLite HTTP plan fixture in
`tests/integration/week-core-flow.test.ts`. Create an owned plan and choose one
meal plus two valid distinct recipe fixture identifiers (verify both against the
current catalog). POST A with keyA; POST B with keyB; snapshot every legacy/dual
plan row; replay exact A with keyA. Current route swaps back to A. Desired replay
returns current B with idempotentReplay and leaves rows/receipt counts unchanged.
Then retry keyA with B: desired409 and no writes. Preserve the keyless caller.

Connect the actual web service to the same Hono+SQLite boundary. Let the server
commit A, then throw transport TypeError or fail the successful body's read with
TypeError/AbortError. Assert one exact original request queued durably; reload
and replay repeatedly. Distinguish explicit cancellation from transport failure.
Perform B before replay A; final DB, direct response and cached plan must retain B.

Inject a failure inside the combined batch after receipt insertion or child-row
delete. Receipt and all relational rows must roll back, with no KV publish. Race
same-key identical requests and same-key different recipes; one transaction wins,
loser replays or409. Exercise household/membership changes and late responses.

## Execution and acceptance

1. Re-read current source, flags and prior packets after WKD01. Record an explicit
   bounded ADR covering response semantics, permanent409 recovery, schema,
   transaction coupling and concurrency ceiling before source/schema edits.
2. Add baseline-failing actual SQLite/HTTP replay, rollback and response-loss
   regressions. Implement the smallest dedicated receipt path using existing
   scope/key helpers and batch composition; no Week service redesign.
3. Verify legacy/dual Week mode and legacy/native inventory combinations using
   existing fixtures in `tests/integration/backend-shopping-cooking.test.ts`.
   Swap/generation/read must leave inventory lots/projection/versions/commands/
   events byte-identical. Keyless clients, alternatives, private session guards,
   route flags, current plan reads and optimistic direct command flows survive.
4. Verify receipt immutability, foreign tenant/key conflict, concurrent twins,
   batch rollback, KV loss, retired recipe and current-plan replay after B.
   Existing historical plans need no receipt backfill; no new receipt is inferred
   from mutable plans or KV. Migration is additive; existing bytes stay intact.
5. Focused tests above plus `tests/unit/week-query-sync.test.ts`, client-session
   and sync suites, `tests/e2e/t17-ui/takolio-week-commands-real.e2e.ts`. Then Node
   >=22.13, `pnpm lint`, `pnpm typecheck`, `pnpm test --maxWorkers=1`,
   `pnpm check:migrations`, `pnpm build` and actual paired planner/composition-ON
   build. Execute populated local migration/rollback safety checks; no remote D1.
6. Capture local Worker before/after SQL/JSON, receipt/request key proof without
   secrets, exact command logs and failed attempts, offline/reload/reconnect
   screenshots at320 and desktop, and independent review. Freeze source and
   verify original/private recovery; update CURRENT_STATE.md, TASK_BOARD.md,
   HANDOFF.md and takeover report with actual limits and remaining owner checks.

## Compatibility and explicit ceilings

Existing keyless calls remain valid; only newly keyed accepted swaps acquire
receipts. Do not rewrite old plans, command history, existing migrations, shopping
receipts or client outbox format. Current-plan replay is a deliberate response
contract choice; reviewers must approve it before implementation.

A unique command receipt prevents duplicate command writes. It does not prevent
lost updates between different fresh commands that both rewrite a full snapshot.
Stronger latest-state serialization requires a separate CAS/revision design and
an audit of every Week writer. Plan create retains a stable plan ID but no frozen
intent receipt; regenerate, generation, slot PATCH, shopping toggle and preferences
remain outside this packet. Do not claim complete Week exactly-once safety.

Device/Safari/assistive-technology/hosted owner acceptance remains separate. No
PayOS/payment/billing/checkout/webhook, unrelated auth/production, destructive Git,
push, merge, deploy, remote migration or production operation. Release needs the
user's separate approval.

Draft verification: read-only source/caller/test inspection only. No executable
reproduction, test, browser, ADR, runtime or schema change was made in this draft.
