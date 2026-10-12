import { Hono } from 'hono';
import type { z } from 'zod';
import { hasAdminPermission } from '../../../shared/admin';
import { auditStatement, guardedAuditStatement, writeAudit } from './audit';
import {
  adminAuthRoutes,
  adminGate,
  meFromPrincipal,
  readLimiter,
  requireAdminSession,
  requireCsrf,
  requirePermission,
  writeLimiter,
} from './auth';
import { aiSummary, billingSummary, listAiUsage, listTransactions } from './billing-ai';
import { AdminHttpError, errorResponse, newId, nowIso, ok, plusMinutes, type AdminApp, type AdminContext } from './http';
import { buildOverview } from './overview';
import { getUser, listHouseholds, listUsers } from './people';
import { getRecipe, listRecipes, recipesSummary } from './recipes';
import {
  AiUsageQuery, AuditQuery, EmptyQuery, GrantRoleBody, HouseholdsQuery, IdParam, PreferencesBody, RangeQuery, RecipeReviewBody,
  RecipesQuery, TransactionsQuery, UserDetailQuery, UsersQuery,
} from './schemas';
import { listAudit, preferencesFor, settingsFor } from './settings';
import { systemStatus } from './system';

export const adminRoutes = new Hono<AdminApp>();

adminRoutes.onError((error, c) => {
  if (error instanceof AdminHttpError) return errorResponse(c, error.status, error.code, error.message);
  console.error(JSON.stringify({ level: 'error', requestId: c.get('requestId'), code: 'ADMIN_INTERNAL_ERROR' }));
  c.header('Cache-Control', 'no-store');
  return c.json({ error: 'Đã xảy ra lỗi máy chủ nội bộ', code: 'INTERNAL_SERVER_ERROR' }, 500);
});

adminRoutes.use('*', adminGate);
adminRoutes.route('/', adminAuthRoutes);

const authed = new Hono<AdminApp>();
authed.use('*', requireAdminSession);
authed.use('*', async (c, next) => (['GET', 'HEAD'].includes(c.req.method) ? readLimiter : writeLimiter)(c as never, next));
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

// ── Reads ──────────────────────────────────────────────────────────────────
authed.get('/me', requirePermission('admin.self.read'), async (c) => { query(c, EmptyQuery); return ok(c, meFromPrincipal(c.get('admin'))); });
authed.get('/overview', requirePermission('overview.read'), async (c) => ok(c, await buildOverview(c.env, query(c, RangeQuery).range)));
authed.get('/users', requirePermission('users.read'), async (c) => ok(c, await listUsers(c.env, query(c, UsersQuery))));
authed.get('/users/:id', requirePermission('users.read'), async (c) => {
  const id = param(c, 'id');
  const reveal = query(c, UserDetailQuery).reveal === 'email';
  const admin = c.get('admin');
  if (reveal && !hasAdminPermission(admin.roles, 'users.pii.reveal')) {
    await writeAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.permission.denied', targetType: 'user', targetId: id,
      outcome: 'denied', reasonCode: 'missing_permission', metadata: { permission: 'users.pii.reveal', path: c.req.routePath } });
    return errorResponse(c, 403, 'ADMIN_FORBIDDEN');
  }
  const user = await getUser(c.env, id, reveal);
  if (!user) throw notFound();
  if (reveal) {
    await writeAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'users.pii.reveal', targetType: 'user', targetId: id,
      outcome: 'success', metadata: { field: 'email' } });
  }
  return ok(c, user);
});
authed.get('/households', requirePermission('households.read'), async (c) => ok(c, await listHouseholds(c.env, query(c, HouseholdsQuery))));
authed.get('/billing/summary', requirePermission('billing.read'), async (c) => ok(c, await billingSummary(c.env, query(c, RangeQuery).range)));
authed.get('/billing/transactions', requirePermission('billing.read'), async (c) => ok(c, await listTransactions(c.env, query(c, TransactionsQuery))));
authed.get('/ai/summary', requirePermission('ai.read'), async (c) => ok(c, await aiSummary(c.env, query(c, RangeQuery).range)));
authed.get('/ai/usage', requirePermission('ai.read'), async (c) => ok(c, await listAiUsage(c.env, query(c, AiUsageQuery))));
authed.get('/recipes/summary', requirePermission('recipes.read'), async (c) => { query(c, EmptyQuery); return ok(c, await recipesSummary(c.env)); });
authed.get('/recipes', requirePermission('recipes.read'), async (c) => ok(c, await listRecipes(c.env, query(c, RecipesQuery))));
authed.get('/recipes/:id', requirePermission('recipes.read'), async (c) => {
  const recipe = await getRecipe(c.env, param(c, 'id'));
  if (!recipe) throw notFound();
  return ok(c, recipe);
});
authed.get('/system/status', requirePermission('system.read'), async (c) => { query(c, EmptyQuery); return ok(c, await systemStatus(c.env)); });
authed.get('/audit', requirePermission('audit.read'), async (c) => ok(c, await listAudit(c.env, query(c, AuditQuery))));
authed.get('/settings', requirePermission('admin.self.read'), async (c) => {
  const admin = c.get('admin');
  return ok(c, await settingsFor(c.env, admin.userId, hasAdminPermission(admin.roles, 'admin.roles.read')));
});
authed.get('/sessions', requirePermission('admin.sessions.revoke'), async (c) => {
  const rows = await c.env.DB.prepare(`SELECT id, user_id, auth_method, created_at, last_seen_at, expires_at FROM admin_sessions
      WHERE revoked_at IS NULL AND expires_at > ? AND idle_expires_at > ? ORDER BY created_at DESC, id DESC LIMIT 100`).bind(nowIso(), nowIso())
    .all<{ id: string; user_id: string; auth_method: string; created_at: string; last_seen_at: string | null; expires_at: string }>();
  return ok(c, rows.results.map((row) => ({ id: row.id, userId: row.user_id, authMethod: row.auth_method, createdAt: row.created_at, lastSeenAt: row.last_seen_at, expiresAt: row.expires_at })));
});

