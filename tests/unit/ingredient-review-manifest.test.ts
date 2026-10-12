import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { CANONICAL_INGREDIENTS } from '../../packages/domain/src';
import { canonicalJson } from '../../packages/recipes/src/import/identity';
import {
  auditIngredientReviewManifest, buildIngredientReviewSourceProof, computeIngredientReviewManifestHash,
  IngredientReviewManifestSchema, ingredientReviewDecisionHash,
  type IngredientReviewEvidenceRecord, type IngredientReviewManifest, type IngredientReviewSourceProof,
} from '../../packages/recipes/src/ingredient-review-manifest';
import { fingerprintRefreshArtifact } from '../../packages/recipes/src/refresh/artifact';
import { RefreshRecipeSchema, type RefreshIngredient, type RefreshRecipe } from '../../packages/recipes/src/refresh/schema';
import { ingredientV2FromRefresh } from '../../packages/recipes/src/runtime-ingredient-v2';

const HASH = 'a'.repeat(64);
const EMPTY = () => ({ energyKcal: null, proteinG: null, carbohydrateG: null, fatG: null, fiberG: null, sugarG: null, sodiumMg: null });
const baseRelease = { schemaVersion: 1, releaseId: 'rel-0123456789abcdef', legacyBaselineCount: 1,
  legacyBaselineFingerprint: HASH, expectedRecipeCount: 1, orderedRecipeIds: ['TEST_ONLY-base'],
  expectedRuntimeFingerprint: HASH, approvedImportBatches: [] };
const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const row = (position: number, ingredientId = 'GARLIC'): RefreshIngredient => ({ position, sourceName: `TEST_ONLY-${ingredientId}`, canonicalIngredientId: ingredientId,
  reconciliation: ingredientId.startsWith('ING_ENR_') ? 'provisional_new_canonical_id' : 'existing_canonical_id',
  reconciliationReason: 'TEST_ONLY synthetic source', review: null, usageRole: 'consumed', nutritionRole: 'consumed', optional: false,
  includeInShopping: true, includeInNutrition: true,
  quantity: { kind: 'measured', amount: 100, unit: 'g', text: 'TEST_ONLY 100 g', gramEquivalent: 100,
    basis: 'TEST_ONLY explicit measurement', evidence: 'source_explicit', runtime: { amount: 100, unit: 'g' } },
  note: null, sourceNutritionPer100g: null, sourceNutritionReference: null, sourceNutritionNote: null });
