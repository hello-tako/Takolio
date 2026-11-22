import type { D1DatabaseBinding, D1PreparedStatement, D1Result } from '@frigo/db';
import type {
  AdminAccountStatus,
  AdminCancelSubscriptionResult,
  AdminDeleteUserResult,
  AdminNotificationType,
  AdminNotifyUserResult,
  AdminPurgeGuestHouseholdsResult,
  AdminResetQuotaResult,
  AdminRevokeUserSessionsResult,
  AdminSuspendUserResult,
  AdminUnsuspendUserResult,
  AdminUpdateHouseholdResult,
  AdminUpgradeSubscriptionResult,
  AdminVerifyEmailResult,
} from '../../shared/admin';
import { mutationInputs, type MutationInput } from './contract';

export type PeopleMutationOperation =
  | 'users.subscription.upgrade'
  | 'users.subscription.cancel'
  | 'users.suspend'
  | 'users.unsuspend'
  | 'users.delete'
  | 'users.sessions.revoke'
  | 'users.verify_email'
  | 'users.quota.reset'
  | 'users.notify'
  | 'households.update'
  | 'households.purge_guests';

interface UserSubState {
  id: string;
  email: string | null;
  is_guest: number;
  plan: string | null;
  sub_status: string | null;
  expires_at: string | null;
  max_scans_per_month: number | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function currentMonthPeriodStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function parseUtcMs(value: string | null | undefined): number {
  if (!value) return NaN;
  const trimmed = value.trim();
  const normalized = trimmed.includes('T')
    ? trimmed
    : trimmed.replace(' ', 'T');
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`;
  return Date.parse(withZone);
}

function deriveAccountStatus(subStatus: string | null | undefined): AdminAccountStatus {
  if (subStatus === 'deleted') return 'deleted';
  if (subStatus && subStatus.startsWith('suspended')) return 'suspended';
  return 'active';
}

function metaChanges(result: D1Result | undefined): number {
  return Number(result?.meta?.changes ?? 0);
}

function parseInput<O extends PeopleMutationOperation>(operation: O, rawInput: unknown): MutationInput<O> {
  const parsed = mutationInputs[operation].safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(`FACADE_VALIDATION:${parsed.error.issues[0]?.message ?? 'Dữ liệu yêu cầu không hợp lệ.'}`);
  }
  return parsed.data as MutationInput<O>;
}

async function loadUserState(db: D1DatabaseBinding, userId: string): Promise<UserSubState> {
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.is_guest, s.plan, s.status AS sub_status, s.expires_at, s.max_scans_per_month
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE u.id = ? LIMIT 1`,
    )
    .bind(userId)
    .first<UserSubState>();
  if (!row) throw new Error('FACADE_NOT_FOUND:Không tìm thấy người dùng.');
  return row;
}

