import type { D1DatabaseBinding, D1PreparedStatement } from '../../../packages/db/src/index';
import { isStandardUnit } from '../../../packages/domain/src/units';
import { convertQuantity, Quantity, QuantityRangeError } from '../../../packages/domain/src/quantity';
import { canonicalJson } from '../../../packages/recipes/src/planner-context';
import { SharePlanShoppingSchema, type ShoppingContribution } from '../../../packages/domain/src/shopping-plan-api';
import { findCanonicalIngredient } from '../../../packages/domain/src/index';
import { sha256Hex } from '../utils/session';
import { MealPlanningError } from './meal-planning-error';

export interface ShoppingDemandRow {
  ingredientId: string; name: string; quantity: number | null; unit: string;
  slotId: string; date: string; mealType: string; componentId: string;
  recipeId: string | null; title: string; optional: boolean; contentFingerprint?: string | null;
}
export interface ShoppingDemandSnapshot {
  planRevision: number; rows: ShoppingDemandRow[];
  transactionFences?: readonly D1PreparedStatement[];
  inventoryWitness?: readonly {id:string; version:number;quantity:number;unit:string}[];
  preferenceWitness?: {memberJson:string|null; householdJson:string|null; profileRevision:number};
}
interface Demand { key:string; ingredientId:string; name:string; quantity:Quantity|null; unit:string; contributions:ShoppingContribution[] }

