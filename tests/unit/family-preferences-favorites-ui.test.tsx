// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FamilyPreferencesSchema } from '../../packages/domain/src/family-preferences-api';
import { PlanningSettingsPage } from '../../src/web/pages/settings/PlanningSettingsPage';
import { PlannerSetup } from '../../src/web/features/planner/PlannerSetup';
import { hookPlan } from '../helpers/planner-hook-fixtures';
import { SaveRecipeButton } from '../../src/web/components/common/SaveRecipeButton';
import {
  useRecipeFavorites,
  favoritesKey,
} from '../../src/web/features/favorites/useRecipeFavorites';
import { familyPreferencesKey } from '../../src/web/features/family/useFamilyPreferences';
import { ApiError } from '../../src/web/services/http';
import { resetPrivateSession } from '../../src/web/lib/private-session';
import { useAuthStore } from '../../src/web/stores/useAuthStore';

const mocks = vi.hoisted(() => ({
  familyGet: vi.fn(),
  familySave: vi.fn(),
  legacyGenerate: vi.fn(),
  list: vi.fn(),
  state: vi.fn(),
  set: vi.fn(),
}));
vi.mock('../../src/web/services/family-preferences', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  familyPreferencesApi: { get: mocks.familyGet, save: mocks.familySave },
}));
vi.mock('../../src/web/services/meal-planning', () => ({
  mealPlanningApi: { generate: mocks.legacyGenerate },
}));
vi.mock('../../src/web/services/recipe-favorites', () => ({
  recipeFavoritesApi: { list: mocks.list, state: mocks.state, set: mocks.set },
}));
let host: HTMLDivElement, root: Root, client: QueryClient;
let favorites: ReturnType<typeof useRecipeFavorites>;
function Probe() {
  favorites = useRecipeFavorites();
  return (
    <p>
      {favorites.query.status} {favorites.mutation.status} {String(favorites.saved('recipe-a'))}
    </p>
  );
}
async function mount(node: ReactNode) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>{node}</MemoryRouter>
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
const button = (title: string) =>
  [...host.querySelectorAll('button')].find((element) => element.textContent?.trim() === title)!;
