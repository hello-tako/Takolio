# WKD02 read-only baseline and test design

Date: 2026-10-25 JST
Worktree: `[WORKTREE]`
Status: design only; no runtime, schema, migration, ADR, or test source changed.
Prerequisite: root accepts WKD01 final gates, then records WKD02 ADR.

## Bounded result

Add one durable receipt for keyed explicit Week meal swaps. Replay of accepted A
after later B returns current owned plan B with `idempotentReplay: true`, performs
no relational/domain-cache write, and never reinstalls A in client cache. Existing
rate-limit counter writes remain. Distinct fresh full-snapshot commands are not
serialized. Keyless swaps, generation, slot PATCH, preferences, shopping toggles,
and other Week writers retain their current ceiling.

## Minimal receipt contract for ADR

Dedicated table; choose the next unused migration index only at activation:

- `id`: opaque server-generated receipt ID, primary key.
- `household_id`: authenticated household FK, explicit household-lifetime policy.
- `actor_id`: authenticated actor FK, never accepted from body.
- `plan_id`, `meal_id`: normalized target IDs; no FK to replaceable child rows.
- `client_key`: existing 8-200 key grammar.
- `fingerprint`: normalized requested recipe token, excluding mutable catalog fields.
- `created_at`: server timestamp. Do not store an old full plan response.

Chosen identity: `UNIQUE (household_id, plan_id, meal_id, client_key)`. Matching
replay compares fingerprint within that exact tuple. A reused key on a different
plan/meal is independent. Do not accidentally test or implement household-wide
key conflicts. A different fingerprint within one tuple is a permanent conflict.

Use `NOT NULL` and non-empty target/fingerprint checks. Follow existing
`inventory_commands` immutable guards: BEFORE INSERT abort duplicate ID/scoped key
(including replace), BEFORE UPDATE unconditional abort, BEFORE DELETE abort while
household exists. Keep a deleted-plan tombstone for the household lifetime. A
receipt must never reconstruct a deleted plan. No receipt FK to plan children,
`INSERT OR IGNORE`, upsert, in-memory lock, or KV authority.

## Route and transaction

1. Authenticate; distinguish absent key from invalid/mismatched header/body keys.
   Require equality when both exist. Alternatives without `recipeId` stay read-only.
2. Resolve owned target without cache publication. Lookup receipt before resolving
   the requested recipe. Match returns current owned plan plus replay marker;
   fingerprint conflict returns exact HTTP 409 `IDEMPOTENCY_CONFLICT`.
3. No receipt: existing recipe/inventory/swap validation, then one D1 batch with
   plain receipt INSERT and every existing legacy/dual relational statement.
   Preserve owner recheck. Duplicate receipt must abort/roll back the whole batch.
4. Success publishes cache normally. KV failure cannot undo relational receipt.
   Duplicate loser rereads the exact scoped winner, compares fingerprint, then
   returns replay or precise conflict. Never continue losing plan statements
   after an ignored insert. Do not broadly classify unrelated UNIQUE errors.
5. Receipt insert followed by child failure rolls everything back; no domain KV
   publish. Missing/deleted current plan returns owned-plan/404 contract, never
   an old action. Keep recipe authority lazy so a stored replay needs no catalog.

Current `getMealPlan` calls `readWeekPlan(..., c.env.CACHE)`, which writes
`plan_<id>` on stored-snapshot reads. Use the existing reader with no cache
parameter, or add a narrow no-publish option. Assert zero `plan_*` and
`plan_active_*` puts across replay, including ownership/plan reads. Do not assert
zero CACHE writes over the whole HTTP request: existing rate-limit middleware
writes `rl_swap:*` / `rl_week_w:*` counters before the handler. Preserve limiter
behavior and classify its counters separately from plan/domain publication.

## Actual SQLite/HTTP baseline after activation