/** Reconciles the shared purchase list from server shortages without touching physical stock. */
export async function sharePlanShopping(db:D1DatabaseBinding, scope:{householdId:string;userId:string},
  rawInput:unknown, requestKey:string, loadDemand:()=>Promise<ShoppingDemandSnapshot>) {
  const input = SharePlanShoppingSchema.parse(rawInput);
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestKey)) throw new MealPlanningError('INVALID_REQUEST_KEY',422,'A valid command key is required');
  const owned=await db.prepare(`SELECT g.id FROM generated_meal_plans g JOIN household_members hm ON hm.household_id=g.household_id AND hm.user_id=g.creator_user_id WHERE g.id=? AND g.household_id=? AND g.creator_user_id=?`).bind(input.planId,scope.householdId,scope.userId).first<{id:string}>();
  if(!owned) throw new MealPlanningError('PLAN_NOT_FOUND',404,'Không tìm thấy thực đơn của bạn.');
  const existingList=await db.prepare('SELECT id FROM shopping_lists WHERE household_id=? LIMIT 1').bind(scope.householdId).first<{id:string}>();
  const listId = existingList?.id ?? `list_${scope.householdId}`;
  const sourceId = `ps_${(await sha256Hex(`${listId}:${input.planId}`)).slice(0,48)}`;
  const fingerprint = await sha256Hex(canonicalJson(input));
  const previous = await db.prepare(`SELECT request_fingerprint,source_id,response_json FROM shopping_plan_commands WHERE list_id = ? AND request_key = ?`)
    .bind(listId,requestKey).first<{request_fingerprint:string;source_id:string;response_json:string}>();
  if (previous) {
    if (previous.request_fingerprint !== fingerprint) throw new MealPlanningError('IDEMPOTENCY_CONFLICT',409,'Command key has another request');
    return {...JSON.parse(previous.response_json),idempotentReplay:true};
  }
  const snapshot = await loadDemand();
  if (snapshot.planRevision !== input.expectedRevision) throw new MealPlanningError('REVISION_CONFLICT',409,'Plan changed');
  const demands = new Map<string,Demand>();
  for (const row of snapshot.rows) {
    if (row.optional || row.date < input.startDate || row.date > input.endDate || row.quantity === 0) continue;
    if (!isStandardUnit(row.unit)) throw new MealPlanningError('UNKNOWN_UNIT',422,'Unrecognized shopping unit');
    const normalizedUnit = row.unit === 'kg' ? 'g' : row.unit === 'l' ? 'ml' : row.unit;
    const normalizedQuantity = row.quantity === null ? null : convertQuantity(Quantity.from(row.quantity),row.unit,normalizedUnit);
    const key = `${row.ingredientId}:${normalizedUnit}`;
    let demand = demands.get(key);
    if (!demand) {
      demand={key,ingredientId:row.ingredientId,name:findCanonicalIngredient(row.ingredientId)?.nameVi ?? row.name,
        quantity:row.quantity === null ? null : Quantity.from(0),unit:normalizedUnit,contributions:[]}; demands.set(key,demand);
    }
    if (row.quantity === null) demand.quantity=null;
    else if (demand.quantity !== null) demand.quantity=demand.quantity.add(normalizedQuantity!);
    demand.contributions.push({planId:input.planId,slotId:row.slotId,componentId:row.componentId,date:row.date,
      mealType:row.mealType,recipeId:row.recipeId,title:row.title,quantity:row.quantity,unit:row.unit,
      contentFingerprint:row.contentFingerprint ?? null});
  }
  if (demands.size > 128) throw new MealPlanningError('SHOPPING_DEMAND_LIMIT',422,'Reduce the shopping horizon');
  for(const demand of demands.values()) {
    if(demand.quantity===null)continue;
    try {
      if(Quantity.from(demand.quantity.toNumber()).compare(demand.quantity)!==0)demand.quantity=null;
    }catch(error){
      if(!(error instanceof QuantityRangeError))throw error;
      demand.quantity=null;
    }
  }
  const response={success:true as const,planId:input.planId,planRevision:input.expectedRevision,sourceId,itemCount:demands.size,
    unresolvedCount:[...demands.values()].filter(demand=>demand.quantity===null).length,idempotentReplay:false};
  const now=new Date().toISOString();
  const statements:D1PreparedStatement[]=[...(snapshot.transactionFences ?? [])];
  const inventory = snapshot.inventoryWitness;
  const inventoryFence = inventory ? ` AND (SELECT COUNT(*) FROM inventory_items WHERE household_id = ?) = ?
    AND NOT EXISTS(SELECT 1 FROM json_each(?) witness WHERE NOT EXISTS(
      SELECT 1 FROM inventory_items lot WHERE lot.id = json_extract(witness.value,'$.id') AND lot.household_id = ?
      AND lot.version = json_extract(witness.value,'$.version') AND lot.quantity = json_extract(witness.value,'$.quantity')
      AND lot.unit = json_extract(witness.value,'$.unit')))` : '';
  const inventoryBindings = inventory ? [scope.householdId,inventory.length,JSON.stringify(inventory),scope.householdId] : [];
  const preferences = snapshot.preferenceWitness;
  const preferenceFence = preferences ? ` AND (SELECT values_json FROM member_ranking_preferences WHERE household_id = ? AND user_id = ?) IS ?
    AND (SELECT values_json FROM household_ranking_preferences WHERE household_id = ?) IS ?
    AND COALESCE((SELECT revision FROM family_meal_preferences WHERE household_id = ? AND user_id = ?),0) = ?` : '';
  const preferenceBindings = preferences ? [scope.householdId,scope.userId,preferences.memberJson,scope.householdId,preferences.householdJson,scope.householdId,scope.userId,preferences.profileRevision] : [];
  statements.push(db.prepare(`INSERT OR IGNORE INTO shopping_lists(id,household_id,name) SELECT ?,?,'Đi chợ cho gia đình'
    WHERE EXISTS(SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?)`).bind(listId,scope.householdId,scope.householdId,scope.userId));
  statements.push(db.prepare(`INSERT INTO shopping_plan_sources(id,list_id,plan_id,creator_user_id,plan_revision,start_date,end_date,updated_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET plan_revision=excluded.plan_revision,start_date=excluded.start_date,end_date=excluded.end_date,updated_at=excluded.updated_at`)
    .bind(sourceId,listId,input.planId,scope.userId,input.expectedRevision,input.startDate,input.endDate,now));
  // A NOT NULL guard rolls back the entire D1 batch if any trusted witness has changed.
  statements.push(db.prepare(`INSERT INTO shopping_plan_commands(list_id,request_key,request_fingerprint,source_id,response_json,created_at)
    SELECT CASE WHEN EXISTS(SELECT 1 FROM generated_meal_plans g JOIN household_members hm
      ON hm.household_id = g.household_id AND hm.user_id = g.creator_user_id
      WHERE g.id = ? AND g.household_id = ? AND g.creator_user_id = ? AND g.revision = ?${inventoryFence}${preferenceFence})
      AND NOT EXISTS(SELECT 1 FROM shopping_plan_sources other WHERE other.list_id = ? AND other.plan_id <> ? AND other.creator_user_id <> ? AND EXISTS(SELECT 1 FROM shopping_plan_demands d WHERE d.source_id = other.id)) THEN ? ELSE NULL END,?,?,?,?,?`)
    .bind(input.planId,scope.householdId,scope.userId,input.expectedRevision,...inventoryBindings,...preferenceBindings,listId,input.planId,scope.userId,listId,requestKey,fingerprint,sourceId,JSON.stringify(response),now));
  statements.push(db.prepare('DELETE FROM shopping_plan_demands WHERE source_id = ? OR source_id IN(SELECT id FROM shopping_plan_sources WHERE list_id=? AND creator_user_id=? AND plan_id<>?)').bind(sourceId,listId,scope.userId,input.planId));
  for (const demand of demands.values()) statements.push(db.prepare(`INSERT INTO shopping_plan_demands(source_id,demand_key,ingredient_id,name,quantity,unit,contributions_json) VALUES(?,?,?,?,?,?,?)`)
    .bind(sourceId,demand.key,demand.ingredientId,demand.name,demand.quantity?.toNumber() ?? null,demand.unit,JSON.stringify(demand.contributions)));
  // Add exact known demands; unknown quantities stay separate instead of becoming a fabricated one.
  const allDemands = await db.prepare(`SELECT DISTINCT d.demand_key FROM shopping_plan_demands d JOIN shopping_plan_sources s ON s.id = d.source_id WHERE s.list_id = ?`).bind(listId).all<{demand_key:string}>();
  const keys = new Set([...allDemands.results.map(row=>row.demand_key),...demands.keys()]);
  for (const key of keys) {
    const itemId=`plan_shop_${(await sha256Hex(`${listId}:${key}`)).slice(0,48)}`;
    statements.push(db.prepare(`INSERT OR IGNORE INTO shopping_items(id,list_id,ingredient_id,name,quantity,unit,is_checked,source_recipe_id)
      SELECT ?,?,MIN(ingredient.id),MIN(d.name),SUM(d.quantity),MIN(d.unit),0,NULL FROM shopping_plan_demands d LEFT JOIN ingredients ingredient ON ingredient.id=d.ingredient_id
      JOIN shopping_plan_sources s ON s.id = d.source_id WHERE s.list_id = ? AND d.demand_key = ?
      AND NOT EXISTS(SELECT 1 FROM shopping_plan_item_dismissals dismissed WHERE dismissed.list_id=s.list_id AND dismissed.demand_key=d.demand_key AND dismissed.plan_id=s.plan_id)
      HAVING COUNT(*) > 0 AND COUNT(d.quantity) = COUNT(*) AND SUM(d.quantity) > 0`).bind(itemId,listId,listId,key));
    statements.push(db.prepare(`INSERT OR IGNORE INTO shopping_generated_item_state(item_id,list_id,demand_key,is_overridden)
      SELECT id,list_id,?,0 FROM shopping_items WHERE id = ? AND list_id = ?`).bind(key,itemId,listId));
    statements.push(db.prepare(`UPDATE shopping_items SET quantity=(SELECT SUM(d.quantity) FROM shopping_plan_demands d JOIN shopping_plan_sources s ON s.id=d.source_id WHERE s.list_id=? AND d.demand_key=?), updated_at=?
      WHERE id=? AND list_id=? AND EXISTS(SELECT 1 FROM shopping_generated_item_state state WHERE state.item_id=shopping_items.id AND state.is_overridden=0)
      AND EXISTS(SELECT 1 FROM shopping_plan_demands d JOIN shopping_plan_sources s ON s.id=d.source_id WHERE s.list_id=? AND d.demand_key=?)
      AND NOT EXISTS(SELECT 1 FROM shopping_plan_demands d JOIN shopping_plan_sources s ON s.id=d.source_id WHERE s.list_id=? AND d.demand_key=? AND d.quantity IS NULL)`)
      .bind(listId,key,now,itemId,listId,listId,key,listId,key));
    statements.push(db.prepare(`DELETE FROM shopping_items WHERE id=? AND list_id=? AND is_checked=0
      AND EXISTS(SELECT 1 FROM shopping_generated_item_state state WHERE state.item_id=shopping_items.id AND state.is_overridden=0)
      AND (NOT EXISTS(SELECT 1 FROM shopping_plan_demands d JOIN shopping_plan_sources s ON s.id=d.source_id WHERE s.list_id=? AND d.demand_key=?)
        OR EXISTS(SELECT 1 FROM shopping_plan_demands d JOIN shopping_plan_sources s ON s.id=d.source_id WHERE s.list_id=? AND d.demand_key=? AND d.quantity IS NULL))`)
      .bind(itemId,listId,listId,key,listId,key));
  }
  // Cleanup reads committed demand inside the transaction, including keys introduced by a concurrent command.
  statements.push(db.prepare(`DELETE FROM shopping_items WHERE list_id=? AND is_checked=0
    AND EXISTS(SELECT 1 FROM shopping_generated_item_state state WHERE state.item_id=shopping_items.id
      AND state.list_id=shopping_items.list_id AND state.is_overridden=0
      AND (NOT EXISTS(SELECT 1 FROM shopping_plan_demands demand JOIN shopping_plan_sources source ON source.id=demand.source_id
        WHERE source.list_id=state.list_id AND demand.demand_key=state.demand_key)
        OR EXISTS(SELECT 1 FROM shopping_plan_demands demand JOIN shopping_plan_sources source ON source.id=demand.source_id
          WHERE source.list_id=state.list_id AND demand.demand_key=state.demand_key AND demand.quantity IS NULL)))`).bind(listId));
  try { const results=await db.batch(statements); if(results.some(result=>!result.success)) throw new Error('Shopping batch failed'); }
  catch(error) {
    const replay=await db.prepare('SELECT request_fingerprint,response_json FROM shopping_plan_commands WHERE list_id=? AND request_key=?').bind(listId,requestKey).first<{request_fingerprint:string;response_json:string}>();
    if(replay?.request_fingerprint === fingerprint) return {...JSON.parse(replay.response_json),idempotentReplay:true};
    if(replay) throw new MealPlanningError('IDEMPOTENCY_CONFLICT',409,'Mã cập nhật đã được dùng cho một yêu cầu khác.');
    const otherPlan=await db.prepare(`SELECT s.plan_id FROM shopping_plan_sources s WHERE s.list_id=? AND s.plan_id<>? AND s.creator_user_id<>?
      AND EXISTS(SELECT 1 FROM shopping_plan_demands d WHERE d.source_id=s.id) LIMIT 1`).bind(listId,input.planId,scope.userId).first<{plan_id:string}>();
    if(otherPlan)throw new MealPlanningError('SHOPPING_PLAN_CONFLICT',409,'Danh sách đang dùng thực đơn của thành viên khác. Hãy thống nhất thực đơn trước khi cập nhật.');
    const current=await db.prepare(`SELECT g.revision FROM generated_meal_plans g JOIN household_members member ON member.household_id=g.household_id AND member.user_id=g.creator_user_id
      WHERE g.id=? AND g.household_id=? AND g.creator_user_id=?`).bind(input.planId,scope.householdId,scope.userId).first<{revision:number}>();
    if(!current)throw new MealPlanningError('PLAN_NOT_FOUND',404,'Không tìm thấy thực đơn của bạn.');
    const guardChanged=error instanceof Error && (error.message.includes('NOT NULL constraint failed: shopping_plan_commands')
      || error.message.includes('NOT NULL constraint failed: generated_meal_plan_compositions'));
    if(guardChanged||current.revision!==input.expectedRevision)throw new MealPlanningError('SHOPPING_SNAPSHOT_CHANGED',409,'Thực đơn, tồn kho hoặc sở thích đã thay đổi. Hãy tính lại trước khi cập nhật.');
    throw new MealPlanningError('SHOPPING_UPDATE_FAILED',503,'Chưa cập nhật được danh sách đi chợ. Vui lòng thử lại.');
  }
  return response;
}
