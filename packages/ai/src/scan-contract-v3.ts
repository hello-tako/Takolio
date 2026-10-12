import { z } from 'zod';
import { StandardUnitSchema } from './schemas';

const IdentifierSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const TextSchema = z.string().min(1).max(20_000).refine((value) => value.trim().length > 0, 'SCAN_V3_EMPTY_TEXT');
const PositionSchema = z.number().int().nonnegative().safe();

export const ScanV3UnknownReasonSchema = z.enum([
  'missing', 'unreadable', 'ambiguous', 'unsupported', 'not_observable', 'not_reported', 'unverified',
]);
export const ScanV3BasisSchema = z.enum([
  'source_extraction', 'visual_observation', 'user_review', 'certified_authority', 'evidence_conversion', 'model_report',
]);
export const ScanV3StatusSchema = z.enum(['SCHEMA_VALID', 'DRAFT', 'USABLE', 'CONFIRMABLE']);
export type ScanV3Status = z.infer<typeof ScanV3StatusSchema>;

const RegionSchema = z.object({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  width: z.number().finite().positive().max(1),
  height: z.number().finite().positive().max(1),
}).strict().superRefine((region, ctx) => {
  if (region.x + region.width > 1 || region.y + region.height > 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SCAN_V3_INVALID_REGION' });
  }
});
const SourceTextEvidenceSchema = z.object({
  kind: z.literal('source_text'),
  documentId: IdentifierSchema,
  sourcePosition: PositionSchema,
  text: TextSchema,
  start: PositionSchema.optional(),
  end: PositionSchema.optional(),
}).strict().superRefine((evidence, ctx) => {
  if ((evidence.start === undefined) !== (evidence.end === undefined)
      || (evidence.start !== undefined && evidence.end !== undefined && evidence.end <= evidence.start)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SCAN_V3_INVALID_TEXT_SPAN' });
  }
});
const SourceRegionEvidenceSchema = z.object({
  kind: z.literal('source_region'),
  documentId: IdentifierSchema,
  sourcePosition: PositionSchema,
  region: RegionSchema,
}).strict();
const UserReviewEvidenceSchema = z.object({
  kind: z.literal('user_review'),
  documentId: IdentifierSchema,
  sourcePosition: PositionSchema.optional(),
  reviewId: IdentifierSchema,
}).strict();
const CertifiedAuthorityEvidenceSchema = z.object({
  kind: z.literal('certified_authority'),
  authorityReleaseId: IdentifierSchema,
  canonicalId: IdentifierSchema,
}).strict();
const ConversionEvidenceSchema = z.object({
  kind: z.literal('conversion_reference'),
  documentId: IdentifierSchema,
  sourcePosition: PositionSchema,
  referenceId: IdentifierSchema,
}).strict();
const ModelReportEvidenceSchema = z.object({
  kind: z.literal('model_report'),
  documentId: IdentifierSchema,
  sourcePosition: PositionSchema.optional(),
  modelId: IdentifierSchema,
}).strict();

export const ScanV3EvidenceSchema = z.union([
  SourceTextEvidenceSchema, SourceRegionEvidenceSchema, UserReviewEvidenceSchema,
  CertifiedAuthorityEvidenceSchema, ConversionEvidenceSchema, ModelReportEvidenceSchema,
]);
export type ScanV3Evidence = z.infer<typeof ScanV3EvidenceSchema>;

export function scanV3FieldSchema<T extends z.ZodTypeAny>(
  valueSchema: T,
  allowedBases?: readonly z.infer<typeof ScanV3BasisSchema>[],
) {
  const known = z.object({
    state: z.literal('known'),
    value: valueSchema,
    basis: ScanV3BasisSchema,
    evidence: z.array(ScanV3EvidenceSchema).min(1),
  }).strict().superRefine((field, ctx) => {
    const has = (kind: ScanV3Evidence['kind']) => field.evidence.some((entry) => entry.kind === kind);
    const supported = field.basis === 'source_extraction' ? has('source_text') || has('source_region')
      : field.basis === 'visual_observation' ? has('source_region')
        : field.basis === 'user_review' ? has('user_review')
          : field.basis === 'certified_authority' ? has('certified_authority')
            : field.basis === 'evidence_conversion'
              ? has('conversion_reference') && has('user_review') && (has('source_text') || has('source_region'))
              : has('model_report');
    if (!supported || (allowedBases && !allowedBases.includes(field.basis))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SCAN_V3_EVIDENCE_BASIS_MISMATCH' });
    }
  });
  return z.union([
    known,
    z.object({ state: z.literal('unknown'), reason: ScanV3UnknownReasonSchema }).strict(),
  ]);
}
export type ScanV3Field<T> =
  | { state: 'known'; value: T; basis: z.infer<typeof ScanV3BasisSchema>; evidence: ScanV3Evidence[] }
  | { state: 'unknown'; reason: z.infer<typeof ScanV3UnknownReasonSchema> };

