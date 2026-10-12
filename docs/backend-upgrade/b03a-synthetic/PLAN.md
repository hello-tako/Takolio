# B03a synthetic image extension - 2026-10-12 JST

Status: SYNTHETIC_LOCAL_TESTS_COMPLETE; product/release certification remains open. Base: 9e5860806c2d7be6a9daefbb99695885c5e72c4f.
Branch: codex/backend-b03a-synthetic-images. Canonical worktree remains
/Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo.

The user's explicit request permits creating invoice and refrigerator samples
for tests. Deliver deterministic synthetic raster images, source-first labels,
actual local text recognition, and tests using actual encoded image bytes.
This extends offline B03a; it does not authorize provider calls or runtime rollout.

## Scope and decisions

- Preserve the existing four-receipt/16-variant historical dataset and tools.
- Add 24 original scenes: six VN receipts, six JP receipts, six labels, six fridge
  illustrations. Five variants each: clean, blur, tilt, low_light, missing_field.
- All metadata is TEST_ONLY; fridge scenes are illustrations, not photographs.
  Labels describe visible facts only. Unknown mass, count, price, dates and
  canonical identity remain unknown. Duplicate purchases keep distinct positions.
- Missing-field images have their own observable labels. They cannot inherit
  a known quantity or price from the clean scene. Group every variant by original
  document/source in a single split. Splits exercise isolation, not certification.
- Owned paths: new scripts/synthetic-scan sources, synthetic generator/OCR/scorer,
  qa/ocr/synthetic-v3, new focused tests, this packet, dataset contracts only for
  explicit SYNTHETIC_IMAGE classification, and program/state/decision documents.
- Forbidden: application runtime, providers, payment/auth/config, dependencies,
  migrations, public assets, existing receipts, provider activation and remote writes.
- Local Apple Vision measures text extraction from receipt/label pixels. It cannot
  certify refrigerator object recognition. Provider request tests stub responses
  and measure transport/schema behavior only; never call mock accuracy OCR quality.

## Sequence and acceptance

1. Implement source-driven rendering and annotations, pin font provenance/hash.
2. Decode and visually inspect receipt/fridge examples; verify image/source hashes,
   dimensions, complete matrix, determinism and split/annotation invariants.
3. Execute Apple Vision on real files; score evidence independently of expected
   answers, preserve all missing/malformed cases in the denominator. Report task,
   locale and quality slices with source-level document counts. No paid calls.
4. Test actual image bytes through existing provider adapters with intercepted
   fetch; test UNKNOWN, currency, duplicates, hash drift and damaged-image behavior.
5. Run frozen install, lint, both TypeScript projects, full tests, 40-migration smoke
   and build sequentially. Preserve failed discoveries and rerun corrected checks.
6. Review complete diff/protected paths, checkpoint implementation, run clean-source
   gates, update state/board/handoff and one aggregate result with exact evidence.

## Limits and next release gates

Synthetic tests remove the local sample-file dependency. They do not supply
240 permitted real originals, independently reviewed transcripts, provider
performance/cost/privacy evidence, ingredient human approvals, billing scope,
hosted/staging/device/SLO or release acceptance. Current high dependency advisory
and historical hosted scanner findings remain open; no waiver or activation.
