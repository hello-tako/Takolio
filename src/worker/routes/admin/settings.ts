import type { D1DatabaseBinding } from '@frigo/db';
import {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_LABELS_VI,
  ADMIN_PERMISSION_MATRIX,
  ADMIN_RBAC_MATRIX_VERSION,
  type AdminApproval,
  type AdminApprovalAction,
  type AdminAuditEvent,
  type AdminPage,
  type AdminPreferences,
  type AdminRole,
  type AdminRoleAssignment,
  type AdminSettings,
} from '../../../shared/admin';
import { userLabels } from './people';

export interface ApprovalRow {
  id: string; action: AdminApprovalAction; target_user_id: string; assignment_id: string | null; requested_by: string; requested_at: string;
  status: AdminApproval['status']; decided_by: string | null; decided_at: string | null; expires_at: string;
}

export const APPROVAL_COLUMNS = 'id, action, target_user_id, assignment_id, requested_by, requested_at, status, decided_by, decided_at, expires_at';

export function approvalView(row: ApprovalRow): AdminApproval {
  return { id: row.id, action: row.action, targetUserId: row.target_user_id, assignmentId: row.assignment_id, requestedBy: row.requested_by,
    requestedAt: row.requested_at, status: row.status === 'pending' && Date.parse(row.expires_at) <= Date.now() ? 'expired' : row.status,
    decidedBy: row.decided_by, decidedAt: row.decided_at, expiresAt: row.expires_at };
}

export async function settingsFor(main: D1DatabaseBinding, adminDb: D1DatabaseBinding, userId: string, canReadRoles: boolean): Promise<AdminSettings> {
  let assignments: AdminRoleAssignment[] = [];
  let approvals: AdminApproval[] = [];
  if (canReadRoles) {
    const [assignmentRows, approvalRows] = await Promise.all([
      adminDb.prepare(`SELECT id, user_id, role, status, grant_source, granted_by, granted_at, revoked_at FROM admin_role_assignments
          ORDER BY status, granted_at DESC, id DESC LIMIT 200`).all<{ id: string; user_id: string; role: AdminRole; status: 'active' | 'revoked';
          grant_source: AdminRoleAssignment['grantSource']; granted_by: string | null; granted_at: string; revoked_at: string | null }>(),
      adminDb.prepare(`SELECT ${APPROVAL_COLUMNS} FROM admin_action_approvals ORDER BY requested_at DESC, id DESC LIMIT 50`).all<ApprovalRow>(),
    ]);
    const labels = await userLabels(main, assignmentRows.results.map((row) => row.user_id));
    assignments = assignmentRows.results.map((row) => ({ id: row.id, userId: row.user_id, userDisplayName: labels.get(row.user_id)?.displayName ?? null,
      userEmailMasked: labels.get(row.user_id)?.emailMasked ?? null, role: row.role, status: row.status, grantSource: row.grant_source,
      grantedBy: row.granted_by, grantedAt: row.granted_at, revokedAt: row.revoked_at }));
    approvals = approvalRows.results.map(approvalView);
  }
  return {
    assignments,
    approvals,
    matrix: ADMIN_PERMISSIONS.map((permission) => ({ permission, label: ADMIN_PERMISSION_LABELS_VI[permission], roles: [...ADMIN_PERMISSION_MATRIX[permission]] })),
    preferences: await preferencesFor(adminDb, userId),
    rbacMatrixVersion: ADMIN_RBAC_MATRIX_VERSION,
  };
}

export async function preferencesFor(adminDb: D1DatabaseBinding, userId: string): Promise<AdminPreferences> {
  const row = await adminDb.prepare('SELECT locale, density, sidebar_collapsed FROM admin_user_preferences WHERE user_id = ?').bind(userId)
    .first<{ locale: 'vi' | 'en'; density: 'comfortable' | 'compact'; sidebar_collapsed: number }>();
  return { locale: row?.locale ?? 'vi', density: row?.density ?? 'comfortable', sidebarCollapsed: row?.sidebar_collapsed === 1 };
}

export async function listAudit(adminDb: D1DatabaseBinding, query: { action?: string; outcome?: string; actor?: string; from?: string; to?: string; page: number; pageSize: number }): Promise<AdminPage<AdminAuditEvent>> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (query.action) { where.push('action = ?'); binds.push(query.action); }
  if (query.outcome) { where.push('outcome = ?'); binds.push(query.outcome); }
  if (query.actor) { where.push('actor_user_id = ?'); binds.push(query.actor); }
  if (query.from) { where.push('occurred_at >= ?'); binds.push(new Date(query.from).toISOString()); }
  if (query.to) { where.push('occurred_at <= ?'); binds.push(new Date(query.to).toISOString()); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await adminDb.prepare(`SELECT COUNT(*) AS total FROM admin_audit_events ${clause}`).bind(...binds).first<{ total: number }>();
  const rows = await adminDb.prepare(`SELECT id, occurred_at, actor_user_id, actor_roles, action, target_type, target_id, outcome, reason_code, request_id, metadata_json
      FROM admin_audit_events ${clause} ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?`)
    .bind(...binds, query.pageSize, (query.page - 1) * query.pageSize)
    .all<{ id: string; occurred_at: string; actor_user_id: string | null; actor_roles: string; action: string; target_type: string | null; target_id: string | null;
      outcome: AdminAuditEvent['outcome']; reason_code: string | null; request_id: string | null; metadata_json: string | null }>();
  return {
    items: rows.results.map((row) => ({ id: row.id, occurredAt: row.occurred_at, actorUserId: row.actor_user_id, actorRoles: safeJson(row.actor_roles, []),
      action: row.action, targetType: row.target_type, targetId: row.target_id, outcome: row.outcome, reasonCode: row.reason_code, requestId: row.request_id,
      metadata: safeJson(row.metadata_json, null) })),
    page: query.page, pageSize: query.pageSize, total: Number(total?.total ?? 0),
  };
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
