# WKD02 backend patch design (read-only)

Date: 2026-10-25 JST
Worktree: `[WORKTREE]`
Status: design only. No source, test, ADR, schema, or migration changed.

## Chosen receipt identity

Use one additive table named `week_swap_receipts`. The command identity is the
four-tuple `(household_id, plan_id, meal_id, client_key)`. A key reused on another
plan/meal is a separate command. Within one tuple, a different requested recipe
is a permanent conflict. Household-wide keys require a separate ADR/schema
change; do not silently add another uniqueness rule.

`client_key` is the validated existing command key from `resolveWeekCommandKey`
(`src/worker/routes/week.ts:198`). `fingerprint` is the trimmed `recipeId`
request token after Zod normalization. It contains no mutable catalog data and is
available before recipe authority resolution. The receipt stores no old plan
snapshot and has no foreign key to replaceable meal child rows.

## Exact additive SQL contract (migration index chosen only on activation)

```sql
CREATE TABLE week_swap_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  plan_id TEXT NOT NULL CHECK (length(trim(plan_id)) > 0),
  meal_id TEXT NOT NULL CHECK (length(trim(meal_id)) > 0),
  client_key TEXT NOT NULL CHECK (length(client_key) BETWEEN 8 AND 200),
  fingerprint TEXT NOT NULL CHECK (length(trim(fingerprint)) > 0),
  created_at TEXT NOT NULL,
  UNIQUE (household_id, plan_id, meal_id, client_key)
);

CREATE TRIGGER trg_week_swap_receipts_immutable_insert
BEFORE INSERT ON week_swap_receipts
WHEN EXISTS (SELECT 1 FROM week_swap_receipts
  WHERE id = NEW.id OR (household_id = NEW.household_id
    AND plan_id = NEW.plan_id AND meal_id = NEW.meal_id
    AND client_key = NEW.client_key)) BEGIN
  SELECT RAISE(ABORT, 'Week swap receipt already exists');
END;

CREATE TRIGGER trg_week_swap_receipts_immutable_update
BEFORE UPDATE ON week_swap_receipts BEGIN
  SELECT RAISE(ABORT, 'Week swap receipts are immutable');
END;

CREATE TRIGGER trg_week_swap_receipts_immutable_delete
BEFORE DELETE ON week_swap_receipts
WHEN EXISTS (SELECT 1 FROM households WHERE id = OLD.household_id) BEGIN
  SELECT RAISE(ABORT, 'Week swap receipts are retained for household lifetime');
END;
```

The household FK is the only lifecycle FK. Plan deletion must not erase the
receipt: the acceptance tombstone must never recreate an old plan. Household
deletion follows the existing lifetime cleanup pattern. In a standalone SQLite
probe, the cascade child-delete trigger observed the parent already gone and
allowed household deletion (exit 0; zero remaining child rows). Project migration
safety tests must still prove this with the complete real schema. Do not add a
plan/meal FK.

## Minimal route/persistence edits after ADR approval

Anchors are current source lines; line numbers may move after edits.

1. `WeekSwapSchema` at `src/worker/routes/week.ts:99-101`: accept optional
   `commandId` and `idempotencyKey` with the existing key grammar
   (`^[A-Za-z0-9._:-]{8,200}$`). Unknown keys currently strip, so the client
   command is not reaching the route. Reject invalid or mismatched supplied keys
   using the packet's existing validation/conflict contract.
2. Swap handler at `src/worker/routes/week.ts:846-917`: parse body and resolve
   key before starting recipe authority. Alternatives with no `recipeId` retain
   their read-only behavior and skip receipt lookup/insert. For keyed explicit
   swaps, use the no-cache owned-plan read. Missing/foreign plan remains 404.
3. Query an existing receipt by the exact household/plan/meal/key tuple before
   recipe resolution and before requiring the original target slot still exist:

   ```sql
   SELECT fingerprint, plan_id, meal_id
   FROM week_swap_receipts
   WHERE household_id = ? AND plan_id = ? AND meal_id = ? AND client_key = ?
   LIMIT 1
   ```

   Mismatch returns 409 `{ code: 'IDEMPOTENCY_CONFLICT' }` with no domain write.
   Match returns the current owned plan with `{ plan, idempotentReplay: true }`.
   Do not resolve the requested catalog recipe or reapply the old target action.
   For a no-receipt fresh request, retain target-slot and recipe validation.
4. `getMealPlan` at `src/worker/routes/week.ts:680-684` always passes
   `c.env.CACHE`; `readWeekPlan` at `src/worker/services/week-read.ts:114-135`
   and `:268-271` then performs plan KV `put`. Add one optional cache argument
   with the current default, or directly call the existing reader without cache
   for this route. Replay and pre-receipt ownership reads use the no-cache path.
   Keep authority lazy: `weekRecipeAuthority` at `:674-678` eagerly starts work
   when called. Stored snapshots must not start catalog/shadow work; legacy
   rows retain their existing lazy catalog compatibility.
