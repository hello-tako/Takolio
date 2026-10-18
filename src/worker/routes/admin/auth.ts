import { Hono, type Next } from 'hono';
import { z } from 'zod';
import type { D1DatabaseBinding } from '@frigo/db';
import {
  ADMIN_CSRF_HEADER,
  ADMIN_RBAC_MATRIX_VERSION,
  ADMIN_SESSION_ABSOLUTE_MINUTES,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_IDLE_MINUTES,
  hasAdminPermission,
  isAdminRole,
  permissionsForRoles,
  type AdminMe,
  type AdminPermission,
  type AdminRole,
} from '../../../shared/admin';
import { sha256Hex } from '../../utils/session';
import { accessOptions, verifyAccessAssertion } from './access';
import { auditStatement, guardedAuditStatement, requireAudit, writeAudit } from './audit';
import {
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
import { clientIdentity, consumeLimit, limitResponse } from './limits';
import { maskEmail } from './mask';
import { type AdminPolicy, requestOriginMatches, resolveAdminPolicy } from './policy';
import { CustomerReadClient } from './customer-facade-client';
import { verifyEnrolledAdminAccessIdentity, checkAdminGovernanceReadiness } from './governance';
import { authorityAccount } from './governance';
declare const __ADMIN_LOCAL_AUTH__: unknown;
async function localAuthorityAccount(db: import('@frigo/db').D1DatabaseBinding, email: string, password: string|null) {
  if (typeof __ADMIN_LOCAL_AUTH__ !== 'undefined' && __ADMIN_LOCAL_AUTH__ === true) {
    return (await import('./local-auth')).localAuthorityAccount(db,email,password);
  }
  return null;
}

/** Admin database schema version this build requires (migrations-admin). */
export const ADMIN_SCHEMA_VERSION = '4';

export async function csrfTokenFor(sessionToken: string): Promise<string> {
  return sha256Hex(`takosan-admin-csrf:v1:${sessionToken}`);
}

export async function activeRoles(adminDb: D1DatabaseBinding, userId: string): Promise<AdminRole[]> {
  const rows = await adminDb.prepare(`SELECT role FROM admin_role_assignments WHERE user_id = ? AND status = 'active' ORDER BY role LIMIT 10`)
    .bind(userId).all<{ role: string }>();
  return rows.results.map((row) => row.role).filter(isAdminRole);
}

export function revokeUserSessionsStatement(adminDb: D1DatabaseBinding, userId: string, reason: 'role_changed' | 'credential_changed' | 'auth_mode_changed', now: string) {
  return adminDb.prepare(`UPDATE admin_sessions SET revoked_at = ?, revoked_reason = ? WHERE user_id = ? AND revoked_at IS NULL`).bind(now, reason, userId);
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
    csrfToken: principal.csrfToken,
  };
}

/**
 * First middleware for every admin Worker request (documents, assets, API):
 * disabled or misconfigured console, or a foreign origin, is an opaque 404.
 */
export async function adminSurfaceGate(c: AdminContext, next: Next) {
  const policy = resolveAdminPolicy(c.env);
  c.set('policy', policy);
  if (!policy.enabled) {
    c.header('X-Admin-Disabled', 'true');
    c.header('Cache-Control', 'no-store');
    return c.text('Not Found', 404);
  }
  if (!requestOriginMatches(policy, c.req.url)) return c.text('Not Found', 404);
  await next();
}

