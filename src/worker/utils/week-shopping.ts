import { AggregatedShoppingItem } from '@frigo/domain';

export type ShoppingImportSelection =
  | { ok: true; items: AggregatedShoppingItem[] }
  | { ok: false; reason: 'invalid_shape' | 'unknown_item' | 'invalid_plan' | 'cannot_buy' };

const STANDARD_UNITS = new Set(['g', 'kg', 'ml', 'l', 'piece', 'pack', 'bunch', 'slice']);

function isValidPlanItem(item: unknown): item is AggregatedShoppingItem {
  if (!item || typeof item !== 'object') return false;
  const candidate = item as AggregatedShoppingItem;
  const quantity = Number(candidate.recommendedPurchaseQuantity || candidate.missingQuantity);
  return Boolean(
      typeof candidate.ingredientId === 'string' &&
      candidate.ingredientId.trim().length > 0 &&
      typeof candidate.name === 'string' &&
      candidate.name.trim().length > 0 &&
      STANDARD_UNITS.has(candidate.unit) &&
      Number.isFinite(quantity) &&
      quantity > 0
  );
}

export function selectPlanShoppingItems(
  planItems: AggregatedShoppingItem[],
  requestedItems?: unknown
): ShoppingImportSelection {
  if (!Array.isArray(planItems) || planItems.some((item) => !isValidPlanItem(item))) {
    return { ok: false, reason: 'invalid_plan' };
  }

  const requested = requestedItems ?? planItems.filter((item) => item.checked && !item.cannotBuy);
  if (!Array.isArray(requested)) return { ok: false, reason: 'invalid_shape' };

  const planItemsByIngredient = new Map(
    planItems.map((item) => [item.ingredientId.trim().toUpperCase(), item])
  );
  const selected = new Map<string, AggregatedShoppingItem>();

  for (const candidate of requested) {
    if (
      !candidate ||
      typeof candidate.ingredientId !== 'string' ||
      candidate.ingredientId.trim().length === 0
    ) {
      return { ok: false, reason: 'invalid_shape' };
    }
    const canonical = planItemsByIngredient.get(candidate.ingredientId.trim().toUpperCase());
    if (!canonical) return { ok: false, reason: 'unknown_item' };
    if (canonical.cannotBuy) return { ok: false, reason: 'cannot_buy' };
    selected.set(canonical.ingredientId, canonical);
  }

  return { ok: true, items: Array.from(selected.values()) };
}
