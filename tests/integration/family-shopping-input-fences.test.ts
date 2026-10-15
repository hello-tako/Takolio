import { afterEach, describe, expect, it, vi } from 'vitest';
import { FamilyMealPlanDtoSchema } from '../../packages/domain/src/family-meal-planning-api';
import { fetchWorker } from '../helpers/worker-fetch.mjs';
import { quietLogs, T20Harness, T20_INTENT, T20_ORIGIN } from '../helpers/t20-composition-harness';

let h: T20Harness;
afterEach(() => { h?.close(); vi.restoreAllMocks(); });
describe('whole-plan shopping full input transaction fences', () => {
  it.each(['catalog', 'expiry', 'storage'] as const)('rejects a %s change before shopping persistence and rolls back every shopping row', async (change) => {
    quietLogs(); h = new T20Harness(); h.mode = 'd1'; await h.seedHousehold('shopping-fence');
    const response = await fetchWorker(new Request(T20_ORIGIN + '/api/v2/meal-planning/plans', { method: 'POST',
      headers: { Cookie: h.cookies['shopping-fence'], Origin: T20_ORIGIN, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ ...T20_INTENT, slots: T20_INTENT.slots.slice(0, 1) }) }), h.env());
    expect(response.status).toBe(200);
    const family = FamilyMealPlanDtoSchema.parse(await response.json());
    let pending = true;
    h.db.hooks.beforeBatch = (statements) => {
      if (pending && statements.some((statement) => statement.sql.includes('shopping_plan_commands') && statement.sql.includes('INSERT'))) {
        pending = false;
        if (change === 'catalog') h.db.seed("UPDATE recipe_ingredients SET required_quantity=required_quantity+1 WHERE id=(SELECT id FROM recipe_ingredients ORDER BY id LIMIT 1)");
        else if (change === 'expiry') h.db.seed("UPDATE inventory_items SET expiry_date='2029-12-31',expiry_kind='use_by',expiry_source='user' WHERE household_id='shopping-fence'");
        else h.db.seed("UPDATE inventory_items SET storage='freezer' WHERE household_id='shopping-fence'");
      }
    };
    const result = await h.call('shopping-fence', 'POST', '/shopping-list/from-plan', { planId: family.plan.id,
      expectedRevision: 1, startDate: '2030-01-02', endDate: '2030-01-08' });
    expect(pending).toBe(false);
    expect(result.status, JSON.stringify(result.json)).toBe(409);
    expect(result.json.code).toBe('SHOPPING_SNAPSHOT_CHANGED');
    expect(h.db.query("SELECT id FROM shopping_lists WHERE household_id='shopping-fence'")).toHaveLength(0);
    expect(h.db.query('SELECT request_key FROM shopping_plan_commands')).toHaveLength(0);
    expect(h.db.query('SELECT demand_key FROM shopping_plan_demands')).toHaveLength(0);
  }, 30000);
});
