import compiledCatalogJson from '../../../../data/recipe-standard/v4/compiled-runtime-500.json';
import {
  createRecipeAuthoritySnapshot,
  type RecipeAuthoritySnapshot,
} from '../recipe-authority';
import { RuntimeRecipeSchema, type RuntimeRecipe } from '../runtime-recipe';

interface CompiledRuntimeCatalogPayload {
  schemaVersion: number;
  recipeCount: number;
  fingerprint: string;
  recipes: unknown[];
}

const payload = compiledCatalogJson as CompiledRuntimeCatalogPayload;

export function isStandardV4CatalogReady(): boolean {
  return Array.isArray(payload.recipes) && payload.recipes.length === 500;
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
