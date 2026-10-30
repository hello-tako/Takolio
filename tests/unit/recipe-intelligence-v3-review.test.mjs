import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkV3ReviewRecord } from '../../scripts/recipe-intelligence-v3-review.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'takolio-review-record-'));
const candidatePath = 'data/recipe-intelligence/v3/candidates.json';
const evidencePath = 'docs/review-evidence.json';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const candidates = { schemaVersion: 3, compilerVersion: 1, program: 'TAKOLIO_RECIPE_INTELLIGENCE_V3', runtimePromotionAllowed: false,
  recipes: Array.from({ length: 500 }, (_, index) => ({ recipeId: `synthetic-${index}`, candidateContentFingerprint: hash(String(index)),
    requiredReviewActions: ['FOOD_SAFETY', 'SOURCE_CONTENT'] })) };
mkdirSync(path.dirname(path.join(root, candidatePath)), { recursive: true });
mkdirSync(path.join(root, 'docs'));
writeFileSync(path.join(root, candidatePath), JSON.stringify(candidates));
writeFileSync(path.join(root, evidencePath), JSON.stringify({ decision: 'synthetic test evidence', facts: [false, null, 0], 'escaped/key': { '~': true } }));
const evidence = { path: evidencePath, sha256: hash(readFileSync(path.join(root, evidencePath))), pointer: '/facts/0' };
const review = (index = 0) => ({ recipeId: `synthetic-${index}`, candidateContentFingerprint: candidates.recipes[index].candidateContentFingerprint,
  reviewerIdentity: 'Synthetic reviewer; fixture only', decidedAt: '2026-10-30T12:00:00Z', decision: 'APPROVE', decisionEvidence: evidence,
  riskDispositions: candidates.recipes[index].requiredReviewActions.map((action) => ({ action, disposition: 'RESOLVED',
    rationale: 'Synthetic fixture only; no actual recipe approval.', evidenceReferences: [evidence] })) });
const record = () => ({ schemaVersion: 1, candidateArtifactSha256: hash(readFileSync(path.join(root, candidatePath))), reviews: [structuredClone(review())] });
const check = (value) => checkV3ReviewRecord(value, root, Date.parse('2026-10-30T13:00:00Z'));
afterAll(() => rmSync(root, { recursive: true }));

