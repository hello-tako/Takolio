import { Env } from '../types';
import { getExtendedRetentionConfig } from '../config/retention';
import { validateEnvironment } from '../config/validation';
import { reconcileStaleScanReservations } from './scan-quota';
import { sha256Hex } from '../utils/session';

/**
 * Scheduled cleanup for expired OTPs, expired sessions, terminal scan queue
 * ledger rows, expired R2 scan objects + rows (>90d), and abandoned expired
 * guest accounts (>30d). All statements DELETE rows whose natural expiry or
 * terminal timestamp is older than the retention window, so re-running the
 * cron is always safe (replay-safe/idempotent) and active rows are retained.
 *
 * `datetime(column)` normalization matters: application code writes
 * `expires_at`/`completed_at` as JS ISO strings while D1 defaults write
 * `YYYY-MM-DD HH:MM:SS`; comparing raw text across both formats is wrong.
 */

export type CleanupTaskStatus = 'ok' | 'skipped' | 'error';

export interface CleanupTaskResult {
  task: string;
  status: CleanupTaskStatus;
  deleted: number;
  error?: string;
}

export interface CleanupReport {
  ranAt: string;
  environment: string;
  tasks: CleanupTaskResult[];
}

const CLEANUP_TASK_FAILURE = 'CLEANUP_TASK_FAILED';

function changesOf(result: { success: boolean; meta: Record<string, unknown> }): number {
  return typeof result.meta?.changes === 'number' ? result.meta.changes : 0;
}

