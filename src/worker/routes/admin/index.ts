import { Hono } from 'hono';
import type { z } from 'zod';
import type { D1PreparedStatement } from '@frigo/db';
import { ADMIN_SUPER_ADMIN_MINIMUM, hasAdminPermission } from '../../../shared/admin';
import { auditStatement, guardedAuditStatement, requireAudit, writeAudit } from './audit';
import {
  adminApiGate,
  adminAuthRoutes,
  meFromPrincipal,
  requestBudget,
  requireAdminSession,
  requireCsrf,
  requirePermission,
  revokeUserSessionsStatement,
} from './auth';
import { aiSummary, billingSummary, listAiUsage, listTransactions } from './billing-ai';
import { AdminHttpError, errorResponse, isConstraintError, newId, nowIso, ok, plusMinutes, type AdminApp, type AdminContext } from './http';
import { consumeLimit, limitResponse } from './limits';
import { buildOverview } from './overview';
import { getUser, listHouseholds, listUsers } from './people';
import { ReadOnlyViolation } from './readonly-db';
import { getRecipe, listRecipes, recipesSummary } from './recipes';
import {
  AiUsageQuery, AuditQuery, EmptyQuery, GrantRoleBody, HouseholdsQuery, IdParam, PreferencesBody, RangeQuery, RecipeReviewBody,
  RecipesQuery, TransactionsQuery, UserDetailQuery, UsersQuery,
} from './schemas';
import { APPROVAL_COLUMNS, approvalView, listAudit, preferencesFor, settingsFor, type ApprovalRow } from './settings';
import { systemChecks, systemStatus } from './system';

export const adminRoutes = new Hono<AdminApp>();

adminRoutes.onError((error, c) => {
  if (error instanceof AdminHttpError) return errorResponse(c, error.status, error.code, error.message);
  const code = error instanceof ReadOnlyViolation ? 'ADMIN_READONLY_VIOLATION' : 'ADMIN_INTERNAL_ERROR';
  console.error(JSON.stringify({ level: 'error', requestId: c.get('requestId'), code }));
  return c.json({ error: 'Đã xảy ra lỗi máy chủ nội bộ', code: 'INTERNAL_SERVER_ERROR' }, 500);
});

adminRoutes.use('*', adminApiGate);
adminRoutes.route('/', adminAuthRoutes);

const authed = new Hono<AdminApp>();
authed.use('*', requireAdminSession);
authed.use('*', requestBudget);
authed.use('*', requireCsrf);

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new AdminHttpError(400, 'ADMIN_VALIDATION_FAILED', 'Tham số yêu cầu không hợp lệ.');
  return result.data;
}
const query = <T extends z.ZodTypeAny>(c: AdminContext, schema: T) => parse(schema, c.req.query());
const param = (c: AdminContext, name: string) => parse(IdParam, c.req.param(name));
async function body<T extends z.ZodTypeAny>(c: AdminContext, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try { raw = await c.req.json(); } catch { raw = undefined; }
  return parse(schema, raw);
}
const notFound = () => new AdminHttpError(404, 'ADMIN_NOT_FOUND', 'Không tìm thấy.');
const conflict = (message?: string) => new AdminHttpError(409, 'ADMIN_CONFLICT', message ?? 'Dữ liệu đã thay đổi. Vui lòng tải lại.');
const MINIMUM_MESSAGE = `Phải luôn còn ít nhất ${ADMIN_SUPER_ADMIN_MINIMUM} quản trị viên cấp cao đang hoạt động.`;

