import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MealPlanDtoSchema,
  MealPlanningIntentSchema,
  PlanShoppingDtoSchema,
} from '../../packages/domain/src/meal-planning-api';
import { mealPlanningApi } from '../../src/web/services/meal-planning';

const id = 'c6c5f00c-cf24-4c98-8f50-8123510f1f80';
const slotId = '2030-01-02:dinner:0';
const key = 'client-test-request-key';
const instant = '2030-01-01T00:00:00.000Z';
const intent = MealPlanningIntentSchema.parse({
  startDate: '2030-01-02',
  defaultServings: 2,
  slots: [{ date: '2030-01-02', mealType: 'dinner' }],
});
const plan = MealPlanDtoSchema.parse({
  schemaVersion: 1,
  id,
  householdId: 'house-a',
  revision: 1,
  createdAt: instant,
  updatedAt: instant,
  intent,
  result: {
    status: 'incomplete',
    conclusion: 'no_plan_found_without_proof',
    planningReference: { instant, localDate: '2030-01-01', utcOffsetMinutes: 0 },
    meals: [],
    unplannedSlots: [
      { slotId, date: '2030-01-02', mealType: 'dinner', reasons: ['NUTRITION_UNKNOWN'] },
    ],
    search: {
      exhaustive: false,
      plannerExhaustive: true,
      recipeExhaustive: false,
      truncated: false,
      limitReasons: [],
      incompleteReasons: [{ source: 'recipe', code: 'SAFETY_UNKNOWN' }],
      rejections: [],
    },
    diagnostics: [],
  },
  freshness: {
    status: 'fresh',
    reasons: [],
    checkedAt: instant,
    requiresRevalidationBeforeConsumption: true,
  },
});

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  vi.stubGlobal('localStorage', storage());
  vi.stubGlobal('sessionStorage', storage());
  localStorage.setItem('frigo_user_id', 'user-a');
  localStorage.setItem('frigo_household_id', 'house-a');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(response(plan));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('meal planning cookie client', () => {
  it('sends only validated generate intent, owner headers and the supplied retry key', async () => {
    expect(await mealPlanningApi.generate(intent, key)).toEqual(plan);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/meal-planning/plans',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': key,
          accept: 'application/json; recipe-content=1',
          'X-Frigo-Expected-User-Id': 'user-a',
          'X-Frigo-Expected-Household-Id': 'house-a',
        },
        body: JSON.stringify(intent),
      }),
    );
    expect(localStorage.length).toBe(2);
    fetchMock.mockResolvedValue(response(plan));
    await mealPlanningApi.generate(intent, key);
    expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>)['idempotency-key']).toBe(
      key,
    );
  });

  it('loads a plan and restores the current plan from the server without local plan storage', async () => {
    expect(await mealPlanningApi.get(id)).toEqual(plan);
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/v1/meal-planning/plans/${id}`);
    fetchMock.mockResolvedValue(response({ plan }));
    expect(await mealPlanningApi.current()).toEqual({ plan });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/meal-planning/plans/current');
    fetchMock.mockResolvedValue(response({ plan: null }));
    expect(await mealPlanningApi.current()).toEqual({ plan: null });
    expect(localStorage.length).toBe(2);
  });

  it('loads bounded alternatives using a validated revision query', async () => {
    const alternatives = {
      planId: id,
      planRevision: 1,
      alternatives: [{ kind: 'recipe', id: 'recipe-1', title: 'Canh rau' }],
      truncated: false,
    };
    fetchMock.mockResolvedValue(response(alternatives));
    expect(await mealPlanningApi.alternatives(id, 1)).toEqual(alternatives);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `/api/v1/meal-planning/plans/${id}/alternatives?revision=1`,
    );
  });

  it('returns the authoritative replacement plan after regenerate and swap', async () => {
    const next = { ...plan, revision: 2 };
    fetchMock.mockResolvedValue(response(next));
    expect(await mealPlanningApi.regenerate(id, { revision: 1 })).toEqual(next);
    expect(fetchMock.mock.calls[0][1]?.body).toBe('{"revision":1}');
    const input = { revision: 1, slotId, replacement: { kind: 'recipe' as const, id: 'recipe-1' } };
    fetchMock.mockResolvedValue(response(next));
    expect(await mealPlanningApi.swap(id, input)).toEqual(next);
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/v1/meal-planning/plans/${id}/swap`);
    expect(fetchMock.mock.calls[1][1]?.body).toBe(JSON.stringify(input));
  });

  it('validates exact shopping results while retaining unknown costs and risk', async () => {
    const money = { currency: 'JPY', minorAmount: '0' };
    const shopping = PlanShoppingDtoSchema.parse({
      schemaVersion: 1,
      planId: id,
      planRevision: 1,
      priceAsOf: instant,
      requiresPriceRevalidation: true,
      catalogStatus: 'reviewed_catalog_unavailable',
      result: {
        schemaVersion: 1,
        id: 'shopping-result',
        mealPlanId: id,
        currency: 'JPY',
        currencyMinorDigits: 0,
        priceSnapshot: {
          id: 'snapshot',
          asOf: instant,
          requiresRevalidationBeforeAcceptance: true,
        },
        planner: {
          status: 'partial',
          conclusion: 'no_plan_found_without_proof',
          truncated: true,
          limitReasons: [],
          incompleteReasons: [],
          unplannedSlots: [],
        },
        shoppingCompleteness: 'partial',
        shoppingStatus: 'unknown',
        requirements: [],
        optionalRequirements: [],
        purchaseLines: [],
        unresolvedRequirements: [],
        cost: {
          knownCost: money,
          totalCost: null,
          status: 'unknown',
          unknownCostItemCount: 2,
          bestKnownCompleteCost: null,
          minimumCost: null,
          provenKnownCostLowerBound: money,
        },
        budget: {
          status: 'unknown',
          selectedKnownGap: money,
          knownRemaining: null,
          provenGap: money,
          replanRecommended: false,
          largestKnownCostDrivers: [],
          ingredientsWithNoCheaperKnownOption: [],
          unknownPriceRequirementIds: [],
        },
        existingInventoryRemainder: [],
        purchaseSurplus: [],
        wasteSummary: {
          existingAtRiskLotCount: 0,
          purchaseAtRiskSurplusCount: 0,
          unknownRiskItemCount: 2,
          assessedItemCount: 2,
          coverage: 0,
          certainWasteQuantity: null,
        },
        optimization: {
          exhaustive: false,
          searchExhaustive: false,
          truncated: true,
          limitReasons: [],
          incompleteReasons: [],
          proofScope: 'supplied_comparable_catalog_per_ingredient_package_cost',
        },
        diagnostics: [],
      },
    });
    fetchMock.mockResolvedValue(response(shopping));
    const input = {
      revision: 1,
      currency: 'JPY' as const,
      budget: {
        mode: 'soft' as const,
        money: { currency: 'JPY' as const, minorAmount: '9007199254740991' },
      },
    };
    expect(await mealPlanningApi.shopping(id, input)).toEqual(shopping);
    expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify(input));
  });

  it.each(['liked', 'disliked', 'cooked', 'skipped'] as const)(
    'validates %s feedback receipts without inventory mutations',
    async (type) => {
      const receipt = {
        schemaVersion: 1,
        id: 'receipt',
        planId: id,
        planRevision: 1,
        slotId,
        type,
        occurredAt: instant,
        inventoryMutated: false,
      };
      fetchMock.mockResolvedValue(response(receipt));
      expect(await mealPlanningApi.feedback(id, { revision: 1, slotId, type }, key)).toEqual(
        receipt,
      );
      expect(
        (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)['idempotency-key'],
      ).toBe(key);
      expect(localStorage.length).toBe(2);
    },
  );

  it.each([
    { source: 'ai', fallbackReason: null },
    { source: 'deterministic', fallbackReason: 'disabled' },
    { source: 'deterministic', fallbackReason: 'timeout' },
    { source: 'deterministic', fallbackReason: 'invalid_output' },
  ])('accepts grounded explanation codes and $source fallback', async (mode) => {
    const explanation = {
      planId: id,
      planRevision: 1,
      slotId,
      reasonCodes: ['REQUIRES_SHOPPING'],
      ...mode,
    };
    fetchMock.mockResolvedValue(response(explanation));
    expect(await mealPlanningApi.explanation(id, { revision: 1, slotId, locale: 'vi' })).toEqual(
      explanation,
    );
  });
});

