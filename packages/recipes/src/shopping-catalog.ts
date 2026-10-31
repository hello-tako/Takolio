import { z } from 'zod';
import { OffsetDateTimeSchema,
  CanonicalIngredientIdSchema,
  PositiveQuantitySchema,
  StandardUnitSchema,
} from '../../domain/src/foundation';
import { compareIds } from '../../domain/src/availability';
import { canonicalJson, freezePlanningValue } from './planner-context';
import {
  normalizeShoppingMealPlan,
  type ShoppingMealPlanSnapshot,
} from './shopping-plan-snapshot';
import type { WeeklyMealPlan } from './planner-types';
import { SHOPPING_LIMITS } from './shopping-policy';

const Identity = z
  .string()
  .min(1)
  .max(200)
  .refine((v) => v === v.trim() && !v.includes('\0'));
export const ShoppingCurrencySchema = z.enum(['VND', 'JPY', 'USD', 'EUR']);
export type ShoppingCurrency = z.infer<typeof ShoppingCurrencySchema>;
export const CURRENCY_MINOR_DIGITS = Object.freeze({ VND: 0, JPY: 0, USD: 2, EUR: 2 });
const MinorUnits = z.number().int().safe().nonnegative();
const Instant = OffsetDateTimeSchema
  .refine((v) => Number.isFinite(Date.parse(v)), 'Invalid price instant');

export const PurchaseOptionSchema = z
  .object({
    id: Identity,
    ingredientId: CanonicalIngredientIdSchema,
    productId: Identity.optional(),
    retailerId: Identity.optional(),
    householdId: Identity.optional(),
    packageContent: z
      .object({
        quantity: PositiveQuantitySchema,
        unit: StandardUnitSchema,
        sourceReference: Identity,
      })
      .strict()
      .nullable(),
    price: z
      .object({
        amountMinor: MinorUnits.nullable(),
        currency: ShoppingCurrencySchema,
        asOf: Instant,
        source: z.enum(['manual', 'retailer', 'imported', 'cached', 'estimated', 'catalog']),
        sourceReference: Identity,
        zeroPriceReason: Identity.optional(),
      })
      .strict()
      .superRefine((price, ctx) => {
        if (price.amountMinor === 0 && !price.zeroPriceReason) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'A free offer requires explicit evidence',
          });
        }
      })
      .nullable(),
    availability: z.enum(['available', 'unknown', 'out_of_stock']),
    expiry: z
      .object({
        date: z.string().date(),
        kind: z.enum(['use_by', 'best_before', 'estimated']),
        sourceReference: Identity,
      })
      .strict()
      .nullable(),
  })
  .strict();
export type PurchaseOption = z.infer<typeof PurchaseOptionSchema>;

export const ShoppingBudgetSchema = z
  .object({
    householdId: Identity,
    mode: z.enum(['hard', 'soft']),
    currency: ShoppingCurrencySchema,
    amountMinor: MinorUnits,
    revision: Identity,
  })
  .strict();
export type ShoppingBudget = z.infer<typeof ShoppingBudgetSchema>;

export interface ShoppingSourceInput {
  householdId: string;
  userId: string;
  currency: ShoppingCurrency;
  mealPlan: ShoppingMealPlanSnapshot | WeeklyMealPlan;
  catalog: {
    snapshotId: string;
    asOf: string;
    options: readonly PurchaseOption[];
  };
  budget: ShoppingBudget | null;
}

declare const shoppingContextBrand: unique symbol;
export interface ShoppingContext {
  readonly [shoppingContextBrand]: true;
}
const contexts = new WeakMap<ShoppingContext, ShoppingSourceInput>();

/** Only install authorized server data; a provider wrapper does not authenticate client prices. */
export function createShoppingContext(serverProvider: () => ShoppingSourceInput): ShoppingContext {
  if (typeof serverProvider !== 'function')
    throw new Error('Shopping requires a server-owned snapshot provider');
  const source = serverProvider();
  const householdId = Identity.parse(source.householdId);
  const userId = Identity.parse(source.userId);
  const currency = ShoppingCurrencySchema.parse(source.currency);
  const budget = source.budget === null ? null : ShoppingBudgetSchema.parse(source.budget);
  const snapshotId = Identity.parse(source.catalog.snapshotId);
  const asOf = Instant.parse(source.catalog.asOf);
  const plan = normalizeShoppingMealPlan(source.mealPlan);
  if (
    plan.schemaVersion !== 1 ||
    plan.persistence !== 'generated_only' ||
    plan.householdId !== householdId ||
    plan.userId !== userId ||
    (budget && (budget.householdId !== householdId || budget.currency !== currency))
  ) {
    throw new Error('Shopping snapshot scope or currency mismatch');
  }
  if (
    plan.slots.length > 42 ||
    plan.unplannedSlots.length > 42 ||
    plan.initialInventorySnapshot.length > 1000 ||
    plan.projectedFinalInventory.length > 1000 ||
    plan.slots.reduce((n, slot) => n + slot.shortages.length, 0) > SHOPPING_LIMITS.requirements
  ) {
    throw new Error('Shopping plan input limit exceeded');
  }
  if (
    [
      ...plan.initialInventorySnapshot,
      ...plan.projectedFinalInventory,
      ...plan.slots.flatMap((slot) => slot.projectedConsumption),
    ].some((lot) => lot.householdId !== householdId)
  )
    throw new Error('Shopping inventory scope mismatch');
  if (
    Date.parse(asOf) < Date.parse(plan.planningReference.instant) ||
    plan.slots.some((slot) => Date.parse(asOf) > Date.parse(slot.instant))
  ) {
    throw new Error(
      'Shopping snapshot must follow planning capture and precede every selected meal',
    );
  }
  const options = z
    .array(PurchaseOptionSchema)
    .max(SHOPPING_LIMITS.catalogOptions)
    .parse(source.catalog.options);
  const deduped = new Map<string, PurchaseOption>();
  for (const option of options) {
    if (option.householdId !== undefined && option.householdId !== householdId) {
      throw new Error('Purchase option household mismatch');
    }
    const prior = deduped.get(option.id);
    if (prior && canonicalJson(prior) !== canonicalJson(option))
      throw new Error('Conflicting purchase option identity');
    deduped.set(option.id, option);
  }
  const semanticOptions = new Map<string, PurchaseOption>();
  for (const option of [...deduped.values()].sort((a, b) => compareIds(a.id, b.id))) {
    const key = canonicalJson({ ...option, id: undefined });
    if (!semanticOptions.has(key)) semanticOptions.set(key, option);
  }
  const prepared: ShoppingSourceInput = {
    householdId,
    userId,
    currency,
    budget,
    mealPlan: structuredClone(source.mealPlan),
    catalog: { snapshotId, asOf, options: [...semanticOptions.values()] },
  };
  const context = Object.freeze({}) as ShoppingContext;
  contexts.set(context, freezePlanningValue(prepared));
  return context;
}

export function readShoppingContext(context: ShoppingContext): ShoppingSourceInput {
  const source = contexts.get(context);
  if (!source) throw new Error('Shopping requires the original trusted context snapshot');
  return source;
}
