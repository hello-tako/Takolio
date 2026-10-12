import { Hono, type Context, type Next } from 'hono';
import { z } from 'zod';
import type { Env } from '../../types';
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_CSRF_HEADER,
  ADMIN_SESSION_ABSOLUTE_MINUTES,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_IDLE_MINUTES,
  ADMIN_RBAC_MATRIX_VERSION,
  hasAdminPermission,
  isAdminRole,
  permissionsForRoles,
  type AdminAuthConfig,
  type AdminAuthMode,
  type AdminMe,
  type AdminPermission,
  type AdminRole,
} from '../../../shared/admin';
import { hasTrustedOrigin } from '../../middleware/csrf';
import { rateLimiter } from '../../middleware/rate-limit';
import { hashPassword, verifyPassword } from '../../utils/password';
import { sha256Hex } from '../../utils/session';
import { accessConfigured, accessOptions, verifyAccessAssertion } from './access';
import { auditStatement, writeAudit } from './audit';
import {
  adminError,
  dataContext,
  errorResponse,
  isPast,
  newId,
  nowIso,
  plusMinutes,
  randomHex,
  readCookie,
  timingSafeEqualHex,
  type AdminApp,
  type AdminContext,
  type AdminPrincipal,
} from './http';
import { maskEmail } from './mask';

export function consoleEnabled(env: Env): boolean {
  const environment = env.ENVIRONMENT || 'development';
  if (environment === 'production') return env.ADMIN_CONSOLE_ENABLED === 'true';
  return env.ADMIN_CONSOLE_ENABLED !== 'false';
}

export function hostAllowed(env: Env, url: string): boolean {
  if (!env.ADMIN_HOSTNAME) return true;
  try {
    return new URL(url).hostname === env.ADMIN_HOSTNAME.toLowerCase();
  } catch {
    return false;
  }
}

export function resolveAuthMode(env: Env): AdminAuthMode {
  const environment = env.ENVIRONMENT || 'development';
  if (env.ADMIN_AUTH_MODE === 'cloudflare_access' && accessConfigured(env)) return 'cloudflare_access';
  if (environment === 'production') return 'unavailable';
  if (environment === 'development' || env.ADMIN_PASSWORD_LOGIN_ENABLED === 'true') return 'password';
  return 'unavailable';
}

export function authConfig(env: Env): AdminAuthConfig {
  const mode = resolveAuthMode(env);
  return {
    mode,
    environment: env.ENVIRONMENT || 'development',
    ...(mode === 'unavailable' ? { reason: 'Cần cấu hình Cloudflare Access (ADMIN_AUTH_MODE, ADMIN_ACCESS_TEAM_DOMAIN, ADMIN_ACCESS_AUD).' } : {}),
  };
}

