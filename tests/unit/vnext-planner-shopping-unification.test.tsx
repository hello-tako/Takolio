// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyMealPlanDtoSchema } from '../../packages/domain/src/family-meal-planning-api';
import { FamilyPreferencesSchema } from '../../packages/domain/src/family-preferences-api';
import { C23PlannerPilot } from '../../src/web/vnext/screens/C23PlannerPilot';
import {
  C27ShoppingStudio,
  estimateDemandSuggestion,
} from '../../src/web/vnext/screens/C27ShoppingStudio';
import { C03InventoryPilot } from '../../src/web/vnext/screens/C03InventoryPilot';
import { C18RecipeDetailPilot } from '../../src/web/vnext/screens/C18RecipeDetailPilot';
import { buildRecoveryIntentForPlan } from '../../src/web/vnext/lib/planner-workbench';
import { useAuthStore } from '../../src/web/stores/useAuthStore';
import { resetPrivateSession } from '../../src/web/lib/private-session';
import { hookPlan, hookPlanId } from '../helpers/planner-hook-fixtures';
import { homeComposition } from '../helpers/ui02-fixtures';

function setupAuth(userId = 'u-unify', householdId = 'h-unify') {
  localStorage.clear();
  resetPrivateSession();
  localStorage.setItem('frigo_user_id', userId);
  localStorage.setItem('frigo_household_id', householdId);
  useAuthStore.setState({ userId, householdId, isGuest: false, displayName: 'Minh' });
}

async function waitUntil(check: () => boolean, attempts = 35, delayMs = 10) {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((r) => setTimeout(r, delayMs));
    });
  }
}