5. After a no-receipt plan read and recipe/inventory validation, prepare one
   plain receipt INSERT in the swap handler with an opaque server-generated ID.
   Pass that prepared statement through the existing call chain:

   - `commitPlan` at `src/worker/routes/week.ts:478-482`: add optional
     `firstStatement?: any` and forward it.
   - `persistPlanRelational` at `src/worker/routes/week.ts:208-214`: add the
     same argument; initialize `statements` at `:232` as
     `firstStatement ? [firstStatement] : []` before all cleanup.
   - Keep receipt INSERT and every legacy/dual cleanup/upsert/child INSERT in
     the existing `db.batch(statements)` at `:464`. Receipt first lets a unique
     failure abort the loser batch before its plan changes.
   - Non-swap callers pass no statement. Publish KV only after batch success
     through the existing `publishPlanCache` at `:468-476`.

   Receipt actor/household come from auth, never request fields:

   ```sql
   INSERT INTO week_swap_receipts
     (id, household_id, actor_id, plan_id, meal_id, client_key, fingerprint, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
   ```

6. Catch around `commitPlan` (`:909-914`). On batch error, reread the exact
   receipt tuple. A matching winner returns the current no-cache plan replay;
   a differing winner returns exact 409 conflict. If no receipt exists, preserve
   the existing 503 database error. Do not regex every SQLite `UNIQUE` error:
   unrelated child constraints can fail in the same batch. No loser KV publish.
7. Preserve owner checks. `WeekReadRepository.findPlan` at
   `packages/db/src/week-read-repository.ts:29-34` scopes by `(plan_id,
   household_id)`. Receipt lookup also scopes household; another tenant cannot
   observe or consume a receipt.

No transaction callback or general command framework is needed. Only one
optional prepared statement crosses existing helpers. Do not change inventory
commands, auth, payments, production paths, or rate-limit behavior.

## Rate-limit KV caveat and precise write assertion

`src/worker/routes/week.ts:171-184` installs `rl_swap` and `rl_week_w`
rate-limit middleware before this handler. `src/worker/middleware/rate-limit.ts:143`
and `:149` write counters into the same CACHE binding. Blanket zero-CACHE-write
acceptance across an HTTP request would require weakening the existing limiter.

Assert zero plan/domain publication on replay or conflict: no `plan_<id>` or
`plan_active_<household>` put, no receipt/plan/child relational write, and unchanged
inventory bytes. Allow inherited `rl_swap:*` / `rl_week_w:*` counter writes.
Record counters separately in HTTP integration tests; do not remove the limiter.

## Required migration safety tests after activation

Use the existing Node SQLite helper and all sorted migrations. Seed two users/
households plus plan/meal identities, then assert:

1. Table, scoped unique index, three immutable triggers, checks, actor/household
   FKs, and absence of plan/meal FKs. `PRAGMA foreign_key_check` and
   `PRAGMA integrity_check` pass.
2. Exact duplicate INSERT, `INSERT OR REPLACE`, same tuple/different fingerprint,
   and same ID/different tuple throw with original row bytes unchanged.
3. UPDATE throws `Week swap receipts are immutable`; row bytes stay unchanged.
4. Direct DELETE while household exists throws. Household deletion cascades its
   receipts. Replacing/deleting plan children leaves the receipt tombstone.
5. Same key in another household or another plan/meal succeeds. Same tuple with
   different fingerprint is blocked; route winner reread maps it to 409.
6. Additive migration over populated prior rows preserves serialized bytes for
   households, plans/children, inventory tables, commands, and events. Do not
   rewrite or backfill receipts from mutable plans/KV.

After activation, append the new `.read` and receipt assertions to
`scripts/migration-smoke.sh` after its current `0044` section. Retain the populated
pre-WKD02 fixture and check foreign-key/integrity before and after receipt cases.
No migration index or smoke-script edit occurs in this design-only phase.

## Required route/integration evidence after activation

Use separate SQLite connections or a deterministic commit barrier for same-key
races. The existing `tests/integration/week-core-flow.test.ts` adapter wraps one
connection in `BEGIN`/`COMMIT`; concurrent `Promise.all` on that connection is not
a valid race proof. Assert one receipt, one replay/conflict, no losing plan rows,
no plan/domain KV publication, and unchanged inventory bytes. Inject failure
after staged receipt insert or child deletion; the whole batch rolls back. Retired
recipe replay with stored snapshots must not require catalog authority. Replay
against a current plan whose original slot was replaced must not apply the old
command or fail target-slot validation before the receipt branch.

## Read-only record

Reviewed `src/worker/routes/week.ts`, `src/worker/services/week-read.ts`,
`src/worker/middleware/rate-limit.ts`, `packages/db/src/week-read-repository.ts`,
`migrations/0011_meal_plan_tenant_ownership.sql`,
`migrations/0025_inventory_lot_commands.sql`, `tests/integration/week-core-flow.test.ts`,
`tests/unit/week-route-serialization.test.ts`, `tests/integration/inventory-lot-schema.test.ts`,
and `scripts/migration-smoke.sh`. Only ignored design artifacts changed. No source,
project tests, ADR, migration, or project runtime changed/executed for WKD02.
The isolated in-memory SQL cascade semantics probe is disclosed above.
