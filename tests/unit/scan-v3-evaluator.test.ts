import { describe, expect, it } from 'vitest';
import dataset from '../fixtures/scan-v3/dataset.json';
import predictions from '../fixtures/scan-v3/predictions.json';
import { scoreScanV3, wilson95, ScanV3PredictionsSchema } from '../../scripts/scan-v3-scoring';

const run = () => scoreScanV3(dataset, predictions);
describe('Scan V3 offline scoring', () => {
  it('keeps missing, malformed and timeout submissions in every schema denominator', () => {
    const report = run();
    expect(report.total.submissions).toBe(9);
    expect(report.total.firstSchemaPass).toBe(5);
    expect(report.total.finalSchemaPass).toBe(6);
    expect(report.outcomes.find((row) => row.caseId === 'missing-output')?.outcome).toBe('missing');
    expect(report.outcomes.find((row) => row.caseId === 'label-invalid')?.outcome).toBe('malformed');
    expect(report.outcomes.find((row) => row.caseId === 'damaged-timeout')?.outcome).toBe('timeout');
  });
  it('scores currency along with amount and never converts JPY to VND', () => {
    const exact = ScanV3PredictionsSchema.parse(structuredClone(predictions));
    const entry = exact.submissions.find((row) => row.caseId === 'receipt-jpy')!;
    const truth = dataset.cases.find((row) => row.caseId === 'receipt-jpy')!;
    entry.attempts[0] = { ...entry.attempts[0], output: structuredClone(truth.annotation.groundTruth) };
    expect(scoreScanV3(dataset, exact).total.fieldRecall).toBeGreaterThan(run().total.fieldRecall!);
  });
  it('retains identical purchase occurrences and penalizes collapsed extraction', () => {
    const row = run().outcomes.find((entry) => entry.caseId === 'duplicate-lines')!;
    expect(row.expectedOccurrences).toBe(2);
    expect(row.matchedOccurrences).toBe(1);
    expect(row.quantityOccurrences).toBe(2);
    expect(row.quantityExact).toBe(1);
  });
  it('cannot hide UNKNOWN hallucinations by renaming provider occurrence IDs', () => {
    const changed = ScanV3PredictionsSchema.parse(structuredClone(predictions));
    for (const row of changed.submissions) for (const attempt of row.attempts) {
      if (attempt.output && typeof attempt.output === 'object' && 'items' in attempt.output) {
        for (const item of (attempt.output as { items: Array<{ occurrenceId: string }> }).items) item.occurrenceId = `renamed-${item.occurrenceId}`;
      }
    }
    expect(scoreScanV3(dataset, changed).total.unknown.assertedKnown).toBe(1);
    expect(scoreScanV3(dataset, changed).total.occurrenceRecall).toBe(run().total.occurrenceRecall);
    expect(run().total.unknown.assessment).toBe('INCONCLUSIVE_MISSING_FIELDS');
  });
  it('reports UNKNOWN hallucinations, correlated slots and document uncertainty', () => {
    const report = run();
    expect(report.total.unknown.assertedKnown).toBe(1);
    expect(report.total.unknown.slots).toBeGreaterThan(1);
    expect(report.total.unknown.documents).toBe(9);
    expect(report.total.unknown.hallucinatingDocuments).toBe(1);
    expect(wilson95(0, 20)?.[1]).toBeGreaterThan(0);
    expect(wilson95(0, 0)).toBeNull();
  });
  it('counts repair/retry/shadow spend without treating zero success as zero cost', () => {
    const report = run();
    expect(report.cost.knownCostUsdMicros).toBe(925);
    expect(report.cost.attempts).toBe(10);
    expect(report.cost.missingCostJobs).toBe(1);
    expect(report.cost.costUsdMicrosPer100Successes).toBeNull();
    const completeEvidence = { ...predictions, submissions: [...predictions.submissions, { caseId: 'missing-output',
      finalAttempt: 0, attempts: [{ kind: 'primary', status: 'missing', costUsdMicros: 0,
        costBasis: 'ESTIMATED', pricingVersion: 'synthetic-price-v1' }] }] };
    expect(scoreScanV3(dataset, completeEvidence).cost.costUsdMicrosPer100Successes).toBe(925 * 100 / 5);
    const failed = { ...predictions, submissions: [] };
    expect(scoreScanV3(dataset, failed).cost.status).toBe('NOT_COMPUTABLE');
    expect(scoreScanV3(dataset, failed).cost.costUsdMicrosPer100Successes).toBeNull();
  });
  it('never infers missing billing evidence and separates latency denominators', () => {
    const unknownCost = structuredClone(predictions);
    const attempt = unknownCost.submissions[0].attempts[0];
    const report = scoreScanV3(dataset, { ...unknownCost, submissions: [{ ...unknownCost.submissions[0],
      attempts: [{ ...attempt, costBasis: 'UNKNOWN', costUsdMicros: null, pricingVersion: 'MISSING' }] }] });
    expect(report.cost.unknownCostAttempts).toBe(1);
    expect(report.cost.costUsdMicrosPer100Successes).toBeNull();
    expect(report.latency.queueWait.samples).toBe(1);
    expect(report.latency.provider.samples).toBe(1);
    expect(report.total.submissions).toBe(9);
  });
  it('rejects duplicate/unexpected submissions and shadow publication', () => {
    expect(() => scoreScanV3(dataset, { ...predictions, submissions: [predictions.submissions[0], predictions.submissions[0]] })).toThrow('SUBMISSION_MISMATCH');
    expect(() => scoreScanV3(dataset, { ...predictions, submissions: [{ ...predictions.submissions[0], caseId: 'foreign-case' }] })).toThrow('SUBMISSION_MISMATCH');
    expect(() => scoreScanV3(dataset, { ...predictions, submissions: [{ ...predictions.submissions[0], attempts: [{ ...predictions.submissions[0].attempts[0], kind: 'shadow' }] }] })).toThrow('INVALID_INPUT');
  });
  it('produces deterministic reports across case and submission ordering', () => {
    const a = run();
    const b = scoreScanV3({ ...dataset, cases: [...dataset.cases].reverse() }, { ...predictions, submissions: [...predictions.submissions].reverse() });
    expect(a.total).toEqual(b.total);
    expect(a.outcomes).toEqual(b.outcomes);
    expect(a.slices).toEqual(b.slices);
    expect(run()).toEqual(run());
    expect(a.certification).toBe('NOT_CERTIFIED');
  });
});