Extend `tests/integration/week-core-flow.test.ts`; first verify two distinct valid
catalog fixture recipe IDs. Create owned plan, swap A/keyA, swap B/keyB, snapshot
all legacy/dual plan rows ordered by primary key, then replay exact A/keyA.
Current route writes A; expected current B + replay marker + byte-identical SQL
snapshot + unchanged receipt count + zero plan/domain KV puts. Retry keyA with
recipe B at the same target: precise 409, no relational/domain-cache change.
Same key on another plan/meal is independent under the chosen identity. Repeat
A after recipe retirement; stored-snapshot replay must not resolve the retired
recipe. Legacy snapshots that need catalog retain current read compatibility.

Keep keyless swap, alternatives, auth/ownership 404, legacy/dual mode, and private
session behavior. Snapshot row bytes rather than counts to catch reinsertion and
timestamp drift. Assert inventory projections/lots/versions/commands/events stay
byte-identical in existing legacy/native inventory combinations.

## Rollback and deterministic same-key tests

- Fail a staged statement after receipt insertion or child delete within the same
  batch. Receipt, parent/children, inventory, and domain KV remain unchanged.
- Same key/same target/recipe: one commit, one current-plan replay, one receipt.
- Same key/different recipe: one winner, one precise conflict, no losing write.
- Use separate SQLite connections or a deterministic barrier committing winner
  before loser batch. `Promise.all` over one adapter connection can trigger
  nested `BEGIN` artifacts and is not a real D1 concurrency proof.
- Same key in another household is independent. Membership/session changes and
  late responses cannot discover/consume another household's receipt.

## Narrow client response-loss boundary

Explicit keyed swap only; retain exact original body/header/key across enqueue.
Separate fetch/successful-body parsing from post-response cache handling. Ambiguous
transport `TypeError`/`AbortError` may enqueue only after owner/session validation.
A cache/storage `TypeError` after known success must not fabricate offline success.
Explicit cancellation, malformed JSON `SyntaxError`, HTTP errors including 409,
auth/session fences, and application exceptions stay visible and unqueued. Do not
broaden `fetchJson`, generic `isOffline`, or unrelated endpoints.

Use the actual web service connected to Hono+SQLite, following
`scan-response-loss.test.ts`: server commits A, then fetch transport or successful
body read fails. Assert one exact request durably queued; reload; perform B;
replay A repeatedly; DB/direct response/client cache remain B. Negative cases:
explicit cancellation, malformed JSON, HTTP 409/500 failing body, owner change,
post-response cache TypeError, and queue persistence failure.

## Exact 409 recovery decision required

`isNonRetryable` excludes status 409 (`err.status !== 409`), so generic 409 stays
queued and stops the current flush. Do not globally change that or auth retention.
The ADR must choose a narrow visible `IDEMPOTENCY_CONFLICT` recovery for the exact
explicit Week swap path: retained blocked command with user recovery, or an
explicit failed-command state with recovery. Do not silently delete the request
or claim resolution while it retries indefinitely. Capture visible UI evidence.

## Later acceptance evidence

Record focused/full checks, additive migration smoke and rollback, immutable
receipt checks, legacy/dual and inventory matrices, current-plan replay, KV loss,
retired recipe, Worker JSON/SQL/key proof without secrets, and 320px/desktop
offline/reload/reconnect screenshots. Freeze source and verify original recovery.
Root updates CURRENT_STATE, TASK_BOARD, HANDOFF, and takeover report with actual
failures/limits. No push, merge, deploy, remote migration, or production operation.

## Inspection record

Reviewed `src/worker/routes/week.ts`, `src/worker/services/week-read.ts`,
`src/worker/middleware/rate-limit.ts`, `src/web/services/week.ts`,
`src/web/services/http.ts`, `src/web/services/api.ts`, `src/web/lib/sync.ts`,
migration `0025_inventory_lot_commands.sql`, and Week/response-loss fixtures.
This artifact is not an executable reproduction; no project tests/browser/ADR/
runtime/schema/migration changed or executed for WKD02.
