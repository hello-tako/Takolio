import { discoveryFixture } from '../helpers/ui03-fixtures';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { MealPlan, MealSlotItem } from '@frigo/domain';
import { ALL_RECIPES, evaluateRecipeMatch } from '@frigo/recipes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const route = vi.hoisted(() => ({ params: { slug: 'test-recipe' } as Record<string, string> }));

vi.mock('react-router-dom', async (importOriginal) => {
  const original = (await importOriginal()) as typeof import('react-router-dom');
  return {
    ...original,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/recipes/test-recipe', search: '' }),
    useParams: () => route.params,
  };
});

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

const TODAY = '2026-09-08';
const recipe = { ...ALL_RECIPES[0], id: 'test-recipe', slug: 'test-recipe', title: 'REAL_RECIPE_FROM_QUERY' };
const slot = (slotType: MealSlotItem['slotType'], status: MealSlotItem['status'] = 'PLANNED'): MealSlotItem => ({
  id: slotType,
  dayId: 'day-1',
  planId: 'plan-1',
  slotType,
  status,
  date: TODAY,
  dayOfWeek: 2,
  recipe: { ...recipe, title: `REAL_${slotType}_FROM_WEEK` },
  servings: 2,
  source: 'AUTO',
  availabilityPercent: 100,
  incrementalCostVnd: 0,
  rescuedExpiringIngredients: [],
  badges: [],
  ingredients: [],
});
const plan = (slots = [slot('breakfast'), slot('lunch'), slot('dinner')]): MealPlan => ({
  id: 'plan-1',
  householdId: 'house-a',
  startDate: TODAY,
  endDate: TODAY,
  status: 'ACTIVE',
  days: [{ id: 'day-1', planId: 'plan-1', date: TODAY, dayOfWeek: 2, dayNameVi: 'Thứ 3', dayType: 'cooking', slots }],
  budget: { targetVnd: 900000, estimatedMinVnd: 310000, estimatedMaxVnd: 321000, status: 'UNDER', displayText: '' },
  utilization: { utilizationPercent: 0, plannedItemsCount: 0, totalUsableItemsCount: 0, highPriorityUsedCount: 0 },
  wasteRisk: { level: 'LOW', expiringItemsCount: 0, rescuedItemsCount: 0, displayText: '' },
  shoppingItems: [],
  priorities: [],
  shoppingFrequency: 'once',
  createdAt: TODAY,
  updatedAt: TODAY,
});

async function loadUi() {
  const { QueryClientProvider } = await import('@tanstack/react-query');
  const { MemoryRouter } = await import('react-router-dom');
  const { queryClient } = await import('../../src/web/lib/query-client');
  const { queryKeys } = await import('../../src/web/lib/queryKeys');
  const { ApiError } = await import('../../src/web/services/http');
  queryClient.setDefaultOptions({ queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity } });
  return {
    queryClient,
    queryKeys,
    ApiError,
    render: (page: ReactElement) =>
      renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{page}</MemoryRouter>
        </QueryClientProvider>,
      ),
    failQuery: async (queryKey: readonly unknown[], error: Error) => {
      await expect(queryClient.fetchQuery({ queryKey, queryFn: () => Promise.reject(error) })).rejects.toBe(error);
    },
  };
}

