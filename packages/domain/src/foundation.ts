import { z } from 'zod';
import type { StandardUnit } from './index';

// Preserve Zod3 timestamp grammar and stored bytes; callers retain their stricter instant checks.
const dateTimeSource = `${z.regexes.date.source.slice(0, -1)}T${z.regexes.time({}).source.slice(1, -1)}`;
export const UtcDateTimeSchema = z.string().regex(new RegExp(`${dateTimeSource}Z$`), 'Invalid datetime');
export const OffsetDateTimeSchema = z.string().regex(new RegExp(`${dateTimeSource}(?:Z|[+-]\\d{2}:?\\d{2})$`), 'Invalid datetime');

export const StandardUnitSchema = z.enum(['g', 'kg', 'ml', 'l', 'piece', 'pack', 'bunch', 'slice']);
export const PositiveQuantitySchema = z.number().finite().positive().lt(1e308);
const NonnegativeQuantitySchema = z.number().finite().nonnegative().lt(1e308);
export const CatalogIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);
export const CanonicalIngredientIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Invalid canonical ingredient ID')
  .refine((id) => id === id.trim(), 'Invalid canonical ingredient ID');
export const CatalogTextSchema = z.string().trim().min(1).max(300);

export const UNIT_DEFINITIONS = {
  g: { dimension: 'mass', baseUnit: 'g', factorToBase: 1 },
  kg: { dimension: 'mass', baseUnit: 'g', factorToBase: 1000 },
  ml: { dimension: 'volume', baseUnit: 'ml', factorToBase: 1 },
  l: { dimension: 'volume', baseUnit: 'ml', factorToBase: 1000 },
  piece: { dimension: 'count', baseUnit: 'piece', factorToBase: 1 },
  pack: { dimension: 'contextual', baseUnit: 'pack', factorToBase: 1 },
  bunch: { dimension: 'contextual', baseUnit: 'bunch', factorToBase: 1 },
  slice: { dimension: 'contextual', baseUnit: 'slice', factorToBase: 1 },
} as const satisfies Record<
  StandardUnit,
  {
    dimension: 'mass' | 'volume' | 'count' | 'contextual';
    baseUnit: StandardUnit;
    factorToBase: number;
  }
>;

// Preserve accents and word boundaries; never strip retail quantities or use substring matching.
export function normalizeIngredientAlias(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

export const LanguageTagSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .transform((value, ctx) => {
    try {
      return Intl.getCanonicalLocales(value)[0].toLowerCase();
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid language tag' });
      return z.NEVER;
    }
  });
export const IngredientAliasSchema = z
  .object({
    language: LanguageTagSchema.default('und'),
    alias: CatalogTextSchema,
  })
  .strict();
export const IngredientNameSchema = z
  .object({
    language: LanguageTagSchema,
    name: CatalogTextSchema,
  })
  .strict();

export const IngredientDefinitionSchema = z
  .object({
    id: CanonicalIngredientIdSchema,
    defaultName: CatalogTextSchema,
    names: z.array(IngredientNameSchema).max(100).default([]),
    aliases: z.array(IngredientAliasSchema).max(300).default([]),
    category: z.enum([
      'meat',
      'vegetable',
      'egg',
      'dairy',
      'spice',
      'seafood',
      'grain',
      'fruit',
      'other',
    ]),
    subcategory: CatalogTextSchema.optional(),
    defaultUnit: StandardUnitSchema,
    defaultShelfLifeDays: z.number().int().positive(),
  })
  .strict()
  .superRefine((ingredient, ctx) => {
    const languages = ingredient.names.map((name) => name.language);
    if (new Set(languages).size !== languages.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['names'],
        message: 'One name per language is required',
      });
    }
  });
export type IngredientDefinition = z.infer<typeof IngredientDefinitionSchema>;

export const NutritionProfileSchema = z
  .object({
    id: CatalogIdSchema,
    basisQuantity: PositiveQuantitySchema,
    basisUnit: z.enum(['g', 'ml', 'piece', 'serving']),
    sourceType: z.enum(['authoritative', 'imported', 'calculated', 'estimated']),
    sourceReference: CatalogTextSchema,
    energyKcal: NonnegativeQuantitySchema.optional(),
    proteinG: NonnegativeQuantitySchema.optional(),
    carbohydrateG: NonnegativeQuantitySchema.optional(),
    fatG: NonnegativeQuantitySchema.optional(),
    fiberG: NonnegativeQuantitySchema.optional(),
    sugarG: NonnegativeQuantitySchema.optional(),
    sodiumMg: NonnegativeQuantitySchema.optional(),
  })
  .strict()
  .refine(
    (profile) =>
      [
        profile.energyKcal,
        profile.proteinG,
        profile.carbohydrateG,
        profile.fatG,
        profile.fiberG,
        profile.sugarG,
        profile.sodiumMg,
      ].some((value) => value !== undefined),
    { message: 'At least one nutrient must be known' },
  );
export type NutritionProfile = z.infer<typeof NutritionProfileSchema>;

export const StorageGuidelineSchema = z
  .object({
    ingredientId: CanonicalIngredientIdSchema,
    storage: z.enum(['fridge', 'freezer', 'pantry']),
    packageState: z.enum(['sealed', 'opened']),
    shelfLifeDays: z.number().int().positive(),
    sourceType: z.enum(['authoritative', 'imported', 'estimated']),
    sourceReference: CatalogTextSchema,
  })
  .strict();
export type StorageGuideline = z.infer<typeof StorageGuidelineSchema>;

export const InventoryConditionSchema = z
  .object({
    expiryDate: z.string().date().nullable().optional(),
    openedAt: OffsetDateTimeSchema.optional(),
    expiryKind: z.enum(['unknown', 'best_before', 'use_by', 'estimated']).default('unknown'),
    expirySource: z.enum(['unknown', 'user', 'ocr', 'imported', 'estimated']).default('unknown'),
  })
  .strict()
  .refine(
    (condition) =>
      Boolean(condition.expiryDate) ||
      (condition.expiryKind === 'unknown' && condition.expirySource === 'unknown'),
    { message: 'Expiry evidence requires a date' },
  );
export type InventoryCondition = z.infer<typeof InventoryConditionSchema>;
