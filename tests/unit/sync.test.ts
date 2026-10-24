import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../src/web/services/api';
import { flush, getPendingOps, pendingCount, pushOp, subscribe, initSync, PendingOp } from '../../src/web/lib/sync';
import { privateCacheKey } from '../../src/web/lib/private-session';

const OUTBOX_KEY = 'frigo_sync_outbox_v1';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  private getFailures = new Map<string, number>();
  private setFailures = new Map<string, number>();
  private failAfterWrite = new Map<string, number>();
  peek(key: string) { return this.values.get(key) ?? null; }
  failNextGet(key = OUTBOX_KEY) { this.getFailures.set(key, (this.getFailures.get(key) ?? 0) + 1); }
  failNextSet(key = OUTBOX_KEY) { this.setFailures.set(key, (this.setFailures.get(key) ?? 0) + 1); }
  failNextDiagnosticGet(key = OUTBOX_KEY) { this.failAfterWrite.set(key, (this.failAfterWrite.get(key) ?? 0) + 1); }

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    const failures = this.getFailures.get(key) ?? 0;
    if (failures > 0) {
      this.getFailures.set(key, failures - 1);
      throw new Error('storage read unavailable');
    }
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    const failures = this.setFailures.get(key) ?? 0;
    if (failures > 0) {
      this.setFailures.set(key, failures - 1);
      throw new Error('storage write unavailable');
    }
    this.values.set(key, String(value));
    const diagnosticFailures = this.failAfterWrite.get(key) ?? 0;
    if (diagnosticFailures > 0) {
      this.failAfterWrite.set(key, diagnosticFailures - 1);
      this.getFailures.set(key, (this.getFailures.get(key) ?? 0) + 1);
    }
  }
}

const knownInventory = [{
  id: 'known-eggs', ingredientId: 'CHICKEN_EGG', name: 'Trứng gà',
  quantity: 2, unit: 'piece' as const, version: 1,
}];
const knownShopping = [{ id: 'shop_known_eggs', name: 'Trứng gà', quantity: 2, unit: 'piece', isChecked: false }];
const offlineCallers = [
  { name: 'inventory add', cache: 'inventory', path: '/inventory', run: () => api.addInventoryItem({ name: 'Gạo', quantity: 1, unit: 'kg' }) },
  { name: 'inventory update', cache: 'inventory', path: '/inventory/known-eggs', run: () => api.updateInventoryItem('known-eggs', { quantity: 3 }, 1) },
  { name: 'inventory delete', cache: 'inventory', path: '/inventory/known-eggs', run: () => api.deleteInventoryItem('known-eggs', 1) },
  { name: 'shopping add', cache: 'shopping_list', path: '/shopping-list/items', run: () => api.addShoppingItem({ name: 'Gạo', quantity: 1, unit: 'kg' }) },
  { name: 'shopping update', cache: 'shopping_list', path: '/shopping-list/items/shop_known_eggs', run: () => api.updateShoppingItem('shop_known_eggs', { quantity: 3 }) },
  { name: 'shopping delete', cache: 'shopping_list', path: '/shopping-list/items/shop_known_eggs', run: () => api.deleteShoppingItem('shop_known_eggs') },
  { name: 'cooking', cache: 'inventory', path: '/recipes/eggs/cook/complete', run: () => api.completeCooking('eggs', [{ ingredientId: 'CHICKEN_EGG', quantityDeducted: 1, unit: 'piece' }], 'durable-cook', knownInventory) },
  { name: 'offline scan', cache: 'inventory', path: '/inventory', run: () => api.confirmScan('scan_offline_fault', [{ id: 'rice', rawName: 'Gạo', estimatedQuantity: 1, unit: 'kg' }]) },
];

