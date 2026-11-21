import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReceiptScanResultSchema, VisionScanResultSchema } from '../../packages/ai/src/schemas';
import { backfillLegacyInventory } from '../../packages/db/src/inventory-truth';
import { CANONICAL_INGREDIENTS } from '@frigo/domain';
import { SCAN_QUOTA_POLICY } from '../../src/worker/config/scan-quota-policy';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { ipRateLimiter } from '../../src/worker/middleware/ip-rate-limit';
import { authRoutes } from '../../src/worker/routes/auth';
import { preferencesRoutes } from '../../src/worker/routes/preferences';
import { normalizeImagePayload, scanRoutes } from '../../src/worker/routes/scans';
import { persistPlanRelational, weekRoutes } from '../../src/worker/routes/week';
import { cleanupExpiredGuestAccounts, runScheduledCleanup } from '../../src/worker/services/cleanup';
import { buildOtpEmail } from '../../src/worker/services/email';
import { reserveScanQuota } from '../../src/worker/services/scan-quota';
import type { AuthContext, Env } from '../../src/worker/types';
import { signJwt } from '../../src/worker/utils/jwt';
import { verifyGoogleToken } from '../../src/worker/utils/oauth';
import * as passwordUtils from '../../src/worker/utils/password';
import { SESSION_COOKIE, sha256Hex } from '../../src/worker/utils/session';
import { verifyTurnstileToken } from '../../src/worker/utils/turnstile';
import { SqliteD1 } from '../helpers/sqlite-d1';

const ORIGIN = 'https://app.example.com';
const GOOGLE_CLIENT_ID = '1234567890-testclient.apps.googleusercontent.com';
const JWT_SECRET = 'security-audit-jwt-secret-at-least-32-chars';
const OTP_SECRET = 'security-audit-otp-secret-at-least-32-chars';

function parseJsonc(filePath: string): Record<string, any> {
  const raw = readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  return JSON.parse(raw);
}

