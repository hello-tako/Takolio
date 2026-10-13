import { z } from 'zod';
import { ShoppingContributionSchema, SharePlanShoppingSchema, SharePlanShoppingDtoSchema } from '../../../packages/domain/src/shopping-plan-api';
import { privateCacheKey, currentPrivateScope } from '../lib/private-session';
import { getPendingOps, type PendingOp } from '../lib/sync';
import {
  ApiError,
  fetchJson,
  isOffline,
  queueWrite,
  getHouseholdId,
  createClientItemId,
  guardPrivateSession,
} from './http';

const itemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().finite().positive(),
  unit: z.string(),
  isChecked: z.boolean(),
  sourceRecipeTitle: z.string().nullable().optional(),
  sourceRecipeId: z.string().nullable().optional(),
  ingredientId: z.string().nullable().optional(),
  cannotBuy: z.boolean().optional(),
  generated: z.boolean().optional(),
  quantityOverridden: z.boolean().optional(),
  contributions: z.array(ShoppingContributionSchema).optional(),
  createdAt: z.string().optional(),
  pendingSync: z.boolean().optional(),
});
export type ShoppingItem = z.infer<typeof itemSchema>;
export interface ShoppingInput {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  ingredientId?: string;
  sourceRecipeId?: string;
  sourceRecipeTitle?: string;
}
export interface ShoppingSnapshot {
  items: ShoppingItem[];
  source: 'server' | 'device';
  unresolvedItems?: Array<{ingredientId:string;name:string;unit:string;contributions:z.infer<typeof ShoppingContributionSchema>[]}>;
}
const itemsSchema = z.array(itemSchema);
const updateSchema=z.object({name:z.string().trim().min(1).max(100).optional(),quantity:z.number().finite().positive().optional(),unit:z.enum(['g','kg','ml','l','piece','pack','bunch','slice']).optional(),isChecked:z.boolean().optional(),cannotBuy:z.boolean().optional()}).refine(value=>Object.values(value).some(value=>value!==undefined))
  .refine(value=>!(value.isChecked===true&&value.cannotBuy===true))
  .transform(value=>({...value,...(value.isChecked===true?{cannotBuy:false}:{}),...(value.cannotBuy===true?{isChecked:false}:{})}));
const unresolvedItemsSchema=z.array(z.object({ingredientId:z.string(),name:z.string(),unit:z.string(),contributions:z.array(ShoppingContributionSchema)}));

function cachedItems(householdId: string): ShoppingItem[] {
  const saved = localStorage.getItem(privateCacheKey('shopping_list', householdId));
  return saved ? itemsSchema.parse(JSON.parse(saved)) : [];
}
function saveItems(items: ShoppingItem[], householdId: string) {
  localStorage.setItem(privateCacheKey('shopping_list', householdId), JSON.stringify(items));
}
function ownedOps() {
  const scope = currentPrivateScope();
  return getPendingOps().filter(
    (op) => op.userId === scope.userId && op.householdId === scope.householdId,
  );
}

/** Pending commands overlay reads until replay; a lost-response POST cannot add its ID twice. */
export function projectShoppingList(
  items: ShoppingItem[],
  operations: PendingOp[],
): ShoppingItem[] {
  let projected = items.map((item) => ({ ...item, pendingSync: false }));
  for (const op of operations) {
    if (op.path === '/shopping-list/items' && op.method === 'POST' && op.body) {
      const input: unknown = JSON.parse(op.body);
      const parsed = itemSchema.safeParse({
        ...(typeof input === 'object' && input !== null ? input : {}),
        isChecked: false,
        pendingSync: true,
      });
      if (!parsed.success) continue;
      const existing = projected.find((item) => item.id === parsed.data.id);
      projected = [
        { ...(existing ?? parsed.data), pendingSync: true },
        ...projected.filter((item) => item.id !== parsed.data.id),
      ];
    } else if (op.path.startsWith('/shopping-list/items/')) {
      const id = decodeURIComponent(op.path.slice('/shopping-list/items/'.length));
      if (op.method === 'DELETE') projected = projected.filter((item) => item.id !== id);
      else if (op.method === 'PATCH' && op.body) {
        const change = updateSchema.safeParse(JSON.parse(op.body));
        if (change.success)
          projected = projected.map((item) =>
            item.id === id ? { ...item, ...change.data, pendingSync: true } : item,
          );
      }
    }
  }
  return projected;
}
function hasPendingItem(id: string) {
  return ownedOps().some(
    (op) =>
      op.path === `/shopping-list/items/${encodeURIComponent(id)}` ||
      (op.path === '/shopping-list/items' &&
        op.method === 'POST' &&
        op.body &&
        z.object({ id: z.string() }).safeParse(JSON.parse(op.body)).data?.id === id),
  );
}

function enqueue(
  path: string,
  method: string,
  body: string | undefined,
  label: string,
  dedupeKey?: string,
) {
  queueWrite(path, method, body, label, dedupeKey);
  if (!ownedOps().some((op) => op.path === path && op.method === method && op.body === body)) {
    throw new Error(
      'Không thể lưu thay đổi để đồng bộ. Hãy kiểm tra bộ nhớ trình duyệt và thử lại.',
    );
  }
}

