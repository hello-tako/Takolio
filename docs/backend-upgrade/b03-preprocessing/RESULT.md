# B03 receipt preprocessing result - 2026-10-12 JST

Status: LOCAL_IMPLEMENTATION_VERIFIED_WITH_BLOCKING_RELEASE_GATES.
Implementation a0165c45f6d34c0a4c35c676613d6716f872c534; base 85c600542949778168527a4214960d553ce7a86a.
Branch codex/backend-b03-preprocessing; canonical worktree
/Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo.
No deployment, paid provider or independent real-image certification.

## Change and decision

The native JPEG82 path introduced23additional exact-field errors on generated
Vietnamese invoices. The receipt gallery now preserves original PNG/JPEG bytes
when decoded longest side <=2000px and bytes <=512KiB. Otherwise it tries a
nonempty canvas PNG under512KiB at the existing2000px cap, then uses the compatible
JPEG82/smaller-source fallback. Only the receipt caller opts in. Default photo
codec/dimensions and camera stay unchanged; session fences now stop stale work
before FileReader/codec callbacks as well as delivery. Synchronous PNG errors try
JPEG; delayed JPEG errors retain the existing original-file fallback. No schema,
scan API, idempotency, ownership, currency/quantity, provider or confirmation change.

ADR-B03-PREP-001.md records the decision and rollback. The allowance bounds only
the lossless choice, not all uploads: the JPEG/failure fallback may exceed512KiB,
and absent/decode-failed encoders can retain original dimensions, as before.
Configured server size/format validation remains authoritative. Original EXIF or
other metadata can remain; lossless preparation is not an EXIF sanitization policy.

## Pixel, OCR and byte evidence

Four native Chromium policies each process120valid variants plus1damaged image;
Apple Vision reads the pixels, with unchanged template-region scorer and labels.
The candidate uses a separately generated but identical source corpus and receives
actual native bitmap/canvas/FileReader processing, not a mocked image transform.

| Policy | VI receipt exact / compact | JA receipt exact / compact | Total60receipt bytes | Max receipt bytes |
| --- | --- | --- | --- | --- |
| JPEG82 control | 619/672 / 643/672 | 647/672 / 672/672 | 3,082,322 | 71,730 |
| JPEG95 | 628/672 / 652/672 | 634/672 / 672/672 | 4,379,001 | 107,380 |
| PNG all | 644/672 / 668/672 | 638/672 / 672/672 | 14,768,808 | 480,593 |
| Small originals / candidate | 642/672 / 666/672 | 647/672 / 672/672 | 3,629,058 | 91,731 |

Candidate receipt bytes increase17.74% vs control on these templates. All60small
receipts are byte-exact originals. The23additional exact VN field errors introduced
by JPEG82 disappear; remaining30exact/6compact VN and25exact/0compact JP errors
are retained. No OCR error thresholds or labels were retuned. JP exact-policy
differences include whitespace; the baseline comparison has24/24PNGreceipt rasters
pixel-exact. Label results stay VI39/39, JA38/39exact; both39/39compact. Fridge object,
package mass, hidden contents and product provider semantics remain UNMEASURED.

The native runtime harness passes124valid cases (120corpus +4extras),1damaged
reader fallback and3cancel/identity/reset checks. All60non-receipt outputs are
byte-identical to JPEG82. The padded616020-byte PNG isolates source-size handling:
its128813-byte derivative has exact decoded source pixels. Lossless WebP converts
to the same128813-byte PNG with exact decoded pixels. A3200px source becomes a
1714x2000 PNG509481bytes. All3derivatives equal independent native canvas reference
bytes. Deterministic noise PNG3246714bytes produces JPEG720490bytes after exceeding
the PNG allowance. These extra fixtures carry no OCR gold labels. Damaged JPEG
remains an actual recognition/decode error in every paired matrix.

## Running page and local gates

Actual ScanPage/camera/store/API facade/HTTP and scoped CSS run in local Vite.
Five file-input cases (PNG/JPEG/derivative receipt, fridge and food) verify request
bytes, endpoint/type, owner headers, command ID and review navigation. Local API
responses and review destination are fixtures; no real queue/Worker/provider is
involved. Two delayed native-encoder races (mode change/unmount) yield0stale scan
submissions and0outbox entries. Mobile390x844 and desktop1440x1000 screenshots were
visually checked after adding the real rollout token scope to the harness. No
horizontal overflow/page error/external request, no inventory/confirmation call.
Headless camera unavailable is expected, not a device/capture qualification.

All final gates run sequentially at clean committed implementation source:

- Frozen install, lint, both TypeScript projects PASS.
- Focused3files/47tests PASS; new29helper +3caller tests,32total.
- Full316files/7642tests PASS; command duration 138.65s.
- All40migration smoke and production build PASS.
- Native124case browser and5submission page/race harnesses PASS.
- Score bindings and source/manifest/image/SW/CSS invariants PASS.
- CSS134861bytes/SHA256796ca21e25b5dbfbf13ea2b3f70faed3f388d7c231d3cb00c056c77341cf4fef
  exact; SW contains actual implementation token. No migration changed.
- Full audit FAIL1HIGHbraces GHSA-vfj7-8cjw-p6xm; production audit PASS0.

The existing local depth patch is preserved, with no advisory waiver. The full
security release gate stays FAILED. Prior hosted/zizmor/scanner evidence remains
historical; this packet does not certify current hosted scanners or production.

## Failures, scope and next action

Two initial page harness failures are retained: virtual JSX was not transformed
by Vite import analysis, then one label fixture filename was guessed incorrectly.
Corrected by native React.createElement for the harness shell and source-manifest
lookup. Initial appearance harness omitted the rollout token scope; final scoped
screenshots were inspected. An ignored invariant helper used a wrong damaged case
name; the final check asserts the actual singleton error set and per-case hashes.
All command receipts, including failures, remain available. No weakened tests.

4614base files outside8changed existing paths are exact, including historical
synthetic packet/tools/assets, payment/auth/config/workflows/lock/provider/data and
all40migrations. State/board/handoff/program docs prepend actual status and retain
historical suffixes. This bounded receipt improvement extends the previous offline
scope under the user's continue/test-with-created-images request, documented before
runtime editing; it supersedes the older real-input-before-runtime recommendation
for local implementation only. Real acceptance remains required for release.

Original user checkout is untouched by this task. No remoteD1/R2write, deploy,
email, paidAI, provider activation, push/PR/merge or account-setting change.
See NEXT_ACTIONS.md for the remaining ordered quality/security/data/hosted gates.
validation.json and verify_packet.py bind implementation and private evidence;
final documentation is a separate checkpoint, not a self-referential source hash.
