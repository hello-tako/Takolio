import { ALL_RECIPES } from '@frigo/recipes';
import {
  type MealPlan, type MealPlanSetupInput, type MealSwapAlternative,
  generateWeeklyMealPlan, swapMealInPlan, getSwapAlternatives,
} from '@frigo/domain';
import {
  fetchJson, isOffline, queueWrite, createClientItemId,
  createDeterministicKey, guardPrivateSession, weekPlanCacheKey,
} from './http';
import { inventoryApi } from './inventory';

export const weekApi = {
  getCurrentWeekPlan: async (): Promise<MealPlan | null> => {
    const assertCurrent = guardPrivateSession();
    try {
      const res = await fetchJson<{ plan: MealPlan }>('/week/current');
      assertCurrent();
      if (res.plan) {
        localStorage.setItem(weekPlanCacheKey(), JSON.stringify(res.plan));
      } else {
        localStorage.removeItem(weekPlanCacheKey());
      }
      return res.plan;
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      // Local fallback
      const cached = localStorage.getItem(weekPlanCacheKey());
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore
        }
      }
      return null;
    }
  },

  createWeekPlan: async (input: MealPlanSetupInput): Promise<MealPlan> => {
    const assertCurrent = guardPrivateSession();
    const commandId = createClientItemId('week_plan');
    const planInput: MealPlanSetupInput = {
      ...input,
      planId: input.planId || `plan_${commandId}`,
    };
    const body = JSON.stringify({ ...planInput, commandId });
    const headers = { 'Idempotency-Key': commandId };
    try {
      const res = await fetchJson<{ plan: MealPlan }>('/week/plans', {
        method: 'POST',
        body,
        headers,
      });
      assertCurrent();
      localStorage.setItem(weekPlanCacheKey(), JSON.stringify(res.plan));
      return res.plan;
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      // Genuine offline: the deterministic domain engine can build the plan locally.
      const currentInv = await inventoryApi.getInventory();
      assertCurrent();
      const plan = generateWeeklyMealPlan(planInput, currentInv, ALL_RECIPES);
      const cacheKey = weekPlanCacheKey();
      queueWrite(
        '/week/plans',
        'POST',
        body,
        'Tạo thực đơn tuần',
        `week-plan:${commandId}`,
        headers
      );
      try {
        localStorage.setItem(cacheKey, JSON.stringify(plan));
      } catch {
        // The durable command retains the generated plan ID if its cache is full.
      }
      assertCurrent();
      return plan;
    }
  },

  getWeekPlan: async (id: string): Promise<MealPlan | null> => {
    const assertCurrent = guardPrivateSession();
    try {
      const res = await fetchJson<{ plan: MealPlan }>(`/week/plans/${id}`);
      assertCurrent();
      return res.plan;
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      const cached = localStorage.getItem(weekPlanCacheKey());
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.id === id || !id) return parsed;
        } catch {
          // ignore
        }
      }
      return null;
    }
  },

  swapMeal: async (
    planId: string,
    mealId: string,
    recipeId?: string
  ): Promise<{ plan?: MealPlan; alternatives?: MealSwapAlternative[] }> => {
    const assertCurrent = guardPrivateSession();
    const commandId = recipeId ? createClientItemId('week_swap') : undefined;
    const body = JSON.stringify({ recipeId, ...(commandId ? { commandId } : {}) });
    const headers = commandId ? { 'Idempotency-Key': commandId } : undefined;
    try {
      const res = await fetchJson<{ plan?: MealPlan; alternatives?: MealSwapAlternative[] }>(
        `/week/plans/${planId}/meals/${mealId}/swap`,
        {
          method: 'POST',
          body,
          headers,
        }
      );
      assertCurrent();
      if (res.plan) {
        localStorage.setItem(weekPlanCacheKey(), JSON.stringify(res.plan));
      }
      return res;
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err; // surface real server errors
      const cacheKey = weekPlanCacheKey();
      const cached = localStorage.getItem(cacheKey);
      let updated: MealPlan | undefined;
      if (cached) {
        const plan: MealPlan = JSON.parse(cached);
        const targetSlot = plan.days.flatMap((day) => day.slots).find((slot) => slot.id === mealId);
        if (!recipeId && targetSlot) {
          return { alternatives: getSwapAlternatives(targetSlot, [], ALL_RECIPES) };
        }
        const recipe = ALL_RECIPES.find((r) => r.id === recipeId || r.slug === recipeId);
        if (recipeId && recipe) {
          const inventory = await inventoryApi.getInventory();
          assertCurrent();
          updated = swapMealInPlan(plan, mealId, recipe, inventory);
        }
      }
      if (recipeId) {
        queueWrite(
          `/week/plans/${planId}/meals/${mealId}/swap`,
          'POST', body, 'Đổi món trong thực đơn tuần',
          `week-swap:${planId}:${mealId}:${commandId}`, headers
        );
        if (updated) {
          try { localStorage.setItem(cacheKey, JSON.stringify(updated)); } catch {
            // A cache failure cannot revoke the accepted command.
          }
        }
      }
      assertCurrent();
      return updated ? { plan: updated } : {};
    }
  },

  updateMealSlot: async (planId: string, mealId: string, updates: any): Promise<MealPlan | null> => {
    const assertCurrent = guardPrivateSession();
    const commandId = createClientItemId('week_slot');
    const body = JSON.stringify(updates);
    const headers = { 'Idempotency-Key': commandId };
    try {
      const res = await fetchJson<{ plan: MealPlan }>(`/week/plans/${planId}/meals/${mealId}`, {
        method: 'PATCH',
        body,
        headers,
      });
      assertCurrent();
      localStorage.setItem(weekPlanCacheKey(), JSON.stringify(res.plan));
      return res.plan;
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      const cacheKey = weekPlanCacheKey();
      queueWrite(
        `/week/plans/${planId}/meals/${mealId}`,
        'PATCH',
        body,
        'Cập nhật bữa ăn trong thực đơn tuần',
        `week-slot:${planId}:${mealId}:${commandId}`,
        headers
      );
      let updated: MealPlan | null = null;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const plan: MealPlan = JSON.parse(cached);
          for (const day of plan.days) {
            const s = day.slots.find((slot) => slot.id === mealId);
            if (s) {
              Object.assign(s, updates);
              s.source = 'USER';
              break;
            }
          }
          localStorage.setItem(cacheKey, JSON.stringify(plan));
          updated = plan;
        }
      } catch {
        // Replay owns the accepted change even when its cache is unavailable.
      }
      assertCurrent();
      return updated;
    }
  },

  getWeekShopping: async (planId: string) => {
    const assertCurrent = guardPrivateSession();
    try {
      const result = await fetchJson<any>(`/week/plans/${planId}/shopping`);
      assertCurrent();
      return result;
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      const cached = localStorage.getItem(weekPlanCacheKey());
      if (cached) {
        const plan: MealPlan = JSON.parse(cached);
        return {
          planId,
          items: plan.shoppingItems,
          budget: plan.budget,
          totalCount: plan.shoppingItems.length,
          checkedCount: plan.shoppingItems.filter((i) => i.checked).length,
        };
      }
      return { items: [], totalCount: 0, checkedCount: 0 };
    }
  },

  toggleWeekShoppingItem: async (planId: string, itemId: string, checked: boolean) => {
    const assertCurrent = guardPrivateSession();
    const commandId = createClientItemId('week_shop_toggle');
    const body = JSON.stringify({ checked });
    const headers = { 'Idempotency-Key': commandId };
    try {
      await fetchJson(`/week/plans/${planId}/shopping/items/${itemId}`, {
        method: 'PATCH',
        body,
        headers,
      });
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      const cacheKey = weekPlanCacheKey();
      queueWrite(
        `/week/plans/${planId}/shopping/items/${itemId}`,
        'PATCH',
        body,
        'Cập nhật danh sách mua của thực đơn tuần',
        `week-shopping-toggle:${planId}:${itemId}:${commandId}`,
        headers
      );
      try {
        // Local storage fallback (offline)
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const plan: MealPlan = JSON.parse(cached);
          const item = plan.shoppingItems.find((i) => i.ingredientId === itemId);
          if (item) item.checked = checked;
          localStorage.setItem(cacheKey, JSON.stringify(plan));
        }
      } catch {
        // The checkbox cache is optional after durable acceptance.
      }
      assertCurrent();
    }
  },

  completeWeekShopping: async (planId: string, itemsToImport?: any[], commandId?: string) => {
    const assertCurrent = guardPrivateSession();
    const cached = localStorage.getItem(weekPlanCacheKey());
    let cachedPlan: MealPlan | null = null;
    if (cached) {
      try {
        cachedPlan = JSON.parse(cached) as MealPlan;
      } catch {
        cachedPlan = null;
      }
    }
    const selectedItems = itemsToImport || cachedPlan?.shoppingItems.filter((item) => item.checked) || [];
    const stableCommandId =
      commandId ||
      createDeterministicKey(
        'week_shop',
        JSON.stringify({
          planId,
          items: selectedItems
            .map((item) => ({
              ingredientId: item.ingredientId,
              quantity: item.recommendedPurchaseQuantity || item.missingQuantity || 1,
              unit: item.unit,
            }))
            .sort((a, b) => a.ingredientId.localeCompare(b.ingredientId)),
        })
      );
    const body = JSON.stringify({ items: selectedItems, commandId: stableCommandId });
    const headers = { 'Idempotency-Key': stableCommandId };
    try {
      return await fetchJson<any>(`/week/plans/${planId}/shopping/complete`, {
        method: 'POST',
        body,
        headers,
      });
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      queueWrite(
        `/week/plans/${planId}/shopping/complete`,
        'POST',
        body,
        'Nhập hàng theo thực đơn tuần',
        `week-shopping-complete:${planId}:${stableCommandId}`,
        headers
      );

      assertCurrent();
      return {
        success: true,
        // Pending-only compatibility count: queued lines, not imported stock.
        importedItemsCount: selectedItems.length,
        pendingSync: true,
        message: `Đã lưu yêu cầu nhập ${selectedItems.length} nguyên liệu, đang chờ đồng bộ. Tồn kho chưa thay đổi.`,
      };
    }
  },

  getWeekPreferences: async () => {
    const assertCurrent = guardPrivateSession();
    try {
      const res = await fetchJson<{ preferences: any }>('/week/preferences');
      assertCurrent();
      return res.preferences;
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      return null;
    }
  },

  updateWeekPreferences: async (prefs: any) => {
    const assertCurrent = guardPrivateSession();
    const commandId = createClientItemId('week_preferences');
    const body = JSON.stringify(prefs);
    const headers = { 'Idempotency-Key': commandId };
    try {
      return await fetchJson('/week/preferences', {
        method: 'PATCH',
        body,
        headers,
      });
    } catch (err) {
      assertCurrent();
      if (!isOffline(err)) throw err;
      queueWrite(
        '/week/preferences',
        'PATCH',
        body,
        'Cập nhật tùy chọn thực đơn tuần',
        `week-preferences:${commandId}`,
        headers
      );
      return { success: true, preferences: prefs, pendingSync: true };
    }
  },
};