describe('Planner ↔ Shopping Unification & Calm Kitchen Cross-Flow Connectivity', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubEnv('VITE_MEAL_PLANNER_ENABLED', 'true');
    vi.stubEnv('VITE_MEAL_COMPOSITION_V2_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('builds a clean shopping_allowed recovery intent and shifts elapsed dates forward without hardMaxTimeMinutes', () => {
    const stalePlan = hookPlan(1);
    stalePlan.intent = {
      ...stalePlan.intent,
      startDate: '2025-01-01',
      mode: 'cook_now',
      slots: [
        {
          date: '2025-01-01',
          mealType: 'dinner',
          sequence: 0,
          hardMaxTimeMinutes: 30,
        },
      ],
    };

    const now = new Date(2026, 10, 24, 10, 0, 0);
    const recovered = buildRecoveryIntentForPlan(stalePlan, false, now);
    expect(recovered.mode).toBe('shopping_allowed');
    expect(recovered.startDate).toBe('2026-11-25');
    expect(recovered.slots[0]?.date).toBe('2026-11-25');
    expect(recovered.slots[0]?.hardMaxTimeMinutes).toBeUndefined();
    expect(recovered.slots[0]?.preferredTimeMinutes).toBe(30);
  });

  it('does NOT flash "Chưa tìm đủ món" on an intentional manual empty draft and offers 1-tap auto-suggest', async () => {
    setupAuth('u-manual', 'h-manual');
    const basePlan = hookPlan(1);
    const firstSlot = basePlan.intent.slots[0];
    const slotDate = firstSlot?.date ?? '2099-05-01';
    const slotMealType = firstSlot?.mealType ?? 'dinner';
    const slotId = `${slotDate}:${slotMealType}:0`;
    const manualPlan = {
      ...basePlan,
      result: {
        ...basePlan.result,
        status: 'infeasible' as const,
        meals: [],
        unplannedSlots: [
          { slotId, date: slotDate, mealType: slotMealType, reasons: ['MANUAL_SELECTION_PENDING'] },
        ],
      },
    };
    const manualCompositions = {
      ...homeComposition(basePlan, []),
      compositions: [
        {
          ...homeComposition(basePlan, []).compositions[0]!,
          slotId,
          mode: 'manual' as const,
          components: [],
          missingRoles: ['main' as const, 'soup' as const, 'vegetable' as const, 'staple' as const],
          warnings: ['MANUAL_SELECTION_PENDING'],
        },
      ],
    };
    const envelope = FamilyMealPlanDtoSchema.parse({
      schemaVersion: 2,
      plan: manualPlan,
      compositions: manualCompositions,
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
        completeMealCount: 0,
        partialMealCount: 0,
        unplannedMealCount: 1,
        reasons: ['MANUAL_SELECTION_PENDING'],
        searchLimited: false,
      },
      familyPreferenceFreshness: 'fresh',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/compositions')) return Response.json(envelope.compositions);
        if (url.endsWith('/current')) return Response.json({ plan: envelope });
        return Response.json(envelope);
      }),
    );

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={[`/planner/${hookPlanId}`]}>
            <Routes>
              <Route path="/planner/:planId" element={<C23PlannerPilot />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    await waitUntil(() => Boolean(host.querySelector('[data-testid="c23-manual-draft-banner"]')));

    expect(host.querySelector('[data-testid="c23-manual-draft-banner"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="c23-infeasible-banner"]')).toBeNull();
    expect(host.textContent).not.toContain('Chưa tìm đủ món khớp điều kiện hiện tại');
    expect(host.querySelector('[data-testid="c23-auto-suggest-recover-btn"]')).not.toBeNull();

    await act(async () => root.unmount());
    host.remove();
  });

  it('recovers an infeasible cook_now plan in 1 tap by regenerating with shopping_allowed and healing legacy allergens', async () => {
    setupAuth('u-recover', 'h-recover');
    const basePlan = hookPlan(1);
    const meal0 = basePlan.result.meals[0]!;
    const slotId = meal0.slotId;
    const infeasiblePlan = {
      ...basePlan,
      intent: { ...basePlan.intent, mode: 'cook_now' as const },
      result: {
        ...basePlan.result,
        status: 'infeasible' as const,
        meals: [],
        unplannedSlots: [
          {
            slotId,
            date: meal0.date,
            mealType: meal0.mealType,
            reasons: ['INSUFFICIENT_INVENTORY'],
          },
        ],
      },
    };
    const emptyComp = {
      ...homeComposition(basePlan, []),
      compositions: [
        {
          ...homeComposition(basePlan, []).compositions[0]!,
          slotId,
          mode: 'auto' as const,
          components: [],
          missingRoles: ['main' as const],
          warnings: ['INSUFFICIENT_INVENTORY'],
        },
      ],
    };
    const initialEnvelope = FamilyMealPlanDtoSchema.parse({
      schemaVersion: 2,
      plan: infeasiblePlan,
      compositions: emptyComp,
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
        completeMealCount: 0,
        partialMealCount: 0,
        unplannedMealCount: 1,
        reasons: ['INSUFFICIENT_INVENTORY'],
        searchLimited: false,
      },
      familyPreferenceFreshness: 'fresh',
    });

    const recoveredPlan = hookPlan(2);
    const recoveredEnvelope = FamilyMealPlanDtoSchema.parse({
      schemaVersion: 2,
      plan: recoveredPlan,
      compositions: homeComposition(recoveredPlan, ['Gà kho gừng', 'Canh bí đao', 'Cơm trắng']),
      policy: initialEnvelope.policy,
      diagnostics: {
        completeMealCount: 1,
        partialMealCount: 0,
        unplannedMealCount: 0,
        reasons: [],
        searchLimited: false,
      },
      familyPreferenceFreshness: 'fresh',
    });

    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/family-preferences') && (!init?.method || init.method === 'GET')) {
        return Response.json({
          revision: 1,
          preferences: FamilyPreferencesSchema.parse({ householdSize: 2, allergens: ['peanut'] }),
        });
      }
      if (url.includes('/family-preferences') && init?.method === 'PUT') {
        const parsed = JSON.parse(String(init.body));
        return Response.json({ revision: 2, preferences: parsed.preferences });
      }
      if (url.includes('/regenerate') && init?.method === 'POST') {
        return Response.json(recoveredEnvelope);
      }
      if (url.includes('/compositions')) {
        return Response.json(
          url.includes('revision=2') ? recoveredEnvelope.compositions : initialEnvelope.compositions,
        );
      }
      return Response.json(initialEnvelope);
    });
    vi.stubGlobal('fetch', fetchSpy);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={[`/planner/${hookPlanId}`]}>
            <Routes>
              <Route path="/planner/:planId" element={<C23PlannerPilot />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    await waitUntil(() => Boolean(host.querySelector('[data-testid="c23-infeasible-banner"]')));
    const recoverBtn = host.querySelector<HTMLButtonElement>('[data-testid="c23-auto-suggest-recover-btn"]')!;
    expect(recoverBtn.textContent).toContain('Gợi ý kèm đi chợ');

    await act(async () => {
      recoverBtn.click();
    });

    await waitUntil(() =>
      fetchSpy.mock.calls.some(([u, init]) => String(u).includes('/regenerate') && init?.method === 'POST'),
    );

    const regenCall = fetchSpy.mock.calls.find(
      ([u, init]) => String(u).includes('/regenerate') && init?.method === 'POST',
    );
    expect(regenCall).toBeDefined();
    const regenBody = JSON.parse(String(regenCall![1]!.body));
    expect(regenBody.intent.mode).toBe('shopping_allowed');

    await act(async () => root.unmount());
    host.remove();
  });

  it('computes honest kitchen-rounded demand suggestions only when every contribution has a numeric quantity', () => {
    const numericDemand = {
      ingredientId: 'CARROT',
      name: 'Cà rốt',
      unit: 'g',
      contributions: [
        {
          planId: 'p1',
          slotId: '2026-11-25:lunch:0',
          date: '2026-11-25',
          mealType: 'lunch' as const,
          componentId: 'c1',
          recipeId: 'r1',
          title: 'Canh củ quả',
          quantity: 13.333333333333334,
          unit: 'g',
        },
        {
          planId: 'p1',
          slotId: '2026-11-26:dinner:0',
          date: '2026-11-26',
          mealType: 'dinner' as const,
          componentId: 'c2',
          recipeId: 'r2',
          title: 'Rau xào thập cẩm',
          quantity: 13.333333333333334,
          unit: 'g',
        },
      ],
    };
    const suggestion = estimateDemandSuggestion(numericDemand);
    expect(suggestion).toEqual({ quantity: 25, unit: 'g', mealCount: 2 });

    const genuinelyUnknown = {
      ...numericDemand,
      contributions: [
        ...numericDemand.contributions,
        {
          planId: 'p1',
          slotId: '2026-11-27:lunch:0',
          date: '2026-11-27',
          mealType: 'lunch' as const,
          componentId: 'c3',
          recipeId: 'r3',
          title: 'Món chưa rõ lượng',
          quantity: null,
          unit: 'g',
        },
      ],
    };
    expect(estimateDemandSuggestion(genuinelyUnknown)).toBeNull();
  });

  it('renders C27ShoppingStudio with live meal-plan sync, 1-tap demand confirmation, aisle grouping, in-app swap link, and restock strip', async () => {
    setupAuth('u-shop', 'h-shop');
    const basePlan = hookPlan(1);
    const envelope = FamilyMealPlanDtoSchema.parse({
      schemaVersion: 2,
      plan: basePlan,
      compositions: homeComposition(basePlan, ['Thịt kho trứng', 'Cơm trắng']),
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

    const sha64 = 'a'.repeat(64);
    const shoppingSnapshot = {
      items: [
        {
          id: 'item-pork',
          name: 'Thịt ba chỉ',
          quantity: 400,
          unit: 'g',
          isChecked: false,
          cannotBuy: true,
          ingredientId: 'PORK_BELLY',
          contributions: [
            {
              planId: basePlan.id,
              slotId: '2099-05-01:dinner:0',
              date: '2099-05-01',
              mealType: 'dinner',
              componentId: 'comp-1',
              recipeId: 'vn-kho-01',
              title: 'Thịt kho trứng',
              quantity: 400,
              unit: 'g',
            },
          ],
        },
        {
          id: 'item-egg',
          name: 'Trứng gà',
          quantity: 6,
          unit: 'piece',
          isChecked: true,
          ingredientId: 'EGG',
        },
      ],
      unresolvedItems: [
        {
          sourceId: 'src-1',
          demandKey: 'CARROT:g',
          snapshot: sha64,
          reviewRevision: 0,
          reviewState: 'pending',
          purchaseItemId: null,
          ingredientId: 'CARROT',
          name: 'Cà rốt',
          unit: 'g',
          contributions: [
            {
              planId: basePlan.id,
              slotId: '2099-05-01:dinner:0',
              date: '2099-05-01',
              mealType: 'dinner',
              componentId: 'comp-2',
              recipeId: 'vn-canh-01',
              title: 'Canh củ quả',
              quantity: 133.33333333333334,
              unit: 'g',
            },
          ],
        },
      ],
    };

    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/current')) return Response.json({ plan: envelope });
      if (url.includes('/shopping-list/from-plan') && init?.method === 'POST') {
        return Response.json({
          success: true,
          planId: basePlan.id,
          planRevision: basePlan.revision,
          sourceId: 'src-1',
          itemCount: 2,
          unresolvedCount: 0,
          idempotentReplay: false,
        });
      }
      if (url.includes('/shopping-list/demand-review') && init?.method === 'POST') {
        return Response.json({
          sourceId: 'src-1',
          demandKey: 'CARROT:g',
          reviewRevision: 1,
          reviewState: 'purchased',
          purchaseItemId: 'item-carrot-1',
          quantity: 135,
          unit: 'g',
        });
      }
      if (url.includes('/shopping-list')) return Response.json(shoppingSnapshot);
      return Response.json({});
    });
    vi.stubGlobal('fetch', fetchSpy);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={['/shopping']}>
            <C27ShoppingStudio />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    await waitUntil(() => Boolean(host.querySelector('[data-testid="c27-plan-sync-strip"]')));
    await waitUntil(() => Boolean(host.querySelector('[data-testid="c27-aisle-list"]')));

    // Live meal plan strip + aisle grouping + restock strip + swap link (no target=_blank)
    expect(host.querySelector('[data-testid="c27-plan-sync-strip"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="c27-aisle-list"]')?.textContent).toContain('Thịt, cá & hải sản');
    expect(host.querySelector('[data-testid="c27-restock-strip"]')).not.toBeNull();
    expect(host.textContent).toContain('Đổi món ở thực đơn');
    expect(host.querySelectorAll('a[target="_blank"]').length).toBe(0);

    // 1-tap sync from plan
    const syncBtn = host.querySelector<HTMLButtonElement>('[data-testid="c27-sync-plan-btn"]')!;
    await act(async () => {
      syncBtn.click();
    });
    await waitUntil(() =>
      fetchSpy.mock.calls.some(([u, init]) => String(u).includes('/shopping-list/from-plan') && init?.method === 'POST'),
    );

    // 1-tap smart unresolved demand confirm
    const confirmBtn = host.querySelector<HTMLButtonElement>('[data-testid="c27-quick-confirm-CARROT:g"]')!;
    expect(confirmBtn.textContent).toContain('135 g');
    await act(async () => {
      confirmBtn.click();
    });
    await waitUntil(() =>
      fetchSpy.mock.calls.some(([u, init]) => String(u).includes('/shopping-list/demand-review') && init?.method === 'POST'),
    );

    await act(async () => root.unmount());
    host.remove();
  });

  it('connects C03 Fridge to Recipes/Planner/Shopping and C18 Recipe Detail to Weekly Planner', async () => {
    setupAuth('u-links', 'h-links');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/inventory')) {
          return Response.json({
            items: [
              {
                id: 'lot-1',
                name: 'Thịt ba chỉ',
                ingredientId: 'PORK_BELLY',
                quantity: 500,
                unit: 'g',
                category: 'meat',
                storage: 'fridge',
                expiryDate: '2099-05-10',
                freshness: 'fresh',
                version: 1,
              },
            ],
          });
        }
        if (url.includes('/recipes/')) {
          return Response.json({
            recipe: {
              id: 'vn-kho-01',
              slug: 'thit-kho-trung',
              title: 'Thịt kho trứng',
              description: 'Món kho truyền thống',
              cuisine: 'vietnamese',
              cookTimeMinutes: 40,
              difficulty: 'easy',
              servings: 4,
              imageUrl: '',
              ingredients: [
                { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ', requiredQuantity: 400, unit: 'g' },
              ],
              steps: [{ stepNumber: 1, instruction: 'Kho lửa nhỏ.' }],
              tags: [],
            },
          });
        }
        return Response.json({});
      }),
    );

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={['/fridge']}>
            <C03InventoryPilot />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
    await waitUntil(() => Boolean(host.querySelector('[data-testid="c03-kitchen-flow-strip"]')));
    const stripHrefs = Array.from(
      host.querySelectorAll('[data-testid="c03-kitchen-flow-strip"] a'),
    ).map((a) => a.getAttribute('href'));
    expect(stripHrefs).toEqual(
      expect.arrayContaining(['/recipes?noBuy=true', '/planner/new', '/shopping']),
    );

    await act(async () => root.unmount());
    host.remove();

    const host2 = document.createElement('div');
    document.body.appendChild(host2);
    const root2 = createRoot(host2);
    await act(async () => {
      root2.render(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={['/recipes/thit-kho-trung']}>
            <Routes>
              <Route path="/recipes/:slug" element={<C18RecipeDetailPilot />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
    await waitUntil(() => Boolean(host2.querySelector('[data-testid="c18-add-to-planner-link"]')));
    expect(
      host2.querySelector('[data-testid="c18-add-to-planner-link"]')?.getAttribute('href'),
    ).toBe('/planner/new?recipe=vn-kho-01&servings=4');

    await act(async () => root2.unmount());
    host2.remove();
  });
});
