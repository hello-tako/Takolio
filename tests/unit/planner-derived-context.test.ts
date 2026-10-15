import { describe, expect, it } from 'vitest';
import { derivePlanningContext, readPlanningContext } from '../../packages/recipes/src/planner-context';
import { contextForSlot } from '../../packages/recipes/src/weekly-planner';
import { context } from '../helpers/planner-fixtures';

describe('derived trusted planning context', () => {
  it('shares frozen catalog and inventory while isolating slot policy overrides', () => {
    const original = context();
    const source = readPlanningContext(original);
    const rankingContext = contextForSlot(source.rankingContext, { hardMaxTimeMinutes: 15, preferredTimeMinutes: 10 });
    const derived = derivePlanningContext(original, { rankingContext, rankingProfile: { ...source.rankingProfile, cuisineRepetitionStrength: 0 } });
    const scoped = readPlanningContext(derived);
    expect(scoped.catalog).toBe(source.catalog);
    expect(scoped.inventory).toBe(source.inventory);
    expect(scoped.reference).toBe(source.reference);
    expect(scoped.evidenceProvider).toBe(source.evidenceProvider);
    expect(Object.isFrozen(scoped.catalog.recipes[0])).toBe(true);
    expect(scoped.rankingContext.preferences[0].values.hardMaxTimeMinutes).toBe(15);
    expect(source.rankingContext.preferences).toHaveLength(0);
    rankingContext.preferences[0].values.hardMaxTimeMinutes = 60;
    expect(scoped.rankingContext.preferences[0].values.hardMaxTimeMinutes).toBe(15);
    expect(scoped.fingerprint).not.toBe(source.fingerprint);
    expect(readPlanningContext(derivePlanningContext(original, {
      rankingContext: contextForSlot(source.rankingContext, { hardMaxTimeMinutes: 15, preferredTimeMinutes: 10 }),
      rankingProfile: { ...source.rankingProfile, cuisineRepetitionStrength: 0 },
    })).fingerprint).toBe(scoped.fingerprint);
  });

  it('requires the branded original context and rejects scope changes', () => {
    const original = context();
    const source = readPlanningContext(original);
    expect(() => derivePlanningContext({} as never, { rankingContext: source.rankingContext })).toThrow('original trusted');
    expect(() => derivePlanningContext(original, { rankingContext: { ...source.rankingContext, householdId: 'another-home' } }))
      .toThrow('authorized scope');
    expect(() => derivePlanningContext(original, { rankingContext: { ...source.rankingContext, userId: 'another-member' } }))
      .toThrow('authorized scope');
  });

  it('keeps inherited substitution constraints and adds newly requested hard policies', () => {
    const original = context({ activeConstraints: ['operator:preserved'] });
    const source = readPlanningContext(original);
    const derived = derivePlanningContext(original, { rankingContext: { ...source.rankingContext,
      preferences: [{ householdId: source.rankingContext.householdId, userId: source.rankingContext.userId,
        values: { allergens: ['EGG'], requiredDietaryTags: ['vegetarian'] } }] } });
    expect(readPlanningContext(derived).activeConstraints).toEqual(['allergen:EGG', 'dietary:vegetarian', 'operator:preserved']);
  });
});