function sessionCookies(token: string, csrf: string): string[] {
  const maxAge = ADMIN_SESSION_ABSOLUTE_MINUTES * 60;
  return [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`,
    `${ADMIN_CSRF_COOKIE}=${encodeURIComponent(csrf)}; Path=/; Secure; SameSite=Strict; Max-Age=${maxAge}`,
  ];
}

function clearedCookies(): string[] {
  return [
    `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${ADMIN_CSRF_COOKIE}=; Path=/; Secure; SameSite=Strict; Max-Age=0`,
  ];
}

export async function activeRoles(env: Env, userId: string): Promise<AdminRole[]> {
  const rows = await env.DB.prepare(`SELECT role FROM admin_role_assignments
      WHERE user_id = ? AND status = 'active' ORDER BY role LIMIT 10`).bind(userId).all<{ role: string }>();
  return rows.results.map((row) => row.role).filter(isAdminRole);
}

export function meFromPrincipal(principal: AdminPrincipal): AdminMe {
  return {
    userId: principal.userId,
    displayName: principal.displayName ?? 'Quản trị viên',
    email: hasAdminPermission(principal.roles, 'users.pii.reveal') ? principal.email ?? '' : maskEmail(principal.email) ?? '',
    roles: principal.roles,
    permissions: principal.permissions,
    session: {
      id: principal.sessionId,
      authMethod: principal.authMethod,
      createdAt: principal.createdAt,
      expiresAt: principal.expiresAt,
      idleExpiresAt: principal.idleExpiresAt,
    },
    rbacMatrixVersion: ADMIN_RBAC_MATRIX_VERSION,
  };
}

/** Rejects requests while the console is disabled, on a foreign hostname, or without an auth mode. */
export async function adminGate(c: AdminContext, next: Next) {
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex, nofollow');
  if (!consoleEnabled(c.env) || !hostAllowed(c.env, c.req.url)) return errorResponse(c, 404, 'ADMIN_NOT_FOUND');
  if (!c.env.DB) return errorResponse(c, 503, 'ADMIN_UNAVAILABLE');
  c.set('adminMode', resolveAuthMode(c.env));
  await next();
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex, nofollow');
}

const accessAssertion = (c: Context) => c.req.header('Cf-Access-Jwt-Assertion') ?? undefined;

/** Session middleware: every authenticated admin route runs behind this. */
export async function requireAdminSession(c: AdminContext, next: Next) {
  const mode = c.get('adminMode');
  if (mode === 'unavailable') return errorResponse(c, 503, 'ADMIN_AUTH_NOT_CONFIGURED');
  const token = readCookie(c, ADMIN_SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return errorResponse(c, 401, 'ADMIN_UNAUTHENTICATED');
  const row = await c.env.DB.prepare(`SELECT s.id, s.user_id, s.csrf_hash, s.auth_method, s.created_at, s.last_seen_at,
        s.idle_expires_at, s.expires_at, s.revoked_at, a.email, p.display_name
      FROM admin_sessions s JOIN users u ON u.id = s.user_id
      LEFT JOIN auth_accounts a ON a.user_id = s.user_id
      LEFT JOIN profiles p ON p.user_id = s.user_id
      WHERE s.token_hash = ? AND u.is_guest = 0 LIMIT 1`).bind(await sha256Hex(token)).first<{
    id: string; user_id: string; csrf_hash: string; auth_method: 'password' | 'cloudflare_access'; created_at: string;
    last_seen_at: string; idle_expires_at: string; expires_at: string; revoked_at: string | null; email: string | null; display_name: string | null;
  }>();
  if (!row) return errorResponse(c, 401, 'ADMIN_UNAUTHENTICATED');
  if (row.revoked_at) return errorResponse(c, 401, 'ADMIN_SESSION_REVOKED');
  if (isPast(row.expires_at) || isPast(row.idle_expires_at)) return errorResponse(c, 401, 'ADMIN_SESSION_EXPIRED');
  // A session minted under one mode is not valid under another.
  if ((mode === 'cloudflare_access') !== (row.auth_method === 'cloudflare_access')) return errorResponse(c, 401, 'ADMIN_SESSION_REVOKED');
  if (mode === 'cloudflare_access') {
    const access = await verifyAccessAssertion(accessAssertion(c), c.env, accessOptions);
    if (!access.ok || !row.email || access.email !== row.email.toLowerCase()) return errorResponse(c, 401, 'ADMIN_ACCESS_DENIED');
  }

  const roles = await activeRoles(c.env, row.user_id);
  if (roles.length === 0) {
    await c.env.DB.prepare(`UPDATE admin_sessions SET revoked_at = ?, revoked_reason = 'role_revoked'
        WHERE user_id = ? AND revoked_at IS NULL`).bind(nowIso(), row.user_id).run();
    await writeAudit(c, { actorUserId: row.user_id, actorRoles: [], action: 'admin.session.denied', outcome: 'denied', reasonCode: 'no_active_role' });
    return errorResponse(c, 401, 'ADMIN_SESSION_REVOKED');
  }

  let idleExpiresAt = row.idle_expires_at;
  if (Date.now() - Date.parse(row.last_seen_at) >= 60_000) {
    const slid = new Date(Math.min(Date.now() + ADMIN_SESSION_IDLE_MINUTES * 60_000, Date.parse(row.expires_at))).toISOString();
    await c.env.DB.prepare(`UPDATE admin_sessions SET last_seen_at = ?, idle_expires_at = ? WHERE id = ? AND revoked_at IS NULL`)
      .bind(nowIso(), slid, row.id).run();
    idleExpiresAt = slid;
  }
  c.set('admin', {
    userId: row.user_id, roles, permissions: permissionsForRoles(roles), sessionId: row.id, csrfHash: row.csrf_hash,
    authMethod: row.auth_method, createdAt: row.created_at, expiresAt: row.expires_at, idleExpiresAt,
    email: row.email, displayName: row.display_name,
  });
  await next();
}

/** Double-submit token bound to the session plus a trusted Origin, for every state change. */
export async function requireCsrf(c: AdminContext, next: Next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) return next();
  const admin = c.get('admin');
  const header = c.req.header(ADMIN_CSRF_HEADER);
  const valid = hasTrustedOrigin(c) && typeof header === 'string' && /^[0-9a-f]{64}$/.test(header) &&
    timingSafeEqualHex(await sha256Hex(header), admin.csrfHash);
  if (!valid) {
    await writeAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.csrf.denied', outcome: 'denied',
      reasonCode: 'csrf', metadata: { method: c.req.method, path: c.req.routePath } });
    return errorResponse(c, 403, 'ADMIN_CSRF_FAILED');
  }
  await next();
}

/** Explicit per-route permission check; denials are audited. */
export function requirePermission(permission: AdminPermission) {
  return async (c: AdminContext, next: Next) => {
    const admin = c.get('admin');
    if (!admin || !hasAdminPermission(admin.roles, permission)) {
      if (admin) {
        await writeAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.permission.denied', outcome: 'denied',
          reasonCode: 'missing_permission', metadata: { permission, method: c.req.method, path: c.req.routePath } });
      }
      return errorResponse(c, 403, 'ADMIN_FORBIDDEN');
    }
    await next();
  };
}

const adminUserKey = (c: Context) => {
  const admin = (c as AdminContext).get('admin');
  return admin ? `admin:${admin.userId}` : undefined;
};

export const readLimiter = rateLimiter({ maxRequests: 120, windowSeconds: 60, prefix: 'rl_admin_read', scope: 'account', key: adminUserKey });
export const writeLimiter = rateLimiter({ maxRequests: 20, windowSeconds: 60, prefix: 'rl_admin_write', scope: 'account', enforcement: 'fail-closed', key: adminUserKey });
const loginLimiter = rateLimiter({ maxRequests: 5, windowSeconds: 60, prefix: 'rl_admin_login', scope: 'account', enforcement: 'fail-closed',
  key: (c) => `ip:${c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'anonymous_client'}` });

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(1).max(256),
}).strict();

const DUMMY_SALT = 'admin-login-dummy-salt';

export const adminAuthRoutes = new Hono<AdminApp>();

adminAuthRoutes.get('/auth/config', async (c) => c.json({ data: authConfig(c.env), context: await dataContext(c) }));

adminAuthRoutes.post('/auth/login', async (c, next) => {
  if (!hasTrustedOrigin(c)) return errorResponse(c, 403, 'ADMIN_CSRF_FAILED');
  if (c.get('adminMode') === 'unavailable') return errorResponse(c, 503, 'ADMIN_AUTH_NOT_CONFIGURED');
  return next();
}, loginLimiter as never, async (c) => {
  const mode = c.get('adminMode');
  let userId: string | null = null;
  let reason: string | null = null;

  if (mode === 'cloudflare_access') {
    const access = await verifyAccessAssertion(accessAssertion(c), c.env, accessOptions);
    if (!access.ok) {
      await writeAudit(c, { actorUserId: null, actorRoles: [], action: 'admin.login', outcome: 'failure', reasonCode: `access_${access.reason}`.slice(0, 64) });
      return errorResponse(c, 401, 'ADMIN_ACCESS_DENIED');
    }
    const account = await c.env.DB.prepare(`SELECT a.user_id FROM auth_accounts a JOIN users u ON u.id = a.user_id
        WHERE a.email = ? AND a.is_verified = 1 AND u.is_guest = 0 LIMIT 1`).bind(access.email).first<{ user_id: string }>();
    userId = account?.user_id ?? null;
    if (!userId) reason = 'invalid_credentials';
  } else {
    let body: unknown;
    try { body = await c.req.json(); } catch { body = null; }
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) return errorResponse(c, 400, 'ADMIN_VALIDATION_FAILED');
    const account = await c.env.DB.prepare(`SELECT a.user_id, a.password_hash, a.salt, a.is_verified, u.is_guest
        FROM auth_accounts a JOIN users u ON u.id = a.user_id WHERE a.email = ? LIMIT 1`).bind(parsed.data.email)
      .first<{ user_id: string; password_hash: string | null; salt: string | null; is_verified: number; is_guest: number }>();
    if (!account || !account.password_hash || !account.salt) {
      await hashPassword(parsed.data.password, DUMMY_SALT);
      reason = 'invalid_credentials';
    } else if (!(await verifyPassword(parsed.data.password, account.salt, account.password_hash))) {
      reason = 'invalid_credentials';
    } else if (account.is_verified !== 1 || account.is_guest !== 0) {
      reason = 'not_verified';
    } else {
      userId = account.user_id;
    }
  }

  const roles = userId && !reason ? await activeRoles(c.env, userId) : [];
  if (userId && !reason && roles.length === 0) reason = 'no_admin_role';
  if (!userId || reason) {
    await writeAudit(c, { actorUserId: reason === 'no_admin_role' ? userId : null, actorRoles: [], action: 'admin.login', outcome: 'failure', reasonCode: reason ?? 'invalid_credentials' });
    return errorResponse(c, 401, 'ADMIN_INVALID_CREDENTIALS');
  }

  const token = randomHex(32);
  const csrf = randomHex(32);
  const sessionId = newId('asess');
  const createdAt = nowIso();
  const expiresAt = plusMinutes(ADMIN_SESSION_ABSOLUTE_MINUTES);
  const idleExpiresAt = plusMinutes(ADMIN_SESSION_IDLE_MINUTES);
  const authMethod = mode === 'cloudflare_access' ? 'cloudflare_access' : 'password';
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO admin_sessions (id, user_id, token_hash, csrf_hash, auth_method, created_at, last_seen_at, idle_expires_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(sessionId, userId, await sha256Hex(token), await sha256Hex(csrf), authMethod, createdAt, createdAt, idleExpiresAt, expiresAt),
    await auditStatement(c, { actorUserId: userId, actorRoles: roles, action: 'admin.login', targetType: 'admin_session', targetId: sessionId,
      outcome: 'success', metadata: { authMethod, rbacMatrixVersion: ADMIN_RBAC_MATRIX_VERSION } }),
  ]);
  const profile = await c.env.DB.prepare(`SELECT a.email, p.display_name FROM auth_accounts a LEFT JOIN profiles p ON p.user_id = a.user_id
      WHERE a.user_id = ? LIMIT 1`).bind(userId).first<{ email: string | null; display_name: string | null }>();
  for (const cookie of sessionCookies(token, csrf)) c.header('Set-Cookie', cookie, { append: true });
  const me = meFromPrincipal({ userId, roles, permissions: permissionsForRoles(roles), sessionId, csrfHash: '', authMethod,
    createdAt, expiresAt, idleExpiresAt, email: profile?.email ?? null, displayName: profile?.display_name ?? null });
  return c.json({ data: me, context: await dataContext(c), csrfToken: csrf });
});

adminAuthRoutes.post('/auth/logout', requireAdminSession, requireCsrf, async (c) => {
  const admin = c.get('admin');
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE admin_sessions SET revoked_at = ?, revoked_reason = 'logout' WHERE id = ? AND revoked_at IS NULL`).bind(nowIso(), admin.sessionId),
    await auditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.logout', targetType: 'admin_session', targetId: admin.sessionId, outcome: 'success' }),
  ]);
  for (const cookie of clearedCookies()) c.header('Set-Cookie', cookie, { append: true });
  return c.json({ data: { loggedOut: true }, context: await dataContext(c) });
});

export { adminError };
