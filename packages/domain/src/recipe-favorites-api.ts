import { z } from 'zod';
import { MealRoleSchema } from './meal-composition-api';
import { CatalogIdSchema } from './foundation';

export const RecipeFavoriteStateSchema = z.object({
  recipeId: CatalogIdSchema,
  revision: z.number().int().safe().nonnegative(),
  isSaved: z.boolean(),
}).strict();
export const RecipeFavoriteEntrySchema = RecipeFavoriteStateSchema.extend({
  title: z.string(), slug: z.string(), cuisine: z.string(), imageUrl: z.string(),
  region: z.enum(['bac', 'trung', 'nam', 'toan_quoc']).nullable(),
  cookTimeMinutes: z.number().nonnegative(), servings: z.number().positive(),
  difficulty: z.enum(['easy', 'medium', 'hard']), available: z.boolean(), roles: z.array(MealRoleSchema),
}).strict();
export const RecipeFavoritesDtoSchema = z.object({ entries: z.array(RecipeFavoriteEntrySchema) }).strict();
export type RecipeFavoritesDto = z.infer<typeof RecipeFavoritesDtoSchema>;
export const SaveRecipeFavoriteSchema = z.object({
  expectedRevision: z.number().int().safe().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  isSaved: z.boolean(),
}).strict();