beforeEach(() => {
  route.params = { slug: 'test-recipe' };
  vi.resetModules();
  vi.stubEnv('VITE_MEAL_PLANNER_ENABLED', 'false');
  vi.stubEnv('VITE_MEAL_COMPOSITION_V2_ENABLED', 'false');
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 8, 8));
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  localStorage.setItem('frigo_user_id', 'user-a');
  localStorage.setItem('frigo_household_id', 'house-a');
  localStorage.setItem('frigo_display_name', 'Integration User');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('time-aware Home meal selection', () => {
  it.each([
    [8, 0, 'breakfast'],
    [10, 59, 'breakfast'],
    [11, 0, 'lunch'],
    [15, 59, 'lunch'],
    [16, 0, 'dinner'],
    [23, 59, 'dinner'],
  ])('chooses the current meal at %i:%i rather than always preferring dinner', async (hour, minute, expected) => {
    const { findTodayMeal } = await import('../../src/web/lib/home-meal');
    expect(findTodayMeal(plan(), new Date(2026, 8, 8, hour, minute))?.slotType).toBe(expected);
  });

  it.each(['COOKED', 'SKIPPED', 'EATING_OUT', 'FLEXIBLE'] as const)(
    'skips a %s current slot and selects the next cookable meal',
    async (status) => {
      const { findTodayMeal } = await import('../../src/web/lib/home-meal');
      expect(findTodayMeal(plan([slot('dinner'), slot('breakfast', status), slot('lunch')]))?.slotType).toBe('lunch');
    },
  );

  it('accepts leftovers, skips missing recipes, and never falls back to an elapsed meal', async () => {
    const { findTodayMeal } = await import('../../src/web/lib/home-meal');
    expect(findTodayMeal(plan([slot('breakfast', 'LEFTOVER')]))?.status).toBe('LEFTOVER');
    expect(findTodayMeal(plan([{ ...slot('breakfast'), recipe: undefined }, slot('lunch')]))?.slotType).toBe('lunch');
    expect(findTodayMeal(plan([slot('breakfast')]), new Date(2026, 8, 8, 17))).toBeNull();
  });

  it('returns no meal for an absent plan, different local date, or completed day', async () => {
    const { findTodayMeal } = await import('../../src/web/lib/home-meal');
    expect(findTodayMeal(null)).toBeNull();
    expect(findTodayMeal(plan(), new Date(2026, 8, 9, 8))).toBeNull();
    expect(findTodayMeal(plan([slot('breakfast', 'COOKED'), slot('lunch', 'COOKED'), slot('dinner', 'COOKED')]))).toBeNull();
  });
});

describe('real vNext Home (C01) data rendered through the shared QueryClient', () => {
  it('renders honest empty states without fake meal, budget, or expiry items', async () => {
    const ui = await loadUi();
    const { C01HomePilot } = await import('../../src/web/vnext/screens/C01HomePilot');
    ui.queryClient.setQueryData(ui.queryKeys.inventory(), []);
    ui.queryClient.setQueryData(ui.queryKeys.currentWeekPlan(), null);
    ui.queryClient.setQueryData(ui.queryKeys.recipeDiscovery({ pageSize: 3 }), discoveryFixture([], { pageSize: 3 }));
    const html = ui.render(<C01HomePilot />);
    expect(html).toContain('Chưa có nguyên liệu nào trong tủ lạnh.');
    for (const fake of ['Thịt kho trứng', '560k', '800k', '5/7', '71%', 'Cà chua']) expect(html).not.toContain(fake);
  });

  it('qualifies estimated expiry on C01HomePilot and keeps ESTIMATED vs KNOWN distinct', async () => {
    const ui = await loadUi();
    const { C01HomePilot } = await import('../../src/web/vnext/screens/C01HomePilot');
    ui.queryClient.setQueryData(ui.queryKeys.currentWeekPlan(), null);
    ui.queryClient.setQueryData(ui.queryKeys.inventory(), [
      {
        id: 'est',
        name: 'ESTIMATED_ITEM',
        freshness: 'use_soon',
        expiryKind: 'ESTIMATED',
        expiryDate: '2026-09-10',
        estimatedExpiryDate: '2026-09-10',
        quantity: 1,
        unit: 'bó',
      },
      {
        id: 'known',
        name: 'KNOWN_ITEM',
        freshness: 'use_soon',
        expiryKind: 'KNOWN',
        expiryDate: '2026-09-10',
        quantity: 2,
        unit: 'hộp',
      },
    ]);
    ui.queryClient.setQueryData(ui.queryKeys.recipeDiscovery({ pageSize: 3 }), discoveryFixture([], { pageSize: 3 }));
    const html = ui.render(<C01HomePilot />);
    expect(html).toContain('ESTIMATED_ITEM');
    expect(html).toContain('Ước tính còn 2 ngày');
    expect(html).toContain('KNOWN_ITEM');
    expect(html).toContain('Còn 2 ngày');
  });

  it('keeps successful widgets visible while a failed Home query offers retry', async () => {
    const ui = await loadUi();
    const { C01HomePilot } = await import('../../src/web/vnext/screens/C01HomePilot');
    ui.queryClient.setQueryData(ui.queryKeys.inventory(), [
      { id: 'i', name: 'REAL_SURVIVING_WIDGET', freshness: 'expiring', quantity: 1, unit: 'quả' },
    ]);
    ui.queryClient.setQueryData(ui.queryKeys.recipeDiscovery({ pageSize: 3 }), discoveryFixture([], { pageSize: 3 }));
    await ui.failQuery(ui.queryKeys.currentWeekPlan(), new ui.ApiError('http', 'internal failure', 500));
    const html = ui.render(<C01HomePilot />);
    expect(html).toContain('REAL_SURVIVING_WIDGET');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Thử lại');
    expect(html).not.toContain('internal failure');
  });

  it('renders recommendations from server-state data rather than a hardcoded featured recipe', async () => {
    const ui = await loadUi();
    const { C01HomePilot } = await import('../../src/web/vnext/screens/C01HomePilot');
    ui.queryClient.setQueryData(ui.queryKeys.inventory(), []);
    ui.queryClient.setQueryData(ui.queryKeys.currentWeekPlan(), null);
    ui.queryClient.setQueryData(
      ui.queryKeys.recipeDiscovery({ pageSize: 3 }),
      discoveryFixture([evaluateRecipeMatch(recipe, { inventory: [] })], { pageSize: 3 }),
    );
    const html = ui.render(<C01HomePilot />);
    expect(html).toContain(recipe.title);
  });
});

