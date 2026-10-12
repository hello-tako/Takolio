# Receipt preprocessing local checks

All corpus images are self-created TEST_ONLY data. The corpus, browser PNG/JPEG
outputs, raw Apple Vision OCR, scores, screenshots and command logs stay under
ignored .artifacts directories. No provider, remote database or inventory calls.

Run from the canonical worktree with Node24 and frozen pnpm dependencies. Keep
historical .artifacts/scan-synthetic-v3 unchanged; it is bound by the B03a receipt.
The four-policy comparison consumes that corpus. New candidate images go into
.artifacts/scan-preprocessing-runtime. Each receipt_runner name must be unique.

```sh
node scripts/compare-scan-preprocessing.mjs
# For each policy jpeg82, jpeg95, png, small_original, use its directory:
swift scripts/ocr-synthetic-scan-apple-vision.swift INPUT/prepared.json INPUT/apple-vision.raw.json
node scripts/score-synthetic-scan.mjs INPUT/prepared.json INPUT/apple-vision.raw.json INPUT/scores.json
node scripts/summarize-scan-preprocessing.mjs
node scripts/generate-synthetic-scan.mjs .artifacts/scan-preprocessing-runtime
node scripts/test-receipt-preprocessing-browser.mjs
swift scripts/ocr-synthetic-scan-apple-vision.swift .artifacts/scan-preprocessing-runtime/browser-images/prepared.json .artifacts/scan-preprocessing-runtime/apple-vision.raw.json
node scripts/score-synthetic-scan.mjs .artifacts/scan-preprocessing-runtime/browser-images/prepared.json .artifacts/scan-preprocessing-runtime/apple-vision.raw.json .artifacts/scan-preprocessing-runtime/scores.json
node scripts/test-scan-preprocessing-page.mjs
pnpm vitest run tests/unit/receipt-image-preprocessing.test.ts tests/unit/scan-privacy.test.tsx tests/unit/scan-ui-quota.test.tsx
```

The new native browser harness checks120corpus variants,4codec/dimension fixtures,
1damaged fallback and3session/cancel actions. Two derivatives have independently
decoded pixels equal to their unscaled source; all3PNG derivatives equal native
canvas reference bytes. The deterministic noise case exercises a real PNG larger
than512KiB and JPEG fallback. Its output may exceed512KiB, as documented by the
ADR. The padded PNG isolates source byte size; it is a valid decoded image with
trailing padding, not a photograph. Generated extras are not added to OCR labels.

The running-page harness mounts the actual ScanPage, camera component, store,
stylesheet with its rollout token scope, and real API facade/HTTP code in a local
MemoryRouter. Only the me/scan network responses and review route destination are
fixtures. Five real file-input submissions verify receipt/photo bytes, endpoint,
owner headers, command ID and navigation. Mode-change/unmount encoder races yield
no stale request; the outbox remains empty. Camera permission is absent in headless
Chromium. No camera/device/Safari/provider/real-image certification follows.

RESULT.md and validation.json record final source and command binding. The verifier
checks the implementation and private evidence when those artifacts are present.
Publication/deployment and external quality/privacy/security gates remain separate.
