import { z } from 'zod';
import { ReceiptScanResultSchema, VisionScanResultSchema } from './schemas';
import {
  assessScanV3,
  type ScanV3,
  type ScanV3Authority,
  type ScanV3Item,
  type ScanV3ReceiptItem,
  type ScanV3ReadinessReason,
  type ScanV3Status,
} from './scan-contract-v3';

export type ScanV3CompatibilityCode =
  | 'SCAN_V3_INVALID_CONTRACT'
  | 'SCAN_V3_LEGACY_TASK_UNSUPPORTED'
  | 'SCAN_V3_LEGACY_CURRENCY_UNSUPPORTED'
  | 'SCAN_V3_LEGACY_UNRESOLVED'
  | 'SCAN_V3_AUTHORITY_UNVERIFIED';
export type ScanV3LegacyProjection =
  | { ok: true; task: 'receipt_ocr'; value: z.input<typeof ReceiptScanResultSchema> }
  | { ok: true; task: 'fridge_image_analysis'; value: z.input<typeof VisionScanResultSchema> }
  | { ok: false; code: 'SCAN_V3_INVALID_CONTRACT' }
  | { ok: false; code: Exclude<ScanV3CompatibilityCode, 'SCAN_V3_INVALID_CONTRACT'>;
      draft: ScanV3; status: ScanV3Status; reasons: ScanV3ReadinessReason[] };

function itemProjection(item: ScanV3Item) {
  // Readiness has already required explicit quantity, unit, name and purchase basis.
  if (item.rawName.state !== 'known' || item.quantity.amount.state !== 'known' || item.quantity.unit.state !== 'known') {
    return undefined;
  }
  return {
    raw_name: item.rawName.value,
    estimated_quantity: item.quantity.amount.value,
    unit: item.quantity.unit.value,
    ...(item.canonicalId.state === 'known' ? { canonical_id: item.canonicalId.value } : {}),
    ...(item.category.state === 'known' ? { category: item.category.value } : {}),
    ...(item.storage.state === 'known' ? { storage: item.storage.value } : {}),
    ...(item.confidence.state === 'known' ? { confidence: item.confidence.value } : {}),
  };
}
function receiptItemProjection(item: ScanV3ReceiptItem) {
  const projected = itemProjection(item);
  if (!projected) return undefined;
  return {
    ...projected,
    ...(item.unitPrice.state === 'known' ? { unit_price_vnd: item.unitPrice.value.amountMinor } : {}),
    ...(item.lineTotal.state === 'known' ? { total_price_vnd: item.lineTotal.value.amountMinor } : {}),
  };
}
function hasNonVndMoney(scan: ScanV3): boolean {
  if (scan.task !== 'receipt_ocr') return false;
  const money = [scan.totalAmount, scan.tax, scan.discount,
    ...scan.items.flatMap((item) => [item.unitPrice, item.lineTotal, item.tax, item.discount])];
  return money.some((field) => field.state === 'known' && field.value.currency !== 'VND');
}

export function projectScanV3ToLegacy(input: unknown, authority?: ScanV3Authority): ScanV3LegacyProjection {
  const assessment = assessScanV3(input, authority);
  if (!assessment.ok) return assessment;
  const { scan, status, reasons } = assessment;
  const incompatible = (code: Exclude<ScanV3CompatibilityCode, 'SCAN_V3_INVALID_CONTRACT'>): ScanV3LegacyProjection =>
    ({ ok: false, code, draft: scan, status, reasons });
  if (scan.task === 'label_ocr') return incompatible('SCAN_V3_LEGACY_TASK_UNSUPPORTED');
  if (hasNonVndMoney(scan)) return incompatible('SCAN_V3_LEGACY_CURRENCY_UNSUPPORTED');
  if (reasons.includes('authority_unverified')) return incompatible('SCAN_V3_AUTHORITY_UNVERIFIED');
  if (status !== 'CONFIRMABLE') return incompatible('SCAN_V3_LEGACY_UNRESOLVED');
  if (scan.task === 'receipt_ocr') {
    const items = scan.items.map(receiptItemProjection);
    if (items.some((item) => item === undefined)) return incompatible('SCAN_V3_LEGACY_UNRESOLVED');
    const value = {
      ...(scan.merchantName.state === 'known' ? { merchant_name: scan.merchantName.value } : {}),
      ...(scan.invoiceNumber.state === 'known' ? { invoice_number: scan.invoiceNumber.value } : {}),
      ...(scan.purchaseDate.state === 'known' ? { purchase_date: scan.purchaseDate.value } : {}),
      ...(scan.totalAmount.state === 'known' ? { total_amount_vnd: scan.totalAmount.value.amountMinor } : {}),
      items: items.filter((item): item is NonNullable<typeof item> => item !== undefined),
    };
    if (!ReceiptScanResultSchema.safeParse(value).success) return incompatible('SCAN_V3_LEGACY_UNRESOLVED');
    // Validation only: legacy parsing would manufacture the default storage value.
    return { ok: true, task: scan.task, value };
  }
  const items = scan.items.map(itemProjection);
  if (items.some((item) => item === undefined)) return incompatible('SCAN_V3_LEGACY_UNRESOLVED');
  const value = { items: items.filter((item): item is NonNullable<typeof item> => item !== undefined) };
  if (!VisionScanResultSchema.safeParse(value).success) return incompatible('SCAN_V3_LEGACY_UNRESOLVED');
  return { ok: true, task: scan.task, value };
}