/** Batch that maps constraint/trigger aborts to 409 instead of 500. */
async function commit(c: AdminContext, statements: D1PreparedStatement[], message?: string) {
  try {
    const adminDb = c.get('adminDb');
    if (/\/(?:roles|approvals)(?:\/|$)/.test(c.req.path)) {
      const actor = c.get('admin');
      const now = nowIso();
      // A constraint failure aborts the whole batch if authority changed after middleware.
      statements.unshift(adminDb.prepare(`INSERT INTO admin_config_metadata (key,value)
        SELECT 'authority_check', 'denied' WHERE NOT EXISTS (
          SELECT 1 FROM admin_role_assignments r JOIN admin_sessions s ON s.user_id = r.user_id
          WHERE r.user_id = ? AND r.role = 'SUPER_ADMIN' AND r.status = 'active'
            AND s.id = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND s.idle_expires_at > ?
            AND (? IS NULL OR EXISTS (SELECT 1 FROM operator_identity_bindings b
              JOIN approved_human_operators h ON h.operator_id = b.operator_id AND h.status = 'active'
              WHERE b.user_id = r.user_id AND b.access_iss = ? AND b.access_sub = ? AND b.status = 'active'))
        )`).bind(actor.userId, actor.sessionId, now, now, actor.accessIss ?? null, actor.accessIss ?? null, actor.accessSub ?? null));
    }
    await adminDb.batch(statements);
  } catch (error) {
    if (isConstraintError(error)) throw conflict(/SUPER_ADMIN/.test(String(error)) ? MINIMUM_MESSAGE : message);
    throw error;
  }
}

async function remainingSuperCount(c: AdminContext, assignmentId: string): Promise<number> {
  const row = await c.get('adminDb').prepare(`SELECT COUNT(DISTINCT operator_id) AS n FROM admin_active_super_operators WHERE access_iss = ? AND assignment_id <> ?`).bind(c.get('admin').accessIss ?? '', assignmentId).first<{ n: number }>();
  return Number(row?.n ?? 0);
}

async function eligibleUser(c: AdminContext, userId: string): Promise<boolean> {
  return !!await c.get('adminDb').prepare(`SELECT b.user_id FROM operator_identity_bindings b
    JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active'
    WHERE b.user_id=? AND b.status='active' AND b.access_iss=? LIMIT 1`).bind(userId, c.get('admin').accessIss ?? '').first();
}

