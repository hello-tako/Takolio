# SCAN01 - Retain accepted manual scan lines in review history

Status: DRAFT TASK PACKET; implementation not started; no new ADR accepted.
Date: 2026-10-24 JST. CAT01 / ADR-066 remains the active implementation until its
independent review and final gates finish. This packet queues the next bounded
local task; it does not change ADR-066 or certify the scanner fix.
Worktree: `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`.
The original Argon workspace remains read-only; preserve its recovery evidence.

## Problem and result

An accepted manual photo-review line reaches inventory but disappears from a
fresh `GET /scans/:id` and confirmed review. Existing UI04 evidence records Muoi
at 0.25 pack in authoritative inventory, zero corresponding scan lines, and only
three confirmed rows from four OCR rows. This is a review-history gap; that
observation does not establish inventory loss.

Retain each newly accepted manual line as one confirmed `scan_items` row in the
same transaction as stock, observations, events and the final scan status. Fresh
history must report exactly the reviewed name, quantity, unit, canonical mapping,
category, storage and expiry basis, independently from later inventory edits.
Use the existing table and GET DTO. No migration, dependency or new service.

## Verified source and callers

- `src/worker/routes/scans.ts`: `resolveScanConfirmationItems()` accepts same-scan
  persisted IDs; unknown `draft_` IDs or no ID are manual. Only persisted rows get
  `sourceId`. Confirmation currently filters by `sourceId`, updates those rows,
  and never inserts manual review rows. GET reads `SQL.GET_SCAN_ITEMS` and maps
  through `scanItemDto()`.
- `src/web/stores/useScanStore.ts`: `addItem()` creates `draft_` IDs; server
  membership via `sourceItemId` distinguishes predictions from local additions.
  Removing a manual line deletes the local draft. Existing persisted predictions
  are rejected/restored explicitly. `setScanResults()` hydrates fresh history.
- `src/web/pages/ScanResultPage.tsx` submits accepted draft objects, sends only ID
  and rejection for rejected predictions, then navigates to inventory on success.
  Confirmed review reopens read-only from authoritative GET.
- `src/web/pages/ReceiptReviewPage.tsx` sends reviewed fields for existing receipt
  rows; it currently has no manual-add affordance. The server accepts manual
  additions for either scan type; verify that API compatibility without adding a
  receipt UI feature.
- `src/web/services/scans.ts`: server scans use the same confirmation endpoint;
  response/body transport loss queues that exact request under `scan-confirm:<id>`.
  Local-only `scan_offline_` / `receipt_offline_` drafts use stable inventory POSTs
  and have no server scan row. Neither review caller consumes `confirmedItemIds`.
- Migrations `0032_scan_evidence_retention.sql` and
  `0033_scan_evidence_completeness.sql` already support lifecycle, unknown OCR and
  KNOWN/ESTIMATED/UNKNOWN reviewed expiry. Their bytes and constraints stay intact.

Historical proof: `docs/takolio-v2/takeover/evidence/control-contrast/execution/recertification-report.md`
under "Additional confirmed behavior: manual line omitted from scan history";
paired `recertify-b/photo-server-readback.json` retains the original observation.

## Bounded behavior to implement

1. Materialize only accepted manual rows (`isManual && !rejected`). Use a
   server-generated deterministic history ID, for example `scan_manual_` plus the
   existing SHA-256 helper over JSON `[scanId, clientId-or-null, submissionIndex]`.
   Scope by scan identity, preserve no-ID additions, and retain the original
   submission index. Never reuse a client `draft_` string directly as a global
   primary key or borrow another scan's row. Plain INSERT must fail closed on an
   unexpected collision; no INSERT OR IGNORE/REPLACE.
2. Insert explicit reviewed values, `is_confirmed = 1`,
   `review_state = 'CONFIRMED'`, and reviewed expiry from `lotExpiryFromEvidence()`.
   Explicit date is KNOWN; day-chip date is ESTIMATED; no reviewed date is UNKNOWN
   with SQL NULL date even if new stock receives a shelf-life estimate. Keep all
   `ocr_*` and receipt-price fields NULL. The legacy NOT NULL confidence default
   is schema filler; GET must continue exposing unknown confidence from
   `ocr_confidence`, with no fabricated `rawEvidence` or purchase facts.
3. Add these INSERTs to existing `batchStatements`, guarded by the exact same
   household/READY predicate. Both adopted and legacy confirmation paths already
   consume that array. Stock, history, observations/events and status commit
   together; the confirmed status statement remains last.