function recipe(ingredients = [row(0)]): RefreshRecipe {
  return RefreshRecipeSchema.parse({ schemaVersion: 2, recipeVersion: 2,
    identity: { id: 'TEST_ONLY-recipe', slug: 'test-only-recipe', title: 'TEST_ONLY fixture' },
    content: { description: 'TEST_ONLY', cuisine: 'vietnamese', cookTimeMinutes: 1, servings: 2, difficulty: 'easy', tags: [] },
    research: { inputPath: 'TEST_ONLY.json', rawSchemaSignature: 'TEST_ONLY', notes: [],
      sources: [{ url: 'https://test-only.example.test/source', role: 'declared', verification: 'structurally_valid', verificationEvidence: null, note: null }] },
    ingredients, steps: [{ stepNumber: 1, instruction: 'TEST_ONLY instruction' }],
    nutrition: { certification: 'null_truthful', profileId: null, basis: 'per_serving', servings: 2,
      perServing: EMPTY(), candidatePerServing: EMPTY(), originalPerServing: EMPTY(), blockers: [], remediation: [] },
    media: { sourceImageUrl: null, legacyRuntimeImageUrl: '/TEST_ONLY.webp', canonicalStatus: 'source_metadata_only' },
    audit: { schemaRepairs: [], encodingRepairs: [], runtimeExcludedIngredientPositions: [], runtimeExclusions: [] } });
}
async function fixture(recipes = [recipe()]) {
  const files = recipes.map((source) => ({ path: `recipes/${source.identity.id}.json`, bytes: `${JSON.stringify(source)}\n` }));
  const fileHashes = files.map(({ path, bytes }) => ({ path, sha256: createHash('sha256').update(bytes).digest('hex') })).sort((a, b) => a.path < b.path ? -1 : 1);
  const canonicalArtifactSha256 = await fingerprintRefreshArtifact(fileHashes);
  const sourceManifest = { classification: 'TEST_ONLY' as const, baseReleaseId: baseRelease.releaseId, canonicalArtifactSha256,
    orderedRecipeIds: recipes.map((source) => source.identity.id), fileHashes };
  const input = { classification: 'TEST_ONLY' as const, sourceManifest, files, expectedCanonicalSourceSha256: canonicalArtifactSha256,
    certifiedBaseRelease: baseRelease, certifiedExistingIngredientIds: new Set(['GARLIC', 'RICE']) };
  const proof = await buildIngredientReviewSourceProof(input);
  return { proof, input, recipes };
}
async function seal(manifest: IngredientReviewManifest) {
  manifest.contentSha256 = await computeIngredientReviewManifestHash(manifest);
  return manifest;
}
async function completeFixture(recipes = [recipe()]) {
  const context = await fixture(recipes);
  const manifest: IngredientReviewManifest = { schemaVersion: 1, classification: 'TEST_ONLY', status: 'TEST_ONLY', authorityScope: 'OFFLINE_REVIEW',
    reviewManifestId: 'TEST_ONLY-manifest', canonicalSourceSha256: context.proof.canonicalSourceSha256,
    baseReleaseId: baseRelease.releaseId, contentSha256: HASH, identities: [], transformations: [], sources: [], nutrition: [] };
  const evidence: IngredientReviewEvidenceRecord[] = [];
  const addEvidence = async (kind: IngredientReviewEvidenceRecord['subject']['kind'], key: string, digest: string, payload: unknown,
    basis = 'TEST_ONLY evidence basis', evidenceReference = `TEST_ONLY:${kind}:${key}`) => {
    const binding = { evidenceId: `TEST_ONLY:${kind}:${key}`, reviewerId: 'TEST_ONLY-reviewer', reviewedAt: '2026-10-11T00:00:00Z',
      canonicalSourceSha256: manifest.canonicalSourceSha256, authorityScope: 'OFFLINE_REVIEW' as const };
    evidence.push({ ...binding, classification: 'TEST_ONLY', baseReleaseId: manifest.baseReleaseId, basis, evidenceReference,
      subject: { kind, key, sha256: digest }, decisionSha256: await ingredientReviewDecisionHash(payload) });
    return binding;
  };
  const concepts = new Map<string, string[]>();
  for (const source of recipes) for (const ingredient of source.ingredients) if (ingredient.canonicalIngredientId?.startsWith('ING_ENR_')) {
    const names = concepts.get(ingredient.canonicalIngredientId) ?? [];
    if (!names.includes(ingredient.sourceName)) names.push(ingredient.sourceName);
    concepts.set(ingredient.canonicalIngredientId, names);
  }
  for (const [provisionalId, sourceNames] of concepts) {
    const decision = { provisionalId, sourceName: sourceNames[0], decision: 'ALIAS_EXISTING' as const, targetId: 'GARLIC',
      review: { basis: 'TEST_ONLY evidence basis', evidenceReference: `TEST_ONLY:identity:${provisionalId}` } };
    manifest.identities.push({ decision, evidence: await addEvidence('identity', provisionalId,
      hash({ provisionalId, sourceNames: [...sourceNames].sort() }), decision, decision.review.basis, decision.review.evidenceReference) });
  }
  for (const source of recipes) {
    for (const ingredient of source.ingredients) manifest.transformations.push({ recipeId: source.identity.id, sourcePosition: ingredient.position,
      sourceRowSha256: hash(ingredient), ingredientId: ingredient.canonicalIngredientId, decision: 'PRESERVE_SOURCE',
      reviewedLine: ingredientV2FromRefresh(ingredient), reason: null, conversion: null, evidence: null });
    for (const reference of source.research.sources) {
      const payload = { recipeId: source.identity.id, url: reference.url, role: reference.role, decision: 'CONTENT_VERIFIED' as const,
        sourceContentSha256: HASH, observedAt: '2026-10-10T00:00:00Z', claims: [{ sourcePosition: 0, claim: 'quantity' as const }] };
      manifest.sources.push({ ...payload, evidence: await addEvidence('source', canonicalJson([payload.recipeId, payload.url, payload.role]),
        hash({ recipeId: source.identity.id, ...reference }), payload) });
    }
    manifest.nutrition.push({ recipeId: source.identity.id, sourceNutritionSha256: hash(source.nutrition), decision: 'KEEP_NULL', basis: 'per_serving',
      servings: source.nutrition.servings, perServing: EMPTY(), nutrientReference: null, consumedQuantities: [], evidence: null });
  }
  await seal(manifest);
  return { ...context, manifest, evidence, addEvidence };
}

