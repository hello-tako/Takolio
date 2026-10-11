import { describe, expect, it } from 'vitest';
import {
  assessScanV3,
  parseScanV3,
  ScanV3MoneySchema,
  ScanV3QuantitySchema,
  ScanV3Schema,
  scanV3FieldSchema,
  type ScanV3,
  type ScanV3Evidence,
  type ScanV3Field,
  type ScanV3Item,
} from '../../packages/ai/src/scan-contract-v3';
import { z } from 'zod';

const unknown = { state: 'unknown', reason: 'missing' } as const;
function source<T>(value: T, position = 0, text = 'Source text'): ScanV3Field<T> {
  return { state: 'known', value, basis: 'source_extraction',
    evidence: [{ kind: 'source_text', documentId: 'document-1', sourcePosition: position, text }] };
}
function item(position = 0): ScanV3Item {
  return {
    occurrenceId: `line-${position}`, sourcePosition: position,
    rawName: source('Egg carton', position),
    quantity: { amount: source(2, position), unit: source('pack', position),
      basis: source('purchase_count', position), sourceText: source('2 packs', position) },
    canonicalId: unknown, confidence: unknown, category: unknown, storage: unknown,
  };
}
function fridge(items = [item()]): ScanV3 {
  return { schemaVersion: 3, task: 'fridge_image_analysis',
    document: { documentId: 'document-1', sourceId: 'source-1' }, items };
}
function label(): ScanV3 {
  return { schemaVersion: 3, task: 'label_ocr', document: { documentId: 'document-1', sourceId: 'source-1' },
    productionDate: unknown, expiryDate: unknown, netQuantity: item().quantity, items: [item()] };
}

function authorityField(id = 'ING_EGG', release = 'release-1'): ScanV3Field<string> {
  return { state: 'known', value: id, basis: 'certified_authority',
    evidence: [{ kind: 'certified_authority', authorityReleaseId: release, canonicalId: id }] };
}

