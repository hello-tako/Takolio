import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { compileImportBatch, importFormatForPath } from '../../packages/recipes/src/import';
import { compileV3Candidate, V3EditsSchema } from '../../packages/recipes/src/intelligence-v3';

const root = process.cwd();
const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const researchDir = 'data/recipe-intelligence/v3/research';
const packetEdits = () => readdirSync(path.join(root, researchDir))
  .filter((file) => /^(?:pilot|batch-(?:0[2-9]|1[0-9]|2[0-5]))-edits\.json$/u.test(file))
  .flatMap((file) => V3EditsSchema.parse(readJson(`${researchDir}/${file}`)).edits);
const runtimeById = new Map(ALL_RECIPES.map((recipe) => [recipe.id, recipe]));
beforeAll(async () => {
  const approved = [];
  for (const entry of readJson('data/recipe-import/approved-batches.json').batches) {
    const result = await compileImportBatch(new Uint8Array(readFileSync(path.join(root, entry.source))), importFormatForPath(entry.source), { legacy: ALL_RECIPES, approvedBatches: approved });
    expect(result.ok).toBe(true);
    approved.push({ header: result.header, recipes: result.recipes });
    for (const recipe of result.recipes) runtimeById.set(recipe.runtime.id, recipe.runtime);
  }
  expect(runtimeById.size).toBe(500);
});

describe('V3 complete candidate artifacts', () => {
  it('rebuilds every candidate and generated artifact without drift', async () => {
    await promisify(execFile)(process.execPath, ['scripts/recipe-intelligence-v3-audit.mjs', '--check'], { cwd: root, timeout: 120_000 });
  }, 120_000);

  it('covers all 500 identities and 25 batches without approvals or release claims', () => {
    const release = readJson('packages/recipes/src/import/catalog-release.current.json');
    const candidates = readJson('data/recipe-intelligence/v3/candidates.json');
    const batches = readJson('docs/ai/recipe-intelligence-v3/batches/batch-ledger.json');
    const readiness = readJson('docs/ai/recipe-intelligence-v3/manifests/release-readiness.json');
    expect(candidates.recipes.map((recipe) => recipe.recipeId)).toEqual(release.orderedRecipeIds);
    expect(new Set(candidates.recipes.map((recipe) => recipe.slug)).size).toBe(500);
    expect(batches.batches).toHaveLength(25);
    expect(batches.batches.every((batch) => batch.recipes.length === 20 && batch.reviewStatus === 'NEEDS_REVIEW')).toBe(true);
    expect(batches.batches.flatMap((batch) => batch.recipes.map((recipe) => recipe.recipeId)).sort()).toEqual([...release.orderedRecipeIds].sort());
    expect(candidates.recipes.every((recipe) => recipe.state === 'NEEDS_REVIEW' && !recipe.humanApproved && !recipe.runtimePromotionAllowed)).toBe(true);
    expect(readiness).toMatchObject({ state: 'RECIPE_V3_RESEARCH_IN_PROGRESS', productionReady: false, productionMutationCount: 0 });
    expect(readiness.blockers).toEqual(['RUNTIME_PROJECTION_LOSS', 'INGREDIENT_RECONCILIATION_INCOMPLETE', 'SOURCE_CONTENT_VERIFICATION_INCOMPLETE', 'NUTRITION_EVIDENCE_INCOMPLETE']);
  });

  it('reconstructs and reverses every real edit, retaining exact generated fingerprints', async () => {
    const candidates = readJson('data/recipe-intelligence/v3/candidates.json');
    const edits = packetEdits();
    const ids = [...new Set(edits.map((patch) => patch.recipeId))];
    for (const id of ids) {
      const record = candidates.recipes.find((recipe) => recipe.recipeId === id);
      expect(record.edits).toEqual(edits.filter((patch) => patch.recipeId === id));
      const input = readJson(record.sourceReference);
      const result = await compileV3Candidate(runtimeById.get(id), input, record.edits);
      expect(result.metadata.candidateContentFingerprint).toBe(record.candidateContentFingerprint);
      expect(result.content.nutrition).toEqual(input.nutrition);
      expect(result.content.research).toEqual(input.research);
      const restored = structuredClone(result.content);
      for (const patch of record.edits) {
        const keys = patch.path.slice(1).split('/');
        let target = restored;
        for (const key of keys.slice(0, -1)) target = target[key];
        expect(target[keys.at(-1)]).toEqual(patch.newValue);
        target[keys.at(-1)] = patch.oldValue;
      }
      expect(restored).toEqual(input);
    }
  });

  it('resolves every edit evidence reference to its own recipe and real claim', () => {
    const edits = packetEdits();
    expect(edits.length).toBeGreaterThan(0);
    for (const patch of edits) for (const reference of patch.evidenceReferences) {
      const match = /^(data\/recipe-intelligence\/v3\/research\/(?:pilot|batch-(?:0[2-9]|1[0-9]|2[0-5]))-evidence\.json)#\/recipes\/(\d+)\/claims\/(\d+)$/u.exec(reference);
      expect(match).not.toBeNull();
      const evidence = readJson(match[1]);
      const recipe = evidence.recipes[Number(match[2])];
      expect(recipe.recipeId).toBe(patch.recipeId);
      expect(recipe.claims[Number(match[3])].v2Pointers).toContain(patch.path);
    }
  });

  it('conserves every source ingredient position and keeps culinary scores unassessed', () => {
    const conservation = readJson('docs/ai/recipe-intelligence-v3/manifests/ingredient-conservation.json');
    const quality = readJson('docs/ai/recipe-intelligence-v3/audit/RECIPE_V3_DATA_QUALITY.json');
    expect(conservation.sourceLineCount).toBe(6766);
    expect(conservation.candidateLineCount).toBe(6766);
    expect(quality.recipes).toHaveLength(500);
    expect(quality.recipes.every((row) => row.qualityScore === null)).toBe(true);
    for (const row of conservation.recipes) {
      expect(row.conservedPositions).toEqual(Array.from({ length: row.sourceLineCount }, (_, index) => index));
      expect(row.releaseDemandAllowed).toBe(false);
    }
  });
});
