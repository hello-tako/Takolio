// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyPreferencesSchema } from '../../packages/domain/src/family-preferences-api';
import {
  FamilyMealPlanDtoSchema,
  type FamilyMealPlanDto,
} from '../../packages/domain/src/family-meal-planning-api';
import type { MealPlanDto } from '../../packages/domain/src/meal-planning-api';
import { SharePlanShoppingSchema } from '../../packages/domain/src/shopping-plan-api';
import type { z } from 'zod';
type SharePlanShopping = z.input<typeof SharePlanShoppingSchema>;
import { hookPlan, hookPlanId } from '../helpers/planner-hook-fixtures';
import { PlannerShopping } from '../../src/web/features/planner/PlannerShopping';
import { queryKeys } from '../../src/web/lib/queryKeys';
import { ApiError } from '../../src/web/services/http';
import { resetPrivateSession } from '../../src/web/lib/private-session';
import { useAuthStore } from '../../src/web/stores/useAuthStore';

const mocks = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  compositions: vi.fn(),
  share: vi.fn(),
}));
vi.mock('../../src/web/services/family-preferences', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  familyPreferencesApi: { get: mocks.getPreferences },
}));
vi.mock('../../src/web/services/meal-composition', () => ({
  mealCompositionApi: { plan: mocks.compositions },
}));
vi.mock('../../src/web/services/shopping', () => ({
  shoppingApi: { sharePlanShopping: mocks.share },
}));

let host: HTMLDivElement, root: Root, client: QueryClient;
const response = (input: SharePlanShopping, replay = false) => ({
  success: true,
  planId: input.planId,
  planRevision: input.expectedRevision,
  sourceId: 'plan-source',
  itemCount: input.endDate === '2030-01-08' ? 7 : 3,
  unresolvedCount: 0,
  idempotentReplay: replay,
});
function model(familyPlan?: FamilyMealPlanDto) {
  const pending = new Map<string, string>();
  let sequence = 0;
  return {
    familyPlan,
    busy: null,
    error: null,
    loadPlan: vi.fn(async () => hookPlan(2)),
    replacePlan: vi.fn(),
    perform: vi.fn(async (_label, operation, accept) => {
      const result = await operation();
      accept?.(result);
      return result;
    }),
    requestKey: vi.fn((intent: unknown) => {
      const fingerprint = JSON.stringify(intent);
      if (!pending.has(fingerprint)) pending.set(fingerprint, `share-command-${++sequence}`);
      return pending.get(fingerprint)!;
    }),
    retireRequestKey: vi.fn((intent: unknown) => pending.delete(JSON.stringify(intent))),
  };
}
async function mount(planner: ReturnType<typeof model>, plan = hookPlan()) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PlannerShopping plan={plan} model={planner as never} locale="vi" />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
}
async function until(check: () => void) {
  for (let attempt = 0; attempt < 100; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    try {
      check();
      return;
    } catch (error) {
      if (attempt === 99) throw error;
    }
  }
}
const shareButton = () =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === 'Tạo danh sách dùng chung',
  )!;