describe('offline V3 review records', () => {
  it('binds partial decisions without promoting or claiming complete approval', () => {
    const before = readFileSync(path.join(root, candidatePath));
    expect(check(record())).toEqual({ formatValid: true, recipesTotal: 500, decisionsRecorded: 1, approvedDecisionsRecorded: 1,
      recipesWithoutApproval: 499, completeReviewRecorded: false, runtimePromotionAllowed: false });
    expect(readFileSync(path.join(root, candidatePath))).toEqual(before);
  });

  it('counts complete synthetic records while keeping runtime promotion disabled', () => {
    const input = record();
    input.reviews = Array.from({ length: 500 }, (_, index) => review(index));
    expect(check(input)).toMatchObject({ completeReviewRecorded: true, approvedDecisionsRecorded: 500, runtimePromotionAllowed: false });
  });

  it('retains negative decisions and open risks without counting approvals', () => {
    for (const decision of ['REQUEST_CHANGES', 'REJECT']) {
      const input = record(); input.reviews[0].decision = decision; input.reviews[0].riskDispositions[0].disposition = 'OPEN';
      expect(check(input)).toMatchObject({ decisionsRecorded: 1, approvedDecisionsRecorded: 0, completeReviewRecorded: false });
    }
  });

  it.each([
    ['artifact hash', (r) => { r.candidateArtifactSha256 = '0'.repeat(64); }, 'REVIEW_CANDIDATE_ARTIFACT_STALE'],
    ['content hash', (r) => { r.reviews[0].candidateContentFingerprint = '0'.repeat(64); }, 'REVIEW_CONTENT_STALE'],
    ['duplicate recipe', (r) => { r.reviews.push(structuredClone(r.reviews[0])); }, 'REVIEW_RECIPE_DUPLICATE'],
    ['unknown recipe', (r) => { r.reviews[0].recipeId = 'absent'; }, 'REVIEW_RECIPE_UNKNOWN'],
    ['future date', (r) => { r.reviews[0].decidedAt = '2026-10-30T14:00:00Z'; }, 'REVIEW_DATE_IN_FUTURE'],
    ['missing action', (r) => { r.reviews[0].riskDispositions.pop(); }, 'REVIEW_ACTION_COVERAGE_MISMATCH'],
    ['extra action', (r) => { r.reviews[0].riskDispositions[0].action = 'UNRELATED'; }, 'REVIEW_ACTION_COVERAGE_MISMATCH'],
    ['duplicate action', (r) => { r.reviews[0].riskDispositions[1] = structuredClone(r.reviews[0].riskDispositions[0]); }, 'REVIEW_ACTION_DUPLICATE'],
    ['open approval', (r) => { r.reviews[0].riskDispositions[0].disposition = 'OPEN'; }, 'REVIEW_APPROVAL_HAS_OPEN_RISK'],
    ['changed evidence', (r) => { r.reviews[0].decisionEvidence.sha256 = '0'.repeat(64); }, 'REVIEW_EVIDENCE_STALE'],
    ['missing pointer', (r) => { r.reviews[0].decisionEvidence.pointer = '/missing'; }, 'REVIEW_EVIDENCE_POINTER_MISSING'],
    ['array property pointer', (r) => { r.reviews[0].decisionEvidence.pointer = '/facts/length'; }, 'REVIEW_EVIDENCE_POINTER_MISSING'],
    ['array leading zero', (r) => { r.reviews[0].decisionEvidence.pointer = '/facts/00'; }, 'REVIEW_EVIDENCE_POINTER_MISSING'],
    ['inherited pointer', (r) => { r.reviews[0].decisionEvidence.pointer = '/constructor'; }, 'REVIEW_EVIDENCE_POINTER_MISSING'],
    ['traversal', (r) => { r.reviews[0].decisionEvidence.path = 'docs/../review-evidence.json'; }, 'REVIEW_EVIDENCE_PATH_INVALID'],
    ['absolute path', (r) => { r.reviews[0].decisionEvidence.path = '/docs/review-evidence.json'; }, 'REVIEW_EVIDENCE_PATH_INVALID'],
    ['outside evidence path', (r) => { r.reviews[0].decisionEvidence.path = 'scripts/review.json'; }, 'REVIEW_EVIDENCE_PATH_INVALID'],
  ])('rejects %s', (_name, change, message) => {
    const input = record(); change(input); expect(() => check(input)).toThrow(message);
  });

  it.each([
    (r) => { r.reviews[0].reviewerIdentity = ' '; },
    (r) => { r.reviews[0].decidedAt = '2026-02-30T12:00:00Z'; },
    (r) => { r.reviews[0].decidedAt = '2026-10-30T12:00:00'; },
    (r) => { r.reviews[0].decision = 'PENDING'; },
    (r) => { r.reviews[0].riskDispositions[0].evidenceReferences = []; },
    (r) => { r.reviews[0].decisionEvidence.pointer = '/invalid~2'; },
    (r) => { r.runtimePromotionAllowed = true; },
    (r) => { r.reviews[0].humanApproved = true; },
  ])('rejects malformed or unrecognized fields', (change) => {
    const input = record(); change(input); expect(() => check(input)).toThrow();
  });

  it('resolves escaped pointers, scalar values and the document root', () => {
    for (const pointer of ['', '/facts/0', '/facts/1', '/facts/2', '/escaped~1key/~0']) {
      const input = record(); input.reviews[0].decisionEvidence.pointer = pointer;
      expect(check(input).formatValid).toBe(true);
    }
  });

  it('rejects missing evidence and symlinks escaping the repository', () => {
    const missing = record(); missing.reviews[0].decisionEvidence.path = 'docs/missing.json';
    expect(() => check(missing)).toThrow('ENOENT');
    symlinkSync(path.join(process.cwd(), 'package.json'), path.join(root, 'docs', 'outside.json'));
    const escaped = record(); escaped.reviews[0].decisionEvidence.path = 'docs/outside.json';
    expect(() => check(escaped)).toThrow('REVIEW_EVIDENCE_PATH_ESCAPE');
  });

  it('rejects invalid clocks', () => {
    expect(() => checkV3ReviewRecord(record(), root, NaN)).toThrow('REVIEW_CLOCK_INVALID');
  });

  it('CLI fails on usage errors, invalid JSON and incomplete actual-catalog records', () => {
    const script = path.join(process.cwd(), 'scripts/recipe-intelligence-v3-review.mjs');
    expect(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status).toBe(1);
    expect(spawnSync(process.execPath, [script, path.join(root, 'absent.json')], { encoding: 'utf8' }).status).toBe(1);
    const inputPath = path.join(root, 'invalid.json'); writeFileSync(inputPath, '{');
    expect(spawnSync(process.execPath, [script, inputPath], { encoding: 'utf8' }).status).toBe(1);
    const actualPath = path.join(process.cwd(), candidatePath);
    const before = hash(readFileSync(actualPath));
    writeFileSync(inputPath, JSON.stringify({ schemaVersion: 1, candidateArtifactSha256: before, reviews: [] }));
    const result = spawnSync(process.execPath, [script, inputPath], { cwd: os.tmpdir(), encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ decisionsRecorded: 0, completeReviewRecorded: false, runtimePromotionAllowed: false });
    expect(hash(readFileSync(actualPath))).toBe(before);
    expect(() => execFileSync(process.execPath, [script, inputPath], { stdio: 'pipe' })).toThrow();
  });
});
