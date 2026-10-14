// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Recipe, RecipeScoringContext } from '@frigo/recipes';
import { RecipeDetailPage } from '../../src/web/pages/RecipeDetailPage';
import { InventoryPage } from '../../src/web/pages/InventoryPage';
import { useCookingStore } from '../../src/web/stores/useCookingStore';
import { CookingModePage } from '../../src/web/pages/CookingModePage';

const mocks = vi.hoisted(() => ({ inventory: vi.fn(), recipe: vi.fn(), shopping: vi.fn() }));
vi.mock('../../src/web/services/api', () => ({
  api: {
    getInventory: mocks.inventory,
    getRecipeById: mocks.recipe,
    addShoppingItem: mocks.shopping,
  },
  ApiError: class ApiError extends Error {},
}));
vi.mock('../../src/web/components/common/TopBar', () => ({ TopBar: () => null }));

const recipe: Recipe = {
  id: 'eggs',
  slug: 'eggs',
  title: 'Trứng cho bữa tối',
  description: 'Món thử nghiệm',
  cuisine: 'vietnamese',
  cookTimeMinutes: 10,
  servings: 2,
  difficulty: 'easy',
  imageUrl: '',
  tags: [],
  steps: [{ stepNumber: 1, instruction: 'Nấu chín' }],
  ingredients: [
    { ingredientId: 'CHICKEN_EGG', name: 'Trứng', requiredQuantity: 4, unit: 'piece' },
    { ingredientId: 'PORK_BELLY', name: 'Thịt', requiredQuantity: 500, unit: 'g' },
  ],
};
const stock: Array<
  RecipeScoringContext['inventory'][number] & { name: string; category: string; version: number }
> = [
  {
    id: 'eggs',
    ingredientId: 'CHICKEN_EGG',
    name: 'Trứng',
    quantity: 2,
    unit: 'piece',
    freshness: 'fresh',
    category: 'egg',
    version: 1,
  },
  {
    id: 'pork',
    ingredientId: 'PORK_BELLY',
    name: 'Thịt',
    quantity: 1,
    unit: 'pack',
    freshness: 'fresh',
    category: 'meat',
    version: 1,
  },
];
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  useCookingStore.getState().resetCooking();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.inventory.mockResolvedValue(stock);
  mocks.recipe.mockResolvedValue({
    recipe,
    match: { matchPercentage: 100, availableIngredientCount: 2 },
  });
  mocks.shopping.mockResolvedValue({ id: 'shopping' });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.unstubAllGlobals();
});
async function mount(node: ReactNode, path: string, cookingNode: ReactNode = <CookingLocation />) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]} useTransitions={true}>
          <Routes>
            <Route path="/recipes/:slug" element={node} />
            <Route path="/inventory" element={node} />
            <Route path="/cook/:slug" element={cookingNode} />
            <Route path="/cooking/:id" element={node} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
}
async function until(assertion: () => void) {
  const deadline = Date.now() + 1500;
  for (;;) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
    }
  }
}
function CookingLocation() {
  const location = useLocation();
  return <output data-cooking-location>{location.pathname}{location.search}</output>;
}
function RecipeNavigation() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/recipes/other-eggs')}>Món tiếp theo</button>;
}
function button(name: string) {
  const result = [...container.querySelectorAll('button')].find(
    (item) => (item.getAttribute('aria-label') ?? item.textContent?.trim()) === name,
  );
  expect(result, name).toBeDefined();
  return result!;
}