describe('vNext C18RecipeDetailPilot loading, not-found, error, and success remain distinct', () => {
  it('renders a real pending skeleton state before recipe data arrives', async () => {
    const ui = await loadUi();
    const { C18RecipeDetailPilot } = await import('../../src/web/vnext/screens/C18RecipeDetailPilot');
    expect(ui.render(<C18RecipeDetailPilot />)).toContain('Đang tải công thức món ăn');
  });

  it('does not spin forever when a successful response has no recipe', async () => {
    const ui = await loadUi();
    const { C18RecipeDetailPilot } = await import('../../src/web/vnext/screens/C18RecipeDetailPilot');
    ui.queryClient.setQueryData(ui.queryKeys.recipe('test-recipe'), { recipe: null });
    const html = ui.render(<C18RecipeDetailPilot />);
    expect(html).toContain('Công thức này không tồn tại');
    expect(html).not.toContain('Đang tải công thức món ăn');
  });

  it.each([404, 500])('renders a distinct %i response instead of an infinite spinner', async (status) => {
    const ui = await loadUi();
    const { C18RecipeDetailPilot } = await import('../../src/web/vnext/screens/C18RecipeDetailPilot');
    await ui.failQuery(ui.queryKeys.recipe('test-recipe'), new ui.ApiError('http', 'private server details', status));
    const html = ui.render(<C18RecipeDetailPilot />);
    expect(html).not.toContain('Đang tải công thức món ăn');
    if (status === 404) expect(html).toContain('Công thức này không tồn tại');
    else {
      expect(html).toContain('role="alert"');
      expect(html).toContain('Thử lại');
    }
    expect(html).not.toContain('private server details');
  });

  it('renders a successfully loaded recipe from the secure query cache', async () => {
    const ui = await loadUi();
    const { C18RecipeDetailPilot } = await import('../../src/web/vnext/screens/C18RecipeDetailPilot');
    ui.queryClient.setQueryData(ui.queryKeys.recipe('test-recipe'), { recipe });
    ui.queryClient.setQueryData(ui.queryKeys.inventory(), []);
    const html = ui.render(<C18RecipeDetailPilot />);
    expect(html).toContain(recipe.title);
    expect(html).toContain('Bắt đầu nấu');
  });
});