let actual: IngredientReviewSourceProof;
const root = process.cwd();
const sourceRoot = path.join(root, 'data/recipe-refresh/v2');
beforeAll(async () => {
  const manifest = JSON.parse(readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8'));
  actual = await buildIngredientReviewSourceProof({ classification: 'CANONICAL_CANDIDATE', sourceManifest: manifest,
    expectedCanonicalSourceSha256: 'da87da20475fa8d7ec92c716e899ee572339573258ae6d9cc7f3f8f554f2d695',
    certifiedBaseRelease: JSON.parse(readFileSync(path.join(root, 'packages/recipes/src/import/catalog-release.current.json'), 'utf8')),
    certifiedExistingIngredientIds: new Set(CANONICAL_INGREDIENTS.map((ingredient) => ingredient.id)),
    files: manifest.fileHashes.map(({ path: file }: { path: string }) => ({ path: file, bytes: readFileSync(path.join(sourceRoot, file)) })) });
});

describe('B05a evidence-bound source proof', () => {
  it('verifies the real source bytes and complete 500-recipe coverage without runtime authority', () => {
    expect(actual.canonicalSourceSha256).toBe('da87da20475fa8d7ec92c716e899ee572339573258ae6d9cc7f3f8f554f2d695');
    expect(actual.coverage).toEqual({ recipes: 500, concepts: 1395, sourceLines: 6766, sourceOccurrences: 1102, nutritionProfiles: 500 });
    expect(Object.isFrozen(actual)).toBe(true);
  });
  it('rejects a structurally forged proof object', async () => {
    const context = await completeFixture();
    await expect(auditIngredientReviewManifest({ ...context.proof }, context.manifest, context.evidence)).rejects.toThrow(/UNVERIFIED_SOURCE_PROOF/);
  });
  it.each(['changed', 'partial', 'duplicate', 'extra'] as const)('rejects %s source file bytes', async (attack) => {
    const { input } = await fixture();
    const files = attack === 'changed' ? input.files.map((file) => ({ ...file, bytes: `${file.bytes} ` }))
      : attack === 'partial' ? [] : attack === 'duplicate' ? [...input.files, input.files[0]] : [...input.files, { path: 'extra.json', bytes: '{}' }];
    await expect(buildIngredientReviewSourceProof({ ...input, files })).rejects.toThrow(/SOURCE_(BYTES_DIGEST_MISMATCH|FILE_COVERAGE_DRIFT)/);
  });
  it('rejects stale source and foreign base release pins', async () => {
    const { input } = await fixture();
    await expect(buildIngredientReviewSourceProof({ ...input, expectedCanonicalSourceSha256: HASH })).rejects.toThrow(/CANONICAL_SOURCE_HASH_MISMATCH/);
    await expect(buildIngredientReviewSourceProof({ ...input, certifiedBaseRelease: { ...baseRelease, releaseId: 'rel-ffffffffffffffff' } })).rejects.toThrow(/BASE_RELEASE_MISMATCH/);
  });
  it('rejects provisional ids presented as certified existing authority', async () => {
    const { input } = await fixture();
    await expect(buildIngredientReviewSourceProof({ ...input, certifiedExistingIngredientIds: new Set(['ING_ENR_FAKE']) })).rejects.toThrow(/UNREVIEWED_EXISTING_AUTHORITY/);
  });
  it('rejects duplicate source ingredient positions even with recomputed file hashes', async () => {
    await expect(fixture([recipe([row(0), row(0, 'RICE')])])).rejects.toThrow(/SOURCE_LINE_IDENTITY_DRIFT/);
  });
});

describe('B05a offline review manifest proof', () => {
  it('keeps an empty real manifest incomplete with zero promotions', async () => {
    const manifest = await seal({ schemaVersion: 1, classification: 'CANONICAL_CANDIDATE', status: 'INCOMPLETE', authorityScope: 'OFFLINE_REVIEW',
      reviewManifestId: 'offline-empty', canonicalSourceSha256: actual.canonicalSourceSha256, baseReleaseId: actual.baseReleaseId,
      contentSha256: HASH, identities: [], transformations: [], sources: [], nutrition: [] });
    const result = await auditIngredientReviewManifest(actual, manifest, []);
    expect(result.status).toBe('INCOMPLETE');
    expect(result.runtimeAuthority).toBe(false);
    expect(result.finalRuntimeFingerprint).toBeNull();
    expect(result.offlineIdentityPreview).toBeNull();
    expect(result.blockers).toEqual(['IDENTITY_COVERAGE_DRIFT', 'NUTRITION_COVERAGE_DRIFT', 'REVIEW_SET_INCOMPLETE', 'SOURCE_COVERAGE_DRIFT', 'SOURCE_LINE_COVERAGE_DRIFT']);
    expect(result.coverage.sourceLines).toEqual({ expected: 6766, resolved: 0 });
  });
  it('labels complete synthetic evidence as TEST_ONLY and never a release certificate', async () => {
    const { proof, manifest, evidence } = await completeFixture([recipe([row(0, 'ING_ENR_TEST')])]);
    const result = await auditIngredientReviewManifest(proof, manifest, evidence);
    expect(result.blockers).toEqual([]);
    expect(result.status).toBe('TEST_ONLY');
    expect(result.runtimeAuthority).toBe(false);
    expect(result.offlineIdentityPreview).toMatchObject({ classification: 'TEST_ONLY', authorityScope: 'OFFLINE_REVIEW',
      masterRows: [], aliases: [{ sourceId: 'ING_ENR_TEST', canonicalId: 'GARLIC' }] });
  });
  it('produces identical bytes and hashes after file, recipe, decision and ledger reorder', async () => {
    const second = recipe([row(0, 'RICE'), row(1, 'ING_ENR_SECOND')]);
    second.identity = { id: 'TEST_ONLY-second', slug: 'test-only-second', title: 'TEST_ONLY second' };
    const first = recipe([row(0, 'ING_ENR_FIRST'), row(1)]);
    const context = await completeFixture([first, second]);
    const result = await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence);
    const proof = await buildIngredientReviewSourceProof({ ...context.input, files: [...context.input.files].reverse(),
      sourceManifest: { ...context.input.sourceManifest, orderedRecipeIds: [...context.input.sourceManifest.orderedRecipeIds].reverse(),
        fileHashes: [...context.input.sourceManifest.fileHashes].reverse() } });
    const reordered = { ...context.manifest, identities: [...context.manifest.identities].reverse(),
      transformations: [...context.manifest.transformations].reverse(), sources: [...context.manifest.sources].reverse(), nutrition: [...context.manifest.nutrition].reverse() };
    expect(await computeIngredientReviewManifestHash(reordered)).toBe(context.manifest.contentSha256);
    const shuffled = await auditIngredientReviewManifest(proof, reordered, [...context.evidence].reverse());
    expect(canonicalJson(shuffled)).toBe(canonicalJson(result));
  });
  it.each(['identities', 'transformations', 'sources', 'nutrition'] as const)('rejects partial %s coverage', async (field) => {
    const context = await completeFixture([recipe([row(0, 'ING_ENR_TEST')])]);
    context.manifest[field] = [];
    await seal(context.manifest);
    const result = await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence);
    expect(result.blockers).toContain('REVIEW_SET_INCOMPLETE');
    expect(result.offlineIdentityPreview).toBeNull();
  });
  it.each(['identities', 'transformations', 'sources', 'nutrition'] as const)('rejects duplicate %s decisions', async (field) => {
    const context = await completeFixture([recipe([row(0, 'ING_ENR_TEST')])]);
    const original = context.manifest[field];
    (context.manifest as unknown as Record<string, unknown>)[field] = [...original, original[0]];
    await seal(context.manifest);
    const result = await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence);
    expect(result.blockers.some((reason) => reason.startsWith('DUPLICATE_'))).toBe(true);
    expect(result.offlineIdentityPreview).toBeNull();
  });
  it.each(['missing', 'reviewer', 'source', 'scope', 'digest', 'decision', 'classification'] as const)('rejects %s evidence attacks', async (attack) => {
    const context = await completeFixture([recipe([row(0, 'ING_ENR_TEST')])]);
    const ledger = context.evidence.map((item) => structuredClone(item));
    if (attack === 'missing') ledger.shift();
    if (attack === 'reviewer') ledger[0].reviewerId = 'TEST_ONLY-forged-reviewer';
    if (attack === 'source') ledger[0].canonicalSourceSha256 = HASH;
    if (attack === 'scope') (ledger[0] as unknown as Record<string, unknown>).authorityScope = 'PRODUCTION';
    if (attack === 'digest') ledger[0].subject.sha256 = HASH;
    if (attack === 'decision') ledger[0].decisionSha256 = HASH;
    if (attack === 'classification') ledger[0].classification = 'HUMAN_REVIEW';
    if (attack === 'scope') await expect(auditIngredientReviewManifest(context.proof, context.manifest, ledger)).rejects.toThrow();
    else {
      const result = await auditIngredientReviewManifest(context.proof, context.manifest, ledger);
      expect(result.blockers).toContain(attack === 'missing' ? 'MISSING_TRUSTED_EVIDENCE' : 'EVIDENCE_BINDING_MISMATCH');
      expect(result.offlineIdentityPreview).toBeNull();
    }
  });
  it('refuses selfasserted evidence placed inside the manifest', async () => {
    const context = await completeFixture();
    expect(IngredientReviewManifestSchema.safeParse({ ...context.manifest, evidenceLedger: context.evidence }).success).toBe(false);
    const result = await auditIngredientReviewManifest(context.proof, context.manifest, []);
    expect(result.blockers).toContain('MISSING_TRUSTED_EVIDENCE');
  });
  it('rejects stale manifest/source row digests and false completeness', async () => {
    const context = await completeFixture();
    context.manifest.transformations[0].sourceRowSha256 = HASH;
    const digestDrift = await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence);
    expect(digestDrift.blockers).toContain('REVIEW_MANIFEST_HASH_MISMATCH');
    expect(digestDrift.blockers).toContain('SOURCE_ROW_DIGEST_OR_IDENTITY_MISMATCH');
    const real = await seal({ ...context.manifest, classification: 'CANONICAL_CANDIDATE', status: 'REVIEW_COMPLETE' });
    const result = await auditIngredientReviewManifest(context.proof, real, context.evidence);
    expect(result.blockers).toContain('CLASSIFICATION_MISMATCH');
    expect(result.blockers).toContain('FALSE_REVIEW_COMPLETION_CLAIM');
  });
  it('rejects ambiguous identity decisions rather than counting them as promotions', async () => {
    const context = await completeFixture([recipe([row(0, 'ING_ENR_TEST')])]);
    context.manifest.identities[0] = { decision: { provisionalId: 'ING_ENR_TEST', sourceName: 'TEST_ONLY-ING_ENR_TEST',
      decision: 'AMBIGUOUS', targetId: null, review: null }, evidence: null };
    await seal(context.manifest);
    const result = await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence);
    expect(result.coverage.concepts.resolved).toBe(0);
    expect(result.blockers).toContain('INGREDIENT_RECONCILIATION_INCOMPLETE');
  });
  it('uses the existing authority compiler to reject absent alias targets and new-id collisions', async () => {
    const context = await completeFixture([recipe([row(0, 'ING_ENR_TEST')])]);
    const identity = context.manifest.identities[0];
    identity.decision.targetId = 'UNKNOWN_CANONICAL';
    identity.evidence = await context.addEvidence('identity', identity.decision.provisionalId,
      hash({ provisionalId: 'ING_ENR_TEST', sourceNames: ['TEST_ONLY-ING_ENR_TEST'] }), identity.decision,
      identity.decision.review!.basis, identity.decision.review!.evidenceReference);
    context.evidence.splice(0, 1);
    await seal(context.manifest);
    const result = await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence);
    expect(result.blockers).toContain('INGREDIENT_AUTHORITY_PROOF_BLOCKED');
    expect(result.offlineIdentityPreview).toBeNull();
  });
});

