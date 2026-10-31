import { afterEach, describe, expect, it, vi } from 'vitest';
import { T20Harness, T20_INTENT, quietLogs } from '../helpers/t20-composition-harness';
import { createBarrier } from '../helpers/sqlite-d1';
import { FamilyMealPlanDtoSchema } from '../../packages/domain/src/family-meal-planning-api';
import { fetchWorker } from '../helpers/worker-fetch.mjs';
import { T20_ORIGIN } from '../helpers/t20-composition-harness';
import { sharePlanShopping, type ShoppingDemandSnapshot } from '../../src/worker/services/shopping-plan';
let h:T20Harness;
afterEach(()=>{h?.close();vi.restoreAllMocks();});
async function setup(){quietLogs();h=new T20Harness();h.mode='static';await h.seedHousehold('family-shop');
  const generated=await h.call('family-shop','POST','/meal-planning/plans',T20_INTENT);expect(generated.status).toBe(200);return generated.json;}
function demand(planRevision=1):ShoppingDemandSnapshot{return {planRevision,rows:[
  {ingredientId:'TOMATO',name:'Cà chua',quantity:200,unit:'g',slotId:'2030-01-02:dinner:0',date:'2030-01-02',mealType:'dinner',componentId:'main',recipeId:'vn-kho-01',title:'Món chính',optional:false},
  {ingredientId:'TOMATO',name:'Cà chua',quantity:0.3,unit:'kg',slotId:'2030-01-03:dinner:0',date:'2030-01-03',mealType:'dinner',componentId:'soup',recipeId:'vn-canh-01',title:'Món canh',optional:false},
  {ingredientId:'GARLIC',name:'Tỏi',quantity:null,unit:'piece',slotId:'2030-01-03:dinner:0',date:'2030-01-03',mealType:'dinner',componentId:'vegetable',recipeId:null,title:'Món rau',optional:false},
]};}
describe('whole-plan shopping materialization',()=>{
  it('normalizes compatible units, preserves attribution and keeps unknown quantity visible',async()=>{
    const plan=await setup();const input={planId:plan.id,expectedRevision:plan.revision,startDate:'2030-01-02',endDate:'2030-01-08'};
    const result=await sharePlanShopping(h.db,{householdId:'family-shop',userId:h.users['family-shop']},input,'share-command-1',async()=>demand());
    expect(result).toMatchObject({itemCount:2,unresolvedCount:1,idempotentReplay:false});
    const list=await h.call('family-shop','GET','/shopping-list');expect(list.status).toBe(200);
    expect(list.json.items).toHaveLength(1);expect(list.json.items[0]).toMatchObject({name:'Cà chua',quantity:500,unit:'g',generated:true});
    expect(list.json.items[0].contributions.map((item:{componentId:string})=>item.componentId)).toEqual(['main','soup']);
    expect(list.json.unresolvedItems[0]).toMatchObject({ingredientId:'GARLIC',name:'Tỏi'});
    const replay=await sharePlanShopping(h.db,{householdId:'family-shop',userId:h.users['family-shop']},input,'share-command-1',async()=>{throw new Error('must not recompute');});
    expect(replay).toEqual({...result,idempotentReplay:true});
  });
  it('keeps a converted quantity unresolved when its exact decimal cannot be represented for persistence', async () => {
    const plan=await setup(); const scope={householdId:'family-shop',userId:h.users['family-shop']};
    const rows=[{...demand().rows[0],quantity:0.13786382327688104,unit:'kg'}];
    const result=await sharePlanShopping(h.db,scope,{planId:plan.id,expectedRevision:1,startDate:'2030-01-02',endDate:'2030-01-08'},
      'exact-conversion-command',async()=>({planRevision:1,rows}));
    expect(result).toMatchObject({itemCount:1,unresolvedCount:1});
    const list=(await h.call('family-shop','GET','/shopping-list')).json;
    expect(list.items).toEqual([]);
    expect(list.unresolvedItems).toHaveLength(1);
    expect(list.unresolvedItems[0].contributions[0]).toMatchObject({quantity:0.13786382327688104,unit:'kg'});
  });
  it('keeps exact conversion overflow visible as unresolved demand', async () => {
    const plan=await setup(); const scope={householdId:'family-shop',userId:h.users['family-shop']};
    const rows=[{...demand().rows[0],quantity:1e307,unit:'kg'}];
    const result=await sharePlanShopping(h.db,scope,{planId:plan.id,expectedRevision:1,startDate:'2030-01-02',endDate:'2030-01-08'},
      'overflow-conversion-command',async()=>({planRevision:1,rows}));
    expect(result).toMatchObject({itemCount:1,unresolvedCount:1});
    const list=(await h.call('family-shop','GET','/shopping-list')).json;
    expect(list.items).toEqual([]);
    expect(list.unresolvedItems[0].contributions[0]).toMatchObject({quantity:1e307,unit:'kg'});
  });
  it('repeat update retains manual entries, checked state and explicit purchase quantity/unit',async()=>{
    const plan=await setup();const input={planId:plan.id,expectedRevision:plan.revision,startDate:'2030-01-02',endDate:'2030-01-08'};const scope={householdId:'family-shop',userId:h.users['family-shop']};
    await sharePlanShopping(h.db,scope,input,'share-command-2',async()=>demand());
    let list=(await h.call('family-shop','GET','/shopping-list')).json;const id=list.items[0].id;
    expect((await h.call('family-shop','PATCH',`/shopping-list/items/${id}`,{quantity:1,unit:'kg',isChecked:true,cannotBuy:false})).status).toBe(200);
    expect((await h.call('family-shop','POST','/shopping-list/items',{id:'manual-shopping-item',name:'Bánh cho con',quantity:2,unit:'pack'})).status).toBe(201);
    await sharePlanShopping(h.db,scope,input,'share-command-3',async()=>demand());
    list=(await h.call('family-shop','GET','/shopping-list')).json;
    expect(list.items).toHaveLength(2);expect(list.items.find((item:{id:string})=>item.id===id)).toMatchObject({quantity:1,unit:'kg',isChecked:true,cannotBuy:false,quantityOverridden:true});
    expect(list.items.find((item:{id:string})=>item.id==='manual-shopping-item')).toMatchObject({quantity:2,name:'Bánh cho con'});
    expect(h.db.query("SELECT * FROM inventory_events WHERE household_id='family-shop'")).toEqual([]);
  });
  it('purchase status transitions remain exclusive across reload without changing quantity', async () => {
    const plan=await setup(); const scope={householdId:'family-shop',userId:h.users['family-shop']};
    await sharePlanShopping(h.db,scope,{planId:plan.id,expectedRevision:1,startDate:'2030-01-02',endDate:'2030-01-08'},
      'exclusive-status-initial',async()=>demand());
    const id=(await h.call('family-shop','GET','/shopping-list')).json.items[0].id;
    expect((await h.call('family-shop','PATCH',`/shopping-list/items/${id}`,{isChecked:true,cannotBuy:true})).status).toBe(400);
    expect((await h.call('family-shop','PATCH',`/shopping-list/items/${id}`,{isChecked:true})).status).toBe(200);
    expect((await h.call('family-shop','GET','/shopping-list')).json.items[0]).toMatchObject({quantity:500,isChecked:true,cannotBuy:false});
    expect((await h.call('family-shop','PATCH',`/shopping-list/items/${id}`,{cannotBuy:true})).status).toBe(200);
    expect((await h.call('family-shop','GET','/shopping-list')).json.items[0]).toMatchObject({quantity:500,isChecked:false,cannotBuy:true});
    expect((await h.call('family-shop','PATCH',`/shopping-list/items/${id}`,{isChecked:true})).status).toBe(200);
    expect((await h.call('family-shop','GET','/shopping-list')).json.items[0]).toMatchObject({quantity:500,isChecked:true,cannotBuy:false});
  });
  it('trip horizon selects demand dates and update removes only untouched generated rows',async()=>{
    const plan=await setup();const scope={householdId:'family-shop',userId:h.users['family-shop']};
    const input={planId:plan.id,expectedRevision:1,startDate:'2030-01-02',endDate:'2030-01-02'};
    await sharePlanShopping(h.db,scope,input,'share-command-4',async()=>demand());
    expect((await h.call('family-shop','GET','/shopping-list')).json.items[0].quantity).toBe(200);
    await sharePlanShopping(h.db,scope,{...input,startDate:'2030-01-05',endDate:'2030-01-05'},'share-command-5',async()=>demand());
    expect((await h.call('family-shop','GET','/shopping-list')).json.items).toEqual([]);
  });
  it('plan revision change after calculation atomically rolls back list, source and receipt',async()=>{
    const plan=await setup();h.db.hooks.beforeBatch=(statements)=>{if(statements.some(s=>s.sql.includes('shopping_plan_commands')))h.db.seed(`UPDATE generated_meal_plans SET revision=2 WHERE id='${plan.id}'`);};
    await expect(sharePlanShopping(h.db,{householdId:'family-shop',userId:h.users['family-shop']},{planId:plan.id,expectedRevision:1,startDate:'2030-01-02',endDate:'2030-01-08'},'share-command-6',async()=>demand())).rejects.toMatchObject({code:'SHOPPING_SNAPSHOT_CHANGED'});
    expect(h.db.query("SELECT * FROM shopping_lists WHERE household_id='family-shop'")).toHaveLength(0);
    expect(h.db.query('SELECT * FROM shopping_plan_sources')).toHaveLength(0);expect(h.db.query('SELECT * FROM shopping_plan_commands')).toHaveLength(0);
  });
  it('fences inventory and preference changes during reconciliation using a bounded witness', async () => {
    const plan = await setup(); const scope = { householdId:'family-shop', userId:h.users['family-shop'] };
    const input = {planId:plan.id,expectedRevision:1,startDate:'2030-01-02',endDate:'2030-01-08'};
    const lots = h.db.query<{id:string;version:number;quantity:number;unit:string}>("SELECT id,version,quantity,unit FROM inventory_items WHERE household_id='family-shop'");
    h.db.hooks.beforeBatch = statements => {
      if (statements.some(statement => statement.sql.includes('shopping_plan_commands')))
        h.db.seed(`UPDATE inventory_items SET quantity=quantity+1 WHERE id='${lots[0].id}'`);
      expect(statements.every(statement => statement.bindings.length <= 100)).toBe(true);
    };
    await expect(sharePlanShopping(h.db,scope,input,'inventory-race-command',async()=>({...demand(),inventoryWitness:lots})))
      .rejects.toMatchObject({code:'SHOPPING_SNAPSHOT_CHANGED'});
    expect(h.db.query('SELECT * FROM shopping_plan_commands')).toHaveLength(0);
    h.db.hooks.beforeBatch = statements => {
      if (statements.some(statement => statement.sql.includes('shopping_plan_commands')))
        h.db.seed(`INSERT INTO member_ranking_preferences VALUES ('family-shop','${scope.userId}','{"version":1,"values":{}}','2030-01-01T00:00:00.000Z')`);
    };
    await expect(sharePlanShopping(h.db,scope,input,'preference-race-command',async()=>({...demand(),
      preferenceWitness:{memberJson:null,householdJson:null,profileRevision:0}})))
      .rejects.toMatchObject({code:'SHOPPING_SNAPSHOT_CHANGED'});
    expect(h.db.query('SELECT * FROM shopping_plan_sources')).toHaveLength(0);
  });
  it('same-key concurrent shares create one receipt and replay the original result after a later trip update', async () => {
    const plan = await setup(); const scope = { householdId:'family-shop', userId:h.users['family-shop'] };
    const input = {planId:plan.id,expectedRevision:1,startDate:'2030-01-02',endDate:'2030-01-08'};
    const barrier = createBarrier(2);
    h.db.hooks.beforeBatch = async statements => {
      if (statements.some(statement => statement.sql.includes('shopping_plan_commands'))) await barrier.wait();
    };
    const [first, second] = await Promise.all([sharePlanShopping(h.db,scope,input,'concurrent-share',async()=>demand()),
      sharePlanShopping(h.db,scope,input,'concurrent-share',async()=>demand())]);
    expect([first.idempotentReplay,second.idempotentReplay].sort()).toEqual([false,true]);
    expect(h.db.query('SELECT * FROM shopping_plan_commands')).toHaveLength(1);
    h.db.hooks.beforeBatch = undefined;
    await sharePlanShopping(h.db,scope,{...input,endDate:'2030-01-02'},'later-trip-share',async()=>demand());
    const replay = await sharePlanShopping(h.db,scope,input,'concurrent-share',async()=>{throw new Error('must not recompute');});
    expect(replay).toMatchObject({itemCount:2,unresolvedCount:1,idempotentReplay:true});
    expect((await h.call('family-shop','GET','/shopping-list')).json.items[0].quantity).toBe(200);
    await expect(sharePlanShopping(h.db,scope,{...input,endDate:'2030-01-02'},'concurrent-share',async()=>demand()))
      .rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  });
  it('concurrent distinct trip commands leave only the last committed untouched generated demand', async () => {
    const plan=await setup(); const scope={householdId:'family-shop',userId:h.users['family-shop']};
    const rows=[demand().rows[0],{...demand().rows[2],quantity:3}];
    const barrier=createBarrier(2);
    h.db.hooks.beforeBatch=async statements=>{
      if(statements.some(statement=>statement.sql.includes('shopping_plan_commands')))await barrier.wait();
    };
    await Promise.all([
      sharePlanShopping(h.db,scope,{planId:plan.id,expectedRevision:1,startDate:'2030-01-02',endDate:'2030-01-02'},
        'distinct-trip-first',async()=>({planRevision:1,rows})),
      sharePlanShopping(h.db,scope,{planId:plan.id,expectedRevision:1,startDate:'2030-01-03',endDate:'2030-01-03'},
        'distinct-trip-second',async()=>({planRevision:1,rows})),
    ]);
    h.db.hooks.beforeBatch=undefined;
    const demands=h.db.query<{name:string;quantity:number;unit:string}>('SELECT name,quantity,unit FROM shopping_plan_demands');
    const items=(await h.call('family-shop','GET','/shopping-list')).json.items;
    expect(demands).toHaveLength(1);
    expect(items.map((item:{name:string;quantity:number;unit:string})=>({name:item.name,quantity:item.quantity,unit:item.unit}))).toEqual(demands);
    expect(h.db.query('SELECT * FROM shopping_plan_commands')).toHaveLength(2);
  });
  it('shares a real V2 composed plan through Worker HTTP without changing stock', async () => {
    await setup();
    const response = await fetchWorker(new Request(`${T20_ORIGIN}/api/v2/meal-planning/plans`, { method:'POST',
      headers:{Cookie:h.cookies['family-shop'],Origin:T20_ORIGIN,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),Accept:'application/json; recipe-content=1'},
      body:JSON.stringify(T20_INTENT) }), h.env());
    expect(response.status).toBe(200);
    const family = FamilyMealPlanDtoSchema.parse(await response.json());
    const stockBefore = h.db.query('SELECT id,quantity,version FROM inventory_items ORDER BY id');
    const shared = await h.call('family-shop','POST','/shopping-list/from-plan', {
      planId:family.plan.id, expectedRevision:family.plan.revision,startDate:'2030-01-02',endDate:'2030-01-08'}, {}, {'Idempotency-Key':'actual-v2-shopping'});
    expect(shared.status,JSON.stringify(shared.json)).toBe(200);
    const list = await h.call('family-shop','GET','/shopping-list');
    expect(list.status).toBe(200);
    expect(h.db.query('SELECT * FROM shopping_plan_demands').length).toBeGreaterThan(0);
    const contributions = h.db.query<{contributions_json:string}>('SELECT contributions_json FROM shopping_plan_demands')
      .flatMap(row=>JSON.parse(row.contributions_json) as Array<{componentId:string;recipeId:string|null;contentFingerprint:string|null}>);
    expect(new Set(contributions.map(row=>row.componentId)).size).toBeGreaterThan(1);
    const components = family.compositions.compositions.flatMap(row => row.components);
    for (const contribution of contributions) {
      const component = components.find(row => row.id === contribution.componentId)!;
      expect(contribution.contentFingerprint).toBe(component.contentFingerprint ?? null);
      if (contribution.recipeId) expect(contribution.contentFingerprint).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(h.db.query('SELECT id,quantity,version FROM inventory_items ORDER BY id')).toEqual(stockBefore);
    const foreign = await h.seedHousehold('family-stranger');
    expect(foreign).toBeTruthy();
    expect((await h.call('family-stranger','POST','/shopping-list/from-plan', {
      planId:family.plan.id,expectedRevision:family.plan.revision,startDate:'2030-01-02',endDate:'2030-01-08'})).status).toBe(404);
  },30000);
  it('checking after a concurrent purchase edit does not restore stale fields and dismissal survives the same plan', async () => {
    const plan = await setup(); const scope = {householdId:'family-shop',userId:h.users['family-shop']};
    const input = {planId:plan.id,expectedRevision:1,startDate:'2030-01-02',endDate:'2030-01-08'};
    await sharePlanShopping(h.db,scope,input,'dismissal-initial',async()=>demand());
    const id = (await h.call('family-shop','GET','/shopping-list')).json.items[0].id;
    h.db.hooks.beforeBatch = statements => {
      if(statements.some(statement=>statement.sql.includes('UPDATE shopping_items SET')))
        h.db.seed(`UPDATE shopping_items SET quantity=2,unit='kg' WHERE id='${id}'`);
    };
    expect((await h.call('family-shop','PATCH',`/shopping-list/items/${id}`,{isChecked:true})).status).toBe(200);
    h.db.hooks.beforeBatch = undefined;
    expect((await h.call('family-shop','GET','/shopping-list')).json.items[0]).toMatchObject({quantity:2,unit:'kg',isChecked:true});
    expect((await h.call('family-shop','DELETE',`/shopping-list/items/${id}`)).status).toBe(200);
    await sharePlanShopping(h.db,scope,input,'dismissal-repeat',async()=>demand());
    expect((await h.call('family-shop','GET','/shopping-list')).json.items).toEqual([]);
    expect(h.db.query('SELECT * FROM shopping_plan_item_dismissals')).toHaveLength(1);
    await sharePlanShopping(h.db,scope,input,'dismissed-unknown-repeat',async()=>({...demand(),
      rows:demand().rows.map(row=>row.ingredientId==='TOMATO'?{...row,quantity:null}:row)}));
    const dismissedList=(await h.call('family-shop','GET','/shopping-list')).json;
    expect(dismissedList.items).toEqual([]);
    expect(dismissedList.unresolvedItems.map((row:{ingredientId:string})=>row.ingredientId)).toEqual(['GARLIC']);
    const next = (await h.call('family-shop','POST','/meal-planning/plans',T20_INTENT)).json;
    await sharePlanShopping(h.db,scope,{...input,planId:next.id},'replacement-plan',async()=>demand());
    expect((await h.call('family-shop','GET','/shopping-list')).json.items).toHaveLength(1);
    expect(h.db.query('SELECT DISTINCT source_id FROM shopping_plan_demands')).toHaveLength(1);
  });
  it('a replaced item cannot change another household purchase override during a PATCH race', async () => {
    const plan=await setup(); const scope={householdId:'family-shop',userId:h.users['family-shop']};
    await sharePlanShopping(h.db,scope,{planId:plan.id,expectedRevision:1,startDate:'2030-01-02',endDate:'2030-01-08'},
      'replacement-race-initial',async()=>demand());
    const id=(await h.call('family-shop','GET','/shopping-list')).json.items[0].id;
    await h.seedHousehold('foreign-shopping');
    h.db.seed("INSERT INTO shopping_lists(id,household_id,name) VALUES ('foreign-list','foreign-shopping','Other household')");
    h.db.hooks.beforeBatch=statements=>{
      if(!statements.some(statement=>statement.sql.includes('UPDATE shopping_items SET')))return;
      h.db.seed(`DELETE FROM shopping_items WHERE id='${id}';
        INSERT INTO shopping_items(id,list_id,name,quantity,unit) VALUES ('${id}','foreign-list','Foreign purchase',3,'kg');
        INSERT INTO shopping_generated_item_state(item_id,list_id,demand_key) VALUES ('${id}','foreign-list','TOMATO:g');`);
    };
    expect((await h.call('family-shop','PATCH',`/shopping-list/items/${id}`,{quantity:100})).status).toBe(409);
    expect(h.db.query('SELECT is_overridden FROM shopping_generated_item_state WHERE item_id=?',id)).toEqual([{is_overridden:0}]);
    expect(h.db.query('SELECT quantity,unit FROM shopping_items WHERE id=?',id)).toEqual([{quantity:3,unit:'kg'}]);
  });
  it('database failures are unavailable rather than being mislabeled a stale plan', async () => {
    const plan=await setup();
    h.db.seed(`CREATE TRIGGER reject_shopping_demand BEFORE INSERT ON shopping_plan_demands BEGIN SELECT RAISE(ABORT,'synthetic shopping failure'); END;`);
    await expect(sharePlanShopping(h.db,{householdId:'family-shop',userId:h.users['family-shop']},
      {planId:plan.id,expectedRevision:1,startDate:'2030-01-02',endDate:'2030-01-08'},'shopping-db-failure',async()=>demand()))
      .rejects.toMatchObject({code:'SHOPPING_UPDATE_FAILED',status:503});
    expect(h.db.query('SELECT * FROM shopping_plan_commands')).toHaveLength(0);
    expect(h.db.query('SELECT * FROM shopping_plan_sources')).toHaveLength(0);
  });
  it('recipe shopping saves canonical identity and displays titles without creating catalog rows',async()=>{
    await setup();const before=h.db.query('SELECT id FROM recipes').length;
    const res=await h.call('family-shop','POST','/shopping-list/items',{id:'canonical-recipe-shopping',name:'Cà chua',quantity:2,unit:'piece',ingredientId:'TOMATO',sourceRecipeId:'vn-canh-01'});
    expect(res.status).toBe(201);expect(res.json.item.ingredientId).toBe('TOMATO');expect(res.json.item.sourceRecipeTitle).not.toBe('vn-canh-01');
    const saved=(await h.call('family-shop','GET','/shopping-list')).json.items[0];expect(saved.sourceRecipeId).toBe('vn-canh-01');expect(saved.sourceRecipeTitle).toBe(res.json.item.sourceRecipeTitle);
    expect(h.db.query('SELECT id FROM recipes')).toHaveLength(before);
  });
});
