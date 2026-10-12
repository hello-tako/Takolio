import { describe, expect, it } from 'vitest';
import { assessIngredientV2Consumers } from '../../packages/recipes/src/ingredient-v2-consumers';
import type { RuntimeIngredientV2 } from '../../packages/recipes/src/runtime-ingredient-v2';
const line = (change: Partial<RuntimeIngredientV2> = {}): RuntimeIngredientV2 => ({
  sourcePosition: 0, ingredientId: 'GARLIC', name: 'Test garlic', optional: false, authority: 'existing', authorityEvidence: null,
  display: { text: '100 g', scaling: 'unresolved' },
  shopping: { kind: 'measured', quantity: { amount: 100, unit: 'g' }, scaling: 'proportional', conversionEvidence: null },
  process: { kind: 'none' }, consumed: { kind: 'unknown', reason: 'unreviewed edible quantity' }, ...change,
});
describe('Ingredient V2 offline consumer safety', () => {
  it('keeps independent shopping and nutrition readiness', () => {
    const result = assessIngredientV2Consumers([line()], 2);
    expect(result.consumers.shopping.usable).toBe(true);
    expect(result.consumers.nutrition.usable).toBe(false);
    expect(result.runtimeAuthority).toBe(false);
  });
  it('keeps unknown demand in restrictions without treating it as zero stock', () => {
    const result = assessIngredientV2Consumers([line({ shopping: { kind: 'unresolved', text: 'some', reason: 'unknown' } })]);
    expect(result.restrictionIds).toEqual(['GARLIC']);
    for (const name of ['planner', 'shopping', 'cooking'] as const) expect(result.consumers[name].usable).toBe(false);
  });
  it('blocks provisional identities in every consumer', () => {
    const result = assessIngredientV2Consumers([line({ ingredientId: 'ING_ENR_TEST', authority: 'provisional' })]);
    expect(result.restrictionIds).toEqual(['ING_ENR_TEST']);
    expect(Object.values(result.consumers).every((consumer) => !consumer.usable)).toBe(true);
  });
  it('requires reviewed exclusions and preserves process scaling constraints', () => {
    const result = assessIngredientV2Consumers([line({ shopping: { kind: 'none', reason: 'reviewed_non_shopping', evidence: null },
      process: { kind: 'measured', amount: 100, unitText: 'g', scaling: 'unresolved' } })], 2);
    expect(result.consumers.shopping.blockers).toContain('position:0:UNREVIEWED_EXCLUSION');
    expect(result.consumers.cooking.blockers).toContain('position:0:UNRESOLVED_PROCESS_AMOUNT');
  });
  it('rejects duplicate positions and invalid factors rather than losing a line', () => {
    expect(() => assessIngredientV2Consumers([line(), line()])).toThrow('SOURCE_LINE_COVERAGE_DRIFT');
    expect(() => assessIngredientV2Consumers([line()], 0)).toThrow('Invalid servings factor');
    expect(assessIngredientV2Consumers([]).consumers.planner.usable).toBe(false);
  });
});
