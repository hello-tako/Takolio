import {
  RecipeFavoritesDtoSchema,
  RecipeFavoriteStateSchema,
  SaveRecipeFavoriteSchema,
  type RecipeFavoritesDto,
} from '../../../packages/domain/src/recipe-favorites-api';
import { fetchJson } from './http';
export type FavoriteEntry = RecipeFavoritesDto['entries'][number];
export const recipeFavoritesApi = {
  async list() {
    return RecipeFavoritesDtoSchema.parse(
      await fetchJson('/recipe-favorites', { cache: 'no-store' }),
    );
  },
  async state(recipeId: string) {
    return RecipeFavoriteStateSchema.parse(
      await fetchJson(`/recipe-favorites/${encodeURIComponent(recipeId)}`, { cache: 'no-store' }),
    );
  },
  async set(recipeId: string, expectedRevision: number, isSaved: boolean) {
    const state = RecipeFavoriteStateSchema.parse(
      await fetchJson(`/recipe-favorites/${encodeURIComponent(recipeId)}`, {
        method: 'PUT',
        body: JSON.stringify(SaveRecipeFavoriteSchema.parse({ expectedRevision, isSaved })),
      }),
    );
    if (state.recipeId !== recipeId || state.isSaved !== isSaved)
      throw new Error('Favorite response mismatch');
    return state;
  },
};
