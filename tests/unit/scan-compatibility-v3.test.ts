import { describe, expect, it } from 'vitest';
import { ReceiptScanResultSchema, VisionScanResultSchema } from '../../packages/ai/src/schemas';
import { projectScanV3ToLegacy } from '../../packages/ai/src/scan-compatibility-v3';
import { type ScanV3, type ScanV3Field, type ScanV3ReceiptItem } from '../../packages/ai/src/scan-contract-v3';

const unknown = { state: 'unknown', reason: 'missing' } as const;
function source<T>(value: T, position = 0): ScanV3Field<T> {
  return { state: 'known', value, basis: 'source_extraction',
    evidence: [{ kind: 'source_text', documentId: 'document-1', sourcePosition: position, text: 'Source text' }] };
}
function receiptItem(position = 0): ScanV3ReceiptItem {
  return { occurrenceId: `line-${position}`, sourcePosition: position, rawName: source('Egg carton', position),
    quantity: { amount: source(2, position), unit: source('pack', position), basis: source('purchase_count', position),
      sourceText: source('2 packs', position) }, canonicalId: unknown, confidence: unknown, category: unknown,
    storage: unknown, unitPrice: unknown, lineTotal: unknown, tax: unknown, discount: unknown };
}
function receipt(items = [receiptItem()]): ScanV3 {
  return { schemaVersion: 3, task: 'receipt_ocr', document: { documentId: 'document-1', sourceId: 'source-1' },
    merchantName: unknown, invoiceNumber: unknown, purchaseDate: unknown, totalAmount: unknown,
    tax: unknown, discount: unknown, items };
}