// ── Mutations (session + CSRF + write limiter applied above) ───────────────
authed.put('/preferences', requirePermission('admin.preferences.write'), async (c) => {
  const admin = c.get('admin');
  const next = { ...(await preferencesFor(c.env, admin.userId)), ...(await body(c, PreferencesBody)) };
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO admin_user_preferences (user_id, locale, density, sidebar_collapsed, updated_at) VALUES (?, ?, ?, ?, ?)
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
  const recipe = await c.env.DB.prepare('SELECT version FROM recipes WHERE id = ?').bind(recipeId).first<{ version: number }>();
  if (!recipe) throw notFound();
  if (Number(recipe.version) !== input.recipeVersion) throw conflict('Công thức đã thay đổi, vui lòng tải lại.');
  const id = newId('rev');
  const createdAt = nowIso();
  await c.env.DB.batch([
    // Guarded on the version so a concurrent recipe change cannot be reviewed under a stale version.
    c.env.DB.prepare(`INSERT INTO admin_recipe_editorial_reviews (id, recipe_id, recipe_version, state, note, author_user_id, created_at)
        SELECT ?, id, version, ?, ?, ?, ? FROM recipes WHERE id = ? AND version = ?`)
      .bind(id, input.state, input.note, admin.userId, createdAt, recipeId, input.recipeVersion),
    await guardedAuditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'recipes.review.create', targetType: 'recipe', targetId: recipeId,
      outcome: 'success', metadata: { state: input.state, recipeVersion: input.recipeVersion } },
    'EXISTS (SELECT 1 FROM admin_recipe_editorial_reviews WHERE id = ?)', [id]),
  ]);
  const created = await c.env.DB.prepare('SELECT id FROM admin_recipe_editorial_reviews WHERE id = ?').bind(id).first();
  if (!created) throw conflict('Công thức đã thay đổi, vui lòng tải lại.');
  return ok(c, { id, recipeId, state: input.state, note: input.note, authorUserId: admin.userId, recipeVersion: input.recipeVersion, createdAt }, 201);
});