async function share() {
  await act(async () => shareButton().click());
  await until(() => expect(shareButton().disabled).toBe(false));
}
async function period(days: string) {
  const select = [...host.querySelectorAll('select')].find((element) =>
    element.closest('label')?.textContent?.startsWith('Khoảng đi chợ'),
  ) as HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, days);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('VITE_MEAL_COMPOSITION_V2_ENABLED', 'true');
  localStorage.clear();
  sessionStorage.clear();
  resetPrivateSession();
  localStorage.setItem('frigo_user_id', 'user-a');
  localStorage.setItem('frigo_household_id', 'house-a');
  useAuthStore.setState({ userId: 'user-a', householdId: 'house-a', isGuest: false });
  vi.clearAllMocks();
  mocks.getPreferences.mockResolvedValue({
    revision: 1,
    preferences: FamilyPreferencesSchema.parse({ shoppingCadence: 'every_2_3_days' }),
  });
  mocks.compositions.mockResolvedValue({
    schemaVersion: 1,
    planId: hookPlanId,
    planRevision: 1,
    compositions: [],
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('reconciles a completed A→B→A shopping horizon with a new command each time', async () => {
  const receipts = new Map<string, ReturnType<typeof response>>();
  let sharedEndDate = '';
  mocks.share.mockImplementation(async (input: SharePlanShopping, key: string) => {
    const old = receipts.get(key);
    if (old) return { ...old, idempotentReplay: true };
    sharedEndDate = input.endDate;
    const saved = response(input);
    receipts.set(key, saved);
    return saved;
  });
  const planner = model();
  client.setQueryData([...queryKeys.shoppingList(), 'snapshot'], { items: [], source: 'server' });
  await mount(planner);
  await until(() => expect(mocks.getPreferences).toHaveBeenCalled());
  await period('3');
  await share();
  expect(sharedEndDate).toBe('2030-01-04');
  expect(client.getQueryState([...queryKeys.shoppingList(), 'snapshot'])?.isInvalidated).toBe(true);
  await period('7');
  await share();
  expect(sharedEndDate).toBe('2030-01-08');
  await period('3');
  await share();
  expect(sharedEndDate).toBe('2030-01-04');
  expect(mocks.share.mock.calls.map(([, key]) => key)).toEqual([
    'share-command-1',
    'share-command-2',
    'share-command-3',
  ]);
  expect(planner.retireRequestKey).toHaveBeenCalledTimes(3);
  expect(host.textContent).toContain('Đã cập nhật nhu cầu cho 3 nguyên liệu');
});

it('keeps the command through an ambiguous failed response, then retires it after successful replay', async () => {
  const planner = model();
  let committed: ReturnType<typeof response> | null = null;
  mocks.share.mockImplementation(async (input: SharePlanShopping) => {
    if (!committed) {
      committed = response(input);
      throw new ApiError('offline', 'Response lost after server commit.');
    }
    return { ...committed, idempotentReplay: true };
  });
  await mount(planner);
  await until(() => expect(mocks.getPreferences).toHaveBeenCalled());
  await period('3');
  await share();
  expect(host.textContent).toContain('Chưa tạo được danh sách chung');
  expect(planner.retireRequestKey).not.toHaveBeenCalled();
  await share();
  expect(mocks.share.mock.calls.map(([, key]) => key)).toEqual([
    'share-command-1',
    'share-command-1',
  ]);
  expect(planner.retireRequestKey).toHaveBeenCalledTimes(1);
  await share();
  expect(mocks.share.mock.calls[2][1]).toBe('share-command-2');
});

it.each([
  'PLAN_REVISION_CONFLICT',
  'REVISION_CONFLICT',
  'SHOPPING_SNAPSHOT_CHANGED',
  'PLAN_REVALIDATION_REQUIRED',
])(
  'loads current planning data after %s without automatically retrying the share',
  async (code) => {
    const planner = model();
    mocks.share.mockRejectedValueOnce(new ApiError('http', `HTTP 409: {"code":"${code}"}`, 409));
    mocks.share.mockImplementation(async (input: SharePlanShopping) => response(input));
    await mount(planner);
    await act(async () => shareButton().click());
    await until(() => expect(host.textContent).toContain('Tải lại dữ liệu trước khi cập nhật'));
    expect(shareButton().disabled).toBe(true);
    expect(host.textContent).not.toContain('Kiểm tra kết nối');
    expect(planner.loadPlan).not.toHaveBeenCalled();
    expect(planner.retireRequestKey).not.toHaveBeenCalled();
    const reload = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === 'Tải thực đơn mới nhất',
    )!;
    await act(async () => reload.click());
    expect(planner.perform).toHaveBeenCalledWith(
      'refresh',
      expect.any(Function),
      planner.replacePlan,
    );
    expect(planner.loadPlan).toHaveBeenCalledExactlyOnceWith(hookPlanId);
    expect(planner.replacePlan).toHaveBeenCalledExactlyOnceWith(hookPlan(2));
    expect(mocks.share).toHaveBeenCalledTimes(1);
    mocks.compositions.mockResolvedValue({
      schemaVersion: 1,
      planId: hookPlanId,
      planRevision: 2,
      compositions: [],
    });
    await mount(planner, hookPlan(2));
    await share();
    expect(mocks.share).toHaveBeenCalledTimes(2);
    expect(mocks.share).toHaveBeenLastCalledWith(
      expect.objectContaining({ expectedRevision: 2 }),
      'share-command-2',
    );
  },
);

it('keeps sharing blocked when the latest plan cannot be loaded', async () => {
  const planner = model();
  planner.perform.mockImplementationOnce(async () => undefined);
  mocks.share.mockRejectedValue(
    new ApiError('http', 'HTTP 409: {"code":"SHOPPING_SNAPSHOT_CHANGED"}', 409),
  );
  await mount(planner);
  await act(async () => shareButton().click());
  await until(() => expect(host.textContent).toContain('Tải lại dữ liệu trước khi cập nhật'));
  const reload = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === 'Tải thực đơn mới nhất',
  )!;
  await act(async () => reload.click());
  expect(shareButton().disabled).toBe(true);
  expect(host.textContent).toContain('Tải thực đơn mới nhất');
  expect(mocks.share).toHaveBeenCalledTimes(1);
  expect(planner.retireRequestKey).not.toHaveBeenCalled();
});