describe('Scan V3 truthful legacy projection', () => {
  it('projects an expressible known VND receipt with the existing field names and values', () => {
    const scanItem = receiptItem();
    scanItem.unitPrice = source({ amountMinor: 12_000, currency: 'VND' });
    scanItem.lineTotal = source({ amountMinor: 20_000, currency: 'VND' });
    scanItem.category = source('egg');
    scanItem.storage = source('pantry');
    scanItem.confidence = source(0.8);
    const input = receipt([scanItem]);
    if (input.task !== 'receipt_ocr') throw new Error('Invalid test fixture');
    input.merchantName = source('Test-only shop');
    input.purchaseDate = source('2026-10-11');
    input.totalAmount = source({ amountMinor: 20_000, currency: 'VND' });
    const result = projectScanV3ToLegacy(input);
    expect(result).toEqual({ ok: true, task: 'receipt_ocr', value: {
      merchant_name: 'Test-only shop', purchase_date: '2026-10-11', total_amount_vnd: 20_000,
      items: [{ raw_name: 'Egg carton', estimated_quantity: 2, unit: 'pack', category: 'egg', storage: 'pantry',
        confidence: 0.8, unit_price_vnd: 12_000, total_price_vnd: 20_000 }],
    } });
    if (result.ok && result.task === 'receipt_ocr') expect(ReceiptScanResultSchema.safeParse(result.value).success).toBe(true);
  });

  it('omits unknown optional fields instead of manufacturing price, merchant, confidence or storage', () => {
    const result = projectScanV3ToLegacy(receipt());
    expect(result).toEqual({ ok: true, task: 'receipt_ocr', value: {
      items: [{ raw_name: 'Egg carton', estimated_quantity: 2, unit: 'pack' }],
    } });
    if (result.ok) expect(JSON.stringify(result.value)).not.toMatch(/price|merchant|confidence|storage|canonical/);
  });

  it.each(['amount', 'unit', 'basis'] as const)('returns typed draft when %s is unknown', (field) => {
    const scanItem = receiptItem();
    scanItem.quantity[field] = unknown;
    const result = projectScanV3ToLegacy(receipt([scanItem]));
    expect(result).toMatchObject({ ok: false, code: 'SCAN_V3_LEGACY_UNRESOLVED', status: 'USABLE',
      reasons: ['quantity_unresolved'] });
    if (!result.ok && 'draft' in result) expect(result.draft.items[0]?.quantity[field]).toEqual(unknown);
    expect(result).not.toHaveProperty('value');
  });

  it('does not project observed measure as a receipt purchase amount', () => {
    const scanItem = receiptItem();
    scanItem.quantity.basis = source('observed_measure');
    expect(projectScanV3ToLegacy(receipt([scanItem]))).toMatchObject({
      ok: false, code: 'SCAN_V3_LEGACY_UNRESOLVED', status: 'DRAFT', reasons: ['quantity_basis_not_purchase'],
    });
  });

  it('rejects model-reported money without source or user-reviewed evidence', () => {
    const scanItem = receiptItem();
    scanItem.lineTotal = { state: 'known', value: { amountMinor: 100, currency: 'VND' }, basis: 'model_report',
      evidence: [{ kind: 'model_report', documentId: 'document-1', sourcePosition: 0, modelId: 'model-1' }] };
    expect(projectScanV3ToLegacy(receipt([scanItem]))).toEqual({ ok: false, code: 'SCAN_V3_INVALID_CONTRACT' });
  });

  it('does not project package net mass as the purchase amount', () => {
    const scanItem = receiptItem();
    scanItem.quantity.amount = source(500);
    scanItem.quantity.unit = source('g');
    scanItem.quantity.basis = source('package_content');
    expect(projectScanV3ToLegacy(receipt([scanItem]))).toMatchObject({
      ok: false, code: 'SCAN_V3_LEGACY_UNRESOLVED', status: 'DRAFT', reasons: ['package_content_not_purchase'],
    });
  });

  it.each(['totalAmount', 'tax', 'discount'] as const)('rejects known JPY receipt %s without converting it to VND', (field) => {
    const input = receipt();
    if (input.task !== 'receipt_ocr') throw new Error('Invalid test fixture');
    input[field] = source({ amountMinor: 220, currency: 'JPY' });
    const result = projectScanV3ToLegacy(input);
    expect(result).toMatchObject({ ok: false, code: 'SCAN_V3_LEGACY_CURRENCY_UNSUPPORTED' });
    expect(result).not.toHaveProperty('value');
  });

  it.each(['unitPrice', 'lineTotal', 'tax', 'discount'] as const)('rejects JPY line %s', (field) => {
    const scanItem = receiptItem();
    scanItem[field] = source({ amountMinor: 220, currency: 'JPY' });
    expect(projectScanV3ToLegacy(receipt([scanItem]))).toMatchObject({ ok: false, code: 'SCAN_V3_LEGACY_CURRENCY_UNSUPPORTED' });
  });

  it('keeps legitimate duplicate purchase quantities and totals intact', () => {
    const items = [receiptItem(0), receiptItem(1)];
    for (const scanItem of items) scanItem.lineTotal = source({ amountMinor: 20_000, currency: 'VND' }, scanItem.sourcePosition);
    const result = projectScanV3ToLegacy(receipt(items));
    if (!result.ok) throw new Error(result.code);
    expect(result.value.items).toHaveLength(2);
    expect(result.value.items.reduce((sum, row) => sum + row.estimated_quantity, 0)).toBe(4);
    if (result.task === 'receipt_ocr') expect(result.value.items.reduce((sum, row) => sum + (row.total_price_vnd ?? 0), 0)).toBe(40_000);
  });

  it('does not mutate the input or erase original extraction when projecting reviewed quantity', () => {
    const scanItem = receiptItem();
    scanItem.quantity.amount = { state: 'known', value: 3, basis: 'user_review', evidence: [
      { kind: 'user_review', documentId: 'document-1', sourcePosition: 0, reviewId: 'review-test-only' },
    ] };
    const input = receipt([scanItem]);
    const before = JSON.stringify(input);
    const result = projectScanV3ToLegacy(input);
    expect(JSON.stringify(input)).toBe(before);
    if (!result.ok) throw new Error(result.code);
    expect(result.value.items[0]?.estimated_quantity).toBe(3);
    expect(scanItem.quantity.sourceText).toEqual(source('2 packs'));
  });

  it('refuses a canonical claim unless the supplied current release confirms it', () => {
    const scanItem = receiptItem();
    scanItem.canonicalId = { state: 'known', value: 'ING_EGG', basis: 'certified_authority', evidence: [
      { kind: 'certified_authority', authorityReleaseId: 'release-1', canonicalId: 'ING_EGG' },
    ] };
    const input = receipt([scanItem]);
    expect(projectScanV3ToLegacy(input)).toMatchObject({ ok: false, code: 'SCAN_V3_AUTHORITY_UNVERIFIED' });
    expect(projectScanV3ToLegacy(input, { releaseId: 'release-1', hasCanonicalId: () => false }))
      .toMatchObject({ ok: false, code: 'SCAN_V3_AUTHORITY_UNVERIFIED' });
    const result = projectScanV3ToLegacy(input, { releaseId: 'release-1', hasCanonicalId: (id) => id === 'ING_EGG' });
    if (!result.ok) throw new Error(result.code);
    expect(result.value.items[0]?.canonical_id).toBe('ING_EGG');
  });

  it('projects fridge task independently and never creates receipt fields', () => {
    const { unitPrice: _unitPrice, lineTotal: _lineTotal, tax: _tax, discount: _discount, ...scanItem } = receiptItem();
    const input = { schemaVersion: 3, task: 'fridge_image_analysis',
      document: { documentId: 'document-1', sourceId: 'source-1' }, items: [scanItem] };
    const result = projectScanV3ToLegacy(input);
    expect(result).toEqual({ ok: true, task: 'fridge_image_analysis',
      value: { items: [{ raw_name: 'Egg carton', estimated_quantity: 2, unit: 'pack' }] } });
    if (result.ok && result.task === 'fridge_image_analysis') expect(VisionScanResultSchema.safeParse(result.value).success).toBe(true);
  });

  it('returns unsupported task for a valid independent label instead of borrowing receipt schema', () => {
    const { unitPrice: _unitPrice, lineTotal: _lineTotal, tax: _tax, discount: _discount, ...scanItem } = receiptItem();
    expect(projectScanV3ToLegacy({ schemaVersion: 3, task: 'label_ocr',
      document: { documentId: 'document-1', sourceId: 'source-1' }, items: [scanItem],
      productionDate: unknown, expiryDate: unknown, netQuantity: scanItem.quantity }))
      .toMatchObject({ ok: false, code: 'SCAN_V3_LEGACY_TASK_UNSUPPORTED' });
  });

  it('invalid input returns bounded error code with no raw data or Zod diagnostics', () => {
    const result = projectScanV3ToLegacy({ schemaVersion: 'secret-image', email: 'private@example.test' });
    expect(result).toEqual({ ok: false, code: 'SCAN_V3_INVALID_CONTRACT' });
    expect(JSON.stringify(result)).not.toMatch(/secret-image|private|email|issues/);
  });
});
