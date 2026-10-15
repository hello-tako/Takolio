// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlannerPage } from '../../src/web/pages/PlannerPage';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { familyMealPlanningApi } from '../../src/web/services/family-meal-planning';
import { familyPreferencesApi } from '../../src/web/services/family-preferences';
import { mealPlanningApi } from '../../src/web/services/meal-planning';
import { mealCompositionApi } from '../../src/web/services/meal-composition';
import { FamilyPreferencesSchema } from '../../packages/domain/src/family-preferences-api';
import { FamilyMealPlanDtoSchema } from '../../packages/domain/src/family-meal-planning-api';
import { usePlanner } from '../../src/web/features/planner/usePlanner';
import { plannerErrorMessage } from '../../src/web/features/planner/presentation';
import { useAuthStore } from '../../src/web/stores/useAuthStore';
import { resetPrivateSession } from '../../src/web/lib/private-session';
import { queryKeys } from '../../src/web/lib/queryKeys';
import { hookPlan, hookPlanId } from '../helpers/planner-hook-fixtures';
import { homeComposition } from '../helpers/ui02-fixtures';

const deadline = 30_000;
const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let host: HTMLDivElement | undefined;
let client: QueryClient;
let model: ReturnType<typeof usePlanner>;
function Probe() {
  model = usePlanner(undefined, false);
  return <output>{model.busy ?? 'idle'}</output>;
}
function family() {
  const plan = hookPlan();
  return FamilyMealPlanDtoSchema.parse({
    schemaVersion: 2, plan,
    compositions: homeComposition(plan, ['Gà kho', 'Rau luộc', 'Canh rau', 'Cơm trắng']),
    policy: { mealStyle: 'family', preferredRegions: [], internationalMealsPerWeek: 0,
      internationalGeneratedMainCount: 0, lockedInternationalMainCount: 0,
      defaultCuisine: 'vietnamese', profileRevision: 0 },
    diagnostics: { completeMealCount: 1, partialMealCount: 0, unplannedMealCount: 0,
      reasons: [], searchLimited: false },
    familyPreferenceFreshness: 'fresh',
  });
}
const response = (data: unknown) => new Response(JSON.stringify(data), {
  headers: { 'Content-Type': 'application/json' },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
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
  fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  client.clear();
  host?.remove();
  host = undefined;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it.each([
  ['V2 generation', () => familyMealPlanningApi.generate(hookPlan().intent, 'deadline-request')],
  ['V2 manual draft', () => familyMealPlanningApi.createManual(hookPlan().intent, 'deadline-request')],
  ['V2 current read', () => familyMealPlanningApi.current()],
  ['V1 generation', () => mealPlanningApi.generate(hookPlan().intent, 'deadline-request')],
  ['composition read', () => mealCompositionApi.plan(hookPlanId)],
  ['family preference read', () => familyPreferencesApi.get()],
  ['family preference save', () => familyPreferencesApi.save(0, FamilyPreferencesSchema.parse({}))],
] as const)('%s stops waiting when the transport never settles', async (_label, request) => {
  let failure: unknown;
  void request().catch((error: unknown) => { failure = error; });
  await vi.advanceTimersByTimeAsync(deadline + 1);
  expect(failure).toMatchObject({ code: 'PLAN_REQUEST_TIMEOUT', status: 408, retryable: true });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
});
it.each([200, 500])('bounds an HTTP %i response whose body never finishes', async (status) => {
  const stream = new ReadableStream<Uint8Array>();
  fetchMock.mockResolvedValue(new Response(stream, { status }));
  let failure: unknown;
  void familyMealPlanningApi.get(hookPlanId).catch((error: unknown) => { failure = error; });
  await vi.advanceTimersByTimeAsync(deadline + 1);
  expect(failure).toMatchObject({ code: 'PLAN_REQUEST_TIMEOUT' });
});
it('unlocks generation, retains its exact retry key and ignores a late timed-out response', async () => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>));
  const intent = hookPlan().intent;
  const key = model.requestKey(intent);
  const late = deferred<Response>();
  fetchMock.mockReturnValueOnce(late.promise);
  await act(async () => {
    void model.perform('generate', () => model.generate(intent, key), (plan) => {
      model.replacePlan(plan);
      model.retireRequestKey(intent);
    });
  });
  expect(model.busy).toBe('generate');
  await act(async () => { await vi.advanceTimersByTimeAsync(deadline + 1); });
  expect(model.busy).toBeNull();
  expect(model.error).toMatchObject({ code: 'PLAN_REQUEST_TIMEOUT' });
  expect(model.requestKey(intent)).toBe(key);
  expect(plannerErrorMessage(model.error, 'vi')).toContain('chưa phản hồi');
  expect(plannerErrorMessage(model.error, 'en')).toContain('has not responded');
  await act(async () => { late.resolve(response(family())); });
  expect(client.getQueryData(queryKeys.currentMealPlanningPlan())).toBeUndefined();
  expect(model.error).toMatchObject({ code: 'PLAN_REQUEST_TIMEOUT' });
  fetchMock.mockResolvedValueOnce(response(family()));
  await act(async () => {
    await model.perform('generate', () => model.generate(intent, model.requestKey(intent)), (plan) => {
      model.replacePlan(plan);
      model.retireRequestKey(intent);
    });
  });
  expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('Idempotency-Key')).toBe(key);
  expect(fetchMock.mock.calls[1][1]?.body).toBe(fetchMock.mock.calls[0][1]?.body);
  expect(model.requestKey(intent)).not.toBe(key);
  expect(model.error).toBeNull();
  expect(client.getQueryData(queryKeys.currentMealPlanningPlan())).toEqual(hookPlan());
});

