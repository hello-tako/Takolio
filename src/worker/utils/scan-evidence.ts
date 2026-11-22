import type { LotExpiryFields } from './inventory-authority';
import type { InventoryScanEvidence } from '../../../packages/domain/src/inventory-lot-commands';

// T13 receipt/vision truth mapping. Everything here converts EVIDENCE (OCR /
// vision extraction plus the user's review) into the exact inputs the T09 lot
// authority accepts. Nothing in this module writes inventory: it only decides
// what is provable. The governing invariants are DEC-003 and MASTER_CONTEXT:
// UNKNOWN != ZERO, ESTIMATED != CONFIRMED, and no fabricated purchase, price,
// merchant or expiry fact.

/** Server-side scan type. Never derived from client-supplied text. */
export type ScanProvenanceType = 'RECEIPT' | 'SCAN';

/**
 * Authoritative provenance for a confirmed line. `scan_type` is the column the
 * server itself wrote when the scan was created, so a client cannot relabel a
 * fridge photo as a receipt (or the reverse) to smuggle purchase facts in.
 */
export function scanProvenance(scanType: unknown): ScanProvenanceType {
  return scanType === 'receipt' ? 'RECEIPT' : 'SCAN';
}

/** UI-facing provenance label source. Receipts stay distinguishable from scans. */
export function provenanceDataSource(sourceType: string): string {
  switch (sourceType) {
    case 'RECEIPT': return 'receipt';
    case 'SCAN': return 'scan';
    case 'SHOPPING': return 'shopping';
    case 'LEGACY_BACKFILL': return 'legacy';
    default: return 'manual';
  }
}

/**
 * How a confirmed expiry date was established.
 *   `supplied`  - an explicit dated fact (user date picker, receipt-printed
 *                 expiry). Becomes KNOWN.
 *   `inferred`  - derived from a day chip or a default shelf life. Becomes
 *                 ESTIMATED, never KNOWN.
 *   `absent`    - no date and no sanctioned estimate. Becomes UNKNOWN.
 */
export type ExpiryBasis = 'supplied' | 'inferred' | 'absent';

type ScanLotExpiryFields = Omit<LotExpiryFields, 'expiryKind'> & {
  expiryKind: 'KNOWN' | 'ESTIMATED' | 'UNKNOWN';
};

export const UNKNOWN_EXPIRY: ScanLotExpiryFields = {
  expiryAt: null, estimatedExpiryAt: null, expiryKind: 'UNKNOWN',
};

/**
 * Expiry truth mapper. A date without a basis is never promoted: an inferred
 * shelf-life date is ESTIMATED evidence, so it lands in `estimatedExpiryAt`
 * and can never silently become KNOWN authority.
 */
export function lotExpiryFromEvidence(expiryDate: string | null | undefined,
  basis: ExpiryBasis): ScanLotExpiryFields {
  if (basis === 'absent' || !expiryDate) return { ...UNKNOWN_EXPIRY };
  if (basis === 'inferred') {
    return { expiryAt: null, estimatedExpiryAt: expiryDate, expiryKind: 'ESTIMATED' };
  }
  return { expiryAt: expiryDate, estimatedExpiryAt: null, expiryKind: 'KNOWN' };
}

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Accept a calendar date only when it is a real, unambiguous day. A malformed
 * or impossible OCR date is absence, never a coerced "today".
 */
export function trustworthyCalendarDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!CALENDAR_DATE.test(trimmed)) return null;
  const [year, month, day] = trimmed.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1] ? trimmed : null;
}

export type InventoryLotCurrency = 'VND' | 'JPY' | 'USD' | 'EUR';

const LOT_CURRENCY_MINOR_DIGITS: Readonly<Record<InventoryLotCurrency, 0 | 2>> = Object.freeze({
  VND: 0,
  JPY: 0,
  USD: 2,
  EUR: 2,
});

export interface PurchasePriceMinor {
  currency: InventoryLotCurrency;
  amountMinor: number;
  minorDigits: 0 | 2;
}

/**
 * Convert a receipt money fact into the project's exact minor-unit
 * representation (`VND`/`JPY` = 0 minor digits; `EUR`/`USD` = 2 minor digits).
 * Missing price stays null — it is never coerced to 0, because 0 is itself a factual claim.
 */
export function receiptPurchasePrice(
  amountMinorInput: unknown,
  currencyInput: unknown = 'VND',
): PurchasePriceMinor | null {
  if (amountMinorInput === null || amountMinorInput === undefined) return null;
  const currency = typeof currencyInput === 'string' && currencyInput.trim()
    ? currencyInput.trim().toUpperCase()
    : 'VND';
  if (!(currency in LOT_CURRENCY_MINOR_DIGITS)) return null;
  const amount = Number(amountMinorInput);
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (!Number.isSafeInteger(amount)) return null;
  const typedCurrency = currency as InventoryLotCurrency;
  return {
    currency: typedCurrency,
    amountMinor: amount,
    minorDigits: LOT_CURRENCY_MINOR_DIGITS[typedCurrency],
  };
}

export interface ReceiptLineFacts {
  /** Receipt-level purchase date, when the receipt actually carries one. */
  purchasedAt: string | null;
  /** Line total in minor units, when the receipt actually carries one. */
  purchasePrice: PurchasePriceMinor | null;
}

/**
 * Purchase facts for one confirmed receipt line. Fridge scans carry none: a
 * photo of a fridge proves nothing about what anything cost or when it was
 * bought, so inventing those facts there would be fabrication.
 */
