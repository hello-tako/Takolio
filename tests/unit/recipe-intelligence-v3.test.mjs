import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_RECIPES } from '../../packages/recipes/src/data';
import { compileV3Candidate, V3EditsSchema, v3Fingerprint } from '../../packages/recipes/src/intelligence-v3';

const root = process.cwd();
const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const source = () => readJson('data/recipe-refresh/v2/recipes/vn-canh-01.json');
const runtime = () => structuredClone(ALL_RECIPES.find((recipe) => recipe.id === 'vn-canh-01'));
const edit = (changes = {}) => ({
  recipeId: 'vn-canh-01', path: '/ingredients/0/note', oldValue: source().ingredients[0].note,
  newValue: 'Quantity evidence requires independent review.', reason: 'Bounded evidence clarification.',
  evidenceReferences: ['data/recipe-intelligence/v3/research/pilot-evidence.json#/recipes/0/claims/0'], ...changes,
});

describe('V3 lossless editorial compiler', () => {
  it('clones sources, retains quantities/roles/nutrition, hashes deterministic content', async () => {
    const input = source();
    const before = structuredClone(input);
    const result = await compileV3Candidate(runtime(), input, [edit()]);
    const repeated = await compileV3Candidate(runtime(), input, [edit()]);
    expect(input).toEqual(before);
    expect(result).toEqual(repeated);
    expect(result.content.ingredients[0].note).toBe(edit().newValue);
    const restored = structuredClone(result.content);
    restored.ingredients[0].note = input.ingredients[0].note;
    expect(restored).toEqual(input);
    expect(result.metadata.sourceV2Fingerprint).toBe(await v3Fingerprint(input));
    expect(result.metadata.candidateContentFingerprint).toBe(await v3Fingerprint(result.content));
    expect(result.metadata.candidateContentFingerprint).not.toBe(result.metadata.sourceV2Fingerprint);
    expect(result.metadata).toMatchObject({ state: 'NEEDS_REVIEW', humanApproved: false, runtimePromotionAllowed: false, sourcePreserved: true });
  });

  it('rejects identity and slug drift', async () => {
    await expect(compileV3Candidate({ ...runtime(), id: 'wrong-id' }, source())).rejects.toThrow('RECIPE_ID_MISMATCH');
    await expect(compileV3Candidate({ ...runtime(), slug: 'wrong-slug' }, source())).rejects.toThrow('RECIPE_SLUG_MISMATCH');
    await expect(compileV3Candidate(runtime(), source(), [edit({ recipeId: 'other' })])).rejects.toThrow('RECIPE_ID_MISMATCH');
  });

  it('rejects duplicate ingredient positions, empty ingredients and broken steps', async () => {
    const duplicate = source(); duplicate.ingredients[1].position = 0;
    await expect(compileV3Candidate(runtime(), duplicate)).rejects.toThrow('INGREDIENT_POSITION_INVALID');
    await expect(compileV3Candidate(runtime(), { ...source(), ingredients: [] })).rejects.toThrow();
    const broken = source(); broken.steps[0].stepNumber = 2;
    await expect(compileV3Candidate(runtime(), broken)).rejects.toThrow('STEP_SEQUENCE_INVALID');
  });

  it.each(['/identity/id', '/identity/slug', '/ingredients/0/quantity/amount', '/ingredients/0/includeInShopping',
    '/ingredients/0/canonicalIngredientId', '/content/servings', '/nutrition/certification', '/research/sources/0/verification',
    '/__proto__/polluted', '/ingredients/constructor/prototype', '/ingredients/00/note', '/ingredients/-1/note', '/steps/1e0/instruction'])('rejects forbidden path %s', async (value) => {
    await expect(compileV3Candidate(runtime(), source(), [edit({ path: value })])).rejects.toThrow();
    expect({}.polluted).toBeUndefined();
  });

  it('rejects stale, duplicate, no-op and out-of-bounds edits', async () => {
    await expect(compileV3Candidate(runtime(), source(), [edit({ oldValue: 'stale' })])).rejects.toThrow('EDIT_SOURCE_MISMATCH');
    await expect(compileV3Candidate(runtime(), source(), [edit(), edit()])).rejects.toThrow('DUPLICATE_EDIT_PATH');
    await expect(compileV3Candidate(runtime(), source(), [edit({ newValue: edit().oldValue })])).rejects.toThrow('EDIT_HAS_NO_CHANGE');
    await expect(compileV3Candidate(runtime(), source(), [edit({ path: '/ingredients/999/note' })])).rejects.toThrow('EDIT_PATH_INVALID');
  });

  it('rejects non-finite or schema-invalid values and unknown edit fields', async () => {
    for (const value of [NaN, Infinity, -Infinity]) expect(V3EditsSchema.safeParse({ schemaVersion: 1, edits: [edit({ newValue: value })] }).success).toBe(false);
    await expect(compileV3Candidate(runtime(), source(), [edit({ newValue: 4 })])).rejects.toThrow();
    expect(V3EditsSchema.safeParse({ schemaVersion: 1, edits: [{ ...edit(), humanApproved: true }] }).success).toBe(false);
    await expect(compileV3Candidate(runtime(), source(), [edit({ path: '/content/cookTimeMinutes', oldValue: source().content.cookTimeMinutes, newValue: -1 })])).rejects.toThrow();
  });

  it('preserves process-only lines and truthful null without approving projection', async () => {
    const input = readJson('data/recipe-refresh/v2/recipes/vn-bun-01.json');
    const result = await compileV3Candidate(ALL_RECIPES.find((recipe) => recipe.id === 'vn-bun-01'), input);
    expect(result.content).toEqual(input);
    expect(result.content.nutrition.certification).toBe('null_truthful');
    expect(result.content.nutrition.perServing).toEqual(input.nutrition.perServing);
    const process = input.ingredients.filter((line) => line.usageRole === 'process_only');
    expect(process.length).toBeGreaterThan(0);
    expect(result.content.ingredients.filter((line) => line.usageRole === 'process_only')).toEqual(process);
    expect(result.metadata.runtimePromotionAllowed).toBe(false);
  });
});

