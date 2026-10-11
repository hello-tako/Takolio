import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import dataset from '../fixtures/scan-v3/dataset.json';
import { ScanV3DatasetSchema, contentHash } from '../../scripts/scan-v3-scoring';

describe('Scan V3 dataset evidence and split isolation', () => {
  it('labels every fixture TEST_ONLY and leaves human/asset evidence missing', () => {
    expect(ScanV3DatasetSchema.safeParse(dataset).success).toBe(true);
    for (const row of dataset.cases) {
      expect(row.assetKind).toBe('SYNTHETIC_SYMBOLIC');
      expect(row.annotation.status).toBe('TEST_ONLY');
      expect(row.annotation.reviewer).toBe('MISSING');
      expect(row.licenseReference).toBe('MISSING');
    }
    expect(JSON.stringify(dataset)).not.toMatch(/data:image|Bearer\s|sk-[A-Za-z0-9]/);
  });
  it.each(['sourceGroupId', 'documentId', 'assetSha256'] as const)('rejects cross-split reuse by %s', (key) => {
    const altered = structuredClone(dataset);
    altered.cases[1][key] = altered.cases[0][key];
    altered.cases[1].split = 'heldout';
    expect(ScanV3DatasetSchema.safeParse(altered).success).toBe(false);
  });
  it('rejects duplicate IDs, forged review evidence and contradictory fields', () => {
    const duplicate = structuredClone(dataset);
    duplicate.cases[1].caseId = duplicate.cases[0].caseId;
    expect(ScanV3DatasetSchema.safeParse(duplicate).success).toBe(false);
    const reviewed = structuredClone(dataset);
    reviewed.classification = 'REVIEW_CANDIDATE';
    reviewed.cases[0].annotation.status = 'ADJUDICATED';
    expect(ScanV3DatasetSchema.safeParse(reviewed).success).toBe(false);
    const contradictory = structuredClone(dataset);
    contradictory.cases[0].annotation.groundTruth.items[0].rawName = { state: 'unknown', reason: 'missing', value: 'Fabricated' } as never;
    expect(ScanV3DatasetSchema.safeParse(contradictory).success).toBe(false);
  });
  it('hashes object keys deterministically while binding array order', () => {
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
    expect(contentHash([1, 2])).not.toBe(contentHash([2, 1]));
  });
  it('rejects live mode before reading inputs or credentials', () => {
    let error: unknown;
    try { execFileSync(process.execPath, ['scripts/scan-v3-eval.mjs', '--live', '--dataset', '/nonexistent'], { encoding: 'utf8', stdio: 'pipe' }); }
    catch (caught) { error = caught; }
    expect(error).toMatchObject({ status: 2, stderr: expect.stringContaining('LIVE_EXECUTION_NOT_SUPPORTED') });
  });
});
