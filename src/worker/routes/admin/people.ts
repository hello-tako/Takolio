import type { D1DatabaseBinding } from '@frigo/db';
import { isAdminRole, type AdminHouseholdSummary, type AdminPage, type AdminUserDetail, type AdminUserSummary } from '../../../shared/admin';
import { escapeLike } from './http';
import { maskEmail } from './mask';

const PLAN_SQL = `CASE WHEN s.plan = 'plus' AND s.status = 'active' AND (s.expires_at IS NULL OR datetime(s.expires_at) > datetime('now')) THEN 'plus' ELSE 'free' END`;
const EMAIL_SQL = `COALESCE(u.email, (SELECT aa.email FROM auth_accounts aa WHERE aa.user_id = u.id ORDER BY aa.id LIMIT 1))`;

const USER_COLUMNS = `u.id, ${EMAIL_SQL} AS email, u.is_guest, u.created_at, p.display_name, p.onboarding_completed_at,
  COALESCE((SELECT MAX(aa.is_verified) FROM auth_accounts aa WHERE aa.user_id = u.id), 0) AS is_verified,
  ${PLAN_SQL} AS plan, s.status AS sub_status, s.expires_at AS sub_expires,
  (SELECT COUNT(*) FROM household_members hm WHERE hm.user_id = u.id) AS household_count,
  (SELECT MAX(COALESCE(sv.last_seen_at, sv.created_at)) FROM sessions_v2 sv WHERE sv.user_id = u.id) AS last_seen_at`;
const USER_FROM = `FROM users u LEFT JOIN profiles p ON p.user_id = u.id LEFT JOIN subscriptions s ON s.user_id = u.id`;

interface UserRow {
  id: string; email: string | null; is_guest: number; created_at: string; display_name: string | null; onboarding_completed_at: string | null;
  is_verified: number; plan: 'free' | 'plus'; sub_status: string | null; sub_expires: string | null; household_count: number; last_seen_at: string | null;
}

function summary(row: UserRow, admins: ReadonlySet<string>): AdminUserSummary {
  return {
    id: row.id, displayName: row.display_name, emailMasked: maskEmail(row.email), isGuest: row.is_guest === 1,
    isVerified: row.is_verified === 1, plan: row.plan, subscriptionStatus: row.sub_status, subscriptionExpiresAt: row.sub_expires,
    householdCount: Number(row.household_count), createdAt: row.created_at, lastSeenAt: row.last_seen_at, isPlatformAdmin: admins.has(row.id),
  };
}

/** Active platform admins come from the admin database (bounded). */
export async function activeAdminUserIds(adminDb: D1DatabaseBinding): Promise<Set<string>> {
  const rows = await adminDb.prepare(`SELECT DISTINCT user_id FROM admin_role_assignments WHERE status = 'active' ORDER BY user_id LIMIT 1000`).all<{ user_id: string }>();
  return new Set(rows.results.map((row) => row.user_id));
}

export async function listUsers(
  main: D1DatabaseBinding,
  adminDb: D1DatabaseBinding,
  query: { q?: string; type: 'registered' | 'guest' | 'all'; plan?: 'free' | 'plus'; admin?: 'true' | 'false'; page: number; pageSize: number },
  options: { emailSearch: boolean },
): Promise<AdminPage<AdminUserSummary>> {
  const admins = await activeAdminUserIds(adminDb);
  const where: string[] = [];
  const binds: unknown[] = [];
  if (query.type === 'registered') where.push('u.is_guest = 0');
  if (query.type === 'guest') where.push('u.is_guest = 1');
  if (query.plan) { where.push(`${PLAN_SQL} = ?`); binds.push(query.plan); }
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

export async function getUser(main: D1DatabaseBinding, adminDb: D1DatabaseBinding, userId: string, reveal: boolean): Promise<AdminUserDetail | null> {
  const row = await main.prepare(`SELECT ${USER_COLUMNS} ${USER_FROM} WHERE u.id = ? LIMIT 1`).bind(userId).first<UserRow>();
  if (!row) return null;
  const [households, providers, sessions, scans, payments, roles] = await Promise.all([
    main.prepare(`SELECT h.id, h.name, hm.role, h.created_at, (SELECT COUNT(*) FROM household_members x WHERE x.household_id = h.id) AS member_count
        FROM household_members hm JOIN households h ON h.id = hm.household_id WHERE hm.user_id = ? ORDER BY h.created_at DESC, h.id DESC LIMIT 20`)
      .bind(userId).all<{ id: string; name: string; role: string; created_at: string; member_count: number }>(),
    main.prepare(`SELECT MAX(password_hash IS NOT NULL) AS password, MAX(google_id IS NOT NULL) AS google FROM auth_accounts WHERE user_id = ?`)
      .bind(userId).first<{ password: number | null; google: number | null }>(),
    main.prepare(`SELECT COUNT(*) AS value FROM sessions_v2 WHERE user_id = ? AND revoked_at IS NULL AND datetime(expires_at) > datetime('now')`)
      .bind(userId).first<{ value: number }>(),
    main.prepare(`SELECT COUNT(CASE WHEN date(created_at) >= date('now', '-29 days') THEN 1 END) AS recent, MAX(created_at) AS last FROM scans WHERE user_id = ?`)
      .bind(userId).first<{ recent: number; last: string | null }>(),
    main.prepare(`SELECT COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid,
        COUNT(CASE WHEN status = 'pending' AND datetime(expires_at) > datetime('now') THEN 1 END) AS pending,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed FROM payment_intents WHERE user_id = ?`)
      .bind(userId).first<{ paid: number; pending: number; failed: number }>(),
    adminDb.prepare(`SELECT role FROM admin_role_assignments WHERE user_id = ? AND status = 'active' ORDER BY role`).bind(userId).all<{ role: string }>(),
  ]);
  const adminRoles = roles.results.map((r) => r.role).filter(isAdminRole);
  const authProviders: Array<'password' | 'google'> = [];
  if (providers?.password) authProviders.push('password');
  if (providers?.google) authProviders.push('google');
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

/** Display names and masked emails for admin-database user ids (one bounded lookup). */
export async function userLabels(main: D1DatabaseBinding, userIds: string[]): Promise<Map<string, { displayName: string | null; emailMasked: string | null }>> {
  const unique = [...new Set(userIds)].slice(0, 500);
  if (unique.length === 0) return new Map();
  const rows = await main.prepare(`SELECT u.id, p.display_name, ${EMAIL_SQL} AS email FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(unique)).all<{ id: string; display_name: string | null; email: string | null }>();
  return new Map(rows.results.map((row) => [row.id, { displayName: row.display_name, emailMasked: maskEmail(row.email) }]));
}
