import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readRecipeContent } from '../../packages/db/src/recipe-content';
import { evaluateRecipeAvailability, hydrateRuntimeRecipes, scaleRecipeServings } from '../../packages/recipes/src';
import { fingerprintRecipes } from '../../packages/recipes/src/catalog-fingerprint';
import { allocateCookingLots } from '../../src/worker/routes/recipes';
import { SqliteD1 } from '../helpers/sqlite-d1';

const root = process.cwd();
const proposedSql = readFileSync(
  path.join(root, 'docs/migrations/proposed/0052_culinary_standard_v4_catalog_500.sql'),
  'utf8',
);
const v4Manifest = JSON.parse(
  readFileSync(path.join(root, 'data/recipe-standard/v4/manifest.json'), 'utf8'),
) as { runtimeFingerprint: string; orderedRecipeIds: string[] };

describe('Takolio Culinary Standard V4 — D1 replay & operational cooking/inventory parity', () => {
  let db: SqliteD1;

  beforeEach(() => {
    db = new SqliteD1();
    db.seed(proposedSql);
  });

  afterEach(() => {
    db.close();
  });

  it('replays 0001..0051 + proposed 0052 cleanly and hydrates all 500 V4 recipes with 0 failures', async () => {
    const snapshot = await readRecipeContent(db);
    expect(snapshot.recipes).toHaveLength(500);

    const hydration = hydrateRuntimeRecipes(snapshot);
    expect(hydration.failures).toEqual([]);
    expect(hydration.recipes).toHaveLength(500);
    expect(hydration.recipes.map((r) => r.id)).toEqual(v4Manifest.orderedRecipeIds);
    expect(await fingerprintRecipes(hydration.recipes)).toBe(v4Manifest.runtimeFingerprint);

    const profileRows = db.query<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM nutrition_profiles WHERE id LIKE '%_nutrition_v4'",
    );
    expect(profileRows[0]?.cnt).toBe(500);

    const versionedRows = db.query<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM recipes WHERE version = 4 AND verification_state = 'reviewed'",
    );
    expect(versionedRows[0]?.cnt).toBe(500);
  });

  it('evaluates fridge availability, serving scaling, and cooking lot deductions accurately on standardized V4 recipes', async () => {
    const snapshot = await readRecipeContent(db);
    const hydration = hydrateRuntimeRecipes(snapshot);
    const canhChua = hydration.recipes.find((r) => r.id === 'vn-canh-01')!;
    expect(canhChua).toBeDefined();
    expect(canhChua.nutrition?.calories).toBeGreaterThan(100);

    const scaled = scaleRecipeServings(canhChua, canhChua.servings * 2);
    expect(scaled.ingredients[0].requiredQuantity).toBe(canhChua.ingredients[0].requiredQuantity * 2);

    const availability = evaluateRecipeAvailability(canhChua, [
      {
        id: 'lot-fish-1',
        ingredientId: 'FISH_FRESHWATER',
        quantity: 1,
        unit: 'kg',
        freshness: 'fresh',
      },
      {
        id: 'lot-salt-1',
        ingredientId: 'SALT',
        quantity: 100,
        unit: 'g',
        freshness: 'fresh',
      },
    ]);

    const fishAvail = availability.find((item) => item.ingredientId === 'FISH_FRESHWATER');
    expect(fishAvail?.status).toBe('satisfied');
    const saltAvail = availability.find((item) => item.ingredientId === 'SALT');
    expect(saltAvail?.status).toBe('satisfied');

    const fishReq = canhChua.ingredients.find((i) => i.ingredientId === 'FISH_FRESHWATER')!;
    const alloc = allocateCookingLots(
      [{ id: 'lot-fish-1', quantity: 1, unit: 'kg', version: 1 }],
      fishReq.requiredQuantity,
      fishReq.unit,
      new Map(),
    );
    expect(alloc.remainingQuantity).toBe(0);
    expect(alloc.allocations).toHaveLength(1);
    expect(alloc.allocations[0].unit).toBe('kg');
    expect(alloc.allocations[0].quantity).toBeCloseTo(fishReq.requiredQuantity / 1000, 6);
  });
});
