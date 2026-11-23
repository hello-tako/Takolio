import { z } from 'zod';
import {
  CanonicalIngredientIdSchema,
  StandardUnitSchema,
  areUnitsCompatible,
} from '../../../domain/src';
import { findOperationalIngredientById } from '../../../domain/src/culinary-ingredients-v4';
import { RUNTIME_RECIPE_CUISINES, RUNTIME_RECIPE_REGIONS } from '../runtime-recipe';

export const STANDARD_V4_CATEGORIES = [
  'mon_canh',
  'mon_kho',
  'mon_xao',
  'mon_chien',
  'mon_hap_luoc',
  'mon_cuon_nom',
  'mon_bun_pho',
  'mon_chay',
  'mon_nhanh_sang',
  'mon_lau_tiec',
] as const;

export const STANDARD_V4_MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;

export const STANDARD_V4_METHODS = [
  'simmer',
  'braise',
  'stir_fry',
  'deep_fry',
  'pan_fry',
  'steam',
  'boil',
  'grill_roast',
  'toss_mix',
  'assemble',
] as const;

export const STANDARD_V4_COMPONENT_GROUPS = [
  'main',
  'aromatics',
  'marinade',
  'sauce',
  'broth',
  'dipping',
  'garnish',
  'process',
] as const;

export const STANDARD_V4_STEP_PHASES = [
  'prep',
  'marinate',
  'sauce',
  'cook',
  'finish',
] as const;

export const STANDARD_V4_ALLERGEN_VOCAB = new Set([
  'egg', 'milk', 'wheat', 'buckwheat', 'peanut', 'shrimp', 'crab', 'walnut', 'cashew',
  'almond', 'abalone', 'squid', 'salmon_roe', 'orange', 'kiwi', 'beef', 'sesame', 'salmon',
  'mackerel', 'soybean', 'chicken', 'banana', 'pork', 'macadamia', 'peach', 'yam', 'apple',
  'gelatin', 'crustaceans', 'fish', 'tree_nuts', 'celery', 'mustard', 'sulphites', 'lupin', 'molluscs',
]);

export const VIETNAMESE_DIACRITIC_RE =
  /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu;

export const FORBIDDEN_CITATION_RE =
  /\(theo [^)]+\)|CrabSeafood:|Helen's Recipes|https?:\/\/|dienmayxanh|cookpad|fptshop|saigonesebaguette|bachhoaxanh|cet\.edu|seriouseats|thewoksoflife|justonecookbook|mytour\.vn/iu;

export const StandardRecipeIngredientV4Schema = z
  .object({
    position: z.number().int().nonnegative(),
    ingredientId: CanonicalIngredientIdSchema,
    name: z.string().trim().min(1).max(90),
    culinaryMeasure: z.string().trim().min(1).max(80),
    prepNote: z.string().trim().min(1).max(160),
    componentGroup: z.enum(STANDARD_V4_COMPONENT_GROUPS),
    requiredQuantity: z.number().finite().positive(),
    unit: StandardUnitSchema,
    grossGrams: z.number().finite().positive(),
    edibleRetentionRatio: z.number().finite().min(0).max(1),
    edibleGrams: z.number().finite().nonnegative(),
    isOptional: z.boolean(),
    includeInShopping: z.boolean(),
  })
  .strict();

export const StandardRecipeStepV4Schema = z
  .object({
    stepNumber: z.number().int().positive(),
    phase: z.enum(STANDARD_V4_STEP_PHASES),
    title: z.string().trim().min(6).max(80),
    instruction: z.string().trim().min(85).max(1200),
    tip: z.string().trim().min(25).max(500).optional(),
    timerMinutes: z.number().int().positive().max(480).optional(),
  })
  .strict();