// ── Reads ──────────────────────────────────────────────────────────────────
authed.get('/me', requirePermission('admin.self.read'), (c) => { query(c, EmptyQuery); return ok(c, meFromPrincipal(c.get('admin'))); });
authed.get('/overview', requirePermission('overview.read'), async (c) => {
  const range = query(c, RangeQuery).range;
  const checks = await systemChecks(c.env, c.get('main'), c.get('adminDb'), c.get('policy'));
  return ok(c, await buildOverview(c.get('main'), c.get('adminDb'), range, checks));
});
authed.get('/users', requirePermission('users.read'), async (c) => {
  const input = query(c, UsersQuery);
  const admin = c.get('admin');
  const emailSearch = Boolean(input.q) && hasAdminPermission(admin.roles, 'users.pii.reveal');
  // Email lookup is a PII query: audited before any result is returned.
  if (emailSearch) await requireAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'users.search', outcome: 'success', metadata: { field: 'email' } });
  return ok(c, await listUsers(c.get('main'), c.get('adminDb'), input, { emailSearch }));
});
authed.get('/users/:id', requirePermission('users.read'), async (c) => {
  const id = param(c, 'id');
  const reveal = query(c, UserDetailQuery).reveal === 'email';
  const admin = c.get('admin');
  if (reveal && !hasAdminPermission(admin.roles, 'users.pii.reveal')) {
    await writeAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.permission.denied', targetType: 'user', targetId: id,
      outcome: 'denied', reasonCode: 'missing_permission', metadata: { permission: 'users.pii.reveal', path: c.req.routePath } });
    return errorResponse(c, 403, 'ADMIN_FORBIDDEN');
  }
  if (reveal) {
    const budget = await consumeLimit(c.env, c.get('policy').local, 'reveal', admin.userId, 30, 3600);
    if (!budget.ok) return limitResponse(c, budget);
  }
  // The record is written before the response; if it cannot be written, nothing is disclosed.
  await requireAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: reveal ? 'users.pii.reveal' : 'users.view', targetType: 'user',
    targetId: id, outcome: 'success', metadata: reveal ? { field: 'email' } : undefined });
  const user = await getUser(c.get('main'), c.get('adminDb'), id, reveal);
  if (!user) throw notFound();
  return ok(c, user);
});
authed.get('/households', requirePermission('households.read'), async (c) => ok(c, await listHouseholds(c.get('main'), query(c, HouseholdsQuery))));
authed.get('/billing/summary', requirePermission('billing.read'), async (c) => ok(c, await billingSummary(c.get('main'), query(c, RangeQuery).range)));
authed.get('/billing/transactions', requirePermission('billing.read'), async (c) => ok(c, await listTransactions(c.get('main'), query(c, TransactionsQuery))));
authed.get('/ai/summary', requirePermission('ai.read'), async (c) => ok(c, await aiSummary(c.get('main'), query(c, RangeQuery).range)));
authed.get('/ai/usage', requirePermission('ai.read'), async (c) => ok(c, await listAiUsage(c.get('main'), query(c, AiUsageQuery))));
authed.get('/recipes/summary', requirePermission('recipes.read'), async (c) => {
  query(c, EmptyQuery);
  return ok(c, await recipesSummary(c.get('main'), c.get('adminDb'), c.env.RECIPE_CATALOG_MODE));
});
authed.get('/recipes', requirePermission('recipes.read'), async (c) => ok(c, await listRecipes(c.get('main'), c.get('adminDb'), query(c, RecipesQuery))));
authed.get('/recipes/:id', requirePermission('recipes.read'), async (c) => {
  const recipe = await getRecipe(c.get('main'), c.get('adminDb'), param(c, 'id'));
  if (!recipe) throw notFound();
  return ok(c, recipe);
});
authed.get('/system/status', requirePermission('system.read'), async (c) => {
  query(c, EmptyQuery);
  return ok(c, await systemStatus(c.env, c.get('main'), c.get('adminDb'), c.get('policy'), c.get('fixtureDataset')));
});
authed.get('/audit', requirePermission('audit.read'), async (c) => ok(c, await listAudit(c.get('adminDb'), query(c, AuditQuery))));
authed.get('/settings', requirePermission('admin.self.read'), async (c) => {
  const admin = c.get('admin');
  return ok(c, await settingsFor(c.get('adminDb'), admin.userId, hasAdminPermission(admin.roles, 'admin.roles.read')));
});
authed.get('/sessions', requirePermission('admin.sessions.revoke'), async (c) => {
  const now = nowIso();
  const rows = await c.get('adminDb').prepare(`SELECT id, user_id, auth_method, created_at, last_seen_at, expires_at FROM admin_sessions
      WHERE revoked_at IS NULL AND expires_at > ? AND idle_expires_at > ? ORDER BY created_at DESC, id DESC LIMIT 100`).bind(now, now)
    .all<{ id: string; user_id: string; auth_method: string; created_at: string; last_seen_at: string | null; expires_at: string }>();
  return ok(c, rows.results.map((row) => ({ id: row.id, userId: row.user_id, authMethod: row.auth_method, createdAt: row.created_at, lastSeenAt: row.last_seen_at, expiresAt: row.expires_at })));
});

// ── Mutations (session + budget + CSRF applied above) ──────────────────────
authed.put('/preferences', requirePermission('admin.preferences.write'), async (c) => {
  const admin = c.get('admin');
  const adminDb = c.get('adminDb');
  const next = { ...(await preferencesFor(adminDb, admin.userId)), ...(await body(c, PreferencesBody)) };
  await commit(c, [
    adminDb.prepare(`INSERT INTO admin_user_preferences (user_id, locale, density, sidebar_collapsed, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET locale = excluded.locale, density = excluded.density, sidebar_collapsed = excluded.sidebar_collapsed, updated_at = excluded.updated_at`)
      .bind(admin.userId, next.locale, next.density, next.sidebarCollapsed ? 1 : 0, nowIso()),
    await auditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.preferences.update', targetType: 'admin_user', targetId: admin.userId, outcome: 'success' }),
  ]);
  return ok(c, next);
});

