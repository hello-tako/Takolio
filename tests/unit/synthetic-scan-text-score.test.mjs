import { describe, expect, it } from 'vitest';
import { scoreTextMatrix } from '../../scripts/synthetic-scan/score.mjs';
const image = { case: 'case-0', variant: 'clean', documentId: 'document-0', task: 'receipt_ocr', locale: 'ja',
  sha256: 'image-hash', sourceWidth: 1000, sourceHeight: 1000, width: 1000, height: 1000, angle: 0,
  regions: [{ text: '牛乳', role: 'name', position: 0, x: 100, y: 100, width: 200, height: 60 }] };
const prepared = { classification: 'TEST_ONLY', datasetId: 'dataset', cases: [image] };
const result = { classification: 'TEST_ONLY', datasetId: 'dataset', engine: 'Apple Vision VNRecognizeTextRequest',
  semanticFridgeRecognitionMeasured: false, preparedSha256: 'manifest-hash', runs: [{ case: 'case-0', variant: 'clean',
    imageSha256: 'image-hash', latencyMs: 10, status: 'output', observations: [{ text: '牛乳', x: .11, y: .85, width: .09, height: .045, confidence: .8 }] }] };

describe('raw-pixel OCR text scorer integrity', () => {
  it('compares the actual text in spatial regions and penalizes dropped fields', () => {
    expect(scoreTextMatrix(prepared, result, 'manifest-hash').scores[0]).toMatchObject({ exactFields: 1, expectedFields: 1, edits: 0 });
    const missing = structuredClone(result);
    missing.runs[0].observations = [];
    expect(scoreTextMatrix(prepared, missing, 'manifest-hash').scores[0]).toMatchObject({ exactFields: 0, expectedFields: 1, edits: 2 });
  });
  it('does not use correct text outside the source region as evidence', () => {
    const outside = structuredClone(result);
    outside.runs[0].observations[0].x = .8;
    expect(scoreTextMatrix(prepared, outside, 'manifest-hash').scores[0].exactFields).toBe(0);
  });
  it('preserves duplicate occurrence denominators instead of matching one observation twice', () => {
    const duplicates = structuredClone(prepared);
    duplicates.cases[0].regions.push({ ...image.regions[0], position: 1, y: 100 });
    expect(scoreTextMatrix(duplicates, result, 'manifest-hash').scores[0]).toMatchObject({ expectedFields: 2, exactFields: 1 });
  });
  it.each(['hash', 'run', 'variant', 'latency', 'coordinates', 'engine', 'semanticClaim'])('rejects %s drift', (kind) => {
    const altered = structuredClone(result);
    if (kind === 'hash') altered.runs[0].imageSha256 = 'other';
    if (kind === 'run') altered.runs.push(altered.runs[0]);
    if (kind === 'variant') altered.runs[0].variant = 'blur';
    if (kind === 'latency') altered.runs[0].latencyMs = -1;
    if (kind === 'coordinates') altered.runs[0].observations[0].x = NaN;
    if (kind === 'engine') altered.engine = 'oracle';
    if (kind === 'semanticClaim') altered.semanticFridgeRecognitionMeasured = true;
    expect(() => scoreTextMatrix(prepared, altered, 'manifest-hash')).toThrow('SYNTHETIC_RESULTS_INVALID');
  });
  it('retains decode failures in the matrix with zero recovered text', () => {
    const failed = structuredClone(result);
    failed.runs[0].status = 'decode_or_recognition_error';
    failed.runs[0].observations = [];
    expect(scoreTextMatrix(prepared, failed, 'manifest-hash').slices[0]).toMatchObject({ images: 1, expectedFields: 1, exactFields: 0, failures: 1 });
  });
});
