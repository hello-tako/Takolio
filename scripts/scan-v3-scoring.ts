import { createHash } from 'node:crypto';
import { z } from 'zod';
import { assessScanV3, parseScanV3, ScanV3Schema, type ScanV3 } from '../packages/ai/src/scan-contract-v3';

export const EVALUATOR_VERSION = 'scan-v3-offline-1';
const Id = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Tasks = z.enum(['receipt_ocr', 'label_ocr', 'fridge_image_analysis']);
const MissingOrText = z.union([z.literal('MISSING'), z.string().min(1).max(512)]);
const Annotation = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(['TEST_ONLY', 'MISSING', 'INDEPENDENT_REVIEWED', 'ADJUDICATED']),
  reviewer: MissingOrText,
  adjudicator: MissingOrText,
  transcriptSha256: z.union([Hash, z.literal('MISSING')]),
  providerOutputIndependent: z.boolean(),
  groundTruth: ScanV3Schema,
}).strict();
export const ScanV3DatasetSchema = z.object({
  schemaVersion: z.literal(1),
  datasetId: Id,
  classification: z.enum(['TEST_ONLY', 'REVIEW_CANDIDATE']),
  cases: z.array(z.object({
    caseId: Id, assetId: Id, documentId: Id, sourceGroupId: Id,
    task: Tasks, locale: z.enum(['vi', 'ja', 'en']), country: z.enum(['VN', 'JP', 'OTHER']),
    quality: z.enum(['clean', 'blur', 'tilt', 'low_light', 'missing_field', 'damaged']),
    split: z.enum(['calibration', 'heldout', 'adversarial']),
    assetSha256: Hash, preprocessingSha256: Hash, preprocessingVersion: Id,
    assetKind: z.enum(['SYNTHETIC_SYMBOLIC', 'LICENSED_IMAGE']),
    provenance: MissingOrText, licenseReference: MissingOrText, permissionReference: MissingOrText,
    retentionPolicy: MissingOrText, accessPolicy: MissingOrText,
    redactionStatus: z.enum(['SYNTHETIC_NO_PII', 'VERIFIED_REDACTED', 'MISSING']),
    annotation: Annotation,
  }).strict()).min(1),
}).strict().superRefine((dataset, ctx) => {
  const ids = new Set<string>();
  const assets = new Set<string>();
  const groups = new Map<string, string>();
  for (const entry of dataset.cases) {
    if (ids.has(entry.caseId) || assets.has(entry.assetId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'DUPLICATE_CASE_OR_ASSET' });
    }
    ids.add(entry.caseId); assets.add(entry.assetId);
    // Hashes also fence accidental reuse under a different document/source ID.
    for (const key of [`source:${entry.sourceGroupId}`, `document:${entry.documentId}`, `asset:${entry.assetSha256}`]) {
      const previous = groups.get(key);
      if (previous && previous !== entry.split) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'DOCUMENT_SPLIT_LEAKAGE' });
      }
      groups.set(key, entry.split);
    }
    if (entry.task !== entry.annotation.groundTruth.task
        || entry.documentId !== entry.annotation.groundTruth.document.documentId
        || entry.sourceGroupId !== entry.annotation.groundTruth.document.sourceId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ANNOTATION_BINDING_MISMATCH' });
    }
    if (dataset.classification === 'TEST_ONLY' && (entry.assetKind !== 'SYNTHETIC_SYMBOLIC'
        || entry.annotation.status !== 'TEST_ONLY')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'TEST_ONLY_CLASSIFICATION_MISMATCH' });
    }
    if (['INDEPENDENT_REVIEWED', 'ADJUDICATED'].includes(entry.annotation.status)
        && (entry.annotation.reviewer === 'MISSING' || entry.annotation.transcriptSha256 === 'MISSING'
          || !entry.annotation.providerOutputIndependent
          || (entry.annotation.status === 'ADJUDICATED' && entry.annotation.adjudicator === 'MISSING'))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'REVIEW_EVIDENCE_MISSING' });
    }
  }
});
export type ScanV3Dataset = z.infer<typeof ScanV3DatasetSchema>;

