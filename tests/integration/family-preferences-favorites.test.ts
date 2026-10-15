import { afterEach, describe, expect, it, vi } from 'vitest';
import { T20Harness, quietLogs } from '../helpers/t20-composition-harness';
import { FamilyPreferencesSchema } from '../../packages/domain/src/family-preferences-api';
import { RankingPreferencesSchema } from '../../packages/recipes/src/personalization';
import { createBarrier } from '../helpers/sqlite-d1';

let harness: T20Harness | undefined;
afterEach(() => { harness?.close(); harness = undefined; vi.restoreAllMocks(); });
async function setup() { quietLogs(); harness = new T20Harness(); harness.mode = 'static'; await harness.seedHousehold('family-a'); return harness; }
describe('explicit household meal habits and private saved recipes', () => {
  it('cold start is Vietnamese family meals and explicit save reaches T03 without changing hard policy', async () => {
    const h = await setup();
    const defaults = await h.call('family-a', 'GET', '/family-preferences');
    expect(defaults.status).toBe(200);
    expect(defaults.json.preferences.internationalMealsPerWeek).toBe(0);
    const hard = RankingPreferencesSchema.parse({ allergens: ['peanut'], forbiddenIngredientIds: ['BEEF'], hardMaxTimeMinutes: 35 });
    h.db.seed(`INSERT INTO member_ranking_preferences VALUES ('family-a','${h.users['family-a']}','${JSON.stringify({version:1,values:hard})}','2030-01-01T00:00:00.000Z')`);
    const profile = FamilyPreferencesSchema.parse({ preferredRegions: ['trung'], dislikedIngredientIds: ['MUSHROOM'], preferredTimeMinutes: 30 });
    const saved = await h.call('family-a', 'PUT', '/family-preferences', { expectedRevision: 0, preferences: profile });
    expect(saved.status).toBe(200); expect(saved.json.revision).toBe(1);
    const again = await h.call('family-a', 'PUT', '/family-preferences', { expectedRevision: 1, preferences: {...profile, preferredRegions:['nam']} });
    expect(again.status).toBe(200); expect(again.json.revision).toBe(2);
    const ranking = JSON.parse(h.db.query<{values_json:string}>('SELECT values_json FROM member_ranking_preferences')[0].values_json).values;
    expect(ranking.preferredCuisines).toEqual(['vietnamese']);
    expect(ranking.dislikedIngredientIds).toEqual(['MUSHROOM']); expect(ranking.allergens).toEqual(['peanut']);
    expect(ranking.forbiddenIngredientIds).toEqual(['BEEF']); expect(ranking.hardMaxTimeMinutes).toBe(35);
    const stale = await h.call('family-a', 'PUT', '/family-preferences', {expectedRevision: 1, preferences: profile});
    expect(stale.status).toBe(409); expect((await h.call('family-a','GET','/family-preferences')).json.revision).toBe(2);
  });
  it('reads and explicitly changes hard safety fields while retaining unrelated hard limits', async () => {
    const h = await setup();
    const hard = RankingPreferencesSchema.parse({ allergens: ['peanut'], forbiddenIngredientIds: ['BEEF'], hardMaxTimeMinutes: 35 });
    h.db.seed(`INSERT INTO member_ranking_preferences VALUES ('family-a','${h.users['family-a']}','${JSON.stringify({version:1,values:hard})}','2030-01-01T00:00:00.000Z')`);
    const initial = await h.call('family-a', 'GET', '/family-preferences');
    expect(initial.json.preferences).toMatchObject({ allergens: ['peanut'], forbiddenIngredientIds: ['BEEF'] });
    expect(initial.status).toBe(200);
    const saved = await h.call('family-a', 'PUT', '/family-preferences', { expectedRevision: 0,
      preferences: { ...initial.json.preferences, allergens: ['shellfish'], forbiddenIngredientIds: ['PORK_BELLY'] } });
    expect(saved.status).toBe(200);
    expect(saved.json.preferences).toMatchObject({ allergens: ['shellfish'], forbiddenIngredientIds: ['PORK_BELLY'] });
    const ranking = JSON.parse(h.db.query<{ values_json:string }>('SELECT values_json FROM member_ranking_preferences')[0].values_json).values;
    expect(ranking).toMatchObject({ allergens: ['shellfish'], forbiddenIngredientIds: ['PORK_BELLY'], hardMaxTimeMinutes: 35 });
    const cleared = await h.call('family-a', 'PUT', '/family-preferences', { expectedRevision: 1,
      preferences: { ...saved.json.preferences, allergens: [], forbiddenIngredientIds: [] } });
    expect(cleared.status).toBe(200);
    expect(cleared.json.preferences).toMatchObject({ allergens: [], forbiddenIngredientIds: [] });
  });
  it('preserves absent hard arrays as defaults when updating an older valid ranking record', async () => {
    const h=await setup();
    h.db.seed(`INSERT INTO member_ranking_preferences VALUES('family-a','${h.users['family-a']}','{"version":1,"values":{}}','2030-01-01T00:00:00.000Z')`);
    const result=await h.call('family-a','PUT','/family-preferences',{expectedRevision:0,preferences:{preferredRegions:['bac']}});
    expect(result.status).toBe(200);
    expect(result.json.preferences).toMatchObject({allergens:[],forbiddenIngredientIds:[]});
  });
  it('rejects unsupported cuisines/duplicate regions and does not infer legacy diet safety', async () => {
    const h = await setup();
    for (const preferences of [{preferredCuisines:['western']},{preferredRegions:['bac','bac']}]) {
      expect((await h.call('family-a','PUT','/family-preferences',{expectedRevision:0,preferences})).status).toBe(422);
    }
    expect(h.db.query('SELECT * FROM family_meal_preferences')).toHaveLength(0);
  });
  it('first save races have one winner and no mixed ranking data', async () => {
    const h = await setup(); const barrier = createBarrier(2);
    h.db.hooks.beforeBatch = async (statements) => { if (statements[0]?.sql.includes('INSERT INTO family_meal_preferences')) await barrier.wait(); };
    const res = await Promise.all([h.call('family-a','PUT','/family-preferences',{expectedRevision:0,preferences:{preferredRegions:['bac']}}),
      h.call('family-a','PUT','/family-preferences',{expectedRevision:0,preferences:{preferredRegions:['nam'],preferredTimeMinutes:60}})]);
    expect(res.map(r=>r.status).sort()).toEqual([200,409]);
    expect(h.db.query('SELECT * FROM family_meal_preferences')).toHaveLength(1);
    expect(h.db.query('SELECT * FROM member_ranking_preferences')).toHaveLength(1);
  });
  it('saves across reads, retains tombstone revisions, stays user private and never inserts catalog recipes', async () => {
    const h = await setup(); await h.seedHousehold('family-b');
    const catalogBefore = h.db.query('SELECT id FROM recipes').length;
    const saved = await h.call('family-a','PUT','/recipe-favorites/vn-kho-01',{expectedRevision:0,isSaved:true});
    expect(saved.status).toBe(200); expect(saved.json.revision).toBe(1);
    const list = await h.call('family-a','GET','/recipe-favorites'); expect(list.status).toBe(200);
    expect(list.json.entries[0]).toMatchObject({recipeId:'vn-kho-01',isSaved:true,available:true});
    expect(list.json.entries[0].roles).toContain('main');
    expect((await h.call('family-b','GET','/recipe-favorites')).json.entries).toEqual([]);
    const removed = await h.call('family-a','PUT','/recipe-favorites/vn-kho-01',{expectedRevision:1,isSaved:false});
    expect(removed.status).toBe(200); expect(removed.json.revision).toBe(2);
    expect((await h.call('family-a','GET','/recipe-favorites')).json.entries).toEqual([]);
    expect((await h.call('family-a','GET','/recipe-favorites/vn-kho-01')).json).toMatchObject({revision:2,isSaved:false});
    expect((await h.call('family-a','PUT','/recipe-favorites/vn-kho-01',{expectedRevision:0,isSaved:true})).status).toBe(409);
    expect(h.db.query('SELECT id FROM recipes')).toHaveLength(catalogBefore);
  });
  it('allows unsaving unavailable entries and refuses arbitrary save/guest save', async () => {
    const h = await setup();
    expect((await h.call('family-a','PUT','/recipe-favorites/does-not-exist',{expectedRevision:0,isSaved:true})).status).toBe(404);
    await h.call('family-a','PUT','/recipe-favorites/vn-kho-01',{expectedRevision:0,isSaved:true});
    h.db.seed("UPDATE saved_recipe_entries SET recipe_id = 'unavailable-recipe' WHERE recipe_id = 'vn-kho-01'");
    expect((await h.call('family-a','GET','/recipe-favorites')).json.entries[0].available).toBe(false);
    expect((await h.call('family-a','PUT','/recipe-favorites/unavailable-recipe',{expectedRevision:1,isSaved:false})).status).toBe(200);
    h.db.seed(`UPDATE users SET is_guest = 1 WHERE id = '${h.users['family-a']}'`);
    expect((await h.call('family-a','GET','/recipe-favorites')).status).toBe(403);
  });
  it('membership revocation after preload prevents a profile write', async () => {
    const h = await setup();
    h.db.hooks.beforeBatch = (statements) => { if (statements[0]?.sql.includes('INSERT INTO family_meal_preferences')) h.db.seed("DELETE FROM household_members WHERE household_id = 'family-a'"); };
    expect((await h.call('family-a','PUT','/family-preferences',{expectedRevision:0,preferences:{}})).status).toBe(403);
    expect(h.db.query('SELECT * FROM family_meal_preferences')).toEqual([]);
  });
});
