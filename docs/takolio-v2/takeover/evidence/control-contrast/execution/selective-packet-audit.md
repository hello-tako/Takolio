# Selective control-contrast packet audit

Read-only audit, 2026-10-24. Target: `docs/takolio-v2/takeover/evidence/control-contrast/`. No tracked edit, browser/server execution, new test or gate run. Only this ignored report was written.

## Findings

No concrete integrity or privacy blocker found in the reviewed packet.

Non-blocking limits:

- Four original receipts retain the local workspace absolute path in `cwd`; `execution/evidence-audit.md:4` also names the workspace. No private backup/recovery path was found. Preserve originals byte-for-byte; do not describe this packet as fully anonymized.
- The original receipts intentionally refer to omitted raw files. The selective manifest maps published copies back to retained raw paths; this is not a self-contained replay archive or a replacement original receipt.
- Final gate logs/receipts, older C12-after logs, and some baseline helper scripts remain outside the selective manifest raw bindings. Existing receipt log/source hashes were independently checked where noted below. Do not claim the packet includes every gate log or all private outputs.
- `execution/evidence-audit.md` is a historical point-in-time baseline inventory, including then-outstanding C13 work. The final browser receipt and independent review supersede its pending status, not its preserved bytes.
- Privacy review covers text plus PNG metadata/trailers, not pixel OCR. Runtime/device/accessibility limits remain in the packet.

## Verified inventory

- 68 files, 6,280,879 bytes: 37 PNG, 27 JSON, 2 Markdown, 1 CSS, 1 TypeScript.
- 67 selected payloads plus the manifest itself. Every selected file exists, matches manifest bytes/SHA-256, and is byte-identical to its stated raw source.
- 374/374 retained raw bindings exist and match bytes/SHA-256.
- No symlinks, duplicate selected paths, or paths escaping the packet/checkout.
- All 27 JSON files parse. All 37 PNG have valid signature and positive IHDR dimensions; image rendering/content quality not certified by this check.

## Provenance checks

- C12 original receipt: 46 payloads plus 2 supplements match. Current original collector and assessor match receipt runner hashes.
- C13 original receipt: 34 payloads match. Supplement: original-receipt SHA, 6 payloads and 3 runner hashes/lengths match.
- C12-after attempts 1/2/3: private logs match receipt log SHA; exits remain 1/1/0. Final C12/C13 private log matches exit-0 receipt SHA.
- Final frozen CSS/test copies match both the final browser receipt and current source hashes. Two copied audit reports match their ignored originals byte-for-byte.
- Recertify A: all 60 receipt payloads match. Recertify B: all 59 match. Both frozen harness hashes and shared runner hashes match their receipts.
- A/B before/after source inventories each contain 1,104 unique relative paths, identical bytes/hashes; inventory file SHA matches manifest source-stability entries. This verifies run-time stability, not a claim that every repository file was inventoried.

## Status preserved

- Final C12/C13: 4 passed. C12 has 63 observations per project, 15 axe scans per project with zero reported violations; incomplete checks remain manual. C13 has 132 observations per project across 44 control/configuration combinations. Both before/after domain snapshots equal; no monitored API writes.
- Recertify A: exit 1, 51 checks, 10 journeys, no unexpected browser error. Real manual-add category readback mismatch remains: expected `spice`, actual `other`. It is not relabelled PASS.
- Recertify B: exit 0, 29 checks, 8 journeys. Any domain semantics caveats from the separate recertification report remain open; success is bounded to the assertions executed.
- Two Chromium project contexts repeat internal viewport loops. Reduced-motion only; synthetic text enlargement; targeted focus/trial-click; per-shadow geometry. No full Tab journey, Safari, device, native zoom, screenreader, production or owner acceptance claim.

## Privacy verification

Parallel privacy audit inspected 32 text files plus 37 PNG metadata/trailers. No credential/session/cookie fields, token shapes, email, external URL, or private backup/recovery path found. URLs are loopback; readback content is preview fixture data. PNG metadata contains only pHYs in three contact sheets; no tEXt/iTXt/zTXt/eXIf or trailing payload. Visible pixels were not OCR-audited.
