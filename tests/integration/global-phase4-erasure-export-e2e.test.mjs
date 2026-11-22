import { afterEach, describe, expect, it } from 'vitest';
import worker from '../../src/worker/index.ts';
import { runPrivacyScheduledSweep } from '../../src/worker/services/privacy-compliance.ts';
import { SESSION_COOKIE, sha256Hex } from '../../src/worker/utils/session.ts';
import { SqliteD1 } from '../helpers/sqlite-d1.ts';

const JWT_SECRET = 'global-phase4-jwt-secret-32-chars-minimum!!';
const APP_URL = 'https://eu.takolio.com';

class MemoryKV {
  store = new Map();
  async get(key, type) {
    const entry = this.store.get(key);
    if (!entry) return null;
    return type === 'json' ? JSON.parse(entry) : entry;
  }
  async put(key, value) {
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  async delete(key) {
    this.store.delete(key);
  }
}

class MemoryR2Bucket {
  objects = new Set();
  failNextDelete = false;
  constructor(initialKeys = []) {
    for (const k of initialKeys) this.objects.add(k);
  }
  async delete(keys) {
    if (this.failNextDelete) {
      this.failNextDelete = false;
      throw new Error('SIMULATED_R2_TRANSIENT_TIMEOUT');
    }
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) this.objects.delete(k);
  }
}

function createExecutionContext() {
  const pending = [];
  return {
    ctx: {
      waitUntil(promise) {
        pending.push(Promise.resolve(promise));
      },
      passThroughOnException() {},
    },
    async flush() {
      await Promise.all(pending.splice(0));
    },
  };
}

function createWorkerEnv(db, r2, overrides = {}) {
  return {
    DB: db,
    IMAGES: r2,
    CACHE: new MemoryKV(),
    ENVIRONMENT: 'development',
    CELL_REGION: 'EU',
    ENFORCE_CELL_SOVEREIGNTY: 'true',
    AI_JURISDICTION: 'EU',
    APP_URL,
    JWT_SECRET,
    OTP_HASH_SECRET: 'global-phase4-otp-secret-32-chars-minimum!!',
    ...overrides,
  };
}