async function deleteExpired(
  db: NonNullable<Env['DB']>,
  table: string,
  timeColumn: string,
  days: number,
  extraCondition = ''
): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM ${table} WHERE datetime(${timeColumn}) IS NOT NULL
         AND datetime(${timeColumn}) < datetime('now', ?)${extraCondition}`
    )
    .bind(`-${days} days`)
    .run();
  return changesOf(result);
}

export async function cleanupExpiredOtps(db: NonNullable<Env['DB']>, days: number): Promise<number> {
  // Retain failure evidence until an explicit legacy-retention policy is implemented.
  return deleteExpired(db, 'auth_otps', 'expires_at', days, ' AND COALESCE(attempt_count, 0) = 0 AND locked_until IS NULL');
}

/** Keep scope tombstones and legacy imports; prune only receipts beyond every active horizon. */
export async function cleanupStrictOtps(db: NonNullable<Env['DB']>, days: number): Promise<number> {
  const retentionSeconds = Math.max(86400, Math.floor(days) * 86400);
  if (!Number.isSafeInteger(retentionSeconds)) throw new Error('OTP_RETENTION_INVALID');
  const results = await db.batch([
    db.prepare(`DELETE FROM auth_otp_tickets
      WHERE request_id IS NOT NULL AND admitted_at <= unixepoch() - ? AND deadline <= unixepoch()
        AND (proof_expires_at IS NULL OR proof_expires_at <= unixepoch())
        AND EXISTS (SELECT 1 FROM auth_otp_requests r WHERE r.id = auth_otp_tickets.request_id AND r.retained_until <= unixepoch())
        AND NOT EXISTS (SELECT 1 FROM auth_otp_issuances i WHERE i.id = auth_otp_tickets.issuance_id AND i.expires_at > unixepoch())`).bind(retentionSeconds),
    db.prepare(`DELETE FROM auth_otp_requests
      WHERE created_at <= unixepoch() - ? AND retained_until <= unixepoch()
        AND (proof_expires_at IS NULL OR proof_expires_at <= unixepoch())
        AND NOT EXISTS (SELECT 1 FROM auth_otp_tickets t WHERE t.request_id = auth_otp_requests.id)
        AND NOT EXISTS (SELECT 1 FROM auth_otp_issuances i WHERE i.id = auth_otp_requests.issuance_id AND i.expires_at > unixepoch())`).bind(retentionSeconds),
    db.prepare(`DELETE FROM auth_otp_issuances
      WHERE created_at <= unixepoch() - ? AND expires_at <= unixepoch()
        AND NOT EXISTS (SELECT 1 FROM auth_otp_requests r WHERE r.issuance_id = auth_otp_issuances.id)
        AND NOT EXISTS (SELECT 1 FROM auth_otp_tickets t WHERE t.issuance_id = auth_otp_issuances.id)`).bind(retentionSeconds),
  ]);
  if (results.length !== 3 || results.some((result) => !result.success)) throw new Error('OTP_CLEANUP_UNAVAILABLE');
  return results.reduce((count, result) => count + changesOf(result), 0);
}

/** Legacy sessions are not an authentication or cleanup source after cutover. */
export async function cleanupExpiredSessions(db: NonNullable<Env['DB']>, days: number): Promise<number> {
  return deleteExpired(db, 'sessions_v2', 'expires_at', days);
}

/** Keep tombstones while the scan or its quota reservation may still need replay. */
export async function cleanupTerminalScanJobs(
  db: NonNullable<Env['DB']>,
  cfg: { readyJobDays: number; failedJobDays: number }
): Promise<{ readyDeleted: number; failedDeleted: number }> {
  const replaySafe = ` AND EXISTS (
    SELECT 1 FROM scans s WHERE s.id = scan_queue_jobs.scan_id
      AND s.user_id = scan_queue_jobs.user_id AND s.household_id = scan_queue_jobs.household_id
      AND ((scan_queue_jobs.status = 'ready' AND s.status IN ('ready', 'confirmed'))
        OR (scan_queue_jobs.status = 'failed' AND s.status = 'failed'))
    ) AND NOT EXISTS (
      SELECT 1 FROM scan_quota_ledger q WHERE q.scan_id = scan_queue_jobs.scan_id
        AND q.status = 'reserved'
    )`;
  const readyDeleted = await deleteExpired(
    db,
    'scan_queue_jobs',
    'MAX(COALESCE(datetime(completed_at), datetime(updated_at)), datetime(updated_at))',
    cfg.readyJobDays,
    " AND status = 'ready'" + replaySafe
  );
  const failedDeleted = await deleteExpired(
    db,
    'scan_queue_jobs',
    'updated_at',
    cfg.failedJobDays,
    " AND status = 'failed'" + replaySafe
  );
  return { readyDeleted, failedDeleted };
}

/** Release quota held by an async enqueue that never reached a live worker. */
export async function cleanupStaleScanReservations(
  db: NonNullable<Env['DB']>,
  staleMinutes: number,
): Promise<{ consumed: number; released: number; expiredJobs: number; expiredScans: number }> {
  return reconcileStaleScanReservations(db, staleMinutes);
}

/**
 * Delete R2 scan objects (`image_key`) before pruning terminal `scans` rows
 * older than `scanDays` (default 90 days). Never deletes active (`pending` /
 * `processing`) scans, scans with retained `scan_queue_jobs`, or scans with
 * reserved quota ledger entries.
 */
export async function cleanupExpiredScans(
  db: NonNullable<Env['DB']>,
  imagesBucket: Env['IMAGES'] | undefined,
  scanDays: number,
): Promise<number> {
  const candidates = await db
    .prepare(
      `SELECT id, image_key FROM scans
        WHERE status IN ('ready', 'confirmed', 'failed')
          AND datetime(created_at) IS NOT NULL
          AND datetime(created_at) < datetime('now', ?)
          AND NOT EXISTS (SELECT 1 FROM scan_queue_jobs j WHERE j.scan_id = scans.id)
          AND NOT EXISTS (SELECT 1 FROM scan_quota_ledger q WHERE q.scan_id = scans.id AND q.status = 'reserved')
        ORDER BY datetime(created_at) ASC
        LIMIT 200`
    )
    .bind(`-${scanDays} days`)
    .all<{ id: string; image_key: string | null }>();

  const rows = candidates.results ?? [];
  if (rows.length === 0) return 0;

  const imageKeys = Array.from(
    new Set(
      rows
        .map((row) => row.image_key)
        .filter((key): key is string => typeof key === 'string' && key.trim().length > 0)
    )
  );
  if (imagesBucket && imageKeys.length > 0) {
    await imagesBucket.delete(imageKeys.length === 1 ? imageKeys[0] : imageKeys);
  }

  const placeholders = rows.map(() => '?').join(',');
  const del = await db
    .prepare(
      `DELETE FROM scans
        WHERE id IN (${placeholders})
          AND status IN ('ready', 'confirmed', 'failed')
          AND NOT EXISTS (SELECT 1 FROM scan_queue_jobs j WHERE j.scan_id = scans.id)
          AND NOT EXISTS (SELECT 1 FROM scan_quota_ledger q WHERE q.scan_id = scans.id AND q.status = 'reserved')`
    )
    .bind(...rows.map((row) => row.id))
    .run();

  return changesOf(del);
}

/**
 * Prune abandoned expired guest users (`is_guest = 1`, older than `guestDays`
 * default 30 days, with zero active `sessions_v2` and zero immutable ledger
 * or retained operational history).
 */
export async function cleanupAbandonedGuests(
  db: NonNullable<Env['DB']>,
  guestDays: number,
): Promise<number> {
  const eligibleUsersSubquery = `
    SELECT u.id FROM users u
     WHERE u.is_guest = 1
       AND datetime(u.created_at) IS NOT NULL
       AND datetime(u.created_at) < datetime('now', ?)
       AND NOT EXISTS (
         SELECT 1 FROM sessions_v2 s
          WHERE s.user_id = u.id
            AND s.revoked_at IS NULL
            AND datetime(s.expires_at) >= datetime('now')
       )
       AND NOT EXISTS (SELECT 1 FROM scans sc WHERE sc.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM cooked_meals cm WHERE cm.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM inventory_adoption_receipts iar WHERE iar.actor_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM inventory_commands ic WHERE ic.actor_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM inventory_reconciliation_decisions ird WHERE ird.actor_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM week_swap_receipts wsr WHERE wsr.actor_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM shopping_plan_sources sps WHERE sps.creator_user_id = u.id)
  `;

  const windowParam = `-${guestDays} days`;
  const results = await db.batch([
    db
      .prepare(`UPDATE ai_requests SET user_id = NULL WHERE user_id IN (${eligibleUsersSubquery})`)
      .bind(windowParam),
    db
      .prepare(
        `DELETE FROM households
          WHERE created_by IN (${eligibleUsersSubquery})
            AND NOT EXISTS (
              SELECT 1 FROM household_members hm
               WHERE hm.household_id = households.id AND hm.user_id <> households.created_by
            )
            AND NOT EXISTS (SELECT 1 FROM scans sc WHERE sc.household_id = households.id)
            AND NOT EXISTS (SELECT 1 FROM inventory_adoption_receipts iar WHERE iar.household_id = households.id)
            AND NOT EXISTS (SELECT 1 FROM inventory_lots il WHERE il.household_id = households.id)
            AND NOT EXISTS (SELECT 1 FROM inventory_events ie WHERE ie.household_id = households.id)
            AND NOT EXISTS (SELECT 1 FROM inventory_observations io WHERE io.household_id = households.id)`
      )
      .bind(windowParam),
    db
      .prepare(
        `DELETE FROM users
          WHERE id IN (${eligibleUsersSubquery})
            AND NOT EXISTS (SELECT 1 FROM households h WHERE h.created_by = users.id)`
      )
      .bind(windowParam),
  ]);

  if (results.length !== 3 || results.some((r) => !r.success)) {
    throw new Error('GUEST_CLEANUP_UNAVAILABLE');
  }
  return changesOf(results[2]);
}

/**
 * Prune expired durable HTTP idempotency receipts (`d1_idempotency_keys`).
 */
export async function cleanupExpiredIdempotencyKeys(
  db: NonNullable<Env['DB']>,
): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM d1_idempotency_keys
        WHERE datetime(expires_at) IS NOT NULL
          AND datetime(expires_at) < datetime('now')`
    )
    .run();
  return changesOf(result);
}

