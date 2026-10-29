import { z } from 'zod';
import {
  CanonicalIngredientIdSchema,
  CatalogIdSchema,
  CatalogTextSchema,
  PositiveQuantitySchema,
  StandardUnitSchema,
} from '../../domain/src/foundation';

const RecipeProvenanceFieldsSchema = z
  .object({
    sourceType: z
      .enum(['legacy', 'curated', 'imported', 'ai_generated', 'user_generated'])
      .default('legacy'),
    sourceReference: CatalogTextSchema.refine(
      (reference) => !reference.includes('\u0000'),
      'Invalid recipe source reference',
    ).nullish(),
    verificationState: z.enum(['unverified', 'reviewed', 'rejected']).default('unverified'),
    version: z.number().int().positive().default(1),
  })
  .strict();
function requireSourceReference(
  provenance: z.infer<typeof RecipeProvenanceFieldsSchema>,
  ctx: z.RefinementCtx,
): void {
  if (
    (provenance.sourceType === 'imported' || provenance.sourceType === 'ai_generated') &&
    !provenance.sourceReference
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceReference'],
      message: 'Imported and AI recipes require a source reference',
    });
  }
}
export const RecipeProvenanceSchema =
  RecipeProvenanceFieldsSchema.superRefine(requireSourceReference);
export type RecipeProvenance = z.infer<typeof RecipeProvenanceSchema>;

export const StructuredRecipeIngredientSchema = z
  .object({
    ingredientId: CanonicalIngredientIdSchema,
    name: CatalogTextSchema,
    requiredQuantity: PositiveQuantitySchema,
    unit: StandardUnitSchema,
    isOptional: z.boolean().default(false),
  })
  .strict();

export const RecipeDefinitionSchema = z
  .object({
    id: CatalogIdSchema,
    slug: CatalogIdSchema,
    title: CatalogTextSchema,
    description: z.string().max(10000).optional(),
    cuisine: CatalogIdSchema,
    servings: z.number().int().positive(),
    prepTimeMinutes: z.number().int().nonnegative().optional(),
    cookTimeMinutes: z.number().int().nonnegative(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    familyId: CatalogIdSchema.optional(),
    provenance: RecipeProvenanceSchema.prefault({}),
    ingredients: z.array(StructuredRecipeIngredientSchema).min(1).max(100),
  })
  .strict();
export type RecipeDefinition = z.infer<typeof RecipeDefinitionSchema>;

const FamilyOptionSchema = z
  .object({
    ingredientId: CanonicalIngredientIdSchema,
    quantity: PositiveQuantitySchema,
    unit: StandardUnitSchema,
  })
  .strict();
const FamilySlotSchema = z
  .object({
    key: CatalogIdSchema,
    minSelections: z.number().int().nonnegative(),
    maxSelections: z.number().int().positive(),
    options: z.array(FamilyOptionSchema).min(1).max(100),
  })
  .strict()
  .superRefine((slot, ctx) => {
    if (slot.minSelections > slot.maxSelections || slot.maxSelections > slot.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Selection bounds must fit the available options',
      });
    }
    if (new Set(slot.options.map((option) => option.ingredientId)).size !== slot.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'An ingredient may appear only once per slot',
      });
    }
  });
export const RecipeFamilySchema = z
  .object({
    id: CatalogIdSchema,
    slug: CatalogIdSchema,
    name: CatalogTextSchema,
    baseServings: z.number().int().positive(),
    provenance: RecipeProvenanceFieldsSchema.extend({
      sourceType: z
        .enum(['curated', 'imported', 'ai_generated', 'user_generated'])
        .default('curated'),
    })
      .superRefine(requireSourceReference)
      .prefault({}),
    slots: z.array(FamilySlotSchema).min(1).max(30),
  })
  .strict()
  .superRefine((family, ctx) => {
    if (new Set(family.slots.map((slot) => slot.key)).size !== family.slots.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Family slot keys must be unique' });
    }
  });
export type RecipeFamily = z.infer<typeof RecipeFamilySchema>;
