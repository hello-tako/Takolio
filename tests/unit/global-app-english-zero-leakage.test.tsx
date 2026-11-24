// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider, resetActiveUiLocaleForTests } from '../../src/web/i18n';
import { useAuthStore } from '../../src/web/stores/useAuthStore';
import { VNextAuthFlow } from '../../src/web/vnext/screens/AuthFlowPages';
import { VNextOnboardingFlow } from '../../src/web/vnext/screens/OnboardingFlowPages';
import { C01HomePilot } from '../../src/web/vnext/screens/C01HomePilot';
import { C03InventoryPilot } from '../../src/web/vnext/screens/C03InventoryPilot';
import { C15RecipesDiscoveryVNext } from '../../src/web/vnext/screens/RecipesAndCookPages';
import { C18RecipeDetailPilot } from '../../src/web/vnext/screens/C18RecipeDetailPilot';
import { C23PlannerPilot } from '../../src/web/vnext/screens/C23PlannerPilot';
import { ShoppingPage } from '../../src/web/pages/ShoppingPage';
import {
  C30NotificationsVNext,
  U01ProfileHubVNext,
  U06HouseholdHonestPage,
  U07U08PlusReadOnlyWrapper,
  U09U10PrivacyAndDataRightsPage,
} from '../../src/web/vnext/screens/AccountAndSystemPages';
import { SettingsPage } from '../../src/web/pages/SettingsPage';
import { FoodPreferencesPage } from '../../src/web/pages/settings/FoodPreferencesPage';
import { PlanningSettingsPage } from '../../src/web/pages/settings/PlanningSettingsPage';
import { NotificationPreferencesPage } from '../../src/web/pages/settings/NotificationPreferencesPage';
import { ScanPage } from '../../src/web/pages/ScanPage';
import { C02QuickSearchPage } from '../../src/web/vnext/screens/FridgeAndScanWrappers';
import { M09PricingPage } from '../../src/web/vnext/screens/PublicSitePages';
import { fetchJson } from '../../src/web/services/http';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Vietnamese-exclusive diacritics (excludes plain â/ê/ô shared with French)
const VIETNAMESE_DIACRITIC_RE =
  /[ăđơưĂĐƠƯảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/u;

const mountedCleanups: Array<() => void> = [];

function findVietnameseSnippets(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => VIETNAMESE_DIACRITIC_RE.test(w));
  return Array.from(new Set(words)).slice(0, 12);
}

function mountInEnglishApp(ui: React.ReactElement, initialEntry = '/') {
  window.localStorage.setItem('takolio_locale', 'en');
  window.localStorage.setItem('takolio.ui_locale', 'en');
  window.localStorage.setItem('frigo_planner_locale', 'en');

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>
        </LocaleProvider>
      </QueryClientProvider>,
    );
  });
  const unmount = () => {
    act(() => {
      root.unmount();
    });
    container.remove();
  };
  mountedCleanups.push(unmount);
  return { container, unmount };
}

