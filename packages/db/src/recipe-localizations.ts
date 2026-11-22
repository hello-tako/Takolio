import { z } from 'zod';
import { SUPPORTED_LOCALES, type SupportedLocale } from '../../domain/src/i18n';
import type { RecipeStep } from '../../recipes/src/types';
import type { D1DatabaseBinding } from './index';

const FingerprintSchema = z.string().regex(/^[0-9a-f]{64}$/);
const LocaleSchema = z.enum(SUPPORTED_LOCALES);

const LocalizedStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  instruction: z.string().trim().min(1),
  tip: z.string().trim().min(1).optional(),
  timerMinutes: z.number().int().positive().optional(),
});

const LocalizedIngredientLineSchema = z.object({
  ingredientId: z.string().min(1),
  name: z.string().trim().min(1),
});

export interface RecipeContentLocalizationInput {
  fingerprint: string;
  locale: SupportedLocale;
  localizedSlug: string;
  title: string;
  titleReading?: string | null;
  description?: string | null;
  steps: readonly RecipeStep[];
  ingredientLines?: readonly { ingredientId: string; name: string }[];
}

export interface LocalizedRecipeProjection {
  readonly fingerprint: string;
  readonly resolvedLocale: SupportedLocale;
  readonly localizedSlug: string;
  readonly title: string;
  readonly titleReading: string | null;
  readonly description: string;
  readonly steps: RecipeStep[];
  readonly ingredientNamesById: Readonly<Record<string, string>>;
}

export async function upsertRecipeContentLocalization(
  db: D1DatabaseBinding,
  input: RecipeContentLocalizationInput,
  nowIso = new Date().toISOString(),
): Promise<void> {
  const fingerprint = FingerprintSchema.parse(input.fingerprint);
  const locale = LocaleSchema.parse(input.locale);
  const localizedSlug = z.string().trim().min(1).max(200).parse(input.localizedSlug);
  const title = z.string().trim().min(1).max(300).parse(input.title);
  const titleReading = input.titleReading?.trim() ? input.titleReading.trim() : null;
  const description = input.description?.trim() ?? '';
  const steps = z.array(LocalizedStepSchema).min(1).parse(input.steps);
  const ingredientLines = input.ingredientLines
    ? z.array(LocalizedIngredientLineSchema).parse(input.ingredientLines)
    : null;

  await db
    .prepare(
      `INSERT INTO recipe_content_localizations (
         fingerprint, locale, localized_slug, title, title_reading,
         description, steps_json, ingredient_lines_json, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(fingerprint, locale) DO UPDATE SET
         localized_slug = excluded.localized_slug,
         title = excluded.title,
         title_reading = excluded.title_reading,
         description = excluded.description,
         steps_json = excluded.steps_json,
         ingredient_lines_json = excluded.ingredient_lines_json,
         updated_at = excluded.updated_at`,
    )
    .bind(
      fingerprint,
      locale,
      localizedSlug,
      title,
      titleReading,
      description,
      JSON.stringify(steps),
      ingredientLines ? JSON.stringify(ingredientLines) : null,
      nowIso,
    )
    .run();
}

/**
 * Resolves localized title/steps/ingredient labels for a pinned `recipe_content_versions`
 * `fingerprint` using fallback chain `requestedLocale -> 'en' -> 'vi'`, without changing
 * the underlying cryptographic `fingerprint`!
 */
export async function readLocalizedRecipeContent(
  db: D1DatabaseBinding,
  fingerprint: string,
  requestedLocale: SupportedLocale,
): Promise<LocalizedRecipeProjection | null> {
  const parsedFingerprint = FingerprintSchema.parse(fingerprint);
  const fallbackChain = [...new Set<SupportedLocale>([requestedLocale, 'en', 'vi'])];
  const placeholders = fallbackChain.map(() => '?').join(', ');

  const rows = await db
    .prepare(
      `SELECT fingerprint, locale, localized_slug, title, title_reading,
              description, steps_json, ingredient_lines_json
         FROM recipe_content_localizations
        WHERE fingerprint = ? AND locale IN (${placeholders})`,
    )
    .bind(parsedFingerprint, ...fallbackChain)
    .all<{
      fingerprint: string;
      locale: SupportedLocale;
      localized_slug: string;
      title: string;
      title_reading: string | null;
      description: string | null;
      steps_json: string;
      ingredient_lines_json: string | null;
    }>();

  const list = rows.results ?? [];
  if (list.length === 0) return null;

  const chosen =
    fallbackChain.map((loc) => list.find((row) => row.locale === loc)).find(Boolean) ?? list[0];

  const steps = z.array(LocalizedStepSchema).parse(JSON.parse(chosen.steps_json));
  const ingredientLines = chosen.ingredient_lines_json
    ? z.array(LocalizedIngredientLineSchema).parse(JSON.parse(chosen.ingredient_lines_json))
    : [];
  const ingredientNamesById = Object.fromEntries(
    ingredientLines.map((line) => [line.ingredientId, line.name]),
  );

  return {
    fingerprint: chosen.fingerprint,
    resolvedLocale: chosen.locale,
    localizedSlug: chosen.localized_slug,
    title: chosen.title,
    titleReading: chosen.title_reading ?? null,
    description: chosen.description ?? '',
    steps,
    ingredientNamesById,
  };
}
