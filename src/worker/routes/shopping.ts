import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { Env, AuthContext } from '../types';
import type { D1DatabaseBinding } from '@frigo/db';
import { SharePlanShoppingSchema, ShoppingContributionSchema, ReviewShoppingDemandSchema, type ShoppingContribution } from '../../../packages/domain/src/shopping-plan-api';
import { sharePlanShopping } from '../services/shopping-plan';
import { supportsRecipeContent } from '../services/meal-composition-response';
import { projectUnknownShoppingDemand, reviewShoppingDemand, unknownShoppingDemandStatement, type ShoppingDemandReviewRow } from '../services/shopping-demand-review';
import { MealPlanningApplicationService } from '../services/meal-planning';
import { MealPlanningError } from '../services/meal-planning-error';
import { GeneratedMealPlanPersistenceError } from '../../../packages/db/src/meal-planning';
import { readFamilyPreferences } from '../../../packages/db/src/family-preferences';
import { backgroundExecutorOf, resolveRecipeAuthority } from '../services/recipe-authority';
import { tenancyGuard } from '../middleware/tenancy';
import { rateLimiter } from '../middleware/rate-limit';
import { ShoppingImportPurchasedSchema, ShoppingItemCreateSchema, ShoppingItemUpdateSchema } from '../validation/schemas';
import { SQL } from '@frigo/db';
import { computeFreshness, findCanonicalIngredient, type StandardUnit } from '@frigo/domain';
import { InventoryWriterAuthorityError, readInventoryAuthorityMode, runLegacyInventoryBatch } from '../../../packages/db/src/inventory-writer-fence';
import { composeInventoryLotCommands, readAdoptedLotSnapshot, type LotCommandSpec } from '../../../packages/db/src/inventory-lot-commands';
import { LotCommandError } from '../../../packages/domain/src/inventory-lot-commands';
import { inventoryAuthorityFailure } from '../utils/inventory-authority';
import { lotExpiryFromEvidence } from '../utils/scan-evidence';
import { fetchHouseholdInventoryFromDb } from './inventory';

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
    const versioned = supportsRecipeContent(c.req.header('Accept'));
    const contributionDto = (entries: ShoppingContribution[]) => versioned ? entries
      : entries.map(({ contentFingerprint: _pin, ...entry }) => entry);
    const sources=new Map<string,ShoppingContribution[]>();
    for(const demand of demands.results as Array<{demand_key:string;contributions_json:string}>){
      const contributions=z.array(ShoppingContributionSchema).parse(JSON.parse(demand.contributions_json));
      sources.set(demand.demand_key,[...(sources.get(demand.demand_key) ?? []),...contributions]);
    }
    const unresolvedItems=await Promise.all((unknown.results as ShoppingDemandReviewRow[]).map(projectUnknownShoppingDemand));
    const reviewedItems=new Map(unresolvedItems.filter(row=>row.purchaseItemId!==null).map(row=>[row.purchaseItemId,row.reviewState]));
    return c.json({items:(res.results as ItemRow[]).map(row=>({...dto(row,contributionDto(row.demand_key ? sources.get(row.demand_key) ?? [] : [])),
      ...(reviewedItems.has(row.id)?{reviewState:reviewedItems.get(row.id)}:{})})),unresolvedItems:unresolvedItems.map(row=>({...row,contributions:contributionDto(row.contributions)}))});
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

const STANDARD_SHOPPING_UNITS = new Set<StandardUnit>(['g', 'kg', 'ml', 'l', 'piece', 'pack', 'bunch', 'slice']);