describe('Scan V3 contract and evidence integrity', () => {
  it('preserves explicit unknowns through parse and serialization without estimates or defaults', () => {
    const scanItem = item();
    scanItem.quantity = { amount: unknown, unit: unknown, basis: unknown, sourceText: unknown };
    const value = ScanV3Schema.parse(fridge([scanItem]));
    expect(JSON.parse(JSON.stringify(value))).toEqual(fridge([scanItem]));
    expect(value.items[0]?.quantity.amount).toEqual(unknown);
    expect(value.items[0]?.storage).toEqual(unknown);
  });

  it('keeps original source text bytes including surrounding whitespace', () => {
    const scanItem = item();
    scanItem.quantity.sourceText = source('  2 packs  ');
    expect(ScanV3Schema.parse(fridge([scanItem])).items[0]?.quantity.sourceText).toEqual(source('  2 packs  '));
  });

  it('retains two identical purchases as ordered independent occurrences', () => {
    const items = [item(0), item(1)];
    const parsed = ScanV3Schema.parse(fridge(items));
    expect(parsed.items.map((entry) => entry.occurrenceId)).toEqual(['line-0', 'line-1']);
    expect(parsed.items.map((entry) => entry.quantity.amount)).toEqual([source(2, 0), source(2, 1)]);
  });

  it('rejects duplicate occurrence ID even when contents differ', () => {
    const second = item(1);
    second.occurrenceId = 'line-0';
    second.rawName = source('Another food', 1);
    expect(parseScanV3(fridge([item(), second]))).toEqual({ ok: false, code: 'SCAN_V3_INVALID_CONTRACT' });
  });

  it('rejects reversed source order but permits separate occurrences at the same source position', () => {
    expect(parseScanV3(fridge([item(1), item(0)])).ok).toBe(false);
    const second = item();
    second.occurrenceId = 'line-0-second';
    expect(parseScanV3(fridge([item(), second])).ok).toBe(true);
  });

  it.each([
    { schemaVersion: 2 }, { schemaVersion: '3' }, { task: 'receipt_scan' },
    { task: 'label_ocr' }, { status: 'CONFIRMABLE' }, { privateDebug: 'raw OCR secret' },
  ])('rejects malformed version/task and caller-declared status: %j', (change) => {
    expect(parseScanV3({ ...fridge(), ...change })).toEqual({ ok: false, code: 'SCAN_V3_INVALID_CONTRACT' });
  });

  it('requires every field to explicitly state known or unknown', () => {
    const { storage: _storage, ...partialItem } = item();
    expect(parseScanV3({ ...fridge(), items: [partialItem] }).ok).toBe(false);
  });

  it('label fields are independent of receipt merchant, totals and prices', () => {
    expect(parseScanV3(label()).ok).toBe(true);
    expect(parseScanV3({ ...label(), merchantName: unknown }).ok).toBe(false);
    expect(parseScanV3({ ...label(), totalAmount: unknown }).ok).toBe(false);
    expect(parseScanV3({ ...label(), task: 'receipt_ocr' }).ok).toBe(false);
  });

  it.each([
    { amountMinor: 0, currency: 'VND' }, { amountMinor: 220, currency: 'JPY' },
    { amountMinor: Number.MAX_SAFE_INTEGER, currency: 'VND' },
  ])('accepts explicit zero-decimal money %j', (money) => {
    expect(ScanV3MoneySchema.parse(money)).toEqual(money);
  });

  it.each([
    { amountMinor: -1, currency: 'VND' }, { amountMinor: 1.5, currency: 'JPY' },
    { amountMinor: Number.MAX_SAFE_INTEGER + 1, currency: 'VND' },
    { amountMinor: Infinity, currency: 'JPY' }, { amountMinor: NaN, currency: 'JPY' },
    { amountMinor: 1, currency: 'USD' }, { amountMinor: 1 }, { amountMinor: '1', currency: 'JPY' },
  ])('rejects invalid/unsafe money without coercion %j', (money) => {
    expect(ScanV3MoneySchema.safeParse(money).success).toBe(false);
  });

  it('rejects unknown with an asserted value and known with unknown reason or no evidence', () => {
    const field = scanV3FieldSchema(z.number());
    expect(field.safeParse({ ...unknown, value: 1 }).success).toBe(false);
    expect(field.safeParse({ ...source(1), reason: 'missing' }).success).toBe(false);
    expect(field.safeParse({ ...source(1), evidence: [] }).success).toBe(false);
    expect(field.safeParse({ state: 'known', value: 1, basis: 'source_extraction' }).success).toBe(false);
  });

  it('model-report evidence only supports confidence rather than known prices, quantity or names', () => {
    const model = <T>(value: T): ScanV3Field<T> => ({ state: 'known', value, basis: 'model_report', evidence: [
      { kind: 'model_report', documentId: 'document-1', sourcePosition: 0, modelId: 'model-1' },
    ] });
    const scanItem = item();
    scanItem.confidence = model(0.9);
    expect(parseScanV3(fridge([scanItem])).ok).toBe(true);
    scanItem.quantity.amount = model(2);
    expect(parseScanV3(fridge([scanItem])).ok).toBe(false);
    scanItem.quantity.amount = source(2);
    scanItem.rawName = model('Egg carton');
    expect(parseScanV3(fridge([scanItem])).ok).toBe(false);
  });

  it('rejects evidence that does not support the claimed basis', () => {
    const field = source(1);
    expect(scanV3FieldSchema(z.number()).safeParse({ ...field, basis: 'user_review' }).success).toBe(false);
    expect(scanV3FieldSchema(z.number()).safeParse({ ...field, basis: 'visual_observation' }).success).toBe(false);
  });

  it('requires explicit conversion reference, review and original source evidence', () => {
    const field = { ...source(200), basis: 'evidence_conversion' as const };
    expect(scanV3FieldSchema(z.number()).safeParse(field).success).toBe(false);
    const evidence: ScanV3Evidence[] = [...(field.state === 'known' ? field.evidence : []),
      { kind: 'conversion_reference', documentId: 'document-1', sourcePosition: 0, referenceId: 'package-mass-1' },
      { kind: 'user_review', documentId: 'document-1', sourcePosition: 0, reviewId: 'review-1' }];
    expect(scanV3FieldSchema(z.number()).safeParse({ ...field, evidence }).success).toBe(true);
  });

  it('rejects evidence bound to another document or another line', () => {
    const scanItem = item();
    scanItem.quantity.amount = { ...source(2), state: 'known', value: 2, basis: 'source_extraction',
      evidence: [{ kind: 'source_text', documentId: 'another-document', sourcePosition: 0, text: '2' }] };
    expect(parseScanV3(fridge([scanItem])).ok).toBe(false);
    scanItem.quantity.amount = source(2, 1);
    expect(parseScanV3(fridge([scanItem])).ok).toBe(false);
  });

  it('rejects invalid source spans and visual regions', () => {
    const field = scanV3FieldSchema(z.string());
    expect(field.safeParse({ ...source('Egg'), evidence: [
      { kind: 'source_text', documentId: 'document-1', sourcePosition: 0, text: 'Egg', start: 1, end: 1 },
    ] }).success).toBe(false);
    expect(field.safeParse({ ...source('Egg'), basis: 'visual_observation', evidence: [
      { kind: 'source_region', documentId: 'document-1', sourcePosition: 0,
        region: { x: 0.9, y: 0, width: 0.5, height: 0.5 } },
    ] }).success).toBe(false);
  });

  it.each([0, -1, Infinity, NaN])('rejects non-positive/non-finite known quantity %s', (amount) => {
    expect(ScanV3QuantitySchema.safeParse({ ...item().quantity, amount: source(amount) }).success).toBe(false);
  });

  it('rejects unsupported units and purchase basis inconsistent with physical units', () => {
    expect(ScanV3QuantitySchema.safeParse({ ...item().quantity, unit: source('cup') }).success).toBe(false);
    expect(ScanV3QuantitySchema.safeParse({ ...item().quantity, unit: source('g') }).success).toBe(false);
    expect(ScanV3QuantitySchema.safeParse({ ...item().quantity, basis: source('purchased_measure') }).success).toBe(false);
  });

  it('rejects impossible dates without inventing a replacement', () => {
    expect(parseScanV3({ ...label(), expiryDate: source('2026-02-30') }).ok).toBe(false);
    expect(parseScanV3({ ...label(), expiryDate: source('2028-02-29') }).ok).toBe(true);
  });

  it('rejects identity promoted by name similarity or provisional authority claims', () => {
    const scanItem = item();
    scanItem.canonicalId = source('ING_EGG');
    expect(parseScanV3(fridge([scanItem])).ok).toBe(false);
    scanItem.canonicalId = authorityField('ING_ENR_FAKE');
    expect(parseScanV3(fridge([scanItem])).ok).toBe(false);
    scanItem.canonicalId = { ...authorityField(), state: 'known', value: 'ING_MILK', basis: 'certified_authority',
      evidence: [{ kind: 'certified_authority', authorityReleaseId: 'release-1', canonicalId: 'ING_EGG' }] };
    expect(parseScanV3(fridge([scanItem])).ok).toBe(false);
  });

  it('exposes only a bounded error code for invalid contract, excluding raw PII and issue details', () => {
    const result = parseScanV3({ schemaVersion: 'private-email@example.test', rawImage: 'base64-secret', task: 'receipt_ocr' });
    expect(result).toEqual({ ok: false, code: 'SCAN_V3_INVALID_CONTRACT' });
    expect(JSON.stringify(result)).not.toMatch(/private-email|rawImage|base64-secret|issues|message/);
  });
});

