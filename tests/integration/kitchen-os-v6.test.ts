import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureHouseholdAdopted } from '@frigo/db';
import { composeInventoryLotCommands, readAdoptedLotSnapshot } from '../../packages/db/src/inventory-lot-commands';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { kitchenOsRoutes } from '../../src/worker/routes/kitchen-os';
import { recipeRoutes } from '../../src/worker/routes/recipes';
import { shoppingRoutes } from '../../src/worker/routes/shopping';
import {
  cleanupExpiredIdempotencyKeys,
  generateProactiveExpiryNotifications,
  runScheduledCleanup,
} from '../../src/worker/services/cleanup';
import type { AuthContext, Env } from '../../src/worker/types';
import { SESSION_COOKIE, sha256Hex } from '../../src/worker/utils/session';
import { SqliteD1 } from '../helpers/sqlite-d1';

const api = new Hono<{ Bindings: Env; Variables: { auth: AuthContext; householdRole?: string } }>();
api.use('*', authMiddleware);
api.route('/', kitchenOsRoutes);
api.route('/', recipeRoutes);
api.route('/', shoppingRoutes);

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext; householdRole?: string } }>();
app.route('/api/v1', api);

const APP_ORIGIN = 'http://localhost:5173';
const JWT_SECRET = 'takolio-v6-integration-secret-key-minimum-32-chars';

interface SeededTenant {
  userId: string;
  householdId: string;
  cookie: string;
}

async function seedAuthenticatedHousehold(
  db: SqliteD1,
  opts: { userId: string; householdId: string; email: string; displayName: string; rawToken: string },
): Promise<SeededTenant> {
  const tokenHash = await sha256Hex(opts.rawToken);
  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

  db.execute('INSERT INTO users (id, email, is_guest) VALUES (?, ?, 0)', [opts.userId, opts.email]);
  db.execute('INSERT INTO profiles (id, user_id, display_name) VALUES (?, ?, ?)', [
    `prof_${opts.userId}`,
    opts.userId,
    opts.displayName,
  ]);
  db.execute('INSERT INTO households (id, name, created_by) VALUES (?, ?, ?)', [
    opts.householdId,
    `Bếp của ${opts.displayName}`,
    opts.userId,
  ]);
  db.execute('INSERT INTO household_members (id, household_id, user_id, role) VALUES (?, ?, ?, ?)', [
    `hm_${opts.householdId}_${opts.userId}`,
    opts.householdId,
    opts.userId,
    'owner',
  ]);
  db.execute(
    'INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
    [`sess_${opts.userId}`, opts.userId, opts.householdId, tokenHash, expiresAt],
  );

  return {
    userId: opts.userId,
    householdId: opts.householdId,
    cookie: `${SESSION_COOKIE}=${opts.rawToken}`,
  };
}

function makeEnv(db: SqliteD1): Env {
  return {
    DB: db,
    ENVIRONMENT: 'development',
    APP_URL: APP_ORIGIN,
    JWT_SECRET,
  } as Env;
}

