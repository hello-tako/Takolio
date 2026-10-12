import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';

const check = process.argv.slice(2).join(' ') === '--check';
assert(check || process.argv.length === 2, 'Usage: generate-pilot.mjs [--check]');
const root = process.cwd();
const output = 'docs/backend-upgrade/b05a/pilot.sample.json';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const queueRoot = 'artifacts/runtime-ingredient-v2';
const queueNames = ['ingredient-authority-queue.json', 'transformation-audit.json', 'source-verification-queue.json'];
const queueBytes = queueNames.map((name) => readFileSync(`${queueRoot}/${name}`));
const [identities, transformations, sources] = queueBytes.map((bytes) => JSON.parse(bytes));
const manifest = read('data/recipe-refresh/v2/manifest.json');
assert.equal(manifest.canonicalArtifactSha256, 'da87da20475fa8d7ec92c716e899ee572339573258ae6d9cc7f3f8f554f2d695');
for (const queue of [identities, transformations, sources]) assert.equal(queue.canonicalSourceSha256, manifest.canonicalArtifactSha256);
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false },
  appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { canonicalJson } = await vite.ssrLoadModule('/packages/recipes/src/import/identity.ts');
  const { RefreshRecipeSchema, fingerprintRefreshArtifact } = await vite.ssrLoadModule('/packages/recipes/src/refresh/index.ts');
  const { auditRuntimeIngredientTransformations } = await vite.ssrLoadModule('/packages/recipes/src/runtime-ingredient-audit.ts');
  const fileHashes = manifest.fileHashes.map((entry) => ({ path: entry.path,
    sha256: sha(readFileSync(`data/recipe-refresh/v2/${entry.path}`)) }));
  assert.deepEqual(fileHashes, manifest.fileHashes);
  assert.equal(await fingerprintRefreshArtifact(fileHashes), manifest.canonicalArtifactSha256);
  const recipes = manifest.orderedRecipeIds.map((id) => RefreshRecipeSchema.parse(read(`data/recipe-refresh/v2/recipes/${id}.json`)));
  assert.deepEqual(auditRuntimeIngredientTransformations(recipes).rows, transformations.rows);
  const recipeById = new Map(recipes.map((recipe) => [recipe.identity.id, recipe]));
  const rank = (key) => sha(`B05b-pilot-1:${manifest.canonicalArtifactSha256}:${key}`);
  const lineKey = (row) => `${row.recipeId}:${row.position}`;
  const ranked = (rows, key) => [...rows].sort((a, b) => compare(rank(key(a)), rank(key(b))) || compare(key(a), key(b)));
  const chosenLines = new Map();
  const add = (rows, n) => {
    for (const row of ranked(rows, lineKey)) {
      if (chosenLines.has(lineKey(row))) continue;
      chosenLines.set(lineKey(row), row);
      if (--n === 0) break;
    }
    assert.equal(n, 0, 'Insufficient candidates for a stratum');
  };
  // Explicit process cases protect salt-bed and frying-oil semantics in the pilot.
  for (const [recipeId, position] of [['vn-hap-01', 1], ['vn-chien-01', 5]]) {
    const row = transformations.rows.find((entry) => entry.recipeId === recipeId && entry.position === position);
    assert(row && row.usageRole === 'process_only');
    chosenLines.set(lineKey(row), row);
  }
  for (const [predicate, count] of [
    [(row) => row.unitClass === 'count', 8],
    [(row) => row.unitClass === 'package', 8],
    [(row) => row.unitClass === 'cultural_measure' && row.currentExclusionReason === null, 8],
    [(row) => row.unitClass === 'cultural_measure' && row.currentExclusionReason !== null, 8],
    [(row) => row.unitClass === 'qualitative', 6],
    [(row) => row.transformationClass === 'PROVISIONAL_INGREDIENT_ID', 8],
    [(row) => row.usageRole === 'process_only', 6],
  ]) add(transformations.rows.filter(predicate), count);
  add(transformations.rows, 60 - chosenLines.size);
  const selectedLines = [...chosenLines.values()].sort((a, b) => compare(lineKey(a), lineKey(b)));
  const selectedConcepts = new Map();
  const addConcepts = (rows, limit) => {
    for (const row of ranked(rows, (entry) => entry.provisionalId)) {
      if (selectedConcepts.size === limit) break;
      selectedConcepts.set(row.provisionalId, row);
    }
  };
  addConcepts(identities.concepts.filter((row) => row.sourceNames.length > 1 || row.currentStates.includes('duplicate_alias')), 12);
  const lineConceptIds = new Set(selectedLines.map((row) => row.ingredientId));
  addConcepts(identities.concepts.filter((row) => lineConceptIds.has(row.provisionalId)), 32);
  addConcepts(identities.concepts, 40);
  const lineRecipeIds = new Set(selectedLines.map((row) => row.recipeId));
  const urlGroups = new Map();
  for (const row of sources.urls) {
    const recipe = recipeById.get(row.recipeId);
    const source = recipe.research.sources.find((entry) => entry.url === row.url && entry.role === row.role);
    assert(source);
    const occurrences = urlGroups.get(row.url) ?? [];
    occurrences.push({ recipeId: row.recipeId, role: row.role,
      sourceOccurrenceSha256: sha(canonicalJson({ recipeId: row.recipeId, ...source })), riskTags: row.riskTags });
    urlGroups.set(row.url, occurrences);
  }
  const urls = ranked([...urlGroups.keys()], (url) => url);
  const chosenUrls = new Set();
  for (const recipeId of ['vn-hap-01', 'vn-chien-01']) {
    const url = urls.find((entry) => urlGroups.get(entry).some((row) => row.recipeId === recipeId));
    assert(url); chosenUrls.add(url);
  }
  for (const url of urls.filter((entry) => urlGroups.get(entry).some((row) => lineRecipeIds.has(row.recipeId)))) {
    if (chosenUrls.size === 16) break;
    chosenUrls.add(url);
  }
  for (const url of urls) { if (chosenUrls.size === 20) break; chosenUrls.add(url); }
  const pending = { assignedReviewer: null, independentReviewer: null, evidenceReference: null,
    decision: 'PENDING', reviewedAt: null, activeMinutes: null, disagreement: null, runtimeAuthority: false };
  const payload = { schemaVersion: 1, classification: 'OFFLINE_SAMPLE_PENDING_HUMAN_REVIEW',
    sampleId: 'B05b-pilot-1', canonicalSourceSha256: manifest.canonicalArtifactSha256,
    baseReleaseId: manifest.baseReleaseId, selection: { algorithm: 'SHA256_RANK_WITH_EXPLICIT_STRATA_V1',
      purpose: 'Risk discovery and throughput measurement; not a random population accuracy estimate',
      targets: { distinctConcepts: 40, distinctTransformationRows: 60, distinctUrls: 20 },
      inputQueues: queueNames.map((name, index) => ({ path: `${queueRoot}/${name}`, sha256: sha(queueBytes[index]) })) },
    identities: [...selectedConcepts.values()].sort((a, b) => compare(a.provisionalId, b.provisionalId)).map((row) => ({
      ...row, subjectSha256: sha(canonicalJson({ provisionalId: row.provisionalId, sourceNames: row.sourceNames })), ...pending })),
    transformations: selectedLines.map((row) => {
      const recipe = recipeById.get(row.recipeId);
      const source = recipe.ingredients.find((entry) => entry.position === row.position);
      assert(source);
      return { ...row, sourceRowSha256: sha(canonicalJson(source)), source,
        nutritionSubjectSha256: sha(canonicalJson(recipe.nutrition)), nutritionCertification: recipe.nutrition.certification, ...pending };
    }),
    sources: [...chosenUrls].sort(compare).map((url) => ({ url, occurrences: urlGroups.get(url)
      .sort((a, b) => compare(canonicalJson(a), canonicalJson(b))), licenseVerified: false, contentVerified: false, ...pending })),
    runtimeAuthority: false, humanReviewComplete: false, fullSourceCoverageComplete: false };
  assert.equal(payload.identities.length, 40); assert.equal(payload.transformations.length, 60); assert.equal(payload.sources.length, 20);
  const bytes = `${JSON.stringify({ ...payload, sampleSha256: sha(canonicalJson(payload)) }, null, 2)}\n`;
  if (check) assert.equal(readFileSync(output, 'utf8'), bytes, 'Pilot deterministic drift');
  else execFileSync('sh', ['-c', 'cat > "$1"', 'write', output], { cwd: root, input: bytes });
  console.log(`pilot-sample=PASS; concepts40/rows60/urls20; human_review=PENDING; runtime_authority=false; sha=${sha(canonicalJson(payload))}`);
} finally { await vite.close(); }
