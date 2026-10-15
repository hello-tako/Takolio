// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FamilyPreferencesSchema } from '../../packages/domain/src/family-preferences-api';
import { FamilyMealPlanDtoSchema } from '../../packages/domain/src/family-meal-planning-api';
import {
  PlanCompositionsDtoSchema,
  type ComponentAssessment,
  type PickerItemDto,
  type PickerQuery,
} from '../../packages/domain/src/meal-composition-api';
import { hookPlan, hookPlanId, hookSlotId } from '../helpers/planner-hook-fixtures';
import { PlannerSetup } from '../../src/web/features/planner/PlannerSetup';
import { ComponentPicker } from '../../src/web/features/planner/ComponentPicker';
import { IngredientCoverage } from '../../src/web/features/planner/IngredientCoverage';
import { RecipeMealDialog } from '../../src/web/features/favorites/FavoritesCollection';
import { usePlanCompositions } from '../../src/web/features/planner/composition';
import { queryKeys } from '../../src/web/lib/queryKeys';
import { useAuthStore } from '../../src/web/stores/useAuthStore';
import { resetPrivateSession } from '../../src/web/lib/private-session';

const mocks = vi.hoisted(() => ({
  familyGet: vi.fn(),
  familySave: vi.fn(),
  current: vi.fn(),
  picker: vi.fn(),
  add: vi.fn(),
  swap: vi.fn(),
  state: vi.fn(),
  plan: vi.fn(),
}));
vi.mock('../../src/web/services/family-preferences', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  familyPreferencesApi: { get: mocks.familyGet, save: mocks.familySave },
}));
vi.mock('../../src/web/services/family-meal-planning', () => ({
  familyMealPlanningApi: { current: mocks.current },
}));
vi.mock('../../src/web/services/meal-composition', () => ({
  mealCompositionApi: { picker: mocks.picker, add: mocks.add, swap: mocks.swap, plan: mocks.plan },
}));
vi.mock('../../src/web/services/recipe-favorites', () => ({
  recipeFavoritesApi: { state: mocks.state },
}));

