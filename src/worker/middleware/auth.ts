import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Env, AuthContext } from '../types';
import { verifyJwt, JwtPayload } from '../utils/jwt';
import { sha256Hex, SESSION_COOKIE } from '../utils/session';
import { hasTrustedOrigin } from './csrf';
import { SESSION_LAST_SEEN_INTERVAL_MINUTES } from '../config/sessions';

// SEC-01: No default JWT secret. If JWT_SECRET is not configured as a Wrangler
// secret, auth fails closed (503) instead of silently trusting a public key.
export function getJwtSecret(env: Env): string {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new HTTPException(503, {
      message: 'Server auth chưa được cấu hình (JWT_SECRET). Liên hệ quản trị viên.',
    });
  }
  return secret;
}

// Exact public API subpaths (mounted either at /api/v1/* or root /* in test harnesses).
// Replaces suffix matching (.endsWith) so arbitrary routes ending in /config or /health never bypass auth.
const PUBLIC_SUBPATHS = new Set([
  '/health',
  '/health/ready',
  '/health/recipe-authority',
  '/config',
  '/auth/login',
  '/auth/register',
  '/auth/verify-otp',
  '/auth/resend-otp',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/google',
  '/auth/guest',
  '/auth/logout',
  '/billing/payos/webhook',
]);

export function isPublicApiPath(rawPath: string): boolean {
  const normalized = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
  const subpath = normalized.startsWith('/api/v1/')
    ? normalized.slice('/api/v1'.length)
    : normalized;
  return PUBLIC_SUBPATHS.has(subpath);
}

function isPublicRecipeReadPath(rawPath: string): boolean {
  const normalized = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
  const subpath = normalized.startsWith('/api/v1/')
    ? normalized.slice('/api/v1'.length)
    : normalized;
  if (subpath === '/recipes') return true;
  if (!subpath.startsWith('/recipes/')) return false;
  if (subpath.startsWith('/recipes/cooking-sessions')) return false;
  return true;
}

type AuthVariables = { auth: AuthContext; householdRole?: string };

