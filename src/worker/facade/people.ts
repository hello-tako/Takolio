import type { D1DatabaseBinding } from '@frigo/db';
import {
  type AdminAccountStatus,
  type AdminHouseholdDetail,
  type AdminHouseholdSummary,
  type AdminPage,
  type AdminRole,
  type AdminTransaction,
  type AdminUserDetail,
  type AdminUserSummary,
} from '../../shared/admin';
import { escapeLike } from '../routes/admin/http';
import { maskEmail, maskOrderCode } from '../routes/admin/mask';

const PLAN_SQL = `CASE WHEN s.plan = 'plus' AND s.status = 'active' AND (s.expires_at IS NULL OR datetime(s.expires_at) > datetime('now')) THEN 'plus' ELSE 'free' END`;
const ACCOUNT_STATUS_SQL = `CASE WHEN s.status = 'deleted' THEN 'deleted' WHEN s.status LIKE 'suspended%' THEN 'suspended' ELSE 'active' END`;
const EMAIL_SQL = `COALESCE(u.email, (SELECT aa.email FROM auth_accounts aa WHERE aa.user_id = u.id ORDER BY aa.id LIMIT 1))`;
const EFFECTIVE_TX_STATUS_SQL = `CASE WHEN p.status = 'pending' AND datetime(p.expires_at) <= datetime('now') THEN 'expired' ELSE p.status END`;

const USER_COLUMNS = `u.id, ${EMAIL_SQL} AS email, u.is_guest, u.created_at, p.display_name, p.onboarding_completed_at,
  COALESCE((SELECT MAX(aa.is_verified) FROM auth_accounts aa WHERE aa.user_id = u.id), 0) AS is_verified,
  ${ACCOUNT_STATUS_SQL} AS account_status,
  ${PLAN_SQL} AS plan, s.status AS sub_status, s.expires_at AS sub_expires,
  (SELECT COUNT(*) FROM household_members hm WHERE hm.user_id = u.id) AS household_count,
  (SELECT MAX(COALESCE(sv.last_seen_at, sv.created_at)) FROM sessions_v2 sv WHERE sv.user_id = u.id) AS last_seen_at`;
const USER_FROM = `FROM users u LEFT JOIN profiles p ON p.user_id = u.id LEFT JOIN subscriptions s ON s.user_id = u.id`;

interface UserRow {
  id: string;
  email: string | null;
  is_guest: number;
  created_at: string;
  display_name: string | null;
  onboarding_completed_at: string | null;
  is_verified: number;
  account_status: AdminAccountStatus;
  plan: 'free' | 'plus';
  sub_status: string | null;
  sub_expires: string | null;
  household_count: number;
  last_seen_at: string | null;
}

interface UserDetailRow extends UserRow {
  sub_scan_count: number | null;
  sub_max_scans: number | null;
}

interface TransactionRow {
  id: string;
  user_id: string;
  order_code: string;
  plan: string;
  amount_vnd: number;
  status: AdminTransaction['status'];
  effective_status: AdminTransaction['status'];
  created_at: string;
  updated_at: string;
  expires_at: string;
  has_record: number;
}

function summary(row: UserRow, admins: ReadonlySet<string>): AdminUserSummary {
  return {
    id: row.id,
    displayName: row.display_name,
    emailMasked: maskEmail(row.email),
    isGuest: row.is_guest === 1,
    isVerified: row.is_verified === 1,
    accountStatus: row.account_status,
    plan: row.plan,
    subscriptionStatus: row.sub_status,
    subscriptionExpiresAt: row.sub_expires,
    householdCount: Number(row.household_count),
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    isPlatformAdmin: admins.has(row.id),
  };
}