const date = '2030-01-02';
const context = { date, mealType: 'dinner' as const, servings: 2 };
const scope = { planId: hookPlanId, slotId: hookSlotId, revision: 1 };
const covered: ComponentAssessment = {
  status: 'covered',
  missingCount: 0,
  inventoryLineCount: 1,
  selectable: true,
  blockingReasons: [],
  requirements: [
    {
      ingredientId: 'BEEF',
      name: 'Thịt bò',
      unit: 'g',
      requiredQuantity: 400,
      coveredQuantity: 400,
      missingQuantity: 0,
      isOptional: false,
      status: 'satisfied',
    },
  ],
};
const recipe: PickerItemDto = {
  kind: 'recipe',
  id: 'recipe-a',
  title: 'Bò xào',
  roles: ['main'],
  cuisine: 'vietnamese',
  cookTimeMinutes: 20,
  difficulty: 'easy',
  constraintState: 'none_requested',
  assessment: covered,
};
function receipt(query: Partial<PickerQuery>, item: PickerItemDto = recipe) {
  return {
    schemaVersion: 1,
    items: [item],
    nextCursor: null,
    total: 1,
    scope: {
      planId: query.planId ?? hookPlanId,
      slotId: query.slotId ?? hookSlotId,
      revision: Number(query.revision ?? 1),
      ...context,
      mode: 'shopping_allowed',
      excludeComponentId: query.excludeComponentId ?? null,
      snapshotId: 'a'.repeat(32),
    },
  };
}
function compositions() {
  return PlanCompositionsDtoSchema.parse({
    schemaVersion: 1,
    planId: hookPlanId,
    planRevision: 1,
    compositions: [
      {
        slotId: hookSlotId,
        ...context,
        source: 'v2',
        mode: 'manual',
        missingRoles: [],
        recommendedRoles: [],
        warnings: [],
        components: [
          {
            id: 'main-existing',
            kind: 'recipe',
            role: 'main',
            ordinal: 0,
            locked: false,
            provenance: 'manual',
            recipeId: 'recipe-existing',
            simpleFoodId: null,
            title: 'Cá kho',
            permittedRoles: ['main'],
            cookable: true,
            resolvable: true,
            cookTimeMinutes: 30,
            createdRevision: 1,
            updatedRevision: 1,
            projection: { status: 'covered', missingCount: 0, inventoryLineCount: 1 },
          },
        ],
      },
    ],
  });
}
function family() {
  return FamilyMealPlanDtoSchema.parse({
    schemaVersion: 2,
    plan: hookPlan(),
    compositions: compositions(),
    policy: {
      mealStyle: 'family',
      preferredRegions: [],
      internationalMealsPerWeek: 0,
      internationalGeneratedMainCount: 0,
      lockedInternationalMainCount: 0,
      defaultCuisine: 'vietnamese',
      profileRevision: 1,
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
function owner(userId: string) {
  localStorage.setItem('frigo_user_id', userId);
  localStorage.setItem('frigo_household_id', 'house-a');
  useAuthStore.setState({ userId, householdId: 'house-a', isGuest: false });
}
let host: HTMLDivElement, root: Root, client: QueryClient;
function LocationProbe() {
  const location = useLocation();
  return (
    <output data-location>
      {location.pathname}
      {location.search}
    </output>
  );
}
async function mount(node: ReactNode, location = '/') {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[location]}>
          {node}
          <LocationProbe />
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
const button = (name: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) =>
      element.textContent?.trim() === name || element.getAttribute('aria-label') === name,
  )!;
const select = (label: string) =>
  [...host.querySelectorAll('label')]
    .find((element) => {
      const text =
        element.querySelector('.sr-only')?.textContent ??
        [...element.childNodes]
          .filter((node) => !(node instanceof HTMLSelectElement))
          .map((node) => node.textContent)
          .join('');
      return text.trim() === label;
    })!
    .querySelector('select')!;
async function value(element: HTMLInputElement | HTMLSelectElement, next: string) {
  const prototype =
    element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, next);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }),
    );
  });
}
async function submit() {
  await act(async () =>
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}
function setupModel() {
  return {
    busy: null,
    generate: vi.fn(async () => hookPlan()),
    createManual: vi.fn(async () => hookPlan()),
    requestKey: vi.fn(() => 'request-key'),
    retireRequestKey: vi.fn(),
    replacePlan: vi.fn(),
    perform: vi.fn(async (_label, operation, accept) => {
      const result = await operation();
      accept?.(result);
      return result;
    }),
  };
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
    revision: 1,
    preferences: FamilyPreferencesSchema.parse({ householdSize: 2 }),
  });
  mocks.familySave.mockImplementation(async (revision, preferences) => ({
    revision: revision + 1,
    preferences,
  }));
  mocks.current.mockResolvedValue({ plan: family() });
  mocks.picker.mockImplementation(async (query: PickerQuery) => receipt(query));
  mocks.add.mockResolvedValue({});
  mocks.swap.mockResolvedValue({});
  mocks.state.mockResolvedValue({ recipeId: 'recipe-a', revision: 1, isSaved: true });
  mocks.plan.mockResolvedValue(compositions());
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
  vi.restoreAllMocks();
});

it('summarizes saved meal habits without hiding the applied safety choices', async () => {
  mocks.familyGet.mockResolvedValue({
    revision: 2,
    preferences: FamilyPreferencesSchema.parse({
      householdSize: 3,
      preferredRegions: ['nam'],
      cookingDays: [1, 2, 3, 4, 5],
      cookingMealTypes: ['lunch', 'dinner'],
      allergens: ['peanut'],
      forbiddenIngredientIds: ['BEEF_SIRLOIN'],
    }),
  });
  await mount(<PlannerSetup model={setupModel() as never} locale="vi" />);
  await until(() => expect(host.querySelector('.family-plan-habits')).not.toBeNull());
  const habits = host.querySelector<HTMLDetailsElement>('.family-plan-habits')!;
  expect(habits.open).toBe(false);
  const summary = habits.querySelector('summary')!.textContent;
  expect(summary).toContain('Bữa trưa, Bữa tối');
  expect(summary).toContain('5 ngày/tuần');
  expect(summary).toContain('Miền Nam');
  expect(summary).toContain('bữa cơm gia đình');
  expect(summary).toContain('Có thể mua thêm');
  const notes = [...host.querySelectorAll('.planning-note')]
    .map((node) => node.textContent)
    .join(' ');
  expect(notes).toContain('đậu phộng');
  expect(notes).toContain('Thịt bò');
  await act(async () => {
    habits.open = true;
    habits.dispatchEvent(new Event('toggle'));
  });
  expect(habits.open).toBe(true);
  expect(select('Kiểu bữa thường nấu').value).toBe('family');
});

