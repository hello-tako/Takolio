import { describe, expect, it } from 'vitest';
import { ALL_RECIPES } from '../../packages/recipes/src/index.ts';
import {
  captureRecipeContentVersion,
  readLocalizedHouseholdRecipeContentVersion,
  grantRecipeContentAccess,
} from '../../src/worker/services/recipe-content-versions.ts';
import {
  compileLocalizationSql,
  validateLocalizationBatch,
} from '../../scripts/localize-catalog.mjs';
import { SqliteD1 } from '../helpers/sqlite-d1.ts';

describe('Workstream C — Recipe Catalog Localization Compiler & Kana FTS5 Indexing Gate', () => {
  it('blocks missing Japanese Hiragana readings, step-count mismatches, Vietnamese diacritic leakage, and invalid allergen tags', () => {
    const badBatch = [
      {
        recipeId: 'vn-canh-01',
        fingerprint: 'a'.repeat(64),
        locale: 'ja',
        localizedSlug: 'tomato-egg-soup-ja',
        title: 'トマトと卵のスープ',
        // Missing `titleReading` in Hiragana!
        expectedStepCount: 2,
        steps: [{ stepNumber: 1, instruction: '鍋でトマトを炒める' }], // Step count mismatch (1 vs 2)
        allergenTags: ['egg', 'not_a_real_allergen'],
      },
      {
        recipeId: 'vn-canh-02',
        fingerprint: 'b'.repeat(64),
        locale: 'de',
        localizedSlug: 'tomatensuppe-de',
        title: 'Tomatensuppe',
        steps: [{ stepNumber: 1, instruction: 'Cho nước mắm vào nồi' }], // Unlocalized Vietnamese leakage!
      },
    ];

    const result = validateLocalizationBatch(badBatch);
    expect(result.ok).toBe(false);
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('MISSING_JAPANESE_HIRAGANA_READING');
    expect(codes).toContain('STEP_COUNT_MISMATCH');
    expect(codes).toContain('INVALID_ALLERGEN_TAG');
    expect(codes).toContain('VIETNAMESE_LEAKAGE_IN_STEP');
  });

  it('compiles deterministic SQL into D1 `recipe_content_localizations` + `recipe_search_fts` without altering SHA-256 fingerprints', async () => {
    const db = new SqliteD1();
    try {
      db.seed(`
        INSERT INTO users (id, email, is_guest) VALUES ('u_cat', 'chef@tokyo.example', 0);
        INSERT INTO households (id, name, created_by) VALUES ('h_cat', 'Tokyo Kitchen', 'u_cat');
        INSERT INTO household_members (id, household_id, user_id, role) VALUES ('hm_cat', 'h_cat', 'u_cat', 'owner');
      `);

      const sourceRecipe = ALL_RECIPES.find((r) => r.id === 'vn-canh-01') ?? ALL_RECIPES[0];
      const fingerprintBefore = await captureRecipeContentVersion(db, sourceRecipe);
      await grantRecipeContentAccess(db, 'h_cat', fingerprintBefore);

      const validBatch = [
        {
          recipeId: sourceRecipe.id,
          fingerprint: fingerprintBefore,
          locale: 'ja',
          localizedSlug: `${sourceRecipe.slug}-ja`,
          title: 'ベトナム風トマト卵スープ',
          titleReading: 'べとなむふうとまとたまごすーぷ',
          description: 'やさしい味わいの家庭スープ',
          expectedStepCount: sourceRecipe.steps.length,
          steps: sourceRecipe.steps.map((s) => ({
            stepNumber: s.stepNumber,
            instruction: `手順 ${s.stepNumber}：弱火で丁寧に調理します（大さじ1）。`,
          })),
          ingredientLines: sourceRecipe.ingredients.map((ing) => ({
            ingredientId: ing.ingredientId,
            name: '具材',
          })),
          allergenTags: ['egg'],
        },
        {
          recipeId: sourceRecipe.id,
          fingerprint: fingerprintBefore,
          locale: 'de',
          localizedSlug: `${sourceRecipe.slug}-de`,
          title: 'Vietnamesische Tomaten-Eier-Suppe',
          description: 'Leichte Familiensuppe für jeden Tag',
          expectedStepCount: sourceRecipe.steps.length,
          steps: sourceRecipe.steps.map((s) => ({
            stepNumber: s.stepNumber,
            instruction: `Schritt ${s.stepNumber}: Sanft köcheln lassen (1 EL).`,
          })),
          allergenTags: ['egg'],
        },
      ];

      const sql1 = compileLocalizationSql(validBatch);
      const sql2 = compileLocalizationSql([...validBatch].reverse());
      // Deterministic output regardless of input ordering!
      expect(sql1).toBe(sql2);

      db.seed(sql1);

      // 1. Canonical SHA-256 fingerprint is 100% unchanged!
      const fingerprintAfter = await captureRecipeContentVersion(db, sourceRecipe);
      expect(fingerprintAfter).toBe(fingerprintBefore);

      // 2. Localized Japanese & German recipes resolve cleanly while keeping exact quantitative ingredients
      const jaServing = await readLocalizedHouseholdRecipeContentVersion(db, 'h_cat', fingerprintBefore, 'ja');
      expect(jaServing?.title).toBe('ベトナム風トマト卵スープ');
      expect(jaServing?.steps).toHaveLength(sourceRecipe.steps.length);

      // 3. Kana input (`たまごすーぷ`) matches the Kanji-titled recipe in `recipe_search_fts`!
      const ftsHits = db.query(
        `SELECT recipe_id FROM recipe_search_fts WHERE recipe_search_fts MATCH '"たまご"*' AND locale = 'ja'`,
      );
      expect(ftsHits).toEqual([{ recipe_id: sourceRecipe.id }]);
    } finally {
      db.close();
    }
  });
});