describe('B05a independent quantity and nutrition evidence', () => {
  it('blocks invented identity promotion inside a reviewed line', async () => {
    const context = await completeFixture([recipe([row(0, 'ING_ENR_TEST')])]);
    context.manifest.transformations[0].reviewedLine!.authority = 'existing';
    await seal(context.manifest);
    const result = await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence);
    expect(result.blockers).toContain('UNREVIEWED_INGREDIENT_PROMOTION');
  });
  it('blocks fabricated numeric shopping for missing source quantities', async () => {
    const source = row(0);
    source.quantity = { kind: 'qualitative', text: 'TEST_ONLY as needed', gramEquivalent: null, basis: null, evidence: 'missing', runtime: null };
    const context = await completeFixture([recipe([source])]);
    const transformation = context.manifest.transformations[0];
    transformation.decision = 'REVIEWED_TRANSFORMATION';
    transformation.reviewedLine!.shopping = { kind: 'measured', quantity: { amount: 1, unit: 'g' }, scaling: 'proportional',
      conversionEvidence: { basis: 'TEST_ONLY invented amount', reference: 'TEST_ONLY:conversion' } };
    const { evidence: _binding, ...payload } = transformation;
    transformation.evidence = await context.addEvidence('transformation', 'TEST_ONLY-recipe:0', hash(source), payload);
    await seal(context.manifest);
    const result = await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence);
    expect(result.blockers).toContain('UNREVIEWED_PURCHASE_CONVERSION');
  });
  it.each(['missing', 'wrong-ingredient', 'range', 'factor', 'unit', 'reference'] as const)('rejects %s culinary conversion evidence', async (attack) => {
    const source = row(0);
    source.quantity = { ...source.quantity, kind: 'measured', amount: 2, unit: 'TEST_ONLY-spoon', text: 'TEST_ONLY 2 spoons',
      gramEquivalent: null, runtime: null, evidence: 'source_explicit' };
    const context = await completeFixture([recipe([source])]);
    const transformation = context.manifest.transformations[0];
    transformation.decision = 'REVIEWED_TRANSFORMATION';
    transformation.reviewedLine!.shopping = { kind: 'measured', quantity: { amount: 20, unit: 'g' }, scaling: 'proportional',
      conversionEvidence: { basis: 'TEST_ONLY food-specific measurement', reference: 'TEST_ONLY:conversion' } };
    transformation.conversion = { kind: 'culinary', ingredientId: 'GARLIC', sourceAmount: 2, sourceUnit: 'TEST_ONLY-spoon', factor: 10,
      targetUnit: 'g', applicability: { minSourceAmount: 1, maxSourceAmount: 3 }, reference: 'TEST_ONLY:conversion' };
    if (attack === 'missing') transformation.conversion = null;
    if (attack === 'wrong-ingredient') transformation.conversion!.ingredientId = 'RICE';
    if (attack === 'range') transformation.conversion!.applicability.minSourceAmount = 3;
    if (attack === 'factor') transformation.conversion!.factor = 15;
    if (attack === 'unit') transformation.conversion!.targetUnit = 'ml';
    if (attack === 'reference') transformation.conversion!.reference = 'TEST_ONLY:other';
    const { evidence: _binding, ...payload } = transformation;
    transformation.evidence = await context.addEvidence('transformation', 'TEST_ONLY-recipe:0', hash(source), payload);
    await seal(context.manifest);
    expect((await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence)).blockers).toContain('UNREVIEWED_PURCHASE_CONVERSION');
  });
  it('admits a food-specific reviewed conversion only within its evidenced source row and range', async () => {
    const source = row(0);
    source.quantity = { ...source.quantity, kind: 'measured', amount: 2, unit: 'TEST_ONLY-spoon', text: 'TEST_ONLY 2 spoons',
      gramEquivalent: null, runtime: null, evidence: 'source_explicit' };
    const context = await completeFixture([recipe([source])]);
    const transformation = context.manifest.transformations[0];
    transformation.decision = 'REVIEWED_TRANSFORMATION';
    transformation.reviewedLine!.shopping = { kind: 'measured', quantity: { amount: 20, unit: 'g' }, scaling: 'proportional',
      conversionEvidence: { basis: 'TEST_ONLY food-specific measurement', reference: 'TEST_ONLY:conversion' } };
    transformation.conversion = { kind: 'culinary', ingredientId: 'GARLIC', sourceAmount: 2, sourceUnit: 'TEST_ONLY-spoon', factor: 10,
      targetUnit: 'g', applicability: { minSourceAmount: 1, maxSourceAmount: 3 }, reference: 'TEST_ONLY:conversion' };
    const { evidence: _binding, ...payload } = transformation;
    transformation.evidence = await context.addEvidence('transformation', 'TEST_ONLY-recipe:0', hash(source), payload);
    await seal(context.manifest);
    const result = await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence);
    expect(result.blockers).toEqual([]);
    expect(result.runtimeAuthority).toBe(false);
  });
  it('never treats oil/salt process quantities as an automatically consumed nutrition quantity', async () => {
    const source = row(0);
    source.usageRole = 'process_only'; source.nutritionRole = 'excluded_process'; source.includeInNutrition = false;
    const context = await completeFixture([recipe([source])]);
    const transformation = context.manifest.transformations[0];
    transformation.decision = 'REVIEWED_TRANSFORMATION';
    transformation.reviewedLine!.process = { kind: 'measured', amount: 100, unitText: 'g', scaling: 'fixed' };
    transformation.reviewedLine!.shopping = { kind: 'measured', quantity: { amount: 100, unit: 'g' }, scaling: 'fixed', conversionEvidence: null };
    transformation.reviewedLine!.consumed = { kind: 'measured', quantity: { amount: 100, unit: 'g' }, evidence: { basis: 'TEST_ONLY fake whole process', reference: 'TEST_ONLY:fake' } };
    const { evidence: _binding, ...payload } = transformation;
    transformation.evidence = await context.addEvidence('transformation', 'TEST_ONLY-recipe:0', hash(source), payload);
    await seal(context.manifest);
    expect((await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence)).blockers).toContain('UNREVIEWED_CONSUMED_QUANTITY');
  });
  it('keeps blocked nutrition numeric macros absent until independently evidenced', async () => {
    const source = recipe();
    source.nutrition.certification = 'blocked'; source.nutrition.blockers = [{ code: 'TEST_ONLY_ABSORPTION', ingredientPosition: 0, detail: 'TEST_ONLY unknown' }];
    const context = await completeFixture([source]);
    context.manifest.nutrition[0].decision = 'KEEP_BLOCKED';
    await seal(context.manifest);
    const result = await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence);
    expect(result.blockers).toContain('NUTRITION_EVIDENCE_INCOMPLETE');
    expect(context.manifest.nutrition[0].perServing).toEqual(EMPTY());
    expect(result.offlineIdentityPreview).toBeNull();
  });
});