/** API prerequisites: both databases, expected admin schema, no synthetic data outside local environments. */
export async function adminApiGate(c: AdminContext, next: Next) {
  const policy = c.get('policy');
  if (!c.env.CUSTOMER_READ || !c.env.ADMIN_DB || 'DB' in c.env) return errorResponse(c, 503, 'ADMIN_UNAVAILABLE');
  let meta: Map<string, string>;
  try {
    const rows = await c.env.ADMIN_DB.prepare(`SELECT key, value FROM admin_config_metadata WHERE key IN ('schema_version', 'fixture_dataset')`)
      .all<{ key: string; value: string }>();
    meta = new Map(rows.results.map((row) => [row.key, row.value]));
  } catch {
    return errorResponse(c, 503, 'ADMIN_SCHEMA_MISMATCH');
  }
  if (meta.get('schema_version') !== ADMIN_SCHEMA_VERSION) return errorResponse(c, 503, 'ADMIN_SCHEMA_MISMATCH');
  const fixture = meta.get('fixture_dataset') ?? null;
  if (fixture && !policy.local) return errorResponse(c, 503, 'ADMIN_FIXTURE_DATA_REJECTED');
  c.set('main', new CustomerReadClient(c.env.CUSTOMER_READ, c.env.ADMIN_FACADE_HMAC_SECRET ?? '', () => c.get('admin')));
  c.set('adminDb', c.env.ADMIN_DB);
  c.set('fixtureDataset', fixture);
  await next();
}

/** Exact admin Origin; Sec-Fetch-Site, when sent, must say same-origin. No Referer fallback. */
function sameOriginRequest(c: AdminContext, policy: AdminPolicy): boolean {
  const site = c.req.header('Sec-Fetch-Site');
  return c.req.header('Origin') === policy.origin && (site === undefined || site === 'same-origin');
}

const accessAssertion = (c: AdminContext) => c.req.header('Cf-Access-Jwt-Assertion') ?? undefined;

async function governanceReady(c: AdminContext): Promise<boolean> {
  if (c.get('policy').local) return true;
  return (await checkAdminGovernanceReadiness(c.get('adminDb'), `https://${c.env.ADMIN_ACCESS_TEAM_DOMAIN?.toLowerCase()}`)).ready;
}