authed.post('/recipes/:id/reviews', requirePermission('recipes.review'), async (c) => {
  const admin = c.get('admin');
  const recipeId = param(c, 'id');
  const input = await body(c, RecipeReviewBody);
  // Recipe authority stays in the customer database and is only read here.
  const recipe = await c.get('main').recipeVersion(recipeId);
  if (recipe === null) throw notFound();
  if (recipe !== input.recipeVersion) throw conflict('Công thức đã thay đổi, vui lòng tải lại.');
  const id = newId('rev');
  const createdAt = nowIso();
  const adminDb = c.get('adminDb');
  await commit(c, [
    adminDb.prepare(`INSERT INTO admin_recipe_editorial_reviews (id, recipe_id, recipe_version, state, note, author_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, recipeId, input.recipeVersion, input.state, input.note, admin.userId, createdAt),
    await auditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'recipes.review.create', targetType: 'recipe', targetId: recipeId,
      outcome: 'success', metadata: { state: input.state, recipeVersion: input.recipeVersion } }),
  ]);
  return ok(c, { id, recipeId, state: input.state, note: input.note, authorUserId: admin.userId, recipeVersion: input.recipeVersion, createdAt }, 201);
});

authed.post('/roles', requirePermission('admin.roles.manage'), async (c) => {
  const admin = c.get('admin');
  const adminDb = c.get('adminDb');
  const input = await body(c, GrantRoleBody);
  if (input.userId === admin.userId) {
    await writeAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.role.grant', targetType: 'user', targetId: input.userId,
      outcome: 'denied', reasonCode: 'self_grant', metadata: { role: input.role } });
    return errorResponse(c, 403, 'ADMIN_FORBIDDEN', 'Không thể tự cấp quyền cho chính mình.');
  }
  if (!(await eligibleUser(c, input.userId))) throw notFound();
  const already = await adminDb.prepare(`SELECT 1 AS present FROM admin_role_assignments WHERE user_id = ? AND role = ? AND status = 'active'`)
    .bind(input.userId, input.role).first();
  if (already) throw conflict('Người dùng đã có vai trò này.');
  const now = nowIso();

  if (input.role === 'SUPER_ADMIN') {
    const id = newId('appr');
    const expiresAt = plusMinutes(72 * 60);
    await commit(c, [
      adminDb.prepare(`INSERT INTO admin_action_approvals (id, action, target_user_id, requested_by, requested_at, expires_at, requester_access_iss, requester_access_sub)
          VALUES (?, 'role.grant.super_admin', ?, ?, ?, ?, ?, ?)`).bind(id, input.userId, admin.userId, now, expiresAt, admin.accessIss ?? null, admin.accessSub ?? null),
      await auditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.approval.request', targetType: 'user', targetId: input.userId,
        outcome: 'success', metadata: { role: 'SUPER_ADMIN', approvalId: id, decision: 'grant' } }),
    ], 'Đã có yêu cầu phê duyệt đang chờ cho người dùng này.');
    return ok(c, { approval: approvalView({ id, action: 'role.grant.super_admin', target_user_id: input.userId, assignment_id: null, requested_by: admin.userId,
      requested_at: now, status: 'pending', decided_by: null, decided_at: null, expires_at: expiresAt }) }, 201);
  }

  const id = newId('ara');
  await commit(c, [
    adminDb.prepare(`INSERT INTO admin_role_assignments (id, user_id, role, grant_source, granted_by, granted_at) VALUES (?, ?, ?, 'admin_grant', ?, ?)`)
      .bind(id, input.userId, input.role, admin.userId, now),
    // Privilege changes end the target's sessions so the next session reflects them.
    revokeUserSessionsStatement(adminDb, input.userId, 'role_changed', now),
    await auditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.role.grant', targetType: 'user', targetId: input.userId,
      outcome: 'success', metadata: { role: input.role, assignmentId: id } }),
  ], 'Người dùng đã có vai trò này.');
  return ok(c, { assignment: { id, userId: input.userId, role: input.role, status: 'active' as const } }, 201);
});

authed.delete('/roles/:assignmentId', requirePermission('admin.roles.manage'), async (c) => {
  const admin = c.get('admin');
  const adminDb = c.get('adminDb');
  const id = param(c, 'assignmentId');
  const row = await adminDb.prepare(`SELECT id, user_id, role FROM admin_role_assignments WHERE id = ? AND status = 'active'`).bind(id)
    .first<{ id: string; user_id: string; role: string }>();
  if (!row) throw notFound();
  if (row.user_id === admin.userId) {
    await writeAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.role.revoke', targetType: 'user', targetId: row.user_id,
      outcome: 'denied', reasonCode: 'self_revoke', metadata: { role: row.role, assignmentId: id } });
    return errorResponse(c, 403, 'ADMIN_FORBIDDEN', 'Không thể tự thu hồi vai trò của chính mình.');
  }
  const now = nowIso();

  if (row.role === 'SUPER_ADMIN') {
    // Symmetric four-eyes: revoking a SUPER_ADMIN is a request a second SUPER_ADMIN must approve.
    if ((await remainingSuperCount(c, id)) < ADMIN_SUPER_ADMIN_MINIMUM) {
      await writeAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.role.revoke', targetType: 'user', targetId: row.user_id,
        outcome: 'denied', reasonCode: 'super_admin_minimum', metadata: { role: row.role, assignmentId: id } });
      throw conflict(MINIMUM_MESSAGE);
    }
    const approvalId = newId('appr');
    const expiresAt = plusMinutes(72 * 60);
    await commit(c, [
      adminDb.prepare(`INSERT INTO admin_action_approvals (id, action, target_user_id, assignment_id, requested_by, requested_at, expires_at, requester_access_iss, requester_access_sub)
          VALUES (?, 'role.revoke.super_admin', ?, ?, ?, ?, ?, ?, ?)`).bind(approvalId, row.user_id, id, admin.userId, now, expiresAt, admin.accessIss ?? null, admin.accessSub ?? null),
      await auditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.approval.request', targetType: 'user', targetId: row.user_id,
        outcome: 'success', metadata: { role: 'SUPER_ADMIN', approvalId, assignmentId: id, decision: 'revoke' } }),
    ], 'Đã có yêu cầu thu hồi đang chờ cho người dùng này.');
    return ok(c, { approval: approvalView({ id: approvalId, action: 'role.revoke.super_admin', target_user_id: row.user_id, assignment_id: id,
      requested_by: admin.userId, requested_at: now, status: 'pending', decided_by: null, decided_at: null, expires_at: expiresAt }) }, 201);
  }

  await commit(c, [
    adminDb.prepare(`UPDATE admin_role_assignments SET status = 'revoked', revoked_at = ?, revoked_by = ?, revoke_reason = 'admin_revoke'
        WHERE id = ? AND status = 'active' AND role <> 'SUPER_ADMIN'`).bind(now, admin.userId, id),
    adminDb.prepare(`UPDATE admin_sessions SET revoked_at = ?, revoked_reason = 'role_changed' WHERE user_id = ? AND revoked_at IS NULL
        AND EXISTS (SELECT 1 FROM admin_role_assignments WHERE id = ? AND status = 'revoked' AND revoked_at = ?)`).bind(now, row.user_id, id, now),
    await guardedAuditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.role.revoke', targetType: 'user', targetId: row.user_id,
      outcome: 'success', metadata: { role: row.role, assignmentId: id } },
    `EXISTS (SELECT 1 FROM admin_role_assignments WHERE id = ? AND status = 'revoked' AND revoked_at = ?)`, [id, now]),
  ]);
  const after = await adminDb.prepare(`SELECT status FROM admin_role_assignments WHERE id = ?`).bind(id).first<{ status: string }>();
  if (after?.status !== 'revoked') throw conflict();
  return ok(c, { assignment: { id, status: 'revoked' as const } });
});

for (const decision of ['approve', 'reject'] as const) {
  authed.post(`/approvals/:id/${decision}`, requirePermission('admin.approvals.decide'), async (c) => {
    const admin = c.get('admin');
    const adminDb = c.get('adminDb');
    const id = param(c, 'id');
    const approval = await adminDb.prepare(`SELECT ${APPROVAL_COLUMNS} FROM admin_action_approvals WHERE id = ?`).bind(id).first<ApprovalRow>();
    if (!approval) throw notFound();
    if (approval.requested_by === admin.userId || approval.target_user_id === admin.userId) {
      await writeAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: `admin.approval.${decision}`, targetType: 'approval', targetId: id,
        outcome: 'denied', reasonCode: 'four_eyes', metadata: { approvalId: id } });
      return errorResponse(c, 403, 'ADMIN_FORBIDDEN', 'Người yêu cầu hoặc người bị tác động không thể tự phê duyệt.');
    }
    if (approval.status !== 'pending') throw conflict('Yêu cầu không còn ở trạng thái chờ.');
    const now = nowIso();
    if (Date.parse(approval.expires_at) <= Date.now()) {
      await adminDb.prepare(`UPDATE admin_action_approvals SET status = 'expired', decided_at = ? WHERE id = ? AND status = 'pending'`).bind(now, id).run();
      throw conflict('Yêu cầu đã hết hạn.');
    }
    const requesterActive = await adminDb.prepare(`SELECT 1 AS present FROM admin_role_assignments WHERE user_id = ? AND role = 'SUPER_ADMIN' AND status = 'active'`)
      .bind(approval.requested_by).first();
    if (!requesterActive && decision === 'approve') {
      await commit(c, [
        adminDb.prepare(`UPDATE admin_action_approvals SET status = 'cancelled', decided_at = ? WHERE id = ? AND status = 'pending'`).bind(now, id),
        await auditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.approval.cancel', targetType: 'approval', targetId: id,
          outcome: 'success', reasonCode: 'requester_not_authorized', metadata: { approvalId: id, requestedBy: approval.requested_by } }),
      ]);
      throw conflict('Người yêu cầu không còn là quản trị viên cấp cao; yêu cầu đã bị huỷ.');
    }
    if (decision === 'approve' && approval.action === 'role.grant.super_admin' && !(await eligibleUser(c, approval.target_user_id))) {
      throw conflict('Người được cấp không còn đủ điều kiện.');
    }

    const decided = `EXISTS (SELECT 1 FROM admin_action_approvals WHERE id = ? AND status = ? AND decided_by = ? AND decided_at = ?)`;
    const decidedBinds = [id, decision === 'approve' ? 'approved' : 'rejected', admin.userId, now];
    const statements = [
      // Guards re-validate inside the batch: still pending, unexpired, requester still SUPER_ADMIN, effect still applicable.
      adminDb.prepare(`UPDATE admin_action_approvals SET status = ?, decided_by = ?, decided_at = ?, decider_access_iss = ?, decider_access_sub = ?
          WHERE id = ? AND status = 'pending' AND expires_at > ?
            AND (? = 'rejected' OR (
              EXISTS (SELECT 1 FROM admin_role_assignments r WHERE r.user_id = admin_action_approvals.requested_by AND r.role = 'SUPER_ADMIN' AND r.status = 'active')
              AND (action <> 'role.grant.super_admin' OR (
                NOT EXISTS (SELECT 1 FROM admin_role_assignments r WHERE r.user_id = admin_action_approvals.target_user_id AND r.role = 'SUPER_ADMIN' AND r.status = 'active')
                AND EXISTS (SELECT 1 FROM operator_identity_bindings b
                  JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active'
                  WHERE b.user_id=admin_action_approvals.target_user_id AND b.status='active' AND b.access_iss=?)))
              AND (action <> 'role.revoke.super_admin' OR (
                EXISTS (SELECT 1 FROM admin_role_assignments r WHERE r.id = admin_action_approvals.assignment_id AND r.status = 'active')
                AND (SELECT COUNT(DISTINCT operator_id) FROM admin_active_super_operators WHERE access_iss=? AND assignment_id<>admin_action_approvals.assignment_id) >= ?))))`)
        .bind(decidedBinds[1], admin.userId, now, admin.accessIss ?? null, admin.accessSub ?? null, id, now, decidedBinds[1], admin.accessIss ?? '', admin.accessIss ?? '', ADMIN_SUPER_ADMIN_MINIMUM),
    ];
    if (decision === 'approve' && approval.action === 'role.grant.super_admin') {
      statements.push(
        adminDb.prepare(`INSERT INTO admin_role_assignments (id, user_id, role, grant_source, granted_by, granted_at)
            SELECT ?, target_user_id, 'SUPER_ADMIN', 'approval', ?, ? FROM admin_action_approvals
            WHERE id = ? AND status = ? AND decided_by = ? AND decided_at = ?`)
          .bind(newId('ara'), admin.userId, now, ...decidedBinds),
      );
    }
    if (decision === 'approve' && approval.action === 'role.revoke.super_admin') {
      statements.push(
        adminDb.prepare(`UPDATE admin_role_assignments SET status = 'revoked', revoked_at = ?, revoked_by = ?, revoke_reason = 'four_eyes_approval'
            WHERE id = ? AND status = 'active' AND ${decided}`).bind(now, admin.userId, approval.assignment_id, ...decidedBinds),
      );
    }
    if (decision === 'approve') {
      statements.push(adminDb.prepare(`UPDATE admin_sessions SET revoked_at = ?, revoked_reason = 'role_changed' WHERE user_id = ? AND revoked_at IS NULL AND ${decided}`)
        .bind(now, approval.target_user_id, ...decidedBinds));
    }
    statements.push(await guardedAuditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: `admin.approval.${decision}`, targetType: 'user',
      targetId: approval.target_user_id, outcome: 'success',
      metadata: { approvalId: id, role: 'SUPER_ADMIN', decision: approval.action === 'role.grant.super_admin' ? 'grant' : 'revoke', requestedBy: approval.requested_by } },
    decided, decidedBinds));
    await commit(c, statements);
    const after = await adminDb.prepare(`SELECT ${APPROVAL_COLUMNS} FROM admin_action_approvals WHERE id = ?`).bind(id).first<ApprovalRow>();
    // Only report success for the decision this request actually made.
    if (!after || after.decided_by !== admin.userId || after.decided_at !== now) throw conflict('Yêu cầu không còn hợp lệ (đã được xử lý hoặc vi phạm điều kiện tối thiểu).');
    return ok(c, { approval: approvalView(after) });
  });
}

authed.post('/sessions/:id/revoke', requirePermission('admin.sessions.revoke'), async (c) => {
  const admin = c.get('admin');
  const adminDb = c.get('adminDb');
  const id = param(c, 'id');
  const now = nowIso();
  await commit(c, [
    adminDb.prepare(`UPDATE admin_sessions SET revoked_at = ?, revoked_reason = 'admin_revoked' WHERE id = ? AND revoked_at IS NULL`).bind(now, id),
    await guardedAuditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.session.revoke', targetType: 'admin_session', targetId: id,
      outcome: 'success', metadata: { sessionId: id } },
    `EXISTS (SELECT 1 FROM admin_sessions WHERE id = ? AND revoked_at = ? AND revoked_reason = 'admin_revoked')`, [id, now]),
  ]);
  const after = await adminDb.prepare(`SELECT 1 AS present FROM admin_sessions WHERE id = ? AND revoked_at = ?`).bind(id, now).first();
  if (!after) throw notFound();
  return ok(c, { session: { id, revoked: true } });
});

adminRoutes.route('/', authed);
// Never fall through; there is intentionally no bootstrap or provisioning endpoint.
adminRoutes.all('*', (c) => errorResponse(c, 404, 'ADMIN_NOT_FOUND'));