describe('Scan V3 derived readiness', () => {
  it('classifies empty schema-valid result without calling it usable or confirmable', () => {
    expect(assessScanV3(fridge([]))).toMatchObject({ ok: true, status: 'SCHEMA_VALID', reasons: ['empty_items'] });
  });

  it('unresolved name stays draft; known name with unknown quantity is usable for review only', () => {
    const scanItem = item();
    scanItem.rawName = unknown;
    expect(assessScanV3(fridge([scanItem]))).toMatchObject({ status: 'DRAFT', reasons: ['name_unresolved'] });
    scanItem.rawName = source('Egg carton');
    scanItem.quantity.amount = unknown;
    expect(assessScanV3(fridge([scanItem]))).toMatchObject({ status: 'USABLE', reasons: ['quantity_unresolved'] });
  });

  it('known package content remains draft and cannot become purchased quantity', () => {
    const scanItem = item();
    scanItem.quantity.basis = source('package_content');
    expect(assessScanV3(fridge([scanItem]))).toMatchObject({ status: 'DRAFT', reasons: ['package_content_not_purchase'] });
  });

  it('image-only quantity and model confidence cannot authorize confirmation', () => {
    const scanItem = item();
    const evidence: ScanV3Evidence[] = [{ kind: 'source_region', documentId: 'document-1', sourcePosition: 0,
      region: { x: 0, y: 0, width: 1, height: 1 } }];
    scanItem.quantity.amount = { state: 'known', value: 2, basis: 'visual_observation', evidence };
    scanItem.confidence = { state: 'known', value: 0.99, basis: 'model_report', evidence: [
      { kind: 'model_report', documentId: 'document-1', modelId: 'model-1' },
    ] };
    expect(assessScanV3(fridge([scanItem]))).toMatchObject({ status: 'USABLE', reasons: ['quantity_evidence_required'] });
  });

  it('requires existing certified release callback before trusting canonical identity', () => {
    const scanItem = item();
    scanItem.canonicalId = authorityField();
    expect(assessScanV3(fridge([scanItem]))).toMatchObject({ status: 'USABLE', reasons: ['authority_unverified'] });
    expect(assessScanV3(fridge([scanItem]), { releaseId: 'another-release', hasCanonicalId: () => true }))
      .toMatchObject({ status: 'USABLE', reasons: ['authority_unverified'] });
    expect(assessScanV3(fridge([scanItem]), { releaseId: 'release-1', hasCanonicalId: () => { throw new Error('secret failure'); } }))
      .toMatchObject({ status: 'USABLE', reasons: ['authority_unverified'] });
    expect(assessScanV3(fridge([scanItem]), { releaseId: 'release-1', hasCanonicalId: () => false }))
      .toMatchObject({ status: 'USABLE', reasons: ['authority_unverified'] });
    expect(assessScanV3(fridge([scanItem]), { releaseId: 'release-1', hasCanonicalId: (id) => id === 'ING_EGG' }))
      .toMatchObject({ status: 'CONFIRMABLE', reasons: [] });
  });

  it('explicit user-reviewed quantity/unit/basis permits confirmability without fabricated identity', () => {
    const scanItem = item();
    const review = <T>(value: T): ScanV3Field<T> => ({ state: 'known', value, basis: 'user_review', evidence: [
      { kind: 'user_review', documentId: 'document-1', sourcePosition: 0, reviewId: 'review-test-only' },
    ] });
    scanItem.quantity.amount = review(3);
    scanItem.quantity.unit = review('piece');
    scanItem.quantity.basis = review('purchase_count');
    const result = assessScanV3(fridge([scanItem]));
    expect(result).toMatchObject({ status: 'CONFIRMABLE', reasons: [] });
    if (result.ok) expect(result.scan.items[0]?.canonicalId).toEqual(unknown);
  });
});
