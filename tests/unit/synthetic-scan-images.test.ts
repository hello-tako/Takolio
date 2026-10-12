import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { ScanV3DatasetSchema, scoreScanV3 } from '../../scripts/scan-v3-scoring';
import { assessScanV3 } from '../../packages/ai/src/scan-contract-v3';
import { verifySyntheticImages } from '../../scripts/synthetic-scan/verify.mjs';
import { QwenProvider } from '../../packages/ai/src/providers/qwen';

const output = resolve('.artifacts/synthetic-scan-test');
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function generate() {
  execFileSync(process.execPath, ['scripts/generate-synthetic-scan.mjs', output], { stdio: 'pipe' });
  return { dataset: ScanV3DatasetSchema.parse(JSON.parse(readFileSync(join(output, 'dataset.json'), 'utf8'))),
    prepared: JSON.parse(readFileSync(join(output, 'prepared.json'), 'utf8')) };
}
let fixture: ReturnType<typeof generate>;
beforeAll(() => { fixture = generate(); }, 30_000);
afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.restoreAllMocks());

describe('actual synthetic receipt, label and refrigerator image corpus', () => {
  it('renders 24 source documents / 120 variants with pinned fonts and actual byte hashes', async () => {
    expect(fixture.dataset.cases).toHaveLength(120);
    expect(new Set(fixture.dataset.cases.map((row) => row.documentId)).size).toBe(24);
    expect(fixture.prepared.cases).toHaveLength(121);
    for (const image of fixture.prepared.cases) {
      const bytes = Buffer.from(readFileSync(join(output, image.file)));
      expect(hash(bytes)).toBe(image.sha256);
      expect(bytes.length).toBe(image.bytes);
      if (image.expectedFailure) continue;
      const meta = await sharp(bytes).metadata();
      expect([meta.width, meta.height, meta.format]).toEqual([image.width, image.height, image.format]);
      const row = fixture.dataset.cases.find((entry) => entry.caseId === image.case)!;
      expect(row.preprocessingSha256).toBe(hash(bytes));
      expect(row.assetKind).toBe('SYNTHETIC_IMAGE');
      expect(row.annotation.status).toBe('TEST_ONLY');
      expect(row.annotation.reviewer).toBe('MISSING');
      expect(row.annotation.adjudicator).toBe('MISSING');
    }
    for (const font of fixture.prepared.fonts) expect(hash(readFileSync(font.path))).toBe(font.sha256);
  });
  it('verifies the full image/annotation binding and rejects byte, metadata, matrix and synthetic-kind drift', async () => {
    await expect(verifySyntheticImages(output, fixture.prepared, fixture.dataset)).resolves.toEqual({ images: 121, annotated: 120, documents: 24 });
    for (const field of ['sha256', 'width', 'task', 'file'] as const) {
      const prepared = structuredClone(fixture.prepared);
      prepared.cases[0][field] = field === 'width' ? 1 : field === 'file' ? '../sources.json' : 'tampered';
      await expect(verifySyntheticImages(output, prepared, fixture.dataset)).rejects.toThrow();
    }
    const missing = structuredClone(fixture.prepared);
    missing.cases.pop();
    missing.cases.pop();
    await expect(verifySyntheticImages(output, missing, fixture.dataset)).rejects.toThrow('SYNTHETIC_MATRIX_INVALID');
    const forged = structuredClone(fixture.dataset);
    forged.cases[0].assetKind = 'LICENSED_IMAGE';
    expect(ScanV3DatasetSchema.safeParse(forged).success).toBe(false);
  });
  it('reproduces exact pixels and annotations on the same renderer', () => {
    const next = generate();
    expect(next.dataset).toEqual(fixture.dataset);
    expect(next.prepared).toEqual(fixture.prepared);
  }, 30_000);
  it('keeps original/source/image variants in one split and rejects leakage', () => {
    for (const id of new Set(fixture.dataset.cases.map((row) => row.documentId))) {
      const rows = fixture.dataset.cases.filter((row) => row.documentId === id);
      expect(rows.map((row) => row.quality)).toEqual(['clean', 'blur', 'tilt', 'low_light', 'missing_field']);
      expect(new Set(rows.map((row) => row.split)).size).toBe(1);
      expect(new Set(rows.map((row) => row.assetSha256)).size).toBe(1);
    }
    const altered = structuredClone(fixture.dataset);
    altered.cases[1].split = 'heldout';
    expect(ScanV3DatasetSchema.safeParse(altered).success).toBe(false);
  });
  it('preserves duplicate purchases and explicit VND / JPY without defaults or conversion', () => {
    for (const locale of ['vi', 'ja']) {
      const row = fixture.dataset.cases.find((entry) => entry.caseId === `syn-${locale}-receipt-0-clean`)!;
      const scan = row.annotation.groundTruth;
      expect(scan.task).toBe('receipt_ocr');
      if (scan.task !== 'receipt_ocr') throw new Error('TEST_TASK_MISMATCH');
      expect(scan.items[0].rawName).toEqual({ ...scan.items[2].rawName,
        evidence: scan.items[0].rawName.state === 'known' ? scan.items[0].rawName.evidence : undefined });
      expect(scan.items[0].occurrenceId).not.toBe(scan.items[2].occurrenceId);
      expect(scan.items[0].sourcePosition).not.toBe(scan.items[2].sourcePosition);
      expect(scan.totalAmount.state).toBe('known');
      if (scan.totalAmount.state !== 'known') throw new Error('TEST_TOTAL_MISSING');
      expect(scan.totalAmount.value.currency).toBe(locale === 'vi' ? 'VND' : 'JPY');
      expect(scan.items).toHaveLength(7);
    }
  });
  it('does not retain hidden receipt totals/quantities, label net content or expiry as known', () => {
    for (const row of fixture.dataset.cases.filter((entry) => entry.quality === 'missing_field')) {
      const scan = row.annotation.groundTruth;
      if (scan.task === 'receipt_ocr') {
        expect(scan.items[1].quantity.amount.state).toBe('unknown');
        expect(scan.items[1].lineTotal.state).toBe('unknown');
        expect(scan.totalAmount.state).toBe('unknown');
      } else if (scan.task === 'label_ocr') {
        expect(scan.netQuantity.amount.state).toBe('unknown');
        expect(scan.expiryDate.state).toBe('unknown');
      }
    }
  });
  it('keeps all refrigerator quantities and covered contents unknown with source-bound visual evidence', () => {
    for (const row of fixture.dataset.cases.filter((entry) => entry.task === 'fridge_image_analysis')) {
      const scan = row.annotation.groundTruth;
      expect(scan.items).toHaveLength(4);
      expect(scan.items[2].rawName.state).toBe('unknown');
      for (const item of scan.items) {
        expect(item.quantity.amount.state).toBe('unknown');
        expect(item.quantity.unit.state).toBe('unknown');
        expect(item.quantity.basis.state).toBe('unknown');
        expect(item.canonicalId.state).toBe('unknown');
        if (item.rawName.state === 'known') {
          expect(item.rawName.basis).toBe('visual_observation');
          expect(item.rawName.evidence[0]).toMatchObject({ kind: 'source_region', documentId: row.documentId });
        }
      }
      const assessed = assessScanV3(scan);
      expect(assessed.ok).toBe(true);
      if (!assessed.ok) throw new Error('TEST_CONTRACT_INVALID');
      expect(assessed.status).not.toBe('CONFIRMABLE');
    }
  });
  it('retains all 120 absent submissions and UNKNOWN slots in offline evaluator denominators', () => {
    const result = scoreScanV3(fixture.dataset, { schemaVersion: 1, datasetId: fixture.dataset.datasetId, submissions: [] });
    expect(result.certification).toBe('NOT_CERTIFIED');
    expect(result.total).toMatchObject({ submissions: 120, documents: 24, finalSchemaPass: 0, failureCounts: { missing: 120 } });
    expect(result.total.unknown.slots).toBeGreaterThan(0);
    expect(result.total.unknown.unassessedSlots).toBe(result.total.unknown.slots);
  });
  it('counts an invented fridge quantity and collapsed purchases as scoring failures', () => {
    const fridge = fixture.dataset.cases.find((entry) => entry.caseId === 'syn-fridge-0-clean')!;
    const receipt = fixture.dataset.cases.find((entry) => entry.caseId === 'syn-vi-receipt-0-clean')!;
    const dataset = { ...fixture.dataset, cases: [fridge, receipt] };
    const fridgeOutput = structuredClone(fridge.annotation.groundTruth);
    fridgeOutput.items[0].quantity.amount = { state: 'known', value: 500, basis: 'visual_observation',
      evidence: [{ kind: 'source_region', documentId: fridge.documentId, sourcePosition: 0,
        region: { x: .1, y: .1, width: .2, height: .2 } }] };
    const receiptOutput = structuredClone(receipt.annotation.groundTruth);
    receiptOutput.items.splice(2, 1);
    const output = scoreScanV3(dataset, { schemaVersion: 1, datasetId: dataset.datasetId,
      submissions: [fridgeOutput, receiptOutput].map((scan, index) => ({ caseId: dataset.cases[index].caseId,
        finalAttempt: 0, attempts: [{ kind: 'primary', status: 'output', output: scan,
          costUsdMicros: null, costBasis: 'UNKNOWN', pricingVersion: 'MISSING' }] })) });
    expect(output.total.unknown.assertedKnown).toBe(1);
    expect(output.total.occurrenceRecall).toBe(10 / 11);
    expect(output.total.quantityExactOccurrences).toBe(9);
    expect(output.certification).toBe('NOT_CERTIFIED');
  });
  it('rejects the damaged image with the real decoder', async () => {
    await expect(sharp(readFileSync(join(output, 'damaged.jpg'))).toBuffer()).rejects.toThrow();
  });
});