async function upgradeSubscription(
  db: D1DatabaseBinding,
  input: MutationInput<'users.subscription.upgrade'>,
): Promise<AdminUpgradeSubscriptionResult> {
  const user = await loadUserState(db, input.userId);
  const status = deriveAccountStatus(user.sub_status);
  if (status === 'deleted') {
    throw new Error('FACADE_CONFLICT:Không thể nâng cấp gói cho tài khoản đã xoá.');
  }
  if (status === 'suspended') {
    throw new Error('FACADE_CONFLICT:Tài khoản đang bị tạm khoá; vui lòng mở khoá trước khi cấp gói Takolio Pro.');
  }

  let days: number;
  if (input.duration === 'monthly') {
    days = 31;
  } else if (input.duration === 'annual') {
    days = 366;
  } else {
    if (input.customDays === undefined || !Number.isInteger(input.customDays) || input.customDays < 1 || input.customDays > 3650) {
      throw new Error('FACADE_VALIDATION:Số ngày tuỳ chỉnh phải nằm trong khoảng 1 đến 3650.');
    }
    days = input.customDays;
  }

  const nowMs = Date.now();
  const existingExpMs = parseUtcMs(user.expires_at);
  const isUnexpiredActivePlus =
    user.plan === 'plus' &&
    Boolean(user.sub_status && user.sub_status.includes('active')) &&
    Number.isFinite(existingExpMs) &&
    existingExpMs > nowMs;
  const baseMs = isUnexpiredActivePlus ? existingExpMs : nowMs;
  const expiresAt = new Date(baseMs + days * 86_400_000).toISOString();
  const periodStart = currentMonthPeriodStart(new Date(nowMs));
  const now = new Date(nowMs).toISOString();

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO subscriptions (id, user_id, plan, status, scan_count_current_month, max_scans_per_month, expires_at, updated_at)
         VALUES (?, ?, 'plus', 'active', 0, 500, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           plan = 'plus',
           status = 'active',
           max_scans_per_month = 500,
           expires_at = excluded.expires_at,
           updated_at = excluded.updated_at`,
      )
      .bind(`sub_${crypto.randomUUID()}`, user.id, expiresAt, now),
    db
      .prepare(
        `UPDATE scan_quota_periods
         SET max_scans = 500, updated_at = ?
         WHERE user_id = ? AND period_start = ?`,
      )
      .bind(now, user.id, periodStart),
  ];

  const notified = Boolean(input.notifyUser);
  if (notified) {
    statements.push(
      db
        .prepare(
          `INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
           VALUES (?, ?, ?, ?, 'billing', 0, ?)`,
        )
        .bind(
          `notif_${crypto.randomUUID()}`,
          user.id,
          'Tài khoản đã được kích hoạt Takolio Pro',
          `Gói Takolio Pro của bạn đã được gia hạn thêm ${days} ngày (hiệu lực đến ${expiresAt.slice(0, 10)}).`,
          now,
        ),
    );
  }

  await db.batch(statements);
  return {
    userId: user.id,
    plan: 'plus',
    status: 'active',
    expiresAt,
    notified,
  };
}

async function cancelSubscription(
  db: D1DatabaseBinding,
  input: MutationInput<'users.subscription.cancel'>,
): Promise<AdminCancelSubscriptionResult> {
  const user = await loadUserState(db, input.userId);
  const status = deriveAccountStatus(user.sub_status);
  if (status === 'deleted') {
    throw new Error('FACADE_CONFLICT:Không thể huỷ gói cho tài khoản đã xoá.');
  }
  if (status === 'suspended') {
    throw new Error('FACADE_CONFLICT:Tài khoản đang bị tạm khoá; vui lòng mở khoá trước khi thay đổi gói.');
  }

  const now = nowIso();
  const periodStart = currentMonthPeriodStart();

  if (input.immediate) {
    await db.batch([
      db
        .prepare(
          `INSERT INTO subscriptions (id, user_id, plan, status, scan_count_current_month, max_scans_per_month, expires_at, updated_at)
           VALUES (?, ?, 'free', 'cancelled', 0, 5, NULL, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             plan = 'free',
             status = 'cancelled',
             expires_at = NULL,
             max_scans_per_month = 5,
             updated_at = excluded.updated_at`,
        )
        .bind(`sub_${crypto.randomUUID()}`, user.id, now),
      db
        .prepare(
          `UPDATE scan_quota_periods
           SET max_scans = 5, updated_at = ?
           WHERE user_id = ? AND period_start = ?`,
        )
        .bind(now, user.id, periodStart),
    ]);
    return {
      userId: user.id,
      plan: 'free',
      status: 'cancelled',
      expiresAt: null,
      immediate: true,
    };
  }

  const currentPlan: 'free' | 'plus' = user.plan === 'plus' ? 'plus' : 'free';
  const currentExpiresAt = user.expires_at ?? null;
  const fallbackMax = currentPlan === 'plus' ? 500 : 5;

  await db
    .prepare(
      `INSERT INTO subscriptions (id, user_id, plan, status, scan_count_current_month, max_scans_per_month, expires_at, updated_at)
       VALUES (?, ?, ?, 'cancelled', 0, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         status = 'cancelled',
         updated_at = excluded.updated_at`,
    )
    .bind(`sub_${crypto.randomUUID()}`, user.id, currentPlan, user.max_scans_per_month ?? fallbackMax, currentExpiresAt, now)
    .run();

  return {
    userId: user.id,
    plan: currentPlan,
    status: 'cancelled',
    expiresAt: currentExpiresAt,
    immediate: false,
  };
}

async function suspendUser(
  db: D1DatabaseBinding,
  input: MutationInput<'users.suspend'>,
): Promise<AdminSuspendUserResult> {
  const user = await loadUserState(db, input.userId);
  if (deriveAccountStatus(user.sub_status) === 'deleted') {
    throw new Error('FACADE_CONFLICT:Không thể tạm khoá tài khoản đã xoá.');
  }

  const now = nowIso();
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO subscriptions (id, user_id, plan, status, scan_count_current_month, max_scans_per_month, updated_at)
         VALUES (?, ?, 'free', 'suspended:active', 0, 5, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           status = CASE
             WHEN subscriptions.status LIKE 'suspended:%' THEN subscriptions.status
             WHEN subscriptions.status = 'suspended' THEN 'suspended:active'
             ELSE 'suspended:' || COALESCE(subscriptions.status, 'active')
           END,
           updated_at = excluded.updated_at`,
      )
      .bind(`sub_${crypto.randomUUID()}`, user.id, now),
    db
      .prepare(`UPDATE sessions_v2 SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`)
      .bind(user.id),
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(user.id),
  ]);

  const revokedSessions = metaChanges(results[1]) + metaChanges(results[2]);
  return {
    userId: user.id,
    accountStatus: 'suspended',
    revokedSessions,
    updatedAt: now,
  };
}

