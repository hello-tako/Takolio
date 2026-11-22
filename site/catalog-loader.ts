import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  GLOBAL_RECIPES,
  resolveSelfHostedRecipeImage,
  synthesizeEnglishRecipeMeta,
  synthesizeEnglishSteps,
  translateIngredientNameToEn,
  VIETNAMESE_RECIPES,
  type SiteRecipeRecord,
} from '@frigo/recipes';
import type { SiteRecipeIndexEntry } from '../src/site/types/ssr-data';

type ValidCuisine = SiteRecipeRecord['cuisine'];
const VALID_CUISINES = new Set<ValidCuisine>([
  'vietnamese',
  'chinese',
  'japanese',
  'korean',
  'thai',
  'italian',
]);

interface JsonlRawRecipe {
  sourceRecordId?: string;
  title?: string;
  description?: string;
  slug?: string;
  cuisine?: string;
  category?: string;
  region?: string | null;
  cookTimeMinutes?: number;
  servings?: number;
  difficulty?: string;
  ingredients?: Array<{
    text?: string;
    name?: string;
    ingredientId?: string;
    quantity?: number;
    requiredQuantity?: number;
    unit?: string;
  }>;
  steps?: Array<{
    stepNumber?: number;
    instruction?: string;
    timerMinutes?: number;
  }>;
  tags?: string[];
  nutrition?: { calories?: number; proteinG?: number; fatG?: number; carbG?: number };
}

function normalizeCuisine(raw: string | undefined): ValidCuisine {
  const key = (raw || 'vietnamese').toLowerCase() as ValidCuisine;
  return VALID_CUISINES.has(key) ? key : 'vietnamese';
}

function normalizeDifficulty(raw: string | undefined): 'easy' | 'medium' | 'hard' {
  if (raw === 'hard' || raw === 'medium') return raw;
  return 'easy';
}

function buildRecord(input: {
  id: string;
  slug: string;
  title: string;
  description: string;
  cuisine: string;
  category?: string | null;
  region?: string | null;
  cookTimeMinutes: number;
  servings: number;
  difficulty?: string;
  ingredients: Array<{ ingredientId: string; name: string; quantity: number; unit: string }>;
  steps: Array<{ stepNumber: number; instruction: string; timerMinutes?: number }>;
  tags?: string[];
  nutrition?: { calories?: number; proteinG?: number; fatG?: number; carbG?: number } | null;
}): SiteRecipeRecord {
  const cuisine = normalizeCuisine(input.cuisine);
  const category = input.category || 'mon_gia_dinh';
  const ingredients = input.ingredients.map((ing) => ({
    ingredientId: ing.ingredientId,
    nameVi: ing.name,
    nameEn: translateIngredientNameToEn(ing.ingredientId, ing.name),
    quantity: Number.isFinite(ing.quantity) && ing.quantity > 0 ? ing.quantity : 1,
    unit: ing.unit || 'g',
  }));

  const { titleEn, descriptionEn } = synthesizeEnglishRecipeMeta({
    slug: input.slug,
    titleVi: input.title,
    descriptionVi: input.description,
    cuisine,
    category,
    cookTimeMinutes: input.cookTimeMinutes,
    servings: input.servings,
    ingredients: ingredients.map((i) => ({
      ingredientId: i.ingredientId,
      nameVi: i.nameVi,
      quantity: i.quantity,
      unit: i.unit,
    })),
  });

  const steps = synthesizeEnglishSteps({
    steps: input.steps,
    ingredientsEn: ingredients.map((i) => i.nameEn),
    cookTimeMinutes: input.cookTimeMinutes,
  });

  return {
    id: input.id,
    slug: input.slug,
    cuisine,
    category,
    region: input.region ?? null,
    cookTimeMinutes: Math.max(5, Math.round(input.cookTimeMinutes || 20)),
    servings: Math.max(1, Math.min(20, Math.round(input.servings || 4))),
    difficulty: normalizeDifficulty(input.difficulty),
    imageUrl: resolveSelfHostedRecipeImage(input.slug, cuisine, category),
    titleVi: input.title,
    titleEn,
    descriptionVi: input.description,
    descriptionEn,
    nutrition: input.nutrition ?? null,
    ingredients,
    steps,
    tags: input.tags ?? [],
  };
}

