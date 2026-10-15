// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FamilyMealPlanDtoSchema } from '../../packages/domain/src/family-meal-planning-api';
import { usePlanner } from '../../src/web/features/planner/usePlanner';
import { useAuthStore } from '../../src/web/stores/useAuthStore';
import { queryKeys } from '../../src/web/lib/queryKeys';
import { resetPrivateSession } from '../../src/web/lib/private-session';
import { hookPlan, hookPlanId } from '../helpers/planner-hook-fixtures';
import { homeComposition } from '../helpers/ui02-fixtures';

const fetchMock = vi.fn();
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
let root: Root;
let host: HTMLDivElement;
let client: QueryClient;
let model: ReturnType<typeof usePlanner>;
function family(revision = 1) {
  const plan = hookPlan(revision);
  return FamilyMealPlanDtoSchema.parse({
    schemaVersion: 2,
    plan,
    compositions: homeComposition(plan, ['Gà kho', 'Rau luộc', 'Canh rau', 'Cơm trắng']),
    policy: {
      mealStyle: 'family',
      preferredRegions: [],
      internationalMealsPerWeek: 0,
      internationalGeneratedMainCount: 0,
      lockedInternationalMainCount: 0,
      defaultCuisine: 'vietnamese',
      profileRevision: 0,
    },
    diagnostics: {
      completeMealCount: 1,
      partialMealCount: 0,
      unplannedMealCount: 0,
      reasons: [],
      searchLimited: false,
    },
    familyPreferenceFreshness: 'fresh',
  });
}
function Probe({ id }: { id?: string }) {
  model = usePlanner(id);
  return (
    <p>
      {model.query.status}: {model.plan?.revision ?? 'loading'}
    </p>
  );
}
async function mount(id?: string) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe id={id} />
      </QueryClientProvider>,
    ),
  );
  for (let index = 0; index < 100; index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    if (!model.query.isPending) break;
  }
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('VITE_MEAL_COMPOSITION_V2_ENABLED', 'true');
  localStorage.clear();
  sessionStorage.clear();
  resetPrivateSession();
  localStorage.setItem('frigo_user_id', 'user-a');
  localStorage.setItem('frigo_household_id', 'house-a');
  useAuthStore.setState({ userId: 'user-a', householdId: 'house-a', isGuest: false });
  fetchMock.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('loads V2 current with all composition dishes cached at the accepted revision', async () => {
  const envelope = family();
  fetchMock.mockResolvedValue(response({ plan: envelope }));
  await mount();
  expect(model.plan).toEqual(envelope.plan);
  expect(model.familyPlan).toEqual(envelope);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/v2/meal-planning/plans/current');
  expect(client.getQueryData(queryKeys.mealPlanningCompositions(hookPlanId, 1))).toEqual(
    envelope.compositions,
  );
});
it('restores a legacy current plan when the V2 endpoint has no family metadata', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ plan: null }))
    .mockResolvedValueOnce(response({ plan: hookPlan() }));
  await mount();
  expect(model.plan?.id).toBe(hookPlanId);
  expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
    '/api/v2/meal-planning/plans/current',
    '/api/v1/meal-planning/plans/current',
  ]);
});
it('falls back for the typed legacy metadata failure', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ code: 'FAMILY_PLAN_METADATA_MISSING' }, 409))
    .mockResolvedValueOnce(response(hookPlan()));
  await mount(hookPlanId);
  expect(model.plan?.id).toBe(hookPlanId);
  expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
    `/api/v2/meal-planning/plans/${hookPlanId}`,
    `/api/v1/meal-planning/plans/${hookPlanId}`,
  ]);
});
it('keeps generic V2 conflicts explicit instead of falling back', async () => {
  fetchMock.mockResolvedValueOnce(response({ code: 'FAMILY_SCOPE_CONFLICT' }, 409));
  await mount(hookPlanId);
  expect(model.query.isError).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(model.plan).toBeUndefined();
});
it('refreshing after a component change accepts the new V2 plan and composition together', async () => {
  fetchMock.mockResolvedValueOnce(response(family()));
  await mount(hookPlanId);
  fetchMock.mockResolvedValueOnce(response(family(2)));
  await act(async () => {
    await model.perform('refresh', () => model.loadPlan(hookPlanId), model.replacePlan);
  });
  expect(model.plan?.revision).toBe(2);
  expect(model.familyPlan).toEqual(family(2));
  expect(client.getQueryData(queryKeys.mealPlanningCompositions(hookPlanId, 2))).toEqual(
    family(2).compositions,
  );
});

it('keeps V2 generation unavailability explicit instead of creating a one-dish V1 plan', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ plan: null }))
    .mockResolvedValueOnce(response({ plan: null }));
  await mount();
  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce(response({ code: 'NOT_FOUND' }, 404));
  await expect(model.generate(hookPlan().intent, 'family-request')).rejects.toMatchObject({
    status: 404,
  });
  expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(['/api/v2/meal-planning/plans']);
});