export const ScanV3MoneySchema = z.object({
  amountMinor: z.number().int().nonnegative().safe(),
  currency: z.enum(['VND', 'JPY']),
}).strict();
export type ScanV3Money = z.infer<typeof ScanV3MoneySchema>;
const TextBases = ['source_extraction', 'visual_observation', 'user_review'] as const;
const QuantityBases = ['source_extraction', 'visual_observation', 'user_review', 'evidence_conversion'] as const;
export const ScanV3MoneyFieldSchema = scanV3FieldSchema(ScanV3MoneySchema, ['source_extraction', 'user_review']);
export const ScanV3TextFieldSchema = scanV3FieldSchema(TextSchema, TextBases);
export const ScanV3QuantityBasisSchema = z.enum([
  'purchase_count', 'purchased_measure', 'package_content', 'observed_measure',
]);
export const ScanV3QuantitySchema = z.object({
  amount: scanV3FieldSchema(z.number().finite().positive(), QuantityBases),
  unit: scanV3FieldSchema(StandardUnitSchema, QuantityBases),
  basis: scanV3FieldSchema(ScanV3QuantityBasisSchema, QuantityBases),
  sourceText: scanV3FieldSchema(TextSchema, ['source_extraction', 'user_review']),
}).strict().superRefine((quantity, ctx) => {
  if (quantity.basis.state !== 'known' || quantity.unit.state !== 'known') return;
  const physical = ['g', 'kg', 'ml', 'l'].includes(quantity.unit.value);
  if ((quantity.basis.value === 'purchase_count' && physical)
      || (quantity.basis.value === 'purchased_measure' && !physical)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SCAN_V3_QUANTITY_BASIS_MISMATCH' });
  }
});
export type ScanV3Quantity = z.infer<typeof ScanV3QuantitySchema>;

const CanonicalFieldSchema = scanV3FieldSchema(IdentifierSchema).superRefine((field, ctx) => {
  if (field.state !== 'known') return;
  const references = field.evidence.filter((entry) => entry.kind === 'certified_authority');
  if (field.basis !== 'certified_authority' || field.value.startsWith('ING_ENR_')
      || references.length !== 1 || references[0]?.canonicalId !== field.value) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SCAN_V3_INVALID_AUTHORITY_REFERENCE' });
  }
});
const DateValueSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'SCAN_V3_INVALID_DATE');
const DateFieldSchema = scanV3FieldSchema(DateValueSchema, ['source_extraction', 'user_review']);
const ItemShape = {
  occurrenceId: IdentifierSchema,
  sourcePosition: PositionSchema,
  rawName: ScanV3TextFieldSchema,
  quantity: ScanV3QuantitySchema,
  canonicalId: CanonicalFieldSchema,
  confidence: scanV3FieldSchema(z.number().finite().min(0).max(1), ['source_extraction', 'user_review', 'model_report']),
  category: ScanV3TextFieldSchema,
  storage: scanV3FieldSchema(z.enum(['fridge', 'freezer', 'pantry']), TextBases),
};
export const ScanV3ItemSchema = z.object(ItemShape).strict();
export const ScanV3ReceiptItemSchema = z.object({
  ...ItemShape,
  unitPrice: ScanV3MoneyFieldSchema,
  lineTotal: ScanV3MoneyFieldSchema,
  tax: ScanV3MoneyFieldSchema,
  discount: ScanV3MoneyFieldSchema,
}).strict();
const EnvelopeShape = {
  schemaVersion: z.literal(3),
  document: z.object({ documentId: IdentifierSchema, sourceId: IdentifierSchema }).strict(),
};
export const ScanV3ReceiptSchema = z.object({
  ...EnvelopeShape,
  task: z.literal('receipt_ocr'),
  merchantName: ScanV3TextFieldSchema,
  invoiceNumber: ScanV3TextFieldSchema,
  purchaseDate: DateFieldSchema,
  totalAmount: ScanV3MoneyFieldSchema,
  tax: ScanV3MoneyFieldSchema,
  discount: ScanV3MoneyFieldSchema,
  items: z.array(ScanV3ReceiptItemSchema),
}).strict();
export const ScanV3LabelSchema = z.object({
  ...EnvelopeShape,
  task: z.literal('label_ocr'),
  productionDate: DateFieldSchema,
  expiryDate: DateFieldSchema,
  netQuantity: ScanV3QuantitySchema,
  items: z.array(ScanV3ItemSchema),
}).strict();
export const ScanV3FridgeSchema = z.object({
  ...EnvelopeShape,
  task: z.literal('fridge_image_analysis'),
  items: z.array(ScanV3ItemSchema),
}).strict();
const TaskSchema = z.discriminatedUnion('task', [ScanV3ReceiptSchema, ScanV3LabelSchema, ScanV3FridgeSchema]);
export type ScanV3 = z.infer<typeof TaskSchema>;
export type ScanV3Item = z.infer<typeof ScanV3ItemSchema>;
export type ScanV3ReceiptItem = z.infer<typeof ScanV3ReceiptItemSchema>;