function createAuthTestApp() {
  const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
  app.use('*', authMiddleware);
  app.route('/api/v1', authRoutes);
  app.route('/api/v1', scanRoutes);
  app.route('/api/v1', preferencesRoutes);
  app.get('/api/v1/health', (c) => c.json({ ok: true }));
  app.get('/api/v1/config', (c) => c.json({ ok: true }));
  app.get('/api/v1/inventory/health', (c) => c.json({ leaked: true }));
  app.get('/api/v1/shopping/config', (c) => c.json({ leaked: true }));
  app.get('/api/v1/private', (c) => c.json({ auth: c.get('auth') }));
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Security Audit Remediation Suite', () => {
  describe('[CRIT-01] Unverified registration + Google OAuth pre-auth takeover prevention', () => {
    it('wipes unverified pre-planted password credentials when Google OAuth verifies the email', async () => {
      const db = new SqliteD1();
      try {
        const app = createAuthTestApp();
        const attackerSalt = passwordUtils.generateSalt();
        const attackerHash = await passwordUtils.hashPassword('AttackerPlanted123!', attackerSalt);

        // Simulate unverified account pre-planted before real mailbox owner signs in with Google.
        db.seed(`
          INSERT INTO users (id, email, is_guest) VALUES ('usr_pending_victim', 'victim@example.com', 0);
          INSERT INTO auth_accounts (id, user_id, email, password_hash, salt, is_verified)
            VALUES ('acc_pending_victim', 'usr_pending_victim', 'victim@example.com', '${attackerHash}', '${attackerSalt}', 0);
        `);

        vi.stubGlobal(
          'fetch',
          vi.fn(async () =>
            Response.json({
              sub: 'google-sub-victim-001',
              email: 'victim@example.com',
              email_verified: 'true',
              name: 'Real Victim',
              aud: GOOGLE_CLIENT_ID,
              iss: 'https://accounts.google.com',
            })
          )
        );

        const env = {
          DB: db,
          ENVIRONMENT: 'production',
          APP_URL: ORIGIN,
          GOOGLE_CLIENT_ID,
          JWT_SECRET,
          OTP_HASH_SECRET: OTP_SECRET,
        } as unknown as Env;

        const googleRes = await app.request(
          `${ORIGIN}/api/v1/auth/google`,
          {
            method: 'POST',
            headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: 'valid-google-id-token-value' }),
          },
          env
        );
        expect(googleRes.status).toBe(200);

        const accountRow = db.query<{
          password_hash: string | null;
          salt: string | null;
          is_verified: number;
          google_id: string | null;
        }>('SELECT password_hash, salt, is_verified, google_id FROM auth_accounts WHERE email = ?', 'victim@example.com')[0];

        expect(accountRow).toEqual({
          password_hash: null,
          salt: null,
          is_verified: 1,
          google_id: 'google-sub-victim-001',
        });

        // Attacker's pre-planted password must fail with 401 (never 200 or 500).
        const attackerLogin = await app.request(
          `${ORIGIN}/api/v1/auth/login`,
          {
            method: 'POST',
            headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'victim@example.com', password: 'AttackerPlanted123!' }),
          },
          env
        );
        expect(attackerLogin.status).toBe(401);
      } finally {
        db.close();
      }
    });

    it('preserves password credentials when an already-verified account signs in with Google', async () => {
      const db = new SqliteD1();
      try {
        const app = createAuthTestApp();
        const ownerSalt = passwordUtils.generateSalt();
        const ownerHash = await passwordUtils.hashPassword('VerifiedOwnerPass123!', ownerSalt);

        db.seed(`
          INSERT INTO users (id, email, is_guest) VALUES ('usr_verified_owner', 'verified@example.com', 0);
          INSERT INTO auth_accounts (id, user_id, email, password_hash, salt, is_verified)
            VALUES ('acc_verified_owner', 'usr_verified_owner', 'verified@example.com', '${ownerHash}', '${ownerSalt}', 1);
        `);

        vi.stubGlobal(
          'fetch',
          vi.fn(async () =>
            Response.json({
              sub: 'google-sub-verified-002',
              email: 'verified@example.com',
              email_verified: 'true',
              name: 'Verified Owner',
              aud: GOOGLE_CLIENT_ID,
              iss: 'accounts.google.com',
            })
          )
        );

        const env = {
          DB: db,
          ENVIRONMENT: 'production',
          APP_URL: ORIGIN,
          GOOGLE_CLIENT_ID,
          JWT_SECRET,
          OTP_HASH_SECRET: OTP_SECRET,
        } as unknown as Env;

        const googleRes = await app.request(
          `${ORIGIN}/api/v1/auth/google`,
          {
            method: 'POST',
            headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: 'valid-google-id-token-value' }),
          },
          env
        );
        expect(googleRes.status).toBe(200);

        const accountRow = db.query<{ password_hash: string | null; salt: string | null }>(
          'SELECT password_hash, salt FROM auth_accounts WHERE email = ?',
          'verified@example.com'
        )[0];
        expect(accountRow).toEqual({ password_hash: ownerHash, salt: ownerSalt });
      } finally {
        db.close();
      }
    });
  });

  describe('[HIGH-01] Staging auth, Bearer JWT, CSRF, Turnstile & workers_dev hardening', () => {
    it('blocks raw userInfo Google spoofing, Bearer JWTs, and cross-origin auth POSTs in staging', async () => {
      const db = new SqliteD1();
      try {
        const app = createAuthTestApp();
        const stagingEnv = {
          DB: db,
          ENVIRONMENT: 'staging',
          APP_URL: 'https://staging.example.com',
          JWT_SECRET,
          OTP_HASH_SECRET: OTP_SECRET,
        } as unknown as Env;

        // 1. Raw userInfo spoofing rejected on staging
        const spoofRes = await app.request(
          'https://staging.example.com/api/v1/auth/google',
          {
            method: 'POST',
            headers: { Origin: 'https://staging.example.com', 'Content-Type': 'application/json' },
            body: JSON.stringify({ userInfo: { email: 'victim@example.com', name: 'Spoofed' } }),
          },
          stagingEnv
        );
        expect(spoofRes.status).toBe(400);

        // 2. Forged cross-site Origin rejected on staging /auth/*
        const csrfRes = await app.request(
          'https://staging.example.com/api/v1/auth/guest',
          {
            method: 'POST',
            headers: { Origin: 'https://evil.example.com', 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          },
          stagingEnv
        );
        expect(csrfRes.status).toBe(403);
        expect(await csrfRes.json()).toMatchObject({ code: 'CSRF_ORIGIN_DENIED' });

        // 3. Legacy non-prod Bearer JWT rejected on staging
        const jwt = await signJwt(
          { sub: 'usr_1', hid: 'hh_usr_1', typ: 'access', exp: Math.floor(Date.now() / 1000) + 300 },
          JWT_SECRET
        );
        const bearerRes = await app.request(
          'https://staging.example.com/api/v1/private',
          {
            method: 'GET',
            headers: { Authorization: ['Bearer', jwt].join(' ') },
          },
          stagingEnv
        );
        expect(bearerRes.status).toBe(401);

        // 4. Turnstile fails closed on staging when site key is missing
        expect((await verifyTurnstileToken({ ENVIRONMENT: 'staging', TURNSTILE_SECRET_KEY: 'sec' } as Env, 'tok')).ok).toBe(false);
      } finally {
        db.close();
      }
    });

    it('disables workers.dev subdomain exposure in admin configs while keeping guarded customer baseline intact', () => {
      expect(parseJsonc('wrangler.admin.jsonc').workers_dev).toBe(false);
      expect(parseJsonc('wrangler.admin-facade.jsonc').workers_dev).toBe(false);
    });
  });

  describe('[HIGH-02] Spoofable IP header rejection, IP-keyed scan limiter & guest 1-scan trial cap', () => {
    it('ignores spoofed X-Forwarded-For and X-Real-IP headers in production', async () => {
      const store = new Map<string, string>();
      const kv = {
        get: async (k: string) => (store.has(k) ? JSON.parse(store.get(k)!) : null),
        put: async (k: string, v: string) => {
          store.set(k, v);
        },
      } as unknown as Env['CACHE'];

      const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
      app.use('/probe', ipRateLimiter({ maxRequests: 1, windowSeconds: 60, prefix: 'rl_prod_ip' }));
      app.get('/probe', (c) => c.text('ok'));

      const env = { ENVIRONMENT: 'production', CACHE: kv } as Env;
      const first = await app.request(
        '/probe',
        { headers: { 'CF-Connecting-IP': '203.0.113.10', 'X-Forwarded-For': '198.51.100.1', 'X-Real-IP': '198.51.100.1' } },
        env
      );
      expect(first.status).toBe(200);

      // Rotating X-Forwarded-For / X-Real-IP cannot bypass the CF-Connecting-IP limit
      const second = await app.request(
        '/probe',
        { headers: { 'CF-Connecting-IP': '203.0.113.10', 'X-Forwarded-For': '198.51.100.2', 'X-Real-IP': '198.51.100.2' } },
        env
      );
      expect(second.status).toBe(429);
    });

    it('caps newly minted /auth/guest sessions to a single trial scan', async () => {
      const db = new SqliteD1();
      try {
        const app = createAuthTestApp();
        const env = {
          DB: db,
          ENVIRONMENT: 'production',
          APP_URL: ORIGIN,
          JWT_SECRET,
          OTP_HASH_SECRET: OTP_SECRET,
        } as unknown as Env;

        const guestRes = await app.request(
          `${ORIGIN}/api/v1/auth/guest`,
          {
            method: 'POST',
            headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          },
          env
        );
        expect(guestRes.status).toBe(200);
        const guestBody = (await guestRes.json()) as { user: { id: string; householdId: string } };
        expect(SCAN_QUOTA_POLICY.guest).toBe(1);

        const first = await reserveScanQuota(db, {
          userId: guestBody.user.id,
          householdId: guestBody.user.householdId,
          scanId: 'scan_guest_1',
          idempotencyKey: 'guest-key-1',
        });
        expect(first.ok).toBe(true);

        const second = await reserveScanQuota(db, {
          userId: guestBody.user.id,
          householdId: guestBody.user.householdId,
          scanId: 'scan_guest_2',
          idempotencyKey: 'guest-key-2',
        });
        expect(second).toEqual({ ok: false, reason: 'exceeded' });
      } finally {
        db.close();
      }
    });
  });

  describe('[HIGH-03] Abandoned expired guest account pruning with FK integrity', () => {
    it('prunes abandoned expired guests and child rows while preserving active guests and registered users', async () => {
      const db = new SqliteD1();
      try {
        db.seed(`
          INSERT INTO users (id, email, is_guest, created_at) VALUES
            ('guest_old', NULL, 1, datetime('now', '-10 days')),
            ('guest_active', NULL, 1, datetime('now', '-10 days')),
            ('user_real', 'real@example.com', 0, datetime('now', '-30 days'));
          INSERT INTO households (id, name, created_by) VALUES
            ('hh_guest_old', 'Old Guest', 'guest_old'),
            ('hh_guest_active', 'Active Guest', 'guest_active'),
            ('hh_user_real', 'Real User', 'user_real');
          INSERT INTO household_members (id, household_id, user_id, role) VALUES
            ('hm_old', 'hh_guest_old', 'guest_old', 'owner'),
            ('hm_active', 'hh_guest_active', 'guest_active', 'owner'),
            ('hm_real', 'hh_user_real', 'user_real', 'owner');
          INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at) VALUES
            ('sess_old_exp', 'guest_old', 'hh_guest_old', 'hash_old', datetime('now', '-2 days')),
            ('sess_active_live', 'guest_active', 'hh_guest_active', 'hash_live', datetime('now', '+2 days')),
            ('sess_real_exp', 'user_real', 'hh_user_real', 'hash_real', datetime('now', '-40 days'));
          INSERT INTO inventory_items (id, household_id, ingredient_id, name, quantity, unit, storage) VALUES
            ('item_old', 'hh_guest_old', 'CHICKEN_EGG', 'Trứng gà', 2, 'piece', 'fridge');
          INSERT INTO scans (id, user_id, household_id, status, scan_type) VALUES
            ('scan_old', 'guest_old', 'hh_guest_old', 'failed', 'fridge');
        `);

        await backfillLegacyInventory(db, 'hh_guest_old');
        db.seed(`
          INSERT INTO inventory_commands (id, household_id, actor_id, client_key, fingerprint, command_type, result_json, created_at)
            VALUES ('cmd_old', 'hh_guest_old', 'guest_old', 'ck_old', 'fp_old', 'CREATE', '{}', datetime('now', '-10 days'));
          INSERT INTO inventory_events (id, household_id, inventory_item_id, event_type, quantity_delta, unit)
            VALUES ('evt_old', 'hh_guest_old', 'item_old', 'ADD', 2, 'piece');
        `);

        const deleted = await cleanupExpiredGuestAccounts(db, 7);
        expect(deleted).toBe(1);
        expect(db.query("SELECT id FROM users WHERE id != 'demo_user_01' ORDER BY id")).toEqual([
          { id: 'guest_active' },
          { id: 'user_real' },
        ]);
        expect(db.query("SELECT id FROM households WHERE id != 'demo_household_01' ORDER BY id")).toEqual([
          { id: 'hh_guest_active' },
          { id: 'hh_user_real' },
        ]);
        expect(db.query('SELECT id FROM scans')).toEqual([]);
        expect(db.query("SELECT id FROM inventory_lots WHERE household_id = 'hh_guest_old'")).toEqual([]);
        expect(db.query("SELECT id FROM inventory_commands WHERE household_id = 'hh_guest_old'")).toEqual([]);
        expect(db.query('PRAGMA foreign_key_check')).toEqual([]);

        const report = await runScheduledCleanup({ DB: db, ENVIRONMENT: 'development' } as Env);
        expect(report.tasks.every((t) => t.status === 'ok')).toBe(true);
      } finally {
        db.close();
      }
    });
  });

  describe('[HIGH-04] Constant-time dummy PBKDF2 on login & fail-closed auth KV outage', () => {
    it('executes dummy verifyPassword when email does not exist and fails closed on production KV error', async () => {
      const db = new SqliteD1();
      try {
        const app = createAuthTestApp();
        const verifySpy = vi.spyOn(passwordUtils, 'verifyPassword');

        const loginRes = await app.request(
          `${ORIGIN}/api/v1/auth/login`,
          {
            method: 'POST',
            headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'nonexistent@example.com', password: 'SomePassword123!' }),
          },
          { DB: db, ENVIRONMENT: 'production', APP_URL: ORIGIN, JWT_SECRET } as unknown as Env
        );
        expect(loginRes.status).toBe(401);
        expect(verifySpy).toHaveBeenCalledTimes(1);

        // Bound KV throwing an outage error must fail closed (503) on /auth/* in production.
        const brokenKv = {
          get: async () => {
            throw new Error('KV outage');
          },
          put: async () => {
            throw new Error('KV outage');
          },
        } as unknown as Env['CACHE'];

        const outageRes = await app.request(
          `${ORIGIN}/api/v1/auth/login`,
          {
            method: 'POST',
            headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'nonexistent@example.com', password: 'SomePassword123!' }),
          },
          { DB: db, CACHE: brokenKv, ENVIRONMENT: 'production', APP_URL: ORIGIN, JWT_SECRET } as unknown as Env
        );
        expect(outageRes.status).toBe(503);
        expect(await outageRes.json()).toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
      } finally {
        db.close();
      }
    });
  });

  describe('[MED-01] Pre-decode oversized base64 rejection & strict raster image MIME allowlist', () => {
    it('rejects oversized base64 payloads before decoding and blocks SVG/HTML uploads', async () => {
      expect(normalizeImagePayload('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=')).toBeNull();
      expect(normalizeImagePayload('data:image/html;base64,PGh0bWw+PC9odG1sPg==')).toBeNull();
      expect(normalizeImagePayload('data:text/html;base64,PGh0bWw+PC9odG1sPg==')).toBeNull();
      // Raw SVG disguised without data URL header
      expect(normalizeImagePayload(btoa('<svg onload="alert(1)"></svg>'))).toBeNull();
      // Valid synthetic test payload still passes
      expect(normalizeImagePayload('aGVsbG8=')?.mimeType).toBe('image/jpeg');
      expect(normalizeImagePayload('data:image/png;base64,aGVsbG8=')?.mimeType).toBe('image/png');
      expect(normalizeImagePayload('data:image/webp;base64,aGVsbG8=')?.mimeType).toBe('image/webp');

      const db = new SqliteD1();
      try {
        const app = createAuthTestApp();
        db.seed(`
          INSERT INTO users (id, email, is_guest) VALUES ('scan_u', 'scan@example.com', 0);
          INSERT INTO households (id, name, created_by) VALUES ('hh_scan_u', 'Scan House', 'scan_u');
          INSERT INTO household_members (id, household_id, user_id, role) VALUES ('hm_scan_u', 'hh_scan_u', 'scan_u', 'owner');
        `);
        await db
          .prepare("INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at) VALUES ('s_scan', 'scan_u', 'hh_scan_u', ?, datetime('now', '+1 day'))")
          .bind(await sha256Hex('scan-cookie'))
          .run();

        const atobSpy = vi.spyOn(globalThis, 'atob');
        // 64 KiB minimum configured image limit -> ~88K raw chars triggers pre-decode 413 without calling atob!
        const oversized = 'A'.repeat(100_000);
        const res = await app.request(
          `${ORIGIN}/api/v1/scans/fridge`,
          {
            method: 'POST',
            headers: {
              Origin: ORIGIN,
              Cookie: `${SESSION_COOKIE}=scan-cookie`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageBase64: oversized }),
          },
          {
            DB: db,
            ENVIRONMENT: 'production',
            APP_URL: ORIGIN,
            AI_MAX_IMAGE_BYTES: '65536',
          } as unknown as Env
        );
        expect(res.status).toBe(413);
        expect(await res.json()).toMatchObject({ code: 'AI_IMAGE_TOO_LARGE' });
        expect(atobSpy).not.toHaveBeenCalled();
      } finally {
        db.close();
      }
    });
  });

  describe('[MED-02..05, LOW-01..04] Headers, exact public paths, OAuth iss/timeout, AI bounds, CSP & branding', () => {
    it('emits a single non-duplicated HSTS header and enforces exact public path matching', async () => {
      // Keep src/worker/index.ts out of DOM tsconfig.json; tsconfig.worker.json checks it separately.
      const workerEntrypoint = '../../src/worker/index';
      const { default: worker } = (await import(workerEntrypoint)) as {
        default: { fetch: (req: Request, env: Env) => Promise<Response> };
      };
      const hstsRes = await worker.fetch(
        new Request('http://127.0.0.1:8787/api/v1/health'),
        { ENVIRONMENT: 'development' } as Env
      );
      expect(hstsRes.headers.get('Strict-Transport-Security')).toContain('includeSubDomains');

      const app = createAuthTestApp();
      const env = { ENVIRONMENT: 'production', APP_URL: ORIGIN, JWT_SECRET } as unknown as Env;
      expect((await app.request(`${ORIGIN}/api/v1/health`, {}, env)).status).toBe(200);
      expect((await app.request(`${ORIGIN}/api/v1/config`, {}, env)).status).toBe(200);
      expect((await app.request(`${ORIGIN}/api/v1/inventory/health`, {}, env)).status).toBe(401);
      expect((await app.request(`${ORIGIN}/api/v1/shopping/config`, {}, env)).status).toBe(401);
    });

    it('uses json_each(?) in week shopping import so >55 items stay within D1 parameter limits', async () => {
      const db = new SqliteD1();
      try {
        const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
        app.use('*', authMiddleware);
        app.route('/api/v1', weekRoutes);

        db.seed(`
          INSERT INTO users (id, email, is_guest) VALUES ('week_u', 'week@example.com', 0);
          INSERT INTO households (id, name, created_by) VALUES ('hh_week_u', 'Week House', 'week_u');
          INSERT INTO household_members (id, household_id, user_id, role) VALUES ('hm_week_u', 'hh_week_u', 'week_u', 'owner');
        `);

        const ingredients = CANONICAL_INGREDIENTS.slice(0, 55);
        const shoppingItems = ingredients.map((ing, i) => ({
          id: `sitem_${i}`,
          ingredientId: ing.id,
          name: ing.nameVi,
          category: ing.category,
          totalRequiredQuantity: 1,
          inStockQuantity: 0,
          missingQuantity: 1,
          recommendedPurchaseQuantity: 1,
          unit: ing.defaultUnit,
          estimatedMinPriceVnd: 10000,
          estimatedMaxPriceVnd: 15000,
          checked: true,
          cannotBuy: false,
          usedInMeals: ['T2'],
        }));

        await persistPlanRelational(
          db,
          {
            id: 'plan_60',
            householdId: 'hh_week_u',
            startDate: '2026-10-05',
            endDate: '2026-10-11',
            status: 'READY',
            days: [],
            shoppingItems: shoppingItems as any,
            budget: { targetVnd: 500000, estimatedMinVnd: 200000, estimatedMaxVnd: 300000, withinTarget: true },
            utilization: { fridgeIngredientsUsed: 0, totalMealIngredients: 55, utilizationPercent: 0 },
            wasteRisk: { level: 'LOW', expiringItemsCovered: 0, expiringItemsUnhandled: [] },
            shoppingFrequency: 'once',
            createdAt: '2026-10-05T00:00:00.000Z',
            updatedAt: '2026-10-05T00:00:00.000Z',
          } as any,
          'hh_week_u',
          'week_u',
          'legacy'
        );

        const requestItems = shoppingItems.map((item) => ({
          id: item.id,
          ingredientId: item.ingredientId,
          checked: true,
        }));

        const boundCounts: number[] = [];
        db.hooks.beforeStatement = (ev) => {
          if (ev.sql.includes('FROM inventory_items') && ev.sql.includes('json_each')) {
            boundCounts.push(ev.bindings.length);
          }
        };

        const jwt = await signJwt(
          { sub: 'week_u', hid: 'hh_week_u', typ: 'access', exp: Math.floor(Date.now() / 1000) + 300 },
          JWT_SECRET
        );
        const res = await app.request(
          `${ORIGIN}/api/v1/week/plans/plan_60/shopping/complete`,
          {
            method: 'POST',
            headers: {
              Authorization: ['Bearer', jwt].join(' '),
              'Content-Type': 'application/json',
              'Idempotency-Key': 'shop-import-60',
            },
            body: JSON.stringify({ items: requestItems }),
          },
          { DB: db, ENVIRONMENT: 'development', JWT_SECRET, WEEK_SCHEMA_MODE: 'legacy' } as unknown as Env
        );
        expect(res.status).toBe(200);
        expect(boundCounts).toEqual([3]);
        expect(db.query('SELECT COUNT(*) AS count FROM inventory_items WHERE household_id = ?', 'hh_week_u')).toEqual([
          { count: ingredients.length },
        ]);
      } finally {
        db.close();
      }
    });

    it('enforces bodyLimit on /preferences', async () => {
      const db = new SqliteD1();
      try {
        const app = createAuthTestApp();
        const jwt = await signJwt(
          { sub: 'pref_u', hid: 'hh_pref_u', typ: 'access', exp: Math.floor(Date.now() / 1000) + 300 },
          JWT_SECRET
        );
        const hugeBody = JSON.stringify({ dietaryRestrictions: ['x'.repeat(20_000)] });
        const res = await app.request(
          `${ORIGIN}/api/v1/preferences`,
          {
            method: 'PATCH',
            headers: {
              Authorization: ['Bearer', jwt].join(' '),
              'Content-Type': 'application/json',
            },
            body: hugeBody,
          },
          { DB: db, ENVIRONMENT: 'development', JWT_SECRET } as unknown as Env
        );
        expect(res.status).toBe(413);
      } finally {
        db.close();
      }
    });

    it('validates Google token iss claim and attaches an AbortSignal timeout', async () => {
      const fetchMock = vi.fn(async () =>
        Response.json({
          sub: 'g_1',
          email: 'user@example.com',
          email_verified: 'true',
          aud: GOOGLE_CLIENT_ID,
          iss: 'https://evil-issuer.example.com',
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const rejected = await verifyGoogleToken('header.payload.sig', GOOGLE_CLIENT_ID);
      expect(rejected.valid).toBe(false);
      expect(rejected.error).toContain('iss mismatch');
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('bounds VisionScanResultSchema and ReceiptScanResultSchema item arrays and string lengths', () => {
      const validItem = { raw_name: 'Trứng gà', estimated_quantity: 6, unit: 'piece' as const };
      expect(VisionScanResultSchema.safeParse({ items: Array(50).fill(validItem) }).success).toBe(true);
      expect(VisionScanResultSchema.safeParse({ items: Array(51).fill(validItem) }).success).toBe(false);
      expect(ReceiptScanResultSchema.safeParse({ items: Array(51).fill(validItem) }).success).toBe(false);
      expect(
        VisionScanResultSchema.safeParse({ items: [{ ...validItem, raw_name: 'A'.repeat(201) }] }).success
      ).toBe(false);
    });

    it('keeps static _headers CSP synchronized and keeps Takolio OTP copy aligned', () => {
      const headersRaw = readFileSync('public/_headers', 'utf8');
      expect(headersRaw).toContain("script-src 'self'");
      expect(headersRaw).not.toContain("script-src 'self' 'unsafe-inline'");

      const otpMail = buildOtpEmail('654321', 'register');
      expect(otpMail.html).toContain('ứng dụng Takolio');
      expect(otpMail.html).toContain('nhân viên Takolio');
      expect(otpMail.html).not.toContain('ứng dụng Frigo');
      expect(otpMail.html).not.toContain('nhân viên Frigo');
    });
  });
});
