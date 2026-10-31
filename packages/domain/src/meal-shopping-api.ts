import { z } from 'zod';
import { OffsetDateTimeSchema } from './foundation';

const CurrencySchema = z.enum(['VND', 'JPY', 'USD', 'EUR']);
const CurrencyMinorDigits = { VND: 0, JPY: 0, USD: 2, EUR: 2 } as const;
const UnitSchema = z.enum(['g', 'kg', 'ml', 'l', 'piece', 'pack', 'bunch', 'slice']);
const CodeSchema = z.string().min(1).max(200);
const InstantSchema = OffsetDateTimeSchema;
const DecimalStringSchema = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number.toString() === value;
  }, 'Quantity must use the canonical finite JavaScript decimal representation');
const MinorAmountSchema = z.string().regex(/^(0|[1-9]\d*)$/).max(100);

/** Exact numeric values stay strings at the public API boundary. */
export const ExactQuantityDtoSchema = z
  .object({ value: DecimalStringSchema, unit: UnitSchema })
  .strict();
export type ExactQuantityDto = z.infer<typeof ExactQuantityDtoSchema>;

export const MoneyDtoSchema = z
  .object({ currency: CurrencySchema, minorAmount: MinorAmountSchema })
  .strict();
export type MoneyDto = z.infer<typeof MoneyDtoSchema>;

const SlotProvenanceDtoSchema = z
  .object({
    slotId: z.string().min(1).max(200),
    date: z.string().date(),
    candidateId: z.string().min(1).max(24_000),
    sourceLineIndices: z.array(z.number().int().nonnegative()),
    shortageType: z.enum(['partial', 'missing', 'unresolved']),
    quantity: ExactQuantityDtoSchema.nullable(),
  })
  .strict();
const WasteRiskDtoSchema = z
  .object({
    status: z.enum(['at_risk', 'no_dated_risk_in_horizon', 'unknown']),
    confidence: z.enum(['dated', 'estimated', 'unknown']),
    expiryDate: z.string().date().nullable(),
    expiryKind: z.enum(['use_by', 'best_before', 'estimated', 'unknown']),
    unusableAtHorizon: z.boolean(),
    certainWasteQuantity: z.null(),
  })
  .strict();
const PurchasePackageDtoSchema = z
  .object({
    purchaseOptionId: z.string().min(1).max(200),
    productId: z.string().min(1).max(200).nullable(),
    retailerId: z.string().min(1).max(200).nullable(),
    packageContent: ExactQuantityDtoSchema,
    packageCount: z.number().int().positive(),
    unitPrice: MoneyDtoSchema.nullable(),
    lineCost: MoneyDtoSchema.nullable(),
    availability: z.enum(['available', 'unknown', 'out_of_stock']),
    expiry: z
      .object({ date: z.string().date(), kind: z.enum(['use_by', 'best_before', 'estimated']) })
      .strict()
      .nullable(),
  })
  .strict();
const PurchaseLineDtoSchema = z
  .object({
    requirementId: z.string().min(1).max(500),
    ingredientId: z.string().min(1).max(200),
    required: ExactQuantityDtoSchema,
    sourceMealSlots: z.array(SlotProvenanceDtoSchema),
    selectedPackages: z.array(PurchasePackageDtoSchema),
    purchased: ExactQuantityDtoSchema,
    surplus: ExactQuantityDtoSchema,
    knownCost: MoneyDtoSchema,
    totalCost: MoneyDtoSchema.nullable(),
    unknownPricePackageCount: z.number().int().nonnegative(),
    bestKnownCompleteCost: MoneyDtoSchema.nullable(),
    provenMinimumCost: MoneyDtoSchema.nullable(),
    reasons: z.array(CodeSchema),
  })
  .strict();
const RequirementDtoSchema = z
  .object({
    id: z.string().min(1).max(500),
    ingredientId: z.string().min(1).max(200),
    required: ExactQuantityDtoSchema.nullable(),
    knownRequired: ExactQuantityDtoSchema,
    status: z.enum(['known', 'unresolved']),
    optional: z.boolean(),
    sourceMealSlots: z.array(SlotProvenanceDtoSchema),
    unresolvedCount: z.number().int().nonnegative(),
  })
  .strict();