it('opens meal habits for the first setup and preserves generation from a saved collapsed profile', async () => {
  mocks.familyGet.mockResolvedValue({
    revision: 0,
    preferences: FamilyPreferencesSchema.parse({}),
  });
  const model = setupModel();
  await mount(<PlannerSetup model={model as never} locale="vi" />);
  await until(() =>
    expect(host.querySelector<HTMLDetailsElement>('.family-plan-habits')?.open).toBe(true),
  );
  await submit();
  expect(model.generate).toHaveBeenCalledTimes(1);
});

it('creates an authoritative empty calendar when the family chooses manual planning', async () => {
  const model = setupModel();
  await mount(<PlannerSetup model={model as never} locale="vi" />);
  await until(() => expect(host.querySelector('input[value="manual"]')).not.toBeNull());
  await act(async () => host.querySelector<HTMLInputElement>('input[value="manual"]')!.click());
  await submit();
  await until(() => expect(model.createManual).toHaveBeenCalledTimes(1));
  expect(model.generate).not.toHaveBeenCalled();
  expect(model.createManual).toHaveBeenCalledWith(
    expect.objectContaining({ defaultServings: 2 }),
    'request-key',
  );
  expect(model.requestKey).toHaveBeenCalledWith(
    expect.objectContaining({ selectionMode: 'manual' }),
  );
});

it('carries recipe servings into manual setup and opens the exact first meal after creating its calendar', async () => {
  const model = setupModel();
  await mount(
    <PlannerSetup model={model as never} locale="vi" />,
    '/planner/new?recipe=recipe-a&servings=6',
  );
  await until(() =>
    expect(host.querySelector<HTMLInputElement>('input[value="manual"]')?.checked).toBe(true),
  );
  const household = [...host.querySelectorAll<HTMLInputElement>('input[type="number"]')].find(
    (input) => input.max === '20',
  )!;
  expect(household.value).toBe('6');
  await submit();
  await until(() => expect(model.createManual).toHaveBeenCalledTimes(1));
  expect(model.createManual).toHaveBeenCalledWith(
    expect.objectContaining({ defaultServings: 6 }),
    'request-key',
  );
  expect(mocks.familySave).toHaveBeenCalledWith(1, expect.objectContaining({ householdSize: 6 }));
  expect(host.querySelector('[data-location]')?.textContent).toBe(
    `/planner/${hookPlanId}/meal/${encodeURIComponent(hookSlotId)}?recipe=recipe-a`,
  );
});

it.each(['/planner/new?recipe=recipe-a&servings=21', '/planner/new?servings=6'])(
  'keeps saved household size when the servings handoff is invalid or has no recipe: %s',
  async (location) => {
    await mount(<PlannerSetup model={setupModel() as never} locale="vi" />, location);
    await until(() => expect(host.querySelector('input[max="20"]')).not.toBeNull());
    expect(host.querySelector<HTMLInputElement>('input[max="20"]')!.value).toBe('2');
  },
);