function validateEvidenceBindings(value: unknown, documentId: string, position: number | undefined, ctx: z.RefinementCtx): void {
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (record.state === 'known' && Array.isArray(record.evidence)) {
    for (const evidence of record.evidence as ScanV3Evidence[]) {
      if (evidence.kind === 'certified_authority') continue;
      if (evidence.documentId !== documentId
          || (position !== undefined && evidence.sourcePosition !== undefined && evidence.sourcePosition !== position)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SCAN_V3_EVIDENCE_SOURCE_MISMATCH' });
      }
    }
    return;
  }
  for (const child of Object.values(record)) validateEvidenceBindings(child, documentId, position, ctx);
}

export const ScanV3Schema = TaskSchema.superRefine((scan, ctx) => {
  const occurrences = new Set<string>();
  let previousPosition = -1;
  for (const item of scan.items) {
    if (occurrences.has(item.occurrenceId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SCAN_V3_DUPLICATE_OCCURRENCE' });
    }
    occurrences.add(item.occurrenceId);
    if (item.sourcePosition < previousPosition) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SCAN_V3_UNORDERED_SOURCE_POSITIONS' });
    }
    previousPosition = item.sourcePosition;
    validateEvidenceBindings(item, scan.document.documentId, item.sourcePosition, ctx);
  }
  const { items: _items, ...documentFields } = scan;
  validateEvidenceBindings(documentFields, scan.document.documentId, undefined, ctx);
});

export type ScanV3ParseResult =
  | { ok: true; value: ScanV3 }
  | { ok: false; code: 'SCAN_V3_INVALID_CONTRACT' };
export function parseScanV3(input: unknown): ScanV3ParseResult {
  const parsed = ScanV3Schema.safeParse(input);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, code: 'SCAN_V3_INVALID_CONTRACT' };
}

export interface ScanV3Authority {
  releaseId: string;
  hasCanonicalId: (canonicalId: string) => boolean;
}
export const ScanV3ReadinessReasonSchema = z.enum([
  'empty_items', 'name_unresolved', 'quantity_unresolved', 'quantity_evidence_required',
  'package_content_not_purchase', 'quantity_basis_not_purchase', 'authority_unverified',
]);
export type ScanV3ReadinessReason = z.infer<typeof ScanV3ReadinessReasonSchema>;

function hasNameEvidence(field: ScanV3Item['rawName']): boolean {
  return field.state === 'known' && ['source_extraction', 'visual_observation', 'user_review'].includes(field.basis);
}
function hasQuantityEvidence(field: ScanV3Field<unknown>): boolean {
  if (field.state !== 'known') return false;
  if (field.basis === 'user_review' || field.basis === 'evidence_conversion') return true;
  return field.basis === 'source_extraction' && field.evidence.some((entry) => entry.kind === 'source_text');
}
export function scanV3ItemReadiness(item: ScanV3Item, authority?: ScanV3Authority): ScanV3ReadinessReason[] {
  const reasons: ScanV3ReadinessReason[] = [];
  if (!hasNameEvidence(item.rawName)) reasons.push('name_unresolved');
  const fields = [item.quantity.amount, item.quantity.unit, item.quantity.basis];
  if (fields.some((field) => field.state !== 'known')) reasons.push('quantity_unresolved');
  else if (fields.some((field) => !hasQuantityEvidence(field))) reasons.push('quantity_evidence_required');
  if (item.quantity.basis.state === 'known' && item.quantity.basis.value === 'package_content') {
    reasons.push('package_content_not_purchase');
  }
  if (item.canonicalId.state === 'known') {
    const reference = item.canonicalId.evidence.find((entry) => entry.kind === 'certified_authority');
    let verified = false;
    try {
      verified = reference?.kind === 'certified_authority' && authority !== undefined
        && authority.releaseId === reference.authorityReleaseId && authority.hasCanonicalId(item.canonicalId.value) === true;
    } catch {
      verified = false;
    }
    if (!verified) reasons.push('authority_unverified');
  }
  return reasons;
}
export type ScanV3Assessment =
  | { ok: true; scan: ScanV3; status: ScanV3Status; reasons: ScanV3ReadinessReason[] }
  | { ok: false; code: 'SCAN_V3_INVALID_CONTRACT' };
export function assessScanV3(input: unknown, authority?: ScanV3Authority): ScanV3Assessment {
  const parsed = parseScanV3(input);
  if (!parsed.ok) return parsed;
  const scan = parsed.value;
  const reasons = [...new Set(scan.items.flatMap((item) => scanV3ItemReadiness(item, authority)))];
  if (scan.task === 'receipt_ocr' && scan.items.some((item) => item.quantity.basis.state === 'known'
      && item.quantity.basis.value === 'observed_measure')) reasons.push('quantity_basis_not_purchase');
  if (scan.items.length === 0) return { ok: true, scan, status: 'SCHEMA_VALID', reasons: ['empty_items'] };
  const status: ScanV3Status = reasons.includes('name_unresolved') || reasons.includes('package_content_not_purchase')
    || reasons.includes('quantity_basis_not_purchase') ? 'DRAFT'
    : reasons.length > 0 ? 'USABLE' : 'CONFIRMABLE';
  return { ok: true, scan, status, reasons };
}