async function unsuspendUser(
  db: D1DatabaseBinding,
  input: MutationInput<'users.unsuspend'>,
): Promise<AdminUnsuspendUserResult> {
  const user = await loadUserState(db, input.userId);
  if (deriveAccountStatus(user.sub_status) === 'deleted') {
    throw new Error('FACADE_CONFLICT:Không thể mở khoá tài khoản đã xoá.');
  }

  const now = nowIso();
  await db
    .prepare(
      `UPDATE subscriptions
       SET status = CASE
             WHEN status LIKE 'suspended:%' THEN COALESCE(NULLIF(substr(status, 11), ''), 'active')
             WHEN status = 'suspended' THEN 'active'
             ELSE status
           END,
           updated_at = ?
       WHERE user_id = ?`,
    )
    .bind(now, user.id)
    .run();

  return {
    userId: user.id,
    accountStatus: 'active',
    updatedAt: now,
  };
}

async function hasImmutableHistoryInHouseholds(
  db: D1DatabaseBinding,
  userId: string,
  householdIds: readonly string[],
): Promise<boolean> {
  if (householdIds.length === 0) return false;
  const hidsJson = JSON.stringify(householdIds);
  const row = await db
    .prepare(
      `SELECT 1 AS present WHERE
         EXISTS (SELECT 1 FROM inventory_commands WHERE actor_id = ? AND household_id IN (SELECT value FROM json_each(?)))
         OR EXISTS (SELECT 1 FROM inventory_adoption_receipts WHERE actor_id = ? AND household_id IN (SELECT value FROM json_each(?)))
         OR EXISTS (SELECT 1 FROM inventory_reconciliation_decisions WHERE actor_id = ? AND household_id IN (SELECT value FROM json_each(?)))
         OR EXISTS (SELECT 1 FROM week_swap_receipts WHERE actor_id = ? AND household_id IN (SELECT value FROM json_each(?)))`,
    )
    .bind(userId, hidsJson, userId, hidsJson, userId, hidsJson, userId, hidsJson)
    .first<{ present: number }>();
  return Boolean(row?.present);
}