it('adding a favorite preserves the existing main dish and targets the selected meal at its revision', async () => {
  await mount(
    <RecipeMealDialog
      entry={{ recipeId: 'recipe-a', title: 'Bò xào', roles: ['main'] }}
      onClose={() => {}}
    />,
  );
  await until(() => expect(button('Thêm vào bữa')?.disabled).toBe(false));
  expect(host.textContent).toContain('Món hiện có vẫn được giữ');
  expect(host.textContent).toContain('2 người');
  expect(host.textContent).toContain('Thịt bò');
  await submit();
  await until(() => expect(mocks.add).toHaveBeenCalledTimes(1));
  expect(mocks.add).toHaveBeenCalledWith(hookPlanId, hookSlotId, {
    revision: 1,
    target: { kind: 'recipe', recipeId: 'recipe-a' },
    role: 'main',
    locked: true,
  });
  expect(mocks.swap).not.toHaveBeenCalled();
  await until(() => expect(host.textContent).toContain('Xem bữa vừa chọn'));
  expect(host.querySelector('a')?.getAttribute('href')).toContain(encodeURIComponent(hookSlotId));
});

it.each([
  { customTimes: false, order: ['breakfast:0', 'lunch:2', 'lunch:10', 'dinner:0'] },
  { customTimes: true, order: ['dinner:0', 'lunch:2', 'lunch:10', 'breakfast:0'] },
])('orders destination meals by date, scheduled time and numeric sequence: $customTimes', async ({ customTimes, order }) => {
  const snapshot = family();
  const nextDate = '2030-01-03';
  snapshot.plan.intent.slots = [
    { date, mealType: 'dinner', sequence: 0, ...(customTimes ? { time: '10:00' } : {}) },
    { date, mealType: 'lunch', sequence: 10, ...(customTimes ? { time: '11:00' } : {}) },
    { date: nextDate, mealType: 'breakfast', sequence: 0 },
    { date, mealType: 'breakfast', sequence: 0, ...(customTimes ? { time: '15:00' } : {}) },
    { date, mealType: 'lunch', sequence: 2, ...(customTimes ? { time: '11:00' } : {}) },
  ];
  snapshot.compositions.compositions = snapshot.plan.intent.slots.map((slot) => ({
    ...compositions().compositions[0],
    slotId: `${slot.date}:${slot.mealType}:${slot.sequence}`,
    date: slot.date,
    mealType: slot.mealType,
  }));
  mocks.current.mockResolvedValue({ plan: snapshot });
  mocks.picker.mockImplementation(async (query: PickerQuery) => {
    const meal = snapshot.compositions.compositions.find((entry) => entry.slotId === query.slotId)!;
    const page = receipt(query);
    return { ...page, scope: { ...page.scope, date: meal.date, mealType: meal.mealType, servings: meal.servings } };
  });
  await mount(
    <RecipeMealDialog
      entry={{ recipeId: 'recipe-a', title: 'Bò xào', roles: ['main'] }}
      onClose={() => {}}
    />,
  );
  await until(() => expect(button('Thêm vào bữa')?.disabled).toBe(false));
  const expected = [...order.map((entry) => `${date}:${entry}`), `${nextDate}:breakfast:0`];
  expect([...select('Bữa').options].map((option) => option.value)).toEqual(expected);
  expect(select('Bữa').value).toBe(expected[0]);
  expect(mocks.picker).toHaveBeenLastCalledWith(expect.objectContaining({ slotId: expected[0] }));
  await submit();
  await until(() => expect(mocks.add).toHaveBeenCalledTimes(1));
  expect(mocks.add).toHaveBeenCalledWith(hookPlanId, expected[0], expect.objectContaining({ revision: 1 }));
});

it('replacing a favorite requires explicit placement and assesses inventory with the old dish excluded', async () => {
  await mount(
    <RecipeMealDialog
      entry={{ recipeId: 'recipe-a', title: 'Bò xào', roles: ['main'] }}
      onClose={() => {}}
    />,
  );
  await until(() => expect(button('Thêm vào bữa')?.disabled).toBe(false));
  await act(async () => host.querySelector<HTMLInputElement>('input[value="replace"]')!.click());
  await until(() =>
    expect(mocks.picker).toHaveBeenLastCalledWith(
      expect.objectContaining({ excludeComponentId: 'main-existing' }),
    ),
  );
  await until(() => expect(button('Thay món trong bữa')?.disabled).toBe(false));
  expect(host.textContent).toContain('Món này sẽ thay “Cá kho”');
  await submit();
  await until(() => expect(mocks.swap).toHaveBeenCalledTimes(1));
  expect(mocks.swap).toHaveBeenCalledWith(hookPlanId, hookSlotId, 'main-existing', {
    revision: 1,
    target: { kind: 'recipe', recipeId: 'recipe-a' },
    role: 'main',
    locked: true,
  });
  expect(mocks.add).not.toHaveBeenCalled();
});