authed.post('/roles', requirePermission('admin.roles.manage'), async (c) => {
  const admin = c.get('admin');
  const input = await body(c, GrantRoleBody);
  if (input.userId === admin.userId) {
    await writeAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.role.grant', targetType: 'user', targetId: input.userId,
      outcome: 'denied', reasonCode: 'self_grant', metadata: { role: input.role } });
    return errorResponse(c, 403, 'ADMIN_FORBIDDEN', 'Không thể tự cấp quyền cho chính mình.');
  }
  const target = await c.env.DB.prepare(`SELECT u.id FROM users u WHERE u.id = ? AND u.is_guest = 0
      AND EXISTS (SELECT 1 FROM auth_accounts a WHERE a.user_id = u.id AND a.is_verified = 1)`).bind(input.userId).first<{ id: string }>();
  if (!target) throw notFound();
  const already = await c.env.DB.prepare(`SELECT 1 AS present FROM admin_role_assignments WHERE user_id = ? AND role = ? AND status = 'active'`)
    .bind(input.userId, input.role).first();
  if (already) throw conflict('Người dùng đã có vai trò này.');

  if (input.role === 'SUPER_ADMIN') {
    const pending = await c.env.DB.prepare(`SELECT 1 AS present FROM admin_action_approvals WHERE action = 'role.grant.super_admin' AND target_user_id = ? AND status = 'pending'`)
      .bind(input.userId).first();
    if (pending) throw conflict('Đã có yêu cầu phê duyệt đang chờ.');
    const id = newId('appr');
    const requestedAt = nowIso();
    const expiresAt = plusMinutes(72 * 60);
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO admin_action_approvals (id, action, target_user_id, requested_by, requested_at, expires_at)
          VALUES (?, 'role.grant.super_admin', ?, ?, ?, ?)`).bind(id, input.userId, admin.userId, requestedAt, expiresAt),
      await auditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.approval.request', targetType: 'user', targetId: input.userId,
        outcome: 'success', metadata: { role: input.role, approvalId: id } }),
    ]);
    return ok(c, { approval: { id, action: 'role.grant.super_admin', targetUserId: input.userId, requestedBy: admin.userId, requestedAt, status: 'pending',
      decidedBy: null, decidedAt: null, expiresAt } }, 201);
  }

  const id = newId('ara');
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO admin_role_assignments (id, user_id, role, grant_source, granted_by, granted_at) VALUES (?, ?, ?, 'admin_grant', ?, ?)`)
        .bind(id, input.userId, input.role, admin.userId, nowIso()),
      await auditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.role.grant', targetType: 'user', targetId: input.userId,
        outcome: 'success', metadata: { role: input.role, assignmentId: id } }),
    ]);
  } catch {
    throw conflict('Người dùng đã có vai trò này.');
  }
  return ok(c, { assignment: { id, userId: input.userId, role: input.role, status: 'active' } }, 201);
});

authed.delete('/roles/:assignmentId', requirePermission('admin.roles.manage'), async (c) => {
  const admin = c.get('admin');
  const id = param(c, 'assignmentId');
  const row = await c.env.DB.prepare(`SELECT id, user_id, role FROM admin_role_assignments WHERE id = ? AND status = 'active'`).bind(id)
    .first<{ id: string; user_id: string; role: string }>();
  if (!row) throw notFound();
  if (row.user_id === admin.userId) {
    await writeAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.role.revoke', targetType: 'user', targetId: row.user_id,
      outcome: 'denied', reasonCode: 'self_revoke', metadata: { role: row.role, assignmentId: id } });
    return errorResponse(c, 403, 'ADMIN_FORBIDDEN', 'Không thể tự thu hồi vai trò của chính mình.');
  }
  const now = nowIso();
  await c.env.DB.batch([
    // The last active SUPER_ADMIN can never be revoked, even under concurrency.
    c.env.DB.prepare(`UPDATE admin_role_assignments SET status = 'revoked', revoked_at = ?, revoked_by = ?, revoke_reason = 'admin_revoke'
        WHERE id = ? AND status = 'active'
          AND (role <> 'SUPER_ADMIN' OR (SELECT COUNT(*) FROM admin_role_assignments WHERE role = 'SUPER_ADMIN' AND status = 'active') > 1)`)
      .bind(now, admin.userId, id),
    c.env.DB.prepare(`UPDATE admin_sessions SET revoked_at = ?, revoked_reason = 'role_revoked' WHERE user_id = ? AND revoked_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM admin_role_assignments WHERE user_id = ? AND status = 'active')`).bind(now, row.user_id, row.user_id),
    await guardedAuditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.role.revoke', targetType: 'user', targetId: row.user_id,
      outcome: 'success', metadata: { role: row.role, assignmentId: id } },
    `EXISTS (SELECT 1 FROM admin_role_assignments WHERE id = ? AND status = 'revoked' AND revoked_at = ?)`, [id, now]),
  ]);
  const after = await c.env.DB.prepare(`SELECT status FROM admin_role_assignments WHERE id = ?`).bind(id).first<{ status: string }>();
  if (after?.status !== 'revoked') {
    await writeAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.role.revoke', targetType: 'user', targetId: row.user_id,
      outcome: 'denied', reasonCode: 'last_super_admin', metadata: { role: row.role, assignmentId: id } });
    throw conflict('Không thể thu hồi quản trị viên cấp cao cuối cùng.');
  }
  return ok(c, { assignment: { id, status: 'revoked' } });
});

