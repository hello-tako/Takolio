import type { D1DatabaseBinding } from '@frigo/db';
import type { R2Bucket } from '@cloudflare/workers-types';
import { resolveTargetCellForCountry, type SovereignCellId } from '../middleware/sovereign-cell';
import type { Env } from '../types';
import { sha256Hex } from '../utils/session';

export const CONSENT_TYPES = [
  'privacy_policy',
  'terms_of_service',
  'ai_vision_processing',
  'cross_border_ai_transfer',
  'marketing_communications',
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

export interface ConsentRecord {
  id: string;
  consentType: ConsentType;
  policyVersion: string;
  granted: boolean;
  jurisdiction: SovereignCellId;
  recordedAt: string;
}

export interface ErasureExecutionResult {
  requestId: string;
  status: 'completed' | 'pending_r2_purge';
  erasureMode: 'hard_delete' | 'cryptographic_tombstone';
  jurisdiction: SovereignCellId;
  r2ImagesPurged: number;
  r2ImagesPending: number;
  taxRecordsPseudonymized: number;
  completedAt: string | null;
  statutoryDeadlineAt: string;
}

export interface PrivacySweepResult {
  requestsCompleted: number;
  r2ObjectsDeleted: number;
  expiredTaxArchivesDeleted: number;
}

/**
 * Statutory tax record retention horizon under GDPR Art. 17(3)(b) legal obligation carve-out:
 * - EEA / UK / Switzerland (e.g. German Fiscal Code AO §147, French LPF L102 B, EU VAT Directive): 10 years
 * - Japan (National Tax Agency Electronic Bookkeeping Act 電子帳簿保存法) & Vietnam / Global: 7 years
 */
export function computeTaxRetentionYears(countryCode: string | null | undefined): 7 | 10 {
  return resolveTargetCellForCountry(countryCode) === 'EU' ? 10 : 7;
}

export function computeTaxRetentionUntilIso(paidAtIso: string, countryCode: string | null | undefined): string {
  const years = computeTaxRetentionYears(countryCode);
  const baseMs = Number.isFinite(Date.parse(paidAtIso)) ? Date.parse(paidAtIso) : Date.now();
  const d = new Date(baseMs);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString();
}

export async function recordUserConsent(
  db: D1DatabaseBinding,
  input: {
    userId: string;
    consentType: ConsentType;
    policyVersion: string;
    granted: boolean;
    jurisdiction: SovereignCellId;
  },
): Promise<ConsentRecord> {
  const id = `cns_${crypto.randomUUID()}`;
  const recordedAt = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO consent_records (id, user_id, consent_type, policy_version, granted, jurisdiction, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.userId,
      input.consentType,
      input.policyVersion,
      input.granted ? 1 : 0,
      input.jurisdiction,
      recordedAt,
    )
    .run();

  return {
    id,
    consentType: input.consentType,
    policyVersion: input.policyVersion,
    granted: input.granted,
    jurisdiction: input.jurisdiction,
    recordedAt,
  };
}

export async function listUserConsents(db: D1DatabaseBinding, userId: string): Promise<{
  current: Record<string, ConsentRecord>;
  history: ConsentRecord[];
}> {
  const res = await db
    .prepare(
      `SELECT id, consent_type, policy_version, granted, jurisdiction, recorded_at
         FROM consent_records
        WHERE user_id = ?
        ORDER BY datetime(recorded_at) DESC, id DESC
        LIMIT 100`,
    )
    .bind(userId)
    .all<{
      id: string;
      consent_type: ConsentType;
      policy_version: string;
      granted: number;
      jurisdiction: SovereignCellId;
      recorded_at: string;
    }>();

  const history = (res.results ?? []).map((r) => ({
    id: r.id,
    consentType: r.consent_type,
    policyVersion: r.policy_version,
    granted: Boolean(r.granted),
    jurisdiction: r.jurisdiction,
    recordedAt: r.recorded_at,
  }));

  const current: Record<string, ConsentRecord> = {};
  for (const item of history) {
    if (!current[item.consentType]) {
      current[item.consentType] = item;
    }
  }
  return { current, history };
}

/**
 * Builds a complete, machine-readable GDPR Art. 20 (Right to Data Portability) &
 * Japan APPI Art. 33 personal data export bundle for the authenticated user.
 */
export async function buildUserDataPortabilityExport(
  db: D1DatabaseBinding,
  userId: string,
  jurisdiction: SovereignCellId,
): Promise<Record<string, unknown>> {
  const exportedAt = new Date().toISOString();
  const subjectHash = await sha256Hex(userId);

  const [
    userRes,
    profileRes,
    oauthRes,
    prefRes,
    consentsRes,
    householdsRes,
    subRes,
    legacyPaymentsRes,
    globalPaymentsRes,
  ] = await db.batch([
    db.prepare('SELECT id, email, is_guest, created_at, updated_at FROM users WHERE id = ?').bind(userId),
    db.prepare('SELECT display_name, avatar_url, onboarding_completed_at, created_at FROM profiles WHERE user_id = ?').bind(userId),
    db.prepare(
      'SELECT provider, email, email_verified, is_private_relay, display_name, created_at FROM oauth_identities WHERE user_id = ? ORDER BY created_at ASC',
    ).bind(userId),
    db.prepare(
      `SELECT household_size, spicy_level, favorite_cuisines, dietary_restrictions,
              language, locale, country_code, currency, timezone, week_start_day, updated_at
         FROM user_preferences WHERE user_id = ?`,
    ).bind(userId),
    db.prepare(
      'SELECT consent_type, policy_version, granted, jurisdiction, recorded_at FROM consent_records WHERE user_id = ? ORDER BY recorded_at DESC',
    ).bind(userId),
    db.prepare(
      `SELECT h.id, h.name, h.locale, h.country_code, h.currency, h.timezone, h.week_start_day, hm.role, h.created_at
         FROM household_members hm
         JOIN households h ON h.id = hm.household_id
        WHERE hm.user_id = ?
        ORDER BY h.created_at ASC`,
    ).bind(userId),
    db.prepare(
      `SELECT plan, status, expires_at, provider, billing_currency, cancel_at_period_end, grace_period_ends_at, updated_at
         FROM subscriptions WHERE user_id = ?`,
    ).bind(userId),
    db.prepare(
      'SELECT id, plan, amount_vnd, currency, status, created_at FROM payment_intents WHERE user_id = ? ORDER BY created_at DESC',
    ).bind(userId),
    db.prepare(
      `SELECT id, provider, plan, currency, amount_minor, minor_digits, tax_amount_minor,
              country_code, eu_withdrawal_waiver_at, status, created_at
         FROM global_payment_intents WHERE user_id = ? ORDER BY created_at DESC`,
    ).bind(userId),
  ]);

  const households = (householdsRes.results ?? []) as Array<{ id: string; role: string }>;
  const householdIds = households.map((h) => h.id);

  let inventoryItems: unknown[] = [];
  let scans: unknown[] = [];
  let shoppingLists: unknown[] = [];
  let mealPlans: unknown[] = [];
  let savedRecipes: unknown[] = [];

  if (householdIds.length > 0) {
    const placeholders = householdIds.map(() => '?').join(', ');
    const [invRes, scanRes, shopRes, mealRes, savedRes] = await db.batch([
      db.prepare(
        `SELECT id, household_id, ingredient_id, name, quantity, unit, category, storage, expiry_date, freshness, updated_at
           FROM inventory_items WHERE household_id IN (${placeholders}) ORDER BY updated_at DESC`,
      ).bind(...householdIds),
      db.prepare(
        `SELECT id, household_id, scan_type, status, merchant_name, purchase_date, currency, total_amount_minor, total_amount_vnd, created_at
           FROM scans WHERE user_id = ? OR household_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 200`,
      ).bind(userId, ...householdIds),
      db.prepare(
        `SELECT id, household_id, name, created_at FROM shopping_lists WHERE household_id IN (${placeholders}) ORDER BY created_at DESC`,
      ).bind(...householdIds),
      db.prepare(
        `SELECT id, household_id, start_date, end_date, status, currency, created_at FROM meal_plans WHERE household_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 52`,
      ).bind(...householdIds),
      db.prepare(
        `SELECT recipe_id, is_saved, updated_at FROM saved_recipe_entries WHERE user_id = ? ORDER BY updated_at DESC`,
      ).bind(userId),
    ]);
    inventoryItems = invRes.results ?? [];
    scans = scanRes.results ?? [];
    shoppingLists = shopRes.results ?? [];
    mealPlans = mealRes.results ?? [];
    savedRecipes = savedRes.results ?? [];
  }

  // Record zero-PII portability export receipt
  const exportRequestId = `prv_exp_${crypto.randomUUID()}`;
  await db
    .prepare(
      `INSERT INTO privacy_requests (
         id, subject_hash, request_type, jurisdiction, status, r2_keys_json, completed_at, deadline_at
       ) VALUES (?, ?, 'export', ?, 'completed', '[]', ?, ?)`,
    )
    .bind(exportRequestId, subjectHash, jurisdiction, exportedAt, exportedAt)
    .run();

  return {
    schemaVersion: 'takolio-gdpr-export-v1',
    exportRequestId,
    exportedAt,
    jurisdiction,
    user: userRes.results?.[0] ?? null,
    profile: profileRes.results?.[0] ?? null,
    oauthIdentities: oauthRes.results ?? [],
    preferences: prefRes.results?.[0] ?? null,
    consents: consentsRes.results ?? [],
    households,
    inventoryItems,
    scans,
    shoppingLists,
    mealPlans,
    savedRecipes,
    billing: {
      subscription: subRes.results?.[0] ?? null,
      legacyPaymentsVnd: legacyPaymentsRes.results ?? [],
      globalPayments: globalPaymentsRes.results ?? [],
    },
  };
}

/**
 * Executes GDPR Art. 17 / Japan APPI Art. 35 / Apple Guideline 5.1.1(v) Two-Phase Account Erasure:
 * - Phase A (Immediate synchronous D1 transaction):
 *   1. Archives paid tax invoices into zero-PII `financial_tax_archive` (10y EU / 7y JP).
 *   2. Collects all R2 object keys (`scans.image_key`) for immediate + retryable purge.
 *   3. Hard-deletes all personal data, sessions, OAuth bindings, preferences, scans & solo households
 *      (using cryptographic PII tombstone on `users` if immutable append-only inventory audit rows exist).
 *   4. Writes zero-PII `privacy_requests` receipt (`pending_r2_purge` or `completed`).
 * - Phase B (Immediate R2 delete + scheduled retry in `runPrivacyScheduledSweep` if R2 is transiently unavailable).
 */
export async function executeTwoPhaseAccountErasure(
  db: D1DatabaseBinding,
  imagesBucket: R2Bucket | undefined,
  userId: string,
  jurisdiction: SovereignCellId,
): Promise<ErasureExecutionResult> {
  const now = new Date();
  const nowIso = now.toISOString();
  const deadlineIso = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const requestId = `prv_del_${crypto.randomUUID()}`;
  const subjectHash = await sha256Hex(userId);

  // 1. Identify solo households created by this user with zero other members.
  const soloHouseholdsRes = await db
    .prepare(
      `SELECT h.id
         FROM households h
        WHERE h.created_by = ?
          AND NOT EXISTS (
            SELECT 1 FROM household_members hm
             WHERE hm.household_id = h.id AND hm.user_id <> ?
          )`,
    )
    .bind(userId, userId)
    .all<{ id: string }>();
  const soloHouseholdIds = (soloHouseholdsRes.results ?? []).map((r) => r.id);

  // 2. Collect all R2 image keys associated with the user or their solo households.
  const scanKeyQuery =
    soloHouseholdIds.length > 0
      ? db
          .prepare(
            `SELECT DISTINCT image_key
               FROM scans
              WHERE (user_id = ? OR household_id IN (${soloHouseholdIds.map(() => '?').join(', ')}))
                AND image_key IS NOT NULL AND length(trim(image_key)) > 0`,
          )
          .bind(userId, ...soloHouseholdIds)
      : db
          .prepare(
            `SELECT DISTINCT image_key
               FROM scans
              WHERE user_id = ? AND image_key IS NOT NULL AND length(trim(image_key)) > 0`,
          )
          .bind(userId);

  const scanKeysRes = await scanKeyQuery.all<{ image_key: string }>();
  const r2Keys = [...new Set((scanKeysRes.results ?? []).map((r) => r.image_key))];

  // 3. Pseudonymize paid invoices into zero-PII `financial_tax_archive` before deleting billing rows.
  const [paidLegacyRes, paidGlobalRes] = await db.batch([
    db
      .prepare("SELECT id, plan, amount_vnd, updated_at FROM payment_intents WHERE user_id = ? AND status = 'paid'")
      .bind(userId),
    db
      .prepare(
        `SELECT id, provider, plan, currency, amount_minor, minor_digits, tax_amount_minor, country_code, updated_at
           FROM global_payment_intents
          WHERE user_id = ? AND status = 'paid'`,
      )
      .bind(userId),
  ]);

  const taxArchiveStatements = [];
  for (const row of (paidLegacyRes.results ?? []) as Array<{
    id: string;
    plan: 'monthly' | 'annual';
    amount_vnd: number;
    updated_at: string;
  }>) {
    const intentHash = await sha256Hex(`payos_vn:${row.id}`);
    taxArchiveStatements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO financial_tax_archive (
             id, source_intent_hash, provider, plan, currency, amount_minor,
             minor_digits, tax_amount_minor, country_code, paid_at, retention_until
           ) VALUES (?, ?, 'payos_vn', ?, 'VND', ?, 0, 0, 'VN', ?, ?)`,
        )
        .bind(
          `fta_${intentHash.slice(0, 28)}`,
          intentHash,
          row.plan,
          row.amount_vnd,
          row.updated_at || nowIso,
          computeTaxRetentionUntilIso(row.updated_at || nowIso, 'VN'),
        ),
    );
  }

  for (const row of (paidGlobalRes.results ?? []) as Array<{
    id: string;
    provider: 'dodo_mor' | 'payos_vn';
    plan: 'monthly' | 'annual';
    currency: string;
    amount_minor: number;
    minor_digits: 0 | 2;
    tax_amount_minor: number;
    country_code: string;
    updated_at: string;
  }>) {
    const intentHash = await sha256Hex(`${row.provider}:${row.id}`);
    taxArchiveStatements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO financial_tax_archive (
             id, source_intent_hash, provider, plan, currency, amount_minor,
             minor_digits, tax_amount_minor, country_code, paid_at, retention_until
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          `fta_${intentHash.slice(0, 28)}`,
          intentHash,
          row.provider,
          row.plan,
          row.currency,
          row.amount_minor,
          row.minor_digits,
          row.tax_amount_minor,
          row.country_code,
          row.updated_at || nowIso,
          computeTaxRetentionUntilIso(row.updated_at || nowIso, row.country_code),
        ),
    );
  }

  // 4. Check whether append-only immutable ledger tables or shared co-member households reference this user.
  const hhClause =
    soloHouseholdIds.length > 0
      ? `OR household_id IN (${soloHouseholdIds.map(() => '?').join(', ')})`
      : '';
  const hhArgs = soloHouseholdIds.length > 0 ? soloHouseholdIds : [];

  const immutableCheck = await db
    .prepare(
      `SELECT (
         EXISTS (SELECT 1 FROM inventory_commands WHERE actor_id = ? ${hhClause})
         OR EXISTS (SELECT 1 FROM week_swap_receipts WHERE actor_id = ? ${hhClause})
         OR EXISTS (SELECT 1 FROM inventory_adoption_receipts WHERE actor_id = ? ${hhClause})
         OR EXISTS (SELECT 1 FROM inventory_reconciliation_decisions WHERE actor_id = ? ${hhClause})
         OR EXISTS (SELECT 1 FROM households h WHERE h.created_by = ? AND EXISTS (
           SELECT 1 FROM household_members hm WHERE hm.household_id = h.id AND hm.user_id <> ?
         ))
         ${
           soloHouseholdIds.length > 0
             ? `OR EXISTS (SELECT 1 FROM inventory_lots WHERE household_id IN (${soloHouseholdIds.map(() => '?').join(', ')}))
                OR EXISTS (SELECT 1 FROM inventory_events WHERE household_id IN (${soloHouseholdIds.map(() => '?').join(', ')}))
                OR EXISTS (SELECT 1 FROM inventory_observations WHERE household_id IN (${soloHouseholdIds.map(() => '?').join(', ')}))`
             : ''
         }
       ) AS has_immutable`,
    )
    .bind(
      userId,
      ...hhArgs,
      userId,
      ...hhArgs,
      userId,
      ...hhArgs,
      userId,
      ...hhArgs,
      userId,
      userId,
      ...(soloHouseholdIds.length > 0
        ? [...soloHouseholdIds, ...soloHouseholdIds, ...soloHouseholdIds]
        : []),
    )
    .first<{ has_immutable: number }>();

  const hasImmutableRefs = Boolean(immutableCheck?.has_immutable);
  const erasureMode: 'hard_delete' | 'cryptographic_tombstone' = hasImmutableRefs
    ? 'cryptographic_tombstone'
    : 'hard_delete';
  const initialStatus: 'pending_r2_purge' | 'completed' =
    r2Keys.length > 0 ? 'pending_r2_purge' : 'completed';

  const erasureBatch = [
    ...taxArchiveStatements,
    // Revoke & purge all credentials, sessions, OAuth links, and personal preferences
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM sessions_v2 WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM auth_accounts WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM oauth_identities WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM profiles WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM user_preferences WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM consent_records WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM favorites WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM notifications WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM scan_quota_ledger WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM scan_quota_periods WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM checkout_admissions WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM payment_intents WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM global_payment_intents WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM saved_recipe_entries WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM member_ranking_preferences WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM recipe_feedback_events WHERE user_id = ?').bind(userId),
    db.prepare('UPDATE ai_requests SET user_id = NULL WHERE user_id = ?').bind(userId),
    db.prepare('UPDATE shopping_demand_reviews SET actor_user_id = NULL WHERE actor_user_id = ?').bind(userId),
  ];

  if (soloHouseholdIds.length > 0) {
    const ph = soloHouseholdIds.map(() => '?').join(', ');
    erasureBatch.push(
      db.prepare(`DELETE FROM scan_queue_jobs WHERE user_id = ? OR household_id IN (${ph})`).bind(userId, ...soloHouseholdIds),
      db.prepare(`DELETE FROM scans WHERE user_id = ? OR household_id IN (${ph})`).bind(userId, ...soloHouseholdIds),
      db.prepare(`DELETE FROM cooked_meals WHERE user_id = ? OR household_id IN (${ph})`).bind(userId, ...soloHouseholdIds),
      db.prepare('DELETE FROM shopping_plan_sources WHERE creator_user_id = ?').bind(userId),
      db.prepare(`DELETE FROM generated_family_meal_plans WHERE household_id IN (${ph})`).bind(...soloHouseholdIds),
      db.prepare(`DELETE FROM family_meal_preferences WHERE household_id IN (${ph})`).bind(...soloHouseholdIds),
      db.prepare(`DELETE FROM household_ranking_preferences WHERE household_id IN (${ph})`).bind(...soloHouseholdIds),
      db.prepare(`DELETE FROM meal_plans WHERE household_id IN (${ph})`).bind(...soloHouseholdIds),
      db.prepare(`DELETE FROM shopping_lists WHERE household_id IN (${ph})`).bind(...soloHouseholdIds),
    );
  } else {
    erasureBatch.push(
      db.prepare('DELETE FROM scan_queue_jobs WHERE user_id = ?').bind(userId),
      db.prepare('DELETE FROM scans WHERE user_id = ?').bind(userId),
      db.prepare('DELETE FROM cooked_meals WHERE user_id = ?').bind(userId),
      db.prepare('DELETE FROM shopping_plan_sources WHERE creator_user_id = ?').bind(userId),
    );
  }

  erasureBatch.push(db.prepare('DELETE FROM household_members WHERE user_id = ?').bind(userId));

  if (!hasImmutableRefs) {
    if (soloHouseholdIds.length > 0) {
      const ph = soloHouseholdIds.map(() => '?').join(', ');
      erasureBatch.push(db.prepare(`DELETE FROM households WHERE id IN (${ph})`).bind(...soloHouseholdIds));
    }
    erasureBatch.push(db.prepare('DELETE FROM users WHERE id = ?').bind(userId));
  } else {
    if (soloHouseholdIds.length > 0) {
      const ph = soloHouseholdIds.map(() => '?').join(', ');
      erasureBatch.push(
        db
          .prepare(
            `UPDATE households
                SET name = 'Erased Household', country_code = NULL, updated_at = datetime('now')
              WHERE id IN (${ph})`,
          )
          .bind(...soloHouseholdIds),
      );
    }
    erasureBatch.push(
      db
        .prepare(
          `UPDATE users
              SET email = NULL, is_guest = 1, erased_at = ?, updated_at = datetime('now')
            WHERE id = ?`,
        )
        .bind(nowIso, userId),
    );
  }

  erasureBatch.push(
    db
      .prepare(
        `INSERT INTO privacy_requests (
           id, subject_hash, request_type, jurisdiction, status,
           r2_keys_json, r2_deleted_count, erasure_mode, requested_at, completed_at, deadline_at
         ) VALUES (?, ?, 'erasure', ?, ?, ?, 0, ?, ?, ?, ?)`,
      )
      .bind(
        requestId,
        subjectHash,
        jurisdiction,
        initialStatus,
        JSON.stringify(r2Keys),
        erasureMode,
        nowIso,
        initialStatus === 'completed' ? nowIso : null,
        deadlineIso,
      ),
  );

  await db.batch(erasureBatch);

  // Phase B (immediate attempt): purge R2 scan photos right away if IMAGES bucket is bound & healthy.
  let r2Deleted = 0;
  let finalStatus = initialStatus;
  let completedAt: string | null = initialStatus === 'completed' ? nowIso : null;

  if (r2Keys.length > 0 && imagesBucket) {
    try {
      await imagesBucket.delete(r2Keys);
      r2Deleted = r2Keys.length;
      finalStatus = 'completed';
      completedAt = new Date().toISOString();
      await db
        .prepare(
          `UPDATE privacy_requests
              SET status = 'completed',
                  r2_keys_json = '[]',
                  r2_deleted_count = ?,
                  completed_at = ?
            WHERE id = ?`,
        )
        .bind(r2Deleted, completedAt, requestId)
        .run();
    } catch {
      // Leave in `pending_r2_purge` so `runPrivacyScheduledSweep` retries until R2 confirms deletion!
    }
  }

  return {
    requestId,
    status: finalStatus,
    erasureMode,
    jurisdiction,
    r2ImagesPurged: r2Deleted,
    r2ImagesPending: r2Keys.length - r2Deleted,
    taxRecordsPseudonymized: taxArchiveStatements.length,
    completedAt,
    statutoryDeadlineAt: deadlineIso,
  };
}

/**
 * Scheduled Phase-B R2 purge & expired statutory tax archive sweep.
 * Safe to invoke repeatedly from Cloudflare Cron Triggers (`scheduled`).
 */
export async function runPrivacyScheduledSweep(env: Pick<Env, 'DB' | 'IMAGES'>): Promise<PrivacySweepResult> {
  if (!env.DB) {
    return { requestsCompleted: 0, r2ObjectsDeleted: 0, expiredTaxArchivesDeleted: 0 };
  }

  let requestsCompleted = 0;
  let r2ObjectsDeleted = 0;

  if (env.IMAGES) {
    const pendingRes = await env.DB.prepare(
      `SELECT id, r2_keys_json, r2_deleted_count
         FROM privacy_requests
        WHERE status = 'pending_r2_purge'
        ORDER BY requested_at ASC
        LIMIT 50`,
    ).all<{ id: string; r2_keys_json: string; r2_deleted_count: number }>();

    for (const row of pendingRes.results ?? []) {
      let keys: string[] = [];
      try {
        keys = JSON.parse(row.r2_keys_json) as string[];
      } catch {
        keys = [];
      }

      if (keys.length === 0) {
        await env.DB.prepare(
          `UPDATE privacy_requests SET status = 'completed', completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
        )
          .bind(row.id)
          .run();
        requestsCompleted++;
        continue;
      }

      try {
        await env.IMAGES.delete(keys);
        r2ObjectsDeleted += keys.length;
        requestsCompleted++;
        await env.DB.prepare(
          `UPDATE privacy_requests
              SET status = 'completed',
                  r2_keys_json = '[]',
                  r2_deleted_count = ?,
                  completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?`,
        )
          .bind(row.r2_deleted_count + keys.length, row.id)
          .run();
      } catch {
        // Retain for next scheduled retry before 30-day statutory deadline
      }
    }
  }

  const taxDel = await env.DB.prepare(
    "DELETE FROM financial_tax_archive WHERE datetime(retention_until) IS NOT NULL AND datetime(retention_until) < datetime('now')",
  ).run();
  const expiredTaxArchivesDeleted = typeof taxDel.meta?.changes === 'number' ? taxDel.meta.changes : 0;

  return {
    requestsCompleted,
    r2ObjectsDeleted,
    expiredTaxArchivesDeleted,
  };
}