async function deleteUser(
  db: D1DatabaseBinding,
  input: MutationInput<'users.delete'>,
): Promise<AdminDeleteUserResult> {
  const user = await loadUserState(db, input.userId);
  if (input.mode === 'anonymize' && deriveAccountStatus(user.sub_status) === 'deleted') {
    throw new Error('FACADE_CONFLICT:Tài khoản này đã được ẩn danh trước đó.');
  }

  const [authAccountsRes, householdsRes] = await Promise.all([
    db.prepare(`SELECT email FROM auth_accounts WHERE user_id = ?`).bind(user.id).all<{ email: string }>(),
    db
      .prepare(
        `SELECT h.id, h.created_by
         FROM households h
         WHERE h.created_by = ?
            OR EXISTS (SELECT 1 FROM household_members hm WHERE hm.household_id = h.id AND hm.user_id = ?)`,
      )
      .bind(user.id, user.id)
      .all<{ id: string; created_by: string }>(),
  ]);

  const emails = [
    ...new Set(
      [user.email, ...authAccountsRes.results.map((r) => r.email)]
        .filter((e): e is string => Boolean(e))
        .map((e) => e.trim().toLowerCase()),
    ),
  ];

  const soloHouseholdIds: string[] = [];
  const survivingHouseholdIds: string[] = [];
  const ownerTransfers: Array<{ householdId: string; newOwnerUserId: string }> = [];

  for (const household of householdsRes.results) {
    const replacement = await db
      .prepare(
        `SELECT user_id
         FROM household_members
         WHERE household_id = ? AND user_id <> ?
         ORDER BY CASE WHEN role = 'owner' THEN 0 ELSE 1 END, created_at ASC, id ASC
         LIMIT 1`,
      )
      .bind(household.id, user.id)
      .first<{ user_id: string }>();

    if (!replacement) {
      soloHouseholdIds.push(household.id);
    } else {
      survivingHouseholdIds.push(household.id);
      if (household.created_by === user.id) {
        ownerTransfers.push({ householdId: household.id, newOwnerUserId: replacement.user_id });
      }
    }
  }

  if (input.mode === 'purge' && (await hasImmutableHistoryInHouseholds(db, user.id, survivingHouseholdIds))) {
    throw new Error(
      'FACADE_CONFLICT:Người dùng còn lịch sử bất biến trong hộ gia đình chung; vui lòng sử dụng chế độ ẩn danh (anonymize).',
    );
  }

  const now = nowIso();
  const statements: D1PreparedStatement[] = [
    // Indices 0 and 1 capture exact revoked session count atomically before deletion.
    db
      .prepare(`UPDATE sessions_v2 SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`)
      .bind(user.id),
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(user.id),
  ];

  for (const transfer of ownerTransfers) {
    statements.push(
      db
        .prepare(`UPDATE households SET created_by = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(transfer.newOwnerUserId, transfer.householdId),
      db
        .prepare(`UPDATE household_members SET role = 'owner' WHERE household_id = ? AND user_id = ?`)
        .bind(transfer.householdId, transfer.newOwnerUserId),
    );
  }

  statements.push(db.prepare(`UPDATE ai_requests SET user_id = NULL WHERE user_id = ?`).bind(user.id));

  // FK & trigger-safe household teardown: delete non-cascading children first,
  // then delete households so immutable inventory/week receipts cascade cleanly.
  for (const householdId of soloHouseholdIds) {
    statements.push(
      db
        .prepare(`DELETE FROM shopping_plan_sources WHERE list_id IN (SELECT id FROM shopping_lists WHERE household_id = ?)`)
        .bind(householdId),
      db.prepare(`DELETE FROM cooked_meals WHERE household_id = ?`).bind(householdId),
      db.prepare(`DELETE FROM scans WHERE household_id = ?`).bind(householdId),
      db.prepare(`DELETE FROM households WHERE id = ?`).bind(householdId),
    );
  }

  statements.push(
    db.prepare(`DELETE FROM shopping_plan_sources WHERE creator_user_id = ?`).bind(user.id),
    db.prepare(`DELETE FROM cooked_meals WHERE user_id = ?`).bind(user.id),
    db.prepare(`DELETE FROM scans WHERE user_id = ?`).bind(user.id),
  );

  for (const email of emails) {
    statements.push(db.prepare(`DELETE FROM auth_otps WHERE lower(trim(email)) = ?`).bind(email));
  }

  statements.push(
    db.prepare(`DELETE FROM household_members WHERE user_id = ?`).bind(user.id),
    db.prepare(`DELETE FROM auth_accounts WHERE user_id = ?`).bind(user.id),
    db.prepare(`DELETE FROM sessions_v2 WHERE user_id = ?`).bind(user.id),
    db.prepare(`DELETE FROM favorites WHERE user_id = ?`).bind(user.id),
    db.prepare(`DELETE FROM saved_recipe_entries WHERE user_id = ?`).bind(user.id),
    db.prepare(`DELETE FROM notifications WHERE user_id = ?`).bind(user.id),
    db.prepare(`DELETE FROM user_preferences WHERE user_id = ?`).bind(user.id),
    db.prepare(`DELETE FROM scan_quota_periods WHERE user_id = ?`).bind(user.id),
    db.prepare(`DELETE FROM scan_quota_ledger WHERE user_id = ?`).bind(user.id),
  );

  if (input.mode === 'anonymize') {
    statements.push(
      db
        .prepare(`UPDATE users SET email = NULL, is_guest = 1, updated_at = datetime('now') WHERE id = ?`)
        .bind(user.id),
      db
        .prepare(`UPDATE profiles SET display_name = '[Tài khoản đã xoá]', avatar_url = NULL, updated_at = datetime('now') WHERE user_id = ?`)
        .bind(user.id),
      db
        .prepare(
          `INSERT INTO subscriptions (id, user_id, plan, status, scan_count_current_month, max_scans_per_month, expires_at, updated_at)
           VALUES (?, ?, 'free', 'deleted', 0, 5, NULL, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             plan = 'free',
             status = 'deleted',
             scan_count_current_month = 0,
             max_scans_per_month = 5,
             expires_at = NULL,
             updated_at = excluded.updated_at`,
        )
        .bind(`sub_${crypto.randomUUID()}`, user.id, now),
    );
  } else {
    statements.push(
      db.prepare(`DELETE FROM payment_intents WHERE user_id = ?`).bind(user.id),
      db.prepare(`DELETE FROM users WHERE id = ?`).bind(user.id),
    );
  }

  const results = await db.batch(statements);
  const revokedSessions = metaChanges(results[0]) + metaChanges(results[1]);

  return {
    userId: user.id,
    mode: input.mode,
    accountStatus: 'deleted',
    revokedSessions,
    deletedAt: now,
  };
}

async function revokeUserSessions(
  db: D1DatabaseBinding,
  input: MutationInput<'users.sessions.revoke'>,
): Promise<AdminRevokeUserSessionsResult> {
  const user = await loadUserState(db, input.userId);
  const now = nowIso();
  const results = await db.batch([
    db
      .prepare(`UPDATE sessions_v2 SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`)
      .bind(user.id),
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(user.id),
  ]);
  const revokedSessions = metaChanges(results[0]) + metaChanges(results[1]);
  return {
    userId: user.id,
    revokedSessions,
    revokedAt: now,
  };
}

async function verifyUserEmail(
  db: D1DatabaseBinding,
  input: MutationInput<'users.verify_email'>,
): Promise<AdminVerifyEmailResult> {
  const user = await loadUserState(db, input.userId);
  if (deriveAccountStatus(user.sub_status) === 'deleted') {
    throw new Error('FACADE_CONFLICT:Không thể xác minh email cho tài khoản đã xoá.');
  }

  const accountsRes = await db
    .prepare(`SELECT id, email FROM auth_accounts WHERE user_id = ?`)
    .bind(user.id)
    .all<{ id: string; email: string }>();

  if (accountsRes.results.length === 0 && user.is_guest === 1) {
    throw new Error('FACADE_CONFLICT:Tài khoản khách chưa liên kết email đăng ký để xác minh.');
  }

  const emails = [
    ...new Set(
      [user.email, ...accountsRes.results.map((r) => r.email)]
        .filter((e): e is string => Boolean(e))
        .map((e) => e.trim().toLowerCase()),
    ),
  ];

  const now = nowIso();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(`UPDATE auth_accounts SET is_verified = 1, updated_at = datetime('now') WHERE user_id = ?`)
      .bind(user.id),
  ];

  for (const email of emails) {
    statements.push(
      db
        .prepare(`UPDATE auth_otps SET locked_until = NULL, attempt_count = 0 WHERE lower(trim(email)) = ?`)
        .bind(email),
    );
  }

  statements.push(
    db
      .prepare(
        `UPDATE auth_otp_scopes
         SET locked_until = 0, cooldown_until = 0
         WHERE scope_hash IN (SELECT DISTINCT scope_hash FROM auth_otp_issuances WHERE user_id = ?)
            OR account_hash IN (
              SELECT DISTINCT s2.account_hash
              FROM auth_otp_scopes s2
              JOIN auth_otp_issuances i ON i.scope_hash = s2.scope_hash
              WHERE i.user_id = ?
            )`,
      )
      .bind(user.id, user.id),
  );

  const results = await db.batch(statements);
  const accountsUpdated = metaChanges(results[0]);

  return {
    userId: user.id,
    isVerified: accountsRes.results.length > 0,
    accountsUpdated,
    verifiedAt: now,
  };
}

async function resetUserQuota(
  db: D1DatabaseBinding,
  input: MutationInput<'users.quota.reset'>,
): Promise<AdminResetQuotaResult> {
  const user = await loadUserState(db, input.userId);
  if (deriveAccountStatus(user.sub_status) === 'deleted') {
    throw new Error('FACADE_CONFLICT:Không thể đặt lại lượt quét cho tài khoản đã xoá.');
  }

  const now = nowIso();
  const periodStart = currentMonthPeriodStart();
  const existingPeriod = await db
    .prepare(
      `SELECT max_scans
       FROM scan_quota_periods
       WHERE user_id = ?
       ORDER BY CASE WHEN period_start = ? THEN 0 ELSE 1 END, period_start DESC
       LIMIT 1`,
    )
    .bind(user.id, periodStart)
    .first<{ max_scans: number }>();

  const expMs = parseUtcMs(user.expires_at);
  const isActivePlus =
    user.plan === 'plus' &&
    user.sub_status === 'active' &&
    (!user.expires_at || (Number.isFinite(expMs) && expMs > Date.now()));
  const fallbackMax = isActivePlus ? 500 : 5;
  const rawMax = Math.max(0, Math.trunc(Number(existingPeriod?.max_scans ?? user.max_scans_per_month ?? fallbackMax)));
  const maxPerMonth = isActivePlus && rawMax < 500 ? 500 : rawMax;

  await db.batch([
    db
      .prepare(`UPDATE subscriptions SET scan_count_current_month = 0, updated_at = datetime('now') WHERE user_id = ?`)
      .bind(user.id),
    db
      .prepare(`UPDATE scan_quota_periods SET used_count = 0, updated_at = datetime('now') WHERE user_id = ?`)
      .bind(user.id),
    db
      .prepare(
        `UPDATE scan_quota_ledger
         SET status = 'released', completed_at = COALESCE(completed_at, datetime('now'))
         WHERE user_id = ? AND period_start = ? AND status != 'released'`,
      )
      .bind(user.id, periodStart),
  ]);

  return {
    userId: user.id,
    usedThisMonth: 0,
    maxPerMonth,
    resetAt: now,
  };
}

async function notifyUser(
  db: D1DatabaseBinding,
  input: MutationInput<'users.notify'>,
): Promise<AdminNotifyUserResult> {
  const user = await loadUserState(db, input.userId);
  if (deriveAccountStatus(user.sub_status) === 'deleted') {
    throw new Error('FACADE_CONFLICT:Không thể gửi thông báo tới tài khoản đã xoá.');
  }

  const notificationId = `notif_${crypto.randomUUID()}`;
  const type: AdminNotificationType = input.type ?? 'system';
  const createdAt = nowIso();

  await db
    .prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
    )
    .bind(notificationId, user.id, input.title, input.message, type, createdAt)
    .run();

  return {
    notificationId,
    userId: user.id,
    type,
    createdAt,
  };
}

async function updateHousehold(
  db: D1DatabaseBinding,
  input: MutationInput<'households.update'>,
): Promise<AdminUpdateHouseholdResult> {
  const household = await db
    .prepare(`SELECT id, name, created_by FROM households WHERE id = ? LIMIT 1`)
    .bind(input.householdId)
    .first<{ id: string; name: string; created_by: string }>();
  if (!household) {
    throw new Error('FACADE_NOT_FOUND:Không tìm thấy hộ gia đình.');
  }

  const membersRes = await db
    .prepare(`SELECT id, user_id, role FROM household_members WHERE household_id = ?`)
    .bind(household.id)
    .all<{ id: string; user_id: string; role: string }>();
  const members = membersRes.results;

  let effectiveOwnerId = household.created_by;

  if (input.newOwnerUserId !== undefined) {
    if (!members.some((m) => m.user_id === input.newOwnerUserId)) {
      throw new Error('FACADE_CONFLICT:Chủ sở hữu mới phải là thành viên hiện tại của hộ gia đình.');
    }
    if (input.removeUserId !== undefined && input.removeUserId === input.newOwnerUserId) {
      throw new Error('FACADE_CONFLICT:Không thể đồng thời chuyển quyền sở hữu và xoá cùng một thành viên.');
    }
    effectiveOwnerId = input.newOwnerUserId;
  }

  if (input.removeUserId !== undefined) {
    if (!members.some((m) => m.user_id === input.removeUserId)) {
      throw new Error('FACADE_NOT_FOUND:Thành viên cần xoá không thuộc hộ gia đình này.');
    }
    if (input.removeUserId === effectiveOwnerId) {
      throw new Error('FACADE_CONFLICT:Không thể xoá chủ sở hữu hộ gia đình; vui lòng chuyển quyền sở hữu trước.');
    }
  }

  const nextName = input.name !== undefined ? input.name : household.name;
  const now = nowIso();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(`UPDATE households SET name = ?, created_by = ?, updated_at = ? WHERE id = ?`)
      .bind(nextName, effectiveOwnerId, now, household.id),
  ];

  if (input.newOwnerUserId !== undefined && input.newOwnerUserId !== household.created_by) {
    statements.push(
      db
        .prepare(`UPDATE household_members SET role = 'member' WHERE household_id = ? AND user_id <> ? AND role = 'owner'`)
        .bind(household.id, input.newOwnerUserId),
      db
        .prepare(`UPDATE household_members SET role = 'owner' WHERE household_id = ? AND user_id = ?`)
        .bind(household.id, input.newOwnerUserId),
    );
  }

  if (input.removeUserId !== undefined) {
    statements.push(
      db
        .prepare(`DELETE FROM household_members WHERE household_id = ? AND user_id = ?`)
        .bind(household.id, input.removeUserId),
      db
        .prepare(`UPDATE sessions_v2 SET revoked_at = datetime('now') WHERE user_id = ? AND household_id = ? AND revoked_at IS NULL`)
        .bind(input.removeUserId, household.id),
    );
  }

  await db.batch(statements);

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS count FROM household_members WHERE household_id = ?`)
    .bind(household.id)
    .first<{ count: number }>();

  return {
    id: household.id,
    name: nextName,
    ownerUserId: effectiveOwnerId,
    removedUserId: input.removeUserId ?? null,
    memberCount: Number(countRow?.count ?? 0),
    updatedAt: now,
  };
}

async function purgeGuestHouseholds(
  db: D1DatabaseBinding,
  input: MutationInput<'households.purge_guests'>,
): Promise<AdminPurgeGuestHouseholdsResult> {
  const cutoffModifier = `-${input.olderThanDays} days`;
  const candidatesRes = await db
    .prepare(
      `SELECT u.id
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE u.is_guest = 1
         AND COALESCE(s.status, 'active') <> 'deleted'
         AND datetime(u.created_at) < datetime('now', ?)
         AND NOT EXISTS (
           SELECT 1 FROM sessions_v2 sv
           WHERE sv.user_id = u.id
             AND datetime(COALESCE(sv.last_seen_at, sv.created_at)) >= datetime('now', ?)
         )
         AND NOT EXISTS (
           SELECT 1 FROM payment_intents pi
           WHERE pi.user_id = u.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM households h
           WHERE (h.created_by = u.id OR EXISTS (SELECT 1 FROM household_members hm WHERE hm.household_id = h.id AND hm.user_id = u.id))
             AND EXISTS (SELECT 1 FROM household_members hm2 WHERE hm2.household_id = h.id AND hm2.user_id <> u.id)
         )
       ORDER BY u.created_at ASC, u.id ASC
       LIMIT 50`,
    )
    .bind(cutoffModifier, cutoffModifier)
    .all<{ id: string }>();

  let deletedHouseholds = 0;
  let deletedGuestUsers = 0;

  for (const guest of candidatesRes.results) {
    const hRows = await db
      .prepare(
        `SELECT h.id
         FROM households h
         WHERE h.created_by = ?
            OR EXISTS (SELECT 1 FROM household_members hm WHERE hm.household_id = h.id AND hm.user_id = ?)`,
      )
      .bind(guest.id, guest.id)
      .all<{ id: string }>();

    const statements: D1PreparedStatement[] = [
      db.prepare(`UPDATE ai_requests SET user_id = NULL WHERE user_id = ?`).bind(guest.id),
    ];
    const householdDeleteIndices: number[] = [];

    for (const h of hRows.results) {
      statements.push(
        db
          .prepare(`DELETE FROM shopping_plan_sources WHERE list_id IN (SELECT id FROM shopping_lists WHERE household_id = ?)`)
          .bind(h.id),
        db.prepare(`DELETE FROM cooked_meals WHERE household_id = ?`).bind(h.id),
        db.prepare(`DELETE FROM scans WHERE household_id = ?`).bind(h.id),
      );
      householdDeleteIndices.push(statements.length);
      statements.push(db.prepare(`DELETE FROM households WHERE id = ?`).bind(h.id));
    }

    statements.push(
      db.prepare(`DELETE FROM shopping_plan_sources WHERE creator_user_id = ?`).bind(guest.id),
      db.prepare(`DELETE FROM cooked_meals WHERE user_id = ?`).bind(guest.id),
      db.prepare(`DELETE FROM scans WHERE user_id = ?`).bind(guest.id),
    );
    const userDeleteIndex = statements.length;
    statements.push(db.prepare(`DELETE FROM users WHERE id = ?`).bind(guest.id));

    const results = await db.batch(statements);
    for (const idx of householdDeleteIndices) {
      deletedHouseholds += metaChanges(results[idx]);
    }
    deletedGuestUsers += metaChanges(results[userDeleteIndex]);
  }

  return {
    olderThanDays: input.olderThanDays,
    deletedHouseholds,
    deletedGuestUsers,
    purgedAt: nowIso(),
  };
}

export async function executePeopleMutation(
  db: D1DatabaseBinding,
  operation: PeopleMutationOperation,
  rawInput: unknown,
): Promise<unknown> {
  switch (operation) {
    case 'users.subscription.upgrade':
      return upgradeSubscription(db, parseInput(operation, rawInput));
    case 'users.subscription.cancel':
      return cancelSubscription(db, parseInput(operation, rawInput));
    case 'users.suspend':
      return suspendUser(db, parseInput(operation, rawInput));
    case 'users.unsuspend':
      return unsuspendUser(db, parseInput(operation, rawInput));
    case 'users.delete':
      return deleteUser(db, parseInput(operation, rawInput));
    case 'users.sessions.revoke':
      return revokeUserSessions(db, parseInput(operation, rawInput));
    case 'users.verify_email':
      return verifyUserEmail(db, parseInput(operation, rawInput));
    case 'users.quota.reset':
      return resetUserQuota(db, parseInput(operation, rawInput));
    case 'users.notify':
      return notifyUser(db, parseInput(operation, rawInput));
    case 'households.update':
      return updateHousehold(db, parseInput(operation, rawInput));
    case 'households.purge_guests':
      return purgeGuestHouseholds(db, parseInput(operation, rawInput));
  }
}