describe('image adapter transport with intercepted responses, not OCR quality', () => {
  it.each([
    ['syn-vi-receipt-0-clean', 'receiptScan'], ['syn-ja-receipt-0-low_light', 'receiptScan'],
    ['syn-fridge-0-clean', 'vision'], ['syn-fridge-1-tilt', 'vision'],
  ] as const)('carries decoded bytes and MIME unchanged for %s', async (caseId, operation) => {
    const image = fixture.prepared.cases.find((entry: { case: string }) => entry.case === caseId);
    const bytes = Buffer.from(readFileSync(join(output, image.file)));
    const mime = image.format === 'png' ? 'image/png' : 'image/jpeg';
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: {
      content: JSON.stringify({ items: [{ raw_name: 'Cà chua', estimated_quantity: 1, unit: 'piece', confidence: .7 }] }),
    } }] }), { headers: { 'Content-Type': 'application/json' } }));
    const result = await new QwenProvider('synthetic-test-placeholder')[operation]({ imageBase64OrUrl: bytes.toString('base64'), mimeType: mime });
    const payload = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    const encoded = payload.messages[0].content.find((part: { type: string }) => part.type === 'image_url').image_url.url;
    expect(encoded.startsWith(`data:${mime};base64,`)).toBe(true);
    expect(hash(Buffer.from(encoded.split(',')[1], 'base64'))).toBe(image.sha256);
    expect(result.items[0].estimated_quantity).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(['vision', 'receiptScan'] as const)('legacy %s rejects unknown quantity instead of inventing one', async (operation) => {
    const image = fixture.prepared.cases.find((entry: { case: string }) => entry.case === 'syn-fridge-0-clean');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: {
      content: JSON.stringify({ items: [{ raw_name: 'covered container', estimated_quantity: null, unit: null, confidence: .7 }] }),
    } }] })));
    await expect(new QwenProvider('synthetic-test-placeholder')[operation]({
      imageBase64OrUrl: Buffer.from(readFileSync(join(output, image.file))).toString('base64'), mimeType: 'image/png',
    })).rejects.toMatchObject({ code: 'SCHEMA_VALIDATION', retryable: false });
  });
  it('rejects malformed provider output for an actual image without fabricating an item', async () => {
    const image = fixture.prepared.cases.find((entry: { case: string }) => entry.case === 'syn-fridge-0-clean');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{invalid' } }] })));
    await expect(new QwenProvider('synthetic-test-placeholder').vision({
      imageBase64OrUrl: Buffer.from(readFileSync(join(output, image.file))).toString('base64'), mimeType: 'image/png',
    })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