function normalizeShoppingUnit(rawUnit: string, fallbackUnit?: StandardUnit): StandardUnit {
  const cleaned = rawUnit.trim().toLowerCase();
  if (STANDARD_SHOPPING_UNITS.has(cleaned as StandardUnit)) return cleaned as StandardUnit;
  if (['quả', 'trái', 'củ', 'con', 'cái', 'miếng nhỏ'].includes(cleaned)) return 'piece';
  if (['bó', 'mớ', 'nhánh'].includes(cleaned)) return 'bunch';
  if (['gói', 'hộp', 'vỉ', 'chai', 'lon', 'túi'].includes(cleaned)) return 'pack';
  if (['lát', 'miếng', 'khúc'].includes(cleaned)) return 'slice';
  if (cleaned === 'gram' || cleaned === 'gr') return 'g';
  if (cleaned === 'lít' || cleaned === 'lit') return 'l';
  return fallbackUnit ?? 'piece';
}

function inferStorageAndShelfLife(category: string, defaultShelfLifeDays?: number): {
  storage: 'fridge' | 'freezer' | 'pantry';
  shelfLifeDays: number;
} {
  const cat = category.toLowerCase();
  if (['spice', 'grain', 'condiment', 'dry', 'oil', 'noodle'].includes(cat)) {
    return { storage: 'pantry', shelfLifeDays: defaultShelfLifeDays ?? 90 };
  }
  if (cat === 'frozen') {
    return { storage: 'freezer', shelfLifeDays: defaultShelfLifeDays ?? 60 };
  }
  if (['meat', 'seafood', 'fish'].includes(cat)) {
    return { storage: 'fridge', shelfLifeDays: defaultShelfLifeDays ?? 3 };
  }
  if (['vegetable', 'herb', 'fruit'].includes(cat)) {
    return { storage: 'fridge', shelfLifeDays: defaultShelfLifeDays ?? 5 };
  }
  if (['egg', 'dairy'].includes(cat)) {
    return { storage: 'fridge', shelfLifeDays: defaultShelfLifeDays ?? 14 };
  }
  return { storage: 'fridge', shelfLifeDays: defaultShelfLifeDays ?? 7 };
}