describe('meal planning client boundaries', () => {
  it('rejects invalid intent, ownership overrides, keys and path/query injection before HTTP', async () => {
    await expect(
      mealPlanningApi.generate({ ...intent, householdId: 'other' } as typeof intent, key),
    ).rejects.toThrow();
    await expect(mealPlanningApi.generate(intent, '')).rejects.toThrow();
    await expect(mealPlanningApi.get('../other-house')).rejects.toThrow();
    await expect(mealPlanningApi.alternatives(id, 0)).rejects.toThrow();
    await expect(mealPlanningApi.alternatives(id, Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow();
    await expect(
      mealPlanningApi.swap(id, {
        revision: 1,
        slotId,
        replacement: { kind: 'family', id: 'family' },
      }),
    ).rejects.toThrow();
    await expect(
      mealPlanningApi.shopping(id, {
        revision: 1,
        currency: 'USD',
        budget: { mode: 'hard', money: { currency: 'USD', minorAmount: '9007199254740992' } },
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed responses, unexpected private fields, and mismatched scope', async () => {
    for (const body of [
      {},
      { ...plan, trustedContext: {} },
      { ...plan, id: 'c6c5f00c-cf24-4c98-8f50-8123510f1f81' },
    ]) {
      fetchMock.mockResolvedValue(response(body));
      await expect(mealPlanningApi.get(id)).rejects.toThrow();
    }
    fetchMock.mockResolvedValue(response(plan));
    await expect(mealPlanningApi.regenerate(id, { revision: 1 })).rejects.toThrow();
    fetchMock.mockResolvedValue(
      response({ planId: id, planRevision: 2, alternatives: [], truncated: false }),
    );
    await expect(mealPlanningApi.alternatives(id, 1)).rejects.toThrow();
  });

  it('rejects free-prose AI output, duplicate codes and cross-slot explanations', async () => {
    const base = {
      planId: id,
      planRevision: 1,
      slotId,
      source: 'ai',
      reasonCodes: ['REQUIRES_SHOPPING'],
      fallbackReason: null,
    };
    for (const body of [
      { ...base, text: 'Your total is ¥1200' },
      { ...base, reasonCodes: ['REQUIRES_SHOPPING', 'REQUIRES_SHOPPING'] },
      { ...base, slotId: '2030-01-02:lunch:0' },
      { ...base, reasonCodes: ['<script>unsafe</script>'] },
    ]) {
      fetchMock.mockResolvedValue(response(body));
      await expect(
        mealPlanningApi.explanation(id, { revision: 1, slotId, locale: 'en' }),
      ).rejects.toThrow();
    }
  });

  it('rejects late responses after a household switch', async () => {
    let complete!: (value: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const pending = mealPlanningApi.current();
    localStorage.setItem('frigo_household_id', 'house-b');
    complete(response({ plan }));
    await expect(pending).rejects.toMatchObject({ kind: 'auth' });
  });

  it.each([403, 409, 422, 429, 503])(
    'surfaces HTTP %s without retrying or inventing a plan',
    async (status) => {
      fetchMock.mockResolvedValue(
        response({ code: 'PLAN_REVISION_CONFLICT', error: 'test' }, status),
      );
      await expect(mealPlanningApi.regenerate(id, { revision: 1 })).rejects.toMatchObject({
        status,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(localStorage.length).toBe(2);
    },
  );

  it('does not queue offline planning, retain plan content or retry a failed mutation', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    await expect(mealPlanningApi.generate(intent, key)).rejects.toMatchObject({ kind: 'offline' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('frigo_sync_outbox_v1')).toBeNull();
    expect(localStorage.length).toBe(2);
  });

  it('reuses transport denial for anonymous and offline guest sessions', async () => {
    localStorage.setItem('frigo_guest_offline', 'true');
    await expect(mealPlanningApi.current()).rejects.toMatchObject({ kind: 'offline' });
    localStorage.clear();
    await expect(mealPlanningApi.current()).rejects.toMatchObject({ kind: 'auth' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
