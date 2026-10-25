import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  failKey = '';
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) {
    if (key === this.failKey) throw new TypeError('PRIVATE_STORAGE_FAILURE');
    this.values.set(key, String(value));
  }
}

const OUTBOX = 'frigo_sync_outbox_v1';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

async function loadClient() {
  const { api } = await import('../../src/web/services/api');
  const sync = await import('../../src/web/lib/sync');
  const session = await import('../../src/web/lib/private-session');
  const { queryClient } = await import('../../src/web/lib/query-client');
  const { queryKeys } = await import('../../src/web/lib/queryKeys');
  queryClient.setDefaultOptions({ queries: { retry: false, gcTime: Infinity, networkMode: 'always' } });
  return { api, sync, session, queryClient, queryKeys };
}

type Client = Awaited<ReturnType<typeof loadClient>>;
let client: Client;
let storage: MemoryStorage;

beforeEach(async () => {
  vi.resetModules();
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  vi.stubGlobal('window', new EventTarget());
  localStorage.setItem('frigo_user_id', 'user-a');
  localStorage.setItem('frigo_household_id', 'house-a');
  client = await loadClient();
});

afterEach(() => {
  client?.queryClient.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('keyed Week swap successful-body transport loss', () => {
  it.each([new TypeError('body lost'), new DOMException('body lost', 'AbortError')])(
    'durably retains the exact committed request after %s, including reload', async (error) => {
      const response = json({});
      vi.spyOn(response, 'json').mockRejectedValue(error);
      const fetchMock = vi.fn().mockResolvedValue(response);
      vi.stubGlobal('fetch', fetchMock);
      await expect(client.api.swapMeal('plan-a', 'meal-a', 'recipe-a')).resolves.toEqual({ pendingSync: true });
      const [op] = client.sync.getPendingOps();
      const [path, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(path).toBe('/api/v1/week/plans/plan-a/meals/meal-a/swap');
      expect(op).toMatchObject({ path: path.replace('/api/v1', ''), method: 'POST', body: options.body });
      expect(op.headers?.['Idempotency-Key']).toBe(JSON.parse(op.body!).commandId);
      expect(op.headers?.['Idempotency-Key']).toBe((options.headers as Record<string, string>)['Idempotency-Key']);
      const raw = localStorage.getItem(OUTBOX);
      vi.resetModules();
      client = await loadClient();
      expect(client.sync.getPendingOps()).toEqual([op]);
      expect(localStorage.getItem(OUTBOX)).toBe(raw);
    },
  );
});

function plan(recipe = 'recipe-b', id = 'plan-a', householdId = 'house-a') {
  return {
    id, householdId, startDate: '2026-10-25', endDate: '2026-10-31', status: 'ACTIVE' as const,
    days: [{ id: 'day-a', planId: id, date: '2026-10-25', slots: [{
      id: 'meal-a', planId: id, recipeId: recipe, status: 'PLANNED',
      badges: [], ingredients: [], rescuedExpiringIngredients: [],
    }] }],
    shoppingItems: [],
    budget: { targetVnd: null, estimatedMinVnd: 0, estimatedMaxVnd: 0, status: 'UNDER', displayText: '' },
    utilization: { utilizationPercent: 0, plannedItemsCount: 0, totalUsableItemsCount: 0 },
    wasteRisk: { level: 'LOW', expiringItemsCount: 0, rescuedItemsCount: 0 }, priorities: [],
    shoppingFrequency: 'once' as const, createdAt: '2026-10-25', updatedAt: '2026-10-25',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function queueSwap(overrides: Partial<import('../../src/web/lib/sync').PendingOp> = {}) {
  return client.sync.pushOp({
    path: '/week/plans/plan-a/meals/meal-a/swap', method: 'POST',
    body: JSON.stringify({ recipeId: 'recipe-a', commandId: 'week_swap_original' }),
    headers: { 'Idempotency-Key': 'week_swap_original' }, label: 'Đổi món',
    userId: 'user-a', householdId: 'house-a', ...overrides,
  });
}

function replayFetch(options: { conflict?: boolean; currentPlan?: unknown } = {}) {
  return vi.fn(async (path: string) => {
    if (path === '/api/v1/me') return json({ user: { id: 'user-a', household: { id: 'house-a' } } });
    if (path.endsWith('/swap')) return options.conflict === false ? json({ plan: plan() })
      : json({ code: 'IDEMPOTENCY_CONFLICT', error: 'PRIVATE_SERVER_DETAIL' }, 409);
    if (path === '/api/v1/week/plans/plan-a') return json({ plan: options.currentPlan ?? plan() });
    throw new Error(`Unexpected request: ${path}`);
  });
}

describe('Week swap retention boundaries', () => {
  it('accepts network loss before optional corrupt cache projection', async () => {
    localStorage.setItem(client.session.privateCacheKey('active_meal_plan'), '{corrupt');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(client.api.swapMeal('plan-a', 'meal-a', 'recipe-a')).resolves.toEqual({ pendingSync: true });
    expect(client.sync.getPendingOps()).toHaveLength(1);
  });

  it('does not accept pending success when durable enqueue fails', async () => {
    storage.failKey = OUTBOX;
    const response = json({});
    vi.spyOn(response, 'json').mockRejectedValue(new TypeError('lost body'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(client.api.swapMeal('plan-a', 'meal-a', 'recipe-a')).rejects.toThrow('Cannot persist offline outbox');
    expect(client.sync.getPendingOps()).toEqual([]);
  });

  it.each([new SyntaxError('bad JSON'), new Error('application failure')])('does not queue successful-body %s', async (failure) => {
    const response = json({});
    vi.spyOn(response, 'json').mockRejectedValue(failure);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(client.api.swapMeal('plan-a', 'meal-a', 'recipe-a')).rejects.toBe(failure);
    expect(client.sync.getPendingOps()).toEqual([]);
  });

  it.each([409, 500, 401, 403])('does not queue HTTP %s with an unreadable error body', async (status) => {
    const response = json({}, status);
    vi.spyOn(response, 'text').mockRejectedValue(new TypeError('body lost'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(client.api.swapMeal('plan-a', 'meal-a', 'recipe-a')).rejects.toMatchObject(status === 401 ? { kind: 'auth' } : { status });
    expect(client.sync.getPendingOps()).toEqual([]);
  });

  it('does not treat alternative body loss as a command', async () => {
    const response = json({});
    const failure = new TypeError('body lost');
    vi.spyOn(response, 'json').mockRejectedValue(failure);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(client.api.swapMeal('plan-a', 'meal-a')).rejects.toBe(failure);
    expect(client.sync.getPendingOps()).toEqual([]);
  });

  it.each([null, {}, { plan: null }, { plan: plan('recipe-b', 'other-plan') }, { plan: plan('recipe-b', 'plan-a', 'other-house') }])(
    'does not turn malformed success %j into pending', async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(body)));
      await expect(client.api.swapMeal('plan-a', 'meal-a', 'recipe-a')).rejects.toThrow();
      expect(client.sync.getPendingOps()).toEqual([]);
    },
  );

  it('keeps known-success cache TypeError outside transport retention', async () => {
    storage.failKey = client.session.privateCacheKey('active_meal_plan');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ plan: plan() })));
    await expect(client.api.swapMeal('plan-a', 'meal-a', 'recipe-a')).rejects.toThrow('PRIVATE_STORAGE_FAILURE');
    expect(client.sync.getPendingOps()).toEqual([]);
  });

  it('accepts the current plan on direct receipt replay, preserving the replay flag', async () => {
    const current = plan();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ plan: current, idempotentReplay: true })));
    await expect(client.api.swapMeal('plan-a', 'meal-a', 'recipe-a')).resolves.toEqual({ plan: current, idempotentReplay: true });
    expect(JSON.parse(localStorage.getItem(client.session.privateCacheKey('active_meal_plan'))!)).toEqual(current);
    expect(client.sync.getPendingOps()).toEqual([]);
  });

  it.each(['before', 'fetch', 'body'])('honors caller cancellation %s even with a TypeError reason', async (boundary) => {
    const controller = new AbortController();
    const failure = new TypeError('cancelled deliberately');
    const fetchMock = vi.fn(async () => {
      if (boundary === 'fetch') { controller.abort(failure); throw failure; }
      const response = json({});
      vi.spyOn(response, 'json').mockImplementation(async () => { controller.abort(failure); throw failure; });
      return response;
    });
    vi.stubGlobal('fetch', fetchMock);
    if (boundary === 'before') controller.abort(failure);
    await expect(client.api.swapMeal('plan-a', 'meal-a', 'recipe-a', controller.signal)).rejects.toBe(failure);
    expect(client.sync.getPendingOps()).toEqual([]);
    if (boundary === 'before') expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['household', 'generation', 'logout'])('fences %s changes before retaining lost body', async (boundary) => {
    const response = json({});
    vi.spyOn(response, 'json').mockImplementation(async () => {
      if (boundary === 'household') localStorage.setItem('frigo_household_id', 'house-b');
      if (boundary === 'generation') client.session.resetPrivateSession();
      if (boundary === 'logout') localStorage.setItem(client.session.LOGOUT_PENDING_KEY, 'true');
      throw new TypeError('body lost');
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(client.api.swapMeal('plan-a', 'meal-a', 'recipe-a')).rejects.toMatchObject({ kind: 'auth' });
    expect(client.sync.getPendingOps()).toEqual([]);
  });
});

describe('retained precise Week swap conflict', () => {
  it('notifies subscribers, preserves exact bytes and rediscovers the conflict after reload', async () => {
    const op = queueSwap();
    const original = localStorage.getItem(OUTBOX);
    const notifications: unknown[] = [];
    const unsubscribe = client.sync.subscribe(() => notifications.push(client.api.getBlockedWeekSwap()));
    vi.stubGlobal('fetch', replayFetch());
    await expect(client.api.retryPendingWrites()).resolves.toEqual({ attempted: 0, remaining: 1 });
    expect(client.api.getBlockedWeekSwap()).toEqual(op);
    expect(notifications).toEqual([null, op]);
    expect(localStorage.getItem(OUTBOX)).toBe(original);
    unsubscribe();
    client.queryClient.clear();
    vi.resetModules();
    client = await loadClient();
    expect(client.api.getBlockedWeekSwap()).toBeNull();
    await client.api.retryPendingWrites();
    expect(client.api.getBlockedWeekSwap()).toEqual(op);
    expect(localStorage.getItem(OUTBOX)).toBe(original);
  });

  it('exposes the precise conflict through automatic online replay', async () => {
    const op = queueSwap();
    const notified = deferred<void>();
    const unsubscribe = client.sync.subscribe(() => {
      if (client.api.getBlockedWeekSwap()) notified.resolve();
    });
    vi.stubGlobal('fetch', replayFetch());
    client.sync.initSync(() => client.api.retryPendingWrites());
    window.dispatchEvent(new Event('online'));
    await notified.promise;
    expect(client.api.getBlockedWeekSwap()).toEqual(op);
    expect(client.sync.getPendingOps()).toEqual([op]);
    unsubscribe();
  });

  it.each<Partial<import('../../src/web/lib/sync').PendingOp>>([
    { path: '/week/plans/plan-a/meals/meal-a' },
    { path: '/inventory' },
    { method: 'PATCH' },
    { body: '{}' },
    { body: '{bad' },
    { body: JSON.stringify({ recipeId: 'recipe-a', commandId: 'short' }), headers: { 'Idempotency-Key': 'short' } },
    { headers: { 'Idempotency-Key': 'week_swap_different' } },
    { headers: { 'Idempotency-Key': 'week_swap_original', 'idempotency-key': 'week_swap_original' } },
    { body: JSON.stringify({ recipeId: 'recipe-a', commandId: 'week_swap_original', idempotencyKey: 'week_swap_different' }) },
  ])('retains generic 409 without specialized recovery for %j', async (overrides) => {
    const op = queueSwap(overrides);
    vi.stubGlobal('fetch', vi.fn(async (path: string) => path === '/api/v1/me'
      ? json({ user: { id: 'user-a', household: { id: 'house-a' } } })
      : json({ code: 'IDEMPOTENCY_CONFLICT' }, 409)));
    await client.api.retryPendingWrites();
    expect(client.sync.getPendingOps()).toEqual([op]);
    expect(client.api.getBlockedWeekSwap()).toBeNull();
  });

  it.each([
    { status: 409, code: 'OTHER_CONFLICT' },
    { status: 403, code: 'IDEMPOTENCY_CONFLICT' },
    { status: 500, code: 'IDEMPOTENCY_CONFLICT' },
  ])('retains %j without misclassifying a precise conflict', async ({ status, code }) => {
    const op = queueSwap();
    vi.stubGlobal('fetch', vi.fn(async (path: string) => path === '/api/v1/me'
      ? json({ user: { id: 'user-a', household: { id: 'house-a' } } }) : json({ code }, status)));
    await client.api.retryPendingWrites();
    expect(client.sync.getPendingOps()).toEqual([op]);
    expect(client.api.getBlockedWeekSwap()).toBeNull();
  });

  it('rejects an unreadable outbox as unknown state while keeping its bytes', async () => {
    queueSwap();
    vi.stubGlobal('fetch', replayFetch());
    await client.api.retryPendingWrites();
    localStorage.setItem(OUTBOX, '{broken');
    expect(() => client.api.getBlockedWeekSwap()).toThrow('Cannot read offline outbox');
    expect(localStorage.getItem(OUTBOX)).toBe('{broken');
  });
});

describe('explicit Week swap conflict recovery', () => {
  async function block() {
    const op = queueSwap();
    vi.stubGlobal('fetch', replayFetch());
    await client.api.retryPendingWrites();
    expect(client.api.getBlockedWeekSwap()).toEqual(op);
    return op;
  }

  it('reloads current B before removing only the approved conflict, preserving other owners', async () => {
    const op = await block();
    const other = queueSwap({ userId: 'user-b', householdId: 'house-b', path: '/week/plans/other/meals/other/swap' });
    const cacheKey = client.session.privateCacheKey('active_meal_plan');
    localStorage.setItem(cacheKey, JSON.stringify(plan('recipe-a')));
    client.queryClient.setQueryData(client.queryKeys.weekPlan('plan-a'), plan('recipe-a'));
    client.queryClient.setQueryData(client.queryKeys.currentWeekPlan(), plan('recipe-a'));
    const fetchMock = replayFetch();
    vi.stubGlobal('fetch', fetchMock);
    await expect(client.api.retryPendingWrites({ discardWeekSwapConflict: op })).resolves.toEqual({ attempted: 0, remaining: 1 });
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/me', '/api/v1/week/plans/plan-a/meals/meal-a/swap', '/api/v1/week/plans/plan-a',
    ]);
    expect(client.sync.getPendingOps()).toEqual([other]);
    expect(client.api.getBlockedWeekSwap()).toBeNull();
    expect(JSON.parse(localStorage.getItem(cacheKey)!)).toEqual(plan());
    expect(client.queryClient.getQueryData(client.queryKeys.weekPlan('plan-a'))).toEqual(plan());
    expect(client.queryClient.getQueryData(client.queryKeys.currentWeekPlan())).toEqual(plan());
  });

  it('does not promote an archived plan over another current plan', async () => {
    const op = await block();
    const other = plan('recipe-other', 'plan-other');
    const cacheKey = client.session.privateCacheKey('active_meal_plan');
    localStorage.setItem(cacheKey, JSON.stringify(other));
    client.queryClient.setQueryData(client.queryKeys.currentWeekPlan(), other);
    await client.api.retryPendingWrites({ discardWeekSwapConflict: op });
    expect(client.queryClient.getQueryData(client.queryKeys.weekPlan('plan-a'))).toEqual(plan());
    expect(client.queryClient.getQueryData(client.queryKeys.currentWeekPlan())).toEqual(other);
    expect(JSON.parse(localStorage.getItem(cacheKey)!)).toEqual(other);
    expect(client.sync.getPendingOps()).toEqual([]);
  });

  it('cancels stale exact queries before publishing B', async () => {
    const op = await block();
    const stale = deferred<ReturnType<typeof plan>>();
    const key = client.queryKeys.weekPlan('plan-a');
    const reading = client.queryClient.fetchQuery({ queryKey: key, queryFn: () => stale.promise }).catch(() => null);
    await client.api.retryPendingWrites({ discardWeekSwapConflict: op });
    stale.resolve(plan('recipe-a'));
    await reading;
    expect(client.queryClient.getQueryData(key)).toEqual(plan());
  });


  it('serializes simultaneous confirmed recoveries and removes the request once', async () => {
    const op = await block();
    const current = deferred<Response>();
    const requested = deferred<void>();
    const replay = replayFetch();
    const fetchMock = vi.fn(async (path: string) => {
      if (path === '/api/v1/week/plans/plan-a') { requested.resolve(); return current.promise; }
      return replay(path);
    });
    vi.stubGlobal('fetch', fetchMock);
    const first = client.api.retryPendingWrites({ discardWeekSwapConflict: op });
    await requested.promise;
    const second = client.api.retryPendingWrites({ discardWeekSwapConflict: op });
    current.resolve(json({ plan: plan() }));
    await Promise.all([first, second]);
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/v1/week/plans/plan-a')).toHaveLength(1);
    expect(client.sync.getPendingOps()).toEqual([]);
  });

  it('uses normal successful replay if a confirmed blocked request now succeeds', async () => {
    const op = await block();
    const fetchMock = replayFetch({ conflict: false });
    vi.stubGlobal('fetch', fetchMock);
    await client.api.retryPendingWrites({ discardWeekSwapConflict: op });
    expect(client.sync.getPendingOps()).toEqual([]);
    expect(client.api.getBlockedWeekSwap()).toBeNull();
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/v1/week/plans/plan-a')).toBe(false);
  });

  it('does not replace another current plan selected during exact query cancellation', async () => {
    const op = await block();
    const other = plan('other-recipe', 'other-plan');
    const currentKey = client.queryKeys.currentWeekPlan();
    client.queryClient.setQueryData(currentKey, plan('recipe-a'));
    const cancel = client.queryClient.cancelQueries.bind(client.queryClient);
    vi.spyOn(client.queryClient, 'cancelQueries').mockImplementation(async (...args) => {
      await cancel(...args);
      client.queryClient.setQueryData(currentKey, other);
      localStorage.setItem(client.session.privateCacheKey('active_meal_plan'), JSON.stringify(other));
    });
    await client.api.retryPendingWrites({ discardWeekSwapConflict: op });
    expect(client.queryClient.getQueryData(currentKey)).toEqual(other);
    expect(JSON.parse(localStorage.getItem(client.session.privateCacheKey('active_meal_plan'))!)).toEqual(other);
    expect(client.sync.getPendingOps()).toEqual([]);
  });

  it('requires a previously visible exact blocked snapshot', async () => {
    const op = queueSwap();
    vi.stubGlobal('fetch', replayFetch());
    await client.api.retryPendingWrites({ discardWeekSwapConflict: op });
    expect(client.sync.getPendingOps()).toEqual([op]);
    expect(client.api.getBlockedWeekSwap()).toEqual(op);
  });

  it('rejects a changed confirmation without a reload or removal', async () => {
    const op = await block();
    const fetchMock = replayFetch();
    vi.stubGlobal('fetch', fetchMock);
    await client.api.retryPendingWrites({ discardWeekSwapConflict: { ...op, body: '{}' } });
    expect(client.sync.getPendingOps()).toEqual([op]);
    expect(fetchMock.mock.calls).toHaveLength(2);
  });

  it('does not discard when a same-ID queue entry changed while confirmation was open', async () => {
    const op = await block();
    const changed = { ...op, body: JSON.stringify({ recipeId: 'other', commandId: 'week_swap_original' }) };
    localStorage.setItem(OUTBOX, JSON.stringify([changed]));
    await client.api.retryPendingWrites({ discardWeekSwapConflict: op });
    expect(client.sync.getPendingOps()).toEqual([changed]);
  });

  it.each([400, 404, 500])('retains conflict after recovery GET HTTP %s', async (status) => {
    const op = await block();
    const original = localStorage.getItem(OUTBOX);
    const fetchMock = replayFetch();
    vi.stubGlobal('fetch', vi.fn(async (path: string) => path === '/api/v1/week/plans/plan-a' ? json({}, status) : fetchMock(path)));
    await expect(client.api.retryPendingWrites({ discardWeekSwapConflict: op })).rejects.toMatchObject({ status });
    expect(localStorage.getItem(OUTBOX)).toBe(original);
    expect(client.api.getBlockedWeekSwap()).toEqual(op);
  });

  it.each([
    null, {}, plan('recipe-b', 'wrong-id'), plan('recipe-b', 'plan-a', 'wrong-house'),
    { ...plan(), budget: null }, { ...plan(), utilization: null }, { ...plan(), wasteRisk: null },
    { ...plan(), days: [{ ...plan().days[0], slots: [null] }] },
  ])(
    'retains conflict on malformed authoritative plan %j', async (value) => {
      const op = await block();
      const fetchMock = replayFetch();
      vi.stubGlobal('fetch', vi.fn(async (path: string) => path === '/api/v1/week/plans/plan-a' ? json({ plan: value }) : fetchMock(path)));
      await expect(client.api.retryPendingWrites({ discardWeekSwapConflict: op })).rejects.toThrow('Invalid Week recovery response');
      expect(client.sync.getPendingOps()).toEqual([op]);
    },
  );

  it('retains conflict when the authoritative GET loses connectivity', async () => {
    const op = await block();
    const fetchMock = replayFetch();
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      if (path === '/api/v1/week/plans/plan-a') throw new TypeError('offline');
      return fetchMock(path);
    }));
    await expect(client.api.retryPendingWrites({ discardWeekSwapConflict: op })).rejects.toMatchObject({ kind: 'offline' });
    expect(client.sync.getPendingOps()).toEqual([op]);
  });

  it.each(['cache-read', 'cache-write', 'remove'])('retains original request after %s storage failure and permits retry', async (failure) => {
    const op = await block();
    const original = localStorage.getItem(OUTBOX);
    const cacheKey = client.session.privateCacheKey('active_meal_plan');
    localStorage.setItem(cacheKey, JSON.stringify(plan('recipe-a')));
    let read: ReturnType<typeof vi.spyOn> | undefined;
    if (failure === 'cache-read') {
      const getItem = storage.getItem.bind(storage);
      read = vi.spyOn(storage, 'getItem').mockImplementation((key: string) => {
        if (key === cacheKey) throw new TypeError('cache read failed');
        return getItem(key);
      });
    } else storage.failKey = failure === 'remove' ? OUTBOX : cacheKey;
    await expect(client.api.retryPendingWrites({ discardWeekSwapConflict: op })).rejects.toThrow();
    expect(localStorage.getItem(OUTBOX)).toBe(original);
    read?.mockRestore();
    storage.failKey = '';
    await client.api.retryPendingWrites({ discardWeekSwapConflict: op });
    expect(client.sync.getPendingOps()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(cacheKey)!)).toEqual(plan());
  });

  it.each(['owner', 'generation', 'logout', 'op'])('fences %s changes during authoritative reload', async (change) => {
    const op = await block();
    const current = deferred<Response>();
    const requested = deferred<void>();
    const fetchMock = replayFetch();
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      if (path === '/api/v1/week/plans/plan-a') { requested.resolve(); return current.promise; }
      return fetchMock(path);
    }));
    const recovering = client.api.retryPendingWrites({ discardWeekSwapConflict: op });
    await requested.promise;
    if (change === 'owner') localStorage.setItem('frigo_user_id', 'user-b');
    if (change === 'generation') client.session.resetPrivateSession();
    if (change === 'logout') localStorage.setItem(client.session.LOGOUT_PENDING_KEY, 'true');
    if (change === 'op') localStorage.setItem(OUTBOX, JSON.stringify([{ ...op, body: '{}' }]));
    current.resolve(json({ plan: plan() }));
    await expect(recovering).rejects.toThrow();
    expect(client.sync.getPendingOps()).toHaveLength(1);
    expect(client.queryClient.getQueryData(['weekPlan', 'user-a', 'house-a', 'plan-a'])).toBeUndefined();
  });

  it('honors existing private identity cleanup when the server cookie owner no longer matches', async () => {
    const op = await block();
    const fetchMock = vi.fn(async () => json({ user: { id: 'user-b', household: { id: 'house-a' } } }));
    vi.stubGlobal('fetch', fetchMock);
    await client.api.retryPendingWrites({ discardWeekSwapConflict: op });
    expect(fetchMock.mock.calls).toHaveLength(1);
    expect(client.sync.getPendingOps()).toEqual([]);
    expect(localStorage.getItem('frigo_user_id')).toBeNull();
    expect(client.api.getBlockedWeekSwap()).toBeNull();
    expect(client.queryClient.getQueryData(['weekPlan', 'user-a', 'house-a', 'plan-a'])).toBeUndefined();
  });
});