/**
 * Proactively generate zero-spam FEFO 48-hour expiry alerts into `user_notifications`
 * across active `inventory_lots` and non-adopted `inventory_items`.
 * Deduplicated per lot/item per UTC calendar day via `dedupe_key = 'fefo-48h:' || lot_id || ':' || date('now')`.
 */
export async function generateProactiveExpiryNotifications(
  db: NonNullable<Env['DB']>,
): Promise<number> {
  const [clockRes, lotsRes, legacyItemsRes] = await db.batch([
    db.prepare(`SELECT date('now') AS today_utc, datetime('now') AS now_utc`),
    db.prepare(
      `SELECT il.id AS source_id,
              il.household_id,
              il.raw_name AS item_name,
              il.quantity_milli,
              il.canonical_unit AS unit,
              COALESCE(il.expiry_at, il.estimated_expiry_at) AS expiry_date,
              'fefo-48h:' || il.id || ':' || date('now') AS dedupe_key
         FROM inventory_lots il
        WHERE il.state = 'ACTIVE'
          AND il.quantity_milli > 0
          AND COALESCE(il.expiry_at, il.estimated_expiry_at) IS NOT NULL
          AND datetime(COALESCE(il.expiry_at, il.estimated_expiry_at)) IS NOT NULL
          AND date(COALESCE(il.expiry_at, il.estimated_expiry_at)) >= date('now', '-1 day')
          AND datetime(COALESCE(il.expiry_at, il.estimated_expiry_at)) <= datetime('now', '+48 hours')
        ORDER BY COALESCE(il.expiry_at, il.estimated_expiry_at) ASC
        LIMIT 250`
    ),
    db.prepare(
      `SELECT ii.id AS source_id,
              ii.household_id,
              ii.name AS item_name,
              ii.quantity,
              ii.unit,
              ii.expiry_date,
              'fefo-48h:' || ii.id || ':' || date('now') AS dedupe_key
         FROM inventory_items ii
        WHERE ii.quantity > 0
          AND ii.expiry_date IS NOT NULL
          AND datetime(ii.expiry_date) IS NOT NULL
          AND date(ii.expiry_date) >= date('now', '-1 day')
          AND datetime(ii.expiry_date) <= datetime('now', '+48 hours')
          AND NOT EXISTS (
            SELECT 1 FROM inventory_lots il
             WHERE il.household_id = ii.household_id AND il.legacy_item_id IS NOT NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM inventory_adoption_receipts iar
             WHERE iar.household_id = ii.household_id
          )
        ORDER BY ii.expiry_date ASC
        LIMIT 250`
    ),
  ]);

  const clockRow = (clockRes?.results?.[0] ?? null) as { today_utc?: string; now_utc?: string } | null;
  const createdAt = clockRow?.now_utc
    ? `${clockRow.now_utc.replace(' ', 'T')}Z`
    : new Date().toISOString();

  type AlertCandidate = {
    householdId: string;
    itemName: string;
    quantityLabel: string;
    unit: string;
    expiryDate: string;
    dedupeKey: string;
  };

  const candidates: AlertCandidate[] = [];

  for (const lot of (lotsRes?.results ?? []) as Array<{
    source_id: string;
    household_id: string;
    item_name: string;
    quantity_milli: number;
    unit: string;
    expiry_date: string;
    dedupe_key: string;
  }>) {
    const qty = Number((Number(lot.quantity_milli) / 1000).toFixed(2));
    candidates.push({
      householdId: lot.household_id,
      itemName: lot.item_name,
      quantityLabel: String(qty),
      unit: lot.unit,
      expiryDate: lot.expiry_date,
      dedupeKey: lot.dedupe_key,
    });
  }

  for (const item of (legacyItemsRes?.results ?? []) as Array<{
    source_id: string;
    household_id: string;
    item_name: string;
    quantity: number;
    unit: string;
    expiry_date: string;
    dedupe_key: string;
  }>) {
    const qty = Number(Number(item.quantity).toFixed(2));
    candidates.push({
      householdId: item.household_id,
      itemName: item.item_name,
      quantityLabel: String(qty),
      unit: item.unit,
      expiryDate: item.expiry_date,
      dedupeKey: item.dedupe_key,
    });
  }

  if (candidates.length === 0) return 0;

  const insertStatements = await Promise.all(
    candidates.map(async (alert) => {
      const digest = await sha256Hex(`${alert.householdId}:${alert.dedupeKey}`);
      const notifId = `notif_fefo_${digest.slice(0, 24)}`;
      const title = `Ưu tiên FEFO 48h: ${alert.itemName} sắp hết hạn`;
      const message = `Còn ${alert.quantityLabel} ${alert.unit} ${alert.itemName} cần dùng trước hạn ${alert.expiryDate}. Chế biến ngay để giữ trọn vị tươi ngon!`;
      return db
        .prepare(
          `INSERT OR IGNORE INTO user_notifications
             (id, household_id, user_id, category, title, message, action_url, dedupe_key, is_read, created_at)
           VALUES (?, ?, NULL, 'expiry', ?, ?, '/fridge', ?, 0, ?)`
        )
        .bind(notifId, alert.householdId, title, message, alert.dedupeKey, createdAt);
    }),
  );

  const insertResults = await db.batch(insertStatements);
  return insertResults.reduce((count, res) => count + changesOf(res), 0);
}

