import { afterEach, describe, expect, it } from 'vitest';
import worker from '../../src/worker/index';
import { SqliteD1 } from '../helpers/sqlite-d1';
import {
  openD1Session,
  searchIndexedRecipes,
  upsertRecipeSearchDocuments,
} from '@frigo/db';
import { readFamilyCatalogReceipts } from '../../packages/db/src/family-planning-fence';
import { sharePlanShopping } from '../../src/worker/services/shopping-plan';

// Keep the Worker entrypoint in a .mjs integration test so tsconfig.json (DOM) does not collide with @cloudflare/workers-types.
const TEST_JWT_SECRET = 'phase1-global-test-jwt-secret-key-minimum-32-bytes';

describe('Phase 1 Global Expansion — D1 0048 Schema, FTS5, Catalog Manifest & Worker APIs', () => {
  const openDbs = [];
  const createDb = () => {
    const db = new SqliteD1();
    openDbs.push(db);
    return db;
  };

  afterEach(() => {
    for (const db of openDbs.splice(0)) {
      db.close();
    }
  });

  it('maintains O(1) catalog_manifest witness across catalog mutations and blocks deletion', async () => {
    const db = createDb();
    const initial = await readFamilyCatalogReceipts(db);
    expect(initial).toHaveLength(1);
    expect(initial[0].query).toContain('catalog_manifest');
    const revBefore = Number(initial[0].value.split(':')[0]);
    expect(revBefore).toBeGreaterThanOrEqual(1);

    db.seed(`UPDATE recipes SET title = title WHERE id = (SELECT id FROM recipes LIMIT 1);`);
    const afterUpdate = await readFamilyCatalogReceipts(db);
    expect(afterUpdate).toHaveLength(1);
    const revAfter = Number(afterUpdate[0].value.split(':')[0]);
    expect(revAfter).toBe(revBefore + 1);

    expect(() => db.seed('DELETE FROM catalog_manifest;')).toThrow(/cannot be deleted/);
  });

  it('indexes and searches Japanese Kana (preserving dakuten) and German umlauts via FTS5', async () => {
    const db = createDb();
    const sampleIds = db.query('SELECT id FROM recipes ORDER BY id LIMIT 3').map((r) => r.id);
    const [butaId, futaId, kaeseId] = sampleIds;

    await upsertRecipeSearchDocuments(db, [
      {
        recipeId: butaId,
        locale: 'ja',
        title: '豚汁',
        readingHiragana: 'ぶたじる',
        description: '根菜と豚バラ肉の味噌仕立て',
        tags: ['和食', '汁物'],
        ingredientNames: ['豚バラ肉', '大根', '味噌'],
      },
      {
        recipeId: futaId,
        locale: 'ja',
        title: 'ふたご卵のオムレツ',
        readingHiragana: 'ふたごたまごのおむれつ',
        description: 'ふんわり卵料理',
        tags: ['洋食'],
        ingredientNames: ['卵', 'バター'],
      },
      {
        recipeId: kaeseId,
        locale: 'de',
        title: 'Allgäuer Käsespätzle',
        description: 'Hausgemachte Spätzle mit Bergkäse',
        tags: ['vegetarisch', 'alpen'],
        ingredientNames: ['Bergkäse', 'Mehl', 'Eier'],
      },
    ]);

    // Searching 'ぶた' matches '豚汁' (ぶたじる) and NEVER matches 'ふたご...'
    const butaHits = await searchIndexedRecipes(db, { query: 'ぶた', locale: 'ja' });
    expect(butaHits.map((h) => h.recipeId)).toEqual([butaId]);

    // Searching ASCII 'kaese' matches 'Allgäuer Käsespätzle' via DIN 5007-2 digraph token
    const kaeseHits = await searchIndexedRecipes(db, { query: 'kaese', locale: 'de' });
    expect(kaeseHits.map((h) => h.recipeId)).toEqual([kaeseId]);
  });

  it('propagates D1 Read-Replication session bookmarks via X-D1-Bookmark when native withSession is available', async () => {
    const db = createDb();
    const seenConstraints = [];
    const sessionCapableDb = {
      prepare: (q) => db.prepare(q),
      batch: (s) => db.batch(s),
      exec: (q) => db.exec(q),
      withSession(constraintOrBookmark) {
        seenConstraints.push(constraintOrBookmark);
        return {
          prepare: (q) => db.prepare(q),
          batch: (s) => db.batch(s),
          getBookmark: () => 'v1:00000042:tokyo-nrt-replica',
        };
      },
    };

    const opened = openD1Session(sessionCapableDb, {
      bookmark: 'v1:00000041:client-prev',
      defaultConstraint: 'first-unconstrained',
    });
    expect(opened?.isNativeSession).toBe(true);
    expect(seenConstraints[0]).toBe('v1:00000041:client-prev');

    const res = await worker.fetch(
      new Request('https://app.example.com/api/v1/health', {
        headers: {
          Origin: 'https://app.example.com',
          'Accept-Language': 'ja-JP,ja;q=0.9',
          'X-D1-Bookmark': 'v1:00000041:client-prev',
        },
      }),
      {
        ENVIRONMENT: 'development',
        APP_URL: 'https://app.example.com',
        DB: sessionCapableDb,
        JWT_SECRET: TEST_JWT_SECRET,
      },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Language')).toBe('ja');
    expect(res.headers.get('X-D1-Bookmark')).toBe('v1:00000042:tokyo-nrt-replica');
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain('X-Request-Id');
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain('X-D1-Bookmark');
  });

  it('bootstraps Japanese & German guest sessions and persists regional preferences end-to-end', async () => {
    const db = createDb();
    const env = {
      ENVIRONMENT: 'development',
      APP_URL: 'http://localhost:5173',
      DB: db,
      JWT_SECRET: TEST_JWT_SECRET,
    };

    // 1. Guest sign-in from Tokyo (`Accept-Language: ja-JP`, `CF-IPCountry: JP`)
    const guestRes = await worker.fetch(
      new Request('http://localhost:5173/api/v1/auth/guest', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:5173',
          'Accept-Language': 'ja-JP,ja;q=0.9',
          'CF-IPCountry': 'JP',
        },
      }),
      env,
    );
    expect(guestRes.status).toBe(200);
    const guestBody = await guestRes.json();
    expect(guestBody.user.displayName).toBe('ゲスト');
    const sessionCookie = guestRes.headers.get('Set-Cookie')?.split(';')[0] ?? '';
    expect(sessionCookie).toContain('__Host-frigo_session=');

    // 2. GET /api/v1/me reflects Japanese locale, JPY currency, Asia/Tokyo timezone, Sunday week-start
    const meJa = await worker.fetch(
      new Request('http://localhost:5173/api/v1/me', {
        headers: { Cookie: sessionCookie },
      }),
      env,
    );
    expect(meJa.status).toBe(200);
    const meJaBody = await meJa.json();
    expect(meJaBody.user).toMatchObject({
      locale: 'ja',
      countryCode: 'JP',
      currency: 'JPY',
      timeZone: 'Asia/Tokyo',
      weekStartDay: 0,
      household: { name: 'ゲストのキッチン' },
    });

    // 3. Switch user to Germany (`de`, `DE`, `EUR`, `Europe/Berlin`, Monday week-start)
    const patchDe = await worker.fetch(
      new Request('http://localhost:5173/api/v1/preferences', {
        method: 'PATCH',
        headers: {
          Origin: 'http://localhost:5173',
          Cookie: sessionCookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: 'de',
          locale: 'de',
          countryCode: 'DE',
          currency: 'EUR',
          timeZone: 'Europe/Berlin',
          weekStartDay: 1,
          favoriteCuisines: ['italian', 'japanese'],
        }),
      }),
      env,
    );
    expect(patchDe.status).toBe(200);
    const patchDeBody = await patchDe.json();
    expect(patchDeBody.preferences).toMatchObject({
      language: 'de',
      locale: 'de',
      countryCode: 'DE',
      currency: 'EUR',
      timeZone: 'Europe/Berlin',
      weekStartDay: 1,
    });

    // Verify household row in D1 was also synchronized
    const hhRow = db.query(
      'SELECT locale, currency, timezone, week_start_day FROM households WHERE id = ?',
      guestBody.user.householdId,
    )[0];
    expect(hhRow).toEqual({
      locale: 'de',
      currency: 'EUR',
      timezone: 'Europe/Berlin',
      week_start_day: 1,
    });
  });

  it('localizes shopping list ingredient names in sharePlanShopping for ja and de instead of hardcoded Vietnamese', async () => {
    const db = createDb();
    db.seed(`
      INSERT INTO users (id, email, is_guest) VALUES ('usr_jp_1', 'jp1@example.com', 0);
      INSERT INTO households (id, name, created_by, locale, country_code, currency, timezone, week_start_day)
        VALUES ('hh_jp_1', '田中家のキッチン', 'usr_jp_1', 'ja', 'JP', 'JPY', 'Asia/Tokyo', 0);
      INSERT INTO household_members (id, household_id, user_id, role)
        VALUES ('hm_jp_1', 'hh_jp_1', 'usr_jp_1', 'owner');
      INSERT INTO generated_meal_plans (id, household_id, creator_user_id, revision, request_key, request_fingerprint, intent_json, result_json, source_json)
        VALUES ('10000000-0000-4000-8000-000000000099', 'hh_jp_1', 'usr_jp_1', 1, 'req_jp_99', 'fp_jp_99', '{"version":1,"data":{}}', '{"version":1,"data":{}}', '{"version":1,"data":{}}');
    `);

    const shared = await sharePlanShopping(
      db,
      { householdId: 'hh_jp_1', userId: 'usr_jp_1', locale: 'ja' },
      {
        planId: '10000000-0000-4000-8000-000000000099',
        expectedRevision: 1,
        startDate: '2026-11-22',
        endDate: '2026-11-28',
      },
      'shop_cmd_jp_001',
      async () => ({
        planRevision: 1,
        rows: [
          {
            ingredientId: 'CHICKEN_BREAST',
            name: 'Ức gà',
            quantity: 300,
            unit: 'g',
            slotId: '2026-11-22:dinner:0',
            date: '2026-11-22',
            mealType: 'dinner',
            componentId: 'comp_1',
            recipeId: null,
            title: '親子丼',
            optional: false,
          },
        ],
      }),
    );

    expect(shared.itemCount).toBe(1);
    const items = db.query(
      "SELECT si.name, si.quantity, si.unit FROM shopping_items si JOIN shopping_lists sl ON sl.id = si.list_id WHERE sl.household_id = 'hh_jp_1'",
    );
    expect(items).toEqual([{ name: '鶏むね肉', quantity: 300, unit: 'g' }]);

    const listRow = db.query("SELECT name FROM shopping_lists WHERE household_id = 'hh_jp_1'")[0];
    expect(listRow.name).toBe('買い物リスト');
  });
});