async function flushAsync(ticks = 8) {
  for (let i = 0; i < ticks; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const SAMPLE_VI_RECIPE = {
  id: 'rec-thit-kho',
  slug: 'thit-kho-trung',
  title: 'Thịt kho trứng',
  description: 'Món thịt ba chỉ kho trứng vịt đậm đà đưa cơm cho bữa tối gia đình.',
  cuisine: 'vietnamese',
  category: 'mon_kho',
  region: 'nam',
  difficulty: 'easy',
  cookTimeMinutes: 35,
  servings: 4,
  tags: ['gia_dinh'],
  ingredients: [
    { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ', requiredQuantity: 400, baseQuantity: 400, quantity: 400, unit: 'g', isOptional: false },
    { ingredientId: 'EGG', name: 'Trứng vịt', requiredQuantity: 4, baseQuantity: 4, quantity: 4, unit: 'piece', isOptional: false },
    { ingredientId: 'FISH_SAUCE', name: 'Nước mắm', requiredQuantity: 30, baseQuantity: 30, quantity: 30, unit: 'ml', isOptional: false },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Ướp thịt ba chỉ với nước mắm và hành tím băm 15 phút.', timerMinutes: 15 },
    { stepNumber: 2, instruction: 'Kho lửa nhỏ 25 phút cho thịt mềm và thấm vị.', timerMinutes: 25 },
  ],
};

const SAMPLE_INVENTORY = [
  {
    id: 'lot-1',
    householdId: 'hh-en-1',
    ingredientId: 'PORK_BELLY',
    name: 'Thịt ba chỉ',
    quantity: 400,
    unit: 'g',
    storageZone: 'fridge',
    status: 'expiring_soon',
    expiryDate: '2026-11-25',
    displayCategory: 'meat_seafood',
    version: 1,
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
  },
  {
    id: 'lot-2',
    householdId: 'hh-en-1',
    ingredientId: 'WATER_SPINACH',
    name: 'Rau muống',
    quantity: 1,
    unit: 'bó',
    storageZone: 'fridge',
    status: 'fresh',
    expiryDate: '2026-11-28',
    displayCategory: 'produce',
    version: 1,
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
  },
];

function mockEnglishApiFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const jsonResp = (data: unknown) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    if (url.includes('/api/v1/inventory')) return jsonResp({ items: SAMPLE_INVENTORY });
    if (url.includes('/api/v1/recommendations')) {
      return jsonResp({
        recommendations: [
          {
            recipe: SAMPLE_VI_RECIPE,
            score: 92,
            matchedIngredients: ['PORK_BELLY'],
            missingIngredients: ['EGG'],
            canCookNow: false,
            expiringIngredientsUsed: ['PORK_BELLY'],
          },
        ],
      });
    }
    if (url.includes('/api/v1/recipes/rec-thit-kho')) {
      return jsonResp({
        recipe: SAMPLE_VI_RECIPE,
        match: {
          recipe: SAMPLE_VI_RECIPE,
          score: 92,
          matchedIngredients: ['PORK_BELLY'],
          missingIngredients: ['EGG'],
          canCookNow: false,
          expiringIngredientsUsed: ['PORK_BELLY'],
        },
      });
    }
    if (url.includes('/api/v1/recipes')) return jsonResp({ recipes: [SAMPLE_VI_RECIPE] });
    if (url.includes('/api/v1/shopping')) {
      return jsonResp({
        items: [
          {
            id: 'shop-1',
            ingredientId: 'EGG',
            name: 'Trứng vịt',
            quantity: 6,
            unit: 'quả',
            isChecked: false,
            source: 'recipe',
            recipeTitle: 'Thịt kho trứng',
            displayCategory: 'dairy_eggs',
          },
        ],
        demandReviews: [],
      });
    }
    if (url.includes('/api/v1/week') || url.includes('/api/v1/planner')) {
      return jsonResp({ plan: null, plans: [] });
    }
    if (url.includes('/api/v1/billing/global/plans')) {
      return jsonResp({
        dodoConfigured: true,
        dodoEnvironment: 'live',
        catalog: {
          countryCode: 'US',
          provider: 'dodo_mor',
          merchantOfRecord: 'Dodo Payments',
          currency: 'USD',
          minorDigits: 2,
          requiresEuWithdrawalWaiver: false,
          requiresTokushohoDisclosure: false,
          tokushohoUrl: null,
          plans: [
            {
              plan: 'monthly',
              provider: 'dodo_mor',
              currency: 'USD',
              amountMinor: 499,
              minorDigits: 2,
              taxRatePercent: 0,
              taxAmountMinor: 0,
              taxInclusive: true,
              taxLabel: 'Tax',
              paymentMethods: ['card'],
            },
            {
              plan: 'annual',
              provider: 'dodo_mor',
              currency: 'USD',
              amountMinor: 4990,
              minorDigits: 2,
              taxRatePercent: 0,
              taxAmountMinor: 0,
              taxInclusive: true,
              taxLabel: 'Tax',
              paymentMethods: ['card'],
            },
          ],
        },
      });
    }
    if (url.includes('/api/v1/billing/global/account')) {
      return jsonResp({
        dodoConfigured: true,
        dodoEnvironment: 'live',
        subscription: {
          plan: 'free',
          status: 'none',
          isPlus: false,
          expiresAt: null,
          provider: null,
          providerSubscriptionId: null,
          dodoCustomerId: null,
          canOpenCustomerPortal: false,
          billingCurrency: null,
          cancelAtPeriodEnd: false,
          gracePeriodEndsAt: null,
        },
        payments: [],
      });
    }
    if (url.includes('/api/v1/public/pricing') || url.includes('/api/v1/billing/plans')) {
      return jsonResp({
        plans: [
          { plan: 'monthly', amountVnd: 49000 },
          { plan: 'annual', amountVnd: 499000 },
        ],
      });
    }
    if (url.includes('/api/v1/notifications')) {
      return jsonResp({
        notifications: [
          {
            id: 'notif-1',
            type: 'expiring',
            title: 'Nguyên liệu sắp hết hạn',
            message: 'Thịt ba chỉ sắp hết hạn trong 2 ngày.',
            isRead: false,
            createdAt: '2026-11-24T00:00:00.000Z',
          },
        ],
      });
    }
    if (url.includes('/api/v1/favorites')) return jsonResp({ favorites: [] });
    if (url.includes('/api/v1/preferences')) {
      return jsonResp({ preferences: { householdSize: 2, language: 'en', spicyLevel: 'mild', favoriteCuisines: ['vietnamese'], dietaryRestrictions: [] } });
    }
    if (url.includes('/api/v1/config')) return jsonResp({ googleClientId: null, turnstileSiteKey: null });
    return jsonResp({});
  });
}

