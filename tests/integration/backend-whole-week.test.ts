import { afterEach, describe, expect, it } from 'vitest';
import { loadRankingContext, saveRankingPreferences } from '../../packages/db/src/personalization';
import { createPlanningContext } from '../../packages/recipes/src/planner-context';
import { DEFAULT_PLANNER_POLICY } from '../../packages/recipes/src/planner-policy';
import { planWeeklyMeals } from '../../packages/recipes/src/weekly-planner';
import type { InventoryLotSnapshot } from '../../packages/recipes/src/planner-inventory';
import { catalog, recipe, reviewedEvidence } from '../helpers/planner-fixtures';
import { SqliteD1 } from '../helpers/sqlite-d1';

const instant = '2030-01-01T00:00:00.000Z';
const dates = Array.from({ length: 7 }, (_, index) => `2030-01-${String(index + 2).padStart(2, '0')}`);
const dbs: SqliteD1[] = [];
const workflows = ['Manual', 'Assisted', 'Auto'] as const;
const snapshots = (db: SqliteD1) => ({ stock: db.query('SELECT * FROM inventory_items ORDER BY id'),
  events: db.query('SELECT * FROM inventory_events ORDER BY id'), plans: db.query('SELECT * FROM meal_plans ORDER BY id') });
function fixture(stocked: boolean) {
  const db = new SqliteD1(); dbs.push(db);
  db.seed(`INSERT INTO users(id) VALUES ('week-owner-a'), ('week-member-a'), ('week-owner-b');
    INSERT INTO households(id,name,created_by) VALUES
      ('whole-a','Whole A','week-owner-a'), ('whole-b','Whole B','week-owner-b');
    INSERT INTO household_members(id,household_id,user_id,role) VALUES
      ('whole-owner-a','whole-a','week-owner-a','owner'), ('whole-member-a','whole-a','week-member-a','member'),
      ('whole-owner-b','whole-b','week-owner-b','owner');`);
  for (const home of ['whole-a', 'whole-b']) for (const [index, storage] of ['pantry', 'freezer', 'fridge'].entries()) {
    db.execute(`INSERT INTO inventory_items(id,household_id,ingredient_id,name,quantity,unit,storage,version)
      VALUES (?,?,?,?,?,'g',?,1)`, [`${home}-${storage}`, home, 'CHICKEN_BREAST', 'Synthetic stock',
      stocked ? [200, 300, 200][index] : 0, storage]);
  }
  return db;
}
const mealCatalog = () => catalog([
  ...dates.map((_, index) => recipe(`whole-meal-${index}`, 'CHICKEN_BREAST', 100)),
  recipe('blocked-tofu', 'TOFU', 100),
]);
async function preload(db: SqliteD1, home: string, user: string) {
  const rankingContext = await loadRankingContext(db, { householdId: home, userId: user }, instant);
  const rows = await db.prepare(`SELECT id, household_id AS householdId, version, ingredient_id AS ingredientId,
    quantity, unit, freshness, expiry_date AS expiryDate, expiry_kind AS expiryKind, storage,
    expiry_source AS expirySource FROM inventory_items WHERE household_id = ? ORDER BY id`).bind(home).all<InventoryLotSnapshot>();
  return createPlanningContext(() => ({ snapshotId: `whole-snapshot-${home}`, referenceInstant: instant,
    inventory: rows.results, rankingContext, catalog: mealCatalog(), evidenceProvider: reviewedEvidence }));
}
function intent(workflow: typeof workflows[number], stocked: boolean) {
  // Workflow labels map to existing locks/search, never new HTTP mode values.
  return { startDate: dates[0], horizonDays: 7, defaultServings: 2,
    mode: stocked ? 'cook_now' as const : 'shopping_allowed' as const,
    slots: dates.map((date, index) => ({ date, mealType: 'dinner' as const,
      ...(workflow === 'Manual' || (workflow === 'Assisted' && index === 0)
        ? { lock: { kind: 'recipe' as const, id: `whole-meal-${index}`, version: 1 } } : {}) })) };
}
afterEach(() => dbs.splice(0).forEach((db) => db.close()));

