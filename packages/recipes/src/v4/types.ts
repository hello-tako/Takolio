import type { StandardUnit, AllergenGroupV4 } from '@takolio/domain';
import type { Recipe, RecipeIngredient, RecipeStep } from '../types';

export type CulinaryPhaseV4 = 'mise_en_place' | 'marinate' | 'active_cook' | 'plate';

export type StepTechniqueV4 =
  | 'prep'
  | 'marinate'
  | 'stir_fry'
  | 'braise'
  | 'simmer'
  | 'steam'
  | 'fry'
  | 'plate';

export type StepCookwareV4 =
  | 'prep_board'
  | 'wok'
  | 'claypot'
  | 'stockpot'
  | 'steamer'
  | 'pan';

export type StepHeatLevelV4 =
  | 'off'
  | 'low'
  | 'medium_low'
  | 'medium'
  | 'medium_high'
  | 'high';

export interface StepIngredientAllocationV4 {
  ingredientId: string;
  name: string;
  allocatedQuantity: number;
  totalRecipeQuantity: number;
  unit: StandardUnit;
  allocationRatio: number;
  usageKind: 'prep_whole' | 'split_portion' | 'full_addition' | 'use_prepped';
  roleLabelVi: string;
  formattedAmountVi: string;
}

export interface RecipeStepV4 extends RecipeStep {
  titleVi: string;
  phase: CulinaryPhaseV4;
  phaseLabelVi: string;
  technique: StepTechniqueV4;
  techniqueLabelVi: string;
  cookware: StepCookwareV4;
  cookwareLabelVi: string;
  heatLevel: StepHeatLevelV4;
  heatLabelVi: string;
  sensoryCue: string;
  stepIngredients: StepIngredientAllocationV4[];
  estimatedDurationMinutes: number;
  isPassiveWait: boolean;
  dependsOnStepNumbers: number[];
}

export interface EquipmentItemV4 {
  id: StepCookwareV4;
  labelVi: string;
  descriptionVi: string;
}

export interface RecipeNutritionV4 {
  calories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  source: 'recipe_declared' | 'ingredient_estimated';
}

export type DishArtworkIdV4 =
  | 'vn-braised-claypot'
  | 'vn-sour-soup'
  | 'vn-stirfry-greens'
  | 'vn-pho-noodle'
  | 'vn-tofu-vegetarian'
  | 'vn-grilled-lemongrass'
  | 'vn-crispy-fried'
  | 'vn-porridge-congee'
  | 'vn-fresh-rolls'
  | 'vn-steamed-rice-tray'
  | 'gl-japanese-donburi'
  | 'gl-korean-bibimbap'
  | 'gl-italian-pasta'
  | 'gl-thai-curry'
  | 'gl-chinese-wok'
  | 'culinary-signature-default';

export type DishPhotoSlugV5 =
  | 'bo-kho-banh-mi'
  | 'bo-xao-can-toi'
  | 'bun-bo-hue'
  | 'bun-cha-ha-noi'
  | 'ca-chien-mam-gung'
  | 'ca-kho-to'
  | 'canh-bi-do-suon'
  | 'canh-chua-ca'
  | 'canh-cua-rau-day'
  | 'canh-ga-chien-mam'
  | 'canh-kho-qua'
  | 'canh-ngao-chua'
  | 'chao-ga-gung'
  | 'com-tam-suon'
  | 'dau-phu-sot-ca'
  | 'ga-hap-la-chanh'
  | 'ga-kho-gung'
  | 'gl-chinese-wok'
  | 'gl-italian-pasta'
  | 'gl-japanese-donburi'
  | 'gl-korean-bibimbap'
  | 'gl-thai-curry'
  | 'goi-cuon-tom-thit'
  | 'nem-ran-cha-gio'
  | 'pho-bo-ha-noi'
  | 'rau-luoc-kho-quet'
  | 'rau-muong-xao'
  | 'suon-xao-chua-ngot'
  | 'thit-kho-tau'
  | 'thit-luoc-ca-phao'
  | 'tom-rim-mam'
  | 'trung-chien-thit';