describe('Rebuilt recipe preparation', () => {
  it('shows a shortfall, sends only 2 missing eggs, and refuses to guess pack-to-gram shortage', async () => {
    await mount(<RecipeDetailPage />, '/recipes/eggs');
    await until(() => expect(container.textContent).toContain('Thiếu 2 cái'));
    expect(container.querySelector('[data-availability="partial"]')).not.toBeNull();
    expect(container.querySelector('[data-availability="unresolved"]')?.textContent).toContain(
      'Cần kiểm tra',
    );
    expect(container.querySelector('[aria-label="Mua phần thiếu: Thịt"]')).toBeNull();
    await act(async () => button('Mua phần thiếu: Trứng').click());
    await until(() =>
      expect(mocks.shopping).toHaveBeenCalledExactlyOnceWith({
        name: 'Trứng',
        quantity: 2,
        unit: 'piece',
        ingredientId: 'CHICKEN_EGG',
        sourceRecipeId: 'eggs',
        sourceRecipeTitle: recipe.title,
      }),
    );
    await until(() => expect(button('Mua phần thiếu: Trứng').disabled).toBe(true));
  });
  it('hydrates the direct cooking link with the meal servings', async () => {
    await mount(<CookingModePage />, '/cooking/eggs?servings=1');
    await until(() => expect(useCookingStore.getState().activeRecipe?.servings).toBe(1));
    expect(useCookingStore.getState().activeRecipe?.ingredients[0].requiredQuantity).toBe(2);
    expect(useCookingStore.getState().stockSnapshot).toEqual(stock);
  });
  it('keeps a pending cooking confirmation intact when a different serving count is requested', async () => {
    useCookingStore.getState().startCooking(recipe, stock);
    const previous = useCookingStore.getState().activeRecipe;
    useCookingStore.setState({
      attempt: { commandId: 'pending-cook', servings: 2, deductions: [], status: 'uncertain', error: null },
    });
    await mount(<CookingModePage />, '/cooking/eggs?servings=1');
    await until(() => expect(container.textContent).toContain('Cần kiểm tra lần nấu trước'));
    expect(useCookingStore.getState().activeRecipe).toBe(previous);
    expect(useCookingStore.getState().attempt?.commandId).toBe('pending-cook');
    expect(mocks.recipe).not.toHaveBeenCalled();
    expect(mocks.inventory).not.toHaveBeenCalled();
  });
  it('starts cooking with selected servings and restores them after reloading the cooking link', async () => {
    await mount(<RecipeDetailPage />, '/recipes/eggs?servings=1');
    await until(() => expect(button('Bắt đầu nấu (10 phút)').disabled).toBe(false));
    await act(async () => button('Bắt đầu nấu (10 phút)').click());
    const cookingLocation = container.querySelector('[data-cooking-location]')?.textContent ?? '';
    expect(cookingLocation).toBe('/cook/eggs?servings=1');
    expect(useCookingStore.getState().activeRecipe).toMatchObject({ servings: 1 });
    expect(
      useCookingStore.getState().activeRecipe?.ingredients.map((line) => line.requiredQuantity),
    ).toEqual([2, 250]);
    expect(useCookingStore.getState().stockSnapshot).toEqual(stock);
    expect(stock[0].quantity).toBe(2);
    expect(mocks.shopping).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    root = createRoot(container);
    client.clear();
    useCookingStore.getState().resetCooking();
    await mount(<CookingModePage />, cookingLocation, <CookingModePage />);
    await until(() => expect(useCookingStore.getState().activeRecipe?.servings).toBe(1));
    expect(useCookingStore.getState().activeRecipe?.ingredients.map(line => line.requiredQuantity)).toEqual([2, 250]);
    expect(useCookingStore.getState().stockSnapshot).toEqual(stock);
  });
  it('keeps servings from the recipe URL and recalculates shopping shortfall after changing them', async () => {
    await mount(<RecipeDetailPage />, '/recipes/eggs?servings=1');
    await until(() => expect(container.querySelector('select')?.value).toBe('1'));
    expect(container.querySelector('[data-availability="satisfied"]')?.textContent).toContain(
      'Đủ lượng',
    );
    expect(container.querySelector('[aria-label="Mua phần thiếu: Trứng"]')).toBeNull();
    const select = container.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      select.value = '4';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await until(() => expect(container.textContent).toContain('Thiếu 6 cái'));
    await act(async () => button('Mua phần thiếu: Trứng').click());
    await until(() =>
      expect(mocks.shopping).toHaveBeenCalledWith(expect.objectContaining({ quantity: 6 })),
    );
    expect(recipe.ingredients[0].requiredQuantity).toBe(4);
  });
  it.each(['before navigation', 'after navigation'])(
    'keeps shopping confirmation with the source recipe when it resolves %s',
    async (resolution) => {
      let resolveShopping!: (value: { id: string }) => void;
      mocks.shopping.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveShopping = resolve;
          }),
      );
      mocks.recipe.mockImplementation(async (key: string) => ({
        recipe: { ...recipe, id: key, slug: key, title: key },
        match: {},
      }));
      await mount(
        <>
          <RecipeDetailPage />
          <RecipeNavigation />
        </>,
        '/recipes/eggs',
      );
      await until(() => expect(container.textContent).toContain('Thiếu 2 cái'));
      await act(async () => button('Mua phần thiếu: Trứng').click());
      await until(() => expect(mocks.shopping).toHaveBeenCalledTimes(1));
      if (resolution === 'before navigation') {
        await act(async () => resolveShopping({ id: 'shopping' }));
        await until(() => expect(button('Mua phần thiếu: Trứng').disabled).toBe(true));
      }
      await act(async () => button('Món tiếp theo').click());
      await until(() =>
        expect(container.querySelector('.recipe-intro h1')?.textContent).toBe('other-eggs'),
      );
      if (resolution === 'after navigation') {
        await act(async () => resolveShopping({ id: 'shopping' }));
      }
      await until(() => expect(button('Mua phần thiếu: Trứng').disabled).toBe(false));
      expect(mocks.shopping).toHaveBeenCalledExactlyOnceWith({
        name: 'Trứng',
        quantity: 2,
        unit: 'piece',
        ingredientId: 'CHICKEN_EGG',
        sourceRecipeId: 'eggs',
        sourceRecipeTitle: 'eggs',
      });
    },
  );
  it('does not offer shopping or cooking before inventory has loaded', async () => {
    mocks.inventory.mockReturnValue(new Promise(() => {}));
    await mount(<RecipeDetailPage />, '/recipes/eggs');
    await until(() => expect(container.textContent).toContain('Chưa có dữ liệu tồn kho'));
    expect(container.querySelector('[aria-label^="Mua phần thiếu:"]')).toBeNull();
    expect(button('Bắt đầu nấu (10 phút)').disabled).toBe(true);
    expect(container.textContent).not.toContain('Thiếu 4');
  });
  it('adds the combined shortage for repeated ingredient lines once', async () => {
    mocks.recipe.mockResolvedValue({
      recipe: { ...recipe, ingredients: [recipe.ingredients[0], recipe.ingredients[0]] },
      match: {},
    });
    await mount(<RecipeDetailPage />, '/recipes/eggs');
    await until(() => expect(container.textContent).toContain('Thiếu 2 cái'));
    await act(async () => button('Mua phần thiếu: Trứng').click());
    await until(() =>
      expect(mocks.shopping).toHaveBeenCalledWith(expect.objectContaining({ quantity: 6 })),
    );
  });
});