describe('Global Phase 4 — EU Sovereign Cell Guard, GDPR Art. 20 Export & Art. 17 Two-Phase Account Erasure E2E', () => {
  const databases = [];
  afterEach(() => {
    for (const db of databases.splice(0)) db.close();
  });

  it('enforces 421 Misdirected Sovereign Cell, exports Art. 20 JSON bundle, and executes 2-phase Art. 17 D1+R2 erasure with zero-PII tax archiving', async () => {
    const db = new SqliteD1();
    databases.push(db);
    const r2 = new MemoryR2Bucket([
      'scans/h_eu_gdpr/fridge_photo_1.jpg',
      'scans/h_eu_gdpr/rewe_receipt_2.jpg',
    ]);

    const rawToken = 'sess_tok_eu_gdpr_user';
    const tokenHash = await sha256Hex(rawToken);
    db.seed(`
      INSERT INTO users (id, email, is_guest) VALUES ('u_eu_1', 'claire@paris.example', 0);
      INSERT INTO profiles (id, user_id, display_name) VALUES ('p_eu_1', 'u_eu_1', 'Claire Dubois');
      INSERT INTO oauth_identities (id, user_id, provider, provider_subject, email, email_verified, is_private_relay)
      VALUES ('oid_eu_1', 'u_eu_1', 'apple', '001122.claire_apple', 'claire' || '@' || 'privaterelay.appleid.com', 1, 1);
      INSERT INTO households (id, name, created_by, locale, country_code, currency, timezone)
      VALUES ('h_eu_gdpr', 'La cuisine de Claire', 'u_eu_1', 'fr', 'FR', 'EUR', 'Europe/Paris');
      INSERT INTO household_members (id, household_id, user_id, role) VALUES ('hm_eu_1', 'h_eu_gdpr', 'u_eu_1', 'owner');
      INSERT INTO user_preferences (id, user_id, locale, country_code, currency, timezone)
      VALUES ('pref_eu_1', 'u_eu_1', 'fr', 'FR', 'EUR', 'Europe/Paris');
      INSERT INTO scans (id, user_id, household_id, image_key, status, scan_type, merchant_name, currency, total_amount_minor)
      VALUES
        ('sc_eu_1', 'u_eu_1', 'h_eu_gdpr', 'scans/h_eu_gdpr/fridge_photo_1.jpg', 'confirmed', 'fridge', NULL, NULL, NULL),
        ('sc_eu_2', 'u_eu_1', 'h_eu_gdpr', 'scans/h_eu_gdpr/rewe_receipt_2.jpg', 'confirmed', 'receipt', 'Carrefour', 'EUR', 1850);
      INSERT INTO global_payment_intents (
        id, user_id, provider, plan, currency, amount_minor, minor_digits,
        tax_amount_minor, tax_inclusive, country_code, eu_withdrawal_waiver_at, status, expires_at, updated_at
      ) VALUES (
        'gpay_eu_paid_1', 'u_eu_1', 'dodo_mor', 'annual', 'EUR', 4990, 2,
        832, 1, 'FR', '2026-11-22T10:00:00.000Z', 'paid', '2026-11-22T11:00:00.000Z', '2026-11-22T10:05:00.000Z'
      );
      INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at)
      VALUES ('s_eu_1', 'u_eu_1', 'h_eu_gdpr', '${tokenHash}', datetime('now', '+7 days'));
    `);

    const env = createWorkerEnv(db, r2);
    const cookieHeader = `${SESSION_COOKIE}=${rawToken}`;

    // 1. Cross-cell boundary guard: JP-pinned request hitting EU Sovereign Cell is rejected with 421!
    const misdirected = await worker.fetch(
      new Request(`${APP_URL}/api/v1/account/residency`, {
        headers: { Cookie: cookieHeader, 'X-Takolio-Required-Cell': 'JP' },
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(misdirected.status).toBe(421);
    expect(misdirected.headers.get('x-takolio-cell')).toBe('EU');
    expect(misdirected.headers.get('x-takolio-data-residency')).toBe('eu-sovereign');
    const misBody = await misdirected.json();
    expect(misBody).toMatchObject({
      code: 'MISDIRECTED_SOVEREIGN_CELL',
      activeCell: 'EU',
      requiredCell: 'JP',
      redirectOrigin: 'https://jp.takolio.com',
    });

    // 2. Record GDPR Art. 7 consent (`POST /api/v1/account/consents`)
    const consentRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/account/consents`, {
        method: 'POST',
        headers: { Cookie: cookieHeader, Origin: APP_URL, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentType: 'ai_vision_processing',
          policyVersion: '2026-11-v2',
          granted: true,
        }),
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(consentRes.status).toBe(201);
    const consentJson = await consentRes.json();
    expect(consentJson.consent).toMatchObject({
      consentType: 'ai_vision_processing',
      granted: true,
      jurisdiction: 'EU',
    });

    // 3. GDPR Art. 20 Data Portability Export (`GET /api/v1/account/export`)
    const exportRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/account/export`, { headers: { Cookie: cookieHeader } }),
      env,
      createExecutionContext().ctx,
    );
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-disposition')).toContain('attachment; filename="takolio-personal-data-export.json"');
    const exportBundle = await exportRes.json();
    expect(exportBundle.schemaVersion).toBe('takolio-gdpr-export-v1');
    expect(exportBundle.jurisdiction).toBe('EU');
    expect(exportBundle.user.email).toBe('claire@paris.example');
    expect(exportBundle.oauthIdentities).toHaveLength(1);
    expect(exportBundle.consents).toHaveLength(1);
    expect(exportBundle.scans).toHaveLength(2);
    expect(exportBundle.billing.globalPayments).toHaveLength(1);

    // 4. Simulate transient R2 outage during `DELETE /api/v1/account`:
    // Phase A D1 erasure succeeds synchronously (`pending_r2_purge`), then Phase B cron sweep finishes R2!
    r2.failNextDelete = true;
    const delRes = await worker.fetch(
      new Request(`${APP_URL}/api/v1/account`, {
        method: 'DELETE',
        headers: { Cookie: cookieHeader, Origin: APP_URL, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE_MY_ACCOUNT' }),
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(delRes.status).toBe(200);
    expect(delRes.headers.get('set-cookie')).toContain('Max-Age=0');
    const delJson = await delRes.json();
    expect(delJson.erasure).toMatchObject({
      status: 'pending_r2_purge',
      erasureMode: 'hard_delete',
      jurisdiction: 'EU',
      r2ImagesPurged: 0,
      r2ImagesPending: 2,
      taxRecordsPseudonymized: 1,
    });

    // Verify ALL PII rows are immediately gone from D1!
    expect(db.query("SELECT * FROM users WHERE id = 'u_eu_1'")).toHaveLength(0);
    expect(db.query("SELECT * FROM profiles WHERE user_id = 'u_eu_1'")).toHaveLength(0);
    expect(db.query("SELECT * FROM oauth_identities WHERE user_id = 'u_eu_1'")).toHaveLength(0);
    expect(db.query("SELECT * FROM scans WHERE user_id = 'u_eu_1'")).toHaveLength(0);
    expect(db.query("SELECT * FROM households WHERE id = 'h_eu_gdpr'")).toHaveLength(0);
    expect(db.query("SELECT * FROM global_payment_intents WHERE user_id = 'u_eu_1'")).toHaveLength(0);

    // Verify statutory tax archive retains pure accounting amounts (10-year FR/EU retention) with ZERO PII!
    const taxArchive = db.query('SELECT * FROM financial_tax_archive');
    expect(taxArchive).toHaveLength(1);
    expect(taxArchive[0]).toMatchObject({
      provider: 'dodo_mor',
      currency: 'EUR',
      amount_minor: 4990,
      tax_amount_minor: 832,
      country_code: 'FR',
      retention_until: '2036-11-22T10:05:00.000Z',
    });
    expect(JSON.stringify(taxArchive[0])).not.toContain('claire');
    expect(JSON.stringify(taxArchive[0])).not.toContain('u_eu_1');

    // Old session cookie immediately rejected with 401!
    const afterMe = await worker.fetch(
      new Request(`${APP_URL}/api/v1/me`, { headers: { Cookie: cookieHeader } }),
      env,
      createExecutionContext().ctx,
    );
    expect(afterMe.status).toBe(401);

    // 5. Phase B Cron Sweep (`runPrivacyScheduledSweep`) retries and deletes the 2 R2 photos!
    expect(r2.objects.size).toBe(2);
    const sweep = await runPrivacyScheduledSweep(env);
    expect(sweep).toEqual({
      requestsCompleted: 1,
      r2ObjectsDeleted: 2,
      expiredTaxArchivesDeleted: 0,
    });
    expect(r2.objects.size).toBe(0);

    const finalReceipt = db.query("SELECT status, r2_deleted_count, r2_keys_json FROM privacy_requests WHERE request_type = 'erasure'")[0];
    expect(finalReceipt).toEqual({
      status: 'completed',
      r2_deleted_count: 2,
      r2_keys_json: '[]',
    });
  });

  it('performs cryptographic PII tombstone erasure cleanly when immutable append-only inventory ledger rows exist', async () => {
    const db = new SqliteD1();
    databases.push(db);
    const r2 = new MemoryR2Bucket();
    const rawToken = 'sess_tok_jp_tombstone';
    const tokenHash = await sha256Hex(rawToken);

    db.seed(`
      INSERT INTO users (id, email, is_guest) VALUES ('u_jp_tomb', 'kenji@tokyo.example', 0);
      INSERT INTO profiles (id, user_id, display_name) VALUES ('p_jp_t', 'u_jp_tomb', '鈴木 健二');
      INSERT INTO households (id, name, created_by, locale, country_code, currency, timezone)
      VALUES ('h_jp_tomb', '鈴木家の冷蔵庫', 'u_jp_tomb', 'ja', 'JP', 'JPY', 'Asia/Tokyo');
      INSERT INTO household_members (id, household_id, user_id, role) VALUES ('hm_jp_t', 'h_jp_tomb', 'u_jp_tomb', 'owner');
      INSERT INTO week_swap_receipts (id, household_id, actor_id, plan_id, meal_id, client_key, fingerprint, created_at)
      VALUES ('wsr_1', 'h_jp_tomb', 'u_jp_tomb', 'plan_1', 'meal_1', 'ck_swap_receipt_001', 'fp_1', '2026-11-22T00:00:00.000Z');
      INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at)
      VALUES ('s_jp_t', 'u_jp_tomb', 'h_jp_tomb', '${tokenHash}', datetime('now', '+7 days'));
    `);

    const env = createWorkerEnv(db, r2, {
      APP_URL: 'https://jp.takolio.com',
      CELL_REGION: 'JP',
      AI_JURISDICTION: 'JP',
      ENFORCE_CELL_SOVEREIGNTY: 'false',
    });
    const delRes = await worker.fetch(
      new Request('https://jp.takolio.com/api/v1/account', {
        method: 'DELETE',
        headers: {
          Cookie: `${SESSION_COOKIE}=${rawToken}`,
          Origin: 'https://jp.takolio.com',
          'Content-Type': 'application/json',
          'CF-IPCountry': 'JP',
        },
        body: JSON.stringify({ confirm: 'DELETE_MY_ACCOUNT' }),
      }),
      env,
      createExecutionContext().ctx,
    );
    expect(delRes.status).toBe(200);
    const delJson = await delRes.json();
    expect(delJson.erasure).toMatchObject({
      status: 'completed',
      erasureMode: 'cryptographic_tombstone',
      jurisdiction: 'JP',
    });

    // Profile & sessions hard-deleted; user email & household name scrubbed of all PII!
    expect(db.query("SELECT * FROM profiles WHERE user_id = 'u_jp_tomb'")).toHaveLength(0);
    expect(db.query("SELECT * FROM sessions_v2 WHERE user_id = 'u_jp_tomb'")).toHaveLength(0);
    const tombUser = db.query("SELECT email, is_guest, erased_at FROM users WHERE id = 'u_jp_tomb'")[0];
    expect(tombUser.email).toBeNull();
    expect(tombUser.is_guest).toBe(1);
    expect(tombUser.erased_at).toBeTruthy();

    const tombHousehold = db.query("SELECT name, country_code FROM households WHERE id = 'h_jp_tomb'")[0];
    expect(tombHousehold).toEqual({ name: 'Erased Household', country_code: null });
  });
});
