// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import compiled500 from '../../data/recipe-standard/v4/compiled-runtime-500.json';
import {
  RECIPE_SLUG_BY_NORMALIZED_VI_TITLE,
  RECIPE_TITLE_EN_BY_SLUG,
  resolveRecipeSlug,
} from '../../src/shared/recipe-titles-en';
import { getSiteDictionary } from '../../src/site/i18n/dictionaries';
import { enDictionary } from '../../src/site/i18n/dictionaries/en';
import { plannerCopy } from '../../src/web/features/planner/copy';
import {
  EXTENDED_UI_CATALOGS,
  LocaleProvider,
  localizeRecipeTitle,
  registerLocalePack,
  resetActiveUiLocaleForTests,
} from '../../src/web/i18n';
import { enCatalog } from '../../src/web/i18n/locales/en';
import { itLocalePack } from '../../src/web/i18n/packs/it';
import { jaLocalePack } from '../../src/web/i18n/packs/ja';
import { koLocalePack } from '../../src/web/i18n/packs/ko';
import { thLocalePack } from '../../src/web/i18n/packs/th';
import { zhLocalePack } from '../../src/web/i18n/packs/zh';
import type { LocalePack, PackLocale } from '../../src/web/i18n/packs/types';
import { useAuthStore } from '../../src/web/stores/useAuthStore';
import { U01ProfileHubVNext, U07U08PlusReadOnlyWrapper } from '../../src/web/vnext/screens/AccountAndSystemPages';
import { VNextAuthFlow } from '../../src/web/vnext/screens/AuthFlowPages';
import { C01HomePilot } from '../../src/web/vnext/screens/C01HomePilot';
import { C03InventoryPilot } from '../../src/web/vnext/screens/C03InventoryPilot';
import { C23PlannerPilot } from '../../src/web/vnext/screens/C23PlannerPilot';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VIETNAMESE_DIACRITIC_RE =
  /[ăđơưĂĐƠƯảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/u;

const PACKS: Record<PackLocale, LocalePack> = {
  ja: jaLocalePack,
  ko: koLocalePack,
  th: thLocalePack,
  zh: zhLocalePack,
  it: itLocalePack,
};

for (const pack of Object.values(PACKS)) {
  registerLocalePack(pack);
}

const mountedCleanups: Array<() => void> = [];

function mountInLocale(locale: PackLocale, ui: React.ReactElement, initialEntry = '/') {
  window.localStorage.setItem('takolio_locale', locale);
  window.localStorage.setItem('takolio.ui_locale', locale);
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

function hasBalancedParens(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === '(' || ch === '（') depth += 1;
    else if (ch === ')' || ch === '）') {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

const SAMPLE_RECIPES = [
  {
    id: 'rec-gyeran',
    slug: 'trung-cuon-gyeran-mari',
    title: 'Trứng cuộn Hàn Quốc (Gyeran Mari)',
    description: 'Trứng cuộn mềm mịn kiểu Hàn.',
    cuisine: 'korean',
    category: 'mon_chien',
    difficulty: 'easy',
    cookTimeMinutes: 10,
    servings: 2,
    tags: ['nhanh'],
    ingredients: [
      { ingredientId: 'EGG', name: 'Trứng gà', requiredQuantity: 3, baseQuantity: 3, quantity: 3, unit: 'piece', isOptional: false },
    ],
    steps: [{ stepNumber: 1, instruction: 'Đánh trứng và cuộn đều trên chảo.', timerMinutes: 5 }],
  },
  {
    id: 'rec-thit-kho',
    slug: 'thit-kho-trung',
    title: 'Thịt kho trứng',
    description: 'Thịt ba chỉ kho trứng đậm đà.',
    cuisine: 'vietnamese',
    category: 'mon_kho',
    difficulty: 'easy',
    cookTimeMinutes: 35,
    servings: 3,
    tags: ['gia_dinh'],
    ingredients: [
      { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ', requiredQuantity: 400, baseQuantity: 400, quantity: 400, unit: 'g', isOptional: false },
    ],
    steps: [{ stepNumber: 1, instruction: 'Kho thịt trên lửa nhỏ.', timerMinutes: 25 }],
  },
];

function mockAppFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const jsonResp = (data: unknown) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    if (url.includes('/api/v1/inventory')) {
      return jsonResp({
        items: [
          {
            id: 'lot-noodles',
            householdId: 'hh-1',
            ingredientId: 'NOODLES',
            name: 'Mì',
            quantity: 2,
            unit: 'pack',
            storageZone: 'pantry',
            status: 'expiring_soon',
            expiryDate: '2026-11-26',
            displayCategory: 'pantry',
            version: 1,
            createdAt: '2026-11-23T00:00:00.000Z',
            updatedAt: '2026-11-23T00:00:00.000Z',
          },
        ],
      });
    }
    if (url.includes('/api/v1/recommendations')) {
      return jsonResp({
        recommendations: SAMPLE_RECIPES.map((recipe) => ({
          recipe,
          score: 90,
          matchedIngredients: [],
          missingIngredients: [],
          canCookNow: true,
          expiringIngredientsUsed: [],
        })),
      });
    }
    if (url.includes('/api/v1/recipes')) return jsonResp({ recipes: SAMPLE_RECIPES });
    if (url.includes('/api/v1/billing/global/plans')) {
      return jsonResp({
        dodoConfigured: true,
        dodoEnvironment: 'live',
        catalog: {
          countryCode: 'JP',
          provider: 'dodo_mor',
          merchantOfRecord: 'Dodo Payments',
          currency: 'JPY',
          minorDigits: 0,
          requiresEuWithdrawalWaiver: false,
          requiresTokushohoDisclosure: true,
          tokushohoUrl: '/api/v1/billing/tokushoho',
          plans: [
            { plan: 'monthly', provider: 'dodo_mor', currency: 'JPY', amountMinor: 480, minorDigits: 0, taxRatePercent: 10, taxAmountMinor: 0, taxInclusive: true, taxLabel: '消費税', paymentMethods: ['card'] },
            { plan: 'annual', provider: 'dodo_mor', currency: 'JPY', amountMinor: 4800, minorDigits: 0, taxRatePercent: 10, taxAmountMinor: 0, taxInclusive: true, taxLabel: '消費税', paymentMethods: ['card'] },
          ],
        },
      });
    }
    if (url.includes('/api/v1/billing/global/account')) {
      return jsonResp({
        dodoConfigured: true,
        dodoEnvironment: 'live',
        subscription: { plan: 'free', status: 'none', isPlus: false, expiresAt: null, provider: null, providerSubscriptionId: null, dodoCustomerId: null, canOpenCustomerPortal: false, billingCurrency: null, cancelAtPeriodEnd: false, gracePeriodEndsAt: null },
        payments: [],
      });
    }
    if (url.includes('/api/v1/week') || url.includes('/api/v1/planner')) return jsonResp({ plan: null, plans: [] });
    if (url.includes('/api/v1/config')) return jsonResp({ googleClientId: null, turnstileSiteKey: null });
    return jsonResp({});
  });
}

describe('All 7 Locales Completeness Gate (vi, en, ja, ko, th, zh, it)', () => {
  afterEach(() => {
    while (mountedCleanups.length > 0) {
      mountedCleanups.pop()?.();
    }
    resetActiveUiLocaleForTests();
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

  it('covers all 500 recipes across en, ja, ko, th, zh, it with zero generic placeholders, zero stray parens, and zero Vietnamese leakage', () => {
    const recipes = Array.isArray(compiled500) ? compiled500 : (compiled500 as { recipes: Array<{ slug: string; title: string }> }).recipes;
    expect(recipes).toHaveLength(500);
    expect(Object.keys(RECIPE_TITLE_EN_BY_SLUG)).toHaveLength(500);
    expect(Object.keys(RECIPE_SLUG_BY_NORMALIZED_VI_TITLE)).toHaveLength(500);

    // Title-only resolution without slug (e.g. C01HomePilot planner summary)
    expect(resolveRecipeSlug({ title: 'Thịt kho trứng' })).toBe('thit-kho-trung');
    expect(localizeRecipeTitle({ title: 'Thịt kho trứng' }, 'ja')).toBe(jaLocalePack.recipeTitles['thit-kho-trung']);

    for (const r of recipes) {
      const enTitle = RECIPE_TITLE_EN_BY_SLUG[r.slug];
      expect(enTitle, `Missing EN title for ${r.slug}`).toBeTruthy();
      expect(VIETNAMESE_DIACRITIC_RE.test(enTitle), `VI leak in EN title ${r.slug}: ${enTitle}`).toBe(false);
      expect(hasBalancedParens(enTitle), `Unbalanced parens in EN ${r.slug}: ${enTitle}`).toBe(true);
      expect(enTitle).not.toContain('Home-Cooked Dish');

      for (const [loc, pack] of Object.entries(PACKS) as Array<[PackLocale, LocalePack]>) {
        const nativeTitle = pack.recipeTitles[r.slug];
        expect(nativeTitle, `Missing ${loc} title for ${r.slug}`).toBeTruthy();
        expect(VIETNAMESE_DIACRITIC_RE.test(nativeTitle), `VI leak in ${loc} title ${r.slug}: ${nativeTitle}`).toBe(false);
        expect(hasBalancedParens(nativeTitle), `Unbalanced parens in ${loc} ${r.slug}: ${nativeTitle}`).toBe(true);
      }
    }
  });

  it('enforces 100% key parity across plannerCopy, EXTENDED_UI_CATALOGS, and takolio.com SiteDictionary for ja, ko, th, zh, it', () => {
    const plannerKeys = Object.keys(plannerCopy.en);
    const collectKeys = (obj: Record<string, unknown>, prefix = ''): string[] => {
      const out: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const p = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object') out.push(...collectKeys(v as Record<string, unknown>, p));
        else out.push(p);
      }
      return out.sort();
    };
    const enUiKeys = collectKeys(enCatalog as unknown as Record<string, unknown>);

    for (const [loc, pack] of Object.entries(PACKS) as Array<[PackLocale, LocalePack]>) {
      for (const k of plannerKeys) {
        expect(pack.planner[k], `Missing planner key ${k} in ${loc}`).toBeTruthy();
      }
      const uiCat = EXTENDED_UI_CATALOGS[loc];
      expect(uiCat, `Missing EXTENDED_UI_CATALOGS.${loc}`).toBeTruthy();
      expect(collectKeys(uiCat as unknown as Record<string, unknown>)).toEqual(enUiKeys);
      const serializedUi = JSON.stringify(uiCat);
      expect(VIETNAMESE_DIACRITIC_RE.test(serializedUi), `VI leak in UI catalog ${loc}`).toBe(false);
      expect(serializedUi).not.toContain('VND');

      // takolio.com SiteDictionary parity & zero English fallback on primary headings
      const siteDict = getSiteDictionary(loc);
      expect(siteDict.landing.seoTitle).not.toBe(enDictionary.landing.seoTitle);
      expect(siteDict.landing.heroBadge).not.toBe(enDictionary.landing.heroBadge);
      expect(siteDict.landing.heroDesc).not.toBe(enDictionary.landing.heroDesc);
      expect(siteDict.pricing.h1).not.toBe(enDictionary.pricing.h1);
      expect(siteDict.faq.h1).not.toBe(enDictionary.faq.h1);
      expect(siteDict.howItWorks.h1).not.toBe(enDictionary.howItWorks.h1);
      expect(VIETNAMESE_DIACRITIC_RE.test(JSON.stringify(siteDict)), `VI leak in SiteDictionary ${loc}`).toBe(false);

      // Dynamic template translation check
      expect(pack.translateDynamic('Hi Alex · Meal ideas matched to your ingredients')).not.toBeNull();
      expect(pack.translateDynamic('Serves 3 · 35 min prep.')).not.toBeNull();
      expect(pack.translateDynamic('10 min')).not.toBeNull();
      expect(pack.translateDynamic('2 servings')).not.toBeNull();
    }
  });

  it('renders core logged-in & auth screens natively in ja, ko, th, zh, it with ZERO Vietnamese and ZERO leftover English chrome', async () => {
    mockAppFetch();
    useAuthStore.setState({
      userId: 'user-global-1',
      householdId: 'hh-1',
      displayName: 'Alex',
      email: 'alex@example.com',
      isGuest: false,
      isOnboarded: true,
      isPlus: false,
    });

    const FORBIDDEN_ENGLISH_LEAKS = [
      'What to cook today?',
      'Scan ingredients',
      'Recipe library',
      'Your kitchen shortcuts',
      'Suggested for your next meal',
      'Open fridge',
      'View all recipes',
      'Home-Cooked Dish',
      'Korean Gyeran Mari)',
      'Smart AI family kitchen assistant',
    ];

    const SCRIPT_CHECK: Record<PackLocale, RegExp> = {
      ja: /[\u3040-\u30ff\u4e00-\u9faf]/,
      ko: /[\uac00-\ud7af]/,
      th: /[\u0e00-\u0e7f]/,
      zh: /[\u4e00-\u9faf]/,
      it: /Cosa cuciniamo|Dispensa|Ricette|Profilo|Accedi/i,
    };

    for (const loc of ['ja', 'ko', 'th', 'zh', 'it'] as const) {
      const screens = [
        { name: 'Home', entry: '/', ui: <C01HomePilot /> },
        { name: 'Fridge', entry: '/fridge', ui: <C03InventoryPilot /> },
        { name: 'Planner', entry: '/planner', ui: <C23PlannerPilot /> },
        { name: 'Profile', entry: '/me', ui: <U01ProfileHubVNext /> },
        { name: 'Plus', entry: '/plus', ui: <U07U08PlusReadOnlyWrapper /> },
        { name: 'Auth', entry: '/auth?mode=login', ui: <VNextAuthFlow /> },
      ];

      for (const s of screens) {
        const { container, unmount } = mountInLocale(loc, s.ui, s.entry);
        await flushAsync();
        const text = container.textContent ?? '';
        expect(VIETNAMESE_DIACRITIC_RE.test(text), `VI leak on ${s.name} (${loc}): ${text.slice(0, 200)}`).toBe(false);
        for (const leak of FORBIDDEN_ENGLISH_LEAKS) {
          expect(text, `English leak "${leak}" on ${s.name} (${loc})`).not.toContain(leak);
        }
        if (s.name === 'Home') {
          expect(SCRIPT_CHECK[loc].test(text), `Expected native script on Home (${loc})`).toBe(true);
        }
        unmount();
      }
    }
  });
});
