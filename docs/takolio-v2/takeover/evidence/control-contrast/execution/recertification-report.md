# UI09 / UI04 recertification evidence

Workspace: `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`.
Runtime HEAD recorded by both final receipts: `c50c737d97e4385db90fa9e8a05fb8fbc832edb4`.
Node: `v24.16.0`. Chromium, local deterministic Worker/SQLite fixtures only.

## Result

- Group A / UI09: PARTIAL, process exit 1. 51 axe/layout snapshots, 10 journey entries, 52 PNG including final assertion-failure screenshot. Zero axe violations, horizontal overflow, broken images, unexpected page errors. Two deliberate lazy-import failures recorded separately; real AppErrorBoundary and reload recovery passed. One retained category readback failure, detailed below.
- Group B / UI04: PASS within harness assertions, process exit 0. 29 axe/layout snapshots, 8 journey groups, 51 PNG. Zero axe violations, horizontal overflow, broken images or page errors. Additional manual-line history gap documented below; not silently included in the successful assertion scope.
- Both final runs hash 1,104 tracked runtime/assets/scripts/package files before and after: drift 0. This is run-local evidence, not a claim that the concurrently edited worktree remains identical afterward.
- All six receipts independently verified: every manifested payload has matching bytes and SHA256; archived harness SHA matches receipt; before/after source manifests equal; runner SHA matches every receipt. See `verification.json` and rerunnable `verify-receipts.py`.
- Owned preview listeners 3305 / 8925 absent after runner shutdown (`lsof -nP -iTCP:3305 -iTCP:8925 -sTCP:LISTEN`, exit 1, empty output). Other parent-owned processes were not stopped.

## Exact executed commands

```sh
/opt/homebrew/opt/node@24/bin/node .artifacts/takeover/recertify/run.mjs ui09 group-a-attempt5
/opt/homebrew/opt/node@24/bin/node .artifacts/takeover/recertify/run.mjs ui04 group-b-attempt1
python3 .artifacts/takeover/recertify/verify-receipts.py > .artifacts/takeover/recertify/verification.json
lsof -nP -iTCP:3305 -iTCP:8925 -sTCP:LISTEN
```

Runner starts/stops only its own preview:

```sh
PORT=3305 PREVIEW_API_PORT=8925 PREVIEW_MEAL_PLANNER_ENABLED=true PREVIEW_MEAL_COMPOSITION_V2=true PREVIEW_MEAL_COMPOSITION_V2_SERVER=true PREVIEW_T20_D1=true node scripts/security-preview.mjs
```

## Group A: actual coverage and retained failure

Canonical evidence: `group-a-attempt5/`.

1. Real canonical adoption succeeded.
2. Manual inventory creation/readback preserved name, quantity 0.25, unit pack, pantry storage and null expiry. Category returned `other` after UI selected `spice`; exact deepEqual failure is retained in `checks.json`, raw DTO in `manual-add-readback.json`. Final assertion requires zero findings and exits 1. No assertion weakened.
3. Read-only viewport/state matrix preserved authoritative inventory with zero mutation requests within that matrix.
4. Metadata keyboard/edit/cancel/beforeunload/save-lock/retry/reload passed. Successful PATCH submits only name/version; other item facts unchanged; household revision 25 to 27.
5. Synthetic transport failure retains draft; real retry and reload passed.
6. Synthetic inventory read error and real recovery passed.
7. Real reconciliation apply makes egg quantity 5; dismiss preserves tofu.
8. Reconciliation loading/error/retry passed.
9. Session verifying/error states hide private data; real recovery passed.
10. Deliberate lazy-module crash exercised the actual AppErrorBoundary and `Tải lại` recovery.

Mutation ledger resets after manual add: six subsequent mutation requests (three metadata PATCH, three reconciliation decision POST, each set includes injected failure). Do not describe the whole run as zero writes.

Category source trace: `src/web/pages/InventoryPage.tsx:125` submits chosen category; `src/worker/routes/inventory.ts:582` accepts category; `packages/db/src/inventory-read-authority.ts:57` derives category from canonical ingredient with fallback `other`; `src/web/pages/InventoryPage.tsx:143` filters by returned category. Separate inventory authority/domain packet required before changing category persistence semantics. No backend changed.

## Group B: bounded assertions

Canonical evidence: `group-b-attempt1/`.