for (const decision of ['approve', 'reject'] as const) {
  authed.post(`/approvals/:id/${decision}`, requirePermission('admin.approvals.decide'), async (c) => {
    const admin = c.get('admin');
    const id = param(c, 'id');
    const approval = await c.env.DB.prepare(`SELECT id, target_user_id, requested_by, status, expires_at FROM admin_action_approvals WHERE id = ?`).bind(id)
      .first<{ id: string; target_user_id: string; requested_by: string; status: string; expires_at: string }>();
    if (!approval) throw notFound();
    if (approval.requested_by === admin.userId || approval.target_user_id === admin.userId) {
      await writeAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: `admin.approval.${decision}`, targetType: 'approval', targetId: id,
        outcome: 'denied', reasonCode: 'four_eyes', metadata: { approvalId: id } });
      return errorResponse(c, 403, 'ADMIN_FORBIDDEN', 'Người yêu cầu hoặc người được cấp không thể tự phê duyệt.');
    }
    if (approval.status !== 'pending') throw conflict('Yêu cầu không còn ở trạng thái chờ.');
    if (Date.parse(approval.expires_at) <= Date.now()) {
      await c.env.DB.prepare(`UPDATE admin_action_approvals SET status = 'expired' WHERE id = ? AND status = 'pending'`).bind(id).run();
      throw conflict('Yêu cầu đã hết hạn.');
    }
    const now = nowIso();
    const assignmentId = newId('ara');
    const statements = [
      c.env.DB.prepare(`UPDATE admin_action_approvals SET status = ?, decided_by = ?, decided_at = ? WHERE id = ? AND status = 'pending' AND expires_at > ?`)
        .bind(decision === 'approve' ? 'approved' : 'rejected', admin.userId, now, id, now),
    ];
    if (decision === 'approve') {
      statements.push(c.env.DB.prepare(`INSERT INTO admin_role_assignments (id, user_id, role, grant_source, granted_by, granted_at)
          SELECT ?, target_user_id, 'SUPER_ADMIN', 'approval', ?, ? FROM admin_action_approvals
          WHERE id = ? AND status = 'approved' AND decided_by = ? AND decided_at = ?
            AND NOT EXISTS (SELECT 1 FROM admin_role_assignments r WHERE r.user_id = admin_action_approvals.target_user_id AND r.role = 'SUPER_ADMIN' AND r.status = 'active')`)
        .bind(assignmentId, admin.userId, now, id, admin.userId, now));
    }
    statements.push(await guardedAuditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: `admin.approval.${decision}`, targetType: 'user',
      targetId: approval.target_user_id, outcome: 'success', metadata: { approvalId: id, role: 'SUPER_ADMIN', decision } },
    `EXISTS (SELECT 1 FROM admin_action_approvals WHERE id = ? AND decided_by = ? AND decided_at = ?)`, [id, admin.userId, now]));
    await c.env.DB.batch(statements);
    const after = await c.env.DB.prepare(`SELECT status FROM admin_action_approvals WHERE id = ?`).bind(id).first<{ status: string }>();
    if (after?.status !== (decision === 'approve' ? 'approved' : 'rejected')) throw conflict('Yêu cầu không còn ở trạng thái chờ.');
    return ok(c, { approval: { id, status: after.status } });
  });
}

authed.post('/sessions/:id/revoke', requirePermission('admin.sessions.revoke'), async (c) => {
  const admin = c.get('admin');
  const id = param(c, 'id');
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE admin_sessions SET revoked_at = ?, revoked_reason = 'admin_revoked' WHERE id = ? AND revoked_at IS NULL`).bind(now, id),
    await guardedAuditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.session.revoke', targetType: 'admin_session', targetId: id,
      outcome: 'success', metadata: { sessionId: id } },
    `EXISTS (SELECT 1 FROM admin_sessions WHERE id = ? AND revoked_at = ? AND revoked_reason = 'admin_revoked')`, [id, now]),
  ]);
  const after = await c.env.DB.prepare(`SELECT revoked_reason FROM admin_sessions WHERE id = ? AND revoked_at = ?`).bind(id, now).first();
  if (!after) throw notFound();
  return ok(c, { session: { id, revoked: true } });
});

adminRoutes.route('/', authed);
// Never fall through to customer routes; there is intentionally no bootstrap endpoint.
adminRoutes.all('*', (c) => errorResponse(c, 404, 'ADMIN_NOT_FOUND'));
