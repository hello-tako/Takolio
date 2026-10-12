import { z } from 'zod';
import { ReceiptScanResultSchema, VisionScanResultSchema } from './schemas';
import { ScanV3Schema, type ScanV3 } from './scan-contract-v3';

const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const commonJob = {
  jobId: id.optional(), scanId: id, userId: id, householdId: id,
  imageBase64: z.string().optional(), imageKey: z.string().optional(), mimeType: z.string().optional(),
  idempotencyKey: id.optional(), requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
};
const legacyJob = z.object({ ...commonJob, type: z.literal('scan.process.v1'),
  schemaVersion: z.literal(1).optional(), scanType: z.enum(['fridge', 'food', 'receipt']).optional() }).passthrough();
const candidateJob = z.object({ ...commonJob, type: z.literal('scan.process.v3'), schemaVersion: z.literal(3),
  task: z.enum(['receipt_ocr', 'label_ocr', 'fridge_image_analysis']), requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export type ScanJobEnvelope =
  | { version: 1; message: z.infer<typeof legacyJob> }
  | { version: 3; message: z.infer<typeof candidateJob> };
export type ScanEnvelopeFailure = { ok: false; code: 'SCAN_ENVELOPE_INVALID' | 'SCAN_ENVELOPE_VERSION_UNSUPPORTED' };

export function readScanJobEnvelope(input: unknown): { ok: true; envelope: ScanJobEnvelope } | ScanEnvelopeFailure {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, code: 'SCAN_ENVELOPE_INVALID' };
  const value = input as Record<string, unknown>;
  const version = value.schemaVersion ?? (value.type === 'scan.process.v1' ? 1 : undefined);
  if (version !== 1 && version !== 3) return { ok: false, code: 'SCAN_ENVELOPE_VERSION_UNSUPPORTED' };
  if (version === 1) {
    // A task discriminator belongs to the versioned V3 shape, never legacy routing.
    if ('task' in value) return { ok: false, code: 'SCAN_ENVELOPE_INVALID' };
    const parsed = legacyJob.safeParse(value);
    return parsed.success ? { ok: true, envelope: { version, message: parsed.data } }
      : { ok: false, code: 'SCAN_ENVELOPE_INVALID' };
  }
  const parsed = candidateJob.safeParse(value);
  return parsed.success ? { ok: true, envelope: { version, message: parsed.data } }
    : { ok: false, code: 'SCAN_ENVELOPE_INVALID' };
}

export type ScanResultEnvelope =
  | { version: 1; task: 'receipt_ocr'; result: z.input<typeof ReceiptScanResultSchema> }
  | { version: 1; task: 'fridge_image_analysis'; result: z.input<typeof VisionScanResultSchema> }
  | { version: 3; task: ScanV3['task']; result: ScanV3 };
export function readScanResultEnvelope(input: unknown, legacyTask?: 'receipt_ocr' | 'fridge_image_analysis'):
  { ok: true; envelope: ScanResultEnvelope } | ScanEnvelopeFailure {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, code: 'SCAN_ENVELOPE_INVALID' };
  const value = input as Record<string, unknown>;
  if (value.schemaVersion === 3) {
    const parsed = ScanV3Schema.safeParse(input);
    return parsed.success ? { ok: true, envelope: { version: 3, task: parsed.data.task, result: parsed.data } }
      : { ok: false, code: 'SCAN_ENVELOPE_INVALID' };
  }
  if (value.schemaVersion !== undefined) return { ok: false, code: 'SCAN_ENVELOPE_VERSION_UNSUPPORTED' };
  // No guessing receipt/label routing from overlapping item fields.
  if (legacyTask === 'receipt_ocr' && ReceiptScanResultSchema.safeParse(input).success) {
    return { ok: true, envelope: { version: 1, task: legacyTask, result: input as z.input<typeof ReceiptScanResultSchema> } };
  }
  if (legacyTask === 'fridge_image_analysis' && VisionScanResultSchema.safeParse(input).success) {
    return { ok: true, envelope: { version: 1, task: legacyTask, result: input as z.input<typeof VisionScanResultSchema> } };
  }
  return { ok: false, code: 'SCAN_ENVELOPE_INVALID' };
}

export function negotiateScanContract(header: string | undefined):
  { ok: true; version: 1 } | { ok: false; status: 400 | 409; code: 'SCAN_CONTRACT_VERSION_UNSUPPORTED' | 'SCAN_CONTRACT_NOT_ENABLED' } {
  if (header === undefined || header === '1') return { ok: true, version: 1 };
  if (header === '3') return { ok: false, status: 409, code: 'SCAN_CONTRACT_NOT_ENABLED' };
  return { ok: false, status: 400, code: 'SCAN_CONTRACT_VERSION_UNSUPPORTED' };
}