export async function listUsers(
  main: D1DatabaseBinding,
  admins: ReadonlySet<string>,
  query: {
    q?: string;
    type: 'registered' | 'guest' | 'all';
    plan?: 'free' | 'plus';
    accountStatus?: AdminAccountStatus;
    admin?: 'true' | 'false';
    page: number;
    pageSize: number;
  },
  options: { emailSearch: boolean },
): Promise<AdminPage<AdminUserSummary>> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (query.type === 'registered') where.push('u.is_guest = 0');
  if (query.type === 'guest') where.push('u.is_guest = 1');
  if (query.plan) { where.push(`${PLAN_SQL} = ?`); binds.push(query.plan); }
  if (query.accountStatus) { where.push(`${ACCOUNT_STATUS_SQL} = ?`); binds.push(query.accountStatus); }
  if (query.admin) {
    where.push(`u.id ${query.admin === 'true' ? '' : 'NOT '}IN (SELECT value FROM json_each(?))`);
    binds.push(JSON.stringify([...admins]));
  }
  if (query.q) {
    const like = `%${escapeLike(query.q.toLowerCase())}%`;
    // Email matching is a PII lookup: only for users.pii.reveal holders (and audited by the caller).
    const email = options.emailSearch
      ? ` OR lower(u.email) LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM auth_accounts aa WHERE aa.user_id = u.id AND lower(aa.email) LIKE ? ESCAPE '\\')`
      : '';
    where.push(`(u.id = ? OR lower(p.display_name) LIKE ? ESCAPE '\\'${email})`);
    binds.push(query.q, like, ...(options.emailSearch ? [like, like] : []));
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await main.prepare(`SELECT COUNT(*) AS total ${USER_FROM} ${clause}`).bind(...binds).first<{ total: number }>();
  const rows = await main.prepare(`SELECT ${USER_COLUMNS} ${USER_FROM} ${clause} ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`)
    .bind(...binds, query.pageSize, (query.page - 1) * query.pageSize).all<UserRow>();
  return { items: rows.results.map((row) => summary(row, admins)), page: query.page, pageSize: query.pageSize, total: Number(total?.total ?? 0) };
}

export async function getUser(main: D1DatabaseBinding, userId: string, reveal: boolean): Promise<AdminUserDetail | null> {
  const row = await main.prepare(
    `SELECT ${USER_COLUMNS}, s.scan_count_current_month AS sub_scan_count, s.max_scans_per_month AS sub_max_scans
     ${USER_FROM} WHERE u.id = ? LIMIT 1`,
  ).bind(userId).first<UserDetailRow>();
  if (!row) return null;
  const [households, providers, sessions, scans, payments, quotaPeriod, recentTxRows] = await Promise.all([
    main.prepare(`SELECT h.id, h.name, hm.role, h.created_at, (SELECT COUNT(*) FROM household_members x WHERE x.household_id = h.id) AS member_count
        FROM household_members hm JOIN households h ON h.id = hm.household_id WHERE hm.user_id = ? ORDER BY h.created_at DESC, h.id DESC LIMIT 20`)
      .bind(userId).all<{ id: string; name: string; role: string; created_at: string; member_count: number }>(),
    main.prepare(`SELECT MAX(has_password) AS password, MAX(has_google) AS google FROM auth_accounts WHERE user_id = ?`)
      .bind(userId).first<{ password: number | null; google: number | null }>(),
    main.prepare(`SELECT COUNT(*) AS value FROM sessions_v2 WHERE user_id = ? AND revoked_at IS NULL AND datetime(expires_at) > datetime('now')`)
      .bind(userId).first<{ value: number }>(),
    main.prepare(`SELECT COUNT(CASE WHEN date(created_at) >= date('now', '-29 days') THEN 1 END) AS recent, MAX(created_at) AS last FROM scans WHERE user_id = ?`)
      .bind(userId).first<{ recent: number; last: string | null }>(),
    main.prepare(`SELECT COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid,
        COUNT(CASE WHEN status = 'pending' AND datetime(expires_at) > datetime('now') THEN 1 END) AS pending,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed FROM payment_intents WHERE user_id = ?`)
      .bind(userId).first<{ paid: number; pending: number; failed: number }>(),
    main.prepare(`SELECT period_start, used_count, max_scans,
        CASE WHEN period_start = strftime('%Y-%m-01', 'now') THEN 1 ELSE 0 END AS is_current_month
        FROM scan_quota_periods WHERE user_id = ?
        ORDER BY CASE WHEN period_start = strftime('%Y-%m-01', 'now') THEN 0 ELSE 1 END, period_start DESC
        LIMIT 1`)
      .bind(userId).first<{ period_start: string; used_count: number; max_scans: number; is_current_month: number }>(),
    main.prepare(`SELECT p.id, p.user_id, p.order_code, p.plan, p.amount_vnd, p.status,
        ${EFFECTIVE_TX_STATUS_SQL} AS effective_status,
        p.created_at, p.updated_at, p.expires_at,
        EXISTS (SELECT 1 FROM payment_reconciliation_records r WHERE r.intent_id = p.id) AS has_record
        FROM payment_intents p WHERE p.user_id = ?
        ORDER BY p.created_at DESC, p.id DESC LIMIT 20`)
      .bind(userId).all<TransactionRow>(),
  ]);
  const adminRoles: AdminRole[] = [];
  const authProviders: Array<'password' | 'google'> = [];
  if (providers?.password) authProviders.push('password');
  if (providers?.google) authProviders.push('google');

  const fallbackMax = row.plan === 'plus' ? 500 : 5;
  const isCurrentPeriod = quotaPeriod?.is_current_month === 1;
  const usedThisMonth = Math.max(
    0,
    Math.trunc(Number(isCurrentPeriod ? quotaPeriod?.used_count : (row.sub_scan_count ?? quotaPeriod?.used_count ?? 0))),
  );
  const rawMax = isCurrentPeriod
    ? (quotaPeriod?.max_scans ?? row.sub_max_scans ?? fallbackMax)
    : (row.sub_max_scans ?? quotaPeriod?.max_scans ?? fallbackMax);
  const parsedMax = Math.max(0, Math.trunc(Number(rawMax)));
  const maxPerMonth = row.plan === 'plus' && parsedMax < 500 ? 500 : parsedMax;

  return {
    ...summary(row, new Set(adminRoles.length ? [row.id] : [])),
    email: reveal ? row.email : null,
    emailRevealed: reveal && row.email !== null,
    onboardingCompletedAt: row.onboarding_completed_at,
    authProviders,
    households: households.results.map((h) => ({ id: h.id, name: h.name, role: h.role, memberCount: Number(h.member_count), createdAt: h.created_at })),
    activity: {
      activeSessions: Number(sessions?.value ?? 0),
      scans30d: Number(scans?.recent ?? 0),
      lastScanAt: scans?.last ?? null,
      payments: { paid: Number(payments?.paid ?? 0), pending: Number(payments?.pending ?? 0), failed: Number(payments?.failed ?? 0) },
    },
    scanQuota: { usedThisMonth, maxPerMonth },
    recentTransactions: recentTxRows.results.map((tx): AdminTransaction => ({
      id: tx.id,
      userId: tx.user_id,
      orderCodeMasked: maskOrderCode(tx.order_code),
      plan: tx.plan,
      amountVnd: Number(tx.amount_vnd),
      status: tx.status,
      effectiveStatus: tx.effective_status,
      hasReconciliationRecord: tx.has_record === 1,
      createdAt: tx.created_at,
      updatedAt: tx.updated_at,
      expiresAt: tx.expires_at,
    })),
    adminRoles,
  };
}