export interface RecipeArtworkV4 {
  artworkId: DishArtworkIdV4;
  photoSlug: DishPhotoSlugV5;
  url: string;
  fallbackUrl: string;
  categoryLabelVi: string;
  accentTone: 'terracotta' | 'jade' | 'amber' | 'cobalt';
  width: number;
  height: number;
  aspectRatio: string;
}

export interface RecipeV4 extends Recipe {
  v4SchemaVersion: 4;
  baseServings: number;
  prepTimeMinutes: number;
  activeCookTimeMinutes: number;
  passiveSimmerMinutes: number;
  totalTimeMinutes: number;
  steps: RecipeStepV4[];
  equipmentList: EquipmentItemV4[];
  estimatedNutrition: RecipeNutritionV4;
  artwork: RecipeArtworkV4;
}

export interface ScaledIngredientV4 extends RecipeIngredient {
  baseQuantity: number;
  scalingMode: 'linear' | 'sublinear_seasoning' | 'countable_rounded';
  appliedFactor: number;
  formattedAmountVi: string;
}

export interface ScaledRecipeV4 extends Omit<RecipeV4, 'ingredients'> {
  targetServings: number;
  scalingFactor: number;
  subLinearFactor: number;
  panCrowdingWarningVi: string | null;
  ingredients: ScaledIngredientV4[];
}

export type AllergenTagV4 =
  | AllergenGroupV4
  | 'gluten'
  | 'pork'
  | 'beef';

export type DietaryTagV4 =
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'eat_clean'
  | 'low_carb'
  | 'pescatarian'
  | 'dairy_free'
  | 'gluten_free'
  | 'high_protein';

export interface DietarySafetyPreferencesV4 {
  allergens?: readonly string[];
  dietaryTags?: readonly string[];
  requiredDietaryTags?: readonly string[];
  forbiddenIngredientIds?: readonly string[];
}

export interface DietarySafetyConflictV4 {
  kind: 'allergen' | 'dietary' | 'forbidden_ingredient';
  key: string;
  reasonVi: string;
  matchedFrom: 'ingredient' | 'title_or_step' | 'nutrition';
  evidence: string;
}

export interface DietarySafetyEvaluationV4 {
  recipeId: string;
  safe: boolean;
  verdict: 'safe' | 'conflict';
  detectedAllergens: AllergenTagV4[];
  compliantDiets: DietaryTagV4[];
  conflicts: DietarySafetyConflictV4[];
  allergenConflicts: DietarySafetyConflictV4[];
  dietaryConflicts: DietarySafetyConflictV4[];
  forbiddenIngredientConflicts: string[];
  rankingSafetyEvidence: Array<{
    kind: 'allergen' | 'dietary';
    key: string;
    verdict: 'safe' | 'conflict';
    sourceReference: string;
  }>;
}

export type MamComColorSlot = 'terracotta' | 'jade' | 'amber' | 'cobalt';

export interface ParallelTimelineStep {
  timelineStepId: string;
  orderIndex: number;
  recipeId: string;
  recipeSlug: string;
  recipeTitle: string;
  dishColorSlot: MamComColorSlot;
  dishRoleVi: string;
  originalStepNumber: number;
  startMinuteOffset: number;
  endMinuteOffset: number;
  durationMinutes: number;
  isPassiveBackground: boolean;
  overlapsWithRecipeTitles: string[];
  parallelHintVi: string | null;
  step: RecipeStepV4;
}

export interface ConsolidatedMamComIngredient {
  ingredientId: string;
  name: string;
  totalQuantity: number;
  unit: StandardUnit;
  formattedAmountVi: string;
  usedInRecipes: string[];
  isPantryStaple: boolean;
}

export interface ParallelCookingDishSummary {
  recipeId: string;
  slug: string;
  title: string;
  dishRoleVi: string;
  dishColorSlot: MamComColorSlot;
  enrichedRecipe: ScaledRecipeV4 | RecipeV4;
}

export interface ParallelCookingPlan {
  planId: string;
  targetServings: number;
  dishes: ParallelCookingDishSummary[];
  timelineSteps: ParallelTimelineStep[];
  consolidatedIngredients: ConsolidatedMamComIngredient[];
  equipmentSummary: EquipmentItemV4[];
  sequentialTotalMinutes: number;
  parallelTotalMinutes: number;
  savedMinutes: number;
  burnerConcurrencyPeak: number;
  summaryHeadlineVi: string;
}