export async function requireAdminSession(c: AdminContext, next: Next) {
  const policy = c.get('policy');
  if (policy.authMode === 'unavailable') return errorResponse(c, 503, 'ADMIN_AUTH_NOT_CONFIGURED');
  const token = readCookie(c, ADMIN_SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return errorResponse(c, 401, 'ADMIN_UNAUTHENTICATED');
  const adminDb = c.get('adminDb');
  const session = await adminDb.prepare(`SELECT id, user_id, account_id, credential_fingerprint, auth_method, created_at, last_seen_at,
      idle_expires_at, expires_at, revoked_at, access_iss, access_sub FROM admin_sessions WHERE token_hash = ? LIMIT 1`).bind(await sha256Hex(token)).first<{
    id: string; user_id: string; account_id: string; credential_fingerprint: string; auth_method: 'password' | 'cloudflare_access';
    created_at: string; last_seen_at: string; idle_expires_at: string; expires_at: string; revoked_at: string | null; access_iss: string | null; access_sub: string | null;
  }>();
  if (!session) return errorResponse(c, 401, 'ADMIN_UNAUTHENTICATED');
  if (session.revoked_at) return errorResponse(c, 401, 'ADMIN_SESSION_REVOKED');
  if (isPast(session.expires_at) || isPast(session.idle_expires_at)) return errorResponse(c, 401, 'ADMIN_SESSION_EXPIRED');

  const revoke = async (reason: 'role_changed' | 'credential_changed' | 'auth_mode_changed', roles: AdminRole[]) => {
    const now = nowIso();
    await adminDb.batch([
      revokeUserSessionsStatement(adminDb, session.user_id, reason, now),
      await auditStatement(c, { actorUserId: session.user_id, actorRoles: roles, action: 'admin.session.revoke', targetType: 'admin_session',
        targetId: session.id, outcome: 'success', reasonCode: reason, metadata: { source: 'session_check' } }),
    ]);
    return errorResponse(c, 401, 'ADMIN_SESSION_REVOKED');
  };

  // A session minted under one authentication mode is not valid under another.
  if (session.auth_method !== policy.authMode) return revoke('auth_mode_changed', []);

  const account = session.auth_method === 'cloudflare_access'
    ? await authorityAccount(adminDb, {issuer:session.access_iss ?? '',subject:session.access_sub ?? ''})
    : await localAuthorityAccount(adminDb, session.account_id, null);
  const credentialsUnchanged = account !== null && account.user_id === session.user_id && account.is_verified === 1 && account.is_guest === 0 &&
    timingSafeEqualHex(account.credentialFingerprint, session.credential_fingerprint);
  if (!credentialsUnchanged) return revoke('credential_changed', []);

  let enrolled = null;
  if (policy.authMode === 'cloudflare_access') {
    const access = await verifyAccessAssertion(accessAssertion(c), c.env, accessOptions);
    if (access.ok) enrolled = await verifyEnrolledAdminAccessIdentity(adminDb, { issuer: access.iss, subject: access.sub });
    if (!access.ok || !enrolled || enrolled.userId !== session.user_id || !account.email || access.email !== account.email.toLowerCase()
      || session.access_iss !== access.iss || session.access_sub !== access.sub) {
      await requireAudit(c, { actorUserId: session.user_id, actorRoles: [], action: 'admin.access.denied', outcome: 'denied', reasonCode: 'identity_mismatch' });
      return errorResponse(c, 401, 'ADMIN_ACCESS_DENIED');
    }
  }
  else if (policy.local) {
    // Password mode is a local-only fixture/provisioning path, not Access verification.
    const identity = await adminDb.prepare(`SELECT access_iss, access_sub FROM operator_identity_bindings
      WHERE user_id = ? AND status = 'active' LIMIT 1`).bind(session.user_id).first<{ access_iss: string; access_sub: string }>();
    if (identity) enrolled = await verifyEnrolledAdminAccessIdentity(adminDb, { issuer: identity.access_iss, subject: identity.access_sub });
  }

  const roles = await activeRoles(adminDb, session.user_id);
  if (roles.length === 0) return revoke('role_changed', []);
  if (!(await governanceReady(c))) return errorResponse(c, 503, 'ADMIN_GOVERNANCE_INCOMPLETE');

  let idleExpiresAt = session.idle_expires_at;
  if (Date.now() - Date.parse(session.last_seen_at) >= 60_000) {
    idleExpiresAt = new Date(Math.min(Date.now() + ADMIN_SESSION_IDLE_MINUTES * 60_000, Date.parse(session.expires_at))).toISOString();
    await adminDb.prepare(`UPDATE admin_sessions SET last_seen_at = ?, idle_expires_at = ? WHERE id = ? AND revoked_at IS NULL`)
      .bind(nowIso(), idleExpiresAt, session.id).run();
  }
  c.set('admin', {
    userId: session.user_id, roles, permissions: permissionsForRoles(roles), sessionId: session.id, csrfToken: await csrfTokenFor(token),
    authMethod: session.auth_method, createdAt: session.created_at, expiresAt: session.expires_at, idleExpiresAt,
    email: account.email, displayName: account.display_name,
    ...(enrolled ? { accessIss: enrolled.issuer, accessSub: enrolled.subject, operatorId: enrolled.operatorId } : {}),
  });
  await next();
}

/** Every state change: exact admin Origin plus the session-derived CSRF token. */
export async function requireCsrf(c: AdminContext, next: Next) {
  if (['GET', 'HEAD'].includes(c.req.method)) return next();
  const admin = c.get('admin');
  const header = c.req.header(ADMIN_CSRF_HEADER);
  const valid = sameOriginRequest(c, c.get('policy')) && typeof header === 'string' && /^[0-9a-f]{64}$/.test(header) &&
    timingSafeEqualHex(header, admin.csrfToken);
  if (!valid) {
    await writeAudit(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.csrf.denied', outcome: 'denied',
      reasonCode: 'csrf', metadata: { method: c.req.method, path: c.req.routePath } });
    return errorResponse(c, 403, 'ADMIN_CSRF_FAILED');
  }
  await next();
}

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

/** Per-admin read/write budgets, plus fail-closed behavior without KV outside local environments. */
export async function requestBudget(c: AdminContext, next: Next) {
  const write = !['GET', 'HEAD'].includes(c.req.method);
  const result = await consumeLimit(c.env, c.get('policy').local, write ? 'write' : 'read', c.get('admin').userId, write ? 20 : 120, 60);
  if (!result.ok) return limitResponse(c, result);
  await next();
}

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(1).max(256),
}).strict();