4. Keep manual `sourceId` absent when constructing stock command evidence, raw
   extraction, receipt price attribution and observation source refs. A durable
   reviewed row does not create historical OCR. Preserve existing manual
   `scanEvidence.lines[].scanItemId = null` and null raw evidence; GET history IDs
   identify reviewed records, not extracted predictions. Do not rewrite prior
   command receipts/events or synthesize an OCR link after commit.
5. Preserve response compatibility, including existing `confirmedItemIds`
   source-ID semantics and status-based idempotent replay. GET supplies the new
   history rows. Do not add a stronger changed-payload replay contract to scan
   confirmation in this task. Repeat/response-loss requests must not add stock,
   history rows, receipts, observations or events a second time.
6. Existing explicit prediction rejection stays REJECTED; omitted predictions
   stay PENDING. Removed local manual drafts create neither history nor stock.
   No backfill for historical missing manual rows: stock and mutable metadata
   cannot prove their original reviewed values.

## Merge semantics to preserve and verify

Review history reports each line's accepted input, not a promise that every field
replaces an existing lot. Preserve the following current contracts; changes to
identity, merge selection, quantity meaning or metadata authority need a separate
reviewed decision before implementation.

| Lane | Current stock result; SCAN01 must preserve |
| --- | --- |
| Native receipt | One purchase lot per accepted line, including duplicate ingredients. Existing lots remain unchanged. Server scan type, receipt date and retained line prices own purchase facts; manual lines have no OCR price. |
| Native fridge/food, existing match | Current grouping by canonical ID or lowercased name; exact unit preferred, then compatible unit. Add reviewed converted quantities through one CORRECT per target. Preserve existing lot metadata, expiry, storage, category and purchase/provenance. Reviewed per-line storage/expiry remain review evidence. |
| Native fridge/food, new group | Current grouping and quantity conversion. CREATE uses first line identity/storage/category, earliest submitted expiry or shelf-life estimate. Effective category follows CAT01 catalog-first authority. Preserve every line separately in history even when stock is one lot. |
| Legacy household, receipt or photo | Preserve grouped projection writer: quantity addition, compatible units, existing identity COALESCE and current earliest-expiry/freshness calculation. Existing name/category/storage remain; new groups use first line metadata. Native receipt lot rules must not be applied silently to this compatibility lane. |

Incompatible units remain a fail-closed UNIT_MISMATCH; no package-to-mass estimate,
positive quantity floor, automatic adoption, catalog remapping or overwrite of
unrelated inventory metadata. Existing stock races and authority fences remain.

## Execution order

1. After CAT01 gates/review, recheck status/diff/current callers and baseline.
   Record the SCAN01 decision in DECISIONS.md before source edits, retaining
   ADR-066 ownership/history. Do not reserve or edit a new ADR during this draft.
2. Add a baseline-failing SQLite HTTP test for manual 0.25 pack confirmation and
   fresh GET. Extend existing absent-raw tests to expect the additional confirmed
   history row with NULL OCR, retaining their original command/observation proof.
3. Add only guarded manual-history INSERT composition in the existing route.
   Reuse existing expiry, hash and DTO helpers. No frontend rewrite is required.
4. Verify the acceptance matrix below, then local full gates. Capture a real
   local Worker photo review: manual add, explicit confirm, new document, read-only
   reopen. Capture the receipt API lane and authoritative DB/GET readback.
5. Freeze source/evidence, review full diff/protected paths, verify original/private
   recovery, then update CURRENT_STATE.md, TASK_BOARD.md, HANDOFF.md and takeover
   report with exact checks, failed attempts and remaining acceptance limits.

## Acceptance and evidence

- Fresh photo: accepted manual unmapped 0.25 pack row survives confirmation and
  fresh-document reopen once; quantity remains fractional. Reviewed fields match
  SQL and GET, lifecycle agrees, unknown OCR/confidence/prices remain unknown.
- Run manual with `draft_` ID and no ID; multiple manual rows; same client ID in
  different scans; long/punctuation draft IDs; unexpected ID collision. IDs never
  cross scopes; collision/failure rolls back. Duplicate submitted IDs still reject.
- KNOWN, ESTIMATED and UNKNOWN review expiry round-trip. A missing reviewed expiry
  remains UNKNOWN even when stock has an estimated shelf-life date. History does
  not change after subsequent lot edit/MOVE/USE.
- Both authority modes and photo/receipt scan types persist accepted manual
  history. Existing prediction rejection/omission and local draft removal remain
  distinct. Invalid quantity/category/expiry, foreign IDs and cross-household
  access cannot commit a partial row or mutate another household.