function readJsonlBatch(absPath: string): JsonlRawRecipe[] {
  const lines = readFileSync(absPath, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const items: JsonlRawRecipe[] = [];
  for (const line of lines) {
    const parsed = JSON.parse(line) as JsonlRawRecipe & { schemaVersion?: number };
    if (parsed.schemaVersion !== undefined || !parsed.slug || !parsed.title) continue;
    items.push(parsed);
  }
  return items;
}

/**
 * Loads all 500 verified global recipes (59 VN bank + 12 Global baseline + 30 Pilot + 399 Scale)
 * deterministically at build/SSR prerender time.
 */
export function loadFull500SiteRecipeCatalog(repoRoot: string): SiteRecipeRecord[] {
  const bySlug = new Map<string, SiteRecipeRecord>();

  // 1. Static baseline: 59 Vietnamese + 12 Global recipes
  for (const r of [...VIETNAMESE_RECIPES, ...GLOBAL_RECIPES]) {
    if (!r.slug || bySlug.has(r.slug)) continue;
    bySlug.set(
      r.slug,
      buildRecord({
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description,
        cuisine: r.cuisine,
        category: r.category,
        region: r.region ?? null,
        cookTimeMinutes: r.cookTimeMinutes,
        servings: r.servings,
        difficulty: r.difficulty,
        ingredients: r.ingredients.map((i) => ({
          ingredientId: i.ingredientId,
          name: i.name,
          quantity: i.requiredQuantity,
          unit: i.unit,
        })),
        steps: r.steps.map((s, idx) => ({
          stepNumber: s.stepNumber ?? idx + 1,
          instruction: s.instruction,
          timerMinutes: s.timerMinutes,
        })),
        tags: r.tags,
        nutrition: r.nutrition ?? null,
      }),
    );
  }

  // 2. Approved T14F import batches: 30 Pilot + 399 Scale
  const jsonlPaths = [
    path.join(repoRoot, 'data/recipe-import/t14f/pilot-30.jsonl'),
    path.join(repoRoot, 'data/recipe-import/t14f/scale-399.jsonl'),
  ];
  for (const filePath of jsonlPaths) {
    for (const raw of readJsonlBatch(filePath)) {
      if (!raw.slug || !raw.title || bySlug.has(raw.slug)) continue;
      bySlug.set(
        raw.slug,
        buildRecord({
          id: raw.sourceRecordId || raw.slug,
          slug: raw.slug,
          title: raw.title,
          description: raw.description || raw.title,
          cuisine: raw.cuisine || 'vietnamese',
          category: raw.category,
          region: raw.region ?? null,
          cookTimeMinutes: raw.cookTimeMinutes || 25,
          servings: raw.servings || 4,
          difficulty: raw.difficulty,
          ingredients: (raw.ingredients || []).map((i) => ({
            ingredientId: i.ingredientId || 'OTHER',
            name: i.text || i.name || i.ingredientId || 'Ingredient',
            quantity: i.quantity ?? i.requiredQuantity ?? 1,
            unit: i.unit || 'g',
          })),
          steps: (raw.steps || []).map((s, idx) => ({
            stepNumber: s.stepNumber ?? idx + 1,
            instruction: s.instruction || '',
            timerMinutes: s.timerMinutes,
          })),
          tags: raw.tags,
          nutrition: raw.nutrition ?? null,
        }),
      );
    }
  }

  return Array.from(bySlug.values());
}

export function toRecipeIndexEntry(r: SiteRecipeRecord): SiteRecipeIndexEntry {
  return {
    slug: r.slug,
    cuisine: r.cuisine,
    category: r.category,
    cookTimeMinutes: r.cookTimeMinutes,
    servings: r.servings,
    difficulty: r.difficulty,
    imageUrl: r.imageUrl,
    titleVi: r.titleVi,
    titleEn: r.titleEn,
    descriptionVi: r.descriptionVi,
    descriptionEn: r.descriptionEn,
    ...(r.nutrition?.calories ? { calories: Math.round(r.nutrition.calories) } : {}),
  };
}