export function receiptLineFacts(
  provenance: ScanProvenanceType,
  scan: { purchase_date?: unknown; currency?: unknown },
  line: {
    currency?: unknown;
    total_price_minor?: unknown;
    unit_price_minor?: unknown;
    total_price_vnd?: unknown;
    unit_price_vnd?: unknown;
    estimated_quantity?: unknown;
  },
): ReceiptLineFacts {
  if (provenance !== 'RECEIPT') return { purchasedAt: null, purchasePrice: null };
  const lineCurrency = line.currency ?? scan.currency ?? 'VND';
  const rawTotal = line.total_price_minor ?? line.total_price_vnd;
  const rawUnit = line.unit_price_minor ?? line.unit_price_vnd;

  let price = receiptPurchasePrice(rawTotal, lineCurrency);
  if (price === null) {
    if (rawUnit === null || rawUnit === undefined) {
      return { purchasedAt: trustworthyCalendarDate(scan.purchase_date), purchasePrice: null };
    }
    const unitPrice = Number(rawUnit);
    const quantity = Number(line.estimated_quantity);
    if (
      Number.isSafeInteger(unitPrice) &&
      unitPrice >= 0 &&
      Number.isSafeInteger(quantity) &&
      quantity > 0
    ) {
      price = receiptPurchasePrice(unitPrice * quantity, lineCurrency);
    }
  }
  return { purchasedAt: trustworthyCalendarDate(scan.purchase_date), purchasePrice: price };
}

export interface RawScanEvidence {
  rawName: string | null;
  quantity: number | null;
  unit: string | null;
  /** Ingested canonical mapping (0032); null when unmapped or never retained. */
  canonicalId: string | null;
  /** Ingested category (0032); null when never retained. */
  category: string | null;
  /** Ingested storage (0032); null when never retained. */
  storage: 'fridge' | 'freezer' | 'pantry' | null;
}

/** Raw extraction as persisted by 0031/0032; each field is absent when it was never retained. */
export function rawScanEvidence(row: {
  ocr_raw_name?: unknown; ocr_quantity?: unknown; ocr_unit?: unknown;
  ocr_canonical_id?: unknown; ocr_category?: unknown; ocr_storage?: unknown;
}): RawScanEvidence {
  const quantity = row.ocr_quantity === null || row.ocr_quantity === undefined
    ? null : Number(row.ocr_quantity);
  const storage = row.ocr_storage;
  return {
    rawName: typeof row.ocr_raw_name === 'string' ? row.ocr_raw_name : null,
    quantity: quantity !== null && Number.isFinite(quantity) && quantity > 0 ? quantity : null,
    unit: typeof row.ocr_unit === 'string' ? row.ocr_unit : null,
    canonicalId: typeof row.ocr_canonical_id === 'string' && row.ocr_canonical_id ? row.ocr_canonical_id : null,
    category: typeof row.ocr_category === 'string' && row.ocr_category ? row.ocr_category : null,
    storage: storage === 'fridge' || storage === 'freezer' || storage === 'pantry' ? storage : null,
  };
}

/** True when no raw evidence at all was retained for the line. */
export function rawEvidenceAbsent(raw: RawScanEvidence): boolean {
  return raw.rawName === null && raw.quantity === null && raw.unit === null
    && raw.canonicalId === null && raw.category === null && raw.storage === null;
}

/**
 * The expiry a reviewer accepted at confirmation, as persisted by 0032, in
 * the same shape the review UI submits (`expiryDate` + `expiryEstimated`) plus
 * the explicit kind. Null when the line carries no reviewed expiry (never
 * confirmed, rejected, or confirmed before 0032 — genuinely unknown).
 */
export function reviewedScanExpiry(row: {
  reviewed_expiry_date?: unknown; reviewed_expiry_kind?: unknown;
}): { expiryKind: 'KNOWN' | 'ESTIMATED' | 'UNKNOWN'; expiryDate?: string; expiryEstimated?: boolean } | null {
  const kind = row.reviewed_expiry_kind;
  if (kind === 'UNKNOWN') return { expiryKind: 'UNKNOWN' };
  if (kind !== 'KNOWN' && kind !== 'ESTIMATED') return null;
  const date = trustworthyCalendarDate(row.reviewed_expiry_date);
  if (date === null) return null;
  return { expiryKind: kind, expiryDate: date, expiryEstimated: kind === 'ESTIMATED' };
}

/**
 * Whether the user's confirmed values differ from the retained extraction.
 * Used to record correction provenance so raw and confirmed stay separable
 * after the fact. The T09 evidence contract retains the name/quantity/unit
 * comparison; the ingested mapping stays readable on the scan line itself.
 */
/** The raw subset the T09 scan-evidence contract retains per line. */
export type RawScanLine = Pick<RawScanEvidence, 'rawName' | 'quantity' | 'unit'>;

export function correctionOf(raw: RawScanLine, confirmed: {
  name: string; quantity: number; unit: string;
}): { corrected: boolean; raw: RawScanLine } {
  const corrected = (raw.rawName !== null && raw.rawName !== confirmed.name)
    || (raw.quantity !== null && raw.quantity !== confirmed.quantity)
    || (raw.unit !== null && raw.unit !== confirmed.unit);
  return { corrected, raw: { rawName: raw.rawName, quantity: raw.quantity, unit: raw.unit } };
}

export function scanCorrectionLine(scanItemId: string | null, raw: RawScanLine,
  confirmed: InventoryScanEvidence['lines'][number]['confirmed']): InventoryScanEvidence['lines'][number] {
  return { scanItemId, ...correctionOf(raw, confirmed), confirmed };
}