export async function listHouseholds(main: D1DatabaseBinding, query: { q?: string; page: number; pageSize: number }): Promise<AdminPage<AdminHouseholdSummary>> {
  const binds: unknown[] = [];
  let clause = '';
  if (query.q) {
    clause = `WHERE (h.id = ? OR lower(h.name) LIKE ? ESCAPE '\\')`;
    binds.push(query.q, `%${escapeLike(query.q.toLowerCase())}%`);
  }
  const total = await main.prepare(`SELECT COUNT(*) AS total FROM households h ${clause}`).bind(...binds).first<{ total: number }>();
  const rows = await main.prepare(`SELECT h.id, h.name, h.created_by, h.created_at, p.display_name,
      (SELECT COUNT(*) FROM household_members hm WHERE hm.household_id = h.id) AS member_count,
      (SELECT COUNT(*) FROM inventory_items i WHERE i.household_id = h.id) AS inventory_count
    FROM households h LEFT JOIN profiles p ON p.user_id = h.created_by ${clause}
    ORDER BY h.created_at DESC, h.id DESC LIMIT ? OFFSET ?`)
    .bind(...binds, query.pageSize, (query.page - 1) * query.pageSize)
    .all<{ id: string; name: string; created_by: string; created_at: string; display_name: string | null; member_count: number; inventory_count: number }>();
  return {
    items: rows.results.map((row) => ({ id: row.id, name: row.name, ownerUserId: row.created_by, ownerDisplayName: row.display_name,
      memberCount: Number(row.member_count), inventoryItemCount: Number(row.inventory_count), createdAt: row.created_at })),
    page: query.page, pageSize: query.pageSize, total: Number(total?.total ?? 0),
  };
}