it('places an unsaved detail recipe through canonical roles and gates concurrent submission', async () => {
  let resolve!: (value: unknown) => void;
  mocks.add.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  mocks.picker.mockImplementation(async (query: PickerQuery) =>
    receipt(query, { ...recipe, roles: ['soup'] }),
  );
  await mount(
    <RecipeMealDialog
      entry={{ recipeId: 'recipe-a', title: 'Canh' }}
      requireSaved={false}
      onClose={() => {}}
    />,
  );
  await until(() => expect(button('Thêm vào bữa')?.disabled).toBe(false));
  expect(select('Nhóm món').value).toBe('soup');
  await act(async () => {
    const event = () => new Event('submit', { bubbles: true, cancelable: true });
    host.querySelector('form')!.dispatchEvent(event());
    host.querySelector('form')!.dispatchEvent(event());
  });
  expect(mocks.add).toHaveBeenCalledTimes(1);
  expect(mocks.state).not.toHaveBeenCalled();
  expect(mocks.add).toHaveBeenCalledWith(
    hookPlanId,
    hookSlotId,
    expect.objectContaining({ role: 'soup' }),
  );
  await act(async () => resolve({}));
});

it('prevents favorite placement after the owner switches during the saved-state check', async () => {
  let resolve!: (value: unknown) => void;
  mocks.state.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await mount(
    <RecipeMealDialog
      entry={{ recipeId: 'recipe-a', title: 'Bò xào', roles: ['main'] }}
      onClose={() => {}}
    />,
  );
  await until(() => expect(button('Thêm vào bữa')?.disabled).toBe(false));
  await submit();
  await until(() => expect(mocks.state).toHaveBeenCalledTimes(1));
  await act(async () => {
    resetPrivateSession();
    owner('user-b');
    resolve({ isSaved: true });
  });
  expect(mocks.add).not.toHaveBeenCalled();
  expect(mocks.swap).not.toHaveBeenCalled();
});

it('offers an exact recipe and servings handoff when no future meal exists', async () => {
  mocks.current.mockResolvedValue({ plan: null });
  await mount(
    <RecipeMealDialog
      entry={{ recipeId: 'recipe-a', title: 'Bò xào' }}
      requireSaved={false}
      defaultServings={6}
      onClose={() => {}}
    />,
  );
  await until(() =>
    expect(host.querySelector('a')?.getAttribute('href')).toBe(
      '/planner/new?recipe=recipe-a&servings=6',
    ),
  );
  expect(mocks.picker).not.toHaveBeenCalled();
});

it('does not read plans or write recipe placement for a guest', async () => {
  useAuthStore.setState({ isGuest: true });
  await mount(
    <RecipeMealDialog
      entry={{ recipeId: 'recipe-a', title: 'Bò xào' }}
      requireSaved={false}
      onClose={() => {}}
    />,
  );
  expect(host.textContent).toContain('Đăng nhập để lên thực đơn');
  expect(mocks.current).not.toHaveBeenCalled();
  expect(mocks.picker).not.toHaveBeenCalled();
  expect(mocks.add).not.toHaveBeenCalled();
});

it('rejects an assessment receipt for a different household serving count', async () => {
  mocks.picker.mockImplementation(async (query: PickerQuery) => {
    const page = receipt(query);
    return { ...page, scope: { ...page.scope, servings: 9 } };
  });
  await mount(
    <RecipeMealDialog
      entry={{ recipeId: 'recipe-a', title: 'Bò xào', roles: ['main'] }}
      onClose={() => {}}
    />,
  );
  await until(() => expect(host.textContent).toContain('Chưa xác nhận được món này'));
  expect(button('Thêm vào bữa').disabled).toBe(true);
  expect(host.textContent).not.toContain('400 g');
  await submit();
  expect(mocks.add).not.toHaveBeenCalled();
});

