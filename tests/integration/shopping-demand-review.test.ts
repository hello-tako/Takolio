import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShoppingUnknownDemandSchema, type ReviewShoppingDemandInput, type ShoppingUnknownDemand } from '../../packages/domain/src/shopping-plan-api';
import { reviewShoppingDemand } from '../../src/worker/services/shopping-demand-review';
import { sharePlanShopping, type ShoppingDemandSnapshot } from '../../src/worker/services/shopping-plan';
import { createBarrier } from '../helpers/sqlite-d1';
import { T20Harness, T20_INTENT, quietLogs } from '../helpers/t20-composition-harness';

let h: T20Harness;
let planId: string;
let scope: { householdId: string; userId: string };
const trip = { expectedRevision: 1, startDate: '2030-01-02', endDate: '2030-01-08' };
function demand(planRevision = 1): ShoppingDemandSnapshot {
  return { planRevision, rows: [{ ingredientId: 'GARLIC', name: 'Tỏi', quantity: null, unit: 'piece',
    slotId: '2030-01-03:dinner:0', date: '2030-01-03', mealType: 'dinner', componentId: 'vegetable',
    recipeId: null, title: 'Rau xào', optional: false }] };
}
async function readUnknown(): Promise<ShoppingUnknownDemand> {
  const list = await h.call(scope.householdId, 'GET', '/shopping-list');
  expect(list.status, JSON.stringify(list.json)).toBe(200);
  return ShoppingUnknownDemandSchema.parse(list.json.unresolvedItems[0]);
}
function binding(row: ShoppingUnknownDemand) {
  return { sourceId: row.sourceId, demandKey: row.demandKey, snapshot: row.snapshot, reviewRevision: row.reviewRevision };
}
function purchase(row: ShoppingUnknownDemand, quantity = 2): Extract<ReviewShoppingDemandInput, { action: 'purchase' }> {
  return { ...binding(row), action: 'purchase', quantity, unit: 'bunch' };
}
async function review(input: ReviewShoppingDemandInput, key: string = crypto.randomUUID()) {
  return reviewShoppingDemand(h.db, scope, input, key);
}
function facts() {
  return {
    items: h.db.query('SELECT * FROM shopping_items ORDER BY id'),
    states: h.db.query('SELECT * FROM shopping_generated_item_state ORDER BY item_id'),
    reviews: h.db.query('SELECT * FROM shopping_demand_reviews ORDER BY source_id,demand_key'),
    receipts: h.db.query('SELECT * FROM shopping_demand_review_commands ORDER BY request_key'),
    inventory: h.db.query('SELECT * FROM inventory_items ORDER BY id'),
    events: h.db.query('SELECT * FROM inventory_events ORDER BY id'),
  };
}
function onReviewBatch(run: () => void) {
  h.db.hooks.beforeBatch = statements => {
    if (statements.some(statement => statement.sql.includes('INSERT INTO shopping_demand_review_commands'))) {
      h.db.hooks.beforeBatch = undefined;
      expect(statements.every(statement => statement.bindings.length <= 100)).toBe(true);
      run();
    }
  };
}
beforeEach(async () => {
  quietLogs(); h = new T20Harness(); h.mode = 'static'; await h.seedHousehold('shopping-review');
  scope = { householdId: 'shopping-review', userId: h.users['shopping-review'] };
  const generated = await h.call(scope.householdId, 'POST', '/meal-planning/plans', { ...T20_INTENT, slots: T20_INTENT.slots.slice(0, 1) });
  expect(generated.status).toBe(200); planId = generated.json.id;
  await sharePlanShopping(h.db, scope, { ...trip, planId }, crypto.randomUUID(), async () => demand());
});
afterEach(() => { h?.close(); vi.restoreAllMocks(); });