export const StandardRecipeNutritionV4Schema = z
  .object({
    basis: z.literal('per_serving'),
    servings: z.number().int().min(1).max(12),
    calories: z.number().int().positive(),
    energyKcal: z.number().finite().positive(),
    energyKj: z.number().finite().positive(),
    proteinG: z.number().finite().nonnegative(),
    fatG: z.number().finite().nonnegative(),
    saturatedFatG: z.number().finite().nonnegative(),
    carbG: z.number().finite().nonnegative(),
    fiberG: z.number().finite().nonnegative(),
    sugarG: z.number().finite().nonnegative(),
    sodiumMg: z.number().int().nonnegative(),
    saltG: z.number().finite().nonnegative(),
    methodology: z.literal('deterministic-edible-yield-v4'),
    sourceReferences: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const StandardRecipeV4Schema = z
  .object({
    schemaVersion: z.literal(4),
    recipeVersion: z.literal(4),
    identity: z
      .object({
        id: z.string().trim().min(1),
        slug: z.string().trim().min(1),
        title: z.string().trim().min(4).max(120),
        subtitle: z.string().trim().min(10).max(180),
      })
      .strict(),
    classification: z
      .object({
        cuisine: z.enum(RUNTIME_RECIPE_CUISINES),
        category: z.enum(STANDARD_V4_CATEGORIES),
        region: z.enum(RUNTIME_RECIPE_REGIONS).optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']),
        prepTimeMinutes: z.number().int().min(3).max(240),
        cookTimeMinutes: z.number().int().min(1).max(480),
        servings: z.number().int().min(1).max(12),
        tags: z.array(z.string().trim().min(2).max(40)).min(3).max(8),
        mealTypes: z.array(z.enum(STANDARD_V4_MEAL_TYPES)).min(1).max(3),
        methods: z.array(z.enum(STANDARD_V4_METHODS)).min(1).max(5),
        allergenTags: z.array(z.string().trim().min(1)),
      })
      .strict(),
    overview: z
      .object({
        description: z.string().trim().min(50).max(500),
        servingSuggestion: z.string().trim().min(25).max(300),
        storageAndReheat: z.string().trim().min(25).max(300),
      })
      .strict(),
    ingredients: z.array(StandardRecipeIngredientV4Schema).min(7).max(24),
    steps: z.array(StandardRecipeStepV4Schema).min(6).max(12),
    nutrition: StandardRecipeNutritionV4Schema,
    media: z
      .object({
        legacyRuntimeImageUrl: z.string().trim().min(1),
      })
      .strict(),
    provenance: z
      .object({
        version: z.literal(4),
        standardId: z.literal('takolio-culinary-standard-v4'),
        researchedFromV1Fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
        researchedFromV2Sha256: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict(),
  })
  .strict()
  .superRefine((recipe, ctx) => {
    if (recipe.classification.cuisine === 'vietnamese' && !recipe.classification.region) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['classification', 'region'],
        message: 'Vietnamese dishes require classification.region',
      });
    }

    if (new Set(recipe.classification.tags).size !== recipe.classification.tags.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['classification', 'tags'],
        message: 'Tags must be unique',
      });
    }
    if (recipe.classification.tags.some((t) => /^(?:cat|region):/u.test(t))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['classification', 'tags'],
        message: 'Tags must not contain legacy cat:/region: markers',
      });
    }
    if (new Set(recipe.classification.mealTypes).size !== recipe.classification.mealTypes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['classification', 'mealTypes'],
        message: 'mealTypes must be unique',
      });
    }
    if (new Set(recipe.classification.methods).size !== recipe.classification.methods.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['classification', 'methods'],
        message: 'methods must be unique',
      });
    }
    for (const allergen of recipe.classification.allergenTags) {
      if (!STANDARD_V4_ALLERGEN_VOCAB.has(allergen)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['classification', 'allergenTags'],
          message: `Unknown canonical allergen tag: ${allergen}`,
        });
      }
    }

    // Prose hygiene & Vietnamese diacritics
    const proseFields: Array<[string[], string]> = [
      [['identity', 'title'], recipe.identity.title],
      [['identity', 'subtitle'], recipe.identity.subtitle],
      [['overview', 'description'], recipe.overview.description],
      [['overview', 'servingSuggestion'], recipe.overview.servingSuggestion],
      [['overview', 'storageAndReheat'], recipe.overview.storageAndReheat],
    ];
    for (const [path, value] of proseFields) {
      if (!VIETNAMESE_DIACRITIC_RE.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: 'Vietnamese diacritics required',
        });
      }
      if (FORBIDDEN_CITATION_RE.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: 'Forbidden external citation or URL detected',
        });
      }
    }

    const seenIngIds = new Set<string>();
    let shoppingIncludedCount = 0;

    recipe.ingredients.forEach((ing, idx) => {
      if (ing.position !== idx) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ingredients', idx, 'position'],
          message: `Expected position ${idx}, got ${ing.position}`,
        });
      }
      if (ing.ingredientId.startsWith('ING_ENR_')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ingredients', idx, 'ingredientId'],
          message: 'Provisional ING_ENR_ IDs are forbidden in Standard V4',
        });
      }
      const canonical = findOperationalIngredientById(ing.ingredientId);
      if (!canonical) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ingredients', idx, 'ingredientId'],
          message: `Unknown operational ingredientId: ${ing.ingredientId}`,
        });
      } else if (!areUnitsCompatible(ing.unit, canonical.defaultUnit)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ingredients', idx, 'unit'],
          message: `Unit ${ing.unit} is incompatible with ${ing.ingredientId} defaultUnit ${canonical.defaultUnit}`,
        });
      }
      if (seenIngIds.has(ing.ingredientId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ingredients', idx, 'ingredientId'],
          message: `Duplicate ingredientId in recipe: ${ing.ingredientId} (aggregate split uses into one entry)`,
        });
      }
      seenIngIds.add(ing.ingredientId);

      if (!ing.includeInShopping && ing.ingredientId !== 'COOKING_WATER') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ingredients', idx, 'includeInShopping'],
          message: `Only COOKING_WATER may set includeInShopping=false (${ing.ingredientId})`,
        });
      }
      if (ing.includeInShopping) {
        shoppingIncludedCount += 1;
      }

      if (!VIETNAMESE_DIACRITIC_RE.test(ing.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ingredients', idx, 'name'],
          message: `Ingredient name must include Vietnamese diacritics: ${ing.name}`,
        });
      }
      if (FORBIDDEN_CITATION_RE.test(ing.name) || FORBIDDEN_CITATION_RE.test(ing.prepNote)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ingredients', idx],
          message: 'Forbidden external citation or URL detected in ingredient',
        });
      }
    });

    if (shoppingIncludedCount < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ingredients'],
        message: 'Recipe must have at least 6 shopping-included ingredients',
      });
    }

    let tipCount = 0;
    let timerCount = 0;
    recipe.steps.forEach((step, idx) => {
      if (step.stepNumber !== idx + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', idx, 'stepNumber'],
          message: `Expected stepNumber ${idx + 1}, got ${step.stepNumber}`,
        });
      }
      if (!VIETNAMESE_DIACRITIC_RE.test(step.title) || !VIETNAMESE_DIACRITIC_RE.test(step.instruction)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', idx],
          message: 'Step title and instruction must include Vietnamese diacritics',
        });
      }
      if (
        FORBIDDEN_CITATION_RE.test(step.title) ||
        FORBIDDEN_CITATION_RE.test(step.instruction) ||
        (step.tip && FORBIDDEN_CITATION_RE.test(step.tip))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', idx],
          message: 'Forbidden external citation or URL detected in step',
        });
      }
      if (step.tip) {
        if (!VIETNAMESE_DIACRITIC_RE.test(step.tip)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['steps', idx, 'tip'],
            message: 'Step tip must include Vietnamese diacritics',
          });
        }
        tipCount += 1;
      }
      if (step.timerMinutes !== undefined) {
        timerCount += 1;
      }
    });

    if (tipCount < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['steps'],
        message: `Recipe must include at least 3 chef tips (found ${tipCount})`,
      });
    }
    if (timerCount < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['steps'],
        message: `Recipe must include at least 2 timed steps (found ${timerCount})`,
      });
    }

    if (recipe.nutrition.servings !== recipe.classification.servings) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nutrition', 'servings'],
        message: 'Nutrition servings must match classification.servings',
      });
    }
  });

export type StandardRecipeIngredientV4 = z.infer<typeof StandardRecipeIngredientV4Schema>;
export type StandardRecipeStepV4 = z.infer<typeof StandardRecipeStepV4Schema>;
export type StandardRecipeNutritionV4 = z.infer<typeof StandardRecipeNutritionV4Schema>;
export type StandardRecipeV4 = z.infer<typeof StandardRecipeV4Schema>;