describe('Inventory search recovery', () => {
  it('keeps stock and distinguishes no matching search from an empty fridge', async () => {
    await mount(<InventoryPage />, '/inventory');
    await until(() =>
      expect(container.querySelectorAll('[data-testid="inventory-row"]')).toHaveLength(2),
    );
    const input = container.querySelector<HTMLInputElement>(
      '[aria-label="Tìm nguyên liệu trong tủ"]',
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        'không có',
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).toContain('Không tìm thấy nguyên liệu phù hợp');
    expect(container.textContent).not.toContain('Tủ lạnh đang trống');
    expect(container.textContent).not.toContain('Chụp tủ lạnh ngay');
    await act(async () => button('Xóa tìm kiếm và bộ lọc').click());
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
    expect(container.querySelectorAll('[data-testid="inventory-row"]')).toHaveLength(2);
    expect(mocks.inventory).toHaveBeenCalledTimes(1);
  });
  it('still offers scanning when the inventory itself is empty', async () => {
    mocks.inventory.mockResolvedValue([]);
    await mount(<InventoryPage />, '/inventory');
    await until(() => expect(container.textContent).toContain('Tủ lạnh đang trống'));
    expect(button('Chụp tủ lạnh ngay')).toBeDefined();
    expect(container.textContent).not.toContain('Không tìm thấy nguyên liệu phù hợp');
  });
});