export async function getHouseholdDetail(main: D1DatabaseBinding, householdId: string): Promise<AdminHouseholdDetail | null> {
  const household = await main.prepare(
    `SELECT h.id, h.name, h.created_by, h.created_at, h.inventory_version, p.display_name AS owner_display_name
     FROM households h
     LEFT JOIN profiles p ON p.user_id = h.created_by
     WHERE h.id = ? LIMIT 1`,
  ).bind(householdId).first<{
    id: string;
    name: string;
    created_by: string;
    created_at: string;
    inventory_version: number;
    owner_display_name: string | null;
  }>();
  if (!household) return null;

  const [members, lots, items, mealPlans, generatedMealPlans, cookedMeals, shoppingLists] = await Promise.all([
    main.prepare(
      `SELECT hm.id, hm.user_id, hm.role, hm.created_at, p.display_name, ${EMAIL_SQL} AS email
       FROM household_members hm
       JOIN users u ON u.id = hm.user_id
       LEFT JOIN profiles p ON p.user_id = hm.user_id
       WHERE hm.household_id = ?
       ORDER BY CASE WHEN hm.role = 'owner' THEN 0 ELSE 1 END, hm.created_at ASC, hm.id ASC
       LIMIT 50`,
    ).bind(householdId).all<{
      id: string;
      user_id: string;
      role: string;
      created_at: string;
      display_name: string | null;
      email: string | null;
    }>(),
    main.prepare(
      `SELECT COUNT(*) AS total_lots,
         COUNT(CASE WHEN state = 'ACTIVE' THEN 1 END) AS active_lots,
         COUNT(CASE WHEN state = 'ACTIVE' AND COALESCE(expiry_at, estimated_expiry_at) IS NOT NULL
           AND date(COALESCE(expiry_at, estimated_expiry_at)) <= date('now', '+3 days') THEN 1 END) AS expiring_lots
       FROM inventory_lots WHERE household_id = ?`,
    ).bind(householdId).first<{ total_lots: number; active_lots: number; expiring_lots: number }>(),
    main.prepare(
      `SELECT COUNT(*) AS item_count,
         COUNT(CASE WHEN freshness IN ('expiring', 'use_soon') THEN 1 END) AS expiring_items
       FROM inventory_items WHERE household_id = ?`,
    ).bind(householdId).first<{ item_count: number; expiring_items: number }>(),
    main.prepare(`SELECT COUNT(*) AS value FROM meal_plans WHERE household_id = ?`)
      .bind(householdId).first<{ value: number }>(),
    main.prepare(`SELECT COUNT(*) AS value FROM generated_meal_plans WHERE household_id = ?`)
      .bind(householdId).first<{ value: number }>(),
    main.prepare(`SELECT COUNT(*) AS value FROM cooked_meals WHERE household_id = ?`)
      .bind(householdId).first<{ value: number }>(),
    main.prepare(`SELECT COUNT(*) AS value FROM shopping_lists WHERE household_id = ?`)
      .bind(householdId).first<{ value: number }>(),
  ]);

  const isNative = Number(lots?.total_lots ?? 0) > 0;
  return {
    id: household.id,
    name: household.name,
    ownerUserId: household.created_by,
    ownerDisplayName: household.owner_display_name,
    createdAt: household.created_at,
    inventoryMode: isNative ? 'native' : 'legacy',
    inventoryVersion: Math.max(0, Math.trunc(Number(household.inventory_version ?? 1))),
    itemCount: Number(items?.item_count ?? 0),
    lotCount: Number(lots?.active_lots ?? 0),
    expiringCount: isNative ? Number(lots?.expiring_lots ?? 0) : Number(items?.expiring_items ?? 0),
    mealPlanCount: Number(mealPlans?.value ?? 0) + Number(generatedMealPlans?.value ?? 0),
    cookedMealCount: Number(cookedMeals?.value ?? 0),
    shoppingListCount: Number(shoppingLists?.value ?? 0),
    members: members.results.map((m) => ({
      id: m.id,
      userId: m.user_id,
      displayName: m.display_name,
      emailMasked: maskEmail(m.email),
      role: m.role,
      createdAt: m.created_at,
    })),
  };
}

/** Display names and masked emails for admin-database user ids (one bounded lookup). */
export async function userLabels(main: D1DatabaseBinding, userIds: string[]): Promise<Map<string, { displayName: string | null; emailMasked: string | null }>> {
  const unique = [...new Set(userIds)].slice(0, 500);
  if (unique.length === 0) return new Map();
  const rows = await main.prepare(`SELECT u.id, p.display_name, ${EMAIL_SQL} AS email FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(unique)).all<{ id: string; display_name: string | null; email: string | null }>();
  return new Map(rows.results.map((row) => [row.id, { displayName: row.display_name, emailMasked: maskEmail(row.email) }]));
}