function owner(id: string) {
  localStorage.setItem('frigo_user_id', id);
  localStorage.setItem('frigo_household_id', 'household-a');
  useAuthStore.setState({ userId: id, householdId: 'household-a', isGuest: false });
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('VITE_MEAL_COMPOSITION_V2_ENABLED', 'true');
  localStorage.clear();
  sessionStorage.clear();
  resetPrivateSession();
  owner('user-a');
  vi.clearAllMocks();
  mocks.familyGet.mockResolvedValue({
    revision: 4,
    preferences: FamilyPreferencesSchema.parse({}),
  });
  mocks.familySave.mockImplementation(async (revision, preferences) => ({
    revision: revision + 1,
    preferences,
  }));
  mocks.list.mockResolvedValue({ entries: [] });
  mocks.state.mockResolvedValue({ recipeId: 'recipe-a', revision: 8, isSaved: false });
  mocks.set.mockResolvedValue({ recipeId: 'recipe-a', revision: 9, isSaved: true });
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
it('keeps a settings draft at its captured revision and requires adoption after a conflict', async () => {
  await mount(<PlanningSettingsPage />);
  await until(() => expect(host.textContent).toContain('Khẩu vị quen của nhà mình'));
  const south = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(
    (input) => input.closest('label')?.textContent === 'Miền Nam',
  );
  await act(async () => south?.click());
  await act(async () =>
    client.setQueryData(familyPreferencesKey(), {
      revision: 5,
      preferences: FamilyPreferencesSchema.parse({ preferredRegions: ['bac'] }),
    }),
  );
  mocks.familySave.mockRejectedValueOnce(
    new ApiError('http', 'HTTP 409: {"code":"REVISION_CONFLICT"}', 409),
  );
  await act(async () => button('Lưu thói quen').click());
  await until(() => expect(button('Lưu thói quen').disabled).toBe(true));
  expect(mocks.familySave).toHaveBeenCalledWith(
    4,
    expect.objectContaining({ preferredRegions: ['nam'] }),
  );
  mocks.familyGet.mockResolvedValue({
    revision: 5,
    preferences: FamilyPreferencesSchema.parse({ preferredRegions: ['bac'] }),
  });
  await act(async () => button('Tải lại thói quen mới nhất').click());
  await until(() => expect(button('Lưu thói quen').disabled).toBe(false));
  await act(async () => button('Lưu thói quen').click());
  await until(() => expect(host.textContent).toContain('Đã lưu thói quen'));
  expect(mocks.familySave).toHaveBeenLastCalledWith(
    5,
    expect.objectContaining({ preferredRegions: ['bac'] }),
  );
});
it('sends hard allergies and forbidden ingredients independently of soft dislikes', async () => {
  const preferences = FamilyPreferencesSchema.parse({
    allergens: ['peanut'],
    forbiddenIngredientIds: ['BEEF'],
    dislikedIngredientIds: ['ONION'],
  });
  mocks.familyGet.mockResolvedValue({ revision: 2, preferences });
  await mount(<PlanningSettingsPage />);
  await until(() => expect(button('Lưu thói quen')).toBeDefined());
  await act(async () => button('Lưu thói quen').click());
  await until(() => expect(mocks.familySave).toHaveBeenCalled());
  expect(mocks.familySave).toHaveBeenCalledWith(2, preferences);
});
it('offers a guest sign-in link and does not query or write favorites', async () => {
  useAuthStore.setState({ isGuest: true });
  await mount(<SaveRecipeButton recipeId="recipe-a" title="Cá kho" />);
  expect(host.querySelector('a')?.getAttribute('href')).toContain('/auth?mode=login&returnTo=');
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalled();
});
it('uses the latest tombstone revision when saving a previously removed recipe', async () => {
  await mount(<Probe />);
  await until(() => expect(favorites.query.isSuccess).toBe(true));
  await act(async () => {
    await favorites.mutation.mutateAsync({ recipeId: 'recipe-a', isSaved: true });
  });
  expect(mocks.set).toHaveBeenCalledWith('recipe-a', 8, true);
});
it('does not write an old favorite request after the account switches during its state read', async () => {
  let resolve!: (value: unknown) => void;
  mocks.state.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await mount(<Probe />);
  await until(() => expect(favorites.query.isSuccess).toBe(true));
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = favorites.mutation
      .mutateAsync({ recipeId: 'recipe-a', isSaved: true })
      .catch((error) => error);
  });
  await until(() => expect(mocks.state).toHaveBeenCalled());
  await act(async () => {
    resetPrivateSession();
    owner('user-b');
  });
  await act(async () => {
    resolve({ recipeId: 'recipe-a', revision: 8, isSaved: false });
    await pending;
  });
  expect(mocks.set).not.toHaveBeenCalled();
});
it('does not invalidate the new account favorites when an earlier write settles', async () => {
  let resolve!: (value: unknown) => void;
  mocks.set.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await mount(<Probe />);
  await until(() => expect(favorites.query.isSuccess).toBe(true));
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = favorites.mutation.mutateAsync({ recipeId: 'recipe-a', isSaved: true });
  });
  await until(() => expect(mocks.set).toHaveBeenCalled());
  await act(async () => {
    resetPrivateSession();
    owner('user-b');
  });
  await until(() => expect(favorites.query.isSuccess).toBe(true));
  const key = favoritesKey();
  await act(async () => {
    resolve({ recipeId: 'recipe-a', revision: 9, isSaved: true });
    await pending;
  });
  expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  expect(mocks.list).toHaveBeenCalledTimes(2);
});

it.each(['vi', 'en'] as const)(
  'keeps legacy setup truthful and uses V1 without loading family preferences (%s)',
  async (locale) => {
    vi.stubEnv('VITE_MEAL_COMPOSITION_V2_ENABLED', 'false');
    mocks.legacyGenerate.mockResolvedValue(hookPlan());
    const model = {
      busy: null,
      requestKey: vi.fn(() => 'legacy-retry-key'),
      retireRequestKey: vi.fn(),
      replacePlan: vi.fn(),
      perform: vi.fn(async (_label, operation, accept) => {
        const result = await operation();
        accept?.(result);
        return result;
      }),
    };
    await mount(<PlannerSetup model={model as never} locale={locale} />);
    expect(host.textContent).toContain(
      locale === 'vi' ? 'gợi ý một món chính cho mỗi bữa' : 'one main dish for each meal',
    );
    expect(host.textContent).not.toMatch(/gợi ý cả bữa|complete meal|Đủ món trước/);
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    expect(mocks.familyGet).not.toHaveBeenCalled();
    await act(async () =>
      host
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );
    await until(() => expect(mocks.legacyGenerate).toHaveBeenCalledTimes(1));
    expect(mocks.legacyGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        horizonDays: 7,
        defaultServings: 2,
        mode: 'shopping_allowed',
        slots: expect.any(Array),
      }),
      'legacy-retry-key',
    );
    const request = mocks.legacyGenerate.mock.calls[0][0];
    expect(request.slots).toHaveLength(7);
    expect(request.slots.every((slot: { mealType: string }) => slot.mealType === 'dinner')).toBe(
      true,
    );
    expect(model.replacePlan).toHaveBeenCalledWith(hookPlan());
    expect(mocks.familyGet).not.toHaveBeenCalled();
    expect(mocks.familySave).not.toHaveBeenCalled();
  },
);
