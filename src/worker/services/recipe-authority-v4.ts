import {
  isStandardV4CatalogReady,
  StandardV4RecipeAuthority,
} from '../../../packages/recipes/src/standard-v4/authority';
import {
  resolveRecipeAuthority,
  type RecipeAuthorityEnv,
  type RecipeAuthorityResolution,
  type ResolveRecipeAuthorityOptions,
} from './recipe-authority';

export type RecipeAuthorityV4Env = RecipeAuthorityEnv & {
  RECIPE_CATALOG_V4_STANDARD_ENABLED?: string;
};

const standardV4Authority = new StandardV4RecipeAuthority();

export async function resolveRecipeAuthorityV4(
  env: RecipeAuthorityV4Env,
  options: ResolveRecipeAuthorityOptions = {},
): Promise<RecipeAuthorityResolution> {
  const resolution = await resolveRecipeAuthority(env, options);
  if (
    env.RECIPE_CATALOG_V4_STANDARD_ENABLED === 'true' &&
    resolution.actualSource === 'static' &&
    isStandardV4CatalogReady()
  ) {
    const v4Snapshot = await standardV4Authority.load();
    return { ...resolution, snapshot: v4Snapshot };
  }
  return resolution;
}
