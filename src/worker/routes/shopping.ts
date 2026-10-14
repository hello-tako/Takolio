import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { Env, AuthContext } from '../types';
import type { D1DatabaseBinding } from '@frigo/db';
import { SharePlanShoppingSchema, ShoppingContributionSchema, ReviewShoppingDemandSchema } from '../../../packages/domain/src/shopping-plan-api';
import { sharePlanShopping } from '../services/shopping-plan';
import { projectUnknownShoppingDemand, reviewShoppingDemand, unknownShoppingDemandStatement, type ShoppingDemandReviewRow } from '../services/shopping-demand-review';
import { MealPlanningApplicationService } from '../services/meal-planning';
import { MealPlanningError } from '../services/meal-planning-error';
import { GeneratedMealPlanPersistenceError } from '../../../packages/db/src/meal-planning';
import { readFamilyPreferences } from '../../../packages/db/src/family-preferences';
import { backgroundExecutorOf, resolveRecipeAuthority } from '../services/recipe-authority';
import { tenancyGuard } from '../middleware/tenancy';
import { rateLimiter } from '../middleware/rate-limit';
import { ShoppingItemCreateSchema, ShoppingItemUpdateSchema } from '../validation/schemas';

export const shoppingRoutes = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
shoppingRoutes.use('/shopping-list*', tenancyGuard);
shoppingRoutes.use('/shopping-list*', bodyLimit({maxSize:65_536}));
shoppingRoutes.use('/shopping-list*', async (c,next) => {
  c.header('Cache-Control','no-store');
  return c.req.method === 'GET' ? next() : rateLimiter({maxRequests:60,windowSeconds:60,prefix:'rl_shop_w'})(c,next);
});

async function getOrCreateShoppingList(db:D1DatabaseBinding, householdId:string):Promise<string> {
  const existing=await db.prepare('SELECT id FROM shopping_lists WHERE household_id = ? LIMIT 1').bind(householdId).first<{id:string}>();
  if(existing) return existing.id;
  const listId=`list_${householdId}`;
  await db.prepare('INSERT OR IGNORE INTO shopping_lists(id,household_id,name) VALUES(?,?,?)').bind(listId,householdId,'Đi chợ cho gia đình').run();
  return listId;
}
interface ItemRow {
  id:string; name:string; quantity:number; unit:string; is_checked:number; created_at:string;
  ingredient_id:string|null; source_recipe_id:string|null; recipe_title:string|null;
  ingredient_identity:string|null; recipe_identity:string|null; cannot_buy:number|null;
  household_id:string; demand_key:string|null; is_overridden:number|null; unknown_demand:number;
}
const SELECT_ITEMS=`SELECT si.*, sl.household_id, COALESCE(meta.recipe_title,r.title) AS recipe_title,
  meta.ingredient_identity, meta.recipe_identity, meta.cannot_buy, state.demand_key, state.is_overridden,
  EXISTS(SELECT 1 FROM shopping_plan_demands demand JOIN shopping_plan_sources source ON source.id=demand.source_id
    WHERE source.list_id=si.list_id AND demand.demand_key=state.demand_key AND demand.quantity IS NULL) AS unknown_demand
  FROM shopping_items si JOIN shopping_lists sl ON sl.id=si.list_id
  LEFT JOIN recipes r ON r.id=si.source_recipe_id
  LEFT JOIN shopping_item_metadata meta ON meta.item_id=si.id
  LEFT JOIN shopping_generated_item_state state ON state.item_id=si.id`;
const dto=(row:ItemRow,contributions:unknown[]=[])=>({id:row.id,name:row.name,quantity:row.quantity,unit:row.unit,
  isChecked:!!row.is_checked,cannotBuy:!!row.cannot_buy,ingredientId:row.ingredient_identity ?? row.ingredient_id,
  sourceRecipeId:row.recipe_identity ?? row.source_recipe_id,sourceRecipeTitle:row.recipe_title ?? null,
  createdAt:row.created_at,generated:row.demand_key !== null,quantityOverridden:!!row.is_overridden,unknownDemand:!!row.unknown_demand,contributions});