- Camera-denied gallery path; mode instructions/quota mobile/desktop. Physical camera not exercised.
- Synthetic three-second upload remains in sending state until actual response; no fabricated stage progress.
- Same synthetic file can be selected after mode switch; source preview is bound to each photo/receipt route.
- Real local photo: quantity 1.5 and expiry 2030-12-31 persist in scan readback; rejected OCR row remains REJECTED. Manual add sheet, Escape/focus return, confirm response 200, read-only reopening exercised.
- Real local receipt: quantity 0.25 and storage freezer persist in scan readback; rejected OCR row remains REJECTED. Editable expiry, reject/restore and immutable OCR prices exercised; confirm response 200 and read-only reopening.
- Synthetic pending to failed, empty review, identity mismatch hiding wrong rows, lost-confirm-response pendingSync disabling edits, SPA return loading authoritative confirmed state.
- Short 390x420 viewport actions in normal flow; 320px width plus synthetic enlarged text. Not actual OS keyboard, native zoom or physical device.

`photo-server-readback.json` and `receipt-server-readback.json` contain both scan and inventory. Harness asserts scan fields/status and HTTP confirm status; it does not assert every inventory field. Independent stored-evidence assertions additionally prove photo manual Muoi inventory quantity 0.25 pack. Other inventory quantities are recorded raw, not exhaustively certified.

Existing merge behavior illustrates this boundary: receipt scan reports milk storage freezer and explicit expiry, while merged inventory row retains fridge and its existing expiry. Do not equate scan reviewed values with certification of every merged inventory property.

### Additional confirmed behavior: manual line omitted from scan history

Photo manual `Muối` quantity 0.25 pack exists in authoritative inventory after confirmation, but is absent from returned `scan.items`. Reopened review therefore displays three accepted lines out of four OCR lines, omitting the fourth accepted manual line.

Raw proof: `group-b-attempt1/photo-server-readback.json`; screenshot `photo-confirmed-390-viewport.png`. `verify-receipts.py` independently asserts one imported manual inventory row, zero Muoi scan rows, four total scan rows, three CONFIRMED rows.

Source trace: `src/worker/routes/scans.ts:498` assigns sourceId only to existing persisted OCR rows; `src/worker/routes/scans.ts:1670` filters reviewed rows by sourceId; `src/worker/routes/scans.ts:1690` updates those existing scan_items; `src/worker/routes/scans.ts:1347` GET reads only scan_items. Manual addition can enter inventory through the confirmation command without a persisted scan_items row. This is a verified history/readback gap, not data-loss evidence for inventory. A separate scan manual-review persistence/domain packet should establish desired history semantics and atomic evidence behavior. No backend fix attempted. Group B process exit 0 remains accurately reported as bounded harness PASS.

## Failed attempts preserved

- `group-a-attempt1`: stale `Be Vietnam Pro` font assertion; one snapshot. Current brand body is `Plus Jakarta Sans`; harness corrected.
- `group-a-attempt2`: category mismatch stopped early; two snapshots.
- `group-a-attempt3`: planner destination bootstrap timeout; no snapshots.
- `group-a-attempt4`: onboarding bootstrap timeout; no snapshots.
- `group-a-attempt5`: full coverage; category failure retained until final assertion.

All attempt logs, manifests, harness copies and receipts remain unchanged. Attempts 3/4 preceded failure-screenshot instrumentation. Revision drafts remain under `revisions/`; canonical executable evidence is the per-run harness copy. No successful suite rerun without a new reason.

## Selected screenshots

- `group-a-attempt5/manual-add-390.png`
- `group-a-attempt5/application-render-error.png`
- `group-a-attempt5/metadata-save-error.png`
- `group-a-attempt5/edit-enlarged-320.png`
- `group-b-attempt1/photo-confirmed-390-viewport.png`
- `group-b-attempt1/receipt-confirmed-390-viewport.png`

These were visually inspected. Full-page captures can show fixed-navigation placement artifacts; viewport variants retained where available.

## Integrity anchors

- Runner SHA256: `c6bc7eb90aa8b227ad474dcb275227b7886a8d857a3f346879bca98280b44dea`.
- A final harness: `0c760316aeccf8dbffacc014c9502de2bc84f7a97add747d95a7d8f725c9c528`.
- A final receipt: `aa7c53ca504338892d74fdb7fb402ec5b93692a96f708c06bfe379e2ba3aae77`.
- B final harness: `b957afcf84b5cb0874a1c9abc25dffcccad8e20c46462f8860b463d1260a11c4`.
- B final receipt: `a63a848670300d7193ab023d2a177bae0f1ffc38f0ef4b06f847636ddd89f384`.

No tracked source/docs/tests edited by this subagent. Only ignored harness/evidence written. No original Argon workspace changes; no remote, merge, deploy, production or payment/auth changes. Live AI, camera, Safari, native zoom, screen reader, real household and owner acceptance remain uncertified.

Exact manual-history source anchors (supersede approximate references above): `src/worker/routes/scans.ts:492` sets persisted sourceId; `src/worker/routes/scans.ts:1668` begins sourceId filter; `src/worker/routes/scans.ts:1348` reads persisted scan_items.