export const shoppingApi = {
  getShoppingListSnapshot: async (): Promise<ShoppingSnapshot> => {
    const assertCurrent = guardPrivateSession();
    const householdId = getHouseholdId();
    let source: ShoppingSnapshot['source'] = 'server';
    let items: ShoppingItem[];
    let unresolvedItems:z.infer<typeof unresolvedItemsSchema> = [];
    try {
      const res = await fetchJson<unknown>('/shopping-list');
      assertCurrent();
      const parsed=z.object({items:itemsSchema,unresolvedItems:unresolvedItemsSchema.default([])}).parse(res);
      items=parsed.items;unresolvedItems=parsed.unresolvedItems;
      localStorage.setItem(privateCacheKey('shopping_unresolved', householdId),JSON.stringify(unresolvedItems));
    } catch (error) {
      if (!isOffline(error)) throw error;
      assertCurrent();
      source = 'device';
      items = cachedItems(householdId);
      unresolvedItems=unresolvedItemsSchema.parse(JSON.parse(localStorage.getItem(privateCacheKey('shopping_unresolved',householdId)) ?? '[]'));
    }
    assertCurrent();
    items = projectShoppingList(items, ownedOps());
    saveItems(items, householdId);
    return { items, source, unresolvedItems };
  },
  getShoppingList: async (): Promise<ShoppingItem[]> =>
    (await shoppingApi.getShoppingListSnapshot()).items,

  addShoppingItem: async (item: ShoppingInput): Promise<ShoppingItem> => {
    const assertCurrent = guardPrivateSession();
    const householdId = getHouseholdId();
    const path = '/shopping-list/items';
    const requestItem = z
      .object({
        id: z.string().min(8).max(160),
        name: z.string().trim().min(1).max(100),
        quantity: z.number().finite().positive(),
        unit: z.string().trim().max(20),
        ingredientId: z.string().optional(),
        sourceRecipeId: z.string().optional(),
        sourceRecipeTitle: z.string().optional(),
      })
      .parse({ ...item, id: item.id || createClientItemId('shop') });
    const body = JSON.stringify(requestItem);
    let result: ShoppingItem;
    try {
      if (hasPendingItem(requestItem.id))
        throw new ApiError('offline', 'Thay đổi trước đang chờ đồng bộ.');
      const res = await fetchJson<unknown>(path, { method: 'POST', body });
      assertCurrent();
      result = z.object({ item: itemSchema }).parse(res).item;
      if (result.id !== requestItem.id) throw new Error('Shopping item identity mismatch');
    } catch (error) {
      assertCurrent();
      if (!isOffline(error)) throw error;
      enqueue(path, 'POST', body, `Thêm ${requestItem.name}`, `shopping:${requestItem.id}`);
      result = itemSchema.parse({ ...requestItem, isChecked: false, pendingSync: true });
    }
    assertCurrent();
    const prior = cachedItems(householdId);
    saveItems(
      projectShoppingList([result, ...prior.filter((entry) => entry.id !== result.id)], ownedOps()),
      householdId,
    );
    return result;
  },

  sharePlanShopping: async (input:z.input<typeof SharePlanShoppingSchema>,requestKey:string) => {
    const body=SharePlanShoppingSchema.parse(input);
    return SharePlanShoppingDtoSchema.parse(await fetchJson('/shopping-list/from-plan',{method:'POST',headers:{'Idempotency-Key':requestKey},body:JSON.stringify(body)}));
  },
  updateShoppingItem: async (id:string,patch:z.input<typeof updateSchema>):Promise<{pendingSync:boolean}> => {
    const assertCurrent=guardPrivateSession();const householdId=getHouseholdId();
    const change=updateSchema.parse(patch);const path=`/shopping-list/items/${encodeURIComponent(id)}`;
    const body=JSON.stringify(change);let pendingSync=false;
    try {
      if(hasPendingItem(id)) throw new ApiError('offline','Thay đổi trước đang chờ đồng bộ.');
      await fetchJson(path,{method:'PATCH',body});
    }catch(error){
      assertCurrent();if(!isOffline(error))throw error;
      enqueue(path,'PATCH',body,'Cập nhật danh sách đi chợ');pendingSync=true;
    }
    assertCurrent();
    saveItems(projectShoppingList(cachedItems(householdId).map(item=>item.id===id?{...item,...change}:item),ownedOps()),householdId);
    return {pendingSync};
  },
  toggleShoppingItem: async (id:string,isChecked:boolean):Promise<{pendingSync:boolean}> => shoppingApi.updateShoppingItem(id,{isChecked}),

  deleteShoppingItem: async (id: string): Promise<{ pendingSync: boolean }> => {
    const assertCurrent = guardPrivateSession();
    const householdId = getHouseholdId();
    const path = `/shopping-list/items/${encodeURIComponent(id)}`;
    let pendingSync = false;
    try {
      if (hasPendingItem(id)) throw new ApiError('offline', 'Thay đổi trước đang chờ đồng bộ.');
      await fetchJson(path, { method: 'DELETE' });
    } catch (error) {
      assertCurrent();
      if (!isOffline(error)) throw error;
      enqueue(path, 'DELETE', undefined, 'Xóa khỏi danh sách đi chợ');
      pendingSync = true;
    }
    assertCurrent();
    saveItems(
      projectShoppingList(
        cachedItems(householdId).filter((item) => item.id !== id),
        ownedOps(),
      ),
      householdId,
    );
    return { pendingSync };
  },
};
