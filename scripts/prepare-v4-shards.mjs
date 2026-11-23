#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, 'data', 'recipe-standard', 'v4');
const SHARD_ROOT = path.join(OUT_ROOT, 'shards');
const CURRENT_RELEASE = path.join(ROOT, 'packages', 'recipes', 'src', 'import', 'catalog-release.current.json');
const APPROVED_BATCHES = path.join(ROOT, 'data', 'recipe-import', 'approved-batches.json');
const V2_RECIPES_DIR = path.join(ROOT, 'data', 'recipe-refresh', 'v2', 'recipes');
const V3_CANDIDATES_PATH = path.join(ROOT, 'data', 'recipe-intelligence', 'v3', 'candidates.json');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const writeJson = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const cacheDir = `/private/tmp/vite-prepare-v4-${process.pid}`;
const vite = await createServer({
  cacheDir,
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const { ALL_RECIPES } = await vite.ssrLoadModule('/packages/recipes/src/data.ts');
  const factory = await vite.ssrLoadModule('/packages/recipes/src/import/index.ts');
  const { fingerprintRecipes } = await vite.ssrLoadModule('/packages/recipes/src/catalog-fingerprint.ts');
  const domain = await vite.ssrLoadModule('/packages/domain/src/culinary-ingredients-v4.ts');

  const releaseManifest = JSON.parse(readFileSync(CURRENT_RELEASE, 'utf8'));
  const orderedIds = releaseManifest.orderedRecipeIds;
  if (!Array.isArray(orderedIds) || orderedIds.length !== 500) {
    throw new Error(`Expected 500 orderedRecipeIds, found ${orderedIds?.length}`);
  }

  // Reconstruct full V1 500 runtime recipes
  const registry = JSON.parse(readFileSync(APPROVED_BATCHES, 'utf8'));
  const approved = [];
  for (const entry of registry.batches) {
    const bytes = new Uint8Array(readFileSync(path.join(ROOT, entry.source)));
    const compiled = await factory.compileImportBatch(
      bytes,
      factory.importFormatForPath(entry.source),
      { legacy: ALL_RECIPES, approvedBatches: approved },
    );
    if (!compiled.ok) throw new Error(`Failed compiling batch ${entry.batchId}`);
    approved.push({ header: compiled.header, recipes: compiled.recipes });
  }
  const v1Catalog = [
    ...ALL_RECIPES,
    ...approved.flatMap((batch) => batch.recipes.map((item) => item.runtime)),
  ];
  const v1ById = new Map(v1Catalog.map((recipe) => [recipe.id, recipe]));

  // Optional V3 candidate map for research hints
  const v3ById = new Map();
  if (existsSync(V3_CANDIDATES_PATH)) {
    const v3Json = JSON.parse(readFileSync(V3_CANDIDATES_PATH, 'utf8'));
    const entries = Array.isArray(v3Json) ? v3Json : (v3Json.candidates ?? []);
    for (const c of entries) {
      const id = c?.metadata?.recipeId ?? c?.content?.identity?.id;
      if (id) v3ById.set(id, c);
    }
  }

  // Export compact operational ingredients reference
  const opIngredients = domain.getAllOperationalIngredients().map((ing) => {
    const nut = domain.getOperationalNutritionV4(ing.id);
    const allergens = domain.getOperationalAllergensV4(ing.id);
    return {
      id: ing.id,
      nameVi: ing.nameVi,
      nameEn: ing.nameEn,
      aliases: ing.aliases,
      category: ing.category,
      defaultUnit: ing.defaultUnit,
      allergenTags: allergens,
      kcalPer100g: nut.energyKcal,
      proteinPer100g: nut.proteinG,
      fatPer100g: nut.fatG,
      carbPer100g: nut.carbohydrateG,
      edibleYieldRatio: nut.edibleYieldRatio,
      ...(nut.densityGPerMl !== undefined ? { densityGPerMl: nut.densityGPerMl } : {}),
      ...(nut.gramsPerPiece !== undefined ? { gramsPerPiece: nut.gramsPerPiece } : {}),
      ...(nut.gramsPerBunch !== undefined ? { gramsPerBunch: nut.gramsPerBunch } : {}),
      ...(nut.gramsPerSlice !== undefined ? { gramsPerSlice: nut.gramsPerSlice } : {}),
      ...(nut.gramsPerPack !== undefined ? { gramsPerPack: nut.gramsPerPack } : {}),
    };
  });
  writeJson(path.join(OUT_ROOT, 'operational-ingredients-reference.json'), {
    schemaVersion: 4,
    totalCount: opIngredients.length,
    ingredients: opIngredients,
  });

  // Build unified research entries for all 500 recipes
  const records = [];
  for (let runtimeOrder = 0; runtimeOrder < orderedIds.length; runtimeOrder += 1) {
    const id = orderedIds[runtimeOrder];
    const v1 = v1ById.get(id);
    if (!v1) throw new Error(`Missing V1 recipe for ID ${id}`);
    const v2Path = path.join(V2_RECIPES_DIR, `${id}.json`);
    const v2Bytes = readFileSync(v2Path);
    const v2 = JSON.parse(v2Bytes.toString('utf8'));
    const v3 = v3ById.get(id);
    const v1Fingerprint = await fingerprintRecipes([v1]);
    const v2Sha256 = sha256(v2Bytes);

    records.push({
      id,
      slug: v1.slug,
      runtimeOrder,
      legacyRuntimeImageUrl: v1.imageUrl,
      v1Fingerprint,
      v2Sha256,
      v1Summary: {
        title: v1.title,
        description: v1.description,
        cuisine: v1.cuisine,
        category: v1.category ?? null,
        region: v1.region ?? null,
        cookTimeMinutes: v1.cookTimeMinutes,
        servings: v1.servings,
        difficulty: v1.difficulty,
        tags: v1.tags,
        ingredients: v1.ingredients,
        steps: v1.steps,
        nutrition: v1.nutrition ?? null,
      },
      v2Summary: {
        title: v2.identity.title,
        description: v2.content.description,
        cuisine: v2.content.cuisine,
        category: v2.content.category ?? null,
        region: v2.content.region ?? null,
        cookTimeMinutes: v2.content.cookTimeMinutes,
        servings: v2.content.servings,
        difficulty: v2.content.difficulty,
        tags: v2.content.tags,
        ingredients: v2.ingredients.map((ing) => ({
          sourceName: ing.sourceName,
          canonicalIngredientId: ing.canonicalIngredientId,
          reconciliation: ing.reconciliation,
          usageRole: ing.usageRole,
          optional: ing.optional,
          includeInShopping: ing.includeInShopping,
          quantityText: ing.quantity.text,
          gramEquivalent: ing.quantity.gramEquivalent,
          note: ing.note,
        })),
        steps: v2.steps,
        candidateNutrition: v2.nutrition?.candidatePerServing ?? null,
      },
      v3Edits: v3?.metadata?.edits ?? [],
    });
  }

  const byGroup = new Map();
  for (const r of records) {
    const key = r.v2Summary.cuisine === 'vietnamese'
      ? `vn:${r.v2Summary.category ?? 'other'}`
      : r.v2Summary.cuisine;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(r);
  }

  const splitEvenly = (arr, parts) => {
    const out = [];
    const baseSize = Math.floor(arr.length / parts);
    const rem = arr.length % parts;
    let offset = 0;
    for (let i = 0; i < parts; i += 1) {
      const size = baseSize + (i < rem ? 1 : 0);
      out.push(arr.slice(offset, offset + size));
      offset += size;
    }
    return out;
  };

  const vnCanh = byGroup.get('vn:mon_canh') ?? [];
  const shardDefinitions = [
    { shardId: 'shard-01', focus: 'Vietnamese: Mon Canh (Part 1)', recipes: vnCanh.slice(0, 21) },
    { shardId: 'shard-02', focus: 'Vietnamese: Mon Canh (Part 2) & Mon Lau Tiec', recipes: [...vnCanh.slice(21), ...(byGroup.get('vn:mon_lau_tiec') ?? [])] },
    { shardId: 'shard-03', focus: 'Vietnamese: Mon Kho', recipes: byGroup.get('vn:mon_kho') ?? [] },
    { shardId: 'shard-04', focus: 'Vietnamese: Mon Xao', recipes: byGroup.get('vn:mon_xao') ?? [] },
    { shardId: 'shard-05', focus: 'Vietnamese: Mon Chien', recipes: byGroup.get('vn:mon_chien') ?? [] },
    { shardId: 'shard-06', focus: 'Vietnamese: Mon Hap Luoc', recipes: byGroup.get('vn:mon_hap_luoc') ?? [] },
    { shardId: 'shard-07', focus: 'Vietnamese: Mon Cuon Nom', recipes: byGroup.get('vn:mon_cuon_nom') ?? [] },
    { shardId: 'shard-08', focus: 'Vietnamese: Mon Bun Pho', recipes: byGroup.get('vn:mon_bun_pho') ?? [] },
    { shardId: 'shard-09', focus: 'Vietnamese: Mon Chay', recipes: byGroup.get('vn:mon_chay') ?? [] },
    { shardId: 'shard-10', focus: 'Vietnamese: Mon Nhanh Sang', recipes: byGroup.get('vn:mon_nhanh_sang') ?? [] },
  ];

  let nextIdx = 11;
  for (const [cuisine, parts] of [
    ['chinese', 4],
    ['japanese', 3],
    ['korean', 3],
    ['thai', 3],
    ['italian', 3],
  ]) {
    const slices = splitEvenly(byGroup.get(cuisine) ?? [], parts);
    slices.forEach((slice, i) => {
      shardDefinitions.push({
        shardId: `shard-${String(nextIdx).padStart(2, '0')}`,
        focus: `${cuisine.toUpperCase()} Cuisine (Part ${i + 1}/${parts})`,
        recipes: slice,
      });
      nextIdx += 1;
    });
  }

  const assignedIds = shardDefinitions.flatMap((s) => s.recipes.map((r) => r.id));
  if (assignedIds.length !== 500 || new Set(assignedIds).size !== 500) {
    throw new Error(`Shard assignment invariant failed: total=${assignedIds.length}, unique=${new Set(assignedIds).size}`);
  }

  for (const shard of shardDefinitions) {
    writeJson(path.join(SHARD_ROOT, `${shard.shardId}.json`), {
      schemaVersion: 4,
      shardId: shard.shardId,
      focus: shard.focus,
      recipeCount: shard.recipes.length,
      recipeIds: shard.recipes.map((r) => r.id),
      recipes: shard.recipes,
    });
  }

  writeJson(path.join(SHARD_ROOT, 'index.json'), {
    schemaVersion: 4,
    totalShards: shardDefinitions.length,
    totalRecipes: assignedIds.length,
    shards: shardDefinitions.map((s) => ({
      shardId: s.shardId,
      focus: s.focus,
      recipeCount: s.recipes.length,
      recipeIds: s.recipes.map((r) => r.id),
    })),
  });

  console.log(`Prepared ${shardDefinitions.length} shards (${assignedIds.length} recipes) and ${opIngredients.length} operational ingredients.`);
} finally {
  await vite.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
