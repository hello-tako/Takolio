import type { D1DatabaseBinding, D1PreparedStatement, D1Result } from './index';

export const STANDARD_V4_CATALOG_READ_STATEMENT_COUNT = 3;

export interface StandardV4D1CatalogRow {
  readonly id: string;
  readonly slug: string;
  readonly runtimeOrder: number;
  readonly title: string;
  readonly description: string;
  readonly cuisine: string;
  readonly category: string;
  readonly region: string | null;
  readonly difficulty: string;
  readonly cookTimeMinutes: number;
  readonly servings: number;
  readonly imageUrl: string;
  readonly tags: string[];
  readonly calories: number;
  readonly proteinG: number;
  readonly fatG: number;
  readonly carbG: number;
}

export interface StandardV4D1IngredientRow {
  readonly recipeId: string;
  readonly position: number;
  readonly ingredientId: string;
  readonly name: string;
  readonly requiredQuantity: number;
  readonly unit: string;
  readonly isOptional: boolean;
  readonly includeInShopping: boolean;
}

export interface StandardV4D1StepRow {
  readonly recipeId: string;
  readonly stepNumber: number;
  readonly title: string;
  readonly instruction: string;
  readonly tip: string | null;
  readonly timerMinutes: number | null;
}

export interface StandardV4D1CatalogSnapshot {
  readonly recipes: StandardV4D1CatalogRow[];
  readonly ingredients: StandardV4D1IngredientRow[];
  readonly steps: StandardV4D1StepRow[];
}

export function prepareStandardV4CatalogRead(db: D1DatabaseBinding): D1PreparedStatement[] {
  return [
    db.prepare(
      `SELECT id, slug, runtime_order, title, description, cuisine, category, region, difficulty,
          cook_time_minutes, servings, image_url, tags_json, calories, protein_g, fat_g, carb_g
       FROM recipe_standard_v4_catalog
       ORDER BY runtime_order, id`,
    ),
    db.prepare(
      `SELECT recipe_id, position, ingredient_id, name, required_quantity, unit, is_optional, include_in_shopping
       FROM recipe_standard_v4_ingredients
       ORDER BY recipe_id, position, id`,
    ),
    db.prepare(
      `SELECT recipe_id, step_number, title, instruction, tip, timer_minutes
       FROM recipe_standard_v4_steps
       ORDER BY recipe_id, step_number, id`,
    ),
  ];
}

function rowsOf(result: D1Result<unknown>, label: string): Record<string, unknown>[] {
  if (!result.success) throw new Error(`Standard V4 ${label} read failed`);
  return result.results.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`Standard V4 ${label} row is invalid`);
    }
    return row as Record<string, unknown>;
  });
}

const text = (value: unknown): string => (typeof value === 'string' ? value : String(value ?? ''));
const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value));
const numOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : num(value));

function parseStringArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

export function mapStandardV4CatalogRead(results: readonly D1Result<unknown>[]): StandardV4D1CatalogSnapshot {
  if (results.length !== STANDARD_V4_CATALOG_READ_STATEMENT_COUNT) {
    throw new Error('Standard V4 catalog batch returned an unexpected result count');
  }
  const [recipeRows, ingRows, stepRows] = results.map((result, index) =>
    rowsOf(result, ['catalog', 'ingredients', 'steps'][index]),
  );

  return {
    recipes: recipeRows.map((row) => ({
      id: text(row.id),
      slug: text(row.slug),
      runtimeOrder: num(row.runtime_order),
      title: text(row.title),
      description: text(row.description),
      cuisine: text(row.cuisine),
      category: text(row.category),
      region: textOrNull(row.region),
      difficulty: text(row.difficulty),
      cookTimeMinutes: num(row.cook_time_minutes),
      servings: num(row.servings),
      imageUrl: text(row.image_url),
      tags: parseStringArray(row.tags_json),
      calories: num(row.calories),
      proteinG: num(row.protein_g),
      fatG: num(row.fat_g),
      carbG: num(row.carb_g),
    })),
    ingredients: ingRows.map((row) => ({
      recipeId: text(row.recipe_id),
      position: num(row.position),
      ingredientId: text(row.ingredient_id),
      name: text(row.name),
      requiredQuantity: num(row.required_quantity),
      unit: text(row.unit),
      isOptional: row.is_optional === 1 || row.is_optional === true,
      includeInShopping: row.include_in_shopping === 1 || row.include_in_shopping === true,
    })),
    steps: stepRows.map((row) => ({
      recipeId: text(row.recipe_id),
      stepNumber: num(row.step_number),
      title: text(row.title),
      instruction: text(row.instruction),
      tip: textOrNull(row.tip),
      timerMinutes: numOrNull(row.timer_minutes),
    })),
  };
}

export async function readStandardV4Catalog(db: D1DatabaseBinding): Promise<StandardV4D1CatalogSnapshot> {
  return mapStandardV4CatalogRead(await db.batch(prepareStandardV4CatalogRead(db)));
}