describe('B05a physical, source-content and nutrition proof boundaries', () => {
  it('rejects a source claimed existing identity absent from certified same-release ids', async () => {
    await expect(fixture([recipe([row(0, 'UNKNOWN_CANONICAL')])])).rejects.toThrow(/UNREVIEWED_EXISTING_AUTHORITY/);
  });
  it('reports deterministic transformation class counts without resolving blocked lines', async () => {
    const context = await completeFixture();
    const result = await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence);
    expect(result.transformationClasses).toEqual({ DIRECT_EXACT_UNIT: { expected: 1, resolved: 1 } });
  });
  it('admits exact kg-to-g through the existing physical unit definitions', async () => {
    const source = row(0);
    source.quantity = { ...source.quantity, kind: 'measured', amount: 2, unit: 'kg', text: 'TEST_ONLY 2 kg',
      gramEquivalent: 2000, runtime: { amount: 2, unit: 'kg' } };
    const context = await completeFixture([recipe([source])]);
    const transformation = context.manifest.transformations[0];
    transformation.decision = 'REVIEWED_TRANSFORMATION';
    transformation.reviewedLine!.shopping = { kind: 'measured', quantity: { amount: 2000, unit: 'g' }, scaling: 'proportional', conversionEvidence: null };
    const { evidence: _binding, ...payload } = transformation;
    transformation.evidence = await context.addEvidence('transformation', 'TEST_ONLY-recipe:0', hash(source), payload);
    await seal(context.manifest);
    expect((await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence)).blockers).toEqual([]);
  });
  it('rejects a physical conversion with an invented numeric result despite a review record', async () => {
    const context = await completeFixture();
    const transformation = context.manifest.transformations[0];
    transformation.decision = 'REVIEWED_TRANSFORMATION';
    transformation.reviewedLine!.shopping = { kind: 'measured', quantity: { amount: 999, unit: 'g' }, scaling: 'proportional', conversionEvidence: null };
    const { evidence: _binding, ...payload } = transformation;
    transformation.evidence = await context.addEvidence('transformation', 'TEST_ONLY-recipe:0', hash(context.recipes[0].ingredients[0]), payload);
    await seal(context.manifest);
    expect((await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence)).blockers).toContain('UNREVIEWED_PURCHASE_CONVERSION');
  });
  it.each(['unresolved', 'missing-content', 'missing-observation', 'invalid-position', 'duplicate-claim'] as const)('blocks %s source-content reviews', async (attack) => {
    const context = await completeFixture();
    const source = context.manifest.sources[0];
    if (attack === 'unresolved') source.decision = 'UNRESOLVED';
    if (attack === 'missing-content') source.sourceContentSha256 = null;
    if (attack === 'missing-observation') source.observedAt = null;
    if (attack === 'invalid-position') source.claims[0].sourcePosition = 99;
    if (attack === 'duplicate-claim') source.claims.push(source.claims[0]);
    await seal(context.manifest);
    expect((await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence)).blockers).toContain('SOURCE_CONTENT_VERIFICATION_INCOMPLETE');
  });
  it('rejects a numeric nutrition profile missing consumed-quantity coverage', async () => {
    const context = await completeFixture();
    const nutrition = context.manifest.nutrition[0];
    nutrition.decision = 'REVIEWED_PROFILE';
    nutrition.perServing = { energyKcal: 10, proteinG: 1, carbohydrateG: 1, fatG: 1, fiberG: 1, sugarG: 1, sodiumMg: 1 };
    nutrition.nutrientReference = { reference: 'TEST_ONLY:nutrients', contentSha256: HASH };
    const { evidence: _binding, ...payload } = nutrition;
    nutrition.evidence = await context.addEvidence('nutrition', nutrition.recipeId, nutrition.sourceNutritionSha256, payload);
    await seal(context.manifest);
    expect((await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence)).blockers).toContain('NUTRITION_CONSUMED_COVERAGE_DRIFT');
  });
  it('requires a separate nutrition ledger record even when transformation evidence names matching edible quantities', async () => {
    const context = await completeFixture();
    const transformation = context.manifest.transformations[0];
    transformation.decision = 'REVIEWED_TRANSFORMATION';
    transformation.reviewedLine!.consumed = { kind: 'measured', quantity: { amount: 50, unit: 'g' },
      evidence: { basis: 'TEST_ONLY edible yield', reference: 'TEST_ONLY:nutrition' } };
    const { evidence: _binding, ...payload } = transformation;
    transformation.evidence = await context.addEvidence('transformation', 'TEST_ONLY-recipe:0', hash(context.recipes[0].ingredients[0]), payload);
    const nutrition = context.manifest.nutrition[0];
    nutrition.decision = 'REVIEWED_PROFILE';
    nutrition.perServing = { energyKcal: 10, proteinG: 1, carbohydrateG: 1, fatG: 1, fiberG: 1, sugarG: 1, sodiumMg: 1 };
    nutrition.nutrientReference = { reference: 'TEST_ONLY:nutrients', contentSha256: HASH };
    nutrition.consumedQuantities = [{ sourcePosition: 0, sourceRowSha256: transformation.sourceRowSha256,
      quantity: { amount: 50, unit: 'g' }, absorptionBasis: 'TEST_ONLY independent edible yield' }];
    await seal(context.manifest);
    const result = await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence);
    expect(result.blockers).toContain('MISSING_TRUSTED_EVIDENCE');
    expect(result.offlineIdentityPreview).toBeNull();
  });
  it('rejects duplicate external evidence ids', async () => {
    const context = await completeFixture();
    const result = await auditIngredientReviewManifest(context.proof, context.manifest, [...context.evidence, context.evidence[0]]);
    expect(result.blockers).toContain('DUPLICATE_EVIDENCE_ID');
    expect(result.offlineIdentityPreview).toBeNull();
  });
});