- Existing merged-stock metadata remains per the table; history retains every
  accepted line's own values. Native receipt duplicate lines remain separate lots
  with truthful price/provenance; grouped fridge stock adds quantities exactly once.
- Response-loss replay, concurrent twins, stale inventory/adoption races and
  injected failure after the new history INSERT leave either one complete winner
  or no mutation. Compare scans, scan_items, lot/projection/version, receipts,
  observations and events; no orphan review row or duplicate inventory change.
- Focused suite: new manual-history regression plus `tests/unit/scans.test.ts`,
  `tests/integration/scan-response-loss.test.ts`,
  `tests/integration/t13-receipt-vision-truth.test.ts`,
  `tests/integration/t13r-a-evidence-completeness.test.ts`,
  `tests/integration/t13b-review-roundtrip.test.tsx` and writer-fence/cancellation
  regressions. Run Node >=22.13; final commands: `pnpm lint`, `pnpm typecheck`,
  `pnpm test --maxWorkers=1`, `pnpm check:migrations`, `pnpm build`, actual paired
  planner/composition-ON build. No schema edit means no new migration gate claim.
- Preserve before/after SQL/JSON, exact command logs and source hashes, failed
  attempts, screenshots of manual edit/confirmed fresh reopen at 320 and desktop,
  and independent review. Existing earlier evidence remains immutable.

## Limits and risks

Deterministic history IDs must not alter existing stock/command identities or
create fake OCR links. Existing status-based replay ignores changed retry payloads;
that ceiling stays explicit. Historical omitted manual lines remain unknown;
manual rejected drafts have no new history policy here. Local-only offline scans
still have no durable server review. Week offline durability, dependencies, owner
media/device/Safari/assistive-technology/hosted acceptance remain separate.

No PayOS/payments/billing/checkout/webhooks, unrelated auth, production config,
backend redesign, pull/reset/clean/destructive checkout, push, merge, deploy,
remote migration or production operation. Implementation needs local gates and
review; release requires the user's separate approval.

Draft verification: source/caller/schema/evidence inspection only; no source or
test edits, no executable checks or SCAN01 browser test run in this draft task.

## Draft refinement - durable manual provenance and narrow presentation

Fresh history must also distinguish an accepted manual row from an OCR
prediction. NULL raw evidence alone cannot establish manual origin: legacy OCR
rows can legitimately have unknown raw fields. Do not relabel those as manual.

Verified production namespaces are `scan_item_<scanId>_<index>` (photo sync and
queue) and `receipt_item_<scanId>_<index>` (receipt sync), in
`src/worker/routes/scans.ts` and `src/worker/services/scan-queue.ts`.
`scanItemDto()` currently reports unknown OCR confidence from ocr_confidence and
omits rawEvidence when all raw fields are NULL. No durable manual-origin field is
currently returned.

The proposed no-schema contract reserves exact server-generated history IDs
matching `^scan_manual_[a-f0-9]{64}$` for the CONFIRMED manual rows above.
`scanItemDto()` may emit optional isManual:true only for that reserved server
namespace (with NULL raw/price sanity checks if required). Never accept a client
isManual flag or reuse draft IDs as history IDs. Legacy unknown evidence stays
unknown. The ADR must accept the namespace ceiling: a historical import that
intentionally reused this reserved namespace is indistinguishable without a
schema field. No historical backfill or heuristic reclassification.

Execution step3 therefore includes a narrow DTO/presentation addition, not a
frontend rewrite. Preserve useScanStore sourceItemId membership semantics:
persisted manual rows are still persisted server records, including read-only
review/rejection behavior. Add an optional marker to its ScanResultItem type;
spread/hydration must retain the DTO marker. In ScanResultPage, presentation uses
`item.isManual === true || !persisted` for the "Nhập thủ công" label and suppresses
"AI đọc" for marked manual records. Do not change persisted removal/rejection
logic. In ReceiptReviewPage, retain the marker, show a manual reviewed detail
without OCR price/confidence for those records, and use neutral history heading
copy. Do not add a new receipt manual-add affordance.

Extend the real fresh-document photo/receipt roundtrip in
`tests/integration/t13b-review-roundtrip.test.tsx`: manual label survives reload;
reviewed name, fractional quantity, storage and expiry remain exact; marked
manual rows show no AI/OCR claim; unknown legacy OCR rows remain unknown OCR;
confirmed review remains disabled and cannot mutate. These proposed assertions
were not executed in this draft; implementation remains pending the SCAN01 ADR,
source changes, gates and independent review.
