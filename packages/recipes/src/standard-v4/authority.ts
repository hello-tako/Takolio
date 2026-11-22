import compiledCatalogJson from '../../../../data/recipe-standard/v4/compiled-runtime-500.json';
import v4ManifestJson from '../../../../data/recipe-standard/v4/manifest.json';
import { fingerprintRecipes } from '../catalog-fingerprint';
import {
  createRecipeAuthoritySnapshot,
  type RecipeAuthorityReadiness,
  type RecipeAuthorityReadinessDetail,
  type RecipeAuthoritySnapshot,
} from '../recipe-authority';
import { RuntimeRecipeSchema, type RuntimeRecipe } from '../runtime-recipe';

interface CompiledRuntimeCatalogPayload {
  schemaVersion: number;
  recipeCount: number;
  fingerprint: string;
  recipes: unknown[];
}

interface StandardV4ManifestPayload {
  standardId: string;
  recipeCount: number;
  orderedRecipeIds: string[];
  runtimeFingerprint: string;
}

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
  readonly tags: readonly string[];
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

export interface StandardV4D1Snapshot {
  readonly recipes: readonly StandardV4D1CatalogRow[];
  readonly ingredients: readonly StandardV4D1IngredientRow[];
  readonly steps: readonly StandardV4D1StepRow[];
}

export interface StandardV4HydrationFailure {
  readonly id: string;
  readonly code: string;
}

export interface StandardV4HydrationResult {
  readonly recipes: RuntimeRecipe[];
  readonly failures: StandardV4HydrationFailure[];
}

const payload = compiledCatalogJson as CompiledRuntimeCatalogPayload;
const v4Manifest = v4ManifestJson as StandardV4ManifestPayload;

const round1 = (value: number): number => Math.round((value + Number.EPSILON) * 10) / 10;

export function isStandardV4CatalogReady(): boolean {
  return Array.isArray(payload.recipes) && payload.recipes.length === v4Manifest.recipeCount;
}

export function standardV4RuntimeFingerprint(): string {
  return v4Manifest.runtimeFingerprint;
}

export function hydrateStandardV4D1Catalog(snapshot: StandardV4D1Snapshot): StandardV4HydrationResult {
  const ingByRecipe = new Map<string, StandardV4D1IngredientRow[]>();
  for (const ing of snapshot.ingredients) {
    let list = ingByRecipe.get(ing.recipeId);
    if (!list) {
      list = [];
      ingByRecipe.set(ing.recipeId, list);
    }
    list.push(ing);
  }

  const stepsByRecipe = new Map<string, StandardV4D1StepRow[]>();
  for (const step of snapshot.steps) {
    let list = stepsByRecipe.get(step.recipeId);
    if (!list) {
      list = [];
      stepsByRecipe.set(step.recipeId, list);
    }
    list.push(step);
  }

  const orderedCatalog = [...snapshot.recipes].sort(
    (a, b) => a.runtimeOrder - b.runtimeOrder || a.id.localeCompare(b.id),
  );

  const recipes: RuntimeRecipe[] = [];
  const failures: StandardV4HydrationFailure[] = [];

  for (const row of orderedCatalog) {
    const rawIngredients = [...(ingByRecipe.get(row.id) ?? [])]
      .sort((a, b) => a.position - b.position)
      .filter((ing) => ing.includeInShopping)
      .map((ing) => ({
        ingredientId: ing.ingredientId,
        name: ing.name,
        requiredQuantity: ing.requiredQuantity,
        unit: ing.unit,
        ...(ing.isOptional ? { isOptional: true } : {}),
      }));

    const rawSteps = [...(stepsByRecipe.get(row.id) ?? [])]
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map((step) => ({
        stepNumber: step.stepNumber,
        instruction: `${step.title}: ${step.instruction}`,
        ...(step.tip !== null ? { tip: step.tip } : {}),
        ...(step.timerMinutes !== null ? { timerMinutes: step.timerMinutes } : {}),
      }));

    const candidate = {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      cuisine: row.cuisine,
      category: row.category,
      ...(row.region !== null ? { region: row.region } : {}),
      cookTimeMinutes: row.cookTimeMinutes,
      servings: row.servings,
      difficulty: row.difficulty,
      imageUrl: row.imageUrl,
      nutrition: {
        calories: Math.round(row.calories),
        proteinG: round1(row.proteinG),
        fatG: round1(row.fatG),
        carbG: round1(row.carbG),
      },
      ingredients: rawIngredients,
      steps: rawSteps,
      tags: [...row.tags],
    };

    const parsed = RuntimeRecipeSchema.safeParse(candidate);
    if (!parsed.success) {
      failures.push({ id: row.id, code: 'STANDARD_V4_RUNTIME_INVALID' });
      continue;
    }
    recipes.push(parsed.data);
  }

  return { recipes, failures };
}