it('the actual family setup replaces endless loading with retry and current-plan recovery', async () => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  fetchMock.mockImplementation((url) => String(url).endsWith('/family-preferences')
    ? Promise.resolve(response({ revision: 0, preferences: FamilyPreferencesSchema.parse({}) }))
    : new Promise<Response>(() => {}));
  await act(async () => root!.render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/planner/new']}>
        <Routes><Route path="/planner/new" element={<PlannerPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  ));
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  const form = host.querySelector('form');
  expect(form).not.toBeNull();
  await act(async () => { form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(deadline + 1); });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('chưa phản hồi');
  const retry = host.querySelector<HTMLButtonElement>('button[type="submit"]');
  expect(retry?.disabled).toBe(false);
  expect(retry?.textContent).toContain('Thử lại');
  expect(host.querySelector('a[href="/planner"]')?.textContent).toContain('Kiểm tra thực đơn hiện tại');
  const sent = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/meal-planning/plans'));
  expect(sent).toHaveLength(1);
  await act(async () => { form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  const retried = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/meal-planning/plans'));
  expect(retried).toHaveLength(2);
  expect(retried[1][1]?.body).toBe(sent[0][1]?.body);
  expect(new Headers(retried[1][1]?.headers).get('Idempotency-Key'))
    .toBe(new Headers(sent[0][1]?.headers).get('Idempotency-Key'));
});
it('an aborted late unauthorized response cannot clear the current private session', async () => {
  const late = deferred<Response>();
  fetchMock.mockReturnValueOnce(late.promise);
  void familyMealPlanningApi.current().catch(() => {});
  await vi.advanceTimersByTimeAsync(deadline + 1);
  late.resolve(new Response('{"code":"UNAUTHORIZED"}', { status: 401 }));
  await vi.advanceTimersByTimeAsync(1);
  expect(localStorage.getItem('frigo_user_id')).toBe('user-a');
  expect(localStorage.getItem('frigo_household_id')).toBe('house-a');
});
it.each(['same draft', 'different profile'] as const)('an explicit retry reconciles a timed-out committed preference save: %s', async (latestKind) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const original = FamilyPreferencesSchema.parse({});
  let persisted = original;
  let revision = 0;
  let writes = 0;
  let creations = 0;
  fetchMock.mockImplementation((url, init) => {
    if (String(url).endsWith('/family-preferences')) {
      if (init?.method === 'PUT') {
        writes++;
        persisted = JSON.parse(String(init.body)).preferences;
        revision++;
        return new Promise<Response>(() => {});
      }
      return Promise.resolve(response({ revision, preferences: persisted }));
    }
    creations++;
    return new Promise<Response>(() => {});
  });
  await act(async () => root!.render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/planner/new']}>
        <Routes><Route path="/planner/new" element={<PlannerPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  ));
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  const servings = host.querySelector<HTMLInputElement>('input[type="number"][max="20"]')!;
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setValue.call(servings, '3');
    servings.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const form = host.querySelector('form')!;
  await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(writes).toBe(1);
  expect(persisted.householdSize).toBe(3);
  await act(async () => { await vi.advanceTimersByTimeAsync(deadline + 1); });
  expect(creations).toBe(0);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('chưa phản hồi');
  if (latestKind === 'different profile') persisted = { ...persisted, householdSize: 4 };
  await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  expect(writes).toBe(1);
  if (latestKind === 'same draft') {
    expect(creations).toBe(1);
    expect(client.getQueryData(queryKeys.planningPreferences().concat('family'))).toMatchObject({ revision: 1 });
  } else {
    expect(creations).toBe(0);
    expect(host.textContent).toContain('Thói quen đã đổi');
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(persisted.householdSize).toBe(4);
  }
});
it('changes the generation key when family preferences change after a timeout', async () => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const calls: Array<{ key: string | null; body: string | null }> = [];
  fetchMock.mockImplementation((url, init) => {
    if (String(url).endsWith('/family-preferences')) return Promise.resolve(response({ revision: 0, preferences: FamilyPreferencesSchema.parse({}) }));
    calls.push({ key: new Headers(init?.headers).get('Idempotency-Key'), body: init?.body ? String(init.body) : null });
    return new Promise<Response>(() => {});
  });
  await act(async () => root!.render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/planner/new']}>
        <Routes><Route path="/planner/new" element={<PlannerPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  ));
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  const form = host.querySelector('form')!;
  await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(deadline + 1); });
  const region = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
    .find((input) => input.parentElement?.textContent?.includes('Miền Nam'))!;
  await act(async () => { region.click(); });
  await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(calls).toHaveLength(2);
  expect(calls[0].key).toBeTruthy();
  expect(calls[1].key).toBeTruthy();
  expect(calls[1].key).not.toBe(calls[0].key);
  expect(calls[1].body).toBe(calls[0].body);
});