shoppingRoutes.get('/shopping-list',async(c)=>{
  if(!c.env.DB) return c.json({code:'DATABASE_UNAVAILABLE'},503);
  try {
    const listId=await getOrCreateShoppingList(c.env.DB,c.get('auth').householdId);
    const [res,demands,unknown]=await c.env.DB.batch([
      c.env.DB.prepare(`${SELECT_ITEMS} WHERE si.list_id=? ORDER BY si.is_checked ASC,si.created_at DESC`).bind(listId),
      c.env.DB.prepare(`SELECT d.*,s.plan_id FROM shopping_plan_demands d JOIN shopping_plan_sources s ON s.id=d.source_id WHERE s.list_id=?
        AND NOT EXISTS(SELECT 1 FROM shopping_plan_item_dismissals dismissed WHERE dismissed.list_id=s.list_id
          AND dismissed.demand_key=d.demand_key AND dismissed.plan_id=s.plan_id)`).bind(listId),
      unknownShoppingDemandStatement(c.env.DB,listId),
    ]);
    if(!res.success || !demands.success || !unknown.success) throw new Error('Shopping read failed');
    const sources=new Map<string,unknown[]>();
    for(const demand of demands.results as Array<{demand_key:string;contributions_json:string}>){
      const contributions=z.array(ShoppingContributionSchema).parse(JSON.parse(demand.contributions_json));
      sources.set(demand.demand_key,[...(sources.get(demand.demand_key) ?? []),...contributions]);
    }
    const unresolvedItems=await Promise.all((unknown.results as ShoppingDemandReviewRow[]).map(projectUnknownShoppingDemand));
    const reviewedItems=new Map(unresolvedItems.filter(row=>row.purchaseItemId!==null).map(row=>[row.purchaseItemId,row.reviewState]));
    return c.json({items:(res.results as ItemRow[]).map(row=>({...dto(row,row.demand_key ? sources.get(row.demand_key) ?? [] : []),
      ...(reviewedItems.has(row.id)?{reviewState:reviewedItems.get(row.id)}:{})})),unresolvedItems});
  }catch{console.error('D1 GET shopping list failed:');return c.json({code:'DATABASE_UNAVAILABLE',error:'Database service unavailable'},503);}
});

shoppingRoutes.post('/shopping-list/items',async(c)=>{
  const parsed=ShoppingItemCreateSchema.safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success) return c.json({code:'VALIDATION_ERROR',error:'Mặt hàng chưa hợp lệ.'},400);
  if(!c.env.DB) return c.json({code:'DATABASE_UNAVAILABLE'},503);
  const auth=c.get('auth');const body=parsed.data;const db=c.env.DB;
  try{
    const listId=await getOrCreateShoppingList(db,auth.householdId);
    const id=body.id ?? `shop_${crypto.randomUUID()}`;
    const existing=await db.prepare(`${SELECT_ITEMS} WHERE si.id=?`).bind(id).first<ItemRow>();
    if(existing){
      if(existing.household_id!==auth.householdId) return c.json({code:'CONFLICT'},409);
      return c.json({success:true,idempotentReplay:true,item:dto(existing)});
    }
    const sourceRef=body.sourceRecipeId ?? body.sourceRecipeTitle;
    const recipe=sourceRef ? (await resolveRecipeAuthority(c.env,{tenantKey:auth.householdId})).snapshot.findByIdOrSlug(sourceRef) : null;
    if(body.sourceRecipeId && !recipe) return c.json({code:'RECIPE_UNAVAILABLE'},422);
    const recipeId=recipe ? await db.prepare('SELECT id FROM recipes WHERE id=?').bind(recipe.id).first<{id:string}>() : null;
    const ingredient=body.ingredientId ? await db.prepare('SELECT id FROM ingredients WHERE id=?').bind(body.ingredientId).first<{id:string}>() : null;
    const results=await db.batch([
      db.prepare(`INSERT OR IGNORE INTO shopping_items(id,list_id,ingredient_id,name,quantity,unit,is_checked,source_recipe_id)
        SELECT ?,?,?,?,?,?,0,? WHERE EXISTS(SELECT 1 FROM household_members WHERE household_id=? AND user_id=?)`)
        .bind(id,listId,ingredient?.id ?? null,body.name.trim(),body.quantity,body.unit,recipeId?.id ?? null,auth.householdId,auth.userId),
      db.prepare(`INSERT OR IGNORE INTO shopping_item_metadata(item_id,ingredient_identity,recipe_identity,recipe_title)
        SELECT id,?,?,? FROM shopping_items WHERE id=? AND list_id=?`).bind(body.ingredientId ?? null,recipe?.id ?? null,recipe?.title ?? body.sourceRecipeTitle ?? null,id,listId),
    ]);
    if(results.some(result=>!result.success)) throw new Error('Shopping insert failed');
    const created=await db.prepare(`${SELECT_ITEMS} WHERE si.id=? AND sl.household_id=?`).bind(id,auth.householdId).first<ItemRow>();
    if(!created) return c.json({code:'FORBIDDEN'},403);
    return c.json({success:true,item:dto(created)},201);
  }catch{return c.json({code:'DATABASE_ERROR',error:'Chưa thêm được mặt hàng.'},500);}
});