/** Public shopping result: all engine evidence and search branches remain server-only. */
const ShoppingResultDtoObjectSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(200),
    mealPlanId: z.string().min(1).max(200),
    currency: CurrencySchema,
    currencyMinorDigits: z.number().int().min(0).max(2),
    priceSnapshot: z
      .object({ id: z.string().min(1).max(200), asOf: InstantSchema, requiresRevalidationBeforeAcceptance: z.literal(true) })
      .strict(),
    planner: z
      .object({
        status: z.enum(['feasible', 'partial', 'infeasible', 'search_limited', 'incomplete']),
        conclusion: z.enum(['feasible', 'proven_infeasible', 'no_plan_found_without_proof']),
        truncated: z.boolean(),
        limitReasons: z.array(CodeSchema),
        incompleteReasons: z.array(CodeSchema),
        unplannedSlots: z.array(z.object({ slotId: z.string(), date: z.string().date(), reasons: z.array(CodeSchema) }).strict()),
      })
      .strict(),
    shoppingCompleteness: z.enum(['complete', 'partial']),
    shoppingStatus: z.enum(['fulfilled', 'unfulfillable', 'unknown']),
    requirements: z.array(RequirementDtoSchema),
    optionalRequirements: z.array(RequirementDtoSchema),
    purchaseLines: z.array(PurchaseLineDtoSchema),
    unresolvedRequirements: z.array(z.object({ requirementId: z.string(), code: CodeSchema }).strict()),
    cost: z
      .object({
        knownCost: MoneyDtoSchema,
        totalCost: MoneyDtoSchema.nullable(),
        status: z.enum(['known', 'partial', 'unknown']),
        unknownCostItemCount: z.number().int().nonnegative(),
        bestKnownCompleteCost: MoneyDtoSchema.nullable(),
        minimumCost: MoneyDtoSchema.nullable(),
        provenKnownCostLowerBound: MoneyDtoSchema,
      })
      .strict(),
    budget: z
      .object({
        status: z.enum(['within_budget', 'over_budget', 'unknown', 'not_configured']),
        selectedKnownGap: MoneyDtoSchema,
        knownRemaining: MoneyDtoSchema.nullable(),
        provenGap: MoneyDtoSchema,
        replanRecommended: z.boolean(),
        largestKnownCostDrivers: z.array(z.object({ ingredientId: z.string(), knownCost: MoneyDtoSchema }).strict()),
        ingredientsWithNoCheaperKnownOption: z.array(z.string()),
        unknownPriceRequirementIds: z.array(z.string()),
      })
      .strict(),
    existingInventoryRemainder: z.array(
      z
        .object({
          lotId: z.string().min(1).max(200),
          ingredientId: z.string().min(1).max(200),
          remaining: ExactQuantityDtoSchema,
          risk: WasteRiskDtoSchema,
        })
        .strict(),
    ),
    purchaseSurplus: z.array(z.object({
      requirementId: z.string(), ingredientId: z.string(), purchaseOptionId: z.string(),
      quantity: ExactQuantityDtoSchema, risk: WasteRiskDtoSchema,
    }).strict()),
    wasteSummary: z
      .object({
        existingAtRiskLotCount: z.number().int().nonnegative(),
        purchaseAtRiskSurplusCount: z.number().int().nonnegative(),
        unknownRiskItemCount: z.number().int().nonnegative(),
        assessedItemCount: z.number().int().nonnegative(),
        coverage: z.number().min(0).max(1).nullable(),
        certainWasteQuantity: z.null(),
      })
      .strict(),
    optimization: z
      .object({
        exhaustive: z.boolean(),
        searchExhaustive: z.boolean(),
        truncated: z.boolean(),
        limitReasons: z.array(CodeSchema),
        incompleteReasons: z.array(CodeSchema),
        proofScope: z.literal('supplied_comparable_catalog_per_ingredient_package_cost'),
      })
      .strict(),
    diagnostics: z.array(z.object({ code: CodeSchema, requirementId: z.string().nullable(), ingredientId: z.string().nullable(), purchaseOptionId: z.string().nullable() }).strict()),
  })
  .strict();

export const ShoppingResultDtoSchema = ShoppingResultDtoObjectSchema.superRefine(
  (result, context) => {
    if (result.currencyMinorDigits !== CurrencyMinorDigits[result.currency]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currencyMinorDigits'],
        message: 'Currency minor digits must match currency',
      });
    }
  },
);
export type ShoppingResultDto = z.infer<typeof ShoppingResultDtoSchema>;
