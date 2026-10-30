#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT = process.cwd();
const OUT = 'docs/ai/recipe-intelligence-v3';
const DATA = 'data/recipe-intelligence/v3';
const V2 = 'data/recipe-refresh/v2';
const BASE_SHA = 'b49f3e6c4fc2f1485b77623ed7257d0f8bd31f9a';
const PROGRAM = 'TAKOLIO_RECIPE_INTELLIGENCE_V3';
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 1 && args[0] === '--check'), 'usage: recipe-intelligence-v3-audit.mjs [--check]');
const check = args.includes('--check');
const read = (file) => readFileSync(path.join(ROOT, file));
const json = (file) => JSON.parse(read(file).toString('utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const counts = (values) => Object.fromEntries([...new Set(values)].sort().map((key) => [key, values.filter((value) => value === key).length]));
const normalize = (value) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
function assertClaimFacts(claim, sources) {
  assert(['EXTERNAL_SOURCE_FACT', 'EXTERNAL_VARIANT_COMPARISON', 'EXTERNAL_SOURCE_INTERNAL_CONFLICT',
    'INTERNAL_V2_OBSERVATION', 'RETRIEVAL_ATTEMPT'].includes(claim.evidenceBasis), 'unknown claim evidence basis');
  if (claim.evidenceBasis.startsWith('EXTERNAL_')) {
    assert(claim.sourceIds.length > 0 && claim.sourceFactReferences?.length > 0, 'external claim facts required');
    assert(claim.sourceIds.every((id) => claim.sourceFactReferences.some((reference) => reference.sourceId === id)
      && sources.get(id)?.evidenceStatus.includes('SOURCE_CONTENT_READ')), 'external claim source facts missing');
  }
  for (const reference of claim.sourceFactReferences ?? []) assert(claim.sourceIds.includes(reference.sourceId)
    && sources.get(reference.sourceId)?.reviewedFacts?.some((fact) => fact.factId === reference.factId), 'claim fact missing');
}
const factFixture = { evidenceBasis: 'EXTERNAL_SOURCE_FACT', sourceIds: ['source'], sourceFactReferences: [{ sourceId: 'source', factId: 'fact' }] };
const sourceFixture = new Map([['source', { evidenceStatus: ['SOURCE_CONTENT_READ'], reviewedFacts: [{ factId: 'fact' }] }]]);
assertClaimFacts(factFixture, sourceFixture);
assert.throws(() => assertClaimFacts({ ...factFixture, sourceIds: [], sourceFactReferences: [] }, sourceFixture));
assert.throws(() => assertClaimFacts({ ...factFixture, sourceFactReferences: [] }, sourceFixture));
assert.throws(() => assertClaimFacts({ ...factFixture, sourceFactReferences: [{ sourceId: 'source', factId: 'wrong' }] }, sourceFixture));
assertClaimFacts({ evidenceBasis: 'INTERNAL_V2_OBSERVATION', sourceIds: [] }, sourceFixture);
const outputs = new Map();
const emit = (file, value) => outputs.set(file, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
const csvCell = (value) => {
  const text = Array.isArray(value) ? value.join('|') : value === null || value === undefined ? '' : String(value);
  return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const releasePath = 'packages/recipes/src/import/catalog-release.current.json';
const registry = json('data/recipe-import/approved-batches.json');
const beforeFiles = ['packages/recipes/src/data.ts', releasePath, 'data/recipe-import/approved-batches.json', `${V2}/manifest.json`,
  'packages/recipes/src/runtime-recipe.ts', 'packages/recipes/src/catalog-fingerprint.ts', 'packages/recipes/src/runtime-ingredient-audit.ts',
  'packages/recipes/src/refresh/schema.ts', 'packages/recipes/src/refresh/compiler.ts', 'packages/recipes/src/refresh/release.ts', ...registry.batches.map((entry) => entry.source)];
const recordCompatibilityPath = 'packages/recipes/src/refresh/release.ts';
const recordBefore = 'auditSummary: z.record(z.unknown()),';
const recordAfter = 'auditSummary: z.record(z.string(), z.unknown()),';
function assertPinnedBaseline(file, current, baseline) {
  // ADR-074 permits only this exact Zod signature change; all other bytes stay pinned.
  if (file === recordCompatibilityPath) {
    const source = baseline.toString('utf8');
    assert.equal(source.split(recordBefore).length, 2, 'ZOD_RECORD_BASELINE_MISMATCH');
    baseline = Buffer.from(source.replace(recordBefore, recordAfter));
  }
  assert.equal(sha(current), sha(baseline), `PINNED_BASELINE_DRIFT: ${file}`);
}
assertPinnedBaseline(recordCompatibilityPath, recordAfter, recordBefore);
assert.throws(() => assertPinnedBaseline(recordCompatibilityPath, `${recordAfter} drift`, recordBefore), /PINNED_BASELINE_DRIFT/u);
assert.throws(() => assertPinnedBaseline('other.ts', recordAfter, recordBefore), /PINNED_BASELINE_DRIFT/u);
assert.throws(() => assertPinnedBaseline(recordCompatibilityPath, recordAfter, recordBefore.repeat(2)), /ZOD_RECORD_BASELINE_MISMATCH/u);
const baselineFiles = beforeFiles.map((file) => {
  const current = read(file);
  const baseline = execFileSync('git', ['show', `${BASE_SHA}:${file}`], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 });
  assertPinnedBaseline(file, current, baseline);
  const matchesBaseCommit = sha(current) === sha(baseline);
  return { path: file, sha256: sha(current), matchesBaseCommit,
    ...(!matchesBaseCommit ? { compatibilityException: 'ADR-074', baseSha256: sha(baseline) } : {}) };
});
execFileSync(process.execPath, ['scripts/recipe-intelligence-v3-source-scan.mjs', 'check'], { cwd: ROOT, stdio: 'pipe' });
const vite = await createServer({ cacheDir: 'node_modules/.vite/recipe-intelligence-v3', server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { ALL_RECIPES } = await vite.ssrLoadModule('/packages/recipes/src/data.ts');
  const factory = await vite.ssrLoadModule('/packages/recipes/src/import/index.ts');
  const refresh = await vite.ssrLoadModule('/packages/recipes/src/refresh/index.ts');
  const { fingerprintRecipes } = await vite.ssrLoadModule('/packages/recipes/src/catalog-fingerprint.ts');
  const { compileV3Candidate, v3Fingerprint, V3EditsSchema, V3_COMPILER_VERSION } = await vite.ssrLoadModule('/packages/recipes/src/intelligence-v3.ts');
  const approved = [];
  for (const entry of registry.batches) {
    const result = await factory.compileImportBatch(new Uint8Array(read(entry.source)), factory.importFormatForPath(entry.source), { legacy: ALL_RECIPES, approvedBatches: approved });
    assert(result.ok, `approved batch failed: ${entry.batchId}`);
    approved.push({ header: result.header, recipes: result.recipes });
  }
  const runtime = [...ALL_RECIPES, ...approved.flatMap((batch) => batch.recipes.map((recipe) => recipe.runtime))];
  const release = json(releasePath);
  const manifest = refresh.RefreshSourceManifestSchema.parse(json(`${V2}/manifest.json`));
  assert.equal(runtime.length, 500);
  assert.equal(new Set(runtime.map((recipe) => recipe.id)).size, 500);
  assert.equal(await fingerprintRecipes(runtime), release.expectedRuntimeFingerprint, 'CATALOG_FINGERPRINT_DRIFT');
  assert.deepEqual([...runtime.map((recipe) => recipe.id)].sort(), [...release.orderedRecipeIds].sort());
  assert.deepEqual(manifest.orderedRecipeIds, release.orderedRecipeIds, 'ordered ID drift');
  assert.equal(await refresh.fingerprintRefreshArtifact(manifest.fileHashes), manifest.canonicalArtifactSha256);
  for (const entry of manifest.fileHashes) assert.equal(sha(read(`${V2}/${entry.path}`)), entry.sha256, `V2 file drift: ${entry.path}`);
  const rawRecipes = manifest.orderedRecipeIds.map((id) => json(`${V2}/recipes/${id}.json`));
  const recipes = rawRecipes.map((recipe) => refresh.RefreshRecipeSchema.parse(recipe));
  refresh.assertRefreshCatalog(recipes, release.orderedRecipeIds);
  const projection = await refresh.compileRefreshCatalog(recipes);
  assert.equal(projection.provisionalRuntimeProjectionFingerprint, manifest.provisionalRuntimeProjectionFingerprint);
  const eligibility = refresh.deriveRefreshReleaseEligibility(recipes);
  assert.deepEqual(eligibility, manifest.releaseEligibility, 'release eligibility drift');
  const runtimeById = new Map(runtime.map((recipe) => [recipe.id, recipe]));
  // Research snapshots use Python sorted compact JSON, independently of runtime fingerprints.
  const runtimeSnapshotHashes = JSON.parse(execFileSync('python3', ['-c',
    'import sys,json,hashlib; print(json.dumps({r["id"]:hashlib.sha256(json.dumps(r,ensure_ascii=False,sort_keys=True,separators=(",",":")).encode()).hexdigest() for r in json.load(sys.stdin)}))',
  ], { input: JSON.stringify(runtime), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
  const scanPath = `${DATA}/research/source-scan.json`;
  const scan = json(scanPath);
  const scanById = new Map(scan.recipes.map((entry) => [entry.recipeId, entry]));
  const researchFiles = readdirSync(path.join(ROOT, DATA, 'research'))
    .filter((file) => /^(?:pilot|batch-(?:0[2-9]|1[0-9]|2[0-5]))-evidence\.json$/u.test(file))
    .sort((a, b) => a.startsWith('pilot') ? -1 : b.startsWith('pilot') ? 1 : a.localeCompare(b));
  assert(researchFiles.includes('pilot-evidence.json'), 'pilot evidence required');
  assert.equal(researchFiles.length, 25, 'all 25 research outcomes required');
  const research = new Map();
  const packets = [];
  const edits = [];
  const evidenceInputs = [scanPath];
  for (const file of researchFiles) {
    const evidencePath = `${DATA}/research/${file}`;
    const editsPath = evidencePath.replace('-evidence.json', '-edits.json');
    const evidence = json(evidencePath);
    const packetEdits = V3EditsSchema.parse(json(editsPath)).edits;
    const batchId = file === 'pilot-evidence.json' ? 'v3-01' : `v3-${file.slice(6, 8)}`;
    assert.equal(evidence.schemaVersion, 1);
    assert(Number.isFinite(Date.parse(evidence.generatedAt)), 'research generation timestamp missing');
    assert.equal(evidence.program, PROGRAM);
    assert.equal(evidence.sourcePromotionAllowed, false);
    assert.equal(evidence.runtimePromotionAllowed, false);
    assert.equal(evidence.humanReview, 'PENDING');
    assert.equal(evidence.recipes.length, 20);
    const packetRecipes = new Map(evidence.recipes.map((entry, index) => [entry.recipeId, { ...entry, index, evidencePath, batchId }]));
    assert.equal(packetRecipes.size, 20, 'research packet has duplicate recipes');
    const packetSources = new Map(evidence.sources.map((source) => [source.sourceId, source]));
    assert.equal(packetSources.size, evidence.sources.length);
    for (const source of evidence.sources) {
      assert.equal(source.humanReview, 'PENDING');
      assert.equal(source.sourceId, `source-${sha(source.url).slice(0, 16)}`);
      assert(source.recipeIds.length && source.recipeIds.every((id) => packetRecipes.get(id)?.sourceIds.includes(source.sourceId)), 'research source ownership invalid');
      assert(Number.isFinite(Date.parse(source.retrievedAt)), 'source retrieval timestamp missing');
      if (source.evidenceStatus.includes('SOURCE_CONTENT_READ')) {
        assert(source.reviewedFacts?.length && source.relevanceReview?.status === 'AGENT_BOUNDED', 'research reading scope missing');
        assert(source.evidenceStatus.includes('SOURCE_RELEVANCE_VERIFIED'), 'bounded relevance review missing');
        for (const fact of source.reviewedFacts) assert(fact.factId && fact.locator && fact.reviewerSummary && fact.supportLimits, 'source fact scope missing');
      }
    }
    for (const entry of packetRecipes.values()) {
      assert(runtimeById.has(entry.recipeId), 'research recipe ID unknown');
      assert(!research.has(entry.recipeId), 'recipe belongs to multiple research packets');
      assert.equal(entry.humanReview, 'PENDING');
      assert.equal(entry.fullRecipeVerification, 'NOT_COMPLETE');
      assert.equal(entry.sourcePromotionAllowed, false);
      assert.equal(entry.v2.sourcePath, `${V2}/recipes/${entry.recipeId}.json`);
      assert.equal(entry.v2.fileSha256, sha(read(entry.v2.sourcePath)), 'research evidence stale');
      assert.equal(entry.v1.recordSha256, runtimeSnapshotHashes[entry.recipeId], `V1 research snapshot stale: ${entry.recipeId}`);
      assert(entry.sourceIds.every((id) => packetSources.get(id)?.recipeIds.includes(entry.recipeId)), 'research source missing');
      assert.equal(new Set(entry.claims.map((claim) => claim.id)).size, entry.claims.length);
      const raw = rawRecipes[manifest.orderedRecipeIds.indexOf(entry.recipeId)];
      assert.equal(entry.title, raw.identity.title, 'research title drift');
      for (const claim of entry.claims) {
        assert(['FACT_SUPPORTED', 'SOURCE_CONFLICT', 'SOURCE_CONTENT_READ', 'SOURCE_UNAVAILABLE'].includes(claim.status), 'invalid claim status');
        assert(claim.findingType && claim.evidenceBasis && claim.reviewerSummary && claim.supportLimits, 'claim scope missing');
        assert(claim.sourceIds.every((id) => packetSources.has(id) && entry.sourceIds.includes(id)), 'claim source missing');
        assertClaimFacts(claim, packetSources);
        for (const position of claim.ingredientPositions) assert(Number.isInteger(position) && raw.ingredients[position]?.position === position, 'claim ingredient missing');
        for (const number of claim.stepNumbers) assert(Number.isInteger(number) && raw.steps[number - 1]?.stepNumber === number, 'claim step missing');
        for (const pointer of claim.v2Pointers) {
          assert(/^\/(?:[a-zA-Z0-9]+\/)*[a-zA-Z0-9]+$/u.test(pointer), 'invalid claim pointer');
          let target = raw;
          for (const key of pointer.slice(1).split('/')) { assert(target !== null && typeof target === 'object' && Object.hasOwn(target, key), 'claim pointer missing'); target = target[key]; }
        }
      }
      research.set(entry.recipeId, entry);
    }
    const claims = evidence.recipes.flatMap((entry) => entry.claims);
    assert.deepEqual(evidence.summary, {
      recipeCount: evidence.recipes.length, sourceAttemptCount: evidence.sources.length,
      sourceStatusCounts: counts(evidence.sources.flatMap((source) => source.evidenceStatus)),
      claimCount: claims.length, claimStatusCounts: counts(claims.map((claim) => claim.status)),
      findingTypeCounts: counts(claims.map((claim) => claim.findingType)), humanApprovedCount: 0,
      fullRecipeVerificationCompleted: 0, productionMutations: 0,
    }, 'research summary drift');
    for (const edit of packetEdits) {
      const entry = packetRecipes.get(edit.recipeId);
      assert(entry, 'edit recipe outside research packet');
      for (const reference of edit.evidenceReferences) {
        const prefix = `${evidencePath}#/recipes/${entry.index}/claims/`;
        assert(reference.startsWith(prefix), 'edit evidence belongs to a different recipe');
        const index = reference.slice(prefix.length);
        assert(/^(?:0|[1-9]\d*)$/u.test(index) && entry.claims[Number(index)]?.v2Pointers.includes(edit.path), 'edit evidence does not resolve to affected field');
      }
    }
    edits.push(...packetEdits);
    evidenceInputs.push(evidencePath, editsPath);
    packets.push({ batchId, evidencePath, editsPath, summary: evidence.summary });
  }
  assert.equal(research.size, 500, 'all 500 research outcomes required');
  const pilotIds = [...research.values()].filter((entry) => entry.batchId === 'v3-01').map((entry) => entry.recipeId);
  const batchIds = [...pilotIds, ...release.orderedRecipeIds.filter((id) => !pilotIds.includes(id))];
  for (const entry of research.values()) assert(batchIds.slice((Number(entry.batchId.slice(3)) - 1) * 20, Number(entry.batchId.slice(3)) * 20).includes(entry.recipeId), 'research recipe belongs to different batch');
  const titles = counts(recipes.map((recipe) => normalize(recipe.identity.title)));
  const candidates = [];
  const rows = [];
  const conservation = [];
  const concepts = new Map();
  const reconciliation = json(`${V2}/ingredient-reconciliation.json`).map((entry) => refresh.RefreshIngredientReconciliationRowSchema.parse(entry));
  for (const [index, source] of recipes.entries()) {
    const id = source.identity.id;
    const v1 = runtimeById.get(id);
    const compiled = await compileV3Candidate(v1, rawRecipes[index], edits.filter((edit) => edit.recipeId === id));
    const candidate = compiled.content;
    const meta = compiled.metadata;
    const researchEntry = research.get(id);
    const scanEntry = scanById.get(id);
    const unitProblems = [...new Set(source.ingredients.flatMap((line) => [
      ...(line.quantity.kind === 'qualitative' ? ['qualitative_quantity'] : []),
      ...(line.quantity.runtime === null ? ['runtime_quantity_missing'] : []),
      ...(line.quantity.evidence === 'estimated' ? ['estimated_conversion'] : []),
    ]))].sort();
    const recipeClaims = researchEntry?.claims ?? [];
    const issues = [...meta.issues,
      ...(normalize(v1.title) !== normalize(source.identity.title) ? ['TITLE_SEMANTIC_DRIFT_REVIEW'] : []),
      ...(titles[normalize(source.identity.title)] > 1 ? ['POTENTIAL_TITLE_DUPLICATE'] : []),
      ...recipeClaims.filter((claim) => claim.severity !== 'info').map((claim) => `RESEARCH:${claim.id}`),
    ].sort();
    const priority = recipeClaims.some((claim) => claim.severity === 'critical') ? 'P0'
      : issues.includes('INGREDIENT_ID_UNRESOLVED') || unitProblems.length ? 'P1' : 'P2';
    rows.push({
      recipeId: id, slug: source.identity.slug, title: source.identity.title,
      cuisine: source.content.cuisine, category: source.content.category ?? null, region: source.content.region ?? null,
      runtimeIngredientCount: v1.ingredients.length, v2IngredientCount: source.ingredients.length,
      runtimeStepCount: v1.steps.length, v2StepCount: source.steps.length,
      missingFields: ['category', 'region'].filter((key) => source.content[key] === undefined),
      unitProblems, ingredientIdentityProblems: candidate.ingredients.filter((line) => !line.canonicalIngredientId || !['existing_canonical_id', 'reviewed_new_canonical_id'].includes(line.reconciliation)).length,
      nutritionState: source.nutrition.certification, sourceVerificationState: 'NOT_CONTENT_VERIFIED',
      sourceAttemptStatus: scanEntry.status, researchState: researchEntry ? 'BOUNDED_SOURCE_INVENTORY_REVIEW_PENDING' : 'NOT_RESEARCHED',
      potentialDuplication: titles[normalize(source.identity.title)] > 1 ? ['same_normalized_title'] : [],
      semanticDrift: normalize(v1.title) !== normalize(source.identity.title) ? ['title_changed'] : [],
      qualityIssues: issues, suggestedUpgradePriority: priority, qualityScore: null,
      culinaryQualityAssessment: 'UNASSESSED', validationResult: 'CANDIDATE_SCHEMA_VALID',
    });
    candidates.push({
      ...meta, sourceFileSha256: sha(read(meta.sourceReference)),
      payload: { base: meta.sourceReference, edits: meta.edits, reconstruction: 'compileV3Candidate(V1, immutable V2, edits).content' },
      provenance: { urlAttempt: `${scanPath}#/recipes/${index}`, researchEvidence: researchEntry ? `${researchEntry.evidencePath}#/recipes/${researchEntry.index}` : null },
      comparison: {
        v1ToV2: ['title', 'description', 'cuisine', 'category', 'region', 'cookTimeMinutes', 'servings', 'difficulty', 'ingredients', 'steps', 'nutrition', 'tags']
          .filter((key) => JSON.stringify(v1[key] ?? null) !== JSON.stringify(key === 'title' ? source.identity.title : projection.recipes[index][key] ?? null)),
        v2ToCandidate: meta.edits.map((edit) => ({ ...edit, impactedConsumers: [edit.path.endsWith('/note') || edit.path.startsWith('/steps/') || edit.path.startsWith('/content/')
          ? 'recipe editorial content on future promotion' : 'ingredient authority and projection on future promotion'], reviewStatus: 'NEEDS_REVIEW' })),
      },
      validation: { schema: 'PASS', identity: 'PASS', sourceConservation: 'PASS', runtimeCompatibility: 'BLOCKED', humanReview: 'PENDING' },
      qualityReport: `${OUT}/audit/RECIPE_V3_DATA_QUALITY.json#/recipes/${index}`,
      requiredReviewActions: issues,
    });
    assert.equal(await v3Fingerprint(source.nutrition), await v3Fingerprint(candidate.nutrition));
    const restored = structuredClone(candidate);
    for (const edit of meta.edits) {
      const keys = edit.path.slice(1).split('/');
      let target = restored;
      for (const key of keys.slice(0, -1)) target = target[key];
      assert.deepEqual(target[keys.at(-1)], edit.newValue, 'candidate edit witness drift');
      target[keys.at(-1)] = edit.oldValue;
    }
    assert.deepEqual(restored, source, 'candidate source reversal drift');
    const select = (predicate) => candidate.ingredients.filter(predicate).map((line) => line.position);
    conservation.push({
      recipeId: id, sourceLineCount: source.ingredients.length, candidateLineCount: candidate.ingredients.length,
      conservedPositions: select(() => true),
      usageRoles: Object.fromEntries([...new Set(candidate.ingredients.map((line) => line.usageRole))].sort().map((role) => [role, select((line) => line.usageRole === role)])),
      sourceMarkedForShopping: select((line) => line.includeInShopping), sourceMarkedForNutrition: select((line) => line.includeInNutrition),
      sourceQuantityUnknownForPurchase: select((line) => line.includeInShopping && line.quantity.runtime === null),
      estimatedConversions: select((line) => line.quantity.evidence === 'estimated'),
      provisionalRuntimeProjected: select((line) => refresh.runtimeIngredientFromSource(line) !== null),
      runtimeExclusions: meta.runtimeExclusions, releaseDemandAllowed: false,
    });
    for (const line of candidate.ingredients) {
      const key = line.canonicalIngredientId ?? `unresolved:${normalize(line.sourceName)}`;
      if (!concepts.has(key)) concepts.set(key, { concept: key, sourceNames: new Set(), recipeIds: new Set(), resolutions: new Set(), lineCount: 0 });
      const entry = concepts.get(key);
      entry.sourceNames.add(line.sourceName); entry.recipeIds.add(id); entry.resolutions.add(line.reconciliation); entry.lineCount++;
    }
  }
  emit(`${OUT}/manifests/baseline.json`, {
    schemaVersion: 1, program: PROGRAM, repository: 'hello-tako/Takolio', repositoryId: 1422954151, baseSha: BASE_SHA,
    currentRelease: { releaseId: release.releaseId, expectedRecipeCount: 500, orderedRecipeIds: release.orderedRecipeIds,
      expectedRuntimeFingerprint: release.expectedRuntimeFingerprint, actualRuntimeFingerprint: await fingerprintRecipes(runtime), manifestSha256: sha(read(releasePath)) },
    v2: { canonicalArtifactSha256: manifest.canonicalArtifactSha256, provisionalRuntimeProjectionFingerprint: projection.provisionalRuntimeProjectionFingerprint,
      recipeCount: recipes.length, ingredientCount: recipes.reduce((n, recipe) => n + recipe.ingredients.length, 0), stepCount: recipes.reduce((n, recipe) => n + recipe.steps.length, 0), fileHashesVerified: manifest.fileHashes.length },
    baselineFiles, productionMutations: 0,
  });
  emit(`${OUT}/manifests/coverage.json`, {
    schemaVersion: 1, recipeCount: rows.length, ids: { runtime: runtime.length, v2: recipes.length, exactSetMatch: true },
    candidateSchemaValidated: candidates.length, candidateEditoriallyChanged: candidates.filter((entry) => entry.edits.length).length,
    sourceAttempts: scan.recipes.length, boundedPilotResearch: pilotIds.length, boundedSourceInventory: research.size, fullCulinaryReviewCompleted: 0, humanApproved: 0,
    priorityCounts: counts(rows.map((row) => row.suggestedUpgradePriority)), nutritionCounts: counts(rows.map((row) => row.nutritionState)),
    sourceAttemptCounts: counts(rows.map((row) => row.sourceAttemptStatus)),
    ingredientIdentityProblemRows: rows.filter((row) => row.ingredientIdentityProblems).length,
    quantityProblemRows: rows.filter((row) => row.unitProblems.length).length, titleDriftRows: rows.filter((row) => row.semanticDrift.length).length,
  });
  emit(`${OUT}/manifests/quality-summary.json`, { schemaVersion: 1, status: 'UNASSESSED', scoreWeights: null,
    explanation: 'No calibrated culinary scoring. Priority is a conservative rule-based review queue, not a quality score.',
    proposedWeightsPendingPilotCalibration: { ingredientCompleteness: 20, quantityUnitCorrectness: 20, instructions: 20, provenance: 15, metadata: 10, feasibility: 10, nutrition: 5 } });
  const conceptRows = [...concepts.values()].sort((a, b) => a.concept < b.concept ? -1 : a.concept > b.concept ? 1 : 0).map((entry) => ({
    ...entry, sourceNames: [...entry.sourceNames].sort(), recipeIds: [...entry.recipeIds].sort(), resolutions: [...entry.resolutions].sort(),
    decision: entry.resolutions.size === 1 && entry.resolutions.has('existing_canonical_id') ? 'MATCH_EXISTING_CANONICAL' : 'AMBIGUOUS_NEEDS_REVIEW',
    decisionBasis: 'Existing source state only; no new semantic reconciliation or authority promotion.', humanReview: 'PENDING', promotionAllowed: false,
  }));
  emit(`${OUT}/manifests/ingredient-reconciliation.json`, {
    schemaVersion: 1, source: `${V2}/ingredient-reconciliation.json`, reconciliationRows: reconciliation.length,
    states: counts(reconciliation.map((row) => row.resolution)), ingredientConceptCount: concepts.size,
    distinctProvisionalIngredientIds: new Set(recipes.flatMap((recipe) => recipe.ingredients.map((line) => line.canonicalIngredientId)).filter((id) => id?.startsWith('ING_ENR_'))).size,
    provisionalReconciliationRows: reconciliation.filter((row) => row.resolution === 'provisional_new_canonical_id').length,
    promotionAllowed: false, runtimeProjectionAllowed: false, concepts: conceptRows,
  });
  emit(`${OUT}/manifests/ingredient-conservation.json`, { schemaVersion: 1, recipeCount: 500, sourceLineCount: conservation.reduce((n, row) => n + row.sourceLineCount, 0),
    candidateLineCount: conservation.reduce((n, row) => n + row.candidateLineCount, 0), semantics: 'Source role flags preserved, not certified as correct. Every source position remains reconstructible from the hashed V2 file and exact candidate edits.', recipes: conservation });
  emit(`${OUT}/manifests/nutrition-coverage.json`, { schemaVersion: 1, states: counts(rows.map((row) => row.nutritionState)),
    profilesChanged: 0, certifiedPromotionAllowed: false, reason: 'Source profiles retained; no V3 nutrition certification.' });
  emit(`${OUT}/manifests/source-evidence.json`, { schemaVersion: 1, declaredContentVerifiedRows: candidates.reduce((n, entry) => n + entry.sourceContentVerified, 0), sourceAttempts: scan.summary,
    boundedResearch: packets, boundedResearchRecipeCount: research.size, scanPath, sourceContentPromotionAllowed: false });
  emit(`${OUT}/manifests/release-readiness.json`, { schemaVersion: 1, state: 'RECIPE_V3_RESEARCH_IN_PROGRESS', releaseEligibility: eligibility,
    blockers: eligibility.blockers, additionalPrerequisites: ['CULINARY_REVIEW_500', 'USER_CONTENT_VERSION_PINNING', 'INDEPENDENT_HUMAN_REVIEW', 'SAME_SOURCE_STAGING', 'OPERATOR_RELEASE_APPROVAL'],
    productionReady: false, productionMutationCount: 0 });
  emit(`${DATA}/candidates.json`, { schemaVersion: 3, compilerVersion: V3_COMPILER_VERSION, program: PROGRAM, sourceCommit: BASE_SHA,
    sourceArtifactSha256: manifest.canonicalArtifactSha256, evidenceInputs: evidenceInputs.map((file) => ({ path: file, sha256: sha(read(file)) })),
    runtimePromotionAllowed: false, recipes: candidates });
  emit(`${OUT}/audit/RECIPE_V3_DATA_QUALITY.json`, { schemaVersion: 1, program: PROGRAM, culinaryQualityAssessment: 'UNASSESSED', recipes: rows });
  const fields = Object.keys(rows[0]);
  emit(`${OUT}/audit/RECIPE_V3_DATA_QUALITY.csv`, `${fields.join(',')}\n${rows.map((row) => fields.map((field) => csvCell(row[field])).join(',')).join('\n')}\n`);
  const candidateById = new Map(candidates.map((entry) => [entry.recipeId, entry]));
  emit(`${OUT}/batches/batch-ledger.json`, { schemaVersion: 1, program: PROGRAM, sourceCommit: BASE_SHA, batchSize: 20, plannedBatches: 25,
    completedBatches: 0, recipesAudited: 500, recipesWithSourceAttempt: 500, recipesWithBoundedPilotResearch: pilotIds.length, recipesWithBoundedSourceInventory: research.size,
    recipesAutomatedValidated: 500, recipesHumanApproved: 0, recipesBlocked: 500,
    batches: Array.from({ length: 25 }, (_, index) => ({ batchId: `v3-${String(index + 1).padStart(2, '0')}`, sourceCommit: BASE_SHA,
      reviewStatus: 'NEEDS_REVIEW', validationResult: 'CANDIDATE_SCHEMAS_VALID_RELEASE_BLOCKED',
      recipes: batchIds.slice(index * 20, index * 20 + 20).map((id) => {
        const entry = candidateById.get(id);
        return { recipeId: id, beforeFingerprints: { v1: entry.sourceV1Fingerprint, v2: entry.sourceV2Fingerprint },
          candidateFingerprint: entry.candidateContentFingerprint, sourceEvidence: entry.provenance,
          qualityResult: 'UNASSESSED', unresolvedItems: entry.requiredReviewActions, validationResult: entry.validation, reviewStatus: 'NEEDS_REVIEW' };
      }) })) });
  emit(`${OUT}/03_500_RECIPE_QUALITY_AUDIT.md`, `# 500-recipe quality audit\n\nGenerated by scripts/recipe-intelligence-v3-audit.mjs.\n\n500 identities, source snapshots/provenance and lossless candidate schemas validated. All remain NEEDS_REVIEW.\n500 primary URL attempts; ${research.size} bounded source inventories across ${packets.length} research packets; zero full culinary approvals.\nCulinary scoring remains UNASSESSED pending pilot calibration. Review priority is a conservative rule.\nAll source ingredient/step/quantity/nutrition records remain reconstructible; no runtime promotion.\n\nPer-ID evidence: audit/RECIPE_V3_DATA_QUALITY.json, data/recipe-intelligence/v3/candidates.json.\n25 actual batches: batches/batch-ledger.json.\n`);
  for (const [file, contents] of outputs) {
    if (check) assert.equal(read(file).toString('utf8'), contents, `generated artifact drift: ${file}`);
    else { mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true }); writeFileSync(path.join(ROOT, file), contents); }
  }
  console.log(`recipe-intelligence-v3-audit=ok mode=${check ? 'check' : 'build'} recipes=${candidates.length} edits=${edits.length} batches=25 blockers=${eligibility.blockers.join('|')}`);
} finally {
  await vite.close();
}
