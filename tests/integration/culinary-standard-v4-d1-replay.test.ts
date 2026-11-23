import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readStandardV4Catalog,
  STANDARD_V4_CATALOG_READ_STATEMENT_COUNT,
} from '../../packages/db/src/recipe-standard-v4';
import { evaluateRecipeAvailability, scaleRecipeServings } from '../../packages/recipes/src';
import { currentCatalogRelease } from '../../packages/recipes/src/recipe-authority';
import { hydrateStandardV4D1Catalog } from '../../packages/recipes/src/standard-v4/authority';
import { fingerprintRecipes } from '../../packages/recipes/src/catalog-fingerprint';
import { allocateCookingLots } from '../../src/worker/routes/recipes';
import {
  recipeAuthoritySnapshotIsCurrent,
  resetRecipeAuthorityCacheForTests,
  resetRecipeAuthorityCountersForTests,
  resolveRecipeAuthority,
} from '../../src/worker/services/recipe-authority';
import { resolveRecipeAuthorityV4 } from '../../src/worker/services/recipe-authority-v4';
import {
  publicRecipeAuthorityStatus,
  recipeAuthorityReleaseEvidence,
} from '../../src/worker/services/recipe-authority-status';
import {
  CATALOG_RELEASE_MANIFEST_PATH,
  verifyRecipeAuthorityEvidence,
} from '../../scripts/release-check.mjs';
import type { Env } from '../../src/worker/types';
import { SqliteD1, type SqliteStatementEvent } from '../helpers/sqlite-d1';

const root = process.cwd();
const v4Manifest = JSON.parse(
  readFileSync(path.join(root, 'data/recipe-standard/v4/manifest.json'), 'utf8'),
) as { runtimeFingerprint: string; orderedRecipeIds: string[] };

describe('Takolio Culinary Standard V4 — live 0052 D1 replay & authority routing parity', () => {
  let db: SqliteD1;

  beforeEach(() => {
    db = new SqliteD1();
    resetRecipeAuthorityCacheForTests();
    resetRecipeAuthorityCountersForTests();
  });

  afterEach(() => {
    resetRecipeAuthorityCacheForTests();
    resetRecipeAuthorityCountersForTests();
    db.close();
  });

  it('applies 0001..0052 automatically, preserves 45 legacy ingredients, and routes D1 authority cleanly under opt-in flag', async () => {
    expect(db.migrations.at(-1)).toBe('0052_culinary_standard_v4_catalog_500.sql');

    const legacyIngredientCount = db.query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM ingredients');
    expect(legacyIngredientCount[0]?.cnt).toBe(45);

    const v4IngredientCount = db.query<{ cnt: number }>(
      'SELECT COUNT(*) AS cnt FROM culinary_standard_v4_ingredients',
    );
    expect(v4IngredientCount[0]?.cnt).toBe(249);

    const batches: number[] = [];
    const statements: SqliteStatementEvent[] = [];
    db.hooks = {
      beforeBatch: (batch) => {
        batches.push(batch.length);
        statements.push(...batch);
      },
      beforeStatement: (stmt) => {
        statements.push(stmt);
      },
    };

    const snapshot = await readStandardV4Catalog(db);
    expect(snapshot.recipes).toHaveLength(500);
    expect(batches).toEqual([STANDARD_V4_CATALOG_READ_STATEMENT_COUNT]);

    const hydration = hydrateStandardV4D1Catalog(snapshot);
    expect(hydration.failures).toEqual([]);
    expect(hydration.recipes).toHaveLength(500);
    expect(hydration.recipes.map((r) => r.id)).toEqual(v4Manifest.orderedRecipeIds);
    expect(await fingerprintRecipes(hydration.recipes)).toBe(v4Manifest.runtimeFingerprint);

    // Default V1 D1 mode remains untouched
    const v1Release = currentCatalogRelease();
    const v1D1 = await resolveRecipeAuthority({
      DB: db,
      RECIPE_CATALOG_MODE: 'd1',
      RECIPE_CATALOG_CUTOVER_ENABLED: 'true',
    } as unknown as Env);
    expect(v1D1.actualSource).toBe('d1');
    expect(v1D1.snapshot.size).toBe(500);
    expect(v1D1.snapshot.fingerprint).toBe(v1Release.expectedRuntimeFingerprint);

    // Opt-in V4 D1 mode serves 500 standardized V4 recipes from 0052 tables
    const v4Env = {
      DB: db,
      ENVIRONMENT: 'production',
      GIT_COMMIT: 'e'.repeat(40),
      RECIPE_CATALOG_MODE: 'd1',
      RECIPE_CATALOG_CUTOVER_ENABLED: 'true',
      RECIPE_CATALOG_V4_STANDARD_ENABLED: 'true',
    } as unknown as Env;
    const v4D1 = await resolveRecipeAuthorityV4(v4Env);
    expect(v4D1.actualSource).toBe('d1');
    expect(v4D1.snapshot.size).toBe(500);
    expect(v4D1.snapshot.fingerprint).toBe(v4Manifest.runtimeFingerprint);
    expect(await recipeAuthoritySnapshotIsCurrent(db, v4D1.snapshot)).toBe(true);

    const status = await publicRecipeAuthorityStatus(v4Env);
    expect(status).toMatchObject({
      configuredMode: 'd1',
      cutoverEnabled: true,
      globalSource: 'd1',
      releaseId: 'takolio-culinary-standard-v4',
      expectedRecipeCount: 500,
    });

    const evidence = await recipeAuthorityReleaseEvidence(v4Env);
    expect(evidence).toMatchObject({
      actualSource: 'd1',
      releaseId: 'takolio-culinary-standard-v4',
      servedRecipeCount: 500,
      servedFingerprint: v4Manifest.runtimeFingerprint,
      fingerprintMatchesRelease: true,
      d1Readiness: 'ready',
      fallbackReason: null,
    });
    const v1ManifestOnDisk = JSON.parse(readFileSync(path.join(root, CATALOG_RELEASE_MANIFEST_PATH), 'utf8'));
    const proof = verifyRecipeAuthorityEvidence(
      {
        sha: 'e'.repeat(40),
        environment: 'production',
        recipeCatalogMode: 'd1',
        recipeCatalogCanaryPercent: 0,
        recipeCatalogCutoverEnabled: true,
        recipeCatalogV4StandardEnabled: true,
      },
      evidence,
      v1ManifestOnDisk,
    );
    expect(proof).toMatchObject({
      releaseId: 'takolio-culinary-standard-v4',
      actualSource: 'd1',
      servedRecipeCount: 500,
      servedFingerprint: v4Manifest.runtimeFingerprint,
      d1Readiness: 'ready',
    });
  });

  it('evaluates fridge availability, serving scaling, and cooking lot deductions accurately on hydrated V4 D1 recipes', async () => {
    const v4D1 = await resolveRecipeAuthority({
      DB: db,
      RECIPE_CATALOG_MODE: 'd1',
      RECIPE_CATALOG_CUTOVER_ENABLED: 'true',
      RECIPE_CATALOG_V4_STANDARD_ENABLED: 'true',
    } as unknown as Env);
    const canhChua = v4D1.snapshot.findById('vn-canh-01')!;
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