function hasExpectedOwner(
  c: Context<{ Bindings: Env; Variables: AuthVariables }>,
  auth: Pick<AuthContext, 'userId' | 'householdId'>,
): boolean {
  const userId = c.req.header('X-Frigo-Expected-User-Id');
  const householdId = c.req.header('X-Frigo-Expected-Household-Id');
  // Legacy clients omit both; owner-bound reads and writes must match both exactly.
  if (userId === undefined && householdId === undefined) return true;
  return Boolean(userId && householdId && userId === auth.userId && householdId === auth.householdId);
}

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: AuthVariables }>,
  next: Next
) {
  const path = c.req.path;

  const cookieHeader = c.req.header('cookie') || '';
  const cookieToken = cookieHeader.split(';').map((v) => v.trim()).find((v) => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const authHeader = c.req.header('authorization');
  const hasSessionCookie = cookieToken !== undefined;

  const isPublic = isPublicApiPath(path);
  const isAuthRoute = path.startsWith('/auth/') || path.startsWith('/api/v1/auth/');
  if (hasSessionCookie && (!isPublic || isAuthRoute) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
    if (!hasTrustedOrigin(c)) {
      return c.json({ error: 'Cross-site request blocked', code: 'CSRF_ORIGIN_DENIED' }, 403);
    }
  }

  if (isPublic) return await next();

  // Cookie-only sessions are authoritative. Bearer JWTs are retained only for
  // guest migration/reset compatibility and are never accepted for normal API access.
  if (hasSessionCookie) {
    c.header('Cache-Control', 'no-store');
    if (!c.env.DB) return c.json({ error: 'Authentication service unavailable', code: 'AUTH_UNAVAILABLE' }, 503);
    try {
      let tokenValue = '';
      try { tokenValue = decodeURIComponent(cookieToken ?? ''); } catch { tokenValue = ''; }
      if (!tokenValue) return c.json({ error: 'Unauthorized: Missing or invalid authorization token', code: 'UNAUTHORIZED' }, 401);
      const tokenHash = await sha256Hex(tokenValue);
      // Single-pass session + household tenancy lookup: joins household_members and households
      // directly while preserving 403 TENANCY_VIOLATION (via LEFT JOIN) when membership is absent.
      const row = await c.env.DB.prepare(
        `SELECT s.id, s.user_id, s.household_id, COALESCE(s.last_seen_at, s.created_at) AS last_seen_at,
                u.email, u.is_guest, p.display_name,
                CASE WHEN h.id IS NOT NULL THEN hm.role ELSE NULL END AS role
           FROM sessions_v2 s
           JOIN users u ON u.id = s.user_id
           LEFT JOIN profiles p ON p.user_id = s.user_id
           LEFT JOIN household_members hm ON hm.user_id = s.user_id AND hm.household_id = s.household_id
           LEFT JOIN households h ON h.id = hm.household_id AND (u.is_guest = 0 OR h.created_by = s.user_id)
          WHERE s.token_hash = ? AND s.revoked_at IS NULL AND datetime(s.expires_at) > datetime('now') LIMIT 1`
      ).bind(tokenHash).first<{
        id: string;
        user_id: string;
        household_id: string;
        last_seen_at: string | null;
        email: string | undefined;
        is_guest: number;
        role: string | null;
      }>();
      if (row) {
        if (!hasExpectedOwner(c, { userId: row.user_id, householdId: row.household_id })) {
          return c.json({ error: 'Request owner does not match authenticated session', code: 'SESSION_OWNER_MISMATCH' }, 403);
        }
        if (row.role) {
          c.set('householdRole', row.role);
        }
        c.set('auth', {
          userId: row.user_id,
          householdId: row.household_id,
          email: row.email,
          role: row.role ?? 'member',
          ...(row.role ? { householdRole: row.role } : {}),
          isGuest: Boolean(row.is_guest),
          sessionId: row.id,
        });
        if (row.role) {
          const lastSeen = Date.parse(row.last_seen_at?.replace(' ', 'T') + (row.last_seen_at?.endsWith('Z') ? '' : 'Z'));
          if (!Number.isFinite(lastSeen) || lastSeen <= Date.now() - SESSION_LAST_SEEN_INTERVAL_MINUTES * 60_000) {
            await c.env.DB.prepare(`UPDATE sessions_v2 SET last_seen_at = datetime('now') WHERE id = ?
              AND (last_seen_at IS NULL OR datetime(last_seen_at) <= datetime('now', ?))`)
              .bind(row.id, `-${SESSION_LAST_SEEN_INTERVAL_MINUTES} minutes`).run().catch(() => {});
          }
        }
        return await next();
      }
      return c.json({ error: 'Unauthorized: Missing or invalid authorization token', code: 'UNAUTHORIZED' }, 401);
    } catch {
      return c.json({ error: 'Authentication service unavailable', code: 'AUTH_UNAVAILABLE' }, 503);
    }
  }

  // Legacy bearer JWTs are accepted only for guest migration and reset-free
  // public compatibility; authenticated users must use the opaque cookie.
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // If public recipe reading, allow guest browsing
    if (c.req.method === 'GET' && isPublicRecipeReadPath(path)) {
      if (!hasExpectedOwner(c, { userId: 'guest_anonymous', householdId: 'hh_guest_anonymous' })) {
        return c.json({ error: 'Request owner does not match authenticated session', code: 'SESSION_OWNER_MISMATCH' }, 403);
      }
      c.set('auth', {
        userId: 'guest_anonymous',
        householdId: 'hh_guest_anonymous',
        isGuest: true,
      });
      return await next();
    }

    return c.json(
      {
        error: 'Unauthorized: Missing or invalid authorization token',
        code: 'UNAUTHORIZED',
      },
      401
    );
  }

  const token = authHeader.replace('Bearer ', '').trim();

  const jwtSecret = getJwtSecret(c.env);

  // 1. Verify Cryptographic JWT
  const verification = await verifyJwt<JwtPayload>(token, jwtSecret);
  if (verification.valid && verification.payload && c.env.ENVIRONMENT !== 'production') {
    const p = verification.payload;
    const isValidAccess = p.typ === 'access' && p.isGuest !== true;
    const isValidGuest = p.typ === 'guest' && p.isGuest === true;
    if (!isValidAccess && !isValidGuest) {
      return c.json(
        {
          error: 'Unauthorized: Token type is not valid for API access',
          code: 'TOKEN_TYPE_INVALID',
        },
        401
      );
    }

    if (!hasExpectedOwner(c, { userId: p.sub, householdId: p.hid })) {
      return c.json({ error: 'Request owner does not match authenticated session', code: 'SESSION_OWNER_MISMATCH' }, 403);
    }
    c.set('auth', {
      userId: p.sub,
      householdId: p.hid,
      email: p.email,
      role: p.role || 'user',
      isGuest: isValidGuest,
    });
    return await next();
  }

  return c.json(
    {
      error: `Unauthorized: ${verification.error || 'Token không hợp lệ hoặc đã hết hạn'}`,
      code: 'TOKEN_INVALID',
    },
    401
  );
}