describe('V3 canonical fingerprint boundaries', () => {
  it('rejects noncanonical sources and normalized no-op edits', async () => {
    const padded = source(); padded.ingredients[0].sourceName += ' ';
    await expect(compileV3Candidate(runtime(), padded)).rejects.toThrow('SOURCE_NOT_CANONICAL');
    const oldValue = source().steps[0].instruction;
    await expect(compileV3Candidate(runtime(), source(), [edit({ path: '/steps/0/instruction', oldValue, newValue: `${oldValue} ` })])).rejects.toThrow('EDIT_VALUE_NOT_CANONICAL');
  });

  it('rejects nonfinite runtime numbers before fingerprint serialization', async () => {
    for (const value of [Infinity, -Infinity, NaN]) {
      await expect(compileV3Candidate({ ...runtime(), cookTimeMinutes: value }, source())).rejects.toThrow();
      await expect(v3Fingerprint({ nested: [value] })).rejects.toThrow('NON_FINITE_NUMBER');
    }
  });

  it('documents the existing-field ceiling instead of silently adding metadata', async () => {
    const input = source(); delete input.content.category;
    await expect(compileV3Candidate(runtime(), input, [edit({ path: '/content/category', oldValue: null, newValue: 'mon_canh' })])).rejects.toThrow('EDIT_SOURCE_MISMATCH');
  });
});

describe('V3 inherited release diagnostics', () => {
  it('flags null identities even when source reconciliation claims an existing ID', async () => {
    const input = source();
    input.ingredients[0].canonicalIngredientId = null;
    input.ingredients[0].reconciliation = 'existing_canonical_id';
    input.ingredients[0].review = null;
    const result = await compileV3Candidate(runtime(), input);
    expect(result.metadata.issues).toContain('INGREDIENT_ID_UNRESOLVED');
    expect(result.metadata.runtimePromotionAllowed).toBe(false);
  });

  it('flags a projected cultural measurement without requiring an exclusion', async () => {
    const input = source();
    const line = structuredClone(readJson('data/recipe-refresh/v2/recipes/imp-452ef6d0f8ec0de9.json').ingredients[2]);
    input.ingredients = [{ ...line, position: 0 }];
    const result = await compileV3Candidate(runtime(), input);
    expect(result.metadata.runtimeExclusions).toEqual([]);
    expect(result.metadata.issues).toContain('RUNTIME_PROJECTION_LOSS');
  });
});

describe('V3 coordinated identity demotion', () => {
  const demotion = () => {
    const line = source().ingredients[0];
    return Object.entries({ canonicalIngredientId: null, reconciliation: 'ambiguous',
      reconciliationReason: 'Conflicting cut labels require explicit identity review.' })
      .map(([field, value]) => edit({ path: `/ingredients/0/${field}`, oldValue: line[field], newValue: value }));
  };

  it('removes projection authority while preserving every source fact and review gate', async () => {
    const input = source();
    const result = await compileV3Candidate(runtime(), input, demotion());
    const restored = structuredClone(result.content);
    expect(restored.ingredients[0]).toMatchObject({ canonicalIngredientId: null, reconciliation: 'ambiguous', review: null });
    for (const change of demotion()) restored.ingredients[0][change.path.split('/').at(-1)] = change.oldValue;
    expect(restored).toEqual(input);
    expect(result.metadata.runtimeExclusions).toContainEqual({ position: 0, reason: 'other', requiresReviewedTransformation: true });
    expect(result.metadata.issues).toContain('INGREDIENT_ID_UNRESOLVED');
    expect(result.metadata).toMatchObject({ compilerVersion: 2, state: 'NEEDS_REVIEW', humanApproved: false, runtimePromotionAllowed: false });
  });

  it('rejects partial demotion, replacement IDs, promotion and rewriting an existing review', async () => {
    const changes = demotion();
    for (const subset of [changes.slice(0, 1), changes.slice(1), changes.filter((_, index) => index !== 1)]) {
      await expect(compileV3Candidate(runtime(), source(), subset)).rejects.toThrow('IDENTITY_DEMOTION_INVALID');
    }
    for (const [field, newValue] of [['canonicalIngredientId', 'OTHER_BEEF'], ['reconciliation', 'existing_canonical_id'], ['reconciliation', 'invalid']]) {
      await expect(compileV3Candidate(runtime(), source(), changes.map((change) => change.path.endsWith(`/${field}`)
        ? { ...change, newValue } : change))).rejects.toThrow();
    }
    const reviewed = source();
    reviewed.ingredients[0].canonicalIngredientId = 'ING_ENR_TEST';
    reviewed.ingredients[0].reconciliation = 'reviewed_new_canonical_id';
    reviewed.ingredients[0].review = { basis: 'Prior review', evidenceReference: 'evidence.json' };
    await expect(compileV3Candidate(runtime(), reviewed, changes.map((change) => ({ ...change,
      oldValue: reviewed.ingredients[0][change.path.split('/').at(-1)] })))).rejects.toThrow();
    const provisional = source();
    provisional.ingredients[0].reconciliation = 'provisional_new_canonical_id';
    await expect(compileV3Candidate(runtime(), provisional, changes.map((change) => ({ ...change,
      oldValue: provisional.ingredients[0][change.path.split('/').at(-1)] })))).rejects.toThrow();
  });
});