export class StandardV4RecipeAuthority {
  readonly source = 'static' as const;
  private snapshot: Promise<RecipeAuthoritySnapshot> | null = null;

  constructor(
    private readonly recipes?: readonly RuntimeRecipe[],
    private readonly now: () => number = () => Date.now(),
  ) {}

  load(): Promise<RecipeAuthoritySnapshot> {
    this.snapshot ??= (async () => {
      const list = this.recipes
        ? this.recipes.map((recipe) => RuntimeRecipeSchema.parse(recipe))
        : (payload.recipes ?? []).map((recipe) => RuntimeRecipeSchema.parse(recipe));
      return createRecipeAuthoritySnapshot('static', list, this.now);
    })();
    return this.snapshot;
  }
}

export type D1StandardV4RecipeAuthorityLoad =
  | {
      status: 'ready';
      snapshot: RecipeAuthoritySnapshot;
      readiness: Extract<RecipeAuthorityReadiness, { status: 'ready' }>;
    }
  | {
      status: 'not_ready' | 'error';
      snapshot: null;
      readiness: Exclude<RecipeAuthorityReadiness, { status: 'ready' }>;
    };

const SAMPLE = 5;

export class D1StandardV4RecipeAuthority {
  readonly source = 'd1' as const;

  constructor(
    private readonly readSnapshot: () => Promise<StandardV4D1Snapshot>,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async load(): Promise<D1StandardV4RecipeAuthorityLoad> {
    let raw: StandardV4D1Snapshot;
    try {
      raw = await this.readSnapshot();
    } catch (error) {
      return {
        status: 'error',
        snapshot: null,
        readiness: {
          status: 'error',
          source: 'd1',
          code: 'D1_READ_FAILED',
          error: error instanceof Error ? error.name : 'unknown',
        },
      };
    }

    const hydration = hydrateStandardV4D1Catalog(raw);
    const actual = hydration.recipes;
    const actualFingerprint = await fingerprintRecipes(actual);
    const detail: RecipeAuthorityReadinessDetail = {
      releaseId: v4Manifest.standardId,
      expectedCount: v4Manifest.recipeCount,
      actualCount: actual.length,
      legacyBaselineCount: 0,
      hydrationFailureCount: hydration.failures.length,
      hydrationFailureSample: hydration.failures.slice(0, SAMPLE),
      idDriftSample: [],
      orderDriftSample: [],
      fieldDriftSample: [],
      expectedFingerprint: v4Manifest.runtimeFingerprint,
      actualFingerprint,
      legacyBaselineMatch: null,
      fingerprintMatch: null,
    };

    const notReady = (
      code:
        | 'CATALOG_DIAGNOSTICS'
        | 'COUNT_DRIFT'
        | 'ID_DRIFT'
        | 'ORDER_DRIFT'
        | 'FINGERPRINT_DRIFT',
    ): D1StandardV4RecipeAuthorityLoad => ({
      status: 'not_ready',
      snapshot: null,
      readiness: { status: 'not_ready', source: 'd1', code, detail },
    });

    if (hydration.failures.length > 0) return notReady('CATALOG_DIAGNOSTICS');
    if (actual.length !== v4Manifest.recipeCount) return notReady('COUNT_DRIFT');

    const actualIds = new Set(actual.map((r) => r.id));
    const expectedIds = new Set(v4Manifest.orderedRecipeIds);
    const missing = v4Manifest.orderedRecipeIds.filter((id) => !actualIds.has(id));
    const extra = actual.filter((r) => !expectedIds.has(r.id)).map((r) => r.id);
    if (missing.length || extra.length) {
      detail.idDriftSample = [...missing, ...extra].slice(0, SAMPLE);
      return notReady('ID_DRIFT');
    }

    const posById = new Map(actual.map((r, index) => [r.id, index]));
    v4Manifest.orderedRecipeIds.forEach((id, expectedIndex) => {
      const actualIndex = posById.get(id)!;
      if (actualIndex !== expectedIndex && detail.orderDriftSample.length < SAMPLE) {
        detail.orderDriftSample.push({ id, expected: expectedIndex, actual: actualIndex });
      }
    });
    if (detail.orderDriftSample.length > 0) return notReady('ORDER_DRIFT');

    detail.fingerprintMatch = actualFingerprint === v4Manifest.runtimeFingerprint;
    if (!detail.fingerprintMatch) {
      detail.idDriftSample = v4Manifest.orderedRecipeIds.slice(0, SAMPLE);
      return notReady('FINGERPRINT_DRIFT');
    }

    return {
      status: 'ready',
      snapshot: await createRecipeAuthoritySnapshot('d1', actual, this.now),
      readiness: {
        status: 'ready',
        source: 'd1',
        fingerprint: actualFingerprint,
        recipeCount: actual.length,
        releaseId: v4Manifest.standardId,
      },
    };
  }
}
