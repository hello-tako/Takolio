// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { shoppingApi } from '../../src/web/services/shopping';
import { resetPrivateSession, privateCacheKey } from '../../src/web/lib/private-session';
import { getPendingOps, pushOp } from '../../src/web/lib/sync';

const fetchMock = vi.fn();
const binding = { sourceId: 'source-a', demandKey: 'GARLIC:piece', snapshot: 'a'.repeat(64), reviewRevision: 0 };
const input = { ...binding, action: 'purchase' as const, quantity: 0.5, unit: 'pack' as const };
const receipt = { success: true, sourceId: binding.sourceId, demandKey: binding.demandKey,
  reviewRevision: 1, reviewState: 'purchased', purchaseItemId: 'generated-purchase', idempotentReplay: false };
const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); resetPrivateSession();
  localStorage.setItem('frigo_user_id', 'user-a'); localStorage.setItem('frigo_household_id', 'house-a');
  fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('sends a selected package amount without converting recipe demand or writing the item outbox', async () => {
  fetchMock.mockResolvedValue(respond(receipt));
  expect(await shoppingApi.reviewShoppingDemand(input, 'review-command-1')).toEqual(receipt);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/v1/shopping-list/demand-review');
  expect(JSON.parse(options.body)).toEqual(input);
  expect(options.headers['Idempotency-Key']).toBe('review-command-1');
  expect(options.headers['X-Frigo-Expected-User-Id']).toBe('user-a');
  expect(getPendingOps()).toEqual([]);
  expect(localStorage.getItem(privateCacheKey('shopping_list', 'house-a'))).toBeNull();
});

it('keeps uncertain delivery unconfirmed and permits exact same-key replay without a local resolved projection', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Response lost')).mockResolvedValueOnce(respond({ ...receipt, idempotentReplay: true }));
  await expect(shoppingApi.reviewShoppingDemand(input, 'uncertain-review')).rejects.toMatchObject({ kind: 'offline' });
  expect(getPendingOps()).toEqual([]);
  expect((await shoppingApi.reviewShoppingDemand(input, 'uncertain-review')).idempotentReplay).toBe(true);
  expect(fetchMock.mock.calls.map(call => call[1].headers['Idempotency-Key'])).toEqual(['uncertain-review', 'uncertain-review']);
  expect(fetchMock.mock.calls.map(call => JSON.parse(call[1].body))).toEqual([input, input]);
});

it('rejects invalid input and declared offline state without an HTTP request or queued command', async () => {
  for (const quantity of [0, -1, Number.POSITIVE_INFINITY, 100_001]) {
    await expect(shoppingApi.reviewShoppingDemand({ ...input, quantity }, 'invalid-review')).rejects.toThrow();
  }
  await expect(shoppingApi.reviewShoppingDemand(input, 'bad')).rejects.toThrow();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await expect(shoppingApi.reviewShoppingDemand(input, 'offline-review')).rejects.toMatchObject({ kind: 'offline' });
  expect(fetchMock).not.toHaveBeenCalled(); expect(getPendingOps()).toEqual([]);
});

it('blocks review behind an earlier queued purchase deletion so later replay cannot silently undo it', async () => {
  pushOp({ path: '/shopping-list/items/generated-purchase', method: 'DELETE', label: 'Delete',
    userId: 'user-a', householdId: 'house-a' });
  await expect(shoppingApi.reviewShoppingDemand(input, 'queued-edit-review')).rejects.toMatchObject({ code: 'SHOPPING_PENDING_SYNC' });
  expect(fetchMock).not.toHaveBeenCalled(); expect(getPendingOps()).toHaveLength(1);
  fetchMock.mockResolvedValue(respond({ items: [], unresolvedItems: [] }));
  expect((await shoppingApi.getShoppingListSnapshot()).hasPendingChanges).toBe(true);
});

it('rejects a mismatched successful receipt and a result arriving after session change', async () => {
  fetchMock.mockResolvedValueOnce(respond({ ...receipt, demandKey: 'OTHER:g' }));
  await expect(shoppingApi.reviewShoppingDemand(input, 'wrong-receipt-key')).rejects.toThrow('receipt mismatch');
  let release!: (value: Response) => void;
  fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve; }));
  const pending = shoppingApi.reviewShoppingDemand(input, 'session-review-key');
  resetPrivateSession(); release(respond(receipt));
  await expect(pending).rejects.toMatchObject({ kind: 'auth' });
  expect(getPendingOps()).toEqual([]);
});

it('retains review binding in cache while device reads never invent a selected amount', async () => {
  const unresolved = { ...binding, ingredientId: 'GARLIC', name: 'Tỏi', unit: 'piece', contributions: [],
    reviewState: 'pending', purchaseItemId: null };
  fetchMock.mockResolvedValueOnce(respond({ items: [], unresolvedItems: [unresolved] }));
  const server = await shoppingApi.getShoppingListSnapshot();
  expect(server.unresolvedItems).toEqual([unresolved]);
  fetchMock.mockRejectedValueOnce(new TypeError('No connection'));
  const device = await shoppingApi.getShoppingListSnapshot();
  expect(device).toMatchObject({ source: 'device', items: [], unresolvedItems: [unresolved] });
  expect(getPendingOps()).toEqual([]);
});

it('negotiates and retains exact content pins in generated and unresolved offline caches', async () => {
  const contribution = { planId: 'plan-a', slotId: 'slot-a', componentId: 'component-a', date: '2030-01-02',
    mealType: 'dinner', recipeId: 'recipe-a', title: 'Synthetic dish', quantity: null, unit: 'piece', contentFingerprint: 'c'.repeat(64) };
  const unresolved = { ...binding, ingredientId: 'GARLIC', name: 'Garlic', unit: 'piece', contributions: [contribution],
    reviewState: 'pending', purchaseItemId: null };
  const item = { id: 'purchase-a', name: 'Garlic', quantity: 1, unit: 'bunch', isChecked: false,
    generated: true, contributions: [contribution] };
  fetchMock.mockResolvedValueOnce(respond({ items: [item], unresolvedItems: [unresolved] }));
  const server = await shoppingApi.getShoppingListSnapshot();
  expect(fetchMock.mock.calls[0][1].headers.Accept).toBe('application/json; recipe-content=1');
  expect(server.items[0].contributions).toEqual([contribution]);
  expect(server.unresolvedItems?.[0].contributions).toEqual([contribution]);
  fetchMock.mockRejectedValueOnce(new TypeError('No connection'));
  const device = await shoppingApi.getShoppingListSnapshot();
  expect(device.source).toBe('device');
  expect(device.items[0].contributions).toEqual([contribution]);
  expect(device.unresolvedItems?.[0].contributions).toEqual([contribution]);
  expect(getPendingOps()).toEqual([]);
});