describe('shared unknown shopping demand review', () => {
  it('records chosen purchase amount with source attribution while demand and physical stock stay unknown/unchanged', async () => {
    const row = await readUnknown(); const before = facts();
    expect(row).toMatchObject({ reviewState: 'pending', reviewRevision: 0, purchaseItemId: null });
    const result = await h.call(scope.householdId, 'POST', '/shopping-list/demand-review', purchase(row, 1.5));
    expect(result.status, JSON.stringify(result.json)).toBe(200);
    expect(result.json).toMatchObject({ reviewState: 'purchased', reviewRevision: 1, idempotentReplay: false });
    const list = (await h.call(scope.householdId, 'GET', '/shopping-list')).json;
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ name: 'Tỏi', quantity: 1.5, unit: 'bunch', quantityOverridden: true,
      generated: true, unknownDemand: true, reviewState: 'purchased', isChecked: false });
    expect(list.items[0].contributions).toEqual(row.contributions);
    expect(list.unresolvedItems[0]).toMatchObject({ reviewState: 'purchased', reviewRevision: 1, purchaseItemId: list.items[0].id });
    expect(h.db.query('SELECT quantity FROM shopping_plan_demands')).toEqual([{ quantity: null }]);
    expect(facts().inventory).toEqual(before.inventory); expect(facts().events).toEqual(before.events);
  });
  it('manual purchase with the same canonical ingredient cannot certify unknown demand', async () => {
    expect((await h.call(scope.householdId, 'POST', '/shopping-list/items', {
      id: 'manual-garlic-purchase', name: 'Tỏi', ingredientId: 'GARLIC', quantity: 1, unit: 'bunch',
    })).status).toBe(201);
    expect(await readUnknown()).toMatchObject({ reviewState: 'pending', reviewRevision: 0, purchaseItemId: null });
  });
  it('preserves checked/cannot-buy state and an edited purchase name when reconfirming a selected amount', async () => {
    const first = await review(purchase(await readUnknown()));
    await h.call(scope.householdId, 'PATCH', `/shopping-list/items/${first.purchaseItemId}`, { name: 'Tỏi ta', isChecked: true });
    await review(purchase(await readUnknown(), 3));
    expect((await h.call(scope.householdId, 'GET', '/shopping-list')).json.items[0]).toMatchObject({ name: 'Tỏi ta', isChecked: true, cannotBuy: false, quantity: 3 });
    await h.call(scope.householdId, 'PATCH', `/shopping-list/items/${first.purchaseItemId}`, { cannotBuy: true });
    await review(purchase(await readUnknown(), 4));
    expect((await h.call(scope.householdId, 'GET', '/shopping-list')).json.items[0]).toMatchObject({ isChecked: false, cannotBuy: true, quantity: 4 });
  });
  it('unchanged re-sharing preserves purchase decision but changed horizon returns pending and retains chosen amount', async () => {
    const chosen = await review(purchase(await readUnknown(), 7));
    await sharePlanShopping(h.db, scope, { ...trip, planId }, crypto.randomUUID(), async () => demand());
    expect(await readUnknown()).toMatchObject({ reviewState: 'purchased', reviewRevision: 1, purchaseItemId: chosen.purchaseItemId });
    await sharePlanShopping(h.db, scope, { ...trip, planId, endDate: '2030-01-05' }, crypto.randomUUID(), async () => demand());
    expect(await readUnknown()).toMatchObject({ reviewState: 'pending', reviewRevision: 1, purchaseItemId: chosen.purchaseItemId });
    expect((await h.call(scope.householdId, 'GET', '/shopping-list')).json.items[0]).toMatchObject({ quantity: 7, unknownDemand: true, reviewState: 'pending' });
  });
  it.each(['revision', 'attribution'] as const)('changed %s makes a prior skip pending again', async change => {
    await review({ ...binding(await readUnknown()), action: 'skip' });
    const next = demand(change === 'revision' ? 2 : 1);
    if (change === 'revision') h.db.execute('UPDATE generated_meal_plans SET revision=2 WHERE id=?', [planId]);
    else next.rows[0] = { ...next.rows[0], componentId: 'different-dish', title: 'Canh rau' };
    await sharePlanShopping(h.db, scope, { ...trip, planId, expectedRevision: next.planRevision }, crypto.randomUUID(), async () => next);
    expect(await readUnknown()).toMatchObject({ reviewState: 'pending', reviewRevision: 1 });
  });
  it('skip/reopen advances the tombstone and remains visible without inventing an amount', async () => {
    const initial = await readUnknown(); await review({ ...binding(initial), action: 'skip' });
    const skipped = await readUnknown(); expect(skipped).toMatchObject({ reviewState: 'skipped', reviewRevision: 1, purchaseItemId: null });
    await sharePlanShopping(h.db, scope, { ...trip, planId }, crypto.randomUUID(), async () => demand());
    expect(await readUnknown()).toMatchObject({ reviewState: 'skipped', reviewRevision: 1 });
    await review({ ...binding(await readUnknown()), action: 'reopen' });
    expect(await readUnknown()).toMatchObject({ reviewState: 'pending', reviewRevision: 2, purchaseItemId: null });
    expect(h.db.query('SELECT * FROM shopping_items')).toEqual([]);
    await expect(review({ ...binding(initial), action: 'purchase', quantity: 2, unit: 'g' })).rejects.toMatchObject({ code: 'SHOPPING_REVIEW_CHANGED' });
  });
  it('explicit skip removes an unchecked linked purchase while reopen leaves preserved purchase intent alone', async () => {
    const bought = await review(purchase(await readUnknown()));
    await review({ ...binding(await readUnknown()), action: 'reopen' });
    expect(await readUnknown()).toMatchObject({ reviewState: 'pending', purchaseItemId: bought.purchaseItemId });
    expect(h.db.query('SELECT * FROM shopping_items')).toHaveLength(1);
    await review({ ...binding(await readUnknown()), action: 'skip' });
    expect(await readUnknown()).toMatchObject({ reviewState: 'skipped', reviewRevision: 3, purchaseItemId: null });
    expect(h.db.query('SELECT * FROM shopping_items')).toEqual([]);
  });
  it('skip keeps bought history and reopen keeps its chosen amount', async () => {
    const selected = await review(purchase(await readUnknown()));
    await h.call(scope.householdId, 'PATCH', `/shopping-list/items/${selected.purchaseItemId}`, { isChecked: true });
    await review({ ...binding(await readUnknown()), action: 'skip' });
    expect(await readUnknown()).toMatchObject({ reviewState: 'skipped', purchaseItemId: selected.purchaseItemId });
    await review({ ...binding(await readUnknown()), action: 'reopen' });
    expect(await readUnknown()).toMatchObject({ reviewState: 'pending', purchaseItemId: selected.purchaseItemId });
    expect((await h.call(scope.householdId, 'GET', '/shopping-list')).json.items[0]).toMatchObject({ quantity: 2, isChecked: true });
  });
  it('deleting an unknown purchase accepts D1 cascade counts and reopens review without an indefinite same-plan dismissal', async () => {
    const selected = await review(purchase(await readUnknown()));
    h.db.hooks.afterBatch = results => {
      h.db.hooks.afterBatch = undefined;
      expect(results).toHaveLength(3);
      expect(results[2].meta.changes).toBe(1);
      // Real D1 counts the item plus metadata and generated-state cascade deletes.
      results[2].meta.changes = 3;
    };
    expect((await h.call(scope.householdId, 'DELETE', `/shopping-list/items/${selected.purchaseItemId}`)).status).toBe(200);
    expect(await readUnknown()).toMatchObject({ reviewState: 'pending', reviewRevision: 2, purchaseItemId: null });
    expect(h.db.query('SELECT * FROM shopping_plan_item_dismissals')).toEqual([]);
    await sharePlanShopping(h.db, scope, { ...trip, planId, endDate: '2030-01-05' }, crypto.randomUUID(), async () => demand());
    expect(await readUnknown()).toMatchObject({ reviewState: 'pending', purchaseItemId: null });
  });
  it('another current household member reviews the source without access to the private planner', async () => {
    const member = await h.seedHousehold('review-member');
    h.db.execute("INSERT INTO household_members(id,household_id,user_id,role) VALUES('second-review-member',?,?,'member')", [scope.householdId, member]);
    h.db.execute('UPDATE sessions_v2 SET household_id=? WHERE user_id=?', [scope.householdId, member]);
    const row = await readUnknown();
    const selected = await h.call('review-member', 'POST', '/shopping-list/demand-review', purchase(row));
    expect(selected.status, JSON.stringify(selected.json)).toBe(200);
    expect(h.db.query('SELECT actor_user_id FROM shopping_demand_reviews')).toEqual([{ actor_user_id: member }]);
  });
  it('foreign source bindings never authorize another household list', async () => {
    const row = await readUnknown(); await h.seedHousehold('review-outsider');
    const before = facts();
    const result = await h.call('review-outsider', 'POST', '/shopping-list/demand-review', purchase(row));
    expect(result.status).toBe(404); expect(facts()).toEqual(before);
  });
  it('review stays available with planner flags off because it concerns the persisted shared shopping list', async () => {
    const result = await h.call(scope.householdId, 'POST', '/shopping-list/demand-review', purchase(await readUnknown()), {
      MEAL_PLANNER_ENABLED: 'false', MEAL_COMPOSITION_V2_ENABLED: 'false',
    });
    expect(result.status).toBe(200);
  });
  it.each([0, -1, Infinity, 100001])('rejects invalid chosen quantity %s before persistence', async quantity => {
    const result = await h.call(scope.householdId, 'POST', '/shopping-list/demand-review', purchase(await readUnknown(), quantity));
    expect(result.status).toBe(422); expect(h.db.query('SELECT * FROM shopping_demand_review_commands')).toEqual([]);
  });
});