describe('B06 seven-day trusted authority matrix', () => {
  for (const workflow of workflows) for (const stocked of [true, false]) for (const home of ['whole-a', 'whole-b']) {
    it(`${workflow}, ${stocked ? 'stocked' : 'empty'}, ${home}: preserves locks, restrictions and occurrence demand`, async () => {
      const db = fixture(stocked);
      const user = home === 'whole-a' ? 'week-owner-a' : 'week-owner-b';
      await saveRankingPreferences(db, { householdId: home, userId: user }, {
        scope: 'household', values: { forbiddenIngredientIds: ['TOFU'] }, updatedAt: instant,
      });
      const context = await preload(db, home, user);
      const before = snapshots(db);
      let accesses = 0;
      db.hooks = { beforeStatement: () => { accesses++; throw new Error('Planner performed I/O'); },
        beforeBatch: () => { accesses++; throw new Error('Planner performed a batch'); } };
      const result = planWeeklyMeals({ context, request: intent(workflow, stocked),
        policy: { ...DEFAULT_PLANNER_POLICY, maxExactRecipeRepeats: 1, minimumRepeatGap: 1 } });
      expect(result.status).toBe('feasible');
      expect(result.slots.map((slot) => slot.date)).toEqual(dates);
      expect(new Set(result.slots.map((slot) => slot.ranked.candidate.source.sourceId)).size).toBe(7);
      expect(result.slots.every((slot) => slot.ranked.candidate.source.sourceId !== 'blocked-tofu')).toBe(true);
      expect(result.initialInventorySnapshot.every((lot) => lot.householdId === home)).toBe(true);
      expect(result.projectedFinalInventory.every((lot) => lot.quantity >= 0)).toBe(true);
      for (const [index, slot] of result.slots.entries()) {
        if (workflow === 'Manual' || (workflow === 'Assisted' && index === 0)) {
          expect(slot.ranked.candidate.source.sourceId).toBe(`whole-meal-${index}`);
        }
        expect(slot.ranked.facts.nutrition.verificationState).toBe('unknown');
      }
      if (stocked) {
        expect(result.shortages).toEqual([]);
        expect(result.projectedFinalInventory.reduce((sum, lot) => sum + lot.quantity, 0)).toBe(0);
      } else {
        expect(result.shortages).toHaveLength(1);
        expect(result.shortages[0].ingredientId).toBe('CHICKEN_BREAST');
      }
      expect(accesses).toBe(0);
      expect(snapshots(db)).toEqual(before);
      expect(result.sourceSnapshot.requiresRevalidationBeforeAcceptance).toBe(true);
    });
  }
  it('applies household hard policy to both members and denies foreign preload', async () => {
    const db = fixture(true);
    await saveRankingPreferences(db, { householdId: 'whole-a', userId: 'week-owner-a' }, {
      scope: 'household', values: { forbiddenIngredientIds: ['CHICKEN_BREAST', 'TOFU'] }, updatedAt: instant,
    });
    for (const user of ['week-owner-a', 'week-member-a']) {
      const result = planWeeklyMeals({ context: await preload(db, 'whole-a', user), request: intent('Auto', true) });
      expect(result.status).toBe('infeasible');
      expect(result.slots).toEqual([]);
      expect(result.diagnostics.some((row) => row.code === 'FORBIDDEN_INGREDIENT')).toBe(true);
    }
    const foreign = planWeeklyMeals({ context: await preload(db, 'whole-b', 'week-owner-b'), request: intent('Auto', true) });
    expect(foreign.slots).toHaveLength(7);
    await expect(preload(db, 'whole-a', 'week-owner-b')).rejects.toThrow('not authorized');
  });
  it('retains the original source stock/release fingerprint after a later change', async () => {
    const db = fixture(true);
    const context = await preload(db, 'whole-a', 'week-owner-a');
    const before = planWeeklyMeals({ context, request: intent('Manual', true) });
    db.execute('UPDATE inventory_items SET quantity = 0, version = version + 1 WHERE household_id = ?', ['whole-a']);
    const after = planWeeklyMeals({ context, request: intent('Manual', true) });
    expect(after).toEqual(before);
    const fresh = planWeeklyMeals({ context: await preload(db, 'whole-a', 'week-owner-a'), request: intent('Manual', true) });
    expect(fresh.status).toBe('infeasible');
    expect(fresh.sourceSnapshot.fingerprint).not.toBe(before.sourceSnapshot.fingerprint);
  });
  it('keeps hard unknown nutrition unresolved for the full horizon', async () => {
    const db = fixture(true);
    const result = planWeeklyMeals({ context: await preload(db, 'whole-a', 'week-owner-a'),
      request: { ...intent('Auto', true), nutritionTargets: [{ period: 'horizon', basis: 'household_total',
        nutrient: 'proteinG', min: 200, max: 1000, hard: true }] } });
    expect(result.status).not.toBe('feasible');
    expect(result.slots).toEqual([]);
  });
});