describe('Global App English Mode — Zero Vietnamese Leakage Across All Logged-In & Auth Screens', () => {
  afterEach(() => {
    while (mountedCleanups.length > 0) {
      mountedCleanups.pop()?.();
    }
    resetActiveUiLocaleForTests();
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
    useAuthStore.setState({
      userId: undefined,
      householdId: undefined,
      displayName: undefined,
      email: undefined,
      isGuest: true,
      isOnboarded: false,
      isPlus: false,
    });
  });

  it('syncs ?lang=en handoff across all locale stores and attaches X-Takolio-Locale: en in fetchJson', async () => {
    window.history.replaceState({}, '', '/auth?mode=login&lang=en');
    const fetchSpy = mockEnglishApiFetch();

    useAuthStore.setState({
      userId: 'user-en-1',
      householdId: 'hh-en-1',
      displayName: 'Alex Chef',
      email: 'alex@example.com',
      isGuest: false,
      isOnboarded: true,
    });

    const { container } = mountInEnglishApp(<VNextAuthFlow />, '/auth?mode=login&lang=en');
    await flushAsync();

    expect(window.localStorage.getItem('takolio_locale')).toBe('en');
    expect(window.localStorage.getItem('takolio.ui_locale')).toBe('en');
    expect(window.localStorage.getItem('frigo_planner_locale')).toBe('en');
    expect(findVietnameseSnippets(container.textContent ?? '')).toEqual([]);

    await fetchJson('/recipes');
    const recCall = fetchSpy.mock.calls.find(([url]) => String(url).includes('/api/v1/recipes'));
    expect(recCall).toBeTruthy();
    const sentHeaders = (recCall?.[1]?.headers ?? {}) as Record<string, string>;
    expect(sentHeaders['X-Takolio-Locale']).toBe('en');
  });

  it('renders Onboarding, Home, Fridge, Recipes, Recipe Detail, Planner, Shopping, Profile, Notifications, Household, Privacy, Plus, Settings, and Pricing with ZERO Vietnamese leakage', async () => {
    mockEnglishApiFetch();

    useAuthStore.setState({
      userId: 'user-en-1',
      householdId: 'hh-en-1',
      displayName: 'Alex Chef',
      email: 'alex@example.com',
      isGuest: false,
      isOnboarded: true,
      isPlus: false,
    });

    const screens: Array<{ name: string; entry: string; ui: React.ReactElement; stripLanguagePicker?: boolean }> = [
      { name: 'Onboarding', entry: '/onboarding', ui: <VNextOnboardingFlow /> },
      { name: 'C01HomePilot', entry: '/', ui: <C01HomePilot /> },
      { name: 'C03InventoryPilot', entry: '/fridge', ui: <C03InventoryPilot /> },
      { name: 'C15RecipesDiscovery', entry: '/recipes', ui: <C15RecipesDiscoveryVNext /> },
      {
        name: 'C18RecipeDetail',
        entry: '/recipes/rec-thit-kho',
        ui: (
          <Routes>
            <Route path="/recipes/:id" element={<C18RecipeDetailPilot />} />
          </Routes>
        ),
      },
      { name: 'C23PlannerPilot', entry: '/planner', ui: <C23PlannerPilot /> },
      { name: 'ShoppingPage', entry: '/shopping', ui: <ShoppingPage /> },
      { name: 'U01ProfileHub', entry: '/me', ui: <U01ProfileHubVNext /> },
      { name: 'C30Notifications', entry: '/notifications', ui: <C30NotificationsVNext /> },
      { name: 'U06Household', entry: '/household', ui: <U06HouseholdHonestPage /> },
      { name: 'U09Privacy', entry: '/privacy', ui: <U09U10PrivacyAndDataRightsPage /> },
      { name: 'U07Plus', entry: '/plus', ui: <U07U08PlusReadOnlyWrapper /> },
      { name: 'SettingsPage', entry: '/settings', ui: <SettingsPage />, stripLanguagePicker: true },
      { name: 'FoodPreferencesPage', entry: '/settings/food', ui: <FoodPreferencesPage /> },
      { name: 'PlanningSettingsPage', entry: '/settings/planning', ui: <PlanningSettingsPage /> },
      { name: 'NotificationPreferencesPage', entry: '/settings/notifications', ui: <NotificationPreferencesPage /> },
      { name: 'ScanPage', entry: '/scan', ui: <ScanPage /> },
      { name: 'C02QuickSearchPage', entry: '/search', ui: <C02QuickSearchPage /> },
      { name: 'M09PricingPage', entry: '/pricing', ui: <M09PricingPage /> },
    ];

    for (const screen of screens) {
      const { container, unmount } = mountInEnglishApp(screen.ui, screen.entry);
      await flushAsync();
      let visibleText = container.textContent ?? '';
      if (screen.stripLanguagePicker) {
        // Native language names inside the language dropdown (`Tiếng Việt`) are intentionally localized
        visibleText = visibleText.replace(/Tiếng Việt/g, '');
      }
      const leaks = findVietnameseSnippets(visibleText);
      expect(leaks, `Vietnamese leakage found on ${screen.name}: ${leaks.join(', ')}`).toEqual([]);
      unmount();
    }
  });
});