describe('shopping review atomic races and immutable replay', () => {
  it('concurrent identical-key commands materialize once and replay the original result', async () => {
    const input = purchase(await readUnknown()); const barrier = createBarrier(2);
    h.db.hooks.beforeBatch = async statements => {
      if (statements.some(statement => statement.sql.includes('INSERT INTO shopping_demand_review_commands'))) await barrier.wait();
    };
    const results = await Promise.all([review(input, 'same-review-command'), review(input, 'same-review-command')]);
    expect(results.map(result => result.idempotentReplay).sort()).toEqual([false, true]);
    expect(h.db.query('SELECT * FROM shopping_demand_review_commands')).toHaveLength(1);
    expect(h.db.query('SELECT revision FROM shopping_demand_reviews')).toEqual([{ revision: 1 }]);
  });
  it('same-key different payload cannot overwrite the committed winner', async () => {
    const input = purchase(await readUnknown()); const barrier = createBarrier(2);
    h.db.hooks.beforeBatch = async statements => {
      if (statements.some(statement => statement.sql.includes('INSERT INTO shopping_demand_review_commands'))) await barrier.wait();
    };
    const settled = await Promise.allSettled([review(input, 'different-review-body'), review({ ...input, quantity: 8 }, 'different-review-body')]);
    expect(settled.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.find(result => result.status === 'rejected');
    expect(rejected?.status === 'rejected' ? rejected.reason : null).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(h.db.query('SELECT * FROM shopping_demand_review_commands')).toHaveLength(1);
    expect(h.db.query('SELECT quantity FROM shopping_items')[0].quantity).toBeOneOf([2, 8]);
  });
  it('different command keys against one snapshot cannot overwrite the winning decision', async () => {
    const row = await readUnknown(); const barrier = createBarrier(2);
    h.db.hooks.beforeBatch = async statements => {
      if (statements.some(statement => statement.sql.includes('INSERT INTO shopping_demand_review_commands'))) await barrier.wait();
    };
    const settled = await Promise.allSettled([review(purchase(row)), review({ ...binding(row), action: 'skip' })]);
    expect(settled.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.find(result => result.status === 'rejected');
    expect(rejected?.status === 'rejected' ? rejected.reason : null).toMatchObject({ code: 'SHOPPING_REVIEW_CHANGED' });
    expect(h.db.query('SELECT * FROM shopping_demand_review_commands')).toHaveLength(1);
  });
  it('a committed response lost after COMMIT replays before demand lookup and never performs another write', async () => {
    const input = purchase(await readUnknown()); let reviewing = false;
    h.db.hooks.beforeBatch = statements => { reviewing = statements.some(statement => statement.sql.includes('INSERT INTO shopping_demand_review_commands')); };
    h.db.hooks.afterBatch = () => { if (reviewing) { h.db.hooks = {}; throw new Error('Response lost after COMMIT'); } };
    const recovered = await review(input, 'lost-review-response'); expect(recovered.idempotentReplay).toBe(true);
    h.db.execute('DELETE FROM shopping_plan_demands');
    h.db.execute('DELETE FROM shopping_items');
    const before = facts(); expect(await review(input, 'lost-review-response')).toEqual(recovered); expect(facts()).toEqual(before);
    await expect(review({ ...input, quantity: 5 }, 'lost-review-response')).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
  it.each(['horizon', 'attribution', 'known', 'removed', 'review'] as const)('rejects concurrent %s changes with no review receipt or chosen item', async change => {
    const input = purchase(await readUnknown());
    onReviewBatch(() => {
      if (change === 'horizon') h.db.execute("UPDATE shopping_plan_sources SET end_date='2030-01-05'");
      else if (change === 'attribution') h.db.execute("UPDATE shopping_plan_demands SET contributions_json='[]'");
      else if (change === 'known') h.db.execute('UPDATE shopping_plan_demands SET quantity=10');
      else if (change === 'removed') h.db.execute('DELETE FROM shopping_plan_demands');
      else h.db.execute(`INSERT INTO shopping_demand_reviews(source_id,demand_key,revision,demand_fingerprint,decision,updated_at)
        VALUES(?,?,1,?,'skipped','2030-01-01')`, [input.sourceId, input.demandKey, 'a'.repeat(64)]);
    });
    await expect(review(input)).rejects.toMatchObject({ code: 'SHOPPING_REVIEW_CHANGED' });
    expect(h.db.query('SELECT * FROM shopping_demand_review_commands')).toEqual([]);
    expect(h.db.query('SELECT * FROM shopping_items')).toEqual([]);
  });
  it.each(['quantity', 'checked', 'cannot-buy', 'delete'] as const)('rejects concurrent purchase %s changes instead of restoring stale state', async change => {
    const selected = await review(purchase(await readUnknown())); const input = purchase(await readUnknown(), 8);
    onReviewBatch(() => {
      if (change === 'quantity') h.db.execute('UPDATE shopping_items SET quantity=4 WHERE id=?', [selected.purchaseItemId]);
      else if (change === 'checked') h.db.execute('UPDATE shopping_items SET is_checked=1 WHERE id=?', [selected.purchaseItemId]);
      else if (change === 'cannot-buy') h.db.execute('UPDATE shopping_item_metadata SET cannot_buy=1 WHERE item_id=?', [selected.purchaseItemId]);
      else h.db.execute('DELETE FROM shopping_items WHERE id=?', [selected.purchaseItemId]);
    });
    await expect(review(input)).rejects.toMatchObject({ code: 'SHOPPING_REVIEW_CHANGED' });
    expect(h.db.query('SELECT * FROM shopping_demand_review_commands')).toHaveLength(1);
    if (change === 'quantity') expect(h.db.query('SELECT quantity FROM shopping_items')).toEqual([{ quantity: 4 }]);
    if (change === 'checked') expect(h.db.query('SELECT is_checked FROM shopping_items')).toEqual([{ is_checked: 1 }]);
    if (change === 'cannot-buy') expect(h.db.query('SELECT cannot_buy FROM shopping_item_metadata')).toEqual([{ cannot_buy: 1 }]);
  });
  it('snapshot binds a purchase edit between GET and command even when review revision did not change', async () => {
    const selected = await review(purchase(await readUnknown())); const row = await readUnknown();
    await h.call(scope.householdId, 'PATCH', `/shopping-list/items/${selected.purchaseItemId}`, { quantity: 3 });
    await expect(review(purchase(row, 7))).rejects.toMatchObject({ code: 'SHOPPING_REVIEW_CHANGED' });
    expect(h.db.query('SELECT quantity FROM shopping_items')).toEqual([{ quantity: 3 }]);
    expect(await readUnknown()).toMatchObject({ reviewState: 'purchased', reviewRevision: 1 });
  });
  it('membership removal immediately before persistence rolls back every review write', async () => {
    const input = purchase(await readUnknown());
    onReviewBatch(() => h.db.execute('DELETE FROM household_members WHERE household_id=? AND user_id=?', [scope.householdId, scope.userId]));
    await expect(review(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(h.db.query('SELECT * FROM shopping_demand_reviews')).toEqual([]);
    expect(h.db.query('SELECT * FROM shopping_demand_review_commands')).toEqual([]);
    expect(h.db.query('SELECT * FROM shopping_items')).toEqual([]);
  });
  it('an absent item witness cannot overwrite a concurrently created same-ID foreign purchase', async () => {
    const input = purchase(await readUnknown()); const other = await h.seedHousehold('review-collision');
    h.db.execute("INSERT INTO shopping_lists(id,household_id,name) VALUES('foreign-review-list','review-collision','Other')");
    expect(other).toBeTruthy();
    onReviewBatch(() => {
      const source = h.db.query<{ list_id: string }>('SELECT list_id FROM shopping_plan_sources')[0];
      // Stable ID matches the one the server will materialize; derive it from the review INSERT statement below.
      expect(source.list_id).toBe('list_shopping-review');
    });
    const original = h.db.hooks.beforeBatch;
    h.db.hooks.beforeBatch = statements => {
      original?.(statements);
      const inserted = statements.find(statement => statement.sql.includes('INSERT INTO shopping_items'));
      if (inserted) h.db.execute("INSERT INTO shopping_items(id,list_id,name,quantity,unit) VALUES(?,'foreign-review-list','Foreign',4,'kg')", [inserted.bindings[0]]);
    };
    await expect(review(input)).rejects.toMatchObject({ code: 'SHOPPING_REVIEW_CHANGED' });
    expect(h.db.query('SELECT name,quantity,unit FROM shopping_items')).toEqual([{ name: 'Foreign', quantity: 4, unit: 'kg' }]);
    expect(h.db.query('SELECT * FROM shopping_demand_review_commands')).toEqual([]);
  });
  it('receipts are immutable, survive source deletion and cascade only when the household list is deleted', async () => {
    const input = purchase(await readUnknown()); const result = await review(input, 'immutable-review-command');
    expect(() => h.db.execute("UPDATE shopping_demand_review_commands SET response_json='{}'")).toThrow('immutable');
    expect(() => h.db.execute('DELETE FROM shopping_demand_review_commands')).toThrow('immutable');
    h.db.execute('DELETE FROM generated_meal_plans WHERE id=?', [planId]);
    expect(h.db.query('SELECT * FROM shopping_demand_reviews')).toEqual([]);
    expect(await review(input, 'immutable-review-command')).toEqual({ ...result, idempotentReplay: true });
    h.db.execute('DELETE FROM shopping_lists WHERE household_id=?', [scope.householdId]);
    expect(h.db.query('SELECT * FROM shopping_demand_review_commands')).toEqual([]);
    expect(h.db.query('PRAGMA foreign_key_check')).toEqual([]);
  });
  it('an unrelated database failure stays unavailable and rolls back the command receipt', async () => {
    const input = purchase(await readUnknown());
    h.db.seed("CREATE TRIGGER reject_review BEFORE INSERT ON shopping_demand_reviews BEGIN SELECT RAISE(ABORT,'synthetic review failure'); END;");
    await expect(review(input)).rejects.toMatchObject({ code: 'SHOPPING_REVIEW_FAILED', status: 503 });
    expect(h.db.query('SELECT * FROM shopping_demand_review_commands')).toEqual([]);
    expect(h.db.query('SELECT * FROM shopping_items')).toEqual([]);
  });
});

it('changed recipe content alone invalidates review and stale snapshots while retaining selected purchase history', async () => {
  const input = { ...trip, planId };
  const withPin = (pin: string): ShoppingDemandSnapshot => ({ ...demand(),
    rows: demand().rows.map(row => ({ ...row, recipeId: 'synthetic-recipe', contentFingerprint: pin })) });
  await sharePlanShopping(h.db, scope, input, 'content-first-share', async () => withPin('a'.repeat(64)));
  const selected = await review(purchase(await readUnknown(), 3));
  const old = await readUnknown(); expect(old.reviewState).toBe('purchased');
  await sharePlanShopping(h.db, scope, input, 'content-second-share', async () => withPin('b'.repeat(64)));
  const current = await readUnknown();
  expect(current).toMatchObject({ reviewState: 'pending', reviewRevision: 1, purchaseItemId: selected.purchaseItemId });
  expect(current.snapshot).not.toBe(old.snapshot);
  const before = facts();
  await expect(review(purchase(old, 5), 'stale-content-review')).rejects.toMatchObject({ code: 'SHOPPING_REVIEW_CHANGED' });
  expect(facts()).toEqual(before);
  expect((await h.call(scope.householdId, 'GET', '/shopping-list')).json.items[0]).toMatchObject({ quantity: 3, unit: 'bunch', reviewState: 'pending' });
});
