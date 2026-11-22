#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT = process.cwd();
const V4_ROOT = path.join(ROOT, 'data', 'recipe-standard', 'v4');
const SHARD_ROOT = path.join(V4_ROOT, 'shards');
const RECIPES_DIR = path.join(V4_ROOT, 'recipes');
const COMPILED_PATH = path.join(V4_ROOT, 'compiled-runtime-500.json');
const MANIFEST_PATH = path.join(V4_ROOT, 'manifest.json');
const PROPOSED_SQL_PATH = path.join(ROOT, 'docs', 'migrations', 'proposed', '0052_culinary_standard_v4_catalog_500.sql');
const CURRENT_RELEASE = path.join(ROOT, 'packages', 'recipes', 'src', 'import', 'catalog-release.current.json');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const writeFile = (file, content) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
};
const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);

const args = process.argv.slice(2);
const command = args[0];
const target = args[1];

if (!['stamp-and-verify-shard', 'verify-recipe', 'list-pending', 'build-all', 'check'].includes(command)) {
  console.error('Usage: recipe-standard-v4.mjs <stamp-and-verify-shard <shard-XX> | list-pending <shard-XX> | verify-recipe <id> | build-all | check>');
  process.exit(2);
}

const cacheDir = `/private/tmp/vite-v4-cli-${process.pid}-${Date.now()}`;
const vite = await createServer({
  cacheDir,
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const domain = await vite.ssrLoadModule('/packages/domain/src/index.ts');
  const domainV4 = await vite.ssrLoadModule('/packages/domain/src/culinary-ingredients-v4.ts');
  const v4 = await vite.ssrLoadModule('/packages/recipes/src/standard-v4/index.ts');
  const { fingerprintRecipes } = await vite.ssrLoadModule('/packages/recipes/src/catalog-fingerprint.ts');

  const releaseManifest = JSON.parse(readFileSync(CURRENT_RELEASE, 'utf8'));
  const orderedIds = releaseManifest.orderedRecipeIds;

  const shardIndex = JSON.parse(readFileSync(path.join(SHARD_ROOT, 'index.json'), 'utf8'));
  const shardMetaByRecipeId = new Map();
  for (const s of shardIndex.shards) {
    const shardData = JSON.parse(readFileSync(path.join(SHARD_ROOT, `${s.shardId}.json`), 'utf8'));
    for (const rec of shardData.recipes) {
      shardMetaByRecipeId.set(rec.id, rec);
    }
  }

  const STOP_TOKENS = new Set([
    'tuoi', 'kho', 'xay', 'bam', 'thai', 'cat', 'mieng', 'lat', 'nho', 'to', 'vua',
    'an', 'loai', 'nguyen', 'chat', 'sach', 'chay', 'mon', 'cho', 'vao', 'de', 'lam',
    'phi', 'chin', 'song', 'trang', 'den', 'do', 'xanh', 'vang', 'ngon', 'nhat', 'han',
    'thai lan', 'trung hoa', 'viet nam', 'y', 'ta', 'non', 'gia', 'bo', 'con', 'qua',
    'cu', 'tep', 'nhanh', 'la', 'hat', 'bot', 'nuoc', 'sot', 'thit', 'rau', 'cuoi',
  ]);

  const SYNONYM_GROUPS = [
    ['xi dau', 'nuoc tuong'],
    ['mi chinh', 'bot ngot'],
    ['bot ngo', 'bot bap'],
    ['ngo ri', 'rau mui', 'mui ta'],
    ['hanh la', 'hanh hoa', 'dau hanh'],
    ['hanh tim', 'hanh kho', 'hanh phi'],
    ['dua', 'thom', 'khom'],
    ['lac', 'dau phong'],
    ['vung', 'me rang', 'hat me'],
    ['dau an', 'dau thuc vat', 'dau chien'],
    ['dau o liu', 'dau olive', 'olive'],
    ['tieu den', 'tieu xay', 'tieu trang', 'hat tieu', 'tieu'],
    ['ot hiem', 'ot sung', 'ot tuoi', 'ot bam', 'ot bot', 'ot'],
    ['com me', 'me chua'],
    ['nuoc dung ga', 'nuoc luoc ga', 'nuoc dung'],
    ['nuoc dung bo', 'nuoc ham xuong', 'nuoc dung'],
    ['nuoc dung rau cu', 'nuoc dung nam', 'nuoc dung'],
    ['dau phu', 'dau hu', 'tau hu'],
    ['banh trang', 'banh da nem'],
    ['dua leo', 'dua chuot'],
    ['ngo gai', 'mui tau'],
    ['rau ngo', 'ngo om', 'rau om'],
    ['bun tuoi', 'bun roi', 'bun la', 'bun'],
    ['banh pho', 'pho', 'hu tieu', 'mi quang'],
    ['gia do', 'gia song'],
    ['ruou sake', 'ruou trang', 'ruou gao', 'ruou nau an'],
    ['duong cat', 'duong trang', 'duong phen', 'duong thot not', 'duong nau', 'duong'],
  ];

  const expandSynonyms = (normStr) => {
    const terms = new Set([normStr]);
    for (const group of SYNONYM_GROUPS) {
      if (group.some((g) => normStr.includes(g))) {
        for (const g of group) terms.add(g);
      }
    }
    return [...terms];
  };

  function checkQuantityToGross(ing) {
    const nut = domainV4.getOperationalNutritionV4(ing.ingredientId);
    if (!nut) return `Missing operational nutrition for ${ing.ingredientId}`;
    const q = ing.requiredQuantity;
    const g = ing.grossGrams;
    if (ing.unit === 'g' && (g < q * 0.95 || g > q * 1.05)) {
      return `${ing.ingredientId}: unit is 'g' (${q}), so grossGrams (${g}) must match ~${q}`;
    }
    if (ing.unit === 'kg' && (g < q * 950 || g > q * 1050)) {
      return `${ing.ingredientId}: unit is 'kg' (${q}), so grossGrams (${g}) must match ~${q * 1000}`;
    }
    if (ing.unit === 'ml') {
      const expected = q * (nut.densityGPerMl ?? 1);
      if (g < expected * 0.65 || g > expected * 1.6) {
        return `${ing.ingredientId}: unit is 'ml' (${q}), grossGrams (${g}) out of expected density band (${expected.toFixed(1)}g)`;
      }
    }
    if (ing.unit === 'l') {
      const expected = q * 1000 * (nut.densityGPerMl ?? 1);
      if (g < expected * 0.65 || g > expected * 1.6) {
        return `${ing.ingredientId}: unit is 'l' (${q}), grossGrams (${g}) out of expected density band (${expected.toFixed(1)}g)`;
      }
    }
    const unitWeight =
      ing.unit === 'piece' ? nut.gramsPerPiece
      : ing.unit === 'bunch' ? nut.gramsPerBunch
      : ing.unit === 'slice' ? nut.gramsPerSlice
      : ing.unit === 'pack' ? nut.gramsPerPack
      : undefined;
    if (unitWeight !== undefined) {
      const expected = q * unitWeight;
      if (g < expected * 0.15 || g > expected * 4.0) {
        return `${ing.ingredientId}: ${q} ${ing.unit} implies ~${expected}g, but grossGrams=${g}`;
      }
    }
    return null;
  }

  function checkIngredientMentionedInSteps(ing, fullProseNorm) {
    if (ing.ingredientId === 'COOKING_WATER') return true;
    const canonical = domainV4.findOperationalIngredientById(ing.ingredientId);
    const rawNames = [
      ing.name.replace(/\([^)]*\)/g, ' '),
      canonical?.nameVi?.replace(/\([^)]*\)/g, ' ') ?? '',
      ...(canonical?.aliases ?? []),
    ];
    const candidates = new Set();
    for (const raw of rawNames) {
      const norm = domain.normalizeIngredientText(raw);
      if (!norm) continue;
      for (const term of expandSynonyms(norm)) {
        candidates.add(term);
        for (const word of term.split(' ')) {
          if (word.length >= 3 && !STOP_TOKENS.has(word)) {
            candidates.add(word);
          }
        }
      }
    }
    for (const candidate of candidates) {
      if (candidate.length >= 3 && fullProseNorm.includes(candidate)) {
        return true;
      }
    }
    return false;
  }

  function stampAndVerifyOne(recipeId) {
    const filePath = path.join(RECIPES_DIR, `${recipeId}.json`);
    if (!existsSync(filePath)) {
      return { ok: false, recipeId, errors: [`Missing recipe file: data/recipe-standard/v4/recipes/${recipeId}.json`] };
    }
    const meta = shardMetaByRecipeId.get(recipeId);
    if (!meta) {
      return { ok: false, recipeId, errors: [`Unknown recipeId not in shard index: ${recipeId}`] };
    }

    let raw;
    try {
      raw = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (err) {
      return { ok: false, recipeId, errors: [`Invalid JSON: ${err.message}`] };
    }

    // Stamp deterministic authority fields
    const stamped = structuredClone(raw);
    stamped.schemaVersion = 4;
    stamped.recipeVersion = 4;
    if (!stamped.identity || typeof stamped.identity !== 'object') stamped.identity = {};
    stamped.identity.id = meta.id;
    stamped.identity.slug = meta.slug;
    stamped.media = { legacyRuntimeImageUrl: meta.legacyRuntimeImageUrl };
    stamped.provenance = {
      version: 4,
      standardId: 'takolio-culinary-standard-v4',
      researchedFromV1Fingerprint: meta.v1Fingerprint,
      researchedFromV2Sha256: meta.v2Sha256,
    };

    const errors = [];
    if (!Array.isArray(stamped.ingredients) || stamped.ingredients.length === 0) {
      return { ok: false, recipeId, errors: ['ingredients must be a non-empty array'] };
    }

    // Normalize ingredient positions and compute edibleGrams deterministically
    stamped.ingredients = stamped.ingredients.map((ing, idx) => {
      const next = { ...ing, position: idx };
      if (typeof next.grossGrams === 'number' && typeof next.edibleRetentionRatio === 'number') {
        next.edibleGrams = v4.computeEdibleGramsV4(next.grossGrams, next.edibleRetentionRatio);
      }
      return next;
    });

    // Derive statutory allergens and deterministic nutrition if all ingredientIds exist
    const missingIds = stamped.ingredients
      .map((i) => i.ingredientId)
      .filter((id) => !domainV4.findOperationalIngredientById(id));
    if (missingIds.length > 0) {
      errors.push(`Unknown ingredientId(s): ${missingIds.join(', ')}`);
      return { ok: false, recipeId, errors };
    }

    if (!stamped.classification || typeof stamped.classification !== 'object') {
      return { ok: false, recipeId, errors: ['Missing classification object'] };
    }
    stamped.classification.allergenTags = v4.deriveAllergenTagsV4(stamped.ingredients);
    if (Number.isInteger(stamped.classification.servings) && stamped.classification.servings >= 1) {
      stamped.nutrition = v4.computeStandardNutritionV4(
        stamped.ingredients,
        stamped.classification.servings,
      );
    }

    const parsed = v4.StandardRecipeV4Schema.safeParse(stamped);
    if (!parsed.success) {
      for (const issue of parsed.error.issues.slice(0, 12)) {
        errors.push(`${issue.path.join('.') || 'root'}: ${issue.message}`);
      }
      return { ok: false, recipeId, errors };
    }

    const verified = parsed.data;
    try {
      v4.compileStandardRecipeV4ToRuntime(verified);
    } catch (err) {
      errors.push(`RuntimeRecipe compile failed: ${err.message}`);
    }

    const nutCheck = v4.assertNutritionPlausibilityV4(verified.nutrition);
    if (!nutCheck.ok) {
      errors.push(`Nutrition plausibility failed: ${nutCheck.reason}`);
    }

    for (const ing of verified.ingredients) {
      const qErr = checkQuantityToGross(ing);
      if (qErr) errors.push(qErr);
    }

    const proseNorm = domain.normalizeIngredientText(
      [
        verified.overview.description,
        ...verified.steps.map((s) => `${s.title} ${s.instruction} ${s.tip ?? ''}`),
      ].join(' '),
    );
    for (const ing of verified.ingredients) {
      if (!checkIngredientMentionedInSteps(ing, proseNorm)) {
        errors.push(`Ingredient not referenced in steps prose: ${ing.ingredientId} (${ing.name})`);
      }
    }

    if (errors.length > 0) {
      return { ok: false, recipeId, errors };
    }

    if (command !== 'check') {
      writeJson(filePath, verified);
    }
    return {
      ok: true,
      recipeId,
      recipe: verified,
      calories: verified.nutrition.calories,
    };
  }

  if (command === 'verify-recipe') {
    if (!target) throw new Error('verify-recipe requires <recipeId>');
    const res = stampAndVerifyOne(target);
    if (!res.ok) {
      console.error(`FAIL ${res.recipeId}:\n  - ${res.errors.join('\n  - ')}`);
      process.exit(1);
    }
    console.log(`PASS ${res.recipeId}: calories=${res.calories} kcal, ings=${res.recipe.ingredients.length}, steps=${res.recipe.steps.length}`);
  } else if (command === 'list-pending') {
    if (!target) throw new Error('list-pending requires <shard-XX>');
    const shardFile = path.join(SHARD_ROOT, `${target}.json`);
    if (!existsSync(shardFile)) throw new Error(`Missing shard file: ${shardFile}`);
    const shard = JSON.parse(readFileSync(shardFile, 'utf8'));
    const pending = [];
    for (const id of shard.recipeIds) {
      const res = stampAndVerifyOne(id);
      if (!res.ok) pending.push({ id, errors: res.errors });
    }
    console.log(JSON.stringify({ shardId: target, total: shard.recipeIds.length, pendingCount: pending.length, pending }, null, 2));
  } else if (command === 'stamp-and-verify-shard') {
    if (!target) throw new Error('stamp-and-verify-shard requires <shard-XX>');
    const shardFile = path.join(SHARD_ROOT, `${target}.json`);
    if (!existsSync(shardFile)) throw new Error(`Missing shard file: ${shardFile}`);
    const shard = JSON.parse(readFileSync(shardFile, 'utf8'));
    const failures = [];
    const passed = [];
    for (const id of shard.recipeIds) {
      const res = stampAndVerifyOne(id);
      if (res.ok) passed.push(res);
      else failures.push(res);
    }
    if (failures.length > 0) {
      console.error(`SHARD ${target}: ${passed.length}/${shard.recipeIds.length} passed, ${failures.length} FAILED:`);
      for (const f of failures) {
        console.error(`  [${f.recipeId}] ${f.errors.join(' | ')}`);
      }
      process.exit(1);
    }
    const cals = passed.map((p) => p.calories);
    console.log(
      `SHARD ${target} PASS: ${passed.length}/${shard.recipeIds.length} recipes verified (min=${Math.min(...cals)} kcal, max=${Math.max(...cals)} kcal)`,
    );
  } else if (command === 'build-all' || command === 'check') {
    const recipes = [];
    const runtimeRecipes = [];
    const failures = [];
    for (const id of orderedIds) {
      const res = stampAndVerifyOne(id);
      if (!res.ok) {
        failures.push(res);
      } else {
        recipes.push(res.recipe);
        runtimeRecipes.push(v4.compileStandardRecipeV4ToRuntime(res.recipe));
      }
    }
    if (failures.length > 0) {
      console.error(`V4 ${command} FAILED: ${recipes.length}/500 passed, ${failures.length} failed.`);
      for (const f of failures.slice(0, 20)) {
        console.error(`  [${f.recipeId}] ${f.errors.join(' | ')}`);
      }
      process.exit(1);
    }

    const runtimeFingerprint = await fingerprintRecipes(runtimeRecipes);
    const compiledPayload = `${JSON.stringify(
      {
        schemaVersion: 4,
        recipeCount: runtimeRecipes.length,
        fingerprint: runtimeFingerprint,
        recipes: runtimeRecipes,
      },
      null,
      2,
    )}\n`;
    const sqlText = v4.renderStandardV4PromotionSql(recipes, orderedIds);

    const avgIngredients = Math.round((recipes.reduce((s, r) => s + r.ingredients.length, 0) / recipes.length) * 10) / 10;
    const avgSteps = Math.round((recipes.reduce((s, r) => s + r.steps.length, 0) / recipes.length) * 10) / 10;
    const minCal = Math.min(...recipes.map((r) => r.nutrition.calories));
    const maxCal = Math.max(...recipes.map((r) => r.nutrition.calories));

    const manifestPayload = `${JSON.stringify(
      {
        schemaVersion: 4,
        standardId: 'takolio-culinary-standard-v4',
        recipeCount: recipes.length,
        orderedRecipeIds: orderedIds,
        runtimeFingerprint,
        compiledRuntimeSha256: sha256(compiledPayload),
        proposedMigrationPath: 'docs/migrations/proposed/0052_culinary_standard_v4_catalog_500.sql',
        proposedMigrationSha256: sha256(sqlText),
        summary: {
          avgIngredientsPerRecipe: avgIngredients,
          avgStepsPerRecipe: avgSteps,
          nutritionCertifiedCount: recipes.length,
          runtimeExcludedIngredientCount: 0,
          provisionalIngEnrCount: 0,
          minCaloriesPerServing: minCal,
          maxCaloriesPerServing: maxCal,
        },
      },
      null,
      2,
    )}\n`;

    if (command === 'build-all') {
      writeFile(COMPILED_PATH, compiledPayload);
      writeFile(PROPOSED_SQL_PATH, sqlText);
      writeFile(MANIFEST_PATH, manifestPayload);
      console.log(
        `recipe-standard-v4 build-all=ok recipes=500 fingerprint=${runtimeFingerprint} avgIngs=${avgIngredients} avgSteps=${avgSteps}`,
      );
    } else {
      if (!existsSync(COMPILED_PATH) || !existsSync(MANIFEST_PATH) || !existsSync(PROPOSED_SQL_PATH)) {
        throw new Error('V4 build artifacts missing. Run build-all first.');
      }
      if (readFileSync(COMPILED_PATH, 'utf8') !== compiledPayload) {
        throw new Error('compiled-runtime-500.json drift detected vs recipe sources');
      }
      if (readFileSync(MANIFEST_PATH, 'utf8') !== manifestPayload) {
        throw new Error('manifest.json drift detected vs recipe sources');
      }
      if (readFileSync(PROPOSED_SQL_PATH, 'utf8') !== sqlText) {
        throw new Error('0052_culinary_standard_v4_catalog_500.sql drift detected vs recipe sources');
      }
      console.log(
        `recipe-standard-v4=check=ok recipes=500 fingerprint=${runtimeFingerprint} avgIngs=${avgIngredients} avgSteps=${avgSteps} calRange=${minCal}..${maxCal}`,
      );
    }
  }
} finally {
  await vite.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