export async function runScheduledCleanup(
  env: Env,
  options?: { includeKitchenOs?: boolean },
): Promise<CleanupReport> {
  const environment = env.ENVIRONMENT || 'development';
  const tasks: CleanupTaskResult[] = [];

  if (!env.DB) {
    tasks.push({
      task: 'database',
      status: 'error',
      deleted: 0,
      error: 'D1 binding DB is absent; cleanup skipped.',
    });
    return { ranAt: new Date().toISOString(), environment, tasks };
  }

  // Production fail-closed: do not mutate data while the deployment is
  // misconfigured (a fatal config means the worker may be pointed at the
  // wrong infrastructure).
  if (environment === 'production') {
    const config = validateEnvironment(env);
    if (config.fatal.length > 0) {
      tasks.push({
        task: 'config-gate',
        status: 'skipped',
        deleted: 0,
        error: `cleanup skipped: ${config.fatal.map((issue) => issue.code).join(', ')}`,
      });
      return { ranAt: new Date().toISOString(), environment, tasks };
    }
  }

  const retention = getExtendedRetentionConfig(env);
  const db = env.DB;

  try {
    const deleted = await cleanupExpiredOtps(db, retention.otpDays);
    tasks.push({ task: 'expired-otps', status: 'ok', deleted });
  } catch {
    tasks.push({ task: 'expired-otps', status: 'error', deleted: 0, error: CLEANUP_TASK_FAILURE });
  }

  try {
    const deleted = await cleanupStrictOtps(db, retention.otpDays);
    tasks.push({ task: 'strict-otp-receipts', status: 'ok', deleted });
  } catch {
    tasks.push({ task: 'strict-otp-receipts', status: 'error', deleted: 0, error: CLEANUP_TASK_FAILURE });
  }

  try {
    const deleted = await cleanupExpiredSessions(db, retention.sessionDays);
    tasks.push({ task: 'expired-sessions', status: 'ok', deleted });
  } catch {
    tasks.push({ task: 'expired-sessions', status: 'error', deleted: 0, error: CLEANUP_TASK_FAILURE });
  }

  try {
    const result = await cleanupStaleScanReservations(db, retention.reservedScanMinutes);
    tasks.push({
      task: 'stale-scan-reservations',
      status: 'ok',
      deleted: result.released,
    });
  } catch {
    tasks.push({ task: 'stale-scan-reservations', status: 'error', deleted: 0, error: CLEANUP_TASK_FAILURE });
  }

  try {
    const { readyDeleted, failedDeleted } = await cleanupTerminalScanJobs(db, retention);
    tasks.push({ task: 'terminal-ready-jobs', status: 'ok', deleted: readyDeleted });
    tasks.push({ task: 'terminal-failed-jobs', status: 'ok', deleted: failedDeleted });
  } catch {
    tasks.push({ task: 'terminal-scan-jobs', status: 'error', deleted: 0, error: CLEANUP_TASK_FAILURE });
  }

  try {
    const deleted = await cleanupExpiredScans(db, env.IMAGES, retention.scanDays);
    tasks.push({ task: 'expired-scans', status: 'ok', deleted });
  } catch {
    tasks.push({ task: 'expired-scans', status: 'error', deleted: 0, error: CLEANUP_TASK_FAILURE });
  }

  try {
    const deleted = await cleanupAbandonedGuests(db, retention.abandonedGuestDays);
    tasks.push({ task: 'abandoned-guests', status: 'ok', deleted });
  } catch {
    tasks.push({ task: 'abandoned-guests', status: 'error', deleted: 0, error: CLEANUP_TASK_FAILURE });
  }

  if (options?.includeKitchenOs) {
    try {
      const deleted = await cleanupExpiredIdempotencyKeys(db);
      tasks.push({ task: 'expired-idempotency-keys', status: 'ok', deleted });
    } catch {
      tasks.push({
        task: 'expired-idempotency-keys',
        status: 'error',
        deleted: 0,
        error: CLEANUP_TASK_FAILURE,
      });
    }

    try {
      const generated = await generateProactiveExpiryNotifications(db);
      tasks.push({ task: 'proactive-expiry-notifications', status: 'ok', deleted: generated });
    } catch {
      tasks.push({
        task: 'proactive-expiry-notifications',
        status: 'error',
        deleted: 0,
        error: CLEANUP_TASK_FAILURE,
      });
    }
  }

  return { ranAt: new Date().toISOString(), environment, tasks };
}