const UpdateSchema=ShoppingItemUpdateSchema.extend({unit:z.enum(['g','kg','ml','l','piece','pack','bunch','slice']).optional()})
  .refine(value=>Object.values(value).some(value=>value!==undefined),'At least one change required')
  .refine(value=>!(value.isChecked===true&&value.cannotBuy===true),'Bought and unavailable are mutually exclusive');
shoppingRoutes.patch('/shopping-list/items/:id',async(c)=>{
  const parsed=UpdateSchema.safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success)return c.json({code:'VALIDATION_ERROR'},400);
  if(!c.env.DB)return c.json({code:'DATABASE_UNAVAILABLE'},503);
  const auth=c.get('auth');const id=c.req.param('id');
  const body={...parsed.data,...(parsed.data.isChecked===true?{cannotBuy:false}:{}),...(parsed.data.cannotBuy===true?{isChecked:false}:{})};
  const db=c.env.DB;
  try{
    const existing=await db.prepare(`${SELECT_ITEMS} WHERE si.id=? AND sl.household_id=?`).bind(id,auth.householdId).first<ItemRow>();
    if(!existing)return c.json({code:'NOT_FOUND'},404);
    // Write only submitted fields so checking an item cannot restore a stale purchase quantity.
    const fields:string[] = ["updated_at=datetime('now')"];
    const values:Array<string|number> = [];
    if(body.isChecked!==undefined){fields.push('is_checked=?');values.push(body.isChecked?1:0);}
    if(body.quantity!==undefined){fields.push('quantity=?');values.push(body.quantity);}
    if(body.name!==undefined){fields.push('name=?');values.push(body.name.trim());}
    if(body.unit!==undefined){fields.push('unit=?');values.push(body.unit);}
    const statements=[db.prepare(`UPDATE shopping_items SET ${fields.join(',')} WHERE id=?
      AND list_id IN(SELECT id FROM shopping_lists WHERE household_id=?)
      AND EXISTS(SELECT 1 FROM household_members WHERE household_id=? AND user_id=?)`)
      .bind(...values,id,auth.householdId,auth.householdId,auth.userId)];
    if(body.cannotBuy!==undefined)statements.push(db.prepare(`INSERT INTO shopping_item_metadata(item_id,cannot_buy) SELECT id,? FROM shopping_items
      WHERE id=? AND list_id IN(SELECT id FROM shopping_lists WHERE household_id=?)
      AND EXISTS(SELECT 1 FROM household_members WHERE household_id=? AND user_id=?)
      ON CONFLICT(item_id) DO UPDATE SET cannot_buy=excluded.cannot_buy`)
      .bind(body.cannotBuy?1:0,id,auth.householdId,auth.householdId,auth.userId));
    if(body.quantity!==undefined||body.name!==undefined||body.unit!==undefined)statements.push(db.prepare(`UPDATE shopping_generated_item_state SET is_overridden=1 WHERE item_id=?
      AND list_id IN(SELECT id FROM shopping_lists WHERE household_id=?)
      AND EXISTS(SELECT 1 FROM household_members WHERE household_id=? AND user_id=?)`)
      .bind(id,auth.householdId,auth.householdId,auth.userId));
    const results=await db.batch(statements);
    if(results.some(result=>!result.success))throw new Error('Shopping update failed');
    if(results[0].meta.changes!==1)return c.json({code:'CONFLICT'},409);
    const updated=await db.prepare(`${SELECT_ITEMS} WHERE si.id=? AND sl.household_id=?`).bind(id,auth.householdId).first<ItemRow>();
    return c.json({success:true,item:dto(updated!)});
  }catch{return c.json({code:'DATABASE_ERROR'},500);}
});
shoppingRoutes.delete('/shopping-list/items/:id',async(c)=>{
  if(!c.env.DB)return c.json({code:'DATABASE_UNAVAILABLE'},503);
  const auth=c.get('auth');const id=c.req.param('id');
  try{
    const existing=await c.env.DB.prepare(`${SELECT_ITEMS} WHERE si.id=? AND sl.household_id=?`).bind(id,auth.householdId).first<ItemRow>();
    if(!existing)return c.json({code:'NOT_FOUND'},404);
    const deleted=await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE shopping_demand_reviews SET revision=revision+1,decision='pending',item_id=NULL,actor_user_id=?,updated_at=?
        WHERE item_id=? AND source_id IN(SELECT source.id FROM shopping_plan_sources source
          JOIN shopping_lists list ON list.id=source.list_id WHERE list.household_id=?)
        AND EXISTS(SELECT 1 FROM household_members WHERE household_id=? AND user_id=?)`)
        .bind(auth.userId,new Date().toISOString(),id,auth.householdId,auth.householdId,auth.userId),
      c.env.DB.prepare(`INSERT INTO shopping_plan_item_dismissals(list_id,demand_key,plan_id)
        SELECT state.list_id,state.demand_key,source.plan_id FROM shopping_generated_item_state state
        JOIN shopping_lists list ON list.id=state.list_id JOIN shopping_plan_sources source ON source.list_id=state.list_id
        JOIN shopping_plan_demands demand ON demand.source_id=source.id AND demand.demand_key=state.demand_key
        WHERE state.item_id=? AND list.household_id=? AND demand.quantity IS NOT NULL
        AND EXISTS(SELECT 1 FROM household_members WHERE household_id=? AND user_id=?)
        ON CONFLICT(list_id,demand_key) DO UPDATE SET plan_id=excluded.plan_id`)
        .bind(id,auth.householdId,auth.householdId,auth.userId),
      c.env.DB.prepare(`DELETE FROM shopping_items WHERE id=? AND list_id IN(SELECT id FROM shopping_lists WHERE household_id=?)
        AND EXISTS(SELECT 1 FROM household_members WHERE household_id=? AND user_id=?)`).bind(id,auth.householdId,auth.householdId,auth.userId),
    ]);
    if(deleted.some(result=>!result.success))throw new Error('Shopping delete failed');
    // D1 includes deleted metadata/state cascades in changes, so one item can affect several rows.
    const deletedCount=deleted[2].meta.changes;
    if(typeof deletedCount !== 'number' || !Number.isFinite(deletedCount) || deletedCount < 1)return c.json({code:'CONFLICT'},409);
    return c.json({success:true});
  }catch{return c.json({code:'DATABASE_ERROR'},500);}
});
shoppingRoutes.post('/shopping-list/demand-review',async(c)=>{
  if(!c.env.DB)return c.json({code:'DATABASE_UNAVAILABLE'},503);
  const parsed=ReviewShoppingDemandSchema.safeParse(await c.req.json().catch(()=>null));
  const key=c.req.header('Idempotency-Key');
  if(!parsed.success||!key)return c.json({code:'VALIDATION_ERROR',error:'Lựa chọn hoặc mã thao tác chưa hợp lệ.'},422);
  const auth=c.get('auth');
  try{
    return c.json(await reviewShoppingDemand(c.env.DB,{householdId:auth.householdId,userId:auth.userId},parsed.data,key));
  }catch(error){
    if(error instanceof MealPlanningError)return c.json({code:error.code,error:error.message},error.status);
    return c.json({code:'SHOPPING_REVIEW_FAILED',error:'Chưa xác nhận được lựa chọn. Hãy thử lại thao tác vừa gửi.'},503);
  }
});
shoppingRoutes.post('/shopping-list/from-plan',async(c)=>{
  const auth=c.get('auth');
  if(auth.isGuest)return c.json({code:'REGISTERED_ACCOUNT_REQUIRED'},403);
  if(c.env.MEAL_PLANNER_ENABLED!=='true'||c.env.MEAL_COMPOSITION_V2_ENABLED!=='true')return c.json({code:'MEAL_COMPOSITION_DISABLED'},404);
  if(!c.env.DB)return c.json({code:'DATABASE_UNAVAILABLE'},503);
  const parsed=SharePlanShoppingSchema.safeParse(await c.req.json().catch(()=>null));
  const key=c.req.header('Idempotency-Key');
  if(!parsed.success||!key)return c.json({code:'VALIDATION_ERROR',error:'Thiếu khoảng ngày hoặc mã lệnh.'},422);
  try{
    const service=new MealPlanningApplicationService(c.env.DB,{compositionV2Enabled:true,
      familyPreferences:scope=>readFamilyPreferences(c.env.DB,scope),
      recipeAuthority:async scope=>(await resolveRecipeAuthority(c.env,{tenantKey:scope.householdId,backgroundExecutor:backgroundExecutorOf(c)})).snapshot});
    const scope={householdId:auth.householdId,userId:auth.userId};
    return c.json(await sharePlanShopping(c.env.DB,scope,parsed.data,key,()=>service.compositions().shoppingDemand(scope,parsed.data.planId,parsed.data.expectedRevision)));
  }catch(error){
    if(error instanceof MealPlanningError)return c.json({code:error.code,error:error.message},error.status);
    if(error instanceof GeneratedMealPlanPersistenceError)return c.json({code:error.code},error.code==='NOT_FOUND'?404:error.code==='FORBIDDEN'?403:409);
    return c.json({code:'SHOPPING_UPDATE_FAILED',error:'Chưa cập nhật được danh sách đi chợ từ thực đơn.'},503);
  }
});
