import { describe, expect, it } from 'vitest';
import { FamilyPreferencesSchema } from '../../packages/domain/src/family-preferences-api';
import { planFamilyMeals } from '../../packages/recipes/src/composition/family-planner';
import { buildRoleIndex, type PersistedRoleAssignment } from '../../packages/recipes/src/composition/roles';
import { projectCompositions, evaluationScope } from '../../packages/recipes/src/composition/projection';
import type { Recipe } from '../../packages/recipes/src/types';
import type { MealRole } from '../../packages/domain/src/meal-composition-api';
import type { MealComponent } from '../../packages/recipes/src/composition/model';
import { readPlanningContext } from '../../packages/recipes/src/planner-context';
import { catalog, context, lot, recipe } from '../helpers/planner-fixtures';

function fixture(options: { stock?: number; cuisine?: 'vietnamese' | 'thai'; soupCuisine?: 'vietnamese' | 'thai'; region?: 'bac' | 'nam'; excludeSimpleVegetables?: boolean; breakfast?: boolean; slowMainMinutes?: number; fastMainMinutes?: number; soupMinutes?: number } = {}) {
  const definitions = [recipe('main-a', 'CHICKEN', 100, { cuisine: options.cuisine ?? 'vietnamese', prepTimeMinutes: 0, cookTimeMinutes: options.slowMainMinutes ?? 5 }),
    recipe('main-b', 'CHICKEN', 100, { cuisine: options.cuisine ?? 'vietnamese', prepTimeMinutes: 0, cookTimeMinutes: options.fastMainMinutes ?? 5 }),
    recipe('vegetable', 'TOMATO', 300, { cuisine: 'vietnamese', prepTimeMinutes: 0, cookTimeMinutes: 5 }),
    recipe('soup', 'TOMATO', 300, { cuisine: options.soupCuisine ?? 'vietnamese', prepTimeMinutes: 0, cookTimeMinutes: options.soupMinutes ?? 5 }),
    recipe('rice', 'RICE', 100, { cuisine: 'vietnamese', prepTimeMinutes: 0, cookTimeMinutes: 5 })];
  const roles: MealRole[] = ['main', 'main', 'vegetable', 'soup', 'staple'];
  const runtime: Recipe[] = definitions.map((definition, index) => ({ ...definition, cuisine: definition.cuisine as Recipe['cuisine'],
    description: '', imageUrl: '', steps: [], tags: [], category: index <= 1 && options.breakfast ? 'mon_nhanh_sang' : undefined, region: index === 1 ? options.region : undefined }));
  const assignments: PersistedRoleAssignment[] = definitions.map((definition, index) => ({ recipeId: definition.id, role: roles[index],
    source: 'reviewed', decision: 'assign', confidence: null, reviewed: true }));
  const inventory = [lot({ quantity: 1000 }), lot({ id: 'tomato', ingredientId: 'TOMATO', quantity: options.stock ?? 2000 }),
    lot({ id: 'rice', ingredientId: 'RICE', quantity: 1000 })];
  const ctx = context({ catalog: catalog(definitions), inventory, ...(options.excludeSimpleVegetables ? {
    rankingContext: { householdId: 'home', userId: 'member', feedback: [], preferences: [{ householdId: 'home', userId: null,
      values: { forbiddenIngredientIds: ['BROCCOLI', 'CUCUMBER', 'WATER_SPINACH'] } }] } } : {}) });
  return { ctx, inventory, runtime, roleIndex: buildRoleIndex(runtime, assignments) };
}
const request = { startDate: '2026-09-09', horizonDays: 7, defaultServings: 2, mode: 'shopping_allowed' as const,
  slots: [{ date: '2026-09-09', mealType: 'dinner' as const }, { date: '2026-09-10', mealType: 'lunch' as const }] };
function plan(options: Parameters<typeof fixture>[0] = {}, preference = {}, extra = {}) {
  const f = fixture(options);
  const result = planFamilyMeals({ context: f.ctx, request, preferences: FamilyPreferencesSchema.parse(preference),
    roles: f.roleIndex, runtimeRecipes: f.runtime, revision: 1, ...extra });
  return { ...f, result };
}

