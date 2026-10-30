#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CANDIDATES = 'data/recipe-intelligence/v3/candidates.json';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
const Text = z.string().trim().min(1);
const Evidence = z.object({
  path: Text,
  sha256: Hash,
  pointer: z.string().regex(/^(?:\/(?:[^~/]|~[01])*)*$/u).optional(),
}).strict();
const ReviewRecord = z.object({
  schemaVersion: z.literal(1),
  candidateArtifactSha256: Hash,
  reviews: z.array(z.object({
    recipeId: Text,
    candidateContentFingerprint: Hash,
    reviewerIdentity: Text,
    decidedAt: z.iso.datetime(),
    decision: z.enum(['APPROVE', 'REQUEST_CHANGES', 'REJECT']),
    decisionEvidence: Evidence,
    riskDispositions: z.array(z.object({
      action: Text,
      disposition: z.enum(['RESOLVED', 'OPEN']),
      rationale: Text,
      evidenceReferences: z.array(Evidence).min(1),
    }).strict()).min(1),
  }).strict()).max(500),
}).strict();
const CandidateArtifact = z.object({
  schemaVersion: z.literal(3),
  compilerVersion: z.literal(1),
  program: z.literal('TAKOLIO_RECIPE_INTELLIGENCE_V3'),
  runtimePromotionAllowed: z.literal(false),
  recipes: z.array(z.object({
    recipeId: Text,
    candidateContentFingerprint: Hash,
    requiredReviewActions: z.array(Text).min(1),
  }).passthrough()).length(500),
}).passthrough();

export function checkV3ReviewRecord(input, root = ROOT, now = Date.now()) {
  const record = ReviewRecord.parse(input);
  const bytes = readFileSync(path.join(root, CANDIDATES));
  assert.equal(record.candidateArtifactSha256, hash(bytes), 'REVIEW_CANDIDATE_ARTIFACT_STALE');
  const candidates = CandidateArtifact.parse(JSON.parse(bytes));
  const byId = new Map(candidates.recipes.map((recipe) => [recipe.recipeId, recipe]));
  assert.equal(byId.size, 500, 'REVIEW_CANDIDATE_ID_DUPLICATE');
  assert(Number.isFinite(now), 'REVIEW_CLOCK_INVALID');
  const evidenceRoot = realpathSync(root);
  const verified = new Set();
  function verifyEvidence(reference) {
    const key = JSON.stringify(reference);
    if (verified.has(key)) return;
    assert(/^(?:data|docs)\//u.test(reference.path)
      && !reference.path.includes('\\')
      && reference.path.split('/').every((part) => part && part !== '.' && part !== '..'), 'REVIEW_EVIDENCE_PATH_INVALID');
    const target = realpathSync(path.join(evidenceRoot, reference.path));
    const relative = path.relative(evidenceRoot, target);
    assert(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relative), 'REVIEW_EVIDENCE_PATH_ESCAPE');
    const content = readFileSync(target);
    assert.equal(hash(content), reference.sha256, 'REVIEW_EVIDENCE_STALE');
    if (reference.pointer !== undefined) {
      let value = JSON.parse(content);
      for (const token of reference.pointer.split('/').slice(1)) {
        const field = token.replaceAll('~1', '/').replaceAll('~0', '~');
        assert(value !== null && typeof value === 'object'
          && (!Array.isArray(value) || /^(?:0|[1-9]\d*)$/u.test(field))
          && Object.hasOwn(value, field), 'REVIEW_EVIDENCE_POINTER_MISSING');
        value = value[field];
      }
    }
    verified.add(key);
  }
  const seen = new Set();
  let approvedDecisionsRecorded = 0;
  for (const review of record.reviews) {
    assert(!seen.has(review.recipeId), 'REVIEW_RECIPE_DUPLICATE');
    seen.add(review.recipeId);
    const candidate = byId.get(review.recipeId);
    assert(candidate, 'REVIEW_RECIPE_UNKNOWN');
    assert.equal(review.candidateContentFingerprint, candidate.candidateContentFingerprint, 'REVIEW_CONTENT_STALE');
    assert(Date.parse(review.decidedAt) <= now, 'REVIEW_DATE_IN_FUTURE');
    verifyEvidence(review.decisionEvidence);
    const actions = review.riskDispositions.map((risk) => risk.action);
    assert.equal(new Set(actions).size, actions.length, 'REVIEW_ACTION_DUPLICATE');
    assert.equal(new Set(candidate.requiredReviewActions).size, candidate.requiredReviewActions.length, 'REVIEW_CANDIDATE_ACTION_DUPLICATE');
    assert.deepEqual([...actions].sort(), [...candidate.requiredReviewActions].sort(), 'REVIEW_ACTION_COVERAGE_MISMATCH');
    for (const risk of review.riskDispositions) {
      if (review.decision === 'APPROVE') assert.equal(risk.disposition, 'RESOLVED', 'REVIEW_APPROVAL_HAS_OPEN_RISK');
      for (const reference of risk.evidenceReferences) verifyEvidence(reference);
    }
    if (review.decision === 'APPROVE') approvedDecisionsRecorded++;
  }
  // ponytail: record integrity only; independent review must authenticate people and assess evidence before publication.
  return { formatValid: true, recipesTotal: 500, decisionsRecorded: seen.size,
    approvedDecisionsRecorded, recipesWithoutApproval: 500 - approvedDecisionsRecorded,
    completeReviewRecorded: approvedDecisionsRecorded === 500, runtimePromotionAllowed: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    assert(process.argv.length === 3, 'usage: node scripts/recipe-intelligence-v3-review.mjs <review.json>');
    const result = checkV3ReviewRecord(JSON.parse(readFileSync(process.argv[2], 'utf8')));
    console.log(JSON.stringify(result, null, 2));
    if (!result.completeReviewRecorded) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