it('blocks stale shopping writes when composition reads report a newer plan revision', async () => {
  const planner = model();
  mocks.compositions.mockResolvedValue({
    schemaVersion: 1,
    planId: hookPlanId,
    planRevision: 2,
    compositions: [],
  });
  await mount(planner);
  await until(() => expect(host.textContent).toContain('Thực đơn đã có phiên bản mới'));
  expect(shareButton().disabled).toBe(true);
  const reload = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === 'Tải thực đơn mới nhất',
  )!;
  await act(async () => reload.click());
  expect(planner.loadPlan).toHaveBeenCalledExactlyOnceWith(hookPlanId);
  expect(planner.replacePlan).toHaveBeenCalledExactlyOnceWith(hookPlan(2));
  expect(mocks.share).not.toHaveBeenCalled();
  expect(shareButton().disabled).toBe(true);
});

describe('T23 shared shopping continues the current family week', () => {
  beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2030-01-02T13:00:00.000Z')));
  afterEach(() => vi.restoreAllMocks());
  function currentPlan(reasons: MealPlanDto['freshness']['reasons']) {
    const plan = hookPlan();
    plan.intent.slots.unshift({ date: '2030-01-02', mealType: 'breakfast', sequence: 0 });
    plan.freshness = {
      ...plan.freshness,
      status: 'requires_revalidation',
      reasons,
      checkedAt: '2030-01-02T13:00:00.000Z',
    };
    return plan;
  }
  function family(plan: MealPlanDto) {
    return FamilyMealPlanDtoSchema.parse({
      schemaVersion: 2,
      plan,
      compositions: {
        schemaVersion: 1,
        planId: plan.id,
        planRevision: plan.revision,
        compositions: [],
      },
      policy: {
        mealStyle: 'family',
        preferredRegions: ['bac'],
        internationalMealsPerWeek: 0,
        internationalGeneratedMainCount: 0,
        lockedInternationalMainCount: 0,
        defaultCuisine: 'vietnamese',
        profileRevision: 1,
      },
      diagnostics: {
        completeMealCount: 0,
        partialMealCount: 0,
        unplannedMealCount: 2,
        reasons: [],
        searchLimited: false,
      },
      familyPreferenceFreshness: 'fresh',
    });
  }
  function optimizer() {
    return [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === 'Lập danh sách đi chợ',
    )!;
  }
  it('shares future composed meals despite elapsed history while price optimization stays gated', async () => {
    const plan = currentPlan(['planning_time_elapsed']);
    mocks.share.mockImplementation(async (input: SharePlanShopping) => response(input));
    await mount(model(), plan);
    expect(shareButton().disabled).toBe(false);
    expect(optimizer().disabled).toBe(true);
    await share();
    expect(mocks.share).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Đã cập nhật nhu cầu');
    expect(optimizer().disabled).toBe(true);
  });
  it('rechecks changed family stock and history for future shopping after real cooking', async () => {
    const plan = currentPlan(['planning_time_elapsed', 'stale_inventory', 'stale_history']);
    const planner = model(family(plan));
    mocks.share.mockImplementation(async (input: SharePlanShopping) => response(input));
    await mount(planner, plan);
    expect(shareButton().disabled).toBe(false);
    expect(optimizer().disabled).toBe(true);
    await share();
    expect(mocks.share).toHaveBeenCalledWith(
      expect.objectContaining({ planId: plan.id, expectedRevision: plan.revision }),
      'share-command-1',
    );
    expect(host.textContent).toContain('tủ lạnh hiện tại cho những bữa còn phía trước');
  });
  it.each(['stale_preferences', 'stale_catalog', 'catalog_authority_changed'] as const)(
    'blocks sharing if %s changed alongside elapsed history',
    async (reason) => {
      const plan = currentPlan(['planning_time_elapsed', reason]);
      await mount(model(family(plan)), plan);
      expect(shareButton().disabled).toBe(true);
      await act(async () => shareButton().click());
      expect(mocks.share).not.toHaveBeenCalled();
      expect(host.textContent).toContain('cần được kiểm tra lại');
    },
  );
  it('does not apply the family inventory exception to a non-family plan', async () => {
    const plan = currentPlan(['planning_time_elapsed', 'stale_inventory']);
    await mount(model(), plan);
    expect(shareButton().disabled).toBe(true);
    expect(mocks.share).not.toHaveBeenCalled();
  });
  it('requires the current family revision and current food preferences', async () => {
    const plan = currentPlan(['stale_inventory']);
    const familyPlan = family({ ...plan, revision: plan.revision + 1 });
    await mount(model(familyPlan), plan);
    expect(shareButton().disabled).toBe(true);
    const currentFamily = family(plan);
    currentFamily.familyPreferenceFreshness = 'requires_revalidation';
    await mount(model(currentFamily), plan);
    expect(shareButton().disabled).toBe(true);
  });
  it('uses the saved plan day when a device in another time zone has crossed midnight', async () => {
    const plan = currentPlan(['planning_time_elapsed']);
    const boundary = '2030-01-02T16:30:00.000Z';
    vi.mocked(Date.now).mockReturnValue(Date.parse(boundary));
    // Device date is Jan 3 in JST, while the saved Vietnamese calendar is still Jan 2.
    vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2030);
    vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(0);
    vi.spyOn(Date.prototype, 'getDate').mockReturnValue(3);
    plan.intent.utcOffsetMinutes = 420;
    plan.result.planningReference.utcOffsetMinutes = 420;
    plan.intent.slots.find((slot) => slot.mealType === 'dinner')!.time = '23:50';
    plan.freshness.checkedAt = boundary;
    mocks.share.mockImplementation(async (input: SharePlanShopping) => response(input));
    await mount(model(), plan);
    const dateInput = host.querySelector<HTMLInputElement>('input[type="date"]')!;
    expect(dateInput.value).toBe('2030-01-02');
    expect(dateInput.min).toBe('2030-01-02');
    expect(shareButton().disabled).toBe(false);
    await share();
    expect(mocks.share).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2030-01-02', endDate: '2030-01-04' }),
      'share-command-1',
    );
  });
  it('blocks a shared list when its calendar offset cannot produce a valid date', async () => {
    const plan = currentPlan(['planning_time_elapsed']);
    plan.result.planningReference.utcOffsetMinutes = Number.NaN;
    await mount(model(), plan);
    const dateInput = host.querySelector<HTMLInputElement>('input[type="date"]')!;
    expect(dateInput.value).toBe('');
    expect(dateInput.min).toBe('');
    expect(shareButton().disabled).toBe(true);
    await act(async () => shareButton().click());
    expect(mocks.share).not.toHaveBeenCalled();
  });
  it('explains the disabled shared list when no future meals remain', async () => {
    const plan = currentPlan(['planning_time_elapsed']);
    plan.freshness.checkedAt = '2030-01-03T00:00:00.000Z';
    await mount(model(family(plan)), plan);
    expect(shareButton().disabled).toBe(true);
    expect(host.textContent).toContain('Các bữa trong thực đơn này đã qua giờ dự kiến');
    expect(mocks.share).not.toHaveBeenCalled();
  });
});
