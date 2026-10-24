# CAT01 - Authoritative display category and immutable manual CREATE replay

Status: LOCALLY IMPLEMENTED; FOCUSED VERIFIED; D1/full gates pending. ADR-066.
Baseline: DEP01 documentation checkpoint `e90bcfda`; original Argon workspace
remains read-only. Work only in
`/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`.

## Problem and accepted result

The bounded inventory browser audit creates an unmapped item with category spice,
then authoritative readback reports other. Native lot commands do not retain
category. Separately, POST inventory checks the mutable current projection before
its native receipt; after a category PATCH the original CREATE can falsely return
409, while a changed retry matching the current row can falsely appear replayed.
Both defects need one coherent local acceptance gate. This packet includes the
previously proposed CAT02 receipt-first CREATE repair; no intermediate completion
or release claim separates category persistence from CREATE replay correctness.

Retain canonical ingredient identity, quantity arithmetic, household isolation,
versions, provenance, FEFO, adoption evidence and Week compatibility. No frontend
replacement, new service, metadata bag, dependency or table is needed.

## Decisions

1. Add optional `InventoryLot.displayCategory`, stored as nullable
   `inventory_lots.display_category`. It is a string of at most 30 UTF-16 code units,
   without NUL; empty strings retain current request compatibility. No default,
   trimming, vocabulary coercion or explicit JSON null. Decode SQL NULL by omitting
   the JSON/domain field. Historical 24-field receipts/events remain unchanged and
   decodable. New snapshots contain exactly 24 or 25 fields as appropriate.
2. Effective category is the canonical ingredient category when mapped; otherwise
   `lot.displayCategory ?? 'other'`. Never recover category from mutable
   `inventory_items.category` after authority/adoption. Category-only PATCH preserves
   identity, quantity and provenance; normal optimistic/event/version rules apply.
   Submitted category cannot override a canonical category. Preserve request intent
   separately from the effective category used in the compatibility projection.
3. Migration0044 only adds the nullable column and guards. Do not UPDATE existing
   lots, rewrite receipts/events or infer original intent. Existing NULL lots keep
   catalog/other behavior until an explicit category correction. This ceiling is
   deliberate: truthful unknown category is safer than borrowing mutable state.
4. New adoption may capture the current validated legacy row category into its
   after snapshot as an explicit adoption transition. Preserve the real before
   snapshot, including omission on an old unlinked backfill. Guard category in the
   complete source/revision and poststate fences. Already adopted lots never use
   this path. Historical invalid category fails closed; report it without automatic
   trimming, truncation or replacement. Adoption preserves the historical projection
   category/version without an implicit repair; authoritative reads and the next native
   write use catalog-first category. A pre-existing canonical projection mismatch may
   therefore remain observable by the parity audit until an explicit native write.
5. Manual CREATE uses the existing immutable fingerprint envelope with optional
   `manualCreate: { requestFingerprint, projectionAfter }`, analogous to manualPatch.
   Fingerprint the validated original request before catalog/default derivation,
   including category, expiryEstimated and dataSource. Check the owned native
   receipt before current-row preflight; same request replays the frozen response,
   changed intent conflicts even after later mutations. Old native receipts without
   retained original intent fail closed with 409; never guess from current state.
   Preserve membership/foreign-household checks and the legacy non-native path.
6. Manual PATCH retains its original request fingerprint, while stored category and
   projectionAfter use the effective catalog-first category. Current strict receipt
   decoders must validate these consistently instead of treating a canonical
   override as corrupt evidence. Scan CREATE propagates reviewed category into the
   lot command; scan-history review DTO semantics remain a separate packet.

## File ownership and boundaries

Domain/DB/migration owner: `packages/domain/src/inventory-truth.ts`,
`inventory-lot-commands.ts`, `inventory-adoption.ts`; corresponding existing DB
inventory files, including read-authority, truth and adoption-executor; additive
`migrations/0044_inventory_display_category.sql`.

Root owns `src/worker/routes/inventory.ts`, `src/worker/routes/scans.ts`, test
fixtures/schema ledger and state/report updates. Focused regression agent owns
agreed test files. Coordinate before overlapping writes. Preserve migrations
0024-0043 byte-for-byte and all existing migration fixture hashes. Append0044 to
local schema ledgers; the applied-migration SHA fixture is extended only after
merge and apply, according to its existing policy.

No PayOS/payments/billing/checkout/webhooks, unrelated authentication or production
infrastructure. No pull/reset/clean/destructive checkout, push, merge, deploy,
remote migration or production operation. Preserve original Argon files/assets
and private recovery evidence. No automatic adoption/data repair on reads.

## Ordered implementation and gates

1. Freeze baseline/hash existing migration guards and affected callers/tests.
   Add baseline-failing category/replay/adoption/forgery regressions first. Capture
   current canonical category behavior explicitly; do not merely change assertions.