const Attempt = z.object({
  kind: z.enum(['primary', 'repair', 'retry', 'shadow']),
  status: z.enum(['output', 'timeout', 'missing', 'provider_error']),
  output: z.unknown().optional(),
  providerMs: z.number().finite().nonnegative().optional(),
  costUsdMicros: z.number().int().safe().nonnegative().nullable(),
  costBasis: z.enum(['ESTIMATED', 'BILLED', 'UNKNOWN']),
  pricingVersion: MissingOrText,
}).strict().superRefine((attempt, ctx) => {
  if ((attempt.costBasis === 'UNKNOWN') !== (attempt.costUsdMicros === null)
      || (attempt.costBasis !== 'UNKNOWN' && attempt.pricingVersion === 'MISSING')
      || (attempt.status !== 'output' && attempt.output !== undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ATTEMPT_EVIDENCE_MISMATCH' });
  }
});
export const ScanV3PredictionsSchema = z.object({
  schemaVersion: z.literal(1),
  datasetId: Id,
  submissions: z.array(z.object({
    caseId: Id,
    finalAttempt: z.number().int().nonnegative().safe(),
    attempts: z.array(Attempt).min(1),
    queueWaitMs: z.number().finite().nonnegative().optional(),
    endToEndMs: z.number().finite().nonnegative().optional(),
  }).strict().superRefine((submission, ctx) => {
    if (submission.finalAttempt >= submission.attempts.length
        || submission.attempts[submission.finalAttempt]?.kind === 'shadow') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'INVALID_FINAL_ATTEMPT' });
    }
  })),
}).strict();
export type ScanV3Predictions = z.infer<typeof ScanV3PredictionsSchema>;

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export const contentHash = (value: unknown): string => createHash('sha256').update(stableJson(value)).digest('hex');
export function wilson95(observed: number, sampleSize: number) {
  if (sampleSize === 0) return null;
  const zValue = 1.959963984540054;
  const p = observed / sampleSize;
  const denominator = 1 + zValue * zValue / sampleSize;
  const center = (p + zValue * zValue / (2 * sampleSize)) / denominator;
  const half = zValue * Math.sqrt(p * (1 - p) / sampleSize + zValue * zValue / (4 * sampleSize * sampleSize)) / denominator;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}
const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : null;
type Field = { state: 'known'; value: unknown } | { state: 'unknown' };
function indexedItems(scan: ScanV3) {
  const positions = new Map<number, number>();
  return new Map(scan.items.map((item) => {
    const ordinal = positions.get(item.sourcePosition) ?? 0;
    positions.set(item.sourcePosition, ordinal + 1);
    return [`${item.sourcePosition}:${ordinal}`, item] as const;
  }));
}
function fields(scan: ScanV3): Map<string, Field> {
  const result = new Map<string, Field>();
  function visit(value: unknown, key: string) {
    if (!value || typeof value !== 'object') return;
    const row = value as Record<string, unknown>;
    if (row.state === 'known' || row.state === 'unknown') {
      result.set(key, row as Field);
      return;
    }
    for (const [name, child] of Object.entries(row)) {
      if (name === 'items' || name === 'document' || name === 'schemaVersion' || name === 'task') continue;
      visit(child, key ? `${key}.${name}` : name);
    }
  }
  visit(scan, 'document');
  for (const [key, item] of indexedItems(scan)) visit(item, `item:${key}`);
  return result;
}
function textDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, previous[j] + 1,
      previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = next;
  }
  return previous[b.length];
}
function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