it('reassesses the actual role before a multi-role picker item can be selected', async () => {
  let resolveSide!: (value: unknown) => void;
  const multi = { ...recipe, roles: ['main', 'side'] as PickerItemDto['roles'] };
  mocks.picker.mockImplementation((query: PickerQuery) =>
    query.role === 'side'
      ? new Promise((resolve) => {
          resolveSide = resolve;
        })
      : Promise.resolve(receipt(query, multi)),
  );
  const choose = vi.fn();
  await mount(
    <ComponentPicker
      locale="en"
      context={context}
      scope={scope}
      busy={false}
      onChoose={choose}
      onClose={() => {}}
    />,
  );
  await until(() => expect(button('Choose: Bò xào')).toBeDefined());
  expect(button('Choose: Bò xào').disabled).toBe(true);
  await value(select('Role: Bò xào'), 'side');
  await until(() =>
    expect(mocks.picker).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'side' })),
  );
  expect(button('Choose: Bò xào')).toBeUndefined();
  await act(async () =>
    resolveSide(
      receipt(
        { ...scope, revision: '1', role: 'side' },
        {
          ...multi,
          assessment: { ...covered, selectable: false, blockingReasons: ['ROLE_NOT_PERMITTED'] },
        },
      ),
    ),
  );
  await until(() => expect(button('Choose: Bò xào')).toBeDefined());
  expect(button('Choose: Bò xào').disabled).toBe(true);
  expect(choose).not.toHaveBeenCalled();
});

it('makes plain rice accessible from the staple path without a cuisine filter', async () => {
  const rice: PickerItemDto = {
    ...recipe,
    kind: 'simple_food',
    id: 'sf-steamed-rice',
    title: 'Cơm trắng',
    roles: ['staple', 'simple_food'],
    cuisine: null,
  };
  mocks.picker.mockImplementation(async (query: PickerQuery) => receipt(query, rice));
  const choose = vi.fn();
  await mount(
    <ComponentPicker
      locale="vi"
      initialRole="staple"
      context={context}
      scope={scope}
      busy={false}
      onChoose={choose}
      onClose={() => {}}
    />,
  );
  await until(() => expect(button('Chọn: Cơm trắng')).toBeDefined());
  expect(mocks.picker).toHaveBeenCalledWith(
    expect.objectContaining({ role: 'staple', cuisine: undefined }),
  );
  await act(async () => button('Chọn: Cơm trắng').click());
  expect(choose).toHaveBeenCalledWith(rice, 'staple');
});

it('rejects picker quantities for the wrong date or meal context', async () => {
  mocks.picker.mockImplementation(async (query: PickerQuery) => {
    const page = receipt(query);
    return { ...page, scope: { ...page.scope, mealType: 'lunch' } };
  });
  await mount(
    <ComponentPicker
      locale="en"
      context={context}
      scope={scope}
      busy={false}
      onChoose={vi.fn()}
      onClose={() => {}}
    />,
  );
  await until(() => expect(host.textContent).toContain('Meal quantities are unconfirmed'));
  expect(button('Choose: Bò xào')).toBeUndefined();
});

it('keeps unknown shortage quantities explicit and avoids claiming zero extra ingredients', async () => {
  await mount(
    <IngredientCoverage
      locale="vi"
      assessment={{
        ...covered,
        status: 'needs_shopping',
        missingCount: 0,
        requirements: [
          {
            ...covered.requirements[0],
            requiredQuantity: 400,
            coveredQuantity: null,
            missingQuantity: null,
            status: 'unresolved',
          },
        ],
      }}
    />,
  );
  expect(host.textContent).toContain('Thịt bò');
  expect(host.textContent).toContain('400 g');
  expect(host.textContent).toContain('Chưa rõ');
  expect(host.textContent).not.toContain('Cần mua thêm 0');
});

it('refreshes unassessed family seed data through the opt-in composition read', async () => {
  client.setQueryData(queryKeys.mealPlanningCompositions(hookPlanId, 1), compositions(), {
    updatedAt: 0,
  });
  function Probe() {
    usePlanCompositions(hookPlan());
    return <p>Loaded composition hook</p>;
  }
  await mount(<Probe />);
  await until(() => expect(mocks.plan).toHaveBeenCalledWith(hookPlanId, true));
});