2. Extend optional domain field, CREATE/CORRECT transition/replay validation and DB
   read/write/fence paths. Preserve category value and presence on other commands.
   Add immutable manualCreate receipt handling and route-first replay together.
3. Add0044 from the active0030 FEFO trigger bodies, not an older0027 copy. Retain
   0028 v1 guards unchanged; add shallow category-specific prestate/transition and
   event-poststate guards. Recreate the two0030 FEFO triggers with only reviewed
   category shape/prestate/preservation/poststate additions. New JSON null, field
   drop/change, extra-key and stale/projection mismatch evidence must reject.
   No-op CORRECT with effects[] remains valid. Reverse only designated additions
   and require byte-identical canonical trigger bodies; retain proof/logs.
4. Run focused domain/DB/route/FEFO/adoption tests and populated upgrade checks.
   Historical FEFO schema tests that intentionally run0027 must use captured old
   24-field SQL/receipts before0044; use current executor only after0044. Do not add
   runtime schema fallbacks just to serve historical test fixtures. Inspect D1
   expression depth using actual local D1, not only node:sqlite.
5. Run lint/typecheck, local migration smoke/apply/schema gates, full serial suite,
   default and actual paired planner/composition-ON builds. Parent owns full gate;
   preserve all failures and attempts. Browser actual local Worker: create/PATCH,
   reload/detail, later USE/MOVE, immutable CREATE retry and conflict; screenshots
   plus authoritative DB/receipt/event readback. No external provider/remote writes.
6. Freeze source/evidence, independently review complete diff/guard proof, verify
   original/private recovery and protected scope. Parent updates CURRENT_STATE,
   TASK_BOARD, HANDOFF and takeover report with actual commands/counts/limits.
   No completion claim until category and CREATE replay gates both pass.
   Current focused category/schema/authority tests pass 45/45; migration0044
   SHA-256 is `d80c7f88b5097c43d20c6da59f853110fbdb06bd215bdbcd2b648ddce985ee59`
   after reducing category validation to two compound SELECT terms for local D1.

## Acceptance matrix

- Unmapped 0.25pack spice: create/list/detail/reload stays spice, quantityMilli250;
  category-only PATCH survives USE/MOVE/reload, delta0, coherent lot/legacy versions,
  same ID, canonical identity and provenance. Fractional contextual stock remains
  exact; no package-mass inference or quantity floor.
- Canonical chicken remains meat; RICE remains grain even if request says vegetable.
  Rename/remap behavior remains explicit. Tampered inventory_items.category cannot
  alter authoritative category. Move existing category-persistence scenarios to
  unmapped fixtures and add explicit catalog-first assertions.
- Same original manual CREATE retries after category/quantity/storage changes replay
  its original immutable response with no extra write/event. Changed category,
  expiryEstimated or dataSource conflicts. Membership/foreign-household checks,
  old-native-receipt fail-closed behavior and legacy idempotency stay covered.
- Old 24-field receipts/events remain byte-identical and decodable. SQL NULL omits
  displayCategory. New explicit null/nontext/over30/NUL fails at trust boundaries;
  raw SQL column and forged receipt/event paths reject invalid values.
- New adoption captures current category with truthful before; old unlinked NULL
  backfill is supported without rewriting its prior snapshot. Category/source race,
  stale revision and failure injection roll back receipt/lot/projection/event/version.
  Already adopted NULL has no projection fallback; malformed historical categories
  fail closed without data repair.
- Forged v1 CREATE/CORRECT category, unrelated-command category mutation, FEFO
  category field drop/change/extra keys and event category/poststate mismatch reject.
  Preserve FEFO kg/l legacy aliases, adopted synthetic mapping, version-offset,
  immutable envelope/receipt, household and duplicate-key guards.
- Existing inventory truth/lot/adoption/FEFO/read-authority/schema/D1/closed-loop,
  canonical identity and metadata E2E regressions remain green. Week/composition and
  scan real-confirmation tests cover unchanged quantity/identity/command behavior.

## Risks and rollout limits

Guard additions affect security-sensitive authority: do not promote unverified SQL
or claim completion from only unit tests. Existing nullable rows deliberately do
not acquire historical category intent. SQLite codepoint length and JavaScript UTF-16 length differ for supplementary
Unicode. Bounded SQL guards count supplementary characters twice at column and
receipt boundaries, matching the domain/request max(30) boundary. Legacy invalid category needs
an authentic operator correction, outside automatic migration.

Apply0044 before the new Worker. Old 24-field writers remain compatible with NULL
lots, but must fail closed on a lot that now retains displayCategory. Mixed-worker
writes to such lots are not certified; any hosted rollout requires a separate
reviewed coexistence/rollback plan. Additive schema remains on application rollback.
No remote apply/deployment is authorized by this packet. Local Chromium/root-font
screenshots do not certify native devices, Safari, assistive technology or owner
acceptance. Scan manual-history and Week offline durability remain separate.