export function scoreScanV3(datasetInput: unknown, predictionsInput: unknown) {
  const datasetParsed = ScanV3DatasetSchema.safeParse(datasetInput);
  const predictionsParsed = ScanV3PredictionsSchema.safeParse(predictionsInput);
  if (!datasetParsed.success || !predictionsParsed.success) throw new Error('SCAN_V3_EVALUATOR_INVALID_INPUT');
  const dataset = datasetParsed.data;
  const predictions = predictionsParsed.data;
  if (dataset.datasetId !== predictions.datasetId) throw new Error('SCAN_V3_EVALUATOR_DATASET_MISMATCH');
  const caseIds = new Set(dataset.cases.map((entry) => entry.caseId));
  const byId = new Map<string, ScanV3Predictions['submissions'][number]>();
  for (const submission of predictions.submissions) {
    if (!caseIds.has(submission.caseId) || byId.has(submission.caseId)) throw new Error('SCAN_V3_EVALUATOR_SUBMISSION_MISMATCH');
    byId.set(submission.caseId, submission);
  }
  const outcomes = dataset.cases.map((entry) => {
    const submission = byId.get(entry.caseId);
    const first = submission?.attempts.find((attempt) => attempt.kind !== 'shadow');
    const final = submission?.attempts[submission.finalAttempt];
    const parseOutput = (attempt: typeof final) => {
      if (attempt?.status !== 'output') return undefined;
      const parsed = parseScanV3(attempt.output);
      return parsed.ok && parsed.value.task === entry.task
        && parsed.value.document.documentId === entry.documentId
        && parsed.value.document.sourceId === entry.sourceGroupId ? parsed.value : undefined;
    };
    const output = parseOutput(final);
    const expectedFields = fields(entry.annotation.groundTruth);
    const outputFields = output ? fields(output) : new Map<string, Field>();
    let knownExpected = 0, knownPredicted = 0, correct = 0, unknownSlots = 0, hallucinations = 0, unassessedUnknown = 0;
    let canonicalExpected = 0, canonicalAccepted = 0, canonicalCorrect = 0, canonicalSlots = 0;
    let textEdits = 0, textChars = 0, moneyExpected = 0, moneyCorrect = 0, abstainedKnown = 0;
    for (const [key, expected] of expectedFields) {
      const predicted = outputFields.get(key);
      if (expected.state === 'unknown') {
        unknownSlots++;
        if (!predicted) unassessedUnknown++;
        if (predicted?.state === 'known') hallucinations++;
      } else {
        knownExpected++;
        if (predicted?.state !== 'known') abstainedKnown++;
        if (expected.value && typeof expected.value === 'object' && 'amountMinor' in expected.value) {
          moneyExpected++;
          if (predicted?.state === 'known' && stableJson(predicted.value) === stableJson(expected.value)) moneyCorrect++;
        }
        if (predicted?.state === 'known' && stableJson(predicted.value) === stableJson(expected.value)) correct++;
        if (key.endsWith('.rawName') && typeof expected.value === 'string') {
          const predictedText = predicted?.state === 'known' && typeof predicted.value === 'string' ? predicted.value : '';
          textEdits += textDistance(expected.value, predictedText); textChars += expected.value.length;
        }
      }
      if (key.endsWith('.canonicalId')) {
        canonicalSlots++;
        if (expected.state === 'known') canonicalExpected++;
      }
    }
    for (const [key, predicted] of outputFields) {
      if (predicted.state !== 'known') continue;
      knownPredicted++;
      if (key.endsWith('.canonicalId')) {
        canonicalAccepted++;
        const expected = expectedFields.get(key);
        if (expected?.state === 'known' && predicted.value === expected.value) canonicalCorrect++;
      }
    }
    const expectedItems = indexedItems(entry.annotation.groundTruth);
    const actualItems = output ? indexedItems(output) : new Map<string, ScanV3['items'][number]>();
    const expectedOccurrences = new Set(expectedItems.keys());
    const predictedOccurrences = new Set(actualItems.keys());
    const matchedOccurrences = [...expectedOccurrences].filter((key) => predictedOccurrences.has(key)).length;
    const quantityExact = [...expectedItems].filter(([key, item]) => {
      const actual = actualItems.get(key);
      return actual && ['amount', 'unit', 'basis'].every((key) => {
        const field = item.quantity[key as 'amount' | 'unit' | 'basis'];
        const candidate = actual.quantity[key as 'amount' | 'unit' | 'basis'];
        return field.state === candidate.state && (field.state === 'unknown'
          || (candidate.state === 'known' && stableJson(field.value) === stableJson(candidate.value)));
      });
    }).length;
    const readiness = output ? assessScanV3(output) : undefined;
    const usable = Boolean(readiness?.ok && ['USABLE', 'CONFIRMABLE'].includes(readiness.status));
    return { caseId: entry.caseId, documentId: entry.documentId, task: entry.task, locale: entry.locale, quality: entry.quality,
      firstSchemaPass: Boolean(parseOutput(first)), finalSchemaPass: Boolean(output), usable,
      outcome: output ? 'schema_valid' : final?.status === 'output' ? 'malformed' : final?.status ?? 'missing',
      knownExpected, knownPredicted, correct, unknownSlots, hallucinations, unassessedUnknown,
      canonicalExpected, canonicalAccepted, canonicalCorrect, canonicalSlots, textEdits, textChars,
      moneyExpected, moneyCorrect, abstainedKnown,
      expectedOccurrences: expectedOccurrences.size, predictedOccurrences: predictedOccurrences.size, matchedOccurrences,
      quantityExact, quantityOccurrences: expectedOccurrences.size };
  }).sort((a, b) => a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0);
  function aggregate(rows: typeof outcomes) {
    const sum = (key: keyof typeof outcomes[number]) => rows.reduce((total, row) => total + Number(row[key]), 0);
    const unknownSlots = sum('unknownSlots'), hallucinations = sum('hallucinations');
    const documentResults = new Map<string, boolean>();
    for (const row of rows) if (row.unknownSlots) documentResults.set(row.documentId,
      Boolean(documentResults.get(row.documentId) || row.hallucinations));
    const hallucinatingDocuments = [...documentResults.values()].filter(Boolean).length;
    return { submissions: rows.length, documents: new Set(rows.map((row) => row.documentId)).size,
      firstSchemaPass: sum('firstSchemaPass'), finalSchemaPass: sum('finalSchemaPass'), usableSuccesses: sum('usable'),
      fieldPrecision: ratio(sum('correct'), sum('knownPredicted')), fieldRecall: ratio(sum('correct'), sum('knownExpected')),
      canonicalAccepted: sum('canonicalAccepted'), canonicalExpected: sum('canonicalExpected'),
      canonicalPrecision: ratio(sum('canonicalCorrect'), sum('canonicalAccepted')),
      canonicalCoverage: ratio(sum('canonicalAccepted'), sum('canonicalSlots')),
      canonicalKnownRecall: ratio(sum('canonicalCorrect'), sum('canonicalExpected')),
      moneyExact: { correct: sum('moneyCorrect'), expected: sum('moneyExpected'), recall: ratio(sum('moneyCorrect'), sum('moneyExpected')) },
      abstainedKnown: sum('abstainedKnown'),
      failureRate: ratio(rows.filter((row) => !row.finalSchemaPass).length, rows.length),
      failureCounts: Object.fromEntries(['timeout', 'missing', 'malformed', 'provider_error'].map((key) =>
        [key, rows.filter((row) => row.outcome === key).length])),
      occurrencePrecision: ratio(sum('matchedOccurrences'), sum('predictedOccurrences')),
      occurrenceRecall: ratio(sum('matchedOccurrences'), sum('expectedOccurrences')),
      quantityExactOccurrences: sum('quantityExact'), quantityOccurrences: sum('quantityOccurrences'),
      nameCharacterErrorRate: ratio(sum('textEdits'), sum('textChars')),
      unknown: { slots: unknownSlots, assertedKnown: hallucinations, unassessedSlots: sum('unassessedUnknown'),
        assessment: sum('unassessedUnknown') > 0 ? 'INCONCLUSIVE_MISSING_FIELDS' : 'FULLY_ASSESSED',
        rate: ratio(hallucinations, unknownSlots),
        slotWilson95: wilson95(hallucinations, unknownSlots), slotIntervalInterpretation: 'DESCRIPTIVE_CORRELATED_FIELDS',
        documents: documentResults.size, hallucinatingDocuments,
        documentWilson95: wilson95(hallucinatingDocuments, documentResults.size) } };
  }
  const total = aggregate(outcomes);
  const sliceKeys = [...new Set(outcomes.map((row) => `${row.task}/${row.locale}/${row.quality}`))].sort();
  const attempts = predictions.submissions.flatMap((submission) => submission.attempts);
  const knownCostUsdMicros = attempts.reduce((totalCost, attempt) => totalCost + (attempt.costUsdMicros ?? 0), 0);
  if (!Number.isSafeInteger(knownCostUsdMicros)) throw new Error('SCAN_V3_EVALUATOR_COST_OVERFLOW');
  const unknownCostAttempts = attempts.filter((attempt) => attempt.costUsdMicros === null).length;
  const missingCostJobs = dataset.cases.length - byId.size;
  const costsComputable = total.usableSuccesses > 0 && unknownCostAttempts === 0 && missingCostJobs === 0;
  const timing = (values: number[]) => ({ samples: values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95) });
  const blockers = new Set<string>(['PILOT_SIZE_AND_THRESHOLDS_NOT_CERTIFIED', 'PROVIDER_QUALITY_NOT_CERTIFIED']);
  if (dataset.classification === 'TEST_ONLY') blockers.add('SYNTHETIC_TEST_ONLY');
  for (const entry of dataset.cases) {
    if (entry.assetKind !== 'LICENSED_IMAGE' || ['provenance', 'licenseReference', 'permissionReference', 'retentionPolicy', 'accessPolicy']
      .some((key) => entry[key as 'provenance'] === 'MISSING') || entry.redactionStatus !== 'VERIFIED_REDACTED') blockers.add('ASSET_EVIDENCE_INCOMPLETE');
    if (entry.annotation.status !== 'ADJUDICATED' || !entry.annotation.providerOutputIndependent) blockers.add('HUMAN_LABELS_INCOMPLETE');
  }
  return { evaluatorVersion: EVALUATOR_VERSION, datasetId: dataset.datasetId,
    datasetContentSha256: contentHash(datasetInput), predictionsContentSha256: contentHash(predictionsInput),
    mode: 'OFFLINE', certification: 'NOT_CERTIFIED', blockers: [...blockers].sort(), total,
    slices: sliceKeys.map((key) => ({ key, ...aggregate(outcomes.filter((row) => `${row.task}/${row.locale}/${row.quality}` === key)) })),
    cost: { attempts: attempts.length, knownCostUsdMicros, unknownCostAttempts, missingCostJobs,
      costUsdMicrosPer100Successes: costsComputable ? knownCostUsdMicros * 100 / total.usableSuccesses : null,
      status: costsComputable ? 'COMPUTABLE_FROM_SUPPLIED_EVIDENCE' : 'NOT_COMPUTABLE',
      bases: [...new Set(attempts.map((attempt) => attempt.costBasis))].sort(),
      pricingVersions: [...new Set(attempts.map((attempt) => attempt.pricingVersion))].sort() },
    latency: { queueWait: timing(predictions.submissions.flatMap((row) => row.queueWaitMs === undefined ? [] : [row.queueWaitMs])),
      provider: timing(attempts.flatMap((row) => row.providerMs === undefined ? [] : [row.providerMs])),
      endToEnd: timing(predictions.submissions.flatMap((row) => row.endToEndMs === undefined ? [] : [row.endToEndMs])) },
    outcomes };
}