describe('B05a fully bound TEST_ONLY nutrition proof', () => {
  it('admits a separately reviewed edible quantity and profile without granting runtime authority', async () => {
    const context = await completeFixture();
    const transformation = context.manifest.transformations[0];
    const nutrition = context.manifest.nutrition[0];
    const absorptionBasis = 'TEST_ONLY independently measured edible yield';
    nutrition.decision = 'REVIEWED_PROFILE';
    nutrition.perServing = { energyKcal: 10, proteinG: 1, carbohydrateG: 1, fatG: 1, fiberG: 1, sugarG: 1, sodiumMg: 1 };
    nutrition.nutrientReference = { reference: 'TEST_ONLY:nutrient-table', contentSha256: HASH };
    nutrition.consumedQuantities = [{ sourcePosition: 0, sourceRowSha256: transformation.sourceRowSha256,
      quantity: { amount: 50, unit: 'g' }, absorptionBasis }];
    const { evidence: _nutritionBinding, ...nutritionPayload } = nutrition;
    nutrition.evidence = await context.addEvidence('nutrition', nutrition.recipeId, nutrition.sourceNutritionSha256, nutritionPayload);
    transformation.decision = 'REVIEWED_TRANSFORMATION';
    transformation.reviewedLine!.consumed = { kind: 'measured', quantity: { amount: 50, unit: 'g' },
      evidence: { basis: absorptionBasis, reference: `TEST_ONLY:nutrition:${nutrition.recipeId}` } };
    const { evidence: _transformationBinding, ...transformationPayload } = transformation;
    transformation.evidence = await context.addEvidence('transformation', 'TEST_ONLY-recipe:0', transformation.sourceRowSha256, transformationPayload);
    await seal(context.manifest);
    const result = await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence);
    expect(result.blockers).toEqual([]);
    expect(result.status).toBe('TEST_ONLY');
    expect(result.runtimeAuthority).toBe(false);
    expect(result.finalRuntimeFingerprint).toBeNull();
  });
  it('blocks unreviewed process scaling and salt-bed exclusions', async () => {
    const source = row(0);
    source.usageRole = 'process_only'; source.nutritionRole = 'excluded_process'; source.includeInShopping = false; source.includeInNutrition = false;
    const context = await completeFixture([recipe([source])]);
    expect((await auditIngredientReviewManifest(context.proof, context.manifest, context.evidence)).blockers).toContain('UNREVIEWED_TRANSFORMATION');
  });
});