describe('vNext C30NotificationsVNext honesty', () => {
  it('renders no fabricated alerts when the server list is empty', async () => {
    const ui = await loadUi();
    const { C30NotificationsVNext } = await import('../../src/web/vnext/screens/AccountAndSystemPages');
    ui.queryClient.setQueryData(ui.queryKeys.notifications(), []);
    const html = ui.render(<C30NotificationsVNext />);
    expect(html).toContain('Căn bếp đang êm ả');
  });

  it('renders notification content only when returned by the real query contract', async () => {
    const ui = await loadUi();
    const { C30NotificationsVNext } = await import('../../src/web/vnext/screens/AccountAndSystemPages');
    ui.queryClient.setQueryData(ui.queryKeys.notifications(), [
      {
        id: 'notification-a',
        type: 'expiring_soon',
        title: 'REAL_NOTIFICATION',
        message: 'REAL_MESSAGE',
        createdAt: `${TODAY}T07:00:00`,
      },
    ]);
    const html = ui.render(<C30NotificationsVNext />);
    expect(html).toContain('REAL_NOTIFICATION');
    expect(html).toContain('REAL_MESSAGE');
    expect(html).not.toContain('Căn bếp đang êm ả');
  });

  it('surfaces notification errors rather than pretending the list is empty', async () => {
    const ui = await loadUi();
    const { C30NotificationsVNext } = await import('../../src/web/vnext/screens/AccountAndSystemPages');
    await ui.failQuery(ui.queryKeys.notifications(), new ui.ApiError('http', 'failure', 500));
    const html = ui.render(<C30NotificationsVNext />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Thử lại');
    expect(html).not.toContain('Căn bếp đang êm ả');
  });
});

describe('scan data honesty', () => {
  it('offers real capture/upload without a production mock-scan entry point', async () => {
    const { ScanPage } = await import('../../src/web/pages/ScanPage');
    const html = renderToStaticMarkup(<ScanPage />);
    expect(html).toContain('type="file"');
    expect(html).toContain('accept="image/*"');
    expect(html).not.toContain('Thử quét ảnh mẫu');
    expect(readFileSync('src/web/pages/ScanPage.tsx', 'utf8')).not.toContain('mock-fridge-base64');
    expect(readFileSync('src/web/components/scan/CameraViewfinder.tsx', 'utf8')).not.toContain('ảnh mẫu');
  });
});

describe('secure application-shell architecture', () => {
  const source = ts.createSourceFile('App.tsx', readFileSync('src/web/App.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function descendants(node: ts.Node): ts.Node[] {
    const result: ts.Node[] = [];
    node.forEachChild((child) => {
      result.push(child, ...descendants(child));
    });
    return result;
  }
  const nodes = descendants(source);
  const element = (name: string) =>
    nodes.filter(ts.isJsxElement).find((node) => node.openingElement.tagName.getText(source) === name)!;
  function ancestors(node: ts.Node): string[] {
    const names: string[] = [];
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isJsxElement(parent)) names.unshift(parent.openingElement.tagName.getText(source));
    }
    return names;
  }

  it('keeps SessionBoundary inside the shared QueryClient provider/router and outside Suspense/routes', () => {
    expect(ancestors(element('SessionBoundary'))).toEqual(['QueryClientProvider', 'BrowserRouter', 'AppErrorBoundary']);
    expect(ancestors(element('Routes'))).toEqual([
      'QueryClientProvider',
      'BrowserRouter',
      'AppErrorBoundary',
      'SessionBoundary',
      'Suspense',
    ]);
    expect(element('QueryClientProvider').openingElement.attributes.getText(source)).toContain('client={queryClient}');
    expect(source.text).toMatch(/import\s*\{\s*queryClient\s*\}\s*from\s*['"]\.\/lib\/query-client['"]/);
    expect(element('Suspense').openingElement.attributes.getText(source)).toContain('RouteFallback');
  });

  it('resets routes and the error boundary for both account and household changes', () => {
    for (const name of ['Routes', 'AppErrorBoundary']) {
      const key = element(name)
        .openingElement.attributes.properties.filter(ts.isJsxAttribute)
        .find((attribute) => attribute.name.getText(source) === 'key');
      expect(key).toBeDefined();
      expect(key!.getText(source)).toContain('${userId}');
      expect(key!.getText(source)).toContain('${householdId}');
    }
    expect(source.text).toContain('getDerivedStateFromError');
    expect(source.text).toContain('role="alert"');
  });

  it('lazy-loads every route page instead of eagerly importing the page tree', () => {
    const lazyPages = nodes
      .filter(ts.isVariableDeclaration)
      .filter(
        (node) =>
          node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(source) === 'lazy',
      )
      .map((node) => node.name.getText(source));
    const routedPages = nodes
      .filter(ts.isJsxSelfClosingElement)
      .map((node) => node.tagName.getText(source))
      .filter((name) => name.endsWith('Page'));
    expect(routedPages.length).toBeGreaterThan(20);
    expect(lazyPages).toEqual(expect.arrayContaining(routedPages));
    const eagerPageImports = source.statements
      .filter(ts.isImportDeclaration)
      .filter((node) => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.startsWith('./pages/'));
    expect(eagerPageImports).toHaveLength(0);
  });

  it.each([
    ['user-a', 'house-a'],
    ['user-b', 'house-a'],
    ['user-a', 'house-b'],
  ])('withholds private child markup while %s/%s awaits server verification', async (userId, householdId) => {
    localStorage.setItem('frigo_user_id', userId);
    localStorage.setItem('frigo_household_id', householdId);
    const { SessionBoundary } = await import('../../src/web/components/common/SessionBoundary');
    const html = renderToStaticMarkup(
      <SessionBoundary>
        <div>PRIVATE_CHILD_MUST_WAIT</div>
      </SessionBoundary>,
    );
    expect(html).toContain('Đang kiểm tra phiên');
    expect(html).not.toContain('PRIVATE_CHILD_MUST_WAIT');
  });
});