describe('family week composition planner', () => {
  it('creates main + vegetable + soup + staple for both family lunch and dinner and varies adjacent mains', () => {
    const { result } = plan();
    expect(result.meals.map((meal) => meal.components.map((component) => component.role))).toEqual([
      ['main', 'vegetable', 'soup', 'staple'], ['main', 'vegetable', 'soup', 'staple']]);
    expect(result.meals.every((meal) => meal.missingRoles.length === 0)).toBe(true);
    expect(result.meals[0].anchor?.candidate.source.sourceId).not.toBe(result.meals[1].anchor?.candidate.source.sourceId);
  });
  it('subtracts shared stock between components and later slots with exact shortages', () => {
    const { result, ctx, inventory } = plan({ stock: 500, excludeSimpleVegetables: true });
    const projection = projectCompositions({ scope: evaluationScope(ctx), referenceDate: result.reference.localDate, inventory,
      slots: result.meals.map((meal) => ({ slotId: meal.slot.id, date: meal.slot.date, instant: meal.slot.instant, servings: meal.slot.servings,
        components: meal.components })) });
    const shortage = result.meals.flatMap((meal) => meal.components).flatMap((component) => projection.components.get(component.id)?.shortages ?? [])
      .filter((line) => line.ingredientId === 'TOMATO').reduce((sum, line) => sum + (line.missingQuantity ?? 0), 0);
    expect(shortage).toBe(700);
    expect(result.finalInventory.find((row) => row.id === 'tomato')?.quantity).toBe(0);
    expect(inventory.find((row) => row.id === 'tomato')?.quantity).toBe(500);
  });
  it('cook-now does not reuse 500g of tomato for two 300g components', () => {
    const { result } = plan({ stock: 500 }, {}, { request: { ...request, slots: request.slots.slice(0, 1), mode: 'cook_now' } });
    expect(result.meals[0].missingRoles.length).toBeGreaterThan(0);
    expect(result.finalInventory.find((row) => row.id === 'tomato')?.quantity).toBeGreaterThanOrEqual(0);
  });
  it('never silently substitutes international mains or companions at cold start', () => {
    expect(plan({ cuisine: 'thai' }).result.meals.every((meal) => meal.missingRoles.includes('main'))).toBe(true);
    expect(plan({ soupCuisine: 'thai' }).result.meals.every((meal) => meal.missingRoles.includes('soup'))).toBe(true);
    const allowed = plan({ cuisine: 'thai' }, { internationalMealsPerWeek: 1, preferredCuisines: ['vietnamese', 'thai'] });
    expect(allowed.result.internationalGeneratedMainCount).toBeLessThanOrEqual(1);
  });
  it('prefers an eligible new companion over a nonadjacent repeat without imposing a quota', () => {
    const f = fixture({ excludeSimpleVegetables: true });
    const definitions = [recipe('main-a', 'CHICKEN', 100, { cuisine: 'vietnamese', prepTimeMinutes: 0, cookTimeMinutes: 5 }),
      ...['veg-a', 'veg-b', 'veg-c'].map(id => recipe(id, 'TOMATO', 100, { cuisine: 'vietnamese', prepTimeMinutes: 0, cookTimeMinutes: 5 })),
      recipe('soup', 'TOMATO', 100, { cuisine: 'vietnamese', prepTimeMinutes: 0, cookTimeMinutes: 5 }),
      recipe('rice', 'RICE', 100, { cuisine: 'vietnamese', prepTimeMinutes: 0, cookTimeMinutes: 5 })];
    const runtime = definitions.map(definition => ({ ...definition, cuisine: 'vietnamese' as const,
      description: '', imageUrl: '', steps: [], tags: [] }));
    const roles: MealRole[] = ['main', 'vegetable', 'vegetable', 'vegetable', 'soup', 'staple'];
    const index = buildRoleIndex(runtime, definitions.map((definition, i) => ({ recipeId: definition.id, role: roles[i],
      source: 'reviewed', decision: 'assign', confidence: null, reviewed: true })));
    const locked = (id: string): MealComponent => ({ id: 'locked-' + id, kind: 'recipe', recipeId: id, simpleFoodId: null,
      role: 'vegetable', ordinal: 0, locked: true, provenance: 'manual', createdRevision: 1, updatedRevision: 1 });
    const slots = [...request.slots, { date: '2026-09-11', mealType: 'dinner' as const }];
    const ctx = context({ ...readPlanningContext(f.ctx), referenceInstant: '2026-09-08T07:00:00+07:00',
      catalog: catalog(definitions), inventory: f.inventory });
    const result = planFamilyMeals({ context: ctx, request: { ...request, slots }, preferences: FamilyPreferencesSchema.parse({}),
      roles: index, runtimeRecipes: runtime, revision: 2, locked: new Map([[slots[0].date + ':dinner:0', [locked('veg-a')]],
        [slots[1].date + ':lunch:0', [locked('veg-b')]]]) });
    expect(result.meals[2].components.find(component => component.role === 'vegetable')?.recipeId).toBe('veg-c');
    expect(result.meals.every(meal => meal.missingRoles.length === 0)).toBe(true);
    const onlyOne = plan({ excludeSimpleVegetables: true }, {}, { request: { ...request, slots } }).result;
    expect(onlyOne.meals.every(meal => meal.components.some(component => component.recipeId === 'vegetable'))).toBe(true);
    expect(onlyOne.meals.every(meal => meal.missingRoles.length === 0)).toBe(true);
  });

  it('reserves a rolling-week international allowance for a preserved future main and retains an explicit over-cap lock', () => {
    const lock: MealComponent = { id: 'locked-thai', kind: 'recipe', recipeId: 'main-b', simpleFoodId: null, role: 'main', ordinal: 0,
      locked: true, provenance: 'manual', createdRevision: 1, updatedRevision: 2 };
    const locked = new Map([['2026-09-10:lunch:0', [lock]]]);
    const preferences = { internationalMealsPerWeek: 1, preferredCuisines: ['vietnamese', 'thai'] };
    const result = plan({ cuisine: 'thai' }, preferences, { locked, revision: 3 }).result;
    expect(result.internationalGeneratedMainCount).toBe(0);
    expect(result.lockedInternationalMainCount).toBe(1);
    expect(result.meals[0].missingRoles).toContain('main');
    expect(result.meals[1].components.find(component => component.role === 'main')).toEqual(lock);
    const zero = plan({ cuisine: 'thai' }, { ...preferences, internationalMealsPerWeek: 0 }, { locked, revision: 3 }).result;
    expect(zero.internationalGeneratedMainCount).toBe(0);
    expect(zero.meals[1].components.find(component => component.role === 'main')).toEqual(lock);
    expect(zero.meals[1].warnings).toContain('PRESERVED_INTERNATIONAL_CAP_EXCEEDED');
  });

  it('regional preference affects the selected branch while unset preference stays neutral', () => {
    const { result } = plan({ region: 'nam' }, { preferredRegions: ['nam'] }, { request: { ...request, slots: request.slots.slice(0, 1) } });
    expect(result.meals[0].anchor?.candidate.source.sourceId).toBe('main-b');
  });
  it('preserves locked identity, recipe, role and revision while refilling unlocked roles', () => {
    const locked: MealComponent = { id: 'manual-main', kind: 'recipe', role: 'main', ordinal: 0, locked: true, provenance: 'manual',
      recipeId: 'main-b', simpleFoodId: null, createdRevision: 1, updatedRevision: 2 };
    const { result } = plan({}, {}, { locked: new Map([['2026-09-09:dinner:0', [locked]]]), revision: 3 });
    expect(result.meals[0].components[0]).toEqual(locked);
    expect(result.meals[0].missingRoles).toEqual([]);
  });
  it('uses breakfast and quick templates and fails closed at a hard whole-meal time limit', () => {
    const breakfast = plan({ breakfast: true }, {}, { request: { ...request, slots: [{ date: '2026-09-09', mealType: 'breakfast' }] } });
    expect(plan({}, {}, { request: { ...request, slots: [{ date: '2026-09-09', mealType: 'breakfast' }] } }).result.meals[0].missingRoles).toEqual(['main']);
    expect(breakfast.result.meals[0].components.map((component) => component.role)).toEqual(['main']);
    const quick = plan({}, { mealStyle: 'quick' }, { request: { ...request, slots: request.slots.slice(0, 1) } });
    expect(quick.result.meals[0].components.map((component) => component.role)).toEqual(['main', 'vegetable', 'staple']);
    const hard = plan({}, {}, { request: { ...request, slots: [{ date: '2026-09-09', mealType: 'dinner', hardMaxTimeMinutes: 10 }] } });
    expect(hard.result.meals[0].missingRoles.length).toBeGreaterThan(0);
  });
  it('allows one international meal in a short horizon and spaces a fourteen-day allowance across calendar weeks', () => {
    const preferences = { internationalMealsPerWeek: 1, preferredCuisines: ['vietnamese', 'thai'] };
    const short = plan({ cuisine: 'thai' }, preferences, { request: { ...request, horizonDays: 3 } }).result;
    expect(short.internationalGeneratedMainCount).toBe(1);
    const slots = Array.from({ length: 14 }, (_, index) => ({ date: new Date(Date.parse(request.startDate) + index * 86400000)
      .toISOString().slice(0, 10), mealType: 'dinner' }));
    const fortnight = plan({ cuisine: 'thai' }, preferences, { request: { ...request, horizonDays: 14, slots } }).result;
    const dates = fortnight.meals.filter((meal) => meal.anchor).map((meal) => meal.slot.date);
    expect(fortnight.internationalGeneratedMainCount).toBe(2);
    expect(Date.parse(dates[1]) - Date.parse(dates[0])).toBeGreaterThanOrEqual(7 * 86400000);
    const nearby = plan({ cuisine: 'thai' }, preferences, { request: { ...request, horizonDays: 3 },
      generatedInternationalDates: ['2026-09-11'] }).result;
    expect(nearby.internationalGeneratedMainCount).toBe(0);
  });
  it('prefers a lighter complete meal when each individual dish fits the soft time target', () => {
    const result = plan({ slowMainMinutes: 14, fastMainMinutes: 5, soupMinutes: 20, excludeSimpleVegetables: true },
      { preferredTimeMinutes: 30 }, { request: { ...request, slots: request.slots.slice(0, 1) } }).result;
    expect(result.meals[0].anchor?.candidate.source.sourceId).toBe('main-b');
    expect(result.meals[0].missingRoles).toEqual([]);
    expect(result.meals[0].warnings).toContain('MEAL_TIME_ABOVE_PREFERENCE');
    const unknown = fixture();
    const definitions = unknown.runtime.map((entry) => recipe(entry.id, entry.ingredients[0].ingredientId, entry.ingredients[0].requiredQuantity!, {
      cuisine: 'vietnamese', cookTimeMinutes: 5 }));
    const unknownContext = context({ catalog: catalog(definitions), inventory: unknown.inventory });
    const uncertain = planFamilyMeals({ context: unknownContext, request: { ...request, slots: request.slots.slice(0, 1) },
      preferences: FamilyPreferencesSchema.parse({}), roles: unknown.roleIndex, runtimeRecipes: unknown.runtime, revision: 1 });
    expect(uncertain.meals[0].warnings).toContain('MEAL_TIME_UNKNOWN');
  });
  it('provides bounded distinct alternatives and variant selects a different complete option', () => {
    const first = plan({}, {}, { request: { ...request, slots: request.slots.slice(0, 1) }, variant: 0 }).result;
    const second = plan({}, {}, { request: { ...request, slots: request.slots.slice(0, 1) }, variant: 1 }).result;
    const keys = (meals: typeof first.meals) => meals.flatMap((meal) => meal.components.map((component) => component.recipeId ?? component.simpleFoodId)).join('|');
    expect(first.alternativeMeals.length).toBeGreaterThan(1);
    expect(first.alternativeMeals.length).toBeLessThanOrEqual(3);
    expect(new Set(first.alternativeMeals.map(keys)).size).toBe(first.alternativeMeals.length);
    expect(keys(second.meals)).not.toBe(keys(first.meals));
    expect(second.meals[0].missingRoles).toEqual([]);
  });
  it('uses the tightest household or member hard time limit for the complete meal even without a slot override', () => {
    const f = fixture();
    const ctx = context({ catalog: catalog(f.runtime.map((entry) => recipe(entry.id, entry.ingredients[0].ingredientId,
      entry.ingredients[0].requiredQuantity!, { cuisine: 'vietnamese', prepTimeMinutes: 0, cookTimeMinutes: 5 }))), inventory: f.inventory,
      rankingContext: { householdId: 'home', userId: 'member', feedback: [], preferences: [
        { householdId: 'home', userId: null, values: { hardMaxTimeMinutes: 10 } },
        { householdId: 'home', userId: 'member', values: { hardMaxTimeMinutes: 30 } },
      ] } });
    const result = planFamilyMeals({ context: ctx, request: { ...request, slots: request.slots.slice(0, 1) },
      preferences: FamilyPreferencesSchema.parse({}), roles: f.roleIndex, runtimeRecipes: f.runtime, revision: 1 });
    expect(result.meals[0].missingRoles.length).toBeGreaterThan(0);
    expect(result.meals[0].components.length).toBeLessThan(4);
  });

});