async function deterministicImportId(householdId: string, shoppingItemId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${householdId}:${shoppingItemId}`)
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `shop_imp_${hex.slice(0, 32)}`;
}

// POST /api/v1/shopping-list/import-purchased
// Atomically imports checked (or explicitly selected) shopping items into the
// household's fridge inventory and clears the imported rows from shopping_items.
shoppingRoutes.post('/shopping-list/import-purchased', async (c) => {
  if (!c.env.DB) return c.json({ code: 'DATABASE_UNAVAILABLE', error: 'Database service unavailable' }, 503);
  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = ShoppingImportPurchasedSchema.safeParse(rawBody ?? {});
  if (!parsed.success) {
    return c.json({ code: 'VALIDATION_ERROR', error: 'Danh sách mặt hàng nhập vào tủ không hợp lệ.' }, 400);
  }

  const auth = c.get('auth');
  const db = c.env.DB;
  const kv = c.env.CACHE;
  const selectedIds = parsed.data.itemIds ? Array.from(new Set(parsed.data.itemIds)) : null;

  try {
    const listId = await getOrCreateShoppingList(db, auth.householdId);
    let targetRows: ItemRow[];
    if (selectedIds && selectedIds.length > 0) {
      const placeholders = selectedIds.map(() => '?').join(',');
      const res = await db
        .prepare(`${SELECT_ITEMS} WHERE si.list_id = ? AND sl.household_id = ? AND si.id IN (${placeholders})`)
        .bind(listId, auth.householdId, ...selectedIds)
        .all<ItemRow>();
      targetRows = (res.results ?? []) as ItemRow[];
    } else {
      const res = await db
        .prepare(`${SELECT_ITEMS} WHERE si.list_id = ? AND sl.household_id = ? AND si.is_checked = 1`)
        .bind(listId, auth.householdId)
        .all<ItemRow>();
      targetRows = (res.results ?? []) as ItemRow[];
    }

    if (targetRows.length === 0) {
      const inventory = await fetchHouseholdInventoryFromDb(db, auth.householdId, kv, {
        strict: true,
        actorId: auth.userId,
      });
      return c.json({
        success: true,
        importedCount: 0,
        importedItemIds: [],
        inventory,
      });
    }

    // Verify candidate canonical ingredient IDs exist in D1 `ingredients` table before FK insert.
    const candidateIds = Array.from(
      new Set(
        targetRows
          .map((row) => findCanonicalIngredient(row.name)?.id ?? row.ingredient_identity ?? row.ingredient_id)
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
      )
    );
    const validIngredientIds = new Set<string>();
    if (candidateIds.length > 0) {
      const placeholders = candidateIds.map(() => '?').join(',');
      const found = await db
        .prepare(`SELECT id FROM ingredients WHERE id IN (${placeholders})`)
        .bind(...candidateIds)
        .all<{ id: string }>();
      for (const row of found.results ?? []) {
        validIngredientIds.add(row.id);
      }
    }

    const nowIso = new Date().toISOString();
    const native = (await readInventoryAuthorityMode(db, auth.householdId)) === 'native';
    const importedItemIds: string[] = [];

    const deleteStatements: any[] = [];
    for (const row of targetRows) {
      deleteStatements.push(
        db
          .prepare(
            `UPDATE shopping_demand_reviews
                SET revision = revision + 1, decision = 'purchased', item_id = NULL, actor_user_id = ?, updated_at = ?
              WHERE item_id = ?
                AND source_id IN (SELECT source.id FROM shopping_plan_sources source
                  JOIN shopping_lists list ON list.id = source.list_id WHERE list.household_id = ?)
                AND EXISTS (SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?)`
          )
          .bind(auth.userId, nowIso, row.id, auth.householdId, auth.householdId, auth.userId),
        db
          .prepare(
            `INSERT INTO shopping_plan_item_dismissals(list_id, demand_key, plan_id)
             SELECT state.list_id, state.demand_key, source.plan_id
               FROM shopping_generated_item_state state
               JOIN shopping_lists list ON list.id = state.list_id
               JOIN shopping_plan_sources source ON source.list_id = state.list_id
               JOIN shopping_plan_demands demand ON demand.source_id = source.id AND demand.demand_key = state.demand_key
              WHERE state.item_id = ? AND list.household_id = ? AND demand.quantity IS NOT NULL
                AND EXISTS (SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?)
             ON CONFLICT(list_id, demand_key) DO UPDATE SET plan_id = excluded.plan_id`
          )
          .bind(row.id, auth.householdId, auth.householdId, auth.userId),
        db
          .prepare(
            `DELETE FROM shopping_items
              WHERE id = ?
                AND list_id IN (SELECT id FROM shopping_lists WHERE household_id = ?)
                AND EXISTS (SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?)`
          )
          .bind(row.id, auth.householdId, auth.householdId, auth.userId)
      );
    }

    if (native) {
      const scope = { householdId: auth.householdId, actorId: auth.userId };
      const snapshot = await readAdoptedLotSnapshot(db, scope);
      const specs: LotCommandSpec[] = [];

      for (const row of targetRows) {
        const canonical = findCanonicalIngredient(row.name);
        const candidateId = canonical?.id ?? row.ingredient_identity ?? row.ingredient_id ?? null;
        const ingredientId = candidateId && validIngredientIds.has(candidateId) ? candidateId : null;
        const category = canonical?.category ?? 'other';
        const unit = normalizeShoppingUnit(row.unit, canonical?.defaultUnit);
        const { storage, shelfLifeDays } = inferStorageAndShelfLife(category, canonical?.defaultShelfLifeDays);
        const estimatedDate = new Date(Date.now() + shelfLifeDays * 86_400_000).toISOString().slice(0, 10);
        const expiry = lotExpiryFromEvidence(estimatedDate, 'inferred');
        const targetType = storage.toUpperCase();
        const location =
          snapshot.locations.find((loc) => loc.isDefault && loc.type === targetType) ??
          snapshot.locations.find((loc) => loc.type === targetType) ??
          snapshot.locations[0];
        if (!location) throw new LotCommandError('DRIFT_DETECTED');

        const lotId = await deterministicImportId(auth.householdId, row.id);
        importedItemIds.push(lotId);
        specs.push({
          clientKey: `shopping-import:${row.id}`,
          input: {
            type: 'CREATE',
            lotId,
            ingredientId,
            rawName: row.name.trim(),
            displayCategory: category,
            quantity: Math.max(0.001, Number(row.quantity) || 1),
            unit,
            storageLocationId: location.id,
            expiryAt: expiry.expiryAt,
            estimatedExpiryAt: expiry.estimatedExpiryAt,
            expiryKind: expiry.expiryKind,
            purchasedAt: nowIso.slice(0, 10),
            openedAt: null,
            purchasePrice: null,
            sourceType: 'SHOPPING',
            sourceId: row.id,
          },
        });
      }

      const composed = await composeInventoryLotCommands(db, scope, specs, nowIso);
      const batchResults = await db.batch([...composed.statements, ...deleteStatements]);
      if (batchResults.some((r) => !r.success)) throw new Error('Shopping import batch failed');
    } else {
      const legacyStatements: any[] = [];
      for (const row of targetRows) {
        const canonical = findCanonicalIngredient(row.name);
        const candidateId = canonical?.id ?? row.ingredient_identity ?? row.ingredient_id ?? null;
        const ingredientId = candidateId && validIngredientIds.has(candidateId) ? candidateId : null;
        const category = canonical?.category ?? 'other';
        const unit = normalizeShoppingUnit(row.unit, canonical?.defaultUnit);
        const { storage, shelfLifeDays } = inferStorageAndShelfLife(category, canonical?.defaultShelfLifeDays);
        const estimatedDate = new Date(Date.now() + shelfLifeDays * 86_400_000).toISOString().slice(0, 10);
        const freshness = computeFreshness(estimatedDate, undefined, shelfLifeDays);
        const itemId = await deterministicImportId(auth.householdId, row.id);
        const qty = Math.max(0.001, Number(row.quantity) || 1);
        importedItemIds.push(itemId);

        legacyStatements.push(
          db.prepare(SQL.INSERT_INVENTORY_ITEM.replace(/^INSERT /, 'INSERT OR IGNORE ')).bind(
            itemId,
            auth.householdId,
            ingredientId,
            row.name.trim(),
            qty,
            unit,
            category,
            storage,
            estimatedDate,
            nowIso,
            freshness,
            'shopping'
          ),
          db.prepare(SQL.INSERT_INVENTORY_EVENT.replace(/^INSERT /, 'INSERT OR IGNORE ')).bind(
            `evt_shop_${itemId}`,
            auth.householdId,
            itemId,
            'SHOPPING_IMPORT',
            qty,
            unit,
            'Nhập tự động từ danh sách đi chợ',
            JSON.stringify({ shoppingItemId: row.id })
          )
        );
      }

      const batchResults = await runLegacyInventoryBatch(db, auth.householdId, [
        ...legacyStatements,
        ...deleteStatements,
      ]);
      if (batchResults.some((r) => !r.success)) throw new Error('Legacy shopping import batch failed');
    }

    if (kv) await kv.delete(`inv_${auth.householdId}`).catch(() => {});
    const inventory = await fetchHouseholdInventoryFromDb(db, auth.householdId, kv, {
      strict: true,
      actorId: auth.userId,
    });

    return c.json({
      success: true,
      importedCount: targetRows.length,
      importedItemIds,
      inventory,
    });
  } catch (error) {
    if (error instanceof LotCommandError) {
      const failure = inventoryAuthorityFailure(error);
      return c.json({ code: failure.code, error: error.message }, failure.status);
    }
    if (error instanceof InventoryWriterAuthorityError) {
      return c.json({ code: error.code, error: error.message }, 409);
    }
    console.error('D1 shopping import-purchased failed:');
    return c.json({ code: 'DATABASE_ERROR', error: 'Chưa chuyển được đồ đã mua vào tủ lạnh.' }, 500);
  }
});