describe('offline outbox and scan persistence contract', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not replay an operation into a different household', async () => {
    pushOp({
      path: '/inventory',
      method: 'POST',
      body: '{"name":"victim item"}',
      label: 'victim',
      userId: 'user-a',
      householdId: 'house-a',
    });
    pushOp({
      path: '/inventory',
      method: 'POST',
      body: '{"name":"current item"}',
      label: 'current',
      userId: 'user-b',
      householdId: 'house-b',
    });

    let replayedUserId: string | undefined;
    const replay = vi.fn(async (op: PendingOp) => {
      replayedUserId = op.userId;
    });
    const result = await flush(replay, undefined, {
      scope: { userId: 'user-b', householdId: 'house-b' },
    });

    expect(result.attempted).toBe(1);
    expect(replay).toHaveBeenCalledTimes(1);
    expect(replayedUserId).toBe('user-b');
    expect(getPendingOps()).toHaveLength(1);
    expect(getPendingOps()[0].userId).toBe('user-a');
  });

  it('serializes overlapping flush calls so one operation is replayed once', async () => {
    pushOp({
      path: '/inventory',
      method: 'POST',
      body: '{"name":"one"}',
      label: 'one',
      userId: 'user-a',
      householdId: 'house-a',
    });

    let releaseReplay!: () => void;
    const replay = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseReplay = resolve;
        })
    );
    const options = { scope: { userId: 'user-a', householdId: 'house-a' } };
    const first = flush(replay, undefined, options);
    const second = flush(replay, undefined, options);

    // Let the first call finish; the second call must then observe an empty queue.
    await vi.waitFor(() => expect(releaseReplay).toBeTypeOf('function'));
    releaseReplay();
    await Promise.all([first, second]);
    expect(replay).toHaveBeenCalledTimes(1);
    expect(pendingCount()).toBe(0);
  });

  it('imports an offline fridge scan as replayable inventory writes, not a local scan confirmation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    storage.setItem('frigo_user_id', 'guest-1');
    storage.setItem('frigo_household_id', 'hh_guest_1');

    const scan = await api.scanFridge('image-data');
    expect(scan.id).toMatch(/^scan_offline_/);
    expect(scan.offline).toBe(true);
    expect(scan.items).toHaveLength(0);

    const reviewedItem = {
      id: 'manual-1', rawName: 'Trứng gà', estimatedQuantity: 6, unit: 'piece', storage: 'fridge',
    };
    const result = await api.confirmScan(scan.id, [reviewedItem]);
    expect(result).toMatchObject({ pendingSync: true });

    const ops = getPendingOps();
    expect(ops).toHaveLength(1);
    expect(ops[0].path).toBe('/inventory');
    expect(ops[0].path).not.toContain('/scans/');
    expect(ops[0].householdId).toBe('hh_guest_1');
    const body = JSON.parse(ops[0].body || '{}');
    expect(body.id).toContain('offline_scan_offline_');
    expect(body.dataSource).toBe('scan');
  });

  it.each(['scan_server_1', 'receipt_server_1'])('queues the original server confirmation for %s without inventing stock', async (scanId) => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    const cacheKey = privateCacheKey('inventory');
    const inventory = [{ id: 'existing-eggs', name: 'Trứng gà', quantity: 2, unit: 'piece' }];
    storage.setItem(cacheKey, JSON.stringify(inventory));
    const before = storage.getItem(cacheKey);
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('response lost'));
    vi.stubGlobal('fetch', fetchMock);
    const items = [{
      id: 'scan-item-1', rawName: 'Trứng gà', estimatedQuantity: 6,
      unit: 'piece', category: 'egg', storage: 'fridge', expiryDate: '2026-09-20',
    }];

    const result = await api.confirmScan(scanId, items);
    const [originalUrl, originalInit] = fetchMock.mock.calls[0];
    expect(originalUrl).toBe(`/api/v1/scans/${scanId}/confirm`);
    expect(result).toEqual({ success: true, pendingSync: true, items: inventory });
    expect(storage.getItem(cacheKey)).toBe(before);
    const firstQueue = getPendingOps();
    expect(firstQueue).toEqual([expect.objectContaining({
      path: `/scans/${scanId}/confirm`, method: 'POST', body: originalInit.body,
      userId: 'user-a', householdId: 'house-a',
    })]);
    expect(JSON.parse(firstQueue[0].body!)).toEqual({ items });

    await api.confirmScan(scanId, items);
    expect(getPendingOps()).toEqual(firstQueue);
    expect(storage.getItem(cacheKey)).toBe(before);
  });

  it('retains the serialized server confirmation if the caller changes its draft while awaiting the response', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    const items = [{ id: 'scan-item-1', rawName: 'Trứng gà', estimatedQuantity: 6, unit: 'piece' }];
    const body = JSON.stringify({ items });
    let rejectResponse!: (error: Error) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((_resolve, reject) => { rejectResponse = reject; })));

    const confirmation = api.confirmScan('scan-server', items);
    items[0].estimatedQuantity = 60;
    rejectResponse(new TypeError('response lost'));
    await confirmation;

    expect(getPendingOps()).toEqual([expect.objectContaining({
      path: '/scans/scan-server/confirm', body, userId: 'user-a', householdId: 'house-a',
    })]);
  });

  it.each([
    { userId: 'user-b', householdId: 'house-a' },
    { userId: 'user-a', householdId: 'house-b' },
  ])('does not replay a server confirmation after switching to $userId/$householdId', async (nextScope) => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'));
    vi.stubGlobal('fetch', fetchMock);
    await api.confirmScan('scan-server', [{ id: 'scan-item-1' }]);
    const before = getPendingOps();
    expect(before[0].path).toBe('/scans/scan-server/confirm');
    storage.setItem('frigo_user_id', nextScope.userId);
    storage.setItem('frigo_household_id', nextScope.householdId);
    fetchMock.mockClear();

    expect(await api.retryPendingWrites()).toEqual({ attempted: 0, remaining: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getPendingOps()).toEqual(before);
  });

  it('does not enqueue a lost server confirmation under an owner who replaced the in-flight session', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    let rejectResponse!: (error: Error) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((_resolve, reject) => { rejectResponse = reject; })));

    const confirmation = api.confirmScan('scan-server', [{ id: 'scan-item-1' }]);
    storage.setItem('frigo_user_id', 'user-b');
    storage.setItem('frigo_household_id', 'house-b');
    rejectResponse(new TypeError('response lost'));

    await expect(confirmation).rejects.toMatchObject({ kind: 'auth' });
    expect(getPendingOps()).toEqual([]);
  });

  it.each([409, 422, 500])('does not turn a server confirmation HTTP %s into an offline import', async (status) => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"rejected"}', { status })));

    await expect(api.confirmScan('scan-server', [{ id: 'scan-item-1' }]))
      .rejects.toMatchObject({ kind: 'http', status });
    expect(getPendingOps()).toEqual([]);
    expect(storage.getItem(privateCacheKey('inventory'))).toBeNull();
  });

  it('preserves local-only receipt drafts as stable manual inventory additions', async () => {
    storage.setItem('frigo_user_id', 'guest-1');
    storage.setItem('frigo_household_id', 'hh_guest_1');
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const receipt = await api.scanReceipt('image-data');
    expect(receipt.id).toMatch(/^receipt_offline_/);
    expect(receipt.items).toEqual([]);
    fetchMock.mockClear();
    const item = { id: 'draft-eggs', rawName: 'Trứng gà', estimatedQuantity: 6, unit: 'piece' };

    const result = await api.confirmScan(receipt.id, [item]);
    expect(result).toMatchObject({ success: true, pendingSync: true, importedItemsCount: 1 });
    const queued = getPendingOps();
    expect(queued).toEqual([expect.objectContaining({
      path: '/inventory', method: 'POST', userId: 'guest-1', householdId: 'hh_guest_1',
    })]);
    expect(JSON.parse(queued[0].body!)).toMatchObject({
      id: `offline_${receipt.id}_draft-eggs`, name: 'Trứng gà', quantity: 6, unit: 'piece', dataSource: 'receipt',
    });
    await api.confirmScan(receipt.id, [item]);
    expect(getPendingOps()).toEqual(queued);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(storage.getItem(privateCacheKey('inventory'))!)).toHaveLength(1);
  });

  it('keeps queued operations scoped when the active account changes before retry', async () => {
    pushOp({
      path: '/inventory',
      method: 'POST',
      body: '{"name":"old account"}',
      label: 'old',
      userId: 'user-a',
      householdId: 'house-a',
    });
    storage.setItem('frigo_user_id', 'user-b');
    storage.setItem('frigo_household_id', 'house-b');
    storage.setItem('frigo_token', 'new-token');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.retryPendingWrites();

    expect(result.attempted).toBe(0);
    expect(result.remaining).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts only pending operations owned by the active user and household', () => {
    pushOp({ path: '/inventory', method: 'POST', label: 'A', userId: 'user-a', householdId: 'house-a' });
    pushOp({ path: '/inventory', method: 'POST', label: 'B', userId: 'user-a', householdId: 'house-a' });
    pushOp({ path: '/inventory', method: 'POST', label: 'foreign', userId: 'user-b', householdId: 'house-b' });

    expect(pendingCount({ userId: 'user-a', householdId: 'house-a' })).toBe(2);
    expect(pendingCount({ userId: 'user-b', householdId: 'house-b' })).toBe(1);
    expect(pendingCount()).toBe(3);
  });

  it('keeps guest outbox and scope unchanged when inventory transfer is deferred', async () => {
    storage.setItem('frigo_user_id', 'guest-1');
    storage.setItem('frigo_household_id', 'hh_guest_1');
    pushOp({
      path: '/inventory', method: 'POST', body: '{"id":"offline_item"}',
      label: 'guest item', userId: 'guest-1', householdId: 'hh_guest_1',
    });
    const before = getPendingOps();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'Inventory transfer deferred', code: 'INVENTORY_TRANSFER_DEFERRED',
    }), { status: 409, headers: { 'Content-Type': 'application/json' } })));

    await expect(api.verifyOtp('a@example.com', '123456', 'register', 'hh_guest_1'))
      .rejects.toMatchObject({
        kind: 'http', status: 409, message: expect.stringContaining('INVENTORY_TRANSFER_DEFERRED'),
      });
    expect(getPendingOps()).toEqual(before);
    expect(storage.getItem('frigo_user_id')).toBe('guest-1');
    expect(storage.getItem('frigo_household_id')).toBe('hh_guest_1');
    expect(storage.getItem('frigo_token')).toBeNull();
  });

  it('retains outbox compatibility with a server-confirmed successful registration migration', async () => {
    storage.setItem('frigo_user_id', 'guest-1');
    storage.setItem('frigo_household_id', 'hh_guest_1');
    pushOp({
      path: '/inventory',
      method: 'POST',
      body: '{"id":"offline_item"}',
      label: 'guest item',
      userId: 'guest-1',
      householdId: 'hh_guest_1',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            migratedFromHouseholdId: 'hh_guest_1',
            user: { id: 'user-1', householdId: 'hh_user-1' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    await api.verifyOtp('a@example.com', '123456', 'register', 'hh_guest_1');

    expect(fetch).toHaveBeenCalledWith('/api/v1/auth/verify-otp', expect.objectContaining({
      credentials: 'include',
    }));
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).has('Authorization')).toBe(false);
    expect(storage.getItem('frigo_token')).toBeNull();

    expect(getPendingOps()).toEqual([
      expect.objectContaining({ userId: 'user-1', householdId: 'hh_user-1' }),
    ]);
  });

  it('preserves idempotency headers when replaying an offline cooking command', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    storage.setItem('frigo_token', 'token-a');
    storage.setItem(
      'frigo_inventory_house-a',
      JSON.stringify([{ id: 'i1', ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ', quantity: 500, unit: 'g' }])
    );
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await api.completeCooking(
      'thit-kho',
      [{ ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ', quantityDeducted: 100, unit: 'g' }],
      'cook_command_123'
    );

    expect(getPendingOps()).toEqual([
      expect.objectContaining({
        path: '/recipes/thit-kho/cook/complete',
        headers: { 'Idempotency-Key': 'cook_command_123' },
      }),
    ]);
  });

  it('queues weekly shopping completion as one idempotent command', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    storage.setItem('frigo_token', 'token-a');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    const result = await api.completeWeekShopping('plan_12345678', [
      {
        ingredientId: 'PORK_BELLY',
        name: 'Thịt ba chỉ',
        missingQuantity: 500,
        recommendedPurchaseQuantity: 500,
        unit: 'g',
        category: 'meat',
      },
      {
        ingredientId: 'CHICKEN_EGG',
        name: 'Trứng gà',
        missingQuantity: 6,
        recommendedPurchaseQuantity: 6,
        unit: 'piece',
        category: 'egg',
      },
    ]);

    expect(result.pendingSync).toBe(true);
    expect(getPendingOps()).toHaveLength(1);
    expect(getPendingOps()[0]).toEqual(
      expect.objectContaining({
        path: '/week/plans/plan_12345678/shopping/complete',
        method: 'POST',
        headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
      })
    );
    expect(JSON.parse(getPendingOps()[0].body || '{}').items).toHaveLength(2);
    expect(JSON.parse(getPendingOps()[0].body || '{}').commandId).toBe(
      getPendingOps()[0].headers?.['Idempotency-Key']
    );
  });

  it('queues an offline weekly plan creation with a stable plan id', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    const plan = await api.createWeekPlan({
      householdId: 'house-a',
      startDate: '2026-09-07',
      householdSize: 2,
      mealSlotsPreset: 'dinner_only',
      budgetTargetVnd: 500000,
      priorities: ['use_fridge'],
      shoppingFrequency: 'once',
    });

    const op = getPendingOps()[0];
    expect(op.path).toBe('/week/plans');
    expect(op.headers?.['Idempotency-Key']).toBeTruthy();
    expect(plan.id).toBe(JSON.parse(op.body || '{}').planId);
  });


  it('does not claim pending Week completion when the outbox write fails', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    const cacheKey = privateCacheKey('inventory');
    const before = JSON.stringify([{ id: 'egg-1', ingredientId: 'CHICKEN_EGG', name: 'Trứng gà', quantity: 2, unit: 'piece' }]);
    storage.setItem(cacheKey, before);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    storage.failNextSet(); // first outbox write, not the inventory cache

    await expect(api.completeWeekShopping('plan_retry', [{
      ingredientId: 'CHICKEN_EGG', name: 'Trứng gà', missingQuantity: 6,
      recommendedPurchaseQuantity: 6, unit: 'piece', category: 'egg',
    }])).rejects.toBeInstanceOf(Error);

    expect(storage.peek(OUTBOX_KEY)).toBeNull();
    expect(storage.getItem(cacheKey)).toBe(before);
  });

  it('keeps confirmed stock unchanged across repeated offline Week completion', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    const cacheKey = privateCacheKey('inventory');
    const before = JSON.stringify([{ id: 'egg-1', ingredientId: 'CHICKEN_EGG', name: 'Trứng gà', quantity: 2, unit: 'piece' }]);
    storage.setItem(cacheKey, before);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const selected = [{
      ingredientId: 'CHICKEN_EGG', name: 'Trứng gà', missingQuantity: 6,
      recommendedPurchaseQuantity: 6, unit: 'piece', category: 'egg',
    }];

    const first = await api.completeWeekShopping('plan_repeat', selected);
    const firstOp = getPendingOps()[0];
    const second = await api.completeWeekShopping('plan_repeat', selected);
    const secondOp = getPendingOps()[0];

    expect(first).toMatchObject({ success: true, pendingSync: true });
    expect(second).toMatchObject({ success: true, pendingSync: true });
    expect(getPendingOps()).toHaveLength(1);
    expect(secondOp).toEqual(firstOp);
    expect(storage.getItem(cacheKey)).toBe(before);
    expect(JSON.parse(storage.getItem(cacheKey)!)[0].quantity).toBe(2);
  });

  it('keeps the same queued Week command through a module/document reload', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    const cacheKey = privateCacheKey('inventory');
    const before = JSON.stringify([{ id: 'egg-1', ingredientId: 'CHICKEN_EGG', name: 'Trứng gà', quantity: 2, unit: 'piece' }]);
    storage.setItem(cacheKey, before);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const selected = [{ ingredientId: 'CHICKEN_EGG', name: 'Trứng gà', recommendedPurchaseQuantity: 6, unit: 'piece' }];

    await api.completeWeekShopping('plan_reload', selected);
    const frozen = getPendingOps()[0];
    vi.resetModules();
    const { api: reloadedApi } = await import('../../src/web/services/api');
    const { getPendingOps: reloadedGetPendingOps } = await import('../../src/web/lib/sync');
    await reloadedApi.completeWeekShopping('plan_reload', selected);

    expect(reloadedGetPendingOps()).toEqual([frozen]);
    expect(storage.getItem(cacheKey)).toBe(before);
  });

  it.each([
    ['malformed JSON', '{not-json'],
    ['existing empty bytes', ''],
    ['wrong header type', JSON.stringify([{ id: 'bad', operationId: 'bad', ts: 1, path: '/inventory', method: 'POST', label: 'bad', userId: 'user-a', householdId: 'house-a', headers: { 'If-Match': 1 } }])],
    ['non-array JSON', '{"id":"not-a-queue"}'],
    ['unowned sibling', JSON.stringify([{ id: 'ok', operationId: 'ok', ts: 1, path: '/inventory', method: 'POST', label: 'ok', userId: 'user-a', householdId: 'house-a' }, { id: 'unknown', operationId: 'unknown', ts: 1, path: '/inventory', method: 'POST', label: 'unknown' }])],
  ])('fails closed for %s without replacing outbox bytes', (_label, raw) => {
    storage.setItem(OUTBOX_KEY, raw);
    expect(() => getPendingOps()).toThrow();
    expect(pendingCount()).toBeNull();
    expect(storage.peek(OUTBOX_KEY)).toBe(raw);
    expect(() => pushOp({ path: '/inventory', method: 'POST', label: 'new', userId: 'user-a', householdId: 'house-a' })).toThrow();
    expect(storage.peek(OUTBOX_KEY)).toBe(raw);
  });

  it('refuses unavailable reads and replay without reporting an empty queue', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    storage.setItem(OUTBOX_KEY, JSON.stringify([{ id: 'op-a', operationId: 'op-a', ts: 1, path: '/inventory', method: 'POST', label: 'A', userId: 'user-a', householdId: 'house-a' }]));
    const raw = storage.peek(OUTBOX_KEY);
    storage.failNextGet();
    expect(() => getPendingOps()).toThrow();
    storage.failNextGet();
    expect(pendingCount()).toBeNull();
    storage.failNextGet();
    vi.stubGlobal('fetch', vi.fn());
    await expect(api.retryPendingWrites()).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect(storage.peek(OUTBOX_KEY)).toBe(raw);
  });

  it('accepts a durable enqueue even when post-write diagnostics fail', () => {
    const seen: Array<number | null> = [];
    const unsubscribeThrowing = subscribe(() => { throw new Error('listener failed'); });
    const unsubscribe = subscribe((count) => seen.push(count));
    storage.failNextDiagnosticGet(); // emit/load after native setItem, not the initial push load
    const accepted = pushOp({ path: '/inventory', method: 'POST', label: 'A', userId: 'user-a', householdId: 'house-a' });
    unsubscribe();
    unsubscribeThrowing();
    expect(accepted.operationId).toBeTruthy();
    expect(storage.peek(OUTBOX_KEY)).toContain('"label":"A"');
    expect(seen.at(-1)).toBeNull();
  });

  it('contains automatic retry rejection and emits unavailable diagnostics', async () => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    vi.stubGlobal('navigator', { onLine: true });
    const seen: Array<number | null> = [];
    const unsubscribe = subscribe((count) => seen.push(count));
    const retry = vi.fn().mockRejectedValue(new Error('retry unavailable'));
    initSync(retry);
    storage.setItem(OUTBOX_KEY, '{unreadable');
    try {
      target.dispatchEvent(new Event('online'));
      await vi.waitFor(() => expect(seen.at(-1)).toBeNull());
      expect(retry).toHaveBeenCalledOnce();
      expect(storage.peek(OUTBOX_KEY)).toBe('{unreadable');
    } finally {
      unsubscribe();
    }
  });

  it('retains a replayed operation when removal persistence fails', async () => {
    pushOp({ path: '/inventory', method: 'POST', label: 'A', userId: 'user-a', householdId: 'house-a', operationId: 'op-a' });
    const raw = storage.peek(OUTBOX_KEY);
    storage.failNextSet();
    const replay = vi.fn(async () => undefined);
    const classifier = vi.fn(() => true);
    await expect(flush(replay, classifier, { scope: { userId: 'user-a', householdId: 'house-a' } })).rejects.toThrow();
    expect(replay).toHaveBeenCalledOnce();
    expect(classifier).not.toHaveBeenCalled();
    expect(storage.peek(OUTBOX_KEY)).toBe(raw);
  });

  it('does not claim guest-operation rebinding when its write fails', async () => {
    const { rebindPendingOps } = await import('../../src/web/lib/sync');
    pushOp({ path: '/inventory', method: 'POST', label: 'guest', userId: 'guest', householdId: 'guest-house', operationId: 'guest-op' });
    pushOp({ path: '/inventory', method: 'POST', label: 'target', userId: 'user-a', householdId: 'house-a', operationId: 'target-op' });
    const raw = storage.peek(OUTBOX_KEY);
    storage.failNextSet();
    expect(() => rebindPendingOps(
      { userId: 'guest', householdId: 'guest-house' },
      { userId: 'user-a', householdId: 'house-a' },
    )).toThrow();
    expect(storage.peek(OUTBOX_KEY)).toBe(raw);
  });

  it.each(offlineCallers)('$name rejects a failed enqueue before changing either cache', async ({ run }) => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    const inventoryKey = privateCacheKey('inventory');
    const shoppingKey = privateCacheKey('shopping_list');
    const inventoryBytes = JSON.stringify(knownInventory);
    const shoppingBytes = JSON.stringify(knownShopping);
    storage.setItem(inventoryKey, inventoryBytes);
    storage.setItem(shoppingKey, shoppingBytes);
    storage.failNextSet();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(run()).rejects.toMatchObject({ name: 'OutboxPersistenceError' });
    expect(storage.peek(OUTBOX_KEY)).toBeNull();
    expect(storage.peek(inventoryKey)).toBe(inventoryBytes);
    expect(storage.peek(shoppingKey)).toBe(shoppingBytes);
  });

  it.each(offlineCallers)('$name retains accepted command/receipt when its cache write fails', async ({ cache, path, run, name }) => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    storage.setItem(privateCacheKey('inventory'), JSON.stringify(knownInventory));
    storage.setItem(privateCacheKey('shopping_list'), JSON.stringify(knownShopping));
    const cacheKey = privateCacheKey(cache);
    const before = storage.peek(cacheKey);
    storage.failNextSet(cacheKey);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    const receipt = await run();
    const ops = getPendingOps();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ path, userId: 'user-a', householdId: 'house-a' });
    expect(storage.peek(cacheKey)).toBe(before);
    if (name.endsWith('add')) {
      expect(receipt).toMatchObject({ id: expect.any(String), pendingSync: true });
      expect(JSON.parse(ops[0].body!)).toMatchObject({ id: (receipt as { id: string }).id });
    } else if (name !== 'inventory delete') {
      expect(receipt).toMatchObject({ pendingSync: true });
    }
  });

  it.each(offlineCallers.filter(({ name }) => name === 'shopping add' || name === 'cooking'))(
    '$name does not reject a durable command because its diagnostic read fails',
    async ({ run, path }) => {
      storage.setItem('frigo_user_id', 'user-a');
      storage.setItem('frigo_household_id', 'house-a');
      storage.setItem(privateCacheKey('inventory'), JSON.stringify(knownInventory));
      storage.setItem(privateCacheKey('shopping_list'), JSON.stringify(knownShopping));
      const seen: Array<number | null> = [];
      const unsubscribe = subscribe((count) => seen.push(count));
      storage.failNextDiagnosticGet();
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
      try {
        await expect(run()).resolves.toMatchObject({ pendingSync: true });
        expect(seen.at(-1)).toBeNull();
        expect(getPendingOps()).toEqual([expect.objectContaining({ path })]);
      } finally {
        unsubscribe();
      }
    },
  );

  it('does not cache a generated Week plan before its outbox write is accepted', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    const cacheKey = privateCacheKey('active_meal_plan');
    const before = '{"id":"previous-plan"}';
    storage.setItem(cacheKey, before);
    storage.setItem(privateCacheKey('inventory'), JSON.stringify(knownInventory));
    storage.failNextSet();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(api.createWeekPlan({
      householdId: 'house-a', startDate: '2026-09-07', householdSize: 2,
      mealSlotsPreset: 'dinner_only', budgetTargetVnd: 500000,
      priorities: ['use_fridge'], shoppingFrequency: 'once',
    })).rejects.toMatchObject({ name: 'OutboxPersistenceError' });
    expect(storage.peek(OUTBOX_KEY)).toBeNull();
    expect(storage.peek(cacheKey)).toBe(before);
  });

  it('keeps independently generated shopping IDs as two accepted operations', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const input = { name: 'Gạo', quantity: 1, unit: 'kg' };
    const first = await api.addShoppingItem(input);
    const second = await api.addShoppingItem(input);
    expect(first.id).not.toBe(second.id);
    expect(getPendingOps()).toHaveLength(2);
    expect(getPendingOps().map((op) => JSON.parse(op.body!).id)).toEqual([first.id, second.id]);
  });

  it('returns the generated inventory id after durable enqueue even when its cache write fails', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    const cacheKey = privateCacheKey('inventory');
    const before = JSON.stringify([{ id: 'known', name: 'Gạo', quantity: 2, unit: 'kg' }]);
    storage.setItem(cacheKey, before);
    storage.failNextSet(cacheKey);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    const receipt = await api.addInventoryItem({ name: 'Trứng gà', quantity: 6, unit: 'piece' });
    const ops = getPendingOps();
    expect(receipt).toMatchObject({ pendingSync: true, id: expect.any(String) });
    expect(ops).toHaveLength(1);
    expect(JSON.parse(ops[0].body!)).toMatchObject({ id: receipt.id, quantity: 6 });
    expect(storage.peek(cacheKey)).toBe(before);
  });

  it('queues Week plan creation before its optional cache update fails', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    const cacheKey = privateCacheKey('active_meal_plan');
    storage.failNextSet(cacheKey);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    const receipt = await api.createWeekPlan({
      householdId: 'house-a', startDate: '2026-09-07', householdSize: 2,
      mealSlotsPreset: 'dinner_only', budgetTargetVnd: 500000,
      priorities: ['use_fridge'], shoppingFrequency: 'once',
    });
    const ops = getPendingOps();
    expect(ops).toHaveLength(1);
    expect(JSON.parse(ops[0].body!)).toMatchObject({ planId: receipt.id });
    expect(ops[0].headers?.['Idempotency-Key']).toBeTruthy();
    expect(storage.peek(cacheKey)).toBeNull();
  });

  it('keeps two independent generated-ID additions as separate accepted operations', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const item = { name: 'Trứng gà', quantity: 6, unit: 'piece' };
    const first = await api.addInventoryItem(item);
    const second = await api.addInventoryItem(item);
    expect(first.id).not.toBe(second.id);
    expect(getPendingOps()).toHaveLength(2);
  });

  it('reconciles accepted paths in finally when local removal fails', async () => {
    storage.setItem('frigo_user_id', 'user-a');
    storage.setItem('frigo_household_id', 'house-a');
    pushOp({
      path: '/inventory', method: 'POST', body: '{"id":"stable-item"}',
      label: 'A', userId: 'user-a', householdId: 'house-a', operationId: 'stable-op',
    });
    const raw = storage.peek(OUTBOX_KEY);
    storage.failNextSet();
    const fetchMock = vi.fn(async (path: string) => new Response(JSON.stringify(
      path.endsWith('/me')
        ? { user: { id: 'user-a', household: { id: 'house-a' } } }
        : { success: true },
    ), { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const reads = [
      vi.spyOn(api, 'getInventory').mockResolvedValue([]),
      vi.spyOn(api, 'getShoppingList').mockResolvedValue([]),
      vi.spyOn(api, 'getCurrentWeekPlan').mockResolvedValue(null),
    ];
    try {
      await expect(api.retryPendingWrites()).rejects.toThrow();
      expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(['/api/v1/me', '/api/v1/inventory']);
      for (const read of reads) expect(read).toHaveBeenCalledOnce();
      expect(storage.peek(OUTBOX_KEY)).toBe(raw);
    } finally {
      for (const read of reads) read.mockRestore();
    }
  });
});