async function apiFetch(
  env: Env,
  tenant: SeededTenant,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Cookie', tenant.cookie);
  if (!headers.has('Origin') && init.method && init.method !== 'GET') {
    headers.set('Origin', APP_ORIGIN);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return app.fetch(new Request(`${APP_ORIGIN}${path}`, { ...init, headers }), env);
}

describe('Takolio V6 Kitchen OS & High-Power Backend Mode (Migration 0049)', () => {
  const databases: SqliteD1[] = [];
  const openDb = () => {
    const db = new SqliteD1();
    databases.push(db);
    return db;
  };

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close();
    }
  });

  it('executes GET /api/v1/kitchen-os/pulse in a single D1 batch with deterministic weak ETag and 304 revalidation', async () => {
    const db = openDb();
    const env = makeEnv(db);
    const tenant = await seedAuthenticatedHousehold(db, {
      userId: 'u_v6_pulse',
      householdId: 'hh_v6_pulse',
      email: 'pulse@takolio.test',
      displayName: 'Minh Anh',
      rawToken: 'tok_v6_pulse_secret_0001',
    });

    const tomorrow = new Date(Date.now() + 24 * 3_600_000).toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    db.execute(
      `INSERT INTO inventory_items (id, household_id, name, quantity, unit, category, storage, expiry_date, freshness)
       VALUES (?, ?, 'Rau cải ngọt', 2, 'bunch', 'vegetable', 'fridge', ?, 'expiring'),
              (?, ?, 'Thịt ba chỉ', 500, 'g', 'meat', 'fridge', ?, 'fresh')`,
      ['inv_pulse_1', tenant.householdId, tomorrow, 'inv_pulse_2', tenant.householdId, nextWeek],
    );

    let batchCalls = 0;
    let standaloneStatements = 0;
    db.hooks = {
      beforeBatch: () => {
        batchCalls += 1;
      },
      beforeStatement: (evt) => {
        if (!evt.sql.includes('sessions_v2') && !evt.sql.includes('household_members')) {
          standaloneStatements += 1;
        }
      },
    };

    const firstRes = await apiFetch(env, tenant, '/api/v1/kitchen-os/pulse');
    expect(firstRes.status).toBe(200);
    expect(batchCalls).toBe(1);
    expect(standaloneStatements).toBe(0);

    const etag = firstRes.headers.get('ETag');
    expect(etag).toMatch(/^W\/"pulse-[0-9a-f]{16}"$/);
    expect(firstRes.headers.get('Cache-Control')).toBe('private, no-cache');
    expect(firstRes.headers.get('Server-Timing')).toMatch(/^d1_batch;dur=\d+(\.\d+)?$/);

    const pulseBody = (await firstRes.json()) as any;
    expect(pulseBody.householdId).toBe(tenant.householdId);
    expect(pulseBody.inventory.totalActiveItems).toBe(2);
    expect(pulseBody.inventory.expiringWithin48hCount).toBe(1);
    expect(pulseBody.inventory.expiringWithin48h[0].name).toBe('Rau cải ngọt');
    expect(pulseBody.weeklyTargetVnd).toBe(1_200_000);

    // Conditional request with matching If-None-Match returns 304 Not Modified
    const cachedRes = await apiFetch(env, tenant, '/api/v1/kitchen-os/pulse', {
      headers: { 'If-None-Match': etag! },
    });
    expect(cachedRes.status).toBe(304);
    expect(cachedRes.headers.get('ETag')).toBe(etag);
    expect(cachedRes.headers.get('Server-Timing')).toMatch(/^d1_batch;dur=/);
    expect(await cachedRes.text()).toBe('');

    db.hooks = {};

    // Mutate state -> ETag must rotate and return 200 OK
    const rescueRes = await apiFetch(env, tenant, '/api/v1/kitchen-os/waste-events', {
      method: 'POST',
      body: JSON.stringify({
        itemName: 'Rau cải ngọt',
        category: 'vegetable',
        eventType: 'rescued',
        quantity: 2,
        unit: 'bó',
      }),
    });
    expect(rescueRes.status).toBe(201);

    const refreshedRes = await apiFetch(env, tenant, '/api/v1/kitchen-os/pulse', {
      headers: { 'If-None-Match': etag! },
    });
    expect(refreshedRes.status).toBe(200);
    const nextEtag = refreshedRes.headers.get('ETag');
    expect(nextEtag).not.toBe(etag);
    const refreshedPulse = (await refreshedRes.json()) as any;
    expect(refreshedPulse.vndSaved30d).toBeGreaterThan(0);
    expect(refreshedPulse.zeroWasteScore).toBe(100);
    expect(refreshedPulse.recentActivity.length).toBeGreaterThanOrEqual(1);
  });

  it('enforces durable D1 idempotency replay, payload mismatch 409, and CSRF origin checks', async () => {
    const db = openDb();
    const env = makeEnv(db);
    const tenant = await seedAuthenticatedHousehold(db, {
      userId: 'u_v6_idem',
      householdId: 'hh_v6_idem',
      email: 'idem@takolio.test',
      displayName: 'Gia Huy',
      rawToken: 'tok_v6_idem_secret_0002',
    });

    // Cross-site request must be blocked fail-closed
    const csrfBlocked = await app.fetch(
      new Request(`${APP_ORIGIN}/api/v1/kitchen-os/waste-events`, {
        method: 'POST',
        headers: {
          Cookie: tenant.cookie,
          Origin: 'https://evil-attacker.example',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemName: 'Đậu phụ', eventType: 'rescued' }),
      }),
      env,
    );
    expect(csrfBlocked.status).toBe(403);
    expect(((await csrfBlocked.json()) as any).code).toBe('CSRF_ORIGIN_DENIED');

    const payload = JSON.stringify({
      itemName: 'Cá hồi phi lê',
      category: 'seafood',
      eventType: 'rescued',
      quantity: 2,
      unit: 'phần',
    });

    const first = await apiFetch(env, tenant, '/api/v1/kitchen-os/waste-events', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'idem-waste-salmon-01' },
      body: payload,
    });
    expect(first.status).toBe(201);
    expect(first.headers.get('X-Idempotency-Replayed')).toBe('false');
    const firstJson = (await first.json()) as any;
    expect(firstJson.wasteEvent.estimatedValueVnd).toBeGreaterThanOrEqual(70_000);
    expect(firstJson.wasteEvent.co2Grams).toBeGreaterThanOrEqual(900);

    // Exact retry with same Idempotency-Key -> replayed without duplicating rows
    const second = await apiFetch(env, tenant, '/api/v1/kitchen-os/waste-events', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'idem-waste-salmon-01' },
      body: payload,
    });
    expect(second.status).toBe(201);
    expect(second.headers.get('X-Idempotency-Replayed')).toBe('true');
    const secondJson = (await second.json()) as any;
    expect(secondJson).toEqual(firstJson);

    const wasteCount = db.query<{ n: number }>(
      'SELECT COUNT(*) AS n FROM household_waste_events WHERE household_id = ?',
      tenant.householdId,
    )[0].n;
    expect(wasteCount).toBe(1);

    // Reusing the same Idempotency-Key with a different payload -> 409 IDEMPOTENCY_PAYLOAD_MISMATCH
    const mismatch = await apiFetch(env, tenant, '/api/v1/kitchen-os/waste-events', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'idem-waste-salmon-01' },
      body: JSON.stringify({
        itemName: 'Rau muống',
        category: 'vegetable',
        eventType: 'expired_discarded',
        quantity: 1,
        unit: 'bó',
      }),
    });
    expect(mismatch.status).toBe(409);
    expect(((await mismatch.json()) as any).code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
  });

  it('tracks grocery budget target, expenses, cooking streak, and 30-day insights', async () => {
    const db = openDb();
    const env = makeEnv(db);
    const tenant = await seedAuthenticatedHousehold(db, {
      userId: 'u_v6_budget',
      householdId: 'hh_v6_budget',
      email: 'budget@takolio.test',
      displayName: 'Thu Hà',
      rawToken: 'tok_v6_budget_secret_0003',
    });

    const targetRes = await apiFetch(env, tenant, '/api/v1/kitchen-os/budget-target', {
      method: 'PUT',
      headers: { 'Idempotency-Key': 'idem-budget-target-1' },
      body: JSON.stringify({ weeklyTargetVnd: 1_500_000, note: 'Ngân sách tuần 4 người' }),
    });
    expect(targetRes.status).toBe(200);
    expect(((await targetRes.json()) as any).weeklyTargetVnd).toBe(1_500_000);

    await apiFetch(env, tenant, '/api/v1/kitchen-os/budget-entries', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'idem-exp-1' },
      body: JSON.stringify({
        amountVnd: 320_000,
        category: 'meat_seafood',
        note: 'Chợ sáng mua cá và sườn non',
        source: 'manual',
      }),
    });
    await apiFetch(env, tenant, '/api/v1/kitchen-os/budget-entries', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'idem-exp-2' },
      body: JSON.stringify({
        amountVnd: 180_000,
        category: 'produce',
        note: 'Rau củ hữu cơ',
        source: 'receipt_scan',
      }),
    });

    // Seed 2 consecutive days of cooked meals to verify cookingStreak calculation
    const todayIso = new Date().toISOString();
    const yesterdayIso = new Date(Date.now() - 86_400_000).toISOString();
    db.execute(
      `INSERT INTO cooked_meals (id, household_id, user_id, recipe_id, servings_cooked, completed_at)
       VALUES ('cm_streak_1', ?, ?, 'vn-canh-01', 4, ?),
              ('cm_streak_2', ?, ?, 'vn-kho-01', 4, ?)`,
      [tenant.householdId, tenant.userId, yesterdayIso, tenant.householdId, tenant.userId, todayIso],
    );

    const insightsRes = await apiFetch(env, tenant, '/api/v1/kitchen-os/insights');
    expect(insightsRes.status).toBe(200);
    const insights = (await insightsRes.json()) as any;

    expect(insights.budget.weeklyTargetVnd).toBe(1_500_000);
    expect(insights.budget.spentThisWeekVnd).toBe(500_000);
    expect(insights.budget.burnRatePct).toBeCloseTo(33.3, 1);
    expect(insights.budgetEntries).toHaveLength(2);
    expect(insights.categorySpendBreakdown[0]).toMatchObject({
      category: 'meat_seafood',
      amountVnd: 320_000,
    });
    expect(insights.cookingStreak.cookedMeals30d).toBe(2);
    expect(insights.cookingStreak.currentStreakDays).toBe(2);
    expect(insights.cookingStreak.longestStreakDays30d).toBe(2);
    expect(insights.activityTimeline.length).toBeGreaterThanOrEqual(3);
  });

  it('seeds 8 essential Vietnamese pantry staples, computes live stock, and auto-restocks into shopping_lists', async () => {
    const db = openDb();
    const env = makeEnv(db);
    const tenant = await seedAuthenticatedHousehold(db, {
      userId: 'u_v6_pantry',
      householdId: 'hh_v6_pantry',
      email: 'pantry@takolio.test',
      displayName: 'Cô Mai',
      rawToken: 'tok_v6_pantry_secret_0004',
    });

    // Add some current pantry/fridge stock:
    // - 1 liter (1000 ml) of Dầu ăn thực vật -> healthy (>= 250 ml min)
    // - 100 ml of Nước mắm nhĩ -> low stock (< 250 ml min, target 750 ml -> needs 650 ml)
    // - 12 Trứng gà ta -> healthy (>= 4 piece min)
    db.execute(
      `INSERT INTO inventory_items (id, household_id, name, quantity, unit, category, storage, freshness)
       VALUES ('inv_oil', ?, 'Dầu ăn thực vật', 1, 'l', 'seasoning', 'pantry', 'fresh'),
              ('inv_sauce', ?, 'Nước mắm nhĩ', 100, 'ml', 'seasoning', 'pantry', 'fresh'),
              ('inv_eggs', ?, 'Trứng gà ta', 12, 'piece', 'egg', 'fridge', 'fresh')`,
      [tenant.householdId, tenant.householdId, tenant.householdId],
    );

    const seedRes1 = await apiFetch(
      env,
      tenant,
      '/api/v1/kitchen-os/pantry-thresholds/seed-vietnamese',
      { method: 'POST', body: '{}' },
    );
    expect(seedRes1.status).toBe(200);
    const seedJson1 = (await seedRes1.json()) as any;
    expect(seedJson1.seededCount).toBe(8);
    expect(seedJson1.totalCount).toBe(8);

    // Idempotent second seed adds 0 duplicates
    const seedRes2 = await apiFetch(
      env,
      tenant,
      '/api/v1/kitchen-os/pantry-thresholds/seed-vietnamese',
      { method: 'POST', body: '{}' },
    );
    expect(((await seedRes2.json()) as any).seededCount).toBe(0);

    // Upsert a custom staple threshold
    const upsertRes = await apiFetch(env, tenant, '/api/v1/kitchen-os/pantry-thresholds', {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Tiêu đen Phú Quốc',
        category: 'spice',
        storage: 'pantry',
        unit: 'g',
        minQuantity: 50,
        targetQuantity: 150,
        autoAddShopping: true,
      }),
    });
    expect(upsertRes.status).toBe(200);

    const listRes = await apiFetch(env, tenant, '/api/v1/kitchen-os/pantry-thresholds');
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as any;
    expect(listJson.staples).toHaveLength(9);

    const fishSauce = listJson.staples.find((s: any) => s.name === 'Nước mắm nhĩ');
    expect(fishSauce).toMatchObject({
      currentQuantity: 100,
      minQuantity: 250,
      targetQuantity: 750,
      restockQuantity: 650,
      isLowStock: true,
    });

    const oil = listJson.staples.find((s: any) => s.name === 'Dầu ăn thực vật');
    expect(oil).toMatchObject({
      currentQuantity: 1000,
      isLowStock: false,
      restockQuantity: 0,
    });

    // 1-Tap Auto-Restock into shopping_lists / shopping_items
    const restockRes = await apiFetch(
      env,
      tenant,
      '/api/v1/kitchen-os/pantry-thresholds/auto-restock',
      { method: 'POST', headers: { 'Idempotency-Key': 'idem-restock-01' }, body: '{}' },
    );
    expect(restockRes.status).toBe(200);
    const restockJson = (await restockRes.json()) as any;
    expect(restockJson.addedCount).toBe(7); // 6 low Vietnamese staples + Tiêu đen Phú Quốc

    // Verify shopping list API natively sees the auto-restocked items
    const shopRes = await apiFetch(env, tenant, '/api/v1/shopping-list');
    expect(shopRes.status).toBe(200);
    const shopJson = (await shopRes.json()) as any;
    expect(shopJson.items).toHaveLength(7);
    const shopFishSauce = shopJson.items.find((i: any) => i.name === 'Nước mắm nhĩ');
    expect(shopFishSauce).toMatchObject({
      quantity: 650,
      unit: 'ml',
      isChecked: false,
    });
  });

  it('supports Family Heirloom Recipes CRUD and seamlessly bridges GET /recipes/:id and /cook/:id', async () => {
    const db = openDb();
    const env = makeEnv(db);
    const owner = await seedAuthenticatedHousehold(db, {
      userId: 'u_v6_heirloom_a',
      householdId: 'hh_v6_heirloom_a',
      email: 'heirloom-a@takolio.test',
      displayName: 'Bà Ngoại',
      rawToken: 'tok_v6_heirloom_a_0005',
    });
    const outsider = await seedAuthenticatedHousehold(db, {
      userId: 'u_v6_heirloom_b',
      householdId: 'hh_v6_heirloom_b',
      email: 'heirloom-b@takolio.test',
      displayName: 'Hàng Xóm',
      rawToken: 'tok_v6_heirloom_b_0006',
    });

    // Seed pork belly in owner's fridge so we can complete cooking the heirloom recipe
    db.execute(
      `INSERT INTO inventory_items (id, household_id, ingredient_id, name, quantity, unit, category, storage, freshness)
       VALUES ('inv_heirloom_pork', ?, 'PORK_BELLY', 'Thịt ba chỉ', 800, 'g', 'meat', 'fridge', 'fresh')`,
      [owner.householdId],
    );

    const createRes = await apiFetch(env, owner, '/api/v1/kitchen-os/heirloom-recipes', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'idem-heirloom-create-1' },
      body: JSON.stringify({
        title: 'Thịt Kho Riệu Nước Dừa Ngoại Nấu',
        description: 'Món thịt kho tàu gia truyền miền Nam mềm rụm không cần nước màu công nghiệp.',
        region: 'nam',
        category: 'mon_kho',
        difficulty: 'medium',
        prepTimeMinutes: 20,
        cookTimeMinutes: 65,
        servings: 4,
        chefSecret: 'Vắt vài giọt chanh vào mỡ ba chỉ trước khi ướp để mỡ trong veo.',
        familyStory: 'Món ăn mỗi dịp Tết sum vầy suốt ba thế hệ.',
        isPinned: true,
        ingredients: [
          { ingredientId: 'PORK_BELLY', name: 'Thịt ba chỉ', requiredQuantity: 500, unit: 'g' },
          { name: 'Nước dừa tươi', quantity: 400, unit: 'ml' },
        ],
        steps: [
          { instruction: 'Thái thịt ba chỉ vuông quân cờ, ướp nước mắm nhĩ 30 phút.', timerMinutes: 30 },
          { instruction: 'Kho liu riu với nước dừa tươi đến khi thịt mềm óng ánh.', timerMinutes: 45 },
        ],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = ((await createRes.json()) as any).recipe;
    expect(created.slug).toMatch(/^custom-thit-kho-rieu-nuoc-dua-ngoai-nau-[a-z0-9]{6}$/);
    expect(created.isPinned).toBe(true);
    expect(created.chefSecret).toContain('trong veo');

    // Cross-tenant isolation: another household cannot read this custom recipe via heirloom endpoint OR /recipes/:id
    const outsiderHeirloomRes = await apiFetch(
      env,
      outsider,
      `/api/v1/kitchen-os/heirloom-recipes/${created.slug}`,
    );
    expect(outsiderHeirloomRes.status).toBe(404);

    const outsiderCanonicalRes = await apiFetch(env, outsider, `/api/v1/recipes/${created.slug}`);
    expect(outsiderCanonicalRes.status).toBe(404);

    // Owner resolves custom recipe seamlessly through canonical GET /api/v1/recipes/:slug AND :id
    const recipeBySlugRes = await apiFetch(env, owner, `/api/v1/recipes/${created.slug}`);
    expect(recipeBySlugRes.status).toBe(200);
    const recipeBySlug = (await recipeBySlugRes.json()) as any;
    expect(recipeBySlug.contentFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(recipeBySlug.recipe.id).toBe(created.id);
    expect(recipeBySlug.recipe.slug).toBe(created.slug);
    expect(recipeBySlug.recipe.tags).toEqual(['Gia truyền', 'nam']);
    expect(recipeBySlug.recipe.imageUrl).toContain('/takolio/v5/');
    expect(recipeBySlug.match.availableIngredientCount).toBe(1);

    const recipeByIdRes = await apiFetch(env, owner, `/api/v1/recipes/${created.id}`);
    expect(recipeByIdRes.status).toBe(200);
    expect(((await recipeByIdRes.json()) as any).contentFingerprint).toBe(
      recipeBySlug.contentFingerprint,
    );

    // Full /cook/custom-... bridge: start session + complete cooking + deduct inventory + increment cookedCount
    const startCookRes = await apiFetch(env, owner, `/api/v1/recipes/${created.slug}/cook/start`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'single', targetServings: 4 }),
    });
    expect(startCookRes.status).toBe(200);
    const startCookJson = (await startCookRes.json()) as any;
    expect(startCookJson.cookingSessionId).toMatch(/^cook_/);

    const completeCookRes = await apiFetch(
      env,
      owner,
      `/api/v1/recipes/${created.slug}/cook/complete`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': 'cook-heirloom-complete-001' },
        body: JSON.stringify({
          servings: 4,
          contentFingerprint: recipeBySlug.contentFingerprint,
          cookingSessionId: startCookJson.cookingSessionId,
          deductions: [
            {
              ingredientId: 'PORK_BELLY',
              name: 'Thịt ba chỉ',
              quantityDeducted: 500,
              unit: 'g',
            },
          ],
        }),
      },
    );
    expect(completeCookRes.status).toBe(200);
    const completeCookJson = (await completeCookRes.json()) as any;
    expect(completeCookJson.success).toBe(true);
    expect(completeCookJson.inventory[0].quantity).toBe(300);

    // Verify cookedCount incremented to 1 on heirloom recipe
    const afterCookRes = await apiFetch(
      env,
      owner,
      `/api/v1/kitchen-os/heirloom-recipes/${created.id}`,
    );
    expect(afterCookRes.status).toBe(200);
    expect(((await afterCookRes.json()) as any).recipe.cookedCount).toBe(1);

    // Delete heirloom recipe
    const deleteRes = await apiFetch(
      env,
      owner,
      `/api/v1/kitchen-os/heirloom-recipes/${created.id}`,
      { method: 'DELETE' },
    );
    expect(deleteRes.status).toBe(200);

    const listAfterDelete = await apiFetch(env, owner, '/api/v1/kitchen-os/heirloom-recipes');
    expect(((await listAfterDelete.json()) as any).recipes).toEqual([]);
  });

  it('prunes expired d1_idempotency_keys and generates zero-spam 48h FEFO notifications in cleanup', async () => {
    const db = openDb();
    const env = makeEnv(db);

    const adopted = await seedAuthenticatedHousehold(db, {
      userId: 'u_v6_cron_adopted',
      householdId: 'hh_v6_cron_adopted',
      email: 'cron-adopted@takolio.test',
      displayName: 'Gia Đình Lot',
      rawToken: 'tok_v6_cron_adopted_0007',
    });
    const legacy = await seedAuthenticatedHousehold(db, {
      userId: 'u_v6_cron_legacy',
      householdId: 'hh_v6_cron_legacy',
      email: 'cron-legacy@takolio.test',
      displayName: 'Gia Đình Legacy',
      rawToken: 'tok_v6_cron_legacy_0008',
    });

    // Seed 1 expired and 1 active idempotency key
    db.execute(
      `INSERT INTO d1_idempotency_keys
         (key_hash, household_id, actor_id, route_key, request_sha256, status_code, response_json, created_at, expires_at)
       VALUES ('hash_expired', ?, ?, 'POST:/test', 'sha', 201, '{}', datetime('now', '-2 days'), datetime('now', '-1 hour')),
              ('hash_live', ?, ?, 'POST:/test', 'sha', 201, '{}', datetime('now'), datetime('now', '+20 hours'))`,
      [adopted.householdId, adopted.userId, adopted.householdId, adopted.userId],
    );

    const pruned = await cleanupExpiredIdempotencyKeys(db);
    expect(pruned).toBe(1);
    expect(db.query<{ key_hash: string }>('SELECT key_hash FROM d1_idempotency_keys')).toEqual([
      { key_hash: 'hash_live' },
    ]);

    // Seed an expiring active lot in adopted household + an expiring item in legacy household
    const tomorrow = new Date(Date.now() + 24 * 3_600_000).toISOString().slice(0, 10);
    const farFuture = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    // Adopt household officially and create a real canonical FEFO lot expiring tomorrow
    await ensureHouseholdAdopted(db, {
      householdId: adopted.householdId,
      actorId: adopted.userId,
    });
    const lotSnap = await readAdoptedLotSnapshot(db, {
      householdId: adopted.householdId,
      actorId: adopted.userId,
    });
    const fridgeLocation = lotSnap.locations.find((l) => l.type === 'FRIDGE') ?? lotSnap.locations[0];
    const composedLot = await composeInventoryLotCommands(
      db,
      { householdId: adopted.householdId, actorId: adopted.userId },
      [
        {
          clientKey: 'cron-lot-expiring-1',
          input: {
            type: 'CREATE',
            lotId: 'lot_cron_milk_48h',
            ingredientId: null,
            rawName: 'Sữa tươi thanh trùng',
            displayCategory: 'dairy',
            quantity: 1,
            unit: 'l',
            storageLocationId: fridgeLocation.id,
            expiryAt: tomorrow,
            estimatedExpiryAt: null,
            expiryKind: 'USE_BY',
            purchasedAt: nowIso.slice(0, 10),
            openedAt: null,
            purchasePrice: null,
            sourceType: 'MANUAL',
            sourceId: null,
          },
        },
      ],
      nowIso,
    );
    await db.batch(composedLot.statements);

    // Seed an expiring item + non-expiring item in the non-adopted legacy household
    db.execute(
      `INSERT INTO inventory_items (id, household_id, name, quantity, unit, category, storage, expiry_date, freshness)
       VALUES ('legacy_exp_soon', ?, 'Đậu phụ non', 2, 'piece', 'other', 'fridge', ?, 'expiring'),
              ('legacy_far', ?, 'Gạo thơm', 5, 'kg', 'grain', 'pantry', ?, 'fresh')`,
      [legacy.householdId, tomorrow, legacy.householdId, farFuture],
    );

    // Verify GET /pulse on adopted household also reads from inventory_lots natively
    const adoptedPulseRes = await apiFetch(env, adopted, '/api/v1/kitchen-os/pulse');
    expect(adoptedPulseRes.status).toBe(200);
    const adoptedPulse = (await adoptedPulseRes.json()) as any;
    expect(adoptedPulse.inventory.authorityMode).toBe('native');
    expect(adoptedPulse.inventory.expiringWithin48hCount).toBe(1);
    expect(adoptedPulse.inventory.expiringWithin48h[0].name).toBe('Sữa tươi thanh trùng');

    const generatedFirst = await generateProactiveExpiryNotifications(db);
    expect(generatedFirst).toBeGreaterThanOrEqual(2);

    const notifs = db.query<{ household_id: string; dedupe_key: string; title: string }>(
      `SELECT household_id, dedupe_key, title
         FROM user_notifications
        WHERE dedupe_key LIKE 'fefo-48h:%'
          AND household_id IN (?, ?)
        ORDER BY household_id ASC`,
      adopted.householdId,
      legacy.householdId,
    );
    expect(notifs).toHaveLength(2);
    expect(notifs[0].household_id).toBe(adopted.householdId);
    expect(notifs[0].dedupe_key).toMatch(/^fefo-48h:lot_cron_milk_48h:\d{4}-\d{2}-\d{2}$/);
    expect(notifs[0].title).toContain('Sữa tươi thanh trùng');
    expect(notifs[1].household_id).toBe(legacy.householdId);
    expect(notifs[1].dedupe_key).toMatch(/^fefo-48h:legacy_exp_soon:\d{4}-\d{2}-\d{2}$/);
    expect(notifs[1].title).toContain('Đậu phụ non');

    // Replay on the same day produces zero duplicate alerts
    const generatedSecond = await generateProactiveExpiryNotifications(db);
    expect(generatedSecond).toBe(0);

    // Full scheduled cleanup with includeKitchenOs runs cleanly
    const report = await runScheduledCleanup(env, { includeKitchenOs: true });
    expect(report.tasks.every((t) => t.status === 'ok')).toBe(true);
    expect(report.tasks.map((t) => t.task)).toContain('expired-idempotency-keys');
    expect(report.tasks.map((t) => t.task)).toContain('proactive-expiry-notifications');

    // Verify top-level src/worker/index.ts mounts kitchenOsRoutes under /api/v1/kitchen-os/*
    const workerEntryPath = '../../src/worker/' + 'index';
    const workerModule = (await import(/* @vite-ignore */ workerEntryPath)) as {
      default: { fetch: (req: Request, env: Env) => Promise<Response> };
    };
    const rootMountedRes = await workerModule.default.fetch(
      new Request(`${APP_ORIGIN}/api/v1/kitchen-os/pulse`, {
        headers: { Cookie: legacy.cookie },
      }),
      env,
    );
    expect(rootMountedRes.status).toBe(200);
    expect(rootMountedRes.headers.get('ETag')).toMatch(/^W\/"pulse-[0-9a-f]{16}"$/);
  });
});