const SESSION_RETENTION_DAYS = 30;

export const adminAuthRoutes = new Hono<AdminApp>();

// Public: the mode only. Environment and configuration details stay server-side.
adminAuthRoutes.get('/auth/config', (c) => c.json({ data: { mode: c.get('policy').authMode } }));

adminAuthRoutes.post('/auth/login', async (c) => {
  const policy = c.get('policy');
  if (!sameOriginRequest(c, policy)) return errorResponse(c, 403, 'ADMIN_CSRF_FAILED');
  if (policy.authMode === 'unavailable') return errorResponse(c, 503, 'ADMIN_AUTH_NOT_CONFIGURED');

  // Global, per-IP and (below) per-account budgets are independent.
  for (const [name, identity, max, windowSeconds] of [['login-global', 'all', 60, 60], ['login-ip', clientIdentity(c, policy), 5, 60]] as const) {
    const result = await consumeLimit(c.env, policy.local, name, identity, max, windowSeconds);
    if (!result.ok) return limitResponse(c, result);
  }

  let email: string;
  let accessIdentity: { iss: string; sub: string; email: string } | null = null;
  let password: string | null = null;
  if (policy.authMode === 'cloudflare_access') {
    const access = await verifyAccessAssertion(accessAssertion(c), c.env, accessOptions);
    if (!access.ok) {
      await writeAudit(c, { actorUserId: null, actorRoles: [], action: 'admin.login', outcome: 'failure', reasonCode: `access_${access.reason}`.slice(0, 64) });
      return errorResponse(c, 401, 'ADMIN_ACCESS_DENIED');
    }
    email = access.email;
    accessIdentity = access;
  } else {
    let body: unknown;
    try { body = await c.req.json(); } catch { body = null; }
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) return errorResponse(c, 400, 'ADMIN_VALIDATION_FAILED');
    email = parsed.data.email;
    password = parsed.data.password;
  }
  const account = accessIdentity
    ? await authorityAccount(c.get('adminDb'), {issuer:accessIdentity.iss,subject:accessIdentity.sub})
    : await localAuthorityAccount(c.get('adminDb'), email, password);
  if (accessIdentity && (!account || account.email.toLowerCase() !== accessIdentity.email)) {
    await requireAudit(c,{actorUserId:null,actorRoles:[],action:'admin.access.denied',outcome:'denied',reasonCode:'identity_mismatch'});
    return errorResponse(c,403,'ADMIN_ACCESS_DENIED');
  }
  let reason: string | null = account ? null : 'invalid_credentials';
  if (!reason && account && (account.is_verified !== 1 || account.is_guest !== 0)) reason = 'not_verified';
  const adminDb = c.get('adminDb');
  const roles = !reason && account ? await activeRoles(adminDb, account.user_id) : [];
  if (!reason && roles.length === 0) reason = 'no_admin_role';
  if (reason || !account) {
    const accountBudget = await consumeLimit(c.env, policy.local, 'login-failure', accessIdentity ? `${accessIdentity.iss}:${accessIdentity.sub}` : `${clientIdentity(c,policy)}:${email}`, 10, 15 * 60);
    if (!accountBudget.ok) return limitResponse(c, accountBudget);
    await writeAudit(c, { actorUserId: reason === 'no_admin_role' ? account?.user_id ?? null : null, actorRoles: [], action: 'admin.login',
      outcome: 'failure', reasonCode: reason ?? 'invalid_credentials' });
    return errorResponse(c, 401, 'ADMIN_INVALID_CREDENTIALS');
  }

  if (accessIdentity) {
    const enrolled = await verifyEnrolledAdminAccessIdentity(adminDb, { issuer: accessIdentity.iss, subject: accessIdentity.sub });
    if (!enrolled || enrolled.userId !== account.user_id) {
      await requireAudit(c, { actorUserId: account.user_id, actorRoles: [], action: 'admin.access.denied', outcome: 'denied', reasonCode: 'identity_mismatch' });
      return errorResponse(c, 403, 'ADMIN_ACCESS_DENIED');
    }
  }
  if (!(await governanceReady(c))) return errorResponse(c, 503, 'ADMIN_GOVERNANCE_INCOMPLETE');

  const token = randomHex(32);
  const sessionId = newId('asess');
  const createdAt = nowIso();
  const expiresAt = plusMinutes(ADMIN_SESSION_ABSOLUTE_MINUTES);
  const idleExpiresAt = plusMinutes(ADMIN_SESSION_IDLE_MINUTES);
  const authMethod = policy.authMode;
  await adminDb.batch([
    // Retention hygiene for long-dead sessions.
    adminDb.prepare(`DELETE FROM admin_sessions WHERE id IN (SELECT id FROM admin_sessions WHERE expires_at < ? LIMIT 100)`)
      .bind(new Date(Date.now() - SESSION_RETENTION_DAYS * 86_400_000).toISOString()),
    adminDb.prepare(`INSERT INTO admin_sessions (id, user_id, account_id, token_hash, credential_fingerprint, auth_method, created_at, last_seen_at,
        idle_expires_at, expires_at, access_iss, access_sub)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM admin_role_assignments WHERE user_id = ? AND status = 'active')
        AND (? IS NULL OR EXISTS (SELECT 1 FROM operator_identity_bindings b
          JOIN approved_human_operators h ON h.operator_id = b.operator_id AND h.status = 'active'
          WHERE b.user_id = ? AND b.access_iss = ? AND b.access_sub = ? AND b.status = 'active'))`)
      .bind(sessionId, account.user_id, authMethod === 'password' ? account.email : account.id, await sha256Hex(token), account.credentialFingerprint, authMethod, createdAt, createdAt, idleExpiresAt, expiresAt, accessIdentity?.iss ?? null, accessIdentity?.sub ?? null,
        account.user_id, accessIdentity?.iss ?? null, account.user_id, accessIdentity?.iss ?? null, accessIdentity?.sub ?? null),
    await guardedAuditStatement(c, { actorUserId: account.user_id, actorRoles: roles, action: 'admin.login', targetType: 'admin_session', targetId: sessionId,
      outcome: 'success', metadata: { authMethod, rbacMatrixVersion: ADMIN_RBAC_MATRIX_VERSION } },
      'EXISTS (SELECT 1 FROM admin_sessions WHERE id = ?)', [sessionId]),
  ]);
  const inserted = await adminDb.prepare('SELECT id FROM admin_sessions WHERE id = ?').bind(sessionId).first();
  if (!inserted) return errorResponse(c, 409, 'ADMIN_CONFLICT');
  c.header('Set-Cookie', `${ADMIN_SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ADMIN_SESSION_ABSOLUTE_MINUTES * 60}`);
  const csrfToken = await csrfTokenFor(token);
  const me = meFromPrincipal({ userId: account.user_id, roles, permissions: permissionsForRoles(roles), sessionId, csrfToken, authMethod,
    createdAt, expiresAt, idleExpiresAt, email: account.email, displayName: account.display_name });
  return c.json({ data: me, context: { environment: policy.environment ?? 'unknown', generatedAt: nowIso(), fixtureDataset: c.get('fixtureDataset') }, csrfToken });
});

adminAuthRoutes.post('/auth/logout', requireAdminSession, requireCsrf, async (c) => {
  const admin = c.get('admin');
  const adminDb = c.get('adminDb');
  await adminDb.batch([
    adminDb.prepare(`UPDATE admin_sessions SET revoked_at = ?, revoked_reason = 'logout' WHERE id = ? AND revoked_at IS NULL`).bind(nowIso(), admin.sessionId),
    await auditStatement(c, { actorUserId: admin.userId, actorRoles: admin.roles, action: 'admin.logout', targetType: 'admin_session', targetId: admin.sessionId, outcome: 'success' }),
  ]);
  c.header('Set-Cookie', `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  return c.json({ data: { loggedOut: true } });
});