it('shows a recipe handoff as a selected dish without exposing a catalog ID in the search field', async () => {
  await mount(
    <ComponentPicker
      locale="vi"
      initialRecipeId="recipe-a"
      context={context}
      scope={scope}
      busy={false}
      onChoose={vi.fn()}
      onClose={() => {}}
    />,
  );
  await until(() => expect(button('Chọn: Bò xào')).toBeDefined());
  expect(mocks.picker).toHaveBeenCalledWith(expect.objectContaining({ q: 'recipe-a' }));
  expect(host.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('');
  expect(host.textContent).toContain('Món bạn vừa chọn');
  await act(async () => button('Xem các món khác').click());
  await until(() =>
    expect(mocks.picker).toHaveBeenLastCalledWith(expect.objectContaining({ q: undefined })),
  );
  expect(host.textContent).not.toContain('Món bạn vừa chọn');
});

it('offers parent plan recovery when a picker request finds a newer revision', async () => {
  const { ApiError } = await import('../../src/web/services/http');
  mocks.picker.mockRejectedValue(
    new ApiError('http', 'HTTP 409: {"code":"PLAN_REVISION_CONFLICT"}', 409),
  );
  const reloadPlan = vi.fn();
  await mount(
    <ComponentPicker
      locale="vi"
      context={context}
      scope={scope}
      busy={false}
      onChoose={vi.fn()}
      onClose={() => {}}
      onReloadPlan={reloadPlan}
    />,
  );
  await until(() => expect(button('Tải thực đơn mới nhất')).toBeDefined());
  await act(async () => button('Tải thực đơn mới nhất').click());
  expect(reloadPlan).toHaveBeenCalledTimes(1);
  expect(mocks.picker).toHaveBeenCalledTimes(1);
});

it.each([false, true])('uses the plan offset to skip elapsed same-day meals and preserve calendar handoff: allElapsed=%s', async allElapsed => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2030-01-02T03:00:00Z'));
  const snapshot = family();
  snapshot.plan.intent.utcOffsetMinutes = 420;
  snapshot.plan.result.planningReference.utcOffsetMinutes = 420;
  snapshot.plan.intent.slots = [
    { date, mealType: 'breakfast', sequence: 0 },
    // A custom late dinner is already elapsed in this plan's zone, not the device zone.
    { date, mealType: 'dinner', sequence: 0, time: '09:00' },
    ...(!allElapsed ? [{ date, mealType: 'lunch' as const, sequence: 0, time: '11:00' }] : []),
  ];
  snapshot.compositions.compositions = snapshot.plan.intent.slots.map(slot => ({
    ...compositions().compositions[0], slotId: `${slot.date}:${slot.mealType}:${slot.sequence}`,
    date: slot.date, mealType: slot.mealType,
  }));
  mocks.current.mockResolvedValue({ plan: snapshot });
  mocks.picker.mockImplementation(async (query: PickerQuery) => {
    const page = receipt(query);
    return { ...page, scope: { ...page.scope, mealType: 'lunch' } };
  });
  await mount(<RecipeMealDialog entry={{ recipeId: 'recipe-a', title: 'Bò xào', roles: ['main'] }}
    requireSaved={false} defaultServings={6} onClose={() => {}} />);
  if (allElapsed) {
    await until(() => expect(host.querySelector('a')?.getAttribute('href')).toBe('/planner/new?recipe=recipe-a&servings=6'));
    expect(mocks.picker).not.toHaveBeenCalled();
  } else {
    await until(() => expect(button('Thêm vào bữa')?.disabled).toBe(false));
    expect([...select('Bữa').options].map(option => option.value)).toEqual([`${date}:lunch:0`]);
    expect(mocks.picker).toHaveBeenLastCalledWith(expect.objectContaining({ slotId: `${date}:lunch:0` }));
  }
  expect(mocks.add).not.toHaveBeenCalled();
  expect(mocks.swap).not.toHaveBeenCalled();
});
